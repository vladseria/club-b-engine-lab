// Tiredness calibration (2026-11-02, branch ballers-tiredness-calibration, measurement only): the row entry. Every
// match is parity.ts play (../2026-10-21-engine-as-data/parity.ts: computeMatch's runMatch call and the fingerprints),
// with the half-time study's extra unchanged (../2026-10-21-half-time/row.ts: the what-if match anatomy and the per-half
// read, so block N rows read like the stored block R rows they pair with), plus:
//  - more sides for parity.ts (setSides):
//      {src:'g7x', code, ai?, noOrders?, fuse?, energies?}  a Global round-7 side as frozen (parity.ts's 'g7'), then:
//          ai: the planned AI orders (aiOrders, the twin of private.ballers_showcase_subs); noOrders: no orders at all;
//          fuse: every man not already a Short fuse made one (frustration 1, discipline - 0.25, floored at 0);
//          energies: squad id -> his starting energy (the input `energy`; everyone else as frozen, 100)
//      {src:'onetired', code, style, formation, energy, man}  parity.ts's neutral five, squad slot `man` starting at energy
//      {src:'nine', nine} / {src:'guest', guest}  the showcase sides of nines-v2.json with the half-time orders rewrite
//          (../2026-11-01-showcase-subs/orders.ts), exactly the subs study's 'new' input
//  - the opt-in injuries key for a task that names one (parity.ts setCall): {on, salt, scale?, strength?, age}, the age
//    maps per side by squad id (showcase: the nine's and the guest side's; league: the ages known from the 29 Oct snapshot
//    in nines-v2.json, the others none);
//  - extra.tc: per player of both sides (squad order, bench included): role, stamina, strength, age factor, start and end
//    energy, seconds on the pitch, whether he played the whole match, the ENERGY SPENT (the sum of every fall of his energy
//    between frames: the half-time +6 is a rise and never counts; the first half's part separately) and his injury
//    EXPOSURE (read-only wrappers on Injuries.prototype, as ../2026-10-30-showcase-injuries/row.ts: they draw nothing):
//    per unit of each constant, before age, strength and scale, so the expected injuries of any setting are
//    age x [strength x (TACKLE_RISK tb + TACKLE_HIT th + TACKLE_HARD tk) + FATIGUE_RISK fu] x scale; rk = the risks the
//    run's rolls actually carried (the check). Plus every injury, fouls and tackles, changes made, and for showcase rows
//    the fields of the subs study's rows (score, changes, injuries by slot) to compare with them.
import {setSides,setCall,setExtra,sideOf} from '../2026-10-21-engine-as-data/parity';
import {anatomy} from '../2026-10-22-whatif/row';
import {halves} from '../2026-10-21-half-time/row';
import {Injuries,TIRED_TACKLE,HIT_REF,FATIGUE_FROM,FATIGUE_SPAN} from '../../src/practice-injuries';
import data from '../2026-11-01-showcase-strength/nines-v2.json';
import {halfTimeOrders} from '../2026-11-01-showcase-subs/orders';
export * from '../2026-10-21-half-time/row';

const D=data as any;
/** Squad id -> age, every nine of the 29 Oct snapshot (real Global players). */
const AGES:Record<string,number>=Object.fromEntries(D.nines.flatMap((n:any)=>Object.entries(n.ages)));
const clone=(x:any)=>JSON.parse(JSON.stringify(x));

// ------------------------------------------------------------------ sides
/** The twin of private.ballers_showcase_subs (supabase/migrations/20261031090000_ballers_showcase.sql): the first three
 * bench outfielders (bench order) for the outfield starters (lineup after the first) with the least stamina (ties by
 * lineup order); the first two "tired" 95 not before 450 s, the third if losing, not before 720 s. */
export function aiOrders(side:any,prefix:string){
 const P=new Map(side.players.map((p:any)=>[p.id,p]));
 const bench=side.bench.filter((id:string)=>!(P.get(id) as any).roles.includes('GK'));
 const starters=side.lineup.map((id:string,i:number)=>({id,n:i+1,st:(P.get(id) as any).skills?.stamina??5})).filter((s:any)=>s.n>1)
  .sort((a:any,b:any)=>a.st-b.st||a.n-b.n);
 const out:any[]=[];
 for(let k=1;k<=3&&k<=bench.length&&k<=starters.length;k++){
  const inn=bench[k-1],o=starters[k-1].id;
  out.push(k<3?{id:prefix+k,in:inn,out:o,trigger:{kind:'tired',player:o,threshold:95},notBefore:450}
   :{id:prefix+k,in:inn,out:o,trigger:{kind:'score',state:'losing'},notBefore:720});
 }
 return out;
}
function g7x(spec:any){
 const b=sideOf({src:'g7',code:spec.code});
 if(!(b.players.find((p:any)=>p.id===b.lineup[0])?.roles??[]).includes('GK'))throw Error(`${spec.code}: lineup[0] is not a keeper`);
 if(spec.noOrders)delete b.substitutions;
 else if(spec.ai){if((b.substitutions??[]).length)throw Error(`${spec.code}: an AI side with orders`);b.substitutions=aiOrders(b,`ai-${spec.code}-`);}
 if(spec.fuse)for(const p of b.players)if((p.traits.frustration??0)<.7)p.traits={...p.traits,discipline:Math.max(0,Math.round((p.traits.discipline-.25)*1000)/1000),frustration:1};
 if(spec.energies)for(const [id,E] of Object.entries(spec.energies as Record<string,number>)){
  const p=b.players.find((q:any)=>q.id===id);if(!p)throw Error(`${spec.code}: no player ${id}`);
  if(!(typeof E==='number'&&E>=0&&E<=100))throw Error(`energy ${E}`);p.energy=E;}
 return b;
}
setSides((spec:any)=>{
 if(spec.src==='g7x')return g7x(spec);
 if(spec.src==='onetired'){
  const {energy:E,man,...rest}=spec;
  if(!(typeof E==='number'&&E>=0&&E<=100)||!(man>=1&&man<=4))throw Error(`onetired: energy ${E}, man ${man}`);
  const b=sideOf({...rest,src:'neutral'});b.players[man].energy=E;return b;
 }
 if(spec.src==='nine'){const n=D.nines.find((x:any)=>x.id===spec.nine);if(!n)throw Error('no nine '+spec.nine);const s=clone(n.side);return {...s,substitutions:halfTimeOrders(s.substitutions)};}
 if(spec.src==='guest'){const g=D.guests[spec.guest];if(!g)throw Error('no guest '+spec.guest);const s=clone(g.side);return {...s,substitutions:halfTimeOrders(s.substitutions)};}
 return null;
});

// ------------------------------------------------------------------ the injuries key
function agesOf(t:any,teams:any[]):[Record<string,number>,Record<string,number>]{
 if(t.injuries.showcase){
  const n=D.nines.find((x:any)=>x.id===t.nine),g=D.guests[t.guest];return [clone(n.ages),clone(g.ages)];
 }
 return teams.map((tm:any)=>Object.fromEntries(tm.squad.filter((p:any)=>AGES[p.id]!==undefined).map((p:any)=>[p.id,AGES[p.id]]))) as any;
}
type Acc={tb:number;th:number;tk:number;fu:number;nt:number;nf:number;rkT:number;rkF:number;af:number;hard:number;fouls:number;hit:number};
let ACC=new Map<string,Acc>();
const acc=(id:string,af:number)=>{let a=ACC.get(id);if(!a){a={tb:0,th:0,tk:0,fu:0,nt:0,nf:0,rkT:0,rkF:0,af,hard:0,fouls:0,hit:0};ACC.set(id,a);}return a;};
/** The keys a task adds to its runMatch call (none without `injuries`). */
export function callFor(t:any,teams:any[]){
 if(!t.injuries)return null;
 const j=t.injuries;
 return {injuries:{on:true,salt:j.salt,age:agesOf(t,teams),...(j.scale!==undefined?{scale:j.scale}:{}),...(j.strength!==undefined?{strength:j.strength}:{})}};
}
setCall((t:any,teams:any[])=>{ACC=new Map();return callFor(t,teams);});
// read-only wrappers: they count what the engine computes and call it unchanged
const proto=Injuries.prototype as any,roll0=proto.roll,contact0=proto.contact,fatigue0=proto.fatigue;
proto.contact=function(p:any,b:any,by:any,time:number,foul=false){
 if(!this.hurt.has(p.id)){
  const hard=b.down>0||foul,m=1+TIRED_TACKLE*(1-Math.max(0,Math.min(100,p.energy))/100),a=acc(p.id,this.ageFactor(p.id));
  a.tb+=m;a.th+=m*Math.max(0,b.hit)/HIT_REF;if(hard){a.tk+=m;a.hard++;}if(foul)a.fouls++;a.hit+=Math.max(0,b.hit);
  this.__tc=p.id;
 }
 return contact0.call(this,p,b,by,time,foul);
};
proto.fatigue=function(p:any,time:number){
 if(!this.hurt.has(p.id)){const u=(FATIGUE_FROM-p.energy)/FATIGUE_SPAN;if(u>0){const a=acc(p.id,this.ageFactor(p.id));a.fu+=u*u;this.__tf=p.id;}}
 return fatigue0.call(this,p,time);
};
proto.roll=function(cause:string,side:number,risk:number){
 const id=cause==='tackle'?this.__tc:this.__tf,a=id?ACC.get(id):undefined;
 if(a){if(cause==='tackle'){a.rkT+=risk;a.nt++;}else{a.rkF+=risk;a.nf++;}}
 return roll0.call(this,cause,side,risk);
};

// ------------------------------------------------------------------ the read
const r4=(n:number)=>Math.round(n*1e4)/1e4,r2=(n:number)=>Math.round(n*100)/100;
function tc(runs:any[],teams:any[],t:any){
 const r=runs[0],roster:any[]=r.players??[],frames:any[]=r.frames??[],ev:any[]=r.events??[];
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const n=roster.length,start=new Array(n).fill(null),end=new Array(n).fill(null),sec=new Array(n).fill(0),drain=new Array(n).fill(0),drain1=new Array(n).fill(0);
 const first=new Array(n).fill(false),last=new Array(n).fill(false);
 const at=(f:any)=>{const m=new Map<number,number>();(f.players??[]).forEach((pl:any,j:number)=>{const ri=f.lineup?f.lineup[j]:j;if(typeof pl.energy==='number')m.set(ri,pl.energy);});return m;};
 let prev:Map<number,number>|null=null,prevT=0;
 frames.forEach((f:any,k:number)=>{
  const cur=at(f);
  if(k===0)for(const ri of cur.keys())first[ri]=true;
  if(k===frames.length-1)for(const ri of cur.keys())last[ri]=true;
  for(const [ri,e] of cur){if(start[ri]===null)start[ri]=e;end[ri]=e;
   if(prev&&prev.has(ri)){const d=prev.get(ri)!-e;if(d>0){drain[ri]+=d;if(f.half===1)drain1[ri]+=d;}const dt=f.time-prevT;if(dt>0&&dt<=.5)sec[ri]+=dt;}}
  prev=cur;prevT=f.time;
 });
 const players=teams.flatMap((tm:any,s:number)=>tm.squad.map((p:any)=>{
  const id=`${s}:${p.id}`,ri=idx.get(id),a=ACC.get(id);
  const o:any={s,id:p.id,role:p.roles[0],st:p.skills.stamina,str:p.skills.strength,e0:p.energy,started:tm.lineup.includes(p.id)};
  if(ri!==undefined&&start[ri]!==null)Object.assign(o,{on:1,start:r2(start[ri]),end:r2(end[ri]),sec:Math.round(sec[ri]*10)/10,full:first[ri]&&last[ri]?1:0,drain:r4(drain[ri]),drain1:r4(drain1[ri])});
  if(a)o.x={tb:r4(a.tb),th:r4(a.th),tk:r4(a.tk),fu:r4(a.fu),nt:a.nt,nf:a.nf,rkT:+a.rkT.toPrecision(6),rkF:+a.rkF.toPrecision(6),af:r4(a.af),hard:a.hard,fouls:a.fouls,hit:r4(a.hit)};
  return o;
 }));
 const inj=(r.injuries??[]).map((i:any)=>({s:i.side,id:i.player.slice(2),c:i.cause,h:i.hard?1:0,m:i.matches,t:r2(i.time),e:i.energy,...(i.off!==undefined?{off:r2(i.off)}:{}),...(i.playedOn?{po:1}:{}),...(i.by?{by:i.by.slice(2)}:{})}));
 const subs=[0,1].map(s=>ev.filter(e=>e.kind==='substitution'&&e.side===s).map(e=>({t:r2(e.time),in:e.incoming?.slice(2),out:e.outgoing?.slice(2),k:e.injury?'injury':e.substitution?.trigger?.kind??'?'})));
 const out:any={score:r.score,played:r.played??r.duration,players,inj,subs,fouls:[0,1].map(s=>r.stats[s].fouls),tackles:[0,1].map(s=>r.stats[s].tackles)};
 if(t.injuries?.showcase){
  // the subs study's row fields (../2026-11-01-showcase-subs/row.ts): slots in each side's frozen players
  const slot=(s:number,id:string)=>t.sides[s].src==='nine'?D.nines.find((x:any)=>x.id===t.nine).side.players.findIndex((p:any)=>p.id===id):D.guests[t.guest].side.players.findIndex((p:any)=>p.id===id);
  out.cmp={subs:[0,1].map(s=>subs[s].map((x:any)=>({t:Math.round(x.t*10)/10,on:slot(s,x.in),off:slot(s,x.out)}))),inj:inj.map((i:any)=>({s:i.s,i:slot(i.s,i.id),t:Math.round(i.t*10)/10,c:i.c,po:!!i.po}))};
 }
 return out;
}
setExtra((runs:any[],teams:any[],t:any)=>({...anatomy(runs,teams,t),halves:halves(runs,t),tc:tc(runs,teams,t)}));
