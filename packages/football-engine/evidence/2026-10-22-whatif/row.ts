// What-if harness: the row entry. ../2026-10-21-engine-as-data/parity.ts unchanged (every task, every fingerprint), plus
// `extra` per revision: the match anatomy of each side, read from the raw result after the match. Evidence only; it reads
// the record and changes nothing (a row's fingerprints are the same with and without this entry: checked on T1).
//
// extra.side[0|1] (home, away), summed over the task's runs (a match task has one run):
//   goals, shots, saves, onTarget   events 'goal' / 'shot' / 'save' (a save is credited to the shooter's side;
//                                   onTarget = goals + saves)
//   passes, received                'pass' events of that side; receptions by the intended team-mate
//   oneTwo                          a return pass: A passes to B, B receives, B's next touch is a pass back to A within
//                                   5 s of A's pass, nobody else touching in between (includes a plain back-and-forth)
//   oneTwoDone                      ... and A receives the return
//   wallPass                        a completed return that A receives at least 3 m nearer their goal than where he
//                                   played the first pass from (A moved forward between the passes: the one-two of
//                                   football, "a pass and a run")
//   wallPassShot                    a shot by that side within 8 s of a wall pass, the other side not receiving between
//   jobs.<purpose>                  off-ball job CHOICE records by purpose (as variety.mjs counts them: re-decisions count)
//   starts.<purpose>                job starts: a player's choice record whose purpose differs from his previous one
//   gagTouch                        give-and-go job starts whose player received the ball within 4 s
// extra.style[0|1]: the side's preset name when the task names one (B / R blocks), else null.
import {setExtra} from '../2026-10-21-engine-as-data/parity';
import {L} from '../../src/pitch';
export * from '../2026-10-21-engine-as-data/parity';

const PURPOSES=['give-and-go','third-man','pivot','break','depth','overlap','link','outlet','join','width','counter-press','trap','near-post','far-post','cutback','playbook'];
const zero=()=>Object.fromEntries(PURPOSES.map(p=>[p,0]));
function side0(){return {goals:0,shots:0,saves:0,onTarget:0,passes:0,received:0,oneTwo:0,oneTwoDone:0,wallPass:0,wallPassShot:0,gagTouch:0,jobs:zero(),starts:zero()};}
const TOUCH=new Set(['pass','receive','shot','clearance','turnover','tackle','restart','goal','out','save','block','feint','beat','foul','offside']);

export function anatomy(runs:any[],_teams:any[],t:any){
 const out={side:[side0(),side0()],style:(t.sides??[]).map((s:any)=>s.style??s.preset??null)};
 for(const r of runs){
  const roster:any[]=r.players??[],idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const sideOfId=(id:any)=>id==null||!idx.has(id)?undefined:roster[idx.get(id)!].side;
  const frames:any[]=r.frames??[];
  const posAt=(id:string,time:number)=>{// the player's position in the last frame at or before `time`
   if(!frames.length||!idx.has(id))return null;let lo=0,hi=frames.length-1;
   while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}
   return frames[lo].players?.[idx.get(id)!]??null;
  };
  const depth=(s:number,x:number)=>s===0?x:L-x;
  const ev:any[]=r.events??[];
  for(const e of ev){
   const s=e.side??sideOfId(e.actor);if(s!==0&&s!==1)continue;
   if(e.kind==='goal')out.side[s].goals++;
   else if(e.kind==='shot')out.side[s].shots++;
   else if(e.kind==='save')out.side[1-s].saves++;
   else if(e.kind==='pass')out.side[s].passes++;
  }
  const touches=ev.filter(e=>TOUCH.has(e.kind));
  const receives=ev.filter(e=>e.kind==='receive');
  const walls:{side:number;time:number}[]=[];
  for(let i=0;i<touches.length;i++){
   const e=touches[i];
   if(e.kind!=='pass'||!e.actor||!e.target)continue;
   const s=sideOfId(e.actor);if(s!==0&&s!==1)continue;
   const rec=touches[i+1];if(!rec||rec.kind!=='receive'||rec.actor!==e.target)continue;
   out.side[s].received++;
   const back=touches[i+2];if(!back||back.kind!=='pass'||back.actor!==e.target||back.target!==e.actor||back.time-e.time>5)continue;
   out.side[s].oneTwo++;
   const ret=touches[i+3];if(!ret||ret.kind!=='receive'||ret.actor!==e.actor)continue;
   out.side[s].oneTwoDone++;
   const from=posAt(e.actor,e.time),at=posAt(e.actor,ret.time);
   if(from&&at&&depth(s,at.x)-depth(s,from.x)>=3){out.side[s].wallPass++;walls.push({side:s,time:ret.time});}
  }
  for(const sh of ev.filter(e=>e.kind==='shot')){
   const s=sh.side??sideOfId(sh.actor);if(s!==0&&s!==1)continue;
   const w=walls.filter(x=>x.side===s&&x.time<=sh.time&&sh.time-x.time<=8).pop();
   if(w&&!receives.some(x=>x.time>w.time&&x.time<sh.time&&sideOfId(x.actor)===1-s))out.side[s].wallPassShot++;
  }
  const last=new Map<number,string>();
  for(const c of r.choices??[]){
   const pu=c.assignment?.purpose,p=roster[c.player],s=p?.side;if((s!==0&&s!==1)||!pu)continue;
   const a=out.side[s];
   if(pu in a.jobs)a.jobs[pu]++;
   if(last.get(c.player)!==pu){
    if(pu in a.starts)a.starts[pu]++;
    if(pu==='give-and-go'&&receives.some(x=>x.actor===p.id&&x.time>=c.time&&x.time<=c.time+4))a.gagTouch++;
   }
   last.set(c.player,pu);
  }
 }
 for(const a of out.side)a.onTarget=a.goals+a.saves;
 return out;
}
setExtra(anatomy);
