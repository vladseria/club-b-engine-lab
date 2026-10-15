// R1 keeper tune (2026-10-15): keeper.ts mirror matches, shardable (../_ci/shard.mjs), several engine arms side by side.
//   node run.mjs --label t1 --arms base=ce74b470,c30=working,c15=working:ns.15 --sweeps 0.07,0.5,0.8 s1-agg-ba211:0-9 di121vsh121,co121vba121:0-4
// An arm is name=<rev>[:<variant>]. <rev> as ../_ci/revs.mjs (working | git rev | dir:<path>). <variant> is a
// bundle-time edit of practice-carry.ts (esbuild onLoad, every replacement must match exactly once):
//   ns<v>   NET_SWEEPER=<v> (keeperNetWeight's weight at keeperSweep 1), e.g. ns.15, ns0, ns-.2
//   z       keeperNetWeight floored at 0 (for a negative NET_SWEEPER: the line meets 0 before keeperSweep 1)
// joined with '+', e.g. working:ns-.2+z. Blocks: <arm,arm>:<seeds> (../2026-10-10-cloud-measure/mirror.ts arms).
// Every (block arm, seed) is played at every sweep on every engine arm. Rows -> results/<label>.jsonl.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs} from '../_ci/revs.mjs';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
function variantPlugin(v){
 const edits=v?v.split('+').map(k=>{
  let m;
  if((m=/^ns(-?[\d.]+)$/.exec(k)))return [/export const NET_HOME=1\.5,NET_SWEEPER=-?[\d.]+;/,`export const NET_HOME=1.5,NET_SWEEPER=${Number(m[1])};`];
  if(k==='z')return [/=>NET_HOME\+\(NET_SWEEPER-NET_HOME\)\*clamp\(p\.traits\.keeperSweep\?\?\.2,0,1\);/,'=>Math.max(0,NET_HOME+(NET_SWEEPER-NET_HOME)*clamp(p.traits.keeperSweep??.2,0,1));'];
  throw Error(`unknown variant part '${k}'`);
 }):[];
 return {name:'tune-variant',setup(b){
  if(!edits.length)return;
  b.onLoad({filter:/football-engine\/src\/practice-carry\.ts$/},a=>{
   let src=readFileSync(a.path,'utf8');
   for(const [re,to] of edits){const n=src.split(re).length-1;if(n!==1)throw Error(`variant ${v}: ${re} matched ${n} times in ${a.path}`);src=src.replace(re,()=>to);}
   return {contents:src,loader:'ts'};
  });
 }};
}
if(!isMainThread){
 const mods={};
 for(const [arm,bundle] of Object.entries(workerData.bundles))mods[arm]=await import(pathToFileURL(bundle).href);
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mods[task.rev].play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const flagVals=new Set(['label','arms','workers','sweeps'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:arms.split(','),seeds:range(seeds)};});
 const arms=Object.fromEntries(arg('arms','fix=working').split(',').map(s=>{const [n,...r]=s.split('=');const spec=r.join('=');const i=spec.indexOf(':',spec.startsWith('dir:')?4:0);return [n,i>=0?{rev:spec.slice(0,i),v:spec.slice(i+1)}:{rev:spec,v:''}];}));
 const sweeps=arg('sweeps','0.07,0.5,0.8').split(',').map(Number);
 const outDir=path.join(here,'results'),bundles={};
 for(const [name,{rev,v}] of Object.entries(arms))Object.assign(bundles,await bundleRevs({entry:path.join(here,'keeper.ts'),revs:{[name]:rev},outDir,extraPlugins:[variantPlugin(v)],tag:v.replace(/[^\w.-]/g,'_')||''}));
 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const sweep of sweeps)for(const rev of Object.keys(arms))every.push({label,arm,seed,sweep,rev});
 const key=j=>`${j.arm}:${j.seed}:${j.sweep}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=simWorkers(Number(arg('workers',1)));
 console.log(`${label}: ${tasks.length} matches of ${every.length} on ${workers} workers ${shardNote?.()??''}; arms ${Object.entries(arms).map(([n,a])=>`${n}=${a.rev}${a.v?':'+a.v:''}`).join(', ')}`);
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundles}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}else{failed++;console.error('FAILED',key(m.task),m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s`);
 if(failed)process.exitCode=1;
}
