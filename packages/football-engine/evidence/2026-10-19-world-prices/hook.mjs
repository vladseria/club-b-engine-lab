// World prices (2026-10-19): the read-only bundle-time transform used by run.mjs (public lab and laptop traces).
// Two calls are added in practice.ts, each right after a value the engine has already computed, reading it only:
//  - after the carrier's choice (`const option=rehearsed??chooseFootballOption(...)`): __ch gets the time, the
//    player, the chosen option, the list it was chosen from and the restart kind (or '');
//  - after a tackle's foul draw (`const foul=touch.body&&execution()<touch.foulChance;`): __tk gets the time, the
//    tackler, the carrier, the contact and whether it was a foul.
// Neither call draws a random number, writes engine state or changes an expression; with no __ch / __tk set they are
// no-ops (`?.`). run.mjs --parity proves the hooked bundle plays the official computeMatch match.
import {readFileSync} from 'node:fs';
export const CHOICE='const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);';
export const TACKLE='const foul=touch.body&&execution()<touch.foulChance;';
export const hook={name:'world-prices-hook',setup(b){
 b.onLoad({filter:/[\\/]practice\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(src.split(CHOICE).length!==2)throw Error('choice anchor not found exactly once');
  if(src.split(TACKLE).length!==2)throw Error('tackle anchor not found exactly once');
  src=src.replace(CHOICE,CHOICE+'(globalThis as any).__ch?.(time,p,option,restartChoice??available,restart?restart.kind:\'\');');
  src=src.replace(TACKLE,TACKLE+'(globalThis as any).__tk?.(time,d,p,touch,foul);');
  return {contents:src,loader:'ts'};
 });
}};
