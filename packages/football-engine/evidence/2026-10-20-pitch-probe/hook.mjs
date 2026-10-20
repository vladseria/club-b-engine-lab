// Pitch probe (2026-10-20): the bundle-time transform that moves the engine to another pitch. Evidence only; the engine
// source is never edited. One bundle per world (run.mjs): every scaled value is a compile-time literal, so the hooked
// engine runs at full speed and W1 (factors 1) prints the very same numbers as the live source.
//
// Factors (README "Scaling rule"): sL = L/48 (along the pitch, and radii from a goal), sW = W/30 (across), sG = GH/2.5
// (the goal mouth). Every edit is found exactly once or the bundle fails.
//   decl  `NAME[: type]=<number | {k:number,...}>` in a file: each number (or only `keys`) times the axis factor
//   swap  an exact source anchor replaced by a function of the factors (inline literals inside functions)
// pitch.ts itself: L, W, GH set; BOX_DEPTH, SPOT (sL) and BOX_HALF (sW) scaled; the `pitch` object's goal area and
// restart radius follow the same rule. X(), Y(), G() then scale every reference-built position automatically.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {SCALE} from './scale.mjs';

// Owner's gate decision (20 Oct): the live 5 m goal in every world (density is the question; the keeper is a body).
// The 3 m-goal worlds were dropped as known-broken (README "Known-broken: the 3 m goal").
export const WORLDS={
 w1:{L:48,W:30,GH:2.5},   // control, live
 w2:{L:40,W:20,GH:2.5},   // futsal-sized pitch, 5 m goal
 w3:{L:44,W:25,GH:2.5},   // halfway, 5 m goal
};
/** A: the goal-angle normaliser's factor. The live reads give full angle value at 0.6 rad, which a central point
 * D0 = 2.5 / tan(0.3) = 8.09 m out subtends; on another world the same point, scaled (D0 * sL), subtends this share of it. */
const D0=2.5/Math.tan(.3);
export const factors=w=>{const L=w.L/48;return {L,W:w.W/30,G:w.GH/2.5,A:w.GH===2.5&&L===1?1:Math.atan(w.GH/(D0*L))/Math.atan(2.5/D0)};};
const num=v=>{const s=String(+v.toFixed(9));return s;};
const NUM=/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g;

/** Scale the numbers of one declaration's initializer. */
export function scaleDecl(src,name,f,{keys=null,file='?'}={}){
 const re=new RegExp(`(?<![\\w.$])${name.replace(/[$]/g,'\\$')}(\\s*:\\s*[^=\\n]*?)?=(?!=)`,'g');
 const hits=[...src.matchAll(re)].filter(m=>{const before=src.slice(Math.max(0,m.index-12),m.index);return /(const\s+|,\s*|let\s+)$/.test(before);});
 if(hits.length!==1)throw Error(`${file} ${name}: declaration found ${hits.length} times`);
 const start=hits[0].index+hits[0][0].length;
 let end;
 if(src[start]==='{'||src[start]==='['){const o=src[start],c=o==='{'?'}':']';let d=0;for(end=start;end<src.length;end++){if(src[end]===o)d++;else if(src[end]===c){d--;if(d===0){end++;break;}}}}
 else{const m=/^-?(?:\d+\.?\d*|\.\d+)/.exec(src.slice(start));if(!m)throw Error(`${file} ${name}: initializer is not a number literal`);end=start+m[0].length;}
 const init=src.slice(start,end);let n=0;
 const out=src[start]==='['?init.replace(/-?(?:\d+\.?\d*|\.\d+)/g,v=>{n++;return num(Number(v)*f);})
  :src[start]==='{'
  ?init.replace(/([A-Za-z_$][\w$]*|'[^']*')\s*:\s*(-?(?:\d+\.?\d*|\.\d+))/g,(all,k,v)=>{const key=k.replace(/'/g,'');if(keys&&!keys.includes(key))return all;n++;return `${k}:${num(Number(v)*f)}`;})
  :num(Number(init)*f);
 if(src[start]!=='-'&&isNaN(Number(src[start]))&&src[start]!=='.'&&!n)throw Error(`${file} ${name}: no numbers scaled`);
 return src.slice(0,start)+out+src.slice(end);
}
export function swap(src,from,to,name){if(src.split(from).length!==2)throw Error(`${name}: anchor found ${src.split(from).length-1} times`);return src.replace(from,()=>to);}

/** Apply the table to one source file. Returns null when the file has no entries. */
export function transform(file,src,w){
 const f=factors(w),base=path.basename(file);
 const entries=SCALE.filter(e=>e.file===base);
 if(base==='pitch.ts'){
  src=swap(src,'export const L=48,W=30,GH=2.5,HEIGHT=2,BOX_DEPTH=8,BOX_HALF=8,SPOT=6;',
   `export const L=${num(w.L)},W=${num(w.W)},GH=${num(w.GH)},HEIGHT=2,BOX_DEPTH=${num(8*f.L)},BOX_HALF=${num(8*f.W)},SPOT=${num(6*f.L)};`,'pitch.ts dims');
  src=swap(src,'goalAreaDepth:3,goalAreaWidth:9,restartRadius:5}',`goalAreaDepth:${num(3*f.L)},goalAreaWidth:${num(9*f.W)},restartRadius:5}`,'pitch.ts object');
 }
 if(!entries.length&&base!=='pitch.ts')return null;
 for(const e of entries){
  const k=f[e.axis];if(k===undefined&&e.kind!=='swap')throw Error(`${base} ${e.name}: bad axis ${e.axis}`);
  if(e.kind==='swap')src=swap(src,e.from,e.to(f,num),`${base} ${e.name??e.from.slice(0,40)}`);
  else src=scaleDecl(src,e.name,k,{keys:e.keys??null,file:base});
 }
 return src;
}

/** The esbuild plugin for world w ({L,W,GH}). */
export const pitchHook=w=>({name:'pitch-probe-hook',setup(b){
 b.onLoad({filter:/[\\/]packages[\\/]football-engine[\\/]src[\\/][^\\/]+\.ts$|[\\/]\.rev-[^\\/]+[\\/]packages[\\/]football-engine[\\/]src[\\/][^\\/]+\.ts$/},a=>{
  const s=transform(a.path,readFileSync(a.path,'utf8'),w);
  return s===null?undefined:{contents:s,loader:'ts'};
 });
}});
