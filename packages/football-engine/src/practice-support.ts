import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Side,Tactics} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {arrivalTime} from './practice-defense.js';
import {runReleaseAllowance} from './practice-awareness.js';
import type {ReleaseCue} from './practice-awareness.js';
import type {ConnectionMovement} from './practice-connections.js';
import {launchRisk} from './practice-possession.js';
import {assignBuildUp} from './practice-build-up.js';
import type {TeamShape} from './practice-shape.js';
import {strikeTurnTime} from './practice-striking.js';

export type SupportPurpose='playbook'|'join'|'recovery-outlet'|'recycle'|'overlap'|'give-and-go'|'near-post'|'far-post'|'cutback'|'link'|'channel'|'build-up'|'counter-cover';
export interface SupportMove {
 player:string;purpose:SupportPurpose;kind:'support'|'show'|'run'|'width'|'cover'|'hold'|'press'|'jockey'|'track';
 defensive?:{kind:'press'|'mark'|'protect'|'stay-forward';target?:string};
 aim:Vec;speed:number;until:number;since:number;reason:string;routeAim?:Vec;
}
export interface SupportPlan {owner:string;side:Side;moves:SupportMove[]}
export interface SupportContext {
 time:number;recoveredAt:number;attacking?:boolean;
 shape?:TeamShape;
 /** Only a completed pass: an intended recipient or attempted pass is not enough. */
 lastPass?:{from:string;to:string;at:number};
 /** Movement supporting an actually released pass, not a guaranteed next pass. */
 passContinuation?:ConnectionMovement & {from:string;to:string;until:number};
 /** Each runner's remembered defensive line. Omission preserves exact scene evaluation. */
 lineFor?:(player:PracticePlayer)=>number;
 releaseCue?:ReleaseCue;
 /** Visible meeting point of a travelling pass, not a guaranteed reception. */
 receiving?:{aim:Vec;inSeconds?:number};
}
type LaneRisk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
type Candidate={move:SupportMove;score:number};
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(side:Side,x:number)=>side===0?x:L-x;
const world=(side:Side,x:number)=>side===0?x:L-x;
const inside=(v:Vec):Vec=>({x:clamp(v.x,.8,(L-.8)),y:clamp(v.y,-(W/2-2),(W/2-2))});
const defensive=(p:PracticePlayer)=>p.role==='CB'||p.role==='DM'||p.role==='FB';
const running=(purpose:SupportPurpose)=>['overlap','give-and-go','near-post','cutback','channel'].includes(purpose);
const boxArrival=(purpose:SupportPurpose)=>purpose==='near-post'||purpose==='cutback';
/** Arrive with the possible delivery, rather than sprinting to the destination
 * while the passer is still waiting for the ball. A closing marker removes
 * the luxury of delaying. This changes movement, never pass execution. */
export function timeSupportRun(p:PracticePlayer,aim:Vec,speed:number,reference:PracticePlayer,players:PracticePlayer[],incoming=0):{speed:number;waiting:boolean}{
 const travel=arrivalTime(p,aim),delivery=distance(reference,aim)/(14+reference.skills.passing*.5);
 const ready=incoming+.12+strikeTurnTime(reference,aim);
 const window=ready+delivery-.15;
 const threatened=players.some(q=>q.side!==p.side&&arrivalTime(q,aim)<window+.3);
 const pressured=players.some(q=>q.side!==p.side&&distance(q,reference)<2.5);
 if(threatened||pressured||travel>=window-.2||distance(p,aim)<1.5)return {speed,waiting:false};
 const reading=clamp(p.skills.reading/10,0,1);
 const factor=1-clamp(1-travel/Math.max(.1,window),0,.55)*(.4+.6*reading);
 return {speed:speed*factor,waiting:factor<.9};
}
/** Short travel forecast for sharing space, not collision physics. */
function routePoint(p:PracticePlayer,aim:Vec,speed:number,t:number):Vec{
 const gap=distance(p,aim),u={x:(aim.x-p.x)/Math.max(.01,gap),y:(aim.y-p.y)/Math.max(.01,gap)};
 const along=Math.max(0,p.vx*u.x+p.vy*u.y),travel=Math.min(gap,speed*t,along*t+.5*p.acceleration*t*t);
 return {x:p.x+u.x*travel,y:p.y+u.y*travel};
}
function routeConflict(p:PracticePlayer,aim:Vec,speed:number,q:PracticePlayer,target:Vec,limit:number):number{
 const initial=distance(p,q);
 return Math.max(0,...[.4,.8,1.2].map(t=>{
  const gap=distance(routePoint(p,aim,speed,t),routePoint(q,target,limit,t));
  // A player already squeezed next to a teammate must be allowed to move out.
  return gap>initial+.2?0:clamp((2.4-gap)/2.4,0,1);
 }));
}
/** Shared geometry for normal support locations and coached responsibilities.
 * Uses the same arrival, passing-lane, launch and route-crowding reads as add().
 * It evaluates a location; it does not assign a defender or move any player. */
export function readSupportLocation(p:PracticePlayer,aim:Vec,players:PracticePlayer[],reference:PracticePlayer,laneRisk:LaneRisk,run=false,speed=p.pace*.85){
 const opponents=players.filter(q=>q.side!==p.side),outfield=opponents.filter(q=>q.role!=='GK');
 const gap=distance(reference,aim),travel=arrivalTime(p,aim),room=Math.min(...outfield.map(q=>distance(q,aim)));
 // A clear lane now can be closed by the time the supporter gets there. Read
 // only short visible momentum, not the defenders' future assigned targets.
 const look=Math.min(.65,travel),future=opponents.map(q=>({...q,x:q.x+q.vx*look,y:q.y+q.vy*look}));
 const risk=Math.max(laneRisk(reference,aim,opponents),run?0:launchRisk(reference,aim,players,.2),run?0:laneRisk(reference,aim,future)*.8);
 const referenceAim=inside({x:reference.x+reference.vx*1.2,y:reference.y+reference.vy*1.2});
 const crowding=Math.max(routeConflict(p,aim,speed,reference,referenceAim,reference.pace),...players.filter(q=>q.side===p.side&&q.id!==p.id&&q.id!==reference.id).map(q=>clamp((3.6-distance(aim,q))/3.6,0,1)));
 // Space now is not necessarily time after the pass. The supporter must
 // reach it and the ball must travel there before he can use the opening.
 // This is a conservative read of reachable pressure, not future intentions.
 const delivery=Math.max(travel,.2+gap/(14+reference.skills.passing*.5));
 const closing=Math.min(...outfield.map(q=>arrivalTime(q,aim)));
 const releaseRoom=clamp((closing-delivery)/.8,0,1);
 return {gap,travel,room,risk,crowding,releaseRoom};
}

/** Small escape angles around the pressure, not a second player at the ball.
 * Include a player's current good position so offering support need not mean
 * running continuously. The coach's explicit destinations remain separate.
 * `forward` adds close support on a forward diagonal (5 and 7 m ahead of the
 * ball, off its line): an angle between the lines for a side that combines,
 * still a support position, not a run. */
export function shortSupportPoints(p:PracticePlayer,owner:PracticePlayer,forward=false):Vec[]{
 const s=owner.side===0?1:-1;
 const points=[{x:p.x,y:p.y},...[-9,-6,-3,0,3].flatMap(dx=>[-7,-5,0,5,7].map(dy=>inside({x:owner.x+s*dx,y:owner.y+dy})))];
 if(forward)points.push(...[5,7].flatMap(dx=>[-7,-5,5,7].map(dy=>inside({x:owner.x+s*dx,y:owner.y+dy}))));
 return points;
}
/** The same short return routes are considered before and after a pass. */
export function returnRunPoints(p:PracticePlayer):Vec[]{
 const s=p.side===0?1:-1;
 return [3,6].flatMap(dx=>[-3.5,3.5].map(dy=>inside({x:p.x+s*dx,y:p.y+dy})));
}
/** Ordinary off-ball duties must leave room for the agreed receiver/outlets.
 * Search nearby alternatives; never move the carrier or an assigned runner. */
export function complementarySupportAim(p:PracticePlayer,aim:Vec,players:PracticePlayer[],receiver:PracticePlayer,plan:SupportPlan|null,time:number,meeting:Vec=receiver):Vec{
 if(p.side!==receiver.side||p.id===receiver.id||p.role==='GK'||p.role==='CB'||distance(p,meeting)>25)return aim;
 const moves=plan?.side===p.side?plan.moves.filter(m=>m.until>time):[];
 if(moves.some(m=>m.player===p.id))return aim;
 const reserved=[{p:receiver,aim:meeting,speed:receiver.pace},...moves.flatMap(m=>{
  const mate=players.find(q=>q.id===m.player);return mate?[{p:mate,aim:m.aim,speed:m.speed}]:[];
 })];
 const penalty=(point:Vec)=>Math.max(...reserved.map(q=>
  clamp((3.6-distance(point,q.aim))/3.6,0,1)*2+routeConflict(p,point,p.pace*.7,q.p,q.aim,q.speed)));
 if(penalty(aim)<.2)return aim;
 const opponents=players.filter(q=>q.side!==p.side),s=p.side===0?1:-1;
 const score=(point:Vec)=>penalty(point)+distance(point,aim)*.08+
  Math.max(0,...opponents.map(q=>clamp((3-distance(point,q))/3,0,1)))*1.5;
 const candidates=[aim,...[0,-3].flatMap(dx=>[-3.5,3.5].map(dy=>inside({x:aim.x+s*dx,y:aim.y+dy})))];
 const best=candidates.reduce((best,q)=>score(q)<score(best)-.05?q:best,aim);
 return best;
}
const reasons:Record<SupportPurpose,string>={
 join:'Urcă în legătură cu atacul și pregătește continuarea.',
 playbook:'Urmează traseul planului ales la recuperare.',
 'far-post':'Atacă zona opusă și păstrează un culoar diferit pentru centrare.',
 'recovery-outlet':'Mingea tocmai a fost recuperată; se apropie într-un unghi liber pentru prima pasă.',
 recycle:'Rămâne în legătură cu mingea și păstrează o ieșire în spatele atacului.',
 overlap:'Colegul are mingea în interior; trece pe exterior și oferă o continuare pe flanc.',
 'give-and-go':'După pasa reușită, schimbă linia și caută spațiu pentru o eventuală pasă înapoi.',
 'near-post':'Atacă spațiul din fața porții și lasă zona din spate pentru un coleg.',
 cutback:'Rămâne în urma primei curse, disponibil pentru o pasă întoarsă din lateral.',
 link:'Vine între linii pentru pasă; un coleg atacă spațiul pe care îl lasă în față.',
 channel:'Atacantul vine la pasă; atacă intervalul eliberat pentru continuare.',
 'build-up':'Se conectează la construcție și deschide o pasă de întoarcere.',
 'counter-cover':'Oferă sprijin în spate și păstrează acoperirea pentru o pierdere.',
};

/** A few coordinated movement invitations. Passing, reception and finishing remain separate decisions. */
export function assignSupport(players:PracticePlayer[],owner:PracticePlayer,tactics:Tactics,laneRisk:LaneRisk,context:SupportContext,previous:SupportPlan|null=null,unavailable:ReadonlySet<string>=new Set()):SupportPlan{
 const receiver=owner;
 if(context.receiving)owner={...owner,...context.receiving.aim};
 const {time}=context,bd=depth(owner.side,owner.x),s=owner.side===0?1:-1;
 const mates=players.filter(p=>p.side===owner.side&&p.id!==owner.id&&p.role!=='GK'&&!unavailable.has(p.id));
 const opponents=players.filter(p=>p.side!==owner.side),outfield=opponents.filter(p=>p.role!=='GK');
 const nearest=(v:Vec)=>Math.min(...outfield.map(p=>distance(p,v)));
 const contested=nearest(owner)<2.3||Math.min(...outfield.map(p=>arrivalTime(p,owner)))<.48;
 const recovering=time>=context.recoveredAt&&time-context.recoveredAt<3;
 const actualLine=L;
 const lineFor=(p:PracticePlayer)=>context.lineFor?.(p)??actualLine;
 const allowance=(p:PracticePlayer,purpose:SupportPurpose)=>running(purpose)&&purpose!=='cutback'?runReleaseAllowance(p,time,context.releaseCue):0;
 const legal=(v:Vec,p:PracticePlayer,purpose:SupportPurpose):Vec=>{
  const onside=Math.min(L-1,Math.max((L/2),bd,lineFor(p))-.8+allowance(p,purpose));
  return inside({x:world(owner.side,Math.min(onside,depth(owner.side,v.x))),y:v.y});
 };
 const receivedLink=previous?.side===owner.side&&previous.moves.some(m=>m.purpose==='link'&&m.player===owner.id)&&
  context.lastPass?.to===owner.id&&context.lastPass.from===previous.owner&&time-context.lastPass.at<1.5;
 // A completed pass to the dropping striker can keep the existing runner's
 // invitation alive. A turnover or an unrelated receiver cannot inherit it.
 const old=previous?.side!==owner.side?[]:previous.owner===owner.id||context.receiving?previous.moves:receivedLink?previous.moves.filter(m=>m.purpose==='channel'):[];
 const candidates:Candidate[]=[],chosen:Candidate[]=[];
 const covers=mates.filter(p=>defensive(p)&&depth(owner.side,p.x)<bd-X(3)&&Math.abs(p.y)<Y(24));
 // Real outfield positions, not role labels alone, must provide cover for an attacking run.
 const covered=(p:PracticePlayer)=>covers.some(q=>q.id!==p.id);
 const eligible=mates.filter(p=>p.role!=='CB'&&distance(p,owner)<(bd>X(80)?24:20));
 const baseScore=(p:PracticePlayer,purpose:SupportPurpose,aim:Vec)=>
  purpose==='overlap'?.64+(tactics.commit-3)*.045+(tactics.fullbacks==='overlap'?.12:0):purpose==='give-and-go'?.65:
  purpose==='link'?.78:purpose==='channel'?.76:
  purpose==='near-post'?.76+(p.role==='ST'?.08:0):purpose==='cutback'?.73+(p.role==='CM'||p.role==='AM'?.07:0):
  (purpose==='recovery-outlet'?.66:.5)+(depth(owner.side,aim.x)<=bd?.045:0)-Math.abs(aim.y-p.y)*.003;
 const add=(p:PracticePlayer,purpose:SupportPurpose,point:Vec,kind:SupportMove['kind']=running(purpose)?'run':'support',continuing?:SupportMove)=>{
  const aim=legal(point,p,purpose),gap=distance(aim,owner),travel=arrivalTime(p,aim),room=nearest(aim);
  if(mates.some(q=>q.id!==p.id&&distance(q,aim)<3&&Math.hypot(q.vx,q.vy)<1))return;
  const run=running(purpose),read=readSupportLocation(p,aim,players,owner,laneRisk,run),risk=read.risk;
  // A current passing lane can close while the runner is still moving into useful space.
  // Runs in the attacking half may invite a lifted pass over a closed ground lane.
  // The carrier separately judges whether any actual delivery is viable.
  const continuingBox=!!continuing&&boxArrival(purpose),pressureRelease=continuingBox&&contested;
  const travelLimit=boxArrival(purpose)?3.15:run?3.5:recovering?2.5:3;
  if(gap<3.2||gap>24||room<1.7||!continuingBox&&!(run&&bd>(L/2))&&risk>(run?.88:.78)||travel>travelLimit)return;
  if(p.role==='DM'&&depth(owner.side,aim.x)>bd-X(3))return;
  if(run&&(p.energy<22||p.traits.runs<.2||contested&&!pressureRelease||!covered(p)||p.role==='FB'&&tactics.fullbacks==='hold'))return;
  // Already offside players return toward the ball before being invited to run beyond it.
  const releaseStep=continuing?allowance(p,purpose):0;
  if(run&&(depth(owner.side,p.x)>Math.max((L/2),bd,lineFor(p))+.08+releaseStep||depth(owner.side,aim.x)<depth(owner.side,p.x)-1&&purpose!=='cutback'))return;
  const style=run?(tactics.progression==='direct'?.05:0):(tactics.progression==='patient'?.04:0);
  const affinity=run?p.traits.runs*.18+p.skills.reading*.008:p.traits.comesShort*.15+p.skills.reading*.012;
  const speed=p.pace*(run?.88+clamp(p.traits.runs,0,1)*.06:recovering?.87:.75);
  const receiverAim=context.receiving?.aim??inside({x:owner.x+owner.vx*1.2,y:owner.y+owner.vy*1.2});
  const crowding=routeConflict(p,aim,speed,receiver,receiverAim,receiver.pace);
  const score=baseScore(p,purpose,aim)+affinity+style+clamp(room/7,0,1)*.16-risk*(run?.38:.72)-travel*.115-crowding*.65
   -(run?(1-p.energy/100)*.14:(1-read.releaseRoom)*.3)+(continuing?.14:0);
  if(score<.24)return;
  candidates.push({score,move:{player:p.id,purpose,kind,aim,speed,routeAim:distance(point,aim)>.1?{...point}:undefined,
   until:continuing?.until??time+clamp(travel+.35,1,boxArrival(purpose)||purpose==='link'||purpose==='channel'?3.5:1.7),since:continuing?.since??time,reason:reasons[purpose]}});
 };
 const supportPurpose:SupportPurpose=recovering?'recovery-outlet':'recycle';
 for(const p of eligible){
  // A pivot can come toward a recovery while remaining on the defensive side of the ball.
  for(const point of shortSupportPoints(p,owner)){
   if(distance(p,point)>14||Math.abs(point.y-p.y)>16)continue;
   const homeward=depth(owner.side,point.x)<=bd;
   add(p,supportPurpose,point,p.role==='DM'?'cover':homeward?'support':'show');
  }
 }
 const attacks=context.attacking!==false&&!recovering&&owner.role!=='GK';
 const wide=Math.abs(owner.y)>Y(14);
 const possible=(p:PracticePlayer,purpose:SupportPurpose,continuing=false)=>{
  if(!attacks||!covered(p)||p.role==='DM'||p.role==='CB')return false;
  if(context.receiving&&!continuing&&nearest(owner)<3)return false;
  if(contested&&!(continuing&&boxArrival(purpose)))return false;
  if(p.role==='FB'&&tactics.fullbacks==='hold')return false;
  if(purpose==='link')return tactics.striker==='link'&&bd>X(35)&&bd<X(79)&&p.role==='ST'&&(continuing||depth(owner.side,p.x)>bd+X(9));
  if(purpose==='channel')return tactics.striker==='link'&&bd>X(35)&&bd<X(86)&&['W','ST'].includes(p.role)&&
   (continuing||mates.some(q=>q.id!==p.id&&q.role==='ST'&&depth(owner.side,q.x)>bd+X(9)))&&distance(owner,p)<29;
  if(purpose==='overlap')return bd>X(40)&&bd<X(86)&&wide&&(tactics.commit>=3||tactics.fullbacks==='overlap')&&p.role==='FB'&&p.y*owner.y>0&&
   // Starting from behind is a launch cue, not a reason to abort while overtaking.
   (continuing||depth(owner.side,p.x)<bd+2)&&distance(owner,p)<21&&Math.abs(owner.y)<Y(28)&&
   !mates.some(q=>q.id!==p.id&&q.role==='FB'&&depth(owner.side,q.x)>bd+2);
  if(purpose==='give-and-go')return context.lastPass?.from===p.id&&context.lastPass.to===owner.id&&
   time>=context.lastPass.at&&time-context.lastPass.at<2.2&&distance(owner,p)<18&&bd>X(22)&&bd<X(88)&&p.traits.runs>.2;
  return bd>X(80)&&wide&&['ST','W','AM','CM'].includes(p.role)&&distance(owner,p)<32;
 };
 for(const p of eligible){
  if(possible(p,'link')){
   for(const dy of [-Y(6),Y(6)])add(p,'link',{x:owner.x+s*X(8),y:clamp(owner.y+dy,-Y(15),Y(15))},'show');
  }
  if(possible(p,'channel')){
   const striker=mates.find(q=>q.id!==p.id&&q.role==='ST');
   if(striker)add(p,'channel',{x:world(owner.side,Math.min(X(94),depth(owner.side,striker.x)+X(7))),y:p.lane===0?(p.y<owner.y?-Y(9):Y(9)):p.lane*Y(10)});
  }
  if(possible(p,'overlap'))add(p,'overlap',{x:owner.x+s*X(9),y:Math.sign(owner.y)*Math.min(Y(31),Math.abs(owner.y)+Y(7))});
  if(possible(p,'give-and-go')){
   // Two visible channels: no knowledge of the receiver's next action or a guaranteed return pass.
   for(const dy of [-3.5,3.5])add(p,'give-and-go',{x:owner.x+s*3.5,y:owner.y+dy});
  }
  if(possible(p,'near-post')){
   const flank=Math.sign(owner.y);
   add(p,'near-post',{x:world(owner.side,Math.min(X(96),bd+X(3))),y:flank*Y(5.5)});
   add(p,'cutback',{x:world(owner.side,clamp(bd-X(7),X(79),X(89))),y:-flank*Y(3.5)});
  }
 }
 for(const move of old){
  const p=eligible.find(q=>q.id===move.player);
  if(!p||time>=move.until||distance(owner,move.aim)>24||distance(move.aim,legal(move.aim,p,move.purpose))>.1&&allowance(p,move.purpose)===0)continue;
  if(running(move.purpose)||move.purpose==='link'?!possible(p,move.purpose,true):move.purpose!==supportPurpose)continue;
  add(p,move.purpose,move.routeAim??move.aim,move.kind,move);
 }
 candidates.sort((a,b)=>b.score-a.score||a.move.player.localeCompare(b.move.player)||a.move.purpose.localeCompare(b.move.purpose));
 const free=(c:Candidate)=>!chosen.some(q=>q.move.player===c.move.player||distance(q.move.aim,c.move.aim)<3.6||
  routeConflict(mates.find(p=>p.id===c.move.player)!,c.move.aim,c.move.speed,mates.find(p=>p.id===q.move.player)!,q.move.aim,q.move.speed)>.35);
 const take=(c:Candidate|undefined)=>{if(c)chosen.push(c);};
 // Launch complementary invitations together. A lone runner does not assume
 // that a striker will vacate the space when no usable linking position exists.
 const link=candidates.find(c=>c.move.purpose==='link'&&candidates.some(q=>q.move.purpose==='channel'&&q.move.player!==c.move.player&&distance(q.move.aim,c.move.aim)>=3.6));
 if(link){take(link);take(candidates.find(c=>c.move.purpose==='channel'&&free(c)));}
 // Two box arrivals occupy different depths. Outside the box only one additional forward run is needed.
 const runCandidates=candidates.filter(c=>running(c.move.purpose)&&(c.move.purpose!=='channel'||old.some(m=>m.purpose==='channel'&&m.player===c.move.player)));
 const firstRun=chosen.find(c=>running(c.move.purpose))??runCandidates.find(free);if(firstRun&&!chosen.includes(firstRun))take(firstRun);
 if(firstRun&&(firstRun.move.purpose==='near-post'||firstRun.move.purpose==='cutback'))
  take(runCandidates.find(c=>free(c)&&c.move.purpose===(firstRun.move.purpose==='near-post'?'cutback':'near-post')));
 const outlets=candidates.filter(c=>!running(c.move.purpose)&&c.move.purpose!=='link');
 const continuingOutlets=old.filter(m=>(m.purpose==='recovery-outlet'||m.purpose==='recycle')&&m.until>time).length;
 for(let i=0;i<(recovering||context.receiving||continuingOutlets>=2?2:1);i++){
  take(outlets.find(c=>free(c)&&chosen.filter(q=>!running(q.move.purpose)).every(q=>{
   const a={x:c.move.aim.x-owner.x,y:c.move.aim.y-owner.y},b={x:q.move.aim.x-owner.x,y:q.move.aim.y-owner.y};
   return (a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y))<.65;
  })));
 }
 const overlap=chosen.find(c=>c.move.purpose==='overlap');
 if(overlap){
  const far=mates.find(p=>p.role==='FB'&&p.id!==overlap.move.player&&p.y*owner.y<0);
  if(far){
   // Explicitly balance the other flank so its generic attacking width duty cannot vacate it too.
   const existing=chosen.findIndex(c=>c.move.player===far.id);if(existing>=0)chosen.splice(existing,1);
   chosen.push({score:0,move:{player:far.id,purpose:'recycle',kind:'cover',aim:inside({x:world(owner.side,clamp(bd-X(10),X(18),X(75))),y:clamp(far.y,-Y(23),Y(23))}),
    speed:far.pace*.8,until:overlap.move.until,since:time,reason:'Celălalt fundaș urcă; ține flancul opus în spatele mingii.'}});
  }
 }
 const moves=chosen.map(c=>{
  const move=c.move,p=mates.find(p=>p.id===move.player)!;
  if(move.kind==='run'){
   const timing=timeSupportRun(p,move.aim,move.speed,owner,players,context.receiving?.inSeconds);
   move.speed=timing.speed;if(timing.waiting)move.reason+=' Temperează cursa pentru a sosi odată cu pasa posibilă.';
  }
  return move;
 });
 moves.push(...assignBuildUp(players,receiver,tactics,laneRisk,context,moves,previous,unavailable));
 return {owner:owner.id,side:owner.side,moves:moves.sort((a,b)=>a.player.localeCompare(b.player))};
}
