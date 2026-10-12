import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {captureControl,cushionControl,steerControl,advanceControl,receivingContact} from '../dist/practice-control.js';
import {advanceFlight,flightContact} from '../dist/practice-flight.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

// Rounded contact states captured from ordinary matches, with no defender nearby.
const cases=[
 {name:'a heavy reception into open space',p:{x:33.0571,y:6.54744,vx:5.25114,vy:-1.42702,angle:12.10979},b:{x:33.55957,y:6.05171,vx:11.79616,vy:16.82979},aim:{x:39.46864,y:3.73814}},
 {name:'a moving reception beside the touchline',p:{x:18.48997,y:-11.37302,vx:-5.18254,vy:-3.32594,angle:4.49102},b:{x:19.47778,y:-11.64286,vx:-5.14352,vy:-1.63529},aim:{x:11.48997,y:-11.37302}}
];
for(const scenario of cases)test(`${scenario.name} allows a second physical touch, on either side`,()=>{
 for(const mirror of [false,true]){
  const p=practicePlayers(fixture)[3];Object.assign(p,scenario.p);
  const ball={...scenario.b,z:0,vz:0,owner:p.id,mode:'control'},aim={...scenario.aim};
  if(mirror){for(const v of [p,ball,aim]){v.x=48-v.x;v.y=-v.y;}for(const v of [p,ball]){v.vx=-v.vx;v.vy=-v.vy;}p.angle+=Math.PI;p.side=1-p.side;}
  const pace=p.pace,acceleration=p.acceleration,state=captureControl(p,ball),foot=state.feet[0];Object.assign(foot,{x:ball.x,y:ball.y});
  cushionControl(ball,state,{body:p,foot,fraction:0},0,{aim,opponents:[]});
  for(let t=0;t<2.2&&state.contacts.length<2;t+=1/60){
   const old={x:p.x,y:p.y},oldSpeed=Math.hypot(p.vx,p.vy);steerControl(p,ball,state,aim,[],1/60);
   assert(Math.hypot(p.vx,p.vy)<=Math.max(pace,oldSpeed)+1e-6);
   assert(advanceControl(p,old,ball,state,aim,[],1/60),'Reception should not expire before a reachable second touch');
   assert(ball.x>=0&&ball.x<=48&&Math.abs(ball.y)<=14.5,'Reach the next touch before the ball exits');
  }
  assert(state.contacts.length>=2);assert(state.contacts[1].foot,'Recovery still requires foot contact');
  assert.equal(p.pace,pace);assert.equal(p.acceleration,acceleration);
 }
});

test('touch choice avoids adding an outward cut when there is no time to recover it',()=>{
 const p=practicePlayers(fixture)[3];Object.assign(p,{x:20,y:-13,vx:-3,vy:-5,angle:-Math.PI/2});
 const ball={x:19.3,y:-13.35,vx:0,vy:8,z:0,vz:0,owner:p.id,mode:'control'},state=captureControl(p,ball);
 cushionControl(ball,state,{body:p,foot:{side:'left',x:ball.x,y:ball.y,active:true},fraction:0},0,{aim:{x:27,y:-12},opponents:[]});
 assert(ball.vy>p.vy,'Do not add an avoidable impulse toward the nearby touchline');
 assert(ball.vy<0,'Existing momentum and a difficult reception are not erased');
});

test('side-on foot contact remains possible, while an extreme impact is not guaranteed control',()=>{
 const p=practicePlayers(fixture)[3];Object.assign(p,{x:20,y:0,vx:0,vy:0,angle:Math.PI/2});
 const ball={x:16,y:0,vx:12,vy:0,z:0,vz:0,owner:null,mode:'pass'},state=captureControl(p,ball);let meeting;
 for(let t=0;t<1&&!meeting;t+=1/60){const before={...ball};advanceFlight(ball);meeting=receivingContact(p,p,before,ball,state,t,1/60);const body=flightContact(before,ball,p,p,.31,1.1);assert(body===null||meeting&&meeting.fraction<=body,'A normal side-on pass can meet the foot before the torso');}
 assert(meeting);cushionControl(ball,state,meeting,0);assert(Math.hypot(ball.vx,ball.vy)<1);
 const hard={x:p.x-.65,y:p.y,vx:100,vy:0,z:0,vz:0,owner:null,mode:'pass'};
 cushionControl(hard,captureControl(p,hard),{body:p,foot:{side:'left',x:hard.x,y:hard.y,active:true},fraction:0},0);
 assert(Math.hypot(hard.vx,hard.vy)>p.pace,'An impossible impact must still spill');assert.equal(hard.owner,null);
});
