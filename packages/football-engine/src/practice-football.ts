import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec,MovingBall} from './movement.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const relative=(p:PracticePlayer,x:number)=>p.side===0?L-x:x;
const normalize=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
/** Angular size of the goal, including the acute angle beside the byline. */
export function goalAngle(p:PracticePlayer):number{
 const x=Math.max(.01,relative(p,p.x));
 return Math.abs(Math.atan2(GH-p.y,x)-Math.atan2(-GH-p.y,x));
}
/** Keep the ball and both posts in view, rather than following its lateral coordinate. */
export function keeperPosition(p:PracticePlayer,ball:Vec,closing=false):Vec{
 const bd=p.side===0?ball.x:L-ball.x;
 const advance=closing&&bd<X(23)&&Math.abs(ball.y)<Y(16)?Math.max(.8,Math.min(bd-1,clamp(10-bd*.25,2,6))):clamp(bd*.13,1,5.5);
 // A wide ball requires a shallower position: clamping y alone leaves the near post exposed.
 const depth=Math.max(.6,Math.min(advance,G(3.1)*Math.max(.5,bd)/Math.max(1,Math.abs(ball.y))));
 const y=clamp(ball.y*depth/Math.max(depth+.5,bd),-G(3.1),G(3.1));
 return {x:p.side===0?depth:L-depth,y};
}
export interface ShotAssessment {aim:Vec;distance:number;angle:number;pressure:number;deviation:number;quality:number;keeperCoverage:number}
export function assessShot(p:PracticePlayer,players:PracticePlayer[]):ShotAssessment{
 const goalX=p.side===0?L:0,distanceToGoal=Math.hypot(goalX-p.x,p.y),angle=goalAngle(p);
 const opponents=players.filter(q=>q.side!==p.side),keeper=opponents.find(q=>q.role==='GK');
 const nearest=Math.min(...opponents.filter(q=>q.role!=='GK').map(q=>distance(q,p)));
 const pressure=clamp((4-nearest)/4,0,1),running=clamp(Math.hypot(p.vx,p.vy)/p.basePace,0,1);
 // Error is angular: the same striking error spreads farther over a longer flight.
 const deviation=.045+(1-clamp(p.skills.finishing/10,0,1))*.08+(1-clamp(p.skills.control/10,0,1))*.03+pressure*.035+running*.012+(1-p.energy/100)*.015;
 let aim={x:goalX,y:0},best=-Infinity,keeperCoverage=0;
 for(const y of [-2.6,-1.3,0,1.3,2.6].map(G)){
  const dx=goalX-p.x,dy=y-p.y,d=Math.hypot(dx,dy),flight=d/(22+p.skills.finishing*.3);
  // Read the visible keeper's coverage at the shot crossing, including a
  // bounded reaction and lateral reach. This is an estimate, not a save roll.
  const k=keeper?(keeper.x-p.x)/(dx||.01):-1;
  let coverage=0;
  if(keeper&&k>=0&&k<=1){
   const crossingTime=flight*k,reaction=.2+(10-clamp(keeper.skills.reading,0,10))*.015;
   const available=Math.max(0,crossingTime-reaction);
   const lateral=keeper.y+keeper.vy*Math.min(.35,crossingTime);
   const reach=keeperReach(keeper,crossingTime)+Math.min(keeper.pace*available,.5*keeper.acceleration*available*available);
   const gap=Math.abs(p.y+dy*k-lateral);
   coverage=clamp((reach+.35-gap)/1.3,0,1);
  }
  const blocked=opponents.filter(q=>q.role!=='GK').reduce((risk,q)=>{
   const along=((q.x-p.x)*dx+(q.y-p.y)*dy)/(d*d);
   if(along<0||along>1)return risk;
   const gap=Math.hypot(q.x-p.x-dx*along,q.y-p.y-dy*along);
   return Math.max(risk,clamp((1.1-gap)/1.1,0,1));
  },0);
  const safeMargin=GH-Math.abs(y),precision=clamp(safeMargin/(deviation*d+.1),0,1);
  const value=(1-coverage)*.4+precision*.3-blocked*.7-flight*.04;
  if(value>best){best=value;aim={x:goalX,y};keeperCoverage=coverage;}
 }
 // This values the opportunity; it never decides whether the ball becomes a goal.
 const quality=clamp(angle/.6,0,1)*clamp(1-distanceToGoal/45,.05,1)*(1-pressure*.24)*(1-keeperCoverage*.75);
 return {aim,distance:distanceToGoal,angle,pressure,deviation,quality,keeperCoverage};
}
const gaussian=(random:()=>number)=>Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());
export function strikeShot(p:PracticePlayer,ball:Vec,assessment:ShotAssessment,random:()=>number):{vx:number;vy:number;vz:number}{
 const angle=Math.atan2(assessment.aim.y-ball.y,assessment.aim.x-ball.x)+gaussian(random)*assessment.deviation;
 const speed=22+p.skills.finishing*.3;
 return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:Math.max(.4,2.7+gaussian(random)*(1.0+assessment.pressure*.65))};
}
/** Hands and a timed extension; no teleporting to the destination of a shot. */
export function keeperReach(p:{skills:Pick<PracticePlayer['skills'],'reading'|'keeping'>},shotAge:number):number{
 const reaction=.2+(10-p.skills.reading)*.015;
 const extension=clamp((shotAge-reaction)/.3,0,1);
 return .85+extension*(.65+p.skills.keeping*.06);
}
export interface GoalFlight {time:number;crossing:Vec;aim:Vec}
/** Read the flight itself: an overhit pass can threaten the goal just like a shot. */
export function goalBoundFlight(keeper:Pick<PracticePlayer,'side'|'x'|'y'>,ball:MovingBall):GoalFlight|null{
 if(ball.owner)return null;
 const goalX=keeper.side===0?0:L,dx=goalX-ball.x,speed=Math.hypot(ball.vx,ball.vy);
 if(dx*ball.vx<=0||Math.abs(ball.vx)<.1||speed<1)return null;
 const path=dx/ball.vx*speed,discriminant=speed*speed-2*.65*path;
 if(discriminant<=0)return null;
 const time=(speed-Math.sqrt(discriminant))/.65,y=ball.y+ball.vy/ball.vx*dx;
 const height=Math.max(0,ball.z+ball.vz*time-4.905*time*time);
 if(Math.abs(y)>GH+1.34||height>HEIGHT+.66)return null;
 const ownDepth=keeper.side===0?keeper.x:L-keeper.x,ballDepth=keeper.side===0?ball.x:L-ball.x;
 const x=ownDepth<ballDepth-.3?keeper.x:goalX+(keeper.side===0?.3:-.3);
 return {time,crossing:{x:goalX,y},aim:{x,y:clamp(ball.y+(x-ball.x)/ball.vx*ball.vy,-7,7)}};
}
/** Stand goal-side of the receiver while keeping a route to the ball. */
export function markPosition(marker:PracticePlayer,receiver:Vec,ball:Vec,style:'balanced'|'zonal'|'tight'='balanced'):Vec{
 const goal={x:marker.side===0?0:L,y:0},toGoal=normalize(goal.x-receiver.x,goal.y-receiver.y);
 const toBall=normalize(ball.x-receiver.x,ball.y-receiver.y);
 const gap=style==='tight'?.95:1.4,screen=style==='tight'?.4:.65;
 return {x:receiver.x+toGoal.x*gap+toBall.x*screen,y:receiver.y+toGoal.y*gap+toBall.y*screen};
}

export interface PitchExit {fraction:number;x:number;y:number;endLine:boolean;z?:number}
/** The first boundary crossed, shared by carries and free-flight balls. */
export function pitchExit(from:Vec&{z?:number},to:Vec&{z?:number}):PitchExit|null{
 const candidates:PitchExit[]=[];
 for(const [axis,edge] of [['x',0],['x',L],['y',-W/2],['y',W/2]] as const){
  if((edge<=0?to[axis]>=edge:to[axis]<=edge)||to[axis]===from[axis])continue;
  const fraction=(edge-from[axis])/(to[axis]-from[axis]);
  if(fraction<0||fraction>1)continue;
  candidates.push({fraction,x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction,endLine:axis==='x',...(from.z!==undefined&&to.z!==undefined?{z:from.z+(to.z-from.z)*fraction}:{})});
 }
 return candidates.sort((a,b)=>a.fraction-b.fraction)[0]??null;
}
