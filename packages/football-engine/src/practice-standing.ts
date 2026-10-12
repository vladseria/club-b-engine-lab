import {rng} from './model.js';
import type {Side,Tactics} from './model.js';
import type {MovingBall} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {PlaybookPlan,OutfieldNumber} from './practice-playbook.js';
import type {LessonSpec} from './practice-lesson.js';
import type {CoordinationView} from './practice-coordination.js';
import type {SupportMove} from './practice-support.js';
import {containMovement} from './practice-defense.js';
import {markPosition} from './practice-football.js';
import {resolveLessonSpaces} from './practice-recognition.js';
export interface StandingInstruction {
 id:string;actor:OutfieldNumber;kind:'press'|'mark'|'protect'|'stay-forward';
 phase:'defending'|'always';opponent?:OutfieldNumber;spaceId?:string;
}
export interface StandingNote {time:number;planId:string;instructionId:string;actor?:string;kind:StandingInstruction['kind'];status:'active'|'waiting'|'inactive';text:string;target?:string}
export function validateStanding(input:unknown,lesson?:LessonSpec):StandingInstruction[]{
 if(!Array.isArray(input)||input.length>4)throw Error('At most four persistent instructions per tactic.');
 const actors=new Set(),ids=new Set();
 return input.map(raw=>{
  if(!raw||typeof raw!=='object'||!['press','mark','protect','stay-forward'].includes(raw.kind)||![2,3,4,5].includes(raw.actor)||actors.has(raw.actor)||typeof raw.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(raw.id)||ids.has(raw.id)||!['defending','always'].includes(raw.phase))throw Error('Invalid persistent instruction; use one per player in a tactic.');
  actors.add(raw.actor);ids.add(raw.id);
  if(['press','mark'].includes(raw.kind)&&raw.phase!=='defending')throw Error('Pressing and marking apply while defending.');
  if(raw.kind==='mark'&&![2,3,4,5].includes(raw.opponent))throw Error('Choose an outfield opponent to mark.');
  if(['protect','stay-forward'].includes(raw.kind)&&!lesson?.spaces.some(s=>s.id===raw.spaceId))throw Error('Persistent positioning needs a drawn space.');
  return {id:raw.id,actor:raw.actor,kind:raw.kind,phase:raw.phase,...(raw.kind==='mark'?{opponent:raw.opponent}:{}),...(['protect','stay-forward'].includes(raw.kind)?{spaceId:raw.spaceId}:{})};
 });
}
/** Persistent policy is sampled once per possession phase, not on every decision tick.
 * Emphasis changes how often a policy is pursued, never execution or physical reach. */
export class StandingResponsibilities {
 readonly notes:StandingNote[]=[];
 private phase?:Side;
 private selected=new Set<string>();
 private last=new Map<string,string>();
 private readonly random:()=>number;
 constructor(readonly side:Side,readonly plans:PlaybookPlan[],seed:number){this.random=rng(seed^0x42573a91);}
 private note(time:number,plan:PlaybookPlan,j:StandingInstruction,status:StandingNote['status'],text:string,actor?:string,target?:string){
  const key=plan.id+':'+j.id,signature=JSON.stringify([status,text,actor,target]);
  if(this.last.get(key)===signature)return;this.last.set(key,signature);
  this.notes.push({time,planId:plan.id,instructionId:j.id,kind:j.kind,status,text,actor,target});
 }
 moves(time:number,players:PracticePlayer[],ball:MovingBall,attacking:Side,tactics:Tactics,preview:CoordinationView|null,unavailable:ReadonlySet<string>,claimed:ReadonlyMap<string,string>):SupportMove[]{
  const plans=this.plans.filter(p=>p.standing?.length);
  if(!plans.length)return [];
  if(this.phase!==attacking){
   this.phase=attacking;this.selected.clear();
   for(const plan of plans)if(plan.weight>0&&(plan.emphasis??1)>0&&this.random()<(plan.emphasis??1))this.selected.add(plan.id);
  }
  const moves:SupportMove[]=[],assigned=new Map(claimed),owner=players.find(p=>p.id===ball.owner);
  for(const plan of [...plans].sort((a,b)=>b.weight*(b.emphasis??1)-a.weight*(a.emphasis??1))){
   const spaces=plan.lesson?resolveLessonSpaces(plan.lesson,this.side,players,{}):[];
   for(const j of plan.standing!){
    const p=players.find(p=>p.side===this.side&&p.number===j.actor&&p.role!=='GK');
    const report=(status:StandingNote['status'],text:string,target?:string)=>this.note(time,plan,j,status,`${plan.name} · #${j.actor}: ${text}`,p?.id,target);
    if(!p){report('inactive','jucătorul lipsește.');continue;}
    if(j.phase==='defending'&&attacking===this.side){report('inactive','indicația revine când apărăm.');continue;}
    if(!this.selected.has(plan.id)){report('inactive',plan.emphasis===0||plan.weight===0?'indicație dezactivată.':'în această fază folosește jocul obișnuit, conform accentului.');continue;}
    if(p.id===owner?.id){report('waiting','are mingea; decide cum continuă jocul.');continue;}
    if(unavailable.has(p.id)){report('waiting','își termină recuperarea fizică.');continue;}
    if(preview?.flight.hunters.includes(p.id)||preview?.flight.receiver===p.id){report('waiting','prioritate pentru primirea sau recuperarea mingii.');continue;}
    if(assigned.has(p.id)){report('waiting',`participă deja la „${assigned.get(p.id)}”.`);continue;}
    let move:SupportMove;
    const target=j.kind==='mark'?players.find(q=>q.side!==this.side&&q.number===j.opponent):owner?.side!==this.side?owner:undefined;
    if(j.kind==='press'||j.kind==='mark'&&target?.id===owner?.id){
     if(!owner||owner.side===this.side){report('waiting','mingea circulă; urmărește următorul purtător.');continue;}
     const read=containMovement(p,owner,players,tactics);
     move={player:p.id,purpose:'playbook',kind:read.kind,aim:read.aim,speed:read.speed,since:time,until:time+.5,reason:'Presează purtătorul conform indicației; alege momentul intervenției.',defensive:{kind:'press',target:owner.id}};
    }else if(j.kind==='mark'){
     if(!target){report('waiting','adversarul ales nu este pe teren.');continue;}
     move={player:p.id,purpose:'playbook',kind:'track',aim:markPosition(p,target,ball,'tight'),speed:p.pace*.9,since:time,until:time+.5,reason:`Marchează adversarul #${target.number}; urmărește mingea și drumul spre poartă.`,defensive:{kind:'mark',target:target.id}};
    }else{
     const area=spaces.find(s=>s.id===j.spaceId);if(!area||!Number.isFinite(area.x)||!Number.isFinite(area.y)){report('inactive','spațiul nu poate fi rezolvat.');continue;}
     // Use the ball-facing part of the protected area; a forward outlet stays
     // in its requested area rather than being pulled into a defensive quota.
     const dx=ball.x-area.x,dy=ball.y-area.y,length=Math.hypot(dx,dy),offset=Math.min(area.radius*.65,length);
     const aim=j.kind==='protect'?{x:area.x+dx/Math.max(.01,length)*offset,y:area.y+dy/Math.max(.01,length)*offset}:{x:area.x,y:area.y};
     move={player:p.id,purpose:'playbook',kind:j.kind==='protect'?'cover':'hold',aim,speed:p.pace*.86,since:time,until:time+.5,reason:j.kind==='protect'?`Protejează ${area.name}; se ajustează către minge în interiorul zonei.`:`Rămâne în ${area.name}, disponibil pentru ieșirea echipei.`,defensive:{kind:j.kind}};
    }
    moves.push(move);assigned.set(p.id,plan.name);report('active',move.reason,move.defensive?.target);
   }
  }
  return moves;
 }
 reset(){this.phase=undefined;}
}
