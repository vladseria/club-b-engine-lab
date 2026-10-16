// The one phase function (TECH-SPEC §4; BRIEF D6). App code, never engine
// code: it labels replay frames for pictures, the plan report, rehearsal's
// situation filter and scouting — never for play — so it never changes
// ENGINE_BUILD. Pure and causal: a frame's label depends only on that frame
// and the ones before it (plus, today, the restart kind and taker of a dead
// ball, read from the restart event that ends it; TECH-SPEC §4.1).
//
// Per side, in order:
//  1. Set pieces = THIS side's own corners, free kicks (direct or indirect)
//     and penalties: the dead ball, then 4 s after the kick while it keeps the
//     ball. The taker is the restart event's side. The other side's set piece
//     is ordinary time without the ball for this side (Defending, or Attacking
//     once it wins the ball back in open play). Throw-ins, goal kicks and
//     kick-offs are NOT set pieces (owner, 1 Oct): their time belongs to
//     whoever has the ball (a goal kick is the keeper's side building up).
//     Until 1 Oct throw-ins counted and both sides' set pieces were "set" for
//     each side: that is what put ~40% of a match into Set pieces.
//  2. We have the ball: Attacking in their half (a 3 m band around halfway:
//     in past +3 m, out behind −3 m) or within COUNTER_WINDOW (10 s) of
//     winning it in open play; otherwise Building up.
//  3. They have it: Losing the ball within COUNTER_PRESS_WINDOW (3 s) of
//     losing it in open play; otherwise Defending.
// A possession change on a live frame is open play; one on a dead frame is a
// restart award and starts no window.
//
// Copy rule (RISKS T3): phases are short (~12 changes a minute, one spell in
// six under a second). Say "on average while…", never that a phase "lasts".
import type {ReplayEvent,ReplayFrame} from './replay';

export type Phase='build'|'attack'|'loss'|'defend'|'set';
export const PHASES:readonly Phase[]=['build','attack','loss','defend','set'];
/** Player-facing names (the shared vocabulary). */
/** The plan's own part names (FIX-ROUND shared decisions): Defending is the whole of Without the ball, and set pieces are Set pieces and keeper, on pictures, the report and Watch alike. */
export const PHASE_NAME:Record<Phase,string>={build:'Building up',attack:'Attacking',loss:'Losing the ball',defend:'Without the ball',set:'Set pieces and keeper'};
/** The two bands of the plan (BRIEF D1): with the ball / without it; set pieces apart. */
export const PHASE_BAND:Record<Phase,'with'|'without'|'set'>={build:'with',attack:'with',loss:'without',defend:'without',set:'set'};

/** The engine's own windows (team-approach.ts COUNTER_WINDOW, practice-
 * coordination.ts COUNTER_PRESS_WINDOW), in seconds. Copied as values so the
 * client bundle never pulls in engine modules; verificare/ballers-game-plan
 * .test.ts fails if either drifts from the engine. */
export const WIN_WINDOW=10,LOSS_WINDOW=3;
export const SET_TAIL=4,ZONE_BAND=3,PITCH_LENGTH=48;
/** Restart kinds that are set pieces (engine RestartKind). Not 'throw',
 * 'goalKick' or 'kickoff'. */
export const SET_PIECE_KINDS:ReadonlySet<string>=new Set(['corner','freeKick','indirect','penalty']);

/** What the tracker needs from a frame: time (ms), possession side, ball x in
 * metres (engine x: side 0 attacks towards +x), dead ball, and for a dead
 * ball the kind of restart being taken and the side taking it (the restart
 * event's `s`; when absent, the side in possession). */
export interface PhaseFrame {t:number;ps:0|1;bx:number;dead:boolean;restartKind?:string|null;restartSide?:0|1|null}

/** Whose set piece covers each frame (0, 1 or null): the dead ball of a
 * corner, free kick or penalty, then up to SET_TAIL s after the kick while the
 * taking side keeps the ball. Side-free, so both sides' labels share it. */
export function setPieceTracker(){
 let prevDead=false,pending:0|1|null=null,tail:{side:0|1;until:number}|null=null,prevPs:0|1|undefined;
 return {step(f:PhaseFrame):0|1|null{
  if(prevPs!==undefined&&f.ps!==prevPs)tail=null;
  let by:0|1|null=null;
  if(f.dead){
   pending=f.restartKind&&SET_PIECE_KINDS.has(f.restartKind)?(f.restartSide??f.ps):null;
   by=pending;
  }else{
   if(prevDead&&pending!==null)tail={side:pending,until:f.t+SET_TAIL*1000};
   pending=null;
   if(tail&&(f.ps!==tail.side||f.t>=tail.until))tail=null;
   by=tail?tail.side:null;
  }
  prevPs=f.ps;prevDead=f.dead;
  return by;
 }};
}

export function phaseTracker(side:0|1,pitchLength=PITCH_LENGTH){
 const half=pitchLength/2,sets=setPieceTracker();
 let prevPs:0|1|undefined,theirHalf:boolean|undefined;
 let wonAt=-Infinity,lostAt=-Infinity;
 return {step(f:PhaseFrame):Phase{
  const depth=side===0?f.bx:pitchLength-f.bx;
  theirHalf=theirHalf===undefined?depth>=half:theirHalf?depth>half-ZONE_BAND:depth>=half+ZONE_BAND;
  if(prevPs!==undefined&&f.ps!==prevPs){
   if(!f.dead){if(f.ps===side)wonAt=f.t;else lostAt=f.t;}
   else{wonAt=-Infinity;lostAt=-Infinity;}
  }
  prevPs=f.ps;
  if(sets.step(f)===side)return 'set';
  if(f.ps===side)return theirHalf||f.t-wonAt<WIN_WINDOW*1000?'attack':'build';
  return f.t-lostAt<LOSS_WINDOW*1000?'loss':'defend';
 }};
}

/** For a replay: the restart event (kind `rk`, taker `s`) of each dead-ball
 * frame, read from the next restart event (the kick) at or after it. */
export function restartFinder(events:readonly ReplayEvent[]){
 const restarts=events.filter(e=>e.rk).sort((a,b)=>a.t-b.t);
 let i=0;
 return (t:number):ReplayEvent|null=>{while(i<restarts.length&&restarts[i].t<t)i++;return restarts[i]??null;};
}
/** The restart kind only (kept for older callers). */
export function restartKindFinder(events:readonly ReplayEvent[]){
 const at=restartFinder(events);
 return (t:number)=>at(t)?.rk??null;
}

const phaseFrames=(frames:readonly ReplayFrame[],events:readonly ReplayEvent[])=>{
 const at=restartFinder(events);
 return frames.map((f):PhaseFrame=>{
  const r=f.r===1?at(f.t):null;
  return {t:f.t,ps:f.ps,bx:f.b[0]/100,dead:f.r===1,restartKind:r?.rk??null,restartSide:r?.s??null};
 });
};

/** Labels every replay frame for one side (frames in time order). 'set' is
 * THIS side's own set piece only. */
export function phaseLabels(frames:readonly ReplayFrame[],events:readonly ReplayEvent[],side:0|1,pitchLength=PITCH_LENGTH):Phase[]{
 const tracker=phaseTracker(side,pitchLength);
 return phaseFrames(frames,events).map(f=>tracker.step(f));
}

/** Whose set piece each replay frame belongs to (0, 1 or null): for "their
 * set pieces" (a goal conceded from a corner, scouting) without a sixth phase. */
export function setPieceSides(frames:readonly ReplayFrame[],events:readonly ReplayEvent[]):(0|1|null)[]{
 const sets=setPieceTracker();
 return phaseFrames(frames,events).map(f=>sets.step(f));
}

/** Seconds spent in each phase: each frame counts until the next one. */
export function phaseSeconds(frames:readonly {t:number}[],labels:readonly Phase[]):Record<Phase,number>{
 const out:Record<Phase,number>={build:0,attack:0,loss:0,defend:0,set:0};
 for(let i=0;i+1<frames.length;i++)out[labels[i]]+=(frames[i+1].t-frames[i].t)/1000;
 return out;
}

/** The phase at time t (ms), from labels computed for those frames. */
export function phaseAt(frames:readonly {t:number}[],labels:readonly Phase[],t:number):Phase|null{
 let lo=0,hi=frames.length-1,at=-1;
 while(lo<=hi){const mid=(lo+hi)>>1;if(frames[mid].t<=t){at=mid;lo=mid+1;}else hi=mid-1;}
 return at<0?null:labels[at];
}

/** Runs of one label, for ribbons: [{phase, from, to}] in ms. */
export function phaseRuns(frames:readonly {t:number}[],labels:readonly Phase[]){
 const runs:{phase:Phase;from:number;to:number}[]=[];
 for(let i=0;i<frames.length;i++){
  const end=frames[i+1]?.t??frames[i].t,last=runs.at(-1);
  if(last&&last.phase===labels[i])last.to=end;else runs.push({phase:labels[i],from:frames[i].t,to:end});
 }
 return runs;
}
