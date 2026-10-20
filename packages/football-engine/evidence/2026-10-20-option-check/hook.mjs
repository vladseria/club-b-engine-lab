// Option check (2026-10-20): the bundle-time transform. Evidence only; the engine source is never edited.
// Every injected call goes through `globalThis.__oc`; with it unset each hook is a no-op and the bundle plays
// computeMatch's match exactly (step0.mjs proves it: same compact replay hash as an untransformed bundle).
//
// M1 model.ts rng(): the returned generator also carries `__rng = [get, set]` of its private state, so the harness can
//    save, restore and reseed every random stream the match owns (practice.ts's five, the playbooks' three).
// T1 practice.ts, top of every tick of simulatePractice's loop: __oc.top(tick, get, set). `get()` returns every binding
//    declared in simulatePractice's body before the loop (found with the TypeScript parser, so a new binding is never
//    missed) plus `tick`; `set(v)` reassigns the `let` ones and `tick` (their names are the 4th argument). With these
//    the harness snapshots the whole match
//    state at a tick and rewinds to it (option.ts snapshot/restore).
// D1 practice.ts, the carrier's ordinary decision (open play: not a restart, not a keeper with the ball in his hands,
//    not a forced release), after every price is applied and before chooseFootballOption draws:
//    __oc.decide(p, time, tick, available) may return the list he chooses from (the harness returns the one forced
//    option). The ceiling-routes probe's H2 anchor.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
// The TypeScript parser is on the laptop (the app's devDependency) but not on the lab runners (esbuild only), so the
// binding list is committed in bindings.json keyed by practice.ts's sha256: with the parser present the list is
// recomputed and must equal the file; without it the file is used only when the source hash matches.
let ts=null;if(!process.env.OC_NO_TS)try{ts=(await import('typescript')).default;}catch{}// OC_NO_TS=1: test the lab path
const BINDINGS=path.join(path.dirname(fileURLToPath(import.meta.url)),'bindings.json');
const swap=(src,from,to,name)=>{if(src.split(from).length!==2)throw Error(`${name}: anchor not found exactly once`);return src.replace(from,()=>to);};
export const A={
 M1:'  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };\n}',
 T1:' for(let tick=1;;tick++){\n',
 D1:'     const restartChoice=mustRelease&&restart?.routine?restartOptions(restart,available,time,players):available;',
};
/** simulatePractice's body bindings declared before the tick loop: {lets, consts}. Throws if the shape changed. */
export function loopBindings(src){
 const sha=createHash('sha256').update(src).digest('hex');
 let file=null;try{file=JSON.parse(readFileSync(BINDINGS,'utf8'));}catch{}
 if(!ts){
  if(!file||file.sha!==sha)throw Error(`bindings.json is for practice.ts ${file?.sha?.slice(0,12)}, this source is ${sha.slice(0,12)}: regenerate on the laptop (node bindings.mjs)`);
  return {lets:file.lets,consts:file.consts};
 }
 const got=parseBindings(src);
 if(!file||file.sha!==sha||JSON.stringify(file.lets)!==JSON.stringify(got.lets)||JSON.stringify(file.consts)!==JSON.stringify(got.consts))
  throw Error('bindings.json is stale for this practice.ts: node bindings.mjs');
 return got;
}
export function parseBindings(src){
 const sf=ts.createSourceFile('practice.ts',src,ts.ScriptTarget.Latest,true);
 let fn;ts.forEachChild(sf,n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='simulatePractice')fn=n;});
 if(!fn)throw Error('simulatePractice not found');
 const lets=[],consts=[];let loop=false;
 const names=(b,out)=>{if(ts.isIdentifier(b))out.push(b.text);else for(const e of b.elements)if(!ts.isOmittedExpression(e))names(e.name,out);};
 for(const s of fn.body.statements){
  if(ts.isForStatement(s)&&s.initializer?.getText()==='let tick=1'){loop=true;break;}
  if(ts.isVariableStatement(s)){const isLet=(s.declarationList.flags&ts.NodeFlags.Let)!==0;for(const d of s.declarationList.declarations)names(d.name,isLet?lets:consts);}
 }
 if(!loop)throw Error('tick loop not found at the top level of simulatePractice');
 if(lets.includes('tick')||consts.includes('tick'))throw Error('tick shadowed');
 return {lets,consts};
}
export const hook={name:'option-check-hook',setup(b){
 b.onLoad({filter:/[\\/]src[\\/]model\.ts$/},a=>{
  let s=readFileSync(a.path,'utf8');
  s=swap(s,A.M1,'  const __g = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };\n'+
   '  (__g as any).__rng = [() => s, (v: number) => { s = v >>> 0; }];\n  return __g;\n}','M1');
  return {contents:s,loader:'ts'};
 });
 b.onLoad({filter:/[\\/]src[\\/]practice\.ts$/},a=>{
  let s=readFileSync(a.path,'utf8');
  const {lets,consts}=loopBindings(s);
  const all=[...lets,...consts];
  s=swap(s,A.T1,A.T1+
   '  {const __oc=(globalThis as any).__oc;if(__oc?.top)__oc.top(tick,()=>({tick,'+all.join(',')+'}),(__v:any)=>{tick=__v.tick;'+lets.map(n=>`${n}=__v.${n};`).join('')+'},'+JSON.stringify(lets)+');}\n','T1');
  s=swap(s,A.D1,
   '     {const __oc=(globalThis as any).__oc;if(__oc?.decide&&!mustRelease&&!inHands&&!restart){const __a=__oc.decide(p,time,tick,available);if(__a&&__a.length)available=__a;}}\n'+A.D1,'D1');
  return {contents:s,loader:'ts'};
 });
}};
