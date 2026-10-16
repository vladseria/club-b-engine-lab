import {clamp} from './model.js';
import type {Vec} from './movement.js';
import {misread,readNoise} from './practice-perception.js';

/** How hard to move (movement-intensity round, 2026-10-10).
 *
 * A player off the ball who is only taking up a position (support, hold,
 * show, width, track, cover) chooses how hard to go there from what he reads,
 * the way a real player jogs into shape and sprints only when the game asks
 * for it. Before this every positional move was made at full effort: steering
 * answered each re-plan of the spot with full acceleration and full braking
 * (saw-tooth speed for nearly everyone at once, evidence 2026-10-10-probe-movement).
 *
 * He picks an urgency, 0 (cruise) .. 1 (everything he has), from the situation:
 *  - defending: a spot deeper than him (he has to drop), a spot near his own
 *    goal, the ball already past him, his man running
 *    at goal, a runner going past him that is his to deal with (one of the two
 *    nearest defenders to where the run is going), and the time he has before
 *    the ball can be played into his spot;
 *  - attacking: showing for the ball, being the target of a pass the carrier is
 *    getting ready, and the time he has;
 *  - both: a spot that is itself moving quickly (he has to keep up with it).
 * At cruise he moves at CRUISE of his pace and chooses CRUISE_PUSH of his
 * acceleration (so he also brakes gently into his spot); urgency takes both
 * up to the job's own speed and his full acceleration. Pace and acceleration
 * capacity are untouched: this is how hard he chooses to move, not how fast
 * he can.
 *
 * Reading sets how well he reads it, imperfectly: the men he reads come from
 * what he saw a moment ago (the caller's sightings, later for a poor reader),
 * how quickly a run is going is read with the 'threat' read's error, and the
 * time he has with the 'trigger' read's error (a poor reader sometimes
 * thinks he has longer than he has and steps up late; sometimes the reverse).
 * The noise is the perception layer's deterministic field: no random stream.
 *
 * Pressing, challenges, runs, recoveries, intercepts, receiving and the
 * keeper never come here: they stay at full intensity. */
export const POSITIONAL_KINDS:ReadonlySet<string>=new Set(['support','hold','show','width','track','cover']);
/** Cruise: the share of his pace, and of his acceleration, he chooses when nothing calls for more. */
export const CRUISE=.5,CRUISE_PUSH=.45;
/** How quickly the ball can travel to a place once it is played (m/s), to judge the time he has. */
export const BALL_REACH=14;
/** A runner is read as going past him when, within RUN_LOOK s, he will be level with or beyond him. */
export const RUN_LOOK=.8,RUN_NEAR=14,RUN_WIDE=9;
/** How soon the next ball can be played when the carrier is not yet getting ready (s), and when it is loose or travelling. */
export const CUE_CARRY=1.5,CUE_LOOSE=.3;
/** A poor reader reads the passer getting ready this much later (s, at misread 1). */
export const CUE_LATE=.35;
/** He re-reads how hard to go this often (s), and whenever his job's kind or the side in possession changes. */
export const INTENSITY_EVERY=.1;
/** (threat round) A marker whose man he reads as a threat of THREAT_HURRY[0] goes as before; of THREAT_HURRY[1] or more, at full urgency while more than 1.5 m from his spot or while his man is moving. */
export const THREAT_HURRY:readonly [number,number]=[.12,.3];
/** (striker outlet) Attacking, moving up: the ball this far ahead of him (m) starts to hurry him, this far is everything he has. */
export const LEFT_BEHIND:readonly [number,number]=[6,14];

export interface IntensityMover extends Vec {id:string;side:number;vx:number;vy:number;pace:number;skills:{reading:number;defending:number}}
export interface IntensityMan extends Vec {id:string;vx:number;vy:number}
export interface IntensityRead {
 p:IntensityMover;aim:Vec;kind:string;defending:boolean;
 /** Depth from his own goal line (metres). */
 depth:(x:number)=>number;
 /** His own goal (centre of the line). */
 goal:Vec;
 ball:Vec;
 /** Seconds until the ball can next be played, as he reads it. */
 cue:number;
 /** He is the target of the pass the carrier is getting ready (attacking). */
 target?:boolean;
 /** The man he marks, as he sees him. */
 man?:IntensityMan;
 /** Opponents who might be running at his goal, as he sees them. */
 runners?:IntensityMan[];
 /** His defending team-mates (outfield, not him): who else could deal with a run. */
 mates?:Vec[];
 /** How fast his spot itself is moving (m/s). */
 drift:number;
 time:number;
 /** (threat round) defending: his man's threat as he reads it (practice-threat). */
 threat?:number;
}
export interface Intensity {urgency:number;why:string}
const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Speed toward `goal` (m/s, positive = at it). */
const goalward=(m:IntensityMan,goal:Vec)=>{const d=dist(m,goal)||1;return (m.vx*(goal.x-m.x)+m.vy*(goal.y-m.y))/d;};

export function offBallIntensity(r:IntensityRead):Intensity{
 const {p,aim,depth,goal}=r,cruise=p.pace*CRUISE,far=dist(p,aim);
 let urgency=0,why='cruise';
 const up=(v:number,w:string)=>{if(v>urgency){urgency=v;why=w;}};
 const runRead=(m:IntensityMan)=>goalward(m,goal)+2*misread(p,'threat')*readNoise(p,'threat',m,r.time,`run:${m.id}`);
 if(r.defending){
  const me=depth(p.x),deeper=me-depth(aim.x);
  up(clamp((deeper-1.5)/4.5,0,1),'drop');
  if(dist(aim,goal)<15&&far>2)up(.5,'near goal');
  if(depth(r.ball.x)<me-2)up(clamp((deeper+1)/3,0,1),'ball past');
  if(r.man)up(clamp((runRead(r.man)-2.5)/1.5,0,1),'man runs');
  // (threat round) his man is a threat to our goal: he gets to his tight spot with everything he has (THREAT_HURRY)
  // (on his spot, while the man moves: a tight marker moves with him at full intensity, or the man walks away from him)
  if(r.threat!==undefined)up(clamp((r.threat-THREAT_HURRY[0])/(THREAT_HURRY[1]-THREAT_HURRY[0]),0,1)*Math.max(clamp((far-.5)/1,0,1),r.man&&Math.hypot(r.man.vx,r.man.vy)>1.5?1:0),'threat');
  for(const m of r.runners??[]){
   if(m.id===r.man?.id||dist(m,p)>RUN_NEAR||Math.abs(m.y-p.y)>RUN_WIDE)continue;
   const now=depth(m.x),soon={x:m.x+m.vx*RUN_LOOK,y:m.y+m.vy*RUN_LOOK};
   if(now>me+8||now<me-10||depth(soon.x)>me+1.5)continue;
   const v=clamp((runRead(m)-2.5)/1.5,0,1);if(v<=urgency)continue;
   // his to deal with: one of the two defenders nearest where the run is going
   const mine=dist(p,soon);if((r.mates??[]).filter(q=>dist(q,soon)<mine).length>=2)continue;
   up(v,'runner past');
  }
 }else{
  if(r.kind==='show')up(.5,'show');
  // (striker outlet, 2026-10-17) left behind the play: the attack has gone on
  // ahead of him (the ball LEFT_BEHIND m and more further up than he is) and
  // his job takes him up to it. The attacking mirror of 'ball past': he gets
  // back into the move with urgency instead of strolling to the next step.
  const behind=depth(r.ball.x)-depth(p.x);
  if(depth(aim.x)>depth(p.x)+1)up(clamp((behind-LEFT_BEHIND[0])/(LEFT_BEHIND[1]-LEFT_BEHIND[0]),0,1),'left behind');
 }
 // the time he has: until the ball can be played into his spot (an attacker who is not the pass's target is one option of several)
 const time=Math.max(.4,(r.cue+dist(r.ball,aim)/BALL_REACH+(r.defending||r.target?0:.8))*(1+.4*misread(p,'trigger')*readNoise(p,'trigger',aim,r.time,'time')));
 const need=Math.max(0,far-1)/time;
 up(clamp((need-cruise)/(p.pace-cruise),0,1),'time');
 up(clamp((r.drift*1.1-cruise)/(p.pace-cruise),0,1),'keep up');
 return {urgency,why};
}
/** The speed limit and acceleration share for this urgency (the job's own limit is the ceiling). */
export function intensityLimit(limit:number,pace:number,urgency:number):number{
 const cruise=pace*CRUISE;return limit>cruise?cruise+(limit-cruise)*urgency:limit;
}
export const intensityPush=(urgency:number)=>CRUISE_PUSH+(1-CRUISE_PUSH)*urgency;
/** The perceived time until the carrier's ball can be played: the release he is getting ready (read later by a poor reader), else CUE_CARRY. */
export function readCue(reader:{id:string;side:number;skills:{reading:number;defending:number}},release:number|undefined,time:number,teammate:boolean):number{
 if(release===undefined)return CUE_CARRY;
 return Math.max(0,release-time)+(teammate?0:CUE_LATE*misread(reader,'trigger'));
}

/** A spot's own motion: its net displacement over the last DRIFT_WINDOW s (sampled every 0.1 s), so the
 * back-and-forth of successive re-plans cancels and only the way the spot is really going remains. A new kind
 * of job or a jump to a different place starts again from rest. */
export const DRIFT_WINDOW=.8;
export class SpotDrift{
 private spots=new Map<string,{kind:string;t:number[];x:number[];y:number[]}>();
 update(id:string,kind:string,aim:Vec,time:number):{x:number;y:number}{
  let s=this.spots.get(id);
  const n=s?s.t.length-1:-1;
  if(!s||s.kind!==kind||Math.hypot(aim.x-s.x[n],aim.y-s.y[n])>4||time-s.t[n]>.5){s={kind,t:[time],x:[aim.x],y:[aim.y]};this.spots.set(id,s);return {x:0,y:0};}
  if(time-s.t[n]>=.1-1e-9){s.t.push(time);s.x.push(aim.x);s.y.push(aim.y);while(s.t.length>2&&time-s.t[1]>=DRIFT_WINDOW){s.t.shift();s.x.shift();s.y.shift();}}
  const dt=time-s.t[0];if(dt<.25)return {x:0,y:0};
  return {x:(aim.x-s.x[0])/dt,y:(aim.y-s.y[0])/dt};
 }
 forget(id:string){this.spots.delete(id);}
 clear(){this.spots.clear();}
}

/** Walking to restart positions (movement-intensity round, item 2).
 *
 * While a restart is being set up, the players who hold the kick up (the taker
 * and whoever the Laws or the routine are still waiting for) go at their usual
 * speed. Everyone else is not needed quickly: he reads when the kick can come
 * (the earliest the restart may be taken, or when the last man it waits for can
 * be there, plus the moment everything must be set) and goes at the speed that
 * gets him to his spot RESTART_EARLY s before that, never slower than a walk,
 * choosing his acceleration to match. Behind schedule he speeds up again; once
 * the taker has the ball, and for a run timed to the kick, nothing changes. A
 * quick restart stays as quick as before: nobody who decides when it can be
 * taken slows down. */
export const RESTART_WALK=1.5,RESTART_EARLY=.7,RESTART_SET=.5;
/** Seconds until the kick can come: the restart's earliest time, or when the last man it waits for arrives, plus the set moment. */
export function restartKickIn(ready:number,time:number,waiting:{distance:number;speed:number}[]):number{
 let t=Math.max(0,ready-time);
 for(const w of waiting)t=Math.max(t,w.distance/Math.max(1,w.speed)+.3);
 return t+RESTART_SET;
}
/** The speed a player not needed quickly chooses towards his restart spot (never above his usual `limit`), and the urgency it amounts to (for his acceleration). */
export function restartWalk(distance:number,kickIn:number,limit:number):{speed:number;urgency:number}{
 if(limit<=RESTART_WALK)return {speed:limit,urgency:1};
 const need=Math.max(0,distance-.5)/Math.max(.3,kickIn-RESTART_EARLY);
 const speed=Math.min(limit,Math.max(RESTART_WALK,need*1.2));
 return {speed,urgency:clamp((speed-RESTART_WALK)/(limit-RESTART_WALK),0,1)};
}
