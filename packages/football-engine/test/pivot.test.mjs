// Style-identity round, step 1 (2026-10-01): Striker "Pivot" (M4). The lead
// forward is anchored to the opponents' last defender, not to the ball; he
// shows towards the ball only when a pass to his feet is on, by his own
// read; passes into him are valued by the ordinary reads (no pivot bonus).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,practiceOptions,laneRisk} from '../dist/practice.js';
import {teamApproaches,validateApproach,approachOptions} from '../dist/team-approach.js';
import {coordinateFootball,pivotAnchor,pivotPoint,feetLaneRisk,PIVOT_GAP,PIVOT_WIDTH,PIVOT_GOAL,PIVOT_SHOW,PIVOT_ON} from '../dist/practice-coordination.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
// Team 0 attacks towards x = 48. Its centre-back has the ball at (24,-3);
// team 1's deepest outfielder (#2, sorin) stands at x = 39.
const MID=[[3,0],[24,-3],[30,-10],[32,9],[31,2],[45,0],[39,1],[33,-5],[34,6],[26,2]];
const plan=(striker,formation='1-2-1',at=MID,time=10,previous=null,players)=>{
 const f=structuredClone(fixture);f.teams[0].tactics.formation=formation;
 players??=practicePlayers(f);if(at)place(players,at);
 const owner=players[1],tactics=f.teams.map((t,i)=>({...t.tactics,...(i===0?{...teamApproaches.balanced.settings,formation,striker}:{})}));
 return {players,plan:coordinateFootball(players,{...owner,z:0,vz:0,mode:'control',owner:owner.id},0,tactics,laneRisk,{time,recoveredAt:0},previous)};
};

test('Pivot is a fourth Striker option, and Short plays width standard with a pivot',()=>{
 const base={progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,transition:'balanced'};
 for(const striker of ['mixed','link','pivot','run'])assert.equal(validateApproach({...base,striker}).striker,striker);
 assert.throws(()=>validateApproach({...base,striker:'false9'}));
 const short=teamApproaches.combinations.settings;
 assert.equal(short.striker,'pivot');assert.equal(short.width,'standard');
 assert.deepEqual({...short,width:undefined,striker:undefined},{progression:'patient',width:undefined,line:'high',press:'balanced',commit:3,striker:undefined,transition:'secure',onLoss:'counterpress'},'the rest of Short is unchanged');
});

test('the pivot anchors on the last defender, centrally, not on the ball',()=>{
 for(const formation of ['1-2-1','2-2']){
  const {players,plan:p}=plan('pivot',formation),lead=p.strikers[0].id,job=p.jobs[lead];
  assert.equal(job.purpose,'pivot',`${formation}: the lead forward (${lead}) takes the pivot's place`);
  const last=Math.max(...players.filter(q=>q.side===1&&q.role!=='GK').map(q=>q.x));
  // Holding: PIVOT_GAP in front of the last defender; showing: PIVOT_SHOW nearer the ball.
  assert.ok(job.aim.x<=last-PIVOT_GAP+.01&&job.aim.x>=last-PIVOT_GAP-PIVOT_SHOW-.01,`${formation}: aim ${job.aim.x.toFixed(2)} vs last line ${last}`);
  assert.ok(Math.abs(job.aim.y)<=PIVOT_WIDTH+PIVOT_SHOW,`${formation}: central (${job.aim.y.toFixed(2)})`);
  const mixed=plan('mixed',formation).plan.jobs[lead],link=plan('link',formation).plan.jobs[lead];
  assert.ok(job.aim.x>link.aim.x,`${formation}: the pivot stands higher than Drops deep's forward`);
  assert.notEqual(mixed.purpose,'pivot');
 }
 // Never inside PIVOT_GOAL of the goal line, however deep their last man is.
 const f=structuredClone(fixture),players=practicePlayers(f);
 place(players,[[3,0],[30,-3],[36,-10],[38,9],[40,2],[45,0],[46,1],[39,-5],[40,6],[33,2]]);
 assert.equal(pivotAnchor(players,players[4]).depth,48-PIVOT_GOAL);
});

test('on the last defender he holds his depth: a marker who follows him short does not drag the anchor',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f);
 // The pivot at 38 with his marker 0.8 m goal-side (the last defender).
 place(players,[[3,0],[24,-3],[30,-10],[32,9],[38,0],[45,0],[38.8,0],[33,-5],[34,6],[26,2]]);
 const first=pivotAnchor(players,players[4]);
 assert.ok(Math.abs(first.depth-(38.8-PIVOT_GAP))<1e-9,'fresh: one metre in front of the last defender');
 // He shows 2.5 m and his marker follows: the anchor stays where it was.
 players[4].x=35.3;players[6].x=36.1;
 assert.equal(pivotAnchor(players,players[4],first).depth,first.depth);
 // The last defender drops off him (more than PIVOT_CONTACT away): he follows the line.
 players[4].x=37.8;players[6].x=42;
 assert.ok(Math.abs(pivotAnchor(players,players[4],first).depth-(42-PIVOT_GAP))<1e-9);
 // The line steps up past him: he comes back in front of it (no runner in behind).
 players[4].x=38;players[6].x=34;players[7].x=33;
 assert.ok(Math.abs(pivotAnchor(players,players[4],first).depth-(34-PIVOT_GAP))<1e-9);
});

test('he shows towards the ball only when a pass to his feet is on, and the man behind him is not in that lane',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f);
 place(players,[[3,0],[24,-3],[30,-10],[32,9],[37.2,0],[45,0],[39,0],[33,-9],[34,9],[26,6]]);
 const pivot=players[4],anchor=pivotAnchor(players,pivot),focus=players[1];
 const open=pivotPoint(players,pivot,anchor,focus,true,laneRisk,10);
 assert.ok(open.show,'an open lane: he shows');
 const hold={x:anchor.depth,y:Math.max(-PIVOT_WIDTH,Math.min(PIVOT_WIDTH,focus.y*.3))};
 const moved=Math.hypot(open.aim.x-hold.x,open.aim.y-hold.y);
 assert.ok(Math.abs(moved-PIVOT_SHOW)<1e-6&&open.aim.x<hold.x,`2-3 m towards the ball (${moved.toFixed(2)} m)`);
 // Once he has shown, his marker (followed him, 0.8 m goal-side) would close
 // the lane for a plain lane read; he is first at the ball, so the marker
 // only contests the reception.
 const shown={...pivot,x:open.aim.x,y:open.aim.y},opponents=players.filter(q=>q.side===1).map(q=>q.id===players[6].id?{...q,x:open.aim.x+.8,y:open.aim.y}:q);
 const plain=laneRisk(focus,shown,opponents),feet=feetLaneRisk(focus,shown,shown,opponents,laneRisk);
 assert.ok(plain>=PIVOT_ON,`the plain lane read counts the marker behind him (${plain.toFixed(2)})`);
 assert.ok(feet<.05,`first at the reception, the marker only contests it (${feet.toFixed(2)})`);
 // A midfielder standing in the lane: the pass to feet is not on, so he holds.
 players[9].x=30;players[9].y=-1.5;
 const shut=pivotPoint(players,pivot,anchor,focus,true,laneRisk,10);
 assert.equal(shut.show,false);assert.ok(Math.abs(shut.aim.x-hold.x)<1e-6);
 // Nobody on the ball (a loose ball): he holds.
 players[9].x=26;players[9].y=6;
 assert.equal(pivotPoint(players,pivot,anchor,focus,false,laneRisk,10).show,false);
});

test('whether the pass is on is his own read: a great reader sees the lane as it is, a poor one misjudges it',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f);
 place(players,[[3,0],[24,-3],[30,-10],[32,9],[37.2,0],[45,0],[39,0],[33,-9],[34,9],[29,-1.3]]);
 const pivot=players[4],focus=players[1],anchor=pivotAnchor(players,pivot);
 const exact=feetLaneRisk(focus,pivotPoint(players,pivot,anchor,focus,true,laneRisk,10).aim,pivot,players.filter(q=>q.side===1),laneRisk);
 const reads=reading=>[0,3,6,9,12,15,18].map(time=>pivotPoint(players,{...pivot,skills:{...pivot.skills,reading,passing:reading}},anchor,focus,true,laneRisk,time).risk);
 const sharp=reads(10),poor=reads(2);
 assert.ok(exact>.05&&exact<.3,`a contested lane (${exact.toFixed(3)})`);
 assert.ok(sharp.every(r=>Math.abs(r-exact)<.02),`a top reader is close to exact (${exact.toFixed(3)}: ${sharp.map(r=>r.toFixed(3))})`);
 assert.ok(Math.max(...poor.map(r=>Math.abs(r-exact)))>Math.max(...sharp.map(r=>Math.abs(r-exact))),'a poor reader is further off');
});

test('he does not drop into the build-up or run in behind; the others keep their jobs',()=>{
 // Mid-block: Mixed's striker takes a depth run here (b0 scene); the pivot does not.
 const mixed=plan('mixed').plan,pivot=plan('pivot').plan,lead=pivot.strikers[0].id;
 assert.equal(mixed.jobs[lead].purpose,'depth');
 assert.equal(pivot.jobs[lead].purpose,'pivot');
 // Build-up deep in our half: still on the last line, not coming to the ball.
 const deep=plan('pivot','1-2-1',[[3,0],[12,-3],[20,-10],[22,9],[24,2],[45,0],[33,1],[23,-5],[25,6],[16,2]]).plan;
 assert.equal(deep.jobs[lead].purpose,'pivot');assert.ok(deep.jobs[lead].aim.x>28,`${deep.jobs[lead].aim.x}`);
});

test('a pass into a pivot with his marker behind him is valued by the ordinary reads: the marker contests, he does not cut it out',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f);
 place(players,[[3,0],[20,-3],[27,-12],[27,12],[34,0],[45,0],[34.8,0],[25,-6],[29,8],[23,2]]);
 const p=players[1],st=players[4];
 const toFeet=practiceOptions(p,players,new Set(),'',.5,null,50).filter(o=>o.target===st.id&&o.kind==='pass');
 assert.ok(toFeet.length&&toFeet.every(o=>o.pass.risk<.2),`risk ${toFeet.map(o=>o.pass.risk.toFixed(2))}`);
});

// Step 1b: the third man. A pivot is only a pivot with someone to lay it off to.
test('lay-off spots: 5-9 m from the pivot, on the ball side of him, off his shoulder',async()=>{
 const {thirdManSpots}=await import('../dist/practice-coordination.js');
 for(const side of [0,1]){const at={x:side?14:34,y:-1};
  for(const v of thirdManSpots(at,side)){const d=Math.hypot(v.x-at.x,v.y-at.y);
   assert.ok(d>=5-1e-9&&d<=9,`${d.toFixed(2)} m`);assert.ok(side?v.x>at.x:v.x<at.x,'ball side');assert.ok(Math.abs(v.y-at.y)>=3.5,'off his shoulder');}}
});
test('a man on the receiver\'s back contests a turn, not a quick ball played away from him',async()=>{
 const {releaseClosing,arrivalTime,QUICK_RELEASE}=await import('../dist/practice-defense.js');
 const f=structuredClone(fixture),players=practicePlayers(f);
 place(players,[[3,0],[20,-2],[27,-11],[27,10],[34,0],[45,0],[34.9,0],[28.5,-9],[29,9],[24,3]]);
 const from=players[1],aim={x:34,y:0},marker=players[6],others=players.filter(q=>q.side===1&&q.role!=='GK');
 const layoff={x:29,y:-5},past={x:40,y:-3};
 assert.ok(releaseClosing(others,aim,from,layoff,QUICK_RELEASE)>arrivalTime(marker,aim)+1,'a first-time lay-off away from him: he is not counted');
 assert.equal(releaseClosing(others,aim,from,layoff,QUICK_RELEASE+.3),Math.min(...others.map(d=>arrivalTime(d,aim))),'a slower release: he is');
 assert.equal(releaseClosing(others,aim,from,past,QUICK_RELEASE),Math.min(...others.map(d=>arrivalTime(d,aim))),'a ball played past him: he is');
});
test('through a marked pivot the lay-off to a third man is a real connection, valued by the ordinary read',async()=>{
 const {attackingSpaceReader}=await import('../dist/practice-attacking-space.js');
 const f=structuredClone(fixture),players=practicePlayers(f);
 // Carrier at (20,-2); their midfield screens at 28.5; the pivot shows at ~31.5 with his marker behind.
 place(players,[[3,0],[20,-2],[27,-11],[27,10],[34,0],[45,0],[35,.3],[28.5,-3.5],[28.5,3.5],[25,0]]);
 const t={...f.teams[0].tactics,...teamApproaches.combinations.settings},owner=players[1];
 const {plan:p}=plan('pivot','1-2-1',null,10,null,players);
 const pj=p.jobs[players[4].id];assert.equal(pj.purpose,'pivot');
 const attack=attackingSpaceReader(players,owner,t,laneRisk,players[4].id),pivot=attack.read(players[4],pj,10);
 const at=(k,aim)=>attack.read(players[k],{player:players[k].id,purpose:'third-man',kind:'support',aim,speed:players[k].pace*.76,since:10,until:12},10);
 assert.ok(attack.connection(pivot,at(2,{x:28,y:-6.3}))>0,'the lay-off off his shoulder');
 // The same pivot and a ball played on past his marker: the marker counts, and it is not on.
 assert.equal(attack.connection(pivot,at(3,{x:40,y:6})),0);
});
test('with a third man arriving the pivot lays it off; without one he has to try something else',()=>{
 const run=third=>{
  const f=structuredClone(fixture),players=practicePlayers(f);
  place(players,[[3,0],[18,3],third,[27,12],[34,0],[45,0],[34.9,0],[28,-9],[31,7],[24,2]]);
  // (step-across round: the lane is the passer's own read now; this pivot is a good reader, reading 8 and passing 7.
  // The fixture's pivot (reading 6, passing 4) misjudges the man near the lay-off and keeps it: that is his read, not the engine's.)
  const piv=players[4];piv.angle=Math.PI;piv.skills={...piv.skills,reading:8,passing:7};players[2].vx=2.5;
  const t={...f.teams[0].tactics,...teamApproaches.combinations.settings};
  return approachOptions(piv,practiceOptions(piv,players,new Set(),'',.3,null,50),t,players).sort((a,b)=>b.score-a.score);
 };
 const arriving=run([29,-5]);
 assert.equal(arriving[0].kind,'pass');assert.equal(arriving[0].target,'0:crocodinho');
 assert.ok(!run([22,-12]).some(o=>o.kind==='pass'&&o.target==='0:crocodinho'&&o.score>=arriving[0].score));
});
