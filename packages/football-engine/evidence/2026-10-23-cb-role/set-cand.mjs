// CB role, candidate runs (2026-10-23): the neutral-five blocks (PAGE.md, pre-set readings). The real-squad blocks
// (G = set.mjs R, the round 7 round robin; C = set.mjs C, Bodies forward 3 v 4) come from set.mjs with the same ids
// and seeds as the diagnostics run, whose base rows they pair with.
//   R4 the style round robin (../2026-10-22-whatif/set.mjs block R): 4 presets x 1-2-1 / 2-2 on each side, 64 ordered
//      set-ups, the neutral five (parity.ts), 900 s, seed 1000 + n, kickoff n % 2       --r4-seeds N (default 40)
//   I  In behind v Mixed: a Balanced neutral five (1-2-1) with Striker set to In behind or Mixed against each preset
//      (1-2-1), home and away, seed 3000 + n, kickoff n % 2                               --i-seeds M (default 30)
const STYLES=['balanced','combinations','direct','counter'],FORMS=['1-2-1','2-2'];
function arg(name,d,argv=process.argv){const i=argv.indexOf(`--${name}`);return i>=0?argv[i+1]:d;}
export function tasks(argv=process.argv){
 const r4=Number(arg('r4-seeds','40',argv)),is=Number(arg('i-seeds','30',argv)),r4from=Number(arg('r4-from','0',argv)),ifrom=Number(arg('i-from','0',argv));
 const out=[];
 for(let seed=r4from;seed<r4from+r4;seed++)for(const hs of STYLES)for(const hf of FORMS)for(const as of STYLES)for(const af of FORMS){
  const h=`${hs}/${hf}`,a=`${as}/${af}`;
  out.push({id:`R4:${h}-${a}:${seed}`,block:'R4',kind:'match',seed:1000+seed,kickoff:seed%2,sides:[{src:'neutral',code:'H',style:hs,formation:hf},{src:'neutral',code:'A',style:as,formation:af}]});
 }
 for(let seed=ifrom;seed<ifrom+is;seed++)for(const st of ['run','mixed'])for(const opp of STYLES)for(const home of [true,false]){
  const t={src:'neutral',code:home?'H':'A',style:'balanced',formation:'1-2-1',approach:{striker:st}},o={src:'neutral',code:home?'A':'H',style:opp,formation:'1-2-1'};
  out.push({id:`I:${st}~${opp}:${home?'home':'away'}:${seed}`,block:'I',kind:'match',seed:3000+seed,kickoff:seed%2,sides:home?[t,o]:[o,t]});
 }
 return out;
}
if(process.argv[1]?.endsWith('2026-10-23-cb-role/set-cand.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 console.log(`${t.length} tasks (${new Set(t.map(x=>x.id)).size} distinct ids):`,JSON.stringify(by));
}
