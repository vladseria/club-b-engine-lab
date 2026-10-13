// Keeper 2 (2026-10-13): copied unchanged from ../2026-10-13-keeper-fix (branch ballers-keeper-fix).
// Keeper fix (2026-10-13): the keeper-giveaway study's harness (../2026-10-13-keeper-giveaway on branch
// ballers-keeper-giveaway, copied unchanged) plus per-side lights (shots, clear chances, turnovers, tackles,
// possession spells) for base v fix. Evidence only.
//
// Keeper giveaway study (2026-10-13): does the keeper lose the ball and concede straight after? Evidence only.
//
// One match per task through EXACTLY the runMatch call computeMatch makes (lib/ballers/compute.ts: plans as
// playbooks, substitution orders, coordinated, record:true), either a neutral mirror arm
// (../2026-10-10-cloud-measure/mirror.ts inputOf) or a frozen real-club scenario (../2026-10-09-scenarios/match.ts
// inputOf; sides handed over by run.mjs). The recorded result is read for every keeper possession:
//   start   save | back (a team-mate's pass) | restart:<kind> (he took it) | loose (anything else)
//   hands   he held it in his hands (no foot control) for any of it
//   held    seconds from his first frame on the ball to his release (or loss)
//   release pass | loft | clear | none (lost on his feet: a tackle took it, type c)
//   outcome a = his release went straight to an opponent (first owner theirs, or a restart for them)
//           b = a team-mate got it and lost it to an opponent before releasing it himself (within 6 s)
//           c = taken off him (no release event)
//           kept = otherwise
//   loss -> opponent shots / goals within 8 s of the opponent getting the ball
// plus, at the release, the nearest opponent to the keeper and to the receiver, and that opponent's job.
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders} from '../../../../lib/ballers/compute';
import {inputOf as mirrorInput,armTreatment} from '../2026-10-10-cloud-measure/mirror';
import {inputOf as scenarioInput,init as scenarioInit} from '../2026-10-09-scenarios/match';
import {shotChance} from '../../../../lib/ballers/chances';
export {armTreatment,scenarioInit};

const r1=(v:number)=>Math.round(v*10)/10;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

function run(inp:any){
 const teams=inp.sides.map(engineTeam);
 const plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams);
 return runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,
  ...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
}

export function analyse(R:any,detail=false,decides:any[]=[]){
 const roster:{id:string;side:number;role:string;name?:string}[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const jobsBy=new Map<number,any[]>();
 for(const ch of choices){const a=jobsBy.get(ch.player)??[];a.push(ch);jobsBy.set(ch.player,a);}
 const jobAt=(i:number,time:number)=>{const a=jobsBy.get(i);if(!a)return null;let lo=0,hi=a.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}
  const ch=best>=0?a[best]:null;return ch?(ch.assignment?.purpose??ch.kind):null;};
 const ownerAt=(k:number)=>frames[k].ball?.owner??null;
 const keepers=roster.map((p,i)=>({p,i})).filter(x=>x.p.role==='GK');
 const out:any[]=[];
 for(const {p:K,i:ki} of keepers){
  const S=K.side;
  for(let k=0;k<n;k++){
   if(ownerAt(k)!==K.id||(k>0&&ownerAt(k-1)===K.id))continue;
   let j=k;while(j+1<n&&ownerAt(j+1)===K.id)j++;
   const f0=frames[k],t0=f0.time,tEnd=j+1<n?frames[j+1].time:frames[j].time;
   // how it began
   let start='loose';
   if(f0.restart&&f0.restartInfo?.taker===K.id)start='restart:'+f0.restartInfo.kind;
   else for(let e=events.length-1;e>=0;e--){const x=events[e];if(x.time>t0+1e-6)continue;if(x.time<t0-.25)break;
    if(x.actor===K.id&&x.kind==='save'){start='save';break;}
    if(x.actor===K.id&&x.kind==='receive'){start='receive';break;}
    if(x.actor===K.id&&x.kind==='turnover'){start='loose';break;}}
   if(start==='receive'){start='loose';for(let e=events.length-1;e>=0;e--){const x=events[e];if(x.time>t0+1e-6)continue;if(x.time<t0-6)break;if(x.kind==='pass'){start=sideOf(x.actor)===S&&x.actor!==K.id?'back':'loose';break;}}}
   if(start==='loose'&&f0.restart)start='restart:'+(f0.restartInfo?.kind??'?');
   let hands=0,restartFrames=0;for(let q=k;q<=j;q++){const g=frames[q];if(g.restart){restartFrames++;continue;}if(!g.control)hands=1;}
   // the release in [t0, tEnd]
   let rel:any=null;for(const x of events){if(x.time<t0-1e-6)continue;if(x.time>tEnd+1e-6)break;if(x.actor===K.id&&(x.kind==='pass'||x.kind==='clearance'||x.kind==='shot')){rel=x;}}
   let tackled=false;for(const x of events){if(x.time<t0-1e-6)continue;if(x.time>tEnd+.2)break;if(x.kind==='tackle'&&x.target===K.id&&sideOf(x.actor)!==S&&!rel)tackled=true;}
   const tRel=rel?rel.time:tEnd;
   const release=rel?(rel.kind==='clearance'?'clear':rel.aerial?'loft':'pass'):'none';
   const live=!(restartFrames===j-k+1);
   // the keeper's own-half time with the ball (live play only; restart frames excluded)
   let ownHalf=0;{let first=-1;for(let q=k;q<=j;q++){const g=frames[q];if(g.restart)continue;first=g.time;break;}if(first>=0)ownHalf=tRel-first;}
   const fr=frames[frameAt(tRel)],kp=pos(fr,ki);
   const opps=roster.map((p,i)=>({p,i})).filter(x=>x.p.side!==S&&x.p.role!=='GK').map(x=>({...x,q:pos(fr,x.i)})).filter(x=>x.q);
   let near=99,nearJob:any=null,nearI=-1;if(kp)for(const o of opps){const d=dist(kp,o.q);if(d<near){near=d;nearI=o.i;}}
   if(nearI>=0)nearJob=jobAt(nearI,tRel);
   // (keeper fix) his nearest outfield team-mate at the release, and how many are within 12 m (a short throw on)
   let mate=99,mates12=0;if(kp)for(const x of roster.map((p,i)=>({p,i})).filter(x=>x.p.side===S&&x.p.role!=='GK')){const q=pos(fr,x.i);if(!q)continue;const d=dist(kp,q);mate=Math.min(mate,d);if(d<12)mates12++;}
   // after the release: who has it next
   let outcome='kept',tLoss=-1,firstOwner:any=null,recvNear=-1,lossBy:any=null;
   if(!rel&&!tackled){
    // no release and no tackle: a restart (foul, out), half-time or end
    const nx=frames[j+1];if(nx&&nx.restart&&nx.restartInfo&&nx.restartInfo.side!==S){outcome='c';tLoss=nx.time;}
    else if(nx&&ownerAt(j+1)&&sideOf(ownerAt(j+1))!==S){outcome='c';tLoss=nx.time;lossBy=ownerAt(j+1);}
    else outcome='other';
   }else if(tackled){outcome='c';tLoss=tEnd;
    for(let q=j+1;q<n&&frames[q].time<=tEnd+4;q++){const o=ownerAt(q);if(frames[q].restart)break;if(o){lossBy=o;tLoss=frames[q].time;if(sideOf(o)===S){outcome='c-back';}break;}}
   }else if(rel.kind!=='shot'){
    let q=frameAt(tRel)+1;
    for(;q<n&&frames[q].time<=tRel+6;q++){const g=frames[q];
     if(g.restart){if(g.restartInfo&&g.restartInfo.side!==S){outcome='a-out';tLoss=g.time;}break;}
     const o=ownerAt(q);if(!o||o===K.id)continue;
     firstOwner=o;
     if(sideOf(o)!==S){outcome='a';tLoss=g.time;lossBy=o;}
     break;}
    if(firstOwner&&sideOf(firstOwner)===S){
     const ri=idx.get(firstOwner)!,rq=pos(frames[q],ri);
     if(rq)recvNear=r1(Math.min(...roster.map((p,i)=>({p,i})).filter(x=>x.p.side!==S&&x.p.role!=='GK').map(x=>pos(frames[q],x.i)).filter(Boolean).map((z:any)=>dist(rq,z))));
     const tr=frames[q].time;let released=false;
     for(const x of events){if(x.time<tr-1e-6)continue;if(x.time>tr+6)break;if(x.actor===firstOwner&&(x.kind==='pass'||x.kind==='clearance'||x.kind==='shot')){released=true;break;}}
     // lost before his release: the first frame within 6 s owned by the other side (or a restart for them) before his release
     let relT=Infinity;for(const x of events){if(x.time<tr-1e-6)continue;if(x.time>tr+6)break;if(x.actor===firstOwner&&(x.kind==='pass'||x.kind==='clearance'||x.kind==='shot')){relT=x.time;break;}}
     for(let z=q;z<n&&frames[z].time<=Math.min(tr+6,relT);z++){const g=frames[z];
      if(g.restart){if(g.restartInfo&&g.restartInfo.side!==S){outcome='b';tLoss=g.time;}break;}
      const o=ownerAt(z);if(o&&sideOf(o)!==S){outcome='b';tLoss=g.time;lossBy=o;break;}}
     void released;
    }
   }else outcome='shot';
   // what followed the loss
   let shots8=0,goal8=0,goalT=-1;
   if(tLoss>=0)for(const x of events){if(x.time<tLoss-1e-6)continue;if(x.time>tLoss+8)break;if(x.side!==1-S&&sideOf(x.actor)!==1-S)continue;
    if(x.kind==='shot')shots8++;if(x.kind==='goal'&&x.side===1-S){goal8++;goalT=x.time;}}
   // the man who took it: his job at the loss and his distance to the keeper at the release
   let lossJob:any=null,lossToK=-1;
   if(lossBy&&idx.has(lossBy)){lossJob=jobAt(idx.get(lossBy)!,tRel);const lq=pos(fr,idx.get(lossBy)!);if(lq&&kp)lossToK=r1(dist(lq,kp));}
   const row:any={s:S,t:r1(t0),rel:r1(tRel),start,hands,held:r1(tRel-t0),own:r1(ownHalf),live:live?1:0,release,len:rel?.pass?.aim&&kp?r1(dist(kp,rel.pass.aim)):rel?.aerial?.aim&&kp?r1(dist(kp,rel.aerial.aim)):-1,
    near:r1(near),nearJob,mate:r1(mate),mates12,outcome,loss:tLoss>=0?r1(tLoss):-1,lossToK,lossJob,recvNear,shots8,goal8,kx:kp?r1(S===0?kp.x:48-kp.x):-1};
   if(detail)row.goalT=goalT;
   // (hook bundles) the aim he chose v the aim he played: his last choice before the release
   if(decides.length&&rel&&rel.kind!=='shot'){const ea=rel.pass?.aim??rel.aerial?.aim;let d:any=null;for(const x of decides){if(x.id!==K.id||x.time>rel.time+1e-6)continue;if(x.time<t0-1e-6)continue;d=x;}
    if(d&&ea){row.div=r1(dist(d.aim,ea));row.dk=d.kind;row.dh=d.hands?1:0;row.dt=r1(rel.time-d.time);}}
   // a restart's whole wait: from the first frame of the restart to his release
   if(f0.restart){let z=k;while(z>0&&frames[z-1].restart)z--;row.rw=r1(tRel-frames[z].time);}
   out.push(row);
   k=j;
  }
 }
 return out;
}

export function play(t:any){
 const inp=t.scenario?scenarioInput(t):mirrorInput(t.arm,t.seed);
 const t0=performance.now();
 const decides:any[]=[];(globalThis as any).__kgDecide=(time:number,id:string,o:any,hands:boolean,restart:string|null)=>{decides.push({time,id,kind:o.kind,aim:{x:o.aim.x,y:o.aim.y},hands,restart});};
 let r:any;try{r=run(inp);}finally{(globalThis as any).__kgDecide=undefined;}
 const R=r.result;
 const ms=Math.round(performance.now()-t0);
 const goals=R.events.filter((e:any)=>e.kind==='goal').map((e:any)=>[e.side,r1(e.time)]);
 // lights per side: shots, clear chances (the live chance table's rate of the engine's read >= 0.3; headers, volleys and
 // direct free kicks by their kind), turnovers, tackles, passes, possession seconds and spells (a spell starts when the
 // owner's side changes; loose frames and restarts do not end one)
 const sideOfId=new Map(R.players.map((p:any)=>[p.id,p.side]));
 const shotSide=(e:any)=>e.side===0||e.side===1?e.side:sideOfId.get(e.actor);
 const shots=R.events.filter((e:any)=>e.kind==='shot');
 const chance=(e:any)=>shotChance({q:e.shot?.assessment?.quality,sk:e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined} as any)??0;
 const spells=[0,0];let last=-1;for(const f of R.frames){const o=f.ball?.owner;if(!o)continue;const s=sideOfId.get(o) as number;if(s!==last){spells[s]++;last=s;}}
 const lights=[0,1].map(s=>({shots:shots.filter((e:any)=>shotSide(e)===s).length,clear:shots.filter((e:any)=>shotSide(e)===s&&chance(e)>=.3).length,
  turnovers:R.stats[s].turnovers,tackles:R.stats[s].tackles,passes:R.stats[s].passes,poss:r1(R.stats[s].possession),spells:spells[s]}));
 return {label:t.label,arm:t.arm,scenario:t.scenario??null,opp:t.opp??null,seed:t.seed,rev:t.rev,build:r.engineBuild.slice(0,8),plat:`${process.platform}-${process.arch}-node${process.versions.node}`,
  score:R.score,goals,lights,kp:analyse(R,false,decides),ms};
}
