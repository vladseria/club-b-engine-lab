// Receive round (2026-10-15): reading the reception while the ball travels (practice-receive), the clearance's lane
// re-read, and team-mates' bodies kept apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers,simulatePractice,laneRisk,kickBlocked,TEAM_GAP} from '../dist/practice.js';
import {projectOpponents,receptionRoom,touchCost,firstTimeCost} from '../dist/practice-receive.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));

// Everyone parked far from play; the receiver (side 0, number 3) meets a ball at (20, 0) in 0.4 s, a free team-mate
// (number 4) waits at (27, -8).
function scene(){
 const players=practicePlayers(fixture);
 players.forEach((p,i)=>Object.assign(p,{x:p.side?44-i:4+i,y:p.side?12:-12,vx:0,vy:0}));
 const p=players[2],q=players[3],d=players[7];
 Object.assign(p,{x:20,y:0,angle:0});Object.assign(q,{x:27,y:-8});
 // a good reader: his read of his room is nearly exact (a poor one misjudges it, by design)
 p.skills={...p.skills,reading:9,passing:8};
 const meeting={x:20,y:0},arrive=.4;
 const pass={kind:'pass',target:q.id,aim:{x:q.x,y:q.y},score:1,reason:'',pass:{aim:{x:q.x,y:q.y},speed:12,flight:1,arrivalSpeed:8,risk:0,controlRisk:0,reachMargin:1,weight:'measured'}};
 const read=()=>{const seen=projectOpponents(players,0,meeting,arrive),room=receptionRoom(p,meeting,arrive,players,0);
  return {touch:touchCost(p,pass,meeting,seen,room,laneRisk),first:firstTimeCost(p,pass,8,false,meeting,seen)};};
 return {players,p,q,d,read};
}

test('a pressed receiver with a free team-mate plays it first time; in space with nothing on he takes a touch',()=>{
 const {d,read}=scene();
 // a man 2.5 m away, sprinting at the meeting point: he is on the receiver as the ball arrives
 Object.assign(d,{x:22.5,y:.5,vx:-5,vy:0});
 const pressed=read();
 assert(pressed.touch>pressed.first,`a touch would cost the pass (${pressed.touch.toFixed(2)}) more than first time costs him (${pressed.first.toFixed(2)})`);
 // nobody within 15 m: a touch costs the pass nothing, so he sets it first
 Object.assign(d,{x:36,y:10,vx:0,vy:0});
 const free=read();
 assert(free.touch<free.first,`with time a touch is the better first contact (${free.touch.toFixed(2)} v ${free.first.toFixed(2)})`);
 assert.equal(free.touch,0);
});

test('a ball still dropping out of the air keeps its controlling touch unless a man is really on him',()=>{
 const {p,d,players}=scene(),meeting={x:20,y:0},arrive=.4,loft={kind:'loft',target:players[3].id,aim:{x:27,y:-8},score:1,reason:''};
 Object.assign(d,{x:24,y:2,vx:-2,vy:-.5});
 const seen=projectOpponents(players,0,meeting,arrive),room=receptionRoom(p,meeting,arrive,players,0);
 assert(touchCost(p,loft,meeting,seen,room,laneRisk)<firstTimeCost(p,loft,8,true,meeting,seen),'a man still a few metres off: he controls the long ball first');
});

test('a clearance gets the lane re-read a pass gets: a man in its first stride blocks it, one beside it does not',()=>{
 const players=practicePlayers(fixture);
 players.forEach((p,i)=>Object.assign(p,{x:p.side?44-i:4+i,y:p.side?12:-12,vx:0,vy:0}));
 const p=players[1],a=players[8];Object.assign(p,{x:5,y:0,angle:0});
 const clear={kind:'clear',clearance:'touchline',aim:{x:13,y:19},score:0,reason:''};
 Object.assign(a,{x:5.7,y:1.6,vx:0,vy:0});
 assert(kickBlocked(p,clear,players,0),'the attacker stands in its first metres');
 Object.assign(a,{x:5.7,y:-1.6});
 assert(!kickBlocked(p,clear,players,0),'he stands on the other side of the defender');
 // the man arriving into it while the defender sets it is read too
 Object.assign(a,{x:7.5,y:3.5,vx:-3,vy:-3});
 assert(kickBlocked(p,clear,players,.35),'he will be in it by the time the ball is away');
});

test('team-mates never stand on top of each other outside a restart',()=>{
 const r=simulatePractice(fixture,90,undefined,true,{policy:'coordinated',substitutions:'none'});
 const sides=r.players.map(p=>p.side);let close=0,frames=0;
 for(const f of r.frames){if(f.restart||f.lineup)continue;frames++;
  for(let i=0;i<f.players.length;i++)for(let j=i+1;j<f.players.length;j++)if(sides[i]===sides[j]&&Math.hypot(f.players[i].x-f.players[j].x,f.players[i].y-f.players[j].y)<TEAM_GAP-.1)close++;}
 assert(frames>100);assert.equal(close,0);
});
