// Goal-line freeze (2026-10-20): two matches in 6,800 of the settings audit stood still for eight to eleven minutes,
// a player on the ball by a goal line and nobody acting, until full time. Each scene is the frozen frame of one of them
// (evidence/2026-10-20-goalline-freeze, frozen-frames.json -> scenes.mjs), replayed with the calls practice.ts makes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessShot,placeHurried,hurriedShotAim,strikeShot} from '../dist/practice-football.js';
import {shotContest} from '../dist/practice-shot-contest.js';
import {controlStrikeReady,strikeControl,steerControl,advanceControl} from '../dist/practice-control.js';
const scene=name=>JSON.parse(readFileSync(new URL(`./${name}`,import.meta.url)));
const rng=seed=>()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const setup=s=>{const players=structuredClone(s.players),p=players[s.carrier];
 return {players,p,ball:{...s.ball},state:{owner:p.id,time:0,readyAt:0,active:null,intent:'',contacts:[],setTouch:false,feet:structuredClone(s.feet)}};};

test('a hurried near-post shot from a tight angle is struck where he set it, not refused to full time',()=>{
 const s=scene('goalline-freeze-shot-scene.json'),{players,p,ball,state}=setup(s);
 const read=assessShot(p,players),contest=shotContest(p,players,read.aim,{firstTime:false});
 const keeper=players.find(q=>q.side!==p.side&&q.role==='GK'),strikable=a=>controlStrikeReady(p,ball,state,a,'shot');
 // the trap: the aim he set passes the release gate; the hurry's pull crosses his own body
 assert.ok(contest.hurry>.5,`hurried (${contest.hurry.toFixed(2)})`);
 assert.ok(strikable(read.aim),'set for the near post');
 const pulled=placeHurried(read.aim,keeper,contest.hurry);
 assert.ok(!strikable(pulled),'the pulled aim runs through his own body');
 // what was struck before: the pulled aim, refused on every tick for 10 s
 const tries=(aim,seed,ticks)=>{const r=rng(seed);for(let i=0;i<ticks;i++){const b={...ball},st=structuredClone(state),v=strikeShot(p,b,{...read,aim},r,contest.hurry,contest.offBalance);if(strikeControl(p,b,st,aim,v,'shot'))return {tick:i,ball:b};}return null;};
 assert.equal(tries(pulled,1,600),null,'the old placement is never struck');
 // now: where he set it, his striking error still applying; the shot goes within a few ticks and towards the goal
 const aim=hurriedShotAim(read.aim,keeper,contest.hurry,strikable);
 assert.deepEqual(aim,read.aim);
 for(let seed=1;seed<=20;seed++){
  const struck=tries(aim,seed,60);
  assert.ok(struck,`seed ${seed}: struck within a second`);
  assert.ok(struck.ball.vx>0&&Math.abs(struck.ball.y+(48-struck.ball.x)*struck.ball.vy/struck.ball.vx)<4,`seed ${seed}: at the goal`);
 }
 // a pull he can strike is unchanged (every other hurried shot)
 assert.deepEqual(hurriedShotAim(read.aim,keeper,contest.hurry,()=>true),pulled);
});

test('a back pass by his own goal line: he walks round the ball the long way and is ready to play it',()=>{
 const s=scene('goalline-freeze-backpass-scene.json'),{players,p,ball,state}=setup(s);
 const opponents=players.filter(q=>q.side!==p.side);
 assert.ok(!controlStrikeReady(p,ball,state,s.aim,'pass'),'the pass to his keeper starts behind his own body');
 let ready=null;
 for(let t=0;t<3;t+=1/60){
  const old={...p};steerControl(p,ball,state,s.aim,opponents,1/60,p.pace*.68,true,'pass');
  assert.ok(advanceControl(p,old,ball,state,s.aim,opponents,1/60,true),'he keeps the ball');
  assert.ok(ball.x>0&&ball.x<48&&Math.abs(ball.y)<15&&p.x<48,'in play');
  if(controlStrikeReady(p,ball,state,s.aim,'pass')){ready=t;break;}
 }
 assert.ok(ready!==null&&ready<1.5,`ready to pass within 1.5 s (${ready})`);
});
