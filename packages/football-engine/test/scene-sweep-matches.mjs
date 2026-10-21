// The substitution run's seed sweep (lane C, 2026-10-21): order t on seeds 1-20, one 120 s match each, for two tired
// thresholds: 40 matches, so on the public lab only, after scene-sweep.mjs --build has transpiled src to dist.
//   node packages/football-engine/test/scene-sweep-matches.mjs [--rows]
import {mkdirSync,appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runMatch} from '../dist/index.js';
import {SWEEP,withBench,subOrders} from './constructed-scenes.mjs';
const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),rows=[];
for(const tired of [99.5,99.9]){
 let hits=0;const when=[];
 for(const seed of SWEEP){
  const r=runMatch({fixture:withBench(seed),durationSeconds:120,substitutionOrders:subOrders(tired)}).result,note=r.substitutionNotes.find(n=>n.order==='t');
  if(note.status==='made'){hits++;when.push(+note.time.toFixed(1));}
 }
 const row={scene:'substitution run, 120 s match',moment:`order t (van tired under ${tired}) is made`,hits,n:SWEEP.length,propertyFailures:0,note:`made at ${when.join(', ')} s`};
 rows.push(row);console.log(JSON.stringify(row));
}
if(process.argv.includes('--rows')){const dir=path.join(pkg,'evidence/2026-10-21-lane-c/results');mkdirSync(dir,{recursive:true});for(const r of rows)appendFileSync(path.join(dir,'sweep.jsonl'),JSON.stringify({...r,arch:process.arch})+'\n');}
