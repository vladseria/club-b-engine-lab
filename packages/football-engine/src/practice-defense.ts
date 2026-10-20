import * as S from './style.js';
import {playableAerialMeetings} from './practice-aerial.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp,Tactics} from './model.js';
import type {PracticePlayer,Duty} from './practice.js';
import {steerMotion} from './movement.js';
import type {Vec} from './movement.js';
import {flightSamples,flightMeeting} from './practice-flight.js';
import {markingDeparture} from './practice-shape.js';
import type {TeamShape,Sight} from './practice-shape.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const goal=(p:PracticePlayer):Vec=>({x:p.side===0?0:L,y:0});
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
const inside=(p:Vec)=>({x:clamp(p.x,.8,(L-.8)),y:clamp(p.y,-(W/2-1),(W/2-1))});
export interface DefenseAssignment {owner:string;presser:string;coverer:string}
export interface DefensiveUnitContext {shape:TeamShape;marks:ReadonlyMap<string,string>;ball:Vec;pressers?:readonly string[];fixedMarks?:ReadonlyMap<string,string>;fixedMoves?:ReadonlyMap<string,Vec>}
export interface DefensiveMovement {kind:'press'|'jockey';aim:Vec;velocity:Vec;speed:number;reason:string}

/** A defender closing the ball watches the ball and the carrier. A runner
 * who leaves from behind his shoulder (outside RUNNER_VIEW of the way he is
 * facing) is picked up a moment late: the defender carries on with his job
 * from before for runnerPickupDelay seconds, shortened by reading the game,
 * at most RUNNER_LAPSE_MAX. Only a switch from closing the ball (a press) to
 * marking that runner is delayed; going for the ball never is. A runner in
 * view, or one who is barely moving, is picked up at once, as before. */
export const RUNNER_LAPSE_MAX=.3,RUNNER_VIEW=100*Math.PI/180,RUNNER_SPEED=2.5;
export function runnerPickupDelay(reading:number):number{
 return RUNNER_LAPSE_MAX*(1-.75*clamp(reading/10,0,1));
}
/** The runner is behind the defender's shoulder and moving. */
export function runnerBehindShoulder(defender:Pick<PracticePlayer,'x'|'y'|'angle'>,runner:Pick<PracticePlayer,'x'|'y'|'vx'|'vy'>):boolean{
 if(Math.hypot(runner.vx,runner.vy)<RUNNER_SPEED)return false;
 const bearing=Math.atan2(runner.y-defender.y,runner.x-defender.x);
 return Math.abs(Math.atan2(Math.sin(bearing-defender.angle),Math.cos(bearing-defender.angle)))>RUNNER_VIEW;
}
import {arrivalTime} from './practice-arrival.js';
export {arrivalTime};

/** Who can close a receiver before his next ball leaves (the "defender first
 * at the reception" read). A defender on the receiver's back, beyond the
 * reception from where the ball comes (within BACK_REACH of it), is behind
 * his body: he contests a turn, not a quick ball played away from him. So
 * when the receiver plays it on within QUICK_RELEASE and the next ball goes
 * away from that defender (a lay-off, a wall pass), he is not counted; for a
 * slower release, or one played past him, he is. Visible positions only. */
export const BACK_REACH=5,QUICK_RELEASE=.45;
/** Nobody reads where such a quick ball goes before it is played: the others
 * start for it from the reception, this long late (attacking-space). */
export const QUICK_REACT=.25;
export function releaseClosing(defenders:readonly PracticePlayer[],aim:Vec,from:Vec,next:Vec,prepare:number):number{
 const dx=aim.x-from.x,dy=aim.y-from.y,d2=dx*dx+dy*dy||1;
 let closing=Infinity;
 for(const d of defenders){
  const behind=((d.x-from.x)*dx+(d.y-from.y)*dy)/d2>1&&distance(d,aim)<BACK_REACH;
  const away=(next.x-aim.x)*(d.x-aim.x)+(next.y-aim.y)*(d.y-aim.y)<0;
  if(behind&&away&&prepare<=QUICK_RELEASE)continue;
  closing=Math.min(closing,arrivalTime(d,aim));
 }
 return closing;
}

/** A forecast from visible velocity, never the attacker's selected future destination. */
export function meetingTime(p:PracticePlayer,owner:PracticePlayer):number{
 const towards=unit(goal(p).x-owner.x,-owner.y);
 for(let t=.2;t<=3;t+=.2){
  const point=inside({x:owner.x+owner.vx*t+towards.x*.6,y:owner.y+owner.vy*t+towards.y*.6});
  if(arrivalTime(p,point)<=t)return t;
 }
 return 3+arrivalTime(p,inside({x:owner.x+owner.vx*3,y:owner.y+owner.vy*3}));
}

export function shootingThreat(owner:PracticePlayer):boolean{
 const x=owner.side===0?L-owner.x:owner.x;
 return x<X(30)&&Math.abs(owner.y)<Y(22);
}

/** One player closes the route; another remains able to help if he is beaten. */
export function assignDefense(players:PracticePlayer[],owner:PracticePlayer,tactics:Tactics,previous:DefenseAssignment|null=null,unavailable:ReadonlySet<string>=new Set(),unit?:DefensiveUnitContext):DefenseAssignment{
 const defenders=players.filter(p=>p.side!==owner.side&&p.role!=='GK'&&(!unavailable.has(p.id)||unit?.pressers?.includes(p.id)));
 const goalDistance=owner.side===0?L-owner.x:owner.x;
 const rating=(p:PracticePlayer)=>meetingTime(p,owner)-(p.traits.engagement-.5)*.2
  +(p.role==='CB'&&goalDistance>X(40)?.65:0);
  // One radius for every press style: half the pitch. An aggressive press
  // used 28 m, but on 48 x 30 its nearest defender was never even 24 m from
  // the carrier (evidence 2026-10-01-b0-correctness, press-radius.txt), and
  // a press style is about engagement, not about how far away a presser may
  // start. Aggressive keeps its real levers: engagement, the challenge
  // threshold, the outlet screen and marking everywhere.
  const candidates=defenders.filter(p=>unit?.pressers?.length?unit.pressers.includes(p.id):distance(p,owner)<L/2).map(p=>({p,score:rating(p)})).sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
 let selected=candidates[0];
 const incumbent=previous?.owner===owner.id?candidates.find(c=>c.p.id===previous.presser):undefined;
 // Keep responsibility stable only while the defender can still meet the attack.
 if(incumbent&&selected&&incumbent.score<=selected.score+.2)selected=incumbent;
 // A selective block invites harmless circulation outside its territory. A
 // nearby receiver, an inward progression, or an immediate goal threat still
 // calls for pressure; holding shape must never mean watching a clear shot.
 const ownDepth=owner.side===0?L-owner.x:owner.x;
 const waitForEntry=!unit?.pressers?.length&&tactics.press==='selective'&&ownDepth>L*.55&&selected&&distance(selected.p,owner)>5.5;
 const presser=waitForEntry?undefined:selected?.p;
 if(presser&&unit){
  // Compare complete pressure/cover/marking allocations. Choosing a nearby
  // presser first can otherwise consume the only defender able to protect an
  // easy finishing pass. At most four outfield players participate in 5v5.
  
  let best:{presser:PracticePlayer;coverer?:PracticePlayer;cost:number}|undefined;
  for(const candidate of candidates){
   const first=candidate.p;
   const covers=defenders.filter(p=>p.id!==first.id&&!unavailable.has(p.id)&&distance(p,owner)<22);
   for(const cover of [...covers,undefined]){
    const cost=candidate.score-(previous?.owner===owner.id&&previous.presser===first.id?.2:0)
     -(cover&&previous?.owner===owner.id&&previous.coverer===cover.id?.1:0)
     +defensiveAllocationCost(players,owner,tactics,first,cover,defenders,unit);
    if(!best||cost<best.cost-1e-8)best={presser:first,coverer:cover,cost};
   }
  }
  if(best)return {owner:owner.id,presser:best.presser.id,coverer:best.coverer?.id??''};
 }
 const coverPoint=presser?coverPosition(presser,owner):{x:owner.side===0?L:0,y:0};
 const threats=players.filter(q=>q.side===owner.side&&q.id!==owner.id&&q.role!=='GK'&&distance(q,{x:owner.side===0?L:0,y:0})<16);
 const abandonment=(p:PracticePlayer)=>threats.some(q=>distance(p,q)<3&&
  !defenders.some(d=>d.id!==p.id&&d.id!==presser?.id&&arrivalTime(d,q)<.8))?1.8:0;
 // Cover is a team responsibility, not a centre-back-only ability. In 5v5
 // the sole centre-back may be the player stepping out to confront the ball.
 const cover=defenders.filter(p=>p.id!==presser?.id&&!unavailable.has(p.id)&&distance(p,owner)<22)
  .map(p=>({p,score:arrivalTime(p,coverPoint)+(distance(p,goal(p))>distance(owner,goal(p))?1:0)+abandonment(p)
   -(p.skills.reading/10)*.15-(p.traits.engagement-.5)*.1}))
  .sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id))[0]?.p;
 return {owner:owner.id,presser:presser?.id??'',coverer:presser?cover?.id??'':''};
}


/** Price both the route past the challenger and the receiving threats. A
 * dedicated cover job competes with retaining another marker; neither has
 * a quota. Forecast only our own proposed jobs and visible opponent positions. */
function defensiveAllocationCost(players:PracticePlayer[],owner:PracticePlayer,tactics:Tactics,first:PracticePlayer,cover:PracticePlayer|undefined,defenders:PracticePlayer[],unit:DefensiveUnitContext):number{
 const goalPoint=goal(first),coverAim=coverPosition(first,owner);
 const reserved=new Set(players.filter(p=>p.side===first.side&&!defenders.some(d=>d.id===p.id)).map(p=>p.id));
 reserved.add(first.id);if(cover)reserved.add(cover.id);for(const id of unit.pressers??[])reserved.add(id);
 const marks=assignMarking(players,owner.side,unit.ball,reserved,unit.marks,owner.id,undefined,true,unit.shape,tactics,unit.fixedMarks);
 const responders=players.filter(p=>p.side===first.side&&p.role!=='GK'&&(defenders.some(d=>d.id===p.id)||unit.fixedMoves?.has(p.id)));
 const response=responders.filter(p=>p.id!==first.id).map(p=>{
  const marked=players.find(q=>q.id===marks.get(p.id));
  const destination=unit.fixedMoves?.get(p.id)??(p.id===cover?.id?coverAim:marked?markPositionFor(marked,unit.ball,p.side,tactics.marking):unit.shape.slots[p.id]?.aim??p);
  const projected={...p};for(let t=0;t<.5;t+=.1)steerMotion(projected,destination,.1,p.pace*.9);
  return arrivalTime(projected,coverAim);
 });
 const routeDanger=.6+clamp((22-distance(owner,goalPoint))/18,0,1);
 let cost=Math.min(3,...response)*routeDanger;
 for(const target of players.filter(q=>q.side===owner.side&&q.id!==owner.id&&q.role!=='GK'&&distance(q,goalPoint)<20)){
  const aim=markPositionFor(target,unit.ball,first.side,tactics.marking),markerId=[...marks].find(([,id])=>id===target.id)?.[0];
  const marker=responders.find(p=>p.id===markerId);
  const coverTime=cover?arrivalTime(cover,coverAim)+distance(coverAim,aim)/Math.max(1,cover.pace):Infinity;
  const response=Math.min(3,marker?arrivalTime(marker,aim):Infinity,coverTime);
  cost+=response*clamp((20-distance(target,goalPoint))/16,.15,1);
 }
 return cost;
}

/** Defending round (2026-10-03, step 1): the cover never stands on his own
 * goal line. Away from goal he covers on the ball-goal line, 3.5-6.5 m behind
 * the ball (further inside near a touchline). Near goal (the ball within
 * COVER_NEAR m of the goal centre) the threat is the cut-back, not the post:
 * he covers on the line from the ball to the penalty spot, never deeper than
 * COVER_FLOOR m from the goal line (the keeper owns the goal line). */
export const COVER_NEAR=14,COVER_FLOOR=4,SHOT_LINE=3,COVER_CENTRAL=5;
export function coverPosition(presser:PracticePlayer,owner:PracticePlayer,seen:Vec=owner):Vec{
 const g=goal(presser),u=unit(g.x-seen.x,-seen.y);
 // Near the touchline the first defender already contains the outside.
 // Cover from farther inside, ready for the cutback or an inward escape,
 // rather than escorting him all the way into the corner.
 const wide=clamp((Math.abs(seen.y)-W*.23)/(W*.22),0,1);
 const gap=clamp(distance(presser,seen)*.5+2.5,3.5,6.5)+wide*2.5;
 const depthOf=(v:Vec)=>presser.side===0?v.x:L-v.x,atDepth=(v:Vec,d:number)=>({x:presser.side===0?d:L-d,y:v.y});
 const far={x:seen.x+u.x*gap,y:seen.y+u.y*gap};
 const near=clamp((COVER_NEAR+4-distance(seen,g))/4,0,1);
 if(near<=0)return inside(depthOf(far)<COVER_FLOOR?atDepth(far,COVER_FLOOR):far);
 // Defending round (step 4): near goal the cover protects what the ball can
 // do next: from a central ball the shot, so he stands on the shot line,
 // SHOT_LINE m goal-side of the ball (behind his presser); from a wide ball
 // the cut-back, on the line from the ball to the penalty spot.
 const spot={x:presser.side===0?SPOT:L-SPOT,y:0},toSpot=distance(seen,spot),v=unit(spot.x-seen.x,spot.y-seen.y);
 const along=Math.min(gap,toSpot*.75),cut={x:seen.x+v.x*along,y:seen.y+v.y*along};
 const toGoal=distance(seen,g),shot={x:seen.x+u.x*Math.min(SHOT_LINE,toGoal*.45),y:seen.y+u.y*Math.min(SHOT_LINE,toGoal*.45)};
 const wideBall=clamp((Math.abs(seen.y)-COVER_CENTRAL)/5,0,1);
 const close={x:shot.x+(cut.x-shot.x)*wideBall,y:shot.y+(cut.y-shot.y)*wideBall};
 const blend={x:far.x+(close.x-far.x)*near,y:far.y+(close.y-far.y)*near};
 return inside(depthOf(blend)<COVER_FLOOR?atDepth(blend,COVER_FLOOR):blend);
}

/** `intent` (after a loss, "On losing it"): 'delay' keeps the first defender
 * in front of the ball, goal-side, while the team drops into shape (Regroup);
 * 'engage' closes the ball down (a counter-press). A shot threat is always
 * closed down. */
export const BLOCK_NEAR=12,BLOCK_GAP=1;
export function containMovement(p:PracticePlayer,owner:PracticePlayer,players:PracticePlayer[],tactics:Tactics,seen:Vec=owner,intent?:'delay'|'engage'):DefensiveMovement{
 const u=unit(goal(p).x-seen.x,-seen.y);
 // A goalkeeper cannot count as the covering outfield defender.
 const covered=players.some(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK'&&
  (q.x-seen.x)*u.x+(q.y-seen.y)*u.y>1&&distance(q,seen)<12);
 const engagement=p.traits.engagement+S.PRESS[tactics.press].engagement.v;
 const urgent=shootingThreat(owner),jockey=!urgent&&(intent==='delay'||intent!=='engage'&&!covered&&engagement<.75);
 // Defending round (step 4): near our goal he takes a block stance on the
 // shot line, BLOCK_GAP m goal-side of the ball on the line to the goal centre
 // (he still meets a dribble: a little of its velocity is led).
 const block=distance(seen,goal(p))<BLOCK_NEAR;
 const lead=clamp(distance(p,seen)/p.pace*.25,.04,.4)*(block?.5:1),gap=block?BLOCK_GAP:jockey?1.8:.45;
 const aim=inside({x:seen.x+owner.vx*lead+u.x*gap,y:seen.y+owner.vy*lead+u.y*gap});
 return {kind:jockey?'jockey':'press',aim,velocity:{x:owner.vx,y:owner.vy},speed:p.pace*(jockey?.9:.94),reason:
  urgent?'Se apropie de șut; iese să închidă mingea și drumul spre poartă.':
  jockey?'E fără acoperire; se apropie controlat și închide drumul spre poartă.':
  covered?'Poate întâlni purtătorul; iese la minge, cu un coleg în acoperire.':
  'Alege să atace mingea, deși nu are încă un coleg în acoperire.'};
}

export interface FlightAssignment {
 hunters:string[];meetings:Record<string,Vec>;coverer:string;coverAim?:Vec;
 /** Attacking team's actual receiving commitment; may use its private intention. */
 receiver?:string;
 /** Defender's estimate from visible flight and reachable players, never receiver. */
 observedReceiver?:string;
 /** Where the defence reads he meets it (the visible flight), never the receiver's own plan. */
 observedMeeting?:Vec;
 /** Defending rebuild: every defender's read of the ball (best first), so the
  * defence chooses who goes for it among those free to (practice-defending). */
 defenders?:{id:string;point:Vec;score:number}[];
 /** The attackers' best visible arrival (s). */
 theirs?:number;
}
export interface ReceivingAssignment {intended?:string;passer?:string;previous?:string;defensiveUnit?:DefensiveUnitContext & {tactics:Tactics}}
/** Interceptions (marking and shape round, item 5): a good defender reads a passing lane. How much better than the
 * engine's plain read (which everyone keeps: nobody is worse than before) a player reads the ball's path when it
 * is the opponents' pass, 0..1: reading and defending together, above a typical 5. It buys him LANE_READ.slack s
 * of slack on a ground ball he steps into (he is off the mark sooner), LANE_READ.air s off his reaction to a ball
 * in the air, LANE_READ.margin s more daring when the defence picks its man for the ball, and his feet set for
 * the ball's path as a reader and defender (practice-control receivingContact). */
export const LANE_READ={slack:.1,air:.08,margin:.1};
export function laneSkill(p:{skills:{defending:number;reading:number}}):number{return clamp(((p.skills.defending+p.skills.reading)/2-5)/5,0,1);}
/** Read reachable points on the visible flight; each team sends one challenger. */
export function assignFlight(players:PracticePlayer[],ball:import('./movement.js').MovingBall,attacking:0|1,unavailable:ReadonlySet<string>=new Set(),receiving:ReceivingAssignment={}):FlightAssignment{
 const result:FlightAssignment={hunters:[],meetings:{},coverer:''};
 if(ball.owner||ball.mode==='shot')return result;
 const airborne=ball.z>.05||Math.abs(ball.vz)>.5,samples=airborne?flightSamples(ball):undefined;
 const speed=Math.hypot(ball.vx,ball.vy),ux=ball.vx/Math.max(.001,speed),uy=ball.vy/Math.max(.001,speed);
 const points=[0,.05,.1,...Array.from({length:16},(_,i)=>.15*(i+1))].map(time=>{
  const moving=Math.min(time,speed/.65),travel=speed*moving-.325*moving*moving;
  return {time,x:ball.x+ux*Math.max(0,travel),y:ball.y+uy*Math.max(0,travel),z:Math.max(0,ball.z+ball.vz*time-4.905*time*time)};
 }).filter(q=>q.x>=0&&q.x<=L&&Math.abs(q.y)<=W/2&&q.z<1.1);
 if(!points.length&&!airborne)return result;
 // Read the opposition's interception opportunity before deciding whether a
 // teammate should rescue a pass addressed to somebody else.
 let opponentArrival=Infinity;
 for(const side of [1-attacking,attacking]){
  const visibleCandidates=players.filter(p=>p.side===side&&!unavailable.has(p.id)&&
   (p.role!=='GK'||side===attacking&&ball.mode==='pass')&&
   !(side===attacking&&ball.mode==='pass'&&p.id===receiving.passer)).flatMap(p=>{
   const lane=side!==attacking?laneSkill(p):0;
   if(airborne){
    const meeting=flightMeeting(p,ball,.2-LANE_READ.air*lane,samples),high=p.role==='GK'?undefined:playableAerialMeetings(p,ball,players,samples).sort((a,b)=>a.ball.time-b.ball.time)[0];
    if(high&&high.ball.time<meeting.time)return [{p,point:{...high.aim,time:high.ball.time,z:high.ball.z},score:high.ball.time}];
    if(!meeting.reachable&&meeting.gap>5)return [];return [{p,point:{...meeting.aim,time:meeting.time,z:0},score:meeting.time+(meeting.reachable?0:meeting.gap/p.pace)}];
   }
   const reachable=points.find(q=>arrivalTime(p,q)<=q.time+.12+LANE_READ.slack*lane),point=reachable??points.at(-1)!;
   const arrival=arrivalTime(p,point);if(!reachable&&arrival>point.time+1.1)return [];
   return [{p,point,score:reachable?point.time:arrival+.3}];
  }).sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
  // Opponents can forecast who could reach this flight, including a keeper,
  // but cannot read who the passer addressed or which teammate agreed to yield.
  // Keep this estimate before applying our private receiving commitments.
  if(side===attacking){result.observedReceiver=visibleCandidates[0]?.p.id;if(visibleCandidates[0])result.observedMeeting={x:visibleCandidates[0].point.x,y:visibleCandidates[0].point.y};result.theirs=visibleCandidates[0]?.score;}
  else result.defenders=visibleCandidates.map(c=>({id:c.p.id,point:{x:c.point.x,y:c.point.y},score:c.score}));
  const candidates=visibleCandidates.filter(c=>c.p.role!=='GK'||c.p.id===receiving.intended);
  // The addressed team-mate stays on his pass while it is in play, even once
  // it looks out of his reach: he chases it (receptionTarget) rather than
  // jogging back to his position while it rolls past. A team-mate who is
  // clearly better placed still takes it over (the rescue rule below).
  if(side===attacking&&ball.mode==='pass'&&receiving.intended&&!candidates.some(c=>c.p.id===receiving.intended)){
   const p=players.find(q=>q.id===receiving.intended&&q.side===side&&!unavailable.has(q.id));
   const point=points.at(-1);
   if(p&&point&&!airborne)candidates.push({p,point,score:arrivalTime(p,point)+.3});
   candidates.sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
  }
  let best=candidates[0];
  if(side!==attacking)opponentArrival=best?.score??Infinity;
  else if(best){
   const incumbent=candidates.find(c=>c.p.id===receiving.previous);
   const intended=candidates.find(c=>c.p.id===receiving.intended);
   // Do not steal a viable teammate's delivery just because its path crosses
   // a nearer player. Handover is useful when the target cannot arrive, or an
   // opponent could get there substantially earlier. Small timing differences
   // retain the current job rather than switching it every assignment tick.
   if(incumbent&&incumbent.score<=best.score+.25)best=incumbent;
   const usefulRescue=intended&&best.score<intended.score-.4&&best.score<=opponentArrival+.1;
   if(intended&&(!receiving.previous||receiving.previous===intended.p.id)&&
    (intended.score<=opponentArrival+.25||!usefulRescue))best=intended;
  }
  if(best){result.hunters.push(best.p.id);result.meetings[best.p.id]={x:best.point.x,y:best.point.y};if(side===attacking)result.receiver=best.p.id;}
 }
 const defender=players.find(p=>p.side!==attacking&&result.hunters.includes(p.id));
 if(defender){
  const point=result.meetings[defender.id],focus={...defender,...point,side:attacking},aim=coverPosition(defender,focus);
  const teammates=players.filter(p=>p.side===defender.side&&p.id!==defender.id&&p.role!=='GK'&&!unavailable.has(p.id));
  const threats=players.filter(p=>p.side!==defender.side&&p.role!=='GK'&&distance(p,goal(defender))<16);
  const eligible=teammates.filter(p=>distance(p,point)<20)
   .map(p=>({p,score:arrivalTime(p,aim)+(distance(p,goal(p))>distance(point,goal(p))?1:0)+
    (threats.some(q=>distance(p,q)<3&&!teammates.some(d=>d.id!==p.id&&arrivalTime(d,q)<.8))?1.8:0)})).sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
  const unit=receiving.defensiveUnit;
  if(unit){
   const receiver=players.find(p=>p.id===result.observedReceiver),threat={...(receiver??focus),...point,side:attacking};
   const defenders=[defender,...teammates];
   const allocations=[...eligible.map(c=>c.p),undefined].map(cover=>({cover,cost:defensiveAllocationCost(players,threat,unit.tactics,defender,cover,defenders,unit)}));
   allocations.sort((a,b)=>a.cost-b.cost);
   const cover=allocations[0]?.cover;if(cover){result.coverer=cover.id;result.coverAim=aim;}
  }else if(eligible[0]){result.coverer=eligible[0].p.id;result.coverAim=aim;}
 }
 return result;
}

/** Keep a useful marker through a pass, handing over only for a better route. */
export function assignMarking(players:PracticePlayer[],attacking:0|1,ball:Vec,unavailable:ReadonlySet<string>,previous:ReadonlyMap<string,string>,carrier='',releasedOffside?:ReadonlySet<string>,playToWhistle=false,shape?:TeamShape,tactics?:Tactics,fixed:ReadonlyMap<string,string>=new Map(),sight?:Sight):Map<string,string>{
 const defenders=players.filter(p=>p.side!==attacking&&p.role!=='GK'&&!unavailable.has(p.id)&&!fixed.has(p.id));
 const depth=(side:0|1,x:number)=>side===0?x:L-x,defending=(1-attacking) as 0|1;
 const line=players.filter(p=>p.side!==attacking).map(p=>depth(attacking,p.x)).sort((a,b)=>b-a)[1]??L;
 // Live defenders do not receive the referee's frozen offside flags. They keep
 // tracking a threat until the whistle; explicit scene callers may supply known flags.
 const style=tactics?.marking??'balanced',limit=style==='tight'||tactics?.press==='aggressive'?L-3:style==='zonal'?X(42):X(60);
 // Prioritise access to goal, not just progress along the touchline. When
 // pressure and cover already occupy two defenders, following the deepest
 // wide opponent first can leave the central finishing option unattended.
 const threatDistance=(p:PracticePlayer)=>distance(p,{x:defending===0?0:L,y:clamp(p.y,-GH,GH)})+distance(p,ball)*.05;
 const threats=players.filter(p=>p.side===attacking&&p.id!==carrier&&!Array.from(fixed.values()).includes(p.id)&&p.role!=='GK'&&depth(defending,p.x)<limit&&distance(p,ball)<46)
  .sort((a,b)=>threatDistance(a)-threatDistance(b)||a.id.localeCompare(b.id));
 const assigned=new Map<string,string>(fixed),used=new Set<string>(fixed.keys()),costs=new Map<string,Map<string,number>>();
 for(const target of threats){
  const exactAim=markPositionFor(target,ball,defending,style);
  const candidates=defenders.filter(p=>distance(p,target)<26).flatMap(p=>{
   // Each candidate judges the man as he last saw him (M3, sightLag): a run
   // that has just started is picked up a moment late.
   const seen=sight?sight(p,target):target,aim=sight?markPositionFor(seen,ball,defending,style):exactAim;
   const departure=shape?markingDeparture(p,seen,aim,shape,style):0;
   // Prefer the defender whose own zone is nearest the attacker laterally:
   // his shape slot, not a touchline 15 m out (an 11-a-side leftover that
   // tied lane +/-1 defenders to the edges of a 30 m pitch).
   return departure===null?[]:[{p,score:arrivalTime(p,aim)+(p.role==='CB'&&depth(defending,seen.x)>38?.9:0)+Math.abs((shape?.slots[p.id]?.aim.y??p.lane*15)-seen.y)*.018+departure
    -(previous.get(p.id)===target.id?(style==='tight'?1.2:.4):0)}];
  }).sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
  costs.set(target.id,new Map(candidates.map(c=>[c.p.id,c.score])));
  const best=candidates.find(c=>!used.has(c.p.id));if(!best)continue;
  assigned.set(best.p.id,target.id);used.add(best.p.id);
 }
 // Compare the pair's routes, not just who reached the first assignment in
 // the loop. A handover must improve coverage as a whole. Existing useful
 // marking already has a persistence credit, and no threat is dropped here.
 const cost=(id:string,target:string)=>costs.get(target)?.get(id)??Infinity;
 for(let pass=0;pass<2;pass++)for(const {id} of defenders){
  const target=assigned.get(id);if(!target)continue;
  for(const q of defenders){
   if(q.id===id)continue;
   const other=assigned.get(q.id),old=cost(id,target)+(other?cost(q.id,other):0),next=cost(q.id,target)+(other?cost(id,other):0);
   if(next>=old-.3)continue;
   assigned.set(q.id,target);if(other)assigned.set(id,other);else assigned.delete(id);
   break;
  }
 }
 return assigned;
}
function markPositionFor(receiver:Vec,ball:Vec,side:0|1,style:Tactics['marking']='balanced'):Vec{
 const toGoal=unit((side===0?0:L)-receiver.x,-receiver.y),toBall=unit(ball.x-receiver.x,ball.y-receiver.y);
 const gap=style==='tight'?.95:1.4,screen=style==='tight'?.4:.65;
 return {x:receiver.x+toGoal.x*gap+toBall.x*screen,y:receiver.y+toGoal.y*gap+toBall.y*screen};
}
