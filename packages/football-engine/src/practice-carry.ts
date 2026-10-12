import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import {readDrawnOpening} from './practice-connections.js';
import {steerMotion} from './movement.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {goalAngle} from './practice-football.js';
import {chooseAction} from './practice-selection.js';
import {turnoverPrice} from './practice-rest-defence.js';
import {KEEPER_HOME} from './practice-keeper.js';

export type CarryPurpose='advance'|'shooting-angle'|'passing-lane'|'escape'|'protect';
export interface CarryAssessment {
 purpose:CarryPurpose;goalGain:number;shotGain:number;passGain:number;escapeGain:number;
 obstruction:number;clearance:number;turnCost:number;passTarget?:string;contactRisk?:number;nearbyChallenges?:number;openingGain?:number;endPressure?:number;
}
export interface CarryOption {kind:'carry';aim:Vec;score:number;reason:string;carry:CarryAssessment;continuing?:boolean}
export interface CarryPlan {aim:Vec;until:number;purpose:CarryPurpose;reason:string}
export interface FootballOption {teachingStep?:string;teachingFit?:number;kind:string;aim:Vec;score:number;reason:string;carry?:CarryAssessment;continuing?:boolean}
type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(p:PracticePlayer,x:number)=>p.side===0?x:L-x;
const bound=(p:Vec):Vec=>({x:clamp(p.x,.8,(L-.8)),y:clamp(p.y,-(W/2-1),(W/2-1))});
const nearest=(point:Vec,opponents:PracticePlayer[])=>Math.min(...opponents.map(p=>distance(point,p)));
const goalDistance=(p:PracticePlayer,point:Vec)=>Math.hypot((p.side===0?L:0)-point.x,point.y);
const shotPotential=(p:PracticePlayer,point:Vec)=>clamp(goalAngle({...p,...point})/.6,0,1)*clamp(1-goalDistance(p,point)/45,0,1);

/** A carry into a contested route loses the ball about a third of the time
 * (B4b: ~19% for carries under pressure, passes 22-27%): the share of the
 * loss price a fully contested carry pays, less for a confident dribbler. */
export const CARRY_LOSS=.35;
/** Confidence is a willingness to attempt the duel, never its eventual result. */
export const dribbleConfidence=(p:PracticePlayer)=>clamp(p.traits.dribble*.45+p.traits.risk*.35+clamp(p.skills.control/10,0,1)*.2,0,1);

/** Read the next few touches separately from a defender farther along a route.
 * Only current positions and short visible momentum are used. */
export function readDribbleRoute(p:PracticePlayer,aim:Vec,players:PracticePlayer[],duelOpponent?:string):{contactRisk:number;nearbyChallenges:number;endPressure:number}{
 const opponents=players.filter(q=>q.side!==p.side&&q.id!==duelOpponent),preview={...p};
 const gaps=new Map(opponents.map(q=>[q.id,distance(p,q)]));
 for(let t=.1;t<=.6+1e-8;t+=.1){
  steerMotion(preview,aim,.1,p.pace*.72);
  for(const q of opponents){const look=Math.min(.3,t),gap=distance(preview,{x:q.x+q.vx*look,y:q.y+q.vy*look});gaps.set(q.id,Math.min(gaps.get(q.id)!,gap));}
 }
 const distances=[...gaps.values()];
 const endGap=Math.min(...opponents.map(q=>distance(preview,{x:q.x+q.vx*.3,y:q.y+q.vy*.3})));
 return {contactRisk:clamp((1.8-Math.min(...distances))/1.35,0,1),nearbyChallenges:distances.filter(d=>d<2.8).length,endPressure:clamp((3.2-endGap)/2,0,1)};
}

/** A modest one-action lookahead, using visible positions; it doesn't predict a scripted play. */
function passingOutlet(p:PracticePlayer,from:Vec,players:PracticePlayer[],risk:Risk):{value:number;target?:string}{
 const opponents=players.filter(q=>q.side!==p.side),line=opponents.map(q=>depth(p,q.x)).sort((a,b)=>b-a)[1]??L;
 let best={value:0,target:undefined as string|undefined};
 for(const q of players){
  if(q.side!==p.side||q.id===p.id||q.role==='GK')continue;
  const d=distance(from,q);if(d<3||d>W/2)continue;
  const threat=shotPotential(p,q)*.65+clamp((depth(p,q.x)-X(45))/X(50),0,1)*.35;
  const room=clamp(nearest(q,opponents)/5,0,1);
  const value=threat*(1-risk(from,q,opponents))*(.3+room*.7)-d*.003;
  if(value>best.value)best={value,target:q.id};
 }
 return best;
}
const reasons:Record<CarryPurpose,string>={
 advance:'Atacă drumul spre poartă; are loc să ducă mingea mai aproape.',
 'shooting-angle':'Intră spre centru ca să-și deschidă unghiul de șut.',
 'passing-lane':'Schimbă unghiul cu mingea ca să deschidă pasa spre un coleg.',
 escape:'Iese din presiune cu mingea și caută loc să continue.',
 protect:'Protejează mingea și caută sprijin pentru continuare.',
};

export function carryOptions(p:PracticePlayer,players:PracticePlayer[],held:number,risk:Risk,plan:CarryPlan|null=null,time=0,extraAims:Vec[]=[]):CarryOption[]{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK'),s=p.side===0?1:-1;
 const near=nearest(p,opponents),pressure=clamp((5-near)/5,0,1),beforeShot=shotPotential(p,p),beforePass=passingOutlet(p,p,players,risk);
 const beforeGoal=goalDistance(p,p),speed=Math.hypot(p.vx,p.vy),goalX=p.side===0?L:0;
 // What being tackled on the way would cost (R2, the carry's loss read beside
 // the pass's): the same authored price, as this carrier reads it, where he
 // carries it from. The flat obstruction and contact terms below remain the
 // carry's everyday cost, as the pass's base loss term is.
 const lossCost=p.role==='GK'?0:turnoverPrice(p,players,p);
 const candidates=[...[[7,0],[5,-5],[5,5],[0,-6],[0,6],[-4,-4],[-4,4]].map(([dx,dy])=>({aim:bound({x:p.x+s*dx,y:p.y+dy}),continuing:false})),
  {aim:bound({x:p.x+(goalX-p.x)/Math.max(1,beforeGoal)*7,y:p.y-p.y/Math.max(1,beforeGoal)*7}),continuing:false},
  ...extraAims.map(aim=>({aim:bound(aim),continuing:false}))];
 if(plan&&time<plan.until&&distance(p,plan.aim)>1.5)candidates.unshift({aim:plan.aim,continuing:true});
 const options:CarryOption[]=[];
 for(const candidate of candidates){
  const {aim,continuing}=candidate,length=distance(p,aim);if(length<.8||options.some(o=>distance(o.aim,aim)<.2))continue;
  // Own-goal guard (as recoveryTouch): an outfielder never carries toward the
  // mouth of his own goal; the backward diagonals stay on offer elsewhere.
  if(p.role!=='GK'&&depth(p,aim.x)<6&&Math.abs(aim.y)<6&&depth(p,aim.x)<depth(p,p.x))continue;
  // (settings-truth round) a keeper who stays on his line does not carry the ball up out of his area: he
  // plays it (he had carried it to 17-20 m and was caught there when it was lost)
  if(p.role==='GK'&&(p.traits.keeperSweep??.2)<=KEEPER_HOME&&depth(p,aim.x)>BOX_DEPTH+1&&depth(p,aim.x)>depth(p,p.x))continue;
  const goalGain=beforeGoal-goalDistance(p,aim),shotGain=shotPotential(p,aim)-beforeShot;
  const outlet=passingOutlet(p,aim,players,risk),opening=readDrawnOpening(p,aim,players,risk);
  const passGain=Math.max(0,outlet.value-beforePass.value,opening.gain*.65);
  const clearance=nearest(aim,opponents),escapeGain=pressure*clamp((clearance-near)/5,0,1);
  const obstruction=risk(p,aim,opponents,p.pace*.68),local=readDribbleRoute(p,aim,players),confidence=dribbleConfidence(p);
  const alignment=speed>.2?clamp(((aim.x-p.x)*p.vx+(aim.y-p.y)*p.vy)/(length*speed),-1,1):1;
  // Changing a running vector costs time; pace does not grant instant direction changes.
  const turnCost=clamp(speed*Math.sqrt(Math.max(0,2-2*alignment))/Math.max(1,p.acceleration)/2,0,1);
  const progress=clamp(goalGain/Math.max(5,length),-1,1),advanceValue=Math.max(0,progress)*(.14+p.traits.runs*.035);
  const purpose:CarryPurpose=passGain>.08&&passGain*.32>Math.max(advanceValue*.65,Math.max(0,shotGain)*.22)?'passing-lane'
   :shotGain>.08&&Math.abs(aim.y)<Math.abs(p.y)-1&&shotGain*.22>advanceValue*.4?'shooting-angle'
   :escapeGain>.16&&escapeGain*.16>advanceValue*.65?'escape':goalGain>.3?'advance':'protect';
  // Approaching pressure matters even when the carry starts in open space.
  // Multiplying by current pressure made freshly escaped receivers blind to
  // the same approaching defender until they were already in the next duel.
  const score=.19+clamp(clearance/6,0,1)*.06+progress*(.14+p.traits.runs*.035)+Math.max(0,shotGain)*.22+passGain*.32+escapeGain*.16
   -obstruction*(.18-confidence*.07)-local.contactRisk*(.2-confidence*.08)-Math.max(0,local.nearbyChallenges-1)*(.1-confidence*.025)
   +opening.gain*(.08+confidence*.1)*clamp(1-local.contactRisk,0,1)+Math.max(0,progress)*confidence*.045-turnCost*.07-pressure*.06-held*.003
   -local.endPressure*(.16-confidence*.08)-CARRY_LOSS*Math.max(obstruction,local.contactRisk)*(1-confidence*.4)*lossCost;
  const passTarget=opening.gain*.65>outlet.value-beforePass.value?opening.target:outlet.target;
  const recipient=purpose==='passing-lane'?players.find(q=>q.id===passTarget):undefined;
  const reason=opening.gain>.15&&recipient?`Adversarul vine spre el; schimbă unghiul pentru a deschide pasa către ${recipient.name}.`:recipient?`${Math.abs(aim.y)>Math.abs(p.y)+1?'Se deschide spre margine':'Schimbă unghiul cu mingea'} ca să deschidă pasa către ${recipient.name}.`:reasons[purpose];
  options.push({kind:'carry',aim,score,reason,continuing,
   carry:{purpose,goalGain,shotGain,passGain,escapeGain,obstruction,clearance,turnCost,...local,openingGain:opening.gain,passTarget:passGain>.08?passTarget:undefined}});
 }
 return options;
}

/** Randomness may choose comparable routes, not an option worse on every football measure. */
export function viableOptions<T extends FootballOption>(options:T[],plan:CarryPlan|null=null,time=0):T[]{
 const carries=options.filter(o=>o.carry),continuation=carries.find(o=>o.continuing),bestCarry=Math.max(-Infinity,...carries.map(o=>o.score));
 const coachedFit=Math.max(0,...carries.map(o=>o.teachingFit??0));
 // A live coached goal already supplies continuity. Keep its alternative
 // routes in comparison instead of locking an older, less-aligned carry and
 // accidentally leaving only an unrelated pass above the final score cutoff.
 const holding=!!(!coachedFit&&plan&&time<plan.until&&continuation&&continuation.carry!.obstruction<.45&&continuation.carry!.clearance>2&&bestCarry-continuation.score<.1);
 const routed=options.filter(o=>{
  if(!o.carry)return true;
  if(holding)return o===continuation;
  const a=o.carry;
  const dominated=carries.some(b=>{
   if(b===o||b.continuing)return false;const c=b.carry!;
   const noWorse=(b.teachingFit??0)>=(o.teachingFit??0)-.01&&c.goalGain>=a.goalGain-.05&&c.shotGain>=a.shotGain-.005&&c.passGain>=a.passGain-.005&&c.escapeGain>=a.escapeGain-.005
    &&c.obstruction<=a.obstruction+.01&&Math.min(6,c.clearance)>=Math.min(6,a.clearance)-.05&&c.turnCost<=a.turnCost+.03;
   return noWorse&&b.score>o.score+.015;
  });
  return !dominated&&o.score>=bestCarry-.035;
 });
 const best=Math.max(...routed.map(o=>o.score));
 return routed.filter(o=>o.score>=best-.085);
}
export function chooseFootballOption<T extends FootballOption>(options:T[],random:()=>number,plan:CarryPlan|null=null,time=0):T{
 return chooseAction(viableOptions(options,plan,time),random);
}
export function commitCarry(p:PracticePlayer,option:CarryOption,time:number,previous:CarryPlan|null):CarryPlan{
 if(option.continuing&&previous)return previous;
 return {aim:{...option.aim},until:time+clamp(distance(p,option.aim)/(p.pace*.68)+.35,1.2,2.2),purpose:option.carry.purpose,reason:option.reason};
}
