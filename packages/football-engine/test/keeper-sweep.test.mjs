import test from 'node:test';
import assert from 'node:assert/strict';
import {keeperSweepReach,keeperSweepDepth,keeperSweepNeed} from '../dist/practice-keeper.js';

test('every keeper may sweep; the trait sets how eager he is, not whether he comes',()=>{
 const line=keeperSweepReach(.08),usual=keeperSweepReach(.2),sweeper=keeperSweepReach(.9);
 assert.ok(line.margin<0&&line.range>8,'a keeper who stays on his line still comes for a ball he clearly reaches first, around his area');
 assert.ok(line.margin<usual.margin&&usual.margin<sweeper.margin,'a sweeper needs less of a head start');
 assert.ok(line.range<usual.range&&usual.range<sweeper.range,'a sweeper goes further from his goal');
 assert.equal(keeperSweepDepth(.2,30,false),0,'the default trait stands where keepers always stood');
 assert.ok(keeperSweepDepth(.9,30,false)>2&&keeperSweepDepth(.08,30,false)<0,'a sweeper stands higher, a line keeper deeper');
 assert.equal(keeperSweepDepth(.9,8,false),0,'with the ball near his goal the setting does not move him');
});

test('B3: a ball into the space behind his defence, a stay-at-home keeper comes only when he reads he is first; a sweeper when he reads it level',()=>{
 const line=keeperSweepNeed(.08),own=keeperSweepNeed(.11),usual=keeperSweepNeed(.2),sweeper=keeperSweepNeed(.9);
 assert.ok(line>0&&own>0&&usual>0,'a keeper who stays at home (or the default habit) wants to be first by a margin');
 assert.ok(line<.2,'... but not by a fixed head start he almost never has (it was 0.34-0.44 s on a ground ball)');
 assert.ok(sweeper<0,'a sweeper comes when he reads he gets there level with the attacker');
 assert.ok(line>usual&&usual>sweeper,'the more of a sweeper, the less sure he must be');
});
