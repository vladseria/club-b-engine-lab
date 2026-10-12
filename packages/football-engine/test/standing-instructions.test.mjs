import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PracticePlaybook,validatePlans} from '../dist/practice-playbook.js';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {runMatch,runTraining,createTrainingSetup} from '../dist/index.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const plan=(standing,extra={})=>({id:'policy',name:'Policy',weight:100,emphasis:1,instructions:[],preferred:null,lesson:{spaces:[{id:'area',name:'Area',x:39,y:5,radius:3}],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[]},standing,...extra});
function scene(side=0){
 const players=practicePlayers(fixture),poses=[[2,0],[12,0],[15,-8],[20,6],[32,4],[46,0],[28,0],[21,-2],[30,-8],[36,8]];
 players.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0}));
 if(side)players.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI}));
 const owner=players.find(p=>p.side!==side&&p.number===3),ball={x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'};
 return {players,owner,ball,side,tactics:fixture.teams.map(t=>t.tactics)};
}
function coord(s,book,time=0,previous=null,unavailable=new Set()){
 return coordinateFootball(s.players,s.ball,s.owner.side,s.tactics,laneRisk,{time,recoveredAt:0,responsibilities:preview=>book.persistent(time,s.players,s.ball,preview.attacking,s.tactics[s.side],preview,unavailable,null)},previous,unavailable);
}
test('persistent press and mark are included in the complete defensive allocation, mirrored',()=>{
 for(const side of [0,1]){
  const s=scene(side),book=new PracticePlaybook({side,plans:[plan([{id:'press',actor:4,kind:'press',phase:'defending'},{id:'mark',actor:2,kind:'mark',opponent:4,phase:'defending'}])]},2026),v=coord(s,book);
  const presser=s.players.find(p=>p.side===side&&p.number===4),marker=s.players.find(p=>p.side===side&&p.number===2),target=s.players.find(p=>p.side!==side&&p.number===4);
  assert.equal(v.defense.presser,presser.id);assert.equal(v.jobs[presser.id].purpose,'playbook');assert.equal(v.marks.get(marker.id),target.id);
  assert.equal([...v.marks.values()].filter(id=>id===target.id).length,1);assert.notEqual(v.defense.coverer,marker.id);
  assert(book.standing.notes.filter(n=>n.status==='active').length===2);
  s.ball.owner=target.id;s.owner=target;
  const next=coord(s,book,.25,v);assert([marker.id,presser.id].includes(next.defense.presser));assert(['press','jockey'].includes(next.jobs[marker.id].kind));assert(!next.marks.has(marker.id));
 }
});
test('staying forward can deliberately leave no outfield press or cover; there is no compulsory defensive quota',()=>{
 const s=scene(),book=new PracticePlaybook({side:0,plans:[plan([2,3,4,5].map(actor=>({id:'stay'+actor,actor,kind:'stay-forward',spaceId:'area',phase:'always'})))]},2026),v=coord(s,book);
 assert.equal(v.defense.presser,'');assert.equal(v.defense.coverer,'');assert.equal(v.marks.size,0);
 for(const p of s.players.filter(p=>p.side===0&&p.role!=='GK')){assert.equal(v.jobs[p.id].aim.x,39);assert.equal(v.jobs[p.id].purpose,'playbook');}
});
test('defensive policy survives loss and recovery while own-ball decisions and real receivers take priority',()=>{
 const s=scene(),book=new PracticePlaybook({side:0,plans:[plan([{id:'press',actor:4,kind:'press',phase:'defending'}])]},2026),first=coord(s,book);
 const p=s.players.find(p=>p.side===0&&p.number===4);assert.equal(first.defense.presser,p.id);
 book.end(.5,'loss');s.owner=p;s.ball.owner=p.id;s.ball.x=p.x;s.ball.y=p.y;
 coord(s,book,1);assert.equal(book.standing.notes.at(-1).status,'inactive');
 s.owner=s.players.find(q=>q.side===1&&q.number===3);s.ball.owner=s.owner.id;
 const returned=coord(s,book,2);assert.equal(returned.defense.presser,p.id);
 const unavailable=coord(s,book,2.25,returned,new Set([p.id]));assert.notEqual(unavailable.defense.presser,p.id);assert.equal(book.standing.notes.at(-1).status,'waiting');
 const flight={...s.ball,owner:null,mode:'pass',vx:10};
 const preview={flight:{hunters:[p.id],receiver:p.id}};
 assert.equal(book.persistent(3,s.players,flight,1,s.tactics[0],preview,new Set(),null),null);
 assert.match(book.standing.notes.at(-1).text,/primirea/);
});
test('standing conflicts are resolved once per player and disabled policies leave ordinary allocation unchanged',()=>{
 const s=scene(),a=plan([{id:'press',actor:4,kind:'press',phase:'defending'}]),b=plan([{id:'zone',actor:4,kind:'protect',spaceId:'area',phase:'defending'}],{id:'other',name:'Other',weight:10});
 const book=new PracticePlaybook({side:0,plans:[a,b]},2026),v=coord(s,book),p=s.players.find(p=>p.side===0&&p.number===4);
 assert.equal(v.defense.presser,p.id);assert(book.standing.notes.some(n=>n.planId==='other'&&n.status==='waiting'));
 const off=new PracticePlaybook({side:0,plans:[{...a,emphasis:0}]},2026),ordinary=coordinateFootball(s.players,s.ball,s.owner.side,s.tactics,laneRisk,{time:0,recoveredAt:0});
 assert.deepEqual(coord(s,off),ordinary);
});
test('emphasis affects whole possession phases, not twitching or physical player attributes',()=>{
 const s=scene(),before=structuredClone(s.players);let selected=0;
 for(let seed=0;seed<100;seed++){
  const book=new PracticePlaybook({side:0,plans:[plan([{id:'press',actor:4,kind:'press',phase:'defending'}],{emphasis:.5})]},seed);
  const a=coord(s,book),count=book.standing.notes.length;
  for(const time of [.25,.5,.75])coord(s,book,time,a);
  assert.equal(book.standing.notes.length,count);if(book.standing.notes[0].status==='active')selected++;
 }
 assert(selected>25&&selected<75);assert.deepEqual(s.players,before);
});
test('persistent plans validate their areas and actor uniqueness, and run through both public simulation paths',()=>{
 assert.throws(()=>validatePlans([plan([{id:'bad',actor:3,kind:'protect',phase:'always',spaceId:'missing'}])]));
 assert.throws(()=>validatePlans([plan([{id:'a',actor:3,kind:'press',phase:'defending'},{id:'b',actor:3,kind:'mark',opponent:2,phase:'defending'}])]));
 const p=plan([{id:'stay',actor:5,kind:'stay-forward',spaceId:'area',phase:'always'},{id:'press',actor:4,kind:'press',phase:'defending'}]);
 for(const mode of ['match','training']){
  const result=(mode==='match'?runMatch:runTraining)({fixture,durationSeconds:40,...(mode==='training'?{setup:createTrainingSetup('middle')} :{}),playbook:{side:0,plans:[p],adaptive:true}}).result;
  assert(result.standingNotes.some(n=>n.status==='active'));assert(result.standingNotes.some(n=>n.kind==='press'&&n.status==='active'));
  assert(result.frames.some(f=>f.players.some(q=>q.duty==='press'||q.duty==='jockey')));
 }
});
test('a live attacking combination keeps its participants while a separate standing outlet remains available',()=>{
 const s=scene();s.owner=s.players.find(p=>p.side===0&&p.number===3);Object.assign(s.ball,{owner:s.owner.id,x:s.owner.x+.62,y:s.owner.y});
 const p=plan([{id:'overlap',actor:4,kind:'protect',phase:'always',spaceId:'area'},{id:'forward',actor:5,kind:'stay-forward',phase:'always',spaceId:'area'}],{lesson:{spaces:[{id:'area',name:'Area',x:36,y:9,radius:3}],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[{id:'run',actor:4,kind:'run',spaceId:'area',momentId:'start'}]}});
 const book=new PracticePlaybook({side:0,plans:[p],adaptive:true},2026);book.recover(0,s.owner,s.players,laneRisk,s.ball);book.advance(.1,0,false,s.ball,s.players);
 assert(book.selections.some(a=>a.planId),JSON.stringify(book.selections));
 const proposal=book.apply(.1,s.players,s.ball,null,null),combined=book.persistent(.1,s.players,s.ball,0,s.tactics[0],null,new Set(),proposal);
 const runner=s.players.find(p=>p.side===0&&p.number===4),outlet=s.players.find(p=>p.side===0&&p.number===5);
 assert(combined.moves.some(m=>m.player===runner.id&&!m.defensive));assert(combined.moves.some(m=>m.player===outlet.id&&m.defensive?.kind==='stay-forward'));
 assert(book.standing.notes.some(n=>n.actor===runner.id&&n.status==='waiting'&&n.text.includes('participă deja')));
});
