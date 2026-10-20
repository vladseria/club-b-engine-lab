// (engine as data, 2026-10-21) Line, Press and Progression are looked up in style.ts by their value with no default,
// so a missing or unknown one would throw mid-match; the entrance refuses it first, naming the side, the field and the
// value. Plays no match: every refusal happens before the simulation, and the complete input is only built.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSimulationRequest,runMatch,runTraining,createTrainingSetup} from '../dist/index.js';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
const EXPECTED={line:'deep, standard or high',press:'selective, balanced or aggressive',progression:'patient, mixed or direct'};
const without=(side,field,value)=>{const f=structuredClone(fixture);if(value===undefined)delete f.teams[side].tactics[field];else f.teams[side].tactics[field]=value;return f;};
const exact=s=>new RegExp('^'+s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');

test('a side missing line, press or progression is refused at the entrance, naming the side, the field and the value',()=>{
 for(const field of Object.keys(EXPECTED))for(const [side,name] of [[0,'home'],[1,'away']]){
  const message=exact(`Invalid tactics: ${name}.${field} is undefined (expected ${EXPECTED[field]})`);
  assert.throws(()=>createSimulationRequest({kind:'match',fixture:without(side,field),durationSeconds:20}),{message});
  assert.throws(()=>runMatch({fixture:without(side,field),durationSeconds:20}),{message});
  assert.throws(()=>runTraining({fixture:without(side,field),setup:createTrainingSetup('middle'),durationSeconds:20}),{message});
 }
 assert.throws(()=>runMatch({fixture:without(1,'press','high'),durationSeconds:20}),{message:'Invalid tactics: away.press is "high" (expected selective, balanced or aggressive)'});
});

test('a complete input is unaffected: the request builds, tactics as given; optional fields may still be missing',()=>{
 const request=createSimulationRequest({kind:'match',fixture:structuredClone(fixture),durationSeconds:20});
 assert.deepEqual(request.input.fixture,fixture);
 // the away side in fixture.json has no striker, transition, onLoss, marking or fullbacks: those keep their defaults
 for(const k of ['striker','transition','onLoss','marking','fullbacks'])assert.equal(k in fixture.teams[1].tactics,false);
 assert.doesNotThrow(()=>createSimulationRequest({kind:'training',fixture:structuredClone(fixture),setup:createTrainingSetup('middle'),durationSeconds:20}));
});
