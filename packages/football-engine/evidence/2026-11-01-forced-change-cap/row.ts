// Bebe's showcase, the forced change counts toward the three changes (owner, 1 Nov 2026): one match row. Evidence only.
// Played through ../2026-10-21-engine-as-data/run.mjs (--entry ../2026-11-01-forced-change-cap/row.ts --set
// ../2026-11-01-showcase-strength/set.mjs), both builds in one run (--revs base=<ea90b878's commit>,cand=working), so each
// task is a paired read. The match is the strength study's (../2026-11-01-showcase-strength/row.ts: the real freezer's
// Bebe nine at home against one guest side, through lib/ballers/simulation computeMatch, the injuries key with the
// freezer's salt and both sides' ages). The row keeps, per injury, how many changes his side had made before the stoppage
// he was treated at, whether he went off or played on, and per side the changes made, the forced ones and the orders the
// engine refused because the side had made all its changes; `print` / `full` fingerprint the compact replay and the whole
// computed result (print: fnv over the compact, as parity.ts; full: sha256 over compact + injuries), so base and cand are
// the same match exactly when the cap never bound.
import {createHash} from 'node:crypto';
import {computeMatch,validateInput} from '../../../../lib/ballers/simulation';
import {ENGINE_BUILD} from '../../src/index';
import data from '../2026-11-01-showcase-strength/nines.json';

export function init(_d:any){}
let DRY=false;export function setDry(v:boolean){DRY=v;}
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
export function play(task:any){
 const D=data as any,nine=D.nines.find((n:any)=>n.id===task.nine),guest=D.guests[task.guest];
 if(!nine||!guest)throw Error(`unknown nine/guest ${task.nine}/${task.guest}`);
 const bebe=task.grown?{...nine.side,players:nine.side.players.map((p:any)=>nine.grown[p.id]?{...p,skills:nine.grown[p.id]}:p)}:nine.side;
 const input={v:1,match:`strength-${task.id}`,seed:task.seed,kickoff:task.seed%2,duration:900,sides:[bebe,guest.side],
  injuries:{on:true,salt:Number((BigInt(task.seed)*2654435761n)%4294967296n),age:[nine.ages,guest.ages]}};
 const inp=validateInput(input),t0=Date.now(),c0=process.cpuUsage();
 const c:any=DRY?null:computeMatch(inp);
 const ms=Date.now()-t0,cpu=process.cpuUsage(c0);
 let extra:any=null,print=[0,0,0],full='';
 if(c){
  const s=JSON.stringify(c.compact);print=[s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];
  full=createHash('sha256').update(s).update(JSON.stringify(c.injuries??[])).digest('hex').slice(0,24);
  const players=c.compact.header.players as any[],ev=c.compact.chunks.flatMap((ch:any)=>ch.e) as any[];
  const sideOf=(i:number)=>players[i]?.side as 0|1;
  const subs=ev.filter(e=>e.k==='substitution'&&e.a!==undefined);
  const idx=(id:string)=>players.findIndex(p=>p.id===id);
  const inj=(c.injuries??[]).map((i:any)=>{
   const me=idx(i.id),tr=ev.find(e=>e.k==='treatment'&&e.a===me&&e.t>=Math.round(i.t*1000)-1);
   // the stoppage he was dealt with at: his treatment (none at the interval or after full time): the side's changes
   // made before it (orders and forced changes alike; his own forced change is at that instant, after the treatment)
   const at=tr?.t??(i.off!==undefined?Math.round(i.off*1000):null);
   const before=at===null?null:subs.filter(e=>sideOf(e.a)===i.side&&(e.t<at||e.t===at&&e.g!==me&&ev.indexOf(e)<ev.indexOf(tr??e))).length;
   return {s:i.side,t:Math.round(i.t),c:i.cause,before,...(i.off!==undefined?{off:Math.round(i.off)}:{}),...(i.played_on?{po:1}:{}),...(at===null?{none:1}:{})};
  });
  const notes=(c.compact.substitutionNotes??[]) as any[];
  const refused=[0,1].map(side=>notes.filter(n=>n.side===side).flatMap(n=>n.notes).filter((n:any)=>n.status==='impossible'&&/deja toate/.test(n.detail??'')).length);
  extra={nine:task.nine,guest:task.guest,seed:task.seed,score:c.compact.score,inj,
   changes:[0,1].map(side=>subs.filter(e=>sideOf(e.a)===side).length),forced:[0,1].map(side=>subs.filter(e=>sideOf(e.a)===side&&e.sb?.k==='injury').length),refused,
   played:c.compact.chunks.at(-1)?.end?.played??900,dropped:c.dropped};
 }
 return {ms,cpuMs:Math.round((cpu.user+cpu.system)/1000),score:c?.compact.score??[0,0],print,full,build:ENGINE_BUILD.slice(0,8),runs:1,frames:0,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,dropped:c?.dropped??[],tactics:null,variety:null,extra};
}
