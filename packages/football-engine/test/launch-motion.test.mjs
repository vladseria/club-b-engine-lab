import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import {launchRisk,releaseTime} from '../dist/practice-possession.js';
const scene=JSON.parse(readFileSync(new URL('../evidence/2026-09-23-moving-release-scene.json',import.meta.url)));

test('a pursuer does not gain a fictitious release block by freezing the moving passer',()=>{
 for(const mirror of [false,true]){
  const ps=structuredClone(scene.players),aim={...scene.option.aim};
  if(mirror){for(const p of ps)Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,vx:-p.vx,vy:-p.vy,angle:p.angle+Math.PI});aim.x=48-aim.x;aim.y=-aim.y;}
  const p=ps.find(p=>p.id===scene.actor),before=structuredClone(ps),delay=releaseTime(p,aim,scene.option.kind);
  assert(launchRisk(p,aim,ps,delay)<.1,'Recorded moving outlet is not blocked at the old release location');
  assert(launchRisk({...p,vx:0,vy:0},aim,ps,delay)>.9,'Stopping in the same scene really does let the pursuer close');
  assert.deepEqual(ps,before,'Forecast must not move real players or alter execution skills');
 }
});

test('shared motion preserves separation, but an independently closing defender still matters',()=>{
 const base=scene.players.find(p=>p.id===scene.actor),p={...base,side:0,x:10,y:0,vx:6,vy:0},aim={x:30,y:0};
 const follower={...base,id:'follower',side:1,x:8,y:0,vx:6,vy:0};
 assert.equal(launchRisk(p,aim,[p,follower],.3),0);
 assert(launchRisk({...p,vx:0},aim,[follower],.3)>.4);
 const closing={...follower,x:15,y:2,vx:0,vy:-6};assert(launchRisk(p,aim,[closing],.3)>.9);
 assert.equal(launchRisk(p,aim,[closing]),launchRisk({...p,vx:0},aim,[closing]),'Immediate release evaluates current geometry');
});
