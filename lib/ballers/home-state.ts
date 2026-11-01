// Game plan WP5: what Home asks of you right now (DESIGN-SPEC-2 §2 Home,
// "The amber action follows state"). Pure, so the one-amber rule is tested.
import {clock,type MatchState} from './league';
import {clubDay,clubWallTime,shiftClubDay} from '../club-time';

const DAY_MS=24*3600*1000;
const weekdayFmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',weekday:'long'});
/** "Friday" when the moment is within the coming (or past) six days, so a
 * weekday can't be mistaken for next week's; null further out (say the round). */
export function dayWord(t:number,now=Date.now()):string|null{
 return Math.abs(t-now)<6*DAY_MS?weekdayFmt.format(new Date(t)):null;
}

/** How long Home's hero holds your latest result: until noon (Bucharest) the day after the evening it was played, so
 * the morning-after visit still opens on last night's match (owner's polish pass, 30 Oct; it used to flip 12 hours
 * after kickoff, at 08:00, to a three-day countdown). Never past the next round's lock (`nextLock`), so a round
 * that locks sooner always gets its clock back. */
export function holdUntil(liveFrom:number,nextLock:number|null=null):number{
 const noon=clubWallTime(`${shiftClubDay(clubDay(new Date(liveFrom)),1)}T12:00`).getTime();
 return nextLock!==null&&nextLock>liveFrom?Math.min(noon,nextLock):noon;
}

export type HomeActionKind='watch_live'|'walkout'|'watch_tonight'|'watch_night'|'prepare'|'view_lineup'|'practice'|'see_round';
export interface HomeAction {kind:HomeActionKind;label:string;href:string;amber:boolean;icon:'play'|'eye'|'cone'}
/** Bebe's showcase match on a league night (the slim strip under the board), as the grass's button needs it. Null with
 * the showcase off and on every evening that isn't his. */
export interface HomeNight {
 /** His match is on the air. */ live:boolean;
 /** His match is the next one of your evening: tonight, before his kick-off, with your own league match of the night
  * at its full time or none for you that night (you rest). */ next:boolean;
 /** It is his night (from the lock until his result is held no longer). */ tonight:boolean;
 /** His match may take the amber: your club rests that night and some of your men play for him (owner, 1 Nov: his
  * match is never the centre of attention over a player's own). */ ours:boolean;
 /** The amber's words when it is his ("Walk-out · 20:30", "Watch live"), and his watch page. */ label:string;href:string;
}
/** Bebe's match for the grass, from where his night stands (components/ballers/showcase/state.ts phaseOf, delayOf):
 * `today` = his night is today, `yoursDone` = your own league match of that night is at full time, or you have none
 * that night (you rest), `rest` = you have none that night, `going` = some of your men play for him. */
export function homeNight(x:{phase:string;delay:'postponed'|'late'|null;today:boolean;yoursDone:boolean;rest:boolean;going:boolean;kickoff:number;href:string}):HomeNight{
 const on=['locked','gap','live','done'].includes(x.phase),postponed=x.delay==='postponed';
 return {live:x.phase==='live',next:(x.phase==='locked'||x.phase==='gap')&&x.today&&!postponed&&x.yoursDone,
  tonight:on&&!(x.phase==='locked'&&postponed),ours:x.rest&&x.going,label:x.delay==='late'?'Watch':`Walk-out · ${clock(x.kickoff)}`,href:x.href};
}
export interface HomeInput {
 paused:boolean;
 /** Your fixture of the round ahead (null: you rest, or joined after the draw). */
 myMatch:{id:string;kickoff_at:string;state:MatchState}|null;
 /** Your match on the air right now. */ myLive:string|null;
 /** Some other match is on the air. */ othersLive:string|null;
 /** The round's lock has passed. */ locked:boolean;
 roundNumber:number|null;
 /** Your latest result (after full time); `tonight` = from the evening just played. */
 latest:{match_id:string;tonight:boolean}|null;
 night?:HomeNight|null;
}
/** The hero's one big action, amber whenever it is something to do (Vlad's
 * playtest, 2 Oct: the stadium hero's button is the screen's one action).
 * When it isn't amber (View lineup, See round N), your result's Watch below
 * the hero takes the amber instead (`resultAmber`).
 * On Bebe's night the amber stays your own match's (owner, 1 Nov: "not the same center of attention as a player's
 * game"); his match is the slim strip under the board, one tap away. Only on a night your club rests and some of
 * your men play for him does his walk-out and his match on the air take it. */
export function homeAction(x:HomeInput):{action:HomeAction|null;resultAmber:boolean}{
 const match=(id:string)=>`/jocuri/ballers/match/${id}`,n=x.night??null;
 const pick=(a:HomeAction|null)=>({action:a,resultAmber:!!x.latest&&!a?.amber});
 if(x.myLive)return pick({kind:'watch_live',label:'Watch live',href:match(x.myLive),amber:true,icon:'play'});
 // resting tonight with your men playing for him: his match is your evening's, so its walk-out and its broadcast
 if(n&&n.ours&&(n.live||n.next))return pick({kind:'watch_night',label:n.live?'Watch live':n.label,href:n.href,amber:true,icon:'play'});
 if(x.latest?.tonight)return pick({kind:'watch_tonight',label:'Watch it',href:match(x.latest.match_id),amber:true,icon:'play'});
 if(x.paused)return pick({kind:'practice',label:'Practice match',href:'/jocuri/ballers/practice',amber:true,icon:'cone'});
 if(x.myMatch&&x.myMatch.state==='locked')return pick({kind:'walkout',label:`Walk-out · ${clock(x.myMatch.kickoff_at)}`,href:match(x.myMatch.id),amber:true,icon:'play'});
 if(!x.myMatch||x.locked){
  if(x.othersLive)return pick({kind:'watch_live',label:'Watch live',href:match(x.othersLive),amber:true,icon:'play'});
  if(x.myMatch)return pick({kind:'view_lineup',label:'View lineup',href:'/jocuri/ballers/prep',amber:false,icon:'eye'});
  return pick(x.roundNumber?{kind:'see_round',label:`See round ${x.roundNumber}`,href:`/jocuri/ballers/matches?round=${x.roundNumber}`,amber:false,icon:'eye'}:null);
 }
 return pick({kind:'prepare',label:'Prepare match',href:'/jocuri/ballers/prep',amber:true,icon:'play'});
}
