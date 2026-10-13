import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMatch,teamApproaches,defensiveApproaches} from '../dist/index.js';
import {advanceFlight} from '../dist/practice-flight.js';
const fixture=JSON.parse(readFileSync(new URL('./feint-release-scene.json',import.meta.url))).fixture;
// Live restart setups (2026-09-29) change the old 13009 passage; 13028 is the
// first later seed whose 100 s again includes a goal after an opponent's touch.
// Styles choosing which pass rather than whether to pass (2026-09-30) changed
// it; 13040 is the next such seed (evidence/2026-09-30-which-pass-release/repin.mjs).
// Acceleration fatigue (2026-09-30) changed it again; 13049 is the next such
// seed (evidence/2026-09-30-balance-v3/repin.mjs). The last man after throw-ins
// (2026-09-30) changed it; 13058 is the next such seed (same repin.mjs; 13051
// has one, but a first-time shot's traced velocity there is 1 ulp off). Keepers
// sweeping by forecast arrival (same day) changed it; 13077 is the next such seed.
// Keepers holding shots at the body, soft wide parries and decisive clearing
// (same day) changed it; 13090 is the next such seed (same repin.mjs). Box
// arrivals offered by position, not role label (2026-10-01), changed it;
// 13102 is the next such seed; marking anchored to the defender's shape slot
// (same day) changed it again; 13105 is the next. Short passes led to where a
// moving receiver will be (same day) changed it; 13107 is the next (same repin.mjs).
// Wingers holding the lane Width asks for (2026-10-01, B2) changed it; 13147
// is the next; the block reacting to the attackers in its zones (same day)
// changed it again; 13164 is the next; passers valuing what the receiver can
// do next (same day) changed it; 13197 was the next; crediting only what a
// pass adds, in the attacking zones, changed it; 13201 was the next; the
// counter-press after a loss (2026-10-01, B3) changed it; 13223 is the next
// such seed whose shot traces are also exact (13203 has the goal, but a
// first-time shot's traced velocity is 1 ulp off, as at 13051;
// evidence/2026-10-01-b3-losing-the-ball/repin.mjs shotTrace); the B3b
// transition builds (2026-10-01) changed it; 13230 is the next
// (evidence/2026-10-01-b3b-transitions/repin.mjs shotTrace); B4's defending
// near goal (2026-10-01) changed it; 13269 was the next
// (evidence/2026-10-01-b4-defending-near-goal/repin.mjs shotTrace); R1's
// Counter-only team flip (2026-10-01) changed it; 13297 was the next; Bodies
// forward as a priced preference (same round) changed it; 13318 was the next
// (evidence/2026-10-01-r1-agency/repin.mjs shotTrace); R2+R3's individual
// reads and purpose over safety (2026-10-01) changed it; 13350 was the next
// (evidence/2026-10-01-r2r3-reads-and-purpose/repin.mjs shotTrace; 13330 has
// the goal but no shot); silly moments' touches and through-ball weight
// (2026-10-01) changed it; 13371 was the next
// (evidence/2026-10-01-silly-moments/repin.mjs shotTrace); the combined style
// build (silly moments, M1 Line, M2/M3, Pivot and the third man; 2026-10-01)
// changed it; 13362 is the next (same tool, from 13350). The behaviour round
// (2026-10-03) changed it; 13369 is the next
// (evidence/2026-10-03-behaviour-round/repin.mjs shotTrace). The defending
// round (2026-10-03: everyone keeps a man) changed it; 13370 is the next
// The defending rebuild (2026-10-03) changed it; 13374 is the next
// (evidence/2026-10-03-defending-build/repin.mjs shotTrace). The defending-close
// round (2026-10-04) changed it; 13384 is the next with a goal after an
// opponent touch (evidence/2026-10-04-defending-close/repin.mjs ownTouch).
// The step-across round (2026-10-04) changed it; 13385 is the next
// (evidence/2026-10-04-stepacross-giveaways/repin.mjs shotTrace). The
// settings-truth round (2026-10-04) changed it; 13425 is the next
// (evidence/2026-10-04-settings-truth/repin.mjs shotTrace). The passing-and-control
// round (2026-10-10) changed it; 13458 is the next
// (evidence/2026-10-10-passing-control/repin.mjs shotTrace). The tiredness
// round (2026-10-10: the sprint reserve) changed it; 13466 is the next
// (evidence/2026-10-10-tiredness/repin.mjs shotTrace). The matchups-combined
// build (2026-10-10) changed it; 13472 is the next
// (evidence/2026-10-10-matchups-combined/repin.mjs shotTrace); with movement
// intensity merged in, 13491 is the next (same repin.mjs shotTrace). The threat-defending round
// (2026-10-10) changed it; 13494 is the next (evidence/2026-10-10-threat-defending/repin.mjs shotTrace).
// The final matchups-combined build (2026-10-11: threat defending + honest run timing) changed it; 13517 is
// the next (same repin.mjs shotTrace). The tiredness bite (2026-10-11) changed it; 13551 is the next
// (evidence/2026-10-11-tiredness-bite-build/repin.mjs shotTrace). (The regain fixes, built before the tiredness
// bite, moved it from 13517 to 13549: evidence/2026-10-11-regain-fixes/repin.mjs shotTrace.) The combined build
// with the collect read and the regain fixes (70c5f925) changed it; 13555 is the next
// (evidence/2026-10-11-collect-read/repin.mjs shotTrace). Track the runner (2026-10-11: runs read from their
// start) changed it; 13559 is the next (evidence/2026-10-11-track-runner/repin.mjs shotTrace). Its wider skill
// range (a run read 0.1-0.8 s ahead by reading) changed it; 13574 is the next (same repin.mjs shotTrace). The
// pre-push fixes (2026-10-12: a carrier meets a man in his path; an outlet steps off a marker who beats the ball)
// changed it; 13578 is the next (evidence/2026-10-12-prepush-fixes/repin.mjs shotTrace). Box defending (2026-10-12:
// markers near goal step into the open shot lane, a set blocker's leg) changed it; 13591 is the next
// (evidence/2026-10-12-box-defending/repin.mjs shotTrace). The combined build with stamina as lasting (b0174c30,
// 2026-10-13) changed it again; searching from 13578, 13590 is the next (same repin.mjs shotTrace). The keeper upgrade
// and the keeper with the ball in his hands (2026-10-13) changed it; searching from 13591, 13671 is the next
// (evidence/2026-10-13-keeper-2/repin.mjs shotTrace; 13630 before he could jog anywhere in his area with it).
fixture.seed=13671;fixture.teams[0].lineup[1]='motanescu';Object.assign(fixture.teams[0].tactics,teamApproaches.balanced.settings);Object.assign(fixture.teams[1].tactics,defensiveApproaches.press.tactics);
const result=runMatch({fixture,durationSeconds:100}).result;

test('goal events identify the beneficiary even when an opponent made the last touch',()=>{
 const goals=result.events.filter(e=>e.kind==='goal'),credited=[0,0];
 assert(goals.some(e=>result.players.find(p=>p.id===e.lastTouch).side!==e.side),'Regression includes a goal after an opponent touch');
 for(const e of goals){
  assert.equal(e.lastTouch,e.actor,'Last-touch identity remains available without asserting scorer attribution');
  const before=result.frames.findLast(f=>f.time<e.time),after=result.frames.findLast(f=>f.time<=e.time);
  assert.equal(after.score[e.side]-(before?.score[e.side]??0),1);credited[e.side]++;
 }
 assert.deepEqual(credited,result.score);assert.deepEqual(credited,result.stats.map(s=>s.goals));
});

test('shot traces describe the actual released ball rather than a selected but unexecuted plan',()=>{
 const shots=result.events.filter(e=>e.kind==='shot');assert(shots.length);
 for(const e of shots){
  assert(e.shot);const frame=result.frames.findLast(f=>f.time<=e.time),s=e.shot;
  assert.equal(frame.time,e.time);assert.equal(frame.ball.mode,'shot');
  if(e.firstTime||e.technique){
   // Swept contact occurs inside the tick. The replay frame is later than the
   // actual launch; verify the foot/contact and the physical flight between.
   const contact=result.controlContacts.find(c=>c.kind==='shot'&&c.actor===e.actor&&c.technique===e.technique&&e.time-c.time>=0&&e.time-c.time<1/60);
   assert(contact);assert.equal(s.origin.x,contact.x);assert.equal(s.origin.y,contact.y);
   assert.equal(s.velocity.vx,contact.outgoing.x);assert.equal(s.velocity.vy,contact.outgoing.y);
   const flight={...s.origin,...s.velocity,owner:null,mode:'shot'};advanceFlight(flight,e.time-contact.time);
   for(const key of ['x','y','z','vx','vy','vz'])assert(Math.abs(flight[key]-frame.ball[key])<1e-8,`Launched ${key} must explain the replay frame`);
  }else{
   assert.deepEqual(s.origin,{x:frame.ball.x,y:frame.ball.y,z:frame.ball.z});
   assert.deepEqual(s.velocity,{vx:frame.ball.vx,vy:frame.ball.vy,vz:frame.ball.vz});
  }
  if(!e.technique&&!e.freeKick){assert(s.assessment);assert.deepEqual(s.aim,s.assessment.aim);}
  else assert.equal(s.assessment,undefined,'Do not label headers/volleys/free kicks with the ordinary foot-shot heuristic');
 }
});
