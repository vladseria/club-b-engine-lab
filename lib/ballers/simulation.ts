// Official match computation (server only). The ONLY input is the frozen
// snapshot Postgres built at the lock (ballers_match_inputs, from the round's
// prep rows and the squads); nothing here reads ideas, club defaults or the
// browser. Output: compact replay v2 (lib/ballers/replay.ts), chunked and
// gzipped for ballers_submit. The engine call and the compaction live in
// ./compute (browser-safe, shared with the practice worker).
import {gzipSync} from 'node:zlib';
import type {Computed,FrozenInput} from './compute';
import {computedPlayerLines} from './match-lines';
import type {PlayerLine} from './stats';
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
 // Half-time (deliverables/ballers-half-time/DESIGN.md 2.2): the second half's chunks open on the LIVE clock, a break
 // after their match second (ballers_submit stores visible_from = live_from + t0 - 15 s from the payload's t0), and the
 // payload says when the whistle went and how long the break is, so ballers_submit (from migration
 // 20261022090000_ballers_submit_half_time) can hold the result, the substitution notes and the second half's idea
 // markers back by the break too. A match without a half-time sends exactly what it always did.
 const halfEv=c.compact.chunks.flatMap(ch=>ch.e).find(e=>e.k==='half'),halfS=halfEv?halfEv.t/1000:null,brk=header.interval??0;
 // when the whistle went: the last chunk's `end` (the header holds the match length only, replay.ts)
 const playedS=c.compact.chunks.at(-1)?.end?.played??header.duration;
 const live=(sec:number)=>halfS!==null&&sec>=halfS?Math.round((sec+brk)*1000)/1000:sec;
 const planKey=(side:0|1,planId:string|null)=>planId===null?null:input.sides[side].plans.find(p=>{const id=(p.plan as {id?:unknown}).id;return id===planId||p.key===planId;})?.key??planId;
 return {
  // `duration` is the match length (ballers_submit checks it against the input);
  // `played`, only when the last attack ran past it, is when the whistle went.
  engine_build:c.engineBuild,duration:input.duration,...(playedS>input.duration?{played:playedS}:{}),score:c.compact.score,
  // (styles as identities, slice 2) each side's style tallies join its stats (numbers only; no schema change): what
  // the Tribuna's style findings read. Absent when no side is Short and no surge happened.
  stats:c.compact.styles?c.compact.stats.map((st,i)=>({...st,...c.compact.styles![i]})):c.compact.stats,
  header:pack(header),
  chunks:c.compact.chunks.map(ch=>({i:ch.i,t0:live(ch.t0/1000),t1:halfS!==null&&ch.t1/1000>halfS?live(ch.t1/1000):ch.t1/1000,data:pack(ch)})),
  ...(halfS!==null&&brk?{half:halfS,interval:brk}:{}),
  ideas:c.compact.ideas.map(i=>({seq:i.seq,side:i.side,t:i.t/1000,ended_at:i.endedAt===null?null:i.endedAt/1000,status:i.status,end_reason:i.endReason,progress:i.progress,
   plan_key:planKey(i.side,i.planId),name:i.planId===null?null:i.name,
   // The classifier's word only (ran/partly/broke): public on the marker row.
   ...(i.planId!==null&&i.detail?.run?{run:i.detail.run}:{}),
   ...(i.planId!==null&&i.detail&&Object.keys(i.detail).length?{detail:i.detail}:{})})),
  sub_notes:c.compact.substitutionNotes??[],
  // Bebe's showcase only: absent from every league payload (no input there carries the key).
  ...(c.injuries?.length?{injuries:c.injuries}:{}),
  // Per-player lines (lib/ballers/stats.ts), stored on the result row so they
  // share its full-time gate, each with his mark and role (version 3: what
  // growth reads at the round close). Omitted if the derivation fails: a
  // missing record never costs the match.
  ...playerLines(c),
  dropped:c.dropped,
 };
}

function playerLines(c:Computed):{players?:PlayerLine[]}{
 const players=computedPlayerLines(c,{marks:true});
 return players?{players}:{};
}
