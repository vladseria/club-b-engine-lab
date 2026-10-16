// Release 3 (2026-10-16): does a ready-made move play worse on this build? The move-clip recorder's own path
// (verificare/gp-wp2-clips.test.ts record(): runScenes rehearse, the practice fixture's two sides, opposition
// 'original', 8 goes over STOCK_SCENES rotated by the round, seedsFor(`clip:<key>:<round>`, 8), GO_SECONDS), for any
// round; rounds 0-3 are the recorder's own. One task = one move x one round = 8 goes. Per go: started (the move's
// start marker), its run word (to_plan / ...), our shots, a shot inside the clip window (start - 1.2 s .. start + 7 s),
// our goals. The plans come from move-plans.json (TEMPLATES[].plan(), dumped: moves.ts imports the app's data
// layer). Imports only lib/ballers scenes/league/compute (via scenes), the practice fixture and the engine.
import fixtureJson from '../../../../lib/ballers/lab/practice-fixture.json';
import {ENGINE_BUILD} from '../../src/index';
import {GO_SECONDS,STOCK_SCENES,countGo,runScenes,seedsFor} from '../../../../lib/ballers/scenes';
import {PRESETS} from '../../../../lib/ballers/league';
import PLANS from './move-plans.json';

const FIX=fixtureJson as any;
// gp-wp2-clips.test.ts side(), copied
function side(i:0|1,plans:any[]=[]):any{
 const t=FIX.teams[i];
 return {club:{id:t.id,name:t.name,code:i?'OPP':'YOU',color:i?'#C9CCD2':'#FF3D7F'},formation:t.tactics.formation,style:'balanced',approach:PRESETS.balanced,captain:t.lineup[1],lineup:[...t.lineup],
  bench:t.squad.filter((p:any)=>!t.lineup.includes(p.id)).map((p:any)=>p.id),
  players:t.squad.map((p:any,n:number)=>({id:p.id,name:p.name,short:p.name.split(' ')[0],number:n+1,roles:p.roles,skills:p.skills,traits:p.traits,energy:p.energy,archetype:p.archetype??'',temperament:p.temperament??'',note:p.note,portrait:'p0001'})),plans};
}
const LEAD=1.2,TAIL=7;

export function armTreatment(move:string){if(!(PLANS as any[]).some(p=>p.key===move))throw Error(`unknown move ${move}`);}
export function play(t:{move?:string;round?:number;arm?:string;seed?:number;rev:string}){
 // clips.mjs (rr.mjs's runner) hands {arm, seed}: arm = the move, seed = the round
 const task={move:(t.move??t.arm)!,round:(t.round??t.seed)!,rev:t.rev};
 const t0=Date.now(),plan=(PLANS as any[]).find(p=>p.key===task.move)!.plan;
 const ours=side(0,[{idea:'clip',key:plan.id,name:plan.name,plan,lineup:[...FIX.teams[0].lineup],accent:100,assign:{}}]);
 const setups=Array.from({length:8},(_,i)=>STOCK_SCENES[(i+task.round)%STOCK_SCENES.length].setup());
 const res=runScenes({type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups,seeds:seedsFor(`clip:${task.move}:${task.round}`,8),duration:GO_SECONDS} as any);
 const goes=res.goes!.map((g:any,i:number)=>{const c=countGo(g.with,plan.id),started=c.startAt!==null;
  const inClip=started&&g.with.chunks.some((ch:any)=>ch.e.some((e:any)=>e.k==='shot'&&e.s===0&&e.t>=c.startAt!-LEAD*1000&&e.t<=c.startAt!+TAIL*1000));
  return {i,scene:STOCK_SCENES[(i+task.round)%STOCK_SCENES.length].id,started,status:c.status,shots:c.shots,goals:c.goals,inClip,startAt:c.startAt};});
 return {move:task.move,round:task.round,arm:task.move,seed:task.round,rev:task.rev,build:ENGINE_BUILD.slice(0,8),plat:`${process.platform}-${process.arch}-node${process.versions.node}`,goes,ms:Date.now()-t0};
}
