import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';

// arrivalTime on its own, so a small pure module (practice-shape, and through it
// the plan board) can read it without loading the defending decisions.
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
/** Travel with the player's existing momentum, acceleration and tired pace. */
export function arrivalTime(p:PracticePlayer,point:Vec):number{
 const gap=Math.max(0,distance(p,point)-1),u=unit(point.x-p.x,point.y-p.y);
 const speed=p.pace*.94,v=clamp(p.vx*u.x+p.vy*u.y,-speed,speed),a=p.acceleration;
 const accelerate=(speed-v)/a,covered=v*accelerate+.5*a*accelerate*accelerate;
 return gap<=covered?(-v+Math.sqrt(v*v+2*a*gap))/a:accelerate+(gap-covered)/speed;
}
/** (caught kick, 2026-10-19) The same travel to within `reach` m of a point (arrivalTime is reach 1): how soon a man
 * gets within reach of a ball rather than onto a body. Kept apart from arrivalTime so that hot path is untouched. */
export function arrivalWithin(p:PracticePlayer,point:Vec,reach:number):number{
 const gap=Math.max(0,distance(p,point)-reach),u=unit(point.x-p.x,point.y-p.y);
 const speed=p.pace*.94,v=clamp(p.vx*u.x+p.vy*u.y,-speed,speed),a=p.acceleration;
 const accelerate=(speed-v)/a,covered=v*accelerate+.5*a*accelerate*accelerate;
 return gap<=covered?(-v+Math.sqrt(v*v+2*a*gap))/a:accelerate+(gap-covered)/speed;
}
