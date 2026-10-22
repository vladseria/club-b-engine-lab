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
/** Every value a stored row or frozen input may hold, and the engine plays. The board
 * offers only Balanced and Counter-press (Regroup retired, boardApproach below), but
 * a stored 'regroup' must still reach the engine as 'regroup' (onLossOf). */
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
 * width-check): the screens don't offer it and the side plays Standard.
 * 2-1-1 itself is retired from the board (boardFormation below); this still
 * decides how a frozen 2-1-1 input plays, so it must not change. */
export const widthChosen=(formation:string)=>formation!=='2-1-1';
/** The approach a formation plays: in 2-1-1 Width is Standard whatever is
 * stored. The stored value is kept (switch back to a shape with wingers and
 * the plan's Width returns); this is what reaches the engine (compute.ts
 * engineTeam, lab/team.ts tacticsOf, the Lab's trial side), the board and
 * every "adjusted" check, so the screens say what is played. */
export function playedApproach<A extends {width:ApproachSettings['width']}>(formation:string,a:A):A{
 return widthChosen(formation)||a.width==='standard'?a:{...a,width:'standard'};
}

/** Retired from the board (owner, 15 Oct 2026; board audit
 * packages/football-engine/evidence/2026-10-15-board-audit on branch
 * ballers-board-audit): formation 2-1-1, Bodies forward 1 and 2, and On
 * losing it Regroup. Each cost goals with no football case left, and "better
 * not to offer a choice than a false one". The screens no longer offer them.
 *
 * Rows that already store one keep it (no migration, no write), and the engine
 * keeps accepting all three, so every frozen input replays exactly as before:
 * engineApproach, playedApproach and compute.ts never call these. They are
 * applied only where a club's CURRENT setup is read for the screens and for a
 * new browser match: lib/ballers/plans.ts `plan()` (every plan row) and
 * lib/ballers/data.ts `myClub` (the club defaults), and to another club's
 * side when practice or a rehearsal plays it now (boardSide below, through
 * data.ts practiceSide). Past preps, plan snapshots, replays and other clubs'
 * last games as scouting shows them stay as they were played.
 * 2-1-1 plays 1-2-1, 1 and 2 forward play 3, Regroup plays Balanced.
 * The server does the same for official matches: migration
 * 20261015200000_ballers_board_trim (applied together with this UI) maps at
 * freeze (private.ballers_input_side, the same three rules) and refuses a
 * retired value sent as a new pick ('retired_formation' / 'retired_option'). */
export const boardFormation=<F extends string>(f:F):F=>(f==='2-1-1'?'1-2-1':f) as F;
export function boardApproach<A extends StoredApproach>(a:A):A{
 const commit=a.commit<3?3:a.commit,onLoss=a.onLoss==='regroup'?'balanced':a.onLoss;
 return commit===a.commit&&onLoss===a.onLoss?a:{...a,commit,onLoss};
}
/** Another club's side as it would play now (formation and approach mapped as
 * above; everything else as it is). For practice and rehearsals against a
 * club "as in their last game" (data.ts practiceSide): a retired value can't
 * be played any more, and its next official match plays the mapped one
 * (private.ballers_input_side). Scouting's "last game" reads the side
 * unmapped (practiceSideStored), as it was played. */
export function boardSide<S extends {formation:string;approach:StoredApproach}>(s:S):S{
 const formation=boardFormation(s.formation),approach=boardApproach(s.approach);
 return formation===s.formation&&approach===s.approach?s:{...s,formation,approach};
}

/** The approach as the engine takes it: every key kept exactly as stored
 * (same keys, same order). A stored `onLoss` reaches the engine (an unknown
 * value reads as 'balanced'); an input from before the field is passed
 * through unchanged, and the engine reads its missing `onLoss` as
 * 'balanced'. */
export function engineApproach(a:StoredApproach):ApproachSettings{
 return a.onLoss===undefined?{...a}:{...a,onLoss:onLossOf(a)};
}

// ------------------------------------------------------------------ styles as identities (slice 1, 2026-10-22)
// A style is its base and its trait (deliverables/ballers-engine/STYLES-AS-IDENTITIES.md, owner's decision 22 Oct).
// The base is the pair a manager can no longer take apart: Progression and On winning it. The plan editor no longer
// shows those two rows; the style picks them. They stay in every stored approach (same keys, so every door, frozen
// input and replay reads as before), but a style's approach must carry its own base (SQL
// private.ballers_style_fits, migration ballers_styles_identity), and the engine checks the same when a side names
// its style (packages/football-engine/src/style.ts STYLE, styleBaseProblem).
/** The four style keys (league.ts Style). 'combinations' is Short. */
export type StyleKey='balanced'|'combinations'|'direct'|'counter';
export const STYLE_KEYS:readonly StyleKey[]=['balanced','combinations','direct','counter'];
/** Each style's base. Mirrors the engine's style.ts STYLE (verificare/ballers-style-identity.test.ts pins the two). */
export const STYLE_BASE:Readonly<Record<StyleKey,Readonly<Pick<ApproachSettings,'progression'|'transition'>>>>={
 balanced:{progression:'mixed',transition:'balanced'},
 combinations:{progression:'patient',transition:'secure'},
 direct:{progression:'direct',transition:'balanced'},
 counter:{progression:'mixed',transition:'counter'},
};
/** The pair a style owns, as stored (a missing On winning it reads 'balanced'). */
export type BasePair={progression:ApproachSettings['progression'];transition?:ApproachSettings['transition']};
/** The two keys a style owns (never offered as a row). */
export const BASE_KEYS=['progression','transition'] as const;
export type BaseKey=typeof BASE_KEYS[number];
export const isBaseKey=(k:string):k is BaseKey=>(BASE_KEYS as readonly string[]).includes(k);
export const isStyleKey=(v:unknown):v is StyleKey=>typeof v==='string'&&(STYLE_KEYS as readonly string[]).includes(v);
/** Whether a stored approach plays its style's base (a missing On winning it reads balanced, as the engine reads it). */
export function fitsStyle(style:string,a:BasePair):boolean{
 if(!isStyleKey(style))return false;
 const b=STYLE_BASE[style];
 return a.progression===b.progression&&(a.transition??'balanced')===b.transition;
}
/** The style the engine is told a side plays: its label when the approach fits that base, otherwise none (the side
 * plays exactly as stored, with no trait: a plan still waiting for its manager's pick, an AI side whose pair is no
 * style's base, an input frozen before styles were identities). */
export function engineStyle(style:string|undefined,a:BasePair):StyleKey|undefined{
 return style!==undefined&&fitsStyle(style,a)?style as StyleKey:undefined;
}
/** The approach with a style's base written in (every fine-tune kept, same keys in the same order). */
export function withStyleBase<A extends StoredApproach>(style:StyleKey,a:A):A{
 const b=STYLE_BASE[style];
 return a.progression===b.progression&&a.transition===b.transition?a:{...a,progression:b.progression,transition:b.transition};
}
/** The style a pair belongs to, if any (mixed + balanced is Balanced, mixed + counter is Counter, and so on). */
export function styleOfBase(a:BasePair):StyleKey|undefined{
 return STYLE_KEYS.find(s=>fitsStyle(s,a));
}
/** A stored approach that is no style's base under its label: the two styles it could become, the one that keeps
 * what it does after winning the ball (the surge -> Counter, Keep it -> Short) and the one that keeps how it moves the
 * ball (Patient -> Short, Mixed -> Balanced, Direct -> Direct). When those are the same style, the other is its own
 * label's, and when that is the same too (a Short plan on Patient + Balanced), Balanced. Fitting approaches return none: they need no choice. First = the default (owner, 22 Oct: a plan with the
 * surge becomes Counter if its manager says nothing). */
export function styleChoices(style:string,a:BasePair):StyleKey[]{
 if(fitsStyle(style,a))return [];
 const t=a.transition??'balanced';
 const byWin:StyleKey|undefined=t==='counter'?'counter':t==='secure'?'combinations':undefined;
 const byBall:StyleKey=a.progression==='patient'?'combinations':a.progression==='direct'?'direct':'balanced';
 const own=isStyleKey(style)?style:'balanced';
 const out:StyleKey[]=[];
 for(const s of [byWin,byBall,own,'balanced' as StyleKey])if(s&&!out.includes(s))out.push(s);
 return out.slice(0,2);
}
