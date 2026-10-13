// Keeper 2 (2026-10-13): copied unchanged from ../2026-10-13-accuracy-probe (branch ballers-accuracy-probe, d2e7f8ea; rr.mjs was its run.mjs).
// Accuracy probe / safety check (2026-10-13): the settings audit's row (../2026-10-13-settings-audit/audit.ts: the
// deep-study row + st) plus `sh`, one entry per shot with the situation it came from, and `aer`, the long-ball and
// aerial-contest counts (the per-shot / per-long-ball lists agg[side].x.mv, x.lr, x.pl are dropped from the row to keep
// it small; `aer` keeps what the analysis reads from them). Evidence only: reads the record, changes nothing.
//
// sh entries: [0 side (shooter), 1 shot index in the match (order of the official row's `shots`), 2 outcome
//  (g goal | s saved | b blocked by an outfielder | o other: off target, post, out), 3 distance to goal centre (m),
//  4 |y| (m), 5 nearest outfield defender to the shooter (m), 6 outfield defenders inside the ball-posts triangle,
//  7 keeper depth off his line (m), 8 keeper speed (m/s), 9 keeper facing the ball (cos), 10 keeper's distance from
//  his ready spot (keeperPosition) (m), 11 shooter speed (m/s), 12 angle between his running direction and the shot
//  (deg; -1 standing), 13 first time, 14 technique (0 foot, 1 header, 2 volley), 15 spell start (r:<restart kind> |
//  regain how: tackle intercept intercept-loft loose keeper block clearance shot-loose), 16 spell start depth from the
//  shooter's own goal (m), 17 s from spell start to the shot, 18 passes by the shooter's side in the spell before the
//  shot, 19 the defending side's previous spell: duration (s; -1 none), 20 its passes, 21 its start (as 15), 22 it
//  ended with a shot of theirs (1/0), 23 rest-defence deficit at the shot (restDefence from the DEFENDING side: the
//  shooter's outfielders goal-side of the ball + 1 - defenders goal-side of it), 24 the same at the spell start +0.5 s,
//  25 defending outfielders goal-side of the ball at the shot, 26 the shooter's deviation read (assessShot().deviation,
//  base formula; -1 for headers/volleys/free kicks)]
// aer[side]: [open-play long balls played (lofted or ground 15 m+, gaining 5 m+: deep.ts x.long[0]), lofted ones,
//  lofted with an opposing outfielder within 1.5 m of the target at arrival (aerial contests), long balls whose first
//  touch was ours (clean or after a loose ball)]
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {extra as auditExtra} from '../2026-10-13-settings-audit/audit';
import {restDefence} from '../../src/practice-rest-defence';
import {keeperPosition} from '../../src/practice-football';
export {armTreatment};

const L=48,GH=2.5;
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

function shots(R:any){
 const roster:{id:string;side:number;role:string;skills?:any}[]=R.players,frames:any[]=R.frames,events:any[]=R.events;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const evIdxAt=(time:number)=>{let lo=0,hi=events.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(events[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best;};
 const out=(s:number)=>roster.map((p,i)=>({i,p})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i);
 const gkOf=[0,1].map(s=>roster.findIndex(p=>p.side===s&&p.role==='GK'));
 // possession per frame and spells, exactly as deep.ts
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 type Spell={side:number;k0:number;k1:number;t0:number;t1:number;how:string;startDepth:number};
 const spells:Spell[]=[];
 for(let k=0;k<n;){
  const s=poss[k];let j=k;while(j+1<n&&poss[j+1]===s)j++;
  if(s>=0){
   const f=frames[k],st0=f.time;let how='loose';
   if(f.restart&&f.restartInfo)how='r:'+f.restartInfo.kind;
   else if(k===0)how='r:kickoff';
   else{
    const prevT=spells.length?spells[spells.length-1].t0:0;
    for(let e=evIdxAt(st0);e>=0&&events[e].time>=prevT-1e-6&&events[e].time>st0-3;e--){
     const ev=events[e],es=ev.side;
     if(ev.kind==='save'&&es===s){how='keeper';break;}
     if(ev.kind==='tackle'&&es===s&&st0-ev.time<2){how='tackle';break;}
     if(ev.kind==='block'&&es===s){how='block';break;}
     if(es===1-s&&(ev.kind==='pass'||ev.kind==='clearance'||ev.kind==='shot')){how=ev.kind==='pass'?(ev.aerial?'intercept-loft':'intercept'):ev.kind==='clearance'?'clearance':'shot-loose';break;}
    }
   }
   spells.push({side:s,k0:k,k1:j,t0:st0,t1:frames[j].time,how,startDepth:depth(s,frames[k].ball.x)});
  }
  k=j+1;
 }
 const spellIdxAt=(time:number)=>{for(let q=spells.length-1;q>=0;q--)if(spells[q].t0<=time+1e-6)return q;return -1;};
 const passesBy=(s:number,from:number,to:number)=>{let c=0;for(let r=Math.max(0,evIdxAt(from));r<events.length&&events[r].time<to-1e-6;r++){const x=events[r];if(x.kind==='pass'&&x.side===s&&x.time>=from-1e-6)c++;}return c;};
 const shotEv=events.filter(e=>e.kind==='shot'&&(e.side===0||e.side===1));
 const scoredT=new Set<number>();
 for(const g of events)if(g.kind==='goal'&&(g.side===0||g.side===1)){for(let k=shotEv.length-1;k>=0;k--){const x=shotEv[k];if(x.time>g.time+1e-6)continue;if(x.time<g.time-4)break;if(x.side===g.side){scoredT.add(x.time);break;}}}
 const deficitAt=(f:any,D:number)=>{
  const bodies:any[]=[];for(let i=0;i<roster.length;i++){const q=pos(f,i);if(q)bodies.push({id:roster[i].id,side:roster[i].side,role:roster[i].role,x:q.x,y:q.y});}
  return restDefence({id:'__probe',side:D,role:'CB',x:f.ball.x,y:f.ball.y},bodies,f.ball);
 };
 const rows:any[]=[];
 shotEv.forEach((e,ix)=>{
  const S=e.side,D=1-S,ks=frameAt(e.time),f=frames[ks],si=idx.get(e.actor),sq=si!==undefined?pos(f,si):null;
  const ball=e.shot?.origin??f.ball;
  // outcome
  let oc='o';
  if(scoredT.has(e.time))oc='g';
  else for(let r=evIdxAt(e.time)+1;r<events.length&&events[r].time<=e.time+4;r++){const x=events[r];
   if(x.kind==='save'&&x.side===D){oc='s';break;}
   if(x.kind==='block'&&x.side===D){oc='b';break;}
   if(x.kind==='shot'||x.kind==='pass'||x.kind==='restart'||x.kind==='out'||x.kind==='goal')break;}
  const gx=S===0?L:0,dGoal=Math.hypot(gx-ball.x,ball.y);
  const defs=out(D).map(i=>pos(f,i)).filter(Boolean);
  const near=defs.length?Math.min(...defs.map((q:any)=>dist(q,ball))):-1;
  // inside the triangle ball - left post - right post
  const inTri=(q:any)=>{const a={x:ball.x,y:ball.y},b={x:gx,y:-GH},c={x:gx,y:GH};
   const s1=(b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x),s2=(c.x-b.x)*(q.y-b.y)-(c.y-b.y)*(q.x-b.x),s3=(a.x-c.x)*(q.y-c.y)-(a.y-c.y)*(q.x-c.x);
   return (s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0);};
  const tri=defs.filter(inTri).length;
  const g=gkOf[D]>=0?pos(f,gkOf[D]):null;
  let gkDepth=-1,gkSpeed=-1,gkFace=-2,gkOff=-1;
  if(g){gkDepth=depth(D,g.x);gkSpeed=Math.hypot(g.vx??0,g.vy??0);const bx=ball.x-g.x,by=ball.y-g.y,bl=Math.hypot(bx,by)||1;gkFace=(Math.cos(g.angle??0)*bx+Math.sin(g.angle??0)*by)/bl;
   try{const ready=keeperPosition({side:D} as any,{x:ball.x,y:ball.y});gkOff=dist(ready,g);}catch{gkOff=-1;}}
  let shSpeed=-1,runAng=-1;
  if(sq){shSpeed=Math.hypot(sq.vx??0,sq.vy??0);const aim=e.shot?.aim;if(aim&&shSpeed>.5){const a1=Math.atan2(sq.vy,sq.vx),a2=Math.atan2(aim.y-ball.y,aim.x-ball.x);runAng=Math.abs(Math.atan2(Math.sin(a1-a2),Math.cos(a1-a2)))*180/Math.PI;}}
  const tech=e.technique==='header'?1:e.technique==='volley'?2:0;
  // situation
  const qi=spellIdxAt(e.time);let sp=qi>=0?spells[qi]:null;if(sp&&sp.side!==S)sp=null;
  let prevDur=-1,prevPasses=-1,prevHow='-',prevShot=0,defStart=-9;
  if(sp){
   const pv=qi>0?spells[qi-1]:null;
   if(pv&&pv.side===D){prevDur=r1(pv.t1-pv.t0);prevPasses=passesBy(D,pv.t0,pv.t1+.05);prevHow=pv.how;
    prevShot=events.some(x=>x.kind==='shot'&&x.side===D&&x.time>=pv.t0-1e-6&&x.time<=sp!.t0+1e-6)?1:0;}
   const k5=frameAt(sp.t0+.5);if(!frames[k5].restart)defStart=deficitAt(frames[k5],D).deficit;
  }
  const rd=deficitAt(f,D);
  const dev=e.shot?.assessment?.deviation;
  rows.push([S,ix,oc,r1(dGoal),r1(Math.abs(ball.y)),r1(near),tri,r1(gkDepth),r1(gkSpeed),r2(gkFace),r1(gkOff),r1(shSpeed),Math.round(runAng),e.firstTime?1:0,tech,
   sp?sp.how:'?',sp?r1(sp.startDepth):-1,sp?r1(e.time-sp.t0):-1,sp?passesBy(S,sp.t0,e.time):-1,prevDur,prevPasses,prevHow,prevShot,rd.deficit,defStart,rd.rest,dev!==undefined?r3(dev):-1]);
 });
 return rows;
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 let cap:any=null;
 const row:any=deepPlay(t,R=>{cap=R;return auditExtra(R);});
 row.sh=shots(cap);
 row.aer=row.agg.map((a:any)=>{const lr=a.x.lr??[],lofted=lr.filter((x:any)=>x[0]===1);
  return [a.x.long[0],lofted.length,lofted.filter((x:any)=>x.length>7&&x[7]>=0&&x[7]<1.5).length,a.x.long[1]+a.x.long[3]];});
 for(const a of row.agg){delete a.x.mv;delete a.x.lr;delete a.x.pl;}
 return row;
}
