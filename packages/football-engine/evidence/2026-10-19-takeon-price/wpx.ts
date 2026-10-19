// Take-on price: the world-prices row (../2026-10-19-world-prices/wp.ts, unchanged) with the flag set from the rev name
// (flag.ts) and `tp`, every open-play take-on the carrier chose (hook.mjs adds a read-only __tp call beside wp's __ch):
//  tp[] [side, t, carrier depth from his own goal (m), dribble trait, risk trait, control, player number in order of first
//        appearance, then (builds with the price, either arm) his reads of this take-on and the facts behind them:
//        7 through (his read of getting past), 8 stopped (his read of losing it to the man), 9 gain (takeOnGain at the
//        aim, the man left out; routeCredits before it existed), 10 loss weight (deliveryLossWeight of turnoverPrice here), 11 the fake's exact odds
//        (feintFoolChance), 12 the duel's exact odds for the man (duelChance with his cover), 13 gap to the man (m),
//        14 room at the aim from the others (m), 15 route contact risk from the others, 16 others closing the route,
//        17 the man's reading, 18 his defending, 19 cover (the man's team-mates within 6 m of the carrier, keeper incl.),
//        20 the scored feint's score]
//  in the same order as wp's fe[] (same filter), so tp[i] and fe[i] are the same take-on (tpOk checks side and t).
// Reading them never draws a random number or writes engine state.
import {play as wpPlay,init,inputOf,plain} from '../2026-10-19-world-prices/wp';
import * as F from '../../src/practice-feints';
import * as C from '../../src/practice-carry';
import * as RD from '../../src/practice-rest-defence';
import {duelChance} from '../../src/practice-challenge';
import {laneRisk} from '../../src/practice';
import {setFlag} from './flag';
export {init,inputOf,plain};
const r1=(v:number)=>Math.round(v*10)/10,r3=(v:number)=>Math.round(v*1000)/1000;
const dist=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y);
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const on=setFlag(t.rev),tp:any[]=[],ids=new Map<string,number>();
 const f:any=F,c:any=C;
 (globalThis as any).__tp=(time:number,p:any,option:any,rk:string,players:any[],_mem:any,list:any[])=>{
  if(rk||option.kind!=='feint')return;
  if(!ids.has(p.id))ids.set(p.id,ids.size);
  const row:any[]=[p.side,r1(time),r1(p.side===0?p.x:48-p.x),p.traits.dribble,p.traits.risk,p.skills.control,ids.get(p.id)];
  const d=players?.find((q:any)=>q.id===option.target);
  if(d&&f.takeOnRead&&c.routeCredits){
   const read=f.takeOnRead(p,d,players),beyond=players.filter((q:any)=>q.id!==d.id);
   const near=Math.min(...players.filter((q:any)=>q.side!==p.side&&q.role!=='GK').map((q:any)=>dist(q,p)));
   const cover=players.filter((q:any)=>q.side===d.side&&q.id!==d.id&&dist(q,p)<6).length;
   const local=c.readDribbleRoute(p,option.aim,players,d.id),room=Math.min(...players.filter((q:any)=>q.side!==p.side&&q.id!==d.id).map((q:any)=>dist(q,option.aim)));
   row.push(r3(read.through),r3(read.stopped),r3(f.takeOnGain?f.takeOnGain(p,option.aim,beyond,laneRisk,near,list?.find((o:any)=>o.kind==='shoot')?.quality??0,time):c.routeCredits(p,option.aim,beyond,laneRisk,near).credits),r3(RD.deliveryLossWeight(p,RD.turnoverPrice(p,players,p))),
    r3(f.feintFoolChance(p,d)),r3(duelChance(p,d,cover)),r1(dist(p,d)),r1(room),r3(local.contactRisk),local.nearbyChallenges,d.skills.reading,d.skills.defending,cover,r3(option.score));
  }
  tp.push(row);
 };
 let row:any;
 try{row=wpPlay(t);}finally{(globalThis as any).__tp=undefined;setFlag('off');}
 row.flag=on;row.rev=t.rev;row.tp=tp;
 row.tpOk=tp.length===row.fe.length&&tp.every((x:any,i:number)=>x[1]===row.fe[i][1]&&x[0]===row.fe[i][0]);
 return row;
}
