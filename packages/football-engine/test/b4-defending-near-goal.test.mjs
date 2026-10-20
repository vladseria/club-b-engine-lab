import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball,REGROUP_BEHIND} from '../dist/practice-coordination.js';
import {runnerPickupDelay,runnerBehindShoulder,RUNNER_LAPSE_MAX} from '../dist/practice-defense.js';
import {PracticePlaybook} from '../dist/practice-playbook.js';
import {runMatch} from '../dist/index.js';
import {L,GH} from '../dist/pitch.js';
import {KEEPER_SPREAD} from '../dist/practice-keeper.js';
import {constructed,play} from './constructed-scenes.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));

// Regroup ("On losing it"). Team 1 (1-2-1, own goal at x = 48) has just lost
// the ball high up (at 10 s) to team 0's left winger at (16, -6); as in
// b3-losing-the-ball, its two wide players are near the ball, its striker
// goal-side of it and its centre-back deep.
const afterLoss=(onLoss,{escaped=false,order=null,wideAhead=false}={})=>{
 const f=structuredClone(fixture);f.teams[1].tactics={...f.teams[1].tactics,onLoss};
 const players=practicePlayers(f);
 place(players,[[4,0],[10,5],[16,-6],[24,8],[28,-2],[46,0],[34,0],[19,-4],wideAhead?[8,8]:[13,-8],[22,4]]);
 const owner=players[2],tactics=f.teams.map(t=>t.tactics);
 const book=order?new PracticePlaybook({side:1,plans:[{id:'policy',name:'Policy',weight:100,emphasis:1,instructions:[],preferred:null,lesson:{spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[]},standing:[order]}]},2026):null;
 let v=null;
 for(let k=0;k<4;k++){
  const time=10.05+k*.25;
  if(escaped&&k===2)Object.assign(owner,{x:27,y:-6});// 11 m on, towards team 1's goal
  const ball={x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:owner.id};
  v=coordinateFootball(players,ball,0,tactics,laneRisk,{time,recoveredAt:10,...(book?{responsibilities:preview=>book.persistent(time,players,ball,preview.attacking,tactics[1],preview,new Set(),null)}:{})},v);
 }
 const team=players.filter(p=>p.side===1&&p.role!=='GK'),job=p=>v.jobs[p.id];
 return {v,players,owner,team,job,purposes:team.map(p=>job(p).purpose)};
};
const depth1=x=>L-x;
test('Regroup: the nearest delays with a cover, everyone else not yet goal-side drops behind the ball at a run',()=>{
 const s=afterLoss('regroup',{wideAhead:true});
 assert.equal(s.v.counterPress.mode,'delay');assert(s.v.counterPress.drop);
 const delayer=s.team.find(p=>s.job(p).purpose==='press');
 assert(delayer&&s.job(delayer).kind==='jockey','the nearest delays');
 assert(s.purposes.includes('cover'),`the delay is covered (${s.purposes})`);
 const dropping=s.team.filter(p=>s.job(p).purpose==='drop');
 assert(dropping.length>=1,`the man caught ahead of the ball drops (${s.purposes})`);
 for(const p of dropping){
  const j=s.job(p);
  // At a run, as hard as his discipline takes him (R2): full pace from 0.9.
  assert.equal(j.kind,'recover');assert(Math.abs(j.speed-p.pace*Math.min(1,Math.max(.75,1-.35*(.9-p.traits.discipline))))<1e-9,'at a run');
  assert(depth1(j.aim.x)<=depth1(s.owner.x)-REGROUP_BEHIND+1e-9,'to a point goal-side of the ball');
 }
 // Balanced at the same scene: nobody is sent to drop.
 const bal=afterLoss('balanced',{wideAhead:true});
 assert(!bal.purposes.includes('drop'),`Balanced has no drop (${bal.purposes})`);
});
test('Regroup keeps dropping after the ball has left the loss zone; Counter-press never drops',()=>{
 const s=afterLoss('regroup',{escaped:true,wideAhead:true});
 assert(s.v.counterPress.over,'the ball left the zone');
 assert(s.purposes.includes('drop'),`the drop goes on (${s.purposes})`);
 assert(!afterLoss('counterpress',{wideAhead:true}).purposes.includes('drop'));
});
test('a standing mark order survives the Regroup drop',()=>{
 const s=afterLoss('regroup',{wideAhead:true,order:{id:'mark',actor:4,kind:'mark',opponent:4,phase:'defending'}});
 const marker=s.players.find(p=>p.side===1&&p.number===4),target=s.players.find(p=>p.side===0&&p.number===4);
 assert.equal(s.job(marker).purpose,'playbook');assert.equal(s.job(marker).target,target.id,'the ordered defender keeps his man');
});

// Gap 4: a runner from behind the shoulder is picked up a moment late.
test('a runner from behind a closing defender\'s shoulder is picked up late, less so by a good reader, never beyond the cap',()=>{
 assert(runnerPickupDelay(0)<=RUNNER_LAPSE_MAX+1e-12&&RUNNER_LAPSE_MAX<=.3);
 assert(runnerPickupDelay(10)<runnerPickupDelay(5)&&runnerPickupDelay(5)<runnerPickupDelay(0));
 assert(runnerPickupDelay(10)>0,'even a great reader turns his head');
 // A defender facing +x (towards the ball): a runner behind him and moving is
 // outside his view; one in front, or one standing still, is not.
 const d={x:20,y:0,angle:0};
 assert(runnerBehindShoulder(d,{x:18,y:1,vx:-4,vy:0}),'behind the shoulder, running');
 assert(!runnerBehindShoulder(d,{x:23,y:1,vx:-4,vy:0}),'in front of him');
 assert(!runnerBehindShoulder(d,{x:18,y:1,vx:.5,vy:0}),'barely moving');
});
test('in a match, late pick-ups happen, are short, and only ever for a runner after a press',()=>{
 // (Seed 2057 since the recon fixes, 2026-10-16, after about sixteen re-pins; the history sat above the keeper test until
 // lane C, 2026-10-21: git show 1d094d96:packages/football-engine/test/b4-defending-near-goal.test.mjs. Lane C left this
 // one seeded: positions-only starts reach a runner already moving behind a presser only by seed; see
 // evidence/2026-10-21-lane-c/README.md.)
 const f=structuredClone(fixture);f.seed=2057;
 const r=runMatch({fixture:f,durationSeconds:300}).result;
 // (track the runner, 2026-10-11) The pick-up is the marker's first move that is no longer the old press: following
 // the man ('track') or, since the marking-and-shape round, hurrying back goal-side of him ('recover'). With runs read
 // from their start, 2030 now has a pick-up that goes press -> recover (0.16 s) -> track (0.5 s after the press): the
 // lapse is the first 0.16 s, so 'recover' ends it too (evidence/2026-10-11-track-runner).
 const picked=k=>k==='track'||k==='recover';
 let lapses=0;const open=new Map();
 for(const c of r.choices){const a=c.assignment;const cur=open.get(c.player);
  if(cur&&(!a||a.purpose!=='mark'||a.since!==cur.since||picked(c.kind))){open.delete(c.player);if(a&&a.purpose==='mark'&&a.since===cur.since&&picked(c.kind)){lapses++;assert(c.time-cur.t<=RUNNER_LAPSE_MAX+.02,`delay ${c.time-cur.t}`);}}
  if(a&&a.purpose==='mark'&&(c.kind==='press'||c.kind==='jockey')&&!open.has(c.player))open.set(c.player,{t:c.time,since:a.since});}
 assert(lapses>0,'some runners leave from behind a shoulder');
});

// The keeper keeps setting himself against the ball: at the shot he stands
// near the line bisecting the posts (before: ~1.1 m off on average).
test('the defending keeper is set near the bisector of the posts when the shot comes',()=>{
 // If this fails: keepers are caught standing off the angle when a shot comes, and shots beat them across goal.
 // Enough: five attackers run at goal from 18-23 m out (left, middle, right, wide) at a keeper who starts a metre and a
 // half off his line and off-centre, so every strike tests whether he re-set himself as the ball moved.
 // (Lane C, 2026-10-21: replaces seed 2057's 300 s match, re-pinned about sixteen times since 2026-10-03; the old match
 // read 0.30-1.00 m by seed, a pooled 0.60 m on the lab. Shots from a standing start, struck before he can move,
 // are not the question; these all come after a carry, so only each run's first shot counts: a rebound comes while he is
 // still getting up from the save.) The typical strike (the median) finds him within his own read spread of the angle
 // (KEEPER_SPREAD: he finds the angle with an error drawn from it); a keeper may plant up to SET_PLANT off his spot, which
 // is why single strikes are not judged. Mutation check: his ready spot moved 1 m sideways takes the median from 0.05 m
 // to 0.74 m; the old mean bar alone missed that (0.63 -> 0.87 m).
 const facing=(x,y)=>Math.atan2(-y,48-x),miss=[];
 for(const [x,y] of [[28,0],[27,-6],[29,7],[30,-10],[25,-2]]){
  const r=play(constructed([[3,0],[8,0],[14,-8],[14,8],[x,y,facing(x,y)],[46,1.5],[16,2],[14,-4],[10,6],[9,-3]]));
  const e=r.events.find(e=>e.kind==='shot'&&e.actor);if(!e)continue;
  const s=r.players.find(p=>p.id===e.actor).side,d=1-s,g=r.players.findIndex(p=>p.side===d&&p.role==='GK');
  const frame=r.frames.findLast(x=>x.time<=e.time-.02),from=frame.players[r.players.findIndex(p=>p.id===e.actor)],k=frame.players[g];
  const dd=q=>d===0?q.x:L-q.x,bx=dd(from),a=(Math.atan2(GH-from.y,-bx)+Math.atan2(-GH-from.y,-bx))/2;
  miss.push(Math.abs((dd(k)-bx)*Math.sin(a)-(k.y-from.y)*Math.cos(a)));
 }
 assert(miss.length>=3,`the runs at goal end in shots (${miss.length})`);
 const mean=miss.reduce((a,b)=>a+b,0)/miss.length,median=[...miss].sort((a,b)=>a-b)[Math.floor(miss.length/2)];
 assert(mean<.9,`mean lateral miss ${mean.toFixed(2)} m over ${miss.length} shots`);
 assert(median<=KEEPER_SPREAD,`median lateral miss ${median.toFixed(2)} m (his read spread ${KEEPER_SPREAD} m)`);
});
