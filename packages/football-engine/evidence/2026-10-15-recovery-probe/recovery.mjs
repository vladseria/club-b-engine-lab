// Recovery probe (2026-10-15, branch ballers-recovery-probe from ballers-decide b270ae63, ENGINE_BUILD 2b81fa4f): how long
// a player who has just lost the ball at close quarters stays off balance. A scratch switch applied to the engine source
// at bundle time (esbuild onLoad, as ../2026-10-15-contest-cost/ablate.mjs does), so the engine source and its default
// path stay byte-for-byte what they are.
// The rule (practice-challenge.ts, regain fixes 1f5a4659): beatenRecovery = BEATEN_BALANCE + BEATEN_STRENGTH x (10 -
// strength), no challenge of his own for that long, no controlled touch for BEATEN_TOUCH (half) of it. Only the base
// BEATEN_BALANCE changes here; the strength term (0.03 s a point under 10) and the half-length touch rule stay.
//   r06  current, 0.6 s base (0.72 s at strength 6): no edit at all, the bundle is the plain engine
//   r10  1.0 s base (1.12 s at strength 6)
//   r14  1.4 s base, the tackler's own wait (1.52 s at strength 6)
// Any other r<NN> works too (NN tenths of a second). The replacement must match exactly once, or the bundle fails.
import {readFileSync} from 'node:fs';

const FROM='export const BEATEN_BALANCE=.6,BEATEN_STRENGTH=.03,BEATEN_WINDOW=1,BEATEN_NEAR=2,BEATEN_TOUCH=.5;';
/** 'r10' -> 1 (seconds); 'r06' -> null (no edit: the current engine). */
export function baseOf(v){
 const m=/^r(\d\d)$/.exec(v);if(!m)throw Error(`unknown recovery variant '${v}' (want r<tenths>, e.g. r06, r10, r14)`);
 const s=Number(m[1])/10;return s===.6?null:s;
}
/** esbuild plugin setting BEATEN_BALANCE for variant v (none for r06). */
export function recoveryPlugin(v){
 const base=baseOf(v);
 return {name:'recovery-probe',setup(b){
  if(base===null)return;
  b.onLoad({filter:/football-engine\/src\/practice-challenge\.ts$/},a=>{
   const src=readFileSync(a.path,'utf8'),n=src.split(FROM).length-1;
   if(n!==1)throw Error(`recovery ${v}: BEATEN_BALANCE line matched ${n} times in ${a.path}`);
   return {contents:src.replace(FROM,()=>FROM.replace('BEATEN_BALANCE=.6',`BEATEN_BALANCE=${base}`)),loader:'ts'};
  });
 }};
}
