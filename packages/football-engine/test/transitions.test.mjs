import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers,teamApproaches} from '../dist/index.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {readTransition} from '../dist/practice-transition.js';
import {laneRisk} from '../dist/practice.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
function situation(side=0,organised=false){
 const ps=practicePlayers(fixture),poses=[[4,0],[7,-4],[9,7],[12,-9],[15,3],[46,0],[28,1],[12,-2],[17,10],[9,4]];
 for(let i=0;i<10;i++){
  const p=ps[(i+(side?5:0))%10];Object.assign(p,{x:side?48-poses[i][0]:poses[i][0],y:poses[i][1],vx:0,vy:0});
 }
 if(organised)ps.filter(p=>p.side!==side&&p.role!=='GK').forEach((p,i)=>Object.assign(p,{x:side?48-(30+i*3):30+i*3,y:i%2?7:-7}));
 const owner=ps.find(p=>p.side===side&&p.role==='GK'),tactics=fixture.teams.map(t=>({...t.tactics,...teamApproaches.counter.settings}));
 return {ps,owner,tactics,ball:{...owner,z:1,vz:0,owner:owner.id,mode:'control'}};
}
test('keeper recoveries invite distinct runs with a reachable release, regardless of job label, on either side',()=>{
 for(const side of [0,1]){
  const {ps,owner,tactics,ball}=situation(side);
  const plan=coordinateFootball(ps,ball,side,tactics,laneRisk,{time:10,recoveredAt:9.9});
  const jobs=ps.filter(p=>p.side===side&&p.id!==owner.id).map(p=>plan.jobs[p.id]);
  const runs=jobs.filter(j=>j.purpose==='break');
  assert(runs.length>=1,'A held ball can launch an attack');
  assert(jobs.some(j=>{const gap=Math.hypot(j.aim.x-owner.x,j.aim.y-owner.y);return gap>=4&&gap<=13&&laneRisk(owner,j.aim,ps.filter(p=>p.side!==side))<.3;}),'At least one chosen position offers a reachable release');
  for(const j of runs){const p=ps.find(p=>p.id===j.player);assert((j.aim.x-p.x)*(side? -1:1)>3);assert(j.speed>p.pace*.8);}
  if(runs.length>1)assert(Math.hypot(runs[0].aim.x-runs[1].aim.x,runs[0].aim.y-runs[1].aim.y)>4);
 }
});
test('recovery recognition distinguishes an exposed opponent from an organised block and expires',()=>{
 const open=situation(),closed=situation(0,true);
 assert(readTransition(open.ps,open.owner,open.tactics[0],.1).open);
 assert(!readTransition(closed.ps,closed.owner,closed.tactics[0],.1).open);
 for(const age of [-1,9])assert(!readTransition(open.ps,open.owner,open.tactics[0],age).open);
 const old=coordinateFootball(open.ps,open.ball,0,open.tactics,laneRisk,{time:10,recoveredAt:9.9});
 const reorganised=coordinateFootball(closed.ps,closed.ball,0,closed.tactics,laneRisk,{time:10.25,recoveredAt:9.9},old);
 assert(!Object.values(reorganised.jobs).some(j=>j.purpose==='break'),'An opponent who has recovered its shape closes the break');
 const expired=coordinateFootball(open.ps,open.ball,0,open.tactics,laneRisk,{time:19,recoveredAt:9.9},old);
 assert(!Object.values(expired.jobs).some(j=>j.purpose==='break'));
});
test('counter recognition and destination generation mirror the same geometry',()=>{
 const a=situation(0),b=situation(1);
 const x=readTransition(a.ps,a.owner,a.tactics[0],1),y=readTransition(b.ps,b.owner,b.tactics[1],1);
 assert.equal(x.open,y.open);assert.equal(x.committed,y.committed);
 // Use identical players for the mirror so skill differences cannot confound it.
 const mirrored=a.ps.map(p=>({...p,side:1-p.side,x:48-p.x,vx:-p.vx,angle:Math.PI-p.angle}));
 const z=readTransition(mirrored,mirrored[0],a.tactics[0],1);
 assert.equal(x.lanes.length,z.lanes.length);
 x.lanes.forEach((l,i)=>{assert(Math.abs(l.aim.x+z.lanes[i].aim.x-48)<1e-8);assert.equal(l.aim.y,z.lanes[i].aim.y);assert(Math.abs(l.advantage-z.lanes[i].advantage)<1e-8);});
});
test('the deepest recovering outfield player can anchor forward runs, then remain cover after passing',()=>{
 const {ps,tactics}=situation();const owner=ps[1];owner.x=7;owner.y=0;
 const ball={x:owner.x,y:owner.y,z:0,vz:0,vx:0,vy:0,owner:owner.id,mode:'control'};
 const plan=coordinateFootball(ps,ball,0,tactics,laneRisk,{time:10,recoveredAt:9.9});
 const runs=Object.values(plan.jobs).filter(j=>ps.find(p=>p.id===j.player)?.side===0&&j.purpose==='break');
 assert(runs.length>=2,'A deep carrier need not wait for a teammate to run behind him');
 assert(Object.values(plan.jobs).some(j=>{
  if(ps.find(p=>p.id===j.player)?.side!==0)return false;
  const gap=Math.hypot(j.aim.x-owner.x,j.aim.y-owner.y);
  return gap>=4&&gap<=13&&laneRisk(owner,j.aim,ps.filter(p=>p.side!==0))<.3;
 }),'The team retains a reachable release; it need not have a particular job label or exclude the keeper');
 const target=ps.find(p=>p.id===runs[0].player);target.x=17;
 const next=coordinateFootball(ps,{...ball,x:target.x,y:target.y,owner:target.id},0,tactics,laneRisk,{time:11,recoveredAt:9.9,lastPass:{from:owner.id,to:target.id,at:11}},plan);
 assert.notEqual(next.jobs[owner.id].kind,'run');assert(next.jobs[owner.id].aim.x<target.x-2,'The passer stays connected behind the attack');
});

test('a runner nearing an agreed destination keeps the opening, but a defender closing it or expiry ends it',()=>{
 const {ps,owner,tactics}=situation();
 const runner=ps[4],aim={x:35,y:7.5};Object.assign(runner,{x:33,y:7.5,vx:5,vy:0});
 const continuation={player:runner.id,aim,until:13};
 const fresh=readTransition(ps,owner,tactics[0],2);
 assert(!fresh.lanes.some(l=>l.player===runner.id&&l.aim.x===aim.x&&l.aim.y===aim.y));
 const continued=readTransition(ps,owner,tactics[0],2,[continuation],12);
 assert(continued.lanes.some(l=>l.player===runner.id&&l.aim===aim),'The same opening remains usable after most of the run is complete');
 assert(!readTransition(ps,owner,tactics[0],2,[continuation],14).lanes.some(l=>l.player===runner.id&&l.aim===aim));
 Object.assign(ps[6],aim);
 assert(!readTransition(ps,owner,tactics[0],2,[continuation],12).lanes.some(l=>l.player===runner.id&&l.aim===aim),'Continuity cannot keep a now occupied destination');
 assert(!readTransition(ps,owner,tactics[0],9,[continuation],12).open);
});

test('a nearly completed counter run remains a real passing option across allocation updates',()=>{
 const {ps,owner,tactics,ball}=situation();const runner=ps[4];
 Object.assign(runner,{x:33,y:7.5,vx:5,vy:0});
 const previous=coordinateFootball(ps,ball,0,tactics,laneRisk,{time:10,recoveredAt:9.9});
 for(const j of Object.values(previous.jobs))if(j.purpose==='break')j.purpose='shape';
 previous.jobs[runner.id]={player:runner.id,purpose:'break',kind:'run',aim:{x:35,y:7.5},speed:runner.pace*.94,reason:'Existing run',since:10,until:14};
 const next=coordinateFootball(ps,ball,0,tactics,laneRisk,{time:11,recoveredAt:9.9},previous);
 assert.equal(next.jobs[runner.id].purpose,'break');
 assert.deepEqual(next.jobs[runner.id].aim,{x:35,y:7.5});
 assert(next.support.moves.some(m=>m.player===runner.id&&m.kind==='run'&&m.aim.x===35));
 Object.assign(ps[6],{x:35,y:7.5});
 const closed=coordinateFootball(ps,ball,0,tactics,laneRisk,{time:11.25,recoveredAt:9.9},next);
 assert(!(closed.jobs[runner.id].purpose==='break'&&closed.jobs[runner.id].aim.x===35&&closed.jobs[runner.id].aim.y===7.5));
});
