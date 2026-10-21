import test from 'node:test';
import assert from 'node:assert/strict';
import {withBench} from './constructed-scenes.mjs';
import {runMatch,createSimulationRequest,validateTacticsSwitches,MAX_TACTICS_SWITCHES} from '../dist/index.js';
import {applyTacticsSwitch} from '../dist/practice-switch.js';
import {practicePlayers} from '../dist/practice.js';

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

test('a switch is validated: one per side, a trigger that is not a player, the same formation, real tactics',()=>{
 const f=withBench();
 assert.equal(MAX_TACTICS_SWITCHES,1);
 assert.equal(validateTacticsSwitches([sw()],f).length,1);
 assert.equal(validateTacticsSwitches([sw(),sw({id:'c',side:1,tactics:{...f.teams[1].tactics}})],f).length,2,'one for each side');
 assert.throws(()=>validateTacticsSwitches([sw(),sw({id:'c'})],f),/At most 1/);
 assert.throws(()=>validateTacticsSwitches([sw(),sw()],f),/distinct id/);
 assert.throws(()=>validateTacticsSwitches([sw({trigger:{kind:'tired',player:'van',threshold:80}})],f),/Unknown/);
 assert.throws(()=>validateTacticsSwitches([sw({trigger:{kind:'margin',atLeast:0,direction:'down'}})],f),/Margin/);
 assert.throws(()=>validateTacticsSwitches([sw({notBefore:-1})],f),/notBefore/);
 assert.throws(()=>validateTacticsSwitches([sw({tactics:{...own(0),formation:own(0).formation==='2-2'?'1-2-1':'2-2'}})],f),/keeps the formation/);
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
