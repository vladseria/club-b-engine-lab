// Plays the lanes batch (lanes.ts) for this shard's seeds and appends one row per seed to results/lanes.jsonl. Public lab only
// (up to 3 matches per seed, 40 seeds):
//   node packages/football-engine/evidence/_ci/cloud.mjs --repo vladseria/club-b-engine-lab --shards 20 --workers 1 --timeout 60 \
//     --into packages/football-engine/evidence/2026-10-21-plan-switch/results/lanes.jsonl \
//     --command "node packages/football-engine/evidence/2026-10-21-plan-switch/lanes-run.mjs"
import {build} from 'esbuild';
import {appendFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(mkdtempSync(path.join(tmpdir(),'lanes-')),'lanes.mjs');
await build({entryPoints:[path.join(here,'lanes.ts')],bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
const mod=await import(pathToFileURL(out).href);
const index=Number(process.env.SHARD_INDEX??0),total=Number(process.env.SHARD_TOTAL??1);
mkdirSync(path.join(here,'results'),{recursive:true});
for(let seed=1;seed<=mod.MAX_SEED;seed++){
 if((seed-1)%total!==index)continue;
 const t0=Date.now(),row=mod.runSeed(seed);
 appendFileSync(path.join(here,'results','lanes.jsonl'),JSON.stringify({label:'lanes',plat:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0,...row})+'\n');
 console.log(`seed ${seed}: fired ${row.fired}${row.T?' (qualifies)':''} ${Date.now()-t0} ms`);
}
