import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers,teamApproaches,createTrainingSetup,runTraining} from '../dist/index.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {laneRisk} from '../dist/practice.js';
import {steerMotion} from '../dist/movement.js';
import {readNextConnection} from '../dist/practice-connections.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
const set=(ps,positions)=>ps.forEach((p,i)=>Object.assign(p,{x:positions[i][0],y:positions[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
const ball=p=>({...p,z:0,vz:0,owner:p.id,mode:'control'});

test('a deep wide player starts reconnecting during a recovery, without requiring a counterattack style',()=>{
 for(const mirror of [false,true])for(const style of ['balanced','combinations','counter']){
  const ps=practicePlayers(fixture);set(ps,[[3,0],[5,-2],[1.2,1.3],[10,-7],[17,-5],[46,0],[31,-2],[18,-4],[13,1],[13,3]]);
  if(mirror)ps.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI}));
  const owner=ps[3],wing=ps[2],s=mirror?-1:1,start=wing.x;
  const tactics=fixture.teams.map(t=>({...t.tactics,...teamApproaches[style].settings}));let plan=null;
  // Hold the visible opposition fixed to isolate the team's recovery response;
  // execute every selected movement with the same acceleration as the match.
  for(let tick=0;tick<6;tick++){
   const time=tick*.25;owner.x=(mirror?38:10)+s*time*2;owner.vx=s*2;
   plan=coordinateFootball(ps,ball(owner),owner.side,tactics,laneRisk,{time,recoveredAt:0},plan);
   for(const p of ps.filter(p=>p.side===owner.side&&p!==owner)){
    const job=plan.jobs[p.id];if(!job)continue;
    for(let i=0;i<15;i++)steerMotion(p,job.aim,1/60,job.speed);
   }
  }
  assert((wing.x-start)*s>3,`${style}: the wide player should already be joining while the attack develops`);
 }
});

test('a keeper chooses a return angle in possession and protects the goal when the carrier is threatened',()=>{
 for(const mirror of [false,true]){
  const ps=practicePlayers(fixture);set(ps,[[3,0],[15,0],[22,-8],[31,-8],[34,7],[46,0],[37,0],[30,-7],[32,9],[40,0]]);
  if(mirror)ps.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI}));
  const owner=ps[2],keeper=ps[0],tactics=fixture.teams.map(t=>({...t.tactics,...teamApproaches.balanced.settings})),depth=x=>mirror?48-x:x;
  const read=()=>coordinateFootball(ps,ball(owner),owner.side,tactics,laneRisk,{time:10,recoveredAt:0});
  const before=structuredClone(ps),open=read().jobs[keeper.id];assert(open);assert.deepEqual(ps,before);
  assert(depth(open.aim.x)>depth(keeper.x)+1);assert(open.aim.y*owner.y>0,'Offer an angle towards the ball side');
  Object.assign(ps[7],{x:owner.x+(mirror?-1:1),y:owner.y});
  const dangerous=read().jobs[keeper.id];assert(depth(dangerous.aim.x)<depth(open.aim.x));
  const lost=coordinateFootball(ps,ball(ps[7]),ps[7].side,tactics,laneRisk,{time:10.25,recoveredAt:10.25});
  assert.equal(lost.jobs[keeper.id],undefined,'Losing possession releases the keeper to his live defensive controller');
 }
});

test('the live training simulation executes goalkeeper support through ordinary movement',()=>{
 const setup=createTrainingSetup('middle'),positions=[[3,0],[15,0],[22,-8],[31,-8],[34,7],[46,0],[37,0],[30,-7],[32,9],[40,0]];
 setup.poses.forEach((p,i)=>Object.assign(p,{x:positions[i][0],y:positions[i][1],angle:p.side?Math.PI:0}));setup.ball={side:0,number:3,x:22.62,y:-8};
 const result=runTraining({fixture,setup,durationSeconds:10}).result,index=result.players.findIndex(p=>p.side===0&&p.role==='GK');
 const start=result.frames[0].players[index],moved=result.frames.find(f=>f.time>=.5).players[index];
 assert(moved.x>start.x+.15&&moved.y<start.y-.15,'A published keeper support job must actually move him');
});

function connectionScene(){
 const ps=practicePlayers(fixture);set(ps,[[3,0],[18,-8],[20,0],[28,0],[8,-10],[46,0],[22,0],[30,-9],[40,11],[5,-12]]);
 Object.assign(ps[1].skills,{passing:9,control:9});return ps;
}
test('an onward pass reads a stationary teammate’s active route, and forgets expired or unrelated plans',()=>{
 const ps=connectionScene(),p=ps[2],q=ps[1],runner=ps[3],before=structuredClone(ps);
 const support={owner:p.id,side:p.side,moves:[{player:runner.id,purpose:'channel',kind:'run',aim:{x:36,y:0},speed:runner.pace,since:10,until:14,reason:''}]};
 const read=(s=support,time=10)=>readNextConnection(p,q,q,ps,.8,laneRisk,{support:s,time});
 const ordinary=read(null),planned=read();assert(planned.gain>ordinary.gain+.03);assert.equal(planned.target,runner.id);assert.deepEqual(ps,before);
 assert.deepEqual(read(support,14),ordinary);assert.deepEqual(read({...support,owner:q.id}),ordinary);assert.deepEqual(read({...support,side:1-p.side}),ordinary);
 const blocked=structuredClone(support);blocked.moves[0].aim={x:26,y:-8};assert(read(blocked).gain<ordinary.gain);
});

test('a stationary passer can consider moving for a return, but a closed wall pass gets no credit',()=>{
 const ps=connectionScene(),p=ps[2],q=ps[1];Object.assign(ps[3],{x:3,y:12});Object.assign(ps[4],{x:3,y:12});
 const read=readNextConnection(p,q,q,ps,.8,laneRisk);assert(read.gain>0);assert.equal(read.target,p.id);assert(read.continuation);assert(read.continuation.aim.x>p.x);
 Object.assign(ps[6],{x:q.x+1,y:q.y});assert.equal(readNextConnection(p,q,q,ps,.8,laneRisk).gain,0);
});

test('a selected pass-and-move follows the evaluated route until that route closes',()=>{
 const ps=connectionScene(),p=ps[2],q=ps[1];Object.assign(ps[3],{x:3,y:12});Object.assign(ps[4],{x:3,y:12});
 const delivery=readNextConnection(p,q,q,ps,.8,laneRisk);assert(delivery.continuation);
 const context={time:10,recoveredAt:0,lastPass:{from:p.id,to:q.id,at:10},passContinuation:{from:p.id,to:q.id,...delivery.continuation,until:13}};
 const tactics=fixture.teams.map(t=>({...t.tactics,...teamApproaches.combinations.settings}));
 const read=()=>coordinateFootball(ps,ball(q),q.side,tactics,laneRisk,context).jobs[p.id];
 assert.deepEqual(read().aim,delivery.continuation.aim,'The selected pass must not rely on a run its passer immediately discards');
 Object.assign(ps[6],delivery.continuation.aim);
 assert.notDeepEqual(read().aim,delivery.continuation.aim,'A new defender occupying the route releases the movement commitment');
});

test('a third teammate keeps the movement used by a released pass, with live escape conditions',()=>{
 for(const mirror of [false,true]){
  const ps=connectionScene();
  if(mirror)ps.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI}));
  const p=ps[2],q=ps[1],runner=ps[3],aim={x:mirror?12:36,y:0};
  const support={owner:p.id,side:p.side,moves:[{player:runner.id,purpose:'channel',kind:'run',aim,speed:runner.pace,since:9,until:10.1,reason:''}]};
  const delivery=readNextConnection(p,q,q,ps,.8,laneRisk,{support,time:10});
  assert.equal(delivery.target,runner.id);assert.equal(delivery.continuation?.player,runner.id);
  const context={time:10.8,recoveredAt:0,lastPass:{from:p.id,to:q.id,at:10.8},passContinuation:{from:p.id,to:q.id,...delivery.continuation,until:12}};
  const tactics=fixture.teams.map(t=>({...t.tactics,...teamApproaches.combinations.settings}));
  const read=(ctx=context,owner=q)=>coordinateFootball(ps,ball(owner),owner.side,tactics,laneRisk,ctx);
  const travelling={x:p.x,y:p.y,z:0,vz:0,vx:(q.x-p.x)/.8,vy:(q.y-p.y)/.8,mode:'pass',owner:null};
  const during=coordinateFootball(ps,travelling,p.side,tactics,laneRisk,{...context,time:10.1,lastPass:undefined,passer:p.id,intended:q.id});
  assert.equal(during.flight.receiver,q.id);assert.deepEqual(during.jobs[runner.id].aim,aim,'The movement is shared while the first pass travels, not only after receipt');
  const job=read().jobs[runner.id];assert.deepEqual(job.aim,aim,'The third-player route survives the first pass, even if its old timer expired');
  assert.equal(job.target,q.id);
  const expired=read({...context,time:12.1}).jobs[runner.id];assert.notEqual(expired.reason,job.reason);
  const different=read({...context,lastPass:{from:p.id,to:ps[4].id,at:10.8}},ps[4]).jobs[runner.id];assert.notEqual(different.reason,job.reason);
  const unavailable=coordinateFootball(ps,ball(q),q.side,tactics,laneRisk,context,null,new Set([runner.id]));assert.notEqual(unavailable.jobs[runner.id]?.reason,job.reason);
  const instructed=read({...context,responsibilities:()=>({owner:q.id,side:q.side,moves:[{...support.moves[0],purpose:'playbook',aim:{x:mirror?23:25,y:5},until:14}]})});
  assert.deepEqual(instructed.jobs[runner.id].aim,{x:mirror?23:25,y:5});
  Object.assign(ps[8],aim);
  assert.notEqual(read().jobs[runner.id].reason,job.reason,'An opponent occupying the receiving destination releases the commitment');
 }
});
