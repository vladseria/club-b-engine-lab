import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {acuity,perceive} from './practice-perception.js';
import type {Reader} from './practice-perception.js';
import {clamp} from './model.js';
import {Vec,MovingBall,steer,steerMotion,contact,STEP} from './movement.js';
import {advanceFlight,flightContact,PASS_DRAG} from './practice-flight.js';
import type {PracticePlayer} from './practice.js';
import {bodyScreensBall} from './practice-challenge.js';
import {controlTouchBudget as touchBudget,cushionedVelocity,touchGap,bodyTurnRate,openBody,turnWithBall,setTolerance} from './practice-reception.js';
import {strikeStance,fitStrikeToStance,StrikeKind} from './practice-striking.js';
import {WORLD} from './world.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const difference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const unit=(v:Vec):Vec=>{const length=Math.hypot(v.x,v.y);return length>.001?{x:v.x/length,y:v.y/length}:{x:1,y:0};};
// Setup reach reserves time for the receiving foot to extend before contact.
// Maximum leg reach still governs actual contacts; it is not a stopping target.
const receivingSetupRadius=.72;
export type ControlFoot='left'|'right';
export interface ControlContact extends Vec {
 z?:number;technique?:import('./practice-aerial.js').AerialTechnique;
 time:number;actor:string;kind:'push'|'cut'|'settle'|'pass'|'shot'|'clearance'|'body';foot?:ControlFoot;
 incoming:Vec&{z?:number;vz?:number};outgoing:Vec&{z?:number;vz?:number};body:Vec&{angle:number};footPoint?:Vec;
}
export interface ControlFeet extends Vec {side:ControlFoot;active:boolean}
export interface TouchControl {
 owner:string;time:number;readyAt:number;feet:ControlFeet[];active:ControlFoot|null;
 intent:string;contacts:ControlContact[];lastTouch?:ControlContact;
 preciseArrival?:boolean;
 /** The pace the carrier is running with the ball at (carryPace): open
  * ground lets him knock it further ahead. Unset = close control. */
 pace?:number;
 /** (receive round) His last touch was a first touch made to set the ball for the kick he planned while it travelled
  * (cushionControl with a release intention): his next contact strikes it unless it ran clearly wrong (SET_TOUCH_SLACK). */
 setTouch:boolean;
}
/** Running with the ball. In traffic a carrier keeps it close, at about two
 * thirds of his pace; with open ground ahead he knocks it on and runs nearly
 * flat out (dribbling sprints run at roughly 85-90% of sprint speed). "Ahead"
 * is a cone around the carry direction: an opponent chasing from behind does
 * not shorten the touch unless he is at his heels. The keeper counts. */
export const CARRY_CLOSE=.68,CARRY_OPEN=.85;
/** Whether the ground ahead is open enough to knock it on is the carrier's
 * own read (R2): a confident, skilful carrier (control, dribble, reading:
 * the 'carry' read) knocks it on with ~3.3 m clear, a typical one ~3.9 m, an
 * unsure one ~4.3 m; and he judges that gap with his own error (up to
 * CARRY_SPREAD m for one who cannot read it at all). */
export const CARRY_ROOM=4,CARRY_SPREAD=2;
export function carryPace(p:Vec&{pace:number}&Reader,aim:Vec,opponents:readonly Vec[]):number{
 const dx=aim.x-p.x,dy=aim.y-p.y,len=Math.hypot(dx,dy);
 if(len<.5)return p.pace*CARRY_CLOSE;
 const ux=dx/len,uy=dy/len;let near=Infinity;
 for(const q of opponents){
  const rx=q.x-p.x,ry=q.y-p.y,along=rx*ux+ry*uy,d=Math.hypot(rx,ry);
  if(along<=0?d>2:Math.abs(rx*uy-ry*ux)>along*1.2+1.5)continue;
  near=Math.min(near,d);
 }
 const need=CARRY_ROOM*(1.25-.5*acuity(p,'carry')),seen=Number.isFinite(near)?perceive(p,'carry',near,CARRY_SPREAD,p,{salt:'room'}):near;
 return p.pace*(CARRY_CLOSE+(CARRY_OPEN-CARRY_CLOSE)*clamp((seen-need)/4,0,1));
}
export interface ControlForecast {exposure:number;peak:number;endGap:number;lost:boolean}

function neutralFoot(p:PracticePlayer,side:ControlFoot):Vec{
 const sign=side==='left'?-1:1;return {x:p.x+Math.cos(p.angle)*.16-Math.sin(p.angle)*sign*.2,y:p.y+Math.sin(p.angle)*.16+Math.cos(p.angle)*sign*.2};
}
/** Capture intention without relocating the ball or changing its momentum. */
export function captureControl(p:PracticePlayer,_ball:Vec):TouchControl{
 return {owner:p.id,time:0,readyAt:0,active:null,intent:'Ajunge la minge',contacts:[],setTouch:false,feet:(['left','right'] as const).map(side=>({side,...neutralFoot(p,side),active:false}))};
}

/** Foot access is body-relative. A ball behind the stance requires a step/turn;
 * being credited with possession is never sufficient to generate a contact. */
export function footCanReach(p:PracticePlayer,ball:Vec,side:ControlFoot):boolean{
 const dx=ball.x-p.x,dy=ball.y-p.y,front=dx*Math.cos(p.angle)+dy*Math.sin(p.angle);
 return front>=-.15&&distance(p,ball)>=.28&&distance(neutralFoot(p,side),ball)<=.88;
}
function clearKick(p:PracticePlayer,ball:Vec,direction:Vec,length=.9):boolean{
 return contact(ball,{x:ball.x+direction.x*length,y:ball.y+direction.y*length},p,p,.31)===null;
}
/** (r1 mechanics) The struck ball against the passer's own moving torso, over
 * the same 1.3 m of its path the static release check reads: his momentum
 * carries on through the strike, so a ball released just beside a body that
 * is stepping into its line meets that body (the flight's torso contact). */
export function kickClearsMovingBody(p:PracticePlayer,ball:Vec,velocity:{vx:number;vy:number}):boolean{
 const speed=Math.hypot(velocity.vx,velocity.vy);if(speed<.1)return true;
 const window=1.3/speed;
 return contact(ball,{x:ball.x+velocity.vx*window,y:ball.y+velocity.vy*window},p,{x:p.x+p.vx*window,y:p.y+p.vy*window},.31)===null;
}

/** Open the body to both the incoming ball and the intended exit. This can
 * begin while running to meet a pass, before it is within foot reach. */
export function faceControl(p:PracticePlayer,ball:Vec,aim:Vec,dt:number):number{
 const ballAngle=Math.atan2(ball.y-p.y,ball.x-p.x),routeAngle=Math.atan2(aim.y-ball.y,aim.x-ball.x);
 const open=openBody(p),desired=ballAngle+clamp(difference(routeAngle,ballAngle),-open,open);
 const turnRate=bodyTurnRate(p);
 p.angle+=clamp(difference(desired,p.angle),-turnRate*dt,turnRate*dt);
 return desired;
}

/** Move the body to play the ball: get behind its next position, or step around
 * it for a change of direction. This moves the player, never the ball. */
export function steerControl(p:PracticePlayer,ball:MovingBall,state:TouchControl,aim:Vec,opponents:PracticePlayer[],dt:number,limit=p.pace*.68,preparing=false,strikeKind:StrikeKind='pass'):void{
 const route=unit({x:aim.x-ball.x,y:aim.y-ball.y}),gap=distance(p,ball);
 const nearest=opponents.slice().sort((a,b)=>distance(a,ball)-distance(b,ball))[0];
 // Offset the approach toward the opponent, putting the body between him and
 // the future contact. The ball does not follow this safe-side preference.
 const across={x:-route.y,y:route.x},screen=nearest&&distance(nearest,ball)<3?clamp(((nearest.x-ball.x)*across.x+(nearest.y-ball.y)*across.y)*.16,-.18,.18):0;
 const future={x:ball.x+ball.vx*.12,y:ball.y+ball.vy*.12};
 let target={x:future.x-route.x*.62+across.x*screen,y:future.y-route.y*.62+across.y*screen};
 const inBounds=(v:Vec)=>v.x>=.3&&v.x<=L-.3&&Math.abs(v.y)<=W/2-.3;
 if(preparing&&!inBounds(target)){
  // The ideal stance may lie outside the pitch. Compare real side-foot
  // stances around the ball instead of clamping the ideal into a blocked one.
  const stances=Array.from({length:24},(_,i)=>{
   const a=i*Math.PI/12,point={x:future.x+Math.cos(a)*.65,y:future.y+Math.sin(a)*.65};
   const incoming=Math.atan2(future.y-point.y,future.x-point.x),open=openBody(p),angle=incoming+clamp(difference(Math.atan2(route.y,route.x),incoming),-open,open);
   return {...point,angle};
  }).filter(stance=>inBounds(stance)&&controlReleaseAvailable({...p,...stance},future,aim));
  stances.sort((a,b)=>distance(p,a)-distance(p,b));if(stances[0])target=stances[0];
 }
 const crossing=contact(p,target,ball,ball,.46);
 if(crossing!==null){
  const start=Math.atan2(p.y-ball.y,p.x-ball.x),end=Math.atan2(target.y-ball.y,target.x-ball.x),turn=clamp(difference(end,start),-.65,.65),radius=Math.max(.62,Math.min(1,gap));
  target={x:future.x+Math.cos(start+turn)*radius,y:future.y+Math.sin(start+turn)*radius};
  if(!inBounds(target))target={x:future.x+Math.cos(start-Math.sign(turn)*.65)*radius,y:future.y+Math.sin(start-Math.sign(turn)*.65)*radius};
 }
 const routeAngle=Math.atan2(route.y,route.x),desired=faceControl(p,ball,aim,dt),speed=Math.hypot(p.vx,p.vy);
 const turning=Math.abs(difference(routeAngle,p.angle))>1.1;
 // Preparing a kick is not a universal walking-speed cap. Catch up with a
 // rolling first touch, then brake when the next contact is actually reachable.
 const receivingPace=Math.max(1.8,Math.hypot(ball.vx,ball.vy)+Math.max(0,gap-.65)*2);
 let maxSpeed=preparing?Math.min(limit,receivingPace):turning?Math.min(limit,turnWithBall(p)):limit;
 // A heavy touch is still a ball to reach. The ordinary carrying/turning pace
 // must not prevent a physically possible recovery until ownership is lost.
 const separating=((ball.vx-p.vx)*(ball.x-p.x)+(ball.vy-p.vy)*(ball.y-p.y))/Math.max(.001,gap);
 if(gap>.85||separating>.2&&gap+separating*Math.max(.12,state.readyAt-state.time)>.85)
  maxSpeed=p.pace;
 if(preparing){
  // A usable receiving stance is an area, not an exact point behind the ball.
  // Brake once the next touch stays accessible from the stopping position;
  // otherwise chasing that moving point continually feeds body speed into it.
  const brakingTime=speed/Math.max(.001,p.acceleration),stopped={...p,x:p.x+p.vx*brakingTime*.5,y:p.y+p.vy*brakingTime*.5};
  const nextBall={...ball};advanceFlight(nextBall,Math.max(brakingTime,state.readyAt-state.time,.12));
  const canFaceRelease=strikeStance({...p,angle:desired},nextBall,aim,strikeKind).available;
  // An incoming pass needs room to prepare the foot. Braking at maximum
  // extension can leave the ball briefly reachable but no foot ready there.
  const receivingSetup=ball.owner===p.id||distance(stopped,nextBall)<=receivingSetupRadius;
  if(canFaceRelease&&receivingSetup&&Math.hypot(ball.vx,ball.vy)<=touchBudget(p)&&controlReleaseAvailable(stopped,nextBall,aim)){target={x:p.x,y:p.y};maxSpeed=0;}
  // A moving player with the ball already at the striking foot can play it
  // sideways now. Do not accelerate around it to reach an ideal forward stance.
  if(controlStrikeReady(p,ball,state,aim,strikeKind)&&Math.hypot(ball.vx-p.vx,ball.vy-p.vy)<2.5){target={x:p.x,y:p.y};maxSpeed=0;}
 }
 // Brake toward a nearby boundary while preserving movement along it and
 // back into the pitch. Stopping the whole player here can strand a safe ball.
 const targetVelocity={x:ball.vx*.85,y:ball.vy*.85};
 const stoppingTime=speed/Math.max(.001,p.acceleration);
 const stop={x:p.x+p.vx*stoppingTime*.5,y:p.y+p.vy*stoppingTime*.5};
 // Do not match a ball's outward-running velocity while trying to brake for
 // it. Approach the contact point instead, retaining finite acceleration.
 if(stop.x<.9||stop.x>L-.9||Math.abs(stop.y)>W/2-.9){targetVelocity.x=0;targetVelocity.y=0;}
 // Once both body and ball are slow, an in-bounds step around the ball is
 // different from chasing it over the line. The braking guard must not lock
 // the player out of every useful striking stance beside a stationary ball.
 const repositioning=preparing&&speed<.8&&Math.hypot(ball.vx,ball.vy)<.6&&gap<1.2;
 if(!repositioning){
  if(stop.x<.9){target.x=Math.max(target.x,p.x);}
  if(stop.x>L-.9){target.x=Math.min(target.x,p.x);}
  if(stop.y<-W/2+.9){target.y=Math.max(target.y,p.y);}
  if(stop.y>W/2-.9){target.y=Math.min(target.y,p.y);}
 }
 target={x:clamp(target.x,.3,(L-.3)),y:clamp(target.y,-(W/2-0.3),(W/2-0.3))};
 // The receiving point moves with the ball. Treating it as stationary makes
 // the player brake short forever; maxSpeed=0 above still plants a usable foot.
 // Positional arrival is not physical readiness. If body and ball have stopped
 // inside the ordinary 20 cm arrival area but the kick is still blocked by our
 // own body, finish the step. Retain that correction while stepping so the
 // first small movement does not switch it off again. Moving approaches keep
 // their normal tolerance; a moving ball or usable stance ends the correction.
 // Do not add a second positional dead zone here: even 2 cm can leave a
 // side-foot exit intersecting the body near a touchline.
 const canRelease=controlReleaseAvailable(p,ball,aim),ballStopped=Math.hypot(ball.vx,ball.vy)<.1;
 if(!preparing||canRelease||!ballStopped)state.preciseArrival=false;
 else if(speed<.1&&distance(p,target)<=.2)state.preciseArrival=true;
 const arrivalRadius=state.preciseArrival?0:.2;
 steerMotion(p,target,dt,maxSpeed,[p,...opponents],targetVelocity,arrivalRadius);
 state.intent=preparing?'Așază piciorul pentru pasă':gap>1.05?'Ajunge la minge':turning?'Își mută corpul pentru întoarcere':'Conduce prin atingeri';
}

/** A short movement preview checks whether another foot contact is possible
 * before the touch leaves the pitch. It never grants that contact in play. */
function recoverableTouch(p:PracticePlayer,ball:MovingBall,aim:Vec):boolean{
 const runner={...p},flight={...ball},state=captureControl(runner,flight),wait=touchGap(p);
 state.readyAt=wait;
 for(let t=0;t<1.2;t+=.06){
  steerControl(runner,flight,state,aim,[],.06);
  advanceFlight(flight,.06);state.time=t+.06;
  if(flight.x<0||flight.x>L||Math.abs(flight.y)>W/2)return false;
  // Reserve room for the foot to move into contact; maximum leg extension
  // alone is too optimistic for a runner chasing a ball at similar speed.
  if(state.time>=wait&&distance(runner,flight)<.8&&(footCanReach(runner,flight,'left')||footCanReach(runner,flight,'right')))return true;
 }
 return false;
}

/** How much of a run the body brakes out of that a set touch hands the ball:
 * just enough that it stops where he does (a rolling ball stops over
 * v^2/2*PASS_DRAG, a braking body over v^2/2*acceleration). */
const brakedShare=(p:PracticePlayer)=>Math.sqrt(PASS_DRAG/Math.max(PASS_DRAG,p.acceleration));
/** The part of the body's running a carrying touch may hand on to the ball: a
 * touch meant to take the ball towards `route` never keeps the body's
 * momentum away from it. A player running the wrong way stops the ball on
 * that axis (a sole, a drag-back) rather than sending it on with him; running
 * with or across the route is kept, so a touch still travels with the runner.
 * (Leaving some of the wrong-way run on the ball, as a set touch does, only
 * works for a player who brakes to strike; a carrier keeps running and keeps
 * feeding it.) */
function runningWith(p:PracticePlayer,route:Vec):Vec{
 const along=p.vx*route.x+p.vy*route.y;
 return along<0?{x:p.vx-along*route.x,y:p.vy-along*route.y}:{x:p.vx,y:p.vy};
}
/** A settling touch is a choice too. Near a line, compare attainable touches
 * while the receiver brakes. Never save the ball by clipping its position or
 * directing it through the receiver's body. Difficult contacts can still spill. */
function settlingVelocity(p:PracticePlayer,ball:MovingBall,aim:Vec,opponents:PracticePlayer[],use:'receive'|'carry'|'set'='receive'):Vec{
 // A plain reception (no intention yet) travels with the runner. Setting the
 // ball for a kick keeps the running that goes towards where it will be
 // played; the rest of his run he brakes, so the ball gets only what makes it
 // stop where he does (brakedShare). Handing it his full running speed sent
 // it on over the byline; killing it dead left it behind him. A settle while
 // carrying brakes only the running away from his aim (runningWith).
 const route=unit({x:aim.x-ball.x,y:aim.y-ball.y}),along=Math.max(0,p.vx*route.x+p.vy*route.y);
 const forward={x:route.x*along,y:route.y*along},braked=brakedShare(p);
 const setting=use==='set';
 const ordinary=setting?{x:forward.x+(p.vx-forward.x)*braked,y:forward.y+(p.vy-forward.y)*braked}:use==='carry'?runningWith(p,route):{x:p.vx,y:p.vy},speed=Math.hypot(p.vx,p.vy);
 const horizon=Math.max(touchGap(p)+.12,Math.min(.8,speed/Math.max(.001,p.acceleration)));
 // Where the touch and the braking body go over the next moments: in play,
 // not through the body or an opponent, and still within reach.
 const trial=(velocity:Vec)=>{
  const v=cushionedVelocity(p,ball,velocity),flight={...ball,vx:v.x,vy:v.y};
  let body:Vec={x:p.x,y:p.y};
  for(let elapsed=0;elapsed<horizon-1e-8;){
   const dt=Math.min(.04,horizon-elapsed),before={...flight},old=body;
   elapsed+=dt;advanceFlight(flight,dt);
   const brakeTime=Math.min(elapsed,speed/Math.max(.001,p.acceleration));
   const travel=speed?brakeTime-p.acceleration*brakeTime*brakeTime/(2*speed):0;
   body={x:p.x+p.vx*travel,y:p.y+p.vy*travel};
   if(flight.x<.1||flight.x>L-.1||Math.abs(flight.y)>W/2-.1||contact(before,flight,old,body,.33)!==null||opponents.some(d=>contact(before,flight,{x:d.x+d.vx*(elapsed-dt),y:d.y+d.vy*(elapsed-dt)},{x:d.x+d.vx*elapsed,y:d.y+d.vy*elapsed},.33)!==null))return null;
  }
  return distance(body,flight)>2.6?null:{body,flight};
 };
 const outgoing=cushionedVelocity(p,ball,ordinary),end={...ball,vx:outgoing.x,vy:outgoing.y};advanceFlight(end,horizon);
 // A ball set short of a body still braking into it would be kicked on by
 // the shins; that settle is compared with the others like a touch near a line.
 if(end.x>=.15&&end.x<=L-.15&&Math.abs(end.y)<=W/2-.15&&(!setting||trial(ordinary)))return ordinary;
 const candidates:Vec[]=[{x:0,y:0},{x:p.vx*.5,y:p.vy*.5}];
 for(const pace of [2,4,6])for(let turn=0;turn<8;turn++){
  const angle=Math.atan2(route.y,route.x)+turn*Math.PI/4;
  candidates.push({x:Math.cos(angle)*pace,y:Math.sin(angle)*pace});
 }
 let best:Vec|undefined,bestScore=Infinity;
 for(const velocity of candidates){
  const t=trial(velocity);if(!t)continue;
  const score=distance(ordinary,cushionedVelocity(p,ball,velocity))*.15+distance(t.body,t.flight)+(distance(t.flight,aim)-distance(ball,aim))*.25;
  if(score<bestScore){bestScore=score;best=velocity;}
 }
 return best??ordinary;
}

/** A straight impulse can cut sideways when the intended exit would go through
 * the body. Subsequent direction changes require another reachable touch. */
function touchVelocity(p:PracticePlayer,ball:MovingBall,aim:Vec,opponents:PracticePlayer[],preparing:boolean,cushion=false,carry=p.pace*CARRY_CLOSE):{velocity:Vec;kind:'push'|'cut'|'settle'}{
 // Cushion relative to the moving receiver. Stopping the ball in world space
 // while the body is still advancing drives it into the player's own shins.
 const outward=unit({x:ball.x-p.x,y:ball.y-p.y});
 // Cushion in the runner's frame. A preparation touch cannot plant the ball
 // in world space while the body still needs several strides to brake.
 const settle=()=>({velocity:settlingVelocity(p,ball,aim,opponents,preparing?'set':'carry'),kind:'settle' as const});
 if(preparing)return settle();
 const route=unit({x:aim.x-ball.x,y:aim.y-ball.y});
 const body=runningWith(p,route);
 const velocityFor=(direction:Vec,kind:'push'|'cut')=>{
  const projected=Math.max(0,p.vx*direction.x+p.vy*direction.y),speed=kind==='cut'?1.35:Math.min(Math.max(p.pace*.7,carry*(.7/CARRY_CLOSE)),Math.max(1.6,projected+1.25));
  const velocity=kind==='cut'?{x:body.x+direction.x*speed,y:body.y+direction.y*speed}:{x:direction.x*speed,y:direction.y*speed};
  const relative=(velocity.x-p.vx)*outward.x+(velocity.y-p.vy)*outward.y;
  if(relative<0){velocity.x-=relative*outward.x;velocity.y-=relative*outward.y;}
  return velocity;
 };
 const clearUntilNextTouch=(velocity:Vec)=>{
  // Score the path of the impulse the foot can actually deliver, including a
  // defender moving across it before another touch is physically available.
  const change={x:velocity.x-ball.vx,y:velocity.y-ball.vy},factor=Math.min(1,touchBudget(p)/Math.max(.001,Math.hypot(change.x,change.y)));
  const outgoing=cushion?cushionedVelocity(p,ball,velocity):{x:ball.vx+change.x*factor,y:ball.vy+change.y*factor};
  const flight={...ball,vx:outgoing.x,vy:outgoing.y},next={...flight},horizon=touchGap(p);
  advanceFlight(next,horizon);
  return opponents.every(d=>{
   const normal=unit({x:ball.x-d.x,y:ball.y-d.y});
   if(distance(ball,d)<=.310001&&(flight.vx-d.vx)*normal.x+(flight.vy-d.vy)*normal.y>=-1e-8)return true;
   return contact(ball,next,d,{x:d.x+d.vx*horizon,y:d.y+d.vy*horizon},.31)===null;
  })&&recoverableTouch(p,flight,aim);
 };
 const forward=velocityFor(route,'push');
 if(clearKick(p,ball,route)&&clearUntilNextTouch(forward))return {velocity:forward,kind:'push'};
 // Keep the same intention with a closer touch when the full push outruns
 // the player. The real contact still applies its skill and impact residual.
 const closer={x:body.x+(forward.x-body.x)*.4,y:body.y+(forward.y-body.y)*.4};
 if(clearKick(p,ball,route)&&clearUntilNextTouch(closer))return {velocity:closer,kind:'push'};
 const alternatives=[-1,1].map(sign=>unit({x:outward.x*.4-outward.y*sign,y:outward.y*.4+outward.x*sign}));
 const score=(v:Vec)=>v.x*route.x+v.y*route.y+Math.min(3,...opponents.map(d=>distance(d,{x:ball.x+v.x,y:ball.y+v.y})))*.15;
 const cut=alternatives.map(direction=>({direction,velocity:velocityFor(direction,'cut')})).filter(c=>clearUntilNextTouch(c.velocity)).sort((a,b)=>score(b.direction)-score(a.direction))[0];
 return cut?{velocity:cut.velocity,kind:'cut'}:settle();
}
function registerTouch(p:PracticePlayer,ball:MovingBall,state:TouchControl,foot:ControlFeet,velocity:Vec,kind:ControlContact['kind'],time:number,finalStrike=false):void{
 const incoming={x:ball.vx,y:ball.vy},change={x:velocity.x-ball.vx,y:velocity.y-ball.vy},amount=Math.hypot(change.x,change.y);
 const budget=finalStrike?Infinity:kind==='pass'?30:touchBudget(p),factor=Math.min(1,budget/Math.max(.001,amount));
 const outgoing=kind==='settle'&&!finalStrike?cushionedVelocity(p,ball,velocity):{x:ball.vx+change.x*factor,y:ball.vy+change.y*factor};
 ball.vx=outgoing.x;ball.vy=outgoing.y;
 const event:ControlContact={time,x:ball.x,y:ball.y,actor:p.id,kind,foot:foot.side,footPoint:{x:foot.x,y:foot.y},body:{x:p.x,y:p.y,angle:p.angle},incoming,outgoing:{x:ball.vx,y:ball.vy}};
 state.contacts.push(event);state.lastTouch=event;state.readyAt=time+touchGap(p);state.active=null;state.setTouch=false;
}

/** (engine speed, 2026-10-19) The receiving feet's look-ahead (receivingContact) forecasts the SAME ball for every
 * player in a tick: it runs once per player against the one live ball, and about nine calls in ten repeat a ball state
 * already forecast that tick. advanceFlight(copy,lead) for lead = 0, .02, .04, ... is a run of whole STEP ticks and at
 * most one shorter remainder tick, and the whole ticks are a common prefix of every lead. So each ball state's
 * forecasts are made once, extending that prefix, and every forecast is bit-identical to advanceFlight({...ball},lead):
 * the same calls on the same numbers in the same order. Keyed on the ball's six numbers (Object.is, so -0 and NaN are
 * told apart) and on each lead's own value. A returned forecast is shared: read it, never change it. */
const leads={key:[NaN,NaN,NaN,NaN,NaN,NaN],values:[] as number[],forecasts:[] as MovingBall[],base:null as MovingBall|null,whole:0};
export function leadForecast(ball:MovingBall,index:number,lead:number):MovingBall{
 const c=leads,k=c.key;
 if(!(Object.is(k[0],ball.x)&&Object.is(k[1],ball.y)&&Object.is(k[2],ball.z)&&Object.is(k[3],ball.vx)&&Object.is(k[4],ball.vy)&&Object.is(k[5],ball.vz))){
  k[0]=ball.x;k[1]=ball.y;k[2]=ball.z;k[3]=ball.vx;k[4]=ball.vy;k[5]=ball.vz;
  c.values.length=0;c.forecasts.length=0;c.base={...ball};c.whole=0;
 }
 if(index<c.forecasts.length&&Object.is(c.values[index],lead))return c.forecasts[index];
 let forecast:MovingBall;
 if(!(lead>STEP+1e-9)){forecast={...ball};advanceFlight(forecast,lead);}// advanceFlight's own single-tick branch
 else{
  // advanceFlight's loop replayed on the scalars alone: how many whole STEP ticks, then the remainder tick (if any)
  let whole=0,rest=0,partial=false;
  for(let left=lead;left>1e-9;left-=STEP){if(Math.min(STEP,left)===STEP)whole++;else{rest=left;partial=true;}}
  if(whole<c.whole){forecast={...ball};advanceFlight(forecast,lead);}// out of order: the plain call
  else{
   const base=c.base!;while(c.whole<whole){advanceFlight(base,STEP);c.whole++;}
   forecast={...base};if(partial)advanceFlight(forecast,rest);
  }
 }
 if(index===c.forecasts.length){c.values.push(lead);c.forecasts.push(forecast);}
 return forecast;
}
export interface ReceivingContact {fraction:number;foot:ControlFeet;body:PracticePlayer}
/** Off-ball feet prepare at bounded speed. Proximity alone never claims the ball.
 * The caller advances the ball once and resolves the earliest foot/hand/body hit. */
export function receivingContact(p:PracticePlayer,previous:Vec,before:MovingBall,after:MovingBall,state:TouchControl,time:number,dt:number,enabled=true,intercepting=false):ReceivingContact|null{
 state.time=time;
 // Prepare for the visible trajectory before it enters leg reach. The target is
 // body-relative and the foot still travels at finite speed; contact itself is
 // resolved against the live ball, never the forecast.
 // (marking and shape round) stepping into the opponents' pass, his feet set as a reader and a defender: the
 // better of his reading and his defending sets how early, of his control and his defending how quickly
 const horizon=.22+clamp((intercepting?Math.max(p.skills.reading,p.skills.defending):p.skills.reading)/10,0,1)*.16;
 const footSkill=intercepting?Math.max(p.skills.control,p.skills.defending):p.skills.control;
 let target:Vec|null=null;
 // (engine speed) each forecast from leadForecast (the same numbers as advanceFlight({...after},lead)), and one copy of
 // the body moved along instead of a fresh copy per lead (footCanReach reads its x, y and angle and keeps nothing)
 const future={...p};
 for(let lead=0,index=0;lead<=horizon+1e-8;lead+=.02,index++){
  const forecast=leadForecast(after,index,lead);
  future.x=p.x+p.vx*lead;future.y=p.y+p.vy*lead;
  if(forecast.z>.25||distance(future,forecast)>receivingSetupRadius)continue;
  if(!footCanReach(future,forecast,'left')&&!footCanReach(future,forecast,'right'))continue;
  target={x:p.x+forecast.x-future.x,y:p.y+forecast.y-future.y};break;
 }
 const initialBody={...p,x:previous.x,y:previous.y};
 if(!target&&before.z<=.25&&(footCanReach(initialBody,before,'left')||footCanReach(initialBody,before,'right')))target={x:p.x+before.x-previous.x,y:p.y+before.y-previous.y};
 for(const foot of state.feet){foot.x+=p.x-previous.x;foot.y+=p.y-previous.y;}
 const chosen=target?state.feet.filter(f=>footCanReach(p,target!,f.side)).sort((a,b)=>distance(a,target!)-distance(b,target!))[0]:undefined;
 let hit:ReceivingContact|null=null;
 for(const foot of state.feet){
  const old={x:foot.x-(p.x-previous.x),y:foot.y-(p.y-previous.y)};
  const aim=foot===chosen?target!:neutralFoot(p,foot.side),length=distance(foot,aim);
  const step=Math.min(1,(6+footSkill*.3)*dt/Math.max(.001,length));
  foot.x+=(aim.x-foot.x)*step;foot.y+=(aim.y-foot.y)*step;
  // A forecast may already be past the body. It must not erase contact
  // that exists at the beginning of this swept interval.
  foot.active=enabled&&time>=state.readyAt&&(foot===chosen||distance(old,before)<=.160001);
  if(!foot.active)continue;
  const fraction=flightContact(before,after,old,foot,.16,.25);if(fraction===null)continue;
  const body={...p,x:previous.x+(p.x-previous.x)*fraction,y:previous.y+(p.y-previous.y)*fraction};
  const point={x:before.x+(after.x-before.x)*fraction,y:before.y+(after.y-before.y)*fraction};
  if(!footCanReach(body,point,foot.side))continue;
  if(!hit||fraction<hit.fraction)hit={fraction,body,foot:{...foot,x:old.x+(foot.x-old.x)*fraction,y:old.y+(foot.y-old.y)*fraction}};
 }
 return hit;
}
/** Cushion at the actual meeting point without replacing incoming momentum with
 * ownership. A difficult reception can still run away on the following tick. */
export function cushionControl(ball:MovingBall,state:TouchControl,meeting:ReceivingContact,time:number,intention?:{aim:Vec;opponents:PracticePlayer[];release?:boolean}):void{
 const velocity=intention?touchVelocity(meeting.body,ball,intention.aim,intention.opponents,!!intention.release,true).velocity:settlingVelocity(meeting.body,ball,{x:ball.x+Math.cos(meeting.body.angle),y:ball.y+Math.sin(meeting.body.angle)},[]);
 registerTouch(meeting.body,ball,state,meeting.foot,velocity,'settle',time);
 state.setTouch=!!intention?.release;
 // A low descending ball is cushioned at foot height, never teleported to ground.
 if(ball.vz<0)ball.vz=-ball.vz*(1-clamp(meeting.body.skills.control/10,0,1))*.2;
}

/** The foot is on the ball within 0.16 m (the contact radius every touch is resolved at). With a float's slack: a
 * foot that has just met the ball sits exactly that far from it, and a rounding error either side decided whether a
 * receiver's first-time kick (and any kick from that contact) was available (receive round: about half the planned
 * first-time balls were refused at a foot 0.16000000000000006 m from the ball). */
const FOOT_ON_BALL=.160001;
export function controlStrikeReady(p:PracticePlayer,ball:MovingBall,state:TouchControl,aim:Vec,kind:StrikeKind='pass'):boolean{
 return ball.z<.25&&strikeStance(p,ball,aim,kind).available&&controlReleaseAvailable(p,ball,aim)&&state.feet.some(f=>footCanReach(p,ball,f.side)&&distance(f,ball)<=FOOT_ON_BALL);
}
/** Apply the already skill-adjusted pass/shot/clearance exactly once. */
export function strikeControl(p:PracticePlayer,ball:MovingBall,state:TouchControl,aim:Vec,velocity:{vx:number;vy:number;vz:number},kind:'pass'|'shot'|'clearance'):boolean{
 if(!controlStrikeReady(p,ball,state,aim,kind))return false;
 const fitted=fitStrikeToStance(p,ball,aim,velocity,kind);
 // Error may redirect the ball, but may not kick through the player's torso.
 if(!controlReleaseAvailable(p,ball,{x:ball.x+fitted.vx,y:ball.y+fitted.vy}))return false;
 // (r1 mechanics) nor into the body he is still carrying across its line: he
 // sets himself (steerControl brakes while he is ready to strike) or opens up
 // first, instead of striking a ball that meets his own torso a step later.
 if(!kickClearsMovingBody(p,ball,fitted))return false;
 const foot=state.feet.find(f=>footCanReach(p,ball,f.side)&&distance(f,ball)<=FOOT_ON_BALL)!;
 Object.assign(velocity,fitted);
 registerTouch(p,ball,state,foot,{x:velocity.vx,y:velocity.vy},kind,state.time,true);ball.vz=velocity.vz;
 return true;
}

interface BodyPath {p:PracticePlayer;old:Vec}
function bodyContact(ball:MovingBall,trial:MovingBall,bodies:BodyPath[],from:number,to:number,dt:number){
 let first:{body:BodyPath;fraction:number;at:Vec;velocity:Vec}|undefined;
 for(const body of bodies){
  const velocity={x:(body.p.x-body.old.x)/dt,y:(body.p.y-body.old.y)/dt};
  const a={x:body.old.x+(body.p.x-body.old.x)*from,y:body.old.y+(body.p.y-body.old.y)*from},b={x:body.old.x+(body.p.x-body.old.x)*to,y:body.old.y+(body.p.y-body.old.y)*to};
  const normal=unit({x:ball.x-a.x,y:ball.y-a.y});
  // Overlapping source poses may separate continuously; closing motion must
  // still collide, including at the surface immediately after a foot contact.
  if(ball.z<=1.1&&distance(ball,a)<=.310001&&(ball.vx-velocity.x)*normal.x+(ball.vy-velocity.y)*normal.y>=-1e-8)continue;
  const fraction=flightContact(ball,trial,a,b,.31,1.1);
  if(fraction!==null&&(!first||fraction<first.fraction))first={body,fraction,at:{x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction},velocity};
 }
 return first;
}
/** Sweep the remainder after a touch too: an impulse cannot skip an opponent. */
export function deflectBodyBall(ball:MovingBall,body:Vec,velocity:Vec):void{
 const normal=unit({x:ball.x-body.x,y:ball.y-body.y});
 const relative=(ball.vx-velocity.x)*normal.x+(ball.vy-velocity.y)*normal.y;
 if(relative<0){ball.vx-=1.15*relative*normal.x;ball.vy-=1.15*relative*normal.y;}
 // A descending ball glances off a shoulder/chest, rather than balancing on
 // the flat top of the simplified collision cylinder. Transfer part of the
 // downward momentum outward; this is a deflection, not a controlled receipt.
 if(ball.z>=1.1-1e-6&&ball.vz<0){
  const outward=-ball.vz*.65;
  ball.vx+=normal.x*outward;ball.vy+=normal.y*outward;ball.vz*=-.15;
 }
}
function rollWithBodies(ball:MovingBall,bodies:BodyPath[],state:TouchControl,start:number,dt:number,from=0):boolean{
 let elapsed=from,lost=false;
 for(let iteration=0;iteration<4&&elapsed<1-1e-9;iteration++){
  const remaining=dt*(1-elapsed),trial={...ball};advanceFlight(trial,remaining);
  const hit=bodyContact(ball,trial,bodies,elapsed,1,dt);
  if(!hit){Object.assign(ball,trial);break;}
  advanceFlight(ball,remaining*hit.fraction);elapsed+=(1-elapsed)*hit.fraction;
  const incoming={x:ball.vx,y:ball.vy};
  deflectBodyBall(ball,hit.at,hit.velocity);
  state.contacts.push({time:start+dt*elapsed,x:ball.x,y:ball.y,actor:hit.body.p.id,kind:'body',body:{...hit.at,angle:hit.body.p.angle},incoming,outgoing:{x:ball.vx,y:ball.vy}});
  lost ||= hit.body.p.id!==state.owner;
 }
 return lost;
}

/** Continue a free-flight contact's remaining fraction using the original body
 * paths and tick duration, so contact never advances the same interval twice. */
export function rollControlRemainder(ball:MovingBall,players:PracticePlayer[],previous:ReadonlyMap<string,Vec>,state:TouchControl,start:number,dt:number,from:number):boolean{
 return rollWithBodies(ball,players.map(p=>({p,old:previous.get(p.id)??p})),state,start,dt,from);
}

/** Independent rolling with contact events. Positions are advanced from velocity;
 * no carrier-relative anchor or opponent-driven angular repositioning exists. */
/** How much further (m/s) the ball off a planned set touch may run from how he wants it before he spends another touch
 * re-setting it: about what the best controller is allowed on any ball (SET_TOLERANCE_EDGE), since the touch was made
 * for this kick. */
export const SET_TOUCH_SLACK=1;
export function advanceControl(p:PracticePlayer,previous:Vec,ball:MovingBall,state:TouchControl,aim:Vec,opponents:PracticePlayer[],dt:number,preparing=false,allowTouches=true,oldOpponents:Vec[]=opponents):boolean{
 const start=state.time,end=start+dt,before={...ball},trial={...ball};advanceFlight(trial,dt);
 // The ball is already settled during a precision stance correction. Move
 // around it without repeatedly rolling it along with the stepping body;
 // physical ball/body collisions and the eventual strike still apply below.
 // A ball he can already strike, moving within this of how he wants it set,
 // needs no re-setting touch before the kick: a good controller strikes the
 // ball as it runs instead of setting it again (setTolerance,
 // passing-and-control round). A ball he cannot strike from where it is (his
 // body in the kick's way, out of reach) is set as before.
 const wanted=touchVelocity(p,ball,aim,opponents,preparing,false,state.pace),mismatch=Math.hypot(wanted.velocity.x-ball.vx,wanted.velocity.y-ball.vy);
 // (receive round) A first touch made to set the ball for the planned kick is the set: off it he strikes the ball as it
 // runs unless it is SET_TOUCH_SLACK m/s further from how he wants it than his ordinary tolerance. Before, the body still
 // braking after the reception made almost every set touch "wrong" by a few tenths and cost a second setting touch.
 const needTouch=!state.preciseArrival&&mismatch>.35&&!(preparing&&mismatch<=setTolerance(p)+(state.setTouch?SET_TOUCH_SLACK:0)&&controlReleaseAvailable(p,ball,aim));
 if(allowTouches&&end>=state.readyAt&&(needTouch||preparing)&&!state.active){
  state.active=state.feet.filter(f=>footCanReach(p,ball,f.side)).sort((a,b)=>distance(a,ball)-distance(b,ball))[0]?.side??null;
 }
 let footHit:{foot:ControlFeet;fraction:number;old:Vec}|undefined;
 for(const foot of state.feet){
  const old={x:foot.x,y:foot.y};foot.active=state.active===foot.side&&allowTouches&&end>=state.readyAt;
  let target=foot.active?{x:trial.x,y:trial.y}:neutralFoot(p,foot.side);
  if(foot.active&&!footCanReach(p,target,foot.side)){foot.active=false;state.active=null;target=neutralFoot(p,foot.side);}
  const length=distance(foot,target),step=Math.min(1,(6+p.skills.control*.3)*dt/Math.max(.001,length));foot.x+=(target.x-foot.x)*step;foot.y+=(target.y-foot.y)*step;
  if(foot.active&&footCanReach(p,ball,foot.side)&&needTouch&&ball.z<.25){
   const fraction=flightContact(before,trial,old,foot,.16,.25);
   if(fraction!==null&&(!footHit||fraction<footHit.fraction))footHit={foot,fraction,old};
  }
 }
 // Resolve the earliest physical contact, then sweep the remaining time again.
 const bodies=[{p,old:previous},...opponents.map((q,i)=>({p:q,old:oldOpponents[i]??q}))];
 const bodyHit=bodyContact(ball,trial,bodies,0,1,dt);
 let lost=false;
 if(footHit&&(!bodyHit||footHit.fraction<=bodyHit.fraction)){
  advanceFlight(ball,dt*footHit.fraction);
  const actualBody={...p,x:previous.x+(p.x-previous.x)*footHit.fraction,y:previous.y+(p.y-previous.y)*footHit.fraction};
  const actualFoot={...footHit.foot,x:footHit.old.x+(footHit.foot.x-footHit.old.x)*footHit.fraction,y:footHit.old.y+(footHit.foot.y-footHit.old.y)*footHit.fraction};
  if(footCanReach(actualBody,ball,actualFoot.side))registerTouch(actualBody,ball,state,actualFoot,wanted.velocity,wanted.kind,start+dt*footHit.fraction);
  lost=rollWithBodies(ball,bodies,state,start,dt,footHit.fraction);
 }else lost=rollWithBodies(ball,bodies,state,start,dt);
 state.time=end;
 if(state.owner!==p.id||distance(p,ball)>2.6||lost){ball.owner=null;ball.mode='loose';return false;}
 return true;
}

export function controlReleaseAvailable(p:PracticePlayer,ball:Vec,aim:Vec):boolean{
 return (footCanReach(p,ball,'left')||footCanReach(p,ball,'right'))&&clearKick(p,ball,unit({x:aim.x-ball.x,y:aim.y-ball.y}),1.3);
}
/** The prepared passing foot must actually have reached the ball. */
export function releaseControl(p:PracticePlayer,ball:MovingBall,state:TouchControl,aim:Vec,speed:number):boolean{
 if(ball.z>=.25||!controlReleaseAvailable(p,ball,aim))return false;
 const foot=state.feet.find(f=>footCanReach(p,ball,f.side)&&distance(f,ball)<=FOOT_ON_BALL);if(!foot)return false;
 const direction=unit({x:aim.x-ball.x,y:aim.y-ball.y});registerTouch(p,ball,state,foot,{x:direction.x*speed,y:direction.y*speed},'pass',state.time);ball.owner=null;ball.mode='pass';return true;
}

export function forecastControl(p:PracticePlayer,ball:MovingBall,opponents:PracticePlayer[],aim:Vec,horizon=.65,current?:TouchControl):ControlForecast{
 const runner=structuredClone(p),near=opponents.filter(d=>distance(d,p)<7).map(d=>structuredClone(d)),b={...ball},state=current?structuredClone(current):captureControl(runner,b);
 let sum=0,peak=0,lost=false,count=0;
 const dt=1/WORLD.clock.sim.ticksPerSecond.v;
 for(let time=0;time<horizon-1e-8;time+=dt){
  const old={x:runner.x,y:runner.y},oldOpponents=near.map(d=>({x:d.x,y:d.y}));steerControl(runner,b,state,aim,near,dt);
  for(const d of near){if(time<.18){d.x+=d.vx*dt;d.y+=d.vy*dt;}else steer(d,b,dt,d.pace*.9);}
  if(!advanceControl(runner,old,b,state,aim,near,dt,false,true,oldOpponents)){lost=true;sum+=1;peak=1;count++;break;}
  const exposure=Math.max(0,...near.map(d=>bodyScreensBall(d,runner,b)?0:clamp((1.6-distance(d,b))/1.1,0,1)));
  sum+=exposure;peak=Math.max(peak,exposure);count++;
 }
 return {exposure:lost?1:sum/Math.max(1,count),peak,endGap:Math.min(10,...near.map(d=>distance(d,b))),lost};
}
