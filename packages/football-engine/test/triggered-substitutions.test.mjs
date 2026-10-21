import test from 'node:test';
import assert from 'node:assert/strict';
import {withBench,subOrders} from './constructed-scenes.mjs';
import {runMatch,createSimulationRequest,validateSubstitutionOrders,createTrainingSetup,MAX_TRIGGERED_SUBSTITUTIONS} from '../dist/index.js';
import {triggerHolds,resolveOrder,halfTime} from '../dist/practice-substitutions.js';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {defaultPlans,PracticePlaybook} from '../dist/practice-playbook.js';

// The shared fixture has no bench: constructed-scenes withBench adds a keeper and two outfield players per side.
const STOPPAGES=['goal','out','foul','offside','half'];
const subs=r=>r.events.filter(e=>e.kind==='substitution');
// Every substitution is made during the stoppage its preceding event created.
function assertAtStoppage(r){
 for(const e of subs(r)){
  const i=r.events.indexOf(e);let j=i-1;while(r.events[j].kind==='substitution')j--;
  assert(STOPPAGES.includes(r.events[j].kind),`substitution follows ${r.events[j].kind}`);
  assert.equal(r.events[j].time,e.time,'made in the same tick as the stoppage');
  const frame=r.frames.find(f=>f.event>=i);
  assert(frame.restart,'the ball is dead while the player comes on');
 }
}
const COMPARED=['frames','events','choices','stats','score','players','controlContacts','playbookSelections','standingNotes','coachingNotes'];

test('orders are validated: bench only, once each, max three per side, keeper for keeper',()=>{
 const f=withBench();
 const ok={id:'a',side:0,in:'r10',trigger:{kind:'half'}};
 assert.equal(validateSubstitutionOrders([ok],f).length,1);
 assert.equal(MAX_TRIGGERED_SUBSTITUTIONS,3);
 f.teams[0].squad.push({...structuredClone(f.teams[0].squad[3]),id:'r30',name:'Rezerva trei'});
 const four=['r10','r20','r30','rgk0'].map((id,i)=>({id:`o${i}`,side:0,in:id,trigger:{kind:'half'}}));
 assert.throws(()=>validateSubstitutionOrders(four,f),/At most 3/);
 assert.equal(validateSubstitutionOrders([...four.slice(0,3),{id:'x',side:1,in:'r11',trigger:{kind:'half'}}],f).length,4,'the limit is per side');
 assert.throws(()=>validateSubstitutionOrders([{...ok,in:'van'}],f),/bench/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,in:'nobody'}],f),/squad/);
 assert.throws(()=>validateSubstitutionOrders([ok,{...ok,id:'b'}],f),/only once/);
 assert.throws(()=>validateSubstitutionOrders([ok,{...ok,in:'r20'}],f),/distinct id/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,in:'rgk0',out:'van'}],f),/Keepers/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,out:'mircea'}],f),/Keepers/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,out:'r20'}],f),/start or come on/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'tired',player:'van',threshold:90},out:'golusor'}],f),/tired player/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'tired',player:'van',threshold:0}}],f),/threshold/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'margin',atLeast:1.5,direction:'up'}}],f),/Margin/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'score',state:'ahead'}}],f),/Score/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'injured'}}],f),/Unknown/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,side:2}],f),/side/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,notBefore:-1}],f),/notBefore/);
 // A later order may take off a player whom an earlier order brought on.
 assert.equal(validateSubstitutionOrders([ok,{id:'b',side:0,in:'r20',out:'r10',trigger:{kind:'half'}}],f).length,2);
 // The tired player is the outgoing player by default.
 assert.equal(validateSubstitutionOrders([{...ok,trigger:{kind:'tired',player:'van',threshold:95}}],f)[0].out,'van');
 // API boundaries: matches only, not with coaching or the automatic 60/70/80 schedule.
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,substitutions:'planned',substitutionOrders:[ok]}),/planned or triggered/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,coaching:{kind:'repeat-one-two',side:0,carrier:3,partner:5,channelY:0,width:20,emphasis:.6},substitutionOrders:[ok]}),/coaching/);
 // Omitted and empty orders leave the frozen input unchanged.
 const plain=createSimulationRequest({kind:'match',fixture:f});
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,substitutionOrders:[]}),plain);
 assert(!('substitutionOrders' in plain.input));
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,substitutionOrders:[ok]}).input.substitutionOrders,[ok]);
});

test('each trigger kind reads score, margin, clock and energy as specified',()=>{
 const f=withBench(),players=practicePlayers(f);
 assert.equal(halfTime(900),450,'7:30 of a 15-minute match');assert.equal(halfTime(5400),2700);
 const h=(t,side,score,time=100,duration=900)=>triggerHolds(t,side,time,duration,score,players);
 assert(h({kind:'score',state:'losing'},0,[0,1])&&!h({kind:'score',state:'losing'},1,[0,1]));
 assert(h({kind:'score',state:'winning'},1,[0,1])&&!h({kind:'score',state:'winning'},0,[1,1]));
 assert(h({kind:'score',state:'drawing'},0,[2,2])&&!h({kind:'score',state:'drawing'},0,[2,1]));
 assert(h({kind:'margin',atLeast:2,direction:'up'},0,[3,1])&&!h({kind:'margin',atLeast:2,direction:'up'},0,[2,1]));
 assert(h({kind:'margin',atLeast:2,direction:'down'},1,[4,2])&&!h({kind:'margin',atLeast:2,direction:'down'},0,[4,2]));
 assert(!h({kind:'half'},0,[0,0],449.9)&&h({kind:'half'},0,[0,0],450));
 const van=players.find(p=>p.id==='0:van');van.energy=94;
 assert(h({kind:'tired',player:'van',threshold:95},0,[0,0])&&!h({kind:'tired',player:'van',threshold:94},0,[0,0]));
 assert(!h({kind:'tired',player:'r10',threshold:100},0,[0,0]),'a player who is not on the pitch is not tired');
 // Keeper-for-keeper also holds at run time when no outgoing player is named.
 const keeperIn=resolveOrder({id:'k',side:0,in:'rgk0',trigger:{kind:'half'}},f,players,new Set());
 assert.equal(keeperIn.outgoing.id,'0:mircea');
 const outfieldIn=resolveOrder({id:'o',side:0,in:'r10',trigger:{kind:'half'}},f,players,new Set());
 assert.equal(outfieldIn.outgoing.id,'0:van','the most tired outfield player');
 assert.match(resolveOrder({id:'g',side:0,in:'r10',out:'van',trigger:{kind:'half'}},f,players.filter(p=>p.id!=='0:van'),new Set(['0:van'])).impossible,/ieșit/);
 assert.match(resolveOrder({id:'w',side:0,in:'r20',out:'r10',trigger:{kind:'half'}},f,players,new Set()).wait,/nu este pe teren/,'waits for a substitute who has not come on yet');
});

// (Lane C, 2026-10-21) The rule every trigger obeys, read back from any run instead of from seeded passages (2028 for
// the tired order, 2032 for score, margin, half and chain, 2028 for slot plans, about ten re-pins between them): at each
// stoppage before full time, in list order, a waiting order is made exactly when its notBefore has passed, its trigger
// holds on the score, clock and energies of that moment, its side has room, and the change is possible; otherwise it
// keeps waiting or becomes impossible. Energies are read at the stoppage tick, as the engine reads them there: the frame
// of that tick for the men still on, and the energy the substitution recorded for a man taken off at it (the frame is
// drawn after the change). The frame is the end of the tick, so a tired trigger within 0.01 of its threshold there is
// not judged.
function checkOrders(r,fixture,orders,duration){
 const status=new Map(orders.map(o=>[o.id,'waiting'])),made=[0,0],gone=new Set(),score=[0,0];
 const subAt=new Map(subs(r).map(e=>[e.substitution.order,e]));
 r.events.forEach((e,i)=>{
  if(e.kind==='goal')score[e.side]++;
  if(!STOPPAGES.includes(e.kind)||e.time<=0||e.time>duration+1e-9)return;
  const tick=r.frames.findLast(f=>f.time<=e.time+1e-9);
  const on=tick.players.map((pose,k)=>({...r.players[tick.lineup?.[k]??k],energy:pose.energy}));
  for(const s of subs(r).filter(s=>s.time===e.time&&r.events.indexOf(s)>i))on[on.findIndex(p=>p.id===s.incoming)]={...r.players.find(p=>p.id===s.outgoing),energy:s.substitution.energy};
  const swap=sub=>{status.set(sub.substitution.order,'made');made[sub.side]++;gone.add(sub.outgoing);
   on[on.findIndex(p=>p.id===sub.outgoing)]={...r.players.find(p=>p.id===sub.incoming)};};
  for(const o of orders){
   if(status.get(o.id)!=='waiting'||(o.notBefore??0)>e.time)continue;
   const sub=subAt.get(o.id),here=!!sub&&sub.time===e.time&&r.events.indexOf(sub)>i;
   const tired=o.trigger.kind==='tired'&&on.find(p=>p.id===`${o.side}:${o.trigger.player}`);
   if(tired&&Math.abs(tired.energy-o.trigger.threshold)<.01){if(here)swap(sub);continue;}
   const holds=triggerHolds(o.trigger,o.side,e.time,duration,score,on);
   const decision=!holds?null:made[o.side]>=MAX_TRIGGERED_SUBSTITUTIONS?{impossible:true}:resolveOrder(o,fixture,on,gone);
   assert.equal(here,!!decision?.outgoing,`order ${o.id} at the ${e.kind} at ${e.time.toFixed(2)} s: trigger ${holds?'holds':'does not hold'}`);
   if(here){assert.equal(sub.outgoing,decision.outgoing.id,`order ${o.id} takes off the right man`);
    assert.deepEqual(sub.substitution.score,[score[o.side],score[1-o.side]],'the score it was made at');swap(sub);}
   else if(decision&&'impossible' in decision)status.set(o.id,'impossible');
  }
 });
 for(const [id,e] of subAt)assert.equal(status.get(id),'made',`order ${id} was made at a stoppage at ${e.time.toFixed(2)} s`);
 assert.deepEqual(r.substitutionNotes.map(n=>n.status),orders.map(o=>status.get(o.id)));
 return status;
}

// One set of orders covers every trigger kind (constructed-scenes subOrders); the 120 s runs below play it. Seed sweep
// on the lab (seeds 1-20, one 120 s match each): order t, van tired under 99.5, is made on 20 of 20, between 11 and 80 s.
const ORDERS=subOrders(99.5);
const RUN={fixture:withBench(13009),durationSeconds:120};
const played=runMatch({...RUN,substitutionOrders:ORDERS});

test('a tired trigger replaces that player at the next stoppage; the newcomer inherits slot and role',()=>{
 // If this fails: a tired player stays on past a stoppage his manager asked to take him off at, goes off before he
 // tired, or his replacement plays somewhere else. Enough: the rule check judges the order at every stoppage of the run.
 const r=played.result,status=checkOrders(r,RUN.fixture,ORDERS,120);
 assertAtStoppage(r);
 const e=subs(r).find(x=>x.substitution.order==='t');
 assert.equal(status.get('t'),'made','order t is made (van tires within the 120 s, and a stoppage follows)');assert(e);
 assert.equal(e.outgoing,'1:van');assert.equal(e.incoming,'1:r11');assert.equal(e.side,1);
 assert(e.substitution.energy<99.5,'the player was below the threshold when he went off');
 const incoming=r.players.find(p=>p.id==='1:r11'),outIndex=r.players.findIndex(p=>p.id==='1:van'),outgoing=r.players[outIndex];
 assert.equal(incoming.number,outgoing.number);assert.equal(incoming.role,outgoing.role);assert.equal(incoming.lane,outgoing.lane);
 assert.equal(incoming.energy,100,'comes on fresh');
 const last=r.frames.at(-1);assert(last.lineup.includes(r.players.indexOf(incoming))&&!last.lineup.includes(outIndex));
});

test('score, margin and half-time triggers fire at stoppages when true; three per side at most; no re-entry',()=>{
 // If this fails: a change the manager tied to the score, the margin or half-time comes when it should not, or never
 // comes when it should; or a player who went off comes back. Enough: every order is judged at every stoppage.
 const r=played.result;
 checkOrders(r,RUN.fixture,ORDERS,120);assertAtStoppage(r);
 const made=subs(r);
 for(const side of [0,1])assert(made.filter(e=>e.side===side).length<=3);
 const wentOff=new Set();
 for(const e of made){assert(!wentOff.has(e.incoming),'no re-entry');wentOff.add(e.outgoing);}
 const last=r.frames.at(-1);
 for(const id of wentOff)assert(!last.lineup.includes(r.players.findIndex(p=>p.id===id)),`${id} stays off`);
 assert.equal(new Set(last.lineup).size,10);
});

test('an order whose trigger never fires changes nothing; identical inputs reproduce exactly',()=>{
 const plain=runMatch(RUN).result;
 const idle=runMatch({...RUN,substitutionOrders:[{id:'never',side:0,in:'r10',trigger:{kind:'margin',atLeast:20,direction:'up'}},{id:'late',side:1,in:'r11',trigger:{kind:'half'},notBefore:5000}]}).result;
 for(const k of COMPARED)assert.deepEqual(idle[k],plain[k],k);
 assert.deepEqual(idle.substitutionNotes.map(n=>n.status),['waiting','waiting']);
 assert(!('substitutionNotes' in plain));
 // (Lane C: "exactly two substitutions" was this seed's count; the rule check is the property.)
 assert.deepEqual(runMatch({...RUN,substitutionOrders:structuredClone(ORDERS)}),played);
});

test('slot-addressed plans pass to the newcomer when he inherits the slot',()=>{
 // If this fails: after a change the manager's drawn moves still wait for the man who went off, and the newcomer in his
 // shirt number ignores them. Enough: every default plan gives #4 a job, so whichever is chosen must address the man
 // now wearing 4. The match path's own swap (same number, role and lane) is checked in the tired-trigger test above.
 // (Lane C, 2026-10-21: replaces seed 2028's 240 s match with two adaptive playbooks.)
 const f=withBench(),players=practicePlayers(f),setup=createTrainingSetup('middle');
 for(const pose of setup.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number),{x:pose.x,y:pose.y,angle:pose.angle});
 const van=players.find(p=>p.id==='0:van'),source=structuredClone(f.teams[0].squad.find(p=>p.id==='r10'));
 players[players.indexOf(van)]={...van,...source,id:'0:r10',side:0,number:van.number,role:van.role,lane:van.lane,energy:100};
 const owner=players.find(p=>p.side===0&&p.number===setup.ball.number),ball={x:setup.ball.x,y:setup.ball.y,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'};
 const book=new PracticePlaybook({side:0,adaptive:true,plans:defaultPlans()},2026);
 book.recover(10,owner,players,laneRisk,ball);
 assert(book.selections.some(s=>s.planId),'a plan is chosen');
 const moves=book.apply(10.5,players,ball,null,null)?.moves??[];
 assert(moves.some(m=>m.player==='0:r10'&&m.purpose==='playbook'),'the newcomer carries out the #4 job');
 assert(!moves.some(m=>m.player==='0:van'),'the departed player has none');
});
