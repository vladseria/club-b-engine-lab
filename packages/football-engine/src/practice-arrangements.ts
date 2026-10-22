import {attackingSpaceReader} from './practice-attacking-space.js';
import type {AttackingSpace} from './practice-attacking-space.js';
import {readTeamExposure} from './practice-exposure.js';
import {laneObstruction} from './practice-lanes.js';
import {commitmentCost} from './practice-rest-defence.js';
import {clamp} from './model.js';
import {L,W} from './pitch.js';
import type {Tactics} from './model.js';
import {steerMotion} from './movement.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {FootballJob} from './practice-coordination.js';
import type {TeamShape} from './practice-shape.js';
import type {SupportMove} from './practice-support.js';
import {readSupportLocation,shortSupportPoints} from './practice-support.js';
import {arrivalTime} from './practice-defense.js';
import {expectedPassFlight} from './practice-flight.js';
import {WORLD} from './world.js';

type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(p:PracticePlayer,v:Vec)=>p.side===0?v.x:L-v.x;
const inside=(v:Vec)=>({x:clamp(v.x,1,L-1),y:clamp(v.y,2-W/2,W/2-2)});
interface Candidate {opportunity:AttackingSpace;coverage:number[];job:FootballJob;score:number;access:number;gap:number;travel:number;forward:number;path:Vec[];start:Vec}

/** What a metre of change to a team-mate's aim costs in refineReceptionSupport (the price of dithering). */
export const CHANGE_COST=WORLD.selection.arrangements.CHANGE_COST.v;
/** Improve the angles of the team's existing invitations as a pass arrives.
 * Keep their purposes, rather than reallocating the whole attack at every
 * handover. Compare physically reachable positions, not occupied destinations. */
export function refineReceptionSupport(players:PracticePlayer[],focus:PracticePlayer,mates:PracticePlayer[],tactics:Tactics,risk:Risk,time:number,incoming:number,ordinary:Record<string,FootballJob>,instructed:ReadonlySet<string>):FootballJob[]|null{
 if(mates.length!==3)return null;
 const opponents=players.filter(p=>p.side!==focus.side),s=focus.side===0?1:-1;
 const horizon=Math.min(1.5,incoming+.8),exposure=readTeamExposure(players,focus,tactics);
 const future=opponents.map(p=>({...p,x:p.x+p.vx*Math.min(.65,incoming),y:p.y+p.vy*Math.min(.65,incoming)}));
 const candidates=mates.map(p=>{
  const job=ordinary[p.id];if(!job)return [];
  const points=[job.aim];
  const adjustable=!instructed.has(p.id)&&['outlet','give-and-go','build-up','counter-cover','depth','link','overlap','near-post','far-post','cutback'].includes(job.purpose);
  if(adjustable){
   for(const dy of [-3,3])for(const dx of job.kind==='run'?[0]:[-2,0,2])points.push(inside({x:job.aim.x+s*dx,y:job.aim.y+dy}));
   if(job.kind!=='run'&&distance(p,job.aim)<5)points.push({x:p.x,y:p.y});
  }
  // points[0] is the spot he is going to; its room is read first (below).
  let held=1;
  return points.map((aim,i)=>{
   const projected={...p},duration=Math.min(horizon,Math.max(0,job.until-time));
   for(let t=0;t<duration;t+=.1)steerMotion(projected,aim,Math.min(.1,duration-t),Math.min(p.pace,job.speed));
   const gap=distance(focus,projected),delivery=incoming+.2+expectedPassFlight(gap);
   const lane=risk(focus,projected,future),closing=Math.min(...opponents.map(q=>arrivalTime(q,projected)));
   const room=clamp((closing-delivery)/.8,0,1),access=(1-lane)*room*clamp((gap-3)/2,0,1)*clamp((22-gap)/6,0,1);
   // Pre-push fixes (2026-10-12): changing his aim costs CHANGE_COST a metre so
   // he does not dither between spots that both work. A spot an opponent
   // reaches before the ball (room 0: his marker is on him as it arrives) is
   // not one that works, and stepping off it is what a receiver does to give
   // the passer a clean ball: the cost is scaled by the room his own spot
   // keeps (full while it keeps 0.8 s, none once the marker beats the ball).
   if(i===0)held=room;
   const change=distance(aim,job.aim);
   return {job:{...job,aim},projected,access,gap,coverage:exposure.coverage(p,{...job,aim}),score:access-change*CHANGE_COST*held};
  });
 });
 if(candidates.some(c=>!c.length))return null;
 type Row=typeof candidates[number][number];
 const carrierCoverage=exposure.coverage(focus);
 const pair=(a:Row,b:Row)=>{
  const cosine=((a.projected.x-focus.x)*(b.projected.x-focus.x)+(a.projected.y-focus.y)*(b.projected.y-focus.y))/Math.max(.01,a.gap*b.gap);
  const crowd=clamp((4-distance(a.projected,b.projected))/4,0,1);
  const duplicate=clamp((cosine-.7)/.3,0,1)*Math.min(a.access,b.access);
  // A short reset may open another teammate. Both invitations have to be
  // usable; an attractive endpoint alone is not a completed combination.
  const connection=Math.max(a.access,b.access)*(1-risk(a.projected,b.projected,future))*Math.min(a.access,b.access);
  return connection*.2-crowd*1.5-duplicate*.5;
 };
 const pairs=[candidates[0].map(a=>candidates[1].map(b=>pair(a,b))),candidates[0].map(a=>candidates[2].map(b=>pair(a,b))),candidates[1].map(a=>candidates[2].map(b=>pair(a,b)))];
 let baseline=-Infinity,best=-Infinity,selected:Row[]|null=null;
 const discipline=(id:string)=>mates.find(p=>p.id===id)?.traits.discipline??1;
 for(let ai=0;ai<candidates[0].length;ai++)for(let bi=0;bi<candidates[1].length;bi++)for(let ci=0;ci<candidates[2].length;ci++){
  const rows=[candidates[0][ai],candidates[1][bi],candidates[2][ci]];
  const score=rows.reduce((sum,r)=>sum+r.score,0)+Math.max(...rows.map(r=>r.access))*.8+
   pairs[0][ai][bi]+pairs[1][ai][ci]+pairs[2][bi][ci]-exposure.cost([carrierCoverage,...rows.map(r=>r.coverage)]);
  // The committed number of bodies forward keeps its price through the
  // refinement (practice-rest-defence commitmentCost).
  const value=score-commitmentCost(focus,tactics.commit,rows.map(r=>({aim:r.job.aim,discipline:discipline(r.job.player)})));
  if(ai===0&&bi===0&&ci===0)baseline=value;
  if(value>best){best=value;selected=rows;}
 }
 return best>baseline+.18?selected!.map(r=>r.job):null;
}

/** Bounded joint assignment for the three supporting players in 5v5.
 * Candidate locations use ordinary movement and lane reads. Whole arrangements
 * are compared before anyone is reserved; no pass or opponent is scripted.
 */
export function pressureArrangement(players:PracticePlayer[],focus:PracticePlayer,mates:PracticePlayer[],shape:TeamShape,tactics:Tactics,build:SupportMove[],risk:Risk,time:number,previous:Record<string,FootballJob>={},ordinary:Record<string,FootballJob>={},instructed:ReadonlySet<string>=new Set(),striker?:string):FootballJob[]|null{
 if(mates.length!==3)return null;
 const opponents=players.filter(p=>p.side!==focus.side),s=focus.side===0?1:-1;
 const carrierDepth=depth(focus,focus),exposure=readTeamExposure(players,focus,tactics),carrierCover=exposure.coverage(focus);
 const attack=attackingSpaceReader(players,focus,tactics,risk,striker);
 const candidates=mates.map(p=>{
  const slot=shape.slots[p.id],back=build.find(m=>m.player===p.id),prior=previous[p.id];
  const points:{aim:Vec;purpose:FootballJob['purpose']}[]=[];
  const original=ordinary[p.id];if(original)points.push({aim:original.aim,purpose:original.purpose});
  const fixed=instructed.has(p.id)&&!!original;
  if(!fixed){
   if(slot)points.push({aim:slot.aim,purpose:'shape'});
   if(back)points.push({aim:back.aim,purpose:back.purpose as FootballJob['purpose']});
   for(const aim of shortSupportPoints(p,focus))points.push({aim,purpose:'outlet'});
   for(const dx of [6,10])for(const dy of [-7,0,7])points.push({aim:inside({x:focus.x+s*dx,y:focus.y+dy}),purpose:'depth'});
   if(prior&&prior.until>time&&prior.purpose!=='break')points.push({aim:prior.aim,purpose:prior.purpose});
  }
  const rows:Candidate[]=[];
  for(const {aim,purpose} of points){
   const forward=depth(focus,aim)-carrierDepth,run=fixed?original.kind==='run':['break','depth','give-and-go','overlap','near-post','far-post','cutback'].includes(purpose);
   if(!fixed&&run&&depth(focus,aim)<depth(focus,p)-.5)continue;
   if(!fixed&&run&&p.energy<22)continue;
   const read=readSupportLocation(p,aim,players,focus,risk,run);
   if(!fixed&&(read.gap<4.5||read.gap>22||read.travel>4||read.room<1.5||!run&&read.risk>.85))continue;
   const access=(1-read.risk)*( .3+.7*read.releaseRoom)*Math.exp(-read.travel*.3);
   const continuation=prior&&prior.purpose===purpose&&prior.until>time&&distance(prior.aim,aim)<1;
   const affinity=run?p.traits.runs*.18:p.traits.comesShort*.12;
   const opportunity=attack.read(p,{player:p.id,purpose,kind:run?'run':'support',aim,speed:fixed?original.speed:p.pace*(run?.9:.83),since:time,until:fixed?original.until:time+2,reason:''},time);
   const forwardValue=opportunity.gain+opportunity.development;
   const score=access*.7-read.travel*.11-read.crowding*.5+affinity+forwardValue+
    (continuation?.23:0)-(slot?distance(slot.aim,aim)*.015:0)+(p.role==='CB'&&forward<-3?.12:0);
   const kind=fixed?original.kind:run?'run':forward<-3?'support':'show';
   const speed=fixed?original.speed:p.pace*(run?.9:.83);
   const moving={...p},path:Vec[]=[];for(let i=0;i<12;i++){steerMotion(moving,aim,.1,speed);if(i%3===2)path.push({x:moving.x,y:moving.y});}
   const initial=distance(p,focus),carrierConflict=Math.max(0,...path.map((point,i)=>{
    const at=(i+1)*.3,gap=distance(point,{x:focus.x+focus.vx*at,y:focus.y+focus.vy*at});
    return gap>initial+.2?0:clamp((2.5-gap)/2.5,0,1);
   }));
   rows.push({opportunity,coverage:exposure.coverage(p,{player:p.id,aim,speed}),path,start:p,score:score-carrierConflict*1.2,access,gap:read.gap,travel:read.travel,forward,job:fixed?original:{player:p.id,purpose:purpose==='shape'?(forward<-3?'counter-cover':'outlet'):purpose,kind,aim,speed,
    since:continuation?prior.since:time,until:continuation?prior.until:time+2,
    reason:run?'Păstrează o amenințare înainte, în timp ce colegii deschid ieșirea din presiune.':forward<-3?'Oferă întoarcerea în afara presiunii, păstrând legătura cu atacul.':'Deschide un unghi diferit, pentru a scoate pasa din aglomerație.'}});
  }
  // Preserve genuinely different directions, not eight near-identical points
  // on whichever flank happened to win the individual location score.
  rows.sort((a,b)=>b.score-a.score);
  const buckets=new Map<string,Candidate[]>();
  for(const row of rows){
   const a=Math.atan2(row.job.aim.y-focus.y,(row.job.aim.x-focus.x)*s),sector=Math.floor((a+Math.PI)/(Math.PI/2));
   const key=`${row.forward>3?'ahead':'support'}:${sector}`,bucket=buckets.get(key)??[];
   if(bucket.length<2&&!bucket.some(q=>distance(q.job.aim,row.job.aim)<2)){bucket.push(row);buckets.set(key,bucket);}
  }
  const selected=[...buckets.values()].flat();
  if(back){const row=rows.find(r=>distance(r.job.aim,back.aim)<.1);if(row&&!selected.includes(row))selected.push(row);}
  const kept=selected.slice(0,12);
  if(original){const row=rows.find(r=>distance(r.job.aim,original.aim)<.1);if(row&&!kept.includes(row))kept.push(row);}
  return kept;
 });
 if(candidates.some(c=>!c.length))return null;
 const pairValue=(u:Candidate,v:Candidate)=>{let value=0;
   const gap=distance(u.job.aim,v.job.aim);
   value-=clamp((2-gap)/2,0,1)*2;
   const initial=distance(u.start,v.start);
   const crossing=Math.max(0,...u.path.map((point,i)=>{const gap=distance(point,v.path[i]);return gap>initial+.3?0:clamp((3.5-gap)/3.5,0,1);}));
   value-=crossing*1.2;
   value-=Math.max(laneObstruction(focus,u.job.aim,v.job.aim,2),laneObstruction(focus,v.job.aim,u.job.aim,2))*.8;
   const cosine=((u.job.aim.x-focus.x)*(v.job.aim.x-focus.x)+(u.job.aim.y-focus.y)*(v.job.aim.y-focus.y))/Math.max(.01,u.gap*v.gap);
   // Close options can overload a defender. A shared angle costs something
   // when the same opponent can cover both AND their connecting pass is poor.
   const sharedMarker=opponents.some(p=>distance(p,u.job.aim)<5&&distance(p,v.job.aim)<5);
   if(sharedMarker)value-=clamp((cosine-.65)/.35,0,1)*Math.min(risk(u.job.aim,v.job.aim,opponents),risk(v.job.aim,u.job.aim,opponents))*.5;
   value+=Math.max(attack.connection(u.opportunity,v.opportunity),attack.connection(v.opportunity,u.opportunity));
   // A reset is useful when it connects to another option, not merely when
   // its own destination is clear. Forecast only visible defender momentum.
   if(u.forward<-3||v.forward<-3){
    const first=u.forward<v.forward?u:v,next=first===u?v:u;
    const link=distance(first.job.aim,next.job.aim);
    if(link>=5&&link<=20)value+=first.access*next.access*(1-risk(first.job.aim,next.job.aim,opponents))*.35;
   }
  return value;
 };
 const pairs=[
  candidates[0].map(a=>candidates[1].map(b=>pairValue(a,b))),
  candidates[0].map(a=>candidates[2].map(c=>pairValue(a,c))),
  candidates[1].map(b=>candidates[2].map(c=>pairValue(b,c)))
 ];
 let best:Candidate[]|null=null,bestScore=-Infinity,ordinaryScore=-Infinity;
 const discipline=(id:string)=>mates.find(p=>p.id===id)?.traits.discipline??1;
 for(let ai=0;ai<candidates[0].length;ai++)for(let bi=0;bi<candidates[1].length;bi++)for(let ci=0;ci<candidates[2].length;ci++){
  const [a,b,c]=[candidates[0][ai],candidates[1][bi],candidates[2][ci]],rows=[a,b,c];let score=a.score+b.score+c.score;
  const outlets=rows.filter(r=>r.gap<=13&&r.forward<4).sort((a,b)=>b.access-a.access);
  score+=(outlets[0]?.access??0)*1.3+(outlets[1]?.access??0)*.35;
  score-=exposure.cost([carrierCover,a.coverage,b.coverage,c.coverage]);
  score+=pairs[0][ai][bi]+pairs[1][ai][ci]+pairs[2][bi][ci];
  // A release from pressure keeps the price of the committed number of
  // bodies forward (practice-rest-defence commitmentCost).
  score-=commitmentCost(focus,tactics.commit,rows.map(r=>({aim:r.job.aim,discipline:discipline(r.job.player)})));
  if(rows.every(r=>ordinary[r.job.player]&&distance(r.job.aim,ordinary[r.job.player].aim)<.1)&&score>ordinaryScore)ordinaryScore=score;
  if(score>bestScore){best=rows;bestScore=score;}
 }
 return bestScore>ordinaryScore+.25?best?.map(r=>r.job)??null:null;
}
