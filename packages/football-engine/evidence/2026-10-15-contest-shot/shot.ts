// Contest: pressure on the shooter (2026-10-15). The deep-study row (../2026-10-12-deep-study/deep.ts, unchanged
// official fields and agg) plus `st`, per side: one row per shot with the pressure on it, and the carrier's choices in
// shooting range by pressure. Evidence only; reads the recorded match, changes nothing.
//
// st[side].shots: one entry per shot by that side, in event order:
//  [t, dist to goal (m), |y|, nearest outfield defender (m), his closing speed towards the shooter (m/s, + = closing),
//   lane (min perpendicular gap of an outfield defender's body to the shot line, ball -> where it crosses the goal
//   line, for defenders 0.3..9 m along it; 99 none), band (2 body in the lane: outfield bodies 0.3-6 m from the ball
//   hide >= SHADOW of the goal mouth's angle from it; else 1 man < 2 m; else 0 free), outcome (g goal | s save | b block | o off/out | x other), crossing y (m; the
//   straight line of the strike to the goal line), keeper y at the strike, keeper's depth off his line, |crossing -
//   keeper y|, shot speed (m/s), vz, firstTime, technique (h header | v volley | f foot), held (s since he got it, -1
//   unknown), engine assessment pressure, free kick, shadow (share of the goal's angle hidden by bodies, BODY m either
//   side of each, 0.3-6 m from the ball), and on engines that record it (2026-10-15 contest) the engine's own contest
//   at the strike: rush, shadow, balance, hurry]
// st[side].dec[band]: owner decisions within 14.6 m of goal depth and |y| < 10.6, band by the nearest outfield
//   defender at the choice (0 >= 4 m, 1 2-4 m, 2 < 2 m): [n, shoot, pass/through/loft, carry, feint, other]
// st[side].cut: cutback passes (the engine's 'întoarce mingea din lateral' delivery)
import {play as deepPlay,armTreatment as deepArm} from '../2026-10-12-deep-study/deep';
import {runMatch} from '../../src/index';
import {engineTeam} from '../../../../lib/ballers/compute';
import {inputOf} from '../2026-10-10-cloud-measure/mirror';
// Temperament arms (the personality check): tm-<a><f>v<b><g>, the mirror's arm with the treated side's four outfielders
// COMPOSED (discipline 0.97) and the other side's NERVOUS (discipline 0.45); every other skill and trait the mirror's.
// Composure = 0.55 discipline + 0.45 reading (practice-perception), so 0.80 v 0.52. Played through the same runMatch call
// as the deep study (coordinated, no subs, record), but the row carries only score, ours and st (no deep agg).
export const COMPOSED=.97,NERVOUS=.45;
export function armTreatment(arm:string){return deepArm(arm.startsWith('tm-')?arm.slice(3):arm);}

const L=48,GH=2.5,BODY=.45,SHADOW=.3;
const r2=(v:number)=>Math.round(v*100)/100;
const depth=(s:number,x:number)=>s===0?x:L-x;
export function extra(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const st=[0,1].map(()=>({shots:[] as any[],dec:[0,1,2].map(()=>[0,0,0,0,0,0]),cut:0}));
 const OUT=new Set(['goal','save','block','out','receive','turnover','restart','tackle','pass','clearance','shot']);
 for(let q=0;q<events.length;q++){
  const e=events[q];
  if(e.kind==='pass'&&/întoarce mingea din lateral/.test(e.text??'')){const s=sideOf(e.actor);if(s>=0)st[s].cut++;}
  if(e.kind!=='shot'||!e.shot)continue;
  const S=sideOf(e.actor);if(S<0)continue;
  const f=frames[frameAt(e.time)],si=idx.get(e.actor)!,sh=pos(f,si)??{x:e.shot.origin.x,y:e.shot.origin.y,vx:0,vy:0};
  const o=e.shot.origin,v=e.shot.velocity,goalX=S===0?L:0;
  const crossY=Math.abs(v.vx)>.05?o.y+v.vy/v.vx*(goalX-o.x):99*Math.sign(v.vy||1);
  const dx=goalX-o.x,dy=crossY-o.y,len=Math.hypot(dx,dy)||1;
  let near=99,closing=0,lane=99,kY=0,kD=0;const cover:[number,number][]=[];
  const aL=Math.atan2(-GH-o.y,goalX-o.x),aR=Math.atan2(GH-o.y,goalX-o.x),lo=Math.min(aL,aR),hi=Math.max(aL,aR);
  roster.forEach((p:any,i:number)=>{
   if(p.side===S)return;const d=pos(f,i);if(!d)return;
   if(p.role==='GK'){kY=d.y;kD=depth(1-S,d.x);return;}
   const r=Math.hypot(d.x-sh.x,d.y-sh.y);
   if(r<near){near=r;closing=r>.01?-((d.vx-(sh.vx??0))*(d.x-sh.x)+(d.vy-(sh.vy??0))*(d.y-sh.y))/r:0;}
   const along=((d.x-o.x)*dx+(d.y-o.y)*dy)/len;
   if(along>.3&&along<Math.min(9,len))lane=Math.min(lane,Math.abs((d.x-o.x)*dy-(d.y-o.y)*dx)/len);
   // the goal he hides from the ball: his body (BODY m either side) within 0.3-6 m of the ball, towards goal
   const rb=Math.hypot(d.x-o.x,d.y-o.y);
   if(rb>.3&&rb<6&&(d.x-o.x)*(goalX-o.x)>0){const c=Math.atan2(d.y-o.y,d.x-o.x),w=Math.atan(BODY/rb);const a=Math.max(lo,c-w),b=Math.min(hi,c+w);if(b>a)cover.push([a,b]);}
  });
  cover.sort((a,b)=>a[0]-b[0]);let hid=0,end=-9;for(const [a,b] of cover){const s0=Math.max(a,end);if(b>s0)hid+=b-s0;end=Math.max(end,b);}
  const shadow=hi>lo?hid/(hi-lo):0;
  const band=shadow>=SHADOW?2:near<2?1:0;
  let out='x';
  for(let r=q+1;r<events.length;r++){const x=events[r];if(!OUT.has(x.kind))continue;
   out=x.kind==='goal'?'g':x.kind==='save'?'s':x.kind==='block'?'b':x.kind==='out'?'o':'x';break;}
  let held=-1;for(let r=q-1;r>=0&&events[r].time>e.time-15;r--){const x=events[r];if(x.actor===e.actor&&(x.kind==='receive'||x.kind==='turnover'||x.kind==='save'||x.kind==='restart')){held=r2(e.time-x.time);break;}if(x.kind==='pass'||x.kind==='shot'||x.kind==='clearance')break;}
  st[S].shots.push([r2(e.time),r2(Math.hypot(goalX-o.x,o.y)),r2(Math.abs(o.y)),r2(near),r2(closing),r2(lane),band,out,r2(crossY),r2(kY),r2(kD),r2(Math.abs(crossY-kY)),
   r2(Math.hypot(v.vx,v.vy)),r2(v.vz),e.firstTime?1:0,e.technique==='header'?'h':e.technique==='volley'?'v':'f',held,r2(e.shot.assessment?.pressure??-1),e.freeKick?1:0,r2(shadow),...(e.shot.contest?[r2(e.shot.contest.rush),r2(e.shot.contest.shadow),r2(e.shot.contest.balance),r2(e.shot.contest.hurry)]:[])]);
 }
 for(const c of choices){
  if(!c.action)continue;const p=roster[c.player];if(!p||p.role==='GK')continue;
  const f=frames[frameAt(c.time)];if(f.restart||f.ball?.owner!==p.id)continue;
  const me=pos(f,c.player);if(!me)continue;
  if(depth(p.side,me.x)<L*73/105||Math.abs(me.y)>30*24/68)continue;
  let near=99;roster.forEach((q:any,i:number)=>{if(q.side===p.side||q.role==='GK')return;const d=pos(f,i);if(d)near=Math.min(near,Math.hypot(d.x-me.x,d.y-me.y));});
  const b=near<2?2:near<4?1:0,a=st[p.side].dec[b];a[0]++;
  a[c.action==='shoot'?1:['pass','through','loft'].includes(c.action)?2:c.action==='carry'?3:c.action==='feint'?4:5]++;
 }
 return st;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 if(!t.arm.startsWith('tm-'))return deepPlay(t,R=>extra(R));
 const inp:any=inputOf(t.arm.slice(3),t.seed),treated=t.seed%2;
 inp.sides.forEach((sd:any,i:number)=>{for(const p of sd.players)if(!p.roles.includes('GK'))p.traits={...p.traits,discipline:i===treated?COMPOSED:NERVOUS};});
 const t0=performance.now();
 const run:any=runMatch({fixture:{teams:inp.sides.map(engineTeam),seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true} as any);
 const R=run.result;
 return {label:t.label,kind:'tm',arm:t.arm,seed:t.seed,rev:t.rev,ours:treated,duration:inp.duration,build:run.engineBuild.slice(0,8),score:R.score,dropped:[],ms:Math.round(performance.now()-t0),st:extra(R)};
}
