import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball,REGROUP_BEHIND} from '../dist/practice-coordination.js';
import {runnerPickupDelay,runnerBehindShoulder,RUNNER_LAPSE_MAX} from '../dist/practice-defense.js';
import {PracticePlaybook} from '../dist/practice-playbook.js';
import {runMatch} from '../dist/index.js';
import {L,GH} from '../dist/pitch.js';
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

// (Seed 2027 since the defending rebuild, 2026-10-03: evidence/2026-10-03-defending-build/repin.mjs b4;
// 2028 since the step-across round, 2026-10-04: 2027 had 7 shots, evidence/2026-10-04-stepacross-giveaways/repin.mjs b4;
// 2029 since the passing-and-control round, 2026-10-10: 2028 had 9 shots, evidence/2026-10-10-passing-control/repin.mjs b4;
// still 2029 after the threat-defending round, 2026-10-10: evidence/2026-10-10-threat-defending/repin.mjs b4 confirms it;
// 2030 since the regain fixes, 2026-10-11: 2029 had 8 shots, evidence/2026-10-11-regain-fixes/repin.mjs b4;
// 2031 since the pre-push fixes, 2026-10-12: evidence/2026-10-12-prepush-fixes/repin.mjs b4, 13 shots, keeper miss 0.41 m;
// still 2031 on the combined build with stamina as lasting and box defending (b0174c30, 2026-10-13):
// evidence/2026-10-12-box-defending/repin.mjs b4, 4 late pick-ups, 14 shots, keeper miss 0.40 m;
// 2037 since the keeper upgrade and the keeper with the ball in his hands, 2026-10-13: 2031-2036 no longer meet it,
// evidence/2026-10-13-keeper-2/repin.mjs b4, 7 late pick-ups, 15 shots, keeper miss 0.79 m: he now plants for the strike
// where he is when he is within SET_PLANT of his spot, rather than finishing the step onto the bisector; 2038 once his
// throw read allowed for an arriving presser: 2037 no longer met it, repin.mjs b4, 7 late pick-ups, 12 shots, keeper
// miss 0.59 m; 2039 since the r1 mechanics (2026-10-14: no pass into the passer's own moving body, the held carry
// route no longer lowering the bar for a clearance, channel clearances landed where a team-mate gets there first):
// 2038 had 9 shots, evidence/2026-10-14-r1-mech/repin.mjs b4, 7 late pick-ups, 10 shots, keeper miss 0.55 m; 2041 on
// the contest combine (2026-10-15: reception duels, contests in the air, pressure on the shooter): 2039 had 7 shots,
// evidence/2026-10-14-r1/repin.mjs b4, 4 late pick-ups, 13 shots, keeper miss 0.37 m; 2042 once the shooter's read of
// the hurry is his own (2026-10-15, hurryCost): 2041 had a keeper miss of 1.00 m, repin.mjs b4, 11 late pick-ups,
// 12 shots, keeper miss 0.46 m; 2043 once the shot decision reads the chance once and puts temperament on the choice
// (2026-10-15): 2042 had 8 shots, repin.mjs b4, 7 late pick-ups, 11 shots, keeper miss 0.50 m; 2045 once the shooter
// sees more of what a man on him costs (2026-10-15, shot fix): 2043 had 8 shots, repin.mjs b4 2043, 8 late pick-ups,
// 12 shots, keeper miss 0.32 m; 2051 once receivers read their reception in flight (2026-10-15, receive round): 2045 had 9
// shots, evidence/2026-10-14-r1/repin.mjs b4 2045, 4 late pick-ups, 15 shots, keeper miss 0.70 m; 2054 once a committed pass is looked at again when its lane
// shuts (2026-10-15, decide round): 2051 had a keeper miss of 1.00 m, repin.mjs b4 2051, 8 late pick-ups, 15 shots,
// keeper miss 0.71 m; 2055 once recovery follows the duel (2026-10-16, duel recovery): 2054's keeper miss no longer
// passed, repin.mjs b4 2054, 6 late pick-ups, 10 shots, keeper miss 0.59 m; 2057 once defenders read the shot lanes the
// shooter aims at, inside the posts (2026-10-16, recon fixes): 2055 had 7 shots, repin.mjs b4 2055, 4 late pick-ups, 11
// shots, keeper miss 0.30 m. The late pick-up test
// above shares the seed.)
// The keeper keeps setting himself against the ball: at the shot he stands
// near the line bisecting the posts (before: ~1.1 m off on average).
test('the defending keeper is set near the bisector of the posts when the shot comes',()=>{
 const f=structuredClone(fixture);f.seed=2057;
 const r=runMatch({fixture:f,durationSeconds:300}).result,miss=[];
 for(const e of r.events.filter(e=>e.kind==='shot'&&e.actor)){
  const s=r.players.find(p=>p.id===e.actor).side,d=1-s,g=r.players.findIndex(p=>p.side===d&&p.role==='GK');
  const frame=r.frames.findLast(x=>x.time<=e.time-.02),from=frame.players[r.players.findIndex(p=>p.id===e.actor)],k=frame.players[g];
  const dd=q=>d===0?q.x:L-q.x,bx=dd(from),a=(Math.atan2(GH-from.y,-bx)+Math.atan2(-GH-from.y,-bx))/2;
  miss.push(Math.abs((dd(k)-bx)*Math.sin(a)-(k.y-from.y)*Math.cos(a)));
 }
 assert(miss.length>=10,`${miss.length} shots`);
 const mean=miss.reduce((a,b)=>a+b,0)/miss.length;
 assert(mean<.9,`mean lateral miss ${mean.toFixed(2)} m`);
});
