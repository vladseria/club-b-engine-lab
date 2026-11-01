// Bebe's showcase, guest-side strength (1 Nov 2026): one match row. Evidence only. Played through
// ../2026-10-21-engine-as-data/run.mjs (--entry ../2026-11-01-showcase-strength/row.ts --set
// ../2026-11-01-showcase-strength/set.mjs). The sides are the real freezer's (nines.json, written by build-nines.mjs
// from private.ballers_showcase_freeze on a throwaway PostgreSQL: real Global players, names / roles / ages / skills /
// habits / portraits only, no member handle); each task plays F.C. Bebe Power's nine (side 0, at home, as the freezer
// puts it) against one guest side through the league's own compute (lib/ballers/simulation.ts validateInput +
// computeMatch), with the freezer's kickoff (seed % 2) and injury salt (seed x 2654435761 mod 2^32) and both sides' ages.
// A `grown` task swaps in each league player's skills after a season of growth (nines.json `grown`). The row keeps the
// score, shots, saves, possession, completed passes, fouls, injuries and each player's goals / assists / mark, by his slot in the side's players.
import {computeMatch,validateInput} from '../../../../lib/ballers/simulation';
import {computedPlayerLines} from '../../../../lib/ballers/match-lines';
import {ENGINE_BUILD} from '../../src/index';
import data from './nines.json';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}
export function play(task:any){
 const D=data as any,nine=D.nines.find((n:any)=>n.id===task.nine),guest=D.guests[task.guest];
 if(!nine||!guest)throw Error(`unknown nine/guest ${task.nine}/${task.guest}`);
 const bebe=task.grown?{...nine.side,players:nine.side.players.map((p:any)=>nine.grown[p.id]?{...p,skills:nine.grown[p.id]}:p)}:nine.side;
 const input={v:1,match:`strength-${task.id}`,seed:task.seed,kickoff:task.seed%2,duration:900,sides:[bebe,guest.side],
  injuries:{on:true,salt:Number((BigInt(task.seed)*2654435761n)%4294967296n),age:[nine.ages,guest.ages]}};
 const inp=validateInput(input),t0=Date.now(),c0=process.cpuUsage();
 const c:any=DRY?null:computeMatch(inp);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0);
 let extra:any=null;
 if(c){
  const slot=(side:number,id:string)=>inp.sides[side].players.findIndex((p:any)=>p.id===id);
  const lines=(computedPlayerLines(c,{marks:true})??[]).map((l:any)=>({s:l.side,i:slot(l.side,l.id),m:l.m,g:l.g,a:l.a,...(typeof l.mk==='number'?{mk:l.mk}:{})}));
  const st=c.compact.stats;
  extra={nine:task.nine,guest:task.guest,seed:task.seed,grown:!!task.grown,score:c.compact.score,
   shots:[st[0].shots,st[1].shots],saves:[st[0].saves,st[1].saves],poss:[st[0].possession,st[1].possession],
   passes:[st[0].completed,st[1].completed],fouls:[st[0].fouls,st[1].fouls],
   inj:(c.injuries??[]).map((i:any)=>({s:i.side,i:slot(i.side,i.id),c:i.cause,n:i.matches})),lines,dropped:c.dropped};
 }
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:c?.compact.score??[0,0],print:[0,0,0],full:'',build:ENGINE_BUILD.slice(0,8),runs:1,frames:0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:c?.dropped??[],tactics:null,variety:null,extra};
}
