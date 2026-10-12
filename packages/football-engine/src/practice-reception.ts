import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';

export const controlTouchBudget=(p:PracticePlayer)=>(3.7+p.skills.control*.45)*(.65+clamp(p.energy/100,0,1)*.35);

/** Passing-and-control round (2026-10-10): what control above the ordinary
 * adds at the touch. Up to CONTROL_FLOOR every number below is exactly the
 * old one (nobody receives worse than before); above it a good controller's
 * ball is playable sooner, he cushions a firm ball more cleanly, opens his
 * body further to where the ball goes next and turns with it faster.
 * 0 at control <= 5, 1 at control 10. */
export const CONTROL_FLOOR=5;
export const controlEdge=(p:{skills:{control:number}})=>clamp((p.skills.control-CONTROL_FLOOR)/(10-CONTROL_FLOOR),0,1);
/** The gap between two foot contacts: the foot must come back and the ball
 * must be playable again. Futsal touch rhythms: a typical player plays a
 * touch every ~0.3 s; a very good one touches the ball every ~0.2 s (sole
 * and inside-outside rhythms of 4-5 touches a second). Was .36-.009*control
 * for everyone (0.27 s at control 10); TOUCH_GAP_EDGE takes the top end to
 * 0.20 s. */
export const TOUCH_GAP_EDGE=.07;
export const touchGap=(p:{skills:{control:number}})=>.36-p.skills.control*.009-TOUCH_GAP_EDGE*controlEdge(p);
/** How fast he turns his body (rad/s, standing; divided by his running
 * speed as before). A good controller pivots on the ball: +TURN_EDGE
 * rad/s at control 10. */
export const TURN_EDGE=.8;
export const bodyTurnRate=(p:PracticePlayer)=>(3.4+p.skills.control*.12+TURN_EDGE*controlEdge(p))/(1+Math.hypot(p.vx,p.vy)*.22);
/** How far a receiver opens his body from the incoming ball towards where he
 * plays it next (rad). 60 degrees for everyone before; a good controller
 * receives on the half-turn, up to ~80 degrees. */
export const OPEN_BODY=1.05,OPEN_BODY_EDGE=.35;
export const openBody=(p:{skills:{control:number}})=>OPEN_BODY+OPEN_BODY_EDGE*controlEdge(p);
/** Turning with the ball at his feet: 2.4 m/s for everyone before; a good
 * controller drags or soles it round and keeps more of his speed (3.6 m/s
 * at control 10). */
export const TURN_WITH_BALL=2.4,TURN_WITH_BALL_EDGE=1.2;
export const turnWithBall=(p:{skills:{control:number}})=>TURN_WITH_BALL+TURN_WITH_BALL_EDGE*controlEdge(p);

/** While setting the ball for a kick, how far (m/s) a rolling ball may be
 * from how he wants it before he spends a touch re-setting it. .35 for
 * everyone before (and for control <= 5); a good controller plays the ball
 * as it runs, up to SET_TOLERANCE_EDGE m/s more at control 10: the touch he
 * saves is a whole touch gap before the pass. */
export const SET_TOLERANCE=.35,SET_TOLERANCE_EDGE=1;
export const setTolerance=(p:{skills:{control:number}})=>SET_TOLERANCE+SET_TOLERANCE_EDGE*controlEdge(p);

/** Residual motion after absorbing a pass, not the probability of owning it.
 * A soft receiving foot dissipates energy; this is separate from kicking power.
 * These are game parameters, not measured human coefficients.
 * A good controller (controlEdge) kills a firm ball: the speed he absorbs
 * without spill rises by up to CUSHION_EDGE m/s, and what spills beyond it
 * spills less (excess slope down by up to a third). Control <= 5 unchanged,
 * so a firm ball to a poor controller still comes off his foot. */
export const CUSHION_EDGE=4,SPILL_EDGE=.35;
export function receptionResidual(p:PracticePlayer,relativeSpeed:number,stretch=0,awkward=0):number{
 const skill=clamp(p.skills.control/10,0,1),fatigue=1-clamp(p.energy/100,0,1),edge=controlEdge(p);
 const excess=Math.max(0,relativeSpeed-(8+skill*8+CUSHION_EDGE*edge)*(1-fatigue*.12));
 return clamp(.012+(1-skill)*.035+fatigue*.04+excess*.018*(1-SPILL_EDGE*edge)+stretch*.04+awkward*.025,.012,.45);
}

/** Only called at a reachable foot contact. Absorb incoming velocity relative
 * to the body, then apply a bounded directed touch. A poor contact spills away
 * from the receiving foot instead of continuing straight through the shins. */
export function cushionedVelocity(p:PracticePlayer,ball:Vec&{vx:number;vy:number},desired:Vec):Vec{
 const dx=ball.x-p.x,dy=ball.y-p.y,gap=Math.hypot(dx,dy),nx=dx/Math.max(.001,gap),ny=dy/Math.max(.001,gap);
 const rx=ball.vx-p.vx,ry=ball.vy-p.vy,speed=Math.hypot(rx,ry),normal=rx*nx+ry*ny;
 const stretch=clamp((gap-.7)/.35,0,1),awkward=1-clamp(nx*Math.cos(p.angle)+ny*Math.sin(p.angle),0,1);
 // Small impacts are inelastic: repeatedly settling a nearly stopped ball
 // must not create a sequence of tiny rebounds.
 const residual=receptionResidual(p,speed,stretch,awkward)*Math.max(0,speed-1.5)/Math.max(.001,speed);
 const tx=rx-normal*nx,ty=ry-normal*ny;
 const active={x:desired.x-p.vx,y:desired.y-p.vy},scale=Math.min(1,controlTouchBudget(p)/Math.max(.001,Math.hypot(active.x,active.y)));
 return {x:p.vx+(Math.abs(normal)*nx+tx)*residual+active.x*scale,y:p.vy+(Math.abs(normal)*ny+ty)*residual+active.y*scale};
}
