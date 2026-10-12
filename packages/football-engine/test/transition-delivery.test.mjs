import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers,teamApproaches} from '../dist/index.js';
import {readTransition} from '../dist/practice-transition.js';
import {approachForSituation} from '../dist/team-approach.js';
import {groundPass} from '../dist/practice-passing.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
const tactics={...fixture.teams[0].tactics,...teamApproaches.counter.settings};
function situation(run=false,mirror=false){
 const f=structuredClone(fixture);f.teams[1]={...structuredClone(f.teams[0]),id:'mirror'};
 const ps=practicePlayers(f),poses=[[4,0],[run?20:29,-10],[6,10],[8,12],[run?31.5:41.5,-4.5],[46,0],[34,6],[36,5],[39,8],[41,6]];
 poses.forEach(([x,y],i)=>Object.assign(ps[i],{x,y,vx:0,vy:0,angle:ps[i].side?Math.PI:0}));
 if(mirror)for(const p of ps)Object.assign(p,{side:1-p.side,x:48-p.x,vx:-p.vx,angle:Math.PI-p.angle});
 return {ps,owner:ps[1],receiver:ps[4]};
}
test('an advanced receiver can launch a counter without needing another forward run',()=>{
 for(const mirror of [false,true]){
  const {ps,owner,receiver}=situation(false,mirror),before=structuredClone(ps);
  const passBefore=groundPass(owner,receiver,false,undefined,owner,ps.filter(p=>p.side!==owner.side));
  const read=readTransition(ps,owner,tactics,.2);
  assert(read.open);assert(read.outlets.some(o=>o.player===receiver.id));
  assert(!read.lanes.some(o=>o.player===receiver.id),'Holding a useful position is not a compulsory new run');
  assert.equal(approachForSituation(tactics,ps,owner,.2).progression,'direct');
  assert.deepEqual(ps,before,'Recognition must not move players or alter skills');
  assert.deepEqual(groundPass(owner,receiver,false,undefined,owner,ps.filter(p=>p.side!==owner.side)),passBefore,'Recognition cannot improve execution');
  for(const age of [-1,9])assert(!readTransition(ps,owner,tactics,age).open);
 }
});
test('a deliverable run can start in front of defenders, without the old committed-opponent prerequisite',()=>{
 const reads=[];
 for(const mirror of [false,true]){
  const {ps,owner,receiver}=situation(true,mirror),read=readTransition(ps,owner,tactics,.2);
  assert.equal(read.committed,0);assert(read.open);
  assert(read.lanes.some(o=>o.player===receiver.id));reads.push(read);
 }
 assert.equal(reads[0].lanes.length,reads[1].lanes.length);
 reads[0].lanes.forEach((o,i)=>{assert(Math.abs(o.aim.x+reads[1].lanes[i].aim.x-48)<1e-8);assert(Math.abs(o.advantage-reads[1].lanes[i].advantage)<1e-8);});
});
test('an advanced position does not open a counter when the pass is blocked or pressure arrives first',()=>{
 for(const mirror of [false,true])for(const blocked of [true,false]){
  const {ps,owner,receiver}=situation(false,mirror);
  Object.assign(ps[6],blocked?{x:(owner.x+receiver.x)/2,y:(owner.y+receiver.y)/2}:{x:receiver.x+(mirror?2:-2),y:receiver.y,vx:mirror?-5:5});
  assert(!readTransition(ps,owner,tactics,.2).outlets.some(o=>o.player===receiver.id));
 }
});

test('delivery recognition mirrors moving players and an awkward release stance without mutating them',()=>{
 const {ps,owner}=situation(true);
 ps.forEach((p,i)=>Object.assign(p,{vx:i%2?3:-2,vy:i%3-1,angle:i%2?2.8:-.7}));
 const before=structuredClone(ps),mirrored=ps.map(p=>({...p,side:1-p.side,x:48-p.x,vx:-p.vx,angle:Math.PI-p.angle}));
 const a=readTransition(ps,owner,tactics,.2),b=readTransition(mirrored,mirrored[1],tactics,.2);
 assert.equal(a.open,b.open);assert.equal(a.committed,b.committed);
 for(const key of ['lanes','outlets']){
  assert.equal(a[key].length,b[key].length);
  a[key].forEach((o,i)=>{assert(Math.abs(o.aim.x+b[key][i].aim.x-48)<1e-8);assert.equal(o.aim.y,b[key][i].aim.y);assert(Math.abs(o.advantage-b[key][i].advantage)<1e-8);});
 }
 assert.deepEqual(ps,before);
});
