import * as S from './style.js';
import {L,W} from './pitch.js';
import {clamp} from './model.js';
import type {Tactics} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {arrivalTime} from './practice-defense.js';
import {groundPassCandidates} from './practice-passing.js';
import {releaseTime} from './practice-possession.js';
import {assessShot} from './practice-football.js';
import {daring,perceive} from './practice-perception.js';
import {WORLD} from './world.js';
const depth=(side:number,x:number)=>side===0?x:L-x;
export interface TransitionRun {player:string;aim:Vec;until:number}
interface TransitionOption {player:string;aim:Vec;advantage:number}
export interface TransitionRead {open:boolean;committed:number;lanes:TransitionOption[];outlets:TransitionOption[]}
/** How far a runner who cannot read the game misjudges a break's race (in
 * advantage units: 0.5 is a second's lead), and how much a daring one
 * over-believes it (R2). A good reader errs by about a third of the spread. */
export const RACE_SPREAD=WORLD.perception.transition.RACE_SPREAD.v,RACE_OPTIMISM=WORLD.perception.transition.RACE_OPTIMISM.v;
/** Read a recent recovery from visible positions/momentum. A keeper is a valid
 * launch player. An organised block is not a counter merely because a timer
 * is running. Destinations remain invitations, not guaranteed receptions. */
export function readTransition(players:PracticePlayer[],owner:PracticePlayer,tactics:Tactics,age:number,continuing:ReadonlyArray<TransitionRun>=[],time=0):TransitionRead{
 const empty:TransitionRead={open:false,committed:0,lanes:[],outlets:[]};
 if(age<0||age>8)return empty;
 const bd=depth(owner.side,owner.x),mates=players.filter(p=>p.side===owner.side&&p.id!==owner.id&&p.role!=='GK'),opponents=players.filter(p=>p.side!==owner.side&&p.role!=='GK');
 const front=Math.max(bd,...mates.map(p=>depth(owner.side,p.x)));
 const committed=opponents.filter(p=>depth(owner.side,p.x)<Math.min(L-WORLD.geometry.transition.committedLimit.v,Math.max(bd+WORLD.geometry.transition.committedAhead.v,front+2))).length;
 const s=owner.side===0?1:-1,lanes:TransitionOption[]=[],outlets:TransitionOption[]=[];
 const defenders=players.filter(p=>p.side!==owner.side);
 // Only the new opportunities need this more expensive delivery check. Reuse
 // ordinary pass power, interception and receiver movement; no success bonus.
 const delivery=(p:PracticePlayer,aim?:Vec):number=>{
  const preparation=releaseTime(owner,aim??p,'pass'),look=Math.min(.3,preparation);
  // Match ordinary launchRisk: advance both sides over the same bounded
  // visible-momentum horizon, never only the defender at the old release spot.
  const forecast=(q:PracticePlayer)=>({...q,x:q.x+q.vx*look,y:q.y+q.vy*look});
  const passer=forecast(owner),receiver=forecast(p),visible=defenders.map(forecast);
  const passes=groundPassCandidates(passer,receiver,!!aim,aim?{aim,speed:p.pace*.94}:undefined,passer,visible);
  return Math.max(0,...passes.map(pass=>{
   const room=Math.min(...opponents.map(q=>arrivalTime(q,pass.aim)))-preparation-pass.flight;
   if(!Number.isFinite(pass.flight)||pass.risk>=.4||pass.reachMargin<-.1||room<.15||(pass.aim.x-owner.x)*s<4)return 0;
   return clamp(room/2,0,1)*(1-pass.risk)*(1-pass.controlRisk);
  }));
 };
 for(const p of mates){
  if(p.energy<22)continue;
  const retained=continuing.find(r=>r.player===p.id&&r.until>time);
  const points=[...(retained?[retained.aim]:[]),...[7,11].flatMap(advance=>[-W*.25,0,W*.25].map(y=>({x:depth(owner.side,clamp(Math.max(bd+WORLD.geometry.transition.laneAhead.v,depth(owner.side,p.x)+advance),3,L-4)),y})))];
  const prospective:TransitionOption[]=[];
  for(const aim of points){
   const keeping=aim===retained?.aim;
   // An opening does not disappear merely because its runner has already
   // travelled most of the distance. Reassess the same destination against
   // the opposition, instead of requiring another fresh seven-metre run.
   if((aim.x-p.x)*s<(keeping?-1:4)||Math.hypot(aim.x-owner.x,aim.y-owner.y)>34)continue;
   const travel=arrivalTime(p,aim),room=Math.min(...opponents.map(q=>Math.hypot(aim.x-q.x,aim.y-q.y)));
   const behind=opponents.filter(q=>depth(owner.side,q.x)<depth(owner.side,aim.x)-2).length;
   const nearestArrival=Math.min(...opponents.map(q=>arrivalTime(q,aim)));
   // A long run need not beat every defender: it can pin the last defender
   // and open another lane. Require room and multiple opponents to bypass.
   // The race is the runner's own read (R2): his error by reading, and a
   // daring runner believes a little more that he gets there first.
   const advantage=perceive(p,'race',clamp((nearestArrival-travel+.8)/2,0,1)+behind*.16,RACE_SPREAD,aim,{time,salt:'race',bias:RACE_OPTIMISM*daring(p)});
   const threshold=S.ON_WIN[tactics.transition??'balanced'].breakOpenness.v;
   // A break already under way is a sprint judged as a race still being won
   // (he gets there first, with room, past at least one man), not re-opened
   // from scratch: no fresh two-man count, and no pass needed right now.
   if(keeping&&room>2&&travel<4&&behind>=1&&advantage>=threshold-.15){lanes.push({player:p.id,aim,advantage});continue;}
   if(room>3&&travel<4&&behind>=2&&advantage>=threshold){
    const option={player:p.id,aim,advantage};
    if(committed>=2)lanes.push(option);else prospective.push(option);
   }
  }
  // Defenders can still be ahead of the ball and lose the race to a diagonal
  // delivery. The old opponent count is evidence, not permission to evaluate.
  for(const option of prospective.sort((a,b)=>b.advantage-a.advantage).slice(0,2)){
   if(delivery(p,option.aim)>0)lanes.push(option);
  }
  // Already being in a useful attacking position must not require a new run.
  // Harmless circulation in front of a settled block is not sufficient: the
  // outlet must advance play into a materially better shooting position, with
  // time to receive before pressure arrives. Ordinary actions still compete.
  if(depth(owner.side,p.x)>=L*.65&&(p.x-owner.x)*s>=4&&Math.hypot(p.x-owner.x,p.y-owner.y)<=34&&
    assessShot(p,players).quality>assessShot(owner,players).quality+.15){
   const advantage=delivery(p);if(advantage>0)outlets.push({player:p.id,aim:{x:p.x,y:p.y},advantage});
  }
 }
 return {open:lanes.length>0||outlets.length>0,committed,lanes,outlets};
}
