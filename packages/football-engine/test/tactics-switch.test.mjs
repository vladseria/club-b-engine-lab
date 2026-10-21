import test from 'node:test';
import assert from 'node:assert/strict';
import {withBench} from './constructed-scenes.mjs';
import {runMatch,createSimulationRequest,validateTacticsSwitches,MAX_TACTICS_SWITCHES} from '../dist/index.js';
import {applyTacticsSwitch,slotsPlaceable} from '../dist/practice-switch.js';
import {practicePlayers} from '../dist/practice.js';
import {shapes} from '../dist/model.js';

// The in-match plan switch (deliverables/ballers-plan-switch/DESIGN.md): one per side, at a stoppage, tactics only.
const STOPPAGES=['goal','out','foul','offside','half'];
const COMPARED=['frames','events','choices','stats','score','players','controlContacts','playbookSelections','standingNotes','coachingNotes','substitutionNotes'];
const RUN={fixture:withBench(13009),durationSeconds:120};
const plain=runMatch(RUN).result;
const own=side=>RUN.fixture.teams[side].tactics;
const sw=(over={})=>({id:'b',side:0,trigger:{kind:'score',state:'drawing'},tactics:{...own(0)},...over});
const DIRECT={progression:'direct',width:'wide',line:'high',press:'aggressive',commit:5,striker:'run'};
const switches=r=>r.events.filter(e=>e.kind==='switch');
const at=(r,t)=>({events:r.events.filter(e=>e.time<t&&e.kind!=='switch'),frames:r.frames.filter(f=>f.time<t)});

test('a switch is validated: one per side, a trigger that is not a player, real tactics, a slot for every man in a new formation',()=>{
 const f=withBench();
 assert.equal(MAX_TACTICS_SWITCHES,1);
 assert.equal(validateTacticsSwitches([sw()],f).length,1);
 assert.equal(validateTacticsSwitches([sw(),sw({id:'c',side:1,tactics:{...f.teams[1].tactics}})],f).length,2,'one for each side');
 assert.throws(()=>validateTacticsSwitches([sw(),sw({id:'c'})],f),/At most 1/);
 assert.throws(()=>validateTacticsSwitches([sw(),sw()],f),/distinct id/);
 assert.throws(()=>validateTacticsSwitches([sw({trigger:{kind:'tired',player:'van',threshold:80}})],f),/Unknown/);
 assert.throws(()=>validateTacticsSwitches([sw({trigger:{kind:'margin',atLeast:0,direction:'down'}})],f),/Margin/);
 assert.throws(()=>validateTacticsSwitches([sw({notBefore:-1})],f),/notBefore/);
 const two={...own(0),formation:'2-2'};
 assert.throws(()=>validateTacticsSwitches([sw({tactics:two})],f),/slot for every man/);
 assert.throws(()=>validateTacticsSwitches([sw({tactics:two,slots:[1,0,2,3,4]})],f),/keeper staying/);
 assert.throws(()=>validateTacticsSwitches([sw({tactics:two,slots:[0,1,1,3,4]})],f),/distinct/);
 assert.throws(()=>validateTacticsSwitches([sw({tactics:{...own(0),formation:'4-3-3'},slots:[0,1,2,3,4]})],f),/five-a-side/);
 // the same formation: a map that moves nobody is dropped; one that moves men is kept (owner, 21 Oct: the slot rule in every switch)
 assert(!('slots' in validateTacticsSwitches([sw({slots:[0,1,2,3,4]})],f)[0]));
 assert.deepEqual(validateTacticsSwitches([sw({slots:[0,1,3,2,4]})],f)[0].slots,[0,1,3,2,4]);
 assert.throws(()=>validateTacticsSwitches([sw({slots:[1,0,2,3,4]})],f),/keeper staying/);
 assert.deepEqual(validateTacticsSwitches([sw({tactics:two,slots:[0,1,3,4,2]})],f)[0].slots,[0,1,3,4,2]);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,playbooks:[{side:1,plans:[]}],tacticsSwitches:[sw({tactics:two,slots:[0,1,3,4,2]})]}),/slot-addressed/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,substitutions:'planned',tacticsSwitches:[sw()]}),/planned/);
 assert.throws(()=>validateTacticsSwitches([sw({tactics:{...own(0),line:'higher'}})],f),/line/);
 assert.throws(()=>validateTacticsSwitches([sw({tactics:{...own(0),commit:9}})],f),/commit/);
 assert.throws(()=>validateTacticsSwitches([sw({tactics:{...own(0),taker:'nobody'}})],f),/taker/);
 assert.throws(()=>validateTacticsSwitches([sw({keepers:{van:.9}})],f),/keepers only/);
 assert.throws(()=>validateTacticsSwitches([sw({keepers:{mircea:2}})],f),/between 0 and 1/);
 assert.equal(validateTacticsSwitches([sw({keepers:{mircea:.9,rgk0:null}})],f)[0].keepers.rgk0,null);
 assert.throws(()=>createSimulationRequest({kind:'training',fixture:f,setup:{}, tacticsSwitches:[sw()]}));
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,coaching:{kind:'repeat-one-two',side:0,carrier:3,partner:5,channelY:0,width:20,emphasis:.6},tacticsSwitches:[sw()]}),/coaching/);
 // Omitted and empty switches leave the frozen input unchanged.
 const request=createSimulationRequest({kind:'match',fixture:f});
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,tacticsSwitches:[]}),request);
 assert(!('tacticsSwitches' in request.input));
});

test('a switch whose trigger never holds changes nothing',()=>{
 const idle=runMatch({...RUN,tacticsSwitches:[sw({trigger:{kind:'margin',atLeast:20,direction:'up'},tactics:{...own(0),...DIRECT}}),sw({id:'late',side:1,tactics:{...own(1),...DIRECT},notBefore:5000})]}).result;
 for(const k of COMPARED)assert.deepEqual(idle[k],plain[k],k);
 assert.deepEqual(idle.switchNotes.map(n=>n.status),['waiting','waiting']);
 assert(!('switchNotes' in plain));
});

test('a switch to the same tactics plays the same match: the swap itself moves nothing',()=>{
 // If this fails: carrying out a switch disturbs play (a reset, a draw, a cleared plan) beyond the tactics it sets.
 const same=runMatch({...RUN,tacticsSwitches:[sw({tactics:{...own(0)}})]}).result,[e]=switches(same);
 assert(e,'level at the first stoppage: the switch is made');
 for(const k of ['choices','stats','score','players','controlContacts'])assert.deepEqual(same[k],plain[k],k);
 assert.deepEqual(same.events.filter(x=>x.kind!=='switch'),plain.events);
 // The marker draws one extra frame at the stoppage; every other frame is the same.
 const key=f=>JSON.stringify([f.time,f.players,f.ball,f.score]),mine=new Set(same.frames.map(key));
 assert(plain.frames.every(f=>mine.has(key(f))),'every frame of the plain match is there');
 assert(same.frames.length-plain.frames.length<=1);
});

test('a different plan takes over at the first stoppage after its trigger holds, and play follows it from there',()=>{
 // If this fails: the switch fires mid-play, at the wrong stoppage, more than once, or the side keeps playing its
 // old tactics afterwards (identical play after the switch to a very different plan).
 const r=runMatch({...RUN,tacticsSwitches:[sw({notBefore:20,tactics:{...own(0),...DIRECT}})]}).result,made=switches(r);
 assert.equal(made.length,1,'once');
 const e=made[0],i=r.events.indexOf(e),before=r.events[i-1];
 assert(e.time>=20,'not before its second');
 assert(STOPPAGES.includes(before.kind)&&before.time===e.time,`made at the stoppage (${before.kind}) in the same tick`);
 const first=plain.events.find(x=>STOPPAGES.includes(x.kind)&&x.time>=20&&x.time>0);
 assert.equal(e.time,first.time,'the FIRST stoppage after its second (level all along until then)');
 assert.equal(e.side,0);assert.deepEqual(e.switch,{order:'b',trigger:{kind:'score',state:'drawing'},score:[0,0]});
 assert.match(e.text,/își schimbă planul de joc/);
 assert.deepEqual(r.switchNotes,[{order:'b',side:0,status:'made',time:e.time}]);
 // Up to the stoppage the match is the plain one; after it, the new tactics are read and play differs.
 assert.deepEqual(at(r,e.time),at(plain,e.time));
 const after=x=>x.frames.filter(f=>f.time>e.time).map(f=>JSON.stringify(f.players));
 assert.notDeepEqual(after(r),after(plain));
 assert(r.frames.find(f=>f.time>=e.time).restart,'the ball is dead when it happens');
});

test('the keepers\' habit follows the switch on the pitch and on the bench; null gives a keeper his own back',()=>{
 const f=withBench(),players=practicePlayers(f),gk=players.find(p=>p.id==='0:mircea');
 const own=gk.traits.keeperSweep;
 applyTacticsSwitch({id:'b',side:0,trigger:{kind:'half'},tactics:{...f.teams[0].tactics,line:'high'},keepers:{mircea:.9,rgk0:.9}},f,players);
 assert.equal(f.teams[0].tactics.line,'high');
 assert.equal(gk.traits.keeperSweep,.9);assert.equal(f.teams[0].squad.find(p=>p.id==='rgk0').traits.keeperSweep,.9);
 applyTacticsSwitch({id:'c',side:0,trigger:{kind:'half'},tactics:f.teams[0].tactics,keepers:{mircea:null}},f,players);
 assert.equal(gk.traits.keeperSweep,undefined);assert(!('keeperSweep' in gk.traits));void own;
});

test('a formation switch moves every man to his new slot at the same stoppage',()=>{
 // If this fails: the side keeps its old shape after switching to a plan in another formation, the men land in the
 // wrong roles, or the change happens away from the stoppage. 1-2-1 -> 2-2 with the slot map
 // [0,1,3,4,2]: the keeper stays, flavius stays at centre-back, the two wingers move up to the wing slots of 2-2
 // (3, 4) and the striker drops to the second centre-back slot (2).
 const two={...own(0),...DIRECT,formation:'2-2'},slots=[0,1,3,4,2];
 const r=runMatch({...RUN,tacticsSwitches:[sw({notBefore:20,tactics:two,slots})]}).result,[e]=switches(r);
 assert(e,'made');assert.equal(e.switch.formation,'2-2');
 const before=r.events[r.events.indexOf(e)-1];assert(STOPPAGES.includes(before.kind)&&before.time===e.time,'at the stoppage');
 const start=practicePlayers(RUN.fixture).filter(p=>p.side===0);
 for(const p of start){
  const now=e.switch.players.find(q=>q.id===p.id),slot=slots[p.number-1];
  assert.deepEqual([now.role,now.lane,now.number],[...shapes['2-2'][slot],slot+1],`${p.id} plays slot ${slot+1} of 2-2`);
 }
 assert.deepEqual(at(r,e.time),at(plain,e.time),'the same match up to the stoppage');
 // The live player record carries the new slot: a later substitution's newcomer copies the outgoing man's role, lane
 // and number (practice.ts applyOrders), so he takes the NEW slot. Checked here on the record itself.
 const f=withBench(),players=practicePlayers(f);
 applyTacticsSwitch({id:'b',side:0,trigger:{kind:'half'},tactics:{...f.teams[0].tactics,formation:'2-2'},slots},f,players);
 const golusor=players.find(p=>p.id==='0:golusor');
 assert.deepEqual([golusor.role,golusor.lane,golusor.number],['CB',1,3]);
 assert.equal(f.teams[0].tactics.formation,'2-2');
});

// (review of e0eebe3b) The slot map is by the slot a man holds, so a substitute moves with the slot he inherited.
const two={...own(0),...DIRECT,formation:'2-2'},SLOTS=[0,1,3,4,2];
const where=(e,id)=>e.switch.players.find(p=>p.id===id);
test('a substitute who came on before a formation switch takes his slot’s new place',()=>{
 // If this fails: after a change the switch moves the man who went off (or nobody) instead of the one now in his shirt.
 const r=runMatch({...RUN,substitutionOrders:[{id:'s',side:0,in:'r20',out:'golusor',trigger:{kind:'score',state:'drawing'}}],
  tacticsSwitches:[sw({trigger:{kind:'half'},tactics:two,slots:SLOTS})]}).result;
 const sub=r.events.find(e=>e.kind==='substitution'),[e]=switches(r);
 assert(sub&&e,'both happen');assert(sub.time<=e.time,'the substitution first (or at the same stoppage)');
 // golusor started in slot 5 (striker); r20 inherited slot 5, so he takes slots[4] = 2 (slot 3 of 2-2, a centre-back)
 assert.deepEqual([where(e,'0:r20').role,where(e,'0:r20').number],[shapes['2-2'][SLOTS[4]][0],SLOTS[4]+1]);
 assert(!where(e,'0:golusor'),'the man who went off is not moved');
 assert.equal(r.switchNotes[0].status,'made');
});
test('a substitution and a formation switch at the same stoppage: the change first, then the shape',()=>{
 const r=runMatch({...RUN,substitutionOrders:[{id:'s',side:0,in:'r20',out:'golusor',trigger:{kind:'half'}}],
  tacticsSwitches:[sw({trigger:{kind:'half'},tactics:two,slots:SLOTS})]}).result;
 const sub=r.events.find(e=>e.kind==='substitution'),[e]=switches(r);
 assert(sub&&e);assert.equal(sub.time,e.time,'the same stoppage');
 assert(r.events.indexOf(sub)<r.events.indexOf(e),'the substitution is made first');
 assert.equal(where(e,'0:r20').number,SLOTS[4]+1,'the newcomer is moved with the slot');
});
test('the full-time guard: a stoppage after full time never carries out a switch',t=>{
 // If this fails: a switch fires at a stoppage in the last attack's played-out seconds (nobody plays after it).
 // The guard needs a match that plays out a last attack ending in a stoppage. Up to four seeds are tried (one 120 s
 // match each); the switch is due only from full time, so it is the guard, not the clock, that holds it.
 let seed=null,base=null;
 for(const s of [13009,2026,7,41]){const r=runMatch({fixture:withBench(s),durationSeconds:120}).result;
  if(r.events.some(e=>STOPPAGES.includes(e.kind)&&e.time>=120)){seed=s;base=r;break;}}
 if(seed===null)return t.skip('none of the four seeds ends in a stoppage after full time on this platform');
 const r=runMatch({fixture:withBench(seed),durationSeconds:120,tacticsSwitches:[sw({trigger:{kind:'half'},notBefore:120,tactics:{...own(0),...DIRECT}})]}).result;
 assert.equal(switches(r).length,0,'no switch in the last attack');assert.deepEqual(r.switchNotes.map(n=>n.status),['waiting']);
 for(const k of ['events','frames','stats','score'])assert.deepEqual(r[k],base[k],k);
});
test('a formation switch never throws inside a match: one that cannot place the side is skipped (the caller notes it)',()=>{
 const f=withBench(),players=practicePlayers(f);players.find(p=>p.id==='0:van').number=7;
 assert.equal(slotsPlaceable({side:0,slots:SLOTS},players),false);
 assert.equal(slotsPlaceable({side:0,slots:SLOTS},practicePlayers(withBench())),true);
 assert.equal(slotsPlaceable({side:0},players),true,'a same-shape switch needs no slots');
});

test('the slot rule in every switch: a same-shape switch with the wingers swapped moves them, nothing else',()=>{
 // If this fails: plan B lines the men up differently in the same formation and the match ignores it, or moves others.
 const r=runMatch({...RUN,tacticsSwitches:[sw({trigger:{kind:'half'},tactics:{...own(0)},slots:[0,1,3,2,4]})]}).result,[e]=switches(r);
 assert(e,'made');assert(!('formation' in e.switch),'no formation change is recorded');
 const start=practicePlayers(RUN.fixture).filter(p=>p.side===0);
 for(const p of start){const now=where(e,p.id),slot=[0,1,3,2,4][p.number-1];
  assert.deepEqual([now.role,now.lane,now.number],[...shapes[own(0).formation][slot],slot+1],p.id);}
 // the two wingers changed lanes; keeper, centre-back and striker kept theirs
 const w1=start.find(p=>p.number===3),w2=start.find(p=>p.number===4);
 assert.equal(where(e,w1.id).lane,w2.lane);assert.equal(where(e,w2.id).lane,w1.lane);
 assert.deepEqual(at(r,e.time),at(plain,e.time),'the same match up to the stoppage');
});
