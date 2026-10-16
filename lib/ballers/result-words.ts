// One set of result words for a move, everywhere (BRIEF 9; TECH-SPEC §6.4):
// the plan report, rehearsal, Watch's move lanes and scouting. Counts, never
// percentages. Pure.
//
//   Tried            a named start of the move
//   To plan / Half / Broke down   how far it played out as drawn (lib/ballers/idea-run.ts `run`)
//   Led to a shot / Goal          a shot or goal by that side within 10 s of the start, before it lost the ball
//   Lost it within 5 s            the ball changed sides within 5 s of the start
import type {IdeaRun} from './idea-run';
import type {ReplayEvent,ReplayFrame} from './replay';

export type RunWord='to_plan'|'half'|'broke';
export const RUN_WORD:Record<RunWord,string>={to_plan:'To plan',half:'Half',broke:'Broke down'};
export const runWord=(run:IdeaRun|null|undefined):RunWord|null=>run==='ran'?'to_plan':run==='partly'?'half':run==='broke'?'broke':null;
export const FOLLOW_WORD={tried:'Tried',shot:'Led to a shot',goal:'Goal',lost:'Lost it within 5 s'} as const;
/** The follow-up windows, one constant each, shared with Watch (TECH-SPEC §6.4). */
export const FOLLOW_UP_MS=10000,LOST_IT_MS=5000;

export interface FollowUp {shot:boolean;goal:boolean;lost:boolean}
/** What followed a start at `t` (ms) for `side`: a shot or goal before the
 * ball changed sides (within 10 s), and whether it changed sides within 5 s. */
export function followUp(t:number,side:0|1,frames:readonly ReplayFrame[],events:readonly ReplayEvent[]):FollowUp{
 let lostAt=Infinity;
 for(const f of frames){if(f.t<=t)continue;if(f.t>t+FOLLOW_UP_MS)break;if(f.ps!==side){lostAt=f.t;break;}}
 const until=Math.min(t+FOLLOW_UP_MS,lostAt);
 const mine=(k:string)=>events.some(e=>e.k===k&&e.s===side&&e.t>=t&&e.t<=until);
 const goal=mine('goal');
 return {shot:goal||mine('shot'),goal,lost:lostAt-t<=LOST_IT_MS};
}

export interface MoveTally {tried:number;to_plan:number;half:number;broke:number;shot:number;goal:number;lost:number}
export const emptyTally=():MoveTally=>({tried:0,to_plan:0,half:0,broke:0,shot:0,goal:0,lost:0});
/** Tallies one move's starts (`t` in ms, with its run word). */
export function tallyStarts(starts:readonly {t:number;run?:IdeaRun|null}[],side:0|1,frames:readonly ReplayFrame[],events:readonly ReplayEvent[]):MoveTally{
 const out=emptyTally();
 for(const s of starts){
  out.tried++;
  const w=runWord(s.run);if(w)out[w]++;
  const f=followUp(s.t,side,frames,events);
  if(f.shot)out.shot++;if(f.goal)out.goal++;if(f.lost)out.lost++;
 }
 return out;
}
