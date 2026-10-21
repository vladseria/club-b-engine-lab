// Half-time, step 0: the task list. The 512 parity tasks of ../2026-10-21-engine-as-data/set.mjs unchanged (blocks A B C
// D E T F, same ids, same order; every match task there is 900 s, so it now has a half-time; F is 60 s training and
// scenes, untouched), plus block Q, the identity check for a run the rule does not touch:
//   Q  32 quick matches (300 s): T1-T4 and the first 28 D tasks (real Global clubs, plans, substitution orders) with
//      duration 300, same seeds and kickoffs. Ids Q:<the original id>. Expected base = cand on every one.
import {tasks as parity512} from '../2026-10-21-engine-as-data/set.mjs';

export function qTasks(){
 const all=parity512(),pick=[...all.filter(t=>t.block==='T'),...all.filter(t=>t.block==='D').slice(0,28)];
 return pick.map(t=>({...t,id:`Q:${t.id}`,block:'Q',duration:300}));
}
export function tasks(){return [...parity512(),...qTasks()];}
