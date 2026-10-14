// Horizon probe (2026-10-14): the support-proto row (support.ts, unchanged keys) plus `hz` per side, with the
// probe flags set by the entry (off.ts / h1.ts / h2.ts / h3.ts ...). Imports only support.ts and the engine.
// hz[side] keys (per match, that side; own + middle thirds by the passer's depth):
//  up8 [side/back passes (circ's definition: open play, outfield passer, aim gains < 2 m), the ball owned by us >= 8 m
//       further up than the release within 5 s, lost (opponents own it) within 5 s]
//  fp  [forward passes (aim gains >= 5 m, open play, outfield passer), received by a team-mate (next reception within
//       4 s is ours), of those the ball owned by us >= 5 m beyond the reception within 5 s, of those lost within 5 s]
//  hs  (side 0 only) the probe's per-match counters: decisions, horizon reads, flips of the top option, chosen with a
//       positive horizon, sum of chosen horizon, support reads, ms spent in the horizon
import {setHorizon,resetHorizonStats,HORIZON} from '../../src/practice-horizon';
import {setFreeSupport} from '../../src/practice-free-support';
import {extra as supportExtra} from '../2026-10-14-support-proto/support';
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
export {armTreatment};

const L=48;
export function hzExtra(R:any){
 const A:any[]=supportExtra(R);
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,n=frames.length;
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const depth=(s:number,x:number)=>s===0?x:L-x;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const ownerOf=(f:any)=>f.restart?null:(f.ball?.owner??null);
 // from t0 to t0+w: [reached depth >= target while ours, lost (theirs) before]
 const scan=(s:number,t0:number,w:number,target:number)=>{let up=0;
  for(let k=frameAt(t0);k<n&&frames[k].time<=t0+w+1e-6;k++){const f=frames[k];if(f.time<t0-1e-6)continue;if(f.restart&&k>frameAt(t0))return [up,0];
   const o=ownerOf(f);if(!o)continue;const os=sideOf(o);if(os!==s)return [up,1];if(depth(s,f.ball.x)>=target)up=1;if(up)return [1,0];}
  return [up,0];};
 const H=[0,1].map(()=>({up8:[0,0,0],fp:[0,0,0,0]})) as any[];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const s=e.side,pi=idx.get(e.actor);if(pi===undefined||roster[pi].role==='GK')continue;
  const f=frames[frameAt(e.time)],p=pos(f,pi),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const from=depth(s,p.x);if(from>=32)continue;const gain=depth(s,aim.x)-from;
  if(gain<2){const [up,lost]=scan(s,e.time,5,from+8),u=H[s].up8;u[0]++;u[1]+=up;u[2]+=lost;}
  else if(gain>=5){
   const u=H[s].fp;u[0]++;
   let rcv:any=null;for(let r=q+1;r<events.length&&events[r].time<=e.time+4;r++){const x=events[r];if(x.kind==='receive'||x.kind==='turnover'||x.kind==='intercept'){rcv=x;break;}}
   if(!rcv||rcv.kind!=='receive'||sideOf(rcv.actor)!==s)continue;
   u[1]++;const rf=frames[frameAt(rcv.time)],ri=idx.get(rcv.actor)!,rp=pos(rf,ri);if(!rp)continue;
   const [up,lost]=scan(s,rcv.time,5,depth(s,rp.x)+5);u[2]+=up;u[3]+=lost;
  }
 }
 A[0].hz=H[0];A[1].hz=H[1];
 const st=HORIZON.stats;A[0].hz.hs=[st.decisions,st.evals,st.flips,st.posChosen,Math.round(st.sumChosen*1000)/1000,st.supportEvals,Math.round(st.ms)];
 return A;
}
export function configure(on:boolean,gamma:number,depth:number,support:boolean,free:boolean){setHorizon(on,gamma,depth,support);setFreeSupport(free);}
export function play(t:{label:string;arm:string;seed:number;rev:string}){resetHorizonStats();return deepPlay(t,R=>hzExtra(R));}
