// Defensive ceiling (2026-10-20): the per-side measures of one match, from its compact replay (5 Hz frames, the
// official events) plus, when the full engine record is at hand, pass aims and the players' job history. Evidence only.
// Used by pd.ts (every lab row) and step0.ts (the premise trace, which also reads older compact replays without jobs).
//
// Coordinates: metres, x 0..48 along the pitch, y -15..15. depth(s, x) = distance from side s's OWN goal line, so for an
// attacking side S the goal it attacks is the defending side D's own goal and depth(D, x) is the distance from it.
import {shotChance} from '../../../../lib/ballers/chances';

export const L=48,CLEAR=.3;
/** The pre-registered depth run (README): started at least DEEP_FROM m from the goal, received within ARRIVE_IN m of it. */
export const DEEP_FROM=20,ARRIVE_IN=16;
export const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;

export interface NFrame {t:number;p:{x:number;y:number}[];b:{x:number;y:number};o:number;ps:number;r:boolean}
export interface NEvent {t:number;k:string;a:number;g:number;s:number;ch?:number;aim?:{x:number;y:number};rk?:string;aerial?:boolean}
export interface NJob {t:number;i:number;kind:string;purpose:string|null;target:number}
export interface Norm {roles:string[];sides:number[];frames:NFrame[];events:NEvent[];jobs?:NJob[]}

/** A compact replay (header, frames, events) as metres and seconds. Starters only (no subs in these matches). */
/** `aims` (full records): the pass aims, aligned with `events` (compact keeps the engine's events one for one, in order). */
export function normalize(header:any,frames:any[],events:any[],jobs?:NJob[],aims?:({x:number;y:number;aerial:boolean}|null)[]):Norm{
 const pl=header.players.filter((p:any)=>!p.bench).sort((a:any,b:any)=>a.i-b.i);
 const fr:NFrame[]=frames.map((f:any)=>({t:f.t/1000,p:f.p.map((q:number[])=>({x:q[0]/100,y:q[1]/100})),b:{x:f.b[0]/100,y:f.b[1]/100},o:f.o,ps:f.ps,r:!!f.r}));
 const ev:NEvent[]=events.map((e:any,q:number)=>{
  const s=e.s===0||e.s===1?e.s:(e.a>=0&&e.a<pl.length?pl[e.a].side:-1);
  const x:NEvent={t:e.t/1000,k:e.k,a:e.a??-1,g:e.g??-1,s};
  if(e.k==='shot')x.ch=shotChance(e)??0;
  if(e.rk)x.rk=e.rk;
  const aim=aims?.[q];if(aim){x.aim={x:aim.x,y:aim.y};x.aerial=aim.aerial;}
  return x;
 });
 return {roles:pl.map((p:any)=>p.role),sides:pl.map((p:any)=>p.side),frames:fr,events:ev,jobs};
}

/** Per-side measures. Side arrays are [side 0, side 1]; "against" a side = the other side's attacking numbers. */
export function measure(n:Norm,debug?:any[]){
 const {frames,events,roles,sides}=n,N=frames.length;
 const out=(s:number)=>roles.map((_,i)=>i).filter(i=>sides[i]===s&&roles[i]!=='GK');
 const frameAt=(t:number)=>{let lo=0,hi=N-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].t<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const lastLine=(f:NFrame,D:number)=>Math.min(...out(D).map(i=>depth(D,f.p[i].x)));
 // possession per frame: the last side in control; a restart counts for its side (frame ps)
 const poss=new Int8Array(N);let last=-1;
 for(let k=0;k<N;k++){const f=frames[k];if(f.r)last=f.ps;else if(f.o>=0&&f.o<sides.length)last=sides[f.o];poss[k]=last;}
 const spellEnd=(k:number)=>{const s=poss[k];let j=k;while(j+1<N&&poss[j+1]===s)j++;return frames[j].t;};
 const shots=events.filter(e=>e.k==='shot'&&(e.s===0||e.s===1));
 const goals=events.filter(e=>e.k==='goal'&&(e.s===0||e.s===1));
 // the receive after a pass: the first frame after it where the target owns the ball (within 4 s, before anyone else)
 // (a first-time finish never shows the target owning it: his shot within 4 s, nobody else on it before, is the receive)
 const receiveOf=(e:NEvent):number=>{
  const end=Math.min(e.t+4,...events.filter(x=>x.k==='shot'&&x.a===e.g&&x.t>e.t).map(x=>x.t));
  for(let k=frameAt(e.t)+1;k<N&&frames[k].t<=e.t+4;k++){const f=frames[k];if(f.r)return -1;if(f.o>=0&&f.o!==e.a){return f.o===e.g?k:-1;}if(f.t>=end-1e-6)return f.t<=e.t+4?k:-1;}
  return -1;
 };
 // the receiver's run before frame k (towards the goal side S attacks): continuous goalward speed >= 1 m/s (one 0.2 s
 // dip allowed), scanned back at most 8 s; returns the frame index where it started and the metres gained
 const runBefore=(i:number,S:number,k:number)=>{
  const D=1-S;let j=k,dips=0;
  while(j>0&&frames[k].t-frames[j-1].t<=8+1e-6&&!frames[j-1].r&&poss[j-1]===S){
   const a=frames[j-1],b=frames[j],dt=b.t-a.t||.2,v=(depth(D,a.p[i].x)-depth(D,b.p[i].x))/dt;
   if(v>=1){j--;dips=0;continue;}
   if(dips===0&&j-2>=0){const c=frames[j-2],v2=(depth(D,c.p[i].x)-depth(D,b.p[i].x))/(b.t-c.t||.4);if(v2>=1){j-=2;dips=1;continue;}}
   break;
  }
  return {k0:j,gain:depth(D,frames[j].p[i].x)-depth(D,frames[k].p[i].x)};
 };
 const shotsAfter=(S:number,t0:number,t1:number)=>shots.filter(e=>e.s===S&&e.t>t0+1e-6&&e.t<=t1+1e-6);
 // the job a player held at time t (full records only)
 const jobsBy=new Map<number,NJob[]>();for(const j of n.jobs??[]){const a=jobsBy.get(j.i)??[];a.push(j);jobsBy.set(j.i,a);}
 const jobAt=(i:number,t:number)=>{const a=jobsBy.get(i);if(!a)return null;let best:NJob|null=null;for(const j of a){if(j.t<=t+1e-6)best=j;else break;}return best;};
 /** Since when defender d has continuously held target i at time t (full records only). */
 /** How long after t0 a defender of D first had player i as his man (0 = someone already had him at t0), by t1; null = nobody did. */
 const pickupAt=(i:number,D:number,t0:number,t1:number)=>{
  if(out(D).some(d=>jobAt(d,t0)?.target===i))return 0;
  let first=Infinity;for(const d of out(D))for(const j of jobsBy.get(d)??[]){if(j.t>t1+1e-6)break;if(j.t>t0&&j.target===i){first=Math.min(first,j.t);break;}}
  return Number.isFinite(first)?first-t0:null;
 };
 const heldSince=(d:number,i:number,t:number)=>{const a=jobsBy.get(d);if(!a)return null;let since:number|null=null;for(const j of a){if(j.t>t+1e-6)break;if(j.target===i){if(since===null)since=j.t;}else since=null;}return since;};

 const side=(S:number)=>{
  const D=1-S;
  const sh=shots.filter(e=>e.s===S);
  const m:any={goals:goals.filter(e=>e.s===S).length,shots:sh.length,clear:sh.filter(e=>(e.ch??0)>=CLEAR).length,good:r3(sh.reduce((x,e)=>x+(e.ch??0),0))};
  // territory: share of open-play time with the ball in S's own / middle / attacking third
  const terr=[0,0,0];let tot=0;
  for(let k=0;k+1<N;k++){const f=frames[k];if(f.r)continue;const dt=frames[k+1].t-f.t;const d=depth(S,f.b.x);terr[d<16?0:d<32?1:2]+=dt;tot+=dt;}
  m.terr=terr.map(v=>r3(v/Math.max(1e-9,tot)));
  // passes: in behind (aimed beyond D's deepest outfielder, aims known), entry passes, receptions after a run from deep
  const behind=[0,0],entry=[0,0],depthDeep=[0,0,0,0];let ddLine=0;
  // receptions after a run: runs6 = any kept pass whose receiver gained >= 6 m towards goal in the run into it [n, clear
  // within 8 s]; fromDeep (the pre-registered depth run) = the same run, started DEEP_FROM m or more from the goal and
  // received within ARRIVE_IN m of it (from midfield into the final third)
  const fromDeep={n:0,clear:0,line:0,lead:0,leadN:0,trackedAtStart:0,jobTracked:0,pickupLate:0,pickupLateN:0,trLead:0,trN:0};
  const runShots=new Set<NEvent>(),allShots=new Set<NEvent>();let runs6=0;
  for(const e of events){
   if(e.k!=='pass'||e.s!==S||e.rk||e.a<0||e.g<0)continue;
   const k=frameAt(e.t),f=frames[k];if(f.r)continue;
   const kr=receiveOf(e),kept=kr>=0?1:0,line=lastLine(f,D),from=depth(S,f.p[e.a].x);
   if(e.aim){if(depth(D,e.aim.x)<line-.3){behind[0]++;behind[1]+=kept;}
    const to=depth(S,e.aim.x);if(from<32&&to>=28){entry[0]++;entry[1]+=kept;
     const j=jobAt(e.g,e.t);if(j?.purpose==='depth'&&roles[e.g]!=='ST'){depthDeep[0]++;depthDeep[1]+=kept;ddLine+=line;
      if(kept){const s8=shotsAfter(S,frames[kr].t,Math.min(frames[kr].t+8,spellEnd(kr)));depthDeep[2]+=s8.length;depthDeep[3]+=s8.filter(x=>(x.ch??0)>=CLEAR).length;}}}}
   if(!kept)continue;
   const run=runBefore(e.g,S,kr);
   if(run.gain<6)continue;
   const fr=frames[kr],rec=fr.p[e.g],after=shotsAfter(S,fr.t,Math.min(fr.t+8,spellEnd(kr))).filter(x=>(x.ch??0)>=CLEAR);
   runs6++;for(const x of after)allShots.add(x);
   if(depth(D,frames[run.k0].p[e.g].x)<DEEP_FROM||depth(D,rec.x)>=ARRIVE_IN)continue;
   fromDeep.n++;fromDeep.line+=line;
   const defs=out(D).map(i=>({i,d:dist(fr.p[i],rec)})).sort((a,b)=>a.d-b.d),near=defs[0];
   fromDeep.lead+=depth(D,fr.p[near.i].x)-depth(D,rec.x);fromDeep.leadN++;
   if(dist(frames[run.k0].p[near.i],frames[run.k0].p[e.g])<3)fromDeep.trackedAtStart++;
   if(n.jobs){const tr=out(D).find(i=>jobAt(i,e.t)?.target===e.g);if(tr!==undefined){fromDeep.jobTracked++;fromDeep.trLead+=depth(D,fr.p[tr].x)-depth(D,rec.x);fromDeep.trN++;}
    const p=pickupAt(e.g,D,frames[run.k0].t,e.t);if(p!==null){fromDeep.pickupLate+=p;fromDeep.pickupLateN++;}}
   if(debug){const tr=n.jobs?out(D).find(i=>jobAt(i,e.t)?.target===e.g):undefined;debug.push({S,t:r1(e.t),recv:e.g,start:r1(frames[run.k0].t),from:r1(depth(D,frames[run.k0].p[e.g].x)),at:r1(depth(D,rec.x)),tracker:tr??null,since:tr!==undefined?heldSince(tr,e.g,e.t):null,lead:r1(depth(D,fr.p[near.i].x)-depth(D,rec.x)),clear8:after.length});}
   for(const x of after)runShots.add(x);
  }
  fromDeep.clear=runShots.size;
  m.behind=behind;m.entry=entry;m.depthDeep=[...depthDeep,r1(ddLine)];
  m.fromDeep=[fromDeep.n,fromDeep.clear,r1(fromDeep.line),r1(fromDeep.lead),fromDeep.leadN,fromDeep.trackedAtStart,fromDeep.jobTracked,r2(fromDeep.pickupLate),fromDeep.pickupLateN,r1(fromDeep.trLead),fromDeep.trN];
  m.runs6=[runs6,allShots.size];
  return m;
 };

 /** Step 0: one row per clear chance of side S. */
 const chanceRows=(S:number)=>{
  const D=1-S,rows:any[]=[];
  for(const e of shots){
   if(e.s!==S||(e.ch??0)<CLEAR)continue;
   const ks=frameAt(e.t),shooter=e.a;
   // the shooter's last reception by a team-mate's pass in the same spell
   let pass:NEvent|undefined;
   for(let q=events.indexOf(e)-1;q>=0;q--){const x=events[q];if(e.t-x.t>20)break;
    if(x.s===D&&(x.k==='pass'||x.k==='clearance'||x.k==='shot'))break;
    if(x.k==='pass'&&x.s===S&&x.g===shooter){pass=x;break;}}
   const k=frameAt(e.t);let spellStart=k;while(spellStart>0&&poss[spellStart-1]===S)spellStart--;
   // the chain: the first reception after a run from deep (>= 6 m) in this spell within 10 s before the shot
   let chain:any=null;
   for(const x of events){
    if(x.t>=e.t)break;if(x.t<Math.max(frames[spellStart].t,e.t-10)-1e-6||x.k!=='pass'||x.s!==S||x.g<0)continue;
    const kx=receiveOf(x);if(kx<0||frames[kx].t>e.t+1e-6)continue;
    const ru=runBefore(x.g,S,kx);if(ru.gain<6)continue;
    const fx=frames[frameAt(x.t)],fk=frames[kx],f0=frames[ru.k0];
    const nr=out(D).map(i=>({i,d:dist(fk.p[i],fk.p[x.g])})).sort((a,b)=>a.d-b.d)[0];
    chain={_q:events.indexOf(x),_rt:fk.t,_g:x.g,ago:r1(e.t-x.t),role:roles[x.g],shooter:x.g===shooter?1:0,gain:r1(ru.gain),from:r1(depth(D,f0.p[x.g].x)),lastLine:r1(lastLine(fx,D)),
     nearAtStart:r1(dist(f0.p[nr.i],f0.p[x.g])),nearAtRecv:r1(nr.d),lead:r1(depth(D,fk.p[nr.i].x)-depth(D,fk.p[x.g].x))};
    if(n.jobs){const tr=out(D).find(i=>jobAt(i,x.t)?.target===x.g),pu=pickupAt(x.g,D,f0.t,x.t);chain.tracker=tr===undefined?null:r1(depth(D,fk.p[tr].x)-depth(D,fk.p[x.g].x));chain.pickup=pu===null?null:r1(pu);}
    break;
   }
   if(!pass||pass.t<frames[spellStart].t-1e-6){rows.push({t:r1(e.t),ch:r2(e.ch!),via:'none',role:roles[shooter],chain,_sq:events.indexOf(e),_g:shooter});continue;}
   const kp=frameAt(pass.t),kr=receiveOf(pass);
   if(kr<0){rows.push({t:r1(e.t),ch:r2(e.ch!),via:'loose',role:roles[shooter],chain,_sq:events.indexOf(e),_g:shooter});continue;}
   const fp=frames[kp],fr=frames[kr],run=runBefore(shooter,S,kr);
   const defs=out(D).map(i=>({i,d:dist(fr.p[i],fr.p[shooter])})).sort((a,b)=>a.d-b.d),near=defs[0];
   const f0=frames[run.k0];
   const row:any={t:r1(e.t),ch:r2(e.ch!),via:pass.rk?'restart':'pass',role:roles[shooter],
    lastLine:r1(lastLine(fp,D)),ballDepth:r1(depth(D,fp.b.x)),recvDepthAtPass:r1(depth(D,fp.p[shooter].x)),recvDepth:r1(depth(D,fr.p[shooter].x)),
    run:r1(run.gain),runSecs:r1(fr.t-f0.t),startDepth:r1(depth(D,f0.p[shooter].x)),startBehindBall:depth(D,f0.p[shooter].x)>=depth(D,f0.b.x)-2?1:0,
    nearAtRecv:r1(near.d),lead:r1(depth(D,fr.p[near.i].x)-depth(D,fr.p[shooter].x)),nearAtStart:r1(dist(f0.p[near.i],f0.p[shooter])),
    toShot:r1(e.t-fr.t),chain,_q:events.indexOf(pass),_rt:fr.t,_sq:events.indexOf(e),_g:shooter};
   if(n.jobs){const tr=out(D).find(i=>jobAt(i,pass!.t)?.target===shooter);row.tracker=tr===undefined?null:{since:(()=>{const s=heldSince(tr,shooter,pass!.t);return s===null?null:r1(s-f0.t);})(),dAtRecv:r1(dist(fr.p[tr],fr.p[shooter])),lead:r1(depth(D,fr.p[tr].x)-depth(D,fr.p[shooter].x))};
    const rj=jobAt(shooter,pass.t);row.recvJob=rj?`${rj.kind}/${rj.purpose??''}`:null;}
   rows.push(row);
  }
  return rows;
 };
 return {side:[side(0),side(1)],chances:[chanceRows(0),chanceRows(1)]};
}
