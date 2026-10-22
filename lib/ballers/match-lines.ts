// The per-player lines of a computed match (lib/ballers/stats.ts), read from its compact replay, in one
// place for both callers: the official submission (simulation.ts, what ballers_submit stores on the result)
// and the practice worker (engine.worker.ts, what a practice replay's marks read). Browser-safe, and it
// plays nothing: it only reads a match already computed.
//
// The official lines also carry each player's mark and role (PLAYER_STATS_VERSION 3, MARKS-GROWTH.md):
// computed here once, by the same matchRatings the screens use, from the same lines, score, match length
// and slots, so the stored mark is the mark the match page shows for that result. Growth reads it at the
// round close (a good game teaches more). Practice replies stay unmarked: their screens mark them on read.
import {matchRoles,type RolesEvent} from './ratings';
import {marksOf,matchSeconds,type RatingHeader} from './ratings-read';
import {timeline,type CompactMatch} from './replay';
import {matchPlayerStats,type PlayerLine} from './stats';

/** The lines, or null if the derivation fails: a missing record never costs the match. With `marks`, each line
 * also carries his mark (`mk`, when he has one) and role (`rl`); marking that fails leaves the lines unmarked. */
export function computedPlayerLines(c:{compact:Pick<CompactMatch,'header'|'chunks'>&{score?:readonly [number,number]}},o:{marks?:boolean}={}):PlayerLine[]|null{
 let lines:PlayerLine[],events;
 try{const t=timeline(c.compact.header,c.compact.chunks);events=t.events;lines=matchPlayerStats(c.compact.header,t.events,t.frames);}
 catch(e){console.warn('ballers player stats skipped:',e instanceof Error?e.message:'unknown');return null;}
 if(!o.marks||!c.compact.score)return lines;
 try{return markedLines(lines,c.compact.header as RatingHeader,events,c.compact.score);}
 catch(e){console.warn('ballers marks skipped:',e instanceof Error?e.message:'unknown');return lines;}
}

/** The lines with each player's mark and role, read exactly as the match page reads them (ratings-read.ts
 * replayMarks: the slots from the header and the substitutions, the match length from the header, the final
 * score). A player with no mark (under a ninth of the match) keeps his role and gets no `mk`; lines that cannot
 * be rated come back as they were. */
export function markedLines(lines:readonly PlayerLine[],header:RatingHeader,events:readonly RolesEvent[],score:readonly [number,number]):PlayerLine[]{
 const roles=matchRoles(header,events);
 const marks=marksOf(lines,score,matchSeconds(header),roles);
 return lines.map(l=>{
  const r=marks?.ratings.get(l.id),rl=roles.get(l.id);
  return {...l,...(rl?{rl}:{}),...(typeof r?.mark==='number'?{mk:r.mark}:{})};
 });
}

/** The practice worker's reply to a match request (lib/ballers/lab/protocol.ts MatchResult): the compact
 * replay, as it always was, plus the main match's lines when they could be read (additive). */
export function practiceMatchResult<M extends {compact:CompactMatch;dropped:string[];engineBuild:string},C,B>(main:M,cost:C,balanced?:B){
 const players=computedPlayerLines(main);
 return {compact:main.compact,dropped:main.dropped,engineBuild:main.engineBuild,cost,...(balanced?{balanced}:{}),...(players?{players}:{})};
}
