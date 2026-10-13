import {keeperSupportCandidates} from './practice-keeper-support.js';
import {selectPossessionJobs} from './practice-job-selection.js';
import type {JobCandidate} from './practice-job-selection.js';
import {readTransition} from './practice-transition.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Side,Tactics} from './model.js';
import type {MovingBall,Vec} from './movement.js';
import type {Duty,PracticePlayer} from './practice.js';
import {arrivalTime,assignFlight,containMovement} from './practice-defense.js';
import type {DefenseAssignment,FlightAssignment} from './practice-defense.js';
import {teamShape,WIDTH,laneY,buildUpSpread,lineHeight} from './practice-shape.js';
import type {TeamShape,Sight} from './practice-shape.js';
import {assignBuildUp} from './practice-build-up.js';
import {pressureArrangement,refineReceptionSupport} from './practice-arrangements.js';
import {teammatePassObstruction} from './practice-lanes.js';
import {complementarySupportAim,timeSupportRun,readSupportLocation,shortSupportPoints,returnRunPoints} from './practice-support.js';
import type {SupportContext,SupportMove,SupportPlan} from './practice-support.js';
import type {SituationTactics} from './team-approach.js';
import {runReleaseAllowance} from './practice-awareness.js';
import {LOSS_SCALE,REST_MARGIN,isRest,lossDanger,lossRead,restDefence} from './practice-rest-defence.js';
import {eagerness,followsTeam,perceive} from './practice-perception.js';
import {flightSamples,flightMeeting,expectedPassFlight} from './practice-flight.js';
import {defendOutOfPossession,offGoalLine,REGROUP_BEHIND} from './practice-defending.js';
import type {DefendMemory} from './practice-defending.js';
export {REGROUP_BEHIND};

export type JobPurpose='break'|'playbook'|'shape'|'balance'|'zone'|'press'|'screen'|'counter-press'|'counter-screen'|'trap'|'trap-screen'|'cover'|'mark'|'receive'|'collect'|'second-ball'|'join'|'outlet'|'give-and-go'|'depth'|'link'|'overlap'|'near-post'|'far-post'|'cutback'|'build-up'|'counter-cover'|'last-man'|'width'|'drop'|'pivot'|'third-man'|'shoulder'|'wall'|'spot'|'back-post'|'edge'|'ball';
export interface FootballJob {
 player:string;purpose:JobPurpose;kind:Duty;aim:Vec;speed:number;reason:string;
 since:number;until:number;target?:string;velocity?:Vec;
 /** (threat round) a defender's read of his man's threat (practice-threat), for how hard he moves (practice-intensity). */
 threat?:number;
}
export interface CoordinationPlan {
 time:number;situation:'control'|'flight'|'contest';attacking:Side;
 jobs:Record<string,FootballJob>;shapes:[TeamShape,TeamShape];
 defense:DefenseAssignment|null;flight:FlightAssignment;marks:Map<string,string>;support:SupportPlan|null;
 pressureUntil?:number;
 /** Each side's most advanced forward, who carries the striker setting. */
 strikers?:[LeadForward,LeadForward];
 /** Each side's anchor on their last line, while its Striker setting is Pivot, In behind or Drops deep (see pivotAnchor, shoulderPost, LINK_GAP). */
 pivots?:[PivotAnchor|undefined,PivotAnchor|undefined];
 /** The side that just lost the ball, in the first seconds ("On losing it"). */
 counterPress?:CounterPress;
 /** Selective's trap (see Trap). */
 trap?:Trap;
 /** Who has the ball and since when (the trap's triggers are moments). */
 possession?:{owner:string;since:number};
 /** Since when the attacking side has had the ball. */
 attackSince?:number;
 /** Defending round (step 1): a set piece's zonal anchors, the defending
  * side's template spots (practice-restart-live setPieceTemplate). Set while
  * the restart is set up (until Infinity: not applied); at the kick they hold
  * SET_PIECE_HOLD s, each switching to a runner who enters his zone. */
 anchors?:{side:Side;until:number;aims:Record<string,Vec>;
  /** Defending-close round: each zone's name (spot, back post, edge, screen), so the job says which. */
  names?:Record<string,JobPurpose>;
  /** Defending rebuild: the template's man-marker and his man (held through the hold). */
  marks?:Record<string,string>};
 /** Defending rebuild: who has whom, and the calls made (practice-defending). */
 defending?:DefendMemory;
}
/** Selective's trap (M2, 2026-10-01). A Selective block lets harmless
 * circulation happen in front of it (assignDefense: no presser while the ball
 * is far from its goal). When the ball reaches a trigger inside its trap
 * territory it springs: the nearest defender goes at the ball (engages, like
 * a counter-press) and the next closes the carrier's open escape pass. The
 * triggers are the moments real mid-blocks press on:
 *  - touchline: the carrier near the touchline (the line is an extra man);
 *  - entry: a forward pass received centrally in front of the block;
 *  - back: the carrier received with his back to our goal... facing his own.
 * Each would-be engager reads the trigger himself (practice-perception, the
 * 'trigger' read: reading and defending; a disciplined player follows the
 * team's plan, a keen loose one sees triggers everywhere, a reluctant one
 * few), so a trap can go with one man or not at all. It is not a double
 * press on every ball: only on a trigger, at most TRAP_WINDOW seconds while
 * the same man has the ball, and then the block rests for TRAP_REST seconds;
 * and only once the attack has settled (TRAP_SETTLED seconds on the ball):
 * a trap follows circulation, it is not how a transition is defended.
 * The deepest outfielder never joins (rest defence) and instructed players are
 * never drafted. A centre-back is never the man who goes: he may only be the
 * second man, closing the escape pass once a non-centre-back has engaged
 * (combined round, 2026-10-01: centre-backs springing alone near their own
 * box were the trap's most expensive moments). */
export const TRAP_WINDOW=2.5,TRAP_REST=20,TRAP_REACH=10,TRAP_SPREAD=.6,TRAP_FRESH=1.2,TRAP_EAGER=.6,TRAP_SETTLED=5;
/** Trap territory, metres from the defending goal. No trap near our own
 * box: from 22 m out (combined round, 2026-10-01: the 20-26 m band was where a
 * beaten spring turned into a shot; it was X(28) = 12.8 m). */
export const TRAP_NEAR=22,TRAP_FAR=L*.72;
export type TrapTrigger='touchline'|'entry'|'back';
export interface Trap {side:Side;owner:string;at:number;trigger:TrapTrigger;engagers:string[];over:boolean;rest:number}
/** How clearly this moment is a trigger (0..1) for the defending side, from
 * the visible picture only. `since` is when the carrier got the ball; `from`
 * where the pass came from (the passer now), when it was a pass. */
export function trapTrigger(owner:PracticePlayer,defending:Side,time:number,since:number,from?:Vec):{trigger:TrapTrigger;strength:number}|null{
 const bd=depth(defending,owner.x);
 if(bd<TRAP_NEAR||bd>TRAP_FAR)return null;
 const fresh=clamp(1-(time-since)/TRAP_FRESH,0,1);
 const line=clamp((Math.abs(owner.y)-(W/2-4))/2.5,0,1);
 // Facing his own goal: the direction away from the goal he attacks.
 const away=defending===0?0:Math.PI,back=Math.cos(owner.angle-away);
 const turned=clamp((back-.2)/.5,0,1)*fresh;
 const gain=from?depth(defending,from.x)-bd:0;
 const entry=from&&bd<=L*.62?clamp((gain-2)/5,0,1)*clamp((9-Math.abs(owner.y))/3,0,1)*fresh:0;
 const best=Math.max(line,turned,entry);
 if(best<=0)return null;
 return {trigger:best===line?'touchline':best===entry?'entry':'back',strength:best};
}
/** Whether this defender sees the trigger (his own read of it). */
export function seesTrigger(p:PracticePlayer,strength:number,at:Vec,time:number,trigger:TrapTrigger):boolean{
 return perceive(p,'trigger',strength,TRAP_SPREAD,at,{time,salt:`trap-${trigger}`,bias:(1-followsTeam(p))*eagerness(p)*TRAP_EAGER})>=.5;
}
/** The first seconds after a loss, carried by the team's "On losing it".
 * Within COUNTER_PRESS_WINDOW of losing the ball, while the ball stays within
 * COUNTER_PRESS_ZONE of where it was lost:
 *  - Regroup: the nearest player delays (stays goal-side, in front of the
 *    ball) and everyone else drops into shape at once;
 *  - Balanced: a counter-press only with clear local superiority: more of
 *    ours than theirs within COUNTER_PRESS_NEAR of the ball (a touchline
 *    counts as one of ours);
 *  - Counter-press: a counter-press whatever the numbers, whenever one of ours
 *    is near enough to go (settings-truth round, 2026-10-04: at parity only,
 *    it fired in 29% of the seconds after a loss against Balanced's 21%, and
 *    the new defending's ordinary press already goes at a carrier in
 *    midfield, so the two looked the same on the pitch).
 * A counter-press sends the nearest player at the ball and the next to screen
 * the carrier's escape pass. The rest defence (team-mates clearly goal-side of
 * the ball, and always the deepest) is a separate budget and is never drawn
 * into it; players under an explicit instruction keep it. It ends for good the
 * moment the ball escapes the zone: whoever pressed is then out of position
 * and runs back like anyone else. */
export const COUNTER_PRESS_WINDOW=3,COUNTER_PRESS_NEAR=8,COUNTER_PRESS_ZONE=10;
/** No counter-press (nor Regroup's drop) for a ball lost within COUNTER_PRESS_OWN m of our own goal line (defending-close round). */
export const COUNTER_PRESS_OWN=16;
export interface CounterPress {side:Side;at:number;spot:Vec;mode:'engage'|'delay'|null;over:boolean;
 /** Regroup: for the whole window, even once the ball has left the zone,
  * everyone but the delayer and his cover who is not yet clearly goal-side of
  * the ball drops behind it at a run (see regroupDrops). */
 drop?:boolean}
/** Regroup's promise is "the nearest man delays, the rest drop into shape".
 * Before, the rest simply kept their ordinary jobs (ball-relative shape and
 * man-marking of attackers up the pitch), so a Regroup side had no more
 * players goal-side 1.5 and 3 s after a loss than a Balanced one (2.6 / 2.2
 * against 2.7 / 2.2) while winning the ball back far less. Now each of them
 * who is not already REST_MARGIN goal-side of the ball runs to a point
 * REGROUP_BEHIND metres goal-side of it (or deeper, at his own block slot),
 * narrowed towards the centre, at full pace. The delayer keeps a cover
 * behind him (delay and cover), and attackers ahead of the ball are left to
 * be picked up once the block is set: fewer counters, fewer balls won back. */
export function counterPressFires(onLoss:Tactics['onLoss'],ours:number,theirs:number,trapped:boolean):boolean{
 if(onLoss==='regroup'||ours<1)return false;
 return onLoss==='counterpress'||ours+(trapped?1:0)-theirs>=1;
}
/** Whether the counter-press goes is the call of the man who would go (R2),
 * not a perfect team count: he counts the men around the ball by his own
 * reading (a poor reader can be a man out either way; NUMBERS_SPREAD men for
 * one who cannot read at all), and his temperament leans on the team's rule
 * as far as his discipline lets it (a keen, undisciplined player goes a man
 * short; a reluctant one waits for more; a disciplined one follows the rule
 * the manager set). Regroup never engages. */
export const NUMBERS_SPREAD=1.5,EAGER_MEN=3;
export function counterPressRead(onLoss:Tactics['onLoss'],ours:number,theirs:number,trapped:boolean,presser:PracticePlayer,ball:Vec,time:number):boolean{
 if(onLoss==='regroup'||ours<1)return false;
 // (Counter-press is not a count: the man nearest the ball goes)
 if(onLoss==='counterpress')return true;
 const margin=ours+(trapped?1:0)-theirs-1;
 const seen=perceive(presser,'numbers',margin,NUMBERS_SPREAD,ball,{time,salt:'counter-press',bias:(1-followsTeam(presser))*eagerness(presser)*EAGER_MEN});
 return seen>=-.5;
}
/** Instruction producers can inspect coordination, but only the coordinator
 * publishes jobs. Keep this read-only boundary even for future tactics. */
export type CoordinationView=Readonly<Omit<CoordinationPlan,'jobs'|'marks'>> & {
 jobs:Readonly<Record<string,Readonly<Omit<FootballJob,'aim'>> & {readonly aim:Readonly<Vec>}>>;
 marks:ReadonlyMap<string,string>;
};
export interface CoordinationContext extends SupportContext {
 intended?:string;passer?:string;
 defensiveUnit?:import('./practice-defense.js').ReceivingAssignment['defensiveUnit'];
 /** Authored movement is proposed before ordinary jobs are allocated. The
  * preview contains shape and physical reception commitments, not a final plan. */
 responsibilities?:(preview:CoordinationView)=>SupportPlan|null;
 /** A restart being set up (practice-restart-live): the taker cannot be tackled; the wall's men are the wall's. */
 restart?:{spot:Vec;radius:number;posts?:readonly string[]};
 /** How each defender sees attackers off the ball (M3). Absent: exact. */
 sight?:Sight;
 /** B3: the defending keeper has come for the ball in flight (his aim): heard as his call. */
 keeperCall?:Vec;
 /** (marking and shape round) the man on the ball preparing a pass: to whom, where, since when (practice-defending's cue). */
 passCue?:{target:string;passer:string;aim:Vec;since:number};
}

/** A set piece's zonal anchor takes over a runner within this many metres of his spot. */
export const ANCHOR_ZONE=3;
/** The side without the ball keeps no ball-anchored block (practice-defending
 * replaces it): its shape record carries only the time, so a change of
 * possession is still seen as one. */
function restingShape(side:Side,time:number,previous?:TeamShape):TeamShape{
 const changedAt=previous&&!previous.attacking?previous.changedAt:time;
 return {side,attacking:false,time,changedAt,phase:time-changedAt<3?'recover':'block',back:0,middle:0,front:0,shift:0,focus:{x:0,y:0},slots:{}};
}
type LaneRisk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(side:Side,x:number)=>side===0?x:L-x;
const world=depth;
const inside=(p:Vec):Vec=>({x:clamp(p.x,1,(L-1)),y:clamp(p.y,-(W/2-2),(W/2-2))});
const running=(purpose:JobPurpose)=>['break','give-and-go','depth','overlap','near-post','far-post','cutback'].includes(purpose);
/** How a team's style prices a run job it is offered. Patient progression is
 * about how the ball goes forward, not about refusing to move: only runs that
 * go past the build-up (a depth run, a break) pay its cost. The return run
 * after a pass is the continuation "Short combinations" promises, so a patient
 * side values it like its close support; arriving in the box is not bypassing
 * anything, so near-post, far-post and cutback runs are neutral to it.
 * "Bodies forward" (commit) prices players committed ahead of the ball; a
 * wall-pass return beside it is not one, so it pays no commit term.
 * "Keep it" (secure transition) has ONE brake on a break after a regain: the
 * higher openness a break must show before it is offered at all
 * (readTransition). A break that clears it is a genuinely free run on goal,
 * so patience does not tax it again. */
export function runStyle(t:Pick<Tactics,'progression'|'commit'|'transition'>,purpose:JobPurpose):number{
 const bypassing=purpose==='depth'||purpose==='break'&&t.transition!=='secure';
 const progression=t.progression==='direct'?.18:t.progression==='patient'?(bypassing?-.18:purpose==='give-and-go'?.15:0):0;
 return progression+(purpose==='give-and-go'?0:(t.commit-3)*.08);
}

/** The striker setting describes the team's most advanced forward, not a role
 * label: the ST where the formation has one, otherwise (2-2) the leading
 * winger. Two wingers attacking together overtake each other all the time,
 * so the incumbent keeps the role (and with it the link job or the run-in-
 * behind bonus) until another forward has been clearly (2 m) further forward
 * for a sustained moment (1.5 s). The caller starts afresh after a restart or
 * a change of possession. */
export interface LeadForward {id:string|undefined;challenger?:string;since?:number}
export const LEAD_FORWARD_MARGIN=2,LEAD_FORWARD_HOLD=1.5;
export function leadForward(players:readonly PracticePlayer[],side:Side,time:number,previous?:LeadForward):LeadForward{
 const strikers=players.filter(p=>p.side===side&&p.role==='ST');
 const pool=strikers.length?strikers:players.filter(p=>p.side===side&&(p.role==='W'||p.role==='AM'));
 if(pool.length<2)return {id:pool[0]?.id};
 const ranked=pool.slice().sort((a,b)=>depth(side,b.x)-depth(side,a.x)||a.id.localeCompare(b.id));
 const incumbent=pool.find(p=>p.id===previous?.id),best=ranked[0];
 if(!incumbent)return {id:best.id};
 if(best.id===incumbent.id||depth(side,best.x)-depth(side,incumbent.x)<LEAD_FORWARD_MARGIN)return {id:incumbent.id};
 const since=previous?.challenger===best.id&&previous.since!==undefined?previous.since:time;
 return time-since>=LEAD_FORWARD_HOLD?{id:best.id}:{id:incumbent.id,challenger:best.id,since};
}

/** Striker: Pivot (M4, style-identity round). The lead forward is anchored to
 * the opponents' last defender, not to the ball: PIVOT_GAP metres in front of
 * the deepest opposing outfielder, central (|y| <= PIVOT_WIDTH, shading a
 * little to the ball's side), never inside PIVOT_GOAL metres of the goal line.
 * Once he is on the last defender (that defender within PIVOT_CONTACT, goal-
 * side of him) he holds the depth he took: a marker who follows him when he
 * shows would otherwise drag the anchor with him, one step at a time.
 * He shows PIVOT_SHOW metres towards the ball only when a pass to his feet is
 * on, and that is his own read (R2): the lane from the ball as he reads it
 * (his reading and passing; PIVOT_LANE_SPREAD for a player who cannot read at
 * all). A defender behind him, goal-side, is not in that lane: the pivot is
 * first at the reception and the man behind can only contest it.
 * No pivot bonus: passes into him and what he does with the ball (lay off to
 * a third man, turn, shoot) are valued by the ordinary reads. What the
 * setting asks is only where he stands: he does not drop into the build-up
 * or run in behind (PIVOT_ALSO lists the jobs he still takes: the return
 * after his own lay-off, box arrivals, a break on a regain). */
export const PIVOT_GAP=1,PIVOT_CONTACT=3,PIVOT_WIDTH=4.5,PIVOT_GOAL=5,PIVOT_SHOW=2.5,PIVOT_REACH=26,PIVOT_ON=.3,PIVOT_LANE_SPREAD=.15,PIVOT_HOLD=1;
/** A pivot needs a third man (style-identity step 1b). While the pivot is a
 * live option (showing: a pass to his feet is on), the ball is on its way to
 * him or he holds it, the others are offered lay-off spots: THIRD_BACK
 * metres on the ball side of him and THIRD_WIDE off his shoulder (5-9 m
 * away), where the man arriving faces goal. It is an offer, not a rule:
 * whether anyone goes is the ordinary valuation (the connection through the
 * pivot, lane, room, Width's lane cost, Bodies forward's price). Only spots
 * he reads he can reach by the time a lay-off could come are offered: his
 * own arrival read (R2, 'arrival', THIRD_SPREAD s for a player who cannot
 * read at all). */
export const THIRD_BACK=[4,6],THIRD_WIDE=[3.5,5.5],THIRD_SPREAD=.6,THIRD_SLACK=.6;
export function thirdManSpots(pivot:Vec,side:Side):Vec[]{
 const s=side===0?1:-1;
 return THIRD_BACK.flatMap(dx=>THIRD_WIDE.flatMap(dy=>[-dy,dy].map(y=>inside({x:pivot.x-s*dx,y:pivot.y+y}))));
}
export const PIVOT_ALSO:ReadonlySet<JobPurpose>=new Set(['give-and-go','near-post','far-post','break','link']);
export interface PivotAnchor {id:string;depth:number}
export function pivotAnchor(players:readonly PracticePlayer[],pivot:PracticePlayer,previous?:PivotAnchor,gap=PIVOT_GAP):PivotAnchor|null{
 const side=pivot.side,opponents=players.filter(q=>q.side!==side&&q.role!=='GK');
 if(!opponents.length)return null;
 const last=Math.max(...opponents.map(q=>depth(side,q.x))),own=depth(side,pivot.x);
 const onHim=opponents.some(q=>depth(side,q.x)>=last-.5&&depth(side,q.x)>own&&distance(q,pivot)<PIVOT_CONTACT);
 const held=previous?.id===pivot.id?previous.depth:undefined;
 return {id:pivot.id,depth:Math.min(L-PIVOT_GOAL,onHim&&held!==undefined?held:last-gap)};
}
/** Striker: In behind (settings round, 2026-10-03). The lead forward lives on
 * their last outfielder's shoulder and attacks the space behind him:
 *  - between runs he waits RUN_GAP in front of their deepest outfielder (the
 *    pivot's anchor, with its hold against a marker who follows him: a deep
 *    line that keeps dropping goal-side of him does not drag him in), in the
 *    channel off the nearest back-line defender's shoulder (RUN_CHANNEL to the
 *    side he already stands on, within RUN_WIDTH of the centre);
 *  - his run aims RUN_PAST metres beyond that defender, in the same channel,
 *    offered as an ordinary run (the usual reads decide whether he goes now);
 *  - when their line is already deep (less than RUN_ROOM metres from their
 *    goal line) there is no space to run into, and no run is offered: he holds.
 * There is no offside here, so the price is footballing: he is far from the
 * ball and takes none of the short jobs (outlets, joining, third-man spots):
 * no ball into his feet when the team is pressed, nothing against a deep
 * block. RUN_ALSO lists the jobs he still takes. */
export const RUN_GAP=.5,RUN_PAST=3,RUN_CHANNEL=2.5,RUN_WIDTH=6.5,RUN_ROOM=9,RUN_HOLD=.8,RUN_FIT=.5,RUN_LINE=4;
export const RUN_ALSO:ReadonlySet<JobPurpose>=new Set(['give-and-go','near-post','far-post','break','link']);
export interface Shoulder {post:Vec;run:Vec|null;last:number}
/** Striker: Drops deep, a false nine (settings round, 2026-10-03). The lead
 * forward takes a standing post between their lines, LINK_GAP metres in front
 * of their deepest outfielder (the pivot's anchor and show, at a different
 * gap): he holds it while the ball is outside their box and comes LINK_SHOW
 * metres towards the ball when, by his own read, the lane to his feet is open. Whenever he shows
 * or has the ball, the others (a winger or midfielder) are offered a run
 * beyond him into the space he left: LINK_BEYOND metres past him, at least a
 * metre past their last line, LINK_WIDE either side of him. The price is
 * fewer bodies in the box: he takes no post arrivals (LINK_ALSO). */
export const LINK_GAP=5,LINK_SHOW=4.5,LINK_HOLD=1,LINK_BEYOND=6,LINK_WIDE=Y(8);
export const LINK_ALSO:ReadonlySet<JobPurpose>=new Set(['give-and-go','break','cutback']);
/** Width in 2-1-1, the midfielder's lean (laneCost). */
export const MID_DISCIPLINE=.1,MID_SLACK=.5;
/** Behaviour round C: in Counter's regain window the lead forward reads
 * whether the ball can reach him now: the ball-winner free (nobody within
 * ~3 m or arriving within ~0.75 s) and facing forward. His read (reading;
 * WINNER_SPREAD for a player who cannot read at all). */
export const WINNER_SPREAD=.5;
export function winnerFree(p:PracticePlayer,owner:PracticePlayer,players:readonly PracticePlayer[],time:number):boolean{
 const opponents=players.filter(q=>q.side!==owner.side&&q.role!=='GK');
 if(!opponents.length)return true;
 const near=Math.min(...opponents.map(q=>distance(q,owner))),closing=Math.min(...opponents.map(q=>arrivalTime(q,owner)));
 const forward=Math.cos(owner.angle-(owner.side===0?0:Math.PI));
 const exact=Math.min(clamp((near-2.5)/1.5,0,1),clamp((closing-.5)/.5,0,1))*clamp((forward+.1)/.6,0,1);
 return perceive(p,'race',exact,WINNER_SPREAD,owner,{time,salt:'winner'})>=.5;
}
export function shoulderPost(players:readonly PracticePlayer[],runner:PracticePlayer,anchor:PivotAnchor,focus:Vec):Shoulder{
 const side=runner.side,opponents=players.filter(q=>q.side!==side&&q.role!=='GK');
 const last=Math.max(...opponents.map(q=>depth(side,q.x)));
 const line=opponents.filter(q=>depth(side,q.x)>=last-RUN_LINE).sort((a,b)=>distance(a,runner)-distance(b,runner)||a.id.localeCompare(b.id))[0];
 const lean=line?Math.sign(runner.y-line.y)||(focus.y>=0?1:-1):0;
 const y=clamp(line?line.y+lean*RUN_CHANNEL:runner.y,-RUN_WIDTH,RUN_WIDTH);
 return {post:inside({x:world(side,anchor.depth),y}),run:L-last>=RUN_ROOM?inside({x:world(side,last+RUN_PAST),y}):null,last};
}
/** The lane risk of a ball to `to`, leaving out defenders the receiver beats
 * to it: goal-side of the reception (beyond it along the lane) and further
 * from it than he is. They contest the reception; they do not cut it out. */
export function feetLaneRisk(from:Vec,to:Vec,receiver:Vec,defenders:PracticePlayer[],laneRisk:LaneRisk):number{
 const dx=to.x-from.x,dy=to.y-from.y,d2=dx*dx+dy*dy||1,mine=distance(receiver,to);
 const inLane=defenders.filter(q=>((q.x-from.x)*dx+(q.y-from.y)*dy)/d2<=1||distance(q,to)<=mine);
 return laneRisk(from,to,inLane);
}
export function pivotPoint(players:readonly PracticePlayer[],pivot:PracticePlayer,anchor:PivotAnchor,focus:Vec,passer:boolean,laneRisk:LaneRisk,time:number,step=PIVOT_SHOW):{aim:Vec;show:boolean;risk:number}{
 const side=pivot.side,hold=inside({x:world(side,anchor.depth),y:clamp(focus.y*.3,-PIVOT_WIDTH,PIVOT_WIDTH)});
 const gap=distance(focus,hold);
 if(!passer||gap<step+4||gap>PIVOT_REACH)return {aim:hold,show:false,risk:1};
 const show=inside({x:hold.x+(focus.x-hold.x)/gap*step,y:hold.y+(focus.y-hold.y)/gap*step});
 const exact=feetLaneRisk(focus,show,pivot,players.filter(q=>q.side!==side),laneRisk);
 const risk=clamp(perceive(pivot,'lane',exact,PIVOT_LANE_SPREAD,show,{time,salt:'pivot'}),0,1);
 return risk<PIVOT_ON?{aim:show,show:true,risk}:{aim:hold,show:false,risk};
}

/** Behaviour round B (2026-10-03): the long ball in the air, from the side
 * defending it. Within its flight every defender reads where it will come down
 * (the first point after its apex at head height or lower, his own read: off
 * by up to DROP_SPREAD m for a player who cannot read the game) and:
 *  - the defender going for it who cannot be first (the attacker the defence
 *    sees as first meets it earlier) goes to contest the reception instead
 *    of the later part of the flight, when he reads he gets there within
 *    CONTEST_WITHIN s of the receiver: the challenge model then decides the
 *    first touch;
 *  - one more defender who is not marking a dangerous man (one goal-side of
 *    the drop or within DANGER_NEAR m of our goal) and reads that he reaches
 *    the drop zone (DROP_BEHIND m goal-side of the landing) within
 *    CONTEST_WITHIN s of the ball takes the second-ball job there, the same
 *    job the kicking side already gets. Nothing about the pass changes. */
export function coordinateFlight(players:PracticePlayer[],ball:MovingBall,side:Side,unavailable:ReadonlySet<string>,context:CoordinationContext,previous?:FlightAssignment):FlightAssignment {
 const flight=assignFlight(players,ball,side,unavailable,{intended:context.intended,passer:context.passer,previous:previous?.receiver,defensiveUnit:context.defensiveUnit});
 if(ball.owner||ball.mode==='shot'||ball.z>.05||Math.abs(ball.vz)>.5)return flight;
 const speed=Math.hypot(ball.vx,ball.vy),stop={x:ball.x+ball.vx*speed/1.3,y:ball.y+ball.vy*speed/1.3};
 if(stop.x<0||stop.x>L||Math.abs(stop.y)>W/2)return flight;
 // A slow/stopped ball can outlast the interception horizon. Estimate the
 // opposition's collector independently of its intended/previous receiver.
 if(!flight.observedReceiver){
  flight.observedReceiver=players.filter(p=>p.side===side&&p.role!=='GK'&&!unavailable.has(p.id))
   .sort((a,b)=>arrivalTime(a,stop)-arrivalTime(b,stop)||a.id.localeCompare(b.id))[0]?.id;
  if(flight.observedReceiver)flight.observedMeeting=stop;
 }
 for(const team of [0,1] as const){
  if(flight.hunters.some(id=>players.find(p=>p.id===id)?.side===team))continue;
  const candidates=players.filter(p=>p.side===team&&p.role!=='GK'&&!unavailable.has(p.id))
   .map(p=>({p,score:arrivalTime(p,stop)-(previous?.hunters.includes(p.id)?.25:0)})).sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
  // the defence's reads of a ball rolling to a stop (practice-defending chooses among them)
  if(team!==side&&!flight.defenders?.length)flight.defenders=candidates.map(c=>({id:c.p.id,point:stop,score:arrivalTime(c.p,stop)}));
  if(team===side&&flight.theirs===undefined&&candidates[0])flight.theirs=arrivalTime(candidates[0].p,stop);
  const p=candidates[0]?.p;if(!p)continue;
  flight.hunters.push(p.id);flight.meetings[p.id]=stop;if(team===side)flight.receiver=p.id;
 }
 return flight;
}

/** Defending rebuild (2026-10-03, point 5): rest defence while in possession.
 * The side with the ball always keeps REST_GUARDS (by Bodies forward: two for
 * 1-2, one otherwise) of its outfielders goal-side of the opponents' most
 * advanced forward, whenever he is ahead of the ball (nearer our goal than it):
 * a turnover must never leave him alone in front of our goal. When the
 * ordinary jobs already leave enough men there, nothing changes. Otherwise the
 * best placed player whose job is support or shape (never a run: Direct's runs
 * and passes stay as they are, never the man on the ball or the receiver)
 * drops to a spot REST_CUSHION m (by the Line) goal-side of that forward,
 * tucked towards the middle. Each guard reads the forward as he sees him. */
export const REST_GUARDS=(commit:number)=>commit<=2?2:1;
export const REST_CUSHION:Record<Tactics['line'],number>={deep:2.5,standard:1.5,high:1};
const REST_FREE:ReadonlySet<JobPurpose>=new Set(['shape','build-up','counter-cover','outlet','width','link','second-ball','join','third-man']);
export function restGuards(players:readonly PracticePlayer[],side:Side,focus:Vec,t:Tactics,jobs:Readonly<Record<string,FootballJob>>,mates:readonly PracticePlayer[],time:number):{player:string;aim:Vec;speed:number;reason:string;target:string}[]{
 const bd=depth(side,focus.x);
 const forwards=players.filter(q=>q.side!==side&&q.role!=='GK').sort((a,b)=>depth(side,a.x)-depth(side,b.x)||a.id.localeCompare(b.id));
 const need=REST_GUARDS(t.commit),cushion=REST_CUSHION[t.line];
 const out:{player:string;aim:Vec;speed:number;reason:string;target:string}[]=[];
 const used=new Set<string>();
 for(let k=0;k<need;k++){
  const f=forwards[Math.min(k,forwards.length-1)];if(!f)break;
  const fd=depth(side,f.x);
  // he is behind the ball (further from our goal than it): nothing to guard
  if(fd>=bd-1)continue;
  const line=fd-cushion;
  const goalSide=(id:string)=>{const j=jobs[id];const p=mates.find(q=>q.id===id);return !!j&&!!p&&depth(side,j.aim.x)<=line+.3&&depth(side,p.x)<=fd+2;};
  const already=mates.filter(p=>!used.has(p.id)&&goalSide(p.id));
  if(already.length>k){for(const p of already.slice(0,1))used.add(p.id);continue;}
  const aim=inside({x:world(side,Math.max(2.5,line)),y:f.y*.6});
  const pick=mates.filter(p=>!used.has(p.id)&&REST_FREE.has(jobs[p.id]?.purpose??'shape'))
   .map(p=>({p,score:arrivalTime(p,aim)+(p.role==='CB'||p.role==='DM'?0:.6)+(jobs[p.id]?.purpose==='counter-cover'?-.4:0)}))
   .sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id))[0]?.p;
  if(!pick)continue;
  used.add(pick.id);
  out.push({player:pick.id,aim,speed:pick.pace*(distance(pick,aim)>4?.9:.75),reason:'Echilibru în atac: rămâne între atacantul lor cel mai avansat și poarta noastră, pentru cazul în care pierdem mingea.',target:f.id});
 }
 return out;
}
/** Trial policy. This returns final ordinary off-ball jobs, replacing the
 * legacy offball + support + marking target overwrite path. Timed physical
 * actions (a committed challenge, a dive, receiving stance) may interrupt it.
 *
 * Team responsibility and switching persistence follow the mechanisms reviewed
 * in GRF/YSoccer/RoboCup; this is our bounded adaptation, not a source port.
 * Default job descriptions are also the future playbook's integration boundary.
 */
export function coordinateFootball(players:PracticePlayer[],ball:MovingBall,lastSide:Side,tactics:[Tactics,Tactics],laneRisk:LaneRisk,context:CoordinationContext,previous:CoordinationPlan|null=null,unavailable:ReadonlySet<string>=new Set()):CoordinationPlan {
 const {time}=context,owner=players.find(p=>p.id===ball.owner),attacking=owner?.side??lastSide;
 const situation=owner?'control':ball.mode==='pass'?'flight':'contest';
 const sight=context.sight;
 // A defender's picture of an attacker off the ball is his own, a moment old
 // (M3). The carrier is the ball: always exact.
 const seen=(p:PracticePlayer,q:PracticePlayer,before?:number)=>sight&&q.id!==owner?.id&&p.side!==q.side?sight(p,q,before):q;
 // Defending rebuild (2026-10-03): the side without the ball has no
 // ball-anchored block any more (practice-defending replaces it); its shape
 // record only carries the time, for the possession-change bookkeeping.
 const defendingSide=(1-attacking) as Side;
 const shapes=[0,1].map(side=>side===defendingSide?restingShape(side as Side,time,previous?.shapes[side]):teamShape(players,ball,attacking,side as Side,tactics[side],time,previous?.shapes[side]??null,unavailable)) as [TeamShape,TeamShape];
 const flight=owner?{hunters:[],meetings:{},coverer:''} as FlightAssignment:coordinateFlight(players,ball,attacking,unavailable,context,previous?.flight);
 // The defence's own cover of a flight is practice-defending's (it never takes a marker off a dangerous man).
 if(!owner){flight.coverer='';delete flight.coverAim;}
 const jobs:Record<string,FootballJob>={},reserved=new Set<string>(unavailable),instructed=new Set<string>();
 const held=previous&&previous.attacking===attacking?previous.strikers:undefined;
 const strikers=[0,1].map(side=>leadForward(players,side as Side,time,held?.[side])) as [LeadForward,LeadForward];
 const pivots:[PivotAnchor|undefined,PivotAnchor|undefined]=[undefined,undefined];
 const put=(p:PracticePlayer,purpose:JobPurpose,kind:Duty,aim:Vec,speed:number,reason:string,target?:string,velocity?:Vec,lifetime=2)=>{
  if(instructed.has(p.id))return;
  const old=previous?.jobs[p.id],continuing=old?.purpose===purpose&&old.target===target&&old.until>time;
  jobs[p.id]={player:p.id,purpose,kind,aim:inside(aim),speed,reason,target,velocity,since:continuing?old.since:time,until:continuing?old.until:time+lifetime};
  if(purpose!=='shape')reserved.add(p.id);
 };
 // One baseline for the side with the ball. There is no second generic run/show chooser after this.
 for(const p of players){
  const slot=shapes[p.side].slots[p.id];if(!slot||p.id===owner?.id||p.side!==attacking)continue;
  put(p,'shape',slot.kind,slot.aim,slot.speed,slot.reason);
 }
 // The manager commits responsibilities before the rest of the team chooses
 // complementary work. Reception and unavailable physical states take priority.
 const proposed=context.responsibilities?.({time,situation,attacking,jobs,shapes,flight,defense:null,marks:new Map(),support:null});
 for(const move of proposed?.moves??[]){
  const p=players.find(p=>p.id===move.player);
  if(!p||p.side!==proposed!.side||p.id===owner?.id||unavailable.has(p.id)||flight.hunters.includes(p.id)||flight.receiver===p.id||
   move.until<=time||!Number.isFinite(move.until)||!Number.isFinite(move.since)||!Number.isFinite(move.aim.x)||!Number.isFinite(move.aim.y)||!Number.isFinite(move.speed))continue;
  const purpose:JobPurpose=move.purpose==='channel'?'depth':move.purpose==='recycle'||move.purpose==='recovery-outlet'?'outlet':move.purpose;
  jobs[p.id]={...move,purpose,target:move.defensive?.target,aim:inside(move.aim),speed:clamp(move.speed,0,p.pace)};
  instructed.add(p.id);reserved.add(p.id);
 }
 const fixedMarks=new Map<string,string>(),fixedPressers:string[]=[];
 for(const move of proposed?.moves??[]){
  if(!instructed.has(move.player)||!move.defensive)continue;
  const p=players.find(p=>p.id===move.player)!;if(p.side===attacking)continue;
  if(move.defensive.kind==='press'&&owner&&move.defensive.target===owner.id)fixedPressers.push(p.id);
  if(move.defensive.kind==='mark'&&players.some(q=>q.id===move.defensive!.target&&q.side===attacking&&q.id!==owner?.id))fixedMarks.set(p.id,move.defensive.target!);
 }
 const defending=defendingSide;
 const ordinaryUnavailable=new Set([...unavailable,...instructed]);
 // "On losing it": the side that has just lost the ball (see CounterPress).
 const lostAt=context.recoveredAt;let counterPress:CounterPress|undefined;
 // (lost near our own goal: no counter-press and no Regroup drop; the ordinary defending owns the men in front of goal at once)
 if(lostAt>=0&&time>=lostAt&&time-lostAt<COUNTER_PRESS_WINDOW&&depth(defendingSide,(previous?.counterPress?.side===defendingSide&&previous.counterPress.at===lostAt?previous.counterPress.spot:ball).x)>=COUNTER_PRESS_OWN){
  const onLoss=tactics[defending].onLoss??'balanced';
  const held=previous?.counterPress?.side===defending&&previous.counterPress.at===lostAt?previous.counterPress:undefined;
  // (step-across round) and it is over once the ball is carried within COUNTER_PRESS_OWN of our goal: there the ordinary
  // defending owns the man on the ball (a beaten goer chasing him from behind left nobody pressing goal-side, MCB s4 1:13)
  const spot=held?.spot??{x:ball.x,y:ball.y},near=depth(defending,ball.x)<COUNTER_PRESS_OWN,over=!!held?.over||distance(ball,spot)>COUNTER_PRESS_ZONE||near;
  let mode=over?null:held?.mode??null;
  if(!mode&&!over&&owner&&owner.role!=='GK'){
   if(onLoss==='regroup')mode='delay';
   else{
    const near=(side:Side)=>players.filter(p=>p.side===side&&p.role!=='GK'&&!(side===defending&&unavailable.has(p.id))&&distance(p,ball)<COUNTER_PRESS_NEAR).length;
    // The man who would go at the ball makes the call (counterPressRead).
    const bd=depth(defending,ball.x),outfield=players.filter(p=>p.side===defending&&p.role!=='GK');
    const deepest=outfield.slice().sort((a,b)=>depth(defending,a.x)-depth(defending,b.x)||a.id.localeCompare(b.id))[0];
    const goer=outfield.filter(p=>!unavailable.has(p.id)&&!instructed.has(p.id)&&p.id!==deepest?.id&&depth(defending,p.x)>=bd-REST_MARGIN&&distance(p,ball)<COUNTER_PRESS_NEAR+4)
     .sort((a,b)=>arrivalTime(a,owner)-arrivalTime(b,owner)||a.id.localeCompare(b.id))[0];
    if(goer?counterPressRead(onLoss,near(defending),near(attacking),Math.abs(ball.y)>W/2-3,goer,spot,lostAt):counterPressFires(onLoss,near(defending),near(attacking),Math.abs(ball.y)>W/2-3))mode='engage';
   }
  }
  counterPress={side:defending,at:lostAt,spot,mode,over,...(onLoss==='regroup'&&!near?{drop:true}:{})};
 }
 // Selective's trap (see Trap).
 const possession=owner?(previous?.possession?.owner===owner.id?previous.possession:{owner:owner.id,since:time}):undefined;
 const attackSince=previous?.attacking===attacking?previous.attackSince??previous.time:time;
 let trap:Trap|undefined;
 {
  const held=previous?.trap?.side===defending?previous.trap:undefined;
  const rest=held?held.over?held.rest:time+TRAP_REST:-Infinity;
  if(held&&!held.over&&owner&&owner.id===held.owner&&time-held.at<TRAP_WINDOW)trap=held;
  else if(held&&!held.over)trap={...held,over:true,rest:time+TRAP_REST};
  else if(held&&time<held.rest)trap=held;
  if((!trap||trap.over&&time>=trap.rest)&&owner&&owner.role!=='GK'&&possession&&tactics[defending].press==='selective'&&!counterPress?.mode&&time>=rest&&time-attackSince>=TRAP_SETTLED){
   const from=context.lastPass&&context.lastPass.to===owner.id&&time-context.lastPass.at<TRAP_FRESH?players.find(p=>p.id===context.lastPass!.from):undefined;
   const read=trapTrigger(owner,defending,time,possession.since,from);
   if(read){
    const outfield=players.filter(p=>p.side===defending&&p.role!=='GK');
    const deepest=outfield.slice().sort((a,b)=>depth(defending,a.x)-depth(defending,b.x)||a.id.localeCompare(b.id))[0];
    const near=outfield.filter(p=>!unavailable.has(p.id)&&!instructed.has(p.id)&&p.id!==deepest?.id&&distance(p,owner)<TRAP_REACH)
     .sort((a,b)=>arrivalTime(a,owner)-arrivalTime(b,owner)||a.id.localeCompare(b.id));
    const sees=(p:PracticePlayer)=>seesTrigger(p,read.strength,owner,time,read.trigger);
    // The nearest non-centre-back who sees it goes; then the nearest other
    // man who sees it (a centre-back may be this one) closes the escape.
    const lead=near.find(p=>p.role!=='CB'&&sees(p)),second=lead?near.find(p=>p!==lead&&sees(p)):undefined;
    const engagers=[lead,second].filter((p):p is PracticePlayer=>!!p).map(p=>p.id);
    if(engagers.length)trap={side:defending,owner:owner.id,at:time,trigger:read.trigger,engagers,over:false,rest:Infinity};
   }
  }
 }
 const trapping=!!trap&&!trap.over&&!!owner&&trap.owner===owner.id;
 let defense:DefenseAssignment|null=null;const marks=new Map<string,string>();let defendingMemory:DefendMemory|undefined;
 // Defending round (step 1): after a set piece's kick its zonal anchors hold
 // their spot SET_PIECE_HOLD s, switching to a runner who enters their zone
 // (ANCHOR_ZONE m); the template's man-marker keeps his man. The others (the
 // man at the ball against the short option) decide as in open play.
 const anchors=previous?.anchors&&previous.anchors.side===defending&&Number.isFinite(previous.anchors.until)&&time<previous.anchors.until?previous.anchors:undefined;
 const anchored=new Set<string>();
 if(anchors)for(const [id,spot] of Object.entries(anchors.aims)){
  const p=players.find(q=>q.id===id);if(!p||p.side!==defending||unavailable.has(p.id)||instructed.has(p.id))continue;
  anchored.add(p.id);
  const runner=players.filter(q=>q.side===attacking&&q.role!=='GK'&&q.id!==owner?.id).map(q=>({q,v:seen(p,q)})).filter(c=>distance(c.v,spot)<ANCHOR_ZONE).sort((a,b)=>distance(a.v,spot)-distance(b.v,spot)||a.q.id.localeCompare(b.q.id))[0];
  if(runner){
   const g={x:world(defending,0),y:0},d=distance(runner.v,g)||1,aim=offGoalLine(defending,{x:runner.v.x+(g.x-runner.v.x)/d,y:runner.v.y+(g.y-runner.v.y)/d},ball);
   marks.set(p.id,runner.q.id);put(p,'mark','track',aim,p.pace*.94,'Fază fixă: un adversar a intrat în zona lui; îl preia, între el și poartă.',runner.q.id,{x:runner.v.vx,y:runner.v.vy});
  }else put(p,anchors.names?.[id]??'zone','hold',spot,p.pace*.85,'Fază fixă: își ține zona până se lămurește mingea.');
 }
 const locked=new Map<string,string>(anchors?.marks?Object.entries(anchors.marks).filter(([id,t])=>players.some(p=>p.id===id&&p.side===defending&&!unavailable.has(id)&&!instructed.has(id))&&players.some(q=>q.id===t&&q.id!==owner?.id)):[]);
 // ---- the side without the ball (practice-defending) ----
 {
  const pressing=!!owner&&counterPress?.mode==='engage'&&owner.role!=='GK',delaying=!!owner&&counterPress?.mode==='delay'&&owner.role!=='GK';
  // A counter-press, a trap or an order commits its own players first: the
  // goer at the ball, and the next closing the carrier's escape pass.
  let pressers=owner?fixedPressers:[],screener:PracticePlayer|undefined;
  if(owner&&trapping&&!pressing){
   const [first,second]=trap!.engagers.map(id=>players.find(p=>p.id===id)).filter((p):p is PracticePlayer=>!!p&&!ordinaryUnavailable.has(p.id));
   if(!pressers.length&&first)pressers=[first.id];
   screener=second&&!pressers.includes(second.id)?second:undefined;
  }
  if(owner&&pressing){
   const bd=depth(defending,ball.x),outfield=players.filter(p=>p.side===defending&&p.role!=='GK');
   const deepest=outfield.slice().sort((a,b)=>depth(defending,a.x)-depth(defending,b.x)||a.id.localeCompare(b.id))[0];
   const eligible=outfield.filter(p=>!ordinaryUnavailable.has(p.id)&&p.id!==deepest?.id&&depth(defending,p.x)>=bd-REST_MARGIN&&distance(p,ball)<COUNTER_PRESS_NEAR+4)
    .sort((a,b)=>arrivalTime(a,owner)-arrivalTime(b,owner)||a.id.localeCompare(b.id));
   if(!pressers.length&&eligible[0])pressers=[eligible[0].id];
   screener=eligible.find(p=>!pressers.includes(p.id));
  }
  const fixedPresser=owner?pressers.map(id=>players.find(p=>p.id===id)).find((p):p is PracticePlayer=>!!p&&!ordinaryUnavailable.has(p.id)||!!p&&fixedPressers.includes(p.id)):undefined;
  const springing=trapping&&!pressing&&!!fixedPresser&&!fixedPressers.includes(fixedPresser.id);
  const engaging=(pressing||springing)&&!!fixedPresser&&!fixedPressers.includes(fixedPresser.id);
  const fixedOwn=new Map<string,string>(fixedMarks);
  if(owner&&fixedPresser&&!instructed.has(fixedPresser.id)){
   // the goer (counter-press, trap) presses here; the rest decide around him
   const move=containMovement(fixedPresser,owner,players,{...tactics[defending],press:'aggressive'},owner,'engage');
   // (settings close-out) the reason says what the numbers are: Counter-press goes whatever they are
   const around=(side:Side)=>players.filter(p=>p.side===side&&p.role!=='GK'&&distance(p,ball)<COUNTER_PRESS_NEAR).length,up=around(defending)>around(attacking);
   put(fixedPresser,springing?'trap':'counter-press',move.kind,move.aim,move.speed,springing?'Capcana: mingea a intrat unde o așteptam; atacă purtătorul, colegul închide ieșirea.':up?'Tocmai am pierdut-o, suntem mai mulți lângă minge: atacă imediat purtătorul.':'Tocmai am pierdut-o: atacă imediat purtătorul, deși nu suntem mai mulți lângă minge; cei din spate rămân în spatele mingii.',owner.id,move.velocity);
  }
  if(owner&&fixedPresser)fixedOwn.set(fixedPresser.id,owner.id);
  if(owner&&engaging&&screener){
   // He closes the escape pass he sees: the outlet as he last saw it (M3).
   const outlets=players.filter(q=>q.side===attacking&&q.id!==owner.id&&q.role!=='GK'&&!Array.from(fixedMarks.values()).includes(q.id)&&distance(q,owner)<18);
   const screen=outlets.map(q=>{
    const v=seen(screener!,q),d=distance(v,owner),aim={x:v.x+(owner.x-v.x)/Math.max(.1,d)*2,y:v.y+(owner.y-v.y)/Math.max(.1,d)*2};
    return {q:v,aim,score:arrivalTime(screener!,aim)+laneRisk(owner,v,players.filter(r=>r.side!==attacking))};
   }).filter(c=>distance(screener!,c.aim)<14).sort((a,b)=>a.score-b.score||a.q.id.localeCompare(b.q.id))[0];
   if(screen){put(screener,springing?'trap-screen':'counter-screen','track',screen.aim,screener.pace*.9,springing?'Capcana: colegul atacă mingea; închide pasa de ieșire a purtătorului.':'Colegul atacă mingea după pierdere: închide pasa de ieșire a purtătorului.',screen.q.id,{x:screen.q.vx,y:screen.q.vy});fixedOwn.set(screener.id,screen.q.id);}
  }
  // Everyone else decides for himself: the busy ones too (they keep their men).
  const deciding=players.filter(p=>p.side===defending&&p.role!=='GK'&&!instructed.has(p.id)&&!fixedOwn.has(p.id)&&!context.restart?.posts?.includes(p.id)&&!anchored.has(p.id));
  const receiverId=!owner&&ball.mode==='pass'?flight.observedReceiver:undefined,meet=receiverId?flight.observedMeeting:undefined;
  const loose=!owner&&!(ball.mode==='pass'&&meet)?(flight.defenders?.[0]?.point??{x:ball.x,y:ball.y}):undefined;
  const plan=defendOutOfPossession({players,defending,attacking,tactics:tactics[defending],time,ball,carrier:owner,receiver:receiverId&&meet?{id:receiverId,meet}:undefined,loose,
   available:deciding,busy:unavailable,fixed:fixedOwn,locked,view:seen,memory:previous?.defending,intent:engaging?undefined:delaying?'delay':undefined,regroup:!!counterPress?.drop,
   restart:context.restart,since:possession?.since,reach:owner?undefined:flight.defenders,theirs:flight.theirs,keeperCall:owner?undefined:context.keeperCall,cue:owner?context.passCue:undefined});
  defendingMemory=plan.memory;
  for(const j of plan.jobs){const p=players.find(q=>q.id===j.player)!;put(p,j.purpose,j.kind,j.aim,j.speed,j.reason,j.target,j.velocity);if(j.threat!==undefined&&jobs[p.id]&&!instructed.has(p.id))jobs[p.id].threat=j.threat;}
  for(const [id,t] of plan.marks)marks.set(id,t);
  for(const [id,t] of fixedOwn)if(!marks.has(id))marks.set(id,t);
  if(owner)defense={owner:owner.id,presser:fixedPresser?.id??plan.presser??'',coverer:plan.coverer??''};
  if(!owner){
   // the defence's one man for the ball (or nobody, when nobody free to go can get there)
   const theirs=flight.hunters.filter(id=>players.find(p=>p.id===id)?.side===defending);
   for(const id of theirs){flight.hunters.splice(flight.hunters.indexOf(id),1);delete flight.meetings[id];}
   if(plan.collector){flight.hunters.push(plan.collector.id);flight.meetings[plan.collector.id]=plan.collector.meet;const p=players.find(q=>q.id===plan.collector!.id)!;put(p,'collect','intercept',plan.collector.meet,p.pace*.94,'Poate ajunge primul la minge și omul lui nu e în pericol: se duce după ea.');}
  }
 }
 if(!owner){
  for(const id of flight.hunters){
   const p=players.find(p=>p.id===id)!;if(p.side===defending)continue;
   const receiving=ball.mode==='pass'&&id===flight.receiver;
   put(p,receiving?'receive':'collect',receiving?'receive':'intercept',flight.meetings[id],p.pace*.94,
    receiving?'Își asumă primirea; colegii pregătesc continuarea.':'Este responsabil de mingea liberă; caută punctul de întâlnire.');
  }
  // The side that had it supports its challenger. Neither assumes it has won the ball.
  {
   const side=attacking;
   const hunter=players.find(p=>p.side===side&&flight.hunters.includes(p.id));
   if(hunter){
    const point=flight.meetings[hunter.id];
    // A routine delivery needs continuation angles. Reserve a second-ball
    // player only when the visible arrival is contested or difficult.
    const opponents=players.filter(p=>p.side!==side),receiverArrival=arrivalTime(hunter,point);
    const clearDelivery=ball.mode==='pass'&&hunter.id===flight.receiver&&ball.z<.25&&Math.abs(ball.vz)<1&&
     (distance(ball,point)<1.2||laneRisk(ball,point,opponents,Math.max(1,Math.hypot(ball.vx,ball.vy)))<.4)&&
     opponents.every(p=>distance(p,point)>2.5&&arrivalTime(p,point)>receiverArrival+.4);
    if(!clearDelivery){
     const candidates=players.filter(p=>p.side===side&&p.role!=='GK'&&!reserved.has(p.id)&&distance(p,point)<25)
      .flatMap(p=>shortSupportPoints(p,{...hunter,...point}).filter(aim=>distance(aim,point)>=5&&distance(aim,point)<=11&&depth(side,aim.x)<=depth(side,point.x)+1).map(aim=>({p,aim})))
      .map(c=>{const read=readSupportLocation(c.p,c.aim,players,{...hunter,...point},laneRisk);return {...c,score:arrivalTime(c.p,c.aim)+read.risk*2+read.crowding*2+(1-read.releaseRoom)*1.2+(c.p.role==='CB'?1:0)-(previous?.jobs[c.p.id]?.purpose==='second-ball'?.4:0)};})
      .sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
     const best=candidates[0];if(best)put(best.p,'second-ball','support',best.aim,best.p.pace*.82,'Oferă o ieșire lângă duel și este pregătit pentru mingea a doua.',hunter.id);
    }
   }
  }
 }
 const receiver=owner??(ball.mode==='pass'?players.find(p=>p.id===flight.receiver):undefined);
 let support:SupportPlan|null=null,pressureUntil:number|undefined;
 if(receiver&&receiver.side===attacking){
  const focus=owner??{...receiver,...flight.meetings[receiver.id]},side=receiver.side,t=tactics[side],s=side===0?1:-1,bd=depth(side,focus.x);
  const striker=strikers[side].id;
  // Striker: Pivot (pivotAnchor): the lead forward holds the last line.
  const pivot=t.striker==='pivot'?players.find(p=>p.id===striker&&p.side===side&&p.id!==receiver.id&&!unavailable.has(p.id)&&!reserved.has(p.id)):undefined;
  const anchor=pivot?pivotAnchor(players,pivot,previous?.attacking===side?previous.pivots?.[side]:undefined)??undefined:undefined;
  const pivotId=anchor&&anchor.depth>bd+3?pivot!.id:undefined;
  if(anchor)pivots[side]=anchor;
  // Striker: In behind (shoulderPost): the lead forward lives on their last line.
  const runner=t.striker==='run'?players.find(p=>p.id===striker&&p.side===side&&p.id!==receiver.id&&!unavailable.has(p.id)&&!reserved.has(p.id)):undefined;
  const runAnchor=runner?pivotAnchor(players,runner,previous?.attacking===side?previous.pivots?.[side]:undefined,RUN_GAP)??undefined:undefined;
  const shoulder=runAnchor&&runAnchor.depth>bd+3?shoulderPost(players,runner!,runAnchor,focus):undefined;
  const runnerId=shoulder?runner!.id:undefined;
  // Behaviour round C: in Counter's window he holds on the shoulder while the ball-winner is pressed or turned.
  const holding=runnerId&&(t as SituationTactics).regainWindow&&owner&&owner.id!==runnerId&&!winnerFree(runner!,owner,players,time)?runnerId:undefined;
  if(runAnchor)pivots[side]=runAnchor;
  // Striker: Drops deep (LINK_*): a false nine between their lines.
  const nine=t.striker==='link'?players.find(p=>p.id===striker&&p.side===side&&p.id!==receiver.id&&!unavailable.has(p.id)&&!reserved.has(p.id)):undefined;
  const nineAnchor=nine&&bd<L-BOX_DEPTH?pivotAnchor(players,nine,previous?.attacking===side?previous.pivots?.[side]:undefined,LINK_GAP)??undefined:undefined;
  const nineId=nineAnchor?nine!.id:undefined;
  if(nineAnchor)pivots[side]=nineAnchor;
  // A combining (patient) side also offers close support on a forward
  // diagonal, between the lines; every outlet below competes on the same reads.
  const closeSupport=(p:PracticePlayer)=>shortSupportPoints(p,focus,t.progression==='patient');
  const mates=players.filter(p=>p.side===side&&p.id!==receiver.id&&p.role!=='GK'&&!unavailable.has(p.id)),opponents=players.filter(p=>p.side!==side);
  const transition=readTransition(players,focus,t,time-context.recoveredAt,previous?.attacking===side?Object.values(previous.jobs).filter(j=>j.purpose==='break'):[],time);
  const actualLine=L;
  // Reuse the defensive-outlet evaluator, but publish its result through this
  // assignment boundary instead of adding another movement override later.
  const build=assignBuildUp(players,receiver,t,laneRisk,{...context,shape:shapes[side],receiving:owner?undefined:{aim:focus}},proposed?.side===side?proposed.moves:[],previous?.support,ordinaryUnavailable);
  const fixed=new Set(mates.filter(p=>reserved.has(p.id)).map(p=>p.id));
  const proposals=new Map<string,JobCandidate[]>(mates.map(p=>[p.id,jobs[p.id]?[{job:jobs[p.id],score:.6}]:[]]));
  // A break under way is a sprint, not a proposal re-litigated at every
  // re-plan: while readTransition still reads his destination as a race he
  // is winning, the runner keeps going (the carrier's short outlet must come
  // from someone else). On arrival with the lane still open he carries on to
  // the next open destination ahead of him.
  if(previous?.attacking===side)for(const old of Object.values(previous.jobs)){
   if(old.purpose!=='break'||old.until<=time)continue;
   const p=mates.find(q=>q.id===old.player);if(!p||fixed.has(p.id)||p.energy<22)continue;
   const open=transition.lanes.filter(l=>l.player===p.id);
   const same=open.find(l=>distance(l.aim,old.aim)<.1);if(!same)continue;
   const arrived=distance(p,old.aim)<2.5,further=arrived?open.filter(l=>depth(side,l.aim.x)>depth(side,old.aim.x)+2).sort((a,b)=>b.advantage-a.advantage)[0]:undefined;
   const aim=further?.aim??old.aim,travel=arrivalTime(p,aim);
   const job:FootballJob={...old,aim,speed:p.pace*(.91+p.traits.runs*.07),since:further?time:old.since,until:further?time+clamp(travel+.8,2,5):old.until};
   proposals.set(p.id,[{job,score:1}]);fixed.add(p.id);
  }
  const propose=(job:FootballJob,score:number)=>{if(!fixed.has(job.player))proposals.get(job.player)?.push({job,score});};
  for(const move of build){
   const p=mates.find(p=>p.id===move.player);if(!p||fixed.has(p.id)||p.id===pivotId||p.id===runnerId||p.id===nineId)continue;
   const read=readSupportLocation(p,move.aim,players,focus,laneRisk);
   propose({...move,purpose:move.purpose as JobPurpose},1.05+(t.commit<3?.15:0)-read.risk*.45-read.travel*.06);
  }
  type JobSpec={purpose:JobPurpose;kind:Duty;point:Vec;eligible:(p:PracticePlayer)=>boolean;fit:(p:PracticePlayer)=>number;reason:string;range?:number;target?:string;points?:(p:PracticePlayer)=>Vec[];lane?:boolean;shoulder?:boolean};
  // Width with the ball: a winger's support job pays for every metre it takes
  // him inside his lane band (nothing when narrow, more when wide). An urgent
  // release under pressure is exempt; runs keep their own geometry.
  const band=laneY(t.width)-4,discipline=WIDTH[t.width].discipline;
  // Without wingers (2-1-1) the centre-backs carry it: wide keeps them split
  // (a cost for coming inside their lane), narrow keeps them close (a cost for
  // drifting outside it). Standard leaves them free.
  const {backs:spread,middle}=buildUpSpread(players,side,t.width),backLane=Y(11)*spread;
  // ... and the midfielder carries it in the middle (settings round,
  // 2026-10-03): his support jobs pay MID_DISCIPLINE per metre beyond
  // MID_SLACK from his Width target, the team's lateral shift x middle
  // (narrow 1.3: towards the ball's side, close support; wide 0.55: holding
  // the far half-space for a switch). Standard leaves him free.
  const midTarget=(p:PracticePlayer)=>p.lane*11+shapes[side].shift*middle;
  const laneCost=(p:PracticePlayer,aim:Vec)=>{
   if(discipline&&(p.role==='W'||p.role==='FB'))return discipline*Math.max(0,band-p.lane*aim.y);
   if(p.role==='CB'&&p.lane&&spread!==1)return .06*(spread>1?Math.max(0,backLane-1-p.lane*aim.y):Math.max(0,p.lane*aim.y-backLane-1));
   if((p.role==='CM'||p.role==='AM')&&middle!==1)return MID_DISCIPLINE*Math.max(0,Math.abs(aim.y-midTarget(p))-MID_SLACK);
   return 0;
  };
  // M1: a centre-back's support jobs (not runs, which Bodies forward prices)
  // keep the Line's cushion to the opponents' deepest forward as he reads him.
  const heights=new Map<string,number>();
  const backHeight=(p:PracticePlayer)=>{
   if(p.role!=='CB')return Infinity;
   let h=heights.get(p.id);if(h===undefined){h=lineHeight(p,players,t.line,undefined,time);heights.set(p.id,h);}
   return h;
  };
  const offerJob=(spec:JobSpec)=>{
   const options=mates.filter(p=>!fixed.has(p.id)&&spec.eligible(p)&&(p.id!==pivotId||PIVOT_ALSO.has(spec.purpose))&&(p.id!==runnerId||RUN_ALSO.has(spec.purpose)||spec.shoulder)&&(p.id!==nineId||LINK_ALSO.has(spec.purpose))).flatMap(p=>{
    const line=Math.max((L/2),bd,context.lineFor?.(p)??actualLine),held=running(spec.purpose)?Infinity:backHeight(p);
    const allowance=running(spec.purpose)?runReleaseAllowance(p,time,context.releaseCue):0;
    if(running(spec.purpose)&&(p.energy<22||depth(side,p.x)>line+.1+allowance))return [];
    const points=spec.points?.(p)??[-2,0,2].flatMap(dx=>[-2,0,2].map(dy=>({x:spec.point.x+s*dx,y:spec.point.y+dy})));
    const prior=previous?.attacking===side?previous.jobs[p.id]:undefined;
    if(spec.purpose!=='break'&&prior?.purpose===spec.purpose&&prior.until>time&&distance(prior.aim,spec.point)<13)points.push(prior.aim);
    return points.map(point=>{
     const aim=inside({x:world(side,Math.min(line-.8+allowance,depth(side,point.x),held)),y:point.y});
     const gap=distance(focus,aim),travel=arrivalTime(p,aim);
     const room=Math.min(...opponents.filter(q=>q.role!=='GK').map(q=>distance(q,aim)));
     const spacing=Math.max(clamp((2-gap)/2,0,1),...Object.values(jobs).filter(j=>j.player!==p.id&&reserved.has(j.player)&&players.find(q=>q.id===j.player)?.side===side).map(j=>clamp((2-distance(j.aim,aim))/2,0,1)));
     const run=running(spec.purpose),develop=run||spec.purpose==='join'||spec.purpose==='width'||spec.purpose==='third-man',read=readSupportLocation(p,aim,players,focus,laneRisk,develop);
     const laneRiskHere=read.risk;
     // Two nearby outlets in the same direction are often covered by the
     // same defender. Prefer a genuinely different angle, not just distance
     // between destinations. Forward runs keep their own football purpose.
     const sharedAngle=run?0:Math.max(0,...Object.values(jobs).filter(j=>j.player!==p.id&&reserved.has(j.player)&&mates.some(q=>q.id===j.player)&&distance(focus,j.aim)>=4&&distance(focus,j.aim)<=13).map(j=>{
      const cosine=((aim.x-focus.x)*(j.aim.x-focus.x)+(aim.y-focus.y)*(j.aim.y-focus.y))/Math.max(.1,gap*distance(focus,j.aim));
      return clamp((cosine-.7)/.3,0,1);
     }));
     const old=previous?.jobs[p.id],same=old?.purpose===spec.purpose&&old.until>time;
     // Continuity belongs to the actual movement, not every new destination
     // carrying the same job label. Otherwise a short-support label can keep
     // winning after the reason to stay short has disappeared.
     const style=run?runStyle(t,spec.purpose):(t.progression==='patient'?.15:0);
     const roleFit=run&&(p.role==='CB'||p.role==='DM')?-.25:0;
     // Seven metres describes a short outlet, not the preferred distance of
     // every run. Applying it to depth candidates quietly favoured staying
     // close even when a reachable forward movement created a useful option.
     const destinationCost=spec.points?(develop?0:Math.abs(gap-7)*.035):distance(aim,spec.point)*.045;
     // Runs that go past the build-up (depth, break) pay half: a winger may
     // still cut inside; box arrivals and the return after a pass are exempt.
     const lane=spec.lane===false||spec.purpose==='width'||spec.purpose==='link'?0:run?(spec.purpose==='depth'||spec.purpose==='break'?laneCost(p,aim)*.5:0):laneCost(p,aim);
     const score=spec.fit(p)+style+roleFit-lane+(same&&distance(old!.aim,aim)<2?.25:0)+clamp(room/7,0,1)*.3-(develop?.07:.15)*travel-(spec.purpose==='outlet'?distance(aim,shapes[side].slots[p.id]?.aim??p)*.035:0)-laneRiskHere*(develop?.18:.8)-spacing*1.8-read.crowding*.35-sharedAngle*.6-(1-read.releaseRoom)*(develop?.15+(1-p.traits.risk)*.4:.55)-destinationCost;
     const valid=gap>=(spec.purpose==='outlet'?4.5:3.2)&&gap<=(spec.range??24)&&travel<=(run||spec.purpose==='width'?5:3.5)&&room>1.3&&spacing<.5&&(develop||laneRiskHere<.78)&&
      (spec.purpose!=='give-and-go'||laneRiskHere<.65&&travel<2.5)&&
      (!run||depth(side,aim.x)>=depth(side,p.x)-2||spec.purpose==='cutback');
     return {p,aim,score,valid,travel};
    }).filter(c=>c.valid);
   }).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
   for(const c of options){
    const old=previous?.attacking===side?previous.jobs[c.p.id]:undefined;
    const continuing=old?.purpose===spec.purpose&&old.target===spec.target&&old.until>time;
    const job:FootballJob={player:c.p.id,purpose:spec.purpose,kind:spec.kind,aim:c.aim,
     speed:c.p.pace*(running(spec.purpose)?.85+c.p.traits.runs*.08:.76),reason:spec.reason,target:spec.target,
     since:continuing?old.since:time,until:continuing?old.until:time+(running(spec.purpose)?clamp(c.travel+.8,2,5):2)};
    propose(job,c.score);
   }
  };
  if(pivotId&&!fixed.has(pivotId)){
   const p=pivot!,at=pivotPoint(players,p,anchor!,focus,!!owner||ball.mode==='pass',laneRisk,time),gap=distance(p,at.aim);
   const old=previous?.attacking===side?previous.jobs[p.id]:undefined,continuing=old?.purpose==='pivot'&&old.kind===(at.show?'show':'support')&&old.until>time;
   proposals.set(p.id,[{score:PIVOT_HOLD,job:{player:p.id,purpose:'pivot',kind:at.show?'show':'support',aim:at.aim,
    speed:p.pace*(at.show?.9:clamp(.45+gap*.05,.5,.9)),target:receiver.id,since:continuing?old!.since:time,until:time+2,
    reason:at.show?'Pivot: pasa la picior e liberă; vine un pas spre minge, cu spatele la poartă.':'Pivot: stă pe ultimul apărător, central, și îl ține pe loc.'}}]);
  }
  if(nineId&&!fixed.has(nineId)){
   const p=nine!,at=pivotPoint(players,p,nineAnchor!,focus,!!owner||ball.mode==='pass',laneRisk,time,LINK_SHOW),gap=distance(p,at.aim);
   const old=previous?.attacking===side?previous.jobs[p.id]:undefined,continuing=old?.purpose==='link'&&old.kind===(at.show?'show':'support')&&old.until>time;
   proposals.set(p.id,[{score:LINK_HOLD,job:{player:p.id,purpose:'link',kind:at.show?'show':'support',aim:at.aim,
    speed:p.pace*(at.show?.9:clamp(.45+gap*.05,.5,.9)),target:receiver.id,since:continuing?old!.since:time,until:time+2,
    reason:at.show?'Vârf retras: pasa la picior e liberă; vine spre minge, între linii.':'Vârf retras: stă între liniile lor, în fața ultimului apărător.'}}]);
  }
  // The run beyond the false nine, into the space he left: while he shows or has the ball.
  {
   const onNine=t.striker==='link'&&receiver.id===striker;
   const shown=nineId?proposals.get(nineId)?.[0]?.job:undefined;
   const at=onNine?focus:shown?.kind==='show'?shown.aim:undefined;
   if(at){
    const last=Math.max(...opponents.filter(q=>q.role!=='GK').map(q=>depth(side,q.x)));
    const beyond=Math.min(L-PIVOT_GOAL,Math.max(last+1,depth(side,at.x)+LINK_BEYOND));
    offerJob({purpose:'depth',kind:'run',point:{x:world(side,beyond),y:at.y},points:()=>[-LINK_WIDE,LINK_WIDE].map(dy=>inside({x:world(side,beyond),y:at.y+dy})),
     eligible:p=>p.id!==striker&&['W','AM','CM'].includes(p.role),fit:p=>1+p.traits.runs*.5,range:30,
     reason:'Atacă spațiul lăsat de vârful care a coborât între linii.'});
   }
  }
  if(runnerId&&!fixed.has(runnerId)){
   const p=runner!,gap=distance(p,shoulder!.post);
   const old=previous?.attacking===side?previous.jobs[p.id]:undefined,continuing=old?.purpose==='shoulder'&&old.until>time;
   proposals.set(p.id,[{score:RUN_HOLD,job:{player:p.id,purpose:'shoulder',kind:'support',aim:shoulder!.post,
    speed:p.pace*clamp(.45+gap*.05,.5,.9),target:receiver.id,since:continuing?old!.since:time,until:time+2,
    reason:'În spate: stă pe umărul ultimului apărător, gata să atace spațiul din spatele lui.'}}]);
   const run=shoulder!.run;
   if(run&&!holding)offerJob({purpose:'depth',kind:'run',point:run,points:()=>[run,inside({x:run.x,y:run.y+1.5}),inside({x:run.x,y:run.y-1.5})],eligible:q=>q.id===runnerId,shoulder:true,
    fit:q=>1+q.traits.runs*RUN_FIT,range:30,reason:'În spate: atacă spațiul din spatele ultimului apărător.'});
  }
  // The third man (thirdManSpots): around a pivot who is a live option, or
  // who has or is about to have the ball.
  {
   const onPivot=t.striker==='pivot'&&receiver.id===striker;
   const shown=pivotId?proposals.get(pivotId)?.[0]?.job:undefined;
   const at=onPivot?focus:shown?.kind==='show'?shown.aim:undefined;
   if(at){
    // When a lay-off could come: the ball still to reach him, and his touch.
    const soon=(onPivot?(owner?0:distance(ball,focus)/Math.max(3,Math.hypot(ball.vx,ball.vy))):.2+expectedPassFlight(distance(focus,at)))+.35;
    const ref=onPivot?receiver.id:pivotId!;
    offerJob({purpose:'third-man',kind:'support',point:at,range:26,
     eligible:p=>p.id!==ref,
     points:p=>thirdManSpots(at,side).filter(v=>perceive(p,'arrival',arrivalTime(p,v),THIRD_SPREAD,v,{time,salt:'third-man'})<=soon+THIRD_SLACK),
     fit:p=>.8+p.skills.reading*.02,target:ref,
     reason:'Al treilea om: vine cu fața la poartă, lângă pivot, pentru pasa lui înapoi.'});
   }
  }
  // Rejoining the possession is useful even without a counterattack or a
  // pass available right now. Offer reachable steps towards connected role
  // positions, rather than requiring a deep player to reach a distant run's
  // endpoint before his movement can be considered.
  offerJob({purpose:'join',kind:'support',point:focus,range:26,eligible:p=>p.role!=='GK',
   points:p=>{
    const lead=p.role==='CB'||p.role==='DM'?-6:p.role==='ST'?8:4;
    const targetDepth=clamp(bd+lead,3,L-3);
    if(targetDepth<=depth(side,p.x)+2)return [];
    return [-W*.25,0,W*.25].flatMap(y=>{
     const destination=inside({x:world(side,targetDepth),y}),gap=distance(p,destination);
     return [4,8].map(step=>{const f=Math.min(1,step/Math.max(.1,gap));return {x:p.x+(destination.x-p.x)*f,y:p.y+(destination.y-p.y)*f};});
    });
   },fit:p=>.7+p.traits.runs*.15,reason:'Urcă în legătură cu atacul, pregătind o poziție utilă pentru următoarele pase.'});
  const pressured=opponents.some(q=>q.role!=='GK'&&(distance(q,focus)<4.5||arrivalTime(q,focus)<.75));
  const hasExit=mates.some(p=>reserved.has(p.id)&&distance(p,focus)>=4.5&&distance(p,focus)<=11&&distance(jobs[p.id].aim,focus)<=11&&laneRisk(focus,p,opponents)<.25&&opponents.every(q=>distance(q,p)>2.5));
  const hasPlannedExit=()=>hasExit||mates.some(p=>reserved.has(p.id)&&['outlet','second-ball'].includes(jobs[p.id]?.purpose));
  if(pressured&&!hasPlannedExit()){
   // Add reachable releases to the same choice as forward runs. A natural
   // runner may help here, without reserving anyone before comparison.
   offerJob({purpose:'outlet',kind:'support',point:focus,points:p=>closeSupport(p),range:13,lane:false,
    eligible:p=>p.role!=='CB'&&distance(p,focus)<16,
    fit:p=>1+p.traits.comesShort*.3+p.skills.reading*.025,
    target:receiver.id,reason:'Se desprinde de presiunea colegului și oferă o ieșire scurtă, într-un alt unghi.'});
  }
  const wide=Math.abs(focus.y)>Y(14);
  // Patient play raises the value of short angles; they still compete
  // with runs and cover using ordinary lane and arrival checks.
  if(t.progression==='patient'&&!hasPlannedExit())offerJob({purpose:'outlet',kind:'support',point:focus,points:p=>closeSupport(p),range:13,eligible:p=>p.role!=='CB'&&distance(p,focus)<20,fit:p=>1+p.traits.comesShort*.3+p.skills.reading*.025,target:receiver.id,reason:'Joc scurt: oferă un unghi apropiat pentru a lega următoarele pase.'});
  // Launch from the recovery itself, before ordinary build-up depth gates.
  // Remaining players attack distinct lanes. Exposure is priced by the same
  // evaluator as other runs; there is no separate permission-to-run rule.
  // "Keep it" already asks more of the opening before a lane exists at all
  // (readTransition's threshold), so its break is not discounted again here.
  if(transition.open){
   offerJob({purpose:'link',kind:'show',point:focus,range:34,
    points:p=>transition.outlets.filter(l=>l.player===p.id).map(l=>l.aim),
    eligible:p=>transition.outlets.some(l=>l.player===p.id),
    fit:p=>1+p.traits.comesShort*.3+p.skills.reading*.02,target:receiver.id,
    reason:'Rămâne disponibil în spațiul avansat înainte ca apărarea să se refacă.'});
   if(!hasPlannedExit())offerJob({purpose:'outlet',kind:'support',point:focus,points:p=>closeSupport(p),range:13,eligible:p=>p.role!=='CB'&&distance(p,focus)<20,fit:p=>1+p.traits.comesShort*.3,target:receiver.id,reason:'Oferă o primă legătură în timp ce colegii pleacă pe contraatac.'});
   offerJob({purpose:'break',kind:'run',point:{x:focus.x+s*12,y:0},range:34,
    points:p=>transition.lanes.filter(l=>l.player===p.id).map(l=>l.aim),
    eligible:p=>p.id!==holding&&transition.lanes.some(l=>l.player===p.id),
    fit:p=>(t.transition==='counter'?1.25:.9)+p.traits.runs*.4+p.skills.reading*.02,
    reason:'La recuperare, atacă spațiul înainte ca adversarii să se reașeze.'});
  }
  // A pass changes the focus, not every teammate's job. Retain useful runs
  // across the handover until their short commitment expires. Danger, offside,
  // unavailability and a changed team in control still invalidate them.
  if(previous?.attacking===side){
   for(const old of Object.values(previous.jobs)){
    const p=mates.find(p=>p.id===old.player);if(!p||reserved.has(p.id)||!running(old.purpose)||old.purpose==='break'&&!transition.lanes.some(l=>l.player===p.id&&distance(l.aim,old.aim)<.1)||old.until<=time||p.energy<22)continue;
    const line=Math.max((L/2),bd,context.lineFor?.(p)??actualLine),allowance=runReleaseAllowance(p,time,context.releaseCue);
    if(distance(focus,old.aim)>24||distance(focus,old.aim)<3.2||depth(side,p.x)>line+.1+allowance||depth(side,old.aim.x)>line+allowance||
     old.purpose==='give-and-go'&&(old.target!==receiver.id||laneRisk(focus,old.aim,opponents)>=.65||Math.min(...opponents.map(q=>distance(q,old.aim)))<=1.3))continue;
    offerJob({purpose:old.purpose,kind:old.kind,point:old.aim,points:()=>[old.aim],eligible:q=>q.id===p.id,fit:q=>.9+q.traits.runs*.3,reason:old.reason,target:old.target});
   }
  }

  // The passer can change the angle while his delivery travels. This merely
  // offers a return: the receiver still chooses and executes his own action.
  const recentPass=context.lastPass?.to===receiver.id&&time>=context.lastPass.at&&time-context.lastPass.at<2.2?context.lastPass.from:undefined;
  const passer=mates.find(p=>p.id===(owner?recentPass:context.passer));
  if(passer&&distance(passer,focus)<14&&bd>X(22)&&bd<X(90)){
   const flank=passer.y>=focus.y?1:-1;
   const continuation=context.passContinuation?.from===passer.id&&(context.passContinuation.player??context.passContinuation.from)===passer.id&&context.passContinuation.to===receiver.id&&context.passContinuation.until>time?context.passContinuation:undefined;
   // A pass selected to open a return route carries that intention through
   // release. Replacing it with an unrelated wall-pass route here would make
   // the original evaluation fictional. It still competes with other jobs,
   // and the ordinary lane, pressure and physical checks can reject it.
   offerJob({purpose:'give-and-go',kind:'run',point:continuation?.aim??{x:focus.x+s*3.5,y:focus.y+flank*3.5},
    points:p=>(continuation?[continuation.aim]:[...shortSupportPoints(p,focus),...returnRunPoints(p)]).filter(v=>depth(side,v.x)>depth(side,p.x)+1),eligible:p=>p.id===passer.id,
    fit:p=>.85+p.traits.runs*.35+p.skills.reading*.025,reason:'După pasă, schimbă unghiul și oferă o posibilă continuare scurtă.',range:12,target:receiver.id});
   if(continuation&&!fixed.has(passer.id)){
    const intended=proposals.get(passer.id)?.find(c=>c.job.purpose==='give-and-go'&&distance(c.job.aim,continuation.aim)<.1);
    // The player chose pass-and-move, rather than a pass whose imagined
    // follow-up is forgotten on release. Honour that short action while the
    // same recipient and route remain viable. offerJob rechecks pressure,
    // lanes and arrival above every time; a closed route falls back to the
    // ordinary choices. Authored responsibilities still take precedence.
    if(intended){proposals.set(passer.id,[intended]);fixed.add(passer.id);}
   }
  }


  // The first pass can also depend on a third teammate's movement. Retain
  // that particular route through the handover, not a compulsory team shape.
  // The next carrier still chooses whether to use it. Physical reception,
  // manager responsibilities and a newly closed destination take priority.
  const shared=context.passContinuation;
  const participant=shared&&mates.find(p=>p.id===shared.player&&p.id!==shared.from);
  if(shared&&participant&&!fixed.has(participant.id)&&shared.to===receiver.id&&shared.from===(owner?recentPass:context.passer)&&shared.until>time){
   const purpose:JobPurpose=shared.purpose==='channel'?'depth':shared.purpose==='recycle'||shared.purpose==='recovery-outlet'?'outlet':shared.purpose??'outlet';
   // Authored movement is refreshed by the instruction producer, not copied
   // as an ordinary job after its lesson has ended.
   if(purpose!=='playbook'){
    offerJob({purpose,kind:shared.kind??'support',point:shared.aim,points:()=>[shared.aim],eligible:p=>p.id===participant.id,
     fit:()=>1,range:32,target:receiver.id,reason:'Continuă mișcarea care a pregătit pasa; rămâne o opțiune pentru următorul purtător.'});
    const intended=proposals.get(participant.id)?.find(c=>c.job.purpose===purpose&&distance(c.job.aim,shared.aim)<.1&&c.job.target===receiver.id);
    if(intended){
     intended.job.speed=Math.min(participant.pace,shared.speed);
     intended.job.until=shared.until;
     proposals.set(participant.id,[intended]);fixed.add(participant.id);
    }
   }
  }

  if(wide&&bd>X(66)){
   const flank=Math.sign(focus.y);
   // Box arrivals belong to whoever is placed to make them, not to a role
   // label: 2-2 has no ST/CM, so a label list left it without a cutback
   // runner and 2-1-1's midfielder could never attack a post. Any attacker
   // (non-defender) may be offered a post; the cutback, arriving late at the
   // edge of the box, is open to any outfielder, a defender included. The
   // ordinary travel, lane, spacing and team-exposure reads (and the
   // unchanged role fits, with the defenders' run penalty) choose who goes.
   const arriving=(p:PracticePlayer)=>p.role!=='CB'&&p.role!=='FB'&&p.role!=='DM';
   offerJob({purpose:'near-post',kind:'run',point:{x:world(side,clamp(bd+X(12),X(87),X(96))),y:flank*Y(5)},eligible:arriving,fit:p=>1+(p.role==='ST'?.35:0)+p.traits.runs*.3+p.skills.finishing*.025,reason:'Pregătește o sosire în fața porții, înainte să plece centrarea.'});
   offerJob({purpose:'far-post',kind:'run',point:{x:world(side,clamp(bd+X(9),X(85),X(94))),y:-flank*Y(9)},eligible:arriving,fit:p=>1+(p.y*focus.y<0?.3:0)+p.traits.runs*.3,reason:'Atacă zona opusă; lasă un alt culoar colegului din fața porții.',range:45});
   // A player who is part of the rest defence (clearly goal-side of the
   // ball) and leaves it for the cutback pays what the loss would then cost
   // more: the same authored price the passer uses, as he reads it (a
   // centre-back arriving late should know he leaves one fewer behind).
   const rest=restDefence(focus,players),leaving=LOSS_SCALE*(lossDanger(rest.depth/L,rest.deficit+1)-lossDanger(rest.depth/L,rest.deficit));
   if(t.commit>=3)offerJob({purpose:'cutback',kind:'run',point:{x:world(side,clamp(bd-3,X(78),X(88))),y:-flank*1},eligible:()=>true,fit:p=>.95+p.skills.reading*.03-(isRest(side,focus,p)?leaving*lossRead(p,focus):0),reason:'Vine în urma atacanților, disponibil pentru pasa întoarsă.'});
  }else if(bd>X(32)||t.progression==='direct'){
   // No offside line in this small-sided game is not an instruction to run
   // straight to the end line. Stay within a usable next-pass distance.
   // (Drops deep's own link post and the run beyond it: LINK_*, above.)
   offerJob({purpose:'depth',kind:'run',point:{x:world(side,Math.min(X(96),bd+X(t.progression==='direct'?30:23))),y:0},points:()=>[-Y(18),0,Y(18)].map(y=>({x:world(side,Math.min(X(96),bd+X(t.progression==='direct'?30:23))),y})),eligible:p=>p.id!==runnerId,fit:p=>.8+p.traits.runs*.6+(p.id===striker&&t.striker==='run'?.3:0),reason:'Oferă profunzime la distanță de pasă, pe un alt culoar.',range:26});
   if(wide&&bd<X(83)&&t.fullbacks!=='hold'&&(t.commit>=3||t.fullbacks==='overlap'))offerJob({purpose:'overlap',kind:'run',point:{x:focus.x+s*X(9),y:Math.sign(focus.y)*Y(30)},eligible:p=>p.role==='FB'&&p.y*focus.y>0,fit:p=>1+p.traits.runs*.3,reason:'Trece pe exterior și oferă o continuare pe flanc.'});
  }
  // Two different passing angles, using the same lane assessment as the
  // carrier. Pressure makes these more useful, not a blanket veto on movement.
  for(const flank of [-1,1])offerJob({purpose:'outlet',kind:'support',point:{x:focus.x-s*X(5),y:focus.y+flank*Y(9)},points:p=>closeSupport(p).filter(v=>(v.y-focus.y)*flank>2),eligible:p=>distance(p,focus)<25&&!(p.role==='FB'&&t.fullbacks==='hold'&&depth(side,p.x)>bd-3),fit:p=>.8+p.traits.comesShort*.3+p.skills.reading*.02,reason:'Oferă un unghi diferit pentru următoarea pasă.'});
  // Hold width on the far side: pin a defender away from the ball, or be the
  // free man for a switch. Its base value is what the Width setting asks of
  // the wingers; it competes with every other job on the same reads.
  const holdLane=(p:PracticePlayer)=>{const slot=shapes[side].slots[p.id];return inside({x:slot?.aim.x??p.x,y:p.lane*laneY(t.width)});};
  const outfieldOpponents=opponents.filter(q=>q.role!=='GK');
  offerJob({purpose:'width',kind:'width',point:focus,range:34,
   // Any winger whose lane lies well outside the ball: the far side, or the
   // near touchline while the ball is inside it.
   eligible:p=>(p.role==='W'||p.role==='FB')&&p.lane!==0&&laneY(t.width)-p.lane*focus.y>=6,
   points:p=>{const at=holdLane(p);return [-3,0,3].map(dx=>inside({x:at.x+s*dx,y:at.y}));},
   fit:p=>{
    const at=holdLane(p);
    const pinned=outfieldOpponents.some(q=>distance(q,at)<8&&distance(q,focus)>9);
    const free=outfieldOpponents.length?clamp((Math.min(...outfieldOpponents.map(q=>arrivalTime(q,at)))-1)/1.5,0,1):0;
    return WIDTH[t.width].hold+(pinned?.15:0)+free*.15;
   },
   reason:'Ține lățimea pe culoarul lui: fixează un apărător departe de minge sau rămâne omul liber pentru schimbarea de joc.'});
  const keeper=players.find(p=>p.side===side&&p.role==='GK'&&p.id!==receiver.id&&!reserved.has(p.id));
  if(keeper)proposals.set(keeper.id,keeperSupportCandidates(keeper,focus,players,t,laneRisk,time));
  const selecting=keeper?[...mates,keeper]:mates;
  for(const job of selectPossessionJobs(players,focus,selecting,t,laneRisk,proposals,fixed,time,striker)){
   const p=selecting.find(p=>p.id===job.player)!;
   put(p,job.purpose,job.kind,job.aim,job.speed,job.reason,job.target,job.velocity,job.until-time);
  }
  const closePressure=opponents.some(q=>q.role!=='GK'&&(distance(q,focus)<4.5||arrivalTime(q,focus)<.75));
  const connectedExit=mates.some(p=>{
   const gap=distance(p,focus),flight=expectedPassFlight(gap);
   return gap>=4.5&&gap<=13&&laneRisk(focus,p,opponents)<.3&&teammatePassObstruction(focus,p,p,players,flight)<.3&&
    opponents.every(q=>arrivalTime(q,p)>flight+.7);
  });
  pressureUntil=closePressure&&!connectedExit?time+1.25:previous?.attacking===side?previous.pressureUntil:undefined;
  // The pivot's place is the setting's: pressure and reception refinements
  // treat it like a manager's commitment.
  const kept=pivotId||runnerId||nineId?new Set([...fixed,...[pivotId,runnerId,nineId].filter((id):id is string=>!!id)]):fixed;
  const arrangement=receiver.role!=='GK'&&time<(pressureUntil??0)?pressureArrangement(players,focus,mates.filter(p=>!unavailable.has(p.id)),shapes[side],t,build,laneRisk,time,previous?.attacking===side?previous.jobs:{},jobs,kept,striker):null;
  if(arrangement)for(const job of arrangement){const p=mates.find(p=>p.id===job.player)!;put(p,job.purpose,job.kind,job.aim,job.speed,job.reason,job.target,job.velocity,job.until-time);}
  const incoming=owner?0:Math.min(2.5,distance(ball,focus)/Math.max(3,Math.hypot(ball.vx,ball.vy)));
  const handoverPasser=owner?recentPass:context.passer;
  if(receiver.role!=='GK'&&handoverPasser&&players.some(p=>p.id===handoverPasser&&p.side===side&&p.id!==receiver.id)){
   const refined=refineReceptionSupport(players,focus,mates,t,laneRisk,time,incoming,jobs,kept);
   for(const job of refined??[]){const p=mates.find(p=>p.id===job.player)!;put(p,job.purpose,job.kind,job.aim,job.speed,job.reason,job.target,job.velocity,job.until-time);}
  }
  for(const p of mates){
   const job=jobs[p.id];if(!job||job.kind!=='run'||instructed.has(p.id))continue;
   // Recalculate from the player's normal run pace, not last tick's already
   // reduced speed, so a waiting run can accelerate as the passer gets ready.
   const timing=job.purpose==='break'?{speed:p.pace*(.91+p.traits.runs*.07),waiting:false}:timeSupportRun(p,job.aim,p.pace*(.85+p.traits.runs*.08),focus,players,incoming);
   job.speed=timing.speed;
   if(timing.waiting)job.reason='Își dozează cursa pentru a sosi odată cu pasa posibilă.';
  }
  // Defending rebuild (5): rest defence in possession (restGuards).
  for(const g of restGuards(players,side,focus,t,jobs,mates.filter(p=>!instructed.has(p.id)&&!unavailable.has(p.id)),time)){
   const p=mates.find(q=>q.id===g.player)!;put(p,'counter-cover','cover',g.aim,g.speed,g.reason,g.target);
  }
  const moves:SupportMove[]=Object.values(jobs).filter(j=>selecting.some(p=>p.id===j.player)&&!['shape','collect','receive','mark','press','cover'].includes(j.purpose)).map(j=>({player:j.player,purpose:j.purpose==='depth'||j.purpose==='break'?'channel':j.purpose==='outlet'||j.purpose==='second-ball'||j.purpose==='width'?'recycle':j.purpose==='pivot'?'link':j.purpose==='shoulder'?'channel':j.purpose==='third-man'?'join':j.purpose as SupportMove['purpose'],kind:j.kind==='keeper'?'support':j.kind as SupportMove['kind'],aim:j.aim,speed:j.speed,since:j.since,until:j.until,reason:j.reason}));
  support={owner:receiver.id,side,moves};
 }
 // Resolve baseline spacing against the allocated jobs before publishing the
 // plan. Reuse the existing route/space evaluator here, so an unassigned
 // midfielder does not occupy the collector's or outlet's destination.
 for(const side of [0,1] as const){
  const focus=owner?.side===side?owner:players.find(p=>p.side===side&&flight.hunters.includes(p.id));
  if(!focus)continue;
  const meeting=owner?.id===focus.id?focus:flight.meetings[focus.id];
  const moves:SupportMove[]=Object.values(jobs).filter(j=>j.player!==focus.id&&j.purpose!=='shape'&&players.find(p=>p.id===j.player)?.side===side).map(j=>({player:j.player,purpose:'recycle',kind:'support',aim:j.aim,speed:j.speed,since:j.since,until:j.until,reason:j.reason}));
  for(const p of players.filter(p=>p.side===side&&jobs[p.id]?.purpose==='shape')){
   const job=jobs[p.id];job.aim=complementarySupportAim(p,job.aim,players,focus,{owner:focus.id,side,moves},time,meeting);
  }
 }
 return {time,situation,attacking,jobs,shapes,defense,flight,marks,support,pressureUntil,strikers,...(pivots[0]||pivots[1]?{pivots}:{}),...(counterPress?{counterPress}:{}),...(trap?{trap}:{}),...(possession?{possession}:{}),attackSince,...(anchors?{anchors}:{}),...(defendingMemory?{defending:defendingMemory}:{})};
}
