// One mirrored Ballers-shaped match for the balance-v3 screen: the
// 2026-09-29-style-balance match.ts (same pinned inputs, seeds, cells and
// screen fields) plus the 2026-09-30-direct-turnovers loss probe, computed
// from the same run. Presets come from the ENGINE revision under test
// (teamApproaches), not lib/ballers/league.ts, so an arm always plays its
// own presets. Bundled by run.mjs (esbuild) against the chosen engine sources.
//
// Both sides field the SAME global club's formation-appropriate five (pinned
// copies of backups/auto in inputs/), the same formation, no ideas, no subs:
// the only football difference is the standard style preset of each side.
// A task is {seed, pair:[styleA,styleB], cell:0..3}; the cell swaps which side
// A plays on and who kicks off, so every seed block is side/kickoff balanced.
// Engine call = lib/ballers/compute computeMatch's (policy coordinated).
import {runMatch,ENGINE_BUILD} from '../../src/index';
import {teamApproaches} from '../../src/team-approach';
import {engineTeam,type FrozenInput,type FrozenSide} from '../../../../lib/ballers/compute';
import {type Formation,type Style} from '../../../../lib/ballers/league';
const PRESETS=Object.fromEntries(Object.entries(teamApproaches).map(([k,v])=>[k,v.settings])) as Record<string,any>;
import players from '../2026-09-29-style-balance/inputs/ballers_players.json';
import clubs from '../2026-09-29-style-balance/inputs/ballers_clubs.json';

type Row={id:string;club_id:string;name:string;short:string;number:number;roles:string[];archetype:string;temperament:string;note:string;skills:Record<string,number>;traits:Record<string,number>;energy:number;portrait:string};
const CLUBS=(clubs as {id:string;name:string;code?:string;color?:string;space:string}[]).filter(c=>c.space==='global').sort((a,b)=>a.name.localeCompare(b.name));
const ROSTER=(id:string)=>(players as Row[]).filter(p=>p.club_id===id).sort((a,b)=>a.number-b.number);
const NEEDS:Record<Formation,string[]>={'1-2-1':['CB','W','W','ST'],'2-2':['CB','CB','W','W'],'2-1-1':['CB','CB','CM','ST']};
const FORMATIONS:Formation[]=['1-2-1','2-2','2-1-1'];
const mix=(n:number)=>{let s=(n+0x9e3779b9)>>>0;s=Math.imul(s^(s>>>16),0x85ebca6b)>>>0;s=Math.imul(s^(s>>>13),0xc2b2ae35)>>>0;return (s^(s>>>16))>>>0;};
function lineup(roster:Row[],f:Formation):string[]{
 const gk=roster.find(p=>p.roles[0]==='GK')!,used=new Set([gk.id]),out=[gk.id];
 for(const need of NEEDS[f]){
  const pick=roster.find(p=>!used.has(p.id)&&p.roles[0]===need)??roster.find(p=>!used.has(p.id)&&p.roles.includes(need))??roster.find(p=>!used.has(p.id)&&p.roles[0]!=='GK')!;
  used.add(pick.id);out.push(pick.id);
 }
 return out;
}
/** Decomposition variants: a standard preset with ONE field changed, `base+field=value`
 * (e.g. `balanced+progression=direct`, `direct+progression=mixed`). */
function approach(style:string){
 const [base,...mods]=style.split('+');const a:any={...PRESETS[base as Style]};if(!PRESETS[base as Style])throw Error('unknown style '+style);
 for(const m of mods){const [k,v]=m.split('=');if(!(k in a))throw Error('unknown field '+k);a[k]=k==='commit'?Number(v):v;}
 return a;
}
function side(clubIndex:number,f:Formation,style:Style,copy:number):FrozenSide{
 const c=CLUBS[clubIndex],roster=ROSTER(c.id),five=lineup(roster,f);
 // Cosmetic labels only differ between the two copies of the club.
 return {club:{id:`${c.id}-${copy}`,name:`${c.name} ${copy}`,code:c.code??'ABC',color:c.color??'#123456'},formation:f,style,approach:approach(style),captain:five[1],lineup:five,bench:roster.filter(p=>!five.includes(p.id)).map(p=>p.id),
  players:roster.map(p=>({id:p.id,name:p.name,short:p.short,number:p.number,roles:p.roles as never,skills:p.skills as never,traits:p.traits as never,energy:p.energy,archetype:p.archetype,temperament:p.temperament,note:p.note||'x',portrait:p.portrait})),plans:[]};
}
export type Task={seed:number;pair:[Style,Style];cell:number;duration?:number;arm?:string};
/** Club and formation come from the seed alone, so every pairing plays the same seed blocks. */
export function design(t:Task){
 const h=mix(t.seed),club=h%CLUBS.length,formation=FORMATIONS[mix(h+1)%3];
 const aSide=(t.cell&1) as 0|1,kickoff=((t.cell>>1)&1) as 0|1;
 const styles:[Style,Style]=aSide===0?[t.pair[0],t.pair[1]]:[t.pair[1],t.pair[0]];
 return {seed:t.seed,club:CLUBS[club].name,clubIndex:club,formation,aSide,kickoff,styles};
}
export function input(t:Task):FrozenInput{
 const d=design(t);
 return {v:1,match:`style-${t.seed}`,seed:t.seed,kickoff:d.kickoff,duration:t.duration??900,sides:[0,1].map(i=>side(d.clubIndex,d.formation,d.styles[i],i)) as [FrozenSide,FrozenSide]};
}

const L=48;
const round=(v:number,d=3)=>Math.round(v*10**d)/10**d;
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/Math.max(1,v.length);
const depth=(s:number,x:number)=>s===0?x:L-x;
const third=(s:number,x:number)=>{const d=depth(s,x);return d<L/3?0:d<2*L/3?1:2;};

export function play(t:Task){
 const d=design(t),inp=input(t),teams=inp.sides.map(engineTeam) as never;
 const t0=performance.now();
 const run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true} as never);
 const ms=performance.now()-t0,r=run.result as any;
 const roster:{id:string;side:number;role:string}[]=r.players,frames:any[]=r.frames,events:any[]=r.events;
 const sideOf=(id:string)=>roster.find(p=>p.id===id)?.side??-1;
 // Possession chains from frames: a chain starts at a restart awarded to a side
 // (kind) or at an open-play gain of the ball (recovery, with the third it was won in).
 type Chain={side:number;start:number;origin:string;third:number;end:number};
 const chains:Chain[]=[];let cur:Chain|null=null;
 for(const f of frames){
  if(f.restart&&f.restartInfo){
   const s=f.restartInfo.side;
   if(!cur||cur.side!==s||cur.origin!==f.restartInfo.kind||f.cut||(cur.end<f.time-.5&&!frames.length)){
    if(!cur||cur.side!==s||!cur.origin.startsWith('R:')){if(cur)cur.end=f.time;cur={side:s,start:f.time,origin:'R:'+f.restartInfo.kind,third:third(s,f.restartInfo.spot.x),end:f.time};chains.push(cur);}
   }
   continue;
  }
  const owner=f.control?.owner??f.ball?.owner;
  if(owner){const s=sideOf(owner);if(s>=0&&(!cur||cur.side!==s)){if(cur)cur.end=f.time;cur={side:s,start:f.time,origin:'recovery',third:third(s,f.ball.x),end:f.time};chains.push(cur);}}
  if(cur)cur.end=f.time;
 }
 const chainAt=(time:number,s:number)=>{for(let i=chains.length-1;i>=0;i--)if(chains[i].start<=time+1e-6)return chains[i].side===s?chains[i]:null;return null;};
 const frameAt=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return frames[lo];};
 const per=[0,1].map(s=>({shots:{} as Record<string,number>,goals:{} as Record<string,number>,fastShots:0,fastGoals:0,recov:[0,0,0],
  longPasses:0,longWon:0,forwardPasses:0,passes:0,won:0,quality:0,qualityN:0,
  shotsAfterLoss8:0,goalsAfterLoss8:0,
  lineSum:0,lineN:0,behindSum:0,oppGoalSideSum:0}));
 for(const c of chains)if(c.origin==='recovery')per[c.side].recov[c.third]++;
 const goalTimes=events.filter(v=>v.kind==='goal');
 // Each goal is credited to the last shot by the scoring side within 4 s before it
 // (own goals / deflections without such a shot are 'other').
 const shotEvents=events.filter(v=>v.kind==='shot');
 const scoringShot=new Set<any>();
 for(const g of goalTimes){const s=[...shotEvents].reverse().find(v=>sideOf(v.actor)===g.side&&v.time<=g.time+1e-6&&v.time>=g.time-4);if(s)scoringShot.add(s);else per[g.side].goals.other=(per[g.side].goals.other??0)+1;}
 for(const v of events){
  if(v.kind==='shot'){
   const s=sideOf(v.actor);if(s<0)continue;const c=chainAt(v.time,s);
   const origin=!c?'unknown':c.origin==='recovery'?`rec${c.third}`:c.origin;
   per[s].shots[origin]=(per[s].shots[origin]??0)+1;
   const fast=c&&c.origin==='recovery'&&v.time-c.start<8;if(fast)per[s].fastShots++;
   const q=v.shot?.assessment?.quality;if(Number.isFinite(q)){per[s].quality+=q;per[s].qualityN++;}
   if(scoringShot.has(v)){per[s].goals[origin]=(per[s].goals[origin]??0)+1;if(fast)per[s].fastGoals++;}
  }
  if(v.kind==='pass'&&!v.restartKind){
   const s=sideOf(v.actor);if(s<0)continue;const f=frameAt(v.time),aim=v.pass?.aim??v.aerial?.aim;if(!aim)continue;
   const len=Math.hypot(aim.x-f.ball.x,aim.y-f.ball.y),gain=depth(s,aim.x)-depth(s,f.ball.x);
   per[s].passes++;
   const next=frames.find(g=>g.time>v.time+.05&&(g.control?.owner||g.restart));
   const won=next&&!next.restart?sideOf(next.control.owner)===s:next?.restart?next.restartInfo?.side===s:false;
   if(won)per[s].won++;
   if(gain>6)per[s].forwardPasses++;
   if(len>16&&gain>6){per[s].longPasses++;if(won)per[s].longWon++;}
  }
 }
 // Losses: open-play chain changes. Shots/goals by the other side within 8 s.
 for(let i=1;i<chains.length;i++){const c=chains[i];if(c.origin!=='recovery')continue;const lost=chains[i-1].side;if(lost===c.side)continue;
  const sh=events.filter(v=>v.kind==='shot'&&sideOf(v.actor)===c.side&&v.time>=c.start&&v.time<c.start+8).length;
  const gl=goalTimes.filter(v=>v.side===c.side&&v.time>=c.start&&v.time<c.start+8).length;
  per[lost].shotsAfterLoss8+=sh;per[lost].goalsAfterLoss8+=gl;}
 // Shape while s has the ball in open play (sampled every ~0.5 s): the opponent's
 // last outfield line depth from its own goal (space behind it), and how many
 // opponents are goal-side of the ball.
 let lastSample=-1;
 for(const f of frames){
  if(f.restart||f.time-lastSample<.5)continue;const owner=f.control?.owner??f.ball?.owner;if(!owner)continue;
  const s=sideOf(owner);if(s<0)continue;lastSample=f.time;const o=1-s;
  const opp=roster.map((p,i)=>({p,q:f.players[i]})).filter(x=>x.p.side===o&&x.p.role!=='GK');
  const lineDepth=Math.min(...opp.map(x=>depth(o,x.q.x)));
  const ballDepthO=depth(o,f.ball.x);
  per[s].lineSum+=lineDepth;per[s].lineN++;per[s].behindSum+=Math.max(0,ballDepthO-lineDepth);
  per[s].oppGoalSideSum+=opp.filter(x=>depth(o,x.q.x)<ballDepthO).length;
 }
 const st=(s:number)=>{const x=r.stats[s];return {goals:x.goals,shots:x.shots,onTarget:x.onTarget,passes:x.passes,completed:x.completed,turnovers:x.turnovers,possession:round(x.possession??x.possessionSeconds,2),beaten:x.beaten,feints:x.feints,tackles:x.tackles,tacklesWon:x.tacklesWon,clearances:x.clearances,entries:x.entries,through:x.through,crosses:x.crosses};};
 const pp=(s:number)=>{const p=per[s];return {...p,quality:round(p.quality,3),lineMean:round(p.lineSum/Math.max(1,p.lineN),2),behindMean:round(p.behindSum/Math.max(1,p.lineN),2),oppGoalSide:round(p.oppGoalSideSum/Math.max(1,p.lineN),3),lineSum:undefined,behindSum:undefined,oppGoalSideSum:undefined};};
 // Added after the screen batch: mean outfield energy at full time, and goals per 300 s window.
 const last=frames[frames.length-1];
 const energyEnd=[0,1].map(s=>round(mean(roster.map((p,i)=>({p,q:last.players[i]})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.q.energy)),1));
 // Team-in-possession seconds in open play, INCLUDING own passes in flight (frame.side),
 // unlike stats.possession, which counts only seconds with the ball at a player's feet.
 const teamTime=[0,0];for(let i=1;i<frames.length;i++){const g=frames[i-1];if(!g.restart&&!frames[i].cut&&(g.side===0||g.side===1))teamTime[g.side]+=frames[i].time-g.time;}
 const goalsByWindow=[0,1].map(s=>[0,1,2].map(w=>goalTimes.filter(g=>g.side===s&&g.time>=w*300&&g.time<(w+1)*300).length));
 // ---- Loss probe (direct-turnovers probe.ts, same definitions) ----
 // One row per open-play loss: [loser side, ball depth from the loser's goal,
 // loser outfielders goal-side of the ball (all / excluding the one nearest
 // the ball), winner outfielders goal-side of the ball (from the loser's goal),
 // winner shots < 8 s, winner goals < 10 s, loser regained < 3 s, < 5 s,
 // winner handed it back < 8 s (next chain is the loser's and starts < 8 s),
 // winner break choice in the first 3 s, loser's last action].
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const out8=(f:any,s:number)=>roster.map((p,i)=>({p,q:f.players[i]})).filter(x=>x.p.side===s&&x.p.role!=='GK');
 const losses:any[]=[];
 for(let i=1;i<chains.length;i++){
  const c=chains[i],prev=chains[i-1];if(c.origin!=='recovery'||prev.side===c.side)continue;
  const lo=prev.side,wi=c.side,f=frameAt(c.start),bd=depth(lo,f.ball.x);
  const L0=out8(f,lo),W0=out8(f,wi);
  const near=L0.reduce((a,b)=>Math.hypot(a.q.x-f.ball.x,a.q.y-f.ball.y)<=Math.hypot(b.q.x-f.ball.x,b.q.y-f.ball.y)?a:b);
  const goalSide=L0.filter(x=>depth(lo,x.q.x)<bd).length,restX=L0.filter(x=>x!==near&&depth(lo,x.q.x)<bd).length;
  const ahead=W0.filter(x=>depth(lo,x.q.x)<bd-1).length;
  const sh8=events.filter(v=>v.kind==='shot'&&sideOf(v.actor)===wi&&v.time>=c.start&&v.time<c.start+8).length;
  const gl10=goalTimes.filter(v=>v.side===wi&&v.time>=c.start&&v.time<c.start+10).length;
  const next=chains[i+1];
  const back=(w:number)=>next&&next.side===lo&&next.origin==='recovery'&&next.start<c.start+w?1:0;
  const brk=r.choices.some((ch:any)=>ch.time>=c.start&&ch.time<c.start+3&&roster[ch.player]?.side===wi&&ch.assignment?.purpose==='break')?1:0;
  const last=[...events].reverse().find(e=>e.time<c.start-1e-6&&e.time>=prev.start-1e-6&&sideOf(e.actor)===lo&&['pass','clearance','shot','feint'].includes(e.kind));
  let act='none';if(last){act=last.kind;const g=frameAt(last.time),aim=last.pass?.aim??last.aerial?.aim;if(aim&&act==='pass'){const len=Math.hypot(aim.x-g.ball.x,aim.y-g.ball.y),gain=depth(lo,aim.x)-depth(lo,g.ball.x);act=len>16&&gain>6?'long':gain>6?'fwd':'pass';}}
  // Handback also counts a restart to the loser within 8 s (ball out off the winner).
  const hb=next&&next.side===lo&&next.start<c.start+8?1:0;
  losses.push([lo,round(bd,1),goalSide,restX,ahead,sh8,gl10,back(3),back(5),hb,brk,act]);
 }
 // High-intensity running: metres covered above 0.8 x base pace, per outfielder,
 // per 300 s window, and whether the team had the ball (possession side).
 const hi=[0,1].map(()=>[[0,0],[0,0],[0,0]]);
 for(let i=1;i<frames.length;i++){const g=frames[i-1],h=frames[i];if(h.cut||g.restart)continue;const dt=h.time-g.time;if(dt<=0||dt>.5)continue;const w=Math.min(2,Math.floor(g.time/300));
  roster.forEach((p,k)=>{if(p.role==='GK')return;const q=g.players[k],v=Math.hypot(q.vx,q.vy);if(v>5.6)hi[p.side][w][g.side===p.side?0:1]+=v*dt;});}
 return {seed:t.seed,pair:t.pair,cell:t.cell,arm:t.arm??'main',design:d,build:run.engineBuild.slice(0,12),score:r.score,ms:Math.round(ms),stats:[st(0),st(1)],shape:[pp(0),pp(1)],energyEnd,goalsByWindow,teamTime:teamTime.map(v=>round(v,1)),losses,hi:hi.map(s=>s.map(w=>w.map(v=>Math.round(v))))};
}
export {ENGINE_BUILD};
