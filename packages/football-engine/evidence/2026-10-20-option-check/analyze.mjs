// Option check (2026-10-20): the tables and the pre-registered verdict (README.md "Analysis" and "Kill result").
//   node analyze.mjs results/<label>.jsonl [> results/tables.md]      (a step-0 .json file works too: its rows)
import {readFileSync} from 'node:fs';
const file=process.argv[2];if(!file)throw Error('usage: node analyze.mjs <rows.jsonl|step0.json>');
const txt=readFileSync(file,'utf8');
const rows=file.endsWith('.json')?JSON.parse(txt).rows:txt.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(r=>r.kind==='frame');
const tasks=file.endsWith('.json')?[]:txt.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(r=>r.kind==='task');
// a match whose checks failed (a cross-run fingerprint, a rewind, a forced choice not reproduced) is voided
const voided=new Set(tasks.filter(t=>t.checks.crossRunMismatch||t.checks.rewindMismatch||t.checks.forcedMissing||t.checks.repeatMismatch).map(t=>t.arm+':'+t.seed));
if(voided.size){console.error(`voided matches: ${[...voided].join(', ')}`);rows.splice(0,rows.length,...rows.filter(r=>!voided.has(r.arm+':'+r.seed)));}
const NONDIRECT=['pass','back','carry','takeon','shot'];
// outcome tuple: [chOurs, chTheirs, gOurs, gTheirs, shOurs, shTheirs, possEnd, chOursInPossession, first, unread]
const METRICS={chance:q=>q[0]-q[1],goals:q=>q[2]-q[3],chanceFor:q=>q[0],chancePoss:q=>q[7]};
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length,sd=v=>{const m=mean(v);return Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/Math.max(1,v.length-1));};
const f3=x=>Number.isFinite(x)?(x>=0?'+':'')+x.toFixed(3):'n/a',pc=x=>Number.isFinite(x)?(100*x).toFixed(0)+'%':'n/a';
let s=2026;const rnd=()=>{s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};
const boot=(items,stat,B=2000)=>{const out=[];for(let b=0;b<B;b++){const r=items.map(()=>items[Math.floor(rnd()*items.length)]);const v=stat(r);if(Number.isFinite(v))out.push(v);}out.sort((a,b)=>a-b);return [out[Math.floor(.025*out.length)],out[Math.floor(.975*out.length)]];};
const ci=(est,[lo,hi])=>`${f3(est)} [${f3(lo)}, ${f3(hi)}]`,cip=(est,[lo,hi])=>`${pc(est)} [${pc(lo)}, ${pc(hi)}]`;

/** Per frame, for one metric: values, engine top, in-sample best with paired CI, cross-fitted best. */
function frameStats(r,val){
 const forced=r.arms.filter(a=>a.name!=='engine'),eng=r.arms.find(a=>a.name==='engine');
 const N=forced[0].r.length,V=a=>a.r.map(val);
 const m=forced.map(a=>mean(V(a))),top=0;// arms are sorted by engine score, the top first
 const bi=m.indexOf(Math.max(...m));
 const d=V(forced[top]).map((x,i)=>x-V(forced[bi])[i]),half=1.96*sd(d)/Math.sqrt(N);
 const agree=bi===top||mean(d)+half>=0;// a tie within the paired 95% CI counts as agreement
 // cross-fitted best: choose on even seeds, value on odd, and the reverse (no winner's curse)
 const hm=(a,par)=>mean(V(a).filter((_,i)=>i%2===par));
 const pick=par=>{const mm=forced.map(a=>hm(a,par));return mm.indexOf(Math.max(...mm));};
 const be=pick(0),bo=pick(1),best=(hm(forced[be],1)+hm(forced[bo],0))/2;
 return {r,forced,N,m,top,bi,agree,half,regretIn:m[top]-m[bi],best,bestCls:[forced[be].name,forced[bo].name],
  vTop:m[top],vEng:eng?mean(V(eng)):NaN,vBest:best,vBestIn:m[bi],regret:m[top]-best,scores:forced.map(a=>a.score),names:forced.map(a=>a.name),
  vals:forced.map(a=>V(a))};
}
const out=[];const P=(...x)=>out.push(x.join(''));
P('# Option check: tables\n');
const builds=[...new Set(rows.map(r=>r.build))],plats=[...new Set(rows.map(r=>r.plat))];
P(`Frames ${rows.length} from ${new Set(rows.map(r=>r.arm+':'+r.seed)).size} matches; N ${[...new Set(rows.map(r=>r.arms[0].r.length))].join('/')} rollouts per arm; builds ${builds.join(', ')}; platforms ${plats.join(', ')}.`);
if(tasks.length){const c=tasks.reduce((a,t)=>{for(const [k,v] of Object.entries(t.checks))a[k]=(a[k]??0)+v;return a;},{});P(`Checks over ${tasks.length} tasks: ${JSON.stringify(c)}`);}
const strata={};for(const r of rows){const k=`${r.direct?'Direct':'other'} side, third ${r.depth<16?1:r.depth<32?2:3}`;strata[k]=(strata[k]??0)+1;}
P(`Strata: ${Object.entries(strata).sort().map(([k,v])=>`${k} ${v}`).join('; ')}.`);
const armCount={};for(const r of rows)for(const a of r.arms)armCount[a.name]=(armCount[a.name]??0)+1;
P(`Arms present (frames): ${Object.entries(armCount).map(([k,v])=>`${k} ${v}`).join(', ')}. Engine top by class: ${Object.entries(rows.reduce((a,r)=>(a[r.arms[0].name]=(a[r.arms[0].name]??0)+1,a),{})).map(([k,v])=>`${k} ${v}`).join(', ')}.\n`);

const verdicts={};
for(const [mk,val] of Object.entries(METRICS)){
 const F=rows.map(r=>frameStats(r,val));
 P(`## Metric: ${mk} ${mk==='chance'?'(chance read ours - theirs over the horizon; primary)':mk==='goals'?'(goals ours - theirs; check)':mk==='chanceFor'?'(chance read, ours only)':'(chance read, ours, until our possession ends)'}\n`);
 const agree=mean(F.map(f=>f.agree?1:0)),agreeB=boot(F,x=>mean(x.map(f=>f.agree?1:0)));
 const strict=mean(F.map(f=>f.bi===f.top?1:0));
 const regret=mean(F.map(f=>f.regret)),regretB=boot(F,x=>mean(x.map(f=>f.regret)));
 const frac=x=>x.reduce((a,f)=>a+f.vTop,0)/x.reduce((a,f)=>a+f.vBest,0),fracE=x=>x.reduce((a,f)=>a+f.vEng,0)/x.reduce((a,f)=>a+f.vBest,0);
 const fracIn=x=>x.reduce((a,f)=>a+f.vTop,0)/x.reduce((a,f)=>a+f.vBestIn,0);
 const fr=frac(F),frB=boot(F,frac),fe=fracE(F),feB=boot(F,fracE),fi=fracIn(F),fiB=boot(F,fracIn);
 P(`- Agreement (engine top = rollout best, or tied within the paired 95% CI): ${cip(agree,agreeB)}; strict (same option): ${pc(strict)}; mean paired CI half-width ${mean(F.map(f=>f.half)).toFixed(3)}`);
 P(`- Mean regret (engine top - cross-fitted rollout best): ${ci(regret,regretB)}; in-sample ${f3(mean(F.map(f=>f.regretIn)))}`);
 P(`- Value per frame: engine top ${f3(mean(F.map(f=>f.vTop)))}, engine's own draw ${f3(mean(F.map(f=>f.vEng)))}, cross-fitted best ${f3(mean(F.map(f=>f.vBest)))}`);
 P(`- Achievable-value fraction, engine top: ${cip(fi,fiB)} against the in-sample best (biased up: a lower bound on the fraction), ${cip(fr,frB)} against the cross-fitted best (biased down: an upper bound); engine's own draw against the cross-fitted best ${cip(fe,feB)}`);
 // score vs value: within-frame pairs (score difference vs value difference), pooled
 const pairs=[];for(const f of F)for(let i=0;i<f.forced.length;i++)for(let j=i+1;j<f.forced.length;j++)pairs.push([f.scores[i]-f.scores[j],f.m[i]-f.m[j]]);
 if(pairs.length>2){const mx=mean(pairs.map(p=>p[0])),my=mean(pairs.map(p=>p[1]));const cov=mean(pairs.map(p=>(p[0]-mx)*(p[1]-my))),vx=mean(pairs.map(p=>(p[0]-mx)**2)),vy=mean(pairs.map(p=>(p[1]-my)**2));
  const conc=mean(pairs.map(p=>Math.sign(p[0])===Math.sign(p[1])?1:p[1]===0?.5:0));
  P(`- Score vs value inside a frame (${pairs.length} option pairs): correlation ${(cov/Math.sqrt(vx*vy)).toFixed(2)}, slope ${f3(cov/vx)} value per score point, higher score = higher value in ${pc(conc)} of pairs`);}
 // by class: frames where the class is an arm but not the engine top: value of the class minus the top
 P(`\n| class | frames as an arm | engine top | rollout best (in-sample) | not top: value − top value | not top: score gap | share of total shortfall (cross-fitted best's class) |`);
 P('|---|---|---|---|---|---|---|');
 const shortTot=F.reduce((a,f)=>a+Math.max(0,f.vBest-f.vTop),0);
 const cls={};
 for(const c of ['behind',...NONDIRECT]){
  const has=F.filter(f=>f.names.includes(c));if(!has.length)continue;
  const nt=has.filter(f=>f.names[f.top]!==c),dv=nt.map(f=>f.m[f.names.indexOf(c)]-f.vTop),gap=nt.map(f=>f.scores[f.top]-f.scores[f.names.indexOf(c)]);
  const dB=nt.length>1?boot(nt,x=>mean(x.map(f=>f.m[f.names.indexOf(c)]-f.vTop))):[NaN,NaN];
  const sh=F.reduce((a,f)=>a+Math.max(0,f.vBest-f.vTop)*((f.bestCls[0]===c?.5:0)+(f.bestCls[1]===c?.5:0)),0)/shortTot;
  cls[c]={n:nt.length,dv:nt.length?mean(dv):NaN,lo:dB[0],hi:dB[1],share:sh};
  P(`| ${c} | ${has.length} | ${has.filter(f=>f.names[f.top]===c).length} | ${has.filter(f=>f.names[f.bi]===c).length} | ${nt.length?ci(mean(dv),dB):'—'} (n ${nt.length}) | ${nt.length?gap.length?mean(gap).toFixed(3):'—':'—'} | ${pc(sh)} |`);
 }
 // splits
 P(`\nSplits (agreement; achievable fraction of the engine top; mean regret):`);
 const split=(name,fn)=>{const g={};for(const f of F){const k=fn(f);(g[k]??=[]).push(f);}
  for(const [k,x] of Object.entries(g).sort())P(`- ${name} ${k} (n ${x.length}): ${pc(mean(x.map(f=>f.agree?1:0)))}; ${pc(frac(x))}; ${f3(mean(x.map(f=>f.regret)))}`);};
 split('carrier',f=>f.r.direct?'Direct side':'other side');split('third',f=>f.r.depth<16?1:f.r.depth<32?2:3);split('engine top',f=>f.names[f.top]);
 // by side (a mis-ranking could sit on one side only): both fraction bounds and the per-class (value - top value)
 P(`\nBy side (carrier's team): fraction bounds, agreement, per class (not top: value − top value, n):`);
 for(const [k,x] of [['Direct side',F.filter(f=>f.r.direct)],['other side',F.filter(f=>!f.r.direct)]]){
  if(!x.length)continue;
  const per=['behind',...NONDIRECT].map(c=>{const nt=x.filter(f=>f.names.includes(c)&&f.names[f.top]!==c);if(nt.length<2)return null;
   const st=y=>mean(y.map(f=>f.m[f.names.indexOf(c)]-f.vTop));return `${c} ${ci(st(nt),boot(nt,st))} (n ${nt.length})`;}).filter(Boolean);
  P(`- ${k} (n ${x.length}): fraction ${cip(fracIn(x),boot(x,fracIn))} to ${cip(frac(x),boot(x,frac))}; agreement ${pc(mean(x.map(f=>f.agree?1:0)))}; ${per.join('; ')}`);
 }
 // verdict (pre-registered, README "Kill result")
 const under=Object.entries(cls).filter(([c,x])=>NONDIRECT.includes(c)&&x.n>1&&x.lo>0).map(([c])=>c);
 const anyUnder=Object.entries(cls).filter(([,x])=>x.n>1&&x.lo>0).map(([c])=>c);
 const ndShare=NONDIRECT.reduce((a,c)=>a+(cls[c]?.share??0),0);
 // both bounds of the fraction must land on the same side of a threshold, else the fraction part is inconclusive
 let v='inconclusive';
 if(Math.min(fi,fr)>=.85||(agree>=.70&&!anyUnder.length))v='NOT the lever';
 else if(Math.max(fi,fr)<=.70&&under.length&&ndShare>=.5)v='IS the lever';
 verdicts[mk]={v,fi,fr,agree,under,anyUnder,ndShare};
 P(`\nVerdict on this metric: **${v}** (fraction ${pc(fi)} to ${pc(fr)}, agreement ${pc(agree)}, classes under-ranked beyond CI: ${anyUnder.join(', ')||'none'}, non-direct share of shortfall ${pc(ndShare)})\n`);
}
P(`## Pre-registered verdict (chance read): **${verdicts.chance.v}**; goals check: ${verdicts.goals.v}`);
console.log(out.join('\n'));
