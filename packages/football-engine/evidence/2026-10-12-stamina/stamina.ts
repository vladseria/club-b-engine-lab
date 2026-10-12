// Stamina study (2026-10-12): the deep-study row (../2026-10-12-deep-study/deep.ts, unchanged official fields and
// agg) plus `st`, what stamina is about: per-minute energy, when each outfielder first drops below the tired-sub
// levels, and goals / chances / running / duels by 5-minute period. When the bundle carries the read-only legs hook
// (variants.mjs `hook`), `st.legs` adds each side's mean top-pace factor, acceleration factor and sprint reserve by
// minute, sampled every 0.5 s. Evidence only.
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
export {armTreatment};

const PERIODS=[300,600];// 0-5, 5-10, 10-15 min (+ the last-attack seconds)
const per=(t:number)=>t<PERIODS[0]?0:t<PERIODS[1]?1:2;
const LEVELS=[88,79,75];

type Acc={[side:number]:number[][]};
function extra(R:any,inp:any){
 const roster:{id:string;side:number;role:string}[]=R.players,frames:any[]=R.frames,events:any[]=R.events;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const outfield=(s:number)=>roster.map((p,i)=>({i,p})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i);
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const r1=(v:number)=>Math.round(v*10)/10,r3=(v:number)=>Math.round(v*1000)/1000;
 const out:any[]=[0,1].map(s=>{
  const ids=outfield(s);
  const energy=Array.from({length:15},(_,m)=>{const f=frames[frameAt(60*(m+1))];let e=0,c=0;for(const i of ids){const p=pos(f,i);if(p){e+=p.energy;c++;}}return r1(c?e/c:0);});
  const cross=ids.map(i=>LEVELS.map(level=>{for(const f of frames){const p=pos(f,i);if(p&&p.energy<level)return r1(f.time);}return null;}));
  const dist=[0,0,0],hs=[0,0,0],top=[0,0,0];
  for(let k=1;k<n;k++){const f=frames[k],g=frames[k-1];if(f.cut)continue;const dt=f.time-g.time;if(dt<=0||dt>.25)continue;const q=per(f.time);
   for(const i of ids){const p=pos(f,i),o=pos(g,i);if(!p||!o)continue;const d=Math.hypot(p.x-o.x,p.y-o.y);dist[q]+=d;const v=Math.hypot(p.vx,p.vy);if(v>5.5)hs[q]+=d;if(v>top[q])top[q]=v;}}
  const P=()=>[0,0,0];
  const o={goals:P(),shots:P(),tackles:P(),turnovers:P(),fouls:P()};
  for(const e of events){if(e.side!==s)continue;const q=per(e.time);
   if(e.kind==='goal')o.goals[q]++;if(e.kind==='shot')o.shots[q]++;if(e.kind==='tackle')o.tackles[q]++;if(e.kind==='turnover')o.turnovers[q]++;if(e.kind==='foul')o.fouls[q]++;}
  return {energy,cross,dist:dist.map(Math.round),hs55:hs.map(Math.round),top:top.map(r3),...o};
 });
 // good / clear chances by period from the official shot rows are added by the analysis (row.shots: side, chance, ..., second)
 const H=(globalThis as any).__staminaAcc as Acc|undefined;
 if(H)for(const s of [0,1])out[s].legs=H[s].map(v=>v[3]?[r3(v[0]/v[3]),r3(v[1]/v[3]),r3(v[2]/v[3]),r3(v[4]/v[3])]:null);
 return out;
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 // the hook (present only in `hook` bundles): every 30th tick, outfielders' live legs by minute
 // [top-pace factor (pace/basePace), acceleration factor (legs()), reserve 0-1, n, share of samples above 0.8 x basePace]
 const acc:Acc={0:Array.from({length:16},()=>[0,0,0,0,0]),1:Array.from({length:16},()=>[0,0,0,0,0])};
 (globalThis as any).__staminaAcc=undefined;
 (globalThis as any).__staminaHook=(time:number,p:any,fit:any,reserve:number)=>{
  if(p.role==='GK'||Math.round(time*60)%30!==0)return;
  (globalThis as any).__staminaAcc=acc;
  const v=acc[p.side][Math.min(15,Math.floor(time/60))];v[0]+=p.pace/p.basePace;v[1]+=fit.acceleration;v[2]+=reserve;v[3]++;if(Math.hypot(p.vx,p.vy)>.8*p.basePace)v[4]++;
 };
 try{return deepPlay(t,extra);}finally{(globalThis as any).__staminaHook=undefined;(globalThis as any).__staminaAcc=undefined;}
}
