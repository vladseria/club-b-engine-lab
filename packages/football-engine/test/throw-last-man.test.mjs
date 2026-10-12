import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

// A throw-in on the right for side 0 (attacking x = 48); one runner is deep.
// Defending rebuild (2026-10-03): there is no separate "last man" job any
// more. The deepest runner, ahead of the ball near our box, is a man who
// matters: he has an owner, who stands goal-side of him; the thrower cannot be
// tackled, so his man waits at the legal distance, goal-side.
function throwScene(){
 const players=practicePlayers(fixture),poses=[[4,0],[33,14.4],[41,-3],[36,5],[30,-6],[46,0],[39,-1],[35,8],[36,3],[31,-4]];
 players.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0}));
 const owner=players[1],ball={x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'loose'};
 let plan=null;
 for(let k=0;k<3;k++)plan=coordinateFootball(players,ball,0,fixture.teams.map(t=>t.tactics),laneRisk,{time:10+k*.25,recoveredAt:-10,restart:{spot:{x:owner.x,y:owner.y},radius:2.8}},plan);
 return {players,plan};
}
test('at a throw-in the deepest runner has his own defender, goal-side of him',()=>{
 const {players,plan}=throwScene(),runner=players[2];
 const marker=[...plan.marks].find(([,t])=>t===runner.id)?.[0];
 assert(marker,'the deepest runner is owned');
 assert.equal(players.find(p=>p.id===marker).side,1);
 const j=plan.jobs[marker];assert.equal(j.purpose,'mark');
 assert(j.aim.x>runner.x+.5,`goal-side of the runner (${j.aim.x.toFixed(2)} vs ${runner.x})`);
 assert.equal([...plan.marks.values()].filter(t=>t===runner.id).length,1,'by one defender');
 assert.equal(Object.values(plan.jobs).filter(j=>j.purpose==='last-man').length,0,'no last-man job');
});
test('the thrower cannot be tackled: his defender waits at the legal distance, goal-side; nobody covers',()=>{
 const {players,plan}=throwScene(),thrower=players[1];
 const p=plan.defense?.presser;assert(p,'the thrower has a defender');
 const j=plan.jobs[p];const d=Math.hypot(j.aim.x-thrower.x,j.aim.y-thrower.y);
 assert(d>2.8&&d<4,`at the legal distance (${d.toFixed(2)} m)`);assert(j.aim.x>thrower.x,'goal-side');
 assert.equal(plan.defense.coverer,'');
});
