// Bebe's showcase, the coaches' substitutions (1 Nov 2026): one match row. Evidence only. Played through
// ../2026-10-21-engine-as-data/run.mjs (--entry ../2026-11-01-showcase-subs/row.ts --set ../2026-11-01-showcase-subs/set.mjs).
//
// The match is the strength study's (../2026-11-01-showcase-strength/row2.ts on nines-v2.json: the real freezer's Bebe
// nine at home against one guest side, through lib/ballers/simulation validateInput + computeMatch, the freezer's
// kickoff (seed % 2), injury salt (seed x 2654435761 mod 2^32) and both sides' ages). `task.orders` picks the
// substitution orders: 'old' the ones the old freezer froze (nines-v2.json as it is), 'new' the same orders rewritten by
// the new rule (orders.ts halfTimeOrders, on both sides). Everything else is the same input, so an old and a new task
// at one seed are a pair. The row keeps the score, each side's changes (time, why: an order's trigger or an injury,
// who on, who off, by slot), every injury (side, slot, time, cause, whether he played on, the changes his side had made
// before it) and every player's seconds on the pitch and goals, by his slot in his side's players.
import {computeMatch,validateInput} from '../../../../lib/ballers/simulation';
import {computedPlayerLines} from '../../../../lib/ballers/match-lines';
import {ENGINE_BUILD} from '../../src/index';
import data from '../2026-11-01-showcase-strength/nines-v2.json';
import {halfTimeOrders} from './orders';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}
const sec=(ms:number)=>Math.round(ms/100)/10;
export function play(task:any){
 const D=data as any,nine=D.nines.find((n:any)=>n.id===task.nine),guest=D.guests[task.guest];
 if(!nine||!guest)throw Error(`unknown nine/guest ${task.nine}/${task.guest}`);
 if(task.orders!=='old'&&task.orders!=='new')throw Error(`orders ${task.orders}`);
 const rule=(side:any)=>task.orders==='new'?{...side,substitutions:halfTimeOrders(side.substitutions)}:side;
 const input={v:1,match:`strength-${task.nine}:${task.guest}:${task.seed}`,seed:task.seed,kickoff:task.seed%2,duration:900,sides:[rule(nine.side),rule(guest.side)],
  injuries:{on:true,salt:Number((BigInt(task.seed)*2654435761n)%4294967296n),age:[nine.ages,guest.ages]}};
 const inp=validateInput(input),t0=Date.now(),c0=process.cpuUsage();
 const c:any=DRY?null:computeMatch(inp);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0);
 let extra:any=null;
 if(c){
  const h=c.compact.header,ev:any[]=c.compact.chunks.flatMap((ch:any)=>ch.e);
  const slot=(side:number,id:string)=>inp.sides[side].players.findIndex((p:any)=>p.id===id);
  const at=(i:number|undefined)=>i===undefined?-1:slot(h.players[i].side,h.players[i].id);
  const subs=[0,1].map(s=>ev.filter(e=>e.k==='substitution'&&h.players[e.a]?.side===s).map(e=>({t:sec(e.t),k:e.sb?.k??null,on:at(e.a),off:at(e.g)})));
  const inj=(c.injuries??[]).map((i:any)=>({s:i.side,i:slot(i.side,i.id),t:Math.round(i.t*10)/10,c:i.cause,po:!!i.played_on,
   made:ev.filter(e=>e.k==='substitution'&&e.t<i.t*1000&&h.players[e.a]?.side===i.side).length}));
  const lines=computedPlayerLines(c)??[],per=(s:number,k:'m'|'g')=>inp.sides[s].players.map((p:any)=>{const l:any=lines.find((x:any)=>x.side===s&&x.id===p.id);return l?Math.round(l[k]??0):0;});
  extra={nine:task.nine,guest:task.guest,seed:task.seed,orders:task.orders,score:c.compact.score,played:h.duration,
   subs,inj,m:[per(0,'m'),per(1,'m')],g:[per(0,'g'),per(1,'g')]};
 }
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:c?.compact.score??[0,0],print:[0,0,0],full:'',build:ENGINE_BUILD.slice(0,8),runs:1,frames:0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:c?.dropped??[],tactics:null,variety:null,extra};
}
