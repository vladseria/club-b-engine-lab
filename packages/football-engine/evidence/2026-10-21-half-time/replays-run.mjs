// Plays the watching review's six matches (replays.ts) and writes one row per match to results/replays.jsonl.
// Bundles with esbuild (as _ci/revs.mjs does), so it runs on the public lab:
//   node packages/football-engine/evidence/_ci/cloud.mjs --repo vladseria/club-b-engine-lab --shards 1 --workers 1 --timeout 30 \
//     --into packages/football-engine/evidence/2026-10-21-half-time/results/replays.jsonl \
//     --command "node packages/football-engine/evidence/2026-10-21-half-time/replays-run.mjs"
// More than 4 matches: never on the laptop (it refuses without the lab's environment).
import {build} from 'esbuild';
import {appendFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

if(!process.env.GITHUB_ACTIONS&&!process.env.SHARD_TOTAL)throw Error('six matches: run this on the public lab (_ci/cloud.mjs), not on the laptop');
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(mkdtempSync(path.join(tmpdir(),'ht-')),'replays.mjs');
await build({entryPoints:[path.join(here,'replays.ts')],bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
const mod=await import(pathToFileURL(out).href);
mkdirSync(path.join(here,'results'),{recursive:true});
for(const row of mod.runReplays())appendFileSync(path.join(here,'results','replays.jsonl'),JSON.stringify({...row,plat:`${process.platform}-${process.arch}-node${process.versions.node}`})+'\n');
