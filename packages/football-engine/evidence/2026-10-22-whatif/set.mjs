// What-if harness: the task list (blocks P and Q further down). The 512 parity tasks of ../2026-10-21-engine-as-data/set.mjs unchanged (blocks A B C D E
// T F, same ids, same order), plus block R, the style round robin at a size that can answer a style question:
//   R  64 ordered set-ups (4 presets x 1-2-1 / 2-2 on each side, mirrors included) x seeds 0-63 (4,096 tasks defined),
//      the neutral five on both sides exactly as block B (parity.ts `neutral`), 900 s, kickoff seed % 2, seed 1000 + n.
// B is the same design at 4 seeds with one formation per match; R crosses the formations as the release round robins did
// (../2026-10-19-keeper-fix/rr.mjs: 8 x 8 set-ups). whatif.mjs passes R's seed count as --r-seeds N (read here from the command line).
import {tasks as parity512} from '../2026-10-21-engine-as-data/set.mjs';

export const STYLES=['balanced','combinations','direct','counter'];
export const FORMATIONS=['1-2-1','2-2'];
export const R_SEEDS=64;
export const SETUPS=STYLES.flatMap(s=>FORMATIONS.map(f=>`${s}.${f}`));

/** R's seeds: 0 .. n-1, n from `--r-seeds n` on the command line of the process that lists the tasks (run.mjs on every
 * shard gets the same command, so every shard lists the same tasks); all 64 without it. */
export function rSeeds(argv=process.argv){return seedsArg('r-seeds',R_SEEDS,argv);}
export function rTasks(){
 const out=[],n=rSeeds();
 for(let seed=0;seed<n;seed++)for(const h of SETUPS)for(const a of SETUPS){
  const [hs,hf]=h.split('.'),[as,af]=a.split('.');
  out.push({id:`R:${h}-${a}:${seed}`,block:'R',kind:'match',seed:1000+seed,kickoff:seed%2,sides:[{src:'neutral',code:'H',style:hs,formation:hf},{src:'neutral',code:'A',style:as,formation:af}]});
 }
 return out;
}
/** --<name> n on the command line (1..max), else max. */
function seedsArg(name,max,argv=process.argv){const i=argv.indexOf(`--${name}`);if(i<0)return max;const n=Number(argv[i+1]);if(!(Number.isInteger(n)&&n>=1&&n<=max))throw Error(`--${name} wants 1-${max}, got ${argv[i+1]}`);return n;}

// P (question 2, the press block): Short against each of the other three presets, the opponent's Press set to Selective,
// Balanced or Aggressive (9 cells), formations crossed (Short 1-2-1 / 2-2 x opponent 1-2-1 / 2-2), Short home and away,
// the neutral five, 900 s, seeds 0-63 (--p-seeds n), seed 2000 + n. Id P:<home>_<away>:<seed>, a side written
// <preset>.<formation> (Short) or <preset>.<press>.<formation> (the opponent).
export const P_SEEDS=64,PRESSES=['selective','balanced','aggressive'];
export function pTasks(){
 const out=[],n=seedsArg('p-seeds',P_SEEDS);
 for(let seed=0;seed<n;seed++)for(const opp of ['balanced','direct','counter'])for(const press of PRESSES)for(const sf of FORMATIONS)for(const of of FORMATIONS)for(const home of [true,false]){
  const short={src:'neutral',code:home?'H':'A',style:'combinations',formation:sf},other={src:'neutral',code:home?'A':'H',style:opp,formation:of,approach:{press}};
  const tag=[`combinations.${sf}`,`${opp}.${press}.${of}`],sides=home?[short,other]:[other,short];
  out.push({id:`P:${home?tag[0]:tag[1]}_${home?tag[1]:tag[0]}:${seed}`,block:'P',kind:'match',seed:2000+seed,kickoff:seed%2,sides});
 }
 return out;
}

// Q (question 3, the squad block): the squad-fit study's equal-budget squads (../2026-10-19-engine-audits/squads.ts:
// every player keeps his group's average skill total) h3 "Passers everywhere" and h4 "Big and strong", each on the four
// presets, 1-2-1, against the average squad on Balanced 1-2-1, home and away, 900 s, seeds 0-127 (--q-seeds n), seed
// 3000 + n. Id Q:<squad>.<preset>_<home|away>:<seed>.
export const Q_SEEDS=128,SQUADS=['h3','h4'];
export function qTasks(){
 const out=[],n=seedsArg('q-seeds',Q_SEEDS);
 for(let seed=0;seed<n;seed++)for(const squad of SQUADS)for(const style of STYLES)for(const home of [true,false]){
  const tested={src:'squad',code:home?'H':'A',squad,preset:style},opp={src:'squad',code:home?'A':'H',squad:'avg',preset:'balanced'};
  out.push({id:`Q:${squad}.${style}_${home?'home':'away'}:${seed}`,block:'Q',kind:'match',seed:3000+seed,kickoff:seed%2,sides:home?[tested,opp]:[opp,tested]});
 }
 return out;
}
export function tasks(){return [...parity512(),...rTasks(),...pTasks(),...qTasks()];}

if(process.argv[1]?.endsWith('2026-10-22-whatif/set.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 console.log(`${t.length} tasks (${new Set(t.map(x=>x.id)).size} distinct ids):`,JSON.stringify(by));
}
