import {L,W,X} from './pitch.js';
import {clamp} from './model.js';
import type {Side} from './model.js';
import type {Vec,MovingBall} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import type {ActionActor,ActionStep,TeachingNumber} from './practice-teaching.js';
import type {SupportMove,SupportPlan} from './practice-support.js';
import {readSupportLocation,timeSupportRun,shortSupportPoints} from './practice-support.js';
import {loftOptions} from './practice-loft.js';
import {activePassRun,groundOptions} from './practice-passing.js';
import {carryOptions,dribbleConfidence,readDribbleRoute} from './practice-carry.js';
import {possessionSafety,securePossessionOptions} from './practice-possession.js';
import {bodyTurnRate,touchGap} from './practice-reception.js';
import {WORLD} from './world.js';

export const PASS_OPENING_SECONDS=WORLD.selection.lesson.PASS_OPENING_SECONDS.v;
/** The most an idea may lift a ball carrier's option above its ordinary score
 * (score units, after the accent). An idea breaks near-ties toward the drawn
 * pass/carry but never overrides a clearly better choice: uncapped, the drawn
 * through ball beat a better option in 80% of steered decisions and ideas cost
 * their side ~1 goal a match; at 0.2 they are neutral while runs still go as
 * drawn (packages/football-engine/evidence/2026-09-28-ideas-commitment/FINDINGS.md). */
export const IDEA_PREFERENCE_CAP=WORLD.selection.lesson.IDEA_PREFERENCE_CAP.v;

export interface LessonSpace {id:string;name:string;x:number;y:number;radius:number;anchor?:{kind:'player'|'opponent';number:TeachingNumber;dx:number;dy:number}}
/** `restart-taken`: the kick of the lesson's own restart (a set-piece routine only). */
export type LessonCue={kind:'start'}|{kind:'restart-taken'}|{kind:'pressed';actor:ActionActor}|{kind:'released'|'received';jobId:string};
export type EntryCondition={kind:'space';spaceId:string}|{kind:'pressed'}|{kind:'delivery';runner:TeachingNumber;spaceId:string;delivery?:'auto'|'ground'|'loft'};
export interface LessonEntry {carrier:TeachingNumber;conditions:EntryCondition[];receiverBindings?:Record<string,TeachingNumber>}
export interface LessonMoment {id:string;name:string;cue:LessonCue;entry?:LessonEntry}
export interface LessonJob {
 id:string;momentId:string;actor:ActionActor;kind:'advance'|'offer'|'run'|'occupy'|'pass'|'shoot'|'hold';
 spaceId?:string;teammate?:TeachingNumber|'carrier';opponent?:TeachingNumber;recipient?:TeachingNumber|'free';delivery?:'auto'|'ground'|'loft';fallback?:boolean;repeat?:boolean;
}
export type SceneRestart='corner'|'freeKick'|'throw'|'goalKick';
export type SceneZone='defensive'|'middle'|'attacking'|'any';
/** One outfield player's spot in a routine (own attacking frame) and how far he may roam from it (0 = stand here). */
export interface SceneSpot {number:TeachingNumber;x:number;y:number;leash:number}
/** A set-piece routine: the lesson belongs to a restart, not to open play.
 * `ball` is where the manager drew it (own attacking frame, attacking +x).
 * side: left is y < 0 facing the opponents' goal; 'any' mirrors the drawing
 * to the other side. zone: the third of the pitch (free kicks and throw-ins).
 * The engine keeps the Laws' distances, the taker's legality and his wait. */
export interface LessonScene {restart:SceneRestart;side?:'left'|'right'|'any';zone?:SceneZone;ball:{x:number;y:number};taker:1|TeachingNumber;spots:SceneSpot[]}
export const SCENE_LEASH_MAX=8;
export interface LessonSpec {spaces:LessonSpace[];moments:LessonMoment[];jobs:LessonJob[];roles?:Partial<Record<TeachingNumber,'carrier'|'support'|'runner'>>;scene?:LessonScene}
export interface LessonOptionEvidence {kind:string;target?:string;aim:Vec;score:number;preference?:number;laneRisk?:number;controlRisk?:number;reachMargin?:number;room?:number;travel?:number;crowding?:number;matches?:boolean}
export interface LessonEvidence {
 entry?:{momentId:string;independent:boolean;bindings:Record<string,number>};
 resolvedSpaces?:LessonSpace[];
 cue?:{kind:LessonCue['kind'];actor?:string;opponent?:string;distance?:number;closingSpeed?:number;jobId?:string;releasedAt?:number;receivedAt?:number};
 reference?:string;spaceId?:string;aim?:Vec;options?:LessonOptionEvidence[];chosen?:{kind:string;target?:string;aim:Vec;score:number};
 blockers?:{kind:'lane'|'control'|'reach'|'possession'|'cue'|'space'|'separation'|'availability';actor?:string;value?:number;text:string}[];
}
type Risk=(from:Vec,to:Vec,opponents:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const number=(v:unknown):v is TeachingNumber=>[2,3,4,5].includes(v as number);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const bound=(v:Vec)=>({x:clamp(v.x,.8,L-.8),y:clamp(v.y,-W/2+1,W/2-1)});
const name=(v:unknown)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80):'';
function actor(v:unknown):ActionActor {if(number(v))return v;if(object(v)&&id(v.receiverOf))return {receiverOf:v.receiverOf};throw Error('A lesson actor must be #2–#5 or receiverOf a pass job.');}
function rows(v:unknown,max:number,label:string):Record<string,unknown>[] {
 if(!Array.isArray(v)||v.length>max)throw Error(`Lesson: at most ${max} ${label}.`);
 const used=new Set<string>();return v.map(row=>{if(!object(row)||!id(row.id)||used.has(row.id))throw Error(`Lesson ${label} need unique valid IDs.`);used.add(row.id);return row;});
}
export function validateLesson(input:unknown):LessonSpec {
 if(!object(input))throw Error('Invalid lesson.');
 const spaces=rows(input.spaces,8,'spaces').map((s):LessonSpace=>{
  const title=name(s.name);if(!title||!finite(s.x)||!finite(s.y)||s.x<.8||s.x>L-.8||Math.abs(s.y)>W/2-1||!finite(s.radius)||s.radius<1||s.radius>12)throw Error('Lesson space: name, in-pitch center and radius 1–12 m required.');
  let anchor:LessonSpace['anchor'];
  if(s.anchor!==undefined){const a=s.anchor;if(!object(a)||!['player','opponent'].includes(a.kind as string)||!number(a.number)||!finite(a.dx)||!finite(a.dy)||Math.abs(a.dx)>30||Math.abs(a.dy)>28)throw Error('Relative space needs a player/opponent anchor and offsets within 30 × 28 m.');anchor={kind:a.kind as 'player'|'opponent',number:a.number,dx:a.dx,dy:a.dy};}
  return {id:s.id as string,name:title,x:s.x,y:s.y,radius:s.radius,...(anchor?{anchor}:{})};
 });
 const moments=rows(input.moments,8,'moments').map((m):LessonMoment=>{
  const title=name(m.name),c=m.cue;if(!title||!object(c))throw Error('Lesson moment needs a name and cue.');
  let cue:LessonCue;
  if(c.kind==='start')cue={kind:'start'};
  else if(c.kind==='restart-taken'&&input.scene!==undefined)cue={kind:'restart-taken'};
  else if(c.kind==='pressed')cue={kind:'pressed',actor:actor(c.actor)};
  else if(['released','received'].includes(c.kind as string)&&id(c.jobId))cue={kind:c.kind as 'released'|'received',jobId:c.jobId};
  else throw Error('Invalid shared moment cue.');
  let entry:LessonEntry|undefined;
  if(m.entry!==undefined){
   const e=m.entry;if(!object(e)||!number(e.carrier)||!Array.isArray(e.conditions)||!e.conditions.length||e.conditions.length>3)throw Error('Independent entry needs a carrier slot and 1–3 conditions.');
   const conditions=e.conditions.map((c):EntryCondition=>{
    if(!object(c))throw Error('Invalid entry condition.');if(c.kind==='pressed')return {kind:'pressed'};
    if(!id(c.spaceId)||!spaces.some(s=>s.id===c.spaceId))throw Error('Entry condition needs a known space.');
    if(c.kind==='space')return {kind:'space',spaceId:c.spaceId};
    if(c.kind==='delivery'&&number(c.runner)&&(c.delivery===undefined||['auto','ground','loft'].includes(c.delivery as string)))return {kind:'delivery',runner:c.runner,spaceId:c.spaceId,...(c.delivery?{delivery:c.delivery as 'auto'|'ground'|'loft'}:{})};
    throw Error('Invalid entry condition.');
   });
   let receiverBindings:Record<string,TeachingNumber>|undefined;
   if(e.receiverBindings!==undefined){if(!object(e.receiverBindings)||Object.keys(e.receiverBindings).length>12)throw Error('Invalid independent receiver bindings.');receiverBindings={};for(const [key,value] of Object.entries(e.receiverBindings)){if(!id(key)||!number(value))throw Error('Independent receiver binding needs a pass job and player slot.');receiverBindings[key]=value;}}
   entry={carrier:e.carrier,conditions,...(receiverBindings?{receiverBindings}:{})};
  }
  return {id:m.id as string,name:title,cue,...(entry?{entry}:{})};
 });
 const slots=new Set<string>();
 const jobs=rows(input.jobs,12,'jobs').map((j):LessonJob=>{
  if(!id(j.momentId)||!moments.some(m=>m.id===j.momentId)||!['advance','offer','run','occupy','pass','shoot','hold'].includes(j.kind as string))throw Error('Lesson job needs a known moment and responsibility.');
  const a=actor(j.actor),slot=`${j.momentId}:${typeof a==='number'?a:`receiver:${a.receiverOf}`}`;if(slots.has(slot))throw Error('One responsibility per actor in a shared moment.');slots.add(slot);
  if(j.spaceId!==undefined&&(!id(j.spaceId)||!spaces.some(s=>s.id===j.spaceId)))throw Error('Lesson job references an unknown shared space.');
  if(['advance','run'].includes(j.kind as string)&&j.spaceId===undefined)throw Error('Advance and run responsibilities need a shared space.');
  if(j.kind==='occupy'&&!number(j.opponent))throw Error('Occupy needs an opposing outfield player.');
  if(j.opponent!==undefined&&(j.kind!=='occupy'||!number(j.opponent)))throw Error('Opponent is only valid for occupy.');
  if(j.teammate!==undefined&&(j.kind!=='offer'||j.teammate!=='carrier'&&!number(j.teammate)))throw Error('Offer references a teammate or the live carrier.');
  if(j.kind==='pass'&&j.recipient===undefined&&j.spaceId===undefined)throw Error('Pass needs a preferred recipient or shared space.');
  if(j.recipient!==undefined&&(j.kind!=='pass'||j.recipient!=='free'&&!number(j.recipient)))throw Error('Invalid preferred pass recipient.');
  if(j.delivery!==undefined&&(j.kind!=='pass'||!['auto','ground','loft'].includes(j.delivery as string)))throw Error('Invalid pass delivery.');
  if(j.repeat!==undefined&&(typeof j.repeat!=='boolean'||j.kind!=='pass'||!number(j.recipient)||j.recipient===a||j.spaceId!==undefined||j.delivery&&j.delivery!=='auto'))throw Error('Un-doiul repetat cere un partener distinct, fără o destinație fixă sau o înălțime impusă.');
  if(j.fallback!==undefined&&(j.kind!=='pass'||typeof j.fallback!=='boolean'))throw Error('Invalid pass fallback.');
  if(j.kind==='shoot'&&j.spaceId!==undefined)throw Error('Shoot evaluates the actual goal, not a shared space.');
  return {id:j.id as string,momentId:j.momentId,actor:a,kind:j.kind as LessonJob['kind'],...(j.spaceId!==undefined?{spaceId:j.spaceId as string}:{}),...(j.teammate!==undefined?{teammate:j.teammate as LessonJob['teammate']}:{}),...(j.opponent!==undefined?{opponent:j.opponent as TeachingNumber}:{}),...(j.recipient!==undefined?{recipient:j.recipient as LessonJob['recipient']}:{}),...(j.delivery!==undefined?{delivery:j.delivery as LessonJob['delivery']}:{}),...(j.fallback!==undefined?{fallback:j.fallback as boolean}:{}),...(j.repeat!==undefined?{repeat:j.repeat as boolean}:{})};
 });
 if(jobs.filter(j=>j.repeat).length>1)throw Error('O idee poate avea o singură pereche de un-doi repetat.');
 for(const moment of moments){const cue=moment.cue;if((cue.kind==='released'||cue.kind==='received')&&!jobs.some(j=>j.id===cue.jobId&&(j.kind==='pass'||cue.kind==='released'&&j.kind==='shoot')))throw Error('Shared release/receipt cues must reference a compatible job.');}
 const references=(a:ActionActor):string[]=>{
  if(typeof a==='number')return [];
  if(!jobs.some(j=>j.id===a.receiverOf&&j.kind==='pass'))throw Error('receiverOf must reference an actual pass responsibility.');
  return [a.receiverOf];
 };
 for(const moment of moments)if(moment.cue.kind==='pressed')references(moment.cue.actor);
 const dependencies=new Map(jobs.map(j=>{
  const cue=moments.find(m=>m.id===j.momentId)!.cue;
  return [j.id,[...references(j.actor),...(cue.kind==='pressed'?references(cue.actor):cue.kind==='released'||cue.kind==='received'?[cue.jobId]:[])]];
 }));
 const visiting=new Set<string>(),visited=new Set<string>();
 const visit=(key:string)=>{if(visiting.has(key))throw Error('Shared lesson moments contain a dependency cycle.');if(visited.has(key))return;visiting.add(key);for(const source of dependencies.get(key)??[])visit(source);visiting.delete(key);visited.add(key);};
 jobs.forEach(j=>visit(j.id));
 for(const moment of moments)for(const key of Object.keys(moment.entry?.receiverBindings??{}))if(!jobs.some(j=>j.id===key&&j.kind==='pass'))throw Error('Independent receiver binding must name an existing pass job.');
 let roles:LessonSpec['roles'];
 if(input.roles!==undefined){if(!object(input.roles)||Object.keys(input.roles).length>4)throw Error('Roles must be keyed by coaching slots #2–#5.');roles={};for(const [key,value] of Object.entries(input.roles)){if(!['2','3','4','5'].includes(key)||!['carrier','support','runner'].includes(value as string))throw Error('Invalid coaching role.');roles[Number(key) as TeachingNumber]=value as 'carrier'|'support'|'runner';}if(Object.values(roles).filter(r=>r==='carrier').length>1)throw Error('Only one coaching slot can be the carrier.');}
 const scene=input.scene===undefined?undefined:validateScene(input.scene);
 if(scene){
  if(roles)throw Error('A set-piece routine names its players; flexible roles are for open play.');
  if(moments.some(m=>m.entry))throw Error('A set-piece routine starts at its restart, not from an independent entry.');
  if(moments.filter(m=>m.cue.kind==='restart-taken').length>1)throw Error('A routine has one kick.');
 }
 return {spaces,moments,jobs,...(roles?{roles}:{}),...(scene?{scene}:{})};
}
const SCENE_RESTARTS:SceneRestart[]=['corner','freeKick','throw','goalKick'];
/** The part of the pitch a spot lies in (own attacking frame): the own third,
 * the attacking part (from where the engine sets up an attacking free kick,
 * X(63), so a free kick in shooting range counts) and the middle between. */
export function sceneZoneOf(x:number):Exclude<SceneZone,'any'>{return x<L/3?'defensive':x>=X(63)?'attacking':'middle';}
/** The flank a spot is on (own attacking frame): left is y < 0. */
export const sceneSideOf=(y:number):'left'|'right'=>y<0?'left':'right';
/** Where a restart of each kind can be (own attacking frame). */
function sceneBallFits(restart:SceneRestart,b:Vec):boolean{
 if(b.x<.5||b.x>L-.5||Math.abs(b.y)>W/2-.2)return false;
 if(restart==='corner')return b.x>=L-2&&Math.abs(b.y)>=W/2-1.5;
 if(restart==='goalKick')return b.x<=6&&Math.abs(b.y)<=5;
 if(restart==='throw')return Math.abs(b.y)>=W/2-1.5;
 return Math.abs(b.y)<=W/2-1;
}
export function validateScene(v:unknown):LessonScene{
 if(!object(v)||!SCENE_RESTARTS.includes(v.restart as SceneRestart))throw Error('Scene: corner, free kick, throw-in or goal kick.');
 const restart=v.restart as SceneRestart;
 if(v.side!==undefined&&(!['left','right','any'].includes(v.side as string)||restart==='goalKick'))throw Error('Scene side: left, right or any (not for goal kicks).');
 if(v.zone!==undefined&&(!['defensive','middle','attacking','any'].includes(v.zone as string)||restart==='corner'||restart==='goalKick'))throw Error('Scene zone: free kicks and throw-ins only.');
 const b=v.ball;if(!object(b)||!finite(b.x)||!finite(b.y)||!sceneBallFits(restart,b as unknown as Vec))throw Error('Scene ball: where that restart is taken.');
 // The drawing is where the routine is used: a one-sided routine drawn on the
 // other flank, or a free kick drawn outside its third, would be placed
 // somewhere its manager never drew it.
 if((v.side==='left'||v.side==='right')&&sceneSideOf(b.y as number)!==v.side)throw Error('Scene side: the ball is drawn on the other side.');
 if(v.zone!==undefined&&v.zone!=='any'&&sceneZoneOf(b.x as number)!==v.zone)throw Error('Scene zone: the ball is drawn in another third.');
 const taker=v.taker;
 if(restart==='goalKick'?taker!==1:!number(taker))throw Error('Scene taker: the keeper at a goal kick, an outfield player otherwise.');
 if(!Array.isArray(v.spots)||v.spots.length>4)throw Error('Scene spots: at most four outfield players.');
 const seen=new Set<number>();
 const spots=v.spots.map((q):SceneSpot=>{
  if(!object(q)||!number(q.number)||q.number===taker||seen.has(q.number)||!finite(q.x)||!finite(q.y)||q.x<.8||q.x>L-.8||Math.abs(q.y)>W/2-1||!finite(q.leash)||q.leash<0||q.leash>SCENE_LEASH_MAX)throw Error('Scene spot: a distinct outfield player (not the taker) on the pitch, roaming 0–8 m.');
  seen.add(q.number);return {number:q.number,x:q.x,y:q.y,leash:q.leash};
 });
 return {restart,...(v.side!==undefined?{side:v.side as 'left'|'right'|'any'}:{}),...(v.zone!==undefined?{zone:v.zone as SceneZone}:{}),ball:{x:b.x as number,y:b.y as number},taker:taker as 1|TeachingNumber,spots};
}
/** Event graph compilation preserves shared IDs. Responsibility interpretation stays live. */
export function compileLesson(lesson:LessonSpec):ActionStep[] {
 return lesson.jobs.map(job=>{
  const cue=lesson.moments.find(m=>m.id===job.momentId)!.cue,space=lesson.spaces.find(s=>s.id===job.spaceId);
  const action=job.kind==='advance'?'carry':job.kind==='run'?'move':['offer','occupy'].includes(job.kind)?'hold':job.kind as ActionStep['action'];
  const target=job.kind==='pass'?typeof job.recipient==='number'?{kind:'player' as const,number:job.recipient}:{kind:'free' as const,...(space?{x:space.x,y:space.y}:{})}:space?{kind:'point' as const,x:space.x,y:space.y}:undefined;
  return {id:job.id,actor:job.actor,action,...(target?{target}:{}),...(job.kind==='pass'?{delivery:job.delivery??'auto',fallback:job.fallback??true}:{}),when:{mode:'all',conditions:[cue.kind==='start'||cue.kind==='restart-taken'?{kind:cue.kind}:cue.kind==='pressed'?cue:{kind:cue.kind,stepId:cue.jobId}]}};
 });
}
export const responsibilityNames:Record<LessonJob['kind'],string>={advance:'avansează ca să invite presiunea',offer:'oferă un unghi de pasă',run:'atacă spațiul comun',occupy:'amenință lângă adversarul ales',pass:'caută legătura cerută',shoot:'evaluează șutul',hold:'protejează spațiul'};

/** A small skill interpreter: ordinary support proposals plus relational alternatives. */
export class LessonResponsibilities {
 private routes=new Map<string,{aim:Vec;score:number;until:number;reference:Vec}>();
 private anchored=new Map<string,{space:LessonSpace;reference:Vec;time:number}>();
 private activatedMoments=new Set<string>();
 private passStarted=new Map<string,number>();
 readonly evaluations=new Map<string,LessonEvidence>();
 constructor(readonly lesson:LessonSpec,readonly side:Side,private risk:Risk,readonly recognised=false,readonly emphasis=1){}
 job(id:string){return this.lesson.jobs.find(j=>j.id===id);}
 space(job:LessonJob):LessonSpace|undefined {const s=this.lesson.spaces.find(s=>s.id===job.spaceId);return s?this.anchored.get(s.id)?.space??{...s,...(this.side?{x:L-s.x,y:-s.y}:{})}:undefined;}
 /** Player anchors are phase snapshots. Opponent anchors follow material motion,
  * with a stable target between reviews; neither changes any player's movement. */
 refreshSpaces(time:number,players:PracticePlayer[],momentId?:string):LessonSpace[] {
  const changed:LessonSpace[]=[];
  const newlyActive=momentId!==undefined&&!this.activatedMoments.has(momentId);
  if(momentId)this.activatedMoments.add(momentId);
  for(const s of this.lesson.spaces){
   const a=s.anchor;if(!a)continue;
   const p=players.find(p=>p.side===(a.kind==='player'?this.side:1-this.side)&&p.number===a.number);if(!p)continue;
   const old=this.anchored.get(s.id),usedHere=newlyActive&&this.lesson.jobs.some(j=>j.momentId===momentId&&j.spaceId===s.id);
   if(old&&!usedHere&&(a.kind==='player'||time-old.time<.5||distance(old.reference,p)<Math.max(2,s.radius*.65)))continue;
   const sign=this.side===0?1:-1,space={...s,x:p.x+sign*a.dx,y:p.y+sign*a.dy};
   this.anchored.set(s.id,{space,reference:{x:p.x,y:p.y},time});
   if(!old||distance(old.space,space)>.05)changed.push(space);
  }
  return changed;
 }
 /** `holder`: while nobody controls the ball (a pass in flight, a loose ball),
  * the team-mate expected to have it next: the flight's receiver or a hunter.
  * Commitment: once a player has taken on his movement (a route was chosen),
  * he keeps making it for the idea's life. He no longer drops it because the
  * ball is momentarily between players, because a defender now stands in the
  * drawn space, or because ordinary support would be slightly more useful at
  * a lighter accent. The carrier's own decisions are untouched. */
 movement(job:LessonJob,p:PracticePlayer,players:PracticePlayer[],ball:MovingBall,support:SupportPlan|null,time:number,holdAim:Vec,holder?:PracticePlayer):{aim:Vec;kind:SupportMove['kind'];speed:number;reason:string;evidence:LessonEvidence}|null {
  const owner=players.find(q=>q.id===ball.owner)??players.find(q=>q.id===support?.owner)??holder,reference=job.kind==='occupy'?players.find(q=>q.side!==p.side&&q.number===job.opponent):job.kind==='offer'&&typeof job.teammate==='number'?players.find(q=>q.side===p.side&&q.number===job.teammate):owner;
  const run=job.kind==='run'||job.kind==='occupy',speed=p.pace*(run?.94:job.kind==='offer'?.82:.65),committed=this.routes.get(job.id);
  const kind:SupportMove['kind']=run?'run':job.kind==='offer'?'show':'hold';
  if(!reference&&job.kind!=='hold'){
   const evidence:LessonEvidence={spaceId:job.spaceId,blockers:[{kind:'availability',text:'Nu există acum un purtător, primitor de pasă sau reper disponibil pentru această relație.'}]};
   this.evaluations.set(job.id,evidence);
   if(!committed)return null;
   return {aim:committed.aim,kind,speed,evidence:{...evidence,aim:committed.aim},reason:'Mingea este între jucători; își continuă deplasarea cerută.'};
  }
  const source=reference??p,space=this.space(job),sign=p.side===0?1:-1,ordinary=support?.moves.find(m=>m.player===p.id&&m.purpose!=='playbook');
  const candidates:Vec[]=[];
  if(ordinary)candidates.push(ordinary.aim);
  if(job.kind==='offer'){
   const center={x:source.x+source.vx*.55,y:source.y+source.vy*.55};
   candidates.push(...shortSupportPoints(p,{...source,...center}));
   candidates.push({x:p.x,y:p.y});
  }else if(job.kind==='occupy'){
   // Remain a separate attacking threat beside/beyond the defender; never chase
   // their body or assign them a response. Read their current position only.
   for(const dx of [1.5,3.5])for(const dy of [-4,-2.5,2.5,4])candidates.push(bound({x:source.x+sign*dx,y:source.y+dy}));
  }else {
   const center=space??holdAim,radius=space?.radius??2;candidates.push(bound(center));
   for(let i=0;i<8;i++){const a=i*Math.PI/4;candidates.push(bound({x:center.x+Math.cos(a)*radius*.8,y:center.y+Math.sin(a)*radius*.8}));}
  }
  const ballReference=job.kind==='occupy'?(owner??p):source;
  const readings=candidates.filter((v,i)=>!candidates.slice(0,i).some(q=>distance(v,q)<.15)).map(aim=>{
   const read=readSupportLocation(p,aim,players,ballReference,this.risk,run,speed),zone=space?Math.max(0,distance(aim,space)-space.radius):0;
   const goalProgress=(aim.x-p.x)*sign,opponentGap=job.kind==='occupy'?distance(aim,source):undefined;
   // Reachable, inside the drawn space and not on top of a team-mate: the
   // run itself is still possible. Room from defenders and an open lane are
   // what make it attractive to START; a committed runner keeps going anyway.
   const possible=read.crowding<.8&&read.travel<6&&(!space||!['run','hold'].includes(job.kind)||zone<.1)&&(job.kind!=='offer'||read.gap>=4.5&&read.gap<=20)&&(job.kind!=='occupy'||opponentGap!>=2&&opponentGap!<=7);
   const usable=possible&&read.room>=1.5&&(job.kind!=='offer'||read.risk<.8);
   const score=(run?.55:.65)+clamp(read.room/7,0,1)*.22-read.risk*(job.kind==='offer'?.75:run?.14:.25)-read.travel*.085-read.crowding*.65-zone*.22+(run?clamp(goalProgress/8,-1,1)*.12:0)-(job.kind==='hold'?distance(aim,space??holdAim)*.09:0)-(job.kind==='offer'?Math.max(0,read.gap-9)*.04+(1-read.releaseRoom)*.3:0);
   return {aim,read,score,usable,possible};
  }).sort((a,b)=>b.score-a.score);
  const previous=committed;let eligible=readings.filter(r=>r.usable);
  if(!eligible.length&&previous)eligible=readings.filter(r=>r.possible);
  let best=eligible[0];
  if(previous&&time<previous.until&&distance(previous.reference,source)<1.4){const still=eligible.find(r=>distance(r.aim,previous.aim)<.4);if(still&&(!best||still.score>=best.score-.12))best=still;}
  const evidence:LessonEvidence={reference:reference?.id,spaceId:job.spaceId,...(space&&this.recognised?{resolvedSpaces:[space]}:{}),options:readings.slice(0,5).map(r=>({kind:job.kind,aim:r.aim,score:r.score,laneRisk:r.read.risk,room:r.read.room,travel:r.read.travel,crowding:r.read.crowding,matches:r.usable})),blockers:[]};
  // The accent decides whether he takes the movement on, not whether he keeps it.
  if(best&&ordinary&&this.emphasis<1&&!previous){
   const neutral=readSupportLocation(p,ordinary.aim,players,ballReference,this.risk,run,speed);
   const quality=(r:typeof neutral)=>clamp(r.room/7,0,1)*.22-r.risk*(job.kind==='offer'?.75:run?.14:.25)-r.travel*.085-r.crowding*.65-(job.kind==='offer'?(1-r.releaseRoom)*.3:0);
   const ordinaryMatches=space?distance(ordinary.aim,space)<=space.radius:distance(ordinary.aim,best.aim)<2;
   if(!ordinaryMatches&&neutral.room>=1.2&&quality(neutral)+(1-this.emphasis)*.65>quality(best.read)+this.emphasis*.35){this.evaluations.set(job.id,{...evidence,chosen:{kind:ordinary.kind,aim:ordinary.aim,score:quality(neutral)},blockers:[{kind:'availability',text:'La accentul ales, păstrează sprijinul obișnuit disponibil.'}]});return null;}
  }
  if(!best){evidence.blockers!.push({kind:'availability',text:'Nicio poziție evaluată nu păstrează distanța, separarea și accesul necesar.'});this.evaluations.set(job.id,evidence);return null;}
  this.routes.set(job.id,{aim:best.aim,score:best.score,until:time+.65,reference:{x:source.x,y:source.y}});
  evidence.aim=best.aim;evidence.chosen={kind,aim:best.aim,score:best.score};
  this.evaluations.set(job.id,evidence);
  const incoming=ball.owner?0:Math.min(2.5,distance(ball,ballReference)/Math.max(3,Math.hypot(ball.vx,ball.vy)));
  const timing=job.kind==='run'?timeSupportRun(p,best.aim,speed,ballReference,players,incoming):{speed,waiting:false};
  return {aim:best.aim,kind,speed:timing.speed,evidence,reason:timing.waiting?'Își dozează cursa pentru a sosi odată cu pasa posibilă.':job.kind==='offer'?`Caută un unghi față de #${source.number}: risc de culoar ${Math.round(best.read.risk*100)}%, spațiu ${best.read.room.toFixed(1)} m.`:job.kind==='occupy'?`Oferă o amenințare la ${distance(best.aim,source).toFixed(1)} m de #${source.number}; adversarul decide independent.`:`Interpretează ${space?.name??'spațiul protejat'}: ${best.read.room.toFixed(1)} m până la adversarul apropiat, ${best.read.travel.toFixed(1)} s deplasare estimată.`};
 }
 options(job:LessonJob,p:PracticePlayer,players:PracticePlayer[],ball:MovingBall,support:SupportPlan|null,time:number,ordinary:Option[],holdAim?:Vec,anticipating=false):Option[] {
  if(this.emphasis===0||['offer','run','occupy'].includes(job.kind))return ordinary;
  const space=this.space(job),aim=space??holdAim,opponents=players.filter(q=>q.side!==p.side);let choices=ordinary;
  if((job.kind==='advance'||job.kind==='hold')&&aim){
   const length=distance(p,aim),extra=bound({x:p.x+(aim.x-p.x)*Math.min(1,7/Math.max(.01,length)),y:p.y+(aim.y-p.y)*Math.min(1,7/Math.max(.01,length))});
   const more=carryOptions(p,players,0,this.risk,null,time,[extra]).filter(o=>!ordinary.some(q=>q.kind==='carry'&&distance(q.aim,o.aim)<.2));choices=[...ordinary,...securePossessionOptions(p,players,more,this.risk)];
  }
  // Coaching can request a short aerial pass that ordinary play would never
  // propose. Generate it before judging it, retaining the normal physics/risk.
  if(job.kind==='pass'&&job.delivery==='loft'){
   const requested=players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK'&&(typeof job.recipient!=='number'||q.number===job.recipient))
    .flatMap(q=>loftOptions(p,q,players,activePassRun(support,p,q,time),ball,this.risk,space,{support,time}).slice(0,1));
   choices=[...choices,...securePossessionOptions(p,players,requested,this.risk)];
  }
  if(job.kind==='pass'&&space){
   // Pair the pass with the actual teammate attacking this shared area; an
   // unrelated run is not an interchangeable version of the coached link.
   const directed:Option[]=[];
   for(const q of players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK')){
    const run=activePassRun(support,p,q,time);
    if(!run||distance(run.aim,space)>space.radius+1.5||typeof job.recipient==='number'&&q.number!==job.recipient)continue;
    const candidates:Option[]=[];
    if(job.delivery!=='ground')candidates.push(loftOptions(p,q,players,run,ball,this.risk,space,{support,time})[0]);
    if(job.delivery!=='loft')candidates.push(groundOptions(p,q,players,true,run,ball,this.risk,'',0,space,{support,time})[0]);
    for(const option of candidates){
     if(distance(option.aim,space)>space.radius+.1)continue;
     directed.push({...option,receivingSpace:{x:space.x,y:space.y,radius:space.radius},reason:`Caută cursa lui #${q.number} în ${space.name}, cu timp de zbor pentru sosirea lui.`});
    }
   }
   choices=[...choices,...securePossessionOptions(p,players,directed,this.risk)];
  }
  const best=Math.max(...choices.map(o=>o.score)),evidence:LessonEvidence={spaceId:job.spaceId,...(space&&this.recognised?{resolvedSpaces:[space]}:{}),options:[],blockers:[]};
  const arrived=job.kind==='advance'&&!!space&&distance(p,space)<=space.radius;
  const safety=possessionSafety(p,players);
  // The coach supplies the longer-term reason to carry, including retreating.
  // Ordinary forward-gain scoring cannot veto that purpose before it is tried.
  // A real shooting opportunity still competes; unsafe turns and routes lose
  // the preference and leave the ordinary escape/release choices available.
  const carryReference=Math.max(...choices.filter(o=>o.kind!=='shoot').map(o=>o.score));
  if(arrived)evidence.blockers!.push({kind:'space',text:'A ajuns în spațiul cerut; poate alege continuarea obișnuită.'});
  const preferredPass=(o:Option)=>{
   const recipient=players.find(q=>q.id===o.target),run=support?.moves.find(m=>m.player===o.target&&m.kind==='run'&&m.until>time),delivery=job.delivery??'auto';
   return !!(o.pass??o.loft)&&(delivery==='auto'||(delivery==='loft'?o.kind==='loft':o.kind!=='loft'))&&(typeof job.recipient!=='number'||recipient?.number===job.recipient)&&(!space||distance(o.aim,space)<=space.radius+1.5);
  };
  const safePreferred=job.kind==='pass'&&choices.some(o=>{const pass=o.pass??o.loft;return preferredPass(o)&&!!pass&&pass.risk<=.42&&pass.controlRisk<=.48&&pass.reachMargin>=-.6;});
  if(job.kind==='pass'&&!choices.some(preferredPass))evidence.blockers!.push({kind:'availability',text:`Nicio variantă evaluată nu leagă acum ${typeof job.recipient==='number'?`colegul #${job.recipient}`:'un coleg'}${space?` de ${space.name}`:''}${job.delivery==='loft'?' printr-o pasă pe sus':job.delivery==='ground'?' printr-o pasă pe jos':''}.`});
  if(job.kind==='pass'&&!anticipating){if(safePreferred)this.passStarted.delete(job.id);else if(!this.passStarted.has(job.id))this.passStarted.set(job.id,time);}
  const opening=support?.moves.find(m=>{
   const q=players.find(q=>q.id===m.player);
   if(!q||q.side!==p.side||q.id===p.id||m.until<=time||!['run','show'].includes(m.kind)||distance(q,m.aim)<1)return false;
   if(typeof job.recipient==='number'&&q.number!==job.recipient)return false;
   return space?distance(m.aim,space)<=space.radius+1.5:typeof job.recipient==='number'&&distance(q,m.aim)<q.pace*1.5&&this.risk(p,m.aim,opponents)<.4;
  });
  const developing=job.kind==='pass'&&!safePreferred&&(anticipating||time-(this.passStarted.get(job.id)??time)<PASS_OPENING_SECONDS)&&safety.contactTime>.7&&safety.urgency<.25&&!!opening;
  const setupCarry=developing?choices.filter(o=>o.kind==='carry'&&o.carry&&o.carry.obstruction<.3&&o.carry.clearance>1.5).sort((a,b)=>b.score-a.score)[0]:undefined;
  const ranked=choices.map(o=>{
   let match=false,fitness=0,teachingFit:number|undefined;
   const pass=o.pass??o.loft,recipient=players.find(q=>q.id===o.target),run=support?.moves.find(m=>m.player===o.target&&m.kind==='run'&&m.until>time);
   let advanceScore:number|undefined;
   if(job.kind==='advance'&&(o.kind==='carry'&&o.carry||o.kind==='feint')&&aim){
    const dx=aim.x-p.x,dy=aim.y-p.y,ox=o.aim.x-p.x,oy=o.aim.y-p.y;
    const alignment=clamp((dx*ox+dy*oy)/Math.max(.01,Math.hypot(dx,dy)*Math.hypot(ox,oy)),0,1);
    const progress=distance(p,aim)-distance(o.aim,aim),confidence=dribbleConfidence(p);
    match=!arrived&&alignment>.5&&progress>.25;
    const local=o.carry??readDribbleRoute(p,o.aim,players,o.kind==='feint'?o.target:undefined);
    const contactRisk=local.contactRisk??0,crowding=Math.max(0,(local.nearbyChallenges??0)-(o.kind==='feint'?0:1));
    const turnRate=bodyTurnRate(p);
    const turnAngle=Math.abs(Math.atan2(Math.sin(Math.atan2(oy,ox)-p.angle),Math.cos(Math.atan2(oy,ox)-p.angle)));
    const touchInterval=touchGap(p);
    const contactRoom=clamp((safety.contactTime-turnAngle/turnRate-touchInterval)/.2,0,1);
    if(match){
     teachingFit=alignment;
     // Advancing can mean accepting a duel. A possible challenge farther on
     // does not cancel the purpose before the next touch is even threatened.
     const tolerance=.09+confidence*.1;
     const difficulty=(1-alignment)*.26+contactRisk*(.3-confidence*.1)+crowding*(.16-confidence*.04)
      +(o.carry?.obstruction??0)*(.13-confidence*.08)+(1-contactRoom)*(.18-confidence*.1)
      +safety.urgency*(.45-confidence*.18)+(o.kind==='feint'?(1-confidence)*.2:0);
     advanceScore=carryReference+tolerance-difficulty;
     fitness=clamp(1-difficulty,0,1);
     if(contactRisk>.65||crowding>0)evidence.blockers!.push({kind:'control',text: o.kind==='feint'?'Un alt adversar poate închide ieșirea din dribling; compară cu pasa sau protejarea mingii.':'Presiunea ajunge la următoarele atingeri; compară driblingul, pasa și protejarea mingii.'});
    }
   }else if(job.kind==='hold'&&o.kind==='carry'&&o.carry&&aim){match=distance(o.aim,aim)<=Math.max(2,space?.radius??2);fitness=clamp(1-o.carry.obstruction/.55,0,1);}
   else if(job.kind==='shoot'){match=o.kind==='shoot';fitness=match?1:0;}
   else if(job.kind==='pass'&&pass&&['pass','through','loft'].includes(o.kind)){
    const delivery=job.delivery??'auto',height=delivery==='auto'||(delivery==='loft'?o.kind==='loft':o.kind!=='loft');
    const inSpace=!space||distance(o.aim,space)<=space.radius+1.5;
    match=height&&inSpace&&(typeof job.recipient!=='number'||recipient?.number===job.recipient);
    // Permission to continue after an alternative receipt does not promote an
    // unrelated pass. Ordinary alternatives still compete on football merit.
    fitness=(match?1:0)*clamp((.6-pass.risk)/.45,0,1)*clamp((.6-pass.controlRisk)/.5,0,1)*clamp((pass.reachMargin+.8)/1.1,0,1);
   }
   const cap=job.kind==='pass'?.85:job.kind==='shoot'?.35:.3;
   let bonus=fitness>0?(job.kind==='advance'?Math.max(0,carryReference-o.score+.09):cap)*fitness:0;
   if(advanceScore!==undefined)bonus=Math.max(0,advanceScore-o.score);
   if(job.kind==='pass'&&match&&pass&&pass.risk<=.42&&pass.controlRisk<=.48&&pass.reachMargin>=-.6){
    const trust=clamp((.55-pass.risk)/.35,0,1)*clamp((.55-pass.controlRisk)/.3,0,1);
    bonus=Math.max(bonus,Math.max(0,carryReference-o.score+.12)*trust);
   }
   if(o===setupCarry){
    bonus=Math.max(bonus,Math.max(0,carryReference-o.score+.08));
   }
   bonus*=this.emphasis;
   evidence.options!.push({kind:o.kind,target:o.target,aim:{...o.aim},score:o.score,preference:bonus,matches:match,...(pass?{laneRisk:pass.risk,controlRisk:pass.controlRisk,reachMargin:pass.reachMargin}:{}),...(o.carry?{laneRisk:o.carry.obstruction,room:o.carry.clearance}:{})});
   if(match&&pass){
    if(pass.risk>.55)evidence.blockers!.push({kind:'lane',actor:recipient?.id,value:pass.risk,text:`Varianta ${o.kind==='loft'?'înaltă':'pe jos'} către #${recipient?.number??'?'} are risc evaluat ${Math.round(pass.risk*100)}%.`});
    if(pass.controlRisk>.48)evidence.blockers!.push({kind:'control',actor:recipient?.id,value:pass.controlRisk,text:'Primirea evaluată este dificilă.'});
    if(pass.reachMargin<-.6)evidence.blockers!.push({kind:'reach',actor:recipient?.id,value:pass.reachMargin,text:'Colegul ajunge târziu în evaluarea pasei.'});
   }
   if(match&&o.carry&&o.carry.obstruction>.6)evidence.blockers!.push({kind:'lane',value:o.carry.obstruction,text:'Un apărător poate contesta traseul mai departe; asta nu blochează automat următoarea atingere.'});
   if(bonus<.015&&!(job.kind==='advance'&&match))return o;
   // The evidence keeps the idea's full pull (recognition ranks matching
   // routes by it); the score it adds is capped.
   return {...o,score:o.score+Math.min(bonus,IDEA_PREFERENCE_CAP),...(match||o===setupCarry?{teachingStep:job.id}:{}),...(teachingFit!==undefined?{teachingFit}:{}),teachingSpace:o.kind==='through'||o.kind==='loft'&&!!o.run,reason:o===setupCarry?`Păstrează mingea pentru a da timp ${space?`cursei spre ${space.name}`:'colegului să deschidă un nou unghi'}; urmărește deschiderea pasei. ${o.reason}`:`Responsabilitate: ${responsibilityNames[job.kind]}. ${o.reason}`};
  });
  if(job.kind==='pass'&&!evidence.options!.some(o=>o.matches))evidence.blockers!.push({kind:'availability',text:'Nicio pasă evaluată nu întâlnește acum colegul în spațiul cerut, cu înălțimea aleasă.'});
  evidence.blockers=evidence.blockers!.filter((b,i,all)=>!all.slice(0,i).some(a=>a.kind===b.kind&&a.actor===b.actor&&a.text===b.text));
  this.evaluations.set(job.id,evidence);return ranked;
 }
}
