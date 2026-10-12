// Parity (2026-10-12): deep.ts rows against plain computeMatch rows (../2026-10-10-cloud-measure/mirror.ts play())
// for the same arm and seed on the same platform. Every official field must be identical.
//   node parity.mjs <deep rows .jsonl[.gz]> <official rows .jsonl[.gz]> [--rev cand]   (official rows filtered to --rev if given)
// Also: node parity.mjs --self <rows A> <rows B>  -> deep rows from two runners, identical apart from ms/label.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const argv=process.argv.slice(2),arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
const read=f=>{const b=readFileSync(f);return (f.endsWith('.gz')?gunzipSync(b):b).toString('utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));};
const files=argv.filter((a,i)=>!a.startsWith('--')&&argv[i-1]!=='--rev');
const self=argv.includes('--self');
const A=read(files[0]),B=read(files[1]).filter(r=>!arg('rev')||r.rev===arg('rev'));
const key=r=>`${r.arm}:${r.seed}`,byB=new Map(B.map(r=>[key(r),r]));
const FIELDS=['build','tableBuild','score','chances','chancesAny','stats','shots','late','plat'];
let same=0,diff=0,missing=0;
for(const a of A){
 const b=byB.get(key(a));if(!b){missing++;continue;}
 const strip=r=>{const {ms,label,rev,...rest}=r;return rest;};
 const bad=self?(JSON.stringify(strip(a))===JSON.stringify(strip(b))?[]:['row']):FIELDS.filter(f=>JSON.stringify(a[f])!==JSON.stringify(b[f]));
 if(bad.length){diff++;console.log(`DIFF ${key(a)}: ${bad.join(', ')}`);}else same++;
}
console.log(`${self?'deep v deep':'deep v official'}: ${same} identical, ${diff} different, ${missing} without a partner (of ${A.length})`);
if(diff)process.exitCode=1;
