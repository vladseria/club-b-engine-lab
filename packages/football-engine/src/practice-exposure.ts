import {clamp} from './model.js';
import type {Tactics} from './model.js';
import {L} from './pitch.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {FootballJob} from './practice-coordination.js';

type Destination={player:string;aim:Vec;speed:number};
/** Read once per arrangement; candidate coverage can be reused when comparing
 * combinations. Scores are finite tactical costs, never permission to run. */
export function readTeamExposure(players:PracticePlayer[],carrier:PracticePlayer,tactics:Tactics){
 const depth=(v:Vec)=>carrier.side===0?v.x:L-v.x;
 const threats=[carrier,...players.filter(p=>p.side!==carrier.side&&p.role!=='GK'&&depth(p)<depth(carrier)-2)];
 // A free carrier is not an imminent turnover at his own feet. Price that
 // danger by nearby pressure; otherwise even a deep keeper attracts an
 // unnecessary covering teammate behind him. Opponents already left free
 // behind the ball remain separate threats regardless of carrier pressure.
 const nearest=Math.min(...players.filter(p=>p.side!==carrier.side&&p.role!=='GK').map(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)));
 const urgency=threats.map(threat=>threat===carrier?.15+.4*clamp((8-nearest)/6,0,1):clamp(1-depth(threat)/L,.25,1));
 const weight=1.4-clamp(tactics.commit,1,5)*.16;
 return {
  coverage(p:PracticePlayer,job?:Destination):number[]{
   // A short horizon avoids pretending distant destinations are already held.
   const d=job?Math.hypot(job.aim.x-p.x,job.aim.y-p.y):0;
   const fraction=job&&p.id!==carrier.id?Math.min(1,Math.max(0,job.speed)*1.2/Math.max(.01,d)):0;
   const point=job?{x:p.x+(job.aim.x-p.x)*fraction,y:p.y+(job.aim.y-p.y)*fraction}:p;
   return threats.map(threat=>{
    if(p.role==='GK'||p.id===threat.id)return 0;
    // Any outfielder can protect the goalward route. The carrier can screen
    // an opponent's outlet, but cannot cover his own hypothetical turnover.
    const goalward=clamp((depth(threat)-depth(point)+1)/5,0,1);
    const routeY=threat.y*clamp(depth(point)/Math.max(1,depth(threat)),0,1);
    return goalward*clamp(1-Math.abs(point.y-routeY)/10,0,1);
   });
  },
  cost(coverage:number[][]):number{
   let cost=0;
   for(let i=0;i<threats.length;i++){
    let covered=0;for(const player of coverage)covered=Math.max(covered,player[i]);
    cost+=(1-covered)*urgency[i];
   }
   return cost*weight;
  }
 };
}
export function teamExposure(players:PracticePlayer[],carrier:PracticePlayer,jobs:Record<string,FootballJob>,tactics:Tactics,change?:Destination):number {
 const read=readTeamExposure(players,carrier,tactics);
 return read.cost(players.filter(p=>p.side===carrier.side&&p.role!=='GK').map(p=>read.coverage(p,change?.player===p.id?change:jobs[p.id])));
}
