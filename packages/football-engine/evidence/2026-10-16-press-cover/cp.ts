// Press cover (2026-10-16): the release-2 round robin's row (../2026-10-13-keeper-2/probe.ts minus its per-shot `sh`
// and `aer` lists: the deep-study row + the settings audit's `st`) plus `cp`, what a counter-press and a trap do and what
// they concede. The match is exactly deep.ts's official runMatch call; everything here reads the record. Evidence only.
//
// cp[side] (the side that loses the ball / springs the trap), per match:
//  loss   open-play possession changes against us where one of our outfielders has a 'counter-press' job within 1 s:
//         [n, won back within 3 s, within 5 s, their shots within 8 s (while they keep it, before a restart), their chance
//          sum within 8 s, beaten (not won back within 3 s) n, beaten: their shots within 8 s, beaten: chance sum within 8 s]
//  trap   trap episodes (a 'trap' job appears for one of ours): [n, ball won within 3 s, within 5 s, their shots within 8 s,
//          chance sum within 8 s, beaten n, beaten shots 8 s, beaten chance 8 s] (same windows, from the spring)
//  cov    frames sampled every 0.2 s of open play with their man on the ball: [with a counter-press job of ours, of those
//          with a cover job of ours, with a trap job of ours, of those with a cover job]
//  spell  possession spells (as audit.ts: last side in control, a restart counts for its side): [n, seconds]
// Chances are the official row's per-shot chance (row.shots, matched to the engine's shot events in order).
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {extra as auditExtra} from '../2026-10-13-settings-audit/audit';
export {armTreatment};

const r3=(v:number)=>Math.round(v*1000)/1000;
function cpKeys(R:any,shotChance:number[]){
 const roster:{id:string;side:number;role:string}[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const outIds=[0,1].map(s=>roster.map((p,i)=>({i,p})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i));
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const jobsBy=new Map<number,any[]>();
 for(const ch of choices){const a=jobsBy.get(ch.player)??[];a.push(ch);jobsBy.set(ch.player,a);}
 const purposeAt=(i:number,time:number):string|null=>{const a=jobsBy.get(i);if(!a)return null;let lo=0,hi=a.length-1,best=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best>=0?(a[best].assignment?.purpose??null):null;};
 const has=(s:number,time:number,p:string)=>outIds[s].some(i=>purposeAt(i,time)===p);
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const ownerOf=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const firstChange=(k:number,side:number)=>{for(let q=k+1;q<n;q++){if(poss[q]===side&&poss[q-1]!==side)return frames[q].time;}return Infinity;};
 const restartAfter=(k:number)=>{for(let q=k+1;q<n;q++)if(frames[q].restart)return frames[q].time;return Infinity;};
 const shots=events.filter(e=>e.kind==='shot'&&(e.side===0||e.side===1));
 const ok=shots.length===shotChance.length;
 const conceded=(D:number,from:number,to:number)=>{let c=0,v=0;shots.forEach((e,i)=>{if(e.side===D&&e.time>from&&e.time<=to){c++;v+=ok?shotChance[i]:0;}});return [c,v];};
 const A=[0,1].map(()=>({loss:[0,0,0,0,0,0,0,0],trap:[0,0,0,0,0,0,0,0],cov:[0,0,0,0],spell:[0,0]}));
 const episode=(a:number[],s:number,k:number,t:number)=>{
  const D=1-s,back=firstChange(k,s),won3=back-t<=3,won5=back-t<=5;
  a[0]++;if(won3)a[1]++;if(won5)a[2]++;
  const [c,v]=conceded(D,t,Math.min(t+8,back,restartAfter(k)+.01));a[3]+=c;a[4]+=v;
  if(!won3){a[5]++;a[6]+=c;a[7]+=v;}
 };
 // counter-press losses
 for(let k=1;k<n;k++){
  if(poss[k]===poss[k-1]||poss[k]<0||poss[k-1]<0||frames[k].restart||frames[k-1].restart)continue;
  const s=poss[k-1],t=frames[k].time;let cp=false;
  for(let q=k;q<n&&frames[q].time<=t+1;q++){if(frames[q].restart)break;if(has(s,frames[q].time,'counter-press')){cp=true;break;}}
  if(cp)episode(A[s].loss,s,k,t);
 }
 // trap episodes: the first frame a trap job of ours is on while they have the ball (a new one after 3 s without)
 const lastTrap=[-Infinity,-Infinity];
 for(let k=0;k<n;k+=2){const f=frames[k];if(f.restart)continue;const o=ownerOf(f);if(!o)continue;const s=1-sideOf(o);if(s<0||s>1)continue;
  if(has(s,f.time,'trap')){if(f.time-lastTrap[s]>3)episode(A[s].trap,s,k,f.time);lastTrap[s]=f.time;}}
 // cover beside the goer, sampled
 for(let k=0;k<n;k+=2){const f=frames[k];if(f.restart)continue;const o=ownerOf(f);if(!o)continue;const s=1-sideOf(o);if(s<0||s>1)continue;
  const cp=has(s,f.time,'counter-press'),tr=has(s,f.time,'trap');if(!cp&&!tr)continue;const cov=has(s,f.time,'cover');
  if(cp){A[s].cov[0]++;if(cov)A[s].cov[1]++;}if(tr){A[s].cov[2]++;if(cov)A[s].cov[3]++;}}
 for(let k=0;k<n;){const s=poss[k];let j=k;while(j+1<n&&poss[j+1]===s)j++;if(s>=0){A[s].spell[0]++;A[s].spell[1]+=frames[j].time-frames[k].time;}k=j+1;}
 for(const a of A){a.loss[4]=r3(a.loss[4]);a.loss[7]=r3(a.loss[7]);a.trap[4]=r3(a.trap[4]);a.trap[7]=r3(a.trap[7]);a.spell[1]=Math.round(a.spell[1]*10)/10;}
 return {A,ok};
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 let cap:any=null;
 const row:any=deepPlay(t,R=>{cap=R;return auditExtra(R);});
 const k=cpKeys(cap,row.shots.map((x:any)=>x[1]));
 row.cp=k.A;if(!k.ok)row.cpShotsUnmatched=true;
 for(const a of row.agg){delete a.x.mv;delete a.x.lr;delete a.x.pl;}
 return row;
}
