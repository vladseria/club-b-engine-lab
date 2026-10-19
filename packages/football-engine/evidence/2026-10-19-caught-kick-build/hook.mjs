// Caught kick build: ../2026-10-19-caught-kick/hook.mjs with the ball added to the choice call (__ch's last argument).
// Caught kick (2026-10-19): the read-only bundle-time transform run.mjs applies to practice.ts, for BOTH engines it
// measures (live dbdb6b81 and release 1, 9af97c9c = main 0207e34b). Every anchor below exists exactly once in both
// sources (checked at bundle time; a missing anchor throws, nothing is guessed). Each added call only passes values the
// engine already holds to a handler on globalThis; with no handler set it is a no-op (`?.`). No call draws a random
// number, writes engine state or changes an expression. run.mjs --parity proves the hooked bundle plays the official
// computeMatch match on each engine.
//  CHOICE  after the carrier's choice: __ch(time, player, chosen option, the list it was chosen from, restart kind or '',
//          players)   (the world-prices call plus `players`)
//  TACKLE  after a tackle's foul draw: __tk(time, tackler, carrier, contact, foul)   (world-prices, unchanged)
//  TICK    at the end of every tick, before the frame is recorded: __pt(time, ball, prepared, receivedAt, players,
//          restart)   (the kick being set, if any, and whose ball it is)
//  RELEASE inside releaseOption, as the kick leaves his foot: __rl(time, kicker id)
//  MEET    after the reception's first-time decision (`let direct=...;`): __mt(time, player, plan, viable, direct,
//          relativeSpeed)
import {readFileSync} from 'node:fs';
export const CHOICE='const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);';
export const TACKLE='const foul=touch.body&&execution()<touch.foulChance;';
export const TICK='if(tick%frameStride===0||needsFrame)frame();';
export const RELEASE='releaseBy=p.id;releaseAt=time;dispossessed={id:p.id,at:time';
export const MEET='let direct=';
const once=(src,a,name)=>{if(src.split(a).length!==2)throw Error(`${name} anchor not found exactly once`);};
export const hook={name:'caught-kick-hook',setup(b){
 b.onLoad({filter:/[\\/]practice\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  for(const [k,v] of Object.entries({CHOICE,TACKLE,TICK,RELEASE,MEET}))once(src,v,k);
  src=src.replace(CHOICE,CHOICE+'(globalThis as any).__ch?.(time,p,option,restartChoice??available,restart?restart.kind:\'\',players,ball);');
  src=src.replace(TACKLE,TACKLE+'(globalThis as any).__tk?.(time,d,p,touch,foul);');
  src=src.replace(TICK,'(globalThis as any).__pt?.(time,ball,prepared,receivedAt,players,restart);'+TICK);
  src=src.replace(RELEASE,'(globalThis as any).__rl?.(time,p.id);'+RELEASE);
  // MEET: the statement `let direct=...;` is one line in both sources; the call goes at its end
  const i=src.indexOf(MEET),eol=src.indexOf('\n',i),line=src.slice(i,eol);
  if(!line.trimEnd().endsWith(';'))throw Error('MEET statement does not end its line');
  src=src.slice(0,eol)+'(globalThis as any).__mt?.(time,p,plan,viable,direct,relativeSpeed);'+src.slice(eol);
  return {contents:src,loader:'ts'};
 });
}};
