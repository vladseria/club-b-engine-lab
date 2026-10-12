// Cover-defender round (2026-10-10, evidence/2026-10-10-cover-defender). When
// a team-mate's man is ahead of the ball near our goal and nobody of ours is
// goal-side of him (his marker caught upfield or beaten), the free defender
// drops to a diagonal cover spot: behind the man towards our goal, across his
// line (never in a column behind the marker), close enough to step in. He sees
// it late, by his reading, and steps back up once the marker is goal-side.
// The scene is line.test's: team 1 (2-1-1) defends the goal at x = 48, team
// 0's carrier stands 24 m out unpressed, the striker 9 m out at y = 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {L} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
const G={x:L,y:0},dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const offLine=(p,m)=>{const d=dist(m,G)||1;return Math.abs((p.x-m.x)*(G.y-m.y)-(p.y-m.y)*(G.x-m.x))/d;};
// `cbs`: where team 1's two centre-backs stand; `st`: the striker.
const scene=({cbs=[[34,-4],[34,4]],st=[39,2],reading=10,looks=6,line='deep'}={})=>{
 const f=structuredClone(fixture);
 f.teams[1].tactics={...f.teams[1].tactics,formation:'2-1-1',line,press:'balanced'};
 for(const p of f.teams[1].squad)Object.assign(p.skills,{reading,defending:reading});
 const players=practicePlayers(f);
 place(players,[[4,0],[14,-5],[14,5],[24,0],st,[46,0],cbs[0],cbs[1],[30.5,-3],[30,4]]);
 const tactics=f.teams.map(t=>t.tactics),carrier=players[3],striker=players[4];
 const ball={x:carrier.x,y:carrier.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:carrier.id};
 let v=null,k=0;const trail=[];
 const look=n=>{for(let e=k+n;k<e;k++){v=coordinateFootball(players,ball,0,tactics,laneRisk,{time:20+k*.25,recoveredAt:-10},v);trail.push(structuredClone(v.jobs));}};
 look(looks);
 const mine=players.filter(p=>p.side===1&&p.role!=='GK');
 const read=()=>{const jobs=v.jobs;return {jobs,marker:mine.find(p=>jobs[p.id].purpose==='mark'&&jobs[p.id].target===striker.id),cover:mine.find(p=>jobs[p.id].kind==='cover'&&jobs[p.id].purpose==='balance')};};
 return {...read(),read,look,players,striker,trail,mine};
};

test('a striker ahead of the ball with his marker still upfield: the free centre-back covers him on the diagonal',()=>{
 const s=scene();
 assert.ok(s.marker,'a centre-back marks the striker');
 assert.ok(s.cover,'someone takes the cover');
 const c=s.jobs[s.cover.id].aim,m=s.jobs[s.marker.id].aim;
 assert.equal(s.jobs[s.cover.id].target,s.striker.id,'he covers the striker');
 assert.ok(dist(c,G)<dist(s.striker,G)-1,`goal-side of the striker (${dist(c,G).toFixed(2)} v ${dist(s.striker,G).toFixed(2)})`);
 assert.ok(dist(c,s.striker)<4,`close enough to step in (${dist(c,s.striker).toFixed(2)} m)`);
 assert.ok(offLine(c,m)>=1.2,`not in a column behind the marker (${offLine(c,m).toFixed(2)} m off his line to goal)`);
 assert.ok(L-c.x>=4,`outside the goal area (${(L-c.x).toFixed(2)})`);
});

// Threat-defending round (2026-10-10, goal-line fixes, the owner's decision): one defender per runner. The striker
// here is 9 m out, inside COVER_SINK of goal, and already has a marker goal-side of him, so the cover no longer sinks
// deeper than that marker (it doubled the drop to the line); he stays across, off the marker's line, close enough to
// step in. (Before this round the test required him deeper than the marker.)
test('with the marker goal-side of his man near goal, the cover sits beside and inside him, not deeper, never in his column',()=>{
 // the marker already 1 m goal-side of the striker
 const s=scene({cbs:[[34,-4],[40,1.8]]});
 assert.ok(s.marker&&s.cover,`a marker and a cover (${s.mine.map(p=>s.jobs[p.id].purpose+'/'+s.jobs[p.id].kind)})`);
 const c=s.jobs[s.cover.id].aim,m=s.jobs[s.marker.id].aim;
 assert.ok(dist(c,G)>=dist(m,G)-.3,`not deeper than the marker (${dist(c,G).toFixed(2)} v ${dist(m,G).toFixed(2)})`);
 assert.ok(dist(c,G)<dist(s.striker,G)+.5,`still goal-side of or level with the striker (${dist(c,G).toFixed(2)} v ${dist(s.striker,G).toFixed(2)})`);
 assert.ok(offLine(c,m)>=1.2,`off his line to goal (${offLine(c,m).toFixed(2)} m)`);
 assert.ok(dist(c,s.striker)<4.5,`still close enough to step in (${dist(c,s.striker).toFixed(2)} m)`);
});

test('when the danger is gone the cover steps back up',()=>{
 const f=scene();assert.ok(f.cover,'covering first');
 const cover=f.cover,depthBefore=L-f.jobs[cover.id].aim.x;
 // the striker comes back behind the ball, to show for it
 Object.assign(f.striker,{x:20,y:4});
 f.look(4);const after=f.read();
 assert.equal(after.cover,undefined,`nobody covers (${after.jobs[cover.id].purpose}/${after.jobs[cover.id].kind})`);
 assert.ok(L-after.jobs[cover.id].aim.x>depthBefore+4,`he steps back up (${depthBefore.toFixed(2)} -> ${(L-after.jobs[cover.id].aim.x).toFixed(2)} m)`);
});

test('the cover is seen late, by reading: a poor reader takes it later than a sharp one',()=>{
 const first=r=>scene({reading:r,looks:8}).trail.findIndex(jobs=>Object.values(jobs).some(j=>j.kind==='cover'&&j.purpose==='balance'));
 const sharp=first(10),poor=first(1);
 assert.ok(sharp>=1,`not on the very first look (sharp: look ${sharp})`);
 assert.ok(poor>sharp,`poor reader at look ${poor}, sharp at ${sharp}`);
});

test('a wide man is covered from inside him',()=>{
 const s=scene({st:[39,8]});
 assert.ok(s.cover,`someone covers the wide man (${s.mine.map(p=>s.jobs[p.id].purpose+'/'+s.jobs[p.id].kind)})`);
 const c=s.jobs[s.cover.id].aim;
 assert.ok(c.y<8-1,`inside him (${c.y.toFixed(2)})`);
 assert.ok(dist(c,G)<dist(s.striker,G),'goal-side of him');
});
