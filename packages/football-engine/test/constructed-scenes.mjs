// Constructed starting situations for property tests (lane C, 2026-10-21): positions and facing only, the ball at
// its owner's foot, played on the public training path. A property test states what a player would expect from the
// situation; it does not search seeds for a moment. Side 0 attacks the goal at x = 48 (side 1 keeps it).
import {readFileSync} from 'node:fs';
import {runTraining} from '../dist/index.js';
export const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

/** poses: [[x, y, angle?] x 5 for side 0, then x 5 for side 1], numbers 1-5 in order (the keeper is 1). Angles default to
 * facing the opponents' goal. owner: [side, number] on the ball, which sits 0.62 m in front of him. */
export function constructed(poses,owner=[0,5]){
 const list=poses.map(([x,y,angle],i)=>{const side=i<5?0:1;return {side,number:i%5+1,x,y,angle:angle??(side?Math.PI:0)};});
 const p=list.find(q=>q.side===owner[0]&&q.number===owner[1]);
 return {scene:'middle',poses:list,ball:{side:owner[0],number:owner[1],x:p.x+.62*Math.cos(p.angle),y:p.y+.62*Math.sin(p.angle)}};
}
/** Plays a constructed setup for the shortest training the engine allows (10 s). */
export function play(setup,{seed=2026,seconds=10,edit,...input}={}){
 const f=structuredClone(fixture);f.seed=seed;edit?.(f);
 return runTraining({fixture:f,setup,durationSeconds:seconds,...input}).result;
}
const facing=(x,y)=>Math.atan2(-y,48-x);
/** Side 0's #5 alone 10 m out in the middle, facing goal; every defender is 9 m or more behind him. */
export const clearShot=(x=38,y=0)=>constructed([[3,0],[14,0],[22,-8],[24,8],[x,y,facing(x,y)],[47,0],[26,2],[24,-4],[20,6],[18,-3]]);
/** A top tackler (side 1's #3, Florin Paznic, defending 10) squared up to a poor carrier (side 0's #3, Crocodinho, control
 * 1) on the ball at (20, 0): 'front' 1.6 m in front of him, 'side' stepping in from his right shoulder. Everyone else is
 * 10 m or more away, so the duel is theirs. Pass `edit: mismatch` to play().*/
export const tackle=where=>constructed([[3,0],[8,0],[20,0],[10,10],[12,-10],[46,0],[34,8],where==='side'?[20.9,1.1]:[21.6,0],[34,-8],[30,0]],[0,3]);
export const mismatch=f=>{
 const c=f.teams[0].squad.find(p=>p.id==='crocodinho');Object.assign(c.skills,{control:1,strength:2,passing:1,pace:3});Object.assign(c.traits,{dribble:.9,risk:.9});
 const d=f.teams[1].squad.find(p=>p.id==='motanescu');Object.assign(d.skills,{defending:10,strength:9,pace:8,reading:9});Object.assign(d.traits,{engagement:1,discipline:.5});
};
/** Tackles that took the ball (a 'tackle' event naming the victim's balance; a ridden tackle names none, a foul is a 'foul'). */
export const wonTackles=r=>r.events.filter(e=>e.kind==='tackle'&&e.balance?.victim);
/** The same, but he has the ball with his back to goal: he turns before he can strike, so the shot is long enough in
 * preparation for the release review to look at it. */
export const turnShot=()=>constructed([[3,0],[14,0],[22,-8],[24,8],[38,0,Math.PI],[47,0],[26,2],[24,-4],[20,6],[18,-3]]);
/** Side 0's #3 near the byline at (38, -7) facing across goal; #5 unmarked in front of goal at (39, 3). */
export const squareBall=()=>constructed([[3,0],[16,0],[38,-7,Math.PI/2],[33,0],[39,3],[47,0],[30,4],[28,-6],[25,6],[22,-2]],[0,3]);
