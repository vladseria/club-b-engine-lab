// Keeper fix (2026-10-19): the keeper position study's read-only bundle-time transform (../2026-10-19-keeper-position/
// hook.mjs), taught the fix's support score as well, so one harness reads both builds. Per keeper support candidate it
// hands globalThis.__ks the score (moved into a const with the SAME arithmetic in the same order, so the value is
// bit-identical) and the locals it is built from; with no __ks set the call is a no-op. Live e4d6678a: the study's
// anchor. The fix: its score line (the loss-exposure price `exposed` on top). And the same
// read-only __gk call before every player's ordinary steer (practice.ts). run.mjs --parity proves the hooked bundle
// plays the official match.
import {readFileSync} from 'node:fs';
const LIVE="  return {score:.6+open*.7-read.travel*.055-returnTime*(.12+(1-sweep)*.07+danger*.25),job:";
const FIX="  return {score:.6+open*.7-read.travel*.055-returnTime*(.12+(1-sweep)*.07+danger*.25)-exposed,job:";
export const STEER="}else steer(p,aim,STEP,Math.min(limit,p.pace),kind==='press'||kind==='challenge'||kind==='intercept'||kind==='receive'||kind==='sweep'?players.filter(q=>q.side===p.side):players,trackingVelocity);";
export const hook={name:'keeper-support-hook',setup(b){
 b.onLoad({filter:/practice-keeper-support\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  const live=src.includes(LIVE),fix=src.includes(FIX);
  if(live===fix)throw Error('keeper support score anchor not found (or both found)');
  const expr=(live?LIVE:FIX).slice('  return {score:'.length,-',job:'.length);
  src=src.replace(live?LIVE:FIX,`  const __score=${expr};\n`+
   `  (globalThis as any).__ks?.({id:p.id,side:p.side,time,aim,score:__score,returnTime,open,travel:read.travel,risk:read.risk,danger,nearest,bd,sweep${fix?',exposed,nc:points.length':''}});\n`+
   "  return {score:__score,job:");
  return {contents:src,loader:'ts'};
 });
 b.onLoad({filter:/[\\/]src[\\/]practice\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(src.split(STEER).length!==2)throw Error('steer anchor not found exactly once');
  src=src.replace(STEER,"}else{(globalThis as any).__gk?.(p,aim,limit,kind,time,players);"+STEER.slice(5)+"}");
  return {contents:src,loader:'ts'};
 });
}};
