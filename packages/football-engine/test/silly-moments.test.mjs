// Silly moments (2026-10-01): things players watched in live matches that no
// footballer does, each reproduced from a recorded moment of build 73e4bc52
// (evidence/2026-10-01-silly-moments). Reads stay individual and imperfect;
// these are physics and weighting faults, not choices.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {steerControl,advanceControl,controlStrikeReady,receivingContact,cushionControl,captureControl} from '../dist/practice-control.js';
import {advanceFlight} from '../dist/practice-flight.js';
import {groundPassCandidates} from '../dist/practice-passing.js';
import {practicePlayers} from '../dist/practice.js';
const scene=name=>JSON.parse(readFileSync(new URL(`./${name}`,import.meta.url)));
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
// The firmest ordinary ground pass of a length arrives at this speed (practice-passing firmArrival).
const firmArrival=length=>Math.min(19,Math.min(14,Math.max(6,5.5+length*.24))+4);
const toAim=(aim,v)=>Math.hypot(aim.x-v.x,aim.y-v.y);
const mirror=s=>{const m=structuredClone(s),flip=v=>{v.x=48-v.x;v.y=-v.y;if('vx' in v){v.vx=-v.vx;v.vy=-v.vy;}};
 for(const v of [m.player,m.ball,m.aim,...m.state.feet,...m.opponents])flip(v);for(const q of [m.player,...m.opponents]){q.angle+=Math.PI;q.side=1-q.side;}return m;};
// The match loop for one player (opponents frozen): receive the ball in
// flight with the intention of playing it to `aim`, then prepare that kick
// (or carry towards it). Same calls, order and arguments as practice.ts.
function play(s,{kind='shot',seconds=2.5}={}){
 const {player:p,ball,state,aim,opponents}=structuredClone(s),preparing=kind!=='carry',strike=kind==='carry'?'pass':kind;
 let t=0,start={x:ball.x,y:ball.y},out=false,lost=false,ready=null;
 if(!ball.owner){
  if(!state.feet.length)state.feet=captureControl(p,ball).feet;
  for(;t<2;t+=1/60){
   const old={...p},before={...ball};steerControl(p,ball,state,aim,opponents,1/60,p.pace,true,strike);advanceFlight(ball);
   const hit=receivingContact(p,old,before,ball,state,state.time+1/60,1/60);
   if(hit){Object.assign(ball,before);advanceFlight(ball,hit.fraction/60);cushionControl(ball,state,hit,state.time,{aim,opponents,release:preparing});
    advanceFlight(ball,(1-hit.fraction)/60);ball.owner=p.id;ball.mode='control';start={x:ball.x,y:ball.y};break;}
  }
  assert.equal(ball.owner,p.id,'the recorded pass is received');
 }
 for(;t<seconds;t+=1/60){
  const old={...p};steerControl(p,ball,state,aim,opponents,1/60,p.pace*.68,preparing,strike);
  if(!advanceControl(p,old,ball,state,aim,opponents,1/60,preparing)){lost=true;break;}
  if(ball.x<0||ball.x>48||Math.abs(ball.y)>15){out=true;break;}
  if(preparing&&controlStrikeReady(p,ball,state,aim,strike)){ready=t;break;}
 }
 return {out,lost,ready,away:toAim(aim,ball)-toAim(aim,start),speed:Math.hypot(ball.vx,ball.vy)};
}

// "They run aimlessly even though they have a set direction": Short's #4
// took a hard pass running towards the touchline and wanted to carry inside
// (away from the line, towards goal). Every touch handed the ball his own
// running speed, so he chased it 10 m the wrong way and over the line.
for(const flip of [false,true])test(`a turn stops the ball's run away from where he is taking it, not over the touchline${flip?' (mirrored)':''}`,()=>{
 const s=scene('silly-touchline-turn-scene.json'),r=play(flip?mirror(s):s,{kind:'carry'});
 assert.equal(r.out,false,'the ball stays in play');
 assert.ok(r.away<4,`no more than a turning step away from his aim (${r.away.toFixed(2)} m)`);
});

// "The striker runs the ball from in front of the goal": a through ball
// reached the striker 7 m out as he was coming back; he meant to shoot, but
// his first touch went on with his backward run and he chased it 11 m from
// goal (2.4 s) before he could set himself. The hard pass still bounces off
// his foot (reception physics); his touch no longer adds his run to it.
for(const flip of [false,true])test(`a first touch set for a shot does not run away from goal with him${flip?' (mirrored)':''}`,()=>{
 const s=scene('silly-first-touch-shot-scene.json'),r=play(flip?mirror(s):s,{kind:'shot'});
 assert.ok(r.ready!==null&&r.ready<1.5,`he is set to shoot within 1.5 s (${r.ready})`);
 assert.ok(r.away<5,`the ball is not carried away from goal (${r.away.toFixed(2)} m)`);
});

// The owner's complaint word for word: a through ball reached the striker
// 8 m out, he meant to shoot, and his first touch ran on with him towards
// the byline; he chased it until it went out for a goal kick.
for(const flip of [false,true])test(`a striker 8 m out sets the ball for his shot instead of running it over the byline${flip?' (mirrored)':''}`,()=>{
 const s=scene('silly-byline-shot-scene.json'),r=play(flip?mirror(s):s,{kind:'shot'});
 assert.equal(r.out,false,'the ball stays in play');
 assert.ok(r.ready!==null&&r.ready<1,`he is set to shoot within a second (${r.ready})`);
});

// "They don't control the balls any more": through balls met a runner early
// by driving the ball at him (up to ~22 m/s over 12 m), and it bounced off.
test('a pass into a runner is never struck harder than the firm pass of its length',()=>{
 const players=practicePlayers(structuredClone(fixture)),p=players[2],q=players[4];
 Object.assign(p,{x:26,y:-2,vx:0,vy:0,angle:0});Object.assign(q,{x:31,y:6,vx:5,vy:-1,angle:0});
 for(const [i,x,y] of [[5,46,0],[6,38,-4],[7,36,4],[8,33,-9],[9,40,8]])Object.assign(players[i],{x,y,vx:0,vy:0});
 const run={aim:{x:41,y:3},speed:q.pace};
 const plans=groundPassCandidates(p,q,true,run,p,players.filter(o=>o.side!==p.side));
 assert.ok(plans.some(c=>c.meetingTime!==undefined),'the runner can be met in his stride');
 for(const c of plans)assert.ok(c.arrivalSpeed<=firmArrival(Math.hypot(c.aim.x-p.x,c.aim.y-p.y))+1e-6,`${c.weight} ${c.meetingTime??''}: arrives at ${c.arrivalSpeed.toFixed(1)} m/s`);
});
