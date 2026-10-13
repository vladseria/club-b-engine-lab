// Keeper 2 (2026-10-13): copied unchanged from ../2026-10-13-keeper-fix (branch ballers-keeper-fix).
// node trace.mjs [--revs live=working] <arm | sc/<scenario>/<arm>/<opp>> <seed> <from s> <to s> [--kp] [--hook]
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
// trace-only, read-only hook: every carrier choice (the options he weighed and the one taken) reaches trace.ts
const FROM="const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);";
const hookPlugin={name:'kg-hook',setup(b){b.onLoad({filter:/football-engine\/src\/practice\.ts$/},a=>{let src=readFileSync(a.path,'utf8');const n=src.split(FROM).length-1;if(n!==1)throw Error('hook: matched '+n);
 src=src.replace(FROM,()=>FROM+"(globalThis as any).__kgHook?.({time,p,available:restartChoice??available,option,inHands,players});");return {contents:src,loader:'ts'};});}};
const here=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2);const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
const pos=argv.filter((a,i)=>!a.startsWith('--')&&!(i>0&&argv[i-1]==='--revs'));
const [spec,seed,from,to]=pos;
const S=path.join(here,'../2026-10-09-scenarios');
const {SCENARIOS}=await import(pathToFileURL(path.join(S,'scenarios.mjs')).href);
const sides={};
for(const [id,sc] of Object.entries(SCENARIOS))if(sc.source.kind==='sides')sides[id]=[JSON.parse(readFileSync(path.join(S,sc.source.home),'utf8')),JSON.parse(readFileSync(path.join(S,sc.source.away),'utf8'))];
const revs=parseRevs(arg('revs','live=working'));
const bundles=await bundleRevs({entry:path.join(here,'trace.ts'),revs,outDir:path.join(here,'results'),tag:'trace',extraPlugins:[hookPlugin]});
const m=await import(pathToFileURL(Object.values(bundles)[0]).href);m.scenarioInit(sides);
let t;if(spec.startsWith('sc/')){const [,scenario,a,opp]=spec.split('/');t={scenario,arm:a,opp,seed:Number(seed)};}else t={arm:spec,seed:Number(seed)};
const r=m.trace(t,Number(from),Number(to),true);
if(argv.includes('--kp')){for(const k of r.kp)if(['a','b','c','a-out'].includes(k.outcome))console.log(JSON.stringify(k));}
else console.log(r.lines.join('\n'));
