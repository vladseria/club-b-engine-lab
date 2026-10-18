// Press step-up (2026-10-18): the read-only bundle-time transform shared by gates.mjs (laptop) and run.mjs (public lab).
// It adds three calls, none of which changes what the engine does:
//   __so  inside defendOutOfPossession, right before the beaten-presser check, with the plan's locals
//   __sp  after defendOutOfPossession returns (the plan's presser after the check)
//   __pc  after coordinateFootball returns (the jobs: counter-press / trap / open play)
// With no global hook set, every call is a no-op (`?.`), so a bundle without hooks plays the official match.
import {readFileSync} from 'node:fs';
export const ANCHOR="   if(engaged&&!pinned&&carrier.role!=='GK'&&input.intent!=='delay'&&(busy.has(presser.id)||isBeaten(presser,carrier,g)||outOfBlock(presser))&&(cd<28||running)){";
export const hook={name:'stepup-hook',setup(b){
 b.onLoad({filter:/practice-defending\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(!src.includes(ANCHOR))throw Error('step-out anchor not found');
  if(!src.includes('export function defendOutOfPossession('))throw Error('defendOutOfPossession not found');
  src=src.replace(ANCHOR,"   (globalThis as any).__so?.({time,presser,committed,engaged,pinned,carrier,cd,running,own,busy,g,intent:input.intent,memory,defending,outOfBlock,outOfBlockFor,manOf,readOf});\n"+ANCHOR);
  src=src.replace('export function defendOutOfPossession(','function defendOutOfPossession__o(')+
   '\nexport function defendOutOfPossession(given:DefendInput):DefendPlan{const r=defendOutOfPossession__o(given);(globalThis as any).__sp?.(given,r);return r;}\n';
  return {contents:src,loader:'ts'};
 });
 b.onLoad({filter:/practice-coordination\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  if(!src.includes('export function coordinateFootball('))throw Error('coordinateFootball not found');
  src=src.replace('export function coordinateFootball(','function coordinateFootball__o(')+
   '\nexport function coordinateFootball(...a:any[]):any{const r=(coordinateFootball__o as any)(...a);(globalThis as any).__pc?.(r,a[0],a[1]);return r;}\n';
  return {contents:src,loader:'ts'};
 });
}};
