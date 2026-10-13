import test from 'node:test';
import assert from 'node:assert/strict';
import {fatigueEnergy,reserveBalance,legs,energyTop} from '../dist/practice-match.js';

// Stamina is how long a player lasts, not a second pace skill (2026-10-12, evidence/2026-10-12-stamina): a fresh
// player's top speed and burst are the same at any stamina; the fitter one keeps them longer. Fifteen minutes of
// a 2 s sprint at top speed every 20 s with 3 m/s jogs between (a stamina-6
// player ends near energy 70, as in a match), a pace-6 outfielder, through the engine's own fatigue functions.
test('fresh legs are the same at any stamina; the fitter player holds them longer',()=>{
 const basePace=4.75+6*.35,dt=1/60;
 const run=stamina=>{
  let energy=100,reserve=1,speed=0;const starts=[];
  for(let tick=0;tick<900*60;tick++){
   const phase=tick%1200;
   if(phase===0){const fit=legs(energy,reserve);starts.push({top:energyTop(energy)*fit.top,acceleration:fit.acceleration});}
   const next=phase<120?basePace*energyTop(energy)*legs(energy,reserve).top:3;
   const a=(next-speed)/dt;speed=next;
   energy=fatigueEnergy(energy,speed,stamina,dt,a,basePace);reserve=reserveBalance(reserve,speed,energy,basePace,dt);
  }
  return starts;
 };
 const low=run(3),high=run(9);
 assert.deepEqual(low[0],high[0]);// kick-off: identical legs
 for(let i=0;i<4;i++){// the first minute: within 1%
  assert.ok(Math.abs(high[i].top/low[i].top-1)<.01&&Math.abs(high[i].acceleration/low[i].acceleration-1)<.01,`sprint ${i}`);
 }
 const last=low.length-1;// the last sprint: the fitter player is clearly sharper
 assert.ok(high[last].top/low[last].top>1.05,`top ${high[last].top} v ${low[last].top}`);
 assert.ok(high[last].acceleration/low[last].acceleration>1.05,`acceleration ${high[last].acceleration} v ${low[last].acceleration}`);
});
