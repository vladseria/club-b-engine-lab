import {L,W,GH,HEIGHT,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import {readDrawnOpening} from './practice-connections.js';
import {steerMotion} from './movement.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {goalAngle} from './practice-football.js';
import {chooseAction} from './practice-selection.js';
import {turnoverPrice,deliveryLossWeight,LOSS_SCALE} from './practice-rest-defence.js';
import {arrivalTime} from './practice-defense.js';
import {duelChance} from './practice-challenge.js';
import {perceive,daring} from './practice-perception.js';
import {WORLD} from './world.js';

export type CarryPurpose='advance'|'shooting-angle'|'passing-lane'|'escape'|'protect';
export interface CarryAssessment {
 purpose:CarryPurpose;goalGain:number;shotGain:number;passGain:number;escapeGain:number;
 obstruction:number;clearance:number;turnCost:number;passTarget?:string;contactRisk?:number;nearbyChallenges?:number;openingGain?:number;endPressure?:number;
 /** B2: his read of being tackled on this route (carryLossRead). */
 beaten?:number;
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
const shotPotential=(p:PracticePlayer,point:Vec)=>clamp(goalAngle({...p,...point})/WORLD.geometry.carry.shotAngle.v,0,1)*clamp(1-goalDistance(p,point)/WORLD.geometry.carry.shotReach.v,0,1);

/** A carry into a contested route loses the ball about a third of the time
 * (B4b: ~19% for carries under pressure, passes 22-27%): the share of the
 * loss price a carry into an obstructed lane (a man further along it) pays,
 * less for a confident dribbler. Since B2 the man he meets on the route is
 * priced by carryLossRead instead. */
export const CARRY_LOSS=WORLD.selection.carry.CARRY_LOSS.v;
/** B2, the pressed carrier (2026-10-09): "I take him on only when I read
 * that I beat him." His read of being tackled on a route: the chance the man
 * he meets on it gets a foot to the ball (the route's contactRisk) times the
 * chance that man wins the duel when he does (duelChance: his defending
 * against the carrier's control, strength and energy, and his cover), as the
 * carrier reads it: misjudged by his read of a carry (control, dribble and
 * reading; an error up to BEAT_SPREAD of the odds for one who cannot read
 * it) and believed less likely by his nature: up to BEAT_OPTIMISM for a
 * daring player (risk, audacity), and BEAT_NATURE per unit of dribble
 * tendency above the squad's typical DRIBBLE_TYPICAL for a natural dribbler,
 * who takes a lone presser on more often and sometimes wins (a reluctant one
 * the other way). Visible information only: where the men are,
 * how they move, who they are. It replaces the flat contact cost a pressed
 * carry used to pay whoever was on the ball or pressing him (B2 card: a
 * playmaker and a heavy touch lost it as often as each other). */
export const BEAT_SPREAD=WORLD.perception.carry.BEAT_SPREAD.v,BEAT_OPTIMISM=WORLD.perception.carry.BEAT_OPTIMISM.v,BEAT_NATURE=WORLD.perception.carry.BEAT_NATURE.v,DRIBBLE_TYPICAL=WORLD.perception.carry.DRIBBLE_TYPICAL.v;
export function carryLossRead(p:PracticePlayer,players:PracticePlayer[],contactRisk:number,opponent?:string,winOdds?:number):number{
 const d=opponent?players.find(q=>q.id===opponent):undefined;
 if(!d||contactRisk<=0)return 0;
 // `winOdds`: the man's odds of taking it when he is on him, when they are not a tackle's (a keeper's claim)
 const cover=players.filter(q=>q.side===d.side&&q.id!==d.id&&distance(q,p)<6).length,odds=winOdds??duelChance(p,d,cover);
 const nature=beatNature(p);
 const read=perceive(p,'carry',odds*nature,BEAT_SPREAD*odds,p,{salt:'beat'+d.id});
 return contactRisk*clamp(read,.03,.97);
}
/** How much less likely than it is he believes he loses the ball to the man he takes on (carryLossRead's nature, so
 * also the take-on's loss read, practice-feints takeOnRead): BEAT_OPTIMISM x daring and BEAT_NATURE per unit of dribble
 * tendency above DRIBBLE_TYPICAL, 0.35..1.3. */
export const beatNature=(p:PracticePlayer)=>clamp(1-BEAT_OPTIMISM*daring(p)-BEAT_NATURE*((p.traits.dribble??DRIBBLE_TYPICAL)-DRIBBLE_TYPICAL),.35,1.3);
/** R1, the keeper with the ball at his feet (2026-10-14). If he loses it, he
 * has lost it in front of the goal he has walked away from: the danger, in
 * goals, beyond what any loss there costs (turnoverPrice prices a loss with a
 * keeper behind it). The man who wins it at `at` needs about NET_SET to set
 * himself and the ball NET_SPEED m/s to the goal; the keeper needs NET_REACT
 * to turn and his own pace to get back to where he covers it from, a metre
 * off his line. How much of the goal is open is how far he is still short
 * when the ball would arrive (fully open a second short), an empty net is
 * finished most of the time and less from far away, and a team-mate who gets
 * back to the mouth first covers about half of it. Nothing here is a
 * distance limit: a step to the side of his goal leaves nothing open, the
 * touchline 15 m out leaves all of it. Where the men are, not where the rules
 * say he may go. */
export const NET_SET=WORLD.selection.carry.NET_SET.v,NET_SPEED=WORLD.selection.carry.NET_SPEED.v,NET_REACT=WORLD.selection.carry.NET_REACT.v,NET_COVERED=WORLD.selection.carry.NET_COVERED.v;
export function emptyNetDanger(p:PracticePlayer,players:readonly PracticePlayer[],at:Vec):number{
 const goal={x:p.side===0?0:L,y:0},guard={x:p.side===0?1:L-1,y:0};
 const shot=NET_SET+distance(at,goal)/NET_SPEED,back=NET_REACT+Math.max(0,distance(at,guard)-.5)/(p.pace*.94);
 const open=clamp(back-shot,0,1);if(open<=0)return 0;
 const finish=clamp(1-distance(at,goal)/60,.4,.95);
 const covered=players.some(q=>q.side===p.side&&q.role!=='GK'&&arrivalTime(q,guard)<shot);
 return open*finish*(covered?NET_COVERED:1);
}
/** How much of that danger he feels, by his habit (keeperSweep): a keeper who
 * stays at home feels the empty net behind him (NET_HOME at trait 0), a
 * sweeper keeper is at ease out of his goal and accepts the risk (NET_SWEEPER
 * at 1: none of it beyond the price any lost ball pays). It weighs what is at
 * stake; it never forbids a carry. (R1 keeper tune, 2026-10-15: NET_SWEEPER
 * 0.3 -> 0, a sweeper at 0.8 weighs it 0.30 instead of 0.54, so he carries
 * about half as often again; a keeper at home, 1.40 instead of 1.42.) */
export const NET_HOME=WORLD.selection.carry.NET_HOME.v,NET_SWEEPER=WORLD.selection.carry.NET_SWEEPER.v;
export const keeperNetWeight=(p:{traits:{keeperSweep?:number}})=>NET_HOME+(NET_SWEEPER-NET_HOME)*clamp(p.traits.keeperSweep??WORLD.skills.keeper.sweepDefault.v,0,1);
/** Keeping the ball away from his goal (what a route's tackle read does not
 * see): the chance the ball is lost while he is out there with it. The
 * ball he plays on from there is lost about one time in eight whoever is
 * near (NET_NEXT: an interception, a heavy touch; a real side completes
 * 80-90% of its passes); a man who can close him there within NET_HOLD
 * seconds adds up to a contested carry's share (CARRY_LOSS). */
export const NET_HOLD=WORLD.selection.carry.NET_HOLD.v,NET_NEXT=WORLD.selection.carry.NET_NEXT.v;
export function keeperCaught(p:PracticePlayer,players:readonly PracticePlayer[],aim:Vec):number{
 const reach=Math.min(Infinity,...players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>arrivalTime(q,aim)));
 return NET_NEXT+CARRY_LOSS*clamp((NET_HOLD-reach)/NET_HOLD,0,1);
}
/** (decide round, 2026-10-15) A carry earns its place by what it achieves. CARRY_BASE is what keeping the ball on
 * the move is worth before the route does anything (progress, a shooting angle, a passing lane, escaping the man,
 * drawing one: the terms below); it was 0.19, and in 51.5% of new carries no kick was worth even that, so the carry
 * won by default (decide notes). A carry that achieves something keeps every credit it had.
 * CONTINUE_FLOOR: the route he is running is read for its rate of progress (goal gained a metre) down to its last
 * metre. A fresh route is still read over at least 5 m (a 2 m step is not an advance), but the same floor on the
 * rest of a committed route made its value decay as it was run (progress = goal gain / max(5, length)), so a fresh
 * straight line from the new spot beat it every ~0.4 s: dribbling read as dithering. */
export const CARRY_BASE=WORLD.selection.carry.CARRY_BASE.v,CONTINUE_FLOOR=WORLD.selection.carry.CONTINUE_FLOOR.v;
/** What a carry achieves, per unit of each read (the carry's credits; named 2026-10-19 so the take-on values getting
 * past its man with the same scales, routeCredits): progress (goal gained a metre) CARRY_PROGRESS plus CARRY_RUNS x
 * his runs tendency, a better shooting angle CARRY_SHOT, a better pass CARRY_PASS, escaping the presser CARRY_ESCAPE,
 * and CARRY_CONFIDENT x confidence on any progress. */
export const CARRY_PROGRESS=WORLD.selection.carry.CARRY_PROGRESS.v,CARRY_RUNS=WORLD.selection.carry.CARRY_RUNS.v,CARRY_SHOT=WORLD.selection.carry.CARRY_SHOT.v,CARRY_PASS=WORLD.selection.carry.CARRY_PASS.v,CARRY_ESCAPE=WORLD.selection.carry.CARRY_ESCAPE.v,CARRY_CONFIDENT=WORLD.selection.carry.CARRY_CONFIDENT.v;
/** Confidence is a willingness to attempt the duel, never its eventual result. */
export const dribbleConfidence=(p:PracticePlayer)=>clamp(p.traits.dribble*.45+p.traits.risk*.35+clamp(p.skills.control/10,0,1)*.2,0,1);

/** Read the next few touches separately from a defender farther along a route.
 * Only current positions and short visible momentum are used. */
export function readDribbleRoute(p:PracticePlayer,aim:Vec,players:PracticePlayer[],duelOpponent?:string):{contactRisk:number;nearbyChallenges:number;endPressure:number;opponent?:string}{
 const opponents=players.filter(q=>q.side!==p.side&&q.id!==duelOpponent),preview={...p};
 const gaps=new Map(opponents.map(q=>[q.id,distance(p,q)]));
 for(let t=.1;t<=.6+1e-8;t+=.1){
  steerMotion(preview,aim,.1,p.pace*.72);
  for(const q of opponents){const look=Math.min(.3,t),gap=distance(preview,{x:q.x+q.vx*look,y:q.y+q.vy*look});gaps.set(q.id,Math.min(gaps.get(q.id)!,gap));}
 }
 const distances=[...gaps.values()];
 const endGap=Math.min(...opponents.map(q=>distance(preview,{x:q.x+q.vx*.3,y:q.y+q.vy*.3})));
 // (B2) the man he meets: the nearest on the route
 let opponent:string|undefined,closest=Infinity;for(const [id,g] of gaps)if(g<closest){closest=g;opponent=id;}
 return {contactRisk:clamp((1.8-Math.min(...distances))/1.35,0,1),nearbyChallenges:distances.filter(d=>d<2.8).length,endPressure:clamp((3.2-endGap)/2,0,1),opponent};
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

/** (R1) The words say where he is actually going: an advance that goes more
 * sideways than forward is a carry across, not an attack on the goal, and a
 * keeper's carry is told as a keeper's. The choice itself is unchanged. */
function carryReason(p:PracticePlayer,aim:Vec,purpose:CarryPurpose):string{
 const forward=(p.side===0?1:-1)*(aim.x-p.x),across=Math.abs(aim.y-p.y),wide=Math.abs(aim.y)>Math.abs(p.y)+.5;
 const way=wide?'spre margine':'spre centru';
 if(p.role==='GK'){
  if(forward>across)return purpose==='escape'?'Iese din presiune cu mingea, în fața porții lui.':'Iese cu mingea din poartă; are loc în față.';
  if(forward< -across*.5)return 'Se întoarce cu mingea spre poarta lui.';
  return `Se mută cu mingea ${way}${purpose==='escape'?', departe de adversarul care vine':''}, căutând o pasă.`;
 }
 if(purpose==='advance'&&forward<across)return `Duce mingea ${way}, câștigând puțin teren.`;
 return reasons[purpose];
}
export function carryOptions(p:PracticePlayer,players:PracticePlayer[],held:number,risk:Risk,plan:CarryPlan|null=null,time=0,extraAims:Vec[]=[]):CarryOption[]{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK'),s=p.side===0?1:-1;
 const near=nearest(p,opponents),pressure=clamp((5-near)/5,0,1),beforeShot=shotPotential(p,p),beforePass=passingOutlet(p,p,players,risk);
 const beforeGoal=goalDistance(p,p),speed=Math.hypot(p.vx,p.vy),goalX=p.side===0?L:0;
 // What being tackled on the way would cost (R2, the carry's loss read beside
 // the pass's): the same authored price, as this carrier reads it, where he
 // carries it from. The flat obstruction and contact terms below remain the
 // carry's everyday cost, as the pass's base loss term is.
 // (R1 keeper) a keeper's carry pays the same price; beyond it, the goal he leaves behind him (emptyNetDanger),
 // as much as his habit makes him feel it (keeperNetWeight), per route: where he carries it to
 const keeper=p.role==='GK',baseLoss=turnoverPrice(p,players,p),netWeight=keeper?keeperNetWeight(p)*LOSS_SCALE:0;
 const netHere=keeper?emptyNetDanger(p,players,p):0;
 const candidates=[...[[7,0],[5,-5],[5,5],[0,-6],[0,6],[-4,-4],[-4,4]].map(([dx,dy])=>({aim:bound({x:p.x+s*dx,y:p.y+dy}),continuing:false})),
  {aim:bound({x:p.x+(goalX-p.x)/Math.max(1,beforeGoal)*7,y:p.y-p.y/Math.max(1,beforeGoal)*7}),continuing:false},
  ...extraAims.map(aim=>({aim:bound(aim),continuing:false}))];
 if(plan&&time<plan.until&&distance(p,plan.aim)>1.5)candidates.unshift({aim:plan.aim,continuing:true});
 const options:CarryOption[]=[];
 for(const candidate of candidates){
  const {aim,continuing}=candidate,length=distance(p,aim);if(length<.8||options.some(o=>distance(o.aim,aim)<.2))continue;
  // Own-goal guard (as recoveryTouch): an outfielder never carries toward the
  // mouth of his own goal; the backward diagonals stay on offer elsewhere.
  if(p.role!=='GK'&&depth(p,aim.x)<WORLD.geometry.carry.ownGoalDepth.v&&Math.abs(aim.y)<WORLD.geometry.carry.ownGoalWide.v&&depth(p,aim.x)<depth(p,p.x))continue;
  // (R1 keeper tune, 2026-10-15) the settings-truth round's hard guard (a keeper whose sweep trait was at most KEEPER_HOME never
  // carried past 9 m) is gone: the goal he leaves behind him (emptyNetDanger, weighed by keeperNetWeight) is the price
  // that keeps a stay-at-home keeper from carrying it up out of his area.
  const goalGain=beforeGoal-goalDistance(p,aim),shotGain=shotPotential(p,aim)-beforeShot;
  const outlet=passingOutlet(p,aim,players,risk),opening=readDrawnOpening(p,aim,players,risk);
  const passGain=Math.max(0,outlet.value-beforePass.value,opening.gain*.65);
  const clearance=nearest(aim,opponents),escapeGain=pressure*clamp((clearance-near)/5,0,1);
  const obstruction=risk(p,aim,opponents,p.pace*.68),{opponent,...local}=readDribbleRoute(p,aim,players),confidence=dribbleConfidence(p);
  // (B2) his read of being tackled by the man he meets, priced as a lost pass is (deliveryLossWeight);
  // (R1 keeper) a keeper's too: losing it on the way costs him what it costs anyone, plus the open goal there
  const beaten=carryLossRead(p,players,local.contactRisk,opponent);
  const netThere=keeper?emptyNetDanger(p,players,aim):0,lossCost=baseLoss+netWeight*netThere;
  // (R1 keeper) and while he keeps it out there (on the way and at its end), the goal he has left: what is open
  // along the route, by the chance it is lost before he has moved it on. A pass ends it; a carry never earns it back.
  const leaving=keeper?netWeight*(netHere+netThere)/2*keeperCaught(p,players,aim):0;
  const alignment=speed>.2?clamp(((aim.x-p.x)*p.vx+(aim.y-p.y)*p.vy)/(length*speed),-1,1):1;
  // Changing a running vector costs time; pace does not grant instant direction changes.
  const turnCost=clamp(speed*Math.sqrt(Math.max(0,2-2*alignment))/Math.max(1,p.acceleration)/2,0,1);
  // (decide round) a route he is already running is valued for how directly it takes him on (goal gained a metre),
  // not as a short fresh route: the 5 m floor made the part of a route still to run worth less and less as he ran it
  // (CONTINUE_FLOOR)
  const progress=clamp(goalGain/Math.max(continuing?CONTINUE_FLOOR:5,length),-1,1),advanceValue=Math.max(0,progress)*(CARRY_PROGRESS+p.traits.runs*CARRY_RUNS);
  const purpose:CarryPurpose=passGain>.08&&passGain*.32>Math.max(advanceValue*.65,Math.max(0,shotGain)*.22)?'passing-lane'
   :shotGain>.08&&Math.abs(aim.y)<Math.abs(p.y)-1&&shotGain*.22>advanceValue*.4?'shooting-angle'
   :escapeGain>.16&&escapeGain*.16>advanceValue*.65?'escape':goalGain>.3?'advance':'protect';
  // Approaching pressure matters even when the carry starts in open space.
  // Multiplying by current pressure made freshly escaped receivers blind to
  // the same approaching defender until they were already in the next duel.
  // (B2) an escape is worth what it is if he gets out: a route on which he reads he is tackled escapes nothing
  const score=CARRY_BASE+clamp(clearance/6,0,1)*.06+progress*(CARRY_PROGRESS+p.traits.runs*CARRY_RUNS)+Math.max(0,shotGain)*CARRY_SHOT+passGain*CARRY_PASS+escapeGain*CARRY_ESCAPE*(1-beaten)
   -obstruction*(.18-confidence*.07)-beaten*deliveryLossWeight(p,lossCost)-Math.max(0,local.nearbyChallenges-1)*(.1-confidence*.025)
   +opening.gain*(.08+confidence*.1)*clamp(1-local.contactRisk,0,1)+Math.max(0,progress)*confidence*CARRY_CONFIDENT-turnCost*.07-pressure*.06-held*.003
   -local.endPressure*(.16-confidence*.08)-CARRY_LOSS*obstruction*(1-confidence*.4)*lossCost-leaving;
  const passTarget=opening.gain*.65>outlet.value-beforePass.value?opening.target:outlet.target;
  const recipient=purpose==='passing-lane'?players.find(q=>q.id===passTarget):undefined;
  const reason=opening.gain>.15&&recipient?`Adversarul vine spre el; schimbă unghiul pentru a deschide pasa către ${recipient.name}.`:recipient?`${Math.abs(aim.y)>Math.abs(p.y)+1?'Se deschide spre margine':'Schimbă unghiul cu mingea'} ca să deschidă pasa către ${recipient.name}.`:carryReason(p,aim,purpose);
  options.push({kind:'carry',aim,score,reason,continuing,
   carry:{purpose,goalGain,shotGain,passGain,escapeGain,obstruction,clearance,turnCost,...local,openingGain:opening.gain,passTarget:passGain>.08?passTarget:undefined,beaten}});
 }
 return options;
}

/** (take-on price, 2026-10-19) What being at `aim` gets him, read as the carry reads a route there: progress toward
 * goal (the fresh route's goal gained a metre over at least 5 m), a better shooting angle, a better pass (the best
 * outlet from there, in the picture `there` he reads it in, against the best from here, in the picture `here` he sees
 * now), and escaping the man closing him (room at `aim` in `there` against `near`, the nearest opponent now), each at
 * the carry's own scale (CARRY_PROGRESS ... CARRY_CONFIDENT); `confident` is the confidence credit within `credits`.
 * Visible positions only. The drawn-opening credit is the carry's alone: it is the route pulling a defender, not
 * getting past him. */
export function routeCredits(p:PracticePlayer,aim:Vec,there:PracticePlayer[],risk:Risk,near:number,here:PracticePlayer[]=there):{credits:number;confident:number;progress:number;shotGain:number;passGain:number;escapeGain:number}{
 const opponents=there.filter(q=>q.side!==p.side&&q.role!=='GK');
 const goalGain=goalDistance(p,p)-goalDistance(p,aim),length=distance(p,aim);
 const progress=clamp(goalGain/Math.max(5,length),-1,1),shotGain=shotPotential(p,aim)-shotPotential(p,p);
 const passGain=Math.max(0,passingOutlet(p,aim,there,risk).value-passingOutlet(p,p,here,risk).value);
 const pressure=clamp((5-near)/5,0,1),clearance=opponents.length?nearest(aim,opponents):6,escapeGain=pressure*clamp((clearance-near)/5,0,1);
 const confident=Math.max(0,progress)*dribbleConfidence(p)*CARRY_CONFIDENT;
 const credits=progress*(CARRY_PROGRESS+p.traits.runs*CARRY_RUNS)+Math.max(0,shotGain)*CARRY_SHOT+passGain*CARRY_PASS+escapeGain*CARRY_ESCAPE+confident;
 return {credits,confident,progress,shotGain,passGain,escapeGain};
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
 // (r1 mechanics) Holding a route keeps him on it rather than switching to a
 // marginally better one; it does not make carrying worth less. The held
 // route stands for carrying at the best route's value, so the cut-off for a
 // pass, a clearance or a shot is still set by the carry he actually has.
 const best=Math.max(...routed.map(o=>o.score),holding?bestCarry:-Infinity);
 return routed.filter(o=>(holding&&o===continuation)||o.score>=best-WORLD.selection.choice.shortlist.v);
}
export function chooseFootballOption<T extends FootballOption>(options:T[],random:()=>number,plan:CarryPlan|null=null,time=0):T{
 const viable=viableOptions(options,plan,time);
 // The held route enters the draw at the value of carrying (see viableOptions).
 const held=viable.find(o=>o.carry&&o.continuing),bestCarry=Math.max(-Infinity,...options.filter(o=>o.carry).map(o=>o.score));
 if(!held||viable.some(o=>o.carry&&o!==held)||bestCarry<=held.score)return chooseAction(viable,random);
 const standIn={...held,score:bestCarry},pick=chooseAction(viable.map(o=>o===held?standIn:o),random);
 return pick===standIn?held:pick;
}
export function commitCarry(p:PracticePlayer,option:CarryOption,time:number,previous:CarryPlan|null):CarryPlan{
 if(option.continuing&&previous)return previous;
 return {aim:{...option.aim},until:time+clamp(distance(p,option.aim)/(p.pace*.68)+.35,1.2,2.2),purpose:option.carry.purpose,reason:option.reason};
}
