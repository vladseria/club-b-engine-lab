// Keeper 2 (2026-10-13): copied unchanged from ../2026-10-13-keeper-fix (branch ballers-keeper-fix).
// Keeper fix (2026-10-13): bundle-time variants of the engine source (esbuild onLoad), copied from the giveaway study
// (../2026-10-13-keeper-giveaway, branch ballers-keeper-giveaway) with only its read-only hook kept (its `fix` and
// `off` prototypes are superseded by the engine change itself). A name is a '+'-joined list; `base` is the source as it is.
//   hook  read-only: every carrier choice by a keeper (its aim, kind, target, in hands, at a restart) reaches keeper.ts
//         through globalThis.__kgDecide; no effect on play.
//   off   (2026-10-13, the alternative F1 position) the man pressing an in-hands keeper stands KEEP_OFF m off on the line
//         in front of him (the presser's own aim's line, as the giveaway study's `off` prototype), not towards the
//         keeper's nearest short throw; everything else as committed (the guard, F2's 4 s rule and step-away).
import {readFileSync} from 'node:fs';

const PR=/football-engine\/src\/practice\.ts$/,PD=/football-engine\/src\/practice-defending\.ts$/;
const T={
 hook:[[PR,'const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);',
  'const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);if(p.role===\'GK\')(globalThis as any).__kgDecide?.(time,p.id,option,inHands,restart?restart.kind:null);']],
 off:[
  [PD,' const own=along(presser)??along(aim),line=short?along(short):along(aim);',' const own=along(presser)??along(aim),line=along(aim)??own;void short;'],
  [PD,' let u=line&&own?{x:line.x+own.x,y:line.y+own.y}:line??own;',' let u=line;'],
 ],
};
export const parts=name=>name==='base'?[]:name.split('+').map(k=>{if(!T[k])throw Error(`unknown variant part '${k}'`);return k;});

/** esbuild plugin applying the named variant; every replacement must match exactly once. */
export function variantPlugin(name){
 const edits=parts(name).flatMap(k=>T[k]);
 return {name:'kg-variant',setup(b){
  if(!edits.length)return;
  b.onLoad({filter:/football-engine\/src\/practice(-defending)?\.ts$/},a=>{
   let src=readFileSync(a.path,'utf8');
   for(const [file,from,to] of edits){
    if(!file.test(a.path))continue;
    const n=src.split(from).length-1;if(n!==1)throw Error(`variant ${name}: '${from.slice(0,60)}' matched ${n} times in ${a.path}`);
    src=src.replace(from,()=>to);
   }
   return {contents:src,loader:'ts'};
  });
 }};
}
