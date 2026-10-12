// Step 1 before any cloud measurement: a laptop compute preflight.
// Plays the same full 900 s scenario matches on both revisions, interleaved
// (base and candidate of one spec run side by side on 2 workers, so both see
// the same load), and compares mean ms per match.
//
//   node packages/football-engine/evidence/2026-10-10-cloud-measure/preflight.mjs --base <sha> --cand <sha> [--pairs 3] [--plan focus]
//
// Prints mean ms per revision, the ratio cand/base, and the cloud minutes the
// plan would cost at that ratio (0.40-0.47 billed min a match on arm64 for
// today's engine, plus ~1 min a shard of setup and round-up, plus the
// planning job). Exit code 3 = STOP: the candidate is >= 1.5x as expensive,
// do not dispatch before the owner decides. Rows are git-ignored
// (../2026-10-09-scenarios/results/smoke-preflight-*.jsonl).
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
const base=arg('base'),cand=arg('cand'),pairs=Number(arg('pairs',3)),plan=arg('plan','focus'),shards=Number(arg('shards',20));
if(!base||!cand){console.error('usage: preflight.mjs --base <sha> --cand <sha> [--pairs 3] [--plan focus]');process.exit(2);}
const scen=['chior-neo','mcb-trs','men-mal','fdd-int'].slice(0,Math.max(1,Math.min(4,pairs)));
const label=`smoke-preflight-${Date.now().toString(36)}`;
const env={...process.env};delete env.SHARD_INDEX;delete env.SHARD_TOTAL;delete env.SIM_WORKERS;
const r=spawnSync(process.execPath,[path.join(repo,'packages/football-engine/evidence/2026-10-09-scenarios/run.mjs'),'--label',label,'--plan','smoke','--scenarios',scen.join(','),'--revs',`base=${base},cand=${cand}`,'--workers','2'],{cwd:repo,env,stdio:'inherit'});
if(r.status!==0){console.error('preflight matches failed');process.exit(1);}
const rows=readFileSync(path.join(repo,'packages/football-engine/evidence/2026-10-09-scenarios/results',`${label}.jsonl`),'utf8').trim().split('\n').map(JSON.parse);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const ms={base:rows.filter(x=>x.rev==='base').map(x=>x.ms),cand:rows.filter(x=>x.rev==='cand').map(x=>x.ms)};
for(const x of rows)console.log(`  ${x.scenario.padEnd(10)} ${x.rev.padEnd(5)} build ${x.build} ${String(x.ms).padStart(6)} ms  ${x.score.join('-')}`);
const ratio=mean(ms.cand)/mean(ms.base);
// per-pair ratios too: one slow outlier should be visible, not averaged away
const per=scen.map(s=>{const b=rows.find(x=>x.scenario===s&&x.rev==='base'),c=rows.find(x=>x.scenario===s&&x.rev==='cand');return c.ms/b.ms;});
console.log(`\nmean ms: base ${mean(ms.base).toFixed(0)} (n ${ms.base.length}), cand ${mean(ms.cand).toFixed(0)} (n ${ms.cand.length}); ratio cand/base ${ratio.toFixed(2)} (per pair ${per.map(v=>v.toFixed(2)).join(', ')})`);

const dry=spawnSync(process.execPath,[path.join(here,'measure.mjs'),'--label','x','--base',base,'--cand',cand,'--plan',plan,'--dry'],{cwd:repo,encoding:'utf8'});
const total=Number((dry.stdout.match(/: (\d+) matches/)||[])[1]);
if(total){
 const half=total/2,overhead=shards+1;
 const at=perMatch=>half*perMatch+half*perMatch*ratio+overhead;
 console.log(`plan ${plan}: ${total} matches (${half} per revision) -> about ${at(0.40).toFixed(0)}-${at(0.47).toFixed(0)} billed minutes at this ratio (today's engine alone: ${(total*0.40+overhead).toFixed(0)}-${(total*0.47+overhead).toFixed(0)})`);
}
if(ratio>=1.5){console.log(`\nSTOP: the candidate costs ${ratio.toFixed(2)}x the live engine per match (>= 1.5x). Do not dispatch; report to the owner.`);process.exit(3);}
console.log('\nOK to dispatch (ratio < 1.5).');
