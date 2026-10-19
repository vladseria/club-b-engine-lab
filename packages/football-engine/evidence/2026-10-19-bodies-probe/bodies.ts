// Bodies probe (2026-10-19): what solid opponents' bodies change. The `bp` keys of a row, read from the recorded result
// (frames every 0.1 s and at incidents, events, choices, receptionDuels) plus the engine's own separation counters
// (OPPONENT_BODIES.stats, which never enter a result; null on a revision without the flag). Evidence only.
//
// bp = {
//  hash      [length, fnv-a, fnv-b] of JSON.stringify(the whole PracticeResult): the flag-off parity fingerprint
//  sep       what separation did this match: tick-pairs pushed apart and metres (all / with the man on the ball / with a keeper)
//  duel[s]   reception duels where side s DEFENDS: {n, commit, clean, forced, loose, nicked, turned, foul, shield, layoff}
//            shield = forced and he chose to shield (record.layoff false); layoff = forced, chose to lay it off
//  sh[s]     side s's receivers who shielded (duel forced, chose shield), what followed, from the shield:
//            [n, kept 3 s (no possession change within 3 s), kept: next action a pass, kept: next a shot,
//             defender challenged within 2 s (a 'challenge' choice), defender won a tackle on him within 2 s,
//             carrier rode a tackle within 2 s, defender got to the ball side (nearer the ball than the receiver at
//             some 0.1 s frame within 2 s), defender gave up (> 3 m from him at +2 s, no challenge),
//             defender passed THROUGH him (centres < 0.3 m apart at some frame within 2 s)]
//  rd[s]     choices of side s by reason: [defender reads "the ball is screened by the body" (contain/recover reasons),
//            carrier carries to protect it ('protect' purpose)]
//  ov        open-play frames x opponent pairs with centres < 0.3 m (one body through another) and < OPP_GAP 0.55 m;
//            team-mate pairs < 0.3 m for scale
//  jam       opponent pairs nearly motionless in contact: centres < 0.75 m, both < 0.5 m/s, open play, > 1 s: [episodes,
//            seconds]; jam3 those > 3 s; jams[] the first 6 as [t0, t1, i, j] for rendering
//  out       player-frames in open play outside the pitch by > 0.05 m (outfield / keepers), and inside a goal (behind
//            the line within the posts)
//  gk[s]     side s's keeper while the ball is within 16 m of his goal in open play: [frames, frames with an opponent
//            < 0.7 m from him]; at the other side's shots: [shots, sum of his distance off the ball-goal-centre line
//            (m), sum of his depth off the line]
//  pr[s]     side s's press spells (an outfielder's duty press, jockey or challenge while the other side has the ball, same carrier,
//            >= 1 s): [n, never within 1.2 m of the carrier, ended with our ball within 1 s of the spell]
//  loss[s]   side s's open-play possession losses: [after its own pass/clearance/shot (within 4 s), on the ball
//            (dispossessed/ dribble), ...]; intc[s] = side s's passes taken by the other side
//  rs        restarts by kind {kind: [n, seconds from the stop to the restart's kick]}
// }

const L=48,W=30,GH=2.5,OPP=.55;
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const NEXT=['receive','turnover','out','save','goal','shot','pass','clearance','block','tackle','restart'];
const PRESS=['press','jockey','challenge'];
const SCREEN_READ=['Adversarul protejează mingea','Mingea e protejată de corp'],PROTECT='Protejează mingea și caută sprijin';

export function hashResult(R:any){const s=JSON.stringify(R);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];}

export function bpKeys(R:any,hash:number[],sepStats?:any,withEps=false){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices,duels:any[]=R.receptionDuels??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const n=frames.length;
 const fi=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi)>>1;if(frames[m].time<t)lo=m+1;else hi=m;}return lo;};
 const ownerOf=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 // last side in control per frame (a restart counts for its side)
 const poss=new Int8Array(n);{let last=-1;for(let k=0;k<n;k++){const f=frames[k],o=ownerOf(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}}
 const changeWithin=(t:number,side:number,dt:number)=>{for(let k=fi(t);k<n&&frames[k].time<=t+dt;k++)if(poss[k]>=0&&poss[k]!==side)return true;return false;};
 const byPlayer=new Map<number,any[]>();for(const c of choices){const a=byPlayer.get(c.player)??[];a.push(c);byPlayer.set(c.player,a);}

 // render windows: candidate moments by kind, [t, i, j]
 const cand:Record<string,number[][]>={shield:[],box:[],press:[],jam:[]};
 // duels and shields
 const duel=[0,1].map(()=>({n:0,commit:0,clean:0,forced:0,loose:0,nicked:0,turned:0,foul:0,shield:0,layoff:0}));
 const sh=[0,1].map(()=>[0,0,0,0,0,0,0,0,0,0]);
 for(const d of duels){
  const D=sideOf(d.defender),S=sideOf(d.receiver);if(D<0||S<0)continue;const x:any=duel[D];
  x.n++;if(d.commit)x.commit++;x[d.outcome]++;
  if(d.outcome!=='forced')continue;
  if(d.layoff){x.layoff++;continue;}
  x.shield++;
  const a=sh[S],t=d.time,ri=idx.get(d.receiver)!,di=idx.get(d.defender)!;a[0]++;cand.shield.push([t,ri,di]);
  const lost=changeWithin(t+.05,S,3);
  if(!lost){a[1]++;const nx=events.find((e:any)=>e.time>t+.01&&e.actor===d.receiver&&NEXT.includes(e.kind));if(nx?.kind==='pass')a[2]++;else if(nx?.kind==='shot')a[3]++;}
  const ch=(byPlayer.get(di)??[]).some((c:any)=>c.time>t&&c.time<=t+2&&c.kind==='challenge');if(ch)a[4]++;
  if(events.some((e:any)=>e.kind==='tackle'&&e.time>t&&e.time<=t+2&&e.actor===d.defender&&e.target===d.receiver))a[5]++;
  if(events.some((e:any)=>e.kind==='tackle'&&e.time>t&&e.time<=t+2&&e.actor===d.receiver&&e.target===d.defender))a[6]++;
  let round=false,through=false,far=false;
  for(let k=fi(t);k<n&&frames[k].time<=t+2;k++){const f=frames[k],r=pos(f,ri),q=pos(f,di);if(!r||!q)continue;
   const dq=Math.hypot(q.x-f.ball.x,q.y-f.ball.y),dr=Math.hypot(r.x-f.ball.x,r.y-f.ball.y);if(dq<dr-.05)round=true;if(Math.hypot(q.x-r.x,q.y-r.y)<.3)through=true;}
  {const f=frames[Math.min(n-1,fi(t+2))],r=pos(f,ri),q=pos(f,di);if(r&&q&&Math.hypot(q.x-r.x,q.y-r.y)>3)far=true;}
  if(round)a[7]++;if(far&&!ch)a[8]++;if(through)a[9]++;
 }
 const rd=[0,1].map(()=>[0,0]);
 for(const c of choices){const s=roster[c.player]?.side;if(s!==0&&s!==1)continue;if(SCREEN_READ.some(w=>c.reason?.startsWith(w)))rd[s][0]++;if(c.reason?.startsWith(PROTECT))rd[s][1]++;}

 // overlaps, jams, out of the pitch, keepers
 const ov=[0,0,0],out=[0,0,0];let jamN=0,jamS=0,jam3=0;const jams:number[][]=[];
 const gk=[0,1].map(()=>[0,0,0,0,0]);
 const keeperIdx=[0,1].map(s=>roster.map((p:any,i:number)=>({p,i})).filter(x=>x.p.side===s&&x.p.role==='GK').map(x=>x.i));
 const run=new Map<string,number>();// pair -> start time of the current still contact
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.restart){run.clear();continue;}
  const P:any[]=[];for(let i=0;i<roster.length;i++){const q=pos(f,i);if(q)P.push({i,q,s:roster[i].side,gk:roster[i].role==='GK'});}
  const still=new Set<string>();
  if(Math.abs(f.ball.y)<8&&(f.ball.x<8||f.ball.x>L-8)){const gx=f.ball.x<8?0:L;const inBox=P.filter(o=>Math.abs(o.q.x-gx)<8&&Math.abs(o.q.y)<8).length;if(inBox>=7)cand.box.push([f.time,-1,-1]);}
  for(let a=0;a<P.length;a++){const A=P[a];
   const ox=A.q.x<-.05||A.q.x>L+.05||Math.abs(A.q.y)>W/2+.05;if(ox){if(A.gk)out[1]++;else out[0]++;}
   if((A.q.x<0||A.q.x>L)&&Math.abs(A.q.y)<GH)out[2]++;
   for(let b=a+1;b<P.length;b++){const B=P[b],d=Math.hypot(A.q.x-B.q.x,A.q.y-B.q.y);
    if(A.s===B.s){if(d<.3)ov[2]++;continue;}
    if(d<.3)ov[0]++;if(d<OPP)ov[1]++;
    if(d<.75&&Math.hypot(A.q.vx,A.q.vy)<.5&&Math.hypot(B.q.vx,B.q.vy)<.5){const key=A.i+':'+B.i;still.add(key);if(!run.has(key))run.set(key,f.time);}
   }}
  for(const [key,t0] of [...run]){if(still.has(key))continue;run.delete(key);const dur=f.time-t0;if(dur>1){jamN++;jamS+=dur;if(dur>3)jam3++;{const [i,j]=key.split(':').map(Number);cand.jam.push([t0,i,j]);}if(jams.length<6){const [i,j]=key.split(':').map(Number);jams.push([r1(t0),r1(f.time),i,j]);}}}
  for(const s of [0,1]){const g=keeperIdx[s].map(i=>pos(f,i)).find(Boolean);if(!g)continue;const gx=s===0?0:L;
   if(Math.hypot(f.ball.x-gx,f.ball.y)<16){gk[s][0]++;if(P.some(o=>o.s!==s&&Math.hypot(o.q.x-g.x,o.q.y-g.y)<.7))gk[s][1]++;}}
 }
 for(const e of events){if(e.kind!=='shot')continue;const S=sideOf(e.actor);if(S<0)continue;const D=1-S,f=frames[Math.max(0,fi(e.time)-1)];
  const g=keeperIdx[D].map(i=>pos(f,i)).find(Boolean);if(!g)continue;const gx=D===0?0:L;
  // his distance off the line from the ball to the goal centre, and his depth off his line
  const bx=f.ball.x-gx,by=f.ball.y,len=Math.hypot(bx,by)||1,px=g.x-gx,py=g.y,lat=Math.abs(px*by-py*bx)/len;
  gk[D][2]++;gk[D][3]+=lat;gk[D][4]+=Math.abs(g.x-gx);}

 // press spells
 const pr=[0,1].map(()=>[0,0,0]);
 const open=new Map<number,{t0:number;owner:string;min:number;tmin:number;s:number}>();
 const closeSpell=(i:number,t:number,k:number)=>{const sp=open.get(i);if(!sp)return;open.delete(i);if(t-sp.t0<1)return;if(t-sp.t0>=1.5&&sp.min<1.2)cand.press.push([sp.tmin,i,idx.get(sp.owner)??-1]);const a=pr[sp.s];a[0]++;if(sp.min>1.2)a[1]++;
  for(let q=k;q<n&&frames[q].time<=t+1;q++){if(poss[q]===sp.s){a[2]++;break;}}};
 for(let k=0;k<n;k++){const f=frames[k],o=ownerOf(f);const oi=o!=null?idx.get(o):undefined;
  for(let i=0;i<roster.length;i++){const q=pos(f,i);const s=roster[i].side;
   const pressing=!!q&&PRESS.includes(q.duty)&&oi!==undefined&&roster[oi].side!==s;
   const sp=open.get(i);
   if(sp&&(!pressing||sp.owner!==o)){closeSpell(i,f.time,k);}
   if(pressing){const c=pos(f,oi!),d=c?Math.hypot(q.x-c.x,q.y-c.y):99;const cur=open.get(i);if(cur){if(d<cur.min){cur.min=d;cur.tmin=f.time;}}else open.set(i,{t0:f.time,owner:o,min:d,tmin:f.time,s});}
  }}
 for(const i of [...open.keys()])closeSpell(i,frames[n-1].time,n-1);

 // losses and interceptions
 const loss=[0,1].map(()=>[0,0]),intc=[0,0];
 for(let k=1;k<n;k++){if(poss[k]===poss[k-1]||poss[k]<0||poss[k-1]<0||frames[k].restart||frames[k-1].restart)continue;
  const s=poss[k-1],t=frames[k].time;let last:any=null;for(let q=events.length-1;q>=0;q--){const e=events[q];if(e.time>t)continue;if(e.time<t-4)break;if(sideOf(e.actor)===s&&['pass','clearance','shot'].includes(e.kind)){last=e;break;}}
  loss[s][last?0:1]++;}
 for(let k=0;k<events.length;k++){const e=events[k];if(e.kind!=='pass')continue;const s=sideOf(e.actor);if(s<0)continue;
  let nx:any=null;for(let q=k+1;q<events.length;q++)if(NEXT.includes(events[q].kind)){nx=events[q];break;}
  if(nx&&(nx.kind==='turnover'||nx.kind==='receive')&&sideOf(nx.actor)===1-s)intc[s]++;}

 // restarts
 const rs:Record<string,number[]>={};
 for(let k=0;k<n;){if(!frames[k].restart){k++;continue;}let j=k;while(j+1<n&&frames[j+1].restart)j++;const kind=frames[k].restartInfo?.kind??'?';
  const a=rs[kind]??(rs[kind]=[0,0]);a[0]++;a[1]+=frames[j].time-frames[k].time;k=j+1;}
 for(const a of Object.values(rs))a[1]=r1(a[1]);
 // render windows (only when asked: seed 0 rows): per kind the first two moments at least 30 s apart, frames from 1 s
 // before to 2.5 s after at >= 0.08 s steps: [time, ball x, y, z, owner index or -1, restart 0/1, [i, x, y, vx, vy, ...]]
 let eps:any[]|undefined;
 if(withEps){eps=[];
  for(const [kind,list] of Object.entries(cand)){list.sort((a,b)=>a[0]-b[0]);const pick:number[][]=[];for(const c of list){if(pick.length<2&&(!pick.length||c[0]-pick[pick.length-1][0]>=30))pick.push(c);}
   for(const [t,i,j] of pick){const fr:any[]=[];let last=-1;
    for(let k=fi(t-1);k<n&&frames[k].time<=t+2.5;k++){const f=frames[k];if(f.time-last<.08)continue;last=f.time;const ps:number[]=[];
     for(let q=0;q<roster.length;q++){const o=pos(f,q);if(o)ps.push(q,r2(o.x),r2(o.y),r1(o.vx),r1(o.vy));}
     const o=ownerOf(f);fr.push([r2(f.time),r2(f.ball.x),r2(f.ball.y),r1(f.ball.z??0),o!=null&&idx.has(o)?idx.get(o):-1,f.restart?1:0,ps]);}
    eps.push({kind,t:r2(t),i,j,f:fr});}}}
 const st=sepStats;
 return {hash,sep:st?{pairs:st.pairs,metres:r1(st.metres),carrierPairs:st.carrierPairs,carrierMetres:r1(st.carrierMetres),keeperPairs:st.keeperPairs,keeperMetres:r1(st.keeperMetres)}:null,
  duel,sh,rd,ov,jam:[jamN,r1(jamS)],jam3,jams,out,gk:gk.map(a=>[a[0],a[1],a[2],r2(a[3]),r2(a[4])]),pr,loss,intc,rs,...(eps?{eps,ro:roster.map((p:any)=>[p.side,p.role,p.skills?.strength??null])}:{})};
}
