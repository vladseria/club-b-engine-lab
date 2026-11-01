// Starting energy (2026-11-02, branch ballers-energy-start, measurement only): the task list. QUESTION.md is the design.
// One side (the "dented" side) starts the match with every player (the five; the neutral five has no bench) at energy E,
// the other at 100. Nothing in the engine changes: starting energy is already an engine INPUT (each squad player's
// `energy`, engineTeam passes it through, practicePlayers starts him there). The knob is that input value.
//
// Blocks (all 900 s, the neutral five on both sides, played on ONE revision, main):
//   R  the control, E = 100: the what-if harness's block R (../2026-10-22-whatif/set.mjs) for seeds 0-4, the very same
//      tasks (ids, seeds 1000 + n, kickoffs n % 2, sides): 64 ordered set-ups x 5 = 320 matches.
//   S  the dented runs: E in LEVELS, the same 64 set-ups and 5 seeds; the dented slot d = (n + i) % 2 for set-up i (0-63,
//      home-major over SETUPS x SETUPS) and seed n, the same slot at every level, so every dented style meets every
//      opponent style on both slots and each S task has its control in R (same set-up, same seed). 5 x 320 = 1,600.
//      Id S:<E>:<home>-<away>:<n>:d<d>; the dented side is {src:'tired', energy:E}, everything else as R.
//   I  the identity check, E = 100 through the same path as S (src 'tired', energy 100), seed 0 only: 64 matches whose
//      fingerprints must equal their R twins' (R:<home>-<away>:0). Id I:<home>-<away>:0:d<d>.
// Total 1,984 matches (hard cap 2,200).
import {rTasks,SETUPS} from '../2026-10-22-whatif/set.mjs';

export const LEVELS=[95,90,85,80,70];
export const SEEDS=5;
const setupIndex=new Map(SETUPS.flatMap((h,hi)=>SETUPS.map((a,ai)=>[`${h}-${a}`,hi*SETUPS.length+ai])));
/** The dented slot of set-up `pair` (home-away) at seed n: the same at every level. */
export const dentedSlot=(pair,n)=>(n+setupIndex.get(pair))%2;

/** Block R's tasks for seeds 0..SEEDS-1, untouched (rTasks lists all 64 seeds without --r-seeds on the command line). */
export function controlTasks(){
 const out=rTasks().filter(t=>t.seed<1000+SEEDS).map(t=>({...t,sides:t.sides.map(s=>({...s}))}));
 if(out.length!==SETUPS.length**2*SEEDS)throw Error(`control: ${out.length} tasks, want ${SETUPS.length**2*SEEDS} (is --r-seeds below ${SEEDS}?)`);
 return out;
}
function dented(t,E,block,id){
 const [,pair,n]=t.id.split(':'),d=dentedSlot(pair,Number(n));
 const sides=t.sides.map((s,i)=>i===d?{...s,src:'tired',energy:E}:{...s});
 return {...t,id:id(pair,n,d),block,sides,dented:d,level:E,control:t.id};
}
export function sTasks(){
 const ctrl=controlTasks();
 return LEVELS.flatMap(E=>ctrl.map(t=>dented(t,E,'S',(pair,n,d)=>`S:${E}:${pair}:${n}:d${d}`)));
}
export function iTasks(){
 return controlTasks().filter(t=>t.seed===1000).map(t=>dented(t,100,'I',(pair,n,d)=>`I:${pair}:${n}:d${d}`));
}
export function tasks(){return [...controlTasks().map(t=>({...t,block:'R'})),...iTasks(),...sTasks()];}

if(process.argv[1]?.endsWith('2026-11-02-start-energy/set.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 const d=[0,1].map(s=>t.filter(x=>x.block==='S'&&x.dented===s).length);
 console.log(`${t.length} tasks (${new Set(t.map(x=>x.id)).size} distinct ids):`,JSON.stringify(by),`S dented home/away ${d.join('/')}`);
}
