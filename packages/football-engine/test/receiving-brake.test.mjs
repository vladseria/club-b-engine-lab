import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {steerControl,receivingContact} from '../dist/practice-control.js';
import {advanceFlight} from '../dist/practice-flight.js';
const scene=JSON.parse(fs.readFileSync(new URL('./receiving-brake-scene.json',import.meta.url)));
for(const mirror of [false,true])test(`receiver brakes into a prepared foot contact, not a maximum-reach waiting position${mirror?' mirrored':''}`,()=>{
 const {player:p,ball,state,aims}=structuredClone(scene);
 if(mirror){for(const v of [p,ball,...state.feet,...aims.map(a=>a.aim)]){v.x=48-v.x;v.y=-v.y;}for(const v of [p,ball]){v.vx=-v.vx;v.vy=-v.vy;}p.angle+=Math.PI;p.side=1-p.side;}
 let received;
 for(let t=0;t<.85;t+=1/60){
  const old={...p},before={...ball},aim=(aims.findLast(a=>a.time<=t+1e-6)??aims[0]).aim;
  steerControl(p,ball,state,aim,[],1/60,p.pace,true);
  assert.deepEqual(ball,before,'Positioning cannot move the free ball');
  assert(Math.hypot(p.vx-old.vx,p.vy-old.vy)<=p.acceleration/60+1e-8);
  advanceFlight(ball);
  received=receivingContact(p,old,before,ball,state,scene.origin.time+t+1/60,1/60);
  if(received){
   const at={x:before.x+(ball.x-before.x)*received.fraction,y:before.y+(ball.y-before.y)*received.fraction};
   assert(Math.hypot(at.x-received.foot.x,at.y-received.foot.y)<=.160001,'Actual swept foot contact');
   assert(at.x>=0&&at.x<=48&&Math.abs(at.y)<=15);break;
  }
 }
 assert(received,'The recorded reachable delivery should meet a foot before leaving play');
 assert.equal(ball.owner,null,'A predicted/reached contact alone does not grant ownership');
});
