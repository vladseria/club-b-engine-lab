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

/** Whether Bebe's showcase match leads Home's evening (the hero is his match, your league result follows it): from the
 * league's full time to his own (`phase` the gap, then on the air), once his match exists, and only while your own
 * league match is off the air. The gap opens at a fixed clock (kick-off minus 9 minutes), and a league match that
 * kicked off late or runs long is still on the air then: it keeps the hero, with Bebe's card under it, until its
 * own full time (review 30 Oct: the hero showed Bebe's plate while its one button opened your match). */
export function nightLeads(phase:string|null|undefined,hasMatch:boolean,myLive:boolean):boolean{
 return !myLive&&hasMatch&&(phase==='gap'||phase==='live');
}

export type HomeActionKind='watch_live'|'walkout'|'watch_tonight'|'watch_night'|'prepare'|'view_lineup'|'practice'|'see_round';
export interface HomeAction {kind:HomeActionKind;label:string;href:string;amber:boolean;icon:'play'|'eye'|'cone'}
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
 /** Bebe's showcase match leading the evening (from the league's full time to its own: the gap, then on air), with
  * its button. Null with the showcase off and on every other evening. */
 night?:{label:string;href:string}|null;
}
/** The hero's one big action, amber whenever it is something to do (Vlad's
 * playtest, 2 Oct: the stadium hero's button is the screen's one action).
 * When it isn't amber (View lineup, See round N), your result's Watch below
 * the hero takes the amber instead (`resultAmber`). */
export function homeAction(x:HomeInput):{action:HomeAction|null;resultAmber:boolean}{
 const match=(id:string)=>`/jocuri/ballers/match/${id}`;
 const pick=(a:HomeAction|null)=>({action:a,resultAmber:!!x.latest&&!a?.amber});
 if(x.myLive)return pick({kind:'watch_live',label:'Watch live',href:match(x.myLive),amber:true,icon:'play'});
 // the showcase after the league's full time: the match about to start (or on air) leads, your result follows it
 if(x.night)return pick({kind:'watch_night',label:x.night.label,href:x.night.href,amber:true,icon:'play'});
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
