// Game plan moves (BUILD-PLAN WP2): the pure half of Teach a move, the move
// page inside a plan, Draw your own and Your moves.
//
// - A plan holds COPIES of moves (lib/ballers/plans.ts PlanMove). Adding a
//   ready-made move or a saved one copies it; editing it inside a plan changes
//   that plan's copy only. Your moves (the club's `ballers_ideas`) is the
//   library the board saves into; a copy remembers where it came from
//   (`from_move`, `from_updated_at`) so the page can offer the newer version.
// - "Who" questions are the move's parts: each names the job a player does and
//   either a flexible role (the engine binds whoever fits: the man on the ball,
//   whoever can get there first, whoever gives the best angle) or one player by
//   slot. Answering swaps slots in the lesson, exactly like the board's taker
//   swap, so nothing here is a parallel format.
// - Off the ball is a move's own standing job (`plan.standing`): one player,
//   one job, its cost. The engine follows it in a possession phase as often as
//   the move's keenness says (practice-standing.ts), never more.
// - Moves "can start anywhere" until the engine round: nothing here pretends
//   otherwise (start stays 'any').
import {validatePlans} from '../../packages/football-engine/src/index';
import type {Idea,Formation} from './league';
import {FORMATIONS} from './league';
import {MAX_MOVES,NEW_MOVE_EMPHASIS,copyMove,type Plan,type PlanMove} from './plans';
import {STARTERS} from './lab/starters';
import {oneTwoPlan,type LabPlan,type LessonJob,type LessonSpec,type Slot,type StandingInstruction,type StandingKind} from './lab/model';

export const SLOTS:readonly Slot[]=[2,3,4,5];
const copy=<T,>(v:T):T=>structuredClone(v);

// ------------------------------------------------------------------ the ready-made moves
export type Role='carrier'|'runner'|'support';
/** One "who" question: the job it asks about, and the flexible role that answers "whoever fits". */
export interface Part {id:string;ask:string;
 /** The job whose actor this part is (a start-moment job with a numbered actor). */ job:string;
 /** The flexible role offered as the first answer; absent = a player must be named. */ role?:Role}
export interface Template {key:string;name:string;
 /** The one line under the name: what it is, in the Lab's own words. */ line:string;
 plan:()=>LabPlan;parts:Part[];
 /** Words for the always-true sentence, given each part's answer as a name or null (= whoever fits). */
 sentence:(who:Record<string,string|null>)=>string}

/** "Whoever fits", in each role's own words (the engine's binding rules, practice-recognition.ts). */
export const ROLE_ANY:Record<Role,{label:string;line:string}>={
 carrier:{label:'Whoever has the ball',line:'It can start with any of them on the ball.'},
 runner:{label:'Whoever can get there first',line:'The best-placed player makes the run.'},
 support:{label:'Whoever gives the best angle',line:'The best-placed player comes to help.'},
};

export const ONE_TWO_KEY='one-two';
const starter=(key:string)=>STARTERS.find(s=>s.key===key)!;
const has=(n:string|null,any:string)=>n??any;
export const TEMPLATES:readonly Template[]=[
 {key:'starter-in-behind',name:'Ball in behind',line:starter('starter-in-behind').line,plan:starter('starter-in-behind').plan,
  parts:[{id:'runner',ask:'Who runs in behind?',job:'run',role:'runner'},{id:'passer',ask:'Who plays it?',job:'through',role:'carrier'}],
  sentence:w=>`When ${w.passer?`${w.passer} has the ball`:'you have the ball'} and ${has(w.runner,'a runner')} can get in behind, they look to slip it through to him. If it reaches him, he looks for the shot.`},
 {key:'starter-lay-off',name:'Drop short, lay it off',line:starter('starter-lay-off').line,plan:starter('starter-lay-off').plan,
  parts:[{id:'short',ask:'Who comes short?',job:'show',role:'support'},{id:'runner',ask:'Who runs on to it?',job:'go',role:'runner'}],
  sentence:w=>`${w.short?`${w.short} comes`:'One of them comes'} short for the ball. When it reaches him, ${has(w.runner,'a runner')} goes, and they look to lay it on to him for a shot.`},
 {key:'starter-drive-slip',name:'Drive and slip',line:starter('starter-drive-slip').line,plan:starter('starter-drive-slip').plan,
  parts:[{id:'driver',ask:'Who drives at them?',job:'carry',role:'carrier'},{id:'runner',ask:'Who makes the run?',job:'run',role:'runner'}],
  sentence:w=>`${w.driver?`${w.driver} carries`:'Whoever has the ball carries'} it at them while ${has(w.runner,'a runner')} runs. When he is pressed, they look to slip the runner through for a shot.`},
 {key:'starter-recycle',name:'Back, then forward',line:starter('starter-recycle').line,plan:starter('starter-recycle').plan,
  parts:[{id:'spare',ask:'Who is the spare man?',job:'drop',role:'support'},{id:'runner',ask:'Who runs?',job:'go',role:'runner'}],
  sentence:w=>`${w.spare?`${w.spare} drops`:'One of them drops'} behind the ball to take it back. When it reaches him, ${has(w.runner,'a runner')} goes on the far side, and they look to find him for a shot.`},
 {key:ONE_TWO_KEY,name:'Repeated one-two',line:'Two players pass and go for the return, again and again, until a shot opens or it breaks.',
  plan:()=>({...oneTwoPlan(3,5,'#3','#5',.8),id:ONE_TWO_KEY,name:'Repeated one-two'}),
  parts:[{id:'a',ask:'Who starts it?',job:'pair'},{id:'b',ask:'Who is his partner?',job:'pair'}],
  sentence:w=>`${w.a??'One of them'} and ${w.b??'his partner'} look to pass and go for the return, again and again, until a shot opens or the move breaks.`},
];
export const templateOf=(key:string)=>TEMPLATES.find(t=>t.key===key);

// ------------------------------------------------------------------ reading a move
export const isRoutine=(plan:unknown)=>!!(plan as {lesson?:{scene?:unknown}}|null)?.lesson?.scene;
export const lessonOf=(plan:unknown)=>(plan as {lesson?:LessonSpec}|null)?.lesson??null;
/** The board can open it (a lesson the engine accepts). Anything else is "Drawn on the old board". */
export function boardPlan(plan:unknown):LabPlan|null{
 try{const p=validatePlans([plan])[0] as LabPlan;return p.lesson?p:null;}catch{return null;}
}
const isOneTwo=(l:LessonSpec)=>l.jobs.length===1&&!!l.jobs[0].repeat&&typeof l.jobs[0].actor==='number'&&typeof l.jobs[0].recipient==='number';
/** The template a move was taken from, when its plan still has that shape. */
export function templateFor(m:{key?:string;plan:unknown}):Template|undefined{
 const id=(m.plan as {id?:string})?.id??m.key,l=lessonOf(m.plan);if(!l)return undefined;
 const fromKey=TEMPLATES.find(t=>t.key===id);
 if(fromKey)return fromKey;
 if(isOneTwo(l))return templateOf(ONE_TWO_KEY);
 // A copy keeps the template's job ids (copyMove only renames the plan).
 return TEMPLATES.find(t=>t.key!==ONE_TWO_KEY&&t.parts.every(p=>l.jobs.some(j=>j.id===p.job&&typeof j.actor==='number'))&&l.jobs.length===(t.plan().lesson.jobs.length));
}

const ASK:Record<LessonJob['kind'],string>={pass:'Who plays the pass?',advance:'Who carries it?',shoot:'Who shoots?',run:'Who makes the run?',offer:'Who comes for the ball?',hold:'Who holds the space?',occupy:'Who pins a defender?'};
const BALL:readonly LessonJob['kind'][]=['pass','advance','shoot'];
/** The one or two "who" questions of any move: a template's own, else the first
 * on-the-ball job and the first job off it, from the start of the move. A
 * routine asks none (its spots are its players). */
export function partsOf(m:{key?:string;plan:unknown}):Part[]{
 const l=lessonOf(m.plan);if(!l||l.scene)return [];
 const t=templateFor(m);if(t)return t.parts;
 const start=l.moments.find(x=>x.cue.kind==='start')?.id;
 const jobs=l.jobs.filter(j=>j.momentId===start&&typeof j.actor==='number');
 const out:Part[]=[],seen=new Set<number>();
 const pick=(j:LessonJob|undefined,role:Role)=>{if(!j||seen.has(j.actor as number))return;seen.add(j.actor as number);
  const cur=l.roles?.[j.actor as Slot];
  // "Whoever fits" is offered when the move already uses that role here, or when nobody else holds it.
  const free=cur===role||!Object.values(l.roles??{}).includes(role)||role!=='carrier';
  out.push({id:`job:${j.id}`,ask:ASK[j.kind],job:j.id,...(free?{role}:{})});};
 pick(jobs.find(j=>BALL.includes(j.kind)),'carrier');
 const off=jobs.find(j=>!BALL.includes(j.kind)&&!seen.has(j.actor as number));
 pick(off,off?.kind==='run'?'runner':'support');
 return out;
}

export type Answer='any'|Slot;
/** Which slot plays this part right now. */
export function partSlot(plan:LabPlan,p:Part):Slot|null{
 const l=plan.lesson;
 if(p.job==='pair'){const j=l.jobs[0];const n=p.id==='a'?j?.actor:j?.recipient;return typeof n==='number'?n as Slot:null;}
 const j=l.jobs.find(x=>x.id===p.job);return typeof j?.actor==='number'?j.actor as Slot:null;
}
/** The part's answer as stored: its role (whoever fits) or one player. */
export function partAnswer(plan:LabPlan,p:Part):Answer{
 const s=partSlot(plan,p);if(s===null)return 'any';
 return p.role&&plan.lesson.roles?.[s]===p.role?'any':s;
}

/** Swap two outfield slots everywhere in a move (its jobs, partners, cues,
 * entries, anchored spaces, roles, scene and off-the-ball jobs). Mutates. */
export function swapSlots(plan:LabPlan,a:Slot,b:Slot){
 if(a===b)return;
 const l=plan.lesson,sw=<T,>(n:T):T=>(n===a?b:n===b?a:n) as T;
 for(const j of l.jobs){j.actor=sw(j.actor);if(typeof j.recipient==='number')j.recipient=sw(j.recipient);if(typeof j.teammate==='number')j.teammate=sw(j.teammate);}
 for(const m of l.moments){
  if(m.cue.kind==='pressed')m.cue.actor=sw(m.cue.actor);
  if(m.entry){m.entry.carrier=sw(m.entry.carrier);for(const c of m.entry.conditions){const r=c as {runner?:unknown};if(typeof r.runner==='number')r.runner=sw(r.runner);}
   if(m.entry.receiverBindings)for(const k of Object.keys(m.entry.receiverBindings))m.entry.receiverBindings[k]=sw(m.entry.receiverBindings[k]);}
 }
 for(const s of l.spaces)if(s.anchor?.kind==='player')s.anchor.number=sw(s.anchor.number);
 if(l.roles){const r:typeof l.roles={};for(const [n,v] of Object.entries(l.roles))r[sw(Number(n) as Slot)]=v;l.roles=r;}
 if(l.scene){l.scene.taker=sw(l.scene.taker);for(const q of l.scene.spots)q.number=sw(q.number);}
 for(const j of plan.standing??[])j.actor=sw(j.actor);
}
/** Where each slot of `from` went in `to`, when `to` is `from` with "who" answers applied
 * (answering swaps slots, so the jobs say it): slot in `from` → slot in `to`. Slots no job
 * names close their cycle, so the result is always a whole permutation of 1-5. */
export function slotsMoved(from:LabPlan,to:LabPlan):Record<number,number>{
 const m:Record<number,number>={},taken=new Set<number>();
 for(const j of from.lesson.jobs){const k=to.lesson.jobs.find(x=>x.id===j.id);if(!k)continue;
  for(const f of ['actor','recipient','teammate'] as const){const a=j[f],b=k[f];
   if(typeof a==='number'&&typeof b==='number'&&!(a in m)&&!taken.has(b)){m[a]=b;taken.add(b);}}}
 const by=new Map(Object.entries(m).map(([a,b])=>[b,Number(a)]));
 for(const n of [1,2,3,4,5]){if(n in m)continue;
  // follow the chain back to a slot nobody moved into
  let x=n;for(let i=0;i<5&&by.has(x);i++)x=by.get(x)!;
  m[n]=taken.has(x)?n:x;taken.add(m[n]);by.set(m[n],n);}
 return m;
}
/** The move with one part answered. Returns a new plan; the engine's own checks apply on save. */
export function answerPart(plan:LabPlan,p:Part,answer:Answer):LabPlan{
 const out=copy(plan),l=out.lesson,s=partSlot(out,p);
 if(s===null)return out;
 if(p.job==='pair'){
  if(answer==='any')return out;
  const j=l.jobs[0],other=(p.id==='a'?j.recipient:j.actor) as Slot;
  if(answer===other){j.actor=j.recipient as Slot;j.recipient=s;}else if(p.id==='a')j.actor=answer;else j.recipient=answer;
  return out;
 }
 if(answer==='any'){if(p.role){l.roles??={};
  // The carrier role is one player's at a time: whoever held it gives it up.
  if(p.role==='carrier')for(const [n,v] of Object.entries(l.roles))if(v==='carrier'&&Number(n)!==s)delete l.roles[Number(n) as Slot];
  l.roles[s]=p.role;}return out;}
 swapSlots(out,s,answer);
 if(l.roles){delete l.roles[answer];if(!Object.keys(l.roles).length)delete l.roles;}
 return out;
}

/** The sentence under the clip: what they look for (never that it happens). */
export function moveSentence(m:{key?:string;plan:unknown},name:(slot:number)=>string):string{
 const plan=boardPlan(m.plan);if(!plan)return 'Drawn on the old board.';
 const l=plan.lesson;
 if(l.scene)return 'Played at the restart it was drawn for. Your players take their spots, then the taker looks for the delivery you drew.';
 const t=templateFor(m);
 const named=(p:Part)=>{const a=partAnswer(plan,p);return a==='any'?null:name(a);};
 if(t)return t.sentence(Object.fromEntries(t.parts.map(p=>[p.id,named(p)])));
 const start=l.moments.find(x=>x.cue.kind==='start')?.id,jobs=l.jobs.filter(j=>j.momentId===start);
 if(!jobs.length)return plan.standing?.length?'No jobs with the ball: only the job off the ball below.':'Nothing drawn yet.';
 const who=(j:LessonJob)=>typeof j.actor==='number'?(l.roles?.[j.actor as Slot]?{carrier:'whoever has the ball',runner:'a runner',support:'a team-mate'}[l.roles[j.actor as Slot]!]:name(j.actor)):'the receiver';
 const verb:Record<LessonJob['kind'],string>={pass:'looks for a pass',advance:'carries it forward',shoot:'looks for the shot',run:'runs into space',offer:'comes for the ball',hold:'holds his space',occupy:'pins a defender'};
 const parts=jobs.slice(0,3).map(j=>`${who(j)} ${j.repeat?'looks for a one-two':verb[j.kind]}`);
 const said=parts.length>1?`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`:parts[0];
 return `When the chance comes up, ${said}${l.moments.length>1?`, then ${l.moments.length-1===1?'one more step':`${l.moments.length-1} more steps`} as you drew them`:''}.`;
}

// ------------------------------------------------------------------ off the ball (the move's own job)
export type OffKind=StandingKind;
/** Each kind with its honest cost. The engine follows it while this move is in the plan, in a
 * possession phase as often as How keen says, and never over receiving the ball or getting his breath. */
export const OFF_KINDS:Record<OffKind,{label:string;line:string;zone:boolean;defending:boolean}>={
 press:{label:'Presses the man on the ball',line:'Their man on the ball gets less time, but yours leaves his own man to do it.',zone:false,defending:true},
 mark:{label:'Marks one of theirs',line:'That man is followed closely, but your shape bends to follow him.',zone:false,defending:true},
 protect:{label:'Guards a zone',line:'That area stays covered, but he won’t chase a runner out of it.',zone:true,defending:false},
 'stay-forward':{label:'Stays up as an outlet',line:'You have someone to find when you win it back, but you defend with one fewer.',zone:true,defending:false},
};
export const offJobs=(plan:unknown):StandingInstruction[]=>((plan as {standing?:StandingInstruction[]})?.standing??[]);
/** "When we defend" / "All game": what the engine's phase means. */
export const offWhen=(j:Pick<StandingInstruction,'phase'>)=>j.phase==='always'?'all game, without the ball and with it':'when you defend';
/** Give one player one job off the ball (null clears it). Mutates a copy; the zone, when it has one,
 * starts where the board would put it: deep for Guard, up front on his side for Stay up. */
export function withOffJob(plan:LabPlan,job:{slot:Slot;kind:OffKind;opponent?:Slot;phase?:'defending'|'always'}|null,uid:()=>string,poseY=0):LabPlan{
 const out=copy(plan),before=offJobs(plan);
 // One job for one player on this page: it replaces the move's one job. A move
 // carrying several keeps the others (those are changed on the board).
 out.standing=before.length<=1?[]:(out.standing??[]).filter(j=>!job||j.actor!==job.slot);
 // Drop zones that no job or step uses any more.
 const usedSpace=(id:string)=>out.lesson.jobs.some(j=>j.spaceId===id)||out.standing!.some(j=>j.spaceId===id)||out.lesson.moments.some(m=>m.entry?.conditions.some(c=>(c as {spaceId?:string}).spaceId===id));
 if(job){
  const prev=before.find(j=>j.actor===job.slot);
  const next:StandingInstruction={id:prev?.id??uid(),actor:job.slot,kind:job.kind,phase:OFF_KINDS[job.kind].defending?'defending':job.phase??(job.kind==='stay-forward'?'always':'defending')};
  if(job.kind==='mark')next.opponent=job.opponent??5;
  if(OFF_KINDS[job.kind].zone){
   // The same kind keeps its zone where it was placed; a new kind starts from the default spot.
   if(prev?.kind===job.kind&&prev.spaceId&&out.lesson.spaces.some(s=>s.id===prev.spaceId))next.spaceId=prev.spaceId;
   else{const at=job.kind==='protect'?{x:10,y:0}:{x:39,y:poseY},id=uid();
    out.lesson.spaces.push({id,name:job.kind==='protect'?'His zone':'Up front',x:at.x,y:at.y,radius:3.5});next.spaceId=id;}
  }
  out.standing.push(next);
 }
 out.lesson.spaces=out.lesson.spaces.filter(s=>usedSpace(s.id));
 if(!out.standing.length)delete out.standing;
 return out;
}
export const ZONE_SIZES=[{id:'tight',label:'Tight',radius:2.5},{id:'normal',label:'Normal',radius:3.5},{id:'wide',label:'Wide',radius:5}] as const;
export const zoneSize=(radius:number)=>ZONE_SIZES.reduce((a,b)=>Math.abs(b.radius-radius)<Math.abs(a.radius-radius)?b:a);

/** A position in the plan's formation: an order follows the man who plays there. */
export const positionOf=(f:Formation,slot:number)=>FORMATIONS[f].slots[slot-1]??`#${slot}`;

// ------------------------------------------------------------------ copies into a plan
/** A ready-made move as a fresh copy for a plan, drawn for this five. */
export function templateMove(t:Template,lineup:string[],id?:string):PlanMove{
 const plan=t.plan();
 return copyMove({name:t.name,plan:plan as unknown as PlanMove['plan'],lineup:[...lineup],emphasis:NEW_MOVE_EMPHASIS},id);
}
/** One of Your moves as a fresh copy (keeps its own five and keenness; remembers where it came from). */
export function ideaMove(idea:Pick<Idea,'id'|'name'|'plan'|'lineup'|'updated_at'>,id?:string):PlanMove{
 const e=(idea.plan as {emphasis?:unknown}).emphasis,emphasis=typeof e==='number'&&e>=0&&e<=1?Math.round(e*100):100;
 return {...copyMove({name:idea.name.slice(0,60)||'My move',plan:copy(idea.plan) as PlanMove['plan'],lineup:[...idea.lineup],emphasis},id),from_move:idea.id,from_updated_at:idea.updated_at};
}
/** The saved move has a NEW VERSION since this copy was taken: saved later AND drawn
 * differently. A rename is not a new version (the name is the copy's own), and neither is a
 * save that drew the same thing (FIX-ROUND A9). */
export const savedIsNewer=(m:Pick<PlanMove,'from_updated_at'|'plan'>,idea:Pick<Idea,'updated_at'|'plan'>|undefined)=>
 !!idea&&!!m.from_updated_at&&Date.parse(idea.updated_at)>Date.parse(m.from_updated_at)&&!sameMove(idea.plan,m.plan);
/** The plan's copy brought up to the saved move's version (keeps its id, key, name, keenness and
 * start). The copy's own answers come along where they still fit: each "who" question the new
 * version still asks keeps this copy's answer, and its job off the ball stays when the new
 * version has none of its own. */
export function refreshFromSaved(m:PlanMove,idea:Pick<Idea,'id'|'name'|'plan'|'lineup'|'updated_at'>):PlanMove{
 let plan={...copy(idea.plan),id:m.key} as PlanMove['plan'];
 const was=boardPlan(m.plan),now=boardPlan(plan);
 if(was&&now){
  let next=now;
  const before=partsOf({key:m.key,plan:m.plan});
  for(const p of partsOf({key:m.key,plan:next})){
   const old=before.find(q=>q.job===p.job&&q.id===p.id);if(!old)continue;
   const a=partAnswer(was,old);if(a!==partAnswer(next,p))next=answerPart(next,p,a);
  }
  if(!offJobs(next).length&&offJobs(was).length){
   const keep=offJobs(was),spaces=was.lesson.spaces.filter(z=>keep.some(j=>j.spaceId===z.id)&&!next.lesson.spaces.some(y=>y.id===z.id));
   next={...next,standing:copy(keep),lesson:{...next.lesson,spaces:[...next.lesson.spaces,...copy(spaces)]}};
  }
  plan={...next,id:m.key} as unknown as PlanMove['plan'];
 }
 return {...m,plan,lineup:[...idea.lineup],from_move:idea.id,from_updated_at:idea.updated_at};
}

export class MovesFull extends Error{constructor(){super('max_3_moves');}}
/** The plan's moves with `move` added; `out` names the one it replaces when the plan is full. */
export function addTo(moves:readonly PlanMove[],move:PlanMove,out?:string):PlanMove[]{
 const at=out?moves.findIndex(m=>m.id===out):-1;
 if(at>=0){const next=[...moves];next[at]=move;return next;}
 if(moves.length>=MAX_MOVES)throw new MovesFull();
 return [...moves,move];
}
export const isFull=(p:Pick<Plan,'moves'>)=>p.moves.length>=MAX_MOVES;
/** The plan's copy replaced by an edited one (same id). */
export const replaceIn=(moves:readonly PlanMove[],move:PlanMove)=>moves.map(m=>m.id===move.id?move:m);
/** Undo of ONE change to a copy: only the fields that change touched go back to how they
 * were, on the copy as it is now, so a keenness picked after it (or any other later edit)
 * stays (FIX-ROUND A9: Undo never reverts two changes at once). */
export function undoChange(now:PlanMove,before:PlanMove,after:PlanMove):PlanMove{
 const out={...now} as Record<string,unknown>,b=before as unknown as Record<string,unknown>,a=after as unknown as Record<string,unknown>;
 for(const k of ['name','plan','lineup','from_move','from_updated_at'])if(stable(b[k])!==stable(a[k])){if(b[k]===undefined)delete out[k];else out[k]=b[k];}
 return out as unknown as PlanMove;
}

// ------------------------------------------------------------------ Your moves
export const MAX_SAVED=12;
/** Plans holding a copy of this saved move, by name, in list order. */
export const plansWith=(ideaId:string,plans:readonly Pick<Plan,'name'|'moves'>[])=>plans.filter(p=>p.moves.some(m=>m.from_move===ideaId)).map(p=>p.name);
export const inPlansLine=(names:readonly string[])=>names.length?`In ${names.join(', ')}`:'Not in a plan';
/** Your moves split: the ones the board opens, and the ones drawn on the old board (kept, read-only). */
export function shelves<I extends Pick<Idea,'plan'>>(ideas:readonly I[]){
 const board:(I&{lab:LabPlan})[]=[],old:I[]=[];
 for(const i of ideas){const p=boardPlan(i.plan);if(p)board.push({...i,lab:p});else old.push(i);}
 return {board,old};
}
/** A short line for a saved move: kind, steps, who is named, off the ball. */
export function moveMeta(plan:LabPlan,name:(slot:number)=>string):string{
 const l=plan.lesson,steps=l.moments.length,sc=l.scene;
 const restart=sc?{corner:'Corner',freeKick:'Free kick',throw:'Throw-in',goalKick:'Goal kick'}[sc.restart]:null;
 const who=[...new Set(l.jobs.flatMap(j=>typeof j.actor==='number'&&!l.roles?.[j.actor as Slot]?[name(j.actor)]:[]))].filter(Boolean);
 return [restart,`${steps} ${steps===1?'step':'steps'}`,!sc&&who.length?who.slice(0,3).join(', '):null,plan.standing?.length?`${plan.standing.length} off the ball`:null].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------------ the [move] in a move page's URL
export type MoveRef={kind:'plan';move:PlanMove}|{kind:'template';template:Template}|{kind:'saved';idea:Idea}|{kind:'gone'};
export const savedParam=(ideaId:string)=>`saved-${ideaId}`;
/** A plan's own copy wins; then a ready-made move by key; then one of Your moves (`saved-<id>`). */
export function resolveMove(param:string,plan:Pick<Plan,'moves'>,ideas:readonly Idea[]):MoveRef{
 const own=plan.moves.find(m=>m.id===param);if(own)return {kind:'plan',move:own};
 const t=templateOf(param);if(t)return {kind:'template',template:t};
 if(param.startsWith('saved-')){const idea=ideas.find(i=>i.id===param.slice(6));if(idea)return {kind:'saved',idea};}
 return {kind:'gone'};
}

// ------------------------------------------------------------------ the board's draft
/** What the board on this device is drawing, so a reload (or another tab) lands back on it. */
export interface DrawTarget {plan:string;
 /** Editing this plan's copy. */ move?:string;
 /** Started from a ready-made move or one of Your moves (its key). */ from?:string}
export const drawTargetKey=(club:string)=>`ballers:${club}:gp-draw-target`;
/** The editor's own draft namespace for the new board (kept apart from today's Lab). */
export const drawEditorKey=(club:string)=>`${club}:gp`;
export const sameTarget=(a:DrawTarget|null,b:DrawTarget|null)=>!!a&&!!b&&a.plan===b.plan&&(a.move??'')===(b.move??'')&&(a.from??'')===(b.from??'');
/** Same content, whatever order jsonb gave the keys back in. */
export const stable=(v:unknown):string=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).filter(k=>(v as Record<string,unknown>)[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${stable((v as Record<string,unknown>)[k])}`).join(',')}}`:JSON.stringify(v)??'null';
/** Two plans are the same move, keenness aside (the plan stores keenness on the copy). */
export const sameMove=(a:unknown,b:unknown)=>{const strip=(p:unknown)=>{const {emphasis:_e,id:_i,name:_n,...rest}=(p??{}) as Record<string,unknown>;return stable(rest);};return strip(a)===strip(b);};
