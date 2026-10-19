// Take-on price, eyes-on: one match with the flag off and the same match with it on (laptop, MATCHES=2 node frames.mjs
// <arm> <seed>). At every open-play decision whose list holds a feint the hook hands over the scored list; this records
// the feint under BOTH prices (the other one recomputed and swapped into the same list, as static.ts) with its reads,
// what was chosen, and the frames, so moments can be picked and drawn (render.mjs) in both matches.
import {runMatch} from '../../src/index';
import {feintOptions,takeOnRead,TAKEON_PRICE} from '../../src/practice-feints';
import {laneRisk} from '../../src/practice';
import {viableOptions,routeCredits} from '../../src/practice-carry';
import {actionWeights} from '../../src/practice-selection';
import {turnoverPrice,deliveryLossWeight} from '../../src/practice-rest-defence';
import {engineTeam,sidePlans,sideOrders} from '../../../../lib/ballers/compute';
import {inputOf,init} from '../2026-10-19-world-prices/wp';
export {init};

const L=48,DUTIES=['hold','support','run','show','width','press','jockey','challenge','block','track','cover','intercept','recover','carry','prepare','receive','feint','wrongfoot','keeper','dive','sweep','restart','down'];
function pick(list:any[],plan:any,time:number,kind:string):number{
 const viable=viableOptions(list,plan,time);
 const held=viable.find((o:any)=>o.carry&&o.continuing),bestCarry=Math.max(-Infinity,...list.filter((o:any)=>o.carry).map((o:any)=>o.score));
 const pool=!held||viable.some((o:any)=>o.carry&&o!==held)||bestCarry<=held.score?viable:viable.map((o:any)=>o===held?{...held,score:bestCarry}:o);
 const w=actionWeights(pool),tot=w.reduce((a,b)=>a+b.weight,0);
 return w.filter(x=>x.option.kind===kind).reduce((a,b)=>a+b.weight,0)/tot;
}
function one(inp:any,on:boolean){
 const rows:any[]=[];
 (globalThis as any).__f0=(time:number,p:any,option:any,list:any[],players:any[],mem:any,rk:string,plan:any)=>{
  if(rk)return;
  const i=list.findIndex(o=>o.kind==='feint');if(i<0)return;
  TAKEON_PRICE.on=!on;const other=feintOptions(p,players,mem,time,laneRisk)[0];TAKEON_PRICE.on=on;
  const mine=list[i],own=feintOptions(p,players,mem,time,laneRisk)[0];
  const swapped=list.slice();swapped[i]={...mine,aim:other.aim,target:other.target,score:mine.score-own.score+other.score};
  const marker=players.find((q:any)=>q.id===own.target),read=takeOnRead(p,marker,players);
  const near=Math.min(...players.filter((q:any)=>q.side!==p.side&&q.role!=='GK').map((q:any)=>Math.hypot(q.x-p.x,q.y-p.y)));
  const credits=routeCredits(p,own.aim,players.filter((q:any)=>q.id!==marker.id),laneRisk,near);
  const best=list.filter((o:any)=>o!==mine).sort((a:any,b:any)=>b.score-a.score)[0];
  rows.push({t:time,id:p.id,side:p.side,dribble:p.traits.dribble,risk:p.traits.risk,control:p.skills.control,depth:p.side===0?p.x:L-p.x,
   chosen:option.kind,chosenTarget:option.target??null,score:mine.score,otherScore:swapped[i].score,p:pick(list,plan,time,'feint'),pOther:pick(swapped,plan,time,'feint'),
   through:read.through,stopped:read.stopped,credits:credits.credits,shotGain:credits.shotGain,passGain:credits.passGain,progress:credits.progress,
   lossWeight:deliveryLossWeight(p,turnoverPrice(p,players,p)),marker:own.target,bestOther:best?{kind:best.kind,score:best.score,target:best.target??null}:null});
 };
 const teams=inp.sides.map(engineTeam),plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams as any);
 TAKEON_PRICE.on=on;let r:any;
 try{r=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);}
 finally{(globalThis as any).__f0=undefined;TAKEON_PRICE.on=true;}
 const R=r.result,idx=new Map(R.players.map((p:any,i:number)=>[p.id,i]));
 // compact frames: [t, bx, by, bz, owner index, restart, [i, x, y, vx, vy, duty]...]
 const frames=R.frames.map((f:any)=>{const ps:number[]=[];f.players.forEach((q:any,k:number)=>{const i=f.lineup?f.lineup[k]:k;ps.push(i,+q.x.toFixed(2),+q.y.toFixed(2),+(q.vx??0).toFixed(2),+(q.vy??0).toFixed(2),DUTIES.indexOf(q.duty));});
  return [+f.time.toFixed(2),+f.ball.x.toFixed(2),+f.ball.y.toFixed(2),+(f.ball.z??0).toFixed(2),f.ball.owner?idx.get(f.ball.owner)??-1:-1,f.restart?1:0,ps];});
 const events=R.events.filter((e:any)=>['feint','beat','turnover','tackle','pass','shot','goal','receive'].includes(e.kind)).map((e:any)=>({t:e.time,k:e.kind,a:e.actor,tg:e.target??null}));
 return {on,score:R.score,feints:R.stats.map((s:any)=>s.feints),beaten:R.stats.map((s:any)=>s.beaten),rows,frames,events,ro:R.players.map((p:any)=>[p.side,p.role,p.id,p.name])};
}
export function trace(t:{arm:string;seed:number}){
 const inp=inputOf(t.arm,t.seed);
 return {arm:t.arm,seed:t.seed,off:one(inp,false),on:one(inp,true)};
}
