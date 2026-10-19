// Engine audits (2026-10-19): the read-only bundle-time transform used by run.mjs (public lab and laptop traces).
// Two calls are added in practice-perception.ts, each right where a value is returned, with the SAME arithmetic in the
// same order (so the value is bit-identical) and handed to a global that only reads it:
//  - perceive(): the read error `spread*misread*readNoise` is moved into a const, then `exact + error + bias` is
//    returned exactly as before ((exact + error) + bias, left to right, as the original expression); __pv gets the
//    player, the read kind, the error and the spread;
//  - sightLag(): the clamped lag is moved into a const; __sl gets the player and the lag.
// With no __pv / __sl set the calls are no-ops (`?.`). Nothing else in the engine is touched. run.mjs --parity proves
// the hooked bundle plays the official computeMatch match.
import {readFileSync} from 'node:fs';
export const PERCEIVE=' return exact+spread*misread(p,read)*readNoise(p,read,at,o.time,o.salt)+(o.bias??0);';
export const SIGHTLAG=' return clamp(lag*(1+.25*readNoise(p,\'sight\',o.at,o.time,o.salt)),0,SIGHT.cap);';
export const hook={name:'audit-read-hook',setup(b){
 b.onLoad({filter:/practice-perception\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(src.split(PERCEIVE).length!==2)throw Error('perceive anchor not found exactly once');
  if(src.split(SIGHTLAG).length!==2)throw Error('sightLag anchor not found exactly once');
  src=src.replace(PERCEIVE,' const __e=spread*misread(p,read)*readNoise(p,read,at,o.time,o.salt);const __v=exact+__e+(o.bias??0);'+
   '(globalThis as any).__pv?.(p,read,__e,spread);return __v;');
  src=src.replace(SIGHTLAG,' const __l=clamp(lag*(1+.25*readNoise(p,\'sight\',o.at,o.time,o.salt)),0,SIGHT.cap);(globalThis as any).__sl?.(p,__l);return __l;');
  return {contents:src,loader:'ts'};
 });
}};
