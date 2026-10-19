import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer,Option} from './practice.js';
import type {Vec} from './movement.js';
import {dribbleConfidence,readDribbleRoute,carryLossRead,beatNature,routeCredits,BEAT_SPREAD,CARRY_BASE} from './practice-carry.js';
import {perceive} from './practice-perception.js';
import {turnoverPrice,deliveryLossWeight} from './practice-rest-defence.js';

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

export function feintDuration(p:PracticePlayer,aim:Vec):number {
 // The fake precedes the burst. Acceleration still governs every real movement tick.
 return .26+clamp(distance(p,aim)/Math.max(1,p.pace*.75)+.4,.85,1.8);
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
 const commitment=Math.max(originalScore,...available.filter(o=>o.kind==='feint'&&o.target===defender).map(o=>o.score));
 return available.some(o=>['pass','through','loft','shoot','clear'].includes(o.kind)&&o.score>commitment+.18);
}

/** The fake's odds: the chance the man in front of him buys it (the carrier's control against his reading and
 * discipline). Moved here from practice.ts unchanged (take-on price, 2026-10-19) so the carrier's read of a take-on
 * can use the same odds, as duelChance is shared with the carry's read. */
export function feintFoolChance(p:PracticePlayer,d:PracticePlayer):number{
 return clamp(.42+(p.skills.control-d.skills.reading)*.055+(1-d.traits.discipline)*.1,.12,.8);
}

/** Take-on price (2026-10-19, owner-approved): "a take-on weighs what beating the man gains here against what losing
 * the ball here costs, seen through the player's personality". One switch (on in this branch; off plays the live
 * take-on score exactly). */
export const TAKEON_PRICE={on:true};
/** His read of a take-on on `marker`, from what he can see (where the men are, who they are):
 *  - getting past him (`through`): the fake's odds (feintFoolChance), the chance it fails believed less likely by his
 *    nature (beatNature: daring, a natural dribbler), misjudged by his read of a carry (an error up to BEAT_SPREAD of
 *    that chance for one who cannot read it);
 *  - being stopped (`stopped`): when the fake fails the man is on the ball, and wins it as often as he reads the duel
 *    (carryLossRead: duelChance with the man's cover, the same nature, the same read).
 * The everyday hazards of the route (another man closing the exit, no room beyond him) stay in the score as before. */
export function takeOnRead(p:PracticePlayer,marker:PracticePlayer,players:PracticePlayer[]):{through:number;stopped:number}{
 const fails=1-feintFoolChance(p,marker);
 const fail=clamp(perceive(p,'carry',fails*beatNature(p),BEAT_SPREAD*fails,p,{salt:'fool'+marker.id}),.03,.97);
 return {through:1-fail,stopped:carryLossRead(p,players,fail,marker.id)};
}
type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;

/** The coach and ordinary play share the same plausible one-on-one attempts.
 * With TAKEON_PRICE on (and the lane read `risk` given), the take-on is valued as the carry is: CARRY_BASE for keeping
 * the ball on the move, plus his flair (dribble trait x 0.36, the old score's own trait term: a dribbler likes taking
 * a man on beyond what it gets), plus what getting past him gets him there (routeCredits: progress, a shot that
 * opens, a pass that opens, escaping the man closing him, read without the man he beats) as often as he reads he gets
 * past, less what losing it here costs (deliveryLossWeight of turnoverPrice: the ball lost, priced where he is, as the
 * pass, the carry and the shot price it) as often as he reads he is stopped. The old score's control and risk terms
 * are gone: control now acts through the fake's and the duel's odds, his risk appetite through the loss weight and
 * his nature. The route hazards (gap, men closing the route and its exit, alignment, repeating the move) are
 * unchanged. Off: the live score, unchanged. */
export function feintOptions(p:PracticePlayer,players:PracticePlayer[],memory:FeintMemory|undefined,time:number,risk?:Risk):Option[]{
 if(p.role==='GK')return [];
 const sign=p.side===0?1:-1,confidence=dribbleConfidence(p);
 const markers=players.filter(q=>q.side!==p.side&&(q.x-p.x)*sign>-.6&&distance(q,p)>1.1&&distance(q,p)<5.5&&Math.abs(q.y-p.y)<4.5)
  .sort((a,b)=>distance(a,p)-distance(b,p)).slice(0,2);
 const priced=TAKEON_PRICE.on&&!!risk&&markers.length>0;
 const lossWeight=priced?deliveryLossWeight(p,turnoverPrice(p,players,p)):0;
 const near=priced?Math.min(...players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>distance(q,p))):0;
 return markers.flatMap(marker=>{
  const read=priced?takeOnRead(p,marker,players):null,beyond=priced?players.filter(q=>q.id!==marker.id):players;
  return [-1,1].map(lateral=>{
  const aim={x:clamp(marker.x+sign*2.2,.8,L-.8),y:clamp(marker.y+lateral*2.6,-W/2+1,W/2-1)};
  const local=readDribbleRoute(p,aim,players,marker.id),exitRoom=Math.min(...players.filter(q=>q.side!==p.side&&q.id!==marker.id).map(q=>distance(q,aim)));
  const gap=distance(p,marker),speed=Math.hypot(p.vx,p.vy),alignment=speed>.3?((aim.x-p.x)*p.vx+(aim.y-p.y)*p.vy)/(Math.max(.01,distance(p,aim))*speed):1;
  const hazards=()=>-(gap<2?.1:0)-Math.max(0,gap-3.5)*.045-local.contactRisk*(.28-confidence*.08)
   -local.nearbyChallenges*(.12-confidence*.04)-clamp((3-exitRoom)/3,0,1)*.2-(1-alignment)*.035-repeatFeintCost(p,marker,memory,time);
  const score=read?CARRY_BASE+p.traits.dribble*.36+read.through*routeCredits(p,aim,beyond,risk!,near).credits-read.stopped*lossWeight+hazards()
   :.16+p.traits.dribble*.36+clamp(p.skills.control/10,0,1)*.1+(p.traits.risk-.5)*.08
   -(gap<2?.1:0)-Math.max(0,gap-3.5)*.045-local.contactRisk*(.28-confidence*.08)
   -local.nearbyChallenges*(.12-confidence*.04)-clamp((3-exitRoom)/3,0,1)*.2-(1-alignment)*.035-repeatFeintCost(p,marker,memory,time);
  return {kind:'feint' as const,target:marker.id,aim,score,reason:`Îl provoacă pe ${marker.name}; încearcă să treacă pe lângă el cu mingea.`};
 });}).sort((a,b)=>b.score-a.score);
}
