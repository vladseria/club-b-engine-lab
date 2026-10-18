// Keeper position (2026-10-19): the read-only bundle-time transform used by run.mjs (public lab and laptop traces).
// One call is added inside keeperSupportCandidates (practice-keeper-support.ts), per candidate, right where its score is
// computed: the score expression is moved into a const with the SAME arithmetic in the same order (so the value is
// bit-identical) and handed to globalThis.__ks with the locals the score is built from (aim, returnTime, open, travel,
// danger, nearest, the ball's depth). With no __ks set the call is a no-op (`?.`), and the function returns what it did.
// Nothing else in the engine is touched. run.mjs --parity proves the hooked bundle plays the official match.
import {readFileSync} from 'node:fs';
export const ANCHOR="  return {score:.6+open*.7-read.travel*.055-returnTime*(.12+(1-sweep)*.07+danger*.25),job:";
export const hook={name:'keeper-support-hook',setup(b){
 b.onLoad({filter:/practice-keeper-support\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(!src.includes(ANCHOR))throw Error('keeper support score anchor not found');
  src=src.replace(ANCHOR,"  const __score=.6+open*.7-read.travel*.055-returnTime*(.12+(1-sweep)*.07+danger*.25);\n"+
   "  (globalThis as any).__ks?.({id:p.id,side:p.side,time,aim,score:__score,returnTime,open,travel:read.travel,risk:read.risk,danger,nearest,bd,sweep});\n"+
   "  return {score:__score,job:");
  return {contents:src,loader:'ts'};
 });
 // (2026-10-19 follow-up) one read-only call before the ordinary steer of every player each tick (practice.ts, the
 // `}else steer(p,aim,STEP,Math.min(limit,p.pace),...)` line): __gk gets the player, his aim, his speed limit, his kind,
 // the time and the players, and reads them only (the keeper's recovery: which limit, which aim). No __gk = a no-op.
 b.onLoad({filter:/[\\/]src[\\/]practice\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(src.split(STEER).length!==2)throw Error('steer anchor not found exactly once');
  src=src.replace(STEER,"}else{(globalThis as any).__gk?.(p,aim,limit,kind,time,players);"+STEER.slice(5)+"}");
  return {contents:src,loader:'ts'};
 });
}};
export const STEER="}else steer(p,aim,STEP,Math.min(limit,p.pace),kind==='press'||kind==='challenge'||kind==='intercept'||kind==='receive'||kind==='sweep'?players.filter(q=>q.side===p.side):players,trackingVelocity);";
