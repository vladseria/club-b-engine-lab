import type {Fixture,Role,Side,Tactics} from './model.js';
import {shapes} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {SubstitutionTrigger} from './practice-substitutions.js';
import {triggerHolds} from './practice-substitutions.js';
import {styleBaseProblem} from './style.js';

/**
 * Manager-prepared tactics switch (opt-in; Ballers "in-match plan switch", 21 Oct 2026,
 * deliverables/ballers-plan-switch/DESIGN.md). A side may carry at most one: a trigger (the substitution
 * orders' score, margin and half-time kinds; never `tired`, which names a player), an optional earliest
 * second, and the complete tactics the side plays from then on.
 *
 * Like a substitution order, it is evaluated only at stoppages (never at the opening kickoff, never
 * after full time) and carried out at the first one at which its trigger holds. What it changes:
 *  - the side's base tactics, replaced whole. Every read goes through the fixture's tactics
 *    (`tacticsFor` rebuilds the situation from them on each call), so the regain rewrites
 *    (team-approach approachInPossession / approachForSituation) recompute from the new base at
 *    the next read; at a stoppage none is in flight anyway (startRestart clears the regain clock).
 *  - optionally the keepers' sweep habit (`keepers`: squad id -> keeperSweep, or null for the
 *    keeper's own trait), on the pitch and on the bench, as Ballers' keeper call is a squad trait.
 *  - the men's places, after the tactics, whenever `slots` moves anyone (owner, 21 Oct: "the plan changes but
 *    the players stay"; and, the same day, the slot rule in every switch, same formation included): every
 *    man on the pitch keeps his place in the side and takes a new
 *    slot, `slots[his slot now] = his new slot` (slot = lineup position, 0 the keeper; a man who came on
 *    holds the slot of the man he replaced), so his role, lane and shirt slot become that slot's in the
 *    (new or same) shape. Another formation needs slots; in the same formation they are optional, and a map
 *    that moves nobody is dropped at validation, so such a switch is exactly a tactics-only one. Everything the engine reads from roles and lanes (the shape in and out of possession, box
 *    arrivals, the lead forward, keeper support, restart spots) reads the live values, and the restart the
 *    switch fires at is laid out after it. A later substitution's newcomer takes the outgoing man's new
 *    slot, as always. Refused together with that side's playbook (slot-addressed moves and routines were
 *    drawn for the old shape; Ballers' game-plan clubs carry none) and with the automatic planned
 *    substitutions (their shirt slots are squad numbers, not lineup slots).
 * What it never changes: who plays, substitution orders, plans and routines.
 * With no switch the engine does not run any of this code.
 */
export const MAX_TACTICS_SWITCHES=1;
export type SwitchTrigger=Exclude<SubstitutionTrigger,{kind:'tired'}>;
export interface TacticsSwitch {
 id:string;side:Side;trigger:SwitchTrigger;
 /** Optional earliest match second at which the trigger may be acted upon. */
 notBefore?:number;
 /** The side's complete tactics from the switch on. */
 tactics:Tactics;
 /** New slot by current slot (0..4; slots[0] is 0, the keeper). Required for another formation; in the same
  * formation only when it moves someone (an identity map is dropped). */
 slots?:number[];
 /** Squad id -> the keeper's sweep habit from the switch on (0..1), or null for his own trait. */
 keepers?:Record<string,number|null>;
}
/** `skipped`: due, but a switch with slots found the side not in its five lineup slots (it never throws mid-match). */
export interface SwitchNote {order:string;side:Side;status:'made'|'waiting'|'skipped';time?:number;detail?:string}
export interface SwitchRecord {order:string;trigger:SwitchTrigger;score:[number,number];
 /** Men moved to new slots: where each man of the side now plays, and the new formation when it changed. */
 formation?:Tactics['formation'];players?:{id:string;role:Role;lane:number;number:number}[]}

const ID=/^[A-Za-z0-9_.:@+-]{1,64}$/;
const ONE_OF:readonly (readonly [keyof Tactics,readonly string[],boolean])[]=[
 ['line',['deep','standard','high'],true],['press',['selective','balanced','aggressive'],true],
 ['progression',['patient','mixed','direct'],true],['width',['narrow','standard','wide'],true],
 ['setPiece',['mixed','short','delivery'],true],['striker',['mixed','link','pivot','run'],false],
 ['transition',['balanced','secure','counter'],false],['onLoss',['regroup','balanced','counterpress'],false],
 ['marking',['balanced','zonal','tight'],false],['fullbacks',['balanced','overlap','hold'],false],
];

/** Throws on an invalid switch; returns a normalized deep copy. */
export function validateTacticsSwitches(value:unknown,fixture:Fixture):TacticsSwitch[]{
 if(!Array.isArray(value))throw Error('Tactics switches must be a list.');
 const ids=new Set<string>(),perSide=[0,0];
 return value.map((raw):TacticsSwitch=>{
  if(!raw||typeof raw!=='object')throw Error('Invalid tactics switch.');
  const o=raw as Record<string,unknown>,t=o.trigger as Record<string,unknown>|undefined;
  if(typeof o.id!=='string'||!ID.test(o.id)||ids.has(o.id))throw Error('Each tactics switch needs a distinct id.');
  ids.add(o.id);
  if(o.side!==0&&o.side!==1)throw Error('A tactics switch needs side 0 or 1.');
  const side=o.side as Side,team=fixture.teams[side];
  if(++perSide[side]>MAX_TACTICS_SWITCHES)throw Error(`At most ${MAX_TACTICS_SWITCHES} tactics switch per team.`);
  if(!t||typeof t!=='object')throw Error('A tactics switch needs a trigger.');
  let trigger:SwitchTrigger;
  if(t.kind==='score'){
   if(!['losing','drawing','winning'].includes(t.state as string))throw Error('Score trigger needs losing, drawing or winning.');
   trigger={kind:'score',state:t.state as 'losing'|'drawing'|'winning'};
  }else if(t.kind==='margin'){
   if(!Number.isInteger(t.atLeast)||(t.atLeast as number)<1||(t.atLeast as number)>20||!['up','down'].includes(t.direction as string))throw Error('Margin trigger needs a whole goal margin (1–20) up or down.');
   trigger={kind:'margin',atLeast:t.atLeast as number,direction:t.direction as 'up'|'down'};
  }else if(t.kind==='half')trigger={kind:'half'};
  else throw Error('Unknown tactics switch trigger.');
  if(o.notBefore!==undefined&&(typeof o.notBefore!=='number'||!Number.isFinite(o.notBefore)||o.notBefore<0||o.notBefore>5400))throw Error('notBefore is a match second between 0 and 5400.');
  const tactics=o.tactics as Record<string,unknown>|undefined;
  if(!tactics||typeof tactics!=='object'||Array.isArray(tactics))throw Error('A tactics switch needs the tactics to play.');
  let slots:number[]|undefined;
  if(tactics.formation!==team.tactics.formation){
   if(typeof tactics.formation!=='string'||shapes[tactics.formation as Tactics['formation']]?.length!==5)throw Error('Invalid switch tactics: a five-a-side formation.');
   const s=o.slots;
   slots=checkSlots(s);
  }else if(o.slots!==undefined){
   // the same formation: the men line up as plan B says; a map that moves nobody is no map at all
   const s=checkSlots(o.slots);if(s.some((n,i)=>n!==i))slots=s;
  }
  for(const [field,options,required] of ONE_OF){
   const v=tactics[field];
   if(v===undefined&&!required)continue;
   if(typeof v!=='string'||!options.includes(v))throw Error(`Invalid switch tactics: ${field} is ${v===undefined?'undefined':JSON.stringify(v)}.`);
  }
  if(typeof tactics.commit!=='number'||!Number.isFinite(tactics.commit)||tactics.commit<1||tactics.commit>5)throw Error('Invalid switch tactics: commit is a number from 1 to 5.');
  // (styles as identities, slice 1) the target names its style only with that style's base (style.ts STYLE)
  const base=styleBaseProblem(tactics);
  if(base)throw Error(`Invalid switch tactics: ${base}.`);
  const squad=new Map(team.squad.map(p=>[p.id,p]));
  if(tactics.taker!==undefined&&(typeof tactics.taker!=='string'||!squad.has(tactics.taker)))throw Error('Invalid switch tactics: the taker must be in the squad.');
  let keepers:Record<string,number|null>|undefined;
  if(o.keepers!==undefined){
   if(!o.keepers||typeof o.keepers!=='object'||Array.isArray(o.keepers))throw Error('Switch keepers map squad keepers to a sweep habit.');
   keepers={};
   for(const [id,v] of Object.entries(o.keepers as Record<string,unknown>)){
    if(!squad.get(id)?.roles.includes('GK'))throw Error('Switch keepers name squad keepers only.');
    if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw Error('A keeper\'s sweep habit is between 0 and 1 (or null for his own).');
    keepers[id]=v as number|null;
   }
  }
  return {id:o.id,side,trigger,...(o.notBefore!==undefined?{notBefore:o.notBefore as number}:{}),tactics:structuredClone(tactics) as unknown as Tactics,...(slots?{slots}:{}),...(keepers?{keepers}:{})};
 });
}

function checkSlots(s:unknown):number[]{
 if(!Array.isArray(s)||s.length!==5||s[0]!==0||!s.every(n=>Number.isInteger(n)&&n>=0&&n<=4)||new Set(s).size!==5)throw Error('A switch needs a slot for every man: five distinct slots, the keeper staying in goal.');
 return [...s] as number[];
}

/** Is the switch due at this stoppage? (Its note is still waiting; the caller checks that.) */
export function switchDue(order:TacticsSwitch,time:number,duration:number,score:readonly [number,number],players:readonly PracticePlayer[]):boolean{
 return (order.notBefore??0)<=time&&triggerHolds(order.trigger,order.side,time,duration,score,players);
}

/** Can a switch with slots place this side's men? Every man must hold one of the five lineup slots (1..5). */
export function slotsPlaceable(order:TacticsSwitch,players:readonly PracticePlayer[]):boolean{
 if(!order.slots)return true;
 const mine=players.filter(p=>p.side===order.side);
 return mine.length===5&&new Set(mine.map(p=>p.number)).size===5&&mine.every(p=>p.number>=1&&p.number<=5);
}
/** Carry out a due switch: the side's base tactics replaced whole, then (a formation switch) each man's slot,
 * role and lane, and the keepers' habit where it is given. Returns where the side's men now play when the
 * formation changed. The caller checks slotsPlaceable first: nothing here throws inside a match. */
export function applyTacticsSwitch(order:TacticsSwitch,fixture:Fixture,players:PracticePlayer[]):SwitchRecord['players']{
 const team=fixture.teams[order.side];
 team.tactics=structuredClone(order.tactics);
 let moved:SwitchRecord['players'];
 if(order.slots){
  const shape=shapes[order.tactics.formation],slots=order.slots;
  const mine=players.filter(p=>p.side===order.side);
  for(const p of mine){const slot=slots[p.number-1],[role,lane]=shape[slot];p.role=role;p.lane=lane;p.number=slot+1;}
  moved=mine.map(p=>({id:p.id,role:p.role,lane:p.lane,number:p.number}));
 }
 if(order.keepers)applyKeepers(order,team,players);
 return moved;
}
function applyKeepers(order:TacticsSwitch,team:Fixture['teams'][number],players:PracticePlayer[]):void{
 if(!order.keepers)return;
 const habit=<T extends {traits:{keeperSweep?:number}}>(p:T,v:number|null)=>{
  const traits={...p.traits};if(v===null)delete traits.keeperSweep;else traits.keeperSweep=v;p.traits=traits;
 };
 for(const [id,v] of Object.entries(order.keepers)){
  const source=team.squad.find(p=>p.id===id);if(source)habit(source,v);
  const on=players.find(p=>p.id===`${order.side}:${id}`);if(on)habit(on,v);
 }
}
