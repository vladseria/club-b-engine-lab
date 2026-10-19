// Release 3 follow-up (2026-10-16): the move-clip recorder on the public lab. record() below is
// verificare/gp-wp2-clips.test.ts record() copied by script (constants, the clip() closure, the round loops,
// including the CLIP_ROUNDS extension), with the plan read from move-plans.json (TEMPLATES[].plan(), dumped: moves.ts
// imports the app's data layer) and the clip types loosened. One task = one move; the row carries the recorded clip
// and the round it came from. Runner: record.mjs. Imports only lib/ballers scenes/league/replay, the practice fixture
// and the engine.
import fixtureJson from '../../../../lib/ballers/lab/practice-fixture.json';
import {ENGINE_BUILD} from '../../src/index';
import {timeline} from '../../../../lib/ballers/replay';
import {GO_SECONDS,STOCK_SCENES,countGo,runScenes,seedsFor} from '../../../../lib/ballers/scenes';
import {PRESETS} from '../../../../lib/ballers/league';
import PLANS from './move-plans.json';

const FIX=fixtureJson as any;
function side(i:0|1,plans:any[]=[]):any{
 const t=FIX.teams[i];
 return {club:{id:t.id,name:t.name,code:i?'OPP':'YOU',color:i?'#C9CCD2':'#FF3D7F'},formation:t.tactics.formation,style:'balanced',approach:PRESETS.balanced,captain:t.lineup[1],lineup:[...t.lineup],
  bench:t.squad.filter((p:any)=>!t.lineup.includes(p.id)).map((p:any)=>p.id),
  players:t.squad.map((p:any,n:number)=>({id:p.id,name:p.name,short:p.name.split(' ')[0],number:n+1,roles:p.roles,skills:p.skills,traits:p.traits,energy:p.energy,archetype:p.archetype??'',temperament:p.temperament??'',note:p.note,portrait:'p0001'})),plans};
}
const LEAD=1.2,TAIL=7,STEP=.2,CLIP_ROUNDS=16;
// (release 4 31573ffb, 19 Oct) the clip carries when ours shot (the engine's shot events inside the clip's window), so
// the chalk draws a shot from what the go says rather than from who had the ball next: Ball in behind's shot, parried
// wide off the keeper for our kick-in, was drawn as a pass to the wing.
const shotsIn=(chunks:any[],from:number,to:number)=>
 chunks.flatMap(ch=>ch.e.filter((e:any)=>e.k==='shot'&&e.s===0&&e.t>=from*1000&&e.t<=to*1000).map((e:any)=>+(e.t/1000-from).toFixed(2)));

function record(key:string):any{
 const plan=(PLANS as any[]).find(x=>x.key===key)!.plan;
 const ours=side(0,[{idea:'clip',key:plan.id,name:plan.name,plan:plan as unknown as Record<string,unknown>,lineup:[...FIX.teams[0].lineup],accent:100,assign:{}}]);
 // (combined build b0174c30, 13 Oct) a go whose shot falls inside the clip is looked for in all four rounds before a
 // lesser go is taken: Ball in behind's first round had to-plan goes with a shot, but each shot came after the clip
 const clip=(round:number,shotOnly:boolean):any=>{
  const setups=Array.from({length:8},(_,i)=>STOCK_SCENES[(i+round)%STOCK_SCENES.length].setup());
  const res=runScenes(<any>{type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups,seeds:seedsFor(`clip:${key}:${round}`,8),duration:GO_SECONDS});
  const goes=res.goes!.map(g=>({g,c:countGo(g.with,plan.id)})).filter(x=>x.c.startAt!==null);
  const shotInClip=(x:any)=>x.g.with.chunks.some(ch=>ch.e.some(e=>e.k==='shot'&&e.s===0&&e.t>=x.c.startAt!-LEAD*1000&&e.t<=x.c.startAt!+TAIL*1000));
  const best=goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0&&shotInClip(x))??(shotOnly?undefined:goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0)??goes.find(x=>x.c.status==='to_plan')??(round===3?goes[0]:undefined));
  if(!best)return undefined;
  const tl=timeline(best.g.with.header,best.g.with.chunks),from=Math.max(0,best.c.startAt!/1000-LEAD),to=Math.min(GO_SECONDS,best.c.startAt!/1000+TAIL);
  const frames:number[][]=[];
  for(let s=from;s<=to+1e-9;s+=STEP){
   let f=tl.frames[0];for(const x of tl.frames){if(x.t<=s*1000)f=x;else break;}
   frames.push([...f.p.slice(0,10).flatMap(p=>[Math.round(p[0]/10),Math.round(p[1]/10)]),Math.round(f.b[0]/10),Math.round(f.b[1]/10),Math.round(f.b[2]/10),f.o]);
  }
  return {key,status:best.c.status as any,shots:best.c.shots,start:+(best.c.startAt!/1000-from).toFixed(1),step:STEP,frames,shotAt:shotsIn(best.g.with.chunks,from,to)};
 };
 for(let round=0;round<4;round++){const c=clip(round,true);if(c)return c;}
 // (release 3 e4d6678a, 16 Oct) Drive and slip, the rarest to reach a shot (5 to-plan goes with a shot inside the
 // window in 200 on the public lab, 9 on live: evidence/2026-10-16-release-3/results/clips-tables.md), had none in
 // rounds 0-3 and fell back to a go that loses the ball at once. Only when rounds 0-3 hold none does the search go
 // on to further rounds before a lesser go is taken, so a clip found in rounds 0-3 is recorded exactly as before.
 for(let round=4;round<CLIP_ROUNDS;round++){const c=clip(round,true);if(c)return c;}
 for(let round=0;round<4;round++){
  const setups=Array.from({length:8},(_,i)=>STOCK_SCENES[(i+round)%STOCK_SCENES.length].setup());
  const res=runScenes(<any>{type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups,seeds:seedsFor(`clip:${key}:${round}`,8),duration:GO_SECONDS});
  // The best go: played to plan and ending in a shot; else to plan; else the first that started.
  const goes=res.goes!.map(g=>({g,c:countGo(g.with,plan.id)})).filter(x=>x.c.startAt!==null);
  // (pre-push, 4 Oct) a shot inside the clip's window first, so the clip shows it (the go's shot can come after TAIL)
  const shotInClip=(x:any)=>x.g.with.chunks.some(ch=>ch.e.some(e=>e.k==='shot'&&e.s===0&&e.t>=x.c.startAt!-LEAD*1000&&e.t<=x.c.startAt!+TAIL*1000));
  const best=goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0&&shotInClip(x))??goes.find(x=>x.c.status==='to_plan'&&x.c.shots>0)??goes.find(x=>x.c.status==='to_plan')??(round===3?goes[0]:undefined);
  if(!best)continue;
  const tl=timeline(best.g.with.header,best.g.with.chunks),from=Math.max(0,best.c.startAt!/1000-LEAD),to=Math.min(GO_SECONDS,best.c.startAt!/1000+TAIL);
  const frames:number[][]=[];
  for(let s=from;s<=to+1e-9;s+=STEP){
   // the last frame at or before s (frames are kept at least 0.2 s apart)
   let f=tl.frames[0];for(const x of tl.frames){if(x.t<=s*1000)f=x;else break;}
   frames.push([...f.p.slice(0,10).flatMap(p=>[Math.round(p[0]/10),Math.round(p[1]/10)]),Math.round(f.b[0]/10),Math.round(f.b[1]/10),Math.round(f.b[2]/10),f.o]);
  }
  return {key,status:best.c.status as any,shots:best.c.shots,start:+(best.c.startAt!/1000-from).toFixed(1),step:STEP,frames,shotAt:shotsIn(best.g.with.chunks,from,to)};
 }
 throw new Error(`no go of ${key} ever started`);
}

export function armTreatment(move:string){if(!(PLANS as any[]).some(p=>p.key===move))throw Error(`unknown move ${move}`);}
export function play(t:{arm:string;seed:number;rev:string}){
 const t0=Date.now(),clip=record(t.arm);
 return {arm:t.arm,seed:t.seed,rev:t.rev,key:t.arm,clip,build:ENGINE_BUILD,plat:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0};
}
