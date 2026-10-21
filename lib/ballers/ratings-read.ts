// Ballers match ratings, read for the screens (lib/ballers/ratings.ts does the
// marking): the roles of one match without its whole replay, a club's season
// of marks for the player page and the squad, and the practice match's marks.
// Pure: no I/O, no React (the loading lives in lib/ballers/data.ts
// loadRatingHeaders and components/ballers/ratings/useRatings.ts).
//
// Why roles can come from the lines: the replay header (one small row, public
// from kickoff) names each starter's slot and each side's formation; only the
// substitutions sit in the replay's events. But every line carries his seconds
// on the pitch, and a substitute takes the place of the man he replaced at the
// moment he left (nobody comes back on), so along each position the seconds of
// everyone who stood there add up to the match. rolesFromLines finds every way
// the side's substitutes can be placed so that holds; when they all give each
// substitute the same role it is his role, otherwise it answers null and the
// caller reads the full replay (matchRoles), which is exact.
import {matchRatings,matchRoles,playerOfTheMatch,SLOT_ROLES,type PlayerRating,type RatingRole,type RolesEvent,type RolesHeader} from './ratings';
import {readPlayerStats,type PlayerLine} from './stats';

/** What rolesFromLines needs of a replay header. */
export interface RatingHeader extends RolesHeader {duration:number;fullTime?:number}
/** The match length the marks are read against: the clock's full time, never the last attack past it. */
export const matchSeconds=(h:Pick<RatingHeader,'duration'|'fullTime'>)=>h.fullTime??h.duration;

/** Every line carries the match detail (`m`): only then can the match be rated. */
export const ratable=(lines:readonly PlayerLine[]|null|undefined):lines is PlayerLine[]=>!!lines&&lines.length>0&&lines.every(l=>l.m!==undefined);

/** Each player's role (by id) from the header and the lines' seconds alone; null when the
 * seconds allow more than one answer that changes someone's role (then read the replay). */
export function rolesFromLines(header:RatingHeader,lines:readonly PlayerLine[]):Map<string,RatingRole>|null{
 const full=matchSeconds(header),out=new Map<string,RatingRole>();
 const byId=new Map(lines.map(l=>[l.id,l]));
 for(const side of [0,1] as const){
  const shape=SLOT_ROLES[header.teams[side]?.formation]??SLOT_ROLES['1-2-1'];
  const starters=header.players.filter(p=>p.side===side&&p.slot>=0&&!p.bench).sort((a,b)=>a.slot-b.slot);
  for(const p of starters)out.set(p.id,shape[p.slot]);
  const subs=lines.filter(l=>l.side===side&&l.st===0);
  if(!subs.length)continue;
  const base=starters.map(p=>byId.get(p.id)?.m??0);
  // Each position's seconds, everyone who stood there, must add up to the match (each line is
  // rounded to the second, so allow half a second per man, and a second for the whistle).
  const fits=(sum:number,men:number)=>Math.abs(sum-full)<=men*.5+1;
  const answers=new Set<string>();let found:number[]|null=null;
  const pick=new Array<number>(subs.length).fill(0);
  const walk=(i:number)=>{
   if(answers.size>1)return;
   if(i===subs.length){
    const sums=base.slice(),men=base.map(()=>1);
    pick.forEach((at,j)=>{sums[at]+=subs[j].m??0;men[at]++;});
    if(sums.every((s,at)=>fits(s,men[at]))){answers.add(pick.map(at=>shape[starters[at].slot]).join());found=pick.slice();}
    return;
   }
   for(let at=0;at<starters.length;at++){pick[i]=at;walk(i+1);}
  };
  walk(0);
  if(answers.size!==1||!found)return null;
  subs.forEach((l,j)=>out.set(l.id,shape[starters[found![j]].slot]));
 }
 return out;
}

/** When rolesFromLines can't tell: the replay chunks that hold the substitutions, around each starter's last
 * second on the pitch (the chunk length from the header). */
export function subChunks(h:Pick<RatingHeader,'duration'|'fullTime'>&{chunkSeconds?:number},lines:readonly Pick<PlayerLine,'st'|'m'>[]):number[]{
 const cs=h.chunkSeconds??60,full=matchSeconds(h),out=new Set<number>();
 for(const l of lines)if(l.st===1&&l.m!==undefined&&l.m<full-1)for(const t of [l.m-1,l.m,l.m+1])out.add(Math.max(0,Math.floor(t/cs)));
 return [...out].sort((a,b)=>a-b);
}

/** One match's marks: by player id, plus Player of the Match (null when nobody qualifies). */
export interface MatchMarks {ratings:Map<string,PlayerRating>;potm:string|null}
/** The marks of one match from its lines, score and roles (null when the lines can't be rated). */
export function marksOf(lines:readonly PlayerLine[]|null|undefined,score:readonly [number,number],seconds:number,roles:ReadonlyMap<string,RatingRole>):MatchMarks|null{
 if(!ratable(lines))return null;
 const facts={score,matchSeconds:seconds,roles};
 const rs=matchRatings(lines,facts);
 if(rs.every(r=>r.mark===null))return null;
 return {ratings:new Map(rs.map(r=>[r.id,r])),potm:playerOfTheMatch(rs,facts)?.id??null};
}
/** The marks of a match whose replay is in hand (the match page, a practice run): exact roles. */
export function replayMarks(header:RatingHeader,events:readonly RolesEvent[],lines:readonly PlayerLine[]|null|undefined,score:readonly [number,number]):MatchMarks|null{
 return marksOf(lines,score,matchSeconds(header),matchRoles(header,events));
}

/** The switch's gate for a finished match (Marks.tsx useReplayMarks): nothing at all with the ratings switch off
 * or without a readable result, else replayMarks. */
export function switchedMarks(on:boolean,header:RatingHeader,events:readonly RolesEvent[],result:{player_stats?:unknown;home_goals:number;away_goals:number}|undefined):MatchMarks|null{
 if(!on||!result)return null;
 return replayMarks(header,events,readPlayerStats(result.player_stats),[result.home_goals,result.away_goals]);
}

/** No season average before this many rated matches. */
export const AVERAGE_FROM=3;
/** A player's season of marks: his rated matches (newest last) and, from AVERAGE_FROM on, their average. */
export interface SeasonMarks {count:number;average:number|null;potm:number}
export function seasonMarks(marks:readonly (number|null|undefined)[],potm=0):SeasonMarks{
 const ms=marks.filter((m):m is number=>typeof m==='number');
 const average=ms.length>=AVERAGE_FROM?Math.round(ms.reduce((s,m)=>s+m,0)/ms.length*10)/10:null;
 return {count:ms.length,average,potm};
}

/** How a mark reads at a glance: the lamp it lights (7 and up good, under 6 poor). */
export type MarkBand='top'|'good'|'par'|'low';
export const markBand=(m:number):MarkBand=>m>=8?'top':m>=7?'good':m>=6?'par':'low';
/** A mark as shown: always one decimal ("7.0", never "7"). */
export const markText=(m:number)=>m.toFixed(1);
