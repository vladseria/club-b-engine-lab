// Option check, step 0 (2026-10-20): the premise trace on the laptop, 1 worker.
//   full mode, MATCHES=3: three plays of one seed
//     1 plain   untransformed bundle: the compact replay hash H
//     2 pass A  transformed bundle with the observer: hash must be H (transform + observer change nothing); eligible decisions
//     3 pass B  transformed bundle, rollouts at `frames` frames (N seeds, H s, the first rollout played twice), then the match
//               plays on to full time: hash must be H (every rewind was exact), tick-top hashes must match pass A's (same
//               seed -> identical state at the tick), the repeated rollout must be identical
//     node step0.mjs <arm> <seed> <frames> <N> <H>            e.g. MATCHES=3 node step0.mjs di121vba121 1 4 6 10
//   --from mode, MATCHES=1: pass B only, frames re-selected from a saved full-mode file, H from that file (no cross-run
//     hash: the saved one predates a fix to where pass A fingerprints); like the runner it stops after the last frame,
//     so it checks the rewinds, the repeated rollout and the forced choice, not the full-time hash
//     node step0.mjs --from results/step0-<arm>-<seed>.json <frames> <N> <H>
import {fileURLToPath,pathToFileURL} from 'node:url';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {bundleRevs} from '../_ci/revs.mjs';
import {hook} from './hook.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2),from=argv[0]==='--from'?argv[1]:null;
if(Number(process.env.MATCHES)!==(from?1:3))throw Error(`step 0 plays exactly ${from?1:3} match(es) plus the rollouts: MATCHES=${from?1:3}`);
const saved=from?JSON.parse(readFileSync(path.resolve(from),'utf8')):null;
const [arm,seedS,framesS,NS,HS]=from?[saved.arm,String(saved.seed),...argv.slice(2)]:argv;
const seed=Number(seedS),nf=Number(framesS??4),N=Number(NS??6),H=Number(HS??10);
const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
const hookedB=(await bundleRevs({entry:path.join(here,'option.ts'),revs:{eng:'working'},outDir,extraPlugins:[hook],tag:'oc'})).eng;
const O=await import(pathToFileURL(hookedB).href);
const t0=Date.now();let a,b;
if(from){a=saved.plain;b={...saved.passA,decisions:saved.passA.decisions.map(d=>({...d,hash:null}))};console.log('from',from,'plain hash',a.hash);}
else{
 const plainB=(await bundleRevs({entry:path.join(here,'option.ts'),revs:{eng:'working'},outDir,tag:'plain'})).eng;
 const P=await import(pathToFileURL(plainB).href);
 a=P.plain(arm,seed);console.log('1 plain ',JSON.stringify(a));
 b=O.passA(arm,seed);console.log('2 passA ',JSON.stringify({hash:b.hash,score:b.score,ms:b.ms,openPlay:b.openPlay,eligible:b.decisions.length}),b.hash===a.hash?'SAME as plain':'DIFFERENT from plain');
}
const frames=O.select(arm,seed,b.decisions,{perStratum:1,gap:12,edge:15,duration:900}).slice(0,nf);
console.log('frames\n  '+frames.map(f=>`${f.time.toFixed(2)}s ${f.id} d${f.depth.toFixed(1)} top ${f.topCls} [${Object.entries(f.cls).map(([c,x])=>c+' '+x.score.toFixed(3)+' p'+x.p.toFixed(2)).join(', ')}]`).join('\n  '));
const c=O.passB(arm,seed,frames,{N,H,full:!from,repeat:true});// --from: stops after the last frame, as the runner does
console.log('3 passB ',JSON.stringify({hash:c.hash,score:c.score,ms:c.ms,stopped:c.stopped,checks:c.checks}),c.hash===null?'(stopped after the last frame)':c.hash===a.hash?'SAME as plain':'DIFFERENT from plain');
const name=`step0-${arm}-${seed}${from?'-rerun':''}.json`;
writeFileSync(path.join(outDir,name),JSON.stringify({arm,seed,N,H,plain:a,passA:{hash:b.hash,score:b.score,ms:b.ms,openPlay:b.openPlay,eligible:b.decisions.length,decisions:b.decisions},passB:{hash:c.hash,score:c.score,ms:c.ms,checks:c.checks},rows:c.rows}));
// Per frame and arm: value = chance read ours - theirs over H s; its sd across seeds; how many seeds gave distinct
// outcomes; the paired (same seed) sd of the difference from the top option; and whether every 'engine' rollout is
// exactly one of the forced arms' rollouts at the same seed (forcing changes nothing but the choice)
const val=q=>q[0]-q[1],mean=v=>v.reduce((p,q)=>p+q,0)/v.length,sd=v=>{const m=mean(v);return Math.sqrt(v.reduce((p,q)=>p+(q-m)**2,0)/Math.max(1,v.length-1));};
const sds=[],pairedSds=[];let engineRuns=0,engineMatched=0;
for(const r of c.rows){
 console.log(`frame ${r.time}s ${r.id} (${r.direct?'Direct':'other'} side, depth ${r.depth}):`);
 const top=r.arms[0];
 for(const x of r.arms){
  const v=x.r.map(val),d=x===top?null:x.r.map((q,i)=>val(q)-val(top.r[i]));
  sds.push(sd(v));if(d)pairedSds.push(sd(d));
  const distinct=new Set(x.r.map(q=>JSON.stringify(q))).size,firsts=x.r.map(q=>q[8]?q[8][0]+(q[8][2]?'>'+q[8][2]:''):'-').join(' ');
  console.log(`  ${x.name.padEnd(7)} score ${x.score?.toFixed(3)??'  -  '} value ${mean(v).toFixed(3)} sd ${sd(v).toFixed(3)}${d?` paired-diff sd ${sd(d).toFixed(3)}`:''} goals ${x.r.map(q=>q[2]-q[3]).join(',')} distinct ${distinct}/${x.r.length} first: ${firsts}`);
 }
 const eng=r.arms.find(x=>x.name==='engine');
 eng.r.forEach((q,i)=>{engineRuns++;if(r.arms.some(x=>x!==eng&&JSON.stringify(x.r[i])===JSON.stringify(q)))engineMatched++;});
}
const med=v=>{const s=[...v].sort((p,q)=>p-q);return s[Math.floor(s.length/2)];};
console.log(`per-rollout value sd: median ${med(sds).toFixed(3)}, max ${Math.max(...sds).toFixed(3)}; paired-difference sd: median ${med(pairedSds).toFixed(3)}, max ${Math.max(...pairedSds).toFixed(3)}`);
console.log(`engine rollouts identical to a forced arm's rollout at the same seed: ${engineMatched}/${engineRuns}`);
console.log(`total ${((Date.now()-t0)/1000).toFixed(0)} s`);
