import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF} from './pitch.js';
import {clamp} from './model.js';
import {STEP} from './movement.js';
import type {MovingBall,Vec} from './movement.js';
import {advanceFlight,PASS_DRAG} from './practice-flight.js';
import {keeperReach,keeperEdgeFor,PROBE_ON} from './practice-football.js';
import {acuity,perceive} from './practice-perception.js';
import type {Reader} from './practice-perception.js';

/** All lengths are metres, times seconds, and attributes use the existing 0–10 scale. */
export interface KeeperState extends Vec {
 side:0|1;vx:number;vy:number;angle:number;pace:number;acceleration:number;
 skills:{reading:number;keeping:number};
}
const ownDepth=(side:0|1,x:number)=>side===0?x:L-x;
const worldX=(side:0|1,x:number)=>side===0?x:L-x;
const reactionTime=(p:KeeperState)=>.2+(10-clamp(p.skills.reading,0,10))*.015-keeperEdgeFor(p as any).reactionCut;
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};

/**
 * A movement target only. Anticipate a carrier's next short touch, bisect the two
 * post directions, and stay shallow for a wide ball. `closing` means an opponent
 * currently carries the ball; it allows a bounded advance against a close threat.
 */
export function keeperReadyPosition(p:Pick<KeeperState,'side'|'skills'>,ball:Vec&Partial<Pick<MovingBall,'vx'|'vy'|'owner'>>,closing=false,oneOnOne=false):Vec {
 const lead=ball.owner ? .1+clamp(p.skills.reading/10,0,1)*.12 : 0;
 const bx=clamp(ownDepth(p.side,ball.x+(ball.vx??0)*lead),.1,L);
 const by=ball.y+(ball.vy??0)*lead;
 // ACCURACY PROBE: a carrier through on goal (no defender goal-side of him) is met: the keeper comes off his line
 // to close the angle, further the better his keeping (to 3.6-4.6 m from 6-12 m out).
 const advance=PROBE_ON&&closing&&oneOnOne&&bx<14?clamp(5.2-bx*.13+(clamp(p.skills.keeping,0,10)-6)*.12,1.6,4.6):closing&&bx<12?clamp(3.8-bx*.11,1.2,3.2):clamp(bx*.12,.65,2.8);
 const depth=Math.max(.3,Math.min(advance,Math.max(.3,bx-1.25),2.1*bx/Math.max(1,Math.abs(by))));
 const upper=unit(-bx,GH-by),lower=unit(-bx,-GH-by);
 const direction=unit(upper.x+lower.x,upper.y+lower.y);
 const y=by+(depth-bx)*direction.y/Math.min(-.001,direction.x);
 return {x:worldX(p.side,depth),y:clamp(y,-GH+.18,GH-.18)};
}

/** A keeper facing an attack keeps setting himself: he re-reads his ready
 * position on the same 0.25 s cadence as the outfield's assignments (before,
 * an off-ball intent held for 0.55-0.85 s, so a square ball or a carrier's
 * step left him set against where the ball had been: at a shot he stood on
 * average ~1.1 m off the line bisecting the posts, and shots with him > 1.5 m
 * off went in about half the time). While an opponent's pass travels he sets
 * against its visible flight a moment ahead (KEEPER_FLIGHT_LEAD seconds),
 * which is what a keeper shuffling across with a square ball does. He still
 * moves at his normal pace, so a quick switch across the box still beats him. */
export const KEEPER_REREAD=.25,KEEPER_FLIGHT_LEAD=.3;
/** How this keeper does it (R2): a keeper's read is his own, from keeping
 * (60%) and reading (40%). Calibrated on the squad's typical keeper (read
 * 0.84, e.g. keeping 8 and reading 9), who does exactly what B4 set: re-reads
 * every 0.25 s and reads a pass 0.3 s ahead. A top keeper re-reads a little
 * more often (~0.21 s) and reads the flight further ahead (~0.35 s); a poor
 * one (0.6) re-reads every ~0.31 s and reads it ~0.23 s ahead. Everyone
 * finds the angle with his own error: a few centimetres for a top keeper,
 * ~0.25 m for a poor one, smoothly (the misjudgement belongs to where the
 * ball is and when, not to a dice roll every tick). No keeper is perfect on
 * every square ball, and the average one is not worse than before. */
export const KEEPER_SPREAD=.55,KEEPER_TYPICAL=.84;
export function keeperRead(p:Reader,ball:Vec,time:number):{reread:number;lead:number;offset:number}{
 const a=acuity(p,'keeper');
 return {reread:clamp(KEEPER_REREAD+.25*(KEEPER_TYPICAL-a),.18,.4),lead:KEEPER_FLIGHT_LEAD*clamp(1+(a-KEEPER_TYPICAL),.6,1.2),offset:perceive(p,'keeper',0,KEEPER_SPREAD,ball,{time,salt:'angle'})};
}
/**
 * How eager a keeper is to leave his line for a ball played in behind. Every
 * keeper judges such a ball by forecast arrival at the meeting point; the
 * keeperSweep trait (0 stays on his line, 1 a sweeper) never decides WHETHER
 * he may come. It sets the head start he needs over the nearest attacker
 * (`margin`, seconds: negative means he must be first by that much) and how
 * far from his goal he will go for it (`range`, metres).
 */
export function keeperSweepReach(sweep:number):{margin:number;range:number}{
 const s=clamp(sweep,0,1);
 return {margin:-.5+s*.8,range:BOX_DEPTH+1+s*9};
}
/** B3 (2026-10-09), answering the long ball. A pass whose receiver will meet
 * it behind the keeper's last outfielder (the space a deep line leaves in
 * front of him) is his to read. He compares, on his own picture, his earliest
 * meeting with the flight against the attackers' earliest touch (the
 * defence's own read of who gets there first) and comes when he reads he is
 * first or level by the lead his habit demands (`keeperSweepNeed`, seconds:
 * positive means he must be first by that much). A keeper who stays at home
 * wants to be clearly first (0.15 s); a sweeper goes when he reads it level,
 * and accepts being a little late (up to 0.3 s at the trait's top: the risk
 * the Sweeper call states, "if he's late the goal is open"), about as eager
 * as the old ground-ball rule left him, so the call keeps its meaning. How good
 * the read is comes from his keeping and reading (perception 'keeper'): a
 * sharp keeper is off by a few hundredths, a poor one by a couple of tenths,
 * both ways. His pace is already in his forecast, so a slow keeper reaches
 * fewer of these balls whatever his habit. He does not stand anywhere new:
 * where he stands is unchanged (keeperSweepDepth, keeperLineDepth). */
export const SWEEP_NEED_HOME=.15,SWEEP_NEED_SWEEPER=-.3,SWEEP_READ_SPREAD=.5;
export function keeperSweepNeed(sweep:number):number{
 return SWEEP_NEED_HOME+(SWEEP_NEED_SWEEPER-SWEEP_NEED_HOME)*clamp(sweep,0,1);
}
/** Extra metres off his line a keeper stands while the ball is far away: a
 * sweeper stands higher, a keeper who stays on his line deeper. Zero at the
 * engine's default trait (0.2), so untouched keepers stand where they did. */
export function keeperSweepDepth(sweep:number,ballDepth:number,ownBall:boolean):number{
 const s=clamp(sweep,0,1)-.2;
 return ownBall?s*clamp((ballDepth-16)/16,0,1)*5:s*clamp((ballDepth-12)/12,0,1)*4.5;
}

/** Behaviour round A (2026-10-03): a keeper plays off his back line, not off
 * his goal line. While the ball is out of shooting range (from KEEPER_FOLLOW_FROM
 * m out, fully from KEEPER_FOLLOW_FULL) he stands no more than KEEPER_BEHIND
 * metres behind his last outfielder (less for a sweeper: KEEPER_BEHIND_SWEEP x
 * keeperSweep), never further out than the edge of his area plus a sweeper's
 * few metres. A higher line means a higher keeper; a deep line leaves him
 * where he was. As the ball comes into shooting range he gets back to set
 * himself, at a sprint (practice.ts). Whether he comes for a ball is still his
 * own forecast of getting there first. (The first screen had him follow from
 * 14 m out: shots from 15 m+ rose from 0.4 to 2.1 a side and scored 24%.) */
export const KEEPER_BEHIND=13,KEEPER_BEHIND_SWEEP=5,KEEPER_FOLLOW_FROM=24,KEEPER_FOLLOW_FULL=32;
/** Settings-truth round (2026-10-04): a keeper who stays on his line does not
 * play off his back line at all. Following it is a sweeper-keeper's habit: none
 * at keeperSweep KEEPER_HOME (and below), fully from the engine's default trait
 * (0.2) up, so the default keeper and the sweeper stand where they did. (It had
 * pulled every keeper up behind his line, so "Stay on line" came further out
 * than a keeper left to his own way: 12.75 m against 11.99 m at most.) */
export const KEEPER_HOME=.1;
export function keeperLineDepth(sweep:number,lastLine:number,ballDepth:number):number{
 const s=clamp(sweep,0,1),far=clamp((ballDepth-KEEPER_FOLLOW_FROM)/(KEEPER_FOLLOW_FULL-KEEPER_FOLLOW_FROM),0,1);
 const follows=clamp((s-KEEPER_HOME)/(.2-KEEPER_HOME),0,1);
 return follows*far*clamp(lastLine-(KEEPER_BEHIND-KEEPER_BEHIND_SWEEP*s),0,BOX_DEPTH+1+4*s);
}

export interface KeeperFlightRead {
 /** Time to the goal line, and a fresh interception target on the observed flight. */
 time:number;crossing:Vec;aim:Vec;contactTime:number;
 /** Forecast feasibility never awards a save. The live swept collision is required. */
 reachable:boolean;dive:boolean;
}
/** Distance available along one direction, including time spent reversing momentum. */
function travel(p:KeeperState,point:Vec,time:number):number {
 const direction=unit(point.x-p.x,point.y-p.y),initial=p.vx*direction.x+p.vy*direction.y;
 const acceleration=Math.max(.1,p.acceleration),accelerating=clamp((p.pace-initial)/acceleration,0,time);
 return initial*accelerating+.5*acceleration*accelerating*accelerating+p.pace*(time-accelerating);
}

/**
 * Re-read this target during the flight, including during an active dive. Uses the
 * live ball integrator (including bounces), and considers points before the goal
 * instead of fixing the intercept to the keeper's current x. Callers still enforce
 * their reaction gate and move normally; `reachable` is a planning estimate only.
 */
export function readKeeperFlight(p:KeeperState,ball:MovingBall,shotAge:number):KeeperFlightRead|null {
 if(ball.owner)return null;
 const goalX=worldX(p.side,0),dx=goalX-ball.x,speed=Math.hypot(ball.vx,ball.vy);
 if(dx*ball.vx<=0||Math.abs(ball.vx)<.1||speed<1)return null;
 const goalY=ball.y+dx*ball.vy/ball.vx;
 if(Math.abs(goalY)>GH+.4)return null;
 const remaining=Math.max(0,reactionTime(p)-shotAge),state={...ball};
 const candidates:{point:Vec;time:number;gap:number;reachable:boolean}[]=[];
 let goalTime=0,goalHeight=Infinity;
 // Five seconds covers slow threatening deliveries too. A stopped ball is not a shot.
 for(let tick=1;tick<=Math.ceil(5/STEP);tick++){
  const oldX=state.x,oldZ=state.z;advanceFlight(state);
  const time=tick*STEP,depth=ownDepth(p.side,state.x);
  if(depth<=0){
   const fraction=clamp((goalX-oldX)/(state.x-oldX||1),0,1);
   goalTime=time-STEP+fraction*STEP;goalHeight=oldZ+(state.z-oldZ)*fraction;break;
  }
  if(Math.hypot(state.vx,state.vy)<.05)return null;
  if(tick%4!==0||time<remaining||depth>BOX_DEPTH-.15||Math.abs(state.y)>BOX_HALF||state.z>2.3)continue;
  const point={x:state.x,y:state.y},available=Math.max(0,time-remaining);
  const afterReaction={...p,x:p.x+p.vx*remaining,y:p.y+p.vy*remaining};
  const gap=Math.hypot(point.x-afterReaction.x,point.y-afterReaction.y)-travel(afterReaction,point,available)-keeperReach(p,shotAge+time);
  candidates.push({point,time,gap,reachable:gap<=0});
 }
 if(!goalTime||goalHeight>HEIGHT+.2)return null;
 // Earliest feasible meeting reduces the angle; otherwise keep chasing the closest
 // achievable part of the flight instead of pretending an unreachable save exists.
 const meeting=candidates.find(c=>c.reachable)??candidates.reduce<typeof candidates[number]|undefined>((best,c)=>!best||c.gap<best.gap?c:best,undefined);
 const aim=meeting?.point??{x:worldX(p.side,.3),y:goalY};
 const contactTime=meeting?.time??goalTime,lateral=Math.abs(aim.y-p.y);
 return {time:goalTime,crossing:{x:goalX,y:goalY},aim,contactTime,reachable:meeting?.reachable??false,dive:contactTime<.65&&lateral>.72};
}

export interface KeeperContact {
 /** Actual separation at the already-confirmed swept hand collision. */
 gap:number;reach:number;shotAge:number;diving?:boolean;recovering?:boolean;
}
export interface KeeperHandling {
 catchChance:number;readiness:number;stretch:number;
 /** Assign velocity only after an actual hand collision and a failed catch roll. */
 parry:{vx:number;vy:number;vz:number};
}

/**
 * Assess an existing legal hand contact. `p` should be interpolated to the contact
 * instant, as should the ball; opponents are their current positions. A caller may
 * catch when its seeded random roll is below catchChance, otherwise use parry.
 * Neither result moves the keeper or creates contact/possession on its own.
 */
export function keeperHandling(p:KeeperState,ball:MovingBall,contact:KeeperContact,opponents:readonly Vec[]=[]):KeeperHandling {
 const skill=clamp(p.skills.keeping/10,0,1),incoming=unit(ball.vx-p.vx,ball.vy-p.vy);
 const speed=Math.hypot(ball.vx-p.vx,ball.vy-p.vy,ball.vz);
 const lateral=Math.abs((ball.x-p.x)*incoming.y-(ball.y-p.y)*incoming.x);
 // Full forward arm extension is normal for a catch; lateral extension is not.
 const stretch=clamp((Math.min(contact.gap,lateral)-.35)/Math.max(.3,contact.reach-.35),0,1);
 const facing=clamp((Math.cos(p.angle)*-incoming.x+Math.sin(p.angle)*-incoming.y+1)/2,0,1);
 const moving=clamp(Math.hypot(p.vx,p.vy)/Math.max(1,p.pace),0,1);
 const reacted=clamp(contact.shotAge/reactionTime(p),0,1);
 const readiness=clamp(1-moving*.3-(1-facing)*.25-(1-reacted)*.45-(contact.recovering?.4:0),0,1);
 const paceLoad=clamp((speed-9)/17,0,1),heightLoad=clamp((ball.z-1.25)/1.05,0,1);
 // Pace beats a keeper's hands at full stretch or off balance. A set keeper
 // with the ball arriving at his body holds even a hard shot, so the pace
 // penalty shrinks as the contact comes in close and ready.
 const atBody=clamp(1-stretch/.4,0,1)*clamp((readiness-.55)/.35,0,1);
 const catchChance=clamp(.87+skill*.11-paceLoad*.47*(1-.75*atBody)-stretch*.46-heightLoad*.23-(1-readiness)*.36-(contact.diving?.09:0),.025,.98);
 return {catchChance,readiness,stretch,parry:keeperParry(p,ball,speed,stretch,skill,opponents)};
}

/**
 * Where a ball the keeper cannot hold goes. He never bats it back across his
 * goal or out into play at pace. At full stretch, or with the ball too high to
 * smother, he tips it round the post (it crosses the goal line outside the
 * post: a corner). Otherwise he pushes it wide and soft, away from attackers,
 * with just enough pace to die by his goal line out near the touchline (in
 * play: no throw-in). A push whose path or landing is crowded by attackers
 * becomes a tip instead.
 */
function keeperParry(p:KeeperState,ball:MovingBall,speed:number,stretch:number,skill:number,opponents:readonly Vec[]):{vx:number;vy:number;vz:number}{
 const s=p.side===0?1:-1,d=Math.max(0,ownDepth(p.side,ball.x));
 // Where the ball was going at the goal line (team frame: +depth is away from goal).
 const heading=ball.vx*s<-.1?ball.y+d*ball.vy/(-ball.vx*s):ball.y;
 const preference=Math.abs(ball.y)>.15?Math.sign(ball.y):Math.abs(ball.vy)>.1?Math.sign(ball.vy):1;
 // Once the contact is wide, do not redirect it through the goal's central lane.
 const flanks=Math.abs(ball.y)>.65?[Math.sign(ball.y)]:[-1,1];
 const crowd=(from:Vec,to:Vec)=>{let pressure=0;
  const length=Math.hypot(to.x-from.x,to.y-from.y)||1,ux=(to.x-from.x)/length,uy=(to.y-from.y)/length;
  for(const q of opponents){
   const along=(q.x-from.x)*ux+(q.y-from.y)*uy;if(along<-.5)continue;
   const gap=along>length?Math.hypot(q.x-to.x,q.y-to.y):Math.abs((q.x-from.x)*uy-(q.y-from.y)*ux);
   pressure+=clamp((3-gap)/3,0,1);
  }
  return pressure;};
 const pushes=flanks.map(flank=>{
  const target={x:worldX(p.side,.6),y:flank*(W/2-2)};
  const crossing=Math.abs(ball.y)>.5&&flank*ball.y<0?2.2:0;
  return {flank,target,cost:crossing+crowd(ball,target)+(flank===preference?0:.12)};
 }).sort((a,b)=>a.cost-b.cost);
 const tip=stretch>=.9||ball.z>HEIGHT-.2||pushes[0].cost>=1.6;
 if(tip){
  const flank=flanks.length===1?flanks[0]:Math.abs(heading)>.3?Math.sign(heading):pushes[0].flank;
  // Cross the goal line clear of the post; from almost on the line the tip is lateral.
  const cross=flank*Math.max(GH+.9,Math.abs(ball.y)+.8);
  const direction=unit(-s*Math.max(d,.05),cross-ball.y),tipSpeed=clamp(speed*.35,4,9);
  return {vx:direction.x*tipSpeed,vy:direction.y*tipSpeed,vz:clamp(.25+ball.z*.32+Math.abs(ball.vz)*.07,.3,1.3)};
 }
 const target=pushes[0].target,direction=unit(target.x-ball.x,target.y-ball.y);
 // Soft: just enough pace to roll to the landing area and die there.
 const pushSpeed=clamp(Math.sqrt(2*PASS_DRAG*Math.hypot(target.x-ball.x,target.y-ball.y))+skill*.3,2.2,4.8);
 return {vx:direction.x*pushSpeed,vy:direction.y*pushSpeed,vz:clamp(.1+ball.z*.2,.1,.6)};
}
