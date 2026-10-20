// Take-on price: the seed search for the seeded tests the price moves (../2026-10-19-keeper-fix/repin.ts unchanged
// for header, volley and takeonGolusor), plus the keeper-box rule (test/keeper-box.test.mjs "a keeper holding the
// ball under a press ...", seed 4 there) read on any seed with the price on (keeperBox) and off (keeperBoxOff), so a
// rule the price might break is compared across seeds instead of re-pinned past. Runner: repin.mjs.
import {play as kfPlay} from '../2026-10-19-keeper-fix/repin';
import {runMatch} from '../../src/index';
import {TAKEON_PRICE} from '../../src/practice-feints';
import {ENGINE_BUILD} from '../../src/build-info';
import {L,GH} from '../../src/pitch';
import fixture from '../../test/fixture.json';

function keeperBox(seed:number,on:boolean){
 const was=TAKEON_PRICE.on;TAKEON_PRICE.on=on;let r:any;
 try{const f:any=structuredClone(fixture);f.seed=seed;for(const t of f.teams)t.tactics.press='aggressive';r=runMatch({fixture:f,durationSeconds:300,policy:'coordinated'} as any).result;}
 finally{TAKEON_PRICE.on=was;}
 // the test's own reading, verbatim in substance; every breach is listed instead of throwing at the first
 const pos=(fr:any,i:number)=>fr.lineup?fr.players[fr.lineup.indexOf(i)]:fr.players[i];
 const at=new Map(r.players.map((p:any,i:number)=>[p.id,i])),gk=new Set(r.players.filter((p:any)=>p.role==='GK').map((p:any)=>p.id));
 const near=(fr:any,k:string)=>Math.min(...r.players.map((p:any,i:number)=>({p,q:pos(fr,i)})).filter((x:any)=>x.q&&x.p.role!=='GK'&&x.p.side!==r.players[at.get(k) as number].side).map((x:any)=>{const g=pos(fr,at.get(k) as number);return Math.hypot(x.q.x-g.x,x.q.y-g.y);}));
 let spells=0,pressed=0,moved=0,cur:any=null;const breaches:string[]=[];
 for(let n=0;n<r.frames.length;n++){
  const fr=r.frames[n],o=fr.ball.owner,hands=!!o&&gk.has(o)&&!fr.restart&&!fr.control;
  if(hands){
   if(!cur||cur.id!==o)cur={id:o,from:fr.time,start:{...pos(fr,at.get(o) as number)},pressed:false};cur.last=n;
   const d=near(fr,o);if(d<2)cur.pressed=true;
   if(fr.time-cur.from>=1.2&&d<.8)breaches.push(`man ${d.toFixed(2)} m at ${fr.time.toFixed(2)}`);
   continue;
  }
  if(!cur)continue;
  spells++;const last=r.frames[cur.last],k=pos(last,at.get(cur.id) as number);
  if(last.time-cur.from>4.1)breaches.push(`held ${(last.time-cur.from).toFixed(2)} s`);
  if(cur.pressed&&last.time-cur.from>1){pressed++;if(Math.hypot(k.x-cur.start.x,k.y-cur.start.y)>.5)moved++;}
  const next=r.frames.slice(n,n+60).find((g:any)=>g.ball.owner&&g.ball.owner!==cur.id);
  if(next&&r.players[at.get(next.ball.owner) as number].side!==r.players[at.get(cur.id) as number].side){
   const q=pos(last,at.get(next.ball.owner) as number),dd=Math.hypot(q.x-k.x,q.y-k.y);
   if(dd<2)breaches.push(`release at ${last.time.toFixed(2)} s to ${next.ball.owner} ${dd.toFixed(2)} m (owner at ${next.time.toFixed(2)}, control ${next.control?1:0})`);
  }
  cur=null;
 }
 return {spells,pressed,moved,breaches,pass:!breaches.length&&spells>=3&&pressed>=2&&moved>=2};
}
// test/b4-defending-near-goal.test.mjs "the defending keeper is set near the bisector of the posts when the shot
// comes" (seed 2057 there): every shot's lateral miss of the keeper from the bisector; the test asks >= 10 shots and a
// mean under 0.9 m. Read with the price on (keeperBisector) and off (keeperBisectorOff).
function bisector(seed:number,on:boolean){
 const was=TAKEON_PRICE.on;TAKEON_PRICE.on=on;let r:any;
 try{const f:any=structuredClone(fixture);f.seed=seed;r=runMatch({fixture:f,durationSeconds:300} as any).result;}finally{TAKEON_PRICE.on=was;}
 const miss:number[]=[];
 for(const e of r.events.filter((e:any)=>e.kind==='shot'&&e.actor)){
  const s=r.players.find((p:any)=>p.id===e.actor).side,d=1-s,g=r.players.findIndex((p:any)=>p.side===d&&p.role==='GK');
  const frame=r.frames.findLast((x:any)=>x.time<=e.time-.02),from=frame.players[r.players.findIndex((p:any)=>p.id===e.actor)],k=frame.players[g];
  const dd=(q:any)=>d===0?q.x:L-q.x,bx=dd(from),a=(Math.atan2(GH-from.y,-bx)+Math.atan2(-GH-from.y,-bx))/2;
  miss.push(Math.abs((dd(k)-bx)*Math.sin(a)-(k.y-from.y)*Math.cos(a)));
 }
 const mean=miss.length?miss.reduce((a,b)=>a+b,0)/miss.length:NaN;
 return {shots:miss.length,mean,pass:miss.length>=10&&mean<.9};
}
// `tired` (round 5): test/triggered-substitutions.test.mjs "a tired trigger replaces that player at the next stoppage
// ..." (300 s), ../2026-10-14-r1/repin.mjs tired ported unchanged in substance.
function tired(seed:number):string|null{
 const STOPPAGES=['goal','out','foul','offside','half'];
 const f:any=structuredClone(fixture);f.seed=seed;
 for(const [side,t] of (f.teams as any[]).entries()){const gk=t.squad.find((p:any)=>p.roles[0]==='GK');
  t.squad.push({...structuredClone(gk),id:`rgk${side}`,name:`Portar rezervă ${side}`},{...structuredClone(t.squad[3]),id:`r1${side}`,name:`Rezerva unu ${side}`},{...structuredClone(t.squad[4]),id:`r2${side}`,name:`Rezerva doi ${side}`});}
 const r:any=runMatch({fixture:f,durationSeconds:300,substitutionOrders:[{id:'t',side:0,in:'r10',trigger:{kind:'tired',player:'van',threshold:98}}]} as any).result;
 const subs=r.events.filter((e:any)=>e.kind==='substitution'),[e]=subs;if(!e||e.outgoing!=='0:van'||e.incoming!=='0:r10'||!(e.substitution.energy<98))return null;
 for(const s of subs){const i=r.events.indexOf(s);let j=i-1;while(r.events[j].kind==='substitution')j--;
  if(!STOPPAGES.includes(r.events[j].kind)||r.events[j].time!==s.time)return null;const frame=r.frames.find((x:any)=>x.event>=i);if(!frame?.restart)return null;}
 const outIndex=r.players.findIndex((p:any)=>p.id==='0:van'),prior=r.events.filter((x:any)=>STOPPAGES.includes(x.kind)&&x.time<e.time).at(-1);if(!prior)return null;
 const priorFrame=r.frames.filter((x:any)=>x.time<=prior.time).at(-1);if(!(priorFrame.players[outIndex].energy>=98-0.05))return null;
 const incoming=r.players.find((p:any)=>p.id==='0:r10');if(incoming.energy!==100)return null;
 const outgoing=r.players[outIndex];if(incoming.number!==outgoing.number||incoming.role!==outgoing.role||incoming.lane!==outgoing.lane)return null;
 const last=r.frames.at(-1);if(!(last.lineup.includes(r.players.indexOf(incoming))&&!last.lineup.includes(outIndex)))return null;
 if(r.substitutionNotes.length!==1||r.substitutionNotes[0].status!=='made'||r.substitutionNotes[0].out!=='van'||r.substitutionNotes[0].in!=='r10')return null;
 return `tired substitution ${e.time.toFixed(2)} s after a stoppage at ${prior.time.toFixed(2)} s`;
}
export function play(task:{kind:string;seed:number}){
 if(task.kind==='tired'){const t0=Date.now(),found=tired(task.seed);return {kind:task.kind,seed:task.seed,found,build:ENGINE_BUILD.slice(0,8),platform:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0};}
 if(task.kind==='keeperBisector'||task.kind==='keeperBisectorOff'){
  const t0=Date.now(),k=bisector(task.seed,task.kind==='keeperBisector');
  return {kind:task.kind,seed:task.seed,found:k.pass?`${k.shots} shots, mean lateral miss ${k.mean.toFixed(2)} m`:null,bisector:k,build:ENGINE_BUILD.slice(0,8),platform:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0};
 }
 if(task.kind==='keeperBox'||task.kind==='keeperBoxOff'){
  const t0=Date.now(),k=keeperBox(task.seed,task.kind==='keeperBox');
  return {kind:task.kind,seed:task.seed,found:k.pass?`${k.spells} spells, ${k.moved}/${k.pressed} pressed holds moved`:null,keeper:k,build:ENGINE_BUILD.slice(0,8),platform:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0};
 }
 return kfPlay(task);
}
