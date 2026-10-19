// The plan board's truth, measured (lib/ballers/plan-board.ts): for every
// setting option the chalk sketch depicts, real engine matches are played in
// Node varying ONLY that setting (same squads, same opponent, paired seeds),
// the relevant thing is measured from the real frames in the relevant phase
// (lib/ballers/phase.ts labels them, as the app does), and the direction the
// sketch claims is asserted: an ordering between options with a margin, never
// an exact magnitude. A failing claim is a finding about the SKETCH: fix the
// board to match the engine, not this test.
//
// Deterministic for a given ENGINE_BUILD (fixed seeds), but any engine change
// re-rolls every match, so only claims that clear their margin by much more
// than their own seed-to-seed spread are asserted; the others are logged with
// a confidence word on every run (the gate, below the claim helpers).
// Slow: 22 configurations x 12 seeds x 300 s on a pool of worker threads
// (gp-board-truth.worker.mjs): 21 minutes on a 10-core laptop with 6 workers
// (about 16 with 8), longer when other work shares the machine. Not in any
// default suite. Run it after EVERY engine change (any edit under
// packages/football-engine/src, then node scripts/build.mjs there for the build id):
//   npm run verifica:board-truth   (= npx vitest run verificare/gp-board-truth.test.ts --reporter=verbose
//   to see the claims of the passing tests too; with GP_TRUTH_CACHE=<dir> a second read replays nothing)
// One setting: add -t Width (Striker, Bodies, Progression, losing, Line, Press,
// Keeper, winning, Free kick); the pool still plays every match configuration
// (Free kick alone plays only its own short trainings).
// GP_TRUTH_SEEDS=n (default 12, the gate's seeds; fewer is a quicker look whose words are less sure, and an asserted
// claim can then fail by chance) sets the paired seeds per option. GP_TRUTH_NOFILL=1 with -t
// plays only the configurations the selected tests ask for (a re-check of a few claims).
// Every claim of a test is checked and reported (expect.soft), not only the first that fails.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {Worker} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import fixtureJson from '../lib/ballers/lab/practice-fixture.json';
import {runMatch,ENGINE_BUILD} from '../packages/football-engine/src/index';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import type {Fixture,Team} from '../packages/football-engine/src/model';
import {tacticsOf} from '../lib/ballers/lab/team';
import {settingsSquad,type KeeperSetting} from '../lib/ballers/match-settings';
import {PRESETS,type Formation} from '../lib/ballers/league';
import type {Approach} from '../lib/ballers/approach';
import {phaseLabels,type Phase} from '../lib/ballers/phase';
import type {ReplayEvent,ReplayFrame} from '../lib/ballers/replay';

// ------------------------------------------------------------------ matches
const F=fixtureJson as unknown as {teams:[Team,Team]};
const BASE:Approach=PRESETS.balanced;
// GP_TRUTH_SEED_FROM=k starts the paired seeds k further on (a second, independent draw of the same claims)
const SEEDS=Array.from({length:Number(process.env.GP_TRUTH_SEEDS??12)},(_,i)=>20261002+(i+Number(process.env.GP_TRUTH_SEED_FROM??0))*7919);
const DURATION=300;
interface Config {formation?:Formation;over?:Partial<Approach>;keeper?:'own'|KeeperSetting;setPiece?:'short'|'mixed'|'delivery'}
/** Home: the practice fixture's club, varying one setting over Balanced. Away: the practice opponent playing Balanced 1-2-1. */
function fixtureOf(seed:number,c:Config):Fixture{
 const home=structuredClone(F.teams[0]),away=structuredClone(F.teams[1]);
 // the keeper's own trait is the engine default (0.2) unless the plan overrides it
 home.squad=home.squad.map(p=>{if(!p.roles.includes('GK'))return p;const {keeperSweep:_x,...traits}=p.traits;void _x;return {...p,traits};});
 if(c.keeper&&c.keeper!=='own')home.squad=settingsSquad(home.squad,{keeper:c.keeper});
 home.tactics=tacticsOf(c.formation??'1-2-1',{...BASE,...c.over},c.setPiece&&c.setPiece!=='mixed'?{setPiece:c.setPiece}:undefined);
 away.tactics=tacticsOf('1-2-1',BASE);
 return {seed,kickoff:0,teams:[home,away]};
}
interface Slim {build:string;players:{id:string;side:0|1;role:string;lane:number}[];score:[number,number];
 frames:{t:number;ps:0|1;b:[number,number,number];o:number;r:0|1;p:[number,number,string][]}[];
 events:{t:number;k:string;a:number;g:number;s?:0|1;rk?:string;aim:[number,number]|null;loft:boolean}[];
 jobs:[number,number,string|null][]}

let workers:Worker[]=[];
const pending=new Map<number,{resolve:(s:Slim)=>void;reject:(e:Error)=>void}>();
const queue:{id:number;job:unknown}[]=[];const idle:Worker[]=[];let nextId=0;
function pump(){while(idle.length&&queue.length){const w=idle.pop()!,j=queue.shift()!;w.postMessage(j);}}
// GP_TRUTH_CACHE=<dir> keeps every played match on disk, keyed by the job and ENGINE_BUILD (and GP_TRUTH_ENGINE), so
// re-reading the claims after editing this file replays nothing. The key is the generated build id: regenerate
// build-info.ts (packages/football-engine: node scripts/build.mjs) after an engine edit, or the cache serves stale matches.
const CACHE=process.env.GP_TRUTH_CACHE;
function play(job:{kind:'match'|'freeKick';fixture:Fixture;duration:number;ball?:{x:number;y:number}},first=false):Promise<Slim>{
 const file=CACHE?path.join(CACHE,createHash('sha256').update(JSON.stringify([ENGINE_BUILD,process.env.GP_TRUTH_ENGINE??'',job])).digest('hex').slice(0,24)+'.json.gz'):undefined;
 if(file&&existsSync(file))return Promise.resolve(JSON.parse(gunzipSync(readFileSync(file)).toString()));
 return new Promise<Slim>((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});if(first)queue.unshift({id,job});else queue.push({id,job});pump();})
  .then(out=>{if(file){mkdirSync(CACHE!,{recursive:true});writeFileSync(file,gzipSync(JSON.stringify(out)));}return out;});
}
beforeAll(()=>{
 // GP_TRUTH_WORKERS caps the pool (e.g. 6 while other work shares the machine).
 const n=Math.max(1,Math.min(Number(process.env.GP_TRUTH_WORKERS??8),availableParallelism()-2));
 workers=Array.from({length:n},()=>{
  const w=new Worker(new URL('./gp-board-truth.worker.mjs',import.meta.url));
  w.on('message',({id,out,error})=>{const p=pending.get(id)!;pending.delete(id);idle.push(w);pump();if(error)p.reject(Error(error));else p.resolve(out);});
  w.on('error',e=>{for(const p of pending.values())p.reject(e);});
  idle.push(w);return w;
 });
});
afterAll(async()=>{await Promise.all(workers.map(w=>w.terminate()));});

const cache=new Map<string,Promise<Slim[]>>();
/** The paired matches for one configuration (shared between settings: the base is played once). */
const matches=(c:Config)=>{const key=JSON.stringify([c.formation??'1-2-1',{...BASE,...c.over},c.keeper??'own',c.setPiece??'mixed']);if(!cache.has(key))cache.set(key,Promise.all(SEEDS.map(seed=>play({kind:'match',fixture:fixtureOf(seed,c),duration:DURATION}))));return cache.get(key)!;};

// ------------------------------------------------------------------ reading frames
/** Our (home, side 0) phase per frame, from the app's one phase function. */
const labelled=new WeakMap<Slim,Phase[]>();
function labelsOf(m:Slim):Phase[]{
 if(labelled.has(m))return labelled.get(m)!;
 const frames=m.frames.map(f=>({t:f.t,p:[],b:[f.b[0]*100,f.b[1]*100,f.b[2]*100],o:f.o,ps:f.ps,s:[0,0],...(f.r?{r:1}:{})}) as ReplayFrame);
 const events=m.events.map(e=>({t:e.t,k:e.k,x:'',...(e.s!==undefined?{s:e.s}:{}),...(e.rk?{rk:e.rk}:{})}) as ReplayEvent);
 const out=phaseLabels(frames,events,0);labelled.set(m,out);return out;
}
/** Player n's engine job at each frame (his latest decision's assignment). */
const jobbed=new WeakMap<Slim,Map<number,(string|null)[]>>();
function jobsOf(m:Slim,n:number):(string|null)[]{
 if(!jobbed.has(m))jobbed.set(m,new Map());const per=jobbed.get(m)!;if(per.has(n))return per.get(n)!;
 const mine=m.jobs.filter(j=>j[1]===n);let k=-1;
 const out=m.frames.map(f=>{while(k+1<mine.length&&mine[k+1][0]<=f.t)k++;return k<0?null:mine[k][2];});
 per.set(n,out);return out;
}
type Frame=Slim['frames'][number];
const OUT=[1,2,3,4];
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:NaN;
const dist=(f:Frame,i:number)=>Math.hypot(f.p[i][0]-f.b[0],f.p[i][1]-f.b[1]);
/** Mean over every match of a per-frame value, on frames that pass `when`. */
function over(ms:Slim[],when:(f:Frame,phase:Phase,m:Slim,i:number)=>boolean,value:(f:Frame,m:Slim,i:number)=>number){
 const xs:number[]=[];
 for(const m of ms){const l=labelsOf(m);m.frames.forEach((f,i)=>{if(!f.r&&when(f,l[i],m,i)){const v=value(f,m,i);if(Number.isFinite(v))xs.push(v);}});}
 return mean(xs);
}
const ballAt=(m:Slim,t:number)=>{let lo=0,hi=m.frames.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(m.frames[mid].t<=t)lo=mid;else hi=mid-1;}return lo;};

describe('the worker plays the app’s engine',()=>{
 it('a worker match is the very same match as one played here',async()=>{
  const fx=fixtureOf(7,{});
  const here=runMatch({fixture:structuredClone(fx),durationSeconds:30,policy:'coordinated',substitutions:'none',record:true}).result as unknown as {score:[number,number];frames:{players:{x:number;y:number}[]}[];events:unknown[]};
  const there=await play({kind:'match',fixture:fx,duration:30},true);
  expect(there.score).toEqual(here.score);
  expect(there.events.length).toBe(here.events.length);
  const last=here.frames.at(-1)!.players.map(p=>[p.x,p.y]);
  expect(there.frames.at(-1)!.p.map(p=>[p[0],p[1]])).toEqual(last);
 },60000);
});

// ------------------------------------------------------------------ claims
type Vals=Record<string,number>;
const note=(what:string,v:Vals)=>console.log(`  ${what}: ${Object.entries(v).map(([k,x])=>`${k} ${x.toFixed(2)}`).join(' · ')}`);
// ---- The gate (settings close-out, 2026-10-04) ----
// At 6 seeds × 300 s many claims flipped sign between two draws of the same build, and any engine edit re-rolls every
// match, so a fixed margin on a noisy reading made the gate fail or pass by luck. Every claim now reports its own
// spread: the same reading on each paired seed alone gives the step's seed-to-seed sd, so se = sd / √seeds is how much
// this run's difference would move on another draw. Two numbers are printed for every step:
//   z = (difference − margin) / se: does the claim hold BY ITS MARGIN, and
//   the direction, (difference) / se: is the order itself there at all,
// each with a confidence word: clear (≥ 2), likely (≥ 1), too few to tell (−1..1), likely not (≤ −1), clearly not (≤ −2).
// A step is ASSERTED (gate: true) only where, on the 12-seed run of the build that set the gate (56fc996d, results in
// evidence/2026-10-04-settings-closeout), it cleared its margin by much more than its spread:
//   - a distance or an outcome (positions, gains, maxima): z ≥ 3;
//   - a mechanism (who does what: an engine job's share, a decision's share, where men stand at a set piece): z ≥ 2,
//     because its cause is a rule in the engine and its spread is only how often the situation comes up.
// Every other step is LOGGED with its words and never fails the gate. Margins were never lowered to move a claim into
// the asserted set: a claim that cannot clear its margin is logged, and its copy or drawing goes to the owner.
// The words printed on every run are the claim's real confidence; a logged step reading "likely not" or "clearly not"
// is a finding about the copy or the board, to be read every run.
const perSeed=new WeakMap<Vals,Record<string,number[]>>();
const word=(z:number)=>z>=2?'clear':z>=1?'likely':z>-1?'too few to tell':z>-2?'likely not':'clearly not';
function spread(v:Vals,a:string,b:string,m:number){
 const s=perSeed.get(v),d=s?s[b].map((x,i)=>x-s[a][i]).filter(Number.isFinite):[];
 if(d.length<3)return '';
 const mu=d.reduce((p,q)=>p+q,0)/d.length,sd=Math.sqrt(d.reduce((p,q)=>p+(q-mu)**2,0)/(d.length-1)),se=sd/Math.sqrt(d.length)||1e-9,z=(v[b]-v[a]-m)/se,dir=(v[b]-v[a])/se;
 return ` [se ${se.toFixed(2)} on ${d.length} seeds; by its margin z ${z.toFixed(1)}: ${word(z)}; the order itself ${dir.toFixed(1)}: ${word(dir)}]`;
}
/** values[order[i+1]] − values[order[i]] ≥ margin for each step (a negative margin: "not reversed by more than").
 * `gate`: which steps are asserted (see the gate above); the others are logged with their confidence words. */
function rises(what:string,v:Vals,order:string[],margin:number|number[],gate:boolean|boolean[]=true){
 note(what,v);
 order.slice(1).forEach((k,i)=>{const m=Array.isArray(margin)?margin[i]:margin,a=order[i],g=Array.isArray(gate)?gate[i]:gate;
  console.log(`    ${a} → ${k}: ${(v[k]-v[a]).toFixed(2)} (${g?'asserted':'logged, claim'} ≥ ${m})${spread(v,a,k,m)}`);
  if(g)expect.soft(v[k]-v[a],`${what}: ${a} ${v[a].toFixed(2)} → ${k} ${v[k].toFixed(2)} (margin ${m})`).toBeGreaterThanOrEqual(m);});
}
/** A claim logged with its confidence words on every step, never asserted. */
const logs=(what:string,v:Vals,order:string[],margin:number|number[])=>rises(what,v,order,margin,false);
const withBall=(p:Phase)=>p==='build'||p==='attack';
const OPTS={
 width:['narrow','standard','wide'],line:['deep','standard','high'],press:['selective','balanced','aggressive'],
 commit:[1,2,3,4,5],progression:['patient','mixed','direct'],striker:['run','link','pivot','mixed'],onLoss:['regroup','balanced','counterpress'],transition:['secure','balanced','counter'],
} as const;
type Key=keyof typeof OPTS;
const configs=(k:Key):Record<string,Config>=>Object.fromEntries(OPTS[k].map(v=>[String(v),{over:{[k]:v} as Partial<Approach>}]));
const KEEPER:Record<string,Config>={line:{keeper:'line'},own:{},sweeper:{keeper:'sweeper'}};
const play_=async(cs:Record<string,Config>)=>(fill(),Object.fromEntries(await Promise.all(Object.entries(cs).map(async([k,c])=>[k,await matches(c)]))) as Record<string,Slim[]>);
const each=(set:Record<string,Slim[]>,f:(ms:Slim[])=>number):Vals=>{
 const v:Vals=Object.fromEntries(Object.entries(set).map(([k,ms])=>[k,f(ms)]));
 perSeed.set(v,Object.fromEntries(Object.entries(set).map(([k,ms])=>[k,ms.map(m=>f([m]))])));
 return v;
};
const t0=performance.now();
// The first match test fills the pool with every option of every setting, so no test waits on an idle
// worker (a run filtered to one test with -t still plays them all; only Free kick alone plays none).
let filled=false;
function fill(){if(filled||process.env.GP_TRUTH_NOFILL)return;filled=true;for(const k of Object.keys(OPTS) as Key[])for(const c of Object.values(configs(k)))void matches(c);for(const c of Object.values(KEEPER))void matches(c);}
afterAll(()=>console.log(`gp-board-truth: ${cache.size} configurations × ${SEEDS.length} seeds × ${DURATION} s in ${((performance.now()-t0)/1000).toFixed(0)} s`));
const SLOW=1800000;

describe('With the ball',()=>{
 it('Width: wingers hold wider lanes narrow → standard → wide, and the span widens (1-2-1)',async()=>{
  const S=await play_(configs('width'));
  rises('wingers mean |y| with the ball',each(S,ms=>over(ms,(f,p)=>withBall(p),f=>(Math.abs(f.p[2][1])+Math.abs(f.p[3][1]))/2)),['narrow','standard','wide'],.2,[true,false]);
  rises('outfield span (widest − narrowest y) with the ball',each(S,ms=>over(ms,(f,p)=>withBall(p),f=>{const ys=OUT.map(i=>f.p[i][1]);return Math.max(...ys)-Math.min(...ys);})),['narrow','standard','wide'],.3);
  // the sketch pulls Narrow's and Standard's wingers 12% toward the ball's side and Wide's not at all (WINGER_PULL).
  // (close-out, 12 seeds on 56fc996d) narrow 3.83 / standard 3.90 / wide 3.08 m: Narrow does NOT pull the wingers to
  // the ball's side more than Standard (the engine's 35% for Narrow is not what the matches show), only more than Wide
  // (likely), so the board was redrawn (pre-push, 2026-10-04): Narrow draws Standard's pull. Its claims: Narrow alike
  // Standard (within 0.5 m either way, logged: z 1.6 and 2.1 on that run, under the 3-se bar) and both above Wide.
  const pull=each(S,ms=>over(ms,(f,p)=>withBall(p)&&Math.abs(f.b[1])>4&&f.o!==2&&f.o!==3,f=>(f.p[2][1]+f.p[3][1])/2*Math.sign(f.b[1])));
  rises('wingers toward the ball’s side (ball |y| > 4)',pull,['wide','narrow'],.3,false);
  rises('wingers toward the ball’s side, Narrow alike Standard (not below it by more than 0.5 m)',pull,['standard','narrow'],-.5,false);
  rises('wingers toward the ball’s side, Narrow alike Standard (not above it by more than 0.5 m)',pull,['narrow','standard'],-.5,false);
  rises('wingers toward the ball’s side (ball |y| > 4)',pull,['wide','standard'],-.5);
 },SLOW);
 // (2026-10-11) "Width in 2-1-1: the centre-backs split narrow → standard → wide" is gone: the width check
 // (234 matches, branch width-check) found the three options played the same football in 2-1-1, so the screens
 // no longer offer Width there and the side plays Standard (lib/ballers/approach.ts playedApproach, which
 // tacticsOf applies), and the board draws no width mark in that shape.
 it('Striker: In behind lives on their last line and runs past it; Pivot holds it; Drops deep holds a post between their lines',async()=>{
  const S=await play_(configs('striker'));
  const attacking=(f:Frame,p:Phase)=>p==='attack'&&f.o>=1&&f.o<=3;
  const lastLine=(f:Frame)=>Math.max(...[6,7,8,9].map(i=>f.p[i][0]));
  // In behind (settings round, 2026-10-03): on their last outfielder's shoulder (engine job "shoulder") or running past him ("depth")
  rises('striker on their last line or running past it (engine jobs "shoulder" + "depth"), attacking',each(S,ms=>over(ms,attacking,(f,m,i)=>['shoulder','depth'].includes(jobsOf(m,4)[i]??'')?1:0)),['mixed','run'],.1);
  rises('striker x − ball x, attacking',each(S,ms=>over(ms,attacking,f=>f.p[4][0]-f.b[0])),['mixed','run'],1);
  note('(position) striker beyond their last outfielder, attacking',each(S,ms=>over(ms,attacking,f=>f.p[4][0]>lastLine(f)?1:0)));
  // Drops deep: the link post between their lines, and a team-mate's run beyond him
  rises('striker on the link job (between their lines), attacking',each(S,ms=>over(ms,attacking,(f,m,i)=>jobsOf(m,4)[i]==='link'?1:0)),['mixed','link'],.2);
  // the team-mate's run beyond him is offered whenever he shows or has the ball; measured small (cloud screen +3 pp), so drawn faint
  note('(link, faint) a winger on a run in behind (engine job "depth"), attacking',each(S,ms=>over(ms,attacking,(f,m,i)=>[2,3].some(n=>n!==f.o&&jobsOf(m,n)[i]==='depth')?1:0)));
  note('(position) striker x − ball x, attacking',each(S,ms=>over(ms,attacking,f=>f.p[4][0]-f.b[0])));
  const off=each(S,ms=>over(ms,(f,p)=>withBall(p)&&f.o>=0&&f.o<=3&&f.b[0]>20,f=>Math.abs(f.p[4][0]-lastLine(f))));
  rises('striker’s distance from their last outfielder (lower = holds their line)',off,['pivot','mixed'],.5);
  rises('striker’s distance from their last outfielder (lower = holds their line)',off,['run','mixed'],.5,false);
  rises('striker’s distance from their last outfielder (lower = holds their line)',off,['pivot','link'],.8,false);
  // Pivot (settings round): team-mates prefer a ball into his feet while he shows, more when pressed; the
  // share of passes into him did not rise in the cloud screen (28% vs 29%), so the board draws no pass into him
  note('(not drawn) share of our passes to the striker',each(S,ms=>{let n=0,k=0;for(const m of ms)for(const e of m.events){if(e.k!=='pass'||e.s!==0||e.rk)continue;n++;if(e.g===4)k++;}return k/n;}));
 },SLOW);
 it('Bodies forward: the bound — two / one always back at 1 / 2, Go for it keeps nobody back (4 / 5 joins: owner decision)',async()=>{
  const S=await play_(configs('commit'));
  const attacking=(f:Frame,p:Phase)=>p==='attack'&&f.o>=1&&f.o<=4&&f.b[0]>=24;
  const rest=(f:Frame)=>OUT.filter(i=>i!==f.o&&f.p[i][0]<f.b[0]-4).length;   // REST_MARGIN goal-side of the ball
  const share=(pred:(r:number)=>boolean)=>each(S,ms=>over(ms,attacking,f=>pred(rest(f))?1:0));
  const two=share(r=>r>=2),one=share(r=>r>=1),most2=share(r=>r<=2),most1=share(r=>r<=1);
  rises('≥ 2 of the three behind the ball (the 1 bar)',two,['3','1'],.1,false);
  rises('≥ 2 of the three behind the ball (the 1 bar)',two,['2','1'],.1,false);
  rises('≥ 1 of the three behind the ball (the 2 bar)',one,['3','2'],-.02,false);
  // OWNER DECISION (settings-truth round, 2026-10-04): 4 and 5 are not told apart from 3 on this fixture. On two builds
  // of the round (the second changed nothing in attack, yet moved 3 itself by +0.09 and +0.11) the 4 run read +0.08
  // then −0.01 over 3, and the 5 runs +0.12 then +0.02: the base moves as much as the effect, so 6 seeds × 300 s
  // cannot say whether 4 and 5 still do something distinct (too few matches to tell; a cloud screen can). Logged,
  // not asserted, until the owner decides (keep the options and measure them, or rethink them).
  note('(owner decision, not asserted) ≤ 2 behind, one joins (the 4 run)',most2);
  note('(owner decision, not asserted) ≤ 1 behind, two join (the 5 runs)',most1);
  // Go for it has no bar: it keeps one back no more often than Balanced (the sketch drew one until 2 Oct). Both are
  // ~0.95, so a margin of 0 asked for a strict order between two equal shares; the claim is "not more often"
  // (settings-truth round: 0.97/0.94 on one build, 0.95/0.96 on the next)
  rises('≥ 1 of the three behind the ball (no bar at 5)',one,['5','3'],-.03,false);
  // (settings-truth round, 2026-10-04) Since the defending rebuild our deepest man in their half is the rest guard, kept
  // goal-side of THEIR most advanced forward (practice-coordination restGuards), not a slot of our shape: his height follows
  // their forward, whatever Bodies forward says (not ordered: 1 −14.1, 3 −14.5, 5 −13.4 m on one build). The shape that moves
  // with the setting is everyone else's: the board draws the back line still and the rest of the shape (commit−3) m higher.
  note('(not drawn) deepest outfielder x − ball x (the rest guard, held by their forward; 1 −14.7, 3 −13.6, 5 −13.5 m)',each(S,ms=>over(ms,attacking,f=>Math.min(...OUT.filter(i=>i!==f.o).map(i=>f.p[i][0]))-f.b[0])));
  const shape=each(S,ms=>over(ms,attacking,f=>{const o=OUT.filter(i=>i!==f.o).sort((a,b)=>f.p[a][0]-f.p[b][0]).slice(1);return mean(o.map(i=>f.p[i][0]))-f.b[0];}));
  rises('our outfielders bar the carrier and the deepest, x − ball x (the shape sits higher)',shape,['1','3'],.5,false);
  // OWNER DECISION: 5 over 3 is not measured higher (−0.32 m on this build); see the 4 / 5 note above
  note('(owner decision, not asserted) the same, 3 → 5',shape);
 },SLOW);
});

describe('Building from the back',()=>{
 it('Progression: patient plays short, direct goes long (> 13 m)',async()=>{
  const S=await play_(configs('progression'));
  const passes=(ms:Slim[],value:(gain:number)=>number)=>{const xs:number[]=[];
   for(const m of ms){const l=labelsOf(m);for(const e of m.events){if(e.k!=='pass'||e.s!==0||!e.aim||e.rk)continue;const i=ballAt(m,e.t);if(l[i]==='build')xs.push(value(e.aim[0]-m.frames[i].b[0]));}}return mean(xs);};
  // (close-out) Logged: a match has only ~10-20 build-up passes, so the seed-to-seed spread of these shares and gains is
  // large; on 12 seeds the mean gain reads 2.88 / 4.95 / 6.99 m (each step likely, by its margin and in its order) and
  // Direct's share of passes over 13 m is clearly above Mixed's (0.20 against 0.07), by its margin only likely.
  rises('passes gaining > 13 m, building up',each(S,ms=>passes(ms,g=>g>13?1:0)),['patient','mixed','direct'],[0,.03],false);
  rises('mean forward gain of a pass, building up',each(S,ms=>passes(ms,g=>g)),['patient','mixed','direct'],.4,false);
 },SLOW);
});

describe('Just lost it',()=>{
 it('On losing it: counter-press goes at the ball whatever the numbers, Balanced only a man up; regroup gets more men goal-side',async()=>{
  const S=await play_(configs('onLoss'));
  const near=(f:Frame,k:number)=>OUT.map(i=>dist(f,i)).sort((a,b)=>a-b)[k];
  // (settings-truth round, 2026-10-04) The board draws the decision: Counter-press sends the nearest at the ball and the
  // next to screen the escape pass, Balanced does that only a man up, Regroup never (the others sprint goal-side).
  // Counter-press now goes whatever the numbers (practice-coordination counterPressRead; at parity only it went in
  // 29% of the loss seconds against Balanced's 21%). The distances to the ball no longer tell the options apart: since
  // the defending rebuild Balanced's ordinary press also goes at a carrier within 31 m of our goal at once (most
  // losses are there), so Counter-press's men are not nearer the ball on average (3.83 vs 3.66 m, the screen 7.51 vs
  // 7.23) and it keeps about as many goal-side (1.40 vs 1.35): logged. Whether it wins the ball back sooner is not measured here.
  const cp=each(S,ms=>over(ms,(_f,p)=>p==='loss',(f,m,i)=>OUT.some(n=>jobsOf(m,n)[i]==='counter-press')?1:0));
  rises('a counter-press on (engine job "counter-press"), losing it',cp,['regroup','balanced','counterpress'],[.1,.1]);
  note('a man on the escape pass (engine job "counter-screen"), losing it',each(S,ms=>over(ms,(_f,p)=>p==='loss',(f,m,i)=>OUT.some(n=>jobsOf(m,n)[i]==='counter-screen')?1:0)));
  note('(not asserted) nearest to the ball, losing it',each(S,ms=>over(ms,(_f,p)=>p==='loss',f=>near(f,0))));
  note('(not asserted) second nearest to the ball, losing it',each(S,ms=>over(ms,(_f,p)=>p==='loss',f=>near(f,1))));
  const goalSide=each(S,ms=>over(ms,(_f,p)=>p==='loss',f=>OUT.filter(i=>f.p[i][0]<f.b[0]-5).length));
  rises('outfielders ≥ 5 m goal-side of the ball, losing it',goalSide,['balanced','regroup'],.1,false);
  note('(not asserted) outfielders ≥ 5 m goal-side, Counter-press against Balanced',goalSide);
 },SLOW);
});

describe('Without the ball',()=>{
 it('Line: the back line sits deeper → higher with their ball in their half',async()=>{
  const S=await play_(configs('line'));
  const theirHalf=(f:Frame,p:Phase)=>p==='defend'&&f.b[0]>24;
  // (pre-push, 2026-10-04) The board draws the back line where our LAST MAN stands (LAST_MAN 15.5 / 17 / 18.5 m, read
  // from 'our last outfielder' below on the close-out run), the block keeping its gaps; it used to draw the BLOCK
  // ceiling (15 / 20 / 26 m), which only the free (balance) man approaches. The board's own claims are the last man and
  // the block, logged (likely: under the 3-se bar). The balance man's step stays asserted: it is the engine's Line itself
  // (the free man steps up 5 m from Standard to High), what the copy's "how hard it steps up" rests on.
  // (close-out, 2026-10-04) Deep → Standard is asserted on the centre-back, Standard → High on the balance man. The
  // centre-back alone no longer tells Standard from High
  // (z 0.3): since the settings-truth round a defender whose man becomes their spare man is dealt a new job at once
  // (S3), and in a High line the centre-back now takes their deep-running winger more often (30% of these frames
  // against 20%), so he is more often our last man. The team's last line did not drop: our deepest outfielder
  // stands at 18.50 m (High) against 18.87 m on d7bc2fb5 (12 seeds), and on seeds 0-5 at 18.85 with S3 against 18.75
  // with S3 switched off (centre-back 23.45 against 26.00). Logged: the last line and the block, High +1.4 m over
  // Standard (likely, not clear: the last man keeps their deepest forward in front of him whatever the Line).
  rises('centre-back x, their ball in their half',each(S,ms=>over(ms,theirHalf,f=>f.p[1][0])),['deep','standard','high'],1,[true,false]);
  logs('our last outfielder x (the back line), their ball in their half',each(S,ms=>over(ms,theirHalf,f=>Math.min(...OUT.map(i=>f.p[i][0])))),['deep','standard','high'],.5);
  logs('our outfielders’ mean x (the block), their ball in their half',each(S,ms=>over(ms,theirHalf,f=>mean(OUT.map(i=>f.p[i][0])))),['deep','standard','high'],.5);
  const job=(m:Slim,i:number,n:number,j:string)=>jobsOf(m,n)[i]===j;
  rises('the balance man’s x (engine job "balance": the free man, not drawn on his own), their ball beyond 34.6 m',each(S,ms=>over(ms,(f,p)=>p==='defend'&&f.b[0]>34.6,(f,m,i)=>{const n=OUT.find(n=>job(m,i,n,'balance'));return n===undefined?NaN:f.p[n][0];})),['deep','standard','high'],1,[false,true]);
  logs('ours marking a man (engine job "mark"), their ball beyond 34.6 m',each(S,ms=>over(ms,(f,p)=>p==='defend'&&f.b[0]>34.6,(f,m,i)=>OUT.filter(n=>job(m,i,n,'mark')).length)),['deep','standard','high'],.2);
 },SLOW);
 // (settings-truth round, 2026-10-04) The defending rebuild replaced the ball-anchored block these claims were written
 // for: Press now sets where the man on the carrier engages (practice-defending ENGAGE, from 22 / 31 m / anywhere, the
 // Line shifting it) and how far off he waits before that (HOLD 5.5 / 4 / 2.5 m), how many of their men are worth
 // marking further out (DANGER_PRESS, WATCH_PRESS) and how far a marker sags (PRESS_SAG); Selective keeps its trap and
 // Aggressive doubles on a trigger. There is no outlet screen any more (Aggressive's old screen) and "pressing or
 // screening" counts one presser for all three, so the claims are about the presser's distance, who is marked and the
 // heights. (Aggressive's back line looked higher on one draw; on 12 seeds it is too few to tell, so the board draws all
// three alike since the pre-push round.)
 it('Press: Selective springs its trap around halfway (and waits off the carrier a little there), Aggressive engages anywhere and marks more men; the back line alike',async()=>{
  const S=await play_(configs('press'));
  const far=(f:Frame,p:Phase)=>p==='defend'&&f.o>=5&&f.b[0]>34.6;   // their man on the ball beyond the trap zone
  const mid=(f:Frame,p:Phase)=>p==='defend'&&f.o>=5&&f.b[0]>23&&f.b[0]<31;   // between Selective's and Balanced's engagement
  const job=(m:Slim,i:number,n:number,...js:string[])=>js.includes(jobsOf(m,n)[i]??'');
  const presser=(when:(f:Frame,p:Phase)=>boolean)=>each(S,ms=>over(ms,when,(f,m,i)=>{const n=OUT.find(n=>job(m,i,n,'press'));return n===undefined?NaN:dist(f,n);}));
  const midOff=presser(mid);
  // (close-out, 12 seeds) Selective's man waits further off than Balanced's between 23 and 31 m (+0.64 m, the order clear)
  // but not by the 1 m the old sketch drew (likely not); beyond 34.6 m he stands NEARER than Balanced's (6.02 against
  // 6.88 m, likely not): "waits off the carrier until he is near" holds only between the two engage points.
  // (pre-push, 2026-10-04) Redrawn and reworded to that: the board's carrier is beyond 34.6 m, where Selective's and
  // Balanced's men wait alike (PRESS_WAIT) and Aggressive's engages; Selective's line says only "springs a two-man
  // trap around halfway on a cue, holding off a little until then": the trap (asserted below) and the order read here (logged; the old 1 m
  // margin is kept as the record, the copy rests on the order's word). Aggressive's higher centre-back (+1.95 m, se
  // 2.5 m, too few to tell) is no longer drawn: every Press option draws the same back line.
  rises('the man on the carrier, his distance off him, carrier 23–31 m from our goal',midOff,['balanced','selective'],1,false);
  // (Aggressive's man there was further off than Balanced's, 4.98 against 4.18 m: not ordered, logged)
  note('(not asserted) the same, Aggressive',midOff);
  const farOff=presser(far);
  rises('the man on the carrier, his distance off him, carrier beyond 34.6 m',farOff,['aggressive','balanced'],.5,false);
  // drawn alike out here: Selective's man not further off than Balanced's by more than 0.5 m
  rises('the same, Selective alike Balanced (not further off by more than 0.5 m)',farOff,['selective','balanced'],-.5,false);
  rises('a trap sprung, carrier 22–34.6 m (Selective only)',each(S,ms=>over(ms,(f,p)=>p==='defend'&&f.o>=5&&f.b[0]>22&&f.b[0]<34.6,(f,m,i)=>OUT.some(n=>job(m,i,n,'trap','trap-screen'))?1:0)),['balanced','selective'],.05);
  // (Selective marks about as many as Balanced up there, 2.52 against 2.51; one build earlier 2.3 against 2.7: logged)
  const marking=each(S,ms=>over(ms,far,(f,m,i)=>OUT.filter(n=>job(m,i,n,'mark','press')).length));
  rises('ours marking a man or on the carrier (engine jobs "mark", "press"), carrier beyond 34.6 m',marking,['balanced','aggressive'],.3,false);
  note('(not asserted) the same, Selective',marking);
  note('(not drawn) a screen in the middle, beyond 34.6 m',each(S,ms=>over(ms,far,(f,m,i)=>OUT.some(n=>job(m,i,n,'screen'))?1:0)));
  const lean=each(S,ms=>over(ms,(f,p)=>p==='defend'&&Math.abs(f.b[1])>4,f=>{const n=OUT.slice().sort((a,b)=>dist(f,a)-dist(f,b))[0];return mean(OUT.filter(i=>i!==n).map(i=>f.p[i][1]))*Math.sign(f.b[1]);}));
  // the board draws the three leans alike (BLOCK_LEAN): 1.23 / 1.14 / 1.26 m on this build, 1.29 / 1.39 / 2.17 on the
  // one before, so no order is claimed
  note('(drawn alike, not asserted) the block’s lean toward the ball (all but the nearest), ball |y| > 4',lean);
  const block=each(S,ms=>over(ms,far,(f,m,i)=>mean(OUT.filter(n=>!job(m,i,n,'press','screen','trap','trap-screen')).map(n=>f.p[n][0]))));
  // (Aggressive's block +1.55 m over Balanced's on one build, +0.48 on the next; Selective's not deeper: drawn alike)
  note('(drawn alike, not asserted) block height (outfielders not pressing), beyond 34.6 m',block);
  const cb=each(S,ms=>over(ms,far,f=>f.p[1][0]));
  // drawn alike (pre-push): read on every run in case a build makes the order real (12 seeds on 56fc996d: 24.18 / 24.04 /
  // 25.99 m, both steps too few to tell); the old ±0.5 m claims are kept as the record
  rises('(drawn alike) centre-back x, carrier beyond 34.6 m (the old sketch: Selective deeper, Aggressive higher)',cb,['selective','balanced','aggressive'],[.5,.5],false);
 },SLOW);
 // (settings-truth round, 2026-10-04) Behaviour round A's keeperLineDepth pulled every keeper up behind his back line,
 // the line keeper too, and a line keeper carried the ball or offered a pass back 15-20 m out, so "Stay on line"
 // came further out than "As usual" (12.75 against 11.99 m). Fixed in the engine (KEEPER_HOME: a keeper who stays
 // on his line does none of the three); the claims are unchanged.
 it('Keeper: stay on line < his own way < sweeper, in reach and in where he stands',async()=>{
  const S=await play_(KEEPER);
  rises('keeper x, their ball in their half',each(S,ms=>over(ms,(f,p)=>p==='defend'&&f.b[0]>24,f=>f.p[0][0])),['line','own','sweeper'],[.2,1]);
  rises('furthest the keeper comes without the ball (mean of match maxima)',each(S,ms=>mean(ms.map(m=>{const l=labelsOf(m);return Math.max(...m.frames.filter((f,i)=>!f.r&&(l[i]==='defend'||l[i]==='loss')).map(f=>f.p[0][0]));}))),['line','own','sweeper'],[.3,.5],[true,false]);
  rises('keeper x with the ball, ball beyond 26 m',each(S,ms=>over(ms,(f,p)=>withBall(p)&&f.b[0]>26,f=>f.p[0][0])),['line','own','sweeper'],[-.3,.5]);
 },SLOW);
});

describe('Just won it back',()=>{
 it('On winning it: a counter runs; keep it makes no runs and plays short',async()=>{
  const S=await play_(configs('transition'));
  const regains=(m:Slim)=>m.frames.flatMap((f,i)=>i>0&&!f.r&&!m.frames[i-1].r&&f.ps===0&&m.frames[i-1].ps===1?[f.t]:[]);
  const long=each(S,ms=>{let n=0,k=0;for(const m of ms)for(const t of regains(m)){const e=m.events.find(e=>e.t>=t&&e.t<t+8000&&e.k==='pass'&&e.s===0&&e.aim&&!e.rk);if(!e)continue;n++;if(e.aim![0]-m.frames[ballAt(m,e.t)].b[0]>13)k++;}return k/Math.max(1,n);});
  // since the settings round a Counter side's striker waits on their last line during its counter window (In
  // behind's shoulder), and its first ball is no longer longer than Balanced's on this fixture: drawn faint.
  // (settings-truth round, 2026-10-04) About 55 regains an option on this fixture: a share of them is too few to order
  // (one long pass is ±0.02), so the share is logged and the claims are on the whole of every regain: how far
  // forward the first pass goes, and how far forward the ball is 4 s after the regain (a carry counts).
  note('(too few to order) first pass within 8 s gaining > 13 m',long);
  const firstGain=each(S,ms=>{const xs:number[]=[];for(const m of ms)for(const t of regains(m)){const e=m.events.find(e=>e.t>=t&&e.t<t+8000&&e.k==='pass'&&e.s===0&&e.aim&&!e.rk);if(e)xs.push(e.aim![0]-m.frames[ballAt(m,e.t)].b[0]);}return mean(xs);});
  rises('forward gain of the first pass within 8 s (m)',firstGain,['secure','balanced'],.5,false);
  const ballOn=each(S,ms=>{const xs:number[]=[];for(const m of ms)for(const t of regains(m)){const a=m.frames[ballAt(m,t)],b=m.frames[ballAt(m,t+4000)];if(!b.r)xs.push(b.b[0]-a.b[0]);}return mean(xs);});
  rises('ball x 4 s after the regain − where it was won (m)',ballOn,['secure','balanced'],.5,false);
  // OWNER DECISION: Counter makes the most runs (below) but its ball does not go forward sooner than Balanced's: first
  // pass 1.7 against 3.1 m forward, the ball 5.4 against 6.0 m on 4 s later (this build; about 55 regains an option,
  // too few to call the gap, but not the "breaks at once" its line promises). Logged, not asserted.
  note('(owner decision, not asserted) the same two, Counter against Balanced',{counter_first:firstGain.counter,balanced_first:firstGain.balanced,counter_4s:ballOn.counter,balanced_4s:ballOn.balanced});
  rises('runs in behind / breaks in the first 5 s (engine jobs)',each(S,ms=>{const xs:number[]=[];for(const m of ms)for(const t of regains(m))m.frames.forEach((f,i)=>{if(f.t<t||f.t>t+5000||f.r||f.ps!==0)return;xs.push(OUT.filter(n=>n!==f.o&&['break','depth'].includes(jobsOf(m,n)[i]??'')).length);});return mean(xs);}),['secure','balanced','counter'],.15,[true,false]);
  rises('our outfielders ≥ 3 m beyond where it was won, 4 s later',each(S,ms=>{const xs:number[]=[];for(const m of ms)for(const t of regains(m)){const a=m.frames[ballAt(m,t)],b=m.frames[ballAt(m,t+4000)];if(!b.r)xs.push(OUT.filter(i=>b.p[i][0]>a.b[0]+3).length);}return mean(xs);}),['secure','balanced','counter'],[.2,-.1],false);
 },SLOW);
});

describe('Free kick',()=>{
 // 60 spread spots in their half, the same spots and seeds for each call
 const SPOTS=Array.from({length:60},(_,s)=>({x:26+((s*7)%17),y:-12+((s*11)%25)}));
 it('the call sets the routine: Into the box puts more of ours in the box and goes into the box more; Short plays short more, with more short options near the ball',async()=>{
  // (each training carries its spot, so a claim can also be read on one spot alone: the spread)
  const fk=Object.fromEntries(await Promise.all((['short','mixed','delivery'] as const).map(async v=>[v,await Promise.all(SPOTS.map(async(ball,i)=>({...await play({kind:'freeKick',fixture:fixtureOf(500+i,{setPiece:v}),duration:10,ball}),spot:i})))])));
  const spotOf=(m:Slim)=>(m as Slim&{spot:number}).spot;
  const kick=(m:Slim)=>m.events.find(e=>e.rk==='freeKick'&&e.s===0);
  const kind=(m:Slim)=>{const e=kick(m);if(!e)return 'none';if(e.k==='shot')return 'shot';if(!e.aim)return e.k;const b=SPOTS[spotOf(m)],len=Math.hypot(e.aim[0]-b.x,e.aim[1]-b.y);
   return !e.loft&&len<=16?'short':e.aim[0]>35.66&&Math.abs(e.aim[1])<7.5?'box':'other';};   // practice-set-pieces.ts: short ≤ 16 m on the ground; delivery beyond X(78), |y| < Y(17)
  const shareOf=(k:string)=>each(fk,ms=>mean(ms.map(m=>kind(m)===k?1:0)));
  note('direct shots',shareOf('shot'));
  // Short keeps one man in the box: its taker still finds him at times, so Short is drawn short with the box ball faint
  // (settings-truth round, 2026-10-04: since the defending-close round marks every man in the box goal-side and
  // ball-side, the fixed lean no longer moved the taker; he now accepts the contest the call asks for and leaving the
  // call costs him, practice-set-pieces FK_CONTEST / FK_PLAN_B; the claims are unchanged)
  rises('kicks played short',shareOf('short'),['delivery','mixed','short'],[.1,.03],[true,false]);
  rises('kicks into the box',shareOf('box'),['mixed','delivery'],.15,false);
  rises('kicks into the box',shareOf('box'),['short','delivery'],.15,false);
  // where our men stand at the kick (practice-restarts.ts freeKickCallAims): the box, and short options within 11 m of the ball
  const at=(m:Slim)=>{const e=kick(m)!;return {f:m.frames[ballAt(m,e.t-1)],taker:e.a};};
  const count=(test:(p:[number,number,string],i:number)=>boolean)=>each(fk,ms=>mean(ms.flatMap(m=>kick(m)?[[1,2,3,4].filter(n=>{const {f,taker}=at(m);return n!==taker&&test(f.p[n],spotOf(m));}).length]:[])));
  rises('ours in the box at the kick',count(p=>p[0]>40&&Math.abs(p[1])<8),['mixed','delivery'],.8);
  rises('ours in the box at the kick',count(p=>p[0]>40&&Math.abs(p[1])<8),['mixed','short'],.2);
  rises('ours within 11 m of the ball at the kick (short options)',count((p,i)=>Math.hypot(p[0]-SPOTS[i].x,p[1]-SPOTS[i].y)<11),['delivery','short'],.5);
 },SLOW);
});
