// Player match-states, "injured, playing on" (1 Nov 2026): one PAIRED match row. Evidence only. Played through
// ../2026-10-21-engine-as-data/run.mjs (--entry ../2026-11-01-player-states/row.ts --set
// ../2026-11-01-showcase-strength/set.mjs), both builds in one run (--revs base=<fb6b574f's commit>,cand=working), so each
// task is the same match on both: base = he plays on at full ability (fb6b574f), cand = he plays on injured.
//
// The match is the strength study's (the real freezer's Bebe nine at home against one guest side, through
// lib/ballers/simulation computeMatch, the injuries key with the freezer's salt and both sides' ages), with the test's
// dice deciding who is hurt and when, so every task has a man playing on (a natural one is rare: 0 in the 98 matches of
// 2026-11-01-forced-change-cap):
//  - one side (from the task id's hash) makes its three changes at half-time (its own three orders, their trigger set to
//    'half', the same men in and out), so it has no change left after it;
//  - at T (520-619 s, from the hash) one of its men on the pitch is worn out: its keeper (one task in five), or its
//    first, second or third outfielder in the engine's order (from the hash); nobody else is ever hurt (the natural dice
//    never land);
//  - he is treated at the stoppage and plays on.
// The row keeps, from the compact replay, his legs and his part in the play from the moment he gets up (treatment + 12 s,
// the engine's rule on both builds) to full time, the same for the other men of the match, both sides' goals and shots
// after it, and a fingerprint of every 5 s window of frames and events, so the analysis can find where the two builds part.
// HOBBLE_DUMP=<dir> (laptop traces only) also writes each build's compact replay there for render.ts.
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {computeMatch,validateInput} from '../../../../lib/ballers/simulation';
import {ENGINE_BUILD} from '../../src/index';
import {Injuries} from '../../src/practice-injuries';
import data from '../2026-11-01-showcase-strength/nines.json';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}
const fnv=(s:string,h=2166136261)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const ID=[0,1,2,3,4,5,6,7,8,9],WINDOW=5000,UP=12000,GOAL=[48,0];
/** The forcing, from the task id: which side, whose legs (0 keeper, 1-3 the k-th outfielder on the pitch), when (s). */
/** (a keeper one task in five; over the strength set's 49 tasks: 13 keepers, 36 outfielders, Bebe's side 19 times) */
export function forcing(id:string){const h=fnv(id+'#hobble');return {side:((h>>>4)&1) as 0|1,slot:(h>>>8)%5===0?0:(h>>>12)%3+1,at:520+(h>>>16)%100};}

export function play(task:any){
 const D=data as any,nine=D.nines.find((n:any)=>n.id===task.nine),guest=D.guests[task.guest];
 if(!nine||!guest)throw Error(`unknown nine/guest ${task.nine}/${task.guest}`);
 const force=forcing(task.id);
 // the hurt side's three orders, made at half-time (out: the man the order names; a "tired" order's own man)
 const halfOrders=(side:any)=>({...side,substitutions:(side.substitutions??[]).map((o:any)=>({id:o.id,in:o.in,out:o.out??o.trigger?.player,trigger:{kind:'half'}}))});
 const sides=[nine.side,guest.side].map((s,i)=>i===force.side?halfOrders(s):s);
 const input={v:1,match:`hobble-${task.id}`,seed:task.seed,kickoff:task.seed%2,duration:900,sides,
  injuries:{on:true,salt:Number((BigInt(task.seed)*2654435761n)%4294967296n),age:[nine.ages,guest.ages]}};
 const inp=validateInput(input);
 // the test's dice (this bundle's Injuries, set per task): nobody hurt by chance; the forced man at `at`
 const I=Injuries.prototype as any;
 I.roll=()=>false;
 I.fatigue=function(p:any,time:number){
  if(this.records.length||time<force.at||p.side!==force.side)return;
  if(this.__t!==time){this.__t=time;this.__n=0;}
  if(force.slot===0){if(p.role==='GK')this.injure(p,'fatigue',time,false);return;}
  if(p.role==='GK')return;
  if(++this.__n===force.slot)this.injure(p,'fatigue',time,false);
 };
 const t0=Date.now(),c0=process.cpuUsage();
 const c:any=DRY?null:computeMatch(inp);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0);
 let extra:any=null,print=[0,0,0],full='';
 if(c){
  const s=JSON.stringify(c.compact);print=[s.length,fnv(s),fnv(s,0x9747b28c)];full=fnv(s+JSON.stringify(c.injuries??[])).toString(16);
  if(process.env.HOBBLE_DUMP){mkdirSync(process.env.HOBBLE_DUMP,{recursive:true});writeFileSync(path.join(process.env.HOBBLE_DUMP,`${task.id.replace(/\W+/g,'_')}.${ENGINE_BUILD.slice(0,8)}.json`),JSON.stringify({task,force,compact:c.compact,injuries:c.injuries}));}
  extra=read(c,task,force);
 }
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:c?.compact.score??[0,0],print,full,build:ENGINE_BUILD.slice(0,8),runs:1,frames:0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:c?.dropped??[],tactics:null,variety:null,extra};
}

/** What the analysis reads (README "the row"). Times in ms, distances in m, speeds in m/s. */
export function read(c:any,task:any,force:any){
 const H=c.compact.header,P=H.players as any[],frames=c.compact.chunks.flatMap((ch:any)=>ch.f) as any[],ev=c.compact.chunks.flatMap((ch:any)=>ch.e) as any[];
 const inj=(c.injuries??[])[0];if(!inj)return {task:task.id,force,none:1};
 const me=P.findIndex(p=>p.id===inj.id),tr=ev.find(e=>e.k==='treatment'&&e.a===me),up=tr?tr.t+UP:null;
 const state=ev.filter(e=>e.k==='state').map(e=>({t:e.t,a:e.a,st:e.st}));
 const end=frames.at(-1).t;
 // per player index: the legs from `from` to full time, in live play (no restart frame), from 1 s displacements
 const legs=(who:number,from:number)=>{
  const at=(f:any)=>{const pos=(f.l??ID).indexOf(who);return pos<0?null:f.p[pos];};
  const speeds:number[]=[];let dist=0,live=0;
  for(let i=0;i<frames.length;i++){
   const f=frames[i];if(f.t<from||f.r)continue;const a=at(f);if(!a)continue;
   let j=i+1;while(j<frames.length&&frames[j].t<f.t+1000&&!frames[j].c&&!frames[j].r)j++;
   const g=frames[j];if(!g||g.c||g.r||g.t-f.t<900||g.t-f.t>1300)continue;const b=at(g);if(!b)continue;
   speeds.push(Math.hypot(b[0]-a[0],b[1]-a[1])/100/((g.t-f.t)/1000));
  }
  for(let i=1;i<frames.length;i++){const f=frames[i],e=frames[i-1];if(f.t<from||f.r||f.c||e.r)continue;const a=at(e),b=at(f);if(!a||!b)continue;dist+=Math.hypot(b[0]-a[0],b[1]-a[1])/100;live+=(f.t-e.t)/1000;}
  const q=[...speeds].sort((x,y)=>x-y),pct=(p:number)=>q.length?+q[Math.min(q.length-1,Math.floor(p*q.length))].toFixed(2):0;
  return {live:+live.toFixed(1),dist:+dist.toFixed(1),mean:live?+(dist/live).toFixed(2):0,p50:pct(.5),p90:pct(.9),max:q.length?+q.at(-1)!.toFixed(2):0,fast:speeds.filter(v=>v>=4.5).length,n:speeds.length};
 };
 // his part in the play after `up`: events he is the actor (a) or the second man (g) of, by kind; his shots' distances
 const after=(e:any)=>up!==null&&e.t>=up;
 const by=(who:number,key:'a'|'g')=>{const out:Record<string,number>={};for(const e of ev)if(after(e)&&e[key]===who)out[e.k]=(out[e.k]??0)+1;return out;};
 const side=inj.side,goal=(s:number)=>s===0?GOAL:[0,0];
 const shots=ev.filter(e=>after(e)&&e.k==='shot'&&e.a===me&&e.sh).map(e=>+(Math.hypot(e.sh.o[0]/100-goal(side)[0],e.sh.o[1]/100-goal(side)[1])).toFixed(1));
 // passes he made after `up` that the next touch (an off-ball event skipped) found a team-mate with
 const OFF=new Set(['substitution','half','start','injury','stoppage','treatment','state']);
 let passes=0,found=0;
 ev.forEach((e,i)=>{if(!after(e)||e.k!=='pass'||e.a!==me)return;passes++;const n=ev.slice(i+1).find(x=>!OFF.has(x.k));if(n?.k==='receive'&&n.a!==undefined&&P[n.a]?.side===side&&n.a!==me)found++;});
 // the match after `up`: goals (from the frames' score) and shots, by side
 const sAt=(t:number)=>{let s=[0,0];for(const f of frames){if(f.t>t)break;s=f.s;}return s;};
 const s0=up!==null?sAt(up):[0,0],s1=c.compact.score;
 const teamShots=[0,1].map(sd=>ev.filter(e=>after(e)&&e.k==='shot'&&e.s===sd).length);
 // every other man on the pitch after `up` (his team-mates and opponents): legs, for the analysis's comparison
 const others=up===null?[]:[...new Set(frames.filter(f=>f.t>=up).flatMap((f:any)=>f.l??ID))].filter((i:any)=>i!==me).map((i:any)=>({i,s:P[i].side,gk:P[i].slot===0||P[i].role==='GK',...legs(i,up)}));
 // fingerprints: frames and events per 5 s window (where the builds part)
 const win:number[]=[];for(let w=0;w*WINDOW<=end;w++){const lo=w*WINDOW,hi=lo+WINDOW;win.push(fnv(JSON.stringify(frames.filter(f=>f.t>=lo&&f.t<hi))+JSON.stringify(ev.filter(e=>e.t>=lo&&e.t<hi))));}
 return {task:task.id,nine:task.nine,guest:task.guest,seed:task.seed,force,score:s1,
  hurt:{i:me,side,role:P[me].role,gk:P[me].slot===0||P[me].role==='GK',name:P[me].name,t:Math.round(inj.t*1000),cause:inj.cause,playedOn:!!inj.played_on,off:inj.off,treat:tr?.t??null,up},
  state,changes:[0,1].map(sd=>ev.filter(e=>e.k==='substitution'&&e.a!==undefined&&P[e.a]?.side===sd).length),
  // his legs in the four minutes before the knock, and from the moment he gets up
  beforeLegs:legsBetween(frames,me,Math.max(0,Math.round(inj.t*1000)-240000),Math.round(inj.t*1000)),
  legs:up===null?null:legs(me,up),acted:by(me,'a'),second:by(me,'g'),shots,passes,found,
  after:{goals:[s1[0]-s0[0],s1[1]-s0[1]],shots:teamShots,secs:up===null?0:Math.round((end-up)/1000)},others,win};
}
/** His legs over [from, to) in live play: the same reading as legs(), for the minutes before the knock. */
function legsBetween(frames:any[],who:number,from:number,to:number){
 const at=(f:any)=>{const pos=(f.l??ID).indexOf(who);return pos<0?null:f.p[pos];};
 const speeds:number[]=[];let dist=0,live=0;
 for(let i=0;i<frames.length;i++){
  const f=frames[i];if(f.t<from||f.t>=to||f.r)continue;const a=at(f);if(!a)continue;
  let j=i+1;while(j<frames.length&&frames[j].t<f.t+1000&&!frames[j].c&&!frames[j].r)j++;
  const g=frames[j];if(!g||g.c||g.r||g.t-f.t<900||g.t-f.t>1300||g.t>=to)continue;const b=at(g);if(!b)continue;
  speeds.push(Math.hypot(b[0]-a[0],b[1]-a[1])/100/((g.t-f.t)/1000));
 }
 for(let i=1;i<frames.length;i++){const f=frames[i],e=frames[i-1];if(f.t<from||f.t>=to||f.r||f.c||e.r)continue;const a=at(e),b=at(f);if(!a||!b)continue;dist+=Math.hypot(b[0]-a[0],b[1]-a[1])/100;live+=(f.t-e.t)/1000;}
 const q=[...speeds].sort((x,y)=>x-y),pct=(p:number)=>q.length?+q[Math.min(q.length-1,Math.floor(p*q.length))].toFixed(2):0;
 return {live:+live.toFixed(1),dist:+dist.toFixed(1),mean:live?+(dist/live).toFixed(2):0,p50:pct(.5),p90:pct(.9),max:q.length?+q.at(-1)!.toFixed(2):0,fast:speeds.filter(v=>v>=4.5).length,n:speeds.length};
}
