// Runner for trace.ts: one match on this tree (MATCHES=1 required; a laptop trace).
//   MATCHES=1 node trace.mjs e.base 0 [rev] [--raw results/local/raw.json] > results/local/trace-base-0.json
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),rawAt=args.indexOf('--raw'),rawPath=rawAt>=0?args.splice(rawAt,2)[1]:null;
const [arm='e.base',seed='0',rev='working']=args;
if(!process.env.SHARD_TOTAL&&Number(process.env.MATCHES)!==1)throw Error('MATCHES=1 required (one match per trace)');
const sideDir=path.join(here,'../2026-10-09-scenarios/sides'),sums=JSON.parse(readFileSync(path.join(sideDir,'CHECKSUMS.json'),'utf8')).files,sides={};
for(const f of Object.keys(sums)){const txt=readFileSync(path.join(sideDir,f),'utf8');if(createHash('md5').update(txt).digest('hex')!==sums[f].md5)throw Error(f+' md5');sides[f.split('.')[0]]=JSON.parse(txt);}
const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
const b=(await bundleRevs({entry:path.join(here,'trace.ts'),revs:parseRevs('t='+rev),outDir,tag:'trace'})).t;
const m=await import(pathToFileURL(b).href);m.init(sides);
const out=m.trace(arm,Number(seed),!!rawPath);
if(rawPath){writeFileSync(rawPath,JSON.stringify(out.raw));delete out.raw;}
process.stdout.write(JSON.stringify(out));
