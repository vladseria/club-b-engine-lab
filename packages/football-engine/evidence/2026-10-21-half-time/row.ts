// Half-time, step 0: the row entry. ../2026-10-22-whatif/row.ts unchanged (parity.ts's fingerprints plus each side's match
// anatomy), plus `extra.halves`, read from the raw result after the match (evidence only; it reads the record and changes
// nothing). Summed over the task's runs (a match task has one run).
//   at           the 'half' event's time (s), null when the run has none; `late` = at - duration / 2 (an attack played out)
//   side[0|1]    shots, goals, chances (lib/ballers/chances.ts shotChance) and possession seconds (frame.side, restarts
//                excluded) in each half: [first, second]; with no half the split is at duration / 2 (the clock's half)
//   energy[0|1]  mean outfield energy at: the last frame before the whistle, the second half's first frame (after the
//                rest), 600 s, 840 s, the last frame
//   kick2        the side that kicked off the second half (the kickoff restart after the whistle), null without a half
//   subsAtHalf   substitutions made at the interval (same instant as the whistle), with their trigger kinds
//   restartAfter seconds from the whistle to the second half's first kick (the kickoff's gather)
import {setExtra} from '../2026-10-21-engine-as-data/parity';
import {anatomy} from '../2026-10-22-whatif/row';
import {shotChance} from '../../../../lib/ballers/chances';
export * from '../2026-10-22-whatif/row';

function halves(runs:any[],t:any){
 const out:any={at:null,late:null,side:[0,1].map(()=>({shots:[0,0],goals:[0,0],chances:[0,0],possession:[0,0]})),
  energy:[0,1].map(()=>[0,0,0,0,0]),kick2:null,subsAtHalf:[] as string[],restartAfter:null};
 for(const r of runs){
  const roster:any[]=r.players??[],idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const sideOfId=(id:any)=>id==null||!idx.has(id)?undefined:roster[idx.get(id)!].side;
  const ev:any[]=r.events??[],frames:any[]=r.frames??[];
  const half=ev.find(e=>e.kind==='half'),split=half?half.time:r.duration/2;
  if(half){out.at=half.time;out.late=Math.round((half.time-r.duration/2)*1000)/1000;}
  const k=(time:number)=>time<split?0:1;
  for(const e of ev){
   const s=e.side??sideOfId(e.actor);if(s!==0&&s!==1)continue;const a=out.side[s];
   if(e.kind==='goal')a.goals[k(e.time)]++;
   else if(e.kind==='shot'){a.shots[k(e.time)]++;
    const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;
    a.chances[k(e.time)]+=shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;}
  }
  for(let i=0;i+1<frames.length;i++){const f=frames[i],dt=frames[i+1].time-f.time;
   if(dt>0&&dt<=.5&&!f.restart&&(f.side===0||f.side===1))out.side[f.side].possession[k(f.time)]+=dt;}
  const rosterOf=(f:any,j:number)=>roster[f.lineup?f.lineup[j]:j];
  const mean=(f:any,s:number)=>{if(!f)return 0;const v:number[]=[];(f.players??[]).forEach((pl:any,j:number)=>{const ro=rosterOf(f,j);if(ro&&ro.side===s&&ro.role!=='GK'&&typeof pl.energy==='number')v.push(pl.energy);});return v.length?v.reduce((x,y)=>x+y,0)/v.length:0;};
  const last=(time:number)=>{let best=null;for(const f of frames){if(f.time<=time+1e-9)best=f;else break;}return best;};
  const before=half?frames.filter(f=>f.half===1).at(-1):last(split-1e-6),after=half?frames.find(f=>f.half===2):last(split);
  const marks=[before,after,last(600),last(840),frames.at(-1)];
  for(const s of [0,1])marks.forEach((f,j)=>{out.energy[s][j]+=Math.round(mean(f,s)*100)/100/runs.length;});
  if(half){
   const kick=ev.find(e=>e.time>=half.time&&e.restartKind==='kickoff');
   if(kick){out.kick2=kick.side??sideOfId(kick.actor)??null;out.restartAfter=Math.round((kick.time-half.time)*100)/100;}
   for(const e of ev)if(e.kind==='substitution'&&Math.abs(e.time-half.time)<1e-6)out.subsAtHalf.push(e.substitution?.trigger?.kind??'planned');
  }
 }
 return out;
}
setExtra((runs:any[],teams:any[],t:any)=>({...anatomy(runs,teams,t),halves:halves(runs,t)}));
