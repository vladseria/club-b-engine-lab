// Take-on price: the engine-audits row (../2026-10-19-engine-audits/audit.ts, unchanged: skill prices E) with the flag
// set from the rev name (flag.ts).
import {play as aPlay,init,inputOf,plain,armTreatment} from '../2026-10-19-engine-audits/audit';
import * as F from '../../src/practice-feints';
import * as C from '../../src/practice-carry';
import * as FB from '../../src/practice-football';
import {laneRisk} from '../../src/practice';
import {setFlag} from './flag';
const r1=(v:number)=>Math.round(v*10)/10,r3=(v:number)=>Math.round(v*1000)/1000;
export {init,inputOf,plain,armTreatment};
// (round 4) `tp`, every open-play take-on chosen (hook.mjs tpHook): [side, t, depth from his own goal, dribble, pace,
// control, through, stopped, expected gain, score] (reads only on builds with takeOnParts; the flag-off arm reads them
// too, as what the priced read would say). Read-only.
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const on=setFlag(t.rev),tp:any[]=[],f:any=F,c:any=C;let row:any;
 (globalThis as any).__tp=(time:number,p:any,option:any,rk:string,players:any[])=>{
  if(rk||option.kind!=='feint')return;
  const x:any[]=[p.side,r1(time),r1(p.side===0?p.x:48-p.x),p.traits.dribble,r3(p.pace),p.skills.control];
  const d=players?.find((q:any)=>q.id===option.target);
  if(d&&f.takeOnParts){const near=Math.min(...players.filter((q:any)=>q.side!==p.side&&q.role!=='GK').map((q:any)=>Math.hypot(q.x-p.x,q.y-p.y)));
   const parts=f.takeOnParts(p,d,players,option.aim,laneRisk,near,time,FB.shotZone(p,p)?f.shotOpening(p,p,players,laneRisk,time):0);x.push(r3(parts.through),r3(parts.read.stopped),r3(parts.gain));}
  x.push(r3(option.score));tp.push(x);
 };
 try{row=aPlay(t);}finally{(globalThis as any).__tp=undefined;setFlag('off');}
 row.flag=on;row.rev=t.rev;row.label=t.label;row.tp=tp;return row;
}
