// Do two runs' rows reproduce each other? Compares every (scenario, opp, arm,
// seed) present in both, field by field, ignoring timing and labels.
//   node same.mjs results/a.jsonl results/b.jsonl [--rev-a base] [--rev-b base]
// Use it to prove a cached baseline still reproduces (the `det` plan beside it),
// or that the generalised harness reproduces the Chior Dior study's rows.
import {readFileSync} from 'node:fs';
const argv=process.argv.slice(2),files=argv.filter(a=>a.endsWith('.jsonl'));
const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
if(files.length!==2){console.error('usage: node same.mjs a.jsonl b.jsonl [--rev-a x] [--rev-b y]');process.exit(2);}
// --map old=new,...: renames arm/opponent values of the FIRST file (the study's rows: --map prepDirect=prep,neo=stored,neoBal=neoBal)
const map=Object.fromEntries((arg('map','')||'').split(',').filter(Boolean).map(p=>p.split('=')));
const m=v=>map[v]??v;
const load=(f,rev,ren)=>new Map(readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(r=>!rev||r.rev===rev).map(r=>[`${r.scenario??'chior-neo'}:${ren(r.opp)}:${ren(r.arm)}:${r.seed}`,r]));
const A=load(files[0],arg('rev-a',null),m),B=load(files[1],arg('rev-b',null),v=>v);
const pick=r=>JSON.stringify({score:r.score,chances:r.chances,stats:r.stats,shots:r.shots.map(s=>s.slice(0,9)),subs:r.subs??[],build:r.build});
let same=0,diff=0;
for(const [k,a] of A){const b=B.get(k);if(!b)continue;if(pick(a)===pick(b))same++;else{diff++;console.log('DIFFERS',k,'score',a.score,b.score,'chances',a.chances,b.chances,'plat',a.plat??'?',b.plat??'?');}}
console.log(`${same} identical, ${diff} different (of ${A.size} / ${B.size} rows)`);
if(diff||!same)process.exitCode=1;
