import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';

export const controlTouchBudget=(p:PracticePlayer)=>(3.7+p.skills.control*.45)*(.65+clamp(p.energy/100,0,1)*.35);

/** Residual motion after absorbing a pass, not the probability of owning it.
 * A soft receiving foot dissipates energy; this is separate from kicking power.
 * These are game parameters, not measured human coefficients. */
export function receptionResidual(p:PracticePlayer,relativeSpeed:number,stretch=0,awkward=0):number{
 const skill=clamp(p.skills.control/10,0,1),fatigue=1-clamp(p.energy/100,0,1);
 const excess=Math.max(0,relativeSpeed-(8+skill*8)*(1-fatigue*.12));
 return clamp(.012+(1-skill)*.035+fatigue*.04+excess*.018+stretch*.04+awkward*.025,.012,.45);
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
