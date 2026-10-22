// What-if harness: the row entry. ../2026-10-21-engine-as-data/parity.ts unchanged (every task, every fingerprint), plus
// `extra` per revision: the match anatomy of each side, read from the raw result after the match. Evidence only; it reads
// the record and changes nothing (a row's fingerprints are the same with and without this entry: checked on T1 and by
// self-test 1, 512/512 against the stored baseline). It also supplies one more kind of side to parity.ts (setSides):
// `{src:'squad', code, squad:'avg'|'h3'|'h4'|...}`, the squad-fit study's equal-budget squads
// (../2026-10-19-engine-audits/squads.ts, copied there from branch squad-fit-study), starters only, 1-2-1.
//
// extra.side[0|1] (home, away), summed over the task's runs (a match task has one run):
//  shots and goals
//   goals, shots                    events 'goal' (side = the side credited) / 'shot'
//   chances                         the sum of each shot's chance on the app's chances table (lib/ballers/chances.ts
//                                   shotChance: the engine's own read of the shot at the strike, mapped to a scoring rate)
//   goalsLate, chancesLate          the same from 600 s on (the last third of a 900 s match); goalsEnd from 750 s on
//   keeperSaves                     'save' events of that side's keeper: shot saves AND catches / claims of crosses and loose
//                                   balls (the engine's 'save' is any keeper handling), so it is not "shots on target"
//  passing and one-twos
//   passes, received                'pass' events of that side; receptions by the intended team-mate
//   ftPasses, ftPassDone            passes struck first time (the event's firstTime flag), and of them received by the
//                                   intended team-mate
//   ftShots, ftGoals                shots struck first time; goals whose last shot by the scoring side was first time
//   free6, free6Ft                  receptions by the intended team-mate with no opponent within 6 m (frame at the
//                                   reception), and of them played on first time (his next touch a first-time pass or shot)
//   oneTwo                          a return pass: A passes to B, B receives, B's next touch is a pass back to A within
//                                   5 s of A's pass, nobody else touching in between (includes a plain back-and-forth)
//   oneTwoDone                      ... and A receives the return
//   wallPass                        a completed return that A receives at least 3 m nearer their goal than where he
//                                   played the first pass from (A moved forward between the passes)
//   wallPassShot                    a shot by that side within 8 s of a wall pass, the other side not receiving between
//  jobs (from the choice records)
//   jobs.<purpose>                  job CHOICE records by purpose (as variety.mjs counts them: re-decisions count)
//   starts.<purpose>                job starts: a player's choice record whose purpose differs from his previous one
//   gagTouch                        give-and-go job starts whose player received the ball within 4 s
//  running and energy (outfielders on the pitch, from the frames, about 10 a second; time in sixths of 150 s)
//   energy[k]                       mean outfield energy at 150, 300, 450, 600, 750 s and at the last frame
//   dist[k], hi[k]                  metres run in sixth k, and of them at 5.5 m/s (19.8 km/h, the usual high-intensity
//                                   threshold) or faster: speed from the frame's velocity x the time to the next frame
//   peak[k]                         the mean over outfielders of each one's top speed in sixth k
//   possession                      seconds the side was the side in possession (frame.side, restarts excluded)
//  possessions and the purpose clock (a mirror of practice.ts's counter, rebuilt from events and frames: a completed
//  pass whose reception is not 3 m beyond the deepest point of the spell counts one; a progressive reception, a shot,
//  a loss or a restart starts it again; the clock starts at purposeAfter + the side's clockStartsAfter, read from style.ts)
//   spells                          possessions (control won in open play, or a restart taken)
//   spellPasses                     completed passes inside possessions
//   losses                          possessions ended by the other side winning control in open play
//   lossAt[0..5]                    losses by the recycled count when the ball was lost (5 = five or more)
//   lossNoClock                     losses after 1 or more recycled passes with the clock never started (count < start)
//   lossClockOn                     losses with the clock running (count >= start)
//   clockStart                      that start for this side (Patient 3, others 2 today)
// extra.style[0|1], extra.press[0|1], extra.progression[0|1]: the side's preset name when the task names one, and the
// played Press and Progression from the engine tactics.
import {setExtra,setSides} from '../2026-10-21-engine-as-data/parity';
import {L} from '../../src/pitch';
import * as S from '../../src/style';
import {shotChance} from '../../../../lib/ballers/chances';
import {PRESETS} from '../../../../lib/ballers/league';
import {player as squadPlayer} from '../2026-10-19-engine-audits/squads';
export * from '../2026-10-21-engine-as-data/parity';

/** The squad-fit study's squads as a parity side: five starters of the archetype, no bench, 1-2-1, Balanced until the
 * task's `preset` sets the approach (parity.ts sideOf applies preset / approach afterwards). */
setSides((spec:any)=>{
 if(spec.src!=='squad')return null;
 const starters=[0,1,2,3,4].map(i=>squadPlayer(spec.code,i,spec.squad));
 return {club:{id:spec.code,name:spec.code,code:spec.code,color:'#888888'},formation:'1-2-1',style:'balanced',approach:{...(PRESETS as any).balanced},
  captain:starters[1].id,lineup:starters.map((p:any)=>p.id),bench:[],players:starters,plans:[]};
});

const PURPOSES=['give-and-go','third-man','pivot','break','depth','overlap','link','outlet','join','width','counter-press','trap','near-post','far-post','cutback','playbook'];
const zero=()=>Object.fromEntries(PURPOSES.map(p=>[p,0]));
const six=()=>[0,0,0,0,0,0];
function side0(){return {goals:0,shots:0,chances:0,goalsLate:0,chancesLate:0,goalsEnd:0,keeperSaves:0,passes:0,received:0,ftPasses:0,ftPassDone:0,ftShots:0,ftGoals:0,free6:0,free6Ft:0,oneTwo:0,oneTwoDone:0,wallPass:0,wallPassShot:0,gagTouch:0,
 jobs:zero(),starts:zero(),energy:six(),dist:six(),hi:six(),peak:six(),possession:0,
 spells:0,spellPasses:0,losses:0,lossAt:six(),lossNoClock:0,lossClockOn:0,clockStart:0,
 stRec:0,stBehind:0,stShots:0,stGoals:0,stChances:0};}
const TOUCH=new Set(['pass','receive','shot','clearance','turnover','tackle','restart','goal','out','save','block','feint','beat','foul','offside']);
const HI=5.5,SIXTH=150,MARKS=[150,300,450,600,750];

export function anatomy(runs:any[],teams:any[],t:any){
 const out:any={side:[side0(),side0()],style:(t.sides??[]).map((s:any)=>s.style??s.preset??null),
  press:teams.map((tm:any)=>tm?.tactics?.press??null),progression:teams.map((tm:any)=>tm?.tactics?.progression??null)};
 const start=[0,1].map(i=>{const pr=teams[i]?.tactics?.progression;return S.COMMON.purposeAfter.v+(pr&&(S.PROGRESSION as any)[pr]?(S.PROGRESSION as any)[pr].clockStartsAfter.v:0);});
 out.side.forEach((a:any,i:number)=>a.clockStart=start[i]);
 const nRuns=runs.length;
 for(const r of runs){
  const roster:any[]=r.players??[],idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const sideOfId=(id:any)=>id==null||!idx.has(id)?undefined:roster[idx.get(id)!].side;
  const frames:any[]=r.frames??[];
  const frameAt=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
  const rosterOf=(f:any,j:number)=>roster[f.lineup?f.lineup[j]:j];
  const posAt=(id:string,time:number)=>{// the player's position in the last frame at or before `time`
   if(!frames.length||!idx.has(id))return null;const f=frames[frameAt(time)],ri=idx.get(id)!;
   const j=f.lineup?f.lineup.indexOf(ri):ri;return j>=0?f.players?.[j]??null:null;
  };
  const depth=(s:number,x:number)=>s===0?x:L-x;
  const ev:any[]=r.events??[];
  const sideOfEv=(e:any)=>e.side??sideOfId(e.actor);
  // ---- shots, goals, chances
  for(const e of ev){
   const s=sideOfEv(e);if(s!==0&&s!==1)continue;const a=out.side[s];
   if(e.kind==='goal'){a.goals++;if(e.time>=600)a.goalsLate++;if(e.time>=750)a.goalsEnd++;}
   else if(e.kind==='shot'){
    a.shots++;
    const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;
    const c=shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;
    a.chances+=c;if(e.time>=600)a.chancesLate+=c;
   }
   else if(e.kind==='save')a.keeperSaves++;
   else if(e.kind==='pass'){a.passes++;if(e.firstTime)a.ftPasses++;}
  }
  // ---- the striker (role ST): receptions, receptions beyond their last outfielder, shots, goals, chances
  const roleOf=(id:any)=>id==null||!idx.has(id)?undefined:roster[idx.get(id)!].role;
  const beyondLast=(id:string,time:number,s:number)=>{
   if(!frames.length)return false;const f=frames[frameAt(time)],me=posAt(id,time);if(!me)return false;
   let last=-Infinity;(f.players??[]).forEach((pl:any,j:number)=>{const ro=rosterOf(f,j);if(ro&&ro.side!==s&&ro.role!=='GK')last=Math.max(last,depth(s,pl.x));});
   return depth(s,me.x)>last;
  };
  for(const e of ev){
   if(roleOf(e.actor)!=='ST')continue;const s=sideOfId(e.actor);if(s!==0&&s!==1)continue;const a=out.side[s];
   if(e.kind==='receive'){a.stRec++;if(beyondLast(e.actor,e.time,s))a.stBehind++;}
   else if(e.kind==='shot'){a.stShots++;const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;
    a.stChances+=shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;}
   else if(e.kind==='goal'&&sideOfEv(e)===s)a.stGoals++;
  }
  // ---- first-time shots, and goals whose last shot by the scoring side was struck first time
  for(const e of ev){const s=sideOfEv(e);if((s===0||s===1)&&e.kind==='shot'&&e.firstTime)out.side[s].ftShots++;}
  ev.forEach((g:any,gi:number)=>{if(g.kind!=='goal')return;const s=sideOfEv(g);if(s!==0&&s!==1)return;
   for(let q=gi-1;q>=0;q--){const e=ev[q];if(e.kind==='shot'&&sideOfEv(e)===s){if(e.firstTime)out.side[s].ftGoals++;break;}if(e.kind==='restart')break;}});
  // ---- one-twos
  const touches=ev.filter(e=>TOUCH.has(e.kind));
  const receives=ev.filter(e=>e.kind==='receive');
  const walls:{side:number;time:number}[]=[];
  for(let i=0;i<touches.length;i++){
   const e=touches[i];
   if(e.kind!=='pass'||!e.actor||!e.target)continue;
   const s=sideOfId(e.actor);if(s!==0&&s!==1)continue;
   const rec=touches[i+1];if(!rec||rec.kind!=='receive'||rec.actor!==e.target)continue;
   out.side[s].received++;
   if(e.firstTime)out.side[s].ftPassDone++;
   {// a free reception: no opponent within 6 m of the receiver at the reception's frame
    const f=frames.length?frames[frameAt(rec.time)]:null;
    if(f){const ri=idx.get(rec.actor),j=f.lineup?f.lineup.indexOf(ri):ri,me=j>=0?f.players?.[j]:null;
     if(me){let near=Infinity;(f.players??[]).forEach((pl:any,k:number)=>{const ro=rosterOf(f,k);if(ro&&ro.side!==s)near=Math.min(near,Math.hypot(pl.x-me.x,pl.y-me.y));});
      if(near>=6){out.side[s].free6++;const nx=touches[i+2];if(nx&&nx.actor===rec.actor&&nx.firstTime&&(nx.kind==='pass'||nx.kind==='shot'))out.side[s].free6Ft++;}}}
   }
   const back=touches[i+2];if(!back||back.kind!=='pass'||back.actor!==e.target||back.target!==e.actor||back.time-e.time>5)continue;
   out.side[s].oneTwo++;
   const ret=touches[i+3];if(!ret||ret.kind!=='receive'||ret.actor!==e.actor)continue;
   out.side[s].oneTwoDone++;
   const from=posAt(e.actor,e.time),at=posAt(e.actor,ret.time);
   if(from&&at&&depth(s,at.x)-depth(s,from.x)>=3){out.side[s].wallPass++;walls.push({side:s,time:ret.time});}
  }
  for(const sh of ev.filter(e=>e.kind==='shot')){
   const s=sideOfEv(sh);if(s!==0&&s!==1)continue;
   const w=walls.filter(x=>x.side===s&&x.time<=sh.time&&sh.time-x.time<=8).pop();
   if(w&&!receives.some(x=>x.time>w.time&&x.time<sh.time&&sideOfId(x.actor)===1-s))out.side[s].wallPassShot++;
  }
  // ---- jobs
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
  // ---- running, energy, possession (frames)
  if(frames.length){
   const peak=[0,1].map(()=>Array.from({length:6},()=>new Map<number,number>()));
   for(let k=0;k+1<frames.length;k++){
    const f=frames[k],dt=frames[k+1].time-f.time;
    if(!(dt>0&&dt<=.5))continue;
    const sx=Math.min(5,Math.floor(f.time/SIXTH));
    if(!f.restart&&(f.side===0||f.side===1))out.side[f.side].possession+=dt;
    (f.players??[]).forEach((pl:any,j:number)=>{
     const ro=rosterOf(f,j);if(!ro||ro.role==='GK')return;
     const v=Math.hypot(pl.vx??0,pl.vy??0),a=out.side[ro.side];if(!a)return;
     a.dist[sx]+=v*dt;if(v>=HI)a.hi[sx]+=v*dt;
     const m=peak[ro.side][sx];m.set(j,Math.max(m.get(j)??0,v));
    });
   }
   for(const s of [0,1])for(let k=0;k<6;k++){const m=[...peak[s][k].values()];out.side[s].peak[k]+=m.length?m.reduce((x,y)=>x+y,0)/m.length/nRuns:0;}
   const meanEnergy=(f:any,s:number)=>{const v:number[]=[];(f.players??[]).forEach((pl:any,j:number)=>{const ro=rosterOf(f,j);if(ro&&ro.side===s&&ro.role!=='GK'&&typeof pl.energy==='number')v.push(pl.energy);});return v.length?v.reduce((x,y)=>x+y,0)/v.length:0;};
   const marks=[...MARKS.map(m=>frames[frameAt(m)]),frames[frames.length-1]];
   for(const s of [0,1])marks.forEach((f,k)=>{out.side[s].energy[k]+=meanEnergy(f,s)/nRuns;});
  }
  // ---- possessions and the purpose clock
  const clock=[{count:0,max:-1},{count:0,max:-1}];
  const reset=(s?:number)=>{for(const k of s===undefined?[0,1]:[s])clock[k]={count:0,max:-1};};
  let cur=-1,lastPass:any=null;
  const open=(s:number)=>{cur=s;out.side[s].spells++;};
  const lose=(s:number)=>{const a=out.side[s],n=clock[s].count;a.losses++;a.lossAt[Math.min(5,n)]++;if(n>=start[s])a.lossClockOn++;else if(n>=1)a.lossNoClock++;};
  for(const e of ev){
   const s=sideOfEv(e);
   if(e.kind==='restart'){reset();lastPass=null;cur=-1;if(s===0||s===1)open(s);continue;}
   if(e.kind==='goal'||e.kind==='out'||e.kind==='half'||e.kind==='end'){cur=-1;lastPass=null;continue;}
   if(s!==0&&s!==1)continue;
   if(e.kind==='pass'){lastPass={from:e.actor,to:e.target,side:s,fromPos:posAt(e.actor,e.time)};continue;}
   if(e.kind==='shot'){reset(s);cur=-1;lastPass=null;continue;}
   if(e.kind==='receive'||e.kind==='turnover'||e.kind==='save'){
    if(cur>=0&&s!==cur){lose(cur);reset();open(s);lastPass=null;continue;}
    if(cur<0){open(s);if(e.kind!=='receive'){lastPass=null;continue;}}
    if(e.kind==='receive'&&lastPass&&lastPass.side===s&&lastPass.to===e.actor){
     out.side[s].spellPasses++;
     const at=posAt(e.actor,e.time),c=clock[s];
     if(at){const reached=depth(s,at.x);if(c.max<0)c.max=lastPass.fromPos?depth(s,lastPass.fromPos.x):reached;
      if(reached>=c.max+3){c.count=0;c.max=reached;}else{c.count++;c.max=Math.max(c.max,reached);}}
    }
    lastPass=null;
   }
  }
 }
 return out;
}
setExtra(anatomy);
