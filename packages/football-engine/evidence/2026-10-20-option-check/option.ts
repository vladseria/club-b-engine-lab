// Option check (2026-10-20): forced-option rollouts from exact match states. Evidence only; bundled through hook.mjs.
// See README.md for the design. One task = one match (arm, seed):
//   passA  plays the match with an observer: every open-play carrier decision with >= 2 option classes inside the
//          engine's own viable band is recorded (tick, carrier, classes, scores, state hash at the tick's top).
//   select picks the frames (strata: carrier's style x pitch third; deterministic from the seed).
//   passB  replays the match; at the top of each frame's tick it snapshots the whole match state, then for every arm
//          (each forced class-best option, plus the unforced engine) and every rollout seed: rewind, play to the
//          carrier's decision (identical by determinism), force the arm's option (or let him choose), reseed every
//          random stream (same reseed for every arm at a given seed index: common random numbers), play H seconds,
//          read the outcome. Then it rewinds once more and lets the match carry on untouched to the next frame.
import {computeMatch} from '../../../../lib/ballers/compute';
import {rateOf,CHANCE_TABLE} from '../../../../lib/ballers/chances';
import {inputOf} from '../2026-10-10-cloud-measure/mirror';
import {viableOptions} from '../../src/practice-carry';
import {actionWeights} from '../../src/practice-selection';
import {ENGINE_BUILD} from '../../src/build-info';
import {createHash} from 'node:crypto';

export const L=48,STEP_GUESS=0.05;
/** The engine's viable band (practice-carry viableOptions: every option within .085 of the best). */
export const VIABLE=.085;
/** Forced options: the top option plus each other class's best within this of the top. */
export const BAND=.20;
export const CLASSES=['behind','pass','back','carry','takeon','shot'] as const;
type Cls=typeof CLASSES[number];

// ------------------------------------------------------------------ snapshot / restore (whole match state)
/** Record arrays only ever appended to (and their last element finished within the tick that pushed it). */
const APPEND_ONLY=new Set(['frames','events','choices','aerialDuels','controlContacts','receptionDuels','airChallenges']);
interface Snap {lets:Record<string,unknown>;saved:Map<object,any>;rngs:[Function,number][]}
export function snapshot(v:Record<string,any>,letNames:string[]):Snap{
 const saved=new Map<object,any>(),rngs:[Function,number][]=[],rngSeen=new Set<Function>(),stack:object[]=[];
 const visit=(x:any)=>{
  if(x===null)return;const t=typeof x;
  if(t==='function'){const r=x.__rng;if(r&&!rngSeen.has(x)){rngSeen.add(x);rngs.push([x,r[0]()]);}return;}
  if(t!=='object'||saved.has(x))return;
  let s:any;
  if(Array.isArray(x))s={a:x.slice()};
  else if(x instanceof Map)s={m:[...x]};
  else if(x instanceof Set)s={s:[...x]};
  else if(ArrayBuffer.isView(x))s={t:(x as any).slice()};
  else if(Object.isFrozen(x))s={frozen:true,o:Object.getOwnPropertyDescriptors(x)};
  else{const keys=Object.keys(x);
   if(Object.getOwnPropertyNames(x).length===keys.length&&!Object.getOwnPropertySymbols(x).length)s={k:keys,v:keys.map(k=>x[k])};
   else s={o:Object.getOwnPropertyDescriptors(x)};}
  saved.set(x,s);stack.push(x);
 };
 for(const [k,x] of Object.entries(v)){
  if(APPEND_ONLY.has(k)&&Array.isArray(x)){saved.set(x,{len:x.length});continue;}
  visit(x);
 }
 while(stack.length){
  const x=stack.pop()!,s=saved.get(x);
  if(s.a)for(const e of s.a)visit(e);
  else if(s.m)for(const [a,b] of s.m){visit(a);visit(b);}
  else if(s.s)for(const e of s.s)visit(e);
  else if(s.v)for(const e of s.v)visit(e);
  else if(s.o)for(const d of Object.values(s.o) as PropertyDescriptor[]){if('value' in d)visit(d.value);else{visit(d.get);visit(d.set);}}
 }
 const lets:Record<string,unknown>={tick:v.tick};for(const n of letNames)lets[n]=v[n];
 return {lets,saved,rngs};
}
export function restore(S:Snap,set:(v:any)=>void){
 for(const [x,s] of S.saved as Map<any,any>){
  if(s.len!==undefined){x.length=s.len;continue;}
  if(s.a){x.length=s.a.length;for(let i=0;i<s.a.length;i++)x[i]=s.a[i];}
  else if(s.m){x.clear();for(const [a,b] of s.m)x.set(a,b);}
  else if(s.s){x.clear();for(const e of s.s)x.add(e);}
  else if(s.t)x.set(s.t);
  else if(s.frozen)continue;
  else if(s.k){
   const now=Object.keys(x);let same=now.length===s.k.length;
   if(same)for(let i=0;i<now.length;i++)if(now[i]!==s.k[i]){same=false;break;}
   if(!same)for(const k of now)delete x[k];// re-add in the saved order: key order is behaviour too
   for(let i=0;i<s.k.length;i++)x[s.k[i]]=s.v[i];
  }else{
   for(const k of Reflect.ownKeys(x))if(!(k in s.o))delete x[k];
   Object.defineProperties(x,s.o);
  }
 }
 for(const [g,st] of S.rngs)(g as any).__rng[1](st);
 set({...S.lets});
}
const fmix=(h:number)=>{h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;};
/** Every random stream the match owns gets a fresh state from (frame, seed index, stream index). */
export function reseed(S:Snap,frameKey:number,seedIndex:number){
 S.rngs.forEach(([g],i)=>(g as any).__rng[1](fmix(fmix(frameKey^0x9e3779b9)^fmix((seedIndex+1)*0x632be5ab)^fmix((i+1)*0x7feb352d))));
}
/** A cheap fingerprint of the match state at a tick's top: every player's and the ball's kinematics, the score, the
 * clock, the random streams' states and the record lengths. */
export function stateHash(v:Record<string,any>):string{
 const h=createHash('sha1');
 h.update(JSON.stringify([v.tick,v.time,v.side,v.score,v.events.length,v.frames.length,v.ball,
  v.players.map((p:any)=>[p.id,p.x,p.y,p.vx,p.vy,p.angle,p.energy,p.duty]),
  ['random','execution','duelDraw','airRandom','balanceDraw'].map(k=>v[k].__rng[0]())]));
 return h.digest('hex').slice(0,16);
}

// ------------------------------------------------------------------ option classes
const depthOf=(s:number,x:number)=>s===0?x:L-x;
export function classify(p:any,players:any[],o:any):Cls{
 if(o.kind==='shoot')return 'shot';
 if(o.kind==='feint')return 'takeon';
 if(o.kind==='carry')return 'carry';
 if(o.kind==='clear')return 'back';
 const pd=depthOf(p.side,p.x),ad=depthOf(p.side,o.aim.x);
 const last=Math.max(...players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>depthOf(p.side,q.x)));
 if(ad>last||((o.kind==='through'||o.kind==='loft')&&o.run))return 'behind';
 if(ad<pd-2)return 'back';
 return 'pass';
}
/** The engine's own choice over `available`: practice-carry chooseFootballOption's arithmetic (viableOptions, the held
 * route's stand-in at the best carry's value, then practice-selection actionWeights). p: each option's probability
 * (0 outside the viable set); eff: the score it is drawn at (the stand-in's for a held route, else its own). */
function choice(available:any[],plan:any,time:number):{p:number[];eff:number[]}{
 const viable=viableOptions(available,plan,time);
 const held=viable.find((o:any)=>o.carry&&o.continuing),bestCarry=Math.max(-Infinity,...available.filter((o:any)=>o.carry).map((o:any)=>o.score));
 const standIn=held&&!viable.some((o:any)=>o.carry&&o!==held)&&bestCarry>held.score?{...held,score:bestCarry}:null;
 const w=actionWeights(standIn?viable.map((o:any)=>o===held?standIn:o):viable);
 const tot=w.reduce((a,b)=>a+b.weight,0),by=new Map<any,number>();
 for(const {option,weight} of w){const o=option===standIn?held:option;by.set(o,(by.get(o)??0)+weight/tot);}
 return {p:available.map(o=>by.get(o)??0),eff:available.map(o=>o===held&&standIn?standIn.score:o.score)};
}

// ------------------------------------------------------------------ match helpers
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,24);
const plat=()=>`${process.platform}-${process.arch}-node${process.versions.node}`;

/** Untransformed or transformed bundle, no hooks: the match's compact replay hash and score. */
export function plain(arm:string,seed:number){
 const t0=performance.now(),r=computeMatch(inputOf(arm,seed));
 return {arm,seed,hash:sha(r.compact),score:r.compact.score,build:r.engineBuild.slice(0,8),ms:Math.round(performance.now()-t0),plat:plat()};
}

export interface Decision {tick:number;time:number;id:string;side:number;depth:number;hash:string;n:number;top:number;
 cls:Partial<Record<Cls,{i:number;score:number;raw:number;kind:string;target?:string;pOpt:number;p:number}>>;topCls:Cls;viableCls:number}
/** One decision's classes. Each class's representative is the option of that class the engine is likeliest to play
 * (then the higher drawn score); the engine's top is its likeliest option overall; viableCls counts the classes the
 * engine would actually draw (its viable set: within .085 of the best, undominated). */
export function describe(p:any,players:any[],available:any[],plan:any,time:number){
 const {p:pr,eff}=choice(available,plan,time),cl=available.map(o=>classify(p,players,o));
 const cls:Decision['cls']={};
 available.forEach((o,i)=>{const c=cl[i],b=cls[c];
  if(!b||pr[i]>b.pOpt||pr[i]===b.pOpt&&eff[i]>b.score)cls[c]={i,score:eff[i],raw:o.score,kind:o.kind,...(o.target?{target:o.target}:{}),pOpt:pr[i],p:0};});
 available.forEach((o,i)=>{cls[cl[i]]!.p+=pr[i];});
 let ti=0;for(let i=1;i<available.length;i++)if(pr[i]>pr[ti]||pr[i]===pr[ti]&&eff[i]>eff[ti])ti=i;
 return {top:eff[ti],cls,topCls:cl[ti],viableCls:Object.values(cls).filter(b=>b!.p>0).length};
}
/** Pass A: the match with an observer recording every eligible decision. `hashTicks`: extra tick-top hashes to keep. */
export function passA(arm:string,seed:number,hashTicks:number[]=[]){
 const decisions:Decision[]=[],hashes:Record<number,string>={};let cur:any=null,curHash='',decides=0,openPlay=0;
 const want=new Set(hashTicks);
 (globalThis as any).__oc={
  // the fingerprint is taken at the tick's top, where pass B snapshots (players move inside the tick before deciding)
  top(tick:number,get:()=>any){cur=get();curHash=stateHash(cur);if(want.has(tick))hashes[tick]=curHash;},
  decide(p:any,time:number,tick:number,available:any[]){
   decides++;if(!available.length)return undefined;openPlay++;
   const d=describe(p,cur.players,available,cur.carryPlan,time);
   if(d.viableCls<2)return undefined;
   decisions.push({tick,time,id:p.id,side:p.side,depth:depthOf(p.side,p.x),hash:curHash,n:available.length,...d});
   return undefined;
  },
 };
 const t0=performance.now();let r:any;
 try{r=computeMatch(inputOf(arm,seed));}finally{(globalThis as any).__oc=undefined;}
 return {hash:sha(r.compact),score:r.compact.score,ms:Math.round(performance.now()-t0),decides,openPlay,decisions,hashes};
}

/** Frame selection: strata = (carrier's side is the Direct side) x third; up to `perStratum` each, at least `gap` s
 * apart, never within `edge` s of kick-off or full time, at most `cap` in all. Deterministic from (arm, seed). */
export function select(arm:string,seed:number,decisions:Decision[],o:{perStratum:number;gap:number;edge:number;duration:number;cap?:number}){
 const direct=seed%2;// mirror.ts: treated side = seed % 2, and every arm here treats the Direct side
 const rnd=(k:string)=>parseInt(createHash('sha1').update(`${arm}:${seed}:${k}`).digest('hex').slice(0,8),16);
 const pool=decisions.filter(d=>d.time>=o.edge&&d.time<=o.duration-o.edge).map(d=>({d,key:rnd(`${d.tick}:${d.id}`)})).sort((a,b)=>a.key-b.key);
 const count=new Map<string,number>(),chosen:Decision[]=[];
 for(const {d} of pool){
  if(chosen.length>=(o.cap??Infinity))break;// in the random order, so a cap never favours early frames
  const st=`${d.side===direct?'dir':'oth'}-${d.depth<16?1:d.depth<32?2:3}`;
  if((count.get(st)??0)>=o.perStratum)continue;
  if(chosen.some(c=>Math.abs(c.time-d.time)<o.gap))continue;
  count.set(st,(count.get(st)??0)+1);chosen.push(d);
 }
 return chosen.sort((a,b)=>a.tick-b.tick);
}

export interface Outcome {ch:[number,number];g:[number,number];sh:[number,number];poss:number;chPoss:number;first?:[string,number,string?];unread:number}
/** Pass B: rollouts at each frame. arms: forced class bests (by option index) + 'engine'. */
export function passB(arm:string,seed:number,frames:Decision[],o:{N:number;H:number;full?:boolean;repeat?:boolean;band?:number}){
 const band=o.band??BAND,STOP={stop:true};
 const queue=[...frames],rows:any[]=[],checks={crossRunMismatch:0,crossRunChecked:0,rewindMismatch:0,forcedMissing:0,repeatMismatch:0,restores:0,snapMs:0,restoreMs:0};
 let state:'idle'|'roll'='idle',S:Snap|null=null,fr:Decision|null=null,arms:{name:string;cls?:Cls;i?:number;score?:number;raw?:number}[]=[],jobs:{arm:number;s:number}[]=[],ji=0;
 let ply:any[]=[],snapHash="",plan:any=null,probs:{arm:Record<string,number>;cls:Record<string,number>}|null=null,out:Outcome|null=null,evFrom=0,T0=0,carrierSide=0,carrier='',forcedSeen=false,results:Outcome[][]=[],repeatOf:Outcome|null=null;
 const H=o.H;
 const startJob=()=>{out={ch:[0,0],g:[0,0],sh:[0,0],poss:Infinity,chPoss:0,unread:0};forcedSeen=false;};
 const scan=(v:any)=>{
  const ev=v.events;
  for(let k=evFrom;k<ev.length;k++){const e=ev[k];
   if(!out!.first&&e.actor===carrier&&['pass','shot','clearance','feint'].includes(e.kind))out!.first=[e.kind,Math.round((e.time-T0)*100)/100,...(e.target?[e.target]:[])] as any;
   if(e.kind==='shot'){const s=e.side===carrierSide?0:1;out!.sh[s]++;
    const q=e.shot?.assessment?.quality;let c:number|null=null;
    if(typeof q==='number'&&Number.isFinite(q))c=rateOf(Math.round(q*1000)/1000);else if(e.technique==='header')c=CHANCE_TABLE.kinds[1];else if(e.technique==='volley')c=CHANCE_TABLE.kinds[2];else if(e.freeKick)c=CHANCE_TABLE.kinds[3];
    if(c===null){out!.unread++;c=0;}
    out!.ch[s]+=c;if(s===0&&e.time<out!.poss)out!.chPoss+=c;}
   if(e.kind==='goal'){out!.g[e.side===carrierSide?0:1]++;}
  }
  evFrom=ev.length;
  if(out!.poss===Infinity&&v.side!==carrierSide)out!.poss=Math.round((v.time-T0)*100)/100;
 };
 (globalThis as any).__oc={
  top(tick:number,get:()=>any,set:(v:any)=>void,names:string[]){
   if(state==='idle'){
    if(!queue.length){if(!o.full)throw STOP;return;}
    if(tick<queue[0].tick)return;
    if(tick>queue[0].tick)throw Error(`frame tick ${queue[0].tick} missed`);
    fr=queue.shift()!;const v=get();ply=v.players;
    const h0=stateHash(v);snapHash=h0;if(fr.hash){checks.crossRunChecked++;if(h0!==fr.hash)checks.crossRunMismatch++;}
    const t0=performance.now();S=snapshot(get(),names);checks.snapMs+=performance.now()-t0;
    // arms: every class best within the band of the top, the top first; then the unforced engine
    const bests=Object.entries(fr.cls).filter(([c,b])=>c===fr!.topCls||b!.score>=fr!.top-band)
     .sort((a,b)=>(a[0]===fr!.topCls?-1:b[0]===fr!.topCls?1:b[1]!.score-a[1]!.score));
    arms=[...bests.map(([c,b])=>({name:c,cls:c as Cls,i:b!.i,score:b!.score,raw:b!.raw})),{name:'engine'}];
    jobs=[];for(let s=0;s<o.N;s++)for(let a=0;a<arms.length;a++)jobs.push({arm:a,s});
    if(o.repeat)jobs.splice(1,0,{...jobs[0]});// the first rollout played twice: must be identical
    results=arms.map(()=>[]);ji=0;T0=v.time;plan=v.carryPlan;probs=null;carrierSide=fr.side;carrier=fr.id;evFrom=v.events.length;
    state='roll';startJob();return;
   }
   const v=get();scan(v);
   if(v.time<T0+H-1e-9)return;
   // rollout finished
   const job=jobs[ji];if(!forcedSeen)checks.forcedMissing++;
   if(o.repeat&&ji===1){if(JSON.stringify(out)!==JSON.stringify(repeatOf))checks.repeatMismatch++;}
   else{results[job.arm].push(out!);if(o.repeat&&ji===0)repeatOf=out;}
   ji++;const t1=performance.now();restore(S!,set);checks.restoreMs+=performance.now()-t1;checks.restores++;
   const v2=get();evFrom=v2.events.length;if(stateHash(v2)!==snapHash)checks.rewindMismatch++;
   if(ji<jobs.length){startJob();return;}
   // frame done: the match carries on from the frame untouched
   rows.push({...frameRow(arm,seed,fr!,arms,results),probs});
   state='idle';S=null;fr=null;
   if(!queue.length&&!o.full)throw STOP;
  },
  decide(p:any,time:number,tick:number,available:any[]){
   if(state!=='roll'||tick!==fr!.tick||p.id!==fr!.id)return undefined;
   forcedSeen=true;const job=jobs[ji],a=arms[job.arm];
   if(!probs){// the engine's own choice probabilities here (authoritative; pass A's are the same arithmetic)
    const pr=choice(available,plan,time).p,cls:Record<string,number>={},players=ply;
    available.forEach((op,i)=>{const c=classify(p,players,op);cls[c]=(cls[c]??0)+pr[i];});
    probs={arm:Object.fromEntries(arms.filter(x=>x.i!==undefined).map(x=>[x.name,pr[x.i!]])),cls};}
   reseed(S!,fr!.tick*2654435761>>>0,job.s);
   if(a.name==='engine')return undefined;
   const opt=available[a.i!];
   if(!opt||opt.score!==a.raw)throw Error(`forced option ${a.name} not reproduced at tick ${tick}`);
   return [opt];
  },
 };
 const t0=performance.now();let r:any=null,stopped=false;
 try{r=computeMatch(inputOf(arm,seed));}catch(e){if(e===STOP)stopped=true;else throw e;}finally{(globalThis as any).__oc=undefined;}
 if(state!=='idle'||queue.length)throw Error('match ended with frames pending');
 return {rows,checks:{...checks,snapMs:Math.round(checks.snapMs),restoreMs:Math.round(checks.restoreMs)},stopped,hash:r?sha(r.compact):null,score:r?.compact.score??null,ms:Math.round(performance.now()-t0)};
}
function frameRow(arm:string,seed:number,fr:Decision,arms:{name:string;cls?:Cls;score?:number}[],results:Outcome[][]){
 return {arm,seed,tick:fr.tick,time:Math.round(fr.time*100)/100,id:fr.id,side:fr.side,direct:fr.side===seed%2,depth:Math.round(fr.depth*10)/10,
  top:fr.top,topCls:fr.topCls,viableCls:fr.viableCls,n:fr.n,cls:fr.cls,
  arms:arms.map((a,k)=>({name:a.name,...(a.score!==undefined?{score:a.score,raw:(a as any).raw}:{}),r:results[k].map(x=>[x.ch[0],x.ch[1],x.g[0],x.g[1],x.sh[0],x.sh[1],x.poss===Infinity?null:x.poss,x.chPoss,x.first??null,x.unread])})),
  build:ENGINE_BUILD.slice(0,8),plat:plat()};
}
