// Take-on price (2026-10-19): one runner for the three harnesses, each entry bundled once per rev (the arm is the rev
// NAME: `on` = TAKEON_PRICE on, `off` = this tree with it off, `live` = a live commit, no flag; flag.ts):
//   --entry wpx  world prices row + take-on list (wpx.ts; hook.mjs wpHook)           arms as wp.ts (@R, @M, e.base, ...)
//   --entry ax   engine audits row, skill prices E (ax.ts; the audits' own hook)    arms as audit.ts (@e1, @e2, ...)
//   --entry rrx  keeper-fix round robin row (rrx.ts; no hook)                       @RR = the 8x8 style mirrors
//   node run.mjs --entry wpx --label w --revs off=working,on=working @R:0-1
// Rows -> results/<label>.jsonl (appended; finished (arm, seed, rev) skipped). Shardable (_ci/shard.mjs), <= 4 workers.
// Laptop: MATCHES=<n> must cover the matches played, and at most 4 (more = public lab, _ci/cloud.mjs).
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {HOOKS} from './hook.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
if(!isMainThread){
 const mods={};
 for(const [rev,bundle] of Object.entries(workerData.bundles)){mods[rev]=await import(pathToFileURL(bundle).href);mods[rev].init?.(workerData.sides);}
 parentPort.on('message',task=>{try{parentPort.postMessage({ok:true,line:mods[task.rev].play(task)});}catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label'),entry=arg('entry');if(!label||!HOOKS[entry])throw Error('--label and --entry wpx|ax|rrx are required');
 const flagVals=new Set(['label','revs','workers','entry'].map(k=>arg(k)).filter(Boolean));
 const SK=['pace','control','passing','reading','stamina','strength','defending','finishing','aerial','setPieces'],REAL=['FDD','INT','MAL','MCB','MEN','TRS'];
 const C=[];for(const s of ['ba','sh','di','co'])for(const f of ['121','22'])C.push(s+f);
 const expand=a=>a==='@e1'?['e.base',...SK.flatMap(k=>[`e.${k}.1.w`,`e.${k}.2.w`])]:a==='@e2'?SK.flatMap(k=>['d','s','t'].map(w=>`e.${k}.2.${w}`)):
  a==='@R'?REAL.flatMap(h=>REAL.filter(x=>x!==h).map(x=>`r.${h}-${x}`)):a==='@M'?['m.bal~bal','m.sho~sho','m.p1~p1']:a==='@RR'?C.flatMap(x=>C.map(y=>x+'v'+y)):[a];
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:[...new Set(arms.split(',').flatMap(expand))],seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const sideDir=path.join(here,'../2026-10-09-scenarios/sides'),sums=JSON.parse(readFileSync(path.join(sideDir,'CHECKSUMS.json'),'utf8')).files,sides={};
 for(const f of Object.keys(sums)){const txt=readFileSync(path.join(sideDir,f),'utf8'),md5=createHash('md5').update(txt).digest('hex');
  if(md5!==sums[f].md5)throw Error(`${f}: md5 ${md5} is not the server's ${sums[f].md5}`);
  const s=JSON.parse(txt);if('manager' in s||'manager' in (s.club??{}))throw Error(f+': has a manager field');sides[f.split('.')[0]]=s;}
 const revs=parseRevs(arg('revs','off=working,on=working'));
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const bundles=await bundleRevs({entry:path.join(here,`${entry}.ts`),revs,outDir,extraPlugins:HOOKS[entry],tag:entry});
 const chk=await import(pathToFileURL(Object.values(bundles)[0]).href);chk.init?.(sides);
 for(const b of blocks)for(const a of b.arms)chk.inputOf(a,0);// throws on an unknown arm
 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const rev of Object.keys(bundles))every.push({label,arm,seed,rev});
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
 if(local&&!argv.includes('--dry')){const declared=Number(process.env.MATCHES);if(!(declared>=tasks.length))throw Error(`MATCHES=${process.env.MATCHES} but ${tasks.length} matches would be played`);if(tasks.length>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${entry}, ${tasks.length} matches of ${every.length} on ${workers} workers; revs ${Object.entries(revs).map(([n,r])=>`${n}=${r}`).join(', ')} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.rev]=(by[t.rev]??0)+1;console.log(by);process.exit(0);}
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundles,sides}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){
    if(m.line.dropped?.length){failed++;console.error('DROPPED',m.line.arm,m.line.seed,m.line.dropped);}
    else{if(m.line.rev===undefined)m.line.rev=m.task?.rev;appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;}
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
