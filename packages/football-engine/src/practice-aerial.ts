import {clamp} from './model.js';
import {L,W} from './pitch.js';
import {STEP,steerMotion} from './movement.js';
import type {MovingBall,Vec} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import {PASS_DRAG,flightSamples,flightContact,advanceFlight} from './practice-flight.js';
import type {FlightSample} from './practice-flight.js';
import {jumpReach,STANDING_HEAD,airReaction} from './practice-air-duel.js';
import {WORLD} from './world.js';

export type AerialTechnique='chest'|'header'|'volley';
export const aerialContactShape={
 chest:{min:WORLD.body.aerial.aerialContactShape.chest.min.v,max:WORLD.body.aerial.aerialContactShape.chest.max.v,offset:WORLD.body.aerial.aerialContactShape.chest.offset.v,radius:WORLD.body.aerial.aerialContactShape.chest.radius.v,prepare:WORLD.body.aerial.aerialContactShape.chest.prepare.v},
 header:{min:WORLD.body.aerial.aerialContactShape.header.min.v,max:WORLD.body.aerial.aerialContactShape.header.max.v,offset:WORLD.body.aerial.aerialContactShape.header.offset.v,radius:WORLD.body.aerial.aerialContactShape.header.radius.v,prepare:WORLD.body.aerial.aerialContactShape.header.prepare.v},
 volley:{min:WORLD.body.aerial.aerialContactShape.volley.min.v,max:WORLD.body.aerial.aerialContactShape.volley.max.v,offset:WORLD.body.aerial.aerialContactShape.volley.offset.v,radius:WORLD.body.aerial.aerialContactShape.volley.radius.v,prepare:WORLD.body.aerial.aerialContactShape.volley.prepare.v},
} as const;
/** The heights this player can meet the ball at with this technique. A header can be met above standing height with
 * a jump (practice-air-duel jumpReach: contests in the air, 2026-10-15); before, every contact was a standing one. */
export function aerialBand(p:{skills:{aerial:number}},technique:AerialTechnique):{min:number;max:number}{
 const shape=aerialContactShape[technique];
 return technique==='header'?{min:shape.min,max:shape.max+jumpReach(p)}:shape;
}
export interface AerialMeeting {technique:AerialTechnique;aim:Vec;ball:FlightSample;angle:number}
export interface AerialKick {aim:Vec;vx:number;vy:number;vz:number;flight:number;difficulty:number;ability:number}
/** Added difficulty a metre of header above standing height. */
export const JUMP_DIFFICULTY=WORLD.body.aerial.JUMP_DIFFICULTY.v;
const gap=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const difference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const pitch=(v:Vec,margin=0)=>v.x>=margin&&v.x<=L-margin&&Math.abs(v.y)<=W/2-margin;

/** Open the stance to the intended next action while still watching the arrival. */
export function openAerialMeeting(meeting:AerialMeeting,aim:Vec):AerialMeeting{
 const incoming=Math.atan2(-meeting.ball.vy,-meeting.ball.vx),turn=difference(Math.atan2(aim.y-meeting.ball.y,aim.x-meeting.ball.x),incoming);
 const angle=incoming+clamp(turn,-1.05,1.05),shape=aerialContactShape[meeting.technique];
 return {...meeting,angle,aim:{x:meeting.ball.x-Math.cos(angle)*shape.offset,y:meeting.ball.y-Math.sin(angle)*shape.offset}};
}

/** No teleport or enlarged possession radius; a header may be met with a jump (aerialBand).
 * The forecast includes acceleration, braking and time to face the delivery. */
export function reachesAerialMeeting(p:PracticePlayer,meeting:AerialMeeting,reaction=0):boolean{
 const shape=aerialContactShape[meeting.technique],point=meeting.ball,aim=meeting.aim;
 if(!pitch(aim,.3)||gap(p,aim)>p.pace*point.time+.5)return false;
 const preview={...p,x:p.x+p.vx*reaction,y:p.y+p.vy*reaction};
 for(let t=reaction;t<point.time;t+=STEP)steerMotion(preview,aim,Math.min(STEP,point.time-t),p.pace);
 const turn=(3.4+p.skills.control*.12)/(1+Math.hypot(preview.vx,preview.vy)*.22);
 return gap(preview,aim)<=shape.radius&&Math.abs(difference(meeting.angle,p.angle))<=turn*point.time+.5;
}
export function aerialMeetings(p:PracticePlayer,ball:MovingBall,reaction=airReaction(p),samples:readonly FlightSample[]=flightSamples(ball,2.4,.08),prepared?:{angle:number;age:number}):AerialMeeting[]{
 if(ball.z<=.25&&ball.vz<=0)return [];
 const meetings:AerialMeeting[]=[];
 for(const technique of ['chest','header','volley'] as const){
  const shape=aerialContactShape[technique],band=aerialBand(p,technique),delay=Math.max(reaction,shape.prepare-(prepared?.age??0));
  // An opened stance can reach a contact which facing directly into the
  // incoming flight cannot. Rechecks retain time already spent preparing.
  for(const opening of technique==='chest'?[0]:[0,-1.05,1.05])for(const point of samples){
   if(point.time<delay||point.z<band.min||point.z>band.max||point.vz>1||!pitch(point,.15))continue;
   const angle=Math.atan2(-point.vy,-point.vx)+opening,aim={x:point.x-Math.cos(angle)*shape.offset,y:point.y-Math.sin(angle)*shape.offset};
   const meeting={technique,aim,ball:point,angle};
   if(!reachesAerialMeeting(p,meeting,reaction))continue;
   meetings.push(meeting);break;
  }
 }
 return meetings;
}

/** Allocation may consider an earlier high contact if it offers control or a
 * physically possible continuation. The receiver still chooses at preparation;
 * this is reachability, not an instruction to head every reachable ball. */
export function playableAerialMeetings(p:PracticePlayer,ball:MovingBall,players:PracticePlayer[],samples?:readonly FlightSample[]):AerialMeeting[]{
 return aerialMeetings(p,ball,airReaction(p,.2),samples).filter(meeting=>{
  const incoming={...ball,...meeting.ball},future={...p,...meeting.aim,angle:meeting.angle};
  if(meeting.technique==='chest'){
   const settled={...incoming,...cushionChest(future,incoming,0,()=>.5)};advanceFlight(settled,.45);
   return pitch(settled,.1)&&gap(settled,meeting.aim)<2.7;
  }
  const targets=players.filter(q=>q.side===p.side&&q.id!==p.id).map(q=>({kind:'pass' as const,aim:{x:q.x+q.vx*.3,y:q.y+q.vy*.3}}));
  const shooting={kind:'shoot' as const,aim:{x:p.side?0:L,y:0}};
  for(const option of [...targets,shooting]){
   const opened=openAerialMeeting(meeting,option.aim);
   if(reachesAerialMeeting(p,opened,.2)&&readAerialKick({...future,...opened.aim,angle:opened.angle},incoming,meeting.technique,option))return true;
  }
  return false;
 });
}

/** Contact the prepared body part during this tick, not a sphere around the player. */
export function aerialContact(p:PracticePlayer,previous:Vec&{angle?:number},before:MovingBall,after:MovingBall,technique:AerialTechnique,preparedFor:number):number|null{
 const shape=aerialContactShape[technique];if(preparedFor+1e-9<shape.prepare)return null;
 const startAngle=previous.angle??p.angle;
 const start={x:previous.x+Math.cos(startAngle)*shape.offset,y:previous.y+Math.sin(startAngle)*shape.offset};
 const end={x:p.x+Math.cos(p.angle)*shape.offset,y:p.y+Math.sin(p.angle)*shape.offset};
 const band=aerialBand(p,technique),at=flightContact(before,after,start,end,shape.radius,band.max,undefined,band.min);
 if(at===null)return null;
 const body={x:previous.x+(p.x-previous.x)*at,y:previous.y+(p.y-previous.y)*at};
 const point={x:before.x+(after.x-before.x)*at,y:before.y+(after.y-before.y)*at};
 if((point.x-body.x)*Math.cos(p.angle)+(point.y-body.y)*Math.sin(p.angle)<.02)return null;
 return at;
}

/** A playable outgoing flight from the actual contact height. Ability limits power;
 * incoming momentum may help a redirection but cannot fund an arbitrary reversal. */
export function readAerialKick(p:PracticePlayer,ball:MovingBall,technique:'header'|'volley',option:Pick<Option,'kind'|'aim'>):AerialKick|null{
 if(!['pass','through','loft','shoot','clear'].includes(option.kind))return null;
 const band=aerialBand(p,technique);if(ball.z<band.min||ball.z>band.max)return null;
 const dx=option.aim.x-ball.x,dy=option.aim.y-ball.y,distance=Math.hypot(dx,dy);if(distance<1)return null;
 const ux=dx/distance,uy=dy/distance,incoming=Math.hypot(ball.vx-p.vx,ball.vy-p.vy,ball.vz);
 const heading=technique==='header',accuracy=option.kind==='shoot'?p.skills.finishing:p.skills.passing;
 const ability=heading?p.skills.aerial*.75+accuracy*.25:p.skills.control*.45+accuracy*.55;
 const momentum=Math.max(0,(ball.vx-p.vx)*ux+(ball.vy-p.vy)*uy)*WORLD.ball.aerialKick.momentumShare.v;
 const maxSpeed=(heading?WORLD.ball.aerialKick.headerBase.v:WORLD.ball.aerialKick.volleyBase.v)+p.skills.strength*WORLD.ball.aerialKick.strengthPer.v+ability*WORLD.ball.aerialKick.abilityPer.v+momentum;
 const shot=option.kind==='shoot',clearing=option.kind==='clear';
 const speed=shot||clearing?maxSpeed:Math.min(maxSpeed,WORLD.ball.aerialKick.passBase.v+distance*WORLD.ball.aerialKick.passPer.v);
 const flight=distance/speed;if(flight>(heading?WORLD.ball.aerialKick.headerMaxFlight.v:WORLD.ball.aerialKick.volleyMaxFlight.v))return null;
 const targetHeight=shot?WORLD.ball.aerialKick.shotHeight.v:clearing?WORLD.ball.aerialKick.clearHeight.v:WORLD.ball.aerialKick.passHeight.v;
 const vz=(targetHeight-ball.z)/flight+WORLD.ball.flight.gravity.v*(flight-STEP)/2;
 if(Math.abs(vz)>(heading?WORLD.ball.aerialKick.headerLiftMax.v:WORLD.ball.aerialKick.volleyLiftMax.v)||Math.hypot(speed,vz)>maxSpeed*WORLD.ball.aerialKick.speedSlack.v)return null;
 const turn=Math.abs(difference(Math.atan2(dy,dx),p.angle));
 if(turn>(heading?2.7:2.25))return null;
 const horizontal=speed+PASS_DRAG*(flight-STEP)/2;
 const impulse=Math.hypot(ux*horizontal-ball.vx,uy*horizontal-ball.vy,vz-ball.vz);
 if(impulse>(heading?WORLD.ball.aerialKick.headerImpulse.v:WORLD.ball.aerialKick.volleyImpulse.v)+p.skills.strength*WORLD.ball.aerialKick.impulseStrength.v+ability*WORLD.ball.aerialKick.impulseAbility.v)return null;
 // a header met above standing height (a jump) is harder to direct
 const difficulty=clamp((incoming-WORLD.error.aerial.incomingFrom.v)/WORLD.error.aerial.incomingSpan.v+(10-ability)*WORLD.error.aerial.difficultyAbility.v+turn/Math.PI*WORLD.error.aerial.difficultyTurn.v+(shot?WORLD.error.aerial.difficultyShot.v:0)+(heading?Math.max(0,ball.z-STANDING_HEAD)*JUMP_DIFFICULTY:0),0,1);
 return {aim:{...option.aim},vx:ux*horizontal,vy:uy*horizontal,vz,flight,difficulty,ability};
}

/** Execution changes velocity at contact. It never moves the ball to the target. */
export function strikeAerial(p:PracticePlayer,ball:MovingBall,technique:'header'|'volley',plan:AerialKick,pressure:number,random:()=>number):Pick<MovingBall,'vx'|'vy'|'vz'>{
 const ability=plan.ability;
 const error=WORLD.error.aerial.base.v+Math.max(0,10-ability)*WORLD.error.aerial.ability.v+plan.difficulty*WORLD.error.aerial.difficulty.v+pressure*WORLD.error.aerial.pressure.v;
 const angle=Math.atan2(plan.vy,plan.vx)+(random()-.5)*2*error;
 const speed=Math.hypot(plan.vx,plan.vy)*(1+(random()-.5)*error*WORLD.error.aerial.paceShare.v);
 return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:plan.vz+(random()-.5)*error*WORLD.error.aerial.liftShare.v};
}

/** Absorb a chest-high ball with a bounded impulse, letting it fall for a later
 * foot touch. Poor/heavy contacts retain momentum; no possession is granted here. */
export function cushionChest(p:PracticePlayer,ball:MovingBall,pressure:number,random:()=>number):Pick<MovingBall,'vx'|'vy'|'vz'>{
 const skill=clamp((p.skills.control*WORLD.contact.chest.skillControl.v+p.skills.aerial*WORLD.contact.chest.skillAerial.v)/10,0,1);
 const budget=(WORLD.contact.chest.budgetBase.v+skill*WORLD.contact.chest.budgetSkill.v)*(1-pressure*WORLD.contact.chest.budgetPressure.v),error=(random()-.5)*(WORLD.contact.chest.errorBase.v+(1-skill)*WORLD.contact.chest.errorSkill.v+pressure*WORLD.contact.chest.errorPressure.v);
 const angle=p.angle+error,desired={x:p.vx*WORLD.contact.chest.carryShare.v+Math.cos(angle)*WORLD.contact.chest.dropSpeed.v,y:p.vy*WORLD.contact.chest.carryShare.v+Math.sin(angle)*WORLD.contact.chest.dropSpeed.v};
 const dx=desired.x-ball.vx,dy=desired.y-ball.vy,scale=Math.min(1,budget/Math.max(.001,Math.hypot(dx,dy)));
 return {vx:ball.vx+dx*scale,vy:ball.vy+dy*scale,vz:Math.min(WORLD.contact.chest.dropDown.v,ball.vz+Math.min(WORLD.contact.chest.liftCap.v,Math.max(0,-ball.vz-WORLD.contact.chest.liftFrom.v)))};
}
