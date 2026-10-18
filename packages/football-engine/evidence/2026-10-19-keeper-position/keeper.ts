// Keeper position (2026-10-19), one row per match. Evidence only; nothing here writes to the engine.
//
// The match: two real frozen Ballers sides (../2026-10-09-scenarios/sides, md5-checked by run.mjs, no manager field),
// played through EXACTLY the runMatch call lib/ballers/compute.ts computeMatch makes (teams by engineTeam, the sides'
// ideas by sidePlans, their substitutions by sideOrders, coordinated, record:true). The only change is the keeper call,
// on BOTH sides, made the way Match prep makes it:
//   arm <HOME>-<AWAY>-<k>   k = L: settings.keeper 'line' (keeperSweep .08) | S: settings.keeper 'sweeper' (.9)
//                           | D: every keeper's trait set to the engine default .2 (what "own" gives an untouched keeper)
//                           | O: the stored side untouched (each keeper's own trait)
// kickoff = seed % 2. `plain()` is computeMatch itself (for the parity check: hooked row == official compact).
//
// Read from the record (frames every 0.1 s and at incidents, choices, events) and from hook.mjs's __ks (the support
// candidates' own score parts). Depth = metres from a side's own goal line (pitch 48 x 30, area 8 m deep).
//
// Row:
//  sweep[s], gk[s] = {reading,keeping,pace} of the starting keeper; score; chances (official table)
//  hist[s]["<phase>|<source>"] = counts of 0.1 s frames by the keeper's depth off his line, bins DEPTH_BINS (+ sum in the
//    last cell, metres). phase: P0..P3 his side in possession (ball depth from his goal <16, <24, <32, >=32), K he has the
//    ball, D0..D3 the other side in possession (same ball-depth bins), Ro / Rt a restart (his side's / theirs).
//    source: what moved him, from his own decision record (kind + reason + job): sup0 the support job's baseline point
//    (3 + 0.035 x ball depth off his line), supN / supF its near / far step point (practice-keeper-support.ts),
//    sup? a support job not matched to a candidate, off (offball keeper position, practice.ts:712-), offhold (holding his
//    depth under a ball in behind), offadj (complementarySupportAim moved him), sweep, save (reading a shot), dive,
//    receive, intercept, ball (he has it), restart, job:<purpose>, <kind>.
//  sup[s] = support decisions: [bd bin][danger bin 0 / <.33 / <.67 / >=.67][class 0 sup0 1 supN 2 supF] counts
//  to[] = open-play turnovers (see TO below); shots[] = every shot (see SH below); eps[] = render windows
//  hl[s][same keys] = the same frames by his LATERAL offset from the line ball -> goal centre at his depth, bins LAT_BINS
//  hy[s][same keys] = the same frames by |y|, his distance off the goal's centre line (LAT_BINS)
//  rc[] = opponents' receptions within 16 m of his goal (see RC below)
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {matchChances,shotChance,CHANCE_TABLE} from '../../../../lib/ballers/chances';
import {keeperReadyPosition} from '../../src/practice-keeper';
import {arrivalTime} from '../../src/practice-arrival';

let SIDES:Record<string,any>={};
export function init(s:Record<string,any>){SIDES=s;}

const L=48,CLEAR=.3,WINDOW=8;
const DEPTH_BINS=[1,2,3,4,5,6,8,10,13,16,20];// upper edges; last bin >= 20; then the metre sum
const LAT_BINS=[.5,1,1.5,2,2.5,3,4,5,6,8,10];// lateral metres off the ball-goal line, same layout
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const depthOf=(s:number,x:number)=>s===0?x:L-x;
const worldX=(s:number,d:number)=>s===0?d:L-d;
const bdBin=(d:number)=>d<16?0:d<24?1:d<32?2:3;
const binOf=(d:number,B=DEPTH_BINS)=>{let i=0;while(i<B.length&&d>=B[i])i++;return i;};
// how far he stands off the line from the ball to his goal centre, measured at his own depth (the angle he should bisect)
const lateral=(s:number,g:{x:number;y:number},ball:{x:number;y:number})=>{const bd=Math.max(.5,depthOf(s,ball.x)),d=depthOf(s,g.x);return Math.abs(g.y-ball.y*Math.min(1,Math.max(0,d/bd)));};
// FNV-1a 32 over a string, two offsets (the parity fingerprint of the official compact)
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};

export function inputOf(arm:string,seed:number):any{
 const [h,a,k]=arm.split('-');
 if(!SIDES[h]||!SIDES[a]||!['L','S','D','O'].includes(k))throw Error('unknown arm '+arm);
 const sides=[h,a].map(c=>{
  const b=JSON.parse(JSON.stringify(SIDES[c]));
  const settings={...(b.settings??{})};delete settings.keeper;
  if(k==='L')settings.keeper='line';
  if(k==='S')settings.keeper='sweeper';
  if(k==='D')b.players=b.players.map((p:any)=>p.roles.includes('GK')?{...p,traits:{...p.traits,keeperSweep:.2}}:p);
  if(Object.keys(settings).length)b.settings=settings;else delete b.settings;
  return b;
 });
 return {v:1,match:`kp-${arm}-${seed}`,seed,kickoff:seed%2,duration:900,sides};
}

/** computeMatch, unchanged: the parity reference. */
export function plain(t:{arm:string;seed:number}){
 const c=computeMatch(inputOf(t.arm,t.seed));
 return {arm:t.arm,seed:t.seed,score:c.compact.score,print:print(c.compact)};
}

const SUPPORT_REASON='Oferă un unghi de întoarcere, cântărind timpul necesar revenirii în poartă.';
const OFF_REASON='Își potrivește poziția cu mingea și păstrează poarta acoperită.';
const HOLD_REASON='Mingea trece de apărare; își ține poziția, gata să iasă, în loc să se retragă pe linie.';
const ADJ_REASON='Colegul ocupă deja culoarul; caută un unghi diferit pentru continuare.';
const SAVE_REASON='Mingea vine spre poartă; citește traiectoria și încearcă s-o oprească.';

export function play(t:{label:string;arm:string;seed:number;rev:string;parity?:boolean}){
 const inp=inputOf(t.arm,t.seed);
 // ---- candidates from the hook, keyed by keeper id and time
 const cands=new Map<string,any[]>();
 (globalThis as any).__ks=(c:any)=>{const key=c.id+'|'+c.time;let a=cands.get(key);if(!a){a=[];cands.set(key,a);}a.push({x:c.aim.x,y:c.aim.y,score:c.score,rt:c.returnTime,open:c.open,travel:c.travel,risk:c.risk,danger:c.danger,nearest:c.nearest,bd:c.bd});};
 let run:any,c:any;const t0=performance.now();
 try{
  // computeMatch's runMatch call, verbatim (lib/ballers/compute.ts:87-95)
  const teams=inp.sides.map(engineTeam);
  const plans=inp.sides.map(sidePlans);
  const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
  const subs=sideOrders(inp,teams as any);
  run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
  c=compact(inp,run.result);
 }finally{(globalThis as any).__ks=undefined;}
 const ms=Math.round(performance.now()-t0);
 const R=run.result,roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const ownerOf=(f:any)=>f.restart?null:(f.ball?.owner??null);
 const gkIdx=[0,1].map(s=>roster.map((p:any,i:number)=>({p,i})).filter((x:any)=>x.p.side===s&&x.p.role==='GK').map((x:any)=>x.i));
 const gkAt=(f:any,s:number)=>{for(const i of gkIdx[s]){const q=pos(f,i);if(q)return {i,q};}return null;};
 const outfieldAt=(f:any,s:number)=>roster.map((p:any,i:number)=>({p,i})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>({i:x.i,q:pos(f,x.i)})).filter((x:any)=>x.q);
 const keeperState=(i:number,q:any)=>{const p=roster[i];return {...p,x:q.x,y:q.y,vx:q.vx??0,vy:q.vy??0,pace:p.basePace,acceleration:3.1+p.skills.pace*.19};};
 const readyFor=(s:number,i:number,ball:any)=>keeperReadyPosition({side:s as 0|1,skills:roster[i].skills},{x:ball.x,y:ball.y,vx:ball.vx??0,vy:ball.vy??0,owner:ball.owner??null} as any,true,false);

 // ---- the keepers' own decisions (decision(): kind + reason + job), as a timeline per roster index
 const dec=new Map<number,any[]>();
 for(const ch of choices){if(ch.action!==undefined||ch.challenge!==undefined||ch.carry!==undefined)continue;if(!gkIdx[0].includes(ch.player)&&!gkIdx[1].includes(ch.player))continue;const a=dec.get(ch.player)??[];a.push(ch);dec.set(ch.player,a);}
 const decAt=(i:number,time:number)=>{const a=dec.get(i);if(!a)return null;let lo=0,hi=a.length-1,b=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){b=m;lo=m+1;}else hi=m-1;}return b>=0?a[b]:null;};
 // which support candidate a support decision took: candidates at the job's `since`, the same aim (exact)
 const supInfo=new Map<any,any>();
 const supClass=(i:number,ch:any)=>{
  if(supInfo.has(ch))return supInfo.get(ch);
  const a=ch.assignment,list=a?cands.get(roster[i].id+'|'+a.since):undefined;let info:any=null;
  if(list){
   // a call yields 7 candidates; with more than one call at that time take the last block that contains the aim
   for(let b=Math.floor((list.length-1)/7)*7;b>=0&&!info;b-=7){
    const block=list.slice(b,b+7),k=block.findIndex((x:any)=>x.x===a.aim.x&&x.y===a.aim.y);
    if(k>=0){const base=block[0],best=block.reduce((m:any,x:any)=>x.score>m.score?x:m,block[0]);
     info={k,cls:k===0?0:k<=3?1:2,danger:base.danger,nearest:base.nearest,bd:base.bd,rt:block[k].rt,rt0:base.rt,ds:block[k].score-base.score,open:block[k].open,top:best===block[k]?1:0};}
   }
  }
  supInfo.set(ch,info);return info;
 };
 const sourceOf=(i:number,ch:any)=>{
  if(!ch)return 'none';
  const k=ch.kind,r=ch.reason;
  if(k==='restart')return 'restart';
  if(r===SUPPORT_REASON){const s=supClass(i,ch);return s?['sup0','supN','supF'][s.cls]:'sup?';}
  if(r===OFF_REASON)return 'off';
  if(r===HOLD_REASON)return 'offhold';
  if(r===ADJ_REASON)return 'offadj';
  if(k==='sweep')return 'sweep';
  if(k==='keeper'&&r===SAVE_REASON)return 'save';
  if(k==='dive')return 'dive';
  if(k==='receive'||k==='intercept')return k;
  if(k==='carry'||k==='prepare'||k==='feint')return 'ball';
  if(ch.assignment?.purpose)return 'job:'+ch.assignment.purpose;
  return k;
 };

 // ---- possession per frame (deep.ts): last side in control; a restart counts for its side
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=ownerOf(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}

 // ---- 1. where the keeper stands: 0.1 s frames only (incident frames would over-weight busy moments)
 const hist=[{} as Record<string,number[]>,{} as Record<string,number[]>],hl=[{} as Record<string,number[]>,{} as Record<string,number[]>],hy=[{} as Record<string,number[]>,{} as Record<string,number[]>];
 let lastTick=-1;
 for(let k=0;k<n;k++){
  const f=frames[k],tick=Math.round(f.time*10);
  if(Math.abs(f.time*10-tick)>1e-4||tick===lastTick)continue;lastTick=tick;
  const o=ownerOf(f);
  for(const s of [0,1]){
   const g=gkAt(f,s);if(!g)continue;
   const d=depthOf(s,g.q.x),bd=depthOf(s,f.ball.x);
   const phase=f.restart?(f.restartInfo?.side===s?'Ro':'Rt'):o===roster[g.i].id?'K':poss[k]===s?'P'+bdBin(bd):'D'+bdBin(bd);
   const key=phase+'|'+sourceOf(g.i,decAt(g.i,f.time));
   const h=hist[s][key]??=new Array(DEPTH_BINS.length+2).fill(0);
   h[binOf(d)]++;h[DEPTH_BINS.length+1]=r1(h[DEPTH_BINS.length+1]+d);
   if(!f.restart){const lt=lateral(s,g.q,f.ball),hh=hl[s][key]??=new Array(LAT_BINS.length+2).fill(0);hh[binOf(lt,LAT_BINS)]++;hh[LAT_BINS.length+1]=r1(hh[LAT_BINS.length+1]+lt);
    const ay=Math.abs(g.q.y),hz=hy[s][key]??=new Array(LAT_BINS.length+2).fill(0);hz[binOf(ay,LAT_BINS)]++;hz[LAT_BINS.length+1]=r1(hz[LAT_BINS.length+1]+ay);}
  }
 }
 // support decisions by ball depth x danger x class
 const sup=[0,1].map(()=>Array.from({length:4},()=>Array.from({length:4},()=>[0,0,0])));
 for(const s of [0,1])for(const i of gkIdx[s])for(const ch of dec.get(i)??[]){
  if(ch.reason!==SUPPORT_REASON)continue;const info=supClass(i,ch);if(!info)continue;
  sup[s][bdBin(info.bd)][info.danger<=0?0:info.danger<1/3?1:info.danger<2/3?2:3][info.cls]++;
 }

 // ---- shots (engine events) with the official chance per shot (compact events, as deep.ts)
 const chanceAt=new Map<number,number>();
 for(const ch of c.chunks)for(const e of ch.e)if(e.k==='shot')chanceAt.set(e.t,shotChance(e)??0);
 const chanceOf=(e:any)=>{const tt=Math.round(e.time*1000);for(const d of [0,1,-1,2,-2]){const v=chanceAt.get(tt+d);if(v!==undefined)return v;}return 0;};
 const shotEv=events.filter((e:any)=>e.kind==='shot'&&(e.side===0||e.side===1));
 const goalEv=events.filter((e:any)=>e.kind==='goal'&&(e.side===0||e.side===1));
 const scored=new Set<any>();
 for(const g of goalEv){for(let k=shotEv.length-1;k>=0;k--){const x=shotEv[k];if(x.time>g.time+1e-6)continue;if(x.time<g.time-4)break;if(x.side===g.side){scored.add(x);break;}}}
 // SH: [0 time, 1 side, 2 chance, 3 goal 0/1, 4 shooter m to goal centre, 5 their keeper's depth off his line, 6 their keeper m
 //      from his ready position for this ball, 7 their keeper's source, 8 turnover index (-1), 9 shooter's own read q or -1]
 const shots:any[]=shotEv.map((e:any)=>{
  const f=frames[frameAt(e.time)],D=1-e.side,g=gkAt(f,D),sh=e.actor&&idx.has(e.actor)?pos(f,idx.get(e.actor)!):null;
  const goal={x:worldX(D,0),y:0};
  const ready=g?readyFor(D,g.i,{...f.ball,owner:e.actor}):null;
  return [r2(e.time),e.side,r3(chanceOf(e)),scored.has(e)?1:0,sh?r1(dist(sh,goal)):-1,g?r2(depthOf(D,g.q.x)):-1,g&&ready?r2(dist(g.q,ready)):-1,g?sourceOf(g.i,decAt(g.i,e.time)):'',-1,e.shot?.assessment?.quality!=null?r3(e.shot.assessment.quality):-1];
 });

 // ---- 2. open-play turnovers: a spell of side B starts at frame k (not a restart) right after a spell of A
 const evIdxAt=(time:number)=>{let lo=0,hi=events.length-1,b=-1;while(lo<=hi){const m=(lo+hi)>>1;if(events[m].time<=time+1e-6){b=m;lo=m+1;}else hi=m-1;}return b;};
 const HOW=['loose','tackle','block','intercept','intercept-loft','clearance','shot-loose','keeper'];
 const to:any[]=[],eps:any[]=[];
 for(let k=1;k<n;k++){
  if(poss[k]<0||poss[k]===poss[k-1]||poss[k-1]<0||frames[k].restart)continue;
  const B=poss[k],A=1-B,f=frames[k],tt=f.time;
  // how B won it (deep.ts spell classification)
  let how='loose';
  for(let e=evIdxAt(tt);e>=0&&events[e].time>tt-3;e--){
   const ev=events[e],es=ev.side;
   if(ev.kind==='save'&&es===B){how='keeper';break;}
   if(ev.kind==='tackle'&&es===B&&tt-ev.time<2){how='tackle';break;}
   if(ev.kind==='block'&&es===B){how='block';break;}
   if(es===A&&(ev.kind==='pass'||ev.kind==='clearance'||ev.kind==='shot')){how=ev.kind==='pass'?(ev.aerial?'intercept-loft':'intercept'):ev.kind==='clearance'?'clearance':'shot-loose';break;}
  }
  // who on A had it last, and was his last act a pass (else he was dispossessed / it ran loose off him)
  let loser:string|null=null;for(let q=k-1;q>=0&&frames[q].time>tt-6;q--){const o=ownerOf(frames[q]);if(o&&sideOf(o)===A){loser=o;break;}}
  const lastAct=[...events.slice(Math.max(0,evIdxAt(tt)-12),evIdxAt(tt)+1)].reverse().find((e:any)=>e.actor===loser&&['pass','clearance','shot'].includes(e.kind));
  const loserGK=loser?roster[idx.get(loser)!].role==='GK':false;
  const lostBy=(loserGK?2:0)+(lastAct&&tt-lastAct.time<4?0:1);// 0 outfield pass, 1 outfield on the ball, 2 keeper's pass, 3 keeper on the ball
  const g=gkAt(f,A);if(!g)continue;
  const gk=g.q,bd=depthOf(A,f.ball.x),goal={x:worldX(A,0),y:0};
  const ready=readyFor(A,g.i,f.ball),off=dist(gk,ready),tBack=arrivalTime(keeperState(g.i,gk) as any,ready);
  const outA=outfieldAt(f,A),goalSide=outA.filter((x:any)=>depthOf(A,x.q.x)<bd).length;
  const carrier=f.ball.owner&&idx.has(f.ball.owner)?pos(f,idx.get(f.ball.owner)!):null;
  const srcCh=decAt(g.i,tt),src=sourceOf(g.i,srcCh),si=srcCh&&srcCh.reason===SUPPORT_REASON?supClass(g.i,srcCh):null;
  // the last support decision in the 3 s before (whatever he does at the moment it is lost)
  let lastSup:any=null;for(const ch of (dec.get(g.i)??[])){if(ch.time>tt+1e-6)break;if(ch.time>=tt-3&&ch.reason===SUPPORT_REASON)lastSup=supClass(g.i,ch);}
  // B keeps it until A wins it back or a restart
  let back=Infinity,restart=Infinity;
  for(let q=k+1;q<n;q++){if(frames[q].restart){restart=frames[q].time;break;}if(poss[q]===A){back=frames[q].time;break;}}
  const until=Math.min(tt+WINDOW,back,restart+.01);
  // recovery: first frame where he is within 1.5 m of his ready position for the ball then (while B keeps it)
  let rec=-1;
  for(let q=k;q<n&&frames[q].time<=until;q++){const gg=gkAt(frames[q],A);if(!gg)break;const rd=readyFor(A,gg.i,frames[q].ball);if(dist(gg.q,rd)<1.5){rec=r2(frames[q].time-tt);break;}}
  let nsh=0,ch=0,mx=0,gl=0,first=-1,firstDepth=-1,firstOff=-1,firstDist=-1,raw=0,rawGoal=0;
  const ids:number[]=[];
  shotEv.forEach((e:any,j:number)=>{
   if(e.side!==B||e.time<=tt||e.time>tt+WINDOW)return;raw++;if(scored.has(e))rawGoal=1;
   if(e.time>until)return;nsh++;const v=shots[j][2];ch+=v;mx=Math.max(mx,v);if(scored.has(e))gl=1;ids.push(j);
   if(first<0){first=r2(e.time-tt);firstDepth=shots[j][5];firstOff=shots[j][6];firstDist=shots[j][4];}
  });
  const ti=to.length;for(const j of ids)if(shots[j][8]<0)shots[j][8]=ti;
  // TO: [0 time, 1 A (lost it), 2 how (HOW index), 3 lostBy, 4 ball depth from A's goal, 5 ball y, 6 A keeper depth off his line,
  //      7 keeper m from his ready position for the ball, 8 keeper m from his goal centre, 9 his arrival time to ready (s),
  //      10 his source, 11 A outfielders goal-side of the ball, 12 carrier m to A's goal (-1),
  //      13 support info at the moment [class, danger, nearest m, ball depth at decision, chosen return s, baseline return s,
  //         chosen-minus-baseline score] or 0, 14 the last support decision in the 3 s before (same shape) or 0,
  //      15 recovered within 1.5 m of ready at s (-1 not within the window), 16 window end s after,
  //      17 B shots in the window, 18 chance sum, 19 best chance, 20 goal 0/1, 21 first shot s (-1), 22 keeper depth at it,
  //      23 keeper m from ready at it, 24 shooter m to goal at it, 25 raw shots within 8 s (whoever has it), 26 raw goal 0/1,
  //      27 A keeper's sweep, 28 his lateral offset from the ball-goal line (m), 29 his |y| (m off the goal's centre line)]
  const sp=(x:any)=>x?[x.cls,r2(x.danger),r1(x.nearest),r1(x.bd),r2(x.rt),r2(x.rt0),r3(x.ds)]:0;
  to.push([r2(tt),A,HOW.indexOf(how),lostBy,r1(bd),r1(f.ball.y),r2(depthOf(A,gk.x)),r2(off),r2(dist(gk,goal)),r2(tBack),src,goalSide,carrier?r1(dist(carrier,goal)):-1,
   sp(si),sp(lastSup),rec,r2(until-tt),nsh,r3(ch),r3(mx),gl,first,firstDepth,firstOff,firstDist,raw,rawGoal,r2(roster[g.i].traits.keeperSweep??.2),r2(lateral(A,gk,f.ball)),r2(Math.abs(gk.y))]);
  // a render window for a turnover with the keeper out of position and a shot after it
  const kind=bd<12&&lateral(A,gk,f.ball)>2.5?'tw':(off>3||depthOf(A,gk.x)>6)?'to':'';
  if(nsh>0&&kind&&eps.filter((e:any)=>e.kind===kind).length<6){
   const end=Math.min(tt+WINDOW,(first>=0?tt+first:tt)+1.2),win:any[]=[];
   for(let s2=tt-1;s2<=end+1e-6;s2+=.25){const fr=frames[frameAt(s2)],own=ownerOf(fr);
    const ps:any[]=[];roster.forEach((_p:any,i:number)=>{const q=pos(fr,i);if(q)ps.push(i,r2(q.x),r2(q.y),r1(q.vx??0),r1(q.vy??0));});
    const gg=gkAt(fr,A);
    win.push([r2(fr.time),r2(fr.ball.x),r2(fr.ball.y),own&&idx.has(own)?idx.get(own)!:-1,gg?sourceOf(gg.i,decAt(gg.i,fr.time)):'',fr.restart?1:0,ps]);}
   eps.push({kind,to:ti,frames:win});
  }
 }
 // ---- 3. opponents' receptions near his goal: is he set, or still out / recovering?
 // RC: [0 time, 1 A (defending), 2 receiver m to A's goal centre, 3 A keeper depth, 4 his lateral offset, 5 m from ready,
 //      6 his source, 7 his depth 2 s before, 8 his source 2 s before, 9 A had the ball within the 3 s before 0/1,
 //      10 B shot within 3 s 0/1, 11 best chance of those, 12 goal within 3 s 0/1, 13 shot index (-1)]
 const rc:any[]=[];
 for(const e of events){
  if(e.kind!=='receive'||(e.side!==0&&e.side!==1)||!e.actor||!idx.has(e.actor))continue;
  const B=e.side,A=1-B,k=frameAt(e.time),f=frames[k];if(f.restart)continue;
  const q=pos(f,idx.get(e.actor)!),g=gkAt(f,A);if(!q||!g)continue;
  const goal={x:worldX(A,0),y:0},rd=dist(q,goal);if(rd>16)continue;
  const ready=readyFor(A,g.i,{...f.ball,owner:e.actor}),f2=frames[frameAt(e.time-2)],g2=gkAt(f2,A);
  let had=0;for(let j=k;j>=0&&frames[j].time>=e.time-3;j--)if(poss[j]===A){had=1;break;}
  let shot=0,best=0,gl=0,si=-1;shotEv.forEach((x:any,j:number)=>{if(x.side===B&&x.time>e.time&&x.time<=e.time+3){shot=1;best=Math.max(best,shots[j][2]);if(scored.has(x))gl=1;if(si<0)si=j;}});
  const off=dist(g.q,ready);
  rc.push([r2(e.time),A,r1(rd),r2(depthOf(A,g.q.x)),r2(lateral(A,g.q,f.ball)),r2(off),sourceOf(g.i,decAt(g.i,e.time)),g2?r2(depthOf(A,g2.q.x)):-1,g2?sourceOf(g2.i,decAt(g2.i,f2.time)):'',had,shot,r3(best),gl,si]);
  if(shot&&off>3&&eps.filter((x:any)=>x.kind==='rc').length<6){
   const win:any[]=[];
   for(let s2=e.time-3;s2<=Math.min(e.time+3,(si>=0?shotEv[si].time:e.time)+1.2)+1e-6;s2+=.25){const fr=frames[frameAt(s2)],own=ownerOf(fr);
    const ps:any[]=[];roster.forEach((_p:any,i:number)=>{const qq=pos(fr,i);if(qq)ps.push(i,r2(qq.x),r2(qq.y),r1(qq.vx??0),r1(qq.vy??0));});
    const gg=gkAt(fr,A);win.push([r2(fr.time),r2(fr.ball.x),r2(fr.ball.y),own&&idx.has(own)?idx.get(own)!:-1,gg?sourceOf(gg.i,decAt(gg.i,fr.time)):'',fr.restart?1:0,ps]);}
   eps.push({kind:'rc',rc:rc.length-1,A,frames:win});
  }
 }
 const official=print(c);
 return {label:t.label,arm:t.arm,seed:t.seed,rev:t.rev,build:run.engineBuild.slice(0,8),plat:`${process.platform}-${process.arch}-node${process.versions.node}`,
  score:c.score,chances:(matchChances(c.chunks.flatMap((x:any)=>x.e),c.header,run.engineBuild)??[0,0]).map(r3),tableBuild:CHANCE_TABLE.build.slice(0,8),
  print:official,
  sweep:[0,1].map(s=>r2(roster[gkIdx[s][0]].traits.keeperSweep??.2)),gk:[0,1].map(s=>{const p=roster[gkIdx[s][0]];return {name:p.name,reading:p.skills.reading,keeping:p.skills.keeping,pace:p.skills.pace};}),
  roster:roster.map((p:any)=>[p.side,p.role,p.name]),
  hist,hl,hy,sup,shots,to,rc,eps,ms};
}
