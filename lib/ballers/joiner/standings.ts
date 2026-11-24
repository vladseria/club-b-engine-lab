// The joiner's table rule and the small pure selectors pages need (deliverables/ballers-joiner/CONTRACT.md §2, §4, §5,
// §6). No I/O and no clock of their own: the time is always passed in.
//
// Which state to pass (useBallers().joiner is the state as read; `w.joiner` in the league model is it as the viewer may
// see it at `w.now`):
// - anything every viewer sees alike (the table, the club lists, the line under the table, a reserve club's page, the
//   paper): the viewed state, `joinerAt(joiner, now)`. A takeover decided while a league night is on stays out of sight
//   until its `shown_from` (the cron sets it once the night's results are all visible), so the relegated club keeps its
//   row while its last match is on the air and nobody reads the news before the edition.
// - the newcomer's own deal and his own place (Home's "you're in", the play-off page): the state as read.
//
// `leagueStandings` is the database's rule exactly (`private.ballers_league_table`) on whatever state it is given; with
// an empty state it is `standings()` of lib/ballers/league.ts byte for byte (verificare/ballers-joiner-client.test.ts).
// A past round's table (League's story, a match's "where it left you", the paper) passes `joinerForRound`'s state.
import {BROADCAST_MAX_SECONDS, type Club, type Match, type Result, type Round, type TableRow} from '../league';
import {JOINER_CONFIG} from './config';
import type {Award, JoinerState, Place, PlayoffMatch, Takeover, TakeoverLine} from './types';

const HOUR_MS=3600_000,DAY_MS=24*HOUR_MS;
const byDecided=(a:Takeover,b:Takeover)=>Date.parse(a.decided_at)-Date.parse(b.decided_at)||(a.id<b.id?-1:a.id>b.id?1:0);

// ------------------------------------------------------------------ places
/** The club's place outside the league (waiting or reserve); null: it plays (or no club). */
export function clubPlace(joiner:JoinerState,clubId:string|null|undefined):Place|null{
 return clubId?joiner.places.find(p=>p.club===clubId)??null:null;
}
/** The club plays in the league (no place row: `private.ballers_plays`). */
export const plays=(joiner:JoinerState,clubId:string)=>!clubPlace(joiner,clubId);
/** The club was founded with a deal and is not in the league yet. */
export const isWaiting=(joiner:JoinerState,clubId:string|null|undefined)=>clubPlace(joiner,clubId)?.state==='waiting';
/** The club was relegated (it stays visitable and practisable, its history intact). */
export const inReserve=(joiner:JoinerState,clubId:string|null|undefined)=>clubPlace(joiner,clubId)?.state==='reserve';
/** "The league's clubs": every club that plays, in the order given (waiting and reserve clubs left out). Use it wherever
 * a page lists the league (Find, the practice picker's "rest of the league", "The league has N clubs", the paper). */
export function leagueClubs<C extends {id:string}>(clubs:readonly C[],joiner:JoinerState):C[]{
 if(!joiner.places.length)return [...clubs];
 const out=new Set(joiner.places.map(p=>p.club));
 return clubs.filter(c=>!out.has(c.id));
}

// ------------------------------------------------------------------ awards and the table
/** The awards of one competition by club, an award of an undone takeover left out (the undo removes the row; this keeps
 * a read that caught the two halfway from counting it). */
function awardsIn(joiner:JoinerState,competition:string|null|undefined):Map<string,Award>{
 const out=new Map<string,Award>();
 if(!competition||!joiner.awards.length)return out;
 const undone=new Set(joiner.takeovers.filter(t=>t.undone_at!==null).map(t=>t.id));
 for(const a of joiner.awards)if(a.competition===competition&&!undone.has(a.takeover))out.set(a.club,a);
 return out;
}
/** The points the league awarded this club in this competition, or null. */
export function awardOf(joiner:JoinerState,competition:string|null|undefined,clubId:string|null|undefined):Award|null{
 return clubId?awardsIn(joiner,competition).get(clubId)??null:null;
}

/** A table row: `standings()`'s, plus `awarded` (right after `points`, which already includes it) only when the club has
 * an award in this competition; the key is absent everywhere else. */
export interface LeagueRow extends TableRow {awarded?:number}
/** One result as the table counts it (lib/ballers/league.ts tableResults). */
export type TableLine={home:string;away:string;hs:number;as:number};

/** The league table (CONTRACT §2): rows = the clubs that play (results against a waiting or reserve club still count for
 * the clubs that played it); points = won × 3 + drawn + awarded; order: points, then "has an award and has played no
 * match" after the others (a newcomer level on points is placed below), then goal difference, goals for, name.
 * `results`: already narrowed to `competition`, as every caller of standings() narrows them today; `competition`: the
 * season the results belong to (its awards count; null: none). With no place and no award of that competition the rows
 * are exactly `standings(clubs, results)`. For a finished season use its archive (`ballers_season_archive.standings`,
 * whose rows carry `awarded` when there was one), never today's places. */
export function leagueStandings(clubs:readonly Club[],results:readonly TableLine[],joiner:JoinerState,competition:string|null|undefined):LeagueRow[]{
 const awards=awardsIn(joiner,competition);
 return leagueClubs(clubs,joiner).map((club):LeagueRow=>{
  let won=0,drawn=0,lost=0,gf=0,ga=0,played=0;
  for(const r of results){if(r.home!==club.id&&r.away!==club.id)continue;const home=r.home===club.id,a=home?r.hs:r.as,b=home?r.as:r.hs;played++;gf+=a;ga+=b;if(a>b)won++;else if(a===b)drawn++;else lost++;}
  const award=awards.get(club.id);
  return award?{club,played,won,drawn,lost,gf,ga,points:won*3+drawn+award.points,awarded:award.points}:{club,played,won,drawn,lost,gf,ga,points:won*3+drawn};
 }).sort((a,b)=>b.points-a.points||fresh(a)-fresh(b)||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.club.name.localeCompare(b.club.name));
}
/** 1 for a row whose points are only an award (no match played yet): it goes below a club level with it. */
const fresh=(r:LeagueRow)=>r.awarded!==undefined&&r.played===0?1:0;

/** The state as the league stood for round `n` of a competition: the table after round n, and the table it is compared
 * with ("before round n": the rounds before it). A takeover of that competition counts from its first handed-over round
 * (`from_round`); for an earlier round it had not happened yet: its rival still played (a row, with every result it
 * had), its newcomer was not in the league (no row, no award). So a past round's table, story and paper read as they did
 * when they came out, and a round's two tables always hold the same clubs. The award's own rule (CONTRACT §2 change 27,
 * `after_round` ≤ n) holds with it: `after_round` is always before `from_round`. A takeover that handed nothing over
 * changes no table. Pass the viewed state (joinerAt); the same object back when nothing changes. (Joiner pages, 14 Nov.) */
export function joinerForRound(joiner:JoinerState,competition:string|null|undefined,n:number):JoinerState{
 if(!competition||!joiner.takeovers.length)return joiner;
 const later=joiner.takeovers.filter(t=>t.competition===competition&&t.undone_at===null&&t.from_round!==null&&t.from_round>n);
 if(!later.length)return joiner;
 const gone=new Set(later.map(t=>t.id)),back=new Set(later.map(t=>t.rival));
 const places:Place[]=joiner.places.filter(p=>!(p.state==='reserve'&&back.has(p.club)));
 for(const t of later)if(!places.some(p=>p.club===t.club))places.push({club:t.club,state:'waiting',since:t.decided_at});
 return {...joiner,places,awards:joiner.awards.filter(a=>!gone.has(a.takeover))};
}
/** A past season's archived row's award (`ballers_season_archive.standings` rows carry `awarded` only when there was
 * one; lib/ballers/league.ts ArchiveRow, a guarded file, does not name the key). */
export const archiveAwarded=(row:object):number|undefined=>{const v=(row as {awarded?:unknown}).awarded;return typeof v==='number'?v:undefined;};
/** The takeover that put this club in reserve (any season), the newest not undone, or null. Pass the viewed state. */
export function relegationOf(joiner:JoinerState,clubId:string|null|undefined):Takeover|null{
 if(!clubId||!inReserve(joiner,clubId))return null;
 return joiner.takeovers.filter(t=>t.rival===clubId&&t.undone_at===null).sort(byDecided).at(-1)??null;
}
/** The AI club a waiting club's play-off is against: its place names it (CONTRACT item 61: the rival of its open or won
 * deal); for a state read before that item, its won play-off match, or a takeover the operator undid (the play-off is
 * open again against the same club). Null when nothing public names it. Pass the state as read. */
export function waitingRival(joiner:JoinerState,clubId:string|null|undefined):string|null{
 if(!clubId||!isWaiting(joiner,clubId))return null;
 const named=clubPlace(joiner,clubId)?.rival;
 if(named)return named;
 const won=joiner.playoffs.filter(m=>m.away===clubId).sort((a,b)=>Date.parse(b.live_from)-Date.parse(a.live_from))[0];
 if(won)return won.home;
 return joiner.takeovers.filter(t=>t.club===clubId).sort(byDecided).at(-1)?.rival??null;
}

// ------------------------------------------------------------------ what a viewer may see at a moment
/** The takeover's news is out at `now` (the edition, the notices, the table's change). */
export const shownAt=(t:Pick<Takeover,'shown_from'>,now:number)=>t.shown_from!==null&&Date.parse(t.shown_from)<=now;
/** The state as a viewer may see it at `now`: an undone takeover is gone with its award and lines; a takeover whose news
 * is not out yet (`shown_from` null or later) is not seen at all: its award, record and lines are left out and, when it
 * handed fixtures over, its rival is still playing and its newcomer still waiting. The play-off matches stay (a won
 * first try is watched live by anyone online). The same object back when there is nothing to hide. */
export function joinerAt(joiner:JoinerState,now:number):JoinerState{
 const hidden=joiner.takeovers.filter(t=>t.undone_at===null&&!shownAt(t,now)),undone=joiner.takeovers.filter(t=>t.undone_at!==null);
 if(!hidden.length&&!undone.length)return joiner;
 const gone=new Set([...hidden,...undone].map(t=>t.id));
 const moved=hidden.filter(t=>t.from_round!==null),back=new Set(moved.map(t=>t.rival));
 const places:Place[]=joiner.places.filter(p=>!(p.state==='reserve'&&back.has(p.club)));
 // (the newcomer's waiting row is gone from the database once he has taken over; its `since` is not read back, so the
 // decision's moment stands in for it)
 for(const t of moved)if(!places.some(p=>p.club===t.club))places.push({club:t.club,state:'waiting',since:t.decided_at});
 return {places,awards:joiner.awards.filter(a=>!gone.has(a.takeover)),takeovers:joiner.takeovers.filter(t=>!gone.has(t.id)),
  playoffs:joiner.playoffs,lines:joiner.lines.filter(l=>!gone.has(l.takeover))};
}

// ------------------------------------------------------------------ takeovers
/** The takeovers of a competition whose news is out at `now` (not undone, from `shown_from`), in the order they were
 * decided: one special edition each, stacked in that order. */
export function takeoversOf(joiner:JoinerState,competition:string|null|undefined,now:number):Takeover[]{
 if(!competition)return [];
 return joiner.takeovers.filter(t=>t.competition===competition&&t.undone_at===null&&shownAt(t,now)).sort(byDecided);
}
/** A club relegated in a competition, for the line under its table ("Relegated after round 14: Rapid Pensia"): `after`
 * is the last round it played in the league (the round before the first one handed over). Exactly the rivals the same
 * state's table leaves out: fixtures were handed over and the club is in reserve. */
export interface Relegation {club:string;after:number;takeover:Takeover}
export function relegatedIn(joiner:JoinerState,competition:string|null|undefined):Relegation[]{
 if(!competition)return [];
 const reserve=new Set(joiner.places.filter(p=>p.state==='reserve').map(p=>p.club));
 return joiner.takeovers.filter(t=>t.competition===competition&&t.undone_at===null&&t.from_round!==null&&reserve.has(t.rival)).sort(byDecided)
  .map(t=>({club:t.rival,after:t.from_round!-1,takeover:t}));
}
/** Your own takeover (you are the newcomer): the newest one not undone, shown or not. Pass the state as read. */
export function myTakeover(joiner:JoinerState,clubId:string|null|undefined):Takeover|null{
 if(!clubId)return null;
 return joiner.takeovers.filter(t=>t.club===clubId&&t.undone_at===null).sort(byDecided).at(-1)??null;
}
/** Whether the page reads your own deal (`ballers_playoff_mine`, CONTRACT §6): your club is waiting, or your takeover is
 * younger than a day. Pass the state as read. */
export function needsMyPlayoff(joiner:JoinerState,clubId:string|null|undefined,now:number):boolean{
 if(isWaiting(joiner,clubId))return true;
 const t=myTakeover(joiner,clubId);
 return !!t&&now-Date.parse(t.decided_at)<DAY_MS;
}

/** Your next opponent changed: when a takeover's news came out, your next league match was one it handed over (the
 * relegated club's, now the newcomer's), and that match is still to come. The newest such takeover, or null. */
export interface OpponentChange {takeover:Takeover;match:Match}
export function opponentChanged(joiner:JoinerState,league:{matches:readonly Match[];rounds:readonly Pick<Round,'id'|'number'>[];results:readonly Pick<Result,'match_id'|'visible_from'>[]},
 clubId:string|null|undefined,now:number):OpponentChange|null{
 if(!clubId||!joiner.takeovers.length)return null;
 const no=new Map(league.rounds.map(r=>[r.id,r.number])),seen=new Map(league.results.map(r=>[r.match_id,Date.parse(r.visible_from)]));
 let found:OpponentChange|null=null;
 for(const t of joiner.takeovers.filter(x=>x.undone_at===null&&x.from_round!==null&&x.club!==clubId&&shownAt(x,now)).sort(byDecided)){
  const at=Date.parse(t.shown_from!);
  const mine=league.matches.filter(m=>m.kind==='league'&&m.competition_id===t.competition&&!!m.round_id&&no.has(m.round_id)&&(m.home_club===clubId||m.away_club===clubId))
   .sort((a,b)=>no.get(a.round_id!)!-no.get(b.round_id!)!||Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at));
  // your next match at the moment the news came out: the first with no result readable then
  const next=mine.find(m=>{const v=seen.get(m.id);return v===undefined||v>at;});
  if(!next||seen.has(next.id))continue;
  const opp=next.home_club===clubId?next.away_club:next.home_club;
  if(opp===t.club&&no.get(next.round_id!)!>=t.from_round!)found={takeover:t,match:next};
 }
 return found;
}

// ------------------------------------------------------------------ the won play-off matches
/** A won play-off match on the clock: 'walkout' from the walk-out (live_from − JOINER_CONFIG.walkout), 'live' from
 * kick-off until full time at the latest (BROADCAST_MAX_SECONDS: the page refines it with the replay header's length),
 * then 'done'. A quick try's win is stored already played (its full time is the moment it is stored), so it is 'done'. */
export type PlayoffPhase='before'|'walkout'|'live'|'done';
export function playoffPhase(m:Pick<PlayoffMatch,'live_from'|'pace'>,now:number):PlayoffPhase{
 if(m.pace==='quick')return 'done';
 const lf=Date.parse(m.live_from);
 if(now>=lf+BROADCAST_MAX_SECONDS*1000)return 'done';
 if(now>=lf)return 'live';
 return now>=lf-JOINER_CONFIG.walkout*1000?'walkout':'before';
}
/** The play-offs on now (walk-out or live), soonest first: one notice and one match to open each. */
export function livePlayoffs(joiner:JoinerState,now:number):PlayoffMatch[]{
 return joiner.playoffs.filter(m=>{const p=playoffPhase(m,now);return p==='walkout'||p==='live';}).sort((a,b)=>Date.parse(a.live_from)-Date.parse(b.live_from));
}
/** The won play-off match a takeover came from. */
export const playoffOf=(joiner:JoinerState,t:Pick<Takeover,'match'>)=>joiner.playoffs.find(m=>m.id===t.match)??null;

// ------------------------------------------------------------------ the edition's lines (CONTRACT §5)
/** A takeover's lines, in the order they were said. */
export function linesOf(joiner:JoinerState,takeoverId:string):TakeoverLine[]{
 return joiner.lines.filter(l=>l.takeover===takeoverId).sort((a,b)=>Date.parse(a.said_at)-Date.parse(b.said_at));
}
/** One club's line for a takeover, or null. */
export const lineOf=(joiner:JoinerState,takeoverId:string,clubId:string|null|undefined)=>clubId?joiner.lines.find(l=>l.takeover===takeoverId&&l.club===clubId)??null:null;
/** The reporter asks for lines from the takeover's `shown_from` for JOINER_CONFIG.lineDays days, never for an undone one.
 * (Who may answer, a member club in the league, is the page's and the door's.) */
export function lineOpen(t:Pick<Takeover,'shown_from'|'undone_at'>,now:number):boolean{
 if(t.undone_at!==null||t.shown_from===null)return false;
 const from=Date.parse(t.shown_from);
 return now>=from&&now<from+JOINER_CONFIG.lineDays*DAY_MS;
}
/** A line said may be edited for JOINER_CONFIG.lineEditHours hours after it is first said (never withdrawn). */
export const lineEditable=(l:Pick<TakeoverLine,'said_at'>,now:number)=>now<Date.parse(l.said_at)+JOINER_CONFIG.lineEditHours*HOUR_MS;
