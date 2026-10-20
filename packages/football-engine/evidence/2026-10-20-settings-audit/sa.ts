// Settings audit (2026-10-20): one row per match. Evidence only; no hook, no engine change.
//
// The match goes through EXACTLY the runMatch call lib/ballers/compute.ts computeMatch makes (engineTeam, sidePlans,
// sideOrders, coordinated, substitutions none, record:true) on the frozen input sides.ts builds, with In behind and
// Bodies forward 4 fixed on both sides. `--parity` plays computeMatch itself beside it and compares the compact replay.
//
// Arms (ours = seed % 2, kick-off = (seed >> 1) % 2, so seeds pair four ways):
//   A.<s><f>v<t><g>   Block A: our set-up style s formation f, theirs style t formation g; s,t in ba|sh|di|co
//                     (Short = combinations), f,g in 121|22. Each preset as shipped plus the two defaults.
//   B.<c>v<o>         Block B: ours = Balanced 1-2-1 + defaults with ONE change c (CHANGES); theirs = preset o in 1-2-1
//                     + defaults. B.base and B.f22 are Block A cells and resolve to them (canonical()).
// Row: score, st (per side: possession %, passes, completed, shots, turnovers), sp (per side: open-play possession spells,
// of those lost to the other side in play), chances (official table per side), print (compact fingerprint), build, plat, ms.
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {matchChances} from '../../../../lib/ballers/chances';
import {side,FORM,type Change} from './sides';

export const STYLES=['ba','sh','di','co'],FMS=['121','22'];
export const SETUPS=STYLES.flatMap(s=>FMS.map(f=>s+f));
/** Block B: every remaining board setting, every alternative to Balanced's option (README "Cells"). */
export const CHANGES:Record<string,Change>={
 base:{},
 f22:{formation:'2-2'},
 pgpat:{set:{progression:'patient'}},pgdir:{set:{progression:'direct'}},
 wnar:{set:{width:'narrow'}},wwid:{set:{width:'wide'}},
 ldeep:{set:{line:'deep'}},lhigh:{set:{line:'high'}},
 psel:{set:{press:'selective'}},pagg:{set:{press:'aggressive'}},
 tsec:{set:{transition:'secure'}},tcou:{set:{transition:'counter'}},
 olcp:{set:{onLoss:'counterpress'}},
 c3:{set:{commit:3}},c5:{set:{commit:5}},
 kline:{keeper:'line'},kswp:{keeper:'sweeper'},
 fksh:{fk:'short'},fkdel:{fk:'delivery'},
};
const A_RE=/^A\.(ba|sh|di|co)(121|22)v(ba|sh|di|co)(121|22)$/,B_RE=/^B\.([a-z0-9]+)v(ba|sh|di|co)$/;
/** The arm a cell is played under (Block B's base and 2-2 cells are Block A cells). */
export function canonical(arm:string):string{
 const b=B_RE.exec(arm);
 if(b&&(b[1]==='base'||b[1]==='f22'))return `A.ba${b[1]==='base'?'121':'22'}v${b[2]}121`;
 return arm;
}
export function parseArm(arm:string):{ours:[string,'1-2-1'|'2-2',Change];theirs:[string,'1-2-1'|'2-2']}{
 const a=A_RE.exec(arm);if(a)return {ours:[a[1],FORM[a[2]],{}],theirs:[a[3],FORM[a[4]]]};
 const b=B_RE.exec(arm);if(b){const c=CHANGES[b[1]];if(!c)throw Error('unknown change '+b[1]);return {ours:['ba','1-2-1',c],theirs:[b[2],'1-2-1']};}
 throw Error('bad arm '+arm);
}
export const armTreatment=(arm:string)=>(parseArm(arm),arm);
export function inputOf(arm:string,seed:number):any{
 const {ours:o,theirs:t}=parseArm(arm),us=seed%2,sides=[null,null] as any[];
 sides[us]=side('AAA','#3fd38a',o[0],o[1],o[2]);
 sides[1-us]=side('BBB','#d33f6a',t[0],t[1]);
 return {v:1,match:`sa-${seed}`,seed,kickoff:(seed>>1)%2,duration:900,sides};
}

const r1=(v:number)=>Math.round(v*10)/10,r3=(v:number)=>Math.round(v*1000)/1000;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};

function runIt(inp:any){
 const teams=inp.sides.map(engineTeam),plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams as any);
 const run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 return {run,c:compact(inp,run.result)};
}
/** Open-play possession spells per side and how many ended with the other side taking it in play (no restart between). */
function spells(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const sp=[[0,0],[0,0]];let last=-1,restartSince=true;
 for(const f of frames){
  if(f.restart){restartSince=true;continue;}
  const o=f.control?.owner??f.ball?.owner??null;if(!o)continue;const s=sideOf(o);if(s<0||s===last)continue;
  if(last>=0&&!restartSince)sp[last][1]++;
  sp[s][0]++;last=s;restartSince=false;
 }
 return sp;
}

/** computeMatch, unchanged: the parity reference. */
export function plain(t:{arm:string;seed:number}){
 const c=computeMatch(inputOf(t.arm,t.seed));
 return {arm:t.arm,seed:t.seed,score:c.compact.score,print:print(c.compact)};
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const inp=inputOf(t.arm,t.seed),ours=t.seed%2,t0=performance.now();
 const {run,c}=runIt(inp),ms=Math.round(performance.now()-t0),R=run.result;
 const ev=c.chunks.flatMap((ch:any)=>ch.e),chances=matchChances(ev,c.header,run.engineBuild);
 const st=[0,1].map(s=>{const x=R.stats[s];return [r1(x.possession),x.passes,x.completed,x.shots,x.turnovers];});
 return {label:t.label,kind:'sa',arm:t.arm,seed:t.seed,rev:t.rev,ours,kickoff:inp.kickoff,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:run.engineBuild.slice(0,8),
  score:c.score,st,sp:spells(R),chances:chances?chances.map(r3):null,print:print(c),ms,
  tac:inp.sides.map((s:any)=>[s.formation,s.approach.striker,s.approach.commit])};
}
