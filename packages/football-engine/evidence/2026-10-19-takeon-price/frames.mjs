// Take-on price, eyes-on: frames.ts on the laptop (two matches: the same match off and on), MATCHES=2 node frames.mjs r.MEN-INT 1
// Hook: the step-0 anchor plus the carry plan, read-only. Writes results/frames-<arm>-<seed>.json.gz.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
import {CHOICE} from '../2026-10-19-world-prices/hook.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const local=!process.env.SHARD_TOTAL&&!process.env.GITHUB_ACTIONS;
if(local&&Number(process.env.MATCHES)!==2)throw Error('MATCHES=2: this plays one match twice (off, on)');
// lab: node frames.mjs <arm> <seed> [<arm> <seed> ...], one pair per shard (task i on shard i % SHARD_TOTAL)
const args=process.argv.slice(2),pairs=[];for(let i=0;i<args.length;i+=2)pairs.push([args[i],args[i+1]]);
const mine=local?pairs.slice(0,1):pairs.filter((_,i)=>i%Number(process.env.SHARD_TOTAL)===Number(process.env.SHARD_INDEX));
const hook={name:'frames',setup(b){b.onLoad({filter:/[\\/]practice\.ts$/},a=>{
 let src=readFileSync(a.path,'utf8');if(src.split(CHOICE).length!==2)throw Error('anchor');
 return {contents:src.replace(CHOICE,CHOICE+"(globalThis as any).__f0?.(time,p,option,restartChoice??available,players,feintMemory.get(p.id),restart?restart.kind:'',carryPlan);"),loader:'ts'};
});}};
const out=path.join(here,'results');mkdirSync(out,{recursive:true});
const b=(await bundleRevs({entry:path.join(here,'frames.ts'),revs:parseRevs('base=working'),outDir:out,extraPlugins:[hook],tag:'fr'})).base;
const sideDir=path.join(here,'../2026-10-09-scenarios/sides'),sums=JSON.parse(readFileSync(path.join(sideDir,'CHECKSUMS.json'),'utf8')).files,sides={};
for(const f of Object.keys(sums)){const txt=readFileSync(path.join(sideDir,f),'utf8');if(createHash('md5').update(txt).digest('hex')!==sums[f].md5)throw Error(f);sides[f.split('.')[0]]=JSON.parse(txt);}
const m=await import(pathToFileURL(b).href);m.init(sides);
for(const [arm,seed] of mine){
 const r=m.trace({arm,seed:Number(seed)});
 const f=path.join(out,`frames-${arm}-${seed}.json.gz`);writeFileSync(f,gzipSync(JSON.stringify(r)));
 for(const k of ['off','on'])console.log(`${arm}:${seed} ${k}: score ${r[k].score} feints ${r[k].feints} beaten ${r[k].beaten}; decisions with a feint ${r[k].rows.length}`);
 console.log(f);
}
