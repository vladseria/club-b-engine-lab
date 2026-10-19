import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer,Option} from './practice.js';
import type {Vec} from './movement.js';
import {arrivalTime} from './practice-defense.js';
import {strikeTurnTime} from './practice-striking.js';
import {PASS_DRAG} from './practice-flight.js';
import {nerve,perceive,daring,composure} from './practice-perception.js';
import {turnoverPrice,deliveryLossWeight} from './practice-rest-defence.js';
import {duelChance,CHALLENGE_RANGE,BOOT_REACH,BALL_CONTACT} from './practice-challenge.js';
import {arrivalWithin} from './practice-arrival.js';
import {controlEdge} from './practice-reception.js';
import {PASS_POINT} from './practice-receive.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(p:PracticePlayer,x=p.x)=>p.side===0?x:L-x;
const difference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
type LaneRisk=(from:Vec,to:Vec,opponents:PracticePlayer[],speed?:number)=>number;
export interface PossessionSafety {danger:number;pressure:number;urgency:number;contactTime:number;adventure:number}

/** How near our own goal the ball is, as the carrier reads danger (0 from
 * 22 m out, 1 inside 7 m and central). */
export function ownGoalDanger(p:Vec&{side:number}):number{
 return clamp((X(48)-(p.side===0?p.x:L-p.x))/X(32),0,1)*(.6+.4*clamp((Y(28)-Math.abs(p.y))/Y(22),0,1));
}
/** Cost of losing possession here, separate from the player's appetite for risk. */
export function possessionSafety(p:PracticePlayer,players:PracticePlayer[]):PossessionSafety{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 const contactTime=Math.min(...opponents.map(q=>arrivalTime(q,p)));
 const near=Math.min(...opponents.map(q=>distance(q,p)));
 const pressure=Math.max(clamp((4-near)/4,0,1),clamp((1.2-contactTime)/1.2,0,1));
 const danger=ownGoalDanger(p);
 return {danger,pressure,urgency:danger*pressure,contactTime,adventure:p.traits.risk*.65+p.traits.dribble*.35};
}

/** B2, the pressed carrier (2026-10-09): how soon a man on the ball looks
 * again, from the moment he chose. "A man is closing me: I decide before he
 * gets here." He reads when the nearest opponent arrives on him (the
 * contact time: positions and momentum he can see, misjudged by his read of
 * an arrival) and looks again at a share of it that his reading sets: a top
 * reader at LOOK_SHARE[0] of it (he has already seen the escape), one who
 * cannot read at LOOK_SHARE[1] (he holds the plan he has a little longer,
 * and is caught on it more often). Never sooner than LOOK_MIN; the prepared
 * kick's 0.18 margin and the carry's commitment are still the minimum hold
 * against dithering. Wherever he is: before this round only danger near his
 * own goal sped it up, so a carrier pressed in midfield re-thought every
 * 0.38-0.56 s against a presser arriving in a median 0.41 s. With nobody
 * closing him the arrival is beyond the ordinary cadence and nothing changes. */
export const LOOK_MIN=.12,LOOK_SHARE:readonly [number,number]=[.3,.75],LOOK_SPREAD=.3;
export function lookAgain(p:PracticePlayer,players:PracticePlayer[],time?:number):number{
 const {contactTime}=possessionSafety(p,players);
 if(!Number.isFinite(contactTime))return Infinity;
 const reading=clamp((p.skills.reading??7)/10,0,1);
 const seen=Math.max(0,perceive(p,'arrival',contactTime,LOOK_SPREAD,p,{time,salt:'look'}));
 return Math.max(LOOK_MIN,seen*(LOOK_SHARE[1]-(LOOK_SHARE[1]-LOOK_SHARE[0])*reading));
}

export function preparationTime(p:PracticePlayer,kind:Option['kind']):number{
 return kind==='clear'?.08+(10-p.skills.control)*.01:.22+(10-p.skills.control)*.015;
}
export function releaseTime(p:PracticePlayer,aim:Vec,kind:Option['kind']):number{
 const turn=strikeTurnTime(p,aim,kind==='shoot'?'shot':kind==='clear'?'clearance':'pass');
 return Math.max(preparationTime(p,kind),turn);
}
/** Honest-reads round (2026-10-10): the time until a kick he chooses now is
 * actually away. releaseTime is when he is set (preparation, or turning to the
 * aim); getting his foot to the ball, as it rolls and as he steps to it, takes
 * footToBall more. Measured on 2bec595c (mirror arms, open-play ground passes
 * kicked from the preparation they were chosen in): choice to kick a median
 * 0.47 s at control 6, 0.19 s longer than releaseTime (0.28 s), and nearly the
 * same whatever the turn, the ball's distance or his speed; the extra is
 * 0.22 s at control 3 and 0.11 s at control 9 (a good controller's ball is
 * playable sooner: touchGap, setTolerance). FOOT_BASE - FOOT_CONTROL x control
 * - FOOT_EDGE x controlEdge reproduces all three within 0.01 s. */
export const FOOT_BASE=.26,FOOT_CONTROL=.01,FOOT_EDGE=.0625;
export const footToBall=(p:{skills:{control:number}})=>Math.max(.05,FOOT_BASE-FOOT_CONTROL*p.skills.control-FOOT_EDGE*controlEdge(p));
export function kickHorizon(p:PracticePlayer,aim:Vec,kind:Option['kind']):number{return releaseTime(p,aim,kind)+footToBall(p);}
/** His own read of that time (the release horizon his lane and launch reads
 * forecast over). How well he judges it is how well he reads the lane
 * (reading and passing): a passer who cannot read errs by up to
 * RELEASE_SPREAD s, a top one is nearly exact; a daring one (risk, audacity)
 * believes the ball is away RELEASE_OPTIMISM s x daring sooner than it is.
 * The real spread of the delay (quartiles 0.35-0.56 s) is about this size. */
export const RELEASE_SPREAD=.15,RELEASE_OPTIMISM=.1;
export function readKickHorizon(p:PracticePlayer,aim:Vec,kind:Option['kind']):number{
 return clamp(perceive(p,'lane',kickHorizon(p,aim,kind),RELEASE_SPREAD,aim,{salt:'release',bias:-RELEASE_OPTIMISM*daring(p)}),.1,1);
}

/** (decide round, 2026-10-15) "A pressed player picks what he can get away." When he chooses a kick he weighs the
 * man closing him against the kick's own wind-up: the time until the ball is away (his read of it, readKickHorizon:
 * setting it, turning to the aim, getting his foot to it), against when the first opponent is on him (his read of an
 * arrival, as lookAgain reads it). A kick he will still be winding up when the man is on him and has his tackle in
 * (CHALLENGE_LAND s after he arrives: a challenge takes 0.16-0.30 s to land, practice-challenge startChallenge) is
 * caught, more and more surely over the next CAUGHT_SPAN s. A caught kick is lost as often as the man wins a duel
 * against him (duelChance, with his cover): then he gets nothing for the kick and pays a ball lost there (the pass's
 * own loss weight); when he rides it, the kick still goes (practice.ts: a challenge he survives leaves his prepared
 * kick in place). So the kick is worth itself less caught x odds x (its worth + the loss).
 * Before, nothing priced it (decide notes: 42% of prepared kicks were dropped before he struck them, 58% of those
 * chosen with a man within 2 m; the re-check only revealed it). The launch read (launchRisk) prices a man getting a
 * foot into the kick's path, not a man arriving on him from the side or behind. A shot is not priced here: its
 * chance already reads the man arriving by the strike (practice-shot-contest, `lead`). Nothing is forbidden: a
 * quicker kick (a clearance, a ball already set, one needing no turn), a first-time ball off the reception, or
 * protecting the ball is what wins when the slow kick cannot get away.
 * The quicker kick: a pressed player can also play the same ball hurried, with half the preparation (HURRY_SHARE: a
 * short backswing, the ball poked or stabbed away), struck HURRY_POINTS passing points worse (as a plan made too
 * late to shape the body for it: practice-receive LATE_POINTS), costing the ball that share of its worth
 * (PASS_POINT a point). It is offered beside the ordinary kick whenever the ordinary one would be caught, and wins
 * only when getting it away sooner is worth more than placing it well. (A laptop check without it: pricing the
 * presser alone sent pressed men into carries and feints, and kept the ball 0.14 s longer.) */
export const CHALLENGE_LAND=.16,CAUGHT_SPAN=.3,HURRY_SHARE=.5,HURRY_POINTS=2;
/** (caught kick, 2026-10-19) "Can he get a foot to the ball before I strike it?" The read above timed the man
 * arriving on the carrier's BODY (arrivalTime: within 1 m of him) and added CHALLENGE_LAND; but a tackle is about the
 * ball. A defender may go in once he is within CHALLENGE_RANGE (2.2 m) of the ball, and his tackle lands
 * CHALLENGE_LAND s later at the soonest, his boot meeting it at most BOOT_REACH + BALL_CONTACT m from his body
 * (practice-challenge: the same constants the tackle uses). The ball is often a stride off the carrier's feet as he
 * shapes the kick. Measured on live dbdb6b81 (evidence 2026-10-19-caught-kick): at the set of a pass later lost
 * unstruck the nearest defender was a median 1.3 m from the BALL, 77% were already within tackle range of it and 65%
 * of these sets "looked safe" to the body read. So the time a man needs to get a foot to the ball is the later of
 * (in range + the tackle's landing) and (his boot within reach of it): footOnBall, by the same motion model as
 * arrivalTime (his momentum, acceleration and tired pace) to the ball where it is now. The carrier's read of it is
 * the same read as before (perceive 'arrival', LOOK_SPREAD: reading and passing set how well he judges it); nothing
 * else changes. The flag (on by default; an object so a measurement can switch it per match) off is the previous body
 * read, bit for bit. */
export const CAUGHT_KICK:{byBall:boolean;reachOnly:boolean}={byBall:true,reachOnly:false};
/** reachOnly (a lab probe, off by default): the tackle lands CHALLENGE_LAND s after his boot is within reach of the
 * ball, not as soon as he is in range of it (he is read as committing when he can reach it, not at the range's edge). */
export function footOnBall(q:PracticePlayer,ball:Vec):number{
 if(CAUGHT_KICK.reachOnly)return arrivalWithin(q,ball,BOOT_REACH+BALL_CONTACT)+CHALLENGE_LAND;
 return Math.max(arrivalWithin(q,ball,CHALLENGE_RANGE)+CHALLENGE_LAND,arrivalWithin(q,ball,BOOT_REACH+BALL_CONTACT));
}
/** The opponent who can get a foot to the ball first, and when (exact picture; the carrier's read is perceived). */
export function firstOnBall(p:PracticePlayer,players:PracticePlayer[],ball:Vec):{q:PracticePlayer|null;t:number}{
 let q:PracticePlayer|null=null,t=Infinity;
 for(const o of players){if(o.side===p.side||o.role==='GK')continue;const s=footOnBall(o,ball);if(s<t){t=s;q=o;}}
 return {q,t};
}
/** His read, made once for the picture: the time until a man is on it as he sees it, and the share of a kick with
 * a given read horizon that is caught (0 = it gets away). */
function caughtRead(p:PracticePlayer,players:PracticePlayer[],time?:number,ball?:Vec):(horizon:number)=>number{
 if(CAUGHT_KICK.byBall&&ball){
  const {t}=firstOnBall(p,players,ball);
  if(!Number.isFinite(t))return ()=>0;
  const seen=Math.max(0,perceive(p,'arrival',t,LOOK_SPREAD,p,{time,salt:'caught'}));
  return horizon=>clamp((horizon-seen)/CAUGHT_SPAN,0,1);
 }
 const {contactTime}=possessionSafety(p,players);
 if(!Number.isFinite(contactTime))return ()=>0;
 const seen=Math.max(0,perceive(p,'arrival',contactTime,LOOK_SPREAD,p,{time,salt:'caught'}));
 return horizon=>clamp((horizon-seen-CHALLENGE_LAND)/CAUGHT_SPAN,0,1);
}
export function caughtOnBall(p:PracticePlayer,players:PracticePlayer[],horizon:number,time?:number,ball?:Vec):number{
 return caughtRead(p,players,time,ball)(horizon);
}
const CAUGHT_KINDS:readonly Option['kind'][]=['pass','through','loft','clear'];
export function priceCaught(p:PracticePlayer,players:PracticePlayer[],options:Option[],time?:number,ball?:Vec):Option[]{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 if(!opponents.length)return options;
 // (caught kick) with the ball read, the man whose duel it would be is the one who gets a foot to the ball first
 const byBall=CAUGHT_KICK.byBall&&ball?firstOnBall(p,players,ball).q:null;
 const presser=byBall??opponents.reduce((a,b)=>arrivalTime(b,p)<arrivalTime(a,p)?b:a);
 const cover=opponents.filter(q=>q.id!==presser.id&&distance(q,p)<6).length,odds=duelChance(p,presser,cover);
 const loss=deliveryLossWeight(p,turnoverPrice(p,players)),read=caughtRead(p,players,time,ball);
 return options.map((o):Option[]=>{
  if(!CAUGHT_KINDS.includes(o.kind))return [o];
  const horizon=readKickHorizon(p,o.aim,o.kind),caught=read(horizon);
  if(caught<=0)return [o];
  const priced=(score:number,c:number)=>score-c*odds*(Math.max(0,score)+loss);
  const quick=read(horizon-(1-HURRY_SHARE)*preparationTime(p,o.kind)),worse=1-HURRY_POINTS*PASS_POINT;
  return [{...o,score:priced(o.score,caught)},{...o,hurried:true,score:priced(o.score*(o.score>0?worse:1/worse),quick),reason:o.kind==='clear'?o.reason:'Omul vine peste el: scapă repede de minge.'}];
 }).flat();
}

/** Step-across round (2026-10-04): the passer's OWN read of how far an
 * opponent can reach a ball he plays, in metres added to the reach the
 * physics gives (the lane read and the read of a kick being blocked). It was
 * the same exact geometry for every passer, so a poor reader read the presser
 * and the man behind him as well as the best one (the behaviour round's
 * flat AUC):
 *  - respect: near his own goal (the danger of a loss there) a player gives
 *    an opponent LANE_RESPECT m more than the physics, for the anticipation
 *    and the stretched leg he knows are coming; a daring player (risk,
 *    audacity) gives LANE_OPTIMISM m x daring less, anywhere;
 *  - error: he misjudges it by up to LANE_SPREAD m (a player who cannot read
 *    at all; a top reader is nearly exact), more under pressure unless he is
 *    composed (discipline and reading).
 * A read, never the kick: execution and its accuracy are unchanged. */
export const LANE_RESPECT=.45,LANE_OPTIMISM=.5,LANE_SPREAD=.9;
/** `lead` (honest-reads round): his read of how long until the ball is away
 * (readKickHorizon); a lane read with it forecasts everyone over that time by
 * visible momentum before the ball's flight begins. */
export interface PasserRead {p:PracticePlayer;pressure:number;danger:number;lead?:number}
export function readerMargin(r:PasserRead,opponent:{id:string},at:Vec,read:'lane'|'block'='lane'):number{
 const bias=LANE_RESPECT*r.danger-LANE_OPTIMISM*daring(r.p);
 return perceive(r.p,read,bias,LANE_SPREAD*(1+clamp(r.pressure,0,1)*(1-composure(r.p))),at,{salt:'reach'+opponent.id});
}
/** A kick must get past nearby feet before a distant receiver or a loft can help.
 * `read`: the passer's own read of those feet (readerMargin); without it, the exact picture.
 * `delay`: how long until the ball is away (the release horizon). Honest-reads
 * round (2026-10-10): the horizon is no longer cut to 0.3 s (the choice-to-kick
 * time is a median 0.47 s), and an opponent who has LAUNCH_REACT s of it
 * left after seeing the kick shaped also closes on the lane: from his
 * momentum, accelerating at his own rate to his own pace (body and foot as
 * far as his legs take them in that time). The read then ranks the kicks lost
 * at the kick better (AUC 0.61 -> 0.71 on 2bec595c) at the same scale (a read
 * of 1 still loses about 27% of kicks there). */
export const LAUNCH_REACT=.25;
/** Pre-push fixes (2026-10-12): he cannot run through a man. The lane and
 * launch reads forecast the carrier by his momentum until the kick (honest
 * reads), but a man standing in his path, or stepping into it, is met before
 * he gets there: by visible momentum (both of them), the first opponent in
 * front of him (ahead in the direction he is running) who comes within
 * MEET_GAP of him while they are closing. The carrier's forecast stops where
 * they meet; that man has engaged him and, for what is left of the horizon,
 * goes on closing on the ball at his feet (from his speed towards him,
 * accelerating at his own rate to his own pace), so he contests any kick
 * played from there, whatever its direction: he blocks the pass or he is on
 * the ball before it is away. Everyone else moves on over the whole horizon.
 * MEET_GAP: a stride, where a standing man's foot reaches a ball at the
 * carrier's feet. A man moving with him, beside his path or chasing him from
 * behind is never met, and the open-field forecast is unchanged (a pursuer
 * closing from behind is read by his own momentum as before: stopping the
 * carrier for him would invent a block ahead of him).
 * Returns the time the carrier's forecast runs (`lead` when he meets nobody),
 * the id of the opponent met and where that opponent is at `lead`. */
export const MEET_GAP=1;
type Mover={x:number;y:number;vx:number;vy:number;side:0|1};
export function carrierMeets(p:Mover,players:(Mover&{id:string;pace:number;acceleration:number})[],lead:number):{t:number;met:string|null;at:Vec|null}{
 let t=lead,met:(typeof players)[number]|null=null;
 for(const q of players){
  if(q.side===p.side)continue;
  const rx=q.x-p.x,ry=q.y-p.y,wx=q.vx-p.vx,wy=q.vy-p.vy,b=rx*wx+ry*wy;
  if(b>=0||rx*p.vx+ry*p.vy<=0)continue;// not closing on each other, or not in front of him
  const c=rx*rx+ry*ry-MEET_GAP*MEET_GAP,a=wx*wx+wy*wy;
  let at:number;
  if(c<=0)at=0;
  else{const disc=b*b-a*c;if(disc<0)continue;at=(-b-Math.sqrt(disc))/a;}
  if(at<t){t=at;met=q;}
 }
 if(!met)return {t,met:null,at:null};
 const cx=p.x+p.vx*t,cy=p.y+p.vy*t,qx=met.x+met.vx*t,qy=met.y+met.vy*t,gap=Math.max(.01,Math.hypot(qx-cx,qy-cy)),ux=(qx-cx)/gap,uy=(qy-cy)/gap;
 const rest=lead-t,towards=clamp(-(met.vx*ux+met.vy*uy),0,met.pace),accelerating=Math.min(rest,(met.pace-towards)/met.acceleration);
 const left=Math.max(0,gap-(towards*accelerating+.5*met.acceleration*accelerating*accelerating+met.pace*(rest-accelerating)));
 return {t,met:met.id,at:{x:cx+ux*left,y:cy+uy*left}};
}
export function launchRisk(p:PracticePlayer,aim:Vec,players:PracticePlayer[],delay=0,reach=4,read?:PasserRead):number{
 // Forecast both sides over the same horizon. Moving only opponents
 // invents blocks at the passer's old position when both are advancing.
 // Visible momentum is an estimate, not knowledge of future decisions.
 // (pre-push fixes) ...but he stops where he meets a man in his path (carrierMeets).
 const look=Math.min(1,delay),meet=carrierMeets(p,players,look),from={x:p.x+p.vx*meet.t,y:p.y+p.vy*meet.t},closing=look-LAUNCH_REACT;
 const length=distance(from,aim),ux=(aim.x-from.x)/Math.max(.01,length),uy=(aim.y-from.y)/Math.max(.01,length);
 const start={x:from.x+ux*.65,y:from.y+uy*.65},segment=Math.min(reach,Math.max(.1,length-.65));
 let risk=0;
 for(const q of players){
  if(q.side===p.side)continue;
  // Short visible-momentum forecast, not knowledge of the opponent's next decision.
  const engaged=q.id===meet.met,x=engaged?meet.at!.x:q.x+q.vx*look,y=engaged?meet.at!.y:q.y+q.vy*look;
  const raw=(x-start.x)*ux+(y-start.y)*uy,along=clamp(raw,0,segment);
  let gap=Math.hypot(x-start.x-ux*along,y-start.y-uy*along);
  // (the man he meets is already going for the ball: carrierMeets has closed him on it)
  if(closing>0&&gap>0&&!engaged){
   // what he adds to his momentum by going for the lane once he has seen it
   const towards=clamp(((start.x+ux*along-x)*q.vx+(start.y+uy*along-y)*q.vy)/gap,0,q.pace);
   const accelerating=Math.min(closing,(q.pace-towards)/q.acceleration);
   gap=Math.max(0,gap-(.5*q.acceleration*accelerating*accelerating+(q.pace-towards)*(closing-accelerating)));
  }
  // (his read of a foot in the way is of one in front of the kick: a man behind him cannot block a ball played away from him)
  const m=read&&(raw>0||engaged)?Math.max(-1,readerMargin(read,q,aim,'block')):0;
  risk=Math.max(risk,clamp((1.25+m-gap)/.8,0,1));
  // (pre-push fixes) the man he meets contests the ball at his feet, whichever way it is played: on the same scale,
  // by how close he has got to it (from) by the kick
  if(engaged)risk=Math.max(risk,clamp((1.25+m-Math.hypot(x-from.x,y-from.y))/.8,0,1));
 }
 return risk;
}

/** A short first touch away from pressure, still executed with ordinary movement limits. */
export function recoveryTouch(p:PracticePlayer,players:PracticePlayer[]):Vec{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 const candidates=Array.from({length:12},(_,i)=>{
  const angle=i*Math.PI/6,aim={x:clamp(p.x+Math.cos(angle)*2,.9,(L-.9)),y:clamp(p.y+Math.sin(angle)*2,-(W/2-1.1),(W/2-1.1))};
  const space=Math.min(...opponents.map(q=>distance(aim,{x:q.x+q.vx*.2,y:q.y+q.vy*.2})));
  const turn=Math.abs(difference(angle,p.angle));
  // Avoid turning across our own goal, while allowing a touch toward a safer flank.
  const ownGoal=depth(p,aim.x)<6&&Math.abs(aim.y)<6?2:0;
  return {aim,score:space-turn*.35-ownGoal};
 });
 return candidates.sort((a,b)=>b.score-a.score)[0].aim;
}

/** Shared situational assessment: traits change risk tolerance, not knowledge of future outcomes. */
/** The pressure a carrier feels is his own read (R2): what he sees, scaled by
 * his nerve (a daring or composed player feels it less, a nervous one more)
 * and misjudged by his reading (a relative error up to PRESSURE_SPREAD for
 * one who cannot read it at all). No pressure is never felt as pressure. */
export const PRESSURE_SPREAD=.5;
/** R3 P1: a shot of his own reading SHOT_ON_FROM + SHOT_ON_SPAN (0.35) or
 * better is "a real shot on" and cuts a pass's pressure credits by
 * RELIEF_CUT; a goal-side carry past the presser earns CARRY_RELIEF of a
 * pass's relief. */
export const SHOT_ON_FROM=.25,SHOT_ON_SPAN=.2,RELIEF_CUT=.75,CARRY_RELIEF=.5;
export function feltPressure(p:PracticePlayer,pressure:number,time?:number):number{
 return clamp(pressure*Math.max(0,perceive(p,'pressure',nerve(p),PRESSURE_SPREAD,p,{time,salt:'felt'})),0,1);
}
/** Regain fixes (2026-10-11): how far a pass takes the ball out of a duel
 * near our own goal, from the receiver's time on the ball (the first opponent's
 * arrival at it, after the flight and the release): none with less than
 * ESCAPE_FROM s, all of it with ESCAPE_FROM + ESCAPE_SPAN s or more. Before,
 * the urgency credit paid every safe-laned pass the same, so centre-backs
 * pressed in their own six-yard area played two-metre passes to each other
 * instead of clearing, carrying out, or finding a pass that escapes. */
export const ESCAPE_FROM=.3,ESCAPE_SPAN=1.1;
export const escapeFrom=(receiverTime:number)=>clamp((receiverTime-ESCAPE_FROM)/ESCAPE_SPAN,0,1);
export function securePossessionOptions(p:PracticePlayer,players:PracticePlayer[],options:Option[],laneRisk:LaneRisk):Option[]{
 const exact=possessionSafety(p,players),felt=feltPressure(p,exact.pressure);
 const safety={...exact,pressure:felt,urgency:exact.danger*felt},{urgency,adventure}=safety;
 const opponents=players.filter(q=>q.side!==p.side),s=p.side===0?1:-1;
 const read:PasserRead={p,pressure:felt,danger:exact.danger},lossHere=turnoverPrice(p,players);
 // Pressure relief belongs to escaping the presser, not to passing (R3 P1).
 // A real shot of his own (as he reads it) escapes it too, so a pass is
 // paid less for relieving pressure the better that shot is; the retreat
 // credit, written for danger near our own goal, fades out by halfway; and a
 // carry that takes him goal-side past the presser earns relief as a pass does.
 const shot=options.find(o=>o.kind==='shoot'),shotOn=clamp(((shot?.quality??0)-SHOT_ON_FROM)/SHOT_ON_SPAN,0,1);
 const ownHalf=clamp((L/2-depth(p))/X(10),0,1),reliefKept=1-RELIEF_CUT*shotOn;
 const adjusted=options.map(o=>{
  let score=o.score,reason=o.reason,relief0=o.relief??0,credits=0;
  // Getting a kick past the nearest opponent matters anywhere on the pitch.
  // Own-goal danger separately prices the consequence of losing it here.
  if(o.kind==='pass'||o.kind==='through'||o.kind==='loft'){
   // (honest-reads round) the launch is read over his own estimate of when the ball is away, not his set time
   const delay=releaseTime(p,o.aim,o.kind),blocked=launchRisk(p,o.aim,players,readKickHorizon(p,o.aim,o.kind),4,read);
   // (step-across round) a blocked kick is lost where he stands: priced as a loss there, as the pass's own risk is
   score-=blocked*(.8+safety.danger*.15+lossHere);
   const delivery=o.pass??o.loft;
   // Do not merely transfer the same problem to a marked teammate: account
   // for the time the ball spends travelling before the receiver can act.
   const receiverTime=delivery?Math.min(...opponents.map(q=>arrivalTime(q,o.aim)))-delivery.flight-delay:Infinity;
   if(delivery&&safety.pressure>.15){
    // Relieving pressure has value everywhere, not only near our own goal.
    const relief=escapeFrom(receiverTime)*(1-delivery.risk)*(1-delivery.controlRisk)*clamp(1+delivery.reachMargin,0,1)*(1-blocked);
    credits+=safety.pressure*relief*(.22+(1-adventure)*.12);
    // Ground-pass valuation charges for metres conceded. Under pressure, a
    // retreat that buys actual time need not pay that entire territorial cost:
    // it can reset the attack. A marked receiver or blocked lane earns no
    // exemption; neither an ordinary nor a coached pass becomes more accurate.
    if(o.pass){
     const retreat=clamp((depth(p)-depth(p,o.aim.x))/X(25),0,1);
     credits+=retreat*(.24+p.traits.risk*.15)*(1-delivery.risk)*safety.pressure*relief*ownHalf;
    }
    if(relief>.6&&safety.pressure>.45)reason='Scoate mingea din presiune către un coleg cu timp pentru continuare.';
   }
   if(urgency>=.06){
    const risk=o.loft?.risk??o.pass?.risk??laneRisk(p,o.aim,opponents);
    // (regain fixes) "out of the duel" only for a pass that escapes it: the
    // receiver has time on the ball before anyone, the presser included,
    // reaches him (escapeFrom). A two-metre pass to a team-mate the same man
    // presses next moves the duel two metres; it no longer earns the credit.
    const escape=Number.isFinite(receiverTime)?escapeFrom(receiverTime):1;
    score+=urgency*(.27*(1-risk)*escape-risk*.55-delay*.18);
    if(risk<.25&&blocked<.25&&urgency>.25&&escape>.5)reason='E presat lângă poartă; găsește o pasă care scoate mingea din duel.';
   }
  }else if(o.kind==='carry'&&o.carry&&o.carry.goalGain>1&&o.carry.escapeGain>0&&safety.pressure>.15){
   credits+=safety.pressure*clamp(o.carry.escapeGain/.3,0,1)*(.22+(1-adventure)*.12)*CARRY_RELIEF*(1-o.carry.obstruction)*(1-(o.carry.beaten??0));
  }
  if(o.kind==='carry'&&urgency>=.06){
   const obstruction=o.carry?.obstruction??0;
   score-=urgency*(.3+obstruction*.5+(o.carry?.turnCost??0)*.18)*(1-adventure*.55);
   if(adventure>.65&&urgency>.35)reason='E presat lângă propria poartă, dar se încrede în control și încearcă să iasă cu mingea.';
  }else if(o.kind==='feint'&&urgency>=.06){
   score-=urgency*(.55-adventure*.25);
   if(urgency>.35)reason='Știe că pierde mult dacă greșește aici, dar încearcă să scape prin fentă.';
  }
  // Pass-only credits (the delivery's own pressure x space, relief,
  // retreat) are kept as far as a real shot of his own does not offer the
  // same escape; the kept total is recorded for the purpose clock.
  const pass=o.kind==='pass'||o.kind==='through'||o.kind==='loft';
  const kept=pass?(relief0+credits)*reliefKept:credits;
  score+=kept-relief0;
  return {...o,score,reason,...(pass||credits?{relief:kept}:{})};
 });
 // (step-across round) a keeper pressed at his feet may clear too (never for a corner): he had only passes, and played them into the press
 if(urgency<.16)return adjusted;
 const mates=players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK'),foes=players.filter(q=>q.side!==p.side);
 // An in-play clearance is worth what it keeps: who reaches its landing first (s of margin, ours positive).
 const margin=(aim:Vec)=>Math.min(...foes.map(q=>arrivalTime(q,aim)))-Math.min(...mates.map(q=>arrivalTime(q,aim)));
 // (r1 mechanics) Up a channel he lands it where a team-mate gets there first,
 // not on one fixed spot up the touchline whoever is near: of the landings up
 // that flank he reads the one his side wins by the most (the touchline spot
 // 20 m up stays the read when no landing is better).
 const channel=(y:number)=>{
  const spots=[20,12,16,24,28].flatMap(x=>[W/2-2.5,W/2-7].map(w=>({x:clamp(p.x+s*x,1,(L-1)),y:y*w})));
  let best=spots[0],edge=margin(best);
  for(const spot of spots.slice(1)){const m=margin(spot);if(m>edge+1e-9){best=spot;edge=m;}}
  return best;
 };
 const candidates:{aim:Vec;exit:ClearanceIntent}[]=[
  ...[-1,1].map(y=>({aim:{x:p.x+s*35,y:clamp(p.y+y*Y(15),-Y(30),Y(30))},exit:'long' as const})),
  ...[-1,1].flatMap(y=>[0,8].map(x=>({aim:{x:clamp(p.x+s*x,1,(L-1)),y:y*(W/2+4)},exit:'touchline' as const}))),
  ...(depth(p)<12&&p.role!=='GK'?[-1,1].map(y=>({aim:{x:p.side===0?-3:L+3,y:y*Math.max(Y(18),Math.abs(p.y))},exit:'corner' as const})):[]),
  // In play: up either touchline, or into the path of a team-mate further up.
  ...[-1,1].map(y=>({aim:channel(y),exit:'channel' as const})),
  ...mates.filter(q=>depth(q)>depth(p)+6).map(q=>({aim:{x:clamp(q.x+q.vx*.8,1,(L-1)),y:clamp(q.y+q.vy*.8,-(W/2-1),(W/2-1))},exit:'mate' as const})),
 ];
 // Never clear across the face of his own goal: the ball may not pass nearer
 // the goal's centre than it already is (within 4.5 m of it).
 const goal={x:p.side===0?0:L,y:0},near=Math.min(4.5,distance(p,goal));
 const across=(aim:Vec)=>{const dx=aim.x-p.x,dy=aim.y-p.y,t=clamp(((goal.x-p.x)*dx+(goal.y-p.y)*dy)/Math.max(1e-6,dx*dx+dy*dy),0,1);return distance({x:p.x+dx*t,y:p.y+dy*t},goal)<near-.25;};
 for(const {aim,exit} of candidates){
  if(across(aim))continue;
  // A lofted clearance is over a foot within a stride or so; a driven one is not.
  const lofted=exit==='long'||exit==='channel'||exit==='mate';
  const delay=releaseTime(p,aim,'clear'),blocked=launchRisk(p,aim,players,delay,lofted?1.6:4);
  const cost=exit==='corner'?.22:exit==='touchline'?.1:0;
  // An in-play clearance is worth what it keeps: who reaches its landing first.
  const inPlay=exit==='channel'||exit==='mate';
  const retention=inPlay?clamp(margin(aim)/1.2,-1,1):0;
  const score=-.12+urgency*(1.15-adventure*.3)-blocked*.95-delay*.22-cost+retention*.14;
  adjusted.push({kind:'clear',aim,clearance:exit,score,reason:exit==='corner'?'Nu poate întoarce în siguranță; acceptă cornerul ca să îndepărteze pericolul.':exit==='touchline'?'Presiunea e prea aproape de poartă; caută tușa ca să oprească pericolul.':exit==='mate'?'Degajează din prima zonă, spre un coleg liber mai sus.':exit==='channel'?'Degajează pe lângă tușă, în teren, unde pot ajunge colegii.':'Nu riscă încă un duel lângă poartă; degajează departe de presiune.'});
 }
 return adjusted;
}

export type ClearanceIntent='long'|'touchline'|'corner'|'channel'|'mate';

export function strikeClearance(p:PracticePlayer,ball:Vec,aim:Vec,pressure:number,random:()=>number,intent:ClearanceIntent):{vx:number;vy:number;vz:number}{
 const error=(.025+(1-clamp(p.skills.passing/10,0,1))*.06+pressure*.035)*(random()*2-1);
 const angle=Math.atan2(aim.y-ball.y,aim.x-ball.x)+error;
 if(intent==='channel'||intent==='mate'){
  // Paced for its landing: lifted over the nearest foot, arriving at a pace a
  // team-mate can take (about 9 m/s) instead of running on out of play.
  const speed=clamp(Math.sqrt(81+2*PASS_DRAG*distance(ball,aim)),9,14.5);
  return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:5.5+p.skills.strength*.08};
 }
 const speed=22+p.skills.strength*.25,out=intent!=='long';
 return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:out?1.2:6.5+p.skills.strength*.15};
}
