import {clamp} from './model.js';
import {L,W} from './pitch.js';
import {STEP,steerMotion} from './movement.js';
import type {MovingBall,Vec} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import {PASS_DRAG,flightSamples,flightContact,advanceFlight} from './practice-flight.js';
import type {FlightSample} from './practice-flight.js';
import {jumpReach,STANDING_HEAD,airReaction} from './practice-air-duel.js';
import {WORLD} from './world.js';
/** Hot-path aliases (engine as data W9b): world reads used inside this file's functions, read once at load. */
const BALL_AERIAL_KICK_ABILITY_PER=WORLD.ball.aerialKick.abilityPer.v;
const BALL_AERIAL_KICK_CLEAR_HEIGHT=WORLD.ball.aerialKick.clearHeight.v;
const BALL_AERIAL_KICK_HEADER_BASE=WORLD.ball.aerialKick.headerBase.v;
const BALL_AERIAL_KICK_HEADER_IMPULSE=WORLD.ball.aerialKick.headerImpulse.v;
const BALL_AERIAL_KICK_HEADER_LIFT_MAX=WORLD.ball.aerialKick.headerLiftMax.v;
const BALL_AERIAL_KICK_HEADER_MAX_FLIGHT=WORLD.ball.aerialKick.headerMaxFlight.v;
const BALL_AERIAL_KICK_IMPULSE_ABILITY=WORLD.ball.aerialKick.impulseAbility.v;
const BALL_AERIAL_KICK_IMPULSE_STRENGTH=WORLD.ball.aerialKick.impulseStrength.v;
const BALL_AERIAL_KICK_MOMENTUM_SHARE=WORLD.ball.aerialKick.momentumShare.v;
const BALL_AERIAL_KICK_PASS_BASE=WORLD.ball.aerialKick.passBase.v;
const BALL_AERIAL_KICK_PASS_HEIGHT=WORLD.ball.aerialKick.passHeight.v;
const BALL_AERIAL_KICK_PASS_PER=WORLD.ball.aerialKick.passPer.v;
const BALL_AERIAL_KICK_SHOT_HEIGHT=WORLD.ball.aerialKick.shotHeight.v;
const BALL_AERIAL_KICK_SPEED_SLACK=WORLD.ball.aerialKick.speedSlack.v;
const BALL_AERIAL_KICK_STRENGTH_PER=WORLD.ball.aerialKick.strengthPer.v;
const BALL_AERIAL_KICK_VOLLEY_BASE=WORLD.ball.aerialKick.volleyBase.v;
const BALL_AERIAL_KICK_VOLLEY_IMPULSE=WORLD.ball.aerialKick.volleyImpulse.v;
const BALL_AERIAL_KICK_VOLLEY_LIFT_MAX=WORLD.ball.aerialKick.volleyLiftMax.v;
const BALL_AERIAL_KICK_VOLLEY_MAX_FLIGHT=WORLD.ball.aerialKick.volleyMaxFlight.v;
const BALL_FLIGHT_GRAVITY=WORLD.ball.flight.gravity.v;
const CONTACT_CHEST_BUDGET_BASE=WORLD.contact.chest.budgetBase.v;
const CONTACT_CHEST_BUDGET_PRESSURE=WORLD.contact.chest.budgetPressure.v;
const CONTACT_CHEST_BUDGET_SKILL=WORLD.contact.chest.budgetSkill.v;
const CONTACT_CHEST_CARRY_SHARE=WORLD.contact.chest.carryShare.v;
const CONTACT_CHEST_DROP_DOWN=WORLD.contact.chest.dropDown.v;
const CONTACT_CHEST_DROP_SPEED=WORLD.contact.chest.dropSpeed.v;
const CONTACT_CHEST_ERROR_BASE=WORLD.contact.chest.errorBase.v;
const CONTACT_CHEST_ERROR_PRESSURE=WORLD.contact.chest.errorPressure.v;
const CONTACT_CHEST_ERROR_SKILL=WORLD.contact.chest.errorSkill.v;
const CONTACT_CHEST_LIFT_CAP=WORLD.contact.chest.liftCap.v;
const CONTACT_CHEST_LIFT_FROM=WORLD.contact.chest.liftFrom.v;
const CONTACT_CHEST_SKILL_AERIAL=WORLD.contact.chest.skillAerial.v;
const CONTACT_CHEST_SKILL_CONTROL=WORLD.contact.chest.skillControl.v;
const ERROR_AERIAL_ABILITY=WORLD.error.aerial.ability.v;
const ERROR_AERIAL_BASE=WORLD.error.aerial.base.v;
const ERROR_AERIAL_DIFFICULTY=WORLD.error.aerial.difficulty.v;
const ERROR_AERIAL_DIFFICULTY_ABILITY=WORLD.error.aerial.difficultyAbility.v;
const ERROR_AERIAL_DIFFICULTY_SHOT=WORLD.error.aerial.difficultyShot.v;
const ERROR_AERIAL_DIFFICULTY_TURN=WORLD.error.aerial.difficultyTurn.v;
const ERROR_AERIAL_INCOMING_FROM=WORLD.error.aerial.incomingFrom.v;
const ERROR_AERIAL_INCOMING_SPAN=WORLD.error.aerial.incomingSpan.v;
const ERROR_AERIAL_LIFT_SHARE=WORLD.error.aerial.liftShare.v;
const ERROR_AERIAL_PACE_SHARE=WORLD.error.aerial.paceShare.v;
const ERROR_AERIAL_PRESSURE=WORLD.error.aerial.pressure.v;

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
 const momentum=Math.max(0,(ball.vx-p.vx)*ux+(ball.vy-p.vy)*uy)*BALL_AERIAL_KICK_MOMENTUM_SHARE;
 const maxSpeed=(heading?BALL_AERIAL_KICK_HEADER_BASE:BALL_AERIAL_KICK_VOLLEY_BASE)+p.skills.strength*BALL_AERIAL_KICK_STRENGTH_PER+ability*BALL_AERIAL_KICK_ABILITY_PER+momentum;
 const shot=option.kind==='shoot',clearing=option.kind==='clear';
 const speed=shot||clearing?maxSpeed:Math.min(maxSpeed,BALL_AERIAL_KICK_PASS_BASE+distance*BALL_AERIAL_KICK_PASS_PER);
 const flight=distance/speed;if(flight>(heading?BALL_AERIAL_KICK_HEADER_MAX_FLIGHT:BALL_AERIAL_KICK_VOLLEY_MAX_FLIGHT))return null;
 const targetHeight=shot?BALL_AERIAL_KICK_SHOT_HEIGHT:clearing?BALL_AERIAL_KICK_CLEAR_HEIGHT:BALL_AERIAL_KICK_PASS_HEIGHT;
 const vz=(targetHeight-ball.z)/flight+BALL_FLIGHT_GRAVITY*(flight-STEP)/2;
 if(Math.abs(vz)>(heading?BALL_AERIAL_KICK_HEADER_LIFT_MAX:BALL_AERIAL_KICK_VOLLEY_LIFT_MAX)||Math.hypot(speed,vz)>maxSpeed*BALL_AERIAL_KICK_SPEED_SLACK)return null;
 const turn=Math.abs(difference(Math.atan2(dy,dx),p.angle));
 if(turn>(heading?2.7:2.25))return null;
 const horizontal=speed+PASS_DRAG*(flight-STEP)/2;
 const impulse=Math.hypot(ux*horizontal-ball.vx,uy*horizontal-ball.vy,vz-ball.vz);
 if(impulse>(heading?BALL_AERIAL_KICK_HEADER_IMPULSE:BALL_AERIAL_KICK_VOLLEY_IMPULSE)+p.skills.strength*BALL_AERIAL_KICK_IMPULSE_STRENGTH+ability*BALL_AERIAL_KICK_IMPULSE_ABILITY)return null;
 // a header met above standing height (a jump) is harder to direct
 const difficulty=clamp((incoming-ERROR_AERIAL_INCOMING_FROM)/ERROR_AERIAL_INCOMING_SPAN+(10-ability)*ERROR_AERIAL_DIFFICULTY_ABILITY+turn/Math.PI*ERROR_AERIAL_DIFFICULTY_TURN+(shot?ERROR_AERIAL_DIFFICULTY_SHOT:0)+(heading?Math.max(0,ball.z-STANDING_HEAD)*JUMP_DIFFICULTY:0),0,1);
 return {aim:{...option.aim},vx:ux*horizontal,vy:uy*horizontal,vz,flight,difficulty,ability};
}

/** Execution changes velocity at contact. It never moves the ball to the target. */
export function strikeAerial(p:PracticePlayer,ball:MovingBall,technique:'header'|'volley',plan:AerialKick,pressure:number,random:()=>number):Pick<MovingBall,'vx'|'vy'|'vz'>{
 const ability=plan.ability;
 const error=ERROR_AERIAL_BASE+Math.max(0,10-ability)*ERROR_AERIAL_ABILITY+plan.difficulty*ERROR_AERIAL_DIFFICULTY+pressure*ERROR_AERIAL_PRESSURE;
 const angle=Math.atan2(plan.vy,plan.vx)+(random()-.5)*2*error;
 const speed=Math.hypot(plan.vx,plan.vy)*(1+(random()-.5)*error*ERROR_AERIAL_PACE_SHARE);
 return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:plan.vz+(random()-.5)*error*ERROR_AERIAL_LIFT_SHARE};
}

/** Absorb a chest-high ball with a bounded impulse, letting it fall for a later
 * foot touch. Poor/heavy contacts retain momentum; no possession is granted here. */
export function cushionChest(p:PracticePlayer,ball:MovingBall,pressure:number,random:()=>number):Pick<MovingBall,'vx'|'vy'|'vz'>{
 const skill=clamp((p.skills.control*CONTACT_CHEST_SKILL_CONTROL+p.skills.aerial*CONTACT_CHEST_SKILL_AERIAL)/10,0,1);
 const budget=(CONTACT_CHEST_BUDGET_BASE+skill*CONTACT_CHEST_BUDGET_SKILL)*(1-pressure*CONTACT_CHEST_BUDGET_PRESSURE),error=(random()-.5)*(CONTACT_CHEST_ERROR_BASE+(1-skill)*CONTACT_CHEST_ERROR_SKILL+pressure*CONTACT_CHEST_ERROR_PRESSURE);
 const angle=p.angle+error,desired={x:p.vx*CONTACT_CHEST_CARRY_SHARE+Math.cos(angle)*CONTACT_CHEST_DROP_SPEED,y:p.vy*CONTACT_CHEST_CARRY_SHARE+Math.sin(angle)*CONTACT_CHEST_DROP_SPEED};
 const dx=desired.x-ball.vx,dy=desired.y-ball.vy,scale=Math.min(1,budget/Math.max(.001,Math.hypot(dx,dy)));
 return {vx:ball.vx+dx*scale,vy:ball.vy+dy*scale,vz:Math.min(CONTACT_CHEST_DROP_DOWN,ball.vz+Math.min(CONTACT_CHEST_LIFT_CAP,Math.max(0,-ball.vz-CONTACT_CHEST_LIFT_FROM)))};
}
