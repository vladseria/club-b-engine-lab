// The in-match plan switch through lib/ballers/compute.ts (deliverables/ballers-plan-switch/DESIGN.md): the engine
// input sideSwitches builds, the replay marker compact writes (on a hand-made engine result), and one real 300 s
// match with a formation-changing switch against the same match without it. Plays matches: lab only
// (packages/football-engine/evidence/_ci/app-tests.mjs SUITES). The words are ballers-plan-switch.test.ts.
import {describe,it,expect} from 'vitest';
import {compact,computeMatch,engineTeam,sideSwitches,type EngineResult,type FrozenInput,type FrozenSide} from '../lib/ballers/compute';
import {frozenSwitch,type PrepSwitch} from '../lib/ballers/switch';
import {PRESETS} from '../lib/ballers/league';

const pid=(n:number)=>`aa000000-0000-4000-8000-00000000000${n}`;
function side(over:Partial<FrozenSide>={}):FrozenSide{
 const players=Array.from({length:8},(_,n)=>({id:pid(n),name:`Player ${n}`,short:`P${n}`,number:n+1,roles:(n===0||n===7?['GK']:n===1?['CB']:n===4?['ST','W']:['W','CB']) as FrozenSide['players'][0]['roles'],
  skills:{passing:5,control:5,finishing:5,defending:5,pace:5,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:n===0||n===7?8:1},
  traits:{risk:.5,dribble:.5,runs:.5,comesShort:.4,engagement:.5,discipline:.8,...(n===0?{keeperSweep:.3}:{})},energy:100,archetype:'motor',temperament:'cold',note:'x',portrait:'p0010'}));
 return {club:{id:'aa-club',name:'Club AA',code:'AAX',color:'#FF3D7F'},formation:'1-2-1',style:'combinations',approach:{...PRESETS.combinations},
  captain:pid(1),lineup:players.slice(0,5).map(p=>p.id),bench:players.slice(5).map(p=>p.id),players,plans:[],...over};
}
const sw=(over:Partial<PrepSwitch>={}):PrepSwitch=>({id:'sw',to_plan:'plan-b',trigger:{kind:'score',state:'losing'},notBefore:300,fits:true,
 to:{name:'Direct plan',version:3,based_on:'direct',formation:'1-2-1',settings:{...PRESETS.direct},set_pieces:{keeper:'sweeper',setPiece:'delivery',taker:pid(2)}},...over});
const name=(id:string)=>`P${id.slice(-1)}`;

describe('what the engine gets',()=>{
 it('sideSwitches builds the target tactics the way engineTeam builds a side, keeping this side’s taker',()=>{
  // If this fails: the switched side plays something other than its plan B, or loses its own set-piece taker.
  const own=side({settings:{taker:pid(3)},switch:frozenSwitch(sw(),'1-2-1')});
  const input:FrozenInput={v:1,match:'m',seed:1,kickoff:0,duration:300,sides:[own,side()]};
  const teams=input.sides.map(engineTeam) as [ReturnType<typeof engineTeam>,ReturnType<typeof engineTeam>];
  const {switches,dropped}=sideSwitches(input,teams);
  expect(dropped).toEqual([]);
  expect(switches[0].tactics).toMatchObject({...PRESETS.direct,formation:'1-2-1',setPiece:'delivery',taker:pid(3)});
  // keeper call: none before (his own .3), sweeper after: only the keepers whose habit changes are named
  expect(switches[0].keepers).toEqual({[pid(0)]:.9,[pid(7)]:.9});
  // no switch: nothing at all
  expect(sideSwitches({...input,sides:[side(),side()]},teams).switches).toEqual([]);
 });
 it('another formation carries its shape and slot map; beside a move it is left out and reported, never the match',()=>{
  const two=frozenSwitch({...sw(),to:{...sw().to!,formation:'2-2',slots:[0,1,3,4,2]}},'1-2-1');
  const input:FrozenInput={v:1,match:'m',seed:1,kickoff:0,duration:300,sides:[side({switch:two}),side()]};
  const teams=input.sides.map(engineTeam) as never;
  const r=sideSwitches(input,teams);
  expect(r.switches[0]).toMatchObject({slots:[0,1,3,4,2],tactics:{formation:'2-2'}});
  const withMove={...input,sides:[side({switch:two}),side({plans:[{idea:'m',key:'k',name:'n',plan:{},lineup:[],accent:80}]})] as FrozenInput['sides']};
  expect(sideSwitches(withMove,teams)).toEqual({switches:[],dropped:['switch:0']});
 });
});

describe('the marker and the line',()=>{
 // a hand-made engine result: a throw-in at 5:39, the switch in the same tick, in another formation
 const input:FrozenInput={v:1,match:'m',seed:1,kickoff:0,duration:900,sides:[side({switch:frozenSwitch({...sw(),to:{...sw().to!,formation:'2-2',slots:[0,1,3,4,2]}},'1-2-1')}),side()]};
 const players=[...input.sides[0].lineup.map((id,i)=>({id:`0:${id}`,side:0 as const,role:['GK','CB','W','W','ST'][i]})),...input.sides[1].lineup.map((id,i)=>({id:`1:${id}`,side:1 as const,role:['GK','CB','W','W','ST'][i]}))];
 const frame=(time:number)=>({time,players:players.map(()=>({x:10,y:0,angle:0})),ball:{x:20,y:0,z:0,owner:null},score:[0,1] as [number,number],restart:true,side:1 as const});
 const r:EngineResult={duration:900,players,frames:[frame(0),frame(339.75),frame(900)],stats:[{} as never,{} as never],score:[0,1],
  events:[{time:0,kind:'start',text:'Start'},{time:100,kind:'goal',text:'Gol',side:1},{time:339.75,kind:'out',text:'Afară'},
   {time:339.75,kind:'switch',text:'Club AA își schimbă planul de joc (echipa e în urmă).',side:0,switch:{order:'sw',trigger:{kind:'score',state:'losing'},score:[0,1],formation:'2-2',
    players:input.sides[0].lineup.map((id,i)=>({id:`0:${id}`,role:['GK','CB','W','W','CB'][i]}))}},{time:900,kind:'end',text:'Final'}],
  switchNotes:[{order:'sw',side:0,status:'made',time:339.75}]};
 const c=compact(input,r),events=c.chunks.flatMap(ch=>ch.e);
 it('the replay carries the moment, the trigger, the style and the new roles, never the plan’s name',()=>{
  // If this fails: the match page can't show the switch, or it shows the manager's private plan name to everyone.
  const e=events.find(x=>x.k==='switch')!;
  expect(e).toMatchObject({t:339750,s:0,sw:{k:'score',st:'losing',y:'direct',f:'2-2',ro:[[0,'GK'],[1,'CB'],[2,'W'],[3,'W'],[4,'CB']]}});
  expect(JSON.stringify(c)).not.toContain('Direct plan');
  expect(c.header.teams[0]).toMatchObject({formation:'1-2-1',style:'combinations'});
  expect(c.switchNotes).toEqual([{order:'sw',side:0,status:'made',time:339.75}]);
 });
 it('no switch: the compact has no switch key at all',()=>{
  const plain=compact({...input,sides:[side(),side()]},{...r,events:r.events.filter(e=>e.kind!=='switch'),switchNotes:undefined});
  expect('switchNotes' in plain).toBe(false);
  expect(plain.chunks.flatMap(ch=>ch.e).some(e=>e.k==='switch')).toBe(false);
 });
});

describe('one real match',()=>{
 // 300 s, seed 4040: side 0 switches to Direct in 2-2 at half-time (2:30 of a 300 s match; whatever the score, so the
 // check doesn't hang on this seed's goals: the trigger rules are the engine's own test)
 const {notBefore:_nb,...frozen}=frozenSwitch({...sw(),to:{...sw().to!,formation:'2-2',slots:[0,1,3,4,2]}},'1-2-1')!;void _nb;
 const two={...frozen,trigger:{kind:'half' as const}};
 const base:FrozenInput={v:1,match:'switch-real',seed:4040,kickoff:0,duration:300,sides:[side(),side({club:{id:'bb-club',name:'Club BB',code:'BBX',color:'#0EA47F'}})]};
 const plain=computeMatch(base),withSwitch=computeMatch({...base,sides:[side({switch:two}),base.sides[1]]});
 it('the switch fires once, at a stoppage, with the new roles in the replay; up to it the match is the same',()=>{
  // If this fails: a formation switch never reaches the engine through the app's own path, fires away from a
  // stoppage, or changes play before it fires.
  expect(withSwitch.dropped).toEqual([]);
  const ev=withSwitch.compact.chunks.flatMap(c=>c.e),i=ev.findIndex(e=>e.k==='switch');
  expect(i).toBeGreaterThan(0);expect(ev.filter(e=>e.k==='switch')).toHaveLength(1);
  expect(['goal','out','foul','offside','half']).toContain(ev[i-1].k);expect(ev[i-1].t).toBe(ev[i].t);expect(ev[i].t).toBeGreaterThanOrEqual(150000);
  expect(ev[i].sw).toMatchObject({k:'half',y:'direct',f:'2-2'});
  expect(ev[i].sw!.ro!.map(r=>r[1])).toEqual(['GK','CB','W','W','CB']);
  const notes=withSwitch.compact.switchNotes!;expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({order:'sw',side:0,status:'made'});expect(Math.round(notes[0].time!*1000)).toBe(ev[i].t);
  const before=(c:typeof plain)=>c.compact.chunks.flatMap(x=>x.e).filter(e=>e.t<ev[i].t);
  expect(before(withSwitch)).toEqual(before(plain));
 },120000);
 it('without a switch the compact carries no switch key',()=>{
  expect('switchNotes' in plain.compact).toBe(false);
  expect(plain.compact.chunks.flatMap(c=>c.e).some(e=>e.k==='switch')).toBe(false);
 });
});
