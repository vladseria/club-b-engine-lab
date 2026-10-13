import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMatch,teamApproaches} from '../dist/index.js';
import {practiceOptions} from '../dist/practice.js';
import {approachOptions} from '../dist/team-approach.js';
import {feintReleaseOpening} from '../dist/practice-feints.js';
const scene=JSON.parse(readFileSync(new URL('./feint-release-scene.json',import.meta.url)));
// Styles choose which pass, not whether to pass (2026-09-30): Direct's forward
// preference no longer lifts the best release above its neutral value, so in
// the recorded scene the through ball to Van is 0.166 over the committed duel,
// short of the 0.18 opening. The opening is tested with Crocodinho trailing
// the run by 4 m (through ball 0.565 against the duel's 0.304).
const opened=structuredClone(scene.players);Object.assign(opened.find(p=>p.id==='0:crocodinho'),{x:22.8});
function alternatives(players){const p=players.find(p=>p.id===scene.actor);return approachOptions(p,practiceOptions(p,players,new Set(players.filter(p=>p.duty==='run').map(p=>p.id))),{progression:'direct'});}

test('a release opened during a real take-on can interrupt it; a defender closing the outlet changes that reading',()=>{
 for(const mirror of [false,true]){
  const ps=structuredClone(opened);
  if(mirror)for(const p of ps)Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,vx:-p.vx,vy:-p.vy,angle:p.angle+Math.PI,lane:-p.lane});
  const before=structuredClone(ps),open=alternatives(ps);
  assert(feintReleaseOpening(scene.original.score,scene.original.target,open));
  assert.deepEqual(ps,before,'Evaluation must not move players or change skills');
  const p=ps.find(p=>p.id===scene.actor),d=ps.find(q=>q.side!==p.side&&q.id!==scene.original.target&&q.role!=='GK'),s=p.side===0?1:-1;
  Object.assign(d,{x:p.x+s,y:p.y+s,vx:0,vy:0});
  assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,alternatives(ps)),false);
 }
});

test('review preserves the purpose of a committed duel and stronger manager preferences',()=>{
 const open=alternatives(opened),bestRelease=Math.max(...open.filter(o=>['pass','through','loft','shoot','clear'].includes(o.kind)).map(o=>o.score));
 const lowRepeat=[{...scene.original,score:0},{kind:'pass',aim:{x:0,y:0},score:scene.original.score,reason:'Comparable outlet'}];
 assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,lowRepeat),false,'A repeat penalty is not a reason to abandon the same attempt');
 const instructed=[...open,{...scene.original,score:bestRelease}];
 assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,instructed),false,'A strong live preference for the duel remains meaningful');
 assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,[...open,...structuredClone(open)]),true,'More variants cannot change the reconsideration threshold');
});

test('live take-on can become a pass before its old timeout without skipping the fake, preparation or foot contact',()=>{
 const fixture=structuredClone(scene.fixture);fixture.seed=2048;fixture.teams[0].lineup[1]='motanescu';Object.assign(fixture.teams[0].tactics,teamApproaches.direct.settings);
 const r=runMatch({fixture,durationSeconds:40}).result;
 // Live restart setups (2026-09-29) changed the seed-2026 passage (Fleasca to
 // Van). The recorded encounter was Crocodinho's take-on at 6.53 s of seed
 // 2028, released to Van. Short passes led to where a moving receiver will be
 // (2026-10-01) changed it: it is now Crocodinho's take-on at 8.833 s of seed
 // 2034, released to Golusor (evidence/2026-09-30-balance-v3/repin.mjs).
 // Wingers holding the lane Width asks for (2026-10-01, B2) changed it: the
 // same seed then had Crocodinho's take-on at 22.583 s, released to Van. The
 // block reacting to the attackers in its zones (same day) changed it: it is
 // now Crocodinho's take-on at 6.600 s of seed 2036, released to Van. The
 // settings round (2026-10-03: Direct's striker on their last line) moved it
 // to seed 2037, the same take-on at 6.600 s released to Van
 // (evidence/2026-10-01-silly-moments/repin.mjs takeon). The defending round
 // (2026-10-03: everyone keeps a man) moved it to seed 2038: Crocodinho's
 // take-on at 6.550 s, released to Golusor
 // (evidence/2026-10-03-defending-build/repin.mjs takeon). The defending
 // rebuild (2026-10-03) moved it to seed 2039: Crocodinho's take-on at 6.600 s,
 // released to Golusor (same repin.mjs takeon). The defending-close round
 // (2026-10-04) moved it to seed 2041: Crocodinho's take-on at 11.450 s,
 // released to Golusor (evidence/2026-10-04-defending-close/repin.mjs takeon).
 // The step-across round (2026-10-04: the passer's own lane read) moved it to
 // seed 2044: Crocodinho's take-on at 22.767 s, released to Golusor at 24.133 s
 // (evidence/2026-10-04-stepacross-giveaways/repin.mjs takeon). The
 // settings-truth round (2026-10-04: line keepers stay home, the spare man's
 // marker takes a free job, Counter-press goes whatever the numbers) moved it to
 // seed 2048: Crocodinho's take-on at 6.500 s, released to Van at 8.133 s
 // (evidence/2026-10-04-settings-truth/repin.mjs takeon).
 const attempt=r.events.find(e=>e.kind==='feint'&&e.actor==='0:crocodinho'&&e.time>6.45&&e.time<6.55);assert(attempt,'Recorded encounter still occurs');
 const player=r.players.findIndex(p=>p.id===attempt.actor),prepare=r.choices.find(c=>c.player===player&&c.kind==='prepare'&&c.action&&c.time>attempt.time);
 const pass=r.events.find(e=>e.kind==='pass'&&e.actor===attempt.actor&&e.time>attempt.time);
 assert(prepare&&pass);assert(prepare.time>=attempt.time+.41,'Fake and initial burst must complete');
 assert(pass.time>prepare.time+.2,'New action must prepare normally');assert(pass.time<attempt.time+1.7,'Release need not wait for the old two-second duel timeout');assert.equal(pass.target,'0:van');
 assert(r.controlContacts.some(c=>c.actor===pass.actor&&c.kind==='pass'&&Math.abs(c.time-pass.time)<1e-6&&c.foot),'Pass requires recorded physical contact');
 assert(r.events.some(e=>e.kind==='receive'&&e.actor===pass.target&&e.time>pass.time&&e.time<pass.time+2));
});
