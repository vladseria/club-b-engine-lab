// M2 and M3 (style identity, 2026-10-01): Press sets how far the block leans
// towards the ball, Selective has a real trap, and defenders read attackers
// off the ball a moment late (inside the perception layer).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball,trapTrigger,seesTrigger,TRAP_REST,TRAP_SETTLED} from '../dist/practice-coordination.js';
import {teamShape,PRESS_LEAN,markLean,MARK_LEAN_CAP} from '../dist/practice-shape.js';
import {sightLag,Sightings,inView,lookingAt,SIGHT} from '../dist/practice-perception.js';
import {markPosition} from '../dist/practice-football.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));
const ballAt=(owner)=>({x:owner.x,y:owner.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:owner.id});
const sharp=p=>Object.assign(p,{skills:{...p.skills,reading:10,defending:10},traits:{...p.traits,discipline:1,engagement:.55}});

// ---- M2: the lean -----------------------------------------------------------
test('press sets how far the block leans: about 0.35 / 0.5 / 0.7 m per metre of ball movement',()=>{
 const f=structuredClone(fixture),players=practicePlayers(f),owner=players[3];
 // Team 0 has the ball in midfield; team 1 defends (goal at x = 48).
 place(players,[[4,0],[16,-2],[22,-8],[22,0],[28,2],[46,0],[36,0],[32,-6],[32,6],[26,0]]);
 const per={};
 for(const press of ['selective','balanced','aggressive']){
  const tactics={...f.teams[1].tactics,press};
  const shift=y=>{owner.y=y;return teamShape(players,ballAt(owner),0,1,tactics,10).shift;};
  per[press]=(shift(8)-shift(0))/8;
  assert(Math.abs(per[press]-PRESS_LEAN[press].lean)<1e-9,`${press}: ${per[press]}`);
 }
 assert(per.selective<per.balanced&&per.balanced<per.aggressive);
 assert.equal(per.balanced,.5,'Balanced keeps the lean it had');
 // Aggressive also leans further before its cap: near the touchline it is
 // ~9 m across, Balanced stays at its old 6.2 m.
 const wide=press=>{owner.y=13.5;return teamShape(players,ballAt(owner),0,1,{...f.teams[1].tactics,press},10).shift;};
 assert(wide('aggressive')>9&&wide('balanced')<6.3&&wide('selective')<5,`${wide('aggressive')} / ${wide('balanced')} / ${wide('selective')}`);
 // The shape slots follow the lean: the far-side winger of a leaning block is
 // further from the far touchline than a Selective one.
 owner.y=11;
 const far=press=>teamShape(players,ballAt(owner),0,1,{...f.teams[1].tactics,press},10).slots['1:motanescu'].aim.y;
 assert(far('aggressive')>far('selective')+2,`far winger ${far('aggressive').toFixed(1)} vs ${far('selective').toFixed(1)}`);
});

test('the lean reaches the markers: Aggressive marks towards the ball side, Selective towards the middle, Balanced as before; tight near goal',()=>{
 const ball={x:24,y:10},man={x:24,y:-8};
 assert.equal(markLean('balanced',1,ball,man),0);
 assert(markLean('aggressive',1,ball,man)>2,'an aggressive marker of the far man slides towards the ball: the switch is on');
 assert(markLean('selective',1,ball,man)<-1.5,'a selective marker stays towards the middle, away from the ball side');
 assert(Math.abs(markLean('aggressive',1,{x:24,y:15},man))<=MARK_LEAN_CAP);
 // A man within 10 m of our goal (team 1 defends x = 48) is marked tight.
 assert.equal(markLean('aggressive',1,ball,{x:40,y:-3}),0);
});

// ---- M2: Selective's trap ---------------------------------------------------
const trapScene=(press='selective',carrierAt=[21,13.2],{time0=10,ticks=24,read=sharp,roles={}}={})=>{
 const f=structuredClone(fixture);f.teams[1].tactics={...f.teams[1].tactics,press};
 const players=practicePlayers(f),owner=players[3];players.filter(p=>p.side===1).forEach(read);
 for(const p of players)if(roles[p.id])p.role=roles[p.id];
 // Team 1: sorin deepest (rest defence), motanescu and van near the ball.
 place(players,[[4,0],[16,-2],[20,-8],carrierAt,[24,0],[46,0],[38,0],[29,9],[30,3],[21,4]]);
 const tactics=f.teams.map(t=>t.tactics);let plan=null;const log=[];
 for(let k=0;k<ticks;k++){
  const time=time0+k*.25;
  plan=coordinateFootball(players,ballAt(owner),0,tactics,laneRisk,{time,recoveredAt:-10},plan);
  log.push({time,trap:plan.trap,jobs:Object.fromEntries(Object.entries(plan.jobs).map(([id,j])=>[id,j.purpose])),off:Object.fromEntries(Object.entries(plan.jobs).map(([id,j])=>[id,Math.hypot(j.aim.x-owner.x,j.aim.y-owner.y)]))});
 }
 return {players,owner,log,plan};
};
test("Selective's trap springs on a trigger once the attack has settled: one man engages, the next closes the escape",()=>{
 const {log}=trapScene();
 const first=log.find(x=>x.trap&&!x.trap.over);
 assert(first,'a carrier at the touchline in midfield is a trigger');
 assert.equal(first.trap.trigger,'touchline');
 assert(first.time-log[0].time>=TRAP_SETTLED-1e-9,`not before the attack has settled (${first.time-log[0].time} s)`);
 const jobs=Object.entries(first.jobs);
 assert.equal(jobs.filter(([,p])=>p==='trap').length,1,'one man goes at the ball');
 assert.equal(jobs.filter(([,p])=>p==='trap-screen').length,1,'the next closes the escape pass');
 assert.notEqual(first.jobs['1:sorin'],'trap');assert.notEqual(first.jobs['1:sorin'],'trap-screen','the deepest man never joins');
 // Before it springs the Selective block waits: nobody presses in midfield.
 const before=log.filter(x=>x.time<first.time);
 // (Defending rebuild: the carrier's own defender is there, but holds off him, goal-side.)
 assert(before.every(x=>!Object.values(x.jobs).some(p=>p==='trap')&&Object.entries(x.jobs).every(([id,p])=>p!=='press'||x.off[id]>4)),'harmless circulation is not pressed');
});
test('the trap does not fire on every ball: not centrally, not deep in our third, not for other press settings, and it rests',()=>{
 // A central carrier facing our goal with no pass just played: no trigger.
 const central=trapScene('selective',[21,1]);
 const {players,owner}=central;owner.angle=0;
 assert(!central.log.some(x=>x.trap&&!x.trap.over),'no trap on a central carrier facing forward');
 assert.equal(trapTrigger(owner,1,20,10),null);
 // The carrier's back to our goal just after receiving is a trigger; later he has turned.
 owner.angle=Math.PI;
 assert.equal(trapTrigger(owner,1,10.2,10)?.trigger,'back');
 assert.equal(trapTrigger(owner,1,12,10),null);
 // Deep in our own third it is ordinary defending, not a trap; nor near our
 // box: the territory starts 22 m out (combined round).
 assert(!trapScene('selective',[40,13.2]).log.some(x=>x.trap&&!x.trap.over),'no trap at our own box');
 assert(!trapScene('selective',[27,13.2]).log.some(x=>x.trap&&!x.trap.over),'no trap 21 m from our goal');
 // Balanced and Aggressive never trap.
 for(const press of ['balanced','aggressive'])assert(!trapScene(press).log.some(x=>x.trap),`${press} has no trap`);
 // After a trap the block rests: the same trigger held for 12 s springs at
 // most twice, TRAP_REST apart.
 const long=trapScene('selective',[21,13.2],{ticks:60}).log;
 const springs=long.filter((x,i)=>x.trap&&!x.trap.over&&!(long[i-1]?.trap&&!long[i-1].trap.over&&long[i-1].trap.at===x.trap.at)).map(x=>x.time);
 assert(springs.length>=1&&springs.length<=2,`${springs.length} springs`);
 if(springs.length===2)assert(springs[1]-springs[0]>=TRAP_REST);
});
test('each engager reads the trigger himself: a poor reader can miss a faint one, the plan decides for a disciplined sharp one',()=>{
 // A faint trigger (just inside the touchline band): sharp disciplined readers
 // see it the same way every time; poor readers do not all agree.
 const faint=[21,10.9];
 const sharpLog=trapScene('selective',faint).log;
 const poor=p=>Object.assign(p,{skills:{...p.skills,reading:2,defending:2},traits:{...p.traits,discipline:1,engagement:.55}});
 const poorLog=trapScene('selective',faint,{read:poor}).log;
 const engaged=log=>log.filter(x=>x.trap&&!x.trap.over).map(x=>x.trap.engagers.length);
 assert.equal(engaged(sharpLog).length?engaged(sharpLog)[0]:0,0,'a faint trigger (strength < 0.5) is not a trap for a sharp reader');
 // Over many moments a poor reader sometimes sees a faint trigger (and misses clear ones).
 const f=structuredClone(fixture),players=practicePlayers(f),p=poor(players[7]);
 let seen=0,clear=0;
 for(let i=0;i<200;i++){const at={x:20+i%13,y:10+(i%7)*.3};
  const c=perceiveTrigger(p,.35,at,i*.7),d=perceiveTrigger(p,.9,at,i*.7);seen+=c;clear+=d;}
 assert(seen>0&&seen<200&&clear<200&&clear>seen,`faint ${seen}/200, clear ${clear}/200`);
});
test('a centre-back never goes alone: he may only close the escape after a non-centre-back engages',()=>{
 // Motanescu (nearest) plays centre-back: Fleasca goes, Motanescu screens.
 const one=trapScene('selective',[21,13.2],{roles:{'1:motanescu':'CB'}}).log.find(x=>x.trap&&!x.trap.over);
 assert(one,'the trap still springs');
 assert.equal(one.jobs['1:fleasca'],'trap','the non-centre-back goes');
 assert.equal(one.jobs['1:motanescu'],'trap-screen','the centre-back only closes the escape');
 assert.deepEqual(one.trap.engagers,['1:fleasca','1:motanescu']);
 // Only centre-backs near the ball: no trap.
 const none=trapScene('selective',[21,13.2],{roles:{'1:motanescu':'CB','1:fleasca':'CB'}}).log;
 assert(!none.some(x=>x.trap&&!x.trap.over),'no trap with only centre-backs to spring it');
});
const perceiveTrigger=(p,strength,at,time)=>seesTrigger(p,strength,at,time,'touchline')?1:0;

// ---- M3: defenders see the picture a moment late -----------------------------
const reader=(reading,{discipline=.83}={})=>({id:`1:r${reading}`,skills:{reading,defending:5},traits:{discipline}});
test('sight lag grows with poor reading, tired legs, a man out of view and a pass in the air',()=>{
 // Averaged over situations: each read also varies smoothly with where and when.
 const lag=(p,o={})=>{let s=0;for(let i=0;i<300;i++)s+=sightLag(p,{energy:100,inView:true,watching:0,at:{x:(i*3.7)%48,y:(i*2.3)%30-15},time:i*.9,salt:'x',...o});return s/300;};
 const top=reader(10),typical=reader(6),poor=reader(3);
 assert(lag(top)<lag(typical)&&lag(typical)<lag(poor),`${lag(top)} ${lag(typical)} ${lag(poor)}`);
 assert(lag(top)<.1&&lag(typical)>.12&&lag(typical)<.26,`top ${lag(top).toFixed(3)} typical ${lag(typical).toFixed(3)}`);
 assert(lag(typical,{energy:60})>lag(typical,{energy:95})+.08,'tired legs read later');
 assert(lag(typical,{inView:false})>lag(typical)+.2,'a man behind him is picked up late');
 assert(lag(typical,{watching:.7})>lag(typical)+.12,'while a pass is in the air his picture goes stale');
 for(let i=0;i<50;i++)assert(sightLag(poor,{energy:40,inView:false,watching:1,at:{x:i,y:0},time:i})<=SIGHT.cap+1e-12);
 // Field of view: standing, he looks at the ball; running, the way he runs.
 const d={x:20,y:0,vx:0,vy:0,angle:0};
 assert(inView(d,lookingAt(d,{x:10,y:0}),{x:14,y:2})&&!inView(d,lookingAt(d,{x:10,y:0}),{x:26,y:1}));
 const running={...d,vx:5,angle:0};
 assert(inView(running,lookingAt(running,{x:10,y:0}),{x:26,y:1}));
});
test('the memory returns what he saw a moment ago, interpolated',()=>{
 const s=new Sightings(1/20,1.2),q={id:'0:a',x:0,y:0,vx:4,vy:0};
 for(let t=0;t<=2+1e-9;t+=1/60){q.x=4*t;s.record(t,[q]);}
 const now={...q,x:8,vx:4};
 assert(Math.abs(s.at(now,2,.3).x-6.8)<.02,`${s.at(now,2,.3).x}`);
 assert.equal(s.at(now,2,0).x,8);
 assert(Math.abs(s.at(now,2,5).x-8+4*1.2)<.3,'older than the memory: the oldest picture');
 assert.equal(s.at({...now,id:'0:new'},2,.3).x,8,'nobody seen yet: read as he is');
});
test('pressing the ball is never delayed; a marker marks the man where he last saw him',()=>{
 // (box defending, 2026-10-12: with the ball within PROTECT_R of their goal team 1's markers now leave their men for
 // the shooting lane, by the Line; this check is about where a marker reads his man from, so team 1 plays a High
 // line, whose box protection starts nearer goal than this ball, 16 m out)
 const f=structuredClone(fixture);f.teams[1].tactics={...f.teams[1].tactics,line:'high'};
 const players=practicePlayers(f),owner=players[3];
 // Team 0 attacks x = 48; the ball near team 1's box so everyone is engaged.
 place(players,[[4,0],[20,-2],[30,-6],[33,6],[36,-1],[46,0],[40,0],[36,-5],[38,5],[34,4]]);
 const tactics=f.teams.map(t=>t.tactics);
 // Everyone off the ball "was" 3 m further back (towards x = 0) a moment ago.
 const stale=(r,q)=>({...q,x:q.x-3});
 const context={time:10,recoveredAt:-10};
 const exact=coordinateFootball(players,ballAt(owner),0,tactics,laneRisk,context,null);
 const late=coordinateFootball(players,ballAt(owner),0,tactics,laneRisk,{...context,sight:stale},null);
 const presser=exact.defense.presser;
 assert(presser&&late.defense.presser===presser,'the same man goes at the ball');
 // B2 (2026-10-09): a presser alone on the ball bends his run through the lane
 // to a free man (shadowAim), and that man is read from the presser's own
 // picture of him, a moment old like every off-ball man (M3). His run at the
 // ball is never delayed: same man, same kind of run, same pace, and only the
 // bend may differ, by a fraction of the lane point's pull.
 const a=late.jobs[presser],b=exact.jobs[presser];
 assert.equal(a.kind,b.kind);assert.equal(a.speed,b.speed);
 assert(Math.hypot(a.aim.x-b.aim.x,a.aim.y-b.aim.y)<.25,`the press is never delayed (${a.aim.x.toFixed(2)},${a.aim.y.toFixed(2)} v ${b.aim.x.toFixed(2)},${b.aim.y.toFixed(2)})`);
 // Defending round (2026-10-03): a marker's spot also sags towards the ball
 // line and the last man keeps his cushion, so the exact spot is no longer
 // markPosition alone; what holds is that it is read from where he last saw
 // his man: 3 m further back, his spot moves back with him.
 // (Who has whom is decided on that picture too, so the same man may have a
 // different marker: compare by man.)
 const byMan=v=>new Map(Object.values(v.jobs).filter(j=>j.purpose==='mark'&&j.target).map(j=>[j.target,j]));
 const was=byMan(exact),now=byMan(late);
 const close=[...now].filter(([t,j])=>was.has(t)&&Math.hypot(j.aim.x-stale(null,players.find(q=>q.id===t)).x,j.aim.y-players.find(q=>q.id===t).y)<4);
 assert(close.length,'someone marks');
 for(const [t,j] of close)assert(j.aim.x<was.get(t).aim.x-1,`${t} is marked where he was last seen (${j.aim.x.toFixed(2)} vs ${was.get(t).aim.x.toFixed(2)})`);
});
