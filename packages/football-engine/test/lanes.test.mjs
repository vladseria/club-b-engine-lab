import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {teammatePassObstruction,laneObstruction} from '../dist/practice-lanes.js';
import {groundOptions} from '../dist/practice-passing.js';
import {laneRisk} from '../dist/practice.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

test('friendly pass obstruction distinguishes a blocking teammate, a clearing run and the actual receiver',()=>{
 const ps=practicePlayers(fixture);ps.forEach(p=>Object.assign(p,{x:3,y:12,vx:0,vy:0}));
 const [p,q,m]=[ps[2],ps[3],ps[4]];Object.assign(p,{x:15,y:0});Object.assign(q,{x:27,y:0});Object.assign(m,{x:21,y:0});
 const snapshot=structuredClone(ps),blocked=teammatePassObstruction(p,q,q,ps,1);
 assert(blocked>.9);assert.deepEqual(ps,snapshot);
 Object.assign(m,{vy:5});assert(teammatePassObstruction(p,q,q,ps,1)<blocked);
 Object.assign(m,{x:30,vy:0});assert.equal(teammatePassObstruction(p,q,q,ps,1),0);
 const mirror=v=>({x:48-v.x,y:-v.y});assert.equal(laneObstruction(p,q,{x:21,y:.4}),laneObstruction(mirror(p),mirror(q),mirror({x:21,y:.4})));
});
test('a friendly body affects the desire to pass without altering the physical delivery plan',()=>{
 const ps=practicePlayers(fixture);ps.forEach(p=>Object.assign(p,{x:3,y:12,vx:0,vy:0}));
 const [p,q,m]=[ps[2],ps[3],ps[4]];Object.assign(p,{x:15,y:0});Object.assign(q,{x:27,y:0});Object.assign(m,{x:21,y:0});
 // A perfect reader of typical temperament (R2): the team-mate moving then
 // changes only the lane read, not the passer's read of who arrives where.
 Object.assign(p.skills,{reading:10,passing:10});p.traits.risk=.45;
 const blocked=groundOptions(p,q,ps,false,undefined,p,laneRisk)[0];Object.assign(m,{y:8});
 const clear=groundOptions(p,q,ps,false,undefined,p,laneRisk)[0];
 assert.deepEqual(blocked.pass,clear.pass);assert(blocked.score<clear.score-.5);
});
