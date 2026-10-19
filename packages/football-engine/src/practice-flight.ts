import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import {contact,STEP} from './movement.js';
import type {MovingBall,MovingPlayer,Vec} from './movement.js';
import {goalBoundFlight,keeperReach} from './practice-football.js';

export const PASS_DRAG=.65;
/** The comfortable arrival speed of a ground pass of this length (the passer's weighting, practice-passing). */
export const preferredArrival=(length:number)=>clamp(5.5+length*.24,6,14);
/** Honest-reads round (2026-10-10): how long a team-mate expects a ground pass
 * of this length to take, to time his run or judge his room. Before, every
 * such read assumed a ball travelling at a steady 14 + 0.5 x passing m/s
 * (17 m/s at passing 6), but a pass's speed does not depend on passing and
 * real ones decelerate: on 2bec595c open-play ground passes left the foot at
 * a median 10.6 m/s (0-6 m), 11.3 (6-10 m), 12.4 (10-14 m), 13.4 (14-18 m),
 * between the passer's measured and firm weights. EXPECTED_FIRMNESS m/s above
 * the comfortable arrival speed reproduces them within about 0.4 m/s; the
 * flight then decelerates with PASS_DRAG as the ball does. */
export const EXPECTED_FIRMNESS=3;
export function expectedPassFlight(length:number):number{
 if(length<=0)return 0;
 const arrival=preferredArrival(length)+EXPECTED_FIRMNESS,speed=Math.sqrt(arrival*arrival+2*PASS_DRAG*length);
 return 2*length/(speed+arrival);
}
/** Its mean speed over the flight, for the reads that take a steady speed (laneRisk). */
export const expectedPassSpeed=(length:number)=>length>0?length/expectedPassFlight(length):PASS_DRAG;
export interface FlightSample extends Vec {time:number;z:number;vx:number;vy:number;vz:number}
export interface FlightMeeting {aim:Vec;time:number;reachable:boolean;gap:number}
export type FlightPlayer=Omit<MovingPlayer,'side'|'role'> & Partial<Pick<MovingPlayer,'side'|'role'>> & {skills?:{reading:number;keeping:number}};

/** Mutates one free-ball tick; forecasts and the live ball share this integrator. */
export function advanceFlight(ball:MovingBall,dt=STEP):MovingBall {
 // Forecasts must integrate the same gravity, drag and bounces as live ticks.
 // One long Euler step otherwise predicts a descending pass still in the air.
 if(dt>STEP+1e-9){for(let left=dt;left>1e-9;left-=STEP)advanceFlight(ball,Math.min(STEP,left));return ball;}
 ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
 const speed=Math.hypot(ball.vx,ball.vy),factor=Math.max(0,speed-PASS_DRAG*dt)/Math.max(.001,speed);
 ball.vx*=factor;ball.vy*=factor;
 ball.z=Math.max(0,ball.z+ball.vz*dt);ball.vz-=9.81*dt;
 if(ball.z===0)ball.vz=Math.abs(ball.vz)>.8?-ball.vz*.15:0;
 return ball;
}

/** Keep regular samples and both ticks around changes in legal contact height/area. */
export function flightSamples(ball:MovingBall,horizon=4.8,interval=.12):FlightSample[] {
 const state={...ball},samples:FlightSample[]=[];
 const sample=(time:number,point:Omit<FlightSample,'time'>=state)=>{if(samples.at(-1)?.time!==time)samples.push({time,x:point.x,y:point.y,z:point.z,vx:point.vx,vy:point.vy,vz:point.vz});};
 const crosses=(a:number,b:number,edge:number)=>a!==b&&(a-edge)*(b-edge)<=0;
 const ticks=Math.max(0,Math.floor(horizon/STEP+1e-9)),spacing=Math.max(STEP,interval);
 let next=spacing;sample(0);
 for(let tick=1;tick<=ticks;tick++){
  const {x,y,z,vx,vy,vz}=state;advanceFlight(state);const time=tick*STEP;
  const contactChange=[2.3,1.95,1.5,1.42,1.1,1,.85,.28,.25].some(height=>z>height&&state.z<=height)
   ||crosses(x,state.x,BOX_DEPTH)||crosses(x,state.x,(L-BOX_DEPTH))
   ||crosses(y,state.y,-BOX_HALF)||crosses(y,state.y,BOX_HALF);
  if(contactChange)sample((tick-1)*STEP,{x,y,z,vx,vy,vz});
  if(time+1e-9>=next||tick===ticks||contactChange){sample(time);while(next<=time+1e-9)next+=spacing;}
 }
 return samples;
}

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const handsAt=(p:FlightPlayer,point:Vec)=>p.role==='GK'&&p.side!==undefined&&point.x>=0&&point.x<=L&&(p.side===0?point.x:L-point.x)<=BOX_DEPTH&&Math.abs(point.y)<=BOX_HALF;
const footReach={height:.25,radius:.75},handReach={height:2.3,radius:1.1};
const reachAt=(p:FlightPlayer,point:Vec,time=0,ball?:MovingBall)=>{
 if(!handsAt(p,point))return footReach;
 if(p.skills&&p.side!==undefined&&ball&&goalBoundFlight({x:p.x,y:p.y,side:p.side},{...ball,...point}))return {height:2.3,radius:keeperReach({skills:p.skills},time)};
 return handReach;
};
const onPitch=(p:Vec)=>p.x>=0&&p.x<=L&&Math.abs(p.y)<=W/2;

/** An optimistic distance bound only rejects impossible meetings; it never grants one. */
function travelBound(speed:number,acceleration:number,pace:number,time:number):number {
 if(speed>=pace||acceleration===0)return speed*time;
 const accelerating=Math.min(time,(pace-speed)/acceleration);
 return speed*accelerating+.5*acceleration*accelerating*accelerating+pace*(time-accelerating);
}
/** The player's real run at the point: from his reacted position, steerMotion (movement.ts) toward it each tick at his
 * pace, accelerating and braking, until the ball is there; the gap left. (engine speed, 2026-10-19) steerMotion's
 * arithmetic written out on four numbers instead of a copied player, for its call here only (no neighbours, a still
 * target, arrival radius 0.2): the same operations in the same order, so the same gap to the last bit. */
export function previewGap(p:FlightPlayer,point:FlightSample,reaction:number):number {
 const delay=Math.min(reaction,point.time),tx=point.x,ty=point.y,end=point.time,limit=p.pace,acceleration=p.acceleration;
 let x=p.x+p.vx*delay,y=p.y+p.vy*delay,vx=p.vx,vy=p.vy;
 for(let time=delay;time<end-1e-9;time+=STEP){
  const dt=Math.min(STEP,end-time);
  const dx=tx-x,dy=ty-y,distance=Math.hypot(dx,dy);
  const directionX=distance?dx/distance:0,directionY=distance?dy/distance:0;
  const speed=Math.min(limit,Math.sqrt(2*acceleration*Math.max(0,distance-.2)));
  let desiredX=0+directionX*speed,desiredY=0+directionY*speed;
  const length=Math.hypot(desiredX,desiredY);if(length>limit){desiredX*=limit/length;desiredY*=limit/length;}
  const dvx=desiredX-vx,dvy=desiredY-vy,change=Math.hypot(dvx,dvy),factor=Math.min(1,acceleration*dt/Math.max(change,.00001));
  vx+=dvx*factor;vy+=dvy*factor;x+=vx*dt;y+=vy*dt;
 }
 return Math.hypot(x-tx,y-ty);
}

function findMeeting(player:FlightPlayer,ball:MovingBall,reaction:number,samples:readonly FlightSample[],flightAge:number,needsFallback:boolean):FlightMeeting|null {
 const delay=Math.max(0,reaction),reacted={x:player.x+player.vx*delay,y:player.y+player.vy*delay};
 const speed=Math.hypot(player.vx,player.vy),acceleration=Math.max(0,player.acceleration);
 let fallback:FlightSample|undefined,fallbackBound=Infinity,fallbackPreviewGap:number|undefined;
 for(const point of samples){
  const reach=reachAt(player,point,flightAge+point.time,ball);
  if(point.time+1e-9<delay||point.z>reach.height)continue;
  const bound=Math.max(0,distance(reacted,point)-travelBound(speed,acceleration,player.pace,point.time-delay));
  const possible=onPitch(point)&&bound<=reach.radius;
  const gap=possible?previewGap(player,point,delay):bound;
  if(possible&&gap<=reach.radius)return{aim:{x:point.x,y:point.y},time:point.time,reachable:true,gap};
  if(needsFallback&&(!fallback||gap<fallbackBound)){fallback=point;fallbackBound=gap;fallbackPreviewGap=possible?gap:undefined;}
 }
 if(!needsFallback)return null;
 // Short supplied forecasts can end with the ball still above everyone. Extend only
 // the fallback to its first low tick instead of chasing a high, early position.
 if(!fallback){
  const state={...ball};let time=0;
  const fall=(Math.max(0,ball.vz)+Math.sqrt(ball.vz*ball.vz+2*9.81*Math.max(0,ball.z)))/9.81;
  const end=Math.max(delay,fall)+2;
  while(time<end){
   if(time+1e-9>=delay&&state.z<=reachAt(player,state).height){fallback={time,x:state.x,y:state.y,z:state.z,vx:state.vx,vy:state.vy,vz:state.vz};break;}
   advanceFlight(state);time+=STEP;
  }
  // Finite physical inputs always descend. Keep the final low state for degenerate
  // horizons too; reachability is never inferred from this fallback.
  fallback??={time,x:state.x,y:state.y,z:state.z,vx:state.vx,vy:state.vy,vz:state.vz};
 }
 return{aim:{x:clamp(fallback.x,0,L),y:clamp(fallback.y,-(W/2),(W/2))},time:fallback.time,reachable:false,gap:fallbackPreviewGap??previewGap(player,fallback,delay)};
}

/** Find a reachable low point using the receiver's actual acceleration and braking. */
export function flightMeeting(player:FlightPlayer,ball:MovingBall,reaction=0,samples:readonly FlightSample[]=flightSamples(ball),flightAge=0):FlightMeeting {
 return findMeeting(player,ball,reaction,samples,flightAge,true)!;
}

/** Threat scoring needs reachable contacts but never consumes an unreachable chase. */
export function reachableFlightMeeting(player:FlightPlayer,ball:MovingBall,reaction=0,samples:readonly FlightSample[]=flightSamples(ball),flightAge=0):FlightMeeting|null {
 return findMeeting(player,ball,reaction,samples,flightAge,false);
}

/** Earliest overlap of horizontal contact and legal height during a simulation tick. */
export function flightContact(ballBefore:Vec&{z:number},ballAfter:Vec&{z:number},oldP:Vec,newP:Vec,radius:number,height:number,area?:{minX:number;maxX:number;minY:number;maxY:number},minHeight=0):number|null {
 if(!area&&ballBefore.z<=height&&ballAfter.z<=height&&ballBefore.z>=minHeight&&ballAfter.z>=minHeight)return contact(ballBefore,ballAfter,oldP,newP,radius);
 if(ballBefore.z>height&&ballAfter.z>height||ballBefore.z<minHeight&&ballAfter.z<minHeight)return null;
 const sx=ballBefore.x-oldP.x,sy=ballBefore.y-oldP.y;
 const dx=ballAfter.x-newP.x-sx,dy=ballAfter.y-newP.y-sy,a=dx*dx+dy*dy,c=sx*sx+sy*sy-radius*radius;
 let entry=0,exit=1;
 if(a<1e-10){if(c>0)return null;}
 else{
  const b=sx*dx+sy*dy,discriminant=b*b-a*c;if(discriminant<0)return null;
  const root=Math.sqrt(discriminant);entry=Math.max(0,(-b-root)/a);exit=Math.min(1,(-b+root)/a);
 }
 if(ballBefore.z>height||ballAfter.z>height){
  const crossing=(height-ballBefore.z)/(ballAfter.z-ballBefore.z);
  if(ballAfter.z>ballBefore.z)exit=Math.min(exit,crossing);
  else entry=Math.max(entry,crossing);
 }
 if(ballBefore.z<minHeight||ballAfter.z<minHeight){
  const crossing=(minHeight-ballBefore.z)/(ballAfter.z-ballBefore.z);
  if(ballAfter.z>ballBefore.z)entry=Math.max(entry,crossing);
  else exit=Math.min(exit,crossing);
 }
 if(area)for(const [start,delta,min,max]of [[ballBefore.x,ballAfter.x-ballBefore.x,area.minX,area.maxX],[ballBefore.y,ballAfter.y-ballBefore.y,area.minY,area.maxY]]){
  if(Math.abs(delta)<1e-12){if(start<min||start>max)return null;}
  else{const a=(min-start)/delta,b=(max-start)/delta;entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
 }
 return entry<=exit&&entry>=0&&entry<=1?entry:null;
}

/** Descending height can make two overlapping players eligible at the same instant. */
export function compareFlightContacts(a:{t:number;gap:number;id:string},b:{t:number;gap:number;id:string}):number{
 return Math.abs(a.t-b.t)>1e-9?a.t-b.t:Math.abs(a.gap-b.gap)>1e-9?a.gap-b.gap:a.id.localeCompare(b.id);
}
