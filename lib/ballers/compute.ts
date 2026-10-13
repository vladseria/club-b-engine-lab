// Browser-safe match computation: the frozen-input shape, the engine call and
// the compact replay v2. No Node APIs here, so the official compute route
// (through lib/ballers/simulation.ts) and the browser practice worker
// (lib/ballers/engine.worker.ts) run exactly the same code path.
import {runMatch,ENGINE_BUILD,validatePlans,playbookProgress,type PlaybookConfig,type PlaybookPlan} from '../../packages/football-engine/src/index';
import type {Player as EnginePlayer,Team,Tactics} from '../../packages/football-engine/src/model';
import {engineApproach,type StoredApproach} from './approach';
import {validateSubstitutionOrders,type SubstitutionNote,type SubstitutionOrder,type SubstitutionTrigger} from '../../packages/football-engine/src/practice-substitutions';
import {CHUNK_SECONDS,FRAME_STEP,REPLAY_VERSION,cm,mrad,ms,type CompactMatch,type ReplayChunk,type ReplayEvent,type ReplayFrame,type ReplayHeader,type ReplayIdea,type ReplayPlayer,type TeamStats} from './replay';
import {resolveIdea} from './ideas';
import {classifyIdeaRun,routineUnkicked,type IdeaRun} from './idea-run';
import type {LessonSpec} from '../../packages/football-engine/src/practice-lesson';
import {engineOrder,type PrepOrder} from './subs';
import {normalizeSettings,settingsSquad,settingsTactics,type MatchSettings} from './match-settings';
import {normalizeVoice,type Voice} from './voice';

export interface FrozenPlayer {id:string;name:string;short:string;number:number;roles:EnginePlayer['roles'];skills:EnginePlayer['skills'];traits:EnginePlayer['traits'];energy:number;archetype:string;temperament:string;note:string;portrait:string}
/** `lineup`: the five the idea was drawn for (slot n = lineup[n-1]); `assign`:
 * slot -> who takes over a part whose player isn't in this five (P5, prep). */
export interface FrozenPlan {idea:string;key:string;name:string;plan:Record<string,unknown>;lineup:string[];accent:number;assign?:Record<string,string>}
/** `substitutions` (P5): the prep's triggered substitution orders, squad ids, no side.
 * `settings`: the prep's match settings (lib/ballers/match-settings.ts), present only when not default.
 * `voice`: the club's commentary lines (lib/ballers/voice.ts), frozen at the lock, present only when it has any.
 * `approach.onLoss` ("On losing it", lib/ballers/approach.ts): frozen with the prep once
 * the club has one; absent in every input frozen before it, which means 'balanced'. */
export interface FrozenSide {club:{id:string;name:string;code:string;color:string};formation:'1-2-1'|'2-2'|'2-1-1';style:string;approach:StoredApproach;captain:string;lineup:string[];bench:string[];players:FrozenPlayer[];plans:FrozenPlan[];substitutions?:PrepOrder[];settings?:MatchSettings;voice?:Voice}
/** private.ballers_build_input() output, version 1. */
export interface FrozenInput {v:1;match:string;seed:number;kickoff:0|1;duration:number;sides:[FrozenSide,FrozenSide]}

export function engineTeam(side:FrozenSide):Team{
 // Match settings are re-read against this five (a stale taker is dropped);
 // none set = the exact tactics and squad an untouched club always had.
 const settings=side.settings?normalizeSettings(side.settings,side.lineup):undefined;
 // "On losing it" reaches the engine through engineApproach
 // (lib/ballers/approach.ts), the one place every Tactics build goes through
 // (here, and the Lab's tacticsOf/demoSide and trial side). A frozen input
 // without `onLoss` plays as 'balanced', exactly as an explicit 'balanced'.
 const tactics:Tactics=settingsTactics({...engineApproach(side.approach),formation:side.formation,setPiece:'mixed',fullbacks:'balanced',marking:'balanced'} as unknown as Tactics,settings);
 const squad=settingsSquad(side.players.map(p=>({id:p.id,name:p.name,roles:[...p.roles],skills:{...p.skills},traits:{...p.traits},energy:p.energy,note:p.note,archetype:p.archetype,temperament:p.temperament}) as EnginePlayer),settings);
 return {id:side.club.id,name:side.club.name,short:side.club.code,color:side.club.color,description:'Ballers',squad,lineup:[...side.lineup],tactics,orders:[]};
}

/** The side's enabled ideas as the engine takes them: each re-pointed at this
 * match's five exactly as prep showed it (lib/ballers/ideas.ts resolveIdea,
 * with the frozen `assign`), the prep accent (0-100) as the plan emphasis
 * (0-1). An idea that can't be placed or that the engine refuses is left out
 * (reported), never repaired. */
export function sidePlans(side:FrozenSide):{plans:PlaybookPlan[];dropped:string[]}{
 const plans:PlaybookPlan[]=[],dropped:string[]=[];
 for(const p of side.plans){
  try{
   const r=resolveIdea(p,side.lineup,p.assign??{});
   if(!r.plan||r.issues.length)throw Error('unplaceable');
   plans.push(validatePlans([{...r.plan,emphasis:Math.max(0,Math.min(100,p.accent))/100}])[0]);
  }
  catch{dropped.push(p.key);}
 }
 return {plans,dropped};
}

/** Both sides' substitution orders as the engine takes them (with `side`).
 * Each side is validated on its own, so one side's bad orders never cost the
 * other side its own (or the match): they are left out and reported. */
export function sideOrders(input:FrozenInput,teams:[Team,Team]):{orders:SubstitutionOrder[];dropped:string[]}{
 const orders:SubstitutionOrder[]=[],dropped:string[]=[];
 input.sides.forEach((s,side)=>{
  // A tired trigger stores a level code; the engine gets that level's energy (lib/ballers/subs.ts).
  const mine=(s.substitutions??[]).map(o=>engineOrder({...o,side:side as 0|1}));if(!mine.length)return;
  try{orders.push(...validateSubstitutionOrders(mine,{seed:0,kickoff:0,teams} as never));}
  catch{dropped.push(`subs:${side}`);}
 });
 return {orders,dropped};
}

export function validateInput(value:unknown):FrozenInput{
 const v=value as FrozenInput;
 if(!v||v.v!==1||!Number.isInteger(v.seed)||v.seed<0||v.seed>0xffffffff||![0,1].includes(v.kickoff)||!Array.isArray(v.sides)||v.sides.length!==2)throw Error('invalid_input');
 if(!Number.isFinite(v.duration)||v.duration<60||v.duration>900)throw Error('invalid_input');
 for(const s of v.sides){if(!Array.isArray(s.lineup)||s.lineup.length!==5||!s.lineup.every(id=>s.players.some(p=>p.id===id)))throw Error('invalid_input');}
 return v;
}

export interface Computed {compact:CompactMatch;dropped:string[];engineBuild:string}

/** Runs the whole match once. Deterministic for (input, ENGINE_BUILD). */
export function computeMatch(input:FrozenInput,progress?:(t:number)=>void):Computed{
 const teams=input.sides.map(engineTeam) as [Team,Team];
 const plans=input.sides.map(sidePlans);
 const playbooks=plans.flatMap((p,side)=>p.plans.length?[{side:side as 0|1,plans:p.plans,adaptive:true}]:[]) as PlaybookConfig[];
 // No orders = the key is omitted: the engine input is byte-identical to P2's.
 const subs=sideOrders(input,teams);
 const run=runMatch({fixture:{teams,seed:input.seed,kickoff:input.kickoff},durationSeconds:input.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})},progress);
 return {compact:compact(input,run.result as unknown as EngineResult),dropped:[...plans.flatMap(p=>p.dropped),...subs.dropped],engineBuild:run.engineBuild};
}

// The slice of PracticeResult this module reads (kept structural so the
// compaction can be unit-tested with a synthetic result).
interface EngineFrame {time:number;cut?:boolean;lineup?:number[];players:{x:number;y:number;angle:number}[];ball:{x:number;y:number;z:number;owner:string|null};score:[number,number];restart:boolean;restartInfo?:{taker:string};side:0|1;control?:{owner:string}}
interface EngineEvent {time:number;kind:string;text:string;actor?:string;target?:string;side?:0|1;lastTouch?:string;restartKind?:string;shot?:{aim:{x:number;y:number};origin:{x:number;y:number};assessment?:{quality:number}};technique?:string;freeKick?:unknown;
 substitution?:{order:string;trigger:SubstitutionTrigger;energy:number;score:[number,number]}}
interface EngineSelection {time:number;planId:string|null;name:string;status:string;endedAt?:number;endReason?:string;endDetail?:string;side?:0|1;trace?:{time:number;stepId:string;phase:string;intent?:string;actor?:string;target?:string;responsibility?:string;evidence?:{spaceId?:string}}[]}
export interface EngineResult {duration:number;players:{id:string;side:0|1;role:string}[];frames:EngineFrame[];events:EngineEvent[];stats:[TeamStats,TeamStats];score:[number,number];playbookSelections?:EngineSelection[];substitutionNotes?:SubstitutionNote[]}

export function compact(input:FrozenInput,r:EngineResult):CompactMatch{
 // Engine roster ids are `${side}:${playerId}`. Replay indices: 0-9 the
 // starters (side*5 + slot), then every bench player (home first), so a
 // substitute already has an index when he comes on (the header, public from
 // kickoff, lists the whole bench: it never gives away that a change comes).
 const index=new Map<string,number>(),players:ReplayPlayer[]=[];
 input.sides.forEach((s,side)=>s.lineup.forEach((id,slot)=>index.set(`${side}:${id}`,side*5+slot)));
 input.sides.forEach((s,side)=>s.bench.forEach(id=>{if(s.players.some(p=>p.id===id))index.set(`${side}:${id}`,index.size);}));
 const idx=(id:string|null|undefined)=>id?index.get(id)??-1:-1;
 input.sides.forEach((s,side)=>s.lineup.forEach((id,slot)=>{
  const p=s.players.find(q=>q.id===id)!,engine=r.players.find(q=>q.id===`${side}:${id}`);
  players.push({i:side*5+slot,side:side as 0|1,slot,id,name:p.name,short:p.short,number:p.number,role:engine?.role??p.roles[0],portrait:p.portrait,captain:s.captain===id});
 }));
 input.sides.forEach((s,side)=>s.bench.forEach(id=>{
  const p=s.players.find(q=>q.id===id);if(!p)return;
  players.push({i:index.get(`${side}:${id}`)!,side:side as 0|1,slot:-1,id,name:p.name,short:p.short,number:p.number,role:p.roles[0],portrait:p.portrait,captain:false,bench:true});
 }));
 players.sort((a,b)=>a.i-b.i);
 const header:ReplayHeader={v:REPLAY_VERSION,engineBuild:'',duration:r.duration,chunkSeconds:CHUNK_SECONDS,chunks:Math.ceil(r.duration/CHUNK_SECONDS),
  teams:input.sides.map(s=>{const voice=normalizeVoice(s.voice);
   // No voice = the key is omitted: the header is byte-identical to before.
   return {club:s.club.id,name:s.club.name,code:s.club.code,color:s.club.color,formation:s.formation,style:s.style,...(voice?{voice}:{})};}) as ReplayHeader['teams'],players};

 let last=-Infinity;
 const frames:ReplayFrame[]=[];
 r.frames.forEach((f,n)=>{
  const keep=n===0||f.cut||f.time>=last+FRAME_STEP-1e-9||n===r.frames.length-1;if(!keep)return;last=f.time;
  const owner=f.control?.owner??(f.restart?f.restartInfo?.taker:undefined)??f.ball.owner;
  const frame:ReplayFrame={t:ms(f.time),p:f.players.map(p=>[cm(p.x),cm(p.y),mrad(p.angle)]),b:[cm(f.ball.x),cm(f.ball.y),cm(f.ball.z)],o:idx(owner),ps:f.side,s:[f.score[0],f.score[1]]};
  if(f.restart)frame.r=1;if(f.cut)frame.c=1;
  // After a substitution: who stands at each position (replay indices).
  if(f.lineup)frame.l=f.lineup.map(k=>idx(r.players[k]?.id));
  // Two frames at one instant: the later one wins unless it is a camera cut.
  if(frames.length&&frames[frames.length-1].t===frame.t&&!frame.c)frames[frames.length-1]=frame;else frames.push(frame);
 });
 const events:ReplayEvent[]=r.events.map(e=>{
  const out:ReplayEvent={t:ms(e.time),k:e.kind,x:e.text};
  if(e.actor!==undefined&&idx(e.actor)>=0)out.a=idx(e.actor);
  if(e.target!==undefined&&idx(e.target)>=0)out.g=idx(e.target);
  if(e.side!==undefined)out.s=e.side;
  if(e.lastTouch!==undefined&&idx(e.lastTouch)>=0)out.lt=idx(e.lastTouch);
  if(e.restartKind)out.rk=e.restartKind;
  if(e.shot)out.sh={o:[cm(e.shot.origin.x),cm(e.shot.origin.y)],a:[cm(e.shot.aim.x),cm(e.shot.aim.y)]};
  // The engine's own read of the chance at the strike (4 Oct, "good chances",
  // lib/ballers/chances.ts): q = ShotAssessment.quality, 3 decimals; a shot
  // the engine doesn't read (header, volley, direct free kick) says which it is.
  if(e.kind==='shot'){const q=e.shot?.assessment?.quality;
   // A kind this list doesn't know stays unread: the match then shows no good chances rather than a guess.
   if(q!==undefined&&Number.isFinite(q))out.q=Math.round(q*1000)/1000;else if(e.technique==='header')out.sk=1;else if(e.technique==='volley')out.sk=2;else if(e.freeKick)out.sk=3;}
  if(e.substitution){const t=e.substitution.trigger;
   out.sb={k:t.kind,...(t.kind==='score'?{st:t.state}:t.kind==='margin'?{n:t.atLeast,d:t.direction}:{}),e:Math.round(e.substitution.energy)};}
  return out;
 });
 const chunks:ReplayChunk[]=[];
 for(let i=0;i<header.chunks;i++){
  const t0=i*CHUNK_SECONDS*1000,t1=Math.min((i+1)*CHUNK_SECONDS,r.duration)*1000,final=i===header.chunks-1;
  const inside=(t:number)=>t>=t0&&(t<t1||final);
  chunks.push({v:REPLAY_VERSION,i,t0,t1,f:frames.filter(f=>inside(f.t)),e:events.filter(e=>inside(e.t))});
 }
 // A set-piece routine chosen at a stoppage that was never kicked (full time
 // came first) did not run: it is left out, not counted as broke.
 const ideas:ReplayIdea[]=(r.playbookSelections??[]).flatMap((sel,seq)=>sel.planId!==null&&routineUnkicked(sel as never,lessonOf(input,sel))?[]:[{seq,side:(sel.side??0) as 0|1,t:ms(sel.time),endedAt:sel.endedAt===undefined?null:ms(sel.endedAt),
  status:sel.status,endReason:sel.endReason??null,progress:playbookProgress(sel as never),planId:sel.planId,name:sel.name,
  detail:ideaDetail(sel,idx,sel.planId===null?null:classifyIdeaRun(sel as never,lessonOf(input,sel))??'broke')}]);
 return {header,chunks,score:[r.score[0],r.score[1]],stats:r.stats,ideas,substitutionNotes:subNotes(input,r.substitutionNotes)};
}

/** The lesson a selection ran (job kinds and drawn spaces are the frozen
 * plan's; resolveIdea only re-points slots). */
function lessonOf(input:FrozenInput,sel:EngineSelection):LessonSpec|null{
 const p=input.sides[sel.side??0]?.plans.find(p=>(p.plan as {id?:string}).id===sel.planId||p.key===sel.planId);
 return (p?.plan as {lesson?:LessonSpec}|undefined)?.lesson??null;
}
/** Owner-only idea evidence: the player links its trace recorded (for the
 * faint pitch line), the engine's words for how it ended, and whether it
 * played out as drawn (lib/ballers/idea-run.ts; as in the Lab, a named start
 * with no trace at all is 'broke'). */
function ideaDetail(sel:EngineSelection,idx:(id:string|undefined)=>number,run:IdeaRun|null){
 const links:[number,number,number][]=[];
 for(const e of sel.trace??[]){
  const a=idx(e.actor);if(a<0)continue;
  const link:[number,number,number]=[ms(e.time),a,idx(e.target)],last=links.at(-1);
  if(last&&last[1]===link[1]&&last[2]===link[2])continue;
  links.push(link);if(links.length>=30)break;
 }
 return {...(links.length?{links}:{}),...(sel.endDetail?{why:sel.endDetail.slice(0,240)}:{}),...(run?{run}:{})};
}

/** The engine's substitutionNotes per side, each with the order it came from. */
function subNotes(input:FrozenInput,notes:SubstitutionNote[]|undefined){
 if(!notes?.length)return [];
 return ([0,1] as const).flatMap(side=>{
  const mine=notes.filter(n=>n.side===side);if(!mine.length)return [];
  return [{side,notes:mine.map(n=>{const o=input.sides[side].substitutions?.find(q=>q.id===n.order);
   return {...n,...(o?{trigger:o.trigger,...(o.notBefore!==undefined?{notBefore:o.notBefore}:{})}:{})};})}];
 });
}

export {ENGINE_BUILD};
