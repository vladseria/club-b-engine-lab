// Ballers P5: ideas in prep and on the broadcast. Pure.
//
// In prep: an idea is drawn for the five the manager had in the Lab
// (slot n = idea.lineup[n-1]). resolveIdea re-points it at this match's five
// with the Lab's own preparedPlan; for every idea player who isn't starting,
// the manager picks who takes that part over (a sensible default is offered).
// The chosen mapping is stored with the prep and frozen in the plans snapshot
// ('assign'); lib/ballers/compute.ts resolves the frozen plan with this same
// function, so the plan the players carry is exactly the one prep showed.
//
// On the broadcast: one lane per idea (owner only, named), the ✓/✗ rule
// (replay.ts ideaOutcome), the faint pitch line while an idea is active and
// the post-match "Your ideas" review.
import {planSlots,preparedPlan,type LabPlan,type PrepIssue} from './lab/model';
import {ideaOutcome,type IdeaOutcome,type ReplayEvent} from './replay';
import type {IdeaRun} from './idea-run';

/** The players an idea gives a part to (slot n = lineup[n-1]; `assign`
 * re-points a slot to whoever takes it over). A plan this Lab can't read has none. */
export function ideaPlayerIds(plan:unknown,lineup:string[],assign:Record<string,string>={}):string[]{
 const p=plan as Partial<LabPlan>|null;
 if(!p||!p.lesson||!Array.isArray(p.lesson.jobs))return [];
 try{return [...new Set(planSlots(p.lesson,p.standing??[]).map(n=>assign[String(n)]??lineup[n-1]).filter((id):id is string=>!!id))];}catch{return [];}
}

// ---------- prep ----------
/** An idea's emphasis as a match accent (0-100): what it was saved with in
 * the Lab, else full. Enabling an idea (Lab or prep) starts from this, so the
 * emphasis set on the board is what the players first take into a match. */
export function ideaAccent(idea:{plan?:unknown}):number{
 const e=(idea.plan as {emphasis?:unknown}|null|undefined)?.emphasis;
 return typeof e==='number'&&e>=0&&e<=1?Math.round(e*100):100;
}
export interface MissingPart {slot:number;
 /** The idea's player for that slot (not in this five). */ id:string;
 /** Who takes the part over. */ assigned:string;
 /** true = the manager chose; false = the default. */ chosen:boolean}
export interface ResolvedIdea {plan?:Record<string,unknown>;missing:MissingPart[];issues:PrepIssue[];
 /** Idea players who start in this five: their slot in the idea (for prep's picker labels). */ kept:{slot:number;id:string}[];
 /** slot -> player for the missing parts: what prep stores. */ assign:Record<string,string>}

/** Re-point an idea at `target` (the match's five, keeper first). */
export function resolveIdea(idea:{plan:Record<string,unknown>;lineup:string[]},target:string[],chosen:Record<string,string>={}):ResolvedIdea{
 const plan=idea.plan as unknown as LabPlan;
 if(!plan||typeof plan!=='object'||!plan.lesson)return {plan:idea.plan,missing:[],issues:[],kept:[],assign:{}};
 const slots=planSlots(plan.lesson,plan.standing).filter(n=>n>=2&&n<=5).sort((a,b)=>a-b);
 const outfield=target.slice(1,5),used=new Set<string>(),missing:MissingPart[]=[];
 for(const n of slots){const id=idea.lineup[n-1];if(outfield.includes(id))used.add(id);}
 for(const n of slots){
  const id=idea.lineup[n-1];if(outfield.includes(id))continue;
  const pick=chosen[String(n)];
  let assigned:string|undefined,mine=false;
  if(pick&&outfield.includes(pick)){assigned=pick;mine=true;}
  else assigned=[target[n-1],...outfield].find(p=>p&&outfield.includes(p)&&!used.has(p));
  if(!assigned){missing.push({slot:n,id,assigned:'',chosen:false});continue;}
  used.add(assigned);missing.push({slot:n,id,assigned,chosen:mine});
 }
 const assignments:Record<number,string>=Object.fromEntries(missing.filter(m=>m.assigned).map(m=>[m.slot,m.assigned]));
 const r=preparedPlan({plan,lineup:idea.lineup},target,assignments);
 return {plan:r.plan as unknown as Record<string,unknown>|undefined,missing,issues:r.issues,
  kept:slots.filter(n=>outfield.includes(idea.lineup[n-1])).map(n=>({slot:n,id:idea.lineup[n-1]})),
  assign:Object.fromEntries(missing.filter(m=>m.assigned).map(m=>[String(m.slot),m.assigned]))};
}

// ---------- the broadcast ----------
/** An idea marker (ballers_match_ideas, public, unnamed). Times in seconds.
 * run: the classifier's word for a named firing (public from 2026-09-29, same
 * row gate as the marker); null/absent for free play and older rows. */
export interface Marker {seq:number;side:0|1;t:number;ended_at:number|null;status:string;end_reason:string|null;progress:'recognised'|'pursued'|'attempted';free:boolean;run?:IdeaRun|null}
/** Owner-only extras (ballers_match_idea_names.detail). links: [t ms, player, other player or -1];
 * run: whether the firing played out as drawn (lib/ballers/idea-run.ts; absent before 2026-09-28). */
export interface IdeaDetail {links?:[number,number,number][];why?:string;run?:IdeaRun}
/** The owner's markers with each firing's `run` (from the owner-only detail) attached;
 * a marker whose detail has none keeps the public row's own `run`. */
export function withRun<M extends {seq:number}>(markers:M[],names:IdeaName[]):(M&{run?:IdeaRun})[]{
 const run=new Map(names.map(n=>[n.seq,n.detail?.run]));
 return markers.map(m=>{const r=run.get(m.seq);return r?{...m,run:r}:m;});
}
export interface IdeaName {seq:number;name:string;plan_key:string|null;detail?:IdeaDetail|null}
export interface Lane {key:string;name:string;markers:Marker[]}

/** One lane per idea of `side` (at most 3, in order of first use). Markers
 * without a name row stay out: only the owner has names. */
export function ideaLanes(markers:Marker[],names:IdeaName[],side:0|1):Lane[]{
 const byseq=new Map(names.map(n=>[n.seq,n])),lanes:Lane[]=[];
 for(const m of markers){
  if(m.side!==side||m.free)continue;
  const n=byseq.get(m.seq);if(!n)continue;
  const key=n.plan_key??n.name;
  let lane=lanes.find(l=>l.key===key);
  if(!lane){if(lanes.length>=3)continue;lane={key,name:n.name,markers:[]};lanes.push(lane);}
  lane.markers.push(m);
 }
 return lanes;
}
export const ideaEnd=(m:Pick<Marker,'t'|'ended_at'>)=>m.ended_at??m.t+8;
export const firing=(m:Pick<Marker,'t'|'ended_at'>,t:number)=>t>=m.t&&t<ideaEnd(m);

/** The faint pitch line(s) at t (s): for each of the owner's active ideas, the
 * latest player link its trace recorded so far, between the two players the
 * idea is working with. Player indices (replay order). */
export function activeLinks(markers:Marker[],names:IdeaName[],side:0|1,t:number):{a:number;g:number}[]{
 const byseq=new Map(names.map(n=>[n.seq,n])),out:{a:number;g:number}[]=[];
 for(const m of markers){
  if(m.side!==side||m.free||!firing(m,t))continue;
  const links=byseq.get(m.seq)?.detail?.links??[];
  // The latest link so far; a trace step names only its actor (target -1)
  // most of the time, so the line joins him to the previous distinct actor
  // of the same idea (the pair it is working between), else to the ball.
  const seen=links.filter(l=>l[0]<=t*1000&&l[0]>=m.t*1000-1&&l[1]>=0);
  const best=seen.at(-1);if(!best)continue;
  const partner=best[2]>=0?best[2]:[...seen].reverse().find(l=>l[1]!==best[1])?.[1]??-1;
  out.push({a:best[1],g:partner});
 }
 return out;
}

// ---------- the post-match review (owner only) ----------
export type Outcome=IdeaOutcome;
export interface ReviewEntry {seq:number;t:number;outcome:Outcome;progress:Marker['progress'];why:string}
export interface Review {key:string;name:string;fired:number;ok:number;partly:number;x:number;faint:number;entries:ReviewEntry[]}
const STAGE:Record<Marker['progress'],string>={recognised:'Spotted the moment; nobody moved for it',pursued:'Players moved for it, but the key action never started',attempted:'Tried'};
const END:Record<string,string>={loss:'we lost the ball',restart:'play stopped',conflict:'another idea had those players',duration:'it ran out of time',end:'full time',aborted:'the situation changed',complete:'it was completed'};
/** Why an attempt didn't start / how it ended, in plain English. */
const RUN:Record<IdeaRun,string>={ran:'Played out as drawn',partly:'Partly played out as drawn',broke:'Broke off before any drawn part happened'};
export function whyLine(m:Marker&{run?:IdeaRun}):string{
 const end=m.end_reason?END[m.end_reason]??m.end_reason:null;
 if(m.run)return `${RUN[m.run]}${end?`; ended because ${end}`:''}.`;
 if(m.progress==='attempted')return end?`Tried; ended because ${end}.`:'Tried.';
 // Never tried: "completed" only means the passage it waited for ended.
 const why=m.end_reason==='complete'?'the passage ended without it':end;
 return `${STAGE[m.progress]}${why?` (${why})`:''}.`;
}
export function ideaReview(markers:Marker[],names:IdeaName[],side:0|1,events:ReplayEvent[]):Review[]{
 return ideaLanes(markers,names,side).map(l=>{
  const entries=withRun(l.markers,names).map(m=>({seq:m.seq,t:m.t,outcome:ideaOutcome(m,events),progress:m.progress,why:whyLine(m)}));
  const n=(o:Outcome)=>entries.filter(e=>e.outcome===o).length;
  return {key:l.key,name:l.name,fired:entries.length,ok:n('ok'),partly:n('partly'),x:n('x'),faint:n('faint'),entries};
 });
}
