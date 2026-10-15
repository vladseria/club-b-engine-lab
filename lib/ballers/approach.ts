// A club's style fine-tune as Ballers stores it: the engine's seven approach
// settings plus "On losing it" (`onLoss`). Pure; no I/O. Mirrored by SQL
// private.ballers_valid_approach / ballers_preset (migration
// 20260929222155_ballers_on_losing_it).
//
// Contract (engine bundle B3 wired it in):
// - every stored row, frozen match input or hand-off WITHOUT `onLoss` reads as
//   'balanced' (withOnLoss), and the engine reads a missing `onLoss` as
//   'balanced' too, so an input frozen before the field computes exactly the
//   match an explicit 'balanced' computes;
// - engineApproach() is the ONE place the value reaches engine tactics: every
//   Tactics the app builds goes through it — lib/ballers/compute.ts
//   `engineTeam` (official matches and browser practice),
//   lib/ballers/lab/team.ts `tacticsOf` and `demoSide`.
import type {ApproachSettings} from '../../packages/football-engine/src/team-approach';

export type OnLoss='regroup'|'balanced'|'counterpress';
export const ON_LOSS:readonly OnLoss[]=['regroup','balanced','counterpress'];
/** What a row without the field means: the behaviour every match has had so far. */
export const ON_LOSS_DEFAULT:OnLoss='balanced';

/** The full fine-tune: the engine's seven settings plus "On losing it". */
export type Approach=ApproachSettings&{onLoss:OnLoss};
/** As read from storage: rows and frozen inputs from before the field may lack it. */
export type StoredApproach=ApproachSettings&{onLoss?:OnLoss};

export const isOnLoss=(v:unknown):v is OnLoss=>typeof v==='string'&&(ON_LOSS as readonly string[]).includes(v);
/** The stored value, or 'balanced' when absent (or not one we know). */
export const onLossOf=(a:{onLoss?:unknown}|null|undefined):OnLoss=>isOnLoss(a?.onLoss)?a!.onLoss as OnLoss:ON_LOSS_DEFAULT;

/** A stored approach with "On losing it" filled in (absent = 'balanced'). */
export function withOnLoss(a:StoredApproach):Approach{return {...a,onLoss:onLossOf(a)};}

/** Whether Width is a choice in this formation. 2-1-1 has no wingers, and
 * there the three options played the same football (width check, 234 matches,
 * packages/football-engine/evidence/2026-10-11-width-check on branch
 * width-check): the screens don't offer it and the side plays Standard. */
export const widthChosen=(formation:string)=>formation!=='2-1-1';
/** The approach a formation plays: in 2-1-1 Width is Standard whatever is
 * stored. The stored value is kept (switch back to a shape with wingers and
 * the plan's Width returns); this is what reaches the engine (compute.ts
 * engineTeam, lab/team.ts tacticsOf, the Lab's trial side), the board and
 * every "adjusted" check, so the screens say what is played. */
export function playedApproach<A extends {width:ApproachSettings['width']}>(formation:string,a:A):A{
 return widthChosen(formation)||a.width==='standard'?a:{...a,width:'standard'};
}

/** The approach as the engine takes it: every key kept exactly as stored
 * (same keys, same order). A stored `onLoss` reaches the engine (an unknown
 * value reads as 'balanced'); an input from before the field is passed
 * through unchanged, and the engine reads its missing `onLoss` as
 * 'balanced'. */
export function engineApproach(a:StoredApproach):ApproachSettings{
 return a.onLoss===undefined?{...a}:{...a,onLoss:onLossOf(a)};
}
