import * as S from './style.js';
import {L,W,BOX_DEPTH,BOX_HALF,SPOT,X,Y} from './pitch.js';
import {clamp} from './model.js';
import type {Side,Tactics} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import type {RestartKind,RestartInfo} from './practice-restarts.js';
import {outsideBall,freeKickWall,freeKickWallNow,restartBlockers} from './practice-restarts.js';
import {coordinateFootball} from './practice-coordination.js';
import type {CoordinationPlan} from './practice-coordination.js';
import {readSupportLocation} from './practice-support.js';
import type {SupportMove,SupportPurpose} from './practice-support.js';
import {keeperReadyPosition} from './practice-keeper.js';
import {arrivalTime} from './practice-defense.js';
import {offGoalLine} from './practice-defending.js';
import {WORLD} from './world.js';

/**
 * Live restarts: between the stoppage and the kick nobody waits on a fixed
 * point. Every assignment tick the ordinary coordinator plans the scene as if
 * the taker already stood on the ball, so the taking side offers (short,
 * spread, in behind, a cover) and the defending side marks, screens and
 * presses the short option. The Laws then bound where each may go.
 *
 * A ROUTINE is the set-piece layer on top: slots for particular players with
 * a leash. Inside the leash the player keeps looking for the most useful
 * space; leash 0 is a fixed post (a wall, a goalkeeper on his line). The
 * engine's own routines come from the restart formulas. An authored routine
 * (a manager's corner scene) is the same shape and replaces them per player.
 */
export interface RestartSlot {aim:Vec;leash:number;purpose:SupportPurpose;reason:string;
 /** Constraint on where the space may be found (a goal-kick short option stays outside the area). */
 outsideBox?:boolean;
 /** The manager's own spot (a routine): the engine does not reassign him. */
 authored?:boolean}
export interface RestartRoutine {
 /** Taking-side slots: re-picked inside their leash every assignment tick. */
 slots:Record<string,RestartSlot>;
 /** Fixed posts on either side (wall, keeper on his line). The coordinator leaves them alone. */
 posts:Record<string,Vec>;
}
export interface RestartJob {aim:Vec;speed:number;reason:string;velocity?:Vec;slot?:boolean}
export interface RestartLive {plan:CoordinationPlan;jobs:Record<string,RestartJob>;
 /** Goal kick against a high press: the team-mate running into the space behind it. */runner?:string;
 /** The defending side's set-piece template deal (setPieceTemplate): each man's task (and man). */template?:Record<string,string>}
type LaneRisk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
type Scene=Pick<RestartInfo,'kind'|'side'|'spot'|'taker'>;

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(side:Side,x:number)=>side===0?x:L-x;
const world=depth;
const inside=(p:Vec):Vec=>({x:clamp(p.x,.8,L-.8),y:clamp(p.y,-(W/2-.8),W/2-.8)});
const inBox=(side:Side,v:Vec,margin=0)=>depth(side,v.x)<BOX_DEPTH+margin&&Math.abs(v.y)<BOX_HALF+margin;

/** Restarts whose setup is live (kickoffs and penalties keep their formal lines). */
export const liveRestart=(kind:RestartKind)=>kind==='throw'||kind==='goalKick'||kind==='corner'||kind==='freeKick'||kind==='indirect';
/** Opponents' distance from the ball: Law 15 (2 m) at throws, the scaled 9.15 m (5 m) elsewhere. */
export const THROW_DISTANCE=2;
/** A throw's cover (the rest defence): THROW_GUARD m goal-side of their most advanced forward, or THROW_COVER m behind the ball. */
export const THROW_GUARD=2,THROW_COVER=WORLD.geometry.restartLive.THROW_COVER.v;
/** Live aims keep a margin beyond the legal distance: a marker tracking a
 * moving man otherwise brakes just inside the circle and holds the kick up. */
export const restartRadius=(kind:RestartKind)=>kind==='throw'?THROW_DISTANCE+.8:kind==='freeKick'||kind==='indirect'?6.4:6.2;
/** The taker's longest wait, after he is set, for an option to open. */
export const RESTART_HOLD:Partial<Record<RestartKind,number>>={throw:2,goalKick:3,corner:2.5,freeKick:2.5,indirect:2.5};
/** A chosen option this risky is worth one more look while team-mates are still moving. */
export const RESTART_HOLD_RISK=.3;
/** A short goal kick is played only when clearly on: a keeper's pass cut out
 * at the edge of his own area is the costliest turnover there is. */
export const RESTART_GOAL_KICK_RISK=.15;
/** A throw farther than this is not an "open option" worth taking without waiting. */
export const THROW_OPEN_RANGE=16;
/** A goal kick beyond this distance is a long ball. */
export const GOAL_KICK_LONG=WORLD.geometry.restartLive.GOAL_KICK_LONG.v;
/** Defenders nearer their opponents' goal line than this are pressing the goal kick. */
export const GOAL_KICK_PRESS_DEPTH=WORLD.geometry.restartLive.GOAL_KICK_PRESS_DEPTH.v;
/** A ground goal kick passing this close to a presser is contested: he is
 * poised at the edge of the area and the ball reaches him in under half a
 * second, which is how 17–22 m ground kicks were cut out 7–9 m from goal
 * (evidence/2026-09-29-style-balance side check; the presser stood 1.1–2.7 m
 * off the lane in every own-third interception probed). */
export const GOAL_KICK_CONTEST=3;
/** How far `q` stands from the straight lane from → to (Infinity when he is not alongside it). */
function laneGap(from:Vec,to:Vec,q:Vec):number{
 const d=distance(from,to);if(d<.01)return Infinity;
 const ux=(to.x-from.x)/d,uy=(to.y-from.y)/d,t=(q.x-from.x)*ux+(q.y-from.y)*uy;
 return t<=0||t>=d?Infinity:Math.abs((q.y-from.y)*ux-(q.x-from.x)*uy);
}

/** Project out of the defending area (goal kick; a free kick inside the taker's own area). */
function outsideArea(side:Side,v:Vec):Vec{
 if(!inBox(side,v,.8))return v;
 const d=depth(side,v.x),toFront=BOX_DEPTH+.8-d,toSide=BOX_HALF+.8-Math.abs(v.y);
 return toFront<=toSide?{x:world(side,BOX_DEPTH+.8),y:v.y}:{x:v.x,y:(Math.sign(v.y)||1)*(BOX_HALF+.8)};
}
/** Where the Laws let a player stand before the kick. The taker is never moved. */
export function legalRestartAim(scene:Scene,p:PracticePlayer,aim:Vec):Vec{
 if(p.id===scene.taker)return aim;
 let v=inside(aim);
 // A team-mate on the spot can push the taker off the ball.
 if(p.side===scene.side)return distance(v,scene.spot)<2.8?outsideBall(v,scene.spot,2.8):v;
 const ownArea=scene.kind==='goalKick'||(scene.kind==='freeKick'||scene.kind==='indirect')&&inBox(scene.side,scene.spot);
 if(ownArea)v=outsideArea(scene.side,v);
 const r=restartRadius(scene.kind);
 if(distance(v,scene.spot)<r){v=outsideBall(v,scene.spot,r);if(ownArea)v=outsideArea(scene.side,v);}
 return v;
}

const roleRank:Record<string,number>={ST:6,AM:5,W:4,CM:3,DM:2,FB:1,CB:0,GK:-1};
/** The engine's own routine for a restart. Player choice happens once, at the
 * stoppage; only the space inside each leash is re-read afterwards. */
/** A manager's routine over the engine's own: his spots replace the engine's
 * slots for those players (a wall or keeper post of the other side stays). */
export function authoredRoutine(base:RestartRoutine,spots:Record<string,{aim:Vec;leash:number}>):RestartRoutine{
 const slots={...base.slots};
 for(const [id,s] of Object.entries(spots))slots[id]={aim:{...s.aim},leash:s.leash,purpose:'playbook',reason:'Își ia locul din rutina antrenorului; în raza aleasă caută spațiul liber.',authored:true};
 const posts=Object.fromEntries(Object.entries(base.posts).filter(([id])=>!spots[id]));
 return {slots,posts};
}
export function restartRoutine(scene:Scene,players:PracticePlayer[],formula:Record<string,Vec>,call:'mixed'|'short'|'delivery'='mixed'):RestartRoutine{
 const {kind,side,spot,taker}=scene,at=depth(side,spot.x),slots:Record<string,RestartSlot>={},posts:Record<string,Vec>={};
 const mates=players.filter(p=>p.side===side&&p.id!==taker&&p.role!=='GK');
 const opponents=players.filter(p=>p.side!==side);
 if(kind==='throw'){
  const inward=spot.y>=0?-1:1;
  const cover=mates.slice().sort((a,b)=>Number(!['CB','DM'].includes(a.role))-Number(!['CB','DM'].includes(b.role))||depth(side,a.x)-depth(side,b.x)||a.id.localeCompare(b.id))[0];
  // (defending-close round, the owner's img-98: the cover kept his own depth, so a man caught near his own
  // box stood there, wide and alone, through a throw in their half) He is the rest defence: goal-side of
  // their most advanced forward when that forward is ahead of the throw, central; with nobody there, a
  // cover THROW_COVER m behind the ball, towards the middle, for the throw back.
  const forward=opponents.filter(q=>q.role!=='GK').sort((a,b)=>depth(side,a.x)-depth(side,b.x)||a.id.localeCompare(b.id))[0];
  const fd=forward?depth(side,forward.x):Infinity,guard=fd<at-1;
  const coverAim:Vec={x:world(side,Math.max(2.5,guard?Math.min(at-WORLD.geometry.restartLive.throwCoverBehind.v,fd-THROW_GUARD):at-THROW_COVER)),y:guard?clamp(forward!.y*.6,WORLD.geometry.restartLive.throwCoverWide.v,WORLD.geometry.restartLive.throwCoverWideMax.v):clamp(spot.y*.35,WORLD.geometry.restartLive.throwCoverWide.v,WORLD.geometry.restartLive.throwCoverWideMax.v)};
  if(cover)slots[cover.id]={aim:inside(coverAim),leash:2.5,purpose:'counter-cover',reason:guard?'Rămâne între atacantul lor cel mai avansat și poarta noastră, spre mijloc, pentru cazul în care pierdem mingea.':'Rămâne în urma mingii, spre mijloc, gata pentru o aruncare înapoi și pentru acoperire.'};
  const short=mates.filter(p=>p!==cover).map(p=>({p,score:distance(p,spot)*.14-p.traits.comesShort*.25-p.skills.reading*.015})).sort((a,b)=>a.score-b.score||a.p.id.localeCompare(b.p.id))[0]?.p;
  if(short)slots[short.id]={aim:inside({x:world(side,clamp(at+(depth(side,short.x)>=at?2:-2),1,L-1)),y:spot.y+inward*4.5}),leash:3.5,purpose:'recycle',reason:'Vine scurt spre aruncare și își caută spațiul liber de marcaj.'};
 }else if(kind==='goalKick'){
  // Build-up shape: two spread to the edges of the area, one short just
  // outside it, one longer. Fewer players fill the list in this order.
  const byDepth=mates.slice().sort((a,b)=>(roleRank[a.role]??3)-(roleRank[b.role]??3)||a.id.localeCompare(b.id));
  const long=byDepth.length>=4?byDepth.pop():undefined;
  const wide=byDepth.slice(0,2).sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id)),shortOne=byDepth[2];
  wide.forEach((p,i)=>{const flank=wide.length===1?(p.y>=0?1:-1):i===0?-1:1;
   slots[p.id]={aim:{x:world(side,BOX_DEPTH-1.5),y:flank*(BOX_HALF+2)},leash:3,purpose:'build-up',reason:'Se deschide lat, la marginea careului, ca portarul să aibă o pasă scurtă sigură.'};});
  if(shortOne)slots[shortOne.id]={aim:{x:world(side,BOX_DEPTH+3),y:shortOne.y>=0?3:-3},leash:3.5,purpose:'recycle',outsideBox:true,reason:'Coboară chiar în afara careului și se oferă scurt, între adversari.'};
  if(long)slots[long.id]={aim:{x:world(side,X(62)),y:clamp(long.y,-Y(12),Y(12))},leash:5,purpose:'channel',reason:'Rămâne sus, o variantă pentru repunerea lungă dacă jocul scurt e închis.'};
 }else if(kind==='corner'){
  // Organized corners: the formula's target / short / edge / cover slots.
  const flank=Math.sign(spot.y)||1;
  for(const p of mates){
   const aim=formula[p.id];if(!aim)continue;const d=depth(side,aim.x);
   const box=d>L-BOX_DEPTH-1&&Math.abs(aim.y)<BOX_HALF;
   const short=Math.abs(aim.y)>BOX_HALF&&aim.y*flank>0&&d>L-BOX_DEPTH-2;
   slots[p.id]=box?{aim,leash:2.5,purpose:'near-post',reason:'Se mișcă în careu să scape de marcaj înainte de centrare.'}:
    short?{aim,leash:3,purpose:'recycle',reason:'Oferă varianta scurtă a cornerului și își caută unghiul.'}:
    d<X(66)?{aim,leash:2.5,purpose:'counter-cover',reason:'Rămâne în urmă pentru acoperire, atent la contraatac.'}:
    {aim,leash:3,purpose:'cutback',reason:'Pândește mingea respinsă la marginea careului.'};
  }
  for(const p of players.filter(p=>p.role==='GK'&&p.side!==side))posts[p.id]=formula[p.id];
 }else if(kind==='freeKick'||kind==='indirect'){
  // Wall and the defending keeper hold their posts; receivers and the short
  // outlet from the formula keep hunting space around their slots.
  const wall=freeKickWall(side,spot,players);
  for(const p of opponents)if((wall.includes(p)||p.role==='GK')&&formula[p.id])posts[p.id]=formula[p.id];
  for(const p of mates){
   const aim=formula[p.id];if(!aim)continue;
   const box=depth(side,aim.x)>=X(80)&&Math.abs(aim.y)<BOX_HALF+2,short=distance(aim,spot)<11;
   if(box)slots[p.id]={aim,leash:2.5,purpose:'far-post',reason:'Se mișcă în fața porții ca să scape de marcaj înaintea execuției.'};
   else if(short)slots[p.id]={aim,leash:3,purpose:'recycle',reason:'Se oferă scurt pentru o lovitură liberă jucată rapid.'};
   // A called routine (practice-restarts freeKickCallAims): the man on the
   // edge of the box waits for the knock-down; a short option further away
   // than the formula's keeps his angle.
   else if(S.FREE_KICK[call].callsRoutine.v&&depth(side,aim.x)>=L-BOX_DEPTH-WORLD.geometry.restartLive.cutbackBeyondBox.v&&Math.abs(aim.y)<BOX_HALF)slots[p.id]={aim,leash:3,purpose:'cutback',reason:'Pândește mingea respinsă la marginea careului.'};
   else if(S.FREE_KICK[call].callsShort.v&&distance(aim,spot)<14)slots[p.id]={aim,leash:3,purpose:'recycle',reason:'Se oferă scurt, în alt unghi, pentru lovitura liberă jucată scurt.'};
  }
 }
 return {slots,posts};
}

/** Best space around a slot: the ordinary support read from the ball, plus
 * room, a small preference for the slot itself and for the last pick. */
/** Attackers keep this far from a free-kick wall of three or more (the Law's
 * 1 m, plus a margin so braking does not stop a man just inside it). */
export const WALL_GAP=1.4;
function pickSpace(p:PracticePlayer,slot:RestartSlot,scene:Scene,virtual:PracticePlayer[],reference:PracticePlayer,laneRisk:LaneRisk,previous?:Vec,run=false):Vec{
 const candidates:Vec[]=[slot.aim];
 if(previous)candidates.push(previous);
 if(slot.leash>0)for(const r of [slot.leash/2,slot.leash])for(let i=0;i<8;i++){const a=i*Math.PI/4;candidates.push({x:slot.aim.x+Math.cos(a)*r,y:slot.aim.y+Math.sin(a)*r});}
 // A manager's spot never puts his man against a wall of three (the engine's
 // own slots come from a formula that already keeps the gap). If the spot is
 // there, the nearest points clear of the wall are offered, beyond the leash:
 // the Law outranks the leash.
 const wall=slot.authored?freeKickWallNow(scene,virtual):[];
 const againstWall=(v:Vec)=>wall.length>=3&&wall.some(q=>distance(q,v)<WALL_GAP);
 if(wall.length>=3)for(const q of wall){const d=distance(q,slot.aim);if(d<WALL_GAP){const u=d>.01?{x:(slot.aim.x-q.x)/d,y:(slot.aim.y-q.y)/d}:{x:scene.side===0?-1:1,y:0};candidates.push({x:q.x+u.x*(WALL_GAP+.2),y:q.y+u.y*(WALL_GAP+.2)});}}
 let best=legalRestartAim(scene,p,slot.aim),value=-Infinity;
 for(const c of candidates){
  let aim=legalRestartAim(scene,p,c);
  if(slot.outsideBox&&inBox(scene.side,aim,.5))continue;
  if(againstWall(aim))continue;
  if(distance(aim,slot.aim)>slot.leash+.5&&!(wall.length>=3&&distance(aim,slot.aim)<=slot.leash+WALL_GAP+.7))continue;
  const read=readSupportLocation(p,aim,virtual,reference,laneRisk,run);
  const score=(1-read.risk)+read.releaseRoom*.8+clamp(read.room/6,0,1)*.4-read.crowding*.8-read.travel*.06-distance(aim,slot.aim)*.04+(previous&&distance(aim,previous)<1?.12:0);
  if(score>value){value=score;best=aim;}
 }
 return best;
}

/** Past an authored routine's hard cap the engine stops waiting: every
 * defender holds a fixed point (where he stands, or the nearest point the
 * Laws allow), and a routine player who still holds the kick up (against a
 * wall of three) leaves his spot for the nearest legal point. Fixed points
 * cannot be swapped between markers every re-plan, which is how a routine's
 * short spot inside the defenders' 5 m kept two of them crossing the ball's
 * circle for minutes. The Laws' distances are the aims; nothing is waived. */
export function settleRestart(scene:Scene&{routine?:RestartRoutine;positions?:Record<string,Vec>;organized?:boolean},players:PracticePlayer[]):{aims:Record<string,Vec>;released:string[]}{
 const blocking=new Set(restartBlockers(scene,players,true).map(p=>p.id)),wall=freeKickWallNow(scene,players),aims:Record<string,Vec>={},released:string[]=[];
 for(const p of players){
  if(p.id===scene.taker)continue;
  if(p.side!==scene.side){aims[p.id]=blocking.has(p.id)?legalRestartAim(scene,p,{x:p.x,y:p.y}):{x:p.x,y:p.y};continue;}
  if(!blocking.has(p.id))continue;
  let aim:Vec={x:p.x,y:p.y};
  for(const q of wall){const d=distance(q,aim);if(d<WALL_GAP){const u=d>.01?{x:(aim.x-q.x)/d,y:(aim.y-q.y)/d}:{x:scene.side===0?-1:1,y:0};aim={x:q.x+u.x*(WALL_GAP+.2),y:q.y+u.y*(WALL_GAP+.2)};}}
  aims[p.id]=legalRestartAim(scene,p,aim);released.push(p.id);
 }
 return {aims,released};
}

/** Defending round (2026-10-03, step 1), rewritten in the defending-close
 * round (2026-10-04): defending a corner, a close free kick or a kick-in near
 * our goal. A template of fixed zones (spot, back post, the man at the ball)
 * put two or three men in the goal area whatever the number of attackers
 * there, left the outlet at the top of the box free and stood a "spot" man
 * behind a free kick's wall. Now the defending outfielders (the wall's men
 * apart) read the attackers in front of them and take, most important first:
 *  - every attacker in or at our box, marked goal-side and ball-side
 *    (setPieceMark): between him and the goal, and on the side the ball comes
 *    from, so a run to the near post is met in front of him;
 *  - the spot (corners and kick-ins): just goal-side of the penalty spot,
 *    where most futsal goals come from, unless a marker already stands there;
 *  - the outlet at the top of the box (the cut-back and the long shot);
 *  - the short option near the ball;
 *  - only then a zone: the back post when two or more attackers are in the
 *    box (one runner is his marker's), the man at the ball (at the legal
 *    distance towards the near post, against the short corner and the low
 *    near-post ball), the edge of the box for the second ball.
 * So the number of men in zones in the goal area follows the attackers there,
 * and nobody stands in it with no attacker to deal with. At a free kick the
 * wall (freeKickWall: one or two men by distance and angle, the keeper
 * covering the far side) is the man at the ball, and nobody stands on the
 * spot behind it. Each runs to his task from where he is: the tasks are dealt
 * by the shortest total run, keeping last tick's deal unless another is
 * clearly shorter (TEMPLATE_KEEP s). After the kick the zones hold for
 * SET_PIECE_HOLD s, switching to a runner who enters them (ANCHOR_ZONE m), and
 * every marker keeps his man (CoordinationPlan.anchors). Authored routines are
 * the attackers'; the defending template applies to every side. */
export const TEMPLATE_FK=WORLD.geometry.restartLive.TEMPLATE_FK.v,TEMPLATE_THROW=WORLD.geometry.restartLive.TEMPLATE_THROW.v,TEMPLATE_KEEP=.5,TEMPLATE_KEEP_MAN=1.2,SET_PIECE_HOLD=1.2;
/** Who an attacker is at our set piece: in or at the box (BOX_IN m of the goal), the outlet at its top (OUTLET_IN m, central), or the short option (SHORT_IN m of the ball). */
export const SP_BOX_IN=WORLD.geometry.restartLive.SP_BOX_IN.v,SP_OUTLET_IN=WORLD.geometry.restartLive.SP_OUTLET_IN.v,SP_SHORT_IN=9,SP_ROUND=.6,SP_ZONE_CLEAR=2.5;
export type SetPieceTask='spot'|'mark'|'back-post'|'ball'|'edge'|'screen';
export interface SetPieceDeal {task:SetPieceTask;aim:Vec;target?:string;
 /** Why he marks this man: in the box, the outlet at its top, the short option. */
 role?:'box'|'outlet'|'short'}
/** A set piece's marker: goal-side of where his man is going and on the side the
 * ball comes from (ball-side), so the delivery to him passes his marker first;
 * the nearer the man is to the goal line, the more ball-side (a goal-side spot
 * there is the keeper's line). Never on the goal line. */
export function setPieceMark(man:Vec&{vx?:number;vy?:number},ball:Vec,defending:Side,gap=1):Vec{
 const g={x:world(defending,0),y:0},a={x:man.x+(man.vx??0)*.4,y:man.y+(man.vy??0)*.4};
 const dg=distance(a,g)||1,db=distance(a,ball)||1;
 // (out at the spot he is mostly goal-side, a shade to the ball; at the near post, mostly ball-side)
 const dd=depth(defending,a.x),wg=clamp(dd/5,.25,1),wb=clamp(1.2-dd/6,.3,1);
 let ux=(g.x-a.x)/dg*wg+(ball.x-a.x)/db*wb,uy=(g.y-a.y)/dg*wg+(ball.y-a.y)/db*wb,n=Math.hypot(ux,uy);
 if(n<.2){ux=(ball.x-a.x)/db;uy=(ball.y-a.y)/db;n=1;}
 return offGoalLine(defending,{x:a.x+ux/n*gap,y:a.y+uy/n*gap},{x:ball.x,y:ball.y,mode:'loose'});
}
export function setPieceTemplate(scene:Scene,players:readonly PracticePlayer[],posts:Readonly<Record<string,Vec>>,previous?:Readonly<Record<string,string>>):Record<string,SetPieceDeal>|null{
 const {kind,side,spot,taker}=scene,defending=(1-side) as Side,at=depth(defending,spot.x);
 const freeKick=kind==='freeKick'||kind==='indirect';
 if(!(kind==='corner'||freeKick&&at<=TEMPLATE_FK||kind==='throw'&&at<=TEMPLATE_THROW))return null;
 const defenders=players.filter(p=>p.side===defending&&p.role!=='GK'&&!posts[p.id]);
 if(!defenders.length)return null;
 const flank=Math.sign(spot.y)||1,point=(d:number,y:number):Vec=>({x:world(defending,d),y});
 const goal=point(0,0);
 const wall=Object.keys(posts).some(id=>players.some(p=>p.id===id&&p.side===defending&&p.role!=='GK'));
 // the attackers in front of us, where they are going (0.4 s ahead)
 const reads=players.filter(a=>a.side===side&&a.role!=='GK'&&a.id!==taker).map(a=>{
  const v={x:a.x+a.vx*.4,y:a.y+a.vy*.4},d=distance(v,goal),dd=depth(defending,v.x);
  const box=dd<BOX_DEPTH+.5&&Math.abs(v.y)<BOX_HALF+.5||d<SP_BOX_IN;
  const outlet=!box&&d<SP_OUTLET_IN&&Math.abs(v.y)<BOX_HALF+3.5;
  const short=!box&&!outlet&&distance(v,spot)<SP_SHORT_IN;
  const danger=clamp((WORLD.geometry.restartLive.dangerFrom.v-d)/WORLD.geometry.restartLive.dangerSpan.v,0,1)*clamp(1-(Math.abs(v.y)-WORLD.geometry.restartLive.dangerCentral.v)/WORLD.geometry.restartLive.dangerWideSpan.v,.3,1);
  return {a,v,d,box,outlet,short,danger};
 });
 const inBox=reads.filter(r=>r.box).sort((x,y)=>y.danger-x.danger||x.a.id.localeCompare(y.a.id));
 const outlets=reads.filter(r=>r.outlet).sort((x,y)=>x.d-y.d||x.a.id.localeCompare(y.a.id));
 const shorts=reads.filter(r=>r.short).sort((x,y)=>distance(x.v,spot)-distance(y.v,spot)||x.a.id.localeCompare(y.a.id));
 const mark=(r:typeof reads[number],role:'box'|'outlet'|'short'):SetPieceDeal=>({task:'mark',role,target:r.a.id,aim:setPieceMark(r.a,spot,defending,role==='box'?1:1.3)});
 const spotAim=point(SPOT-.5,flank*.5);
 const r=restartRadius(kind)+.3,near=point(4,flank*3),toNear=distance(near,spot)||1;
 const ballAim={x:spot.x+(near.x-spot.x)/toNear*r,y:spot.y+(near.y-spot.y)/toNear*r};
 const edge=point(BOX_DEPTH+.5,flank*1.5),screen=point(BOX_DEPTH+1.5,-flank*2.5),back=point(1.8+.5,-flank*2.2);
 const tasks:SetPieceDeal[]=[];
 if(inBox[0])tasks.push(mark(inBox[0],'box'));
 // the spot: corners and kick-ins (at a free kick it is behind the wall), unless a marker stands on it
 const spotTaken=()=>tasks.some(t=>distance(t.aim,spotAim)<2);
 if(!freeKick&&!spotTaken())tasks.push({task:'spot',aim:spotAim});
 for(const x of inBox.slice(1))tasks.push(mark(x,'box'));
 for(const x of outlets)tasks.push(mark(x,'outlet'));
 for(const x of shorts)tasks.push(mark(x,'short'));
 // the spare men: zones, the goal area's only as attackers come into it
 if(inBox.length>=2)tasks.push({task:'back-post',aim:back});
 if(!wall&&!shorts.length)tasks.push({task:'ball',aim:ballAim});
 // (a zone beside a man a team-mate marks would only be two on him: it is left for the next)
 const clear=(aim:Vec)=>!tasks.some(t=>t.target&&distance(reads.find(x=>x.a.id===t.target)!.v,aim)<SP_ZONE_CLEAR);
 if(clear(edge))tasks.push({task:'edge',aim:edge});
 if(!freeKick&&!spotTaken())tasks.push({task:'spot',aim:spotAim});
 // (every defender has a task: one left over would take the open-play job and land on a man already marked)
 if(clear(screen))tasks.push({task:'screen',aim:screen});
 if(!tasks.some(t=>t.task==='edge'))tasks.push({task:'edge',aim:edge});
 if(!tasks.some(t=>t.task==='ball'))tasks.push({task:'ball',aim:ballAim});
 const use=tasks.slice(0,Math.min(tasks.length,defenders.length));
 const key=(t:SetPieceDeal)=>t.target?`${t.task}:${t.target}`:t.task;
 // the shortest total run over every dealing of the tasks (at most 4! x 4)
 let best:{cost:number;deal:PracticePlayer[]}|undefined;
 const pick=(i:number,left:PracticePlayer[],deal:PracticePlayer[],cost:number)=>{
  if(best&&cost>=best.cost)return;
  if(i===use.length){best={cost,deal:deal.slice()};return;}
  for(const p of left){
   // (a man once taken is kept: a marker does not hand his man over just before the kick)
   // (a marker who would have to get round his man to reach his side pays for it: SP_ROUND s)
   const man=use[i].target?reads.find(x=>x.a.id===use[i].target):undefined;
   const round=man&&distance(p,use[i].aim)>distance(man.a,use[i].aim)+.3&&distance(p,man.a)<distance(p,use[i].aim)?SP_ROUND:0;
   const c=(arrivalTime(p,use[i].aim)+round)*(i===0?1.2:1)-(previous?.[p.id]===key(use[i])?(use[i].target?TEMPLATE_KEEP_MAN:TEMPLATE_KEEP):0);
   deal.push(p);pick(i+1,left.filter(q=>q!==p),deal,cost+c);deal.pop();
  }
 };
 pick(0,defenders,[],0);
 if(!best)return null;
 const out:Record<string,SetPieceDeal>={};
 best.deal.forEach((p,i)=>{out[p.id]=use[i];});
 return out;
}
export const setPieceKey=(t:SetPieceDeal)=>t.target?`${t.task}:${t.target}`:t.task;
const TEMPLATE_REASON:Record<SetPieceTask,string>={
 spot:'Fază fixă: ține punctul de la 6 m, de unde vin cele mai multe goluri.',
 mark:'Fază fixă: își marchează omul, între el și poartă, pe partea dinspre minge.',
 edge:'Fază fixă: ține marginea careului, pentru mingea respinsă.',
 screen:'Fază fixă: ține mijlocul la marginea careului, pentru mingea respinsă și șutul de departe.',
 'back-post':'Fază fixă: în careu sunt doi adversari; ține bara a doua, la un pas de linie (linia e a portarului).',
 ball:'Fază fixă: stă la distanța regulamentară, între minge și bara apropiată, contra variantei scurte.'};
const MARK_REASON={box:'Fază fixă: îl marchează pe omul din careu, între el și poartă, pe partea dinspre minge.',outlet:'Fază fixă: ia omul de la marginea careului (mingea întoarsă, șutul de departe).',short:'Fază fixă: ia varianta scurtă de lângă minge.'};

export interface LiveContext {time:number;tactics:[Tactics,Tactics];laneRisk:LaneRisk;lineFor?:(p:PracticePlayer)=>number}
/** One assignment tick of a live restart. The taker walks to the ball on his own; everyone else gets a job. */
export function planLiveRestart(scene:Scene,routine:RestartRoutine,players:PracticePlayer[],context:LiveContext,previous:RestartLive|null):RestartLive{
 const {kind,side,spot,taker}=scene,{time,laneRisk}=context;
 const kicker=players.find(p=>p.id===taker)!,reference:PracticePlayer={...kicker,x:spot.x,y:spot.y,vx:0,vy:0};
 const virtual=players.map(p=>p.id===taker?reference:p);
 const jobs:Record<string,RestartJob>={};
 const moves:SupportMove[]=[];
 const run=kind==='goalKick'?pressRun(scene,routine,players,previous):null;
 for(const [id,routineSlot] of Object.entries(routine.slots)){
  const p=players.find(q=>q.id===id);if(!p)continue;
  const running=run?.player===id,slot=running?run!.slot:routineSlot;
  const aim=pickSpace(p,slot,scene,virtual,reference,laneRisk,previous?.jobs[id]?.aim,running);
  const far=distance(p,aim)>6;
  jobs[id]={aim,speed:p.pace*(running?.92:far?.85:.7),reason:slot.reason,slot:true};
  moves.push({player:id,purpose:slot.purpose,kind:running?'run':'support',aim,speed:jobs[id].speed,since:time,until:time+.5,reason:slot.reason});
 }
 const unavailable=new Set(Object.keys(routine.posts));
 // The defending side's plan is the open-play one (practice-defending), told
 // that the taker cannot be tackled: his man waits at the legal distance,
 // goal-side; nobody covers or goes for the ball; everyone else marks.
 const plan=coordinateFootball(virtual,{x:spot.x,y:spot.y,vx:0,vy:0,z:0,vz:0,owner:taker,mode:'loose'},side,context.tactics,laneRisk,
  {time,recoveredAt:-10,lineFor:context.lineFor,responsibilities:()=>moves.length?{owner:taker,side,moves}:null,restart:{spot:{x:spot.x,y:spot.y},radius:restartRadius(kind),posts:Object.keys(routine.posts)}},previous?.plan??null,unavailable);
 // Defending round (step 1): the set-piece template (setPieceTemplate).
 const template=setPieceTemplate(scene,virtual,routine.posts,previous?.template);
 if(template){
  // the zones hold after the kick; the man at the ball goes for the short option; every marker keeps his man
  plan.anchors={side:(1-side) as Side,until:Infinity,aims:Object.fromEntries(Object.entries(template).filter(([,t])=>t.task!=='mark'&&t.task!=='ball').map(([id,t])=>[id,t.aim])),
   names:Object.fromEntries(Object.entries(template).filter(([,t])=>t.task!=='mark'&&t.task!=='ball').map(([id,t])=>[id,t.task])),
   marks:Object.fromEntries(Object.entries(template).filter(([,t])=>t.task==='mark'&&t.target).map(([id,t])=>[id,t.target!]))};
  // the plan's jobs say what the template asks of each man (his zone by name, or the man he marks)
  for(const [id,t] of Object.entries(template)){
   const old=plan.jobs[id];if(!old)continue;
   plan.jobs[id]={...old,purpose:t.task,kind:t.task==='mark'?'track':'hold',aim:t.aim,target:t.target,reason:t.role?MARK_REASON[t.role]:TEMPLATE_REASON[t.task]};
   if(t.target)plan.marks.set(id,t.target);else plan.marks.delete(id);
   // his man is his man after the kick too
   if(t.target&&plan.defending)plan.defending.men[id]={target:t.target,since:time};
  }
 }
 // the wall's men: their job says so (the coordinator leaves them alone)
 const defendingSide=(1-side) as Side;
 for(const [id,post] of Object.entries(routine.posts)){
  const p=players.find(q=>q.id===id);if(!p||p.side!==defendingSide||p.role==='GK'||plan.jobs[id])continue;
  plan.jobs[id]={player:id,purpose:'wall',kind:'hold',aim:{...post},speed:p.pace*.8,reason:'Ține zidul la distanța regulamentară, pe linia mingii spre bara apropiată; portarul acoperă cealaltă parte.',since:time,until:time+.5};
 }
 for(const p of players){
  if(p.id===taker||jobs[p.id])continue;
  const post=routine.posts[p.id];
  if(post){jobs[p.id]={aim:post,speed:p.pace*.8,reason:p.role==='GK'?'Își ține poziția în poartă până la execuție.':'Ține zidul la distanța regulamentară.'};continue;}
  if(p.role==='GK'&&p.side!==side){
   const aim=keeperReadyPosition(p,{x:spot.x,y:spot.y},false);
   jobs[p.id]={aim,speed:p.pace*.6,reason:'Își potrivește poziția în poartă după locul de unde se reia jocul.'};continue;
  }
  const slot=template?.[p.id];
  if(slot){
   const man=slot.target?players.find(q=>q.id===slot.target):undefined;
   const legal=legalRestartAim(scene,p,slot.aim);
   // (his spot already leads the man: no velocity matching on top, or he overruns a man who stops)
   // (a marker arriving at his man's side settles there: close to it he slows, or he runs past it and must come round the man)
   jobs[p.id]={aim:legal,speed:p.pace*(man?(distance(p,legal)<3?.6:.95):distance(p,legal)>6?.85:.75),reason:slot.role?MARK_REASON[slot.role]:TEMPLATE_REASON[slot.task]};
   continue;
  }
  const job=plan.jobs[p.id];if(!job)continue;
  let aim=job.aim,velocity=job.velocity,reason=job.reason;
  // A selective press does not follow every goal-kick option up to the area:
  // only the defender closing the short option does; the rest hold a block.
  if(kind==='goalKick'&&p.side!==side&&job.purpose!=='press'&&S.PRESS[context.tactics[p.side].press].goalKickBlock.v&&depth(side,aim.x)<GOAL_KICK_PRESS_DEPTH+1){
   aim={x:world(side,GOAL_KICK_PRESS_DEPTH+1),y:aim.y};velocity=undefined;reason='Pressing selectiv: nu urcă după fiecare variantă scurtă, ține blocul.';
  }
  const legal=legalRestartAim(scene,p,aim);
  // A mark cut short by the Laws is a destination, not a man to shadow.
  jobs[p.id]={aim:legal,speed:Math.min(job.speed,p.pace*.85),reason,velocity:distance(legal,aim)>.3?undefined:velocity};
 }
 return {plan,jobs,runner:run?.player,...(template?{template:Object.fromEntries(Object.entries(template).map(([id,t])=>[id,setPieceKey(t)]))}:{})};
}

/** Against a high press at a goal kick (two or more opponents pressing near
 * the area), the best-placed forward or wide player of the routine runs into
 * the space behind the press, so the long ball has a target. The choice keeps
 * the same runner while he stays a good one. */
function pressRun(scene:Scene,routine:RestartRoutine,players:PracticePlayer[],previous:RestartLive|null):{player:string;slot:RestartSlot}|null{
 const {side}=scene,opponents=players.filter(q=>q.side!==side);
 const pressers=opponents.filter(q=>q.role!=='GK'&&depth(side,q.x)<GOAL_KICK_PRESS_DEPTH);
 if(pressers.length<2)return null;
 const line=Math.max(...pressers.map(q=>depth(side,q.x)));
 const candidates=players.filter(q=>q.side===side&&routine.slots[q.id]&&!routine.slots[q.id].authored&&!['GK','CB','DM'].includes(q.role));
 let best:{player:string;aim:Vec;score:number}|null=null;
 for(const q of candidates)for(const d of [line+WORLD.geometry.restartLive.zoneAhead1.v,line+WORLD.geometry.restartLive.zoneAhead2.v])for(const y of [WORLD.geometry.restartLive.zoneWide2.v,WORLD.geometry.restartLive.zoneWide1.v,0,WORLD.geometry.restartLive.zoneWide1r.v,WORLD.geometry.restartLive.zoneWide2r.v]){
  const aim=inside({x:world(side,clamp(d,BOX_DEPTH+WORLD.geometry.restartLive.zoneMin.v,L-WORLD.geometry.restartLive.zoneMaxBack.v)),y});
  const room=Math.min(...opponents.map(o=>distance(o,aim)));
  if(room<3)continue;
  const kept=previous?.runner===q.id,old=kept?previous!.jobs[q.id]?.aim:undefined;
  const score=clamp(room/8,0,1)-arrivalTime(q,aim)*.1+(kept?.3:0)+(old&&distance(old,aim)<3?.1:0);
  if(!best||score>best.score)best={player:q.id,aim,score};
 }
 return best?{player:best.player,slot:{aim:best.aim,leash:3,purpose:'channel',reason:'Adversarul presează sus: atacă spațiul din spatele presingului pentru mingea lungă.'}}:null;
}

const optionRisk=(o:Option)=>o.throwRisk??o.pass?.risk??o.loft?.risk??0;
/** Throw-ins and goal kicks keep the ball. While a near option is open the
 * taker chooses among the open ones (by the ordinary chooser). With none open
 * he waits for movement, up to his limit; then he takes any open option (a
 * long throw back, a throw to his keeper), and only with none at all does he
 * choose among every option. Returns null to wait. Goal kicks have their own
 * short / long order (below). Corners and free kicks are deliveries: every
 * option stays, and only a risky pick waits (restartHold). */
export function restartOptions<T extends Option>(restart:{kind:RestartKind;side:Side;spot:Vec;readyAt?:number},available:T[],time:number,players:readonly PracticePlayer[]=[]):T[]|null{
 if(restart.kind!=='throw'&&restart.kind!=='goalKick')return available;
 const waiting=time-(restart.readyAt??time)<(RESTART_HOLD[restart.kind]??0);
 if(restart.kind==='goalKick'){
  // Against a high press (two or more opponents pressing near the area) a
  // long ball that is on, usually to the run behind the press, comes first.
  // Otherwise short while a short option is clearly on, then a long ball that
  // is on; with neither, wait for movement, then the best long options
  // rather than a forced short pass.
  const pressers=players.filter(q=>q.side!==restart.side&&q.role!=='GK'&&depth(restart.side,q.x)<GOAL_KICK_PRESS_DEPTH),pressed=pressers.length>=2;
  // Against a press the long ball goes over it, not through it: a ground ball
  // whose lane passes within reach of a presser is left for the lofted
  // version (or another long ball) when one is on.
  const overPress=(o:T)=>o.kind==='loft'||!pressers.some(q=>laneGap(restart.spot,o.aim,q)<GOAL_KICK_CONTEST);
  const long=available.filter(o=>distance(o.aim,restart.spot)>GOAL_KICK_LONG);
  const short=available.filter(o=>distance(o.aim,restart.spot)<=GOAL_KICK_LONG&&optionRisk(o)<=RESTART_GOAL_KICK_RISK);
  const longOn=long.filter(o=>optionRisk(o)<=RESTART_HOLD_RISK);
  const clearOn=pressed?longOn.filter(overPress):longOn;
  if(pressed&&clearOn.length)return clearOn;
  if(short.length)return short;
  if(longOn.length)return longOn;
  if(waiting)return null;
  if(!long.length)return available;
  const clear=pressed&&long.some(overPress)?long.filter(overPress):long;
  const least=Math.min(...clear.map(optionRisk));
  return clear.filter(o=>optionRisk(o)<=least+.15);
 }
 const open=available.filter(o=>optionRisk(o)<=RESTART_HOLD_RISK);
 // A long throw (beyond THROW_OPEN_RANGE) or one back to one's own keeper is
 // "open" only because nobody bothers to defend it: not a reason to skip the
 // nearer options that are still moving.
 const keeper=(id?:string)=>players.some(p=>p.id===id&&p.role==='GK');
 const near=restart.kind==='throw'?open.filter(o=>!keeper(o.target)&&distance(o.aim,restart.spot)<=THROW_OPEN_RANGE):open;
 if(near.length)return near;
 if(waiting)return null;
 return open.length?open:available;
}
/** Hold the kick for another look while the chosen option is risky and the wait is still short. */
export function restartHold(restart:{kind:RestartKind;readyAt?:number},option:Option,time:number):boolean{
 return optionRisk(option)>RESTART_HOLD_RISK&&time-(restart.readyAt??time)<(RESTART_HOLD[restart.kind]??0);
}
