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
