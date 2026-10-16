import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulatePractice} from '../dist/practice.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

// The plan's named taker takes his side's penalties, as he takes its free kicks (lib/ballers/orders.ts setPieces copy).
const penalty=taker=>{
 const f=structuredClone(fixture);f.seed=7;if(taker)f.teams[0].tactics.taker=taker;
 const r=simulatePractice(f,10,undefined,true,{policy:'coordinated',initialRestart:{kind:'penalty',side:0,spot:{x:42,y:0}}});
 const shot=r.events.find(e=>e.kind==='shot');
 return {taker:r.frames[0].restartInfo.taker,shooter:shot?.actor};
};

test('a named outfield taker takes the penalty',()=>{
 // flavius has the side's weakest finishing plus set pieces, so only the name can send him
 const named=penalty('flavius');
 assert.equal(named.taker,'0:flavius');
 assert.equal(named.shooter,'0:flavius');
});

test('with no usable name, the best finisher plus set pieces takes it (never the keeper)',()=>{
 for(const taker of [undefined,'mircea','nobody']){
  const {taker:picked}=penalty(taker);
  assert.equal(picked,'0:golusor',`taker ${taker}`);
 }
});
