// The per-player lines of a computed match (lib/ballers/stats.ts), read from its compact replay, in one
// place for both callers: the official submission (simulation.ts, what ballers_submit stores on the result)
// and the practice worker (engine.worker.ts, what a practice replay's marks read). Browser-safe, and it
// plays nothing: it only reads a match already computed.
import {timeline,type CompactMatch} from './replay';
import {matchPlayerStats,type PlayerLine} from './stats';

/** The lines, or null if the derivation fails: a missing record never costs the match. */
export function computedPlayerLines(c:{compact:Pick<CompactMatch,'header'|'chunks'>}):PlayerLine[]|null{
 try{const t=timeline(c.compact.header,c.compact.chunks);return matchPlayerStats(c.compact.header,t.events,t.frames);}
 catch(e){console.warn('ballers player stats skipped:',e instanceof Error?e.message:'unknown');return null;}
}

/** The practice worker's reply to a match request (lib/ballers/lab/protocol.ts MatchResult): the compact
 * replay, as it always was, plus the main match's lines when they could be read (additive). */
export function practiceMatchResult<M extends {compact:CompactMatch;dropped:string[];engineBuild:string},C,B>(main:M,cost:C,balanced?:B){
 const players=computedPlayerLines(main);
 return {compact:main.compact,dropped:main.dropped,engineBuild:main.engineBuild,cost,...(balanced?{balanced}:{}),...(players?{players}:{})};
}
