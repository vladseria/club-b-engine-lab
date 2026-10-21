// The clock a match SHOWS (owner, 21 Oct: "like real football"). Every place that prints a match moment as a time goes
// through shownClock / shownTime here; nothing else formats a match second (verificare/ballers-match-clock.test.ts holds
// every other mmss() in lib/ballers and components/ballers to an allow-list of things that are not match moments:
// countdowns, gaps, wall-clock minutes).
//
// Match seconds (the engine's clock: events, frames, chunks, the live mapping, ratings' minutes, incidents) run on
// without a break. The shown clock:
//   first half      0:00 .. 7:30, then "7:30 +0:03" while an attack in progress at 7:30 plays out (the whistle's
//                   second is the `half` event)
//   second half     7:30 at the second kickoff's instant (the whistle), counting a full half to 15:00, then
//                   "15:00 +0:04" while full time's own last attack plays out
//   no half-time    (quick matches, every replay from before the half-time build) 0:00 .. the match length, then the
//                   added time the same way
import {mmss} from './replay';

export interface MatchClock {
 /** The whistle at half-time (match s), null when the match has none (or its chunk is not held yet). */ half:number|null;
 /** The second half's kick (match s): the clock reads 7:30 from the whistle until here, then runs. Null until held. */ kick?:number|null;
 /** The clock's half (s): half the match length. */ base:number;
 /** The match length on the shown clock (s), e.g. 900. */ length:number;
}
/** A match's shown clock: its length (the input's 900, not a last attack's extra seconds) and its whistle. */
export function matchClock(header:{duration:number;fullTime?:number;length?:number;interval?:number}|null|undefined,events:readonly {k:string;t:number;rk?:string}[]|null|undefined):MatchClock{
 const half=events?.find(e=>e.k==='half')?.t;
 const kick=half===undefined?undefined:events?.find(e=>e.t>=half&&e.rk==='kickoff'&&e.k!=='restart')?.t;
 // the match length: timeline()'s `length` (a header whose last chunk moved `duration` to the whistle), else the
 // header's own (the match length since the half-time build; older replays: fullTime past a last attack, or duration)
 const length=Math.round(header?.length??header?.fullTime??header?.duration??900);
 return {half:half!==undefined?half/1000:null,kick:kick!==undefined?kick/1000:null,base:length/2,length};
}
/** The plain clock of a match without any break bookkeeping (a short scene, a practice preview). */
export const plainClock=(length:number):MatchClock=>({half:null,base:length/2,length});
/** A clock with no length and no half-time: a moment with nothing known about its match prints as plain m:ss. */
export const OPEN_CLOCK:MatchClock={half:null,base:Number.POSITIVE_INFINITY,length:Number.POSITIVE_INFINITY};

export interface ShownTime {
 /** Seconds on the main clock (0 .. length). */ main:number;
 /** Added seconds past 7:30 (an overrun first half) or past full time; 0 otherwise. */ added:number;
 /** Which half, on the shown clock (1 without a half-time). */ half:1|2;
}
/** Match second t (s) on the shown clock. */
export function shownTime(t:number,c:MatchClock):ShownTime{
 const s=Math.max(0,t);
 if(c.half===null)return s<=c.length?{main:s,added:0,half:1}:{main:c.length,added:s-c.length,half:1};
 if(s<c.half)return s<=c.base?{main:s,added:0,half:1}:{main:c.base,added:s-c.base,half:1};
 // from the whistle to the second half's kick the clock reads 7:30 (the teams walk off, the break, the kickoff's set-up)
 if(c.kick==null||s<c.kick)return {main:c.base,added:0,half:2};
 const main=c.base+(s-c.kick);
 return main<=c.length?{main,added:0,half:2}:{main:c.length,added:main-c.length,half:2};
}
/** "7:31", "7:30 +0:03", "15:00 +0:04". */
export function shownClock(t:number,c:MatchClock):string{
 const x=shownTime(t,c),a=Math.floor(x.added);
 return a>=1?`${mmss(x.main)} +${mmss(a)}`:mmss(x.main);
}
/** A time ALREADY on the shown clock (a timeline's minute mark, a "not before" setting) as m:ss. */
export const fmtShown=(shown:number)=>mmss(shown);
/** The main clock only ("7:30" during the overrun): for a narrow display that shows the added time beside it. */
export const shownMain=(t:number,c:MatchClock)=>mmss(shownTime(t,c).main);
/** Added seconds as a display ("+0:03"), or '' when none. */
export const shownAdded=(t:number,c:MatchClock)=>{const a=Math.floor(shownTime(t,c).added);return a>=1?`+${mmss(a)}`:'';};
/** The match second where the shown clock reads `shown` (s) in the half it belongs to (timeline ticks, "not before"). */
export function matchSecondAt(shown:number,c:MatchClock):number{
 if(c.half===null||shown<c.base)return shown;
 return (c.kick??c.half)+(shown-c.base);
}
/** A live minute when no replay is held (a fixture's card): live second s with the break as its header promises,
 * the whistle assumed on the clock (a played-out attack only makes this a few seconds early, never the second half
 * early: the board's score comes from the live score, which never runs ahead). */
export function roughLive(s:number,length:number,interval:number):{label:string;half:boolean}{
 const base=length/2;
 if(!interval||s<base)return {label:mmss(Math.max(0,Math.min(length,s))),half:false};
 if(s<base+interval)return {label:'HT',half:true};
 return {label:mmss(Math.min(length,s-interval)),half:false};
}
