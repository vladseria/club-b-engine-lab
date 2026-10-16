import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {goalAngle} from './practice-football.js';
import {arrivalTime} from './practice-defense.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
/** The lanes a defender reads across the goal mouth: the centre and the two corners the shooter himself aims at
 * (practice-football assessShot maps the same reference points through G, so ±1.78 m, inside the posts at ±GH). */
export const SHOT_LANES=[0,-2.6,2.6].map(G);
export interface ShotDanger {level:number;openness:number;angle:number;blockAim:Vec;canBlock:boolean;blockArrival:number}

/** Visible geometry and body orientation, not the attacker's selected action or shot outcome. */
export function readShotDanger(d:PracticePlayer,a:PracticePlayer,ball:Vec,players:PracticePlayer[]):ShotDanger{
 const goal={x:a.side===0?L:0,y:0},length=distance(a,goal),angle=goalAngle(a);
 const dx=goal.x-a.x,dy=-a.y,alignment=Math.max(0,(Math.cos(a.angle)*dx+Math.sin(a.angle)*dy)/Math.max(.01,length));
 const geometry=clamp(angle/.55,0,1)*clamp((38-length)/24,0,1);
 const defenders=players.filter(q=>q.side===d.side&&q.id!==d.id&&q.role!=='GK');
 // Check several shooting lanes. One teammate in the centre need not cover both corners.
 const lanes=SHOT_LANES.map(y=>{
  const target={x:goal.x,y},vx=target.x-ball.x,vy=target.y-ball.y,squared=vx*vx+vy*vy;
  let obstruction=0;
  for(const q of defenders){
   const t=((q.x-ball.x)*vx+(q.y-ball.y)*vy)/Math.max(.01,squared);
   if(t<=0||t>=1)continue;
   const gap=distance(q,{x:ball.x+vx*t,y:ball.y+vy*t});
   obstruction=Math.max(obstruction,clamp((1.2-gap)/1.2,0,1));
  }
  return {target,open:1-obstruction};
 });
 const openness=lanes.reduce((n,l)=>n+l.open,0)/lanes.length;
 const keeper=players.find(p=>p.side===d.side&&p.role==='GK');
 const keeperSet=keeper&&distance(keeper,goal)<9&&Math.abs(keeper.y)<5;
 const level=clamp(geometry*(.15+.85*alignment)*openness*(keeperSet?.85:1),0,1);
 // Prefer the clearest lane, retaining the centre when openness is comparable.
 const lane=lanes.reduce((best,l)=>l.open>best.open+.1?l:best,lanes[0]);
 const vx=lane.target.x-ball.x,vy=lane.target.y-ball.y,total=Math.hypot(vx,vy),ux=vx/Math.max(.01,total),uy=vy/Math.max(.01,total);
 const projection=(d.x-ball.x)*ux+(d.y-ball.y)*uy;
 const ahead=clamp(projection,1.35,Math.max(1.35,Math.min(6,total-.8)));
 const blockAim={x:clamp(ball.x+ux*ahead,.3,(L-.3)),y:clamp(ball.y+uy*ahead,-(W/2-0.3),(W/2-0.3))};
 const blockArrival=arrivalTime(d,blockAim);
 const anticipation=.22+clamp(d.skills.reading/10,0,1)*.25;
 const canBlock=projection>.2&&total>1.5&&blockArrival<=anticipation;
 return {level,openness,angle,blockAim,canBlock,blockArrival};
}
