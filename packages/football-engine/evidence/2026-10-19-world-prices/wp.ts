// World prices (2026-10-19): why the engine's turnovers, regains, transition goals, set pieces and goals differ from
// real futsal. Evidence only; nothing here writes to the engine.
//
// The match goes through EXACTLY the runMatch call lib/ballers/compute.ts computeMatch makes (engineTeam, sidePlans,
// sideOrders, coordinated, substitutions none, record:true). hook.mjs adds two read-only calls in practice.ts (the
// carrier's choice with its alternatives; a tackle's contact and foul draw); run.mjs --parity proves the hooked row's
// compact equals computeMatch's.
//
// Arms (as ../2026-10-19-engine-audits/audit.ts, branch engine-audits)
//  e.base         the squad-fit average squad on Direct 1-2-1 v the same (our side = seed % 2, kick-off = (seed>>1) % 2)
//  m.<a>~<b>      the average squad on plan a (ours, seed % 2) v the average squad on plan b (squads.ts PLANS)
//  r.<HOME>-<AWAY> two real frozen league sides (../2026-10-09-scenarios/sides), kick-off = seed % 2
//
// Row keys (all arrays of numbers unless said; sides 0/1; depth = metres from that side's own goal; L = 48)
//  score, print (compact fingerprint), build, plat, ms, inPlay (s), played (s), stats (engine PracticeStats per side)
//  sp[]   possession spells, the audit's rule and layout: [side, start (0 restart, 1 open, 2 kick-off), t0, dur, passes,
//         end (0 lost in open play, 1 restart, 2 match end), start depth, shots, goals, first shot s, first goal s, nl, nw,
//         how (0 tackle, 1 intercept, 2 loose, 3 keeper, 4 other, -1 restart), restart kind]
//  ls[]   one per open-play loss (spell ended, next spell starts in open play), see LOSS below
//  rs[]   restarts: [kind code, side, t (first restart frame), taken t, spot depth (taker side), |spot y|, shot <= 10 s
//         after taken (taker side), goal <= 10 s, possession kept 5 s (taker side still in control or a later spell of
//         its own with no opposing control in between), first kick: 0 none, 1 ground pass, 2 lofted pass, 3 shot,
//         goal <= 10 s by the other side, delivery target depth (taker side) or -1]
//  fo[]   fouls: [t, source (0 tackle, 1 reception duel, 2 air duel, 3 second touch, 4 other), fouler side, depth of the
//         spot from the fouler's own goal, restart that followed code]
//  tk[]   tackle resolutions (hook): [t, tackler side, body contact, ball first, leg, collision, foul chance, foul,
//         closing speed, carrier depth from the tackler's goal]
//  sh[]   shots: [side, t, chance, goal, spell index, depth from the target goal, distance to goal centre, nearest
//         defending outfielder to the shooter (m), seconds since the spell started, spell start (0 restart, 1 open, 2 ko),
//         restart kind code or -1, open-play-regain how or -1]
//  lb[]   open-play passes 12 m+ or lofted: [side, lofted, len, from depth, gain, cat (audit: 1 first touch ours, 2 first
//         touch theirs, 3 loose then ours, 4 loose then theirs, 5 nobody 4 s / restart), nearest opposing outfielder to
//         the aim at release, nearest opposing outfielder to the ball at the first touch (-1 none), toucher dist to aim]
//  rd[side][third] rest defence while in possession, every 0.5 s of open play with an outfield carrier:
//         [samples, sum own outfielders goal-side of the ball (deeper than it), samples with 0, 1, 2, 3+ goal-side,
//          sum opposing outfielders goal-side of the ball]
//  ch     decision counts per side: [carrier decisions, pass-like chosen, of those risk >= .3, of those a pass-like
//          alternative with risk < .15 existed, sum chosen risk, carries chosen, shots chosen, clears chosen]
//  rdu    reception duels by outcome [clean, forced, loose, nicked, turned, foul] per receiving side
//  eps    (seed 0 only) render windows: {kind, t, i, j, f:[[t, bx, by, bz, owner index, restart, [i,x,y,vx,vy,duty]...]]}
//  ro     (seed 0 only) roster [side, role] by index
//
// LOSS record (ls[]): index -> meaning
//  0 side A (lost it)   1 t (B's first control)   2 class (CLASS below)   3 ball depth at the loss (A's view; at the
//  release for a kick, else at the last A frame)   4 lastA role code (0 GK 1 CB/DEF 2 W/MID 3 ST)   5 lastA time on the
//  ball before release/loss (s)   6 action (0 none 1 ground pass 2 lofted 3 clearance 4 shot)   7 pass length (m, -1)
//  8 pass gain (m, -1)   9 pressure: nearest B outfielder to lastA at release/loss (m)   10 B outfielders within 3 m of
//  lastA then   11 chosen option risk (hook, pass-like, -1)   12 chosen option score   13 best alternative score
//  (not the chosen)   14 lowest risk among pass-like alternatives (-1)   15 hurried (0/1)   16 intended receiver:
//  nearest B outfielder at release (m, -1)   17 winner first control: 0 in flight (ball mode pass), 1 loose, 2 from feet
//  (owner to owner), 3 keeper save/hands   18 s from release/loss-of-control to B control   19 nl   20 nw (outfielders
//  within 8 m of the ball at B control, A / B)   21 link: index in ls[] of B's own loss if B loses it in open play
//  within 5 s of its control, else -1   22 B passes before that loss   23 A outfielders goal-side of the ball at B
//  control   24 B outfielders goal-side of A (between ball and A's goal) at B control   25 A goal-side at +2 s (-1 if
//  B lost it or a restart)   26 A goal-side at +4 s   27 B shot <= 10 s of control   28 B goal <= 10 s   29 B
//  controller: nearest B team-mate (m)   30 B team-mates within 8 m of him   31 open B team-mates (no A outfielder
//  within 2.5 m) within 15 m of him   32 A outfielders within 3 m of the B controller   33 B controller role code
//  34 ball depth at B control (B's view)   35 B controller time on the ball before he released/lost it (s, -1 kept)
//  36 B controller's first choice (hook): 0 none, 1 pass-like, 2 carry, 3 shot, 4 clear, 5 feint
//  37 seconds of B's spell (to the end, any)   38 A's keeper distance from his goal line (m) at B control
//  39 lastA's last choice before it (hook): 0 none, 1 pass-like, 2 carry, 3 shot, 4 clear, 5 feint   40 s since that
//  choice   41 lastA's speed at his last frame on the ball (m/s)
//
// Also (layouts in analyse.ts where they are built): ps[] every open-play pass with the passer's own risk read and its
// outcome; fe[] every open-play feint (take-on) and its outcome; bm in-play seconds by ball state; md distances to the
// nearest opponent by defending duty group.
//
// CLASS: 0 pass intercepted in flight, 1 pass ran loose and lost (deflected, overhit, nobody met it, a reception
// touched but not controlled), 2 reception lost (the receiver had it under 1 s, no tackle), 3 reception duel / tackle
// within 1 s of receiving, 4 tackled (on the ball 1 s+), 5 carrier lost it without a tackle (1 s+: touch away, run into
// a body), 6 clearance, 7 shot (saved, blocked and theirs), 8 keeper's distribution, 9 other / unclear
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {shotChance} from '../../../../lib/ballers/chances';
import {side as sqSide,PLANS} from './squads';
import {analyse,PASSY} from './analyse';
export {RK,DUTIES} from './analyse';

let SIDES:Record<string,any>={};
export function init(s:Record<string,any>){SIDES=s;}

const L=48;
const depthOf=(s:number,x:number)=>s===0?x:L-x;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};

export function inputOf(arm:string,seed:number):any{
 let m:RegExpExecArray|null;
 if(arm==='e.base'){
  const ours=seed%2,sides=[null,null] as any[];sides[ours]=sqSide('SQD','#3fd38a','avg','dir');sides[1-ours]=sqSide('OPP','#d33f6a','avg','dir');
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

/** computeMatch, unchanged: the parity reference. */
export function plain(t:{arm:string;seed:number}){
 const c=computeMatch(inputOf(t.arm,t.seed));
 return {arm:t.arm,seed:t.seed,score:c.compact.score,print:print(c.compact)};
}

/** Play one match with the hooks on; returns the result, what the hooks saw and the compact. */
function run(inp:any){
 const dec:any[]=[],tks:any[]=[];
 // the carrier's choice: [t, player id, chosen kind, chosen score, chosen risk (-1), hurried, best other score,
 //  lowest pass-like risk among the others (-1), restart kind, target id]
 const riskOf=(o:any)=>o?.pass?.risk??o?.loft?.risk??(o?.throwRisk!==undefined?o.throwRisk:-1);
 (globalThis as any).__ch=(time:number,p:any,option:any,list:any[],rk:string)=>{
  let best=-Infinity,low=Infinity;
  for(const o of list){if(o===option)continue;if(o.score>best)best=o.score;if(PASSY.has(o.kind)){const r=riskOf(o);if(r>=0&&r<low)low=r;}}
  dec.push([time,p.id,option.kind,option.score,PASSY.has(option.kind)?riskOf(option):-1,option.hurried?1:0,best===-Infinity?-9:best,low===Infinity?-1:low,rk,option.target??'']);
 };
 (globalThis as any).__tk=(time:number,d:any,p:any,touch:any,foul:boolean)=>{
  tks.push([time,d.side,touch.body?1:0,touch.ballFirst?1:0,touch.leg?1:0,touch.collision?1:0,touch.foulChance,foul?1:0,touch.closingSpeed,depthOf(d.side,p.x)]);
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
 }finally{(globalThis as any).__ch=undefined;(globalThis as any).__tk=undefined;}
 return {run:r,c,dec,tks};
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const inp=inputOf(t.arm,t.seed),t0=performance.now();
 const {run:rr,c,dec,tks}=run(inp);
 const ms=Math.round(performance.now()-t0);
 const ev=c.chunks.flatMap((ch:any)=>ch.e);
 const chances:[number,number][]=[];for(const e of ev)if(e.k==='shot')chances.push([e.t,shotChance(e)??0]);
 const row=analyse(rr.result,dec,tks,chances,{eps:t.seed===0});
 return {label:t.label,kind:'wp',arm:t.arm,seed:t.seed,rev:t.rev,kickoff:inp.kickoff,
  styles:inp.sides.map((s:any)=>s.style),forms:inp.sides.map((s:any)=>s.formation),codes:inp.sides.map((s:any)=>s.club?.code),
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:rr.engineBuild.slice(0,8),
  score:c.score,print:print(c),ms,...row};
}

/** Laptop development: play one match with the hooks and return everything analyse() reads (written by run.mjs --dump). */
export function dump(t:{arm:string;seed:number}){
 const inp=inputOf(t.arm,t.seed),{run:rr,c,dec,tks}=run(inp);
 const ev=c.chunks.flatMap((ch:any)=>ch.e);
 const chances:[number,number][]=[];for(const e of ev)if(e.k==='shot')chances.push([e.t,shotChance(e)??0]);
 const R=rr.result;
 return {arm:t.arm,seed:t.seed,score:c.score,print:print(c),R:{duration:R.duration,played:R.played,players:R.players.map((p:any)=>({id:p.id,side:p.side,role:p.role,name:p.name})),
  frames:R.frames,events:R.events,choices:[],stats:R.stats,receptionDuels:R.receptionDuels,controlContacts:R.controlContacts},dec,tks,chances};
}
