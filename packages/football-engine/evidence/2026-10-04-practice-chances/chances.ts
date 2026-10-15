// Practice "good chances" calibration (2026-10-04): one full match through the
// exact app code path (lib/ballers/compute.ts computeMatch, the call both the
// official compute route and lib/ballers/engine.worker.ts make), returning
// every shot as the compact replay stores it (q = the engine's quality read,
// sk = the kind of an unread shot) with whether it became a goal (its side
// scored within 4 s and it was that side's last shot before the goal), plus
// the team stats practice shows. Inputs are the luck study's fixed setups
// (../2026-10-04-luck-study/luck.ts taskInput): MEN v MCB / MEN v INT from the
// live database, the manager levers on MEN v MCB, the mirrored Direct v Counter
// design and balance-v3 style pairings (club and formation vary by seed).
import {computeMatch} from '../../../../lib/ballers/compute';
import {taskInput} from '../2026-10-04-luck-study/luck';

export function play(t:any){
 const inp=taskInput(t),t0=performance.now();
 const r=computeMatch(inp);
 const ms=Math.round(performance.now()-t0),c=r.compact;
 const sideOf=new Map(c.header.players.map(p=>[p.i,p.side]));
 const events=c.chunks.flatMap(ch=>ch.e);
 const shots=events.filter(e=>e.k==='shot'&&e.a!==undefined&&sideOf.has(e.a));
 const scored=new Set<any>();
 for(const g of events)if(g.k==='goal'&&g.s!==undefined){
  for(let i=shots.length-1;i>=0;i--){const s=shots[i];if(s.t>g.t)continue;if(s.t<g.t-4000)break;if(sideOf.get(s.a!)===g.s){scored.add(s);break;}}
 }
 const st=(s:0|1)=>{const x=c.stats[s];return {possession:Math.round(x.possession*10)/10,passes:x.passes,completed:x.completed,shots:x.shots,goals:x.goals};};
 return {setup:t.setup,seed:t.seed,...(t.lever?{lever:t.lever}:{}),...(t.pair?{pair:t.pair,cell:t.cell}:{}),group:t.group,build:r.engineBuild.slice(0,8),duration:inp.duration,
  score:c.score,stats:[st(0),st(1)],
  // [side, q|null, kind (0 read, 1 header, 2 volley, 3 free kick), goal]
  shots:shots.map(s=>[sideOf.get(s.a!),s.q??null,s.q!==undefined?0:s.sk??-1,scored.has(s)?1:0]),ms};
}
