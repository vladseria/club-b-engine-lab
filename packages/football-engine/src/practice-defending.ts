import {L,W,GH} from './pitch.js';
import {clamp} from './model.js';
import type {Side,Tactics} from './model.js';
import type {MovingBall,Vec} from './movement.js';
import type {PracticePlayer,Duty} from './practice.js';
import {acuity,perceive,inView,lookingAt,followsTeam,eagerness,sightLag,misread} from './practice-perception.js';
import {arrivalTime,containMovement,coverPosition,laneSkill,LANE_READ} from './practice-defense.js';
import {readThreat,carrierThreat,threatSource} from './practice-threat.js';
import type {ThreatPicture} from './practice-threat.js';

/** Defending rebuild (2026-10-03, evidence/2026-10-03-defending-rebuild).
 *
 * ONE out-of-possession system for the side without the ball. It replaces the
 * ball-anchored block (teamShape's defending slots), the job dealing for
 * defenders (press, cover, mark, collect, second ball, last man, flight cover,
 * the drop zone, the old ownership solver) and the marking spots. Futsal's
 * "individual defence with exchanges", decided by each defender on his own
 * picture (practice-perception: his sight lag, his read of danger, the calls
 * he has heard):
 *
 * 1. Responsibility. Each defender owns at most one attacker. The attackers
 *    that matter are the man on the ball (or the man a pass is going to), any
 *    man within DANGER_R (by the Line) of our goal, any man running at it and
 *    any man ahead of the ball near our box. A man standing far from goal
 *    behind the ball (their spare man, their rest defence) is NOT marked: the
 *    defender left over is the balance. A man in between ("watched": midfield,
 *    one pass away from nothing) is taken only by a defender who is free to.
 *    Ownership is sticky (KEEP): a man changes hands only when a team-mate is
 *    clearly better placed and calls him ("I've got him", heard after
 *    callDelay, by reading), when two runners cross in front of their markers,
 *    or when the man stops mattering. A run behind his marker is never handed on.
 * 2. Where he stands. An owner is always goal-side of his man, on the line from
 *    the man to the goal centre, shaded a little to the ball: 1-1.6 m off him
 *    one pass away or near our goal, sagging towards the line from the ball to
 *    the goal (the middle) as the man gets further from the ball, never level
 *    with him. When the man runs, he runs with him, goal-side of where he is
 *    going. While his man matters he is never sent to a ball job.
 * 3. Pressure, cover, balance. The carrier's own defender presses ("go fast,
 *    arrive slow", standing a little inside him so he is shown away from the
 *    middle); Press sets where he starts to engage and whether a second man
 *    doubles. One cover goal-side and inside: the free man, or a marker whose
 *    man does not matter much; never the owner of a dangerous man. When the
 *    presser is beaten the cover steps out to the ball and the beaten man
 *    recovers goal-side towards the middle, taking the cover's man. The free
 *    man is the balance: far side, central, goal-side, at the Line's height.
 * 4. The ball itself (a pass, a loose ball): one defender goes for it, the
 *    best placed of those free to (a free man, the receiver's own defender,
 *    a defender whose man is no danger or is the man going for it), and only
 *    when he can get there in time; everyone else keeps his man.
 *
 * Settings: Line = DANGER_R, the block's height (BLOCK) and squeeze; Press =
 * ENGAGE (where the presser engages), HOLD (how far off he waits), doubling
 * (Aggressive), PRESS_SAG; Width = the balance's tuck (BALANCE_Y) and the far
 * man's sag (WIDTH_SAG); Marking (not a Ballers setting) = KEEP, MARK_GAP, SAG.
 */

// ---- the keeper's line (kept from the defending round, step 1) -------------
/** No outfielder within GOAL_LINE_FLOOR m of his own goal line in open play
 * (unless the ball is itself that close, or a shot is on its way): the keeper
 * owns his line, and a man on the byline is marked from inside him. */
export const GOAL_LINE_FLOOR=2;
const depth=(side:Side,x:number)=>side===0?x:L-x;
const world=depth;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(p:Vec):Vec=>({x:clamp(p.x,1,L-1),y:clamp(p.y,-(W/2-1.5),W/2-1.5)});
export function offGoalLine(side:Side,aim:Vec,ball:Pick<MovingBall,'x'|'mode'>&{y?:number}):Vec{
 // (the exception is a ball in the goal mouth, not one by the corner flag)
 if(ball.mode==='shot'||depth(side,ball.x)<GOAL_LINE_FLOOR-.5&&Math.abs(ball.y??0)<GH+4||depth(side,aim.x)>=GOAL_LINE_FLOOR)return aim;
 return {x:world(side,GOAL_LINE_FLOOR),y:aim.y};
}

// ---- settings --------------------------------------------------------------
/** Who matters: a man this close to our goal centre (m), by the Line (a high
 * block marks men further out); Aggressive marks further out still. */
export const DANGER_R:Record<Tactics['line'],number>={deep:17,standard:18.5,high:21};
export const DANGER_PRESS:Record<Tactics['press'],number>={selective:-1,balanced:0,aggressive:3};
/** ... and CENTRAL m further for a central man (|y| under 3 m, fading out by 9 m): the middle is where goals come from. */
export const CENTRAL=3;
/** A man ahead of the ball (nearer our goal than it by AHEAD m) matters out to DANGER_R + AHEAD_R. */
export const AHEAD=2,AHEAD_R=5;
/** A runner (RUN_GOALWARD m/s at our goal, as seen) matters out to DANGER_R + RUN_R, read RUN_LEAD s ahead. */
export const RUN_GOALWARD=3.5,RUN_LEAD=.7,RUN_R=9;
/** A marker reads where his man is going: his seen velocity this far ahead (s), further for a runner. */
export const READ_AHEAD=.4,TRACK_LEAD=.55;
/** ... and matches this share of his velocity (all of it for a runner): his spot already leads the man, and a man who stops must not be overrun. */
export const VELOCITY_SHARE=.25,RUN_VELOCITY_SHARE=.5;
/** Who can take a runner is judged on where he will be this far ahead (s). */
export const TAKE_LEAD=.9,CHASE=.8,BEHIND_PRICE=1;
/** A wide man (|y| > BEHIND_WIDE) BEHIND m behind the ball (further from our
 * goal than it) matters by distance only within DANGER_R - BEHIND_R: out
 * there he is no threat to the goal until the ball comes back to him. (A
 * central one is the cut-back: he matters.) */
export const BEHIND=3,BEHIND_R=4,BEHIND_WIDE=6;
/** Their spare man: SPARE_BEHIND m behind the ball (further from our goal) and outside DANGER_R + SPARE_R. Unmarked. */
export const SPARE_BEHIND=5,SPARE_R=2,SPARE_KEEP=1.5;
/** The read of how far a man is from our goal is the defender's own: off by
 * up to DANGER_SPREAD of the distance (plus half a metre) for a player who
 * cannot read the game at all; a typical reader is off by a third of that. */
export const DANGER_SPREAD=.12;
/** His own man keeps mattering a little longer (hysteresis, m). */
export const KEEP_MATTER=3;
/** What an unowned man costs the team's choice (s of run). A watched man is
 * taken only by a defender whose run to him is shorter than this: a high
 * block, or an aggressive press, steps out to men in midfield; a deep one
 * leaves them in front of it. */
export const UNOWNED={ball:8,danger:7};
export const UNOWNED_WATCH:Record<Tactics['line'],number>={deep:.5,standard:.9,high:1.5};
export const WATCH_PRESS:Record<Tactics['press'],number>={selective:-.3,balanced:0,aggressive:.8};
/** Keeping a man (s of run credited to the current owner), by Marking. */
export const KEEP:Record<NonNullable<Tactics['marking']>,number>={tight:2.5,balanced:1.5,zonal:.8};
/** A run behind his marker: never handed on. Two runners crossing in front of their markers: an exchange. */
export const KEEP_BALL=.5,KEEP_RUNNER=4,KEEP_BEATEN=.3,KEEP_CROSSING=.15,CROSS_GAP=3.5;
const SHIFT=KEEP_RUNNER+2.5;
/** Two of us on one man: seen within DUP_SEE m, looked at every DUP_EVERY s between solves. */
export const DUP_SEE=2.5,DUP_EVERY=.15;
export const SWITCH_GAIN=.35,SOLVE_EVERY=.5,CALL_FAST=.25,CALL_SLOW=.6,RUN_CAP=6,VISIBLE_MARK=2;
/** (threat round, item 3: commitment) A defender keeps the job he has chosen (a man, the cover, the balance)
 * unless the picture clearly changes. For COMMIT s after taking it (COMMIT.fast for a sharp reader, COMMIT.slow for
 * one who cannot read the game) another job must improve the team's choice on his picture by COMMIT_GAIN (s of
 * weighted running) instead of SWITCH_GAIN, unless something real changes: a new man on the ball or a new pass, an
 * exchange (his man running past him, two runners crossing in front of their markers), his job no longer being there
 * (his man stops mattering), or a man nobody has on his picture who is the ball or clearly more of a threat than his
 * own man (LEAVE_MARGIN more, and at least HANDOVER_THREAT; for a man on the cover or the balance, any dangerous man
 * nobody has). After it: SWITCH_GAIN when the ball has moved on (a new man on it, a new pass), SETTLE_GAIN while the
 * same man still has it (measured before this round, a third of these switches gained less than 0.35 and half less
 * than 1: re-optimising noise). And he never leaves a man who matters
 * (a danger man, or a threat of HANDOVER_THREAT or more) until, on his picture, a team-mate has him (a call he has
 * heard, or a team-mate goal-side on him), except for those same real changes: a man is handed over, never dropped. Before this round
 * two defenders swapped a man and the balance spot between them every 0.5 s, each acting on calls the other had
 * already taken back (evidence/2026-10-10-movement-intensity series.mjs). */
/** (threat round) An exchange made around the man on the ball holds PIN s (the next look and the presser-beaten check used to undo the step across, and back). */
export const PIN=.8;
export const COMMIT={fast:1,slow:2},COMMIT_GAIN=2,SETTLE_GAIN=.7,HANDOVER_THREAT=.15,LEAVE_MARGIN=.12,FLIP_BACK=1.5,FLIP_GAIN=3;
export function commitFor(p:PracticePlayer):number{return COMMIT.slow-(COMMIT.slow-COMMIT.fast)*acuity(p,'threat');}
/** Where the presser engages the man on the ball (m of the carrier from our
 * goal, by Press, plus the Line's shift); beyond it he waits HOLD m off him,
 * goal-side. A man running at our goal is met wherever he is. */
export const ENGAGE:Record<Tactics['press'],number>={selective:22,balanced:31,aggressive:L};
export const ENGAGE_LINE:Record<Tactics['line'],number>={deep:-4,standard:0,high:5};
/** (threat round) ... and a carrier whose own threat (practice-threat carrierThreat: his shot, or his drive at goal) the presser reads at ENGAGE_THREAT or more is engaged wherever he is (misread by up to THREAT_SPREAD_C). */
export const ENGAGE_THREAT=.3,THREAT_SPREAD_C=.1;
export const HOLD:Record<Tactics['press'],number>={selective:5.5,balanced:4,aggressive:2.5};
/** The presser stands a little inside the man (shows him away from the middle). */
export const SHOW=.6;
/** (keeper fix) A keeper with the ball in his hands cannot be challenged, and standing on him to stop his release is an
 * offence (Laws of the Game: preventing the goalkeeper from releasing the ball): the man pressing him holds KEEP_OFF m
 * off, towards his nearest short throw (a team-mate within SHORT_THROW m of him, as the presser sees him; keepOff), and
 * otherwise goal-side on his own line to him. Before, he was aimed straight at the keeper and stood 0.3-0.6 m from the
 * ball in his hands until the hold ran out (evidence/2026-10-13-keeper-giveaway). */
export const KEEP_OFF=2.5,SHORT_THROW=12;
/** A clear run at goal: the carrier within CLEAR_R m of our goal (CLEAR_R_RUN m running at it) with nobody of ours in his path (CLEAR_W m either side of it, widening CLEAR_W_GROW per m towards the goal); seen CLEAR_SEE..CLEAR_SEE+CLEAR_SLOW s after it opened, by reading, CLEAR_KEEN s sooner for a keen player. */
export const CLEAR_R=24,CLEAR_R_RUN=32,CLEAR_W=1.6,CLEAR_W_GROW=.12,CLEAR_SEE=.15,CLEAR_SLOW=.45,CLEAR_KEEN=.2;
/** Near our goal (the man on the ball within NEAR_BLOCK m) the presser must be the block: goal-side of him within BLOCK_REACH m, or a team-mate who is steps in. */
export const NEAR_BLOCK=14,BLOCK_REACH=3;
/** Marking distance off the man (one pass away or near goal), by Marking. */
export const MARK_GAP:Record<NonNullable<Tactics['marking']>,number>={tight:.8,balanced:1,zonal:1.4};
/** Tight: within ONE_PASS m of the ball, fully loose beyond ONE_PASS_FAR; or within NEAR_GOAL m of goal (to NEAR_GOAL_FAR). */
export const ONE_PASS=13,ONE_PASS_FAR=19,NEAR_GOAL=16,NEAR_GOAL_FAR=20;
/** Goal-side margin (m along the man-to-goal line) he never gives up. */
export const GOALSIDE=.7;
/** The marking distance grows with the man's distance from our goal: from `from` m, `rate` m per m, up to `max`. */
export const FAR_CUSHION={from:15,rate:.35,max:3.5};
export const CUSHION_MARKING:Record<NonNullable<Tactics['marking']>,number>={tight:.3,balanced:1,zonal:1.2};
/** The shade towards the ball of a tight marker (m). */
export const SHADE=.5;
/** Sagging off a far man: what he can afford (reach), by Marking, Press and Width. */
export const SAG:Record<NonNullable<Tactics['marking']>,number>={tight:.4,balanced:1,zonal:1.25};
export const PRESS_SAG:Record<Tactics['press'],number>={selective:1.15,balanced:1,aggressive:.8};
export const WIDTH_SAG:Record<Tactics['width'],number>={narrow:1.25,standard:1,wide:.75};
export const SAG_CAP=6.5;
/** The block's height (m from our goal): the ball's depth minus `gap`, between `floor` and `ceiling`; it squeezes up `squeeze` m when the ball is pressed or played back. */
export const BLOCK:Record<Tactics['line'],{gap:number;floor:number;ceiling:number;squeeze:number}>={
 deep:{gap:8,floor:5,ceiling:15,squeeze:0},
 standard:{gap:6,floor:6,ceiling:20,squeeze:2.5},
 high:{gap:4,floor:7,ceiling:26,squeeze:5},
};
/** The balance: how far across from the centre, on the far side (Width). */
export const BALANCE_Y:Record<Tactics['width'],number>={narrow:1,standard:2.5,wide:4.5};
/** The balance and the screen never stand in the goal area (BALANCE_FLOOR m from the line) and keep a man left in front of them BALANCE_CUSHION m ahead. */
export const BALANCE_FLOOR=4,BALANCE_CUSHION=1;
/** (cover-defender round, 2026-10-10) The free man's first duty is a man ahead of the ball within COVER_DROP_R m of
 * our goal (by the Line), marked or not: futsal's second defender. He drops to a diagonal cover spot:
 * COVER_DROP_DEEP m goal-side of the man along his line to our goal (at least COVER_DROP_BELOW m deeper than a
 * marker who is goal-side, never more than COVER_DROP_MAX m), COVER_DROP_ACROSS m across it (inside a wide man, else
 * away from his marker, else away from the ball), and never within COVER_DROP_OFF m of the marker's own line to our
 * goal behind him (no column). Each defender sees the man get there COVER_DROP_SEE..+COVER_DROP_SLOW s after it
 * happened, by reading. With two such men he covers the one no team-mate holds (nobody goal-side within
 * COVER_DROP_NEAR m as he reads it, with COVER_DROP_SPREAD of error, or a run going past the one who is: worth
 * COVER_DROP_FREE m), then the nearest our goal; he keeps his man (COVER_DROP_KEEP m) until it is gone (behind the
 * ball, out of range), and gives it up for a loose far man COVER_DROP_FAR m nearer our goal. */
export const COVER_DROP_R:Record<Tactics['line'],number>={deep:20,standard:22,high:24};
export const COVER_DROP_NEAR=4,COVER_DROP_DEEP=2.5,COVER_DROP_BELOW=1,COVER_DROP_MAX=4.5,COVER_DROP_ACROSS=1.5,COVER_DROP_OFF=1.5,COVER_DROP_WIDE=4;
export const COVER_DROP_SEE=.15,COVER_DROP_SLOW=.45,COVER_DROP_SPREAD=.15,COVER_DROP_FAR=1,COVER_DROP_FREE=3,COVER_DROP_KEEP=1.5;
/** (threat round) The cover's man: the most threatening of those he could cover, COVER_DROP_THREAT m nearer per unit of threat. */
export const COVER_DROP_THREAT=20;
/** Cover: no further than COVER_FAR s from the cover point; the previous cover keeps it (COVER_KEEP s). */
/** (threat round) Of two free men, the one who had the balance keeps it unless the other gets there BALANCE_KEEP s sooner. */
export const BALANCE_KEEP=1;
/** (threat round) Of two defenders on the man on the ball, the one who was pressing him keeps pressing unless the other gets there PRESSER_KEEP s sooner. */
export const PRESSER_KEEP=.3;
export const COVER_FAR=2.2,COVER_KEEP=.6,COVER_BEHIND=2.5,COVER_SHARE=3.5,COVER_RUN=.4,COVER_SHARE_KEEP=1.5;
/** A doubling second man (Aggressive): on a trigger, with a team-mate kept goal-side as balance. */
export const DOUBLE_SPREAD=.6;
/** The ball: a defender goes for it only when he gets there by COLLECT_MARGIN s of the first attacker. A marker whose man matters may go only for a ball at his feet (COLLECT_NEAR m) he clearly wins, or when his man is the one going for it (COLLECT_MAN m). */
export const COLLECT_MARGIN=.15,COLLECT_NEAR=4,COLLECT_WIN=.4,COLLECT_MAN=4;
/** (collect read, 2026-10-11) A ball in the air to his man. The receiver's own defender used to go for it whenever
 * the engine's exact race put him within COLLECT_DUEL = 0.6 s of the receiver, the same for everyone: he left his
 * spot for a ball the receiver had already controlled. Now he decides on his OWN read of the race (off by up to
 * COLLECT_SPREAD s for a player who cannot read the game, as the B3 contest reads it) and goes only when he reads he
 * meets the ball within duelWindow s of the receiver: close enough to make the touch a fight. In the 45a18f07 trace
 * (evidence/2026-10-11-collect-read) a marker who met it up to ~0.15 s after the receiver won it about 1 time in 5 and
 * was within 1.5 m of him at the reception half the time; at 0.15-0.3 s, 1 in 10 and a quarter of the time; beyond
 * that almost never. The window is COLLECT_MARGIN plus up to DUEL_SKILL s for a good defender in the air (defending,
 * aerial, strength: duelSkill), about 0.2 s for a typical one. Otherwise he holds goal-side: he closes his man as a
 * marker does (1 m goal-side of the meeting), so the attacker gets the ball but not the space behind him. A sharp
 * reader sees "I am not getting there" correctly; a poor one sometimes goes when he should not. */
export const COLLECT_SPREAD=.6,DUEL_SKILL=.25;
export const duelSkill=(p:{skills:{defending:number;aerial:number;strength:number}})=>clamp((.5*p.skills.defending+.3*p.skills.aerial+.2*p.skills.strength-5)/5,0,1);
export const duelWindow=(p:{skills:{defending:number;aerial:number;strength:number}})=>COLLECT_MARGIN+DUEL_SKILL*duelSkill(p);
/** B3 (2026-10-09), answering the long ball. A pass the defence reads being
 * met behind its last outfielder (goal-side of every one of them): the
 * defender who can get to the receiver's meeting point within CONTEST_WITHIN s
 * of him (on his own read of the race, off by up to CONTEST_SPREAD s for a
 * player who cannot read the game) goes there to make the touch a fight,
 * arriving CONTEST_GOALSIDE m goal-side of it, rather than holding a spot
 * behind the man; the challenge model and the contact rules decide it. One
 * man goes, free to as for any ball (the receiver's own defender, a free man,
 * or one whose man does not matter or is the man going for it); the rest keep
 * their men. When the keeper has called it (he is coming), nobody goes for
 * it near him: the receiver's defender screens instead, in the runner's path
 * SCREEN_STEP m in front of him. */
export const CONTEST_WITHIN=.5,CONTEST_SPREAD=.6,CONTEST_GOALSIDE=.4,SCREEN_STEP=1.2,KEEPER_ZONE=4;
/** Spacing between free defenders' spots (m). */
export const SPACING=2.2,FREE_GAP=3.2,SCREEN_OFF=7;
/** A sagging marker keeps SAG_CLEAR m off a man a team-mate has. */
export const SAG_CLEAR=2.2;
/** In midfield, the marker of a man level with or behind the ball keeps BALL_CLEAR m off the carrier, goal-side. */
export const BALL_CLEAR=3.5;
/** Regroup ("On losing it"): everyone not yet this far goal-side of the ball drops behind it first. */
export const REGROUP_BEHIND=5;

type View=(reader:PracticePlayer,target:PracticePlayer,before?:number)=>PracticePlayer;
export type Matter='ball'|'danger'|'watch'|'spare';
export interface DefendMemory {side:Side;attacking:Side;
 /** Each defender's own man and since when. */
 men:Record<string,{target:string;since:number;
  /** (threat round) the job he left for this one ('' = none), so he does not flip straight back to it. */
  left?:string;
  /** (threat round) an exchange around the man on the ball (a step across into a clear run, a beaten presser
   * replaced) holds until then while the same man has the ball: the next look does not undo it (PIN). */
  pin?:number}>;
 /** Each defender's calls, newest last ('' = "I have nobody"). */
 calls:Record<string,{target:string;at:number}[]>;
 solvedAt:number;focus?:string;who?:string;cover?:string;
 /** Defending-close round: since when the carrier has had a clear run at our goal. */
 clear?:{carrier:string;since:number;step?:string;
  /** Step-across round: when the next team-mate's own read of it falls due (the defence looks again then, not at its 0.25 s tick). */
  next?:number};
 /** Defending-close round: when the duplicates were last looked at. */
 dupAt:number;
 /** Cover-defender round: since when each man has been ahead of the ball near our goal (the fact; each defender reads it late, by reading). */
 exposed?:Record<string,number>;
 /** Cover-defender round: the free man covering behind a man ahead of the ball near our goal. */
 drop?:{man:string;by:string};
 /** (marking and shape round) when the next marker's read of the passer's preparation falls due. */
 cueNext?:number;
 /** (threat round) the free man who had the balance in the last plan, and who pressed whom. */
 balanceBy?:string;presserBy?:string;presserOf?:string}
export interface DefendJob {player:string;purpose:'press'|'cover'|'mark'|'balance'|'screen'|'drop'|'zone';kind:Duty;aim:Vec;speed:number;reason:string;target?:string;velocity?:Vec;
 /** (threat round) the threat of his man as he reads it (practice-threat): how hard he goes to his spot (practice-intensity). */
 threat?:number}
export interface DefendInput {
 players:readonly PracticePlayer[];defending:Side;attacking:Side;tactics:Tactics;time:number;ball:MovingBall;
 /** The man on the ball (any attacker, the keeper included). */
 carrier?:PracticePlayer;
 /** A pass in flight: the man the defence reads it going to, and where he meets it. */
 receiver?:{id:string;meet:Vec};
 /** A loose ball: where it stops. */
 loose?:Vec;
 /** Defenders who decide for themselves (not under an order, not committed to a counter-press or a trap), the busy ones included. */
 available:readonly PracticePlayer[];
 /** Wrongfooted or recovering from a missed tackle: they keep their men, but nobody counts on them for the ball. */
 busy:ReadonlySet<string>;
 /** Defenders already committed (an order, a counter-press, a trap): defender -> attacker. */
 fixed:ReadonlyMap<string,string>;
 /** Defenders among `available` whose man is decided for them (a set piece's man-marker): positioned here, never re-chosen. */
 locked?:ReadonlyMap<string,string>;
 view:View;memory?:DefendMemory;
 /** The presser's intent after a loss ("On losing it"): delay (Regroup) or engage (a counter-press). */
 intent?:'delay'|'engage';
 /** Regroup's drop: everyone not yet goal-side of the ball runs behind it first. */
 regroup?:boolean;
 /** A restart being set up: the taker cannot be tackled; nobody covers or goes for the ball. */
 restart?:{spot:Vec;radius:number};
 /** When the man on the ball got it (the loose-touch trigger). */
 since?:number;
 /** Defending-side candidates for the ball (assignFlight's visible reads, best first). */
 reach?:{id:string;point:Vec;score:number}[];
 /** The attackers' best arrival at the ball (s). */
 theirs?:number;
 /** B3: the keeper has come for this ball (his aim). */
 keeperCall?:Vec;
 /** (marking and shape round) the man on the ball preparing a pass: to whom, where, since when. */
 cue?:{target:string;passer:string;aim:Vec;since:number};
 /** (keeper fix) the man on the ball is a keeper holding it in his hands: nobody may stand on him (KEEP_OFF). */
 inHands?:boolean;
 /** (threat round) the picture each defender reads the attackers' threat from (practice-threat); set by defendOutOfPossession. */
 threat?:ThreatPicture;
}
export interface DefendPlan {jobs:DefendJob[];presser?:string;coverer?:string;collector?:{id:string;meet:Vec};marks:Map<string,string>;memory:DefendMemory}

export function callDelay(p:PracticePlayer):number{return CALL_FAST+(CALL_SLOW-CALL_FAST)*(1-acuity(p,'threat'));}
/** What `listener` has heard `caller` call by `time`. */
export function heard(memory:DefendMemory|undefined,listener:PracticePlayer,caller:string,time:number):{target:string;at:number}|undefined{
 const calls=memory?.calls[caller];if(!calls)return undefined;
 const late=callDelay(listener);
 for(let i=calls.length-1;i>=0;i--)if(calls[i].at+late<=time+1e-9)return calls[i];
 return undefined;
}
const goalward=(v:Vec&{vx:number},side:Side)=>(side===0?-1:1)*v.vx;
const ahead=<T extends PracticePlayer>(v:T,t:number):T=>({...v,x:v.x+v.vx*t,y:v.y+v.vy*t});
/** A defender is beaten by the man on the ball when he is no longer goal-side of him and not touching distance away. */
export function isBeaten(p:Vec,carrier:Vec,g:Vec):boolean{return distance(p,g)>distance(carrier,g)+.5&&distance(p,carrier)>1.5;}
/** His man's run goes behind him: within RUN_LEAD s the man is level with him or goal-side of him. */
export function runBehind(q:Vec,v:PracticePlayer,defending:Side):boolean{
 if(goalward(v,defending)<RUN_GOALWARD)return false;
 const g={x:world(defending,0),y:0};
 return distance(ahead(v,RUN_LEAD),g)<distance(q,g)+1;
}
/** The two runners cross in front of him (both further from goal, close together) and he sees both: an exchange. */
function crossing(d:PracticePlayer,man:Vec,others:readonly Vec[],ball:Vec,g:Vec):boolean{
 const facing=lookingAt(d,ball),front=(v:Vec)=>distance(v,g)>distance(d,g)+1&&inView(d,facing,v);
 return front(man)&&others.some(o=>distance(o,man)<CROSS_GAP&&front(o));
}

export interface ManRead {id:string;v:PracticePlayer;matter:Matter;weight:number;dg:number;running:boolean;
 /** How much he matters, 0..1 (1 = clearly dangerous): a soft edge, so two team-mates who read him a metre apart do not see two different men. */
 danger:number;
 /** (threat round) his threat to our goal as this defender reads it, 0..1 (practice-threat: can the ball reach him, would he score), and how reachable he is; 0 without a threat picture. */
 threat:number;reach:number}
/** (threat round) A man's weight in the team's choice is where he is (the radius reads above) scaled by his
 * threat: x (THREAT_MIX + THREAT_W x threat), so about x0.7 for a harmless man and x1.4-1.6 for a man 8 m out with a
 * lane from the carrier (threat about 0.3-0.4). Two men 8 m out, one with a lane and one without, no longer weigh the same. */
export const THREAT_MIX=.6,THREAT_W=2.5;
/** The soft edge of "matters" (m either side of the radius). */
export const EDGE=3;
/** How this defender reads one attacker: where he is (his own picture), how
 * far from our goal (his own read), and whether he matters. */
export function readMan(d:PracticePlayer,a:PracticePlayer,input:Pick<DefendInput,'defending'|'tactics'|'time'|'carrier'|'receiver'|'view'|'threat'>,ref:Vec,own:boolean):ManRead{
 const {defending,tactics,time}=input,g={x:world(defending,0),y:0};
 const isBall=a.id===input.carrier?.id||a.id===input.receiver?.id;
 const seen=a.id===input.carrier?.id?a:input.view(d,a);
 const da=depth(defending,seen.x),db=depth(defending,ref.x);
 // (track the runner) a run setting off is read from its start: he is a runner, and he is followed (marked, taken)
 // at where the run is taking him. How far he is from our goal and his threat stay what is seen: a run anticipated is
 // not yet a man in front of our goal (read from the extrapolation, the threat of every run from deep outweighed the
 // striker the line was holding, and the striker went through: evidence/2026-10-11-track-runner, version 2)
 const run=isBall||goalward(seen,defending)>=RUN_GOALWARD?undefined:readRun(d,a,seen,input,da,db,g);
 const v=seen;
 const exact=Math.min(distance(v,g),distance(ahead(v,RUN_LEAD),g));
 const dg=perceive(d,'threat',exact,DANGER_SPREAD*exact+.5,v,{time,salt:`dg${a.id}`});
 const running=goalward(seen,defending)>=RUN_GOALWARD||!!run;
 const R=DANGER_R[tactics.line]+DANGER_PRESS[tactics.press]+(own?KEEP_MATTER:0)+CENTRAL*clamp(1-(Math.abs(v.y)-3)/6,0,1);
 const close=clamp((R+6-dg)/12,0,1)*clamp(1-(Math.abs(v.y)-5)/14,.4,1);
 const within=(r:number)=>clamp((r+EDGE-dg)/(2*EDGE),0,1);
 const danger=isBall?1:Math.max(within(da>db+BEHIND&&Math.abs(v.y)>BEHIND_WIDE?R-BEHIND_R:R),running?within(R+RUN_R):0,da<db-AHEAD?within(R+AHEAD_R):0);
 // their spare man: well behind the ball and outside the plain radius (no
 // central bonus, no keeping, no soft edge), not running: nobody's, whatever
 // he was (checkpoint 1: their outlet at the centre circle was kept marked)
 const plainR=DANGER_R[tactics.line]+DANGER_PRESS[tactics.press];
 // (threat round) his own man needs SPARE_KEEP m more of both before he stops mattering (he went in and out of it every look)
 const spare=!isBall&&!running&&da>db+SPARE_BEHIND+(own?SPARE_KEEP:0)&&dg>plainR+SPARE_R+(own?SPARE_KEEP:0);
 let matter:Matter;
 if(isBall)matter='ball';
 else if(spare)matter='spare';
 else if(danger>=.5)matter='danger';
 else matter='watch';
 const pic=input.threat;
 let threat=0,reach=0;
 if(pic&&matter!=='spare'){
  if(a.id===input.carrier?.id){threat=carrierThreat(a,pic.defenders,defending);reach=1;}
  else{const t=readThreat(d,a,v,pic);threat=t.value;reach=t.reach;}
 }
 const base=.3+.3*close+(.7+close)*danger+(running?.5*danger:0);
 // (Tight marking follows its men wherever they are: its weights are never scaled down for a harmless man)
 const scale=THREAT_MIX+THREAT_W*threat,weight=matter==='ball'?3:matter==='spare'?0:pic?base*(tactics.marking==='tight'?Math.max(1,scale):scale):base;
 return {id:a.id,v:run??v,matter,weight,dg,running,danger,threat,reach};
}

/** (track the runner, 2026-10-11, evidence/2026-10-11-track-runner) A run read from where it starts and where it is
 * going, not only from its speed. Before, a man was "running" only from RUN_GOALWARD m/s at our goal as seen, so a
 * midfielder setting off from behind the ball into the space in front of our line (the direct-edge "pin and arrive":
 * about 2 m/s when the pass left) was marked with the ordinary read-ahead and cushions, or left unmarked as a man in
 * midfield, until he was past his marker. Now a defender who sees a man setting off towards our goal (moving at it
 * RUN_SET m/s or more, mostly straight at it: RUN_AIM of his anticipated speed) from deep (HABIT_IN m or more from our
 * goal: nearer, the goal-side habit of the marking-and-shape round already follows his movement at our goal, read
 * ahead by reading), from behind the ball or from in front of him (behind his marker), reads where the run is taking
 * him: his seen velocity plus his seen acceleration (two looks RUN_LOOK s apart on his own late picture) carried
 * RUN_EARLY s ahead, from RUN_EARLY.min for a defender who
 * cannot read the game to RUN_EARLY.max for a sharp one (acuity 'threat': reading and defending), never faster than
 * the man's pace. When he reads that anticipated speed at our goal at RUN_GOALWARD or more (misjudged by up to
 * RUN_SPREAD m/s for a player who cannot read the game) the man is a runner to him, followed at that velocity: he
 * matters as any runner does (his distance from our goal and his threat are still read from what is seen, not from
 * the anticipation), the team's choice takes him from goal-side of where he is going (so a team-mate goal-side and
 * better placed takes him now, before he is past his marker), and his marker goes with him (TRACK_LEAD, the runner's
 * velocity share, no sag). Whether he is the man to take, against the other men and the cover and balance, is the
 * same threat-weighted choice and the same commitment rules as for every man; whether he stays with him is his legs.
 * (Skill range widened 2026-10-11: RUN_EARLY was 0.15..0.6 s, and the skill arms showed reading barely told in
 * matches, 6 v 9 only 0.42 v 0.55 s. The horizon is how many seconds sooner he spots the run, so it is the skill
 * gap itself: now 0.1 s for a man who cannot read the game (he sees the run at about its speed as seen), 0.8 s for
 * a sharp one (about the whole first acceleration of a run, the most a look can carry ahead), so a 3 reads it at
 * 0.31 s, a 6 at 0.52 s, a 9 at 0.73 s: a good reader spots it a fifth of a second before an average one.) */
export const RUN_LOOK=.2,RUN_SET=1,RUN_AIM=.6,RUN_SPREAD=1.2,RUN_EARLY={min:.1,max:.8};
export function readRun(d:PracticePlayer,a:PracticePlayer,v:PracticePlayer,input:Pick<DefendInput,'defending'|'time'|'view'>,da:number,db:number,g:Vec):PracticePlayer|undefined{
 const {defending,time}=input;
 if(goalward(v,defending)<RUN_SET)return undefined;
 // from deep: beyond the zone where the goal-side habit already follows a man's movement at our goal (HABIT_IN),
 // and from behind the ball (not clearly ahead of it) or from in front of this defender (behind his marker)
 if(distance(v,g)<HABIT_IN||!(da>=db-AHEAD||distance(d,g)<distance(v,g)-.5))return undefined;
 const before=input.view(d,a,RUN_LOOK),h=RUN_EARLY.min+(RUN_EARLY.max-RUN_EARLY.min)*acuity(d,'threat');
 let ax=v.vx+(v.vx-before.vx)/RUN_LOOK*h,ay=v.vy+(v.vy-before.vy)/RUN_LOOK*h;
 const sp=Math.hypot(ax,ay),cap=Math.max(a.pace,Math.hypot(v.vx,v.vy));
 if(sp>cap){ax*=cap/sp;ay*=cap/sp;}
 const toward=goalward({x:0,y:0,vx:ax},defending);
 if(toward<RUN_AIM*Math.max(sp>cap?cap:sp,1e-6))return undefined;
 if(perceive(d,'threat',toward,RUN_SPREAD,v,{time,salt:`run${a.id}`})<RUN_GOALWARD)return undefined;
 return {...v,vx:ax,vy:ay};
}

/** Where a defender meets his man to take him (the solve's run): goal-side of where he is going. */
function takeSpot(q:PracticePlayer,r:ManRead,defending:Side):Vec{
 const g={x:world(defending,0),y:0},v=ahead(r.v,r.running?TAKE_LEAD:READ_AHEAD),d=distance(v,g)||1;
 const gap=r.matter==='ball'?1:1.3;
 return {x:v.x+(g.x-v.x)/d*gap,y:v.y+(g.y-v.y)/d*gap};
}

/** Who has whom: each defender's own choice on his own picture, through calls. */
/** The roles a defender may take instead of a man: the cover behind the
 * presser and the balance on the far side (FIFA's pressure, cover, balance).
 * They are chosen in the same choice as the men, so the team decides at once
 * who presses, who covers, who balances and who marks whom: the defender
 * nearest the ball covers and the far one marks the far man, not the other
 * way round. A man who matters always outranks a role. */
export const COVER='#cover',BALANCE='#balance';
export const ROLE_W={cover:1,balance:.6},ROLE_UNOWNED={cover:2.2,balance:1.5},KEEP_ROLE=.4;
/** (threat round) The cover's weight grows by COVER_THREAT_ROLE x the carrier's own threat (practice-threat carrierThreat). */
export const COVER_THREAT_ROLE=1;
export const isRole=(id:string|undefined)=>!!id&&id.startsWith('#');
/** (threat round: role awareness off the ball, the owner's addition) A SOFT preference, never an assignment. Each
 * defender has a role depth (ROLE_DEPTH: 1 for a centre-back or fixo, 0 for a striker) and each job a depth (a man by
 * how near our goal he is, from 1 within 6 m to 0 at 22 m; the cover and the balance deep; the man on the ball by how
 * near our goal he is, so the first line of pressure is a forward's). The mismatch costs at most ROLE_PREF s of run
 * in the team's choice: a tie-break between roughly equal options. Threat and reachability come first: a defender who
 * gets there a little sooner still takes the man, whatever his role, and a man nobody else can reach is taken by
 * whoever can. Among the free men a forward is a little less likely to be the balance (ROLE_BALANCE s) and screens
 * higher, at the first line (SCREEN_UP m), a defender deeper: that is how a player drifts back towards his role when
 * he has no urgent job. Before this round nothing read role without the ball: attackers out-challenged centre-backs in
 * three team-matches in four (evidence/2026-10-10-role-goalline-check). */
export const ROLE_DEPTH:Record<string,number>={CB:1,FB:.9,DM:.8,CM:.55,W:.35,AM:.25,ST:0};
export const ROLE_PREF=.3,ROLE_BALANCE=.5,SCREEN_UP=3;
export const roleDepth=(p:{role:string})=>ROLE_DEPTH[p.role]??.5;
const jobDepth=(dg:number)=>clamp(1-(dg-6)/16,0,1);
interface Target {id:string;weight:number;unowned:number;spot:(q:PracticePlayer)=>Vec;r?:ManRead}
/** Where the cover stands for a carrier (the presser taken as goal-side of him). */
export function coverPoint(carrier:PracticePlayer,defending:Side):Vec{
 const g={x:world(defending,0),y:0},d=distance(carrier,g)||1;
 const presser={...carrier,side:defending,x:carrier.x+(g.x-carrier.x)/d,y:carrier.y+(g.y-carrier.y)/d} as PracticePlayer;
 return coverPosition(presser,carrier);
}
/** The balance's place without a far man to watch: central on the far side, at the block's height. */
export function balancePoint(tactics:Tactics,ref:Vec,defending:Side,squeeze=0):Vec{
 const rd=depth(defending,ref.x),dd=Math.min(blockDepth(tactics,rd,squeeze),rd-3);
 return {x:world(defending,Math.max(BALANCE_FLOOR,dd)),y:-(Math.sign(ref.y)||1)*BALANCE_Y[tactics.width]};
}
/** Who has whom (and who covers, who balances): each defender's own choice on his own picture, through calls. */
export function solveMen(input:DefendInput,ref:Vec):DefendMemory{
 const {players,defending,attacking,tactics,time,available,fixed,busy}=input;
 const fresh=!input.memory||input.memory.attacking!==attacking||input.memory.side!==defending;
 const memory:DefendMemory=fresh?{side:defending,attacking,men:{},calls:{},solvedAt:-Infinity,dupAt:-Infinity}:{...input.memory!,men:{...input.memory!.men},calls:{...input.memory!.calls}};
 const call=(id:string,target:string)=>{
  if((memory.men[id]?.target??'')===target)return;
  if(target)memory.men[id]={target,since:time,left:memory.men[id]?.target??''};else delete memory.men[id];
  memory.calls[id]=[...(memory.calls[id]??[]),{target,at:time}].slice(-3);
 };
 for(const [id,target] of fixed)call(id,target);
 for(const [id,target] of input.locked??[])call(id,target);
 for(const id of Object.keys(memory.men))if(!available.some(p=>p.id===id)&&!fixed.has(id)&&players.some(p=>p.id===id&&p.side===defending))call(id,'');
 const attackers=players.filter(a=>a.side===attacking&&(a.role!=='GK'||a.id===input.carrier?.id&&tactics.press==='aggressive'));
 for(const [id,m] of Object.entries(memory.men))if(!isRole(m.target)&&!attackers.some(a=>a.id===m.target)&&!fixed.has(id))call(id,'');
 const taken=new Set([...fixed.values(),...(input.locked?.values()??[])]);
 const open=attackers.filter(a=>!taken.has(a.id));
 const focus=input.carrier?.id??input.receiver?.id??'';
 const g={x:world(defending,0),y:0};
 const onBall=input.carrier?available.find(p=>memory.men[p.id]?.target===input.carrier!.id):undefined;
 const beaten=!!input.carrier&&input.carrier.role!=='GK'&&!!onBall&&(busy.has(onBall.id)||isBeaten(onBall,input.carrier,g));
 const choosing=available.filter(p=>!input.locked?.has(p.id));
 const who=choosing.map(p=>p.id).sort().join(',');
 // (settings-truth round) a defender whose man has become their spare man (well behind the ball, far from our goal)
 // has nobody to mark: the defence looks again at once, so he is dealt a man or a role by the same choice as
 // everyone (the review's S3: he had no job and stood still until the next look, 0.3-0.6% of defender time; sending
 // him straight to the balance instead pulled a High line's men off their deep men, 3 m deeper, gp-board-truth)
 const idle=!fresh&&choosing.some(d=>{const t=memory.men[d.id]?.target,a=t&&!isRole(t)?open.find(o=>o.id===t):undefined;return !!a&&readMan(d,a,input,ref,true).matter==='spare';});
 const due=fresh||time-memory.solvedAt>=SOLVE_EVERY-1e-9||memory.focus!==focus||memory.who!==who||beaten&&time-memory.solvedAt>=.15||idle;
 if(!choosing.length)return memory;
 const keep=KEEP[tactics.marking??'balanced'],watchCost=Math.max(.2,UNOWNED_WATCH[tactics.line]+WATCH_PRESS[tactics.press]);
 // the man on the ball, or the man a pass is going to (where he meets it): the cover is chosen before he has it
 const receiver=input.receiver?players.find(p=>p.id===input.receiver!.id):undefined;
 const carrier=input.carrier&&input.carrier.role!=='GK'&&!input.restart?input.carrier:receiver&&receiver.role!=='GK'?{...receiver,x:input.receiver!.meet.x,y:input.receiver!.meet.y}:undefined;
 const cover=carrier?coverPoint(carrier,defending):undefined;
 const balance=balancePoint(tactics,ref,defending);
 // (step-across round) the man on the ball within reach of our goal (the clear-run zone): defending the goal comes first, so he too is
 // taken from goal-side of him, and a beaten presser chasing from behind pays for getting round him as for any other man
 const atGoal=(v:PracticePlayer)=>{const cg=distance(v,g);return cg<CLEAR_R||goalward(v,defending)>=RUN_GOALWARD&&cg<CLEAR_R_RUN;};
 /** One defender's choice on his own picture (`exclude`: men he has given up). */
 const decide=(d:PracticePlayer,exclude?:ReadonlySet<string>):string=>{
  const reads=open.map(a=>readMan(d,a,input,ref,memory.men[d.id]?.target===a.id));
  const live=reads.filter(r=>r.matter!=='spare');
  const targets:Target[]=live.map(r=>({id:r.id,r,weight:r.weight,unowned:r.matter==='ball'?UNOWNED.ball:watchCost+(UNOWNED.danger-watchCost)*r.danger,spot:(q:PracticePlayer)=>takeSpot(q,r,defending)}));
  // the cover, unless a dangerous man stands on his spot (his marker covers there)
  // (threat round: the cover keeps his role until the man is COVER_SHARE_KEEP m nearer the spot than that)
  const covering=memory.men[d.id]?.target===COVER;
  if(cover&&!live.some(r=>r.matter==='danger'&&distance(r.v,cover)<COVER_SHARE-(covering?COVER_SHARE_KEEP:0))){
   const far=clamp((40-depth(defending,carrier!.x))/15,.3,1);
   // ("On losing it": Regroup's delayer always keeps a cover behind him)
   // (threat round) a carrier who can shoot or drive at goal makes the cover behind his presser matter more
   const ct=input.threat&&input.carrier&&input.carrier.role!=='GK'?carrierThreat(input.carrier,input.threat.defenders,defending):0;
   targets.push({id:COVER,weight:ROLE_W.cover*far*(input.intent==='delay'?2:1)*(1+COVER_THREAT_ROLE*ct),unowned:ROLE_UNOWNED.cover*(input.intent==='delay'?2:1),spot:()=>cover});
  }
  if(!input.restart)targets.push({id:BALANCE,weight:ROLE_W.balance,unowned:ROLE_UNOWNED.balance,spot:()=>balance});
  // Who he believes has whom: himself, and what he has heard (or sees: a
  // team-mate already goal-side of a man within VISIBLE_MARK m).
  const belief=new Map<string,{target:string;at:number}>();
  for(const q of choosing){
   if(q.id===d.id){const m=memory.men[d.id];if(m)belief.set(q.id,{target:m.target,at:m.since});continue;}
   const h=heard(memory,d,q.id,time);
   if(h&&h.target)belief.set(q.id,h);
   // (a guess from proximity never outranks a claim he has heard)
   else if(!h){const x=live.find(r=>distance(q,r.v)<VISIBLE_MARK&&distance(q,g)<distance(r.v,g)+.3);if(x)belief.set(q.id,{target:x.id,at:time});}
  }
  // Whose claim stands on each target: the earliest.
  const claimant=new Map<string,string>();
  for(const t of targets){const c=[...belief].filter(([,b])=>b.target===t.id).sort((a,b)=>a[1].at-b[1].at||a[0].localeCompare(b[0]));if(c[0])claimant.set(t.id,c[0][0]);}
  const credit=(q:PracticePlayer,t:Target)=>{
   const b=belief.get(q.id);if(!b||b.target!==t.id)return 0;
   if(!t.r)return KEEP_ROLE*(claimant.get(t.id)===q.id?1:.25);
   const view=t.r.v;
   // a run behind him is followed while he can still stay goal-side; once the
   // man is past him, the team-mate with the least running takes him (FIFA)
   if(t.r.matter!=='ball'&&runBehind(q,view,defending))return distance(q,g)<distance(view,g)+.5?KEEP_RUNNER:KEEP_BEATEN;
   if(t.r.matter!=='ball'&&crossing(q,view,live.filter(y=>y.id!==t.id).map(y=>y.v),ref,g))return KEEP_CROSSING;
   // near our goal a man is his only from goal-side of him: an owner caught on the wrong side (after a turnover, a tackle) has no claim the better placed must respect
   if(t.r.matter==='danger'&&distance(view,g)<NEAR_GOAL&&distance(q,g)>distance(view,g)-.3&&distance(q,view)>2)return KEEP_BEATEN;
   // (step-across round) the same for the man on the ball running at our goal: his beaten presser, chasing from behind, has no claim on him there
   if(t.r.matter==='ball'&&atGoal(view)&&isBeaten(q,view,g))return KEEP_BEATEN;
   // the man on the ball is pressed by the best placed: a quick exchange (KEEP_BALL), the off-ball men are sticky
   return (t.r.matter==='ball'?KEEP_BALL:keep)*(claimant.get(t.id)===q.id?1:.25);
  };
  const cost=choosing.map(q=>targets.map(t=>{
   let extra=0;
   if(t.r&&(t.r.matter!=='ball'||atGoal(t.r.v))){
    // a man is taken from goal-side of him: a defender further from our goal
    // than where the man is going must first get round him (BEHIND_PRICE s
    // per second of that ground), and a runner from behind has to be chased
    const lead=ahead(t.r.v,t.r.running?TAKE_LEAD:READ_AHEAD),behind=Math.max(0,distance(q,g)-distance(lead,g)+1);
    extra=(t.r.running&&distance(q,g)>distance(t.r.v,g)-.5?CHASE:0)+BEHIND_PRICE*behind/Math.max(4,q.pace);
   }
   const run=busy.has(q.id)&&(t.r?.matter==='ball'||!t.r)?RUN_CAP:Math.min(RUN_CAP,arrivalTime(q,t.spot(q))+extra);
   // (role awareness) the soft tie-break: his role depth against the job's
   const fit=ROLE_PREF*Math.abs(roleDepth(q)-(t.r?(t.r.matter==='ball'?clamp(1-(t.r.dg-8)/24,0,1):jobDepth(t.r.dg)):t.id===COVER?.8:.75));
   // (every option shifted by the same SHIFT, so no term is negative and the search's bound holds)
   return run+fit-credit(q,t)+SHIFT;
  }));
  const unowned=targets.map(t=>t.unowned+SHIFT);
  const order=targets.map((_,k)=>k).sort((a,b)=>targets[b].weight-targets[a].weight||targets[a].id.localeCompare(targets[b].id));
  const me=choosing.findIndex(p=>p.id===d.id);
  const best=(lock:string|undefined)=>{
   let top=Infinity,row='';const used=new Array(choosing.length).fill(false);
   const search=(n:number,acc:number,mine:string)=>{
    if(acc>=top-1e-9)return;
    if(n===order.length){if(lock===undefined||mine===lock){top=acc;row=mine;}return;}
    const k=order[n],w=targets[k].weight;
    for(let j=0;j<choosing.length;j++){
     if(used[j]||j===me&&lock!==undefined&&targets[k].id!==lock)continue;
     used[j]=true;search(n+1,acc+w*cost[j][k],j===me?targets[k].id:mine);used[j]=false;
    }
    search(n+1,acc+w*unowned[k],mine);
   };
   search(0,0,'');
   return {top,row};
  };
  // (a man he has given up to a team-mate who has him: not his)
  if(exclude)for(let k=0;k<targets.length;k++)if(exclude.has(targets[k].id))for(let j=0;j<choosing.length;j++)if(j===me)cost[j][k]=Infinity;
  const free=best(undefined),current=exclude?.has(memory.men[d.id]?.target??'')?undefined:memory.men[d.id]?.target;
  let row=free.row;
  const mine=targets.find(t=>t.id===current);
  // (threat round) an exchange just made around the man on the ball stands while he still has it
  if(current&&mine&&(memory.men[d.id]?.pin??-Infinity)>time&&memory.focus===focus)return current;
  if(current&&row!==current&&mine){
   // (threat round) commitment. Within his window a switch must clearly pay (COMMIT_GAIN) unless something real
   // changes (then SWITCH_GAIN): a new ball (focus), an exchange (his man past him, two runners crossing), or a man
   // nobody has on his picture who is the ball or clearly more of a threat than his own (for a man on a role, any
   // dangerous man nobody has); after it, SETTLE_GAIN
   const settled=time-(memory.men[d.id]?.since??-Infinity)>=commitFor(d)-1e-9||memory.focus!==focus;
   const k=mine.r?credit(d,mine):0,exchange=k===KEEP_BEATEN||k===KEEP_CROSSING;
   const next=targets.find(t=>t.id===row),nobody=!!next&&![...belief].some(([id,b])=>id!==d.id&&b.target===next.id);
   const urgent=!!next?.r&&nobody&&(next.r.matter==='ball'||(mine.r?next.r.threat>=Math.max(HANDOVER_THREAT,mine.r.threat+LEAVE_MARGIN):next.r.danger>=.5));
   // ... and straight back to the job he has just left only for a clear gain (FLIP_GAIN) while the same ball is on
   const back=row===(memory.men[d.id]?.left??null)&&memory.focus===focus&&time-(memory.men[d.id]?.since??-Infinity)<FLIP_BACK;
   const need=back?FLIP_GAIN:exchange||urgent||memory.focus!==focus?SWITCH_GAIN:!settled?COMMIT_GAIN:SETTLE_GAIN;
   if((claimant.get(current)??d.id)===d.id){const kept=best(current);if(kept.top-free.top<need)row=current;}
   // ... and a man who matters is handed over, never dropped: he leaves him once a team-mate has him on his picture
   if(row!==current&&mine.r&&mine.r.matter!=='ball'&&!exchange&&!urgent&&(mine.r.danger>=.5||mine.r.threat>=HANDOVER_THREAT)&&![...belief].some(([id,b])=>id!==d.id&&b.target===current))row=current;
  }
  // (threat round) a role not on offer this look (no cover point while the ball is loose, a man on the cover spot) is
  // kept while nothing else needs him: he is a free man for this look, not a man who has given up his job
  if(current&&!mine&&isRole(current)&&!row)row=current;
  return row;
 };
 // Desync duplicates (defending-close round): two of us on the same man who is
 // not on the ball. Each sees it on his own picture: the team-mate's call for
 // him that he has heard, or the team-mate on him within DUP_SEE m, goal-side
 // (close enough that "mine!" is heard at once). The one who called him first
 // keeps him (an equal call: the better placed); the other gives him up and
 // takes the next job on his picture: the free man, or a role.
 const dupOf=(d:PracticePlayer):string|undefined=>{
  const x=memory.men[d.id]?.target;if(!x||isRole(x)||x===focus)return undefined;
  const a=open.find(o=>o.id===x);if(!a)return undefined;
  const v=input.view(d,a),ga=distance(v,g),mine=memory.men[d.id]!.since;
  const lead=ahead(v,READ_AHEAD),spotFor=(q:PracticePlayer)=>arrivalTime(q,{x:lead.x+(g.x-lead.x)/(distance(lead,g)||1),y:lead.y+(g.y-lead.y)/(distance(lead,g)||1)});
  for(const q of players){
   if(q.id===d.id||q.side!==defending||q.role==='GK'||memory.men[q.id]?.target!==x)continue;
   const h=heard(memory,d,q.id,time),seen=distance(q,v)<DUP_SEE&&distance(q,g)<ga+.5;
   if(!(h&&h.target===x)&&!seen)continue;
   if(fixed.has(q.id)||input.locked?.has(q.id))return x;
   const theirs=memory.men[q.id]!.since;
   if(theirs<mine-1e-9)return x;
   if(Math.abs(theirs-mine)<1e-9){const a1=spotFor(q),a0=spotFor(d);if(a1<a0-1e-9||Math.abs(a1-a0)<1e-9&&q.id<d.id)return x;}
  }
  return undefined;
 };
 const resolve=()=>{
  // (his next choice may be a team-mate's man too: the next look, DUP_EVERY s on, settles it)
  for(const d of choosing){const x=dupOf(d);if(x)call(d.id,decide(d,new Set([x])));}
 };
 if(!due){if(time-(memory.dupAt??-Infinity)>=DUP_EVERY-1e-9){memory.dupAt=time;resolve();}return memory;}
 const choices=new Map<string,string>();
 for(const d of choosing)choices.set(d.id,decide(d));
 for(const d of choosing)call(d.id,choices.get(d.id)??'');
 // (threat round) the man on the ball is never left to nobody: when each defender's own picture gave him to a
 // team-mate (nobody has heard a call yet), the nearest one free to go (on a role, nobody, or a man who does not
 // matter much) goes. Before, a choice where every defender read the carrier as another's could leave him unpressed
 // until the calls were heard (more often once a role tie-break separates near-equal pictures).
 if(input.carrier&&carrier===input.carrier&&!fixed.size&&![...Object.values(memory.men)].some(m=>m.target===carrier.id)){
  const go=choosing.filter(q=>!busy.has(q.id)&&(()=>{const t=memory.men[q.id]?.target;if(!t||isRole(t))return true;const a=open.find(o=>o.id===t);return !a||readMan(q,a,input,ref,true).danger<.5;})())
   .sort((a,b)=>arrivalTime(a,carrier)-arrivalTime(b,carrier)||a.id.localeCompare(b.id))[0];
  if(go)call(go.id,carrier.id);
 }
 // ... and not to two of us at once from one look (each read him as his own): the nearer keeps him, the other takes his
 // next job (a doubling second man is the cover's decision, not this choice's)
 if(input.carrier&&carrier===input.carrier){
  const on=choosing.filter(q=>memory.men[q.id]?.target===carrier.id&&!busy.has(q.id)).sort((a,b)=>arrivalTime(a,carrier)-arrivalTime(b,carrier)||a.id.localeCompare(b.id));
  for(const q of on.slice(1))call(q.id,decide(q,new Set([carrier.id])));
 }
 memory.dupAt=time;resolve();
 memory.solvedAt=time;memory.focus=focus;memory.who=who;
 return memory;
}

/** Marking and shape round (2026-10-10, evidence/2026-10-10-marking-shape).
 *
 * Near our goal (within HABIT_IN m, fading out by HABIT_FAR; a man running at
 * goal RUN_HABIT m sooner) goal-side is a standing habit:
 *  - what he follows: his man's movement towards our goal and across it; a
 *    move away from goal only when the man is coming to the ball (to receive
 *    it, he is contested there); a run away from both goal and ball (a decoy
 *    dragging him out) is held, never followed;
 *  - how far ahead he reads it: his reading (LEAD: a poor reader marks where
 *    the man was, a sharp one where he is getting to), imperfectly;
 *  - he arrives balanced: within ARRIVE m of his spot he closes no faster than
 *    the man moves plus CLOSE m/s, so a man who stops or checks does not find
 *    him overrun deep behind him (the commonest loose mark near goal);
 *  - a marker level with or upfield of his man there hurries back at full pace;
 *  - the man who matters most to him (the nearest our goal of those ahead of
 *    the ball, in his own read) gets less sag towards the ball (PRIORITY_SAG). */
export const HABIT_IN=16,HABIT_FAR=22,RUN_HABIT=4;
export const LEAD={min:.25,max:.55,spread:.15,run:.15};
export const ARRIVE=3,CLOSE=2;
export const PRIORITY_SAG=.4,SAG_REACT=.3;
/** How fully the goal-side habit holds for a man (as this defender reads his distance from our goal). */
export function habit(dg:number,running:boolean):number{return clamp((HABIT_FAR-(dg-(running?RUN_HABIT:0)))/(HABIT_FAR-HABIT_IN),0,1);}
/** The part of his man's movement a marker follows near our goal (see above). */
export function followed(v:Vec&{vx:number;vy:number},g:Vec,ball:Vec):Vec{
 const dx=g.x-v.x,dy=g.y-v.y,n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n,along=v.vx*ux+v.vy*uy;
 if(along>=0||(ball.x-v.x)*v.vx+(ball.y-v.y)*v.vy>0)return {x:v.vx,y:v.vy};
 return {x:v.vx-along*ux,y:v.vy-along*uy};
}
/** How far ahead (s) this defender reads his man near our goal: his reading, imperfectly. */
export function markLead(q:PracticePlayer,r:Pick<ManRead,'id'|'v'|'running'>,time?:number):number{
 const exact=LEAD.min+(LEAD.max-LEAD.min)*acuity(q,'threat');
 return Math.max(0,perceive(q,'threat',exact,LEAD.spread,r.v,{time,salt:`lead${r.id}`}))+(r.running?LEAD.run:0);
}

/** The passer cue (marking and shape round, item 4; the owner's decision 3 on card B1): the marker of the man a
 * pass is being prepared for reads the preparation as the runner does, at his own sight lag (his reading, his
 * legs, and late if the passer is outside his view; he is watching the ball, not a flight), and from then closes
 * goal-side of where he reads it going (CUE_SPREAD of the pass's length off for a player who cannot read the game)
 * as he does once it is struck. A preparation abandoned leaves him a step committed: a clever passer can use it. */
export const CUE_SPREAD=.3;
export function cueDelay(q:PracticePlayer,passer:Vec,ball:Vec,since:number):number{
 return sightLag(q,{energy:q.energy,inView:inView(q,lookingAt(q,ball),passer),watching:0,at:passer,time:since,salt:'cue'});
}

/** How far a marker may sag off his man and still reach him before a pass to
 * him arrives: the pass (a quick release, about 13 m/s) against his reaction
 * (his read of the game) and his legs. */
export function reach(q:PracticePlayer,man:Vec,ref:Vec,tactics:Tactics):number{
 // (marking and shape round) his reaction is a typical reader's for everyone: a sharper reader used to sag
 // FURTHER off his man (he trusted his quicker reaction), which cancelled the goal-side reading earns him
 const pass=.3+distance(ref,man)/13,react=SAG_REACT;
 const t=Math.max(0,pass-react),a=Math.max(.5,q.acceleration),v=q.pace,ramp=v/a;
 const ground=t<=ramp?.5*a*t*t:v*t-v*ramp/2;
 const r=ground*.85*SAG[tactics.marking??'balanced']*PRESS_SAG[tactics.press];
 // the far side: Width (narrow tucks in more, wide stays nearer his man), beyond the cap too
 return Math.min(SAG_CAP,r)*(Math.abs(man.y-ref.y)>8?WIDTH_SAG[tactics.width]:1);
}
const onSegment=(v:Vec,a:Vec,b:Vec):Vec=>{const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy||1,t=clamp(((v.x-a.x)*dx+(v.y-a.y)*dy)/d2,0,1);return {x:a.x+dx*t,y:a.y+dy*t};};
/** Near our goal (his man within TIGHT_IN m of the goal centre) the marker is
 * tight: MARK_GAP, never more than TIGHT_MAX m, whatever the man's pace or
 * distance; the cushions come back in over the next TIGHT_FADE m (defending-close
 * round: 5-6 m off a shooter at 10 m let him turn and shoot). */
export const TIGHT_IN=14,TIGHT_FADE=4,TIGHT_MAX=1.5;
/** A marker on his way to a man moving faster than INTERCEPT_SPEED m/s reads him INTERCEPT_SHARE of his own run ahead, up to INTERCEPT_MAX s. */
export const INTERCEPT_SPEED=1.5,INTERCEPT_SHARE=.8,INTERCEPT_MAX=1.2;
/** He sits on the side his man wants to go (his velocity, else his facing), up
 * to SIDE_SHADE m across the man's line to goal; a wide man near goal is
 * shown outside (the marker leans inside, INSIDE_LEAN). */
export const SIDE_SHADE=.35,INSIDE_LEAN=.3;
/** A man near the goal line (within LINE_NEAR m of it) is marked more and more
 * from the ball's side: goal-side of him there is the keeper's line. */
export const LINE_NEAR=5;
/** (threat round: goal-line fixes, the owner's addition) Near our goal (his man within HOLD_IN m of it) a marker
 * holds the man in front of him with the keeper behind: never more than GOAL_HOLD m goal-side of where he reads the
 * man going (plus HOLD_READ m x his misread of the game: a poor reader gives a little more), so a man who walks back
 * out of the box is followed out, as late as the marker sees it (his sight lag), instead of being watched from the
 * goal line. Where his spot is within BRAKE_NEAR m of the goal line he brakes into it: he does not carry his man's
 * run towards the line into it (the run's goalward part is dropped from what he matches), so the line is not
 * overrun. And the diagonal cover of a man within COVER_SINK m of goal who already has a marker goal-side of him
 * stands no deeper than that marker: one defender per runner. Measured on the combined build: markers sat a median
 * 3.3 m goal-side, overshot by 2-3 m, and 52% ended behind their keeper (evidence/2026-10-10-role-goalline-check). */
export const HOLD_IN=12,GOAL_HOLD=1.2,HOLD_READ=.8,BRAKE_NEAR=6,COVER_SINK=10;
/** (threat round) Tightness follows threat: a man this defender reads as a threat of TIGHT_THREAT[0] or less is
 * marked as before (cushions and sag where he is far from the ball or from goal: watched, zonally), one of
 * TIGHT_THREAT[1] or more tightly: no cushion beyond MARK_GAP (the Marking setting's distance), no sag off him,
 * moving with him (THREAT_SHARE of his velocity), closing up to CLOSE_THREAT m/s faster than the balanced arrival,
 * and at full intensity (practice-intensity). Where the ball can reach him (his reach) and the ball is near him
 * (DENY_NEAR..DENY_FAR m) the marker is goal-side AND ball-side: his direction of marking turns towards the ball by
 * up to DENY (of the ball direction blended in), so his body is in the lane as well as between the man and the goal. */
export const TIGHT_THREAT:readonly [number,number]=[.12,.3],THREAT_SHARE=.75,THREAT_LEAD_CUT=.6,CLOSE_THREAT=2,DENY=.6,DENY_NEAR=8,DENY_FAR=18;
export const threatTightness=(threat:number)=>clamp((threat-TIGHT_THREAT[0])/(TIGHT_THREAT[1]-TIGHT_THREAT[0]),0,1);
/** The marking spot: goal-side of the man on his line to the goal centre,
 * shaded to the ball and to the side he wants to go, sagging towards the
 * ball-goal line when he is far from the ball, never giving up GOALSIDE m of
 * depth along his line to goal. `sagScale` < 1 takes back part of the sag (a
 * sag that would put him beside a team-mate's man). */
export function markSpot(q:PracticePlayer,r:ManRead,ref:Vec,tactics:Tactics,defending:Side,squeeze=0,sagScale=1,time?:number):Vec{
 const g={x:world(defending,0),y:0};
 // where he is going: a runner read further ahead
 const onHim=distance(q,r.v)<2.5&&distance(q,g)<distance(r.v,g);
 // a marker still on his way runs to where the man will be when he gets there (an interception course, the
 // owner's finding B: not at where the man is now), read from his velocity as seen, never off the pitch
 // (marking and shape round) near our goal: as far ahead as he reads it, and only the man's movement towards
 // our goal and across it (a check away is held, not followed out)
 // (threat round) a threat is marked on him, not on where he is going: the read-ahead shrinks by THREAT_LEAD_CUT of
 // itself (his marker moves with him instead, THREAT_SHARE of his velocity) and no interception course is run
 const th=threatTightness(r.threat??0),cut=1-THREAT_LEAD_CUT*th;
 const hb=habit(distance(r.v,g),r.running),lead=(r.running?TRACK_LEAD:READ_AHEAD)*cut;
 let v:Vec=ahead(r.v,lead);
 if(hb>0){
  const f=followed(r.v,g,ref),t=markLead(q,r,time)*cut,near={x:r.v.x+f.x*t,y:r.v.y+f.y*t};
  v={x:v.x+(near.x-v.x)*hb,y:v.y+(near.y-v.y)*hb};
 }
 if(!onHim&&Math.hypot(r.v.vx,r.v.vy)>INTERCEPT_SPEED){
  const more=(clamp(arrivalTime(q,v)*INTERCEPT_SHARE,lead,INTERCEPT_MAX)-lead)*(1-th);
  // (only his run across or towards our goal is read further: a man coming away from goal is not followed out, his marker holds goal-side)
  const g0={x:(g.x-r.v.x),y:(g.y-r.v.y)},n0=Math.hypot(g0.x,g0.y)||1,toward=(r.v.vx*g0.x+r.v.vy*g0.y)/n0;
  const vx=r.v.vx-Math.min(0,toward)*g0.x/n0,vy=r.v.vy-Math.min(0,toward)*g0.y/n0;
  v={x:v.x+vx*more,y:v.y+vy*more};
 }
 v=inside(v);const dg=distance(v,g)||1;
 // the direction he is marked from: goal-side, and from the ball's side as the man nears the goal line
 const tg={x:(g.x-v.x)/dg,y:(g.y-v.y)/dg},db=distance(v,ref)||1,tb={x:(ref.x-v.x)/db,y:(ref.y-v.y)/db};
 const wl=clamp(1-(depth(defending,v.x)-1)/(LINE_NEAR-1),0,1);
 // (threat round) a threat the ball can reach, near the ball: goal-side and ball-side (in the lane)
 const deny=DENY*th*(r.reach??0)*clamp((DENY_FAR-distance(v,ref))/(DENY_FAR-DENY_NEAR),0,1);
 let ux=tg.x*(1-.6*wl)+tb.x*(wl+deny),uy=tg.y*(1-.6*wl)+tb.y*(wl+deny);const un=Math.hypot(ux,uy)||1;ux/=un;uy/=un;
 const u={x:ux,y:uy};
 // the cushion: his read of the man's pace against his own (a quicker man gets more room), so a run is a race he is already ahead in
 const quicker=clamp(perceive(q,'threat',(r.v as PracticePlayer).pace-q.pace,1,r.v,{salt:`pace${r.id}`})*.6,0,1.2);
 // and the further his man is from our goal, the more room he gives him towards it (the cushion grows with distance; near our goal, none)
 const far=clamp((dg-FAR_CUSHION.from)*FAR_CUSHION.rate,0,FAR_CUSHION.max);
 const fade=clamp((dg-TIGHT_IN)/TIGHT_FADE,0,1);
 // (Tight stays close whatever the man's distance or pace: CUSHION_MARKING)
 let gap=Math.min(MARK_GAP[tactics.marking??'balanced']+(quicker+far)*CUSHION_MARKING[tactics.marking??'balanced']*fade,Math.max(.6,dg-1.5));
 if(fade<1)gap=Math.min(gap,TIGHT_MAX+(gap-TIGHT_MAX)*fade);
 // (threat round) a threat is marked at the Marking setting's distance, whatever the cushions
 if(th>0)gap+=(Math.min(gap,MARK_GAP[tactics.marking??'balanced'])-gap)*th;
 let s0={x:v.x+u.x*gap,y:v.y+u.y*gap};
 // the side he wants to go: his velocity as seen (moving), else his facing; a wide man near goal is shown outside
 const n={x:-u.y,y:u.x},speed=Math.hypot(r.v.vx,r.v.vy);
 const dir=speed>1?{x:r.v.vx/speed,y:r.v.vy/speed}:{x:Math.cos((r.v as PracticePlayer).angle??0),y:Math.sin((r.v as PracticePlayer).angle??0)};
 const want=dir.x*n.x+dir.y*n.y,inward=Math.abs(v.y)>3&&dg<TIGHT_IN+TIGHT_FADE?-Math.sign(v.y)*n.y:0;
 // (he never leaves the man's shot at goal open: the shade fades out as the man nears the box, where the shot line is the job)
 const side=clamp(want*(speed>1?1.2:.6)+inward*INSIDE_LEAN,-1,1)*SIDE_SHADE*(1-fade*.5)*clamp((dg-8)/6,0,1);
 s0={x:s0.x+n.x*side,y:s0.y+n.y*side};
 const dBall=distance(v,ref);
 const tight=Math.max(clamp((ONE_PASS_FAR-dBall)/(ONE_PASS_FAR-ONE_PASS),0,1),clamp((NEAR_GOAL_FAR-dg)/(NEAR_GOAL_FAR-NEAR_GOAL),0,1),r.running?1:0,th);
 const help=onSegment(s0,ref,g),gapToHelp=distance(s0,help);
 const loose=reach(q,v,ref,tactics)*(1-.5*squeeze);
 const sag=Math.min(gapToHelp,tight*Math.min(SHADE,gapToHelp)+(1-tight)*loose)*sagScale;
 let p=gapToHelp>1e-6?{x:s0.x+(help.x-s0.x)/gapToHelp*sag,y:s0.y+(help.y-s0.y)/gapToHelp*sag}:s0;
 // (goal-line fixes) near our goal: the man held in front, never more than the hold goal-side of him
 if(dg<HOLD_IN){const hold=GOAL_HOLD+HOLD_READ*misread(q,'threat'),al=(p.x-v.x)*tg.x+(p.y-v.y)*tg.y;if(al>hold)p={x:p.x-tg.x*(al-hold),y:p.y-tg.y*(al-hold)};}
 // never level with him: at least GOALSIDE m goal-side along his line to goal
 const along=(p.x-v.x)*u.x+(p.y-v.y)*u.y,need=Math.min(GOALSIDE,dg-1);
 return along<need?{x:p.x+u.x*(need-along),y:p.y+u.y*(need-along)}:p;
}

/** Box defending (2026-10-12, evidence/2026-10-12-box-defending). With the ball near our goal the defence protects
 * the box, not only its men. Measured before (engine 3af89fa9): with their man on the ball within 10 m of our goal,
 * only 1.5 of our 4 outfielders were nearer our goal than the ball; at the strike 0.2 stood in the triangle from the
 * ball to the posts and about 80% of shots had nobody in it, under every Line; shots came from about 10 m whatever
 * the defence. Near our goal every marker stayed goal-side of his own man (markSpot's NEAR_GOAL and threat tightness),
 * so the markers of the men behind the ball stood level with it or upfield of it, and a deep block crowded nothing.
 * Futsal's priority near goal: the ball is the danger; a pass to a man who is worse placed than it can be given (it
 * becomes a shot from further out, or from a worse angle). Now, while the ball (the man on it, or where a pass to him
 * is met) is within PROTECT_R m of our goal (by the Line, fading in over PROTECT_FADE m), a marker moves from his
 * marking spot towards the shooting lane nobody covers yet: of the shooter's lanes (from the ball to PROTECT_AIMS
 * across the goal mouth) the one furthest from the presser and from team-mates already drawn into the lane, so
 * together they close the shooter's angle (one blocks, the next takes the corner he leaves open), at least
 * PROTECT_NEAR m in front of the ball (the second defender's distance: a body close to the ball covers most of the
 * goal, measured below; the presser has the first PROTECT_OFF m) and no deeper than he already is; two of us keep
 * SPACING apart (protectSpacing). He goes PROTECT of the way by the Line: a deep block collapses into the lane, a
 * standard one part of the way, a high one stays near its men to win the ball higher. The more his own man's chance from where he is (goal angle and distance, as he reads it) nears
 * the ball's, the less he goes: PROTECT_FRONT of it at an equal chance, none for a man PROTECT_BETTER times better
 * placed (the cut-back, the far post: still marked). Both are his own reads (acuity 'threat': reading and
 * defending): how much better placed his man is, off by up to PROTECT_READ (of the ratio) for a player who cannot read
 * the game, so a poor reader leaves a dangerous man for the lane or stays on a harmless one; and which lane is open,
 * its end off sideways by up to PROTECT_SPREAD m, so a sharp reader gets his body in it and a poor one beside it.
 * Only the marker's spot moves: his pace, his tackle, the shooter and the keeper are unchanged. (Measured on 4,000
 * base shots: a defender within 0.6 m of the shot line at the strike blocks 70-78% of shots and 3-5% score; 1-2 m
 * off it, 10% blocked and 19% score; nobody between, 39% score.) */
export const PROTECT_R:Record<Tactics['line'],number>={deep:19,standard:16,high:13};
export const PROTECT:Record<Tactics['line'],number>={deep:1,standard:.6,high:.3};
export const PROTECT_FADE=4,PROTECT_OFF=1.5,PROTECT_NEAR=3.5,PROTECT_FRONT=.35,PROTECT_BETTER=1.6,PROTECT_READ=.6,PROTECT_SPREAD=1.2,PROTECT_ON=.3;
/** How good a shot from here looks: goal angle times nearness (the shooter's assessShot terms, without the people). */
const openShot=(v:Vec,g:Vec)=>{const d=distance(v,g),x=Math.max(.01,Math.abs(g.x-v.x));return Math.abs(Math.atan2(GH-v.y,x)-Math.atan2(-GH-v.y,x))*clamp(1-d/45,.05,1);};
/** His share of the way to the lane, by his man's chance against the ball's (1 = the man is no better placed). */
export function protectShare(man:Vec,ball:Vec,g:Vec,q?:PracticePlayer,time?:number):number{
 const exact=openShot(man,g)/Math.max(1e-6,openShot(ball,g));
 const better=q?perceive(q,'threat',exact,PROTECT_READ,man,{time,salt:'boxman'}):exact;
 if(better<=1)return 1;if(better>=PROTECT_BETTER)return 0;
 const k=(better-1)/(PROTECT_BETTER-1);
 return k<.5?1-(1-PROTECT_FRONT)*k*2:PROTECT_FRONT*(1-(k-.5)*2);
}
/** The shot lanes a defence covers: the line from the ball to each of these points across the goal mouth (the
 * shooter's own targets, practice-football assessShot). */
export const PROTECT_AIMS=[-2.6,-1.3,0,1.3,2.6].map(y=>y*GH/3.66);
export function protectBox(q:PracticePlayer,man:Vec,aim:Vec,ball:Vec,tactics:Tactics,defending:Side,time?:number,taken:readonly Vec[]=[]):Vec{
 const g={x:world(defending,0),y:0},db=distance(ball,g);
 const zone=clamp((PROTECT_R[tactics.line]-db)/PROTECT_FADE,0,1);
 if(zone<=0||db<PROTECT_OFF+GOAL_LINE_FLOOR)return aim;
 const share=protectShare(man,ball,g,q,time)*PROTECT[tactics.line]*zone;if(share<=0)return aim;
 // the lane nobody covers yet (the one the presser and the team-mates already in the lane leave open), as he reads
 // the ball's line: its end shifted sideways by his misread
 const off=perceive(q,'threat',0,PROTECT_SPREAD,ball,{time,salt:'box'});
 const gap=(t:Vec,v:Vec)=>{const vx=t.x-ball.x,vy=t.y-ball.y,l2=vx*vx+vy*vy||1,k=((v.x-ball.x)*vx+(v.y-ball.y)*vy)/l2;return k<=0||k>=1?Infinity:Math.hypot(ball.x+vx*k-v.x,ball.y+vy*k-v.y);};
 let target=g,best=-Infinity;
 for(const y of PROTECT_AIMS){const t={x:g.x,y:y+off},c=Math.min(Infinity,...taken.map(v=>gap(t,v)));const score=Math.min(c,10)-.01*Math.abs(t.y-aim.y);if(score>best){best=score;target=t;}}
 const dt=distance(ball,target)||1,ux=(target.x-ball.x)/dt,uy=(target.y-ball.y)/dt,nx=-uy,ny=ux;
 const raw=(aim.x-ball.x)*ux+(aim.y-ball.y)*uy,along=clamp(Math.max(raw,PROTECT_NEAR),PROTECT_OFF,dt-GOAL_LINE_FLOOR);
 const across=(aim.x-ball.x)*nx+(aim.y-ball.y)*ny;
 if(Math.abs(across)<=PROTECT_ON&&raw>=along-1e-9)return aim;
 const lane={x:ball.x+ux*along,y:ball.y+uy*along};
 return {x:aim.x+(lane.x-aim.x)*share,y:aim.y+(lane.y-aim.y)*share};
}

/** Two markers drawn into the lane never stand on each other: a spot within SPACING m of one already taken is moved
 * on along the lane towards our goal until it is clear (never past GOAL_LINE_FLOOR from the line). */
export function protectSpacing(aim:Vec,taken:readonly Vec[],ball:Vec,defending:Side):Vec{
 const g={x:world(defending,0),y:0},db=distance(ball,g)||1,ux=(g.x-ball.x)/db,uy=(g.y-ball.y)/db;
 let p=aim;
 for(let k=0;k<4&&taken.some(t=>distance(t,p)<SPACING);k++){
  const next={x:p.x+ux*SPACING,y:p.y+uy*SPACING};
  if(distance(next,g)<GOAL_LINE_FLOOR+1)break;p=next;
 }
 return p;
}

/** (box defending) A defender within BOX_BLOCK_NEAR m of the man on the ball who reads a shot of danger above
 * BOX_BLOCK_DANGER coming (practice-shot-defense readShotDanger: the visible shooter's angle, distance and body, his own
 * reading setting how early he gets there) and can put his body in its lane in time, steps into it (practice.ts), as
 * the presser and the cover already did: futsal blocks shots. Not when his own man would have the better shot. */
export const BOX_BLOCK_NEAR=7,BOX_BLOCK_DANGER=.32;
/** (box defending) A defender set to block (on a 'block' job: in the shot's lane, reading it) puts a leg across it,
 * so a low shot (under BLOCK_LEG_HEIGHT m: the first metres of its flight) meets him wider than his body (0.31 m):
 * up to BLOCK_LEG m more, half of it for anyone and the rest by his defending. Measured before: a defender within
 * 0.3 m of the shot line blocked 78% of shots, 0.3-0.6 m 67%, 0.6-1 m 42%; a body alone was the whole block. */
export const BLOCK_LEG=.35,BLOCK_LEG_HEIGHT=.5;
export const blockLeg=(p:{skills:{defending:number}})=>.31+BLOCK_LEG*(.5+.5*clamp(p.skills.defending/10,0,1));
/** (box defending) A marker may leave his man to block the shot only when his man would not have the better shot. */
export function mayLeaveForBall(man:Vec,ball:Vec,defending:Side):boolean{
 const g={x:world(defending,0),y:0};return openShot(man,g)<=openShot(ball,g);
}

/** The block's height now (m from our goal), by the Line. */
export function blockDepth(tactics:Tactics,refDepth:number,squeeze:number):number{
 const b=BLOCK[tactics.line];
 return clamp(refDepth-b.gap+squeeze*b.squeeze,b.floor,b.ceiling+squeeze*b.squeeze);
}

/** B2, the presser's cover shadow (2026-10-09). "I'm alone on him: I can't
 * cover the ball and the pass, so I come at him through the pass." A presser
 * with none of his outfield team-mates within SHADOW_ALONE m of the man on the
 * ball, who sees a free man for that ball (an attacker SHADOW_NEAR-SHADOW_FAR m
 * from the carrier, none of us within SHADOW_FREE m of him or within
 * SHADOW_LANE m of the lane to him, as the presser sees him: his own picture),
 * curves his run so that his body cuts that lane: while he is more than
 * SHADOW_FROM m from the carrier his aim is pulled toward the point SHADOW_GAP
 * m from the carrier on the line to the free man (the nearest such man), by up
 * to SHADOW_PULL of the way, which his read of the play (acuity 'threat':
 * reading and defending) sets, and his nature: an eager presser
 * (engagement above the squad's typical) goes straighter at the ball and
 * curves less, a patient one more (SHADOW_EAGER per unit of eagerness). The
 * pull fades over SHADOW_FADE m as he
 * arrives, so he engages from where he always did, goal-side. Never near our
 * goal (within NEAR_BLOCK m of it the presser is the block). Only the aim of
 * his approach moves: his pace and his tackle are unchanged. */
export const SHADOW_ALONE=5,SHADOW_NEAR=5,SHADOW_FAR=20,SHADOW_FREE=4,SHADOW_LANE=1.3,SHADOW_FROM=1.5,SHADOW_FADE=3,SHADOW_GAP=1.6,SHADOW_PULL=.8,SHADOW_EAGER=.8;
export function shadowAim(presser:PracticePlayer,carrier:PracticePlayer,aim:Vec,input:Pick<DefendInput,'players'|'defending'|'view'>):Vec{
 const g={x:world(input.defending,0),y:0},d=distance(presser,carrier);
 const fade=clamp((d-SHADOW_FROM)/SHADOW_FADE,0,1);
 if(fade<=0||distance(carrier,g)<NEAR_BLOCK)return aim;
 const ours=input.players.filter(q=>q.side===presser.side&&q.role!=='GK');
 if(ours.some(q=>q.id!==presser.id&&distance(q,carrier)<SHADOW_ALONE))return aim;
 let free:Vec|undefined,best=Infinity;
 for(const a of input.players){
  if(a.side===presser.side||a.id===carrier.id||a.role==='GK')continue;
  const v=input.view(presser,a),dc=distance(v,carrier);
  if(dc<SHADOW_NEAR||dc>SHADOW_FAR||dc>=best||ours.some(q=>distance(q,v)<SHADOW_FREE))continue;
  const dx=v.x-carrier.x,dy=v.y-carrier.y,l2=dx*dx+dy*dy;
  if(ours.some(q=>{if(q.id===presser.id)return false;const u=clamp(((q.x-carrier.x)*dx+(q.y-carrier.y)*dy)/l2,0,1);return Math.hypot(carrier.x+dx*u-q.x,carrier.y+dy*u-q.y)<SHADOW_LANE;}))continue;
  free=v;best=dc;
 }
 if(!free)return aim;
 const lane={x:carrier.x+(free.x-carrier.x)/best*SHADOW_GAP,y:carrier.y+(free.y-carrier.y)/best*SHADOW_GAP};
 const k=SHADOW_PULL*acuity(presser,'threat')*clamp(1-SHADOW_EAGER*eagerness(presser),.5,1.5)*fade;
 return {x:aim.x+(lane.x-aim.x)*k,y:aim.y+(lane.y-aim.y)*k};
}

/** (keeper fix) Where the man pressing a keeper who holds the ball in his hands stands: KEEP_OFF m from him, between
 * the presser's own side of him and the line of his nearest short throw (a team-mate, not a keeper, within SHORT_THROW
 * m of him as the presser sees him: halfway in angle, so he never runs round the keeper to get on it), else on the
 * presser's own aim's line to him (goal-side), else his own line to him. */
export function keepOff(presser:PracticePlayer,carrier:PracticePlayer,aim:Vec,input:Pick<DefendInput,'players'|'view'>):Vec{
 let short:Vec|undefined,best=SHORT_THROW;
 for(const a of input.players){
  if(a.side!==carrier.side||a.id===carrier.id||a.role==='GK')continue;
  const v=input.view(presser,a),d=distance(v,carrier);
  if(d<best&&d>.1){short=v;best=d;}
 }
 const along=(v:Vec)=>{const r=distance(v,carrier);return r>.1?{x:(v.x-carrier.x)/r,y:(v.y-carrier.y)/r}:undefined;};
 const own=along(presser)??along(aim),line=short?along(short):along(aim);
 let u=line&&own?{x:line.x+own.x,y:line.y+own.y}:line??own;
 if(!u)return aim;
 let r=Math.hypot(u.x,u.y);if(r<.1){u=own!;r=1;}
 return {x:carrier.x+u.x/r*KEEP_OFF,y:carrier.y+u.y/r*KEEP_OFF};
}

/** (threat round) The picture the defence reads threat from this tick (practice-threat). A man's own marker is the
 * one the last look gave him (or the man committed to him). */
export function threatPicture(input:DefendInput):ThreatPicture{
 const owners=new Map<string,string>(),m=input.memory;
 if(m&&m.attacking===input.attacking&&m.side===input.defending)for(const [id,x] of Object.entries(m.men))if(!isRole(x.target))owners.set(x.target,id);
 for(const [id,t] of input.fixed)owners.set(t,id);
 const off=input.players.filter(a=>a.side===input.attacking&&a.role!=='GK'&&a.id!==input.carrier?.id);
 return {source:threatSource(input),defending:input.defending,time:input.time,defenders:input.players.filter(q=>q.side===input.defending),owner:id=>owners.get(id),
  attackers:reader=>off.map(a=>input.view(reader,a)),cache:new Map()};
}

/** One plan for the side without the ball: who owns whom, and where each stands. */
export function defendOutOfPossession(given:DefendInput):DefendPlan{
 // (threat round) the threat picture this plan is read from: where the next ball comes from, our players, who has whom
 const input:DefendInput=given.threat?given:{...given,threat:threatPicture(given)};
 const {players,defending,attacking,tactics,time,ball,carrier,available,busy,fixed,view}=input;
 const g={x:world(defending,0),y:0};
 const ref:Vec=carrier?{x:carrier.x,y:carrier.y}:input.receiver?input.receiver.meet:input.loose??{x:ball.x,y:ball.y};
 const memory=solveMen(input,ref);
 const plan:DefendPlan={jobs:[],marks:new Map(),memory};
 const byId=new Map(players.map(p=>[p.id,p]));
 const own=available;
 const manOf=(q:PracticePlayer)=>{const id=memory.men[q.id]?.target;return id?byId.get(id):undefined;};
 const rd=new Map<string,ManRead>();
 const readOf=(q:PracticePlayer,a:PracticePlayer)=>{const k=q.id+'>'+a.id;let r=rd.get(k);if(!r){r=readMan(q,a,input,ref,memory.men[q.id]?.target===a.id);rd.set(k,r);}return r;};
 const done=new Set<string>();
 // marks: who owns whom (a marker, the presser on his man); a cover or a doubling second man owns nobody
 const push=(j:DefendJob)=>{plan.jobs.push(j);done.add(j.player);if(j.target&&(j.purpose==='mark'||j.purpose==='drop'||j.purpose==='press'&&![...plan.marks.values()].includes(j.target)))plan.marks.set(j.player,j.target);};
 const restart=input.restart;
 // the ball pressed (a team-mate on the carrier) or played back: the block squeezes
 const pressed=!!carrier&&players.some(q=>q.side===defending&&q.role!=='GK'&&distance(q,carrier)<2.5);
 const back=!carrier&&ball.mode==='pass'&&goalward(ball,defending)<-2;
 const squeeze=pressed||back?1:0;
 const refDepth=depth(defending,ref.x),block=blockDepth(tactics,refDepth,squeeze);

 // ---- a clear run at goal (the owner's finding C): the carrier has a straight path to our goal and
 // nobody of ours is goal-side of him in it (the presser beaten, the cover gone). Defending the goal comes
 // before marking: the nearest goal-side defender who has seen it steps across into the path, and the man
 // he leaves goes to whoever was on the carrier. Each sees it on his own read: CLEAR_SEE s after the path
 // opened for the sharpest reader, up to CLEAR_SEE + CLEAR_SLOW for one who cannot read the game; a keen
 // player sees it a little sooner, a reluctant one later.
 if(carrier&&carrier.role!=='GK'&&!input.restart&&input.intent!=='delay'){
  const cg=distance(carrier,g),running=goalward(carrier,defending)>=RUN_GOALWARD;
  if(cg<CLEAR_R||running&&cg<CLEAR_R_RUN){
   const u={x:(g.x-carrier.x)/(cg||1),y:(g.y-carrier.y)/(cg||1)};
   const inPath=(q:PracticePlayer)=>{const along=(q.x-carrier.x)*u.x+(q.y-carrier.y)*u.y,across=Math.abs((q.x-carrier.x)*u.y-(q.y-carrier.y)*u.x);return along>.3&&along<cg-.5&&across<CLEAR_W+along*CLEAR_W_GROW;};
   const blocked=players.some(q=>q.side===defending&&q.role!=='GK'&&!busy.has(q.id)&&inPath(q));
   if(blocked){if(memory.clear)delete memory.clear;}
   else{
    if(memory.clear?.carrier!==carrier.id)memory.clear={carrier:carrier.id,since:time};
    const open=time-memory.clear.since;
    // (step-across round) the man who has stepped across stays the one while he can still get there goal-side: re-picking the
    // nearest every look sent two team-mates in turn, each giving the other his man (MCB s4 1:12, M11 and M7 every 0.25 s)
    const held=memory.clear.step?own.find(q=>q.id===memory.clear!.step&&!busy.has(q.id)&&distance(q,g)<cg-1):undefined;
    const sees=(q:PracticePlayer)=>CLEAR_SEE+CLEAR_SLOW*(1-acuity(q,'threat'))-CLEAR_KEEN*eagerness(q);
    // (each man's read is his own: the next one due is looked at when it falls due, so the 0.25 s planning tick does not
    // round a sharp reader's 0.3 s and a poor one's 0.5 s to the same half-second)
    const waiting=held?[]:own.filter(q=>!busy.has(q.id)&&manOf(q)?.id!==carrier.id&&distance(q,g)<cg-1&&open<sees(q));
    memory.clear={...memory.clear,next:waiting.length?memory.clear.since+Math.min(...waiting.map(sees)):undefined};
    const step=held??own.filter(q=>!busy.has(q.id)&&manOf(q)?.id!==carrier.id&&distance(q,g)<cg-1&&open>=sees(q))
     .map(q=>{const along=clamp((q.x-carrier.x)*u.x+(q.y-carrier.y)*u.y,2,Math.max(2,cg-1.5));return {q,t:arrivalTime(q,{x:carrier.x+u.x*along,y:carrier.y+u.y*along})};})
     .sort((a,b)=>a.t-b.t||a.q.id.localeCompare(b.q.id))[0]?.q;
    if(step)memory.clear={...memory.clear,step:step.id};
    if(step&&manOf(step)?.id!==carrier.id){
     const theirs=manOf(step),was=own.filter(q=>manOf(q)?.id===carrier.id);
     const say=(id:string,target:string)=>{if(target)memory.men={...memory.men,[id]:{target,since:time,pin:time+PIN}};else{const m={...memory.men};delete m[id];memory.men=m;}memory.calls={...memory.calls,[id]:[...(memory.calls[id]??[]),{target,at:time}].slice(-3)};};
     say(step.id,carrier.id);
     was.forEach((q,i)=>say(q.id,i===0&&theirs&&theirs.id!==carrier.id?theirs.id:''));
    }
   }
  }
 }

 // ---- pressure ----
 let presser:PracticePlayer|undefined,engaged=false;
 if(carrier){
  // (threat round) of two on the man on the ball, the one pressing keeps pressing unless the other gets there PRESSER_KEEP s sooner (they took turns every look)
  const keepP=(q:PracticePlayer)=>memory.presserBy===q.id&&memory.presserOf===carrier.id?PRESSER_KEEP:0;
  const claim=own.filter(q=>manOf(q)?.id===carrier.id).sort((a,b)=>(busy.has(a.id)?1:0)-(busy.has(b.id)?1:0)||arrivalTime(a,carrier)-keepP(a)-(arrivalTime(b,carrier)-keepP(b))||a.id.localeCompare(b.id));
  presser=claim[0];
  if(presser&&!restart){
   const cd=depth(defending,carrier.x),running=goalward(carrier,defending)>=RUN_GOALWARD;
   // (threat round) a carrier who can shoot or drive at our goal from where he is is engaged wherever Press would wait (the presser's own read of it)
   const threat=carrier.role!=='GK'&&input.threat?perceive(presser,'threat',carrierThreat(carrier,input.threat.defenders,defending),THREAT_SPREAD_C,carrier,{time,salt:'carrier'}):0;
   engaged=input.intent==='engage'||cd<=ENGAGE[tactics.press]+ENGAGE_LINE[tactics.line]||running||carrier.role==='GK'&&tactics.press==='aggressive'||threat>=ENGAGE_THREAT;
   // The presser beaten: the cover (or the best placed goal-side team-mate
   // whose man matters less) steps out to the ball; the beaten one recovers
   // goal-side towards the middle and takes that team-mate's man.
   // (a presser who has just missed a tackle, or bit on a feint, is beaten too: busy;
   // and near our goal one who is not between the man and the goal is no block)
   const outOfBlock=(q:PracticePlayer)=>distance(carrier,g)<NEAR_BLOCK&&(distance(q,g)>distance(carrier,g)-.3||distance(q,carrier)>BLOCK_REACH);
   const outOfBlockFor=(q:PracticePlayer)=>distance(carrier,g)<NEAR_BLOCK&&distance(q,g)>distance(carrier,g)-.3;
   // (threat round) a presser who has just stepped across (pinned) is not replaced by this check while on his way, unless he is busy
   const pinned=(memory.men[presser.id]?.pin??-Infinity)>time&&!busy.has(presser.id);
   if(engaged&&!pinned&&carrier.role!=='GK'&&input.intent!=='delay'&&(busy.has(presser.id)||isBeaten(presser,carrier,g)||outOfBlock(presser))&&(cd<28||running)){
    const step=own.filter(q=>q!==presser&&!busy.has(q.id)&&!isBeaten(q,carrier,g)&&distance(q,carrier)<11)
     .map(q=>{const m=manOf(q),r=m?readOf(q,m):undefined;return {q,score:arrivalTime(q,carrier)+(r?.matter==='danger'?.8*r.weight:0)-(q.id===memory.cover?.5:0)};})
     .sort((a,b)=>a.score-b.score||a.q.id.localeCompare(b.q.id))[0]?.q;
    if(step&&(busy.has(presser.id)||arrivalTime(step,carrier)<arrivalTime(presser,carrier)-.1)&&!outOfBlockFor(step)){
     const theirs=manOf(step);
     memory.men={...memory.men,[step.id]:{target:carrier.id,since:time,pin:time+PIN}};
     memory.calls={...memory.calls,[step.id]:[...(memory.calls[step.id]??[]),{target:carrier.id,at:time}].slice(-3)};
     if(theirs){memory.men[presser.id]={target:theirs.id,since:time,pin:time+PIN};memory.calls[presser.id]=[...(memory.calls[presser.id]??[]),{target:theirs.id,at:time}].slice(-3);}
     else{delete memory.men[presser.id];memory.calls[presser.id]=[...(memory.calls[presser.id]??[]),{target:'',at:time}].slice(-3);}
     presser=step;
    }
   }
  }
 }
 if(presser&&carrier){
  if(restart){
   // the taker cannot be tackled: his man stands at the legal distance,
   // goal-side, between the ball and the goal
   const d=distance(restart.spot,g)||1,r=restart.radius+.3;
   const aim={x:restart.spot.x+(g.x-restart.spot.x)/d*r,y:restart.spot.y+(g.y-restart.spot.y)/d*r};
   push({player:presser.id,purpose:'press',kind:'hold',aim,speed:presser.pace*.8,reason:'Mingea nu poate fi atacată încă: stă la distanța regulamentară, între minge și poartă.',target:carrier.id});
  }else if(engaged){
   const move=containMovement(presser,carrier,players as PracticePlayer[],input.intent==='engage'?{...tactics,press:'aggressive'}:tactics,carrier,input.intent);
   // show him away from the middle: a little inside him
   const shown=Math.abs(carrier.y)>2&&distance(carrier,g)>10?{x:move.aim.x,y:move.aim.y-Math.sign(carrier.y)*SHOW}:move.aim;
   // (B2) alone on him, he comes at him through the free man's lane (shadowAim)
   const aim=carrier.role==='GK'?(input.inHands?keepOff(presser,carrier,shown,input):shown):shadowAim(presser,carrier,shown,input);
   push({player:presser.id,purpose:'press',kind:move.kind,aim:inside(aim),speed:move.speed,reason:input.intent==='engage'?'Tocmai am pierdut-o: atacă imediat purtătorul.':input.intent==='delay'?'Tocmai am pierdut-o: îl ține în față și câștigă timp cât colegii se reașază.':move.reason,target:carrier.id,velocity:move.velocity});
  }else{
   const d=distance(carrier,g)||1,off=HOLD[tactics.press];
   const aim={x:carrier.x+(g.x-carrier.x)/d*off,y:carrier.y+(g.y-carrier.y)/d*off-(Math.abs(carrier.y)>2?Math.sign(carrier.y)*SHOW:0)};
   push({player:presser.id,purpose:'press',kind:'jockey',aim:inside(aim),speed:presser.pace*.85,reason:'Purtătorul e departe de poarta noastră: îl lasă să vină, rămâne între el și poartă, gata să iasă.',target:carrier.id,velocity:{x:carrier.vx,y:carrier.vy}});
  }
 }

 // (B3) a pass to be met behind every one of our outfielders, and the spot goal-side of that meeting a contesting defender aims for
 const behindLine=!carrier&&!restart&&!!input.receiver&&own.length>0&&players.filter(q=>q.side===defending&&q.role!=='GK').every(q=>depth(defending,q.x)>depth(defending,input.receiver!.meet.x));
 const contestSpot=behindLine?(()=>{const m=input.receiver!.meet,d=distance(m,g)||1;return {x:m.x+(g.x-m.x)/d*CONTEST_GOALSIDE,y:m.y+(g.y-m.y)/d*CONTEST_GOALSIDE};})():undefined;
 // how late he reads he gets there after the receiver (s), his own read of the race
 const contestRead=(q:PracticePlayer,spot:Vec)=>perceive(q,'race',arrivalTime(q,spot)-(input.theirs??Infinity),CONTEST_SPREAD,spot,{time,salt:'contest'});
 // ---- the ball: a pass or a loose ball ----
 if(!carrier&&!restart&&input.reach){
  const receiverOwner=input.receiver?own.find(q=>manOf(q)?.id===input.receiver!.id):undefined;
  const eligible=(id:string)=>{
   const q=byId.get(id);if(!q||busy.has(id)||!own.includes(q))return false;
   if(q===receiverOwner)return true;
   const m=manOf(q);if(!m)return true;
   const r=readOf(q,m);if(r.matter==='watch'||r.matter==='spare')return true;
   // his man is the one going for it
   const c=input.reach!.find(x=>x.id===id)!;
   if(distance(r.v,c.point)<COLLECT_MAN)return true;
   // a ball at his feet he clearly wins
   return distance(q,c.point)<COLLECT_NEAR&&c.score<(input.theirs??Infinity)-COLLECT_WIN;
  };
  const airborne=ball.z>.05||Math.abs(ball.vz)>.5,theirs=input.theirs??Infinity;
  // (B3) once the keeper has called it, nobody goes for it near him
  const call=input.keeperCall,clearOfKeeper=(v:Vec)=>!call||distance(v,call)>KEEPER_ZONE;
  // (collect read) a ball in the air to his man: the receiver's own defender goes for it on his own read of the race
  // (misjudged by up to COLLECT_SPREAD s), and only when he reads he meets it within duelWindow s of the receiver
  const duelling=airborne&&!!receiverOwner&&Number.isFinite(theirs);
  const window=(q:PracticePlayer)=>duelling&&q===receiverOwner?duelWindow(q)-perceive(q,'race',0,COLLECT_SPREAD,input.receiver?.meet??ball,{time,salt:'collect'})
   // (marking and shape round) a good reader and defender dares a little more for a ball he reads he gets to
   :COLLECT_MARGIN+LANE_READ.margin*laneSkill(q);
  const pick=input.reach.find(c=>eligible(c.id)&&clearOfKeeper(c.point)&&c.score<=theirs+window(byId.get(c.id)!));
  if(pick){
   plan.collector={id:pick.id,meet:pick.point};done.add(pick.id);
  }
  // (B3) a ball to be met behind our last outfielder that nobody wins outright: the one who gets there with the receiver contests his touch
  else if(behindLine&&!call&&input.receiver&&input.theirs!==undefined){
   const spot=contestSpot!;
   const free=(q:PracticePlayer)=>{if(busy.has(q.id))return false;if(q===receiverOwner)return true;const m=manOf(q);if(!m)return true;const r=readOf(q,m);return r.matter==='watch'||r.matter==='spare'||distance(r.v,input.receiver!.meet)<COLLECT_MAN;};
   const goer=own.filter(free).map(q=>({q,late:contestRead(q,spot)})).filter(c=>c.late<=CONTEST_WITHIN).sort((a,b)=>a.late-b.late||a.q.id.localeCompare(b.q.id))[0];
   if(goer){plan.collector={id:goer.q.id,meet:spot};done.add(goer.q.id);}
  }
 }

 // ---- cover ----
 let cover:PracticePlayer|undefined;
 const roleOf=(q:PracticePlayer)=>{const id=memory.men[q.id]?.target;return isRole(id)?id:undefined;};
 if(presser&&carrier&&!restart){
  const presserAim=plan.jobs.find(j=>j.player===presser!.id)!.aim;
  let point=coverPosition(presser,carrier);
  // (a carrier running at us, just after a turnover: the cover stands deeper, so one dribble does not beat both)
  const behind=COVER_BEHIND+clamp(goalward(carrier,defending),0,6)*COVER_RUN;
  if(distance(carrier,g)>14&&depth(defending,point.x)>depth(defending,presserAim.x)-behind){
   const d=distance(presserAim,g)||1;point={x:presserAim.x+(g.x-presserAim.x)/d*behind,y:presserAim.y+(g.y-presserAim.y)/d*behind};
  }
  // the cover is whoever chose it (the choice weighed it against the men); never a busy man
  const c=own.find(q=>roleOf(q)===COVER&&!done.has(q.id)&&!busy.has(q.id));
  if(c){
   cover=c;memory.cover=cover.id;
   // Aggressive doubles on a trigger, while someone else stays goal-side as balance
   let doubled=false;
   if(tactics.press==='aggressive'&&input.intent!=='delay'&&distance(presser,carrier)<4){
    const touch=clamp((Math.abs(carrier.y)-(W/2-4))/2.5,0,1),backTo=clamp((Math.cos(carrier.angle-(attacking===0?Math.PI:0))-.2)/.5,0,1);
    const loose=input.since!==undefined&&time-input.since<.8&&distance(ball,carrier)>.9?1:0,strength=Math.max(touch,backTo,loose);
    const balance=own.some(q=>q!==cover&&q!==presser&&depth(defending,q.x)<depth(defending,carrier.x)-1&&distance(q,carrier)>5);
    if(strength>0&&balance&&distance(cover,carrier)<9&&perceive(cover,'trigger',strength,DOUBLE_SPREAD,carrier,{time,salt:'double'})>=.5){
     const d=distance(cover,carrier)||1;
     push({player:cover.id,purpose:'press',kind:'press',aim:{x:carrier.x+(cover.x-carrier.x)/d*.7,y:carrier.y+(cover.y-carrier.y)/d*.7},speed:cover.pace*.94,reason:'Pressing agresiv: purtătorul e prins (la tușă, cu spatele sau după o preluare scăpată); dublează, un coleg rămâne în spate.',target:carrier.id,velocity:{x:carrier.vx,y:carrier.vy}});
     doubled=true;
    }
   }
   if(!doubled)push({player:cover.id,purpose:'cover',kind:'cover',aim:inside(point),speed:cover.pace*.9,reason:distance(carrier,g)<14?'Acoperă colegul care presează: stă pe linia șutului sau a pasei înapoi.':'Acoperă colegul care presează: în spatele lui, spre interior.',target:carrier.id,velocity:{x:carrier.vx,y:carrier.vy}});
  }else memory.cover=undefined;
 }

 // a pass on its way: the cover already takes his place behind where the receiver meets it
 if(!carrier&&!restart&&input.receiver){
  const c=own.find(q=>roleOf(q)===COVER&&!done.has(q.id)&&!busy.has(q.id)),r=byId.get(input.receiver.id);
  if(c&&r&&r.role!=='GK'){
   const point=coverPoint({...r,x:input.receiver.meet.x,y:input.receiver.meet.y},defending);
   cover=c;push({player:c.id,purpose:'cover',kind:'cover',aim:inside(point),speed:c.pace*.95,reason:'Pasa merge la un adversar: se așază în spatele celui care îl închide, spre interior.',target:r.id});
  }
 }

 // ---- markers ----
 const cueDue:number[]=[];
 // (box defending) the spots markers have taken in the shooting lane this plan, and the presser's
 const laneSpots:Vec[]=plan.jobs.filter(j=>j.purpose==='press'||j.purpose==='cover').map(j=>j.aim);
 const regroupLine=input.regroup?depth(defending,ref.x)-REGROUP_BEHIND:Infinity;
 for(const q of own){
  if(done.has(q.id))continue;
  const m=manOf(q);if(!m)continue;
  const r=readOf(q,m);
  // (settings-truth round) his man is their spare man on his own read while the team's choice still gave him to him
  // (solveMen looks again at once when it sees it: this is what is left, a read that differs from that look):
  // he gives him up ("I have nobody") and takes a free man's job below rather than standing still
  if(r.matter==='spare'){
   const men={...memory.men};delete men[q.id];memory.men=men;
   memory.calls={...memory.calls,[q.id]:[...(memory.calls[q.id]??[]),{target:'',at:time}].slice(-3)};
   continue;
  }
  // (marking and shape round) the passer getting ready to play to his man: once his own read of it falls due
  let cued:Vec|undefined;
  if(input.cue&&carrier&&carrier.id===input.cue.passer&&input.cue.target===m.id&&input.receiver?.id!==m.id){
   const due=input.cue.since+cueDelay(q,carrier,ball,input.cue.since);
   if(time>=due-1e-9){const c=input.cue.aim,spread=CUE_SPREAD*distance(carrier,c);cued={x:clamp(perceive(q,'threat',c.x,spread,c,{time:input.cue.since,salt:'cueX'+m.id}),1,L-1),y:perceive(q,'threat',c.y,spread,c,{time:input.cue.since,salt:'cueY'+m.id})};}
   else cueDue.push(due);
  }
  const closing=input.receiver?.id===m.id||!!cued;
  let aim:Vec,reason:string,hurry=false;
  if(closing&&behindLine&&input.keeperCall){
   // (B3) his keeper is coming for it: he leaves the ball to him and gets in his man's path
   const m=input.receiver!.meet,d=distance(m,r.v)||1,step=Math.min(SCREEN_STEP,d);
   aim={x:r.v.x+(m.x-r.v.x)/d*step,y:r.v.y+(m.y-r.v.y)/d*step};
   reason='Portarul iese la minge: o lasă lui și se pune în calea atacantului.';
  }else if(closing&&behindLine&&input.theirs!==undefined&&contestRead(q,contestSpot!)<=CONTEST_WITHIN){
   // (B3) he can get there with his man: he races him to the ball, goal-side, to make the touch a fight
   aim=contestSpot!;
   reason='Mingea cade în spatele lui: aleargă cu omul lui spre ea, pe partea porții, ca preluarea să fie un duel.';
  }else if(closing){
   const mt=cued??input.receiver!.meet,meet={...r.v,x:mt.x,y:mt.y},d=distance(meet,g)||1;
   aim={x:meet.x+(g.x-meet.x)/d*1,y:meet.y+(g.y-meet.y)/d*1};
   reason=cued?'Vede că purtătorul pregătește pasa spre omul lui: pleacă odată cu ea, între el și poartă.':'Pasa merge la omul lui: îl închide cât mingea e pe drum, între el și poartă.';
  }else{
   // (marking and shape round) the man who matters most to him (the nearest our goal of their men ahead of the
   // ball, as he sees them) gets less sag towards the ball
   const md=distance(r.v,g),priority=depth(defending,r.v.x)<depth(defending,ref.x)&&!players.some(a=>a.side===attacking&&a.role!=='GK'&&a.id!==m.id&&a.id!==carrier?.id&&depth(defending,view(q,a).x)<depth(defending,ref.x)&&distance(view(q,a),g)<md);
   const sagScale=priority?PRIORITY_SAG:1;
   aim=markSpot(q,r,ref,tactics,defending,squeeze,sagScale,time);
   // a sag that would put him beside a team-mate's man (two on one, his own free) is taken back
   const others=Object.entries(memory.men).filter(([id,x])=>id!==q.id&&x.target!==m.id&&!isRole(x.target)).map(([,x])=>byId.get(x.target)).filter((a):a is PracticePlayer=>!!a&&a.side===attacking&&a.id!==carrier?.id&&distance(a,r.v)>SAG_CLEAR+1);
   for(const k of [.6,.3,0]){if(!others.some(a=>distance(view(q,a),aim)<SAG_CLEAR))break;aim=markSpot(q,r,ref,tactics,defending,squeeze,k*sagScale,time);}
   // (box defending) the ball near our goal: he steps from his man towards the open shooting lane (protectBox)
   if(!restart&&!(carrier&&carrier.role==='GK')&&m.id!==carrier?.id){const was=aim;aim=protectBox(q,r.v,aim,ref,tactics,defending,time,laneSpots);if(aim!==was){aim=protectSpacing(aim,laneSpots,ref,defending);laneSpots.push(aim);}}
   // (marking and shape round) level with or upfield of his man near our goal: he hurries back goal-side, at full pace
   hurry=habit(md,r.running)>=.5&&distance(q,g)>md-.3;
   // a man level with or behind the ball beside the carrier in midfield: his marker stays goal-side of the ball, BALL_CLEAR m off it (one dribble must not beat the presser, the cover and him)
   if(!hurry&&carrier&&carrier.role!=='GK'&&m.id!==carrier.id&&distance(carrier,g)>NEAR_BLOCK&&depth(defending,r.v.x)>depth(defending,carrier.x)-1&&distance(aim,carrier)<BALL_CLEAR){
    const cg=distance(carrier,g)||1,tg={x:(g.x-carrier.x)/cg,y:(g.y-carrier.y)/cg},da=distance(aim,carrier)||1,away={x:(aim.x-carrier.x)/da,y:(aim.y-carrier.y)/da};
    let ux=away.x+tg.x,uy=away.y+tg.y;const n=Math.hypot(ux,uy)||1;ux/=n;uy/=n;
    aim={x:carrier.x+ux*BALL_CLEAR,y:carrier.y+uy*BALL_CLEAR};
   }
   reason=hurry?'Omul lui e mai aproape de poartă decât el: aleargă înapoi, între el și poartă, unde ajunge primul.':r.running?'Omul lui aleargă spre poartă: merge cu el, cu un pas spre poartă.':
    distance(r.v,ref)<ONE_PASS||distance(r.v,g)<NEAR_GOAL?'Își marchează omul: între el și poartă, aproape de el.':
    'Omul lui e departe de minge: între el și poartă, strâns spre mijloc, cât să-l prindă la o pasă.';
  }
  let purpose:DefendJob['purpose']='mark';
  if(input.regroup&&depth(defending,aim.x)>regroupLine){aim={x:world(defending,regroupLine),y:aim.y*.7};purpose='drop';reason='Regrupare: aleargă înapoi, în spatele mingii, cât colegul întârzie purtătorul.';}
  const far=distance(q,aim)>2.5,moving=Math.hypot(r.v.vx,r.v.vy)>2;
  const tt=closing?0:threatTightness(r.threat);
  const share=Math.max(r.running?RUN_VELOCITY_SHARE:VELOCITY_SHARE,THREAT_SHARE*tt);
  // (marking and shape round) near our goal he moves with what he follows of his man, and arrives balanced
  const hb=closing?0:habit(distance(r.v,g),r.running),f=hb>0?followed(r.v,g,ref):{x:r.v.vx,y:r.v.vy};
  const velocity={x:(r.v.vx+(f.x-r.v.vx)*hb)*share,y:(r.v.vy+(f.y-r.v.vy)*hb)*share};
  // (goal-line fixes) a spot near our goal line is braked into: the run's goalward part is not carried into it
  if(depth(defending,aim.x)<BRAKE_NEAR&&(g.x-aim.x)*velocity.x>0)velocity.x=0;
  let speed=q.pace*(far||moving||closing||hurry||purpose==='drop'?1:.9);
  if(hb>=.5&&!hurry&&purpose==='mark'&&distance(q,aim)<ARRIVE)speed=Math.min(speed,Math.hypot(r.v.vx,r.v.vy)+CLOSE+CLOSE_THREAT*tt);
  if(tt>=.5&&!closing&&!hurry&&purpose==='mark')reason=r.reach>=.5?'Omul lui e o amenințare: mingea poate ajunge la el și ar avea șut. Îl marchează strâns, între el și poartă, cu corpul pe linia pasei.':'Omul lui e o amenințare la poartă dacă primește: îl marchează strâns, între el și poartă.';
  push({player:q.id,purpose,kind:purpose==='drop'||hurry?'recover':'track',aim:inside(aim),speed,reason,target:m.id,velocity:purpose==='drop'?undefined:velocity,threat:r.threat});
 }

 memory.cueNext=cueDue.length?Math.min(...cueDue):undefined;

 // ---- the free men: balance, then a screen in the middle ----
 // (the one who chose the balance first, then anyone left without a man)
 const freeMen=own.filter(q=>!done.has(q.id)&&!(plan.collector?.id===q.id)&&!manOf(q)).sort((a,b)=>(roleOf(b)===BALANCE?1:0)-(roleOf(a)===BALANCE?1:0));
 // (cover-defender round) the fact the free man reads late: which men are ahead of the ball near our goal, and
 // since when. How well a team-mate holds one (goal-side of him, and not being run past) is read per defender below.
 const holdGap=(v:PracticePlayer,without:string|undefined)=>{
  let gap=Infinity;
  for(const d of players)if(d.side===defending&&d.role!=='GK'&&d.id!==without&&distance(d,g)<distance(v,g)-.3&&!runBehind(d,v,defending))gap=Math.min(gap,distance(d,v));
  return gap;
 };
 const exposed:Record<string,number>={};
 if(!restart)for(const a of players){
  if(a.side!==attacking||a.role==='GK'||a.id===carrier?.id)continue;
  if(depth(defending,a.x)>=refDepth-AHEAD||distance(a,g)>=COVER_DROP_R[tactics.line]+2)continue;
  exposed[a.id]=memory.exposed?.[a.id]??time;
 }
 memory.exposed=exposed;
 const covering=memory.drop;memory.drop=undefined;
 if(freeMen.length){
  const sgn=Math.sign(ref.y)||1;
  // an attacker nobody owns who still matters to us (a watched far man)
  const owned=new Set([...Object.values(memory.men).map(m=>m.target),...fixed.values()]);
  const loose=players.filter(a=>a.side===attacking&&a.role!=='GK'&&!owned.has(a.id)&&a.id!==carrier?.id);
  const bd=Math.min(block,refDepth-3);
  const ownerOf=(id:string,q:PracticePlayer)=>{const d=Object.entries(memory.men).find(([did,x])=>did!==q.id&&x.target===id)?.[0];return d?byId.get(d):undefined;};
  // (cover-defender round) the man he covers, on his own picture: one he has seen get ahead of the ball near our
  // goal (late, by his reading) and still reads there; a man no team-mate holds before a marked one, then the
  // nearest our goal; he keeps his man unless another is clearly more urgent
  const coverFor=(q:PracticePlayer)=>{
   if(restart)return undefined;
   const cur=covering?.by===q.id?covering.man:undefined,sees=COVER_DROP_SEE+COVER_DROP_SLOW*(1-acuity(q,'threat'));
   let best:{r:ManRead;score:number}|undefined;
   for(const a of players){
    if(a.side!==attacking||a.role==='GK'||a.id===carrier?.id)continue;
    const keep=a.id===cur;
    if(!keep&&!(exposed[a.id]!==undefined&&time-exposed[a.id]>=sees-1e-9))continue;
    const r=readOf(q,a);
    if(r.matter==='spare'||depth(defending,r.v.x)>=refDepth-AHEAD+(keep?1:0)||r.dg>=COVER_DROP_R[tactics.line]+(keep?2:0))continue;
    // the man nobody holds first (as he reads the team-mate's distance off him), then the nearest our goal; the man he covers is kept unless another is clearly more urgent
    const gap=holdGap(r.v,q.id),seen=Number.isFinite(gap)?perceive(q,'threat',gap,COVER_DROP_SPREAD*gap+.3,r.v,{time,salt:`hold${a.id}`}):Infinity;
    // (threat round) the most threatening first: COVER_DROP_THREAT m of distance per unit of threat as he reads it
    const score=r.dg-COVER_DROP_THREAT*r.threat-(seen>=COVER_DROP_NEAR?COVER_DROP_FREE:0)-(keep?COVER_DROP_KEEP:0);
    if(!best||score<best.score)best={r,score};
   }
   return best?.r;
  };
  // the diagonal cover spot: behind the man towards our goal and across his line (inside a wide man, else away
  // from his marker, else away from the ball), deeper than a goal-side marker, never in a column behind him
  const coverSpot=(q:PracticePlayer,r:ManRead):Vec=>{
   const p=inside(ahead(r.v,READ_AHEAD)),d=distance(p,g)||1,u={x:(g.x-p.x)/d,y:(g.y-p.y)/d},n={x:-u.y,y:u.x};
   const m=ownerOf(r.id,q),perp=(P:Vec)=>(P.x-p.x)*n.x+(P.y-p.y)*n.y,along=(P:Vec)=>(P.x-p.x)*u.x+(P.y-p.y)*u.y;
   const s=Math.abs(p.y)>COVER_DROP_WIDE?Math.sign(-p.y*n.y)||1:m&&Math.abs(perp(m))>.5?-Math.sign(perp(m)):Math.sign(-sgn*n.y)||1;
   let deep=Math.min(COVER_DROP_MAX,Math.max(COVER_DROP_DEEP,m&&along(m)>0?along(m)+COVER_DROP_BELOW:0),Math.max(0,d-BALANCE_FLOOR));
   // (goal-line fixes) one defender per runner: near our goal, no deeper than the man's marker
   if(m&&d<COVER_SINK&&along(m)>0)deep=Math.min(deep,along(m));
   const at=(across:number)=>({x:p.x+u.x*deep+n.x*s*across,y:p.y+u.y*deep+n.y*s*across});
   let across=COVER_DROP_ACROSS,c=at(across);
   if(m)for(let k=0;k<6;k++){
    const mg=distance(m,g)||1,off=Math.abs((c.x-m.x)*(g.y-m.y)-(c.y-m.y)*(g.x-m.x))/mg;
    if(off>=COVER_DROP_OFF||distance(c,g)>=distance(m,g))break;
    across+=.4;c=at(across);
   }
   return inside({x:world(defending,Math.max(BALANCE_FLOOR,depth(defending,c.x))),y:c.y});
  };
  const balanceAim=(q:PracticePlayer):{aim:Vec;cover?:ManRead}=>{
   // the far man nobody owns: goal-side of him, sagged towards the middle as
   // far as he can still reach him on a switch (markSpot; Width prices it)
   const far=loose.map(a=>readOf(q,a)).filter(r=>r.matter!=='spare'&&r.v.y*sgn<0).sort((a,b)=>a.dg-b.dg)[0];
   const deepest=loose.map(a=>readOf(q,a)).filter(r=>r.matter!=='spare').map(r=>depth(defending,r.v.x)).sort((a,b)=>a-b)[0];
   const cv=coverFor(q);
   if(cv&&!(far&&far.id!==cv.id&&far.dg<cv.dg-COVER_DROP_FAR))return {aim:coverSpot(q,cv),cover:cv};
   if(far){
    const spot=markSpot(q,{...far,running:false},ref,tactics,defending,squeeze),tuck=-sgn*BALANCE_Y[tactics.width];
    // never wider than his man, never on the ball's side of the middle line he tucks to
    const y=sgn<0?clamp(spot.y,tuck,Math.max(tuck,far.v.y)):clamp(spot.y,Math.min(tuck,far.v.y),tuck);
    let dd=Math.min(depth(defending,spot.x),refDepth-2);
    if(deepest!==undefined)dd=Math.min(dd,deepest-1);
    return {aim:{x:world(defending,Math.max(BALANCE_FLOOR,dd)),y}};
   }
   let dd=bd;
   // nobody unowned behind him, and a man he leaves in front of him kept a run's start away (BALANCE_CUSHION)
   if(deepest!==undefined)dd=Math.min(dd,deepest-BALANCE_CUSHION);
   return {aim:{x:world(defending,Math.max(BALANCE_FLOOR,dd)),y:-sgn*BALANCE_Y[tactics.width]}};
  };
  // (threat round) the one who had the balance in the last plan keeps it unless another free man is BALANCE_KEEP s nearer (screen and balance swapped every look)
  const ranked=freeMen.map(q=>({q,score:(roleOf(q)===BALANCE?-10:0)+(memory.balanceBy===q.id?-BALANCE_KEEP:0)+ROLE_BALANCE*(1-roleDepth(q))+arrivalTime(q,balanceAim(q).aim)})).sort((a,b)=>a.score-b.score||a.q.id.localeCompare(b.q.id));
  memory.balanceBy=ranked[0]?.q.id;
  ranked.forEach(({q},i)=>{
   if(i===0){
    const b=balanceAim(q);
    let aim=b.aim,purpose:DefendJob['purpose']='balance',reason='Echilibru: partea opusă mingii, spre mijloc, între adversari și poartă, la înălțimea blocului.';
    if(b.cover){
     memory.drop={man:b.cover.id,by:q.id};
     push({player:q.id,purpose:'balance',kind:'cover',aim,speed:q.pace*(distance(q,aim)>2?.95:.8),reason:'Acoperă în diagonală: un adversar e în fața mingii, aproape de poartă; stă în spatele lui și al colegului, spre interior, gata să iasă.',target:b.cover.id});
     return;
    }
    if(input.regroup&&depth(defending,aim.x)>regroupLine){aim={x:world(defending,regroupLine),y:aim.y};purpose='drop';reason='Regrupare: aleargă înapoi, în spatele mingii.';}
    const far=distance(q,aim)>4;
    push({player:q.id,purpose,kind:depth(defending,q.x)>depth(defending,aim.x)+4?'recover':'hold',aim:inside(aim),speed:q.pace*(far||purpose==='drop'?.95:.75),reason});
   }else{
    // a screen: the middle of our block, at its height, never within SCREEN_OFF m of the ball (the presser and the cover are there)
    // (role awareness) a forward screens higher, at the first line; a defender at the block's height
    const up=SCREEN_UP*(1-roleDepth(q)),sd=Math.min(bd+up,refDepth-SCREEN_OFF+up*.5);
    let aim={x:world(defending,Math.max(BALANCE_FLOOR,sd)),y:(Math.sign(ref.y)||1)*Math.min(2,Math.abs(ref.y)*.3)};
    const purpose:DefendJob['purpose']=input.regroup&&depth(defending,aim.x)>regroupLine?'drop':'screen';
    if(purpose==='drop')aim={x:world(defending,regroupLine),y:aim.y};
    push({player:q.id,purpose,kind:'hold',aim:inside(aim),speed:q.pace*(distance(q,aim)>4?.95:.75),reason:'Ține mijlocul: pe drumul mingii spre poartă, închide pasa prin centru.'});
   }
  });
 }

 // ---- Regroup ("On losing it"): everyone but the delayer and his cover who
 // is not yet goal-side of the ball runs behind it first, as hard as his
 // discipline takes him (a disciplined player sprints, a loose one jogs part)
 if(input.regroup)for(const j of plan.jobs){
  if(j.purpose==='press'||j.purpose==='cover')continue;
  const q=byId.get(j.player)!;if(depth(defending,q.x)<=regroupLine)continue;
  j.purpose='drop';j.kind='recover';j.velocity=undefined;
  j.aim={x:world(defending,Math.min(depth(defending,j.aim.x),regroupLine)),y:j.aim.y*.7};
  j.speed=q.pace*clamp(1-.35*(.9-followsTeam(q)),.75,1);
  j.reason='Regrupare: aleargă înapoi, în spatele mingii, cât colegul întârzie purtătorul.';
 }

 // ---- spacing: a free man never stands on a team-mate's spot ----
 const rank=(j:DefendJob)=>j.purpose==='press'?0:j.purpose==='mark'?1:j.purpose==='cover'?2:j.purpose==='drop'?3:j.purpose==='screen'?4:5;
 const sorted=plan.jobs.slice().sort((a,b)=>rank(a)-rank(b)||a.player.localeCompare(b.player));
 for(let i=1;i<sorted.length;i++){
  const j=sorted[i];if(rank(j)<2)continue;
  for(let k=0;k<i;k++){
   const o=sorted[k],d=distance(j.aim,o.aim);if(d>=SPACING)continue;
   let ux=j.aim.x-o.aim.x,uy=j.aim.y-o.aim.y;
   if(Math.hypot(ux,uy)<.05){ux=0;uy=o.aim.y>0?-1:1;}
   const n=Math.hypot(ux,uy);j.aim=inside({x:o.aim.x+ux/n*SPACING,y:o.aim.y+uy/n*SPACING});
  }
 }
 // ... nor beside a man a team-mate already has (two on one, the other free):
 // the balance and the screen keep FREE_GAP m off every owned attacker
 // (but never come out from goal-side of him to do it)
 const ownedMen=plan.jobs.filter(j=>j.target&&(j.purpose==='mark'||j.purpose==='press')).map(j=>byId.get(j.target!)).filter((a):a is PracticePlayer=>!!a);
 for(const j of plan.jobs){
  if(j.purpose!=='balance'&&j.purpose!=='screen')continue;
  for(const a of ownedMen){
   // (cover-defender round: the diagonal cover stands off the man he covers on purpose; pushing him onto that
   // man's line to goal would stack him behind the marker)
   if(j.kind==='cover'&&a.id===j.target)continue;
   const d=distance(j.aim,a);if(d>=FREE_GAP)continue;
   // step towards our goal, away from him
   const to={x:g.x-a.x,y:g.y-a.y},n=Math.hypot(to.x,to.y)||1;
   j.aim=inside({x:a.x+to.x/n*FREE_GAP,y:a.y+to.y/n*FREE_GAP});
  }
 }
 for(const j of plan.jobs)j.aim=offGoalLine(defending,j.aim,ball);
 if(presser)plan.presser=presser.id;
 if(cover)plan.coverer=cover.id;
 memory.presserBy=presser?.id;memory.presserOf=carrier?.id;
 return plan;
}
