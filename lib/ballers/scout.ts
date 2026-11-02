// Ballers scouting: what a manager may learn about the next opponent before
// the lock. PAST ONLY: every fact here is read from results the database
// already shows (ballers_results is row-secured to past full time), the
// per-player lines stored on them (lib/ballers/stats.ts), their unnamed idea
// markers and the club's last revealed shape (ballers_practice_side). Never a
// prep, a lineup for the coming match or an idea's name. Pure (no I/O): the
// screen loads, this counts.
//
// Spoilers: the only rule is full time. Every visible result counts, your own
// unwatched ones included.
import {clubSeasonStats, readPlayerStats, type StatsResult} from './stats';
import type {Marker} from './ideas';
import type {LeagueData} from './data';
import {PRESETS, type Approach, type Formation, type Result, type StoredApproach, type Style} from './league';

/** Matches the scouting report reads (DECISIONS Q5.5: the last three official ones). */
const SCOUT_MATCHES=3;
const FORM_MATCHES=5;

const byNewest=(a:Result,b:Result)=>Date.parse(b.live_from)-Date.parse(a.live_from);
const involves=(r:Result,club:string)=>r.home_club===club||r.away_club===club;

/** The club's visible results the manager may scout from, newest first. */
export function scoutable(results:Result[],club:string,n=SCOUT_MATCHES):Result[]{
 return results.filter(r=>involves(r,club)).sort(byNewest).slice(0,n);
}

export type FormCell='W'|'D'|'L';
/** The last `n` results, oldest first (reads left to right like a table's form column). */
export function formOf(results:Result[],club:string,n=FORM_MATCHES):FormCell[]{
 return results.filter(r=>involves(r,club)).sort(byNewest).slice(0,n).reverse().map(r=>{
  const home=r.home_club===club,gf=home?r.home_goals:r.away_goals,ga=home?r.away_goals:r.home_goals;
  return gf>ga?'W':gf<ga?'L':'D';
 });
}

/** One player's contribution over the scouted matches, from the per-player
 * lines stored on each result (no replay is read). */
export interface PlayerTally {id:string;matches:number;goals:number;assists:number;saves:number;shots:number}
export const emptyTally=(id:string):PlayerTally=>({id,matches:0,goals:0,assists:0,saves:0,shots:0});

/** The club's players' tallies over `sample`, and how many of those matches
 * carry a stored record (a result computed before the record existed has
 * none and simply adds nothing). */
export function scoutTallies(sample:StatsResult[],club:string):{read:number;tallies:PlayerTally[]}{
 const read=sample.filter(r=>readPlayerStats(r.player_stats)!==null).length;
 const tallies=clubSeasonStats(sample,club).map(l=>({id:l.id,matches:l.apps,goals:l.goals,assists:l.assists,saves:l.saves,shots:l.shots}));
 return {read,tallies};
}

export type WatchStat='goals'|'assists'|'saves';
export interface Watch {id:string;stat:WatchStat;value:number;tally:PlayerTally}
/** A goal is worth most; a save least. Only for ordering. */
const WEIGHT:Record<WatchStat,number>={goals:4,assists:3,saves:1};
const STATS:WatchStat[]=['goals','assists','saves'];
/** Up to `n` players whose numbers stand out, each with his headline stat.
 * Nobody is picked on nothing: a player needs at least one goal or assist,
 * or three saves. Ties go to more shots, then fewer matches, then the id (stable). */
export function playersToWatch(tallies:PlayerTally[],n=3):Watch[]{
 const score=(t:PlayerTally)=>STATS.reduce((s,k)=>s+t[k]*WEIGHT[k],0);
 const worth=(t:PlayerTally)=>t.goals+t.assists>0||t.saves>=3;
 return tallies.filter(worth).sort((a,b)=>score(b)-score(a)||b.shots-a.shots||a.matches-b.matches||a.id.localeCompare(b.id)).slice(0,n).map(t=>{
  const stat=[...STATS].sort((a,b)=>t[b]*WEIGHT[b]-t[a]*WEIGHT[a])[0];
  return {id:t.id,stat,value:t[stat],tally:t};
 });
}
/** "3 goals · 1 assist", headline first, zeros left out. */
export function tallyLine(t:PlayerTally,lead:WatchStat):string{
 const word:Record<WatchStat,[string,string]>={goals:['goal','goals'],assists:['assist','assists'],saves:['save','saves']};
 return [lead,...STATS.filter(k=>k!==lead)].filter(k=>t[k]>0).map(k=>`${t[k]} ${word[k][t[k]===1?0:1]}`).join(' · ');
}

/** How the club's own ideas went in the scouted matches: counts only, never
 * which idea. `tried` = the players actually went for one; `worked` = it
 * played out as drawn (the marker's public `run`, lib/ballers/idea-run.ts;
 * a row computed before that keeps the older verdict: the idea ran to its
 * end). Scouting reads no replay. Engine-generic plays don't count. */
export interface IdeaRecord {matches:number;tried:number;worked:number}
export function ideaRecord(matches:{side:0|1;markers:Marker[]}[]):IdeaRecord{
 let tried=0,worked=0;
 for(const m of matches)for(const k of m.markers){
  if(k.side!==m.side||k.free)continue;
  if(k.run){if(k.progress==='attempted'||k.run!=='broke'){tried++;if(k.run==='ran')worked++;}continue;}
  if(k.progress!=='attempted')continue;
  tried++;if(k.end_reason==='complete')worked++;
 }
 return {matches:matches.length,tried,worked};
}

/** How the club lined up, as ballers_practice_side reports it: any club, AI
 * or member, in its most recent revealed league match (its frozen input),
 * `from:'match'`. A club with no league match revealed yet: an AI club's
 * fixed tactics (its club row), `from:'club'`; a member club's is null
 * ('generic': nothing of theirs to show). `adjusted`: its settings differ from
 * the style's preset ("Based on Direct · adjusted"). */
export interface LastShape {formation:Formation;style:Style;adjusted:boolean;from:'match'|'club'}
export function lastShape(side:{formation:Formation;style:Style;approach?:Partial<StoredApproach>|null;source?:string},at?:string|null):LastShape|null{
 const from=side.source==='last_match'?'match':side.source==='ai'?'club':null;
 return from?{formation:side.formation,style:side.style,adjusted:adjustedFrom(side.style,side.approach,from==='match'?at:null),from}:null;
}

/** A preset as it stood before a change: a match that kicked off before
 * `until` and played it played the preset of its day, not an adjustment.
 * Short combinations was Narrow + Drops deep until the striker-pivot round
 * (2026-10-01). (Counter's brief Regroup, 30 Sep, overlapped no match.) */
const FORMER_PRESETS:{style:Style;until:string;differs:Partial<Approach>}[]=[
 {style:'combinations',until:'2026-10-01T00:00:00+03:00',differs:{width:'narrow',striker:'link'}},
];

/** Whether an approach differs from its style's preset (lib/ballers/league.ts
 * PRESETS). A missing "On losing it" is read as the preset's own (an input
 * frozen before the field existed was not a choice to change it). `at`: when
 * the match kicked off; a preset that has since changed still counts for
 * matches played before the change (FORMER_PRESETS). No approach at all, or a
 * style we don't know: nothing to say, so not adjusted. */
export function adjustedFrom(style:string,approach:Partial<StoredApproach>|null|undefined,at?:string|null):boolean{
 const preset=PRESETS[style as Style];
 if(!preset||!approach||typeof approach!=='object')return false;
 const differs=(p:Approach)=>(Object.keys(p) as (keyof Approach)[]).some(k=>k==='onLoss'&&approach.onLoss===undefined?false:String(approach[k])!==String(p[k]));
 if(!differs(preset))return false;
 // A past match: the preset of its day counts as the preset.
 const t=at?Date.parse(at):NaN;
 return !FORMER_PRESETS.some(f=>f.style===style&&t<Date.parse(f.until)&&!differs({...preset,...f.differs}));
}

/** The match ballers_practice_side reads a club's last shape from: its
 * newest LEAGUE result by `visible_from` (the RPC's own order), so the note
 * under the shape names that same match. `kindOf` gives a match's kind when
 * the schedule is loaded; otherwise a result with a round counts as league. */
export function lastLeagueResult(results:Result[],club:string,kindOf:(id:string)=>string|undefined=()=>undefined):Result|null{
 const league=(r:Result)=>{const k=kindOf(r.match_id);return k?k==='league':r.round_id!==null;};
 return results.filter(r=>involves(r,club)&&league(r)).sort((a,b)=>Date.parse(b.visible_from)-Date.parse(a.visible_from))[0]??null;
}

/** lastLeagueResult over the loaded league, match kinds from its schedule. */
export function lastLeagueOf(league:Pick<LeagueData,'results'|'matches'>|null|undefined,club:string):Result|null{
 const kinds=new Map((league?.matches??[]).map(m=>[m.id,m.kind]));
 return lastLeagueResult(league?.results??[],club,id=>kinds.get(id));
}

/** No match to scout yet: what the squad itself says (public on the Team page).
 * Player types, most common first; ties by the first shirt number. */
export function squadTypes<T extends {archetype:string;number:number}>(squad:T[]):{archetype:T['archetype'];count:number}[]{
 const m=new Map<string,{archetype:T['archetype'];count:number;first:number}>();
 for(const p of squad){const x=m.get(p.archetype)??{archetype:p.archetype,count:0,first:p.number};x.count++;x.first=Math.min(x.first,p.number);m.set(p.archetype,x);}
 return [...m.values()].sort((a,b)=>b.count-a.count||a.first-b.first).map(({archetype,count})=>({archetype,count}));
}
