import {StandingResponsibilities,validateStanding} from './practice-standing.js';
import type {StandingInstruction} from './practice-standing.js';
import type {Tactics} from './model.js';
import {L,W} from './pitch.js';
import {clamp,rng} from './model.js';
import type {Side} from './model.js';
import type {MovingBall,Vec} from './movement.js';
import type {Option,PracticePlayer} from './practice.js';
import type {CoordinationView} from './practice-coordination.js';
import type {SupportMove,SupportPlan} from './practice-support.js';
import {arrivalTime} from './practice-defense.js';
import {TeachingActions,teachingFit,validateSteps} from './practice-teaching.js';
import type {ActionStep,ActionTrace} from './practice-teaching.js';
import {validateLesson,compileLesson} from './practice-lesson.js';
import type {LessonSpec,SceneRestart} from './practice-lesson.js';
import {restartSetupPoses,sceneBall} from './practice-routine.js';
import {usesRecognition,previewLessonRecognition,bindRecognisedLesson} from './practice-recognition.js';
import {placeRoutine} from './practice-routine.js';
import type {PlacedRoutine} from './practice-routine.js';
import type {RestartKind} from './practice-restarts.js';
import type {RecognisedEntry} from './practice-recognition.js';
export type {ActionActor,ActionCondition,ActionTarget,ActionStep,ActionTrace} from './practice-teaching.js';
export {validateLesson,compileLesson} from './practice-lesson.js';
export type {LessonSpec,LessonSpace,LessonMoment,LessonCue,LessonJob,LessonEvidence,LessonOptionEvidence,LessonEntry,EntryCondition,LessonScene,SceneSpot,SceneRestart,SceneZone} from './practice-lesson.js';
export {placeRoutine,sceneMatches,sceneZoneOf} from './practice-routine.js';
export type {PlacedRoutine} from './practice-routine.js';
export {previewLessonRecognition,usesRecognition} from './practice-recognition.js';
export type {RecognisedEntry,LessonRecognition,RecognitionCheck} from './practice-recognition.js';

export type OutfieldNumber=2|3|4|5;
export interface PlaybookInstruction {number:OutfieldNumber;action:'run'|'show'|'hold';dx:number;dy:number;delay:number}
export interface PlaybookPlan {id:string;name:string;weight:number;emphasis?:number;instructions:PlaybookInstruction[];preferred:OutfieldNumber|null;steps?:ActionStep[];lesson?:LessonSpec;standing?:StandingInstruction[]}
export interface PlaybookConfig {side:Side;plans:PlaybookPlan[];adaptive?:boolean}
export interface TrainingSetup {
 scene:'middle'|'left'|'right';
 poses:{side:Side;number:number;x:number;y:number;angle:number}[];
 ball:{side:Side;number:number;x:number;y:number};
 /** A watch that starts from this restart: the ball is on its spot and the
  * owner takes it (a set-piece routine is tried there). */
 restart?:{kind:SceneRestart};
}
export interface PlaybookCandidate {id:string;name:string;weight:number;fit:number;probability:number;reason:string;entries?:RecognisedEntry[];blockedBy?:string[]}
export interface PlaybookSelection {
 time:number;planId:string|null;name:string;candidates:PlaybookCandidate[];reason:string;
 status:'active'|'fallback'|'ended';endedAt?:number;endReason?:'duration'|'loss'|'restart'|'end'|'complete'|'aborted'|'conflict';endDetail?:string;trace?:ActionTrace[];
 recognition?:RecognisedEntry;
 /** A set-piece routine: when its restart was kicked (never, if play ended first). */
 restartTakenAt?:number;
 /** Team whose playbook made this selection. Set on `PracticeResult.playbookSelections`; reporting only. */
 side?:Side;
}
/** Selection and assigned jobs alone do not prove that a combination was tried. */
export function playbookProgress(selection:PlaybookSelection,time=Infinity):'recognised'|'pursued'|'attempted' {
 const trace=(selection.trace??[]).filter(e=>e.time<=time);
 if(trace.some(e=>e.intent==='attempted'))return 'attempted';
 if(trace.some(e=>e.intent==='pursued'))return 'pursued';
 return 'recognised';
}

type LaneRisk=(from:Vec,to:Vec,opponents:PracticePlayer[],speed?:number)=>number;
type Route={player:string;instruction:PlaybookInstruction;aim:Vec;origin:Vec};
type Active={plan:PlaybookPlan;routes:Route[];since:number;until:number;audit:PlaybookSelection;teaching?:TeachingActions;participants:Set<string>};
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const numberValid=(value:unknown):value is OutfieldNumber=>[2,3,4,5].includes(value as number);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';

/** Bound imported browser/storage input before it reaches the simulation. */
export function validatePlaybook(input:unknown):PlaybookConfig {
 if(!object(input)||![0,1].includes(input.side as number)||!Array.isArray(input.plans)||input.plans.length>12)throw Error('Invalid playbook: at most 12 plans for one side.');
 const ids=new Set<string>();
 const plans=input.plans.map((raw):PlaybookPlan=>{
  if(!object(raw))throw Error('Invalid playbook plan.');
  const id=text(raw.id,64),name=text(raw.name,80);
  if(!id||!name||ids.has(id)||!finite(raw.weight)||!Array.isArray(raw.instructions)||raw.instructions.length>4||raw.preferred!==null&&!numberValid(raw.preferred))throw Error('Invalid playbook plan fields.');
  if(raw.emphasis!==undefined&&(!finite(raw.emphasis)||raw.emphasis<0||raw.emphasis>1))throw Error('Tactical emphasis must be between 0 and 1.');
  ids.add(id);const numbers=new Set<number>();
  const instructions=raw.instructions.map((entry):PlaybookInstruction=>{
   if(!object(entry)||!numberValid(entry.number)||numbers.has(entry.number)||!['run','show','hold'].includes(entry.action as string)||!finite(entry.dx)||!finite(entry.dy)||!finite(entry.delay))throw Error('Invalid playbook instruction.');
   numbers.add(entry.number);
   return {number:entry.number,action:entry.action as PlaybookInstruction['action'],dx:clamp(entry.dx,-24,24),dy:clamp(entry.dy,-24,24),delay:clamp(entry.delay,0,4)};
  });
  const steps=raw.steps===undefined?undefined:validateSteps(raw.steps);
  const lesson=raw.lesson===undefined?undefined:validateLesson(raw.lesson);
  const standing=raw.standing===undefined?undefined:validateStanding(raw.standing,lesson);
  if(lesson){if(steps?.length||instructions.length)throw Error('Use a shared lesson or legacy actions, not both.');validateSteps(compileLesson(lesson));}
  if(lesson?.scene&&standing?.length)throw Error('A set-piece routine has no off-ball instructions; they belong to open-play ideas.');
  return {id,name,weight:clamp(raw.weight,0,100),...(raw.emphasis!==undefined?{emphasis:raw.emphasis as number}:{}),instructions,preferred:raw.preferred as OutfieldNumber|null,...(steps?{steps}:{}),...(lesson?{lesson}:{}),...(standing?{standing}:{})};
 });
 if(input.adaptive!==undefined&&typeof input.adaptive!=='boolean')throw Error('Invalid adaptive setting.');
 return {side:input.side as Side,plans,...(input.adaptive!==undefined?{adaptive:input.adaptive as boolean}:{})};
}
export function validatePlans(input:unknown):PlaybookPlan[]{return validatePlaybook({side:0,plans:input}).plans;}

/** A blank teaching starting point, deliberately not a prebuilt combination. */
export function defaultTeachingPlan():PlaybookPlan {
 return {id:'my-actions',name:'Planul meu',weight:100,instructions:[],preferred:null,steps:[
  {id:'action-1',actor:3,action:'carry',target:{kind:'point',x:25,y:-4},when:{mode:'all',conditions:[{kind:'start'}]}},
 ]};
}

export function defaultPlans():PlaybookPlan[]{return [
 {id:'two-lanes',name:'Două culoare',weight:55,preferred:5,instructions:[
  {number:2,action:'hold',dx:0,dy:0,delay:0},{number:4,action:'run',dx:11,dy:0,delay:0},{number:5,action:'run',dx:9,dy:-4,delay:.25}]},
 {id:'link-and-go',name:'Sprijin și plecare',weight:30,preferred:4,instructions:[
  {number:2,action:'hold',dx:2,dy:0,delay:0},{number:4,action:'show',dx:1,dy:-4,delay:0},{number:5,action:'run',dx:10,dy:4,delay:.5}]},
 {id:'opposite-side',name:'Ieșire în partea opusă',weight:15,preferred:2,instructions:[
  {number:2,action:'show',dx:4,dy:5,delay:0},{number:4,action:'run',dx:9,dy:-8,delay:.25},{number:5,action:'hold',dx:0,dy:0,delay:0}]},
];}

/** An initial condition, not a scripted sequence. #3 has just recovered at his foot. */
export function createTrainingSetup(scene:'middle'|'left'|'right'):TrainingSetup {
 if(!['middle','left','right'].includes(scene))throw Error('Unknown training scene.');
 const shift=scene==='left'?-6:scene==='right'?6:0;
 const positions=[[[3,0],[11,0],[18,-4],[20,7],[27,2]],[[45,0],[32,0],[24,-8],[16,6],[12,-5]]];
 const poses=positions.flatMap((team,side)=>team.map(([x,y],i)=>({side:side as Side,number:i+1,x,y:side===0&&i?clamp(y+shift,-12,12):y,angle:side?Math.PI:0})));
 const owner=poses.find(p=>p.side===0&&p.number===3)!;
 return {scene,poses,ball:{side:0,number:3,x:owner.x+.62,y:owner.y}};
}

/** A setup that starts from a restart: the engine's own layout for it, the
 * given taker on the ball (the keeper at a goal kick). */
export function createRestartSetup(restart:SceneRestart,players:PracticePlayer[],opts:{side?:'left'|'right';zone?:'defensive'|'middle'|'attacking';taker?:number;ball?:Vec}={}):TrainingSetup {
 const ball=opts.ball??sceneBall(restart,opts.side,opts.zone);
 const taker=restart==='goalKick'?1:opts.taker??players.filter(p=>p.side===0&&p.role!=='GK').sort((a,b)=>distance(a,ball)-distance(b,ball)||a.number-b.number)[0].number;
 return {scene:'middle',poses:restartSetupPoses(restart,ball,taker,players),ball:{side:0,number:taker,x:ball.x,y:ball.y},restart:{kind:restart}};
}
/** Reject invalid/overlapping poses; permit only a real, reachable foot-control start. */
export function validateTrainingSetup(input:unknown,players:PracticePlayer[]):TrainingSetup {
 if(!object(input)||!['middle','left','right'].includes(input.scene as string)||!Array.isArray(input.poses)||input.poses.length!==players.length||!object(input.ball))throw Error('Invalid training setup.');
 const restart=input.restart===undefined?undefined:object(input.restart)&&['corner','freeKick','throw','goalKick'].includes(input.restart.kind as string)?{kind:input.restart.kind as SceneRestart}:(()=>{throw Error('Invalid training restart.');})();
 const seen=new Set<string>();
 const b0=input.ball;
 const poses=input.poses.map(p=>{
  // At a restart the taker may stand on the line (a corner, a throw-in).
  const onBall=!!restart&&object(p)&&p.side===b0.side&&p.number===b0.number;
  if(!object(p)||![0,1].includes(p.side as number)||!Number.isInteger(p.number)||!finite(p.x)||!finite(p.y)||!finite(p.angle)||(onBall?p.x<0||p.x>L||Math.abs(p.y)>W/2:p.x<.8||p.x>L-.8||Math.abs(p.y)>W/2-1))throw Error('Invalid training pose.');
  const key=`${p.side}:${p.number}`;
  if(seen.has(key)||!players.some(q=>q.side===p.side&&q.number===p.number))throw Error('Training pose does not match a starter.');
  seen.add(key);return {side:p.side as Side,number:p.number as number,x:p.x,y:p.y,angle:Math.atan2(Math.sin(p.angle),Math.cos(p.angle))};
 });
 for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++)if(distance(poses[i],poses[j])<.8)throw Error('Training players overlap.');
 const b=input.ball;
 if(restart){
  // Restart start: own side, the keeper only at a goal kick, the ball on the
  // pitch and the taker beside it (the gather puts him on it for the kick).
  if(b.side!==0||!(restart.kind==='goalKick'?b.number===1:numberValid(b.number))||!finite(b.x)||!finite(b.y)||b.x<.3||b.x>L-.3||Math.abs(b.y)>W/2-.3)throw Error('Invalid restart ball.');
  const owner=poses.find(p=>p.side===0&&p.number===b.number)!;
  if(distance(owner,b as unknown as Vec)>1.5)throw Error('The taker must stand at the ball.');
  return {scene:input.scene as TrainingSetup['scene'],poses,ball:{side:0,number:b.number as number,x:b.x as number,y:b.y as number},restart};
 }
 if(![0,1].includes(b.side as number)||!numberValid(b.number)||!finite(b.x)||!finite(b.y))throw Error('Invalid training ball.');
 const owner=poses.find(p=>p.side===b.side&&p.number===b.number),gap=owner?distance(owner,b as unknown as Vec):Infinity;
 if(!owner||gap<.3||gap>.85||b.x<.3||b.x>L-.3||Math.abs(b.y)>W/2-.3||(b.x-owner.x)*Math.cos(owner.angle)+(b.y-owner.y)*Math.sin(owner.angle)<.2||poses.some(p=>p!==owner&&distance(p,b as unknown as Vec)<.8))throw Error('Training ball must be in front of its owner, within foot reach.');
 return {scene:input.scene as TrainingSetup['scene'],poses,ball:{side:b.side as Side,number:b.number as number,x:b.x,y:b.y}};
}

/** Current geometry only: no guessed pass outcome, next AI action or future random roll. */
function fitPlan(plan:PlaybookPlan,side:Side,players:PracticePlayer[],owner:PracticePlayer,laneRisk:LaneRisk,ball?:MovingBall):{fit:number;reason:string;routes:Route[];recognition?:RecognisedEntry;entries?:RecognisedEntry[]} {
 const routes:Route[]=[],opponents=players.filter(p=>p.side!==side),sign=side===0?1:-1;
 if(plan.weight===0||plan.emphasis===0)return {fit:0,reason:'Dezactivat: frecvență 0.',routes};
 if(plan.lesson){
  if(usesRecognition(plan.lesson)){
   const recognised=previewLessonRecognition(plan.lesson,side,players,ball??{x:owner.x+Math.cos(owner.angle)*.62,y:owner.y+Math.sin(owner.angle)*.62,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'},laneRisk);
   return {fit:recognised.best?.score??0,reason:recognised.best?.reasons.join(' ')??(recognised.entries.flatMap(e=>e.reasons).join(' ')||'Nicio intrare disponibilă.'),routes,recognition:recognised.best,entries:recognised.entries};
  }
  return {...teachingFit(compileLesson(plan.lesson),players,owner),routes};
 }
 if(plan.steps?.length)return {...teachingFit(plan.steps,players,owner),routes};
 if(!plan.instructions.length)return {fit:0,reason:'Nicio mișcare desenată.',routes};
 let fit=1;
 for(const instruction of plan.instructions){
  const player=players.find(p=>p.side===side&&p.number===instruction.number&&p.role!=='GK');
  if(!player)return {fit:0,reason:`#${instruction.number} nu este pe teren.`,routes};
  const aim={x:player.x+sign*instruction.dx,y:player.y+sign*instruction.dy};
  if(aim.x<.8||aim.x>L-.8||Math.abs(aim.y)>W/2-1)return {fit:0,reason:`Traseul lui #${instruction.number} iese din teren.`,routes};
  const travel=arrivalTime(player,aim),available=6-instruction.delay;
  if(travel>available||instruction.action==='run'&&player.energy<15)return {fit:0,reason:`#${instruction.number} nu poate ajunge în timpul disponibil.`,routes};
  const length=distance(player,aim),room=Math.min(...opponents.map(p=>distance(p,aim)));
  // Test bodies occupying the authored route right now. A defender merely able
  // to close it later lowers fit; that is not a known future interception.
  const blocked=length>1&&opponents.some(p=>{
   const t=clamp(((p.x-player.x)*(aim.x-player.x)+(p.y-player.y)*(aim.y-player.y))/(length*length),0,1);
   return t>.08&&distance(p,{x:player.x+t*(aim.x-player.x),y:player.y+t*(aim.y-player.y)})<1.05;
  });
  if(blocked||room<1.05)return {fit:0,reason:`Traseul lui #${instruction.number} este ocupat de un adversar.`,routes};
  const passRisk=player.id===owner.id?0:laneRisk(owner,aim,opponents);
  const safety=clamp(room/5,.15,1),reach=clamp(1-travel/available*.45,.25,1);
  const instructionFit=reach*(.55+safety*.45)*(1-passRisk*(instruction.action==='show'?.4:.18));
  fit*=instructionFit;
  routes.push({player:player.id,instruction,aim,origin:{x:player.x,y:player.y}});
 }
 // Two authored endpoints need distinct space. Ordinary collision avoidance
 // still handles moving bodies along the routes during execution.
 if(routes.some((a,i)=>routes.slice(i+1).some(b=>distance(a.aim,b.aim)<1.5)))return {fit:0,reason:'Două roluri cer același spațiu.',routes};
 fit=Math.pow(fit,1/Math.max(1,routes.length));
 return {fit,reason:'Trasee în teren; potrivire după spațiu, distanță și adversarii vizibili.',routes};
}

export class PracticePlaybook {
 readonly config:PlaybookConfig;
 readonly selections:PlaybookSelection[]=[];
 readonly standing:StandingResponsibilities;
 private readonly random:()=>number;
 private active:Active[]=[];
 private possessionOpen=false;
 private nextRecognition=0;
 private retryAfter=new Map<string,number>();
 private recognitionRisk?:LaneRisk;
 private lastRecognition='';
 /** Set-piece routines draw from their own stream, so open-play selection is untouched. */
 private readonly routineRandom:()=>number;
 /** The routine chosen for the current restart, until its kick. */
 private routine?:{active:Active;placed:PlacedRoutine};
 constructor(config:unknown,seed:number){this.config=validatePlaybook(config);this.random=rng(seed^0x6c736b31);this.routineRandom=rng(seed^0x726f7574);this.standing=new StandingResponsibilities(this.config.side,this.config.plans,seed);}
 get teachingActive():boolean{return this.active.some(a=>a.teaching&&!a.teaching.ended);}
 get strictTeachingActive():boolean{return this.active.some(a=>a.teaching&&!a.teaching.ended&&!a.teaching.adaptive);}
 recover(time:number,owner:PracticePlayer,players:PracticePlayer[],laneRisk:LaneRisk,ball?:MovingBall):void {
  if(owner.side!==this.config.side||this.possessionOpen)return;
  this.possessionOpen=true;
  this.recognitionRisk=laneRisk;this.retryAfter.clear();this.lastRecognition='';this.nextRecognition=time+.5;
  this.select(time,owner,players,laneRisk,ball,false);
 }
 private participants(active:Active,players:PracticePlayer[]):Set<string>{return active.teaching?.participants(players)??active.participants;}
 private select(time:number,owner:PracticePlayer,players:PracticePlayer[],laneRisk:LaneRisk,ball:MovingBall|undefined,opportunity:boolean):boolean {
  // Set-piece routines never start in open play: only their restart chooses them.
  const plans=this.config.plans.filter(p=>!p.lesson&&!this.active.some(a=>a.plan.id===p.id)&&time>=(this.retryAfter.get(p.id)??0)&&(!opportunity||p.lesson&&p.weight>0&&p.emphasis!==0));
  if(!plans.length)return false;
  const evaluated=plans.map(plan=>{
   const fit=fitPlan(plan,this.config.side,players,owner,laneRisk,ball);
   const lesson=plan.lesson&&fit.recognition?bindRecognisedLesson(plan.lesson,fit.recognition):plan.lesson;
   const steps=lesson?compileLesson(lesson):plan.steps;
   const teaching=fit.fit>0&&steps?.length?new TeachingActions(steps,time,owner,!!lesson||!!this.config.adaptive,laneRisk,lesson,fit.recognition,plan.emphasis??1):undefined;
   const participants=teaching?.participants(players)??new Set(fit.routes.map(r=>r.player));
   if(plan.preferred!==null&&!teaching){participants.add(owner.id);const target=players.find(p=>p.side===this.config.side&&p.number===plan.preferred);if(target)participants.add(target.id);}
   return {plan,...fit,teaching,participants};
  });
  const conflicts=(entry:typeof evaluated[number])=>this.active.filter(a=>[...this.participants(a,players)].some(id=>entry.participants.has(id)));
  const candidates=():PlaybookCandidate[]=>{
   const total=evaluated.reduce((sum,e)=>sum+(conflicts(e).length?0:e.plan.weight*(e.plan.emphasis??1)*e.fit),0);
   return evaluated.map(({plan,fit,reason,entries,...rest})=>{
    const blocked=conflicts({plan,fit,reason,entries,...rest}),score=blocked.length?0:plan.weight*(plan.emphasis??1)*fit;
    return {id:plan.id,name:plan.name,weight:plan.weight,fit,probability:total?score/total:0,reason:blocked.length?`Aceiași jucători participă deja la: ${blocked.map(a=>a.plan.name).join(', ')}. ${reason}`:reason,...(entries?{entries}:{}),...(blocked.length?{blockedBy:blocked.map(a=>a.plan.id)}:{})};
   });
  };
  let started=false;
  while(evaluated.length){
   const rows=candidates(),total=evaluated.reduce((sum,e,i)=>sum+(rows[i].blockedBy?0:e.plan.weight*(e.plan.emphasis??1)*e.fit),0);
   if(total<=0){
    const signature=JSON.stringify(rows.map(c=>[c.id,c.fit>0,c.reason]));
    if(signature!==this.lastRecognition){this.selections.push({time,planId:null,name:'Joc liber',candidates:rows,reason:rows.some(r=>r.blockedBy)?'Ideile suprapuse așteaptă; combinațiile active continuă.':'Niciun plan eligibil; continuă deciziile obișnuite.',status:'fallback'});this.lastRecognition=signature;}
    break;
   }
   let draw=this.random()*total,index=-1;
   for(let i=0;i<evaluated.length;i++){const e=evaluated[i];if(rows[i].blockedBy)continue;draw-=e.plan.weight*(e.plan.emphasis??1)*e.fit;if(e.fit>0&&e.plan.weight>0&&e.plan.emphasis!==0&&draw<0){index=i;break;}}
   if(index<0)break;
   const selected=evaluated[index];
   const audit:PlaybookSelection={time,planId:selected.plan.id,name:selected.plan.name,candidates:rows,
    reason:this.active.length?'Compatibil cu ideile active: participanți diferiți.':selected.recognition?`Oportunitate recunoscută${selected.recognition.independent?' cu intrare directă':''}: accent × potrivire.`:'Ales la recuperare: accent × potrivire.',status:'active',...(selected.recognition?{recognition:selected.recognition}:{})};
   if(selected.teaching)audit.trace=selected.teaching.trace;
   this.selections.push(audit);
   this.active.push({plan:selected.plan,routes:selected.routes,since:time,until:selected.teaching?.until??time+6,audit,teaching:selected.teaching,participants:selected.participants});
   evaluated.splice(index,1);started=true;
  }
  return started;
 }
 private finish(active:Active,time:number,reason:NonNullable<PlaybookSelection['endReason']>,detail?:string):void {
  this.retryAfter.set(active.plan.id,time+(reason==='complete'?2:1));
  const messages={duration:'Timpul planului s-a încheiat.',loss:'Adversarul a câștigat mingea.',restart:'Jocul s-a oprit pentru o reluare.',end:'Simularea s-a încheiat.',complete:'Acțiunile s-au încheiat.',aborted:'Planul nu mai poate continua.',conflict:'Un participant este necesar unei combinații deja în curs.'};
  const endDetail=detail||active.teaching?.endReason||messages[reason];
  if(this.routine?.active===active)this.routine=undefined;
  active.teaching?.abort(time,endDetail);
  Object.assign(active.audit,{status:'ended',endedAt:time,endReason:reason,endDetail});
  this.active=this.active.filter(a=>a!==active);
 }
 end(time:number,reason:NonNullable<PlaybookSelection['endReason']>):boolean {
  const changed=this.active.length>0;
  for(const a of [...this.active])this.finish(a,time,reason);
  if(reason==='loss'||reason==='restart')this.possessionOpen=false;
  if(reason==='restart')this.standing.reset();
  return changed;
 }
 /** A redirected receipt can bind a participant who belonged to another plan. Keep the older passage. */
 private reconcile(time:number,players:PracticePlayer[]):boolean {
  const claimed=new Map<string,Active>();let changed=false;
  for(const a of [...this.active]){
   const ids=this.participants(a,players),other=[...ids].map(id=>claimed.get(id)).find(Boolean);
   if(other){this.finish(a,time,'conflict',`Continuarea cere un jucător care participă deja la „${other.plan.name}”.`);changed=true;}
   else for(const id of ids)claimed.set(id,a);
  }
  return changed;
 }
 advance(time:number,ownerSide:Side|undefined,restart=false,ball?:MovingBall,players?:PracticePlayer[],kickCommitted=false):boolean {
  if(restart&&!this.routine)return this.end(time,'restart');
  if(restart)return this.holdRoutine(time,ball,players);
  if(ownerSide!==undefined&&ownerSide!==this.config.side)return this.end(time,'loss');
  let changed=false,finished=false;
  for(const a of [...this.active]){
   const teaching=a.teaching;
   if(teaching&&ball&&players){
    changed=teaching.update(time,players,ball)||changed;
    if(teaching.ended){this.finish(a,time,time>=teaching.until?'duration':teaching.aborted?'aborted':'complete');changed=true;finished=true;}
   }else if(time>=a.until){this.finish(a,time,'duration');changed=true;finished=true;}
  }
  if(players)changed=this.reconcile(time,players)||changed;
  const eligible=this.config.plans.some(p=>p.lesson&&!p.lesson.scene&&p.weight>0&&p.emphasis!==0&&!this.active.some(a=>a.plan.id===p.id)&&time>=(this.retryAfter.get(p.id)??0));
  if(!finished&&eligible&&!kickCommitted&&ball&&players&&ownerSide===this.config.side&&time>=this.nextRecognition&&this.recognitionRisk){
   this.nextRecognition=time+.5;const owner=players.find(p=>p.id===ball.owner);
   if(owner&&this.select(time,owner,players,this.recognitionRisk,ball,true)){
    for(const a of this.active)if(a.since===time)a.teaching?.update(time,players,ball);
    this.reconcile(time,players);changed=true;
   }
  }
  return changed;
 }
 /** During the routine's own restart: everything else has ended (as at any
  * restart); the routine waits for its kick. Once the taker is set on the
  * ball his delivery is due, so the start moment is read then. */
 private holdRoutine(time:number,ball?:MovingBall,players?:PracticePlayer[]):boolean {
  const r=this.routine!;let changed=false;
  for(const a of [...this.active])if(a!==r.active){this.finish(a,time,'restart');changed=true;}
  this.possessionOpen=false;this.standing.reset();
  const teaching=r.active.teaching!;
  if(ball?.owner&&players){
   changed=teaching.update(time,players,ball)||changed;
   if(teaching.ended){this.finish(r.active,time,teaching.aborted?'aborted':'complete');changed=true;}
  }
  return changed;
 }
 /** At a stoppage for this side: a saved routine for this restart is used
  * with the chance its emphasis gives it (several routines for the same
  * restart: 1 − Π(1 − emphasis), then one of them by emphasis). `force`
  * (a Lab trial from that restart) always uses a matching routine.
  * Returns where it puts its players; null keeps the engine's own routine. */
 chooseRoutine(time:number,kind:RestartKind,side:Side,spot:Vec,players:PracticePlayer[],laneRisk:LaneRisk,force=false,engineTaker?:string):PlacedRoutine|null {
  if(side!==this.config.side)return null;
  const options=this.config.plans.flatMap(plan=>{
   if(!plan.lesson?.scene||plan.weight<=0||plan.emphasis===0)return [];
   const placed=placeRoutine(plan.lesson,kind,side,spot,players,engineTaker);return placed?[{plan,placed}]:[];
  });
  if(!options.length)return null;
  const chance=(p:PlaybookPlan)=>clamp(p.weight/100,0,1)*(p.emphasis??1),total=options.reduce((sum,o)=>sum+chance(o.plan),0);
  const use=1-options.reduce((q,o)=>q*(1-chance(o.plan)),1);
  if(!force&&this.routineRandom()>=use)return null;
  let draw=this.routineRandom()*total,pick=options[options.length-1];
  for(const o of options){draw-=chance(o.plan);if(draw<0){pick=o;break;}}
  const {plan,placed}=pick,taker=players.find(p=>p.id===placed.taker)!;
  const teaching=new TeachingActions(compileLesson(placed.lesson),time,taker,true,laneRisk,placed.lesson,undefined,plan.emphasis??1,true);
  const candidates:PlaybookCandidate[]=options.map(o=>({id:o.plan.id,name:o.plan.name,weight:o.plan.weight,fit:1,probability:total?use*chance(o.plan)/total:0,reason:o.placed.mirrored?'Rutina se potrivește acestei reluări, oglindită pe cealaltă parte.':'Rutina se potrivește acestei reluări.'}));
  const audit:PlaybookSelection={time,planId:plan.id,name:plan.name,candidates,reason:'Rutină de fază fixă, aleasă la oprirea jocului.',status:'active',trace:teaching.trace};
  this.selections.push(audit);
  const active:Active={plan,routes:[],since:time,until:teaching.until,audit,teaching,participants:teaching.participants(players)};
  this.active.push(active);this.routine={active,placed};
  return placed;
 }
 /** At the routine's kick: the drawn delivery its taker plays, or null when
  * it is clearly off (he then decides as always). */
 routineDelivery(time:number,p:PracticePlayer,kind:RestartKind,spot:Vec,options:Option[],players:PracticePlayer[],support:SupportPlan|null):Option|null {
  const r=this.routine;if(!r||r.placed.taker!==p.id)return null;
  return r.active.teaching?.routineDelivery(time,p,kind,spot,options,players,support)??null;
 }
 /** The plan id of the routine chosen for the current restart. */
 get routineId():string|undefined{return this.routine?.active.plan.id;}
 /** The kick of the routine's restart: its kick moment is due now. */
 restartTaken(time:number,players:PracticePlayer[]=[]):void {const r=this.routine;if(!r)return;r.active.audit.restartTakenAt=time;r.active.teaching?.restartTaken(time,players);r.active.until=r.active.teaching?.until??time;this.routine=undefined;}
 /** Before the kick, the runs drawn from it are what the taker's delivery
  * leads (the same moving target an ordinary through ball or loft reads).
  * The runners still stand in their spots until the kick. */
 routineSupport(time:number,support:SupportPlan|null,players:PracticePlayer[]):SupportPlan|null {
  const runs=this.routine?.active.teaching?.pendingRuns(players)??[];
  if(!support||!runs.length)return support;
  return {...support,moves:[...support.moves.filter(m=>!runs.some(q=>q.player===m.player)),...runs.map((q):SupportMove=>({player:q.player,purpose:'playbook',kind:'run',aim:q.aim,speed:q.speed,since:time,until:time+.5,reason:'Cursa desenată pornește la execuție.'}))]};
 }
 ownerAim(owner:PracticePlayer):Vec|undefined {for(const a of this.active){const aim=a.teaching?.ownerAim(owner);if(aim)return aim;}return undefined;}
 startedAction(time:number,actor:string):boolean{return this.active.some(a=>a.teaching?.startedAction(time,actor));}
 actionActive(key:string,planId?:string):boolean{return this.active.some(a=>(!planId||a.plan.id===planId)&&a.teaching?.actionActive(key));}
 options(time:number,owner:PracticePlayer,players:PracticePlayer[],ball:MovingBall,support:SupportPlan|null,ordinary:Option[]):Option[]{
  const active=this.active.find(a=>this.participants(a,players).has(owner.id));
  if(!active?.teaching)return this.prefer(ordinary,owner,players);
  return active.teaching.options(time,owner,players,ball,support,ordinary).map(o=>o.teachingStep?{...o,teachingPlan:active.plan.id}:o);
 }
 canRelease(time:number,p:PracticePlayer,option:Option,players:PracticePlayer[],ball:MovingBall,support:SupportPlan|null):boolean{
  if(!option.teachingStep)return true;
  const active=option.teachingPlan?this.active.find(a=>a.plan.id===option.teachingPlan):this.active.find(a=>this.participants(a,players).has(p.id));
  return active?.teaching?.canRelease(time,p,option,players,ball,support)??false;
 }
 released(time:number,p:PracticePlayer,option:Option):void{for(const a of this.active)a.teaching?.released(time,p,option);}
 received(time:number,p:PracticePlayer,from:string,wasPass:boolean,players?:PracticePlayer[],ball?:MovingBall):void{
  for(const a of this.active){a.teaching?.received(time,p,from,wasPass);if(a.teaching?.adaptive&&players&&ball)a.teaching.update(time,players,{...ball,owner:p.id,mode:'control'});}
  if(players)this.reconcile(time,players);
  if(wasPass&&p.id!==from)this.nextRecognition=Math.min(this.nextRecognition,time);
 }
 decided(time:number,p:PracticePlayer,option:Option):void{for(const a of this.active)a.teaching?.decided(time,p,option);}
 persistent(time:number,players:PracticePlayer[],ball:MovingBall,attacking:Side,tactics:Tactics,preview:CoordinationView|null,unavailable:ReadonlySet<string>,support:SupportPlan|null):SupportPlan|null {
  const claimed=new Map<string,string>();for(const a of this.active)for(const id of this.participants(a,players))claimed.set(id,a.plan.name);
  const moves=this.standing.moves(time,players,ball,attacking,tactics,preview,unavailable,claimed);
  if(!moves.length)return support;
  return {owner:ball.owner??support?.owner??'',side:this.config.side,moves:[...(support?.side===this.config.side?support.moves:[]).filter(m=>!moves.some(q=>q.player===m.player)),...moves]};
 }
 /** Propose responsibilities for the coordinator; never overwrite its published jobs. */
 apply(time:number,players:PracticePlayer[],ball:MovingBall,coordination:CoordinationView|null,support:SupportPlan|null,unavailable:ReadonlySet<string>=new Set()):SupportPlan|null {
  let result=support?{...support,moves:support.moves.filter(m=>m.purpose!=='playbook')}:null;
  for(const active of this.active){
   const proposal=this.applyActive(active,time,players,ball,coordination,result,unavailable);
   if(proposal)result={...proposal,moves:[...(result?.side===proposal.side?result.moves:[]).filter(m=>!proposal.moves.some(q=>q.player===m.player)),...proposal.moves]};
  }
  return result;
 }
 private applyActive(active:Active,time:number,players:PracticePlayer[],ball:MovingBall,coordination:CoordinationView|null,support:SupportPlan|null,unavailable:ReadonlySet<string>):SupportPlan|null {
  if(active.teaching)return active.teaching.apply(time,players,ball,coordination,support,unavailable);
  const owner=players.find(p=>p.id===ball.owner);
  const moves:SupportMove[]=[];
  for(const route of active.routes){
   const p=players.find(p=>p.id===route.player),start=active.since+route.instruction.delay;
   if(!p||p.id===owner?.id||unavailable.has(p.id)||time<start)continue;
   // A live reception/collection assignment has priority over a drawn run.
   if(!owner&&(coordination?.flight.receiver===p.id||coordination?.flight.hunters.includes(p.id)))continue;
   const {action}=route.instruction,reason=`${active.plan.name} · #${p.number}: ${action==='run'?'atacă traseul':action==='show'?'oferă sprijin':'ține poziția'}.`;
   const move:SupportMove={player:p.id,purpose:'playbook',kind:action,aim:{...route.aim},speed:p.pace*(action==='run'?.94:action==='show'?.78:.65),since:start,until:active.until,reason};
   moves.push(move);
   
  }
  // The current carrier must see these exact runs through activePassRun().
  // A flight keeps the invitation alive without inventing a new ball owner.
  const current=support?.side===this.config.side?support:null;
  const result:SupportPlan={owner:owner?.id??current?.owner??'',side:this.config.side,moves:[...(current?.moves??[]).filter(m=>!moves.some(q=>q.player===m.player)&&m.purpose!=='playbook'),...moves]};
  
  return result;
 }
 /** Small preference among options the real passing model already finds safe. */
 prefer(options:Option[],owner:PracticePlayer,players:PracticePlayer[]):Option[] {
  const active=this.active.find(a=>!a.teaching&&a.participants.has(owner.id)&&a.plan.preferred!==null);
  if(!active||owner.side!==this.config.side)return options;
  const target=players.find(p=>p.side===owner.side&&p.number===active.plan.preferred);
  if(!target||target.id===owner.id)return options;
  const best=Math.max(...options.map(o=>o.score));
  return options.map(option=>{
   const delivery=option.pass??option.loft;
   if(option.target!==target.id||!['pass','through','loft'].includes(option.kind)||!delivery||!finite(delivery.flight)||delivery.risk>.35||delivery.controlRisk>.35||delivery.reachMargin<-.6||option.score<best-.2)return option;
   return {...option,score:option.score+.075*(1-delivery.risk),reason:`${option.reason} Preferință în planul „${active.plan.name}”.`};
  });
 }
}
