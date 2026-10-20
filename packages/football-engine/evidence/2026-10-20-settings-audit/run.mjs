// Settings audit (2026-10-20): the runner (../2026-10-20-defensive-ceiling/run.mjs without the hook). Shardable
// (../_ci/shard.mjs), resumable, <= 4 workers. More than 4 matches: the public lab only (cloud.mjs); the laptop plays at
// most 4 single matches, 1 worker, with MATCHES=<n> declared.
//   node run.mjs --label a @A:0-39                  Block A: every ordered pairing of the 8 set-ups -> results/a.jsonl
//   node run.mjs --label b @B:0-59                  Block B: every arm x the 4 opponents (base / 2-2 cells are Block A's)
//   node run.mjs --label par --parity @par:0-3      sa.ts v computeMatch on the same input (2 matches a task)
// Arms are canonicalised (sa.ts canonical), so a Block B base or 2-2 cell is played and stored under its Block A name.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const ST=['ba','sh','di','co'],FM=['121','22'];
const SETUPS=ST.flatMap(s=>FM.map(f=>s+f));
const CH=['base','f22','pgpat','pgdir','wnar','wwid','ldeep','lhigh','psel','pagg','tsec','tcou','olcp','c3','c5','kline','kswp','fksh','fkdel'];
const expand=a=>a==='@A'?SETUPS.flatMap(x=>SETUPS.map(y=>`A.${x}v${y}`))
 :a==='@B'?CH.flatMap(c=>ST.map(o=>`B.${c}v${o}`))
 :a==='@par'?['A.ba121vdi121','B.kswpvco','B.fkdelvsh']:[a];

if(!isMainThread){
 const mod=await import(pathToFileURL(workerData.bundle).href);
 parentPort.on('message',task=>{try{
  if(task.parity){
   const a=mod.play(task),b=mod.plain(task),same=JSON.stringify(a.print)===JSON.stringify(b.print);
   parentPort.postMessage({ok:true,line:{label:task.label,kind:'sa-parity',arm:task.arm,seed:task.seed,rev:task.rev,parity:true,same,score:a.score,plainScore:b.score,print:a.print,plainPrint:b.print,plat:a.plat,build:a.build}});
  }else parentPort.postMessage({ok:true,line:mod.play(task)});
 }catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const parity=argv.includes('--parity');
 const flagVals=new Set(['label','revs','workers'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const i=b.lastIndexOf(':');return {arms:b.slice(0,i).split(',').flatMap(expand),seeds:range(b.slice(i+1))};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const revs=parseRevs(arg('revs','eng=working'));
 if(Object.keys(revs).length!==1)throw Error('one rev per run');
 const rev=Object.keys(revs)[0];
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const bundle=(await bundleRevs({entry:path.join(here,'sa.ts'),revs,outDir,tag:'sa'}))[rev];
 const chk=await import(pathToFileURL(bundle).href);
 for(const b of blocks){b.arms=[...new Set(b.arms.map(a=>chk.canonical(a)))];for(const a of b.arms)chk.armTreatment(a);}// throws on an unknown arm

 const uniq=new Map();
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)uniq.set(`${arm}:${seed}`,{label,arm,seed,rev,parity});
 const every=[...uniq.values()];
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
 const played=tasks.length*(parity?2:1);
 if(local&&!argv.includes('--dry')){const declared=Number(process.env.MATCHES);if(!(declared>=played))throw Error(`MATCHES=${process.env.MATCHES} but ${played} matches would be played`);if(played>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',4))));
 console.log(`${label}${shardNote()}: ${tasks.length} tasks (${played} matches) of ${every.length} on ${workers} workers; rev ${rev}=${revs[rev]}${parity?' PARITY':''} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.arm]=(by[t.arm]??0)+1;console.log(Object.keys(by).length,'arms');process.exit(0);}
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundle}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;if(m.line.parity)console.log(`${m.line.arm}:${m.line.seed} parity ${m.line.same?'SAME':'DIFFERENT'} ${m.line.score} vs ${m.line.plainScore}`);else console.log(`${m.line.arm}:${m.line.seed} ${m.line.score} ${m.line.ms} ms`);}
   else{failed++;console.error('FAILED',m.task.arm,m.task.seed,m.error);}
   if((finished+failed)%20===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
