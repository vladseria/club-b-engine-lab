import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,createTrainingSetup,runTraining} from '../dist/index.js';
import {laneRisk,practiceOptions} from '../dist/practice.js';
import {readNextConnection,readDrawnOpening} from '../dist/practice-connections.js';
import {timeSupportRun,readSupportLocation} from '../dist/practice-support.js';
import {assignDefense,assignMarking,coverPosition} from '../dist/practice-defense.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
function supportScene(counter=false,mirror=false){
 const players=practicePlayers(fixture),poses=[[3,0],[6,0],[28,0],[32,9],[29,3],[46,0],[34,0],[27,-2],[28,4],counter?[10,0]:[25,0]];
 players.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0}));
 if(mirror)players.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI,lane:-p.lane}));
 const owner=players[2],ball={x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'};
 const tactics=fixture.teams.map(t=>t.tactics);if(mirror)tactics.reverse();
 return {players,owner,plan:coordinateFootball(players,ball,owner.side,tactics,laneRisk,{time:10,recoveredAt:0})};
}
test('a pressed carrier receives reachable, distinct outlets without requiring a forward runner',()=>{
 const {players,owner,plan}=supportScene(),mates=players.filter(p=>p.side===owner.side&&p.id!==owner.id&&p.role!=='GK');
 const outlet=mates.find(p=>plan.jobs[p.id]?.purpose==='outlet');assert(outlet);
 const aim=plan.jobs[outlet.id].aim,gap=Math.hypot(aim.x-owner.x,aim.y-owner.y);
 assert(gap>=4.5&&gap<=12);assert(laneRisk(owner,aim,players.filter(p=>p.side!==owner.side))<.3);
 for(const a of mates)for(const b of mates)if(a.id!==b.id)assert(Math.hypot(plan.jobs[a.id].aim.x-plan.jobs[b.id].aim.x,plan.jobs[a.id].aim.y-plan.jobs[b.id].aim.y)>2,'Support must not send two teammates to the same destination');
});
test('a deeper defender connects to possession but stays behind a distant counter outlet, in either direction',()=>{
 for(const mirror of [false,true]){
  const open=supportScene(false,mirror),counter=supportScene(true,mirror),id=open.players[1].id;
  const depth=x=>mirror?48-x:x,advance=depth(open.plan.jobs[id].aim.x),cover=depth(counter.plan.jobs[id].aim.x);
  assert(advance>depth(open.players[1].x)+5);assert(advance<depth(open.owner.x));
  assert(cover<depth(counter.players[9].x));assert(cover<advance,'A counter outlet keeps the defender deeper than the same scene without that threat');
 }
});
test('contested passes preserve cover rather than assigning another defender to the same duel',()=>{
 for(const mirror of [false,true]){
  const ps=practicePlayers(fixture),poses=[[3,0],[29,0],[38,11],[39,-5],[43,12],[46,0],[43,6],[41,11],[43,-2],[38,8]];
  ps.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0}));
  const ball={x:39,y:11,vx:10,vy:2.5,z:0,vz:0,mode:'pass'};
  const tactics=fixture.teams.map(t=>t.tactics);
  if(mirror){ps.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,lane:-p.lane}));Object.assign(ball,{x:48-ball.x,y:-ball.y,vx:-ball.vx,vy:-ball.vy});tactics.reverse();}
  const plan=coordinateFootball(ps,ball,ps[2].side,tactics,laneRisk,{time:10,recoveredAt:0,passer:ps[2].id,intended:ps[4].id});
  // Defending rebuild (2026-10-03): the defence's cover of a pass is its cover
  // role (practice-defending), chosen with the men, behind and inside the duel.
  const defending=ps.filter(p=>p.side!==ps[2].side&&p.role!=='GK'),covers=defending.filter(p=>plan.jobs[p.id]?.purpose==='cover');
  assert.equal(covers.length,1);const cover=covers[0].id,job=plan.jobs[cover];assert.equal(plan.marks.has(cover),false);
  const challenger=ps.find(p=>p.side!==ps[2].side&&plan.flight.hunters.includes(p.id));assert(challenger);assert.notEqual(cover,challenger.id);
  assert(Math.abs(job.aim.y)<Math.abs(plan.flight.meetings[challenger.id].y)-2);
  assert(!Object.values(plan.jobs).some(j=>ps.find(p=>p.id===j.player).side===challenger.side&&j.purpose==='second-ball'));
 }
});
test('support distinguishes room now from time to use it after arriving',()=>{
 const ps=practicePlayers(fixture),owner=ps[2],mate=ps[3],aim={x:20,y:-5};
 ps.filter(p=>p.side!==owner.side).forEach(p=>Object.assign(p,{x:30,y:8,vx:0,vy:0}));
 Object.assign(owner,{x:20,y:-12,vx:0,vy:0});Object.assign(mate,{...aim,vx:0,vy:0});Object.assign(ps[6],{x:24,y:-5});
 const available=readSupportLocation(mate,aim,ps,owner,laneRisk);
 Object.assign(mate,{x:12,y:-5});const late=readSupportLocation(mate,aim,ps,owner,laneRisk);
 assert.equal(available.room,late.room);assert(available.releaseRoom>late.releaseRoom);
 // Touchline cover is farther inside; central pressure still has close cover.
 const d=ps[6];Object.assign(d,{x:22,y:0});Object.assign(owner,{x:20,y:0});const central=coverPosition(d,owner);
 Object.assign(d,{y:13});Object.assign(owner,{y:13});const wide=coverPosition(d,owner);
 assert(Math.hypot(wide.x-owner.x,wide.y-owner.y)>Math.hypot(central.x-20,central.y)+1);
 assert(wide.y<owner.y-2);
});
function scene(){
 const players=practicePlayers(fixture),poses=[[3,0],[18,-8],[20,0],[34,0],[28,-10],[46,0],[22,0],[30,-9],[40,11],[5,-12]];
 players.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
 Object.assign(players[1].skills,{passing:9,control:9});return players;
}
test('an onward connection requires time and an opening; evaluating it cannot alter the scene',()=>{
 const ps=scene(),p=ps[2],q=ps[1],original=structuredClone(ps);
 const open=readNextConnection(p,q,q,ps,.8,laneRisk);assert(open.gain>0);assert.equal(open.target,ps[3].id);assert.deepEqual(ps,original);
 const longer=readNextConnection(p,q,q,ps,3,laneRisk);assert(longer.gain<open.gain);
 Object.assign(ps[6],{x:q.x+1,y:q.y});assert.equal(readNextConnection(p,q,q,ps,.8,laneRisk).gain,0);
 // Mirror both teams and momentum: neither attacking direction gets privileged geometry.
 const mirrored=original.map(p=>({...p,side:1-p.side,x:48-p.x,y:-p.y,vx:-p.vx,vy:-p.vy,angle:p.angle+Math.PI}));
 assert(Math.abs(readNextConnection(mirrored[2],mirrored[1],mirrored[1],mirrored,.8,laneRisk).gain-open.gain)<1e-10);
});
test('run timing can delay for an incoming pass, then accelerate; pressure removes that delay',()=>{
 const ps=scene(),p=ps[2],runner=ps[3],aim={x:30,y:7};Object.assign(p,{x:22,y:5,angle:0});Object.assign(runner,{x:26,y:7});
 ps.filter(q=>q.side===1).forEach(q=>Object.assign(q,{x:5,y:-10}));
 const early=timeSupportRun(runner,aim,runner.pace,p,ps,1.5),ready=timeSupportRun(runner,aim,runner.pace,p,ps,0);
 assert(early.waiting);assert(early.speed<ready.speed);assert.equal(ready.speed,runner.pace);
 Object.assign(ps[6],{x:p.x+2,y:p.y});assert.equal(timeSupportRun(runner,aim,runner.pace,p,ps,1.5).speed,runner.pace);
});
test('personality changes the appetite for the duel without modifying the same physical pass plan',()=>{
 const ps=scene(),p=ps[2],cautious=structuredClone(ps);Object.assign(cautious[2].traits,{risk:.2,dribble:.15,comesShort:.9});
 const bold=practiceOptions(p,ps,new Set()).sort((a,b)=>b.score-a.score),link=practiceOptions(cautious[2],cautious,new Set()).sort((a,b)=>b.score-a.score);
 // A newly recognised useful reset may win this particular scene for either
 // player. Test the trait tradeoff, rather than requiring Crocodinho to ignore
 // an improving passing opportunity on this exact arrangement forever.
 const duelMargin=options=>Math.max(...options.filter(o=>o.kind==='feint').map(o=>o.score))-Math.max(...options.filter(o=>o.kind==='pass').map(o=>o.score));
 assert(duelMargin(bold)>duelMargin(link)+.15);assert.equal(link[0].kind,'pass');assert.equal(link[0].target,ps[1].id);
 const first=bold.find(o=>o.kind==='pass'&&o.target===ps[1].id);assert.deepEqual(first.pass,link[0].pass);
 // A stationary opponent has not yet committed to being drawn out.
 assert.equal(readDrawnOpening(p,{x:20,y:-6},ps,laneRisk).gain,0);
 Object.assign(ps[3],{x:32,y:1});Object.assign(ps[4],{x:35,y:9});
 Object.assign(ps[7],{x:40,y:-12});Object.assign(ps[8],{x:43,y:13});
 Object.assign(ps[6],{x:24,y:1,vx:-3,vy:-.8});
 assert(readDrawnOpening(p,{x:20,y:-6},ps,laneRisk).gain>0);
});
test('a pivot can open a lateral reset behind the original carrier; an unnecessary detour has no credit',()=>{
 const ps=practicePlayers(fixture);
 ps.forEach((p,i)=>Object.assign(p,{x:i<5?10:45,y:10,vx:0,vy:0,angle:0}));
 const p=ps[2],pivot=ps[1],exit=ps[3];
 Object.assign(p,{x:20,y:0});Object.assign(pivot,{x:12,y:-6});Object.assign(pivot.skills,{passing:9,control:9});Object.assign(exit,{x:12,y:8});
 Object.assign(ps[4],{x:3,y:-12});Object.assign(ps[6],{x:19,y:2});
 const original=structuredClone(ps),read=readNextConnection(p,pivot,pivot,ps,.6,laneRisk);
 assert(read.gain>0);assert.equal(read.target,exit.id);assert.deepEqual(ps,original);
 Object.assign(ps[6],{x:43,y:12});assert.equal(readNextConnection(p,pivot,pivot,ps,.6,laneRisk).gain,0);
});
test('outfield teammates can cover a centre-back stepping out and marking remains one-to-one',()=>{
 const ps=scene(),owner=ps[2];Object.assign(owner,{x:36,y:0});Object.assign(ps[6],{x:37,y:0});Object.assign(ps[7],{x:41,y:-2});Object.assign(ps[8],{x:42,y:7});
 const defense=assignDefense(ps,owner,{...fixture.teams[1].tactics,press:'aggressive'});
 assert.equal(defense.presser,ps[6].id);assert(defense.coverer);assert.notEqual(defense.coverer,defense.presser);
 assert.notEqual(ps.find(p=>p.id===defense.coverer).role,'CB');
 let previous=new Map();for(let i=0;i<12;i++){
  ps[3].y=-6+i;ps[4].y=6-i;
  const marks=assignMarking(ps,0,owner,new Set([defense.presser,defense.coverer]),previous,owner.id,undefined,true,undefined,{...fixture.teams[1].tactics,marking:'tight'});
  assert.equal(new Set(marks.values()).size,marks.size);assert(!marks.has(defense.presser));assert(!marks.has(defense.coverer));previous=marks;
 }
});
test('the remaining marker protects a central finishing option before a deeper corner option',()=>{
 for(const mirror of [false,true]){
  const ps=practicePlayers(fixture),poses=[[3,0],[8,0],[44,13],[40,0],[44,11],[46,0],[42,2],[44,12],[40,7],[6,-8]];
  ps.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0}));
  if(mirror)ps.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y}));
  const owner=ps[2],reserved=new Set([ps[7].id,ps[8].id,ps[9].id]);
  const marks=assignMarking(ps,owner.side,owner,reserved,new Map(),owner.id,undefined,true,undefined,{...fixture.teams[1].tactics,marking:'balanced'});
  assert.equal(marks.get(ps[6].id),ps[3].id);
 }
});

test('a stationary outlet opens to the carrier before a pass, using a gradual turn without moving the body',()=>{
 for(const mirror of [false,true]){
  const f=structuredClone(fixture);if(mirror)f.teams.reverse();
  const setup=createTrainingSetup('middle'),positions=[[2,0],[10,0],[20,-8],[23,3],[31,2],[46,0],[40,0],[24,-9],[39,9],[35,-4]];
  setup.poses.forEach((p,i)=>Object.assign(p,{side:mirror?1-p.side:p.side,x:mirror?48-positions[i][0]:positions[i][0],y:positions[i][1],angle:mirror?(p.side?0:Math.PI):(p.side?Math.PI:0)}));
  setup.ball={side:mirror?1:0,number:3,x:mirror?48-20.62:20.62,y:-8};
  // This checks body preparation while holding a position, not whether the
  // ordinary coordinator happens to choose standing still in this scene.
  const playbook={side:setup.ball.side,plans:[{id:'hold',name:'Hold the outlet',weight:100,emphasis:1,preferred:null,instructions:[{number:4,action:'hold',dx:0,dy:0,delay:0}]}]};
  const result=runTraining({fixture:f,setup,durationSeconds:10,playbook}).result;
  const index=result.players.findIndex(p=>p.side===setup.ball.side&&p.number===4),initial=result.frames[0].players[index];
  // Read at 0.5 s, or just before the carrier releases if he does sooner (with the take-on price, 2026-10-19, the
  // mirrored carrier passes at 0.43 s instead of faking first): the outlet's body before the pass is the point.
  const release=result.events.find(e=>e.kind==='pass'&&e.time<.5),at=release?release.time-.02:.5;
  const early=result.frames.find(f=>f.time>=.1),ready=release?result.frames.findLast(f=>f.time<=at):result.frames.find(f=>f.time>=.5);
  const difference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  assert(difference(early.players[index].angle,initial.angle)>.01);
  assert(difference(early.players[index].angle,initial.angle)<.6,'The player turns under the existing rate limit');
  const p=ready.players[index];assert(Math.hypot(p.x-initial.x,p.y-initial.y)<.05,'Opening the body does not require running to a new position');assert(Math.hypot(p.vx,p.vy)<.15);
  assert.equal(ready.ball.owner,result.players.find(p=>p.side===setup.ball.side&&p.number===3).id);
  assert(Math.cos(Math.atan2(ready.ball.y-p.y,ready.ball.x-p.x)-p.angle)>0,'He can see the ball before it is kicked');
 }
});
