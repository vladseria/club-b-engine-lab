import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {WORLD} from './world.js';
/** Hot-path aliases (engine as data W9b): world reads used inside this file's functions, read once at load. */
const MOTION_ARRIVAL_REACH=WORLD.motion.arrival.reach.v;
const MOTION_ARRIVAL_RUN_SHARE=WORLD.motion.arrival.runShare.v;

// arrivalTime on its own, so a small pure module (practice-shape, and through it
// the plan board) can read it without loading the defending decisions.
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
/** Travel with the player's existing momentum, acceleration and tired pace. */
export function arrivalTime(p:PracticePlayer,point:Vec):number{
 const gap=Math.max(0,distance(p,point)-MOTION_ARRIVAL_REACH),u=unit(point.x-p.x,point.y-p.y);
 const speed=p.pace*MOTION_ARRIVAL_RUN_SHARE,v=clamp(p.vx*u.x+p.vy*u.y,-speed,speed),a=p.acceleration;
 const accelerate=(speed-v)/a,covered=v*accelerate+.5*a*accelerate*accelerate;
 return gap<=covered?(-v+Math.sqrt(v*v+2*a*gap))/a:accelerate+(gap-covered)/speed;
}
