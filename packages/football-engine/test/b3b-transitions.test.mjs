import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {readTransition} from '../dist/practice-transition.js';
import {counterNumbers,counterOn,approachForSituation,approachOptions,COUNTER_VALUE,COUNTER_WINDOW} from '../dist/team-approach.js';
import {carryPace,CARRY_CLOSE,CARRY_OPEN} from '../dist/practice-control.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));
const withTransition=(transition)=>{const f=structuredClone(fixture);f.teams[0].tactics={...f.teams[0].tactics,transition};return f;};
// Team 0 (1-2-1: GK, CB, W, W, ST) attacks towards x = 48 and has just won
// the ball at (12, 0) with its CB. Team 1 lost it high: two of its outfielders
// are around the ball (the counter-press), the others as set below.
const regain=(transition,theirRest,oursAhead)=>{
 const players=practicePlayers(withTransition(transition));
 const rest=[[30,-4],[32,4],[36,0]].slice(0,theirRest),press=[[13.5,2],[10,-3],[16,-6],[9,5]].slice(0,4-theirRest);
 const ahead=[[16,-8],[18,8],[20,0]].slice(0,oursAhead),behind=[[8,-9],[7,9],[6,0]].slice(0,3-oursAhead);
 place(players,[[2,0],[12,0],...ahead,...behind,[46,0],...rest,...press]);
 return {players,carrier:players[1]};
};

// Change 2: a counter is read by the numbers (R1: only Counter's team plays it).
test('a counter is on when the numbers favour the winner, and On winning it sets how clear they must be',()=>{
 const t=transition=>({...fixture.teams[0].tactics,transition});
 // Two of ours ahead of the ball (three with the carrier) against a rest
 // defence of two: the men pressing the ball are not the defence.
 const {players,carrier}=regain('balanced',2,2);
 assert.deepEqual(counterNumbers(players,carrier),{ours:3,theirs:2});
 assert(counterOn(t('balanced'),players,carrier,1),'Balanced goes at a man over');
 assert(counterOn(t('secure'),players,carrier,1),'Keep it goes with a clear man over');
 assert(!counterOn(t('balanced'),players,carrier,COUNTER_WINDOW+.1),'not once the recovery is old');
 // Level numbers (two against two): Balanced goes, Keep it keeps the ball.
 const level=regain('balanced',2,1);
 assert.deepEqual(counterNumbers(level.players,level.carrier),{ours:2,theirs:2});
 assert(counterOn(t('balanced'),level.players,level.carrier,1));
 assert(!counterOn(t('secure'),level.players,level.carrier,1),'Keep it needs a man over (B1: a clear 2-v-1)');
 // One short (one against two): only Counter goes.
 const short=regain('balanced',2,0);
 assert(!counterOn(t('balanced'),short.players,short.carrier,1));
 assert(counterOn(t('counter'),short.players,short.carrier,1),'Counter goes even one short');
 // A full rest defence of three is organised, not a counter, for Balanced.
 const set=regain('balanced',3,2);
 assert(!counterOn(t('balanced'),set.players,set.carrier,1));
 // Not from the keeper's hands.
 assert(!counterOn(t('balanced'),players,players[0],1));
});

// R1 (2026-10-01): only Counter's team plays it forward (direct, striker in
// behind); for Balanced and Keep it the counter is the carrier's read and
// changes no setting (test/r1-agency.test.mjs).
test('a counter that is on does not kick the ball away to nobody',()=>{
 const {players,carrier}=regain('balanced',2,2),base=fixture.teams[0].tactics;
 const t=approachForSituation({...base,transition:'balanced'},players,carrier,1);
 assert.equal(t.counter,true);assert.equal(t.progression,base.progression);assert.equal(t.striker,base.striker);
 assert.equal(t.commit,base.commit,'Balanced does not change its bodies forward');
 const quiet=approachForSituation({...base,transition:'balanced'},players,carrier,COUNTER_WINDOW+1);
 assert(!quiet.counter);
 const clear=(clearance,score)=>({kind:'clear',clearance,aim:{x:40,y:0},score,reason:''});
 const options=[clear('long',.5),clear('touchline',.4),clear('mate',.45),{kind:'carry',aim:{x:16,y:0},score:.3,reason:''}];
 const on=approachOptions(carrier,options,{...t,progression:'mixed'},players),off=approachOptions(carrier,options,{...quiet,progression:'mixed'},players);
 assert.equal(on[0].score,.5-COUNTER_VALUE);assert.equal(on[1].score,.4-COUNTER_VALUE);
 assert.equal(on[2].score,.45,'a clearance into a team-mate\'s path keeps its value');assert.equal(on[3].score,.3);
 assert.deepEqual(off.map(o=>o.score),[.5,.4,.45,.3],'nothing changes without a counter');
});

// Change 1: a break under way is a race still being won, not re-opened
// from scratch at every re-plan.
test('a break run under way is kept while its race is being won',()=>{
 const f=withTransition('balanced'),players=practicePlayers(f),t=f.teams[0].tactics;
 // Our carrier at (10, 0); our winger already running at (18, 5). One of
 // theirs has been bypassed (14, -3); the rest are far up the pitch.
 place(players,[[2,0],[10,0],[18,5],[6,-8],[5,6],[46,0],[14,-3],[40,5],[42,-6],[44,1]]);
 const runner=players[2],aim={x:28,y:5};
 const fresh=readTransition(players,players[1],t,1,[],10);
 assert(!fresh.lanes.some(l=>l.player===runner.id&&Math.hypot(l.aim.x-aim.x,l.aim.y-aim.y)<.1),'a fresh run needs two men bypassed');
 const kept=readTransition(players,players[1],t,1,[{player:runner.id,aim,until:12}],10);
 assert(kept.lanes.some(l=>l.player===runner.id&&Math.hypot(l.aim.x-aim.x,l.aim.y-aim.y)<.1),'the same destination, reached first with room past one man, stays open');
 // The coordinator keeps him on it.
 const ball={x:10.6,y:0,vx:0,vy:0,z:0,vz:0,mode:'control',owner:players[1].id};
 const previous=coordinateFootball(players,ball,0,f.teams.map(x=>x.tactics),laneRisk,{time:10,recoveredAt:9});
 previous.jobs[runner.id]={player:runner.id,purpose:'break',kind:'run',aim,speed:runner.pace*.95,reason:'',since:10,until:12};
 const next=coordinateFootball(players,ball,0,f.teams.map(x=>x.tactics),laneRisk,{time:10.25,recoveredAt:9},previous);
 assert.equal(next.jobs[runner.id].purpose,'break');
 assert(Math.hypot(next.jobs[runner.id].aim.x-aim.x,next.jobs[runner.id].aim.y-aim.y)<.1);
 // Caught (an opponent reaches the destination first, at close range) it ends.
 place(players,[[2,0],[10,0],[18,5],[6,-8],[5,6],[46,0],[14,-3],[27,6],[42,-6],[44,1]]);
 const caught=readTransition(players,players[1],t,1,[{player:runner.id,aim,until:12}],10);
 assert(!caught.lanes.some(l=>l.player===runner.id&&Math.hypot(l.aim.x-aim.x,l.aim.y-aim.y)<.1));
});

// Change 3: running with the ball into open ground.
test('a carrier knocks the ball on into open ground and keeps it close in traffic',()=>{
 const p={x:20,y:0,pace:7},aim={x:27,y:0};
 assert.equal(carryPace(p,aim,[]),7*CARRY_OPEN,'nobody ahead: nearly flat out');
 assert.equal(carryPace(p,aim,[{x:23,y:.5}]),7*CARRY_CLOSE,'a man 3 m ahead: close control');
 assert.equal(carryPace(p,aim,[{x:17,y:0}]),7*CARRY_OPEN,'a chaser 3 m behind does not shorten the touch');
 assert.equal(carryPace(p,aim,[{x:18.8,y:.3}]),7*CARRY_CLOSE,'unless he is at his heels');
 assert.equal(carryPace(p,aim,[{x:26,y:14}]),7*CARRY_OPEN,'a man far off the line of the carry is not in the way');
 const partly=carryPace(p,aim,[{x:26,y:0}]);assert(partly>7*CARRY_CLOSE&&partly<7*CARRY_OPEN,'6 m ahead: in between');
});
