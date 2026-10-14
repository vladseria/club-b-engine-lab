// Contest round, reception duels (2026-10-15). Evidence only; reads the recorded match.
//
// Arms: every mirror arm (../2026-10-10-cloud-measure/mirror.ts) through the deep-study row (official fields + agg),
// plus `st[side]` = r1Keys (../2026-10-14-r1/sit.ts: longFinal/longClean and friends) and `d` = the duel keys below.
// Trait arms `tr-<who>-<preset>[-<style pair>]` (default pair ba121vba121): the treated side's (seed % 2) outfielders
// get a trait preset; everything else is the mirror's neutral five. who: all. preset: dare | caut | nerv | calm.
//
// d[side] (side = the RECEIVING side unless said):
//  duels           reception duels (engine record receptionDuels; candidate only, empty on the base build)
//  out             {clean, forced, layoff, loose, nicked, turned, foul}  (layoff is a subset of forced)
//  commit          duels in which the defender committed to nick it
//  longDuels       duels on passes with >= 0.8 s of flight; longOut the same split
//  rows            per duel [outcome code, commit, access, screen, front, flight, receiver control, strength, defender
//                  defending, strength, reading, defender daring flag (tr arm treated side), receiver treated flag]
//  ft              passes with >= 0.8 s from release to the first contact by anyone but the passer: [ours first, theirs first]
//  ftNear          the same with an opponent < 1.25 m from the ball at that first contact
//  rec             receptions of a team-mate's pass (receive events): [all, nearest opponent < 1.25 m at the touch]
//  front100        long balls into the final third (r1 longFinal) received cleanly, by where the receiver was at the
//                  touch: [in front of their last outfielder: n, goals within 12 s ; behind: n, goals within 12 s]
//  spellLen        mean open-play possession spell (s) from agg (poss / spells) is computed in the table script
import {play as deepPlay,armTreatment as mirrorArm} from '../2026-10-12-deep-study/deep';
import {r1Keys} from '../2026-10-14-r1/sit';
import {runMatch} from '../../src/index';
import {engineTeam} from '../../../../lib/ballers/compute';
import {inputOf} from '../2026-10-10-cloud-measure/mirror';

const L=48,REACH=1.25,LONG=.8;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y);
const CODE:Record<string,number>={clean:0,forced:1,loose:2,nicked:3,turned:4,foul:5};
const PRESET:Record<string,Record<string,number>>={
 dare:{risk:.8,audacity:.8,engagement:.85,discipline:.6},
 caut:{risk:.2,audacity:0,engagement:.25,discipline:.95},
 nerv:{risk:.3,audacity:0,discipline:.45},
 calm:{risk:.5,audacity:.3,discipline:1},
};
export function armTreatment(arm:string){
 const m=/^tr-(all)-(dare|caut|nerv|calm)(?:-(\w+))?$/.exec(arm);
 if(m){if(m[3])mirrorArm(m[3]);return {trait:m[2],pair:m[3]??'ba121vba121'};}
 return mirrorArm(arm);
}

export function duelKeys(R:any,treated=-1){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,contacts:any[]=R.controlContacts??[],duels:any[]=R.receptionDuels??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const pl=(id:any)=>roster[idx.get(id)!];
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const posAt=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const fi=(t:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const blank=()=>({clean:0,forced:0,layoff:0,loose:0,nicked:0,turned:0,foul:0});
 const D=[0,1].map(()=>({duels:0,out:blank(),commit:0,longDuels:0,longOut:blank(),rows:[] as number[][],ft:[0,0],ftNear:[0,0],rec:[0,0],front100:[0,0,0,0]}));
 for(const x of duels){
  const s=sideOf(x.receiver);if(s<0)continue;const a=D[s];a.duels++;(a.out as any)[x.outcome]++;if(x.outcome==='forced'&&x.layoff)a.out.layoff++;if(x.commit)a.commit++;
  if(x.flight>=LONG){a.longDuels++;(a.longOut as any)[x.outcome]++;if(x.outcome==='forced'&&x.layoff)a.longOut.layoff++;}
  const r=pl(x.receiver),d=pl(x.defender);
  a.rows.push([CODE[x.outcome],x.commit?1:0,+x.access.toFixed(2),+x.screen.toFixed(2),+x.front.toFixed(2),+x.flight.toFixed(2),r.skills.control,r.skills.strength,d.skills.defending,d.skills.strength,d.skills.reading,d.side===treated?1:0,r.side===treated?1:0,x.outcome==='forced'&&x.layoff?1:0]);
 }
 const goals=events.filter((e:any)=>e.kind==='goal');
 // first touch after passes with long flights (controlContacts: every foot/body contact)
 let ci=0;
 for(const e of events){
  if(e.kind!=='pass'||e.restartKind)continue;const s=sideOf(e.actor);if(s<0)continue;
  while(ci<contacts.length&&contacts[ci].time<e.time-1e-6)ci++;
  let first:any=null;for(let k=ci;k<contacts.length&&contacts[k].time<e.time+6;k++){const c=contacts[k];if(c.actor===e.actor&&c.time<e.time+.25)continue;first=c;break;}
  if(!first||first.time-e.time<LONG)continue;
  const w=sideOf(first.actor)===s?0:1;D[s].ft[w]++;
  const f=frames[fi(first.time)];let near=Infinity;roster.forEach((p:any,i:number)=>{if(p.side===s||p.role==='GK')return;const q=posAt(f,i);if(q)near=Math.min(near,dist(q,{x:first.x,y:first.y}));});
  if(near<REACH)D[s].ftNear[w]++;
 }
 // receptions with an opponent within reach
 for(const e of events){
  if(e.kind!=='receive')continue;const s=sideOf(e.actor);if(s<0)continue;const f=frames[fi(e.time)];
  let near=Infinity;roster.forEach((p:any,i:number)=>{if(p.side===s||p.role==='GK')return;const q=posAt(f,i);if(q)near=Math.min(near,dist(q,f.ball));});
  D[s].rec[0]++;if(near<REACH)D[s].rec[1]++;
 }
 // long balls into the final third, received cleanly: in front of / behind their last outfielder, goals within 12 s
 for(let k=0;k<events.length;k++){
  const e=events[k];if(e.kind!=='pass'||e.restartKind)continue;const s=sideOf(e.actor);if(s<0)continue;
  const aim=e.pass?.aim??e.aerial?.aim,f0=frames[fi(e.time)];if(!aim||!f0)continue;
  if(!(depth(s,aim.x)>=32&&Math.hypot(aim.x-f0.ball.x,aim.y-f0.ball.y)>=20))continue;
  let next:any=null;for(let q=k+1;q<events.length;q++){const x=events[q];if(['receive','turnover','out','save','goal','shot','pass','clearance','block','tackle','restart','foul','offside'].includes(x.kind)){next=x;break;}}
  if(!next||next.kind!=='receive'||sideOf(next.actor)!==s)continue;
  const f=frames[fi(next.time)],ri=idx.get(next.actor)!,rq=posAt(f,ri);if(!rq)continue;
  let last=Infinity;roster.forEach((p:any,i:number)=>{if(p.side===s||p.role==='GK')return;const q=posAt(f,i);if(q)last=Math.min(last,depth(1-s,q.x));});
  const behind=depth(1-s,rq.x)<last;
  const scored=goals.some((g:any)=>g.side===s&&g.time>=next.time&&g.time<=next.time+12)?1:0;
  const o=behind?2:0;D[s].front100[o]++;D[s].front100[o+1]+=scored;
 }
 return D;
}

function traitPlay(t:{label:string;arm:string;seed:number;rev:string},tr:{trait:string;pair:string}){
 const inp:any=inputOf(tr.pair,t.seed),treated=t.seed%2,t0=performance.now();
 for(const p of inp.sides[treated].players)if(!p.roles.includes('GK'))Object.assign(p.traits,PRESET[tr.trait]);
 const teams=inp.sides.map(engineTeam) as any;
 const run:any=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true} as any);
 const R=run.result;
 return {label:t.label,kind:'trait',arm:t.arm,seed:t.seed,rev:t.rev,ours:treated,build:run.engineBuild,score:R.score,ms:Math.round(performance.now()-t0),
  stats:R.stats.map((x:any)=>({passes:x.passes,completed:x.completed,shots:x.shots,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,fouls:x.fouls,poss:Math.round(x.possession)})),d:duelKeys(R,treated),dropped:[]};
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const tr:any=armTreatment(t.arm);
 if(tr.trait)return traitPlay(t,tr);
 return deepPlay(t,(R:any)=>{const k=r1Keys(R),d=duelKeys(R,t.seed%2);return [0,1].map(s=>({r1:k[s],d:d[s]}));});
}
