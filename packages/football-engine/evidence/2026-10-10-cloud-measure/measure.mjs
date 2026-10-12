// One cloud command for "live engine v candidate" (2026-10-10): the manager
// scenarios (../2026-10-09-scenarios/run.mjs) and the neutral mirror (run.mjs
// here), baseline and candidate in the same job, every shard taking its share.
//
//   node packages/football-engine/evidence/2026-10-10-cloud-measure/measure.mjs \
//     --label <name> --base <sha> --cand <sha> [--plan focus|focus-lite|breadth|control|smoke] [--dry]
//
// Rows: ../2026-10-09-scenarios/results/<label>.jsonl (scenarios) and
// results/<label>.jsonl here (mirror). Locally it runs everything (≤6 workers);
// in the cloud each shard runs only its tasks. Task j of the plan's whole
// enumeration (every invocation, in order) goes to shard j % SHARD_TOTAL, so
// shards stay level although the plan is several invocations.
// The arithmetic behind the plans (cost, confidence) is in plans() below and
// in the handback of the agent that wrote it; `--dry` prints the counts.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SCENARIOS} from '../2026-10-09-scenarios/scenarios.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf(`--${k}`);return i>=0?argv[i+1]:d;};
const label=arg('label'),base=arg('base'),cand=arg('cand'),planName=arg('plan','focus');
if(!label||!base||!cand){console.error('usage: measure.mjs --label <name> --base <sha> --cand <sha> [--plan focus|focus-lite|breadth|control|smoke] [--dry]');process.exit(2);}
const REVS=2;

// A step is a scenarios block {sc, opp:'stored'|'control', arms, from, count}
// (seeds = the scenario's own main/control range, offset `from`) or a mirror
// block {mirror:[[arms, from, count], ...]}.
const S=id=>SCENARIOS[id];
const PREDICTED={'chior-neo':['lockDoor','huntPress'],'mcb-trs':['stoppers'],'men-mal':['passThrough'],'fdd-int':['shutBreak']};
const CONTROL_PREDICTED={'chior-neo':'lockDoor','mcb-trs':'stoppers','men-mal':'passThrough'};
const ids=Object.keys(SCENARIOS);
const PLANS={
 // ~720 matches. Every setup of every scenario v the stored opponent on 12
 // seeds; the five setups SCENARIOS.md predicts a shift for (and their preps)
 // on 8 more (20); the three style arms on 16 mirror seeds; three +3 skills on 16.
 focus:()=>[
  ...ids.map(id=>({sc:id,opp:'stored',arms:S(id).core,from:0,count:12})),
  ...ids.map(id=>({sc:id,opp:'stored',arms:['prep',...PREDICTED[id]],from:12,count:8})),
  {mirror:[[['di0','sh0','co0'],0,16],[['p-pace','p-reading','p-strength'],0,16]]},
 ],
 // 624 matches: focus without the skill arms, for a candidate that costs more per match.
 'focus-lite':()=>PLANS.focus().map(st=>st.mirror?{mirror:st.mirror.filter(([arms])=>!arms[0].startsWith('p-'))}:st),
 // ~650 matches. Every setup v the stored opponent on 12 seeds and v the
 // control on 6; the style arms on 12 mirror seeds; no skill arms.
 breadth:()=>[
  ...ids.map(id=>({sc:id,opp:'stored',arms:S(id).core,from:0,count:12})),
  ...ids.map(id=>({sc:id,opp:'control',arms:S(id).core,from:0,count:6})),
  {mirror:[[['di0','sh0','co0'],0,12]]},
 ],
 // ~290 matches (the reserve): the three control predictions, prep and setup on 24 seeds each.
 control:()=>Object.entries(CONTROL_PREDICTED).map(([id,a])=>({sc:id,opp:'control',arms:['prep',a],from:0,count:24})),
 // 4 matches: pipeline check (one scenario match and one mirror match, both revisions).
 smoke:()=>[{sc:'mcb-trs',opp:'stored',arms:['prep'],from:0,count:1},{mirror:[[['co0'],0,1]]}],
};
if(!PLANS[planName]){console.error('unknown plan '+planName);process.exit(2);}
const steps=PLANS[planName]();
const countOf=st=>REVS*(st.mirror?st.mirror.reduce((a,[arms,,n])=>a+arms.length*n,0):st.arms.length*st.count);
const total=steps.reduce((a,s)=>a+countOf(s),0);
const scen=steps.filter(s=>!s.mirror).reduce((a,s)=>a+countOf(s),0);
console.log(`plan ${planName}: ${total} matches (${scen} scenario, ${total-scen} mirror), base=${base} cand=${cand}`);
if(argv.includes('--dry')){for(const s of steps)console.log(' ',countOf(s),s.mirror?`mirror ${s.mirror.map(([a,f,n])=>`${a.join(',')}:${f}-${f+n-1}`).join(' ')}`:`${s.sc} ${s.opp} ${s.arms.join(',')} seeds +${s.from}..+${s.from+s.count-1}`);process.exit(0);}

const T=Number(process.env.SHARD_TOTAL||1),I=Number(process.env.SHARD_INDEX||0);
const revs=`base=${base},cand=${cand}`;
let offset=0,failed=0;
for(const st of steps){
 let cmd;
 if(st.mirror)cmd=[path.join(here,'run.mjs'),'--label',label,'--revs',revs,...st.mirror.map(([arms,f,n])=>`${arms.join(',')}:${f}-${f+n-1}`)];
 else{
  const sc=S(st.sc),from=(st.opp==='stored'?sc.seeds.main:sc.seeds.control)+st.from;
  cmd=[path.join(repo,'packages/football-engine/evidence/2026-10-09-scenarios/run.mjs'),'--label',label,'--plan','full','--scenarios',st.sc,'--opp',st.opp,'--arms',st.arms.join(','),'--seeds',`${from}-${from+st.count-1}`,'--revs',revs];
 }
 // rotate this shard's index by the tasks already dealt, so task j of the whole plan lands on shard j % T
 const env={...process.env,SHARD_INDEX:String(((I-offset)%T+T)%T),SHARD_TOTAL:String(T)};
 const r=spawnSync(process.execPath,cmd,{cwd:repo,env,stdio:'inherit'});
 if(r.status!==0)failed++;
 offset+=countOf(st);
}
if(failed){console.error(`${failed} step(s) failed`);process.exitCode=1;}
