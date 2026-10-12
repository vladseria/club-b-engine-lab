// Track the runner (2026-10-11, evidence/2026-10-11-track-runner). A defender reads a forward run from where it
// starts and where it is going, not only from its speed: a midfielder setting off from behind the ball (accelerating
// at our goal, still well under the 3.5 m/s "running" speed) is a runner to a defender who reads the game; a man
// jogging forward at the same speed is not; a defender who cannot read the game sees the same start late, if at all.
// Team 1 defends the goal at x = 48; team 0's midfielder is 30 m out, behind the ball.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {readRun,readMan,RUN_GOALWARD} from '../dist/practice-defending.js';
import {L} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const scene=reading=>{
 const f=structuredClone(fixture);
 for(const p of f.teams[1].squad)Object.assign(p.skills,{reading,defending:reading});
 const players=practicePlayers(f),man=players.find(p=>p.side===0&&p.role!=='GK'&&p.role!=='ST'),d=players.find(p=>p.side===1&&p.role!=='GK');
 return {players,man,d};
};
// what the defender sees: the man now, and RUN_LOOK s earlier `earlier` m/s slower at our goal
const viewOf=earlier=>(r,t,before)=>before?{...t,vx:t.vx-earlier}:t;
const input=(view,time=20)=>({defending:1,attacking:0,tactics:{...fixture.teams[1].tactics,line:'standard',press:'balanced'},time,view,carrier:undefined,receiver:undefined});
const g={x:L,y:0},ref={x:22,y:0};

test('a run setting off from behind the ball is read as a run before it reaches running speed; a steady jog is not',()=>{
 const {man,d}=scene(10);
 Object.assign(man,{x:18,y:3,vx:2,vy:0});Object.assign(d,{x:28,y:1,vx:0,vy:0});
 const da=L-man.x,db=L-ref.x;
 const run=readRun(d,man,man,input(viewOf(.8)),da,db,g);
 assert.ok(run&&run.vx>=RUN_GOALWARD,`setting off (2 m/s, accelerating): read at ${run?.vx.toFixed(2)} m/s`);
 assert.equal(readRun(d,man,man,input(viewOf(0)),da,db,g),undefined,'jogging at 2 m/s: no run');
 assert.equal(readMan(d,man,input(viewOf(.8)),ref,false).running,true,'he matters as a runner');
 assert.equal(readMan(d,man,input(viewOf(0)),ref,false).running,false);
});

test('reading decides how early: a defender who cannot read the game sees the same start less often',()=>{
 const seen=(reading,earlier=.8)=>{let n=0;const {man,d}=scene(reading);
  for(let k=0;k<40;k++){Object.assign(man,{x:14+k%5*2,y:-10+Math.floor(k/5)*2.5,vx:2,vy:0});Object.assign(d,{x:man.x+10,y:man.y*.5,vx:0,vy:0});
   if(readRun(d,man,man,input(viewOf(earlier),20+k),L-man.x,L-ref.x,g))n++;}
  return n;};
 const sharp=seen(10),poor=seen(0);
 assert.equal(sharp,40,`a sharp reader reads every start (${sharp}/40)`);
 assert.ok(poor<20,`a poor one reads under half of them (${poor}/40)`);
 // (skill range widened 2026-10-11) a gentler start (2.5 m/s/s): a good reader (9) reads nearly every one, an
 // average one (6) under half. On the old 0.15..0.6 s range both read about a fifth of them (9 and 7 of 40).
 const good=seen(9,.5),average=seen(6,.5);
 assert.ok(good>=36,`a good reader reads a gentler start (${good}/40)`);
 assert.ok(average<20,`an average one mostly reads it later (${average}/40)`);
});
