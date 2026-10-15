import {attackingSpaceReader} from './practice-attacking-space.js';
import {clamp} from './model.js';
import type {Tactics} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {FootballJob} from './practice-coordination.js';
import type {Vec} from './movement.js';
import {steerMotion} from './movement.js';
import {readTeamExposure} from './practice-exposure.js';
import {readSupportLocation} from './practice-support.js';
import {laneObstruction} from './practice-lanes.js';
import {commitBounds,commitmentPrice,constrains,establishedAttack,isRest} from './practice-rest-defence.js';

export interface JobCandidate {job:FootballJob;score:number}
type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Compare available responsibilities together. No quota for runners, outlets
 * or covering players. The coach/physical commitments are fixed candidates;
 * all other jobs pay for their actual exposure, timing and interference. */
export function selectPossessionJobs(players:PracticePlayer[],focus:PracticePlayer,mates:PracticePlayer[],tactics:Tactics,risk:Risk,candidates:ReadonlyMap<string,JobCandidate[]>,fixed:ReadonlySet<string>,time:number,striker?:string):FootballJob[]{
 if(!mates.length)return [];
 const opponents=players.filter(p=>p.side!==focus.side),exposure=readTeamExposure(players,focus,tactics);
 const pressure=clamp((5-Math.min(...opponents.filter(p=>p.role!=='GK').map(p=>distance(p,focus))))/4,0,1);
 const attack=attackingSpaceReader(players,focus,tactics,risk,striker);
 const carrierPath=[.3,.6,.9,1.2].map(t=>({x:focus.x+focus.vx*t,y:focus.y+focus.vy*t}));
 const bounds=commitBounds(tactics.commit),constrained=establishedAttack(focus)&&constrains(bounds);
 const rows=mates.map(p=>{
  // Evaluate football value before pruning. A nearby stationary option must
  // not eliminate a route whose useful reception develops after moving.
  const evaluated=(candidates.get(p.id)??[]).map(row=>{
   const opportunity=attack.read(p,row.job,time);
   const job=row.job,read=readSupportLocation(p,job.aim,players,focus,risk,job.kind==='run',job.speed);
   const access=(1-read.risk)*read.releaseRoom*Math.exp(-read.travel*.25)*clamp((18-read.gap)/6,0,1)*clamp((read.gap-2)/2,0,1);
   const body={...p},path:Vec[]=[];
   for(let tick=0;tick<12;tick++){steerMotion(body,job.aim,.1,Math.min(p.pace,job.speed));if(tick%3===2)path.push({x:body.x,y:body.y});}
   const initial=distance(p,focus);
   const carrierConflict=Math.max(0,...path.map((point,i)=>{
    const gap=distance(point,carrierPath[i]);
    return gap>initial+.2?0:clamp((2.5-gap)/2.5,0,1);
   }));
   return {...row,score:row.score+opportunity.gain+opportunity.development-carrierConflict*1.2,opportunity,access,path,start:p,gap:read.gap,coverage:exposure.coverage(p,job)};
  });
  const ranked=evaluated.sort((a,b)=>b.score-a.score);
  const kept:typeof ranked=[],alternatives:typeof ranked=[],buckets=new Map<string,typeof ranked>();
  for(const row of ranked){
   const key=`${row.job.kind==='run'?'run':row.job.purpose==='shape'?'shape':'support'}:${Math.sign(row.job.aim.y-focus.y)}:${Math.sign((row.job.aim.x-focus.x)*(focus.side?-1:1))}`;
   const bucket=buckets.get(key)??[];
   if(bucket.length>=2||bucket.some(other=>distance(other.job.aim,row.job.aim)<3))continue;
   (bucket.length?alternatives:kept).push(row);bucket.push(row);buckets.set(key,bucket);
  }
  // Keep a second distinct destination within a direction too: two teammates
  // may individually prefer the same place but cooperate via the alternative.
  const selected=fixed.has(p.id)?ranked.slice(0,1):[...kept.slice(0,8),...alternatives].slice(0,p.role==='GK'?4:10);
  const shape=ranked.find(c=>c.job.purpose==='shape');
  if(shape&&!fixed.has(p.id)&&!selected.includes(shape))selected.push(shape);
  // Under a committed rest defence each player keeps his best way of staying
  // behind the ball and his best way of joining it, so the bound can be met.
  if(constrained&&!fixed.has(p.id)&&p.role!=='GK')for(const behind of [true,false]){
   const best=ranked.find(c=>isRest(focus.side,focus,c.job.aim)===behind);
   if(best&&!selected.includes(best))selected.push(best);
  }
  return selected;
 });
 if(rows.some(r=>!r.length))return [];
 type Row=typeof rows[number][number];
 const pair=(a:Row,b:Row)=>{
  const initial=distance(a.start,b.start);
  const collision=Math.max(0,...a.path.map((v,i)=>{const gap=distance(v,b.path[i]);return gap>initial+.2?0:clamp((2-gap)/2,0,1);}));
  const obstruction=Math.max(laneObstruction(focus,a.job.aim,b.job.aim,1.5),laneObstruction(focus,b.job.aim,a.job.aim,1.5));
  // Nearby players may form an overload. Penalise blocking the actual lane
  // and colliding, not merely having two players on the same side.
  const sameDestination=clamp((2.2-distance(a.job.aim,b.job.aim))/2.2,0,1);
  return -collision*1.2-sameDestination*2-obstruction*.45+Math.max(attack.connection(a.opportunity,b.opportunity),attack.connection(b.opportunity,a.opportunity));
 };
 const pairs=rows.map((left,i)=>rows.map((right,j)=>j>i?left.map(a=>right.map(b=>pair(a,b))):[]));
 const carrierCover=exposure.coverage(focus);let best=-Infinity,chosen:Row[]=[];
 // "Bodies forward" is a priced preference (practice-rest-defence
 // commitmentPrice): each body out of the committed shape costs the
 // arrangement what its least disciplined player holds it at, against the
 // football value. Commit 3 and the build-up are unconstrained.
 const place=rows.map((r,i)=>r.map(row=>mates[i].role!=='GK'&&isRest(focus.side,focus,row.job.aim)));
 const outfield=mates.map(p=>p.role!=='GK');
 const search=(indices:number[],selection:Row[],score:number)=>{
  const i=selection.length;
  if(i===rows.length){
   // Value a usable escape in proportion to pressure, without demanding a
   // particular player, depth, or number of short-support assignments.
   const escape=Math.max(0,...selection.map(r=>r.access))*(.35+pressure*.85);
   let value=score+escape-exposure.cost([carrierCover,...selection.map(r=>r.coverage)]);
   if(constrained){
    value-=commitmentPrice(bounds,indices.flatMap((k,j)=>outfield[j]?[{rest:place[j][k],discipline:mates[j].traits.discipline}]:[]));
   }
   if(value>best){best=value;chosen=[...selection];}return;
  }
  rows[i].forEach((row,k)=>{
   let value=score+row.score;
   for(let j=0;j<i;j++)value+=pairs[j][i][indices[j]][k];
   indices.push(k);selection.push(row);search(indices,selection,value);selection.pop();indices.pop();
  });
 };
 search([],[],0);
 return chosen.map(r=>r.job);
}
