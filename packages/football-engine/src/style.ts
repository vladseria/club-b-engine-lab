/** Every setting option as data (engine as data, deliverables/ballers-engine/ENGINE-AS-DATA-PLAN.md section 1).
 * Each entry is one effect: the exact value the code uses (`v`), its unit, the kind of effect, the pitch axis it is
 * tied to (recorded only; nothing applies it), the lines that read it, and one plain line of what it does.
 * Rules (plan 1.3): a value is the literal the code had, or the same expression evaluated the same way (`X(57)` stays
 * `X(57)`, computed at load); a formula stays a formula with its coefficients named here; old exported tables survive
 * as views with the same keys in the same order. Engine files import this module as a namespace (`import * as S`).
 * Runtime imports: pitch.ts only (a leaf), so this module can never sit in an import cycle. */
import {L,X,Y} from './pitch.js';
import type {Tactics} from './model.js';

/** The unit an entry is in, as the code uses it today. Never converted. */
export type Unit=
 |'m'      // metres on the live 48x30 pitch
 |'ref'    // 105x68 reference metres, passed through X()/Y() at the read site
 |'s'      // seconds
 |'x'      // multiplier on an existing read
 |'A'      // the carrier's option score
 |'B'      // an off-ball job's score
 |'men'|'trait'|'count'|'flag';
/** The pitch probe's class, recorded only. */
export type Axis='L'|'W'|'G'|'body'|'none';
/** The kinds of effect of WHAT-A-STYLE-IS.md (branch style-inventory), last section. */
export type EffectKind=
 |'optionCreditByFeature'|'optionCreditByTarget'|'situationalOptionCost'|'clockRule'
 |'jobCredit'|'jobOffered'|'fixedPost'|'positionOffset'|'arrangementConstraint'
 |'multiplier'|'defendingThreshold'|'triggerWindow'|'traitOverride'|'recentring';
/** One effect. `v` is the exact value the code uses (a number, null, Infinity or a flag). */
export interface Effect<V=number>{v:V;unit:Unit;kind:EffectKind;axis?:Axis;
 /** every read site, file:line at the commit that last moved it */
 at:readonly string[];
 /** one plain line: what it does, who, when */
 says:string}

// ------------------------------------------------------------------ Line
export interface LineOption{
 whoMatters:Effect;stepOut:Effect;engageShift:Effect;
 block:{gap:Effect;floor:Effect;ceiling:Effect;squeeze:Effect};
 protectRange:Effect;protectShare:Effect;coverDrop:Effect;
 backCap:Effect;buildCap:Effect;cushion:Effect<number|null>;
 coverPrice:Effect;restCushion:Effect;keeperStep:Effect;
}
const AT={
 whoMatters:['practice-defending.ts:367','practice-defending.ts:374'],
 stepOut:['practice-defending.ts:509'],
 engageShift:['practice-defending.ts:1090'],
 block:['practice-defending.ts:960'],
 protectRange:['practice-defending.ts:913'],
 protectShare:['practice-defending.ts:915'],
 coverDrop:['practice-defending.ts:1341','practice-defending.ts:1365'],
 backCap:['practice-shape.ts:128'],
 buildCap:['practice-build-up.ts:40'],
 cushion:['practice-shape.ts:207','practice-shape.ts:258'],
 coverPrice:['practice-build-up.ts:79'],
 restCushion:['practice-coordination.ts:425'],
 keeperStep:['practice-keeper-support.ts:50'],
} as const;
const SAYS={
 whoMatters:'a man is marked as a danger within this of our goal (plus the Press shift, plus 3 m central)',
 stepOut:'longest run to pick up a man who does not matter yet (plus the Press shift, floor 0.2 s)',
 engageShift:'added to the Press engage distance',
 gap:'free men stand this far behind the ball',
 floor:'the block is never deeper than this from our goal',
 ceiling:'the block is never higher than this',
 squeeze:'the block steps up this much when the ball is pressed or played back',
 protectRange:'markers protect the shot lane with the ball within this of our goal',
 protectShare:'share of the way from his man to the shot lane',
 coverDrop:'the free man drops to cover a man ahead of the ball within this of our goal',
 backCap:'in possession the back line never goes above this',
 buildCap:'build-up ceiling for the backs (or 11 m behind the ball)',
 cushion:'a centre-back stays this far goal-side of their deepest forward (null: no cushion)',
 coverPrice:'price of a loss near our goal, for the backs in possession',
 restCushion:'the rest guard stands this far goal-side of their most advanced forward',
 keeperStep:'the keeper offers support at least this far out',
} as const;
const lineOption=(o:{whoMatters:number;stepOut:number;engageShift:number;block:{gap:number;floor:number;ceiling:number;squeeze:number};protectRange:number;protectShare:number;coverDrop:number;backCap:number;buildCap:number;cushion:number|null;coverPrice:number;restCushion:number;keeperStep:number}):LineOption=>({
 whoMatters:{v:o.whoMatters,unit:'m',kind:'defendingThreshold',axis:'L',at:AT.whoMatters,says:SAYS.whoMatters},
 stepOut:{v:o.stepOut,unit:'s',kind:'defendingThreshold',at:AT.stepOut,says:SAYS.stepOut},
 engageShift:{v:o.engageShift,unit:'m',kind:'defendingThreshold',axis:'L',at:AT.engageShift,says:SAYS.engageShift},
 block:{
  gap:{v:o.block.gap,unit:'m',kind:'positionOffset',axis:'L',at:AT.block,says:SAYS.gap},
  floor:{v:o.block.floor,unit:'m',kind:'positionOffset',axis:'L',at:AT.block,says:SAYS.floor},
  ceiling:{v:o.block.ceiling,unit:'m',kind:'positionOffset',axis:'L',at:AT.block,says:SAYS.ceiling},
  squeeze:{v:o.block.squeeze,unit:'m',kind:'positionOffset',axis:'L',at:AT.block,says:SAYS.squeeze},
 },
 protectRange:{v:o.protectRange,unit:'m',kind:'defendingThreshold',axis:'L',at:AT.protectRange,says:SAYS.protectRange},
 protectShare:{v:o.protectShare,unit:'x',kind:'multiplier',at:AT.protectShare,says:SAYS.protectShare},
 coverDrop:{v:o.coverDrop,unit:'m',kind:'defendingThreshold',axis:'L',at:AT.coverDrop,says:SAYS.coverDrop},
 backCap:{v:o.backCap,unit:'m',kind:'positionOffset',axis:'L',at:AT.backCap,says:SAYS.backCap},
 buildCap:{v:o.buildCap,unit:'m',kind:'positionOffset',axis:'L',at:AT.buildCap,says:SAYS.buildCap},
 cushion:{v:o.cushion,unit:'m',kind:'positionOffset',axis:'body',at:AT.cushion,says:SAYS.cushion},
 coverPrice:{v:o.coverPrice,unit:'x',kind:'multiplier',at:AT.coverPrice,says:SAYS.coverPrice},
 restCushion:{v:o.restCushion,unit:'m',kind:'positionOffset',axis:'body',at:AT.restCushion,says:SAYS.restCushion},
 keeperStep:{v:o.keeperStep,unit:'m',kind:'positionOffset',axis:'L',at:AT.keeperStep,says:SAYS.keeperStep},
});
/** Line: how high the team defends and supports. Values exactly as the tables had them at b107e7b2. */
export const LINE:Readonly<Record<Tactics['line'],LineOption>>={
 deep:lineOption({whoMatters:17,stepOut:.5,engageShift:-4,block:{gap:8,floor:5,ceiling:15,squeeze:0},protectRange:19,protectShare:1,coverDrop:20,backCap:X(57),buildCap:X(56),cushion:2,coverPrice:1.3,restCushion:2.5,keeperStep:3}),
 standard:lineOption({whoMatters:18.5,stepOut:.9,engageShift:0,block:{gap:6,floor:6,ceiling:20,squeeze:2.5},protectRange:16,protectShare:.6,coverDrop:22,backCap:Infinity,buildCap:Infinity,cushion:0,coverPrice:1,restCushion:1.5,keeperStep:4}),
 high:lineOption({whoMatters:21,stepOut:1.5,engageShift:5,block:{gap:4,floor:7,ceiling:26,squeeze:5},protectRange:13,protectShare:.3,coverDrop:24,backCap:Infinity,buildCap:Infinity,cushion:null,coverPrice:.75,restCushion:1,keeperStep:5}),
};

// ------------------------------------------------------------------ Width
/** One entry per Width option; keys in practice-shape.ts WIDTH's own order (narrow, standard, wide). Several of these
 * are read only by the defending block in teamShape, which no Ballers match runs (plan 6.1): pull, follow, reach,
 * allowance, inward; they are mirrored exactly, still dead. */
export interface WidthOption{
 lane:Effect;pull:Effect;discipline:Effect;hold:Effect;follow:Effect;reach:Effect;allowance:Effect;inward:Effect;
 sag:Effect;balance:Effect;spread:{backs:Effect;middle:Effect};
}
const WAT={
 lane:['practice-shape.ts:100 (laneY)','practice-shape.ts:160 (teamShape)','practice-coordination.ts:725','practice-coordination.ts:1002','practice-coordination.ts:1007'],
 pull:['practice-shape.ts:171 (teamShape, dead)'],discipline:['practice-coordination.ts:725'],hold:['practice-coordination.ts:1013'],
 follow:['practice-shape.ts:310 (blockPulls, dead)'],reach:['practice-shape.ts:310 (blockPulls, dead)'],
 allowance:['practice-shape.ts:381 (markingDeparture, dead)'],inward:['practice-shape.ts:381 (markingDeparture, dead)'],
 sag:['practice-defending.ts:728'],balance:['practice-defending.ts:477','practice-defending.ts:1400','practice-defending.ts:1410'],
 spread:['practice-shape.ts:96 (buildUpSpread, 2-1-1 only)'],
} as const;
const widthOption=(o:{lane:number;pull:number;discipline:number;hold:number;follow:number;reach:number;allowance:number;inward:number;sag:number;balance:number;spread:{backs:number;middle:number}}):WidthOption=>({
 lane:{v:o.lane,unit:'m',kind:'positionOffset',axis:'W',at:WAT.lane,says:'a winger holds this far from the centre line in possession (capped at W/2-1.5)'},
 pull:{v:o.pull,unit:'x',kind:'multiplier',at:WAT.pull,says:'(dead) share of the way a winger is pulled toward the ball side in teamShape'},
 discipline:{v:o.discipline,unit:'B',kind:'jobCredit',at:WAT.discipline,says:'a winger support job pays this per metre it takes him inside his lane band'},
 hold:{v:o.hold,unit:'B',kind:'jobCredit',at:WAT.hold,says:'base score of the hold-width job on the far side'},
 follow:{v:o.follow,unit:'x',kind:'multiplier',at:WAT.follow,says:'(dead) how far the teamShape block follows a man'},
 reach:{v:o.reach,unit:'m',kind:'positionOffset',axis:'W',at:WAT.reach,says:'(dead) how far the teamShape block reaches for a man'},
 allowance:{v:o.allowance,unit:'x',kind:'multiplier',at:WAT.allowance,says:'(dead) price of an outward marking trip in teamShape'},
 inward:{v:o.inward,unit:'x',kind:'multiplier',at:WAT.inward,says:'(dead) price of an inward marking trip in teamShape'},
 sag:{v:o.sag,unit:'x',kind:'multiplier',at:WAT.sag,says:'how far a marker may sag off a far man (more than 8 m across)'},
 balance:{v:o.balance,unit:'m',kind:'positionOffset',axis:'W',at:WAT.balance,says:'the balance man tucks this far across on the far side'},
 spread:{
  backs:{v:o.spread.backs,unit:'x',kind:'positionOffset',axis:'W',at:WAT.spread,says:'2-1-1: factor on the centre-backs\' lane split in possession'},
  middle:{v:o.spread.middle,unit:'x',kind:'positionOffset',axis:'W',at:WAT.spread,says:'2-1-1: factor on how much the midfielder follows the ball side'},
 },
});
/** Width: how wide the team holds and defends. Values exactly as the tables had them at b107e7b2. */
export const WIDTH:Readonly<Record<'narrow'|'standard'|'wide',WidthOption>>={
 narrow:widthOption({lane:Y(22),pull:.35,discipline:0,hold:.45,follow:.3,reach:1.5,allowance:.7,inward:1.15,sag:1.25,balance:1,spread:{backs:.75,middle:1.7}}),
 standard:widthOption({lane:Y(26),pull:.12,discipline:.03,hold:.85,follow:.55,reach:3.5,allowance:1,inward:1,sag:1,balance:2.5,spread:{backs:1,middle:1}}),
 wide:widthOption({lane:Y(30),pull:0,discipline:.06,hold:1.1,follow:.8,reach:6,allowance:1.4,inward:1.4,sag:.75,balance:4.5,spread:{backs:1.4,middle:.3}}),
};
/** The Width mechanism's coefficients, the same for every option (practice-coordination.ts laneCost and the hold-width job). */
export const WIDTH_COMMON={
 bandInside:{v:4,unit:'m',kind:'positionOffset',axis:'W',at:['practice-coordination.ts:725'],says:'a winger\'s lane band starts this far inside his lane'},
 backLane:{v:11,unit:'ref',kind:'positionOffset',axis:'W',at:['practice-coordination.ts:729'],says:'2-1-1: a centre-back\'s lane, times the Width spread'},
 backCost:{v:.06,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:738'],says:'2-1-1: a centre-back support job pays this per metre outside his band'},
 midLane:{v:11,unit:'m',kind:'positionOffset',axis:'W',at:['practice-coordination.ts:735'],says:'the midfielder\'s Width target: his lane times this, plus the shift times the spread'},
 midDiscipline:{v:.1,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:327 (MID_DISCIPLINE)'],says:'the midfielder pays this per metre beyond the slack from his Width target'},
 midSlack:{v:.5,unit:'m',kind:'positionOffset',at:['practice-coordination.ts:327 (MID_SLACK)'],says:'free metres around the midfielder\'s Width target'},
 runShare:{v:.5,unit:'x',kind:'multiplier',at:['practice-coordination.ts:785'],says:'a depth or break run pays this share of the lane cost'},
 holdPinned:{v:.15,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:1013'],says:'hold-width job: extra when he pins a defender away from the ball'},
 holdFree:{v:.15,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:1013'],says:'hold-width job: extra times how free he is'},
 holdEligible:{v:6,unit:'m',kind:'jobOffered',axis:'W',at:['practice-coordination.ts:1007'],says:'hold-width job: offered when his lane lies at least this far outside the ball'},
} as const satisfies Record<string,Effect>;

// ------------------------------------------------------------------ Press
/** One entry per Press option (selective, balanced, aggressive). lean / cap / effort are read only by teamShape's
 * defending block, which no Ballers match runs (plan 6.1): mirrored exactly, still dead. */
export interface PressOption{
 dangerShift:Effect;watchShift:Effect;engage:Effect;hold:Effect;sag:Effect;
 lean:Effect;cap:Effect;effort:Effect;
 pressesKeeper:Effect<boolean>;doubles:Effect<boolean>;engagement:Effect;tackleNerve:Effect;traps:Effect<boolean>;goalKickBlock:Effect<boolean>;
}
const PAT={
 dangerShift:['practice-defending.ts:367','practice-defending.ts:374'],watchShift:['practice-defending.ts:509'],
 engage:['practice-defending.ts:1090'],hold:['practice-defending.ts:1135'],sag:['practice-defending.ts:726'],
 lean:['practice-shape.ts:58 (markLean, no caller)','practice-shape.ts:135 (teamShape, dead)'],cap:['practice-shape.ts:135 (teamShape, dead)'],effort:['practice-shape.ts:214 (teamShape, dead)'],
 pressesKeeper:['practice-defending.ts:492','practice-defending.ts:1090'],doubles:['practice-defending.ts:1205'],
 engagement:['practice-defense.ts:201'],tackleNerve:['practice-challenge.ts:99'],traps:['practice-coordination.ts:539'],goalKickBlock:['practice-restart-live.ts:419'],
} as const;
const pressOption=(o:{dangerShift:number;watchShift:number;engage:number;hold:number;sag:number;lean:number;cap:number;effort:number;pressesKeeper:boolean;doubles:boolean;engagement:number;tackleNerve:number;traps:boolean;goalKickBlock:boolean}):PressOption=>({
 dangerShift:{v:o.dangerShift,unit:'m',kind:'defendingThreshold',axis:'L',at:PAT.dangerShift,says:'added to the Line\'s who-matters distance'},
 watchShift:{v:o.watchShift,unit:'s',kind:'defendingThreshold',at:PAT.watchShift,says:'added to the Line\'s step-out time (floor 0.2 s)'},
 engage:{v:o.engage,unit:'m',kind:'defendingThreshold',axis:'L',at:PAT.engage,says:'the man on the carrier engages within this of our goal (plus the Line shift)'},
 hold:{v:o.hold,unit:'m',kind:'positionOffset',axis:'body',at:PAT.hold,says:'further out, he waits this far off the carrier, goal-side'},
 sag:{v:o.sag,unit:'x',kind:'multiplier',at:PAT.sag,says:'how far a marker may sag off his man'},
 lean:{v:o.lean,unit:'x',kind:'multiplier',at:PAT.lean,says:'(dead) the teamShape block\'s lean toward the ball'},
 cap:{v:o.cap,unit:'m',kind:'positionOffset',axis:'W',at:PAT.cap,says:'(dead) the teamShape lean\'s cap'},
 effort:{v:o.effort,unit:'x',kind:'multiplier',at:PAT.effort,says:'(dead) how hard the teamShape players slide'},
 pressesKeeper:{v:o.pressesKeeper,unit:'flag',kind:'jobOffered',at:PAT.pressesKeeper,says:'the keeper on the ball is pressed and engaged like an outfielder'},
 doubles:{v:o.doubles,unit:'flag',kind:'jobOffered',at:PAT.doubles,says:'a second man doubles the carrier on a trigger, with a balance man goal-side'},
 engagement:{v:o.engagement,unit:'trait',kind:'traitOverride',at:PAT.engagement,says:'added to the defender\'s engagement when he chooses to close or jockey'},
 tackleNerve:{v:o.tackleNerve,unit:'trait',kind:'defendingThreshold',at:PAT.tackleNerve,says:'taken off the ordinary tackle threshold'},
 traps:{v:o.traps,unit:'flag',kind:'triggerWindow',at:PAT.traps,says:'springs the trap on a trigger (touchline, entry pass, back to goal)'},
 goalKickBlock:{v:o.goalKickBlock,unit:'flag',kind:'positionOffset',at:PAT.goalKickBlock,says:'at their goal kick only the man on the short option goes; the rest hold a block'},
});
/** Press: how the team goes for the ball. Values exactly as the code had them at b107e7b2. */
export const PRESS:Readonly<Record<Tactics['press'],PressOption>>={
 selective:pressOption({dangerShift:-1,watchShift:-.3,engage:22,hold:5.5,sag:1.15,lean:.35,cap:Y(14),effort:1,pressesKeeper:false,doubles:false,engagement:-.1,tackleNerve:0,traps:true,goalKickBlock:true}),
 balanced:pressOption({dangerShift:0,watchShift:0,engage:31,hold:4,sag:1,lean:.5,cap:Y(14),effort:1,pressesKeeper:false,doubles:false,engagement:0,tackleNerve:0,traps:false,goalKickBlock:false}),
 aggressive:pressOption({dangerShift:3,watchShift:.8,engage:L,hold:2.5,sag:.8,lean:.7,cap:Y(21),effort:1.15,pressesKeeper:true,doubles:true,engagement:.2,tackleNerve:.025,traps:false,goalKickBlock:false}),
};
/** The trap (Selective) and the double (Aggressive): their coefficients, the same whoever runs them. */
export const PRESS_COMMON={
 trapWindow:{v:2.5,unit:'s',kind:'triggerWindow',at:['practice-coordination.ts:536 (TRAP_WINDOW)'],says:'the trap presses at most this long'},
 trapRest:{v:20,unit:'s',kind:'triggerWindow',at:['practice-coordination.ts:535,537 (TRAP_REST)'],says:'after a trap, this long before the next'},
 trapReach:{v:10,unit:'m',kind:'triggerWindow',axis:'body',at:['practice-coordination.ts:545 (TRAP_REACH)'],says:'trap goers come from within this of the carrier'},
 trapSpread:{v:.6,unit:'trait',kind:'triggerWindow',at:['practice-coordination.ts:114 (TRAP_SPREAD)'],says:'how noisy a defender\'s read of the trigger is'},
 trapFresh:{v:1.2,unit:'s',kind:'triggerWindow',at:['practice-coordination.ts:101,540 (TRAP_FRESH)'],says:'a trigger is fresh this long after the carrier got the ball'},
 trapEager:{v:.6,unit:'trait',kind:'triggerWindow',at:['practice-coordination.ts:114 (TRAP_EAGER)'],says:'bias of an eager, independent defender toward seeing the trigger'},
 trapSettled:{v:5,unit:'s',kind:'triggerWindow',at:['practice-coordination.ts:539 (TRAP_SETTLED)'],says:'no trap in the first seconds of their possession'},
 trapNear:{v:22,unit:'m',kind:'triggerWindow',axis:'L',at:['practice-coordination.ts:100 (TRAP_NEAR)'],says:'no trap nearer our goal than this'},
 trapFar:{v:L*.72,unit:'m',kind:'triggerWindow',axis:'L',at:['practice-coordination.ts:100 (TRAP_FAR)'],says:'no trap further from our goal than this'},
 doubleReach:{v:4,unit:'m',kind:'triggerWindow',axis:'body',at:['practice-defending.ts:1205'],says:'the double starts only with the presser this close to the carrier'},
 doubleSpread:{v:.6,unit:'trait',kind:'triggerWindow',at:['practice-defending.ts:1209 (DOUBLE_SPREAD)'],says:'how noisy the cover man\'s read of the double\'s trigger is'},
} as const satisfies Record<string,Effect>;

// ------------------------------------------------------------------ Bodies forward (commit)
/** Bodies forward is a number (1-5), read through formulas: these are their coefficients, in the order the code uses
 * them (rule 1.3.2). Per-value results are never tabulated: 1.4-clamp(commit,1,5)*.16 at 5 is 0.5999999999999999. */
export const COMMIT={
 lowest:{v:1,unit:'count',kind:'arrangementConstraint',at:['practice-exposure.ts:21','practice-rest-defence.ts:102'],says:'Bodies forward is clamped to 1..5 where it is a count'},
 highest:{v:5,unit:'count',kind:'arrangementConstraint',at:['practice-exposure.ts:21','practice-rest-defence.ts:102'],says:'the top of that clamp'},
 neutral:{v:3,unit:'count',kind:'arrangementConstraint',at:['practice-coordination.ts:225','practice-coordination.ts:719','practice-coordination.ts:985','practice-coordination.ts:991','practice-build-up.ts:42','practice-shape.ts:114','practice-rest-defence.ts:103'],says:'the free setting: offsets are counted from it, and below / from it jobs open or close'},
 exposureBase:{v:1.4,unit:'x',kind:'multiplier',at:['practice-exposure.ts:21'],says:'rest-defence exposure weight: this minus Bodies forward times the step'},
 exposurePer:{v:.16,unit:'x',kind:'multiplier',at:['practice-exposure.ts:21'],says:'the exposure weight\'s step per body forward'},
 ambitionBase:{v:.8,unit:'x',kind:'multiplier',at:['practice-attacking-space.ts:99'],says:'attacking-space ambition: this plus Bodies forward times the step'},
 ambitionPer:{v:.08,unit:'x',kind:'multiplier',at:['practice-attacking-space.ts:99'],says:'the ambition step per body forward'},
 runCredit:{v:.08,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:225'],says:'runs (not the give-and-go return) gain this per body forward above the free setting'},
 holdCredit:{v:.15,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:719'],says:'below the free setting, close support jobs gain this'},
 guardsUpTo:{v:2,unit:'count',kind:'arrangementConstraint',at:['practice-coordination.ts:417 (REST_GUARDS)'],says:'up to this setting the side keeps the larger rest guard'},
 guardsMany:{v:2,unit:'men',kind:'arrangementConstraint',at:['practice-coordination.ts:417 (REST_GUARDS)'],says:'rest guards at those settings'},
 guardsFew:{v:1,unit:'men',kind:'arrangementConstraint',at:['practice-coordination.ts:417 (REST_GUARDS)'],says:'rest guards above them'},
 restFloorBase:{v:3,unit:'men',kind:'arrangementConstraint',at:['practice-rest-defence.ts:103'],says:'below the free setting at least this minus the setting stay behind'},
 restCapFree:{v:3,unit:'men',kind:'arrangementConstraint',at:['practice-rest-defence.ts:103'],says:'below the free setting at most this many stay behind (all three outfield team-mates)'},
 restCapBase:{v:6,unit:'men',kind:'arrangementConstraint',at:['practice-rest-defence.ts:103'],says:'from the free setting at most this minus the setting stay behind'},
 price:{v:1.5,unit:'B',kind:'arrangementConstraint',at:['practice-rest-defence.ts:116 (COMMIT_PRICE)'],says:'what one body out of the committed shape costs a fully disciplined player'},
 holdFloor:{v:.2,unit:'x',kind:'multiplier',at:['practice-rest-defence.ts:117'],says:'share of that price an undisciplined player still pays'},
 holdPer:{v:.8,unit:'x',kind:'multiplier',at:['practice-rest-defence.ts:117'],says:'the rest of it, by discipline'},
} as const satisfies Record<string,Effect>;

// ------------------------------------------------------------------ Progression (off the ball: S6)
export interface ProgressionOption{
 runBypass:Effect;runReturn:Effect;runOther:Effect;supportCredit:Effect;
 forwardDiagonals:Effect<boolean>;extraOutlet:Effect<boolean>;depthRunAnywhere:Effect<boolean>;
 depthRunAhead:Effect;frontAhead:Effect;attackValue:Effect;
 /** on the ball (S7): team-approach.ts purposeClock and approachOptions */
 clockStartsAfter:Effect;readsBlock:Effect<boolean>;clockDeliveryTerms:Effect<boolean>;delivery:Effect<'none'|'patient'|'direct'>;
}
const GAT={
 run:['practice-coordination.ts:224 (runStyle)'],support:['practice-coordination.ts:777'],diag:['practice-coordination.ts:690'],
 outlet:['practice-coordination.ts:888'],anywhere:['practice-coordination.ts:986'],ahead:['practice-coordination.ts:990'],
 front:['practice-shape.ts:122 (teamShape in possession)'],value:['practice-attacking-space.ts:78'],
} as const;
const progressionOption=(o:{runBypass:number;runReturn:number;runOther:number;supportCredit:number;forwardDiagonals:boolean;extraOutlet:boolean;depthRunAnywhere:boolean;depthRunAhead:number;frontAhead:number;attackValue:number;clockStartsAfter:number;readsBlock:boolean;clockDeliveryTerms:boolean;delivery:'none'|'patient'|'direct'}):ProgressionOption=>({
 runBypass:{v:o.runBypass,unit:'B',kind:'jobCredit',at:GAT.run,says:'a run that bypasses (in behind, or a break not under Keep it)'},
 runReturn:{v:o.runReturn,unit:'B',kind:'jobCredit',at:GAT.run,says:'the give-and-go return run'},
 runOther:{v:o.runOther,unit:'B',kind:'jobCredit',at:GAT.run,says:'any other run'},
 supportCredit:{v:o.supportCredit,unit:'B',kind:'jobCredit',at:GAT.support,says:'every non-run support job'},
 forwardDiagonals:{v:o.forwardDiagonals,unit:'flag',kind:'jobOffered',at:GAT.diag,says:'close support is also offered 5-7 m ahead of the ball'},
 extraOutlet:{v:o.extraOutlet,unit:'flag',kind:'jobOffered',at:GAT.outlet,says:'a short outlet job whenever no exit is planned'},
 depthRunAnywhere:{v:o.depthRunAnywhere,unit:'flag',kind:'jobOffered',at:GAT.anywhere,says:'the run in behind is offered wherever the ball is (otherwise only past the threshold)'},
 depthRunAhead:{v:o.depthRunAhead,unit:'ref',kind:'positionOffset',axis:'L',at:GAT.ahead,says:'the run in behind aims this far ahead of the ball'},
 frontAhead:{v:o.frontAhead,unit:'ref',kind:'positionOffset',axis:'L',at:GAT.front,says:'the front line stands this far ahead of midfield'},
 attackValue:{v:o.attackValue,unit:'x',kind:'multiplier',at:GAT.value,says:'value of a reception in attacking space'},
 clockStartsAfter:{v:o.clockStartsAfter,unit:'count',kind:'clockRule',at:['team-approach.ts:96 (purposeClock)'],says:'the purpose clock starts this many recycled passes later'},
 readsBlock:{v:o.readsBlock,unit:'flag',kind:'optionCreditByFeature',at:['team-approach.ts:207'],says:'the passer reads the defending block even before the purpose clock runs'},
 clockDeliveryTerms:{v:o.clockDeliveryTerms,unit:'flag',kind:'clockRule',at:['team-approach.ts:211'],says:'once the clock runs, passes gain its penetration and switch credits here (a patient side has them in its own credit)'},
 delivery:{v:o.delivery,unit:'flag',kind:'optionCreditByFeature',at:['team-approach.ts:221','team-approach.ts:223','team-approach.ts:227'],says:'which delivery credit applies: none (neutral), the patient one, the direct one'},
});
/** Progression: how the team moves the ball forward. Values exactly as the code had them at b107e7b2. */
export const PROGRESSION:Readonly<Record<Tactics['progression'],ProgressionOption>>={
 patient:progressionOption({runBypass:-.18,runReturn:.15,runOther:0,supportCredit:.15,forwardDiagonals:true,extraOutlet:true,depthRunAnywhere:false,depthRunAhead:23,frontAhead:16,attackValue:.7,clockStartsAfter:1,readsBlock:true,clockDeliveryTerms:false,delivery:'patient'}),
 mixed:progressionOption({runBypass:0,runReturn:0,runOther:0,supportCredit:0,forwardDiagonals:false,extraOutlet:false,depthRunAnywhere:false,depthRunAhead:23,frontAhead:16,attackValue:.9,clockStartsAfter:0,readsBlock:false,clockDeliveryTerms:true,delivery:'none'}),
 direct:progressionOption({runBypass:.18,runReturn:.18,runOther:.18,supportCredit:0,forwardDiagonals:false,extraOutlet:false,depthRunAnywhere:true,depthRunAhead:30,frontAhead:20,attackValue:1.1,clockStartsAfter:0,readsBlock:false,clockDeliveryTerms:true,delivery:'direct'}),
};
/** Progression's off-ball coefficients shared by every option. */
export const PROGRESSION_COMMON={
 depthRunFrom:{v:32,unit:'ref',kind:'jobOffered',axis:'L',at:['practice-coordination.ts:986'],says:'otherwise the run in behind is offered only with the ball past this'},
} as const satisfies Record<string,Effect>;
/** The patient delivery credit (team-approach.ts approachOptions): one formula, its coefficients in code order
 * (rule 1.3.2). It stays a formula; naming them is what makes it readable. */
export const PATIENT_DELIVERY={
 keepBase:{v:.5,unit:'x',kind:'optionCreditByFeature',at:['team-approach.ts:231'],says:'keep-ball: base share before gain and connection'},
 keepGainPer:{v:8,unit:'m',kind:'optionCreditByFeature',axis:'body',at:['team-approach.ts:231'],says:'keep-ball: metres of gain per full share'},
 keepConnection:{v:1.5,unit:'x',kind:'optionCreditByFeature',at:['team-approach.ts:231'],says:'keep-ball: weight of the connection it opens'},
 clockFade:{v:.5,unit:'x',kind:'clockRule',at:['team-approach.ts:231'],says:'the running clock fades keep-ball by up to this share'},
 throughBase:{v:.4,unit:'x',kind:'optionCreditByFeature',at:['team-approach.ts:232'],says:'past defenders, keep-ball counts this much with no open lane'},
 throughOpen:{v:.6,unit:'x',kind:'optionCreditByFeature',at:['team-approach.ts:232'],says:'... and this much more as the lane opens'},
 purposeConnection:{v:4,unit:'x',kind:'optionCreditByFeature',at:['team-approach.ts:233'],says:'a connection counts as purpose at this weight'},
 forcingLines:{v:2,unit:'count',kind:'situationalOptionCost',at:['team-approach.ts:234'],says:'forcing: defenders bypassed for a full share'},
 forcingRisk:{v:.15,unit:'x',kind:'situationalOptionCost',at:['team-approach.ts:234'],says:'forcing: risk below this costs nothing'},
 forcingSpan:{v:.3,unit:'x',kind:'situationalOptionCost',at:['team-approach.ts:234'],says:'forcing: risk span to a full share'},
 keep:{v:.19,unit:'A',kind:'optionCreditByFeature',at:['team-approach.ts:237'],says:'keep-ball credit at full share'},
 forcingCost:{v:.05,unit:'A',kind:'situationalOptionCost',at:['team-approach.ts:237'],says:'cost of a purposeless pass that forces'},
 penetration:{v:.09,unit:'A',kind:'optionCreditByFeature',at:['team-approach.ts:237'],says:'credit for going through an open lane (times 1 + clock)'},
 switch:{v:.06,unit:'A',kind:'optionCreditByFeature',at:['team-approach.ts:237'],says:'credit for a switch to a free man'},
 switchClock:{v:.5,unit:'x',kind:'clockRule',at:['team-approach.ts:237'],says:'the clock grows the switch credit by up to this share'},
 runnerBonus:{v:.035,unit:'A',kind:'optionCreditByFeature',at:['team-approach.ts:237'],says:'a pass leading a runner, within the range'},
 runnerRange:{v:16,unit:'m',kind:'optionCreditByFeature',axis:'body',at:['team-approach.ts:237'],says:'the runner bonus applies to passes shorter than this'},
} as const satisfies Record<string,Effect>;
/** The direct delivery credit: clamp(gain/14,-.55,1)*.21*feasible plus a bonus for a long forward ball. */
export const DIRECT_DELIVERY={
 gainSpan:{v:14,unit:'m',kind:'optionCreditByFeature',axis:'L',at:['team-approach.ts:239'],says:'metres of forward gain for the full credit'},
 gainFloor:{v:-.55,unit:'x',kind:'optionCreditByFeature',at:['team-approach.ts:239'],says:'the lowest share (a ball back)'},
 weight:{v:.21,unit:'A',kind:'optionCreditByFeature',at:['team-approach.ts:239'],says:'the credit at full share'},
 longGap:{v:13,unit:'m',kind:'optionCreditByFeature',axis:'body',at:['team-approach.ts:239'],says:'a long ball: longer than this ...'},
 longGain:{v:7,unit:'m',kind:'optionCreditByFeature',axis:'L',at:['team-approach.ts:239'],says:'... and gaining more than this'},
 longBonus:{v:.035,unit:'A',kind:'optionCreditByFeature',at:['team-approach.ts:239'],says:'its bonus'},
} as const satisfies Record<string,Effect>;
/** The style mechanics every option shares (team-approach.ts): the counter's clearance price, the purpose clock and the
 * feasibility weight. Applied before the re-centring except where `says` notes it (plan 1.7). */
export const COMMON={
 counterValue:{v:.22,unit:'A',kind:'situationalOptionCost',at:['team-approach.ts:179 (COUNTER_VALUE)'],says:'under a counter that is on, a clearance to nobody pays this (not re-centred)'},
 purposeAfter:{v:2,unit:'count',kind:'clockRule',at:['team-approach.ts:94 (PURPOSE_AFTER)'],says:'the purpose clock starts after this many recycled passes'},
 clockRamp:{v:2,unit:'count',kind:'clockRule',at:['team-approach.ts:97'],says:'it is fully on this many passes later'},
 clockRelief:{v:.6,unit:'x',kind:'clockRule',at:['team-approach.ts:94 (CLOCK_RELIEF)'],says:'share of a reset\'s pass-only pressure credits the running clock takes away (not re-centred)'},
 clockShot:{v:.05,unit:'A',kind:'clockRule',at:['team-approach.ts:94 (CLOCK_SHOT)'],says:'a real shot gains this times the clock (not re-centred)'},
 clockPen:{v:.08,unit:'A',kind:'clockRule',at:['team-approach.ts:94 (CLOCK_PEN)'],says:'penetration credit times the clock (not re-centred)'},
 clockSwitch:{v:.05,unit:'A',kind:'clockRule',at:['team-approach.ts:94 (CLOCK_SWITCH)'],says:'switch credit times the clock (not re-centred)'},
 clockBack:{v:.03,unit:'A',kind:'clockRule',at:['team-approach.ts:94 (CLOCK_BACK)'],says:'a ball back loses this times the clock (not re-centred)'},
 clockBackGain:{v:-2,unit:'m',kind:'clockRule',axis:'L',at:['team-approach.ts:213'],says:'a ball back: gain below this'},
 feasibleRisk:{v:.65,unit:'x',kind:'multiplier',at:['team-approach.ts:226'],says:'a style credit is scaled by 1 minus this times the pass risk'},
 /** descriptive: the re-centring is code with no coefficient (approachOptions' last lines). The delivery credits and the
  * Pivot pull are re-centred; the counter clearance price and the purpose clock terms come before it and are not. */
 recentring:{v:true,unit:'flag',kind:'recentring',at:['team-approach.ts:242-246'],says:'the best styled delivery is shifted to equal the best neutral one: a style chooses which pass, not whether to pass'},
} as const satisfies Record<string,Effect<number|boolean>>;

// ------------------------------------------------------------------ Striker (S8: all four options)
/** Which mechanism each Striker option runs, and its attacking value. `striker` is OPTIONAL in Tactics: a missing value
 * plays as Mixed at every read site (the census's missing-value column), so sites read S.STRIKER[t.striker??'mixed']. */
export interface StrikerOption{holdsLastLine:Effect<boolean>;runsInBehind:Effect<boolean>;dropsDeep:Effect<boolean>;attackValue:Effect}
const strikerOption=(o:{holdsLastLine:boolean;runsInBehind:boolean;dropsDeep:boolean;attackValue:number}):StrikerOption=>({
 holdsLastLine:{v:o.holdsLastLine,unit:'flag',kind:'fixedPost',at:['practice-coordination.ts:671','practice-coordination.ts:846'],says:'the lead forward holds their last line as a pivot (PIVOT)'},
 runsInBehind:{v:o.runsInBehind,unit:'flag',kind:'fixedPost',at:['practice-coordination.ts:676','practice-coordination.ts:990'],says:'the lead forward lives on their last defender\'s shoulder and runs in behind (IN_BEHIND)'},
 dropsDeep:{v:o.dropsDeep,unit:'flag',kind:'fixedPost',at:['practice-coordination.ts:684','practice-coordination.ts:822'],says:'the lead forward drops between their lines as a false nine (DROPS_DEEP)'},
 attackValue:{v:o.attackValue,unit:'x',kind:'multiplier',at:['practice-attacking-space.ts:96'],says:'the lead forward\'s attacking-space value'},
});
/** Striker. 'link' is Drops deep (renamed on screen only); 'run' is In behind. */
export const STRIKER:Readonly<Record<NonNullable<Tactics['striker']>,StrikerOption>>={
 mixed:strikerOption({holdsLastLine:false,runsInBehind:false,dropsDeep:false,attackValue:1}),
 link:strikerOption({holdsLastLine:false,runsInBehind:false,dropsDeep:true,attackValue:.65}),
 pivot:strikerOption({holdsLastLine:true,runsInBehind:false,dropsDeep:false,attackValue:1}),
 run:strikerOption({holdsLastLine:false,runsInBehind:true,dropsDeep:false,attackValue:1.15}),
};
/** Pivot: the post on their last line, the show, the jobs he still takes, the third man, the pull to his feet. */
export const PIVOT={
 gap:{v:1,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:266 (PIVOT_GAP)'],says:'he stands this far in front of their deepest outfielder'},
 contact:{v:3,unit:'m',kind:'fixedPost',axis:'body',at:['practice-coordination.ts:266 (PIVOT_CONTACT)'],says:'he is on the last defender when that defender is within this'},
 width:{v:4.5,unit:'m',kind:'fixedPost',axis:'W',at:['practice-coordination.ts:266 (PIVOT_WIDTH)'],says:'central: never further across than this'},
 goal:{v:5,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:266 (PIVOT_GOAL)'],says:'never inside this of the goal line (Drops deep\'s run beyond reads it too)'},
 show:{v:2.5,unit:'m',kind:'fixedPost',axis:'body',at:['practice-coordination.ts:266 (PIVOT_SHOW)'],says:'he shows this far toward the ball when the lane to his feet is open'},
 reach:{v:26,unit:'m',kind:'fixedPost',axis:'body',at:['practice-coordination.ts:266 (PIVOT_REACH)'],says:'he shows only for a passer within this'},
 on:{v:.3,unit:'x',kind:'fixedPost',at:['practice-coordination.ts:266 (PIVOT_ON)'],says:'he shows when his read of the lane\'s risk is below this'},
 laneSpread:{v:.15,unit:'trait',kind:'fixedPost',at:['practice-coordination.ts:266 (PIVOT_LANE_SPREAD)'],says:'how noisy that read is for a player who cannot read the game'},
 hold:{v:1,unit:'B',kind:'fixedPost',at:['practice-coordination.ts:266 (PIVOT_HOLD)'],says:'his post\'s job score: it beats any other job'},
 alsoTakes:{v:['give-and-go','near-post','far-post','break','link'] as string[],unit:'flag',kind:'jobOffered',at:['practice-coordination.ts:282 (PIVOT_ALSO)'],says:'the only other jobs he still takes'},
 thirdBack:{v:[4,6] as number[],unit:'m',kind:'jobOffered',axis:'body',at:['practice-coordination.ts:277 (THIRD_BACK)'],says:'third-man spots: this far on the ball side of him'},
 thirdWide:{v:[3.5,5.5] as number[],unit:'m',kind:'jobOffered',axis:'body',at:['practice-coordination.ts:277 (THIRD_WIDE)'],says:'... and this far off his shoulder'},
 thirdSpread:{v:.6,unit:'trait',kind:'jobOffered',at:['practice-coordination.ts:277 (THIRD_SPREAD)'],says:'how noisy a team-mate\'s arrival read for the third man is'},
 thirdSlack:{v:.6,unit:'s',kind:'jobOffered',at:['practice-coordination.ts:277 (THIRD_SLACK)'],says:'he may arrive this much after the lay-off could come'},
 pull:{v:.06,unit:'A',kind:'optionCreditByTarget',at:['team-approach.ts:187 (PIVOT_PULL)'],says:'a pass to his feet while he shows (re-centred with the style credits: which pass, not whether)'},
 pullPressed:{v:.4,unit:'A',kind:'optionCreditByTarget',at:['team-approach.ts:187 (PIVOT_PRESSED)'],says:'... plus this times the passer\'s felt pressure (re-centred too)'},
} satisfies Record<string,Effect<unknown>>;
/** In behind: the post on the last defender's shoulder and the run beyond him. */
export const IN_BEHIND={
 gap:{v:6,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:307 (RUN_GAP)'],says:'between runs he waits this far in front of their deepest outfielder'},
 past:{v:3,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:307 (RUN_PAST)'],says:'his run aims this far beyond that defender'},
 channel:{v:2.5,unit:'m',kind:'fixedPost',axis:'W',at:['practice-coordination.ts:307 (RUN_CHANNEL)'],says:'the channel off the nearest back-line defender\'s shoulder'},
 width:{v:6.5,unit:'m',kind:'fixedPost',axis:'W',at:['practice-coordination.ts:307 (RUN_WIDTH)'],says:'within this of the centre'},
 room:{v:9,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:307 (RUN_ROOM)'],says:'no run when their line is less than this from their goal'},
 hold:{v:.8,unit:'B',kind:'fixedPost',at:['practice-coordination.ts:307 (RUN_HOLD)'],says:'his shoulder post\'s job score'},
 fit:{v:.5,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:307 (RUN_FIT)'],says:'his run\'s fit per unit of the runs trait'},
 line:{v:4,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:307 (RUN_LINE)'],says:'back-line defenders: within this of the deepest'},
 alsoTakes:{v:['give-and-go','near-post','far-post','break','link'] as string[],unit:'flag',kind:'jobOffered',at:['practice-coordination.ts:308 (RUN_ALSO)'],says:'the only other jobs he still takes'},
 depthBonus:{v:.3,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:990'],says:'the team\'s run in behind: extra fit for him'},
} satisfies Record<string,Effect<unknown>>;
/** Drops deep: the false nine's post between their lines and the run beyond him. */
export const DROPS_DEEP={
 gap:{v:5,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:324 (LINK_GAP)'],says:'he stands this far in front of their deepest outfielder'},
 show:{v:4.5,unit:'m',kind:'fixedPost',axis:'body',at:['practice-coordination.ts:324 (LINK_SHOW)'],says:'he comes this far toward the ball when the lane is open'},
 hold:{v:1,unit:'B',kind:'fixedPost',at:['practice-coordination.ts:324 (LINK_HOLD)'],says:'his post\'s job score'},
 beyond:{v:6,unit:'m',kind:'jobOffered',axis:'L',at:['practice-coordination.ts:324 (LINK_BEYOND)'],says:'the run beyond him aims this far past him'},
 wide:{v:Y(8),unit:'m',kind:'jobOffered',axis:'W',at:['practice-coordination.ts:324 (LINK_WIDE)'],says:'... either side of him'},
 alsoTakes:{v:['give-and-go','break','cutback'] as string[],unit:'flag',kind:'jobOffered',at:['practice-coordination.ts:325 (LINK_ALSO)'],says:'the only other jobs he takes (no post arrivals)'},
} satisfies Record<string,Effect<unknown>>;
/** Who carries the Striker setting: the lead forward, and when he changes. */
export const STRIKER_COMMON={
 leadMargin:{v:2,unit:'m',kind:'fixedPost',axis:'L',at:['practice-coordination.ts:236 (LEAD_FORWARD_MARGIN)'],says:'a challenger takes the role only this far further forward ...'},
 leadHold:{v:1.5,unit:'s',kind:'fixedPost',at:['practice-coordination.ts:236 (LEAD_FORWARD_HOLD)'],says:'... for this long'},
} as const satisfies Record<string,Effect>;

// ------------------------------------------------------------------ On winning it (transition: S10)
/** One entry per option. `transition` is OPTIONAL in Tactics: a missing value plays as Balanced at every read site,
 * so sites read S.ON_WIN[t.transition??'balanced']. */
export interface OnWinOption{
 counterRewrite:Effect<boolean>;secureRewrite:Effect<boolean>;counterNeed:Effect;counterRestMax:Effect;
 breakTaxed:Effect<boolean>;breakFit:Effect;breakOpenness:Effect;
}
const onWinOption=(o:{counterRewrite:boolean;secureRewrite:boolean;counterNeed:number;counterRestMax:number;breakTaxed:boolean;breakFit:number;breakOpenness:number}):OnWinOption=>({
 counterRewrite:{v:o.counterRewrite,unit:'flag',kind:'triggerWindow',at:['team-approach.ts:41 (approachInPossession)','team-approach.ts:115 (approachForSituation)'],says:'after a regain the team plays the Counter rewrite (REWRITES.counter)'},
 secureRewrite:{v:o.secureRewrite,unit:'flag',kind:'triggerWindow',at:['team-approach.ts:42'],says:'after every regain the team plays the Keep it rewrite (REWRITES.secure)'},
 counterNeed:{v:o.counterNeed,unit:'men',kind:'triggerWindow',at:['team-approach.ts:73'],says:'a counter is on with at least this many more of ours than theirs (-1: even one short)'},
 counterRestMax:{v:o.counterRestMax,unit:'men',kind:'triggerWindow',at:['team-approach.ts:74'],says:'... and at most this many in their rest defence'},
 breakTaxed:{v:o.breakTaxed,unit:'flag',kind:'jobCredit',at:['practice-coordination.ts:223'],says:'a break counts as bypassing for Patient\'s run tax (Keep it waives it: plan 6.2)'},
 breakFit:{v:o.breakFit,unit:'B',kind:'jobCredit',at:['practice-coordination.ts:904'],says:'the break job\'s base fit'},
 breakOpenness:{v:o.breakOpenness,unit:'trait',kind:'jobOffered',at:['practice-transition.ts:65'],says:'the race read a break needs before it is offered'},
});
/** On winning it. Values exactly as the code had them at b107e7b2. */
export const ON_WIN:Readonly<Record<NonNullable<Tactics['transition']>,OnWinOption>>={
 balanced:onWinOption({counterRewrite:false,secureRewrite:false,counterNeed:0,counterRestMax:2,breakTaxed:true,breakFit:.9,breakOpenness:.65}),
 secure:onWinOption({counterRewrite:false,secureRewrite:true,counterNeed:1,counterRestMax:2,breakTaxed:false,breakFit:.9,breakOpenness:.85}),
 counter:onWinOption({counterRewrite:true,secureRewrite:false,counterNeed:-1,counterRestMax:3,breakTaxed:true,breakFit:1.25,breakOpenness:.42}),
};
/** The two situation rewrites of approachInPossession, in the order the code tries them (Counter first, then Keep it).
 * Hidden from the board (plan 6.2); mirrored exactly. */
export const REWRITES={
 counter:{
  window:{v:8,unit:'s',kind:'triggerWindow',at:['team-approach.ts:41'],says:'for this long after a regain'},
  progression:{v:'direct' as const,unit:'flag',kind:'triggerWindow',at:['team-approach.ts:41'],says:'plays Direct'},
  keepStriker:{v:['pivot','link'] as string[],unit:'flag',kind:'triggerWindow',at:['team-approach.ts:41'],says:'a Pivot or Drops deep striker keeps his own job ...'},
  striker:{v:'run' as const,unit:'flag',kind:'triggerWindow',at:['team-approach.ts:41'],says:'... any other plays In behind'},
  commitAtLeast:{v:4,unit:'count',kind:'triggerWindow',at:['team-approach.ts:41'],says:'Bodies forward at least this'},
 },
 secure:{
  window:{v:3,unit:'s',kind:'triggerWindow',at:['team-approach.ts:42'],says:'for this long after every regain'},
  progression:{v:'patient' as const,unit:'flag',kind:'triggerWindow',at:['team-approach.ts:42'],says:'plays Patient'},
 },
};
/** On winning it's shared clock and reads. */
export const ON_WIN_COMMON={
 counterWindow:{v:10,unit:'s',kind:'triggerWindow',at:['team-approach.ts:69 (COUNTER_WINDOW)'],says:'a counter can be on this long after a recovery'},
 counterFlip:{v:8,unit:'s',kind:'triggerWindow',at:['team-approach.ts:112 (COUNTER_FLIP)'],says:'Counter\'s situation rewrite applies this long (same value as REWRITES.counter.window, a separate read)'},
 winnerSpread:{v:.5,unit:'trait',kind:'triggerWindow',at:['practice-coordination.ts:332 (WINNER_SPREAD)'],says:'how noisy the lead forward\'s read of a free ball-winner is in Counter\'s window'},
} as const satisfies Record<string,Effect>;

// ------------------------------------------------------------------ On losing it (onLoss: S11)
/** One entry per option. `onLoss` is OPTIONAL: a missing value plays as Balanced at every read site (the coordinator
 * already reads tactics.onLoss??'balanced'), so sites read S.ON_LOSS[onLoss??'balanced']. */
export interface OnLossOption{regroups:Effect<boolean>;goesAlways:Effect<boolean>}
const onLossOption=(o:{regroups:boolean;goesAlways:boolean}):OnLossOption=>({
 regroups:{v:o.regroups,unit:'flag',kind:'triggerWindow',at:['practice-coordination.ts:154','practice-coordination.ts:166','practice-coordination.ts:516','practice-coordination.ts:527'],says:'Regroup (retired from the board, still played): nobody engages; the nearest man delays and the others drop behind the ball'},
 goesAlways:{v:o.goesAlways,unit:'flag',kind:'triggerWindow',at:['practice-coordination.ts:155','practice-coordination.ts:168'],says:'the nearest man goes whatever the numbers (otherwise he goes with a man over, by his own read)'},
});
/** On losing it. Values exactly as the code had them at b107e7b2. */
export const ON_LOSS:Readonly<Record<NonNullable<Tactics['onLoss']>,OnLossOption>>={
 regroup:onLossOption({regroups:true,goesAlways:false}),
 balanced:onLossOption({regroups:false,goesAlways:false}),
 counterpress:onLossOption({regroups:false,goesAlways:true}),
};
/** The counter-press and Regroup mechanics shared by every option. */
export const ON_LOSS_COMMON={
 window:{v:3,unit:'s',kind:'triggerWindow',at:['practice-coordination.ts:135 (COUNTER_PRESS_WINDOW)'],says:'the first seconds after a loss that "On losing it" governs'},
 near:{v:8,unit:'m',kind:'triggerWindow',axis:'body',at:['practice-coordination.ts:135 (COUNTER_PRESS_NEAR)'],says:'men within this of the ball are counted, ours and theirs'},
 zone:{v:10,unit:'m',kind:'triggerWindow',axis:'body',at:['practice-coordination.ts:135 (COUNTER_PRESS_ZONE)'],says:'it ends once the ball is carried this far from where it was lost'},
 own:{v:16,unit:'m',kind:'triggerWindow',axis:'L',at:['practice-coordination.ts:137 (COUNTER_PRESS_OWN)'],says:'no counter-press nor Regroup drop for a ball lost within this of our goal line'},
 goerReach:{v:4,unit:'m',kind:'triggerWindow',axis:'body',at:['practice-coordination.ts:522','practice-coordination.ts:588'],says:'the goer comes from within near plus this'},
 numbersSpread:{v:1.5,unit:'men',kind:'triggerWindow',at:['practice-coordination.ts:164 (NUMBERS_SPREAD)'],says:'how many men a player who cannot read the game miscounts'},
 eagerMen:{v:3,unit:'men',kind:'triggerWindow',at:['practice-coordination.ts:164 (EAGER_MEN)'],says:'how far an eager, undisciplined player leans on the count'},
 readThreshold:{v:-.5,unit:'men',kind:'triggerWindow',at:['practice-coordination.ts:171'],says:'he goes when the margin he sees is at least this'},
 goerPressesAs:{v:'aggressive' as const,unit:'flag',kind:'traitOverride',at:['practice-coordination.ts:599'],says:'the goer (counter-press or trap) presses as hard as Aggressive; the rest decide around him'},
 regroupBehind:{v:5,unit:'m',kind:'positionOffset',axis:'L',at:['practice-defending.ts:240 (REGROUP_BEHIND)'],says:'Regroup: the others drop this far behind the ball'},
 regroupNarrow:{v:.7,unit:'x',kind:'positionOffset',axis:'W',at:['practice-defending.ts:1310','practice-defending.ts:1446'],says:'Regroup: a dropping man\'s width is scaled by this'},
 dropPace:{v:.35,unit:'x',kind:'multiplier',at:['practice-defending.ts:1447'],says:'Regroup: a loose player runs back up to this share slower'},
 dropDiscipline:{v:.9,unit:'trait',kind:'multiplier',at:['practice-defending.ts:1447'],says:'... measured from this much team-following'},
 dropFloor:{v:.75,unit:'x',kind:'multiplier',at:['practice-defending.ts:1447'],says:'... and never below this share of his pace'},
};

// ------------------------------------------------------------------ Free kicks (setPiece: S12)
/** One entry per call. `setPiece` is required in Tactics, but freeKickOptions takes its tactics optionally and the restart
 * helpers default their `call` to 'mixed': every site reads S.FREE_KICK[call??'mixed'], which is what each did with
 * nothing passed. Ballers sends Mixed unless the match settings call Short or Into the box (plan 6.2). */
export interface FreeKickOption{callsShort:Effect<boolean>;callsDelivery:Effect<boolean>;callsRoutine:Effect<boolean>;shotCost:Effect}
const freeKickOption=(o:{callsShort:boolean;callsDelivery:boolean;callsRoutine:boolean;shotCost:number}):FreeKickOption=>({
 callsShort:{v:o.callsShort,unit:'flag',kind:'optionCreditByFeature',at:['practice-set-pieces.ts:122','practice-set-pieces.ts:123','practice-restart-live.ts:173'],says:'Short: the taker leans to a short ball; the routine offers a short man at another angle'},
 callsDelivery:{v:o.callsDelivery,unit:'flag',kind:'optionCreditByFeature',at:['practice-set-pieces.ts:122','practice-set-pieces.ts:123','practice-restarts.ts:99','practice-restarts.ts:340'],says:'Into the box: the taker leans to a delivery; the routine sets men in the box and waits for them'},
 callsRoutine:{v:o.callsRoutine,unit:'flag',kind:'arrangementConstraint',at:['practice.ts:690','practice-restarts.ts:91','practice-restart-live.ts:172'],says:'a called routine is laid out in their half (the edge man waits for the knock-down)'},
 shotCost:{v:o.shotCost,unit:'A',kind:'situationalOptionCost',at:['practice-set-pieces.ts:130'],says:'a direct shot costs this under the call'},
});
/** Free kicks. Values exactly as the code had them at b107e7b2. */
export const FREE_KICK:Readonly<Record<Tactics['setPiece'],FreeKickOption>>={
 mixed:freeKickOption({callsShort:false,callsDelivery:false,callsRoutine:false,shotCost:0}),
 short:freeKickOption({callsShort:true,callsDelivery:false,callsRoutine:true,shotCost:.035}),
 delivery:freeKickOption({callsShort:false,callsDelivery:true,callsRoutine:true,shotCost:0}),
};
/** The call's lean and the called routine's spots (depths from L, or from L-BOX_DEPTH for the edge; y across). */
export const FREE_KICK_COMMON={
 lean:{v:.2,unit:'A',kind:'optionCreditByFeature',at:['practice-set-pieces.ts:31 (FK_LEAN)'],says:'the called kick gains this ...'},
 contest:{v:.6,unit:'A',kind:'optionCreditByFeature',at:['practice-set-pieces.ts:31 (FK_CONTEST)'],says:'... plus this times its risk (a header fought for in the box is the point)'},
 planB:{v:.15,unit:'A',kind:'situationalOptionCost',at:['practice-set-pieces.ts:31 (FK_PLAN_B)'],says:'the other call\'s kick costs this'},
 nearDepth:{v:2.5,unit:'m',kind:'positionOffset',axis:'L',at:['practice-restarts.ts:88 (FK_NEAR)'],says:'Into the box: near-post header, this short of their goal line'},
 nearY:{v:2,unit:'m',kind:'positionOffset',axis:'W',at:['practice-restarts.ts:88 (FK_NEAR)'],says:'... this across, ball side'},
 farDepth:{v:3.5,unit:'m',kind:'positionOffset',axis:'L',at:['practice-restarts.ts:88 (FK_FAR)'],says:'far-post header, this short of their goal line'},
 farY:{v:4,unit:'m',kind:'positionOffset',axis:'W',at:['practice-restarts.ts:88 (FK_FAR)'],says:'... this across, far side'},
 edgeDepth:{v:1.5,unit:'m',kind:'positionOffset',axis:'L',at:['practice-restarts.ts:88 (FK_EDGE)'],says:'the edge man, this outside their box'},
 edgeY:{v:2,unit:'m',kind:'positionOffset',axis:'W',at:['practice-restarts.ts:88 (FK_EDGE)'],says:'... this across'},
 shortSquare:{v:6,unit:'m',kind:'positionOffset',axis:'W',at:['practice-restarts.ts:88 (FK_SHORT_SQUARE)'],says:'Short: the square man, this across from the ball'},
 shortBackDepth:{v:7,unit:'m',kind:'positionOffset',axis:'L',at:['practice-restarts.ts:88 (FK_SHORT_BACK)'],says:'Short: the man behind, this far back ...'},
 shortBackY:{v:3,unit:'m',kind:'positionOffset',axis:'W',at:['practice-restarts.ts:88 (FK_SHORT_BACK)'],says:'... and this across'},
 boxDepth:{v:3,unit:'m',kind:'positionOffset',axis:'L',at:['practice-restarts.ts:88 (FK_BOX)'],says:'Short: the man in the box, this short of their goal line'},
 boxY:{v:2,unit:'m',kind:'positionOffset',axis:'W',at:['practice-restarts.ts:88 (FK_BOX)'],says:'... this across'},
} as const satisfies Record<string,Effect>;

// ------------------------------------------------------------------ Marking and Fullbacks (S13: fields Ballers fixes)
/** Marking and Fullbacks are not on the Ballers board: lib/ballers/compute.ts engineTeam always sends 'balanced'
 * (plan 6.2), but the engine plays every option (and the standing 'mark' instruction calls the tight marking spot).
 * Both fields are OPTIONAL; a missing value plays as Balanced at every read site. */
export interface MarkingOption{keep:Effect;markGap:Effect;cushion:Effect;sag:Effect;threatFloor:Effect<boolean>;spotGap:Effect;spotScreen:Effect}
const markingOption=(o:{keep:number;markGap:number;cushion:number;sag:number;threatFloor:boolean;spotGap:number;spotScreen:number}):MarkingOption=>({
 keep:{v:o.keep,unit:'B',kind:'defendingThreshold',at:['practice-defending.ts:509 (KEEP)'],says:'how strongly a marker keeps his man'},
 markGap:{v:o.markGap,unit:'m',kind:'positionOffset',axis:'body',at:['practice-defending.ts:807','practice-defending.ts:810 (MARK_GAP)'],says:'the marking distance'},
 cushion:{v:o.cushion,unit:'x',kind:'multiplier',at:['practice-defending.ts:807 (CUSHION_MARKING)'],says:'how much that distance grows with a quicker or far man'},
 sag:{v:o.sag,unit:'x',kind:'multiplier',at:['practice-defending.ts:726 (SAG)'],says:'how far a marker may sag off his man'},
 threatFloor:{v:o.threatFloor,unit:'flag',kind:'defendingThreshold',at:['practice-defending.ts:390'],says:'a picked-up man\'s weight never drops below his base (tight marking)'},
 spotGap:{v:o.spotGap,unit:'m',kind:'positionOffset',axis:'body',at:['practice-football.ts:132 (markPosition)'],says:'the marking spot: this far goal-side of the man'},
 spotScreen:{v:o.spotScreen,unit:'m',kind:'positionOffset',axis:'body',at:['practice-football.ts:132 (markPosition)'],says:'... and this far toward the ball'},
});
/** Marking. Keys in practice-defending.ts's own order (tight, balanced, zonal). */
export const MARKING:Readonly<Record<NonNullable<Tactics['marking']>,MarkingOption>>={
 tight:markingOption({keep:2.5,markGap:.8,cushion:.3,sag:.4,threatFloor:true,spotGap:.95,spotScreen:.4}),
 balanced:markingOption({keep:1.5,markGap:1,cushion:1,sag:1,threatFloor:false,spotGap:1.4,spotScreen:.65}),
 zonal:markingOption({keep:.8,markGap:1.4,cushion:1.2,sag:1.25,threatFloor:false,spotGap:1.4,spotScreen:.65}),
};
export interface FullbacksOption{attackValue:Effect;staysBack:Effect<boolean>;overlaps:Effect<boolean>;overlapStep:Effect}
const fullbacksOption=(o:{attackValue:number;staysBack:boolean;overlaps:boolean;overlapStep:number}):FullbacksOption=>({
 attackValue:{v:o.attackValue,unit:'x',kind:'multiplier',at:['practice-attacking-space.ts:97'],says:'a fullback\'s attacking-space value'},
 staysBack:{v:o.staysBack,unit:'flag',kind:'jobOffered',at:['practice-coordination.ts:991','practice-coordination.ts:998','practice-shape.ts:162','practice-shape.ts:163'],says:'fullbacks hold: no overlap, no outlet ahead of the ball, a covering shape slot'},
 overlaps:{v:o.overlaps,unit:'flag',kind:'jobOffered',at:['practice-coordination.ts:991'],says:'the overlap is offered whatever Bodies forward says'},
 overlapStep:{v:o.overlapStep,unit:'m',kind:'positionOffset',axis:'L',at:['practice-shape.ts:162'],says:'the fullback\'s shape slot steps this much higher'},
});
/** Fullbacks (only formations with FB roles have fullbacks; the five-a-side shapes have none: plan 6.3). */
export const FULLBACKS:Readonly<Record<NonNullable<Tactics['fullbacks']>,FullbacksOption>>={
 balanced:fullbacksOption({attackValue:.5,staysBack:false,overlaps:false,overlapStep:0}),
 overlap:fullbacksOption({attackValue:.5,staysBack:false,overlaps:true,overlapStep:3}),
 hold:fullbacksOption({attackValue:.2,staysBack:true,overlaps:false,overlapStep:0}),
};
export const FULLBACKS_COMMON={
 holdBack:{v:5,unit:'m',kind:'positionOffset',axis:'L',at:['practice-shape.ts:162'],says:'a holding fullback\'s shape slot: this far above the back line'},
} as const satisfies Record<string,Effect>;

// ------------------------------------------------------------------ views (old names survive, rule 1.3.6)
type Scalar<O>={[K in keyof O]:O[K] extends Effect<infer V>?K:never}[keyof O];
/** {option: entry.v} for one scalar effect, keys in the table's own order. */
export function view<O,K extends Scalar<O>,T extends string>(table:Readonly<Record<T,O>>,key:K):Record<T,O[K] extends Effect<infer V>?V:never>{
 const out={} as Record<T,O[K] extends Effect<infer V>?V:never>;
 for(const k of Object.keys(table) as T[])(out as any)[k]=((table[k] as any)[key] as Effect<unknown>).v;
 return out;
}
/** The Line block as practice-defending.ts BLOCK has always had it: {gap, floor, ceiling, squeeze} per option. */
export function blockView():Record<Tactics['line'],{gap:number;floor:number;ceiling:number;squeeze:number}>{
 const out={} as Record<Tactics['line'],{gap:number;floor:number;ceiling:number;squeeze:number}>;
 for(const k of Object.keys(LINE) as Tactics['line'][]){const b=LINE[k].block;out[k]={gap:b.gap.v,floor:b.floor.v,ceiling:b.ceiling.v,squeeze:b.squeeze.v};}
 return out;
}
/** {option: {key: entry.v, ...}} for several scalar effects at once, keys in the order given (e.g. practice-shape.ts WIDTH). */
export function objView<O,K extends Scalar<O>,T extends string>(table:Readonly<Record<T,O>>,keys:readonly K[]):Record<T,{[P in K]:O[P] extends Effect<infer V>?V:never}>{
 const out={} as Record<T,{[P in K]:O[P] extends Effect<infer V>?V:never}>;
 for(const k of Object.keys(table) as T[]){const o:any={};for(const key of keys)o[key]=((table[k] as any)[key] as Effect<unknown>).v;(out as any)[k]=o;}
 return out;
}
/** Width's 2-1-1 spread as buildUpSpread has always returned it: {backs, middle} per option. */
export function spreadView():Record<'narrow'|'standard'|'wide',{backs:number;middle:number}>{
 const out={} as Record<'narrow'|'standard'|'wide',{backs:number;middle:number}>;
 for(const k of Object.keys(WIDTH) as ('narrow'|'standard'|'wide')[])out[k]={backs:WIDTH[k].spread.backs.v,middle:WIDTH[k].spread.middle.v};
 return out;
}
