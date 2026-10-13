// PROTOTYPE (support-proto, 2026-10-14). Off by default; nothing here runs unless FREE_SUPPORT.on.
//
// Free support: an off-ball team-mate of the man on the ball (own and middle thirds only) chooses where to stand
// by what a pass to him there would be worth, read by the CARRIER'S OWN pass model (groundOptions: lane risk,
// receiver prospects, advance, threat, the turnover price), as he himself reads it (his reading/passing set how far
// off his read is). No template spot: candidates come from the situation (reachable points around him in ~1.5 s, and
// the gaps between their outfielders), and the plan only re-weights advance against safety.
//
// Trade-offs, all priced, none a rule:
//  - value of the pass to him there (groundOptions score, re-weighted by progression);
//  - what the team still needs behind the ball: leaving the rest defence costs the loss danger it adds
//    (restDefence / lossDanger, as the cutback job prices it), times the chance the possession is lost;
//  - travel time; crowding a team-mate's destination (the job selection's pair terms add more).
import {clamp} from './model.js';
import type {Tactics} from './model.js';
import {L,W} from './pitch.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {FootballJob} from './practice-coordination.js';
import {arrivalTime} from './practice-defense.js';
import {groundOptions,passAdvance} from './practice-passing.js';
import {LOSS_SCALE,lossDanger,lossRead,restDefence} from './practice-rest-defence.js';
import {perceive} from './practice-perception.js';

export const FREE_SUPPORT:{on:boolean;trace?:(o:any)=>void}={on:false};
export function setFreeSupport(on:boolean){FREE_SUPPORT.on=on;}
/** Ball depth (m from our goal) below which free support replaces the template support jobs: own + middle thirds. */
export const FREE_ZONE=32;
/** What "useful" means by the plan: how much advance and how much safety weigh against the neutral read. */
export const FREE_PLAN:Record<Tactics['progression'],{advance:number;safety:number}>={direct:{advance:1.4,safety:.8},mixed:{advance:1,safety:1},patient:{advance:.75,safety:1.3}};
/** Row score = FREE_BASE + FREE_GAIN x (the pass's value as he reads it) - costs. FREE_BASE sits where a template
 * job's fit sits (about 1), so free rows compete with the runs that remain. */
export const FREE_BASE=1,FREE_GAIN=1.6,FREE_TRAVEL=.12,FREE_CROWD=.6,FREE_STAY=.15;
/** (iteration 4) A soft pull towards his place in the team's shape (the plan's slot, practice-shape): FREE_ANCHOR per
 * metre beyond FREE_ANCHOR_SLACK m from it. A price, not a boundary (B-Human-style soft role region). */
export const FREE_ANCHOR=.03,FREE_ANCHOR_SLACK=5;
/** The chance a possession here is lost before it moves on (roughly the support study's 25-47%): what leaving the rest defence is priced at. */
export const FREE_LOSS=.35;
/** How far off his read of a spot's value is, for a player who cannot read (scaled by misread: reading and passing). */
export const FREE_SPREAD=.25;
/** Candidates kept for the full (carrier-model) read, and rows offered to the job selection. */
export const FREE_SHORTLIST=5,FREE_ROWS=5;

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(p:Vec):Vec=>({x:clamp(p.x,1,(L-1)),y:clamp(p.y,-(W/2-1.5),(W/2-1.5))});
type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;

export interface FreeRow {job:FootballJob;score:number}
/** (iteration 2) How the opponents will stand when he gets there, as he reads it: everyone carries on along his
 * current motion (up to FREE_AHEAD s); a man marking him comes with him, goal-side of the new spot, when he reads that
 * man as able to get there by the time he does (the race read: reading sets the error, FREE_RACE_SPREAD s). */
export const FREE_AHEAD=.8,FREE_RACE_SPREAD=.4,FREE_GOALSIDE=1.2;
function projected(players:PracticePlayer[],p:PracticePlayer,spot:Vec,travel:number,markers:ReadonlySet<string>,time:number):PracticePlayer[]{
 const h=Math.min(travel,FREE_AHEAD),s=p.side===0?-1:1;
 return players.map(o=>{
  if(o.side===p.side||o.role==='GK')return o;
  if(markers.has(o.id)){
   const to={x:spot.x+s*FREE_GOALSIDE,y:spot.y},his=arrivalTime(o,to);
   const margin=perceive(p,'race',travel-his,FREE_RACE_SPREAD,spot,{time,salt:'marker'+o.id});
   const f=margin>=0?1:clamp(travel/Math.max(.1,his),0,1);
   return {...o,x:o.x+(to.x-o.x)*f,y:o.y+(to.y-o.y)*f,vx:0,vy:0};
  }
  return {...o,x:o.x+o.vx*h,y:o.y+o.vy*h};
 });
}
export function freeSupportRows(players:PracticePlayer[],carrier:PracticePlayer,p:PracticePlayer,t:Tactics,laneRisk:Risk,time:number,previous:FootballJob|undefined,taken:readonly Vec[],markers:ReadonlySet<string>=new Set(),slot?:Vec):FreeRow[]{
 const side=p.side,dep=(x:number)=>side===0?x:L-x,bd=dep(carrier.x);
 const opponents=players.filter(q=>q.side!==side),outfield=opponents.filter(q=>q.role!=='GK');
 // ---- candidates from the situation
 const reach=clamp(p.pace,4.5,7.5),raw:Vec[]=[{x:p.x,y:p.y}];
 for(let k=0;k<8;k++){const a=k*Math.PI/4;for(const r of [reach*.45,reach,reach*1.7])raw.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r});}
 for(let i=0;i<outfield.length;i++)for(let j=i+1;j<outfield.length;j++){
  const a=outfield[i],b=outfield[j];if(distance(a,b)>=4)raw.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 }
 const prior=previous?.purpose==='free'?previous.aim:undefined;
 if(prior)raw.push(prior);
 const pts:{v:Vec;travel:number}[]=[];
 for(const r of raw){
  const v=inside(r);if(pts.some(o=>distance(o.v,v)<1))continue;
  const gap=distance(v,carrier);if(gap<3.5||gap>24)continue;
  const travel=arrivalTime(p,v);if(travel>2.6)continue;
  if(outfield.some(q=>distance(q,v)<1.2))continue;
  pts.push({v,travel});
 }
 if(!pts.length)return [];
 const plan=FREE_PLAN[t.progression];
 // ---- cheap shortlist: lane, room, depth gained
 const shortlist=pts.map(c=>{
  const seenOpp=projected(players,p,c.v,c.travel,markers,time).filter(q=>q.side!==side);
  const gap=distance(c.v,carrier),risk=laneRisk(carrier,c.v,seenOpp);
  const closing=Math.min(...seenOpp.filter(q=>q.role!=='GK').map(q=>arrivalTime(q,c.v))),room=clamp((closing-(.2+gap/12))/.8,0,1);
  const adv=clamp((dep(c.v.x)-bd)/12,-1,1);
  return {...c,cheap:(1-risk)*(.4+.6*room)+.25*adv*(1-risk)*plan.advance-.1*c.travel};
 }).sort((a,b)=>b.cheap-a.cheap);
 const chosen=shortlist.slice(0,FREE_SHORTLIST);
 if(prior){const c=shortlist.find(c=>distance(c.v,prior)<1);if(c&&!chosen.includes(c))chosen.push(c);}
 // ---- the rest defence behind the ball (others' current places), as he reads the loss
 const rest=restDefence(carrier,players),wasRest=dep(p.x)<bd,others=rest.rest-(wasRest?1:0);
 const danger=(behind:boolean)=>LOSS_SCALE*lossDanger(bd/L,rest.threats+1-others-(behind?1:0));
 const lossFelt=lossRead(p,carrier),leaving=(danger(false)-danger(true))*lossFelt*FREE_LOSS;
 // ---- the carrier's own model of a pass to him there
 const rows:FreeRow[]=[];
 for(const c of chosen){
  const q:PracticePlayer={...p,x:c.v.x,y:c.v.y,vx:0,vy:0};
  const world=projected(players,p,c.v,c.travel,markers,time).map(o=>o.id===p.id?q:o);
  const best=groundOptions(carrier,q,world,false,undefined,carrier,laneRisk)[0];
  if(!best)continue;
  const risk=best.pass?.risk??1,advance=passAdvance(carrier,carrier,best.aim??c.v);
  const value=best.score+(plan.advance-1)*advance*.3*(1-risk)-(plan.safety-1)*risk*.5;
  const seen=perceive(p,'lane',value,FREE_SPREAD,c.v,{time,salt:'free'});
  const behind=dep(c.v.x)<bd,restCost=behind?0:Math.max(0,leaving);
  const crowd=Math.max(0,...taken.map(v=>clamp((2.5-distance(v,c.v))/2.5,0,1)));
  const stay=prior&&distance(prior,c.v)<1.5?FREE_STAY:0;
  const anchor=slot?FREE_ANCHOR*Math.max(0,distance(slot,c.v)-FREE_ANCHOR_SLACK):0;
  const score=FREE_BASE+FREE_GAIN*seen-restCost-FREE_TRAVEL*c.travel-FREE_CROWD*crowd+stay-anchor;
  const continuing=!!prior&&distance(prior,c.v)<1.5;
  if(FREE_SUPPORT.trace)FREE_SUPPORT.trace({p:p.id,bd,rel:dep(c.v.x)-bd,score,value,seen,risk,restCost,travel:c.travel,crowd,gap:distance(c.v,carrier),stay:distance(c.v,p)<.5,open:Math.min(...world.filter(q=>q.side!==side&&q.role!=='GK').map(q=>distance(q,c.v))),zone:bd<16?0:1});
  rows.push({score,job:{player:p.id,purpose:'free',kind:'support',aim:c.v,speed:p.pace*(c.travel>1?.88:.8),target:carrier.id,
   since:continuing?previous!.since:time,until:time+clamp(c.travel+.6,1,2.5),
   reason:'Se mută unde o pasă spre el valorează cel mai mult acum.'}});
 }
 return rows.sort((a,b)=>b.score-a.score).slice(0,FREE_ROWS);
}
