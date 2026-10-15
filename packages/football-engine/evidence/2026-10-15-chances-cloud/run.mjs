// Chances on the public lab (2026-10-15): ../2026-10-04-practice-chances/run.mjs made shardable (../_ci/shard.mjs),
// with the three snapshots it reads swapped at bundle time for the Ballers-only copies in inputs/ (sanitize.mjs).
// Same entry (../2026-10-04-practice-chances/chances.ts, unchanged), same 100-match plan, same task order and keys, same
// row; table.mjs reads the rows as it reads a local run's.
//   node packages/football-engine/evidence/2026-10-15-chances-cloud/run.mjs [--workers 4] [--label calib-<build8>] [--reps 4]
//   cloud: --into packages/football-engine/evidence/2026-10-04-practice-chances/results/calib-<build8>.jsonl, then
//   node packages/football-engine/evidence/2026-10-04-practice-chances/table.mjs
import {build} from 'esbuild';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,mkdirSync,readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const BUILD8=readFileSync(path.resolve(here,'../../src/build-info.ts'),'utf8').match(/'([0-9a-f]{8})/)[1];
// the originals' import paths -> the copies (they need not exist: the public lab has only the copies)
const SWAP=[[/2026-09-29-style-balance\/inputs\/ballers_clubs\.json$/,'ballers_clubs.json'],[/2026-09-29-style-balance\/inputs\/ballers_players\.json$/,'ballers_players.json'],
 [/2026-10-03-defending-awareness\/inputs\/sides\.json$/,'sides.json']];
const swap={name:'ballers-only-inputs',setup(b){b.onResolve({filter:/\.json$/},a=>{for(const [re,file] of SWAP)if(re.test(a.path))return {path:path.join(here,'inputs',file)};});}};
if(!isMainThread){
 const mod=await import(pathToFileURL(workerData.bundle).href);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mod.play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
 const label=arg('label',`calib-${BUILD8}`),workers=simWorkers(Math.min(6,Number(arg('workers',1))));
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const out=path.join(outDir,`${label}.jsonl`),bundle=path.join(outDir,`.${label}.bundle.mjs`);
 await build({entryPoints:[path.join(here,'../2026-10-04-practice-chances/chances.ts')],bundle:true,format:'esm',platform:'node',target:'node22',outfile:bundle,logLevel:'warning',plugins:[swap]});
 const D=900,every=[];
 // --reps R (default 1 = the 100-match plan as it always was): every group gets R times its seeds, the mix unchanged.
 // The plan's own seeds come first and stay the same tasks (same keys), so the first 100 compare like for like with
 // an older build's 100; the extra seeds continue each fixed group's run (1000..), and the styles pairs' extras start
 // at 2100+k*100 so no pair reuses another pair's seed.
 const reps=Math.max(1,Math.floor(Number(arg('reps',1))));
 const seeds=(a,n)=>Array.from({length:n},(_,i)=>a+i);
 for(const seed of seeds(1000,20*reps))every.push({group:'mcb',setup:'mcb',seed,duration:D});
 for(const seed of seeds(1000,20*reps))every.push({group:'int',setup:'int',seed,duration:D});
 for(const seed of seeds(1000,15*reps))every.push({group:'short',setup:'mcb',lever:'planShort',seed,duration:D});
 for(const seed of seeds(1000,15*reps))every.push({group:'high',setup:'mcb',lever:'planTactic',seed,duration:D});
 for(const seed of seeds(1000,10*reps))every.push({group:'dvc',setup:'dvc',seed,duration:D});
 const pairs=[['combinations','balanced'],['counter','combinations'],['balanced','direct'],['direct','combinations']];
 pairs.forEach((pair,k)=>{for(const seed of [...seeds(2000+k*10,5),...seeds(2100+k*100,5*(reps-1))])every.push({group:'styles',setup:'parity',pair,cell:seed%4,seed,duration:D});});
 const key=j=>`${j.group}:${j.seed}:${(j.pair??[]).join('-')}`;
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const byGroup=Object.values(Object.groupBy(every,t=>t.group)),order=[];
 for(let i=0;order.length<every.length;i++)for(const g of byGroup)if(g[i])order.push(g[i]);
 const only=arg('only');// e.g. --only mcb:1000 (a single task, for the copies-v-originals check)
 const tasks=shardTasks(order).filter(t=>!done.has(key(t))&&(!only||`${t.group}:${t.seed}`===only));
 console.log(`${label}: ${tasks.length} matches on ${workers} workers${shardNote()} (${done.size} already done; ${every.length} in the plan)`);
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundle}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}
   else{failed++;console.error('FAILED',m.task,m.error);}
   console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
