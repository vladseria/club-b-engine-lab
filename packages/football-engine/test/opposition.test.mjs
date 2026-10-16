import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,createTrainingSetup,withDefensiveApproach,createSimulationRequest,runSimulation} from '../dist/index.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {laneRisk} from '../dist/practice.js';
import {assignDefense} from '../dist/practice-defense.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(profile,mirror=false){
 const f=withDefensiveApproach(fixture,mirror?0:1,profile),players=practicePlayers(f),setup=createTrainingSetup('middle');
 for(const pose of setup.poses){const p=players.find(p=>p.side===(mirror?1-pose.side:pose.side)&&p.number===pose.number);Object.assign(p,{x:mirror?48-pose.x:pose.x,y:mirror?-pose.y:pose.y,vx:0,vy:0});}
 const owner=players.find(p=>p.side===(mirror?1:0)&&p.number===3),ball={x:owner.x+(mirror?-.62:.62),y:owner.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:owner.id};
 return {f,players,owner,ball,read:()=>coordinateFootball(players,ball,owner.side,f.teams.map(t=>t.tactics),laneRisk,{time:4,recoveredAt:0})};
}
test('defensive approaches change only the selected team tactics and survive serialized match jobs',()=>{
 const original=structuredClone(fixture);
 for(const profile of ['press','compact','tight']){
  const f=withDefensiveApproach(fixture,1,profile);assert.deepEqual(f.teams[0],fixture.teams[0]);assert.deepEqual(f.teams[1].squad,fixture.teams[1].squad);assert.deepEqual(f.teams[1].lineup,fixture.teams[1].lineup);
  for(const key of ['formation','progression','commit','striker'])assert.equal(f.teams[1].tactics[key],fixture.teams[1].tactics[key]);
  const req=createSimulationRequest({kind:'match',fixture:f,durationSeconds:10});const run=runSimulation(JSON.parse(JSON.stringify(req)));assert.deepEqual(run.input.fixture.teams[1].tactics,f.teams[1].tactics);assert(!('setup' in run.input));
 }
 assert.deepEqual(fixture,original);assert.throws(()=>withDefensiveApproach(fixture,1,'bogus'),/Unknown/);
});
test('compact defending waits outside its block but still confronts a dangerous carrier',()=>{
 for(const mirror of [false,true]){
  // Defending rebuild (2026-10-03): Press sets where the carrier's own defender
  // engages. A Selective (compact) block's man waits, goal-side, several metres
  // off a carrier far from its goal; an Aggressive one is on him.
  const compact=scene('compact',mirror),press=scene('press',mirror),a=compact.read(),b=press.read();
  const off=(sc,v)=>{const j=v.jobs[v.defense.presser];return Math.hypot(j.aim.x-sc.owner.x,j.aim.y-sc.owner.y);};
  assert(a.defense.presser&&off(compact,a)>4,`compact waits off him (${off(compact,a).toFixed(2)} m)`);
  assert(b.defense.presser&&off(press,b)<2.2,`press is on him (${off(press,b).toFixed(2)} m)`);
  assert.equal(Object.values(b.jobs).filter(j=>j.purpose==='press').length,1);assert(Object.values(b.jobs).some(j=>j.purpose==='cover'||j.purpose==='screen'));
  // ... but a dangerous carrier near goal is confronted whatever the Press.
  Object.assign(compact.owner,{x:mirror?7:41,y:0});Object.assign(compact.ball,{x:compact.owner.x,y:0});
  const urgent=compact.read();assert(urgent.defense.presser&&off(compact,urgent)<2.5,`compact confronts him near goal (${off(compact,urgent).toFixed(2)} m)`);
 }
});
// Defending round (2026-10-03): every man is owned whatever the Marking; Tight
// follows its men closer (and further from its zones) than a zonal block.
test('tight marking stands closer to its men than a zonal block from the same starting positions',()=>{
 for(const mirror of [false,true]){
  const tight=scene('tight',mirror),compact=scene('compact',mirror),a=tight.read(),b=compact.read();
  assert.equal(new Set(a.marks.values()).size,a.marks.size);
  const gap=(sc,v)=>{const ds=[...v.marks].filter(([id])=>v.jobs[id].purpose==='mark').map(([id,t])=>{const m=sc.players.find(p=>p.id===t),j=v.jobs[id];return Math.hypot(j.aim.x-m.x,j.aim.y-m.y);});return ds.reduce((x,y)=>x+y,0)/ds.length;};
  assert(gap(tight,a)<gap(compact,b)-.5,`tight ${gap(tight,a).toFixed(2)} m vs zonal ${gap(compact,b).toFixed(2)} m`);
  for(const [id,targetId] of a.marks){const marker=tight.players.find(p=>p.id===id),target=tight.players.find(p=>p.id===targetId),j=a.jobs[id];assert.equal(j.target,targetId);assert.notEqual(marker.side,target.side);if(j.purpose==='mark')assert(Math.hypot(j.aim.x-target.x,j.aim.y-target.y)<2.5,`${Math.hypot(j.aim.x-target.x,j.aim.y-target.y).toFixed(2)}`);}
 }
});

function finishingThreat(mirror=false){
 const players=practicePlayers(fixture),poses=[[1,0],[18,6],[39,-12],[30,9],[43,-3],[47,0],[42,-3],[34,-12],[37,-10],[25,7]];
 players.forEach((p,i)=>Object.assign(p,{side:mirror?1-p.side:p.side,x:mirror?48-poses[i][0]:poses[i][0],y:poses[i][1],vx:0,vy:0}));
 const owner=players[2],ball={x:owner.x+(mirror?-.62:.62),y:owner.y,z:0,vx:0,vy:0,vz:0,mode:'control',owner:owner.id};
 const tactics=fixture.teams.map(t=>t.tactics);if(mirror)tactics.reverse();
 return {players,owner,ball,tactics};
}
test('pressure and cover leave the nearby marker with a central finishing threat, on either side',()=>{
 for(const mirror of [false,true]){
  const {players,owner,ball,tactics}=finishingThreat(mirror);
  const read=(time,previous=null)=>coordinateFootball(players,ball,owner.side,tactics,laneRisk,{time,recoveredAt:0},previous);
  const plan=read(4),marker=players[6],receiver=players[4];
  assert.equal(plan.marks.get(marker.id),receiver.id,'Do not send the only nearby marker into the wide cover job');
  assert.equal(plan.defense.presser,players[8].id,'The available nearby defender still closes the carrier');
  assert.equal(plan.defense.coverer,players[7].id,'Cover is assigned without dismantling receiver protection');
  const next=read(4.25,plan);
  assert.deepEqual(next.defense,plan.defense);assert.equal(next.marks.get(marker.id),receiver.id);
 }
});
test('protecting a receiver is a tradeoff, not a veto on the only available defender confronting the ball',()=>{
 const {players,owner,ball,tactics}=finishingThreat();
 const unavailable=new Set(players.slice(7).map(p=>p.id));
 const plan=coordinateFootball(players,ball,owner.side,tactics,laneRisk,{time:4,recoveredAt:0},null,unavailable);
 assert.equal(plan.defense.presser,players[6].id);assert.equal(plan.defense.coverer,'');
 // Defending rebuild (2026-10-03): a defender who cannot go at the ball keeps his man; nobody counts on him to press or cover.
 for(const id of unavailable)assert(plan.defense.presser!==id&&plan.defense.coverer!==id&&!['press','cover','collect'].includes(plan.jobs[id]?.purpose));
});

test('defenders protect simultaneous receiving threats through a pass, and are not dragged after a man who leaves the play',()=>{
 for(const mirror of [false,true]){
  const ps=practicePlayers(fixture),positions=[[3,0],[43,-5],[39,-12],[42,5],[44,0],[47,0],[44,-5],[38,-11],[43,5],[45,0]];
  ps.forEach((p,i)=>Object.assign(p,{side:mirror?1-p.side:p.side,x:mirror?48-positions[i][0]:positions[i][0],y:positions[i][1],vx:0,vy:0}));
  const carrier=ps[2],receiver=ps[4],far=ps[3],marker=ps[8],tactics=fixture.teams.map(t=>({...t.tactics,marking:'balanced'}));if(mirror)tactics.reverse();
  const controlled=p=>({x:p.x,y:p.y,z:0,vx:0,vy:0,vz:0,owner:p.id,mode:'control'});
  const before=structuredClone(ps),plan=coordinateFootball(ps,controlled(carrier),carrier.side,tactics,laneRisk,{time:10,recoveredAt:0});
  // Defending round (2026-10-03): with every man owned, a cover keeps his own
  // man within reach; he never abandons an equally immediate receiver.
  // (recon 2026-10-16, finding 16) this used to check the cover only if there was one, and there never is here: four
  // receivers for four outfielders, so a cover could only come from abandoning one. Said outright:
  assert.equal(plan.defense.coverer,'','Do not manufacture cover by abandoning an equally immediate receiver');
  for(const target of [ps[1],far,receiver])assert([...plan.marks.values()].includes(target.id));
  assert.equal(plan.marks.get(marker.id),far.id);
  const travelling={x:mirror?7:41,y:-7.2,z:0,vz:0,vx:mirror?-5:5,vy:12,owner:null,mode:'pass'};
  const flight=coordinateFootball(ps,travelling,carrier.side,tactics,laneRisk,{time:10.25,recoveredAt:0,passer:carrier.id,intended:receiver.id},plan);
  assert.equal(flight.flight.receiver,receiver.id);assert.equal(flight.marks.get(marker.id),far.id);
  assert.equal(flight.jobs[marker.id].purpose,'mark','A second-ball job must not silently undo the chosen protection');
  const received=coordinateFootball(ps,controlled(receiver),receiver.side,tactics,laneRisk,{time:10.5,recoveredAt:0},flight);
  assert.equal(received.defense.presser,ps[9].id);assert.equal(received.marks.get(marker.id),far.id);
  assert.equal(received.marks.get(ps[7].id),carrier.id,'The old presser now protects the old carrier as a receiving threat');
  assert.deepEqual(ps,before,'Allocation predicts movement without moving bodies');
  far.x=mirror?38:10;
  const released=coordinateFootball(ps,controlled(carrier),carrier.side,tactics,laneRisk,{time:10.75,recoveredAt:0},plan);
  // Defending round: with the receiving threat gone (well behind the ball), his
  // defender still owns him but is no longer pinned to him: he keeps his place in the block.
  const freed=released.jobs[marker.id];assert(Math.hypot(freed.aim.x-far.x,freed.aim.y-far.y)>5,'With the receiving threat gone, his defender is not dragged after him');
 }
});
