import test from 'node:test';
import assert from 'node:assert/strict';
import {teamApproaches,validateApproach,createSimulationRequest} from '../dist/index.js';
import {approachInPossession,approachOptions} from '../dist/team-approach.js';
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
test('approaches survive match serialization and reject invalid transition settings',()=>{
 for(const {settings} of Object.values(teamApproaches)){
  const f=structuredClone(fixture);Object.assign(f.teams[0].tactics,settings);
  const request=createSimulationRequest({kind:'match',fixture:f});
  assert.deepEqual(validateApproach(request.input.fixture.teams[0].tactics),settings);
  assert.deepEqual(f.teams[0].squad,fixture.teams[0].squad);
 }
 const f=structuredClone(fixture);f.teams[0].tactics.transition='always-win';
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f}));
 assert.throws(()=>validateApproach({...teamApproaches.direct.settings,commit:Infinity}));
});
test('counter invitations start on a recovery and expire, rather than applying at kickoff or forever',()=>{
 const t=teamApproaches.counter.settings;
 assert.equal(approachInPossession(t,-1).progression,'mixed');
 assert.equal(approachInPossession(t,1).progression,'direct');
 assert.equal(approachInPossession(t,9).progression,'mixed');
 assert.equal(t.progression,'mixed');
});
test('style changes selection without changing execution plans, and mirrors for either team',()=>{
 const pass={risk:.2,speed:15},loft={risk:.3,vz:5};
 const original=[{kind:'pass',aim:{x:14,y:3},score:.5,pass},{kind:'loft',aim:{x:32,y:2},score:.5,loft},{kind:'shoot',aim:{x:48,y:0},score:.9}];
 const p={side:0,x:10,y:0};
 const short=approachOptions(p,original,teamApproaches.combinations.settings),direct=approachOptions(p,original,teamApproaches.direct.settings);
 assert(short[0].score>short[1].score);assert(direct[1].score>direct[0].score);
 assert.equal(short[0].pass,pass);assert.equal(direct[1].loft,loft);assert.equal(direct[2],original[2]);assert.equal(original[0].score,.5);
 const mirrored=approachOptions({side:1,x:38,y:0},original.map(o=>({...o,aim:{x:48-o.aim.x,y:o.aim.y}})),teamApproaches.direct.settings);
 assert.deepEqual(mirrored.map(o=>o.score),direct.map(o=>o.score));
});

test('counter preferences apply to the first recovery decision, without requiring an existing run job',async()=>{
 const {practicePlayers}=await import('../dist/index.js'),{approachForSituation}=await import('../dist/team-approach.js');
 for(const mirror of [false,true]){
  const ps=practicePlayers(fixture),poses=[[4,0],[7,-4],[9,7],[12,-9],[15,3],[46,0],[28,1],[12,-2],[17,10],[9,4]];
  ps.forEach((p,i)=>Object.assign(p,{side:mirror?1-p.side:p.side,x:mirror?48-poses[i][0]:poses[i][0],y:poses[i][1],vx:0,vy:0}));
  const owner=ps[0],t={...fixture.teams[owner.side].tactics,...teamApproaches.counter.settings};
  const invited=approachForSituation(t,ps,owner,.1,[],10);
  assert.equal(invited.progression,'direct');assert.equal(invited.striker,'run');assert(invited.commit>t.commit);
  assert.equal(approachForSituation(t,ps,owner,-1,[],10),t,'No recovery invitation at kickoff');
  assert.equal(approachForSituation(t,ps,owner,9,[],10),t);
  assert.equal(approachForSituation(t,ps,undefined,.1,[],10),t,'Do not assume control of an unclaimed ball');
  ps.filter(p=>p.side!==owner.side&&p.role!=='GK').forEach((p,i)=>Object.assign(p,{x:mirror?48-(30+i*3):30+i*3,y:i%2?7:-7}));
  assert.equal(approachForSituation(t,ps,owner,.2,[],10.1),t,'An organised opponent closes the invitation without waiting for a timer');
 }
});
