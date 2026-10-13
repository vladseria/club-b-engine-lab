// Manager scenario runner (2026-10-09). Plays scenario arms through
// lib/ballers/compute.ts computeMatch, paired on seeds, for one or more engine
// revisions in the SAME run (cloud rows never pool with laptop rows, and rows
// from different platforms never compare: put baseline and candidate in one
// run). Worker threads, at most 6 locally.
//
//   node run.mjs --label <name> [--plan trim|full|smoke] [--scenarios all|chior-neo,mcb-trs,...]
//                [--revs base=<git rev>,cand=<git rev>|working|dir:<repo checkout>]
//                [--arms a,b] [--opp stored|control] [--seeds 740000-740029] [--duration 900] [--workers 6] [--dry]
//   node run.mjs --probe --scenario mcb-trs --arm prep [--opp stored] [--seed 740000] [--revs base=working]
//
// --plan expands scenarios.mjs PLANS per scenario; --arms/--opp/--seeds narrow
// or replace it (all three given = an explicit block for every chosen scenario).
// --revs: name=working (this tree), name=<git rev> (lib/ and
// packages/football-engine/src/ extracted with git archive; the rev's own
// compute, presets and chances table), name=dir:<path> (another checkout's tree).
// Default: base=working.
// Output: results/<label>.jsonl, appended; finished (scenario, opp, arm, seed, rev)
// rows are skipped, so a stopped run resumes.
// Cloud: honours SHARD_INDEX/SHARD_TOTAL/SIM_WORKERS (../_ci/shard.mjs):
//   node packages/football-engine/evidence/_ci/cloud.mjs --runner ubuntu-24.04-arm \
//     --command "node packages/football-engine/evidence/2026-10-09-scenarios/run.mjs --label trim-<cand> --plan trim --revs base=<sha>,cand=<sha>" \
//     --into packages/football-engine/evidence/2026-10-09-scenarios/results/trim-<cand>.jsonl
import {build} from 'esbuild';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,mkdirSync,readFileSync,appendFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {SCENARIOS,PLANS} from './scenarios.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../..');

if(!isMainThread){
 const mods={};
 for(const [rev,bundle] of Object.entries(workerData.bundles)){mods[rev]=await import(pathToFileURL(bundle).href);mods[rev].init(workerData.sides);}
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mods[task.rev].play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});

 // ---- the frozen sides, checked against the server's md5 before anything plays
 const sums=JSON.parse(readFileSync(path.join(here,'sides/CHECKSUMS.json'),'utf8')).files;
 const readSide=f=>{const p=path.join(here,f),txt=readFileSync(p,'utf8'),md5=createHash('md5').update(txt).digest('hex'),want=sums[path.basename(f)]?.md5;
  if(md5!==want)throw Error(`${f}: md5 ${md5} is not the server's ${want}`);return JSON.parse(txt);};
 const sides={};
 for(const [id,sc] of Object.entries(SCENARIOS)){
  if(sc.source.kind==='sides')sides[id]=[readSide(sc.source.home),readSide(sc.source.away)];
  else{const s=JSON.parse(readFileSync(path.join(here,sc.source.file),'utf8'));sides[id]=[s.input_sides.home,s.input_sides.away];}
 }

 // ---- engine revisions: one bundle each
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const revs=Object.fromEntries(arg('revs','base=working').split(',').map(r=>{const [n,...v]=r.split('=');return [n,v.join('=')];}));
 const roots=[path.join(repo,'lib'),path.join(repo,'packages/football-engine/src')];
 function revRoot(rev){
  if(rev==='working')return repo;
  if(rev.startsWith('dir:'))return path.resolve(rev.slice(4));
  const sha=execSync(`git rev-parse --verify ${rev}^{commit}`,{cwd:repo,encoding:'utf8'}).trim();
  const dir=path.join(outDir,`.rev-${sha.slice(0,12)}`);
  if(!existsSync(path.join(dir,'packages/football-engine/src/build-info.ts'))||!existsSync(path.join(dir,'lib/ballers/compute.ts'))){
   rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
   execSync(`git archive ${sha} lib packages/football-engine/src | tar -x -C "${dir}"`,{cwd:repo});
  }
  return dir;
 }
 // Any import that resolves into this tree's lib/ or engine src/ goes to the revision's copy.
 const at=root=>({name:'rev-at',setup(b){
  if(path.resolve(root)===repo)return;
  b.onResolve({filter:/^\./},a=>{
   if(!a.resolveDir||a.resolveDir.startsWith(root+path.sep))return;
   const abs=path.resolve(a.resolveDir,a.path);
   if(!roots.some(r=>abs===r||abs.startsWith(r+path.sep)))return;
   let target=path.join(root,path.relative(repo,abs));
   for(const ext of ['','.ts','.tsx','.js','.json'])if(existsSync(target+ext)&&!target.endsWith(path.sep)){target+=ext;break;}
   if(!existsSync(target))throw Error(`rev ${root}: ${path.relative(repo,abs)} does not exist there`);
   return {path:target};
  });
 }});
 const bundles={};
 for(const [name,rev] of Object.entries(revs)){
  if(!/^[a-z0-9_-]+$/i.test(name))throw Error(`rev name '${name}'`);
  bundles[name]=path.join(outDir,`.bundle.${name}.${createHash('md5').update(rev).digest('hex').slice(0,8)}.mjs`);
  await build({entryPoints:[path.join(here,'match.ts')],bundle:true,format:'esm',platform:'node',target:'node22',outfile:bundles[name],logLevel:'warning',plugins:[at(revRoot(rev))]});
 }

 // ---- arms must be what the live app can store (checked on the base revision's bundle)
 const chk=await import(pathToFileURL(Object.values(bundles)[0]).href);chk.init(sides);
 for(const [id,sc] of Object.entries(SCENARIOS))for(const [a,arm] of Object.entries(sc.arms)){
  chk.checkArm(sides[id][sc.ours],arm,`${id}/${a}`);
  const inp=chk.inputOf({scenario:id,arm:a,opp:'stored',seed:1});void inp;
 }

 if(argv.includes('--probe')){
  const mod=await import(pathToFileURL(bundles[Object.keys(bundles)[0]]).href);mod.init(sides);
  const r=mod.play({label:'probe',scenario:arg('scenario','mcb-trs'),arm:arg('arm','prep'),opp:arg('opp','stored'),seed:Number(arg('seed',1)),rev:Object.keys(bundles)[0],detail:true});
  console.log(JSON.stringify({...r,shots:undefined}));console.log(r.shots.map(s=>JSON.stringify(s)).join('\n'));process.exit(0);
 }

 // ---- the task list: full enumeration in a stable order, then this shard's part, then resume
 const label=arg('label');if(!label)throw Error('--label is required');
 const ids=arg('scenarios','all')==='all'?Object.keys(SCENARIOS):arg('scenarios').split(',');
 for(const id of ids)if(!SCENARIOS[id])throw Error('unknown scenario '+id);
 const plan=arg('plan','trim');if(!PLANS[plan])throw Error('unknown plan '+plan);
 const armsArg=arg('arms',null),oppArg=arg('opp',null),seedsArg=arg('seeds',null),duration=Number(arg('duration',900));
 const every=[];
 for(const id of ids){
  const sc=SCENARIOS[id];
  let blocks=PLANS[plan](sc).map(b=>({...b,seeds:Array.from({length:b.count},(_,i)=>b.from+i)}));
  if(oppArg)blocks=blocks.filter(b=>(oppArg==='control')===(b.opp!=='stored'));
  if(armsArg)blocks=blocks.map(b=>({...b,arms:armsArg.split(',')}));
  if(seedsArg)blocks=blocks.map(b=>({...b,seeds:range(seedsArg)}));
  for(const b of blocks)for(const a of b.arms)if(!sc.arms[a])throw Error(`unknown arm ${id}/${a}`);
  // seed-major: a partial run is a complete paired set for its first seeds
  for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const rev of Object.keys(bundles))
   every.push({label,scenario:id,arm,opp:b.opp,seed,rev,duration});
 }
 const key=j=>`${j.scenario}:${j.opp}:${j.arm}:${j.seed}:${j.rev}:${j.duration??900}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const workers=Math.min(6,simWorkers(Number(arg('workers',6))));
 console.log(`${label}${shardNote()}: ${tasks.length} matches of ${every.length} on ${workers} workers; revs ${Object.entries(revs).map(([n,r])=>`${n}=${r}`).join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks){const k=`${t.scenario} ${t.opp}`;by[k]=(by[k]??0)+1;}console.log(by);process.exit(0);}
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundles,sides}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){
    if(m.line.dropped?.length){failed++;console.error('DROPPED',m.line.scenario,m.line.arm,m.line.seed,m.line.dropped);}
    else{appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}
   }else{failed++;console.error('FAILED',m.task.scenario,m.task.arm,m.task.seed,m.task.rev,m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
