import {FootballCoaching} from './practice-coaching.js';
import {LooseBallContinuity} from './practice-continuity.js';
import {L,W} from './pitch.js';
import type {Side} from './model.js';
import type {MovingBall,Vec} from './movement.js';
import type {Option,PracticePlayer} from './practice.js';
import type {CoordinationView} from './practice-coordination.js';
import type {SupportMove,SupportPlan} from './practice-support.js';
import {activePassRun,groundPass} from './practice-passing.js';
import {loftPass} from './practice-loft.js';
import {assessShot} from './practice-football.js';
import {carryOptions} from './practice-carry.js';
import {leadThrowOption} from './practice-throw.js';
import {clamp} from './model.js';
import {LessonResponsibilities,responsibilityNames} from './practice-lesson.js';
import type {LessonSpec,LessonEvidence,LessonJob} from './practice-lesson.js';
import type {RecognisedEntry} from './practice-recognition.js';
import {WORLD} from './world.js';

export type TeachingNumber=2|3|4|5;
export type ActionActor=TeachingNumber|{receiverOf:string};
export type ActionCondition={kind:'start'}|{kind:'restart-taken'}|{kind:'pressed';actor:ActionActor}|{kind:'released'|'received'|'arrived';stepId:string};
export type ActionTarget={kind:'point';x:number;y:number}|{kind:'player';number:TeachingNumber}|{kind:'free';x?:number;y?:number};
export interface ActionStep {
 id:string;actor:ActionActor;action:'move'|'carry'|'pass'|'shoot'|'hold';target?:ActionTarget;
 delivery?:'ground'|'loft'|'auto';fallback?:boolean;
 when:{mode:'all'|'any';conditions:ActionCondition[]};
}
export interface ActionTrace {
 time:number;stepId:string;phase:'waiting'|'active'|'adapted'|'released'|'received'|'arrived'|'complete'|'aborted'|'interrupted'|'skipped';
 intent?:'pursued'|'attempted'|'alternative';
 action:ActionStep['action'];actor?:string;target?:string;text:string;
 momentId?:string;momentTime?:number;responsibility?:LessonJob['kind'];evidence?:LessonEvidence;
}
type StepState={pursuit?:{origin:Vec;aim:Vec};pursued?:boolean;step:ActionStep;phase:ActionTrace['phase'];actor?:string;aim?:Vec;started?:number;released?:number;received?:number;arrived?:number;receiver?:string;target?:string;lastNote?:string;waitingReason?:string;reportedAt?:number};
/** How long a routine's instructions last after its kick. */
export const ROUTINE_SECONDS=WORLD.selection.teaching.ROUTINE_SECONDS.v;
/** A routine's drawn delivery is off above this lane risk: the bar at which an
 * idea trusts its drawn pass (practice-lesson.ts), with control risk ≤ 0.48
 * and reach margin ≥ −0.6 for kicked balls. */
export const ROUTINE_DELIVERY_RISK=WORLD.selection.teaching.ROUTINE_DELIVERY_RISK.v;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const number=(value:unknown):value is TeachingNumber=>[2,3,4,5].includes(value as number);
const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value);
const inside=(point:Vec)=>point.x>=.8&&point.x<=L-.8&&Math.abs(point.y)<=W/2-1;
function actor(value:unknown):ActionActor {
 if(number(value))return value;
 if(object(value)&&id(value.receiverOf))return {receiverOf:value.receiverOf as string};
 throw Error('Invalid action actor: use #2–#5 or receiverOf a pass step.');
}
function target(value:unknown):ActionTarget|undefined {
 if(value===undefined)return undefined;
 if(!object(value))throw Error('Invalid action target.');
 if(value.kind==='player'&&number(value.number))return {kind:'player',number:value.number};
 if(value.kind==='point'&&finite(value.x)&&finite(value.y)&&inside(value as unknown as Vec))return {kind:'point',x:value.x,y:value.y};
 if(value.kind==='free'&&(value.x===undefined&&value.y===undefined||finite(value.x)&&finite(value.y)&&inside(value as unknown as Vec)))return {kind:'free',...(value.x!==undefined?{x:value.x as number,y:value.y as number}:{})};
 throw Error('Invalid action target: points must be finite and inside the pitch; a free zone needs both x and y.');
}
/** A bounded directed event graph. References may point forward, but cannot form a cycle. */
export function validateSteps(input:unknown):ActionStep[] {
 if(!Array.isArray(input)||input.length>12)throw Error('Invalid actions: at most 12 steps.');
 const ids=new Set<string>();
 const steps=input.map((raw):ActionStep=>{
  if(!object(raw)||!id(raw.id)||ids.has(raw.id as string))throw Error('Invalid action ID: unique letters, digits, underscores or hyphens, up to 64 characters.');
  ids.add(raw.id as string);
  if(!['move','carry','pass','shoot','hold'].includes(raw.action as string))throw Error('Invalid action type.');
  if(!object(raw.when)||!['all','any'].includes(raw.when.mode as string)||!Array.isArray(raw.when.conditions)||!raw.when.conditions.length||raw.when.conditions.length>3)throw Error('Each action needs 1–3 conditions and all/any mode.');
  const conditions=raw.when.conditions.map((c):ActionCondition=>{
   if(!object(c))throw Error('Invalid action condition.');
   if(c.kind==='start')return {kind:'start'};
   if(c.kind==='restart-taken')return {kind:'restart-taken'};
   if(c.kind==='pressed')return {kind:'pressed',actor:actor(c.actor)};
   if(['released','received','arrived'].includes(c.kind as string)&&id(c.stepId))return {kind:c.kind as 'released'|'received'|'arrived',stepId:c.stepId as string};
   throw Error('Invalid action condition or missing step reference.');
  });
  const action=raw.action as ActionStep['action'],aim=target(raw.target);
  if((action==='move'||action==='carry')&&aim?.kind!=='point')throw Error('Move and carry actions need a point target.');
  if(action==='pass'&&(!aim||aim.kind==='point'))throw Error('Pass actions need a player or free-space target.');
  if(action==='hold'&&aim&&aim.kind!=='point')throw Error('Hold actions use a point target or their current position.');
  if(raw.delivery!==undefined&&!['auto','ground','loft'].includes(raw.delivery as string))throw Error('Invalid pass delivery.');
  if(raw.fallback!==undefined&&typeof raw.fallback!=='boolean')throw Error('Invalid fallback flag.');
  if(action!=='pass'&&(raw.delivery!==undefined||raw.fallback!==undefined))throw Error('Delivery and fallback are pass settings.');
  if(action==='shoot'&&aim)throw Error('Shoot actions aim at the goal using the live shooting model.');
  return {id:raw.id as string,actor:actor(raw.actor),action,...(aim?{target:aim}:{}),...(raw.delivery!==undefined?{delivery:raw.delivery as ActionStep['delivery']}:{}),...(raw.fallback!==undefined?{fallback:raw.fallback as boolean}:{}),when:{mode:raw.when.mode as 'all'|'any',conditions}};
 });
 const byId=new Map(steps.map(s=>[s.id,s]));
 const dependencies=new Map<string,string[]>();
 for(const s of steps){
  const refs:string[]=[];
  const readActor=(a:ActionActor)=>{if(typeof a!=='number'){if(byId.get(a.receiverOf)?.action!=='pass')throw Error(`Action ${s.id}: receiverOf must reference a pass step.`);refs.push(a.receiverOf);}};
  readActor(s.actor);
  for(const c of s.when.conditions){
   if(c.kind==='pressed')readActor(c.actor);
   else if(c.kind!=='start'&&c.kind!=='restart-taken'){
    const source=byId.get(c.stepId);if(!source)throw Error(`Action ${s.id}: unknown condition step ${c.stepId}.`);
    if((c.kind==='received'&&source.action!=='pass')||(c.kind==='released'&&!['pass','shoot'].includes(source.action))||(c.kind==='arrived'&&!['move','carry','hold'].includes(source.action)))throw Error(`Action ${s.id}: ${c.kind} cannot follow ${source.action}.`);
    refs.push(c.stepId);
   }
  }
  dependencies.set(s.id,refs);
 }
 const visiting=new Set<string>(),visited=new Set<string>();
 const visit=(key:string)=>{if(visiting.has(key))throw Error('Action conditions contain a dependency cycle.');if(visited.has(key))return;visiting.add(key);for(const ref of dependencies.get(key)??[])visit(ref);visiting.delete(key);visited.add(key);};
 steps.forEach(s=>visit(s.id));return steps;
}

/** Eligibility asks only whether the action graph can start, never whether a future lane is open. */
export function teachingFit(steps:ActionStep[],players:PracticePlayer[],owner:PracticePlayer):{fit:number;reason:string} {
 if(!steps.length)return {fit:0,reason:'Nicio acțiune în plan.'};
 for(const step of steps)if(typeof step.actor==='number'&&!players.some(p=>p.side===owner.side&&p.number===step.actor&&p.role!=='GK'))return {fit:0,reason:`#${step.actor} nu este pe teren.`};
 const opening=steps.filter(s=>s.when.conditions.some(c=>c.kind==='start')&&s.when.mode==='any'||s.when.conditions.every(c=>c.kind==='start'));
 const withBall=opening.filter(s=>['carry','pass','shoot'].includes(s.action));
 if(withBall.length&&!withBall.some(s=>s.actor===owner.number))return {fit:0,reason:'Jucătorul care începe cu mingea nu a recuperat-o.'};
 return {fit:1,reason:'Acțiunile pot începe; culoarele viitoare se citesc la momentul pasei.'};
}

/** Shared intentions, not a choreography: only physical releases/receipts emit pass cues. */
export class TeachingActions {
 readonly states:StepState[];
 readonly trace:ActionTrace[]=[];
 readonly side:Side;
 until:number;
 ended=false;
 aborted=false;
 endReason='';
 private flight:StepState|null=null;
 private routes=new Map<string,{aim:Vec;until:number}>();
 private numbers=new Map<string,number>();
 private lesson?:LessonResponsibilities;
 private combination?:{step:StepState;coach:FootballCoaching;cursor:number};
 private continuity=new LooseBallContinuity();
 /** A set-piece routine: when its restart was taken (the release). */
 private takenAt?:number;
 private flushCombination(){
  const c=this.combination;if(!c)return;
  for(const n of c.coach.notes.slice(c.cursor)){
   const phase=n.kind==='end'?(n.outcome==='shot'?'complete':'interrupted'):n.kind==='pass'?'released':n.kind==='receipt'?'received':n.kind==='decision'?'adapted':'active';
   this.trace.push({time:n.time,stepId:c.step.step.id,phase,...(n.kind==='pass'||n.outcome==='shot'?{intent:'attempted' as const}:{}),action:n.kind==='pass'?'pass':n.kind==='support'?'move':'carry',actor:n.actor,text:n.text,momentId:this.lesson?.job(c.step.step.id)?.momentId,evidence:{aim:n.aim,chosen:n.chosen?{...n.chosen,score:0}:undefined,options:n.options?.filter(o=>o.aim).map(o=>({kind:o.kind,target:o.target,aim:o.aim!,score:o.score,preference:o.coachedScore-o.score}))}});
   if(n.kind==='end')c.step.phase=n.outcome==='shot'?'complete':'interrupted';
  }
  c.cursor=c.coach.notes.length;
 }
 private moments=new Map<string,{time:number;evidence:LessonEvidence}>();
 constructor(readonly steps:ActionStep[],readonly since:number,owner:PracticePlayer,readonly adaptive=false,private laneRisk:(from:Vec,to:Vec,opponents:PracticePlayer[],speed?:number)=>number=()=>0,lesson?:LessonSpec,private entry?:RecognisedEntry,readonly emphasis=1,readonly routine=false){
  // A routine is chosen at the stoppage: its clock starts at the kick.
  this.side=owner.side;this.until=routine?Infinity:since+15;
  if(lesson)this.lesson=new LessonResponsibilities(lesson,this.side,laneRisk,!!entry,emphasis);
  this.states=steps.map(step=>({step,phase:'waiting'}));
  if(entry?.independent)this.moments.set(entry.momentId,{time:since,evidence:{entry:{momentId:entry.momentId,independent:true,bindings:entry.bindings}}});
  for(const s of this.states){
   const job=this.lesson?.job(s.step.id);
   if(entry&&job&&!entry.allowedMoments.includes(job.momentId)){s.phase='skipped';this.note(s,since,'skipped','Moment anterior sau fără legătură cauzală: omis la intrarea directă; nicio reușită presupusă.');}
   else if(!entry?.independent||job?.momentId!==entry.momentId)this.note(s,since,'waiting',this.waitReason(s));
  }
 }
 private state(key:string){return this.states.find(s=>s.step.id===key);}
 actionActive(key:string):boolean{return !this.ended&&!this.continuity.suspended&&this.state(key)?.phase==='active';}
 /** Reserve participants through the passage, including later moments and real receiver bindings. */
 participants(players:PracticePlayer[]):Set<string> {
  const ids=new Set<string>();
  for(const s of this.states){
   if(s.phase==='skipped')continue;
   const p=this.resolve(s.step.actor,players);if(p)ids.add(p.id);
   if(s.step.target?.kind==='player'){
    const target=players.find(p=>p.side===this.side&&p.number===(s.step.target as {number:number}).number);if(target)ids.add(target.id);
   }
   if(s.receiver)ids.add(s.receiver);
  }
  return ids;
 }
 private resolve(a:ActionActor,players:PracticePlayer[]):PracticePlayer|undefined {
  return typeof a==='number'?players.find(p=>p.side===this.side&&p.number===a):players.find(p=>p.id===this.state(a.receiverOf)?.receiver)??(this.entry?.receiverBindings[a.receiverOf]!==undefined?players.find(p=>p.side===this.side&&p.number===this.entry!.receiverBindings[a.receiverOf]):undefined);
 }
 private point(point:Vec):Vec{return this.side===0?{x:point.x,y:point.y}:{x:L-point.x,y:-point.y};}
 private note(s:StepState,time:number,phase:ActionTrace['phase'],text:string,target?:string,evidence?:LessonEvidence,intent?:ActionTrace['intent']){
  const key=`${phase}:${intent??''}:${text}:${target??''}`;if(key===s.lastNote)return;s.lastNote=key;
  const job=this.lesson?.job(s.step.id),moment=job?this.moments.get(job.momentId):undefined;
  this.trace.push({time,stepId:s.step.id,phase,...(intent?{intent}:{}),action:s.step.action,actor:s.actor,target,text,...(job?{momentId:job.momentId,responsibility:job.kind,...(moment?{momentTime:moment.time}:{}),evidence:{...(this.entry?{entry:{momentId:this.entry.momentId,independent:this.entry.independent,bindings:this.entry.bindings}}:{}),...moment?.evidence,...evidence}}:{})});
 }
 private waitReason(s:StepState){
  const job=this.lesson?.job(s.step.id),moment=job?this.lesson?.lesson.moments.find(m=>m.id===job.momentId):undefined;
  if(moment)return `Așteaptă momentul „${moment.name}”.`;
  return `Așteaptă ${s.step.when.conditions.map(c=>c.kind==='start'?'începutul planului':c.kind==='restart-taken'?'execuția fazei fixe':c.kind==='pressed'?'presiune reală pe jucător':c.kind==='released'?`eliberarea mingii (${c.stepId})`:c.kind==='received'?`primirea reușită (${c.stepId})`:`sosirea la punct (${c.stepId})`).join(s.step.when.mode==='all'?' și ':' sau ')}.`;
 }
 private condition(c:ActionCondition,players:PracticePlayer[],ball:MovingBall):boolean {
  if(c.kind==='start')return true;
  if(c.kind==='restart-taken')return this.takenAt!==undefined;
  if(c.kind==='pressed'){
   const p=this.resolve(c.actor,players);if(!p||ball.owner!==p.id)return false;
   return players.some(q=>{
    if(q.side===p.side)return false;
    const gap=distance(p,q),closing=((q.vx-p.vx)*(p.x-q.x)+(q.vy-p.vy)*(p.y-q.y))/Math.max(.01,gap);
    return gap<2.7||gap<4.8&&closing>.35;
   });
  }
  const source=this.state(c.stepId);return source?.[c.kind]!==undefined;
 }
 private observeMoments(time:number,players:PracticePlayer[],ball:MovingBall){
  if(!this.lesson)return;
  for(const moment of this.lesson.lesson.moments){
   if(this.entry&&!this.entry.allowedMoments.includes(moment.id))continue;
   if(this.moments.has(moment.id))continue;
   const c=moment.cue;let evidence:LessonEvidence|undefined;
   if(c.kind==='start')evidence={cue:{kind:'start'}};
   else if(c.kind==='restart-taken'){if(this.takenAt!==undefined)evidence={cue:{kind:'restart-taken',releasedAt:this.takenAt}};}
   else if(c.kind==='pressed'){
    const p=this.resolve(c.actor,players);if(!p||p.id!==ball.owner)continue;
    const read=players.filter(q=>q.side!==p.side).map(q=>{const gap=distance(p,q);return {q,gap,closing:((q.vx-p.vx)*(p.x-q.x)+(q.vy-p.vy)*(p.y-q.y))/Math.max(.01,gap)};}).filter(r=>r.gap<2.7||r.gap<4.8&&r.closing>.35).sort((a,b)=>a.gap-b.gap)[0];
    if(read)evidence={cue:{kind:'pressed',actor:p.id,opponent:read.q.id,distance:read.gap,closingSpeed:read.closing}};
   }else {
    const source=this.state(c.jobId),at=source?.[c.kind];
    if(at!==undefined)evidence={cue:{kind:c.kind,jobId:c.jobId,actor:source?.actor,...(c.kind==='released'?{releasedAt:at}:{receivedAt:at})}};
   }
   if(evidence)this.moments.set(moment.id,{time,evidence});
  }
 }
 update(time:number,players:PracticePlayer[],ball:MovingBall):boolean {
  if(this.ended)return false;
  const refreshed=this.lesson?.refreshSpaces(time,players)??[];
  for(const space of refreshed){const s=this.states.find(s=>s.phase==='active'&&this.lesson?.job(s.step.id)?.spaceId===space.id);if(s)this.note(s,time,'active',`Reevaluează spațiul „${space.name}” după deplasarea reperului: (${space.x.toFixed(1)}, ${space.y.toFixed(1)}) m.`,undefined,{spaceId:space.id,resolvedSpaces:[space]});}
  if(this.adaptive)for(const p of players)this.numbers.set(p.id,p.number);
  if(time>=this.until){this.abort(time,'Fereastra de 15 secunde s-a încheiat; continuă jocul liber.');return true;}
  if(ball.owner&&players.find(p=>p.id===ball.owner)?.side!==this.side){this.abort(time,'Adversarul a câștigat mingea.');return true;}
  const wasSuspended=this.continuity.suspended;
  const continuity=this.continuity.update(time,ball,players.filter(p=>p.side===this.side));
  if(continuity==='expired'){this.abort(time,'Mingea s-a îndepărtat sau duelul a durat prea mult; reorganizează jocul.');return true;}
  if(continuity==='pause'){
   if(!wasSuspended)for(const s of this.states.filter(s=>s.phase==='active'||s.phase==='released'))this.note(s,time,'adapted','Mingea este liberă: reacționează la ea, păstrând pentru scurt timp ideea. Nicio primire presupusă.');
   return !wasSuspended;
  }
  if(wasSuspended)for(const s of this.states.filter(s=>s.phase==='active'))this.note(s,time,'active','Controlul a revenit; reevaluează continuarea din pozițiile actuale.');
  this.observeMoments(time,players,ball);
  let changed=wasSuspended;
  for(const s of this.states){
   const job=this.lesson?.job(s.step.id),space=job?this.lesson?.space(job):undefined;
   if(s.phase==='active'&&s.aim&&['move','carry','hold'].includes(s.step.action)&&(!job||!!space&&['advance','run','hold'].includes(job.kind))&&!s.arrived){
    const p=players.find(p=>p.id===s.actor);
    if(p&&distance(p,space??s.aim)<(space?.radius??(this.adaptive?2:.8))&&(s.step.action!=='carry'||ball.owner===p.id)){
     if(!job)s.phase='arrived';s.arrived=time;this.note(s,time,'arrived',`#${p.number} a ajuns ${this.adaptive?'în zona desenată':'fizic la punct'}.${job?' Responsabilitatea continuă.':''}`,undefined,job?{spaceId:job.spaceId,aim:{x:p.x,y:p.y}}:undefined);changed=true;
    }
   }
  }
  for(const s of this.states){
   const p=players.find(p=>p.id===s.actor),motion=s.pursuit;
   if(s.phase==='active'&&!s.pursued&&p&&motion&&distance(motion.origin,motion.aim)-distance(p,motion.aim)>.5){
    s.pursued=true;this.note(s,time,'active',`#${p.number} se deplasează pentru responsabilitatea cerută.`,undefined,{aim:motion.aim},'pursued');
   }
  }
  // Iterate because an arrival can activate a dependent step in the same tick.
  for(let pass=0;pass<this.states.length;pass++){
   let activated=false;
   for(const s of this.states){
    if(s.phase!=='waiting')continue;
    const job=this.lesson?.job(s.step.id),values=s.step.when.conditions.map(c=>this.condition(c,players,ball));
    if(job?!this.moments.has(job.momentId):!(s.step.when.mode==='all'?values.every(Boolean):values.some(Boolean)))continue;
    const p=this.resolve(s.step.actor,players);if(!p){if(job){s.waitingReason='Momentul a apărut, dar încă nu există un primitor real pentru acest rol.';this.note(s,time,'waiting',s.waitingReason,undefined,{blockers:[{kind:'possession',text:s.waitingReason}]});}continue;}
    if(['carry','pass','shoot'].includes(s.step.action)&&ball.owner!==p.id&&!(job?.repeat&&players.some(q=>q.id===ball.owner&&q.side===this.side&&q.number===job.recipient))){
     if(this.adaptive){s.actor=p.id;s.waitingReason=`Condiția a apărut, dar #${p.number} nu are mingea încă.`;this.note(s,time,'waiting',s.waitingReason,undefined,job?{blockers:[{kind:'possession',actor:p.id,text:s.waitingReason}]}:undefined);}
     continue;
    }
    s.actor=p.id;s.started=time;s.phase='active';
    if(job)this.lesson?.refreshSpaces(time,players,job.momentId);
    if(s.step.target?.kind==='point')s.aim=this.point(s.step.target);
    else if(s.step.action==='hold')s.aim={x:p.x,y:p.y};
    for(const old of this.states)if(old!==s&&old.actor===s.actor&&['active','arrived'].includes(old.phase)){
     old.phase='interrupted';
     const nextLabel=job?`responsabilitatea „${responsibilityNames[job.kind]}” din momentul „${this.lesson!.lesson.moments.find(m=>m.id===job.momentId)!.name}”`:`acțiunea ${s.step.id}`;
     this.note(old,time,'interrupted',`Intenția a fost înlocuită de ${nextLabel}${this.lesson?old.arrived!==undefined?'; sosirea deja observată rămâne în istoric.':'; nu marchează o finalizare.':'; nu este o reușită.'}`);
    }
    if(job?.repeat&&typeof job.recipient==='number'){
     this.until=Infinity;
     this.combination?.coach.end(time,'Un nou moment înlocuiește combinația.');this.flushCombination();
     this.combination={step:s,coach:new FootballCoaching({kind:'repeat-one-two',side:this.side,carrier:p.number,partner:job.recipient,channelY:0,width:20,emphasis:this.emphasis}),cursor:0};
    }
    if(this.entry?.continuingJobs?.includes(s.step.id))this.note(s,time,'active',`#${p.number} reia acum sprijinul acestei continuări; nu presupune că a executat mișcarea anterior.`);
    const resolvedSpace=job&&this.entry?this.lesson?.space(job):undefined;
    this.note(s,time,'active',`#${p.number} începe: ${job?responsibilityNames[job.kind]:s.step.action==='carry'?this.adaptive?'caută avansarea pe traseu':'conduce spre punct':s.step.action==='move'?this.adaptive?'caută o cursă spre zonă':'aleargă spre punct':s.step.action==='pass'?'caută pasa desenată':s.step.action==='shoot'?'caută șutul':'ține poziția'}.`,undefined,resolvedSpace?{resolvedSpaces:[resolvedSpace]}:undefined);
    activated=true;changed=true;
   }
   if(!activated)break;
  }
  if(this.combination){
   const c=this.combination;
   if(c.step.phase!=='active'){c.coach.end(time,'O altă responsabilitate a înlocuit combinația.');this.flushCombination();this.combination=undefined;this.until=time+15;}
   else {
    const replacement=this.states.find(s=>s!==c.step&&s.phase==='active'&&s.started!>=c.step.started!&&['pass','shoot','carry'].includes(s.step.action)&&players.some(p=>p.id===s.actor&&[c.coach.config.carrier,c.coach.config.partner].includes(p.number)));
    if(replacement){c.coach.end(time,'Un nou moment cere altă responsabilitate.');this.flushCombination();this.combination=undefined;this.until=time+15;}
    else {c.coach.update(time,players,ball,false);this.flushCombination();if(!c.coach.active){this.ended=true;this.endReason='Combinația s-a încheiat.';}}
   }
  }
  if(this.states.some(s=>s.step.action!=='hold')&&this.states.every(s=>['arrived','received','complete','interrupted','skipped'].includes(s.phase))&&!this.flight){
   this.ended=true;this.endReason='Acțiunile s-au încheiat; continuă jocul liber.';
  }
  return changed||this.ended;
 }
 /** A routine's restart was taken: its kick moment is due and its clock starts. */
 restartTaken(time:number,players:PracticePlayer[]=[]){
  if(!this.routine||this.ended||this.takenAt!==undefined)return;this.takenAt=time;this.until=time+ROUTINE_SECONDS;
  // The routine's spots are part of it: note, at the kick, who stood where he was put.
  for(const spot of this.lesson?.lesson.scene?.spots??[]){
   const p=players.find(q=>q.side===this.side&&q.number===spot.number);if(!p)continue;
   const aim=this.point(spot),gap=distance(p,aim),set=gap<=spot.leash+1,stepId=`spot:${spot.number}`;
   this.trace.push({time,stepId,phase:'active',action:'hold',actor:p.id,text:`#${p.number} are un loc în rutină.`,evidence:{aim}});
   this.trace.push({time,stepId,phase:set?'arrived':'adapted',action:'hold',actor:p.id,text:set?`#${p.number} era la locul lui la execuție (${gap.toFixed(1)} m).`:`#${p.number} nu ajunsese la locul lui la execuție (${gap.toFixed(1)} m).`,evidence:{aim}});
  }
 }
 get taken(){return this.takenAt!==undefined;}
 /** At a routine's kick the taker plays the drawn delivery: the set-up exists
  * to make it, as a rehearsed set piece is executed unless it is clearly off.
  * Clearly off: its intended receiver is not at his spot, or no version of it
  * clears the bar at which an idea trusts a drawn pass (lane risk, control,
  * reach). Then null, and the taker decides as always. A throw-in's drawn
  * delivery leads the receiver's drawn run (a throw otherwise goes to where a
  * man stands). Open play is untouched: this is the kick only. */
 routineDelivery(time:number,p:PracticePlayer,kind:string,spot:Vec,options:Option[],players:PracticePlayer[],support:SupportPlan|null):Option|null {
  if(!this.routine||this.ended||this.takenAt!==undefined||!this.lesson)return null;
  const s=this.states.find(s=>s.actor===p.id&&s.phase==='active'&&s.step.action==='pass'),job=s&&this.lesson.job(s.step.id);
  if(!s||!job)return null;
  for(const q of players)this.numbers.set(q.id,q.number);
  const scene=this.lesson.lesson.scene,mates=players.filter(q=>q.side===this.side&&q.id!==p.id&&q.role!=='GK');
  const receivers=mates.filter(q=>typeof job.recipient!=='number'||q.number===job.recipient);
  const atSpot=(q:PracticePlayer)=>{const d=scene?.spots.find(x=>x.number===q.number);return !d||distance(q,this.point(d))<=d.leash+1;};
  if(typeof job.recipient==='number'&&!receivers.some(atSpot))return null;
  let drawn=options.filter(o=>this.matches(s.step,o,p)&&(!o.target||receivers.some(q=>q.id===o.target&&atSpot(q))));
  if(kind==='throw')for(const q of receivers.filter(atSpot)){
   const run=activePassRun(support,p,q,time),lead=run?leadThrowOption(p,spot,q,run,players):null;
   if(lead&&this.matches(s.step,lead,p))drawn.push(lead);
  }
  drawn=drawn.filter(o=>{const pass=o.pass??o.loft,risk=o.throwRisk??pass?.risk??1;return risk<=ROUTINE_DELIVERY_RISK&&(!pass||pass.controlRisk<=.48&&pass.reachMargin>=-.6);});
  const best=drawn.sort((a,b)=>b.score-a.score)[0];
  return best?{...best,teachingStep:s.step.id,reason:`Execută varianta repetată a fazei fixe. ${best.reason}`}:null;
 }
 /** A routine before its kick: the runs drawn from the kick (actor, where
  * the drawn space is now, his running speed). Nothing is started here. */
 pendingRuns(players:PracticePlayer[]):{player:string;aim:Vec;speed:number}[] {
  if(!this.routine||this.takenAt!==undefined||this.ended||!this.lesson)return [];
  const kick=new Set(this.lesson.lesson.moments.filter(m=>m.cue.kind==='restart-taken').map(m=>m.id)),out:{player:string;aim:Vec;speed:number}[]=[];
  for(const s of this.states){
   const job=this.lesson.job(s.step.id);if(!job||s.phase!=='waiting'||!kick.has(job.momentId)||job.kind!=='run')continue;
   const p=this.resolve(s.step.actor,players),space=this.lesson.space(job);
   if(p&&space&&!out.some(q=>q.player===p.id))out.push({player:p.id,aim:{x:space.x,y:space.y},speed:p.pace*.94});
  }
  return out;
 }
 abort(time:number,reason:string){
  if(this.ended)return;this.ended=true;this.aborted=true;this.endReason=reason;
  for(const s of this.states)if(!['received','complete','interrupted','skipped'].includes(s.phase)){
   if(this.lesson&&s.arrived!==undefined){s.phase='interrupted';this.note(s,time,'interrupted',`${reason} Sosirea la ${s.arrived.toFixed(2)} s rămâne realizată.`);continue;}
   const suffix=s.phase==='waiting'?` ${this.lesson&&s.waitingReason?s.waitingReason:this.waitReason(s)}`:'';s.phase='aborted';this.note(s,time,'aborted',reason+suffix);
  }
  this.combination?.coach.end(time,reason);this.flushCombination();this.combination=undefined;
  this.flight=null;
 }
 ownerAim(owner:PracticePlayer):Vec|undefined {
  if(this.ended||this.continuity.suspended||this.adaptive)return;
  const s=this.states.find(s=>s.actor===owner.id&&['active','arrived'].includes(s.phase)&&['carry','hold'].includes(s.step.action));return s?.aim;
 }
 startedAction(time:number,actor:string):boolean {
  return !this.ended&&this.states.some(s=>s.actor===actor&&s.started===time&&['active','arrived'].includes(s.phase));
 }
 apply(time:number,players:PracticePlayer[],ball:MovingBall,coordination:CoordinationView|null,support:SupportPlan|null,unavailable:ReadonlySet<string>):SupportPlan|null {
  if(this.ended)return support;
  // A loose ball belongs to the players hunting it. The rest of a shared
  // lesson keep making their drawn movements while the idea is still alive;
  // older action graphs keep their original pause.
  const loose=this.continuity.suspended||!ball.owner&&ball.mode==='loose';
  if(loose&&!this.lesson)return support;
  if(!loose&&this.combination?.coach.active){support=this.combination.coach.apply(time,players,ball,coordination,support,unavailable,this.laneRisk);this.flushCombination();}
  const moves:SupportMove[]=[];
  const next=ball.owner?undefined:players.find(q=>q.side===this.side&&q.id===coordination?.flight.receiver)??players.find(q=>q.side===this.side&&!!coordination?.flight.hunters.includes(q.id));
  for(const s of this.states){
   const job=this.lesson?.job(s.step.id);
   if(job&&['active','arrived'].includes(s.phase)&&['offer','run','occupy','hold'].includes(job.kind)){
    const p=players.find(p=>p.id===s.actor);if(!p||p.id===ball.owner||unavailable.has(p.id)||!ball.owner&&(coordination?.flight.receiver===p.id||coordination?.flight.hunters.includes(p.id)))continue;
    const read=this.lesson!.movement(job,p,players,ball,support,time,s.aim??p,next);
    if(!read){if(time-(s.reportedAt??-10)>=1){s.reportedAt=time;this.note(s,time,'adapted','Nicio poziție potrivită acum; păstrează decizia obișnuită și reevaluează responsabilitatea.',undefined,this.lesson!.evaluations.get(job.id));}continue;}
    const move:SupportMove={player:p.id,purpose:'playbook',kind:read.kind,aim:read.aim,speed:read.speed,since:s.started!,until:this.until,reason:read.reason};
    s.pursuit??={origin:{x:p.x,y:p.y},aim:{...read.aim}};
    moves.push(move);
    if(time-(s.reportedAt??-10)>=1){s.reportedAt=time;this.note(s,time,'active',read.reason,undefined,read.evidence);}
    continue;
   }
   if(loose||!['active','arrived'].includes(s.phase)||!s.aim||!['move','hold','carry'].includes(s.step.action))continue;
   const p=players.find(p=>p.id===s.actor);if(!p||p.id===ball.owner||unavailable.has(p.id))continue;
   if(!ball.owner&&(coordination?.flight.receiver===p.id||coordination?.flight.hunters.includes(p.id)))continue;
   const kind=s.step.action==='hold'?'hold':'run';
   const aim=this.adaptive?this.movementAim(time,s,p,players):s.aim;
   const move:SupportMove={player:p.id,purpose:'playbook',kind,aim:{...aim},speed:p.pace*(kind==='run'?.94:.65),since:s.started!,until:this.until,reason:`Acțiunea ${s.step.id}: ${kind==='run'?this.adaptive?'caută traseul spre zona desenată':'aleargă spre punctul desenat':'ține punctul desenat'}.`};
   moves.push(move);
  }
  if(loose&&!moves.length)return support;
  const current=support?.side===this.side?support:null;
  const result:SupportPlan={owner:ball.owner??current?.owner??'',side:this.side,moves:[...(current?.moves??[]).filter(m=>m.purpose!=='playbook'&&!moves.some(q=>q.player===m.player)),...moves]};
  return result;
 }
 private movementAim(time:number,s:StepState,p:PracticePlayer,players:PracticePlayer[]):Vec {
  const destination=s.aim!,length=distance(p,destination);
  if(length<2)return destination;
  const ux=(destination.x-p.x)/length,uy=(destination.y-p.y)/length,step=Math.min(6,length);
  const bound=(v:Vec)=>({x:clamp(v.x,.8,L-.8),y:clamp(v.y,-W/2+1,W/2-1)});
  const candidates=[-3,0,3].map(offset=>bound({x:p.x+ux*step-uy*offset,y:p.y+uy*step+ux*offset}));
  const rate=(v:Vec)=>{
   const dx=v.x-p.x,dy=v.y-p.y,d2=dx*dx+dy*dy;
   let blocked=0;
   for(const q of players){if(q.id===p.id)continue;const t=clamp(((q.x-p.x)*dx+(q.y-p.y)*dy)/Math.max(.01,d2),.15,1),gap=distance(q,{x:p.x+dx*t,y:p.y+dy*t});blocked=Math.max(blocked,clamp((1.8-gap)/1.8,0,1));}
   return (length-distance(v,destination))*.18-blocked*1.8;
  };
  const previous=this.routes.get(p.id);
  let aim=candidates.reduce((a,b)=>rate(a)>rate(b)?a:b);
  if(previous&&time<previous.until&&rate(previous.aim)>rate(aim)-.12)aim=previous.aim;
  else this.routes.set(p.id,{aim,until:time+.6});
  return aim;
 }
 private matches(step:ActionStep,o:Option,p:PracticePlayer):boolean {
  if(step.action==='carry')return o.kind==='carry';
  if(step.action==='shoot')return o.kind==='shoot';
  if(step.action==='hold')return o.kind==='carry'&&distance(o.aim,p)<2;
  if(step.action!=='pass'||!['pass','through','loft'].includes(o.kind))return false;
  if(step.delivery==='ground'&&o.kind==='loft'||step.delivery==='loft'&&o.kind!=='loft')return false;
  const job=this.lesson?.job(step.id),space=job?this.lesson?.space(job):undefined;
  if(space&&distance(o.aim,space)>space.radius+1.5)return false;
  const target=step.target;
  if(target?.kind==='player')return this.numbers.get(o.target??'')===target.number;
  if(target?.kind==='free'&&target.x!==undefined)return distance(o.aim,this.point({x:target.x,y:target.y!}))<7;
  return true;
 }
 private preferences(time:number,p:PracticePlayer,players:PracticePlayer[],ball:MovingBall,ordinary:Option[]):Option[] {
  if(this.ended||p.side!==this.side)return ordinary;
  for(const q of players)this.numbers.set(q.id,q.number);
  const preview=!ball.owner&&ball.mode==='pass';
  let s=this.states.find(s=>s.actor===p.id&&['active','arrived'].includes(s.phase));
  if(preview&&this.flight){
   // Read a possible continuation without claiming the incoming pass succeeded.
   const incoming=this.flight;
   s=this.states.find(candidate=>{
    if(candidate.phase!=='waiting'||!['pass','shoot','carry'].includes(candidate.step.action))return false;
    const a=candidate.step.actor;
    if(typeof a==='number'?a!==p.number:a.receiverOf!==incoming.step.id)return false;
    const checks=candidate.step.when.conditions.map(c=>c.kind==='received'&&c.stepId===incoming.step.id?true:this.condition(c,players,ball));
    return candidate.step.when.mode==='all'?checks.every(Boolean):checks.some(Boolean);
   });
  }else if(p.id!==ball.owner)return ordinary;
  if(!s||s.step.action==='move')return ordinary;
  const row=s.step,aim=s.aim??(row.target?.kind==='point'?this.point(row.target):undefined);
  let choices=ordinary;
  if(row.action==='carry'&&aim){
   const d=distance(p,aim),target={x:p.x+(aim.x-p.x)*Math.min(1,7/Math.max(.01,d)),y:p.y+(aim.y-p.y)*Math.min(1,7/Math.max(.01,d))};
   const extra=carryOptions(p,players,Math.max(0,time-(s.started??time)),this.laneRisk,null,time,[target]).filter(o=>!ordinary.some(q=>q.kind==='carry'&&distance(q.aim,o.aim)<.2));
   choices=[...ordinary,...extra];
  }
  const best=Math.max(...choices.map(o=>o.score));
  return choices.map(o=>{
   if(!this.matches(row,o,p))return o;
   let fitness=0;
   if(row.action==='carry'&&aim&&o.carry){
    const towards={x:aim.x-p.x,y:aim.y-p.y},route={x:o.aim.x-p.x,y:o.aim.y-p.y};
    const alignment=clamp((towards.x*route.x+towards.y*route.y)/(Math.max(.01,Math.hypot(towards.x,towards.y)*Math.hypot(route.x,route.y))),0,1);
    fitness=alignment**4*clamp(1-o.carry.obstruction/.6,0,1);
   }else if(row.action==='pass'){
    const delivery=o.pass??o.loft;
    if(delivery)fitness=clamp((.55-delivery.risk)/.4,0,1)*clamp((.6-delivery.controlRisk)/.5,0,1)*clamp((delivery.reachMargin+.8)/1.1,0,1);
   }else if(row.action==='shoot'||row.action==='hold')fitness=1;
   // A safe deliberate recycle can serve the coach's longer-term idea even
   // when ordinary one-action scoring prefers forward progress. Safety still
   // reduces the preference to zero; never remove the other football choices.
   const cap=row.action==='pass'?.6:row.action==='carry'?.45:row.action==='shoot'?.18:.1;
   const bonus=Math.min(cap,Math.max(.12,best-o.score+.07))*fitness;
   if(bonus<.015)return o;
   return {...o,score:o.score+bonus,teachingStep:s!.step.id,teachingSpace:o.kind==='through'||o.kind==='loft'&&!!o.run,reason:`Preferă instrucțiunea: ${row.action==='carry'?'avansează în direcția desenată':row.action==='pass'?'caută pasa cerută':row.action==='shoot'?'caută șutul':'păstrează poziția'}. ${o.reason}`};
  });
 }
 decided(time:number,p:PracticePlayer,o:Option){
  if(!this.adaptive||this.ended)return;
  if(this.combination?.coach.active){const c=this.combination;c.coach.choose(time,p,o);this.flushCombination();if([c.coach.config.carrier,c.coach.config.partner].includes(p.number))return;}
  const s=this.states.find(s=>s.actor===p.id&&s.phase==='active');if(!s)return;
  const job=this.lesson?.job(s.step.id);
  if(job){
   const read=this.lesson!.evaluations.get(job.id)??{},evidence={...read,chosen:{kind:o.kind,target:o.target,aim:{...o.aim},score:o.score}};
   const selected=read.options?.find(q=>q.kind===o.kind&&q.target===o.target&&distance(q.aim,o.aim)<.2);
   const alternate=job.kind==='pass'&&selected?.matches===false&&['pass','through','loft'].includes(o.kind);
   const adapted=o.teachingStep!==s.step.id||alternate,blocker=adapted?read.blockers?.map(b=>b.text).join(' '):undefined;
   const change=alternate?(job.delivery==='loft'&&o.kind!=='loft'?'alege o pasă pe jos în locul celei pe sus':job.delivery==='ground'&&o.kind==='loft'?'alege o pasă pe sus în locul celei pe jos':'alege o pasă în afara legăturii cerute'):adapted?'alege o continuare obișnuită':'încearcă responsabilitatea';
   this.note(s,time,adapted?'adapted':'active',`#${p.number} ${change}: ${o.reason}${blocker?` În comparație: ${blocker}`:''}`,o.target,evidence,adapted?undefined:'pursued');return;
  }
  this.note(s,time,o.teachingStep===s.step.id?'active':'adapted',o.teachingStep===s.step.id?`#${p.number} încearcă intenția. ${o.reason}`:`#${p.number} ajustează: ${o.reason}`,o.target);
 }
 private passChoices(s:StepState,p:PracticePlayer,players:PracticePlayer[],ball:MovingBall,support:SupportPlan|null,time:number):Option[] {
  const t=s.step.target!,opponents=players.filter(q=>q.side!==p.side),zone=t.kind==='free'&&t.x!==undefined?this.point({x:t.x,y:t.y!}):undefined;
  const candidates=players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK'&&(t.kind!=='player'||s.step.fallback||q.number===t.number));
  const choices:Option[]=[];
  for(const q of candidates){
   const d=distance(p,q);if(d<1.5||d>55)continue;
   const run=activePassRun(support,p,q,time),through=t.kind==='free';
   // A free zone selects a real runner/receiver. It never invents a target body
   // at the point or issues a new movement command to make the pass succeed.
   const destination=run?.aim??q;
   if(zone&&distance(destination,zone)>Math.max(9,distance(p,zone)*.8))continue;
   if(zone&&(zone.x-p.x)*(p.side===0?1:-1)<-1&&(q.x-p.x)*(p.side===0?1:-1)>-.5)continue;
   if(zone&&(zone.x-p.x)*(p.side===0?1:-1)>2&&(destination.x-p.x)*(p.side===0?1:-1)<1)continue;
   const ground=groundPass(p,q,through,run,ball,opponents);
   const deliveries:Option[]=[];
   if(s.step.delivery!=='loft')deliveries.push({kind:through?'through':'pass',target:q.id,aim:ground.aim,pass:ground,run:through?run:undefined,score:1,reason:''});
   if(s.step.delivery!=='ground'&&d>=4){const loft=loftPass(p,q,through?run:undefined,ball,opponents);deliveries.push({kind:'loft',target:q.id,aim:loft.aim,loft,run:through?run:undefined,score:1,reason:''});}
   for(const option of deliveries){
    const delivery=option.pass??option.loft!;
    if(!finite(delivery.flight)||delivery.flight>6)continue;
    const explicit=t.kind==='player'&&q.number===t.number&&!s.step.fallback;
    if(!explicit&&(delivery.risk>.42||delivery.controlRisk>.48||delivery.reachMargin<-.8))continue;
    const preferred=t.kind==='player'&&q.number===t.number;
    option.score=1-delivery.risk*.9-delivery.controlRisk*.5-Math.max(0,-delivery.reachMargin)*.25-delivery.flight*.03+(preferred?.2:0)-(zone?distance(delivery.aim,zone)*.018:0);
    option.reason=`Acțiunea ${s.step.id}: ${preferred?'pasa cerută':t.kind==='player'?'alternativă liberă':'coleg liber în zona căutată'} spre #${q.number}${option.kind==='loft'?', peste linie':''}.`;
    option.teachingStep=s.step.id;option.teachingSpace=through;choices.push(option);
   }
  }
  return choices.sort((a,b)=>b.score-a.score||a.target!.localeCompare(b.target!));
 }
 options(time:number,owner:PracticePlayer,players:PracticePlayer[],ball:MovingBall,support:SupportPlan|null,ordinary:Option[]):Option[] {
  if(this.continuity.suspended||!ball.owner&&ball.mode==='loose')return ordinary;
  if(this.combination?.coach.active&&!this.ended)return this.combination.coach.options(time,owner,players,ball,ordinary,this.laneRisk,0,null);
  if(this.lesson){
   if(this.ended||owner.side!==this.side)return ordinary;
   if(owner.id!==ball.owner){
    // Prepare a likely continuation while the incoming pass travels. This does
    // not activate its moment or report a receipt; those still require contact.
    const incoming=this.flight;
    if(ball.mode!=='pass'||ball.owner||!incoming||incoming.target!==owner.id)return ordinary;
    const next=this.states.find(s=>s.phase==='waiting'&&this.lesson!.lesson.moments.some(m=>m.id===this.lesson!.job(s.step.id)?.momentId&&m.cue.kind==='received'&&m.cue.jobId===incoming.step.id)&&(typeof s.step.actor==='number'?s.step.actor===owner.number:s.step.actor.receiverOf===incoming.step.id));
    const job=next&&this.lesson.job(next.step.id);
    return job&&!job.repeat?this.lesson.options(job,owner,players,ball,support,time,ordinary,next?.aim,true):ordinary;
   }
   const s=this.states.find(s=>s.actor===owner.id&&['active','arrived'].includes(s.phase)),job=s?this.lesson.job(s.step.id):undefined;
   return s&&job?this.lesson.options(job,owner,players,ball,support,time,ordinary,s.aim):ordinary;
  }
  if(this.adaptive)return this.preferences(time,owner,players,ball,ordinary);
  if(this.ended||owner.id!==ball.owner||owner.side!==this.side)return ordinary;
  const s=this.states.find(s=>s.actor===owner.id&&['active','arrived'].includes(s.phase));if(!s)return ordinary;
  if(s.step.action==='carry'||s.step.action==='hold')return [{kind:'carry',aim:{...s.aim!},score:1,reason:`Acțiunea ${s.step.id}: ${s.step.action==='carry'?'conduce fizic mingea spre punctul desenat':'așteaptă la punct cu mingea'}.`,teachingStep:s.step.id}];
  if(s.step.action==='move')return ordinary;
  if(s.step.action==='shoot'){
   const shot=assessShot(owner,players);return [{kind:'shoot',aim:shot.aim,score:1,reason:`Acțiunea ${s.step.id}: încearcă șutul cerut.`,teachingStep:s.step.id}];
  }
  const choices=this.passChoices(s,owner,players,ball,support,time),choice=choices[0];
  if(choice){
   if(s.target!==choice.target){s.target=choice.target;this.note(s,time,'active',choice.reason,choice.target);}
   return [choice];
  }
  this.note(s,time,'active','Nu există acum un coleg liber și o pasă executabilă; caută scurt, apoi revine la joc liber.');
  if(time-s.started!>2.4){this.abort(time,'Nicio ieșire liberă pentru pasa cerută după 2,4 secunde.');return ordinary;}
  return [{kind:'carry',aim:{x:owner.x,y:owner.y},score:1,reason:`Acțiunea ${s.step.id}: așteaptă o ieșire reală.`,teachingStep:s.step.id}];
 }
 canRelease(time:number,p:PracticePlayer,option:Option,players:PracticePlayer[],ball:MovingBall,support:SupportPlan|null):boolean {
  if(!option.teachingStep)return true;
  const s=this.state(option.teachingStep);if(this.ended||this.continuity.suspended||!s||s.phase!=='active'||s.actor!==p.id)return false;
  if(this.adaptive)return true;
  if(option.kind==='shoot')return true;
  return this.passChoices(s,p,players,ball,support,time).some(o=>o.target===option.target&&o.kind===option.kind);
 }
 released(time:number,p:PracticePlayer,option:Option){
  if(this.ended)return;
  if(this.combination?.coach.active){
   const c=this.combination; c.coach.release(time,p,option);
   if([c.coach.config.carrier,c.coach.config.partner].includes(p.number)){c.step.released??=time;c.step.target=option.target;}
   this.flushCombination();return;
  }
  const s=this.adaptive?this.states.find(s=>s.actor===p.id&&s.phase==='active'):option.teachingStep?this.state(option.teachingStep):undefined;
  if(!s||s.actor!==p.id||s.phase!=='active')return;
  const alternativePass=s.step.action==='pass'&&s.step.fallback&&['pass','through','loft'].includes(option.kind);
  if(this.lesson&&!this.matches(s.step,option,p)&&!alternativePass){
   s.phase='interrupted';this.note(s,time,'interrupted',`#${p.number} a executat ${option.kind==='shoot'?'un șut':'o altă pasă'}; această responsabilitate se încheie, celelalte continuă.`,option.target,this.lesson.evaluations.get(s.step.id));return;
  }
  if(this.adaptive&&!this.matches(s.step,option,p)&&!alternativePass){
   this.abort(time,`#${p.number} a ales ${option.kind==='shoot'?'șutul':option.kind==='clear'?'degajarea':'o altă pasă'}; continuă din noua situație.`);return;
  }
  s.released=time;s.target=option.target;s.phase='released';
  const allowedAlternative=!!this.lesson&&s.step.action==='pass'&&alternativePass&&!this.matches(s.step,option,p);
  this.note(s,time,'released',s.step.action==='shoot'?'Piciorul a lovit mingea: șut încercat, fără rezultat presupus.':allowedAlternative?'A eliberat o pasă alternativă permisă; primirea nu este încă reușită.':'Piciorul a eliberat pasa; primirea nu este încă reușită.',option.target,this.lesson?{...this.lesson.evaluations.get(s.step.id),chosen:{kind:option.kind,target:option.target,aim:{...option.aim},score:option.score}}:undefined,allowedAlternative?'alternative':'attempted');
  if(s.step.action==='shoot'){s.phase='complete';this.note(s,time,'complete','Acțiunea de șut a fost executată; rezultatul rămâne în joc.');}
  else this.flight=s;
 }
 received(time:number,p:PracticePlayer,from:string,wasPass:boolean){
  if(this.ended)return;
  if(p.side!==this.side){this.abort(time,'Adversarul a câștigat mingea.');return;}
  if(this.combination?.coach.active&&!this.ended){
   const c=this.combination,before=c.coach.notes.length;c.coach.receive(time,p,from,wasPass);
   if(c.coach.notes.slice(before).some(n=>n.kind==='receipt')){c.step.received??=time;c.step.receiver=p.id;}
   this.flushCombination();return;
  }
  const s=this.flight;if(this.ended||!s)return;
  if(!wasPass||s.actor!==from){
   // Collecting a rebound is real control, but not the pass receipt the graph
   // was waiting for. A passer can retry; another collector gets a fresh read.
   if(p.id===s.actor){this.flight=null;s.phase='active';s.released=undefined;s.target=undefined;this.note(s,time,'adapted','A recuperat mingea desprinsă; poate căuta din nou pasa, fără o primire atribuită colegului.');return;}
   this.abort(time,'Un coleg a recuperat mingea liberă, fără primirea așteptată; caută o continuare din noua situație.');return;
  }
  if(this.lesson&&p.id===from){
   // own() also reports the passer collecting their own still-live ball. That
   // real control contact is not a completed teammate pass or a receiver cue.
   this.flight=null;s.phase='interrupted';
   const text=`#${p.number} și-a reluat controlul propriei pase; niciun coleg nu a primit-o. Această pasă se încheie, celelalte responsabilități continuă.`;
   this.note(s,time,'interrupted',text,p.id,{reference:p.id,blockers:[{kind:'possession',actor:p.id,text:'Pasa a revenit la executant; nu există un primitor coleg pentru continuare.'}]});
   return;
  }
  s.receiver=p.id;s.received=time;s.phase='received';this.flight=null;
  this.note(s,time,'received',`#${p.number} a primit efectiv pasa${p.id!==s.target?' în locul destinatarului ales':''}; el este jucătorul pentru „cine primește”.`,p.id);
  for(const run of this.states)if(run.actor===p.id&&run.step.action==='move'&&run.phase==='active'){
   run.phase='interrupted';this.note(run,time,'interrupted',this.lesson?`A primit mingea; trece de la cursă la decizia cu mingea.${run.arrived!==undefined?' Sosirea deja observată rămâne în istoric.':''}`:'Primirea mingii a întrerupt cursa fără minge înainte de punct; nu marchează sosirea.');
  }
  // A routine's run from the kick was made for its delivery. Once that ball
  // is someone else's, the run is over: he rejoins open play instead of
  // holding the drawn space for the rest of the routine.
  const delivery=this.routine?this.lesson?.job(s.step.id):undefined;
  if(delivery&&this.lesson!.lesson.moments.find(m=>m.id===delivery.momentId)?.cue.kind==='start')for(const run of this.states){
   const job=this.lesson!.job(run.step.id),kick=job&&this.lesson!.lesson.moments.find(m=>m.id===job.momentId)?.cue.kind==='restart-taken';
   if(!job||!kick||job.kind!=='run'||!['active','waiting'].includes(run.phase)||run.actor===p.id)continue;
   if(!(typeof delivery.recipient==='number'?run.step.actor===delivery.recipient:!!delivery.spaceId&&job.spaceId===delivery.spaceId))continue;
   run.phase='interrupted';this.note(run,time,'interrupted',`Mingea fazei fixe a ajuns la #${p.number}; cursa desenată pentru ea s-a încheiat și revine în joc.`);
  }
 }
}
