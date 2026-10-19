// Engine speed (2026-10-19): the parity and paired-timing runner. Every task (arm, seed) plays the SAME match on every
// engine revision named in --revs, one after the other on the same worker (the order rotated per task, so warm-up and
// position cancel out), and writes one row: per revision ms / cpuMs / score / print (the official compact's
// fingerprint) / full (sha256 over the whole engine result) / build, plus `same` = every revision's print AND full equal
// the first revision's. Shardable, resumable, <= 4 workers.
//   node run.mjs --label sp --workers 4 --revs base=<rev>,cand=working HOME-AWAY-k,...:<seeds> ...
// The frozen sides of ../2026-10-09-scenarios/sides are md5-checked as the other harnesses do.
// Laptop: the MATCHES hook applies (MATCHES = tasks x revisions); never more than 4. Cloud via _ci/cloud.mjs.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const mods={};
 for(const [name,file] of Object.entries(workerData.bundles)){mods[name]=await import(pathToFileURL(file).href);mods[name].init(workerData.sides);}
 const names=Object.keys(mods);
 parentPort.on('message',task=>{try{
  const order=names.map((_,i)=>names[(i+task.rot)%names.length]),by={};
  for(const n of order)by[n]=mods[n].play(task);
  const first=by[names[0]];
  const same=names.every(n=>JSON.stringify(by[n].print)===JSON.stringify(first.print)&&by[n].full===first.full);
  const strip=r=>({ms:r.ms,cpuMs:r.cpuMs,score:r.score,print:r.print,full:r.full,build:r.build});
  parentPort.postMessage({ok:true,line:{label:task.label,arm:task.arm,seed:task.seed,order,same,score:first.score,frames:first.frames,plat:first.plat,revs:Object.fromEntries(names.map(n=>[n,strip(by[n])]))}});
 }catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const flagVals=new Set(['label','revs','workers'].map(k=>arg(k)).filter(Boolean));
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:arms.split(','),seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const sideDir=path.join(here,'../2026-10-09-scenarios/sides');
 const sums=JSON.parse(readFileSync(path.join(sideDir,'CHECKSUMS.json'),'utf8')).files;
 const sides={};
 for(const f of Object.keys(sums)){const txt=readFileSync(path.join(sideDir,f),'utf8'),md5=createHash('md5').update(txt).digest('hex');
  if(md5!==sums[f].md5)throw Error(`${f}: md5 ${md5} is not the server's ${sums[f].md5}`);
  const s=JSON.parse(txt);if('manager' in s||'manager' in (s.club??{}))throw Error(f+': has a manager field');sides[f.split('.')[0]]=s;}
 const revs=parseRevs(arg('revs','base=working'));
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const bundles=await bundleRevs({entry:path.join(here,'speed.ts'),revs,outDir,tag:'speed'});
 const chk=await import(pathToFileURL(Object.values(bundles)[0]).href);chk.init(sides);
 for(const b of blocks)for(const a of b.arms)chk.inputOf(a,0);// throws on an unknown arm

 const every=[];let rot=0;
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)every.push({label,arm,seed,rot:rot++%Object.keys(revs).length});
 const key=j=>`${j.arm}:${j.seed}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
 const played=tasks.length*Object.keys(revs).length;
 if(local){const declared=Number(process.env.MATCHES);if(!(declared>=played))throw Error(`MATCHES=${process.env.MATCHES} but ${played} matches would be played`);if(played>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${tasks.length} tasks (${played} matches) of ${every.length} on ${workers} workers; revs ${JSON.stringify(revs)} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry'))process.exit(0);
 let finished=0,failed=0,different=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{bundles,sides}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;if(!m.line.same){different++;console.log(`${m.line.arm}:${m.line.seed} DIFFERENT`);}}
   else{failed++;console.error('FAILED',m.task.arm,m.task.seed,m.error);}
   if((finished+failed)%5===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written (${different} different), ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
