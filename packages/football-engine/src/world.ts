/** The world as data (engine as data, slice 2: deliverables/ballers-engine/ENGINE-AS-DATA-PLAN.md section 2).
 * Every entry is one number the engine used to type inline: its exact literal (`v`, the very text the code had), its
 * unit, its class (`kind`: body never scales with the pitch, geometry is tied to the pitch or the goal, free is a share,
 * weight or score), the pitch axis it is tied to (recorded only, nothing applies it), where the engine reads it, and one
 * plain line of what it is (from the code's own comment where it had one).
 * The engine reads `WORLD.<family>.<area>.<name>.v` where the literal stood, or keeps its old constant as a view of it;
 * every expression around a read is unchanged (a formula stays code, its coefficients live here).
 * Imports nothing, so it can never sit in an import cycle. Frozen.
 * Generated during slice 2 by evidence/2026-10-21-engine-as-data/worldmove.mjs from world-registry.json (one record per
 * entry, with the step that moved it). */

/** The unit of an entry, as the code uses it. Never converted. */
export type Unit='Hz'|'m'|'min'|'ref m'|'s';
/** body: never scales with the pitch; geometry: tied to the pitch or the goal; free: a share, weight, odds or score. */
export type Kind='body'|'geometry'|'free';
/** The pitch probe's axis (L along the pitch or a radius from a goal, W across, G the goal mouth, A the goal angle). Recorded only. */
export type Axis='L'|'W'|'G'|'A'|'LW'|'LG'|'GL'|'LGW'|'body'|'none';
/** One world number. `at`: where the engine reads it (file:line at the step that moved it). */
export interface WorldParam{readonly v:number;readonly unit:Unit;readonly kind:Kind;readonly axis?:Axis;readonly at:readonly string[];readonly says:string}
const p=(v:number,unit:Unit,kind:Kind,at:readonly string[],says:string,axis?:Axis):WorldParam=>axis===undefined?{v,unit,kind,at,says}:{v,unit,kind,axis,at,says};
function freeze<T>(o:T):T{if(o&&typeof o==='object'){for(const k of Object.keys(o))freeze((o as Record<string,unknown>)[k]);Object.freeze(o);}return o;}

export const WORLD=freeze({
 /** the simulation clock and the match lengths */
 clock:{
  sim:{
   ticksPerSecond:p(60,'Hz','free',['movement.ts:5','practice-control.ts:543'],'simulation ticks per second (STEP = 1/60 s)'),
  },
  match:{
   MATCH_LENGTHS:{
    five:p(300,'s','free',['practice-match.ts:7'],'the three standard match lengths (5, 15 and 90 minutes); read nowhere in the engine (only by the unused type MatchLength), any duration from 10 to 5400 s is accepted'),
    fifteen:p(900,'s','free',['practice-match.ts:7'],'the three standard match lengths (5, 15 and 90 minutes); read nowhere in the engine (only by the unused type MatchLength), any duration from 10 to 5400 s is accepted'),
    ninety:p(5400,'s','free',['practice-match.ts:7'],'the three standard match lengths (5, 15 and 90 minutes); read nowhere in the engine (only by the unused type MatchLength), any duration from 10 to 5400 s is accepted'),
   },
   HALF_SECONDS:p(2700,'s','free',['practice-match.ts:9'],'half-time comes at this second in matches longer than it (a 90-minute match)'),
   SUB_MINUTES:{
    first:p(60,'min','free',['practice-match.ts:10'],'the match minutes of the planned substitutions (options.substitutions planned)'),
    second:p(70,'min','free',['practice-match.ts:10'],'the match minutes of the planned substitutions (options.substitutions planned)'),
    third:p(80,'min','free',['practice-match.ts:10'],'the match minutes of the planned substitutions (options.substitutions planned)'),
   },
   LAST_ATTACK_MAX:p(20,'s','free',['practice-match.ts:32'],'full time plays out the last attack, never more than this past the clock'),
  },
 },
 /** the pitch core: length, width, goal, box, spot, the 105x68 reference the X() / Y() / G() helpers scale from */
 pitch:{
  core:{
   length:p(48,'m','geometry',['pitch.ts:3'],'pitch length, goal line to goal line','L'),
   width:p(30,'m','geometry',['pitch.ts:3'],'pitch width, touchline to touchline','W'),
   goalHalf:p(2.5,'m','geometry',['pitch.ts:3'],'half the goal width (the goal is 5 m wide)','G'),
   goalHeight:p(2,'m','body',['pitch.ts:3'],'goal height (the probe\'s decision: a body measure, it never scales with the pitch)','body'),
   boxDepth:p(8,'m','geometry',['pitch.ts:3'],'penalty area depth from the goal line','L'),
   boxHalf:p(8,'m','geometry',['pitch.ts:3'],'half the penalty area width','W'),
   spot:p(6,'m','geometry',['pitch.ts:3'],'penalty spot distance from the goal line','L'),
   shape:{
    goalDepth:p(1.5,'m','body',['pitch.ts:7'],'goal depth behind the line (the net)','body'),
    goalAreaDepth:p(3,'m','geometry',['pitch.ts:7'],'goal area depth','L'),
    goalAreaWidth:p(9,'m','geometry',['pitch.ts:7'],'goal area width','W'),
    restartRadius:p(5,'m','body',['pitch.ts:7'],'restart radius (exported, imported nowhere in the engine)','body'),
   },
  },
  reference:{
   length:p(105,'ref m','geometry',['pitch.ts:4'],'the 105 m reference pitch length X() scales from (X(r) = r*L/105)','L'),
   width:p(68,'ref m','geometry',['pitch.ts:5'],'the 68 m reference pitch width Y() scales from (Y(r) = r*W/68)','W'),
   goalHalf:p(3.66,'ref m','geometry',['pitch.ts:6','practice-defending.ts:911'],'the 3.66 m reference half-goal G() scales from (G(r) = r*GH/3.66)','G'),
  },
 },
});
export type World=typeof WORLD;
