// The spoiler rule for every Game plan surface (BUILD-PLAN; owner's standing
// rule, 27 Sep): NOTHING about a match before its official FULL TIME. After
// full time your own results need no secrecy: tallies, pictures, reports,
// scouting and standings include every finished match, watched or not.
// (TECH-SPEC §6.5 proposed leaving your own unwatched matches out; the owner's
// rule overrides it.) The one per-match display that waits for you is the
// score reveal itself (BallersShell `hidden`), and it is never a reason to drop
// a match from a count. (Owner, 2 Oct: not even that any more: after full
// time your own score is never hidden, and the Game plan screens no longer
// call `hidden` or `reveal`.)
//
// FULL TIME is `ballers_results.visible_from` and nothing else. Other tables
// carry a `visible_from` too, but it means something else: on
// `ballers_replay_chunks` and the markers it is the BROADCAST time of that
// slice (kickoff - 15 s up to about full time - 75 s), so a chunk is "visible"
// long before the final whistle. Never gate on a non-results row's own time:
//   - results rows      -> finishedOnly(results)
//   - anything else      -> onlyFinishedMatches(rows, results), keyed by match_id
// `ballers_results` row security already returns a row only once its
// visible_from has passed (policy "results after full time": visible_from <=
// now()); its `live_from` column is the kickoff of a match that has finished,
// never a way in early. The client check below is belt and braces for a page
// left open across full time.

/** The fields of a `ballers_results` row this gate reads. `home_goals` is
 * required so a replay chunk or marker row (which has no score) cannot be
 * passed by mistake. */
export interface FullTimeRow {match_id:string;visible_from:string|null|undefined;home_goals:number}

/** Is this match past full time? Pass a `ballers_results` row (or anything
 * holding the RESULT's `visible_from`), never a chunk, marker or prep. */
export const pastFullTime=(result:{visible_from:string|null|undefined},now=Date.now())=>
 !!result.visible_from&&Date.parse(result.visible_from)<=now;

/** The finished matches among `ballers_results` rows, in their order. */
export const finishedOnly=<T extends FullTimeRow>(results:readonly T[],now=Date.now())=>results.filter(r=>pastFullTime(r,now));

/** The match ids that are past full time, from `ballers_results` rows. */
export const finishedMatchIds=(results:readonly FullTimeRow[],now=Date.now())=>new Set(finishedOnly(results,now).map(r=>r.match_id));

/** Rows from any other source (replay chunks, markers, idea runs, preps keyed
 * by match): kept only when their match is past full time per its RESULT row.
 * The rows' own times are ignored. */
export const onlyFinishedMatches=<T extends {match_id:string}>(rows:readonly T[],results:readonly FullTimeRow[],now=Date.now())=>{
 const done=finishedMatchIds(results,now);
 return rows.filter(r=>done.has(r.match_id));
};
