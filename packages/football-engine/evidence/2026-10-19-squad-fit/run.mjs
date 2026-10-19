// Squad fit (2026-10-19): the keeper-fix round robin runner (../2026-10-19-keeper-fix/rr.mjs) with the entry sf.ts and
// arm macros. Shardable (../_ci/shard.mjs); public lab only for more than 4 matches (the laptop runs single traces with
// MATCHES=1). Output results/<label>.jsonl, appended; finished (arm, seed, rev) rows are skipped, so a stopped run resumes.
//   node run.mjs --label screen --revs eng=working @all:0-39
//   node run.mjs --label conf --revs eng=working @h1,@h3:40-79   @hN = the four arms of hypothesis N against every opponent
//   node run.mjs --label x --revs eng=working h1.p1~dir,avg.dir~dir:0-3                      (explicit arms)
// Macros: @all = every arm of every hypothesis (A hN.pN, B avg.pN, C hN.dir, D avg.dir) against every opponent;
//         @hN = that hypothesis's A, B, C, D against every opponent; @hN/opp = only against that opponent.
// --watch: instead of rows, write the compact replay (header + frames + events) to results/watch-<label>.jsonl.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const OPPS=['dir','bal','sho','MEN','MAL'];
const H=['h1','h2','h3','h4','h5','h6','h7','h8'];
const hypArms=(h,opps=OPPS)=>{const n=h.slice(1);return opps.flatMap(o=>[`${h}.p${n}~${o}`,`avg.p${n}~${o}`,`${h}.dir~${o}`,`avg.dir~${o}`]);};
const expand=a=>{
 if(a==='@all')return [...new Set(H.flatMap(h=>hypArms(h)))];
 const m=/^@(h\d)(?:\/([A-Za-z]+))?$/.exec(a);if(m)return hypArms(m[1],m[2]?[m[2]]:OPPS);
 return [a];
};

if(!isMainThread){
 const mods={};
 for(const [rev,bundle] of Object.entries(workerData.bundles))mods[rev]=await import(pathToFileURL(bundle).href);
 parentPort.on('message',task=>{try{
  const m=mods[task.rev];
  parentPort.postMessage({ok:true,line:task.watch?m.watch(task):m.play(task)});
 }catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const watch=argv.includes('--watch');
 const flagVals=new Set(['label','revs','workers'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const i=b.lastIndexOf(':');return {arms:[...new Set(b.slice(0,i).split(',').flatMap(expand))],seeds:range(b.slice(i+1))};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const revs=parseRevs(arg('revs','eng=working'));
 const outDir=path.join(here,'results');
 const bundles=await bundleRevs({entry:path.join(here,watch?'watch.ts':'sf.ts'),revs,outDir,tag:watch?'watch':''});
 const chk=await import(pathToFileURL(Object.values(bundles)[0]).href);
 for(const b of blocks)for(const a of b.arms)chk.armTreatment(a);// throws on an unknown arm

 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const rev of Object.keys(bundles))every.push({label,arm,seed,rev,...(watch?{watch:true}:{})});
 const uniq=new Map(every.map(t=>[`${t.arm}:${t.seed}:${t.rev}`,t]));every.length=0;every.push(...uniq.values());
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,watch?`watch-${label}.jsonl`:`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=Math.min(4,simWorkers(Number(arg('workers',1))));
 if(!process.env.SHARD_TOTAL&&tasks.length>4&&!argv.includes('--dry'))throw Error(`${tasks.length} matches: more than 4 matches go on the public lab (cloud.mjs), never the laptop`);
 console.log(`${label}${shardNote()}: ${tasks.length} matches of ${every.length} on ${workers} workers; revs ${Object.entries(revs).map(([n,r])=>`${n}=${r}`).join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks){const o=t.arm.split('~')[1];by[o]=(by[o]??0)+1;}console.log(by,new Set(tasks.map(t=>t.arm)).size,'arms');process.exit(0);}
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
