// Press step-up (2026-10-18), the public-lab row: one official match (deep.ts's runMatch call, unchanged) bundled with
// hook.mjs's read-only calls, and one entry per BEATEN-PRESSER EPISODE. Evidence only; nothing here writes to the engine.
//
// A beaten-presser tick: defendOutOfPossession's presser fails the engine's own beaten test (busy, isBeaten, or out of the
// block near goal) with an outfield carrier; the tick's gate is the first condition of the step-out check that stops it,
// in code order (practice-defending.ts:1103-1106): engaged, pinned, delay, zone (cd<28 or running), nocand (no team-mate
// not busy, not beaten, within 11 m), slower (the best one not 0.1 s sooner to the carrier than the presser), oobFor, else
// fires (verified to equal plan.presser changing, gates.mjs). An episode: consecutive ticks with the same carrier and mode
// (cp / trap / open by the coordination jobs), gaps <= 0.6 s.
//
// Episode class: 'fires' if a step-out fired in it; else 'quicker' if a tick was stopped by `slower` with the presser
// geometrically beaten (isBeaten: behind the carrier, > 1.5 m off); else 'quicker-oob' (stopped by `slower` with the
// presser only out of the block: goal-side but > 3 m off near goal); else its commonest gate. t0 = the first tick where the
// check reached the candidates (gate nocand / slower / oobFor / fires), else the first tick; everything is read from t0.
//
// e (per episode, arrays to keep rows small):
//  [0 mode 0 cp 1 trap 2 open, 1 class, 2 t0, 3 carrier m from our goal, 4 carrier goalward m/s, 5 presser pace, 6 carrier pace,
//   7 presser-carrier m, 8 best candidate m (or -1), 9 best's man matters 0 none 1 watch/spare 2 danger 3 ball, 10 fired s after t0 (or -1),
//   11 shots within 8 s (theirs, before we win it back or a restart), 12 chance sum of those, 13 a clear chance (>= .30) among them 0/1,
//   14 goal among them 0/1, 15 shots within 8 s whoever has it (raw), 16 chance sum raw,
//   17 presser goal-side of the carrier (nearer our goal and within 3 m) first at s (or -1; only while the carrier keeps it),
//   18 presser touches it (wins it or a tackle by him) first at s (or -1), 19 we win it back (any of ours) first at s (or -1),
//   20 the carrier releases it (pass, shot, loses it) at s (or -1 within 8 s),
//   21 what the carrier does next: 0 still carrying at 8 s, 1 shot, 2 pass, 3 lost it to us, 4 other (loose, restart),
//   22 a pass to the best candidate's man 0/1 (-1 no pass or no man), 23 a shot by anyone of theirs within 3 s of that pass 0/1,
//   24 carrier distance to goal at the release (m, or -1), 25 the indices (in row order) of the shots counted in 11]
// (3 is DEPTH: metres from our goal line, as the engine's cd; 24 is the straight distance to the goal centre.)
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {isBeaten} from '../../src/practice-defending';
import {arrivalTime} from '../../src/practice-arrival';
export {armTreatment};

const L=48,CLEAR=.3;
const dist=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y);
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const CLASS=['fires','quicker','quicker-oob','zone','nocand','engaged','pinned','delay','oobFor','slower'];
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const ticks:any[]=[];let pending:any=null;
 const G=globalThis as any;
 G.__so=(s:any)=>{
  const {presser,committed,carrier,g,own,busy}=s;
  if(!presser||!carrier||carrier.role==='GK'){pending=null;return;}
  const geo=isBeaten(presser,carrier,g),isBusy=busy.has(presser.id),oob=s.outOfBlock(presser);
  if(!(geo||isBusy||oob)){pending=null;return;}
  const ok=own.filter((q:any)=>q!==presser&&!busy.has(q.id)&&!isBeaten(q,carrier,g)&&dist(q,carrier)<11).map((q:any)=>{
   const m=s.manOf(q),r=m?s.readOf(q,m):undefined;
   return {q,m:m?.id??null,matter:r?.matter??null,at:arrivalTime(q,carrier),score:arrivalTime(q,carrier)+(r?.matter==='danger'?.8*r.weight:0)-(q.id===s.memory.cover?.5:0)};
  }).sort((a:any,b:any)=>a.score-b.score||a.q.id.localeCompare(b.q.id));
  const best=ok[0],pAt=arrivalTime(presser,carrier);
  let gate='fires';
  if(!s.engaged)gate='engaged';else if(s.pinned)gate='pinned';else if(s.intent==='delay')gate='delay';
  else if(!(s.cd<28||s.running))gate='zone';else if(!best)gate='nocand';
  else if(!(isBusy||best.at<pAt-.1))gate='slower';else if(s.outOfBlockFor(best.q))gate='oobFor';
  pending={time:s.time,gate,geo,presser:presser.id,carrier:carrier.id,cd:s.cd,run:(s.defending===0?-1:1)*carrier.vx,pp:presser.pace,cp:carrier.pace,pd:dist(presser,carrier),
   bd:best?dist(best.q,carrier):-1,bm:best?.m??null,bmat:best?(best.matter==='danger'?2:best.matter==='ball'?3:best.matter?1:0):0};
 };
 G.__sp=(input:any,plan:any)=>{if(pending&&pending.time===input.time&&pending.gate==='fires'&&!(plan.presser&&plan.presser!==pending.presser))pending.mismatch=true;};
 G.__pc=(plan:any,players:any[],ball:any)=>{
  const p=pending;pending=null;
  if(!p||p.time!==plan.time)return;
  const owner=players.find(q=>q.id===ball.owner);if(!owner||owner.id!==p.carrier)return;
  const D=1-plan.attacking,side=new Map(players.map(q=>[q.id,q.side]));
  const jobs=Object.values(plan.jobs as Record<string,any>).filter(j=>side.get(j.player)===D);
  p.mode=jobs.some(j=>j.purpose==='counter-press')?0:jobs.some(j=>j.purpose==='trap')?1:2;p.D=D;
  ticks.push(p);
 };
 let R:any=null;
 let row:any;
 try{row=deepPlay(t,(rec:any)=>{R=rec;return null;});}finally{G.__so=G.__sp=G.__pc=undefined;}
 const roster:{id:string;side:number}[]=R.players,frames:any[]=R.frames,events:any[]=R.events;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const pos=(f:any,id:string)=>{const i=idx.get(id)!;if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const ownerOf=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=ownerOf(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const shotEv=events.filter((e:any)=>e.kind==='shot'&&(e.side===0||e.side===1));
 const chance:number[]=row.shots.map((x:any)=>x[1]),goal:number[]=row.shots.map((x:any)=>x[8]);
 const matched=shotEv.length===chance.length;
 const totals=[0,1].map(s=>r3(row.shots.filter((x:any)=>x[0]===s).reduce((a:number,x:any)=>a+x[1],0)));
 // episodes
 const eps:any[]=[];let cur:any=null;
 for(const k of ticks){
  if(cur&&cur.carrier===k.carrier&&cur.mode===k.mode&&k.time-cur.end<=.6){cur.end=k.time;cur.ticks.push(k);continue;}
  cur={carrier:k.carrier,mode:k.mode,end:k.time,ticks:[k]};eps.push(cur);
 }
 const out:any[]=[];let mismatches=0;
 for(const e of eps){
  const T=e.ticks;mismatches+=T.filter((k:any)=>k.mismatch).length;
  const fired=T.find((k:any)=>k.gate==='fires');
  let cls:string;
  if(fired)cls='fires';else if(T.some((k:any)=>k.gate==='slower'&&k.geo))cls='quicker';else if(T.some((k:any)=>k.gate==='slower'))cls='quicker-oob';
  else{const c:Record<string,number>={};for(const k of T)c[k.gate]=(c[k.gate]??0)+1;cls=Object.entries(c).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];}
  const k0=T.find((k:any)=>['nocand','slower','oobFor','fires'].includes(k.gate))??T[0];
  const t0=k0.time,D=k0.D,A=1-D,g={x:D===0?0:L,y:0};
  const f0=frameAt(t0);
  // possession: until we win it back or a restart (as the 2026-10-16 cp keys)
  let back=Infinity,restart=Infinity;
  for(let q=f0+1;q<n;q++){if(frames[q].restart){restart=frames[q].time;break;}}
  for(let q=f0+1;q<n;q++){if(poss[q]===D&&poss[q-1]!==D){back=frames[q].time;break;}}
  const until=Math.min(t0+8,back,restart+.01);
  let sh=0,ch=0,cl=0,gl=0,shr=0,chr=0;const ids:number[]=[];
  shotEv.forEach((s:any,i:number)=>{if(s.side!==A||s.time<=t0||s.time>t0+8)return;const c=matched?chance[i]:0;shr++;chr+=c;
   if(s.time<=until){sh++;ch+=c;ids.push(i);if(c>=CLEAR)cl=1;if(matched&&goal[i])gl=1;}});
  // the chaser and the carrier, frame by frame
  let goalSide=-1,touch=-1,release=-1,next=0,relD=-1;
  for(let q=f0;q<n&&frames[q].time<=t0+8;q++){
   const f=frames[q],o=ownerOf(f),dt=frames[q].time-t0;
   if(o===k0.presser&&touch<0)touch=dt;
   if(release<0&&o!==k0.carrier){
    release=dt;const c=pos(frames[Math.max(f0,q-1)],k0.carrier);relD=c?dist(c,g):-1;
    next=o&&sideOf(o)===D?3:4;
    break;
   }
   if(goalSide<0){const p=pos(f,k0.presser),c=pos(f,k0.carrier);if(p&&c&&dist(p,g)<dist(c,g)&&dist(p,c)<=3)goalSide=dt;}
  }
  const tk=events.find((x:any)=>x.kind==='tackle'&&x.actor===k0.presser&&x.time>=t0&&x.time<=t0+8);
  if(tk&&(touch<0||tk.time-t0<touch))touch=tk.time-t0;
  let passMan=-1,passShot=-1;
  const act=events.find((x:any)=>x.actor===k0.carrier&&(x.kind==='pass'||x.kind==='shot')&&x.time>=t0-1e-6&&x.time<=t0+8);
  if(act&&(release<0||act.time-t0<=release+.15)){
   next=act.kind==='shot'?1:2;
   if(release<0){release=act.time-t0;const c=pos(frames[frameAt(act.time)],k0.carrier);relD=c?dist(c,g):-1;}
   if(act.kind==='pass'){passMan=k0.bm?(act.target===k0.bm?1:0):-1;passShot=shotEv.some((s:any)=>s.side===A&&s.time>act.time&&s.time<=act.time+3)?1:0;}
  }
  out.push([k0.mode,CLASS.indexOf(cls),r2(t0),r1(k0.cd),r1(k0.run),r2(k0.pp),r2(k0.cp),r1(k0.pd),r1(k0.bd),k0.bmat,fired?r2(fired.time-t0):-1,
   sh,r3(ch),cl,gl,shr,r3(chr),goalSide<0?-1:r2(goalSide),touch<0?-1:r2(touch),back===Infinity||back-t0>8?-1:r2(back-t0),release<0?-1:r2(release),next,passMan,passShot,relD<0?-1:r1(relD),ids]);
 }
 return {label:t.label,arm:t.arm,seed:t.seed,rev:t.rev,build:row.build,plat:row.plat,score:row.score,chances:totals,shotSides:row.shots.map((x:any)=>x[0]),shotChance:chance.map(r3),shotsMatched:matched,mismatches,eps:out,ms:row.ms};
}
