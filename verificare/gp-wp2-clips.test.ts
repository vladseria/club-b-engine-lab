// Game plan WP2: the ready-made moves' clips (Teach a move). Each clip is one
// real go of the move from a practice moment, played by the engine through the
// same runScenes path a rehearsal uses, cut around the moment it started.
//   GP_WP2_CLIPS=1 npx vitest run verificare/gp-wp2-clips.test.ts   (re-record)
//   npx vitest run verificare/gp-wp2-clips.test.ts                   (check)
import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import fixtureJson from '../lib/ballers/lab/practice-fixture.json';
import {ENGINE_BUILD} from '../packages/football-engine/src/index';
import type {FrozenSide} from '../lib/ballers/compute';
import {timeline} from '../lib/ballers/replay';
import {GO_SECONDS,STOCK_SCENES,countGo,runScenes,seedsFor} from '../lib/ballers/scenes';
import {PRESETS} from '../lib/ballers/league';
import {TEMPLATES} from '../lib/ballers/moves';
import {clipDiagram,type MoveClip,type MoveClips} from '../components/ballers/gameplan/moves/clip-data';

const FILE=new URL('../components/ballers/gameplan/moves/clips.json',import.meta.url);
type FixturePlayer={id:string;name:string;roles:string[];skills:Record<string,number>;traits:Record<string,number>;energy:number;note:string;archetype?:string;temperament?:string};
const FIX=fixtureJson as unknown as {teams:{id:string;name:string;lineup:string[];squad:FixturePlayer[];tactics:{formation:'1-2-1'}}[]};
function side(i:0|1,plans:FrozenSide['plans']=[]):FrozenSide{
 const t=FIX.teams[i];
 return {club:{id:t.id,name:t.name,code:i?'OPP':'YOU',color:i?'#C9CCD2':'#FF3D7F'},formation:t.tactics.formation,style:'balanced',approach:PRESETS.balanced,captain:t.lineup[1],lineup:[...t.lineup],
  bench:t.squad.filter(p=>!t.lineup.includes(p.id)).map(p=>p.id),
  players:t.squad.map((p,n)=>({id:p.id,name:p.name,short:p.name.split(' ')[0],number:n+1,roles:p.roles as never,skills:p.skills as never,traits:p.traits as never,energy:p.energy,archetype:p.archetype??'',temperament:p.temperament??'',note:p.note,portrait:'p0001'})),plans};
}
const LEAD=1.2,TAIL=7,STEP=.2,CLIP_ROUNDS=16;
// (release 4 31573ffb, 19 Oct) the clip carries when ours shot (the engine's shot events inside the clip's window), so
// the chalk draws a shot from what the go says rather than from who had the ball next: Ball in behind's shot, parried
// wide off the keeper for our kick-in, was drawn as a pass to the wing.
const shotsIn=(chunks:readonly {e:readonly {k:string;s?:number;t:number}[]}[],from:number,to:number)=>
 chunks.flatMap(ch=>ch.e.filter(e=>e.k==='shot'&&e.s===0&&e.t>=from*1000&&e.t<=to*1000).map(e=>+(e.t/1000-from).toFixed(2)));

function record(key:string):MoveClip{
 const t=TEMPLATES.find(x=>x.key===key)!,plan=t.plan();
 const ours=side(0,[{idea:'clip',key:plan.id,name:plan.name,plan:plan as unknown as Record<string,unknown>,lineup:[...FIX.teams[0].lineup],accent:100,assign:{}}]);
 // (combined build b0174c30, 13 Oct) a go whose shot falls inside the clip is looked for in all four rounds before a
 // lesser go is taken: Ball in behind's first round had to-plan goes with a shot, but each shot came after the clip
 const clip=(round:number,shotOnly:boolean):MoveClip|undefined=>{
  const setups=Array.from({length:8},(_,i)=>STOCK_SCENES[(i+round)%STOCK_SCENES.length].setup());
  const res=runScenes({type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups,seeds:seedsFor(`clip:${key}:${round}`,8),duration:GO_SECONDS});
  const goes=res.goes!.map(g=>({g,c:countGo(g.with,plan.id)})).filter(x=>x.c.startAt!==null);
  const shotInClip=(x:typeof goes[number])=>x.g.with.chunks.some(ch=>ch.e.some(e=>e.k==='shot'&&e.s===0&&e.t>=x.c.startAt!-LEAD*1000&&e.t<=x.c.startAt!+TAIL*1000));
  const best=goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0&&shotInClip(x))??(shotOnly?undefined:goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0)??goes.find(x=>x.c.status==='to_plan')??(round===3?goes[0]:undefined));
  if(!best)return undefined;
  const tl=timeline(best.g.with.header,best.g.with.chunks),from=Math.max(0,best.c.startAt!/1000-LEAD),to=Math.min(GO_SECONDS,best.c.startAt!/1000+TAIL);
  const frames:number[][]=[];
  for(let s=from;s<=to+1e-9;s+=STEP){
   let f=tl.frames[0];for(const x of tl.frames){if(x.t<=s*1000)f=x;else break;}
   frames.push([...f.p.slice(0,10).flatMap(p=>[Math.round(p[0]/10),Math.round(p[1]/10)]),Math.round(f.b[0]/10),Math.round(f.b[1]/10),Math.round(f.b[2]/10),f.o]);
  }
  return {key,status:best.c.status as MoveClip['status'],shots:best.c.shots,start:+(best.c.startAt!/1000-from).toFixed(1),step:STEP,frames,shotAt:shotsIn(best.g.with.chunks,from,to)};
 };
 for(let round=0;round<4;round++){const c=clip(round,true);if(c)return c;}
 // (release 3 e4d6678a, 16 Oct) Drive and slip, the rarest to reach a shot (5 to-plan goes with a shot inside the
 // window in 200 on the public lab, 9 on live: evidence/2026-10-16-release-3/results/clips-tables.md), had none in
 // rounds 0-3 and fell back to a go that loses the ball at once. Only when rounds 0-3 hold none does the search go
 // on to further rounds before a lesser go is taken, so a clip found in rounds 0-3 is recorded exactly as before.
 for(let round=4;round<CLIP_ROUNDS;round++){const c=clip(round,true);if(c)return c;}
 for(let round=0;round<4;round++){
  const setups=Array.from({length:8},(_,i)=>STOCK_SCENES[(i+round)%STOCK_SCENES.length].setup());
  const res=runScenes({type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups,seeds:seedsFor(`clip:${key}:${round}`,8),duration:GO_SECONDS});
  // The best go: played to plan and ending in a shot; else to plan; else the first that started.
  const goes=res.goes!.map(g=>({g,c:countGo(g.with,plan.id)})).filter(x=>x.c.startAt!==null);
  // (pre-push, 4 Oct) a shot inside the clip's window first, so the clip shows it (the go's shot can come after TAIL)
  const shotInClip=(x:typeof goes[number])=>x.g.with.chunks.some(ch=>ch.e.some(e=>e.k==='shot'&&e.s===0&&e.t>=x.c.startAt!-LEAD*1000&&e.t<=x.c.startAt!+TAIL*1000));
  const best=goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0&&shotInClip(x))??goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0)??goes.find(x=>x.c.status==='to_plan')??(round===3?goes[0]:undefined);
  if(!best)continue;
  const tl=timeline(best.g.with.header,best.g.with.chunks),from=Math.max(0,best.c.startAt!/1000-LEAD),to=Math.min(GO_SECONDS,best.c.startAt!/1000+TAIL);
  const frames:number[][]=[];
  for(let s=from;s<=to+1e-9;s+=STEP){
   // the last frame at or before s (frames are kept at least 0.2 s apart)
   let f=tl.frames[0];for(const x of tl.frames){if(x.t<=s*1000)f=x;else break;}
   frames.push([...f.p.slice(0,10).flatMap(p=>[Math.round(p[0]/10),Math.round(p[1]/10)]),Math.round(f.b[0]/10),Math.round(f.b[1]/10),Math.round(f.b[2]/10),f.o]);
  }
  return {key,status:best.c.status as MoveClip['status'],shots:best.c.shots,start:+(best.c.startAt!/1000-from).toFixed(1),step:STEP,frames,shotAt:shotsIn(best.g.with.chunks,from,to)};
 }
 throw new Error(`no go of ${key} ever started`);
}

describe('ready-made move clips',()=>{
 if(process.env.GP_WP2_CLIPS){
  it('records one real go per template',()=>{
   const clips:MoveClips={engineBuild:ENGINE_BUILD,clips:Object.fromEntries(TEMPLATES.map(t=>[t.key,record(t.key)]))};
   writeFileSync(FILE,JSON.stringify(clips)+'\n');
   for(const c of Object.values(clips.clips))console.log(c.key,c.status,c.shots,'shots',c.frames.length,'frames');
  },600000);
  return;
 }
 const stored=JSON.parse(readFileSync(FILE,'utf8')) as MoveClips;
 it('has one clip per ready-made move, recorded by this engine',()=>{
  expect(stored.engineBuild).toBe(ENGINE_BUILD);
  expect(Object.keys(stored.clips).sort()).toEqual(TEMPLATES.map(t=>t.key).sort());
 });
 it('every clip shows the move starting and playing out',()=>{
  for(const c of Object.values(stored.clips)){
   expect(c.frames.length).toBeGreaterThan(20);
   expect(c.frames.every(f=>f.length===24)).toBe(true);
   expect(c.start).toBeGreaterThanOrEqual(0);
   expect(c.start).toBeLessThan(c.frames.length*c.step);
   expect(['to_plan','half','broke']).toContain(c.status);
  }
 });
 it('every clip draws as chalk: at least one pass between two of ours, strokes in time order, on the pitch',()=>{
  for(const c of Object.values(stored.clips)){
   const d=clipDiagram(c);
   expect(d.marks.filter(m=>m.kind==='pass').length,c.key).toBeGreaterThan(0);
   expect(d.marks.map(m=>m.at),c.key).toEqual([...d.marks.map(m=>m.at)].sort((a,b)=>a-b));
   expect(d.marks.every(m=>m.pts.every(p=>p.x>=-1&&p.x<=49&&p.y>=-16&&p.y<=16)),c.key).toBe(true);
   expect(d.involved.every(n=>n>=0&&n<5),c.key).toBe(true);
  }
  // Ball in behind ends on the keeper: its shot is drawn
  expect(clipDiagram(stored.clips['starter-in-behind']).marks.some(m=>m.kind==='shot')).toBe(true);
 });
});
