// Recovery probe (2026-10-15): measure.ts rows for each recovery variant (recovery.mjs: r06 current, r10, r14), all from
// this tree's engine with the base BEATEN_BALANCE switched at bundle time. Copy of ../2026-10-15-decide/run.mjs with
// --vars in place of --revs.
//   node run.mjs --label rec --workers 4 --vars r06,r10,r14 <arm,arm>:<seeds>
// results/<label>.jsonl, appended; finished (arm, seed, var) rows are skipped, so a stopped run resumes. row.rev = the variant.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs} from '../_ci/revs.mjs';
import {recoveryPlugin} from './recovery.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const mods={};
 for(const [v,bundle] of Object.entries(workerData.bundles))mods[v]=await import(pathToFileURL(bundle).href);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mods[task.rev].play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const flagVals=new Set(['label','vars','workers'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:arms.split(','),seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const vars=arg('vars','r06,r10,r14').split(',');
 const outDir=path.join(here,'results'),entry=path.join(here,'measure.ts');
 const bundles={};
 for(const v of vars)bundles[v]=(await bundleRevs({entry,revs:{[v]:'working'},outDir,extraPlugins:[recoveryPlugin(v)],tag:'rec'}))[v];
 const chk=await import(pathToFileURL(Object.values(bundles)[0]).href);
 for(const b of blocks)for(const a of b.arms)chk.armTreatment(a);// throws on an unknown arm

 // group order: (arm, seed) then variant, so consecutive tasks spread over shards and each variant of a pair is near
 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const v of vars)every.push({label,arm,seed,rev:v});
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=Math.min(4,simWorkers(Number(arg('workers',1))));
 console.log(`${label}${shardNote()}: ${tasks.length} mirror matches of ${every.length} on ${workers} workers; vars ${vars.join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.rev]=(by[t.rev]??0)+1;console.log(by);process.exit(0);}
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundles}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){
    if(m.line.dropped?.length){failed++;console.error('DROPPED',m.line.arm,m.line.seed,m.line.dropped);}
    else{appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}
   }else{failed++;console.error('FAILED',m.task.arm,m.task.seed,m.task.rev,m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
