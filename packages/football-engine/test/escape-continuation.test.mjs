import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {readNextConnection} from '../dist/practice-connections.js';
import {carryOptions} from '../dist/practice-carry.js';
import {laneRisk} from '../dist/practice.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(){
 const players=practicePlayers(fixture);
 players.forEach(p=>Object.assign(p,{x:p.side?44:2,y:p.side?12:-12,vx:0,vy:0}));
 const p=players[2],q=players[3],d=players[6];
 Object.assign(p,{x:18,y:0,vx:5,vy:0});Object.assign(q,{x:20,y:7,angle:-Math.PI/2});Object.assign(d,{x:20,y:0,vx:-3,vy:0});
 return {players,p,q,d};
}
test('a moving passer can be the next receiver when a wall pass bypasses a contested carry',()=>{
 const {players,p,q}=scene(),before=structuredClone(players);
 const read=readNextConnection(p,q,q,players,.45,laneRisk);
 assert.equal(read.target,p.id);assert(read.gain>0);assert.deepEqual(players,before);
 p.vx=0;const starting=readNextConnection(p,q,q,players,.45,laneRisk);
 assert(starting.gain<read.gain,'An already moving passer has a more developed return opportunity');
 if(starting.gain>0)assert(starting.continuation,'A stationary passer needs a proposed movement to claim a return');
 const support={owner:p.id,side:p.side,moves:[{player:p.id,purpose:'playbook',kind:'hold',aim:{x:p.x,y:p.y},speed:0,since:0,until:3}]};
 assert.equal(readNextConnection(p,q,q,players,.45,laneRisk,{support,time:0}).gain,0,'Holding position cannot claim the benefit of an unplanned run');
 p.vx=5;assert.equal(readNextConnection(p,q,q,players,.45,()=>0).gain,0,'An unopposed carry needs no detour bonus');
});
test('a closed return and an unreachable intermediary cannot claim a continuation',()=>{
 const {players,p,q}=scene();
 assert.equal(readNextConnection(p,q,q,players,.45,()=>1).gain,0);
 Object.assign(players[7],{x:q.x,y:q.y,vx:0,vy:0});
 assert.equal(readNextConnection(p,q,q,players,.45,laneRisk).gain,0);
});
test('upcoming pressure affects an initially unpressured carry before actual contact risk develops',()=>{
 const {players,p,d}=scene();Object.assign(p,{x:22,y:0,vx:5,vy:0,angle:0});Object.assign(d,{x:27.5,y:0,vx:0,vy:0});
 const forward=()=>carryOptions(p,players,0,()=>0).find(o=>o.aim.x===29&&o.aim.y===0);
 const approaching=forward();d.vx=5;const retreating=forward();
 assert.equal(approaching.carry.contactRisk,0);assert.equal(retreating.carry.contactRisk,0);
 assert(approaching.carry.endPressure>0);assert.equal(retreating.carry.endPressure,0);
 assert(approaching.score<retreating.score,'The same open starting position cannot erase the pressure developing along the route');
 assert(approaching.score>0,'A contested carry remains an option, not a prohibition');
});
