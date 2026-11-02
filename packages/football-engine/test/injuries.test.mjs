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

// The bench for the cap tests: withBench's three (rgk0, r10 as van, r20 as golusor), a third outfielder r30 (as van) and
// rcb (flavius's double, a little better: the injured centre-back's own replacement), so three orders and a forced change
// never want the same man.
const capBench=seed=>{const f=withBench(seed),sq=f.teams[0].squad,cb=sq.find(p=>p.id==='flavius');
 sq.push({...structuredClone(sq[3]),id:'r30',name:'Rezerva trei 0'},{...structuredClone(cb),id:'rcb',name:'Fundaș rezervă 0',skills:{...cb.skills,reading:Math.min(10,cb.skills.reading+1)}});
 return f;};
const capOrders=notBefore=>[['van','r10'],['golusor','r20'],['crocodinho','r30']].map(([out,inn],i)=>({id:`o${i}`,side:0,in:inn,trigger:{kind:'tired',player:out,threshold:99.99},...(notBefore?{notBefore}:{})}));
// the test's dice: flavius (side 0's centre-back, in no order) is worn out at `at` s
const hurtFlavius=at=>({fatigue(p,time){if(p.id==='0:flavius'&&time>=at&&!this.records.length)this.injure(p,'fatigue',time,false);}});

test('a forced change is one of the three changes: an order after it is refused at the cap',()=>{
 // Flavius is hurt at 5 s and goes off at the next stoppage for rcb (one change). The three "tired" orders wait for 60 s:
 // two are made, the third finds the side's three changes made (the owner, 1 Nov: the forced change is not exempt).
 const r=withDice(hurtFlavius(5),()=>runMatch({fixture:capBench(13009),durationSeconds:150,substitutionOrders:capOrders(60),injuries:ON}).result);
 assert.equal(r.injuries.length,1);
 const [hurt]=r.injuries,forced=subs(r,0).filter(e=>e.injury),ordered=subs(r,0).filter(e=>e.substitution);
 assert.equal(hurt.player,'0:flavius');assert.equal(hurt.cause,'fatigue');assert(hurt.matches>=1&&hurt.matches<=6);
 assert.equal(forced.length,1,'one forced change');
 const e=forced[0];
 assert.equal(e.outgoing,'0:flavius');assert.equal(e.incoming,'0:rcb');assert.equal(hurt.off,e.time);assert.equal(hurt.replacement,'0:rcb');assert(!('playedOn' in hurt));
 assert(e.time<60,`the forced change came first (${e.time.toFixed(1)} s)`);
 const incoming=r.players.find(p=>p.id==='0:rcb'),outgoing=r.players.find(p=>p.id==='0:flavius');
 assert.equal(incoming.role,outgoing.role);assert.equal(incoming.number,outgoing.number);
 // at a stoppage: the event before it (skipping changes and injury events) stopped play at that instant, ball dead
 const i=r.events.indexOf(e);let j=i-1;while(['substitution','injury','treatment'].includes(r.events[j].kind))j--;
 assert(STOPPAGES.includes(r.events[j].kind),`forced change follows ${r.events[j].kind}`);assert.equal(r.events[j].time,e.time);
 assert(r.frames.find(fr=>fr.event>=i).restart,'the ball is dead while he comes on');
 // the injury event: announced before his change, at its own second
 const ev=r.events.find(x=>x.kind==='injury'&&x.actor==='0:flavius');
 assert(ev&&r.events.indexOf(ev)<i&&ev.time===hurt.time&&ev.injury.matches===hurt.matches);
 // the orders: two made, the third refused at the cap
 assert.equal(ordered.length,2,'two orders made');assert.equal(subs(r,0).length,3,'three changes in all');
 const notes=r.substitutionNotes.filter(n=>n.side===0);
 assert.deepEqual(notes.map(n=>n.status),['made','made','impossible']);
 assert.equal(notes[2].detail,'Echipa a făcut deja toate schimbările.');
 assert(r.frames.at(-1).lineup.some(k=>r.players[k].id==='0:crocodinho'),'the third order\'s man stayed on');
});

test('no change left: the hurt man is treated and plays on',()=>{
 // The three orders are made at the first stoppages; flavius is hurt at 60 s with a bench left but no change: the referee
 // stops play, the medics treat him, nobody comes on, he gets up before the restart and finishes the match.
 const f=capBench(13009);
 const r=withDice(hurtFlavius(60),()=>runMatch({fixture:f,durationSeconds:150,substitutionOrders:capOrders(),injuries:ON}).result);
 const ordered=subs(r,0).filter(e=>e.substitution);
 assert.equal(ordered.length,3,'all three orders made');assert(ordered.every(e=>e.time<60),'before he was hurt');
 assert.equal(r.injuries.length,1);
 const [hurt]=r.injuries;
 assert.equal(hurt.playedOn,true,'no change left: he plays on');assert(!('off' in hurt)&&!('replacement' in hurt));
 assert.equal(subs(r,0).filter(e=>e.injury).length,0,'no forced change');assert.equal(subs(r,0).length,3);
 const tr=r.events.find(e=>e.kind==='treatment'&&e.actor==='0:flavius');
 assert(tr,'the medics treat him');assert(tr.time-hurt.time<=ADVANTAGE_MAX+.02,'at the injury stoppage');
 const kick=r.events.find(e=>e.time>tr.time&&e.restartKind);
 assert(kick.time>=tr.time+INJURY_TREATMENT-1e-9,'the treatment holds the restart');
 const pid=r.players.findIndex(p=>p.id==='0:flavius');
 const pose=fr=>fr.players[(fr.lineup??[0,1,2,3,4,5,6,7,8,9]).indexOf(pid)];
 assert(r.frames.filter(fr=>fr.time>=kick.time).every(fr=>pose(fr)?.duty!=='down'),'up before the restart');
 assert(r.frames.at(-1).lineup.some(k=>k===pid),'he finished the match');
 // planned substitutions (the old automatic changes at 60/70/80 min) count the same way: three forced changes take all
 // three, the fourth man hurt plays on
 const plan=[5,25,45,65];let k=0;
 const p=withDice({fatigue(q,time){if(q.side===0&&q.role!=='GK'&&!this.hurt.has(q.id)&&k<plan.length&&time>=plan[k]){k++;this.injure(q,'fatigue',time,false);}}},
  ()=>runMatch({fixture:capBench(13009),durationSeconds:120,substitutions:'planned',injuries:ON}).result);
 assert.equal(p.injuries.length,4);
 assert.equal(subs(p,0).filter(e=>e.injury).length,3,'three forced changes');
 assert.equal(p.injuries.filter(x=>x.playedOn).length,1,'the fourth plays on, a bench man left');
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

// (calibration, branch ballers-tiredness-calibration) The opt-in `scale` and `strength` keys. Absent, nothing is
// multiplied (the expressions are today's); given, every roll's risk is today's x scale, and a tackle incident's also x
// max(0, 1 - strength x (his strength - 6)); fatigue rolls never see strength. Checked roll by roll on the same
// football: the dice say no (nobody hurt), so every run is the same match and its rolls line up one for one.
test('scale and strength: validated, kept only when given; each roll\'s risk scaled, strength on tackles only',()=>{
 const f=withBench();
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:5}}).input.injuries,{on:true,salt:5});
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:5,scale:.3,strength:.15}}).input.injuries,{on:true,salt:5,scale:.3,strength:.15});
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:1,scale:-1}}),/scale/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:1,scale:'x'}}),/scale/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,injuries:{on:true,salt:1,strength:2}}),/strength/);
 const rolls=input=>{const out=[];const r=withDice({roll(cause,side,risk){out.push([cause,risk]);return false;}},()=>runMatch({...RUN,injuries:input}).result);return {out,r};};
 const base=rolls(ON),scaled=rolls({...ON,scale:.25}),strong=rolls({...ON,strength:.15}),both=rolls({...ON,scale:.25,strength:.15});
 assert(base.out.length>20&&base.out.some(([c])=>c==='tackle')&&base.out.some(([c])=>c==='fatigue'),'both causes rolled');
 for(const x of [scaled,strong,both]){assert.deepEqual(x.r,base.r,'nobody hurt: the same match');assert.equal(x.out.length,base.out.length);}
 base.out.forEach(([c,risk],i)=>{
  assert.equal(scaled.out[i][1],risk*.25,'x scale');
  if(c==='fatigue'){assert.equal(strong.out[i][1],risk,'fatigue: no strength');assert.equal(both.out[i][1],risk*.25);}
 });
 // strength: the tackle rolls' ratios are exactly the protection for the strengths in the match, centred on 6
 const ratios=new Set(base.out.flatMap(([c,risk],i)=>c==='tackle'&&risk>0?[Math.round(strong.out[i][1]/risk*1e9)/1e9]:[]));
 const allowed=new Set(base.r.players.map(p=>Math.round(Math.max(0,1-.15*(p.skills.strength-6))*1e9)/1e9));
 for(const k of ratios)assert(allowed.has(k),`tackle ratio ${k} is one man's protection`);
 // given as 1 / 0 they change nothing at all
 assert.deepEqual(runMatch({...RUN,injuries:{...ON,scale:1,strength:0}}).result,runMatch({...RUN,injuries:ON}).result);
});
