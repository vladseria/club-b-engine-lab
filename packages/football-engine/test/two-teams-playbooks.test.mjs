import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runMatch} from '../dist/index.js';
import {defaultPlans} from '../dist/practice-playbook.js';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
test('one-team playbook remains identical through the multi-team API',()=>{
 const common={fixture,durationSeconds:45},playbook={side:0,plans:defaultPlans(),adaptive:true};
 assert.deepEqual(runMatch({...common,playbook}).result,runMatch({...common,playbooks:[playbook]}).result);
});
// A seeded passage: side 0's first idea came inside 90 s until a loss was
// priced by the rest defence behind the ball (2026-10-01, B3); it now comes at
// 215 s, so both two-team checks play 240 s.
const TWO_TEAMS=240;
test('both teams pursue their own playbooks; duplicate sides are rejected',()=>{
 const playbooks=[0,1].map(side=>({side,adaptive:true,plans:defaultPlans().map(p=>({...p,id:`team-${side}-${p.id}`,name:`Team ${side} ${p.name}`}))}));
 const r=runMatch({fixture,durationSeconds:TWO_TEAMS,playbooks}).result;
 for(const side of [0,1])assert(r.playbookSelections.some(s=>s.planId?.startsWith(`team-${side}-`)),`side ${side} has selections`);
 assert.throws(()=>runMatch({fixture,playbooks:[playbooks[0],playbooks[0]]}),/side/);
 assert.throws(()=>runMatch({fixture,playbook:playbooks[0],playbooks}),/Choose/);
});
test('every playbook selection names the side whose playbook made it',()=>{
 const playbooks=[0,1].map(side=>({side,adaptive:true,plans:defaultPlans().map(p=>({...p,id:`team-${side}-${p.id}`,name:`Team ${side} ${p.name}`}))}));
 const r=runMatch({fixture,durationSeconds:TWO_TEAMS,playbooks}).result;
 for(const s of r.playbookSelections){
  assert([0,1].includes(s.side),'selection carries a side');
  if(s.planId!==null)assert(s.planId.startsWith(`team-${s.side}-`),`${s.planId} tagged side ${s.side}`);
  for(const c of s.candidates)assert(c.id.startsWith(`team-${s.side}-`),`candidate ${c.id} tagged side ${s.side}`);
 }
 for(const side of [0,1])assert(r.playbookSelections.some(s=>s.side===side&&s.planId!==null),`side ${side} selected a plan`);
 // A single playbook, including the legacy singular API, reports its configured side.
 const away={...playbooks[1]};
 // A seeded passage: the away side's first idea came inside 45 s until
 // passers valued what the receiver can do next (2026-10-01, B2); it now
 // comes at 63.7 s, so the single-playbook check plays 75 s. The final
 // matchups-combined build (2026-10-11: threat defending + honest run timing)
 // moved it to 77.1 s, so it plays 90 s. The regain fixes (2026-10-11) moved it
 // to 125.6 s, so it plays 140 s.
 for(const input of [{playbook:away},{playbooks:[away]}]){
  const one=runMatch({fixture,durationSeconds:140,...input}).result;
  assert(one.playbookSelections.length>0);
  assert(one.playbookSelections.every(s=>s.side===1));
 }
});
