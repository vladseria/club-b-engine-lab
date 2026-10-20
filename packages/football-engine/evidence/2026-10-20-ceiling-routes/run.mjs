// Ceiling routes (2026-10-20): the runner (the engine-audits runner, ../2026-10-19-engine-audits/run.mjs, with the entry
// ceiling.ts bundled through hook.mjs). Shardable (../_ci/shard.mjs), resumable, <= 4 workers. More than 4 matches: the
// public lab only (cloud.mjs); the laptop plays single traces with MATCHES=<n>.
//   node run.mjs --label screen @screen:0-39                         rows -> results/<label>.jsonl
//   node run.mjs --label conf iso.iso~same,avg.iso~same:40-119
//   node run.mjs --label par --parity @parity:0-7                    hooked (shadow + exact-recompute probe) v computeMatch
//   node run.mjs --label pilot --watch avg.iso~same,...:0-3           rows with the compact replay -> results/watch-<label>.jsonl
// Macros: @screen = the 39 screen cells (see ANALYSIS in analyze.mjs); @parity = Direct arms for the parity check.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {hook} from './hook.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
export const ROUTES={iso:'iso',piv:'piv',ovl:'ovl'};
export function screenArms(){
 const a=[];
 for(const r of Object.keys(ROUTES)){
  a.push(`${r}.${r}~same`,`${r}.${r}~dir`,`${r}.${r}~deep`,`${r}.${r}~high`,`${r}.dir~dir`,`${r}.dir~deep`,`${r}.dir~high`,`avg.${r}~same`,`avg.${r}~deep`,`avg.${r}~high`);
 }
 a.push('avg.dir~same','avg.dir~deep','avg.dir~high','avg.pd~same','avg.pd~deep','avg.pd~high','isoP.iso~same','pivP.piv~same','ovlP.ovl~same');
 return a;
}
const expand=a=>a==='@screen'?screenArms():a==='@parity'?['avg.dir~same','iso.dir~deep','piv.dir~high','ovl.dir~dir']:[a];

if(!isMainThread){
 const hooked=await import(pathToFileURL(workerData.hooked).href);
 const plain=workerData.plain?await import(pathToFileURL(workerData.plain).href):null;
 parentPort.on('message',task=>{try{
  if(task.parity){
   const a=hooked.play({...task,probe:true}),b=plain.plain(task);
   parentPort.postMessage({ok:true,line:{label:task.label,arm:task.arm,seed:task.seed,rev:task.rev,parity:true,same:JSON.stringify(a.print)===JSON.stringify(b.print),score:a.score,plainScore:b.score,print:a.print,plainPrint:b.print,plat:a.plat,build:a.build,shadow:a.rt.shadow.length}});
  }else parentPort.postMessage({ok:true,line:hooked.play(task)});
 }catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const parity=argv.includes('--parity'),watch=argv.includes('--watch');
 const flagVals=new Set(['label','revs','workers'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const i=b.lastIndexOf(':');return {arms:[...new Set(b.slice(0,i).split(',').flatMap(expand))],seeds:range(b.slice(i+1))};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const revs=parseRevs(arg('revs','eng=working'));
 if(Object.keys(revs).length!==1)throw Error('one rev per run');
 const rev=Object.keys(revs)[0];
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const hooked=(await bundleRevs({entry:path.join(here,'ceiling.ts'),revs,outDir,extraPlugins:[hook],tag:'ceiling'}))[rev];
 const plain=parity?(await bundleRevs({entry:path.join(here,'ceiling.ts'),revs,outDir,tag:'plain'}))[rev]:null;
 const chk=await import(pathToFileURL(hooked).href);
 for(const b of blocks)for(const a of b.arms)chk.armTreatment(a);// throws on an unknown arm

 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)every.push({label,arm,seed,rev,parity,...(watch?{watch:true}:{})});
 const uniq=new Map(every.map(t=>[`${t.arm}:${t.seed}`,t]));every.length=0;every.push(...uniq.values());
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,watch?`watch-${label}.jsonl`:`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
 const played=tasks.length*(parity?2:1);
 if(local&&!argv.includes('--dry')){const declared=Number(process.env.MATCHES);if(!(declared>=played))throw Error(`MATCHES=${process.env.MATCHES} but ${played} matches would be played`);if(played>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',4))));
 console.log(`${label}${shardNote()}: ${tasks.length} tasks (${played} matches) of ${every.length} on ${workers} workers; rev ${rev}=${revs[rev]}${parity?' PARITY':''} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.arm]=(by[t.arm]??0)+1;console.log(Object.keys(by).length,'arms',by);process.exit(0);}
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{hooked,plain}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;if(m.line.parity)console.log(`${m.line.arm}:${m.line.seed} parity ${m.line.same?'SAME':'DIFFERENT'} ${m.line.score} vs ${m.line.plainScore}`);}
   else{failed++;console.error('FAILED',m.task.arm,m.task.seed,m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
