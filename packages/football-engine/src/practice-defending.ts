import {L,W,GH} from './pitch.js';
import {clamp} from './model.js';
import type {Side,Tactics} from './model.js';
import type {MovingBall,Vec} from './movement.js';
import type {PracticePlayer,Duty} from './practice.js';
import {acuity,perceive,inView,lookingAt,followsTeam,eagerness} from './practice-perception.js';
import {arrivalTime,containMovement,coverPosition} from './practice-defense.js';

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
export const SPARE_BEHIND=5,SPARE_R=2;
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
/** Where the presser engages the man on the ball (m of the carrier from our
 * goal, by Press, plus the Line's shift); beyond it he waits HOLD m off him,
 * goal-side. A man running at our goal is met wherever he is. */
export const ENGAGE:Record<Tactics['press'],number>={selective:22,balanced:31,aggressive:L};
export const ENGAGE_LINE:Record<Tactics['line'],number>={deep:-4,standard:0,high:5};
export const HOLD:Record<Tactics['press'],number>={selective:5.5,balanced:4,aggressive:2.5};
/** The presser stands a little inside the man (shows him away from the middle). */
export const SHOW=.6;
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
/** Cover: no further than COVER_FAR s from the cover point; the previous cover keeps it (COVER_KEEP s). */
export const COVER_FAR=2.2,COVER_KEEP=.6,COVER_BEHIND=2.5,COVER_SHARE=3.5,COVER_RUN=.4;
/** A doubling second man (Aggressive): on a trigger, with a team-mate kept goal-side as balance. */
export const DOUBLE_SPREAD=.6;
/** The ball: a defender goes for it only when he gets there by COLLECT_MARGIN s of the first attacker. A marker whose man matters may go only for a ball at his feet (COLLECT_NEAR m) he clearly wins, or when his man is the one going for it (COLLECT_MAN m). */
export const COLLECT_MARGIN=.15,COLLECT_DUEL=.6,COLLECT_NEAR=4,COLLECT_WIN=.4,COLLECT_MAN=4;
/** Spacing between free defenders' spots (m). */
export const SPACING=2.2,FREE_GAP=3.2,SCREEN_OFF=7;
/** A sagging marker keeps SAG_CLEAR m off a man a team-mate has. */
export const SAG_CLEAR=2.2;
/** In midfield, the marker of a man level with or behind the ball keeps BALL_CLEAR m off the carrier, goal-side. */
export const BALL_CLEAR=3.5;
/** Regroup ("On losing it"): everyone not yet this far goal-side of the ball drops behind it first. */
export const REGROUP_BEHIND=5;

type View=(reader:PracticePlayer,target:PracticePlayer)=>PracticePlayer;
export type Matter='ball'|'danger'|'watch'|'spare';
export interface DefendMemory {side:Side;attacking:Side;
 /** Each defender's own man and since when. */
 men:Record<string,{target:string;since:number}>;
 /** Each defender's calls, newest last ('' = "I have nobody"). */
 calls:Record<string,{target:string;at:number}[]>;
 solvedAt:number;focus?:string;who?:string;cover?:string;
 /** Defending-close round: since when the carrier has had a clear run at our goal. */
 clear?:{carrier:string;since:number;step?:string;
  /** Step-across round: when the next team-mate's own read of it falls due (the defence looks again then, not at its 0.25 s tick). */
  next?:number};
 /** Defending-close round: when the duplicates were last looked at. */
 dupAt:number}
export interface DefendJob {player:string;purpose:'press'|'cover'|'mark'|'balance'|'screen'|'drop'|'zone';kind:Duty;aim:Vec;speed:number;reason:string;target?:string;velocity?:Vec}
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
 danger:number}
/** The soft edge of "matters" (m either side of the radius). */
export const EDGE=3;
/** How this defender reads one attacker: where he is (his own picture), how
 * far from our goal (his own read), and whether he matters. */
export function readMan(d:PracticePlayer,a:PracticePlayer,input:Pick<DefendInput,'defending'|'tactics'|'time'|'carrier'|'receiver'|'view'>,ref:Vec,own:boolean):ManRead{
 const {defending,tactics,time}=input,g={x:world(defending,0),y:0};
 const isBall=a.id===input.carrier?.id||a.id===input.receiver?.id;
 const v=a.id===input.carrier?.id?a:input.view(d,a);
 const exact=Math.min(distance(v,g),distance(ahead(v,RUN_LEAD),g));
 const dg=perceive(d,'threat',exact,DANGER_SPREAD*exact+.5,v,{time,salt:`dg${a.id}`});
 const running=goalward(v,defending)>=RUN_GOALWARD;
 const R=DANGER_R[tactics.line]+DANGER_PRESS[tactics.press]+(own?KEEP_MATTER:0)+CENTRAL*clamp(1-(Math.abs(v.y)-3)/6,0,1);
 const da=depth(defending,v.x),db=depth(defending,ref.x);
 const close=clamp((R+6-dg)/12,0,1)*clamp(1-(Math.abs(v.y)-5)/14,.4,1);
 const within=(r:number)=>clamp((r+EDGE-dg)/(2*EDGE),0,1);
 const danger=isBall?1:Math.max(within(da>db+BEHIND&&Math.abs(v.y)>BEHIND_WIDE?R-BEHIND_R:R),running?within(R+RUN_R):0,da<db-AHEAD?within(R+AHEAD_R):0);
 // their spare man: well behind the ball and outside the plain radius (no
 // central bonus, no keeping, no soft edge), not running: nobody's, whatever
 // he was (checkpoint 1: their outlet at the centre circle was kept marked)
 const plainR=DANGER_R[tactics.line]+DANGER_PRESS[tactics.press];
 const spare=!isBall&&!running&&da>db+SPARE_BEHIND&&dg>plainR+SPARE_R;
 let matter:Matter;
 if(isBall)matter='ball';
 else if(spare)matter='spare';
 else if(danger>=.5)matter='danger';
 else matter='watch';
 const weight=matter==='ball'?3:matter==='spare'?0:.3+.3*close+(.7+close)*danger+(running?.5*danger:0);
 return {id:a.id,v,matter,weight,dg,running,danger};
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
export const isRole=(id:string|undefined)=>!!id&&id.startsWith('#');
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
  if(target)memory.men[id]={target,since:time};else delete memory.men[id];
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
  if(cover&&!live.some(r=>r.matter==='danger'&&distance(r.v,cover)<COVER_SHARE)){
   const far=clamp((40-depth(defending,carrier!.x))/15,.3,1);
   // ("On losing it": Regroup's delayer always keeps a cover behind him)
   targets.push({id:COVER,weight:ROLE_W.cover*far*(input.intent==='delay'?2:1),unowned:ROLE_UNOWNED.cover*(input.intent==='delay'?2:1),spot:()=>cover});
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
   // (every option shifted by the same SHIFT, so no term is negative and the search's bound holds)
   return run-credit(q,t)+SHIFT;
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
  if(current&&row!==current&&mine&&(claimant.get(current)??d.id)===d.id){const kept=best(current);if(kept.top-free.top<SWITCH_GAIN)row=current;}
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
 memory.dupAt=time;resolve();
 memory.solvedAt=time;memory.focus=focus;memory.who=who;
 return memory;
}

/** How far a marker may sag off his man and still reach him before a pass to
 * him arrives: the pass (a quick release, about 13 m/s) against his reaction
 * (his read of the game) and his legs. */
export function reach(q:PracticePlayer,man:Vec,ref:Vec,tactics:Tactics):number{
 const pass=.3+distance(ref,man)/13,react=.15+.3*(1-acuity(q,'threat'));
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
/** The marking spot: goal-side of the man on his line to the goal centre,
 * shaded to the ball and to the side he wants to go, sagging towards the
 * ball-goal line when he is far from the ball, never giving up GOALSIDE m of
 * depth along his line to goal. `sagScale` < 1 takes back part of the sag (a
 * sag that would put him beside a team-mate's man). */
export function markSpot(q:PracticePlayer,r:ManRead,ref:Vec,tactics:Tactics,defending:Side,squeeze=0,sagScale=1):Vec{
 const g={x:world(defending,0),y:0};
 // where he is going: a runner read further ahead
 const onHim=distance(q,r.v)<2.5&&distance(q,g)<distance(r.v,g);
 // a marker still on his way runs to where the man will be when he gets there (an interception course, the
 // owner's finding B: not at where the man is now), read from his velocity as seen, never off the pitch
 let lead=r.running?TRACK_LEAD:READ_AHEAD;
 let v:Vec=ahead(r.v,lead);
 if(!onHim&&Math.hypot(r.v.vx,r.v.vy)>INTERCEPT_SPEED){
  const more=clamp(arrivalTime(q,v)*INTERCEPT_SHARE,lead,INTERCEPT_MAX)-lead;
  // (only his run across or towards our goal is read further: a man coming away from goal is not followed out, his marker holds goal-side)
  const g0={x:(g.x-r.v.x),y:(g.y-r.v.y)},n0=Math.hypot(g0.x,g0.y)||1,toward=(r.v.vx*g0.x+r.v.vy*g0.y)/n0;
  const vx=r.v.vx-Math.min(0,toward)*g0.x/n0,vy=r.v.vy-Math.min(0,toward)*g0.y/n0;
  v={x:v.x+vx*more,y:v.y+vy*more};
 }
 v=inside(v);const dg=distance(v,g)||1;
 // the direction he is marked from: goal-side, and from the ball's side as the man nears the goal line
 const tg={x:(g.x-v.x)/dg,y:(g.y-v.y)/dg},db=distance(v,ref)||1,tb={x:(ref.x-v.x)/db,y:(ref.y-v.y)/db};
 const wl=clamp(1-(depth(defending,v.x)-1)/(LINE_NEAR-1),0,1);
 let ux=tg.x*(1-.6*wl)+tb.x*wl,uy=tg.y*(1-.6*wl)+tb.y*wl;const un=Math.hypot(ux,uy)||1;ux/=un;uy/=un;
 const u={x:ux,y:uy};
 // the cushion: his read of the man's pace against his own (a quicker man gets more room), so a run is a race he is already ahead in
 const quicker=clamp(perceive(q,'threat',(r.v as PracticePlayer).pace-q.pace,1,r.v,{salt:`pace${r.id}`})*.6,0,1.2);
 // and the further his man is from our goal, the more room he gives him towards it (the cushion grows with distance; near our goal, none)
 const far=clamp((dg-FAR_CUSHION.from)*FAR_CUSHION.rate,0,FAR_CUSHION.max);
 const fade=clamp((dg-TIGHT_IN)/TIGHT_FADE,0,1);
 // (Tight stays close whatever the man's distance or pace: CUSHION_MARKING)
 let gap=Math.min(MARK_GAP[tactics.marking??'balanced']+(quicker+far)*CUSHION_MARKING[tactics.marking??'balanced']*fade,Math.max(.6,dg-1.5));
 if(fade<1)gap=Math.min(gap,TIGHT_MAX+(gap-TIGHT_MAX)*fade);
 let s0={x:v.x+u.x*gap,y:v.y+u.y*gap};
 // the side he wants to go: his velocity as seen (moving), else his facing; a wide man near goal is shown outside
 const n={x:-u.y,y:u.x},speed=Math.hypot(r.v.vx,r.v.vy);
 const dir=speed>1?{x:r.v.vx/speed,y:r.v.vy/speed}:{x:Math.cos((r.v as PracticePlayer).angle??0),y:Math.sin((r.v as PracticePlayer).angle??0)};
 const want=dir.x*n.x+dir.y*n.y,inward=Math.abs(v.y)>3&&dg<TIGHT_IN+TIGHT_FADE?-Math.sign(v.y)*n.y:0;
 // (he never leaves the man's shot at goal open: the shade fades out as the man nears the box, where the shot line is the job)
 const side=clamp(want*(speed>1?1.2:.6)+inward*INSIDE_LEAN,-1,1)*SIDE_SHADE*(1-fade*.5)*clamp((dg-8)/6,0,1);
 s0={x:s0.x+n.x*side,y:s0.y+n.y*side};
 const dBall=distance(v,ref);
 const tight=Math.max(clamp((ONE_PASS_FAR-dBall)/(ONE_PASS_FAR-ONE_PASS),0,1),clamp((NEAR_GOAL_FAR-dg)/(NEAR_GOAL_FAR-NEAR_GOAL),0,1),r.running?1:0);
 const help=onSegment(s0,ref,g),gapToHelp=distance(s0,help);
 const loose=reach(q,v,ref,tactics)*(1-.5*squeeze);
 const sag=Math.min(gapToHelp,tight*Math.min(SHADE,gapToHelp)+(1-tight)*loose)*sagScale;
 const p=gapToHelp>1e-6?{x:s0.x+(help.x-s0.x)/gapToHelp*sag,y:s0.y+(help.y-s0.y)/gapToHelp*sag}:s0;
 // never level with him: at least GOALSIDE m goal-side along his line to goal
 const along=(p.x-v.x)*u.x+(p.y-v.y)*u.y,need=Math.min(GOALSIDE,dg-1);
 return along<need?{x:p.x+u.x*(need-along),y:p.y+u.y*(need-along)}:p;
}

/** The block's height now (m from our goal), by the Line. */
export function blockDepth(tactics:Tactics,refDepth:number,squeeze:number):number{
 const b=BLOCK[tactics.line];
 return clamp(refDepth-b.gap+squeeze*b.squeeze,b.floor,b.ceiling+squeeze*b.squeeze);
}

/** One plan for the side without the ball: who owns whom, and where each stands. */
export function defendOutOfPossession(input:DefendInput):DefendPlan{
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
     const say=(id:string,target:string)=>{if(target)memory.men={...memory.men,[id]:{target,since:time}};else{const m={...memory.men};delete m[id];memory.men=m;}memory.calls={...memory.calls,[id]:[...(memory.calls[id]??[]),{target,at:time}].slice(-3)};};
     say(step.id,carrier.id);
     was.forEach((q,i)=>say(q.id,i===0&&theirs&&theirs.id!==carrier.id?theirs.id:''));
    }
   }
  }
 }

 // ---- pressure ----
 let presser:PracticePlayer|undefined,engaged=false;
 if(carrier){
  const claim=own.filter(q=>manOf(q)?.id===carrier.id).sort((a,b)=>(busy.has(a.id)?1:0)-(busy.has(b.id)?1:0)||arrivalTime(a,carrier)-arrivalTime(b,carrier)||a.id.localeCompare(b.id));
  presser=claim[0];
  if(presser&&!restart){
   const cd=depth(defending,carrier.x),running=goalward(carrier,defending)>=RUN_GOALWARD;
   engaged=input.intent==='engage'||cd<=ENGAGE[tactics.press]+ENGAGE_LINE[tactics.line]||running||carrier.role==='GK'&&tactics.press==='aggressive';
   // The presser beaten: the cover (or the best placed goal-side team-mate
   // whose man matters less) steps out to the ball; the beaten one recovers
   // goal-side towards the middle and takes that team-mate's man.
   // (a presser who has just missed a tackle, or bit on a feint, is beaten too: busy;
   // and near our goal one who is not between the man and the goal is no block)
   const outOfBlock=(q:PracticePlayer)=>distance(carrier,g)<NEAR_BLOCK&&(distance(q,g)>distance(carrier,g)-.3||distance(q,carrier)>BLOCK_REACH);
   const outOfBlockFor=(q:PracticePlayer)=>distance(carrier,g)<NEAR_BLOCK&&distance(q,g)>distance(carrier,g)-.3;
   if(engaged&&carrier.role!=='GK'&&input.intent!=='delay'&&(busy.has(presser.id)||isBeaten(presser,carrier,g)||outOfBlock(presser))&&(cd<28||running)){
    const step=own.filter(q=>q!==presser&&!busy.has(q.id)&&!isBeaten(q,carrier,g)&&distance(q,carrier)<11)
     .map(q=>{const m=manOf(q),r=m?readOf(q,m):undefined;return {q,score:arrivalTime(q,carrier)+(r?.matter==='danger'?.8*r.weight:0)-(q.id===memory.cover?.5:0)};})
     .sort((a,b)=>a.score-b.score||a.q.id.localeCompare(b.q.id))[0]?.q;
    if(step&&(busy.has(presser.id)||arrivalTime(step,carrier)<arrivalTime(presser,carrier)-.1)&&!outOfBlockFor(step)){
     const theirs=manOf(step);
     memory.men={...memory.men,[step.id]:{target:carrier.id,since:time}};
     memory.calls={...memory.calls,[step.id]:[...(memory.calls[step.id]??[]),{target:carrier.id,at:time}].slice(-3)};
     if(theirs){memory.men[presser.id]={target:theirs.id,since:time};memory.calls[presser.id]=[...(memory.calls[presser.id]??[]),{target:theirs.id,at:time}].slice(-3);}
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
   const aim=Math.abs(carrier.y)>2&&distance(carrier,g)>10?{x:move.aim.x,y:move.aim.y-Math.sign(carrier.y)*SHOW}:move.aim;
   push({player:presser.id,purpose:'press',kind:move.kind,aim:inside(aim),speed:move.speed,reason:input.intent==='engage'?'Tocmai am pierdut-o: atacă imediat purtătorul.':input.intent==='delay'?'Tocmai am pierdut-o: îl ține în față și câștigă timp cât colegii se reașază.':move.reason,target:carrier.id,velocity:move.velocity});
  }else{
   const d=distance(carrier,g)||1,off=HOLD[tactics.press];
   const aim={x:carrier.x+(g.x-carrier.x)/d*off,y:carrier.y+(g.y-carrier.y)/d*off-(Math.abs(carrier.y)>2?Math.sign(carrier.y)*SHOW:0)};
   push({player:presser.id,purpose:'press',kind:'jockey',aim:inside(aim),speed:presser.pace*.85,reason:'Purtătorul e departe de poarta noastră: îl lasă să vină, rămâne între el și poartă, gata să iasă.',target:carrier.id,velocity:{x:carrier.vx,y:carrier.vy}});
  }
 }

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
  // (a ball in the air to his man: the receiver's own defender goes up with him, a duel, not a race he must win)
  const airborne=ball.z>.05||Math.abs(ball.vz)>.5;
  const pick=input.reach.find(c=>eligible(c.id)&&c.score<=(input.theirs??Infinity)+(airborne&&byId.get(c.id)===receiverOwner?COLLECT_DUEL:COLLECT_MARGIN));
  if(pick){
   plan.collector={id:pick.id,meet:pick.point};done.add(pick.id);
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
  const closing=input.receiver?.id===m.id;
  let aim:Vec,reason:string;
  if(closing){
   const meet={...r.v,x:input.receiver!.meet.x,y:input.receiver!.meet.y},d=distance(meet,g)||1;
   aim={x:meet.x+(g.x-meet.x)/d*1,y:meet.y+(g.y-meet.y)/d*1};
   reason='Pasa merge la omul lui: îl închide cât mingea e pe drum, între el și poartă.';
  }else{
   aim=markSpot(q,r,ref,tactics,defending,squeeze);
   // a sag that would put him beside a team-mate's man (two on one, his own free) is taken back
   const others=Object.entries(memory.men).filter(([id,x])=>id!==q.id&&x.target!==m.id&&!isRole(x.target)).map(([,x])=>byId.get(x.target)).filter((a):a is PracticePlayer=>!!a&&a.side===attacking&&a.id!==carrier?.id&&distance(a,r.v)>SAG_CLEAR+1);
   for(const k of [.6,.3,0]){if(!others.some(a=>distance(view(q,a),aim)<SAG_CLEAR))break;aim=markSpot(q,r,ref,tactics,defending,squeeze,k);}
   // a man level with or behind the ball beside the carrier in midfield: his marker stays goal-side of the ball, BALL_CLEAR m off it (one dribble must not beat the presser, the cover and him)
   if(carrier&&carrier.role!=='GK'&&m.id!==carrier.id&&distance(carrier,g)>NEAR_BLOCK&&depth(defending,r.v.x)>depth(defending,carrier.x)-1&&distance(aim,carrier)<BALL_CLEAR){
    const cg=distance(carrier,g)||1,tg={x:(g.x-carrier.x)/cg,y:(g.y-carrier.y)/cg},da=distance(aim,carrier)||1,away={x:(aim.x-carrier.x)/da,y:(aim.y-carrier.y)/da};
    let ux=away.x+tg.x,uy=away.y+tg.y;const n=Math.hypot(ux,uy)||1;ux/=n;uy/=n;
    aim={x:carrier.x+ux*BALL_CLEAR,y:carrier.y+uy*BALL_CLEAR};
   }
   reason=r.running?'Omul lui aleargă spre poartă: merge cu el, cu un pas spre poartă.':
    distance(r.v,ref)<ONE_PASS||distance(r.v,g)<NEAR_GOAL?'Își marchează omul: între el și poartă, aproape de el.':
    'Omul lui e departe de minge: între el și poartă, strâns spre mijloc, cât să-l prindă la o pasă.';
  }
  let purpose:DefendJob['purpose']='mark';
  if(input.regroup&&depth(defending,aim.x)>regroupLine){aim={x:world(defending,regroupLine),y:aim.y*.7};purpose='drop';reason='Regrupare: aleargă înapoi, în spatele mingii, cât colegul întârzie purtătorul.';}
  const far=distance(q,aim)>2.5,moving=Math.hypot(r.v.vx,r.v.vy)>2;
  const share=r.running?RUN_VELOCITY_SHARE:VELOCITY_SHARE;
  push({player:q.id,purpose,kind:purpose==='drop'?'recover':'track',aim:inside(aim),speed:q.pace*(far||moving||closing||purpose==='drop'?1:.9),reason,target:m.id,velocity:purpose==='drop'?undefined:{x:r.v.vx*share,y:r.v.vy*share}});
 }

 // ---- the free men: balance, then a screen in the middle ----
 // (the one who chose the balance first, then anyone left without a man)
 const freeMen=own.filter(q=>!done.has(q.id)&&!(plan.collector?.id===q.id)&&!manOf(q)).sort((a,b)=>(roleOf(b)===BALANCE?1:0)-(roleOf(a)===BALANCE?1:0));
 if(freeMen.length){
  const sgn=Math.sign(ref.y)||1;
  // an attacker nobody owns who still matters to us (a watched far man)
  const owned=new Set([...Object.values(memory.men).map(m=>m.target),...fixed.values()]);
  const loose=players.filter(a=>a.side===attacking&&a.role!=='GK'&&!owned.has(a.id)&&a.id!==carrier?.id);
  const bd=Math.min(block,refDepth-3);
  const balanceAim=(q:PracticePlayer)=>{
   // the far man nobody owns: goal-side of him, sagged towards the middle as
   // far as he can still reach him on a switch (markSpot; Width prices it)
   const far=loose.map(a=>readOf(q,a)).filter(r=>r.matter!=='spare'&&r.v.y*sgn<0).sort((a,b)=>a.dg-b.dg)[0];
   const deepest=loose.map(a=>readOf(q,a)).filter(r=>r.matter!=='spare').map(r=>depth(defending,r.v.x)).sort((a,b)=>a-b)[0];
   if(far){
    const spot=markSpot(q,{...far,running:false},ref,tactics,defending,squeeze),tuck=-sgn*BALANCE_Y[tactics.width];
    // never wider than his man, never on the ball's side of the middle line he tucks to
    const y=sgn<0?clamp(spot.y,tuck,Math.max(tuck,far.v.y)):clamp(spot.y,Math.min(tuck,far.v.y),tuck);
    let dd=Math.min(depth(defending,spot.x),refDepth-2);
    if(deepest!==undefined)dd=Math.min(dd,deepest-1);
    return {x:world(defending,Math.max(BALANCE_FLOOR,dd)),y};
   }
   let dd=bd;
   // nobody unowned behind him, and a man he leaves in front of him kept a run's start away (BALANCE_CUSHION)
   if(deepest!==undefined)dd=Math.min(dd,deepest-BALANCE_CUSHION);
   return {x:world(defending,Math.max(BALANCE_FLOOR,dd)),y:-sgn*BALANCE_Y[tactics.width]};
  };
  const ranked=freeMen.map(q=>({q,score:(roleOf(q)===BALANCE?-10:0)+arrivalTime(q,balanceAim(q))})).sort((a,b)=>a.score-b.score||a.q.id.localeCompare(b.q.id));
  ranked.forEach(({q},i)=>{
   if(i===0){
    let aim=balanceAim(q),purpose:DefendJob['purpose']='balance',reason='Echilibru: partea opusă mingii, spre mijloc, între adversari și poartă, la înălțimea blocului.';
    if(input.regroup&&depth(defending,aim.x)>regroupLine){aim={x:world(defending,regroupLine),y:aim.y};purpose='drop';reason='Regrupare: aleargă înapoi, în spatele mingii.';}
    const far=distance(q,aim)>4;
    push({player:q.id,purpose,kind:depth(defending,q.x)>depth(defending,aim.x)+4?'recover':'hold',aim:inside(aim),speed:q.pace*(far||purpose==='drop'?.95:.75),reason});
   }else{
    // a screen: the middle of our block, at its height, never within SCREEN_OFF m of the ball (the presser and the cover are there)
    const sd=Math.min(bd,refDepth-SCREEN_OFF);
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
   const d=distance(j.aim,a);if(d>=FREE_GAP)continue;
   // step towards our goal, away from him
   const to={x:g.x-a.x,y:g.y-a.y},n=Math.hypot(to.x,to.y)||1;
   j.aim=inside({x:a.x+to.x/n*FREE_GAP,y:a.y+to.y/n*FREE_GAP});
  }
 }
 for(const j of plan.jobs)j.aim=offGoalLine(defending,j.aim,ball);
 if(presser)plan.presser=presser.id;
 if(cover)plan.coverer=cover.id;
 return plan;
}
