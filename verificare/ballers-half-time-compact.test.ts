// Ballers half-time: the compact replay and the payload around the whistle (deliverables/ballers-half-time/DESIGN.md
// 2.2). On stub engine results (no match is played), but this file imports lib/ballers/compute.ts, which can run one,
// so the laptop guard sends it to the lab with the app's match suites (_ci/app-tests.mjs SUITES).
import {describe,it,expect} from 'vitest';
import {compact,submission,type FrozenInput,type FrozenSide,type EngineResult} from '../lib/ballers/simulation';
import {BREAK_SECONDS} from '../lib/ballers/replay';

const skills={passing:5,control:5,finishing:4,defending:5,pace:5,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:1};
function side(tag:string):FrozenSide{
 const players=Array.from({length:6},(_,n)=>({id:`${tag}-${n}`,name:`${tag} ${n}`,short:`${tag}${n}`,number:n+1,roles:(n===0?['GK']:['CM']) as FrozenSide['players'][number]['roles'],
  skills:{...skills,keeping:n===0?8:1},traits:{risk:.5,dribble:.5,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:100,archetype:'motor',temperament:'cold',note:'x',portrait:'p0010'}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation:'1-2-1',style:'balanced',
  approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'} as FrozenSide['approach'],
  captain:lineup[2],lineup,bench:[players[5].id],players,plans:[]};
}
const input:FrozenInput={v:1,match:'m',seed:1,kickoff:0,duration:900,sides:[side('aa'),side('bb')]};
const ids=input.sides.flatMap((s,k)=>s.lineup.map(id=>({id:`${k}:${id}`,side:k as 0|1,role:'CM'})));
const pose={x:24,y:0,angle:0};
/** A 900 s result (frames every 0.2 s; give `half` off that grid, as the engine's whistle pair is): a whistle at `half` (s) after an overrun, a change made at the interval, full time a full half later. */
function stub(half:number|null,played:number){
 const frames:EngineResult['frames']=[],events:EngineResult['events']=[{time:0,kind:'start',text:''}];
 for(let n=0;n*.2<=played+1e-9;n++){const t=Math.round(n*.2*1000)/1000;
  if(half!==null&&t>half&&frames.at(-1)!.time<half){frames.push({time:half,players:ids.map(()=>pose),ball:{x:24,y:0,z:0,owner:null},score:[1,0],restart:false,side:0});
   frames.push({time:half,cut:true,lineup:[0,1,2,3,4,5,6,7,8,9],players:ids.map(()=>pose),ball:{x:24,y:0,z:0,owner:null},score:[1,0],restart:true,side:1});}
  frames.push({time:t,players:ids.map(()=>pose),ball:{x:24,y:0,z:0,owner:null},score:t>=200?[1,0]:[0,0],restart:false,side:0});}
 events.push({time:200,kind:'goal',text:'',side:0});
 if(half!==null){events.push({time:half,kind:'half',text:'Pauză.'},{time:half,kind:'restart',text:'',restartKind:'kickoff',side:1});}
 events.push({time:played,kind:'end',text:''});
 return compact(input,{duration:900,...(played>900?{played}:{}),players:ids,score:[1,0],stats:[{} as never,{} as never],frames,events});
}

describe('a replay with a half-time',()=>{
 const c=stub(453.25,903.25);
 it('says it has a break, and full time a full half after the whistle',()=>{
  expect(c.header.interval).toBe(BREAK_SECONDS);
  expect(c.header).toMatchObject({duration:903.25,fullTime:903.25,chunks:15});
 });
 it('cuts the chunks at the whistle: no chunk holds both halves, the count stays 15',()=>{
  expect(c.chunks).toHaveLength(15);
  expect([c.chunks[7].t0,c.chunks[7].t1,c.chunks[8].t0,c.chunks[8].t1]).toEqual([420000,453250,453250,540000]);
  expect(c.chunks[7].e.map(e=>e.k)).toContain('half');
  expect(c.chunks[7].f.every(f=>!f.c)).toBe(true);
  expect(c.chunks[7].f.at(-1)!.t).toBe(453250);// the whistle frame itself: the live edge reaches the whistle before the break
  expect(c.chunks[8].f[0]).toMatchObject({t:453250,c:1});
  expect(c.chunks[8].e.map(e=>e.k)).toContain('restart');
  for(const ch of c.chunks.slice(0,8))expect(ch.f.every(f=>f.t<=453250)).toBe(true);
  for(const ch of c.chunks.slice(8))expect(ch.f.every(f=>f.t>=453250)).toBe(true);
  expect(c.chunks.at(-1)!.f.at(-1)!.t).toBe(903200);
 });
 it('sends the second half\'s chunks on the live clock, and the whistle and the break for ballers_submit',()=>{
  const s=submission({compact:c,dropped:[],engineBuild:'x'.repeat(8).replace(/x/g,'a')},input) as unknown as {chunks:{i:number;t0:number;t1:number}[];half:number;interval:number;played:number;duration:number};
  expect(s.chunks[7]).toMatchObject({t0:420,t1:453.25});
  expect(s.chunks[8]).toMatchObject({t0:753.25,t1:840});
  expect(s.chunks[14].t0).toBe(1140);
  expect({half:s.half,interval:s.interval,played:s.played,duration:s.duration}).toEqual({half:453.25,interval:300,played:903.25,duration:900});
 });
});
describe('a replay without one is exactly what it was',()=>{
 it('no interval, minute chunks, nominal t0',()=>{
  const c=stub(null,900);
  expect(c.header.interval).toBeUndefined();expect(c.header.fullTime).toBeUndefined();
  expect(c.chunks.map(ch=>ch.t0)).toEqual(Array.from({length:15},(_,i)=>i*60000));
  const s=submission({compact:c,dropped:[],engineBuild:'aaaaaaaa'},input) as unknown as Record<string,unknown>&{chunks:{t0:number}[]};
  expect(s.chunks.map(x=>x.t0)).toEqual(Array.from({length:15},(_,i)=>i*60));
  expect('half' in s||'interval' in s||'played' in s).toBe(false);
 });
});
