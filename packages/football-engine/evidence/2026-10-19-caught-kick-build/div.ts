// Caught kick build (2026-10-19): the same situation, both reads. Each task plays one real-side match twice from the same
// inputs, flag off (body read) and on (ball read), through computeMatch's runMatch call. The two matches are identical
// until the first choice the two reads make differently (the flag changes nothing else); that moment is the one place
// the comparison is exact: same players, same positions, same ball, a different decision. Evidence only.
// Row: {arm, seed, t (s) of the first differing choice (null if none), first frame that differs (s), p (chooser id),
//  side, off/on: {kind, hurried, purpose (carry), target, len (m), struck (s to his release, -1 none within 2 s),
//  lost2 / lost4 (the other side in control within 2 / 4 s), lostHow ('tackle'|'loose'|'intercept'|'' ), score},
//  reads at that choice (identical picture): body caught share and ball caught share of the OFF choice's kick (-9 if not
//  a kick), exact first foot on the ball (s), nearest opponent to the ball (m), ball off his feet (m),
//  win (seed <= 3): frames t-1.2 .. t+2.5 of both matches [[t, bx, by, bz, owner index, restart, [i,x,y,vx,vy,duty]...]], ro}
import {runMatch} from '../../src/index';
import {arrivalTime} from '../../src/practice-arrival';
import * as poss from '../../src/practice-possession';
import {perceive} from '../../src/practice-perception';
import {engineTeam,sidePlans,sideOrders} from '../../../../lib/ballers/compute';
import {DUTIES} from '../2026-10-19-world-prices/analyse';

let SIDES:Record<string,any>={};
export function init(s:Record<string,any>){SIDES=s;}
const r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const clampN=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const KICK=['pass','through','loft','clear'];
export function inputOf(arm:string,seed:number):any{
 const m=/^r\.([A-Z]+)-([A-Z]+)$/.exec(arm);if(!m)throw Error('unknown arm '+arm);
 const sides=[m[1],m[2]].map(c=>{if(!SIDES[c])throw Error('unknown side '+c);const b=JSON.parse(JSON.stringify(SIDES[c]));delete b.voice;return b;});
 return {v:1,match:`audit-${arm}-${seed}`,seed,kickoff:seed%2,duration:900,sides};
}
export const armTreatment=(arm:string)=>inputOf(arm,0)&&arm;
function within(p:any,pt:any,reach:number){const d=Math.hypot(pt.x-p.x,pt.y-p.y),gap=Math.max(0,d-reach),ux=(pt.x-p.x)/(d||1),uy=(pt.y-p.y)/(d||1);
 const speed=p.pace*.94,v=clampN(p.vx*ux+p.vy*uy,-speed,speed),a=p.acceleration,acc=(speed-v)/a,cov=v*acc+.5*a*acc*acc;
 return gap<=cov?(-v+Math.sqrt(v*v+2*a*gap))/a:acc+(gap-cov)/speed;}
const footOn=(q:any,ball:any)=>Math.max(within(q,ball,2.2)+.16,within(q,ball,1.54));
function play1(inp:any,byBall:boolean){
 const flag=(poss as any).CAUGHT_KICK;if(!flag)throw Error('this revision has no CAUGHT_KICK flag');flag.byBall=byBall;
 const dec:any[]=[],g=globalThis as any;
 g.__ch=(time:number,p:any,option:any,list:any[],rk:string,players:any[],ball:any)=>{
  const opp=players.filter((q:any)=>q.side!==p.side&&q.role!=='GK');
  let reads=[-9,-9,-9,-9,-9];
  if(!rk&&ball&&opp.length){
   const body=Math.min(...opp.map((q:any)=>arrivalTime(q,p))),fb=Math.min(...opp.map((q:any)=>footOn(q,ball)));
   let bc=-9,fc=-9;
   if(KICK.includes(option.kind)){let hz=poss.readKickHorizon(p,option.aim,option.kind);if(option.hurried)hz-=(1-poss.HURRY_SHARE)*poss.preparationTime(p,option.kind);
    const sb=Math.max(0,perceive(p,'arrival',body,.3,p,{time,salt:'caught'})),sf=Math.max(0,perceive(p,'arrival',fb,.3,p,{time,salt:'caught'}));
    bc=r3(clampN((hz-sb-.16)/.3,0,1));fc=r3(clampN((hz-sf)/.3,0,1));}
   reads=[bc,fc,r3(Math.min(99,fb)),r2(Math.min(...opp.map((q:any)=>Math.hypot(q.x-ball.x,q.y-ball.y)))),r2(Math.hypot(ball.x-p.x,ball.y-p.y))];
  }
  dec.push({t:time,p:p.id,side:p.side,kind:option.kind,hurried:option.hurried?1:0,purpose:option.carry?.purpose??'',target:option.target??'',
   aim:[r2(option.aim.x),r2(option.aim.y)],len:r2(Math.hypot(option.aim.x-p.x,option.aim.y-p.y)),score:r3(option.score),rk,reads});
 };
 let r:any;
 try{
  const teams=inp.sides.map(engineTeam),plans=inp.sides.map(sidePlans);
  const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
  const subs=sideOrders(inp,teams as any);
  r=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 }finally{g.__ch=undefined;flag.byBall=true;}
 return {R:r.result,dec,build:r.engineBuild.slice(0,8)};
}
const same=(a:any,b:any)=>a.t===b.t&&a.p===b.p&&a.kind===b.kind&&a.hurried===b.hurried&&a.purpose===b.purpose&&a.target===b.target&&a.aim[0]===b.aim[0]&&a.aim[1]===b.aim[1];
function after(R:any,d:any){
 const frames=R.frames,events=R.events,roster=R.players,idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id&&idx.has(id)?roster[idx.get(id)!].side:-1;
 let struck=-1;for(const e of events){if(e.time<d.t-1e-6)continue;if(e.time>d.t+2)break;if(e.actor===d.p&&['pass','clearance','shot'].includes(e.kind)){struck=r2(e.time-d.t);break;}}
 let lost2=0,lost4=0,how='';
 for(const f of frames){if(f.time<d.t-1e-6)continue;if(f.time>d.t+4)break;if(f.restart)break;const o=f.control?.owner??f.ball?.owner??null;
  if(o&&sideOf(o)!==d.side){if(f.time<=d.t+2)lost2=1;lost4=1;break;}}
 if(lost4){for(const e of events){if(e.time<d.t-1e-6)continue;if(e.time>d.t+4)break;if(e.kind==='tackle'&&sideOf(e.actor)!==d.side){how='tackle';break;}if(e.kind==='turnover'){how='turnover';break;}}}
 return {struck,lost2,lost4,how};
}
function pack(R:any,t0:number,t1:number){
 const frames=R.frames,roster=R.players,idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const out:any[]=[];let last=-9;
 for(const f of frames){if(f.time<t0)continue;if(f.time>t1)break;if(f.time<last+.099)continue;last=f.time;const ps:any[]=[];
  for(let i=0;i<roster.length;i++){const p=pos(f,i);if(p)ps.push(i,r2(p.x),r2(p.y),r2(p.vx),r2(p.vy),DUTIES.indexOf(p.duty));}
  out.push([r2(f.time),r2(f.ball.x),r2(f.ball.y),r2(f.ball.z),f.ball.owner?idx.get(f.ball.owner)??-1:-1,f.restart?1:0,ps]);}
 return out;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 if(t.rev!=='pair')throw Error('div.ts plays both reads itself: rev must be named pair');
 const inp=inputOf(t.arm,t.seed),t0=performance.now();
 const A=play1(inp,false),B=play1(inp,true);
 let k=0;while(k<A.dec.length&&k<B.dec.length&&same(A.dec[k],B.dec[k]))k++;
 // the first frame where anything differs (a check that the first differing choice is the first difference)
 let ff:number|null=null;{const fa=A.R.frames,fb=B.R.frames,n=Math.min(fa.length,fb.length);for(let i=0;i<n;i++){if(JSON.stringify(fa[i])!==JSON.stringify(fb[i])){ff=fa[i].time;break;}}}
 const base={label:t.label,arm:t.arm,seed:t.seed,rev:t.rev,build:A.build,plat:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Math.round(performance.now()-t0),score:[A.R.score,B.R.score]};
 if(k>=A.dec.length||k>=B.dec.length)return {...base,t:null,ff};
 const a=A.dec[k],b=B.dec[k];
 const sum=(d:any,R:any)=>({kind:d.kind,hurried:d.hurried,purpose:d.purpose,target:d.target,len:d.len,score:d.score,...after(R,d)});
 const row:any={...base,t:r3(a.t),ff,p:a.p,side:a.side,rk:a.rk,sameMoment:a.t===b.t&&a.p===b.p,off:sum(a,A.R),on:sum(b,B.R),reads:a.reads};
 if(t.seed<=3){row.win={off:pack(A.R,a.t-1.2,a.t+2.5),on:pack(B.R,a.t-1.2,a.t+2.5)};row.ro=A.R.players.map((p:any)=>[p.side,p.role]);}
 return row;
}
