// Contest cost (2026-10-15): where the contest build's extra match time comes from. contest.ts rows
// (../2026-10-15-contest/contest.ts, unchanged) for R1 (ballers-r1, engine 8ae8dc61), the full contest build, and the
// contest build with one piece put back to R1 (ablate.mjs: ~norx, ~noair, ~noshot; alloff = all three).
//
//   node cost.mjs --label cost --workers 2 --revs r1=<R1 rev>,full=working --vars r1,full,norx,noair,noshot \
//     <arm,arm>:<seeds> [--also alloff=<arm,...>:<seeds>] [--prof <arm,...>:<seeds>] [--count]
//
// Timing that compares: the unit of work is a GROUP, one (arm, seed) with every variant asked for. Groups, not single
// matches, are split across shards (group i -> shard i % SHARD_TOTAL), so all variants of a pairing and seed run on the
// same runner, in the same few minutes. A shard runs its matches on --workers concurrent worker threads (SIM_WORKERS
// overrides, as everywhere); every match gets a FRESH worker (one bundle, cold JIT), so no variant profits from
// another's warm code or from being a worker's second match. The variant order is rotated per group so no variant
// is always first or last in the queue. Rows carry host, cpu, shard, workers, in-flight count and wall start/end, so
// the same-runner and no-oversubscription claims can be checked from the rows.
// After the timing pool has finished (nothing else running on the runner): --prof groups, each played on r1 and full
// in a child `node --cpu-prof` process one at a time (summary -> results/<label>-prof.jsonl via profsum.mjs, raw
// profile -> results/prof/*.cpuprofile.gz), and with --count once more each in a call-counting bundle (countwrap.mjs;
// counts -> results/<label>-count.jsonl). Rows: results/<label>.jsonl (row.arm carries the ablation modifiers, row.var
// the variant). Resumable locally (finished arm:seed:var rows are skipped).
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,writeFileSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import os from 'node:os';
import path from 'node:path';

if(!isMainThread){
 const m=await import(pathToFileURL(workerData.bundle).href);
 const t=workerData.task;
 try{
  const line=m.play({label:t.label,arm:t.base,seed:t.seed,rev:t.var});
  parentPort.postMessage({ok:true,line,calls:globalThis.__calls?Object.fromEntries(globalThis.__calls):undefined,callers:globalThis.__callers?Object.fromEntries([...globalThis.__callers].map(([k,v])=>[k,Object.fromEntries(v)])):undefined});
 }catch(e){parentPort.postMessage({ok:false,error:String(e?.stack??e)});}
}else{
 const {shardTasks,simWorkers,shardNote,SHARD_INDEX}=await import('../_ci/shard.mjs');
 const {bundleRevs,parseRevs}=await import('../_ci/revs.mjs');
 const {ablatePlugin}=await import('./ablate.mjs');
 const {summarize}=await import('./profsum.mjs');
 const {countBundle}=await import('./countwrap.mjs');
 const here=path.dirname(fileURLToPath(import.meta.url));
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const all=k=>argv.flatMap((a,i)=>a===`--${k}`?[argv[i+1]]:[]);
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const block=b=>{const [arms,seeds]=b.split(':');return {arms:arms.split(','),seeds:range(seeds)};};
 const label=arg('label');if(!label)throw Error('--label is required');
 const flagVals=new Set(['label','revs','workers','vars','also','prof'].flatMap(k=>all(k)));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(block);
 const revs=parseRevs(arg('revs','r1=working,full=working'));
 const vars=arg('vars','r1,full').split(',');
 const also=all('also').map(s=>{const [v,b]=s.split('=');return {v,...block(b)};});
 const prof=all('prof').map(block);
 const outDir=path.join(here,'results');
 mkdirSync(outDir,{recursive:true});
 const entry=path.join(here,'../2026-10-15-contest/contest.ts');
 const need=new Set([...vars,...also.map(a=>a.v),...(prof.length?['r1','full']:[])]);
 const bundles={};
 for(const v of need){
  if(v==='r1')Object.assign(bundles,await bundleRevs({entry,revs:{r1:revs.r1},outDir}));
  else bundles[v]=(await bundleRevs({entry,revs:{[v]:revs.full},outDir,extraPlugins:[ablatePlugin(v)],tag:v==='full'?'':v.replace(/\+/g,'-')}))[v];
 }
 const chk=await import(pathToFileURL(bundles[[...need][0]]).href);
 const armOf=(base,v)=>v==='r1'||v==='full'?base:`${base}~${v.replace(/\+/g,'~')}`;

 const groups=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms){chk.armTreatment(arm);
  groups.push({arm,seed,vars:[...vars,...also.filter(a=>a.arms.includes(arm)&&a.seeds.includes(seed)).map(a=>a.v)]});}
 for(const b of prof)for(const seed of b.seeds)for(const arm of b.arms){chk.armTreatment(arm);groups.push({arm,seed,vars:[],prof:true});}
 const mine=shardTasks(groups.map((g,i)=>({...g,gi:i})));
 const key=j=>`${j.arm}:${j.seed}:${j.var}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=[];
 for(const g of mine){const n=g.vars.length;for(let k=0;k<n;k++){const v=g.vars[(k+g.gi)%n];tasks.push({label,base:g.arm,arm:armOf(g.arm,v),seed:g.seed,var:v,gi:g.gi});}}
 const todo=tasks.filter(t=>!done.has(key(t)));
 const workers=Math.min(4,simWorkers(Number(arg('workers',2))));
 const cpu=os.cpus()[0]?.model??'?',host=os.hostname(),ncpu=os.cpus().length;
 console.log(`${label}${shardNote()}: ${mine.length} groups of ${groups.length}, ${todo.length} timed matches on ${workers} workers (${ncpu} cpus, ${cpu}); variants ${[...need].join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){console.log(mine.map(g=>`${g.gi} ${g.arm}:${g.seed} ${g.prof?'prof':g.vars.join(',')}`).join('\n'));process.exit(0);}

 const runOne=(bundle,task)=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundle,task}});
  let msg=null;w.on('message',m=>{msg=m;});w.on('error',e=>{msg={ok:false,error:String(e?.stack??e)};});
  w.on('exit',()=>resolve(msg??{ok:false,error:'worker exited without a result'}));
 });
 let finished=0,failed=0,inflight=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,todo.length)},async()=>{
  for(let t=todo.shift();t;t=todo.shift()){
   inflight++;const start=new Date().toISOString(),load=os.loadavg()[0],conc=inflight;
   const m=await runOne(bundles[t.var],t);inflight--;
   if(m.ok&&!m.line.dropped?.length){
    appendFileSync(out,JSON.stringify({...m.line,label,arm:t.arm,var:t.var,rev:t.var,gi:t.gi,host,cpu,ncpu,shard:SHARD_INDEX,workers,conc,load1:Math.round(load*100)/100,start,end:new Date().toISOString()})+'\n');finished++;
   }else{failed++;console.error('FAILED',t.arm,t.seed,t.var,m.error??m.line?.dropped);}
   console.log(`${finished+failed} done (${t.arm}:${t.seed} ${t.var} ${m.line?.ms??'-'} ms), ${((Date.now()-t0)/1000).toFixed(0)} s`);
  }
 }));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);

 // ---- profiles and call counts: one match at a time, nothing else running ----
 const profGroups=mine.filter(g=>g.prof);
 if(profGroups.length){
  const tmp=path.join(outDir,'.prof'),raw=path.join(outDir,'prof');mkdirSync(raw,{recursive:true});
  const one=path.join(here,'prof1.mjs'),interval=arg('interval','250');
  for(const g of profGroups)for(const v of ['r1','full']){
   const name=`${label}.${g.arm}.${g.seed}.${v}`,task={label:`${label}-prof`,base:g.arm,arm:g.arm,seed:g.seed,var:v};
   rmSync(tmp,{recursive:true,force:true});mkdirSync(tmp,{recursive:true});
   const started=Date.now();
   let row;try{row=JSON.parse(execFileSync(process.execPath,['--cpu-prof',`--cpu-prof-dir=${tmp}`,`--cpu-prof-interval=${interval}`,one,bundles[v],JSON.stringify(task)],{encoding:'utf8',maxBuffer:1<<28}).trim().split('\n').at(-1));}
   catch(e){failed++;console.error('PROFILE FAILED',name,String(e?.stack??e).slice(0,2000));continue;}
   const file=readdirSync(tmp).find(f=>f.endsWith('.cpuprofile'));
   const profile=JSON.parse(readFileSync(path.join(tmp,file),'utf8'));
   writeFileSync(path.join(raw,`${name}.cpuprofile.gz`),gzipSync(JSON.stringify(profile),{level:9}));
   const sum=summarize(profile,readFileSync(bundles[v],'utf8'));
   appendFileSync(path.join(outDir,`${label}-prof.jsonl`),JSON.stringify({label,arm:g.arm,seed:g.seed,var:v,score:row.score,stats:row.stats,ms:row.ms,wall:Date.now()-started,interval:Number(interval),host,cpu,shard:SHARD_INDEX,...sum})+'\n');
   console.log(`profiled ${name}: match ${row.ms} ms (wall ${Date.now()-started} ms)`);
  }
  rmSync(tmp,{recursive:true,force:true});
  if(argv.includes('--count'))for(const g of profGroups)for(const v of ['r1','full']){
   const cb=countBundle(bundles[v]);
   const m=await runOne(cb,{label:`${label}-count`,base:g.arm,arm:g.arm,seed:g.seed,var:v});
   if(!m.ok){failed++;console.error('COUNT FAILED',g.arm,g.seed,v,m.error);continue;}
   appendFileSync(path.join(outDir,`${label}-count.jsonl`),JSON.stringify({label,arm:g.arm,seed:g.seed,var:v,score:m.line.score,stats:m.line.stats,ms:m.line.ms,calls:m.calls,callers:m.callers,host,shard:SHARD_INDEX})+'\n');
   console.log(`counted ${g.arm}:${g.seed} ${v}: ${Object.keys(m.calls??{}).length} functions`);
  }
 }
 if(failed)process.exitCode=1;
}
