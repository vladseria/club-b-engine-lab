import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer,Option} from './practice.js';
import type {Vec} from './movement.js';
import {arrivalTime} from './practice-defense.js';
import {strikeTurnTime} from './practice-striking.js';
import {PASS_DRAG} from './practice-flight.js';
import {nerve,perceive,daring,composure} from './practice-perception.js';
import {turnoverPrice} from './practice-rest-defence.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(p:PracticePlayer,x=p.x)=>p.side===0?x:L-x;
const difference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
type LaneRisk=(from:Vec,to:Vec,opponents:PracticePlayer[],speed?:number)=>number;
export interface PossessionSafety {danger:number;pressure:number;urgency:number;contactTime:number;adventure:number}

/** Cost of losing possession here, separate from the player's appetite for risk. */
export function possessionSafety(p:PracticePlayer,players:PracticePlayer[]):PossessionSafety{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 const contactTime=Math.min(...opponents.map(q=>arrivalTime(q,p)));
 const near=Math.min(...opponents.map(q=>distance(q,p)));
 const pressure=Math.max(clamp((4-near)/4,0,1),clamp((1.2-contactTime)/1.2,0,1));
 const danger=clamp((X(48)-depth(p))/X(32),0,1)*(.6+.4*clamp((Y(28)-Math.abs(p.y))/Y(22),0,1));
 return {danger,pressure,urgency:danger*pressure,contactTime,adventure:p.traits.risk*.65+p.traits.dribble*.35};
}

export function preparationTime(p:PracticePlayer,kind:Option['kind']):number{
 return kind==='clear'?.08+(10-p.skills.control)*.01:.22+(10-p.skills.control)*.015;
}
export function releaseTime(p:PracticePlayer,aim:Vec,kind:Option['kind']):number{
 const turn=strikeTurnTime(p,aim,kind==='shoot'?'shot':kind==='clear'?'clearance':'pass');
 return Math.max(preparationTime(p,kind),turn);
}

/** Step-across round (2026-10-04): the passer's OWN read of how far an
 * opponent can reach a ball he plays, in metres added to the reach the
 * physics gives (the lane read and the read of a kick being blocked). It was
 * the same exact geometry for every passer, so a poor reader read the presser
 * and the man behind him as well as the best one (the behaviour round's
 * flat AUC):
 *  - respect: near his own goal (the danger of a loss there) a player gives
 *    an opponent LANE_RESPECT m more than the physics, for the anticipation
 *    and the stretched leg he knows are coming; a daring player (risk,
 *    audacity) gives LANE_OPTIMISM m x daring less, anywhere;
 *  - error: he misjudges it by up to LANE_SPREAD m (a player who cannot read
 *    at all; a top reader is nearly exact), more under pressure unless he is
 *    composed (discipline and reading).
 * A read, never the kick: execution and its accuracy are unchanged. */
export const LANE_RESPECT=.45,LANE_OPTIMISM=.5,LANE_SPREAD=.9;
export interface PasserRead {p:PracticePlayer;pressure:number;danger:number}
export function readerMargin(r:PasserRead,opponent:{id:string},at:Vec,read:'lane'|'block'='lane'):number{
 const bias=LANE_RESPECT*r.danger-LANE_OPTIMISM*daring(r.p);
 return perceive(r.p,read,bias,LANE_SPREAD*(1+clamp(r.pressure,0,1)*(1-composure(r.p))),at,{salt:'reach'+opponent.id});
}
/** A kick must get past nearby feet before a distant receiver or a loft can help.
 * `read`: the passer's own read of those feet (readerMargin); without it, the exact picture. */
export function launchRisk(p:PracticePlayer,aim:Vec,players:PracticePlayer[],delay=0,reach=4,read?:PasserRead):number{
 // Forecast both sides over the same short horizon. Moving only opponents
 // invents blocks at the passer's old position when both are advancing.
 // Visible momentum is an estimate, not knowledge of future decisions.
 const look=Math.min(.3,delay),from={x:p.x+p.vx*look,y:p.y+p.vy*look};
 const length=distance(from,aim),ux=(aim.x-from.x)/Math.max(.01,length),uy=(aim.y-from.y)/Math.max(.01,length);
 const start={x:from.x+ux*.65,y:from.y+uy*.65},segment=Math.min(reach,Math.max(.1,length-.65));
 let risk=0;
 for(const q of players){
  if(q.side===p.side)continue;
  // Short visible-momentum forecast, not knowledge of the opponent's next decision.
  const x=q.x+q.vx*look,y=q.y+q.vy*look;
  const raw=(x-start.x)*ux+(y-start.y)*uy,along=clamp(raw,0,segment);
  const gap=Math.hypot(x-start.x-ux*along,y-start.y-uy*along);
  // (his read of a foot in the way is of one in front of the kick: a man behind him cannot block a ball played away from him)
  const m=read&&raw>0?Math.max(-1,readerMargin(read,q,aim,'block')):0;
  risk=Math.max(risk,clamp((1.25+m-gap)/.8,0,1));
 }
 return risk;
}

/** A short first touch away from pressure, still executed with ordinary movement limits. */
export function recoveryTouch(p:PracticePlayer,players:PracticePlayer[]):Vec{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 const candidates=Array.from({length:12},(_,i)=>{
  const angle=i*Math.PI/6,aim={x:clamp(p.x+Math.cos(angle)*2,.9,(L-.9)),y:clamp(p.y+Math.sin(angle)*2,-(W/2-1.1),(W/2-1.1))};
  const space=Math.min(...opponents.map(q=>distance(aim,{x:q.x+q.vx*.2,y:q.y+q.vy*.2})));
  const turn=Math.abs(difference(angle,p.angle));
  // Avoid turning across our own goal, while allowing a touch toward a safer flank.
  const ownGoal=depth(p,aim.x)<6&&Math.abs(aim.y)<6?2:0;
  return {aim,score:space-turn*.35-ownGoal};
 });
 return candidates.sort((a,b)=>b.score-a.score)[0].aim;
}

/** Shared situational assessment: traits change risk tolerance, not knowledge of future outcomes. */
/** The pressure a carrier feels is his own read (R2): what he sees, scaled by
 * his nerve (a daring or composed player feels it less, a nervous one more)
 * and misjudged by his reading (a relative error up to PRESSURE_SPREAD for
 * one who cannot read it at all). No pressure is never felt as pressure. */
export const PRESSURE_SPREAD=.5;
/** R3 P1: a shot of his own reading SHOT_ON_FROM + SHOT_ON_SPAN (0.35) or
 * better is "a real shot on" and cuts a pass's pressure credits by
 * RELIEF_CUT; a goal-side carry past the presser earns CARRY_RELIEF of a
 * pass's relief. */
export const SHOT_ON_FROM=.25,SHOT_ON_SPAN=.2,RELIEF_CUT=.75,CARRY_RELIEF=.5;
export function feltPressure(p:PracticePlayer,pressure:number,time?:number):number{
 return clamp(pressure*Math.max(0,perceive(p,'pressure',nerve(p),PRESSURE_SPREAD,p,{time,salt:'felt'})),0,1);
}
export function securePossessionOptions(p:PracticePlayer,players:PracticePlayer[],options:Option[],laneRisk:LaneRisk):Option[]{
 const exact=possessionSafety(p,players),felt=feltPressure(p,exact.pressure);
 const safety={...exact,pressure:felt,urgency:exact.danger*felt},{urgency,adventure}=safety;
 const opponents=players.filter(q=>q.side!==p.side),s=p.side===0?1:-1;
 const read:PasserRead={p,pressure:felt,danger:exact.danger},lossHere=turnoverPrice(p,players);
 // Pressure relief belongs to escaping the presser, not to passing (R3 P1).
 // A real shot of his own (as he reads it) escapes it too, so a pass is
 // paid less for relieving pressure the better that shot is; the retreat
 // credit, written for danger near our own goal, fades out by halfway; and a
 // carry that takes him goal-side past the presser earns relief as a pass does.
 const shot=options.find(o=>o.kind==='shoot'),shotOn=clamp(((shot?.quality??0)-SHOT_ON_FROM)/SHOT_ON_SPAN,0,1);
 const ownHalf=clamp((L/2-depth(p))/X(10),0,1),reliefKept=1-RELIEF_CUT*shotOn;
 const adjusted=options.map(o=>{
  let score=o.score,reason=o.reason,relief0=o.relief??0,credits=0;
  // Getting a kick past the nearest opponent matters anywhere on the pitch.
  // Own-goal danger separately prices the consequence of losing it here.
  if(o.kind==='pass'||o.kind==='through'||o.kind==='loft'){
   const delay=releaseTime(p,o.aim,o.kind),blocked=launchRisk(p,o.aim,players,delay,4,read);
   // (step-across round) a blocked kick is lost where he stands: priced as a loss there, as the pass's own risk is
   score-=blocked*(.8+safety.danger*.15+lossHere);
   const delivery=o.pass??o.loft;
   if(delivery&&safety.pressure>.15){
    // Relieving pressure has value everywhere, not only near our own goal.
    // Do not merely transfer the same problem to a marked teammate: account
    // for the time the ball spends travelling before the receiver can act.
    const receiverTime=Math.min(...opponents.map(q=>arrivalTime(q,o.aim)))-delivery.flight-delay;
    const relief=clamp((receiverTime-.3)/1.1,0,1)*(1-delivery.risk)*(1-delivery.controlRisk)*clamp(1+delivery.reachMargin,0,1)*(1-blocked);
    credits+=safety.pressure*relief*(.22+(1-adventure)*.12);
    // Ground-pass valuation charges for metres conceded. Under pressure, a
    // retreat that buys actual time need not pay that entire territorial cost:
    // it can reset the attack. A marked receiver or blocked lane earns no
    // exemption; neither an ordinary nor a coached pass becomes more accurate.
    if(o.pass){
     const retreat=clamp((depth(p)-depth(p,o.aim.x))/X(25),0,1);
     credits+=retreat*(.24+p.traits.risk*.15)*(1-delivery.risk)*safety.pressure*relief*ownHalf;
    }
    if(relief>.6&&safety.pressure>.45)reason='Scoate mingea din presiune către un coleg cu timp pentru continuare.';
   }
   if(urgency>=.06){
    const risk=o.loft?.risk??o.pass?.risk??laneRisk(p,o.aim,opponents);
    score+=urgency*(.27*(1-risk)-risk*.55-delay*.18);
    if(risk<.25&&blocked<.25&&urgency>.25)reason='E presat lângă poartă; găsește o pasă care scoate mingea din duel.';
   }
  }else if(o.kind==='carry'&&o.carry&&o.carry.goalGain>1&&o.carry.escapeGain>0&&safety.pressure>.15){
   credits+=safety.pressure*clamp(o.carry.escapeGain/.3,0,1)*(.22+(1-adventure)*.12)*CARRY_RELIEF*(1-o.carry.obstruction);
  }
  if(o.kind==='carry'&&urgency>=.06){
   const obstruction=o.carry?.obstruction??0;
   score-=urgency*(.3+obstruction*.5+(o.carry?.turnCost??0)*.18)*(1-adventure*.55);
   if(adventure>.65&&urgency>.35)reason='E presat lângă propria poartă, dar se încrede în control și încearcă să iasă cu mingea.';
  }else if(o.kind==='feint'&&urgency>=.06){
   score-=urgency*(.55-adventure*.25);
   if(urgency>.35)reason='Știe că pierde mult dacă greșește aici, dar încearcă să scape prin fentă.';
  }
  // Pass-only credits (the delivery's own pressure x space, relief,
  // retreat) are kept as far as a real shot of his own does not offer the
  // same escape; the kept total is recorded for the purpose clock.
  const pass=o.kind==='pass'||o.kind==='through'||o.kind==='loft';
  const kept=pass?(relief0+credits)*reliefKept:credits;
  score+=kept-relief0;
  return {...o,score,reason,...(pass||credits?{relief:kept}:{})};
 });
 // (step-across round) a keeper pressed at his feet may clear too (never for a corner): he had only passes, and played them into the press
 if(urgency<.16)return adjusted;
 const mates=players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK'),foes=players.filter(q=>q.side!==p.side);
 const candidates:{aim:Vec;exit:ClearanceIntent}[]=[
  ...[-1,1].map(y=>({aim:{x:p.x+s*35,y:clamp(p.y+y*Y(15),-Y(30),Y(30))},exit:'long' as const})),
  ...[-1,1].flatMap(y=>[0,8].map(x=>({aim:{x:clamp(p.x+s*x,1,(L-1)),y:y*(W/2+4)},exit:'touchline' as const}))),
  ...(depth(p)<12&&p.role!=='GK'?[-1,1].map(y=>({aim:{x:p.side===0?-3:L+3,y:y*Math.max(Y(18),Math.abs(p.y))},exit:'corner' as const})):[]),
  // In play: up either touchline, or into the path of a team-mate further up.
  ...[-1,1].map(y=>({aim:{x:clamp(p.x+s*20,1,(L-1)),y:y*(W/2-2.5)},exit:'channel' as const})),
  ...mates.filter(q=>depth(q)>depth(p)+6).map(q=>({aim:{x:clamp(q.x+q.vx*.8,1,(L-1)),y:clamp(q.y+q.vy*.8,-(W/2-1),(W/2-1))},exit:'mate' as const})),
 ];
 // Never clear across the face of his own goal: the ball may not pass nearer
 // the goal's centre than it already is (within 4.5 m of it).
 const goal={x:p.side===0?0:L,y:0},near=Math.min(4.5,distance(p,goal));
 const across=(aim:Vec)=>{const dx=aim.x-p.x,dy=aim.y-p.y,t=clamp(((goal.x-p.x)*dx+(goal.y-p.y)*dy)/Math.max(1e-6,dx*dx+dy*dy),0,1);return distance({x:p.x+dx*t,y:p.y+dy*t},goal)<near-.25;};
 for(const {aim,exit} of candidates){
  if(across(aim))continue;
  // A lofted clearance is over a foot within a stride or so; a driven one is not.
  const lofted=exit==='long'||exit==='channel'||exit==='mate';
  const delay=releaseTime(p,aim,'clear'),blocked=launchRisk(p,aim,players,delay,lofted?1.6:4);
  const cost=exit==='corner'?.22:exit==='touchline'?.1:0;
  // An in-play clearance is worth what it keeps: who reaches its landing first.
  const inPlay=exit==='channel'||exit==='mate';
  const retention=inPlay?clamp((Math.min(...foes.map(q=>arrivalTime(q,aim)))-Math.min(...mates.map(q=>arrivalTime(q,aim))))/1.2,-1,1):0;
  const score=-.12+urgency*(1.15-adventure*.3)-blocked*.95-delay*.22-cost+retention*.14;
  adjusted.push({kind:'clear',aim,clearance:exit,score,reason:exit==='corner'?'Nu poate întoarce în siguranță; acceptă cornerul ca să îndepărteze pericolul.':exit==='touchline'?'Presiunea e prea aproape de poartă; caută tușa ca să oprească pericolul.':exit==='mate'?'Degajează din prima zonă, spre un coleg liber mai sus.':exit==='channel'?'Degajează pe lângă tușă, în teren, unde pot ajunge colegii.':'Nu riscă încă un duel lângă poartă; degajează departe de presiune.'});
 }
 return adjusted;
}

export type ClearanceIntent='long'|'touchline'|'corner'|'channel'|'mate';

export function strikeClearance(p:PracticePlayer,ball:Vec,aim:Vec,pressure:number,random:()=>number,intent:ClearanceIntent):{vx:number;vy:number;vz:number}{
 const error=(.025+(1-clamp(p.skills.passing/10,0,1))*.06+pressure*.035)*(random()*2-1);
 const angle=Math.atan2(aim.y-ball.y,aim.x-ball.x)+error;
 if(intent==='channel'||intent==='mate'){
  // Paced for its landing: lifted over the nearest foot, arriving at a pace a
  // team-mate can take (about 9 m/s) instead of running on out of play.
  const speed=clamp(Math.sqrt(81+2*PASS_DRAG*distance(ball,aim)),9,14.5);
  return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:5.5+p.skills.strength*.08};
 }
 const speed=22+p.skills.strength*.25,out=intent!=='long';
 return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:out?1.2:6.5+p.skills.strength*.15};
}
