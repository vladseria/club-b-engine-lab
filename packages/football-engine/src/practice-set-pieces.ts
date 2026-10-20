import * as S from './style.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Side,Tactics} from './model.js';
import type {PracticePlayer,Option} from './practice.js';
import type {Vec} from './movement.js';
import {STEP} from './movement.js';
import {PASS_DRAG} from './practice-flight.js';
import {goalAngle} from './practice-football.js';
import type {RestartInfo} from './practice-restarts.js';
import {WORLD} from './world.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(side:Side,x:number)=>side===0?x:L-x;
const gaussian=(random:()=>number)=>Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());
export interface DirectFreeKickPlan {
 aim:Vec;speed:number;vz:number;deviation:number;quality:number;blocked:number;flight:number;goalHeight:number;wallHeight:number;
}
export type FreeKickOption=Option&{freeKick?:DirectFreeKickPlan};
/** The taker's lean towards the called kind of kick (settings round,
 * 2026-10-03: 0.07 before, when the call changed about 1 kick in 25).
 * Settings-truth round (2026-10-04): since the defending-close round marks
 * every man in the box goal-side and ball-side, a ball into the box is always
 * contested, and a fixed lean no longer changed the taker's choice (Into the
 * box went into the box less often than Short). The call is the rehearsed
 * plan: he accepts the contest it asks for (FK_CONTEST of the called kick's
 * risk is not held against it: a header fought for in the box is the point
 * of Into the box), and leaving the plan for the other call's kick costs him
 * FK_PLAN_B (Short does not float it into the box because one man there is
 * free; Into the box does not tap it to the edge man). A direct shot stays
 * his own judgement under either call. */
export const FK_LEAN=S.FREE_KICK_COMMON.lean.v,FK_CONTEST=S.FREE_KICK_COMMON.contest.v,FK_PLAN_B=S.FREE_KICK_COMMON.planB.v;
/** Below this read a direct free kick is not offered as a shot at all. */
const SHOT_OPTION_QUALITY=WORLD.selection.setPieces.SHOT_OPTION_QUALITY.v;

/** An active nominated player takes precedence; otherwise technique selects the specialist.
 * A shooter is wanted only where a direct shot is genuinely on: a direct free
 * kick from which the engine's own free-kick read would offer a shot (the
 * same test and threshold as freeKickOptions), judged with the goal and the
 * keeper but before the wall forms. An indirect free kick is always a pass. */
export function chooseFreeKickTaker(players:PracticePlayer[],side:Side,spot:Vec,nominated?:string,kind:'freeKick'|'indirect'='freeKick'):PracticePlayer {
 const available=players.filter(p=>p.side===side&&p.role!=='GK');
 const named=nominated?available.find(p=>p.id===nominated||p.id===`${side}:${nominated}`):undefined;
 if(named)return named;
 if(!available.length)throw Error('Free kick needs an active outfield taker');
 const view=players.filter(q=>q.side===side||q.role==='GK');
 const shooting=kind==='freeKick'&&available.some(p=>(assessFreeKick(p,view,spot)?.quality??0)>SHOT_OPTION_QUALITY);
 const value=(p:PracticePlayer)=>p.skills.setPieces*.65+(shooting?p.skills.finishing:p.skills.passing)*.25+p.skills.control*.1;
 return available.slice().sort((a,b)=>value(b)-value(a)||distance(a,spot)-distance(b,spot)||a.id.localeCompare(b.id))[0];
}

/** The penalty taker: the plan's named taker when he is on the pitch and not the keeper (as for free kicks,
 * chooseFreeKickTaker); otherwise the outfield player with the best finishing plus set pieces. */
export function choosePenaltyTaker(players:PracticePlayer[],side:Side,nominated?:string):PracticePlayer {
 const available=players.filter(p=>p.side===side&&p.role!=='GK');
 const named=nominated?available.find(p=>p.id===nominated||p.id===`${side}:${nominated}`):undefined;
 if(named)return named;
 return available.slice().sort((a,b)=>(b.skills.finishing+b.skills.setPieces)-(a.skills.finishing+a.skills.setPieces))[0];
}

/** A stationary delivery uses both ordinary technique and dead-ball technique, without changing the player. */
export function setPiecePlayer(p:PracticePlayer):PracticePlayer {
 return {...p,skills:{...p.skills,passing:p.skills.passing*.55+p.skills.setPieces*.45,finishing:p.skills.finishing*.45+p.skills.setPieces*.55}};
}

// These equations include the live integrator's one-tick Euler correction. Horizontal
// drag is constant; vertical gravity is applied after moving the ball on each tick.
const flightTime=(length:number,speed:number)=>{
 const initial=speed+PASS_DRAG*STEP/2,remaining=initial*initial-2*PASS_DRAG*length;
 return remaining>0?2*length/(initial+Math.sqrt(remaining)):Infinity;
};
const heightAt=(vz:number,time:number)=>Math.max(0,vz*time-WORLD.ball.flight.gravity.v*time*(time-STEP)/2);

/** Compare straight, physically reachable goal trajectories; there is no invented curl. */
export function assessFreeKick(p:PracticePlayer,players:PracticePlayer[],spot:Vec=p):DirectFreeKickPlan|null {
 const goalX=p.side===0?L:0,length=distance(spot,{x:goalX,y:0}),angle=goalAngle({...p,...spot});
 if(length<WORLD.ball.freeKick.shotMin.v||length>WORLD.ball.freeKick.shotMax.v||angle<WORLD.ball.freeKick.shotAngleMin.v)return null;
 const opponents=players.filter(q=>q.side!==p.side),keeper=opponents.find(q=>q.role==='GK');
 const technique=clamp((p.skills.setPieces*.65+p.skills.finishing*.35)/10,0,1);
 const deviation=WORLD.error.freeKick.base.v+(1-technique)*WORLD.error.freeKick.technique.v+(1-p.energy/100)*WORLD.error.freeKick.tired.v;
 const power=(WORLD.ball.freeKick.powerBase.v+p.skills.strength*WORLD.ball.freeKick.powerStrength.v+p.skills.finishing*WORLD.ball.freeKick.powerFinishing.v)*(WORLD.ball.freeKick.tiredFloor.v+WORLD.ball.freeKick.tiredShare.v*p.energy/100);
 let best:DirectFreeKickPlan|null=null,bestValue=-Infinity;
 for(const y of [-2.7,-1.4,0,1.4,2.7].map(G))for(const speed of [power,power*WORLD.ball.freeKick.softShare.v]){
  const aim={x:goalX,y},dx=goalX-spot.x,dy=y-spot.y,d=Math.hypot(dx,dy),flight=flightTime(d,speed);
  const bodies=opponents.filter(q=>q.role!=='GK').map(q=>{
   const fraction=((q.x-spot.x)*dx+(q.y-spot.y)*dy)/(d*d);
   const gap=distance(q,{x:spot.x+dx*fraction,y:spot.y+dy*fraction});
   return {fraction,gap,time:flightTime(d*fraction,speed)};
  }).filter(q=>q.fraction>0&&q.fraction<1&&q.gap<1.4);
  // A low route and a descending route compete. The latter may clear a wall at
  // the existing 1.1m body-contact height, but gives the keeper more time.
  for(const vz of [WORLD.ball.freeKick.lowLift.v,WORLD.ball.freeKick.dropArrival.v/flight+WORLD.ball.flight.gravity.v*(flight-STEP)/2]){
   const goalHeight=heightAt(vz,flight);if(goalHeight>HEIGHT-WORLD.ball.freeKick.underBar.v||vz>WORLD.ball.freeKick.liftMax.v)continue;
   let blocked=0,wallHeight=0;
   for(const q of bodies){
    const height=heightAt(vz,q.time),margin=deviation*d*q.fraction;
    const obstruction=clamp((1.1+margin-q.gap)/(1.1+margin),0,1)*clamp((1.4-height)/.3,0,1);
    blocked=Math.max(blocked,obstruction);
    if(q.fraction*d>=4&&q.fraction*d<=8)wallHeight=Math.max(wallHeight,height);
   }
   const keeperFraction=keeper?clamp((keeper.x-spot.x)/(dx||.01),0,1):1;
   const keeperGap=keeper?Math.abs(spot.y+dy*keeperFraction-keeper.y):5;
   const onTarget=clamp((GH-Math.abs(y))/(deviation*d+.1),0,1);
   const reach=keeper?.85+clamp((flight-.3)/.3,0,1)*(1.25):0;
   const keeperOpen=keeper?clamp((keeperGap-reach+1.4)/3.6,.12,1):1;
   const geometry=clamp(angle/.48,0,1)*clamp((43-length)/29,0,1);
   const quality=geometry*onTarget*(1-blocked)*(.32+.68*keeperOpen)*(.6+.4*technique);
   const value=quality-blocked*.18-flight*.012;
   if(value>bestValue){bestValue=value;best={aim,speed,vz,deviation,quality,blocked,flight,goalHeight,wallHeight};}
  }
 }
 return best;
}

/** Reuse the already-computed pass/loft forecasts; only dead-ball context changes their value. */
export function freeKickOptions(p:PracticePlayer,players:PracticePlayer[],restart:Pick<RestartInfo,'kind'|'spot'>,existing:readonly Option[],tactics?:Pick<Tactics,'setPiece'>):FreeKickOption[] {
 const precision=clamp(p.skills.setPieces/10,0,1),at=depth(p.side,restart.spot.x),wide=Math.abs(restart.spot.y)>Y(16);
 const options:FreeKickOption[]=existing.filter(o=>o.kind==='pass'||o.kind==='through'||o.kind==='loft').map(o=>{
  const length=distance(restart.spot,o.aim),risk=o.pass?.risk??o.loft?.risk??.5;
  const short=o.kind!=='loft'&&length<=16;
  const delivery=!short&&depth(p.side,o.aim.x)>X(78)&&Math.abs(o.aim.y)<Y(17);
  const shotGain=o.delivery?.shotGain??0;
  const called=S.FREE_KICK[tactics?.setPiece??'mixed'].callsShort.v&&short||S.FREE_KICK[tactics?.setPiece??'mixed'].callsDelivery.v&&delivery;
  const planB=S.FREE_KICK[tactics?.setPiece??'mixed'].callsShort.v&&delivery||S.FREE_KICK[tactics?.setPiece??'mixed'].callsDelivery.v&&short;
  const preference=called?FK_LEAN+FK_CONTEST*risk:planB?-FK_PLAN_B:0;
  const score=o.score+(short?.035:0)+(delivery?(.035+precision*.065+shotGain*.1)*(1-risk)*(wide?1.3:1):0)+preference;
  return {...o,score,reason:short?'Reia scurt spre un coleg liber, ca să construiască următoarea fază.':delivery?'Caută un coleg în fața porții, comparând culoarul cu riscul de intercepție.':o.reason};
 });
 if(restart.kind==='freeKick'){
  const plan=assessFreeKick(p,players,restart.spot);
  if(plan&&plan.quality>SHOT_OPTION_QUALITY)options.push({kind:'shoot',aim:plan.aim,score:.12+plan.quality*.93+p.traits.risk*.025-plan.blocked*.2-S.FREE_KICK[tactics?.setPiece??'mixed'].shotCost.v,freeKick:plan,
   reason:plan.wallHeight>1.1?'Încearcă poarta cu o traiectorie peste zid; compară precizia cu timpul oferit portarului.':'Vede un culoar spre poartă și încearcă direct lovitura liberă.'});
 }
 // Normal restart layout supplies a nearby outlet. Retain a legal pass if an
 // unusual live arrangement makes ordinary option filtering produce no choices.
 if(!options.length){
  const teammate=players.filter(q=>q.side===p.side&&q.id!==p.id&&depth(p.side,q.x)<=Math.max(at,(L/2))).sort((a,b)=>distance(a,restart.spot)-distance(b,restart.spot))[0];
  if(teammate)options.push({kind:'pass',target:teammate.id,aim:{x:teammate.x,y:teammate.y},score:0,reason:'Reia către un coleg aflat în spatele mingii.'});
 }
 return options;
}

/** Accuracy varies, while every result still travels through the ordinary ball physics. */
export function strikeFreeKick(p:PracticePlayer,ball:Vec,plan:DirectFreeKickPlan,random:()=>number):{vx:number;vy:number;vz:number} {
 const technique=clamp((p.skills.setPieces*.65+p.skills.finishing*.35)/10,0,1);
 const angle=Math.atan2(plan.aim.y-ball.y,plan.aim.x-ball.x)+gaussian(random)*plan.deviation;
 const speed=plan.speed*(1+(random()*2-1)*(.014+(1-technique)*.045));
 const vz=Math.max(.25,plan.vz+gaussian(random)*(.12+(1-technique)*.55));
 return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz};
}
