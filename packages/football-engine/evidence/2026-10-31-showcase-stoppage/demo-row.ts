// Bebe's showcase, the injury stoppage (31 Oct 2026): the demo's seed search on the public lab. Evidence only. Played
// through ../2026-10-21-engine-as-data/run.mjs (--entry ../2026-10-31-showcase-stoppage/demo-row.ts --set
// ../2026-10-31-showcase-stoppage/demo-set.mjs). The input is the demo's real one (demo-input.json: written by
// verificare/showcase-demo-replay.mjs --save-input from the real freezer; real players of the test space, names, roles,
// skills and portraits only); each task plays it at one seed through the league's own compute and submission
// (lib/ballers/simulation.ts), the injury salt as the freezer derives it. The row keeps, for each of F.C. Bebe Power's
// injuries, who stopped play and how it restarted, and the whole payload only when the referee stopped play for one of
// them and restarted with a dropped ball (what verificare/showcase-demo-replay.mjs --from-lab writes into the demo).
import {computeMatch,submission,validateInput} from '../../../../lib/ballers/simulation';
import {ENGINE_BUILD} from '../../src/index';
import frozen from './demo-input.json';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}
export function play(task:any){
 const base=(frozen as any).input;
 const input={...base,seed:task.seed,kickoff:task.seed%2,injuries:{...base.injuries,salt:Number((BigInt(task.seed)*2654435761n)%4294967296n)}};
 const inp=validateInput(input),t0=Date.now(),c0=process.cpuUsage();
 const c:any=DRY?null:computeMatch(inp);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0);
 let extra:any=null;
 if(c){
  const ev=c.compact.chunks.flatMap((ch:any)=>ch.e),short=(id:string)=>inp.sides.flatMap((s:any)=>s.players).find((p:any)=>p.id===id)?.short??id;
  const ours=(c.injuries??[]).filter((i:any)=>i.side===0).map((i:any)=>{
   const at=i.off===undefined?null:Math.round(i.off*1000),ref=at!==null&&ev.some((e:any)=>e.k==='stoppage'&&Math.abs(e.t-at)<=1);
   const kick=at===null?undefined:ev.find((e:any)=>e.t>at+1&&e.rk);
   return {short:short(i.id),cause:i.cause,...(i.by?{by:short(i.by)}:{}),t:i.t,...(i.off!==undefined?{off:i.off}:{}),ref,...(kick?{rk:kick.rk}:{})};
  });
  const whole=ours.some((i:any)=>i.ref&&i.rk==='dropBall');
  extra={seed:task.seed,order:task.order,score:c.compact.score,ours,...(whole?{pay:submission(c,inp)}:{})};
 }
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:c?.compact.score??[0,0],print:[0,0,0],full:'',build:ENGINE_BUILD.slice(0,8),runs:1,frames:0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:[],tactics:null,variety:null,extra};
}
