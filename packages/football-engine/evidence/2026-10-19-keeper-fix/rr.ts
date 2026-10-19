// Keeper fix (2026-10-19): the press-cover round robin row (../2026-10-16-press-cover/cp.ts, copied unchanged) plus
// `sit[side]`, the situation checks every engine round reports (the R1 definitions: ../2026-10-14-r1/sit.ts r1Keys and
// ../2026-10-14-r1-shape/r1.ts), with the keeper's part in the build-up:
//  r1        r1Keys(R) as sit.ts: own3 (s of open-play possession with the ball <= 16 m from our goal), own3Two (of those,
//            >= 2 of our outfielders < 5 m from our goal line, |y| < 9: men on our goal line), gkFeet / gkCarry /
//            gkCarryBack (keeper spells at his feet / moving >= 1 m / begun from a team-mate's pass: the keeper recycle),
//            passes, selfDefl, clears..., own3Losses / own3LossGoals, longFinal / longClean, lofted, toKeeper, shots
//  own3NoFwd of own3: s with no outfielder of ours >= 5 m upfield of the ball, <= 22 m from it, >= 2.5 m from every
//            opposing outfielder (build-up with no open forward option)
//  recycle   possession spells begun <= 16 m from our goal, lasting >= 6 s, the ball never reaching 20 m; recycleLost
//            (ended by their ball), recycleGoal (and they scored within 10 s)
//  missed    lost passes (not into a man within 0.25 s, not off the passer's own body) whose intended receiver never came
//            within 3 m of the ball: passes to nobody; lostPass: all lost passes
//  kp        the keeper in open play: [passes played to him, of those received, his own passes]
// The press-cover header follows.
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
import {r1Keys} from '../2026-10-14-r1/sit';
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

const L2=48,dep=(s:number,x:number)=>s===0?x:L2-x;
const NEXT=['receive','turnover','out','save','goal','shot','pass','clearance','block','tackle','restart'];
function sitKeys(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events;
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const posAt=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const fi=(t:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi)>>1;if(frames[m].time<t)lo=m+1;else hi=m;}return lo;};
 const r1=r1Keys(R);
 const per=[0,1].map(s=>({r1:r1[s],own3NoFwd:0,recycle:0,recycleLost:0,recycleGoal:0,missed:0,lostPass:0,kp:[0,0,0]}));
 for(let k=0;k+1<frames.length;k++){
  const f=frames[k],dt=Math.min(.2,frames[k+1].time-f.time);if(dt<=0)continue;
  const o=f.ball.owner;if(!o||f.restart)continue;const s=sideOf(o);if(s<0)continue;
  const bd=dep(s,f.ball.x);if(bd>16)continue;
  const mates:any[]=[],opp:any[]=[];
  roster.forEach((p:any,i:number)=>{if(p.role==='GK')return;const q=posAt(f,i);if(!q)return;(p.side===s?mates:opp).push(q);});
  if(!mates.some(q=>dep(s,q.x)>=bd+5&&Math.hypot(q.x-f.ball.x,q.y-f.ball.y)<=22&&opp.every(d=>Math.hypot(d.x-q.x,d.y-q.y)>=2.5)))per[s].own3NoFwd+=dt;
 }
 const goals=events.filter((e:any)=>e.kind==='goal');
 let cur:{s:number;t0:number;startD:number;maxD:number}|null=null;
 const close=(endT:number,next:number|null)=>{if(!cur)return;const st=per[cur.s];
  if(cur.startD<=16&&endT-cur.t0>=6&&cur.maxD<20){st.recycle++;if(next!==null&&next!==cur.s){st.recycleLost++;const other=1-cur.s;if(goals.some((g:any)=>g.side===other&&g.time>=endT&&g.time<=endT+10))st.recycleGoal++;}}};
 for(const f of frames){const o=f.ball.owner,s=o?sideOf(o):-1;if(s<0)continue;
  if(!cur||cur.s!==s){close(f.time,s);cur={s,t0:f.time,startD:dep(s,f.ball.x),maxD:dep(s,f.ball.x)};}else cur.maxD=Math.max(cur.maxD,dep(s,f.ball.x));}
 close(R.duration,null);
 for(let k=0;k<events.length;k++){
  const e=events[k];if(e.kind!=='pass')continue;const s=sideOf(e.actor);if(s<0)continue;const st=per[s];
  const rs=!!frames[fi(e.time)].restart,a=roster[idx.get(e.actor)!],tg=e.target&&idx.has(e.target)?roster[idx.get(e.target)!]:null;
  let next:any=null;for(let q=k+1;q<events.length;q++)if(NEXT.includes(events[q].kind)){next=events[q];break;}
  if(!rs){if(a.role==='GK')st.kp[2]++;else if(tg&&tg.role==='GK'&&tg.side===s){st.kp[0]++;if(next&&next.kind==='receive'&&next.actor===e.target)st.kp[1]++;}}
  const lost=next&&(next.kind==='turnover'||next.kind==='out'||((next.kind==='receive'||next.kind==='save')&&sideOf(next.actor)!==s));
  if(!lost)continue;st.lostPass++;
  let self=false;for(let j=fi(e.time);j<frames.length&&frames[j].time<=e.time+.4;j++){const f=frames[j];if(f.time>=next.time)break;if(f.ball.mode==='loose'&&!f.ball.owner){const q=posAt(f,idx.get(e.actor)!);if(q&&Math.hypot(q.x-f.ball.x,q.y-f.ball.y)<.8)self=true;break;}}
  if(next.kind==='turnover'&&next.time-e.time<=.25)continue;
  if(e.target&&!self&&idx.has(e.target)){let near=Infinity;const ti=idx.get(e.target)!;for(let j=fi(e.time);j<frames.length&&frames[j].time<=next.time;j++){const q=posAt(frames[j],ti);if(q)near=Math.min(near,Math.hypot(q.x-frames[j].ball.x,q.y-frames[j].ball.y));}if(near>3)st.missed++;}
 }
 for(const p of per)p.own3NoFwd=Math.round(p.own3NoFwd*10)/10;
 return per;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 let cap:any=null;
 const row:any=deepPlay(t,R=>{cap=R;return auditExtra(R);});
 const k=cpKeys(cap,row.shots.map((x:any)=>x[1]));
 row.cp=k.A;if(!k.ok)row.cpShotsUnmatched=true;
 row.sit=sitKeys(cap);
 for(const a of row.agg){delete a.x.mv;delete a.x.lr;delete a.x.pl;}
 return row;
}
