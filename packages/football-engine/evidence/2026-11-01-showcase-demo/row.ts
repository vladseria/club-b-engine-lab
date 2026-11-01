// Bebe's showcase demo, rebuilt on everything that landed by 1 Nov (the two-tier guest sides, the leaning pick, engine
// 57f11aee: the forced change counts toward the three, a man who plays on is injured to full time): the demo's seed
// search on the public lab. Evidence only. Played through ../2026-10-21-engine-as-data/run.mjs (--entry
// ../2026-11-01-showcase-demo/row.ts --set ../2026-11-01-showcase-demo/set.mjs --block D).
//
// The input is the demo's real one (input.json: written by verificare/showcase-demo-replay.mjs --save-input from the
// real draw and the real freezer; real players of the test space and the permanent guest men, names, roles, skills,
// habits and portraits only, no member handle); each task plays it at one seed through the league's own compute and
// submission (lib/ballers/simulation.ts), the injury salt as the freezer derives it. The row keeps the match's summary:
// score, goals, both sides' substitutions, and every injury (either side) as the screen reads it from the replay
// (lib/ballers/injury-moments.ts): the stoppage he was treated at, whether the referee stopped play for him, how play
// restarted, who came on or that he played on. The whole payload (what --from-lab writes into the demo) only for the
// seeds set.mjs marks to keep (--d-keep).
import {computeMatch,submission,validateInput} from '../../../../lib/ballers/simulation';
import {ENGINE_BUILD} from '../../src/index';
import frozen from './input.json';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}
const sec=(ms:number)=>Math.round(ms/100)/10;
export function play(task:any){
 const base=(frozen as any).input;
 const input={...base,seed:task.seed,kickoff:task.seed%2,injuries:{...base.injuries,salt:Number((BigInt(task.seed)*2654435761n)%4294967296n)}};
 const inp=validateInput(input),t0=Date.now(),c0=process.cpuUsage();
 const c:any=DRY?null:computeMatch(inp);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0);
 let extra:any=null;
 if(c){
  const h=c.compact.header,ev:any[]=c.compact.chunks.flatMap((ch:any)=>ch.e),short=(i:number|undefined)=>i===undefined?null:h.players[i]?.short??null;
  const goals=ev.filter(e=>e.k==='goal').map(e=>({t:sec(e.t),s:e.s,p:short(e.a)}));
  const subs=[0,1].map(s=>ev.filter(e=>e.k==='substitution'&&h.players[e.a]?.side===s).map(e=>({t:sec(e.t),on:short(e.a),off:short(e.g),k:e.sb?.k??null})));
  const inj=ev.filter(e=>e.k==='injury'&&e.a!==undefined).map(e=>{
   const tr=ev.find(x=>x.k==='treatment'&&x.a===e.a&&x.t>=e.t),stop=tr?.t??null;
   const sub=stop===null?undefined:ev.find(x=>x.k==='substitution'&&x.g===e.a&&x.t===stop);
   const kick=stop===null?undefined:ev.find(x=>x.t>stop&&x.rk);
   const made=ev.filter(x=>x.k==='substitution'&&x.t<e.t&&h.players[x.a]?.side===h.players[e.a].side).length;
   const rec=(c.injuries??[]).find((i:any)=>i.side===h.players[e.a].side&&Math.abs(i.t*1000-e.t)<=1);
   return {s:h.players[e.a].side,p:short(e.a),c:e.ij?.c??rec?.cause??null,...(rec?.by?{by:rec.by}:{}),n:e.ij?.n??null,t:sec(e.t),
    stop:stop===null?null:sec(stop),ref:stop!==null&&ev.some(x=>x.k==='stoppage'&&x.t===stop),rk:kick?.rk??null,
    on:short(sub?.a),po:!!rec?.played_on,made};
  });
  const states=ev.filter(e=>e.k==='state').map(e=>({t:sec(e.t),p:short(e.a),i:e.st?.i??null,end:!!e.st?.e}));
  extra={seed:task.seed,order:task.order,score:c.compact.score,goals,subs,inj,states,...(task.keep?{pay:submission(c,inp)}:{})};
 }
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:c?.compact.score??[0,0],print:[0,0,0],full:'',build:ENGINE_BUILD.slice(0,8),runs:1,frames:0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:[],tactics:null,variety:null,extra};
}
