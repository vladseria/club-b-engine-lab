import {clamp} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';

/** A teammate can obstruct a pass too. This prices the visible route; it does
 * not grant the ball permission to pass through a body during execution. */
export function laneObstruction(from:Vec,to:Vec,point:Vec,radius=1.25):number{
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
 if(length<1)return 0;
 const along=((point.x-from.x)*dx+(point.y-from.y)*dy)/(length*length);
 if(along<=.05||along>=.9)return 0;
 const gap=Math.hypot(point.x-from.x-dx*along,point.y-from.y-dy*along);
 return clamp((radius-gap)/radius,0,1);
}
export function teammatePassObstruction(p:PracticePlayer,q:PracticePlayer,aim:Vec,players:PracticePlayer[],flight:number):number{
 const length=Math.hypot(aim.x-p.x,aim.y-p.y);
 return Math.max(0,...players.filter(m=>m.side===p.side&&m.id!==p.id&&m.id!==q.id).map(m=>{
  const along=clamp(((m.x-p.x)*(aim.x-p.x)+(m.y-p.y)*(aim.y-p.y))/Math.max(1,length*length),0,1);
  const look=Math.min(.6,Math.max(0,flight)*along);
  return laneObstruction(p,aim,{x:m.x+m.vx*look,y:m.y+m.vy*look});
 }));
}
