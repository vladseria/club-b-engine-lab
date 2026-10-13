import {L,W,GH} from './pitch.js';
import {clamp} from './model.js';
import type {Side} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {arrivalTime} from './practice-defense.js';
import {groundPassRisk,passFlightTime} from './practice-passing.js';
import {kickHorizon} from './practice-possession.js';
import {PASS_DRAG} from './practice-flight.js';
import {perceive,acuity} from './practice-perception.js';

/** Threat round (2026-10-10, evidence/2026-10-10-threat-defending).
 *
 * A defender does not only ask "is he near our goal?" but "could the ball get
 * to him now, and would he score if it did?". The threat of an attacker, as a
 * defender reads it:
 *
 *  - can the ball reach him: from where the ball is (the carrier; the man a
 *    pass is going to, where he meets it; a loose ball), the lane a ground pass
 *    would take to where he will be when it arrives, read with the honest lane
 *    read the passer himself uses (groundPassRisk: the defenders who could get
 *    to it in its flight, his own man left out, since the question is whether he
 *    is a threat if nobody stands on him); the carrier's release (kickHorizon:
 *    preparing, or turning his body to that pass, and getting his foot to the
 *    ball); how soon it would arrive (a pass arriving in ARRIVE_SOON s counts in
 *    full, one arriving after ARRIVE_LATE s only ARRIVE_FLOOR of it); a ball over
 *    the top (LOFT_MIN..LOFT_MAX m) is an option worth LOFT_REACH for a carrier
 *    nobody is closing (none of us within PRESSED m); and a ball that first has
 *    to reach another man (a pass on its way to a team-mate of his, a loose ball)
 *    is one action further away (LATER).
 *  - how dangerous he is if it does: his shot from where he would receive it,
 *    the engine's own shot quality before pressure and keeper (goal angle and
 *    distance: assessShot), less up to CLOSE_CUT if one of us (his own man
 *    excepted) can be on him by the time he has it (within CLOSE_WINDOW s).
 *  - the value is the shot times how reachable he is, never less than
 *    THREAT_FLOOR of the shot: a man in front of our goal is a threat even with
 *    no lane this instant, because the lane can open in one touch.
 *
 * The carrier's own threat (carrierThreat): his shot from where he is,
 * through the defenders in his shooting line, or his drive at goal a few
 * metres on when nobody is goal-side in his path.
 *
 * Chains of play (the owner's addition): a man who is no danger himself can be the way to one. The second
 * step reads, from where he would take the ball, a first-time lay-off or wall pass (LAYOFF s to release) to the
 * SECOND_TOP most dangerous of his team-mates (by their shot from where they stand) who are more dangerous than he
 * is: that lane (the same lane read, their own markers left out), how soon it arrives, and their shot from where they
 * would take it. The two-pass threat is his reach x that lane x their shot, worth SECOND_STEP of a direct one, and
 * the man's threat is the larger of the two, so a defender may rightly mark the middle man when the goal comes
 * through him. How far ahead he sees is his reading: the second step counts for nothing below SECOND_READ[0] of
 * the 'threat' acuity (a poor reader sees only the first pass) and in full from SECOND_READ[1].
 *
 * It is a read like the others: each defender reads it from his own picture
 * (the positions he saw, a moment late) and misjudges it by up to THREAT_SPREAD
 * of its size for a player who cannot read the game (the 'threat' read:
 * reading and defending). It never touches the ball. */
export const THREAT_FLOOR=.3,LOFT_REACH=.5,LOFT_MIN=10,LOFT_MAX=40,PRESSED=3,LATER=.6;
export const ARRIVE_SOON=1,ARRIVE_LATE=2.5,ARRIVE_FLOOR=.35,LEAD_CAP=1.2;
export const CLOSE_WINDOW=.8,CLOSE_CUT=.25,THREAT_SPREAD=.3;
export const LAYOFF=.35,SECOND_TOP=2,SECOND_STEP=.8,SECOND_READ:readonly [number,number]=[.45,.85];
/** The lane is read up to RECEIVE_REACH m short of him (where he takes it). */
export const RECEIVE_REACH=1.2;
/** The carrier: a drive DRIVE m on towards goal counts when nobody of ours is within DRIVE_W m of his path; a shooting line is shut by a defender within SHOT_W m of it. */
export const DRIVE=3,DRIVE_W=1.5,SHOT_W=1;

const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const world=(side:Side,x:number)=>side===0?x:L-x;
const inside=(p:Vec):Vec=>({x:clamp(p.x,.5,L-.5),y:clamp(p.y,-(W/2-.5),W/2-.5)});
/** The shot from here at our goal (the side defending it): assessShot's quality before pressure and keeper. */
export function goalShot(at:Vec,defending:Side):number{
 const gx=world(defending,0),dx=Math.max(.01,Math.abs(at.x-gx));
 const angle=Math.abs(Math.atan2(GH-at.y,dx)-Math.atan2(-GH-at.y,dx));
 return clamp(angle/.6,0,1)*clamp(1-Math.hypot(at.x-gx,at.y)/45,.05,1);
}
/** A ground pass's launch speed for this length: arriving firmly (the passer's firm weight, practice-passing). */
const launch=(length:number)=>{const arrive=Math.min(19,clamp(5.5+length*.24,6,14)+3);return Math.sqrt(arrive*arrive+2*PASS_DRAG*length);};

export interface ThreatSource {
 /** Where the next ball would be played from. */
 at:Vec;
 /** The man on the ball. */
 carrier?:PracticePlayer;
 /** A pass on its way: to whom, and in how long he has it. */
 receiver?:string;meetIn?:number;
 /** How soon the next ball can be played from `at` (s), and how far away it is (1 = from the carrier now). */
 delay:number;scale:number;
}
export interface ThreatPicture {
 source:ThreatSource;defending:Side;time:number;
 /** Our players (the keeper included: he reads a through ball too). */
 defenders:readonly PracticePlayer[];
 /** Who has whom now (defender -> attacker), so a man's own marker is left out of his threat. */
 owner:(attacker:string)=>string|undefined;
 /** The attackers off the ball (keeper and carrier left out) as this defender sees them: the second step's candidates. */
 attackers:(reader:PracticePlayer)=>readonly PracticePlayer[];
 cache:Map<string,ThreatRead>;
}
export interface ThreatRead {reach:number;shot:number;value:number;arrive:number;at:Vec;
 /** The two-pass part (his reach x the lane to the man he finds x that man's shot, before the reader's weight). */
 two:number}

export function threatSource(input:{carrier?:PracticePlayer;receiver?:{id:string;meet:Vec};loose?:Vec;ball:Vec&{vx:number;vy:number};players:readonly PracticePlayer[];attacking:Side}):ThreatSource{
 if(input.carrier)return {at:{x:input.carrier.x,y:input.carrier.y},carrier:input.carrier,delay:0,scale:1};
 if(input.receiver){
  const m=input.receiver.meet,speed=Math.max(3,Math.hypot(input.ball.vx,input.ball.vy)),meetIn=dist(input.ball,m)/speed;
  return {at:m,receiver:input.receiver.id,meetIn,delay:meetIn+.35,scale:LATER};
 }
 const at=input.loose??{x:input.ball.x,y:input.ball.y};
 const theirs=Math.min(3,...input.players.filter(p=>p.side===input.attacking).map(p=>arrivalTime(p,at)));
 return {at,delay:theirs+.35,scale:LATER};
}

/** How this defender reads the threat of attacker `a` (`v`: where he sees him). */
export function readThreat(reader:PracticePlayer,a:PracticePlayer,v:PracticePlayer,pic:ThreatPicture):ThreatRead{
 const key=reader.id+'>'+a.id;const hit=pic.cache.get(key);if(hit)return hit;
 const {source,defending}=pic,own=pic.owner(a.id);
 const others=pic.defenders.filter(q=>q.id!==own);
 const near=(p:Vec,t:number)=>Math.min(...others.filter(q=>q.role!=='GK').map(q=>arrivalTime(q,p)-t),Infinity);
 let reach:number,arrive:number,at:Vec;
 if(source.receiver===a.id){reach=1;arrive=source.meetIn??0;at=source.at;}
 else{
  // where he will be when a ball played now (or as soon as it can be played) reaches him
  const lead0=source.carrier?kickHorizon(source.carrier,v,'pass'):source.delay;
  const ahead=(t:number)=>inside({x:v.x+v.vx*Math.min(LEAD_CAP,t),y:v.y+v.vy*Math.min(LEAD_CAP,t)});
  const from=source.carrier?{x:source.at.x+source.carrier.vx*Math.min(.5,lead0),y:source.at.y+source.carrier.vy*Math.min(.5,lead0)}:source.at;
  let target=ahead(lead0),length=dist(from,target),speed=launch(length),flight=passFlightTime(length,speed);
  if(!Number.isFinite(flight))flight=length/8;
  target=ahead(lead0+flight);length=dist(from,target);speed=launch(length);flight=passFlightTime(length,speed);if(!Number.isFinite(flight))flight=length/8;
  arrive=lead0+flight;at=target;
  // (the lane up to his reach of it: a defender who can only get to him as he takes it is his control's problem, the shot's closing below)
  const short=Math.max(0,length-RECEIVE_REACH),to={x:from.x+(target.x-from.x)*short/Math.max(.01,length),y:from.y+(target.y-from.y)*short/Math.max(.01,length)};
  const lane=short<1?1:1-groundPassRisk(from,to,others as PracticePlayer[],launch(short));
  const pressed=source.carrier?clamp((PRESSED-Math.min(...others.filter(q=>q.role!=='GK').map(q=>dist(q,source.carrier!)),Infinity))/PRESSED,0,1):0;
  const loft=length>=LOFT_MIN&&length<=LOFT_MAX?LOFT_REACH*(1-pressed):0;
  const soon=ARRIVE_FLOOR+(1-ARRIVE_FLOOR)*clamp((ARRIVE_LATE-arrive)/(ARRIVE_LATE-ARRIVE_SOON),0,1);
  reach=Math.max(lane,loft)*soon*source.scale;
 }
 const closable=clamp(1-near(at,arrive)/CLOSE_WINDOW,0,1);
 const shot=goalShot(at,defending)*(1-CLOSE_CUT*closable);
 // the second step: the man he finds from there (a sharp reader sees it, a poor one does not)
 const w2=clamp((acuity(reader,'threat')-SECOND_READ[0])/(SECOND_READ[1]-SECOND_READ[0]),0,1);
 let two=0;
 if(w2>0&&reach>.05){
  const cands=pic.attackers(reader).filter(b=>b.id!==a.id).map(b=>({b,g:goalShot(b,defending)})).filter(c=>c.g>shot).sort((x,y)=>y.g-x.g).slice(0,SECOND_TOP);
  for(const {b} of cands){
   const ownB=pic.owner(b.id),othersB=pic.defenders.filter(q=>q.id!==ownB);
   let tb=inside({x:b.x+b.vx*Math.min(LEAD_CAP,arrive+LAYOFF),y:b.y+b.vy*Math.min(LEAD_CAP,arrive+LAYOFF)});
   let length=dist(at,tb),flight=passFlightTime(length,launch(length));if(!Number.isFinite(flight))flight=length/8;
   tb=inside({x:b.x+b.vx*Math.min(LEAD_CAP,arrive+LAYOFF+flight),y:b.y+b.vy*Math.min(LEAD_CAP,arrive+LAYOFF+flight)});length=dist(at,tb);
   const short=Math.max(0,length-RECEIVE_REACH),to={x:at.x+(tb.x-at.x)*short/Math.max(.01,length),y:at.y+(tb.y-at.y)*short/Math.max(.01,length)};
   const lane=short<1?1:1-groundPassRisk(at,to,othersB as PracticePlayer[],launch(short));
   const leg=LAYOFF+flight,soon=ARRIVE_FLOOR+(1-ARRIVE_FLOOR)*clamp((ARRIVE_LATE-leg)/(ARRIVE_LATE-ARRIVE_SOON),0,1);
   const nearB=Math.min(...othersB.filter(q=>q.role!=='GK').map(q=>arrivalTime(q,tb)-(arrive+leg)),Infinity);
   const shotB=goalShot(tb,defending)*(1-CLOSE_CUT*clamp(1-nearB/CLOSE_WINDOW,0,1));
   two=Math.max(two,reach*lane*soon*shotB);
  }
 }
 const exact=Math.max(shot*(THREAT_FLOOR+(1-THREAT_FLOOR)*reach),SECOND_STEP*w2*two);
 const value=clamp(perceive(reader,'threat',exact,THREAT_SPREAD*exact,v,{time:pic.time,salt:'thr'+a.id}),0,1);
 const r={reach,shot,value,arrive,at,two};pic.cache.set(key,r);return r;
}

/** The man on the ball's own threat to our goal: his shot through our shooting-line blockers, or a drive at goal. */
export function carrierThreat(carrier:PracticePlayer,defenders:readonly PracticePlayer[],defending:Side):number{
 const g={x:world(defending,0),y:0},d=dist(carrier,g)||1,u={x:(g.x-carrier.x)/d,y:(g.y-carrier.y)/d};
 let shut=0,path=false;
 for(const q of defenders){
  if(q.role==='GK')continue;
  const along=(q.x-carrier.x)*u.x+(q.y-carrier.y)*u.y,across=Math.abs((q.x-carrier.x)*u.y-(q.y-carrier.y)*u.x);
  if(along<=.3||along>=d)continue;
  shut=Math.max(shut,clamp((SHOT_W+.3-across)/(SHOT_W+.3),0,1));
  if(along<DRIVE+1.5&&across<DRIVE_W)path=true;
 }
 const shot=goalShot(carrier,defending)*(1-.7*shut);
 const drive=path?0:goalShot({x:carrier.x+u.x*Math.min(DRIVE,d-1),y:carrier.y+u.y*Math.min(DRIVE,d-1)},defending)*.8;
 return clamp(Math.max(shot,drive),0,1);
}
