import {L,W} from './pitch.js';
import {clamp} from './model.js';
import type {Side} from './model.js';
import type {Vec,MovingBall} from './movement.js';
import {steerMotion} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {ActionActor,TeachingNumber} from './practice-teaching.js';
import {validateLesson,LessonResponsibilities,PASS_OPENING_SECONDS} from './practice-lesson.js';
import {carryOptions} from './practice-carry.js';
import {assessShot} from './practice-football.js';
import {passFlightTime} from './practice-passing.js';
import type {LessonSpec,LessonSpace,LessonMoment,LessonEvidence,LessonEntry,EntryCondition,LessonJob} from './practice-lesson.js';
import {arrivalTime} from './practice-defense.js';
import {groundPass,groundPassCandidates} from './practice-passing.js';
import {loftPass,loftCandidates} from './practice-loft.js';
import {strikePowerLimit} from './practice-striking.js';
import {launchRisk,possessionSafety} from './practice-possession.js';

type Risk=(from:Vec,to:Vec,opponents:PracticePlayer[],speed?:number)=>number;
export interface RecognitionCheck {stage?:'ready'|'developing';quality?:number;source:'entry'|'opportunity';conditionIndex?:number;evaluated:boolean;kind:string;available:boolean;text:string;actor?:string;target?:string;spaceId?:string;value?:number;aim?:Vec;risk?:number;controlRisk?:number;reachMargin?:number}
type RecognitionReading=Omit<RecognitionCheck,'source'|'conditionIndex'|'evaluated'>;
export interface RecognisedEntry {
 momentId:string;independent:boolean;automatic?:boolean;eligible:boolean;score:number;reasons:string[];
 bindings:Record<string,number>;resolvedSpaces:LessonSpace[];
 evidence:LessonEvidence&{checks:RecognitionCheck[]};
 allowedMoments:string[];continuingJobs?:string[];receiverBindings:Record<string,TeachingNumber>;
}
export interface LessonRecognition {entries:RecognisedEntry[];best?:RecognisedEntry}
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(p:Vec)=>p.x>=.8&&p.x<=L-.8&&Math.abs(p.y)<=W/2-1;
const turn=(p:PracticePlayer,to:Vec)=>Math.abs(Math.atan2(Math.sin(Math.atan2(to.y-p.y,to.x-p.x)-p.angle),Math.cos(Math.atan2(to.y-p.y,to.x-p.x)-p.angle)));
export function usesRecognition(lesson:LessonSpec):boolean {return lesson.jobs.length>0;}

/** Mid-entry retains causal descendants, not preceding chronology or fabricated events. */
export function entryMoments(lesson:LessonSpec,moment:LessonMoment,independent:boolean):string[] {
 if(!independent)return lesson.moments.map(m=>m.id);
 const retained=new Set([moment.id]);
 for(let i=0;i<lesson.moments.length;i++)for(const m of lesson.moments){
  const cue=m.cue,source=cue.kind==='received'||cue.kind==='released'?cue.jobId:cue.kind==='pressed'&&typeof cue.actor!=='number'?cue.actor.receiverOf:undefined;
  const sources=[...(source?[source]:[]),...lesson.jobs.filter(j=>j.momentId===m.id&&typeof j.actor!=='number').map(j=>(j.actor as {receiverOf:string}).receiverOf)];
  if(sources.some(key=>lesson.jobs.some(j=>j.id===key&&retained.has(j.momentId))))retained.add(m.id);
 }
 return [...retained];
}
/** Retain ongoing support from the causal ancestors of a continuation. Starting
 * those responsibilities now never asserts that an earlier run or pass happened. */
function continuingResponsibilities(lesson:LessonSpec,moment:LessonMoment):LessonJob[] {
 const ancestors:LessonMoment[]=[],seen=new Set<string>();
 const visit=(m:LessonMoment)=>{
  if(seen.has(m.id))return;seen.add(m.id);
  const c=m.cue;
  const source=c.kind==='received'||c.kind==='released'?lesson.jobs.find(j=>j.id===c.jobId):c.kind==='pressed'?lesson.jobs.find(j=>j.kind==='advance'&&j.momentId!==m.id&&JSON.stringify(j.actor)===JSON.stringify(c.actor)):undefined;
  const parent=source?lesson.moments.find(p=>p.id===source.momentId):c.kind==='pressed'?lesson.moments.find(p=>p.cue.kind==='start'):undefined;
  if(parent){visit(parent);ancestors.push(parent);}
 };
 visit(moment);
 const slot=(actor:ActionActor):number|undefined=>typeof actor==='number'?actor:moment.entry?.receiverBindings?.[actor.receiverOf]??(typeof lesson.jobs.find(j=>j.id===actor.receiverOf)?.recipient==='number'?lesson.jobs.find(j=>j.id===actor.receiverOf)!.recipient as number:undefined);
 const replaced=new Set(lesson.jobs.filter(j=>j.momentId===moment.id).map(j=>slot(j.actor)).filter(n=>n!==undefined));
 if(moment.entry)replaced.add(moment.entry.carrier);
 const latest=new Map<number,LessonJob>();
 for(const ancestor of ancestors)for(const job of lesson.jobs.filter(j=>j.momentId===ancestor.id)){const n=slot(job.actor);if(n!==undefined)latest.set(n,job);}
 return [...latest].filter(([n,j])=>!replaced.has(n)&&['run','offer','occupy','hold'].includes(j.kind)&&(typeof j.actor==='number'||moment.entry?.receiverBindings?.[j.actor.receiverOf]!==undefined)).map(([,j])=>j);
}
function usedSlots(lesson:LessonSpec,moment:LessonMoment,allowed:string[],independent:boolean):TeachingNumber[]{
 const used=new Set<TeachingNumber>(),spaces=new Set<string>();
 const add=(a:ActionActor)=>{if(typeof a==='number')used.add(a);};
 for(const j of lesson.jobs.filter(j=>allowed.includes(j.momentId))){add(j.actor);if(typeof j.teammate==='number')used.add(j.teammate);if(typeof j.recipient==='number')used.add(j.recipient);if(j.spaceId)spaces.add(j.spaceId);}
 for(const m of lesson.moments.filter(m=>allowed.includes(m.id)&&(!independent||m.id!==moment.id)))if(m.cue.kind==='pressed')add(m.cue.actor);
 if(independent&&moment.entry){used.add(moment.entry.carrier);for(const n of Object.values(moment.entry.receiverBindings??{}))used.add(n);for(const c of moment.entry.conditions){if(c.kind!=='pressed')spaces.add(c.spaceId);if(c.kind==='delivery')used.add(c.runner);}}
 for(const s of lesson.spaces)if(spaces.has(s.id)&&s.anchor?.kind==='player')used.add(s.anchor.number);
 return [...used].sort();
}
export function resolveLessonSpaces(lesson:LessonSpec,side:Side,players:PracticePlayer[],bindings:Record<string,number>):LessonSpace[]{
 const sign=side===0?1:-1;
 return lesson.spaces.map(s=>{
  if(!s.anchor)return {...s,x:side===0?s.x:L-s.x,y:sign*s.y};
  const a=s.anchor,p=players.find(p=>p.side===(a.kind==='player'?side:1-side)&&p.number===(a.kind==='player'?bindings[a.number]??a.number:a.number));
  return {...s,x:p?p.x+sign*a.dx:NaN,y:p?p.y+sign*a.dy:NaN};
 });
}
const points=(space:LessonSpace)=>[{x:space.x,y:space.y},...Array.from({length:8},(_,i)=>({x:space.x+Math.cos(i*Math.PI/4)*space.radius*.72,y:space.y+Math.sin(i*Math.PI/4)*space.radius*.72}))].filter(inside);
function spaceRead(space:LessonSpace,p:PracticePlayer,players:PracticePlayer[]):RecognitionReading {
 const options=points(space).map(aim=>({aim,room:Math.min(...players.filter(q=>q.side!==p.side).map(q=>distance(q,aim))),crowding:Math.min(...players.filter(q=>q.side===p.side&&q.id!==p.id).map(q=>distance(q,aim))),travel:arrivalTime(p,aim)}));
 const best=options.filter(r=>r.room>=1.5&&r.crowding>=1.1&&r.travel<=6).sort((a,b)=>(b.room*.15-b.travel*.15)-(a.room*.15-a.travel*.15))[0];
 return {kind:'space',spaceId:space.id,actor:p.id,available:!!best,...(best?{aim:best.aim,value:best.room}:{}),text:best?`Pentru ${p.name} (#${p.number}), spațiul „${space.name}” are o destinație accesibilă; spațiu estimat ${best.room.toFixed(1)} m.`:`Pentru ${p.name} (#${p.number}), spațiul „${space.name}” nu are acum o destinație liberă și accesibilă în teren.`};
}
function deliveryRead(owner:PracticePlayer,runner:PracticePlayer,space:LessonSpace,players:PracticePlayer[],ball:MovingBall,delivery:'auto'|'ground'|'loft',invitedRun:boolean):RecognitionReading {
 if(owner.id===runner.id)return {kind:'delivery',available:false,spaceId:space.id,text:'Purtătorul și alergătorul trebuie să fie jucători diferiți.'};
 const opponents=players.filter(p=>p.side!==owner.side),destinations=points(space).map(aim=>({aim,travel:arrivalTime(runner,aim),room:Math.min(...opponents.map(p=>distance(p,aim)))})).filter(r=>r.travel<=6&&r.room>=1.5).sort((a,b)=>(b.room*.12-b.travel*.2)-(a.room*.12-a.travel*.2)).slice(0,3);
 const reads=[];
 for(const {aim} of destinations){
  const run=invitedRun?{aim,speed:runner.pace*.94}:undefined;
  if(delivery!=='loft')reads.push({kind:'ground',...groundPass(owner,runner,invitedRun,run,ball,opponents,invitedRun?space:undefined)});
  // Height is an ordinary alternative when the ground option is not plausible.
  if(delivery==='loft'||delivery==='auto'&&!reads.some(r=>r.risk<.5&&r.controlRisk<.6&&r.reachMargin>-.65&&distance(r.aim,space)<=space.radius+1.5))reads.push({delivery:'loft',...loftPass(owner,runner,run,ball,opponents,invitedRun?space:undefined)});
 }
 const ordered=reads.map(r=>({...r,launch:launchRisk(owner,r.aim,players),inSpace:distance(r.aim,space)<=space.radius+1.5})).sort((a,b)=>(a.risk+a.controlRisk*.6+Math.max(0,-a.reachMargin)*.4+a.launch)-(b.risk+b.controlRisk*.6+Math.max(0,-b.reachMargin)*.4+b.launch));
 const best=ordered.find(r=>r.inSpace&&Number.isFinite(r.flight)&&r.risk<.62&&r.controlRisk<.62&&r.reachMargin>-.7&&r.launch<.6),seen=best??ordered[0];
 return {kind:'delivery',available:!!best,actor:owner.id,target:runner.id,spaceId:space.id,...(seen?{aim:seen.aim,risk:seen.risk,controlRisk:seen.controlRisk,reachMargin:seen.reachMargin}:{}),text:best?`Există o livrare estimată spre #${runner.number} în „${space.name}”; riscul evaluat este ${Math.round(best.risk*100)}%.`:`Nu există acum o livrare plauzibilă către #${runner.number} în „${space.name}”.`};
}

/** A starting pass needs a joint meeting, not merely an empty destination.
 * Opposition risk ranks the opportunity; it does not veto an ambitious idea. */
function openingDelivery(owner:PracticePlayer,runner:PracticePlayer,space:LessonSpace|undefined,players:PracticePlayer[],ball:MovingBall,delivery:'auto'|'ground'|'loft',invited:boolean,allowPreparation=true):RecognitionReading {
 const opponents=players.filter(p=>p.side!==owner.side),run=invited&&space?{aim:{x:space.x,y:space.y},speed:runner.pace*.94}:undefined;
 const candidates=[...(delivery!=='loft'?groundPassCandidates(owner,runner,invited,run,ball,opponents,space):[]),...(delivery!=='ground'?loftCandidates(owner,runner,run,ball,opponents,space):[])];
 const fitting=candidates.filter(c=>(!space||distance(c.aim,space)<=space.radius+1.5)&&Number.isFinite(c.flight)&&c.flight>0&&c.reachMargin>-.7&&Math.hypot(c.speed,'vz' in c?c.vz:0)<=strikePowerLimit(owner,ball,c.aim)+.01);
 const best=fitting.sort((a,b)=>a.risk+a.controlRisk*.5-b.risk-b.controlRisk*.5)[0];
 if(!best&&run&&allowPreparation){
  const safety=possessionSafety(owner,players);
  if(safety.contactTime>.7&&safety.urgency<.25){
   const moving={...runner};for(let t=0;t<PASS_OPENING_SECONDS;t+=.1)steerMotion(moving,run.aim,Math.min(.1,PASS_OPENING_SECONDS-t),run.speed);
   const later=openingDelivery(owner,moving,space,players.map(p=>p.id===runner.id?moving:p),ball,delivery,true,false);
   if(later.available)return {...later,stage:'developing',quality:.5,text:`#${runner.number} poate crea legătura după aproximativ ${PASS_OPENING_SECONDS.toFixed(1)} s de cursă, dacă #${owner.number} păstrează controlul. Pasa nu este încă disponibilă; presiunea se reevaluează în joc.`};
  }
 }
 return {kind:'connection',actor:owner.id,target:runner.id,spaceId:space?.id,available:!!best,stage:'ready',...(best?{aim:best.aim,risk:best.risk,controlRisk:best.controlRisk,reachMargin:best.reachMargin,value:best.flight}:{}),text:best?`#${owner.number} și #${runner.number} pot lega pasa ${delivery==='loft'?'pe sus':delivery==='ground'?'pe jos':'cerută'} ${space?`în „${space.name}”`:`spre #${runner.number}`} în aproximativ ${best.flight.toFixed(1)} s de zbor. Riscul estimat: ${Math.round(best.risk*100)}%; adversarii pot interveni.`:`Pasa și deplasarea lui #${runner.number} nu au încă un punct de întâlnire accesibil ${space?`în „${space.name}”`:`spre #${runner.number}`}; o zonă liberă singură nu este suficientă.`};
}

/** Interpret each responsibility with the same proposals used during execution.
 * A developing movement is not a promise that a later pass or opponent response exists. */
function responsibilityRead(job:LessonJob,p:PracticePlayer,players:PracticePlayer[],ball:MovingBall,interpreter:LessonResponsibilities,risk:Risk):RecognitionReading {
 const space=interpreter.space(job),base={kind:job.kind,actor:p.id,...(space?{spaceId:space.id}:{})};
 if(space&&!points(space).length)return {...base,available:false,text:`Zona pentru #${p.number} nu intersectează terenul.`};
 if(['offer','run','occupy'].includes(job.kind)&&p.id===ball.owner)return {...base,available:false,text:`#${p.number} are mingea; această responsabilitate cere un jucător fără minge.`};
 if(['offer','run','occupy'].includes(job.kind)||job.kind==='hold'&&p.id!==ball.owner){
  const read=interpreter.movement(job,p,players,ball,null,0,p),evidence=interpreter.evaluations.get(job.id);
  if(!read)return {...base,available:false,text:`#${p.number}: ${evidence?.blockers?.map(b=>b.text).join(' ')||'Relația cerută nu este disponibilă.'}`};
  const chosen=evidence?.options?.find(o=>distance(o.aim,read.aim)<.1),stage=distance(p,read.aim)>1?'developing' as const:'ready' as const;
  return {...base,available:true,stage,aim:read.aim,target:evidence?.reference,risk:chosen?.laneRisk,quality:clamp(.7-(chosen?.laneRisk??0)*.2-(chosen?.travel??0)*.04,.1,1),text:`#${p.number}: ${read.reason}${stage==='developing'?' Poziția trebuie creată prin deplasare; nu este încă realizată.':''}`};
 }
 if(job.kind==='advance'||job.kind==='hold'){
  if(space&&distance(p,space)<=space.radius||job.kind==='hold'&&!space)return {...base,available:true,stage:'ready',aim:{x:p.x,y:p.y},quality:.7,text:`#${p.number} este deja în zona cerută; poate păstra controlul și citi continuarea.`};
  const options=interpreter.options(job,p,players,ball,null,0,carryOptions(p,players,0,risk)),read=interpreter.evaluations.get(job.id);
  const matching=read?.options?.filter(o=>o.matches).sort((a,b)=>(b.score+(b.preference??0))-(a.score+(a.preference??0)))[0];
  const option=matching?options.find(o=>o.kind===matching.kind&&distance(o.aim,matching.aim)<.1):undefined;
  return {...base,available:!!matching,stage:'developing',...(matching?{aim:matching.aim,risk:option?.carry?.contactRisk,quality:clamp(.7-(option?.carry?.contactRisk??0)*.25,.1,1)}:{}),text:matching?`#${p.number} poate începe să conducă spre „${space?.name??'zona cerută'}”, evaluând următoarele atingeri. Un adversar mai departe poate fi provocat; pasa sau șutul de după nu trebuie să fie deja deschis.`:`#${p.number} nu are o deplasare evaluată în direcția cerută.`};
 }
 const shot=assessShot(p,players),flight=passFlightTime(shot.distance,strikePowerLimit(p,ball,shot.aim,'shot'));
 return {...base,available:Number.isFinite(flight),stage:'ready',aim:shot.aim,quality:shot.quality,risk:shot.pressure,text:`#${p.number} poate evalua șutul de la ${shot.distance.toFixed(1)} m; unghi ${Math.round(shot.angle*180/Math.PI)}°. Presiunea, precizia și portarul influențează alegerea și execuția.`};
}

/** Infer useful continuation states from the lesson itself. Nothing is authored
 * or marked received here: the player already controlling the ball is a possible
 * participant in the remaining idea, subject to the live relationship checks. */
function automaticSource(lesson:LessonSpec,m:LessonMoment,owner:PracticePlayer|undefined):{m:LessonMoment;independent:true;automatic:true;receiptSpace?:string}|undefined{
 if(m.entry||!owner||!['received','pressed'].includes(m.cue.kind))return;
 const cue=m.cue;
 const reference=cue.kind==='received'?cue.jobId:cue.kind==='pressed'&&typeof cue.actor!=='number'?cue.actor.receiverOf:undefined;
 const source=lesson.jobs.find(j=>j.id===reference);
 const runners=source?.spaceId?lesson.jobs.filter(j=>j.momentId===source.momentId&&j.kind==='run'&&j.spaceId===source.spaceId&&typeof j.actor==='number'):[];
 const runner=runners.length===1?runners[0]:undefined;
 const inferred=typeof source?.recipient==='number'?source.recipient:typeof runner?.actor==='number'?runner.actor:owner.number as TeachingNumber;
 const carrier=cue.kind==='pressed'&&typeof cue.actor==='number'?cue.actor:inferred;
 const entry:LessonEntry={carrier,conditions:cue.kind==='pressed'?[{kind:'pressed'}]:[],...(reference?{receiverBindings:{[reference]:carrier}}:{})};
 return {m:{...m,entry},independent:true,automatic:true,...(cue.kind==='received'&&source?.spaceId?{receiptSpace:source.spaceId}:{})};
}

/** Deterministic, side-effect-free recognition. No fixture seed or simulated future outcomes. */
export function previewLessonRecognition(input:LessonSpec,side:Side,players:PracticePlayer[],ball:MovingBall,risk:Risk):LessonRecognition {
 const lesson=validateLesson(input),owner=players.find(p=>p.id===ball.owner&&p.side===side&&p.role!=='GK'),entries:RecognisedEntry[]=[];
 const roots=lesson.moments.filter(m=>m.cue.kind==='start');
 const sources:{m:LessonMoment;independent:boolean;automatic?:boolean;receiptSpace?:string}[]=[...roots.map(m=>({m,independent:false})),...lesson.moments.filter(m=>!!m.entry).map(m=>({m,independent:true})),...lesson.moments.flatMap(m=>{const source=automaticSource(lesson,m,owner);return source?[source]:[];})];
 // A pressure-only initial lesson still has a natural possession entry, without claiming pressure occurred.
 if(!roots.length&&!sources.length&&lesson.moments[0])sources.push({m:lesson.moments[0],independent:false});
 const deliveryCache=new Map<string,RecognitionReading>();
 for(const {m,independent,automatic,receiptSpace} of sources){
  const continuing=independent?continuingResponsibilities(lesson,m):[];
  const contextual={...lesson,jobs:lesson.jobs.map(j=>continuing.some(c=>c.id===j.id)?{...j,momentId:m.id}:j)};
  const allowed=entryMoments(lesson,m,independent),jobs=contextual.jobs.filter(j=>allowed.includes(j.momentId)),slots=usedSlots(contextual,m,allowed,independent);
  const previousSpace=lesson.spaces.find(s=>s.id===receiptSpace);
  if(previousSpace?.anchor?.kind==='player'&&!slots.includes(previousSpace.anchor.number))slots.push(previousSpace.anchor.number);
  const base=():RecognisedEntry=>({momentId:m.id,independent,...(automatic?{automatic:true}:{}),eligible:false,score:0,reasons:[],bindings:{},resolvedSpaces:[],evidence:{checks:[]},allowedMoments:allowed,...(continuing.length?{continuingJobs:continuing.map(j=>j.id)}:{}),receiverBindings:{}});
  const unavailableConditions=(e:RecognisedEntry,reason:string)=>{if(independent)m.entry!.conditions.forEach((c,conditionIndex)=>e.evidence.checks.push({source:'entry',conditionIndex,evaluated:false,kind:c.kind,available:false,...(c.kind!=='pressed'?{spaceId:c.spaceId}:{}),text:`Condiția ${conditionIndex+1} nu poate fi evaluată: ${reason}`}));};
  if(!owner||ball.mode!=='control'||(ball.z??0)>.3||distance(owner,ball)>1.4){const e=base();e.reasons=['E nevoie de control real al mingii de către un jucător de câmp.'];e.evidence.checks=[{source:'opportunity',evaluated:true,kind:'control',available:false,text:e.reasons[0]}];unavailableConditions(e,e.reasons[0]);entries.push(e);continue;}
  const assignments:Record<string,number>[]=[];
  const assign=(i:number,b:Record<string,number>,taken:Set<number>)=>{
   if(i===slots.length){assignments.push({...b});return;}
   const slot=slots[i],role=lesson.roles?.[slot],entryCarrier=independent&&m.entry?.carrier===slot;
   const candidates=players.filter(p=>p.side===side&&p.role!=='GK'&&!taken.has(p.number)&&(entryCarrier?p.id===owner.id&&(!!role||p.number===slot):role==='carrier'&&!independent?p.id===owner.id:role?p.id!==owner.id:p.number===slot));
   for(const p of candidates){b[slot]=p.number;taken.add(p.number);assign(i+1,b,taken);taken.delete(p.number);delete b[slot];}
  };
  assign(0,{},new Set());let best:RecognisedEntry|undefined;
  for(const bindings of assignments){
   const e=base();e.bindings=bindings;e.resolvedSpaces=resolveLessonSpaces(lesson,side,players,bindings);
   const bound=(n:TeachingNumber)=>players.find(p=>p.side===side&&p.number===(bindings[n]??n));
   const overrides=independent?m.entry?.receiverBindings??{}:{};
   for(const [key,n] of Object.entries(overrides))if(!jobs.some(j=>j.id===key))e.receiverBindings[key]=(bindings[n]??n) as TeachingNumber;
   const actor=(a:ActionActor)=>typeof a==='number'?bound(a):e.receiverBindings[a.receiverOf]!==undefined?players.find(p=>p.side===side&&p.number===e.receiverBindings[a.receiverOf]):undefined;
   const check=(row:RecognitionReading,conditionIndex?:number)=>e.evidence.checks.push({...row,source:conditionIndex===undefined?'opportunity':'entry',evaluated:true,...(conditionIndex!==undefined?{conditionIndex}:{})});
   if(automatic&&receiptSpace){
    const space=e.resolvedSpaces.find(s=>s.id===receiptSpace)!;
    const gap=distance(owner,space),available=Number.isFinite(gap)&&gap<=space.radius+1.5;
    check({kind:'continuation',actor:owner.id,spaceId:space.id,available,value:gap,text:available?`${owner.name} controlează deja mingea în zona unde ideea urma să continue.`:'Mingea nu este încă în zona acestei continuări.'});
   }
   if(automatic&&m.cue.kind==='received'&&!receiptSpace){
    // A named recipient can supply the relationship; an unqualified free pass
    // cannot make every place on the pitch resemble an arbitrary continuation.
    const source=lesson.jobs.find(j=>j.id===(m.cue as {jobId:string}).jobId);
    const named=typeof source?.recipient==='number';
    const purposeful=jobs.some(j=>j.momentId===m.id&&(!!j.spaceId||j.kind==='offer'||j.kind==='occupy'));
    check({kind:'continuation',actor:owner.id,available:named||purposeful,text:named||purposeful?'Purtătorul și relațiile continuării pot fi identificați din situația prezentă.':'Continuarea nu are încă o relație spațială sau un primitor identificabil.'});
   }
   if(!jobs.length)check({kind:'jobs',available:false,text:'Momentul nu are responsabilități de încercat.'});
   const starting=jobs.filter(j=>j.momentId===m.id||!independent&&lesson.moments.find(mm=>mm.id===j.momentId)?.cue.kind==='start');
   const occupied=new Set<string>();
   for(const j of starting){const p=actor(j.actor);if(p){const key=`${j.momentId}:${p.id}`;if(occupied.has(key))check({kind:'roles',available:false,actor:p.id,text:`#${p.number} ar primi două responsabilități simultane în același moment; folosește jucători distincți.`});occupied.add(key);}}
   for(const j of jobs){
    const a=j.actor;if(typeof a!=='number'&&!jobs.some(q=>q.id===a.receiverOf)&&!e.receiverBindings[a.receiverOf])check({kind:'dependency',available:false,text:'O continuare cere o primire anterioară care nu există la această intrare; leagă explicit jucătorul prezent.'});
   }
   for(const moment of lesson.moments.filter(mm=>allowed.includes(mm.id)&&(!independent||mm.id!==m.id))){const c=moment.cue;if(c.kind==='pressed'&&typeof c.actor!=='number'){const key=c.actor.receiverOf;if(!jobs.some(j=>j.id===key)&&!e.receiverBindings[key])check({kind:'dependency',available:false,text:'Presiunea dintr-un moment păstrat cere un primitor anterior; lipsește legătura explicită pentru intrarea directă.'});}}
   const bindingJob=(j:LessonJob):LessonJob=>({...j,actor:(actor(j.actor)?.number as TeachingNumber|undefined)??j.actor,...(typeof j.teammate==='number'?{teammate:(bindings[j.teammate]??j.teammate) as TeachingNumber}:{}),...(typeof j.recipient==='number'?{recipient:(bindings[j.recipient]??j.recipient) as TeachingNumber}:{})});
   const interpreter=new LessonResponsibilities({...lesson,spaces:e.resolvedSpaces.map(s=>({...s,anchor:undefined,x:side===0?s.x:L-s.x,y:side===0?s.y:-s.y})),jobs:starting.map(bindingJob)},side,risk,true);
   for(const j of starting){
    const p=actor(j.actor);if(!p){check({kind:'dependency',available:false,text:'Jucătorul acestui moment depinde de o primire care încă nu există.'});continue;}
    if(['advance','pass','shoot'].includes(j.kind)&&p.id!==owner.id&&!(j.repeat&&typeof j.recipient==='number'&&bindings[j.recipient]===owner.number)){check({kind:'carrier',available:false,actor:p.id,text:`#${p.number} trebuie să aibă mingea pentru responsabilitatea de început.`});continue;}
    if(j.kind!=='pass'){check(responsibilityRead(bindingJob(j),p,players,ball,interpreter,risk));continue;}
    if(j.spaceId){
     const s=e.resolvedSpaces.find(s=>s.id===j.spaceId)!;
     if(j.kind==='pass'){
      const candidates=players.filter(q=>q.side===side&&q.id!==owner.id&&q.role!=='GK'&&(typeof j.recipient!=='number'||q.number===bindings[j.recipient]));
      const reads=candidates.map(q=>{
       const invited=starting.some(r=>r.kind==='run'&&r.spaceId===s.id&&actor(r.actor)?.id===q.id);
       const key=`opening:${owner.id}:${q.id}:${s.id}:${s.x}:${s.y}:${s.radius}:${j.delivery??'auto'}:${invited}`;
       let read=deliveryCache.get(key);if(!read){read=openingDelivery(owner,q,s,players,ball,j.delivery??'auto',invited);deliveryCache.set(key,read);}return read;
      });check(reads.filter(r=>r.available).sort((a,b)=>(a.risk??0)-(b.risk??0))[0]??reads[0]??{kind:'connection',available:false,spaceId:s.id,text:'Nu există un coleg care poate folosi spațiul pasei.'});
     }
    }
    if(!j.spaceId){
     const recipient=j.repeat&&p.id!==owner.id?p:typeof j.recipient==='number'?bound(j.recipient):undefined;
     const candidates=players.filter(q=>q.side===side&&q.id!==owner.id&&q.role!=='GK'&&(!recipient||q.id===recipient.id));
     const reads=candidates.map(q=>openingDelivery(owner,q,undefined,players,ball,j.delivery??'auto',false));
     const best=reads.filter(r=>r.available).sort((a,b)=>(a.risk??0)-(b.risk??0))[0]??reads[0];
     check(best?{...best,spaceId:undefined}:{kind:'connection',available:false,text:'Lipsește un coleg distinct pentru pasa cerută.'});
    }
   }
   for(const [conditionIndex,c] of (independent?m.entry!.conditions:[]).entries()){
    const entryCheck=(row:RecognitionReading)=>check(row,conditionIndex);
    if(c.kind==='pressed'){
     const pressure=players.some(q=>q.side!==side&&(distance(q,owner)<2.7||distance(q,owner)<4.8&&((q.vx-owner.vx)*(owner.x-q.x)+(q.vy-owner.vy)*(owner.y-q.y))/Math.max(.01,distance(q,owner))>.35));
     entryCheck({kind:'pressed',available:pressure,actor:owner.id,text:pressure?'Presiune observată asupra purtătorului.':'Purtătorul nu este presat acum.'});
    }else {
     const s=e.resolvedSpaces.find(s=>s.id===c.spaceId)!;
     if(c.kind==='space'){
      const users=starting.filter(j=>j.spaceId===s.id&&['run','advance','hold'].includes(j.kind)).map(j=>actor(j.actor)).filter((p):p is PracticePlayer=>!!p);
      const reads=(users.length?users:[owner]).map(p=>spaceRead(s,p,players));entryCheck(reads.find(r=>r.available)??reads[0]);
     }
     else {const runner=bound(c.runner);if(!runner)entryCheck({kind:'delivery',available:false,spaceId:s.id,text:'Lipsește alergătorul acestei intrări.'});else {
      const invited=starting.some(j=>j.kind==='run'&&j.spaceId===s.id&&actor(j.actor)?.id===runner.id);
      const key=`${owner.id}:${runner.id}:${s.id}:${s.x}:${s.y}:${s.radius}:${c.delivery??'auto'}:${invited}`;let read=deliveryCache.get(key);if(!read){read=deliveryRead(owner,runner,s,players,ball,c.delivery??'auto',invited);deliveryCache.set(key,read);}entryCheck(read);
     }}
    }
   }
   const qualities=e.evidence.checks.filter(c=>c.quality!==undefined);
   let suitability=.65+(automatic?.08:0)+(qualities.length?qualities.reduce((sum,c)=>sum+(c.quality!-.65)*.2,0)/qualities.length:0);const roleValues:number[]=[];
   for(const slot of slots){const role=lesson.roles?.[slot],p=bound(slot)!;if(!role)continue;
    if(role==='support'&&p.id!==owner.id){const gap=distance(p,owner);roleValues.push(.1*(1-clamp(Math.abs(gap-8)/16,0,1))+.08*(1-risk(owner,p,players.filter(q=>q.side!==side)))-turn(p,owner)*.015+(p.skills.passing+p.skills.control)*.001);}
    if(role==='runner'){const space=e.resolvedSpaces.find(s=>jobs.some(j=>j.actor===slot&&j.kind==='run'&&j.spaceId===s.id));if(space&&Number.isFinite(space.x))roleValues.push(.12*clamp(1-arrivalTime(p,space)/6,0,1)+p.skills.reading*.002-turn(p,space)*.012);}
   }
   if(roleValues.length)suitability+=roleValues.reduce((a,b)=>a+b,0)/roleValues.length;
   for(const slot of slots){const p=bound(slot)!,role=lesson.roles?.[slot];if(role)check({kind:'role',available:true,actor:p.id,text:`Slotul #${slot} (${{carrier:'purtător',support:'sprijin',runner:'alergător'}[role]}) este legat de #${p.number} pentru această încercare; alegerea compară poziția, orientarea și timpul disponibil.`});}
   const delivery=e.evidence.checks.find(c=>c.kind==='delivery'&&c.available);if(delivery)suitability+=.16*(1-(delivery.risk??0))*(1-(delivery.controlRisk??0));
   const connections=e.evidence.checks.filter(c=>c.kind==='connection'&&c.available);
   if(connections.length)suitability-=connections.reduce((sum,c)=>sum+(c.risk??0)*.18+(c.controlRisk??0)*.08,0)/connections.length;
   suitability-=possessionSafety(owner,players).urgency*.08;
   e.eligible=e.evidence.checks.every(c=>c.available);e.score=e.eligible?clamp(suitability,.1,1):0;
   e.reasons=e.evidence.checks.filter(c=>!c.available).map(c=>c.text);if(!e.reasons.length)e.reasons=[automatic?`Recunoaște continuarea „${m.name}” în situația prezentă.`:independent?`Poate începe direct la „${m.name}”, fără evenimente anterioare inventate.`:`Relațiile de început sunt disponibile pentru „${m.name}”.`];
   e.evidence.entry={momentId:m.id,independent,bindings};
   if(!best||Number(e.eligible)>Number(best.eligible)||e.eligible===best.eligible&&(e.score>best.score||e.score===best.score&&e.reasons.length<best.reasons.length))best=e;
  }
  if(!best){best=base();best.reasons=['Jucătorii specifici și rolurile cerute nu pot fi legați distinct de jucătorii prezenți.'];best.evidence.checks=[{source:'opportunity',evaluated:true,kind:'roles',available:false,text:best.reasons[0]}];unavailableConditions(best,best.reasons[0]);}
  entries.push(best);
 }
 // An inferred continuation skips the parts the manager drew before it (the
 // drop short before the lay-off). It is for when the whole idea cannot start
 // now; when the whole idea can, the players play the whole idea. Authored
 // entries are the manager's own choice and still compete on score.
 const best=entries.filter(e=>e.eligible).sort((a,b)=>Number(!!a.automatic)-Number(!!b.automatic)||b.score-a.score||Number(a.independent)-Number(b.independent))[0];
 return {entries,...(best?{best}:{})};
}

/** Bind numbered coaching slots once; receiverOf remains a true event reference. */
export function bindRecognisedLesson(lesson:LessonSpec,entry:RecognisedEntry):LessonSpec {
 const n=(slot:TeachingNumber)=>(entry.bindings[slot]??slot) as TeachingNumber;
 const a=(actor:ActionActor):ActionActor=>typeof actor==='number'?n(actor):actor;
 return {...lesson,roles:undefined,spaces:lesson.spaces.map(s=>({...s,...(s.anchor?{anchor:{...s.anchor,number:s.anchor.kind==='player'?n(s.anchor.number):s.anchor.number}}:{})})),moments:lesson.moments.map(m=>({...m,cue:m.cue.kind==='pressed'?{...m.cue,actor:a(m.cue.actor)}:m.cue})),jobs:lesson.jobs.map(j=>({...j,...(entry.continuingJobs?.includes(j.id)?{momentId:entry.momentId}:{}),actor:a(j.actor),...(typeof j.recipient==='number'?{recipient:n(j.recipient)}:{}),...(typeof j.teammate==='number'?{teammate:n(j.teammate)}:{})}))};
}
