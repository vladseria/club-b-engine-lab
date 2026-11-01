// A watch told as its key beats, in plain English: the idea started, each step
// ran / partly / broke off / was skipped / wasn't reached, and why it ended.
// The engine's trace is a decision log (waiting, re-reading the situation every
// few tenths); the beats keep only what a manager would say afterwards. Each
// step is judged by the same facts as the headline (lib/ballers/idea-run: a
// part is due once its player takes it on, done when carried out as drawn; the
// finish counts only when it is all that was due). So the headline is "Ran it"
// exactly when every step it judges ran; a finish-only step inside a bigger
// move says Shot / No shot, which the headline doesn't count. Pure.
import type {PlaybookSelection} from '../../../packages/football-engine/src/practice-playbook';
import type {ActionTrace} from '../../../packages/football-engine/src/practice-teaching';
import type {LessonSpec} from './model';
import {ideaRunFacts} from '../idea-run';
import {cap,momentTitle,type Names} from './text';

export type BeatTone='ok'|'warn'|'bad'|'idle';
export interface Beat {key:string;/** Where playback jumps; null = it never happened. */ time:number|null;tone:BeatTone;label:string;title:string;detail?:string}
/** A player's name for a trace id ("0:<id>" / "1:<id>"). */
export type WhoIs=(id:string|undefined)=>string;

const ENDED:Record<NonNullable<PlaybookSelection['endReason']>,[string,BeatTone]>={
 complete:['Every job done','ok'],loss:['They lost the ball','bad'],duration:['The move ran its time','idle'],restart:['The ball went out of play','idle'],
 end:['The watch ended','idle'],aborted:['It couldn’t carry on','bad'],conflict:['Another idea needed one of the players','idle'],
};

/** What happened in one step, in at most two short actions. */
function actions(entries:ActionTrace[],who:WhoIs){
 const out:string[]=[];
 for(const e of entries){
  const line=e.phase==='released'?`${who(e.actor)} plays the pass${e.target?` to ${who(e.target)}`:''}`
   :e.phase==='received'?`${who(e.target??e.actor)} gets it`
   :e.phase==='arrived'&&e.stepId.startsWith('spot:')?`${who(e.actor)} is on his spot`
   :e.phase==='arrived'?`${who(e.actor)} gets into the space`
   :e.phase==='complete'&&e.action==='shoot'?`${who(e.actor)} shoots`
   :e.phase==='active'&&e.action==='shoot'?`${who(e.actor)} looks for the shot`
   :e.phase==='active'&&e.action==='carry'?`${who(e.actor)} carries it`
   :e.phase==='active'&&e.action==='move'?`${who(e.actor)} makes his run`:null;
  if(line&&!out.includes(line))out.push(line);
  if(out.length===2)break;
 }
 return out.join(' · ')||undefined;
}

export function beatsOf(sel:PlaybookSelection|undefined,l:LessonSpec|undefined,names:Names,who:WhoIs,duration:number):Beat[]{
 if(!sel||!l)return [];
 const trace=sel.trace??[],rec=sel.recognition,entered=rec?l.moments.findIndex(m=>m.id===rec.momentId):0;
 const beats:Beat[]=[{key:'start',time:sel.time,tone:'ok',label:'Start',
  title:rec?.independent&&entered>0?`Started at step ${entered+1}`:'Started',
  detail:rec?.independent&&entered>0?'The players saw that situation straight away.':undefined}];
 const facts=ideaRunFacts(sel,l as never),parts=facts?.parts??[];
 l.moments.forEach((m,i)=>{
  const mine=trace.filter(e=>e.momentId===m.id||!!l.scene&&m.cue.kind==='start'&&e.stepId.startsWith('spot:')),live=mine.filter(e=>e.phase!=='waiting'&&e.phase!=='skipped');
  // A routine's spots belong to its set-up (judged at the kick).
  const ids=new Set([...l.jobs.filter(j=>j.momentId===m.id).map(j=>j.id),...(l.scene&&m.cue.kind==='start'?parts.filter(p=>p.kind==='spot').map(p=>p.id):[])]),own=parts.filter(p=>ids.has(p.id));
  const due=own.filter(p=>p.due),required=due.filter(p=>p.kind!=='shoot'),title=`Step ${i+1} · ${cap(momentTitle(m,l,names))}`;
  if(!due.length){
   const skipped=own.find(p=>p.skipped)?mine.find(e=>e.phase==='skipped'):undefined;
   if(skipped||i<entered)beats.push({key:`step:${m.id}`,time:skipped?.time??null,tone:'idle',label:'Skipped',title});
   else beats.push({key:`step:${m.id}`,time:null,tone:'idle',label:'Not reached',title});
   return;
  }
  const at=Math.min(...due.map(p=>p.dueAt??Infinity));
  let label:string,tone:BeatTone;
  if(!required.length&&facts?.shotOnly){[label,tone]=due.some(p=>p.done)?['Ran','ok']:['Broke off','bad'];}
  else if(!required.length){const shot=due.some(p=>p.done);[label,tone]=shot?['Shot','ok']:['No shot','idle'];}
  // A routine's set-up is decided by its delivery: no drawn ball in, it broke off.
  else if(l.scene&&m.cue.kind==='start'&&facts?.delivered===false){[label,tone]=['Broke off','bad'];}
  else{const done=required.filter(p=>p.done).length;[label,tone]=done===required.length?['Ran','ok']:done?['Partly','warn']:['Broke off','bad'];}
  beats.push({key:`step:${m.id}`,time:Number.isFinite(at)?at:live[0]?.time??null,tone,label,title,detail:actions(live,who)});
 });
 const end=sel.endedAt!==undefined&&sel.endReason&&sel.endedAt<duration?ENDED[sel.endReason]:null;
 if(end)beats.push({key:'end',time:sel.endedAt!,tone:end[1],label:'End',title:end[0]});
 return beats;
}
/** The beat playback is on: the last one that has happened by `time`. */
export const beatAt=(beats:Beat[],time:number)=>{let at=-1;beats.forEach((b,i)=>{if(b.time!==null&&b.time<=time+.05)at=i;});return at;};

/** One trace line in English for "All details" (the full decision log). */
const PHASE_WORDS:Record<ActionTrace['phase'],string>={waiting:'waits for his moment',active:'starts his job',adapted:'adjusts to the play',released:'plays the pass',received:'gets the ball',arrived:'reaches the space',complete:'finishes his job',aborted:'gives it up',interrupted:'is stopped',skipped:'skips it'};
const STEP_WORDS:Partial<Record<ActionTrace['phase'],string>>={waiting:'waits for its moment',skipped:'is skipped',aborted:'breaks off',interrupted:'is stopped',complete:'is done'};
/** `step`: which step (1-based) a line belongs to, for lines no single player owns. */
export const traceLine=(e:ActionTrace,who:WhoIs,step?:number)=>e.phase==='received'&&e.target?`${who(e.target)} gets the ball`
 :e.actor?`${who(e.actor)} ${PHASE_WORDS[e.phase]}`:`${step?`Step ${step}`:'The move'} ${STEP_WORDS[e.phase]??PHASE_WORDS[e.phase]}`;
