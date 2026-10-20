// Ceiling routes (2026-10-20): one row per match. Evidence only.
//
// The match goes through EXACTLY the runMatch call lib/ballers/compute.ts computeMatch makes (engineTeam, sidePlans,
// sideOrders, coordinated, substitutions none, record:true), bundled through hook.mjs. The probed side's route controller
// (routes.ts) is installed as globalThis.__rt for that match only.
//
// Arm  <squad>.<plan>~<opp>
//   squad  avg | iso | piv | ovl | isoP | pivP | ovlP   (squads.ts SQUADS; ours = seed % 2, kick-off = (seed >> 1) % 2,
//          so seed s is the same set-up in every arm: paired seeds)
//   plan   dir  Direct 1-2-1, live (with the four detectors in shadow mode: they log, they act on nothing)
//          pd   Direct + perfect Direct (routes.ts pd)          iso | piv | ovl   Direct + that perfect route
//   opp    same  the same squad on Direct 1-2-1 (so <squad>.<plan>~same is the plan against that squad's Direct)
//          dir | deep | high   the average squad on Direct / Direct line Deep / Direct line High
//
// Row keys: score, chances (official table per side), print (compact fingerprint), build, plat, ms, ours,
//  shots [side, t, chance, goal], pc [t, side, restart?1:0] possession changes (deep.ts rule: last side in control; a
//  restart counts for its side), st per side [passes, completed, shots, feints, beaten, turnovers, tackles won],
//  rt  routes.ts log of the probed side (fires, met, setup, shadow, keeps).
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {matchChances,shotChance} from '../../../../lib/ballers/chances';
import {side as sqSide,SQUADS} from './squads';
import {controller,type Route} from './routes';

const PLANS_OK=['dir','pd','iso','piv','ovl'],OPPS=['same','dir','deep','high'];
const r1=(v:number)=>Math.round(v*10)/10,r3=(v:number)=>Math.round(v*1000)/1000;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};

export function parseArm(arm:string){
 const m=/^([A-Za-z]+)\.([a-z]+)~([a-z]+)$/.exec(arm);if(!m)throw Error('bad arm '+arm);
 const [,squad,plan,opp]=m;
 if(!SQUADS[squad])throw Error('unknown squad '+squad);if(!PLANS_OK.includes(plan))throw Error('unknown plan '+plan);if(!OPPS.includes(opp))throw Error('unknown opponent '+opp);
 return {squad,plan,opp};
}
export const armTreatment=(arm:string)=>(parseArm(arm),arm);
export function inputOf(arm:string,seed:number):any{
 const {squad,opp}=parseArm(arm),ours=seed%2,sides=[null,null] as any[];
 sides[ours]=sqSide('SQD','#3fd38a',squad,'dir');
 sides[1-ours]=opp==='same'?sqSide('OPP','#d33f6a',squad,'dir'):sqSide('OPP','#d33f6a','avg',opp);
 return {v:1,match:`ceiling-${seed}`,seed,kickoff:(seed>>1)%2,duration:900,sides};
}

/** The probed side's controller for an arm: the route, or the four shadow detectors on a Direct arm. `probe` (parity
 * only) additionally calls the exact-picture recompute at every decision and plan, discarding it. */
function install(arm:string,ours:0|1,probe=false){
 const {plan}=parseArm(arm);
 if(plan==='dir'){
  const cs=(['iso','piv','ovl','pd'] as Route[]).map(r=>controller(r,ours,true));
  (globalThis as any).__rt={
   moves:(...a:any[])=>{for(const c of cs)(c.rt.moves as any)(...a);return undefined;},keep:()=>undefined,
   decide:(p:any,pl:any[],b:any,t:number,av:any[],ex:()=>any[])=>{for(const c of cs)c.rt.decide(p,pl,b,t,av,ex);if(probe)ex();return undefined;},
   plan:(p:any,m:any,a:number,av:any[],o:any,t:number,pl:any[],ex:()=>any[])=>{if(probe)ex();return undefined;},
  };
  return {_cs:cs} as any;
 }
 const c=controller(plan as Route,ours,false);(globalThis as any).__rt=c.rt;return c.log;
}

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

export function play(t:{label:string;arm:string;seed:number;rev:string;probe?:boolean;watch?:boolean}){
 const inp=inputOf(t.arm,t.seed),ours=(t.seed%2) as 0|1;
 let log:any,out:any;const t0=performance.now();
 try{log=install(t.arm,ours,!!t.probe);out=runIt(inp);}
 finally{(globalThis as any).__rt=undefined;(globalThis as any).__exactId=undefined;}
 const ms=Math.round(performance.now()-t0);
 const {run,c}=out,R=run.result,roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events;
 if(log._cs)log={fires:[],met:{},setup:0,keeps:0,shadow:log._cs.flatMap((x:any)=>x.log.shadow).sort((a:any,b:any)=>a[0]-b[0])};
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const ev=c.chunks.flatMap((ch:any)=>ch.e);
 const chances=matchChances(ev,c.header,run.engineBuild);
 // shots with the official chance (compact events carry the table's inputs), goals matched to the shot before them
 const shots:any[]=[];
 const cs=ev.filter((e:any)=>e.k==='shot'&&(e.s===0||e.s===1)),gs=ev.filter((e:any)=>e.k==='goal'&&(e.s===0||e.s===1));
 const scored=new Set<number>();
 for(const g of gs){for(let k=cs.length-1;k>=0;k--){const x=cs[k];if(x.t>g.t+1)continue;if(x.t<g.t-4000)break;if(x.s===g.s){scored.add(k);break;}}}
 cs.forEach((e:any,k:number)=>shots.push([e.s,r1(e.t/1000),r3(shotChance(e)??0),scored.has(k)?1:0]));
 // possession changes (deep.ts rule)
 const pc:any[]=[];let last=-1;
 for(const f of frames){
  const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);let s=last,r=0;
  if(o)s=sideOf(o);else if(f.restart&&f.restartInfo){s=f.restartInfo.side;r=1;}
  if(s!==last&&s>=0){pc.push([r1(f.time),s,r]);last=s;}
 }
 const st=[0,1].map(s=>{const x=R.stats[s];return [x.passes,x.completed,x.shots,x.feints,x.beaten,x.turnovers,x.tacklesWon];});
 const row:any={label:t.label,kind:'ceiling',arm:t.arm,seed:t.seed,rev:t.rev,ours,kickoff:inp.kickoff,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:run.engineBuild.slice(0,8),
  score:c.score,chances:chances?chances.map(r3):null,print:print(c),ms,shots,pc,st,rt:log};
 if(t.watch){row.header=c.header;row.frames=c.chunks.flatMap((x:any)=>x.f);row.events=ev;}
 return row;
}
