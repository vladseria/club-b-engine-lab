// Ceiling routes (2026-10-20): the probe's bundle-time transform. Evidence only; the engine source is never edited.
// Every injected call goes through `globalThis.__rt` / `globalThis.__exactId`; with neither set (every opponent, every
// live Direct arm, every parity run) each call is a no-op and the bundle plays computeMatch's match exactly
// (run.mjs --parity proves it on the lab). Anchors must each be found exactly once.
//
// practice-perception.ts (the "true picture"):
//  P1 misread(p)  -> 0 while __exactId === p.id (every read's error, including the ones that call misread directly)
//  P2 perceive(p) -> the exact value while __exactId === p.id (no error, no bias)
// practice.ts (the coordinated policy computeMatch uses):
//  H1 responsibilities: the manager-committed off-ball moves (the channel the playbook and coaching use: reserved
//     before ordinary jobs, speed capped at the player's pace, receivers and unavailable men excluded) may be replaced
//     by __rt.moves(...) -> the route's team-mates' runs to the pattern's spots.
//  H2 the carrier's ordinary decision (not a restart, not a keeper with the ball in his hands, not a forced release):
//     __rt.decide(p, players, ball, time, available, exact) may return the option list to choose from; `exact()`
//     recomputes his options exactly as `available` was built, with __exactId = p.id (his true picture).
//  H3 the prepared-option re-read (a clearly better alternative, +0.18, drops a prepared kick; a kept one is refreshed):
//     __rt.keep(..., exact) may instead return the route kick he prepared, refreshed from his true picture, while it is
//     still on there; otherwise the engine's re-read runs exactly as before.
//  H4 a receiver's in-flight plan (readReception, our side): __rt.plan(...) may return the option he plans (the engine
//     then decides first time or not, and checks its physical gates, exactly as for any plan); `exact()` as in H2.
import {readFileSync} from 'node:fs';
const swap=(src,from,to,name)=>{if(src.split(from).length!==2)throw Error(`${name}: anchor not found exactly once`);return src.replace(from,()=>to);};
export const A={
 P1:'export function misread(p:Reader,read:Read):number{return clamp(1.05-acuity(p,read),.05,1);}',
 P2:' return exact+spread*misread(p,read)*readNoise(p,read,at,o.time,o.salt)+(o.bias??0);',
 H1:'       return proposed;',
 H2:'     const restartChoice=mustRelease&&restart?.routine?restartOptions(restart,available,time,players):available;',
 H3:'     if(!current||Math.max(...alternatives.map(o=>o.score))>current.score+.18)prepared=null;\n     else prepared.option=prepared.option.hurried?{...current,hurried:true}:current;',
 H4:'   if(!option)return null;\n   const same=!!held&&sameIntention(held.option,option),since=same?held!.since:time;',
};
export const hook={name:'ceiling-routes-hook',setup(b){
 b.onLoad({filter:/practice-perception\.ts$/},a=>{
  let s=readFileSync(a.path,'utf8');
  s=swap(s,A.P1,'export function misread(p:Reader,read:Read):number{if((globalThis as any).__exactId!==undefined&&(globalThis as any).__exactId===p.id)return 0;return clamp(1.05-acuity(p,read),.05,1);}','P1');
  s=swap(s,A.P2,' if((globalThis as any).__exactId!==undefined&&(globalThis as any).__exactId===p.id)return exact;\n'+A.P2,'P2');
  return {contents:s,loader:'ts'};
 });
 b.onLoad({filter:/[\\/]src[\\/]practice\.ts$/},a=>{
  let s=readFileSync(a.path,'utf8');
  s=swap(s,A.H1,'       {const __rt=(globalThis as any).__rt;if(__rt?.moves){const __m=__rt.moves(time,players,ball,preview,proposed,unavailable);if(__m!==undefined)return __m;}}\n'+A.H1,'H1');
  s=swap(s,A.H2,
   '     {const __rt=(globalThis as any).__rt;if(__rt?.decide&&!mustRelease&&!inHands&&!restart){'+
   'const __exact=()=>{(globalThis as any).__exactId=p.id;try{return priceCaught(p,players,footballOptions(p,players,runs,lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id)),time);}finally{(globalThis as any).__exactId=undefined;}};'+
   'const __a=__rt.decide(p,players,ball,time,available,__exact);if(__a&&__a.length)available=__a;}}\n'+A.H2,'H2');
  s=swap(s,A.H3,
   '     const __k=(globalThis as any).__rt?.keep?.(p,prepared!.option,players,ball,time,()=>{(globalThis as any).__exactId=p.id;try{return footballOptions(p,players,new Set(players.filter(q=>q.duty===\'run\').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));}finally{(globalThis as any).__exactId=undefined;}});\n'+
   '     if(__k)prepared!.option=prepared!.option.hurried?{...__k,hurried:true}:__k;\n     else '+A.H3.slice(5),'H3');
  s=swap(s,A.H4,
   '   {const __rt=(globalThis as any).__rt;if(__rt?.plan&&mine){'+
   'const __exact=()=>{(globalThis as any).__exactId=p.id;try{return footballOptions(future,seen,runs,releaseBy,0,null,time,support);}finally{(globalThis as any).__exactId=undefined;}};'+
   'const __o=__rt.plan(p,meeting,arrive,available,option,time,players,__exact);if(__o)option=__o;}}\n'+A.H4,'H4');
  return {contents:s,loader:'ts'};
 });
}};
