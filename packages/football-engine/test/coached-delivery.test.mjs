import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,practiceOptions,laneRisk} from '../dist/practice.js';
import {LessonResponsibilities,compileLesson} from '../dist/practice-lesson.js';
import {TeachingActions} from '../dist/practice-teaching.js';
import {PracticePlaybook} from '../dist/practice-playbook.js';
import {previewLessonRecognition} from '../dist/practice-recognition.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(){const players=practicePlayers(fixture);for(const p of players)Object.assign(p,{x:p.side?40:5+p.number*3,y:p.side?12:-12,vx:0,vy:0});const p=players.find(p=>p.side===0&&p.number===3),q=players.find(p=>p.side===0&&p.number===5);Object.assign(p,{x:18,y:0,angle:0});Object.assign(q,{x:25,y:0,angle:Math.PI});return {players,p,q,ball:{x:18.62,y:0,vx:0,vy:0,z:0,vz:0,mode:'control',owner:p.id}};}
const root={id:'start',name:'Start',cue:{kind:'start'}};
test('a requested short loft is generated even when ordinary play only proposes ground deliveries',()=>{
 const {players,p,q,ball}=scene(),ordinary=practiceOptions(p,players,new Set(),' ',0,null,0,null);
 assert(!ordinary.some(o=>o.kind==='loft'&&o.target===q.id));
 const job={id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5,delivery:'loft'},lesson={spaces:[],moments:[root],jobs:[job]},coach=new LessonResponsibilities(lesson,0,laneRisk);
 const options=coach.options(job,p,players,ball,null,0,ordinary),loft=options.find(o=>o.kind==='loft'&&o.target===q.id);
 assert(loft&&loft.loft.vz>0&&loft.loft.speed>0);assert.equal(loft.teachingStep,'pass');
 const ground=options.find(o=>o.kind==='pass'&&o.target===q.id),old=ordinary.find(o=>o.kind==='pass'&&o.target===q.id);assert.deepEqual(ground.pass,old.pass);assert.equal(ground.score,old.score);
});
test('passing to the named teammate outside the requested space is an alternative, not completion of the coached link',()=>{
 const {players,p,q,ball}=scene(),job={id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5,spaceId:'zone',delivery:'ground',fallback:false};
 const lesson={spaces:[{id:'zone',name:'Zone',x:37,y:-5,radius:2}],moments:[root],jobs:[job]},coach=new LessonResponsibilities(lesson,0,laneRisk);
 const ordinary=practiceOptions(p,players,new Set(),' ',0,null,0,null),options=coach.options(job,p,players,ball,null,0,ordinary),ground=options.find(o=>o.kind==='pass'&&o.target===q.id);
 assert(ground);assert.notEqual(ground.teachingStep,'pass');
 const teaching=new TeachingActions(compileLesson(lesson),0,p,true,laneRisk,lesson);teaching.update(0,players,ball);teaching.released(.5,p,ground);
 assert(teaching.trace.some(e=>e.phase==='interrupted'));assert(!teaching.trace.some(e=>e.phase==='released'));
});
test('simple fixed-space tactics use the same eligibility checks in preview and live selection',()=>{
 const {players,p,q,ball}=scene();Object.assign(q,{x:2,y:-12});
 const lesson={spaces:[{id:'zone',name:'Zone',x:46,y:0,radius:1}],moments:[root],jobs:[{id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5,spaceId:'zone'},{id:'run',momentId:'start',actor:5,kind:'run',spaceId:'zone'}]};
 const plan={id:'simple',name:'Simple',weight:100,emphasis:1,instructions:[],preferred:null,lesson};
 for(const reachable of [false,true]){if(reachable)Object.assign(q,{x:43,y:0});const preview=previewLessonRecognition(lesson,0,players,ball,laneRisk);assert.equal(!!preview.best,reachable);const book=new PracticePlaybook({side:0,plans:[plan],adaptive:true},2026);book.recover(0,p,players,laneRisk,ball);assert.equal(book.selections[0].planId,reachable?'simple':null);}
});

test('recognition links receiver movement to pass flight without vetoing contested ideas',()=>{
 const {players,p,q,ball}=scene();
 const lesson={spaces:[{id:'zone',name:'Zone',x:36,y:0,radius:2}],moments:[root],jobs:[{id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5,spaceId:'zone',delivery:'loft'},{id:'run',momentId:'start',actor:5,kind:'run',spaceId:'zone'}]};
 // With no run and a stationary receiver outside the area, an empty zone is not a passing connection.
 const disconnected={...lesson,jobs:[lesson.jobs[0],{id:'hold',momentId:'start',actor:5,kind:'hold'}]};
 assert(!previewLessonRecognition(disconnected,0,players,ball,laneRisk).best);
 const connected=previewLessonRecognition(lesson,0,players,ball,laneRisk).best;assert(connected);
 assert(connected.evidence.checks.some(c=>c.kind==='connection'&&c.target===q.id&&c.value>0));
 Object.assign(players.find(d=>d.side!==p.side&&d.role!=='GK'),{x:p.x+1.2,y:p.y});
 const contested=previewLessonRecognition(lesson,0,players,ball,laneRisk).best;assert(contested,'pressure must lower fit, not forbid the idea');assert(contested.score<connected.score);
});

test('new recognition waits for an already committed ordinary kick',()=>{
 const {players,p,ball}=scene(),lesson={spaces:[],moments:[root],jobs:[{id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5}]};
 const book=new PracticePlaybook({side:0,plans:[{id:'idea',name:'Idea',weight:100,instructions:[],preferred:null,lesson}],adaptive:true},2026);
 const other=players.find(q=>q.side===0&&q.number===2);
 book.recover(0,other,players,laneRisk,{...ball,owner:other.id,x:other.x+.62,y:other.y});
 book.advance(1,0,false,ball,players,true);assert(!book.selections.some(s=>s.planId));
 book.advance(1.1,0,false,ball,players,false);assert(book.selections.some(s=>s.planId==='idea'));
});

test('recognition, actual pursuit, and a requested release have distinct evidence',async()=>{
 const {playbookProgress}=await import('../dist/practice-playbook.js');
 const {players,p,q,ball}=scene(),lesson={spaces:[],moments:[root],jobs:[{id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5,delivery:'loft',fallback:true}]};
 const teaching=new TeachingActions(compileLesson(lesson),0,p,true,laneRisk,lesson),selection={trace:teaching.trace};
 teaching.update(0,players,ball);assert.equal(playbookProgress(selection),'recognised');
 const options=teaching.options(.1,p,players,ball,null,practiceOptions(p,players,new Set())),loft=options.find(o=>o.kind==='loft'&&o.target===q.id);
 assert(loft);teaching.decided(.1,p,loft);assert.equal(playbookProgress(selection),'pursued');
 teaching.released(.2,p,loft);assert.equal(playbookProgress(selection),'attempted');assert.equal(playbookProgress(selection,.15),'pursued');
 const alternative=new TeachingActions(compileLesson(lesson),0,p,true,laneRisk,lesson);alternative.update(0,players,ball);alternative.released(.2,p,{kind:'pass',target:q.id,aim:q,score:1,reason:'ground alternative'});
 assert(alternative.trace.some(e=>e.phase==='released'&&e.intent==='alternative'));assert.equal(playbookProgress({trace:alternative.trace}),'recognised');
});
