// Engine audits (2026-10-19): one row per match for three read-only measurements (E skill prices, A drag upper limit,
// W world prices). Evidence only; nothing here writes to the engine.
//
// The match goes through EXACTLY the runMatch call lib/ballers/compute.ts computeMatch makes (engineTeam, sidePlans,
// sideOrders, coordinated, substitutions none, record:true). hook.mjs adds two read-only calls in practice-perception.ts
// (read errors and sight lags); run.mjs --parity proves the hooked row's compact equals computeMatch's.
//
// Arms
//  e.base                    E: the squad-fit average squad on Direct 1-2-1 (squads.ts) v the same (our side = seed % 2,
//                            kick-off = (seed >> 1) % 2, as the squad-fit study: seed s is the same set-up in every arm)
//  e.<skill>.<d>.<who>       E: as e.base with +d points of <skill> on our <who>: d = the defender (SQD2), w = the left
//                            winger (SQD3), s = the striker (SQD5), t = all four outfielders. Capped at 10.
//  m.<a>~<b>                 W: the average squad on plan a (ours, seed % 2) v the average squad on plan b (squads.ts PLANS)
//  r.<HOME>-<AWAY>           A/W: two real frozen league sides (../2026-10-09-scenarios/sides, md5-checked by run.mjs, no
//                            manager field, their own plans and substitution orders as computeMatch plays them),
//                            kick-off = seed % 2
//
// Row keys
//  score, chances (official table), print (compact fingerprint), build, plat, ms, inPlay (s of open play, no restart frame),
//  played (s)
//  sp[]   every possession spell (possession = last side in control; a restart counts for its side; deep.ts rule):
//         [side, start (0 restart, 1 open play, 2 kick-off), t0 (s), dur (s), passes, end (0 lost in open play, 1 restart,
//          2 match end), start depth (m from own goal), shots, goals, first shot (s from t0, -1), first goal (s, -1),
//          at a loss: losing side's outfielders within 8 m of the ball, the winners' outfielders within 8 m (else -1, -1),
//          start how (open play: 0 tackle, 1 intercept, 2 loose, 3 keeper, 4 other; -1 restart), restart kind or '']
//  lb[]   open-play passes 12 m+ or lofted: [side, lofted, len, from depth, gain, cat] cat: 1 first touch ours (no loose
//         ball), 2 first touch theirs, 3 ran loose then ours, 4 ran loose then theirs, 5 nobody within 4 s / restart
//  shots[] [side, t, chance, goal, spell index]
//  pass[side] [open-play passes, kept by a team-mate]
//  pl{id} per outfielder (E mechanisms): [passes, kept, fwd passes (gain >= 5 m), fwd kept, tackles as defender,
//         won, duels faced as carrier, kept, races entered, races won, sum race margin (s), shots, goals, chance sum,
//         receptions, lost within 1.5 s, top speed 0-5, 5-10, 10-15 min (m/s), metres, metres > 5.5 m/s, energy at 15:00,
//         lane reads n, sum |error|/spread, arrival n, sum, race n, sum, pressure n, sum, other n, sum, sight n, sum lag,
//         loose balls won (first owner of a loose ball), interceptions (first control after an opponent's pass)]
//  A (r.* arms only) per side, see dragRead below.
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {matchChances,shotChance} from '../../../../lib/ballers/chances';
import {groundPass} from '../../src/practice-passing';
import {energyTop} from '../../src/practice-match';
import {side as sqSide,PLANS} from './squads';

let SIDES:Record<string,any>={};
export function init(s:Record<string,any>){SIDES=s;}

const L=48,WH=15;
const SKILLS=['pace','control','passing','reading','stamina','strength','defending','finishing','aerial','setPieces'];
const WHO:Record<string,string[]>={d:['SQD2'],w:['SQD3'],s:['SQD5'],t:['SQD2','SQD3','SQD4','SQD5']};
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const depthOf=(s:number,x:number)=>s===0?x:L-x;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};

export function inputOf(arm:string,seed:number):any{
 let m:RegExpExecArray|null;
 if(arm==='e.base'||(m=/^e\.([a-zA-Z]+)\.(\d)\.([dwst])$/.exec(arm))){
  const ours=seed%2,us=sqSide('SQD','#3fd38a','avg','dir'),them=sqSide('OPP','#d33f6a','avg','dir');
  if(arm!=='e.base'){
   const [,skill,d,who]=m!;if(!SKILLS.includes(skill))throw Error('unknown skill '+skill);
   for(const p of us.players)if(WHO[who].includes(p.id))p.skills[skill]=Math.min(10,r1(p.skills[skill]+Number(d)));
  }
  const sides=[null,null] as any[];sides[ours]=us;sides[1-ours]=them;
  return {v:1,match:`audit-${seed}`,seed,kickoff:(seed>>1)%2,duration:900,sides};
 }
 if((m=/^m\.([a-z0-9]+)~([a-z0-9]+)$/.exec(arm))){
  const [,a,b]=m;if(!PLANS[a]||!PLANS[b])throw Error('unknown plan in '+arm);
  const ours=seed%2,sides=[null,null] as any[];sides[ours]=sqSide('SQD','#3fd38a','avg',a);sides[1-ours]=sqSide('OPP','#d33f6a','avg',b);
  return {v:1,match:`audit-${seed}`,seed,kickoff:(seed>>1)%2,duration:900,sides};
 }
 if((m=/^r\.([A-Z]+)-([A-Z]+)$/.exec(arm))){
  const [,h,a]=m;if(!SIDES[h]||!SIDES[a])throw Error('unknown side in '+arm);
  const sides=[h,a].map(c=>{const b=JSON.parse(JSON.stringify(SIDES[c]));delete b.voice;return b;});
  return {v:1,match:`audit-${arm}-${seed}`,seed,kickoff:seed%2,duration:900,sides};
 }
 throw Error('unknown arm '+arm);
}
export const armTreatment=(arm:string)=>inputOf(arm,0)&&arm;

/** computeMatch, unchanged: the parity reference. */
export function plain(t:{arm:string;seed:number}){
 const c=computeMatch(inputOf(t.arm,t.seed));
 return {arm:t.arm,seed:t.seed,score:c.compact.score,print:print(c.compact)};
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const inp=inputOf(t.arm,t.seed);
 // read errors and sight lags per player (hook.mjs)
 const READS=['lane','arrival','race','pressure'];
 const rd=new Map<string,number[]>();
 const rdOf=(id:string)=>{let a=rd.get(id);if(!a){a=new Array(12).fill(0);rd.set(id,a);}return a;};
 (globalThis as any).__pv=(p:any,read:string,e:number,spread:number)=>{if(!(spread>0))return;const a=rdOf(p.id);let k=READS.indexOf(read);if(k<0)k=4;a[k*2]++;a[k*2+1]+=Math.abs(e)/spread;};
 (globalThis as any).__sl=(p:any,lag:number)=>{const a=rdOf(p.id);a[10]++;a[11]+=lag;};
 let run:any,c:any;const t0=performance.now();
 try{
  // computeMatch's runMatch call, verbatim (lib/ballers/compute.ts:87-95)
  const teams=inp.sides.map(engineTeam);
  const plans=inp.sides.map(sidePlans);
  const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
  const subs=sideOrders(inp,teams as any);
  run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
  c=compact(inp,run.result);
 }finally{(globalThis as any).__pv=undefined;(globalThis as any).__sl=undefined;}
 const ms=Math.round(performance.now()-t0);
 const R=run.result,roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const evIdxAt=(time:number)=>{let lo=0,hi=events.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(events[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best;};
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const ctrlOf=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const ownerOf=(f:any)=>f.restart?null:(f.ball?.owner??null);
 const outIdx=(s:number)=>roster.map((p:any,i:number)=>({p,i})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i);
 const OUT=[outIdx(0),outIdx(1)];
 const onPitch=(f:any,i:number)=>!!pos(f,i);

 // ---- official
 const ev=c.chunks.flatMap((ch:any)=>ch.e);
 const chances=matchChances(ev,c.header,run.engineBuild);
 const chanceAt=new Map<number,number>();
 for(const e of ev)if(e.k==='shot')chanceAt.set(e.t,shotChance(e)??0);
 const chanceOf=(e:any)=>{const tt=Math.round(e.time*1000);for(const d of [0,1,-1,2,-2]){const v=chanceAt.get(tt+d);if(v!==undefined)return v;}return 0;};

 // ---- in-play time
 let inPlay=0;
 for(let k=0;k+1<n;k++){const f=frames[k],g=frames[k+1],dt=g.time-f.time;if(dt>0&&dt<1&&!f.restart&&!g.restart&&!g.cut)inPlay+=dt;}

 // ---- possession spells (deep.ts rule)
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
    if(how===4){// a loose ball nobody kicked to us
     for(let q=k-1;q>=0&&q>k-30;q--){if(frames[q].ball?.mode==='loose'){how=2;break;}if(ownerOf(frames[q]))break;}
    }
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
  // numbers round the ball at the loss (the first frame the winners control it)
  const f=frames[nx.k0],b=f.ball;let nl=0,nw=0;
  for(const i of OUT[sp.s]){const p=pos(f,i);if(p&&dist(p,b)<8)nl++;}
  for(const i of OUT[1-sp.s]){const p=pos(f,i);if(p&&dist(p,b)<8)nw++;}
  sp.nl=nl;sp.nw=nw;
 }
 const spellIx=(time:number,s:number)=>{for(let q=spells.length-1;q>=0;q--){const sp=spells[q];if(sp.t0<=time+1e-6)return sp.s===s?q:-1;}return -1;};
 const shots:any[]=[];
 const shotEv=events.filter((e:any)=>e.kind==='shot'&&(e.side===0||e.side===1));
 const scoredT=new Set<number>();
 for(const g of events)if(g.kind==='goal'&&(g.side===0||g.side===1)){for(let k=shotEv.length-1;k>=0;k--){const x=shotEv[k];if(x.time>g.time+1e-6)continue;if(x.time<g.time-4)break;if(x.side===g.side){scoredT.add(x.time);break;}}}
 for(const e of shotEv){const q=spellIx(e.time,e.side),goal=scoredT.has(e.time)?1:0;shots.push([e.side,r1(e.time),r3(chanceOf(e)),goal,q]);
  if(q>=0){spells[q].shots.push(e.time-spells[q].t0);if(goal)spells[q].goals.push(e.time-spells[q].t0);}}

 // ---- passes, long balls, per-player passing
 const NP=26,pl:Record<string,number[]>={};
 for(const s of [0,1])for(const i of OUT[s])pl[roster[i].id]=new Array(NP+2).fill(0);
 const P=(id:any)=>id!=null?pl[id]:undefined;
 const pass=[[0,0],[0,0]],lb:any[]=[];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const S=e.side,D=1-S,f=frames[frameAt(e.time)],pi=idx.get(e.actor);if(pi===undefined)continue;const p=pos(f,pi),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const sq=spellIx(e.time,S);if(sq>=0)spells[sq].passes++;
  let kept=0;
  for(let r=q+1;r<events.length&&events[r].time<e.time+8;r++){const x=events[r];
   if(x.kind==='receive'&&x.side===S){kept=1;break;}
   if(x.kind==='turnover'||x.kind==='save'||(x.kind==='tackle'&&x.side===D)||x.kind==='block'||x.kind==='clearance'||x.kind==='out'||x.kind==='offside'||x.kind==='foul'||x.kind==='restart')break;
  }
  pass[S][0]++;pass[S][1]+=kept;
  const len=dist(p,aim),from=depthOf(S,p.x),gain=depthOf(S,aim.x)-from,a=P(e.actor);
  if(a){a[0]++;a[1]+=kept;if(gain>=5){a[2]++;a[3]+=kept;}}
  if(e.aerial||len>=12){
   let cat=5,loose=false;
   for(let k=frameAt(e.time)+1;k<n&&frames[k].time<=e.time+4;k++){const g=frames[k];if(g.restart){cat=5;break;}const o=g.ball?.owner;
    if(o&&!(o===e.actor&&g.time<e.time+.3)){const w=sideOf(o);cat=loose?(w===S?3:4):(w===S?1:2);break;}
    if(g.ball?.mode==='loose')loose=true;}
   lb.push([S,e.aerial?1:0,r1(len),r1(from),r1(gain),cat]);
  }
 }
 // tackles / duels: the carrier is the owner just before the event
 for(const e of events){
  if(e.kind!=='tackle')continue;
  const before=frames[frameAt(e.time-.05)],carrier=ownerOf(before);
  if(carrier&&e.actor===carrier){const c1=P(e.actor),d1=P(e.target);if(c1){c1[6]++;c1[7]++;}if(d1)d1[4]++;}
  else{const d1=P(e.actor),c1=P(e.target);if(d1){d1[4]++;d1[5]++;}if(c1)c1[6]++;}
 }
 // shots, receptions, quick losses
 for(const e of shotEv){const a=P(e.actor);if(a){a[11]++;if(scoredT.has(e.time))a[12]++;a[13]+=chanceOf(e);}}
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='receive'||(e.side!==0&&e.side!==1))continue;const a=P(e.actor);if(!a)continue;a[14]++;
  for(let r=q+1;r<events.length&&events[r].time<=e.time+1.5;r++){const x=events[r];
   if(x.actor===e.actor&&(x.kind==='pass'||x.kind==='clearance'||x.kind==='shot'))break;
   if((x.kind==='turnover'||x.kind==='save')&&x.side===1-e.side){a[15]++;break;}
   if(x.kind==='out'||x.kind==='foul'||x.kind==='restart')break;}
 }
 // loose-ball races: a run of open-play frames with the ball loose and nobody on it. Contested = both sides have an
 // outfielder within 12 m at its start. Each side's entrant = its nearest outfielder at the start; his arrival = the first
 // frame within 1.0 m of the ball (or he is the next owner). Margin = the other entrant's arrival - his (each capped at
 // the episode's end + 0.5 s). Won = his side has the next owner.
 for(let k=1;k<n;){
  const f=frames[k];
  if(!f.restart&&!f.ball.owner&&f.ball.mode==='loose'){
   let j=k;while(j+1<n&&!frames[j+1].restart&&!frames[j+1].ball.owner&&frames[j+1].ball.mode==='loose')j++;
   const nx=frames[j+1],w=nx&&!nx.restart&&nx.ball.owner?sideOf(nx.ball.owner):-1;
   if(nx&&!nx.restart&&nx.ball.owner){const a=P(nx.ball.owner);if(a)a[NP]++;}
   const ent=[-1,-1];
   for(const s of [0,1]){let best=12;for(const i of OUT[s]){const p=pos(f,i);if(!p)continue;const d=dist(p,f.ball);if(d<best){best=d;ent[s]=i;}}}
   if(ent[0]>=0&&ent[1]>=0){
    const cap=frames[j].time+.5,arr=[cap,cap];
    for(const s of [0,1]){const i=ent[s];
     if(nx&&nx.ball.owner===roster[i].id)arr[s]=Math.min(arr[s],nx.time);
     for(let q=k;q<=j;q++){const p=pos(frames[q],i);if(p&&dist(p,frames[q].ball)<=1){arr[s]=frames[q].time;break;}}}
    for(const s of [0,1]){const a=P(roster[ent[s]].id);if(!a)continue;a[8]++;if(w===s)a[9]++;a[10]+=arr[1-s]-arr[s];}
   }
   k=j+1;
  }else k++;
 }
 // interceptions: the first control of a spell started by an opponent's pass (how 1)
 for(const sp of spells)if(sp.how===1){const o=ctrlOf(frames[sp.k0]);const a=P(o);if(a)a[NP+1]++;}
 // movement and energy
 for(const s of [0,1])for(const i of OUT[s]){
  const a=pl[roster[i].id];
  for(let k=1;k<n;k++){const f=frames[k],g=frames[k-1];const p=pos(f,i);if(!p)continue;
   if(!f.cut&&!f.restart){const v=Math.hypot(p.vx,p.vy),qd=f.time<300?0:f.time<600?1:2;if(v>a[16+qd])a[16+qd]=v;}
   const q=pos(g,i),dt=f.time-g.time;if(!q||f.cut||dt<=0||dt>.25)continue;const d=dist(p,q);a[19]+=d;if(Math.hypot(p.vx,p.vy)>5.5)a[20]+=d;}
  const fe=frames[frameAt(900)],p=pos(fe,i);a[21]=p?p.energy:-1;
 }
 // the per-player rows (reads from the hook laid out after the movement fields)
 const plOut:Record<string,number[]>={};
 for(const [id,a] of Object.entries(pl)){
  const r=rd.get(id)??new Array(12).fill(0);
  plOut[id]=[a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8],a[9],r2(a[10]),a[11],a[12],r3(a[13]),a[14],a[15],r2(a[16]),r2(a[17]),r2(a[18]),Math.round(a[19]),Math.round(a[20]),r1(a[21]),
   r[0],r2(r[1]),r[2],r2(r[3]),r[4],r2(r[5]),r[6],r2(r[7]),r[8],r2(r[9]),r[10],r2(r[11]),a[NP],a[NP+1]];
 }

 const A=t.arm.startsWith('r.')?dragRead(R,spells,poss):null;
 return {label:t.label,kind:'audit',arm:t.arm,seed:t.seed,rev:t.rev,kickoff:inp.kickoff,ours:t.arm.startsWith('r.')?-1:t.seed%2,
  styles:inp.sides.map((s:any)=>s.style),forms:inp.sides.map((s:any)=>s.formation),codes:inp.sides.map((s:any)=>s.club?.code),
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:run.engineBuild.slice(0,8),
  score:c.score,chances:chances?chances.map(r3):null,print:print(c),ms,played:R.played??R.duration,inPlay:r1(inPlay),
  sp:spells.map(sp=>[sp.s,sp.start,r1(sp.t0),r1(sp.t1-sp.t0),sp.passes,sp.end,r1(depthOf(sp.s,frames[sp.k0].ball.x)),sp.shots.length,sp.goals.length,
   sp.shots.length?r1(sp.shots[0]):-1,sp.goals.length?r1(sp.goals[0]):-1,sp.nl,sp.nw,sp.how,sp.rk]),
  lb,shots,pass,pl:plOut,A};
}

// ---- A: depth at ready moments, runs per possession, and the drag counterfactual --------------------------------------
// Sampling every 0.25 s of open play with an outfield carrier. Zone by the ball's depth (0 own third <16, 1 middle, 2 final).
// "Open" = >= 2.5 m from every opposing outfielder; "ahead" = >= 5 m upfield of the ball and <= 22 m from it; "lane" = the
// engine's own groundPass(carrier, mate) plan risk <= 0.42 (the support study's definitions, 2026-10-14-support-study).
// Ready = the carrier has had the ball >= 0.3 s, no opposing outfielder within 2.5 m, facing upfield (within 90 deg).
// A[side] keys:
//  all[z] / ready[z]  [samples, anyone ahead (open or not), open ahead, open ahead with lane]
//  runs   [run-job starts while we have the ball, of those with the ball in the middle third, kinematic runs (forward speed
//          >= 4 m/s for >= 0.5 s, off the ball, while we have it), of those ending >= 2 m ahead of the ball]
//  poss   [our spells, our spells that have a middle-third carrier sample]
//  drag   middle-third samples with no open forward option with an open lane:
//         [moments, no marker for any off-ball mate, some drag frees a mate (5 m), same with 8 m, some drag opens carry room,
//          the dragger's own run frees him, a mate stepping towards the marker's old spot is freed (raw), the same but only
//          when it would NOT work with the marker left where he was (credited to the drag), any of mate/carry, any of
//          mate/carry/step-credited, any of those or the self run]
//  dragBy {"<dir>|<t>|<role>": [mate frees, carry opens, step frees (credited), self frees]} counted per dragger run
//         dir: f forward, fd forward diagonal, l lateral, bd back diagonal, b back; t: 1.0 / 1.5 s
//  mark   [off-ball mate samples in those moments, with a job marker, with a near fallback marker, none]
function dragRead(R:any,spells:any[],poss:Int8Array){
 const roster:any[]=R.players,frames:any[]=R.frames,choices:any[]=R.choices,n=frames.length;
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const ownerOf=(f:any)=>f.restart?null:(f.ball?.owner??null);
 const live=(f:any,i:number)=>{const q=pos(f,i);if(!q)return null;const p=roster[i];return {...p,x:q.x,y:q.y,vx:q.vx,vy:q.vy,angle:q.angle,energy:q.energy,pace:p.basePace*energyTop(q.energy,p.role==='GK')};};
 const jobsBy=new Map<number,any[]>();
 for(const ch of choices){const a=jobsBy.get(ch.player)??[];a.push(ch);jobsBy.set(ch.player,a);}
 const choiceAt=(i:number,time:number)=>{const a=jobsBy.get(i);if(!a)return null;let lo=0,hi=a.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best>=0?a[best]:null;};
 const z3=()=>[[0,0,0,0],[0,0,0,0],[0,0,0,0]];
 const mk=()=>({all:z3(),ready:z3(),runs:[0,0,0,0],poss:[0,0],drag:new Array(11).fill(0),dragBy:{} as Record<string,number[]>,mark:[0,0,0,0]});
 const A=[mk(),mk()];
 const OPEN=2.5,AHEAD=5,REACH=22,LANE=.42;
 const zone=(d:number)=>d<16?0:d<32?1:2;
 // distance coverable in t s along unit u (the engine's arrivalTime kinematics inverted: momentum along u, acceleration,
 // pace * 0.94)
 const reach=(p:any,u:{x:number;y:number},t:number)=>{const sp=p.pace*.94,v=Math.max(-sp,Math.min(sp,p.vx*u.x+p.vy*u.y)),a=p.acceleration;
  const ta=(sp-v)/a;const d=t<=ta?v*t+.5*a*t*t:v*ta+.5*a*ta*ta+(t-ta)*sp;return Math.max(0,d);};
 const inside=(v:{x:number;y:number})=>({x:Math.max(.5,Math.min(L-.5,v.x)),y:Math.max(-WH+.5,Math.min(WH-.5,v.y))});
 // owner since: when the current owner got the ball
 const since=new Float64Array(n);{let o:any=null,t0=0;for(let k=0;k<n;k++){const w=ownerOf(frames[k]);if(w!==o){o=w;t0=frames[k].time;}since[k]=t0;}}
 // our spells and their middle-third samples
 for(const sp of spells)A[sp.s].poss[0]++;
 const spellOfFrame=new Int32Array(n).fill(-1);spells.forEach((sp:any,q:number)=>{for(let k=sp.k0;k<=sp.k1;k++)spellOfFrame[k]=q;});
 const midSpell=new Set<number>();
 // run-job starts
 for(const [i,a] of jobsBy){const p=roster[i];if(p.role==='GK')continue;let prev='';
  for(const ch of a){if(ch.kind==='run'&&prev!=='run'){const k=Math.max(0,Math.min(n-1,frameAtT(frames,ch.time)));if(poss[k]===p.side&&!frames[k].restart){A[p.side].runs[0]++;if(zone(depthOf(p.side,frames[k].ball.x))===1)A[p.side].runs[1]++;}}prev=ch.kind;}}
 // kinematic runs
 for(const s of [0,1])for(let i=0;i<roster.length;i++){const p=roster[i];if(p.side!==s||p.role==='GK')continue;let st=-1;
  for(let k=0;k<n;k++){const f=frames[k],q=pos(f,i);const fwd=q?(s===0?q.vx:-q.vx):0;const on=!!q&&!f.restart&&poss[k]===s&&ownerOf(f)!==p.id&&fwd>=4;
   if(on){if(st<0)st=k;}
   else if(st>=0){if(frames[k-1].time-frames[st].time>=.5){A[s].runs[2]++;const e=frames[k-1],qe=pos(e,i);if(qe&&depthOf(s,qe.x)-depthOf(s,e.ball.x)>=2)A[s].runs[3]++;}st=-1;}}}
 let next=0;
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.time<next-1e-9)continue;next=f.time+.25;
  const o=ownerOf(f);if(!o)continue;const s=sideOf(o);if(s<0)continue;const ci=idx.get(o)!;if(roster[ci].role==='GK')continue;
  const carrier=live(f,ci);if(!carrier)continue;
  const bd=depthOf(s,f.ball.x),z=zone(bd),b={x:f.ball.x,y:f.ball.y},a=A[s];
  const opp:any[]=[],oppOut:any[]=[],oppIx:number[]=[];
  roster.forEach((p:any,i:number)=>{if(p.side===s)return;const q=live(f,i);if(!q)return;opp.push(q);if(p.role!=='GK'){oppOut.push(q);oppIx.push(i);}});
  const mates:{i:number;q:any}[]=[];
  roster.forEach((p:any,i:number)=>{if(p.side!==s||p.role==='GK'||i===ci)return;const q=live(f,i);if(q)mates.push({i,q});});
  const isOpen=(q:any,os:any[])=>!os.some(d=>Math.hypot(d.x-q.x,d.y-q.y)<OPEN);
  const laneOk=(q:any,os:any[])=>{try{return groundPass(carrier,q,false,undefined,b,os).risk<=LANE;}catch{return false;}};
  const option=(q:any,os:any[],osAll:any[],ahead=AHEAD)=>depthOf(s,q.x)-bd>=ahead&&Math.hypot(q.x-b.x,q.y-b.y)<=REACH&&isOpen(q,os)&&laneOk(q,osAll);
  // carry room: no opposing outfielder within 6 m in a 50-degree cone ahead of the ball
  const carryRoom=(os:any[])=>!os.some(d=>{const dx=(s===0?1:-1)*(d.x-b.x),dy=d.y-b.y,r=Math.hypot(dx,dy);return r<6&&dx>0&&Math.abs(Math.atan2(dy,dx))<50*Math.PI/180;});
  let anyAhead=0,openAhead=0,laneAhead=0;
  for(const m of mates){const rel=depthOf(s,m.q.x)-bd,dB=Math.hypot(m.q.x-b.x,m.q.y-b.y);if(rel>=AHEAD&&dB<=REACH){anyAhead=1;if(isOpen(m.q,oppOut)){openAhead=1;if(!laneAhead&&laneOk(m.q,opp))laneAhead=1;}}}
  const add=(arr:number[])=>{arr[0]++;arr[1]+=anyAhead;arr[2]+=openAhead;arr[3]+=laneAhead;};
  add(a.all[z]);
  const ready=f.time-since[k]>=.3&&!oppOut.some(d=>dist(d,carrier)<OPEN)&&(s===0?1:-1)*Math.cos(carrier.angle)>=0;
  if(ready)add(a.ready[z]);
  if(z!==1)continue;
  const q=spellOfFrame[k];if(q>=0&&!midSpell.has(q)){midSpell.add(q);a.poss[1]++;}
  if(laneAhead)continue;// a forward option with an open lane already exists
  // ---- the drag counterfactual
  const d=a.drag;d[0]++;
  const base=carryRoom(oppOut);
  let anyMarker=false,fMate=false,fMate8=false,fCarry=false,fSelf=false,fStep=false,fStepRaw=false;
  for(const m of mates){
   a.mark[0]++;
   let mi=-1;
   for(let j=0;j<oppIx.length;j++){const c=choiceAt(oppIx[j],f.time);if(c&&c.assignment?.target===roster[m.i].id&&(c.assignment.purpose==='mark'||c.kind==='track')){mi=j;break;}}
   if(mi>=0)a.mark[1]++;
   else{let best=5;for(let j=0;j<oppOut.length;j++){const dd=dist(oppOut[j],m.q);if(dd<best){best=dd;mi=j;}}if(mi>=0)a.mark[2]++;else a.mark[3]++;}
   if(mi>=0)anyMarker=true;
   const M=mi>=0?oppOut[mi]:null,off=M?{x:M.x-m.q.x,y:M.y-m.q.y}:null;
   const fw=s===0?1:-1;
   for(const t of [1,1.5])for(let dk=0;dk<8;dk++){
    const ang=dk*Math.PI/4,u={x:fw*Math.cos(ang),y:Math.sin(ang)};
    const dir=dk===0?'f':dk===1||dk===7?'fd':dk===2||dk===6?'l':dk===3||dk===5?'bd':'b';
    const spot=inside({x:m.q.x+u.x*reach(m.q,u,t),y:m.q.y+u.y*reach(m.q,u,t)});
    const runner={...m.q,x:spot.x,y:spot.y};
    let os=oppOut,osAll=opp,Mn:any=null;
    if(M){// the marker keeps his offset to his man, limited by his own legs after a 0.2 s pick-up
     const tgt=inside({x:spot.x+off!.x,y:spot.y+off!.y}),dd=dist(M,tgt);
     const uu=dd>1e-6?{x:(tgt.x-M.x)/dd,y:(tgt.y-M.y)/dd}:{x:0,y:0},can=reach(M,uu,Math.max(0,t-.2)),k2=dd>0?Math.min(1,can/dd):0;
     Mn={...M,x:M.x+(tgt.x-M.x)*k2,y:M.y+(tgt.y-M.y)*k2};
     os=oppOut.map(x=>x===M?Mn:x);osAll=opp.map(x=>x===M?Mn:x);
    }
    const key=`${dir}|${t}|${roster[m.i].role}`,by=(a.dragBy[key]??=[0,0,0,0]);
    // the runner himself
    const self=option(runner,os,osAll);
    // another mate (frozen) now an option
    let mate=false,mate8=false;
    for(const o2 of mates){if(o2.i===m.i)continue;if(option(o2.q,os,osAll)){mate=true;if(depthOf(s,o2.q.x)-bd>=8)mate8=true;}}
    const carry=!base&&carryRoom(os);
    // a mate stepping into the spot the marker left
    let step=false,stepRaw=false;
    if(M)for(const o2 of mates){if(o2.i===m.i)continue;const dd=dist(o2.q,M);if(dd<.5)continue;const uu={x:(M.x-o2.q.x)/dd,y:(M.y-o2.q.y)/dd},go=Math.min(dd,reach(o2.q,uu,t));
     const st={...o2.q,x:o2.q.x+uu.x*go,y:o2.q.y+uu.y*go};if(option(st,os,osAll)){stepRaw=true;if(!option(st,oppOut,opp)){step=true;break;}}}
    if(mate&&M){fMate=true;by[0]++;}if(mate8&&M)fMate8=true;
    if(carry&&M){fCarry=true;by[1]++;}
    if(stepRaw)fStepRaw=true;if(step){fStep=true;by[2]++;}
    if(self){fSelf=true;by[3]++;}
   }
  }
  if(!anyMarker)d[1]++;
  if(fMate)d[2]++;if(fMate8)d[3]++;if(fCarry)d[4]++;if(fSelf)d[5]++;if(fStepRaw)d[6]++;if(fStep)d[7]++;
  if(fMate||fCarry)d[8]++;if(fMate||fCarry||fStep)d[9]++;if(fMate||fCarry||fStep||fSelf)d[10]++;
 }
 return A;
}
function frameAtT(frames:any[],time:number){let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;}
