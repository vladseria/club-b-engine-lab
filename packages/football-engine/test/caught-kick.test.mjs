// Caught kick (2026-10-19): a player setting up a kick judges the nearest man by how soon he can get a foot to the BALL
// (within tackle range of it, plus the tackle's landing), not by how soon he reaches the player's body.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {priceCaught,footOnBall,CHALLENGE_LAND,CAUGHT_KICK} from '../dist/practice-possession.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
function parked(){
 const players=practicePlayers(fixture);
 players.forEach((p,i)=>Object.assign(p,{x:p.side?44-i:4+i,y:p.side?12:-12,vx:0,vy:0}));
 return players;
}

test('a man within tackle range of the ball a stride off his feet is read as on it, though he is far from the body',()=>{
 const players=parked(),p=players[2],q=players[3],d=players[8];
 Object.assign(p,{x:20,y:0,angle:0,vx:0,vy:0});Object.assign(q,{x:30,y:-6});
 const ball={x:20.9,y:0};
 const kick={kind:'pass',target:q.id,aim:{x:30,y:-6},score:.4,reason:''};
 // standing 1.5 m from the ball, 2.4 m from the man: he can go in now
 Object.assign(d,{x:22.3,y:.6,vx:0,vy:0});
 assert.equal(footOnBall(d,ball),CHALLENGE_LAND,'in range and in reach of the ball: his tackle lands at the soonest');
 const body=priceCaught(p,players,[kick],0),onBall=priceCaught(p,players,[kick],0,ball);
 assert.deepEqual(body,[kick],'the body read sees time to wind up');
 const set=onBall.find(o=>!o.hurried),quick=onBall.find(o=>o.hurried);
 assert(set.score<kick.score-.1,`the ball read prices the wind-up he would be caught on (${set.score.toFixed(2)})`);
 assert(quick,'and offers the same ball played quickly beside it (which wins is up to their prices)');
 CAUGHT_KICK.byBall=false;
 try{assert.deepEqual(priceCaught(p,players,[kick],0,ball),body,'with the flag off the read is the body read');}finally{CAUGHT_KICK.byBall=true;}
});

test('a man still out of range of the ball leaves time to wind up',()=>{
 const players=parked(),p=players[2],q=players[3],d=players[8];
 Object.assign(p,{x:20,y:0,angle:0,vx:0,vy:0});Object.assign(q,{x:30,y:-6});
 const kick={kind:'pass',target:q.id,aim:{x:30,y:-6},score:.4,reason:''};
 Object.assign(d,{x:24.5,y:1,vx:0,vy:0});
 assert.deepEqual(priceCaught(p,players,[kick],0,{x:20.9,y:0}),[kick],'nothing is charged and no hurried ball is offered');
});
