// Ballers fitness: compute reports each man's energy spent (deliverables/ballers-fitness/DESIGN.md §3.2), read from the
// full engine frames, and the replay header each man's start (his energy at kickoff, for a substitution's line), only
// for an input carrying the `fitness` marker; without it the payload is today's.
// Four engine runs: a 120 s match (no half-time) through compute with and without the marker and once straight through
// the engine (its full frames), and a 600 s match with a half-time and a change straight through the engine. If frames
// ever stop being recorded, loads would silently become zero: this fails first.
// It plays matches, so it runs on the public cloud lab (the laptop match guard blocks it locally):
// node packages/football-engine/evidence/_ci/cloud.mjs --app-tests --ref <branch> --suites ballers-fitness-compute
import {describe,it,expect} from 'vitest';
import {computeMatch,energySpent,engineTeam,submission,validateInput,type FrozenInput,type FrozenSide} from '../lib/ballers/simulation';
import {runMatch} from '../packages/football-engine/src/index';
import {gunzipSync} from 'node:zlib';

/** A packed payload part (simulation.ts pack) back to its JSON. */
const unpack=(b64:string)=>JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString());

const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:4+n%5,defending:5,pace:4+n%4,strength:5,stamina:3+n%5,reading:6,aerial:5,setPieces:5,keeping:gk?8:1});
function side(tag:string,formation:FrozenSide['formation'],start:number[]=[]):FrozenSide{
 const players=Array.from({length:9},(_,n)=>({id:`${tag}000000-0000-4000-8000-00000000000${n}`,name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,
  roles:(n===0||n===8?['GK']:['CM','ST']) as FrozenSide['players'][number]['roles'],skills:skills(n===0||n===8,n),
  traits:{risk:.5,dribble:.45,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:start[n]??100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation,style:'balanced',
  approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},
  captain:lineup[2],lineup,bench:players.slice(5).map(p=>p.id),players,plans:[]};
}
// forecast energies on the home side (fitness plays men at their start, possibly a decimal)
const input=(duration:number,seed:number,extra:Partial<FrozenInput>={}):FrozenInput=>({v:1,match:'m',seed,kickoff:(seed%2) as 0|1,duration,
 sides:[side('aa','1-2-1',[100,87.3,92.5,100,81.2]),side('bb','2-1-1')],...extra});
/** The engine call computeMatch makes for an input with no plans and no switch (the full frames, record: true). */
const engineRun=(inp:FrozenInput,orders:unknown[]=[])=>runMatch({fixture:{teams:inp.sides.map(engineTeam) as never,seed:inp.seed,kickoff:inp.kickoff},
 durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(orders.length?{substitutionOrders:orders}:{})} as never).result as unknown as Frames;
/** Each roster man's energy in every frame he appears in, from the run's full frames. */
type Frames={players:{id:string}[];frames:{lineup?:number[];players:{energy?:number}[]}[]};
function seen(r:Frames){
 const by=new Map<string,number[]>();
 for(const f of r.frames)f.players.forEach((p,i)=>{const id=r.players[f.lineup?f.lineup[i]:i].id;(by.get(id)??by.set(id,[]).get(id)!).push(p.energy!);});
 return by;
}

describe('energy spent from the frames',()=>{
 const SEED=4257,plain=input(120,SEED),marked=input(120,SEED,{fitness:{v:1}});
 const cPlain=computeMatch(validateInput(plain)),cMarked=computeMatch(validateInput(marked));

 it('without the marker: no energy anywhere, the payload exactly what it was',()=>{
  expect('energy' in cPlain).toBe(false);
  const sub=submission(cPlain,plain);
  expect('energy' in sub).toBe(false);
  expect(unpack(sub.header).players.some((p:{energy?:number})=>'energy' in p)).toBe(false);
  // the engine never sees the marker: the marked run's payload is the same but for the energy list and the header's
  // starts (each man's energy at kickoff, for a substitution's line: lib/ballers/replay.ts withStarts)
  const {energy,header,...rest}=submission(cMarked,marked);
  const {header:plainHeader,...plainRest}=sub;
  expect(energy).toEqual(cMarked.energy);
  expect(JSON.stringify(rest)).toBe(JSON.stringify(plainRest));
  const h=unpack(header),hp=unpack(plainHeader);
  expect(JSON.stringify({...h,players:h.players.map(({energy:_e,...p}:{energy?:number})=>p)})).toBe(JSON.stringify(hp));
 },120_000);

 it('with the marker: the header carries every man\'s start, his frozen energy, bench included',()=>{
  const h=cMarked.compact.header;
  expect(h.players.length).toBe(18);
  for(const p of h.players)expect(p.energy).toBe(marked.sides[p.side].players.find(q=>q.id===p.id)!.energy);
  expect(h.players.find(p=>p.id===marked.sides[0].lineup[1])!.energy).toBe(87.3);
  expect(cPlain.compact.header.players.every(p=>p.energy===undefined)).toBe(true);
 },120_000);

 it('a 120 s match (no half-time, no change): each man spent his first frame\'s energy minus his last',()=>{
  // the engine's own frames, as computeMatch reads them (record: true)
  const run=(cMarked as unknown as {energy:{id:string;side:0|1;spent:number}[]}).energy;
  expect(run.length).toBe(10);
  const sides=marked.sides;
  for(const e of run){
   expect(sides[e.side].lineup).toContain(e.id);
   expect(e.spent).toBeGreaterThan(0);
   expect(e.spent).toBeLessThan(40);
  }
  // the starting energies reach the engine: the home side's tired men start lower and still spend
  expect(run.filter(e=>e.side===0).map(e=>e.id)).toEqual(sides[0].lineup);
  // computed from the engine's own full frames (not the compact replay): equal to energySpent over a straight engine run
  const r=engineRun(marked),by=seen(r);
  // no change in this match: `frame.lineup` is never set (practice.ts), read as the roster's own order; were it read
  // as "nobody", every match without a change would record nobody's drain
  expect(r.frames.every(f=>f.lineup===undefined)).toBe(true);
  expect(run).toEqual(energySpent(marked,r as never));
  expect(by.get(`0:${sides[0].lineup[1]}`)![0]).toBeCloseTo(87.3,1);
  for(const e of run){
   const series=by.get(`${e.side}:${e.id}`)!;
   expect(series.every((v,i)=>i===0||v<=series[i-1])).toBe(true);
   expect(e.spent).toBeCloseTo(series[0]-series.at(-1)!,2);
  }
 },120_000);

 it('drops summed exactly: a rise (the half-time rest) skipped; a change mapped through the frames\' lineup',()=>{
  // 600 s: a half-time; a change at half-time on the home side (bench man 5 for starter 3)
  const inp=input(600,1234,{fitness:{v:1}});
  const r=engineRun(inp,[{id:'s1',side:0,in:inp.sides[0].bench[0],out:inp.sides[0].lineup[3],trigger:{kind:'half'}}]);
  const by=seen(r);
  const direct=energySpent(inp,r as never);
  expect(direct.length).toBe(11);
  let rested=0;
  for(const e of direct){
   const series=by.get(`${e.side}:${e.id}`)!;
   let drops=0,rises=0;
   for(let i=1;i<series.length;i++){const d=series[i]-series[i-1];if(d<0)drops-=d;else rises+=d;}
   expect(e.spent).toBeCloseTo(drops,2);
   // first minus last, plus whatever the rest gave back
   expect(e.spent).toBeCloseTo(series[0]-series.at(-1)!+rises,2);
   expect(rises).toBeLessThanOrEqual(6+1e-9);
   if(rises>0)rested++;
  }
  expect(rested).toBeGreaterThan(0);
  // the change: the bench man has his own entry from his own frames, the man he replaced only up to his exit
  const subIn=direct.find(e=>e.id===inp.sides[0].bench[0]),subOut=direct.find(e=>e.id===inp.sides[0].lineup[3]);
  expect(subIn&&subOut).toBeTruthy();
  expect(by.get(`0:${inp.sides[0].bench[0]}`)!.length).toBeLessThan(by.get(`0:${inp.sides[0].lineup[0]}`)!.length);
 },300_000);
});

describe('the frozen input\'s fitness keys',()=>{
 const base=input(120,1);
 it('accepts the marker and the injuries key\'s scale and strength in the engine\'s bounds',()=>{
  expect(()=>validateInput({...base,fitness:{v:1}})).not.toThrow();
  expect(()=>validateInput({...base,injuries:{on:true,salt:7,scale:0.47,strength:0.15}})).not.toThrow();
  expect(()=>validateInput({...base,injuries:{on:true,salt:7,scale:0,strength:0}})).not.toThrow();
  expect(()=>validateInput({...base,injuries:{on:true,salt:7,scale:10,strength:1}})).not.toThrow();
 });
 it('refuses anything else',()=>{
  for(const bad of [{fitness:{v:2}},{fitness:true},{fitness:null},{injuries:{on:true,salt:7,scale:-0.1}},{injuries:{on:true,salt:7,scale:10.5}},
   {injuries:{on:true,salt:7,strength:1.2}},{injuries:{on:true,salt:7,strength:'0.15'}},{injuries:{on:true,salt:7,scale:Number.NaN}}])
   expect(()=>validateInput({...base,...bad} as never)).toThrow('invalid_input');
 });
});
