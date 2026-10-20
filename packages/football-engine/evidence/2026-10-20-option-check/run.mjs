// Option check (2026-10-20): the runner. One task = one match (arm:seed): pass A, frame selection, pass B rollouts
// (option.ts, bundled through hook.mjs). Shardable (../_ci/shard.mjs), resumable, <= 4 workers. More than 4 matches:
// the public lab only (cloud.mjs); locally each task plays 2 matches (pass A, and pass B up to its last frame) plus
// the rollouts, so MATCHES=2 allows one task.
//   node run.mjs --label oc --N 24 --H 10 --per 2 di121vba121,di121vsh121,di121vco121:0-9
// Rows -> results/<label>.jsonl: kind 'frame' (one per frame, every rollout's outcome) and kind 'task' (per match:
// hashes, counts, the checks). Seeds per arm: treated (Direct) side = seed % 2, kick-off = (seed >> 1) % 2 (mirror.ts).
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {hook} from './hook.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const O=await import(pathToFileURL(workerData.bundle).href);
 parentPort.on('message',t=>{try{
  const a=O.passA(t.arm,t.seed);
  const frames=O.select(t.arm,t.seed,a.decisions,{perStratum:t.per,gap:t.gap,edge:t.H+5,duration:900,cap:t.cap});
  const b=O.passB(t.arm,t.seed,frames,{N:t.N,H:t.H,band:t.band});
  const strata={};for(const d of a.decisions){const k=`${d.side===t.seed%2?'dir':'oth'}-${d.depth<16?1:d.depth<32?2:3}`;strata[k]=(strata[k]??0)+1;}
  parentPort.postMessage({ok:true,lines:[...b.rows.map(r=>({kind:'frame',label:t.label,N:t.N,H:t.H,...r})),
   {kind:'task',label:t.label,arm:t.arm,seed:t.seed,rev:t.rev,N:t.N,H:t.H,hashA:a.hash,score:a.score,msA:a.ms,msB:b.ms,openPlay:a.openPlay,eligible:a.decisions.length,strata,frames:frames.length,checks:b.checks,plat:b.rows[0]?.plat??null}]});
 }catch(e){parentPort.postMessage({ok:false,task:t,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const N=Number(arg('N',24)),H=Number(arg('H',10)),per=Number(arg('per',2)),cap=Number(arg('cap',12)),gap=Number(arg('gap',12)),band=Number(arg('band',.2));
 const flagVals=new Set(['label','revs','workers','N','H','per','cap','gap','band'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const i=b.lastIndexOf(':');return {arms:b.slice(0,i).split(','),seeds:range(b.slice(i+1))};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const revs=parseRevs(arg('revs','eng=working'));if(Object.keys(revs).length!==1)throw Error('one rev per run');
 const rev=Object.keys(revs)[0];
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const bundle=(await bundleRevs({entry:path.join(here,'option.ts'),revs,outDir,extraPlugins:[hook],tag:'oc'}))[rev];
 const every=[];for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)every.push({label,arm,seed,rev,N,H,per,cap,gap,band});
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(j=>j.kind==='task').map(key):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS,played=tasks.length*2;
 if(local&&!argv.includes('--dry')){const declared=Number(process.env.MATCHES);if(!(declared>=played))throw Error(`MATCHES=${process.env.MATCHES} but ${played} matches would be played`);if(played>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',4))));
 console.log(`${label}${shardNote()}: ${tasks.length} tasks (${played} match plays + rollouts, N ${N}, H ${H} s) of ${every.length} on ${workers} workers; rev ${rev}=${revs[rev]} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry'))process.exit(0);
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundle}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,m.lines.map(l=>JSON.stringify(l)).join('\n')+'\n');finished++;const tk=m.lines.at(-1);
    console.log(`${tk.arm}:${tk.seed} ${tk.frames} frames, checks ${JSON.stringify(tk.checks)}, ${((Date.now()-t0)/1000).toFixed(0)} s`);}
   else{failed++;console.error('FAILED',m.task.arm,m.task.seed,m.error);}
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
