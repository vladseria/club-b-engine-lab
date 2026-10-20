import {L,W} from './pitch.js';
import {steerMotion} from './movement.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {PassRun} from './practice-passing.js';
import {WORLD} from './world.js';
/** Hot-path aliases (engine as data W9b): world reads used inside this file's functions, read once at load. */
const REACTION_PASSING_RECEIVER_REACTION=WORLD.reaction.passing.RECEIVER_REACTION.v;

export interface ReceivingSpace extends Vec {radius:number}
export interface RunMeeting {time:number;aim:Vec;body:PracticePlayer}

/** Read several possible rendezvous along a visible run. This predicts only
 * the runner's current intention, with ordinary turning and acceleration. */
export function runMeetings(player:PracticePlayer,run:PassRun,space?:ReceivingSpace):RunMeeting[]{
 const meetings:RunMeeting[]=[],body={...player,x:player.x+player.vx*REACTION_PASSING_RECEIVER_REACTION,y:player.y+player.vy*REACTION_PASSING_RECEIVER_REACTION};
 let time=REACTION_PASSING_RECEIVER_REACTION;
 for(const arrival of [.65,1,1.3,1.65,2,2.35,2.7,3.05,3.4]){
  while(time<arrival-1e-9){const dt=Math.min(.05,arrival-time);steerMotion(body,run.aim,dt,Math.min(player.pace,run.speed));time+=dt;}
  const aim={x:body.x,y:body.y};
  if(aim.x<.8||aim.x>L-.8||Math.abs(aim.y)>W/2-1)continue;
  if(space&&Math.hypot(aim.x-space.x,aim.y-space.y)>space.radius)continue;
  // Different arrival times at the same location still change weight, height
  // and the time opponents have to intercept. Keep those alternatives.
  meetings.push({time:arrival,aim,body:{...body}});
 }
 return meetings;
}
