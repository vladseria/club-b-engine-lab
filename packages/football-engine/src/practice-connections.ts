import {clamp} from './model.js';
import {L,W} from './pitch.js';
import {steerMotion} from './movement.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {arrivalTime,releaseClosing} from './practice-defense.js';
import {returnRunPoints} from './practice-support.js';
import type {SupportPlan,SupportMove} from './practice-support.js';
import {strikeTurnTime} from './practice-striking.js';

export type ConnectionMovement=Pick<SupportMove,'aim'|'speed'> & Partial<Pick<SupportMove,'player'|'purpose'|'kind'>>;
export interface ConnectionRead {gain:number;target?:string;continuation?:ConnectionMovement}
export interface ConnectionContext {support:SupportPlan|null;time:number}
type LaneRisk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(p:PracticePlayer,v:Vec)=>p.side===0?v.x:L-v.x;
const visible=(p:PracticePlayer,t:number):PracticePlayer=>({...p,x:clamp(p.x+p.vx*Math.min(.7,t),.8,L-.8),y:clamp(p.y+p.vy*Math.min(.7,t),-W/2+1,W/2-1)});
const threat=(p:PracticePlayer,v:Vec)=>clamp((depth(p,v)-L*.35)/(L*.6),0,1)*(.65+.35*(1-Math.abs(v.y)/(W/2)));

/** One further ground connection, not a recursively simulated possession.
 * Discount the first reception, the time to turn and opponents' ability to
 * close. Teammates can share their current movement intentions; opponents
 * are forecast only from visible motion, never their future assigned jobs. The recipient still chooses an action if the ball reaches him. */
export function readNextConnection(p:PracticePlayer,q:PracticePlayer,aim:Vec,players:PracticePlayer[],flight:number,risk:LaneRisk,context?:ConnectionContext):ConnectionRead{
 const defenders=players.filter(d=>d.side!==p.side),future=defenders.map(d=>visible(d,flight));
 const pressure=clamp((4-Math.min(...defenders.filter(d=>d.role!=='GK').map(d=>distance(d,p))))/4,0,1);
 const receiver={...q,...aim};let best:ConnectionRead={gain:0};
 for(const mate of players){
  if(mate.side!==p.side||mate.id===q.id||mate.role==='GK')continue;
  const move=context?.support?.owner===p.id&&context.support.side===p.side?context.support.moves.find(m=>m.player===mate.id&&m.since<=context.time&&m.until>context.time):undefined;
  let target=visible(mate,flight+.5);
  if(move){
   // Our teammate's current intention is shared information. Project the
   // beginning of that movement with his real acceleration, never teleport
   // him to its endpoint or read an opponent's future assigned job.
   target={...mate};const duration=Math.min(2,flight+.5);
   for(let t=0;t<duration;t+=.1)steerMotion(target,move.aim,Math.min(.1,duration-t),Math.min(mate.pace,move.speed));
  }
  const returning=mate.id===p.id;
  const candidates:{target:PracticePlayer;continuation?:ConnectionRead['continuation']}[]=[{target,continuation:move?{player:mate.id,aim:{...move.aim},speed:move.speed,kind:move.kind,purpose:move.purpose}:undefined}];
  if(returning&&!move&&distance(p,q)<14){
   for(const point of returnRunPoints(p)){
    const projected={...p},speed=p.pace*(.85+p.traits.runs*.08),duration=Math.min(1.8,flight+.5);
    for(let t=0;t<duration;t+=.1)steerMotion(projected,point,Math.min(.1,duration-t),speed);
    candidates.push({target:projected,continuation:{player:p.id,aim:point,speed,kind:'run',purpose:'give-and-go'}});
   }
  }
  for(const {target,continuation} of candidates){
  const length=distance(aim,target);
  // A moving passer can be the next receiver. Credit the new position he is
  // already moving towards, not a stationary bounce back to the same duel.
  if(returning&&distance(p,target)<1.5)continue;
  if(length<3||length>32)continue;
  const prepare=.12+(1-clamp(q.skills.control/10,0,1))*.2+strikeTurnTime(receiver,target);
  // A man on the receiver's back does not close a quick ball played away from him (releaseClosing).
  const closing=releaseClosing(defenders,aim,p,target,prepare);
  const room=clamp((closing-flight-prepare)/.8,0,1);
  if(room===0)continue;
  const pace=14+q.skills.passing*.5,secondRisk=risk(aim,target,future,pace);
  const technique=clamp(1-(1-q.skills.passing/10)*length/35,.2,1);
  // Compare a give-and-go to carrying to the same point: the wall pass only
  // adds access when the direct route is contested. Other connections compare
  // against the original carrier delivering directly, as before.
  const direct=1-risk(p,target,defenders,returning?p.pace*.72:14+p.skills.passing*.5);
  // Reward access this teammate adds, not a needless detour to an already
  // open receiver. Longer chains lose value as the forecast becomes uncertain.
  const access=(1-secondRisk)*technique*room-direct;
  // A useful second pass may go across or behind the press. Previously the
  // forward-only filter made a reset through the pivot invisible, even when
  // that intermediary opened a lane the carrier could not use directly.
  const exitTime=Math.min(...future.map(d=>arrivalTime(d,target)))-prepare-length/pace;
  const escape=pressure*clamp((exitTime-.3)/1.2,0,1)*clamp((distance(p,target)-4)/8,0,1)*.65;
  const value=depth(p,target)>=depth(p,p)+2?Math.max(threat(p,target),escape):escape;
  const gain=Math.max(0,access)*value*Math.exp(-flight*.3-prepare*.5)*(returning&&continuation ? .65+p.traits.runs*.35 : 1);
  if(gain>best.gain)best={gain,target:mate.id,continuation};
  }
 }
 return best;
}

/** A defender already stepping towards the carrier can leave a passing lane.
 * We can exploit that observed commitment; we cannot assume a stationary
 * defender will obediently follow a decoy. */
export function readDrawnOpening(p:PracticePlayer,aim:Vec,players:PracticePlayer[],risk:LaneRisk):{gain:number;target?:string}{
 const defenders=players.filter(d=>d.side!==p.side);
 const closing=defenders.some(d=>distance(d,p)<8&&((p.x-d.x)*d.vx+(p.y-d.y)*d.vy)/Math.max(.1,distance(d,p))>.8);
 if(!closing)return {gain:0};
 const carrier={...p};for(let t=0;t<.6;t+=.1)steerMotion(carrier,aim,.1,p.pace*.72);
 const future=defenders.map(d=>visible(d,.6));let best={gain:0,target:undefined as string|undefined};
 for(const q of players){
  if(q.side!==p.side||q.id===p.id||q.role==='GK'||distance(p,q)>25)continue;
  const target=visible(q,.6),before=risk(p,q,defenders),after=risk(carrier,target,future);
  const gain=Math.max(0,before-after-.1)*threat(p,target);
  if(gain>best.gain)best={gain,target:q.id};
 }
 return best;
}
