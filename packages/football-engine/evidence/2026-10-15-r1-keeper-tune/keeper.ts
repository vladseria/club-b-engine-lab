// R1 keeper tune (2026-10-15): copied from ../2026-10-14-r1-keeper/keeper.ts (branch ballers-r1-keeper) with one addition:
// per side `won`, the turnover incidents that side won (a ball taken off the other side in play). Evidence only.
// Original header follows.
// R1 keeper (2026-10-14): the keeper with the ball at his feet. Evidence only.
// One mirror match (../2026-10-10-cloud-measure/mirror.ts inputOf) through the runMatch call computeMatch makes, with
// BOTH keepers' keeperSweep set to the task's `sweep`, recorded and read for every spell the keeper has the ball at
// his feet (frame.control, live play):
//   dur s, disp m (start to end), path m (his own movement), end depth from his goal line / |y|, from goal m
//   begin  back (a team-mate's pass to him) | other
//   end    pass | loft | clear | lost (taken off him / a restart for them, no release)
//   given  his release's first owner was theirs (or a restart for them) within 6 s
//   goal8  a goal against within 8 s of losing it (lost or given)
//   carries  how many carry decisions he took in the spell, and their reason texts
// plus per side: passes to the keeper, goal kicks, long balls (ground or lofted, >= 20 m), lofts, goals.
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders} from '../../../../lib/ballers/compute';
import {inputOf as mirrorInput} from '../2026-10-10-cloud-measure/mirror';

const r1=(v:number)=>Math.round(v*10)/10;
const L=48;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

export function inputFor(arm:string,seed:number,sweep:number){
 const inp:any=mirrorInput(arm,seed);
 for(const s of inp.sides)for(const p of s.players)if(p.roles.includes('GK'))p.traits={...p.traits,keeperSweep:sweep};
 return inp;
}
export function run(inp:any,record=true){
 const teams=inp.sides.map(engineTeam);
 const plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams);
 return runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record,
  ...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
}

export function analyse(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const depthOf=(s:number,x:number)=>s===0?x:L-x;
 const goals=events.filter((e:any)=>e.kind==='goal');
 const spells:any[]=[];
 for(const [ki,K] of roster.entries()){
  if(K.role!=='GK')continue;const S=K.side;
  const feet=(f:any)=>f.ball.owner===K.id&&!f.restart&&!!f.control;
  for(let k=0;k<frames.length;k++){
   if(!feet(frames[k])||(k>0&&feet(frames[k-1])))continue;
   let j=k;while(j+1<frames.length&&feet(frames[j+1]))j++;
   const t0=frames[k].time,t1=j+1<frames.length?frames[j+1].time:frames[j].time;
   const a=pos(frames[k],ki),b=pos(frames[j],ki);if(!a||!b){k=j;continue;}
   let path=0,maxY=Math.abs(a.y),maxD=depthOf(S,a.x);for(let q=k+1;q<=j;q++){const u=pos(frames[q-1],ki),v=pos(frames[q],ki);if(u&&v)path+=dist(u,v);if(v){maxY=Math.max(maxY,Math.abs(v.y));maxD=Math.max(maxD,depthOf(S,v.x));}}
   let begin='other';for(let e=events.length-1;e>=0;e--){const x=events[e];if(x.time>t0+1e-6)continue;if(x.time<t0-5)break;if(x.kind==='pass'||x.kind==='clearance'){begin=x.actor!==K.id&&sideOf(x.actor)===S?'back':'other';break;}if(x.kind==='restart'||x.kind==='save'||x.kind==='turnover'||x.kind==='tackle')break;}
   let rel:any=null;for(const x of events){if(x.time<t0-1e-6)continue;if(x.time>t1+1e-6)break;if(x.actor===K.id&&(x.kind==='pass'||x.kind==='clearance'||x.kind==='shot'))rel=x;}
   let end='other',tLoss=-1;
   if(rel){end=rel.kind==='clearance'?'clear':rel.aerial?'loft':'pass';
    for(let q=j+1;q<frames.length&&frames[q].time<=rel.time+6;q++){const g=frames[q];if(g.restart){if(g.restartInfo&&g.restartInfo.side!==S)tLoss=g.time;break;}const o=g.ball.owner;if(!o||o===K.id)continue;if(sideOf(o)!==S)tLoss=g.time;break;}
   }else{const nx=frames[j+1];
    if(nx&&((nx.restart&&nx.restartInfo&&nx.restartInfo.side!==S)||(nx.ball.owner&&sideOf(nx.ball.owner)!==S))){end='lost';tLoss=nx.time;}
    else if(nx&&!nx.ball.owner&&!nx.restart){for(let q=j+1;q<frames.length&&frames[q].time<=t1+3;q++){const g=frames[q];if(g.restart){if(g.restartInfo?.side!==S){end='lost';tLoss=g.time;}break;}const o=g.ball.owner;if(!o)continue;if(sideOf(o)!==S){end='lost';tLoss=g.time;}break;}}
   }
   const goal8=tLoss>=0&&goals.some((g:any)=>g.side===1-S&&g.time>=tLoss-1e-6&&g.time<=tLoss+8)?1:0;
   const cs=choices.filter((c:any)=>c.player===ki&&c.time>=t0-1e-6&&c.time<=t1+1e-6&&c.action==='carry');
   const ed=depthOf(S,b.x);
   spells.push({s:S,t:r1(t0),dur:Math.round((t1-t0)*100)/100,disp:r1(dist(a,b)),path:r1(path),sd:r1(depthOf(S,a.x)),sy:r1(a.y),ed:r1(ed),ey:r1(b.y),maxY:r1(maxY),maxD:r1(maxD),
    fromGoal:r1(Math.hypot(ed,b.y)),begin,end,given:rel&&tLoss>=0?1:0,goal8,carries:cs.length,why:[...new Set(cs.map((c:any)=>c.reason))]});
   k=j;
  }
 }
 const per=[0,1].map(()=>({toGK:0,goalKicks:0,long:0,lofts:0,passes:0,goals:0,won:0}));
 const fi=(t:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi)>>1;if(frames[m].time<t)lo=m+1;else hi=m;}return lo;};
 for(const e of events){
  if(e.kind==='goal'&&(e.side===0||e.side===1))per[e.side].goals++;
  if(e.kind==='turnover'&&(e.side===0||e.side===1))per[e.side].won++;
  if(e.kind==='restart'&&e.restartKind==='goalKick'&&(e.side===0||e.side===1))per[e.side].goalKicks++;
  if(e.kind==='pass'){const s=sideOf(e.actor);if(s<0)continue;per[s].passes++;
   if(e.target&&roster[idx.get(e.target)!]?.role==='GK'&&sideOf(e.target)===s)per[s].toGK++;
   if(e.aerial)per[s].lofts++;
   const aim=e.pass?.aim??e.aerial?.aim,f=frames[fi(e.time)],q=f&&pos(f,idx.get(e.actor)!);
   if(aim&&q&&dist(q,aim)>=20)per[s].long++;}
 }
 return {spells,per};
}

export function play(t:{label:string;arm:string;seed:number;rev:string;sweep:number}){
 const inp=inputFor(t.arm,t.seed,t.sweep),t0=performance.now();
 const r:any=run(inp);
 const ms=Math.round(performance.now()-t0);
 const R=r.result,{spells,per}=analyse(R);
 return {label:t.label,arm:t.arm,seed:t.seed,sweep:t.sweep,rev:t.rev,build:String(r.engineBuild).slice(0,8),plat:`${process.platform}-${process.arch}`,score:R.score,per,spells,ms};
}
