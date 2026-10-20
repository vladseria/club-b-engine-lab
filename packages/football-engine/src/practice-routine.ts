import {L,W} from './pitch.js';
import {clamp} from './model.js';
import type {Side} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {RestartKind} from './practice-restarts.js';
import {restartPositions} from './practice-restarts.js';
import {restartRoutine,legalRestartAim} from './practice-restart-live.js';
import type {LessonSpec,LessonScene,SceneRestart,SceneZone} from './practice-lesson.js';
import {sceneZoneOf,sceneSideOf} from './practice-lesson.js';

/**
 * Set-piece routines: a lesson with a `scene` belongs to a restart. At the
 * stoppage its drawing is placed on the actual restart (translated to the
 * real ball, mirrored to the other side when the manager allowed either
 * side) and becomes the restart's authored slots, merged over the engine's
 * own routine. Nothing here moves a player or relaxes a Law: the live
 * restart layer bounds every aim, and the taker keeps his wait and choice.
 */
export interface PlacedRoutine {
 /** The lesson on this restart (own attacking frame), ready for TeachingActions. */
 lesson:LessonSpec;
 /** The designated taker's player id. */
 taker:string;
 /** Authored spots, world coordinates, by player id. */
 slots:Record<string,{aim:Vec;leash:number}>;
 mirrored:boolean;
}
/** Own attacking frame <-> world (the same involution both ways). */
const frame=(side:Side,v:Vec):Vec=>side===0?{x:v.x,y:v.y}:{x:L-v.x,y:-v.y};
const onPitch=(v:Vec):Vec=>({x:clamp(v.x,.8,L-.8),y:clamp(v.y,-(W/2-1),W/2-1)});
export const sceneKinds=(r:SceneRestart):RestartKind[]=>r==='freeKick'?['freeKick','indirect']:[r];
export {sceneZoneOf};
const sideOf=sceneSideOf;

/** Does this routine belong to a restart of `kind` at `spot` (world) for `side`? */
export function sceneMatches(scene:LessonScene,kind:RestartKind,side:Side,spot:Vec):boolean{
 if(!sceneKinds(scene.restart).includes(kind))return false;
 const at=frame(side,spot);
 if(scene.restart!=='goalKick'&&scene.side&&scene.side!=='any'&&sideOf(at.y)!==scene.side)return false;
 if(scene.zone&&scene.zone!=='any'&&sceneZoneOf(at.x)!==scene.zone)return false;
 return true;
}

/** A designated taker farther than this from the ball leaves the kick to
 * the engine's own taker (he would otherwise walk half the pitch while
 * everyone waits); the two swap parts in the routine. */
export const ROUTINE_TAKER_REACH=16;
/** The most a drawing is compressed, per direction, to fit the real restart.
 * Beyond that it was drawn for a different restart and is not used. */
export const ROUTINE_MIN_SCALE=.5;
const BOUND={x0:.8,x1:L-.8,y0:-(W/2-1),y1:W/2-1};
/** How far offsets in each direction (negatives and positives) can stretch
 * from `c` before leaving [lo, hi]: 1 = as drawn, less = compressed. */
function stretch(c:number,lo:number,hi:number,offsets:number[]):[number,number]{
 const neg=Math.min(0,...offsets),pos=Math.max(0,...offsets);
 return [neg<0?Math.min(1,Math.max(0,c-lo)/-neg):1,pos>0?Math.min(1,Math.max(0,hi-c)/pos):1];
}
/** The routine with two of its players' parts swapped (taker <-> engine's taker). */
function swapNumbers(lesson:LessonSpec,a:number,b:number):LessonSpec{
 const sw=<T,>(n:T):T=>(n===a?b:n===b?a:n) as T,l=structuredClone(lesson);
 for(const j of l.jobs){j.actor=sw(j.actor);if(typeof j.recipient==='number')j.recipient=sw(j.recipient);if(typeof j.teammate==='number')j.teammate=sw(j.teammate);}
 for(const m of l.moments){if(m.cue.kind==='pressed')m.cue.actor=sw(m.cue.actor);if(m.entry)m.entry.carrier=sw(m.entry.carrier);}
 for(const s of l.spaces)if(s.anchor?.kind==='player')s.anchor.number=sw(s.anchor.number);
 if(l.scene){l.scene.taker=sw(l.scene.taker);for(const q of l.scene.spots)q.number=sw(q.number);}
 return l;
}

/** Place a routine on the actual restart; null when it does not belong there,
 * its taker is not on the pitch, or its drawing does not fit this restart.
 * The drawing moves with the ball (corners and goal kicks are always at the
 * same spot) and is mirrored when the routine is allowed on either side and
 * the ball is on the other one. Near a line the drawing is compressed toward
 * the ball, keeping every player's order and at least half the drawn gaps,
 * instead of stacking spots on the goal line or touchline; a drawing that
 * would need more than halving was made for a different restart (a free kick
 * 15 m out is not the one from the byline) and the engine's own set-up is
 * used. `engineTaker` is who the engine would send: he takes throw-ins (the
 * nearest player, as always), and any restart the designated taker is too far
 * from; the two then swap parts in the routine. */
export function placeRoutine(lesson:LessonSpec,kind:RestartKind,side:Side,spot:Vec,players:PracticePlayer[],engineTaker?:string):PlacedRoutine|null{
 let scene=lesson.scene;if(!scene||!sceneMatches(scene,kind,side,spot))return null;
 const mine=players.filter(p=>p.side===side);
 const designated=mine.find(p=>p.number===scene!.taker&&(scene!.taker===1)===(p.role==='GK'));
 if(!designated)return null;
 const engine=engineTaker!==undefined?mine.find(p=>p.id===engineTaker):undefined;
 const taker=engine&&(kind==='throw'||Math.hypot(designated.x-spot.x,designated.y-spot.y)>ROUTINE_TAKER_REACH)?engine:designated;
 if(taker!==designated){lesson=swapNumbers(lesson,designated.number,taker.number);scene=lesson.scene!;}
 const at=frame(side,spot),ball=scene.ball;
 const mirrored=scene.restart!=='goalKick'&&(!scene.side||scene.side==='any')&&Math.abs(at.y)>.5&&Math.abs(ball.y)>.5&&Math.sign(at.y)!==Math.sign(ball.y);
 const offset=(p:Vec):Vec=>({x:p.x-ball.x,y:(p.y-ball.y)*(mirrored?-1:1)});
 const offsets=scene.spots.map(offset);
 const [xNeg,xPos]=stretch(at.x,BOUND.x0,BOUND.x1,offsets.map(o=>o.x)),[yNeg,yPos]=stretch(at.y,BOUND.y0,BOUND.y1,offsets.map(o=>o.y));
 if(Math.min(xNeg,xPos,yNeg,yPos)<ROUTINE_MIN_SCALE)return null;
 const place=(p:Vec):Vec=>{const o=offset(p);return onPitch({x:at.x+o.x*(o.x<0?xNeg:xPos),y:at.y+o.y*(o.y<0?yNeg:yPos)});};
 const slots:Record<string,{aim:Vec;leash:number}>={};
 for(const s of scene.spots){
  const p=mine.find(q=>q.number===s.number&&q.role!=='GK');if(!p||p.id===taker.id)continue;
  slots[p.id]={aim:frame(side,place(s)),leash:s.leash};
 }
 const placed:LessonSpec={...lesson,
  spaces:lesson.spaces.map(s=>({...s,...place(s),...(s.anchor?{anchor:{...s.anchor,dy:mirrored?-s.anchor.dy:s.anchor.dy}}:{})})),
  scene:{...scene,ball:{...at},spots:scene.spots.map(s=>({...s,...place(s)}))}};
 return {lesson:placed,taker:taker.id,slots,mirrored};
}

/** Where the Lab puts the ball for a restart scene (own attacking frame).
 * Corners: at the flag; goal kicks: the edge of the goal area; throw-ins:
 * on the touchline in the chosen third; free kicks: inside the chosen third. */
export function sceneBall(restart:SceneRestart,side:'left'|'right'='left',zone:Exclude<SceneZone,'any'>='attacking'):Vec{
 const flank=side==='left'?-1:1,x=zone==='defensive'?10:zone==='middle'?24:36;
 if(restart==='corner')return {x:L-1,y:flank*(W/2-.5)};
 if(restart==='goalKick')return {x:3,y:0};
 if(restart==='throw')return {x,y:flank*(W/2-.5)};
 return {x:zone==='attacking'?33:x,y:flank*6};
}
/** The engine's own layout for a restart the Lab draws on: both sides where
 * the live restart would send them first (the other side reacts again once
 * a watch starts). Poses are side 0 attacking +x; the taker is on the ball. */
export function restartSetupPoses(restart:SceneRestart,ball:Vec,takerNumber:number,players:PracticePlayer[]):{side:Side;number:number;x:number;y:number;angle:number}[]{
 const kind:RestartKind=restart,taker=players.find(p=>p.side===0&&p.number===takerNumber);
 if(!taker)throw Error('The taker must be on the pitch.');
 const positions=restartPositions(kind,0,ball,taker.id,players,true);
 const scene={kind,side:0 as Side,spot:ball,taker:taker.id};
 const routine=restartRoutine(scene,players,positions);
 for(const [id,slot] of Object.entries(routine.slots))positions[id]=legalRestartAim(scene,players.find(p=>p.id===id)!,slot.aim);
 for(const p of players)if(p.id!==taker.id)positions[p.id]=legalRestartAim(scene,p,positions[p.id]);
 const facing=restart==='goalKick'?{x:L/2,y:0}:restart==='throw'?{x:ball.x+4,y:0}:{x:L-5,y:0};
 const poses=players.map(p=>{const at=p.id===taker.id?positions[p.id]:onPitch(positions[p.id]);
  return {side:p.side,number:p.number,x:at.x,y:at.y,angle:p.id===taker.id?Math.atan2(facing.y-at.y,facing.x-at.x):p.side?Math.PI:0};});
 // Keep bodies apart (the setup check refuses overlaps).
 for(let pass=0;pass<6;pass++)for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++){
  const a=poses[i],b=poses[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d>=1)continue;
  const mover=b.number===takerNumber&&b.side===0?a:b,ux=d>.01?(mover.x-(mover===a?b:a).x)/d:1,uy=d>.01?(mover.y-(mover===a?b:a).y)/d:0;
  const moved=onPitch({x:mover.x+ux*(1.05-d),y:mover.y+uy*(1.05-d)});mover.x=moved.x;mover.y=moved.y;
 }
 return poses;
}
