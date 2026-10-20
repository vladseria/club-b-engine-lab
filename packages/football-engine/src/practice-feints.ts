import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer,Option} from './practice.js';
import type {Vec} from './movement.js';
import {dribbleConfidence,readDribbleRoute,carryLossRead,routeCredits,BEAT_SPREAD,CARRY_BASE,CARRY_SHOT,DRIBBLE_TYPICAL} from './practice-carry.js';
import {perceive} from './practice-perception.js';
import {turnoverPrice,deliveryLossWeight} from './practice-rest-defence.js';
import {assessShot,shotZone,keeperClaimChance} from './practice-football.js';
import {shotContest,shotRead,SHOT_WORTH} from './practice-shot-contest.js';
import {preparationTime} from './practice-possession.js';
import {keeperReadyPosition} from './practice-keeper.js';
import {steerMotion} from './movement.js';
import {projectOpponents,ON_HIM,READ_AHEAD} from './practice-receive.js';
import {arrivalTime} from './practice-arrival.js';
import {WORLD} from './world.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
export interface FeintMemory {opponent:string;at:number;attacker:Vec;defender:Vec}

/** The exit is past this opponent, rather than an unrelated fixed six-metre point. */
export function feintExit(p:PracticePlayer,d:PracticePlayer):Vec {
 const direction=p.y<=d.y?-1:1;
 return {x:clamp(d.x+(p.side===0?1:-1)*2.2,.8,(L-.8)),y:clamp(d.y+direction*2.6,-(W/2-1),(W/2-1))};
}

/** Repeating the same move in the same encounter becomes easier to read.
 * A new defender, a changed route or a later possession restores its value. */
export function repeatFeintCost(p:PracticePlayer,d:PracticePlayer,memory:FeintMemory|undefined,time:number):number {
 if(!memory||memory.opponent!==d.id||time<memory.at)return 0;
 const unchanged=clamp(1-Math.max(distance(p,memory.attacker),distance(d,memory.defender))/5,0,1);
 const recent=clamp(1-(time-memory.at)/8,0,1);
 return unchanged*recent*(.15+clamp(d.skills.reading/10,0,1)*.16);
}

/** The fake itself takes FAKE_TIME s (practice.ts: the man is fooled or not at its end). */
export const FAKE_TIME=WORLD.contact.feints.FAKE_TIME.v;
export function feintDuration(p:PracticePlayer,aim:Vec):number {
 // The fake precedes the burst. Acceleration still governs every real movement tick.
 return FAKE_TIME+clamp(distance(p,aim)/Math.max(1,p.pace*.75)+.4,.85,1.8);
}

/** Finish when the real encounter changes, allowing a pass/shot or a new decision. */
export function finishFeint(p:PracticePlayer,d:PracticePlayer,players:readonly PracticePlayer[],time:number,checkedAt:number,deadline:number):boolean {
 if(time>=deadline)return true;
 if(time<checkedAt+.15)return false;
 if((p.side===0?1:-1)*(p.x-d.x)>.65&&distance(p,d)>1.5)return true;
 return players.some(q=>q.side!==p.side&&q.id!==d.id&&q.role!=='GK'&&distance(q,p)<1.8);
}

/** Releasing can become worthwhile during the burst. Keep the original reason
 * for committing, and any stronger current duel, as the comparison: the repeat
 * penalty for starting another feint must not prematurely end this same attempt.
 * This only permits reconsideration; kick preparation/contact still happen later. */
export function feintReleaseOpening(originalScore:number,defender:string,available:readonly Option[]):boolean {
 // (take-on price, round 4) priced, the release is weighed against what carrying on is worth now, on the same scale as
 // the release: the take-on on the same man as it reads now (the review reads it without the repeat memory), or once
 // he is past the man, the best carry. The score he committed with was read before the fake played out.
 const current=available.filter(o=>o.kind==='feint'&&o.target===defender).map(o=>o.score),carries=available.filter(o=>o.kind==='carry').map(o=>o.score);
 const commitment=TAKEON_PRICE.on?(current.length?Math.max(...current):carries.length?Math.max(...carries):originalScore)
  :Math.max(originalScore,...available.filter(o=>o.kind==='feint'&&o.target===defender).map(o=>o.score));
 return available.some(o=>['pass','through','loft','shoot','clear'].includes(o.kind)&&o.score>commitment+WORLD.selection.choice.reconsider.v);
}

/** The fake's odds: the chance the man in front of him buys it (the carrier's control against his reading and
 * discipline). Moved here from practice.ts unchanged (take-on price, 2026-10-19) so the carrier's read of a take-on
 * can use the same odds, as duelChance is shared with the carry's read. */
export function feintFoolChance(p:PracticePlayer,d:PracticePlayer):number{
 return clamp(.42+(p.skills.control-d.skills.reading)*.055+(1-d.traits.discipline)*.1,.12,.8);
}

/** Take-on price (2026-10-19, owner-approved): "a take-on weighs what beating the man gains here against what losing
 * the ball here costs, seen through the player's personality, counted once". One switch (on in this branch; off plays
 * the live take-on score exactly). */
export const TAKEON_PRICE={on:true};
/** How long a man who buys the fake is wrong-footed (practice.ts: his wrongfoot and his next duel wait this long),
 * jogging (WRONG_PACE of his pace) to the wrong side: WRONG_BACK m back and as far across as the take-on goes. */
export const FOOLED_FOR=WORLD.contact.feints.FOOLED_FOR.v,WRONG_PACE=WORLD.contact.feints.WRONG_PACE.v,WRONG_BACK=WORLD.contact.feints.WRONG_BACK.v;
/** A flashy player's liking for taking a man on, beyond what it gets him (his appetite, as shotTemper is the
 * shooter's): TAKEON_FLAIR per unit of dribble tendency away from the squad's typical DRIBBLE_TYPICAL (owner's decision,
 * round 3, option B): a typical dribbler is neutral, a flashy one has a clear push (0.9: +0.21), a poor one leans
 * against it (0.1: -0.08). The live score's uncentred dribble x 0.36 gave every player a take-on bonus over the same
 * carry, a typical one +0.12. */
export const TAKEON_FLAIR=WORLD.selection.feints.TAKEON_FLAIR.v;
type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;

/** His read of a take-on on `marker` toward `aim`, from what he can see (where the men are, who they are). In the
 * engine the fake either fools the man (wrong-footed, practice.ts) or not; when not, he still bursts to the aim and the
 * man has to get to him and win the ball. So:
 *  - the fake fails (`fail`): the fake's odds (feintFoolChance), misjudged by his read of a carry (an error up to
 *    BEAT_SPREAD of the chance it fails for one who cannot read it);
 *  - the man is on him when it fails (`contact`): whether, not fooled, he can get to him as he goes past (manContact:
 *    his arrival, arrivalTime, at where the take-on has the carrier by then); their keeper is not chasing a man but
 *    sets himself for the ball (as the gain's picture previews him, keeperSet), so for him, inside his area, how near
 *    that leaves him to the ball at the aim, as the engine's keeper claims a ball near him there; both on the carry's
 *    contact scale (readDribbleRoute: full contact within 0.45 m, none beyond 1.8 m);
 *  - he then loses it to him as often as he reads that duel (carryLossRead: duelChance with the man's cover; for their
 *    keeper, who never challenges but claims the ball near him, the claim odds, keeperClaimChance);
 *  - and to another man on the route as often as he reads that (carryLossRead on the route's next man; round 3: this
 *    was a flat term in the hazards).
 * His nature (daring, a natural dribbler) enters once per man, in the read of losing the ball to him (carryLossRead,
 * shared with the carry: a temperament misjudges "will he take it off me" alike whether he carries at a man or fakes
 * him). `through`: he gets past the man and keeps it (fooled, or not fooled but not caught: the gain reads those two
 * apart, feintOptions); `other`: his read of losing it to the route's next man. */
export function takeOnRead(p:PracticePlayer,marker:PracticePlayer,players:PracticePlayer[],aim:Vec,path:readonly Step[]=takeOnPath(p,aim)):{through:number;stopped:number;fail:number;contact:number;other:number}{
 const fails=1-feintFoolChance(p,marker);
 const fail=clamp(perceive(p,'carry',fails,BEAT_SPREAD*fails,p,{salt:'fool'+marker.id}),.03,.97);
 const inArea=(p.side===0?L-aim.x:aim.x)<BOX_DEPTH&&Math.abs(aim.y)<BOX_HALF;
 const contact=marker.role==='GK'&&inArea?clamp((1.8-distance(keeperSet(marker,aim,feintDuration(p,aim)),aim))/1.35,0,1):manContact(p,marker,aim,path);
 const man=carryLossRead(p,players,fail*contact,marker.id,marker.role==='GK'?keeperClaimChance(marker,p):undefined);
 const route=readDribbleRoute(p,aim,players,marker.id),other=carryLossRead(p,players,route.contactRisk,route.opponent);
 return {through:(1-fail*contact)*(1-other),stopped:1-(1-man)*(1-other),fail,contact,other};
}

export interface Step {t:number;x:number;y:number;vx:number;vy:number}
/** The take-on as the engine plays it (practice.ts, the carrier's feint movement), tenth by tenth, with the engine's
 * own movement (steerMotion: his acceleration from the momentum he has): through the fake (FAKE_TIME) a step forward and
 * to the other side (a quarter of his pace asked, the owner's movement floor of 0.4 of it given, practice.ts), then the
 * burst through the aim, at most 0.88 of his pace, running on as the owner follows his ball rather than braking onto
 * the point; until he is within 0.5 m of the aim or the feint's deadline (feintDuration). (Round 4: the read had him at
 * full burst speed from the fake's end.) */
export function takeOnPath(p:PracticePlayer,aim:Vec):Step[]{
 const sign=p.side===0?1:-1,body={...p},end=feintDuration(p,aim),path:Step[]=[];
 const len=Math.max(.01,distance(p,aim)),beyond={x:aim.x+(aim.x-p.x)/len*3,y:aim.y+(aim.y-p.y)/len*3};
 for(let t=.1;t<=end+1e-9;t+=.1){
  if(t<=FAKE_TIME+1e-9)steerMotion(body,{x:body.x+sign,y:body.y-(aim.y-body.y)*.3},.1,p.pace*Math.max(.25,.4));
  else steerMotion(body,beyond,.1,p.pace*.88);
  path.push({t,x:body.x,y:body.y,vx:body.vx,vy:body.vy});
  if(t>FAKE_TIME&&distance(body,aim)<.5)break;
 }
 return path;
}
/** Whether the man he takes on, not fooled, gets to him as he goes past, on the carry's contact scale (readDribbleRoute:
 * full within 0.45 m, none beyond 1.8 m). Along the take-on as the engine plays it (takeOnPath), at each tenth of a
 * second the man's arrival where the carrier is (arrivalTime: his momentum, acceleration and tired pace; it counts him
 * there within 1 m) against the time. His best margin, in metres at his pace, is how near he gets. (Round 3: the route
 * read the carry uses looks 0.6 s ahead with the man where his momentum takes him; a take-on runs 1-2 s past a man
 * trying to get to him. Round 4: the carrier along the engine's path, not at full burst speed from the fake's end.) */
export function manContact(p:PracticePlayer,marker:PracticePlayer,aim:Vec,path:readonly Step[]=takeOnPath(p,aim)):number{
 let slack=Infinity;
 for(const s of path)slack=Math.min(slack,arrivalTime(marker,s)-s.t);
 const gap=Math.max(0,1+slack*marker.pace*.94);
 return clamp((1.8-gap)/1.35,0,1);
}
/** Their keeper `t` s on, setting himself for the ball at `at` at his pace (keeperReadyPosition), as the pass's
 * receiver-shot read previews him (practice-passing). */
export function keeperSet(keeper:PracticePlayer,at:Vec,t:number):PracticePlayer{
 const preview={...keeper},ready=keeperReadyPosition(keeper,at,true);
 for(let s=0;s<t;s+=.1)steerMotion(preview,ready,Math.min(.1,t-s),keeper.pace);
 return preview;
}
/** The picture he reads the moment he arrives at the aim past the man, getThere (feintDuration) after he starts:
 *  - the other men where their visible momentum takes them by then (projectOpponents, the reception read's own
 *    projection, carried on past its READ_AHEAD horizon in steps, since a take-on lasts 1-2 s);
 *  - the man he takes on, as the fake leaves him: fooled (`fooled`), at FAKE_TIME, jogging to the wrong side for
 *    FOOLED_FOR s, then chasing toward the aim from there with the momentum he has; not fooled, following from
 *    FAKE_TIME with the momentum he has (arrivalTime both ways: his acceleration and tired pace), as far as he gets by
 *    then, at the speed he has;
 *  - their keeper set for the ball there (keeperReadyPosition at his pace, as the pass's receiver-shot read previews
 *    him, practice-passing).
 * Team-mates as they are. One picture for every part of the gain (round 3: the shot read and the carry credits read
 * two different ones). */
export function afterTakeOn(p:PracticePlayer,aim:Vec,players:PracticePlayer[],marker:PracticePlayer,fooled=true,getThere=feintDuration(p,aim)):PracticePlayer[]{
 const sign=p.side===0?1:-1;
 const others=players.filter(q=>q.id!==marker.id),keeper=others.find(q=>q.side!==p.side&&q.role==='GK');
 let ahead=others.filter(q=>q!==keeper);for(let t=getThere;t>1e-9;t-=READ_AHEAD)ahead=projectOpponents(ahead,p.side,aim,Math.min(READ_AHEAD,t));
 // the beaten man: to the wrong side, then after the aim
 const wrong={x:clamp(marker.x-sign*WRONG_BACK,.5,L-.5),y:clamp(marker.y-(aim.y-p.y),-(W/2-.5),W/2-.5)},jog=marker.pace*WRONG_PACE;
 const toWrong=distance(marker,wrong),wx=(wrong.x-marker.x)/Math.max(.01,toWrong),wy=(wrong.y-marker.y)/Math.max(.01,toWrong);
 const fooledFor=fooled?clamp(getThere-FAKE_TIME,0,FOOLED_FOR):0,went=Math.min(toWrong,jog*fooledFor);
 const at={...marker,x:marker.x+wx*went,y:marker.y+wy*went,vx:fooledFor>0?wx*jog:fooled?0:marker.vx,vy:fooledFor>0?wy*jog:fooled?0:marker.vy};
 const chase=Math.max(0,getThere-FAKE_TIME-(fooled?FOOLED_FOR:0));let beaten=at;
 if(chase>0){
  const back=distance(at,aim),arrive=arrivalTime(at,aim),made=arrive>0?clamp(chase/arrive,0,1)*Math.max(0,back-ON_HIM):0;
  const ux=(aim.x-at.x)/Math.max(.01,back),uy=(aim.y-at.y)/Math.max(.01,back),speed=Math.min(marker.pace*.94,marker.acceleration*chase);
  beaten={...marker,x:at.x+ux*made,y:at.y+uy*made,vx:ux*speed,vy:uy*speed};
 }
 const picture=[...ahead,beaten];
 if(keeper)picture.push(keeperSet(keeper,aim,getThere));
 return picture;
}
/** The shot he has when he gets there (round 5: B's valuation, at the arrival the engine's path gives): inside the zone
 * a shot is on offer from (shotZone), the shoot option's own read of the chance from `body` (where and how fast the
 * engine's path, takeOnPath, has him arrive) in `after` (assessShot's free chance, less what the contest at the strike
 * costs it as he reads it, shotContest with his wind-up, shotRead), at the shot's own worth (SHOT_WORTH a unit). The
 * whole shot, not its gain over the shot he has now: that one is the shoot option's, and the choice compares the two
 * (round 3: subtracting it here counted it against the take-on twice). (Round 4 netted it of what a shot gives away and
 * the lane shut, as a carry credit against the shot he has now; that took the box take-ons out, and round 5 restores
 * B's.) `risk` is kept for the evidence harnesses' calls and not read. */
export function shotOpening(p:PracticePlayer,body:PracticePlayer,after:PracticePlayer[],_risk:Risk,time:number):number{
 if(!shotZone(p,body))return 0;
 const there=assessShot(body,after),contest=shotContest(body,after,there.aim,{lead:preparationTime(p,'shoot')});
 return shotRead(p,there.open,contest.hurry,body,time)*SHOT_WORTH;
}

/** What getting past the man gets him at `aim`, read in the picture he arrives in (afterTakeOn, at the moment the
 * engine's path, takeOnPath, has him there): the carry's credits for being there against being here (routeCredits:
 * progress, a better pass, room from the man closing him), with the shooting-angle credit raised to the shot he has
 * there (shotOpening, from where and how fast the path has him arrive) when that is worth more. The carry's confidence
 * credit is left out: liking to go forward with the ball is his flair (TAKEON_FLAIR), counted once. (Round 5: B's shot
 * term on round 4's path; `here` is kept for the evidence harnesses' calls and not read.) */
export function takeOnGain(p:PracticePlayer,aim:Vec,players:PracticePlayer[],marker:PracticePlayer,risk:Risk,near:number,time:number,fooled=true,_here=0,path:readonly Step[]=takeOnPath(p,aim)):number{
 const last=path[path.length-1],after=afterTakeOn(p,aim,players,marker,fooled,last.t),r=routeCredits(p,aim,after,risk,near,players);
 const body={...p,x:last.x,y:last.y,vx:last.vx,vy:last.vy},angle=Math.max(0,r.shotGain)*CARRY_SHOT;
 return r.credits-r.confident-angle+Math.max(angle,shotOpening(p,body,after,risk,time));
}

/** The priced take-on's read and expected gain (feintOptions): the gain with the man fooled as often as he reads the
 * fake works, with the man following as often as he reads it fails but the man cannot get to him, both as often as he
 * keeps it from the route's next man. `here` is not read (round 5; kept for the evidence harnesses' calls). */
export function takeOnParts(p:PracticePlayer,marker:PracticePlayer,players:PracticePlayer[],aim:Vec,risk:Risk,near:number,time:number,here:number){
 const path=takeOnPath(p,aim),read=takeOnRead(p,marker,players,aim,path),free=read.fail*(1-read.contact);
 const gain=(1-read.other)*((1-read.fail)*takeOnGain(p,aim,players,marker,risk,near,time,true,here,path)+(free>0?free*takeOnGain(p,aim,players,marker,risk,near,time,false,here,path):0));
 return {read,gain,through:read.through,path};
}

/** The coach and ordinary play share the same plausible one-on-one attempts.
 * With TAKEON_PRICE on (and the lane read `risk` given), the take-on is valued as the carry is: CARRY_BASE for keeping
 * the ball on the move, plus his flair (TAKEON_FLAIR), plus what getting past him gets him there (takeOnGain): with
 * the man fooled as often as he reads the fake works, with the man following as often as he reads it fails but the
 * man cannot get to him, both as often as he keeps it from the route's next man; less what losing it here costs (deliveryLossWeight of turnoverPrice: the ball
 * lost, priced where he is, as the pass, the carry and the shot price it) as often as he reads he is stopped
 * (takeOnRead). Control acts through the fake's and the duel's odds, his risk appetite through the loss weight, his
 * nature through the loss read. The remaining route hazards (fake from too close, too far, others closing the route,
 * no room beyond, alignment, repeating the move) are unchanged. A priced take-on is marked `lossPriced`: its loss is
 * priced where he is, so the possession urgency charge (practice-possession) is not laid on it again.
 * Off: the live score, unchanged. */
export function feintOptions(p:PracticePlayer,players:PracticePlayer[],memory:FeintMemory|undefined,time:number,risk?:Risk):Option[]{
 if(p.role==='GK')return [];
 const sign=p.side===0?1:-1,confidence=dribbleConfidence(p);
 const markers=players.filter(q=>q.side!==p.side&&(q.x-p.x)*sign>-.6&&distance(q,p)>1.1&&distance(q,p)<5.5&&Math.abs(q.y-p.y)<4.5)
  .sort((a,b)=>distance(a,p)-distance(b,p)).slice(0,2);
 const priced=TAKEON_PRICE.on&&!!risk&&markers.length>0;
 const lossWeight=priced?deliveryLossWeight(p,turnoverPrice(p,players,p)):0;
 const near=priced?Math.min(...players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>distance(q,p))):0;
 return markers.flatMap(marker=>[-1,1].map(lateral=>{
  const aim={x:clamp(marker.x+sign*2.2,.8,L-.8),y:clamp(marker.y+lateral*2.6,-W/2+1,W/2-1)};
  const local=readDribbleRoute(p,aim,players,marker.id),exitRoom=Math.min(...players.filter(q=>q.side!==p.side&&q.id!==marker.id).map(q=>distance(q,aim)));
  const gap=distance(p,marker),speed=Math.hypot(p.vx,p.vy),alignment=speed>.3?((aim.x-p.x)*p.vx+(aim.y-p.y)*p.vy)/(Math.max(.01,distance(p,aim))*speed):1;
  let score:number;
  if(priced){
   const {read,gain}=takeOnParts(p,marker,players,aim,risk!,near,time,0);
   score=CARRY_BASE+TAKEON_FLAIR*((p.traits.dribble??DRIBBLE_TYPICAL)-DRIBBLE_TYPICAL)+gain-read.stopped*lossWeight
    -(gap<2?.1:0)-Math.max(0,gap-3.5)*.045-local.nearbyChallenges*(.12-confidence*.04)-clamp((3-exitRoom)/3,0,1)*.2-(1-alignment)*.035-repeatFeintCost(p,marker,memory,time);
  }else score=.16+p.traits.dribble*.36+clamp(p.skills.control/10,0,1)*.1+(p.traits.risk-.5)*.08
   -(gap<2?.1:0)-Math.max(0,gap-3.5)*.045-local.contactRisk*(.28-confidence*.08)
   -local.nearbyChallenges*(.12-confidence*.04)-clamp((3-exitRoom)/3,0,1)*.2-(1-alignment)*.035-repeatFeintCost(p,marker,memory,time);
  return {kind:'feint' as const,target:marker.id,aim,score,reason:`Îl provoacă pe ${marker.name}; încearcă să treacă pe lângă el cu mingea.`,...(priced?{lossPriced:true}:{})};
 })).sort((a,b)=>b.score-a.score);
}
