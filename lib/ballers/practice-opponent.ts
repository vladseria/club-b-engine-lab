// The opponent in a practice match (owner, 24 Oct 2026; a player: "how can I run practice against your team with
// something other than the team you played last match?").
//  - By default they play their last game's whole setup, as ballers_practice_side reads it from that match's frozen
//    input: the five, formation, style, settings, and (since migration 20261024150000_ballers_practice_side_full)
//    its substitution orders, its change of plan and its match settings, every order as it was set, even one whose
//    moment never came in that match. Never their moves. An answer without those keys (the function before that
//    migration, an AI club with no match yet, a member club that never played) is played exactly as before.
//  - The practising player may pick their five instead ("five only": formation, style, settings and the change of
//    plan stay as in their last game). Whoever stays keeps his slot; anyone new takes a free slot by the plan
//    setups' fill-in rule (private.ballers_fill_in: the slot's position listed first, then shirt number). An order
//    that no longer fits the five is left out, by the rule the server uses for a plan's orders
//    (private.ballers_fit_subs / ballers_check_subs, without stand-ins); a set-piece taker who isn't on the pitch
//    falls back to Auto and a captain who isn't to slot 2, as in any match (frozenSide / normalizeSettings).
//    The change of plan names no players (a slot map), so it fits any five.
//  - "Likely five": the keeper and the four outfielders with the most minutes this season (league results past full
//    time only), a starting point to test, never a prediction.
import type {FrozenSide} from './compute';
import type {PracticeSide} from './data';
import {frozenSide} from './lab/team';
import {isKeeper, type Club, type Formation, type Player} from './league';
import {subsProblem, type PrepOrder} from './subs';

type Who=Pick<Player,'id'|'roles'|'number'>;
const byId=(a:string,b:string)=>a<b?-1:a>b?1:0;

/** The role a slot gives (0 = keeper): private.ballers_slot_role, slots counted from 0. */
export function slotRole(formation:Formation,slot:number):string{
 if(slot===0)return 'GK';
 const roles=formation==='2-2'?['CB','CB','W','W']:formation==='2-1-1'?['CB','CB','CM','ST']:['CB','W','W','ST'];
 return roles[slot-1];
}
/** Who of `pool` takes a slot with this role: private.ballers_fill_in's order (keepers for the keeper only; the role
 * listed first, then anywhere, then not at all; then shirt number). */
function fillIn<P extends Who>(pool:readonly P[],role:string):P|undefined{
 const rank=(p:P)=>{const i=(p.roles as readonly string[]).indexOf(role);return i<0?99:i;};
 return pool.filter(p=>p.roles.includes('GK')===(role==='GK')).sort((a,b)=>rank(a)-rank(b)||a.number-b.number||byId(a.id,b.id))[0];
}
/** `current` with `chosen` as the five: who is in both keeps his slot; the rest of `chosen` fill the slots left, in
 * slot order, by the fill-in rule. `current` itself when `chosen` isn't a keeper and four outfielders of the squad. */
export function placeFive<P extends Who>(current:readonly string[],chosen:readonly string[],squad:readonly P[],formation:Formation):string[]{
 const people=chosen.map(id=>squad.find(p=>p.id===id));
 if(people.length!==5||new Set(chosen).size!==5||people.some(p=>!p)||people.filter(p=>isKeeper(p!)).length!==1)return [...current];
 const out:(string|null)[]=current.map(id=>chosen.includes(id)?id:null);
 const pool=people.filter(p=>!current.includes(p!.id)) as P[];
 for(let i=0;i<5;i++){
  if(out[i])continue;
  const p=fillIn(pool,slotRole(formation,i));if(!p)return [...current];
  out[i]=p.id;pool.splice(pool.indexOf(p),1);
 }
 return out as string[];
}

/** Most minutes first (seconds this season), then shirt number. */
export function byMinutes<P extends Who>(squad:readonly P[],seconds:(id:string)=>number):P[]{
 return [...squad].sort((a,b)=>seconds(b.id)-seconds(a.id)||a.number-b.number||byId(a.id,b.id));
}
/** The keeper with the most minutes and the four outfielders with the most, keeper first (unplaced: see placeFive).
 * Null when nobody has played yet, or the squad hasn't a keeper and four outfielders. */
export function likelyFive<P extends Who>(squad:readonly P[],seconds:(id:string)=>number):string[]|null{
 if(!squad.some(p=>seconds(p.id)>0))return null;
 const all=byMinutes(squad,seconds),gk=all.find(p=>isKeeper(p)),out=all.filter(p=>!isKeeper(p)).slice(0,4);
 return gk&&out.length===4?[gk.id,...out.map(p=>p.id)]:null;
}

/** Same players, wherever they stand. */
export const sameMen=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every(id=>b.includes(id));
/** Same players in the same slots. */
export const sameFive=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every((id,i)=>b[i]===id);

/** An order the five can't play, with the server's reason code (lib/ballers/setup.ts unfitText words it). */
export interface Unfit {id:string;why:string}
const offOf=(o:PrepOrder)=>o.trigger.kind==='tired'?o.trigger.player:o.out;
/** The orders that fit this five, taken in order, each kept when it fits with those kept before it; the rest with
 * why (private.ballers_fit_subs over private.ballers_check_subs, the same codes; there are no stand-ins here). */
export function fitOrders(orders:readonly PrepOrder[],lineup:readonly string[],squad:readonly Pick<Player,'id'|'roles'>[]):{fit:PrepOrder[];unfit:Unfit[]}{
 const fit:PrepOrder[]=[],unfit:Unfit[]=[];
 const inSquad=(id:string)=>squad.some(p=>p.id===id);
 for(const o of orders){
  const set=[...fit,o],ins=set.map(x=>x.in),off=offOf(o),comes=squad.find(p=>p.id===o.in);
  const why=!comes?'in_not_in_squad'
   :lineup.includes(o.in)?'in_starts'
   :fit.some(x=>x.in===o.in)?'in_twice'
   :o.trigger.kind==='tired'&&!inSquad(o.trigger.player)?'tired_player'
   :off&&!inSquad(off)?'out_not_in_squad'
   :off&&lineup.indexOf(off)>=0&&(lineup.indexOf(off)===0)!==(comes.roles[0]==='GK')?'keeper'
   // a named man going off must be able to be on the pitch: in the five, or brought on by an order kept
   :set.some(x=>{const f=offOf(x);return !!f&&!lineup.includes(f)&&!ins.includes(f);})?'out_never_on'
   // and the engine's own check, last (what it refuses would cost the side every order)
   :subsProblem(set,[...squad],[...lineup])?'invalid':null;
  if(why)unfit.push({id:o.id,why});else fit.push(o);
 }
 return {fit,unfit};
}

/** Their side as practice plays it, and the orders left out (only ever when `five` is the player's pick).
 * `five`: the practising player's pick of their five; null, or their own five, is their last game's. */
export function theirSide(club:Pick<Club,'id'|'name'|'code'|'color'>,squad:Player[],side:PracticeSide,five?:readonly string[]|null):{side:FrozenSide;unfit:Unfit[]}{
 const picked=!!five&&!sameFive(five,side.lineup),lineup=picked?[...five!]:side.lineup;
 const orders=side.substitutions??[];
 const {fit,unfit}=picked?fitOrders(orders,lineup,squad):{fit:orders,unfit:[]};
 const base=frozenSide(club,squad,{lineup,formation:side.formation,style:side.style,approach:side.approach,captain:side.captain,...(side.settings?{settings:side.settings}:{})});
 return {side:{...base,...(fit.length?{substitutions:fit}:{}),...(side.switch?{switch:side.switch}:{})},unfit};
}

/** What the picks call their five, for the kept runs: '' for their own. */
export const fiveTag=(five:readonly string[]|null|undefined)=>five?.length?five.join('.'):'';

// ------------------------------------------------------------------ which five (review pass, 24 Oct)
/** The five a practice match plays against them: their own (their last game's, or as they're set up), the likely
 * five (most minutes), or the player's pick. All three can be kept at once, so the player can flip between them
 * and compare runs; the pick stays when another five plays. */
export type FiveKind='own'|'likely'|'pick';
/** One opponent's choice in this tab: the pick (null: none made), which five plays, and the last game the pick was
 * placed in (fiveBasis; absent on a pick kept before it was recorded). */
export interface TheirChoice {pick:string[]|null;on:FiveKind;basis?:string}
/** Their last game as a pick is placed in it: its formation and five. A new round revealed changes it. */
export const fiveBasis=(own:readonly string[],formation:Formation)=>`${formation}|${own.join('.')}`;

/** A keeper first and four outfielders, all of this squad, nobody twice. */
export function isFive<P extends Pick<Player,'id'|'roles'>>(five:readonly string[],squad:readonly P[]):boolean{
 const men=five.map(id=>squad.find(p=>p.id===id));
 return five.length===5&&new Set(five).size===5&&men.every(p=>!!p)&&isKeeper(men[0]!)&&men.slice(1).every(p=>!isKeeper(p!));
}
/** The fives on offer besides their own, each placed in their formation: the likely five when it isn't their own
 * men, and the pick when it is a five of theirs that is neither their own nor the likely one. A pick placed in an
 * earlier last game of theirs (`basis` isn't this one's: a round revealed since) keeps its players, re-placed in this
 * game's formation by placeFive; one that is no five of theirs any more (a man gone, no keeper) is left out. */
export function theirFives<P extends Who>(own:readonly string[],formation:Formation,squad:readonly P[],likely:readonly string[]|null,pick:readonly string[]|null,basis?:string):{likely:string[]|null;pick:string[]|null}{
 const placed=likely&&!sameMen(likely,own)?placeFive(own,likely,squad,formation):null;
 const lk=placed&&!sameFive(placed,own)?placed:null;
 const moved=!!pick&&!!basis&&basis!==fiveBasis(own,formation);
 const mine=pick&&isFive(pick,squad)?moved?placeFive(own,pick,squad,formation):[...pick]:null;
 const pk=mine&&!sameFive(mine,own)&&!(lk&&sameFive(mine,lk))?mine:null;
 return {likely:lk,pick:pk};
}
/** What plays: the choice, or their own when the five it names isn't on offer (any more). */
export function playingFive(choice:TheirChoice|null|undefined,fives:{likely:string[]|null;pick:string[]|null}):{kind:FiveKind;five:string[]|null}{
 if(choice?.on==='likely'&&fives.likely)return {kind:'likely',five:fives.likely};
 if(choice?.on==='pick'&&fives.pick)return {kind:'pick',five:fives.pick};
 return {kind:'own',five:null};
}
/** The choice after a player is swapped in the five on screen (`was`: the choice it was edited from; `basis`: their
 * last game now): the edit is the pick, unless it is their own five or the likely one again; the pick is kept when it
 * wasn't the five edited. */
export function afterSwap(next:readonly string[],own:readonly string[],likely:readonly string[]|null,was:TheirChoice,basis:string):TheirChoice{
 const kept:Pick<TheirChoice,'pick'|'basis'>=was.on==='pick'||!was.pick?{pick:null}:{pick:was.pick,...(was.basis?{basis:was.basis}:{})};
 if(sameFive(next,own))return {...kept,on:'own'};
 if(likely&&sameFive(next,likely))return {...kept,on:'likely'};
 return {pick:[...next],on:'pick',basis};
}
/** Who comes in for whom against their own five, in slot order (a newcomer takes the slot of the man he replaces). */
export function changesFrom(own:readonly string[],five:readonly string[]):{in:string;out:string}[]{
 const ins=five.filter(id=>!own.includes(id)),outs=own.filter(id=>!five.includes(id));
 return ins.map((id,i)=>({in:id,out:outs[i]}));
}
