import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {previewLessonRecognition} from '../dist/practice-recognition.js';
import {LessonResponsibilities,compileLesson} from '../dist/practice-lesson.js';
import {TeachingActions} from '../dist/practice-teaching.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const start={id:'start',name:'Start',cue:{kind:'start'}};
function scene(){const players=practicePlayers(fixture);for(const p of players)Object.assign(p,{x:p.side?45:4+p.number*2,y:p.side?13:12,vx:0,vy:0,angle:0});const owner=players.find(p=>!p.side&&p.number===3);Object.assign(owner,{x:18,y:0});return {players,owner,ball:{x:18.62,y:0,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'}};}
function read(l,s){return previewLessonRecognition(l,s.owner.side,s.players,s.ball,laneRisk);}
test('drawing pressure can begin before pressure or the eventual passing connection exists',()=>{
 const s=scene(),lesson={spaces:[{id:'carry',name:'Carry',x:26,y:0,radius:2},{id:'later',name:'Later',x:46,y:-12,radius:1}],moments:[start,{id:'pressed',name:'Under pressure',cue:{kind:'pressed',actor:3}}],jobs:[{id:'advance',momentId:'start',actor:3,kind:'advance',spaceId:'carry'},{id:'pass',momentId:'pressed',actor:3,kind:'pass',recipient:5,spaceId:'later',delivery:'loft'}]};
 const snapshot=structuredClone(s),r=read(lesson,s),entry=r.entries.find(e=>e.momentId==='start');assert(entry.eligible);assert(entry.evidence.checks.some(c=>c.kind==='advance'&&c.stage==='developing'));assert(!entry.evidence.checks.some(c=>c.kind==='connection'));
 const teaching=new TeachingActions(compileLesson(lesson),0,s.owner,true,laneRisk,lesson,entry);teaching.update(0,s.players,s.ball);assert.equal(teaching.states.find(x=>x.step.id==='advance').phase,'active');assert.equal(teaching.states.find(x=>x.step.id==='pass').phase,'waiting');assert(!teaching.trace.some(t=>t.phase==='released'));assert.deepEqual(s,snapshot);
});
test('support recognition uses execution angles and lets a crowded teammate move away',()=>{
 const s=scene(),p=s.players.find(p=>!p.side&&p.number===2);Object.assign(p,{x:19,y:.5});const job={id:'offer',momentId:'start',actor:2,kind:'offer',teammate:3},lesson={spaces:[],moments:[start],jobs:[job]};
 const r=read(lesson,s).best;assert(r);const check=r.evidence.checks.find(c=>c.kind==='offer');assert.equal(check.stage,'developing');
 const interpreter=new LessonResponsibilities(lesson,0,laneRisk,true),move=interpreter.movement(job,p,s.players,s.ball,null,0,p);assert.deepEqual(check.aim,move.aim);assert(Math.hypot(move.aim.x-s.owner.x,move.aim.y-s.owner.y)>=4.5);
});
test('occupying a defender needs that opponent, while holding a position does not need a passing lane',()=>{
 const s=scene(),p=s.players.find(p=>!p.side&&p.number===5),opponent=s.players.find(p=>p.side&&p.number===2);Object.assign(p,{x:30,y:0});Object.assign(opponent,{x:33,y:0});
 const lesson={spaces:[],moments:[start],jobs:[{id:'occupy',momentId:'start',actor:5,kind:'occupy',opponent:2},{id:'hold',momentId:'start',actor:2,kind:'hold'}]};const r=read(lesson,s).best;assert(r);assert(r.evidence.checks.some(c=>c.kind==='occupy'&&c.target===opponent.id));assert(r.evidence.checks.some(c=>c.kind==='hold'&&c.available));
 s.players=s.players.filter(p=>p.id!==opponent.id);assert(!read(lesson,s).best);
});
test('relative attacking runs retain their meaning when teams and pitch direction are mirrored',()=>{
 const s=scene(),p=s.players.find(p=>!p.side&&p.number===5);Object.assign(p,{x:18,y:-7});const lesson={spaces:[{id:'overlap',name:'Overlap',x:26,y:-5,radius:2,anchor:{kind:'player',number:3,dx:8,dy:-5}}],moments:[start],jobs:[{id:'overlap',momentId:'start',actor:5,kind:'run',spaceId:'overlap'}]};
 const a=read(lesson,s).best;assert(a);const mirrored=structuredClone(s);for(const p of mirrored.players)Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,vx:-p.vx,vy:-p.vy,angle:p.angle+Math.PI});mirrored.owner=mirrored.players.find(p=>p.id===s.owner.id);Object.assign(mirrored.ball,{x:48-s.ball.x,y:-s.ball.y});const b=read(lesson,mirrored).best;assert(b);const ar=a.evidence.checks.find(c=>c.kind==='run'),br=b.evidence.checks.find(c=>c.kind==='run');assert(Math.abs(br.aim.x-(48-ar.aim.x))<1e-8);assert(Math.abs(br.aim.y+ar.aim.y)<1e-8);
});
test('a short preparation window can create a pass, but is unavailable under immediate pressure',()=>{
 const s=scene(),runner=s.players.find(p=>!p.side&&p.number===5);Object.assign(runner,{x:20,y:0});const lesson={spaces:[{id:'s',name:'S',x:39,y:0,radius:1}],moments:[start],jobs:[{id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5,spaceId:'s',delivery:'loft'},{id:'run',momentId:'start',actor:5,kind:'run',spaceId:'s'}]};
 const r=read(lesson,s).best;assert(r);assert.equal(r.evidence.checks.find(c=>c.kind==='connection').stage,'developing');
 Object.assign(s.players.find(p=>p.side&&p.number===2),{x:19,y:0});assert(!read(lesson,s).best);
});
test('shooting recognition values the opportunity without requiring confidence of scoring',()=>{
 const s=scene(),lesson={spaces:[],moments:[start],jobs:[{id:'shoot',momentId:'start',actor:3,kind:'shoot'}]};const far=read(lesson,s).best;assert(far);const a=far.evidence.checks.find(c=>c.kind==='shoot');assert(a.aim&&a.quality>=0);
 Object.assign(s.owner,{x:40,y:0});s.ball.x=40.62;const close=read(lesson,s).best;assert(close);assert(close.evidence.checks.find(c=>c.kind==='shoot').quality>a.quality);
});
