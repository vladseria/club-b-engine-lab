// Take-on price: the world-prices row (../2026-10-19-world-prices/wp.ts, unchanged) with the flag set from the rev name
// (flag.ts) and `tp`, every open-play take-on the carrier chose (hook.mjs adds a read-only __tp call beside wp's __ch):
//  tp[] [side, t, ball-carrier depth from his own goal (m), dribble trait, risk trait, control, player number in order
//        of first appearance in this list] in the same order as wp's fe[] (same filter), so tp[i] and fe[i] are the
//        same take-on (tpOk checks side and t).
import {play as wpPlay,init,inputOf,plain} from '../2026-10-19-world-prices/wp';
import {setFlag} from './flag';
export {init,inputOf,plain};
const r1=(v:number)=>Math.round(v*10)/10;
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const on=setFlag(t.rev),tp:any[]=[],ids=new Map<string,number>();
 (globalThis as any).__tp=(time:number,p:any,option:any,rk:string)=>{
  if(rk||option.kind!=='feint')return;
  if(!ids.has(p.id))ids.set(p.id,ids.size);
  tp.push([p.side,r1(time),r1(p.side===0?p.x:48-p.x),p.traits.dribble,p.traits.risk,p.skills.control,ids.get(p.id)]);
 };
 let row:any;
 try{row=wpPlay(t);}finally{(globalThis as any).__tp=undefined;setFlag('off');}
 row.flag=on;row.rev=t.rev;row.tp=tp;
 row.tpOk=tp.length===row.fe.length&&tp.every((x:any,i:number)=>x[1]===row.fe[i][1]&&x[0]===row.fe[i][0]);
 return row;
}
