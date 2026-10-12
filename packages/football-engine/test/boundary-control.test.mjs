import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {captureControl,cushionControl,steerControl,advanceControl,controlStrikeReady} from '../dist/practice-control.js';
import {cushionedVelocity} from '../dist/practice-reception.js';
import {securePossessionOptions,strikeClearance} from '../dist/practice-possession.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

for(const edge of ['top','bottom','left','right'])test(`a reachable reception at the ${edge} boundary can be kept in play without a body ricochet`,()=>{
 for(const control of [4,6,9])for(const preparing of [false,true]){
  const p=practicePlayers(fixture)[3];Object.assign(p,{x:20,y:-13.6,vx:0,vy:-5,angle:-Math.PI/2});p.skills.control=control;
  const ball={x:20.1,y:-14.2,vx:6,vy:-2,z:0,vz:0,owner:p.id,mode:'control'},aim={x:28,y:-9};
  if(edge==='bottom'){for(const v of [p,ball,aim])v.y=-v.y;for(const v of [p,ball])v.vy=-v.vy;p.angle=-p.angle;}
  if(edge==='left'||edge==='right'){
   for(const v of [p,ball,aim]){const {x,y}=v;v.x=edge==='left'?y+15:33-y;v.y=x-20;}
   for(const v of [p,ball]){const {vx,vy}=v;v.vx=edge==='left'?vy:-vy;v.vy=vx;}p.angle=edge==='left'?Math.PI:0;
  }
  const state=captureControl(p,ball),foot=state.feet[0];Object.assign(foot,{x:ball.x,y:ball.y});
  const spot={x:ball.x,y:ball.y};
  cushionControl(ball,state,{body:p,foot,fraction:0},0,preparing?{aim,opponents:[],release:true}:undefined);
  assert.deepEqual({x:ball.x,y:ball.y},spot,'The touch changes velocity, never position');
  for(let t=0;t<2.5;t+=1/60){
   const old={x:p.x,y:p.y},velocity={x:p.vx,y:p.vy};
   steerControl(p,ball,state,aim,[],1/60,p.pace*.68,preparing);
   assert(Math.hypot(p.vx-velocity.x,p.vy-velocity.y)<=p.acceleration/60+1e-8,'No instantaneous braking');
   advanceControl(p,old,ball,state,aim,[],1/60,preparing);
   assert(ball.x>=0&&ball.x<=48&&Math.abs(ball.y)<=15,'Ball remains physically in play');
  }
  assert(!state.contacts.some(c=>c.kind==='body'),'Do not save the touch by hitting the receiver’s shins');
 }
});

test('interior settling retains ordinary impact and skill physics',()=>{
 const p=practicePlayers(fixture)[3];Object.assign(p,{x:20,y:0,vx:2,vy:0,angle:0});
 const ball={x:20.6,y:.1,vx:10,vy:3,z:0,vz:0,owner:p.id,mode:'control'};
 const expected=cushionedVelocity(p,ball,{x:p.vx,y:p.vy}),state=captureControl(p,ball);
 cushionControl(ball,state,{body:p,foot:{side:'left',x:ball.x,y:ball.y,active:true},fraction:0},0);
 assert.deepEqual({x:ball.vx,y:ball.vy},expected);
});

test('forward clearance height follows its intention even if its aiming point is beyond the end line',()=>{
 for(const side of [0,1]){
  const players=practicePlayers(fixture),p=players[1],opponent=players[6];
  p.side=side;opponent.side=1-side;
  let previous;
  for(const depth of [10,15]){
   Object.assign(p,{x:side?48-depth:depth,y:0,angle:side?Math.PI:0,vx:0,vy:0});
   Object.assign(opponent,{x:p.x,y:1,vx:0,vy:0});
   const options=securePossessionOptions(p,[p,opponent],[],()=>0).filter(o=>o.kind==='clear');
   const long=options.find(o=>o.clearance==='long');assert(long);
   const strike=strikeClearance(p,p,long.aim,.5,()=>.5,long.clearance);
   assert(strike.vz>6,'Forward relief clears nearby pressure through the air');
   if(previous)assert.deepEqual(strike,previous,'Crossing the endpoint boundary must not change the kick');
   previous=strike;
   const touchline=options.find(o=>o.clearance==='touchline');assert(touchline);
   const out=strikeClearance(p,p,touchline.aim,.5,()=>.5,touchline.clearance);
   assert(out.vz<strike.vz,'A deliberate touchline clearance keeps its own delivery');
   assert(Math.abs(Math.hypot(out.vx,out.vy)-Math.hypot(strike.vx,strike.vy))<1e-8,'No change to kicking power');
  }
 }
});

// A saved ball is only useful if the receiver can still step along the line to play it.
test('boundary braking does not strand a stationary ball beside the receiver',()=>{
 const p=practicePlayers(fixture)[1];Object.assign(p,{x:.75,y:1.75,vx:0,vy:0,angle:-1.47});
 const ball={x:.52,y:.49,vx:0,vy:0,z:0,vz:0,owner:p.id,mode:'control'},aim={x:20,y:4},state=captureControl(p,ball);
 let ready=false;
 for(let t=0;t<1.5;t+=1/60){
  const old={x:p.x,y:p.y};steerControl(p,ball,state,aim,[],1/60,p.pace*.68,true);
  advanceControl(p,old,ball,state,aim,[],1/60,true);
  if(controlStrikeReady(p,ball,state,aim)){ready=true;break;}
 }
 assert(ready,'Receiver reaches a real passing stance instead of repeatedly stopping');
 assert(ball.x>=0&&ball.x<=48&&Math.abs(ball.y)<=15);
});

test('after stopping an outward touch, the player can step toward the line to open an inward pass',()=>{
 for(const mirror of [false,true])for(const aim of [{x:20,y:4},{x:3.8,y:9.5},{x:2,y:-3.8}]){
  const p=practicePlayers(fixture)[3];Object.assign(p,{x:.86327,y:2.97326,vx:0,vy:0,angle:-.8797});
  const b={x:.67792,y:2.51053,vx:0,vy:0,z:0,vz:0,owner:p.id,mode:'control'},target={...aim};
  if(mirror){for(const v of [p,b,target]){v.x=48-v.x;v.y=-v.y;}p.angle+=Math.PI;}
  const state=captureControl(p,b);let ready=false;
  for(let t=0;t<3;t+=1/60){const old={x:p.x,y:p.y};steerControl(p,b,state,target,[],1/60,p.pace*.68,true);advanceControl(p,old,b,state,target,[],1/60,true);if(controlStrikeReady(p,b,state,target)){ready=true;break;}}
  assert(ready,'Boundary protection should allow a safe step around the ball');
  assert(b.x>=0&&b.x<=48&&Math.abs(b.y)<=15);
 }
});
