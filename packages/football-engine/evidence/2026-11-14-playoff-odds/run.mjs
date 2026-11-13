// Play-off odds (2026-11-14): runner. A fresh founding squad away at Rapid Pensia, Pensia's men at four start energies,
// paired on seeds (match.ts). Shardable for the public lab (../_ci/shard.mjs: SHARD_INDEX / SHARD_TOTAL / SIM_WORKERS).
//
//   node run.mjs --label <name> [--squads 1-24] [--levels fresh,fit,tired,empty] [--workers 1] [--dry]
//   node run.mjs --probe [--n 1] [--level fresh] [--seed <seed>]       one match, prints the row and both sides
//
// Before anything plays, every task of the full design (24 squads x 4 levels x 4 seeds = 384) is built and checked
// (match.ts dryCheck: valid input, every order reaches the engine, the pairing holds); --dry stops there.
// Output: results/<label>.jsonl, appended; finished (n, level, seed) rows are skipped, so a stopped run resumes.
// Lab:
//   node packages/football-engine/evidence/_ci/cloud.mjs --repo vladseria/club-b-engine-lab \
//     --title "play-off odds: fresh squad v Rapid Pensia by start energy" \
//     --command "node packages/football-engine/evidence/2026-11-14-playoff-odds/run.mjs --label lab1" \
//     --into packages/football-engine/evidence/2026-11-14-playoff-odds/results/lab1.jsonl
import {build} from 'esbuild';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,mkdirSync,readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const mod=await import(pathToFileURL(workerData.bundle).href);mod.init(workerData.data);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mod.play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});

 const data=JSON.parse(readFileSync(path.join(here,'input.json'),'utf8'));
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const bundle=path.join(outDir,'.match.bundle.mjs');
 await build({entryPoints:[path.join(here,'match.ts')],bundle:true,format:'esm',platform:'node',target:'node22',outfile:bundle,logLevel:'warning'});
 const mod=await import(pathToFileURL(bundle).href);mod.init(data);

 // ---- the whole design, built and checked before anything plays
 const every=[];
 for(let n=1;n<=24;n++)for(const seed of mod.seedsOf(n))for(const level of mod.LEVEL_ORDER)every.push({n,level,seed});
 const fp={pensia:new Set(),newBy:new Map()};
 for(const t of every){const d=mod.dryCheck(t);fp.pensia.add(d.pensiaFp);
  if(fp.newBy.has(t.n)&&fp.newBy.get(t.n)!==d.newFp)throw Error(`squad ${t.n}: the new club's side differs between tasks`);fp.newBy.set(t.n,d.newFp);}
 if(fp.pensia.size!==1)throw Error(`Pensia's side differs between tasks beyond the energies (${fp.pensia.size} variants)`);
 console.log(`checked ${every.length} inputs: Pensia's side is one side but for the energies; each squad's side is the same at every level`);
 if(argv.includes('--dry')){
  console.log(JSON.stringify(mod.dryCheck({n:1,level:'fresh',seed:mod.seedsOf(1)[0]}).pensia));
  for(let n=1;n<=24;n++){const d=mod.dryCheck({n,level:'fresh',seed:mod.seedsOf(n)[0]}).newClub;console.log(n,d.formation,d.style,d.lineup.join(' '),'captain',d.captain,JSON.stringify(d.approach));}
 }

 if(argv.includes('--probe')){
  const n=Number(arg('n',1)),t={label:'probe',n,level:arg('level','fresh'),seed:Number(arg('seed',mod.seedsOf(n)[0]))};
  console.log(JSON.stringify(mod.dryCheck(t)));
  const r=mod.play(t);console.log(JSON.stringify(r));process.exit(r.dropped.length?1:0);
 }

 const label=arg('label');if(!label){if(argv.includes('--dry'))process.exit(0);throw Error('--label is required');}
 const squads=new Set(range(arg('squads','1-24'))),levels=new Set(arg('levels',mod.LEVEL_ORDER.join(',')).split(','));
 const chosen=every.filter(t=>squads.has(t.n)&&levels.has(t.level)).map(t=>({label,...t}));
 const key=j=>`${j.n}:${j.level}:${j.seed}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(chosen).filter(t=>!done.has(key(t)));
 const workers=Math.min(6,simWorkers(Number(arg('workers',1))));
 console.log(`${label}${shardNote()}: ${tasks.length} matches of ${chosen.length} on ${workers} workers (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry'))process.exit(0);
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundle,data}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){
    if(m.line.dropped?.length){failed++;console.error('DROPPED',m.line.n,m.line.level,m.line.seed,m.line.dropped);}
    else{appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}
   }else{failed++;console.error('FAILED',m.task.n,m.task.level,m.task.seed,m.error);}
   if((finished+failed)%5===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
