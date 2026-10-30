// Styles as identities, slice 2: the style moments of a match, read from the engine's own result. Pure; no I/O.
//
// Two moments, each only for the side that has the trait:
//  - Short's one-touch move ('onetouch'): a side that names its style Short (engine tactics `style: 'combinations'`,
//    approach.ts engineStyle) strings together ONETOUCH_MIN or more completed first-time passes (the engine's
//    `firstTime` flag, received by a team-mate), or plays a first-time pass after which the same side shoots within
//    ONETOUCH_SHOT seconds without losing the ball (a first-time pass that makes a chance).
//  - Counter's surge ('surge'): a regain after which the side played the surge (the engine's own record,
//    PracticeResult.surges: approachForSituation's regainWindow at its first tick), with what came of it within the
//    window (style.ts REWRITES.counter.window, 8 s from the regain): a goal, a shot, the ball lost, play stopped (out,
//    foul, offside), or kept until the window closed ('settled').
//
// Each moment is stamped at its last piece of evidence (the last pass, the shot, the goal, the loss), so live and
// full time agree (lib/ballers/incidents.ts rule). The compact replay carries them as `mo` marks on that event
// (compute.ts), and each side's tallies ride with the match's stats into the stored result (simulation.ts).
import {REWRITES} from '../../packages/football-engine/src/style';

/** Completed first-time passes in a row that make a one-touch move. */
export const ONETOUCH_MIN=3;
/** A first-time pass followed by a shot from the same side within this many seconds (no loss between) is a move. */
export const ONETOUCH_SHOT=4;
/** The surge's window: from the regain, as the engine plays it. */
export const SURGE_WINDOW=REWRITES.counter.window.v;

export type SurgeOutcome='goal'|'shot'|'lost'|'stopped'|'settled';
/** A moment's mark on the event it ends at. `n`: completed first-time passes in the move (onetouch); `o`: the
 * surge's outcome; `d`: seconds from its start (the first first-time pass / the regain) to this event. */
export interface StyleMark {k:'onetouch'|'surge';s:0|1;n?:number;o?:SurgeOutcome;d:number;/** the move ended in a shot */shot?:1}
/** Per side, per match: what the traits did. Stored with the result's stats (numbers only). */
export interface StyleTally {ftDone:number;oneTouch:number;oneTouchShots:number;surges:number;surgeGoals:number;surgeShots:number;surgeLost:number;
 /** the quickest surge goal, seconds from the regain to the goal; 0 = none */surgeGoalSecs:number;/** its match second; 0 = none */surgeGoalAt:number}

interface Ev {time:number;kind:string;side?:0|1;firstTime?:boolean;actor?:string}
interface Surge {side:0|1;regain:number;start:number}
export interface Moment {at:number;/** index of the event it ends at, -1 when no event closes it (a settled surge with none) */event:number;mark:StyleMark}

const BALL_KINDS=new Set(['receive','turnover','save','tackle','pass','clearance','shot','feint','beat']);
// 'stoppage' (Bebe's showcase): the referee stopping play for an injury ends a move as a foul does
const STOPS=new Set(['out','foul','offside','restart','half','end','goal','stoppage']);
const round1=(x:number)=>Math.round(x*10)/10;

/** Every style moment of a match, in time order. `styles[side]`: the style the engine was told (undefined: none). */
export function styleMoments(events:readonly Ev[],surges:readonly Surge[]|undefined,styles:readonly (string|undefined)[]):Moment[]{
 const out:Moment[]=[];
 // ---- one-touch moves (Short sides only)
 for(const s of [0,1] as const){
  if(styles[s]!=='combinations')continue;
  let run=0,start=-1,last=-1,pending=-1;// pending: index of a first-time pass not yet received
  const close=()=>{if(run>=ONETOUCH_MIN)out.push({at:events[last].time,event:last,mark:{k:'onetouch',s,n:run,d:round1(events[last].time-events[start].time)}});run=0;start=-1;last=-1;pending=-1;};
  events.forEach((e,i)=>{
   if(e.side===s&&e.kind==='pass'){
    if(pending>=0&&!e.firstTime){close();return;}
    if(e.firstTime){pending=i;}else close();
    return;
   }
   if(e.side===s&&e.kind==='receive'&&pending>=0){if(run===0)start=pending;run++;last=pending;pending=-1;return;}
   if(e.side===s&&e.kind==='shot'){
    // a shot right after a first-time move (no loss between): the move made a chance
    if(run>0&&e.time-events[last].time<=ONETOUCH_SHOT){out.push({at:e.time,event:i,mark:{k:'onetouch',s,n:run,d:round1(e.time-events[start].time),shot:1}});run=0;start=-1;last=-1;pending=-1;return;}
    close();return;
   }
   if((e.side!==undefined&&e.side!==s&&BALL_KINDS.has(e.kind))||STOPS.has(e.kind))close();
  });
  close();
 }
 // ---- surges (whoever played one: the engine records it only for an On winning it Counter side)
 for(const g of surges??[]){
  const end=g.regain+SURGE_WINDOW;
  let mark:Moment|null=null,lastIn=-1;
  for(let i=0;i<events.length;i++){
   const e=events[i];if(e.time<g.start)continue;
   if(e.time>end)break;
   lastIn=i;
   if(e.kind==='shot'&&e.side===g.side){
    // what the shot came to: the next ball event or stoppage (a goal is credited to the side that benefits)
    const k=events.findIndex((x,j)=>j>i&&(BALL_KINDS.has(x.kind)||STOPS.has(x.kind)));
    const scored=k>=0&&events[k].kind==='goal'&&events[k].side===g.side;
    const at=scored?k:i;
    mark={at:events[at].time,event:at,mark:{k:'surge',s:g.side,o:scored?'goal':'shot',d:round1(events[at].time-g.regain)}};break;
   }
   if(e.side!==undefined&&e.side!==g.side&&BALL_KINDS.has(e.kind)){mark={at:e.time,event:i,mark:{k:'surge',s:g.side,o:'lost',d:round1(e.time-g.regain)}};break;}
   if(STOPS.has(e.kind)){mark={at:e.time,event:i,mark:{k:'surge',s:g.side,o:'stopped',d:round1(e.time-g.regain)}};break;}
  }
  out.push(mark??{at:end,event:lastIn,mark:{k:'surge',s:g.side,o:'settled',d:round1(SURGE_WINDOW)}});
 }
 return out.sort((a,b)=>a.at-b.at);
}

/** Each side's tallies. `ftDone`: completed first-time passes (received by a team-mate), every side. */
export function styleTallies(events:readonly Ev[],moments:readonly Moment[]):[StyleTally,StyleTally]{
 const t=():StyleTally=>({ftDone:0,oneTouch:0,oneTouchShots:0,surges:0,surgeGoals:0,surgeShots:0,surgeLost:0,surgeGoalSecs:0,surgeGoalAt:0});
 const out:[StyleTally,StyleTally]=[t(),t()];
 events.forEach((e,i)=>{if(e.kind==='pass'&&e.firstTime&&e.side!==undefined){const next=events.slice(i+1).find(x=>BALL_KINDS.has(x.kind)||STOPS.has(x.kind));if(next?.kind==='receive'&&next.side===e.side)out[e.side].ftDone++;}});
 for(const m of moments){const x=out[m.mark.s];
  if(m.mark.k==='onetouch'){x.oneTouch++;if(m.mark.shot)x.oneTouchShots++;continue;}
  x.surges++;
  if(m.mark.o==='goal'){x.surgeGoals++;x.surgeShots++;if(!x.surgeGoalSecs||m.mark.d<x.surgeGoalSecs){x.surgeGoalSecs=m.mark.d;x.surgeGoalAt=Math.round(m.at);}}
  else if(m.mark.o==='shot')x.surgeShots++;
  else if(m.mark.o==='lost')x.surgeLost++;
 }
 return out;
}

// ---------- the plan report: how often the trait fired (a side's own marks in the replay) ----------
export interface TraitCount {moves:number;moveShots:number;surges:number;goals:number;shots:number;lost:number}
/** A side's style moments in a stretch of replay events (the plan report reads the part before any change of plan). */
export function traitCount(events:readonly {mo?:StyleMark[]}[],side:0|1):TraitCount{
 const c:TraitCount={moves:0,moveShots:0,surges:0,goals:0,shots:0,lost:0};
 for(const e of events)for(const m of e.mo??[]){if(m.s!==side)continue;
  if(m.k==='onetouch'){c.moves++;if(m.shot)c.moveShots++;continue;}
  c.surges++;if(m.o==='goal')c.goals++;else if(m.o==='shot')c.shots++;else if(m.o==='lost')c.lost++;}
 return c;
}
const times=(n:number,one:string,many:string)=>`${n} ${n===1?one:many}`;
/** The report's line for a Short or Counter plan (null for a style with no trait). Says only what happened. */
export function traitLine(style:string,c:TraitCount):string|null{
 if(style==='combinations')return c.moves
  ?`One-touch passing: ${times(c.moves,'move','moves')} of ${ONETOUCH_MIN} or more first-time passes, or a first-time pass straight into a shot${c.moveShots?`; ${c.moveShots} ended in a shot`:''}.`
  :`One-touch passing: no move of ${ONETOUCH_MIN} first-time passes in a row this time.`;
 if(style==='counter')return c.surges
  ?`The surge: ${times(c.surges,'time','times')} after winning the ball. ${[c.goals?times(c.goals,'goal','goals'):'',c.shots?times(c.shots,'shot','shots'):'',c.lost?`${times(c.lost,'time','times')} the ball was lost`:''].filter(Boolean).join(', ')||'Each one was stopped or settled without a shot'}.`
  :'The surge: it never started this time.';
 return null;
}
