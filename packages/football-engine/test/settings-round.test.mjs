// Settings round "make these settings matter" (2026-10-03): the intent of each
// changed option, in scenes. Evidence: evidence/2026-10-03-settings-build.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {teamApproaches} from '../dist/team-approach.js';
import {coordinateFootball,pivotAnchor,shoulderPost,RUN_GAP,RUN_PAST,RUN_ROOM,RUN_WIDTH,RUN_ALSO} from '../dist/practice-coordination.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0,angle:p.side?Math.PI:0}));
// Team 0 attacks towards x = 48. Its centre-back has the ball at (24,-3);
// team 1's deepest outfielder (#2) stands at x = 39.
const MID=[[3,0],[24,-3],[30,-10],[32,9],[31,2],[45,0],[39,1],[33,-5],[34,6],[26,2]];
const plan=(over,formation='1-2-1',at=MID,time=10,previous=null)=>{
 const f=structuredClone(fixture);f.teams[0].tactics.formation=formation;
 const players=practicePlayers(f);if(at)place(players,at);
 const owner=players[1],tactics=f.teams.map((t,i)=>({...t.tactics,...(i===0?{...teamApproaches.balanced.settings,formation,...over}:{})}));
 return {players,plan:coordinateFootball(players,{...owner,z:0,vz:0,mode:'control',owner:owner.id},0,tactics,laneRisk,{time,recoveredAt:0},previous)};
};

test('In behind: he waits on their last outfielder\'s shoulder or runs past him, never a short job',()=>{
 const {players,plan:p}=plan({striker:'run'}),lead=p.strikers[0].id,job=p.jobs[lead];
 const last=Math.max(...players.filter(q=>q.side===1&&q.role!=='GK').map(q=>q.x));
 assert.ok(['shoulder','depth'].includes(job.purpose),`his job is ${job.purpose}`);
 if(job.purpose==='shoulder')assert.ok(Math.abs(job.aim.x-(last-RUN_GAP))<.01,`on the shoulder: ${job.aim.x} vs ${last}`);
 else assert.ok(job.kind==='run'&&job.aim.x>last+RUN_PAST-.01,`the run goes past him: ${job.aim.x} vs ${last}`);
 assert.ok(Math.abs(job.aim.y)<=RUN_WIDTH+1.5+.01);
 // Mixed's forward runs to the generic depth point, ball + X(23): short of their line here.
 const mixed=plan({striker:'mixed'}).plan.jobs[lead];
 assert.ok(job.aim.x>mixed.aim.x,`In behind stands higher than Mixed (${job.aim.x} vs ${mixed.aim.x})`);
 for(const purpose of ['outlet','join','third-man','width','second-ball'])assert.equal(RUN_ALSO.has(purpose),false);
});

test('In behind: the run is offered past their line, in the channel off the nearest defender, and not when their line is already deep',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f);place(players,MID);
 const st=players[4],anchor=pivotAnchor(players,st,undefined,RUN_GAP);
 const s=shoulderPost(players,st,anchor,players[1]);
 assert.equal(s.last,39);assert.ok(Math.abs(s.post.x-(39-RUN_GAP))<1e-9);
 assert.ok(s.run&&Math.abs(s.run.x-(39+RUN_PAST))<1e-9,'run 3 m beyond the last outfielder');
 // the nearest back-line defender is #2 at y = 1, the striker at y = 2: the channel is off his right shoulder
 assert.ok(s.post.y>1,'the channel on the side away from him');
 // Their line on the edge of their box: no space behind, no run; he still holds the shoulder.
 const deep=MID.map(([x,y],i)=>i>=5&&i<=9&&i!==5?[Math.max(x,48-RUN_ROOM+1),y]:[x,y]);
 place(players,deep);
 const d=shoulderPost(players,st,pivotAnchor(players,st,undefined,RUN_GAP),players[1]);
 assert.equal(d.run,null);assert.ok(d.post.x<48-RUN_ROOM+1);
});

test('Pivot: while he shows, a ball into his feet is preferred among the passes, more under pressure, never over a better shot or carry',async()=>{
 const {approachOptions,PIVOT_PULL,PIVOT_PRESSED}=await import('../dist/team-approach.js');
 const f=structuredClone(fixture),players=practicePlayers(f);place(players,MID);
 const carrier=players[1],pivot=players[4],t={...f.teams[0].tactics,...teamApproaches.balanced.settings,formation:'1-2-1',striker:'pivot'};
 const options=[
  {kind:'pass',target:pivot.id,aim:{x:pivot.x,y:pivot.y},score:.40,pass:{risk:.1}},
  {kind:'pass',target:players[2].id,aim:{x:players[2].x,y:players[2].y},score:.50,pass:{risk:.1}},
  {kind:'carry',aim:{x:28,y:-3},score:.45},
 ];
 const pick=r=>Object.fromEntries(r.map(o=>[o.kind+(o.target??''),o.score]));
 // Mixed without a showing pivot: untouched (the very same array).
 assert.equal(approachOptions(carrier,options,t,players),options);
 const free=pick(approachOptions(carrier,options,t,players,pivot.id));
 assert.ok(Math.abs(free['pass'+pivot.id]-(.40+PIVOT_PULL))<1e-9,'unpressed: only the base pull');
 assert.equal(free['carry'],.45,'the carry is never touched');
 assert.equal(Math.max(free['pass'+pivot.id],free['pass'+players[2].id]),.50,'re-centred: the best delivery keeps its neutral value');
 // A defender on the carrier: the pull grows.
 const pressed=players.map(p=>({...p}));Object.assign(pressed[7],{x:carrier.x+.8,y:carrier.y});
 const under=pick(approachOptions(carrier,options,t,pressed,pivot.id));
 assert.ok(under['pass'+pivot.id]-under['pass'+players[2].id]>free['pass'+pivot.id]-free['pass'+players[2].id],'pressure raises the pull');
 assert.ok(under['pass'+pivot.id]-under['pass'+players[2].id]<=PIVOT_PULL+PIVOT_PRESSED-.1+1e-9);
});

test('Drops deep: a false nine holds a post between their lines, deeper than the pivot, and takes no box arrivals',async()=>{
 const {LINK_GAP,LINK_SHOW,LINK_ALSO}=await import('../dist/practice-coordination.js');
 const {players,plan:p}=plan({striker:'link'}),lead=p.strikers[0].id,job=p.jobs[lead];
 const last=Math.max(...players.filter(q=>q.side===1&&q.role!=='GK').map(q=>q.x));
 assert.equal(job.purpose,'link');
 assert.ok(job.aim.x<=last-LINK_GAP+.01&&job.aim.x>=last-LINK_GAP-LINK_SHOW-.01,`between the lines: ${job.aim.x.toFixed(2)} vs their last line ${last}`);
 const pivot=plan({striker:'pivot'}).plan.jobs[lead];
 assert.ok(job.aim.x<pivot.aim.x,'deeper than the pivot');
 for(const purpose of ['near-post','far-post','outlet','join'])assert.equal(LINK_ALSO.has(purpose),false,`no ${purpose} for the false nine`);
});

test('Free kick: the call sets the routine in their half (two in the box and one on the edge, or two short options and one in the box); Mixed keeps the formula',async()=>{
 const {freeKickCallAims,restartPositions}=await import('../dist/practice-restarts.js');
 const {freeKickOptions,FK_LEAN,FK_CONTEST,FK_PLAN_B}=await import('../dist/practice-set-pieces.js');
 const f=structuredClone(fixture),players=practicePlayers(f);place(players,MID);
 const spot={x:33,y:-6},taker=players[2].id,inBox=v=>v.x>48-8&&Math.abs(v.y)<8;
 assert.equal(freeKickCallAims(0,spot,taker,players,'mixed'),null);
 assert.equal(freeKickCallAims(0,{x:20,y:0},taker,players,'delivery'),null,'own half: no routine');
 const box=freeKickCallAims(0,spot,taker,players,'delivery'),short=freeKickCallAims(0,spot,taker,players,'short');
 assert.equal(Object.values(box.aims).filter(inBox).length,2,'Into the box: two in the box');
 assert.equal(Object.values(box.aims).filter(v=>!inBox(v)&&v.x>48-8-6).length,1,'and one on the edge');
 assert.equal(Object.values(short.aims).filter(inBox).length,1,'Short: one in the box');
 assert.equal(Object.values(short.aims).filter(v=>Math.hypot(v.x-spot.x,v.y-spot.y)<11).length,2,'and two short options');
 const mixed=restartPositions('freeKick',0,spot,taker,players,true),called=restartPositions('freeKick',0,spot,taker,players,true,'delivery');
 assert.deepEqual(restartPositions('freeKick',0,spot,taker,players,true,'mixed'),mixed,'Mixed: the formula, unchanged');
 assert.ok(players.filter(p=>p.side===0&&p.id!==taker&&p.role!=='GK').filter(p=>inBox(called[p.id])).length>=2,'the layout reaches the kick positions');
 // The taker leans FK_LEAN towards the called kind, accepts FK_CONTEST of its risk (settings-truth round), and
 // pays FK_PLAN_B for the other call's kind; Mixed is untouched.
 const options=[{kind:'pass',target:'a',aim:{x:spot.x-3,y:spot.y+3},score:.5,pass:{risk:.1}},{kind:'loft',target:'b',aim:{x:44,y:2},score:.5,loft:{risk:.6}}];
 const score=(call)=>Object.fromEntries(freeKickOptions(players[2],players,{kind:'indirect',spot},options,{setPiece:call}).map(o=>[o.target,o.score]));
 const m=score('mixed'),s=score('short'),d=score('delivery');
 assert.ok(Math.abs(s.a-m.a-(FK_LEAN+FK_CONTEST*.1))<1e-9&&Math.abs(s.b-m.b+FK_PLAN_B)<1e-9);
 assert.ok(Math.abs(d.b-m.b-(FK_LEAN+FK_CONTEST*.6))<1e-9&&Math.abs(d.a-m.a+FK_PLAN_B)<1e-9);
});

// Retired (2026-10-12): 'Width in 2-1-1: the midfielder leans to the ball's side when
// narrow and holds the far half-space when wide'. Width is no longer offered in 2-1-1
// (8aa2bbe9, from the width check on branch width-check, 234 matches): the app plays
// Standard there whatever is stored (lib/ballers/approach.ts playedApproach), so the
// engine never receives Narrow or Wide in 2-1-1 and the midfielder lean this test
// guarded is no longer a choice anyone can make. (It had also stopped reading true: on
// 9306734b and later, Wide's midfielder joins the other two on the same depth run in the
// test's scene, and in matches Standard and Wide never differed, even on live.)

