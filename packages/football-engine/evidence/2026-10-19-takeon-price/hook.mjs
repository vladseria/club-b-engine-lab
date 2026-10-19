// Take-on price: read-only bundle-time transforms.
//  wpx: the world-prices transform (../2026-10-19-world-prices/hook.mjs: __ch at the carrier's choice, __tk at a tackle)
//       plus one more read-only call at the same choice, __tp(time, p, option, restart kind), for the take-on list.
//  ax:  the engine-audits transform (../2026-10-19-engine-audits/hook.mjs), unchanged.
// No call draws a random number or writes engine state; unset globals make them no-ops.
import {readFileSync} from 'node:fs';
import {CHOICE,TACKLE} from '../2026-10-19-world-prices/hook.mjs';
import {hook as auditHook} from '../2026-10-19-engine-audits/hook.mjs';
export const wpHook={name:'takeon-wp-hook',setup(b){
 b.onLoad({filter:/[\\/]practice\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(src.split(CHOICE).length!==2)throw Error('choice anchor not found exactly once');
  if(src.split(TACKLE).length!==2)throw Error('tackle anchor not found exactly once');
  src=src.replace(CHOICE,CHOICE+'(globalThis as any).__ch?.(time,p,option,restartChoice??available,restart?restart.kind:\'\');(globalThis as any).__tp?.(time,p,option,restart?restart.kind:\'\');');
  src=src.replace(TACKLE,TACKLE+'(globalThis as any).__tk?.(time,d,p,touch,foul);');
  return {contents:src,loader:'ts'};
 });
}};
export const HOOKS={wpx:[wpHook],ax:[auditHook],rrx:[]};
