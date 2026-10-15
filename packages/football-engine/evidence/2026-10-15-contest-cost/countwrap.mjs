// Contest cost (2026-10-15): a call-counting copy of a harness bundle. Every top-level function declaration that comes
// from the engine source (packages/football-engine/src, by the bundle's esbuild module markers) is rebound, after the
// module has loaded, to a wrapper that counts its calls (globalThis.__calls: 'file:name' -> calls). perceive and
// readNoise are keyed by their read and salt too (perceive|<read>|<salt>), so the new code's reads can be told apart.
// For the functions in CALLERS the wrapper also records who called them (globalThis.__callers: the two nearest named
// callers, from a stack trace: every call up to SAMPLE_ALL, then one in SAMPLE_EVERY weighted by it). Behaviour is
// unchanged (the original runs with the same this and arguments); only the time is not representative.
// Not counted: closures inside simulatePractice (receptionDuel, layOff, airChallenger: read through what they call),
// const arrow functions, and calls captured before the rebinding (module-init references).
import {readFileSync,writeFileSync} from 'node:fs';
import {markers} from './profsum.mjs';

export const CALLERS=['shotContest','shotRead','hurryCost','shotTemper','assessShot','practiceOptions','footballOptions','aerialMeetings',
 'readAerialKick','duelGeometry','readDuel','resolveDuel','challengePoint','airRace','attacksTheBall','resolveAirDuel','goalShadow',
 'stepInWillingness','flightSamples','feltPressure','shotHurry','carryOptions','defendOutOfPossession','preparationTime'];
const SKIP=new Set(['clamp']);// trivially hot helpers: counting them only slows the run
export function countBundle(bundle){
 const text=readFileSync(bundle,'utf8'),fileAt=markers(text),lines=text.split('\n'),names=[];
 for(let i=0;i<lines.length;i++){const m=/^function ([A-Za-z_$][\w$]*)\(/.exec(lines[i]);if(!m)continue;const file=fileAt(i);
  if(file.startsWith('src/')&&!SKIP.has(m[1].replace(/\d+$/,'')))names.push([m[1],file]);}
 const wrap=`
;{const __C=globalThis.__calls=new Map(),__S=globalThis.__callers=new Map(),SAMPLE_ALL=4000,SAMPLE_EVERY=32;
const __CALLERS=new Set(${JSON.stringify(CALLERS)});
const __stack=()=>{const lim=Error.stackTraceLimit;Error.stackTraceLimit=14;const s=new Error().stack.split('\\n');Error.stackTraceLimit=lim;const out=[];
 for(let i=1;i<s.length&&out.length<2;i++){const l=s[i].trim();if(!l.startsWith('at ')||l.includes('(<anonymous>)')||l.includes('(native)'))continue;
  const m=/^at (?:new )?(.+?) \\(/.exec(l),n=m?m[1]:'(anonymous)';if(n==='__wg'||n.endsWith('.__wg')||n==='__stack')continue;out.push(n);}
 return out.join(' < ');};
const __w=(k,f,b)=>{const pc=b==='perceive',rn=b==='readNoise',who=__CALLERS.has(b);let n=0;
 return function __wg(...a){n++;
  const kk=pc?k+'|'+a[1]+'|'+(a[5]?.salt??''):rn?k+'|'+a[1]+'|'+(a[4]??''):k;__C.set(kk,(__C.get(kk)??0)+1);
  if(who&&(n<=SAMPLE_ALL||n%SAMPLE_EVERY===0)){const w=n<=SAMPLE_ALL?1:SAMPLE_EVERY,s=__stack();let m=__S.get(k);if(!m)__S.set(k,m=new Map());m.set(s,(m.get(s)??0)+w);}
  return f.apply(this,a);};};
${names.map(([n,file])=>`${n}=__w(${JSON.stringify(file+':'+n)},${n},${JSON.stringify(n.replace(/\d+$/,''))});`).join('\n')}
}
`;
 const out=bundle.replace(/\.mjs$/,'.count.mjs');
 writeFileSync(out,text+wrap);
 return out;
}
