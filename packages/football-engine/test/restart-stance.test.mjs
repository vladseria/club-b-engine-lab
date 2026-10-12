import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers,runMatch,teamApproaches} from '../dist/index.js';
import {restartKickPosition,restartPlayersReady,restartPositions} from '../dist/practice-restarts.js';
import {controlReleaseAvailable} from '../dist/practice-control.js';
import {steerMotion,steer} from '../dist/movement.js';
import {matchIntegrity} from '../evidence/2026-09-24-restart-fairness/integrity.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
const penaltyScene=JSON.parse(fs.readFileSync(new URL('./penalty-gather-scene.json',import.meta.url)));

for(const mirror of [false,true])test(`recorded penalty gathering actually becomes legal${mirror?' mirrored':''}`,()=>{
 const {players,restart}=structuredClone(penaltyScene);
 if(mirror){for(const p of players){p.x=48-p.x;p.y=-p.y;p.vx=-p.vx;p.vy=-p.vy;p.angle+=Math.PI;p.side=1-p.side;}restart.side=1-restart.side;restart.spot={x:48-restart.spot.x,y:-restart.spot.y};}
 const positions=restartPositions(restart.kind,restart.side,restart.spot,restart.taker,players,true);
 let legal=false;
 for(let t=0;t<15;t+=1/60){
  for(const p of players){steer(p,positions[p.id],1/60,p.pace,players);p.x=Math.max(.3,Math.min(47.7,p.x));p.y=Math.max(-14.7,Math.min(14.7,p.y));}
  if(restartPlayersReady(restart,players)){legal=true;break;}
 }
 assert(legal,'All actual players, including attacking teammates, must get outside the legal radius');
});

for(const mirror of [false,true])test(`restart taker physically reaches a playable touchline stance${mirror?' mirrored':''}`,()=>{
 const p=practicePlayers(fixture)[8],spot={x:38.44043203194861,y:-14.7},aim={x:41.5,y:-7};
 Object.assign(p,{x:38.20585018144401,y:-14.7,vx:0,vy:0,angle:.81});
 if(mirror){for(const v of [p,spot,aim]){v.x=48-v.x;v.y=-v.y;}p.side=1-p.side;p.angle+=Math.PI;}
 assert(!controlReleaseAvailable(p,spot,aim),'Reproduced body position cannot kick');
 const original={...spot};let ready=false;
 for(let t=0;t<4;t+=1/60){
  const target=restartKickPosition(p,spot,aim,'freeKick'),old={...p};
  steerMotion(p,target,1/60,.55,[],undefined,0);
  const wanted=Math.atan2(aim.y-p.y,aim.x-p.x),difference=Math.atan2(Math.sin(wanted-p.angle),Math.cos(wanted-p.angle));
  p.angle+=Math.max(-4/60,Math.min(4/60,difference));
  assert(Math.hypot(p.vx-old.vx,p.vy-old.vy)<=p.acceleration/60+1e-8);
  assert(p.x>=.3&&p.x<=47.7&&Math.abs(p.y)<=14.7+1e-9);
  assert.deepEqual(spot,original,'Repositioning cannot move the ball');
  if(controlReleaseAvailable(p,spot,aim)){ready=true;break;}
 }
 assert(ready);assert(restartPlayersReady({kind:'freeKick',side:p.side,spot,taker:p.id},[p]));
});

test('ordinary interior and corner setup geometry is preserved when playable',()=>{
 const p=practicePlayers(fixture)[3];
 for(const [spot,aim,kind] of [[{x:24,y:0},{x:40,y:3},'kickoff'],[{x:16,y:8},{x:33,y:-3},'freeKick'],[{x:47.8,y:14.8},{x:39,y:0},'corner']]){
  const dx=aim.x-spot.x,dy=aim.y-spot.y,d=Math.hypot(dx,dy),margin=kind==='corner'?.8:-.3;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const expected={x:clamp(spot.x-dx/d*.65,-margin,48+margin),y:clamp(spot.y-dy/d*.65,-15-margin,15+margin)};
  assert.deepEqual(restartKickPosition(p,spot,aim,kind),expected);
 }
});

for(const seed of [1573239594,3156540301])test(`recorded match ${seed} resumes its boundary restart`,()=>{
 const f=structuredClone(fixture);f.teams[1]=structuredClone(f.teams[0]);f.seed=seed;f.kickoff=seed===1573239594?0:1;
 for(const t of f.teams)Object.assign(t.tactics,teamApproaches.balanced.settings,{marking:'balanced'});
 const end=seed===1573239594?90:650,r=runMatch({fixture:f,durationSeconds:end}).result;
 const integrity=matchIntegrity(r);assert(integrity.ok,JSON.stringify(integrity));
 const after=seed===1573239594?70:614;
 assert(r.events.some(e=>e.time>after&&e.time<end&&['pass','shot','receive'].includes(e.kind)),'Play continues after the recorded stoppage');
});

test('audit detects a clock reaching full time while a restart remains stuck',()=>{
 const r={duration:900,frames:[{time:0,restart:false},{time:68,restart:true,restartInfo:{kind:'freeKick'}},{time:900,restart:true}],events:[{time:70,kind:'restart'},{time:900,kind:'end'}]};
 const result=matchIntegrity(r);assert(!result.ok);assert.equal(result.longestRestart.duration,832);assert.equal(result.longestQuiet.duration,830);
});
