/** Every setting option as data (engine as data, deliverables/ballers-engine/ENGINE-AS-DATA-PLAN.md section 1).
 * Each entry is one effect: the exact value the code uses (`v`), its unit, the kind of effect, the pitch axis it is
 * tied to (recorded only; nothing applies it), the lines that read it, and one plain line of what it does.
 * Rules (plan 1.3): a value is the literal the code had, or the same expression evaluated the same way (`X(57)` stays
 * `X(57)`, computed at load); a formula stays a formula with its coefficients named here; old exported tables survive
 * as views with the same keys in the same order. Engine files import this module as a namespace (`import * as S`).
 * Runtime imports: pitch.ts only (a leaf), so this module can never sit in an import cycle. */
import {X,Y} from './pitch.js';
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
