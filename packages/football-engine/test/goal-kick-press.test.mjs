import test from 'node:test';
import assert from 'node:assert/strict';
import {restartOptions,GOAL_KICK_CONTEST} from '../dist/practice-restart-live.js';

// A goal kick for side 0 from (3, 0): the keeper's long options to #5 at (22, 2).
const man=(id,side,role,x,y)=>({id,side,role,x,y,vx:0,vy:0});
const restart={kind:'goalKick',side:0,spot:{x:3,y:0},readyAt:0};
const ground={kind:'pass',target:'a5',aim:{x:22,y:2},score:.6,reason:'',pass:{risk:0}};
const loft=(risk=.05)=>({kind:'loft',target:'a5',aim:{x:22,y:2},score:.45,reason:'',loft:{risk}});
const side0=[man('a1',0,'GK',3,0),man('a5',0,'ST',22,2)];

test('against a press the long goal kick goes over it when the ground lane passes a presser',()=>{
 // Two pressers at the edge of the area; one 1.4 m off the ground lane.
 const press=[...side0,man('b2',1,'CM',9.5,2.1),man('b3',1,'ST',10,-7)];
 assert.deepEqual(restartOptions(restart,[ground,loft()],0,press).map(o=>o.kind),['loft']);
 // A press that leaves the lane open: the ground ball stays a choice.
 const wide=[...side0,man('b2',1,'CM',9.5,-6),man('b3',1,'ST',10,7)];
 assert.deepEqual(restartOptions(restart,[ground,loft()],0,wide).map(o=>o.kind),['pass','loft']);
 assert(GOAL_KICK_CONTEST>1.4&&GOAL_KICK_CONTEST<6);
});
test('a loft that is not on is not forced: the kick keeps its ordinary order',()=>{
 const press=[...side0,man('b2',1,'CM',9.5,2.1),man('b3',1,'ST',10,-7)];
 // The loft is risky (0.5 > 0.30): the contested ground ball is still the long option on.
 assert.deepEqual(restartOptions(restart,[ground,loft(.5)],0,press).map(o=>o.kind),['pass']);
 // Without a press nothing changes: the ground ball and the loft both stay.
 const calm=[...side0,man('b2',1,'CM',30,2)];
 assert.deepEqual(restartOptions(restart,[ground,loft()],0,calm).map(o=>o.kind),['pass','loft']);
});
