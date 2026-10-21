// The in-match plan switch ("Change of plan", deliverables/ballers-plan-switch/DESIGN.md): the doors and the
// player-facing words. Pure apart from the two door calls. One switch a match, set in Match prep: a condition
// (winning / level / losing, or 2+ up / down) from an earliest minute, then another of the club's plans. The plan
// changes, the players stay (substitutions included); in another formation every man takes a slot of the new shape,
// worked out by SQL (private.ballers_switch_slots) and frozen with the prep at the lock.
import {supabase} from '../supabase';
import {FORMATIONS, type Formation} from './league';
import {NOT_BEFORE} from './subs';
import {PlanError} from './plans';
import type {ReplayEvent} from './replay';
import type {FrozenSwitch} from './switch-input';
import {boardApproach} from './approach';

export type SwitchTrigger={kind:'score';state:'losing'|'drawing'|'winning'}|{kind:'margin';atLeast:number;direction:'up'|'down'};
/** The prep's stored entry (ballers_prep.switch_orders[0]); fits / why / to are written by the database. */
export interface PrepSwitch {id:string;to_plan:string;trigger:SwitchTrigger;notBefore?:number;fits?:boolean;why?:'same_plan'|'plan_deleted';
 to?:{name:string;version:number;based_on:string;formation:Formation;settings:Record<string,unknown>;set_pieces:Record<string,unknown>;slots?:number[]}}
export interface SwitchTarget {id:string;name:string;based_on:string;formation:Formation;fits:boolean;why?:'same_plan';slots?:number[]}
/** public.ballers_switch_targets: the round's switch and every plan it may go to. Null when off. */
export interface SwitchTargets {round:string;plan:string|null;formation:Formation;locked:boolean;switch:PrepSwitch[];targets:SwitchTarget[]}
export interface SwitchChoice {to_plan:string;trigger:SwitchTrigger;notBefore?:number}

export const switchOn=(features:readonly string[]|undefined)=>!!features?.includes('plan_switch')&&!!features?.includes('plan_setups')&&!!features?.includes('game_plan');

export const SWITCH_ERRORS:Record<string,string>={
 feature_off:'Change of plan isn’t open for your club yet.',
 locked:'This match is locked. A change of plan counts from the next round.',
 same_plan:'That’s the plan this match already plays.',
 unknown_plan:'That plan is gone. Pick another one.',
 invalid_trigger:'That moment isn’t one the match can use.',
 invalid_minute:'Pick a minute from the list.',
 no_prep:'Pick a plan for the match first.',
 plan_in_switch:'This match’s change of plan goes to this plan. Change that first.',
};
export class SwitchError extends PlanError {}
function must<T>(r:{data:T|null;error:{message:string}|null}):T{if(r.error)throw new SwitchError(r.error.message);return r.data as T;}
export async function loadSwitch(round:string):Promise<SwitchTargets|null>{
 return must(await supabase().rpc('ballers_switch_targets',{p_round:round})) as SwitchTargets|null;
}
/** Set (or with null, clear) the round's switch; returns the stored entry list. */
export async function setSwitch(round:string,choice:SwitchChoice|null):Promise<PrepSwitch[]>{
 return must(await supabase().rpc('ballers_set_switch',{p_round:round,p_switch:choice})) as PrepSwitch[];
}
export const switchErrorLine=(e:unknown)=>SWITCH_ERRORS[(e as Error)?.message]??'That didn’t save. Try again.';

/** The switch as the match input carries it (SQL private.ballers_input_side's `switch` key, mirrored for practice):
 * only when it can happen; the target's style, approach (board-trimmed) and keeper / free-kick calls (never its
 * taker), and for another formation that formation and the frozen slot map. */
export function frozenSwitch(sw:PrepSwitch|null|undefined,formation:Formation):FrozenSwitch|undefined{
 if(!sw?.to||sw.fits!==true)return undefined;
 const other=sw.to.formation!==formation;
 if(other&&sw.to.slots?.length!==5)return undefined;
 const {taker:_t,...calls}=(sw.to.set_pieces??{}) as Record<string,unknown>;void _t;
 return {id:sw.id,trigger:sw.trigger,...(sw.notBefore!==undefined?{notBefore:sw.notBefore}:{}),
  to:{plan:sw.to_plan,style:sw.to.based_on,approach:boardApproach(sw.to.settings as never),settings:calls as FrozenSwitch['to']['settings'],
   ...(other?{formation:sw.to.formation,slots:[...sw.to.slots!]}:{})}};
}

// ------------------------------------------------------------------ the words
export type SwitchWhen='losing'|'drawing'|'winning'|'down2'|'up2';
export const SWITCH_WHENS:{when:SwitchWhen;label:string}[]=[
 {when:'losing',label:'If we’re losing'},{when:'drawing',label:'If we’re level'},{when:'winning',label:'If we’re winning'},
 {when:'down2',label:'If we’re 2+ down'},{when:'up2',label:'If we’re 2+ up'},
];
/** "From" choices: the substitutions' earliest-minute steps (match seconds), so the two sentences share one vocabulary. */
export const SWITCH_FROM=NOT_BEFORE;
export const whenOfSwitch=(t:SwitchTrigger):SwitchWhen=>t.kind==='score'?t.state:t.direction==='down'?'down2':'up2';
export const triggerOfSwitch=(w:SwitchWhen):SwitchTrigger=>w==='down2'?{kind:'margin',atLeast:2,direction:'down'}:w==='up2'?{kind:'margin',atLeast:2,direction:'up'}
 :{kind:'score',state:w};
const clock=(v:number)=>`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`;
/** "if we’re losing" (the condition inside a sentence). */
export function whenWords(t:SwitchTrigger):string{
 if(t.kind==='margin')return `if we’re ${t.atLeast}+ ${t.direction}`;
 return t.state==='losing'?'if we’re losing':t.state==='winning'?'if we’re winning':'if we’re level';
}
/** "from 5:00" / "from kick-off". */
export const fromWords=(nb:number|undefined)=>nb?`from ${clock(nb)}`:'from kick-off';
/** The folded row's meaning line (the line above it already says when): what it costs. */
export const SWITCH_MEANING='Same players and substitutions, once, at the next stoppage.';

/** Who plays where after a formation change: the men whose role changes, in lineup order. `slots[i]` is the new slot
 * (0-based) of lineup slot i. */
export interface Move {id:string;from:string;to:string;verb:'drops'|'moves up'|'moves'}
const DEPTH=(label:string)=>/back/i.test(label)?1:/Striker/.test(label)?3:/Goalkeeper/.test(label)?0:2;
export function movesOf(lineup:readonly string[],slots:readonly number[]|undefined,from:Formation,to:Formation):Move[]{
 if(!slots||from===to)return [];
 const out:Move[]=[];
 for(let i=1;i<5;i++){
  const a=FORMATIONS[from].slots[i],b=FORMATIONS[to].slots[slots[i]];
  // the same role, only given a side (a lone centre-back becoming the left one) is no move worth a word
  if(a===b||!lineup[i]||b.replace(/^(Left|Right) /,'').toLowerCase()===a.toLowerCase())continue;
  const d=DEPTH(b)-DEPTH(a);out.push({id:lineup[i],from:a,to:b,verb:d<0?'drops':d>0?'moves up':'moves'});
 }
 return out;
}
const lower=(s:string)=>s.toLowerCase();
/** "In 2-2: Sifon drops to left centre-back, Pervaz moves to left winger." (present tense, before the match) */
export function movesLine(moves:Move[],to:Formation,name:(id:string)=>string,tense:'now'|'past'='now'):string{
 if(!moves.length)return `In ${to} everyone keeps his role.`;
 const verb=(m:Move)=>tense==='now'?m.verb:m.verb==='drops'?'dropped':m.verb==='moves up'?'moved up':'moved';
 return `In ${to}: ${moves.map(m=>`${name(m.id)} ${verb(m)} to ${lower(m.to)}`).join(', ')}.`;
}
/** Why a stored switch won't happen this round (present tense; Match prep). */
export function switchWont(sw:PrepSwitch,day:string):string|null{
 if(sw.fits!==false)return null;
 if(sw.why==='same_plan')return `Won’t happen: ${day||'this match'} already plays ${sw.to?.name??'that plan'}.`;
 return 'Won’t happen: that plan was deleted.';
}

// ------------------------------------------------------------------ after the match (owner only, Watch › Your match)
/** Did the trigger ever hold after its minute, by the goals in the replay? */
function heldAfter(t:SwitchTrigger,nb:number,side:0|1,goals:{t:number;s:0|1}[],end:number):boolean{
 const score:[number,number]=[0,0];
 const holds=()=>{const d=score[side]-score[1-side];return t.kind==='margin'?(t.direction==='up'?d:-d)>=t.atLeast:t.state==='losing'?d<0:t.state==='winning'?d>0:d===0;};
 let at=0;
 for(const g of [...goals].sort((a,b)=>a.t-b.t)){if(holds()&&g.t>nb*1000)return true;score[g.s]++;at=g.t;}
 return holds()&&Math.max(at,nb*1000)<end;
}
/** The owner's one line about his switch, from his frozen prep row and the replay's events. Null when there was none.
 * `made` lines carry their time (show from that minute); the others show from full time. */
export function switchNote(sw:PrepSwitch|undefined,side:0|1,events:readonly ReplayEvent[],lineup:readonly string[],formation:Formation,end:number,name:(id:string)=>string):{made:boolean;t:number|null;text:string}|null{
 if(!sw)return null;
 const plan=sw.to?.name??'The other plan';
 const e=events.find(x=>x.k==='switch'&&x.s===side);
 if(e){
  const why=whenWords(sw.trigger).replace(/^if we’re /,'we were ').replace('we were level','it was level');
  const to=sw.to?.formation;
  const moves=to&&to!==formation?movesOf(lineup,sw.to?.slots,formation,to):[];
  return {made:true,t:e.t,text:`${clock(e.t/1000)} Switched to ${plan} (${why}).${to&&to!==formation?` ${movesLine(moves,to,name,'past')}`:''}`};
 }
 if(sw.fits===false)return {made:false,t:null,text:`${plan} didn’t happen: ${sw.why==='same_plan'?'the match already played it':'that plan was deleted'}.`};
 const goals=events.filter(x=>x.k==='goal'&&x.s!==undefined).map(x=>({t:x.t,s:x.s as 0|1}));
 const never=whenWords(sw.trigger).replace(/^if we’re /,'we were never ').replace('we were never level','it was never level');
 const reason=heldAfter(sw.trigger,sw.notBefore??0,side,goals,end)?`play didn’t stop in time while ${never.replace(/never /,'')}`:never;
 return {made:false,t:null,text:`${plan} didn’t happen: ${reason}${sw.notBefore?` after ${clock(sw.notBefore)}`:''}.`};
}
