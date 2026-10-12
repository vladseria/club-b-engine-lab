import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {practicePlayers,runMatch} from '../dist/index.js';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
test('five-a-side shapes change actual player responsibilities and run from kickoff',()=>{
 const expected={'1-2-1':['GK','CB','W','W','ST'],'2-2':['GK','CB','CB','W','W'],'2-1-1':['GK','CB','CB','CM','ST']};
 for(const [formation,roles] of Object.entries(expected)){
  const f=structuredClone(fixture);f.teams[0].tactics.formation=formation;
  const players=practicePlayers(f).filter(p=>p.side===0);assert.deepEqual(players.map(p=>p.role),roles);
  const run=runMatch({fixture:f,durationSeconds:20});assert(!run.input.setup);assert.equal(run.result.events[0].kind,'start');assert(run.result.frames.every(f=>f.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
 }
 const invalid=structuredClone(fixture);invalid.teams[0].tactics.formation='4-3-3';assert.throws(()=>practicePlayers(invalid),/five-a-side/);
});
