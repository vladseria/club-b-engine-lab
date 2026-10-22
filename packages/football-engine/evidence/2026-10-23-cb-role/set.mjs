// CB role (2026-10-23): the task list. DESIGN.md says why each block exists and what it reads.
// Every match: the Global league's round 7 sides as frozen (../2026-10-21-engine-as-data/global-r7: real squads, plans,
// approach, substitution orders, settings; no manager field), 900 s, seed 7000 + n, kickoff n % 2.
//   R  the round robin as frozen: every ordered pair of the 9 clubs (72: each pairing home and away), seeds 0 .. N-1
//   C  Bodies forward 3 v 4, paired: each club (tested) with its commit set to 3 and to 4, everything else as frozen,
//      against each other club as frozen, home and away, seeds 0 .. M-1
//   --r-seeds N (default 10)   --c-seeds M (default 4)
export const CLUBS=['FCD','FDD','INT','MEN','NEO','RAP','RCS','TRS','UMA'];
function arg(name,d,argv=process.argv){const i=argv.indexOf(`--${name}`);return i>=0?argv[i+1]:d;}
export function tasks(argv=process.argv){
 const rs=Number(arg('r-seeds','10',argv)),cs=Number(arg('c-seeds','4',argv));
 if(!(Number.isInteger(rs)&&rs>=0&&Number.isInteger(cs)&&cs>=0))throw Error('--r-seeds / --c-seeds want whole numbers');
 const out=[];
 for(let seed=0;seed<rs;seed++)for(const h of CLUBS)for(const a of CLUBS){if(h===a)continue;
  out.push({id:`CB:R:${h}-${a}:${seed}`,block:'R',kind:'match',seed:7000+seed,kickoff:seed%2,sides:[{src:'g7',code:h},{src:'g7',code:a}]});}
 for(let seed=0;seed<cs;seed++)for(const x of CLUBS)for(const y of CLUBS){if(x===y)continue;
  for(const commit of [3,4])for(const home of [true,false]){
   const t={src:'g7',code:x,approach:{commit}},o={src:'g7',code:y};
   out.push({id:`CB:C:${x}@${commit}~${y}:${home?'home':'away'}:${seed}`,block:'C',kind:'match',seed:7000+seed,kickoff:seed%2,sides:home?[t,o]:[o,t]});
  }}
 return out;
}

if(process.argv[1]?.endsWith('2026-10-23-cb-role/set.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 console.log(`${t.length} tasks (${new Set(t.map(x=>x.id)).size} distinct ids):`,JSON.stringify(by));
}
