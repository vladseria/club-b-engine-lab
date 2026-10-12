// R3 (engine truthfulness review round, 2026-10-01): play has purpose, not
// just safety. Style credits and pressure credits must never let a "safe"
// pass beat a good shot or dribble; patient still means patient build-up.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,practiceOptions} from '../dist/practice.js';
import {approachOptions,teamApproaches} from '../dist/team-approach.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
const best=(options,pred)=>Math.max(-9,...options.filter(pred).map(o=>o.score));
const toGoal=(p,v)=>Math.hypot((p.side===0?48:0)-v.x,v.y);
const back=(p,o)=>(o.kind==='pass'||o.kind==='through'||o.kind==='loft')&&toGoal(p,o.aim)-toGoal(p,p)>-1;

// A recorded moment (R3 diagnosis, seed 0 Balanced v Counter, 547.95 s:
// Balanced's attacker within 16 m with a shot of quality 0.48, a defender
// close): on build 5d3051aa (and on arm A) he recycled the ball with P ~ 1.
const moment=JSON.parse(readFileSync(new URL('./r3-shot-on-moment-scene.json',import.meta.url)));
const recorded=()=>{
 const players=practicePlayers(structuredClone(moment.fixture));
 for(const [id,x,y,vx,vy] of moment.pos){const q=players.find(r=>r.id===id);if(q)Object.assign(q,{x,y,vx,vy,energy:90,angle:Math.hypot(vx,vy)>.3?Math.atan2(vy,vx):(q.side===0?0:Math.PI)});}
 const p=players.find(q=>q.id===moment.carrier);
 return {players,p,tactics:moment.fixture.teams[p.side].tactics};
};
test('P1+P2: near goal a real shot beats a sideways reset paid for escaping pressure',()=>{
 const {players,p,tactics}=recorded();
 const options=approachOptions(p,practiceOptions(p,players,new Set(),'',moment.held,null,moment.time),tactics,players);
 const shot=best(options,o=>o.kind==='shoot'),reset=best(options,o=>back(p,o));
 assert.ok(shot>reset,`shot ${shot.toFixed(3)} vs reset ${reset.toFixed(3)}`);
});
// The owner's 14:24 moment (Balanced v Short, seed 4, 1-2-1): Short's #4, 10
// m from the goal centre with a shot of quality 0.39 and a defender 1.4 m
// away, passed to #3 near the corner flag (recorded pass 0.815, shot 0.595).
const watched=JSON.parse(readFileSync(new URL('./r3-1424-scene.json',import.meta.url)));
const at=scene=>{
 const players=practicePlayers(structuredClone(scene.fixture));
 for(const [id,x,y,vx,vy] of scene.pos){const q=players.find(r=>r.id===id);if(q)Object.assign(q,{x,y,vx,vy,energy:90,angle:Math.hypot(vx,vy)>.3?Math.atan2(vy,vx):(q.side===0?0:Math.PI)});}
 const p=players.find(q=>q.id===scene.carrier);
 return {players,p,tactics:scene.fixture.teams[p.side].tactics};
};
test('P2: in the final third a pass towards the corner is not "advancing"; the 14:24 shot is taken',async()=>{
 const {passAdvance}=await import('../dist/practice-passing.js');
 const {players,p,tactics}=at(watched);
 const toCorner={x:p.side===0?47:1,y:-11.2};
 assert.ok(passAdvance(p,p,toCorner)<0,'towards the byline, away from goal and onto a narrower angle');
 const cutback={x:p.side===0?42:6,y:0};
 assert.ok(passAdvance(p,{x:p.side===0?46:2,y:-8},cutback)>0,'a cutback to the spot advances towards the goal');
 const options=approachOptions(p,practiceOptions(p,players,new Set(),'',watched.held,null,watched.time),tactics,players);
 const shot=best(options,o=>o.kind==='shoot'),pass=best(options,o=>o.kind==='pass'||o.kind==='through'||o.kind==='loft');
 assert.ok(shot>pass+.085,`the shot wins clear of the viability cut (shot ${shot.toFixed(3)}, pass ${pass.toFixed(3)})`);
 // A pass to a receiver with a worse chance is charged when the carrier has a shot on.
 const worse=options.filter(o=>(o.kind==='pass'||o.kind==='through')&&o.delivery).map(o=>o.delivery.shotGain);
 assert.ok(worse.some(g=>g<0),'shotGain goes below 0 with his own shot on');
});
test('P3: a free man behind the ball is a reset, not a prospects credit',async()=>{
 const {passProspects,PROSPECT_BEHIND}=await import('../dist/practice-passing.js');
 const f=structuredClone(fixture),players=practicePlayers(f);
 // Team 0's carrier at 36 m, pressed; a free team-mate level and one 9 m behind.
 place(players,[[4,0],[27,-8],[36,0],[36,-10],[40,6],[46,0],[37.5,1],[42,4],[41,-4],[44,8]]);
 const p=players[2],level=players[3],behind=players[1];
 assert.ok(passProspects(p,p,level,level,players,.6)>0,'the free man level with the ball is credited');
 assert.equal(passProspects(p,p,behind,behind,players,.6),0,`${PROSPECT_BEHIND} m or more behind the ball: nothing`);
});
test('P4: a purpose clock: after a few passes that go nowhere, the team looks for the way through',async()=>{
 const {purposeClock}=await import('../dist/team-approach.js');
 const mixed={progression:'mixed'},patient={progression:'patient'};
 assert.deepEqual([0,1,2,3,4].map(n=>purposeClock({...mixed,recycled:n})),[0,0,.5,1,1]);
 assert.deepEqual([0,1,2,3,4,5].map(n=>purposeClock({...patient,recycled:n})),[0,0,0,.5,1,1],'a patient side circulates one pass longer');
 for(const style of ['balanced','combinations']){
  const {players,p,tactics}=recorded(),t={...tactics,...teamApproaches[style].settings};
  const raw=practiceOptions(p,players,new Set(),'',moment.held,null,moment.time);
  const fresh=approachOptions(p,raw,t,players),late=approachOptions(p,raw,{...t,recycled:5},players);
  assert.ok(best(late,o=>o.kind==='shoot')>best(fresh,o=>o.kind==='shoot'),`${style}: the shot gains`);
  const resets=o=>back(p,o)&&(o.relief??0)>0;
  if(fresh.some(resets))assert.ok(best(late,resets)<best(fresh,resets),`${style}: a reset paid for relief loses`);
 }
});
test('P1: in our own half a pass that takes the pressure off is still worth it',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f);
 // Team 0's centre-back pressed at 10 m, a free full-back option 8 m back and wide.
 place(players,[[3,0],[10,-2],[18,-10],[6,-10],[24,6],[46,0],[11.5,-1],[20,4],[26,-4],[30,5]]);
 const p=players[1];
 const options=practiceOptions(p,players,new Set(),'',.4,null,50);
 const reset=options.filter(o=>o.target===players[3].id&&o.kind==='pass').sort((a,b)=>b.score-a.score)[0];
 assert.ok(reset&&(reset.relief??0)>.02,`the reset still carries its relief (${reset?.relief})`);
});
