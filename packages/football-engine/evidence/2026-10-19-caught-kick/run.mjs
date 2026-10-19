// Caught kick (2026-10-19): the runner. ../2026-10-19-world-prices/run.mjs with the entry ck.ts bundled through
// hook.mjs's read-only transform, ONE bundle per engine revision (--revs a=<rev>,b=<rev>; every task is played on every
// revision in the same job, so both engines' rows share a platform), the frozen sides of ../2026-10-09-scenarios/sides
// (md5-checked against CHECKSUMS.json) handed to every worker, and a parity mode. Shardable, resumable, <= 4 workers.
//   node run.mjs --label ck --revs live=working,r1=0207e34b @R:0-3          (rows -> results/<label>.jsonl)
//   node run.mjs --label par --revs live=working,r1=0207e34b --parity r.MEN-INT,r.MAL-FDD:0-1
//                                                    (hooked row vs computeMatch on the unhooked bundle, per revision)
// Laptop: MATCHES=<n> must declare the matches actually played (parity plays two per task); more than 4 is refused.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {hook} from './hook.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const hooked={},plain={};
 for(const [rev,b] of Object.entries(workerData.hooked)){hooked[rev]=await import(pathToFileURL(b).href);hooked[rev].init(workerData.sides);}
 for(const [rev,b] of Object.entries(workerData.plain??{})){plain[rev]=await import(pathToFileURL(b).href);plain[rev].init(workerData.sides);}
 parentPort.on('message',task=>{try{
  if(task.parity){
   const a=hooked[task.rev].play(task),b=plain[task.rev].plain(task);
   parentPort.postMessage({ok:true,line:{label:task.label,arm:task.arm,seed:task.seed,rev:task.rev,parity:true,same:JSON.stringify(a.print)===JSON.stringify(b.print),score:a.score,plainScore:b.score,print:a.print,plainPrint:b.print,plat:a.plat,build:a.build,sets:a.ck.sets.length}});
  }else parentPort.postMessage({ok:true,line:hooked[task.rev].play(task)});
 }catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const parity=argv.includes('--parity');
 const flagVals=new Set(['label','revs','workers'].map(k=>arg(k)).filter(Boolean));
 const REAL=['FDD','INT','MAL','MCB','MEN','TRS'];
 const expand=a=>a==='@R'?REAL.flatMap(h=>REAL.filter(x=>x!==h).map(x=>`r.${h}-${x}`)):[a];
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:[...new Set(arms.split(',').flatMap(expand))],seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 const sideDir=path.join(here,'../2026-10-09-scenarios/sides');
 const sums=JSON.parse(readFileSync(path.join(sideDir,'CHECKSUMS.json'),'utf8')).files;
 const sides={};
 for(const f of Object.keys(sums)){const txt=readFileSync(path.join(sideDir,f),'utf8'),md5=createHash('md5').update(txt).digest('hex');
  if(md5!==sums[f].md5)throw Error(`${f}: md5 ${md5} is not the server's ${sums[f].md5}`);
  const s=JSON.parse(txt);if('manager' in s||'manager' in (s.club??{}))throw Error(f+': has a manager field');sides[f.split('.')[0]]=s;}
 const revs=parseRevs(arg('revs','live=working'));
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const hooked=await bundleRevs({entry:path.join(here,'ck.ts'),revs,outDir,extraPlugins:[hook],tag:'ck'});
 const plain=parity?await bundleRevs({entry:path.join(here,'ck.ts'),revs,outDir,tag:'plain'}):null;
 for(const b of Object.values(hooked)){const chk=await import(pathToFileURL(b).href);chk.init(sides);for(const bl of blocks)for(const a of bl.arms)chk.inputOf(a,0);}

 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)for(const rev of Object.keys(revs))every.push({label,arm,seed,rev,parity});
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
 const played=tasks.length*(parity?2:1);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.rev]=(by[t.rev]??0)+1;console.log(by);process.exit(0);}
 if(local){const declared=Number(process.env.MATCHES);if(!(declared>=played))throw Error(`MATCHES=${process.env.MATCHES} but ${played} matches would be played`);if(played>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${tasks.length} tasks (${played} matches) of ${every.length} on ${workers} workers; revs ${Object.entries(revs).map(([n,r])=>`${n}=${r}`).join(', ')}${parity?' PARITY':''} (${done.size} already in ${path.basename(out)})`);
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{hooked,plain,sides}});
  const next=()=>{const t=tasks.shift();if(!t){w.terminate();resolve();return;}w.postMessage(t);};
  w.on('message',m=>{
   if(m.ok){appendFileSync(out,JSON.stringify(m.line)+'\n');finished++;if(m.line.parity)console.log(`${m.line.rev} ${m.line.arm}:${m.line.seed} parity ${m.line.same?'SAME':'DIFFERENT'} ${m.line.score} vs ${m.line.plainScore} (build ${m.line.build}, ${m.line.sets} sets)`);}
   else{failed++;console.error('FAILED',m.task.rev,m.task.arm,m.task.seed,m.error);}
   if((finished+failed)%10===0)console.log(`${finished+failed} done, ${((Date.now()-t0)/1000).toFixed(0)} s`);
   next();
  });
  w.on('error',e=>{console.error(e);failed++;resolve();});
  next();
 })));
 console.log(`${label}: ${finished} written, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(0)} s -> ${path.relative(process.cwd(),out)}`);
 if(failed)process.exitCode=1;
}
