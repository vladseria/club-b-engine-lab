import * as S from './style.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp,Side} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {controlReleaseAvailable} from './practice-control.js';
import type {RestartRoutine,RestartLive} from './practice-restart-live.js';
export type RestartKind='kickoff'|'throw'|'goalKick'|'corner'|'freeKick'|'indirect'|'penalty';
export interface RestartInfo {kind:RestartKind;side:Side;spot:Vec;taker:string;phase:'gather'|'ready'}
export interface Restart extends RestartInfo {organized?:boolean;ready:number;legalSince:number|null;positions:Record<string,Vec>;
 /** Live setup (coordinated policy): the routine's slots/posts and the latest plan. */
 routine?:RestartRoutine;live?:RestartLive|null;readyAt?:number;
 /** A manager's routine is in use (its plan id). */
 authored?:string;
 /** Past the routine's hard cap: where the engine holds players until the kick. */
 settle?:{at:number;aims:Record<string,Vec>};
 /** A free kick with a called routine (Short / Into the box; absent for Mixed). */
 call?:'short'|'delivery'}
/** An authored routine may keep its players on their spots this long past the
 * normal setup; after that only the Laws' distances hold the kick. It applies
 * to every restart kind, at the set-up check and at the release. */
export const ROUTINE_SETUP_GRACE=3;
/** The hard cap on an authored routine's set-up, past the normal setup: if the
 * Laws still hold the kick, the engine stops waiting on the routine's spots
 * and the live re-planning (see practice-restart-live settleRestart). */
export const ROUTINE_SETUP_CAP=6;
/** How often the engine re-reads who still blocks the kick once capped. */
export const ROUTINE_SETTLE_EVERY=2;
/** Past the grace, an authored routine waits only for the Laws. */
export const routineRelaxed=(restart:{authored?:string;ready:number;call?:string},time:number)=>(!!restart.authored||!!restart.call)&&time>=restart.ready+ROUTINE_SETUP_GRACE;
const depth=(side:Side,x:number)=>side===0?x:L-x;
const world=(side:Side,x:number)=>side===0?x:L-x;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(p:Vec):Vec=>({x:clamp(p.x,.3,(L-.3)),y:clamp(p.y,-(W/2-0.3),(W/2-0.3))});
export const restartLabels:Record<RestartKind,string>={kickoff:'Lovitură de începere',penalty:'PENALTY',throw:'Aruncare de la margine',goalKick:'Repunere de la poartă',corner:'Corner',freeKick:'Lovitură liberă',indirect:'Lovitură indirectă'};

/** A boundary-clamped setup can put the ball underneath the taker. Keep the
 * ordinary setup when playable; otherwise find a real stance beside the ball.
 * This moves only the body destination, never the restart spot or kick rules. */
export function restartKickPosition(p:PracticePlayer,spot:Vec,aim:Vec,kind:RestartKind):Vec{
 const dx=aim.x-spot.x,dy=aim.y-spot.y,length=Math.hypot(dx,dy)||1;
 const angle=Math.atan2(dy,dx),margin=kind==='corner'?.8:-.3;
 const bounded=(v:Vec)=>({x:clamp(v.x,-margin,L+margin),y:clamp(v.y,-W/2-margin,W/2+margin)});
 const ideal={x:spot.x-dx/length*.65,y:spot.y-dy/length*.65},normal=bounded(ideal);
 const playable=(v:Vec)=>controlReleaseAvailable({...p,...v,angle:Math.atan2(aim.y-v.y,aim.x-v.x)},spot,aim);
 if(playable(normal))return normal;
 const candidates:Vec[]=[];
 for(let i=0;i<24;i++){
  const a=angle+Math.PI+i*Math.PI/12,v={x:spot.x+Math.cos(a)*.65,y:spot.y+Math.sin(a)*.65},b=bounded(v);
  if(distance(v,b)>1e-8||!playable(v))continue;
  candidates.push(v);
 }
 candidates.sort((a,b)=>distance(a,ideal)-distance(b,ideal)||distance(a,p)-distance(b,p));
 return candidates[0]??normal;
}

/** Project onto a legal point on the pitch, rather than clamping back inside the exclusion circle. */
export function outsideBall(aim:Vec,spot:Vec,radius:number):Vec {
 const bounded=inside(aim);if(distance(bounded,spot)>=radius)return bounded;
 const direction=Math.atan2(aim.y-spot.y,aim.x-spot.x);
 let best:Vec|undefined,cost=Infinity;
 for(let i=0;i<72;i++){
  const angle=direction+i*Math.PI/36,point={x:spot.x+Math.cos(angle)*radius,y:spot.y+Math.sin(angle)*radius};
  if(point.x<.3||point.x>(L-.3)||Math.abs(point.y)>W/2-.3)continue;
  const value=distance(point,bounded);if(value<cost){cost=value;best=point;}
 }
 return best??bounded;
}

const freeKickWallCount=(side:Side,spot:Vec)=>{
 const at=depth(side,spot.x),goalDistance=Math.hypot(L-at,spot.y);
 const goalAngle=Math.abs(Math.atan2(GH-spot.y,Math.max(.01,L-at))-Math.atan2(-GH-spot.y,Math.max(.01,L-at)));
 return goalDistance>=6&&goalDistance<=34&&goalAngle>.19?(goalDistance<25?2:1):0;
};
/** The defenders who form the wall (none out of shooting range). */
export function freeKickWall(side:Side,spot:Vec,players:PracticePlayer[]):PracticePlayer[]{
 return players.filter(p=>p.side!==side&&p.role!=='GK').sort((a,b)=>(a.role==='CB'?1:0)-(b.role==='CB'?1:0)||b.skills.defending-a.skills.defending).slice(0,freeKickWallCount(side,spot));
}
/** The free-kick call sets the routine in their half (settings round,
 * 2026-10-03); Mixed keeps the formula below unchanged.
 *  - Into the box ('delivery'): the two best in the air on the posts (near
 *    post on the ball's side, far post) and the next on the edge of the box
 *    for the knock-down. Nobody stays back: a cleared ball is a counter.
 *  - Short: the two best passers as short options at different angles (one
 *    square and inside, one behind and outside), the best in the air in the box.
 * The defending side's free outfielders pick up our men in the box first. */
export type FreeKickCall='mixed'|'short'|'delivery';
export const FK_NEAR={depth:L-S.FREE_KICK_COMMON.nearDepth.v,y:S.FREE_KICK_COMMON.nearY.v},FK_FAR={depth:L-S.FREE_KICK_COMMON.farDepth.v,y:S.FREE_KICK_COMMON.farY.v},FK_EDGE={depth:L-BOX_DEPTH-S.FREE_KICK_COMMON.edgeDepth.v,y:S.FREE_KICK_COMMON.edgeY.v},FK_SHORT_SQUARE=S.FREE_KICK_COMMON.shortSquare.v,FK_SHORT_BACK={depth:S.FREE_KICK_COMMON.shortBackDepth.v,y:S.FREE_KICK_COMMON.shortBackY.v},FK_BOX={depth:L-S.FREE_KICK_COMMON.boxDepth.v,y:S.FREE_KICK_COMMON.boxY.v};
export function freeKickCallAims(side:Side,spot:Vec,taker:string,players:PracticePlayer[],call:FreeKickCall):{aims:Record<string,Vec>;box:string[]}|null{
 const at=depth(side,spot.x);
 if(!S.FREE_KICK[call].callsRoutine.v||at<L/2)return null;
 const allies=players.filter(p=>p.side===side&&p.id!==taker&&p.role!=='GK');
 const g=spot.y>=0?1:-1,aims:Record<string,Vec>={},box:string[]=[];
 const remaining=[...allies];
 const take=(value:(p:PracticePlayer)=>number)=>{const p=remaining.slice().sort((a,b)=>value(b)-value(a)||a.id.localeCompare(b.id))[0];if(p)remaining.splice(remaining.indexOf(p),1);return p;};
 const header=(p:PracticePlayer)=>p.skills.aerial*.6+p.skills.strength*.3+p.skills.finishing*.1;
 const passer=(p:PracticePlayer)=>p.skills.passing*.7+p.skills.control*.3;
 const put=(p:PracticePlayer|undefined,d:number,y:number,inBox=false)=>{if(!p)return;aims[p.id]={x:world(side,d),y:clamp(y,-(W/2-2),W/2-2)};if(inBox)box.push(p.id);};
 if(S.FREE_KICK[call].callsDelivery.v){
  put(take(header),FK_NEAR.depth,g*FK_NEAR.y,true);
  put(take(header),FK_FAR.depth,-g*FK_FAR.y,true);
  put(take(header),Math.min(FK_EDGE.depth,Math.max(at+3,FK_EDGE.depth-4)),-g*FK_EDGE.y);
 }else{
  put(take(header),FK_BOX.depth,-g*FK_BOX.y,true);
  put(take(passer),at,spot.y-g*FK_SHORT_SQUARE);
  put(take(passer),at-FK_SHORT_BACK.depth,spot.y+g*FK_SHORT_BACK.y);
 }
 for(const p of remaining)put(p,at-X(10),0);
 return {aims,box};
}
/** A wall for shooting positions, with a short outlet and onside delivery receivers. */
function freeKickPositions(side:Side,spot:Vec,taker:string,players:PracticePlayer[],call:FreeKickCall='mixed'):Record<string,Vec>{
 const positions:Record<string,Vec>={},at=depth(side,spot.x);
 const routine=freeKickCallAims(side,spot,taker,players,call);
 const attacking=at>=X(63),wallCount=freeKickWallCount(side,spot);
 const allies=players.filter(p=>p.side===side&&p.id!==taker&&p.role!=='GK');
 const opponents=players.filter(p=>p.side!==side&&p.role!=='GK');
 const attackers=allies.slice().sort((a,b)=>({ST:5,AM:4,W:3,CM:2,DM:1,FB:0,CB:0,GK:0}[b.role])-({ST:5,AM:4,W:3,CM:2,DM:1,FB:0,CB:0,GK:0}[a.role])||b.skills.finishing-a.skills.finishing);
 const receivers=attacking?attackers.slice(0,1):[];
 const support=allies.filter(p=>!receivers.includes(p)).sort((a,b)=>b.skills.passing-a.skills.passing)[0]??allies[0];
 const wall=freeKickWall(side,spot,players);
 const goalSide=spot.y>=0?1:-1,wallTarget={x:world(side,L),y:goalSide*G(2.2)};
 const wx=wallTarget.x-spot.x,wy=wallTarget.y-spot.y,wl=Math.hypot(wx,wy),ux=wx/wl,uy=wy/wl;
 for(const p of players){
  let aim:Vec;
  if(p.id===taker)aim={x:spot.x+(side===0?-.65:.65),y:spot.y};
  else if(p.side===side&&routine&&routine.aims[p.id])aim=routine.aims[p.id];
  else if(p.side!==side&&routine&&p.role!=='GK'&&!wall.includes(p)&&opponents.filter(q=>!wall.includes(q)).indexOf(p)<routine.box.length){
   // Our men in the box are picked up first, goal-side of them.
   const man=routine.aims[routine.box[opponents.filter(q=>!wall.includes(q)).indexOf(p)]];
   aim={x:world(side,Math.min(L-.8,depth(side,man.x)+1.5)),y:man.y+(man.y>=0?-.8:.8)};
  }
  else if(p.side===side){
   if(p.role==='GK')aim={x:world(side,X(6)),y:0};
   else if(p===support)aim={x:world(side,clamp(at-3,2,X(101))),y:clamp(spot.y+(spot.y>=0?-Y(8):Y(8)),-Y(30),Y(30))};
   else if(receivers.includes(p)){
    const i=receivers.indexOf(p);aim={x:world(side,clamp(Math.max(X(84),at+X(6))-i*1.7,X(80),X(93))),y:[-Y(7),2,Y(11)][i]};
   }else if(attacking){
    const i=allies.filter(q=>q!==support&&!receivers.includes(q)).indexOf(p);
    aim={x:world(side,clamp(at-X(10)-(p.role==='CB'?X(12):0),X(12),X(78))),y:(i-2)*Y(8)};
   }else{
    const i=allies.filter(q=>q!==support).indexOf(p);
    aim={x:world(side,clamp(at+(p.role==='CB'?-X(9):p.role==='DM'?-1:p.role==='CM'?X(9):X(20)),4,X(82))),y:clamp((i%3-1)*Y(14)+spot.y*.25,-Y(29),Y(29))};
   }
  }else if(p.role==='GK'){
   const back=wallCount?1.1:clamp((L-at)*.1,.6,4);
   aim={x:world(side,L-back),y:wallCount?-goalSide*G(1.3):clamp(spot.y*back/Math.max(1,L-at),-G(2.8),G(2.8))};
   // A close indirect kick may legally keep the goalkeeper on the goal line.
   if(distance(aim,spot)<5.65)aim={x:world(side,(L-.3)),y:clamp(spot.y,-G(2.8),G(2.8))};
  }else if(wall.includes(p)){
   const offset=(wall.indexOf(p)-(wall.length-1)/2)*1.7;
   aim={x:spot.x+ux*5.65-uy*offset,y:spot.y+uy*5.65+ux*offset};
  }else{
   const i=opponents.filter(q=>!wall.includes(q)).indexOf(p);
   if(attacking&&i<receivers.length){
    const receiver=receivers[i],n=receivers.indexOf(receiver);
    aim={x:world(side,clamp(Math.max(X(84),at+X(6))-n*1.7,X(80),X(93))+1.8),y:[-Y(7),2,Y(11)][n]+1.5};
   }else aim={x:world(side,clamp(at+(attacking?X(13):X(15))+(i%2)*3,X(20),X(96))),y:clamp((i-(attacking?4:4))*Y(6),-Y(29),Y(29))};
  }
  if(p.id!==taker&&p.side===side)aim=outsideBall(aim,spot,2.8);
  else if(p.side!==side){
   const onGoalLine=depth(p.side,aim.x)<=.35&&Math.abs(aim.y)<=GH;
   if(!onGoalLine)aim=outsideBall(aim,spot,5.65);
  }
  positions[p.id]=inside(aim);
 }
 // Destinations must also be physically occupiable under the movement engine's
 // body separation, including attackers' mandatory distance from a 3+ player wall.
 const placed:Vec[]=[];
 for(const p of [players.find(p=>p.id===taker)!,...players.filter(p=>p.id!==taker)]){
  const original=positions[p.id];let best=original,cost=Infinity;
  for(let i=0;i<73;i++){
   const ring=i===0?0:Math.ceil(i/24)*1.8,angle=i*Math.PI/12;
   let point=inside({x:original.x+Math.cos(angle)*ring,y:original.y+Math.sin(angle)*ring});
   const onGoalLine=p.side!==side&&depth(p.side,point.x)<=.35&&Math.abs(point.y)<=GH;
   if(p.id!==taker)point=outsideBall(point,spot,p.side===side?2.8:onGoalLine?0:5.65);
   const overlap=placed.reduce((n,q)=>n+Math.max(0,1.7-distance(q,point)),0);
   const wallGap=p.side===side&&wallCount>=3?wall.reduce((n,q)=>n+Math.max(0,1.8-distance(positions[q.id],point)),0):0;
   const value=distance(original,point)+(overlap+wallGap)*100;
   if(value<cost){best=point;cost=value;}if(value===0)break;
  }
  positions[p.id]=best;placed.push(best);
 }
 return positions;
}

/** A simple mixed corner setup: targets, a short option, second ball and
 * counter cover. Slots are assigned to players; ordinary steering gets them there. */
function cornerPositions(side:Side,spot:Vec,taker:string,players:PracticePlayer[]):Record<string,Vec>{
 const positions:Record<string,Vec>={},flank=Math.sign(spot.y)||1;
 const allies=players.filter(p=>p.side===side&&p.id!==taker&&p.role!=='GK');
 const remaining=[...allies];
 const take=(score:(p:PracticePlayer)=>number)=>{
  const p=remaining.slice().sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];
  if(p)remaining.splice(remaining.indexOf(p),1);return p;
 };
 const targetValue=(p:PracticePlayer)=>p.skills.finishing*.6+p.skills.strength*.4+(p.role==='ST'?3:p.role==='CB'?1:0);
 const targets=Array.from({length:Math.min(1,Math.max(0,allies.length-2))},()=>take(targetValue)!);
 const short=take(p=>p.skills.passing+(p.role==='W'||p.role==='CM'?3:0)-distance(p,spot)*.04);
 const edge=remaining.length>2?take(p=>p.skills.reading+p.skills.passing*.5):undefined;
 const box=[{x:X(96),y:flank*Y(6)},{x:X(94),y:-flank*Y(7)},{x:X(90),y:flank}];
 const put=(p:PracticePlayer|undefined,at:Vec)=>{if(p)positions[p.id]=inside({x:world(side,at.x),y:at.y});};
 targets.forEach((p,i)=>put(p,box[i]));
 put(short,{x:X(96),y:flank*Y(26)});put(edge,{x:X(83),y:-flank*Y(3)});
 remaining.sort((a,b)=>b.skills.defending-a.skills.defending||a.id.localeCompare(b.id));
 remaining.forEach((p,i)=>put(p,{x:i<2?X(59):X(72),y:i<2?(i?Y(12):-Y(12)):(i-2)*Y(12)-Y(6)}));
 const opponents=players.filter(p=>p.side!==side&&p.role!=='GK').sort((a,b)=>b.skills.defending-a.skills.defending||a.id.localeCompare(b.id));
 opponents.forEach((p,i)=>{
  if(i<targets.length)put(p,{x:box[i].x+1.7,y:box[i].y+flank*1.4});
  else {const j=i-targets.length;put(p,[{x:X(101),y:flank*Y(4.5)},{x:X(96),y:flank*Y(17)},{x:X(86),y:-flank*Y(3)},{x:X(92),y:-flank*Y(14)},{x:X(81),y:flank*Y(15)},{x:X(66),y:0},{x:X(74),y:-flank*Y(18)}][j]??{x:X(75)-j,y:flank*Y(24)});}
 });
 for(const p of players){
  if(p.role==='GK')put(p,{x:p.side===side?X(36):X(103.5),y:p.side===side?0:flank*G(1.5)});
  if(p.id===taker)positions[p.id]={x:spot.x+(side===0?-.65:.65),y:spot.y};
 }
 return positions;
}

/** One teammate shows inside the touchline while one remains behind the ball.
 * These are movement destinations, never a condition for taking the throw. */
function throwPositions(side:Side,spot:Vec,taker:string,players:PracticePlayer[]):Record<string,Vec>{
 const positions:Record<string,Vec>={},at=depth(side,spot.x),inward=spot.y>=0?-1:1;
 const allies=players.filter(p=>p.side===side&&p.id!==taker&&p.role!=='GK');
 const opponents=players.filter(p=>p.side!==side&&p.role!=='GK');
 const cover=allies.slice().sort((a,b)=>
  Number(!['CB','DM'].includes(a.role))-Number(!['CB','DM'].includes(b.role))||depth(side,a.x)-depth(side,b.x)||a.id.localeCompare(b.id))[0];
 if(cover)positions[cover.id]=inside({x:world(side,Math.max(2,Math.min(depth(side,cover.x),at-4.5))),y:clamp(cover.y,-6,6)});
 const candidates=allies.filter(p=>p!==cover).flatMap(p=>[-4,-2,2,4].flatMap(dx=>[3.5,5].map(dy=>{
  const aim=inside({x:world(side,clamp(at+dx,1,L-1)),y:spot.y+inward*dy});
  const room=Math.min(...opponents.map(q=>distance(q,aim))),gap=distance(spot,aim);
  const score=distance(p,aim)*.14+Math.max(0,3-room)*1.4+Math.abs(gap-5)*.08-p.traits.comesShort*.25-p.skills.reading*.015;
  return {p,aim,score};
 }))).sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id));
 const support=candidates[0];if(support)positions[support.p.id]=support.aim;
 return positions;
}

export function restartPositions(kind:RestartKind,side:Side,spot:Vec,taker:string,players:PracticePlayer[],organized=false,call:FreeKickCall='mixed'):Record<string,Vec>{
 if(kind==='freeKick'||kind==='indirect')return freeKickPositions(side,spot,taker,players,call);
 // Organized (live) throws use Law 15's 2 m; the classic setup keeps its old radius.
 const throwRadius=organized&&kind==='throw'?2.4:0;
 const formation=kind==='throw'?throwPositions(side,spot,taker,players):organized&&kind==='corner'?cornerPositions(side,spot,taker,players):undefined;
 const positions=Object.fromEntries(players.map(p=>{
  let aim=formation?.[p.id]??{x:p.x,y:p.y};
  if(p.id===taker)aim={x:clamp(spot.x+(side===0?-.65:.65),.3,(L-.3)),y:spot.y};
  else if(kind==='penalty'){
   if(p.role==='GK')aim={x:world(p.side,p.side!==side?.3:X(6)),y:0};
   else aim={x:world(side,Math.min(L-BOX_DEPTH-3,depth(side,p.x))),y:p.y||(p.side===side?-3:3)};
  }else if(kind==='kickoff'){
   const d=p.role==='GK'?X(6):p.role==='CB'?X(25):p.role==='FB'?X(29):p.role==='DM'?X(38):p.role==='CM'?X(43):X(48);
   aim={x:world(p.side,d),y:p.lane*(p.role==='W'||p.role==='FB'?Y(27):Y(12))};
  }
  // A teammate standing on the spot can otherwise push the taker out of range forever.
  if(p.id!==taker&&p.side===side&&distance(aim,spot)<2.5){
   const dx=aim.x-spot.x||(side===0?1:-1),dy=aim.y-spot.y,d=Math.hypot(dx,dy);
   aim={x:clamp(spot.x+dx/d*2.8,.3,(L-.3)),y:clamp(spot.y+dy/d*2.8,-(W/2-0.3),(W/2-0.3))};
  }
  if(p.id!==taker&&p.side!==side&&!(kind==='penalty'&&p.role==='GK')&&distance(aim,spot)<(throwRadius?throwRadius-.2:5.25)){
   const dx=aim.x-spot.x||(side===0?-1:1),dy=aim.y-spot.y,d=Math.hypot(dx,dy),r=throwRadius||5.45;
   aim=outsideBall({x:spot.x+dx/d*r,y:spot.y+dy/d*r},spot,r);
  }
  return [p.id,aim];
 }));
 // Two central roles can project to the same point on the centre circle.
 // Give each an occupiable destination, otherwise body separation can push
 // one inside the legal radius forever even after everyone has gathered.
 const placed:Vec[]=[];
 for(const p of [players.find(p=>p.id===taker)!,...players.filter(p=>p.id!==taker)]){
  const original=positions[p.id];let best=original,cost=Infinity;
  for(let i=0;i<73;i++){
   const ring=i===0?0:Math.ceil(i/24)*1.8,angle=i*Math.PI/12;
   let point=inside({x:original.x+Math.cos(angle)*ring,y:original.y+Math.sin(angle)*ring});
   if(p.id!==taker){
    if(kind==='kickoff')point.x=world(p.side,Math.min((L/2-.3),depth(p.side,point.x)));
    if(kind==='penalty'&&p.role!=='GK')point.x=world(side,Math.min(L-BOX_DEPTH-3,depth(side,point.x)));
    // At penalties teammates must also remain 5m away. Give both teams the
    // same approach margin, so ordinary braking cannot stop a legal target's
    // player just inside the exclusion circle and block the restart forever.
    const radius=kind==='penalty'?(p.side!==side&&p.role==='GK'?0:5.45):p.side===side?2.8:throwRadius||5.45;
    point=outsideBall(point,spot,radius);
   }
   if(!restartPlayersReady({kind,side,spot,taker},[{...p,...point,vx:0,vy:0}]))continue;
   const overlap=placed.reduce((n,q)=>n+Math.max(0,1.7-distance(q,point)),0);
   const value=distance(original,point)+overlap*100;
   if(value<cost){best=point;cost=value;}if(value===0)break;
  }
  positions[p.id]=best;placed.push(best);
 }
 return positions;
}

type ReadyScene=Pick<RestartInfo,'kind'|'side'|'spot'|'taker'>&{organized?:boolean;positions?:Record<string,Vec>;routine?:RestartRoutine;call?:'short'|'delivery'};
/** Defenders standing as a free-kick wall (5 to 7.35 m, goal-side of the ball):
 * with three or more, attackers must keep 1 m from them. */
export function freeKickWallNow(restart:Pick<RestartInfo,'kind'|'side'|'spot'>,players:readonly PracticePlayer[]):PracticePlayer[]{
 const {kind,side,spot}=restart;
 return kind==='freeKick'||kind==='indirect'?players.filter(p=>p.side!==side&&p.role!=='GK'&&distance(p,spot)>=5&&distance(p,spot)<7.35&&depth(side,p.x)>depth(side,spot.x)):[];
}
/** Check actual positions, not assigned destinations, and keep checking until the kick. */
export function restartPlayersReady(restart:ReadyScene,players:PracticePlayer[],relaxed=false):boolean{
 return players.every(readyCheck(restart,players,relaxed));
}
/** The players who hold the kick up right now (the same check, per player). */
export function restartBlockers(restart:ReadyScene,players:PracticePlayer[],relaxed=false):PracticePlayer[]{
 return players.filter(p=>!readyCheck(restart,players,relaxed)(p));
}
function readyCheck(restart:ReadyScene,players:PracticePlayer[],relaxed:boolean):(p:PracticePlayer)=>boolean{
 const {kind,side,spot,taker}=restart;
 const wall=freeKickWallNow(restart,players);
 return p=>{
  if(p.id===taker)return distance(p,spot)<=1&&Math.hypot(p.vx,p.vy)<.6;
  if(p.x<0||p.x>L||Math.abs(p.y)>W/2)return false;
  // Live setups also hold the Laws' distances: 2 m at a throw, everyone
  // outside the area at a goal kick until the ball is in play.
  if(restart.routine&&p.side!==side){
   if(kind==='throw'&&distance(p,spot)<2)return false;
   if(kind==='goalKick'&&depth(side,p.x)<BOX_DEPTH-.2&&Math.abs(p.y)<BOX_HALF-.2)return false;
  }
  if(kind==='corner'&&restart.organized){
   // A live corner waits for its routine's players, not for players the coordinator moves.
   const aim=restart.routine&&!restart.routine.slots[p.id]&&!restart.routine.posts[p.id]?undefined:restart.positions?.[p.id];
   // A slot player is set anywhere inside his leash around the slot.
   const reach=(restart.routine?.slots[p.id]?.leash??0)+2.5;
   return (p.side===side||distance(p,spot)>=5)&&(relaxed||!aim||distance(p,aim)<reach);
  }
  if(kind==='kickoff')return depth(p.side,p.x)<=(L/2)&&(p.side===side||distance(p,spot)>=5);
  if(kind==='penalty'){
   if(p.role==='GK'&&p.side!==side)return depth(p.side,p.x)<=.55&&Math.abs(p.y)<=G(3.1);
   const behind=depth(side,p.x)<L-SPOT,box=depth(side,p.x)>(L-BOX_DEPTH)&&Math.abs(p.y)<BOX_HALF;
   return behind&&!box&&distance(p,spot)>=5;
  }
  if(kind==='freeKick'||kind==='indirect'){
   if(p.side!==side&&depth(side,spot.x)<BOX_DEPTH&&Math.abs(spot.y)<BOX_HALF&&depth(side,p.x)<BOX_DEPTH&&Math.abs(p.y)<BOX_HALF)return false;
   // As at a penalty, a body centre within .55m permits a foot on the line.
   if(p.side!==side)return distance(p,spot)>=5||(depth(p.side,p.x)<=.55&&Math.abs(p.y)<=GH);
   if(wall.length>=3&&wall.some(q=>distance(p,q)<1))return false;
   // Into the box waits, like a live corner, for its men to be set inside
   // their leash (at most ROUTINE_SETUP_GRACE past the setup); a short
   // routine is played as soon as it is on.
   if(S.FREE_KICK[restart.call??'mixed'].callsDelivery.v&&p.side===side){
    const slot=restart.routine?.slots[p.id],aim=restart.positions?.[p.id];
    if(slot&&aim&&!slot.authored&&!relaxed&&distance(p,aim)>=slot.leash+2.5)return false;
   }
  }
  return true;
 };
}
