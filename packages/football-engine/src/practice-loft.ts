import type {ConnectionContext} from './practice-connections.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import {strikePowerLimit} from './practice-striking.js';
import {steerMotion,STEP} from './movement.js';
import type {Vec,MovingBall} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import type {PassRun} from './practice-passing.js';
import {groundControlChance,passAdvance,passFlightTime,passProspects,readDelivery,receivingRoom,receiverCaught} from './practice-passing.js';
import {PASS_DRAG,flightSamples,flightMeeting,reachableFlightMeeting,flightContact} from './practice-flight.js';

export type {ReceivingSpace} from './practice-meetings.js';
import {runMeetings} from './practice-meetings.js';
import {turnoverPrice,deliveryLossWeight} from './practice-rest-defence.js';
import {feltPressure} from './practice-possession.js';
import type {ReceivingSpace} from './practice-meetings.js';
import {WORLD} from './world.js';
export interface LoftPass {kind:'chip'|'loft';aim:Vec;speed:number;vz:number;flight:number;arrivalSpeed:number;apex:number;risk:number;controlRisk:number;reachMargin:number;meetingTime?:number}
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(p:Vec):Vec=>({x:clamp(p.x,.8,(L-.8)),y:clamp(p.y,-(W/2-1),(W/2-1))});
/** A clear flight is not a usable pass if the receiver cannot meet it.
 * Keep interception and reach evidence separate, but value their combined risk
 * when choosing a delivery. This changes intention, never the executed kick. */
const deliveryRisk=(pass:LoftPass)=>1-(1-pass.risk)*(1-clamp(-pass.reachMargin,0,1));
/** Height and descending speed make an aerial first touch harder than a rolling one. */
export function loftControlChance(p:PracticePlayer,ball:Pick<MovingBall,'vx'|'vy'|'vz'|'z'>):number{
 const technique=clamp(p.skills.control/10,0,1);
 return clamp(groundControlChance(p,ball)-Math.abs(ball.vz)*(.019-.008*technique)-ball.z*(.065-.035*technique),.45,.98);
}

/** Bodies already in the first metres can block before anyone reacts to the kick. */
function launchRisk(ball:MovingBall,opponents:PracticePlayer[]):number{
 const nearby=opponents.filter(p=>distance(p,ball)<8);if(!nearby.length)return 0;
 const samples=flightSamples(ball,.22,STEP);
 for(let i=1;i<samples.length;i++)for(const p of nearby){
  const a=samples[i-1],b=samples[i],old={x:p.x+p.vx*a.time,y:p.y+p.vy*a.time},next={x:p.x+p.vx*b.time,y:p.y+p.vy*b.time};
  if(flightContact(a,b,old,next,.72,1.1)!==null)return 1;
 }
 return 0;
}

/** Compare flight shapes and meeting points along the same visible run. */
export function loftCandidates(p:PracticePlayer,q:PracticePlayer,run:PassRun|undefined,from:Vec=p,opponents:PracticePlayer[]=[],space?:ReceivingSpace):LoftPass[]{
 const initial=distance(from,q),power=(WORLD.ball.loft.powerBase.v+clamp(p.skills.strength,0,10)*WORLD.ball.loft.powerPer.v)*(WORLD.ball.loft.tiredFloor.v+WORLD.ball.loft.tiredShare.v*p.energy/100);
 const assess=(kind:'chip'|'loft',flight:number,aim:Vec,arrivalHeight=WORLD.ball.loft.arrivalHeight.v):LoftPass=>{
  const length=distance(from,aim),speed=length/flight+PASS_DRAG*(flight-STEP)/2;
  // Aim to arrive low on the descending side; include the runtime's Euler-step gravity.
  const vz=arrivalHeight/flight+WORLD.ball.flight.gravity.v*(flight-STEP)/2;
  const ball:MovingBall={...from,z:0,vx:(aim.x-from.x)/Math.max(.001,length)*speed,vy:(aim.y-from.y)/Math.max(.001,length)*speed,vz,owner:null,mode:'pass'};
  const samples=flightSamples(ball,flight+.65),receiver=flightMeeting(q,ball,.12,samples);
  const end=receiver.reachable?receiver.time:flight+.3;
  // Keepers are already adjusting their position as a kick develops. Do not
  // assume they coast motionless through the outfield reaction delay.
  const threatSamples=samples.filter(s=>s.time<=end+.15);
  const threats=opponents.map(d=>reachableFlightMeeting(d,ball,d.role==='GK'?0:.22,threatSamples));
  const risk=Math.max(launchRisk(ball,opponents),...threats.filter(d=>d!==null).map(d=>clamp(.55+(end-d.time)/.6,0,1)));
  const point=samples.find(s=>s.time>=receiver.time)??samples.at(-1)!;
  const preview={...q};for(let t=0;t<receiver.time;t+=.1)steerMotion(preview,receiver.aim,Math.min(.1,receiver.time-t),q.pace);
  const controlRisk=1-loftControlChance(preview,point);
  const reachMargin=receiver.reachable?Math.max(0,flight-receiver.time): -Math.max(.3,receiver.gap/Math.max(1,q.pace));
  return {kind,aim,speed,vz,flight,arrivalSpeed:Math.max(0,speed-PASS_DRAG*flight),apex:vz*vz/(2*WORLD.ball.flight.gravity.v),risk:speed>power||Math.hypot(speed,vz)>strikePowerLimit(p,from,aim)?1:risk,controlRisk,reachMargin};
 };
 const ordinary=(['chip','loft'] as const).map(kind=>{
  const minimum=kind==='chip'?WORLD.ball.loft.chipMinFlight.v:WORLD.ball.loft.loftMinFlight.v,preferred=Math.min(power,kind==='chip'?WORLD.ball.loft.chipSpeedBase.v+initial*WORLD.ball.loft.chipSpeedPer.v:WORLD.ball.loft.loftSpeedBase.v+initial*WORLD.ball.loft.loftSpeedPer.v);
  let flight=Math.max(minimum,passFlightTime(initial,preferred)),aim:Vec=q;
  for(let i=0;i<4;i++){
   if(run){const preview={...q};for(let t=0;t<flight;t+=.1)steerMotion(preview,run.aim,Math.min(.1,flight-t),Math.min(q.pace,run.speed));aim=inside(preview);}
   else aim=inside({x:q.x+q.vx*flight*.45,y:q.y+q.vy*flight*.45});
   flight=clamp(Math.max(minimum,passFlightTime(distance(from,aim),preferred)),minimum,WORLD.ball.loft.maxFlight.v);
  }
  return assess(kind,flight,aim);
 });
 if(!run)return ordinary;
 // Ordinary football and coached football inspect the same meeting points.
 const directed:LoftPass[]=[];
 for(const meeting of runMeetings(q,run,space)){
  if(meeting.time<.95)continue;
  directed.push({...assess('loft',meeting.time,meeting.aim,WORLD.ball.loft.directedArrivalHeight.v),meetingTime:meeting.time});
 }
 return [...ordinary,...directed];
}
export function loftPass(p:PracticePlayer,q:PracticePlayer,run:PassRun|undefined,from:Vec=p,opponents:PracticePlayer[]=[],space?:ReceivingSpace,meetingTime?:number,kind?:LoftPass['kind']):LoftPass{
 const cost=(c:LoftPass)=>deliveryRisk(c)*(.8-p.traits.risk*.2)+c.controlRisk*.85+Math.max(0,-c.reachMargin)*.3+c.flight*.035;
 const all=loftCandidates(p,q,run,from,opponents,space),fitting=all.filter(c=>!space||distance(c.aim,space)<=space.radius),candidates=fitting.length?fitting:all;
 return candidates.find(c=>meetingTime!==undefined?c.meetingTime===meetingTime:kind!==undefined&&c.meetingTime===undefined&&c.kind===kind)??candidates.sort((a,b)=>cost(a)-cost(b))[0];
}
export function strikeLoftPass(p:PracticePlayer,ball:Vec,q:PracticePlayer,run:PassRun|undefined,pressure:number,random:()=>number,opponents:PracticePlayer[]=[],space?:ReceivingSpace,meetingTime?:number,kind?:LoftPass['kind']){
 const plan=loftPass(p,q,run,ball,opponents,space,meetingTime,kind),precision=clamp(p.skills.passing/10,0,1);
 const range=clamp(distance(ball,plan.aim)/WORLD.error.loft.range.v,0,1),error=(WORLD.error.loft.base.v+(1-precision)*WORLD.error.loft.precision.v)*(WORLD.error.loft.near.v+WORLD.error.loft.far.v*range)+pressure*WORLD.error.loft.pressure.v,aim=inside({x:plan.aim.x+(random()-.5)*error,y:plan.aim.y+(random()-.5)*error});
 const spread=WORLD.error.loft.spreadBase.v+(1-precision)*WORLD.error.loft.spreadPrecision.v+pressure*WORLD.error.loft.spreadPressure.v+(1-p.energy/100)*WORLD.error.loft.spreadTired.v;
 const speed=plan.speed*(1+(random()*2-1)*spread),vz=plan.vz*(1+(random()*2-1)*spread*WORLD.error.loft.spreadVertical.v),length=distance(ball,aim)||1;
 return {plan,aim,vx:(aim.x-ball.x)/length*speed,vy:(aim.y-ball.y)/length*speed,vz};
}

/** One valuation for ordinary and deliberately taught aerial delivery. */
export function loftOption(p:PracticePlayer,q:PracticePlayer,players:PracticePlayer[],run:PassRun|undefined,from:Vec,laneRisk:(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number,receivingSpace?:ReceivingSpace,candidate?:LoftPass,context?:ConnectionContext):Option{
 const defenders=players.filter(q=>q.side!==p.side),outfield=defenders.filter(q=>q.role!=='GK');
 const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y),dist=distance,depth=(side:number,x:number)=>side===0?x:L-x,skill=(n:number)=>clamp(n/10,0,1);
 const near=Math.min(...outfield.map(q=>dist(q,p))),pressure=feltPressure(p,clamp((6-near)/6,0,1)),forward=depth(p.side,p.x),d=dist(p,q);
  const loft=candidate??loftPass(p,q,run,from,defenders,receivingSpace),{aim}=loft,risk=deliveryRisk(loft);
  const space=receivingRoom(aim,defenders,loft.flight),advance=passAdvance(p,p,aim),caught=receiverCaught(p,q,aim,space,players);
  const threat=clamp((depth(p.side,aim.x)-X(65))/X(32),0,1)*(1-Math.abs(aim.y)/Y(40)),lossCost=turnoverPrice(p,players,from);
  const delivery=readDelivery(p,q,aim,players,risk,laneRisk,loft.flight,context);
  const next=passProspects(p,from,q,aim,players,loft.flight)*(1-risk);
  const score=-caught+next+.25+advance*(.24+p.traits.risk*.15)*(1-risk)+space*.14+threat*.21-(risk+(1-skill(p.skills.passing))*d/WORLD.error.choice.valueRange.v)*deliveryLossWeight(p,lossCost)-(1-space)*.12-d*.002+pressure*.2*space
   +delivery.shotGain*(.55+skill(p.skills.reading)*.2)*(delivery.shotGain>0?(1-risk)*space:1)
   +delivery.connectionGain*(.22+skill(p.skills.reading)*.16+p.traits.comesShort*.08)*(1-risk)*(1-loft.controlRisk)*clamp(1+loft.reachMargin,0,1)-loft.controlRisk*.45-Math.max(0,-loft.reachMargin)*.3-loft.flight*.025-.04;
  return {kind:'loft',target:q.id,aim,score,run,loft,delivery,next,relief:pressure*.2*space,reason:run?'Ridică mingea peste linie, spre locul în care poate ajunge colegul în cursă.':'Compară zborul cu presiunea și caută un coleg dincolo de ea.'};
}

export function loftOptions(p:PracticePlayer,q:PracticePlayer,players:PracticePlayer[],run:PassRun|undefined,from:Vec,laneRisk:(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number,space?:ReceivingSpace,context?:ConnectionContext):Option[]{
 const all=loftCandidates(p,q,run,from,players.filter(d=>d.side!==p.side),space),fitting=all.filter(c=>!space||distance(c.aim,space)<=space.radius);
 return (fitting.length?fitting:all).map(c=>loftOption(p,q,players,run,from,laneRisk,space,c,context)).sort((a,b)=>b.score-a.score);
}
