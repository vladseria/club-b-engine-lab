// The substitution run's seed sweep (lane C, 2026-10-21): order t on seeds 1-20, one 120 s match each, for two tired
// thresholds: 40 matches, so on the public lab only, after `scene-sweep.mjs --build` has transpiled src to dist (--build
// needs esbuild, which the lab installs; on the laptop `npm test` builds dist with tsc instead). It refuses to run
// unless LAB=1 is set, so nobody plays 40 matches on a laptop by accident:
//   LAB=1 node packages/football-engine/test/scene-sweep-matches.mjs [--rows]
import {mkdirSync,appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
if(process.env.LAB!=='1'){console.error('scene-sweep-matches plays 40 matches: public lab only (set LAB=1 there).');process.exit(2);}
const {runMatch}=await import('../dist/index.js');
const {SWEEP,withBench,subOrders}=await import('./constructed-scenes.mjs');
const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),rows=[];
for(const tired of [99.5,99.9]){
 let hits=0;const perSeed={};
 for(const seed of SWEEP){
  const r=runMatch({fixture:withBench(seed),durationSeconds:120,substitutionOrders:subOrders(tired)}).result,note=r.substitutionNotes.find(n=>n.order==='t');
  perSeed[seed]=note.status==='made'?`made at ${note.time.toFixed(1)} s`:'no';if(note.status==='made')hits++;
 }
 const row={scene:'substitution run, 120 s match',moment:`order t (van tired under ${tired}) is made`,hits,n:SWEEP.length,propertyFailures:0,perSeed};
 rows.push(row);console.log(JSON.stringify(row));
}
if(process.argv.includes('--rows')){const dir=path.join(pkg,'evidence/2026-10-21-lane-c/results');mkdirSync(dir,{recursive:true});for(const r of rows)appendFileSync(path.join(dir,'sweep.jsonl'),JSON.stringify({...r,arch:process.arch})+'\n');}
