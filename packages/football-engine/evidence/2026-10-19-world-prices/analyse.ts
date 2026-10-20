// World prices (2026-10-19): analyse() turns one recorded match (PracticeResult + what hook.mjs saw) into a wp row.
// Pure: imports nothing from the engine, so laptop development re-runs it on a dumped match without playing one.
// The row layout is documented in wp.ts.
const L=48;
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const depthOf=(s:number,x:number)=>s===0?x:L-x;
export const RK=['kickoff','goalKick','throw','freeKick','indirect','corner','penalty'];
export const DUTIES=['hold','support','run','show','width','press','jockey','challenge','block','track','cover','intercept','recover','carry','prepare','receive','feint','wrongfoot','keeper','dive','sweep','restart','down'];
const roleCode=(r:string)=>r==='GK'?0:['CB','FB','DM','DEF'].includes(r)?1:r==='ST'?3:2;
export const PASSY=new Set(['pass','through','loft']);

export function analyse(R:any,dec:any[],tks:any[],chanceList:[number,number][],opt:{eps?:boolean}={}){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,n=frames.length;
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const roleOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].role:'';
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const evIdxAt=(time:number)=>{let lo=0,hi=events.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(events[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best;};
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const ctrlOf=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const ownerOf=(f:any)=>f.restart?null:(f.ball?.owner??null);
 const outIdx=(s:number)=>roster.map((p:any,i:number)=>({p,i})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i);
 const gkIdx=(s:number)=>roster.map((p:any,i:number)=>({p,i})).filter(x=>x.p.side===s&&x.p.role==='GK').map(x=>x.i);
 const OUT=[outIdx(0),outIdx(1)],GKS=[gkIdx(0),gkIdx(1)];
 const posId=(f:any,id:string)=>{const i=idx.get(id);return i===undefined?null:pos(f,i);};
 const nearest=(f:any,s:number,at:{x:number;y:number},skip?:string)=>{let best=99;for(const i of OUT[s]){if(roster[i].id===skip)continue;const p=pos(f,i);if(p){const d=dist(p,at);if(d<best)best=d;}}return best;};
 const within=(f:any,s:number,at:{x:number;y:number},r:number,skip?:string)=>{let c=0;for(const i of OUT[s]){if(roster[i].id===skip)continue;const p=pos(f,i);if(p&&dist(p,at)<r)c++;}return c;};
 const goalSide=(f:any,s:number,ballX:number)=>{const bd=depthOf(s,ballX);let c=0;for(const i of OUT[s]){const p=pos(f,i);if(p&&depthOf(s,p.x)<bd)c++;}return c;};

 // ---- in-play time
 let inPlay=0;
 for(let k=0;k+1<n;k++){const f=frames[k],g=frames[k+1],dt=g.time-f.time;if(dt>0&&dt<1&&!f.restart&&!g.restart&&!g.cut)inPlay+=dt;}

 // ---- possession spells (the audit's rule)
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=ctrlOf(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 type Sp={s:number;k0:number;k1:number;t0:number;t1:number;start:number;how:number;rk:string;end:number;passes:number;shots:number[];goals:number[];nl:number;nw:number};
 const spells:Sp[]=[];
 for(let k=0;k<n;){
  const s=poss[k];let j=k;while(j+1<n&&poss[j+1]===s)j++;
  if(s>=0){
   const f=frames[k];let start=1,how=4,rk='';
   if(k===0){start=2;how=-1;rk='kickoff';}
   else if(f.restart&&f.restartInfo){start=0;how=-1;rk=f.restartInfo.kind??'';}
   else{
    const prevT=spells.length?spells[spells.length-1].t0:0;
    for(let e=evIdxAt(f.time);e>=0&&events[e].time>=prevT-1e-6&&events[e].time>f.time-3;e--){
     const x=events[e];
     if(x.kind==='save'&&x.side===s){how=3;break;}
     if(x.kind==='tackle'&&x.side===s&&f.time-x.time<2){how=0;break;}
     if(x.side===1-s&&x.kind==='pass'){how=1;break;}
     if(x.side===1-s&&(x.kind==='clearance'||x.kind==='shot')){how=2;break;}
    }
    if(how===4){for(let q=k-1;q>=0&&q>k-30;q--){if(frames[q].ball?.mode==='loose'){how=2;break;}if(ownerOf(frames[q]))break;}}
   }
   spells.push({s,k0:k,k1:j,t0:f.time,t1:frames[j].time,start,how,rk,end:2,passes:0,shots:[],goals:[],nl:-1,nw:-1});
  }
  k=j+1;
 }
 for(let q=0;q<spells.length;q++){
  const sp=spells[q],nx=spells[q+1];
  if(!nx){sp.end=2;continue;}
  if(frames[nx.k0].restart){sp.end=1;continue;}
  sp.end=0;sp.t1=frames[nx.k0].time;
  const f=frames[nx.k0],b=f.ball;let nl=0,nw=0;
  for(const i of OUT[sp.s]){const p=pos(f,i);if(p&&dist(p,b)<8)nl++;}
  for(const i of OUT[1-sp.s]){const p=pos(f,i);if(p&&dist(p,b)<8)nw++;}
  sp.nl=nl;sp.nw=nw;
 }
 const spellIx=(time:number,s:number)=>{for(let q=spells.length-1;q>=0;q--){const sp=spells[q];if(sp.t0<=time+1e-6)return sp.s===s?q:-1;}return -1;};

 // ---- shots and goals
 const chanceAt=new Map<number,number>();for(const [t,v] of chanceList)chanceAt.set(t,v);
 const chanceOf=(e:any)=>{const tt=Math.round(e.time*1000);for(const d of [0,1,-1,2,-2]){const v=chanceAt.get(tt+d);if(v!==undefined)return v;}return 0;};
 const shotEv=events.filter((e:any)=>e.kind==='shot'&&(e.side===0||e.side===1));
 const scoredT=new Set<number>(),goalTimes:[number,number][]=[];
 for(const g of events)if(g.kind==='goal'&&(g.side===0||g.side===1)){goalTimes.push([g.side,g.time]);for(let k=shotEv.length-1;k>=0;k--){const x=shotEv[k];if(x.time>g.time+1e-6)continue;if(x.time<g.time-4)break;if(x.side===g.side){scoredT.add(x.time);break;}}}
 const sh:any[]=[];
 for(const e of shotEv){
  const q=spellIx(e.time,e.side),goal=scoredT.has(e.time)?1:0,f=frames[frameAt(e.time)],sp=q>=0?spells[q]:null;
  const o=e.shot?.origin??f.ball,gx=e.side===0?L:0;
  const a=posId(f,e.actor)??o;
  sh.push([e.side,r1(e.time),r3(chanceOf(e)),goal,q,r1(Math.abs(gx-o.x)),r1(Math.hypot(gx-o.x,o.y)),r1(nearest(f,1-e.side,a)),sp?r1(e.time-sp.t0):-1,sp?sp.start:-1,sp&&sp.start!==1?RK.indexOf(sp.rk):-1,sp&&sp.start===1?sp.how:-1]);
  if(sp){sp.shots.push(e.time-sp.t0);if(goal)sp.goals.push(e.time-sp.t0);}
 }

 // ---- decisions by player, in time order
 const decBy=new Map<string,any[]>();for(const d of dec){const a=decBy.get(d[1])??[];a.push(d);decBy.set(d[1],a);}
 const decAt=(id:string,time:number,before=true)=>{const a=decBy.get(id);if(!a)return null;let best:any=null;for(const d of a){if(before?d[0]<=time+1e-6:d[0]>=time-1e-6){if(before)best=d;else return d;}else if(!before)continue;else break;}return best;};
 const ch=[[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
 for(const d of dec){const s=sideOf(d[1]);if(s<0||d[8])continue;const c=ch[s];c[0]++;if(PASSY.has(d[2])){c[1]++;if(d[4]>=.3){c[2]++;if(d[7]>=0&&d[7]<.15)c[3]++;}c[4]+=Math.max(0,d[4]);}else if(d[2]==='carry')c[5]++;else if(d[2]==='shoot')c[6]++;else if(d[2]==='clear')c[7]++;}
 for(const c of ch)c[4]=r1(c[4]);

 // ---- passes per spell
 for(const e of events){if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;const sq=spellIx(e.time,e.side);if(sq>=0)spells[sq].passes++;}

 // ---- ownership runs: who owned the ball from when (feet or hands), for time on the ball
 const ownSince=new Float64Array(n),ownFromPass=new Uint8Array(n);
 {let o:any=null,t0=0,fromPass=0;for(let k=0;k<n;k++){const w=ownerOf(frames[k]);if(w!==o){o=w;t0=frames[k].time;
   // did he get it from a team-mate's pass? (the last pass event before, by his side, within 4 s, no other owner between)
   fromPass=0;if(w){const e0=evIdxAt(frames[k].time);for(let e=e0;e>=0&&events[e].time>frames[k].time-4;e--){const x=events[e];if(x.kind==='pass'&&x.side===sideOf(w)&&x.actor!==w){fromPass=1;break;}if(['tackle','turnover','save','restart','clearance','shot'].includes(x.kind)&&x.actor!==w)break;}}}
  ownSince[k]=t0;ownFromPass[k]=fromPass;}}

 // ---- losses
 const ls:any[]=[],lossOfSpell=new Map<number,number>();
 for(let q=0;q+1<spells.length;q++){
  const A=spells[q];if(A.end!==0)continue;const B=spells[q+1],a=A.s,b=1-a,kB=B.k0,fB=frames[kB],tB=fB.time;
  // the last frame A owned it
  let kL=-1;for(let k=kB-1;k>=A.k0;k--){const o=ownerOf(frames[k]);if(o&&sideOf(o)===a){kL=k;break;}}
  let lastA=kL>=0?ownerOf(frames[kL]):null;
  const fL=kL>=0?frames[kL]:frames[Math.max(A.k0,kB-1)];
  const tLeave=kL>=0&&kL+1<n?frames[kL+1].time:tB;
  // what lastA did as it left him
  let act=0,kick:any=null;
  // nobody of A owned it in open play (a restart kick straight to B): the last kick of A's spell
  if(!lastA){for(let e=evIdxAt(tB+.02);e>=0&&events[e].time>=A.t0-.05;e--){const x=events[e];if(x.side===a&&['pass','clearance','shot'].includes(x.kind)){kick=x;lastA=x.actor;break;}}}
  else{for(let e=evIdxAt(tLeave+.05);e>=0&&events[e].time>=fL.time-.2;e--){const x=events[e];if(x.actor===lastA&&['pass','clearance','shot'].includes(x.kind)){kick=x;break;}}}
  if(kick)act=kick.kind==='shot'?4:kick.kind==='clearance'?3:kick.aerial?2:1;
  const tRel=kick?kick.time:tLeave;
  const fR=frames[frameAt(tRel)];
  const pA=lastA?posId(fR,lastA)??fR.ball:fR.ball;
  const hold=kL>=0?r2(tRel-ownSince[kL]):-1;
  const fromPass=kL>=0?ownFromPass[kL]:0;
  // pass details
  let plen=-1,pgain=-1,rcvNear=-1;
  if(kick&&(act===1||act===2)){const aim=kick.pass?.aim??kick.aerial?.aim;if(aim){plen=r1(dist(pA,aim));pgain=r1(depthOf(a,aim.x)-depthOf(a,pA.x));}
   if(kick.target){const rp=posId(fR,kick.target);if(rp)rcvNear=r1(nearest(fR,b,rp));}}
  // the choice that led to it (hook): his last choice before the release/loss
  const d=lastA?decAt(lastA,tRel):null;
  const dRisk=d&&PASSY.has(d[2])?r3(d[4]):-1,dScore=d?r3(d[3]):-9,dBest=d?r3(d[6]):-9,dLow=d?r3(d[7]):-1,hurried=d?d[5]:0;
  // how B got it
  const prevF=frames[Math.max(0,kB-1)];
  let win=1;
  const bOwner=ctrlOf(fB);
  const evB=(()=>{for(let e=evIdxAt(tB+.02);e>=0&&events[e].time>=tB-.25;e--){const x=events[e];if((x.kind==='save'||x.kind==='turnover'||x.kind==='receive')&&x.actor===bOwner)return x;}return null;})();
  if(evB?.kind==='save')win=3;else if(prevF.ball?.mode==='pass'||prevF.ball?.mode==='shot')win=0;else if(ownerOf(prevF)&&sideOf(ownerOf(prevF))===a)win=2;else win=1;
  // class
  let cls=9;
  const tackleOn=(()=>{for(let e=evIdxAt(tB+.02);e>=0&&events[e].time>=fL.time-.25;e--){const x=events[e];if(x.kind==='tackle'&&x.target===lastA&&sideOf(x.actor)===b)return x;}return null;})();
  if(lastA&&roleOf(lastA)==='GK'&&act!==4)cls=8;
  else if(act===4)cls=7;else if(act===3)cls=6;
  else if(act===1||act===2){cls=win===0?0:1;}
  else if(lastA){
   const short=hold>=0&&hold<1&&fromPass;
   cls=tackleOn?(short?3:4):(short?2:5);
  }
  // decision of B's controller and his time on the ball
  let bHold=-1,bFirst=0;
  if(bOwner){
   const d2=decAt(bOwner,tB,false);
   if(d2&&d2[0]<B.t1+.05){bFirst=PASSY.has(d2[2])?1:d2[2]==='carry'?2:d2[2]==='shoot'?3:d2[2]==='clear'?4:d2[2]==='feint'?5:0;}
   for(let k=kB;k<n&&k<=B.k1+1;k++){const o=ownerOf(frames[k]);if(o!==bOwner){bHold=r2(frames[k].time-tB);break;}}
  }
  // B controller's surroundings
  const pB=bOwner?posId(fB,bOwner)??fB.ball:fB.ball;
  let mateNear=99,mates8=0,open15=0;
  for(const i of OUT[b]){if(roster[i].id===bOwner)continue;const p=pos(fB,i);if(!p)continue;const dd=dist(p,pB);if(dd<mateNear)mateNear=dd;if(dd<8)mates8++;if(dd<15&&nearest(fB,a,p)>=2.5)open15++;}
  // rest defence at B control and after
  const gs0=goalSide(fB,a,fB.ball.x),bAhead=(()=>{const bd=depthOf(a,fB.ball.x);let c=0;for(const i of OUT[b]){const p=pos(fB,i);if(p&&depthOf(a,p.x)<bd)c++;}return c;})();
  const later=(dt:number)=>{const k=frameAt(tB+dt);if(k>B.k1||frames[k].restart||k>=n)return -1;return goalSide(frames[k],a,frames[k].ball.x);};
  const gk=GKS[a].map(i=>pos(fB,i)).find(Boolean);
  const rec=[a,r2(tB),cls,r1(depthOf(a,(kick?.shot?.origin??fR.ball).x)),lastA?roleCode(roleOf(lastA)):-1,hold,act,plen,pgain,r1(nearest(fR,b,pA)),within(fR,b,pA,3),dRisk,dScore,dBest,dLow,hurried,rcvNear,win,r2(tB-tRel),B.nl===undefined?-1:A.nl,A.nw,-1,0,gs0,bAhead,later(2),later(4),
   B.shots.some(t=>t<=10)?1:0,B.goals.some(t=>t<=10)?1:0,r1(mateNear),mates8,open15,within(fB,a,pB,3),bOwner?roleCode(roleOf(bOwner)):-1,r1(depthOf(b,fB.ball.x)),bHold,bFirst,r1(B.t1-B.t0),gk?r1(depthOf(a,gk.x)):-1,
   d?(PASSY.has(d[2])?1:d[2]==='carry'?2:d[2]==='shoot'?3:d[2]==='clear'?4:d[2]==='feint'?5:0):0,d?r2(tRel-d[0]):-1,(()=>{const p=lastA?posId(fL,lastA):null;return p?r1(Math.hypot(p.vx,p.vy)):-1;})()];
  lossOfSpell.set(q,ls.length);ls.push(rec);
 }
 // links: B's own loss within 5 s of its control
 for(let q=0;q+1<spells.length;q++){const li=lossOfSpell.get(q);if(li===undefined)continue;const lj=lossOfSpell.get(q+1);if(lj===undefined)continue;
  if(ls[lj][1]-ls[li][1]<=5){ls[li][21]=lj;ls[li][22]=spells[q+1].passes;}}

 // ---- restarts
 const rs:any[]=[],rsWin:any[]=[];
 for(let k=0;k<n;){
  const f=frames[k];if(!f.restart||!f.restartInfo){k++;continue;}
  let j=k;while(j+1<n&&frames[j+1].restart)j++;
  const info=f.restartInfo,s=info.side,tStart=f.time,tTaken=j+1<n?frames[j+1].time:f.time;
  const spot=info.spot??f.ball;
  let shot=0,goal=0,other=0,kept=1,first=0,tgt=-1;
  for(const x of shotEv)if(x.time>=tTaken-.05&&x.time<=tTaken+10){if(x.side===s)shot=1;}
  for(const [gs,gt] of goalTimes)if(gt>=tTaken-.05&&gt<=tTaken+10){if(gs===s)goal=1;else other=1;}
  for(let q=j+1;q<n&&frames[q].time<=tTaken+5;q++){const g=frames[q];if(g.restart){if(g.restartInfo&&g.restartInfo.side!==s)kept=0;break;}const o=ctrlOf(g);if(o&&sideOf(o)!==s){kept=0;break;}}
  for(let e=evIdxAt(tStart);e<events.length&&events[e].time<=tTaken+.6;e++){const x=events[e];if(x.time<tStart-1e-6)continue;if(x.side===s&&(x.kind==='pass'||x.kind==='shot')){first=x.kind==='shot'?3:x.aerial?2:1;const aim=x.pass?.aim??x.aerial?.aim;if(aim)tgt=r1(depthOf(s,aim.x));break;}}
  rs.push([RK.indexOf(info.kind),s,r1(tStart),r1(tTaken),r1(depthOf(s,spot.x)),r1(Math.abs(spot.y)),shot,goal,kept,first,other,tgt]);
  rsWin.push([k,j]);
  k=j+1;
 }
 // ---- fouls
 const fo:any[]=[];
 for(const e of events){if(e.kind!=='foul')continue;const s=sideOf(e.actor);const src=e.challengeContact?0:/preluare/.test(e.text)?1:/aerian/.test(e.text)?2:/din nou/.test(e.text)?3:4;
  const f=frames[frameAt(e.time)],p=posId(f,e.actor)??f.ball;
  let nk='';for(let k=frameAt(e.time);k<n&&frames[k].time<=e.time+1.5;k++)if(frames[k].restart&&frames[k].restartInfo){nk=frames[k].restartInfo.kind;break;}
  fo.push([r1(e.time),src,s,r1(depthOf(s,p.x)),RK.indexOf(nk)]);}
 const tk=tks.map(x=>[r2(x[0]),x[1],x[2],x[3],x[4],x[5],r3(x[6]),x[7],r2(x[8]),r1(x[9])]);

 // ---- every open-play pass: [side, t, lofted, len, gain, chosen risk (hook, -1), hurried, nearest opposing outfielder to
 //  the passer, to the intended receiver, outcome (0 kept, 1 intercepted in flight, 2 lost loose, 3 restart, 4 kept but the
 //  receiver lost it within 1 s without kicking it), passer depth, intended receiver's job duty code]
 const ps:any[]=[];
 for(const e of events){
  if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const S=e.side,k0=frameAt(e.time),f=frames[k0],p=posId(f,e.actor),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const d=decAt(e.actor,e.time),rp=e.target?posId(f,e.target):null;
  let out=3;
  for(let k=k0+1;k<n&&frames[k].time<=e.time+8;k++){const g=frames[k];if(g.restart){out=3;break;}const o=g.ball?.owner;if(!o||(o===e.actor&&g.time<e.time+.3))continue;
   if(sideOf(o)!==S){out=frames[k-1].ball?.mode==='pass'?1:2;break;}
   out=0;// kept: did he lose it within 1 s without a kick?
   let kick=false;for(let ee=evIdxAt(g.time);ee<events.length&&events[ee].time<=g.time+1.05;ee++){const x=events[ee];if(x.time<g.time-1e-6)continue;if(x.actor===o&&['pass','clearance','shot'].includes(x.kind)){kick=true;break;}}
   if(!kick)for(let q2=k+1;q2<n&&frames[q2].time<=g.time+1;q2++){const h=frames[q2];if(h.restart)break;const o2=ctrlOf(h);if(o2&&sideOf(o2)!==S){out=4;break;}}
   break;}
  ps.push([S,r1(e.time),e.aerial?1:0,r1(dist(p,aim)),r1(depthOf(S,aim.x)-depthOf(S,p.x)),d&&PASSY.has(d[2])?r3(d[4]):-1,d?d[5]:0,r1(nearest(f,1-S,p)),rp?r1(nearest(f,1-S,rp)):-1,out,r1(depthOf(S,p.x)),rp?DUTIES.indexOf(rp.duty):-1]);
 }
 // ---- long balls with contest reads
 const lb:any[]=[];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const S=e.side,f=frames[frameAt(e.time)],p=posId(f,e.actor),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const len=dist(p,aim),from=depthOf(S,p.x),gain=depthOf(S,aim.x)-from;
  if(!(e.aerial||len>=12))continue;
  let cat=5,loose=false,touchNear=-1,touchAim=-1;
  for(let k=frameAt(e.time)+1;k<n&&frames[k].time<=e.time+4;k++){const g=frames[k];if(g.restart){cat=5;break;}const o=g.ball?.owner;
   if(o&&!(o===e.actor&&g.time<e.time+.3)){const w=sideOf(o);cat=loose?(w===S?3:4):(w===S?1:2);
    // contest at the first touch: the nearest outfielder of the side that did NOT get it
    touchNear=r1(nearest(g,1-w,g.ball));touchAim=r1(dist(g.ball,aim));break;}
   if(g.ball?.mode==='loose')loose=true;}
  lb.push([S,e.aerial?1:0,r1(len),r1(from),r1(gain),cat,r1(nearest(f,1-S,aim)),touchNear,touchAim]);
 }

 // ---- rest defence while in possession
 const z3=()=>[0,0,0,0,0,0,0];const rd=[[z3(),z3(),z3()],[z3(),z3(),z3()]];
 {let next=0;for(let k=0;k<n;k++){const f=frames[k];if(f.time<next-1e-9)continue;const o=ownerOf(f);if(!o)continue;const s=sideOf(o);if(s<0||roleOf(o)==='GK')continue;next=f.time+.5;
  const bd=depthOf(s,f.ball.x),z=bd<16?0:bd<32?1:2,r=rd[s][z];let mine=0;for(const i of OUT[s]){if(roster[i].id===o)continue;const p=pos(f,i);if(p&&depthOf(s,p.x)<bd)mine++;}
  r[0]++;r[1]+=mine;r[2+Math.min(3,mine)]++;r[6]+=goalSide(f,1-s,f.ball.x);}}

 // ---- feints (take-ons): [side, t, ball depth, nearest opposing outfielder, outcome: 0 beat him (a 'beat' event within 2 s),
 //  1 kept it 2 s without a beat, 2 lost it in open play within 2 s, 3 restart / other]
 const fe:any[]=[];
 for(const d of dec){if(d[2]!=='feint'||d[8])continue;const s=sideOf(d[1]),k=frameAt(d[0]),f=frames[k],p=posId(f,d[1]);if(!p||s<0)continue;
  let out=1;
  for(let e=evIdxAt(d[0]);e<events.length&&events[e].time<=d[0]+2;e++){const x=events[e];if(x.time<d[0]-1e-6)continue;if(x.kind==='beat'&&x.actor===d[1]){out=0;break;}}
  if(out===1)for(let q2=k+1;q2<n&&frames[q2].time<=d[0]+2;q2++){const h=frames[q2];if(h.restart){out=3;break;}const o=ctrlOf(h);if(o&&sideOf(o)!==s){out=2;break;}}
  fe.push([s,r1(d[0]),r1(depthOf(s,f.ball.x)),r1(nearest(f,1-s,p)),out]);}
 // ---- in-play seconds by ball state [owned (feet or hands), pass flight, loose, shot flight]
 const bm=[0,0,0,0];
 for(let k=0;k+1<n;k++){const f=frames[k],g=frames[k+1],dt=g.time-f.time;if(!(dt>0&&dt<1)||f.restart||g.restart||g.cut)continue;const m=f.ball?.owner?0:f.ball?.mode==='pass'?1:f.ball?.mode==='shot'?3:2;bm[m]+=dt;}
 // ---- distances to the nearest opponent, every 0.5 s of open play with an outfield carrier, defending outfielders by
 //  duty group (0 press/challenge, 1 track, 2 jockey/block/cover/recover, 3 other) and the carrier: counts in bins
 //  [<1, 1-1.65, 1.65-2.5, 2.5-4, 4+] m. md[defending side][group]; md[side][4] = the carrier's nearest defender
 const DG:Record<string,number>={press:0,challenge:0,track:1,jockey:2,block:2,cover:2,recover:2};
 const bin=(d:number)=>d<1?0:d<1.65?1:d<2.5?2:d<4?3:4;
 const md=[0,1].map(()=>[0,1,2,3,4].map(()=>[0,0,0,0,0]));
 {let next=0;for(let k=0;k<n;k++){const f=frames[k];if(f.time<next-1e-9)continue;const o=ownerOf(f);if(!o||roleOf(o)==='GK')continue;const s=sideOf(o);if(s<0)continue;next=f.time+.5;
  const D=1-s;const pc=posId(f,o);if(pc)md[D][4][bin(nearest(f,D,pc))]++;
  for(const i of OUT[D]){const p=pos(f,i);if(!p)continue;let best=99;for(const j of OUT[s]){const q=pos(f,j);if(q){const dd=dist(p,q);if(dd<best)best=dd;}}md[D][DG[p.duty]??3][bin(best)]++;}}}
 // ---- reception duels
 const RO=['clean','forced','loose','nicked','turned','foul'];const rdu=[[0,0,0,0,0,0],[0,0,0,0,0,0]];
 for(const x of R.receptionDuels??[]){const s=sideOf(x.receiver),k=RO.indexOf(x.outcome);if(s>=0&&k>=0)rdu[s][k]++;}

 // ---- render windows (seed 0)
 let eps:any[]|undefined,ro:any[]|undefined;
 if(opt.eps){
  eps=[];ro=roster.map((p:any)=>[p.side,p.role]);
  const pack=(t0:number,t1:number)=>{const out:any[]=[];let lastT=-9;for(let k=frameAt(t0);k<n&&frames[k].time<=t1;k++){const f=frames[k];if(f.time<lastT+.099)continue;lastT=f.time;const ps:any[]=[];
    for(let i=0;i<roster.length;i++){const p=pos(f,i);if(p)ps.push(i,r2(p.x),r2(p.y),r2(p.vx),r2(p.vy),DUTIES.indexOf(p.duty));}
    out.push([r2(f.time),r2(f.ball.x),r2(f.ball.y),r2(f.ball.z),f.ball.owner?idx.get(f.ball.owner)??-1:-1,f.restart?1:0,ps]);}return out;};
  const cap:Record<string,number>={};const add=(kind:string,t:number,t0:number,t1:number,i=-1,j=-1)=>{cap[kind]=(cap[kind]??0)+1;if(cap[kind]>3)return;eps!.push({kind,t:r2(t),i,j,f:pack(t0,t1)});};
  ls.forEach((x,li)=>{
   const lastAId=null;
   if(x[21]>=0&&x[19]<x[20])add('regain-outnumbered',x[1],x[1]-1.5,ls[x[21]][1]+1.5,li,x[21]);
   if(x[2]===2||x[2]===3)add('reception-lost',x[1],x[1]-x[18]-x[5]-1.5,x[1]+1,li);
   if(x[2]===0&&x[9]<2.5)add('intercepted-under-pressure',x[1],x[1]-x[18]-1.5,x[1]+1,li);
   if(x[28])add('transition-goal',x[1],x[1]-1,x[1]+10.5,li);
  });
  rs.forEach((x,ri)=>{if(x[0]===RK.indexOf('corner'))add('corner',x[2],x[3]-1,x[3]+6,ri);if(x[0]===RK.indexOf('throw')&&x[4]>28)add('kick-in-final-third',x[2],x[3]-1,x[3]+6,ri);});
 }

 return {inPlay:r1(inPlay),played:R.played??R.duration,stats:R.stats,
  sp:spells.map(sp=>[sp.s,sp.start,r1(sp.t0),r1(sp.t1-sp.t0),sp.passes,sp.end,r1(depthOf(sp.s,frames[sp.k0].ball.x)),sp.shots.length,sp.goals.length,
   sp.shots.length?r1(sp.shots[0]):-1,sp.goals.length?r1(sp.goals[0]):-1,sp.nl,sp.nw,sp.how,sp.rk]),
  ls,ps,rs,fo,tk,sh,lb,rd,ch,rdu,fe,bm:bm.map(r1),md,...(eps?{eps,ro}:{})};
}
