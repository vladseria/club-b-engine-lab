// Plays the plan-switch proof (proof.ts) and writes one row to results/proof.jsonl: the chosen seed, every seed tried,
// and both compact replays (with the switch and the twin without it). Bundles with esbuild (as trace-run.mjs), so it
// runs on the public lab:
//   node packages/football-engine/evidence/_ci/cloud.mjs --repo vladseria/club-b-engine-lab --shards 1 --workers 1 --timeout 60 \
//     --into packages/football-engine/evidence/2026-10-21-plan-switch/results/proof.jsonl \
//     --command "node packages/football-engine/evidence/2026-10-21-plan-switch/proof-run.mjs"
// Up to 13 matches (each tried seed one, the chosen seed's twin one more): never on the laptop.
import {build} from 'esbuild';
import {appendFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(mkdtempSync(path.join(tmpdir(),'proof-')),'proof.mjs');
await build({entryPoints:[path.join(here,'proof.ts')],bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
const mod=await import(pathToFileURL(out).href);
const t0=Date.now();
const row=mod.runProof();
mkdirSync(path.join(here,'results'),{recursive:true});
appendFileSync(path.join(here,'results','proof.jsonl'),JSON.stringify({label:'proof',plat:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0,...row})+'\n');
console.log(`proof: seed ${row.seed}; tried ${JSON.stringify(row.tried)}`);
