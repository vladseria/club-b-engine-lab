// The app's match-playing vitest suites on the public lab (README.md "App test suites").
// Runs on a lab runner from the repo root of an app-test snapshot (tag a-<sha12>):
//
//   node packages/football-engine/evidence/_ci/app-tests.mjs [--suites a,b] [--plan]
//
// Every suite is one unit, except gp-board-truth, which is split into one unit per test
// (`-t <title>` with GP_TRUTH_NOFILL=1, so a unit plays only the configurations its test asks
// for; matches are a pure function of the engine build and the job, so a claim reads the same
// matches as in a whole-file run). Units go to shards by estimated seconds (WEIGHT, longest
// first onto the least loaded shard). A shard runs its plain suites in one vitest call
// (--maxWorkers SIM_WORKERS) and then each board-truth unit on its own (that suite runs its
// own worker pool: min(8, cpus - 2) threads).
//
// Writes, under packages/football-engine/evidence/_ci/results/app/:
//   shard-<i>.jsonl   one row per suite and unit: status, timing, counts, failing tests
//   <unit>.json       vitest's JSON report;  <unit>.log  its console output (claims, logs)
// Test failures are results, not errors: the process exits 0 once every unit has reported,
// and non-zero only when a unit produced no report at all.
//
// From code: import {SUITES,summarize} from './app-tests.mjs';
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync,createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The suites that play matches (the laptop match guard's rule, .claude/hooks/laptop-match-guard.mjs:
// the test file or a local file it imports calls runMatch / simulatePractice / runSimulation /
// computeMatch). 22 of the 46 in verificare/ on 2026-10-19. A new one needs adding here, and its
// fixtures need a line in public-sync.mjs APP_DATA (the export refuses a path it does not list).
export const SUITES=['ballers-approach','ballers-board-trim','ballers-chances','ballers-idea-run','ballers-lab',
 'ballers-match-settings','ballers-orders-squad13','ballers-p5','ballers-pipeline','ballers-practice-tally',
 'ballers-routines','ballers-save','ballers-starters','ballers-stats','ballers-sub-moments','ballers-voice',
 'gp-board-truth','gp-wp2-clips','gp-wp2','gp-wp3','gp-wp4','gp-wp5','ballers-plan-switch-match','ballers-half-time-compact'];
const SPLIT='gp-board-truth';
// Tests that cannot run on the lab, by suite: [title substring, why]. Each is reported as "not on the lab".
export const LAB_SKIPS={
 'ballers-pipeline':[['compute route','imports app/api/ballers/compute/route.ts (the server route: Next.js and the database RPC client), which is not exported']],
};
// Seconds per unit on the lab (arm64, 4 vCPU), as measured on main cf18fbf7 (run 39244464858, 2026-10-19): file time
// (tests plus collection) for plain suites, wall for the board-truth units on their own pool. A missing unit counts 30.
export const WEIGHT={
 'ballers-approach':75,'ballers-board-trim':5,'ballers-chances':20,'ballers-idea-run':35,'ballers-lab':15,
 'ballers-match-settings':250,'ballers-orders-squad13':5,'ballers-p5':30,'ballers-pipeline':10,'ballers-practice-tally':5,
 'ballers-routines':5,'ballers-save':5,'ballers-starters':70,'ballers-stats':5,'ballers-sub-moments':5,'ballers-voice':15,
 'gp-wp2-clips':5,'gp-wp2':10,'gp-wp3':5,'gp-wp4':25,'gp-wp5':5,'ballers-plan-switch-match':20,'ballers-half-time-compact':5,
 'gp-board-truth#0':10,'gp-board-truth#1':230,'gp-board-truth#2':295,'gp-board-truth#3':370,'gp-board-truth#4':240,
 'gp-board-truth#5':225,'gp-board-truth#6':235,'gp-board-truth#7':235,'gp-board-truth#8':230,'gp-board-truth#9':235,
 'gp-board-truth#10':30,'gp-board-truth#*':240,
};

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../../..');
export const OUT_REL='packages/football-engine/evidence/_ci/results/app';
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** The `it(` titles of a suite, in file order (for the split suite). */
function titles(suite){
 const src=readFileSync(path.join(root,'verificare',`${suite}.test.ts`),'utf8');
 return [...src.matchAll(/^\s*it\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,/gm)].map(m=>m[2].replace(/\\(.)/g,'$1'));
}
/** Every unit: {id, suite, title?, weight}. */
export function units(suites=SUITES){
 const out=[];
 for(const s of suites){
  if(s!==SPLIT){out.push({id:s,suite:s,weight:WEIGHT[s]??30});continue;}
  titles(s).forEach((t,i)=>out.push({id:`${s}#${i}`,suite:s,title:t,weight:WEIGHT[`${s}#${i}`]??WEIGHT[`${s}#*`]??240}));
 }
 return out;
}
/** Shard plans: longest unit first onto the shard that would finish first. Plain units share `workers` cores. */
export function plan(list,shards,workers){
 // a vitest call's plain files share the workers, but one file runs on one worker: max(longest, sum / workers)
 const bins=Array.from({length:shards},()=>({plain:0,longest:0,solo:0,units:[]}));
 const cost=(b,u)=>{const solo=b.solo+(u?.title?u.weight:0),sum=b.plain+(u&&!u.title?u.weight:0),longest=Math.max(b.longest,u&&!u.title?u.weight:0);return Math.max(longest,sum/workers)+solo;};
 for(const u of [...list].sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id))){
  const b=bins.reduce((best,x)=>cost(x,u)<cost(best,u)?x:best);
  if(u.title)b.solo+=u.weight;else{b.plain+=u.weight;b.longest=Math.max(b.longest,u.weight);}b.units.push(u);
 }
 return bins.map(b=>({est:Math.round(cost(b)),units:b.units}));
}

/** Run vitest once; resolves {code, report|null, ms}. */
function vitest(files,{label,t,vars={},workers},outDir){
 const json=path.join(outDir,`${label}.json`),log=path.join(outDir,`${label}.log`);
 const args=['node_modules/vitest/vitest.mjs','run',...files.map(s=>`verificare/${s}.test.ts`),
  '--reporter=verbose','--reporter=json',`--outputFile.json=${json}`,`--maxWorkers=${workers}`,...(t?['-t',t]:[])];
 return new Promise(res=>{
  const start=Date.now(),sink=createWriteStream(log);
  sink.write(`$ ${args.join(' ')}\n${Object.entries(vars).map(([k,v])=>`${k}=${v}`).join(' ')}\n\n`);
  const p=spawn(process.execPath,args,{cwd:root,env:Object.assign({},process.env,vars,{CI:'1',FORCE_COLOR:'0'}),stdio:['ignore','pipe','pipe']});
  for(const s of [p.stdout,p.stderr])s.on('data',d=>{process.stdout.write(d);sink.write(d);});
  p.on('close',code=>{sink.end();let report=null;try{report=JSON.parse(readFileSync(json,'utf8'));}catch{}res({code,report,ms:Date.now()-start});});
 });
}
const clip=s=>String(s??'').replace(/\u001b\[[0-9;]*m/g,'').slice(0,1500);

/** One row per suite in a vitest report. */
function rows(report,{unit,shard,ms,code,suites}){
 const out=[];
 for(const s of suites){
  const f=report?.testResults?.find(r=>r.name.endsWith(`/verificare/${s}.test.ts`));
  if(!f){out.push({suite:s,unit,shard,status:'no-report',code,ms,passed:0,failed:0,skipped:0,tests:[],error:report?'file missing from the report':'vitest wrote no report'});continue;}
  const a=f.assertionResults??[];
  const n=k=>a.filter(x=>x.status===k).length;
  out.push({suite:s,unit,shard,status:f.status,code,ms:f.endTime&&f.startTime?f.endTime-f.startTime:ms,
   passed:n('passed'),failed:n('failed'),skipped:a.length-n('passed')-n('failed'),
   tests:a.map(x=>({name:[...(x.ancestorTitles??[]),x.title].join(' > '),status:x.status,ms:Math.round(x.duration??0),...(x.status==='failed'?{failure:clip((x.failureMessages??[]).join('\n'))}:{})})),
   ...(f.message?{error:clip(f.message)}:{})});
 }
 return out;
}

/** Merge rows (from every shard) into one verdict per suite: {suite, status, ms, passed, failed, skippedTests (it.skip/todo, or a split test no unit ran), labSkipped, failures}. */
export function summarize(allRows){
 const by=new Map();
 for(const r of allRows){if(!by.has(r.suite))by.set(r.suite,[]);by.get(r.suite).push(r);}
 const out=[];
 for(const [suite,rs] of by){
  const tests=new Map();let err=null,ms=0;
  for(const r of rs){
   ms+=r.ms??0;if(r.error&&!r.tests.length)err=r.error;
   for(const t of r.tests){const prev=tests.get(t.name);if(!prev||prev.status==='skipped'||prev.status==='pending')tests.set(t.name,t);}
  }
  const skips=(LAB_SKIPS[suite]??[]).map(([s])=>s);
  const list=[...tests.values()];
  const labSkipped=list.filter(t=>t.status!=='passed'&&t.status!=='failed'&&skips.some(s=>t.name.includes(s))).map(t=>t.name);
  const skippedTests=list.filter(t=>t.status!=='passed'&&t.status!=='failed'&&!skips.some(s=>t.name.includes(s))).map(t=>t.name);
  const failures=list.filter(t=>t.status==='failed').map(t=>({name:t.name,failure:t.failure}));
  const passed=list.filter(t=>t.status==='passed').length;
  const status=err&&!list.length?'error':failures.length?'fail':'pass';
  out.push({suite,status,ms,passed,failed:failures.length,skippedTests,labSkipped,failures,...(err?{error:err}:{})});
 }
 return out.sort((a,b)=>SUITES.indexOf(a.suite)-SUITES.indexOf(b.suite));
}

// ---------------------------------------------------------------- CLI (on a lab runner)
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);
 const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
 const suites=arg('suites')?arg('suites').split(',').map(s=>s.trim().replace(/\.test\.ts$/,'').replace(/^verificare\//,'')).filter(Boolean):SUITES;
 for(const s of suites)if(!SUITES.includes(s))throw Error(`unknown suite ${s} (known: ${SUITES.join(' ')})`);
 const shard=Number(process.env.SHARD_INDEX??0),total=Number(process.env.SHARD_TOTAL??1),workers=Math.max(1,Number(process.env.SIM_WORKERS??2));
 const plans=plan(units(suites),total,workers);
 if(argv.includes('--plan')){plans.forEach((p,i)=>console.log(`shard ${i}: ~${p.est}s  ${p.units.map(u=>u.id).join(' ')}`));process.exit(0);}
 const mine=plans[shard]??{units:[],est:0};
 console.log(`[app-tests] shard ${shard}/${total}, ${workers} workers, ~${mine.est}s estimated: ${mine.units.map(u=>u.id).join(' ')||'(nothing)'}`);
 const outDir=path.join(root,OUT_REL);mkdirSync(outDir,{recursive:true});
 const rowsFile=path.join(outDir,`shard-${shard}.jsonl`),out=[];
 const skipPattern=s=>{const k=LAB_SKIPS[s];return k?`^(?!.*(${k.map(([x])=>esc(x)).join('|')}))`:null;};
 // plain suites: one call per distinct skip pattern (-t applies to every file of a call)
 const plain=mine.units.filter(u=>!u.title).map(u=>u.suite);
 const groups=new Map();for(const s of plain){const k=skipPattern(s)??'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);}
 let g=0;
 for(const [t,files] of groups){
  const label=`shard-${shard}-plain-${g++}`;
  const r=await vitest(files,{label,t:t||undefined,workers},outDir);
  out.push(...rows(r.report,{unit:label,shard,ms:r.ms,code:r.code,suites:files}));
 }
 for(const u of mine.units.filter(u=>u.title)){
  const label=u.id.replace('#','-');
  const r=await vitest([u.suite],{label,t:esc(u.title),vars:{GP_TRUTH_NOFILL:'1'},workers:1},outDir);
  out.push(...rows(r.report,{unit:u.id,shard,ms:r.ms,code:r.code,suites:[u.suite]}));
 }
 writeFileSync(rowsFile,out.map(r=>JSON.stringify(r)).join('\n')+(out.length?'\n':''));
 for(const r of summarize(out))console.log(`[app-tests] ${r.suite}: ${r.status} (${r.passed} passed, ${r.failed} failed, ${(r.ms/1000).toFixed(0)} s)`);
 const missing=out.filter(r=>r.status==='no-report');
 if(missing.length){console.error(`[app-tests] no report for: ${missing.map(r=>r.suite).join(' ')}`);process.exit(1);}
}

/** Read every shard-*.jsonl under dir (recursively). */
export function readRows(dir){
 const rows=[];
 const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/^shard-\d+\.jsonl$/.test(e.name))for(const l of readFileSync(p,'utf8').split('\n'))if(l)rows.push(JSON.parse(l));}};
 if(existsSync(dir))walk(dir);
 return rows;
}
