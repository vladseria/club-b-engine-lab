// Game plan WP5: what Home asks of you right now (DESIGN-SPEC-2 §2 Home,
// "The amber action follows state"). Pure, so the one-amber rule is tested.
import {clock,type MatchState} from './league';

const DAY_MS=24*3600*1000;
const weekdayFmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',weekday:'long'});
/** "Friday" when the moment is within the coming (or past) six days, so a
 * weekday can't be mistaken for next week's; null further out (say the round). */
export function dayWord(t:number,now=Date.now()):string|null{
 return Math.abs(t-now)<6*DAY_MS?weekdayFmt.format(new Date(t)):null;
}

export type HomeActionKind='watch_live'|'walkout'|'watch_tonight'|'prepare'|'view_lineup'|'practice'|'see_round';
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
}
/** The hero's one big action, amber whenever it is something to do (Vlad's
 * playtest, 2 Oct: the stadium hero's button is the screen's one action).
 * When it isn't amber (View lineup, See round N), your result's Watch below
 * the hero takes the amber instead (`resultAmber`). */
export function homeAction(x:HomeInput):{action:HomeAction|null;resultAmber:boolean}{
 const match=(id:string)=>`/jocuri/ballers/match/${id}`;
 const pick=(a:HomeAction|null)=>({action:a,resultAmber:!!x.latest&&!a?.amber});
 if(x.myLive)return pick({kind:'watch_live',label:'Watch live',href:match(x.myLive),amber:true,icon:'play'});
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
