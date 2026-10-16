import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
import {turnoverPrice,restDefence,lossDanger,LOSS_SCALE,commitBounds,commitmentMiss,isRest} from '../dist/practice-rest-defence.js';
import {X} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));
const plan=(players,owner,tactics,ticks=6,context={})=>{
 let result=null;
 for(let k=0;k<ticks;k++)result=coordinateFootball(players,{x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:owner.id},owner.side,tactics,laneRisk,{time:10+k*.25,recoveredAt:-10,...context},result);
 return result;
};
const oldPrice=depth=>Math.min(1,Math.max(0,(X(62)-depth)/X(62)))*.55;

// Change 1a: the passer's price of losing the ball depends on the rest
// defence behind it, and no longer vanishes past 28 m.
test('the loss price grows with the counter a loss would give and no longer vanishes past 28 m',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f),carrier=players[2];
 // Team 0 (1-2-1) attacks towards x = 48. Covered: three team-mates behind
 // the ball, the opponents' outfielders all ahead of it.
 place(players,[[4,0],[20,-3],[34,-6],[24,6],[26,0],[46,0],[40,-2],[38,-6],[39,4],[37,-3]]);
 const covered=turnoverPrice(carrier,players);
 // Exposed: the same carrier with his three team-mates ahead of the ball and
 // two opponents already free behind it.
 place(players,[[4,0],[37,-3],[34,-6],[38,6],[39,0],[46,0],[40,-2],[28,-6],[27,4],[37,3]]);
 const exposed=turnoverPrice(carrier,players),read=restDefence(carrier,players);
 assert.equal(read.rest,0);assert.equal(read.threats,2);
 assert(oldPrice(34)===0&&covered>0,`at 34 m the old price was 0; now ${covered.toFixed(3)}`);
 assert(exposed>covered*1.5,`three men ahead and two opponents free behind cost more (${exposed.toFixed(3)} vs ${covered.toFixed(3)})`);
 // In our own third it keeps the scale of the old positional price.
 for(const depth of [6,10]){const now=LOSS_SCALE*lossDanger(depth/48,0);assert(Math.abs(now/oldPrice(depth)-1)<.2,`own third at ${depth} m: ${now.toFixed(3)} vs ${oldPrice(depth).toFixed(3)}`);}
});

// Change 1b: "Bodies forward" decides the rest defence of an established attack
// (R1: a priced preference held by discipline, no longer a hard bound).
test('bodies forward sets how many stay behind the ball in an established attack',()=>{
 const rest=commit=>{
  const f=structuredClone(fixture);f.teams[0].tactics={...f.teams[0].tactics,commit};
  const players=practicePlayers(f),owner=players[2];
  place(players,[[4,0],[20,-3],[30,-8],[27,7],[33,0],[46,0],[40,-2],[36,-6],[37,4],[31,-3]]);
  const v=plan(players,owner,f.teams.map(t=>t.tactics));
  const aims=players.filter(p=>p.side===0&&p.role!=='GK'&&p.id!==owner.id).map(p=>v.jobs[p.id].aim);
  return {n:aims.filter(a=>isRest(0,owner,a)).length,miss:commitmentMiss(owner,commit,aims)};
 };
 // R1 (2026-10-01): a priced preference with less absolute ends
 // (test/r1-agency.test.mjs); the fixture's players are disciplined (0.8-0.95),
 // so here they keep the shape asked for.
 const one=rest(1),four=rest(4),five=rest(5);
 assert(one.n>=2,'1: at least two team-mates stay clearly behind the ball');
 assert(four.n<=2,'4: at least one joins the attack');
 assert(five.n<=1,'5: at most one stays behind');
 assert(one.n>five.n,'1 keeps more behind the ball than 5');
 // (recon 2026-10-16, finding 16) the caps above hold here for 3, 4 and 5 alike (one man behind in this scene), so
 // they cannot see 4 or 5 doing nothing; the direction itself: each step up keeps no more men behind than the one below
 const ns=[1,2,3,4,5].map(c=>c===1?one.n:c===4?four.n:c===5?five.n:rest(c).n);
 for(let i=1;i<ns.length;i++)assert(ns[i]<=ns[i-1],`behind the ball by Bodies forward 1-5: ${ns.join(' ')}`);
 assert(ns[0]>ns[1],'2 already sends one more forward than 1');
 for(const r of [one,four,five])assert.equal(r.miss,0);
 assert.deepEqual(commitBounds(3),{minRest:0,maxRest:3},'3 is unconstrained: the ordinary valuation decides, as before');
 // In the build-up (our own half) nothing is constrained.
 const f=structuredClone(fixture),players=practicePlayers(f);place(players,[[4,0],[10,-3],[20,-8],[12,7],[22,0],[46,0],[40,-2],[36,-6],[37,4],[31,-3]]);
 assert.equal(commitmentMiss(players[2],5,[{x:10,y:0},{x:12,y:0},{x:14,y:0}]),0);
});

// B0 flag: a centre-back's cutback that would leave one fewer behind the ball
// pays the marginal loss price (the same price the passer uses).
test('leaving the rest defence for a cutback is priced by the counter it would give',()=>{
 const d=40/48,leave=k=>LOSS_SCALE*(lossDanger(d,k+1)-lossDanger(d,k));
 assert(leave(0)>0,'one fewer behind the ball costs something');
 assert(leave(2)>leave(0),'more when the opponents already have men free behind it');
});

// Change 2: counter-press, carried by "On losing it". Team 1 (1-2-1) has
// just lost the ball high up (at 10 s) to team 0's left winger at (16, -6).
// Team 1's two wide players are within 8 m of the ball (2 v the carrier);
// its striker stands clearly goal-side of the ball and its centre-back deep:
// both are rest defence.
const {counterPressFires}=await import('../dist/practice-coordination.js');
const {PracticePlaybook}=await import('../dist/practice-playbook.js');
const afterLoss=(onLoss,{parity=false,escaped=false,order=null,sharp=false,at=null}={})=>{
 const f=structuredClone(fixture);f.teams[1].tactics={...f.teams[1].tactics,...(onLoss?{onLoss}:{})};
 // The counter-press is the call of the man who would go (R2): `sharp`
 // makes team 1 perfect, disciplined readers, so the team's rule shows exactly.
 if(sharp)for(const p of f.teams[1].squad){p.skills.reading=10;p.traits.discipline=1;}
 const players=practicePlayers(f);
 place(players,at??[[4,0],[10,5],[16,-6],[24,8],[28,-2],[46,0],[34,0],[19,-4],parity?[10,10]:[13,-8],[22,4]]);
 const owner=players[2],tactics=f.teams.map(t=>t.tactics);
 const book=order?new PracticePlaybook({side:1,plans:[{id:'policy',name:'Policy',weight:100,emphasis:1,instructions:[],preferred:null,lesson:{spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[]},standing:[order]}]},2026):null;
 let v=null;
 for(let k=0;k<4;k++){
  const time=10.05+k*.25;
  // Escaped: after two re-plans the carrier has run 13 m clear.
  if(escaped&&k===2)Object.assign(owner,{x:3,y:-6});
  const ball={x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:owner.id};
  v=coordinateFootball(players,ball,0,tactics,laneRisk,{time,recoveredAt:10,...(book?{responsibilities:preview=>book.persistent(time,players,ball,preview.attacking,tactics[1],preview,new Set(),null)}:{})},v);
 }
 const team=players.filter(p=>p.side===1&&p.role!=='GK'),job=p=>v.jobs[p.id];
 return {v,players,team,job,purposes:team.map(p=>job(p).purpose),cb:players[6],st:players[9],wide:[players[7],players[8]]};
};
test('On losing it: a counter-press sends the nearest at the ball and the next to screen, with local superiority',()=>{
 for(const onLoss of ['counterpress','balanced',undefined]){
  const s=afterLoss(onLoss,{sharp:true});
  assert.equal(s.v.counterPress.mode,'engage',`${onLoss??'missing'}: 2 v 1 near the ball fires it`);
  assert(s.purposes.includes('counter-press')&&s.purposes.includes('counter-screen'),`${onLoss??'missing'}: one presses, one screens (${s.purposes})`);
  const pressing=s.team.filter(p=>['counter-press','counter-screen'].includes(s.job(p).purpose));
  assert(pressing.every(p=>s.wide.includes(p)),'only the two near the ball, never the rest defence');
 }
});
// Press cover (2026-10-16): the counter-press goer is the defence's presser, so the man who chose to cover him covers
// him: goal-side behind him, a step inside, as in open play (before, he chose the cover and was sent to screen 8 m off).
test('a counter-press goer has a team-mate covering goal-side behind him',()=>{
 // Team 1's striker (22, -1) is free near the cover spot; the two wide players press and screen.
 const s=afterLoss('counterpress',{sharp:true,at:[[4,0],[10,5],[16,-6],[24,8],[28,-2],[46,0],[34,0],[19,-4],[13,-8],[22,-1]]});
 const goer=s.team.find(p=>s.job(p).purpose==='counter-press'),cover=s.team.find(p=>s.job(p).purpose==='cover');
 assert(goer&&cover,`a goer and a cover (${s.purposes})`);
 assert.equal(s.v.defense.presser,goer.id);assert.equal(s.v.defense.coverer,cover.id);
 const g={x:48,y:0},d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),pa=s.job(goer).aim,ca=s.job(cover).aim;
 assert(d(ca,g)<d(pa,g)-1.5,`goal-side of the goer (${d(ca,g).toFixed(1)} v ${d(pa,g).toFixed(1)} m from our goal)`);
 assert(d(ca,pa)<6,`close behind him (${d(ca,pa).toFixed(1)} m)`);
 assert.equal(s.job(cover).target,s.v.defense.owner,'covering the man on the ball');
});
test('On losing it: at parity only Counter-press goes; Regroup delays with the nearest and drops the rest',()=>{
 assert(counterPressFires('counterpress',1,1,false)&&!counterPressFires('balanced',1,1,false),'parity: counter-press only');
 assert(counterPressFires('balanced',1,1,true),'a touchline counts as one of ours');
 assert(!counterPressFires('regroup',3,1,false),'Regroup never counter-presses');
 const cp=afterLoss('counterpress',{parity:true,sharp:true}),bal=afterLoss('balanced',{parity:true,sharp:true});
 assert(cp.purposes.includes('counter-press'),`Counter-press goes at 1 v 1 (${cp.purposes})`);
 assert(!bal.purposes.some(p=>p.startsWith('counter-')),`Balanced does not (${bal.purposes})`);
 const rg=afterLoss('regroup');
 assert.equal(rg.v.counterPress.mode,'delay');
 assert(!rg.purposes.some(p=>p.startsWith('counter-')),'no counter-press');
 const presser=rg.team.find(p=>rg.job(p).purpose==='press');
 assert(presser&&rg.job(presser).kind==='jockey','the nearest delays, goal-side of the ball');
 // B4: the delayer keeps a cover behind him (delay and cover); everyone else
 // who is not yet goal-side of the ball drops behind it (b4-defending-near-goal).
 assert(rg.purposes.includes('cover'),'the delay is covered');
});
test('a counter-press ends for good once the ball escapes its zone',()=>{
 const s=afterLoss('counterpress',{escaped:true});
 assert(s.v.counterPress.over,'the ball left the zone');
 assert(!s.purposes.some(p=>p.startsWith('counter-')),`ordinary defending resumes (${s.purposes})`);
});
// Explicit instructions beat team-level logic: a standing mark order is kept
// through the counter-press window; the counter-press is made by the others.
test('a standing mark order survives a counter-press window',()=>{
 // Team 1's #3 (at 19, -4, nearest the ball) is told to mark team 0's #4 (24, 8).
 const s=afterLoss('counterpress',{order:{id:'mark',actor:3,kind:'mark',opponent:4,phase:'defending'}});
 const marker=s.players.find(p=>p.side===1&&p.number===3),target=s.players.find(p=>p.side===0&&p.number===4);
 assert.equal(s.job(marker).purpose,'playbook');assert.equal(s.job(marker).target,target.id,'the ordered defender keeps his man');
 assert(s.purposes.includes('counter-press'),`the other wide player still counter-presses (${s.purposes})`);
});

// Regain fixes (2026-10-11): the tackle ping-pong. A player whose ball was just taken in a tackle is off balance:
// he never commits a challenge of his own for BEATEN_BALANCE s (more for a weaker player). (His team-mates are
// untouched by the rule; how often they counter-press is measured, evidence/2026-10-11-regain-fixes.) (Duel recovery,
// 2026-10-16: how long now follows the duel, practice-balance; the least it can be is STEP, his foot put down again.)
test('a player who has just been tackled cannot go straight back in',async()=>{
 const {runMatch}=await import('../dist/index.js');
 const {STEP:BEATEN_BALANCE}=await import('../dist/practice-balance.js');
 // (track the runner, 2026-10-11: runs read from their start) 2026 now has 3 tackles won in its 240 s; 2027 is the next
 // seed with five or more, every one unanswered inside BEATEN_BALANCE (evidence/2026-10-11-track-runner/repin.mjs tackled)
 const f=structuredClone(fixture);f.seed=2027;
 const r=runMatch({fixture:f,durationSeconds:240}).result;
 const id=i=>r.players[i].id;
 const challenges=r.choices.filter(c=>c.kind==='challenge'&&c.challenge);
 const won=challenges.filter(c=>r.events.some(e=>e.kind==='tackle'&&e.actor===id(c.player)&&Math.abs(e.time-c.challenge.resolvesAt)<.05));
 assert(won.length>=5,`tackles won (${won.length})`);
 for(const c of won){
  const loser=c.challenge.opponent,t=c.challenge.resolvesAt;
  const again=challenges.find(x=>id(x.player)===loser&&x.time>t+1e-6&&x.time<t+BEATEN_BALANCE-1e-6);
  assert(!again,`${loser} tackled at ${t.toFixed(2)} s went in again at ${again?.time.toFixed(2)} s`);
 }
});
