// Beat-direct probes (2026-10-14): tables from probe.ts rows.  node tables.mjs <rows.jsonl[.gz]...> > results/tables.md
// Cells are arms <opt>-<opp> (arms.ts). Test side T = seed % 2 (Direct 1-2-1 + option), O = the opponent.
// Each option cell is paired by seed with ref-<opp> (same inputs, option off). Per-match values; se over matches.
// Words: clear = the 95% interval excludes 0; likely = |mean| >= 1.28 se; else too few to tell.
// Rates per 100 receptions are pooled (sum over matches / sum of receptions); their difference's se is the delta-method
// ratio se over matches.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const files=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const rows=files.flatMap(f=>{const b=readFileSync(f);return (f.endsWith('.gz')?gunzipSync(b):b).toString().trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));});
const cells=new Map();for(const r of rows){const m=cells.get(r.arm)??new Map();m.set(r.seed,r);cells.set(r.arm,m);}
const sum=a=>a.reduce((x,y)=>x+y,0),mean=a=>a.length?sum(a)/a.length:NaN,sd=a=>{const u=mean(a);return Math.sqrt(sum(a.map(y=>(y-u)**2))/Math.max(1,a.length-1));},se=a=>sd(a)/Math.sqrt(a.length);
const word=(m,s)=>!Number.isFinite(s)||s===0?'—':Math.abs(m)>=1.96*s?'clear':Math.abs(m)>=1.28*s?'likely':'too few to tell';
const f=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'—',sg=(v,d=2)=>Number.isFinite(v)?(v>=0?'+':'−')+Math.abs(v).toFixed(d):'—';
const T=r=>r.seed%2,O=r=>1-r.seed%2;
const OPT={ref:'plain Direct 1-2-1',p1:'P1 Hold them in front',c5:'C5 Tight man-marking',p3:'P3 Leave a man up'};
const OPP={di:'Direct 1-2-1',sh:'Short 1-2-1',dp:'Direct 1-2-1, Pivot striker',dc2:'Direct 1-2-1, Bodies forward 2'};
const out=[];const P=s=>out.push(s);
const pb=(r,s)=>r.st[s].pb,r1=(r,s)=>r.st[s].r1,ag=(r,s)=>r.agg[s];
// design-check style long-ball bands (deep.ts x.lr, aim beyond their deepest defender at the pass; final third only)
const lrRows=(r,s)=>(ag(r,s).x.lr??[]).filter(z=>z.length>6&&z[3]>=32);
// per-match metric list: [label, fn(row) -> number]
const n3=k=>(r)=>pb(r,O(r)).rb[k][0];
const M=[
 ['GD (test side)',r=>r.score[T(r)]-r.score[O(r)]],
 ['test side goals',r=>r.score[T(r)]],
 ['opponent goals',r=>r.score[O(r)]],
 ['opponent receptions behind the last defender',n3(0)],
 ['opponent receptions 0–4 m in front',n3(1)],
 ['opponent receptions 4 m+ in front',n3(2)],
 ['opponent receptions with a defender under 1 m',r=>pb(r,O(r)).u1[0]],
 ['… long balls received behind',r=>pb(r,O(r)).rbL[0][0]],
 ['… long balls received 0–4 m in front',r=>pb(r,O(r)).rbL[1][0]],
 ['… long balls received 4 m+ in front',r=>pb(r,O(r)).rbL[2][0]],
 ['test side last defender from goal while opponent attacks its half (m)',r=>{const l=pb(r,O(r)).line;return l[0]?l[1]/l[0]:NaN;}],
 ['opponent most advanced man from goal (m)',r=>{const l=pb(r,O(r)).line;return l[0]?l[2]/l[0]:NaN;}],
 ['opponent long balls (open play, lofted or 15 m+, gaining 5 m+)',r=>ag(r,O(r)).x.long[0]],
 ['opponent long balls into the final third (20 m+)',r=>r1(r,O(r)).longFinal],
 ['opponent final-third long balls aimed behind the last defender',r=>lrRows(r,O(r)).filter(z=>z[19]<0).length],
 ['opponent entries to the final third by long pass (loft or ground 15 m+)',r=>ag(r,O(r)).ent.loft[0]+ag(r,O(r)).ent.ground15[0]],
 ['opponent shots',r=>ag(r,O(r)).shots],
 ['opponent clear chances',r=>ag(r,O(r)).clear],
 ['test side shots',r=>ag(r,T(r)).shots],
 ['test side clear chances',r=>ag(r,T(r)).clear],
 ['P1 seconds (test side markers, summed)',r=>pb(r,T(r)).job[0]],
 ['P1 share of marking time',r=>pb(r,T(r)).job[2]?pb(r,T(r)).job[0]/pb(r,T(r)).job[2]:0],
 ['P3 man-up seconds',r=>pb(r,T(r)).job[1]],
 ['test side regains with a man up',r=>pb(r,T(r)).up[0]],
 ['… the man up received within 8 s',r=>pb(r,T(r)).up[1]],
 ['… clear chances within 12 s',r=>pb(r,T(r)).up[3]],
 ['… goals within 12 s',r=>pb(r,T(r)).up[4]],
 ['test side regains without a man up',r=>pb(r,T(r)).noUp[0]],
 ['… clear chances within 12 s',r=>pb(r,T(r)).noUp[3]],
 ['all regains: clear chances within 12 s (deep counter)',r=>ag(r,T(r)).counter[3]],
 ['goals conceded with a man up in the 10 s before',r=>pb(r,T(r)).conc[1]],
];
const G=[// guardrails, per team per match: [label, fn(row, side)]
 ['long balls into the final third',(r,s)=>r1(r,s).longFinal],
 ['… received cleanly',(r,s)=>r1(r,s).longClean],
 ['lofted passes',(r,s)=>r1(r,s).lofted],
 ['shots',(r,s)=>ag(r,s).shots],
 ['goals',(r,s)=>r.score[s]],
 ['turnovers',(r,s)=>r.stats[s].turnovers],
 ['tackles',(r,s)=>r.stats[s].tackles],
 ['tackles won',(r,s)=>r.stats[s].tacklesWon],
];
// pooled rates per band: [label, fn(row)-> [n, shots, clear, goals]]
const BANDS=[['behind the last defender',(r)=>pb(r,O(r)).rb[0]],['0–4 m in front',(r)=>pb(r,O(r)).rb[1]],['4 m+ in front',(r)=>pb(r,O(r)).rb[2]],['defender under 1 m',(r)=>pb(r,O(r)).u1],
 ['long: behind',(r)=>pb(r,O(r)).rbL[0]],['long: 0–4 m in front',(r)=>pb(r,O(r)).rbL[1]],['long: 4 m+ in front',(r)=>pb(r,O(r)).rbL[2]],['long: defender under 1 m',(r)=>pb(r,O(r)).u1L],
 ['design-check bands (final-third long balls, aim): behind',(r)=>{const z=lrRows(r,O(r)).filter(z=>z[19]<0);return [z.length,sum(z.map(x=>x[15])),sum(z.map(x=>x[16])),sum(z.map(x=>x[17]))];}],
 ['… aim 0–4 m in front',(r)=>{const z=lrRows(r,O(r)).filter(z=>z[19]>=0&&z[19]<4);return [z.length,sum(z.map(x=>x[15])),sum(z.map(x=>x[16])),sum(z.map(x=>x[17]))];}],
 ['… nearest defender under 1 m at arrival',(r)=>{const z=lrRows(r,O(r)).filter(z=>z[7]<1);return [z.length,sum(z.map(x=>x[15])),sum(z.map(x=>x[16])),sum(z.map(x=>x[17]))];}],
];
const rate=(xs,j)=>{const n=sum(xs.map(x=>x[0]));return n?100*sum(xs.map(x=>x[j]))/n:NaN;};
// ratio se (delta method) of a pooled rate over matches
const rateSe=(xs,j)=>{const n=xs.map(x=>x[0]),y=xs.map(x=>x[j]),N=sum(n),R=sum(y)/N,m=xs.length;if(!N)return NaN;return 100*Math.sqrt(sum(xs.map((x,i)=>(y[i]-R*n[i])**2))/(m*(m-1)))/(N/m);};
P('# Beat-direct probes: tables (generated by tables.mjs)\n');
P(`Rows: ${rows.length}; engine ${[...new Set(rows.map(r=>r.build))].join(',')}; platform ${[...new Set(rows.map(r=>r.plat))].join(',')}. Shots matched to the official rows in ${rows.filter(r=>r.shotsMatched).length}/${rows.length}.\n`);
const order=['ref','p1','c5','p3'],opps=['di','sh','dp','dc2'];
P('## Cells\n');P('| cell | matches | GD (test side) | se | word | W / D / L |');P('|---|---|---|---|---|---|');
for(const opp of opps)for(const opt of order){const c=cells.get(`${opt}-${opp}`);if(!c)continue;const rs=[...c.values()],gd=rs.map(M[0][1]);
 P(`| ${OPT[opt]} v ${OPP[opp]} | ${rs.length} | ${sg(mean(gd))} | ${f(se(gd))} | ${opt==='ref'&&opp==='di'?'(mirror)':word(mean(gd),se(gd))} | ${gd.filter(x=>x>0).length} / ${gd.filter(x=>x===0).length} / ${gd.filter(x=>x<0).length} |`);}
P('');
P('## Option against plain, paired by seed (same opponent)\n');
P('Each row: option cell minus ref cell on the same seeds. GD change = what the option buys against that opponent.\n');
P('| option | opponent | pairs | GD option | GD plain | GD change | se | word |');P('|---|---|---|---|---|---|---|---|');
for(const opp of opps){const ref=cells.get(`ref-${opp}`);for(const opt of order.slice(1)){const c=cells.get(`${opt}-${opp}`);if(!c)continue;
 if(!ref){const gd=[...c.values()].map(M[0][1]);P(`| ${OPT[opt]} | ${OPP[opp]} | ${gd.length} | ${sg(mean(gd))} | ${opp==='di'?'0 (mirror)':'—'} | ${sg(mean(gd))} | ${f(se(gd))} | ${word(mean(gd),se(gd))} |`);continue;}
 const seeds=[...c.keys()].filter(s=>ref.has(s)),a=seeds.map(s=>M[0][1](c.get(s))),b=seeds.map(s=>M[0][1](ref.get(s))),d=a.map((x,i)=>x-b[i]);
 P(`| ${OPT[opt]} | ${OPP[opp]} | ${seeds.length} | ${sg(mean(a))} | ${sg(mean(b))} | ${sg(mean(d))} | ${f(se(d))} | ${word(mean(d),se(d))} |`);}}
P('');
for(const opp of opps){
 const ref=cells.get(`ref-${opp}`);
 for(const opt of order.slice(1)){
  const c=cells.get(`${opt}-${opp}`);if(!c)continue;
  const seeds=ref?[...c.keys()].filter(s=>ref.has(s)):[...c.keys()];
  P(`## ${OPT[opt]} v ${OPP[opp]} (${seeds.length} matches${ref?', paired with plain':''})\n`);
  P('| per match | option | plain | change | se | word |');P('|---|---|---|---|---|---|');
  for(const [lab,fn] of M){
   const a=seeds.map(s=>fn(c.get(s))).filter(Number.isFinite);
   if(!ref){P(`| ${lab} | ${f(mean(a))} | — | — | — | — |`);continue;}
   const pr=seeds.map(s=>[fn(c.get(s)),fn(ref.get(s))]).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)),d=pr.map(([x,y])=>x-y);
   P(`| ${lab} | ${f(mean(pr.map(p=>p[0])))} | ${f(mean(pr.map(p=>p[1])))} | ${sg(mean(d))} | ${f(se(d))} | ${word(mean(d),se(d))} |`);
  }
  P('');
  P('Opponent receptions by band (per 100 receptions in that band: shots, clear chances, goals within 8 s; pooled)\n');
  P('| band | n option | n plain | clear /100 option | plain | change ± se | goals /100 option | plain | change ± se |');P('|---|---|---|---|---|---|---|---|---|');
  for(const [lab,fn] of BANDS){
   const a=seeds.map(s=>fn(c.get(s))),b=ref?seeds.map(s=>fn(ref.get(s))):null;
   const cA=rate(a,2),gA=rate(a,3),cB=b?rate(b,2):NaN,gB=b?rate(b,3):NaN;
   const dc=b?Math.hypot(rateSe(a,2),rateSe(b,2)):NaN,dg=b?Math.hypot(rateSe(a,3),rateSe(b,3)):NaN;
   P(`| ${lab} | ${sum(a.map(x=>x[0]))} | ${b?sum(b.map(x=>x[0])):'—'} | ${f(cA,1)} | ${f(cB,1)} | ${sg(cA-cB,1)} ± ${f(dc,1)} | ${f(gA,1)} | ${f(gB,1)} | ${sg(gA-gB,1)} ± ${f(dg,1)} |`);
  }
  P('');
  P('Guardrails (per team per match; test side / opponent; change paired by seed)\n');
  P('| per team | test option | test plain | change ± se | opp option | opp plain | change ± se |');P('|---|---|---|---|---|---|---|');
  for(const [lab,fn] of G){
   const cell=(side)=>{const a=seeds.map(s=>{const r=c.get(s);return fn(r,side(r));});if(!ref)return [mean(a),NaN,NaN,NaN];const b=seeds.map(s=>{const r=ref.get(s);return fn(r,side(r));}),d=a.map((x,i)=>x-b[i]);return [mean(a),mean(b),mean(d),se(d)];};
   const t=cell(T),o=cell(O);
   P(`| ${lab} | ${f(t[0])} | ${f(t[1])} | ${sg(t[2])} ± ${f(t[3])} | ${f(o[0])} | ${f(o[1])} | ${sg(o[2])} ± ${f(o[3])} |`);
  }
  P('');
 }
}
console.log(out.join('\n'));
