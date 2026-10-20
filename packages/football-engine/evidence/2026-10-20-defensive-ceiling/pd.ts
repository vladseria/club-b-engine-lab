// Defensive ceiling (2026-10-20): one row per match. Evidence only.
//
// The match goes through EXACTLY the runMatch call lib/ballers/compute.ts computeMatch makes (engineTeam, sidePlans,
// sideOrders, coordinated, substitutions none, record:true), bundled through hook.mjs. The probed side's perfect-defending
// controller (below) is installed on globalThis for that match only; a plain arm installs nothing.
//
// Arm  <squad>.<style>.<line>.<pd>
//   squad  eq | rp        (squads.ts; BOTH sides; ours = seed % 2, kick-off = (seed >> 1) % 2: paired seeds)
//   style  di | ba        our preset, Direct 1-2-1 | Balanced 1-2-1
//   line   deep|std|high  our Line
//   pd     0 | any of a, b, c, d (in that order; abcd = full perfect defending), for our side only:
//          a no perception noise, b zero reaction delays, c runner picked up from the first step, d compact block
// The opponent is always the same squad on plain Direct 1-2-1, Line Standard.
//
// Row: score, chances (official table per side), print (compact fingerprint), build, plat, ms, ours, st (engine stats per
// side: possession, passes, completed, shots, turnovers), m (measure.ts per side), ch (measure.ts clear-chance rows per
// side), pd (the controller's log: element c runs/locks, element d caps).
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {matchChances} from '../../../../lib/ballers/chances';
import {side as sqSide} from './squads';
import {normalize,measure,type NJob} from './measure';
import {controller,uninstall} from './control';
import {boxRecon} from './recon';

const r1=(v:number)=>Math.round(v*10)/10,r3=(v:number)=>Math.round(v*1000)/1000;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};

// (recon round 3) sty.<A>v<B>: the plain engine, eq squad both sides, our side style A, theirs style B, each preset as
// shipped (its own Line), 1-2-1; A, B in di | ba | sh (Short = combinations) | co (Counter). No controller.
const STY=/^sty\.(di|ba|sh|co)v(di|ba|sh|co)$/;
export function parseArm(arm:string){
 const y=STY.exec(arm);if(y)return {squad:'eq',style:y[1],line:'pre',el:new Set<string>(),vs:y[2]};
 const m=/^(eq|rp)\.(di|ba)\.(deep|std|high)\.(0|a?b?c?d?)$/.exec(arm);
 if(!m||m[4]==='')throw Error('bad arm '+arm);
 return {squad:m[1],style:m[2],line:m[3],el:new Set(m[4]==='0'?[]:m[4].split(''))};
}
export const armTreatment=(arm:string)=>(parseArm(arm),arm);
export function inputOf(arm:string,seed:number):any{
 const {squad,style,line,vs}=parseArm(arm) as any,ours=seed%2,sides=[null,null] as any[];
 sides[ours]=sqSide('PDS','#3fd38a',squad,style,line);
 sides[1-ours]=vs?sqSide('OPP','#d33f6a',squad,vs,'pre'):sqSide('OPP','#d33f6a',squad,'di','std');
 return {v:1,match:`dc-${seed}`,seed,kickoff:(seed>>1)%2,duration:900,sides};
}

// ---- the match ---------------------------------------------------------------------------------------------------
function runIt(inp:any){
 const teams=inp.sides.map(engineTeam),plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams as any);
 const run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 return {run,c:compact(inp,run.result)};
}

/** computeMatch, unchanged: the parity reference. */
export function plain(t:{arm:string;seed:number}){
 const c=computeMatch(inputOf(t.arm,t.seed));
 return {arm:t.arm,seed:t.seed,score:c.compact.score,print:print(c.compact)};
}

export function play(t:{label:string;arm:string;seed:number;rev:string;watch?:boolean;recon?:boolean}){
 const inp=inputOf(t.arm,t.seed),ours=(t.seed%2) as 0|1,{el}=parseArm(t.arm);
 const ctl=el.size?controller(ours,el):null;let out:any;const t0=performance.now();
 try{ctl?.install();out=runIt(inp);}finally{uninstall();}
 const ms=Math.round(performance.now()-t0);
 const {run,c}=out,R=run.result,roster:any[]=R.players;
 const ev=c.chunks.flatMap((ch:any)=>ch.e),frames=c.chunks.flatMap((ch:any)=>ch.f);
 const chances=matchChances(ev,c.header,run.engineBuild);
 // replay index of every engine id (starters only: no bench in these squads)
 const rIdx=new Map<string,number>();inp.sides.forEach((s:any,side:number)=>s.lineup.forEach((id:string,slot:number)=>rIdx.set(`${side}:${id}`,side*5+slot)));
 const jobs:NJob[]=(R.choices??[]).filter((x:any)=>x.assignment).map((x:any)=>({t:x.time,i:rIdx.get(roster[x.player]?.id)??-1,kind:x.kind,purpose:x.assignment?.purpose??null,target:x.assignment?.target!==undefined?rIdx.get(x.assignment.target)??-1:-1})).filter((j:NJob)=>j.i>=0);
 const aims=R.events.map((e:any)=>e.kind==='pass'&&(e.pass?.aim||e.aerial?.aim)?{x:(e.pass?.aim??e.aerial.aim).x,y:(e.pass?.aim??e.aerial.aim).y,aerial:!!e.aerial}:null);
 const n=normalize(c.header,frames,ev,jobs,aims),m=measure(n);
 const st=[0,1].map(s=>{const x=R.stats[s];return [r1(x.possession),x.passes,x.completed,x.shots,x.turnovers];});
 const row:any={label:t.label,kind:'dc',arm:t.arm,seed:t.seed,rev:t.rev,ours,kickoff:inp.kickoff,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:run.engineBuild.slice(0,8),
  score:c.score,chances:chances?chances.map(r3):null,print:print(c),ms,st,m:m.side,ch:m.chances,pd:ctl?ctl.log:null};
 // (--recon) the box reception behind every clear chance after a depth run against our side (recon.ts), with a compact window
 // (recon round 3, style arms) every clear chance of BOTH sides, each side's attack, no windows
 if(t.recon)row.recon=STY.test(t.arm)?{sides:[0,1].map(s=>boxRecon(R,rIdx,m.chances[s],s,frames,ev,{all:true,noWins:true}).chances),styles:inp.sides.map((x:any)=>x.style)}:boxRecon(R,rIdx,m.chances[1-ours],1-ours,frames,ev);
 if(t.watch){row.header=c.header;row.frames=frames;row.events=ev;row.jobs=jobs;row.aims=aims;row.directSides=[0,1].filter(s=>inp.sides[s].style==='direct'&&!(el.size&&1-s===ours));}
 return row;
}
