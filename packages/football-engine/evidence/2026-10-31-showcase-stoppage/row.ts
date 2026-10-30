// Bebe's showcase, the injury stoppage (31 Oct 2026): one rate-read task. Evidence only. Played through
// ../2026-10-21-engine-as-data/run.mjs (--entry ../2026-10-31-showcase-stoppage/row.ts --set
// ../2026-10-30-showcase-injuries/set.mjs), exactly as ../2026-10-30-showcase-injuries/row.ts plays it (F.C. Bebe Power
// against one guest profile, 900 s, computeMatch's runMatch call plus the injuries key with both sides' ages), with
// that row's read-only exposure wrappers (they draw nothing), plus what the stoppage did with each injury: who stopped
// play (the referee, or a dead ball of its own), the advantage, the dead time to the restart and its kind, the dropped
// ball's taker, and goals soon after a dropped ball.
import {runMatch,ENGINE_BUILD} from '../../src/index';
import {Injuries,TIRED_TACKLE,HIT_REF,FATIGUE_FROM,FATIGUE_SPAN} from '../../src/practice-injuries';
import {engineTeam,sideOrders} from '../../../../lib/ballers/compute';
import {bebeSide,guestSide} from '../2026-10-30-showcase-injuries/sides';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}
type Exp={t:number;tb:number;th:number;tk:number;f:number;fu:number};
let EXP:[Exp,Exp];
const zero=():Exp=>({t:0,tb:0,th:0,tk:0,f:0,fu:0});
const proto=Injuries.prototype as any,roll=proto.roll,contact=proto.contact,fatigue=proto.fatigue;
proto.contact=function(p:any,b:any,by:any,time:number,foul=false){
 const hard=b.down>0||foul;
 if(!this.hurt.has(p.id)){const e=EXP[p.side as 0|1],m=(1+TIRED_TACKLE*(1-Math.max(0,Math.min(100,p.energy))/100))*this.ageFactor(p.id);
  e.tb+=m;e.th+=m*Math.max(0,b.hit)/HIT_REF;if(hard)e.tk+=m;}
 return contact.call(this,p,b,by,time,foul);
};
proto.fatigue=function(p:any,time:number){
 if(!this.hurt.has(p.id)){const u=(FATIGUE_FROM-p.energy)/FATIGUE_SPAN;if(u>0)EXP[p.side as 0|1].fu+=u*u*this.ageFactor(p.id);}
 return fatigue.call(this,p,time);
};
proto.roll=function(cause:string,side:0|1,risk:number){const e=EXP[side];if(cause==='tackle')e.t+=risk;else e.f+=risk;return roll.call(this,cause,side,risk);};
const r4=(n:number)=>Math.round(n*1e4)/1e4,r2=(n:number)=>Math.round(n*100)/100;

export function play(task:any){
 EXP=[zero(),zero()];
 const bebe=bebeSide(),guest=guestSide(task.profile),home=task.home as boolean;
 const sides=home?[bebe.side,guest.side]:[guest.side,bebe.side],ages=home?[bebe.ages,guest.ages]:[guest.ages,bebe.ages];
 const input={v:1,match:task.id,seed:task.seed,kickoff:task.kickoff,duration:900,sides} as any;
 const teams=input.sides.map((s:any)=>engineTeam(s)) as any,subs=sideOrders(input,teams);
 const t0=Date.now(),c0=process.cpuUsage();
 const call={fixture:{teams,seed:task.seed,kickoff:task.kickoff},durationSeconds:900,policy:'coordinated' as const,substitutions:'none' as const,record:true,
  ...(subs.orders.length?{substitutionOrders:subs.orders}:{}),injuries:{on:true,salt:task.salt,age:ages as any}};
 const run=DRY?null:runMatch(call);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0),r:any=run?.result;
 const B=home?0:1,G=1-B,who=(s:number)=>s===B?'B':'G';
 let extra:any=null;
 if(r){
  const ev=r.events as any[],kicks=ev.filter(e=>e.restartKind),side=(id:string)=>+id[0];
  const inj=r.injuries.map((i:any)=>{
   const base={s:who(i.side),p:i.player.slice(2),c:i.cause,h:i.hard?1:0,m:i.matches,t:r2(i.time),e:i.energy,...(i.playedOn?{po:1}:{}),...(i.replacement?{in:i.replacement.slice(2)}:{})};
   // the stoppage he went off (or was treated) at: the treatment event for him
   const tr=ev.find(e=>e.kind==='treatment'&&e.actor===i.player);
   if(!tr)return {...base,st:'none'};
   const at=ev.filter(e=>Math.abs(e.time-tr.time)<1e-9),ref=at.some(e=>e.kind==='stoppage');
   const cause=[...ev.filter(e=>e.time<=tr.time+1e-9&&['goal','out','foul','offside','half','stoppage'].includes(e.kind))].pop();
   const kick=kicks.find(e=>e.time>tr.time+1e-9);
   return {...base,st:ref?'ref':`dead:${cause?.kind??'?'}`,adv:r2(tr.time-i.time),...(kick?{dead:r2(kick.time-tr.time),rk:kick.restartKind,tk:who(side(kick.actor)),gk:r.players.find((p:any)=>p.id===kick.actor)?.role==='GK'?1:0}:{})};
  });
  // dropped balls and goals soon after them (12 s), by the side the ball was dropped for or the other
  const drops=kicks.filter(e=>e.restartKind==='dropBall').map(k=>{const g=ev.filter(e=>e.kind==='goal'&&e.time>k.time&&e.time<=k.time+12);return {t:r2(k.time),to:who(side(k.actor)),gk:r.players.find((p:any)=>p.id===k.actor)?.role==='GK'?1:0,gf:g.filter(e=>e.side===side(k.actor)).length,ga:g.filter(e=>e.side!==side(k.actor)).length};});
  extra={profile:task.profile,bebe:B,score:[r.score[B],r.score[G]],played:r.played??r.duration,inj,drops,
   stops:ev.filter(e=>e.kind==='stoppage').length,
   exp:{B:Object.fromEntries(Object.entries(EXP[B]).map(([k,v])=>[k,r4(v)])),G:Object.fromEntries(Object.entries(EXP[G]).map(([k,v])=>[k,r4(v)]))},
   shots:[r.stats[B].shots,r.stats[G].shots],tackles:[r.stats[B].tackles,r.stats[G].tackles],fouls:[r.stats[B].fouls,r.stats[G].fouls]};
 }
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:r?.score??[0,0],print:[0,0,0],full:'',build:ENGINE_BUILD.slice(0,8),runs:1,frames:r?.frames.length??0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:subs.dropped,tactics:null,variety:null,extra};
}
