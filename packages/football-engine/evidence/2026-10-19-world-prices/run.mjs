// World prices (2026-10-19): the runner. The engine-audits runner (branch engine-audits, ../2026-10-19-engine-audits/run.mjs)
// with the entry wp.ts bundled through hook.mjs's read-only transform, the frozen sides of ../2026-10-09-scenarios/sides
// (md5-checked CHECKSUMS.json, as that harness does) handed to every worker, a parity mode and a laptop dump mode.
// Shardable, resumable, <= 4 workers.
//   node run.mjs --label w @R:0-3 @M:0-31 e.base:0-31                  (rows -> results/<label>.jsonl; arms in wp.ts)
//   node run.mjs --label par --parity r.MEN-INT,e.base:0-1             (hooked row vs computeMatch, unhooked bundle)
//   MATCHES=1 node run.mjs --label dump --dump r.MEN-INT:0              (laptop: one match, everything analyse() reads ->
//                                                                       results/local/dump-<arm>-<seed>.json.gz)
// Laptop: the MATCHES hook applies (MATCHES=<n> = matches actually played; parity plays two per task). Cloud via _ci/cloud.mjs.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {existsSync,readFileSync,appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {shardTasks,simWorkers,shardNote} from '../_ci/shard.mjs';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {hook} from './hook.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

if(!isMainThread){
 const hooked=await import(pathToFileURL(workerData.hooked).href);hooked.init(workerData.sides);
 const plain=workerData.plain?await import(pathToFileURL(workerData.plain).href):null;if(plain)plain.init(workerData.sides);
 parentPort.on('message',task=>{try{
  if(task.parity){
   const a=hooked.play(task),b=plain.plain(task);
   parentPort.postMessage({ok:true,line:{label:task.label,arm:task.arm,seed:task.seed,rev:task.rev,parity:true,same:JSON.stringify(a.print)===JSON.stringify(b.print),score:a.score,plainScore:b.score,print:a.print,plainPrint:b.print,plat:a.plat,build:a.build}});
  }else if(task.dump){const d=hooked.dump(task);const f=path.join(here,'results/local',`dump-${task.arm}-${task.seed}.json.gz`);mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,gzipSync(JSON.stringify(d)));parentPort.postMessage({ok:true,line:{label:task.label,arm:task.arm,seed:task.seed,rev:task.rev,dump:f,score:d.score}});}
  else parentPort.postMessage({ok:true,line:hooked.play(task)});
 }catch(e){parentPort.postMessage({ok:false,task,error:String(e?.stack??e)});}});
}else{
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const range=s=>s.split(',').flatMap(p=>{const [a,b]=p.split('-').map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
 const label=arg('label');if(!label)throw Error('--label is required');
 const parity=argv.includes('--parity'),dumping=argv.includes('--dump');
 const flagVals=new Set(['label','revs','workers'].map(k=>arg(k)).filter(Boolean));
 // macros: // @R = every ordered pairing of the six real sides; @M = the average-squad mirrors on Balanced, Short and Counter
 const REAL=['FDD','INT','MAL','MCB','MEN','TRS'];
 const expand=a=>a==='@R'?REAL.flatMap(h=>REAL.filter(x=>x!==h).map(x=>`r.${h}-${x}`)):a==='@M'?['m.bal~bal','m.sho~sho','m.p1~p1']:[a];
 const blocks=argv.filter(a=>a.includes(':')&&!a.startsWith('--')&&!flagVals.has(a)).map(b=>{const [arms,seeds]=b.split(':');return {arms:[...new Set(arms.split(',').flatMap(expand))],seeds:range(seeds)};});
 if(!blocks.length)throw Error('give at least one <arm,arm>:<seeds> block');
 // the frozen sides, checked against the server's md5 before anything plays
 const sideDir=path.join(here,'../2026-10-09-scenarios/sides');
 const sums=JSON.parse(readFileSync(path.join(sideDir,'CHECKSUMS.json'),'utf8')).files;
 const sides={};
 for(const f of Object.keys(sums)){const txt=readFileSync(path.join(sideDir,f),'utf8'),md5=createHash('md5').update(txt).digest('hex');
  if(md5!==sums[f].md5)throw Error(`${f}: md5 ${md5} is not the server's ${sums[f].md5}`);
  const s=JSON.parse(txt);if('manager' in s||'manager' in (s.club??{}))throw Error(f+': has a manager field');sides[f.split('.')[0]]=s;}
 const revs=parseRevs(arg('revs','base=working'));
 if(Object.keys(revs).length!==1)throw Error('one rev per run');
 const rev=Object.keys(revs)[0];
 const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
 const hooked=(await bundleRevs({entry:path.join(here,'wp.ts'),revs,outDir,extraPlugins:[hook],tag:'wp'}))[rev];
 const plain=parity?(await bundleRevs({entry:path.join(here,'wp.ts'),revs,outDir,tag:'plain'}))[rev]:null;
 const chk=await import(pathToFileURL(hooked).href);chk.init(sides);
 for(const b of blocks)for(const a of b.arms)chk.inputOf(a,0);// throws on an unknown arm

 const every=[];
 for(const b of blocks)for(const seed of b.seeds)for(const arm of b.arms)every.push({label,arm,seed,rev,parity,dump:dumping});
 const key=j=>`${j.arm}:${j.seed}:${j.rev}`;
 const out=path.join(outDir,`${label}.jsonl`);
 const done=new Set(existsSync(out)?readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>key(JSON.parse(l))):[]);
 const tasks=shardTasks(every).filter(t=>!done.has(key(t)));
 const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
 const played=tasks.length*(parity?2:1);
 if(dumping&&!local)throw Error('--dump is laptop-only');
 if(local){const declared=Number(process.env.MATCHES);if(!(declared>=played))throw Error(`MATCHES=${process.env.MATCHES} but ${played} matches would be played`);if(played>4)throw Error('more than 4 matches: use the public lab');}
 const workers=local?1:Math.min(4,simWorkers(Number(arg('workers',3))));
 console.log(`${label}${shardNote()}: ${tasks.length} tasks (${played} matches) of ${every.length} on ${workers} workers; rev ${rev}=${revs[rev]}${parity?' PARITY':''} (${done.size} already in ${path.basename(out)})`);
 if(argv.includes('--dry')){const by={};for(const t of tasks)by[t.arm]=(by[t.arm]??0)+1;console.log(by);process.exit(0);}
 let finished=0,failed=0;const t0=Date.now();
 await Promise.all(Array.from({length:Math.min(workers,tasks.length)},()=>new Promise(resolve=>{
  const w=new Worker(fileURLToPath(import.meta.url),{workerData:{hooked,plain,sides}});
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
