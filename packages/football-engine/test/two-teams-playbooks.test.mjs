import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runMatch,runTraining} from '../dist/index.js';
import {defaultPlans} from '../dist/practice-playbook.js';
import {bothStarts} from './constructed-scenes.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
test('one-team playbook remains identical through the multi-team API',()=>{
 const common={fixture,durationSeconds:45},playbook={side:0,plans:defaultPlans(),adaptive:true};
 assert.deepEqual(runMatch({...common,playbook}).result,runMatch({...common,playbooks:[playbook]}).result);
});
// (Lane C, 2026-10-21) The same situation for each team: the training start with side 0's #3 just recovering the ball,
// and its mirror image with side 1's #3 on it. A team chooses an idea when it wins the ball, so each start makes its own
// team choose at once. Before, both checks played 240 s from kickoff (durations raised four times since 2026-10-01 so
// that side 0's first idea fitted inside) and the single-playbook check 140 s (raised three times).
// (seed sweep: each team chooses one of its own ideas from its start on 20 of 20 seeds)
const [home,away]=bothStarts();
const playbooks=[0,1].map(side=>({side,adaptive:true,plans:defaultPlans().map(p=>({...p,id:`team-${side}-${p.id}`,name:`Team ${side} ${p.name}`}))}));
const both=[home,away].map(setup=>runTraining({fixture,setup,durationSeconds:10,playbooks}).result);
test('both teams pursue their own playbooks; duplicate sides are rejected',()=>{
 // If this fails: one club's ideas never run in a match where both managers drew some, or run for the wrong club.
 // Enough: each team gets the ball at the start of one run, the moment it chooses an idea.
 for(const side of [0,1])assert(both[side].playbookSelections.some(s=>s.planId?.startsWith(`team-${side}-`)),`side ${side} chooses one of its own ideas`);
 assert.throws(()=>runMatch({fixture,playbooks:[playbooks[0],playbooks[0]]}),/side/);
 assert.throws(()=>runMatch({fixture,playbook:playbooks[0],playbooks}),/Choose/);
});
test('every playbook selection names the side whose playbook made it',()=>{
 // If this fails: the replay and the owner-only idea list attribute an idea to the wrong club.
 // Enough: both runs carry both teams' playbooks, and each team chooses in one of them.
 for(const r of both)for(const s of r.playbookSelections){
  assert([0,1].includes(s.side),'selection carries a side');
  if(s.planId!==null)assert(s.planId.startsWith(`team-${s.side}-`),`${s.planId} tagged side ${s.side}`);
  for(const c of s.candidates)assert(c.id.startsWith(`team-${s.side}-`),`candidate ${c.id} tagged side ${s.side}`);
 }
 // A single playbook, including the legacy singular API, reports its configured side.
 for(const input of [{playbook:playbooks[1]},{playbooks:[playbooks[1]]}]){
  const one=runTraining({fixture,setup:away,durationSeconds:10,...input}).result;
  assert(one.playbookSelections.some(s=>s.planId!==null));
  assert(one.playbookSelections.every(s=>s.side===1));
 }
});
