// Decide round (2026-10-15): players arrive with a plan (team-mates read forward in flight), a pressed player does not
// pick a kick he cannot get away, a free one may still take touches, a decent chance is shot, a dribble keeps its route.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers,practiceOptions,laneRisk} from '../dist/practice.js';
import {projectMates,projectOpponents,receptionRoom,touchCost,firstTimeCost} from '../dist/practice-receive.js';
import {priceCaught} from '../dist/practice-possession.js';
import {carryOptions,viableOptions,commitCarry} from '../dist/practice-carry.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
// Everyone parked far from play (as receive.test.mjs); the test moves the few men it needs.
function parked(){
 const players=practicePlayers(fixture);
 players.forEach((p,i)=>Object.assign(p,{x:p.side?44-i:4+i,y:p.side?12:-12,vx:0,vy:0}));
 return players;
}

test('a receiver reads a team-mate\'s run forward: the pass he will play on arrival is valued where the runner will be',()=>{
 const players=parked(),p=players[2],q=players[3],d=players[8];
 Object.assign(p,{x:20,y:0,angle:0});p.skills={...p.skills,reading:9,passing:8};
 // the team-mate sets off on a run from beside his marker into the space behind him
 Object.assign(q,{x:24,y:-7,vx:4,vy:0});Object.assign(d,{x:25,y:-6.2,vx:0,vy:0});
 const job=r=>r.id===q.id?{aim:{x:33,y:-8},speed:6.5}:undefined,meeting={x:20,y:0},arrive=1;
 const still=projectOpponents(players,0,meeting,arrive),ahead=projectMates(still,p,arrive,job);
 const mate=ahead.find(r=>r.id===q.id);
 assert(mate.x>27,`he reads the runner on (${mate.x.toFixed(1)} m)`);
 assert.equal(players[3].x,24,'the live player never moves');
 const pass=list=>Math.max(...practiceOptions({...p,...meeting},list,new Set([q.id]),'',0,null,0,null).filter(o=>o.target===q.id&&o.kind==='pass').map(o=>o.score));
 assert(pass(ahead)>pass(still)+.05,`the pass to the runner is worth more read forward (${pass(ahead).toFixed(2)} v ${pass(still).toFixed(2)})`);
 // a man who cannot read the game anticipates the run less far
 const poor=projectMates(still,{...p,skills:{...p.skills,reading:0}},arrive,job).find(r=>r.id===q.id);
 assert(poor.x<mate.x-.5,'a poor reader reads him less far on');
});

test('a pressed player does not choose a kick he cannot get away; a free one is not charged',()=>{
 const players=parked(),p=players[2],q=players[3],d=players[8];
 Object.assign(p,{x:20,y:0,angle:0,vx:0,vy:0});Object.assign(q,{x:30,y:-6});
 const kick={kind:'pass',target:q.id,aim:{x:30,y:-6},score:.4,reason:''},carry={kind:'carry',aim:{x:18,y:4},score:.3,reason:''};
 // a man arriving from behind his shoulder, a stride away, at speed: on him before any wind-up is done
 Object.assign(d,{x:18.6,y:.8,vx:5,vy:-1});
 const priced=priceCaught(p,players,[kick,carry],0),pk=priced.find(o=>o.kind==='pass'&&!o.hurried),quick=priced.find(o=>o.hurried),pc=priced.find(o=>o.kind==='carry');
 assert(pk.score<kick.score-.15,`the kick he would be caught on loses its worth (${pk.score.toFixed(2)})`);
 assert(quick&&quick.score>pk.score,`the same ball played quickly is offered and is worth more (${quick?.score.toFixed(2)})`);
 assert.equal(pc.score,carry.score,'protecting the ball is not charged here');
 Object.assign(d,{x:34,y:8,vx:0,vy:0});
 assert.deepEqual(priceCaught(p,players,[kick],0),[kick],'with nobody near, the kick keeps its value and no hurried ball is offered');
});

test('a free receiver with time still takes a touch off a firm ball; a man on him makes it first time',()=>{
 const players=parked(),p=players[2],q=players[3],d=players[7];
 Object.assign(p,{x:20,y:0,angle:0});Object.assign(q,{x:27,y:-8});p.skills={...p.skills,reading:9};
 const meeting={x:20,y:0},arrive=.6;
 const pass={kind:'pass',target:q.id,aim:{x:27,y:-8},score:1,reason:'',pass:{aim:{x:27,y:-8},speed:12,flight:1,arrivalSpeed:8,risk:0,controlRisk:0,reachMargin:1,weight:'measured'}};
 const read=()=>{const seen=projectOpponents(players,0,meeting,arrive),room=receptionRoom(p,meeting,arrive,players,0);return {touch:touchCost(p,pass,meeting,seen,room,laneRisk),first:firstTimeCost(p,pass,13,false,meeting,seen)};};
 Object.assign(d,{x:38,y:10,vx:0,vy:0});
 const free=read();assert(free.touch<free.first,`free, a 13 m/s ball: a touch (${free.touch.toFixed(2)} v ${free.first.toFixed(2)})`);
 Object.assign(d,{x:22.5,y:.5,vx:-5,vy:0});
 const pressed=read();assert(pressed.touch>pressed.first,'pressed: first time');
});

test('a decent chance is shot rather than carried on',()=>{
 const players=parked(),p=players.filter(r=>r.side===0&&r.role!=='GK').at(-1);
 // 8 m out, central, the keeper on his line, nobody else near
 Object.assign(p,{x:40,y:1,angle:0,vx:0,vy:0});
 const keeper=players.find(r=>r.side===1&&r.role==='GK');Object.assign(keeper,{x:47.5,y:0,vx:0,vy:0});
 const options=practiceOptions(p,players,new Set(),'',0,null,0,null),shot=options.find(o=>o.kind==='shoot');
 assert(shot,'a shot is on offer');
 const carry=Math.max(...options.filter(o=>o.kind==='carry').map(o=>o.score));
 assert(shot.score>carry,`the shot (${shot.score.toFixed(2)}, quality ${shot.quality.toFixed(2)}) beats carrying on (${carry.toFixed(2)})`);
});

test('a dribble keeps its route: the rest of a committed carry is valued as the route it is',()=>{
 const players=parked(),p=players[5];
 Object.assign(p,{x:16,y:0,angle:0,vx:0,vy:0});
 const first=carryOptions(p,players,0,laneRisk,null,0).sort((a,b)=>b.score-a.score)[0];
 const plan=commitCarry(p,first,0,null);
 // 0.5 s on, running it at his carry pace
 const u={x:(plan.aim.x-p.x),y:(plan.aim.y-p.y)},len=Math.hypot(u.x,u.y),run=Math.min(len-2,3);
 Object.assign(p,{x:p.x+u.x/len*run,y:p.y+u.y/len*run,vx:u.x/len*4.5,vy:u.y/len*4.5});
 const again=carryOptions(p,players,.5,laneRisk,plan,.5),kept=again.find(o=>o.continuing);
 assert(kept,'his route is on offer');
 const carries=viableOptions(again,plan,.5).filter(o=>o.carry);
 assert.deepEqual(carries.map(o=>o.continuing),[true],'with nobody in his way he stays on it');
});
