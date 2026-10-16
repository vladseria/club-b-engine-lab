import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {readShotDanger,SHOT_LANES} from '../dist/practice-shot-defense.js';
import {PROTECT_AIMS} from '../dist/practice-defending.js';
import {GH,L} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

test('a defender reads shot lanes inside the posts, the same points the shooter aims at',()=>{
 for(const y of SHOT_LANES){
  assert(Math.abs(y)<GH,`lane at y=${y} is outside the posts (±${GH})`);
  assert(PROTECT_AIMS.some(a=>Math.abs(a-y)<1e-9),`lane at y=${y} is not one of the shooter's targets`);
 }
});

test('with the centre lane covered, the block goes to a corner lane that ends inside the posts',()=>{
 for(const mirror of [false,true]){
  const players=practicePlayers(fixture),s=mirror?-1:1,fx=x=>mirror?L-x:x;
  // side 0 shoots at x=L; mirrored, side 1 shoots at x=0
  const attackers=players.filter(p=>p.side===(mirror?1:0)),defenders=players.filter(p=>p.side!==(mirror?1:0));
  for(const p of players)Object.assign(p,{x:fx(10),y:12*s,vx:0,vy:0,angle:mirror?Math.PI:0});
  const shooter=attackers.find(p=>p.role!=='GK');Object.assign(shooter,{x:fx(L-12),y:0});
  const outfield=defenders.filter(p=>p.role!=='GK'),[reader,centre]=outfield;
  Object.assign(reader,{x:fx(L-9),y:1.5});Object.assign(centre,{x:fx(L-6),y:0});
  const ball={x:shooter.x,y:shooter.y};
  const read=readShotDanger(reader,shooter,ball,players);
  const vx=read.blockAim.x-ball.x,vy=read.blockAim.y-ball.y,goalX=mirror?0:L,crossing=ball.y+vy*(goalX-ball.x)/vx;
  assert(Math.abs(crossing)<GH,`block lane crosses the goal line at y=${crossing.toFixed(2)}, outside the posts`);
  assert(Math.abs(crossing)>.5,'the covered centre is left to the team-mate standing in it');
 }
});
