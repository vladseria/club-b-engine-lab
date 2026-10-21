// The in-match plan switch ("Change of plan", deliverables/ballers-plan-switch/DESIGN.md): the doors and the
// player-facing words. Pure apart from the two door calls. One switch a match, set in Match prep: a condition
// (winning / level / losing, or 2+ up / down) from an earliest minute, then another of the club's plans. The plan
// changes, the players stay (substitutions included); in another formation every man takes a slot of the new shape,
// worked out by SQL (private.ballers_switch_slots) and frozen with the prep at the lock.
import {supabase} from '../supabase';
import {FORMATIONS, ROLE_NAMES, type Formation} from './league';
import {NOT_BEFORE} from './subs';
import {PlanError} from './plans';
import type {ReplayEvent, ReplayFrame} from './replay';
import {matchChances} from './chances';
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
   ...(other?{formation:sw.to.formation}:{}),...(sw.to.slots?.length===5?{slots:[...sw.to.slots]}:{})}};
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

/** Who plays where after the switch: the men whose place changes, in lineup order. `slots[i]` is the new slot (0-based)
 * of lineup slot i. The slot rule applies in every switch (owner, 21 Oct), so a same-shape switch can move men too (the
 * wingers swapping sides). A man only given a side (a lone centre-back becoming the left one) is not called a move. */
export interface Move {id:string;from:string;to:string;verb:'drops'|'moves up'|'moves'|'crosses'}
const DEPTH=(label:string)=>/back/i.test(label)?1:/Striker/.test(label)?3:/Goalkeeper/.test(label)?0:2;
const base=(label:string)=>label.replace(/^(Left|Right) /,'').toLowerCase();
const sideOfLabel=(label:string)=>/^Left /.test(label)?'left':/^Right /.test(label)?'right':null;
function move(id:string,a:string,b:string):Move|null{
 if(a===b)return null;
 if(base(a)===base(b)){
  // the same role on the other side ("moves to the left"); a lone man only given a side is no move
  return sideOfLabel(a)&&sideOfLabel(b)?{id,from:a,to:b,verb:'crosses'}:null;
 }
 const d=DEPTH(b)-DEPTH(a);return {id,from:a,to:b,verb:d<0?'drops':d>0?'moves up':'moves'};
}
export function movesOf(lineup:readonly string[],slots:readonly number[]|undefined,from:Formation,to:Formation):Move[]{
 if(!slots)return [];
 const out:Move[]=[];
 for(let i=1;i<5;i++){if(!lineup[i])continue;const m=move(lineup[i],FORMATIONS[from].slots[i],FORMATIONS[to].slots[slots[i]]);if(m)out.push(m);}
 return out;
}
/** A role on the pitch as the screens name it: "Left winger", "Centre-back", "Striker" (lane -1 left, 1 right). */
export function roleLabel(role:string,lane:number|undefined):string{
 const name=(ROLE_NAMES as Record<string,string>)[role]??role;
 if(role==='GK'||!lane)return name;
 return `${lane<0?'Left':'Right'} ${name.toLowerCase()}`;
}
const said=(m:Move,name:string,tense:'now'|'past')=>m.verb==='crosses'?`${name} ${tense==='now'?'moves':'moved'} to the ${sideOfLabel(m.to)}`
 :`${name} ${tense==='now'?m.verb:m.verb==='drops'?'dropped':m.verb==='moves up'?'moved up':'moved'} to ${m.to.toLowerCase()}`;
/** "In 2-2: Sifon drops to right centre-back, Pervaz moves to the left." (present tense, before the match) */
export function movesLine(moves:readonly Move[],to:Formation,name:(id:string)=>string,tense:'now'|'past'='now'):string{
 if(!moves.length)return `In ${to} everyone keeps his place.`;
 return `In ${to}: ${moves.map(m=>said(m,name(m.id),tense)).join(', ')}.`;
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
/** Where the switch moved the side's men, from the event itself (`sw.ro`: replay index, new role and lane for every man
 * on the pitch then, whoever he is: a substitute who came on before it included). His place before is his position's
 * in the formation the side played (the frame at the switch maps positions to men). Only real moves. */
export function switchMoves(e:ReplayEvent,side:0|1,frames:readonly ReplayFrame[],formation:Formation):(Move&{i:number})[]{
 if(!e.sw?.ro?.length)return [];
 let at:ReplayFrame|undefined;for(const f of frames){if(f.t>e.t)break;at=f;}
 const out:(Move&{i:number})[]=[];
 for(const [i,role,lane] of e.sw.ro){
  const pos=at?.l?at.l.indexOf(i):i,slot=pos-side*5;
  if(slot<1||slot>4)continue;
  const m=move(String(i),FORMATIONS[formation].slots[slot],roleLabel(role,lane));if(m)out.push({...m,i});
 }
 return out;
}
/** The owner's one line about his switch, from his frozen prep row and the replay. Null when there was none. `made`
 * lines carry their time (show from that minute); the others show from full time. `reached`: the match's own notes
 * say the engine had the switch (practice has them; an official match keeps none), so a reason may be given;
 * otherwise a switch that didn't fire just "didn't happen": it may never have reached the engine (the club's switch
 * turned off before the freeze, left out beside moves, no slot map), and no reason is guessed. */
export function switchNote(sw:PrepSwitch|undefined,side:0|1,events:readonly ReplayEvent[],frames:readonly ReplayFrame[],players:readonly {i:number;short:string}[],formation:Formation,end:number,reached=false):{made:boolean;t:number|null;text:string}|null{
 if(!sw)return null;
 const plan=sw.to?.name??'The other plan';
 const e=events.find(x=>x.k==='switch'&&x.s===side);
 if(e){
  const why=whenWords(sw.trigger).replace(/^if we’re /,'we were ').replace('we were level','it was level');
  const to=(e.sw?.f??formation) as Formation,moves=switchMoves(e,side,frames,formation);
  const where=e.sw?.f||moves.length?` ${movesLine(moves,to,id=>players.find(p=>p.i===+id)?.short??'a player','past').replace('keeps his place','kept his place')}`:'';
  return {made:true,t:e.t,text:`${clock(e.t/1000)} Switched to ${plan} (${why}).${where}`};
 }
 if(sw.fits===false)return {made:false,t:null,text:`${plan} didn’t happen: ${sw.why==='same_plan'?'the match already played it':'that plan was deleted'}.`};
 if(!reached)return {made:false,t:null,text:`${plan} didn’t happen.`};
 const goals=events.filter(x=>x.k==='goal'&&x.s!==undefined).map(x=>({t:x.t,s:x.s as 0|1}));
 const never=whenWords(sw.trigger).replace(/^if we’re /,'we were never ').replace('we were never level','it was never level');
 const reason=heldAfter(sw.trigger,sw.notBefore??0,side,goals,end)?`play didn’t stop in time while ${never.replace(/never /,'')}`:never;
 return {made:false,t:null,text:`${plan} didn’t happen: ${reason}${sw.notBefore?` after ${clock(sw.notBefore)}`:''}.`};
}

// ------------------------------------------------------------------ plan feedback in a switched match
/** A match where this side changed plan reads, for the plan it started with, only what came before the change: its
 * frames and events up to the switch (nothing after it is credited to either plan yet; a two-plan report is the
 * owner's call). `cut` is the switch's time (ms), or null when the side never switched. */
export function beforeSwitch<F extends {t:number},E extends {t:number;k:string;s?:0|1}>(frames:readonly F[],events:readonly E[],side:0|1):{frames:readonly F[];events:readonly E[];cut:number|null}{
 const cut=events.find(e=>e.k==='switch'&&e.s===side)?.t??null;
 return cut===null?{frames,events,cut}:{frames:frames.filter(f=>f.t<cut),events:events.filter(e=>e.t<cut),cut};
}

// ------------------------------------------------------------------ how the change played (one at-a-glance block)
/** One part of a switched match, before or after the change, for the side that changed. */
export interface SwingPart {from:number;to:number;minutes:number;goals:[number,number];shots:[number,number];
 /** Good chances made and conceded (lib/ballers/chances.ts); null when this build has no chances table. */ chances:[number,number]|null;
 /** Share of the part's time with the ball, %; null when nobody had it. */ possession:number|null}
export interface Swing {t:number;score:[number,number];before:SwingPart;after:SwingPart}
/** The match cut at the side's switch (the `switch` event in the replay; no storage): each part's goals, shots, good
 * chances and possession, ours first. Null when the side never switched. `end` is full time (ms). */
export function switchSwing(frames:readonly Pick<ReplayFrame,'t'|'ps'>[],events:readonly ReplayEvent[],players:readonly {i:number;side:0|1}[],side:0|1,end:number,build:string|null|undefined):Swing|null{
 const cut=events.find(e=>e.k==='switch'&&e.s===side)?.t;
 if(cut===undefined)return null;
 const them=(side===0?1:0) as 0|1;
 const part=(from:number,to:number):SwingPart=>{
  const evs=events.filter(e=>e.t>=from&&e.t<to);
  const count=(k:string):[number,number]=>[evs.filter(e=>e.k===k&&e.s===side).length,evs.filter(e=>e.k===k&&e.s===them).length];
  const c=matchChances(evs,{players:players as never},build);
  const own=[0,0];
  for(let i=1;i<frames.length;i++){const a=frames[i-1],lo=Math.max(a.t,from),hi=Math.min(frames[i].t,to);if(hi>lo&&(a.ps===0||a.ps===1))own[a.ps]+=hi-lo;}
  const total=own[0]+own[1];
  return {from,to,minutes:(to-from)/60000,goals:count('goal'),shots:count('shot'),chances:c?[c[side],c[them]]:null,possession:total?Math.round(own[side]/total*100):null};
 };
 const before=part(0,cut),after=part(cut,Math.max(end,cut));
 return {t:cut,score:before.goals,before,after};
}
/** "0–2 down" / "level at 1–1" / "2–1 up", ours first. */
export const scoreWords=(s:[number,number])=>s[0]===s[1]?`level at ${s[0]}–${s[1]}`:`${s[0]}–${s[1]} ${s[0]>s[1]?'up':'down'}`;
/** A count per 10 minutes of the part, one decimal ("1.8"). */
export const per10=(n:number,minutes:number)=>minutes>0?(Math.round(n/minutes*100)/10).toFixed(1):'0.0';
