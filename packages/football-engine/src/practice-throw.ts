import {L,W,BOX_DEPTH,BOX_HALF} from './pitch.js';
import {clamp} from './model.js';
import {STEP} from './movement.js';
import type {Vec,MovingBall} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import {advanceFlight,PASS_DRAG} from './practice-flight.js';
import {arrivalTime} from './practice-defense.js';
import {WORLD} from './world.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(p:Vec):Vec=>({x:clamp(p.x,.6,L-.6),y:clamp(p.y,-W/2+.6,W/2-.6)});
const RELEASE_HEIGHT=WORLD.ball.throw.RELEASE_HEIGHT.v,RECEIVING_HEIGHT=WORLD.ball.throw.RECEIVING_HEIGHT.v;
export interface ThrowPlan {aim:Vec;flight:number;speed:number;vz:number;arrivalSpeed:number;apex:number;risk:number;reachable:boolean}

/** Solve the same discrete gravity/drag used by the live ball. The contact
 * point is at the receiver's near foot, not through his chest/body centre. */
export function planThrow(p:PracticePlayer,from:Vec,q:PracticePlayer,opponents:PracticePlayer[]=[]):ThrowPlan{
 const motion=Math.min(.35,distance(from,q)/12),future=inside({x:q.x+q.vx*motion,y:q.y+q.vy*motion});
 const length=distance(from,future),ux=(future.x-from.x)/Math.max(.001,length),uy=(future.y-from.y)/Math.max(.001,length);
 const aim=inside({x:future.x-ux*.65,y:future.y-uy*.65}),travel=distance(from,aim);
 // Game calibration: strength and fatigue constrain throwing power separately
 // from kicking power. Precision is applied only when the throw is released.
 const power=(WORLD.ball.throw.powerBase.v+clamp(p.skills.strength,0,10)*WORLD.ball.throw.powerPer.v)*(WORLD.ball.throw.tiredFloor.v+clamp(p.energy/100,0,1)*WORLD.ball.throw.tiredShare.v);
 const preferred=clamp(WORLD.ball.throw.preferredBase.v+travel*WORLD.ball.throw.preferredPer.v,WORLD.ball.throw.preferredMin.v,WORLD.ball.throw.preferredMax.v),candidates:{flight:number;speed:number;vz:number;cost:number;reachable:boolean}[]=[];
 for(let ticks=WORLD.ball.throw.minTicks.v;ticks<=WORLD.ball.throw.maxTicks.v;ticks++){
  const flight=ticks*STEP,speed=travel/flight+PASS_DRAG*(flight-STEP)/2;
  const vz=(RECEIVING_HEIGHT-RELEASE_HEIGHT)/flight+WORLD.ball.flight.gravity.v*(flight-STEP)/2,total=Math.hypot(speed,vz);
  if(vz<1)continue;
  const reachable=total<=power;
  candidates.push({flight,speed,vz,reachable,cost:Math.abs(speed-preferred)+flight*.3+Math.max(0,total-power)*20});
 }
 const reachable=candidates.filter(c=>c.reachable),best=(reachable.length?reachable:candidates).sort((a,b)=>a.cost-b.cost)[0],scale=Math.min(1,power/Math.hypot(best.speed,best.vz));
 const speed=best.speed*scale,vz=best.vz*scale,dx=aim.x-from.x,dy=aim.y-from.y,d=Math.max(.001,Math.hypot(dx,dy));
 const b:MovingBall={...from,z:RELEASE_HEIGHT,vx:dx/d*speed,vy:dy/d*speed,vz,mode:'pass',owner:null};
 let risk=0,apex=b.z;
 for(let tick=1;tick<=Math.round(best.flight/STEP);tick++){
  advanceFlight(b);apex=Math.max(apex,b.z);if(tick%3!==0&&tick<Math.round(best.flight/STEP))continue;
  const time=tick*STEP;
  for(const opponent of opponents){
   const depth=opponent.side===0?b.x:L-b.x,hands=opponent.role==='GK'&&depth<BOX_DEPTH&&Math.abs(b.y)<BOX_HALF;
   if(b.z>(hands?2.3:1.1))continue;
   risk=Math.max(risk,clamp((time+.2-arrivalTime(opponent,b))/.55,0,1));
  }
 }
 return {aim,flight:best.flight,speed,vz,arrivalSpeed:Math.max(0,speed-PASS_DRAG*best.flight),apex,risk,reachable:best.reachable};
}

/** Offer all currently available teammates. A safe nearby throw receives a
 * useful preference, while marking and actual reach can make a longer one best. */
export function throwOptions(p:PracticePlayer,from:Vec,players:PracticePlayer[],available:Option[]):Option[]{
 const opponents=players.filter(q=>q.side!==p.side);
 return players.filter(q=>q.side===p.side&&q.id!==p.id).map(q=>{
  const plan=planThrow(p,from,q,opponents),prior=available.filter(o=>o.target===q.id).sort((a,b)=>b.score-a.score)[0];
  const near=clamp((12-distance(from,q))/8,0,1),score=.25+clamp(prior?.score??.2,-.5,1)*.25+
   near*.65-plan.risk*1.25-Math.max(0,distance(from,q)-12)*.03-(plan.reachable?0:1.5);
  return {kind:'pass' as const,target:q.id,aim:plan.aim,score,throwRisk:plan.risk,reason:near>.3&&plan.risk<.4?
   'Un coleg vine aproape și oferă o aruncare scurtă pentru continuare.':'Caută un coleg disponibil; evită opțiunea scurtă dacă este închisă.'};
 }).sort((a,b)=>b.score-a.score||a.target!.localeCompare(b.target!));
}

/** A throw that leads a team-mate's run (a rehearsed throw down the line):
 * aimed at the point on his run he reaches by the time the ball comes down,
 * planned and risk-read by the same physics as any throw. The runner starts
 * from a standstill at the throw; the farthest point he still reaches in time
 * is the lead, unless a shorter one is clearly safer. Null when he cannot
 * reach any point of it in time. */
export function leadThrowOption(p:PracticePlayer,from:Vec,q:PracticePlayer,run:{aim:Vec},players:PracticePlayer[]):Option|null{
 const opponents=players.filter(o=>o.side!==p.side),length=distance(q,run.aim);
 let best:{plan:ThrowPlan;lead:Vec;value:number}|null=null;
 for(let i=0;i<=8;i++){
  const f=i/8,lead=inside({x:q.x+(run.aim.x-q.x)*f,y:q.y+(run.aim.y-q.y)*f});
  const plan=planThrow(p,from,{...q,...lead,vx:0,vy:0},opponents);
  if(!plan.reachable||arrivalTime({...q,vx:0,vy:0},plan.aim)>plan.flight)continue;
  const value=f*length*.04-plan.risk;
  if(!best||value>best.value)best={plan,lead,value};
 }
 if(!best)return null;
 const {plan,lead}=best,near=clamp((12-distance(from,lead))/8,0,1);
 return {kind:'pass',target:q.id,aim:plan.aim,throwLead:lead,score:.25+near*.65-plan.risk*1.25-Math.max(0,distance(from,lead)-12)*.03,throwRisk:plan.risk,
  reason:'Aruncă în fața colegului, pe cursa repetată: mingea cade unde ajunge el.'};
}

/** The throw changes velocity once; flight, interception and reception remain
 * ordinary physical events. Random precision/weight errors are not corrected. */
export function strikeThrow(p:PracticePlayer,from:Vec,q:PracticePlayer,pressure:number,random:()=>number,opponents:PracticePlayer[]=[]):{aim:Vec;vx:number;vy:number;vz:number;z:number;plan:ThrowPlan}{
 const plan=planThrow(p,from,q,opponents),precision=clamp(p.skills.passing/10,0,1);
 const spread=WORLD.error.throw.base.v+(1-precision)*WORLD.error.throw.precision.v+pressure*WORLD.error.throw.pressure.v;
 const aim=inside({x:plan.aim.x+(random()-.5)*spread,y:plan.aim.y+(random()-.5)*spread});
 const angle=Math.atan2(aim.y-from.y,aim.x-from.x),weight=1+(random()*2-1)*(WORLD.error.throw.weightBase.v+(1-precision)*WORLD.error.throw.weightPrecision.v+pressure*WORLD.error.throw.weightPressure.v);
 return {aim,vx:Math.cos(angle)*plan.speed*weight,vy:Math.sin(angle)*plan.speed*weight,vz:plan.vz*weight,z:RELEASE_HEIGHT,plan};
}
