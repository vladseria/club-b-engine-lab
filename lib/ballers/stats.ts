// Ballers per-player records: what each player did in one official match
// (derived once, when the match is submitted), and their season totals.
//
// Only engine facts: appearances from the lineup and the substitution events,
// goals / assists / own goals from the same incident layer the broadcast uses
// (lib/ballers/incidents.ts: creditGoal + assistFor), shots and saves from the
// engine's own shot/save events (the ones its team stats count). Nothing is
// estimated or invented.
//
// The detail (2026-09-29; a line carries it when `m` is present) is read from
// the same events after the match, with no engine change: time on the pitch,
// passes and how many found a team-mate, chances created, shots on target
// (by what happened to the ball: in the net or saved, never by where it was
// aimed), tackles won, interceptions (a ball nicked off a receiver at his
// touch included), men beaten, fouls, clearances, and for
// whoever stood in goal the time there, goals conceded, shots on target
// faced, shots saved and a clean sheet. Every per-player sum the engine also
// counts per team (passes, completed, tackles won, fouls, men beaten,
// clearances) is held equal to its team stats by verificare/ballers-stats.test.ts,
// on real stored replays as well as a fresh one.
//
// Where it lives: ballers_results.player_stats (one small array per match),
// so it shares the result row's security: readable only from full time
// (visible_from <= now()). A null means the result predates this record.
import {buildIncidents,creditGoal} from './incidents';
import type {ReplayEvent, ReplayFrame, ReplayHeader} from './replay';
import type {RatingRole} from './ratings';
import {matchClock,shownTime} from './match-clock';

/** The match detail (short keys). Keeper keys only for a player who stood in goal. */
export interface LineDetail {
 /** Seconds on the pitch. */ m:number;
 /** Passes tried / passes that found a team-mate. */ ps:number;pc:number;
 /** Chances created: the last pass before a team-mate's shot or goal (assists included). */ kp:number;
 /** Shots on target: scored, or saved by the other side. */ so:number;
 /** Tackles won, interceptions, men beaten, fouls committed, clearances. */ tk:number;it:number;dr:number;fc:number;cl:number;
 /** In goal: seconds, goals conceded, shots on target faced, shots saved, clean sheet (1/0). */ gt?:number;ca?:number;sf?:number;ss?:number;cs?:number;
}
/** One player's line in one match (stored shape, short keys: it ships with every result). */
export interface PlayerLine extends Partial<LineDetail> {
 /** ballers_players.id */ id:string;
 /** 0 = home, 1 = away (at the time of the match). */ side:0|1;
 /** Started (1) or came on (0). */ st:0|1;
 g:number;a:number;sh:number;sv:number;og:number;
 /** His match mark (lib/ballers/ratings.ts matchRatings, one decimal, 3–10), stored at submission from version 3;
  * absent on older lines and when he had no mark (under a ninth of the match). Growth reads it at the round close. */ mk?:number;
 /** The role his mark was read in (the formation slot he played), stored with it. */ rl?:RatingRole;
}
/** 3 (21 Oct 2026): lines stored at submission carry `mk` and `rl` (match-lines.ts markedLines). */
export const PLAYER_STATS_VERSION=3;
const ROLES:readonly RatingRole[]=['GK','CB','W','ST'];
/** The detail keys, in stored order. */
export const DETAIL_KEYS=['m','ps','pc','kp','so','tk','it','dr','fc','cl','gt','ca','sf','ss','cs'] as const;
const KEEPER_KEYS=['gt','ca','sf','ss','cs'] as const;
/** A clean sheet: in goal for at least this share of the match, nothing conceded while there. */
export const CLEAN_SHEET_SHARE=2/3;

/** The match's player lines, from the replay (header + every event and frame).
 * Every player who stood on the pitch gets a line; nobody else does. */
export function matchPlayerStats(header:Pick<ReplayHeader,'players'|'duration'|'fullTime'|'length'>,events:ReplayEvent[],frames:ReplayFrame[]):PlayerLine[]{
 const lines=new Map<number,PlayerLine>();
 const line=(i:number|undefined)=>{
  if(i===undefined)return undefined;const p=header.players[i];if(!p)return undefined;
  let l=lines.get(i);
  if(!l){l={id:p.id,side:p.side,st:p.slot>=0&&!p.bench?1:0,g:0,a:0,sh:0,sv:0,og:0};lines.set(i,l);}
  return l;
 };
 for(const p of header.players)if(p.slot>=0&&!p.bench)line(p.i);
 for(const e of events){
  if(e.k==='substitution')line(e.a);
  else if(e.k==='shot'){const l=line(e.a);if(l)l.sh++;}
  else if(e.k==='save'){const l=line(e.a);if(l)l.sv++;}
 }
 for(const x of buildIncidents({header,events,frames})){
  if(x.kind==='goal'){const l=line(x.actors[0]);if(l)l.g++;const a=line(x.facts.assist);if(a)a.a++;}
  else if(x.kind==='own_goal'){const l=line(x.actors[0]);if(l)l.og++;}
 }
 const detail=matchDetail(header,events,frames);
 for(const [i,l] of lines)Object.assign(l,detail.get(i)??emptyDetail());
 return [...lines.entries()].sort((a,b)=>a[0]-b[0]).map(([,l])=>l);
}

const emptyDetail=():LineDetail=>({m:0,ps:0,pc:0,kp:0,so:0,tk:0,it:0,dr:0,fc:0,cl:0});
/** Events that are not a touch of the ball (skipped when asking what a pass or a turnover led to or came from). */
// 'injury' (Bebe's showcase): the engine's injury event touches nobody's ball, like a substitution; nor do the injury
// stoppage's 'stoppage' (the referee stops play for him) and 'treatment' (the medics come on), whose actor is the hurt man
const OFF_BALL=new Set(['substitution','half','start','injury','stoppage','treatment']);
/** After one of these a shot's flight is over (a save or a block is not: a parry may still go in). */
const SHOT_OVER=new Set(['pass','receive','clearance','turnover','tackle','restart','out','shot','foul','offside','feint','beat','end']);
/** How long a shot owns what happens to the ball (creditGoal's window). */
const SHOT_MS=5000;

/** The detail per replay player index, for every player who stood on the pitch. */
export function matchDetail(header:Pick<ReplayHeader,'players'|'duration'|'fullTime'|'length'>,events:ReplayEvent[],frames:ReplayFrame[]):Map<number,LineDetail>{
 const out=new Map<number,LineDetail>(),end=header.duration*1000;
 // Time on the pitch counts up to the match length: a last attack played out past 15:00 (header.fullTime) is
 // still one full match, which is what growth reads (ballers_growth_config fullMatch: 900, per second of `m`/`gt`).
 // (half-time) on the clock the match shows: the first half's overrun and the second kickoff's set-up are not match minutes
 const clk=matchClock(header,events),full=(header.fullTime??header.duration)*1000;
 const side=(i:number|undefined)=>i===undefined?undefined:header.players[i]?.side;
 const d=(i:number|undefined)=>{if(i===undefined||!header.players[i])return undefined;let x=out.get(i);if(!x){x=emptyDetail();out.set(i,x);}return x;};
 const inGoal=(i:number)=>{const x=d(i)!;x.gt??=0;x.ca??=0;x.sf??=0;x.ss??=0;return x;};

 // Who stands at each of the ten positions (0-4 home, 5-9 away; 0 and 5 in
 // goal); a substitute takes the place of the man he replaces.
 const pos=[0,1,2,3,4,5,6,7,8,9],since=new Map<number,number>(),goalFrom=[0,0];
 for(const i of pos){d(i);since.set(i,0);}
 // (contest combine, 2026-10-15) each spell is clipped at full time too, not only the total: a substitute on the pitch
 // during a last attack was credited its seconds past full time while the men who played the whole match were not
 const clip=(t:number)=>clk.half===null?Math.min(t,full):Math.round(shownTime(t/1000,clk).main*1000);
 const leave=(i:number,t:number)=>{const x=d(i),from=since.get(i);if(x&&from!==undefined){x.m+=clip(t)-clip(from);since.delete(i);}};
 const leaveGoal=(s:0|1,t:number)=>{inGoal(pos[s*5]).gt!+=clip(t)-clip(goalFrom[s]);goalFrom[s]=t;};
 /** Who was in goal for side s at each substitution time (for goals conceded). */
 const keepers:[number,number,number][]=[[0,0,0],[1,0,5]]; // [side, from ms, player]
 for(const e of events){
  if(e.k!=='substitution'||e.a===undefined||e.g===undefined||!header.players[e.a])continue;
  const at=pos.indexOf(e.g);if(at<0)continue;
  const t=Math.min(e.t,end);
  if(at%5===0){const s=(at<5?0:1) as 0|1;leaveGoal(s,t);keepers.push([s,e.t,e.a]);}
  leave(e.g,t);pos[at]=e.a;d(e.a);since.set(e.a,t);
 }
 for(const i of pos)leave(i,end);
 leaveGoal(0,end);leaveGoal(1,end);
 const keeperAt=(s:0|1,t:number)=>{let k=s*5;for(const [ks,from,p] of keepers)if(ks===s&&from<=t)k=p;return k;};

 const possessionBefore=(t:number)=>{let lo=0,hi=frames.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(frames[m].t<=t-1){best=m;lo=m+1;}else hi=m-1;}return frames[Math.max(0,best)]?.ps;};
 const touchAfter=(i:number)=>{for(let j=i+1;j<events.length;j++)if(!OFF_BALL.has(events[j].k))return events[j];return undefined;};
 const touchBefore=(i:number)=>{for(let j=i-1;j>=0;j--)if(!OFF_BALL.has(events[j].k))return events[j];return undefined;};
 /** The pass that fed `receiver` before the event at i: the assist rule of
  * incidents.ts (the side's last pass in the same move, within 10 s). */
 const feeder=(i:number,receiver:number,s:0|1)=>{
  for(let j=i-1;j>=0;j--){const e=events[j];
   if(events[i].t-e.t>10000)return -1;
   if(e.k==='restart'||e.k==='save'||e.k==='out'||e.k==='goal')return -1;
   if((e.k==='turnover'||e.k==='tackle')&&e.s!==s)return -1;
   if(e.k==='pass'&&e.s===s)return e.g===receiver&&e.a!==undefined&&e.a!==receiver?j:-1;
  }
  return -1;
 };
 const chances=new Set<number>();

 for(let i=0;i<events.length;i++){
  const e=events[i],me=d(e.a);
  switch(e.k){
   case 'pass':{if(!me)break;me.ps++;
    // Found a team-mate: the next touch is his reception (the engine's `completed`).
    const next=touchAfter(i);if(next?.k==='receive'&&next.a!==undefined&&next.a!==e.a&&side(next.a)===side(e.a))me.pc++;break;}
   case 'clearance':if(me)me.cl++;break;
   case 'beat':if(me)me.dr++;break;
   // A challenge's foul names who was fouled; a second touch at a restart is not a foul on anyone.
   case 'foul':if(me&&e.g!==undefined)me.fc++;break;
   // A tackle event names the man left with the ball: won when his side didn't have it.
   // (contest round) A ball nicked off a receiver as he meets a team-mate's pass (the reception duel; the last
   // touch before it is that pass) is won before he ever has it: the engine's team stats do not count it as a
   // tackle (tackles/tacklesWon count challenges on the man in possession), so it is his interception instead.
   case 'tackle':{if(!me||e.s===undefined||possessionBefore(e.t)===e.s)break;
    const prev=touchBefore(i);if(prev?.k==='pass'&&prev.a!==undefined&&side(prev.a)!==e.s)me.it++;else me.tk++;break;}
   case 'turnover':{if(!me)break;const prev=touchBefore(i);if(prev?.k==='pass'&&prev.a!==undefined&&side(prev.a)!==side(e.a))me.it++;break;}
   case 'shot':{
    if(e.a===undefined||e.s===undefined)break;
    const s=e.s,f=feeder(i,e.a,s);if(f>=0)chances.add(f);
    // What happened to the ball: in the net, or stopped by the other side's
    // hands (a shot blocked by a body first is not on target unless it still goes in).
    let blocked=false,saver:number|undefined,scored=false;
    for(let j=i+1;j<events.length&&events[j].t-e.t<=SHOT_MS;j++){const x=events[j];
     if(x.k==='goal'){scored=x.s===s;break;}
     if(x.k==='block'){if(saver===undefined)blocked=true;continue;}
     if(x.k==='save'){if(!blocked&&saver===undefined&&x.a!==undefined&&side(x.a)!==s)saver=x.a;continue;}
     if(SHOT_OVER.has(x.k))break;
    }
    if(me&&(scored||saver!==undefined))me.so++;
    if(!scored&&saver!==undefined){const k=inGoal(saver);k.ss!++;k.sf!++;}
    break;
   }
   case 'goal':{
    const s=(e.s??0) as 0|1,credit=creditGoal(e,events.slice(0,i),header);
    const k=inGoal(keeperAt((1-s) as 0|1,e.t));k.ca!++;
    if(credit&&!credit.own){k.sf!++;const f=feeder(i,credit.player,s);if(f>=0)chances.add(f);}
    break;
   }
  }
 }
 for(const j of chances){const x=d(events[j].a);if(x)x.kp++;}
 for(const x of out.values()){
  x.m=Math.round(Math.min(x.m,full)/1000);
  if(x.gt===undefined)continue;
  const ms=x.gt;x.gt=Math.round(Math.min(ms,full)/1000);x.cs=ms>=end*CLEAN_SHEET_SHARE&&x.ca===0?1:0;
  // Only a save from outside goal and never in it: no keeper line.
  if(!ms)for(const k of KEEPER_KEYS)delete x[k];
 }
 return out;
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const count=(v:unknown,max=1000)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<max?v:0;
/** A stored player_stats value, read defensively (null = not recorded). The
 * detail is read only when the line carries it (`m`). */
export function readPlayerStats(v:unknown):PlayerLine[]|null{
 if(!Array.isArray(v))return null;
 const out:PlayerLine[]=[];
 for(const x of v){
  if(!x||typeof x!=='object')continue;const o=x as Record<string,unknown>;
  if(typeof o.id!=='string'||!UUID.test(o.id)||(o.side!==0&&o.side!==1))continue;
  const l:PlayerLine={id:o.id,side:o.side,st:o.st===1?1:0,g:count(o.g),a:count(o.a),sh:count(o.sh),sv:count(o.sv),og:count(o.og)};
  if(typeof o.m==='number'){
   for(const k of DETAIL_KEYS){if(KEEPER_KEYS.includes(k as never)&&o.gt===undefined)continue;l[k]=count(o[k],k==='m'||k==='gt'?100000:1000);}
   if(l.cs!==undefined)l.cs=l.cs?1:0;
  }
  // the stored mark (version 3): a number on the mark's scale, kept to one decimal; anything else is no mark
  if(typeof o.mk==='number'&&Number.isFinite(o.mk)&&o.mk>=3&&o.mk<=10)l.mk=Math.round(o.mk*10)/10;
  if(ROLES.includes(o.rl as RatingRole))l.rl=o.rl as RatingRole;
  out.push(l);
 }
 return out;
}

/** Adds the detail a stored line lacks, from a fresh derivation of the same
 * match; never changes a value already stored (goals and assists included).
 * Lines are matched by id and side; a derived player the stored array doesn't
 * have is not added. Returns null when nothing would change. */
export function withDetail(stored:unknown,derived:PlayerLine[]):unknown[]|null{
 if(!Array.isArray(stored))return null;
 let changed=false;
 const next=stored.map(x=>{
  if(!x||typeof x!=='object')return x;const o=x as Record<string,unknown>;
  const d=derived.find(l=>l.id===o.id&&l.side===o.side);if(!d)return x;
  const add:Record<string,unknown>={};
  for(const k of DETAIL_KEYS)if(!(k in o)&&d[k]!==undefined)add[k]=d[k];
  if(!Object.keys(add).length)return x;
  changed=true;return {...o,...add};
 });
 return changed?next:null;
}

// ---------- season totals ----------
/** A player's record over a set of matches. The detail totals cover only the
 * `detailApps` matches that carry it. */
export interface SeasonLine {id:string;
 /** The club he played for (the result's home/away club by side). */ club:string;
 apps:number;starts:number;subs:number;goals:number;assists:number;shots:number;saves:number;ownGoals:number;
 detailApps:number;seconds:number;passes:number;passesCompleted:number;chances:number;shotsOnTarget:number;
 tackles:number;interceptions:number;dribbles:number;fouls:number;clearances:number;
 /** Matches he stood in goal, and there: seconds, conceded, shots on target faced, shots saved, clean sheets. */
 keeperApps:number;keeperSeconds:number;conceded:number;shotsFaced:number;shotSaves:number;cleanSheets:number}
/** What aggregation needs from a result row. */
export interface StatsResult {match_id:string;competition_id:string|null;home_club:string;away_club:string;player_stats?:unknown;live_from?:string}

export const emptySeason=(id:string,club:string):SeasonLine=>({id,club,apps:0,starts:0,subs:0,goals:0,assists:0,shots:0,saves:0,ownGoals:0,
 detailApps:0,seconds:0,passes:0,passesCompleted:0,chances:0,shotsOnTarget:0,tackles:0,interceptions:0,dribbles:0,fouls:0,clearances:0,
 keeperApps:0,keeperSeconds:0,conceded:0,shotsFaced:0,shotSaves:0,cleanSheets:0});
function addLine(s:SeasonLine,l:PlayerLine){
 s.apps++;if(l.st)s.starts++;else s.subs++;
 s.goals+=l.g;s.assists+=l.a;s.shots+=l.sh;s.saves+=l.sv;s.ownGoals+=l.og;
 if(l.m===undefined)return;
 s.detailApps++;s.seconds+=l.m;s.passes+=l.ps??0;s.passesCompleted+=l.pc??0;s.chances+=l.kp??0;s.shotsOnTarget+=l.so??0;
 s.tackles+=l.tk??0;s.interceptions+=l.it??0;s.dribbles+=l.dr??0;s.fouls+=l.fc??0;s.clearances+=l.cl??0;
 if(l.gt){s.keeperApps++;s.keeperSeconds+=l.gt;s.conceded+=l.ca??0;s.shotsFaced+=l.sf??0;s.shotSaves+=l.ss??0;s.cleanSheets+=l.cs??0;}
}

/** Per-player totals over `results`. `competition` narrows to one season.
 * Every result past full time counts (the only spoiler rule); results with
 * no recorded lines add nothing. Keyed by player id. */
export function seasonStats(results:StatsResult[],o:{competition?:string|null}={}):Map<string,SeasonLine>{
 const out=new Map<string,SeasonLine>();
 for(const r of results){
  if(o.competition!==undefined&&r.competition_id!==o.competition)continue;
  for(const l of readPlayerStats(r.player_stats)??[]){
   const club=l.side===0?r.home_club:r.away_club;
   let s=out.get(l.id);
   if(!s){s=emptySeason(l.id,club);out.set(l.id,s);}
   s.club=club;addLine(s,l);
  }
 }
 return out;
}
/** One club's players' totals (for scouting a club: pass its results only or all). */
export function clubSeasonStats(results:StatsResult[],club:string,o:{competition?:string|null}={}):SeasonLine[]{
 return [...seasonStats(results.filter(r=>r.home_club===club||r.away_club===club),o).values()].filter(s=>s.club===club);
}

// ---------- rates ----------
const pct=(n:number,of:number)=>of>0?Math.round(n*100/of):null;
/** Passes that found a team-mate, in % (null: no pass recorded). */
export const passPct=(s:Pick<SeasonLine,'passes'|'passesCompleted'>)=>pct(s.passesCompleted,s.passes);
/** Shots on target faced that he stopped, in % (null: none faced). */
export const savePct=(s:Pick<SeasonLine,'shotsFaced'|'shotSaves'>)=>pct(s.shotSaves,s.shotsFaced);
export const minutes=(s:Pick<SeasonLine,'seconds'>)=>Math.round(s.seconds/60);
/** Whether he's a keeper by what he did: more than half his recorded time in goal. */
export const keptGoal=(s:Pick<SeasonLine,'keeperSeconds'|'seconds'>)=>s.keeperSeconds>0&&s.keeperSeconds*2>=s.seconds;

/** A club's season: the score and the engine's own team stats of every
 * result (as the match stats panel shows them), plus what only the player
 * lines know (shots on target, chances, interceptions, shots saved) over the
 * `detailMatches` that carry them. */
export interface TeamSeason {matches:number;goalsFor:number;goalsAgainst:number;cleanSheets:number;
 /** Share of the ball over the season, % (null: none recorded). */ possession:number|null;
 shots:number;passes:number;completed:number;tacklesWon:number;beaten:number;fouls:number;
 detailMatches:number;shotsOnTarget:number;chances:number;interceptions:number;shotSaves:number;
 /** Passes that found a team-mate (the player lines' count, as a player's pass % reads it). */ foundMate:number}
export interface TeamResult extends StatsResult {home_goals:number;away_goals:number;stats?:[Record<string,number>,Record<string,number>]|null}
export function teamSeason(results:TeamResult[],club:string,o:{competition?:string|null}={}):TeamSeason{
 const t:TeamSeason={matches:0,goalsFor:0,goalsAgainst:0,cleanSheets:0,possession:null,shots:0,passes:0,completed:0,tacklesWon:0,beaten:0,fouls:0,detailMatches:0,shotsOnTarget:0,chances:0,interceptions:0,shotSaves:0,foundMate:0};
 let had=0,all=0;
 const n=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:0;
 for(const r of results){
  if(o.competition!==undefined&&r.competition_id!==o.competition)continue;
  if(r.home_club!==club&&r.away_club!==club)continue;
  const side=r.home_club===club?0:1,gf=side?r.away_goals:r.home_goals,ga=side?r.home_goals:r.away_goals;
  t.matches++;t.goalsFor+=gf;t.goalsAgainst+=ga;if(ga===0)t.cleanSheets++;
  const mine=r.stats?.[side],theirs=r.stats?.[1-side];
  if(mine){t.shots+=n(mine.shots);t.passes+=n(mine.passes);t.completed+=n(mine.completed);t.tacklesWon+=n(mine.tacklesWon);t.beaten+=n(mine.beaten);t.fouls+=n(mine.fouls);
   had+=n(mine.possession);all+=n(mine.possession)+n(theirs?.possession);}
  const lines=readPlayerStats(r.player_stats)?.filter(l=>l.side===side);
  if(!lines?.length||!lines.every(l=>l.m!==undefined))continue;
  t.detailMatches++;
  for(const l of lines){t.shotsOnTarget+=l.so??0;t.chances+=l.kp??0;t.interceptions+=l.it??0;t.shotSaves+=l.ss??0;t.foundMate+=l.pc??0;}
 }
 t.possession=all>0?Math.round(had*100/all):null;
 return t;
}

// ---------- form ----------
/** One of his club's latest matches: what he did, or null when he didn't play. */
export interface FormMatch {match_id:string;line:PlayerLine|null}
/** His club's last `n` matches with a record, newest first. */
export function playerForm(results:StatsResult[],id:string,club:string,n=3):FormMatch[]{
 return results.filter(r=>(r.home_club===club||r.away_club===club)&&readPlayerStats(r.player_stats)!==null)
  .sort((a,b)=>Date.parse(b.live_from??'')-Date.parse(a.live_from??''))
  .slice(0,n).map(r=>({match_id:r.match_id,line:readPlayerStats(r.player_stats)!.find(l=>l.id===id)??null}));
}

// ---------- leaderboards ----------
/** Top scorers: goals, then assists, then fewer appearances; ties share a rank. */
export function topScorers(lines:Iterable<SeasonLine>,limit=10):(SeasonLine&{rank:number})[]{
 const sorted=[...lines].filter(l=>l.goals>0).sort((a,b)=>b.goals-a.goals||b.assists-a.assists||a.apps-b.apps||a.id.localeCompare(b.id));
 const out:(SeasonLine&{rank:number})[]=[];
 for(let i=0;i<sorted.length;i++){const l=sorted[i],p=sorted[i-1];
  const rank=p&&p.goals===l.goals&&p.assists===l.assists&&p.apps===l.apps?out[i-1].rank:i+1;
  if(rank>limit)break;
  out.push({...l,rank});}
 return out;
}
export type Board='assists'|'chances'|'tackles'|'saves'|'cleanSheets'|'passing';
/** Pass % counts from this many minutes, and at least half the minutes of the season's busiest player. */
export const PASSING_MIN_MINUTES=30;
/** A leaderboard: the value, then fewer appearances; ties (value and apps) share a rank. Nobody on nothing. */
export function leaders(lines:Iterable<SeasonLine>,board:Board,limit=5):(SeasonLine&{rank:number;value:number})[]{
 const all=[...lines];
 const most=Math.max(0,...all.map(l=>l.seconds));
 const value=(l:SeasonLine):number|null=>{
  switch(board){
   case 'assists':return l.assists||null;
   case 'chances':return l.chances||null;
   case 'tackles':return l.tackles+l.interceptions||null;
   case 'saves':return l.keeperApps?l.shotSaves||null:null;
   case 'cleanSheets':return l.cleanSheets||null;
   case 'passing':return l.seconds>=Math.max(PASSING_MIN_MINUTES*60,most/2)&&l.passes>=10?passPct(l):null;
  }
 };
 const sorted=all.map(l=>({...l,value:value(l)})).filter((l):l is SeasonLine&{value:number}=>l.value!==null&&l.value>0)
  .sort((a,b)=>b.value-a.value||a.apps-b.apps||a.id.localeCompare(b.id));
 const out:(SeasonLine&{rank:number;value:number})[]=[];
 for(let i=0;i<sorted.length;i++){const l=sorted[i],p=sorted[i-1];
  const rank=p&&p.value===l.value&&p.apps===l.apps?out[i-1].rank:i+1;
  if(rank>limit)break;
  out.push({...l,rank});}
 return out;
}
