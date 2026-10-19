import {clamp} from './model.js';
import {L,W} from './pitch.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {arrivalTime} from './practice-arrival.js';
import {sightLag,inView,lookingAt,perceive} from './practice-perception.js';
import type {Read} from './practice-perception.js';
import {expectedPassFlight,PASS_DRAG} from './practice-flight.js';

/** Reading buys an earlier start (2026-10-19).
 *
 * Before: an outfielder going for a ground pass or a loose ball started for it on the tick it left the foot, already
 * knowing its exact path (the defence's man and the receiver were given their jobs at the release, at 0.94 of their
 * pace; the 0.12 s / 0.2 s in practice.ts only switched them from that job to their own re-aim). Reading bought 0 s in
 * any race for the ball (audit 2026-10-19-engine-audits, skill-entries.md); only pace did.
 *
 * Now a ball's new path on the ground is something a player has to see or read:
 *  - SEEING IT: a ball just struck, or knocked loose (a tackle, a block, a parry, a deflection), is known to him once
 *    he has seen it travel: his sight lag on the ball (practice-perception sightLag: his reading, his legs, late if it
 *    left outside his view, a smooth individual variation; he is watching the ball, so no ball-watching term). Until
 *    then he carries on with the movement he had (`seenAt`).
 *  - READING THE SHAPE: a pass is read before it is struck, from the passer shaping to play it: the passer cue
 *    (practice-defending cueDelay, the owner's decision 3 on card B1), at his sight lag on the passer, late if the
 *    passer is outside his view (not for the man it is meant for: he is offering for it, watching the passer, and
 *    sees the ball leave the same way). The intended receiver who has read it goes for his read of where it is going
 *    the moment it leaves; the one defender who reads he can cut the line he reads (his own read of its aim, CUE_SPREAD of
 *    its length off for a player who cannot read the game) sets off into it before it leaves (`cutPoint`). A wrong read
 *    takes him the wrong way until he sees the ball; a pass that is never struck leaves him committed.
 * A poor reader picks up the shape late (after the ball has gone) and waits to see it travel; a good one is on his way
 * as it leaves. Nothing is capped and nobody's legs change: what changes is when he knows where to run.
 *
 * Balls in the air keep their own reads (their meetings already carry a reading-scaled reaction: airReaction,
 * LANE_READ.air) and keepers keep theirs (readKeeperFlight, .2 + (10 - reading) x .015 s): both unchanged. */

/** When he has seen a ball that has just set off on a new path (seconds after it did). `watching`: he has his eyes on
 * it whatever way he is running (the man a pass is meant for, below). */
export function seeingLag(p:PracticePlayer,ball:Vec,time:number,watching=false):number{
 return sightLag(p,{energy:p.energy,inView:watching||inView(p,lookingAt(p,ball),ball),watching:0,at:ball,time,salt:'ball'});
}
/** When he picks up a pass being shaped (s after the shaping began): the passer cue's own read (practice-defending
 * cueDelay), late if the passer is outside his view unless `watching`. The man a pass is meant for is watching the
 * passer: he is offering for it, and a runner checks over his shoulder; his reading still sets how soon he reads it. */
export function shapeLag(p:PracticePlayer,passer:Vec,ball:Vec,since:number,watching=false):number{
 return sightLag(p,{energy:p.energy,inView:watching||inView(p,lookingAt(p,ball),passer),watching:0,at:passer,time:since,salt:'cue'});
}

/** His read of where a pass he sees being shaped is going: the passer's real aim, off by up to `spread` of the pass's
 * length for a player who cannot read the game (the passer cue's spread). A defender reads it as a threat (reading and
 * defending, as the passer cue), the receiver as a ball coming to him (reading and passing). */
export function readAim(p:PracticePlayer,read:Read,from:Vec,aim:Vec,spread:number,since:number):Vec{
 const s=spread*Math.hypot(aim.x-from.x,aim.y-from.y);
 return {x:clamp(perceive(p,read,aim.x,s,aim,{time:since,salt:'readX'}),.5,L-.5),y:clamp(perceive(p,read,aim.y,s,aim,{time:since,salt:'readY'}),-(W/2-.5),W/2-.5)};
}

/** A defender who has read a ground pass being shaped: the first point on the line he reads (from the ball to his read
 * of its aim, at the speed such a pass is expected to travel, practice-flight expectedPassFlight) that he gets to by
 * the time the ball would, were it struck now (he cannot know when it will be), with the same tolerance and lane
 * slack as the release's read (assignFlight). Not the reception itself: the last CUT_CLEAR m before the aim are the
 * receiver's and his marker's (the passer cue's closing). Null when he reads he cannot cut it. */
export const CUT_CLEAR=1.5,CUT_TOLERANCE=.12;
export function cutPoint(p:PracticePlayer,from:Vec,aim:Vec,slack=0):{aim:Vec;time:number;margin:number}|null{
 const len=Math.hypot(aim.x-from.x,aim.y-from.y);if(len<CUT_CLEAR+1)return null;
 const flight=expectedPassFlight(len),v0=(len+PASS_DRAG/2*flight*flight)/flight,ux=(aim.x-from.x)/len,uy=(aim.y-from.y)/len;
 for(let t=.05;t<=flight+1e-9;t+=.05){
  const travel=Math.min(len,v0*t-PASS_DRAG/2*t*t);if(len-travel<CUT_CLEAR)break;
  const q={x:from.x+ux*travel,y:from.y+uy*travel};
  if(q.x<0||q.x>L||Math.abs(q.y)>W/2)break;
  const margin=t+CUT_TOLERANCE+slack-arrivalTime(p,q);
  if(margin>=0)return {aim:q,time:t,margin};
 }
 return null;
}
