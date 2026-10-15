// Luck study (2026-10-04): one FIXED setup replayed with many seeds. Only the
// match seed changes inside a setup (sides, kickoff, squads, plans fixed).
// Setups:
//   mcb  the owner's practice pairing, Ceata Mentala's Direct plan (side 0,
//        kicks off) v FC Prizantemele's practice side, rebuilt from the live
//        database (../2026-10-03-defending-awareness/inputs/sides.json), with
//        MEN's substitution order, the call PracticeGP.tsx makes;
//   int  MEN v Inter's last league input (same file);
//   dvc  the balance-v3 mirrored design held fixed at design seed 1: FC
//        Directia Darmanesti's five on both sides, 2-1-1, Direct preset (side 0,
//        kicks off) v Counter preset; no ideas, no subs;
//   parity  a stored balance-v3 style task {seed,pair,cell} (cloud parity with
//        ../2026-10-04-stepacross-giveaways/results/cloud/sg.jsonl.gz).
// Row: score, the engine's team stats, possession, and every shot:
//   [side, q, type, dist, onT, yC, zC, kGap, first, goal, t, angErr]
//   q      the engine's own shot-quality read (assessment.quality; null for
//          headers, volleys and direct free kicks, which carry no assessment)
//   type   0 foot, 1 header, 2 volley, 3 direct free kick
//   dist   metres from the goal centre at the strike
//   onT    1 when the struck ball's own flight (advanceFlight from the strike
//          velocity, no contact) crosses the goal line inside the posts and
//          under the bar; yC/zC its crossing point (null when it never gets there)
//   kGap   |yC - the keeper's y at the strike| (lateral distance to cover)
//   first  what met the ball first: 0 nothing (out / wide), 1 keeper catch,
//          2 keeper parry or body block, 3 outfield block, 4 goal untouched,
//          5 another touch (team-mate or deflection without an event)
//   goal   1 when the side scored within 4 s and this was its last shot
//   angErr the strike's angular error (rad) against the aim, foot shots
//   (mechanism check for the shot-noise patch)
import {runMatch} from '../../src/index';
import {advanceFlight} from '../../src/practice-flight';
import {input} from '../2026-09-30-balance-v3/match';
import {engineTeam,sideOrders,type FrozenInput,type FrozenSide} from '../../../../lib/ballers/compute';
import {PRESETS} from '../../../../lib/ballers/league';
import data from '../2026-10-03-defending-awareness/inputs/sides.json';

// Manager-lever study (2026-10-04, evidence/2026-10-04-luck-study/results/levers.md):
// MEN-only overrides on the mcb setup, selected by task.lever (undefined/'base' = unchanged):
//  striker     swap out MEN's most attacking starter (ca625ac3 Relu Ceaunu, ST,
//              finishing 10) for MEN's weakest bench player by outfield
//              average (71c996eb Vasile Tramvai: a three-way tie at 5.9 with
//              22a6ae9e and 35d13d56, broken by lowest finishing, 4).
//  boost       +2 (capped 10) to every outfield skill (all ten skills but
//              `keeping`) of MEN's five starters only; bench untouched.
//  planShort   MEN's style/approach switched from Direct to the Short
//              ("combinations") preset (lib/ballers/league.ts PRESETS), all
//              else (lineup, captain, subs) equal.
//  planTactic  MEN keeps the Direct style/plan but with Line High + Press
//              Aggressive (Direct's own line/press, standard/balanced, aren't
//              already High/Aggressive or Deep/Selective).
const MEN_STRIKER_OUT='ca625ac3-3b3a-4cef-b626-98529b11e7ed';
const MEN_WEAK_BENCH_IN='71c996eb-f643-4563-a45f-daf07bc99749';
const BOOST_SKILLS=['pace','aerial','control','passing','reading','stamina','strength','defending','finishing','setPieces'] as const;

const L=48,GH=2.5,HEIGHT=2;
const r2=(v:number)=>Number.isFinite(v)?Math.round(v*100)/100:null;
const r3=(v:number)=>Number.isFinite(v)?Math.round(v*1000)/1000:null;

function ownerInput(seed:number,opp:'mcb'|'int',duration=900,lever?:string):FrozenInput{
 const D:any=data,boost=lever==='boost';
 const players=(club:string)=>D.players.filter((p:any)=>p.club_id===club).map((p:any)=>{
  const base={id:p.id,name:p.name,short:p.short,number:p.number,roles:p.roles,skills:p.skills,traits:p.traits,energy:p.energy,archetype:p.archetype,temperament:p.temperament,note:p.note,portrait:p.portrait};
  if(boost&&club===D.men.club.id&&D.men.lineup.includes(p.id)){
   const skills={...p.skills};for(const k of BOOST_SKILLS)skills[k]=Math.min(10,skills[k]+2);
   return {...base,skills};
  }
  // finish4: the same striker, only his finishing 10 -> 4 (isolates finishing).
  if(lever==='finish4'&&p.id===MEN_STRIKER_OUT)return {...base,skills:{...p.skills,finishing:4}};
  return base;
 });
 const side=(s:any,subs?:any[]):FrozenSide=>{
  let lineup=s.lineup,style=s.style,approach=s.approach;
  if(s===D.men){
   if(lever==='striker')lineup=lineup.map((id:string)=>id===MEN_STRIKER_OUT?MEN_WEAK_BENCH_IN:id);
   else if(lever==='planShort'){style='combinations';approach=PRESETS.combinations;}
   else if(lever==='planTactic')approach={...approach,line:'high',press:'aggressive'};
  }
  return {club:s.club,formation:s.formation,style,approach,captain:s.captain,lineup,
   bench:D.players.filter((p:any)=>p.club_id===s.club.id&&!lineup.includes(p.id)).map((p:any)=>p.id),players:players(s.club.id),plans:[],...(subs?.length?{substitutions:subs}:{})} as any;
 };
 return {v:1,match:`practice-${seed.toString(36)}`,seed,kickoff:0,duration,sides:[side(D.men,D.men.substitutions),side(D[opp])]};
}
export const DVC_DESIGN=1;
export function taskInput(t:any):FrozenInput{
 const duration=t.duration??900;
 if(t.setup==='mcb'||t.setup==='int')return ownerInput(t.seed,t.setup,duration,t.lever);
 if(t.setup==='dvc')return {...input({seed:DVC_DESIGN,pair:['direct','counter'],cell:0,duration} as any),seed:t.seed};
 if(t.setup==='parity')return input({seed:t.seed,pair:t.pair,cell:t.cell,duration} as any);
 throw Error('unknown setup '+t.setup);
}

export function play(t:any){
 const inp=taskInput(t),teams=inp.sides.map(engineTeam) as any,subs=sideOrders(inp,teams);
 const t0=performance.now();
 const run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 const ms=performance.now()-t0,R:any=run.result;
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events;
 const index=new Map<string,number>(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id==null||!index.has(id)?-1:roster[index.get(id)!].side;
 const isGK=(id:any)=>id!=null&&index.has(id)&&roster[index.get(id)!].role==='GK';
 const fidx=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const poseOf=(f:any,ri:number)=>{if(!f.lineup)return f.players[ri];const k=f.lineup.indexOf(ri);return k>=0?f.players[k]:undefined;};
 const keeperIdx=[0,1].map(s=>roster.findIndex(p=>p.side===s&&p.role==='GK'));
 const shotEv=events.filter(e=>e.kind==='shot'),evIndex=new Map<any,number>(events.map((e,i)=>[e,i]));
 const goals=events.filter(e=>e.kind==='goal');
 const scored=new Set<any>();let otherGoals=[0,0];
 for(const g of goals){const s=[...shotEv].reverse().find(v=>sideOf(v.actor)===g.side&&v.time<=g.time+1e-6&&v.time>=g.time-4);if(s)scored.add(s);else otherGoals[g.side]++;}
 const CONTACT=new Set(['save','block','goal','out','receive','turnover','tackle','foul','restart','half','end','clearance','pass','shot']);
 const shots=shotEv.map((e:any)=>{
  const s=sideOf(e.actor),goalX=s===0?L:0,o=e.shot?.origin,v=e.shot?.velocity,a=e.shot?.assessment;
  const type=e.shot?.assessment?0:e.technique==='header'?1:e.technique==='volley'?2:3;
  const from=o??{x:NaN,y:NaN,z:0};
  const dist=Math.hypot(goalX-from.x,from.y);
  // the struck ball's own flight to the goal line, no contact
  let yC=NaN,zC=NaN;
  if(o&&v){const b:any={x:o.x,y:o.y,z:o.z??0,vx:v.vx,vy:v.vy,vz:v.vz,owner:null,mode:'shot'};
   for(let k=0;k<200;k++){const px=b.x,py=b.y,pz=b.z;advanceFlight(b);
    if((goalX===L&&b.x>=L)||(goalX===0&&b.x<=0)){const f=(goalX-px)/((b.x-px)||1e-9);yC=py+(b.y-py)*f;zC=pz+(b.z-pz)*f;break;}
    if(Math.hypot(b.vx,b.vy)<.5)break;}}
  const onT=Number.isFinite(yC)&&Math.abs(yC)<GH&&zC<HEIGHT?1:0;
  const f=frames[fidx(e.time)],gk=keeperIdx[1-s],kp=gk>=0?poseOf(f,gk):undefined;
  const kGap=kp&&Number.isFinite(yC)?Math.abs(yC-kp.y):NaN;
  // what met the ball first
  let first=0;
  let next:any=null;for(let k=evIndex.get(e)!+1;k<events.length;k++)if(CONTACT.has(events[k].kind)){next=events[k];break;}
  if(next){
   if(next.kind==='goal')first=4;
   else if(next.kind==='save')first=/prinde/.test(next.text??'')?1:2;
   else if(next.kind==='block')first=isGK(next.actor)?2:sideOf(next.actor)===1-s?3:5;
   else if(next.kind==='out'||next.kind==='restart'||next.kind==='half'||next.kind==='end')first=0;
   else first=sideOf(next.actor)===1-s&&isGK(next.actor)?1:5;
  }
  let angErr=NaN;
  if(type===0&&v&&o&&e.shot?.aim){const want=Math.atan2(e.shot.aim.y-o.y,e.shot.aim.x-o.x),got=Math.atan2(v.vy,v.vx);angErr=Math.atan2(Math.sin(got-want),Math.cos(got-want));}
  return [s,a?r3(a.quality):null,type,r2(dist),onT,r2(yC),r2(zC),r2(kGap),first,scored.has(e)?1:0,r2(e.time),r3(angErr)];
 });
 // keeper handling (mechanism check for the keeper patch): hands contacts and catches by each side's keeper
 const keeper=[0,1].map(s=>({catch:0,parry:0}));
 for(const e of events)if(e.kind==='save'&&isGK(e.actor)){const s=sideOf(e.actor);if(/prinde/.test(e.text??''))keeper[s].catch++;else keeper[s].parry++;}
 // pass execution (mechanism check for the pass patch): mean |actual/intended speed - 1| of ground passes
 const pe=[[0,0],[0,0]];
 for(const e of events)if(e.kind==='pass'&&e.pass&&e.pass.intendedSpeed>0){const s=sideOf(e.actor);if(s<0)continue;pe[s][0]+=Math.abs(e.pass.actualSpeed/e.pass.intendedSpeed-1);pe[s][1]++;}
 // team-in-possession seconds in open play, own passes in flight included
 const teamTime=[0,0];for(let i=1;i<frames.length;i++){const g=frames[i-1];if(!g.restart&&!frames[i].cut&&(g.side===0||g.side===1))teamTime[g.side]+=frames[i].time-g.time;}
 const st=(s:number)=>{const x=R.stats[s];return {goals:x.goals,shots:x.shots,saves:x.saves,passes:x.passes,completed:x.completed,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,feints:x.feints,beaten:x.beaten,fouls:x.fouls,possession:r2(x.possession??x.possessionSeconds)};};
 return {setup:t.setup,seed:t.seed,arm:t.arm,...(t.pair?{pair:t.pair,cell:t.cell}:{}),...(t.tag?{tag:t.tag}:{}),build:String(run.engineBuild).slice(0,8),duration:inp.duration,
  score:R.score,otherGoals,stats:[st(0),st(1)],teamTime:teamTime.map(v=>r2(v)),keeper,passErr:pe.map(([a,n])=>n?r3(a/n):null),
  q:[0,1].map(s=>r3(shots.filter(x=>x[0]===s&&x[1]!=null).reduce((a,x)=>a+(x[1] as number),0))),shots,ms:Math.round(ms)};
}
