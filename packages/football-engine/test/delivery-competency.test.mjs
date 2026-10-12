import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {loftOptions,loftPass,strikeLoftPass} from '../dist/practice-loft.js';
import {flightMeeting,advanceFlight} from '../dist/practice-flight.js';
import {groundOptions,receivingRoom,strikeGroundPass} from '../dist/practice-passing.js';
import {arrivalTime} from '../dist/practice-defense.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

test('a clear six-metre pass is weighted to arrive before the receiver is closed down, in either direction',()=>{
 for(const mirror of [false,true]){
  const ps=practicePlayers(fixture);
  ps.forEach((p,i)=>Object.assign(p,{x:i<5?3:46,y:i%2?12:-12,vx:0,vy:0,angle:0}));
  Object.assign(ps[2],{x:16,y:0});Object.assign(ps[3],{x:22,y:0,angle:Math.PI});Object.assign(ps[6],{x:25,y:0});
  if(mirror)ps.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI}));
  const p=ps[2],q=ps[3],defender=ps[6],original=structuredClone(ps),opponents=ps.filter(d=>d.side!==p.side);
  const options=groundOptions(p,q,ps,false,undefined,p,laneRisk),selected=options[0],soft=options.find(o=>o.pass.weight==='soft');
  assert.equal(soft.pass.risk,0,'The problem is time after reception, not an intercepted lane');
  const closes=arrivalTime(defender,q);
  assert(soft.pass.flight>closes);assert(selected.pass.flight<closes-.2);
  assert(selected.pass.controlRisk>soft.pass.controlRisk,'A faster delivery still costs receiving difficulty');
  assert.deepEqual(ps,original,'Evaluating room cannot move players or improve their skills');
  const kick=strikeGroundPass(p,p,q,false,undefined,0,()=>.5,opponents,undefined,undefined,selected.pass.weight);
  const ball={x:p.x,y:p.y,z:0,vx:kick.vx,vy:kick.vy,vz:kick.vz,mode:'pass',owner:null};
  advanceFlight(ball,selected.pass.flight);
  assert(Math.hypot(ball.x-selected.aim.x,ball.y-selected.aim.y)<.03);
  assert.equal(ball.owner,null,'A useful delivery still requires a real reception');
  defender.x=mirror?8:40;
  const open=groundOptions(p,q,ps,false,undefined,p,laneRisk)[0];
  assert(open.pass.speed<selected.pass.speed,'Without the closing defender, a gentler pass remains useful');
 }
});

test('receiving room depends on delivery time and visible defensive momentum, for ground or aerial arrivals',()=>{
 const ps=practicePlayers(fixture),defender=ps[6],aim={x:22,y:0};
 Object.assign(defender,{x:27,y:0,vx:0,vy:0});
 const brief=receivingRoom(aim,[defender],.5),long=receivingRoom(aim,[defender],1.2);
 assert(brief>long);
 defender.vx=-3;const closing=receivingRoom(aim,[defender],.6);
 defender.vx=3;assert(receivingRoom(aim,[defender],.6)>closing);
 assert.equal(receivingRoom(aim,[defender],5),0,'A defender can occupy the destination during a long flight');
});

test('an open aerial lane does not make an unreachable delivery preferable to a contestable reception',()=>{
 // Rounded snapshot of an ordinary match: the receiver is coming short.
 // A fast chip clears the defender but also flies beyond his teammate.
 const players=practicePlayers(fixture);
 const poses=[[2.8,0,0,0],[22.7,.8,5.4,1.3],[22.5,-8.5,3.8,.1],[31.5,3.4,4.7,-.9],[20.7,-1.1,3.6,4.6],
  [43.5,-.1,2.3,1.2],[35.3,3.2,0,0],[23.7,-9.6,4.9,0],[25,4.6,5,1.9],[24.4,4.6,1,-.3]];
 players.forEach((p,i)=>{const [x,y,vx,vy]=poses[i];Object.assign(p,{x,y,vx,vy,angle:i===6?-2.17:0});});
 const p=players[6],q=players[7],from={x:35.75,y:2.34},opponents=players.filter(d=>d.side!==p.side);
 const options=loftOptions(p,q,players,undefined,from,laneRisk),chip=options.find(o=>o.loft.kind==='chip'),loft=options.find(o=>o.loft.kind==='loft');
 assert.equal(chip.loft.risk,0);assert(chip.loft.reachMargin< -1);
 assert(loft.loft.risk>0);assert(loft.loft.reachMargin>=0);
 assert(loft.score>chip.score);assert.equal(loftPass(p,q,undefined,from,opponents).kind,'loft');
 // Choosing a reachable flight does not remove the defender, grant possession,
 // or alter the kick to guarantee success. Check the actual neutral flight.
 const kick=strikeLoftPass(p,from,q,undefined,0,()=>.5,opponents,undefined,undefined,'loft');
 const ball={...from,z:0,vx:kick.vx,vy:kick.vy,vz:kick.vz,mode:'pass',owner:null};
 assert(flightMeeting(q,ball,.12).reachable);
 advanceFlight(ball,kick.plan.flight);
 assert(Math.hypot(ball.x-kick.aim.x,ball.y-kick.aim.y)<.03);
 assert.equal(ball.owner,null);assert(kick.plan.risk>0);
});
