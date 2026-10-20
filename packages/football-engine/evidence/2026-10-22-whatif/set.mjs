// What-if harness: the task list. The 512 parity tasks of ../2026-10-21-engine-as-data/set.mjs unchanged (blocks A B C D E
// T F, same ids, same order), plus block R, the style round robin at a size that can answer a style question:
//   R  64 ordered set-ups (4 presets x 1-2-1 / 2-2 on each side, mirrors included) x seeds 0-63 (4,096 tasks defined),
//      the neutral five on both sides exactly as block B (parity.ts `neutral`), 900 s, kickoff seed % 2, seed 1000 + n.
// B is the same design at 4 seeds with one formation per match; R crosses the formations as the release round robins did
// (../2026-10-19-keeper-fix/rr.mjs: 8 x 8 set-ups). whatif.mjs picks R's seeds with --seeds N (an --only filter).
import {tasks as parity512} from '../2026-10-21-engine-as-data/set.mjs';

export const STYLES=['balanced','combinations','direct','counter'];
export const FORMATIONS=['1-2-1','2-2'];
export const R_SEEDS=64;
export const SETUPS=STYLES.flatMap(s=>FORMATIONS.map(f=>`${s}.${f}`));

export function rTasks(){
 const out=[];
 for(let seed=0;seed<R_SEEDS;seed++)for(const h of SETUPS)for(const a of SETUPS){
  const [hs,hf]=h.split('.'),[as,af]=a.split('.');
  out.push({id:`R:${h}-${a}:${seed}`,block:'R',kind:'match',seed:1000+seed,kickoff:seed%2,sides:[{src:'neutral',code:'H',style:hs,formation:hf},{src:'neutral',code:'A',style:as,formation:af}]});
 }
 return out;
}
export function tasks(){return [...parity512(),...rTasks()];}

if(process.argv[1]?.endsWith('2026-10-22-whatif/set.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 console.log(`${t.length} tasks (${new Set(t.map(x=>x.id)).size} distinct ids):`,JSON.stringify(by));
}
