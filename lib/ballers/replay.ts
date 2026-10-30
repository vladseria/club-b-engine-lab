// Ballers compact replay v2: the shape an official match is stored in and the
// shape the watch screen reads. Pure (no I/O, no zlib): the server gzips the
// encoded JSON (lib/ballers/simulation.ts), the browser gunzips it
// (DecompressionStream) and hands the parsed JSON to these helpers.
//
// Units: positions and the ball in integer centimetres (engine metres x 100),
// facing angles in integer milliradians, time in integer milliseconds.
// Player index: 0-4 = home starters in lineup order (slot 0 = keeper), 5-9 =
// away starters, 10+ = the benches (home first, P5: a substitute has an index
// before he comes on). -1 = nobody. Frames always hold ten positions; after a
// substitution `l` says which player stands at each one.
//
// A match is one header (chunk index -1, visible from kickoff - 15 s: the
// lineups are revealed at kickoff) and 60-second chunks (index i covers
// [60 i, 60 (i + 1)) seconds; the last one also holds the final whistle).

import type {IdeaRun} from './idea-run';
import type {Voice} from './voice';
import type {StyleMark,StyleTally} from './style-moments';

export const REPLAY_VERSION = 2 as const;
export const CHUNK_SECONDS = 60;
/** Frames kept at least this far apart (plus every cut and the final frame). */
export const FRAME_STEP = 0.2;
/** Half-time (deliverables/ballers-half-time/DESIGN.md): the live break, in real seconds, the same for every viewer.
 * A match with a half-time says so in its header (`interval`); its replay holds the engine's `half` event (the
 * whistle) and a cut frame at the same instant (the second half's kickoff, the ends swapped on screen). */
export const BREAK_SECONDS = 300;

export interface ReplayPlayer {
 /** As above. */ i:number;side:0|1;
 /** Lineup slot (0 = keeper); -1 for a bench player. */ slot:number;
 /** Stored player row id (uuid). */ id:string;
 name:string;short:string;number:number;role:string;portrait:string;captain:boolean;
 /** Started on the bench (P5). */ bench?:boolean;
}
export interface ReplayTeam {club:string;name:string;code:string;color:string;formation:string;style:string;
 /** The club's voice as frozen at the lock (lib/ballers/voice.ts); present only when it has lines. */ voice?:Voice}
export interface ReplayHeader {
 v:typeof REPLAY_VERSION;engineBuild:string;
 /** Seconds until the final whistle: the match length, or a few seconds more when the last attack played out. */ duration:number;
 /** The match length (the clock's full time), present only when the whistle came after it (last attack, engine practice-match.ts). */ fullTime?:number;
 chunkSeconds:number;chunks:number;
 /** The match length (s), set only by timeline() when the last chunk's `end` moves `duration` to the real whistle. */ length?:number;
 /** Half-time (from the half-time build): the live break in seconds (BREAK_SECONDS). Absent = no half-time (older
  * replays, quick matches). The whistle's second is NOT here (it would say at kickoff whether an attack was on at
  * 7:30): read it from the `half` event (halfTime below). */ interval?:number;
 teams:[ReplayTeam,ReplayTeam];players:ReplayPlayer[];
}
/** One frame: t ms; p = [x, y, angle] per player; b = ball [x, y, z]; o = ball
 * owner (index or -1: the carrier, else the restart taker, else the keeper
 * holding it); ps = possession side; s = score; r = dead ball (restart);
 * c = camera cut (a jump, never interpolate across it); l = the player index
 * at each of the ten positions, present from the first substitution on;
 * d = the positions (0-9) of players lying on the floor after a duel (engine
 * duty 'down', from 16 Oct). Optional and present only in frames where someone
 * is down, so the version stays 2 and older replays render exactly as before. */
export interface ReplayFrame {t:number;p:[number,number,number][];b:[number,number,number];o:number;ps:0|1;s:[number,number];r?:1;c?:1;l?:number[];d?:number[]}
/** Every engine event, slimmed: kind, Romanian engine text, actor/target and
 * last touch as player indices, the side it concerns. Shots keep origin/aim.
 * A substitution: a = the player coming on, g = the one going off, sb = the
 * trigger that fired (k kind; st score state; n margin; d up/down; e the
 * outgoing player's energy). */
/** k 'injury' (Bebe's showcase, contracts/ENGINE.md §3): the engine's forced change for an injured man, no order behind it. */
export interface ReplaySub {k:'tired'|'score'|'margin'|'half'|'injury';st?:string;n?:number;d?:string;e?:number}
/** An injury (Bebe's showcase only; contracts/ENGINE.md §3), on the `injury` event and on its forced `substitution`:
 * c the cause, n the matches he misses, h a hard tackle (it floored him, or a foul). Absent from every league replay. */
export interface ReplayInjury {c:'tackle'|'fatigue';n:number;h?:1}
/** A shot (from 4 Oct; absent on older replays): q = the engine's own quality
 * read at the strike (0-1, 3 decimals), or sk = which unread shot it was
 * (1 header, 2 volley, 3 direct free kick). Optional, so the version stays 2:
 * a reader that needs them checks they are there (lib/ballers/chances.ts). */
/** A tactics switch (in-match plan switch, from 21 Oct; k 'switch', s the side): sw = the trigger that fired (k kind;
 * st score state; n margin; d up/down) and y the style the side now plays (a preset key: public like the header's
 * style; the plan's own name is the manager's and never in the replay), plus f / ro when the formation changes.
 * Optional, so the version stays 2. */
export interface ReplaySwitch {k:'score'|'margin'|'half'|'always';st?:string;n?:number;d?:string;y:string;
 /** Men moved to new places (every switch can, owner 21 Oct): [player index, new role, lane] for each man of that side, and
  * f the new formation when it changed. */ f?:string;ro?:[number,string,number?][]}
/** Style moments (styles as identities, slice 2, from 22 Oct; lib/ballers/style-moments.ts): mo = the moments that end
 * at this event (a Short side's one-touch move, a Counter side's surge and what came of it). Optional, so the version
 * stays 2. */
export interface ReplayEvent {t:number;k:string;x:string;a?:number;g?:number;s?:0|1;lt?:number;rk?:string;sh?:{o:[number,number];a:[number,number]};sb?:ReplaySub;sw?:ReplaySwitch;q?:number;sk?:1|2|3;mo?:StyleMark[];ij?:ReplayInjury}
/** `end` (the last chunk only, from the half-time build): when the whistle really went (`played`, s) and the clock's full
 * time (`fullTime`, s: the second half's kick + a full half, or the match length), present when either differs from the
 * match length. It used to be in the header, which is readable from kickoff, so it told a viewer at kickoff how long
 * the last attack (and the first half's overrun) would run; it now arrives with the chunk that holds them. */
export interface ReplayChunk {v:typeof REPLAY_VERSION;i:number;t0:number;t1:number;f:ReplayFrame[];e:ReplayEvent[];end?:{played:number;fullTime:number}}

/** An idea the engine selected during the match (owner-only names live elsewhere). */
export interface ReplayIdea {seq:number;side:0|1;t:number;endedAt:number|null;status:string;endReason:string|null;
 progress:'recognised'|'pursued'|'attempted';planId:string|null;name:string;
 /** Owner-only (P5): player links for the pitch line, the engine's words for how it ended,
  * and (2026-09-28) whether it played out as drawn (lib/ballers/idea-run.ts). */
 detail?:{links?:[number,number,number][];why?:string;run?:IdeaRun}}

export interface TeamStats {passes:number;completed:number;clearances:number;shots:number;goals:number;saves:number;turnovers:number;tackles:number;tacklesWon:number;feints:number;beaten:number;fouls:number;offsides:number;possession:number;pressSeconds:number;coverSeconds:number}

/** What the compute route submits. */
export interface CompactMatch {header:ReplayHeader;chunks:ReplayChunk[];score:[number,number];stats:[TeamStats,TeamStats];ideas:ReplayIdea[];
 /** Owner-only (P5): the engine's substitutionNotes per side, each with its order's trigger. */
 substitutionNotes?:{side:0|1;notes:unknown[]}[];
 /** Owner-only, like the substitution notes: the engine's switchNotes (made or waiting, and when). Present only when a side carried a switch. */
 switchNotes?:{order:string;side:0|1;status:'made'|'waiting'|'skipped';time?:number;detail?:string}[];
 /** Each side's style tallies (lib/ballers/style-moments.ts): present only when a side is Short or a moment happened.
  * They ride into the stored result's stats (simulation.ts submission). */
 styles?:[StyleTally,StyleTally]}

export const cm=(metres:number)=>Math.round(metres*100);
export const mrad=(rad:number)=>Math.round(rad*1000);
export const ms=(seconds:number)=>Math.round(seconds*1000);

// ---------- reading ----------
export interface Pose {x:number;y:number;a:number}
/** A replay the viewer can seek: every chunk loaded so far, frames in order. */
export interface Timeline {header:ReplayHeader;frames:ReplayFrame[];events:ReplayEvent[]}
export function timeline(header:ReplayHeader,chunks:ReplayChunk[]):Timeline{
 const sorted=[...chunks].sort((a,b)=>a.i-b.i);
 // The last chunk's `end` (half-time build): once held, the header reads as replays always did (duration = the whistle,
 // fullTime = the clock's full time) plus the match length; until then it is the match length only (nothing early).
 const end=sorted.find(c=>c.i===header.chunks-1)?.end;
 const h=end?{...header,duration:end.played,fullTime:end.fullTime,length:header.duration}:header;
 return {header:h,frames:sorted.flatMap(c=>c.f),events:sorted.flatMap(c=>c.e)};
}
/** Index of the last frame at or before t (ms); -1 before the first. */
export function frameAt(frames:ReplayFrame[],t:number){
 let lo=0,hi=frames.length-1,best=-1;
 while(lo<=hi){const mid=(lo+hi)>>1;if(frames[mid].t<=t){best=mid;lo=mid+1;}else hi=mid-1;}
 return best;
}
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
const lerpAngle=(a:number,b:number,k:number)=>{let d=(b-a)%(2000*Math.PI);if(d>1000*Math.PI)d-=2000*Math.PI;if(d<-1000*Math.PI)d+=2000*Math.PI;return a+d*k;};
/** Interpolated state at t (ms), in metres/radians; never blends across a cut. */
export function sample(frames:ReplayFrame[],t:number){
 const i=Math.max(0,frameAt(frames,t)),a=frames[i],b=frames[i+1];
 const k=!b||b.c||b.t===a.t?0:Math.min(1,Math.max(0,(t-a.t)/(b.t-a.t)));
 const other=b??a;
 return {
  players:a.p.map((p,j)=>({x:lerp(p[0],other.p[j][0],k)/100,y:lerp(p[1],other.p[j][1],k)/100,a:lerpAngle(p[2],other.p[j][2],k)/1000})),
  ball:{x:lerp(a.b[0],other.b[0],k)/100,y:lerp(a.b[1],other.b[1],k)/100,z:lerp(a.b[2],other.b[2],k)/100},
  owner:a.o,side:a.ps,score:a.s,restart:!!a.r,
  /** Player index per position (identity until the first substitution). */
  lineup:a.l??null,
  /** Positions of players on the floor at this frame (none on replays from before 16 Oct). */
  down:a.d??null,
 };
}
export const goals=(events:ReplayEvent[])=>events.filter(e=>e.k==='goal');
/** Scorer of a goal as the engine records it: the last touch (it may be an own goal). */
export function scorer(e:ReplayEvent,players:ReplayPlayer[]){
 const idx=e.lt??e.a;const p=idx===undefined?undefined:players[idx];
 return p?{player:p,own:p.side!==e.s}:null;
}
/** Key moments for the Highlights reel: goals, saves, shots on and off target,
 * blocks and fouls, each with a short lead-in. Returns [from, to] ms windows. */
export function highlightWindows(events:ReplayEvent[],duration:number,lead=6000,tail=3500):{from:number;to:number;at:number;k:string;x:string}[]{
 const keys=events.filter(e=>['goal','save','shot','block','foul','offside'].includes(e.k));
 // A shot followed by its save/goal/block is one moment; keep the richest kind.
 const rank:Record<string,number>={goal:5,save:4,block:3,shot:2,foul:1,offside:1};
 const moments:{at:number;k:string;x:string}[]=[];
 for(const e of keys){const last=moments.at(-1);
  if(last&&e.t-last.at<4000){if(rank[e.k]>rank[last.k]){last.k=e.k;last.x=e.x;}last.at=Math.max(last.at,e.t);continue;}
  moments.push({at:e.t,k:e.k,x:e.x});}
 // Goals and saves always; ordinary shots only when the reel is short.
 const picked=moments.filter(m=>m.k==='goal'||m.k==='save'||m.k==='block'||(m.k==='shot'&&moments.length<=40));
 const out:{from:number;to:number;at:number;k:string;x:string}[]=[];
 for(const m of picked){const from=Math.max(0,m.at-lead),to=Math.min(duration*1000,m.at+tail),last=out.at(-1);
  if(last&&from<=last.to){last.to=Math.max(last.to,to);if(rank[m.k]>rank[last.k]){last.k=m.k;last.x=m.x;last.at=m.at;}continue;}
  out.push({from,to,at:m.at,k:m.k,x:m.x});}
 return out;
}

/** An idea's outcome on the timeline. When the firing was classified at
 * compute time (`run`, lib/ballers/idea-run.ts; stored in the owner-only
 * detail and, from 2026-09-29, on the public marker row), the lamp says exactly
 * that: ✓ 'ok' = ran as drawn, 'partly' = some of the drawn parts happened,
 * ✗ 'x' = broke off before any did. Rows computed before that keep the older,
 * looser rule (DECISIONS Q5.1): ✓ when attempted and the move
 * completed or led to a shot/goal by that side within 3 s of its end; ✗ when
 * attempted and it ended in a loss, an abort or a conflict; otherwise faint. */
export type IdeaOutcome='ok'|'partly'|'x'|'faint';
export function ideaOutcome(m:{side:number;t:number;ended_at:number|null;progress:string;end_reason:string|null;run?:IdeaRun|null},events:ReplayEvent[]):IdeaOutcome{
 if(m.run)return m.run==='ran'?'ok':m.run==='partly'?'partly':'x';
 if(m.progress!=='attempted')return 'faint';
 const end=m.ended_at??m.t+8;
 if(m.end_reason==='complete'||events.some(e=>(e.k==='shot'||e.k==='goal')&&e.s===m.side&&e.t>=m.t*1000&&e.t<=(end+3)*1000))return 'ok';
 if(['loss','aborted','conflict'].includes(m.end_reason??''))return 'x';
 return 'faint';
}
/** Engine lines worth a commentary slot until P4 writes the Romanian library. */
export const COMMENTARY_KINDS=new Set(['start','goal','shot','save','block','foul','offside','half','end','beat','tackle','turnover','feint','clearance','substitution']);
/** Who is on the pitch at a frame: player index per position. */
export const onPitch=(l:number[]|null|undefined)=>l??[0,1,2,3,4,5,6,7,8,9];
export const mmss=(seconds:number)=>{const s=Math.max(0,Math.floor(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
