// Official match computation (server only). The ONLY input is the frozen
// snapshot Postgres built at the lock (ballers_match_inputs, from the round's
// prep rows and the squads); nothing here reads ideas, club defaults or the
// browser. Output: compact replay v2 (lib/ballers/replay.ts), chunked and
// gzipped for ballers_submit. The engine call and the compaction live in
// ./compute (browser-safe, shared with the practice worker).
import {gzipSync} from 'node:zlib';
import type {Computed,FrozenInput} from './compute';
import {timeline} from './replay';
import {matchPlayerStats,type PlayerLine} from './stats';
export * from './compute';

/** gzip + base64 for one JSON value (what ballers_submit stores as bytea). */
export const pack=(value:unknown)=>gzipSync(Buffer.from(JSON.stringify(value)),{level:9}).toString('base64');

/** The body of ballers_submit's p_payload. Idea names (and their detail: the
 * pitch links, how the idea ended) are sent once, for the owner-only table;
 * opponents only ever read unnamed markers, which carry the classifier's
 * one word (`run`: ran/partly/broke) and nothing of the lesson. Substitution notes go to the
 * owner-only notes table, readable from full time. */
export function submission(c:Computed,input:FrozenInput){
 const header={...c.compact.header,engineBuild:c.engineBuild};
 const planKey=(side:0|1,planId:string|null)=>planId===null?null:input.sides[side].plans.find(p=>{const id=(p.plan as {id?:unknown}).id;return id===planId||p.key===planId;})?.key??planId;
 return {
  // `duration` is the match length (ballers_submit checks it against the input);
  // `played`, only when the last attack ran past it, is when the whistle went.
  engine_build:c.engineBuild,duration:input.duration,...(header.duration>input.duration?{played:header.duration}:{}),score:c.compact.score,stats:c.compact.stats,
  header:pack(header),
  chunks:c.compact.chunks.map(ch=>({i:ch.i,t0:ch.t0/1000,t1:ch.t1/1000,data:pack(ch)})),
  ideas:c.compact.ideas.map(i=>({seq:i.seq,side:i.side,t:i.t/1000,ended_at:i.endedAt===null?null:i.endedAt/1000,status:i.status,end_reason:i.endReason,progress:i.progress,
   plan_key:planKey(i.side,i.planId),name:i.planId===null?null:i.name,
   // The classifier's word only (ran/partly/broke): public on the marker row.
   ...(i.planId!==null&&i.detail?.run?{run:i.detail.run}:{}),
   ...(i.planId!==null&&i.detail&&Object.keys(i.detail).length?{detail:i.detail}:{})})),
  sub_notes:c.compact.substitutionNotes??[],
  // Per-player lines (lib/ballers/stats.ts), stored on the result row so they
  // share its full-time gate. Omitted if the derivation fails: a missing
  // record never costs the match.
  ...playerLines(c),
  dropped:c.dropped,
 };
}

function playerLines(c:Computed):{players?:PlayerLine[]}{
 try{const t=timeline(c.compact.header,c.compact.chunks);return {players:matchPlayerStats(c.compact.header,t.events,t.frames)};}
 catch(e){console.warn('ballers player stats skipped:',e instanceof Error?e.message:'unknown');return {};}
}
