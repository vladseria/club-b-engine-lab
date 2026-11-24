// Game plan: a club's saved plans (TECH-SPEC §2; BUILD-PLAN WP0). Row shapes,
// the door calls and the pure helpers every Game plan screen shares. The
// switch is per club (`MyClub.features` includes 'game_plan'); every door
// refuses `feature_off` for a club that is off.
//
// - A plan holds the formation, the eight settings, set
//   pieces and keeper, and up to three COPIES of moves. Plan-level "All game"
//   orders are deferred (owner, 1 Oct): `orders` is always [] and a move keeps
//   its own off-the-ball jobs inside `plan.standing`, as today's ideas do.
// - Prep links a round to a plan (`plan_id`) and keeps what it played
//   (`plan_snapshot`). The engine-facing prep columns are materialised from the
//   plan by the server (private.ballers_plan_write), never by the client.
// - Saving: single fields through `setPlanField` (instant, last write wins);
//   multi-step editors through `savePlan` with the version they started from.
import {supabase} from '../supabase';
import {boardApproach,boardFormation,playedApproach,styleChoices,withOnLoss,type Approach,type StoredApproach} from './approach';
import {PRESETS,STYLES,clock,type Formation,type Prep,type Style} from './league';
import type {PrepOrder} from './subs';

export type PlanOrigin='home'|'default'|'style'|'preset'|'copy'|'manager';
/** Where a move may start. The engine can't tell halves apart yet (TECH-SPEC
 * §5.1), so every move plays as 'any' until the engine round; the value is
 * stored but never sent to the engine. */
export type MoveStart='any'|'own'|'their';
export interface SetPieces {keeper?:'line'|'sweeper';setPiece?:'short'|'delivery'}

/** A move as a plan holds it: a copy (editing it never changes another plan). */
export interface PlanMove {
 id:string;
 /** The engine plan key (markers and names use it); plan.id equals it. */ key:string;
 name:string;
 /** The engine PlaybookPlan (lesson, instructions, standing jobs…). */ plan:Record<string,unknown>&{id:string};
 /** The five it was drawn for (slot n = lineup[n-1]); Prep hands parts over when one isn't playing. */ lineup:string[];
 /** How keen, 0-100 (the prep accent). */ emphasis:number;
 start:MoveStart;
 /** The saved move (idea) it was copied from, and that move's updated_at at the time. */
 from_move?:string;from_updated_at?:string;
}
export interface Plan {
 id:string;club_id:string;space:string;name:string;position:number;
 /** The preset it started from: also the prep's `style` (a preset id, never a name, reaches the replay header). */
 based_on:Style;formation:Formation;
 /** With "On losing it" filled in (a stored plan may lack it: absent = 'balanced'). */
 settings:Approach;
 set_pieces:SetPieces;moves:PlanMove[];orders:[];origin:PlanOrigin;source_style:string|null;
 migrated_at:string|null;version:number;created_at:string;updated_at:string;
 /** What the switch couldn't bring over (Home plan only; null = nothing). Written by the operator
  * switch and the founding hook, never by a door (migration ballers_game_plan_left_behind). */
 left_behind?:LeftBehind|null;
 /** The row's own formation and settings, present only when it stores a retired value that
  * plan() reads as what now plays: a plan's past still matches what it was (plan-bands.ts originalSetup). */
 stored?:{formation:Formation;settings:StoredApproach};
 /** Plan setups (switch `plan_setups`, migration 20261019120000; lib/ballers/setup.ts): the plan's own
  * five by slot, armband, taker and substitutions. Null lineup = no setup yet; read only with the switch on. */
 lineup?:string[]|null;captain?:string|null;taker?:string|null;substitutions?:PrepOrder[];
 setup_source?:string|null;setup_check?:'formation'|null;
}
/** A move the switch couldn't copy into Home plan (it stays in Your moves), and an open round it
 * couldn't put on Home plan (it plays as it was set). `why` is the door's refusal code. */
export interface LeftBehind {
 moves?:{idea:string;key:string;name:string;why:string}[];
 rounds?:{round:string;number:number;why:string}[];
}
/** What a prep played (owner-read, frozen with the prep at the lock). */
export interface PlanSnapshot {
 id:string;name:string;version:number;based_on:Style;formation:Formation;settings:StoredApproach;set_pieces:SetPieces;
 moves:{id:string;key:string;name:string;start:MoveStart;emphasis:number}[];
 /** Set when the prep was carried unlinked: its plan was deleted, the club was switched off, or the carry failed (it plays as it was). */
 detached?:'paused'|'plan_deleted'|'carry_failed';
}
/** A prep row as Game plan screens read it. */
export type PlanPrep=Prep&{plan_id?:string|null;plan_snapshot?:PlanSnapshot|null};

const PLAN_COLUMNS='id,club_id,space,name,position,based_on,formation,settings,set_pieces,moves,orders,origin,source_style,migrated_at,version,created_at,updated_at,left_behind,lineup,captain,taker,substitutions,setup_source,setup_check';
export type StoredPlan=Omit<Plan,'settings'>&{settings:StoredApproach};
/** Every plan row the screens and browser matches see: a retired formation or option reads as what
 * now plays in its place (approach.ts boardFormation/boardApproach), so the board never shows a
 * choice it no longer offers. The row itself is not rewritten. */
export function plan(row:StoredPlan):Plan{
 const formation=boardFormation(row.formation),settings=boardApproach(withOnLoss(row.settings)),same=formation===row.formation&&settings.commit===row.settings.commit&&settings.onLoss===withOnLoss(row.settings).onLoss;
 return {...row,formation,settings,orders:[],...(same?{}:{stored:{formation:row.formation,settings:row.settings}})};
}

function must<T>(r:{data:T|null;error:{message:string}|null}):T{if(r.error)throw new PlanError(r.error.message);return r.data as T;}

// ------------------------------------------------------------------ reads
/** The club's plans in list order (RLS: the owner's only). */
export async function loadPlans(clubId:string):Promise<Plan[]>{
 return (must(await supabase().from('ballers_plans').select(PLAN_COLUMNS).eq('club_id',clubId).order('position').order('created_at')) as StoredPlan[]).map(plan);
}

// ------------------------------------------------------------------ doors
export type NewPlanFrom={preset:Style;formation:Formation}|{copy:string;formation?:Formation;
 /** false = leave the moves behind ("Copy as 2-2" when they can't follow). */ moves?:boolean}|{style:string;formation?:Formation};
export async function createPlan(space:string,name:string,from:NewPlanFrom){
 return plan(must(await supabase().rpc('ballers_plan_create',{p_space:space,p_name:name,p_from:from})) as StoredPlan);
}
/** One field, saved at once (last write wins). A setting key, `keeper`/`setPiece`
 * (null = back to the default), or a move's `moves.<id>.emphasis` / `.start`. */
export type PlanField=keyof Approach|'keeper'|'setPiece'|`moves.${string}.emphasis`|`moves.${string}.start`;
export async function setPlanField(space:string,planId:string,field:PlanField,value:unknown){
 return plan(must(await supabase().rpc('ballers_plan_set',{p_space:space,p_plan:planId,p_field:field,p_value:value===undefined?null:value})) as StoredPlan);
}
/** A multi-step edit, committed whole on Done. `version` is the one the editor
 * started from: a newer one on the server refuses `stale_plan`. A new
 * `formation` keeps the moves as drawn, slot by slot (migration
 * 20261002190000_ballers_plan_formation). */
export async function savePlan(space:string,p:{id:string;formation?:Formation;settings?:Approach;based_on?:Style;set_pieces?:SetPieces;moves?:PlanMove[]},version:number){
 return plan(must(await supabase().rpc('ballers_plan_save',{p_space:space,p_plan:p,p_version:version})) as StoredPlan);
}
/** (styles as identities, slice 1) "Pick this plan's style": for a plan whose settings are no style's base, one of
 * its two choices (approach.ts styleChoices). The door keeps every fine-tune and writes the style's base
 * (migration 20261022120000_ballers_styles_identity, ballers_plan_pick_style). */
export async function pickPlanStyle(space:string,planId:string,style:Style,version:number){
 return plan(must(await supabase().rpc('ballers_plan_pick_style',{p_space:space,p_plan:planId,p_style:style,p_version:version})) as StoredPlan);
}
export async function renamePlan(space:string,planId:string,name:string){
 return plan(must(await supabase().rpc('ballers_plan_rename',{p_space:space,p_plan:planId,p_name:name})) as StoredPlan);
}
export async function reorderPlans(space:string,order:string[]){
 return must(await supabase().rpc('ballers_plan_reorder',{p_space:space,p_order:order})) as boolean;
}
export async function deletePlan(space:string,planId:string){
 return must(await supabase().rpc('ballers_plan_delete',{p_space:space,p_plan:planId})) as boolean;
}
/** Match prep: this plan + this five for the round. `taker`: undefined = keep,
 * 'auto' = let the game pick, a player id = him. `subs` / `moveLineups`:
 * undefined = keep what's stored (re-checked against the five). */
export async function pickPlan(round:string,v:{plan:string;lineup:string[];captain:string;taker?:string|'auto';subs?:PrepOrder[];moveLineups?:Record<string,Record<string,string>>}){
 const row=must(await supabase().rpc('ballers_pick_plan',{p_round:round,p_plan:v.plan,p_lineup:v.lineup,p_captain:v.captain,
  p_taker:v.taker??null,p_substitutions:v.subs??null,p_move_lineups:v.moveLineups??null})) as PlanPrep;
 return {...row,approach:withOnLoss(row.approach)} as PlanPrep;
}

// ------------------------------------------------------------------ refusals in plain words
/** Every refusal the plan doors (and pick) can give, as a player reads it. */
export const PLAN_ERRORS:Record<string,string>={
 feature_off:'Plans aren’t switched on for your club.',
 no_club:'You need a club first.',
 profile_required:'Sign in to change your plans.',
 invalid_plan_name:'A plan name needs 1 to 40 characters.',
 duplicate_plan_name:'You already have a plan with that name.',
 max_12_plans:'You can keep 12 plans. Delete one to make room.',
 max_20_plans:'You can keep 20 plans. Delete one to make room.',
 // plan setups (migration 20261019120000)
 setups_on:'Match prep has changed. Reload the page.',
 no_fill_in:'Nobody can fill that place this round, so this plan can’t be played as it is.',
 no_setup:'This plan has no five yet.',
 unknown_source:'That plan or style isn’t yours any more.',
 unknown_plan:'That plan was deleted.',
 unknown_move:'That move isn’t in this plan any more.',
 invalid_field:'That can’t be changed here.',
 invalid_value:'That isn’t one of the options.',
 invalid_tactics:'That isn’t one of the options.',
 // board trim (migration 20261015200000_ballers_board_trim): a tab opened before it offering a retired choice
 retired_formation:'2-1-1 isn’t offered any more. Reload and pick 1-2-1 or 2-2.',
 retired_option:'That option isn’t offered any more. Reload and pick again.',
 invalid_moves:'One of the moves couldn’t be saved.',
 invalid_set_pieces:'That isn’t one of the options.',
 // styles as identities (migration 20261022120000_ballers_styles_identity)
 invalid_style_base:'How you move the ball and what you do when you win it come with the style now. Pick a style instead.',
 invalid_style:'That style isn’t one of this plan’s two choices any more. Reload and pick again.',
 max_3_moves:'A plan holds 3 moves. Swap one out first.',
 // moves are off (owner, 2 Oct; migration ballers_moves_off)
 moves_off:'Moves are coming soon.',
 too_large:'That move is too big to save.',
 stale_plan:'Changed on another device. Review it and try again.',
 formation_fixed:'The formation couldn’t be changed. Try again.',
 invalid_orders:'That can’t be saved yet.',
 last_plan:'This is your only plan. Make another before deleting it.',
 plan_in_use:'This plan is picked for your next match. Pick another one first.',
 invalid_plans:'Your plans changed. Reload and try again.',
 locked:'The match is locked. Changes count from the next round.',
 unknown_round:'That round isn’t on any more.',
 invalid_lineup:'Pick a keeper and four outfield players from your squad.',
 invalid_captain:'Your captain has to be on the pitch.',
 invalid_match_settings:'Your set-piece taker has to be one of the four outfield starters.',
 invalid_substitutions:'One of your substitutions doesn’t fit this five.',
 invalid_idea_lineups:'Someone in a move isn’t in your five. Pick who takes over.',
 plan_driven:'Match prep has changed. Reload the page.',
 ballers_closed:'Ballers isn’t open in this clubhouse.',
 // the old Prep's "Stop using the plan's moves" (ballers_prep_stop_plan_moves)
 no_plan_moves:'This match isn’t playing a plan’s moves any more.',
 max_3_ideas:'A match plays 3 moves and ideas at most. Stop one first.',
};
export class PlanError extends Error {
 /** The door's refusal code (or the raw message when it isn't one). */ readonly code:string;
 constructor(message:string){super(message);this.code=message;}
 /** What to tell the player. */
 get line(){return PLAN_ERRORS[this.code]??'That didn’t save. Check your connection and try again.';}
}
export const planErrorLine=(e:unknown)=>e instanceof PlanError?e.line:PLAN_ERRORS[(e as Error)?.message]??'That didn’t save. Check your connection and try again.';
/** A pick (Match prep, Compare's Start him instead) refused because the round locked while it was on
 * its way: nothing was saved, and the match plays what was set at the lock (go-live review S3). Any
 * other refusal reads as planErrorLine. */
export function pickErrorLine(e:unknown,locksAt:string|null|undefined){
 const code=e instanceof PlanError?e.code:(e as Error)?.message;
 return code==='locked'&&locksAt?`Locked at ${clock(locksAt)} — this match plays as set.`:planErrorLine(e);
}

// ------------------------------------------------------------------ pure helpers
export const STYLE_SHORT:Record<Style,string>={balanced:'Balanced',combinations:'Short',direct:'Direct',counter:'Counter'};
export const styleLine=(s:Style)=>STYLES[s].line;
const APPROACH_KEYS:readonly (keyof Approach)[]=['progression','width','line','press','commit','striker','transition','onLoss'];
/** The settings that differ from the preset the plan is based on (absent onLoss = 'balanced'),
 * as played: with a `formation` that has no Width choice (2-1-1, approach.ts widthChosen) both
 * sides play Standard, so a stored Narrow or Wide there is no adjustment. */
type Setup={based_on:Style;settings:StoredApproach;formation?:string};
export function adjustedKeys(p:Setup):(keyof Approach)[]{
 const f=p.formation??'',mine=playedApproach(f,withOnLoss(p.settings)),base=playedApproach(f,PRESETS[p.based_on]);
 return APPROACH_KEYS.filter(k=>String(mine[k])!==String(base[k]));
}
export const isAdjusted=(p:Setup)=>adjustedKeys(p).length>0;
/** (styles as identities, slice 1) A plan whose settings are no style's base waits for its manager to pick one of
 * two styles (approach.ts styleChoices); until then it plays exactly as saved. Computed, never stored. */
export const styleChoicesOf=(p:Pick<Setup,'based_on'|'settings'>):Style[]=>styleChoices(p.based_on,p.settings);
export const needsStyle=(p:Pick<Setup,'based_on'|'settings'>)=>styleChoicesOf(p).length>0;
/** "Based on Short · adjusted" — computed, never stored. "Adjusted" is a fine-tune change (the base is the style's);
 * a plan waiting for its style says so instead. */
export const basedOnLine=(p:Setup)=>needsStyle(p)?'Pick this plan’s style':`Based on ${STYLE_SHORT[p.based_on]}${isAdjusted(p)?' · adjusted':''}`;

/** How keen the players are on a move: the stored emphasis, shown honestly
 * (it decides which move wins when two can start, and how firmly the drawn
 * action is favoured). Existing values keep their number; 80 reads "Often". */
export type Keen='sometimes'|'often'|'whenever';
export const KEEN:Record<Keen,{label:string;value:number;line:string}>={
 sometimes:{label:'Sometimes',value:40,line:'If a keener move can start too, that one goes first.'},
 often:{label:'Often',value:80,line:'Usually picked ahead of a less keen move.'},
 whenever:{label:'Whenever it can start',value:100,line:'Their first choice whenever it can start.'},
};
export const keenOf=(emphasis:number):Keen=>emphasis>=95?'whenever':emphasis>=60?'often':'sometimes';
/** A new move's default: Often. */
export const NEW_MOVE_EMPHASIS=KEEN.often.value;
export const MAX_PLANS=12,MAX_MOVES=3;
/** Plans a club can keep: 20 with plan setups on (copies are how a variation is tried), else 12. */
export const MAX_PLANS_SETUPS=20;
export const maxPlans=(setups:boolean)=>setups?MAX_PLANS_SETUPS:MAX_PLANS;

/** The prep's relation to plans, for Prep and Home. */
export type PrepPlanState='linked'|'custom'|'paused'|'plan_deleted';
export function prepPlanState(p:PlanPrep|null|undefined):PrepPlanState{
 if(p?.plan_id)return 'linked';
 const d=p?.plan_snapshot?.detached;
 return d==='paused'?'paused':d==='plan_deleted'?'plan_deleted':'custom';
}
/** The plan a linked prep plays, if it still exists. */
export const planOfPrep=(plans:readonly Plan[],p:PlanPrep|null|undefined)=>p?.plan_id?plans.find(x=>x.id===p.plan_id)??null:null;
/** Plan ids picked for an open prep (they can't be deleted). */
export const plansInUse=(preps:readonly PlanPrep[])=>new Set(preps.map(p=>p.plan_id).filter((x):x is string=>!!x));
/** A fresh copy of a move for a plan: new id, a `move:` key (plan.id follows it). */
export function copyMove(m:Omit<PlanMove,'id'|'key'|'start'>&{key?:string},id:string=crypto.randomUUID()):PlanMove{
 const key=`move:${id}`;
 return {...m,id,key,plan:{...m.plan,id:key},start:'any'};
}
