import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers,teamApproaches} from '../dist/index.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {laneRisk} from '../dist/practice.js';
import {selectPossessionJobs} from '../dist/practice-job-selection.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
const scenes={
 open:[[3,0],[14,0],[23,0],[26,-8],[28,8],[46,0],[39,0],[16,-7],[15,6],[12,0]],
 pressured:[[3,0],[6,0],[28,0],[32,9],[29,3],[46,0],[34,0],[27,-2],[28,4],[25,0]],
 keeper:[[4,0],[7,-4],[9,7],[12,-9],[15,3],[46,0],[28,1],[12,-2],[17,10],[9,4]],
};
function allocate(scene,style,mirror=false){
 const players=practicePlayers(fixture);
 players.forEach((p,i)=>Object.assign(p,{x:scenes[scene][i][0],y:scenes[scene][i][1],vx:0,vy:0}));
 if(mirror)players.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,angle:Math.PI-p.angle}));
 const owner=players[scene==='keeper'?0:2],before=structuredClone(players);
 const tactics=fixture.teams.map(t=>({...t.tactics,...teamApproaches[style].settings}));
 if(mirror)tactics.reverse();
 const plan=coordinateFootball(players,{...owner,z:0,vz:0,mode:'control',owner:owner.id},owner.side,tactics,laneRisk,{time:10,recoveredAt:scene==='keeper'?9.9:0});
 assert.deepEqual(players,before,'Choosing jobs must not change ability or move players');
 return players.filter(p=>p.side===owner.side&&p.id!==owner.id&&p.role!=='GK').map(p=>plan.jobs[p.id]);
}
const runners=jobs=>jobs.filter(j=>j.kind==='run').length;
test('ordinary possession can choose multiple runs or no run; tactical preference changes the mix',()=>{
 for(const mirror of [false,true]){
  const direct=allocate('open','direct',mirror),patient=allocate('open','combinations',mirror);
  assert(runners(direct)>=2,'Two forward invitations must be possible without a custom instruction');
  assert(runners(patient)<runners(direct),'The same geometry should also support a short-play alternative');
  assert(runners(allocate('keeper','counter',mirror))>2,'An exposed opponent can warrant more than the former two-run cap');
  for(const jobs of [direct,patient])for(let i=0;i<jobs.length;i++)for(let j=i+1;j<jobs.length;j++)
   assert(Math.hypot(jobs[i].aim.x-jobs[j].aim.x,jobs[i].aim.y-jobs[j].aim.y)>2,'Multiple runs must offer distinct destinations');
 }
});
test('whole-team selection does not reserve a runner when the useful alternatives are short',()=>{
 const players=practicePlayers(fixture),focus=players[2],mates=players.filter(p=>p.side===0&&p.role!=='GK'&&p.id!==focus.id);
 const candidates=new Map(mates.map(p=>[p.id,[
  {job:{player:p.id,purpose:'outlet',kind:'support',aim:{x:p.x,y:p.y},speed:p.pace,since:0,until:2,reason:''},score:5},
  {job:{player:p.id,purpose:'depth',kind:'run',aim:{x:45,y:p.y},speed:p.pace,since:0,until:2,reason:''},score:-5}
 ]]));
 assert.equal(runners(selectPossessionJobs(players,focus,mates,fixture.teams[0].tactics,laneRisk,candidates,new Set(),0)),0);
 const runner=mates[0],fixed=candidates.get(runner.id)[1];candidates.set(runner.id,[fixed]);
 assert.equal(selectPossessionJobs(players,focus,mates,fixture.teams[0].tactics,laneRisk,candidates,new Set([runner.id]),0).find(j=>j.player===runner.id),fixed.job,'An authored responsibility must survive ordinary role preferences');
});

test('a useful developing position survives pruning against a nearby stationary option',()=>{
 const ps=practicePlayers(fixture),focus=ps[2],p=ps[4];
 ps.forEach(q=>Object.assign(q,{x:q.side?43:3,y:q.side?-12:12,vx:0,vy:0}));
 Object.assign(focus,{x:28,y:0});Object.assign(p,{x:14,y:6});
 const make=(x,score)=>({score,job:{player:p.id,purpose:'outlet',kind:'support',aim:{x,y:6},speed:p.pace,since:0,until:4,reason:''}});
 const still=make(14,1),join=make(24,.95);
 const selected=selectPossessionJobs(ps,focus,[p],{...fixture.teams[0].tactics,...teamApproaches.balanced.settings},()=>0,new Map([[p.id,[still,join]]]),new Set(),0);
 assert.equal(selected[0],join.job,'The player can prepare a better position even when staying is cheaper immediately');
});

test('joint selection can use different destinations in the same directional sector',()=>{
 const ps=practicePlayers(fixture),focus=ps[2],mates=[ps[3],ps[4]];
 ps.forEach(p=>Object.assign(p,{x:p.side?45:5,y:p.side?-13:13,vx:0,vy:0}));Object.assign(focus,{x:20,y:0});
 Object.assign(mates[0],{x:26,y:4});Object.assign(mates[1],{x:26,y:10});
 const candidates=new Map(mates.map(p=>[p.id,[{x:28,y:6},{x:29,y:11}].map((aim,i)=>({score:1-i*.1,job:{player:p.id,purpose:'outlet',kind:'support',aim,speed:p.pace,since:0,until:4,reason:''}}))]));
 const jobs=selectPossessionJobs(ps,focus,mates,fixture.teams[0].tactics,()=>0,candidates,new Set(),0);
 assert(Math.hypot(jobs[0].aim.x-jobs[1].aim.x,jobs[0].aim.y-jobs[1].aim.y)>3,'A shared direction is not a shared destination');
});
