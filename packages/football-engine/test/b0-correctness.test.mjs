import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {teamApproaches} from '../dist/index.js';
import {coordinateFootball,leadForward} from '../dist/practice-coordination.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));

// Audit #9: the striker setting belongs to the most advanced forward.
test('the striker setting applies to the most advanced forward: the ST, else the leading winger',()=>{
 const f=structuredClone(fixture);f.teams[0].tactics.formation='2-2';
 const players=practicePlayers(f),[left,right]=players.filter(p=>p.side===0&&p.role==='W');
 left.x=30;right.x=26;
 assert.equal(leadForward(players,0,10).id,left.id,'2-2 has no ST: the leading winger carries the striker setting');
 right.x=29;assert.equal(leadForward(players,0,10,{id:right.id}).id,right.id,'two level wingers do not swap it');
 const st=players.find(p=>p.side===1&&p.role==='ST');
 assert.equal(leadForward(players,1,10).id,st.id,'a formation with a striker keeps the ST');
});

test('the lead forward changes hands only after the other winger has been clearly ahead for a sustained moment',()=>{
 const f=structuredClone(fixture);f.teams[0].tactics.formation='2-2';
 const players=practicePlayers(f),[left,right]=players.filter(p=>p.side===0&&p.role==='W');
 left.x=30;right.x=26;
 // The incumbent (right) is overtaken by 4 m: he keeps the role for 1.5 s.
 let lead=leadForward(players,0,10,{id:right.id});
 assert.equal(lead.id,right.id);assert.equal(lead.challenger,left.id);
 lead=leadForward(players,0,11.25,lead);assert.equal(lead.id,right.id,'1.25 s is not yet sustained');
 lead=leadForward(players,0,11.5,lead);assert.equal(lead.id,left.id,'1.5 s clearly ahead: the role changes hands');
 // A lead that lapses restarts the clock.
 let again=leadForward(players,0,20,{id:right.id});
 right.x=29;again=leadForward(players,0,21,again);assert.equal(again.challenger,undefined);
 right.x=26;again=leadForward(players,0,22,again);assert.equal(again.id,right.id);assert.equal(again.since,22);
 // A fresh possession (no incumbent) takes the most advanced forward at once.
 assert.equal(leadForward(players,0,30).id,left.id);
});

test('"Links play" brings the most advanced forward short, in 2-2 as with a striker',()=>{
 for(const formation of ['2-2','1-2-1']){
  const job=striker=>{
   const f=structuredClone(fixture);f.teams[0].tactics.formation=formation;
   const players=practicePlayers(f);
   place(players,[[3,0],[20,-4],[17,5],[26,-10],[26,0],[45,0],[34,0],[29,-6],[30,7],[39,0]]);
   const owner=players[1],tactics=f.teams.map((t,i)=>({...t.tactics,...(i===0?{...teamApproaches.balanced.settings,formation,striker}:{})}));
   const plan=coordinateFootball(players,{...owner,z:0,vz:0,mode:'control',owner:owner.id},0,tactics,laneRisk,{time:10,recoveredAt:0});
   assert.equal(plan.strikers[0].id,players[4].id);
   return plan.jobs[players[4].id];
  };
  const link=job('link'),pivot=job('pivot'),run=job('run');
  assert.equal(link.purpose,'link',`${formation}: links play offers and takes the linking position`);
  // Since the settings round (2026-10-03) Drops deep is a false nine anchored
  // between their lines (LINK_GAP in front of their last outfielder), not a
  // step ahead of the ball: shorter than the forwards who stay on their line.
  assert(link.aim.x<pivot.aim.x&&link.aim.x<run.aim.x,`${formation}: the linking forward stays shorter than with pivot/run`);
 }
});

// Audit #10: final-third arrivals are offered by position, not by role label.
test('a 2-2 team can send a cutback runner',()=>{
 const purposes=new Set();
 // R1: Bodies forward 4 is now "at least one joins" (was "at most one stays"),
 // so 5 (at most one stays) is the setting that sends a centre-back up.
 for(const x of [28,32,36])for(const y of [-6,2,10])for(const commit of [3,4,5]){
  const f=structuredClone(fixture);f.teams[0].tactics.formation='2-2';
  const players=practicePlayers(f);
  place(players,[[3,0],[33,-4],[24,5],[41,-11],[x,y],[46,0],[40,-3],[39,4],[36,-8],[30,0]]);
  const owner=players[3],tactics=f.teams.map((t,i)=>({...t.tactics,...(i===0?{formation:'2-2',commit}:{})}));
  const plan=coordinateFootball(players,{...owner,z:0,vz:0,mode:'control',owner:owner.id},0,tactics,laneRisk,{time:10,recoveredAt:0});
  for(const p of players.filter(p=>p.side===0))if(plan.jobs[p.id])purposes.add(plan.jobs[p.id].purpose);
 }
 assert(purposes.has('cutback'),`2-2 jobs seen: ${[...purposes].join(', ')}`);
 assert(purposes.has('near-post')&&purposes.has('far-post'));
});

// Audit #20: Auto free-kick taker uses a real shooting-position test.
test('Auto free-kick taker: the finisher only where a direct shot is on, the passer otherwise',async()=>{
 const {chooseFreeKickTaker}=await import('../dist/practice-set-pieces.js');
 const f=structuredClone(fixture);
 f.teams[0].squad.find(p=>p.id==='van').skills.setPieces=6;
 const players=practicePlayers(f),name=p=>p.id.split(':')[1];
 assert.equal(name(chooseFreeKickTaker(players,0,{x:36,y:0})),'golusor','12 m out, central: the best dead-ball finisher');
 assert.equal(name(chooseFreeKickTaker(players,0,{x:8,y:0})),'crocodinho','40 m out: a passing free kick, the best dead-ball passer');
 assert.equal(name(chooseFreeKickTaker(players,0,{x:44,y:14})),'crocodinho','by the corner flag there is no shot on');
 assert.equal(name(chooseFreeKickTaker(players,0,{x:36,y:0},undefined,'indirect')),'crocodinho','an indirect free kick cannot be shot');
 assert.equal(name(chooseFreeKickTaker(players,0,{x:8,y:0},'golusor')),'golusor','a nominated taker still takes it');
});

// Audit #18: "danger" width fits a 5 m goal on a 30 m pitch.
test('a wide attacker running at goal near the box is danger; the same player standing wide is not',async()=>{
 const {markingDeparture}=await import('../dist/practice-shape.js');
 const players=practicePlayers(fixture),defender=players.find(p=>p.side===0&&p.role==='CB');
 Object.assign(defender,{x:9,y:0});
 const shape={slots:{[defender.id]:{aim:{x:9,y:0}}},back:9,focus:{x:20,y:0}};
 const winger=v=>({...players.find(p=>p.side===1&&p.role==='W'),x:5,y:12,vx:v,vy:0});
 const aim={x:4.5,y:10.5};
 assert.notEqual(markingDeparture(defender,winger(-3.5),aim,shape),null,'running at goal from 12 m wide, 5 m out: may be tracked out of the line');
 assert.equal(markingDeparture(defender,winger(0),aim,shape),null,'standing out wide: the line holds');
});

// Step 0: a short pass leads a moving receiver to where he will be, the
// planner's reach check matches execution, and the addressed man keeps it.
test('a short pass leads a moving receiver by his momentum and braking, and reach needs the ball in front',async()=>{
 const {receiverLead,receptionTime,groundPass}=await import('../dist/practice-passing.js');
 const {arrivalTime}=await import('../dist/practice-defense.js');
 const players=practicePlayers(fixture),passer=players[2],receiver={...players[3],x:20,y:0,vx:0,vy:3.3};
 Object.assign(passer,{x:14,y:-2,vx:0,vy:0});
 const lead=receiverLead(receiver,.55),braking=.12*3.3+3.3*3.3/(2*receiver.acceleration);
 assert(lead.y>.45*3.3*.55+.2,'more than the old 45 % share of his motion');
 assert(lead.y<=braking+1e-9,'never beyond where he can stop');
 assert.deepEqual(receiverLead({...receiver,vx:0,vy:0},.55),{x:20,y:0},'a standing receiver is played to his feet');
 const plan=groundPass(passer,receiver,false,undefined,passer,[]);
 assert(plan.aim.y>1,'the planned aim is ahead of the running receiver');
 // No free metre: a standing receiver 0.9 m from the aim still has to move,
 // and one running away from it must stop and come all the way back.
 const standing={...receiver,vx:0,vy:0,y:.9},past={...receiver,y:.8};
 assert.equal(arrivalTime(standing,{x:20,y:0}),0);
 assert(receptionTime(standing,{x:20,y:0})>0,'0.9 m is outside the reception tolerance');
 assert(receptionTime(past,{x:20,y:0})>arrivalTime(past,{x:20,y:0})+.1,'a ball behind a running receiver gets no reach allowance');
 assert.equal(receptionTime({...receiver,y:-.5},{x:20,y:0}),0,'a point just ahead of him is within reach');
});

test('the addressed receiver keeps chasing a pass that has got away from him unless a team-mate is clearly better placed',async()=>{
 const {assignFlight}=await import('../dist/practice-defense.js');
 const players=practicePlayers(fixture);
 place(players,[[3,0],[10,-8],[20,0],[24,4],[26,-9],[46,0],[40,0],[34,6],[35,-6],[42,3]]);
 // He was running the other way; the ball has already run past him towards
 // the touchline. Before, he dropped it and nobody chased.
 const receiver=players[3];Object.assign(receiver,{x:24,y:3,vx:0,vy:-4});
 const ball={x:23.5,y:5,vx:.5,vy:10,z:0,vz:0,owner:null,mode:'pass'};
 const flight=assignFlight(players,ball,0,new Set(),{intended:receiver.id,passer:players[2].id,previous:receiver.id});
 assert.equal(flight.receiver,receiver.id);
 assert(flight.hunters.includes(receiver.id));
});
