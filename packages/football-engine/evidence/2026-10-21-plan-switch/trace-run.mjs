// Plays the formation-switch trace (trace-ps1.ts, ONE match) and writes its lines as one row to
// results/trace-ps1.jsonl. Bundles with esbuild (as _ci/revs.mjs does), so it runs on the public lab:
//   node packages/football-engine/evidence/_ci/cloud.mjs --repo vladseria/club-b-engine-lab --shards 1 --workers 1 \
//     --into packages/football-engine/evidence/2026-10-21-plan-switch/results/trace-ps1.jsonl \
//     --command "node packages/football-engine/evidence/2026-10-21-plan-switch/trace-run.mjs"
import {build} from 'esbuild';
import {appendFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(mkdtempSync(path.join(tmpdir(),'ps1-')),'trace.mjs');
await build({entryPoints:[path.join(here,'trace-ps1.ts')],bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning'});
const mod=await import(pathToFileURL(out).href);
const lines=mod.runTrace();
mkdirSync(path.join(here,'results'),{recursive:true});
appendFileSync(path.join(here,'results','trace-ps1.jsonl'),JSON.stringify({label:'trace-ps1',plat:`${process.platform}-${process.arch}-node${process.versions.node}`,lines})+'\n');
