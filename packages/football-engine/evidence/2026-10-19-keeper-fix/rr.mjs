// Keeper fix (2026-10-19): ../2026-10-16-press-cover/rr.mjs with the entry rr.ts (cp.ts plus the situation checks, sit). Otherwise unchanged.
// Press cover (2026-10-16): ../2026-10-13-keeper-2/rr.mjs (the release-2 round robin runner) with the entry cp.ts (probe.ts row minus sh/aer, plus cp). Otherwise unchanged.
// Accuracy probe (2026-10-13): probe.ts matches (audit.ts row + per-shot situations); was: audit.ts matches (the deep-study row + st), laptop (<= 3 workers) or cloud
// (SIM_WORKERS, <= 4 on a 4-vCPU runner). The deep-study runner unchanged but for the entry.
//   node run.mjs --label s1 --revs eng=working s1-ref-di121,s1-wid-di121:0-59
// The cloud-measure runner (../2026-10-10-cloud-measure/run.mjs) with audit.ts as the entry. Output
// results/<label>.jsonl, appended; finished (arm, seed, rev) rows are skipped, so a stopped run resumes.
// Parity: the same seeds through the official path, then parity.mjs:
//   node ../2026-10-10-cloud-measure/run.mjs --label <x> --revs eng=working <same arms:seeds>
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const mods={};
 for(const [rev,bundle] of Object.entries(workerData.bundles))mods[rev]=await import(pathToFileURL(bundle).href);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mods[task.rev].play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const flagVals=new Set(['label','revs','workers'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:arms.split(','),seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const revs=parseRevs(arg('revs','base=working'));
 const outDir=path.join(here,'results');
 const bundles=await bundleRevs({entry:path.join(here,"rr.ts"),revs,outDir});
 const chk=await import(pathToFileURL(Object.values(bundles)[0]).href);
 for(const b of blocks)for(const a of b.arms)chk.armTreatment(a);// throws on an unknown arm

 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const rev of Object.keys(bundles))every.push({label,arm,seed,rev});
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${tasks.length} mirror matches of ${every.length} on ${workers} workers; revs ${Object.entries(revs).map(([n,r])=>`${n}=${r}`).join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.arm]=(by[t.arm]??0)+1;console.log(by);process.exit(0);}
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
