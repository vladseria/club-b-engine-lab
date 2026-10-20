// Defensive ceiling (2026-10-20): the perfect-defending controller for one side (elements a-d, README). Evidence only.
// install() puts its gates on globalThis for the bundle-time hooks (hook.mjs); uninstall() removes them.
import {arrivalTime} from '../../src/practice-arrival';
import {RUN_SET,RUN_AIM,HABIT_IN,AHEAD,TAKE_LEAD} from '../../src/practice-defending';

const L=48;
/** Element d's gap (m) and element c's run end (s below RUN_SET m/s at our goal). */
export const COMPACT=5,RUN_END=.5;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

interface Run {since:number;fast:number;from:number;by:string}
export function controller(side:0|1,el:Set<string>){
 const G=globalThis as any;
 const log={looks:0,runs:0,runFrom:0,locks:0,switches:0,unassigned:0,lockedLooks:0,capLooks:0,capped:0,capM:0};
 const runs=new Map<string,Run>();let lock=new Map<string,string>(),att=-1;
 const is=(p:any,e:string)=>el.has(e)&&!!p&&p.side===side&&p.role!=='GK'&&typeof G.__pdSideNow==='function'&&G.__pdSideNow()!==side;
 /** Element c: who is running from deep, and who is on him (decided on the exact picture, at every look). */
 const locksFor=(given:any):Map<string,string>=>{
  const {players,carrier,receiver,available,busy,fixed,memory,time}=given,D=given.defending,A=given.attacking;
  const g={x:D===0?0:L,y:0},ref=carrier??(receiver?receiver.meet:given.loose??given.ball),db=depth(D,ref.x);
  const ours=players.filter((q:any)=>q.side===D&&q.role!=='GK');
  for(const a of players){
   if(a.side!==A||a.role==='GK')continue;
   const vg=(D===0?-1:1)*a.vx,speed=Math.hypot(a.vx,a.vy),r=runs.get(a.id);
   if(r){if(a.id===carrier?.id){runs.delete(a.id);continue;}if(vg>=RUN_SET)r.fast=time;if(time-r.fast>RUN_END)runs.delete(a.id);continue;}
   if(a.id===carrier?.id||vg<RUN_SET||vg<RUN_AIM*speed||dist(a,g)<HABIT_IN)continue;
   // readRun's own "from deep" test, on the exact picture: not clearly ahead of the ball, or in front of one of us
   if(!(depth(D,a.x)>=db-AHEAD||ours.some((q:any)=>dist(q,g)<dist(a,g)-.5)))continue;
   runs.set(a.id,{since:time,fast:time,from:depth(D,a.x),by:''});log.runs++;log.runFrom+=depth(D,a.x);
  }
  for(const id of [...runs.keys()])if(!players.some((p:any)=>p.id===id))runs.delete(id);
  const men=memory&&memory.attacking===A&&memory.side===D?memory.men:{};
  const ownerOf=(id:string)=>Object.entries(men as Record<string,{target:string}>).filter(([,m])=>m.target===id).map(([d])=>d).sort()[0];
  const presser=carrier?ownerOf(carrier.id):undefined;
  const pool=available.filter((q:any)=>q.role!=='GK'&&!busy.has(q.id)&&!fixed.has(q.id)&&!given.locked?.has(q.id));
  const free=(id:string|undefined,taken:Set<string>)=>!!id&&id!==presser&&!taken.has(id)&&pool.some((q:any)=>q.id===id);
  const out=new Map<string,string>(),taken=new Set<string>();
  for(const [id,r] of [...runs.entries()].sort((x,y)=>x[1].since-y[1].since||x[0].localeCompare(y[0]))){
   const a=players.find((p:any)=>p.id===id);
   let by=free(r.by,taken)?r.by:free(ownerOf(id),taken)?ownerOf(id):undefined;
   if(!by){
    const t=TAKE_LEAD,v={x:a.x+a.vx*t,y:a.y+a.vy*t},d=dist(v,g)||1,spot={x:v.x+(g.x-v.x)/d*1.3,y:v.y+(g.y-v.y)/d*1.3};
    by=pool.filter((q:any)=>free(q.id,taken)).map((q:any)=>({q,t:arrivalTime(q,spot)})).sort((x:any,y:any)=>x.t-y.t||x.q.id.localeCompare(y.q.id))[0]?.q.id;
   }
   if(!by){log.unassigned++;continue;}
   if(r.by!==by){if(r.by)log.switches++;else log.locks++;r.by=by;}
   out.set(by,id);taken.add(by);
  }
  return out;
 };
 /** Element d: nobody but the man on the ball's pressure (presser, cover) and the defender of the ball's man stands more
  * than COMPACT m further from our goal than our deepest outfielder's spot. He is moved along his own line to our goal
  * centre (so he stays goal-side of whatever he marks), and the part of his velocity away from our goal is dropped. */
 const compactPlan=(plan:any,given:any)=>{
  const D=given.defending,g={x:D===0?0:L,y:0},ball=new Set([given.carrier?.id,given.receiver?.id].filter(Boolean));
  const jobs=plan.jobs.filter((j:any)=>j.purpose!=='press'&&j.player!==plan.collector?.id);
  if(!jobs.length)return plan;
  const cap=Math.min(...jobs.map((j:any)=>depth(D,j.aim.x)))+COMPACT;let any=false;
  for(const j of plan.jobs){
   if(j.purpose==='press'||j.purpose==='cover'||j.player===plan.collector?.id||(j.target&&ball.has(j.target)))continue;
   const d=depth(D,j.aim.x);if(d<=cap+1e-9)continue;
   const f=(d-cap)/Math.max(1e-6,d);
   j.aim={x:j.aim.x+(g.x-j.aim.x)*f,y:j.aim.y+(g.y-j.aim.y)*f};
   if(j.velocity&&(D===0?j.velocity.x>0:j.velocity.x<0))j.velocity={x:0,y:j.velocity.y};
   j.reason='[PD-d] '+j.reason;log.capped++;log.capM+=d-cap;any=true;
  }
  if(any)log.capLooks++;
  return plan;
 };
 const install=()=>{
  G.__pdIs=is;
  if(el.has('c'))G.__pdRun=(d:string,a:string)=>lock.get(d)===a;
  if(el.has('c')||el.has('d'))G.__pdDefend={side,wrap:(given:any,inner:(g:any)=>any)=>{
   log.looks++;
   if(given.restart||given.attacking!==att){runs.clear();lock=new Map();att=given.attacking;}
   let input=given;
   if(el.has('c')&&!given.restart){
    lock=locksFor(given);
    if(lock.size){const m=new Map(given.locked??[]);for(const [d,a] of lock)m.set(d,a);input={...given,locked:m};log.lockedLooks++;}
   }else lock=new Map();
   const plan=inner(input);
   return el.has('d')&&!given.restart?compactPlan(plan,input):plan;
  }};
 };
 return {install,log,is,locksFor,compactPlan,runs};
}
export const uninstall=()=>{const G=globalThis as any;G.__pdIs=undefined;G.__pdRun=undefined;G.__pdDefend=undefined;};

