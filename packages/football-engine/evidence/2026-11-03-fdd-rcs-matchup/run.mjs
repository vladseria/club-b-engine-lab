// FDD at RCS matchup study runner (2026-11-03). Plays arms through lib/ballers/compute.ts computeMatch on this tree,
// paired on seeds. Shardable for the public lab (../_ci/shard.mjs: SHARD_INDEX / SHARD_TOTAL / SIM_WORKERS).
//
//   node run.mjs --label <name> [--arms a,b|screen] [--seeds 1103000-1103099] [--duration 900] [--workers 1] [--dry]
//   node run.mjs --probe --arm prep [--seed 1103000]           one match, prints the row and its shots
//
// Output: results/<label>.jsonl, appended; finished (arm, seed, duration) rows are skipped, so a stopped run resumes.
// Seed-major order: a partial run is a complete paired set for its first seeds. A row whose input dropped anything
// (an order or switch the engine refused) is not written: it fails the run.
// Lab:
//   node packages/football-engine/evidence/_ci/cloud.mjs --repo vladseria/club-b-engine-lab --label <label> \
//     --command "node packages/football-engine/evidence/2026-11-03-fdd-rcs-matchup/run.mjs --label screen --arms screen --seeds 1103000-1103099" \
//     --into packages/football-engine/evidence/2026-11-03-fdd-rcs-matchup/results/screen.jsonl
import {build} from 'esbuild';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,mkdirSync,readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {ARMS,SCREEN,SWAPS,TIMING_ARMS,PLAN_ARMS,TARGET_ARMS,XSWAP_ARMS,HIGHPRESS_ARMS,BF5_ARMS} from './arms.mjs';
import {SWEEP,SWEEP_ARMS,AROUND5,AROUND5_ARMS} from './sweep.mjs';
Object.assign(ARMS,SWEEP,AROUND5);

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const mod=await import(pathToFileURL(workerData.bundle).href);mod.init(workerData.sides);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mod.play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});

 // ---- the frozen sides, checked against the server's md5 before anything plays
 const sums=JSON.parse(readFileSync(path.join(here,'sides/CHECKSUMS.json'),'utf8')).files;
 const readSide=f=>{const txt=readFileSync(path.join(here,'sides',f),'utf8'),md5=createHash('md5').update(txt).digest('hex'),want=sums[f]?.md5;
  if(md5!==want)throw Error(`${f}: md5 ${md5} is not the server's ${want}`);return JSON.parse(txt);};
 const ages=JSON.parse(readFileSync(path.join(here,'sides/AGES.json'),'utf8'));
 const sides={RCS:readSide('RCS.jsonb.txt'),RCSB:readSide('RCSB.jsonb.txt'),FDD:readSide('FDD.jsonb.txt'),ages:{RCS:ages.RCS,FDD:ages.FDD}};
 // --opp rcs (default: the round-11 side as first snapshotted) | rcsb (Roman City's prep as changed at 13:41 UTC)
 const opp=arg('opp','rcs');if(!['rcs','rcsb'].includes(opp))throw Error('--opp rcs|rcsb');

 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const bundle=path.join(outDir,'.match.bundle.mjs');
 await build({entryPoints:[path.join(here,'match.ts')],bundle:true,format:'esm',platform:'node',target:'node22',outfile:bundle,logLevel:'warning'});
 const mod=await import(pathToFileURL(bundle).href);mod.init(sides);

 // ---- every arm must be what the live app can store, must build a valid input, and the engine must take all its orders
 for(const [a,arm] of Object.entries(ARMS)){mod.checkArm(sides.FDD,arm,a);const d=mod.dryCheck({arm:a,seed:1,opp});if(argv.includes('--dry'))console.log(a,JSON.stringify(d));}

 if(argv.includes('--probe')){
  const r=mod.play({label:'probe',arm:arg('arm','prep'),seed:Number(arg('seed',1103000)),detail:true});
  console.log(JSON.stringify({...r,shots:undefined}));console.log(r.shots.map(s=>JSON.stringify(s)).join('\n'));process.exit(r.dropped.length?1:0);
 }

 const label=arg('label');if(!label)throw Error('--label is required');
 const armsArg=arg('arms','screen'),arms=armsArg==='screen'?SCREEN:armsArg==='swaps'?SWAPS:armsArg==='timing'?TIMING_ARMS:armsArg==='plans'?PLAN_ARMS:armsArg==='target'?TARGET_ARMS:armsArg==='xswap'?XSWAP_ARMS:armsArg==='sweep'?SWEEP_ARMS:armsArg==='highpress'?HIGHPRESS_ARMS:armsArg==='bf5'?BF5_ARMS:armsArg==='around5'?AROUND5_ARMS:armsArg.split(',');
 for(const a of arms)if(!ARMS[a])throw Error('unknown arm '+a);
 const seeds=range(arg('seeds','1103000-1103099')),duration=Number(arg('duration',900));
 const every=seeds.flatMap(seed=>arms.map(arm=>({label,arm,seed,duration,...(opp!=='rcs'?{opp}:{})})));
 const key=j=>`${j.arm}:${j.seed}:${j.duration??900}:${j.opp??'rcs'}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=Math.min(6,simWorkers(Number(arg('workers',1))));
 console.log(`${label}${shardNote()}: ${tasks.length} matches of ${every.length} on ${workers} workers (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry'))process.exit(0);
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundle,sides}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){
    if(m.line.dropped?.length){failed++;console.error('DROPPED',m.line.arm,m.line.seed,m.line.dropped);}
    else{appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}
   }else{failed++;console.error('FAILED',m.task.arm,m.task.seed,m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
