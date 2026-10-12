import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {steerControl,advanceControl,controlStrikeReady,strikeControl} from '../dist/practice-control.js';
const scenes=['strike-arrival-scene.json','strike-arrival-second-scene.json','strike-arrival-boundary-scene.json'].map(file=>JSON.parse(readFileSync(new URL(file,import.meta.url))));
for(const scene of scenes)for(const mirror of [false,true])test(`${scene.origin.style}: a prepared player finishes the small step required for a legal strike${mirror?' on the opposite side':''}`,()=>{
 const {player:p,ball,state,aim}=structuredClone(scene);
 if(mirror){for(const v of [p,ball,aim,...state.feet]){v.x=48-v.x;v.y=-v.y;}for(const v of [p,ball]){v.vx=-v.vx;v.vy=-v.vy;}p.angle+=Math.PI;p.side=1-p.side;}
 assert(!controlStrikeReady(p,ball,state,aim),'Recorded stopped position is not a legal strike');
 let ready=false;
 for(let t=0;t<3;t+=1/60){
  const old={...p},spot={x:ball.x,y:ball.y};steerControl(p,ball,state,aim,[],1/60,p.pace*.68,true);
  assert.deepEqual({x:ball.x,y:ball.y},spot,'Steering never moves the ball');
  assert(Math.hypot(p.vx-old.vx,p.vy-old.vy)<=p.acceleration/60+1e-8,'Repositioning obeys acceleration');
  assert(advanceControl(p,old,ball,state,aim,[],1/60,true));
  assert(ball.x>=0&&ball.x<=48&&Math.abs(ball.y)<=15);
  if(controlStrikeReady(p,ball,state,aim)){ready=true;break;}
 }
 assert(ready,'A reachable stance must not be trapped inside the ordinary arrival tolerance');
 assert(!state.contacts.some(c=>c.time>=scene.state.time&&c.kind==='body'),'Reach the stance without a self-collision');
 const u={x:aim.x-ball.x,y:aim.y-ball.y},d=Math.hypot(u.x,u.y);
 assert(strikeControl(p,ball,state,aim,{vx:u.x/d*8,vy:u.y/d*8,vz:0},'pass'));
 assert.equal(state.contacts.at(-1).kind,'pass');assert(state.contacts.at(-1).foot);
});
