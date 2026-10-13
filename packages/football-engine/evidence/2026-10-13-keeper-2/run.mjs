// Keeper 2 (2026-10-13): copied unchanged from ../2026-10-13-keeper-fix (branch ballers-keeper-fix).
// Keeper fix (2026-10-13; the giveaway study's runner, unchanged): keeper.ts matches, laptop (<= 3 workers) or cloud (SIM_WORKERS, <= 4 a runner).
//   node run.mjs --label k --revs live=working,prev=83d109dc di121vsh121,co121vba121:0-39 sc/men-mal/prep/stored:740000-740019
// Blocks: <mirror arm,arm>:<seeds> (../2026-10-10-cloud-measure/mirror.ts arms) or sc/<scenario>/<arm>/<opp>:<seeds>
// (../2026-10-09-scenarios, sides md5-checked). Rows go to results/<label>.jsonl, appended; finished
// (arm/scenario, seed, rev) rows are skipped, so a stopped run resumes.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {variantPlugin} from './variants.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const mods={};
 for(const [rev,bundle] of Object.entries(workerData.bundles)){mods[rev]=await import(pathToFileURL(bundle).href);mods[rev].scenarioInit(workerData.sides);}
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:{...mods[task.key].play(task),var:task.var}});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const flagVals=new Set(['label','revs','workers','vars'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:arms.split(','),seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const revs=parseRevs(arg('revs','live=working'));
 const outDir=path.join(here,'results');
 // the scenario sides, checked against the server's md5 (as ../2026-10-09-scenarios/run.mjs)
 const S=path.join(here,'../2026-10-09-scenarios');
 const {SCENARIOS}=await import(pathToFileURL(path.join(S,'scenarios.mjs')).href);
 const sums=JSON.parse(readFileSync(path.join(S,'sides/CHECKSUMS.json'),'utf8')).files;
 const readSide=f=>{const p=path.join(S,f),txt=readFileSync(p,'utf8'),md5=createHash('md5').update(txt).digest('hex');if(md5!==sums[path.basename(f)]?.md5)throw Error(`${f}: md5 mismatch`);return JSON.parse(txt);};
 const sides={};
 for(const [id,sc] of Object.entries(SCENARIOS)){if(sc.source.kind==='sides')sides[id]=[readSide(sc.source.home),readSide(sc.source.away)];}
 const vars=arg('vars','base').split(','),bundles={};
 for(const v of vars){const b=await bundleRevs({entry:path.join(here,'keeper.ts'),revs,outDir,extraPlugins:[variantPlugin(v)],tag:v.replace(/\+/g,'-')});for(const [rev,file] of Object.entries(b))bundles[`${rev}~${v}`]=file;}
 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const rev of Object.keys(revs))for(const v of vars){const key=`${rev}~${v}`,var_=v;
  if(arm.startsWith('sc/')){const [,scenario,a,opp]=arm.split('/');if(!sides[scenario])throw Error('unknown scenario '+scenario);every.push({label,arm:a,scenario,opp,seed,rev,var:var_,key});}
  else every.push({label,arm,seed,rev,var:var_,key});
 }
 const key=j=>`${j.scenario?`sc/${j.scenario}/${j.arm}/${j.opp}`:j.arm}:${j.seed}:${j.rev}:${j.var??'base'}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${tasks.length} matches of ${every.length} on ${workers} workers; revs ${Object.entries(revs).map(([n,r])=>`${n}=${r}`).join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry'))process.exit(0);
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundles,sides}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}
   else{failed++;console.error('FAILED',key(m.task),m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
