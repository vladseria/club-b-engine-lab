// Reading buys an earlier start (2026-10-19): one match, every open-play pass, the intended receiver's and the
// defending hunter's movement toward where the ball was first touched, around the release. Evidence only.
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders} from '../../../../lib/ballers/compute';
import {inputOf,init} from '../2026-10-19-engine-audits/audit';
export {init};
const OFF=[-.4,-.3,-.2,-.1,0,.05,.1,.15,.2,.3,.4,.6];
export function trace(arm:string,seed:number,raw=false){
 const inp=inputOf(arm,seed);
 const teams=inp.sides.map(engineTeam),plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams as any);
 const t0=performance.now();
 const run:any=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 const ms=Math.round(performance.now()-t0);
 const R=run.result,roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const at=(t:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const byP=new Map<number,any[]>();for(const c of choices){const a=byP.get(c.player)??[];a.push(c);byP.set(c.player,a);}
 const kindsBetween=(i:number,a:number,b:number)=>(byP.get(i)??[]).filter(c=>c.time>=a-1e-6&&c.time<=b+1e-6).map(c=>[Math.round(c.time*1000)/1000,c.kind]);
 const rows:any[]=[];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||e.restartKind||(e.side!==0&&e.side!==1)||!e.target)continue;
  const T=e.time;let rec:any=null;
  for(let r=q+1;r<events.length&&events[r].time<T+4;r++){const x=events[r];if(x.kind==='receive'||x.kind==='intercept'||x.kind==='turnover'){rec=x;break;}if(x.kind==='pass'||x.kind==='shot'||x.kind==='out'||x.kind==='restart')break;}
  if(!rec)continue;
  const fr=frames[at(rec.time)],meet={x:fr.ball.x,y:fr.ball.y};
  const ri=idx.get(e.target)!;
  let di=-1,dt=Infinity;
  for(const [i,a] of byP){if(roster[i].side===e.side||roster[i].role==='GK')continue;for(const c of a){if(c.time<T-.4||c.time>rec.time)continue;if(c.kind==='intercept'&&c.time<dt){dt=c.time;di=i;}}}
  const toward=(i:number,t:number)=>{const f=frames[at(t)],p=pos(f,i);if(!p)return null;const d=Math.hypot(meet.x-p.x,meet.y-p.y)||1;return Math.round(((p.vx*(meet.x-p.x)+p.vy*(meet.y-p.y))/d)*100)/100;};
  rows.push({T:Math.round(T*100)/100,flight:Math.round((rec.time-T)*100)/100,lofted:!!e.aerial,won:rec.side===e.side?1:0,by:rec.actor,
   r:{id:e.target,reading:roster[ri].skills.reading,pace:roster[ri].skills.pace,v:OFF.map(o=>toward(ri,T+o)),kinds:kindsBetween(ri,T-.5,T+.5)},
   d:di>=0?{id:roster[di].id,reading:roster[di].skills.reading,pace:roster[di].skills.pace,first:Math.round((dt-T)*1000)/1000,v:OFF.map(o=>toward(di,T+o)),kinds:kindsBetween(di,T-.5,T+.5)}:null});
 }
 return {arm,seed,build:run.engineBuild.slice(0,8),ms,score:R.score,offsets:OFF,rows,...(raw?{raw:{players:roster.map((p:any)=>({id:p.id,name:p.name,side:p.side,role:p.role,skills:p.skills})),frames,events,choices}}:{})};
}
