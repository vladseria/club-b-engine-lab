import {clamp} from './model.js';
import type {Vec,MovingBall} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import {perceive,daring} from './practice-perception.js';
import {arrivalTime} from './practice-defense.js';
import {launchRisk,footToBall} from './practice-possession.js';
import {touchGap} from './practice-reception.js';
import {shotContest,hurryTruth} from './practice-shot-contest.js';
import {PASS_DRAG} from './practice-flight.js';

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
export const READ_BASE=.9,READ_PER=.08,READ_EVERY=.18;
export const readHorizon=(p:{skills:{reading:number}})=>READ_BASE+READ_PER*clamp(p.skills.reading,0,10);
/** The opponents' momentum is read over at most READ_AHEAD s (launchRisk's own
 * one-second forecast, a little shorter: a man does not run straight on for
 * ever); a man closing the meeting point stops ON_HIM m short of it. */
export const READ_AHEAD=.8,ON_HIM=1;
/** A receiver who cannot read an arrival at all misjudges his room by up to
 * ROOM_SPREAD s; a top reader is nearly exact (practice-perception misread). */
export const ROOM_SPREAD=.5;
/** Options he may plan in flight: within READ_MARGIN of his best (as before),
 * and a release up to LATE_MARGIN further when the read says he will be closed
 * down (late = 1): a slightly worse ball played now beats the ball he would be
 * caught on. */
export const READ_MARGIN=.06,LATE_MARGIN=.1;
/** What striking first time costs, as a share of the chance (the same 0..1
 * scale as touchCost): the incoming pace he strikes through (the strike's own
 * load: (relative speed - 4) / 8, practice.ts releaseOption) costs a pass up
 * to PASS_LOAD and a shot up to SHOT_LOAD (a first-time shot also carries
 * shot-contest's FIRST_TIME hurry, read separately); a ball still dropping
 * out of the air costs AERIAL_SET more (the long ball's controlling touch is
 * kept unless a man is really on him). A touch has to earn its place: with a
 * ball he can strike cleanly and nothing a touch would buy, he plays it first
 * time (the old engine did whenever his plan and stance allowed). A daring
 * player (risk, audacity) feels the pace he strikes through less, LOAD_DARE x
 * daring of it: temperament shades how readily he goes first time, never the
 * read itself. */
export const PASS_LOAD=.25,SHOT_LOAD=.35,AERIAL_SET=.35,LOAD_DARE=.3;

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
export const KEEPER_STILL=3,KEEPER_SET_WORTH=.5;
type LaneRisk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
/** What a controlling touch would cost this option, 0..1, read at the meeting
 * point on the projected picture `seen`: the man closing him (roomLate), and
 *  - for a shot, the contest growing over his touch time (its hurry) and their
 *    keeper planting meanwhile (a first-time finish beats a keeper still moving
 *    across: futsal's most common goal);
 *  - for a kick, its launch past the nearest foot closing (the launch read
 *    with and without his touch time) and, along the ground, the lane closing
 *    as the defenders' momentum carries them on (the lane read on the picture
 *    a touch later): a defence shifting across is beaten by the ball played
 *    before it arrives. */
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
 if(o.pass){const opponents=all.filter(q=>q.side!==p.side),later=projectOpponents(opponents,p.side,meeting,need);closing=lane(body,o.aim,later,o.pass.speed)-lane(body,o.aim,opponents,o.pass.speed);}
 return Math.max(late,clamp(blocked,0,1),clamp(closing,0,1));
}
/** What striking it first time costs him, on the same scale (see PASS_LOAD). */
export function firstTimeCost(p:PracticePlayer,o:Option,relativeSpeed:number,aerial:boolean,meeting:Vec,seen:readonly PracticePlayer[]):number{
 const load=clamp((relativeSpeed-4)/8,0,1),body={...p,x:meeting.x,y:meeting.y,vx:0,vy:0};
 const shot=o.kind==='shoot'?hurryTruth(shotContest(body,seen,o.aim,{firstTime:true}).hurry)-hurryTruth(shotContest(body,seen,o.aim).hurry):0;
 return load*(o.kind==='shoot'?SHOT_LOAD:PASS_LOAD)*(1-LOAD_DARE*daring(p))+shot+(aerial?AERIAL_SET:0);
}
