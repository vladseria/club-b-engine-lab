import test from 'node:test';
import assert from 'node:assert/strict';
import {withBench} from './constructed-scenes.mjs';
import {runMatch,createSimulationRequest,createTrainingSetup,injuryReplacement} from '../dist/index.js';
import {Injuries,ADVANTAGE_MAX,INJURY_TREATMENT,DROP_DISTANCE} from '../dist/practice-injuries.js';

// Showcase injuries (practice-injuries.ts; deliverables/ballers-showcase/contracts/ENGINE.md). The rate constants are
// tuned on the public lab; these tests never depend on them: where a test needs someone hurt it decides the dice
// itself (Injuries.prototype.roll / fatigue, restored after the run), so the rules are checked, not a lucky seed.
// 'stoppage': the referee's, for the injury itself (31 Oct)
const STOPPAGES=['goal','out','foul','offside','half','stoppage'];
const subs=(r,side)=>r.events.filter(e=>e.kind==='substitution'&&(side===undefined||e.side===side));
const withDice=(patch,fn)=>{const saved=Object.fromEntries(Object.keys(patch).map(k=>[k,Injuries.prototype[k]]));Object.assign(Injuries.prototype,patch);try{return fn();}finally{Object.assign(Injuries.prototype,saved);}};
const RUN={fixture:withBench(13009),durationSeconds:120};
const ON={on:true,salt:7};

test('the key: validated, matches only, kept only when given',()=>{
 const f=withBench();
 const plain=createSimulationRequest({kind:'match',fixture:f});
 assert(!('injuries' in plain.input));
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:5,age:[{van:33},{}]}}).input.injuries,{on:true,salt:5,age:[{van:33},{}]});
 assert.throws(()=>createSimulationRequest({kind:'training',fixture:f,setup:createTrainingSetup('middle'),injuries:ON}),/matches/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:'yes',salt:1}}),/on must be/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:true}}),/salt/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:-1}}),/salt/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:1,age:[{nobody:30},{}]}}),/outside that squad/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:1,age:[{van:300},{}]}}),/years/);
});

test('off is nothing, and nobody hurt is the same football',()=>{
 // If this fails: a match without injuries is no longer the match it was (league parity), or the injury dice leak
 // into the match's own random streams.
 const base=runMatch(RUN).result;
 assert.deepEqual(runMatch({...RUN,injuries:{on:false,salt:7}}).result,base,'on: false plays the match without the key');
 const calm=withDice({roll:()=>false},()=>runMatch({...RUN,injuries:ON}).result);
 assert.deepEqual(calm.injuries,[]);
 const {injuries,...rest}=calm;
 assert.deepEqual(rest,base,'rolled but nobody hurt: every frame, event and choice is the one without injuries');
});

test('a hurt man goes off at the next stoppage, outside the three changes; with nobody left he plays on',()=>{
 // Three orders (tired under 99.99: made at the first stoppages), a fourth bench player, then the first two contacts
 // on side 0 after 40 s hurt the men they hit (whatever the hit: the dice are the test's): the first goes off for the
 // only bench player left (the keeper, playing outfield), the second plays on.
 const f=withBench(13009);f.teams[0].squad.push({...structuredClone(f.teams[0].squad[3]),id:'r30',name:'Rezerva trei 0'});
 const orders=[['van','r10'],['golusor','r20'],['crocodinho','r30']].map(([out,inn],i)=>({id:`o${i}`,side:0,in:inn,trigger:{kind:'tired',player:out,threshold:99.99}}));
 let n=0;
 const r=withDice({contact(p,b,by,time){if(p.side===0&&time>=40&&n<2&&!this.records.some(x=>x.player===p.id)){n++;this.injure(p,'tackle',time,b.down>0,by?.id);}}},
  ()=>runMatch({fixture:f,durationSeconds:150,substitutionOrders:orders,injuries:ON}).result);
 const ordered=subs(r,0).filter(e=>e.substitution),forced=subs(r,0).filter(e=>e.injury);
 assert.equal(ordered.length,3,'all three orders made');
 assert.equal(r.injuries.length,2,'two men hurt');
 const [first,second]=r.injuries;
 assert(first.time>=40&&first.cause==='tackle'&&first.by?.startsWith('1:'),'hurt in a tackle by an opponent');
 assert(first.matches>=1&&first.matches<=6);
 assert.equal(forced.length,1,'one forced change: a fourth substitution for side 0');
 const e=forced[0];
 assert.equal(e.outgoing,first.player);assert.equal(e.incoming,'0:rgk0','the keeper is the only one left: he comes on outfield');
 assert.equal(first.off,e.time);assert.equal(first.replacement,'0:rgk0');
 const incoming=r.players.find(p=>p.id==='0:rgk0'),outgoing=r.players.find(p=>p.id===first.player);
 assert.equal(incoming.role,outgoing.role);assert.notEqual(incoming.role,'GK');assert.equal(incoming.number,outgoing.number);
 // at a stoppage: the event before it (skipping changes and injury events) stopped play at that instant, ball dead
 const i=r.events.indexOf(e);let j=i-1;while(['substitution','injury','treatment'].includes(r.events[j].kind))j--;
 assert(STOPPAGES.includes(r.events[j].kind),`forced change follows ${r.events[j].kind}`);assert.equal(r.events[j].time,e.time);
 assert(r.frames.find(fr=>fr.event>=i).restart,'the ball is dead while he comes on');
 // the injury event: announced before his change, at its own second
 const ev=r.events.find(x=>x.kind==='injury'&&x.actor===first.player);
 assert(ev&&r.events.indexOf(ev)<i&&ev.time===first.time&&ev.target===first.by&&ev.injury.matches===first.matches);
 assert.equal(second.playedOn,true,'nobody left: he plays on');assert(!('off' in second));
 assert(r.frames.at(-1).lineup.some(k=>r.players[k].id===second.player),'he finished the match');
});

test('a hurt keeper is replaced by the bench keeper, in goal',()=>{
 const r=withDice({fatigue(p,time){if(p.side===1&&p.role==='GK'&&time>=10&&!this.records.length)this.injure(p,'fatigue',time,false);}},()=>runMatch({...RUN,injuries:ON}).result);
 assert.equal(r.injuries.length,1);
 const [k]=r.injuries;
 assert.equal(k.cause,'fatigue');assert.equal(k.hard,false);assert(!('by' in k));
 assert.equal(k.replacement,'1:rgk1');
 assert.equal(r.players.find(p=>p.id==='1:rgk1').role,'GK');
 assert.equal(subs(r,1).filter(e=>e.injury).length,1);
 // a keeper down: the referee stops at once, attack or not (or the ball was already dead)
 assert(k.off-k.time<=.02,`stopped at once (${(k.off-k.time).toFixed(2)} s)`);
});

test('who comes on: keeper for keeper, the role first, the keeper as the last outfield man, nobody left',()=>{
 const f=withBench(),team=f.teams[0],onPitch=team.lineup.map(id=>({id:`0:${id}`})),used=new Set(onPitch.map(p=>p.id));
 const gk=team.squad.find(p=>p.id==='rgk0');
 assert.equal(injuryReplacement(team,{side:0,role:'GK'},onPitch,used).id,'rgk0');
 // no keeper on the bench: the outfielder with the best keeping
 const noKeeper=new Set([...used,'0:rgk0']);
 const best=team.squad.filter(p=>!noKeeper.has(`0:${p.id}`)).sort((a,b)=>b.skills.keeping-a.skills.keeping)[0];
 assert.equal(injuryReplacement(team,{side:0,role:'GK'},onPitch,noKeeper).id,best.id);
 // an outfielder: a bench man whose first role is his
 const r1=team.squad.find(p=>p.id==='r10'),r2=team.squad.find(p=>p.id==='r20');
 assert.equal(injuryReplacement(team,{side:0,role:r2.roles[0]},onPitch,used).roles[0],r2.roles[0]);
 // outfield bench used up: the bench keeper
 assert.equal(injuryReplacement(team,{side:0,role:r1.roles[0]},onPitch,new Set([...used,'0:r10','0:r20'])).id,gk.id);
 assert.equal(injuryReplacement(team,{side:0,role:r1.roles[0]},onPitch,new Set([...used,'0:r10','0:r20','0:rgk0'])),null);
});

test('the dice: a fresh man runs no fatigue risk, a hit makes a challenge riskier, a man is hurt once, severity 1-6',()=>{
 const inj=new Injuries({on:true,salt:3},11);
 for(let i=0;i<500;i++)inj.fatigue({id:`0:f${i}`,side:0,energy:100},i);
 assert.equal(inj.records.length,0,'fatigue starts below full energy');
 for(let i=0;i<500;i++)inj.contact({id:'0:c',side:0,energy:40},{hit:9,down:1},{id:'1:b'},i);
 assert.equal(inj.records.filter(r=>r.player==='0:c').length,1,'hurt once, never again');
 const count=(b)=>{const x=new Injuries({on:true,salt:9},4);for(let i=0;i<4000;i++)x.contact({id:`0:${i}`,side:0,energy:80},b,{id:'1:b'},i);return x.records;};
 const poke=count({hit:0,down:0}),knock=count({hit:6,down:0}),floored=count({hit:6,down:1});
 const fouled=(()=>{const x=new Injuries({on:true,salt:9},4);for(let i=0;i<4000;i++)x.contact({id:`0:${i}`,side:0,energy:80},{hit:0,down:0},{id:'1:b'},i,true);return x.records;})();
 assert(poke.length>0&&knock.length>3*poke.length&&floored.length>knock.length&&fouled.length>3*poke.length,`ball only ${poke.length}, a 6 m/s knock ${knock.length}, floored ${floored.length}, a foul ${fouled.length}`);
 assert(fouled.every(r=>r.hard),'a foul is a hard tackle');
 assert(floored.every(r=>Number.isInteger(r.matches)&&r.matches>=1&&r.matches<=6&&r.hard&&r.cause==='tackle'&&r.by==='1:b'));
 assert(poke.every(r=>!r.hard));
});

test('nobody hurt changes nothing on the stoppage path either: half-time, orders, the whole match',()=>{
 // If this fails: the stoppage (practice.ts referee, the treatment's hold, the drop-ball taker) reaches a match nobody is
 // hurt in. 600 s: a half-time, a "tired" order and the last attack all run.
 const f=withBench(13011),run={fixture:f,durationSeconds:600,substitutionOrders:[{id:'o0',side:0,in:'r10',trigger:{kind:'tired',player:'van',threshold:92}}]};
 const base=runMatch(run).result;
 const calm=withDice({roll:()=>false},()=>runMatch({...run,injuries:ON}).result);
 const {injuries,...rest}=calm;
 assert.deepEqual(injuries,[]);assert.deepEqual(rest,base,'every frame, event and choice is the match without the key');
 assert(base.events.some(e=>e.kind==='half')&&base.events.some(e=>e.kind==='substitution'),'the half-time and the order were played');
});

test('the stoppage: he goes down, the referee stops play, the medics, the change, a dropped ball',()=>{
 // Four men hurt (the test's dice, outfielders, by fatigue): each lies where he fell, and the referee stops play at once
 // or after an attack (at most ADVANTAGE_MAX s), unless the ball went dead first. Then the treatment and the forced change
 // at the stoppage, a dead ball of at least INJURY_TREATMENT s, and the dropped ball (Law 8): for the defending keeper in
 // his area, otherwise an outfielder who did not just come on; everyone else at least DROP_DISTANCE m away.
 const plan=[[12,0],[36,1],[60,0],[84,1]];let k=0;
 const r=withDice({fatigue(p,time){const q=plan[k];if(q&&time>=q[0]&&p.side===q[1]&&p.role!=='GK'){k++;this.injure(p,'fatigue',time,false);}}},
  ()=>runMatch({fixture:withBench(13009),durationSeconds:120,injuries:ON}).result);
 assert.equal(r.injuries.length,4);
 let drops=0;
 for(const inj of r.injuries){
  const pid=r.players.findIndex(p=>p.id===inj.player),pos=f=>(f.lineup??[0,1,2,3,4,5,6,7,8,9]).indexOf(pid);
  assert(inj.off!==undefined,'he went off');
  const live=r.frames.filter(f=>f.time>inj.time+.05&&f.time<inj.off-1e-9),poses=live.map(f=>f.players[pos(f)]);
  assert(poses.every(q=>q.duty==='down'),'down from the injury to the stoppage');
  // he goes down with his speed mostly gone (a short slide), then lies still
  const lying=live.filter(f=>f.time>=inj.time+.4).map(f=>f.players[pos(f)]);
  if(lying.length)assert(Math.hypot(lying.at(-1).x-lying[0].x,lying.at(-1).y-lying[0].y)<.05,'he stays where he fell');
  if(poses.length)assert(Math.hypot(poses.at(-1).x-poses[0].x,poses.at(-1).y-poses[0].y)<.6,'a short slide at most');
  const at=r.events.filter(e=>Math.abs(e.time-inj.off)<1e-9),kinds=at.map(e=>e.kind);
  const t=at.find(e=>e.kind==='treatment'&&e.actor===inj.player),c=at.find(e=>e.kind==='substitution'&&e.outgoing===inj.player);
  assert(t&&c&&kinds.indexOf('treatment')<kinds.indexOf('substitution'),'the medics, then the change, at the stoppage');
  assert.equal(c.incoming,inj.replacement);assert.deepEqual(c.injury,{cause:'fatigue',matches:inj.matches});
  const kick=r.events.find(e=>e.time>inj.off&&e.restartKind);
  assert(kick.time>=inj.off+INJURY_TREATMENT-1e-9,`the dead ball lasts the treatment (${(kick.time-inj.off).toFixed(2)} s)`);
  if(!kinds.includes('stoppage')){assert.notEqual(kick.restartKind,'dropBall','a dead ball of its own restarts as it would');continue;}
  drops++;
  assert(inj.off-inj.time<=ADVANTAGE_MAX+.02,`the referee stops within ${ADVANTAGE_MAX} s (${(inj.off-inj.time).toFixed(2)})`);
  assert.equal(kick.restartKind,'dropBall');
  assert(r.frames.filter(f=>f.time>=inj.off&&f.time<kick.time).every(f=>f.restart&&f.restartInfo.kind==='dropBall'),'dead until the drop');
  const before=r.frames.filter(f=>f.time<inj.off).at(-1),spot=kick.restartSpot;
  assert(Math.hypot(before.ball.x-spot.x,before.ball.y-spot.y)<1,'dropped where the ball was when play stopped');
  const taker=r.players.find(p=>p.id===kick.actor),area=Math.abs(spot.y)<8?spot.x<8?0:spot.x>40?1:null:null;
  if(area!==null)assert(taker.role==='GK'&&taker.side===area,'in a penalty area: the defending keeper');
  else assert(taker.role!=='GK'&&kick.actor!==inj.replacement,'elsewhere: an outfielder who did not just come on');
  for(const q of kick.restartPlayers)if(q.id!==kick.actor)assert(Math.hypot(q.x-spot.x,q.y-spot.y)>=DROP_DISTANCE,`${q.id} at Law 8's distance`);
  const line=r.events.find(e=>e.kind==='restart'&&e.time>inj.off);assert(line.text.startsWith('Minge de arbitru'));
 }
 assert(drops>=1,'at least one dropped ball');
});
