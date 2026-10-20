import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMatch,teamApproaches} from '../dist/index.js';
import {practiceOptions} from '../dist/practice.js';
import {approachOptions} from '../dist/team-approach.js';
import {feintReleaseOpening,TAKEON_PRICE} from '../dist/practice-feints.js';
const scene=JSON.parse(readFileSync(new URL('./feint-release-scene.json',import.meta.url)));
// Styles choose which pass, not whether to pass (2026-09-30): Direct's forward
// preference no longer lifts the best release above its neutral value, so in
// the recorded scene the through ball to Van is 0.166 over the committed duel,
// short of the 0.18 opening. The opening is tested with Crocodinho trailing
// the run by 4 m (through ball 0.565 against the duel's 0.304).
const opened=structuredClone(scene.players);Object.assign(opened.find(p=>p.id==='0:crocodinho'),{x:22.8});
// The take-on price (2026-10-19) values this duel for what beating Motanescu gets Fleasca, a shot from 12.5 m with
// their keeper set for it and Motanescu recovering after the fake (0.241, the live score 0.284), short of the through
// ball's 0.551 by more than the 0.18 margin: the release opens under either price.
function alternatives(players,priced=false){const was=TAKEON_PRICE.on;TAKEON_PRICE.on=priced;try{const p=players.find(p=>p.id===scene.actor);return approachOptions(p,practiceOptions(p,players,new Set(players.filter(p=>p.duty==='run').map(p=>p.id))),{progression:'direct'});}finally{TAKEON_PRICE.on=was;}}

// Honest reads 2/3 (4dd77eb1) read the lane from where the carrier's momentum takes him by the kick, which carried
// him through the still defender this test stands 1.4 m ahead of him (through ball 0.58, risk 0). Since the pre-push
// fixes (2026-10-12, carrierMeets) he meets a man standing in his path before he kicks, and the defender closes the
// opening again (through ball -0.20), as he does moving with the carrier or standing beyond his projected spot.
test('a release opened during a real take-on can interrupt it; a defender closing the outlet changes that reading',()=>{
 for(const priced of [false,true])for(const mirror of [false,true]){
  const ps=structuredClone(opened);
  if(mirror)for(const p of ps)Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,vx:-p.vx,vy:-p.vy,angle:p.angle+Math.PI,lane:-p.lane});
  const before=structuredClone(ps),open=alternatives(ps,priced);
  assert(feintReleaseOpening(scene.original.score,scene.original.target,open));
  assert.deepEqual(ps,before,'Evaluation must not move players or change skills');
  const p=ps.find(p=>p.id===scene.actor),d=ps.find(q=>q.side!==p.side&&q.id!==scene.original.target&&q.role!=='GK'),s=p.side===0?1:-1;
  Object.assign(d,{x:p.x+s,y:p.y+s,vx:0,vy:0});
  assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,alternatives(ps,priced)),false);
 }
});

test('review preserves the purpose of a committed duel and stronger manager preferences',()=>{
 // The live rule (the score he committed with stands against the release): read with the price off.
 const was=TAKEON_PRICE.on;TAKEON_PRICE.on=false;try{
 const open=alternatives(opened),bestRelease=Math.max(...open.filter(o=>['pass','through','loft','shoot','clear'].includes(o.kind)).map(o=>o.score));
 const lowRepeat=[{...scene.original,score:0},{kind:'pass',aim:{x:0,y:0},score:scene.original.score,reason:'Comparable outlet'}];
 assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,lowRepeat),false,'A repeat penalty is not a reason to abandon the same attempt');
 const instructed=[...open,{...scene.original,score:bestRelease}];
 assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,instructed),false,'A strong live preference for the duel remains meaningful');
 assert.equal(feintReleaseOpening(scene.original.score,scene.original.target,[...open,...structuredClone(open)]),true,'More variants cannot change the reconsideration threshold');
 }finally{TAKEON_PRICE.on=was;}
});

test('priced, the release is weighed against carrying on as it reads now, not the score he committed with',()=>{
 // (take-on price, round 4) the review reads the take-on without the repeat memory, so the current take-on on the same
 // man is what carrying on is worth; once he is past the man, the best carry is.
 const open=alternatives(opened,true),release=Math.max(...open.filter(o=>['pass','through','loft','shoot','clear'].includes(o.kind)).map(o=>o.score));
 const carry=Math.max(...open.filter(o=>o.kind==='carry').map(o=>o.score)),noDuel=open.filter(o=>o.kind!=='feint');
 assert.equal(feintReleaseOpening(release+5,scene.original.target,noDuel),release>carry+.18,'past the man: against the best carry, whatever he committed with');
 assert.equal(feintReleaseOpening(0,scene.original.target,[...noDuel,{...scene.original,score:release}]),false,'a take-on on the same man worth as much as the release keeps him on it');
});

test('live take-on can become a pass before its old timeout without skipping the fake, preparation or foot contact',()=>{
 const fixture=structuredClone(scene.fixture);fixture.seed=2119;fixture.teams[0].lineup[1]='motanescu';Object.assign(fixture.teams[0].tactics,teamApproaches.direct.settings);
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
 // (evidence/2026-10-04-settings-truth/repin.mjs takeon). The passing-and-control
 // round (2026-10-10) moved it to seed 2051: Crocodinho's take-on at 10.367 s,
 // released to Golusor at 11.133 s (evidence/2026-10-10-passing-control/repin.mjs takeon). The honest-reads
 // round (2026-10-10) moved it within the same seed: Crocodinho's take-on at 6.600 s, released to Golusor at
 // 7.883 s (evidence/2026-10-10-honest-reads/repin.mjs takeon). The matchups-combined build (2026-10-10) moved it
 // to seed 2063: Crocodinho's take-on at 8.183 s, released to Golusor at 9.283 s
 // (evidence/2026-10-10-matchups-combined/repin.mjs takeonGolusor). With movement intensity merged in, it moved
 // to seed 2066: Crocodinho's take-on at 6.617 s, released to Golusor at 8.067 s (same repin.mjs takeonGolusor).
 // The final matchups-combined build (2026-10-11: threat defending + honest run timing) moved it to seed 2070:
 // Crocodinho's take-on at 37.083 s, released to Golusor at 38.117 s
 // (evidence/2026-10-10-threat-defending/repin.mjs takeonGolusor). The tiredness bite, regain fixes, collect read
 // and track-the-runner rounds (2026-10-11, combined build 1fbc1cf8) moved it to seed 2074: Crocodinho's take-on
 // at 35.367 s, released to Golusor at 36.850 s (evidence/2026-10-11-track-runner/repin.mjs takeonGolusor). The pre-push
 // fixes (2026-10-12: a carrier meets a man in his path before he kicks; an outlet steps off a marker who beats the
 // ball) moved it to seed 2093: Crocodinho's take-on at 34.583 s, released to Golusor at 35.883 s
 // (evidence/2026-10-12-prepush-fixes/repin.mjs takeonGolusor). Stamina as lasting (2026-10-12: the sprint reserve the
 // same at any stamina, its threshold following today's legs) moved it to seed 2095: Crocodinho's take-on at 8.217 s,
 // released to Golusor at 9.667 s (evidence/2026-10-12-stamina/repin.mjs takeonGolusor). The combined build with box
 // defending (b0174c30) keeps it there (evidence/2026-10-12-box-defending/repin.mjs takeonGolusor from 2093). The striker
 // outlet round (2026-10-17: a player left behind the play hurries back into it) moved it to seed 2114: Crocodinho's
 // take-on at 25.817 s, released to Golusor at 27.450 s (evidence/2026-10-14-r1/repin.mjs takeonGolusor from 2095).
 // Release 3 (2026-10-16) moved it to seed 2117: Crocodinho's take-on at 6.500 s, released to Golusor at 8.083 s
 // (evidence/2026-10-16-release-3/repin.mjs takeonGolusor from 2114, public lab).
 // The take-on price (2026-10-19, round 4) moved it to seed 2119: Crocodinho's take-on at 20.817 s, released to Golusor at
 // 21.883 s (evidence/2026-10-19-takeon-price/repin.mjs takeonGolusor 2117-2236, public lab).
 const attempt=r.events.find(e=>e.kind==='feint'&&e.actor==='0:crocodinho'&&e.time>20.77&&e.time<20.87);assert(attempt,'Recorded encounter still occurs');
 const player=r.players.findIndex(p=>p.id===attempt.actor),prepare=r.choices.find(c=>c.player===player&&c.kind==='prepare'&&c.action&&c.time>attempt.time);
 const pass=r.events.find(e=>e.kind==='pass'&&e.actor===attempt.actor&&e.time>attempt.time);
 assert(prepare&&pass);assert(prepare.time>=attempt.time+.41,'Fake and initial burst must complete');
 assert(pass.time>prepare.time+.2,'New action must prepare normally');assert(pass.time<attempt.time+1.7,'Release need not wait for the old two-second duel timeout');assert.equal(pass.target,'0:golusor');
 assert(r.controlContacts.some(c=>c.actor===pass.actor&&c.kind==='pass'&&Math.abs(c.time-pass.time)<1e-6&&c.foot),'Pass requires recorded physical contact');
 assert(r.events.some(e=>e.kind==='receive'&&e.actor===pass.target&&e.time>pass.time&&e.time<pass.time+2));
});
