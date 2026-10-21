// Plan switch, the lanes question (owner, 21 Oct): after a switch, do the men take their new places and keep them?
// Seeds 1..MAX_SEED of the proof set-up (proof.ts: Short 1-2-1 v Balanced 2-2, neutral fives, losing from 5:00). Per seed:
// the formation switch (-> Direct 2-2) first; when it fires between 5:00 and 10:00 the seed qualifies and two more matches
// are played: the same-shape switch (-> Direct 1-2-1, wingers swapped) and the twin (no switch). All three are identical
// until the switch fires, so they share its moment T. Measured here (on the lab), per match, in 30 s windows from T to T+5:00:
//   lanes      share of open-play frames with the lane -1 winger left of the lane +1 winger (each match's own lanes:
//              the switch's `ro` after T, 1-2-1's #3 left / #4 right in the twin); also with frames within 5 s of a
//              dead ball left out, and the absolute version (each winger on his own lane's half)
//   rest       each outfielder's window-mean position to his settled spot (his mean over T+3:00..T+5:00), metres
//   depth      the four outfielders' mean distance from their own goal while the opponents have the ball
//   box        every opponent restart from T-5:00 to T+5:00: which of our outfielders stand in the opponents' penalty
//              area when it starts (kind, our men's roles)
// Shard by SHARD_INDEX / SHARD_TOTAL (cloud.mjs): seed s goes to shard (s-1) % SHARD_TOTAL. Played by lanes-run.mjs.
import {computeMatch} from '../../../../lib/ballers/compute';
import type {CompactMatch,ReplayFrame} from '../../../../lib/ballers/replay';
import {inputFor} from './proof';

export const MAX_SEED=40;
const WIN=30000,SPAN=300000;
const framesOf=(c:CompactMatch)=>c.chunks.flatMap(ch=>ch.f),eventsOf=(c:CompactMatch)=>c.chunks.flatMap(ch=>ch.e);
const at=(f:ReplayFrame,i:number):[number,number]|null=>{const k=f.l?f.l.indexOf(i):i;if(k<0||k>9||!f.p[k])return null;return [f.p[k][0]/100,f.p[k][1]/100];};
const r2=(v:number)=>Math.round(v*100)/100,r1=(v:number)=>Math.round(v*10)/10;
const BASE:Record<number,[string,number]>={1:['CB',0],2:['W',-1],3:['W',1],4:['ST',0]}; // 1-2-1, SHO's slots 1-4

function measure(c:CompactMatch,T:number){
 const F=framesOf(c),E=eventsOf(c);
 const sw=E.find(e=>e.k==='switch'&&e.s===0);
 const role=new Map<number,[string,number]>(Object.entries(BASE).map(([i,v])=>[+i,v]));
 if(sw?.sw?.ro)for(const [i,r,lane] of sw.sw.ro)if(i>=1&&i<=4)role.set(i,[r,lane??0]);
 const wL=[...role].find(([,v])=>v[0]==='W'&&v[1]===-1)?.[0],wR=[...role].find(([,v])=>v[0]==='W'&&v[1]===1)?.[0];
 const dead=F.filter(f=>f.r).map(f=>f.t);
 const nearDead=(t:number)=>{let lo=0,hi=dead.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(dead[m]<t-5000)lo=m+1;else if(dead[m]>t+5000)hi=m-1;else return true;}return false;};
 const settle=new Map<number,[number,number]>();
 for(const i of [1,2,3,4]){let x=0,y=0,n=0;for(let k=0;k<F.length-1;k++){const f=F[k];if(f.t<T+180000||f.t>=T+SPAN||f.r)continue;const q=at(f,i);if(!q)continue;const dt=Math.min(F[k+1].t-f.t,1000);x+=q[0]*dt;y+=q[1]*dt;n+=dt;}settle.set(i,[x/n,y/n]);}
 const windows=[];
 for(let w=0;w<SPAN/WIN;w++){
  const lo=T+w*WIN,hi=lo+WIN;let open=0,ok=0,openC=0,okC=0,abs=0,depth=0,dn=0;
  const sum=new Map<number,[number,number,number]>();
  for(let k=0;k<F.length-1;k++){const f=F[k];if(f.t<lo||f.t>=hi||f.r)continue;const dt=Math.min(F[k+1].t-f.t,1000);
   const a=at(f,wL!),b=at(f,wR!);
   if(a&&b){open+=dt;if(a[1]<b[1])ok+=dt;if(a[1]<0&&b[1]>0)abs+=dt;if(!nearDead(f.t)){openC+=dt;if(a[1]<b[1])okC+=dt;}}
   const xs:number[]=[];
   for(const i of [1,2,3,4]){const q=at(f,i);if(!q)continue;xs.push(q[0]);const s=sum.get(i)??[0,0,0];s[0]+=q[0]*dt;s[1]+=q[1]*dt;s[2]+=dt;sum.set(i,s);}
   if(f.ps===1&&xs.length){depth+=xs.reduce((p,q)=>p+q,0)/xs.length*dt;dn+=dt;}
  }
  const rest=Object.fromEntries([1,2,3,4].map(i=>{const s=sum.get(i),z=settle.get(i)!;return [i,s?r1(Math.hypot(s[0]/s[2]-z[0],s[1]/s[2]-z[1])):null];}));
  windows.push({w,lanes:open?r2(ok/open):null,lanesClean:openC?r2(okC/openC):null,lanesAbs:open?r2(abs/open):null,open:Math.round(open),
   rest,depth:dn?r1(depth/dn):null});
 }
 // opponent restarts: the first frame of each dead-ball run whose taker (o) is theirs
 const box=[];let lastRk:string|null=null;let ei=0;const ev=E.slice().sort((a,b)=>a.t-b.t);
 for(let k=0;k<F.length;k++){const f=F[k];while(ei<ev.length&&ev[ei].t<=f.t){if(ev[ei].rk)lastRk=ev[ei].rk!;ei++;}
  if(!f.r||(k>0&&F[k-1].r))continue;if(f.t<T-SPAN||f.t>=T+SPAN)continue;
  const taker=c.header.players.find(p=>p.i===f.o);if(!taker||taker.side!==1)continue;
  const inside=[1,2,3,4].filter(i=>{const q=at(f,i);return q&&q[0]>40&&Math.abs(q[1])<8;}).map(i=>(role.get(i)?.[0]??'?')+(f.t<T?'(before)':''));
  box.push({t:f.t,kind:lastRk,after:f.t>=T,inside});}
 return {wL,wR,roles:Object.fromEntries(role),windows,box,score:c.score,switchAt:sw?.t??null};
}

function trim(c:CompactMatch,T:number){
 const F=framesOf(c).filter(f=>f.t>=T-5000&&f.t<T+65000),E=eventsOf(c).filter(e=>e.t>=T-5000&&e.t<T+65000);
 return {header:c.header,score:c.score,chunks:[{v:2,i:0,t0:T-5000,t1:T+65000,f:F,e:E}]};
}

export function runSeed(seed:number){
 const a=computeMatch(inputFor(seed,'formation'));
 const sw=eventsOf(a.compact).find(e=>e.k==='switch');
 const row:any={seed,fired:sw?.t??null,engineBuild:a.engineBuild};
 if(!sw||sw.t<300000||sw.t>600000)return row;
 const T=sw.t,b=computeMatch(inputFor(seed,'sameshape')),t=computeMatch(inputFor(seed,'none'));
 const bT=eventsOf(b.compact).find(e=>e.k==='switch')?.t??null;
 row.T=T;row.sameshapeFired=bT;
 row.formation=measure(a.compact,T);row.sameshape=measure(b.compact,T);row.twin=measure(t.compact,T);
 row.replays={formation:trim(a.compact,T),sameshape:trim(b.compact,T),twin:trim(t.compact,T)};
 return row;
}
