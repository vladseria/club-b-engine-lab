import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runTraining,runMatch,createTrainingSetup,validatePlans,createSimulationRequest,runSimulation} from '../dist/index.js';
import {practicePlayers,laneRisk,practiceOptions} from '../dist/practice.js';
import {IDEA_PREFERENCE_CAP,LessonResponsibilities,compileLesson} from '../dist/practice-lesson.js';
import {previewLessonRecognition,bindRecognisedLesson} from '../dist/practice-recognition.js';
import {TeachingActions} from '../dist/practice-teaching.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));fixture.seed=2026;
const setup=createTrainingSetup('middle');
const pair={id:'pair',name:'Pair',weight:100,emphasis:1,instructions:[],preferred:null,lesson:{spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[{id:'exchange',momentId:'start',actor:3,kind:'pass',recipient:5,repeat:true}]}};

test('saved tactics preserve emphasis and repeat semantics through a normal-match job',()=>{
 const plans=validatePlans([pair,{...pair,id:'off',emphasis:0}]);
 const req=createSimulationRequest({kind:'match',fixture,durationSeconds:30,playbook:{side:0,plans,adaptive:true}});
 const replay=runSimulation(JSON.parse(JSON.stringify(req)));
 assert.deepEqual(replay.input.playbook.plans,plans);assert(!('setup' in replay.input));
 assert(replay.result.playbookSelections.every(s=>s.planId!=='off'));
 assert.throws(()=>validatePlans([{...pair,emphasis:1.1}]),/emphasis/);
 assert.throws(()=>validatePlans([{...pair,lesson:{...pair.lesson,jobs:[{...pair.lesson.jobs[0],recipient:3}]}}]),/partener distinct/);
});

test('zero emphasis preserves ordinary physics, choices and events in training and matches',()=>{
 for(const training of [false,true]){
  const run=training?runTraining:runMatch,input={fixture,durationSeconds:20,...(training?{setup}:{})};
  const ordinary=run(input).result,off=run({...input,playbook:{side:0,plans:[{...pair,emphasis:0}],adaptive:true}}).result;
  delete off.playbookSelections;assert.deepEqual(off,ordinary);
 }
});

test('authored passing emphasis changes preferences without modifying delivery plans',()=>{
 const players=practicePlayers(fixture);for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),pose);
 const p=players.find(p=>p.side===0&&p.number===3),q=players.find(p=>p.side===0&&p.number===5),ball={x:p.x+.62,y:p.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:p.id};
 const ordinary=practiceOptions(p,players,new Set()),copy=structuredClone(ordinary),job={...pair.lesson.jobs[0],repeat:false};
 const low=new LessonResponsibilities(pair.lesson,0,laneRisk,false,.25).options(job,p,players,ball,null,0,ordinary);
 const high=new LessonResponsibilities(pair.lesson,0,laneRisk,false,1).options(job,p,players,ball,null,0,ordinary);
 const i=ordinary.findIndex(o=>o.target===q.id&&o.pass);assert(i>=0);assert(high[i].score>=low[i].score);assert(low[i].score>ordinary[i].score);
 // The accent scales the idea's pull (the evidence keeps it in full); the lift
 // it adds to the score is capped, so an idea breaks near-ties only.
 const pull=(r)=>r.evaluations.get(job.id).options[i].preference;
 const lo=new LessonResponsibilities(pair.lesson,0,laneRisk,false,.25),hi=new LessonResponsibilities(pair.lesson,0,laneRisk,false,1);
 lo.options(job,p,players,ball,null,0,ordinary);hi.options(job,p,players,ball,null,0,ordinary);assert(pull(hi)>pull(lo));
 assert(high[i].score-ordinary[i].score<=IDEA_PREFERENCE_CAP+1e-12);
 assert.strictEqual(high[i].pass,ordinary[i].pass);assert.deepEqual(ordinary,copy);
});

test('a reusable one-two reports only actual releases and receipts, including after 15 seconds',()=>{
 const players=practicePlayers(fixture);for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),pose);
 const a=players.find(p=>p.side===0&&p.number===3),b=players.find(p=>p.side===0&&p.number===5),ball=p=>({x:p.x+.62,y:p.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:p.id});
 const teaching=new TeachingActions(compileLesson(pair.lesson),0,a,true,laneRisk,pair.lesson,undefined,1);
 teaching.update(0,players,ball(a));
 for(const [time,from,to] of [[1,a,b],[3,b,a],[17,a,b]]){
  teaching.update(time,players,ball(from));teaching.released(time,from,{kind:'pass',target:to.id,aim:to,score:1,reason:'release'});
  teaching.received(time+.5,to,from.id,true);teaching.update(time+.5,players,ball(to));assert(!teaching.ended);
 }
 assert.equal(teaching.trace.filter(t=>t.phase==='received').length,3);
 teaching.received(18,b,a.id,true);assert.equal(teaching.trace.filter(t=>t.phase==='received').length,3);
 teaching.released(19,b,{kind:'shoot',aim:{x:48,y:0},score:1,reason:'shot'});teaching.update(19,players,ball(b));assert(teaching.ended);
});

test('a receiver can prepare a coached continuation without activating it before receipt',()=>{
 const players=practicePlayers(fixture);for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),pose);
 const a=players.find(p=>p.side===0&&p.number===3),b=players.find(p=>p.side===0&&p.number===2);
 const lesson={spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}},{id:'next',name:'Next',cue:{kind:'received',jobId:'first'}}],jobs:[{id:'first',momentId:'start',actor:3,kind:'pass',recipient:2},{id:'next-pass',momentId:'next',actor:2,kind:'pass',recipient:5}]};
 const ball={x:a.x+.62,y:a.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:a.id},teaching=new TeachingActions(compileLesson(lesson),0,a,true,laneRisk,lesson,undefined,1);
 teaching.update(0,players,ball);teaching.released(.5,a,{kind:'pass',target:b.id,aim:b,score:1,reason:'pass',teachingStep:'first'});
 const ordinary=practiceOptions(b,players,new Set()),planned=teaching.options(.8,b,players,{...ball,owner:null,mode:'pass'},null,ordinary),next=teaching.states.find(s=>s.step.id==='next-pass');
 assert(planned.some(o=>o.teachingStep==='next-pass'));assert.equal(next.phase,'waiting');assert(!teaching.trace.some(t=>t.phase==='received'));
 const prepared=planned.find(o=>o.teachingStep==='next-pass');assert(!teaching.canRelease(.8,b,prepared,players,ball,null));
 teaching.received(1,b,a.id,true);teaching.update(1,players,{...ball,x:b.x+.62,y:b.y,owner:b.id});assert.equal(next.phase,'active');assert(teaching.canRelease(1,b,prepared,players,ball,null));
});


const continuationLesson={spaces:[{id:'channel',name:'Runner channel',x:39,y:3,radius:4,anchor:{kind:'player',number:5,dx:12,dy:1}}],moments:[{id:'start',name:'Draw pressure',cue:{kind:'start'}},{id:'launch',name:'Release the runner',cue:{kind:'received',jobId:'back'}}],jobs:[{id:'back',momentId:'start',actor:3,kind:'pass',recipient:2},{id:'runner',momentId:'start',actor:5,kind:'run',spaceId:'channel'},{id:'support',momentId:'start',actor:2,kind:'offer',teammate:3},{id:'long',momentId:'launch',actor:2,kind:'pass',spaceId:'channel',recipient:5,delivery:'loft'}]};
test('recognizing a continuation also recruits its ongoing support, without inventing earlier actions',()=>{
 for(const dx of [0,3]){
  const players=practicePlayers(fixture);for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),{...pose,x:Math.min(47.2,pose.x+dx)});
  const owner=players.find(p=>p.side===0&&p.number===2),ball={x:owner.x+.62,y:owner.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:owner.id};
  const entry=previewLessonRecognition(continuationLesson,0,players,ball,laneRisk).best;assert.equal(entry.momentId,'launch');assert.deepEqual(entry.continuingJobs,['runner']);
  const bound=bindRecognisedLesson(continuationLesson,entry),teaching=new TeachingActions(compileLesson(bound),0,owner,true,laneRisk,bound,entry);
  teaching.update(0,players,ball);
  assert.equal(teaching.states.find(s=>s.step.id==='back').phase,'skipped');assert.equal(teaching.states.find(s=>s.step.id==='support').phase,'skipped');
  assert.equal(teaching.states.find(s=>s.step.id==='runner').phase,'active');assert(!teaching.trace.some(t=>['received','released','arrived','complete'].includes(t.phase)));
  const support=teaching.apply(0,players,ball,null,null,new Set()),run=support.moves.find(m=>m.player===players.find(p=>p.side===0&&p.number===5).id);assert(run);assert.equal(run.kind,'run');
  assert(run.aim.x>30);assert.equal(run.purpose,'playbook');
 }
});

test('later responsibilities replace inherited support and unrelated branches stay inactive',()=>{
 // The replacement holds at the receiving area; it no longer runs to an area twelve metres away.
 const l=structuredClone(continuationLesson);l.spaces[0].anchor.dx=0;l.spaces[0].anchor.dy=0;l.jobs.push({id:'replace-run',momentId:'launch',actor:5,kind:'hold'});
 l.moments.push({id:'unrelated',name:'Other branch',cue:{kind:'pressed',actor:4}});l.jobs.push({id:'unrelated-run',momentId:'unrelated',actor:4,kind:'run',spaceId:'channel'});
 const players=practicePlayers(fixture);for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),pose);
 const owner=players.find(p=>p.side===0&&p.number===2),ball={x:owner.x+.62,y:owner.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:owner.id};
 const entry=previewLessonRecognition(l,0,players,ball,laneRisk).entries.find(e=>e.momentId==='launch');assert(entry.eligible);assert(!entry.continuingJobs?.includes('runner'));assert(!entry.continuingJobs?.includes('unrelated-run'));
 const bound=bindRecognisedLesson(l,entry),teaching=new TeachingActions(compileLesson(bound),0,owner,true,laneRisk,bound,entry);teaching.update(0,players,ball);
 assert.equal(teaching.states.find(s=>s.step.id==='runner').phase,'skipped');assert.equal(teaching.states.find(s=>s.step.id==='replace-run').phase,'active');assert.equal(teaching.states.find(s=>s.step.id==='unrelated-run').phase,'skipped');
});

function continuityPlayers(){
 const players=practicePlayers(fixture);for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),pose);
 return players;
}
const controlled=p=>({x:p.x+.62,y:p.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:p.id});

test('a short loose touch preserves the intention but yields movement and decisions to ordinary football',()=>{
 const players=continuityPlayers(),p=players.find(p=>p.side===0&&p.number===3);
 const lesson={spaces:[{id:'space',name:'Space',x:30,y:-4,radius:3}],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[{id:'carry',momentId:'start',actor:3,kind:'advance',spaceId:'space'},{id:'run',momentId:'start',actor:5,kind:'run',spaceId:'space'}]};
 const teaching=new TeachingActions(compileLesson(lesson),0,p,true,laneRisk,lesson);
 teaching.update(0,players,controlled(p));const loose={...controlled(p),owner:null,mode:'loose'};
 assert(teaching.update(.5,players,loose));assert(!teaching.ended);assert(!teaching.actionActive('carry'));
 const support={side:0,owner:'',moves:[]},ordinary=practiceOptions(p,players,new Set());
 assert.strictEqual(teaching.apply(.6,players,loose,null,support,new Set()),support);
 assert.strictEqual(teaching.options(.6,p,players,loose,support,ordinary),ordinary);
 teaching.received(.8,p,p.id,false);teaching.update(.8,players,controlled(p));
 assert(!teaching.ended);assert(teaching.actionActive('carry'));assert(!teaching.trace.some(t=>['received','complete','arrived'].includes(t.phase)));
 const opponent=players.find(q=>q.side!==p.side);teaching.received(.9,opponent,p.id,false);assert(teaching.ended);
 for(const distant of [false,true]){
  const fresh=new TeachingActions(compileLesson(lesson),0,p,true,laneRisk,lesson);fresh.update(0,players,controlled(p));fresh.update(.5,players,loose);
  fresh.update(distant?.6:2,players,distant?{...loose,x:loose.x+10}:loose);assert(fresh.ended);
 }
});

test('a committed runner keeps his drawn run through a loose touch and a pass in flight; the carrier still decides',()=>{
 // 2026-09-28 (ideas commitment): before, every off-ball movement yielded to
 // ordinary football while the ball was loose or in flight. Once a player has
 // taken his movement on, he now keeps making it; hunters and the receiver of
 // a flight still go to the ball, and the carrier's options are untouched.
 const players=continuityPlayers(),p=players.find(p=>p.side===0&&p.number===3),runner=players.find(p=>p.side===0&&p.number===5);
 const lesson={spaces:[{id:'space',name:'Space',x:30,y:-4,radius:3}],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[{id:'carry',momentId:'start',actor:3,kind:'advance',spaceId:'space'},{id:'run',momentId:'start',actor:5,kind:'run',spaceId:'space'}]};
 const teaching=new TeachingActions(compileLesson(lesson),0,p,true,laneRisk,lesson);
 teaching.update(0,players,controlled(p));
 const committed=teaching.apply(.1,players,controlled(p),null,{side:0,owner:p.id,moves:[]},new Set()).moves.find(m=>m.player===runner.id);
 assert(committed&&committed.purpose==='playbook');
 const loose={...controlled(p),owner:null,mode:'loose'};teaching.update(.5,players,loose);
 const during=teaching.apply(.6,players,loose,null,{side:0,owner:'',moves:[]},new Set()).moves.find(m=>m.player===runner.id);
 assert(during,'the runner keeps his run through the loose touch');assert(Math.hypot(during.aim.x-committed.aim.x,during.aim.y-committed.aim.y)<.5);
 const hunted=teaching.apply(.6,players,loose,{flight:{hunters:[runner.id],meetings:{},coverer:''}},{side:0,owner:'',moves:[]},new Set());
 assert(!hunted.moves.some(m=>m.player===runner.id),'a hunter goes to the ball');
 const ordinary=practiceOptions(p,players,new Set());assert.strictEqual(teaching.options(.6,p,players,loose,null,ordinary),ordinary);
 // An uncommitted runner still yields during a loose ball (the contract above).
 const fresh=new TeachingActions(compileLesson(lesson),0,p,true,laneRisk,lesson),support={side:0,owner:'',moves:[]};fresh.update(0,players,controlled(p));fresh.update(.5,players,loose);
 assert.strictEqual(fresh.apply(.6,players,loose,null,support,new Set()),support);
});

test('a one-two can survive a fumble without counting it as a completed pass',()=>{
 const players=continuityPlayers(),a=players.find(p=>p.side===0&&p.number===3),b=players.find(p=>p.side===0&&p.number===5);
 const teaching=new TeachingActions(compileLesson(pair.lesson),0,a,true,laneRisk,pair.lesson);
 teaching.update(0,players,controlled(a));teaching.released(.1,a,{kind:'pass',target:b.id,aim:b,score:1,reason:'release'});
 teaching.update(.4,players,{...controlled(b),owner:null,mode:'loose'});assert(!teaching.ended);
 teaching.received(.6,b,a.id,false);teaching.update(.6,players,controlled(b));assert(!teaching.ended);assert(!teaching.trace.some(t=>t.phase==='received'));
 teaching.released(.8,b,{kind:'pass',target:a.id,aim:a,score:1,reason:'return'});teaching.received(1,a,b.id,true);teaching.update(1,players,controlled(a));
 assert.equal(teaching.trace.filter(t=>t.phase==='received').length,1);
});

test('collecting a broken authored pass cannot manufacture a received cue',()=>{
 const players=continuityPlayers(),a=players.find(p=>p.side===0&&p.number===3),b=players.find(p=>p.side===0&&p.number===2);
 for(const collector of [a,b]){
  const teaching=new TeachingActions(compileLesson(continuationLesson),0,a,true,laneRisk,continuationLesson);
  teaching.update(0,players,controlled(a));teaching.released(.1,a,{kind:'pass',target:b.id,aim:b,score:1,reason:'pass',teachingStep:'back'});
  teaching.update(.3,players,{...controlled(collector),owner:null,mode:'loose'});teaching.received(.4,collector,a.id,false);teaching.update(.4,players,controlled(collector));
  assert(!teaching.trace.some(t=>t.phase==='received'));assert(!teaching.actionActive('long'));
  if(collector===a)assert(teaching.actionActive('back'));else assert(teaching.ended);
 }
});

test('a named passing instruction can allow a brief opening to develop, without changing the pass',()=>{
 const players=continuityPlayers(),a=players.find(p=>p.side===0&&p.number===3),b=players.find(p=>p.side===0&&p.number===5);
 for(const q of players.filter(q=>q.side===1))Object.assign(q,{x:45,y:12});
 const job={id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5},lesson={spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[job]};
 const brain=new LessonResponsibilities(lesson,0,()=>.1),raw=practiceOptions(a,players,new Set());
 const carry=raw.find(o=>o.carry&&o.carry.obstruction<.3&&o.carry.clearance>1.5);assert(carry);
 const candidate=raw.find(o=>o.pass&&o.target===b.id);assert(candidate);
 // A near-tie (the capped idea preference only breaks those): the setup carry trails the pass by 0.15.
 const pass={...candidate,pass:{...candidate.pass,risk:.95}},ordinary=[{...carry,score:.35},{...pass,score:.5}];
 const copy=structuredClone(ordinary),support={side:0,owner:a.id,moves:[{player:b.id,purpose:'playbook',kind:'show',aim:{x:b.x+2,y:b.y+2},speed:3,since:0,until:10,reason:'open angle'}]};
 const first=brain.options(job,a,players,controlled(a),support,0,ordinary);assert(first[0].score>first[1].score);assert.strictEqual(first[1].pass,pass.pass);
 const later=brain.options(job,a,players,controlled(a),support,2,ordinary);assert.equal(later[0].score,ordinary[0].score);
 const blocked=players.find(q=>q.side===1&&q.role!=='GK');Object.assign(blocked,{x:a.x+.8,y:a.y});
 const pressured=new LessonResponsibilities(lesson,0,()=>.1).options(job,a,players,controlled(a),support,0,ordinary);assert.equal(pressured[0].score,ordinary[0].score);
 assert.deepEqual(ordinary,copy);
});
