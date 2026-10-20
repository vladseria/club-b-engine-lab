// Release 5 follow-up (2026-10-20): a wider search for two move clips (lay-off, repeated one-two) with the move-clip
// recorder's own path and criteria. One task = one move x one round (seed = the round): the round is played exactly as
// ../2026-10-16-release-3/record.ts clip() plays it (= verificare/gp-wp2-clips.test.ts record(): 8 goes over STOCK_SCENES
// rotated by the round, seedsFor(`clip:<key>:<round>`, 8), GO_SECONDS, opposition 'original'), and EVERY go that meets
// clip()'s first criterion (to plan, a shot of ours, a shot inside the clip window) is returned as the clip clip() would
// record from it (same frames, start, shotAt). Nothing is loosened; the recorder takes the first of these in rounds 0-15,
// this returns all of them for any round, and the chalk is read afterwards (clipDiagram). Runner: search.mjs.
import fixtureJson from '../../../../lib/ballers/lab/practice-fixture.json';
import {ENGINE_BUILD} from '../../src/index';
import {timeline} from '../../../../lib/ballers/replay';
import {GO_SECONDS,STOCK_SCENES,countGo,runScenes,seedsFor} from '../../../../lib/ballers/scenes';
import {PRESETS} from '../../../../lib/ballers/league';
import PLANS from '../2026-10-16-release-3/move-plans.json';

const FIX=fixtureJson as any;
function side(i:0|1,plans:any[]=[]):any{
 const t=FIX.teams[i];
 return {club:{id:t.id,name:t.name,code:i?'OPP':'YOU',color:i?'#C9CCD2':'#FF3D7F'},formation:t.tactics.formation,style:'balanced',approach:PRESETS.balanced,captain:t.lineup[1],lineup:[...t.lineup],
  bench:t.squad.filter((p:any)=>!t.lineup.includes(p.id)).map((p:any)=>p.id),
  players:t.squad.map((p:any,n:number)=>({id:p.id,name:p.name,short:p.name.split(' ')[0],number:n+1,roles:p.roles,skills:p.skills,traits:p.traits,energy:p.energy,archetype:p.archetype??'',temperament:p.temperament??'',note:p.note,portrait:'p0001'})),plans};
}
const LEAD=1.2,TAIL=7,STEP=.2;
const shotsIn=(chunks:any[],from:number,to:number)=>
 chunks.flatMap(ch=>ch.e.filter((e:any)=>e.k==='shot'&&e.s===0&&e.t>=from*1000&&e.t<=to*1000).map((e:any)=>+(e.t/1000-from).toFixed(2)));

function candidates(key:string,round:number):any[]{
 const plan=(PLANS as any[]).find(x=>x.key===key)!.plan;
 const ours=side(0,[{idea:'clip',key:plan.id,name:plan.name,plan:plan as unknown as Record<string,unknown>,lineup:[...FIX.teams[0].lineup],accent:100,assign:{}}]);
 const setups=Array.from({length:8},(_,i)=>STOCK_SCENES[(i+round)%STOCK_SCENES.length].setup());
 const res=runScenes(<any>{type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups,seeds:seedsFor(`clip:${key}:${round}`,8),duration:GO_SECONDS});
 const goes=res.goes!.map((g:any,i:number)=>({i,g,c:countGo(g.with,plan.id)})).filter((x:any)=>x.c.startAt!==null);
 const shotInClip=(x:any)=>x.g.with.chunks.some((ch:any)=>ch.e.some((e:any)=>e.k==='shot'&&e.s===0&&e.t>=x.c.startAt!-LEAD*1000&&e.t<=x.c.startAt!+TAIL*1000));
 return goes.filter((x:any)=>x.c.status==='to_plan'&&x.c.shots>0&&shotInClip(x)).map((best:any)=>{
  const tl=timeline(best.g.with.header,best.g.with.chunks),from=Math.max(0,best.c.startAt!/1000-LEAD),to=Math.min(GO_SECONDS,best.c.startAt!/1000+TAIL);
  const frames:number[][]=[];
  for(let s=from;s<=to+1e-9;s+=STEP){
   let f=tl.frames[0];for(const x of tl.frames){if(x.t<=s*1000)f=x;else break;}
   frames.push([...f.p.slice(0,10).flatMap((p:any)=>[Math.round(p[0]/10),Math.round(p[1]/10)]),Math.round(f.b[0]/10),Math.round(f.b[1]/10),Math.round(f.b[2]/10),f.o]);
  }
  return {go:best.i,clip:{key,status:best.c.status,shots:best.c.shots,start:+(best.c.startAt!/1000-from).toFixed(1),step:STEP,frames,shotAt:shotsIn(best.g.with.chunks,from,to)}};
 });
}

export function armTreatment(move:string){if(!(PLANS as any[]).some(p=>p.key===move))throw Error(`unknown move ${move}`);}
export function play(t:{arm:string;seed:number;rev:string}){
 const t0=Date.now(),found=candidates(t.arm,t.seed);
 return {arm:t.arm,seed:t.seed,round:t.seed,rev:t.rev,found,build:ENGINE_BUILD,plat:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0};
}
