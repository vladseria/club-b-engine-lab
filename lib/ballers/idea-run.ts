// Did an idea's firing actually play out as drawn? Pure, shared by the
// official compute path (stored with the replay), the Lab trial and the
// ideas-impact harness (packages/football-engine/evidence/2026-09-28-ideas-commitment).
//
// The engine counts an idea as "fired" the moment it SELECTS it, and its own
// progress label ('attempted' = any pass or shot noted) and end reason
// ('complete' also covers interrupted/skipped parts) say little about whether
// the players did what the manager drew. This reads the idea's own trace and
// answers one question per firing:
//
//   ran     every part that became due was carried out as drawn
//   partly  some due parts were carried out, some were not
//   broke   no due part was carried out (the idea was abandoned early)
//
// Definitions (exact):
// - A part (lesson job) is DUE when its trace has an 'active' note: its moment
//   arrived and its player took it on. Parts whose moment never came, and
//   parts skipped by a mid-idea entry, are not due and never count against it.
// - The finish ('shoot') is not required when the firing has other due parts:
//   it is the carrier's judgment plus the shot model. It is reported as `shot`.
//   A firing whose ONLY due parts are finishes is judged on them: a finish is
//   done when the shot was taken (the engine marks it 'attempted'), so a shot-only idea that
//   shot ran, and one that never shot broke (the Lab's beats read it the same way).
// - A part is DONE when:
//   run / advance, and hold with a drawn space: the player arrived in the drawn
//     space (an 'arrived' note), or he received a pass of this idea (the run
//     served its purpose even if the ball found him before the space did), or
//     the idea moved him on to his next drawn part (an 'interrupted' note at
//     the instant a later moment made another of its parts active for the same
//     player: the drive ends when "when pressed, slip" begins);
//   offer / occupy (a relation, no fixed destination), and hold without a
//     space: the player moved for it (a 'pursued' note), received a pass of
//     this idea, or was moved on to his next drawn part as above;
//   spot (a set-piece routine's "spot:<n>" notes, written at the kick): the
//     player stood within his roaming distance of the spot the manager gave
//     him (an 'arrived' note);
//   pass: the ball was released AS DRAWN (a 'released' note with intent
//     'attempted': right team-mate, space and height per the engine's own
//     match rule). An allowed alternative pass ('alternative') is not the
//     drawn pass. Whether it was then received is football, not the idea;
//     it is reported as `received`.
// An idea with no due part at all is 'broke'.
//
// Set-piece routines (a lesson with a `scene`): the kick decides. The drawn
// delivery is the taker's own part in the set-up (his pass, or shot at a free
// kick); if it did not happen as drawn, the routine 'broke' off, whatever the
// spots did. A routine chosen at a stoppage whose restart was never kicked
// (the match or watch ended first) did not run at all: it is not classified
// (null), and callers leave it out rather than counting it as broke.
import type {ActionTrace} from '../../packages/football-engine/src/practice-teaching';
import type {LessonSpec,LessonJob} from '../../packages/football-engine/src/practice-lesson';

export type IdeaRun='ran'|'partly'|'broke';
type TraceLike=Pick<ActionTrace,'time'|'stepId'|'phase'>&Partial<Pick<ActionTrace,'intent'|'actor'|'target'|'responsibility'|'evidence'>>;
export interface IdeaPartFacts {
 id:string;kind:LessonJob['kind']|'spot'|'unknown';due:boolean;done:boolean;skipped:boolean;
 dueAt?:number;doneAt?:number;actor?:string;
 arrived?:boolean;pursued?:boolean;released?:'attempted'|'alternative';received?:boolean;receiver?:string;
 /** Off-ball 'adapted' notes: the engine found no fitting position and let ordinary play decide. */
 abandoned:number;
}
export interface IdeaRunFacts {run:IdeaRun;parts:IdeaPartFacts[];due:number;done:number;skipped:number;shot:boolean;/** Only finishes were due: they were judged (done = shot taken). */ shotOnly:boolean;
 /** A routine with a drawn delivery: whether the taker played it as drawn (decides the verdict). */ delivered?:boolean}

const MOVEMENT=new Set(['run','advance','hold','offer','occupy']);
type SelectionLike={trace?:readonly TraceLike[]|null;restartTakenAt?:number};
/** A routine's drawn delivery: the taker's pass/shot in the set-up. */
const deliveryJobs=(l:LessonSpec)=>{const start=new Set(l.moments.filter(m=>m.cue.kind==='start').map(m=>m.id));return l.jobs.filter(j=>start.has(j.momentId)&&j.actor===l.scene!.taker&&(j.kind==='pass'||j.kind==='shoot'));};
/** A set-piece routine whose restart was never kicked: it is left out. */
export function routineUnkicked(sel:SelectionLike,lesson?:LessonSpec|null):boolean{
 if(!lesson?.scene)return false;
 if(sel.restartTakenAt!==undefined)return false;
 const trace=sel.trace??[];
 return !trace.some(e=>e.stepId.startsWith('spot:')||e.evidence?.cue?.kind==='restart-taken'||e.phase==='released');
}
export function ideaRunFacts(sel:SelectionLike,lesson?:LessonSpec|null):IdeaRunFacts|null{
 const trace=sel.trace??[];if(!trace.length||routineUnkicked(sel,lesson))return null;
 const ids=[...new Set(trace.map(e=>e.stepId))];
 const receipts=trace.filter(e=>e.phase==='received');
 const parts=ids.map((id):IdeaPartFacts=>{
  const notes=trace.filter(e=>e.stepId===id),job=lesson?.jobs.find(j=>j.id===id);
  const kind=(id.startsWith('spot:')?'spot':job?.kind??notes.find(e=>e.responsibility)?.responsibility??'unknown') as IdeaPartFacts['kind'];
  const hasSpace=job?!!job.spaceId:notes.some(e=>!!e.evidence?.spaceId);
  const active=notes.find(e=>e.phase==='active'),skipped=notes.some(e=>e.phase==='skipped');
  const actor=notes.findLast(e=>e.actor)?.actor;
  const arrived=notes.find(e=>e.phase==='arrived'),pursued=notes.find(e=>e.intent==='pursued');
  const release=notes.find(e=>e.phase==='released'&&(e.intent==='attempted'||e.intent==='alternative'));
  const drawn=notes.find(e=>e.phase==='released'&&e.intent==='attempted');
  const receipt=notes.find(e=>e.phase==='received');
  // Only a pass of THIS idea that the player himself received.
  const got=actor?receipts.find(e=>e.target===actor&&(!active||e.time>=active.time)):undefined;
  // The idea itself moved him on: a later drawn moment gave the same player
  // his next part (the drive ends when "when pressed, slip" begins).
  const handedOn=notes.find(e=>e.phase==='interrupted'&&!!actor&&trace.some(o=>o.stepId!==id&&o.phase==='active'&&o.actor===actor&&Math.abs(o.time-e.time)<1e-6));
  let doneAt:number|undefined;
  if(kind==='spot')doneAt=arrived?.time;
  else if(kind==='pass')doneAt=drawn?.time;
  else if(kind==='shoot')doneAt=notes.find(e=>e.intent==='attempted')?.time;
  else if(MOVEMENT.has(kind)){
   const reached=(kind==='offer'||kind==='occupy'||kind==='hold'&&!hasSpace)?pursued:arrived;
   doneAt=[reached?.time,got?.time,handedOn?.time].filter((t):t is number=>t!==undefined).sort((a,b)=>a-b)[0];
  }
  const abandoned=notes.filter(e=>e.phase==='adapted'&&MOVEMENT.has(kind)).length;
  return {id,kind,due:!!active&&!skipped,done:!!active&&!skipped&&doneAt!==undefined,skipped,...(active?{dueAt:active.time}:{}),...(doneAt!==undefined?{doneAt}:{}),...(actor?{actor}:{}),
   ...(MOVEMENT.has(kind)?{arrived:!!arrived,pursued:!!pursued}:{}),
   ...(release?{released:release.intent as 'attempted'|'alternative'}:{}),...(receipt?{received:true,receiver:receipt.target}:{}),abandoned};
 });
 const others=parts.filter(p=>p.due&&p.kind!=='shoot'),finishes=parts.filter(p=>p.due&&p.kind==='shoot');
 const shotOnly=!others.length&&finishes.length>0,required=shotOnly?finishes:others;
 const done=required.filter(p=>p.done).length;
 // A routine whose drawn delivery did not happen broke off at its kick.
 const delivery=lesson?.scene?deliveryJobs(lesson).map(j=>parts.find(p=>p.id===j.id)):[];
 const kickFailed=delivery.some(p=>!p?.done);
 const run:IdeaRun=!required.length||!done||kickFailed?'broke':done===required.length?'ran':'partly';
 return {run,parts,due:required.length,done,skipped:parts.filter(p=>p.skipped).length,shot:parts.some(p=>p.kind==='shoot'&&p.done),shotOnly,...(delivery.length?{delivered:!kickFailed}:{})};
}
export const classifyIdeaRun=(sel:SelectionLike,lesson?:LessonSpec|null):IdeaRun|null=>ideaRunFacts(sel,lesson)?.run??null;
