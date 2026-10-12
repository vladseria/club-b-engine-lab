import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runTraining,practicePlayers,validatePlans,createRestartSetup,placeRoutine,sceneMatches} from '../dist/index.js';
import {validateLesson} from '../dist/practice-lesson.js';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
const players=practicePlayers(fixture);

/** A corner drawn from the left: #3 takes, #5 waits at the penalty spot and
 * attacks the near post at the kick, #3 crosses there. */
function corner(extra={}){
 const setup=createRestartSetup('corner',players,{side:'left',taker:3});
 for(const p of setup.poses)if(p.side===0&&p.number===5)Object.assign(p,{x:38,y:0});
 const spots=setup.poses.filter(p=>p.side===0&&p.number>1&&p.number!==3).map(p=>({number:p.number,x:p.x,y:p.y,leash:1}));
 const lesson={scene:{restart:'corner',side:'any',ball:{x:setup.ball.x,y:setup.ball.y},taker:3,spots,...extra.scene},
  spaces:[{id:'near',name:'Near post',x:45,y:-3.5,radius:2.5}],
  moments:[{id:'start',name:'The set-up',cue:{kind:'start'}},{id:'kick',name:'At the kick',cue:{kind:'restart-taken'}}],
  jobs:[{id:'cross',momentId:'start',actor:3,kind:'pass',spaceId:'near',recipient:5,delivery:'auto',fallback:true},{id:'attack',momentId:'kick',actor:5,kind:'run',spaceId:'near'}]};
 return {setup,plan:{id:'corner-near',name:'Near post',weight:100,instructions:[],preferred:null,lesson}};
}
const kickOf=r=>r.events.find(e=>e.restartKind);

test('routine lessons validate; restart-taken belongs to routines; bad scenes are refused',()=>{
 const {plan}=corner();
 assert.equal(validatePlans([plan])[0].lesson.scene.restart,'corner');
 const open={...plan.lesson,scene:undefined};
 assert.throws(()=>validateLesson(open),/cue/);
 assert.throws(()=>validateLesson({...plan.lesson,scene:{...plan.lesson.scene,ball:{x:30,y:0}}}),/Scene ball/);
 assert.throws(()=>validateLesson({...plan.lesson,scene:{...plan.lesson.scene,taker:1}}),/taker/);
 assert.throws(()=>validateLesson({...plan.lesson,scene:{...plan.lesson.scene,spots:[{number:3,x:40,y:0,leash:1}]}}),/spot/);
 assert.throws(()=>validateLesson({...plan.lesson,scene:{...plan.lesson.scene,zone:'attacking'}}),/zone/);
 assert.throws(()=>validatePlans([{...plan,standing:[{id:'s',actor:2,kind:'press',phase:'defending'}]}]),/off-ball/);
 const goal=createRestartSetup('goalKick',players);
 assert.equal(goal.ball.number,1);
 validateLesson({spaces:[],moments:[{id:'start',name:'S',cue:{kind:'start'}}],jobs:[],scene:{restart:'goalKick',ball:{x:3,y:0},taker:1,spots:[]}});
});

test('a routine is placed on the actual restart: mirrored on the other side, in the other team\'s frame',()=>{
 const {plan}=corner();
 const left=placeRoutine(plan.lesson,'corner',0,{x:47,y:-14.5},players),right=placeRoutine(plan.lesson,'corner',0,{x:47,y:14.5},players);
 assert(left&&right&&!left.mirrored&&right.mirrored);
 const id5=players.find(p=>p.side===0&&p.number===5).id;
 assert.equal(right.slots[id5].aim.x,left.slots[id5].aim.x);assert(Math.abs(right.slots[id5].aim.y+left.slots[id5].aim.y)<1e-9);
 assert.equal(right.lesson.spaces[0].y,3.5);
 // Side 1 attacks towards x = 0: its left corner is at y > 0 in the world.
 const away=placeRoutine(plan.lesson,'corner',1,{x:1,y:14.5},players);
 const a5=players.find(p=>p.side===1&&p.number===5).id;
 assert(away&&!away.mirrored&&Math.abs(away.slots[a5].aim.x-(48-left.slots[id5].aim.x))<1e-9);
 // A one-sided routine stays on its side; a goal kick routine never matches a corner.
 assert(!sceneMatches({...plan.lesson.scene,side:'left'},'corner',0,{x:47,y:14.5}));
 assert(!placeRoutine(plan.lesson,'goalKick',0,{x:3,y:0},players));
});

test('a corner routine is taken by its taker, survives its own restart and fires the drawn run at the kick',()=>{
 const {setup,plan}=corner();
 for(const seed of [1,2]){
  const f={...fixture,seed},r=runTraining({fixture:f,durationSeconds:20,setup,playbook:{side:0,plans:[plan],adaptive:true}}).result;
  const sel=r.playbookSelections.find(s=>s.planId==='corner-near');
  assert(sel,'the routine was chosen at the stoppage');
  const kick=kickOf(r);assert(kick,'the corner was taken');
  assert.equal(r.players.find(p=>p.id===kick.actor).number,3,'the routine\'s taker took it');
  assert.notEqual(sel.endReason,'restart','its own restart did not end it');
  const run=sel.trace.find(t=>t.stepId==='attack'&&t.phase==='active');
  assert(run&&run.time>=kick.time-1e-9&&run.time<=kick.time+.1,'the run starts at the kick');
  assert.equal(sel.trace.filter(t=>t.stepId.startsWith('spot:')&&t.phase==='arrived').length,3,'every spot player stood on his spot');
  const cross=sel.trace.find(t=>t.stepId==='cross'&&t.phase==='active');
  assert(cross&&cross.time<kick.time,'the delivery is due before the kick');
 }
});

test('an unreachable spot cannot stall the restart; the Laws still hold',()=>{
 const {setup,plan}=corner();
 // #4 is told to stand tight at the far end of the pitch.
 const far={...plan,lesson:{...plan.lesson,scene:{...plan.lesson.scene,spots:plan.lesson.scene.spots.map(s=>s.number===4?{...s,x:2,y:0,leash:0}:s)}}};
 const base=runTraining({fixture:{...fixture,seed:3},durationSeconds:20,setup}).result;
 const r=runTraining({fixture:{...fixture,seed:3},durationSeconds:20,setup,playbook:{side:0,plans:[far],adaptive:true}}).result;
 const kick=kickOf(r);assert(kick&&kickOf(base),'both corners were taken');
 assert(kick.time<=2+3+2.5,`taken by ${kick.time.toFixed(2)} s`);
 const opp=kick.restartPlayers.filter(q=>r.players.find(p=>p.id===q.id).side===1&&r.players.find(p=>p.id===q.id).role!=='GK');
 for(const q of opp)assert(Math.hypot(q.x-47,q.y+14.5)>=5,'opponents keep their distance at the kick');
});

test('a free-kick routine translates with the ball and is chosen only in its third',()=>{
 const setup=createRestartSetup('freeKick',players,{side:'right',zone:'attacking',taker:2});
 const lesson={scene:{restart:'freeKick',side:'any',zone:'attacking',ball:{x:setup.ball.x,y:setup.ball.y},taker:2,spots:[{number:5,x:42,y:0,leash:1}]},spaces:[],moments:[{id:'start',name:'S',cue:{kind:'start'}}],jobs:[]};
 validateLesson(lesson);
 const moved=placeRoutine(lesson,'freeKick',0,{x:30,y:6},players),id5=players.find(p=>p.side===0&&p.number===5).id;
 assert(moved&&Math.abs(moved.slots[id5].aim.x-(42-(setup.ball.x-30)))<1e-9);
 assert(placeRoutine(lesson,'indirect',0,{x:40,y:-3},players),'an indirect free kick counts');
 assert(!placeRoutine(lesson,'freeKick',0,{x:20,y:6},players),'not in the middle third');
});

// ---- 2026-09-29 fix round: side/third, fit, taker, wall, hard cap ----
const {planLiveRestart,settleRestart,WALL_GAP}=await import('../dist/practice-restart-live.js');
const {restartBlockers,restartPlayersReady}=await import('../dist/practice-restarts.js');
const idOf=(n,side=0)=>players.find(p=>p.side===side&&p.number===n).id;
const bare=scene=>({spaces:[],moments:[{id:'start',name:'S',cue:{kind:'start'}},{id:'kick',name:'K',cue:{kind:'restart-taken'}}],jobs:[],scene});

test('a scene is used where it is drawn: a one-sided routine and a third must match the drawn ball',()=>{
 const fk={restart:'freeKick',side:'left',zone:'attacking',ball:{x:33,y:-6},taker:2,spots:[]};
 validateLesson(bare(fk));
 assert.throws(()=>validateLesson(bare({...fk,side:'right'})),/side/,'left routine drawn on the right');
 assert.throws(()=>validateLesson(bare({...fk,zone:'middle'})),/zone/,'middle-third routine drawn in the attacking third');
 validateLesson(bare({...fk,side:'any',zone:'any'}));
 assert.throws(()=>validateLesson(bare({restart:'corner',side:'left',ball:{x:47,y:14.5},taker:3,spots:[]})),/side/);
});

test('a drawing is compressed toward the ball near a line (order and gaps kept), and not used where it cannot fit',()=>{
 const lesson=bare({restart:'freeKick',side:'any',zone:'attacking',ball:{x:33,y:6},taker:4,spots:[{number:5,x:39,y:1,leash:1},{number:2,x:42,y:-4,leash:3.5},{number:3,x:29,y:10,leash:1}]});
 validateLesson(lesson);
 const drawn=placeRoutine(lesson,'freeKick',0,{x:33,y:6},players);
 assert.deepEqual(drawn.slots[idOf(2)].aim,{x:42,y:-4},'as drawn where it was drawn');
 // 7 m nearer the goal: the +9 m spot compresses to the goal-line margin, the +6 m one stays 1.4 m short of it.
 const near=placeRoutine(lesson,'freeKick',0,{x:40,y:6},players);
 const a5=near.slots[idOf(5)].aim.x,a2=near.slots[idOf(2)].aim.x;
 assert(Math.abs(a2-47.2)<1e-9&&a5<a2-1.3,`order and a gap kept (${a5.toFixed(2)} < ${a2.toFixed(2)})`);
 assert.equal(near.slots[idOf(3)].aim.x,36,'a spot behind the ball keeps its drawn offset');
 // The impact run's piling cases: a free kick by the byline, and seed 34's free kick by the touchline.
 assert.equal(placeRoutine(lesson,'freeKick',0,{x:46,y:11},players),null);
 assert.equal(placeRoutine(lesson,'freeKick',0,{x:40.5,y:13.1},players),null);
});

test('throw-ins and a far designated taker go to the engine\'s taker; the two swap parts in the routine',()=>{
 const lesson={...bare({restart:'throw',side:'any',zone:'attacking',ball:{x:36,y:-14.5},taker:2,spots:[{number:5,x:39,y:-11,leash:1}]}),
  jobs:[{id:'t',momentId:'start',actor:2,kind:'pass',recipient:5,delivery:'auto',fallback:true}]};
 validateLesson(lesson);
 const t=placeRoutine(lesson,'throw',0,{x:36,y:-14.5},players,idOf(5));
 assert.equal(t.taker,idOf(5),'the nearest player throws');
 assert.equal(t.lesson.jobs[0].actor,5);assert.equal(t.lesson.jobs[0].recipient,2);
 assert(t.slots[idOf(2)]&&!t.slots[idOf(5)],'the designated taker takes the thrower\'s spot');
 const fk={...lesson,scene:{...lesson.scene,restart:'freeKick',ball:{x:33,y:-6},spots:[{number:5,x:39,y:-1,leash:1}]}};
 // #2 (a centre-back at x = 11) is 22 m from the ball: the engine's free-kick taker takes it.
 assert.equal(placeRoutine(fk,'freeKick',0,{x:33,y:-6},players,idOf(3)).taker,idOf(3));
 const near=players.map(p=>p.id===idOf(2)?{...p,x:25,y:-6}:p);
 assert.equal(placeRoutine(fk,'freeKick',0,{x:33,y:-6},near,idOf(3)).taker,idOf(2),'within reach he takes it himself');
});

/** A free kick at (36, 0) for side 0 with a three-man wall 5.8 m goal-side. */
function wallScene(){
 const wall=[[41.8,-1.7],[41.8,0],[41.8,1.7]];
 const ps=players.map(p=>({...p,vx:0,vy:0}));
 const put=(id,x,y)=>Object.assign(ps.find(p=>p.id===id),{x,y});
 put(idOf(2,1),...wall[0]);put(idOf(3,1),...wall[1]);put(idOf(4,1),...wall[2]);put(idOf(5,1),30,-10);put(idOf(1,1),47.6,0);
 put(idOf(4),35.4,0);put(idOf(5),42.4,.2);put(idOf(3),38,-8);put(idOf(2),30,8);
 return {ps,scene:{kind:'freeKick',side:0,spot:{x:36,y:0},taker:idOf(4)}};
}
test('a routine spot never puts its man against a wall of three: the Law outranks the leash',()=>{
 const {ps,scene}=wallScene();
 const routine={slots:{[idOf(5)]:{aim:{x:42.4,y:.2},leash:0,purpose:'playbook',reason:'x',authored:true}},posts:{}};
 const live=planLiveRestart(scene,routine,ps,{time:0,tactics:[fixture.teams[0].tactics,fixture.teams[1].tactics],laneRisk:()=>0},null);
 const aim=live.jobs[idOf(5)].aim;
 for(const q of ps.filter(p=>p.side===1&&p.role!=='GK'&&p.x>41))assert(Math.hypot(aim.x-q.x,aim.y-q.y)>=WALL_GAP-1e-9,`clear of the wall (${aim.x.toFixed(2)}, ${aim.y.toFixed(2)})`);
});
test('past the hard cap the engine holds fixed legal points: encroachers step out, a man on the wall steps off',()=>{
 const {ps,scene}=wallScene();
 const encroacher=ps.find(p=>p.id===idOf(5,1));Object.assign(encroacher,{x:37.5,y:1});
 const blocking=restartBlockers(scene,ps,true).map(p=>p.id);
 assert(blocking.includes(idOf(5,1))&&blocking.includes(idOf(5)),'the encroacher and the man on the wall hold it up');
 const {aims,released}=settleRestart(scene,ps);
 assert.deepEqual(released,[idOf(5)]);
 const moved=ps.map(p=>aims[p.id]?{...p,...aims[p.id]}:p);
 assert(restartPlayersReady(scene,moved,true),'every fixed point is legal');
 assert.deepEqual(aims[idOf(2,1)],{x:41.8,y:-1.7},'a legal defender holds where he stands');
});

// ---- 2026-09-30: the rehearsed delivery ----
const {leadThrowOption}=await import('../dist/practice-throw.js');
/** A throw-in to a check run: #2 throws, #5 waits at (41, −10) and comes back to
 * the line (38, −12) at the throw; the drawn throw is to him there. (It was a run
 * in behind, 39 → 43 m; since 2026-09-30 a last man holds the space behind the
 * deepest runner at a throw-in, so that ball is rightly no longer "on".) */
function throwLine(){
 const setup=createRestartSetup('throw',players,{side:'left',zone:'attacking',taker:2,ball:{x:36,y:-14.5}});
 const lesson={scene:{restart:'throw',side:'any',zone:'attacking',ball:{x:36,y:-14.5},taker:2,spots:[{number:5,x:41,y:-10,leash:1}]},
  spaces:[{id:'line',name:'Down the line',x:38,y:-12,radius:3}],
  moments:[{id:'start',name:'S',cue:{kind:'start'}},{id:'kick',name:'K',cue:{kind:'restart-taken'}}],
  jobs:[{id:'throw',momentId:'start',actor:2,kind:'pass',recipient:5,spaceId:'line',delivery:'auto',fallback:true},{id:'go',momentId:'kick',actor:5,kind:'run',spaceId:'line'}]};
 return {setup,plan:{id:'throw-line',name:'Down the line',weight:100,instructions:[],preferred:null,lesson}};
}
test('at a routine\'s kick the taker plays the drawn delivery when it is on',()=>{
 const {setup,plan}=throwLine();
 const r=runTraining({fixture:{...fixture,seed:1},durationSeconds:12,setup,playbook:{side:0,plans:[plan],adaptive:true}}).result;
 const kick=kickOf(r),sel=r.playbookSelections.find(s=>s.planId==='throw-line');
 assert.equal(r.players.find(p=>p.id===kick.actor).number,2);assert.equal(r.players.find(p=>p.id===kick.target).number,5);
 const released=sel.trace.find(t=>t.stepId==='throw'&&t.phase==='released');
 assert.equal(released.intent,'attempted','the drawn throw, not an alternative');
 const aim=released.evidence.chosen.aim;assert(Math.hypot(aim.x-38,aim.y+12)<=3+1.5,`thrown into the drawn space (${aim.x.toFixed(1)}, ${aim.y.toFixed(1)})`);
 assert.equal(sel.endReason,'complete');
});
test('a drawn delivery that is clearly off is not forced; its run ends once the ball is someone else\'s',()=>{
 // The corner's near-post ball is cut out by the defenders there (lane risk 1).
 const {setup,plan}=corner(),r=runTraining({fixture:{...fixture,seed:1},durationSeconds:20,setup,playbook:{side:0,plans:[plan],adaptive:true}}).result;
 const sel=r.playbookSelections.find(s=>s.planId==='corner-near'),released=sel.trace.find(t=>t.stepId==='cross'&&t.phase==='released');
 const drawn=released.evidence.options.filter(o=>o.matches);
 assert(drawn.length&&drawn.every(o=>o.laneRisk>.42),'every version of the drawn ball is risky');
 assert.equal(released.intent,'alternative');
 // The run was for that ball: once the short corner is received, the runner rejoins play.
 const received=sel.trace.find(t=>t.stepId==='cross'&&t.phase==='received'),stop=sel.trace.find(t=>t.stepId==='attack'&&t.phase==='interrupted');
 assert(received&&stop&&Math.abs(stop.time-received.time)<1e-9,'the drawn run ends with the delivery');
});
test('a rehearsed throw leads the run with the throw\'s own physics; an opponent in the space shortens it',()=>{
 const ps=players.map(p=>({...p,vx:0,vy:0})),put=(n,side,x,y)=>Object.assign(ps.find(p=>p.side===side&&p.number===n),{x,y});
 put(2,0,36,-14.5);put(5,0,39,-11);for(const n of [2,3,4,5])put(n,1,20+n,5);
 const thrower=ps.find(p=>p.side===0&&p.number===2),runner=ps.find(p=>p.side===0&&p.number===5),run={aim:{x:43,y:-12}};
 const free=leadThrowOption(thrower,{x:36,y:-14.5},runner,run,ps);
 assert(free&&free.throwRisk===0&&Math.hypot(free.throwLead.x-43,free.throwLead.y+12)<1,`an open line: thrown to the end of the run (${JSON.stringify(free?.throwLead)})`);
 put(3,1,42.5,-12);
 const marked=leadThrowOption(thrower,{x:36,y:-14.5},runner,run,ps);
 assert(!marked||Math.hypot(marked.throwLead.x-39,marked.throwLead.y+11)<Math.hypot(free.throwLead.x-39,free.throwLead.y+11)-1,'a defender there: a shorter lead');
});
