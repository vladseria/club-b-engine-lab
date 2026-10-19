// Caught kick build, step 0: one traced match (laptop: MATCHES=1).   MATCHES=1 node st0.mjs r.MAL-FDD 1 [rev]
// Read-only bundle-time hooks on practice.ts (each anchor must exist exactly once; every call only passes values the
// engine already holds to a handler on globalThis, a no-op when unset).
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';

const CHOICE='const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);';
const TICK='if(tick%frameStride===0||needsFrame)frame();';
const RELEASE='releaseBy=p.id;releaseAt=time;dispossessed={id:p.id,at:time';
const CHALLENGE='challenge=startChallenge(candidate.p,p,ball,candidate.read,time);';
const once=(src,a,n)=>{if(src.split(a).length!==2)throw Error(n+' anchor not found exactly once');};
export const hook={name:'st0-hook',setup(b){b.onLoad({filter:/[\\/]practice\.ts$/},a=>{
 let src=readFileSync(a.path,'utf8');
 for(const [k,v] of Object.entries({CHOICE,TICK,RELEASE,CHALLENGE}))once(src,v,k);
 src=src.replace(CHOICE,CHOICE+"(globalThis as any).__ch?.(time,p,option,restartChoice??available,restart?restart.kind:'',players,ball);");
 src=src.replace(TICK,'(globalThis as any).__pt?.(time,ball,prepared,players,restart);'+TICK);
 src=src.replace(RELEASE,'(globalThis as any).__rl?.(time,p.id);'+RELEASE);
 src=src.replace(CHALLENGE,CHALLENGE+'(globalThis as any).__cs?.(time,candidate.p,p,prepared);');
 return {contents:src,loader:'ts'};
});}};

const here=path.dirname(fileURLToPath(import.meta.url));
const [arm='r.MAL-FDD',seed='1',rev='working']=process.argv.slice(2);
if(Number(process.env.MATCHES)!==1)throw Error('MATCHES=1 required: this plays one match');
const sideDir=path.join(here,'../2026-10-09-scenarios/sides');
const sums=JSON.parse(readFileSync(path.join(sideDir,'CHECKSUMS.json'),'utf8')).files,sides={};
for(const f of Object.keys(sums)){const txt=readFileSync(path.join(sideDir,f),'utf8');if(createHash('md5').update(txt).digest('hex')!==sums[f].md5)throw Error(f+' md5');sides[f.split('.')[0]]=JSON.parse(txt);}
const outDir=path.join(here,'results/local');mkdirSync(outDir,{recursive:true});
const b=await bundleRevs({entry:path.join(here,'st0.ts'),revs:parseRevs('x='+rev),outDir,extraPlugins:[hook],tag:'st0'});
const m=await import(pathToFileURL(b.x).href);m.init(sides);
const t0=Date.now(),row=m.play({arm,seed:Number(seed)});
const out=path.join(outDir,`st0-${arm}-${seed}-${rev.replace(/\W/g,'')}.json`);
writeFileSync(out,JSON.stringify(row));
console.log(`${arm}:${seed} build ${row.build} score ${row.score} sets ${row.sets.length} ${((Date.now()-t0)/1000).toFixed(0)} s -> ${out}`);
