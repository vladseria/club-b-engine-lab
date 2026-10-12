// Stamina study (2026-10-12): stamina.ts matches, laptop (<= 3 workers) or cloud (SIM_WORKERS, <= 4 a runner).
//   node run.mjs --label diag --revs eng=working --vars hook,hook+reserve p-stamina,m-stamina:0-39
//   node run.mjs --label fix --revs base=<rev>,fix=working --vars hook p-stamina,m-stamina,p-pace,m-pace:0-79
// The deep-study runner (../2026-10-12-deep-study/run.mjs) with stamina.ts as the entry and one bundle per
// (rev, variant) pair (variants.mjs). Rows go to results/<label>.jsonl, appended; finished (arm, seed, rev, var)
// rows are skipped, so a stopped run resumes. A row's `rev` is `<rev>` for variant base/hook, else `<rev>~<var>`.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {variantPlugin} from './variants.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const mods={};
 for(const [key,bundle] of Object.entries(workerData.bundles))mods[key]=await import(pathToFileURL(bundle).href);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:{...mods[task.key].play(task),var:task.var}});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const flagVals=new Set(['label','revs','workers','vars'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:arms.split(','),seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const revs=parseRevs(arg('revs','eng=working')),vars=arg('vars','hook').split(',');
 const outDir=path.join(here,'results'),bundles={};
 for(const v of vars){
  const b=await bundleRevs({entry:path.join(here,'stamina.ts'),revs,outDir,extraPlugins:[variantPlugin(v)],tag:v.replace(/\+/g,'-')});
  for(const [rev,file] of Object.entries(b))bundles[`${rev}~${v}`]=file;
 }
 const chk=await import(pathToFileURL(Object.values(bundles)[0]).href);
 for(const b of blocks)for(const a of b.arms)chk.armTreatment(a);// throws on an unknown arm
 const plain=v=>v==='base'||v==='hook';
 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const rev of Object.keys(revs))for(const v of vars)
  every.push({label,arm,seed,rev:plain(v)?rev:`${rev}~${v}`,var:v,key:`${rev}~${v}`});
 const key=j=>`${j.arm}:${j.seed}:${j.rev}:${j.var}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${tasks.length} matches of ${every.length} on ${workers} workers; revs ${Object.entries(revs).map(([n,r])=>`${n}=${r}`).join(', ')}; variants ${vars.join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.arm+' '+t.rev]=(by[t.arm+' '+t.rev]??0)+1;console.log(by);process.exit(0);}
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
