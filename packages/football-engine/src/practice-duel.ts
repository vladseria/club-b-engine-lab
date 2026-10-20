import {clamp} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {perceive,daring,composure,nerve,eagerness,followsTeam} from './practice-perception.js';
import {challengeFoulChance} from './practice-challenge.js';
import {WORLD} from './world.js';

/** The reception duel (contest round, 2026-10-15).
 *
 * Before, a pass went to whoever's foot met it first and the receiver's touch
 * was never contested: a defender tight on him (goal-side, at his side, or
 * arriving with the ball) was a body the ball could roll into, then a tackle
 * a moment later. Now the touch itself is a duel when a defender's foot can
 * get to the ball as it is met:
 *  - the defender chooses, on his own read, whether to COMMIT (step across or
 *    poke round him to nick it) or HOLD (stay tight and goal-side and make the
 *    touch hard). Committing wins the ball outright when it comes off, and
 *    leaves him turned, or fouling, when he mistimes it. How good he thinks
 *    his chance is (his reading, plus a daring player's optimism and an eager
 *    one's appetite) is weighed against what being turned costs here (nearer
 *    our goal and with nobody behind him it costs more; a disciplined player
 *    counts that cost in full, a daring one shrugs part of it off);
 *  - the receiver's touch is fought for: his control and strength, how well
 *    his body screens the ball from the man, and his composure, against the
 *    defender's defending, strength and reading (his timing), how close he is,
 *    which side he comes from and how fast;
 *  - outcomes: a clean touch; a touch kept but forced (he cannot turn: a
 *    nervous receiver lays it off first time, a composed one shields it away
 *    from goal); a touch that goes loose; the defender nicking it; the
 *    defender turned (his lunge missed); a foul.
 * No outcome is capped or scripted: each is the odds of the two players doing
 * what they are trying to do at that moment. Good receivers stay good: a
 * strong, composed controller who screens the ball keeps nearly every one. */

/** How far from the ball (m) a defender's foot gets to it with a step as it
 * is met: a leg (about 0.9 m) and a short lunge. */
export const DUEL_REACH=1.25,DUEL_FULL=.65;
/** A defender running in who is within reach this soon after the touch
 * (s, at his closing speed) contests it too: he arrives with the ball. */
export const DUEL_ARRIVE=.2;
/** A man on the receiver's back (goal-side, his body within TIGHT_BODY m of
 * him, fully tight inside TIGHT_BODY - TIGHT_SPAN) contests the touch with
 * his body even when his foot cannot get to the ball: TIGHT_PRESS of a foot
 * on it for making the touch go loose. */
export const TIGHT_BODY=1.4,TIGHT_SPAN=.7,TIGHT_PRESS=.7;
/** The nick: his chance when he commits, well within reach, unscreened and
 * level (NICK_BASE); stepping across from the side the ball comes from adds
 * up to NICK_FRONT; the receiver's body between him and the ball takes up to
 * NICK_SCREEN of it away. Per skill point: defending against control
 * NICK_SKILL, strength NICK_STRENGTH, reading (timing) NICK_READ from 5. */
export const NICK_BASE=.3,NICK_FRONT=.16,NICK_SCREEN=.8,NICK_SKILL=.035,NICK_STRENGTH=.012,NICK_READ=.015,NICK_CLOSING=.08;
/** How wrong his read of that chance can be (one who cannot read at all),
 * and how much a daring / eager defender adds to what he sees. */
export const NICK_SPREAD=.25,NICK_DARING=.15,NICK_EAGER=.2;
/** What holding is worth to him, in the units of the nick (a ball won): a
 * touch he makes go loose is half a ball won (LOOSE_WORTH), a man forced to
 * play back or shield with his back to goal is worth FORCED_WORTH. He reads
 * those chances as he reads the nick. */
export const LOOSE_WORTH=.5,FORCED_WORTH=.2;
/** Being turned: the cost (0..1) of being beaten here, from TURN_COST_BASE,
 * up by TURN_COST_DANGER near our goal, down by TURN_COST_COVER per team-mate
 * goal-side of the receiver; and the chance a miss turns him: TURN_BASE, up
 * with his closing speed (TURN_CLOSING per m/s), with how far he has to
 * stretch for it (TURN_STRETCH at the edge of his reach: a lunge from a
 * metre away that misses leaves him nowhere) and the receiver's control and
 * strength over his defending and strength. */
export const TURN_COST_BASE=.35,TURN_COST_DANGER=.5,TURN_COST_COVER=.15,TURN_BASE=.38,TURN_CLOSING=.05,TURN_STRETCH=.3;
/** A nick he keeps (his foot on it) rather than poking it loose. */
export const NICK_CLEAN=.25;
/** The touch under a man who holds: it goes loose (LOOSE_BASE well within
 * reach; a firm ball, LOOSE_FIRM at full; per point of defending+strength
 * against control+strength LOOSE_SKILL; composure saves LOOSE_COMPOSED); and
 * kept but forced (he cannot turn) when the man is tight goal-side, unless
 * the receiver is strong and composed enough to roll him. */
export const LOOSE_BASE=.1,LOOSE_FIRM=.15,LOOSE_SKILL=.012,LOOSE_COMPOSED=.06,ROLL_BASE=.25,ROLL_STRENGTH=.05,ROLL_CONTROL=.03,ROLL_COMPOSED=.25;
/** A forced receiver lays it off first time when the pressure he feels (his
 * own read, scaled by his nerve) reaches LAYOFF_FELT; otherwise he shields. */
export const LAYOFF_FELT=.7,LAYOFF_SPREAD=.3;
/** How long a defender who was turned needs to plant and come back (s). */
export const TURNED_TIME=.55;

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
const s10=(n:number)=>clamp(n/10,0,1);

export type DuelOutcome='clean'|'forced'|'loose'|'nicked'|'turned'|'foul';
export interface DuelGeometry {
 /** 0..1: how surely his foot gets to the ball (1 well within reach). */access:number;
 /** 0..1: the receiver's body between him and the ball. */screen:number;
 /** -1..1: he stands on the side the ball comes from (can step across it). */front:number;
 /** 0..1: tight on him and goal-side (on his back for a man facing his own goal): his body, not his foot. */goalTight:number;
 /** 0..1: how much he bears on the touch: his foot on the ball, or his body on the man. */press:number;
 /** m/s towards the ball. */closing:number;gap:number;
}
export interface DuelRead extends DuelGeometry {
 nick:number;seenNick:number;turnCost:number;turnChance:number;commit:boolean;
}
export interface DuelResult extends DuelRead {
 outcome:DuelOutcome;receiver:string;defender:string;
 /** forced: he lays it off first time (nervous) rather than shielding. */layoff:boolean;
 /** nicked: he keeps it at his feet rather than poking it loose. */cleanNick:boolean;
 foulChance:number;looseChance:number;forcedChance:number;
}

/** Where the defender is relative to the receiver and the ball at the touch. */
export function duelGeometry(receiver:PracticePlayer,defender:Vec&{vx:number;vy:number},ball:Vec&{vx:number;vy:number},goal:Vec):DuelGeometry{
 const toBall=unit(ball.x-defender.x,ball.y-defender.y),gap=distance(defender,ball);
 const closing=Math.max(0,defender.vx*toBall.x+defender.vy*toBall.y);
 const effective=gap-Math.min(closing,7)*DUEL_ARRIVE;
 const access=clamp((DUEL_REACH-effective)/(DUEL_REACH-DUEL_FULL),0,1);
 // the receiver's torso across the line from the defender to the ball
 const dx=ball.x-defender.x,dy=ball.y-defender.y,d2=dx*dx+dy*dy||1e-6;
 const t=((receiver.x-defender.x)*dx+(receiver.y-defender.y)*dy)/d2;
 const perp=distance(receiver,{x:defender.x+t*dx,y:defender.y+t*dy});
 const screen=t>.1&&t<1.05?clamp((.6-perp)/.3,0,1):0;
 // the side the ball comes from: he can put a foot across its line first
 const back=unit(-ball.vx,-ball.vy),front=clamp(((defender.x-receiver.x)*back.x+(defender.y-receiver.y)*back.y)/.8,-1,1);
 const toGoal=unit(goal.x-receiver.x,goal.y-receiver.y),goalSide=(defender.x-receiver.x)*toGoal.x+(defender.y-receiver.y)*toGoal.y;
 // tight: his body against the man (a defender on a pivot's back cannot reach the ball through him, but he is on him)
 const goalTight=clamp(goalSide/.6,0,1)*clamp((TIGHT_BODY-distance(defender,receiver))/TIGHT_SPAN,0,1);
 return {access,screen,front,goalTight,press:Math.max(access,TIGHT_PRESS*goalTight),closing,gap};
}

/** The touch under a man who holds, as the odds stand (see LOOSE_*, ROLL_*). */
export function holdOdds(r:PracticePlayer,d:PracticePlayer,g:DuelGeometry,relativeSpeed:number):{loose:number;forced:number}{
 const firm=clamp((relativeSpeed-6)/8,0,1);
 const loose=clamp(g.press*(LOOSE_BASE+LOOSE_FIRM*firm+((d.skills.defending+d.skills.strength)-(r.skills.control+r.skills.strength))*LOOSE_SKILL-LOOSE_COMPOSED*(composure(r)-.5)*2),0,.45);
 const roll=clamp(ROLL_BASE+(r.skills.strength-d.skills.strength)*ROLL_STRENGTH+(r.skills.control-6)*ROLL_CONTROL+ROLL_COMPOSED*(composure(r)-.5)*2,0,.9);
 return {loose,forced:clamp(g.goalTight*(1-roll),0,1)};
}
/** The defender's read: commit to nick it, or hold? `cover`: his team-mates
 * goal-side of the receiver; `danger` 0..1: how near our goal this is. */
export function readDuel(receiver:PracticePlayer,defender:PracticePlayer,geometry:DuelGeometry,cover:number,danger:number,at:Vec,time:number,relativeSpeed=0):DuelRead{
 const g=geometry,r=receiver,d=defender;
 const nick=clamp((NICK_BASE*(1-NICK_SCREEN*g.screen)+NICK_FRONT*Math.max(0,g.front)+NICK_CLOSING*clamp(g.closing/5,0,1))*g.access
  +((d.skills.defending-r.skills.control)*NICK_SKILL+(d.skills.strength-r.skills.strength)*NICK_STRENGTH+(d.skills.reading-5)*NICK_READ)*g.access,.01,.8);
 const seenNick=clamp(perceive(d,'threat',nick,NICK_SPREAD,at,{time,salt:'duel',bias:daring(d)*NICK_DARING+eagerness(d)*NICK_EAGER}),0,1);
 const turnCost=clamp(TURN_COST_BASE+TURN_COST_DANGER*danger-TURN_COST_COVER*cover,.1,1);
 const turnChance=clamp(TURN_BASE+TURN_CLOSING*g.closing+TURN_STRETCH*(1-g.access)+(r.skills.control-d.skills.defending)*.03+(r.skills.strength-d.skills.strength)*.01,.1,.9);
 // a disciplined player counts the cost in full; a daring one shrugs part of it off
 const caution=clamp(.4+.7*followsTeam(d)-.5*daring(d),.3,1.4);
 // holding: what a hard touch gets him (the safe option; no optimism to misjudge)
 const hold=holdOdds(r,d,g,relativeSpeed),holdValue=LOOSE_WORTH*hold.loose+FORCED_WORTH*hold.forced;
 const commit=g.access>0&&seenNick-(1-seenNick)*turnChance*turnCost*caution>holdValue;
 return {...g,nick,seenNick,turnCost,turnChance,commit};
}

/** Resolve the duel with the match's duel stream (`draw` returns 0..1). */
export function resolveDuel(receiver:PracticePlayer,defender:PracticePlayer,read:DuelRead,relativeSpeed:number,deficit:number,draw:()=>number,at:Vec,time:number):DuelResult{
 const r=receiver,d=defender;
 const foulChance=read.commit?challengeFoulChance(d,{closingSpeed:read.closing},deficit,read.screen>.5):0;
 const {loose:looseChance,forced:forcedChance}=holdOdds(r,d,read,relativeSpeed);
 let outcome:DuelOutcome='clean';
 if(read.commit){
  if(draw()<read.nick)outcome='nicked';
  else if(draw()<foulChance)outcome='foul';
  else if(draw()<read.turnChance)outcome='turned';
 }
 if(outcome==='clean'){
  // he held, or lunged and missed without being turned: the touch is still contested
  const u=draw();
  outcome=u<looseChance?'loose':u<looseChance+(1-looseChance)*forcedChance?'forced':'clean';
 }
 // forced: the pressure he feels, his own read scaled by his nerve, decides lay-off or shield
 const felt=outcome==='forced'?perceive(r,'pressure',read.press*(.6+.4*read.goalTight)*nerve(r),LAYOFF_SPREAD,at,{time,salt:'layoff'}):0;
 const cleanNick=outcome==='nicked'&&draw()<clamp(NICK_CLEAN+(d.skills.defending-5)*.04+(d.skills.control-5)*.02-relativeSpeed*.015,.1,.75);
 return {...read,outcome,receiver:r.id,defender:d.id,layoff:felt>=LAYOFF_FELT,cleanNick,foulChance,looseChance,forcedChance};
}

/** A shielding touch: away from the man and not towards goal (he keeps it with his back to him). */
export function shieldTouch(body:Vec,defender:Vec,goal:Vec,inside:(v:Vec)=>Vec):Vec{
 const away=unit(body.x-defender.x,body.y-defender.y),fromGoal=unit(body.x-goal.x,body.y-goal.y);
 const dir=unit(away.x+fromGoal.x*.6,away.y+fromGoal.y*.6);
 return inside({x:body.x+dir.x*1.4,y:body.y+dir.y*1.4});
}
/** Turning a man who lunged: towards goal, round the side he is not on. */
export function turnTouch(body:Vec,defender:Vec,goal:Vec,inside:(v:Vec)=>Vec):Vec{
 const toGoal=unit(goal.x-body.x,goal.y-body.y),lateral={x:-toGoal.y,y:toGoal.x};
 const side=(defender.x-body.x)*lateral.x+(defender.y-body.y)*lateral.y>=0?-1:1;
 const dir=unit(toGoal.x+lateral.x*side*.8,toGoal.y+lateral.y*side*.8);
 return inside({x:body.x+dir.x*2,y:body.y+dir.y*2});
}

/** How willing a contesting defender is to step in front of the receiver
 * rather than arrive goal-side of him (0..1): the same trade-off as the
 * duel's commit (his appetite against the cost of being turned here),
 * read before the ball arrives. */
export function stepInWillingness(d:PracticePlayer,danger:number,cover:number):number{
 const turnCost=clamp(TURN_COST_BASE+TURN_COST_DANGER*danger-TURN_COST_COVER*cover,.1,1);
 const caution=clamp(.4+.7*followsTeam(d)-.5*daring(d),.3,1.4);
 return clamp(.55+daring(d)*.5+eagerness(d)*.6+(s10(d.skills.reading)-.6)*.5-turnCost*caution*.6,0,1);
}
/** How near our goal (0..1) a point is, for the cost of being turned there. */
export const dangerAt=(p:Vec,goal:Vec)=>clamp((WORLD.geometry.duel.dangerFrom.v-distance(p,goal))/WORLD.geometry.duel.dangerSpan.v,0,1);
