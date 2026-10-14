// R1 keeper (2026-10-14): the keeper with the ball at his feet. His carry pays the loss price any carrier pays, plus
// the goal he leaves behind him (emptyNetDanger), weighed by his habit (keeperSweep). No distance limit: a carry to
// the touchline stays on offer to every keeper; a stay-at-home keeper prices it higher than a sweeper does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {carryOptions,emptyNetDanger,keeperNetWeight} from '../dist/practice-carry.js';
import {laneRisk} from '../dist/practice.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(sweep){
 const players=practicePlayers(fixture);
 const gk=players.find(p=>p.side===0&&p.role==='GK');
 // his team-mates up the pitch, theirs in midfield, one presser 7 m off him
 players.filter(p=>p!==gk).forEach((p,i)=>Object.assign(p,{x:p.side?20+i:22+i,y:(i%3-1)*8,vx:0,vy:0}));
 Object.assign(gk,{x:2.5,y:-5,vx:0,vy:0,angle:0,traits:{...gk.traits,keeperSweep:sweep}});
 Object.assign(players.find(p=>p.side===1&&p.role!=='GK'),{x:8,y:-1,vx:-1,vy:0});
 return {players,gk};
}
test('the goal a keeper leaves: nothing open beside his goal, nearly all of it from the touchline',()=>{
 const {players,gk}=scene(.2);
 assert.equal(emptyNetDanger(gk,players,{x:2,y:0}),0);
 assert.ok(emptyNetDanger(gk,players,{x:7,y:-14})>.5,'15 m out on the touchline the net is open');
 assert.ok(emptyNetDanger(gk,players,{x:7,y:-14})>emptyNetDanger(gk,players,{x:4,y:-7}));
 assert.ok(keeperNetWeight({traits:{keeperSweep:0}})>keeperNetWeight({traits:{keeperSweep:1}}));
});
test('a stay-at-home keeper prices a carry toward the touchline higher than a sweeper; neither is forbidden',()=>{
 const wide=sweep=>{const {players,gk}=scene(sweep);return carryOptions(gk,players,0,laneRisk).find(o=>o.aim.y<=-10&&o.aim.x<=3.5);};
 const home=wide(.05),sweeper=wide(.9);
 assert.ok(home&&sweeper,'the carry to the touchline is on offer to both');
 assert.ok(home.score<sweeper.score-.02,`stay-at-home ${home.score.toFixed(3)} v sweeper ${sweeper.score.toFixed(3)}`);
});
test('a keeper\'s carry is described by where it goes, not as an attack on goal when it goes sideways',()=>{
 const {players,gk}=scene(.5);
 const side=carryOptions(gk,players,0,laneRisk).filter(o=>Math.abs(o.aim.y-gk.y)>Math.abs(o.aim.x-gk.x)+.5);
 assert.ok(side.length);
 for(const o of side)assert.ok(!/drumul spre poartă/.test(o.reason),o.reason);
});
