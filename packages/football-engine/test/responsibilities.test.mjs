import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {teamExposure} from '../dist/practice-exposure.js';
import {laneRisk} from '../dist/practice.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(){
 const players=practicePlayers(fixture),poses=[[2,0],[12,0],[22,-9],[20,0],[27,7],[46,0],[30,0],[22,1],[22,-3],[32,9]];
 players.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0}));
 const owner=players[3],ball={x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'},tactics=fixture.teams.map(t=>t.tactics);
 return {players,owner,ball,tactics};
}
const move=(p,aim,kind='run')=>({player:p.id,purpose:'playbook',kind,aim,speed:p.pace*.8,since:0,until:5,reason:'Manager responsibility'});
function plan(s,moves,time=1,previous=null,unavailable=new Set()){
 return coordinateFootball(s.players,s.ball,s.owner.side,s.tactics,laneRisk,{time,recoveredAt:-20,responsibilities:()=>({owner:s.owner.id,side:s.players.find(p=>p.id===moves[0]?.player)?.side??0,moves})},previous,unavailable);
}
test('a centre-back can attack; other assignments account for that commitment under pressure',()=>{
 const s=scene(),back=s.players[1],ordinary=plan(s,[]),other=s.players[4],requested=move(back,{...ordinary.jobs[other.id].aim}),before=structuredClone(s.players);
 const coached=plan(s,[requested]);
 assert.equal(coached.jobs[back.id].purpose,'playbook');
 assert.deepEqual(coached.jobs[back.id].aim,requested.aim);
 assert.equal(coached.jobs[back.id].speed,requested.speed);
 assert.deepEqual(coached.support.moves.find(m=>m.player===back.id).aim,requested.aim);
 assert.notDeepEqual(ordinary.jobs[back.id].aim,requested.aim);
 assert(s.players.filter(p=>p.side===0&&p.id!==back.id&&p.id!==s.owner.id&&p.role!=='GK').some(p=>
  Math.hypot(coached.jobs[p.id].aim.x-ordinary.jobs[p.id].aim.x,coached.jobs[p.id].aim.y-ordinary.jobs[p.id].aim.y)>1),
 'A teammate must adjust when an instructed run takes their planned destination');
 assert.deepEqual(s.players,before,'Allocation cannot move bodies or alter skills');
});
test('all supporting players may be sent forward without a hidden cover veto; expired instructions release them',()=>{
 const s=scene(),mates=s.players.filter(p=>p.side===0&&p.id!==s.owner.id&&p.role!=='GK');
 const moves=mates.map((p,i)=>move(p,{x:34+i*3,y:-8+i*8}));
 const coached=plan(s,moves);
 for(const m of moves){assert.deepEqual(coached.jobs[m.player].aim,m.aim);assert.equal(coached.jobs[m.player].purpose,'playbook');}
 const expired=plan(s,moves,6,coached);
 assert(mates.every(p=>expired.jobs[p.id].purpose!=='playbook'));
 const unavailable=plan(s,moves,1,null,new Set([mates[0].id]));
 assert.notEqual(unavailable.jobs[mates[0].id]?.purpose,'playbook');
});
test('an instructed defender is not simultaneously assigned to press or mark, on either side',()=>{
 for(const mirror of [false,true]){
  const s=scene();if(mirror){s.players.forEach(p=>{p.side=1-p.side;p.x=48-p.x;p.vx=-p.vx;});s.ball.x=s.owner.x;}
  const ordinary=plan(s,[]),presser=s.players.find(p=>p.id===ordinary.defense.presser);
  const request=move(presser,{x:mirror?8:40,y:10},'hold'),coached=plan(s,[request]);
  assert.deepEqual(coached.jobs[presser.id].aim,request.aim);
  assert.notEqual(coached.defense.presser,presser.id);assert.notEqual(coached.defense.coverer,presser.id);
  assert(!coached.marks.has(presser.id));
 }
});
test('physical pass reception takes precedence over an incompatible off-ball responsibility',()=>{
 const s=scene(),receiver=s.players[4];
 s.ball={x:receiver.x-2,y:receiver.y,z:0,vz:0,vx:8,vy:0,mode:'pass'};
 const coached=coordinateFootball(s.players,s.ball,0,s.tactics,laneRisk,{time:1,recoveredAt:0,intended:receiver.id,passer:s.owner.id,
  responsibilities:preview=>({side:0,owner:s.owner.id,moves:preview.flight.hunters.filter(id=>s.players.find(p=>p.id===id).side===0).map(id=>move(s.players.find(p=>p.id===id),{x:3,y:-10}))})});
 assert(coached.flight.receiver);
 assert.equal(coached.jobs[coached.flight.receiver].purpose,'receive');
});
test('exposure is a finite consequence of geometry, independent of role names and symmetric across the pitch',()=>{
 const s=scene(),back=s.players[1],cover={...move(back,{x:14,y:0}),purpose:'counter-cover'},advanced={...cover,aim:{x:35,y:9}};
 s.players[6].x=17;s.players[6].y=0;
 const a=teamExposure(s.players,s.owner,{[back.id]:cover},s.tactics[0]);
 const b=teamExposure(s.players,s.owner,{[back.id]:advanced},s.tactics[0]);
 assert(Number.isFinite(a)&&Number.isFinite(b));assert(b>a);
 back.role='ST';assert.equal(teamExposure(s.players,s.owner,{[back.id]:advanced},s.tactics[0]),b);
 const mirrored=s.players.map(p=>({...p,side:1-p.side,x:48-p.x,vx:-p.vx}));
 const m=teamExposure(mirrored,mirrored[3],{[back.id]:{...advanced,aim:{x:48-advanced.aim.x,y:advanced.aim.y}}},s.tactics[0]);
 assert(Math.abs(m-b)<1e-9);
});

test('a real playbook proposes a delayed responsibility without mutating the plan; the coordinator publishes it',async()=>{
 const {PracticePlaybook,createTrainingSetup}=await import('../dist/practice-playbook.js');
 const {activePassRun}=await import('../dist/practice-passing.js');
 const s=scene(),setup=createTrainingSetup('middle');
 for(const pose of setup.poses)Object.assign(s.players.find(p=>p.side===pose.side&&p.number===pose.number),pose);
 s.owner=s.players[2];s.ball={...s.ball,x:s.owner.x,y:s.owner.y,owner:s.owner.id};
 const book=new PracticePlaybook({side:0,plans:[{id:'delayed',name:'Delayed run',weight:1,preferred:4,instructions:[{number:4,action:'run',dx:5,dy:0,delay:1}]}]},2026);
 book.recover(0,s.owner,s.players,laneRisk);
 const ordinary=plan(s,[]),snapshot=structuredClone(ordinary),runner=s.players[3];
 const early=book.apply(0,s.players,s.ball,ordinary,null);
 assert(!early.moves.some(m=>m.player===runner.id));
 const proposal=book.apply(1,s.players,s.ball,ordinary,null);
 assert.deepEqual(ordinary,snapshot);
 assert(proposal.moves.some(m=>m.player===runner.id));
 const next=plan(s,proposal.moves);
 assert.equal(next.jobs[runner.id].purpose,'playbook');
 assert.deepEqual(activePassRun(next.support,s.owner,runner,1),{aim:{x:runner.x+5,y:runner.y},speed:runner.pace*.94});
});
