// Keeper fix (2026-10-19): ../2026-10-16-release-3/repin.mjs with this folder's repin.ts (plus ordinary, subs).
// Release 3 (2026-10-16): the seed search for the seeded tests that move, made shardable for the public lab (the
// laptop may play at most 4 matches). Bundles repin.ts (engine src, its fixtures, lib/ballers/compute) once and plays
// EVERY seed of each range (not only up to the first hit), so a seed that does not reproduce on the laptop (arm64
// Linux and macOS differ in the last bits of Math.sin/exp/...) can fall back to the next hit.
//   node repin.mjs [--workers 4] header:14570-14629 volley:14113-14142 takeonGolusor:2114-2173 shotTrace:13878-13957 pipeline:4257-4296
// Rows -> results/repin.jsonl {kind, seed, found (a note or null), build, platform, ms}.
import {build} from 'esbuild';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {mkdirSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
if(!isMainThread){
 const mod=await import(pathToFileURL(workerData.bundle).href);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mod.play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2),arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const vals=new Set([arg('workers')].filter(Boolean));
 const every=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!vals.has(a)).flatMap(b=>{const [kind,r]=b.split(':'),[a,z]=r.split('-').map(Number);return Array.from({length:(z??a)-a+1},(_,i)=>({kind,seed:a+i}));});
 if(!every.length)throw Error('give at least one <kind>:<from>-<to> block');
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const out=path.join(outDir,'repin.jsonl'),bundle=path.join(outDir,'.repin.bundle.mjs');
 await build({entryPoints:[path.join(here,'repin.ts')],bundle:true,format:'esm',platform:'node',target:'node22',outfile:bundle,logLevel:'warning'});
 const tasks=shardTasks(every),workers=simWorkers(Math.min(4,Number(arg('workers',1))));
 console.log(`repin${shardNote()}: ${tasks.length} of ${every.length} checks on ${workers} workers`);
 let failed=0;
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundle}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{if(m.ok)appendFileSync(out,JSON.stringify(m.line)+'\n');else{failed++;console.error('FAILED',m.task.kind,m.task.seed,m.error);}next();});
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`repin: done, ${failed} failed -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
