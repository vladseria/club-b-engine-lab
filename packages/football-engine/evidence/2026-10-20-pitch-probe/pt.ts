// Pitch probe (2026-10-20): one row per match. Evidence only.
//
// The match goes through EXACTLY the runMatch call lib/ballers/compute.ts computeMatch makes (engineTeam, sidePlans,
// sideOrders, coordinated, substitutions none, record:true). The pitch is whatever this bundle's hook made it
// (hook.mjs pitchHook(world)): the engine's own pitch.ts is read back here, so every measure uses the world's L, W, GH.
//
// Arm  <world>.<A>v<B>   world w1..w4 (hook.mjs WORLDS; must match the bundle), A our style, B theirs: di | ba | sh | co.
//   Ours = seed % 2, kick-off = (seed >> 1) % 2: the same seed is the same input in every world (paired by seed).
//   Both sides the neutral five (squads.ts), 1-2-1, presets as shipped.
import {runMatch} from '../../src/index';
import {L,W,GH,BOX_DEPTH,BOX_HALF} from '../../src/pitch';
import {engineTeam,sidePlans,sideOrders,compact,computeMatch} from '../../../../lib/ballers/compute';
import {matchChances} from '../../../../lib/ballers/chances';
import {side as sqSide} from './squads';
import {normalize,measure,type NJob} from './measure';
import {boxRecon,kindOf} from './recon';

const KINDS=['depth run: runner shot','depth run: then a team-mate','short run','cut-back','other pass','loose','no pass','restart'];

/** The world this bundle plays, read from its own pitch (hook.mjs WORLDS). */
const WORLDS:Record<string,[number,number,number]>={w1:[48,30,2.5],w2:[40,20,2.5],w3:[44,25,2.5]};
export const WORLD=Object.keys(WORLDS).find(k=>WORLDS[k][0]===L&&WORLDS[k][1]===W&&WORLDS[k][2]===GH)??'?';
export const GEOM={L,W,GH,BOX_DEPTH,BOX_HALF};
const r1=(v:number)=>Math.round(v*10)/10,r3=(v:number)=>Math.round(v*1000)/1000;
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};

const ARM=/^(w[1-3])\.(di|ba|sh|co)v(di|ba|sh|co)$/;
export function parseArm(arm:string){const m=ARM.exec(arm);if(!m)throw Error('bad arm '+arm);return {world:m[1],a:m[2],b:m[3]};}
export const armTreatment=(arm:string)=>{const p=parseArm(arm);if(p.world!==WORLD)throw Error(`arm ${arm} needs the ${p.world} bundle, this is ${WORLD}`);return arm;};
export function inputOf(arm:string,seed:number):any{
 const {a,b}=parseArm(arm),ours=seed%2,sides=[null,null] as any[];
 sides[ours]=sqSide('AAA','#3fd38a',a);sides[1-ours]=sqSide('BBB','#d33f6a',b);
 return {v:1,match:`pp-${seed}`,seed,kickoff:(seed>>1)%2,duration:900,sides};
}

function runIt(inp:any){
 const teams=inp.sides.map(engineTeam),plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams as any);
 const run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 return {run,c:compact(inp,run.result)};
}

/** computeMatch, unchanged (only meaningful in the w1 bundle: the parity reference). */
export function plain(t:{arm:string;seed:number}){
 const c=computeMatch(inputOf(t.arm,t.seed));
 return {arm:t.arm,seed:t.seed,score:c.compact.score,print:print(c.compact)};
}

/** Realism guards from the full record: players and ball inside the pitch, restarts where they belong. */
function guards(R:any){
 let outP=0,maxOut=0,frames=0,ballOut=0;
 for(const f of R.frames){
  frames++;
  for(const p of f.players){const o=Math.max(-p.x,p.x-L,Math.abs(p.y)-W/2);if(o>.5){outP++;if(o>maxOut)maxOut=o;}}
  const b=f.ball,bo=Math.max(-b.x,b.x-L,Math.abs(b.y)-W/2);if(bo>3)ballOut++;
 }
 // restart spots by kind (one per stoppage): kick-off on the centre spot, corner at a corner, goal kick inside the box,
 // throw-in on a touchline, everything else on the pitch
 const rk:Record<string,[number,number]>={};let lastKey='';
 for(const f of R.frames){const r=f.restartInfo;if(!f.restart||!r)continue;const key=`${r.kind}:${r.side}:${r.spot.x.toFixed(1)}:${r.spot.y.toFixed(1)}`;if(key===lastKey)continue;lastKey=key;
  const {x,y}=r.spot,v=(rk[r.kind]??=[0,0]);v[0]++;
  const ok=r.kind==='kickoff'?Math.abs(x-L/2)<.6&&Math.abs(y)<.6
   :r.kind==='corner'?(Math.min(x,L-x)<1.2&&Math.abs(y)>W/2-1.2)
   :r.kind==='goalKick'?(Math.min(x,L-x)<=BOX_DEPTH+.5&&Math.abs(y)<=BOX_HALF+.5)
   :r.kind==='throw'?Math.abs(y)>W/2-1.2
   :x>=-.1&&x<=L+.1&&Math.abs(y)<=W/2+.1;
  if(!ok)v[1]++;}
 // saves [by side 0's keeper, by side 1's keeper] (an engine 'save' event carries the keeper's side)
 const saves=[0,1].map(k=>R.events.filter((e:any)=>e.kind==='save'&&e.side===k).length);
 return {outP,maxOut:r1(maxOut),frames,ballOut,rk,saves};
}

export function play(t:{label:string;arm:string;seed:number;rev:string;watch?:boolean}){
 armTreatment(t.arm);
 const inp=inputOf(t.arm,t.seed),ours=(t.seed%2) as 0|1;const t0=performance.now();
 const {run,c}=runIt(inp);
 const ms=Math.round(performance.now()-t0),R=run.result;
 const ev=c.chunks.flatMap((ch:any)=>ch.e),frames=c.chunks.flatMap((ch:any)=>ch.f);
 const chances=matchChances(ev,c.header,run.engineBuild);
 const st=[0,1].map(s=>{const x=R.stats[s];return [r1(x.possession),x.passes,x.completed,x.shots,x.turnovers];});
 const row:any={label:t.label,kind:'pp',arm:t.arm,world:WORLD,geom:GEOM,seed:t.seed,rev:t.rev,ours,kickoff:inp.kickoff,styles:inp.sides.map((s:any)=>s.style),
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:run.engineBuild.slice(0,8),
  score:c.score,chances:chances?chances.map(r3):null,print:print(c),ms,st,g:guards(R)};
 try{
 // the measures (measure.ts, from the compact replay plus pass aims and the job history, as defensive-ceiling pd.ts)
 const roster:any[]=R.players,rIdx=new Map<string,number>();inp.sides.forEach((s:any,side:number)=>s.lineup.forEach((id:string,slot:number)=>rIdx.set(`${side}:${id}`,side*5+slot)));
 const jobs:NJob[]=(R.choices??[]).filter((x:any)=>x.assignment).map((x:any)=>({t:x.time,i:rIdx.get(roster[x.player]?.id)??-1,kind:x.kind,purpose:x.assignment?.purpose??null,target:x.assignment?.target!==undefined?rIdx.get(x.assignment.target)??-1:-1})).filter((j:NJob)=>j.i>=0);
 const aims=R.events.map((e:any)=>e.kind==='pass'&&(e.pass?.aim||e.aerial?.aim)?{x:(e.pass?.aim??e.aerial.aim).x,y:(e.pass?.aim??e.aerial.aim).y,aerial:!!e.aerial}:null);
 const n=normalize(c.header,frames,ev,jobs,aims),m=measure(n);
 row.m=m.side;
 // every shot of each side: [q (null = unread), sk, goal, chance type (KINDS index), receiver's distance from the goal
 // centre at the shot-leading receive, his marker's distance there (null none), receive to shot s, after a ball in
 // behind or a depth run (recon3's BB)]; no-reception shots carry only q, sk, goal, type
 row.shots=[0,1].map(s=>{const rec=boxRecon(R,rIdx,m.chances[s],s,frames,ev,{all:true,noWins:true}).chances;
  return m.chances[s].map((c:any,i:number)=>{const e=ev[c._sq],x=rec[i]??{},kind=KINDS.indexOf(kindOf(c));
   const bb=kind<2||x.behind===true||x.chainBehind===true?1:0;
   return x.noReception||x.error||x.recvGoal===undefined?[e?.q??null,e?.sk??0,x.goal?1:0,kind]:[e?.q??null,e?.sk??0,x.goal?1:0,kind,x.recvGoal,x.dMarkerRecv,x.recvToShot,bb];});});
 }catch(e:any){row.measureError=String(e?.stack??e);}// a measure bug never loses the match row
 if(t.watch){row.header=c.header;row.frames=frames;row.events=ev;}
 return row;
}
