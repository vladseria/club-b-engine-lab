// Settings audit (2026-10-13): the deep-study row (../2026-10-12-deep-study/deep.ts, unchanged official fields and
// agg) plus `st`, per side, the mechanism each setting's copy talks about. Evidence only; reads the record, changes
// nothing. Sampled every 0.2 s of open play (no restart frames). Depth = metres from the side's own goal (0..48).
//
// st[side] keys (per match, that side; [sum, count] pairs are averaged by the analysis over matches):
//  wb        seconds with the ball (open play, sampled)
//  far       ball wide (|y| > 6) with the ball: [frames, frames with one of ours (not the carrier) beyond 9 m on the far side]
//  spread    with the ball: [sum of our outfield y-spread, frames]; oppSpread: their outfield y-spread at the same frames
//  box       ball >= 32 m with the ball: [sum of our outfielders in their box (depth >= 40, |y| < 8), frames]
//  rest      ball >= 24 m with the ball: [frames, sum of ours >= 4 m goal-side of the ball (carrier excluded), frames with >= 2, >= 1]
//  st        ball >= 24 m with the ball, our striker (role ST; none in 2-2): [frames, sum of striker depth - ball depth,
//            frames in their box, on a shoulder/depth job, on link, on pivot]
//  stBall    passes to our striker / all our open-play passes: [to striker, all]
//  last      their ball: [sum of our last outfielder's depth, frames] with the ball in their half (depth from our goal > 24),
//            lastOwn the same with it in ours, block = our outfield mean depth in their half
//  bw        their ball: [sum of our outfield y-spread, frames]
//  gap       their carrier's nearest outfielder of ours, by the carrier's depth from our goal: [<22, 22-34.6, >34.6],
//            each [sum m, frames]
//  pressS    seconds with one of ours on a press/trap job within 3 m of their carrier (sampled)
//  trap      carrier 22-34.6 m from our goal: [frames, frames with a trap / trap-screen job on]
//  marks     carrier beyond 34.6 m: [frames, sum of ours on mark/press jobs]
//  gk        their ball in their half: [sum of our keeper's depth, frames]; gkMax the furthest he came off without the ball
//  loss      our open-play losses: [n, won back within 5 s, within 8 s, frames-share sum with a counter-press job in the
//            first 5 s, sum of mean outfielders >= 5 m goal-side in the first 3 s, their shots within 12 s while they keep it,
//            their goals within 14 s before we have it again], lossThird [own, middle, attacking]
//  win       our open-play regains: [n, sum of mean break/depth jobs in the first 5 s, sum of ball depth gain at +4 s,
//            n with a first pass within 8 s, sum of that pass's forward gain, kept 8 s (still ours or a shot), sum of
//            outfielders >= 3 m beyond the regain spot at +4 s]
//  sw        open-play passes moving the ball 12 m+ across: [n, kept, our shots within 8 s]
//  wide      open-play passes aimed beyond |y| 7.5: [n, all passes]
//  build     open-play passes from our half (depth < 24): [n, gaining > 13 m, sum of forward gain]
//  fk        free kicks (direct or indirect) taken in their half (spot depth >= 24): [n, played short (ground <= 16 m), into
//            the box (aim depth > 35.66, |y| < 7.5), shot, our shots within 10 s, our goals within 10 s, their shots within
//            15 s, sum of ours in the box at the kick (depth > 40, |y| < 8, taker excluded)]
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
export {armTreatment};

const L=48;
export function extra(R:any){
 const roster:{id:string;side:number;role:string}[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const depth=(s:number,x:number)=>s===0?x:L-x;
 const outIds=[0,1].map(s=>roster.map((p,i)=>({i,p})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i));
 const gkId=[0,1].map(s=>roster.findIndex(p=>p.side===s&&p.role==='GK'));
 const stId=[0,1].map(s=>roster.findIndex(p=>p.side===s&&p.role==='ST'));
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const jobsBy=new Map<number,any[]>();
 for(const ch of choices){const a=jobsBy.get(ch.player)??[];a.push(ch);jobsBy.set(ch.player,a);}
 const purposeAt=(i:number,time:number):string|null=>{const a=jobsBy.get(i);if(!a)return null;let lo=0,hi=a.length-1,best=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best>=0?(a[best].assignment?.purpose??a[best].kind??null):null;};
 // possession per frame: last side in control (a restart counts for its side)
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const ownerOf=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);

 const mk=()=>({wb:0,far:[0,0],spread:[0,0],oppSpread:[0,0],box:[0,0],rest:[0,0,0,0],st:[0,0,0,0,0,0],stBall:[0,0],
  last:[0,0],lastOwn:[0,0],block:[0,0],bw:[0,0],gap:[[0,0],[0,0],[0,0]],pressS:0,trap:[0,0],marks:[0,0],gk:[0,0],gkMax:0,
  loss:[0,0,0,0,0,0,0],lossThird:[0,0,0],win:[0,0,0,0,0,0,0],sw:[0,0,0],wide:[0,0],build:[0,0,0],fk:[0,0,0,0,0,0,0,0]});
 const A=[mk(),mk()];
 const DT=.2;
 // ---- sampled frames
 let next=0;
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.time<next-1e-9)continue;next=f.time+DT;
  if(f.restart||poss[k]<0)continue;
  const P=poss[k],own=ownerOf(f),bx=f.ball.x,by=f.ball.y;
  for(const s of [0,1]){
   const a=A[s],D=1-s,us=outIds[s].map(i=>({i,q:pos(f,i)})).filter(x=>x.q),them=outIds[D].map(i=>({i,q:pos(f,i)})).filter(x=>x.q);
   if(!us.length||!them.length)continue;
   const bd=depth(s,bx),ys=us.map(x=>x.q.y),ty=them.map(x=>x.q.y);
   if(P===s){
    a.wb+=DT;
    a.spread[0]+=Math.max(...ys)-Math.min(...ys);a.spread[1]++;a.oppSpread[0]+=Math.max(...ty)-Math.min(...ty);a.oppSpread[1]++;
    if(Math.abs(by)>6){a.far[0]++;if(us.some(x=>roster[x.i].id!==own&&x.q.y*Math.sign(by)<-9))a.far[1]++;}
    if(bd>=32){a.box[0]+=us.filter(x=>depth(s,x.q.x)>=40&&Math.abs(x.q.y)<8).length;a.box[1]++;}
    if(bd>=24){const r=us.filter(x=>roster[x.i].id!==own&&depth(s,x.q.x)<bd-4).length;a.rest[0]++;a.rest[1]+=r;if(r>=2)a.rest[2]++;if(r>=1)a.rest[3]++;
     const si=stId[s],sq=si>=0?pos(f,si):null;
     if(sq){const j=purposeAt(si,f.time);a.st[0]++;a.st[1]+=depth(s,sq.x)-bd;if(depth(s,sq.x)>=40&&Math.abs(sq.y)<8)a.st[2]++;if(j==='shoulder'||j==='depth')a.st[3]++;if(j==='link')a.st[4]++;if(j==='pivot')a.st[5]++;}}
   }else{
    const dOwn=bd,lastD=Math.min(...us.map(x=>depth(s,x.q.x)));
    if(dOwn>24){a.last[0]+=lastD;a.last[1]++;a.block[0]+=us.reduce((p,x)=>p+depth(s,x.q.x),0)/us.length;a.block[1]++;
     const g=gkId[s]>=0?pos(f,gkId[s]):null;if(g){a.gk[0]+=depth(s,g.x);a.gk[1]++;}}
    else{a.lastOwn[0]+=lastD;a.lastOwn[1]++;}
    a.bw[0]+=Math.max(...ys)-Math.min(...ys);a.bw[1]++;
    const ci=own!=null?idx.get(own):undefined,cq=ci!==undefined&&roster[ci].side===D?pos(f,ci):null;
    if(cq){
     const cd=depth(s,cq.x),z=cd<22?0:cd<34.6?1:2,near=Math.min(...us.map(x=>Math.hypot(x.q.x-cq.x,x.q.y-cq.y)));
     a.gap[z][0]+=near;a.gap[z][1]++;
     const jobs=us.map(x=>({x,j:purposeAt(x.i,f.time)}));
     if(jobs.some(o=>(o.j==='press'||o.j==='trap')&&Math.hypot(o.x.q.x-cq.x,o.x.q.y-cq.y)<3))a.pressS+=DT;
     if(z===1){a.trap[0]++;if(jobs.some(o=>o.j==='trap'||o.j==='trap-screen'))a.trap[1]++;}
     if(z===2){a.marks[0]++;a.marks[1]+=jobs.filter(o=>o.j==='mark'||o.j==='press').length;}
    }
   }
  }
 }
 for(const s of [0,1]){const g=gkId[s];if(g<0)continue;let m=0;for(let k=0;k<n;k+=6){const f=frames[k];if(f.restart||poss[k]===s)continue;const q=pos(f,g);if(q)m=Math.max(m,depth(s,q.x));}A[s].gkMax=m;}

 // ---- possession changes in open play (neither frame a restart)
 const shotsOf=(s:number,from:number,to:number)=>events.filter(e=>e.side===s&&e.kind==='shot'&&e.time>from&&e.time<=to);
 const goalsOf=(s:number,from:number,to:number)=>events.filter(e=>e.side===s&&e.kind==='goal'&&e.time>from&&e.time<=to);
 const changes:{k:number;from:number;to:number}[]=[];
 for(let k=1;k<n;k++)if(poss[k]!==poss[k-1]&&poss[k]>=0&&poss[k-1]>=0&&!frames[k].restart&&!frames[k-1].restart)changes.push({k,from:poss[k-1],to:poss[k]});
 const firstChange=(k:number,side:number)=>{for(let q=k+1;q<n;q++){if(poss[q]===side&&poss[q-1]!==side)return frames[q].time;}return Infinity;};
 const restartAfter=(k:number)=>{for(let q=k+1;q<n;q++)if(frames[q].restart)return frames[q].time;return Infinity;};
 for(const c of changes){
  const t=frames[c.k].time,f0=frames[c.k];
  // loss for c.from
  {const s=c.from,a=A[s],D=1-s;a.loss[0]++;
   const back=firstChange(c.k,s);if(back-t<=5)a.loss[1]++;if(back-t<=8)a.loss[2]++;
   const bd=depth(s,f0.ball.x);a.lossThird[bd<16?0:bd<32?1:2]++;
   let cpF=0,cpN=0,gsS=0,gsN=0;
   for(let q=c.k;q<n&&frames[q].time<=t+5;q+=6){const f=frames[q];if(f.restart)break;cpN++;if(outIds[s].some(i=>purposeAt(i,f.time)==='counter-press'))cpF++;
    if(f.time<=t+3){gsN++;const b=depth(s,f.ball.x);gsS+=outIds[s].filter(i=>{const q2=pos(f,i);return q2&&depth(s,q2.x)<b-5;}).length;}}
   a.loss[3]+=cpN?cpF/cpN:0;a.loss[4]+=gsN?gsS/gsN:0;
   const until=Math.min(t+12,back,restartAfter(c.k)+0.01);
   a.loss[5]+=shotsOf(D,t,until).length;a.loss[6]+=goalsOf(D,t,Math.min(t+14,back)).length;
  }
  // regain for c.to
  {const s=c.to,a=A[s],D=1-s;a.win[0]++;const bd0=depth(s,f0.ball.x);
   let bj=0,bn=0;for(let q=c.k;q<n&&frames[q].time<=t+5;q+=6){const f=frames[q];if(f.restart||poss[q]!==s)break;bn++;const o=ownerOf(f);bj+=outIds[s].filter(i=>roster[i].id!==o&&['break','depth'].includes(purposeAt(i,f.time)??'')).length;}
   a.win[1]+=bn?bj/bn:0;
   const k4=frameAt(t+4),f4=frames[k4];
   if(!f4.restart){a.win[2]+=depth(s,f4.ball.x)-bd0;a.win[6]+=outIds[s].filter(i=>{const q=pos(f4,i);return q&&depth(s,q.x)>bd0+3;}).length;}
   const lost=firstChange(c.k,D);
   const fp=events.find(e=>e.kind==='pass'&&e.side===s&&!e.restartKind&&e.time>=t&&e.time<t+8&&e.time<lost);
   if(fp){const p=pos(frames[frameAt(fp.time)],idx.get(fp.actor)!),aim=fp.pass?.aim??fp.aerial?.aim;if(p&&aim){a.win[3]++;a.win[4]+=depth(s,aim.x)-depth(s,p.x);}}
   if(lost-t>8||shotsOf(s,t,Math.min(t+8,lost)).length)a.win[5]++;
  }
 }
 // ---- passes
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const s=e.side,a=A[s],D=1-s,f=frames[frameAt(e.time)],p=pos(f,idx.get(e.actor)!),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  let kept=0;
  for(let r=q+1;r<events.length&&events[r].time<e.time+8;r++){const x=events[r];
   if(x.kind==='receive'&&x.side===s){kept=1;break;}
   if(x.kind==='turnover'||x.kind==='save'||(x.kind==='tackle'&&x.side===D)||x.kind==='block'||x.kind==='clearance'||x.kind==='out'||x.kind==='offside'||x.kind==='foul')break;}
  a.wide[1]++;if(Math.abs(aim.y)>7.5)a.wide[0]++;
  a.stBall[1]++;if(stId[s]>=0&&e.target===roster[stId[s]].id)a.stBall[0]++;
  if(Math.abs(aim.y-p.y)>=12){a.sw[0]++;a.sw[1]+=kept;const lost=firstChange(frameAt(e.time),D);a.sw[2]+=shotsOf(s,e.time,Math.min(e.time+8,lost)).length;}
  const from=depth(s,p.x),gain=depth(s,aim.x)-from;
  if(from<24){a.build[0]++;if(gain>13)a.build[1]++;a.build[2]+=gain;}
 }
 // ---- free kicks in their half
 for(const e of events){
  if((e.restartKind!=='freeKick'&&e.restartKind!=='indirect')||(e.side!==0&&e.side!==1))continue;
  const s=e.side,a=A[s],D=1-s,spot=e.restartSpot??pos(frames[frameAt(e.time)],idx.get(e.actor)!);if(!spot||depth(s,spot.x)<24)continue;
  a.fk[0]++;
  const aim=e.pass?.aim??e.aerial?.aim;
  if(e.kind==='shot')a.fk[3]++;
  else if(aim){const len=Math.hypot(aim.x-spot.x,aim.y-spot.y);if(!e.aerial&&len<=16)a.fk[1]++;else if(depth(s,aim.x)>35.66&&Math.abs(aim.y)<7.5)a.fk[2]++;}
  a.fk[4]+=shotsOf(s,e.time-.01,e.time+10).length;a.fk[5]+=goalsOf(s,e.time-.01,e.time+12).length;a.fk[6]+=shotsOf(D,e.time,e.time+15).length;
  const f=frames[Math.max(0,frameAt(e.time)-1)];
  a.fk[7]+=outIds[s].filter(i=>{if(roster[i].id===e.actor)return false;const q=pos(f,i);return q&&depth(s,q.x)>40&&Math.abs(q.y)<8;}).length;
 }
 const r2=(v:number)=>Math.round(v*100)/100;
 const rnd=(v:any):any=>Array.isArray(v)?v.map(rnd):typeof v==='number'?r2(v):v;
 return A.map(a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,rnd(v)])));
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){return deepPlay(t,R=>extra(R));}
