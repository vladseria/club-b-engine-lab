import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {laneRisk} from '../dist/practice.js';
import {refineReceptionSupport} from '../dist/practice-arrangements.js';
import {steerMotion} from '../dist/movement.js';

const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(mirror=false){
 const players=practicePlayers(fixture),poses=[[3,0],[18,0],[23,7],[26,0],[34,-6],[46,0],[22,0],[27,4],[38,0],[40,-9]];
 players.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0}));
 const focus=players[3],mates=[players[1],players[2],players[4]];
 const jobs=Object.fromEntries(mates.map((p,i)=>[p.id,{player:p.id,purpose:['counter-cover','outlet','depth'][i],kind:i===2?'run':'support',
  aim:[{x:18,y:0},{x:26,y:7},{x:38,y:-6}][i],speed:p.pace*.85,since:9,until:12,reason:'Existing invitation'}]));
 if(mirror){
  players.forEach(p=>Object.assign(p,{side:1-p.side,x:48-p.x,y:-p.y,vx:-p.vx,vy:-p.vy,angle:p.angle+Math.PI}));
  Object.values(jobs).forEach(j=>j.aim={x:48-j.aim.x,y:-j.aim.y});
 }
 const refine=(fixed=new Set())=>refineReceptionSupport(players,focus,mates,fixture.teams[0].tactics,laneRisk,10,.4,jobs,fixed);
 return {players,focus,mates,jobs,refine};
}
// Honest run timing (1d43067a) lengthened every delivery read, so the outlet's spot at (26, 7) keeps no room (his
// marker gets there 0.26 s before the ball) and stepping to (24, 10) (room 0.16) no longer paid the 0.06/m cost of
// changing his aim. Since the pre-push fixes (2026-10-12) that cost scales with the room his own spot keeps
// (refineReceptionSupport, CHANGE_COST): stepping off a marker who beats the ball is not dithering.
test('a receiving outlet adjusts away from closing pressure without dissolving the runner and cover',()=>{
 for(const mirror of [false,true]){
  const {players,mates,jobs,refine}=scene(mirror),original=structuredClone({players,jobs});
  const moves=refine();assert(moves);
  assert.deepEqual({players,jobs},original,'Evaluation must not execute movement or mutate instructions');
  const outlet=moves.find(j=>j.player===mates[1].id),old=jobs[outlet.player];
  const travel=job=>{const p={...mates[1]};for(let tick=0;tick<72;tick++)steerMotion(p,job.aim,1/60,job.speed);return p;};
  const before=travel(old),after=travel(outlet),marker=players[7];
  assert(Math.hypot(after.x-marker.x,after.y-marker.y)>Math.hypot(before.x-marker.x,before.y-marker.y)+1,
   'A normal accelerated movement should create more separation from the closing marker');
  for(const move of moves){
   assert.equal(move.purpose,jobs[move.player].purpose);assert.equal(move.kind,jobs[move.player].kind);
   assert.equal(move.until,jobs[move.player].until,'An angle adjustment must not keep renewing the invitation');
  }
  assert.deepEqual(moves.find(j=>j.player===mates[2].id).aim,jobs[mates[2].id].aim,'The useful forward run survives');
 }
});
test('an explicit destination is preserved while ordinary teammates adjust around it',()=>{
 const {jobs,refine}=scene(),ids=Object.keys(jobs);
 // (recon 2026-10-16, finding 16) the check below only ran when refine returned moves, and with the outlet fixed it
 // returns none, so it never ran. Now: the outlet is the man who would step away (first), and fixed he stays put,
 // whether refine hands back no moves at all or moves that keep his job.
 assert.notDeepEqual(refine().find(j=>j.player===ids[1]).aim,jobs[ids[1]].aim,'unfixed, the outlet adjusts');
 const moves=refine(new Set([ids[1]]));
 assert.deepEqual(moves?moves.find(j=>j.player===ids[1]):jobs[ids[1]],jobs[ids[1]],'fixed, his destination is kept');
 assert.equal(refine(new Set(ids)),null,'A fully authored arrangement must not be replaced');
});
test('receiving adjustments have symmetric geometry in both attacking directions',()=>{
 const normal=scene().refine(),mirrored=scene(true).refine();assert(normal&&mirrored);
 normal.forEach((job,i)=>{
  assert.equal(job.player,mirrored[i].player);
  assert(Math.abs(job.aim.x+mirrored[i].aim.x-48)<1e-8);
  assert(Math.abs(job.aim.y+mirrored[i].aim.y)<1e-8);
 });
});
