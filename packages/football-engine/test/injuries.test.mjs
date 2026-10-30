import test from 'node:test';
import assert from 'node:assert/strict';
import {withBench} from './constructed-scenes.mjs';
import {runMatch,createSimulationRequest,createTrainingSetup,injuryReplacement} from '../dist/index.js';
import {Injuries} from '../dist/practice-injuries.js';

// Showcase injuries (practice-injuries.ts; deliverables/ballers-showcase/contracts/ENGINE.md). The rate constants are
// tuned on the public lab; these tests never depend on them: where a test needs someone hurt it decides the dice
// itself (Injuries.prototype.roll / fatigue, restored after the run), so the rules are checked, not a lucky seed.
const STOPPAGES=['goal','out','foul','offside','half'];
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
 const i=r.events.indexOf(e);let j=i-1;while(['substitution','injury'].includes(r.events[j].kind))j--;
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
 assert(poke.length>0&&knock.length>3*poke.length&&floored.length>2*knock.length,`ball only ${poke.length}, a 6 m/s knock ${knock.length}, floored ${floored.length}`);
 assert(floored.every(r=>Number.isInteger(r.matches)&&r.matches>=1&&r.matches<=6&&r.hard&&r.cause==='tackle'&&r.by==='1:b'));
 assert(poke.every(r=>!r.hard));
});
