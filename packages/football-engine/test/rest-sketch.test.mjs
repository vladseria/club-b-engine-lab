// Rest-defence sketch (2026-10-15, evidence/2026-10-15-rest-sketch; test switches Tactics.leaveUp and
// Tactics.restDefence). Lean checks of what the switches are for; without them nothing changes (the cloud parity rows
// prove that for whole matches). Team 0 attacks the goal at x = 48, team 1 defends it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {restRisk,REST_RISK} from '../dist/practice-rest-defence.js';
import {L} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
// team 0's carrier 18 m from team 1's goal with two team-mates ahead of the ball and one back; team 1's striker left
// upfield of the ball (x 24), its other three goal-side
const scene=(t0={},t1={},at=[[4,0],[16,0],[33,-7],[36,6],[30,0],[46,0],[38,0],[34,-5],[37,4],[24,2]],looks=6)=>{
 const f=structuredClone(fixture);
 f.teams[0].tactics={...f.teams[0].tactics,...t0};f.teams[1].tactics={...f.teams[1].tactics,...t1};
 const players=practicePlayers(f);place(players,at);
 const tactics=f.teams.map(t=>t.tactics),carrier=players[4];
 const ball={x:carrier.x,y:carrier.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:carrier.id};
 let v=null;for(let k=0;k<looks;k++)v=coordinateFootball(players,ball,0,tactics,laneRisk,{time:20+k*.25,recoveredAt:-10},v);
 return {jobs:v.jobs,players};
};

test('Leave a man up, always: a spare defender stays high as the outlet; without the switch nobody does',()=>{
 const s=scene({},{leaveUp:'always'}),up=s.players.filter(p=>p.side===1&&s.jobs[p.id]?.purpose==='up');
 assert.equal(up.length,1,'one man stays up');
 const aim=s.jobs[up[0].id].aim,ballDepth=L-30;
 assert.ok(L-aim.x>=ballDepth+8,`he stands well upfield of the ball (${(L-aim.x).toFixed(1)} m from his goal, the ball ${ballDepth} m)`);
 for(const t of [undefined,'no']){
  const plain=scene({},t?{leaveUp:t}:{});
  assert.ok(!plain.players.some(p=>plain.jobs[p.id]?.purpose==='up'),`nobody up with leaveUp ${t}`);
 }
 assert.deepEqual(scene({},{leaveUp:'no'}).jobs,scene().jobs,"'no' is exactly today's behaviour");
});

test('Rest defence as a risk attitude: the turnover price settles the edges',()=>{
 // a ball 34 m out in an established attack; their men up are placed nearer our goal than the ball
 const f=structuredClone(fixture),players=practicePlayers(f);
 const at=up=>[[4,0],[20,0],[38,-6],[40,6],[34,0],[46,0],...[[22,-3],[22,3],[42,0],[44,4]].map((p,i)=>i<up?p:[40+i,0])];
 const price=(attitude,up)=>{place(players,at(up));return restRisk({...f.teams[0].tactics,restDefence:attitude},players[4],players);};
 assert.equal(restRisk(f.teams[0].tactics,players[4],players),undefined,'no switch, no price: Bodies forward as before');
 for(const up of [0,1,2]){
  const [safe,even,bold]=['safe','even','bold'].map(a=>price(a,up));
  assert.ok(safe(0)>even(0)&&even(0)>bold(0),`${up} up: safe weighs the counter more than even, even more than bold`);
  assert.ok(Math.abs(safe(1)/even(1)-REST_RISK.safe)<1e-9);
 }
 // what one more man behind the ball buys: the first against two of theirs up buys more than the balance man against
 // nobody (who may step into the attack), and the third man back buys less than the first (the attack is not stripped)
 const gain=(p,r)=>p(r)-p(r+1),none=price('even',0),two=price('even',2);
 assert.ok(gain(two,0)>gain(none,0),'a man back matters more with two of theirs up');
 assert.ok(gain(two,2)<gain(two,0),'each man back buys less than the one before');
});

test('Rest defence follows their man up: an even side guards him, and leaves him once he is no longer up',()=>{
 // team 1's striker left up 14 m from team 0's goal, the ball 34 m out; team 0's ordinary jobs are all forward
 const at=[[4,0],[30,-8],[38,-6],[40,6],[34,0],[46,0],[44,0],[42,-5],[43,4],[14,2]];
 const s=scene({restDefence:'even'},{},at),guard=s.players.find(p=>p.side===0&&s.jobs[p.id]?.purpose==='counter-cover');
 assert.ok(guard,'someone guards the man up');
 assert.ok(s.jobs[guard.id].aim.x<14,`goal-side of him (${s.jobs[guard.id].aim.x.toFixed(1)})`);
 const behind=at.map((p,i)=>i===9?[36,2]:p);
 const t=scene({restDefence:'even'},{},behind);
 assert.ok(!t.players.some(p=>p.side===0&&t.jobs[p.id]?.purpose==='counter-cover'),'nobody guards a man behind the ball');
});
