// Rehearsal (TECH-SPEC §6.3; BUILD-PLAN WP4):
// the pure half. Situations come from the club's own past frames (finished
// matches only: callers pass replays of matches past full time), each turned
// into an engine TrainingSetup; a new club gets the four stock scenes. The
// worker (lib/ballers/engine.worker.ts, request `scenes`) plays them and
// returns each go's compacted frames, and every count here is read from those
// frames, so what you watch and what the line says can never disagree.
// The engine is unchanged: this only builds inputs and reads outputs.
import {ENGINE_BUILD,createRestartSetup,createTrainingSetup,runTraining,validateTrainingSetup,withDefensiveApproach,type TrainingSetup} from '../../packages/football-engine/src/index';
import type {Fixture} from '../../packages/football-engine/src/model';
import type {PracticePlayer} from '../../packages/football-engine/src/practice';
import type {LessonScene} from '../../packages/football-engine/src/practice-lesson';
import type {DefensiveApproach} from '../../packages/football-engine/src/defensive-approaches';
import {PITCH_LENGTH,phaseLabels} from './phase';
import {type CompactMatch,type ReplayEvent,type ReplayFrame,type ReplayHeader} from './replay';
import {compact,engineTeam,sidePlans,type EngineResult,type FrozenInput,type FrozenSide} from './compute';
import {phaseShapes,type PhaseShapes} from './phase-shapes';
import {runWord,type RunWord} from './result-words';
import {sceneSetup} from './lab/model';

/** Eight goes (BRIEF; DESIGN-SPEC §3.10): a taste, never a verdict. */
export const GOES=8;
/** One go: 15 seconds from the moment. TECH-SPEC §6.3 costed 20 s; a move
 * starts in its first seconds and its follow-up window is 10 s (result-words
 * FOLLOW_UP_MS), so 15 s covers it at three quarters of the phone time. */
export const GO_SECONDS=15;
/** Bump when what a cached rehearsal holds changes. */
export const SCENES_VERSION=1;

// ------------------------------------------------------------------ the worker request
/** A rehearsal: the same five, plan and opponent; each go from its own moment
 * and seed, once with the move ("with") and once without any move ("without",
 * the ghost: same moment, same seed). */
export interface RehearseRequest {type:'scenes';mode:'rehearse';sides:[FrozenSide,FrozenSide];opposition:DefensiveApproach;setups:TrainingSetup[];seeds:number[];duration:number}
// ("What would this change", a second mode of short games per option, was removed
// on 2 Oct with its screen: the owner found it more than the choice needed.)
export type SceneRequest=RehearseRequest;
export interface RehearseGo {with:CompactMatch;without:CompactMatch;dropped:string[]}
export interface SceneResult {mode:'rehearse';goes:RehearseGo[];engineBuild:string;wallMs:number}

/** Plays a request (in the worker; also callable from tests). `progress(done,total,go)`
 * after every go: each finished go is handed over, so the first one can be watched
 * while the rest are still playing. */
export function runScenes(req:SceneRequest,progress?:(done:number,total:number,go?:RehearseGo)=>void):SceneResult{
 const t0=performance.now(),[ours,theirs]=req.sides;
 const input:FrozenInput={v:1,match:'rehearsal',seed:0,kickoff:0,duration:req.duration,sides:[ours,theirs]};
 const fixtureFor=(seed:number,sides:[FrozenSide,FrozenSide]):Fixture=>withDefensiveApproach({seed,kickoff:0,teams:[engineTeam(sides[0]),engineTeam(sides[1])]},1,req.opposition);
 const {plans,dropped}=sidePlans(ours);
 const goes:RehearseGo[]=req.setups.map((setup,i)=>{
  const common={fixture:fixtureFor(req.seeds[i],input.sides),durationSeconds:req.duration,policy:'coordinated' as const,setup,substitutions:'none' as const};
  const withIt=runTraining(plans.length?{...common,playbook:{side:0,plans,adaptive:true}}:common).result as unknown as EngineResult;
  const without=runTraining(common).result as unknown as EngineResult;
  const go={with:compact(input,withIt),without:compact(input,without),dropped};
  progress?.(i+1,req.setups.length,go);
  return go;
 });
 return {mode:'rehearse',goes,engineBuild:ENGINE_BUILD,wallMs:Math.round(performance.now()-t0)};
}

// ------------------------------------------------------------------ situations from past frames
export interface Moment {
 /** Which match it came from (for the caption) and when, ms. */ match:string;t:number;
 /** Our side in that match. */ side:0|1;
 frame:ReplayFrame;
}
export interface MatchFrames {match:string;side:0|1;header:ReplayHeader;frames:readonly ReplayFrame[];events:readonly ReplayEvent[]}

/** Our outfielder on the ball in open play (Building up or Attacking), the
 * ball at his feet, at least `gap` ms after the previous moment taken. */
export function findMoments(m:MatchFrames,gap=12000):Moment[]{
 const labels=phaseLabels(m.frames,m.events,m.side);
 const out:Moment[]=[];let last=-Infinity;
 for(let i=1;i<m.frames.length;i++){
  const f=m.frames[i],prev=m.frames[i-1];
  if(f.r||prev.r||f.c||f.o<0||f.ps!==m.side)continue;
  if(labels[i]!=='build'&&labels[i]!=='attack')continue;
  const pos=f.l?f.l.indexOf(f.o):f.o;
  if(pos<m.side*5+1||pos>m.side*5+4)continue;
  const p=f.p[pos],dx=(f.b[0]-p[0])/100,dy=(f.b[1]-p[1])/100;
  if(Math.hypot(dx,dy)>1.5||f.b[2]>50)continue;
  if(f.t-last<gap)continue;
  last=f.t;out.push({match:m.match,t:f.t,side:m.side,frame:f});
 }
 return out;
}

const L=PITCH_LENGTH,W=30;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const norm=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
/** The ten starters by side and number, as validateTrainingSetup checks them. */
const STARTERS=[0,1].flatMap(side=>[1,2,3,4,5].map(number=>({side,number}))) as unknown as PracticePlayer[];

/** A replay frame as an engine starting position: all ten poses (our side
 * becomes side 0 attacking +x, mirrored when we played as side 1), the ball
 * placed at the owner's feet as createTrainingSetup does, velocities 0
 * (replays hold none). Players closer than the engine allows are eased apart
 * and kept inside the margins; a frame that still fails the engine's own
 * check is skipped (null). */
export function setupFromFrame(f:ReplayFrame,side:0|1):TrainingSetup|null{
 const owner=f.l?f.l.indexOf(f.o):f.o;if(owner<0)return null;
 const poses=f.p.map((p,pos)=>{
  const ours=side===0?pos<5:pos>=5,x=p[0]/100,y=p[1]/100,a=p[2]/1000;
  return {side:(ours?0:1) as 0|1,number:pos%5+1,x:side===0?x:L-x,y:side===0?y:-y,angle:norm(side===0?a:a+Math.PI)};
 });
 for(const p of poses){p.x=clamp(p.x,.9,L-.9);p.y=clamp(p.y,-(W/2-1.1),W/2-1.1);}
 const o=poses[owner];
 // Ease apart anyone closer than 0.85 m (never the man on the ball).
 for(let pass=0;pass<6;pass++){let moved=false;
  for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++){
   const a=poses[i],b=poses[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d>=.85)continue;
   const ux=d>.01?(b.x-a.x)/d:0,uy=d>.01?(b.y-a.y)/d:1,push=.9-d;
   const mv=b===o?a:b,dir=b===o?-1:1;
   mv.x=clamp(mv.x+ux*push*dir,.9,L-.9);mv.y=clamp(mv.y+uy*push*dir,-(W/2-1.1),W/2-1.1);moved=true;
  }
  if(!moved)break;}
 // The ball in front of him at 0.62 m: facing as recorded, else towards their goal.
 for(const angle of [o.angle,0,Math.atan2(-o.y,L-o.x)]){
  const ball={side:0 as const,number:o.number,x:o.x+.62*Math.cos(angle),y:o.y+.62*Math.sin(angle)};
  const setup:TrainingSetup={scene:'middle',poses:poses.map(p=>p===o?{...p,angle}:{...p}),ball};
  try{return validateTrainingSetup(setup,STARTERS);}catch{/* next facing */}
 }
 return null;
}

/** `n` moments spread evenly over everything found (deterministic), each one
 * that the engine accepts as a starting position. Also says how many were
 * found in all, for the caption. */
export function pickSituations(moments:readonly Moment[],n=GOES):{picked:{moment:Moment;setup:TrainingSetup}[];found:number}{
 const usable:{moment:Moment;setup:TrainingSetup}[]=[];
 if(!moments.length)return {picked:[],found:0};
 // Visit in an even stride so a short list still spreads across matches and minutes.
 const order:number[]=[];const step=moments.length/n;
 for(let k=0;k<n;k++)order.push(Math.floor(k*step+step/2));
 for(let i=0;i<moments.length;i++)if(!order.includes(i))order.push(i);
 for(const i of order){
  if(usable.length>=n)break;
  const s=setupFromFrame(moments[i].frame,moments[i].side);if(s)usable.push({moment:moments[i],setup:s});
 }
 usable.sort((a,b)=>moments.indexOf(a.moment)-moments.indexOf(b.moment));
 return {picked:usable,found:moments.length};
}

// ------------------------------------------------------------------ a new club: the stock scenes
export interface StockScene {id:'middle'|'left'|'right'|'back';label:string;setup:()=>TrainingSetup}
/** The engine's training scenes (createTrainingSetup), plus one from the back. Labelled as practice moments. */
export const STOCK_SCENES:readonly StockScene[]=[
 {id:'middle',label:'Through the middle',setup:()=>createTrainingSetup('middle')},
 {id:'left',label:'Down the left',setup:()=>createTrainingSetup('left')},
 {id:'right',label:'Down the right',setup:()=>createTrainingSetup('right')},
 {id:'back',label:'From the back',setup:()=>{const s=createTrainingSetup('middle'),cb=s.poses.find(p=>p.side===0&&p.number===2)!;return {...s,ball:{side:0,number:2,x:cb.x+.62,y:cb.y}};}},
];
/** Eight goes over the four stock scenes. */
export const stockSituations=()=>Array.from({length:GOES},(_,i)=>STOCK_SCENES[i%STOCK_SCENES.length]);

/** A set-piece routine starts at its own restart, every go (the engine's layout plus the drawn spots). */
export function routineSetup(scene:LessonScene,players:PracticePlayer[]):TrainingSetup{
 return sceneSetup(createRestartSetup(scene.restart,players,{ball:scene.ball,taker:scene.taker}),scene);
}

// ------------------------------------------------------------------ seeds
/** Seeds derived from a key, so the same rehearsal replays the same goes (and the cache can hit). */
export function seedsFor(key:string,n:number):number[]{
 let h=2166136261;for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
 const out:number[]=[];for(let i=0;i<n;i++){h=Math.imul(h^(h>>>15),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;out.push((h^(h>>>16))>>>0);}
 return out;
}

// ------------------------------------------------------------------ counting, from the frames
export type GoStatus=RunWord|'never';
export interface GoCount {status:GoStatus;shots:number;goals:number;
 /** When the move started, ms (null when it was never on). */ startAt:number|null}
const allEvents=(c:CompactMatch)=>c.chunks.flatMap(x=>x.e);
/** One go: did the move start (its first start's result word), and our shots and goals in the go. */
export function countGo(c:CompactMatch,moveKey:string|null):GoCount{
 const ev=allEvents(c);
 const shots=ev.filter(e=>e.k==='shot'&&e.s===0).length,goals=ev.filter(e=>e.k==='goal'&&e.s===0).length;
 if(moveKey===null)return {status:'never',shots,goals,startAt:null};
 const start=c.ideas.filter(i=>i.side===0&&i.planId===moveKey).sort((a,b)=>a.t-b.t)[0];
 if(!start)return {status:'never',shots,goals,startAt:null};
 return {status:runWord(start.detail?.run)??'broke',shots,goals,startAt:start.t};
}
export interface Tally {shots:number;goals:number}
export const tallyGoes=(goes:readonly GoCount[]):Tally=>({shots:goes.reduce((n,g)=>n+g.shots,0),goals:goes.reduce((n,g)=>n+g.goals,0)});

// ------------------------------------------------------------------ the words (player-first; no stats line)
const shotsWord=(n:number)=>`${n} ${n===1?'shot':'shots'}`;
const goalsWord=(n:number)=>n===0?'no goal':`${n} ${n===1?'goal':'goals'}`;
/** The one plain comparison: "With it: 3 shots. Without it: 1." Goals join in
 * only when there was one. Both numbers come from the same goes' frames. */
export function comparisonLine(withIt:Tally,without:Tally):string{
 if(withIt.goals||without.goals)return `With it: ${shotsWord(withIt.shots)} and ${goalsWord(withIt.goals)}. Without it: ${shotsWord(without.shots)} and ${goalsWord(without.goals)}.`;
 return `With it: ${shotsWord(withIt.shots)}. Without it: ${without.shots}.`;
}
const TIMES=['','Once','Twice'];
/** Only when it happened: why a go shows the move was never on. */
export function neverLine(n:number,routine=false):string|null{
 if(n<=0)return null;
 const when=n===GOES?'Every time':TIMES[n]??`${n} times`;
 return routine?`${when} the restart wasn’t taken in time, so the routine never started.`
  :`${when} it was never on: the pass or run it needs wasn’t there, so they played their normal game.`;
}
export const STATUS_WORD:Record<GoStatus,string>={to_plan:'To plan',half:'Half',broke:'Broke down',never:'Never on'};

// ------------------------------------------------------------------ "what would this change": the noise rule
