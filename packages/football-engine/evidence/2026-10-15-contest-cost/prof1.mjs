// Contest cost (2026-10-15): play one match from a bundle in this process (cost.mjs runs it under node --cpu-prof) and
// print the row as the last line of stdout.   node --cpu-prof prof1.mjs <bundle.mjs> '<task json>'
import {pathToFileURL} from 'node:url';
const [bundle,json]=process.argv.slice(2);
const t=JSON.parse(json);
const m=await import(pathToFileURL(bundle).href);
const row=m.play({label:t.label,arm:t.base,seed:t.seed,rev:t.var});
process.stdout.write(JSON.stringify({score:row.score,stats:row.stats,ms:row.ms})+'\n');
