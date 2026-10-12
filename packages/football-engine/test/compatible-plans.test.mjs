import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PracticePlaybook,createTrainingSetup} from '../dist/practice-playbook.js';
import {practicePlayers,practiceOptions,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const base=(id,rest)=>({id,name:id,weight:100,emphasis:1,instructions:[],preferred:null,...rest});
const start={mode:'all',conditions:[{kind:'start'}]};
function scene(side=0){
 const players=practicePlayers(fixture),setup=createTrainingSetup('middle');
 for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),pose,{vx:0,vy:0});
 if(side)for(const p of players)Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI});
 const owner=players.find(p=>p.side===side&&p.number===3);
 const ball={x:owner.x+Math.cos(owner.angle)*.62,y:owner.y+Math.sin(owner.angle)*.62,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'};
 return {players,owner,ball};
}
const run=(id,n)=>base(id,{instructions:[{number:n,action:'run',dx:5,dy:0,delay:0}]});
const hold=(id,n)=>base(id,{steps:[{id:'same-step',actor:n,action:'hold',target:{kind:'point',x:11,y:0},when:start}]});
test('independent plans publish both runs through the real coordinator on either side',()=>{
 for(const side of [0,1]){
  const {players,owner,ball}=scene(side),book=new PracticePlaybook({side,plans:[run('left',4),run('right',5)]},2026);
  book.recover(0,owner,players,laneRisk,ball);book.advance(.1,side,false,ball,players);
  assert.equal(book.selections.filter(s=>s.status==='active').length,2);
  const view=coordinateFootball(players,ball,side,fixture.teams.map(t=>t.tactics),laneRisk,{time:.1,recoveredAt:0,responsibilities:preview=>book.apply(.1,players,ball,preview,null)});
  for(const n of [4,5]){const p=players.find(p=>p.side===side&&p.number===n);assert.equal(view.jobs[p.id].purpose,'playbook');assert.equal(view.jobs[p.id].aim.x,p.x+(side?-5:5));assert(view.support.moves.some(m=>m.player===p.id));}
 }
});
test('overlapping plans wait with a named conflict instead of overwriting the earlier selection',()=>{
 const {players,owner,ball}=scene(),book=new PracticePlaybook({side:0,plans:[run('A',4),run('B',4),run('C',5)]},2026);
 book.recover(0,owner,players,laneRisk,ball);
 const active=book.selections.filter(s=>s.status==='active'),blocked=book.selections.find(s=>s.status==='fallback').candidates.find(c=>c.blockedBy);
 assert.equal(active.length,2);assert(active.some(s=>s.planId==='C'));assert.equal(blocked.blockedBy.length,1);assert(active.some(s=>s.planId===blocked.blockedBy[0]));
 book.advance(.5,0,false,ball,players);assert.equal(book.selections.filter(s=>s.status==='active').length,2);
 book.end(1,'loss');assert(active.every(s=>s.endReason==='loss'&&s.endDetail));
});
test('equal action IDs in separate plans cannot authorize each other’s prepared kicks',()=>{
 const {players,owner,ball}=scene(),receiver=players.find(p=>p.side===0&&p.number===5);
 const pass=base('pass',{steps:[{id:'same-step',actor:3,action:'pass',target:{kind:'player',number:5},delivery:'ground',when:start}]});
 const book=new PracticePlaybook({side:0,plans:[pass,hold('hold',2)]},2026);
 book.recover(0,owner,players,laneRisk,ball);book.advance(.1,0,false,ball,players);
 const options=book.options(.1,owner,players,ball,null,practiceOptions(owner,players,new Set(),' ',0,null,.1,null));
 const kick=options.find(o=>o.teachingStep&&o.target===receiver.id);assert(kick);assert.equal(kick.teachingPlan,'pass');
 assert(book.canRelease(.1,owner,kick,players,ball,null));
 assert(!book.canRelease(.1,owner,{...kick,teachingPlan:'hold'},players,ball,null));
 assert(book.actionActive('same-step','pass'));assert(!book.actionActive('same-step','missing'));
 book.released(.2,owner,kick);
 assert(book.selections.find(s=>s.planId==='pass').trace.some(t=>t.phase==='released'));
 assert(!book.selections.find(s=>s.planId==='hold').trace.some(t=>t.phase==='released'));
});
test('named pass recipients are reserved even if they have no explicit run instruction',()=>{
 const {players,owner,ball}=scene();
 const pass=base('pass',{steps:[{id:'pass',actor:3,action:'pass',target:{kind:'player',number:5},when:start}]});
 const book=new PracticePlaybook({side:0,plans:[pass,hold('other',5)]},2026);
 book.recover(0,owner,players,laneRisk,ball);
 assert.equal(book.selections.filter(s=>s.status==='active').length,1);
 assert(book.selections.some(s=>s.candidates.some(c=>c.blockedBy?.length)));
});
test('a dynamic receiver conflict ends one passage with an explanation, without inventing a receipt',()=>{
 const {players,owner,ball}=scene(),receiver=players.find(p=>p.side===0&&p.number===2);
 const pass=base('flexible',{steps:[{id:'pass',actor:3,action:'pass',target:{kind:'free'},fallback:true,when:start},{id:'next',actor:{receiverOf:'pass'},action:'shoot',when:{mode:'all',conditions:[{kind:'received',stepId:'pass'}]}}]});
 const book=new PracticePlaybook({side:0,plans:[pass,hold('hold',2)],adaptive:true},2026);
 book.recover(0,owner,players,laneRisk,ball);book.advance(.1,0,false,ball,players);
 assert.equal(book.selections.filter(s=>s.status==='active').length,2);
 book.released(.2,owner,{kind:'pass',target:receiver.id,aim:receiver,score:1,reason:'real pass',teachingStep:'pass',teachingPlan:'flexible'});
 book.received(1,receiver,owner.id,true,players,{...ball,x:receiver.x,y:receiver.y,owner:receiver.id});
 const ended=book.selections.find(s=>s.endReason==='conflict');assert(ended?.endDetail.includes('participă deja'));
 assert.equal(book.selections.filter(s=>s.status==='active').length,1);
 const flexible=book.selections.find(s=>s.planId==='flexible');assert(flexible.trace.some(t=>t.phase==='received'&&t.actor===owner.id));
});
test('an expired compatible plan does not terminate the other plan and disabled plans add nothing',()=>{
 const {players,owner,ball}=scene(),book=new PracticePlaybook({side:0,plans:[run('short',4),hold('long',2),{...run('disabled',5),emphasis:0}]},2026);
 book.recover(0,owner,players,laneRisk,ball);book.advance(.1,0,false,ball,players);book.advance(6.1,0,false,ball,players);
 assert.equal(book.selections.find(s=>s.planId==='short').endReason,'duration');
 assert.equal(book.selections.find(s=>s.planId==='long').status,'active');
 assert(!book.selections.some(s=>s.planId==='disabled'));
});
