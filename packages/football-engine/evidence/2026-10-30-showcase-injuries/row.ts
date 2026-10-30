// Bebe's showcase, Track E (30 Oct 2026): one injury-tuning task on one engine revision. Evidence only. Played through
// ../2026-10-21-engine-as-data/run.mjs (--entry ../2026-10-30-showcase-injuries/row.ts --set
// ../2026-10-30-showcase-injuries/set.mjs), so the lab flow, sharding and bundling are the parity harness's.
//
// A task: F.C. Bebe Power against one guest profile (sides.ts), 900 s, computeMatch's runMatch call (engineTeam and
// sideOrders from lib/ballers/compute, no plans) plus the injuries key with both sides' ages.
// The row's `extra`: the score (Bebe first), every injury, and the EXPOSURE: the sum of the risks every roll carried,
// per side and cause (tackle split by hard / not), and the contacts behind them. Read-only wrappers on the injury
// state (Injuries.prototype.roll / contact) record what the engine already computed; they draw nothing and change
// nothing. Exposure is what tunes the rate (expected injuries are linear in TACKLE_RISK and FATIGUE_RISK); the
// realised injuries confirm it.
import {runMatch,createSimulationRequest,ENGINE_BUILD} from '../../src/index';
import {Injuries,TIRED_TACKLE,HIT_REF,FATIGUE_FROM,FATIGUE_SPAN} from '../../src/practice-injuries';
import {engineTeam,sideOrders} from '../../../../lib/ballers/compute';
import {bebeSide,guestSide} from './sides';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}

// Exposure per side, each part per unit of its constant (practice-injuries.ts), so expected injuries are
// TACKLE_RISK x tb + TACKLE_HIT x th + TACKLE_HARD x tk (below the cap) and FATIGUE_RISK x fu: tb = the challenges'
// multipliers (tired x age), th = the same x hit / HIT_REF, tk = the same for hard ones (floored or a foul); t / f = the
// risk the run's constants gave, hard = the part of t from hard tackles, nt / nf the rolls.
type Exp={t:number;tb:number;th:number;tk:number;hard:number;f:number;fu:number;nt:number;nf:number};type Con={n:number;hard:number;fouls:number;hit:number};
let EXP:[Exp,Exp],CON:[Con,Con];
const zero=():Exp=>({t:0,tb:0,th:0,tk:0,hard:0,f:0,fu:0,nt:0,nf:0});
const blank=()=>{EXP=[zero(),zero()];CON=[{n:0,hard:0,fouls:0,hit:0},{n:0,hard:0,fouls:0,hit:0}];};blank();
const proto=Injuries.prototype as any,roll=proto.roll,contact=proto.contact,fatigue=proto.fatigue;
proto.contact=function(p:any,b:any,by:any,time:number,foul=false){
 const c=CON[p.side as 0|1],hard=b.down>0||foul;c.n++;if(hard)c.hard++;if(foul)c.fouls++;c.hit+=Math.max(0,b.hit);
 if(!this.hurt.has(p.id)){const e=EXP[p.side as 0|1],m=(1+TIRED_TACKLE*(1-Math.max(0,Math.min(100,p.energy))/100))*this.ageFactor(p.id);
  e.tb+=m;e.th+=m*Math.max(0,b.hit)/HIT_REF;if(hard)e.tk+=m;this.__hard=hard;}
 return contact.call(this,p,b,by,time,foul);
};
proto.fatigue=function(p:any,time:number){
 if(!this.hurt.has(p.id)){const u=(FATIGUE_FROM-p.energy)/FATIGUE_SPAN;if(u>0)EXP[p.side as 0|1].fu+=u*u*this.ageFactor(p.id);}
 return fatigue.call(this,p,time);
};
proto.roll=function(cause:string,side:0|1,risk:number){
 const e=EXP[side];if(cause==='tackle'){e.t+=risk;e.nt++;if(this.__hard)e.hard+=risk;}else{e.f+=risk;e.nf++;}
 return roll.call(this,cause,side,risk);
};
const r4=(n:number)=>Math.round(n*1e4)/1e4;

export function play(task:any){
 blank();
 const bebe=bebeSide(),guest=guestSide(task.profile),home=task.home as boolean;
 const sides=home?[bebe.side,guest.side]:[guest.side,bebe.side],ages=home?[bebe.ages,guest.ages]:[guest.ages,bebe.ages];
 const input={v:1,match:task.id,seed:task.seed,kickoff:task.kickoff,duration:900,sides} as any;
 const teams=input.sides.map((s:any)=>engineTeam(s)) as any,subs=sideOrders(input,teams);
 const t0=Date.now(),c0=process.cpuUsage();
 const call={fixture:{teams,seed:task.seed,kickoff:task.kickoff},durationSeconds:900,policy:'coordinated' as const,substitutions:'none' as const,record:true,
  ...(subs.orders.length?{substitutionOrders:subs.orders}:{}),injuries:{on:true,salt:task.salt,age:ages as any}};
 if(DRY)createSimulationRequest({kind:'match',...call});
 const run=DRY?null:runMatch(call);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0),r:any=run?.result;
 const B=home?0:1,G=1-B,who=(s:number)=>s===B?'B':'G';
 const extra=r?{profile:task.profile,bebe:B,score:[r.score[B],r.score[G]],played:r.played??r.duration,
  inj:r.injuries.map((i:any)=>({s:who(i.side),p:i.player.slice(2),c:i.cause,h:i.hard?1:0,m:i.matches,t:Math.round(i.time),e:i.energy,...(i.off!==undefined?{off:Math.round(i.off)}:{}),...(i.playedOn?{po:1}:{}),...(i.replacement?{in:i.replacement.slice(2)}:{})})),
  exp:{B:Object.fromEntries(Object.entries(EXP[B]).map(([k,v])=>[k,r4(v)])),G:Object.fromEntries(Object.entries(EXP[G]).map(([k,v])=>[k,r4(v)]))},
  con:{B:{...CON[B],hit:r4(CON[B].hit)},G:{...CON[G],hit:r4(CON[G].hit)}},
  subs:{B:r.events.filter((e:any)=>e.kind==='substitution'&&e.side===B&&e.substitution).length,G:r.events.filter((e:any)=>e.kind==='substitution'&&e.side===G&&e.substitution).length},
  forced:{B:r.events.filter((e:any)=>e.kind==='substitution'&&e.side===B&&e.injury).length,G:r.events.filter((e:any)=>e.kind==='substitution'&&e.side===G&&e.injury).length},
  tackles:[r.stats[B].tackles,r.stats[G].tackles],fouls:[r.stats[B].fouls,r.stats[G].fouls]}:null;
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:r?.score??[0,0],print:[0,0,0],full:'',build:ENGINE_BUILD.slice(0,8),runs:1,frames:r?.frames.length??0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:subs.dropped,tactics:null,variety:null,extra};
}
