// PROBE (horizon-probe, 2026-10-14). Off by default; nothing here runs unless HORIZON.on. Upper bound, throwaway.
//
// A two-pass view of a delivery. Every option the engine weighs is valued one pass ahead (the pass itself, the
// receiver's prospects as time/cover/numbers, and readNextConnection's credit for a second ground pass that ADDS
// access over the carrier's own direct ball). Here a delivery is also worth what the RECEIVER will be able to do
// with the ball, read by the engine's own full option scoring (practiceOptions + approachOptions: carries, passes,
// lofts, shots, with plan weights as they are) from where and when the ball reaches him:
//
//   horizon(o) = gamma x (1 - risk) x ( V(receiver at the reception) - caught - V(carrier now) )
//
//  - V(x) = the best option score x would have; V(carrier now) = the best of the options being weighed (the
//    carrier's continuation if he keeps it, since a carry is re-decided every ~0.4 s), so a pass earns only the
//    position it ADDS and carries/shots keep horizon 0 (relative/advantage form: no blanket bonus for passing);
//  - the world at the reception: the receiver at the aim, facing the passer, still; everyone else on his current
//    motion (up to HORIZON_AHEAD s), and an opponent within HORIZON_MARK m of one of ours moves with that man;
//  - caught = (1 - room at the reception) x RECEIVER_CAUGHT x the loss price there (the engine's own turnover price);
//  - the interception of the first pass is already priced in today's score, so only (1 - risk) carries the gain;
//  - exact reads: the receiver's read is his own (perceive is deterministic), no added noise.
// depth 2 (H3) applies the same once more inside the receiver's read, pruned to the top HORIZON_TOP3 deliveries.
import {clamp} from './model.js';
import {L,W} from './pitch.js';
import type {Vec} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import {receivingRoom,RECEIVER_CAUGHT} from './practice-passing.js';
import {turnoverPrice,deliveryLossWeight} from './practice-rest-defence.js';

let lastBest:{kind:string;rel:number}|null=null;
export type Evaluate=(q:PracticePlayer,world:PracticePlayer[])=>Option[];
export const HORIZON:{on:boolean;gamma:number;depth:number;support:boolean;evaluate?:Evaluate;trace?:(o:any)=>void;
 stats:{decisions:number;evals:number;flips:number;posChosen:number;sumChosen:number;supportEvals:number;ms:number}}=
 {on:false,gamma:.7,depth:1,support:false,stats:{decisions:0,evals:0,flips:0,posChosen:0,sumChosen:0,supportEvals:0,ms:0}};
export function setHorizon(on:boolean,gamma=.7,depth=1,support=false){Object.assign(HORIZON,{on,gamma,depth,support});}
export function resetHorizonStats(){HORIZON.stats={decisions:0,evals:0,flips:0,posChosen:0,sumChosen:0,supportEvals:0,ms:0};}
/** Opponents' and team-mates' motion carried on for at most this long; markers within this distance of a man follow him. */
export const HORIZON_AHEAD=1.2,HORIZON_MARK=3.5;
/** Deliveries read per decision (depth 1) and inside the receiver's read (depth 2). */
export const HORIZON_TOP=8,HORIZON_TOP3=3;

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(x:number,y:number):Vec=>({x:clamp(x,.8,L-.8),y:clamp(y,-(W/2-1),W/2-1)});

/** The world when the ball reaches q at `aim`, `T` s from now (see the header). */
export function forecastWorld(players:readonly PracticePlayer[],passer:PracticePlayer,q:PracticePlayer,aim:Vec,T:number):PracticePlayer[]{
 const h=Math.min(Math.max(0,T),HORIZON_AHEAD);
 const shift=new Map<string,Vec>();
 for(const m of players){
  if(m.side!==passer.side)continue;
  if(m.id===q.id)shift.set(m.id,{x:aim.x-q.x,y:aim.y-q.y});
  else if(m.id===passer.id)shift.set(m.id,{x:m.vx*Math.min(h,.3),y:m.vy*Math.min(h,.3)});
  else shift.set(m.id,{x:m.vx*h,y:m.vy*h});
 }
 const ours=players.filter(m=>m.side===passer.side&&m.role!=='GK');
 return players.map(o=>{
  if(o.side===passer.side){
   const d=shift.get(o.id)!,v=inside(o.x+d.x,o.y+d.y);
   if(o.id===q.id)return {...o,...v,vx:0,vy:0,angle:Math.atan2(passer.y-aim.y,passer.x-aim.x)};
   if(o.id===passer.id)return {...o,...v,vx:0,vy:0};
   return {...o,...v};
  }
  if(o.role==='GK')return o;
  let man:PracticePlayer|null=null,gap=HORIZON_MARK;
  for(const m of ours){const g=distance(o,m);if(g<gap){gap=g;man=m;}}
  if(man){const d=shift.get(man.id)!,v=inside(o.x+d.x,o.y+d.y);return {...o,...v,vx:man.id===q.id?0:man.vx,vy:man.id===q.id?0:man.vy};}
  const v=inside(o.x+o.vx*h,o.y+o.vy*h);return {...o,...v};
 });
}

/** V of q holding the ball in `world` (his best option), less the loss if he is caught before he can act. */
export function receptionValue(q:PracticePlayer,world:PracticePlayer[],evaluate:Evaluate,depth:number):number{
 HORIZON.stats.evals++;
 let options=evaluate(q,world);
 if(!options.length)return 0;
 if(depth>1)options=applyHorizon(q,world,options,evaluate,depth-1,HORIZON_TOP3);
 const best=Math.max(...options.map(o=>o.score));
 if(HORIZON.trace){const b=options.find(o=>o.score===best)!;lastBest={kind:b.kind,rel:(q.side===0?1:-1)*(b.aim.x-q.x)};}
 const room=receivingRoom(q,world.filter(d=>d.side!==q.side),0);
 const caught=(1-room)*RECEIVER_CAUGHT*deliveryLossWeight(q,turnoverPrice(q,world,q));
 return best-caught;
}

/** Add the horizon to the deliveries among `options` (the carrier p's weighed options); carries/shots unchanged. */
export function applyHorizon(p:PracticePlayer,players:PracticePlayer[],options:Option[],evaluate:Evaluate,depth=HORIZON.depth,top=HORIZON_TOP):Option[]{
 if(!options.length)return options;
 const self=Math.max(...options.map(o=>o.score));
 const byId=new Map(players.map(q=>[q.id,q]));
 const deliveries=options.filter(o=>(o.kind==='pass'||o.kind==='through'||o.kind==='loft')&&o.target&&byId.has(o.target)&&(o.pass||o.loft))
  .filter(o=>((o.pass?.risk??o.loft?.risk??1))<.9).sort((a,b)=>b.score-a.score).slice(0,top);
 if(!deliveries.length)return options;
 const memo:{target:string;aim:Vec;v:number}[]=[],added=new Map<Option,number>();
 for(const o of deliveries){
  const q=byId.get(o.target!)!,flight=o.pass?.flight??o.loft?.flight??1,risk=clamp(o.pass?.risk??o.loft?.risk??0,0,1);
  let v=memo.find(m=>m.target===q.id&&distance(m.aim,o.aim)<1)?.v;
  if(v===undefined){
   const world=forecastWorld(players,p,q,o.aim,Number.isFinite(flight)?flight:1);
   v=receptionValue(world.find(m=>m.id===q.id)!,world,evaluate,depth);
   memo.push({target:q.id,aim:o.aim,v});
  }
  added.set(o,HORIZON.gamma*(1-risk)*(v-self));
  if(HORIZON.trace&&depth===HORIZON.depth)HORIZON.trace({p:p.id,side:p.side,x:p.x,kind:o.kind,target:q.id,rel:(p.side===0?1:-1)*(o.aim.x-p.x),score:o.score,v,self,risk,h:added.get(o),best:lastBest});
 }
 // a delivery not read (beyond the top, or near-certain interception) is never better off than the worst read one
 const floor=Math.min(0,...added.values());
 return options.map(o=>added.has(o)?{...o,score:o.score+added.get(o)!,horizon:added.get(o)} as Option
  :(o.kind==='pass'||o.kind==='through'||o.kind==='loft')&&o.target?{...o,score:o.score+floor,horizon:floor} as Option:o);
}
