// Engine as data, S0 tool 4 (the runner): the 512 parity set, every task played on every revision in --revs, back to
// back on the same worker (order rotated per task), one row per task: per revision ms / cpuMs / score / print / full /
// build, plus `same` = every revision's print AND full equal the first's, and (from the first revision) the resolved
// tactics of both sides, the variety read and anything the compute path dropped. A copy of
// ../2026-10-19-engine-speed/run.mjs with the task list of set.mjs. Shardable, resumable, <= 4 workers.
//   lab:    node run.mjs --label base --workers 4 --revs base=b107e7b2,cand=working            (via _ci/cloud.mjs)
//   laptop: MATCHES=4 node run.mjs --label laptop --revs base=working --block T                (the 4 traces, 1 worker)
//   check:  MATCHES=1 node run.mjs --label build --revs base=working --build-only              (all 512 inputs built and validated by
//           createSimulationRequest, no simulation: the harness's own smoke test; MATCHES=1 only satisfies the hook)
// Filters: --block A,B (blocks), --only <regex> (task ids). Laptop: MATCHES must be declared and the played count
// (tasks x revisions) may not pass 4; everything bigger goes to the public lab.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {tasks as allTasks} from './set.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

/** Frozen sides, each md5-checked against its CHECKSUMS.json (a changed file refuses to play). */
export function loadSides(){
 const load=(dir)=>{
  const sums=JSON.parse(readFileSync(path.join(dir,'CHECKSUMS.json'),'utf8')).files,out={};
  for(const f of Object.keys(sums)){const txt=readFileSync(path.join(dir,f),'utf8'),md5=createHash('md5').update(txt).digest('hex');
   if(md5!==sums[f].md5)throw Error(`${f}: md5 ${md5} is not the recorded ${sums[f].md5}`);
   const s=JSON.parse(txt);if('manager' in s||'manager' in (s.club??{}))throw Error(f+': has a manager field');out[f.split('.')[0]]=s;}
  return out;
 };
 return {scen:load(path.join(here,'../2026-10-09-scenarios/sides')),g7:load(path.join(here,'global-r7'))};
}

if(!isMainThread){
 const mods={};
 for(const [name,file] of Object.entries(workerData.bundles)){mods[name]=await import(pathToFileURL(file).href);mods[name].init(workerData.sides);if(workerData.buildOnly)mods[name].setDry(true);}
 const names=Object.keys(mods);
 parentPort.on('message',task=>{try{
  const order=names.map((_,i)=>names[(i+task.rot)%names.length]),by={};
  for(const n of order)by[n]=mods[n].play(task);
  const first=by[names[0]];
  const same=names.every(n=>JSON.stringify(by[n].print)===JSON.stringify(first.print)&&by[n].full===first.full);
  const strip=r=>({ms:r.ms,cpuMs:r.cpuMs,score:r.score,print:r.print,full:r.full,build:r.build});
  parentPort.postMessage({ok:true,line:{label:task.label,id:task.id,block:task.block,kind:task.kind,order,same,score:first.score,runs:first.runs,frames:first.frames,plat:first.plat,
   revs:Object.fromEntries(names.map(n=>[n,strip(by[n])])),dropped:first.dropped,tactics:first.tactics,variety:first.variety,...(task.option?{option:task.option,tested:task.tested}:{})}});
 }catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const label=arg('label');if(!label)throw Error('--label is required');
 const sides=loadSides();
 const revs=parseRevs(arg('revs','base=working'));
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const bundles=await bundleRevs({entry:path.join(here,'parity.ts'),revs,outDir,tag:'parity'});
 const blocks=arg('block')?new Set(arg('block').split(',')):null,only=arg('only')?new RegExp(arg('only')):null;
 let rot=0;
 const every=allTasks().filter(t=>(!blocks||blocks.has(t.block))&&(!only||only.test(t.id))).map(t=>({...t,label,rot:rot++%Object.keys(revs).length}));
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).id):[]);
 const todo=shardTasks(every).filter(t=>!done.has(t.id));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
 const played=todo.length*Object.keys(revs).length;
 const buildOnly=argv.includes('--build-only');// every input built and validated, nothing simulated (no match is played)
 if(local&&!buildOnly){const declared=Number(process.env.MATCHES);if(!(declared>=played))throw Error(`MATCHES=${process.env.MATCHES} but ${played} matches would be played`);if(played>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${todo.length} tasks (${played} task-runs) of ${every.length} on ${workers} workers; revs ${JSON.stringify(revs)} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry'))process.exit(0);
 let finished=0,failed=0,different=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,todo.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundles,sides,buildOnly}});
  const next=()=>{const t=todo.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;if(!m.line.same){different++;console.log(`${m.line.id} DIFFERENT`);}}
   else{failed++;console.error('FAILED',m.task.id,m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written (${different} different), ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
