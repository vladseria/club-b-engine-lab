// Manager scenarios: each setup v the stored prep, per scenario, engine
// revision and opponent, on paired seeds; then whether a setup's edge changes
// with the opponent (the control), and, with two revisions, what the candidate
// changed.
//   node analyze.mjs results/<label>.jsonl [more.jsonl] [--base prep] [--md] [--detail] [--scenario id]
//
// Per match, from our side (the scenario's `ours`): GD = goals for - against;
// CD = good chances for - against (lib/ballers/chances.ts with the revision's
// own table; a revision whose table was measured on another build is flagged
// and its CD uses that table anyway: regenerate the table before trusting it).
// Points 3/1/0. Paired difference d = arm - stored prep on the same seed.
// 95% CI = mean ± 1.96·sd/√n. Words, as in the Chior Dior FINDINGS:
//   clear            the 95% CI excludes 0
//   likely           |mean| ≥ 1.28·se (one-sided ~90%)
//   too few to tell  otherwise
// Rows from different platforms never pool: give this script the files of ONE run.
import {readFileSync} from 'node:fs';
import {SCENARIOS} from './scenarios.mjs';

const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
const files=argv.filter(a=>a.endsWith('.jsonl'));
if(!files.length){console.error('usage: node analyze.mjs results/<label>.jsonl [--base prep] [--md] [--detail]');process.exit(2);}
const BASE=arg('base','prep'),md=argv.includes('--md'),detail=argv.includes('--detail'),only=arg('scenario',null);
const rows=files.flatMap(f=>readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)));

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const sd=a=>{if(a.length<2)return NaN;const u=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-u)**2,0)/(a.length-1));};
const ci=a=>1.96*sd(a)/Math.sqrt(a.length),se=a=>sd(a)/Math.sqrt(a.length);
const word=(m,c,s)=>!Number.isFinite(c)?'too few to tell':Math.abs(m)>=c?'clear':Math.abs(m)>=1.28*s?'likely':'too few to tell';
const wordOf=a=>word(mean(a),ci(a),se(a));
const f=(v,d=2)=>Number.isFinite(v)?(v>=0?'+':'')+v.toFixed(d):'—',pm=(m,c,d=2)=>`${f(m,d)} ±${Number.isFinite(c)?c.toFixed(d):'—'}`,pc=v=>Math.round(v*100)+'%';

const ours=r=>r.ours??0;
const gd=r=>r.score[ours(r)]-r.score[1-ours(r)];
const cdOf=r=>{const c=r.chances??r.chancesAny;return c?c[ours(r)]-c[1-ours(r)]:NaN;};
const pts=r=>gd(r)>0?3:gd(r)===0?1:0,win=r=>gd(r)>0?1:0;

// index: scenario -> rev -> opp -> arm -> seed -> row
const idx={};
for(const r of rows){((((idx[r.scenario]??={})[r.rev]??={})[r.opp]??={})[r.arm]??={})[r.seed]=r;}
const warn=new Set();
for(const r of rows){if(r.tableBuild&&r.build&&r.tableBuild!==r.build)warn.add(`rev ${r.rev}: chances table measured on ${r.tableBuild}, matches played on ${r.build}; regenerate lib/ballers/chances-table.ts for this build before reading chance numbers`);}
const builds={};for(const r of rows)(builds[r.rev]??=new Set()).add(r.build);
for(const [rev,b] of Object.entries(builds))if(b.size>1)warn.add(`rev ${rev} holds rows from ${b.size} engine builds (${[...b].join(', ')}): mixed files?`);

/** Paired comparison of arm v base on the seeds both played. */
function paired(A,B){
 const seeds=Object.keys(A).filter(s=>B[s]),n=seeds.length;if(!n)return null;
 const a=seeds.map(s=>A[s]),b=seeds.map(s=>B[s]);
 const d=fn=>a.map((r,i)=>fn(r)-fn(b[i]));
 const dG=d(gd),dC=d(cdOf),dW=d(win),dP=d(pts);
 const res=a.map(r=>gd(r)>0?'W':gd(r)<0?'L':'D'),cnt=k=>res.filter(x=>x===k).length/n;
 const c=r=>r.chances??r.chancesAny;
 return {n,seeds,W:cnt('W'),D:cnt('D'),L:cnt('L'),gf:mean(a.map(r=>r.score[ours(r)])),ga:mean(a.map(r=>r.score[1-ours(r)])),
  cf:mean(a.map(r=>c(r)?.[ours(r)]??NaN)),ca:mean(a.map(r=>c(r)?.[1-ours(r)]??NaN)),
  dG:mean(dG),dGci:ci(dG),dGw:wordOf(dG),dC:mean(dC),dCci:ci(dC),dCw:wordOf(dC),dW:mean(dW),dWci:ci(dW),dP:mean(dP),dPci:ci(dP),dPw:wordOf(dP),raw:{dG,dC,dP}};
}
const verdict=p=>{
 const c=p.dCw,g=p.dPw==='clear'||p.dGw==='clear'?'clear':p.dPw==='likely'||p.dGw==='likely'?'likely':null;
 const dir=v=>v>0?'better':'worse';
 if(c==='too few to tell'&&!g)return 'too few to tell';
 if(g==='clear'&&c==='clear'&&Math.sign(p.dC)===Math.sign(p.dG))return `clear, ${dir(p.dG)}`;
 if(g==='clear')return `clear on results (${dir(p.dP)}), chances ${c}`;
 if(c==='clear')return `clear on chances only (${dir(p.dC)})`;
 return `likely ${dir(c==='likely'?p.dC:p.dP)}`;
};
const print=s=>console.log(s);

for(const [sid,byRev] of Object.entries(idx)){
 if(only&&sid!==only)continue;
 const sc=SCENARIOS[sid],label=a=>sc?.arms[a]?.label??a;
 print(`\n${'='.repeat(100)}\nScenario ${sc?.n??'?'}: ${sc?.title??sid}  (${sid})\n${sc?.fixture??''}\nStresses: ${sc?.stresses??''}`);
 const revs=Object.keys(byRev);
 const edges={};// rev -> opp -> arm -> paired
 for(const rev of revs){
  for(const [opp,byArm] of Object.entries(byRev[rev])){
   const B=byArm[BASE];
   print(`\n-- rev ${rev} (build ${[...builds[rev]].join(',')}) · opponent ${opp==='stored'?'as stored':`${opp}: ${sc?.control?.why??''}`}`);
   if(!B){print(`   no '${BASE}' rows: nothing to pair with`);continue;}
   const list=Object.keys(byArm).sort((a,b)=>a===BASE?-1:b===BASE?1:0).map(a=>({a,p:paired(byArm[a],B)})).filter(x=>x.p);
   (edges[rev]??={})[opp]=Object.fromEntries(list.map(x=>[x.a,x.p]));
   if(md){
    print(`| Setup | n | W / D / L | goals for–against | chances for–against | Δ chances v ${BASE} | Δ GD v ${BASE} | Δ win share | Δ points/match | word |`);
    print('|---|---|---|---|---|---|---|---|---|---|');
    for(const {a,p} of list)print(`| ${label(a)} | ${p.n} | ${pc(p.W)} / ${pc(p.D)} / ${pc(p.L)} | ${p.gf.toFixed(2)}–${p.ga.toFixed(2)} | ${p.cf.toFixed(2)}–${p.ca.toFixed(2)} | ${a===BASE?'—':pm(p.dC,p.dCci)} | ${a===BASE?'—':pm(p.dG,p.dGci)} | ${a===BASE?'—':`${f(p.dW*100,0)} pp ±${(p.dWci*100).toFixed(0)}`} | ${a===BASE?'—':pm(p.dP,p.dPci)} | ${a===BASE?'—':verdict(p)} |`);
   }else{
    print(`   ${'setup'.padEnd(14)} n    W/D/L        gf-ga      cf-ca      Δchances(±95)   ΔGD(±95)        Δwin(±95)     Δpts(±95)       word`);
    for(const {a,p} of list)print(`   ${a.padEnd(14)} ${String(p.n).padEnd(4)} ${(pc(p.W)+'/'+pc(p.D)+'/'+pc(p.L)).padEnd(12)} ${(p.gf.toFixed(2)+'-'+p.ga.toFixed(2)).padEnd(10)} ${(p.cf.toFixed(2)+'-'+p.ca.toFixed(2)).padEnd(10)} ${(a===BASE?'—':pm(p.dC,p.dCci)).padEnd(15)} ${(a===BASE?'—':pm(p.dG,p.dGci)).padEnd(15)} ${(a===BASE?'—':`${f(p.dW*100,0)}pp ±${(p.dWci*100).toFixed(0)}`).padEnd(13)} ${(a===BASE?'—':pm(p.dP,p.dPci)).padEnd(15)} ${a===BASE?'':verdict(p)}`);
   }
   if(detail)details(byArm,list.map(x=>x.a));
  }
  // does the edge depend on the opponent? (stored v control; independent seed sets)
  const E=edges[rev]??{},ctl=Object.keys(E).find(o=>o!=='stored');
  if(E.stored&&ctl){
   print(`\n   Matchup check (rev ${rev}): each setup's edge v ${BASE}, opponent as stored v ${ctl}. Different seeds, so CI = √(ci₁²+ci₂²).`);
   for(const a of Object.keys(E.stored)){
    if(a===BASE||!E[ctl][a])continue;
    const x=E.stored[a],y=E[ctl][a];
    const dc=x.dC-y.dC,dcc=Math.hypot(x.dCci,y.dCci),dp=x.dP-y.dP,dpc=Math.hypot(x.dPci,y.dPci);
    const w=(m,c)=>Math.abs(m)>=c?'clear':Math.abs(m)>=c/1.96*1.28?'likely':'too few to tell';
    print(`   ${a.padEnd(14)} chances edge ${pm(x.dC,x.dCci)} v ${pm(y.dC,y.dCci)}: differs by ${pm(dc,dcc)} (${w(dc,dcc)}); points edge ${pm(x.dP,x.dPci)} v ${pm(y.dP,y.dPci)}: differs by ${pm(dp,dpc)} (${w(dp,dpc)})`);
   }
   const best=o=>Object.entries(E[o]).sort((p,q)=>q[1].dP-p[1].dP||q[1].dC-p[1].dC)[0][0];
   const bestC=o=>Object.entries(E[o]).sort((p,q)=>q[1].dC-p[1].dC)[0][0];
   print(`   Best by points: ${best('stored')} as stored, ${best(ctl)} v ${ctl}. Best by chances: ${bestC('stored')} as stored, ${bestC(ctl)} v ${ctl}. (A ranking, not a test: read the CIs above.)`);
  }
 }
 // what the candidate changed (paired by seed across revisions)
 if(revs.length>1){
  const [b0,...cands]=revs;
  for(const c of cands){
   print(`\n   Revision change, ${c} − ${b0}, same seeds:`);
   for(const opp of Object.keys(byRev[b0]??{})){
    const A=byRev[c]?.[opp],B=byRev[b0][opp];if(!A)continue;
    for(const a of Object.keys(B)){
     if(!A[a])continue;
     const p=paired(A[a],B[a]);if(!p)continue;
     let edge='';
     if(a!==BASE&&A[BASE]&&B[BASE]){
      const s=p.seeds.filter(x=>A[BASE][x]&&B[BASE][x]);
      const d=fn=>s.map(x=>(fn(A[a][x])-fn(A[BASE][x]))-(fn(B[a][x])-fn(B[BASE][x])));
      const dc=d(cdOf),dp=d(pts);
      edge=`; its edge v ${BASE} moved ${pm(mean(dc),ci(dc))} chances (${wordOf(dc)}), ${pm(mean(dp),ci(dp))} points (${wordOf(dp)})`;
     }
     print(`   ${opp.padEnd(12)} ${a.padEnd(14)} n ${p.n}: chances diff ${pm(p.dC,p.dCci)} (${p.dCw}), GD ${pm(p.dG,p.dGci)}, points ${pm(p.dP,p.dPci)}${edge}`);
    }
   }
  }
 }
}
if(warn.size){print('\nWARNINGS');for(const w of warn)print('  '+w);}

/** Per-shooter chances/goals (our side) and how each substitution order fired. */
function details(byArm,arms){
 for(const a of arms){
  const rs=Object.values(byArm[a]),n=rs.length,by={};
  for(const r of rs)for(const s of r.shots)if(s[0]===ours(r)){const k=s[7]??'?',h=s[6]<450?'1st':'2nd';const o=by[k]??={c:0,g:0,n:0,c1:0,c2:0};o.c+=s[1];o.g+=s[8];o.n++;o[h==='1st'?'c1':'c2']+=s[1];}
  print(`      ${a}: shooters (per match: chances, goals, shots; chances 1st/2nd half) `+Object.entries(by).sort((x,y)=>y[1].c-x[1].c).map(([k,o])=>`${k} ${(o.c/n).toFixed(2)}c ${(o.g/n).toFixed(2)}g ${(o.n/n).toFixed(1)}sh (${(o.c1/n).toFixed(2)}/${(o.c2/n).toFixed(2)})`).join(' · '));
  const subs={};
  for(const r of rs)for(const x of r.subs??[]){if(x[0]!==ours(r))continue;const o=subs[x[3]]??={made:0,t:0,off:{}};if(x[1]==='made'){o.made++;o.t+=x[2];if(x[5])o.off[x[5]]=(o.off[x[5]]??0)+1;}}
  if(Object.keys(subs).length)print(`      ${a}: subs `+Object.entries(subs).map(([id,o])=>`${id} made ${pc(o.made/n)} at ${o.made?(o.t/o.made/60).toFixed(1)+' min':'—'}${Object.keys(o.off).length?' off: '+Object.entries(o.off).map(([k,v])=>`${k} ${v}`).join(', '):''}`).join(' · '));
 }
}
