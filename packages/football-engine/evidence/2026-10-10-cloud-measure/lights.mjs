// Read a "live v candidate" run: the mirror arms and the warning lights.
//   node lights.mjs <rows.jsonl> [more.jsonl ...] [--base base] [--cand cand]
// Give it the scenario file AND the mirror file of ONE run (cloud rows never
// pool with laptop rows; the script refuses mixed platforms). The scenario
// setups themselves are read by ../2026-10-09-scenarios/analyze.mjs.
//
// 1. Mirror arms (rows with kind 'mirror'): treated side minus the other side,
//    per revision (expected 0 in a mirror without a treatment), and the
//    candidate's change, cand - base, with a 95% CI (the two revisions' seeds
//    diverge, so the CI treats them as independent samples).
// 2. Warning lights over every row (scenarios and mirror together), per
//    revision, and cand - base paired on the identical task (same scenario or
//    arm, opponent and seed): goals, shots, good chances, turnovers and pass
//    completion per match, and where goals came from (the move's origin: won
//    in play, or a restart kind).
// Words: clear = the 95% CI excludes 0; likely = |mean| >= 1.28 se; else too few to tell.
import {readFileSync} from 'node:fs';
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
const files=argv.filter(a=>a.endsWith('.jsonl'));
if(!files.length){console.error('usage: node lights.mjs rows.jsonl [more.jsonl] [--base base] [--cand cand]');process.exit(2);}
const B=arg('base','base'),C=arg('cand','cand');
const rows=files.flatMap(f=>readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)));
const plats=new Set(rows.map(r=>r.plat));
if(plats.size>1){console.error(`rows from ${plats.size} platforms (${[...plats].join(', ')}): never pool them`);process.exit(1);}
const builds={};for(const r of rows)(builds[r.rev]??=new Set()).add(r.build);
console.log(`${rows.length} rows on ${[...plats][0]}; builds ${Object.entries(builds).map(([k,v])=>`${k}=${[...v].join('/')}`).join(', ')}`);
for(const r of rows)if(r.tableBuild&&r.tableBuild!==r.build){console.log(`WARNING rev ${r.rev}: chances table from ${r.tableBuild}, matches on ${r.build}: regenerate the table before reading chance numbers`);break;}

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const sd=a=>{if(a.length<2)return NaN;const u=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-u)**2,0)/(a.length-1));};
const se=a=>sd(a)/Math.sqrt(a.length);
const word=(m,s)=>m===0&&s===0?'identical':!Number.isFinite(s)?'too few to tell':Math.abs(m)>=1.96*s?'clear':Math.abs(m)>=1.28*s?'likely':'too few to tell';
const f=(v,d=2)=>Number.isFinite(v)?(v>=0?'+':'')+v.toFixed(d):'—';
const pm=(m,s,d=2)=>`${f(m,d)} ±${Number.isFinite(s)?(1.96*s).toFixed(d):'—'}`;
const ours=r=>r.ours??0;
const ch=r=>r.chances??r.chancesAny;

// ---------------------------------------------------------------- 1. mirror
const mir=rows.filter(r=>r.kind==='mirror');
if(mir.length){
 console.log('\n## Mirror arms: treated minus the other side (GD, good-chance diff), per revision, and cand − base\n');
 console.log('| arm | rev | n | GD ±95% | words | chance diff ±95% | words | goals T–C | W/D/L |');
 console.log('|---|---|---|---|---|---|---|---|---|');
 const arms=[...new Set(mir.map(r=>r.arm))];
 for(const a of arms){
  const at={};
  for(const rev of [B,C]){
   const rs=mir.filter(r=>r.arm===a&&r.rev===rev);if(!rs.length)continue;
   const gd=rs.map(r=>r.score[ours(r)]-r.score[1-ours(r)]),cd=rs.map(r=>ch(r)?ch(r)[ours(r)]-ch(r)[1-ours(r)]:NaN);
   at[rev]={gd,cd};
   const w=gd.filter(x=>x>0).length,d=gd.filter(x=>x===0).length,l=gd.length-w-d;
   console.log(`| ${a} | ${rev} | ${rs.length} | ${pm(mean(gd),se(gd))} | ${word(mean(gd),se(gd))} | ${pm(mean(cd),se(cd))} | ${word(mean(cd),se(cd))} | ${mean(rs.map(r=>r.score[ours(r)])).toFixed(2)}–${mean(rs.map(r=>r.score[1-ours(r)])).toFixed(2)} | ${w}/${d}/${l} |`);
  }
  if(at[B]&&at[C]){
   const dg=mean(at[C].gd)-mean(at[B].gd),sg=Math.hypot(se(at[C].gd),se(at[B].gd));
   const dc=mean(at[C].cd)-mean(at[B].cd),sc=Math.hypot(se(at[C].cd),se(at[B].cd));
   console.log(`| ${a} | **cand − base** | | ${pm(dg,sg)} | ${word(dg,sg)} | ${pm(dc,sc)} | ${word(dc,sc)} | | |`);
  }
 }
}

// ---------------------------------------------------------------- 2. lights
const key=r=>`${r.kind??'scenario'}:${r.scenario??''}:${r.opp??''}:${r.arm}:${r.seed}`;
const byRev={};for(const r of rows)(byRev[r.rev]??=new Map()).set(key(r),r);
const LIGHTS={
 'goals / match':r=>r.score[0]+r.score[1],
 'shots / match':r=>r.stats[0].shots+r.stats[1].shots,
 'good chances / match':r=>ch(r)?ch(r)[0]+ch(r)[1]:NaN,
 'turnovers / match':r=>r.stats[0].turnovers+r.stats[1].turnovers,
 'pass completion %':r=>100*(r.stats[0].completed+r.stats[1].completed)/Math.max(1,r.stats[0].passes+r.stats[1].passes),
 'goals from play (won) / match':r=>r.shots.filter(s=>s[8]&&s[3]==='won').length,
 'goals from restarts / match':r=>r.shots.filter(s=>s[8]&&s[3]!=='won').length,
 'headed goals / match':r=>r.shots.filter(s=>s[8]&&s[2]===1).length,
 'shot quality (chance per shot)':r=>{const n=r.stats[0].shots+r.stats[1].shots;return ch(r)&&n?(ch(r)[0]+ch(r)[1])/n:NaN;},
};
const shared=byRev[B]&&byRev[C]?[...byRev[B].keys()].filter(k=>byRev[C].has(k)):[];
console.log(`\n## Warning lights (all rows; cand − base paired on ${shared.length} identical tasks)\n`);
console.log(`| light | ${B} | ${C} | cand − base ±95% | words |`);
console.log('|---|---|---|---|---|');
for(const [name,fn] of Object.entries(LIGHTS)){
 const v=rev=>[...(byRev[rev]?.values()??[])].map(fn).filter(Number.isFinite);
 const d=shared.map(k=>fn(byRev[C].get(k))-fn(byRev[B].get(k))).filter(Number.isFinite);
 console.log(`| ${name} | ${mean(v(B)).toFixed(2)} | ${byRev[C]?mean(v(C)).toFixed(2):'—'} | ${d.length?pm(mean(d),se(d)):'—'} | ${d.length?word(mean(d),se(d)):''} |`);
}
// where goals came from: shares of all goals, per revision
console.log(`\n| goal source (share of goals) | ${B} | ${C} |`);console.log('|---|---|---|');
const src=rev=>{const c={};let n=0;for(const r of byRev[rev]?.values()??[])for(const s of r.shots)if(s[8]){c[s[3]]=(c[s[3]]??0)+1;n++;}return {c,n};};
const sb=src(B),sc=src(C);
for(const k of [...new Set([...Object.keys(sb.c),...Object.keys(sc.c)])].sort((a,b)=>(sb.c[b]??0)-(sb.c[a]??0)))
 console.log(`| ${k} | ${(100*(sb.c[k]??0)/Math.max(1,sb.n)).toFixed(1)}% | ${(100*(sc.c[k]??0)/Math.max(1,sc.n)).toFixed(1)}% |`);
console.log(`| (goals) | ${sb.n} | ${sc.n} |`);
const msB=[...(byRev[B]?.values()??[])].map(r=>r.ms),msC=[...(byRev[C]?.values()??[])].map(r=>r.ms);
if(msB.length&&msC.length)console.log(`\ncompute: mean ms per match base ${mean(msB).toFixed(0)}, cand ${mean(msC).toFixed(0)} (ratio ${(mean(msC)/mean(msB)).toFixed(2)})`);
