// PROBE (marking-probe, 2026-10-14). Off by default; nothing here runs unless MARKING_PROBE.on. Throwaway upper-bound
// test: does imperfect OFF-BALL marking open passing lanes? Defending side only; going for the ball stays exact.
//
// 1. Reaction to his man's change of direction or pace. When the man a defender marks turns by more than CUT_TURN
//    against his recent heading (an EMA of his velocity, CUT_TAU s), or bursts (speed CUT_BURST m/s above it), his
//    marker carries on along his own motion for a reaction delay before re-aiming:
//      REACT_BASE - REACT_SKILL x reading (0.45 s at 3, 0.3 at 6, 0.15 at 9), x scale,
//      + REACT_TIRED x tiredness (energy 90 -> 50), + REACT_WATCH while a pass is in the air or his man is out of view,
//      x (1 +- 25%) individual variation (hashed, never the engine's random stream).
//    Ended at once when a pass goes to his man (closing a receiver is going for the ball).
// 2. Crossing runners. When two men marked by two team-mates come within CROSS_R m of each other moving across
//    each other, each marker chooses on his own: follow his man or swap. The better choice (cheaper total run 0.5 s
//    ahead) is taken with probability 1 - CROSS_ERR x (10 - reading) x scale. If they agree, the engine's own
//    assignment (its exchange rule) carries on. If they disagree, both go for the same man for CROSS_HOLD s
//    (longer for poorer readers), leaving the other free, then the engine's assignment takes over again.
import type {Vec} from './movement.js';
import type {FootballJob} from './practice-coordination.js';
import {inView,lookingAt} from './practice-perception.js';

export const MARKING_PROBE:{on:boolean;scale:number;react:boolean;cross:boolean;trace?:(o:any)=>void}={on:false,scale:1,react:true,cross:true};
export function setMarkingProbe(on:boolean,scale=1,o:{react?:boolean;cross?:boolean}={}){MARKING_PROBE.on=on;MARKING_PROBE.scale=scale;MARKING_PROBE.react=o.react??true;MARKING_PROBE.cross=o.cross??true;}
export const CUT_TURN=40*Math.PI/180,CUT_TAU=.25,CUT_MIN=1.5,CUT_BURST=1.2,CUT_BURST_MIN=2.5,CUT_GAP=.4;
export const REACT_BASE=.6,REACT_SKILL=.05,REACT_TIRED=.15,REACT_WATCH=.1,REACT_REST=.3;
export const CROSS_R=2,CROSS_REL=1.5,CROSS_ERR=.04,CROSS_HOLD=.4,CROSS_HOLD_SKILL=.04,CROSS_COOL=1.5;
/** Per-match counters (read by the evidence harness). */
export const PROBE_COUNT={cuts:0,lapses:0,lapseSec:0,crossings:0,agreeSwap:0,agreeFollow:0,mismatch:0,overrideSec:0,sepN:0,sepGain:0,sepEnd:0};
export function resetProbeCount(){for(const k of Object.keys(PROBE_COUNT))(PROBE_COUNT as any)[k]=0;}

interface P extends Vec {id:string;side:0|1;role:string;vx:number;vy:number;angle:number;energy:number;pace:number;skills:{reading:number}}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function hash(s:string):number{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>13;h=Math.imul(h,0x5bd1e995);h^=h>>>15;return (h>>>0)/4294967296;}

export class MarkingProbe{
 private ema=new Map<string,{vx:number;vy:number}>();private cutAt=new Map<string,number>();
 private lapse=new Map<string,{until:number;vx:number;vy:number;man:string;d0:number}>();private rest=new Map<string,number>();
 private cross=new Map<string,{until:number;target:string;was:string}>();private pairCool=new Map<string,number>();
 reset(){this.ema.clear();this.cutAt.clear();this.lapse.clear();this.rest.clear();this.cross.clear();this.pairCool.clear();}
 /** Once a tick, before movement. `jobs`: the coordination plan's jobs; `exact(id)`: his man is on the ball or a pass is going to him. */
 update(time:number,dt:number,players:readonly P[],attacking:0|1,ball:Vec,inFlight:boolean,jobs:Record<string,FootballJob>|undefined,exact:(id:string)=>boolean){
  if(!jobs){this.lapse.clear();this.cross.clear();return;}
  const S=MARKING_PROBE.scale,byId=new Map(players.map(p=>[p.id,p]));
  const markOf=(d:P)=>{const j=jobs[d.id];return j&&j.purpose==='mark'&&j.target&&byId.has(j.target)&&!exact(j.target)?j.target:undefined;};
  const defenders=players.filter(p=>p.side!==attacking&&p.role!=='GK');
  // a lapse or an override ends when his job stops being marking that man, or the ball goes to him
  for(const [id,l] of this.lapse){const d=byId.get(id);if(!d||markOf(d)!==l.man||time>=l.until){const m=byId.get(l.man);if(d&&m&&time>=l.until){const e=Math.hypot(d.x-m.x,d.y-m.y);PROBE_COUNT.sepN++;PROBE_COUNT.sepGain+=e-l.d0;PROBE_COUNT.sepEnd+=e;}this.lapse.delete(id);}}
  for(const [id,c] of this.cross){const d=byId.get(id);if(!d||time>=c.until||exact(c.target)||!markOf(d))this.cross.delete(id);}
  for(const a of players){
   if(a.side!==attacking||a.role==='GK')continue;
   const e=this.ema.get(a.id)??{vx:a.vx,vy:a.vy},sp=Math.hypot(a.vx,a.vy),se=Math.hypot(e.vx,e.vy);
   let cut=false;
   if(sp>CUT_MIN&&se>CUT_MIN){const c=(a.vx*e.vx+a.vy*e.vy)/(sp*se);if(Math.acos(clamp(c,-1,1))>CUT_TURN)cut=true;}
   if(sp-se>CUT_BURST&&sp>CUT_BURST_MIN)cut=true;
   const k=Math.min(1,dt/CUT_TAU);this.ema.set(a.id,{vx:e.vx+(a.vx-e.vx)*k,vy:e.vy+(a.vy-e.vy)*k});
   if(!MARKING_PROBE.react||!cut||time-(this.cutAt.get(a.id)??-Infinity)<CUT_GAP)continue;
   this.cutAt.set(a.id,time);PROBE_COUNT.cuts++;
   for(const d of defenders){
    if(markOf(d)!==a.id||this.lapse.has(d.id)||this.cross.has(d.id)||time<(this.rest.get(d.id)??-Infinity))continue;
    const r=d.skills.reading,seen=inView(d,lookingAt(d,ball),a);
    let delay=(REACT_BASE-REACT_SKILL*r)*S+REACT_TIRED*clamp((90-d.energy)/40,0,1)+(inFlight||!seen?REACT_WATCH:0);
    delay=Math.max(0,delay*(1+.5*(hash(`${d.id}|${a.id}|${Math.round(time*20)}`)-.5)));
    this.lapse.set(d.id,{until:time+delay,vx:d.vx,vy:d.vy,man:a.id,d0:Math.hypot(d.x-a.x,d.y-a.y)});this.rest.set(d.id,time+delay+REACT_REST);
    PROBE_COUNT.lapses++;MARKING_PROBE.trace?.({t:time,k:'lapse',d:d.id,m:a.id,delay});
   }
  }
  if(!MARKING_PROBE.cross)return;
  for(let i=0;i<defenders.length;i++)for(let j=i+1;j<defenders.length;j++){
   const A=defenders[i],B=defenders[j],ma=markOf(A),mb=markOf(B);
   if(!ma||!mb||ma===mb||this.cross.has(A.id)||this.cross.has(B.id))continue;
   const MA=byId.get(ma)!,MB=byId.get(mb)!,key=[ma,mb].sort().join('+');
   if(time<(this.pairCool.get(key)??-Infinity))continue;
   const dx=MB.x-MA.x,dy=MB.y-MA.y,dd=Math.hypot(dx,dy);if(dd>=CROSS_R)continue;
   const rvx=MB.vx-MA.vx,rvy=MB.vy-MA.vy;if(Math.hypot(rvx,rvy)<CROSS_REL)continue;
   this.pairCool.set(key,time+CROSS_COOL);PROBE_COUNT.crossings++;
   const at=(m:P)=>({x:m.x+m.vx*.5,y:m.y+m.vy*.5}),pa=at(MA),pb=at(MB),dist=(u:Vec,v:Vec)=>Math.hypot(u.x-v.x,u.y-v.y);
   const swapBetter=dist(A,pb)+dist(B,pa)<dist(A,pa)+dist(B,pb);
   const pick=(d:P,salt:string)=>{const err=clamp(CROSS_ERR*(10-d.skills.reading)*S,0,.5),right=hash(`${d.id}|${key}|${Math.round(time*20)}|${salt}`)>=err;return right?swapBetter:!swapBetter;};
   const sa=pick(A,'a'),sb=pick(B,'b');
   if(sa===sb){if(sa)PROBE_COUNT.agreeSwap++;else PROBE_COUNT.agreeFollow++;continue;}
   PROBE_COUNT.mismatch++;MARKING_PROBE.trace?.({t:time,k:'mismatch',a:A.id,b:B.id,ta:sa?mb:ma,tb:sb?ma:mb,free:sa?ma:mb});
   const hold=(CROSS_HOLD+CROSS_HOLD_SKILL*(10-(A.skills.reading+B.skills.reading)/2))*S;
   this.cross.set(A.id,{until:time+hold,target:sa?mb:ma,was:ma});this.cross.set(B.id,{until:time+hold,target:sb?ma:mb,was:mb});
   this.lapse.delete(A.id);this.lapse.delete(B.id);
  }
 }
 /** The probe's movement for a defender this tick, if any: replaces his marking aim. */
 movement(d:P,goal:Vec,players:readonly P[],dt:number):{aim:Vec;velocity:Vec;limit:number}|undefined{
  const c=this.cross.get(d.id);
  if(c){const m=players.find(p=>p.id===c.target);if(m){PROBE_COUNT.overrideSec+=dt;const gx=goal.x-m.x,gy=goal.y-m.y,n=Math.hypot(gx,gy)||1;
   return {aim:{x:m.x+gx/n,y:m.y+gy/n},velocity:{x:m.vx*.5,y:m.vy*.5},limit:d.pace};}}
  const l=this.lapse.get(d.id);
  if(l){PROBE_COUNT.lapseSec+=dt;const s=Math.hypot(l.vx,l.vy);return {aim:{x:d.x+l.vx,y:d.y+l.vy},velocity:{x:l.vx,y:l.vy},limit:Math.max(.3,s)};}
  return undefined;
 }
}
