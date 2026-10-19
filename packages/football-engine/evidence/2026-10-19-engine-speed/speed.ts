// Engine speed (2026-10-19): one row per match, for byte-identical speed-ups. Evidence only; nothing here writes to the engine.
//
// The match: two real frozen Ballers sides (../2026-10-09-scenarios/sides, md5-checked by the runners, no manager field),
// played through computeMatch's exact runMatch call (lib/ballers/compute.ts), the keeper call varied the way
// ../2026-10-19-keeper-fix/keeper.ts varies it:
//   arm <HOME>-<AWAY>-<k>   k = L: settings.keeper 'line' | S: 'sweeper' | D: every keeper's trait .2 | O: the stored side
// kickoff = seed % 2.
//
// Row: ms (wall time of runMatch alone), score, print = [length, fnv32 a, fnv32 b] of the official compact replay
// (the parity fingerprint every earlier harness used), full = sha256 over the WHOLE engine result (frames, events,
// choices, stats, duels, notes: every key, element by element, so no single giant string), build, plat.
import {runMatch,ENGINE_BUILD} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact} from '../../../../lib/ballers/compute';
import {createHash} from 'node:crypto';

let SIDES:Record<string,any>={};
export function init(s:Record<string,any>){SIDES=s;}

const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};
function fullHash(r:any){
 const h=createHash('sha256');
 for(const k of Object.keys(r)){
  h.update(k+'\0');const v=r[k];
  if(Array.isArray(v)){h.update('['+v.length+']');for(const e of v)h.update(JSON.stringify(e)??'u');}
  else h.update(JSON.stringify(v)??'u');
 }
 return h.digest('hex').slice(0,24);
}

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
 return {v:1,match:`sp-${arm}-${seed}`,seed,kickoff:seed%2,duration:900,sides};
}

/** computeMatch's own call, timed around runMatch only. */
export function play(t:{arm:string;seed:number;sizes?:boolean}){
 const input=inputOf(t.arm,t.seed);
 const teams=input.sides.map(engineTeam);
 const plans=input.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(input,teams);
 const t0=performance.now(),c0=process.cpuUsage();
 const run=runMatch({fixture:{teams,seed:input.seed,kickoff:input.kickoff},durationSeconds:input.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 const ms=Math.round(performance.now()-t0),cpu=process.cpuUsage(c0),cpuMs=Math.round((cpu.user+cpu.system)/1000);
 const c=compact(input,run.result as any);
 const r:any=run.result;
 const sizes=t.sizes?Object.fromEntries(Object.keys(r).map(k=>[k,Math.round((Array.isArray(r[k])?r[k].reduce((n:number,e:any)=>n+(JSON.stringify(e)?.length??0),0):(JSON.stringify(r[k])?.length??0))/1024)])):undefined;
 return {arm:t.arm,seed:t.seed,ms,cpuMs,...(sizes?{sizesKB:sizes,compactKB:Math.round(JSON.stringify(c).length/1024)}:{}),score:c.score,print:print(c),full:fullHash(r),frames:r.frames.length,events:r.events.length,choices:r.choices.length,build:ENGINE_BUILD.slice(0,8),plat:`${process.platform}-${process.arch}`};
}
