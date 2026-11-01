import test from 'node:test';
import assert from 'node:assert/strict';
import {withBench} from './constructed-scenes.mjs';
import {runMatch,createSimulationRequest} from '../dist/index.js';
import {Injuries,INJURY_TREATMENT} from '../dist/practice-injuries.js';
import {PlayerStates,STATE_EFFECTS,INJURED_FORM} from '../dist/practice-states.js';
import {STEP} from '../dist/movement.js';

// Player match-states (practice-states.ts; contracts/ENGINE.md §10, evidence/2026-11-01-player-states). One state today:
// injured, playing on. As in injuries.test.mjs the test decides the injury dice itself (Injuries.prototype.fatigue,
// restored after the run), so the rule is checked, not a lucky seed.
const ON={on:true,salt:7};
const ID=[0,1,2,3,4,5,6,7,8,9];
const withDice=(patch,fn)=>{const saved=Object.fromEntries(Object.keys(patch).map(k=>[k,Injuries.prototype[k]]));Object.assign(Injuries.prototype,patch);try{return fn();}finally{Object.assign(Injuries.prototype,saved);}};
// injuries.test.mjs's cap scene: three "tired" orders made at the first stoppages, then flavius (side 0's centre-back, in
// no order) worn out at 60 s with a bench left but no change: he is treated and plays on
const capBench=seed=>{const f=withBench(seed),sq=f.teams[0].squad,cb=sq.find(p=>p.id==='flavius');
 sq.push({...structuredClone(sq[3]),id:'r30',name:'Rezerva trei 0'},{...structuredClone(cb),id:'rcb',name:'Fundaș rezervă 0',skills:{...cb.skills,reading:Math.min(10,cb.skills.reading+1)}});
 return f;};
const capOrders=()=>[['van','r10'],['golusor','r20'],['crocodinho','r30']].map(([out,inn],i)=>({id:`o${i}`,side:0,in:inn,trigger:{kind:'tired',player:out,threshold:99.99}}));
const playsOn=()=>withDice({fatigue(p,time){if(p.id==='0:flavius'&&time>=60&&!this.records.length)this.injure(p,'fatigue',time,false);}},
 ()=>runMatch({fixture:capBench(13009),durationSeconds:150,substitutionOrders:capOrders(),injuries:ON}).result);
const withEffect=(effect,fn)=>{const saved=STATE_EFFECTS.injured;STATE_EFFECTS.injured={...saved,...effect};try{return fn();}finally{STATE_EFFECTS.injured=saved;}};

test('injured, playing on: from the moment he gets up to full time, and only his legs and play change',()=>{
 // If this fails: the state no longer begins when a hurt man with no change left gets up, or it reaches the match
 // before he does, or it no longer makes him clearly slower.
 const r=playsOn();
 const [hurt]=r.injuries;assert.equal(hurt.playedOn,true,'the scene: he plays on');
 assert.equal(r.states?.length,1,'one state');
 const [st]=r.states,tr=r.events.find(e=>e.kind==='treatment'&&e.actor==='0:flavius');
 assert.deepEqual({player:st.player,side:st.side,id:st.id},{player:'0:flavius',side:0,id:'injured'});
 assert(!('until' in st),'until full time');
 assert(Math.abs(st.from-(tr.time+INJURY_TREATMENT-3))<=STEP+1e-9,`he is up 12 s into his treatment (${(st.from-tr.time).toFixed(2)} s)`);
 const marks=r.events.filter(e=>e.kind==='state');
 assert.equal(marks.length,1);assert.deepEqual(marks[0].state,{id:'injured',on:true});
 assert.equal(marks[0].actor,'0:flavius');assert.equal(marks[0].time,st.from);assert.equal(marks[0].side,0);
 // the same scene with the state's effect taken away: he plays on as he was (the match before player states)
 const neutral=withEffect({form:{top:1,acceleration:1,strike:1,reach:1},skills:{},habits:{}},playsOn);
 const before=x=>x.time<st.from-1e-9;
 assert.deepEqual(r.frames.filter(before),neutral.frames.filter(before),'nothing changes before he gets up');
 assert.deepEqual(r.events.filter(before),neutral.events.filter(before));
 assert.deepEqual(r.players,neutral.players,'the roster keeps his own skills and habits');
 // after it: his legs. Top speed at most INJURED_FORM.top of his own (energy and the sprint reserve allow ~6% over the
 // listed pace when fresh); without the state he runs clearly faster in the same minute and a half
 const pid=r.players.findIndex(p=>p.id==='0:flavius'),base=r.players[pid].basePace;
 const top=res=>Math.max(...res.frames.filter(f=>f.time>=st.from+.5).map(f=>{const q=f.players[(f.lineup??ID).indexOf(pid)];return Math.hypot(q.vx,q.vy);}));
 assert(top(r)<=base*INJURED_FORM.top*1.07,`hobbled: ${top(r).toFixed(2)} m/s against ${(base*INJURED_FORM.top).toFixed(2)}`);
 assert(top(neutral)>top(r)*1.3,`fit: ${top(neutral).toFixed(2)} m/s, hobbled ${top(r).toFixed(2)}`);
 assert.notDeepEqual(r.frames.filter(f=>!before(f)),neutral.frames.filter(f=>!before(f)),'from then on the match is another');
});

test('a league match never carries a state: without the injury key the book never exists',()=>{
 // If this fails: player states reach a match without the injury key (league parity), or a request can ask for one.
 const saved={tick:PlayerStates.prototype.tick,begin:PlayerStates.prototype.begin};
 PlayerStates.prototype.tick=()=>{throw Error('a state tick in a league match');};
 PlayerStates.prototype.begin=()=>{throw Error('a state begun in a league match');};
 try{
  // 600 s: a half-time, a "tired" order and the last attack all run
  const f=withBench(13011),r=runMatch({fixture:f,durationSeconds:600,substitutionOrders:[{id:'o0',side:0,in:'r10',trigger:{kind:'tired',player:'van',threshold:92}}]}).result;
  assert(!('states' in r));assert(!r.events.some(e=>e.kind==='state'||'state' in e));
  assert(r.events.some(e=>e.kind==='half')&&r.events.some(e=>e.kind==='substitution'),'the half-time and the order were played');
  assert(!('states' in createSimulationRequest({kind:'match',fixture:f,states:[{player:'0:van',id:'injured'}]}).input),'no input key asks for one');
 }finally{Object.assign(PlayerStates.prototype,saved);}
 // with the key on and nobody hurt the book ticks and never begins one
 const calm=withDice({roll:()=>false},()=>runMatch({fixture:withBench(13009),durationSeconds:120,injuries:ON}).result);
 assert(!('states' in calm));assert(!calm.events.some(e=>e.kind==='state'));
});
