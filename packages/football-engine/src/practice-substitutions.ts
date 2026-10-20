import type {Fixture,Side} from './model.js';
import {HALF_SECONDS} from './practice-match.js';
import type {PracticePlayer} from './practice.js';

/**
 * Manager-prepared substitutions (opt-in). Each order names a bench player and a
 * trigger. A trigger is evaluated only at stoppages: the order is carried out at
 * the first restart (after the opening kickoff) at which its trigger holds. The
 * incoming player takes the outgoing player's role, lane and lineup slot number,
 * so slot-addressed plans (#2–#5) and standing instructions pass to him.
 * With no orders the engine does not run any of this code.
 */
export const MAX_TRIGGERED_SUBSTITUTIONS=3;
export type SubstitutionTrigger=
 | {kind:'tired';player:string;threshold:number}
 | {kind:'score';state:'losing'|'drawing'|'winning'}
 | {kind:'margin';atLeast:number;direction:'up'|'down'}
 | {kind:'half'};
export interface SubstitutionOrder {
 id:string;side:Side;
 /** Squad id (unprefixed) of a player who is not in the starting lineup. */
 in:string;
 /** Squad id of the player to replace. Required-equal to the tired player for a `tired` trigger (defaults to him).
  * Omitted for other triggers: the most tired on-pitch player of the same keeper/outfield kind. */
 out?:string;
 trigger:SubstitutionTrigger;
 /** Optional earliest match second at which the trigger may be acted upon. */
 notBefore?:number;
}
export interface SubstitutionNote {
 order:string;side:Side;status:'made'|'waiting'|'impossible';in:string;out?:string;time?:number;detail:string;
}
export interface SubstitutionRecord {order:string;trigger:SubstitutionTrigger;energy:number;score:[number,number]}

const ID=/^[A-Za-z0-9_.:@+-]{1,64}$/;
const keeper=(roles:readonly string[])=>roles[0]==='GK';
/** Formations always put the keeper in lineup slot 0. */
export const halfTime=(duration:number)=>duration>HALF_SECONDS?HALF_SECONDS:duration/2;

/** Throws on invalid orders; returns a normalized deep copy. */
export function validateSubstitutionOrders(value:unknown,fixture:Fixture):SubstitutionOrder[]{
 if(!Array.isArray(value))throw Error('Substitution orders must be a list.');
 const ids=new Set<string>(),incoming=new Set<string>(),perSide=[0,0];
 const orders=value.map((raw):SubstitutionOrder=>{
  if(!raw||typeof raw!=='object')throw Error('Invalid substitution order.');
  const o=raw as Record<string,unknown>,t=o.trigger as Record<string,unknown>|undefined;
  if(typeof o.id!=='string'||!ID.test(o.id)||ids.has(o.id))throw Error('Each substitution order needs a distinct id.');
  ids.add(o.id);
  if(o.side!==0&&o.side!==1)throw Error('A substitution order needs side 0 or 1.');
  const side=o.side as Side,team=fixture.teams[side];
  if(++perSide[side]>MAX_TRIGGERED_SUBSTITUTIONS)throw Error(`At most ${MAX_TRIGGERED_SUBSTITUTIONS} substitutions per team.`);
  const squad=new Map(team.squad.map(p=>[p.id,p]));
  if(typeof o.in!=='string'||!squad.has(o.in))throw Error('The incoming player must be in the squad.');
  if(team.lineup.includes(o.in))throw Error('The incoming player must start on the bench.');
  if(incoming.has(`${side}:${o.in}`))throw Error('A bench player can come on only once.');
  incoming.add(`${side}:${o.in}`);
  if(!t||typeof t!=='object')throw Error('A substitution order needs a trigger.');
  let trigger:SubstitutionTrigger;
  if(t.kind==='tired'){
   if(typeof t.player!=='string'||!squad.has(t.player))throw Error('The tired trigger must name a squad player.');
   if(typeof t.threshold!=='number'||!Number.isFinite(t.threshold)||t.threshold<=0||t.threshold>100)throw Error('The tiredness threshold is energy between 0 and 100.');
   if(o.out!==undefined&&o.out!==t.player)throw Error('A tired trigger replaces the tired player.');
   trigger={kind:'tired',player:t.player,threshold:t.threshold};
  }else if(t.kind==='score'){
   if(!['losing','drawing','winning'].includes(t.state as string))throw Error('Score trigger needs losing, drawing or winning.');
   trigger={kind:'score',state:t.state as 'losing'|'drawing'|'winning'};
  }else if(t.kind==='margin'){
   if(!Number.isInteger(t.atLeast)||(t.atLeast as number)<1||(t.atLeast as number)>20||!['up','down'].includes(t.direction as string))throw Error('Margin trigger needs a whole goal margin (1–20) up or down.');
   trigger={kind:'margin',atLeast:t.atLeast as number,direction:t.direction as 'up'|'down'};
  }else if(t.kind==='half')trigger={kind:'half'};
  else throw Error('Unknown substitution trigger.');
  const out=trigger.kind==='tired'?trigger.player:o.out;
  if(out!==undefined){
   if(typeof out!=='string'||!squad.has(out))throw Error('The outgoing player must be in the squad.');
   if(out===o.in)throw Error('A player cannot replace himself.');
   const slot=team.lineup.indexOf(out);
   if(slot>=0&&(slot===0)!==keeper(squad.get(o.in)!.roles))throw Error('Keepers only replace keepers.');
  }
  if(o.notBefore!==undefined&&(typeof o.notBefore!=='number'||!Number.isFinite(o.notBefore)||o.notBefore<0||o.notBefore>5400))throw Error('notBefore is a match second between 0 and 5400.');
  return {id:o.id,side,in:o.in,...(o.out!==undefined||trigger.kind==='tired'?{out:out as string}:{}),trigger,...(o.notBefore!==undefined?{notBefore:o.notBefore as number}:{})};
 });
 // A named outgoing player must be able to be on the pitch: a starter, or a
 // bench player whom another order of the same team brings on.
 for(const o of orders)if(o.out!==undefined&&!fixture.teams[o.side].lineup.includes(o.out)&&!orders.some(q=>q.side===o.side&&q.in===o.out))
  throw Error('The outgoing player must start or come on through another order.');
 return orders;
}

export function triggerHolds(trigger:SubstitutionTrigger,side:Side,time:number,duration:number,score:readonly [number,number],players:readonly PracticePlayer[]):boolean{
 const diff=score[side]-score[side===0?1:0];
 switch(trigger.kind){
  case 'tired':{const p=players.find(p=>p.id===`${side}:${trigger.player}`);return !!p&&p.energy<trigger.threshold;}
  case 'score':return trigger.state==='losing'?diff<0:trigger.state==='winning'?diff>0:diff===0;
  case 'margin':return (trigger.direction==='up'?diff:-diff)>=trigger.atLeast;
  case 'half':return time>=halfTime(duration);
 }
}

/** Decide one order at a stoppage. `gone` holds practice ids of players who went off. */
export function resolveOrder(order:SubstitutionOrder,fixture:Fixture,players:readonly PracticePlayer[],gone:ReadonlySet<string>):{outgoing:PracticePlayer}|{wait:string}|{impossible:string}{
 const side=order.side,team=fixture.teams[side],source=team.squad.find(p=>p.id===order.in)!;
 const onPitch=players.filter(p=>p.side===side),incomingKeeper=keeper(source.roles);
 if(onPitch.some(p=>p.id===`${side}:${order.in}`)||gone.has(`${side}:${order.in}`))return {impossible:'Jucătorul de rezervă a intrat deja.'};
 if(order.out!==undefined){
  const id=`${side}:${order.out}`,p=onPitch.find(p=>p.id===id);
  if(!p)return gone.has(id)?{impossible:'Jucătorul care trebuia schimbat a ieșit deja.'}:{wait:'Jucătorul care trebuie schimbat nu este pe teren.'};
  if((p.role==='GK')!==incomingKeeper)return {impossible:'Portarii se schimbă doar cu portari.'};
  return {outgoing:p};
 }
 const outgoing=onPitch.filter(p=>(p.role==='GK')===incomingKeeper).sort((a,b)=>a.energy-b.energy||a.number-b.number)[0];
 return outgoing?{outgoing}:{impossible:'Nu există pe teren un jucător de același tip (portar/jucător de câmp).'};
}

export function triggerText(trigger:SubstitutionTrigger,name?:string):string{
 switch(trigger.kind){
  case 'tired':return `${name??'jucătorul'} a obosit`;
  case 'score':return trigger.state==='losing'?'echipa e în urmă':trigger.state==='winning'?'echipa conduce':'e egalitate';
  case 'margin':return trigger.direction==='up'?`echipa conduce la cel puțin ${trigger.atLeast} goluri`:`echipa e condusă la cel puțin ${trigger.atLeast} goluri`;
  case 'half':return 'a venit pauza';
 }
}
