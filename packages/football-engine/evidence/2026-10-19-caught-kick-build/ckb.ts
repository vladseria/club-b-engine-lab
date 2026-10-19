// Caught kick BUILD (2026-10-19, branch engine-caught-kick): ../2026-10-19-caught-kick/ck.ts copied, with
//  - the flag by revision NAME: rev `off` plays with practice-possession CAUGHT_KICK.byBall false (the previous body
//    read), rev `on` with it true; any other rev name must be a revision without the flag (e.g. `live` = main, the
//    flag-off parity reference). Every rev may bundle the same tree;
//  - the hook's choice call also passes the ball (./hook.mjs), and each set row gains, for a choice on the ball (-9
//    otherwise): 31 the body read's caught share for the chosen kick (the previous rule: perceived arrival on his body
//    + CHALLENGE_LAND, against his read horizon), 32 the ball read's (perceived footOnBall, the new rule), 33 the exact
//    first footOnBall (s), 34 the nearest opposing outfielder to the BALL (m), 35 the ball's distance from him (m),
//    36 the chosen kick's length (m). Both reads are computed here by the harness's own copy of the formulas, so the
//    two builds are read identically;
//  - dc[side]: open-play choices on the ball: [n, pressed (an opposing outfielder within 2.2 m of the ball),
//    pressed: pass-like kick, of those hurried, of those short (< 6 m), clearance, carry to protect/escape, other carry,
//    feint, shot]
//  - pp[side]: open-play passes by outcome (analyse ps): [n, kept, intercepted in flight, lost loose, restart, kept but
//    lost within 1 s]; sg[side]: [spells, spells with a shot, shots, goals, chance sum];
//  - hash: [length, fnv-a, fnv-b] of the whole PracticeResult (the parity fingerprint).
// The ck.ts header follows.
// Caught kick (2026-10-19): is "caught while still setting a pass under pressure" still an issue after release 2's
// "decide before receiving"? Evidence only; nothing here writes to the engine.
//
// The same match as ../2026-10-19-world-prices/wp.ts plays (computeMatch's runMatch call, verbatim; the six frozen real
// league sides of ../2026-10-09-scenarios/sides, kick-off = seed % 2), on either engine: run.mjs bundles this entry once
// per revision (_ci/revs.mjs: every lib/ and engine import resolves to that revision's own copy), so release 1
// (main 0207e34b, ENGINE_BUILD 9af97c9c) and live (dbdb6b81) play the same frozen inputs through their own compute.
// hook.mjs exposes read-only values (the carrier's choice, the kick being set each tick, the release, the reception's
// first-time decision); the world-prices analysis (analyse.ts, pure) is reused unchanged for losses and spells.
//
// Row keys: score, print (compact fingerprint), build, inPlay (s), nsp [spells per side], ls (world-prices LOSS
// records, layout in ../2026-10-19-world-prices/wp.ts), and ck:
//  ck.sets[]  one per kick SET (the engine's `prepared`: from the tick it is set until it is struck, lost or dropped),
//             open play only (no restart, not a keeper's ball in his hands):
//   0 side  1 roster index  2 t0  3 kind (0 pass 1 through 2 loft 3 clear 4 shoot)  4 hurried 0/1
//   5 source: 0 a choice on the ball (chooseFootballOption), 1 the plan he arrived with, set at the reception, 2 other
//   6 s since he gained the ball (t0 - receivedAt)   7 s from the decision to t0 (plan: t0 - plan.since; choice 0)
//   8 planned set (prepared.at - t0, s)   9 strike horizon = planned set + footToBall (s)
//   10 nearest opposing outfielder (m)   11 his closing speed (m/s, + = closing)   12 the first opposing outfielder's
//   arrival on him (engine arrivalTime, exact picture; s, 99 none)   13 opposing outfielders within 3 m
//   14 outcome: 0 struck, 1 the ball left him unstruck (lost / knocked away), 2 dropped (re-chose, still his ball),
//   3 other (restart / end)   15 s from t0 to that outcome   16 s from t0 until an opposing outfielder first came within
//   1 m of him (-1 never while set)   17 closest opposing outfielder during the set (m)
//   choice only (-9 otherwise): 18 chosen score  19 best score among quicker kicks (strike horizon >= 0.08 s shorter
//   than the chosen one's, hurried included)  20 that kick's horizon saving (s)  21 best score among other kicks that get
//   away before the presser's tackle lands (horizon < arrival + 0.16)  22 chosen kick horizon at the choice (exact
//   kickHorizon, hurried share applied)  23 best other option's score  24 best carry/feint/protect score
//   25 chosen kick gets away before the tackle lands 0/1
//   plan only (-1 otherwise): 26 his read said first time (plan.first; release 1 has no such read: -1)  27 plan held at
//   the touch (s)  28 meeting speed (m/s)
//   29 ball depth from his own goal (m)  30 role code (0 GK 1 DEF 2 MID/W 3 ST)
//  ck.lj[]    one per ls record: [ls index, set index of the kick he was setting when the ball left him (-1 none),
//             winner's minimum control: 1 when B's controller kept it >= 0.5 s or his release was a pass/clearance/shot]
//  ck.rec     open-play receptions of a team-mate's pass, per side
//  ck.tch     per side [released outfield spells, released with <= 1 touch, <= 2 touches, sum of time on ball (s)]
//             (the decide round's watch.ts spell rule: gain to his pass/clearance/shot; touches = his control contacts)
//  ck.eps     (seeds 0-1) render windows of caught kicks (analyse.ts eps format) and ck.ro the roster
import {runMatch} from '../../src/index';
import {arrivalTime} from '../../src/practice-arrival';
import * as poss from '../../src/practice-possession';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {shotChance} from '../../../../lib/ballers/chances';
import {analyse,DUTIES} from '../2026-10-19-world-prices/analyse';
import {perceive} from '../../src/practice-perception';

let SIDES:Record<string,any>={};
export function init(s:Record<string,any>){SIDES=s;}
const L=48;
const depthOf=(s:number,x:number)=>s===0?x:L-x;
const r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};
const KICK=['pass','through','loft','clear','shoot'];
const HURRY:number=(poss as any).HURRY_SHARE??1;// release 1 has no hurried kick
const LAND=.16;// a challenge lands 0.16-0.30 s after he arrives (practice-possession CHALLENGE_LAND, live)
const roleCode=(r:string)=>r==='GK'?0:['CB','FB','DM','DEF'].includes(r)?1:r==='ST'?3:2;

// the two reads, in the harness's own words (same formulas as practice-possession, so both builds are read alike)
const clampN=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function within(p:any,pt:any,reach:number){const d=Math.hypot(pt.x-p.x,pt.y-p.y),gap=Math.max(0,d-reach),ux=(pt.x-p.x)/(d||1),uy=(pt.y-p.y)/(d||1);
 const speed=p.pace*.94,v=clampN(p.vx*ux+p.vy*uy,-speed,speed),a=p.acceleration,acc=(speed-v)/a,cov=v*acc+.5*a*acc*acc;
 return gap<=cov?(-v+Math.sqrt(v*v+2*a*gap))/a:acc+(gap-cov)/speed;}
const footOn=(q:any,ball:any)=>Math.max(within(q,ball,2.2)+.16,within(q,ball,1.54));
const LOOK=.3,SPAN=.3;
function reads(p:any,players:any[],ball:any,option:any,time:number){
 const opp=players.filter((q:any)=>q.side!==p.side&&q.role!=='GK');if(!opp.length||!ball)return [-9,-9,-9,-9];
 let hzr=poss.readKickHorizon(p,option.aim,option.kind);if(option.hurried)hzr-=(1-HURRY)*poss.preparationTime(p,option.kind);
 const body=Math.min(...opp.map((q:any)=>arrivalTime(q,p))),fb=Math.min(...opp.map((q:any)=>footOn(q,ball)));
 const sb=Math.max(0,perceive(p,'arrival',body,LOOK,p,{time,salt:'caught'})),sf=Math.max(0,perceive(p,'arrival',fb,LOOK,p,{time,salt:'caught'}));
 return [r3(clampN((hzr-sb-.16)/SPAN,0,1)),r3(clampN((hzr-sf)/SPAN,0,1)),r3(Math.min(fb,99)),r2(Math.min(...opp.map((q:any)=>Math.hypot(q.x-ball.x,q.y-ball.y))))];
}

export function inputOf(arm:string,seed:number):any{
 const m=/^r\.([A-Z]+)-([A-Z]+)$/.exec(arm);if(!m)throw Error('unknown arm '+arm);
 const [,h,a]=m;if(!SIDES[h]||!SIDES[a])throw Error('unknown side in '+arm);
 const sides=[h,a].map(c=>{const b=JSON.parse(JSON.stringify(SIDES[c]));delete b.voice;return b;});
 return {v:1,match:`audit-${arm}-${seed}`,seed,kickoff:seed%2,duration:900,sides};
}
/** computeMatch, unchanged: the parity reference. */
export function plain(t:{arm:string;seed:number}){
 const c=computeMatch(inputOf(t.arm,t.seed));
 return {arm:t.arm,seed:t.seed,score:c.compact.score,print:print(c.compact)};
}

function run(inp:any){
 const dec:any[]=[],tks:any[]=[],sets:any[]=[];
 const riskOf=(o:any)=>o?.pass?.risk??o?.loft?.risk??(o?.throwRisk!==undefined?o.throwRisk:-1);
 const PASSY=new Set(['pass','through','loft']);
 let lastCh:any=null,lastMt:any=null,rl:any=null,cur:any=null;
 const seen=new WeakSet<object>();
 const outfield=(players:any[],side:number)=>players.filter(q=>q.side!==side&&q.role!=='GK');
 const hz=(p:any,o:any)=>{let h=poss.kickHorizon(p,o.aim,o.kind);if(o.hurried)h-=(1-HURRY)*poss.preparationTime(p,o.kind);return h;};
 const g=globalThis as any;
 const dc=[[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0]];
 g.__ch=(time:number,p:any,option:any,list:any[],rk:string,players:any[],ball:any)=>{
  if(!rk&&ball&&!(p.role==='GK'&&ball.z>.5)){const c=dc[p.side];c[0]++;
   if(outfield(players,p.side).some((q:any)=>Math.hypot(q.x-ball.x,q.y-ball.y)<=2.2)){c[1]++;
    if(PASSY.has(option.kind)){c[2]++;if(option.hurried)c[3]++;if(Math.hypot(option.aim.x-p.x,option.aim.y-p.y)<6)c[4]++;}
    else if(option.kind==='clear')c[5]++;else if(option.kind==='carry'){if(['protect','escape'].includes(option.carry?.purpose))c[6]++;else c[7]++;}
    else if(option.kind==='feint')c[8]++;else if(option.kind==='shoot')c[9]++;}}
  // the world-prices decision tuple, unchanged (analyse.ts reads it)
  let best=-Infinity,low=Infinity;
  for(const o of list){if(o===option)continue;if(o.score>best)best=o.score;if(PASSY.has(o.kind)){const r=riskOf(o);if(r>=0&&r<low)low=r;}}
  dec.push([time,p.id,option.kind,option.score,PASSY.has(option.kind)?riskOf(option):-1,option.hurried?1:0,best===-Infinity?-9:best,low===Infinity?-1:low,rk,option.target??'']);
  if(rk||!KICK.includes(option.kind)){lastCh=null;return;}
  // quicker kicks he had (read from the exact picture: what was on, not what he read)
  const arr=Math.min(99,...outfield(players,p.side).map(q=>arrivalTime(q,p)));
  const ch=hz(p,option);let bq=-9,bqs=0,bg=-9,bo=-9,bc=-9;
  for(const o of list){if(o===option)continue;bo=Math.max(bo,o.score);
   if(KICK.includes(o.kind)){const h=hz(p,o);if(h<=ch-.08&&o.score>bq){bq=o.score;bqs=ch-h;}if(h<arr+LAND)bg=Math.max(bg,o.score);}
   else bc=Math.max(bc,o.score);}
  lastCh={time,id:p.id,option,info:[r3(option.score),r3(bq),r2(bqs),r3(bg),r3(ch),r3(bo),r3(bc),ch<arr+LAND?1:0],rd:[...reads(p,players,ball,option,time),ball?r2(Math.hypot(ball.x-p.x,ball.y-p.y)):-9,r2(Math.hypot(option.aim.x-p.x,option.aim.y-p.y))]};
 };
 g.__tk=(time:number,d:any,p:any,touch:any,foul:boolean)=>{
  tks.push([time,d.side,touch.body?1:0,touch.ballFirst?1:0,touch.leg?1:0,touch.collision?1:0,touch.foulChance,foul?1:0,touch.closingSpeed,depthOf(d.side,p.x)]);
 };
 g.__mt=(time:number,p:any,plan:any,viable:any,direct:boolean,rs:number)=>{
  lastMt={time,id:p.id,since:plan?plan.since:null,first:plan&&plan.first!==undefined?(plan.first?1:0):-1,held:plan?time-plan.since:-1,rs};
 };
 g.__rl=(time:number,id:string)=>{rl={time,id};};
 g.__pt=(time:number,ball:any,prepared:any,receivedAt:number,players:any[],restart:any)=>{
  const owner=ball.owner;
  if(cur){
   let out=-1;
   if(rl&&rl.time===time&&rl.id===cur.id)out=0;
   else if(restart)out=3;
   else if(owner!==cur.id)out=1;
   else if(prepared!==cur.ref)out=2;
   if(out<0){
    const me=players.find(q=>q.id===cur.id);
    if(me){let d=99;for(const q of outfield(players,me.side)){const x=Math.hypot(q.x-me.x,q.y-me.y);if(x<d)d=x;}if(d<cur.minD)cur.minD=d;if(d<1&&cur.on<0)cur.on=time-cur.t0;}
   }else{cur.row[14]=out;cur.row[15]=r2(time-cur.t0);cur.row[16]=cur.on<0?-1:r2(cur.on);cur.row[17]=r2(cur.minD);sets.push(cur.row);cur=null;}
  }
  if(!cur&&prepared&&owner&&!restart&&!seen.has(prepared)){
   seen.add(prepared);
   const me=players.find(q=>q.id===owner);
   if(!me||ball.z>.5&&me.role==='GK')return;// a keeper's ball in his hands is not a kick being set at his feet
   const opp=outfield(players,me.side);let d0=99,cl=0,n3=0,arr=99;
   for(const q of opp){const dx=me.x-q.x,dy=me.y-q.y,d=Math.hypot(dx,dy)||1e-6;if(d<3)n3++;arr=Math.min(arr,arrivalTime(q,me));
    if(d<d0){d0=d;cl=((q.vx-me.vx)*dx+(q.vy-me.vy)*dy)/d;}}
   const o=prepared.option;
   const src=lastCh&&lastCh.time===time&&lastCh.id===owner&&lastCh.option===o?0:lastMt&&lastMt.time===time&&lastMt.id===owner?1:2;
   const ci=src===0?lastCh.info:[-9,-9,-9,-9,-9,-9,-9,-9];
   const row=[me.side,-1,r3(time),KICK.indexOf(o.kind),o.hurried?1:0,src,r3(time-receivedAt),src===1&&lastMt.since!=null?r3(time-lastMt.since):0,
    r3(prepared.at-time),r3(prepared.at-time+poss.footToBall(me)),r2(d0),r2(cl),r2(Math.min(99,arr)),n3,3,0,-1,r2(d0),...ci,
    src===1?lastMt.first:-1,src===1?r3(lastMt.held):-1,src===1?r2(lastMt.rs):-1,r2(depthOf(me.side,me.x)),roleCode(me.role),...(src===0?lastCh.rd:[-9,-9,-9,-9,-9,-9])];
   cur={id:owner,ref:prepared,t0:time,row,minD:d0,on:d0<1?0:-1,pid:owner};
   row[1]=owner;// replaced by the roster index after the match
  }
 };
 let r:any,c:any;
 try{
  // computeMatch's runMatch call, verbatim (lib/ballers/compute.ts computeMatch)
  const teams=inp.sides.map(engineTeam);
  const plans=inp.sides.map(sidePlans);
  const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
  const subs=sideOrders(inp,teams as any);
  r=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
  c=compact(inp,r.result);
 }finally{g.__ch=undefined;g.__tk=undefined;g.__pt=undefined;g.__rl=undefined;g.__mt=undefined;}
 if(cur){cur.row[16]=cur.on<0?-1:r2(cur.on);cur.row[17]=r2(cur.minD);sets.push(cur.row);}
 return {run:r,c,dec,tks,sets,dc};
}

function extra(R:any,sets:any[],ls:any[],eps:boolean){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,n=frames.length;
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const evIdxAt=(time:number)=>{let lo=0,hi=events.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(events[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best;};
 for(const s of sets)s[1]=idx.get(s[1])??-1;
 // ---- the kick being set when the ball left him: a set of the losing side that ended "left him unstruck" closest to
 //  the moment the ball left (analyse: B's control time - ls[18]), within one recorded frame
 const lostSets=sets.map((s,i)=>({s,i})).filter(x=>x.s[14]===1);
 const lj:any[]=[];
 ls.forEach((x:any,li:number)=>{
  const a=x[0],tLeave=x[1]-x[18];let best=-1,bd=.16;
  if(x[2]>=2&&x[2]<=5)for(const {s,i} of lostSets){if(s[0]!==a)continue;const te=s[2]+s[15],d=tLeave-te;if(d>=-.02&&d<bd){bd=d;best=i;}}
  // winner's minimum control
  const tB=x[1],f=frames[frameAt(tB)],bOwner=f.control?.owner??f.ball?.owner??null;let ok=0;
  if(bOwner){
   let hold=-1;for(let k=frameAt(tB);k<n;k++){const g=frames[k];if(g.restart){hold=g.time-tB;break;}if((g.ball?.owner??null)!==bOwner&&g.time>tB+1e-6){hold=g.time-tB;break;}}
   if(hold<0||hold>=.5)ok=1;
   else for(let e=Math.max(0,evIdxAt(tB-.05));e<events.length&&events[e].time<=tB+hold+.05;e++){const ev=events[e];if(ev.time<tB-.05)continue;if(ev.actor===bOwner&&['pass','clearance','shot'].includes(ev.kind)){ok=1;break;}}
  }
  lj.push([li,best,ok]);
 });
 // ---- open-play receptions of a team-mate's pass
 const rec=[0,0];
 for(let q=0;q<events.length;q++){const e=events[q];if(e.kind!=='receive'||!e.actor)continue;const S=sideOf(e.actor);if(S<0)continue;
  for(let r=q-1;r>=0&&events[r].time>e.time-6;r--){const x=events[r];if(['pass','clearance','shot'].includes(x.kind)){if(sideOf(x.actor)===S&&x.kind==='pass'&&!x.restartKind&&x.actor!==e.actor)rec[S]++;break;}if(['receive','turnover','save','restart','tackle'].includes(x.kind))break;}}
 // ---- touches per released outfield spell (decide round watch.ts rule)
 const contactsBy=new Map<string,number[]>();for(const c of R.controlContacts??[]){const a=contactsBy.get(c.actor)??[];a.push(c.time);contactsBy.set(c.actor,a);}
 const isCatch=(e:any)=>e.kind==='save'&&/prinde/.test(e.text??'');
 const gain=(e:any)=>e.kind==='receive'||e.kind==='turnover'||isCatch(e);
 const tch=[[0,0,0,0],[0,0,0,0]];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(!gain(e)||!e.actor)continue;const p=e.actor,S=sideOf(p);if(S<0||roster[idx.get(p)!].role==='GK')continue;
  let end=-1,released=false;
  for(let r=q+1;r<events.length;r++){const x=events[r];if(x.time>e.time+30)break;
   if(['pass','clearance','shot'].includes(x.kind)&&x.actor===p){end=x.time;released=true;break;}
   if(gain(x)&&(x.actor!==p||x.time>e.time+1e-6)){end=x.time;break;}
   if(['foul','out','offside','goal','half','end','restart','substitution'].includes(x.kind)){end=x.time;break;}}
  if(!released)continue;
  const touches=(contactsBy.get(p)??[]).filter(t=>t>=e.time-.1&&t<=end+.02).length;
  const c=tch[S];c[0]++;if(touches<=1)c[1]++;if(touches<=2)c[2]++;c[3]+=end-e.time;
 }
 for(const c of tch)c[3]=r2(c[3]);
 // ---- render windows: caught kicks (seeds 0-1), up to 3 a kind
 let ep:any[]|undefined,ro:any[]|undefined;
 if(eps){
  ep=[];ro=roster.map((p:any)=>[p.side,p.role]);
  const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
  const pack=(t0:number,t1:number)=>{const out:any[]=[];let lastT=-9;for(let k=frameAt(t0);k<n&&frames[k].time<=t1;k++){const f=frames[k];if(f.time<lastT+.099)continue;lastT=f.time;const ps:any[]=[];
    for(let i=0;i<roster.length;i++){const p=pos(f,i);if(p)ps.push(i,r2(p.x),r2(p.y),r2(p.vx),r2(p.vy),DUTIES.indexOf(p.duty));}
    out.push([r2(f.time),r2(f.ball.x),r2(f.ball.y),r2(f.ball.z),f.ball.owner?idx.get(f.ball.owner)??-1:-1,f.restart?1:0,ps]);}return out;};
  const cap:Record<string,number>={};
  for(const [li,si,ok] of lj){if(si<0)continue;const s=sets[si],x=ls[li];
   const kind=(s[5]===1||s[6]<1?'caught-reception':'caught-carry')+(ok?'':'-brief');
   cap[kind]=(cap[kind]??0)+1;if(cap[kind]>3)continue;
   ep.push({kind,t:r2(s[2]),i:li,j:si,f:pack(s[2]-1.2,x[1]+.8)});}
 }
 return {sets,lj,rec,tch,...(ep?{eps:ep,ro}:{})};
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const flag=(poss as any).CAUGHT_KICK;
 if(t.rev==='off'||t.rev==='on'){if(!flag)throw Error('this revision has no CAUGHT_KICK flag');flag.byBall=t.rev==='on';}
 else if(flag)throw Error(`rev ${t.rev}: name a flagged build off or on`);
 const inp=inputOf(t.arm,t.seed),t0=performance.now();
 let out:any;try{out=run(inp);}finally{if(flag)flag.byBall=true;}
 const {run:rr,c,dec,tks,sets,dc}=out;
 const ms=Math.round(performance.now()-t0);
 const ev=c.chunks.flatMap((ch:any)=>ch.e);
 const chances:[number,number][]=[];for(const e of ev)if(e.k==='shot')chances.push([e.t,shotChance(e)??0]);
 const row=analyse(rr.result,dec,tks,chances,{eps:false});
 const ck=extra(rr.result,sets,row.ls,t.seed<=1);
 const nsp=[0,0];for(const s of row.sp)nsp[s[0]]++;
 return {label:t.label,kind:'ck',arm:t.arm,seed:t.seed,rev:t.rev,kickoff:inp.kickoff,codes:inp.sides.map((s:any)=>s.club?.code),
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:rr.engineBuild.slice(0,8),
  score:c.score,print:print(c),hash:print(rr.result),ms,inPlay:row.inPlay,nsp,ls:row.ls,ck,dc,
  pp:[0,1].map(S=>{const a=[0,0,0,0,0,0];for(const x of row.ps)if(x[0]===S){a[0]++;a[[1,2,3,4,5][x[9]]]++;}return a;}),
  sg:[0,1].map(S=>{const a=[0,0,0,0,0];for(const x of row.sp)if(x[0]===S){a[0]++;if(x[7]>0)a[1]++;a[2]+=x[7];a[3]+=x[8];}for(const x of row.sh)if(x[0]===S)a[4]+=x[2];a[4]=r3(a[4]);return a;})};
}
