// Support study (2026-10-14): the deep-study row (../2026-10-12-deep-study/deep.ts, unchanged official fields and
// agg) plus `sup`, per side: off-ball support while that side has the ball. Evidence only; reads the recorded match,
// changes nothing (the lane check calls the engine's own pure groundPass/groundPassRisk on copies built from frames).
//
// Sampling: every 0.25 s of open play with a carrier (ball owner, no restart). Depth = metres from the side's own goal;
// zone 0 own third (<16), 1 middle (16-32), 2 final third (>=32), by the ball's depth. "Open" team-mate = >=2.5 m from
// every opposing outfielder. "Option" = open outfield team-mate (carrier excluded) <=22 m from the ball. Ahead = >=5 m
// upfield of the ball; level = within (-2, +5); behind = <=-2. Lane open = the engine's groundPass(carrier, mate) plan
// (its own weight choice) has risk <= 0.42 (the engine's "safe" pass bar, practice-lesson.ts:324).
//
// sup[side] keys (per match, that side; arrays indexed by zone 0/1/2 unless said):
//  n[z]         carrier samples
//  noFwd[z]     samples with no open team-mate ahead <=22 m (the umano definition)
//  noFwdLane[z] samples with no open team-mate ahead <=22 m whose lane is open
//  noFwd2[z]    (added after the cloud round; laptop sensitivity rows only) no open team-mate >=2 m ahead <=22 m
//  noFwdAny[z]  (same) no team-mate at all >=5 m ahead <=22 m, open or not
//  opt[z]       [sum open options ahead, level, behind, ahead with lane open]
//  jobs[z]      {purpose: [samples, behind the ball, marked <2.5 m, lane closed, any of the three, ahead+open+lane]}
//               every outfield team-mate of the carrier at every sample; purpose = the job's purpose, else 'duty:<kind>'
//               (laptop sensitivity rows also carry [6] = marked or lane closed, behind or not)
//  prog         [own->mid starts, reached mid, sum s to reach, lost before, restart/end before,
//                mid->final starts, reached final, sum s, lost before, restart/end before]
//               a start = the first owned frame of a spell in that zone (own third / middle); reached = first owned frame
//               of the same spell in the next zone up
//  ent[2]       entries into middle / final third: [carry, short ground pass <15 m, long ground >=15 m, loft, clearance, other]
//  dec[z]       carrier decisions (engine choice records with an action): [n, with an open forward option (noFwd false),
//               forward pass/through (gain >=5 m), of those with an option, forward loft/clear (gain >=5), of those with an
//               option, forward carry (gain >=2), shot, sideways/back pass, superseded/unreleased]
//  loss[z]      open-play possession losses (next spell the opponent's, not a restart), by the loss spot's zone:
//               [n, opponent goals within 12 s]
//  ex           worst examples: longest own-third/middle run of consecutive no-forward-option samples
//               [[zone, t0, t1, ended in a loss (1/0), goal against within 12 s (1/0)]], top 2
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {groundPass} from '../../src/practice-passing';
export {armTreatment};

const L=48,DT=.25,OPEN=2.5,REACH=22,AHEAD=5,LANE=.42;
export function extra(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const depth=(s:number,x:number)=>s===0?x:L-x;
 const zone=(d:number)=>d<16?0:d<32?1:2;
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const jobsBy=new Map<number,any[]>();
 for(const ch of choices){const a=jobsBy.get(ch.player)??[];a.push(ch);jobsBy.set(ch.player,a);}
 const purposeAt=(i:number,time:number):string=>{const a=jobsBy.get(i);if(!a)return 'none';let lo=0,hi=a.length-1,best=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}
  const c=best>=0?a[best]:null;return c?(c.assignment?.purpose??('duty:'+c.kind)):'none';};
 const ownerOf=(f:any)=>f.restart?null:(f.ball?.owner??null);
 // a live copy of roster player i at frame f (roster pace/acceleration/skills/traits; frame pose)
 const live=(f:any,i:number)=>{const q=pos(f,i);return q?{...roster[i],x:q.x,y:q.y,vx:q.vx,vy:q.vy,angle:q.angle,energy:q.energy}:null;};

 const z3=()=>[0,0,0];
 const mk=()=>({n:z3(),noFwd:z3(),noFwdLane:z3(),noFwd2:z3(),noFwdAny:z3(),opt:[[0,0,0,0],[0,0,0,0],[0,0,0,0]],jobs:[{},{},{}] as Record<string,number[]>[],
  prog:[0,0,0,0,0,0,0,0,0,0],ent:[[0,0,0,0,0,0],[0,0,0,0,0,0]],dec:[0,1,2].map(()=>[0,0,0,0,0,0,0,0,0,0]),loss:[[0,0],[0,0],[0,0]],ex:[] as number[][],
  circ:[[0,0,0,0,0,0],[0,0,0,0,0,0]],gk:[0,0],evk:{} as Record<string,number>,fs:[0,0,0,0,0,0,0,0]});
 const A=[mk(),mk()];
 const goals=events.filter((e:any)=>e.kind==='goal'&&(e.side===0||e.side===1));
 const goalWithin=(side:number,t:number,w:number)=>goals.some((g:any)=>g.side===side&&g.time>=t-1e-6&&g.time<=t+w)?1:0;

 // per-sample read of the carrier's situation (memoised by frame index; decisions reuse it)
 const memo=new Map<number,{s:number;z:number;fwd:boolean;fwdLane:boolean}|null>();
 const read=(k:number,acc:boolean)=>{
  if(!acc&&memo.has(k))return memo.get(k)!;
  const f=frames[k],o=ownerOf(f);if(!o){memo.set(k,null);return null;}
  const s=sideOf(o);if(s<0){memo.set(k,null);return null;}
  const ci=idx.get(o)!,D=1-s,bd=depth(s,f.ball.x),z=zone(bd),bx=f.ball.x,by=f.ball.y;
  const carrier=live(f,ci);if(!carrier){memo.set(k,null);return null;}
  const oppAll:any[]=[],oppOut:any[]=[];
  roster.forEach((p:any,i:number)=>{if(p.side!==D)return;const q=live(f,i);if(!q)return;oppAll.push(q);if(p.role!=='GK')oppOut.push(q);});
  const a=A[s];let fwd=false,fwdLane=false,fwd2=false,fwdAny=false;const cnt=[0,0,0,0];
  for(let i=0;i<roster.length;i++){
   const p=roster[i];if(p.side!==s||p.role==='GK'||i===ci)continue;const q=live(f,i);if(!q)continue;
   const qd=depth(s,q.x),rel=qd-bd,dBall=Math.hypot(q.x-bx,q.y-by);
   const marked=oppOut.some(d=>Math.hypot(d.x-q.x,d.y-q.y)<OPEN);
   let laneOpen:boolean|null=null;
   const lane=()=>{if(laneOpen===null){try{laneOpen=groundPass(carrier,q,false,undefined,{x:bx,y:by},oppAll).risk<=LANE;}catch{laneOpen=false;}}return laneOpen;};
   const option=!marked&&dBall<=REACH;
   if(option&&rel>=2)fwd2=true;if(dBall<=REACH&&rel>=AHEAD)fwdAny=true;
   if(option){
    if(rel>=AHEAD){cnt[0]++;fwd=true;if(lane()){cnt[3]++;fwdLane=true;}}
    else if(rel>-2)cnt[1]++;else cnt[2]++;
   }
   if(acc){
    const pu=purposeAt(i,f.time),jb=(a.jobs[z][pu]??=[0,0,0,0,0,0,0]);
    const behind=rel<=-2,closed=!lane();
    jb[0]++;if(behind)jb[1]++;if(marked)jb[2]++;if(closed)jb[3]++;if(behind||marked||closed)jb[4]++;if(rel>=AHEAD&&!marked&&!closed)jb[5]++;if(marked||closed)jb[6]++;
   }
  }
  if(acc){a.n[z]++;if(!fwd)a.noFwd[z]++;if(!fwdLane)a.noFwdLane[z]++;if(!fwd2)a.noFwd2[z]++;if(!fwdAny)a.noFwdAny[z]++;for(let j=0;j<4;j++)a.opt[z][j]+=cnt[j];}
  const r={s,z,fwd,fwdLane};memo.set(k,r);return r;
 };

 // ---- sampled frames, plus no-forward-option runs (examples)
 let next=0;const run:({s:number;z:number;t0:number;t1:number}|null)[]=[null,null];
 const runs:{s:number;z:number;t0:number;t1:number}[]=[];
 const closeRun=(s:number)=>{const r=run[s];if(r&&r.t1-r.t0>=2)runs.push(r);run[s]=null;};
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.time<next-1e-9)continue;next=f.time+DT;
  const r=ownerOf(f)?read(k,true):null;
  for(const s of [0,1]){
   if(r&&r.s===s&&!r.fwd&&r.z<2){if(run[s]&&run[s]!.z===r.z)run[s]!.t1=f.time;else{closeRun(s);run[s]={s,z:r.z,t0:f.time,t1:f.time};}}
   else if(!(r===null&&!frames[k].restart&&run[s]))closeRun(s);// a loose/flight frame keeps the run open
  }
 }
 closeRun(0);closeRun(1);

 // ---- spells: possession by last owner (a restart counts for its side), as deep.ts
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=ownerOf(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 type Sp={s:number;k0:number;k1:number;end:string};const spells:Sp[]=[];
 for(let k=0;k<n;){const s=poss[k];let j=k;while(j+1<n&&poss[j+1]===s)j++;if(s>=0)spells.push({s,k0:k,k1:j,end:''});k=j+1;}
 for(let q=0;q<spells.length;q++){const nx=spells[q+1];spells[q].end=!nx?'end':frames[nx.k0].restart?'restart':'lost';}
 const lastEventBefore=(s:number,t0:number,t1:number)=>{for(let e=events.length-1;e>=0;e--){const x=events[e];if(x.time>t1+1e-6)continue;if(x.time<t0-1e-6)break;
  if((x.kind==='pass'||x.kind==='clearance')&&sideOf(x.actor)===s)return x;}return null;};
 for(const sp of spells){
  const s=sp.s,a=A[s];
  const owned:number[]=[];for(let k=sp.k0;k<=sp.k1;k++){const o=ownerOf(frames[k]);if(o&&sideOf(o)===s)owned.push(k);}
  if(!owned.length)continue;
  // progression clocks
  for(const [from,base] of [[0,0],[1,5]] as const){
   let start=-1,reached=-1;
   for(const k of owned){const z=zone(depth(s,frames[k].ball.x));if(start<0&&z===from)start=k;if(start>=0&&z>from){reached=k;break;}}
   if(start<0)continue;a.prog[base]++;
   if(reached>=0){a.prog[base+1]++;a.prog[base+2]+=frames[reached].time-frames[start].time;}
   else if(sp.end==='lost')a.prog[base+3]++;else a.prog[base+4]++;
  }
  // entries: an owned frame in a higher zone right after an owned frame below it (same spell)
  for(let q=1;q<owned.length;q++){
   const k0=owned[q-1],k1=owned[q],z0=zone(depth(s,frames[k0].ball.x)),z1=zone(depth(s,frames[k1].ball.x));
   for(const target of [1,2])if(z0<target&&z1>=target){
    let cat=5;
    if(ownerOf(frames[k0])===ownerOf(frames[k1])&&frames[k1].time-frames[k0].time<=.35)cat=0;
    else{const e=lastEventBefore(s,frames[k0].time-.05,frames[k1].time);
     if(e){if(e.kind==='clearance')cat=4;else if(e.aerial)cat=3;else{const p=pos(frames[frameAt(e.time)],idx.get(e.actor)!),aim=e.pass?.aim;cat=p&&aim&&Math.hypot(aim.x-p.x,aim.y-p.y)>=15?2:1;}}
     else if(ownerOf(frames[k0])===ownerOf(frames[k1]))cat=0;}
    a.ent[target-1][cat]++;
   }
  }
  // losses
  if(sp.end==='lost'){const nx=frames[sp.k1+1],lz=zone(depth(s,nx.ball.x));a.loss[lz][0]++;a.loss[lz][1]+=goalWithin(1-s,nx.time,12);}
 }
 // examples: the longest two no-forward runs per side, own third or middle, with how they ended
 for(const s of [0,1]){
  const mine=runs.filter(r=>r.s===s).sort((x,y)=>(y.t1-y.t0)-(x.t1-x.t0)).slice(0,2);
  for(const r of mine){const sp=spells.find(q=>q.s===s&&frames[q.k0].time<=r.t1+1e-6&&frames[q.k1].time>=r.t1-1e-6);
   const lost=sp&&sp.end==='lost'&&frames[sp.k1].time-r.t1<3?1:0,g=lost?goalWithin(1-s,frames[sp!.k1].time,12):0;
   A[s].ex.push([r.z,Math.round(r.t0*100)/100,Math.round(r.t1*100)/100,lost,g]);}
 }

 // ---- carrier decisions
 const byActor=new Map<string,any[]>();
 for(const e of events)if((e.kind==='pass'||e.kind==='clearance')&&e.actor){const a=byActor.get(e.actor)??[];a.push(e);byActor.set(e.actor,a);}
 const nextOwnChoice=(i:number,t:number)=>{const a=jobsBy.get(i)!;for(const c of a)if(c.time>t+1e-6&&c.action)return c.time;return Infinity;};
 for(const c of choices){
  if(!c.action)continue;const k=frameAt(c.time),f=frames[k],o=ownerOf(f);const p=roster[c.player];
  if(!o||o!==p.id)continue;const r=read(k,false);if(!r)continue;const s=r.s,d=A[s].dec[r.z],bd=depth(s,f.ball.x);
  d[0]++;if(r.fwd)d[1]++;
  if(c.action==='shoot'){d[7]++;continue;}
  if(c.action==='carry'||c.action==='feint'){if(c.action==='carry'&&c.carry?.aim&&depth(s,c.carry.aim.x)-bd>=2)d[6]++;continue;}
  const until=Math.min(nextOwnChoice(c.player,c.time),c.time+3);
  const e=(byActor.get(p.id)??[]).find(x=>x.time>=c.time-1e-6&&x.time<=until+1e-6);
  if(!e){d[9]++;continue;}
  const aim=e.pass?.aim??e.aerial?.aim;if(!aim){d[9]++;continue;}
  const gain=depth(s,aim.x)-bd;
  if(gain>=5){if(e.kind==='clearance'||e.aerial){d[4]++;if(r.fwd)d[5]++;}else{d[2]++;if(r.fwd)d[3]++;}}
  else d[8]++;
 }
 // ---- (support-proto) circulation payoff, passes to our keeper, event kinds
 // circ[z] (passer's zone 0/1): side or back passes (open play, outfield passer, aim gains < 2 m):
 //   [n, an open forward option in the 3 s before the pass (any 0.25 s owned sample), within 3 s after it (until a loss),
 //    the same two with an open lane, an open forward option at the release]
 // gk [open-play passes from an outfield team-mate received by our keeper, all receptions by our keeper]
 const ownedFwd=(s:number,t0:number,t1:number,stopOnLoss:boolean)=>{let any=0,lane=0;
  for(let k=frameAt(t0);k<n&&frames[k].time<=t1+1e-6;k++){const f=frames[k];if(f.time<t0-1e-6)continue;
   if(Math.abs((f.time-t0)/DT-Math.round((f.time-t0)/DT))>.21)continue;
   const o=ownerOf(f);if(!o)continue;const os=sideOf(o);if(os!==s){if(stopOnLoss)break;continue;}
   const r=read(k,false);if(!r)continue;if(r.fwd)any=1;if(r.fwdLane)lane=1;if(any&&lane)break;}
  return [any,lane];};
 for(const e of events){
  if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const s=e.side,pi=idx.get(e.actor);if(pi===undefined||roster[pi].role==='GK')continue;
  const f=frames[frameAt(e.time)],p=pos(f,pi),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const from=depth(s,p.x),z=zone(from);if(z>1||depth(s,aim.x)-from>=2)continue;
  let k0=frameAt(e.time);while(k0>0&&!ownerOf(frames[k0])&&frames[k0].time>e.time-.3)k0--;
  const at=ownerOf(frames[k0])?read(k0,false):null;
  const b=ownedFwd(s,e.time-3,e.time-.01,false),a=ownedFwd(s,e.time+.25,e.time+3.25,true),c=A[s].circ[z];
  c[0]++;c[1]+=b[0];c[2]+=a[0];c[3]+=b[1];c[4]+=a[1];if(at&&at.s===s&&at.fwd)c[5]++;
 }
 for(let q=0;q<events.length;q++){const e=events[q];if(e.kind!=='receive')continue;const ri=idx.get(e.actor);if(ri===undefined||roster[ri].role!=='GK')continue;
  const s=roster[ri].side;A[s].gk[1]++;
  for(let r=q-1;r>=0&&events[r].time>e.time-4;r--){const x=events[r];if(x.kind==='pass'||x.kind==='clearance'){const xi=idx.get(x.actor);if(x.kind==='pass'&&!x.restartKind&&xi!==undefined&&roster[xi].side===s&&roster[xi].role!=='GK')A[s].gk[0]++;break;}}}
 // fs (free-support failure signs, own + middle thirds; 0.25 s samples with a carrier):
 //   [free player-samples, aim >=5 m ahead of the ball, aim level (-2..5), aim behind, pair-samples with two free aims
 //    within 3 m, such pair runs lasting > 1 s, free target jumps (a new free target > 3 m from the previous one within 1 s),
 //    free player-seconds]
 {const live=(i:number,t:number)=>{const a=jobsBy.get(i);if(!a)return null;let c=null;for(const x of a){if(x.time>t+1e-6)break;c=x;}return c&&c.assignment?.purpose==='free'&&c.assignment.until>=t-1e-6?c.assignment.aim:null;};
  const runs=new Map<string,number>();let nx=0;
  for(let k=0;k<n;k++){const f=frames[k];if(f.time<nx-1e-9)continue;nx=f.time+DT;const o=ownerOf(f);if(!o)continue;const s=sideOf(o);if(s<0)continue;
   const bd=depth(s,f.ball.x);if(zone(bd)>1)continue;const fs=A[s].fs,aims:[number,any][]=[];
   roster.forEach((p:any,i:number)=>{if(p.side!==s||p.id===o||p.role==='GK')return;const a=live(i,f.time);if(!a)return;aims.push([i,a]);fs[0]++;fs[7]+=DT;const rel=depth(s,a.x)-bd;if(rel>=5)fs[1]++;else if(rel>-2)fs[2]++;else fs[3]++;});
   const seen=new Set<string>();
   for(let x=0;x<aims.length;x++)for(let y=x+1;y<aims.length;y++){const key=s+':'+aims[x][0]+':'+aims[y][0];if(Math.hypot(aims[x][1].x-aims[y][1].x,aims[x][1].y-aims[y][1].y)<3){fs[4]++;seen.add(key);const r=(runs.get(key)??0)+DT;runs.set(key,r);if(r>1+1e-6&&r-DT<=1+1e-6)fs[5]++;}}
   for(const key of [...runs.keys()])if(!seen.has(key)&&key.startsWith(s+':'))runs.delete(key);
  }
  for(const [i,a] of jobsBy){let prev:any=null;const s=roster[i].side;for(const c of a){if(c.assignment?.purpose!=='free'){prev=null;continue;}
   if(prev&&c.time-prev.time<1&&Math.hypot(c.assignment.aim.x-prev.assignment.aim.x,c.assignment.aim.y-prev.assignment.aim.y)>3)A[s].fs[6]++;prev=c;}}
 }
 for(const e of events){if(e.side!==0&&e.side!==1)continue;const k=A[e.side].evk;k[e.kind]=(k[e.kind]??0)+1;}
 const r2=(v:number)=>Math.round(v*100)/100;
 for(const a of A)a.prog[2]=r2(a.prog[2]),a.prog[7]=r2(a.prog[7]);
 return A;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){return deepPlay(t,R=>extra(R));}
