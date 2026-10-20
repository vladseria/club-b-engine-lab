import * as S from './style.js';
import {clamp} from './model.js';
import type {Tactics} from './model.js';
import {L,W} from './pitch.js';
import {steerMotion} from './movement.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {FootballJob} from './practice-coordination.js';
import {arrivalTime,BACK_REACH,QUICK_RELEASE,QUICK_REACT} from './practice-defense.js';
import {strikeTurnTime} from './practice-striking.js';
import {expectedPassFlight} from './practice-flight.js';

type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
export interface AttackingSpace {point:PracticePlayer;at:number;room:number;access:number;value:number;gain:number;development:number}
/** Value reachable receptions along a movement, not only its final destination.
 * A run need not be directly available yet: an outlet can open it with a second
 * pass. Defenders keep their observed motion; a decoy is never assumed to work. */
export function attackingSpaceReader(players:PracticePlayer[],carrier:PracticePlayer,tactics:Tactics,risk:Risk,striker?:string){
 const opponents=players.filter(p=>p.side!==carrier.side),outfield=opponents.filter(p=>p.role!=='GK');
 const depth=(v:Vec)=>carrier.side===0?v.x:L-v.x;
 const threat=(v:Vec)=>clamp((depth(v)-L*.5)/(L*.45),0,1)*clamp(1-Math.abs(v.y)/(W*.7),.25,1);
 const future=opponents.map(p=>({...p,x:p.x+p.vx*.6,y:p.y+p.vy*.6}));
 // Keep the movement behind each option. Independently best points are not
 // necessarily available together when the first and second balls arrive.
 type Forecast={body:PracticePlayer;job:FootballJob;duration:number;path:{x:number;y:number;vx:number;vy:number}[]};
 const forecasts=new WeakMap<AttackingSpace,Forecast>();
 const positionAt=(option:AttackingSpace,at:number):PracticePlayer|null=>{
  const forecast=forecasts.get(option);if(!forecast)return option.point;
  if(at>3||at<0)return null;
  const {body,job,path,duration}=forecast,index=Math.ceil(at*10);
  while(path.length<=index){
   if(path.length*.1>duration+.001){
    // A settled destination can remain available. Do not invent movement
    // beyond a responsibility that expires before the proposed delivery.
    if(distance(body,job.aim)>.3||Math.hypot(body.vx,body.vy)>.3)return null;
    path.push({...path.at(-1)!,vx:0,vy:0});continue;
   }
   steerMotion(body,job.aim,.1,Math.min(body.pace,job.speed));
   path.push({x:body.x,y:body.y,vx:body.vx,vy:body.vy});
  }
  const lo=Math.floor(at*10),fraction=at*10-lo,a=path[lo],b=path[index];
  return {...option.point,x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,
   vx:a.vx+(b.vx-a.vx)*fraction,vy:a.vy+(b.vy-a.vy)*fraction};
 };
 type Leg={point:PracticePlayer;at:number;access:number;closing:number;back:PracticePlayer[];layAccess:number;layClosing:number};
 const firstLegs=new WeakMap<AttackingSpace,Leg|null>();
 const firstLeg=(option:AttackingSpace)=>{
  if(firstLegs.has(option))return firstLegs.get(option)!;
  firstLegs.set(option,null);
  let at=Math.max(option.at,.2+expectedPassFlight(distance(carrier,option.point))),point:PracticePlayer|null=null;
  for(let i=0;i<3;i++){
   point=positionAt(option,at);if(!point)return null;
   at=Math.max(option.at,.2+expectedPassFlight(distance(carrier,point)));
  }
  point=positionAt(option,at);if(!point)return null;
  const gap=distance(carrier,point),closing=Math.min(...outfield.map(d=>arrivalTime(d,point!)));
  const reach=clamp((gap-3)/2,0,1)*clamp((32-gap)/8,0,1);
  const access=(1-risk(carrier,point,future))*clamp((closing-at+.2)/.9,0,1)*reach;
  // Men on his back (behind the reception from the carrier, within
  // BACK_REACH): they contest a turn, not a quick ball he plays away from
  // them (releaseClosing). The same read without them, for such a ball.
  const dx=point.x-carrier.x,dy=point.y-carrier.y,d2=dx*dx+dy*dy||1,p0=point;
  const back=outfield.filter(d=>((d.x-carrier.x)*dx+(d.y-carrier.y)*dy)/d2>1&&distance(d,p0)<BACK_REACH);
  let layAccess=access,layClosing=closing;
  if(back.length){
   const ids=new Set(back.map(d=>d.id));
   layClosing=Math.min(...outfield.filter(d=>!ids.has(d.id)).map(d=>arrivalTime(d,p0)));
   layAccess=(1-risk(carrier,point,future.filter(d=>!ids.has(d.id))))*clamp((layClosing-at+.2)/.9,0,1)*reach;
  }
  const leg={point,at,access,closing,back,layAccess,layClosing};firstLegs.set(option,leg);return leg;
 };
 // Progression sets how much a side values going forward itself: a
 // reception's depth, defenders beaten and threat. The third-man link that
 // opens such a reception is a combination, the thing a patient side plays
 // for, so patience never discounts it: connection() values it on the
 // neutral scale unless the side's own eagerness (direct) values it more.
 const weight=S.PROGRESSION[tactics.progression].attackValue.v;
 const combination=Math.max(weight,.9);
 const worth=(point:Vec)=>{
  const progress=clamp((depth(point)-depth(carrier))/12,0,1);
  const beaten=outfield.filter(d=>depth(d)>depth(carrier)+1&&depth(d)<depth(point)-1).length/Math.max(1,outfield.length);
  const finishing=Math.max(0,threat(point)-threat(carrier));
  return progress*.5+beaten*.35+finishing*.55;
 };
 const value=(point:Vec)=>worth(point)*weight;
 return {
  read(p:PracticePlayer,job:FootballJob,time:number):AttackingSpace{
   const moving={...p},path=[{x:p.x,y:p.y,vx:p.vx,vy:p.vy}];let best:AttackingSpace={point:{...p},at:0,room:0,access:0,value:0,gain:0,development:0},bestPotential=-Infinity;
   // A forward's work starts before a forward pass is available. Value joining
   // a reachable attacking position separately from receiving the ball there
   // now. Role and tactics express priorities, never a required runner count.
   // The striker setting belongs to the team's most advanced forward: the ST,
   // or in a formation without one (2-2) the leading winger, scaled from his
   // own role's value so "mixed" leaves him as he was.
   const setting=S.STRIKER[tactics.striker??'mixed'].attackValue.v;
   const roleValue=p.role==='GK'?0:p.role==='ST'?setting:p.role==='W'||p.role==='AM'?.85:p.role==='CM'?.6:p.role==='FB'?(tactics.fullbacks==='hold'?.2:.5):.3;
   const attackingRole=p.role!=='ST'&&p.id===striker?roleValue*setting:roleValue;
   const ambition=attackingRole*(S.COMMIT.ambitionBase.v+tactics.commit*S.COMMIT.ambitionPer.v)*weight;
   const connected=(v:Vec)=>Math.exp(-Math.max(0,distance(carrier,v)-12)/10);
   const initialConnection=connected(p),initialDepth=depth(p);
   const duration=Math.min(1.8,Math.max(0,job.until-time));
   for(let tick=0;tick<=18;tick++){
    const at=tick*.1;if(at>duration+.001)break;
    if(tick){steerMotion(moving,job.aim,.1,Math.min(p.pace,job.speed));path.push({x:moving.x,y:moving.y,vx:moving.vx,vy:moving.vy});}
    if(tick%6!==0)continue;
    const gap=distance(carrier,moving),flight=.2+expectedPassFlight(gap);
    const closing=Math.min(...outfield.map(d=>arrivalTime(d,moving)));
    const room=clamp((closing-Math.max(at,flight)+.2)/.9,0,1);
    const access=(1-risk(carrier,moving,future))*room*clamp((gap-3)/2,0,1)*clamp((32-gap)/8,0,1);
    const worth=value(moving)*Math.exp(-at*.22),gain=worth*access;
    // Preparing an option does not assume that every opponent will sprint to
    // its endpoint. Use visible occupation for preparation, and arrival races
    // for an actual reception. Do not reward running into a marker or becoming
    // detached from the ball; a better return angle can also earn value.
    const space=clamp((Math.min(...future.map(d=>distance(d,moving)))-1.5)/4,0,1);
    const progress=clamp((depth(moving)-initialDepth)/8,-1,1);
    const development=(ambition*progress*.8*connected(moving)+
     (connected(moving)-initialConnection)*.7)*space*Math.exp(-at*.18);
    // Keep a blocked but valuable reception available to pair evaluation.
    const potential=worth*room*(.25+.75*access)+development;
    if(potential>bestPotential){bestPotential=potential;best={point:{...moving},at,room,access,value:worth,gain,development};}
   }
   forecasts.set(best,{body:{...moving},job,duration:Math.max(0,job.until-time),path});
   return best;
  },
  connection(a:AttackingSpace,b:AttackingSpace):number{
   // Intercept both teammates along their movements. An outlet may receive
   // later than now, but the onward recipient cannot be frozen at a separate
   // best instant while the two passes travel.
   const leg=firstLeg(a);if(!leg||a.access<=0&&!leg.back.length||leg.access<=0&&leg.layAccess<=0)return 0;
   const {point:first,at:firstAt}=leg;
   let arrival=firstAt+.15+strikeTurnTime(first,b.point)+expectedPassFlight(distance(first,b.point));
   let second:PracticePlayer|null=null;
   for(let i=0;i<3;i++){
    second=positionAt(b,arrival);if(!second)return 0;
    arrival=firstAt+.15+strikeTurnTime(first,second)+expectedPassFlight(distance(first,second));
   }
   second=positionAt(b,arrival);if(!second)return 0;
   const gap=distance(first,second);if(gap<3||gap>26)return 0;
   const preparation=.15+strikeTurnTime(first,second);
   if(Math.abs(arrival-(firstAt+preparation+expectedPassFlight(gap)))>.1)return 0;
   // A quick ball played away from the men on his back (a lay-off, a wall
   // pass) is read without them; anything else with them (as before).
   const quick=leg.back.length>0&&preparation<=QUICK_RELEASE&&leg.back.every(d=>(second!.x-first.x)*(d.x-first.x)+(second!.y-first.y)*(d.y-first.y)<0);
   if(!quick&&a.access<=0)return 0;
   const firstAccess=quick?leg.layAccess:leg.access,firstClosing=quick?leg.layClosing:leg.closing;
   if(firstAccess<=0)return 0;
   const ready=clamp((firstClosing-firstAt-preparation+.2)/.9,0,1);
   if(ready<=0)return 0;
   // Where a quick ball goes (a first-time lay-off off a man on his back)
   // is not something the others can read before he plays it: they go for
   // it from the reception on, a reaction (QUICK_REACT) late. Any other
   // second ball is read as before (from now).
   const seen=outfield.map(d=>arrivalTime(d,second!));
   const closing=Math.min(...seen.map(t=>(quick?firstAt+QUICK_REACT:0)+t));
   const room=clamp((closing-arrival+.2)/.9,0,1);
   // A direct ball to the same point is read as ever (its target is visible).
   const directRoom=quick?clamp((Math.min(...seen)-arrival+.2)/.9,0,1):room;
   const via=(1-risk(first,second,future))*room;
   if(via<=0)return 0;
   // Compare a direct delivery to the same future point and time. The
   // intermediary earns credit for opening that route, not for adding a pass.
   const directGap=distance(carrier,second);
   const direct=(1-risk(carrier,second,future))*directRoom*clamp((directGap-3)/2,0,1)*clamp((32-directGap)/8,0,1);
   return firstAccess*ready*Math.max(0,via-direct)*(worth(second)*combination)*Math.exp(-arrival*.22)*.7;
  }
 };
}
