// Caught kick build, step 0 (2026-10-19): does the carrier's "will he be on me before I strike it" read miss
// challenges that are already possible? One traced match on the live path (computeMatch's runMatch call, coordinated
// policy), read-only hooks (st0.mjs applies them at bundle time; no random draw, no state write).
//
// For every open-play pass-like kick SET (the engine's `prepared`), at the choice that set it:
//  - the carrier's read, exactly as priceCaught computes it: contactTime = min arrivalTime(opponent, carrier) (gap =
//    distance - 1 to his BODY), his perceived arrival (perceive 'arrival', salt 'caught'), his read horizon
//    (readKickHorizon, hurried share applied), and caughtOnBall (0 = "safe");
//  - the challenge's own geometry: a defender may start one once within 2.2 m of the BALL (practice.ts candidate
//    filter, readChallenge gap<=2.2), landing 0.16-0.30 s later by his reading (startChallenge): the exact time for
//    each opponent to come within 2.2 m of the ball (arrivalTime's motion model, gap = distance(ball) - 2.2) plus his
//    preparation;
//  - what happened: struck / lost unstruck / dropped, and every challenge started on him while the kick was set,
//    with how far the kick was from being struck then (committed when within SWITCH_DEADLINE).
import {runMatch} from '../../src/index';
import {arrivalTime} from '../../src/practice-arrival';
import * as poss from '../../src/practice-possession';
import {perceive} from '../../src/practice-perception';
import {engineTeam,sidePlans,sideOrders,compact} from '../../../../lib/ballers/compute';

let SIDES:Record<string,any>={};
export function init(s:Record<string,any>){SIDES=s;}
const r3=(v:number)=>Math.round(v*1000)/1000;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const PASSY=['pass','through','loft','clear'];

export function inputOf(arm:string,seed:number):any{
 const m=/^r\.([A-Z]+)-([A-Z]+)$/.exec(arm);if(!m)throw Error('unknown arm '+arm);
 const sides=[m[1],m[2]].map(c=>{const b=JSON.parse(JSON.stringify(SIDES[c]));delete b.voice;return b;});
 return {v:1,match:`audit-${arm}-${seed}`,seed,kickoff:seed%2,duration:900,sides};
}
/** arrivalTime's motion model to within `reach` m of a point (arrivalTime itself uses reach 1). */
function reachTime(p:any,pt:{x:number;y:number},reach:number){
 const d=Math.hypot(pt.x-p.x,pt.y-p.y),gap=Math.max(0,d-reach),ux=(pt.x-p.x)/(d||1),uy=(pt.y-p.y)/(d||1);
 const speed=p.pace*.94,v=clamp(p.vx*ux+p.vy*uy,-speed,speed),a=p.acceleration;
 const acc=(speed-v)/a,cov=v*acc+.5*a*acc*acc;
 return gap<=cov?(-v+Math.sqrt(v*v+2*a*gap))/a:acc+(gap-cov)/speed;
}
const prep=(d:any)=>.16+(1-clamp(d.skills.reading/10,0,1))*.14;

export function play(t:{arm:string;seed:number}){
 const inp=inputOf(t.arm,t.seed),g=globalThis as any;
 const sets:any[]=[];let lastCh:any=null,cur:any=null,rl:any=null;const seen=new WeakSet<object>();
 g.__ch=(time:number,p:any,option:any,list:any[],rk:string,players:any[],ball:any)=>{
  lastCh=null;if(rk||!PASSY.includes(option.kind))return;
  const opp=players.filter((q:any)=>q.side!==p.side&&q.role!=='GK');if(!opp.length)return;
  const contact=Math.min(...opp.map((q:any)=>arrivalTime(q,p)));
  const seenArr=Math.max(0,perceive(p,'arrival',contact,poss.LOOK_SPREAD,p,{time,salt:'caught'}));
  let hz=poss.readKickHorizon(p,option.aim,option.kind);if(option.hurried)hz-=(1-poss.HURRY_SHARE)*poss.preparationTime(p,option.kind);
  const exact=poss.kickHorizon(p,option.aim,option.kind)-(option.hurried?(1-poss.HURRY_SHARE)*poss.preparationTime(p,option.kind):0);
  const caught=poss.caughtOnBall(p,players,hz,time);
  // the ball-reach picture
  let land=99,reach=99,dBall=99,dBody=99,inRange=0;
  for(const q of opp){const rb=reachTime(q,ball,2.2),db=Math.hypot(q.x-ball.x,q.y-ball.y);if(db<=2.2)inRange++;
   if(rb+prep(q)<land){land=rb+prep(q);reach=rb;}dBall=Math.min(dBall,db);dBody=Math.min(dBody,Math.hypot(q.x-p.x,q.y-p.y));}
  lastCh={time,id:p.id,option,row:{t:r3(time),kind:option.kind,hurried:option.hurried?1:0,contact:r3(contact),seen:r3(seenArr),hz:r3(hz),exact:r3(exact),
   caught:r3(caught),reach:r3(reach),land:r3(land),dBall:r3(dBall),dBody:r3(dBody),ballOff:r3(Math.hypot(ball.x-p.x,ball.y-p.y)),inRange,
   alts:list.filter((o:any)=>o!==option).map((o:any)=>[o.kind,o.hurried?1:0,r3(o.score)]).sort((a:any,b:any)=>b[2]-a[2]).slice(0,6),score:r3(option.score)}};
 };
 g.__cs=(time:number,d:any,a:any,prepared:any)=>{
  if(cur&&cur.id===a.id&&prepared===cur.ref)cur.row.ch.push([r3(time-cur.t0),r3(prepared.at+poss.footToBall(a)-time),d.id]);
 };
 g.__rl=(time:number,id:string)=>{rl={time,id};};
 g.__pt=(time:number,ball:any,prepared:any,players:any[],restart:any)=>{
  if(cur){let out=-1;
   if(rl&&rl.time===time&&rl.id===cur.id)out=0;else if(restart)out=3;else if(ball.owner!==cur.id)out=1;else if(prepared!==cur.ref)out=2;
   if(out>=0){cur.row.out=out;cur.row.after=r3(time-cur.t0);sets.push(cur.row);cur=null;}}
  if(!cur&&prepared&&ball.owner&&!restart&&!seen.has(prepared)){seen.add(prepared);
   if(lastCh&&lastCh.time===time&&lastCh.id===ball.owner&&lastCh.option===prepared.option){
    cur={id:ball.owner,ref:prepared,t0:time,row:{...lastCh.row,set:r3(prepared.at-time),ch:[]}};}
  }
 };
 let r:any;
 try{
  const teams=inp.sides.map(engineTeam),plans=inp.sides.map(sidePlans);
  const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
  const subs=sideOrders(inp,teams as any);
  r=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 }finally{g.__ch=g.__cs=g.__rl=g.__pt=undefined;}
 return {arm:t.arm,seed:t.seed,build:r.engineBuild.slice(0,8),score:compact(inp,r.result).score,sets};
}
