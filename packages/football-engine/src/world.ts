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
export type Unit='Hz'|'m'|'min'|'rad'|'ref m'|'s';
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
 /** pitch-tied literals (the pitch probe's class (c) entries): depths and radii from a goal, lanes and wide thresholds, goal-mouth thresholds, each tagged with its axis L / W / G (recorded, never applied) */
 geometry:{
  defending:{
   CENTRAL:p(3,'m','geometry',['practice-defending.ts:81'],'... and CENTRAL m further for a central man (|y| under 3 m, fading out by 9 m): the middle is where goals come from.','L'),
   AHEAD_R:p(5,'m','geometry',['practice-defending.ts:83'],'A man ahead of the ball (nearer our goal than it by AHEAD m) matters out to DANGER_R + AHEAD_R.','L'),
   RUN_R:p(9,'m','geometry',['practice-defending.ts:85'],'A runner (RUN_GOALWARD m/s at our goal, as seen) matters out to DANGER_R + RUN_R, read RUN_LEAD s ahead.','L'),
   BEHIND_R:p(4,'m','geometry',['practice-defending.ts:96'],'A wide man (|y| > BEHIND_WIDE) BEHIND m behind the ball (further from our goal than it) matters by distance only within DANGER_R - BEHIND_R: out there he is no threat to the goal until the ball comes back to him. (A central one is the ...','L'),
   BEHIND_WIDE:p(6,'m','geometry',['practice-defending.ts:96'],'A wide man (|y| > BEHIND_WIDE) BEHIND m behind the ball (further from our goal than it) matters by distance only within DANGER_R - BEHIND_R: out there he is no threat to the goal until the ball comes back to him. (A central one is the ...','W'),
   SPARE_BEHIND:p(5,'m','geometry',['practice-defending.ts:98'],'Their spare man: SPARE_BEHIND m behind the ball (further from our goal) and outside DANGER_R + SPARE_R. Unmarked.','L'),
   SPARE_R:p(2,'m','geometry',['practice-defending.ts:98'],'Their spare man: SPARE_BEHIND m behind the ball (further from our goal) and outside DANGER_R + SPARE_R. Unmarked.','L'),
   KEEP_MATTER:p(3,'m','geometry',['practice-defending.ts:104'],'His own man keeps mattering a little longer (hysteresis, m).','L'),
   CLEAR_R:p(24,'m','geometry',['practice-defending.ts:149'],'A clear run at goal: the carrier within CLEAR_R m of our goal (CLEAR_R_RUN m running at it) with nobody of ours in his path (CLEAR_W m either side of it, widening CLEAR_W_GROW per m towards the goal); seen ...','L'),
   CLEAR_R_RUN:p(32,'m','geometry',['practice-defending.ts:149'],'A clear run at goal: the carrier within CLEAR_R m of our goal (CLEAR_R_RUN m running at it) with nobody of ours in his path (CLEAR_W m either side of it, widening CLEAR_W_GROW per m towards the goal); seen ...','L'),
   NEAR_BLOCK:p(14,'m','geometry',['practice-defending.ts:151'],'Near our goal (the man on the ball within NEAR_BLOCK m) the presser must be the block: goal-side of him within BLOCK_REACH m, or a team-mate who is steps in.','L'),
   NEAR_GOAL:p(16,'m','geometry',['practice-defending.ts:155'],'Tight: within ONE_PASS m of the ball, fully loose beyond ONE_PASS_FAR; or within NEAR_GOAL m of goal (to NEAR_GOAL_FAR).','L'),
   NEAR_GOAL_FAR:p(20,'m','geometry',['practice-defending.ts:155'],'Tight: within ONE_PASS m of the ball, fully loose beyond ONE_PASS_FAR; or within NEAR_GOAL m of goal (to NEAR_GOAL_FAR).','L'),
   FAR_CUSHION:{
    from:p(15,'m','geometry',['practice-defending.ts:159'],'The marking distance grows with the man\'s distance from our goal: from `from` m, `rate` m per m, up to `max`.','L'),
   },
   COVER_DROP_WIDE:p(4,'m','geometry',['practice-defending.ts:185'],'the cover drops inside a man wider than this (|y|), else away from his marker or the ball','W'),
   COVER_DROP_FAR:p(1,'m','geometry',['practice-defending.ts:186'],'(cover-defender round, 2026-10-10) The free man\'s first duty is a man ahead of the ball within COVER_DROP_R m of our goal (by the Line), marked or not: futsal\'s second defender. He drops to a diagonal cover spot: COVER_DROP_DEEP m ...','L'),
   COVER_DROP_FREE:p(3,'m','geometry',['practice-defending.ts:186'],'(cover-defender round, 2026-10-10) The free man\'s first duty is a man ahead of the ball within COVER_DROP_R m of our goal (by the Line), marked or not: futsal\'s second defender. He drops to a diagonal cover spot: COVER_DROP_DEEP m ...','L'),
   COVER_DROP_KEEP:p(1.5,'m','geometry',['practice-defending.ts:186'],'(cover-defender round, 2026-10-10) The free man\'s first duty is a man ahead of the ball within COVER_DROP_R m of our goal (by the Line), marked or not: futsal\'s second defender. He drops to a diagonal cover spot: COVER_DROP_DEEP m ...','L'),
   COVER_DROP_THREAT:p(20,'m','geometry',['practice-defending.ts:188'],'(threat round) the cover\'s man: the most threatening of those he could cover, COVER_DROP_THREAT m nearer per unit of threat','L'),
   SCREEN_OFF:p(7,'m','geometry',['practice-defending.ts:235'],'Spacing between free defenders\' spots (m).','L'),
   EDGE:p(3,'m','geometry',['practice-defending.ts:351'],'The soft edge of "matters" (m either side of the radius).','L'),
   centralFrom:p(3,'m','geometry',['practice-defending.ts:368'],'who matters: the CENTRAL extra radius is whole for a man within this of the centre line','G'),
   centralFade:p(6,'m','geometry',['practice-defending.ts:368'],'... and fades out over this much more (gone by 9 m)','G'),
   closeOut:p(6,'m','geometry',['practice-defending.ts:369'],'a danger man\'s weight: whole within R - 6 of our goal, nothing beyond R + this','L'),
   closeSpan:p(12,'m','geometry',['practice-defending.ts:369'],'... over this span','L'),
   closeWideFrom:p(5,'m','geometry',['practice-defending.ts:369'],'... and less for a wide man: from this far off the centre line','W'),
   closeWideSpan:p(14,'m','geometry',['practice-defending.ts:369'],'... over this span (never under 0.4)','W'),
   SCREEN_UP:p(3,'m','geometry',['practice-defending.ts:465'],'(threat round: role awareness off the ball, the owner\'s addition) A SOFT preference, never an assignment. Each defender has a role depth (ROLE_DEPTH: 1 for a centre-back or fixo, 0 for a striker) and each job a depth (a man by how near ...','L'),
   jobDepthFrom:p(6,'m','geometry',['practice-defending.ts:467'],'a marking job\'s depth for the role tie-break: deepest for a man within this of our goal','L'),
   jobDepthSpan:p(16,'m','geometry',['practice-defending.ts:467'],'... shallowest this much further out','L'),
   coverFarFrom:p(40,'m','geometry',['practice-defending.ts:528'],'the cover matters less the further the ball is from our goal: whole at 25 m, least (0.3) from this','L'),
   coverFarSpan:p(15,'m','geometry',['practice-defending.ts:528'],'... over this span','L'),
   ballDepthFrom:p(8,'m','geometry',['practice-defending.ts:574'],'the ball job\'s depth for the role tie-break: deepest for a carrier within this of our goal','L'),
   ballDepthSpan:p(24,'m','geometry',['practice-defending.ts:574'],'... shallowest this much further out','L'),
   HABIT_IN:p(16,'m','geometry',['practice-defending.ts:690'],'Marking and shape round (2026-10-10, evidence/2026-10-10-marking-shape). Near our goal (within HABIT_IN m, fading out by HABIT_FAR; a man running at goal RUN_HABIT m sooner) goal-side is a standing habit: - what he follows: his man\'s ...','L'),
   HABIT_FAR:p(22,'m','geometry',['practice-defending.ts:690'],'Marking and shape round (2026-10-10, evidence/2026-10-10-marking-shape). Near our goal (within HABIT_IN m, fading out by HABIT_FAR; a man running at goal RUN_HABIT m sooner) goal-side is a standing habit: - what he follows: his man\'s ...','L'),
   RUN_HABIT:p(4,'m','geometry',['practice-defending.ts:690'],'Marking and shape round (2026-10-10, evidence/2026-10-10-marking-shape). Near our goal (within HABIT_IN m, fading out by HABIT_FAR; a man running at goal RUN_HABIT m sooner) goal-side is a standing habit: - what he follows: his man\'s ...','L'),
   sagFarSide:p(8,'m','geometry',['practice-defending.ts:729'],'sagging off a far man: Width\'s sag applies to a man more than this across from the ball','W'),
   TIGHT_IN:p(14,'m','geometry',['practice-defending.ts:736'],'Near our goal (his man within TIGHT_IN m of the goal centre) the marker is tight: MARK_GAP, never more than TIGHT_MAX m, whatever the man\'s pace or distance; the cushions come back in over the next TIGHT_FADE m (defending-close round: ...','L'),
   TIGHT_FADE:p(4,'m','geometry',['practice-defending.ts:736'],'Near our goal (his man within TIGHT_IN m of the goal centre) the marker is tight: MARK_GAP, never more than TIGHT_MAX m, whatever the man\'s pace or distance; the cushions come back in over the next TIGHT_FADE m (defending-close round: ...','L'),
   HOLD_IN:p(12,'m','geometry',['practice-defending.ts:755'],'(threat round: goal-line fixes, the owner\'s addition) Near our goal (his man within HOLD_IN m of it) a marker holds the man in front of him with the keeper behind: never more than GOAL_HOLD m goal-side of where he reads the man going ...','L'),
   COVER_SINK:p(10,'m','geometry',['practice-defending.ts:755'],'(threat round: goal-line fixes, the owner\'s addition) Near our goal (his man within HOLD_IN m of it) a marker holds the man in front of him with the keeper behind: never more than GOAL_HOLD m goal-side of where he reads the man going ...','L'),
   showOutsideFrom:p(3,'m','geometry',['practice-defending.ts:816'],'a tight marker shows a man outside once he is this far off the centre line, near goal','G'),
   shadeFrom:p(8,'m','geometry',['practice-defending.ts:818'],'the marker\'s side shade fades out as the man nears our goal: none within this','L'),
   shadeSpan:p(6,'m','geometry',['practice-defending.ts:818'],'... whole this much further out','L'),
   PROTECT_FADE:p(4,'m','geometry',['practice-defending.ts:898'],'Box defending (2026-10-12, evidence/2026-10-12-box-defending). With the ball near our goal the defence protects the box, not only its men. Measured before (engine 3af89fa9): with their man on the ball within 10 m of our goal, only 1.5 ...','L'),
   PROTECT_SPREAD:p(1.2,'m','geometry',['practice-defending.ts:898'],'Box defending (2026-10-12, evidence/2026-10-12-box-defending). With the ball near our goal the defence protects the box, not only its men. Measured before (engine 3af89fa9): with their man on the ball within 10 m of our goal, only 1.5 ...','G'),
   openShotReach:p(45,'m','geometry',['practice-defending.ts:900'],'how good a shot from a spot looks: nearness falls off to nothing at this distance from goal (floor 0.05)','L'),
   stepInRange:p(28,'m','geometry',['practice-defending.ts:1101'],'a team-mate steps in for a beaten presser only with the carrier within this of our goal (or running at it)','L'),
   showFrom:p(2,'m','geometry',['practice-defending.ts:1131','practice-defending.ts:1137'],'the presser shows the carrier away from the middle once he is this far off the centre line','G'),
   showOut:p(10,'m','geometry',['practice-defending.ts:1131'],'... and further than this from our goal','L'),
   coverShotLine:p(14,'m','geometry',['practice-defending.ts:1197','practice-defending.ts:1216'],'the presser\'s cover: beyond this from our goal he stands behind his presser, within it on the shot line (its reason text reads the same threshold)','L'),
   coverDropReach:p(2,'m','geometry',['practice-defending.ts:1342'],'a man ahead of the ball is a cover-drop candidate out to the Line\'s cover-drop range plus this','L'),
   coverDropKeepReach:p(2,'m','geometry',['practice-defending.ts:1366'],'the cover keeps his man out to the Line\'s cover-drop range plus this (hysteresis)','L'),
  },
  defense:{
   COVER_NEAR:p(14,'m','geometry',['practice-defense.ts:167'],'Defending round (2026-10-03, step 1): the cover never stands on his own goal line. Away from goal he covers on the ball-goal line, 3.5-6.5 m behind the ball (further inside near a touchline). Near goal (the ball within COVER_NEAR m of ...','L'),
   COVER_CENTRAL:p(5,'m','geometry',['practice-defense.ts:167'],'Defending round (2026-10-03, step 1): the cover never stands on his own goal line. Away from goal he covers on the ball-goal line, 3.5-6.5 m behind the ball (further inside near a touchline). Near goal (the ball within COVER_NEAR m of ...','G'),
   coverNearOut:p(4,'m','geometry',['practice-defense.ts:177'],'the cover starts blending from his far spot to his near-goal spot this far beyond COVER_NEAR','L'),
   coverNearSpan:p(4,'m','geometry',['practice-defense.ts:177'],'... over this span (whole at COVER_NEAR)','L'),
   coverWideSpan:p(5,'m','geometry',['practice-defense.ts:186'],'near goal the cover moves from the shot line to the cut-back line as the ball goes wide: over this span beyond COVER_CENTRAL','G'),
   BLOCK_NEAR:p(12,'m','geometry',['practice-defense.ts:196'],'`intent` (after a loss, "On losing it"): \'delay\' keeps the first defender in front of the ball, goal-side, while the team drops into shape (Regroup); \'engage\' closes the ball down (a counter-press). A shot threat is always closed down.','L'),
   flightThreatRange:p(16,'m','geometry',['practice-defense.ts:304'],'assignFlight: an attacker within this of the defending goal is a threat the hunters must not leave','L'),
  },
  keeper:{
   ONE_ON_ONE:p(14,'m','geometry',['practice-keeper.ts:23'],'(keeper upgrade) How far out (m from his line) a carrier through on goal is met (keeperReadyPosition `oneOnOne`).','L'),
   closeFrom:p(12,'m','geometry',['practice-keeper.ts:35'],'keeper ready position: with an opponent carrying within this of his line he advances to meet him (the probe scales the whole advance with the goal, axis G)','L'),
   sweepRangePer:p(9,'m','geometry',['practice-keeper.ts:78'],'a sweep\'s range: the box edge plus 1 m plus this times keeperSweep','L'),
   homeOwnFrom:p(16,'m','geometry',['practice-keeper.ts:105'],'extra height off his line (keeperSweepDepth), our ball: starts with the ball this far out','L'),
   homeOwnSpan:p(16,'m','geometry',['practice-keeper.ts:105'],'... full this much further','L'),
   homeOwnMax:p(5,'m','geometry',['practice-keeper.ts:105'],'... at most this, times (keeperSweep - 0.2)','L'),
   homeTheirsFrom:p(12,'m','geometry',['practice-keeper.ts:105'],'... their ball: starts with the ball this far out','L'),
   homeTheirsSpan:p(12,'m','geometry',['practice-keeper.ts:105'],'... full this much further','L'),
   homeTheirsMax:p(4.5,'m','geometry',['practice-keeper.ts:105'],'... at most this, times (keeperSweep - 0.2)','L'),
   KEEPER_BEHIND:p(13,'m','geometry',['practice-keeper.ts:118'],'Behaviour round A (2026-10-03): a keeper plays off his back line, not off his goal line. While the ball is out of shooting range (from KEEPER_FOLLOW_FROM m out, fully from KEEPER_FOLLOW_FULL) he stands no more than KEEPER_BEHIND metres ...','L'),
   KEEPER_BEHIND_SWEEP:p(5,'m','geometry',['practice-keeper.ts:118'],'Behaviour round A (2026-10-03): a keeper plays off his back line, not off his goal line. While the ball is out of shooting range (from KEEPER_FOLLOW_FROM m out, fully from KEEPER_FOLLOW_FULL) he stands no more than KEEPER_BEHIND metres ...','L'),
   KEEPER_FOLLOW_FROM:p(24,'m','geometry',['practice-keeper.ts:118'],'Behaviour round A (2026-10-03): a keeper plays off his back line, not off his goal line. While the ball is out of shooting range (from KEEPER_FOLLOW_FROM m out, fully from KEEPER_FOLLOW_FULL) he stands no more than KEEPER_BEHIND metres ...','L'),
   KEEPER_FOLLOW_FULL:p(32,'m','geometry',['practice-keeper.ts:118'],'Behaviour round A (2026-10-03): a keeper plays off his back line, not off his goal line. While the ball is out of shooting range (from KEEPER_FOLLOW_FROM m out, fully from KEEPER_FOLLOW_FULL) he stands no more than KEEPER_BEHIND metres ...','L'),
   lineFollowPer:p(4,'m','geometry',['practice-keeper.ts:129'],'keeper off his back line: never further out than the box edge plus 1 m plus this times keeperSweep','L'),
   SHOT_RANGE:p(12,'m','geometry',['practice-keeper.ts:147'],'(keeper) a shot is in range within this of his goal: he sets himself (SHOT_SET s before it can come)','L'),
  },
  keeperSupport:{
   baselineWide:p(-2,'m','geometry',['practice-keeper-support.ts:45'],'his support baseline follows the ball across, never more than this either side of the centre (the negative bound)','G'),
   baselineWideMax:p(2,'m','geometry',['practice-keeper-support.ts:45'],'... (the positive bound)','G'),
   stepBehind:p(12,'m','geometry',['practice-keeper-support.ts:51'],'his support step: this far behind the ball, between the Line\'s floor and his reach','L'),
   stepNear:p(4,'m','geometry',['practice-keeper-support.ts:56'],'he offers a second, nearer point this much short of his step','L'),
   pointWide:p(-5,'m','geometry',['practice-keeper-support.ts:56'],'... each at the ball\'s line and this far either side (the negative offset)','W'),
   pointWideMax:p(5,'m','geometry',['practice-keeper-support.ts:56'],'... (the positive offset)','W'),
   readyFrom:p(16,'m','geometry',['practice-keeper-support.ts:56'],'with the ball within this of our goal his ready spot is one of his support points','L'),
  },
  football:{
   shotAngle:p(.6,'rad','geometry',['practice-football.ts:70','practice-football.ts:71'],'the shooter\'s read: the goal angle that counts as wide open (quality and openness, one formula)','A'),
   shotReach:p(45,'m','geometry',['practice-football.ts:70','practice-football.ts:71'],'... and nearness, nothing left at this distance (floor 0.05)','L'),
   crossingWide:p(-7,'m','geometry',['practice-football.ts:127'],'where a shot crosses the goal line, clamped this far either side of the centre (the negative bound)','G'),
   crossingWideMax:p(7,'m','geometry',['practice-football.ts:127'],'... (the positive bound)','G'),
  },
  carry:{
   shotAngle:p(.6,'rad','geometry',['practice-carry.ts:31'],'a carry\'s shot potential: the goal angle that counts as wide open (same value as the shooter\'s read, a separate copy)','A'),
   shotReach:p(45,'m','geometry',['practice-carry.ts:31'],'... and nearness, nothing at this distance (floor 0, not the shooter\'s 0.05)','L'),
  },
  threat:{
   shotAngle:p(.6,'rad','geometry',['practice-threat.ts:73'],'the threat read of a shot: the goal angle that counts as wide open (same value as the shooter\'s, a separate copy)','A'),
   shotReach:p(45,'m','geometry',['practice-threat.ts:73'],'... and nearness, nothing at this distance (floor 0.05)','L'),
  },
  shotDefense:{
   blockAngle:p(.55,'rad','geometry',['practice-shot-defense.ts:19'],'a shot worth blocking: the goal angle that counts as wide open','A'),
   blockReach:p(38,'m','geometry',['practice-shot-defense.ts:19'],'... and its length: nothing from this far','L'),
   blockSpan:p(24,'m','geometry',['practice-shot-defense.ts:19'],'... whole within this much less','L'),
   keeperSetNear:p(9,'m','geometry',['practice-shot-defense.ts:35'],'the keeper counts as set within this of his goal','L'),
   keeperSetWide:p(5,'m','geometry',['practice-shot-defense.ts:35'],'... and within this of the centre line','G'),
  },
  intensity:{
   LEFT_BEHIND:{
    from:p(6,'m','geometry',['practice-intensity.ts:55'],'(striker outlet) Attacking, moving up: the ball this far ahead of him (m) starts to hurry him, this far is everything he has.','L'),
    full:p(14,'m','geometry',['practice-intensity.ts:55'],'(striker outlet) Attacking, moving up: the ball this far ahead of him (m) starts to hurry him, this far is everything he has.','L'),
   },
   nearGoal:p(15,'m','geometry',['practice-intensity.ts:95'],'urgency: a run whose aim is within this of a goal (and still more than 2 m away) is urgent','L'),
  },
  practice:{
   CLEAR_READ:p(12,'m','geometry',['practice.ts:206'],'(receive round) A defender reads a ball coming into the area round his own goal, within CLEAR_READ m of its centre (the "losses within 12 m" area of the watch notes), and wants CLEAR_SPARE s to spare there before he controls it.','L'),
   groundBackMax:p(-25,'m','geometry',['practice.ts:238'],'the carrier\'s ground passes: none to a mate more than this far behind him (negative: backwards)','L'),
   loftBackMax:p(-20,'m','geometry',['practice.ts:245'],'the carrier\'s lofted passes: none to a mate more than this far behind him','L'),
   indirectLine:p(3,'m','geometry',['practice.ts:680'],'an indirect free kick awarded inside the goal area is moved out to this far from the goal line','L'),
   indirectWide:p(4.5,'m','geometry',['practice.ts:680'],'... when within this of the centre line','G'),
   goalKickSpot:p(3,'m','geometry',['practice.ts:704'],'a goal kick is taken this far from the goal line','L'),
   sweepGroundFrom:p(40,'m','geometry',['practice.ts:788'],'the keeper reads a loose ball for a sweep only with it within this of his goal','L'),
  },
 },
});
export type World=typeof WORLD;
