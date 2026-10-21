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
 spells:0,spellPasses:0,losses:0,lossAt:six(),lossNoClock:0,lossClockOn:0,clockStart:0};}
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
  // ---- block circulation (../2026-10-21-block-circulation/RECON.md): read from the record, changes nothing
  {const c=circulation(r);for(const s of [0,1]){const a=out.side[s];a.circ=a.circ??circZero();addCirc(a.circ,c[s]);}}
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

// ------------------------------------------------------------------ block circulation (2026-10-21-block-circulation)
// Definitions written before any count (RECON.md "Measures"). Side s = the side in possession; "defenders" = the other
// side's outfielders (keeper excluded) on the pitch in the frame.
//   spell        a possession of s in open play: starts when s wins control or takes a restart; ends at a shot, a goal,
//                the ball out, a restart, or the other side receiving / turning over / saving
//   circulation  a spell with 4 or more completed passes (pass event, the next touch event the intended team-mate's receive)
//   switch       a completed GROUND pass in a circulation spell whose lateral move (passer's y at the strike to the
//                receiver's y at the receive) is >= 10 m (a third of the 30 m width)
//   per switch   flight (s); actual pass speed; the receiver's nearest defender at the strike and at the receive (room);
//                the defenders' centroid y move from strike to receive and to receive + 1 s, as a share of the ball's y
//                move (shift share), and its mean speed over the flight (m/s) against the ball's lateral speed; the
//                receiver's marker = the defender whose latest choice record at the strike names the receiver as target
//                (else none); his distance to the receiver at the strike, receive, +0.5 s, +1 s; lag = s from the strike
//                until that marker is within 2 m of the receiver (censored at 6 s or the spell's end: Infinity); final
//                third = receive >= 32 m from s's own goal line; a shot by s within 6 s of the receive inside the spell
//   gap event    at each completed reception in a circulation spell with the ball in the final third: an attacker of s
//                (not the keeper, not the receiver) >= 8 m across from the ball whose nearest defender is >= 4 m away.
//                Counted once per reception (the freest such man). Used = the receiver's next pass (attempted) goes to
//                him; shot = a shot by s within 6 s inside the spell
//   gap time     frames with s in control in a circulation spell, ball in the final third: the share of that time with a
//                far man (as above, relative to the ball) >= 4 m from every defender
// Everything is per side, summed over the match; per-switch and per-gap rows are kept short (rounded) for medians.
const CIRC_SWITCH=10,CIRC_FAR=8,CIRC_FREE=4,CIRC_NEAR=2,CIRC_SHOT=6,CIRC_THIRD=32;
export function circZero(){return {spells:0,circSpells:0,circPasses:0,circSeconds:0,circShots:0,circChances:0,receptions3:0,rec3Shot:0,switches:[] as number[][],gaps:[] as number[][],gapTime:0,thirdTime:0};}
function addCirc(a:any,b:any){for(const k of Object.keys(b)){if(Array.isArray(b[k]))a[k].push(...b[k]);else a[k]+=b[k];}}
export function circulation(r:any){
 const out=[circZero(),circZero()];
 const roster:any[]=r.players??[],idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOfId=(id:any)=>id==null||!idx.has(id)?undefined:roster[idx.get(id)!].side;
 const frames:any[]=r.frames??[],ev:any[]=r.events??[];if(!frames.length)return out;
 const frameAt=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const rosterAt=(f:any,j:number)=>roster[f.lineup?f.lineup[j]:j];
 const posIn=(f:any,id:string)=>{const ri=idx.get(id);if(ri===undefined)return null;const j=f.lineup?f.lineup.indexOf(ri):ri;return j>=0?f.players?.[j]??null:null;};
 const pos=(id:string,t:number)=>posIn(frames[frameAt(t)],id);
 const defendersIn=(f:any,s:number)=>(f.players??[]).map((pl:any,j:number)=>({pl,ro:rosterAt(f,j)})).filter((x:any)=>x.ro&&x.ro.side!==s&&x.ro.role!=='GK');
 const attackersIn=(f:any,s:number)=>(f.players??[]).map((pl:any,j:number)=>({pl,ro:rosterAt(f,j)})).filter((x:any)=>x.ro&&x.ro.side===s&&x.ro.role!=='GK');
 const nearest=(f:any,s:number,p:any)=>{let d=Infinity;for(const x of defendersIn(f,s))d=Math.min(d,Math.hypot(x.pl.x-p.x,x.pl.y-p.y));return d;};
 const centroid=(f:any,s:number)=>{const d=defendersIn(f,s);return d.length?d.reduce((a:number,x:any)=>a+x.pl.y,0)/d.length:NaN;};
 const depth=(s:number,x:number)=>s===0?x:L-x;
 // each player's choice records (assignments), in time order
 const recs=new Map<number,any[]>();for(const c of r.choices??[]){if(!c.assignment)continue;let a=recs.get(c.player);if(!a){a=[];recs.set(c.player,a);}a.push(c);}
 const markerOf=(s:number,receiver:string,t:number)=>{
  for(const [pi,a] of recs){const ro=roster[pi];if(!ro||ro.side===s||ro.role==='GK')continue;
   let last:any=null;for(const c of a){if(c.time<=t+1e-6)last=c;else break;}
   if(last&&last.assignment.target===receiver)return ro.id as string;}
  return null;
 };
 const sideOfEv=(e:any)=>e.side??sideOfId(e.actor);
 const shotsOf=ev.filter(e=>e.kind==='shot');
 const chanceOf=(e:any)=>{const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;return shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;};
 // ---- spells
 type Pass={from:string;to:string;t0:number;t1:number;e:any;next?:any};
 const spells:{side:number;t0:number;t1:number;passes:Pass[];shot?:any;attempts:any[]}[]=[];
 let cur:any=null;
 const close=(t:number)=>{if(cur){cur.t1=t;spells.push(cur);cur=null;}};
 const TOUCH=new Set(['pass','receive','shot','clearance','turnover','tackle','restart','goal','out','save','block','feint','beat','foul','offside']);
 const touches=ev.filter(e=>TOUCH.has(e.kind)||e.kind==='half'||e.kind==='end');
 for(let i=0;i<touches.length;i++){
  const e=touches[i],s=sideOfEv(e);
  if(e.kind==='restart'){close(e.time);if(s===0||s===1)cur={side:s,t0:e.time,t1:e.time,passes:[],attempts:[]};continue;}
  if(e.kind==='goal'||e.kind==='out'||e.kind==='half'||e.kind==='end'||e.kind==='offside'){close(e.time);continue;}
  if(s!==0&&s!==1)continue;
  if(e.kind==='shot'){if(cur&&cur.side===s){cur.shot=e;close(e.time);}else close(e.time);continue;}
  if(e.kind==='receive'||e.kind==='turnover'||e.kind==='save'||e.kind==='tackle'){
   if(cur&&cur.side!==s&&(e.kind!=='tackle'))close(e.time);
   if(!cur&&e.kind!=='tackle')cur={side:s,t0:e.time,t1:e.time,passes:[],attempts:[]};
   continue;
  }
  if(e.kind==='pass'&&cur&&cur.side===s){
   cur.attempts.push(e);
   const rec=touches[i+1];
   if(rec&&rec.kind==='receive'&&rec.actor===e.target)cur.passes.push({from:e.actor,to:e.target,t0:e.time,t1:rec.time,e});
  }
 }
 close(Infinity);
 for(const sp of spells){
  const s=sp.side,a=out[s];a.spells++;
  if(sp.passes.length<4)continue;
  a.circSpells++;a.circPasses+=sp.passes.length;
  const end=Number.isFinite(sp.t1)?sp.t1:frames[frames.length-1].time;a.circSeconds+=end-sp.t0;
  if(sp.shot){a.circShots++;a.circChances+=chanceOf(sp.shot);}
  const shotWithin=(t:number)=>{const sh=shotsOf.find(x=>sideOfEv(x)===s&&x.time>=t-1e-6&&x.time<=t+CIRC_SHOT&&x.time<=end+1e-6);return sh?Math.round(chanceOf(sh)*1000)/1000:-1;};
  // gap time (frames)
  for(let k=frameAt(sp.t0);k+1<frames.length&&frames[k].time<end;k++){
   const f=frames[k],dt=frames[k+1].time-f.time;if(!(dt>0&&dt<=.5)||f.restart||!f.control||sideOfId(f.control.owner)!==s)continue;
   if(depth(s,f.ball.x)<CIRC_THIRD)continue;
   a.thirdTime+=dt;
   if(attackersIn(f,s).some((x:any)=>x.ro.id!==f.control.owner&&Math.abs(x.pl.y-f.ball.y)>=CIRC_FAR&&nearest(f,s,x.pl)>=CIRC_FREE))a.gapTime+=dt;
  }
  sp.passes.forEach((p,pi)=>{
   const f1=frames[frameAt(p.t1)],to=posIn(f1,p.to),ball1=f1.ball;if(!to)return;
   // gap events at each reception in the final third
   if(depth(s,ball1.x)>=CIRC_THIRD){
    a.receptions3++;if(shotWithin(p.t1)>=0)a.rec3Shot++;
    let best:any=null;
    for(const x of attackersIn(f1,s)){if(x.ro.id===p.to||Math.abs(x.pl.y-ball1.y)<CIRC_FAR)continue;const d=nearest(f1,s,x.pl);if(d>=CIRC_FREE&&(!best||d>best.d))best={id:x.ro.id,d,dep:depth(s,x.pl.x)};}
    if(best){
     const nextAttempt=sp.attempts.find((e:any)=>e.time>p.t1&&e.actor===p.to);
     const nextTouch=touches.find((e:any)=>e.time>p.t1+1e-6&&(e.actor===p.to||sideOfEv(e)!==s));
     const used=!!nextAttempt&&nextTouch===nextAttempt&&nextAttempt.target===best.id?1:0;
     // [time, free man's room m, his depth m, used 0/1, shot chance within 6 s (-1 none), reception depth m]
     a.gaps.push([Math.round(p.t1*10)/10,Math.round(best.d*10)/10,Math.round(best.dep*10)/10,used,shotWithin(p.t1),Math.round(depth(s,ball1.x)*10)/10]);
    }
   }
   // switches
   const f0=frames[frameAt(p.t0)],from=posIn(f0,p.from);if(!from)return;
   const dy=to.y-from.y;if(Math.abs(dy)<CIRC_SWITCH||!p.e.pass)return;
   const flight=p.t1-p.t0,fA=frames[frameAt(p.t1+1)],fH=frames[frameAt(p.t1+.5)];
   const c0=centroid(f0,s),c1=centroid(f1,s),cA=centroid(fA,s),bdy=ball1.y-f0.ball.y||dy;
   const recv0=posIn(f0,p.to);
   const marker=markerOf(s,p.to,p.t0);
   const md=(f:any)=>{if(!marker)return NaN;const m=posIn(f,marker),q=posIn(f,p.to);return m&&q?Math.hypot(m.x-q.x,m.y-q.y):NaN;};
   let lag=Infinity;
   if(marker)for(let k=frameAt(p.t0);k<frames.length&&frames[k].time<=Math.min(end,p.t0+6);k++){if(md(frames[k])<=CIRC_NEAR){lag=frames[k].time-p.t0;break;}}
   const r1=(v:number)=>Number.isFinite(v)?Math.round(v*100)/100:v===Infinity?99:-1;
   // [time, |dy| m, flight s, speed m/s, room at strike, room at receive, shift share at receive, shift share +1 s,
   //  block speed m/s over the flight, ball lateral speed m/s, marker 0/1, marker dist strike, receive, +0.5 s, +1 s,
   //  lag s (99 = never within 6 s / the spell), final third 0/1, shot chance within 6 s (-1 none), pass index in spell]
   a.switches.push([Math.round(p.t0*10)/10,r1(Math.abs(dy)),r1(flight),r1(p.e.pass.actualSpeed),r1(recv0?nearest(f0,s,recv0):NaN),r1(nearest(f1,s,to)),
    r1((c1-c0)/bdy),r1((cA-c0)/bdy),r1(Math.abs(c1-c0)/Math.max(.05,flight)),r1(Math.abs(bdy)/Math.max(.05,flight)),marker?1:0,r1(md(f0)),r1(md(f1)),r1(md(fH)),r1(md(fA)),
    r1(lag),depth(s,ball1.x)>=CIRC_THIRD?1:0,shotWithin(p.t1),pi]);
  });
 }
 return out;
}
setExtra(anatomy);
