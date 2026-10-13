import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runMatch,runTraining,createTrainingSetup,LAST_ATTACK_MAX} from '../dist/index.js';
import {simulatePractice} from '../dist/practice.js';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));

// Full time plays out the last attack (owner-approved 12 Oct; practice-match.ts attackAtFullTime).
// A match that ends in an attack is the clock-ended match up to full time, then at most LAST_ATTACK_MAX more;
// training never runs on.
test('a match in an attack at full time plays it out, and only that',()=>{
 const duration=30;let found=null;
 for(let seed=1;seed<=40&&!found;seed++){const r=runMatch({fixture:{...fixture,seed},durationSeconds:duration}).result;if(r.played!==undefined)found={seed,r};}
 assert(found,'some short match ends in an attack');
 const {seed,r}=found,clock=simulatePractice({...fixture,seed},duration,undefined,true,{policy:'coordinated',substitutions:'none'});
 assert.equal(clock.played,undefined);
 assert(r.played>duration&&r.played<=duration+LAST_ATTACK_MAX+1e-9,`whistle at ${r.played}`);
 const before=x=>x.events.filter(e=>e.time<=duration&&e.kind!=='end');
 assert.deepEqual(before(r),before(clock));
 assert.deepEqual(r.frames.filter(f=>f.time<=duration),clock.frames.slice(0,-1)); // the clock-ended match adds only its whistle frame
 assert.equal(r.events.at(-1).kind,'end');assert(r.frames.at(-1).time===r.played);
 assert.equal(runTraining({fixture:{...fixture,seed},setup:createTrainingSetup('middle'),durationSeconds:duration}).result.played,undefined);
});
