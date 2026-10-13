// M1, the no-offside Line (style identity, 2026-10-01). There is no offside,
// so Line sets how far the back line lets the deepest threatening attacker
// pull it back: deep keeps a cushion goal-side of him (and drops with a
// runner), standard stands roughly level, high holds its height and leaves
// him to his marker. Every read is the defender's own.
// (Settings-truth round, 2026-10-04: the first four tests are the classic
// policy's defending team shape, back to main's code: behaviour round A's
// LINE_BLOCK / holds / lineCushion lived only there, and the coordinated
// policy Ballers plays has defended with practice-defending since the
// defending rebuild. The coordinated test below is the rebuild's.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {teamShape,LINE_CUSHION} from '../dist/practice-shape.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {assignBuildUp} from '../dist/practice-build-up.js';
import {L} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
const depth1=x=>L-x;

// Team 1 (2-1-1, own goal at x = 48) defends; team 0's carrier (#4) is on the
// ball 24 m from team 1's goal with nobody near him, so team 1's ball-based
// back line sits ~10 m behind the ball (depth ~14). Team 0's striker (#5)
// stands `st` m from team 1's goal (or runs at it).
const scene=(line,{st=9,run=0,reading=10,ticks=12,drift=0}={})=>{
 const f=structuredClone(fixture);
 f.teams[1].tactics={...f.teams[1].tactics,formation:'2-1-1',line,press:'balanced'};
 for(const p of f.teams[1].squad)Object.assign(p.skills,{reading,defending:reading});
 const players=practicePlayers(f);
 place(players,[[4,0],[14,-5],[14,5],[24,0],[48-st,2],[46,0],[34,-4],[34,4],[30.5,-3],[30,4]]);
 const carrier=players[3],striker=players[4];
 const ball={x:carrier.x,y:carrier.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:carrier.id};
 let shape=null;const trail=[];
 for(let k=0;k<ticks;k++){
  if(run)Object.assign(striker,{vx:run,x:striker.x+(k?run*.25:0)});
  if(drift)for(const p of players.filter(p=>p.side===1&&p.role==='CB'))p.x+=drift;
  shape=teamShape(players,ball,0,1,f.teams[1].tactics,20+k*.25,shape);
  trail.push({striker:depth1(striker.x),cbs:players.filter(p=>p.side===1&&p.role==='CB').map(p=>depth1(shape.slots[p.id].aim.x)),back:shape.back});
 }
 return {shape,players,striker,trail,last:trail.at(-1),f};
};

test('the Line cushion: deep 2 m goal-side, standard level, high holds',()=>{
 assert.deepEqual(LINE_CUSHION,{deep:2,standard:0,high:null});
 const deep=scene('deep').last,standard=scene('standard').last,high=scene('high').last;
 // Ball-based height ~14 m for every line (the ceilings are the press height
 // and do not bind here); the striker stands at 9 m.
 for(const s of [deep,standard,high])assert.ok(Math.abs(s.back-13.94)<.6,`ball-based back ${s.back}`);
 for(const d of deep.cbs)assert.ok(d<=9-2+.4&&d>6,`deep CB at ${d.toFixed(2)} m, striker at 9`);
 for(const d of standard.cbs)assert.ok(Math.abs(d-9)<.5,`standard CB at ${d.toFixed(2)} m`);
 for(const d of high.cbs)assert.ok(Math.abs(d-high.back)<.01,`high CB holds ${d.toFixed(2)} m`);
});

test('a deep line drops with a runner; a high line leaves the space behind him',()=>{
 // The striker starts 14 m out and runs at goal at 6.5 m/s for 1.5 s.
 const deep=scene("deep",{st:14,run:6.5,ticks:6}),high=scene("high",{st:14,run:6.5,ticks:6});
 const start=deep.trail[0],end=deep.trail.at(-1);
 assert.ok(end.striker<start.striker-6,`he ran (${start.striker.toFixed(1)} -> ${end.striker.toFixed(1)})`);
 // Deep: goal-side of where the run is taking him (read 0.5 s ahead), all the way.
 for(const t of deep.trail.slice(2))for(const d of t.cbs)assert.ok(d<t.striker-.5,`deep CB ${d.toFixed(2)} vs runner ${t.striker.toFixed(2)}`);
 // High: holds the ball-based height; the runner is behind him.
 for(const d of high.last.cbs)assert.ok(d>high.last.striker+3,`high CB ${d.toFixed(2)} vs runner ${high.last.striker.toFixed(2)}: space behind`);
});

test('with no attacker deep, standard and deep keep the ball-based height (they do not camp near goal)',()=>{
 for(const line of ['deep','standard']){
  const s=scene(line,{st:22}).last;
  for(const d of s.cbs)assert.ok(Math.abs(d-s.back)<.01,`${line}: CB at ${d.toFixed(2)} m, unit ${s.back.toFixed(2)}`);
 }
});

test('reading the runner is individual: a poor reader is off and slower to drop',()=>{
 // Standing striker: a sharp reader puts him within ~0.4 m; the read of a
 // poor one can be metres off (deterministic per player and place).
 const err=r=>Math.max(...scene('standard',{reading:r}).last.cbs.map(d=>Math.abs(d-9)));
 assert.ok(err(10)<.45,`sharp reader off by ${err(10).toFixed(2)} m`);
 // A runner: after 0.5 s the poor reader has dropped less far.
 const drop=r=>{const s=scene('deep',{st:16,run:6.5,ticks:3,reading:r});return s.trail[0].cbs.map((d,i)=>d-s.last.cbs[i]);};
 const sharp=drop(10),poor=drop(3);
 assert.ok(sharp.every((d,i)=>d>poor[i]+.3),`drop in 0.5 s: sharp ${sharp.map(d=>d.toFixed(2))} vs poor ${poor.map(d=>d.toFixed(2))}`);
});

test('with the striker marked, his marker keeps him in front; the other centre-back is not pinned behind him',()=>{
 const run=line=>{
  const {players,f}=scene(line,{ticks:1});
  const tactics=f.teams.map(t=>t.tactics),carrier=players[3];
  const ball={x:carrier.x,y:carrier.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:carrier.id};
  let v=null;for(let k=0;k<6;k++)v=coordinateFootball(players,ball,0,tactics,laneRisk,{time:20+k*.25,recoveredAt:-10},v);
  const cbs=players.filter(p=>p.side===1&&p.role==='CB'),marker=cbs.find(p=>v.jobs[p.id].purpose==='mark'&&v.jobs[p.id].target===players[4].id);
  const other=cbs.find(p=>p!==marker);
  return {marker:marker&&v.jobs[marker.id],other:other&&v.jobs[other.id]};
 };
 for(const line of ['deep','high']){
  const s=run(line);
  assert.ok(s.marker,`${line}: a centre-back marks the striker`);
  assert.ok(depth1(s.marker.aim.x)<9,`${line}: goal-side of him (${depth1(s.marker.aim.x).toFixed(2)})`);
  assert.ok(depth1(s.other.aim.x)>depth1(s.marker.aim.x)+1,`${line}: the other is not stacked behind the marker (${depth1(s.other.aim.x).toFixed(2)})`);
 }
});

// In possession. Team 0 (2-1-1) keeps the ball in a settled attack 40 m from
// its own goal (8 m from team 1's), nobody pressing the carrier. Team 1's
// deepest forward (#5 on the other side) stands `fwd` m from team 0's goal:
// up the pitch (no attacker deep) or hanging deep as a counter outlet. Read
// the centre-backs' build-up jobs (their ordinary support in possession).
const attack=(line,{fwd=38,reading=10}={})=>{
 const f=structuredClone(fixture);
 f.teams[0].tactics={...f.teams[0].tactics,formation:'2-1-1',line};
 for(const p of f.teams[0].squad)Object.assign(p.skills,{reading,defending:reading});
 const players=practicePlayers(f);
 place(players,[[4,0],[27,-5],[27,5],[40,-6],[43,4],[46.5,0],[45,2],[45,9],[45,-12],[fwd,1]]);
 const carrier=players[3],tactics=f.teams[0].tactics;
 const ball={x:carrier.x,y:carrier.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:carrier.id};
 let shape={side:0,attacking:true,time:19.75,changedAt:10,phase:'circulate',back:28,middle:37,front:44,shift:0,focus:{x:40,y:-6},slots:{}};
 for(let k=0;k<12;k++)shape=teamShape(players,ball,0,0,tactics,20+k*.25,shape);
 const moves=assignBuildUp(players,carrier,tactics,laneRisk,{time:23,recoveredAt:10,shape},[]);
 const cbs=players.filter(p=>p.side===0&&p.role==='CB');
 return {moves:cbs.map(p=>moves.find(m=>m.player===p.id)).map(m=>({x:m.aim.x,purpose:m.purpose})),slots:cbs.map(p=>shape.slots[p.id].aim.x)};
};

test('in possession, standard centre-backs step up behind the attack when no attacker is deep; a deep forward holds them level',()=>{
 const free=attack('standard'),held=attack('standard',{fwd:22});
 // The old absolute caps were 28.3 m (shape) and 27.9 m (build-up; or 11 m
 // behind the ball, 29 m here).
 for(const x of free.slots)assert.ok(x>29.3,`no attacker deep: slot ${x.toFixed(1)} m (ball at 40)`);
 for(const m of free.moves)assert.ok(m.x>30,`no attacker deep: ${m.purpose} at ${m.x.toFixed(1)} m`);
 for(const x of held.slots)assert.ok(Math.abs(x-22)<.6,`forward at 22 m: slot ${x.toFixed(1)} m`);
 for(const m of held.moves)assert.ok(m.x<22.6,`forward at 22 m: ${m.purpose} at ${m.x.toFixed(1)} m`);
});

test('in possession, deep keeps its cap and stays goal-side of a deep forward; high leaves him to the covering centre-back',()=>{
 const deep=attack('deep'),deepHeld=attack('deep',{fwd:22}),high=attack('high',{fwd:22});
 for(const m of deep.moves)assert.ok(m.x<=29+.01,`deep: ${m.purpose} at ${m.x.toFixed(1)} m (cap, or 11 m behind the ball)`);
 for(const m of deepHeld.moves)assert.ok(m.x<=20.4,`deep: 2 m goal-side of the forward (${m.purpose} at ${m.x.toFixed(1)} m)`);
 const cover=high.moves.filter(m=>m.purpose==='counter-cover'),other=high.moves.filter(m=>m.purpose!=='counter-cover');
 assert.equal(cover.length,1,`high: one centre-back covers the forward (${high.moves.map(m=>m.purpose)})`);
 assert.ok(cover[0].x<21.5,`high: the cover stays goal-side of him (${cover[0].x.toFixed(1)} m)`);
 assert.ok(other[0].x>28,`high: the other supports the attack (${other[0].x.toFixed(1)} m)`);
});
