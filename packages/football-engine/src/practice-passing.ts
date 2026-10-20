import {teammatePassObstruction} from './practice-lanes.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {ConnectionContext,ConnectionRead} from './practice-connections.js';
import {readNextConnection} from './practice-connections.js';
import {strikePowerLimit} from './practice-striking.js';
import {runMeetings} from './practice-meetings.js';
import type {ReceivingSpace} from './practice-meetings.js';
import {steer,steerMotion,STEP} from './movement.js';
import type {Vec} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import type {SupportPlan} from './practice-support.js';
import {assessShot,goalAngle} from './practice-football.js';
import {keeperReadyPosition} from './practice-keeper.js';
import {arrivalTime} from './practice-defense.js';
import {PASS_DRAG,preferredArrival} from './practice-flight.js';
import {receptionResidual} from './practice-reception.js';
import {turnoverPrice,deliveryLossWeight} from './practice-rest-defence.js';
import {daring,perceive} from './practice-perception.js';
import {feltPressure,possessionSafety,readerMargin,readKickHorizon,carrierMeets} from './practice-possession.js';
import type {PasserRead} from './practice-possession.js';
import {WORLD} from './world.js';
export {PASS_DRAG} from './practice-flight.js';

export interface PassRun {aim:Vec;speed:number}
export interface GroundPass {aim:Vec;speed:number;flight:number;arrivalSpeed:number;risk:number;controlRisk:number;reachMargin:number;weight:'soft'|'measured'|'firm';meetingTime?:number}
export interface DeliveryRead {kind:'cutback'|'square'|'forward'|'link';risk:number;shotGain:number;connectionGain:number;connectionTarget?:string;continuation?:ConnectionRead['continuation']}
type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(p:PracticePlayer,x:number)=>p.side===0?x:L-x;
const bound=(p:Vec):Vec=>({x:clamp(p.x,.8,(L-.8)),y:clamp(p.y,-(W/2-1),(W/2-1))});
/** Room to act after arrival, not merely an empty destination now. As in the
 * support evaluator, use visible momentum and ordinary defensive acceleration.
 * This is a graded preference: zero room does not prohibit a contested pass. */
export function receivingRoom(aim:Vec,opponents:PracticePlayer[],flight:number):number{
 return clamp((Math.min(...opponents.filter(d=>d.role!=='GK').map(d=>arrivalTime(d,aim)))-flight)/.8,0,1);
}
/** What the receiver can do next, read from what the passer can see (gap 1,
 * cheap form; no carry is evaluated per candidate). The same read of the
 * carrier where he stands (flight 0) is what keeping the ball offers, so a
 * delivery is credited only for the prospects it ADDS (passProspects): a
 * flat credit for any pass to a free man would bias every carrier towards
 * passing and away from carrying or shooting.
 *  - time: how long past the 0.8 s receivingRoom already credits (it
 *    saturates there) before the first defender can reach the reception, up
 *    to 2 s: time to turn, face up and choose;
 *  - cover: the same for a covering second defender, up to 2.5 s;
 *  - numbers: attackers (the receiver included) against defenders able to
 *    arrive within 1.5 s of the reception, the local overload.
 * `value` is the delivery's credit, a term of its own: not part of
 * connectionGain, which patient play reads.
 *
 * Every arrival time is the READER's (the passer's) estimate, not the
 * engine's (R2): his error grows as his reading and passing fall
 * (ARRIVAL_SPREAD s for a player who cannot read at all), and a daring passer
 * thinks defenders arrive a little later than they do. Without a reader the
 * read is exact. */
export const ARRIVAL_SPREAD=.6,ARRIVAL_OPTIMISM=.12;
export function receiverProspects(q:PracticePlayer,aim:Vec,players:readonly PracticePlayer[],flight:number,reader?:PracticePlayer):{time:number;cover:number;numbers:number;value:number}{
 const bias=reader?ARRIVAL_OPTIMISM*daring(reader):0;
 const seen=(d:PracticePlayer,own:boolean)=>{const t=arrivalTime(d,aim);return reader?perceive(reader,'arrival',t,ARRIVAL_SPREAD,aim,{salt:d.id,bias:own?-bias:bias}):t;};
 const theirs=players.filter(d=>d.side!==q.side&&d.role!=='GK').map(d=>seen(d,false)).sort((a,b)=>a-b);
 const time=clamp(((theirs[0]??Infinity)-flight-.8)/1.2,0,1),cover=clamp(((theirs[1]??Infinity)-flight-.8)/1.7,0,1);
 const window=flight+1.5;
 const ours=1+players.filter(p=>p.side===q.side&&p.id!==q.id&&p.role!=='GK'&&seen(p,true)<=window).length;
 const numbers=clamp((ours-theirs.filter(t=>t<=window).length)/2,-1,1);
 return {time,cover,numbers,value:time*.05+cover*.03+numbers*.03};
}
/** The receiver's prospects beyond the carrier's own (never negative),
 * counted where time on the ball turns into an attack: nothing for a
 * reception in our own first 11 m, rising to full value 30 m from our goal.
 * Deep in our half a free man is a safe reset, which the ordinary room and
 * risk reads already price; crediting it again made teams recycle instead of
 * progressing. */
export const PROSPECT_BEHIND=WORLD.geometry.passing.PROSPECT_BEHIND.v;
export function passProspects(p:PracticePlayer,from:Vec,q:PracticePlayer,aim:Vec,players:readonly PracticePlayer[],flight:number,own=receiverProspects({...p,...from},from,players,0,p).value):number{
 // R3 P3: counted as far as the receiver is not behind the ball. The
 // freest team-mate is usually the deepest, and crediting his time on the
 // ball paid for going backwards; a free man behind the ball is a reset,
 // which the room, risk and (patient) reset reads already price. Full value
 // level with the ball or ahead, none PROSPECT_BEHIND metres behind it.
 const zone=clamp((depth(p,aim.x)-X(25))/X(40),0,1)*clamp(1+(depth(p,aim.x)-depth(p,from.x))/PROSPECT_BEHIND,0,1);
 return zone&&Math.max(0,receiverProspects(q,aim,players,flight,p).value-own)*zone;
}
export function passFlightTime(length:number,speed:number):number{
 if(length<=0)return 0;
 const discriminant=speed*speed-2*PASS_DRAG*length;
 return speed>0&&discriminant>=0?2*length/(speed+Math.sqrt(discriminant)):Infinity;
}

/** A receiver reacts to the kick after this long (the flight receiver's
 * reception movement starts at the same moment in the match loop). */
export const RECEIVER_REACTION=.12;
/** Body-to-aim distance at which the reception movement counts a point on the
 * ball's path as reached (receptionTarget's own tolerance). */
export const RECEIVING_REACH=.65;
/** Where a moving team-mate will actually be when a ball played to his feet
 * arrives: he keeps his momentum while he reacts, then brakes to meet it.
 * A lead of a fixed share of his motion let a firm ball arrive where he had
 * been, behind a receiver still carried on by his run. */
export function receiverLead(q:PracticePlayer,flight:number):Vec{
 const speed=Math.hypot(q.vx,q.vy);if(speed<.05||!(flight>0))return {x:q.x,y:q.y};
 const react=Math.min(flight,RECEIVER_REACTION),braking=Math.max(0,flight-react),stop=speed/q.acceleration;
 const travel=speed*react+(braking<stop?speed*braking-.5*q.acceleration*braking*braking:speed*speed/(2*q.acceleration));
 return {x:q.x+q.vx/speed*travel,y:q.y+q.vy/speed*travel};
}
/** Time for a receiver to reach a reception at `aim`, matching execution: a
 * foot touches only a ball in front of the body, so a point he is running
 * away from gets no reach allowance (he must stop and come back), and any
 * other point is reached within the reception tolerance, not a free metre. */
export function receptionTime(p:PracticePlayer,aim:Vec):number{
 const d=distance(p,aim),ux=d>1e-6?(aim.x-p.x)/d:0,uy=d>1e-6?(aim.y-p.y)/d:0;
 const along=p.vx*ux+p.vy*uy,gap=Math.max(0,d-(along<-.5?0:RECEIVING_REACH));
 const speed=p.pace*.94,v=clamp(along,-speed,speed),a=p.acceleration;
 const accelerate=(speed-v)/a,covered=v*accelerate+.5*a*accelerate*accelerate;
 return gap<=covered?(-v+Math.sqrt(v*v+2*a*gap))/a:accelerate+(gap-covered)/speed;
}

/** Decelerating flight, including opponents able to reach the receiver's end of the lane.
 * `read`: the passer's own read of each opponent's reach (readerMargin, step-across round); without it, the exact picture. */
export function groundPassRisk(from:Vec,to:Vec,opponents:PracticePlayer[],speed:number,receiver?:PracticePlayer,read?:PasserRead):number{
 // (honest-reads round) the ball leaves his foot `lead` s from now: the lane
 // starts where his momentum takes him, and everyone else has moved on
 // theirs, before the flight is read.
 const lead=read?.lead??0;
 if(lead>0){
  // (pre-push fixes, 2026-10-12) ...unless a man in his path meets him first: then
  // he is forecast only to where they meet, and that man on to the ball at his feet (carrierMeets).
  const meet=carrierMeets(read!.p,opponents,lead);
  const ahead=<T extends Vec&{vx:number;vy:number;id:string}>(q:T):T=>q.id===meet.met?{...q,...meet.at!}:{...q,x:q.x+q.vx*lead,y:q.y+q.vy*lead};
  from={x:from.x+read!.p.vx*meet.t,y:from.y+read!.p.vy*meet.t};opponents=opponents.map(ahead);if(receiver)receiver=ahead(receiver);
 }
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(length<1||!Number.isFinite(passFlightTime(length,speed)))return 1;
 // The receiver may meet the ball before its aimed endpoint. An opponent arriving
 // farther downstream after that contact is not a reason to reject this delivery.
 let end=1;
 if(receiver){
  const reacting={...receiver,x:receiver.x+receiver.vx*.12,y:receiver.y+receiver.vy*.12};
  for(let fraction=.1;fraction<=1;fraction+=.05){
   const point={x:from.x+dx*fraction,y:from.y+dy*fraction},flight=passFlightTime(length*fraction,speed);
   if(.12+arrivalTime(reacting,point)>flight)continue;
   // Reach alone is insufficient: a sprinting receiver must also be able to brake
   // or turn into the ball's path by the time it crosses this point.
   const preview={...reacting};
   for(let t=.12;t<flight;t+=.05)steer(preview,point,Math.min(.05,flight-t),preview.pace);
   if(distance(preview,point)<.75){end=fraction;break;}
  }
 }
 let risk=0;
 for(const p of opponents){
  const m=read?Math.max(-1,readerMargin(read,p,to)):0;
  const projection=clamp(((p.x-from.x)*dx+(p.y-from.y)*dy)/(length*length),.06,end);
  for(const fraction of [projection,Math.min(end,projection+.15)]){
   const flight=passFlightTime(length*fraction,speed),available=Math.max(0,flight-.22);
   const point={x:from.x+dx*fraction,y:from.y+dy*fraction},gap=distance(p,point);
   const towards=clamp(((point.x-p.x)*p.vx+(point.y-p.y)*p.vy)/Math.max(.001,gap),-p.pace,p.pace);
   const accelerating=Math.min(available,(p.pace-towards)/p.acceleration);
   const reach=Math.max(0,towards*accelerating+.5*p.acceleration*accelerating*accelerating+p.pace*(available-accelerating));
   const hands=p.role==='GK'&&depth(p,point.x)<BOX_DEPTH&&Math.abs(point.y)<BOX_HALF;
   // A body already occupying the flight path need not accelerate to intercept it.
   const bodyGap=Math.hypot(point.x-p.x-p.vx*flight,point.y-p.y-p.vy*flight);
   risk=Math.max(risk,clamp((reach+(hands?1.25:1.1)+m-gap)/2,0,1),clamp(1-bodyGap/Math.max(.3,(hands?1.25:.72)+m),0,1));
  }
 }
 return risk;
}

/** A driven ball is harder to cushion; matching its movement and control skill both help. */
export function groundControlChance(p:PracticePlayer,ball:{vx:number;vy:number}):number{
 const relative=Math.hypot(ball.vx-p.vx,ball.vy-p.vy);
 const spill=receptionResidual(p,relative)*Math.max(0,relative-1.5);
 // Planning estimate from the same cushioning model, without foreknowledge of
 // the eventual stance. Actual reception is resolved by contact, not this roll.
 return clamp(.99-spill*.07,.4,.99);
}

/** A prepared kick must follow the receiver's current commitment, not a cancelled run. */
export function activePassRun(support:SupportPlan|null,owner:PracticePlayer,target:PracticePlayer,time:number):PassRun|undefined{
 const move=support?.owner===owner.id&&support.side===owner.side?support.moves.find(m=>m.player===target.id&&m.kind==='run'&&m.until>time):undefined;
 return move?{aim:move.aim,speed:move.speed}:undefined;
}

/** The same moving target and kick speed are used when weighing and releasing a ground pass. */
/** The comfortable arrival speed of a ground pass of this length (practice-flight), and its firm end. */
export const firmArrival=(length:number)=>Math.min(19,preferredArrival(length)+4);
export function groundPassCandidates(p:PracticePlayer,q:PracticePlayer,through:boolean,run?:PassRun,from:Vec=p,opponents:PracticePlayer[]=[],space?:ReceivingSpace,read?:PasserRead):GroundPass[]{
 const initialDistance=distance(from,q),preferred=preferredArrival(initialDistance);
 // Comfortable planned power is separate from precision. An overhit kick may exceed it.
 const candidates:({plan:GroundPass;cost:number})[]=[];
 for(const [weight,arrival] of [['soft',Math.max(4,preferred-3)],['measured',preferred],['firm',firmArrival(initialDistance)]] as const){
  let powerLimit=strikePowerLimit(p,from,q);
  let speed=Math.min(powerLimit,Math.sqrt(arrival*arrival+2*PASS_DRAG*initialDistance));
  let flight=passFlightTime(initialDistance,speed),aim:Vec=q,receiver={...q};
  for(let i=0;i<4;i++){
  if(through&&run){
   // A teammate's current movement intention, with real acceleration and braking;
   // no prediction of a defender's decision or of the receiver's next action.
   const preview={...q},horizon=Number.isFinite(flight)?flight:0;
   for(let t=0;t<horizon;t+=.1)steer(preview,run.aim,Math.min(.1,horizon-t),Math.min(q.pace,run.speed));
   aim=bound(preview);receiver=preview;
  }else{
   if(!through)aim=bound(receiverLead(q,Number.isFinite(flight)?flight:0));
   else{
    const motion=Math.hypot(q.vx,q.vy),ux=motion>1?q.vx/motion:p.side===0?1:-1,uy=motion>1?q.vy/motion:0;
    aim=bound({x:q.x+q.vx*flight*.85+ux*2,y:q.y+q.vy*flight*.85+uy*2});
   }
  }
   powerLimit=strikePowerLimit(p,from,aim);
   const length=distance(from,aim);speed=Math.min(powerLimit,Math.sqrt(arrival*arrival+2*PASS_DRAG*length));flight=passFlightTime(length,speed);
  }
  const length=distance(from,aim),arrivalSpeed=Math.sqrt(Math.max(0,speed*speed-2*PASS_DRAG*length));
  const risk=groundPassRisk(from,aim,opponents,speed,q,read),reachMargin=flight-receptionTime(q,aim)-RECEIVER_REACTION;
  const controlRisk=1-groundControlChance(receiver,{vx:(aim.x-from.x)/Math.max(.01,length)*arrivalSpeed,vy:(aim.y-from.y)/Math.max(.01,length)*arrivalSpeed});
  const cost=risk*(.8-p.traits.risk*.2)+controlRisk*.85+Math.max(0,-reachMargin)*.18+Math.abs(arrival-preferred)*.012+flight*.012;
  candidates.push({plan:{aim,speed,flight,arrivalSpeed,risk,controlRisk,reachMargin,weight},cost});
 }
 if(through&&run)for(const meeting of runMeetings(q,run,space)){
  const {aim,time:flight,body:receiver}=meeting,length=distance(from,aim);
  const speed=length/flight+PASS_DRAG*(flight-STEP)/2,arrivalSpeed=speed-PASS_DRAG*flight;
  // A ball played into a runner's stride is weighted like any other pass of
  // its length: never arriving harder than that length's firm pass. Meeting
  // him sooner by driving it at him arrived at up to ~22 m/s over 12 m and
  // bounced off his foot (silly-moments, 2026-10-01).
  if(length<2||arrivalSpeed<2.5||arrivalSpeed>firmArrival(length)+1e-9||speed>strikePowerLimit(p,from,aim))continue;
  const risk=groundPassRisk(from,aim,opponents,speed,q,read),reachMargin=flight-receptionTime(q,aim)-RECEIVER_REACTION;
  const controlRisk=1-groundControlChance(receiver,{vx:(aim.x-from.x)/length*arrivalSpeed,vy:(aim.y-from.y)/length*arrivalSpeed});
  const weight=arrivalSpeed<preferred-1.5?'soft':arrivalSpeed>preferred+1.5?'firm':'measured';
  candidates.push({plan:{aim,speed,flight,arrivalSpeed,risk,controlRisk,reachMargin,weight,meetingTime:flight},cost:risk*(.8-p.traits.risk*.2)+controlRisk*.85+Math.max(0,-reachMargin)*.18+Math.abs(arrivalSpeed-preferred)*.012+flight*.012});
 }
 const ranked=candidates.sort((a,b)=>a.cost-b.cost).map(c=>c.plan);
 const fitting=space?ranked.filter(c=>distance(c.aim,space)<=space.radius):ranked;
 return fitting.length?fitting:ranked;
}
export function groundPass(p:PracticePlayer,q:PracticePlayer,through:boolean,run?:PassRun,from:Vec=p,opponents:PracticePlayer[]=[],space?:ReceivingSpace,meetingTime?:number,weight?:GroundPass['weight']):GroundPass{
 const candidates=groundPassCandidates(p,q,through,run,from,opponents,space);
 return candidates.find(c=>meetingTime!==undefined?c.meetingTime===meetingTime:weight!==undefined&&c.meetingTime===undefined&&c.weight===weight)??candidates[0];
}

export function strikeGroundPass(p:PracticePlayer,ball:Vec,q:PracticePlayer,through:boolean,run:PassRun|undefined,pressure:number,random:()=>number,opponents:PracticePlayer[]=[],space?:ReceivingSpace,meetingTime?:number,weight?:GroundPass['weight']):{aim:Vec;vx:number;vy:number;vz:number;plan:GroundPass}{
 const plan=groundPass(p,q,through,run,ball,opponents,space,meetingTime,weight),precision=clamp(p.skills.passing/10,0,1);
 // Ordinary technique gives a competent short pass even at middling ratings.
 // Range, pressure and fatigue still expose differences in execution.
 const range=clamp(distance(ball,plan.aim)/24,0,1),error=(.1+(1-precision)*.9)*(.65+.35*range)+pressure*.7;
 const aim=bound({x:plan.aim.x+(random()-.5)*error,y:plan.aim.y+(random()-.5)*error});
 const weightError=.012+(1-precision)*.075+pressure*.09+(1-p.energy/100)*.06;
 const speed=plan.speed*(1+(random()*2-1)*weightError);
 const length=distance(ball,aim)||1;
 return {aim,vx:(aim.x-ball.x)/length*speed,vy:(aim.y-ball.y)/length*speed,vz:0,plan};
}

/** A delivery's "advance" (R3 P2). Up to the last 20 m it is depth gained
 * towards the goal line; in the final third it becomes progress towards the
 * GOAL: nearer its centre, and a wider view of it (the angle, at half the
 * weight of the metres). Six metres towards the byline, away from goal and
 * onto a narrower angle, was 'advancing' (the 14:24 pass). */
export function passAdvance(p:PracticePlayer,from:Vec,aim:Vec):number{
 const line=clamp((depth(p,aim.x)-depth(p,from.x))/X(25),-1,1),w=clamp((depth(p,from.x)-X(62))/X(10),0,1);
 if(!w)return line;
 const gd=(v:Vec)=>Math.hypot((p.side===0?L:0)-v.x,v.y),angle=(v:Vec)=>goalAngle({...p,x:v.x,y:v.y});
 const goal=clamp((gd(from)-gd(aim))/X(25)+(angle(aim)-angle(from))/2,-1,1);
 return line+(goal-line)*w;
}
/** A carrier's own shot counts as "on" from this value (quality x the lane
 * and finishing factors of readDelivery's value): below it a pass that
 * worsens the team's chance costs nothing, above it it does (R3 P2). */
export const OWN_SHOT_ON=.2;
/** Value the next shooting opportunity, not just metres gained toward the end line. */
export function readDelivery(p:PracticePlayer,q:PracticePlayer,aim:Vec,players:PracticePlayer[],risk:number,laneRisk:Risk,flight=0,context?:ConnectionContext):DeliveryRead{
 const pd=depth(p,p.x),qd=depth(p,aim.x),centralGain=Math.abs(p.y)-Math.abs(aim.y);
 const kind:DeliveryRead['kind']=pd>X(88)&&qd>X(78)&&Math.abs(p.y)>Y(14)&&Math.abs(aim.y)<Y(14)&&centralGain>Y(7)&&pd-qd>2&&pd-qd<WORLD.geometry.passing.cutbackMax.v?'cutback'
  :pd>X(80)&&qd>X(84)&&Math.abs(p.y)>Y(12)&&Math.abs(aim.y)<Y(12)&&centralGain>Y(7)&&Math.abs(qd-pd)<WORLD.geometry.passing.squareMax.v?'square':qd>pd+3?'forward':'link';
 const connection=readNextConnection(p,q,aim,players,flight,laneRisk,context);
 const next={connectionGain:connection.gain,connectionTarget:connection.target,continuation:connection.continuation};
 const opponents=players.filter(d=>d.side!==p.side&&d.role!=='GK');
 const value=(player:PracticePlayer,context:PracticePlayer[])=>{
  const shot=assessShot(player,context),blocked=laneRisk(player,shot.aim,opponents,22+player.skills.finishing*.3);
  return shot.quality*(1-blocked)*(.65+clamp(player.skills.finishing/10,0,1)*.35);
 };
 // R3 P2: when the carrier himself has a shot on, a pass that lowers the
 // team's shooting chance is charged for it (shotGain below 0), wherever the
 // receiver is; otherwise a pass only ever earns what it adds.
 const own=pd>=X(68)?value(p,players):0,on=own>=OWN_SHOT_ON;
 if(qd<X(68))return {kind,risk,shotGain:on?-own:0,...next};
 const keeper=players.find(d=>d.side!==p.side&&d.role==='GK');
 let receivingContext=players;
 if(keeper&&flight>0){
  const preview={...keeper},duration=Math.min(3.4,flight),ready=keeperReadyPosition(keeper,aim,true);
  // Allow a plausible recovery toward the new angle. No future keeper choice
  // or successful catch is assumed; the actual match still moves him normally.
  for(let t=0;t<duration;t+=.1)steerMotion(preview,ready,Math.min(.1,duration-t),keeper.pace);
  receivingContext=players.map(d=>d.id===keeper.id?preview:d);
 }
 const gain=value({...q,...aim},receivingContext)-(pd>=X(68)?own:value(p,players));
 return {kind,risk,...next,shotGain:on?gain:Math.max(0,gain)};
}

/** Step-across round (2026-10-04): a ball to a team-mate near our own goal
 * who will have no room is a loss waiting there (half the own-box giveaways
 * were a team-mate caught within 2 s of receiving). The passer charges what
 * a loss at the reception would cost (turnoverPrice: where, and who is behind
 * it) times RECEIVER_CAUGHT of the room he reads the receiver lacking, in
 * full within OWN_ZONE m of our goal and fading out by OWN_ZONE_FAR (further
 * up the flat room terms already price it). The room is his read: off by up
 * to ROOM_SPREAD for a player who cannot read the game. */
export const RECEIVER_CAUGHT=.5,OWN_ZONE=WORLD.geometry.passing.OWN_ZONE.v,OWN_ZONE_FAR=WORLD.geometry.passing.OWN_ZONE_FAR.v,ROOM_SPREAD=.5;
export function receiverCaught(p:PracticePlayer,q:PracticePlayer,aim:Vec,space:number,players:readonly PracticePlayer[]):number{
 const zone=clamp((OWN_ZONE_FAR-depth(p,aim.x))/(OWN_ZONE_FAR-OWN_ZONE),0,1);if(!zone)return 0;
 const room=clamp(perceive(p,'arrival',space,ROOM_SPREAD,aim,{salt:'room'+q.id}),0,1);
 return (1-room)*RECEIVER_CAUGHT*turnoverPrice(p,players,aim)*zone;
}
/** Compare weight and rendezvous by the resulting football opportunity. */
export function groundOptions(p:PracticePlayer,q:PracticePlayer,players:PracticePlayer[],through:boolean,run:PassRun|undefined,from:Vec,laneRisk:Risk,lastFrom='',held=0,receivingSpace?:ReceivingSpace,context?:ConnectionContext):Option[]{
 const defenders=players.filter(d=>d.side!==p.side),outfield=defenders.filter(d=>d.role!=='GK');
 const dist=distance,skill=(n:number)=>clamp(n/10,0,1),forward=depth(p,p.x),d=dist(p,q);
 // Felt, not exact (R2): the carrier's nerve and reading (feltPressure).
 const pressure=feltPressure(p,clamp((6-Math.min(...outfield.map(d=>dist(d,p))))/6,0,1));
 const own=receiverProspects({...p,...from},from,players,0,p).value;
 // What losing it here costs: where, and the rest defence behind the ball.
 const lossCost=turnoverPrice(p,players,from);
 // (step-across round) the lane as HE reads it: his read of each opponent's reach (readerMargin)
 // (honest-reads round) read over his own estimate of when the ball is away (readKickHorizon)
 const read:PasserRead={p,pressure,danger:possessionSafety(p,players).danger,lead:readKickHorizon(p,q,through?'through':'pass')};
 return groundPassCandidates(p,q,through,run,from,defenders,receivingSpace,read).map((pass):Option=>{
   const {aim,risk}=pass;
   const space=receivingRoom(aim,defenders,pass.flight),caught=receiverCaught(p,q,aim,space,players);
   const advance=passAdvance(p,p,aim),threat=clamp((depth(p,aim.x)-X(65))/X(32),0,1)*(1-Math.abs(aim.y)/Y(40));
   const delivery=readDelivery(p,q,aim,players,risk,laneRisk,pass.flight,context);
   const next=passProspects(p,from,q,aim,players,pass.flight,own)*(1-risk);
   const score=-caught+next-teammatePassObstruction(p,q,aim,players,pass.flight)*.75+.25+advance*(.24+p.traits.risk*.15)*(1-risk)+space*.14+threat*.21-(risk+(1-skill(p.skills.passing))*d/75)*deliveryLossWeight(p,lossCost)-(1-space)*.12-d*.002-(q.id===lastFrom&&held<1.2?.035:0)+(through?.06*p.traits.risk:0)+(pressure*.2*space)
    +delivery.shotGain*(.55+skill(p.skills.reading)*.2)*(delivery.shotGain>0?(1-risk)*space:1)
    +delivery.connectionGain*(.22+skill(p.skills.reading)*.16+p.traits.comesShort*.08)*(1-risk)*(1-pass.controlRisk)*clamp(1+pass.reachMargin,0,1)-pass.controlRisk*.45-Math.max(0,-pass.reachMargin)*.18;
   const reason=delivery.shotGain>.1&&delivery.kind==='cutback'?'Întoarce mingea din lateral spre un coleg cu un unghi de șut mai bun.'
    :delivery.shotGain>.1&&delivery.kind==='square'?'Caută colegul din fața porții cu o pasă din lateral.'
    :delivery.connectionGain>.15?'Caută un coleg care poate deschide următoarea pasă, dintr-un unghi diferit.':through?'Citește direcția cursei și trimite mingea în întâmpinarea colegului.':advance>.4?'Găsește un coleg mai avansat și încearcă să treacă de o linie.':pressure>.4?'Eliberează mingea înainte să se închidă presiunea.':'Păstrează legătura cu un coleg disponibil.';
   return {kind:through?'through':'pass',target:q.id,aim,score,reason,delivery,run:through?run:undefined,pass,next,relief:pressure*.2*space};
 }).sort((a,b)=>b.score-a.score);
}
