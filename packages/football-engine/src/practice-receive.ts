import {clamp} from './model.js';
import {steerMotion} from './movement.js';
import type {Vec,MovingBall} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import {perceive,daring} from './practice-perception.js';
import {arrivalTime} from './practice-defense.js';
import {launchRisk,footToBall} from './practice-possession.js';
import {touchGap} from './practice-reception.js';
import {shotContest,hurryTruth} from './practice-shot-contest.js';
import {PASS_DRAG} from './practice-flight.js';
import {WORLD} from './world.js';

/** Receive round (2026-10-15): the receiver reads his reception while the ball
 * is on its way, not after it arrives. The owner: "judging the situation before
 * they have the ball (am I going to receive in an open area, is a teammate
 * making a run, am I being pressed, is this a good place to shoot, if I wait
 * will I have better options) ... rather than getting the ball and then
 * thinking of next steps." Before, a plan was made in flight only within 14 m,
 * for an option within 0.06 of his best, lane risk under 0.28, never a loft or
 * a clearance; 78% of receivers met the ball with no intention, stopped it, and
 * only then looked (4 touches a spell, 8% one-touch; pressure gave MORE
 * touches: evidence/2026-10-15-watch-notes).
 *
 * The read, every READ_EVERY s while the ball comes, from READ_BASE +
 * READ_PER x reading s before it arrives (a good reader reads it earlier):
 *  - the picture at his reception: the opponents where their momentum takes
 *    them by then (projectOpponents), the options he will have there (the
 *    ordinary option search, from the meeting point);
 *  - his room: how long he will have on the ball before the first opponent is
 *    on him (receptionRoom), misjudged by his read of an arrival;
 *  - and, for the option he means to play, what a controlling touch would cost
 *    it (touchCost: the man closing him, the lane closing, the shot closing)
 *    against what striking it first time costs (firstTimeCost: the incoming
 *    pace he must strike through, a ball still coming out of the air).
 * He arrives with an intention, and his first touch serves it: first time
 * unless a touch buys more than it costs; otherwise a touch that sets up the
 * next action (towards the pass, onto the shot, into the space of a carry).
 * A set touch is the set: off it he strikes the ball on his next contact unless
 * it ran clearly wrong (practice-control SET_TOUCH_SLACK). Nothing caps his
 * touches: with time and nothing on he carries or settles, as before. The
 * reader is whoever the ball reaches first: the team-mate it is meant for, or
 * the defender cutting it out (an interception is a reception too; near his
 * own goal, closed down, he clears it first time: practice.ts CLEAR_READ).
 * Reading sets how early and how well he reads; temperament (daring) only
 * shades how readily he goes first time. */
export const READ_BASE=WORLD.perception.receive.READ_BASE.v,READ_PER=WORLD.perception.receive.READ_PER.v,READ_EVERY=WORLD.perception.receive.READ_EVERY.v;
export const readHorizon=(p:{skills:{reading:number}})=>READ_BASE+READ_PER*clamp(p.skills.reading,0,10);
/** The opponents' momentum is read over at most READ_AHEAD s (launchRisk's own
 * one-second forecast, a little shorter: a man does not run straight on for
 * ever); a man closing the meeting point stops ON_HIM m short of it. */
export const READ_AHEAD=WORLD.perception.receive.READ_AHEAD.v,ON_HIM=WORLD.selection.receive.ON_HIM.v;
/** A receiver who cannot read an arrival at all misjudges his room by up to
 * ROOM_SPREAD s; a top reader is nearly exact (practice-perception misread). */
export const ROOM_SPREAD=WORLD.perception.receive.ROOM_SPREAD.v;
/** Options he may plan in flight: within READ_MARGIN of his best (as before),
 * and a release up to LATE_MARGIN further when the read says he will be closed
 * down (late = 1): a slightly worse ball played now beats the ball he would be
 * caught on. */
export const READ_MARGIN=WORLD.perception.receive.READ_MARGIN.v,LATE_MARGIN=WORLD.perception.receive.LATE_MARGIN.v;
/** What striking first time costs, as a share of the chance (the same 0..1
 * scale as touchCost): the incoming pace he strikes through, a ball still
 * dropping out of the air (AERIAL_SET more: the long ball's controlling touch
 * is kept unless a man is really on him), and a plan made too late to shape
 * his body for it (lateStrike). A first-time shot also carries shot-contest's
 * FIRST_TIME hurry, read separately. A touch has to earn its place: with a
 * ball he can strike cleanly and nothing a touch would buy, he plays it first
 * time. A daring player (risk, audacity) feels the pace he strikes through
 * less, LOAD_DARE x daring of it: temperament shades how readily he goes first
 * time, never the read itself.
 *
 * (decide round, 2026-10-15) The pace is priced at what the strike actually
 * loses, not on a scale of its own. At the strike a first-time ball costs
 * FT_PASSING passing and FT_FINISHING finishing points per unit of load
 * ((relative speed - 4) / 8, practice.ts). A passing point is PASS_ERROR m
 * more aim spread (practice-passing strikeGroundPass: 0.09 m a point, a
 * little more over range), and a receiver meets a ball that far off within
 * about PASS_SLACK m of where it was meant (a stride either side), so a point
 * costs a pass PASS_POINT of its chance. A finishing point is SHOT_DEVIATION
 * rad more angular error (practice-football assessShot: 0.08 rad over the
 * 0..10 scale) against a typical shot's TYPICAL_DEVIATION (0.09 rad), and the
 * chance falls about in step with the spread (assessShot's precision), so a
 * point costs a shot SHOT_POINT. Before, a pass paid 0.25 and a shot 0.35 a
 * unit of load: two to three times what the strike loses (decide notes: a
 * free receiver played first time only off a ball slower than 4 m/s, 2% of
 * reads, and first-time shots converted better, not worse). */
export const FT_PASSING=WORLD.selection.receive.FT_PASSING.v,FT_FINISHING=WORLD.selection.receive.FT_FINISHING.v;
export const PASS_ERROR=WORLD.selection.receive.PASS_ERROR.v,PASS_SLACK=WORLD.selection.receive.PASS_SLACK.v,SHOT_DEVIATION=WORLD.selection.receive.SHOT_DEVIATION.v,TYPICAL_DEVIATION=WORLD.selection.receive.TYPICAL_DEVIATION.v;
export const PASS_POINT=PASS_ERROR/PASS_SLACK,SHOT_POINT=SHOT_DEVIATION/TYPICAL_DEVIATION;
export const PASS_LOAD=FT_PASSING*PASS_POINT,SHOT_LOAD=FT_FINISHING*SHOT_POINT,AERIAL_SET=WORLD.selection.receive.AERIAL_SET.v,LOAD_DARE=WORLD.selection.receive.LOAD_DARE.v;
/** The load a first-time strike carries: what the incoming pace takes off him, 0..1. */
export const strikeLoad=(relativeSpeed:number)=>clamp((relativeSpeed-4)/8,0,1);

/** (decide round, 2026-10-15) The plan he arrives with. The owner: "You
 * already decide to strike as a footballer before you get the ball ... You
 * don't take the ball and then think 'what am I going to do now' unless you
 * have the time." The research (penalty-kick timing, futsal scanning): the
 * plan is provisional, but it is changed only when the picture genuinely
 * changes, a full switch needs about 0.3-0.5 s before contact, and a late one
 * costs accuracy. Before, the read re-chose its best option every 0.18 s: 47%
 * of receptions changed plan in flight, 24% on the last read, and 71% of
 * first-time intentions were refused at the contact because the plan had not
 * been held long enough (held a median 0.08 s).
 *  - He keeps the plan he has while it is still on: the option is still
 *    there, its lane is still open (plannedRisk), the man closing him is not
 *    coming faster than he read (his room has not fallen by ROOM_DROP s), and
 *    no other option has become clearly better (by READ_KEEP, beyond the
 *    READ_MARGIN band he plans within). A runner breaking clear is a genuine
 *    change; a re-score of the same picture is not.
 *  - Inside SWITCH_DEADLINE s of the ball reaching him he no longer changes
 *    for a better option, only when the plan he has is taken away.
 *  - A plan formed less than SWITCH_DEADLINE s before he strikes it first
 *    time costs accuracy (lateStrike): up to LATE_POINTS passing or finishing
 *    points, none once he has had the deadline to shape his body; under
 *    SHAPE_MIN s (a reaction) he cannot strike it first time at all. That
 *    replaces the fixed "held 0.13 s + 0.012 s a reading point" gate. */
export const READ_KEEP=WORLD.perception.receive.READ_KEEP.v,ROOM_DROP=WORLD.selection.receive.ROOM_DROP.v,SWITCH_DEADLINE=WORLD.perception.receive.SWITCH_DEADLINE.v,SHAPE_MIN=WORLD.selection.receive.SHAPE_MIN.v,LATE_POINTS=WORLD.selection.receive.LATE_POINTS.v;
/** The plan carries through the touch (practice.ts, the meeting): it is played unless, on the picture at the touch,
 * its lane has closed, it is gone, or another option is PLAN_KEEP better (before: 0.08, so a fresh look at the same
 * picture re-chose it; a prepared kick's own re-check margin is 0.18). If the plan is off he plays the next option
 * he arrived with (`alt`, his ranked second) when that is still on, after a touch: a switch at the contact is too
 * late to strike first time. Only with neither does he decide on the ball.
 * A prepared kick is committed once it is within SWITCH_DEADLINE s of being struck (practice.ts, the re-check): he
 * plays it unless its launch is blocked (closedRelease). A kick still overdue COMMIT_GRACE s after it should have gone
 * (the ball ran wrong) is looked at again. Before, every 0.2 s he re-scored it against options that would each need
 * a wind-up of their own, on a fresh full horizon that let the presser close again, and dropped 42% of them. */
/** ... and a ground pass is looked at again when a man has got into its lane: the lane read now (laneRisk) at
 * LANE_CLOSED or more, the level at which the meeting's own check (practice.ts, risk under 0.32 for a plan) has long
 * given up on it. (Without it, the first cloud run of this round lost twice as many passes within 12 m of our own goal:
 * 2.0 a match against 1.0, their goals within 5 s of those 0.29 against 0.06.) */
export const PLAN_KEEP=WORLD.selection.receive.PLAN_KEEP.v,COMMIT_GRACE=WORLD.perception.receive.COMMIT_GRACE.v,LANE_CLOSED=WORLD.selection.receive.LANE_CLOSED.v;
/** How late a first-time strike of a plan held `held` s is, 0..1 (0 = shaped in time). */
export const lateStrike=(held:number)=>clamp((SWITCH_DEADLINE-held)/(SWITCH_DEADLINE-SHAPE_MIN),0,1);
/** The same intention: a kick to the same man, the same kind of carry or shot. */
export const sameIntention=(a:Option,b:Option)=>a.kind===b.kind&&a.target===b.target&&a.carry?.purpose===b.carry?.purpose;

/** (decide round, 2026-10-15) Team-mates read forward, as opponents are. The
 * read projected the opponents along their momentum but took team-mates where
 * they stood (decide notes: 64% of in-flight plans were "carry", which commits
 * to nothing, and when the plan turned into a kick after the touch the kick's
 * value had risen 0.09, 66% of the time the kind the read already had as its
 * best kick: the pass he would play a moment later was priced at where the
 * man had been). A footballer knows where his team-mates are going: the run he
 * can see them making and the job they are on (their aim and pace). He reads
 * them there, `ahead` s on (at most MATE_AHEAD), as far as his reading lets
 * him anticipate it: ANTICIPATE_MIN of the way for a man who cannot read the
 * game, all of it for a top reader. Copies: the live players never move. */
export const MATE_AHEAD=WORLD.selection.receive.MATE_AHEAD.v,ANTICIPATE_MIN=WORLD.perception.receive.ANTICIPATE_MIN.v;
export const anticipation=(p:{skills:{reading:number}})=>ANTICIPATE_MIN+(1-ANTICIPATE_MIN)*clamp(p.skills.reading/10,0,1);
export type MateJob=(q:PracticePlayer)=>{aim:Vec;speed:number}|undefined;
export function projectMates(players:readonly PracticePlayer[],reader:PracticePlayer,ahead:number,job:MateJob):PracticePlayer[]{
 const t=clamp(ahead,0,MATE_AHEAD)*anticipation(reader);
 if(t<=0)return players as PracticePlayer[];
 return players.map(q=>{
  if(q.side!==reader.side||q.id===reader.id)return q;
  const j=job(q);if(!j||j.speed<=.1)return q;
  const preview={...q};
  for(let s=0;s<t;s+=.1)steerMotion(preview,j.aim,Math.min(.1,t-s),Math.min(q.pace,j.speed));
  return preview;
 });
}

/** When a moving ball reaches `point` (s): along the ground it slows with the
 * pass drag; in the air it keeps its pace. At most the time a 3 m/s ball takes
 * (a dying ball is met by the man going to it). */
export function ballArrival(ball:MovingBall,point:Vec):number{
 const d=Math.hypot(point.x-ball.x,point.y-ball.y),speed=Math.max(.1,Math.hypot(ball.vx,ball.vy));
 if(ball.z>.05||ball.vz>.5)return d/Math.max(3,speed);
 const disc=speed*speed-2*PASS_DRAG*d;
 return disc>0?Math.min(d/3,(speed-Math.sqrt(disc))/PASS_DRAG):d/3;
}
/** The ball's speed relative to his body when he meets it (m/s): what a
 * first-time strike must strike through. */
export function meetingSpeed(ball:MovingBall,p:{vx:number;vy:number},arrive:number):number{
 const speed=Math.hypot(ball.vx,ball.vy),air=ball.z>.05||ball.vz>.5;
 const left=air?speed:Math.max(0,speed-PASS_DRAG*arrive),ux=ball.vx/Math.max(.01,speed),uy=ball.vy/Math.max(.01,speed);
 return Math.hypot(ux*left-p.vx,uy*left-p.vy);
}
/** The opponents of `side` where their visible momentum takes them in `ahead`
 * s (at most READ_AHEAD), a man running at the meeting point stopping ON_HIM m
 * short of it; team-mates as they are. Copies: the live players never move. */
export function projectOpponents(players:readonly PracticePlayer[],side:number,meeting:Vec,ahead:number):PracticePlayer[]{
 const t=clamp(ahead,0,READ_AHEAD);
 return players.map(q=>{
  if(q.side===side||t<=0)return q;
  let x=q.x+q.vx*t,y=q.y+q.vy*t;
  // the nearest he comes to the meeting point on the way, and where it is
  const dx=x-q.x,dy=y-q.y,len2=dx*dx+dy*dy;
  if(len2>1e-6){
   const u=clamp(((meeting.x-q.x)*dx+(meeting.y-q.y)*dy)/len2,0,1),cx=q.x+dx*u,cy=q.y+dy*u;
   if(Math.hypot(cx-meeting.x,cy-meeting.y)<ON_HIM){const back=Math.hypot(meeting.x-q.x,meeting.y-q.y),k=Math.max(0,back-ON_HIM)/Math.max(.01,back);x=q.x+(meeting.x-q.x)*k;y=q.y+(meeting.y-q.y)*k;}
  }
  return {...q,x,y};
 });
}
/** His room (s): from the ball reaching him until the first opponent is on him
 * (arrivalTime: within a metre), as he reads it. */
export function receptionRoom(p:PracticePlayer,meeting:Vec,arrive:number,players:readonly PracticePlayer[],time?:number):number{
 let first=Infinity;
 for(const q of players)if(q.side!==p.side)first=Math.min(first,arrivalTime(q,meeting));
 if(!Number.isFinite(first))return Infinity;
 return perceive(p,'arrival',first-arrive,ROOM_SPREAD,meeting,{time,salt:'room'});
}
/** What a controlling touch costs him before he can strike: the touch, and his
 * foot getting back to the ball (touchGap + footToBall). */
export const touchTime=(p:PracticePlayer)=>touchGap(p)+footToBall(p);
/** How late a touch would make him, 0..1: the share of his touch time the
 * first opponent is already on him for (none with room to spare, all of it
 * with none). */
export const roomLate=(p:PracticePlayer,room:number)=>{const need=touchTime(p);return clamp((need-room)/need,0,1);};
/** A keeper moving across his goal is not set (practice.ts SET_STILL: none at KEEPER_STILL m/s); given a touch's time
 * he plants. Being set gives him about the edge a fully hurried shot does (practice-football keeperEdge: EDGE_SET v
 * EDGE_HURRY), but hurry also pulls the shot towards him and softens it (placeHurried, strikeShot), so a keeper caught
 * moving counts KEEPER_SET_WORTH of what a fully hurried shot costs. Shot hurry is turned into a share of the chance
 * the way the shooter's own read of it is (practice-shot-contest hurryTruth). */
export const KEEPER_STILL=WORLD.selection.receive.KEEPER_STILL.v,KEEPER_SET_WORTH=WORLD.selection.receive.KEEPER_SET_WORTH.v;
type LaneRisk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number,delay?:number)=>number;
/** What a controlling touch would cost this option, 0..1, read at the meeting
 * point on the projected picture `seen`: the man closing him (roomLate), and
 *  - for a shot, the contest growing over his touch time (its hurry) and their
 *    keeper planting meanwhile (a first-time finish beats a keeper still moving
 *    across: futsal's most common goal);
 *  - for a kick, its launch past the nearest foot closing (the launch read
 *    with and without his touch time) and, along the ground, the lane closing
 *    as the defenders' momentum carries them on (the lane read on the picture
 *    a touch later): a defence shifting across is beaten by the ball played
 *    before it arrives.
 * (decide round) ... and as the defence reshapes: every defender has his
 * touch's time more to get to the lane (the lane read with the kick `need` s
 * later, laneRisk's delay), not only the momentum he already has. Before, a
 * defence standing still cost a touch nothing (decide notes: the touch cost
 * was exactly 0 in 88% of free reads), though a defence given time turns its
 * heads and steps across. */
export function touchCost(p:PracticePlayer,o:Option,meeting:Vec,seen:readonly PracticePlayer[],room:number,lane:LaneRisk):number{
 const late=roomLate(p,room),need=touchTime(p),body={...p,x:meeting.x,y:meeting.y,vx:0,vy:0};
 if(o.kind==='shoot'){
  const now=hurryTruth(shotContest(body,seen,o.aim).hurry),later=hurryTruth(shotContest(body,seen,o.aim,{lead:need}).hurry);
  const keeper=seen.find(q=>q.side!==p.side&&q.role==='GK'),moving=keeper?clamp(Math.hypot(keeper.vx,keeper.vy)/KEEPER_STILL,0,1):0;
  return Math.max(late,clamp(later-now+KEEPER_SET_WORTH*hurryTruth(1)*moving,0,1));
 }
 if(o.kind==='carry'||o.kind==='feint')return 0;
 const reach=o.kind==='clear'&&(o.clearance==='long'||o.clearance==='channel'||o.clearance==='mate')?1.6:4;
 const all=seen as PracticePlayer[],blocked=launchRisk(body,o.aim,all,need,reach)-launchRisk(body,o.aim,all,0,reach);
 let closing=0;
 if(o.pass){
  const opponents=all.filter(q=>q.side!==p.side),later=projectOpponents(opponents,p.side,meeting,need),open=lane(body,o.aim,opponents,o.pass.speed);
  closing=Math.max(lane(body,o.aim,later,o.pass.speed),lane(body,o.aim,opponents,o.pass.speed,need))-open;
 }
 return Math.max(late,clamp(blocked,0,1),clamp(closing,0,1));
}
/** What striking it first time costs him, on the same scale (see PASS_LOAD); `late` is how late his plan will be at
 * the strike (lateStrike of the time he will have held it), priced as the points it costs (LATE_POINTS). */
export function firstTimeCost(p:PracticePlayer,o:Option,relativeSpeed:number,aerial:boolean,meeting:Vec,seen:readonly PracticePlayer[],late=0):number{
 const load=strikeLoad(relativeSpeed),body={...p,x:meeting.x,y:meeting.y,vx:0,vy:0},point=o.kind==='shoot'?SHOT_POINT:PASS_POINT;
 const shot=o.kind==='shoot'?hurryTruth(shotContest(body,seen,o.aim,{firstTime:true}).hurry)-hurryTruth(shotContest(body,seen,o.aim).hurry):0;
 return load*(o.kind==='shoot'?SHOT_LOAD:PASS_LOAD)*(1-LOAD_DARE*daring(p))+LATE_POINTS*late*point+shot+(aerial?AERIAL_SET:0);
}
