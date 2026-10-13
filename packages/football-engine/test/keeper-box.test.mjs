import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMatch,practicePlayers} from '../dist/index.js';
import {keeperHandling} from '../dist/practice-keeper.js';
import {advanceFlight} from '../dist/practice-flight.js';
import {securePossessionOptions,strikeClearance,launchRisk} from '../dist/practice-possession.js';
import {carryOptions} from '../dist/practice-carry.js';
import {laneRisk} from '../dist/practice.js';
import {L,W,GH,BOX_HALF,BOX_DEPTH} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));

// Side 0 defends the goal at x = 0. A set keeper, facing the play, reacted in time.
const keeper=(over={})=>({side:0,x:.8,y:0,vx:0,vy:0,angle:0,pace:6,acceleration:4,skills:{reading:7,keeping:7},...over});
// A shot at `speed` m/s travelling straight down the pitch, met `lateral` metres from the keeper's centre.
const shotAt=(speed,lateral,z=.8)=>({x:1.3,y:lateral,z,vx:-speed,vy:0,vz:0,owner:null,mode:'shot'});
const contact=(lateral)=>({gap:Math.max(.3,Math.abs(lateral)),reach:1.8,shotAge:.45});
// Roll a parried ball on the live integrator until it stops or leaves the pitch.
function fate(ball){
 const b={...ball};
 for(let i=0;i<60*20;i++){
  const before={...b};advanceFlight(b);
  if(b.x<=0)return {out:'goal line',y:before.y+(b.y-before.y)*(before.x/(before.x-b.x)),z:b.z};
  if(Math.abs(b.y)>=W/2)return {out:'touchline',y:b.y};
  if(Math.hypot(b.vx,b.vy)<.05)return {out:null,x:b.x,y:b.y};
 }
 return {out:null,x:b.x,y:b.y};
}

test('a keeper holds a hard shot struck at his body, while pace still beats him at full stretch',()=>{
 const p=keeper(),held=v=>keeperHandling(p,shotAt(v,0),contact(0)).catchChance,stretched=v=>keeperHandling(p,shotAt(v,1.75),contact(1.75)).catchChance;
 assert.ok(held(26)>.5,`a 26 m/s shot at his body is more often held than parried (${held(26).toFixed(2)})`);
 assert.ok(held(26)>held(12)-.15,'at the body, pace costs him little');
 assert.ok(stretched(26)<stretched(12)-.3,'at full stretch, pace still decides whether he can hold it');
 assert.ok(stretched(26)<held(26)-.3,'a stretching save is much harder to hold than one at the body');
});

test('a ball the keeper cannot hold is never put back across his goal or out for a throw-in: tipped round the post or pushed wide to die by the goal line',()=>{
 const p=keeper();
 for(const lateral of [-1.2,-.4,0,.4,1.2]){
  const ball=shotAt(24,lateral),{parry}=keeperHandling(p,ball,contact(lateral));
  const end=fate({...ball,...parry,mode:'loose'});
  assert.notEqual(end.out,'touchline',`contact at y ${lateral}: pushed out for a throw-in`);
  if(end.out==='goal line')assert.ok(Math.abs(end.y)>GH,`contact at y ${lateral}: parried into his own goal`);
  else{
   assert.ok(Math.abs(end.y)>BOX_HALF,`contact at y ${lateral}: the push dies wide of the box, not in front of goal (y ${end.y.toFixed(2)})`);
   assert.ok(end.x<BOX_DEPTH/2,`contact at y ${lateral}: the push dies near his goal line (x ${end.x.toFixed(2)})`);
  }
  if(Math.abs(lateral)>.65)assert.equal(Math.sign(end.y),Math.sign(lateral),`contact at y ${lateral}: never across the face of his goal`);
 }
 // At full stretch he only gets fingertips to it: round the post for a corner.
 const ball=shotAt(24,1.75),{parry}=keeperHandling(p,ball,contact(1.75)),tip=fate({...ball,...parry,mode:'loose'});
 assert.equal(tip.out,'goal line','a fingertip save goes behind');assert.ok(Math.abs(tip.y)>GH,'outside the post');
});

test('a keeper pushes the ball to the side away from the attackers following in',()=>{
 const p=keeper(),ball=shotAt(24,0),attackers=[{x:4,y:6},{x:2.5,y:4},{x:6,y:9}];
 const {parry}=keeperHandling(p,ball,contact(0),attackers),end=fate({...ball,...parry,mode:'loose'});
 assert.ok(end.y<0,`attackers are on the left of his goal; the ball goes right (y ${end.y.toFixed(2)})`);
});

test('a keeper dives only at the opponents\' ball: a team-mate\'s back-pass or throw is received',()=>{
 // On 07ffe814 a third of keeper dives (58 of 151 in six 900 s matches) were at
 // a ball his own side had just played (evidence/2026-09-30-keeper-box).
 const r=runMatch({fixture,durationSeconds:300,policy:'coordinated'}).result;
 const releases=r.events.filter(e=>['pass','clearance','shot'].includes(e.kind)&&e.actor);
 const side=id=>r.players.find(p=>p.id===id).side;
 const dives=r.choices.filter(c=>r.players[c.player].role==='GK'&&c.kind==='dive'&&c.reason.startsWith('Împinge'));
 assert.ok(dives.length>0,'the passage includes keeper dives');
 for(const c of dives){
  const last=releases.findLast(e=>e.time<=c.time+1e-6);
  assert.notEqual(side(last.actor),r.players[c.player].side,`a keeper dived at ${c.time.toFixed(2)} s at a ball his own side played`);
 }
});

// A defender of side 0 on the ball in his own box, an attacker on top of him.
function boxScene(defender,attacker){
 const players=practicePlayers(fixture),poses=[[1,0],defender,[16,-8],[22,6],[26,-3],[46,0],attacker,[6,-5],[9,2],[20,0]];
 players.forEach((p,i)=>Object.assign(p,{x:poses[i][0],y:poses[i][1],vx:0,vy:0,angle:0}));
 return {players,p:players[1]};
}

test('a pressed defender in his own box can clear into play for a team-mate, and never across the face of his own goal',()=>{
 const {players,p}=boxScene([1.2,7],[2.2,7.6]),clears=securePossessionOptions(p,players,[],laneRisk).filter(o=>o.kind==='clear');
 assert.ok(clears.some(o=>o.clearance==='channel')&&clears.some(o=>o.clearance==='mate'),'up the touchline and to a team-mate further up are on offer');
 const goal={x:0,y:0},from=Math.hypot(p.x-goal.x,p.y-goal.y);
 for(const o of clears){
  const dx=o.aim.x-p.x,dy=o.aim.y-p.y,t=Math.max(0,Math.min(1,((goal.x-p.x)*dx+(goal.y-p.y)*dy)/(dx*dx+dy*dy)));
  const nearest=Math.hypot(p.x+dx*t-goal.x,p.y+dy*t-goal.y);
  assert.ok(nearest>=Math.min(4.5,from)-.25,`${o.clearance} clearance to (${o.aim.x.toFixed(1)}, ${o.aim.y.toFixed(1)}) passes ${nearest.toFixed(2)} m from his goal`);
 }
});

test('a lofted clearance is over a foot three metres out; a driven one is not',()=>{
 const {players,p}=boxScene([4,2],[7.2,2.3]),aim={x:30,y:2};
 assert.ok(launchRisk(p,aim,players,0,1.6)<launchRisk(p,aim,players,0,4),'the lofted strike clears the foot the driven one hits');
});

test('a clearance to a team-mate is paced to arrive there in play, not hoofed on out',()=>{
 const {p}=boxScene([4,2],[6,3]),ball={x:4.4,y:2},aim={x:28,y:9},steady=()=>.5;
 const run=v=>{const b={...ball,z:0,...v,owner:null,mode:'loose'};let landed=null;
  for(let i=0;i<600;i++){advanceFlight(b);if(landed===null&&b.z<=0)landed=Math.hypot(b.x-ball.x,b.y-ball.y);if(Math.hypot(b.x-ball.x,b.y-ball.y)>=Math.hypot(aim.x-ball.x,aim.y-ball.y))return {landed,speed:Math.hypot(b.vx,b.vy),inPlay:b.x<L&&Math.abs(b.y)<W/2};}
  return null;};
 const paced=run(strikeClearance(p,ball,aim,.5,steady,'mate')),hoof=run(strikeClearance(p,ball,aim,.5,steady,'long'));
 assert.ok(paced&&paced.inPlay,'it reaches its target inside the pitch');
 assert.ok(paced.landed<Math.hypot(aim.x-ball.x,aim.y-ball.y),'it comes down before the target and runs on to it');
 assert.ok(paced.speed<hoof.speed/2,`it arrives at a pace a team-mate can take (${paced.speed.toFixed(1)} vs ${hoof.speed.toFixed(1)} m/s)`);
});

test('a defender never carries the ball toward the mouth of his own goal',()=>{
 const {players,p}=boxScene([5,1],[8,1.5]);
 for(const o of carryOptions(p,players,0,laneRisk)){
  const intoMouth=o.aim.x<6&&Math.abs(o.aim.y)<6&&o.aim.x<p.x;
  assert.ok(!intoMouth,`a carry to (${o.aim.x.toFixed(1)}, ${o.aim.y.toFixed(1)}) heads for his own goal`);
 }
});
