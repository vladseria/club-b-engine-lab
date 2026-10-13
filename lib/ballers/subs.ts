// Ballers P5: triggered substitutions as Match prep writes them and the
// report explains them. Pure. The stored order is the engine's
// SubstitutionOrder without `side` (squad ids); the frozen input adds the side
// (lib/ballers/compute.ts). Validation is the ENGINE's own
// validateSubstitutionOrders on a one-team fixture, so prep, SQL
// (private.ballers_check_subs) and the engine agree on what is allowed.
import {validateSubstitutionOrders,type SubstitutionNote,type SubstitutionOrder,type SubstitutionTrigger} from '../../packages/football-engine/src/practice-substitutions';
import type {Fixture} from '../../packages/football-engine/src/model';

export type PrepOrder=Omit<SubstitutionOrder,'side'>;
export type {SubstitutionNote,SubstitutionTrigger};
export const MAX_SUBS=3;

/** How tired, as three named levels. The number an order stores is the
 * level's CODE (97 / 95 / 92, the values prep has always written), never an
 * energy reading: `engineThreshold` turns a code into the energy the engine
 * compares against on the current fatigue curve, at compute time
 * (lib/ballers/compute.ts sideOrders). Saved orders keep their meaning when
 * the fatigue model changes; only this table is recalibrated.
 *
 * Calibrated on build 07ffe814 (acceleration fatigue, cfc3f98c and later):
 * 10 full matches between real Global squads, 80 outfield players, median
 * energy 94.6 at 5:00, 89.0 at 10:00, 83.6 at full time. First drop below
 * 95 at a median 5:00 (every player), below 90 at 9:30 (every player), below
 * 86 at 12:00 (74% ever get there). Before that build energy ended near 94,
 * so a stored 95 ("tired") fired late in the match; it keeps meaning Tired
 * (energy 90), not energy 95, which now arrives around 5:00. `around` is the
 * median; the change itself waits for the next stoppage. */
export const TIRED_LEVELS=[
 {id:'bit',label:'a bit tired',name:'A bit tired',threshold:97,energy:95,around:'5:00',never:'never got a bit tired'},
 {id:'tired',label:'tired',name:'Tired',threshold:95,energy:90,around:'9:30',never:'never got tired'},
 {id:'empty',label:'running on empty',name:'Running on empty',threshold:92,energy:86,around:'12:00',never:'never ran on empty'},
] as const;
export type TiredLevel=typeof TIRED_LEVELS[number];
/** The level a stored threshold belongs to (the nearest code). */
export const tiredLevel=(threshold:number):TiredLevel=>[...TIRED_LEVELS].sort((a,b)=>Math.abs(a.threshold-threshold)-Math.abs(b.threshold-threshold))[0];
/** The energy the engine checks for a stored threshold: a level code becomes
 * its calibrated energy; any other number (tests, evidence harnesses) already
 * is an energy and passes through unchanged. */
export const engineThreshold=(threshold:number):number=>TIRED_LEVELS.find(l=>l.threshold===threshold)?.energy??threshold;
/** An order as the engine takes it: a tired trigger's code read on today's curve. */
export function engineOrder<T extends {trigger:SubstitutionTrigger}>(o:T):T{
 return o.trigger.kind==='tired'?{...o,trigger:{...o.trigger,threshold:engineThreshold(o.trigger.threshold)}}:o;
}

/** The plain-English choices in prep. */
export type When='tired'|'losing'|'drawing'|'winning'|'up2'|'down2'|'half';
export const WHEN_OPTIONS:{value:When;label:string}[]=[
 {value:'tired',label:'if a player is tired'},
 {value:'losing',label:'if we’re losing'},
 {value:'drawing',label:'if we’re drawing'},
 {value:'winning',label:'if we’re winning'},
 {value:'down2',label:'if we’re 2+ down'},
 {value:'up2',label:'if we’re 2+ up'},
 {value:'half',label:'at half-time (7:30)'},
];
/** "Not before" choices (match seconds). */
export const NOT_BEFORE=[0,120,300,450,600,720] as const;

export function whenOf(t:SubstitutionTrigger):When{
 switch(t.kind){
  case 'tired':return 'tired';
  case 'score':return t.state;
  case 'margin':return t.direction==='up'?'up2':'down2';
  case 'half':return 'half';
 }
}
export function triggerOf(when:When,player:string,threshold:number):SubstitutionTrigger{
 switch(when){
  case 'tired':return {kind:'tired',player,threshold};
  case 'losing':case 'drawing':case 'winning':return {kind:'score',state:when};
  case 'up2':return {kind:'margin',atLeast:2,direction:'up'};
  case 'down2':return {kind:'margin',atLeast:2,direction:'down'};
  case 'half':return {kind:'half'};
 }
}

const clock=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
type Name=(id:string)=>string;
export function triggerPhrase(t:SubstitutionTrigger,name:Name):string{
 switch(t.kind){
  case 'tired':return `if ${name(t.player)} is ${tiredLevel(t.threshold).label}`;
  case 'score':return t.state==='losing'?'if we’re losing':t.state==='winning'?'if we’re winning':'if we’re drawing';
  case 'margin':return `if we’re ${t.atLeast}+ ${t.direction}`;
  case 'half':return 'at half-time';
 }
}
/** "Rex on for Van Pisi if Van Pisi is tired, not before 10:00." */
export function orderPhrase(o:PrepOrder,name:Name):string{
 const out=o.trigger.kind==='tired'?o.trigger.player:o.out;
 return `${name(o.in)} on for ${out?name(out):'the most tired player'} ${triggerPhrase(o.trigger,name)}${o.notBefore?`, not before ${clock(o.notBefore)}`:''}.`;
}

interface SquadPlayer {id:string;roles:string[]}
/** Null when the orders are valid for this five; else the engine's reason. */
export function subsProblem(orders:PrepOrder[],squad:SquadPlayer[],lineup:string[]):string|null{
 if(orders.length>MAX_SUBS)return `At most ${MAX_SUBS} substitutions.`;
 try{validateSubstitutionOrders(orders.map(o=>({...o,side:0})),oneTeam(squad,lineup));return null;}
 catch(e){return e instanceof Error?e.message:'Invalid substitution.';}
}
/** Only what validateSubstitutionOrders reads: squad ids and roles, the lineup. */
export function oneTeam(squad:SquadPlayer[],lineup:string[]):Fixture{
 const team={squad:squad.map(p=>({id:p.id,roles:[...p.roles]})),lineup:[...lineup]};
 return {seed:0,kickoff:0,teams:[team,{squad:[],lineup:[]}]} as unknown as Fixture;
}
/** Orders that still fit the five (a lineup change can invalidate some): the
 * first valid prefix-free subset, keeping each order that validates alone
 * with those before it. */
export function keepValid(orders:PrepOrder[],squad:SquadPlayer[],lineup:string[]):PrepOrder[]{
 const kept:PrepOrder[]=[];
 for(const o of orders)if(!subsProblem([...kept,o],squad,lineup))kept.push(o);
 return kept;
}
let n=0;
export const newOrderId=()=>`s${Date.now().toString(36)}${(n++).toString(36)}`;

// ---------- after the match ----------
/** A stored note: the engine's SubstitutionNote plus the order it came from. */
export interface StoredNote extends SubstitutionNote {trigger?:SubstitutionTrigger;notBefore?:number}
/** English, owner-facing: what happened to an order. */
export function noteLine(n:StoredNote,name:Name):{made:boolean;text:string}{
 const t=n.trigger;
 if(n.status==='made'){
  const why=t?` (${triggerPhrase(t,name).replace(/^if /,'').replace(/^at /,'')})`:'';
  return {made:true,text:`${n.time!==undefined?clock(n.time)+' ':''}${name(n.in)} on for ${n.out?name(n.out):'a team-mate'}${why}.`};
 }
 const who=`${name(n.in)} for ${n.out?name(n.out):'the most tired player'}`;
 if(n.status==='impossible'){
  const d=n.detail;
  const reason=d.includes('deja toate')?'we had already made every change'
   :d.includes('a intrat deja')?`${name(n.in)} was already on`
   :d.includes('a ieșit deja')?`${n.out?name(n.out):'that player'} had already gone off`
   :d.includes('Portarii')||d.includes('același tip')?'keepers only replace keepers'
   :'it couldn’t be made';
  return {made:false,text:`${who} didn’t happen: ${reason}.`};
 }
 let reason:string;
 if(n.detail.includes('nu este pe teren'))reason=`${n.out?name(n.out):'that player'} was never on the pitch`;
 else if(!t)reason='the moment never came';
 else switch(t.kind){
  case 'tired':reason=`${name(t.player)} ${tiredLevel(t.threshold).never}`;break;
  case 'score':reason=t.state==='losing'?'we were never losing':t.state==='winning'?'we were never winning':'we were never level';break;
  case 'margin':reason=`we were never ${t.atLeast}+ ${t.direction}`;break;
  case 'half':reason='play never stopped after half-time';break;
 }
 if(n.notBefore&&t&&t.kind!=='half')reason+=` after ${clock(n.notBefore)}`;
 return {made:false,text:`${who} didn’t happen: ${reason}.`};
}
