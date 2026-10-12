// The Lab's idea model (P6 L1): the pure helpers of the tactics sandbox
// (deliverables/football-practice/engine-audition/sandbox.js), typed and
// freed from the DOM and from the sandbox's global `state`. Every function
// takes the plan (or its lesson) and an explicit context instead.
//
// Semantics are the sandbox's, line for line: verificare/ballers-lab.test.ts
// runs the real sandbox.js functions beside these on the same plans (golden).
// Editing helpers MUTATE the draft they are given, as the sandbox's edit()
// callbacks do; the editor clones before every edit (lib/ballers/lab/editor.ts).
// The stored plan format is the engine's PlaybookPlan, unchanged, so ideas
// saved by the old Lab keep working.
import type {LessonSpec,LessonJob,LessonMoment,LessonSpace,LessonCue,PlaybookPlan,TrainingSetup,RecognisedEntry,LessonScene,SceneRestart} from '../../../packages/football-engine/src/practice-playbook';
import type {StandingInstruction} from '../../../packages/football-engine/src/practice-standing';
import type {ActionActor,TeachingNumber} from '../../../packages/football-engine/src/practice-teaching';

export type {LessonSpec,LessonJob,LessonMoment,LessonSpace,LessonCue,TrainingSetup,RecognisedEntry,StandingInstruction,LessonScene,SceneRestart};
export type Slot=TeachingNumber;
export type Actor=ActionActor;
export type JobKind=LessonJob['kind'];
export type Scene=TrainingSetup['scene'];
export type Pose=TrainingSetup['poses'][number]&{ghost?:boolean};
/** A board idea: the engine plan with a lesson (standing instructions optional). */
export type LabPlan=PlaybookPlan&{lesson:LessonSpec;standing?:StandingInstruction[]};
export type Uid=()=>string;

export const SLOTS:readonly Slot[]=[2,3,4,5];
export const JOB_KINDS:readonly JobKind[]=['advance','offer','run','occupy','pass','shoot','hold'];
export const MAX_SPACES=8,MAX_MOMENTS=8,MAX_JOBS=12,MAX_STANDING=4,UNDO_DEPTH=30;
/** Pitch bounds the board clamps drawn points to (engine metres). */
export const BOUNDS={x0:.8,x1:47.2,y0:-14,y1:14};

export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const copy=<T>(v:T):T=>structuredClone(v);
export const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export const makeUid=():Uid=>()=>`c-${crypto.randomUUID()}`;

/** Where the editor is and what it knows about the start: the ball owner's
 * slot and, when the recognition preview has run, the entry it found. */
export interface Ctx {ballNumber:number;rec?:RecognisedEntry|null}

// ---------- identity ----------
export const jobActor=(a:Actor)=>typeof a==='number'?String(a):`receiver:${a.receiverOf}`;
export const readActor=(v:string):Actor=>v.startsWith('receiver:')?{receiverOf:v.slice(9)}:Number(v) as Slot;
export const sameActor=(a:Actor,b:Actor)=>jobActor(a)===jobActor(b);

export function freshPlan(uid:Uid,name='My idea'):LabPlan{
 return {id:uid(),name,weight:100,instructions:[],preferred:null,lesson:{spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[]}};
}
export const momentOf=(l:LessonSpec,id:string)=>l.moments.find(m=>m.id===id)??l.moments[0];
export const jobAt=(l:LessonSpec,mid:string,a:Actor)=>l.jobs.find(j=>j.momentId===mid&&jobActor(j.actor)===jobActor(a));

// ---------- the moment graph ----------
export function ancestors(l:LessonSpec,id:string,seen=new Set<string>()):string[]{
 const m=l.moments.find(m=>m.id===id);if(!m||seen.has(id)||m.cue.kind==='start')return [];seen.add(id);
 const cue=m.cue as {jobId?:string;actor?:Actor};
 const source=cue.jobId?l.jobs.find(j=>j.id===cue.jobId):l.jobs.find(j=>j.kind==='advance'&&cue.actor!==undefined&&jobActor(j.actor)===jobActor(cue.actor)&&j.momentId!==id);
 const parent=source?.momentId??l.moments.find(m=>m.cue.kind==='start')?.id;return parent?[...ancestors(l,parent,seen),parent]:[];
}
export function ancestorJobs(l:LessonSpec,id:string){const map=new Map<string,LessonJob>();for(const mid of ancestors(l,id))for(const j of l.jobs.filter(j=>j.momentId===mid))map.set(jobActor(j.actor),j);return [...map.values()];}
/** A continuation edits only what changes: movement jobs from earlier moments carry on. */
export function inheritedJob(l:LessonSpec,mid:string,a:Actor){if(momentOf(l,mid).entry)return undefined;return ancestorJobs(l,mid).find(j=>jobActor(j.actor)===jobActor(a)&&!['pass','shoot'].includes(j.kind));}
export const displayedJob=(l:LessonSpec,mid:string,a:Actor)=>jobAt(l,mid,a)??inheritedJob(l,mid,a);
/** Everyone's job in a moment: its own, then what carries on from before. */
export function effectiveJobs(l:LessonSpec,mid:string){
 const current=l.jobs.filter(j=>j.momentId===mid),old=l.moments.find(m=>m.id===mid)?.entry?[]:ancestorJobs(l,mid);
 return [...current,...old.filter(j=>!['pass','shoot'].includes(j.kind)&&!current.some(q=>jobActor(q.actor)===jobActor(j.actor)))];
}
/** Turn an inherited job into this moment's own copy (so it can change here). */
export function localJob(l:LessonSpec,mid:string,a:Actor,uid:Uid){let j=jobAt(l,mid,a);if(!j){const previous=inheritedJob(l,mid,a);if(previous){j={...copy(previous),id:uid(),momentId:mid};l.jobs.push(j);}}return j;}

export function intendedReceiver(l:LessonSpec,pass:LessonJob|undefined):Actor|null{
 if(!pass)return null;if(typeof pass.recipient==='number')return pass.recipient;
 if(!pass.spaceId)return null;
 const runners=effectiveJobs(l,pass.momentId).filter(j=>j.kind==='run'&&j.spaceId===pass.spaceId&&jobActor(j.actor)!==jobActor(pass.actor));
 return runners.length===1?runners[0].actor:null;
}
export function receiverSlot(l:LessonSpec,pass:LessonJob|undefined,seen=new Set<string>()):number|null{
 if(!pass||seen.has(pass.id))return null;seen.add(pass.id);const receiver=intendedReceiver(l,pass);
 return typeof receiver==='number'?receiver:receiver?receiverSlot(l,l.jobs.find(j=>j.id===receiver.receiverOf),seen):null;
}
/** Who should have the ball when this moment begins, as drawn. */
export function plannedCarrier(l:LessonSpec,mid:string,ballNumber:number,seen=new Set<string>()):number|null{
 if(seen.has(mid))return null;seen.add(mid);const m=l.moments.find(m=>m.id===mid);
 if(m?.entry)return m.entry.carrier;if(m?.cue.kind==='start')return ballNumber;
 const pass=l.jobs.find(j=>j.id===(m?.cue as {jobId?:string}|undefined)?.jobId);
 if(m?.cue.kind==='received')return receiverSlot(l,pass);
 return pass?plannedCarrier(l,pass.momentId,ballNumber,seen):null;
}

// ---------- who is who on the board ----------
/** A plan slot's actual shirt: the recognition's binding, else the slot itself unless a role frees it. */
export function boundNumber(n:number,l:LessonSpec,rec?:RecognisedEntry|null):number|null{return rec?.bindings?.[n]??(l.roles?.[n as Slot]?null:Number(n));}
export function slotForNumber(n:number,rec?:RecognisedEntry|null){const bindings=rec?.bindings??{};return Number(Object.keys(bindings).find(slot=>bindings[slot]===n)??n) as Slot;}
export function actorSlot(a:Actor,l:LessonSpec,mid:string,ballNumber:number):number{
 if(typeof a==='number')return a;const binding=momentOf(l,mid).entry?.receiverBindings?.[a.receiverOf];if(binding)return binding;
 const source=l.jobs.find(j=>j.id===a.receiverOf);return receiverSlot(l,source)??ballNumber;
}
export function actorNumber(a:Actor,l:LessonSpec,mid:string,ctx:Ctx):number{
 if(typeof a!=='number'&&ctx.rec?.receiverBindings?.[a.receiverOf])return ctx.rec.receiverBindings[a.receiverOf];
 const slot=actorSlot(a,l,mid,ctx.ballNumber);return boundNumber(slot,l,ctx.rec)??slot;
}

// ---------- spaces (circles, optionally anchored to a player) ----------
export function referencePose(anchor:NonNullable<LessonSpace['anchor']>,poses:Pose[],l:LessonSpec,rec?:RecognisedEntry|null){
 const n=anchor.kind==='opponent'?anchor.number:boundNumber(anchor.number,l,rec)??anchor.number;
 return poses.find(p=>p.side===(anchor.kind==='opponent'?1:0)&&p.number===n);
}
/** Where a space sits for these poses (an anchored space follows its reference). */
export function resolvedSpace(s:LessonSpace,l:LessonSpec,poses:Pose[],rec?:RecognisedEntry|null):LessonSpace{
 if(!s.anchor)return s;const ref=referencePose(s.anchor,poses,l,rec);if(!ref)return s;
 return {...s,x:ref.x+s.anchor.dx,y:ref.y+s.anchor.dy};
}
export function setSpacePoint(s:LessonSpace,p:{x:number;y:number},l:LessonSpec,poses:Pose[],rec?:RecognisedEntry|null){Object.assign(s,p);if(s.anchor){const ref=referencePose(s.anchor,poses,l,rec);if(ref){s.anchor.dx=p.x-ref.x;s.anchor.dy=p.y-ref.y;}}}
/** Reuse an unlinked space, else draw a new one (max 8). Returns its id. */
export function addSpace(plan:LabPlan,point:{x:number;y:number},uid:Uid,label=(n:number)=>`Space ${n}`){
 const l=plan.lesson;
 let s=l.spaces.find(s=>!l.jobs.some(j=>j.spaceId===s.id)&&!plan.standing?.some(j=>j.spaceId===s.id)&&!l.moments.some(m=>m.entry?.conditions.some(c=>(c as {spaceId?:string}).spaceId===s.id)));
 if(s){delete s.anchor;Object.assign(s,point);return s.id;}
 if(l.spaces.length>=MAX_SPACES)throw Error('You already have eight spaces. Pick one of them.');
 s={id:uid(),name:label(l.spaces.length+1),x:point.x,y:point.y,radius:3.5};l.spaces.push(s);return s.id;
}
/** Point a job at a space (clears a named partner and the one-two). */
export function setSpace(j:LessonJob,id:string){delete j.repeat;delete j.recipient;j.spaceId=id;}
export function linkPassToRunner(pass:LessonJob,runner:LessonJob){setSpace(pass,runner.spaceId!);if(typeof runner.actor==='number')pass.recipient=runner.actor;}
/** Re-anchor a space: 'fixed', 'player:n' or 'opponent:n', keeping it where it is now. */
export function setSpaceAnchor(s:LessonSpace,next:string,l:LessonSpec,poses:Pose[],rec?:RecognisedEntry|null){
 const p=resolvedSpace(s,l,poses,rec);
 if(next==='fixed'){delete s.anchor;Object.assign(s,{x:p.x,y:p.y});return;}
 const [kind,n]=next.split(':'),anchor={kind:kind as 'player'|'opponent',number:Number(n) as Slot,dx:0,dy:0},ref=referencePose(anchor,poses,l,rec);
 s.anchor={...anchor,dx:p.x-(ref?.x??p.x),dy:p.y-(ref?.y??p.y)};Object.assign(s,{x:p.x,y:p.y});
}
export const spaceUses=(plan:LabPlan,id:string)=>[...plan.lesson.jobs,...(plan.standing??[])].filter(j=>j.spaceId===id).length;

// ---------- editing jobs and moments (mutating a draft) ----------
/** What the board asks the member to point at next, after choosing a job. */
export type Picking=null|'space'|'pass'|'opponent'|'new-space'|`standing:${string}`;
export const pickingFor=(kind:JobKind):Picking=>['advance','run','hold'].includes(kind)?'space':kind==='pass'?'pass':kind==='occupy'?'opponent':null;

export interface Choice {changed:boolean;space:string|null;picking:Picking}
/** Give the selected actor a job of this kind in the moment (sandbox chooseKind).
 * The same kind again only re-arms the picker. `origin` is the actor's pose. */
export function chooseKind(plan:LabPlan,mid:string,a:Actor,kind:JobKind,origin:{x:number;y:number},opponents:Pose[],uid:Uid):Choice{
 const l=plan.lesson,existing=jobAt(l,mid,a),shown=displayedJob(l,mid,a);
 if(shown?.kind===kind)return {changed:false,space:shown.spaceId??null,picking:pickingFor(kind)};
 const j:LessonJob={id:existing?.id??uid(),momentId:mid,actor:copy(a),kind};
 if(kind==='advance'||kind==='run')j.spaceId=shown?.spaceId??addSpace(plan,{x:clamp(origin.x+8,.8,47.2),y:origin.y},uid);
 if(kind==='offer')j.teammate='carrier';
 if(kind==='occupy')j.opponent=opponents.filter(p=>p.side===1&&p.number!==1).sort((a,b)=>dist(a,origin)-dist(b,origin))[0].number as Slot;
 if(kind==='pass'){j.recipient='free';j.delivery='auto';j.fallback=true;}
 if(kind==='hold'&&shown?.spaceId)j.spaceId=shown.spaceId;
 if(existing)l.jobs[l.jobs.indexOf(existing)]=j;else l.jobs.push(j);
 return {changed:true,space:j.spaceId??null,picking:pickingFor(kind)};
}
/** Remove jobs and everything that depends on them: receivers' jobs, and moments cued by them. */
export function removeJobs(l:LessonSpec,ids:string[]){
 const removed=new Set(ids);let changed=true;
 while(changed){changed=false;for(const j of l.jobs)if(!removed.has(j.id)&&typeof j.actor!=='number'&&removed.has(j.actor.receiverOf)){removed.add(j.id);changed=true;}
  for(const m of l.moments){const jobId=(m.cue as {jobId?:string}).jobId;if(jobId&&removed.has(jobId)){for(const j of l.jobs.filter(j=>j.momentId===m.id))if(!removed.has(j.id)){removed.add(j.id);changed=true;}}}}
 l.moments=l.moments.filter(m=>{const jobId=(m.cue as {jobId?:string}).jobId;return !jobId||!removed.has(jobId);});l.jobs=l.jobs.filter(j=>!removed.has(j.id));
}
export function deleteMoment(l:LessonSpec,id:string){removeJobs(l,l.jobs.filter(j=>j.momentId===id).map(j=>j.id));l.moments=l.moments.filter(m=>m.id!==id);}
/** "When X receives…": open (or create) the moment after this pass. The passer
 * offers the return; everyone else carries on. Returns the moment and who to select. */
export function continuePass(l:LessonSpec,pass:LessonJob,uid:Uid):{moment:string;actor:Actor;created:boolean}{
 const existing=l.moments.find(m=>m.cue.kind==='received'&&m.cue.jobId===pass.id);
 const actor=intendedReceiver(l,pass)??{receiverOf:pass.id};
 if(existing){const receiverJob=l.jobs.find(j=>j.momentId===existing.id&&typeof j.actor!=='number'&&j.actor.receiverOf===pass.id);return {moment:existing.id,actor:copy(receiverJob?.actor??actor),created:false};}
 const id=uid();l.moments.push({id,name:'After the pass arrives',cue:{kind:'received',jobId:pass.id}});
 l.jobs.push({id:uid(),momentId:id,actor:copy(pass.actor),kind:'offer',teammate:'carrier'});
 return {moment:id,actor:copy(actor),created:true};
}
/** Add a moment (or change one's cue): pressed = a slot is pressed; released /
 * received = a pass (job id) leaves / arrives. Returns who to select next. */
export function putMoment(l:LessonSpec,id:string,kind:'pressed'|'released'|'received',value:string,title:(m:LessonMoment)=>string):Actor{
 const cue:LessonCue=kind==='pressed'?{kind,actor:Number(value) as Slot}:{kind,jobId:value};
 const m:LessonMoment={id,name:'Shared moment',cue};m.name=title(m);
 const existing=l.moments.findIndex(m=>m.id===id);if(existing>=0)l.moments[existing]={...l.moments[existing],...m};else l.moments.push(m);
 const source=l.jobs.find(j=>j.id===(cue as {jobId?:string}).jobId);
 return kind==='received'&&source?{receiverOf:source.id}:kind==='pressed'?Number(value) as Slot:3;
}
/** A flexible role for a slot for the whole idea ('fixed' clears it). */
export function setRole(l:LessonSpec,slot:Slot,value:'fixed'|'carrier'|'support'|'runner'){l.roles??={};if(value==='fixed')delete l.roles[slot];else l.roles[slot]=value;}
export function freeRoles(l:LessonSpec,slot:Slot){const used=Object.entries(l.roles??{}).filter(([n])=>Number(n)!==slot).map(([,r])=>r);const current=l.roles?.[slot];return (['carrier','support','runner'] as const).filter(r=>r!=='carrier'||r===current||!used.includes(r));}

// ---------- persistent off-ball instructions ----------
export type StandingKind=StandingInstruction['kind'];
export function setStanding(plan:LabPlan,n:Slot,kind:StandingKind|'',uid:Uid,poseY:number){
 plan.standing=(plan.standing??[]).filter(q=>q.actor!==n);if(!kind)return;
 const next:StandingInstruction={id:uid(),actor:n,kind,phase:kind==='stay-forward'?'always':'defending'};
 if(kind==='mark')next.opponent=5;
 if(kind==='protect'||kind==='stay-forward')next.spaceId=addSpace(plan,kind==='protect'?{x:10,y:0}:{x:39,y:poseY},uid);
 plan.standing.push(next);
}

// ---------- the one-two preset ----------
/** The repeated one-two between two slots, as a board idea (sandbox editorPlan). */
export function oneTwoPlan(a:Slot,b:Slot,nameA:string,nameB:string,emphasis:number):LabPlan{
 return {id:`one-two-${a}-${b}`,name:`One-two · ${nameA} and ${nameB}`,weight:100,emphasis,instructions:[],preferred:null,
  lesson:{spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[{id:'pair',momentId:'start',actor:a,kind:'pass',recipient:b,repeat:true}]}};
}

// ---------- the board's poses ----------
/** Guide positions of a later moment: players with a movement job from earlier moments shown where it takes them. */
export function previewPoses(l:LessonSpec,mid:string,setup:TrainingSetup,ctx:Ctx):Pose[]{
 const poses:Pose[]=copy(setup.poses);if(l.moments.find(m=>m.id===mid)?.entry)return poses;
 for(const j of ancestorJobs(l,mid)){const raw=l.spaces.find(s=>s.id===j.spaceId),s=raw&&resolvedSpace(raw,l,poses,ctx.rec),p=poses.find(p=>p.side===0&&p.number===actorNumber(j.actor,l,mid,ctx));if(p&&s&&['advance','run','hold'].includes(j.kind))Object.assign(p,{x:s.x,y:s.y,ghost:true});}
 return poses;
}
export function hitSpace(l:LessonSpec,point:{x:number;y:number},poses:Pose[],rec?:RecognisedEntry|null){return l.spaces.filter(s=>dist(resolvedSpace(s,l,poses,rec),point)<s.radius).sort((a,b)=>dist(resolvedSpace(a,l,poses,rec),point)-dist(resolvedSpace(b,l,poses,rec),point))[0];}

// ---------- taking an idea into a lineup (match prep / practice) ----------
/** Every slot the idea names: actors, partners, cue players, entry players, anchored spaces. */
export function planSlots(l:LessonSpec,standing:StandingInstruction[]=[]){
 const slots=new Set<number>(),add=(n:unknown)=>{if(typeof n==='number')slots.add(n);};
 for(const j of l.jobs){add(j.actor);add(j.recipient);add(j.teammate);}
 for(const j of standing)add(j.actor);
 const spaces=new Set([...l.jobs,...standing].map(j=>j.spaceId));
 for(const m of l.moments){add((m.cue as {actor?:unknown}).actor);if(m.entry){add(m.entry.carrier);for(const c of m.entry.conditions){add((c as {runner?:unknown}).runner);spaces.add((c as {spaceId?:string}).spaceId);}for(const n of Object.values(m.entry.receiverBindings??{}))add(n);}}
 for(const space of l.spaces)if(spaces.has(space.id)&&space.anchor?.kind==='player')add(space.anchor.number);
 // A routine's taker and spots (the keeper, slot 1, needs no re-pointing).
 if(l.scene){if(l.scene.taker>=2)add(l.scene.taker);for(const q of l.scene.spots)add(q.number);}
 return [...slots];
}
export interface PrepIssue {slot?:number;id?:string;reason:'missing'|'duplicate'}
/** Re-point an idea drawn for `row.lineup` at `target` (slot n = lineup[n-1]).
 * `assignments` maps a slot to the player who takes its instructions over. */
export function preparedPlan(row:{plan:LabPlan;lineup:string[]},target:string[],assignments:Record<number,string>={},validate:(p:LabPlan)=>LabPlan=p=>p):{plan?:LabPlan;issues:PrepIssue[]}{
 const mapping:Record<number,number>={},issues:PrepIssue[]=[];
 for(const n of planSlots(row.plan.lesson,row.plan.standing)){const id=assignments[n]??row.lineup[n-1],slot=target.indexOf(id)+1;if(slot<2)issues.push({slot:n,id:row.lineup[n-1],reason:'missing'});else mapping[n]=slot;}
 const values=Object.values(mapping);if(new Set(values).size!==values.length)issues.push({reason:'duplicate'});
 if(issues.length)return {issues};
 const plan=copy(row.plan),l=plan.lesson,number=<T,>(n:T):T=>(typeof n==='number'?mapping[n]??n:n) as T;
 for(const j of plan.standing??[])j.actor=number(j.actor);
 for(const j of l.jobs){j.actor=number(j.actor);if(typeof j.recipient==='number')j.recipient=number(j.recipient);if(typeof j.teammate==='number')j.teammate=number(j.teammate);}
 for(const m of l.moments){if(m.cue.kind==='pressed')m.cue.actor=number(m.cue.actor);if(m.entry){m.entry.carrier=number(m.entry.carrier);for(const c of m.entry.conditions)if(typeof (c as {runner?:unknown}).runner==='number')(c as {runner:Slot}).runner=number((c as {runner:Slot}).runner);if(m.entry.receiverBindings)for(const k of Object.keys(m.entry.receiverBindings))m.entry.receiverBindings[k]=number(m.entry.receiverBindings[k]);}}
 for(const space of l.spaces)if(space.anchor?.kind==='player')space.anchor.number=number(space.anchor.number);
 if(l.roles)l.roles=Object.fromEntries(Object.entries(l.roles).map(([n,role])=>[number(Number(n)),role]));
 if(l.scene){l.scene.taker=number(l.scene.taker);for(const q of l.scene.spots)q.number=number(q.number);}
 return {plan:validate(plan),issues};
}

// ---------- checks the board shows before a trial ----------
export type Warning={kind:'carrier-run';slot:Slot}|{kind:'self-pass'}|{kind:'not-receiver';expected:number;slot:Slot};
/** Assignment warnings for the selected actor's job (sandbox renderCoach). */
export function assignmentWarning(l:LessonSpec,mid:string,a:Actor,ballNumber:number):Warning|null{
 const j=displayedJob(l,mid,a),m=momentOf(l,mid);if(!j)return null;
 const role=typeof a==='number'?l.roles?.[a]:null,expected=plannedCarrier(l,m.id,ballNumber);
 if(role==='carrier'&&j.kind==='run'&&typeof a==='number')return {kind:'carrier-run',slot:a};
 if(j.kind==='pass'&&typeof j.recipient==='number'&&j.recipient===a)return {kind:'self-pass'};
 if(['pass','shoot','advance'].includes(j.kind)&&m.cue.kind==='received'&&expected!==null&&typeof a==='number'&&a!==expected&&!role)return {kind:'not-receiver',expected,slot:a};
 return null;
}
/** The job kinds offered first: the carrier (or whoever receives) moves the ball, the rest move without it. */
export function mainKinds(isCarrier:boolean):JobKind[]{return isCarrier?['advance','pass','shoot']:['offer','run','occupy','hold'];}
export const hasContent=(plan:LabPlan)=>plan.lesson.jobs.length>0||!!plan.standing?.length||!!plan.lesson.scene;

// ---------- set-piece routines ----------
// A routine is an idea whose lesson has a `scene`: it belongs to a restart.
// Step 1 ("the set-up", the start moment) is the taker's: what he does with
// the ball. Everyone else acts from the kick (a restart-taken moment), and
// stands where the board puts him until then, roaming tight or loose.
/** How far a player may roam from his spot, in metres. */
export const LEASH={tight:1,loose:3.5} as const;
export type Roam=keyof typeof LEASH;
export const roamOf=(leash:number):Roam=>leash<=(LEASH.tight+LEASH.loose)/2?'tight':'loose';
export const kickMoment=(l:LessonSpec)=>l.moments.find(m=>m.cue.kind==='restart-taken');
/** The step a job drawn now belongs to. In a routine only the taker acts in
 * the set-up; anyone else's job goes to the kick (created when missing). */
export function routineMoment(l:LessonSpec,mid:string,a:Actor):string{
 if(!l.scene||momentOf(l,mid).cue.kind!=='start'||a===l.scene.taker)return mid;
 let k=kickMoment(l);
 if(!k){if(l.moments.length>=MAX_MOMENTS)return mid;k={id:l.moments.some(m=>m.id==='kick')?`kick-${l.moments.length}`:'kick',name:'At the kick',cue:{kind:'restart-taken'}};l.moments.splice(1,0,k);}
 return k.id;
}
/** What the taker can do with a dead ball: pass it, or shoot from a free kick. */
export const takerKinds=(r:SceneRestart):JobKind[]=>r==='freeKick'?['pass','shoot']:['pass'];
/** The scene's spots and ball, read back from the board's poses (the taker is on the ball). */
export function syncScene(l:LessonSpec,setup:TrainingSetup){
 const sc=l.scene;if(!sc)return;
 const old=new Map(sc.spots.map(q=>[q.number,q.leash]));
 sc.ball={x:setup.ball.x,y:setup.ball.y};
 sc.taker=(sc.restart==='goalKick'?1:setup.ball.number) as LessonScene['taker'];
 sc.spots=setup.poses.filter(p=>p.side===0&&p.number>=2&&p.number<=5&&p.number!==sc.taker).sort((a,b)=>a.number-b.number)
  .map(p=>({number:p.number as Slot,x:clamp(p.x,BOUNDS.x0,BOUNDS.x1),y:clamp(p.y,BOUNDS.y0,BOUNDS.y1),leash:old.get(p.number as Slot)??LEASH.loose}));
}
/** Make the lesson a routine for `scene` (or open play again with null).
 * Roles, independent entries and off-ball instructions belong to open play
 * and go; a routine's jobs of the kick return to the start without it. */
export function setRoutine(plan:LabPlan,scene:Omit<LessonScene,'spots'|'ball'|'taker'>|null,setup:TrainingSetup){
 const l=plan.lesson;
 if(!scene){
  const k=kickMoment(l);delete l.scene;
  if(k){const start=l.moments.find(m=>m.cue.kind==='start')?.id;
   l.jobs=l.jobs.filter(j=>j.momentId!==k.id||!!start&&!l.jobs.some(q=>q.momentId===start&&jobActor(q.actor)===jobActor(j.actor)));
   for(const j of l.jobs)if(j.momentId===k.id)j.momentId=start!;
   l.moments=l.moments.filter(m=>m.id!==k.id);}
  return;
 }
 delete l.roles;delete plan.standing;for(const m of l.moments)delete m.entry;
 l.scene={...scene,ball:{x:setup.ball.x,y:setup.ball.y},taker:(scene.restart==='goalKick'?1:setup.ball.number) as LessonScene['taker'],spots:l.scene?.spots??[]};
 if(!kickMoment(l))l.moments.splice(1,0,{id:l.moments.some(m=>m.id==='kick')?`kick-${l.moments.length}`:'kick',name:'At the kick',cue:{kind:'restart-taken'}});
 // The taker's own jobs stay in the set-up; everyone else's move to the kick.
 const start=l.moments.find(m=>m.cue.kind==='start')?.id,kick=kickMoment(l)!.id;
 for(const j of l.jobs)if(j.momentId===start&&j.actor!==l.scene.taker){if(l.jobs.some(q=>q!==j&&q.momentId===kick&&jobActor(q.actor)===jobActor(j.actor)))j.momentId='';else j.momentId=kick;}
 l.jobs=l.jobs.filter(j=>j.momentId);
 syncScene(l,setup);
}
/** Mirror a routine's drawing to the other flank (the ball, players, spaces). */
export function mirrorRoutine(plan:LabPlan,setup:TrainingSetup){
 for(const p of setup.poses){p.y=-p.y;p.angle=-p.angle;}setup.ball.y=-setup.ball.y;
 for(const s of plan.lesson.spaces){s.y=-s.y;if(s.anchor)s.anchor.dy=-s.anchor.dy;}
}
/** Draw the routine on flank `s`. A one-sided routine is used where it is
 * drawn, so its side follows the drawing (else it would fire on the other
 * corner, with its spots clamped onto the touchline). */
export function routineSide(plan:LabPlan,setup:TrainingSetup,s:'left'|'right'){
 const drawn=setup.ball.y<0?'left':'right';if(drawn!==s)mirrorRoutine(plan,setup);
 syncScene(plan.lesson,setup);
 const sc=plan.lesson.scene;if(sc?.side&&sc.side!=='any')sc.side=s;
}
/** Swap two players everywhere in a routine: their jobs, spots and places on
 * the board (a new taker takes over the delivery; the old one his spot). */
export function swapSlots(plan:LabPlan,setup:TrainingSetup,a:Slot,b:Slot){
 const l=plan.lesson,sw=<T,>(n:T):T=>(n===a?b:n===b?a:n) as T;
 for(const j of l.jobs){j.actor=sw(j.actor);if(typeof j.recipient==='number')j.recipient=sw(j.recipient);if(typeof j.teammate==='number')j.teammate=sw(j.teammate);}
 for(const m of l.moments)if(m.cue.kind==='pressed')m.cue.actor=sw(m.cue.actor);
 for(const s of l.spaces)if(s.anchor?.kind==='player')s.anchor.number=sw(s.anchor.number);
 if(l.scene){l.scene.taker=sw(l.scene.taker);for(const q of l.scene.spots)q.number=sw(q.number);}
 const pa=setup.poses.find(p=>p.side===0&&p.number===a),pb=setup.poses.find(p=>p.side===0&&p.number===b);
 if(pa&&pb){const {x,y,angle}=pa;Object.assign(pa,{x:pb.x,y:pb.y,angle:pb.angle});Object.assign(pb,{x,y,angle});}
 if(setup.ball.side===0)setup.ball.number=sw(setup.ball.number as Slot);
}
/** A saved routine back on the board: the engine's layout for its restart,
 * then its own players on their spots (opponents stepped off anyone they'd stand on). */
export function sceneSetup(base:TrainingSetup,scene:LessonScene):TrainingSetup{
 const setup=copy(base);
 for(const q of scene.spots){const p=setup.poses.find(x=>x.side===0&&x.number===q.number);if(p){p.x=q.x;p.y=q.y;}}
 for(let pass=0;pass<4;pass++)for(const o of setup.poses.filter(p=>p.side===1))for(const p of setup.poses){
  if(p===o)continue;const d=dist(o,p);if(d>=1)continue;
  const ux=d>.01?(o.x-p.x)/d:0,uy=d>.01?(o.y-p.y)/d:1;o.x=clamp(o.x+ux*(1.1-d),BOUNDS.x0,BOUNDS.x1);o.y=clamp(o.y+uy*(1.1-d),BOUNDS.y0,BOUNDS.y1);
 }
 return setup;
}
/** Move a routine's drawing along the pitch (a free kick or throw-in in another third). */
export function shiftRoutine(plan:LabPlan,setup:TrainingSetup,dx:number){
 for(const p of setup.poses){const taker=p.side===setup.ball.side&&p.number===setup.ball.number;p.x=taker?p.x+dx:clamp(p.x+dx,BOUNDS.x0,BOUNDS.x1);}
 setup.ball.x+=dx;
 for(const s of plan.lesson.spaces)s.x=clamp(s.x+dx,BOUNDS.x0,BOUNDS.x1);
}
