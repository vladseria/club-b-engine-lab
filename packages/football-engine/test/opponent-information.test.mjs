import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {PracticePlaybook,createTrainingSetup} from '../dist/practice-playbook.js';
import {runTraining} from '../dist/index.js';
import {readShotDanger} from '../dist/practice-shot-defense.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

// A real counterexample: changing only intended recipient changed cover/marks.
function scene(mirror=false,air=false){
 const players=practicePlayers(fixture),positions=[[1,0],[30.06,-8.59],[37.34,6.08],[40.60,1.29],[30.25,5.27],[47,0],[41.65,-2.30],[39.23,5.31],[28.84,-2.54],[28.39,3.10]];
 players.forEach((p,i)=>Object.assign(p,{side:mirror?1-p.side:p.side,x:mirror?48-positions[i][0]:positions[i][0],y:mirror?-positions[i][1]:positions[i][1],vx:0,vy:0,angle:mirror?Math.PI:0}));
 const ball={x:mirror?48-25.59:25.59,y:mirror?-4.91:4.91,z:air?.65:0,vz:air?2.6:0,vx:mirror?-13:13,vy:mirror?-4.96:4.96,mode:'pass',owner:null};
 const side=mirror?1:0,tactics=fixture.teams.map(t=>t.tactics);if(mirror)tactics.reverse();
 const read=(context={},previous=null)=>coordinateFootball(players,ball,side,tactics,laneRisk,{time:4,recoveredAt:0,passer:players[1].id,...context},previous);
 const defending=plan=>({jobs:players.filter(p=>p.side!==side).map(p=>plan.jobs[p.id]),marks:[...plan.marks],hunter:plan.flight.hunters.find(id=>players.find(p=>p.id===id).side!==side),coverer:plan.flight.coverer,coverAim:plan.flight.coverAim});
 return {players,ball,side,read,defending};
}

test('identical visible flight gives identical defense despite private intended receiver and receiving commitment, mirrored and aerial',()=>{
 for(const mirror of [false,true])for(const air of [false,true]){
  const s=scene(mirror,air),ordinary=s.read(),expected=s.defending(ordinary);
  for(const intended of [undefined,...s.players.slice(0,5).map(p=>p.id)])for(const previousReceiver of [undefined,s.players[3].id,s.players[4].id]){
   const previous={...ordinary,time:3.75,flight:{...ordinary.flight,receiver:previousReceiver}};
   const actual=s.read({intended},previous);
   const baseline=s.read({}, {...ordinary,time:3.75});
   assert.deepEqual(s.defending(actual),s.defending(baseline));
  }
  // Defending rebuild (2026-10-03): a defender goes for the ball only when he can
  // get there in time; otherwise the receiver's own defender closes him.
  const plan=s.read(),recv=plan.flight.observedReceiver;
  assert(expected.hunter||Object.values(plan.jobs).some(j=>s.players.find(p=>p.id===j.player).side!==s.side&&j.purpose==='mark'&&j.target===recv),'Defenders still contest the visible pass, or close the man it goes to');
  if(!air)assert.notEqual(s.read({intended:s.players[3].id}).flight.receiver,s.read({intended:s.players[4].id}).flight.receiver,'Teammates retain private receiving coordination');
 }
});

test('changing a private attacking route does not change defensive jobs until something observable changes',()=>{
 for(const mirror of [false,true]){
  const s=scene(mirror),owner=s.players[2];Object.assign(s.ball,{x:owner.x,y:owner.y,vx:0,vy:0,owner:owner.id,mode:'control'});
  const proposal=x=>()=>({owner:owner.id,side:s.side,moves:[{player:s.players[4].id,purpose:'playbook',kind:'run',aim:{x,y:8},speed:5,since:4,until:7}]});
  const a=s.read({responsibilities:proposal(12)}),b=s.read({responsibilities:proposal(42)});
  assert.notDeepEqual(a.jobs[s.players[4].id].aim,b.jobs[s.players[4].id].aim);
  assert.deepEqual(s.defending(a),s.defending(b));
  // The same defenders may respond before a kick, based on a real runner.
  const runner=s.players[4];Object.assign(runner,{x:mirror?5:43,y:0,vx:mirror?-4:4,vy:0});
  assert.notDeepEqual(s.defending(a),s.defending(s.read()),'Visible danger still changes defensive responsibility');
  const defender=s.players[6],shooting={...owner,x:mirror?7:41,y:0,angle:mirror?Math.PI:0};
  const toward=readShotDanger(defender,shooting,shooting,s.players),away=readShotDanger(defender,{...shooting,angle:shooting.angle+Math.PI},shooting,s.players);
  assert(toward.level>away.level,'Body orientation remains a useful anticipatory cue');
 }
});

test('a defender can predict a different receiver from the intended one and revise when the visible race changes',()=>{
 for(const mirror of [false,true]){
  const s=scene(mirror),intended=s.players[3].id;
  const before=s.read({intended});
  assert.equal(before.flight.receiver,intended);
  assert.equal(before.flight.observedReceiver,s.players[4].id,'Belief is a forecast, not the private commitment');
  Object.assign(s.players[3],{x:mirror?16:32,y:mirror?-7.35:7.35,vx:mirror?-3:3,vy:mirror?-1:1});
  Object.assign(s.players[4],{x:mirror?18:30,y:mirror?8:-8,vx:0,vy:mirror?3:-3});
  const after=s.read({intended});
  assert.equal(after.flight.observedReceiver,intended);
  assert.notDeepEqual(s.defending(after),s.defending(before));
 }
});

test('private plan bookkeeping cannot reset the shared decision clock in live practice',()=>{
 const request={fixture,setup:createTrainingSetup('middle'),durationSeconds:10,playbook:{side:0,plans:[{id:'inactive',name:'Inactive',weight:0,instructions:[],preferred:null}]}};
 const ordinary=runTraining(request).result,advance=PracticePlaybook.prototype.advance;
 let refreshed;
 try{
  PracticePlaybook.prototype.advance=function(...args){advance.apply(this,args);return true;};
  refreshed=runTraining(request).result;
 }finally{PracticePlaybook.prototype.advance=advance;}
 assert.deepEqual(refreshed.frames,ordinary.frames);
 assert.deepEqual(refreshed.events,ordinary.events);
 assert.deepEqual(refreshed.stats,ordinary.stats);
});
