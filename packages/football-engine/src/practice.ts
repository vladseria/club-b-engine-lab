import type {StandingNote} from './practice-standing.js';
import {aerialMeetings,reachesAerialMeeting,openAerialMeeting,aerialContact,readAerialKick,strikeAerial,cushionChest,aerialContactShape} from './practice-aerial.js';
import type {AerialTechnique,AerialMeeting,AerialKick} from './practice-aerial.js';
import {airReaction,attacksTheBall,airRace,airCommit,resolveAirDuel,jumpReach,challengeReach,challengePoint,AIR_EVERY,AIR_LEAVE,AIR_LATE,AIR_DARE_LATE,AIR_KEEP,AIR_STEP,AIR_UP_WITH,STANDING_HEAD,AIR_REACH,AIR_MIN,AIR_SET,AIR_LAND,AIR_LAND_CHALLENGE,KNOCK_SPREAD,AIR_UNCONTESTED,AIR_CLEAN_SKILL} from './practice-air-duel.js';
import type {AirMan} from './practice-air-duel.js';
import {approachForSituation,approachOptions} from './team-approach.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {FootballCoaching} from './practice-coaching.js';
import type {CoachingIntent,CoachingNote} from './practice-coaching.js';
import {PracticePlaybook,validateTrainingSetup} from './practice-playbook.js';
import type {PlaybookConfig,PlaybookSelection,TrainingSetup} from './practice-playbook.js';
import {previewLessonRecognition} from './practice-recognition.js';
import type {LessonSpec} from './practice-lesson.js';
import {throwOptions,strikeThrow} from './practice-throw.js';
import {keeperReadyPosition,readKeeperFlight,keeperHandling,keeperSweepReach,keeperSweepDepth,keeperRead,keeperLineDepth,keeperSweepNeed,SWEEP_READ_SPREAD,attackTime,keeperGiveBack,keeperRunSpeed,SHOT_SET,SHOT_RANGE,ATTACK_SPEED} from './practice-keeper.js';
import {coordinateFootball,CoordinationPlan,FootballJob} from './practice-coordination.js';
import {Fixture,Player,Role,Side,Skills,Traits,Tactics,clamp,rng,shapes} from './model.js';
import {MovingPlayer,MovingBall,Vec,steer,steerMotion,contact,STEP} from './movement.js';
import {receptionTarget} from './decisions.js';
import {practiceFixture} from './practice-data.js';
import {carryOptions,chooseFootballOption,commitCarry,CarryPlan,CarryAssessment,CarryOption} from './practice-carry.js';
import type {ShotAssessment} from './practice-football.js';
import {assessShot,strikeShot,keeperReach,goalBoundFlight,markPosition,goalAngle,pitchExit,keeperEdge,placeHurried,NO_EDGE} from './practice-football.js';
import {shotContest,shotRead,shotTemper,SHOT_BASE,SHOT_WORTH,type ShotContest} from './practice-shot-contest.js';
import type {KeeperEdge} from './practice-football.js';
import {arrivalTime,assignDefense,containMovement,coverPosition,shootingThreat,BLOCK_NEAR,BLOCK_GAP,DefenseAssignment,assignFlight,assignMarking,FlightAssignment,runnerBehindShoulder,runnerPickupDelay} from './practice-defense.js';
import {offGoalLine,mayLeaveForBall,BOX_BLOCK_NEAR,BOX_BLOCK_DANGER,blockLeg,BLOCK_LEG_HEIGHT} from './practice-defending.js';
import {readShotDanger} from './practice-shot-defense.js';
import {duelChance,readChallenge,startChallenge,bodyScreensBall,recoveryPosition,resolveChallengeContact,followThroughOf,BEATEN_WINDOW,BEATEN_NEAR,ChallengeContact,ChallengeRead,ChallengeAttempt} from './practice-challenge.js';
import {contactLoad,felt,struck,lunged,KICK_FOLLOW,FALL_KEEP,LEG_AFTER_BALL,TACKLER_STAGGER,Balance} from './practice-balance.js';
import {possessionSafety,lookAgain,securePossessionOptions,recoveryTouch,preparationTime,strikeClearance,launchRisk,ClearanceIntent,footToBall,priceCaught,HURRY_SHARE,HURRY_POINTS} from './practice-possession.js';
import {perceive,Sightings,sightLag,inView,lookingAt} from './practice-perception.js';
import {POSITIONAL_KINDS,CUE_LOOSE,INTENSITY_EVERY,SpotDrift,offBallIntensity,intensityLimit,intensityPush,readCue,restartKickIn,restartWalk} from './practice-intensity.js';
import type {Sight} from './practice-shape.js';
import {turnoverPrice} from './practice-rest-defence.js';
import {HALF_SECONDS,LAST_ATTACK_MAX,SUB_MINUTES,attackAtFullTime,chooseReplacement,energyTop,fatigueEnergy,halfEnergy,lastAttackOver,legs,reserveBalance} from './practice-match.js';
import {validateSubstitutionOrders,triggerHolds,resolveOrder,triggerText,MAX_TRIGGERED_SUBSTITUTIONS} from './practice-substitutions.js';
import type {SubstitutionOrder,SubstitutionNote,SubstitutionRecord} from './practice-substitutions.js';
import {assignSupport,complementarySupportAim,SupportPlan,SupportContext} from './practice-support.js';
import {teamShape,TeamShape} from './practice-shape.js';
import {groundPass,groundOptions,strikeGroundPass,activePassRun,readDelivery,DeliveryRead,PassRun,GroundPass} from './practice-passing.js';
import {loftPass,loftOptions,strikeLoftPass,LoftPass,ReceivingSpace} from './practice-loft.js';
import {advanceFlight,flightSamples,flightMeeting,flightContact,compareFlightContacts} from './practice-flight.js';
import {Restart,RestartKind,RestartInfo,restartPositions,restartPlayersReady,restartBlockers,restartLabels,restartKickPosition,routineRelaxed,ROUTINE_SETUP_CAP,ROUTINE_SETTLE_EVERY} from './practice-restarts.js';
import {liveRestart,restartRoutine,authoredRoutine,planLiveRestart,restartHold,restartOptions,settleRestart,SET_PIECE_HOLD} from './practice-restart-live.js';
import {chooseFreeKickTaker,choosePenaltyTaker,freeKickOptions,setPiecePlayer,strikeFreeKick,DirectFreeKickPlan} from './practice-set-pieces.js';
import {createOffsideAwareness,perceivedOffside,runReleaseAllowance,ReleaseCue} from './practice-awareness.js';
import {feintOptions,feintDuration,finishFeint,feintReleaseOpening,FeintMemory} from './practice-feints.js';
import {strikeStance} from './practice-striking.js';
import {duelGeometry,readDuel,resolveDuel,shieldTouch,turnTouch,dangerAt,TURNED_TIME,DuelResult} from './practice-duel.js';
import {carryPace,captureControl,faceControl,steerControl,advanceControl,receivingContact,cushionControl,controlReleaseAvailable,controlStrikeReady,strikeControl,rollControlRemainder,deflectBodyBall,TouchControl,ControlContact} from './practice-control.js';
import {READ_EVERY,READ_MARGIN,LATE_MARGIN,readHorizon,ballArrival,meetingSpeed,projectOpponents,receptionRoom,roomLate,touchTime,touchCost,firstTimeCost,projectMates,sameIntention,lateStrike,strikeLoad,READ_KEEP,ROOM_DROP,SWITCH_DEADLINE,SHAPE_MIN,LATE_POINTS,FT_PASSING,FT_FINISHING,PLAN_KEEP,COMMIT_GRACE,LANE_CLOSED,type MateJob} from './practice-receive.js';

export const PRACTICE_VERSION='five-shared-1';
/** The least time between two closing-lane rechecks of a prepared kick (honest-reads round): a minimum hold, so a
 * carrier does not re-plan every tick while a presser closes. */
export const RELEASE_RECHECK=.1;
/** (keeper upgrade, 2026-10-13) How set a keeper is at the strike, 0..1 (his edge, practice-football keeperEdge): still
 * (fully at rest, none at SET_STILL m/s), facing the ball (cos + SET_FACING) and at his ready spot (none SET_SPOT m off
 * it). Seeing a shooter shape to shoot (SET_READ + SET_READ_PER x reading s before the strike), he plants when he is
 * within SET_PLANT m of his spot. */
export const SET_STILL=3,SET_FACING=.2,SET_SPOT=1.5,SET_PLANT=1.3,SET_READ=.15,SET_READ_PER=.03;
/** (keeper with the ball in his hands, 2026-10-13) He may control it in his own half for KEEPER_HOLD s (futsal, Law 12)
 * and cannot be challenged while he holds it. He waits for a throw to open only while he can still set and release
 * one inside that (his preparation, or turning to the best throw at KEEPER_TURN rad/s, whichever is longer), and looks
 * again when that runs out, so he chooses his release (a throw, a roll or the long ball) in time. While he waits he
 * moves like a keeper anywhere inside his area (keeperMove): at a brisk jog, KEEPER_JOG of his pace (about 3.4 m/s for
 * an average keeper; he slows to set his throw), up to KEEPER_STEP x KEEPER_RING m a look, KEEPER_EDGE m inside its
 * lines and not back towards his goal line once within KEEPER_DEEP m of it, away from a man on him and to where a throw (along the ground, or over the man) is on, turned to the
 * team-mate he means to find. (A walk, and a limit near where he caught it, left him pinned by a presser 1 m away.) Nobody stands on
 * him: whatever his job, an opponent stays at least KEEPER_BODY m from him. (Before, he stood rooted, a presser stood
 * 0.3-0.6 m from the ball in his hands, the wait ran 3.5 s whatever was around him, and then he had to throw, often
 * straight into that man: evidence/2026-10-13-keeper-giveaway. Holding the presser 2.5 m off raised goals after keeper
 * losses, and releasing early to any clear lane fed interceptions next to goal: evidence/2026-10-13-keeper-fix;
 * evidence/2026-10-13-keeper-2.) */
export const KEEPER_HOLD=4,KEEPER_TURN=4,KEEPER_JOG=.55,KEEPER_STEP=1.5,KEEPER_RING=1.6,KEEPER_EDGE=.8,KEEPER_DEEP=2,KEEPER_BODY=1,KEEPER_BRAKE=.7;
/** keeperMove's read of a spot: a throw's lane is open from KEEPER_LANE m clear of every opponent (fully at
 * KEEPER_LANE + KEEPER_LANE_FULL m), one over the man ignores opponents within KEEPER_OVER m of him and is worth
 * KEEPER_LOFT of a ground one, and a spot within KEEPER_ROOM m of an opponent costs up to KEEPER_CROWDED; he moves
 * only for a gain of KEEPER_GAIN. */
export const KEEPER_LANE=.6,KEEPER_LANE_FULL=1.6,KEEPER_OVER=3.5,KEEPER_LOFT=.75,KEEPER_ROOM=3,KEEPER_CROWDED=.5,KEEPER_GAIN=.05;
/** He does not throw the ball into a man next to him (throwIntoMan): a ball along the ground whose first KEEPER_INTO_LEN
 * m pass within KEEPER_INTO_W m of an opponent costs up to KEEPER_INTO (fully within KEEPER_INTO_W - KEEPER_INTO_FULL m);
 * a lofted one is still low over its first KEEPER_LOFT_LEN m, so a man within KEEPER_LOFT_W m of that stretch blocks it
 * (fully within KEEPER_LOFT_W - KEEPER_LOFT_FULL m). He goes round him or over him from further away instead. (In the
 * giveaway study every release into the man on him was a ball along the ground, read as a low lane risk because the man
 * stood beside the line rather than across it; with that priced, lofts into a man 1 m away were the next.) While any
 * throw clear of the men near him (throwIntoMan below KEEPER_LAST) is on, he takes none into them. */
export const KEEPER_INTO=1.5,KEEPER_INTO_W=1.5,KEEPER_INTO_FULL=.9,KEEPER_INTO_LEN=3,KEEPER_LOFT_W=1.1,KEEPER_LOFT_FULL=.6,KEEPER_LOFT_LEN=2;
/** A last look before he lets it go: if the man on him has stepped into the throw he set (throwIntoMan at least
 * KEEPER_LAST), he holds it and chooses again, once a spell; his last choice comes KEEPER_SPARE s before the four
 * seconds would leave no time for a throw, so that look still fits inside them. (Every pressed release into the man
 * left in the first measurement came right at the end of the four seconds, chosen before the man stepped across.) */
export const KEEPER_LAST=.6,KEEPER_SPARE=.4;
/** Both reads (choosing his throw and the last look) take each man where the keeper sees him (his own picture,
 * practice-perception) and where that man will be KEEPER_AHEAD s on at the speed he sees him moving, the worse of the
 * two: a presser arriving at a sprint is in the throw's way by the time it leaves. (Round 2's one release into the man
 * left was a loft chosen with the presser 1.9 m away and coming, 1.2 m at the release.) */
export const KEEPER_AHEAD=.3;
export type Duty='hold'|'support'|'run'|'show'|'width'|'press'|'jockey'|'challenge'|'block'|'track'|'cover'|'intercept'|'recover'|'carry'|'prepare'|'receive'|'feint'|'wrongfoot'|'keeper'|'dive'|'sweep'|'restart'|'down';
export const dutyNames:Record<Duty,string>={hold:'Protejează spațiul',support:'Oferă o pasă',run:'Atacă spațiul',show:'Vine la picior',width:'Ține lățimea',press:'Închide purtătorul',jockey:'Îl ține în față',challenge:'Încearcă deposedarea',block:'Acoperă șutul',track:'Urmărește o cursă',cover:'Acoperă un coleg',intercept:'Atacă mingea',recover:'Revine în apărare',carry:'Conduce mingea',prepare:'Pregătește lovitura',receive:'Iese la primire',feint:'Încearcă o fentă',wrongfoot:'Își reface echilibrul',keeper:'Închide unghiul',dive:'Plonjează după minge',sweep:'Iese din poartă',restart:'Pregătește reluarea',down:'E la pământ'};
export interface PracticePlayer extends MovingPlayer {role:Role;skills:Skills;traits:Traits;energy:number;archetype:string;temperament:string;lane:number;basePace:number;duty:Duty;/** (contest: pressure on the shooter) when he last rode a tackle and kept the ball (s): a moment off balance (practice-shot-contest DUEL_FADE). */duelAt?:number}
export interface Pose {x:number;y:number;vx:number;vy:number;angle:number;energy:number;duty:Duty}
export type Incident='start'|'pass'|'clearance'|'receive'|'turnover'|'tackle'|'feint'|'beat'|'shot'|'save'|'block'|'goal'|'out'|'offside'|'foul'|'restart'|'half'|'substitution'|'end';
/** Goal side is the beneficiary; actor/lastTouch identifies the final contact,
 * not an adjudication of scorer versus own goal. Shot assessment is a utility
 * heuristic, not xG; it is present only for ordinary foot strikes. */
export interface PracticeEvent {substitution?:SubstitutionRecord;lastTouch?:string;shot?:{aim:Vec;origin:Vec&{z:number};velocity:{vx:number;vy:number;vz:number};assessment?:ShotAssessment;/** (contest) what the defence did to it at the strike (practice-shot-contest). */contest?:Pick<ShotContest,'rush'|'shadow'|'balance'|'poise'|'hurry'|'closer'>};technique?:AerialTechnique;firstTime?:boolean;time:number;kind:Incident;text:string;actor?:string;target?:string;side?:Side;challengeContact?:ChallengeContact;restartKind?:RestartKind;restartSpot?:Vec;restartPlayers?:{id:string;x:number;y:number;vx:number;vy:number}[];incoming?:string;outgoing?:string;pass?:{meetingTime?:number;weight:GroundPass['weight'];aim:Vec;intendedSpeed:number;actualSpeed:number;arrivalSpeed:number};freeKick?:DirectFreeKickPlan;aerial?:{meetingTime?:number;kind:LoftPass['kind'];aim:Vec;intendedSpeed:number;actualSpeed:number;intendedVz:number;actualVz:number;flight:number;apex:number;risk:number}}
/** (contest round) one reception duel, recorded with `record`: who, where, the reads and the outcome. */
export interface ReceptionDuelRecord {time:number;receiver:string;defender:string;outcome:DuelResult['outcome'];commit:boolean;layoff:boolean;access:number;screen:number;front:number;goalTight:number;closing:number;nick:number;seenNick:number;flight:number;from?:Vec;at:Vec;defenderAt:Vec}
export interface Choice {assignment?:Pick<FootballJob,'purpose'|'since'|'until'|'target'> & {aim:Vec};time:number;player:number;kind:Duty;reason:string;action?:Action;carry?:CarryAssessment&{aim:Vec;continuing:boolean;committedUntil:number};challenge?:ChallengeRead&{opponent:string;resolvesAt:number}}
export interface PracticeFrame {time:number;half:1|2;cut?:boolean;lineup?:number[];players:Pose[];ball:MovingBall;score:[number,number];event:number;restart:boolean;restartInfo?:RestartInfo;side:Side;control?:{owner:string;feet:{side:'left'|'right';x:number;y:number;active:boolean}[]}}
export interface PracticeStats {passes:number;completed:number;clearances:number;shots:number;goals:number;saves:number;turnovers:number;tackles:number;tacklesWon:number;feints:number;beaten:number;fouls:number;offsides:number;possession:number;pressSeconds:number;coverSeconds:number}
/** `duration`: the match length asked for. `played`: when the final whistle went, present only when a last attack
 * carried the match past `duration` (practice-match.ts LAST_ATTACK_MAX); otherwise the match ended at `duration`. */
/** A contest in the air (practice-air-duel), recorded with the match when record is on. */
export interface AerialDuelRecord {time:number;x:number;y:number;z:number;attacker:string;defender:string;toucher:string;winner:string;outcome:'clean'|'knock'|'foul';result:string;way:'up'|'nip';chance:number}
export interface PracticeResult {version:string;seed:number;duration:number;played?:number;teams:[string,string];players:PracticePlayer[];frames:PracticeFrame[];events:PracticeEvent[];choices:Choice[];stats:[PracticeStats,PracticeStats];score:[number,number];controlContacts?:ControlContact[];receptionDuels?:ReceptionDuelRecord[];aerialDuels?:AerialDuelRecord[];aerialChallenges?:{time:number;id:string;result:string}[];playbookSelections?:PlaybookSelection[];standingNotes?:StandingNote[];coachingNotes?:CoachingNote[];substitutionNotes?:SubstitutionNote[]}
type Action='pass'|'through'|'loft'|'carry'|'shoot'|'feint'|'clear';
export interface Option {/** What the receiver can do next, already in `score` (receiverProspects). */next?:number;/** A delivery's pass-only pressure credits (relief, retreat, pressure x space), already in `score`: what the purpose clock decays (R3). */relief?:number;/** A shot: the shooter's own read of his chance (R2), already in `score`. */quality?:number;/** Interception risk of a planned throw (throw-ins only). */throwRisk?:number;/** A throw that leads a run: where the receiver meets it. */throwLead?:Vec;kind:Action;clearance?:ClearanceIntent;target?:string;aim:Vec;score:number;reason:string;carry?:CarryAssessment;continuing?:boolean;delivery?:DeliveryRead;run?:PassRun;pass?:GroundPass;loft?:LoftPass;freeKick?:DirectFreeKickPlan;teachingStep?:string;teachingPlan?:string;teachingFit?:number;teachingSpace?:boolean;receivingSpace?:ReceivingSpace;/** (decide round) played hurried by a pressed man: half the preparation, struck worse (practice-possession priceCaught). */hurried?:boolean}
interface Intent {kind:Duty;aim:Vec;speed:number;until:number;since:number;reason:string;teamSide:Side;shapeOffset?:Vec;
 /** The release this intent was read against (a keeper re-reads each new ball). */release?:number}
interface FirstTouch {owner:string;aim:Vec}
const blank=():PracticeStats=>({passes:0,completed:0,clearances:0,shots:0,goals:0,saves:0,turnovers:0,tackles:0,tacklesWon:0,feints:0,beaten:0,fouls:0,offsides:0,possession:0,pressSeconds:0,coverSeconds:0});
const other=(s:Side)=>(1-s) as Side;
const sign=(s:Side)=>s===0?1:-1;
export const depth=(s:Side,x:number)=>s===0?x:L-x;
const world=(s:Side,x:number)=>s===0?x:L-x;
const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
const angleDiff=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const skill=(n:number)=>clamp(n/10,0,1);
/** A match length in Romanian words: whole minutes, else seconds (a 20 s trial is not "0.333 minute"). */
const span=(seconds:number)=>{const n=Math.round(seconds),m=n/60;return Number.isInteger(m)?(m===1?'1 minut':`${m} minute`):`${n}${n%100>=20||n%100===0?' de':''} secunde`;};
const inside=(p:Vec)=>({x:clamp(p.x,.8,(L-.8)),y:clamp(p.y,-(W/2-1),(W/2-1))});
/** A ball moving toward side s's goal that rolls over that goal line between the
 * posts before it stops (same integrator as the live ball). */
const ownGoalBound=(s:Side,b:MovingBall)=>{
 if(depth(s,b.x)>12||sign(s)*b.vx>-.5)return false;
 const f={...b};
 for(let i=0;i<Math.ceil(3/STEP);i++){advanceFlight(f);if(depth(s,f.x)<=0)return Math.abs(f.y)<=GH+.3&&f.z<=HEIGHT;if(Math.hypot(f.vx,f.vy)<.3)return false;}
 return false;
};
export function practicePlayers(f:Fixture):PracticePlayer[]{
 return f.teams.flatMap((t,side)=>{
  if(!shapes[t.tactics.formation]||shapes[t.tactics.formation].length!==5)throw Error('Choose a five-a-side formation');
  if(t.lineup.length!==5||new Set(t.lineup).size!==5)throw Error('5v5 needs five distinct starters');
  return t.lineup.map((id,i)=>{
   const source=t.squad.find(p=>p.id===id);if(!source)throw Error('Starter missing from squad');
   const p=structuredClone(source) as Player&{archetype?:string;temperament?:string},[role,lane]=shapes[t.tactics.formation][i];
   if(!Object.values(p.skills).every(n=>Number.isFinite(n)&&n>=0&&n<=12)||!Number.isFinite(p.energy)||p.energy<0||p.energy>100)throw Error('Invalid practice attributes');
   const x=role==='GK'?X(6):role==='CB'?X(24):role==='FB'?X(28):role==='DM'?X(37):role==='CM'?X(43):role==='AM'?X(46):X(48);
   const y=lane*(role==='FB'||role==='W'?Y(27):role==='CB'?Y(10):Y(13)),basePace=role==='GK'?4.5+p.skills.pace*.34:4.75+p.skills.pace*.35;
   // duelAt is declared (undefined) from the start, not added at the first duel: a property added mid-match gives
   // players (and every {...p} copy) a second shape and made the whole engine ~8% slower (evidence/2026-10-15-contest-cost)
   return {...p,id:`${side}:${p.id}`,side:side as Side,number:i+1,role,lane,x:world(side as Side,x),y,vx:0,vy:0,angle:side?Math.PI:0,basePace,pace:basePace,acceleration:role==='GK'?3.1+p.skills.pace*.19:3.5+p.skills.pace*.22,job:'',duty:'hold' as Duty,archetype:p.archetype??'',temperament:p.temperament??'',duelAt:undefined};
  });
 });
}
/** Board preview uses the same roster, validated poses and controlled-ball start,
 * but performs no simulation, random draw, or mutation of the supplied input. */
export function previewTrainingLesson(fixture:Fixture,setup:TrainingSetup,lesson:LessonSpec,side:Side=0){
 const players=practicePlayers(fixture),valid=validateTrainingSetup(setup,players);
 for(const pose of valid.poses)Object.assign(players.find(p=>p.side===pose.side&&p.number===pose.number)!,{x:pose.x,y:pose.y,angle:pose.angle,vx:0,vy:0});
 const owner=players.find(p=>p.side===valid.ball.side&&p.number===valid.ball.number)!;
 const ball:MovingBall={x:valid.ball.x,y:valid.ball.y,vx:0,vy:0,z:0,vz:0,owner:owner.id,mode:'control'};
 return previewLessonRecognition(lesson,side,players,ball,laneRisk);
}
export function offsidePlayers(_players:PracticePlayer[],_side:Side,_ball:Vec):string[]{return [];}
/** `delay` (decide round): the ball leaves that much later (a touch first), and every defender has that time more to
 * get to it (the touch read of a defence reshaping, practice-receive touchCost). */
export function laneRisk(from:Vec,to:Vec,defenders:PracticePlayer[],speed=16,delay=0):number{
 const dx=to.x-from.x,dy=to.y-from.y,d2=dx*dx+dy*dy;if(d2<1)return 1;
 const length=Math.sqrt(d2);let risk=0;
 for(const p of defenders){
  const projection=clamp(((p.x-from.x)*dx+(p.y-from.y)*dy)/d2,.06,1);
  // Include the receiver's end of the lane: a marker can intercept just before reception.
  for(const t of [projection,Math.min(1,projection+.15)]){
   const flight=length*t/speed,available=Math.max(0,flight+delay-.22),point={x:from.x+dx*t,y:from.y+dy*t};
   const delta=unit(point.x-p.x,point.y-p.y),towards=p.vx*delta.x+p.vy*delta.y;
   const reach=Math.max(0,Math.min(p.pace*available,towards*available+.5*p.acceleration*available*available));
   risk=Math.max(risk,clamp((reach+1.1-dist(point,p))/2,0,1));
  }
 }
 return risk;
}
/** (receive round) What a receiver may plan while the ball travels (practice-receive): every action his first touch
 * can serve (a feint needs the man in front of him first). */
const PLANNED:readonly Action[]=['carry','pass','through','loft','shoot','clear'];
/** A lofted clearance is over a foot within a stride or so; a driven one is not (as securePossessionOptions reads it). */
const clearReach=(o:Option)=>o.clearance==='long'||o.clearance==='channel'||o.clearance==='mate'?1.6:4;
/** The risk a planned option is held to (under 0.28, as before): a carry's obstruction, a pass's or a loft's own lane
 * read, a clearance's launch past the nearest foot, otherwise the ground lane. */
function plannedRisk(p:PracticePlayer,o:Option,opponents:PracticePlayer[],players:PracticePlayer[]):number{
 if(o.kind==='clear')return launchRisk(p,o.aim,players,0,clearReach(o));
 return o.carry?.obstruction??o.pass?.risk??o.loft?.risk??laneRisk(p,o.aim,opponents,22);
}
/** (receive round) A defender reads a ball coming into the area round his own goal, within CLEAR_READ m of its centre
 * (the "losses within 12 m" area of the watch notes), and wants CLEAR_SPARE s to spare there before he controls it. */
export const CLEAR_READ=12,CLEAR_SPARE=.3;
/** A man within ON_TOUCH m of the ball when the receiver meets it is on him: the touch protects it from him first,
 * whatever he meant to set it for (the first touch away from a man within 2.5 m, before). */
export const ON_TOUCH=1.5;
/** A kick he is setting, or striking, whose first metres a man has stepped into (launch read above BLOCKED_KICK) is
 * re-read (closedRelease; a clearance at the strike too). */
export const BLOCKED_KICK=.55;
export function kickBlocked(p:PracticePlayer,o:Option,players:PracticePlayer[],delay:number):boolean{
 return launchRisk(p,o.aim,players,delay,o.kind==='clear'?clearReach(o):4)>BLOCKED_KICK;
}
/** (receive round) Team-mates' bodies keep TEAM_GAP m apart, centre to centre (two torsos of 0.31 m, a hand between).
 * Steering only repels them softly inside 1.65 m (movement.ts), and pressers, challengers, interceptors and sweepers
 * steer past team-mates only: two players under 0.6 m apart in 6.6% of frames, team-mates 73 pair-frames a match
 * (evidence/2026-10-15-watch-notes). Opponents are untouched: contact there is a contest. */
export const TEAM_GAP=.7;
/** How far a shooter who cannot read his chance misjudges it (a relative
 * error, R2): now with the rest of his read, practice-shot-contest shotRead. */
export {SHOT_SPREAD} from './practice-shot-contest.js';
/** A shot that does not score is a loss at the opponents' goal, but a slow
 * one: a save, a goal kick or a keeper's ball gives the side that shot about
 * this share of a loss's danger (time to turn and get back). */
export const SHOT_RESTART=.6;
/** A reception this far beyond the deepest point a passing spell has reached
 * is progress and stops the purpose clock (R3 P4). */
export const PROGRESS_METRES=3;
/** The same choices apply to either side; profile names are presentation only. */
export function practiceOptions(p:PracticePlayer,players:PracticePlayer[],running:ReadonlySet<string>,lastFrom='',held=0,plan:CarryPlan|null=null,time=0,support:SupportPlan|null=null,planningLine?:number,lastFeint?:FeintMemory):Option[]{
 const defenders=players.filter(q=>q.side!==p.side),outfield=defenders.filter(q=>q.role!=='GK');
 const forward=depth(p.side,p.x),s=sign(p.side);
 const options:Option[]=[],offsides=new Set(planningLine===undefined?offsidePlayers(players,p.side,p):players.filter(q=>q.side===p.side&&perceivedOffside(p,q,planningLine)).map(q=>q.id));
 options.push(...carryOptions(p,players,held,laneRisk,plan,time));
 for(const q of players.filter(q=>q.side===p.side&&q.id!==p.id)){
  const d=dist(p,q),progress=depth(p.side,q.x)-forward;if(d<2.8||d>40||progress< -25||offsides.has(q.id))continue;
  const run=activePassRun(support,p,q,time);
  for(const through of running.has(q.id)||run?[false,true]:[false]){
   options.push(groundOptions(p,q,players,through,run,p,laneRisk,lastFrom,held,undefined,{support,time})[0]);
  }
 }
 for(const q of players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK')){
  const d=dist(p,q),progress=depth(p.side,q.x)-forward;if(d<8||d>55||progress< -20||offsides.has(q.id))continue;
  const run=activePassRun(support,p,q,time),ground=options.filter(o=>o.target===q.id&&o.pass).sort((a,b)=>b.score-a.score)[0];
  // A clear short ground route needs no aerial alternative. Runs, distance and
  // blocked lanes are reasons to compare height with the existing pass choices.
  if(d<30&&!run&&(ground?.pass?.risk??1)<.2)continue;
  options.push(loftOptions(p,q,players,run,p,laneRisk,undefined,{support,time})[0]);
 }
 const goal={x:world(p.side,L),y:0},keeper=defenders.find(q=>q.role==='GK')!,exposure=L-depth(p.side,keeper.x);
 // An audacious player ("shoots on sight") looks at goal from further out.
 const audacity=clamp(p.traits.audacity??0,0,1);
 if((forward>X(73)-audacity*X(12)&&Math.abs(p.y)<Y(24))||(forward>X(48)&&exposure>X(15)&&p.traits.risk>.6)){
  const assessment=assessShot(p,players),uncovered=exposure>X(15)&&assessment.keeperCoverage<.25;
  // (shot decision, 2026-10-15, owner: "what's the chance" is a skill, "do I
  // take it" is a personality) Two steps, kept apart:
  //  1. The chance, as he reads it (practice-shot-contest shotRead): what the
  //     place gives a free shot (assessment.open: angle, distance, keeper),
  //     less what the contest at the strike costs it (shotContest's hurry:
  //     the man arriving by then, the goal bodies hide, a man on his
  //     shoulder, striking across his run) as he reads that cost (hurryCost),
  //     misjudged by his reading and finishing. Pressure enters once, here.
  //     Same skills, same read, whatever his temperament.
  //  2. Whether he takes it (shotTemper): his appetite (daring: risk,
  //     audacity) and, with a man on him, his nerve, added to the shot's
  //     score beside the chance's own worth (SHOT_WORTH a unit). Bounded and
  //     not scaled by the chance, so it settles close calls (a daring man
  //     tries the thin one; a composed one takes what his read says is best)
  //     and never makes a decent chance look small.
  const contest=shotContest(p,players,assessment.aim,{lead:preparationTime(p,'shoot'),sinceDuel:p.duelAt===undefined?undefined:time-p.duelAt});
  const quality=shotRead(p,assessment.open,contest.hurry,p,time);
  // What a shot gives away (R2, beside the pass's loss price): unless it
  // goes in, the ball is the opponents' against the rest defence we have now
  // (priced as a loss where he shoots from), though their keeper's restart
  // buys us back some of the seconds (SHOT_RESTART). Read as he reads it.
  const given=(1-clamp(quality*.6,0,.9))*SHOT_RESTART*turnoverPrice(p,players,p);
  options.push({kind:'shoot',quality,aim:assessment.aim,score:SHOT_BASE+quality*SHOT_WORTH+shotTemper(p,contest.pressure)-laneRisk(p,assessment.aim,outfield,22+p.skills.finishing*.3)*.22+(uncovered?.22:0)-given,reason:uncovered?'Portarul e ieșit; încearcă să profite de poarta expusă.':'Găsește un unghi și încearcă poarta.'});
 }
 // Keep one best duel in ordinary selection; the lesson may prefer another
 // exit toward its taught destination without multiplying random chances.
 const duel=feintOptions(p,players,lastFeint,time)[0];if(duel)options.push(duel);
 return securePossessionOptions(p,players,options,laneRisk);
}
// (B2) the duel's odds live with the challenge model, where the carrier's own read of them can use them too
export {duelChance} from './practice-challenge.js';
/** (keeper with the ball in his hands) Where a keeper holding the ball walks to, and whom he turns to: of his spot and
 * spots round it at 0.6, 1 and KEEPER_RING x KEEPER_STEP m (anywhere inside his area, KEEPER_EDGE m in from its
 * lines, but no deeper once within KEEPER_DEEP m of his goal line, where a man in front would pin him), the one with the best throw on (an open lane along the ground from in front of him, or over a man
 * near him, to a team-mate with room, shorter throws a little better, none into a man next to him: throwIntoMan) less
 * what standing near an opponent costs. He moves only for a gain of KEEPER_GAIN; `look` is the team-mate of the best
 * throw from there. */
export function keeperMove(p:PracticePlayer,mates:readonly Vec[],opponents:readonly (Vec&{vx?:number;vy?:number})[]):{spot:Vec;look:Vec|null}{
 const now=depth(p.side,p.x),lo=Math.max(KEEPER_EDGE,Math.min(now,KEEPER_DEEP)),hi=BOX_DEPTH-KEEPER_EDGE,wide=BOX_HALF-KEEPER_EDGE;
 const lane=(from:Vec,to:Vec,over:boolean)=>{
  const dx=to.x-from.x,dy=to.y-from.y,len2=dx*dx+dy*dy||1;let clear=99;
  for(const q of opponents){if(over&&dist(q,from)<KEEPER_OVER)continue;const t=clamp(((q.x-from.x)*dx+(q.y-from.y)*dy)/len2,0,1);clear=Math.min(clear,Math.hypot(q.x-from.x-dx*t,q.y-from.y-dy*t));}
  return clamp((clear-KEEPER_LANE)/KEEPER_LANE_FULL,0,1);
 };
 const read=(c:Vec)=>{
  let near=99;for(const q of opponents)near=Math.min(near,dist(c,q));
  let best=0,look:Vec|null=null;
  for(const t of mates){
   const len=dist(c,t);if(len<3)continue;
   const u={x:(t.x-c.x)/len,y:(t.y-c.y)/len},from={x:c.x+u.x*.65,y:c.y+u.y*.65};
   let room=99;for(const q of opponents)room=Math.min(room,dist(t,q));
   const v=Math.max(lane(from,t,false)*(1-throwIntoMan(c,t,opponents)),lane(from,t,true)*KEEPER_LOFT*(1-throwIntoMan(c,t,opponents,true)))*(.4+.6*clamp((room-1)/3,0,1))*clamp(1-(len-22)/20,.3,1);
   if(v>best){best=v;look=t;}
  }
  return {value:best-KEEPER_CROWDED*clamp((KEEPER_ROOM-near)/(KEEPER_ROOM-KEEPER_BODY),0,1),look};
 };
 const here={x:p.x,y:p.y},stay=read(here);
 let spot=here,top={value:stay.value+KEEPER_GAIN,look:stay.look};
 for(let k=0;k<24;k++){
  const a=k<16?k*Math.PI/8:(k-16)*Math.PI/4,r=k>=16?KEEPER_STEP*KEEPER_RING:k%2?KEEPER_STEP:KEEPER_STEP*.6;
  const c={x:world(p.side,clamp(now+Math.cos(a)*r,lo,hi)),y:clamp(p.y+Math.sin(a)*r,-wide,wide)};
  if(dist(c,here)<.3)continue;
  const v=read(c);if(v.value>top.value){top=v;spot=c;}
 }
 return {spot,look:top.look};
}
/** (keeper with the ball in his hands) How far a throw from his hands towards `aim` goes into a man next to him, 0..1:
 * the nearest pass by an opponent over the stretch where he can still get to it (KEEPER_INTO_LEN m along the ground,
 * KEEPER_LOFT_LEN m for a lofted ball still low) from where it leaves him, the man taken where he is and where he
 * will be KEEPER_AHEAD s on (his velocity, when given), whichever is worse. */
export function throwIntoMan(p:Vec,aim:Vec,men:readonly (Vec&{vx?:number;vy?:number})[],lofted=false):number{
 const u=unit(aim.x-p.x,aim.y-p.y),from={x:p.x+u.x*.65,y:p.y+u.y*.65};let worst=0;
 const len=lofted?KEEPER_LOFT_LEN:KEEPER_INTO_LEN,w=lofted?KEEPER_LOFT_W:KEEPER_INTO_W,full=lofted?KEEPER_LOFT_FULL:KEEPER_INTO_FULL;
 const into=(x:number,y:number)=>{const a=(x-from.x)*u.x+(y-from.y)*u.y;if(a<-.3||a>len)return 0;return clamp((w-Math.abs((x-from.x)*u.y-(y-from.y)*u.x))/full,0,1);};
 for(const q of men)worst=Math.max(worst,into(q.x,q.y),into(q.x+(q.vx??0)*KEEPER_AHEAD,q.y+(q.vy??0)*KEEPER_AHEAD));
 return worst;
}
export function foulRestartFor(attacking:Side,spot:Vec):'penalty'|'freeKick'{const x=depth(attacking,spot.x);return x>=(L-BOX_DEPTH)&&x<=L&&Math.abs(spot.y)<=BOX_HALF?'penalty':'freeKick';}

export function simulatePractice(fixture:Fixture=practiceFixture(),duration=300,progress?:(seconds:number)=>void,record=true,options:{policy?:'classic'|'coordinated';substitutions?:'none'|'planned';initialRestart?:{kind:RestartKind;side:Side;spot:Vec};playbook?:PlaybookConfig;playbooks?:PlaybookConfig[];trainingSetup?:TrainingSetup;coaching?:CoachingIntent;substitutionOrders?:SubstitutionOrder[];lastAttack?:boolean}={}):PracticeResult{
 if(!Number.isInteger(fixture.seed)||fixture.seed<0||fixture.seed>0xffffffff||!Number.isFinite(duration)||duration<10||duration>5400||options.substitutions!==undefined&&!['none','planned'].includes(options.substitutions))throw Error('Invalid practice duration or seed');
 if(options.initialRestart&&(!['kickoff','penalty','freeKick','indirect','throw','corner','goalKick'].includes(options.initialRestart.kind)||![0,1].includes(options.initialRestart.side)||!Number.isFinite(options.initialRestart.spot.x)||!Number.isFinite(options.initialRestart.spot.y)))throw Error('Invalid opening scenario');
 if(options.policy!==undefined&&!['classic','coordinated'].includes(options.policy))throw Error('Invalid practice policy');
 const coordinated=options.policy==='coordinated';let coordination:CoordinationPlan|null=null;
 const f=structuredClone(fixture),players=practicePlayers(f);
 // Opt-in prepared substitutions. Absent or empty, none of their code runs.
 const orders=options.substitutionOrders?.length?validateSubstitutionOrders(options.substitutionOrders,f):[];
 if(orders.length&&options.substitutions==='planned')throw Error('Choose planned or triggered substitutions, not both.');
 if(options.trainingSetup&&options.initialRestart)throw Error('Choose a recovery setup or a restart, not both.');
 const trainingSetup=options.trainingSetup?validateTrainingSetup(options.trainingSetup,players):undefined;
 if(trainingSetup)for(const pose of trainingSetup.poses){const p=players.find(p=>p.side===pose.side&&p.number===pose.number)!;Object.assign(p,{x:pose.x,y:pose.y,angle:pose.angle,vx:0,vy:0});}
 const roster=structuredClone(players),byId=new Map(players.map(p=>[p.id,p]));
 if(options.playbook&&options.playbooks)throw Error('Choose playbook or playbooks');
 const configs=options.playbooks??(options.playbook?[options.playbook]:[]);
 if(configs.length>2||new Set(configs.map(p=>p.side)).size!==configs.length)throw Error('One playbook per side');
 const playbooks=configs.map(config=>new PracticePlaybook(config,f.seed));
 const bookFor=(side:Side):PracticePlaybook|null=>playbooks.length===1?playbooks[0]:playbooks.find(p=>p.config.side===side)??null;
 let playbook:PracticePlaybook|null=playbooks[0]??null;
 if(!coordinated&&playbooks.some(b=>b.config.plans.some(p=>p.standing?.length)))throw Error('Persistent instructions require the coordinated football policy.');
 const coaching=options.coaching?new FootballCoaching(options.coaching):null;
 if(coaching&&playbooks.length)throw Error('Choose a coaching intention or an explicit action graph.');
 // Striker: Pivot: the lead forward while he shows for a ball into his feet (team-approach PIVOT_PULL).
 const showingPivot=(team:Side)=>{const id=coordination?.attacking===team?coordination.strikers?.[team]?.id:undefined,job=id?coordination!.jobs[id]:undefined;return job?.purpose==='pivot'&&job.kind==='show'?id:undefined;};
 const footballOptions=(...args:Parameters<typeof practiceOptions>):Option[]=>{let available=approachOptions(args[0],practiceOptions(...args),tacticsFor(args[0].side),args[1],showingPivot(args[0].side));if(coaching)available=coaching.options(args[6]??0,args[0],args[1],ball,available,laneRisk,args[4]??0,args[5]??null);const offered=bookFor(args[0].side)?.options(args[6]??0,args[0],args[1],ball,args[7]??null,available)??available;
  // (duel recovery) nobody plays the ball to a team-mate lying on the floor
  return downs.size&&offered.some(o=>o.target&&isDown(o.target))?offered.filter(o=>!o.target||!isDown(o.target)):offered;};
 const rosterIndex=new Map(roster.map((p,i)=>[p.id,i])),used=new Set(players.map(p=>p.id)),subCounts=[0,0];
 let half:1|2=1,lineup:number[]|undefined,needsFrame=false,cut=false;
 // Set when full time finds a side in an attack (the loop below, practice-match.ts attackAtFullTime).
 let lastAttack:{side:Side;shot:boolean}|null=null;
 const frameStride=duration>900?30:6;
 const get=(id:string)=>byId.get(id)!,sidePlayers=(side:Side)=>players.filter(p=>p.side===side);
 const random=rng(f.seed^0x884411),execution=rng(f.seed^0x547293),duelDraw=rng(f.seed^0x2d1e75),airRandom=rng(f.seed^0x3a1f07),balanceDraw=rng(f.seed^0x6b1a4d),aerialDuels:AerialDuelRecord[]=[],stats:[PracticeStats,PracticeStats]=[blank(),blank()],score:[number,number]=[0,0];
 const frames:PracticeFrame[]=[],events:PracticeEvent[]=[],choices:Choice[]=[],intents=new Map<string,Intent>(),duelAfter=new Map<string,number>(),wrongfoot=new Map<string,{until:number;aim:Vec;reason?:string}>(),lastChoice=new Map<string,{kind:Duty;reason:string;assignment?:string}>(),intercepts=new Map<string,{at:number;aim:Vec}>(),actionReasons=new Map<string,string>();
 let watchedFlight=0;
 let time=0,side=f.kickoff,receivedAt=0,nextThink=0,recheckAt=0,lastFrom='',releaseBy='',releaseAt=-5,intended='',flags:string[]=[],lastTouch='',assignmentAt=0,presser='',coverer='';
 const awareness=createOffsideAwareness();
 // Late pick-ups (coordinated policy): a defender who was closing the ball
 // carries on with that job a moment longer when the runner he is now asked
 // to mark left from behind his shoulder (practice-defense runnerPickupDelay).
 const lapses=new Map<string,{until:number;attacking:Side;job:FootballJob}>();
 const observedLine=(p:PracticePlayer)=>awareness.lineFor(p,players,time,clamp((5-Math.min(...players.filter(q=>q.side!==p.side).map(q=>dist(q,p))))/5,0,1));
 let ball:MovingBall={x:(L/2),y:0,vx:0,vy:0,z:0,vz:0,owner:null,mode:'loose'},restart:Restart|null=null as Restart|null,prepared:{option:Option;at:number}|null=null,carry:Vec={x:(L/2),y:0},reception:Vec|null=null,receptionAt=0;
 let cueState:{prepared:{option:{kind:string;target?:string;aim:Vec}};since:number}|null=null;
 const passCue=()=>{const o=cueState?.prepared.option,owner=ball.owner?get(ball.owner):undefined;return o&&owner&&!restart&&o.target&&(o.kind==='pass'||o.kind==='through'||o.kind==='loft')?{target:o.target,passer:owner.id,aim:{x:o.aim.x,y:o.aim.y},since:cueState!.since}:undefined;};
 const releaseCue=():ReleaseCue|undefined=>prepared?.option.target&&(prepared.option.kind==='through'||prepared.option.kind==='loft')&&(prepared.option.run||get(prepared.option.target).duty==='run')?{target:prepared.option.target,at:prepared.at}:undefined;
 let feint:{attacker:string;defender:string;check:number;aim:Vec;resolved:boolean;finish:number;score:number;review:number}|null=null;
 const feintMemory=new Map<string,FeintMemory>();
 const dives=new Map<string,{aim:Vec;until:number;recoverUntil:number}>();
 // Sprint reserve (fraction of each player's own) per practice id; a newcomer starts full.
 const reserves=new Map<string,number>();
 const reserveOf=(p:PracticePlayer)=>reserves.get(p.id)??1;
 // Each player's rested acceleration (his skill), kept apart from today's legs.
 const restedAcceleration=new Map<string,number>();
 let carryPlan:CarryPlan|null=null;
 let firstTouch:FirstTouch|null=null as FirstTouch|null;
 /** `first` (receive round): his read says to play it first time; otherwise his first touch sets it. */
 /** (decide round) `room`: his read of his room when he formed or last kept the plan; `alt`: his ranked second, a
  * different intention he could play instead if the plan is off at the touch. */
 type Continuation={receiver:string;release:number;option:Option;since:number;checked:number;first:boolean;room:number;alt:Option|undefined};
 let continuation:Continuation|null=null as Continuation|null;
 /** (receive round) the plan of the defender who will meet the opponents' ball first (readReception) */
 let defenderPlan:Continuation|null=null as Continuation|null;
 type AerialPreparation={meeting:AerialMeeting;option?:Option;since:number;checked:number;release:number;at:number;duel?:boolean};
 const aerialPreparations=new Map<string,AerialPreparation>();
 // (contests in the air) defenders who have decided to attack the ball in the air, and where they go for it
 const airAttacks=new Map<string,{release:number;since:number;aim:Vec}>(),airChallenges:{time:number;id:string;result:string}[]=[];
 let defense:DefenseAssignment|null=null;
 let support:SupportPlan|null=null,completedPass:SupportContext['lastPass'],passContinuation:SupportContext['passContinuation'];
 let teamShapes:[TeamShape|null,TeamShape|null]=[null,null];
 let flight:FlightAssignment={hunters:[],meetings:{},coverer:''},flightAt=0;
 let challenge:ChallengeAttempt|null=null;
 // (regain fixes) who last had the ball at his feet before it left him (a kick, or it came off him), and when
 // `settled`: the duel that took it already set his recovery (a tackle, a nick at the touch); `kick`: he lost it as he
 // struck it (a kick blocked at his feet: his leg is still swinging through)
 let dispossessed:{id:string;at:number;settled?:boolean;kick?:boolean}|null=null;
 const recovering=new Map<string,{until:number;opponent:string}>();
 // (duel recovery, 2026-10-16) knocked to the floor in a duel, until when (practice-balance struck)
 const downs=new Map<string,number>();
 const blocks=new Map<string,{opponent:string;aim:Vec;until:number}>();
 let inHands=false,groundDelivery=false,aerialDelivery=false,keeperStep:Vec|null=null,keeperLook:Vec|null=null,keeperRelook=false;
 // (keeper upgrade) the defending keeper's edge against the shot in flight (practice-football keeperEdge); set at the
 // strike, gone as soon as the ball is no longer a shot
 let shotEdge:(KeeperEdge&{id:string})|null=null;
 const edgeOf=(p:{id:string}):KeeperEdge=>shotEdge&&shotEdge.id===p.id?shotEdge:NO_EDGE;
 const controls=new Map<string,TouchControl>(),controlContacts:ControlContact[]=[],receptionDuels:ReceptionDuelRecord[]=[];
 const controlFor=(p:PracticePlayer)=>{let state=controls.get(p.id);if(!state){state=captureControl(p,ball);state.time=time;controls.set(p.id,state);}return state;};
 let noHandsSide:Side|null=null,noHandsKeeper='';
 const noteTouch=(id:string)=>{lastTouch=id;const p=get(id);if(p.role!=='GK'||p.side!==noHandsSide)noHandsSide=null;if(id!==noHandsKeeper)noHandsKeeper='';};
 const collectContacts=(state:TouchControl)=>{if(state.contacts.length){for(const c of state.contacts)noteTouch(c.actor);if(record)controlContacts.push(...state.contacts);needsFrame=true;state.contacts.length=0;}};
 const canUseHands=(p:PracticePlayer)=>p.role==='GK'&&p.side!==noHandsSide&&p.id!==noHandsKeeper;
 const tacticsFor=(team:Side)=>{
  const t=f.teams[team].tactics,age=team===side&&transitionAt>=0?time-transitionAt:-1;
  const focus=players.find(p=>p.side===team&&p.id===(ball.owner??(ball.mode==='pass'?flight.receiver:undefined)));
  const continuing=coordination?.attacking===team?Object.values(coordination.jobs).filter(j=>j.purpose==='break'):[];
  const situation=approachForSituation(t,players,focus,age,continuing,time);
  return team===side&&recycle[team].count?{...situation,recycled:recycle[team].count}:situation;
 };
 let restartAssignAt=0,transitionAt=-10,exempt=false,mustRelease=false,restrictedGoal=false,restartKicker='';
 // The purpose clock (R3 P4): each side's run of completed passes that have
 // not taken the ball forward (the reception not 3 m beyond the deepest point
 // the spell has reached), visible to every player. A shot, a progressive
 // reception, a loss or a restart starts it again.
 const recycle=[{count:0,max:-1},{count:0,max:-1}];let releaseFrom:Vec|null=null;
 const resetClock=(s?:Side)=>{for(const k of s===undefined?[0,1]:[s])recycle[k]={count:0,max:-1};};
 const say=(kind:Incident,text:string,actor?:PracticePlayer,target?:PracticePlayer)=>{events.push({time,kind,text,actor:actor?.id,target:target?.id,side:actor?.side});needsFrame=true;};

 // (contest round) the reception duel: the defender whose foot can best get to the ball as it is met contests the
 // touch (practice-duel.ts). Defenders off balance (just beaten, wrongfooted, recovering) cannot.
 const receptionDuel=(p:PracticePlayer,body:PracticePlayer,old:ReadonlyMap<string,Vec>,frac:number,point:Vec,relativeSpeed:number):(DuelResult&{defenderAt:Vec;closing:number})|null=>{
  const goal={x:world(p.side,L),y:0},ballNow={x:ball.x,y:ball.y,vx:ball.vx,vy:ball.vy};
  let best:{q:PracticePlayer;at:Vec&{vx:number;vy:number};geo:ReturnType<typeof duelGeometry>}|null=null;
  for(const q of sidePlayers(other(p.side))){
   if(q.role==='GK'||q.duty==='wrongfoot'||time<(duelAfter.get(q.id)??0)||time<(wrongfoot.get(q.id)?.until??0)||time<(recovering.get(q.id)?.until??0))continue;
   const o=old.get(q.id)??q,at={x:o.x+(q.x-o.x)*frac,y:o.y+(q.y-o.y)*frac,vx:q.vx,vy:q.vy};
   if(dist(at,point)>2.8)continue;
   const geo=duelGeometry(body,at,ballNow,goal);
   if(geo.press>0&&(!best||geo.press>best.geo.press))best={q,at,geo};
  }
  if(!best)return null;
  const d=best.q,toGoal=unit(goal.x-body.x,goal.y-body.y);
  const cover=sidePlayers(d.side).filter(c=>c.id!==d.id&&c.role!=='GK'&&dist(c,body)<10&&(c.x-body.x)*toGoal.x+(c.y-body.y)*toGoal.y>1).length;
  const read=readDuel(body,d,best.geo,cover,dangerAt(body,goal),point,time,relativeSpeed);
  const result=resolveDuel(body,d,read,relativeSpeed,Math.max(0,score[p.side]-score[d.side]),duelDraw,point,time);
  if(record)receptionDuels.push({time,receiver:p.id,defender:d.id,outcome:result.outcome,commit:result.commit,layoff:result.layoff,access:result.access,screen:result.screen,front:result.front,goalTight:result.goalTight,closing:result.closing,nick:result.nick,seenNick:result.seenNick,flight:time-releaseAt,from:releaseFrom?{...releaseFrom}:undefined,at:{x:body.x,y:body.y},defenderAt:{x:best.at.x,y:best.at.y}});
  return {...result,defenderAt:{x:best.at.x,y:best.at.y}};
 };
 // (contest round) a forced receiver's first-time lay-off: a safe pass that does not go forward, which his foot can play
 // now, and not through the man on him (whose legs are right there)
 const layOff=(p:PracticePlayer,body:PracticePlayer,state:TouchControl,opponents:PracticePlayer[],man:Vec):Option|undefined=>{
  const runs=new Set(players.filter(q=>q.duty==='run').map(q=>q.id));
  const clearOfMan=(aim:Vec)=>{const u=unit(aim.x-ball.x,aim.y-ball.y);return contact(ball,{x:ball.x+u.x*2,y:ball.y+u.y*2},man,man,.55)===null;};
  return footballOptions(body,players,runs,releaseBy,0,null,time,support).filter(o=>o.kind==='pass'&&!!o.target&&depth(p.side,o.aim.x)<=depth(p.side,body.x)+1&&(o.pass?.risk??laneRisk(p,o.aim,opponents,22))<.32&&clearOfMan(o.aim)&&controlStrikeReady(body,ball,state,o.aim,'pass')).sort((a,b)=>b.score-a.score)[0];
 };
 const decision=(p:PracticePlayer,kind:Duty,reason:string)=>{
  const latest=lastChoice.get(p.id),job=coordination?.jobs[p.id];
  const assignment=job?`${job.purpose}:${job.target??''}:${job.since}`:undefined;
  if(latest?.kind!==kind||latest.reason!==reason||latest.assignment!==assignment){
   choices.push({time,player:rosterIndex.get(p.id)!,kind,reason,...(job?{assignment:{purpose:job.purpose,since:job.since,until:job.until,target:job.target,aim:{...job.aim}}}:{})});
   lastChoice.set(p.id,{kind,reason,assignment});
  }
  p.duty=kind;p.job=dutyNames[kind];
 };
 const frame=()=>{if(record)frames.push({time,half,cut:cut||undefined,lineup,players:players.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,angle:p.angle,energy:p.energy,duty:p.duty})),ball:{...ball},score:[...score],event:events.length-1,restart:!!restart,restartInfo:restart?{kind:restart.kind,side:restart.side,spot:{...restart.spot},taker:restart.taker,phase:restart.phase}:undefined,side,control:ball.owner&&!restart&&!inHands?{owner:ball.owner,feet:controlFor(get(ball.owner)).feet.map(f=>({...f}))}:undefined});needsFrame=false;cut=false;};
 // (receive round) Team-mates' bodies cannot overlap (TEAM_GAP): after everyone has moved, a pair of team-mates closer
 // than that is pushed apart along the line between them, and the part of their runs that closes them is taken off, so
 // they slide past each other instead of pressing in again. The man on the ball holds his ground; otherwise both give
 // way equally. Nobody is pushed further out than he already was: the touchline brake keeps him .3 m inside the lines.
 const separateTeamMates=()=>{
  const keepIn=(p:PracticePlayer,x:number,y:number)=>{p.x=clamp(p.x,Math.min(.3,x),Math.max(L-.3,x));p.y=clamp(p.y,Math.min(-W/2+.3,y),Math.max(W/2-.3,y));};
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
   const a=players[i],b=players[j];if(a.side!==b.side)continue;
   const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=TEAM_GAP)continue;
   // exactly on top of each other: part them across the pitch, the later-listed man to the right of his attack
   const nx=d>1e-6?dx/d:0,ny=d>1e-6?dy/d:sign(a.side),push=TEAM_GAP-d;
   const share=a.id===ball.owner?0:b.id===ball.owner?1:.5,ax=a.x,ay=a.y,bx=b.x,by=b.y;
   a.x-=nx*push*share;a.y-=ny*push*share;b.x+=nx*push*(1-share);b.y+=ny*push*(1-share);keepIn(a,ax,ay);keepIn(b,bx,by);
   const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
   if(closing<0){a.vx+=nx*closing*share;a.vy+=ny*closing*share;b.vx-=nx*closing*(1-share);b.vy-=ny*closing*(1-share);}
  }
 };
 // (duel recovery, 2026-10-16) what a duel did to a player's balance (practice-balance): no challenge of his own and
 // no controlled touch until he has his feet again; knocked down, he lies where he fell (his speed mostly gone) and
 // nobody counts on him for the ball until he is up. `against`: the other man in the duel (where he recovers to).
 // `loose`: the duel left the ball loose at his feet. Until he can touch it nobody, on either side, reads him as the
 // man who gets there first (recovering keeps him out of the race for it): before, the defence saw the tackled man
 // nearest, left the ball to him, and he collected it the moment he could (a tackle that won nothing).
 const unbalance=(p:PracticePlayer,b:Balance,against:string,loose=false)=>{
  duelAfter.set(p.id,Math.max(duelAfter.get(p.id)??0,time+b.challenge));
  if(b.touch>0)duelAfter.set('touch:'+p.id,Math.max(duelAfter.get('touch:'+p.id)??0,time+b.touch));
  const out=b.down>0?b.down:loose?b.touch:0;
  if(out>0)recovering.set(p.id,{until:Math.max(recovering.get(p.id)?.until??0,time+out),opponent:against});
  if(b.down>0){downs.set(p.id,time+b.down);p.vx*=FALL_KEEP;p.vy*=FALL_KEEP;}
 };
 const isDown=(id:string)=>time<(downs.get(id)??0);
 const own=(p:PracticePlayer,kind:'receive'|'turnover'|'save'|'silent'='receive',hands=false)=>{
  feintMemory.delete(p.id);
  playbook=bookFor(p.side);const arrivingPass=ball.mode==='pass';coaching?.receive(time,p,releaseBy,arrivingPass);playbook?.received(time,p,releaseBy,arrivingPass,players,ball);if(arrivingPass&&kind==='receive'&&releaseBy&&get(releaseBy).side===p.side){completedPass={from:releaseBy,to:p.id,at:time};
   const clock=recycle[p.side],reached=depth(p.side,p.x);if(clock.max<0)clock.max=releaseFrom?depth(p.side,releaseFrom.x):reached;
   if(reached>=clock.max+PROGRESS_METRES){clock.count=0;clock.max=reached;}else{clock.count++;clock.max=Math.max(clock.max,reached);}}
  const lost=side!==p.side;if(lost)resetClock();
  // (regain fixes) an opponent who lost it to this man at close quarters a moment ago is off balance too
  // (duel recovery) unless the duel that took it already set his recovery, what it cost him follows the contact: a ball
  // knocked off him or a kick blocked at his feet costs him his step (and a kick's follow-through); a man arriving into
  // his body at speed, more
  if(lost&&kind==='turnover'&&dispossessed&&!dispossessed.settled&&time-dispossessed.at<=BEATEN_WINDOW){const q=byId.get(dispossessed.id);if(q&&q.side!==p.side&&dist(q,p)<BEATEN_NEAR){
   const toQ=unit(q.x-p.x,q.y-p.y),closingSpeed=Math.max(0,(p.vx-q.vx)*toQ.x+(p.vy-q.vy)*toQ.y);
   const hit=felt(contactLoad({closingSpeed,ballFirst:true,leg:false,collision:dist(q,p)<.6}),p,q);
   unbalance(q,struck(q,hit,hit>0?balanceDraw():1,dispossessed.kick?KICK_FOLLOW:0),p.id);}}
  dispossessed=null;side=p.side;if(lost){support=null;completedPass=undefined;passContinuation=undefined;transitionAt=time;stats[p.side].turnovers++;intents.clear();assignmentAt=0;lapses.clear();}
  // A new receiver changes the threat even when possession stays with the same team.
  assignmentAt=0;for(const q of players)if(q.side!==p.side)intents.delete(q.id);
  challenge=null;
  actionReasons.delete(p.id);carryPlan=null;dives.delete(p.id);groundDelivery=false;aerialDelivery=false;inHands=hands;keeperStep=null;keeperLook=null;keeperRelook=false;
  const expected=arrivingPass&&(intended===p.id||flight.receiver===p.id);
  watchedFlight=arrivingPass?clamp(time-releaseAt,0,1):0;
  ball.owner=p.id;ball.mode='control';if(hands){ball.vx=p.vx;ball.vy=p.vy;ball.z=1;ball.vz=0;}receivedAt=time;
  if(lost)for(const b of playbooks){if(p.side===b.config.side)b.recover(time,p,players,laneRisk,ball);else b.end(time,'loss');}
  // The intended receiver has been watching this pass. Do not force half a
  // second of blind forward dribbling before considering the next action.
  nextThink=time+(expected?.06+(10-p.skills.reading)*.008:.1+(10-p.skills.reading)*.012);
  const state=controlFor(p);state.owner=p.id;state.time=time;
  if(hands)noteTouch(p.id);
  firstTouch=lost&&!inHands?{owner:p.id,aim:recoveryTouch(p,players)}:null;
  carry=firstTouch?.aim??inside({x:p.x+sign(p.side)*5,y:p.y});prepared=null;flags=[];lastTouch=p.id;exempt=false;mustRelease=false;restrictedGoal=false;restartKicker='';
  if(kind==='receive'){if(arrivingPass&&releaseBy!==p.id&&get(releaseBy).side===p.side)stats[p.side].completed++;lastFrom=releaseBy;say('receive',`${p.name} preia și caută continuarea.`,p);}
  else if(kind==='turnover')say('turnover',`${p.name} recuperează. ${f.teams[p.side].name} poate pleca acum!`,p);
  else if(kind==='save'){stats[p.side].saves++;say('save',`${p.name} prinde mingea. Ridică imediat privirea.`,p);}
 };
 /** How soon a man on the ball looks again once he has chosen (B2): sooner when it is urgent near our goal or a shot is
  * opening, and before the man closing him arrives (lookAgain). */
 const lookCadence=(p:PracticePlayer,o:Option)=>Math.min(possessionSafety(p,players).urgency>.25||(o.delivery?.shotGain??0)>.1?.16:.38+random()*.18,lookAgain(p,players,time));
 const releaseOption=(p:PracticePlayer,o:Option,firstTime=false,aerial?:{technique:'header'|'volley';plan:AerialKick}):boolean=>{
     if(bookFor(p.side)&&!bookFor(p.side)!.canRelease(time,p,o,players,ball,support)){prepared=null;nextThink=time;return false;}
     // A prepared foot shot can become obsolete between decision ticks (for
     // example, the keeper recovers). Reuse the ordinary reconsideration margin
     // at release; comparable alternatives do not undo commitment. First-time
     // strikes already recheck at reception, and set pieces/aerials have their
     // own evaluations. A new choice still needs its normal preparation/contact.
     if(o.kind==='shoot'&&!firstTime&&!aerial&&!restart){
      const available=footballOptions(p,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));
      const current=available.find(q=>q.kind==='shoot');
      if(!current||Math.max(...available.map(q=>q.score))>current.score+.18){prepared=null;nextThink=time;return false;}
      o=current;
     }
     // (receive round) A clearance is re-read at the strike as a prepared kick is while he sets it (closedRelease): a man
     // who has stepped into its first metres would take it, so unless nothing he can do is clearly better (the same 0.18
     // margin) he chooses again: another clearance, carrying it out, or protecting it.
     if(o.kind==='clear'&&!firstTime&&!aerial&&!restart&&kickBlocked(p,o,players,0)){
      const available=footballOptions(p,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));
      const current=available.filter(q=>q.kind==='clear').sort((a,b)=>dist(a.aim,o.aim)-dist(b.aim,o.aim))[0];
      if(!current||Math.max(...available.map(q=>q.score))>current.score+.18){prepared=null;nextThink=time;return false;}
     }
     const takingRestart=restart;
     const shot=o.kind==='shoot',clear=o.kind==='clear',target=o.target?get(o.target):null,passer=restart&&(restart.kind==='freeKick'||restart.kind==='indirect')?setPiecePlayer(p):p;
     if(!aerial&&(o.loft||o.pass)&&o.receivingSpace&&target){
      const run=activePassRun(support,p,target,time),fresh=o.kind==='loft'?loftPass(passer,target,run,ball,sidePlayers(other(p.side)),o.receivingSpace,o.loft?.meetingTime,o.loft?.kind):groundPass(passer,target,o.kind==='through',run,ball,sidePlayers(other(p.side)),o.receivingSpace,o.pass?.meetingTime,o.pass?.weight);
      if(!run||dist(fresh.aim,o.receivingSpace)>o.receivingSpace.radius+.1||fresh.risk>.62||fresh.reachMargin<-.7){prepared=null;nextThink=time;return false;}
     }
     const pressure=clamp((5-Math.min(...sidePlayers(other(p.side)).map(q=>dist(q,p))))/5,0,1);
     const shotRead=shot&&!o.freeKick?assessShot(p,players):undefined;
     let aim:Vec,groundStrike:ReturnType<typeof strikeGroundPass>|undefined,loftStrike:ReturnType<typeof strikeLoftPass>|undefined,throwStrike:ReturnType<typeof strikeThrow>|undefined;
     if(aerial){aim=aerial.plan.aim;if(shot)stats[p.side].shots++;else if(clear)stats[p.side].clearances++;else stats[p.side].passes++;}
     else if(takingRestart?.kind==='throw'){throwStrike=strikeThrow(p,ball,o.throwLead?{...target!,...o.throwLead,vx:0,vy:0}:target!,pressure,execution,sidePlayers(other(p.side)));aim=throwStrike.aim;stats[p.side].passes++;}
     else if(shot){aim=o.freeKick?.aim??shotRead!.aim;stats[p.side].shots++;}
     else if(clear){aim=o.aim;stats[p.side].clearances++;}
     else if(o.kind==='loft'){o.run=o.teachingStep&&!o.teachingSpace?undefined:activePassRun(support,p,target!,time);loftStrike=strikeLoftPass(passer,ball,target!,o.run,pressure,execution,sidePlayers(other(p.side)),o.receivingSpace,o.loft?.meetingTime,o.loft?.kind);aim=loftStrike.aim;stats[p.side].passes++;}
     else {o.run=o.kind==='through'?activePassRun(support,p,target!,time):undefined;groundStrike=strikeGroundPass(passer,ball,target!,o.kind==='through',o.run,pressure,execution,sidePlayers(other(p.side)),o.receivingSpace,o.pass?.meetingTime,o.pass?.weight);aim=groundStrike.aim;stats[p.side].passes++;}
     flags=exempt?[]:offsidePlayers(players,p.side,ball).filter(id=>id!==p.id);exempt=false;
     // (keeper upgrade) how hurried the shot is; a hurried foot shot is placed towards the keeper (placeHurried). (Contest,
     // 2026-10-15) the hurry is the contest at the strike (practice-shot-contest shotContest), and off balance it is struck softer too
     const contest=shot&&!o.freeKick?shotContest(p,players,aerial?aerial.plan.aim:shotRead!.aim,{firstTime,sinceDuel:p.duelAt===undefined?undefined:time-p.duelAt}):undefined;
     const theirKeeper=shot?sidePlayers(other(p.side)).find(q=>q.role==='GK'):undefined,hurry=contest?.hurry??0;
     if(shotRead&&!aerial&&hurry>0){shotRead.aim=placeHurried(shotRead.aim,theirKeeper,hurry);aim=shotRead.aim;}
     const strike=aerial?strikeAerial(p,ball,aerial.technique,aerial.plan,pressure,execution):throwStrike?{vx:throwStrike.vx,vy:throwStrike.vy,vz:throwStrike.vz}:o.freeKick?strikeFreeKick(p,ball,o.freeKick,execution):shot?strikeShot(p,ball,shotRead!,execution,hurry,contest?.offBalance??0):clear?strikeClearance(p,ball,aim,pressure,execution,o.clearance??'long'):groundStrike?{vx:groundStrike.vx,vy:groundStrike.vy,vz:0}:{vx:loftStrike!.vx,vy:loftStrike!.vy,vz:loftStrike!.vz};
     // The receiver may have moved since selection. Only deviation from the
     // freshly planned, unperturbed aim is error; a new lead is not a mishit.
     const intendedAim=groundStrike?.plan.aim??loftStrike?.plan.aim??aim;
     if(!aerial&&!restart&&!inHands&&!strikeControl(p,ball,controlFor(p),intendedAim,strike,shot?'shot':clear?'clearance':'pass')){
      if(shot)stats[p.side].shots--;else if(clear)stats[p.side].clearances--;else stats[p.side].passes--;return false;
     }else{
     if(!restart&&!inHands)collectContacts(controlFor(p));
     if(inHands)noHandsKeeper=p.id;
     noHandsSide=aerial?.technique==='header'?null:takingRestart?.kind==='throw'||target?.role==='GK'&&!shot&&!clear?p.side:null;
     const throwing=takingRestart?.kind==='throw',strikeFrom={x:ball.x,y:ball.y};
     ball={...ball,owner:null,mode:shot?'shot':clear?'loose':'pass',...strike,z:throwing?1.8:restart||inHands?(shot&&!o.freeKick?.12:0):ball.z};groundDelivery=!!groundStrike&&!throwing;aerialDelivery=!!aerial||!!loftStrike||throwing;
     inHands=false;duelAfter.set('touch:'+p.id,time+(shot?.6:.3));
     // Recheck the continuation against the actual delivery, after preparation
     // and receiver movement. A selection-time opening may already be gone.
     const connection=!shot&&!clear&&target&&!takingRestart?readDelivery(p,target,intendedAim,players,groundStrike?.plan.risk??loftStrike?.plan.risk??0,laneRisk,groundStrike?.plan.flight??loftStrike?.plan.flight??0,{support,time}):undefined;
     passContinuation=connection?.continuation?{from:p.id,to:target!.id,...connection.continuation,until:time+Math.min(3.5,(groundStrike?.plan.flight??loftStrike?.plan.flight??0)+1.2)}:undefined;
     if(shot)resetClock(p.side);releaseFrom={x:strikeFrom.x,y:strikeFrom.y};
     // (keeper upgrade) their keeper's edge against this shot: how set he is at the strike (still, facing the ball, at
     // his ready spot) and how hurried it is (practice-football keeperEdge)
     if(shot&&theirKeeper){
      const k=theirKeeper,ready=keeperReadyPosition(k,ball,false),face=(Math.cos(k.angle)*(ball.x-k.x)+Math.sin(k.angle)*(ball.y-k.y))/Math.max(.01,dist(k,ball));
      const set=clamp(1-Math.hypot(k.vx,k.vy)/SET_STILL,0,1)*clamp(face+SET_FACING,0,1)*clamp(1-dist(k,ready)/SET_SPOT,0,1);
      shotEdge={id:k.id,...keeperEdge(set,hurry,k.skills.keeping)};
     }
     releaseBy=p.id;releaseAt=time;dispossessed={id:p.id,at:time,kick:true};intended=target?.id??'';lastTouch=p.id;prepared=null;reception=null;flight={hunters:[],meetings:{},coverer:''};assignmentAt=0;if(mustRelease)restartKicker=p.id;mustRelease=false;intercepts.clear();
     bookFor(p.side)?.released(time,p,o);coaching?.release(time,p,o);
     say(shot?'shot':clear?'clearance':'pass',shot?o.freeKick?`${p.name} execută direct lovitura liberă!`:`${p.name} încearcă poarta!`:clear?`${p.name} îndepărtează mingea din zona periculoasă!`:loftStrike?`${p.name} ${loftStrike.plan.kind==='chip'?'strecoară o pasă săltată':'ridică mingea peste linie'} pentru ${target!.name}${o.run?', care atacă spațiul':''}.`:o.delivery?.kind==='cutback'?`${p.name} întoarce mingea din lateral pentru ${target!.name}.`:o.delivery?.kind==='square'?`${p.name} trimite în fața porții pentru ${target!.name}.`:o.kind==='through'?`${p.name} trimite în spațiu pentru ${target!.name}.`:`${p.name} pasează către ${target!.name}.`,p,target??undefined);
     if(shot)events.at(-1)!.shot={aim:{...aim},origin:{x:ball.x,y:ball.y,z:ball.z},velocity:{vx:ball.vx,vy:ball.vy,vz:ball.vz},...(!aerial&&shotRead?{assessment:{...shotRead,aim:{...shotRead.aim}}}:{}),...(contest?{contest:{rush:contest.rush,shadow:contest.shadow,balance:contest.balance,poise:contest.poise,hurry:contest.hurry,...(contest.closer?{closer:contest.closer}:{})}}:{})};
     if(firstTime){const event=events.at(-1)!;event.firstTime=true;event.text=shot?`${p.name} șutează din prima!`:clear?`${p.name} respinge din prima.`:`${p.name} trimite din prima către ${target!.name}.`;}
     if(aerial){const event=events.at(-1)!;event.technique=aerial.technique;event.text=shot?`${p.name} încearcă poarta ${aerial.technique==='header'?'cu capul':'din voleu'}!`:clear?`${p.name} respinge ${aerial.technique==='header'?'cu capul':'din voleu'}.`:`${p.name} trimite ${aerial.technique==='header'?'cu capul':'din voleu'} către ${target!.name}.`;}
     if(o.freeKick)events.at(-1)!.freeKick={...o.freeKick,aim:{...o.freeKick.aim}};
     if(groundStrike)events.at(-1)!.pass={meetingTime:groundStrike.plan.meetingTime,weight:groundStrike.plan.weight,aim:{...aim},intendedSpeed:groundStrike.plan.speed,actualSpeed:Math.hypot(strike.vx,strike.vy),arrivalSpeed:groundStrike.plan.arrivalSpeed};
     if(loftStrike)events.at(-1)!.aerial={meetingTime:loftStrike.plan.meetingTime,kind:loftStrike.plan.kind,aim:{...aim},intendedSpeed:loftStrike.plan.speed,actualSpeed:Math.hypot(strike.vx,strike.vy),intendedVz:loftStrike.plan.vz,actualVz:strike.vz,flight:loftStrike.plan.flight,apex:loftStrike.plan.apex,risk:loftStrike.plan.risk};
     if(takingRestart){Object.assign(events.at(-1)!,{restartKind:takingRestart.kind,restartSpot:{...takingRestart.spot},restartPlayers:players.map(q=>({id:q.id,x:q.x,y:q.y,vx:q.vx,vy:q.vy}))});if(takingRestart.live){coordination=takingRestart.live.plan;if(coordination.anchors)coordination.anchors={...coordination.anchors,until:time+SET_PIECE_HOLD};}if(takingRestart.authored)playbooks.find(b=>b.config.side===takingRestart.side)?.restartTaken(time,players);restart=null;intents.clear();}
      return true;
     }
 };
 const applySubstitutions=()=>{
  if(options.substitutions!=='planned')return;
  for(const team of [0,1] as Side[])while(subCounts[team]<SUB_MINUTES.length&&time>=SUB_MINUTES[subCounts[team]]*60){
   const change=chooseReplacement(f.teams[team],sidePlayers(team),used);if(!change){subCounts[team]=SUB_MINUTES.length;break;}
   const {outgoing,incoming}=change,source=structuredClone(incoming) as Player&{archetype?:string;temperament?:string};
   // keeper formulas only for a keeper, as in the triggered path (applyOrders) and practicePlayers
   const gk=outgoing.role==='GK',basePace=gk?4.5+source.skills.pace*.34:4.75+source.skills.pace*.35;
   const replacement:PracticePlayer={...outgoing,...source,id:`${team}:${source.id}`,role:outgoing.role,lane:outgoing.lane,side:team,
    number:f.teams[team].squad.findIndex(q=>q.id===source.id)+1,archetype:source.archetype??'',temperament:source.temperament??'',
    vx:0,vy:0,basePace,pace:basePace*(.7+.3*source.energy/100),acceleration:gk?3.1+source.skills.pace*.19:3.5+source.skills.pace*.22,duty:'restart',job:'Intră în joc'};
   players[players.indexOf(outgoing)]=replacement;byId.set(replacement.id,replacement);used.add(replacement.id);subCounts[team]++;
   rosterIndex.set(replacement.id,roster.length);roster.push(structuredClone(replacement));lineup=players.map(p=>rosterIndex.get(p.id)!);
   say('substitution',`${f.teams[team].name}: ${outgoing.name} iese, ${replacement.name} intră cu energie proaspătă.`,replacement,outgoing);
   Object.assign(events.at(-1)!,{incoming:replacement.id,outgoing:outgoing.id});cut=true;
  }
 };
 // Triggered orders: checked only at stoppages, never at the opening kickoff.
 // Order ties resolve in list order; each order fires at most once.
 const orderNotes:SubstitutionNote[]=orders.map(o=>({order:o.id,side:o.side,status:'waiting',in:o.in,...(o.out!==undefined?{out:o.out}:{}),detail:'Condiția nu a fost îndeplinită la nicio oprire a jocului.'}));
 const gone=new Set<string>(),madeCounts=[0,0];
 const applyOrders=()=>{
  if(!orders.length||time<=0)return;
  orders.forEach((order,i)=>{
   const note=orderNotes[i],team=order.side;
   if(note.status!=='waiting'||(order.notBefore??0)>time||!triggerHolds(order.trigger,team,time,duration,score,players))return;
   if(madeCounts[team]>=MAX_TRIGGERED_SUBSTITUTIONS){Object.assign(note,{status:'impossible',detail:'Echipa a făcut deja toate schimbările.'});return;}
   const decision=resolveOrder(order,f,players,gone);
   if('wait' in decision){note.detail=decision.wait;return;}
   if('impossible' in decision){Object.assign(note,{status:'impossible',time,detail:decision.impossible});return;}
   const outgoing=decision.outgoing,source=structuredClone(f.teams[team].squad.find(p=>p.id===order.in)!) as Player&{archetype?:string;temperament?:string};
   const gk=outgoing.role==='GK',basePace=gk?4.5+source.skills.pace*.34:4.75+source.skills.pace*.35;
   // Same role/lane/slot number: slot-addressed plans and standing instructions pass to the newcomer.
   const replacement:PracticePlayer={...outgoing,...source,id:`${team}:${source.id}`,role:outgoing.role,lane:outgoing.lane,side:team,number:outgoing.number,
    archetype:source.archetype??'',temperament:source.temperament??'',vx:0,vy:0,basePace,pace:basePace*(.7+.3*source.energy/100),
    acceleration:gk?3.1+source.skills.pace*.19:3.5+source.skills.pace*.22,duty:'restart',job:'Intră în joc'};
   players[players.indexOf(outgoing)]=replacement;byId.set(replacement.id,replacement);used.add(replacement.id);gone.add(outgoing.id);madeCounts[team]++;
   for(const [id,target] of [...marks])if(id===outgoing.id||target===outgoing.id)marks.delete(id);
   rosterIndex.set(replacement.id,roster.length);roster.push(structuredClone(replacement));lineup=players.map(p=>rosterIndex.get(p.id)!);
   const own:[number,number]=[score[team],score[other(team)]],reason=triggerText(order.trigger,outgoing.name);
   say('substitution',`${f.teams[team].name}: ${outgoing.name} iese, ${replacement.name} intră (${reason}).`,replacement,outgoing);
   Object.assign(events.at(-1)!,{incoming:replacement.id,outgoing:outgoing.id,substitution:{order:order.id,trigger:structuredClone(order.trigger),energy:outgoing.energy,score:own}});cut=true;
   Object.assign(note,{status:'made',time,out:outgoing.id.slice(2),detail:`${outgoing.name} → ${replacement.name}: ${reason}.`});
  });
 };
 const startRestart=(kind:Restart['kind'],team:Side,spot:Vec,opening?:{taker:string;force:boolean})=>{
  for(const b of playbooks)b.end(time,'restart');
  // A stoppage after full time ends the match: nobody comes on for no seconds.
  if(!lastAttack){applySubstitutions();applyOrders();}
  awareness.clear();coordination=null;
  feintMemory.clear();
  challenge=null;firstTouch=null;recovering.clear();blocks.clear();wrongfoot.clear();dives.clear();controls.clear();noHandsSide=null;noHandsKeeper='';
  if(kind==='penalty')spot={x:world(team,L-SPOT),y:0};
  if(kind==='indirect'&&depth(team,spot.x)>(L-3)&&Math.abs(spot.y)<=4.5)spot={x:world(team,(L-3)),y:spot.y};
  spot={x:clamp(spot.x,1,(L-1)),y:clamp(spot.y,-(W/2-0.3),(W/2-0.3))};
  // A manager's routine for this restart names its own taker and spots.
  // Clubs without one never reach this draw (byte parity).
  // The engine's own taker is known first: a routine's designated taker too
  // far from the ball (and every thrower) gives way to him.
  const book=coordinated&&liveRestart(kind)?playbooks.find(b=>b.config.side===team):undefined;
  const candidates=sidePlayers(team).filter(p=>kind==='goalKick'?p.role==='GK':p.role!=='GK');
  const engineTaker=opening?get(opening.taker):kind==='freeKick'||kind==='indirect'?chooseFreeKickTaker(players,team,spot,f.teams[team].tactics.taker,kind):kind==='penalty'?choosePenaltyTaker(players,team,f.teams[team].tactics.taker):candidates.slice().sort((a,b)=>dist(a,spot)-dist(b,spot))[0];
  const authored=book?.chooseRoutine(time,kind,team,spot,players,laneRisk,!!opening?.force,engineTaker.id)??null;
  const taker=authored?get(authored.taker):engineTaker;
  transitionAt=-10;inHands=false;groundDelivery=false;aerialDelivery=false;carryPlan=null;defense=null;support=null;teamShapes=[null,null];completedPass=undefined;passContinuation=undefined;restart={kind,side:team,spot,taker:taker.id,ready:time+(kind==='kickoff'?5:2),phase:'gather',legalSince:null,organized:coordinated,positions:restartPositions(kind,team,spot,taker.id,players,coordinated,f.teams[team].tactics.setPiece),...(coordinated&&(kind==='freeKick'||kind==='indirect')&&(f.teams[team].tactics.setPiece==='short'||f.teams[team].tactics.setPiece==='delivery')?{call:f.teams[team].tactics.setPiece}:{})};if(coordinated&&liveRestart(kind)){restart.routine=restartRoutine(restart,players,restart.positions,f.teams[team].tactics.setPiece);restart.live=null;}
  if(authored&&restart.routine){restart.routine=authoredRoutine(restart.routine,authored.slots);for(const [id,s] of Object.entries(authored.slots))restart.positions[id]={...s.aim};restart.authored=book!.routineId;}
  resetClock();restartAssignAt=0;side=team;ball={...ball,...spot,vx:0,vy:0,z:0,vz:0,owner:null,mode:'loose'};prepared=null;feint=null;flags=[];intents.clear();presser='';coverer='';assignmentAt=0;restartKicker='';lapses.clear();
 };
 const resolveExit=(before:Vec&{z?:number}):boolean=>{
  const exit=pitchExit(before,ball);if(!exit)return false;
  const last=get(lastTouch||releaseBy),crossY=exit.y;
  if(exit.endLine&&!restrictedGoal&&Math.abs(crossY)<GH&&(exit.z??ball.z)<HEIGHT){
   const scorer:Side=exit.x>(L/2)?0:1;score[scorer]++;stats[scorer].goals++;
   say('goal',`GOOOL pentru ${f.teams[scorer].name}! Pe margine se sare de pe scaune.`,last);Object.assign(events.at(-1)!,{side:scorer,lastTouch:last.id});startRestart('kickoff',other(scorer),{x:(L/2),y:0});
  }else if(exit.endLine){
   const defending:Side=exit.x<(L/2)?0:1,corner=last.side===defending;
   say('out',corner?'Mingea iese dintr-un apărător. Corner.':'Mingea trece de linia porții. Repunere pentru portar.');
   startRestart(corner?'corner':'goalKick',corner?other(defending):defending,{x:exit.x<(L/2)?corner?1:3:corner?(L-1):(L-3),y:corner?(crossY<0?-(W/2-.5):(W/2-.5)):0});
  }else {say('out','Mingea iese în lateral. Se pregătește repunerea.');startRestart('throw',other(last.side),{x:clamp(exit.x,1,(L-1)),y:crossY<0?-(W/2-.5):(W/2-.5)});}
  return true;
 };
 const defensiveLine=(_team:Side)=>L;
 // A defending keeper reads each new ball once his reaction time has passed,
 // and drops a sweep the moment somebody controls the ball, shoots, or plays it on.
 const keeperRereads=(p:PracticePlayer,intent:Intent)=>intent.kind==='sweep'?!!ball.owner||ball.mode==='shot'||intent.release!==releaseAt:
  !ball.owner&&ball.mode!=='shot'&&intent.release!==releaseAt&&time-releaseAt>=.2+(10-p.skills.reading)*.015;
 const offball=(p:PracticePlayer):Intent=>{
  const t=tacticsFor(p.side),ownTeam=side===p.side,bd=depth(p.side,ball.x),pd=depth(p.side,p.x),laneY=p.lane*(p.role==='FB'||p.role==='W'?t.width==='narrow'?Y(21):Y(27):p.role==='CB'?Y(10):Y(13)),owner=ball.owner?get(ball.owner):null;
  const structure=teamShapes[p.side],slot=structure?.slots[p.id];
  let kind:Duty='hold',x=X(24),y=laneY,speed=p.pace*.64,reason='Ține poziția și protejează spațiul periculos.',refresh=0;
  if(p.role==='GK'){
   const sweep=clamp(p.traits.keeperSweep??.2,0,1);
   // A keeper facing an attack keeps setting himself against the ball he
   // sees (coordinated policy): he re-reads every assignment tick, and while
   // an opponent's pass travels he sets against where it is heading (its
   // visible flight a moment ahead), not where it was when he last looked.
   const tracking=coordinated&&!ownTeam;
   // How well he does it is his own (R2, keeperRead): the cadence, how far
   // ahead he reads a pass's flight, and how exactly he finds the angle.
   const read=keeperRead(p,ball,time),lead=tracking?read.lead:0;
   const seen=tracking&&!owner&&ball.mode==='pass'?{...ball,x:ball.x+ball.vx*lead,y:ball.y+ball.vy*lead}:ball;
   if(tracking)refresh=read.reread;
   // (keeper upgrade) a carrier through on goal, nobody of ours goal-side of him: he comes off his line to meet him
   const oneOnOne=!ownTeam&&!!owner&&!sidePlayers(p.side).some(q=>q.role!=='GK'&&depth(p.side,q.x)<depth(p.side,owner.x)-.5&&Math.abs(q.y-owner.y*(depth(p.side,q.x)/Math.max(.5,depth(p.side,owner.x))))<GH+1);
   const set=keeperReadyPosition(p,seen,!ownTeam&&!!owner,oneOnOne),position=tracking?{x:set.x,y:clamp(set.y+read.offset,-GH+.18,GH-.18)}:set;kind='keeper';x=Math.max(.3,(ownTeam?X(7)+bd*.035:depth(p.side,position.x))+keeperSweepDepth(sweep,bd,ownTeam));y=ownTeam?clamp(ball.y*.15,-G(3.2),G(3.2)):position.y;speed=p.pace*(!ownTeam&&bd<X(23)?.9:.55);reason='Își potrivește poziția cu mingea și păstrează poarta acoperită.';
   // Behaviour round A: defending, he plays off his back line (keeperLineDepth),
   // and comes for a ball as far beyond where he usually stands as he now stands.
   let higher=0,lastLine=Infinity;const setDepth=depth(p.side,position.x);
   if(tracking){const usual=x;lastLine=Math.min(...sidePlayers(p.side).filter(q=>q.role!=='GK').map(q=>depth(p.side,q.x)));x=Math.max(x,keeperLineDepth(sweep,lastLine,bd));
    // (keeper fix, 2026-10-19) He takes his place from where the attack is heading, not from where his back line
    // stands: the height his habit wants (a sweeper's extra metres, following his back line) only as far as he can
    // still drop and be set before the opponents could get a shot away (attackTime: the ball carried or passed into
    // range, or played to a man nearer goal). With their ball deep and nobody near his goal a sweeper still stands
    // high; as the attack comes on, or a man waits nearer goal, he comes back. (The study: after a loss 16 m or more
    // out he was more than 2 m off his ready spot when the ball first came within 16 m 70% of the time as a sweeper,
    // 23% at the default trait, and further off the longer it went on.)
    const attackIn=attackTime(p.side,seen,sidePlayers(other(p.side)).filter(q=>q.role!=='GK'),owner);
    x=Math.min(x,setDepth+keeperGiveBack(p,attackIn));higher=Math.max(0,x-usual);
    // ... and he gets there at a real run when he is out of place, sideways included: as fast as being set on his spot
    // before that shot needs (it was a 0.55 jog whenever the ball was 10.5 m+ away, with a sprint only when he was
    // 1.5 m deeper into the pitch than his target: 0.23-0.38 of his pace after a loss).
    speed=Math.max(speed,Math.min(p.pace,keeperRunSpeed(p,Math.hypot(depth(p.side,p.x)-setDepth,p.y-position.y),attackIn)));
    // Caught off his line as the ball comes into range: he sprints back to set himself.
    if(depth(p.side,p.x)>x+1.5)speed=Math.max(speed,p.pace*.9);
    // (keeper upgrade) he sees the shooter shape to shoot and sets himself for the strike: near his spot (SET_PLANT m)
    // he plants where he is, the earlier the better he reads it
    if(!ownTeam&&owner&&owner.side!==p.side&&prepared&&prepared.option.kind==='shoot'&&time>=prepared.at-(SET_READ+p.skills.reading*SET_READ_PER)&&Math.hypot(depth(p.side,p.x)-x,p.y-y)<SET_PLANT){x=depth(p.side,p.x);y=p.y;speed=p.pace*.3;}}
   // B3 (answering the long ball): a pass the defence reads being met behind
   // his last outfielder. The defence's own forecast of the flight (who meets
   // it first, when, where) is this tick's; the keeper reads it from there.
   const meet=tracking&&!ownTeam&&!ball.owner&&ball.mode==='pass'&&flight.observedMeeting&&flight.theirs!==undefined&&depth(p.side,flight.observedMeeting.x)<lastLine?flight.observedMeeting:undefined;
   if(meet){
    // While it is in the air he holds the depth he stands at rather than
    // drifting back to his line as the ball comes nearer (he still shuffles
    // across with its flight): he stays ready to come, and is not caught
    // going backwards when the man meets it (never past where that man meets it).
    // (and never deeper into the pitch than he stands with the ball far away)
    // (keeper fix, 2026-10-19) ... and only as high as he can still drop from and be set before the man who meets it
    // could shoot (he met it within 16 m with the keeper stranded high: the study's "caught high", 0.9 a match for a sweeper).
    const theirs=Math.max(0,flight.theirs!-(time-flightAt)),meetDepth=depth(p.side,meet.x);
    const standing=Math.min(depth(p.side,p.x),meetDepth-1.25,2.8+keeperSweepDepth(sweep,L,false)+higher,setDepth+keeperGiveBack(p,theirs+SHOT_SET+Math.max(0,meetDepth-SHOT_RANGE)/ATTACK_SPEED));
    if(standing>x){x=standing;reason='Mingea trece de apărare; își ține poziția, gata să iasă, în loc să se retragă pe linie.';}
    // He comes when he reads he is there first, or level if he is a sweeper
    // (keeperSweepNeed): his own reaction, his own pace, his own read.
    const samples=flightSamples(ball),meeting=flightMeeting(p,ball,Math.max(0,.2+(10-p.skills.reading)*.015-(time-releaseAt)),samples,time-releaseAt);
    const zone=(aerialDelivery?X(28):keeperSweepReach(sweep).range)+higher;
    if(meeting.reachable&&depth(p.side,meeting.aim.x)<zone){
     const since=time-flightAt,theirs=flight.theirs!-since,mate=(flight.defenders?.[0]?.score??Infinity)-since;
     const prior=intents.get(p.id),committed=prior?.kind==='sweep'&&prior.release===releaseAt;
     const lead=perceive(p,'keeper',theirs-meeting.time,SWEEP_READ_SPREAD,meeting.aim,{time,salt:'sweep'});
     if(lead>=keeperSweepNeed(sweep)-(committed?.25:0)&&!(mate<meeting.time-.4&&mate<theirs)){
      kind='sweep';x=depth(p.side,meeting.aim.x);y=meeting.aim.y;speed=p.pace;reason='Citește unde ajunge mingea în spatele apărării și iese să o ia înaintea atacantului.';
     }
    }
   }else if(!ownTeam&&!ball.owner&&ball.mode!=='shot'&&bd<40){
    if(aerialDelivery){
     const samples=flightSamples(ball),meeting=flightMeeting(p,ball,.2,samples,time-releaseAt),nearest=sidePlayers(other(p.side)).sort((a,b)=>dist(a,meeting.aim)-dist(b,meeting.aim)).slice(0,2);
     const opponent=Math.min(...nearest.map(q=>{const m=flightMeeting(q,ball,.12,samples);return m.reachable?m.time:Infinity;}));
     if(meeting.reachable&&depth(p.side,meeting.aim.x)<X(28)+higher&&meeting.time<opponent+(.1+sweep*.35)){
      kind='sweep';x=depth(p.side,meeting.aim.x);y=meeting.aim.y;speed=p.pace;reason='Citește unde coboară mingea și iese să ajungă înaintea atacantului.';
     }
    }else {
     // A ball along the ground: judged, like a high ball, by forecast arrival
     // where he would meet it against where the nearest attackers would. The
     // trait sets the head start he wants and how far out he goes; inside
     // his area he may use his hands, outside it his feet (the contact rules).
     const {margin,range}=keeperSweepReach(sweep),samples=flightSamples(ball);
     const meeting=flightMeeting(p,ball,Math.max(0,.2+(10-p.skills.reading)*.015-(time-releaseAt)),samples,time-releaseAt);
     if(meeting.reachable&&depth(p.side,meeting.aim.x)<range+higher){
      // Others' arrival: the earlier of the steered forecast and the coordinator's
      // arrival model (assignFlight), which credits a runner already moving onto
      // the ball; the keeper does not come on the chance that a runner is slow.
      const arrival=(q:PracticePlayer)=>{const m=flightMeeting(q,ball,.12,samples);
       const run=samples.find(s=>s.z<1.1&&s.x>=0&&s.x<=L&&Math.abs(s.y)<=W/2&&arrivalTime(q,s)<=s.time+.12);
       return Math.min(m.reachable?m.time:Infinity,run?.time??Infinity);};
      // Anybody who can cut the ball out on its way counts, not only players near his point.
      const outfield=(team:Side)=>sidePlayers(team).filter(q=>q.role!=='GK');
      const opponent=Math.min(...outfield(other(p.side)).map(arrival)),mate=Math.min(...outfield(p.side).map(arrival));
      // Once out he commits to this ball rather than turning back at the first doubt.
      const prior=intents.get(p.id),committed=prior?.kind==='sweep'&&prior.release===releaseAt;
      if(meeting.time<opponent+margin+(committed?.25:0)&&!(mate<meeting.time-.4&&mate<opponent)){
       kind='sweep';x=depth(p.side,meeting.aim.x);y=meeting.aim.y;speed=p.pace;reason='Citește unde ajunge mingea și iese să o ia înaintea atacantului.';
      }
     }
    }
   }

  }else if(ownTeam){
   const line=observedLine(p),runStep=runReleaseAllowance(p,time,releaseCue()),safeLine=Math.max(bd,line)-(.65+(10-p.skills.reading)*.18),previous=intents.get(p.id);
   if(p.role==='CB'){x=clamp(bd-X(25),X(14),X(56));y=laneY*(bd<X(32)?1.7:1)+ball.y*.1;kind='cover';reason='Rămâne în spatele atacului, pregătit pentru o pierdere.';}
   else if(p.role==='DM'){x=clamp(bd-X(12),X(24),X(73));y=laneY+ball.y*.16;kind='cover';reason='Oferă sprijin fără să descopere centrul.';}
   else if(p.role==='FB'){
    x=t.fullbacks==='hold'?clamp(bd-X(14),X(18),X(65)):clamp(bd+(t.commit-3)*2,X(18),X(83));y=laneY;kind=t.fullbacks==='hold'?'cover':'width';
    reason=t.fullbacks==='hold'?'Rămâne în spatele mingii; oferă sprijin și păstrează flancul acoperit.':'Oferă lățime și păstrează un drum de întoarcere.';
   }
   else{
    const isForward=p.role==='ST'||p.role==='W',stale=previous?.kind==='run'&&time-previous.since>3;
    const runValue=p.traits.runs*.7+(bd>X(55)?.18:0)+(time-transitionAt<4?.15:0)-(stale?.55:0)-(owner&&dist(owner,p)>X(36)?.45:0)+(p.role==='ST'&&t.striker==='run'?.3:0);
    const showValue=p.traits.comesShort*.55+(bd<X(50)?.2:0)+(p.role==='ST'&&t.striker==='link'?.45:0);
    if(isForward&&runValue>showValue+.12){kind='run';x=Math.min(X(99),safeLine+runStep+(!ball.owner?5:0));y=p.role==='W'?laneY*.82:clamp(ball.y*.45+p.lane*4,-Y(13),Y(13));speed=p.pace*.94;reason=runStep?'Vede pregătirea pasei și pornește dincolo de linia pe care a citit-o.':'Atacă intervalul și încearcă să rămână disponibil pentru pasă.';}
    else if(isForward){kind='show';x=clamp(bd+X(8),X(36),X(91));y=p.role==='W'?laneY:ball.y+(ball.y>0?-Y(9):Y(9));speed=p.pace*.69;reason=stale?'Cursa n-a primit pasa; revine să lege jocul.':'Vine la picior și oferă o soluție de legătură.';}
   else {kind='support';x=clamp(bd+X(5)-p.traits.comesShort*X(7),X(29),X(84));y=laneY+ball.y*.25;reason='Se oferă într-un unghi de pasă și susține faza.';}
    if(slot){
     if(kind==='run')x=Math.min(x,structure!.front+6+(runStep?8:0));
     else x=depth(p.side,slot.aim.x)+(kind==='show'?-3:0);
     y=slot.aim.y;
    }
    x=Math.min(x,Math.max(bd,safeLine+(kind==='run'?runStep+(!ball.owner?5:0):0)));
    const spots=[{x,y},{x:x-3,y:y-5},{x:x-2,y:y+5}];
    const space=(v:Vec)=>{const point={x:world(p.side,v.x),y:v.y};return Math.min(...players.filter(q=>q.id!==p.id).map(q=>dist(point,q)*(q.side===p.side?.7:1)))-laneRisk(ball,point,sidePlayers(other(p.side)))*5;};
   spots.sort((a,b)=>space(b)-space(a));x=spots[0].x;y=spots[0].y;
   }
   if(slot&&['CB','DM','FB'].includes(p.role)){x=depth(p.side,slot.aim.x);y=slot.aim.y;kind=slot.kind;reason=slot.reason;}
   if(slot&&kind!=='run')speed=slot.speed;
  }else{
   const height={deep:X(24),standard:X(34),high:X(43)}[t.line],line=clamp(bd-(owner&&shootingThreat(owner)?X(5):X(10)),2.5,height);
   x=line+(p.role==='CB'?0:p.role==='FB'?2:p.role==='DM'?(bd<X(35)?X(6):X(10)):p.role==='CM'?(bd<X(35)?X(10):X(18)):X(27));y=laneY*.82*clamp(bd/X(40),.35,1)+clamp(ball.y*.25,-Y(8),Y(8));
   if(slot){x=depth(p.side,slot.aim.x);y=slot.aim.y;kind=slot.kind;speed=slot.speed;reason=slot.reason;}
   if(p.id===presser&&owner){
    const movement=containMovement(p,owner,players,t,lastObserved.get(owner.id)??owner);
    kind=movement.kind;x=depth(p.side,movement.aim.x);y=movement.aim.y;speed=movement.speed;reason=movement.reason;
   }else if(p.id===coverer&&owner){const point=coverPosition(get(presser),owner,lastObserved.get(owner.id)??owner);kind='cover';x=depth(p.side,point.x);y=point.y;speed=p.pace*.9;reason='Acoperă aproape de colegul care iese, pregătit să preia adversarul dacă trece.';}
   else if(marks.has(p.id)){
    const target=get(marks.get(p.id)!),seen=lastObserved.get(target.id)??target;
    const point=markPosition(p,seen,ball,f.teams[p.side].tactics.marking);kind='track';x=depth(p.side,point.x);
    y=point.y;speed=p.pace*.9;reason='Închide soluția de pasă din zona lui și rămâne între adversar și poartă.';
   }
   if(kind==='hold'&&((time-transitionAt<3&&pd>bd+3)||(bd<X(40)&&['CM','DM','FB'].includes(p.role)&&pd>x+5))){kind='recover';x=Math.min(x,Math.max(X(12),bd-X(8)));speed=p.pace*.96;reason='Revine în blocul defensiv și închide spațiul din fața porții.';}
  }
  const old=intents.get(p.id);
  let aim=inside({x:world(p.side,x),y});
  const receiver=owner??(ball.mode==='pass'&&flight.receiver?get(flight.receiver):null);
  if(ownTeam&&receiver&&!restart){
   const adjusted=complementarySupportAim(p,aim,players,receiver,support,time,owner??flight.meetings[receiver.id]);
   if(dist(adjusted,aim)>.1){aim=adjusted;reason='Colegul ocupă deja culoarul; caută un unghi diferit pentru continuare.';}
  }
  const shapeOffset=slot&&['hold','cover','support','width','show','recover'].includes(kind)?{x:aim.x-slot.aim.x,y:aim.y-slot.aim.y}:undefined;
  const until=time+.55+random()*.3;
  return {kind,aim,speed,until:refresh?time+refresh:until,since:old?.kind===kind?old.since:time,reason,teamSide:side,shapeOffset,release:releaseAt};
 };
 say('start',`${span(duration)} de joc. Mingea schimbă echipa, meciul merge mai departe.`);
 const opening=options.initialRestart??{kind:'kickoff' as const,side:f.kickoff,spot:{x:(L/2),y:0}};
 if(trainingSetup){
  const initial=trainingSetup.ball,p=players.find(p=>p.side===initial.side&&p.number===initial.number)!;
  ball={x:initial.x,y:initial.y,vx:0,vy:0,z:0,vz:0,owner:null,mode:'loose'};side=other(p.side);
  if(trainingSetup.restart)startRestart(trainingSetup.restart.kind,p.side,{x:initial.x,y:initial.y},{taker:p.id,force:true});
  else own(p,'turnover');
 }else startRestart(opening.kind,opening.side,opening.spot);
 frame();
 const lastObserved=new Map<string,Vec>();
 // What each defender saw a moment ago (M3, coordinated policy): the picture
 // of attackers off the ball is read from here, a personal lag behind.
 const sightings=new Sightings();let sightingsLive=false;
 // (keeper with the ball in his hands) an opponent as the keeper sees him: his own picture, a moment old for a poor reader
 const keeperSees=(k:PracticePlayer,q:PracticePlayer)=>sightingsLive?sightings.at(q,time,sightLag(k,{energy:k.energy,inView:inView(k,lookingAt(k,ball),q),watching:0,at:q,time,salt:q.id})):q;
 // How hard each off-ball positional move is made (practice-intensity): his last read and his spot's motion.
 const intensities=new Map<string,{kind:Duty;defending:boolean;at:number;urgency:number;why:string}>(),spotDrift=new SpotDrift(),keeperDrift=new SpotDrift();
 const marks=new Map<string,string>();
 // Full time (practice-match.ts attackAtFullTime): the clock ends the match
 // unless a side is in an attack, which plays out for at most LAST_ATTACK_MAX.
 const regular=Math.round(duration/STEP),lastView=()=>({restart,side,ball});
 for(let tick=1;;tick++){
  if(ball.mode!=='shot')shotEdge=null;
  if(tick>regular){
   if(!lastAttack){if(!options.lastAttack||!attackAtFullTime(lastView()))break;lastAttack={side,shot:false};}
   if(ball.mode==='shot')lastAttack.shot=true;
   if(tick>regular+1&&lastAttackOver(lastView(),lastAttack.side,lastAttack.shot)||tick>regular+Math.round(LAST_ATTACK_MAX/STEP))break;
  }
  time=tick*STEP;
  if(duration>HALF_SECONDS&&tick===HALF_SECONDS/STEP){
   frame();half=2;cut=true;reserves.clear();for(const p of players){p.energy=halfEnergy(p.energy);p.vx=0;p.vy=0;}
   say('half','Pauză. Echipele își trag sufletul, schimbă porțile și pregătesc repriza a doua.');
   startRestart('kickoff',other(f.kickoff),{x:(L/2),y:0});
  }
  const old=new Map(players.map(p=>[p.id,{x:p.x,y:p.y,angle:p.angle,speed:Math.hypot(p.vx,p.vy)}])),owner=ball.owner?get(ball.owner):null;
  // A restart repositions everyone: the memory starts afresh after it.
  if(coordinated){if(restart){if(sightingsLive){sightings.clear();sightingsLive=false;}}else{sightings.record(time,players);sightingsLive=true;}}
  coaching?.update(time,players,ball,!!restart);
  // Private coaching state is not a public event. Reconsider its movements on
  // the normal coordination tick; do not reset the opposition's clock/jobs.
  playbook=bookFor(owner?.side??side);
  for(const b of playbooks)if(b!==playbook)b.advance(time,owner?.side,!!restart,ball,players,false);
  const wasTeaching=playbook?.strictTeachingActive;
  if(playbook?.advance(time,owner?.side,!!restart,ball,players,!!prepared)){
   // An interrupted authored intention must not leave its old kick pending.
   // Adaptive coaching otherwise preserves an ordinary football commitment.
   if(prepared?.option.teachingStep&&!playbook.actionActive(prepared.option.teachingStep,prepared.option.teachingPlan)){prepared=null;nextThink=time;}
   // A newly recognised adaptive idea gets a real decision before an ordinary kick.
   if(owner&&playbook.startedAction(time,owner.id)&&!prepared)nextThink=time;
   if(wasTeaching){
    // A newly activated intention also replaces an ordinary wind-up by this
    // actor. In particular, ordinary shots need not otherwise review pressure.
    if(prepared?.option.teachingStep||owner&&playbook.startedAction(time,owner.id))prepared=null;
    nextThink=time;
   }
  }
  for(const p of players)controlFor(p).time=time-STEP;
  // the ball was gone before his foot got there: the lunge met nothing (duel recovery: practice-balance lunged)
  if(challenge&&time>=challenge.resolveAt&&owner?.id!==challenge.opponent){
   const d=get(challenge.defender),a=get(challenge.opponent),toA=unit(a.x-d.x,a.y-d.y),closing=Math.max(0,(d.vx-a.vx)*toA.x+(d.vy-a.vy)*toA.y);
   const followThrough=followThroughOf(d,closing,Math.max(0,score[a.side]-score[d.side])),own=lunged(d,{reach:Math.min(1.3,dist(d,challenge.aim)+followThrough),closing,followThrough,met:false,hit:0},1);
   recovering.set(d.id,{until:time+own.challenge*TACKLER_STAGGER,opponent:a.id});unbalance(d,own,a.id);challenge=null;}
  if(tick%12===1){for(const p of players)lastObserved.set(p.id,{x:p.x+p.vx*.1,y:p.y+p.vy*.1});}
  // (marking and shape round) since when the man on the ball has been preparing this pass (the defenders' cue)
  if(prepared!==(cueState as {prepared:unknown}|null)?.prepared)cueState=prepared?{prepared,since:time}:null;
  if(!restart&&time>=assignmentAt){
   const oldPresser=presser,oldCover=coverer;
   const unavailable=new Set(players.filter(p=>time<(wrongfoot.get(p.id)?.until??0)||time<(recovering.get(p.id)?.until??0)).map(p=>p.id));
   if(coordinated){
    const previousReceiver=flight.receiver,before=coordination;
    // B3: a defending keeper who has come for this ball calls it; his defenders hear it.
    const keeperCall=()=>{if(ball.owner)return undefined;const k=players.find(q=>q.role==='GK'&&q.side!==side),i=k&&intents.get(k.id);return i&&i.kind==='sweep'&&i.release===releaseAt?{...i.aim}:undefined;};
    // Ball-watching (M3): while a pass is in the air the defenders follow it,
    // and after it arrives their picture of the rest comes back quickly.
    const watching=!ball.owner&&ball.mode==='pass'?clamp(time-releaseAt,0,1):Math.max(0,watchedFlight-2*(time-receivedAt));
    const seenBy=new Map<string,PracticePlayer>();
    const sight:Sight=(reader,target,before=0)=>{
     const key=reader.id+'>'+target.id+(before>0?'@'+before:'');let v=seenBy.get(key);
     if(!v){v=sightings.at(target,time,sightLag(reader,{energy:reader.energy,inView:inView(reader,lookingAt(reader,ball),target),watching,at:target,time,salt:target.id})+Math.max(0,before));seenBy.set(key,v);}
     return v;
    };
    coordination=coordinateFootball(players,ball,side,[tacticsFor(0),tacticsFor(1)],laneRisk,
     {time,recoveredAt:transitionAt,lastPass:completedPass,passContinuation,lineFor:observedLine,releaseCue:releaseCue(),intended,passer:releaseBy,sight,keeperCall:keeperCall(),passCue:passCue(),
      responsibilities:preview=>{
       let proposed=playbook?.apply(time,players,ball,preview,null,unavailable)??null;
       if(coaching)proposed=coaching.apply(time,players,ball,preview,proposed,unavailable,laneRisk);
       for(const b of playbooks)proposed=b.persistent(time,players,ball,preview.attacking,tacticsFor(b.config.side),preview,unavailable,proposed);
       return proposed;
      }},coordination,unavailable);
    if(before&&before.attacking===coordination.attacking)for(const q of players){
     if(q.side===coordination.attacking||q.role==='GK')continue;
     const old=before.jobs[q.id],job=coordination.jobs[q.id];
     if(!old||!job||job.purpose!=='mark'||!job.target||job.target===old.target)continue;
     if(old.purpose!=='press'&&old.purpose!=='counter-press'&&old.purpose!=='trap')continue;
     const runner=players.find(r=>r.id===job.target);
     if(runner&&runnerBehindShoulder(q,runner))lapses.set(q.id,{until:time+runnerPickupDelay(q.skills.reading),attacking:coordination.attacking,job:{...old,aim:{...old.aim},velocity:old.velocity?{...old.velocity}:undefined}});
    }
    defense=coordination.defense;presser=defense?.presser??'';coverer=defense?.coverer??'';
    flight=coordination.flight;flightAt=time;teamShapes=coordination.shapes;support=coordination.support;
    marks.clear();for(const [id,target] of coordination.marks)marks.set(id,target);
    if(flight.receiver!==previousReceiver){reception=null;intercepts.clear();}
    // (step-across round) a clear run at goal: the defence looks again when the next man's own read of it falls due
    // (marking and shape round) ... and when the next marker's read of the passer's preparation falls due
    const due=[coordination.defending?.clear?.next,coordination.defending?.cueNext].filter((d):d is number=>d!==undefined&&d>time&&d<time+.25);
    assignmentAt=due.length?Math.min(...due):time+.25;
   }else{
    if(owner){
     defense=assignDefense(players,owner,f.teams[other(side)].tactics,defense,unavailable);
     presser=defense.presser;coverer=defense.coverer;flight={hunters:[],meetings:{},coverer:''};
    }else{
     const previousReceiver=flight.receiver;
     flight=assignFlight(players,ball,side,unavailable,{intended,passer:releaseBy,previous:previousReceiver});presser='';coverer=flight.coverer;
     if(flight.receiver!==previousReceiver){reception=null;intercepts.clear();for(const id of [previousReceiver,flight.receiver])if(id)intents.delete(id);}
    }
    assignmentAt=time+.25;
    for(const team of [0,1] as const)teamShapes[team]=teamShape(players,ball,side,team,tacticsFor(team),time,teamShapes[team],unavailable);
    if(owner)support=assignSupport(players,owner,tacticsFor(side),laneRisk,{time,recoveredAt:transitionAt,lastPass:completedPass,passContinuation,lineFor:observedLine,releaseCue:releaseCue(),shape:teamShapes[side]!},support,unavailable);
    else if(ball.mode==='pass'&&flight.receiver){
     const receiver=get(flight.receiver),aim=flight.meetings[receiver.id];
     support=assignSupport(players,receiver,tacticsFor(side),laneRisk,{time,recoveredAt:transitionAt,receiving:{aim,inSeconds:Math.min(2.5,dist(ball,aim)/Math.max(3,Math.hypot(ball.vx,ball.vy)))},lineFor:observedLine,shape:teamShapes[side]!},support,unavailable);
    }else support=null;
    if(oldPresser!==presser||oldCover!==coverer)for(const id of [oldPresser,presser,oldCover,coverer])intents.delete(id);
    unavailable.add(presser);unavailable.add(coverer);for(const id of flight.hunters)unavailable.add(id);
    const previousMarks=new Map(marks),nextMarks=assignMarking(players,side,ball,unavailable,previousMarks,owner?.id??'',undefined,true,teamShapes[other(side)]!,f.teams[other(side)].tactics);
    marks.clear();for(const [id,target] of nextMarks)marks.set(id,target);
    for(const id of new Set([...previousMarks.keys(),...marks.keys()]))if(previousMarks.get(id)!==marks.get(id))intents.delete(id);
   }
   if(!coordinated&&playbook)support=playbook.apply(time,players,ball,null,support,unavailable);
   if(!coordinated&&coaching)support=coaching.apply(time,players,ball,null,support,unavailable,laneRisk);
  }
  // Live restart setup: re-plan every assignment tick until the kick.
  if(restart?.routine&&time>=restartAssignAt){
   restart.live=planLiveRestart(restart,restart.routine,players,{time,tactics:[tacticsFor(0),tacticsFor(1)],laneRisk,lineFor:observedLine},restart.live??null);
   // A goal kick's long ball leads the runner the plan sends behind a press.
   if(restart.kind==='goalKick')support=restart.live.plan.support;
   // A routine's delivery leads the runs drawn from its kick.
   if(restart.authored)support=playbooks.find(b=>b.config.side===restart!.side)?.routineSupport(time,restart.live.plan.support,players)??restart.live.plan.support;
   // A routine's hard cap: once the kick has waited this long on the Laws, the
   // engine holds everyone on fixed legal points instead of re-planning.
   if(restart.authored&&time>=restart.ready+ROUTINE_SETUP_CAP&&(restart.settle?time>=restart.settle.at+ROUTINE_SETTLE_EVERY:true)&&!restartPlayersReady(restart,players,true)){
    const settled=settleRestart(restart,players);
    for(const id of settled.released)delete restart.routine.slots[id];
    restart.settle={at:time,aims:{...restart.settle?.aims,...settled.aims}};
   }
   if(restart.settle)for(const [id,aim] of Object.entries(restart.settle.aims)){const p=get(id);restart.live.jobs[id]={aim,speed:p.pace*.85,reason:p.side===restart.side?'Rămâne pe loc, la distanța regulamentară, până la execuție.':'Arbitrul cere distanța: stă pe loc până la execuție.'};}
   restartAssignAt=time+.25;
  }
  // (receive round) Whoever will meet the ball reads his reception while it is on its way (practice-receive): from his
  // read horizon on, every READ_EVERY s, the picture at his reception (the opponents where their momentum takes them by
  // then), his room there and his options from the meeting point. He arrives with an intention: the option he means to
  // play, and whether he plays it first time (unless a touch buys more than it costs: the pace he would strike through,
  // a ball still in the air) or sets it with his first touch; a carry's first touch goes into its space. That is the
  // team-mate a pass is meant for, or the defender who gets to it first (an interception is a reception too). Before,
  // only a team-mate within 14 m, for an option within 0.06 of his best and never a loft or a clearance, so most
  // receivers met the ball with no intention at all; a defender only in his own box, and only to clear it.
  // Near his own goal (within CLEAR_READ m of its centre) a defender who reads that the first attacker will be on him
  // before he can control it and play it with a margin to spare (room under his touch time + CLEAR_SPARE s: a loss
  // there is a chance for them) clears it first time, when a clearance is among his best options there.
  // (decide round) ... with his team-mates where their runs and jobs take them by then (projectMates), and he keeps
  // the plan he has unless the picture genuinely changes (practice-receive READ_KEEP, ROOM_DROP, SWITCH_DEADLINE).
  const mateJob:MateJob=q=>{const j=coordinated?coordination?.jobs[q.id]:support?.moves.find(m=>m.player===q.id&&m.until>time);return j?{aim:j.aim,speed:j.speed}:undefined;};
  const readReception=(p:PracticePlayer,meeting:Vec,arrive:number,prev:Continuation|null,mine:boolean):Continuation|null=>{
   const future={...p,...meeting},seen=projectMates(projectOpponents(players,p.side,meeting,arrive),p,arrive,mateJob),opponents=seen.filter(q=>q.side!==p.side);
   const runs=mine?new Set(players.filter(q=>q.duty==='run').map(q=>q.id)):new Set<string>();
   const available=footballOptions(future,seen,runs,releaseBy,0,null,time,mine?support:null);
   const best=Math.max(...available.map(o=>o.score)),room=receptionRoom(p,meeting,arrive,players,time),late=roomLate(p,room);
   const clearing=!mine&&dist(meeting,{x:world(p.side,0),y:0})<=CLEAR_READ&&room<touchTime(p)+CLEAR_SPARE;
   const open=(o:Option)=>clearing?o.kind==='clear':PLANNED.includes(o.kind)&&plannedRisk(future,o,opponents,seen)<.28;
   const ranked=available.filter(o=>open(o)&&o.score>=best-(clearing?.12:READ_MARGIN+(o.kind==='carry'?0:LATE_MARGIN*late)))
    .sort((a,b)=>b.score-a.score);
   // the plan he has stays while it is still on and nothing clearly better has appeared; inside the switch deadline
   // only its being taken away moves him
   const held=prev?.receiver===p.id&&prev.release===releaseAt?prev:null;
   let option:Option|undefined=ranked[0];
   if(held){
    const kept=available.filter(o=>sameIntention(o,held.option)).sort((a,b)=>dist(a.aim,held.option.aim)-dist(b.aim,held.option.aim))[0];
    if(kept&&open(kept)&&room>=Math.min(held.room,9)-ROOM_DROP&&(arrive<SWITCH_DEADLINE||kept.score>=best-READ_KEEP))option=kept;
   }
   if(!option)return null;
   const same=!!held&&sameIntention(held.option,option),since=same?held!.since:time;
   // first time if a touch costs more than striking it: the pace, the air, and a plan he will have held too briefly
   // at the strike to have shaped his body for it (lateStrike); none at all inside a reaction (SHAPE_MIN)
   const heldAtStrike=time-since+arrive;
   const first=clearing||option.kind!=='carry'&&heldAtStrike>=SHAPE_MIN&&touchCost(p,option,meeting,seen,room,laneRisk)>=firstTimeCost(p,option,meetingSpeed(ball,p,arrive),aerialDelivery,meeting,seen,lateStrike(heldAtStrike));
   const alt=clearing?undefined:ranked.find(o=>!sameIntention(o,option!));
   return {receiver:p.id,release:releaseAt,option,since,checked:time,first,room:same?held!.room:room,alt};
  };
  if(!owner&&!restart&&ball.mode!=='shot'&&time-releaseAt>.05){
   const r=ball.mode==='pass'&&flight.receiver&&!playbook?.strictTeachingActive?get(flight.receiver):undefined,receiver=r?.side===side?r:undefined;
   const rMeet=receiver?flight.meetings[receiver.id]??receptionTarget(receiver,ball):undefined,rArrive=rMeet?ballArrival(ball,rMeet):Infinity;
   const defender=flight.hunters.map(get).find(q=>q.side!==side&&q.role!=='GK'),dMeet=defender?flight.meetings[defender.id]:undefined,dArrive=dMeet?ballArrival(ball,dMeet):Infinity;
   // one read a tick, by whichever of them the ball reaches first
   const cutting=!!defender&&!!dMeet&&dArrive<rArrive;
   if(receiver&&rMeet&&!cutting){
    if(rArrive<=readHorizon(receiver)&&(!continuation||continuation.receiver!==receiver.id||continuation.release!==releaseAt||time-continuation.checked>=READ_EVERY))continuation=readReception(receiver,rMeet,rArrive,continuation,true);
   }else continuation=null;
   if(cutting){
    if(dArrive>readHorizon(defender!))defenderPlan=null;
    else if(!defenderPlan||defenderPlan.receiver!==defender!.id||defenderPlan.release!==releaseAt||time-defenderPlan.checked>=READ_EVERY)defenderPlan=readReception(defender!,dMeet!,dArrive,defenderPlan,false);
   }else defenderPlan=null;
  }else{continuation=null;defenderPlan=null;}
  const hunters=!owner&&!restart?flight.hunters.filter(id=>time>=(recovering.get(id)?.until??0)&&time>=(wrongfoot.get(id)?.until??0)):[];
  // (contests in the air, 2026-10-15) a ball in the air on its way to one of theirs: a defender who reads he can get
  // to it as it comes down through his jumping height may go up for it. The receiver's own marker goes when his read of
  // the duel, the inside track and his nerve say so (attacksTheBall); one other defender may come across for it if his
  // own man is well away from it and he reads he gets there in time (practice-air-duel airRace). The rest hold their
  // marking jobs. Goers attack the ball at full effort (airAttacks) and set themselves for a header or cushion if one is
  // there to be had (aerialPreparations).
  const receiving=!owner&&!restart&&ball.mode==='pass'&&aerialDelivery&&flight.receiver?get(flight.receiver):undefined;
  const keeperComing=(s:Side)=>players.some(k=>k.role==='GK'&&k.side===s&&intents.get(k.id)?.kind==='sweep'&&intents.get(k.id)?.release===releaseAt);
  const airTick=tick%AIR_EVERY===0;
  const goers:string[]=[];
  if(receiving&&receiving.side===side&&airTick&&!keeperComing(other(side))){
   const samples=flightSamples(ball,2.4,.04).filter(x=>x.vz<=.5),g={x:world(other(side),0),y:0},drop=flight.meetings[receiving.id]??ball;
   const reads=sidePlayers(other(side)).flatMap(q=>{
    if(q.role==='GK'||hunters.includes(q.id)||time<(recovering.get(q.id)?.until??0)||time<(wrongfoot.get(q.id)?.until??0))return [];
    // once he has gone he is on his way: no second reaction, and he keeps going unless he sees he is clearly too late
    const going=airAttacks.get(q.id)?.release===releaseAt,man=marks.get(q.id),marker=going||man===receiving.id;
    if(!marker&&man&&dist(get(man),drop)<AIR_LEAVE)return [];
    const point=challengePoint(q,samples,going?0:AIR_STEP);if(!point)return [];
    const late=airRace(q,point,time);if(late>AIR_LATE+AIR_DARE_LATE*Math.max(0,airCommit(q))+(going?AIR_KEEP:0))return [];
    if(!going&&attacksTheBall(q,receiving,point.aim,time,dist(q,g)<dist(receiving,g))<=0)return [];
    return [{q,marker,late,point}];
   }).sort((a,b)=>Number(b.marker)-Number(a.marker)||a.late-b.late||a.q.id.localeCompare(b.q.id));
   const marker=reads.find(r=>r.marker),other_=reads.find(r=>r!==marker);
   for(const r of [marker,other_])if(r){goers.push(r.q.id);const a=airAttacks.get(r.q.id);airAttacks.set(r.q.id,{release:releaseAt,since:a?.release===releaseAt?a.since:time,aim:r.point.aim});}
  }
  for(const [id,plan] of aerialPreparations)if(owner||restart||plan.release!==releaseAt||time>plan.at+.15||!hunters.includes(id)&&!(plan.duel&&(!airTick||goers.includes(id))))aerialPreparations.delete(id);
  for(const [id,a] of airAttacks)if(owner||restart||a.release!==releaseAt||ball.mode==='shot'||airTick&&!goers.includes(id))airAttacks.delete(id);
  if(tick%12===0&&!owner&&!restart&&ball.mode!=='shot'&&(ball.z>.25||ball.vz>1))for(const id of [...hunters,...airAttacks.keys()]){
   const p=get(id);if(canUseHands(p)&&depth(p.side,p.x)<BOX_DEPTH&&Math.abs(p.y)<BOX_HALF)continue;
   const existing=aerialPreparations.get(id);
   if(existing&&(time-existing.checked<.18||existing.at-time<.23))continue;
   const candidates:{meeting:AerialMeeting;option?:Option;score:number}[]=[];
   const duel=!hunters.includes(id),reaction=existing?0:airReaction(p);
   for(const meeting of aerialMeetings(p,ball,reaction,undefined,existing?{angle:existing.meeting.angle,age:time-existing.since}:undefined)){
    const future={...p,...meeting.aim,angle:meeting.angle},incoming={...ball,...meeting.ball};
    const pressure=clamp((4-Math.min(...sidePlayers(other(p.side)).map(q=>dist(q,meeting.ball))))/4,0,1);
    if(meeting.technique==='chest'){
     const settled={...incoming,...cushionChest(future,incoming,pressure,()=>.5)};
     const preview={...settled};advanceFlight(preview,.45);
     if(!pitchExit(incoming,preview)&&dist(preview,meeting.aim)<2.7)candidates.push({meeting,score:.47+p.skills.control*.015-pressure*.28});
    }else{
     const choices=footballOptions(future,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),releaseBy,0,null,time,p.side===side?support:null);
     for(const option of choices){
      const opened=openAerialMeeting(meeting,option.aim);if(!reachesAerialMeeting(p,opened,reaction))continue;
      const kick=readAerialKick({...future,...opened.aim,angle:opened.angle},incoming,meeting.technique,option);if(!kick)continue;
      // A rehearsed ground/loft technique remains meaningful: a header is not
      // credited as executing a specifically requested pass along the ground.
      if(option.teachingStep&&(option.pass||option.loft))continue;
      const risk=option.kind==='shoot'||option.kind==='clear'?0:laneRisk(meeting.ball,option.aim,sidePlayers(other(p.side)),Math.hypot(kick.vx,kick.vy));
      candidates.push({meeting:opened,option,score:option.score-kick.difficulty*.23-risk*.2-.06});
     }
    }
   }
   const best=candidates.sort((a,b)=>b.score-a.score||a.meeting.ball.time-b.meeting.ball.time)[0];
   if(best&&best.score>.34){const same=existing?.meeting.technique===best.meeting.technique&&existing.option?.kind===best.option?.kind&&existing.option?.target===best.option?.target;
    aerialPreparations.set(id,{meeting:best.meeting,option:best.option,since:same?existing!.since:time,checked:time,release:releaseAt,at:time+best.meeting.ball.time,duel});
   }else aerialPreparations.delete(id);
  }
  if(owner&&prepared?.option.target&&(prepared.option.kind==='pass'||prepared.option.kind==='through'||prepared.option.kind==='loft')){
   const option=prepared.option,target=get(option.target!),passer=restart&&(restart.kind==='freeKick'||restart.kind==='indirect')?setPiecePlayer(owner):owner;
   option.run=option.kind!=='pass'&&!(option.teachingStep&&!option.teachingSpace)?activePassRun(support,owner,target,time):undefined;
   if(option.kind==='loft'){
    // Refresh the moving target at decision cadence; always recompute again at release.
    if(!option.loft||tick%6===0)option.loft=loftPass(passer,target,option.run,ball,sidePlayers(other(owner.side)),option.receivingSpace,option.loft?.meetingTime,option.loft?.kind);option.aim=option.loft.aim;
   }else {option.pass=groundPass(passer,target,option.kind==='through',option.run,ball,sidePlayers(other(owner.side)),option.receivingSpace,option.pass?.meetingTime,option.pass?.weight);option.aim=option.pass.aim;}
  }
  // Keep the preparation stance aimed at the same goal opening that release
  // will use. A newly preferred corner may lie across the body even when the
  // old corner was clear; keeping the old stance can otherwise deadlock a shot.
  if(owner&&prepared?.option.kind==='shoot'&&!prepared.option.freeKick&&!restart)prepared.option.aim=assessShot(owner,players).aim;
  if(restart?.phase==='ready'&&prepared&&restart.kind!=='throw'){
   restart.positions[restart.taker]=restartKickPosition(get(restart.taker),restart.spot,prepared.option.aim,restart.kind);
  }
  const authoredAim=owner?playbook?.ownerAim(owner):undefined;
  if(authoredAim&&!prepared)carry=authoredAim;
  const recoveryAim=owner&&firstTouch?.owner===owner.id&&(!prepared||!controlReleaseAvailable(owner,ball,prepared.option.aim))?authoredAim??firstTouch.aim:null;
  const settlingReceipt=!!owner&&!firstTouch&&!prepared&&!actionReasons.has(owner.id)&&time<nextThink;
  // Walking to restart positions (practice-intensity, item 2): who the kick is waiting for, and when it can come.
  let restartPace:{kickIn:number;needed:Set<string>}|null=null;
  if(restart?.phase==='gather'){
   const r=restart,needed=new Set([r.taker,...restartBlockers(r,players,routineRelaxed(r,time)).map(q=>q.id)]);
   const aimOf=(q:PracticePlayer):Vec=>q.id===r.taker?r.spot:r.live?.jobs[q.id]?.aim??r.positions[q.id]??q;
   const speedOf=(q:PracticePlayer)=>q.id===r.taker?q.pace*.8:r.live?.jobs[q.id]?.speed??q.pace*.8;
   restartPace={kickIn:restartKickIn(r.ready,time,[...needed].map(id=>{const q=get(id);return {distance:dist(q,aimOf(q)),speed:speedOf(q)};})),needed};
  }
  for(const p of players){
   // Today's legs (energy and the sprint reserve) are what every race read uses:
   // arrivalTime and the rest read p.pace and p.acceleration.
   let rested=restedAcceleration.get(p.id);if(rested===undefined)restedAcceleration.set(p.id,rested=p.acceleration);
   const fit=legs(p.energy,p.role==='GK'?undefined:reserveOf(p));
   p.pace=p.basePace*energyTop(p.energy,p.role==='GK')*fit.top;p.acceleration=rested*fit.acceleration;let intent=intents.get(p.id);
   const coordinatedOutfield=coordinated&&(p.role!=='GK'||!!coordination?.jobs[p.id]);
   const planned=coordinatedOutfield?coordination?.jobs[p.id]:undefined,lapse=planned&&p.side!==side&&!restart?lapses.get(p.id):undefined;
   // A late pick-up of a runner from behind the shoulder: he carries on with
   // his job from before a moment longer. Going for the ball is never delayed.
   const job=lapse&&time<lapse.until&&lapse.attacking===side&&planned!.purpose==='mark'?lapse.job:planned;
   if(coordinatedOutfield)intent={kind:job?.kind??'hold',aim:job?.aim??{x:p.x,y:p.y},speed:job?.speed??0,reason:job?.reason??'Așteaptă o responsabilitate.',since:time,until:time+.25,teamSide:side};
   else if(!intent||time>=intent.until||intent.teamSide!==side||p.role==='GK'&&side!==p.side&&keeperRereads(p,intent)){intent=offball(p);intents.set(p.id,intent);}
   let aim=intent!.aim,limit=intent!.speed,kind=intent!.kind,reason=intent!.reason,trackingVelocity:Vec|undefined=job?.velocity;

   const unitSlot=teamShapes[p.side]?.slots[p.id];
   if(!restart&&intent!.shapeOffset&&unitSlot){
    aim=inside({x:unitSlot.aim.x+intent!.shapeOffset!.x,y:unitSlot.aim.y+intent!.shapeOffset!.y});limit=unitSlot.speed;
   }
   const supportMove=!coordinatedOutfield&&!restart&&p.side===side&&p.id!==owner?.id?support?.moves.find(m=>m.player===p.id&&m.until>time):undefined;
   if(supportMove){aim=supportMove.aim;limit=supportMove.speed;kind=supportMove.kind;reason=supportMove.reason;}
   if(p.id===owner?.id){aim=carry;limit=carryPace(p,carry,players.filter(q=>q.side!==p.side));kind='carry';reason='Avansează cu mingea și caută următoarea soluție.';
    if(prepared||mustRelease||inHands){aim=prepared?.option.aim??{x:p.x,y:p.y};limit=inHands||mustRelease?0:p.pace*.68;kind='prepare';reason='Își pregătește atingerea înainte să dea drumul mingii.';}
    // (keeper with the ball in his hands) he jogs to a better spot while he waits (keeperMove)
    if(inHands&&!prepared&&keeperStep){aim=keeperStep;limit=p.pace*KEEPER_JOG;}
    if(recoveryAim){aim=recoveryAim;limit=p.pace*.4;kind='carry';reason='Prima atingere caută partea ferită de adversar; ridică privirea pentru ieșire.';}
    reason=actionReasons.get(p.id)??reason;
    controlFor(p).pace=kind==='carry'?limit:undefined;
   }else if(!restart){
    if(!coordinatedOutfield){
    if(owner&&p.id===presser&&p.side!==side){const movement=containMovement(p,owner,players,f.teams[p.side].tactics,lastObserved.get(owner.id)??owner);aim=movement.aim;limit=movement.speed;kind=movement.kind;reason=movement.reason;trackingVelocity=movement.velocity;}
    else if(owner&&p.id===coverer&&p.side!==side){aim=coverPosition(get(presser),owner,lastObserved.get(owner.id)??owner);trackingVelocity={x:owner.vx,y:owner.vy};}
    else if(!owner&&p.id===flight.coverer&&flight.coverAim){aim=flight.coverAim;limit=p.pace*.9;kind='cover';reason='Acoperă colegul care atacă pasa, pregătit pentru mingea a doua.';trackingVelocity=undefined;}
    else if(p.side!==side&&marks.has(p.id)){const target=get(marks.get(p.id)!);aim=markPosition(p,lastObserved.get(target.id)??target,ball,f.teams[p.side].tactics.marking);trackingVelocity={x:target.vx,y:target.vy};limit=p.pace*.9;kind='track';reason=owner?'Închide soluția de pasă și rămâne între adversar și poartă.':'Mingea circulă; urmărește cursa și păstrează partea dinspre poartă.';}
    }
    if(owner&&(p.id===presser||p.id===coverer)&&p.side!==side&&dist(p,owner)<9){
     const read=readChallenge(p,owner,ball,players,f.teams[p.side].tactics,score[side]-score[p.side]);
     if(read.mode==='block'){
      aim=read.shot.blockAim;kind='block';reason=read.reason;limit=p.pace*.94;
      blocks.set(p.id,{opponent:owner.id,aim:{...aim},until:time+.35});
     }else if(p.id===presser&&dist(p,owner)<4.5&&read.mode==='recover'){aim=recoveryPosition(p,owner);kind='recover';reason=read.reason;}
     else if(p.id===presser&&dist(p,owner)<4.5&&read.mode==='contain'){
      // (box defending) near our goal he keeps the block stance on the shot line (containMovement's BLOCK_GAP), not the
      // midfield jockey 1.8 m off: from 1.8 m his body covered about 10 degrees of a goal 28 degrees wide at 10 m
      const u=unit(world(p.side,0)-owner.x,-owner.y),gap=dist(owner,{x:world(p.side,0),y:0})<BLOCK_NEAR?BLOCK_GAP:1.8;
      aim=inside({x:owner.x+u.x*gap,y:owner.y+u.y*gap});kind='jockey';reason=read.reason;
     }
    }else if(owner&&coordinatedOutfield&&p.side!==side&&p.role!=='GK'&&dist(p,owner)<BOX_BLOCK_NEAR&&!['challenge','intercept','receive','recover','wrongfoot'].includes(kind)){
     // (box defending) any defender near the shooter who reads the shot coming and can get his body into its lane in
     // time (readShotDanger: the visible shooter, his reading) steps into it, unless his own man would have the better shot
     const shot=readShotDanger(p,owner,ball,players),man=marks.has(p.id)?get(marks.get(p.id)!):undefined;
     if(shot.canBlock&&shot.level>BOX_BLOCK_DANGER&&(!man||mayLeaveForBall(lastObserved.get(man.id)??man,owner,p.side))){
      aim=shot.blockAim;kind='block';reason='E lângă culoarul șutului: intră cu corpul pe traiectorie.';limit=p.pace*.94;trackingVelocity=undefined;
      blocks.set(p.id,{opponent:owner.id,aim:{...aim},until:time+.35});
     }
    }
    const block=blocks.get(p.id);
    if(!owner&&ball.mode==='shot'&&p.side!==side&&block&&block.opponent===releaseBy&&time<block.until){aim=block.aim;kind='block';limit=p.pace*.94;trackingVelocity=undefined;reason='A pornit să acopere șutul; ține corpul pe traiectorie.';}
    const recoveringStep=recovering.get(p.id);
    if(recoveringStep&&time<recoveringStep.until&&p.side!==side){aim=recoveryPosition(p,get(recoveringStep.opponent));kind='recover';reason='A ratat intrarea; își reface poziția înainte să încerce din nou.';trackingVelocity=undefined;}
    if(challenge?.defender===p.id){aim=challenge.aim;trackingVelocity=challenge.velocity;kind='challenge';reason=challenge.read.reason;limit=p.pace*.94;}
    if(ball.mode==='pass'&&flight.receiver===p.id&&hunters.includes(p.id)&&time-releaseAt>.12){if(!reception||time>=receptionAt){reception=aerialDelivery?flightMeeting(p,ball).aim:receptionTarget(p,ball);receptionAt=time+.2;}aim=reception;limit=p.pace;kind='receive';reason=p.id===intended?'Ajustează cursa la traiectoria reală a pasei.':'Preia cursa spre pasă; colegul poate oferi următoarea soluție.';}
    else if(!owner&&kind!=='block'&&hunters.includes(p.id)&&time-releaseAt>.2){let meeting=intercepts.get(p.id);if(!meeting||time>=meeting.at){meeting={at:time+.25,aim:flight.meetings[p.id]??(aerialDelivery?flightMeeting(p,ball).aim:receptionTarget(p,ball))};intercepts.set(p.id,meeting);}aim=meeting.aim;limit=p.pace*.93;kind='intercept';reason='Caută un punct de întâlnire cu mingea, în loc să alerge în urma ei.';}
    const read=p.role==='GK'?readKeeperFlight(p,ball,time-releaseAt,edgeOf(p)):null;
    // A ball his own side played (a back-pass, a throw, a clearance gone astray)
    // is received, not saved: he gets in line with it and never dives at it.
    const mates=!!read&&p.side===side&&ball.mode!=='shot';
    if(mates&&kind!=='receive'&&kind!=='intercept'){aim=read!.aim;limit=p.pace;kind='receive';reason='Mingea vine de la un coleg; se așază în calea ei ca s-o preia.';trackingVelocity=undefined;}
    const incoming=mates?null:read;
    if(incoming&&!(kind==='sweep'&&ball.mode!=='shot')&&time-releaseAt>.2+(10-p.skills.reading)*.015-edgeOf(p).reactionCut){
     aim=incoming.aim;limit=p.pace;kind='keeper';reason='Mingea vine spre poartă; citește traiectoria și încearcă s-o oprească.';trackingVelocity=undefined;
     const previous=dives.get(p.id);
     if(previous&&time<previous.until)previous.aim=aim;
     if(incoming.dive&&(!previous||time>=previous.recoverUntil))dives.set(p.id,{aim,until:time+.6,recoverUntil:time+1.3});
    }
   }
   const dive=dives.get(p.id);
   if(dive&&!restart&&p.id!==owner?.id&&time<dive.recoverUntil){
    aim=dive.aim;kind='dive';limit=time<dive.until?p.pace:0;
    reason=time<dive.until?'Împinge în picior și plonjează spre traiectoria mingii.':'Își reface sprijinul după plonjon.';
   }
   if(restart){
    const live=p.id===restart.taker?undefined:restart.live?.jobs[p.id];
    kind='restart';trackingVelocity=live?.velocity;aim=live?.aim??restart.positions[p.id];limit=live?live.speed:p.pace*.8;
    reason=restart.kind==='penalty'?p.id===restart.taker?'Se pregătește să execute penalty-ul.':p.role==='GK'&&p.side!==restart.side?'Rămâne pe linia porții până la executare.':'Așteaptă în afara careului și a arcului până la lovitură.':restart.kind==='kickoff'?'Revine în propria jumătate și așteaptă lovitura de începere.':'Se așază pentru reluarea jocului.';
    if(live&&restart.kind!=='penalty'&&restart.kind!=='kickoff')reason=live.reason;
    if(p.id===restart.taker&&prepared)reason=prepared.option.reason;
   }
   if(feint?.attacker===p.id&&ball.owner===p.id){kind='feint';reason='Arată într-o parte și încearcă să plece prin cealaltă.';aim=time<feint.check?{x:p.x+sign(p.side),y:p.y-(feint.aim.y-p.y)*.3}:feint.aim;limit=time<feint.check?p.pace*.25:p.pace*.88;}
   const fooled=wrongfoot.get(p.id);if(fooled&&time<fooled.until){aim=fooled.aim;limit=p.pace*.65;kind='wrongfoot';reason=fooled.reason??'A mușcat fenta; are nevoie de timp să întoarcă.';trackingVelocity=undefined;}
   // (duel recovery) knocked down in a duel: he lies where he fell until he can get up, whatever his job (a restart
   // waits for him like anyone else still on his way)
   const floored=isDown(p.id)&&p.id!==owner?.id;
   if(floored){aim={x:p.x,y:p.y};limit=0;kind='down';reason='A fost dat jos în duel; se ridică.';trackingVelocity=undefined;}
   const aerialPlan=!owner&&!restart?aerialPreparations.get(p.id):undefined;
   const airAttack=!owner&&!restart&&!aerialPlan?airAttacks.get(p.id):undefined;
   if(airAttack&&!['dive','wrongfoot','recover','challenge','down'].includes(kind)){aim=airAttack.aim;kind='intercept';limit=p.pace;trackingVelocity=undefined;reason='Atacă mingea în aer, înaintea omului lui.';}
   if(aerialPlan&&!['dive','wrongfoot','recover','challenge','down'].includes(kind)){aim=aerialPlan.meeting.aim;kind=p.side===side?'receive':'intercept';limit=p.pace;reason=aerialPlan.meeting.technique==='chest'?'Se pregătește să amortizeze mingea pe piept.':aerialPlan.meeting.technique==='header'?'Se așază pentru o lovitură cu capul.':'Își pregătește piciorul pentru un voleu.';}
   // Defending round (step 1): the keeper owns the goal line; an outfielder
   // not going for the ball never aims on his own (offGoalLine).
   if(!restart&&p.role!=='GK'&&p.id!==owner?.id&&!['challenge','block','intercept','receive','dive','keeper','wrongfoot','feint','down'].includes(kind)){
    const kept=offGoalLine(p.side,aim,ball);
    // (threat round, goal-line fixes) a spot clamped off the goal line is braked into: no goalward run carried into it
    if(kept!==aim&&trackingVelocity&&(p.side===0?trackingVelocity.x<0:trackingVelocity.x>0))trackingVelocity={x:0,y:trackingVelocity.y};
    aim=kept;
   }
   // (keeper with the ball in his hands) nobody stands on him: whatever his job, an opponent's spot within KEEPER_BODY m
   // of him moves out to KEEPER_BODY m on the same line (one already inside it heading for him backs out first), and
   // one closing on him brakes so as to stop there (a man arriving at a sprint would run on into him)
   let pullUp=false;
   if(!restart&&inHands&&owner&&p.side!==owner.side&&p.role!=='GK'){
    const d=dist(p,owner)||1,gap=d-KEEPER_BODY,closingSpeed=((p.vx-owner.vx)*(owner.x-p.x)+(p.vy-owner.vy)*(owner.y-p.y))/d,closing=closingSpeed>0;
    const coming=Math.max(0,(owner.vx*(p.x-owner.x)+owner.vy*(p.y-owner.y))/d);
    if(closing&&gap>0)limit=Math.min(limit,Math.max(0,Math.sqrt(2*p.acceleration*gap)-coming)+.3);
    else if(closing){limit=Math.min(limit,.3);trackingVelocity=undefined;}
    // (r1, 2026-10-14) Once he is coming in faster than he can still stop over the gap (KEEPER_BRAKE of his
    // acceleration, a margin for the keeper's own steps), he pulls up: straight at the spot a metre short of the
    // keeper, at full effort, below the speed he could still stop from. Braking only by a speed cap at his full
    // deceleration let him spend his effort curving on to his jockey or
    // marking spot (and an easy positional move brakes at under half effort), so a man arriving at a sprint ran on
    // to 0.3-0.7 m of the keeper (r1 combine: 2 of 24 pressed seeds, as on e2dadee5).
    if(closing&&gap>0&&closingSpeed*closingSpeed>=2*p.acceleration*KEEPER_BRAKE*gap){
     pullUp=true;aim={x:owner.x+(p.x-owner.x)/d*KEEPER_BODY,y:owner.y+(p.y-owner.y)/d*KEEPER_BODY};trackingVelocity=undefined;
     limit=Math.min(limit,Math.max(0,Math.sqrt(2*p.acceleration*KEEPER_BRAKE*gap)-coming));
    }
    const inside=dist(p,owner)<KEEPER_BODY&&dist(p,owner)>.1&&(aim.x-p.x)*(owner.x-p.x)+(aim.y-p.y)*(owner.y-p.y)>0;
    const ref=inside?p:dist(aim,owner)<KEEPER_BODY?(dist(aim,owner)>.1?aim:p):null,r=ref?dist(ref,owner):0;
    if(ref&&r>.1){aim={x:owner.x+(ref.x-owner.x)/r*KEEPER_BODY,y:owner.y+(ref.y-owner.y)/r*KEEPER_BODY};trackingVelocity=undefined;}
   }
   decision(p,kind,reason);
   const facing=p.angle,acceleration=p.acceleration;limit=Math.min(limit,p.pace);
   if(kind==='dive'&&dive&&time<dive.until)p.acceleration*=2.2;
   // a body on the floor slides to a stop well inside a stride (FALL_KEEP took most of his speed as he went down)
   if(kind==='down')p.acceleration*=3;
   // Movement intensity (2026-10-10, practice-intensity): an off-ball positional move is made as hard as the
   // situation he reads needs, braking gently into his spot and moving with it; everything else stays at full effort.
   if(!restart&&p.role!=='GK'&&p.id!==owner?.id&&POSITIONAL_KINDS.has(kind)&&!pullUp){
    const drift=spotDrift.update(p.id,kind,aim,time),defending=p.side!==side;
    let read=intensities.get(p.id);
    if(!read||read.kind!==kind||read.defending!==defending||time>=read.at){
     const manId=defending?job?.target??marks.get(p.id):undefined,release=owner&&prepared&&prepared.option.kind!=='carry'?prepared.at:undefined;
     const watching=!ball.owner&&ball.mode==='pass'?clamp(time-releaseAt,0,1):Math.max(0,watchedFlight-2*(time-receivedAt));
     // the men he reads off the ball are as he saw them a moment ago (later for a poor reader); the carrier is seen as he is
     const seen=(q:PracticePlayer)=>!sightingsLive||q.id===owner?.id?q:sightings.at(q,time,sightLag(p,{energy:p.energy,inView:inView(p,lookingAt(p,ball),q),watching,at:q,time,salt:q.id}));
     const r=offBallIntensity({p,aim,kind,defending,depth:x=>depth(p.side,x),goal:{x:world(p.side,0),y:0},ball,
      cue:owner?readCue(p,release,time,owner.side===p.side):CUE_LOOSE,target:!defending&&prepared?.option.target===p.id,
      man:manId&&byId.has(manId)?seen(get(manId)):undefined,
      runners:defending?players.filter(q=>q.side!==p.side&&q.role!=='GK').map(seen):undefined,
      mates:defending?players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK'):undefined,
      drift:Math.hypot(drift.x,drift.y),time,threat:defending?job?.threat:undefined});
     read={kind,defending,at:time+INTENSITY_EVERY,urgency:r.urgency,why:r.why};intensities.set(p.id,read);
    }
    limit=intensityLimit(limit,p.pace,read.urgency);p.acceleration*=intensityPush(read.urgency);
    if(!trackingVelocity){const m=Math.hypot(drift.x,drift.y),c=Math.min(1,limit/Math.max(m,1e-6));trackingVelocity={x:drift.x*c,y:drift.y*c};}
   }else spotDrift.forget(p.id);
   // (keeper fix, 2026-10-19) A defending keeper whose spot is moving back towards his goal (the attack coming on, so the
   // height he can afford shrinks: attackTime) runs back with it instead of braking into each re-read step of it: braking
   // into a near aim was the main limit on his speed after a loss (the study: braking-limited in 60-85% of his ticks, at
   // 0.23-0.38 of his pace). Only the goalward part: across the goal and coming out he still steps and sets as before.
   if(!restart&&p.role==='GK'&&kind==='keeper'&&aim===intent!.aim&&p.side!==side&&!trackingVelocity){
    const drift=keeperDrift.update(p.id,kind,aim,time),back=p.side===0?Math.max(-limit,Math.min(0,drift.x)):Math.min(limit,Math.max(0,drift.x));
    if(back)trackingVelocity={x:back,y:0};
   }else keeperDrift.forget(p.id);
   if(restartPace&&kind==='restart'&&!restartPace.needed.has(p.id)){
    // not needed quickly: walk or jog so as to be set just before the kick can come (a run timed to the kick keeps its speed)
    const live=restart!.live?.jobs[p.id];
    if(!live||!live.velocity&&live.speed<p.pace*.9){const walk=restartWalk(dist(p,aim),restartPace.kickIn,limit);limit=walk.speed;p.acceleration*=intensityPush(walk.urgency);}
   }
   const physicalOwner=p.id===owner?.id&&!restart&&!inHands;
   // Start arranging the receiving stance before the runner's braking distance
   // is exhausted, especially when approaching a slow or opposing ball.
   const approachSpeed=Math.hypot(p.vx,p.vy),ballSpeed=Math.hypot(ball.vx,ball.vy);
   const needsBraking=ballSpeed<1.5||p.vx*ball.vx+p.vy*ball.vy<=0;
   const receiveRadius=needsBraking?Math.max(2.4,approachSpeed*approachSpeed/(2*p.acceleration)+.9):2.4;
   const receiving=!owner&&!restart&&ball.mode!=='shot'&&ball.z<.8&&(!aerialDelivery||ball.z<=.01)&&dist(p,ball)<receiveRadius&&['receive','intercept','sweep'].includes(kind)&&!(canUseHands(p)&&depth(p.side,p.x)<BOX_DEPTH&&Math.abs(p.y)<BOX_HALF);
   const liningUp=restart?.phase==='ready'&&restart.taker===p.id&&!!prepared&&restart.kind!=='throw';
   // Wait beside the low arrival point, not underneath the descending ball.
   // The extra distance is a body destination; only a real foot contact can receive.
   if(!aerialPlan&&!owner&&!restart&&aerialDelivery&&['receive','intercept'].includes(kind)&&!canUseHands(p)){
    const approach=unit(ball.vx,ball.vy);
    aim=inside({x:aim.x+approach.x*.7,y:aim.y+approach.y*.7});
   }
   if(liningUp){
    // Positional arrival alone is insufficient: finish a small setup step if
    // the normal arrival radius would leave the actual release blocked.
    const aim=prepared!.option.aim,canRelease=controlReleaseAvailable({...p,angle:Math.atan2(aim.y-p.y,aim.x-p.x)},ball,aim);
    if(!canRelease&&dist(p,restart!.positions[p.id])<=.2)steerMotion(p,restart!.positions[p.id],STEP,.55,players,undefined,0);
    else steer(p,restart!.positions[p.id],STEP,.55,players);
   }
   else if(physicalOwner||receiving){
    const target=receiving?(continuation?.receiver===p.id?continuation.option.aim:{x:p.x+sign(p.side)*5,y:p.y}):aim;
    steerControl(p,ball,controlFor(p),target,players.filter(q=>q.side!==p.side),STEP,Math.max(limit,p.pace*.4),receiving||settlingReceipt&&physicalOwner||!!prepared&&!recoveryAim,prepared?.option.kind==='shoot'?'shot':prepared?.option.kind==='clear'?'clearance':'pass');
   }else steer(p,aim,STEP,Math.min(limit,p.pace),kind==='press'||kind==='challenge'||kind==='intercept'||kind==='receive'||kind==='sweep'?players.filter(q=>q.side===p.side):players,trackingVelocity);
   // Watch and open to the delivery while approaching it. Waiting until the
   // final 2.4 metres made passes arriving from behind hit a receiver's back.
   if(!owner&&!restart&&!receiving&&ball.mode==='pass'&&(kind==='receive'||kind==='intercept')){
    p.angle=facing;faceControl(p,ball,continuation?.receiver===p.id?continuation.option.aim:{x:p.x+sign(p.side)*5,y:p.y},STEP);
   }
   if(aerialPlan){p.angle=facing;const turn=(3.4+p.skills.control*.12)/(1+Math.hypot(p.vx,p.vy)*.22);p.angle+=clamp(angleDiff(aerialPlan.meeting.angle,p.angle),-turn*STEP,turn*STEP);}
   // An available teammate can open his body before the kick. Previously a
   // slow outlet kept facing his last movement direction until the ball was
   // already travelling. Sprinting still follows the direction of movement.
   if(owner&&!restart&&p.side===owner.side&&p.id!==owner.id&&p.role!=='GK'&&
    Math.hypot(p.vx,p.vy)<p.pace*.4&&dist(p,ball)<18&&!(fooled&&time<fooled.until)){
    p.angle=facing;faceControl(p,ball,{x:world(p.side,L),y:p.y},STEP);
   }
   if(p.role==='GK'&&!physicalOwner&&!restart&&!inHands){const turn=(3.4+p.skills.keeping*.12)*STEP;p.angle=facing+clamp(angleDiff(Math.atan2(ball.y-p.y,ball.x-p.x),facing),-turn,turn);}
   p.acceleration=acceleration;
   const margin=restart?.kind==='corner'&&restart.taker===p.id?.8:-.3;
   // A corner taker returns from outside the line by running, not by snapping
   // back inside as soon as the kick changes the restart state.
   const previous=old.get(p.id)!;
   p.x=clamp(p.x,Math.min(-margin,previous.x),Math.max(L+margin,previous.x));
   p.y=clamp(p.y,Math.min(-W/2-margin,previous.y),Math.max(W/2+margin,previous.y));
   const speed=Math.hypot(p.vx,p.vy);p.energy=fatigueEnergy(p.energy,speed,p.skills.stamina,STEP,(speed-previous.speed)/STEP,p.role==='GK'?undefined:p.basePace);reserves.set(p.id,reserveBalance(reserveOf(p),speed,p.energy,p.basePace,STEP));
   if(kind==='press')stats[p.side].pressSeconds+=STEP;if(kind==='cover'||kind==='hold'||kind==='track')stats[p.side].coverSeconds+=STEP;
   if(!physicalOwner&&p.id===owner?.id&&(prepared||firstTouch)){
    const target=prepared?.option.aim??firstTouch!.aim;p.angle=facing;const a=Math.atan2(target.y-p.y,target.x-p.x);p.angle+=clamp(angleDiff(a,p.angle),-4*STEP,4*STEP);
   }
   // (keeper with the ball in his hands) walking with it, he keeps turned to the team-mate he means to find
   else if(inHands&&p.id===owner?.id&&!restart){p.angle=facing;if(keeperLook){const a=Math.atan2(keeperLook.y-p.y,keeperLook.x-p.x);p.angle+=clamp(angleDiff(a,p.angle),-KEEPER_TURN*STEP,KEEPER_TURN*STEP);}}
   else if(restart&&!liningUp){p.angle=facing;const a=Math.atan2(restart.spot.y-p.y,restart.spot.x-p.x);p.angle+=clamp(angleDiff(a,p.angle),-4*STEP,4*STEP);}
   if((owner||restart)&&!physicalOwner)receivingContact(p,old.get(p.id)!,ball,ball,controlFor(p),time,STEP,false);
  }
  if(!restart)separateTeamMates();
  if(restart){const legal=restartPlayersReady(restart,players,routineRelaxed(restart,time));restart.legalSince=legal?(restart.legalSince??time):null;}
  if(restart&&restart.phase==='gather'){
   const taker=get(restart.taker);
   if(time>=restart.ready&&restart.legalSince!==null&&time-restart.legalSince>=.5){
    const type=restart.kind;own(taker,'silent');restart.phase='ready';restart.readyAt=time;ball={...ball,...restart.spot,vx:0,vy:0,z:0,vz:0};exempt=['throw','corner','goalKick'].includes(type);flags=[];
    mustRelease=true;restrictedGoal=type==='indirect'||type==='throw';nextThink=time+.25;receivedAt=time;say('restart',`${restartLabels[type]}. ${taker.name} se pregătește să execute.`,taker);lastFrom='';
    if(type==='penalty'){prepared={option:{kind:'shoot',aim:{x:world(taker.side,L),y:0},score:1,reason:'Încearcă să transforme lovitura de pedeapsă.'},at:time+.5};}
   }
  }else if(ball.owner){
   const p=get(ball.owner),before={x:ball.x,y:ball.y};if(!restart)stats[p.side].possession+=STEP;
   if(restart){ball.x=restart.spot.x;ball.y=restart.spot.y;ball.vx=0;ball.vy=0;ball.z=0;ball.vz=0;}
   else if(inHands){ball.x=p.x+Math.cos(p.angle)*.65;ball.y=p.y+Math.sin(p.angle)*.65;ball.vx=p.vx;ball.vy=p.vy;ball.z=1;}
   else {
    const state=controlFor(p),others=players.filter(q=>q.id!==p.id&&dist(q,ball)<5),aim=recoveryAim??prepared?.option.aim??(feint?.attacker===p.id?feint.aim:carry);
    let retained=advanceControl(p,old.get(p.id)!,ball,state,aim,others,STEP,settlingReceipt||!!prepared&&!recoveryAim,true,others.map(q=>old.get(q.id)!));
    if(state.contacts.some(c=>c.foot))firstTouch=null;
    collectContacts(state);
    // Own-goal guard: a ball running away from its outfield "owner" toward his own
    // net is not under control. It is loose, so everyone (his keeper first) plays it.
    if(retained&&p.role!=='GK'&&dist(p,ball)>.9&&ownGoalBound(p.side,ball)){ball.owner=null;ball.mode='loose';retained=false;}
    if(!retained){prepared=null;firstTouch=null;feint=null;carryPlan=null;assignmentAt=0;intended='';flags=[];releaseBy=p.id;releaseAt=time;intents.clear();dispossessed={id:p.id,at:time};}
   }
   if(!resolveExit(before)&&ball.owner===p.id){
   if(feint&&feint.attacker===p.id){
    if(!feint.resolved&&time>=feint.check){
     const d=get(feint.defender);const fooled=execution()<clamp(.42+(p.skills.control-d.skills.reading)*.055+(1-d.traits.discipline)*.1,.12,.8);
     if(fooled){wrongfoot.set(d.id,{until:time+.65,aim:inside({x:d.x-sign(p.side)*1.5,y:d.y-(feint.aim.y-p.y)})});duelAfter.set(d.id,Math.max(duelAfter.get(d.id)??0,time+.65));}
     feint.resolved=true;
    }
    let releaseOpening=false;
    if(feint.resolved&&time>=feint.check+.15&&time>=feint.review){
     feint.review=time+.2;
     // Review after the fake and first burst, using the same football/manager
     // evaluations. Omit repeat memory: this is still the original encounter.
     const available=footballOptions(p,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p));
     releaseOpening=feintReleaseOpening(feint.score,feint.defender,available);
    }
    if(releaseOpening||finishFeint(p,get(feint.defender),players,time,feint.check,feint.finish)){const d=get(feint.defender);if(depth(p.side,p.x)>depth(p.side,d.x)+.5){stats[p.side].beaten++;say('beat',`${p.name} trece de ${d.name}! Mai e cineva la coadă?`,p,d);}feint=null;nextThink=time;}
   }else if(feint)feint=null;
   const goalkeeper=sidePlayers(other(p.side)).find(q=>canUseHands(q)&&depth(q.side,q.x)<BOX_DEPTH&&Math.abs(q.y)<BOX_HALF&&depth(q.side,ball.x)>=0&&depth(q.side,ball.x)<=BOX_DEPTH&&Math.abs(ball.y)<=BOX_HALF&&ball.z<=2.3&&dist(q,ball)<1.25);
   if(!restart&&goalkeeper&&time>=(duelAfter.get(goalkeeper.id)??0)){
    duelAfter.set(goalkeeper.id,time+1);
    if(execution()<clamp(.6+(goalkeeper.skills.keeping-p.skills.control)*.035,.35,.85))own(goalkeeper,'save',true);
   }
   if(!restart&&!challenge&&!inHands&&ball.owner===p.id){
    // "On losing it": a counter-presser engages like an aggressive press; the
    // delaying player of a Regroup only goes in to stop a shot.
    const lossPlan=coordination?.counterPress,lossJob=(q:PracticePlayer)=>lossPlan?.side===q.side&&!lossPlan.over?coordination?.jobs[q.id]?.purpose:undefined;
    // Selective's trap engages the same way (practice-coordination Trap).
    const trapping=(q:PracticePlayer)=>coordination?.trap?.side===q.side&&!coordination.trap.over&&coordination.jobs[q.id]?.purpose==='trap';
    const challengeTactics=(q:PracticePlayer)=>lossJob(q)==='counter-press'||trapping(q)?{...f.teams[q.side].tactics,press:'aggressive' as const}:f.teams[q.side].tactics;
    const delaying=(q:PracticePlayer)=>lossPlan?.mode==='delay'&&lossJob(q)==='press';
    const candidates=sidePlayers(other(p.side)).filter(q=>q.role!=='GK'&&dist(q,ball)<2.2&&time>=(duelAfter.get(q.id)??0)&&time>=(recovering.get(q.id)?.until??0)&&q.duty!=='wrongfoot')
     .map(q=>({p:q,read:readChallenge(q,p,ball,players,challengeTactics(q),score[p.side]-score[q.side])}))
     .filter(q=>q.read.mode==='challenge'&&!(delaying(q.p)&&q.read.shot.level<=.32)).sort((a,b)=>(b.read.opportunity-b.read.threshold)-(a.read.opportunity-a.read.threshold));
    const candidate=candidates[0];
    if(candidate){
     challenge=startChallenge(candidate.p,p,ball,candidate.read,time);duelAfter.set(candidate.p.id,Math.max(duelAfter.get(candidate.p.id)??0,challenge.resolveAt));stats[candidate.p.side].tackles++;
     choices.push({time,player:rosterIndex.get(candidate.p.id)!,kind:'challenge',reason:candidate.read.reason,challenge:{...candidate.read,opponent:p.id,resolvesAt:challenge.resolveAt}});
    }
   }
   if(challenge&&time>=challenge.resolveAt&&ball.owner===challenge.opponent){
    const attempt=challenge,d=get(attempt.defender);challenge=null;
    const deficit=Math.max(0,score[p.side]-score[d.side]);
    const touch=resolveChallengeContact(d,p,ball,attempt,deficit),reachable=touch.ball,screened=bodyScreensBall(d,p,ball);
    const foul=touch.body&&execution()<touch.foulChance;
    // (duel recovery, 2026-10-16) what the duel did to each man's balance (practice-balance): the hit the carrier took
    // through his leg or body, and the tackler's lunge, absorbed by what his boot met or all his own if it met nothing
    const hit=felt(contactLoad(touch,Math.hypot(p.vx,p.vy)),d,p);
    const tackler=(met:boolean)=>lunged(d,{reach:touch.reach,closing:touch.closingSpeed,followThrough:touch.followThrough,met,hit},balanceDraw());
    const note=(victim:Balance|null,own:Balance)=>Object.assign(events.at(-1)!,{balance:{hit:Math.round(hit*100)/100,victim:victim&&{challenge:Math.round(victim.challenge*100)/100,touch:Math.round(victim.touch*100)/100,down:Math.round(victim.down*100)/100},tackler:{challenge:Math.round(own.challenge*100)/100,down:Math.round(own.down*100)/100}}});
    if(foul){stats[d.side].fouls++;const type=foulRestartFor(p.side,touch.spot);say('foul',type==='penalty'?`${d.name} îl agață pe ${p.name}, în careu. Penalty!`:`${d.name} îl agață pe ${p.name}. Fluier — mingea rămâne la ${f.teams[p.side].name}.`,d,p);Object.assign(events.at(-1)!,{challengeContact:touch});
     const victim=struck(p,hit,hit>0?balanceDraw():1),own=tackler(true);note(victim,own);if(victim.down)events.at(-1)!.text+=` ${p.name} rămâne jos.`;
     startRestart(type,p.side,touch.spot);unbalance(p,victim,d.id);unbalance(d,own,p.id);}
    else if(reachable&&!screened&&time>=(wrongfoot.get(d.id)?.until??0)&&execution()<duelChance(p,d,sidePlayers(d.side).filter(q=>q.id!==d.id&&dist(q,p)<6).length)){
     stats[d.side].tacklesWon++;
     // (regain fixes; duel recovery) the man who lost it is off balance before he can go in again, and cannot take a
     // controlled touch until his foot is down again (before, he had no touch ban here and picked the loose ball
     // straight back up: a tackle that won nothing); the tackler pays for his lunge, mostly absorbed by the ball
     const victim=struck(p,hit,hit>0?balanceDraw():1),own=tackler(true);
     dispossessed={id:p.id,at:time,settled:true};
     const relativeSpeed=Math.hypot(d.vx-p.vx,d.vy-p.vy),clean=execution()<clamp(.25+d.skills.defending*.035+d.skills.control*.025-relativeSpeed*.03,.2,.85);
     const fell=victim.down?` ${p.name} ajunge la pământ.`:'';
     if(clean){say('tackle',`${d.name} pune piciorul pe minge și o scoate din duel.${fell}`,d,p);
      ball={...ball,owner:null,mode:'loose',vx:d.vx*.65,vy:d.vy*.65};lastTouch=d.id;noHandsSide=null;noHandsKeeper='';releaseBy=d.id;releaseAt=time;assignmentAt=0;intended='';prepared=null;firstTouch=null;feint=null;flags=[];
     }
     else {say('tackle',`${d.name} intră la minge și o desprinde din picior.${fell}`,d,p);
     const away=unit(d.x-p.x,d.y-p.y),lateral=execution()<.5?-1:1;
     ball={...ball,owner:null,mode:'loose',vx:away.x*2.5-away.y*lateral*3,vy:away.y*2.5+away.x*lateral*3};lastTouch=d.id;noHandsSide=null;noHandsKeeper='';flags=[];releaseBy=d.id;releaseAt=time;assignmentAt=0;intended='';prepared=null;feint=null;}
     note(victim,own);unbalance(p,victim,d.id,true);unbalance(d,own,p.id);
    }else {
     // he rode it (or it never reached the ball): the lunge that met nothing is all the tackler's own; contact through
     // the man that did not take the ball still jolts him, but he stays up with the ball (p.duelAt: a moment off
     // balance for a shot, practice-shot-contest)
     const own=tackler(touch.body);
     recovering.set(d.id,{until:time+own.challenge*TACKLER_STAGGER,opponent:p.id});unbalance(d,own,p.id);p.duelAt=time;
     say('tackle',`${p.name} păstrează mingea; ${d.name} trebuie să revină.`,p,d);note(null,own);}
   }
   if(ball.owner===p.id&&!feint){
    // Reassess prepared kicks on the player's decision cadence. An outlet may
    // close, but pressure can also disappear: a clearance must not outlive the
    // danger just because the old urgency-based review condition became false.
    // (honest-reads round) A kick whose lane is closing is rechecked while he
    // is still setting it, not only once he is set: over what is left of its
    // release (his set time plus getting his foot to the ball), at most every
    // RELEASE_RECHECK s. Before, it ran only from his set time, on the picture
    // of that instant: a presser was seen when he was already in the lane.
    // (receive round) A clearance too: it was the one kick never re-read while he set it, so it was cleared into the man
    // who had just arrived (the largest group of losses near our own goal). Read past the first foot it must clear: a
    // stride for a lofted one, further for a driven one (clearReach).
    const closedRelease=prepared&&['pass','through','loft','clear'].includes(prepared.option.kind)&&time>=recheckAt&&kickBlocked(p,prepared.option,players,Math.max(0,prepared.at+footToBall(p)-time));
    if(closedRelease)recheckAt=time+RELEASE_RECHECK;
    // (decide round) a kick within the switch deadline of being struck is committed: played unless the picture
    // genuinely changes - its launch is blocked (closedRelease) or a man has got into its lane (LANE_CLOSED on the lane
    // read now) - and looked at again only once it is overdue (practice-receive COMMIT_GRACE)
    const strikeIn=prepared?prepared.at+footToBall(p)-time:Infinity;
    const laneShut=!!prepared?.option.pass&&strikeIn<=SWITCH_DEADLINE&&laneRisk(p,prepared.option.aim,sidePlayers(other(p.side)),prepared.option.pass.speed)>=LANE_CLOSED;
    if(prepared&&!mustRelease&&!inHands&&!closedRelease&&!laneShut&&time>=nextThink&&strikeIn<=SWITCH_DEADLINE&&strikeIn>-COMMIT_GRACE)nextThink=time+STEP;
    else if(prepared&&!mustRelease&&!inHands&&(closedRelease||time>=nextThink)){
     const alternatives=footballOptions(p,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));
     const current=alternatives.filter(o=>o.kind===prepared!.option.kind&&o.target===prepared!.option.target&&!!o.receivingSpace===!!prepared!.option.receivingSpace).sort((a,b)=>dist(a.aim,prepared!.option.aim)-dist(b.aim,prepared!.option.aim))[0];
     if(!current||Math.max(...alternatives.map(o=>o.score))>current.score+.18)prepared=null;
     else prepared.option=prepared.option.hurried?{...current,hurried:true}:current;
     nextThink=prepared?time+.2:time;
    }
    if(time>=nextThink&&!prepared){
     const runs=new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),free=restart&&(restart.kind==='freeKick'||restart.kind==='indirect');let holdUntil=Infinity,available=footballOptions(free?setPiecePlayer({...p,...restart!.spot}):p,players,runs,lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));
     // (decide round) a kick he cannot get away before the man closing him is on him is worth less (priceCaught)
     if(!mustRelease&&!inHands&&!restart)available=priceCaught(p,players,available,time);
     if(mustRelease){available=restart?.kind==='throw'?throwOptions(p,ball,players,available):free?freeKickOptions(p,players,restart!,available,f.teams[p.side].tactics):available.filter(o=>o.kind==='pass'||o.kind==='through'||o.kind==='loft');if(!available.length){const q=sidePlayers(p.side).filter(q=>q.id!==p.id).sort((a,b)=>dist(a,p)-dist(b,p))[0];available=[{kind:'pass',target:q.id,aim:q,score:1,reason:'Reia jocul cu o pasă către colegul apropiat.'}];}}
     if(inHands){
      available=available.filter(o=>o.kind==='pass'||o.kind==='through'||o.kind==='loft');
      if(!available.length){const q=sidePlayers(p.side).filter(q=>q.id!==p.id).sort((a,b)=>dist(a,p)-dist(b,p))[0];available.push({kind:'loft',target:q.id,aim:q,score:.1,reason:'Colegul e departe; caută o repunere lungă.'});}
      // not into a man next to him: round him, or over him from further away (throwIntoMan)
      const men=sidePlayers(other(p.side)).filter(q=>q.role!=='GK').map(q=>keeperSees(p,q)).filter(q=>dist(q,p)<KEEPER_INTO_LEN+1+Math.hypot(q.vx,q.vy)*KEEPER_AHEAD);
      if(men.length){
       const into=new Map(available.map(o=>[o,throwIntoMan(p,o.aim,men,o.kind==='loft')]));
       // while any throw clear of them is on he takes none into them (KEEPER_LAST); otherwise they cost (KEEPER_INTO)
       const clear=available.filter(o=>into.get(o)!<KEEPER_LAST);
       available=(clear.length?clear:available).map(o=>into.get(o)!>0?{...o,score:o.score-KEEPER_INTO*into.get(o)!}:o);
      }
      // (keeper with the ball in his hands) futsal's four seconds: he waits only while a throw can still get away in
      // time, walking to where one opens (keeperMove), and looks again when that runs out (KEEPER_HOLD)
      const best=available.reduce((a,b)=>b.score>a.score?b:a),lead=Math.max(preparationTime(p,best.kind),Math.max(0,Math.abs(angleDiff(Math.atan2(best.aim.y-p.y,best.aim.x-p.x),p.angle))-.32)/KEEPER_TURN);
      if(time-receivedAt+lead+KEEPER_SPARE<KEEPER_HOLD){
       holdUntil=receivedAt+KEEPER_HOLD-lead-KEEPER_SPARE;
       const move=keeperMove(p,sidePlayers(p.side).filter(q=>q.id!==p.id&&q.role!=='GK'),sidePlayers(other(p.side)).filter(q=>q.role!=='GK').map(q=>keeperSees(p,q)));
       const moving=dist(move.spot,p)>.2;
       available.push({kind:'carry',aim:move.spot,score:.38,reason:moving?'Se mută cu mingea în mâini, în careu, unde se deschide o repunere.':'Ține mingea în mâini și așteaptă să se deschidă o soluție de repunere.'});
       keeperLook=move.look;
      }else keeperLook=null;
     }
     // A set taker may wait a moment for team-mates' movement to open a safer option.
     const restartChoice=mustRelease&&restart?.routine?restartOptions(restart,available,time,players):available;
     // A routine's taker plays the rehearsed delivery unless it is clearly off;
     // then he is back on his own judgement (and its waits).
     const rehearsed=mustRelease&&restart?.authored?bookFor(p.side)?.routineDelivery(time,p,restart.kind,restart.spot,available,players,support)??null:null;
     const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);
     if(!rehearsed&&mustRelease&&restart?.routine&&(!restartChoice||restartHold(restart,option,time)))nextThink=time+.25;
     else {
     coaching?.choose(time,p,option);playbook?.decided(time,p,option);
     if(option.carry)carryPlan=commitCarry(p,option as CarryOption,time,carryPlan);else carryPlan=null;
     actionReasons.set(p.id,option.reason);
     choices.push({time,player:rosterIndex.get(p.id)!,kind:option.kind==='feint'?'feint':option.kind==='carry'?'carry':'prepare',action:option.kind,reason:option.reason,carry:option.carry?{...option.carry,aim:{...option.aim},continuing:!!option.continuing,committedUntil:carryPlan!.until}:undefined});
     // (B2, the pressed carrier) and before a man closing him arrives, as soon as his reading lets him (lookAgain)
     nextThink=time+lookCadence(p,option);
     if(inHands){nextThink=Math.min(nextThink,Math.max(time+STEP,holdUntil));keeperStep=option.kind==='carry'&&dist(option.aim,p)>.2?{...option.aim}:null;}
     if(option.kind==='carry')carry=option.aim;
     else if(option.kind==='feint'){stats[p.side].feints++;const marker=get(option.target!);feintMemory.set(p.id,{opponent:marker.id,at:time,attacker:{x:p.x,y:p.y},defender:{x:marker.x,y:marker.y}});feint={attacker:p.id,defender:marker.id,check:time+.26,aim:option.aim,resolved:false,score:option.score,review:time+.41,finish:time+feintDuration(p,option.aim)};say('feint',`${p.name} scoate o fentă din buzunar. ${marker.name} îl așteaptă.`,p,marker);}
     else {
      prepared={option,at:time+preparationTime(p,option.kind)*(option.hurried?HURRY_SHARE:1)};recheckAt=time+RELEASE_RECHECK;
      // Teammates can read their release cue. The private target must not
      // reset the opposing unit's assessment schedule.
      if(option.target&&(option.kind==='through'||option.kind==='loft')&&(option.run||get(option.target).duty==='run')){
       intents.delete(option.target);
      }
     }
     }
    }
    // (keeper with the ball in his hands) a last look: the man on him has stepped into the throw he set, so he holds it
    // and chooses again (once a spell, inside the four seconds)
    if(inHands&&prepared&&!keeperRelook&&time>=prepared.at&&time-receivedAt<KEEPER_HOLD-STEP&&throwIntoMan(p,prepared.option.aim,sidePlayers(other(p.side)).filter(q=>q.role!=='GK').map(q=>keeperSees(p,q)),prepared.option.kind==='loft')>=KEEPER_LAST){keeperRelook=true;prepared=null;nextThink=time;}
    if(prepared&&time>=prepared.at&&(restart||inHands?Math.abs(angleDiff(Math.atan2(prepared.option.aim.y-p.y,prepared.option.aim.x-p.x),p.angle))<.32:controlStrikeReady(p,ball,controlFor(p),prepared.option.aim,prepared.option.kind==='shoot'?'shot':prepared.option.kind==='clear'?'clearance':'pass'))&&(!restart||restartPlayersReady(restart,players,routineRelaxed(restart,time))&&(restart.kind==='throw'||controlReleaseAvailable(p,ball,prepared.option.aim)))){
     releaseOption(prepared.option.hurried?{...p,skills:{...p.skills,passing:Math.max(1,p.skills.passing-HURRY_POINTS)}}:p,prepared.option);
    }
   }
   }
  }else{
   const goalThreats=new Set(players.filter(p=>p.role==='GK'&&p.side!==side&&goalBoundFlight(p,ball)).map(p=>p.id));
   const before={...ball};advanceFlight(ball);
   const exit=pitchExit(before,ball),boundary=exit?.fraction??Infinity;
   const hits=players.flatMap(p=>{
    const intercepting=ball.mode==='pass'&&p.role!=='GK'&&!!releaseBy&&get(releaseBy).side!==p.side;
    const state=controlFor(p),meeting=receivingContact(p,old.get(p.id)!,before,ball,state,time,STEP,time>=(duelAfter.get('touch:'+p.id)??0),intercepting);
    const feet=meeting?.fraction??null;
    const previous=old.get(p.id)!,normal=unit(before.x-previous.x,before.y-previous.y);
    const separating=before.z<=1.1&&dist(before,previous)<=.310001&&(before.vx-p.vx)*normal.x+(before.vy-p.vy)*normal.y>=-1e-8;
    const torso=separating?null:flightContact(before,ball,previous,p,.31,1.1);
    // (box defending) a defender set to block puts a leg across a low shot (blockLeg)
    const leg=!separating&&ball.mode==='shot'&&p.duty==='block'&&p.role!=='GK'&&!!releaseBy&&get(releaseBy).side!==p.side?flightContact(before,ball,previous,p,blockLeg(p),BLOCK_LEG_HEIGHT):null;
    const body=torso===null?leg:leg===null?torso:Math.min(torso,leg);
    const area=p.side===0?{minX:0,maxX:BOX_DEPTH,minY:-BOX_HALF,maxY:BOX_HALF}:{minX:(L-BOX_DEPTH),maxX:L,minY:-BOX_HALF,maxY:BOX_HALF};
    const handRadius=goalThreats.has(p.id)?keeperReach(p,time-releaseAt,edgeOf(p)):aerialDelivery?1.1:.72+(p.side===side?.15:0);
    const catchAt=canUseHands(p)&&time>=(duelAfter.get('touch:'+p.id)??0)?flightContact(before,ball,previous,p,handRadius,2.3,area):null;
    const preparation=aerialPreparations.get(p.id),aerialAt=preparation&&time>=(duelAfter.get('touch:'+p.id)??0)?aerialContact(p,previous,before,ball,preparation.meeting.technique,time-preparation.since):null;
    // (contests in the air) a defender attacking the ball gets his head or body to it if it passes within his reach
    // ... and the man he is attacking it against goes up with him when he is right there
    const attack=!preparation&&ball.mode!=='shot'?airAttacks.get(p.id):undefined;
    const upWith=!preparation&&!attack&&ball.mode==='pass'&&p.side===side&&p.id===flight.receiver&&[...airAttacks].some(([id,a])=>a.release===releaseAt&&time-a.since>=AIR_SET&&dist(get(id),ball)<=AIR_REACH+AIR_UP_WITH);
    const challengeAt=(attack&&time-attack.since>=AIR_SET||upWith)&&time>=(duelAfter.get('touch:'+p.id)??0)?flightContact(before,ball,previous,p,challengeReach(p),STANDING_HEAD+jumpReach(p),undefined,AIR_MIN):null;
    const first=Math.min(feet??Infinity,body??Infinity,catchAt??Infinity,aerialAt??Infinity,challengeAt??Infinity),hands=catchAt===first,t=Number.isFinite(first)?first:null;
    if(t===null||t>boundary)return [];
    const gap=Math.hypot(before.x+(ball.x-before.x)*t-previous.x-(p.x-previous.x)*t,before.y+(ball.y-before.y)*t-previous.y-(p.y-previous.y)*t);
    return [{p,t,hands,aerial:!hands&&aerialAt===t?preparation:undefined,meeting:!hands&&feet===t?meeting:null,challenge:!hands&&challengeAt===t&&feet!==t&&body!==t&&aerialAt!==t,gap,id:p.id}];
   }).sort(compareFlightContacts);
   const hit=hits[0];
   // (contests in the air) the opponent nearest the ball who can get his head to it now, as the first man touches it
   const airChallenger=(p:PracticePlayer,t:number):{toucher:AirMan;challenger:AirMan}|undefined=>{
    let best:AirMan|undefined,gap=Infinity;
    for(const q of players){
     if(q.side===p.side||q.role==='GK'||ball.z>STANDING_HEAD+jumpReach(q))continue;
     if(time<(duelAfter.get('touch:'+q.id)??0)||time<(wrongfoot.get(q.id)?.until??0)||time<(recovering.get(q.id)?.until??0))continue;
     const o=old.get(q.id)!,body={x:o.x+(q.x-o.x)*t,y:o.y+(q.y-o.y)*t},d=dist(body,ball);
     if(d>AIR_REACH||d>=gap)continue;
     best={p:q,body,velocity:{x:q.vx,y:q.vy},first:false};gap=d;
    }
    const o=old.get(p.id)!;
    return best?{toucher:{p,body:{x:o.x+(p.x-o.x)*t,y:o.y+(p.y-o.y)*t},velocity:{x:p.vx,y:p.vy},first:true},challenger:best}:undefined;
   };
   if(hit){
    const p=hit.p;Object.assign(ball,before);advanceFlight(ball,STEP*hit.t);
    const secondTouch=p.id===restartKicker;if(!secondTouch){restartKicker='';restrictedGoal=false;}
    if(secondTouch){say('foul',`${p.name} atinge din nou mingea înaintea altui jucător. Lovitură indirectă.`,p);startRestart('indirect',other(p.side),p);}
    else if(flags.includes(p.id)){stats[p.side].offsides++;say('offside',`${p.name} ajunge la minge, dar fanionul e sus. Plecase prea devreme.`,p);startRestart('indirect',other(p.side),p);}
    else if((ball.mode==='shot'||goalThreats.has(p.id))&&p.side!==side){
     const previous=old.get(p.id)!,dive=dives.get(p.id);
     const handling=hit.hands?keeperHandling({...p,x:previous.x+(p.x-previous.x)*hit.t,y:previous.y+(p.y-previous.y)*hit.t},ball,{gap:hit.gap,reach:keeperReach(p,time-releaseAt,edgeOf(p)),edge:edgeOf(p),shotAge:time-releaseAt,diving:!!dive&&time<dive.until,recovering:!!dive&&time>=dive.until&&time<dive.recoverUntil},sidePlayers(other(p.side))):null;
     if(handling&&execution()<handling.catchChance){own(p,'save',true);}
     else{if(hit.hands)stats[p.side].saves++;say(hit.hands?'save':'block',hit.hands?`${p.name} respinge! Mingea rămâne în joc.`:`${p.name} blochează șutul. Se joacă în continuare!`,p);
      if(handling)Object.assign(ball,handling.parry);else deflectBodyBall(ball,{x:previous.x+(p.x-previous.x)*hit.t,y:previous.y+(p.y-previous.y)*hit.t},{x:p.vx,y:p.vy});ball.mode='loose';noteTouch(p.id);duelAfter.set('touch:'+p.id,time+.4);releaseAt=time;releaseBy=p.id;intended='';assignmentAt=0;
      const state=controlFor(p),impact={x:ball.x,y:ball.y};rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t);collectContacts(state);resolveExit(impact);}
    }else if(hit.hands){own(p,p.side===side?'receive':'save',true);
    }else {
     const same=p.side===side,state=controlFor(p),point={x:ball.x,y:ball.y};
     // (contests in the air, 2026-10-15) a ball touched at head or chest height with an opponent close enough to
     // get his head to it is a contest, not simply the first body's (practice-air-duel)
     const contest=!hit.meeting&&p.role!=='GK'&&ball.mode!=='shot'&&ball.z>=AIR_MIN?airChallenger(p,hit.t):undefined;
     const duel=contest?resolveAirDuel(contest.toucher,contest.challenger,ball,side,q=>Math.max(0,score[other(q.side)]-score[q.side]),airRandom):undefined;
     const noteDuel=(result:string)=>{if(!contest||!duel)return;const c=contest.challenger.p,attacker=p.side===side?p:c,defender=p.side===side?c:p;
      aerialDuels.push({time,x:point.x,y:point.y,z:ball.z,attacker:attacker.id,defender:defender.id,toucher:p.id,winner:duel.winner.id,outcome:duel.outcome,result,way:duel.way,chance:Math.round(duel.chance*1000)/1000});};
     if(contest&&duel){
      const c=contest.challenger.p;aerialPreparations.delete(p.id);aerialPreparations.delete(c.id);
      // the man who lost it lands a moment later than the one who won it
      duelAfter.set('touch:'+duel.loser.id,Math.max(duelAfter.get('touch:'+duel.loser.id)??0,time+AIR_LAND));duelAfter.set(duel.loser.id,Math.max(duelAfter.get(duel.loser.id)??0,time+AIR_LAND_CHALLENGE));
     }
     if(contest&&duel&&duel.outcome==='foul'){
      const fouler=duel.fouler!,victim=duel.winner,spot={x:ball.x,y:ball.y},type=foulRestartFor(victim.side,spot);stats[fouler.side].fouls++;
      say('foul',type==='penalty'?`${fouler.name} sare prin spatele lui ${victim.name} în duelul aerian, în careu. Penalty!`:`${fouler.name} sare prin spatele lui ${victim.name} în duelul aerian. Fault.`,fouler,victim);
      noteDuel('foul');startRestart(type,victim.side,spot);
     }else if(contest&&duel&&(duel.winner!==p||duel.outcome==='knock')||hit.challenge){
      // the winner of the contest, or a defender who attacked the ball and got to it with nobody on him
      const w:AirMan=contest&&duel?(duel.winner===p?contest.toucher:contest.challenger):{p,body:{x:old.get(p.id)!.x+(p.x-old.get(p.id)!.x)*hit.t,y:old.get(p.id)!.y+(p.y-old.get(p.id)!.y)*hit.t},velocity:{x:p.vx,y:p.vy},first:true};
      const outcome=duel?duel.outcome:airRandom()<clamp(AIR_UNCONTESTED+AIR_CLEAN_SKILL*(p.skills.aerial-5),.2,.92)?'clean':'knock';
      airAttacks.delete(p.id);if(contest)airAttacks.delete(contest.challenger.p.id);
      const q=w.p,body={...q,x:w.body.x,y:w.body.y},wstate=controlFor(q);
      const incoming={x:ball.vx,y:ball.vy,z:ball.z,vz:ball.vz},contactTime=time-STEP+STEP*hit.t,facing=Math.atan2(-ball.vy,-ball.vx);
      let released=false,result='knock';
      if(outcome==='clean'&&ball.z>=aerialContactShape.header.min){
       // he wins it with his head: the best header his body can make from here
       const runs=new Set(players.filter(r=>r.duty==='run').map(r=>r.id));
       const available=footballOptions({...body,angle:facing},players,runs,releaseBy,0,null,time,q.side===side?support:null);
       let best:{option:Option;plan:AerialKick;body:PracticePlayer;score:number}|undefined;
       for(const option of available){
        if(!['pass','through','loft','shoot','clear'].includes(option.kind))continue;
        const angle=facing+clamp(angleDiff(Math.atan2(option.aim.y-ball.y,option.aim.x-ball.x),facing),-1.05,1.05),turned={...body,angle};
        const plan=readAerialKick(turned,ball,'header',option);if(!plan)continue;
        const value=option.score-plan.difficulty*.23;if(!best||value>best.score)best={option,plan,body:turned,score:value};
       }
       // a defender with nothing better heads it away: upfield, as far as his neck allows, inside the way he faces
       if(!best&&q.side!==side){
        const away=q.side===0?0:Math.PI;
        for(const turn of [0,-.5,.5,-1,1])if(!best)for(const length of [14,11,8]){
         const heading=away+turn;if(Math.abs(angleDiff(heading,facing))>1.05)continue;
         const aim=inside({x:ball.x+Math.cos(heading)*length,y:ball.y+Math.sin(heading)*length}),option:Option={kind:'clear',clearance:'long',aim,score:0,reason:'Câștigă mingea în aer și o respinge cu capul.'};
         const turned={...body,angle:facing+clamp(angleDiff(Math.atan2(aim.y-ball.y,aim.x-ball.x),facing),-1.05,1.05)};
         const plan=readAerialKick(turned,ball,'header',option);if(plan){best={option,plan,body:turned,score:0};break;}
        }
       }
       if(best){
        const arriving={...ball};own(q,q.side===side?'receive':'turnover');Object.assign(ball,arriving);
        released=releaseOption(best.body,best.option,true,{technique:'header',plan:best.plan});
        if(released){result=best.option.kind==='shoot'?'header-shot':best.option.kind==='clear'?'header-clear':'header-pass';
         wstate.contacts.push({actor:q.id,time:contactTime,x:ball.x,y:ball.y,z:ball.z,kind:best.option.kind==='shoot'?'shot':best.option.kind==='clear'?'clearance':'pass',technique:'header',body:{x:body.x,y:body.y,angle:best.body.angle},incoming,outgoing:{x:ball.vx,y:ball.vy,z:ball.z,vz:ball.vz}});const e=events.at(-1);if(e&&e.actor===q.id&&e.text.startsWith(q.name+' '))e.text=`${q.name} ${contest?'câștigă duelul aerian și':'atacă mingea în aer și'} ${e.text.slice(q.name.length+1)}`;}
       }
      }else if(outcome==='clean'){
       // lower: he gets in front and takes it on the chest
       Object.assign(ball,cushionChest({...body,angle:facing},ball,.8,airRandom));ball.owner=null;ball.mode='loose';intended='';result='cushion';
       wstate.contacts.push({actor:q.id,time:contactTime,x:ball.x,y:ball.y,z:ball.z,kind:'settle',technique:'chest',body:{x:body.x,y:body.y,angle:facing},incoming,outgoing:{x:ball.vx,y:ball.vy,z:ball.z,vz:ball.vz}});
      }
      if(!released&&result==='knock'){
       // it comes off him: a knock-down, a flick nobody meant
       const speed=Math.hypot(ball.vx,ball.vy),keep=.2+airRandom()*.35,angle=Math.atan2(ball.vy,ball.vx)+(airRandom()-.5)*2*KNOCK_SPREAD;
       ball.vx=Math.cos(angle)*speed*keep;ball.vy=Math.sin(angle)*speed*keep;ball.vz=1+airRandom()*2.5;ball.owner=null;ball.mode='loose';intended='';
       wstate.contacts.push({actor:q.id,time:contactTime,x:ball.x,y:ball.y,z:ball.z,kind:'body',technique:ball.z>=aerialContactShape.header.min?'header':'chest',body:{x:body.x,y:body.y,angle:facing},incoming,outgoing:{x:ball.vx,y:ball.vy,z:ball.z,vz:ball.vz}});
      }
      if(!released){lastTouch=q.id;releaseAt=time;releaseBy=q.id;}
      duelAfter.set('touch:'+q.id,time+.18);assignmentAt=0;noteDuel(result);if(!contest)airChallenges.push({time,id:q.id,result});
      const lost=rollControlRemainder(ball,players,old,wstate,time-STEP,STEP,hit.t);collectContacts(wstate);
      if(lost){ball.owner=null;ball.mode='loose';intended='';}resolveExit(point);
     }else if(hit.aerial){
      if(contest)noteDuel(hit.aerial.meeting.technique==='chest'?'cushion':hit.aerial.option?.kind==='shoot'?'header-shot':hit.aerial.option?.kind==='clear'?'header-clear':'header-pass');
      const preparation=hit.aerial,technique=preparation.meeting.technique,previous=old.get(p.id)!;
      const body={...p,x:previous.x+(p.x-previous.x)*hit.t,y:previous.y+(p.y-previous.y)*hit.t};
      const incoming={x:ball.vx,y:ball.vy,z:ball.z,vz:ball.vz},contactTime=time-STEP+STEP*hit.t;
      const pressure=clamp((4-Math.min(...sidePlayers(other(p.side)).map(q=>dist(q,ball))))/4,0,1);
      let released=false;
      if(technique==='chest'){
       Object.assign(ball,cushionChest(body,ball,pressure,execution));ball.owner=null;
       if(!same){ball.mode='loose';intended='';}
       // A chest cushion is a touch, not yet a completed reception. Keep the
       // incoming pass attribution until a later foot contact secures it.
      }else{
       const available=footballOptions(body,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),releaseBy,0,null,time,support);
       const option=available.filter(o=>o.kind===preparation.option?.kind&&o.target===preparation.option?.target).sort((a,b)=>b.score-a.score)[0];
       const plan=option?readAerialKick(body,ball,technique,option):null;
       if(option&&plan&&option.score>=Math.max(...available.map(o=>o.score))-.18&&(!bookFor(body.side)||bookFor(body.side)!.canRelease(time,body,option,players,ball,support))){
        const arriving={...ball};own(p,same?'receive':'turnover');Object.assign(ball,arriving);
        released=releaseOption(body,option,true,{technique,plan});
       }
       if(!released){deflectBodyBall(ball,body,{x:p.vx,y:p.vy});ball.owner=null;ball.mode='loose';intended='';}
      }
      state.contacts.push({actor:p.id,time:contactTime,x:ball.x,y:ball.y,z:ball.z,kind:released?(preparation.option?.kind==='shoot'?'shot':preparation.option?.kind==='clear'?'clearance':'pass'):technique==='chest'?'settle':'body',technique,body:{x:body.x,y:body.y,angle:p.angle},incoming,outgoing:{x:ball.vx,y:ball.vy,z:ball.z,vz:ball.vz}});
      aerialPreparations.delete(p.id);duelAfter.set('touch:'+p.id,time+.18);assignmentAt=0;
      const lost=rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t);collectContacts(state);
      if(lost){ball.owner=null;ball.mode='loose';intended='';}resolveExit(point);
     }else if(hit.meeting){
      const opponents=players.filter(q=>q.side!==p.side),pressed=opponents.some(q=>dist(q,ball)<2.5);
      let plan=continuation?.receiver===p.id&&continuation.release===releaseAt?continuation:defenderPlan?.receiver===p.id&&defenderPlan.release===releaseAt?defenderPlan:null;
      const runs=new Set(players.filter(q=>q.duty==='run').map(q=>q.id));
      // A defender clears for his own side: his plan reads options without the attack's support plan.
      const clearingPlan=!!plan&&plan===defenderPlan&&plan.option.kind==='clear';
      // Reflex: with an opponent on top of him in his own box, a defender meeting
      // the opponents' ball may hack it clear first time, like a planned clearance.
      const reflex=!plan&&!same&&p.role!=='GK'&&opponents.some(q=>dist(q,ball)<2)&&depth(p.side,ball.x)<=BOX_DEPTH+1&&Math.abs(ball.y)<=BOX_HALF+1;
      const defending=clearingPlan||reflex;
      const fresh=plan||reflex?footballOptions(hit.meeting.body,players,runs,releaseBy,0,null,time,defending||!same?null:support):[];
      // A clearance goes wherever his body can strike it now, among his best options.
      const top=Math.max(...fresh.map(o=>o.score)),body=hit.meeting.body;
      const match=(o:Option)=>fresh.filter(x=>sameIntention(x,o)).sort((a,b)=>dist(a.aim,o.aim)-dist(b.aim,o.aim))[0];
      const next=defending?fresh.filter(o=>o.kind==='clear'&&o.score>=top-.14&&strikeStance(body,ball,o.aim,'clearance').available&&controlReleaseAvailable(body,ball,o.aim)).sort((a,b)=>b.score-a.score)[0]
       :plan?match(plan.option):undefined;
      if(reflex&&next)plan={receiver:p.id,release:releaseAt,option:next,since:-Infinity,checked:time,first:true,room:0,alt:undefined};
      // (decide round) the plan he arrived with is played unless the picture at the touch has clearly changed: its lane
      // closed, it is gone, or another option is PLAN_KEEP better (before 0.08: a fresh look re-chose it); otherwise his
      // ranked second, if that is still on, after a touch (practice-receive PLAN_KEEP)
      const still=(o:Option|undefined)=>o&&o.score>=top-(defending?.14:PLAN_KEEP)&&(o.kind==='clear'?launchRisk(body,o.aim,players,0,clearReach(o))<.5:(o.carry?.obstruction??o.pass?.risk??o.loft?.risk??laneRisk(p,o.aim,opponents,22))<.32)?o:undefined;
      let viable=still(next),switched=false;
      if(!viable&&plan?.alt&&!defending){viable=still(match(plan.alt));switched=!!viable;}
      // (receive round) His first touch serves the plan he read in flight: a kick he meant to set is set towards it (the
      // settle still reads the men round him), unless a man is already on him at the touch (within ON_TOUCH m), when it
      // protects the ball away from him first. A carry's touch, or a reception with no plan, is as before: away from a man
      // within 2.5 m, else into the carry's space or simply stopped.
      const onHim=opponents.some(q=>dist(q,ball)<ON_TOUCH),setting=!!viable&&viable.kind!=='carry'&&!onHim;
      let firstAim=setting?viable!.aim:pressed?recoveryTouch(hit.meeting.body,players):viable?.aim;
      const contactTime=time-STEP+STEP*hit.t,relativeSpeed=Math.hypot(ball.vx-p.vx,ball.vy-p.vy);
      const foot=state.feet.find(f=>f.side===hit.meeting!.foot.side)!,endFoot={...foot};Object.assign(foot,hit.meeting.foot);state.time=contactTime;
      // First time only when his read said so (plan.first), for the plan itself (not his second, switched to at the
      // contact); the physical gates: a plan he has had at least a reaction's time (SHAPE_MIN; one held for less than
      // the switch deadline is struck less accurately: lateStrike, below), a ball he can strike through, and a stance
      // from which the kick is on. (decide round: before, a plan held 0.13 s + 0.012 s a reading point short of 10.)
      let direct=!!viable&&!switched&&viable.kind!=='carry'&&!!plan&&plan.first&&time-plan.since>=SHAPE_MIN&&relativeSpeed<7+p.skills.control*.75&&controlStrikeReady(hit.meeting.body,ball,state,viable.aim,viable.kind==='shoot'?'shot':viable.kind==='clear'?'clearance':'pass');
      const planLate=direct&&plan?lateStrike(time-plan.since):0;
      // (contest round) a team-mate's pass met with a defender's foot able to get to it: the touch is a duel
      // (practice-duel.ts). A planned first-time ball is gone before the man can contest the touch.
      const duel=!direct&&same&&p.role!=='GK'&&ball.mode==='pass'&&!!releaseBy&&releaseBy!==p.id&&get(releaseBy).side===p.side?receptionDuel(p,body,old,hit.t,point,relativeSpeed):null;
      const duelist=duel?get(duel.defender):undefined,attackGoal={x:world(p.side,L),y:0};
      if(duel&&duelist&&(duel.outcome==='nicked'||duel.outcome==='foul')){
       Object.assign(foot,endFoot);
       if(duel.outcome==='foul'){
        stats[duelist.side].fouls++;const spot={x:body.x,y:body.y},type=foulRestartFor(p.side,spot);
        say('foul',type==='penalty'?`${duelist.name} intră prin ${p.name} la preluare, în careu. Penalty!`:`${duelist.name} intră prin ${p.name} la preluare. Fluier — mingea rămâne la ${f.teams[p.side].name}.`,duelist,p);
        startRestart(type,p.side,spot);
       }else{
        // his foot gets there first: on it (it stays with him) or poked away from the receiver
        const incoming={x:ball.vx,y:ball.vy},at=duel.defenderAt;
        if(duel.cleanNick){const ahead={x:at.x+duelist.vx*.25,y:at.y+duelist.vy*.25},gap=dist(ahead,ball),dir=unit(ahead.x-ball.x,ahead.y-ball.y),pace=Math.min(4,gap/.25);ball.vx=dir.x*pace;ball.vy=dir.y*pace;}
        else{const away=unit(at.x-body.x,at.y-body.y),lateral=duelDraw()<.5?-1:1;ball.vx=away.x*2.5-away.y*lateral*3;ball.vy=away.y*2.5+away.x*lateral*3;}
        if(ball.z<.25){ball.z=0;ball.vz=0;}
        state.contacts.push({actor:duelist.id,time:contactTime,x:ball.x,y:ball.y,kind:'push',body:{x:at.x,y:at.y,angle:duelist.angle},incoming,outgoing:{x:ball.vx,y:ball.vy}});
        say('tackle',duel.cleanNick?`${duelist.name} iese în fața lui ${p.name} și îi ia mingea la preluare.`:`${duelist.name} se întinde și i-o scoate din picior lui ${p.name} la preluare.`,duelist,p);
        // the receiver is off balance a moment, as after a lost tackle (duel recovery: practice-balance). A foot in
        // front of him took only the ball; one that came from tight on his back (goalTight) went through him to get it
        const jolt=duel.cleanNick?0:felt(duel.closing*duel.goalTight*LEG_AFTER_BALL,duelist,p);
        unbalance(p,struck(p,jolt,jolt>0?balanceDraw():1),duelist.id,true);dispossessed={id:p.id,at:time,settled:true};
        ball.owner=null;ball.mode='loose';intended='';assignmentAt=0;releaseBy=duelist.id;releaseAt=time;noHandsSide=null;noHandsKeeper='';flags=[];
        rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t);collectContacts(state);state.time=time;resolveExit(point);
       }
      }else{
      if(duel&&duelist){
       if(duel.outcome==='forced'){
        // he keeps it but cannot turn: a nervous receiver lays it off first time, a composed one shields it
        const lay=duel.layoff?layOff(p,body,state,opponents,duel.defenderAt):undefined;
        if(lay){viable=lay;direct=true;}else firstAim=shieldTouch(body,duel.defenderAt,attackGoal,inside);
       }else if(duel.outcome==='turned'){
        // the man lunged and missed: he goes round him, towards goal
        firstAim=turnTouch(body,duel.defenderAt,attackGoal,inside);
        const until=time+TURNED_TIME+duel.closing*.03;
        wrongfoot.set(duelist.id,{until,aim:inside({x:duel.defenderAt.x+duelist.vx*.4,y:duel.defenderAt.y+duelist.vy*.4}),reason:'A intrat la minge și a fost întors; are nevoie de timp să revină.'});duelAfter.set(duelist.id,Math.max(duelAfter.get(duelist.id)??0,until));
       }
       // a lunge that missed costs him his balance (duel recovery: practice-balance lunged; before, a fixed 0.45 s): his
       // reach to the ball and closing speed, all his own to arrest since his foot met nothing. Turned, he also has
       // to turn round (wrongfoot, above)
       if(duel.commit){
        const followThrough=followThroughOf(duelist,duel.closing,Math.max(0,score[p.side]-score[duelist.side]));
        const own=lunged(duelist,{reach:Math.min(1.3,duel.gap+followThrough),closing:duel.closing,followThrough,met:false,hit:0},1);
        if(duel.outcome!=='turned')recovering.set(duelist.id,{until:time+own.challenge*TACKLER_STAGGER,opponent:p.id});unbalance(duelist,own,p.id);
       }
       // (contest combine) he came out of a duel with the ball (rode a lunge, or held a man off his back): a moment
       // off balance for a shot, as after a tackle he rode (practice-shot-contest DUEL_FADE)
       if(duel.outcome==='turned'||duel.outcome==='forced'||duel.commit&&duel.outcome==='clean')p.duelAt=time;
      }
      let released=false,received=false;
      if(direct&&viable){
       // Contact was reached and the outgoing lane/body alignment is still valid.
       // Receiving speed increases execution difficulty; it never guarantees a pass.
       const incoming={...ball};own(p,same?'receive':'turnover');Object.assign(ball,incoming);received=true;state.time=contactTime;
       // the pace he strikes through (practice-receive FT_PASSING, FT_FINISHING) and a plan made late (LATE_POINTS)
       const load=strikeLoad(relativeSpeed),late=LATE_POINTS*planLate,striker={...hit.meeting.body,skills:{...p.skills,passing:Math.max(1,p.skills.passing-load*FT_PASSING-late),finishing:Math.max(1,p.skills.finishing-load*FT_FINISHING-late)}};
       released=releaseOption(striker,viable,true);
       // A rejected outgoing strike falls back to one cushion, keeping the reception counted once.
      }
      Object.assign(foot,endFoot);
      const arriving={x:ball.vx,y:ball.vy};
      if(!released)cushionControl(ball,state,hit.meeting,contactTime,firstAim?{aim:firstAim,opponents,release:setting&&!duel&&firstAim===viable?.aim}:undefined);
      // (contest round) the fought-for touch comes off his foot: a heavy touch, running on or off to the side
      const spilled=!released&&duel?.outcome==='loose';
      if(spilled){
       const firm=clamp((relativeSpeed-6)/8,0,1),angle=Math.atan2(arriving.y,arriving.x)+(duelDraw()-.5)*2.4,pace=1.8+firm*2.5+duelDraw()*1.2;
       ball.vx=p.vx*.3+Math.cos(angle)*pace;ball.vy=p.vy*.3+Math.sin(angle)*pace;
       if(state.lastTouch)state.lastTouch.outgoing={x:ball.vx,y:ball.vy};
      }
      const lost=rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t)||spilled;collectContacts(state);state.time=time;
      if(released){if(lost){ball.mode='loose';intended='';}resolveExit(point);}
      else if(!lost&&!pitchExit(point,ball)){
       if(!received)own(p,same?'receive':'turnover');else {ball.owner=p.id;ball.mode='control';}
       if(firstAim){firstTouch=null;carry=firstAim;}
       // (decide round) a carry he arrived with is a decision like one made on the ball: he looks again on the same
       // cadence (before: 0.2 s after the touch, so most planned carries were re-chosen at once)
       if(viable?.kind==='carry'){carryPlan=commitCarry(p,viable as CarryOption,time,null);actionReasons.set(p.id,viable.reason);nextThink=time+lookCadence(p,viable);}
       else if(viable&&plan){prepared={option:viable,at:Math.max(time,(switched?time:plan.since)+preparationTime(p,viable.kind))};recheckAt=time+RELEASE_RECHECK;nextThink=time+.15;}
      }
      else {ball.owner=null;ball.mode='loose';intended='';assignmentAt=0;resolveExit(point);}
      }

     }else{
      if(contest)noteDuel('body');
      const body={x:old.get(p.id)!.x+(p.x-old.get(p.id)!.x)*hit.t,y:old.get(p.id)!.y+(p.y-old.get(p.id)!.y)*hit.t};
      const incoming={x:ball.vx,y:ball.vy};deflectBodyBall(ball,body,{x:p.vx,y:p.vy});
      state.contacts.push({actor:p.id,time:time-STEP+STEP*hit.t,x:ball.x,y:ball.y,kind:'body',body:{...body,angle:p.angle},incoming,outgoing:{x:ball.vx,y:ball.vy}});
      ball.mode='loose';ball.owner=null;lastTouch=p.id;intended='';assignmentAt=0;
      rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t);collectContacts(state);resolveExit(point);
     }
     // (contest combine) the winner of a duel in the air is still landing: a moment off balance for his next shot (set
     // after his own touch, so a header won in the duel is not counted twice: the man on him already is)
     if(contest&&duel&&duel.outcome!=='foul')duel.winner.duelAt=time;
    }
   }else if(exit)resolveExit(before);
  }
  if(tick%frameStride===0||needsFrame)frame();if(tick%1800===0)progress?.(time);
 }
 for(const b of playbooks)b.end(time,'end');
 say('end',`Fluier final. ${span(duration)}, destule povești pentru marginea terenului.`);frame();
 return {version:PRACTICE_VERSION,seed:f.seed,duration,...(lastAttack?{played:time}:{}),teams:[f.teams[0].name,f.teams[1].name],players:roster,frames,events,choices,stats,score,controlContacts:record?controlContacts:undefined,...(record?{receptionDuels}:{}),...(record&&aerialDuels.length?{aerialDuels}:{}),...(record&&airChallenges.length?{aerialChallenges:airChallenges}:{}),...(playbooks.length?{playbookSelections:playbooks.flatMap(b=>b.selections.map(sel=>({...sel,side:b.config.side}))),...(playbooks.some(b=>b.standing.notes.length)?{standingNotes:playbooks.flatMap(b=>b.standing.notes)}:{})}:{}),...(coaching?{coachingNotes:coaching.notes}:{}),...(orders.length?{substitutionNotes:orderNotes}:{})};
}
export function samplePractice(r:PracticeResult,t:number):PracticeFrame{
 const time=clamp(t,0,r.played??r.duration);let lo=0,hi=r.frames.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(r.frames[mid].time<=time)lo=mid;else hi=mid-1;}
 const a=r.frames[lo],b=r.frames[Math.min(lo+1,r.frames.length-1)];
 if(a===b||a.restart!==b.restart||a.half!==b.half||b.cut||!!a.lineup!==!!b.lineup||!!a.lineup?.some((n,i)=>n!==b.lineup?.[i]))return a;
 const u=clamp((time-a.time)/Math.max(.001,b.time-a.time),0,1),mix=(x:number,y:number)=>x+(y-x)*u;
 return {...a,time,players:a.players.map((p,i)=>({...p,x:mix(p.x,b.players[i].x),y:mix(p.y,b.players[i].y),angle:p.angle+angleDiff(b.players[i].angle,p.angle)*u})),ball:{...a.ball,x:mix(a.ball.x,b.ball.x),y:mix(a.ball.y,b.ball.y),z:mix(a.ball.z,b.ball.z)},control:a.control&&b.control?.owner===a.control.owner?{owner:a.control.owner,feet:a.control.feet.map((f,i)=>({...f,x:mix(f.x,b.control!.feet[i].x),y:mix(f.y,b.control!.feet[i].y)}))}:a.control};
}

/** The second half uses a rotated display of the same team-relative football coordinates. */
export function orientPracticeFrame(f:PracticeFrame):PracticeFrame{
 if(f.half===1)return f;
 const point=(p:Vec)=>({x:L-p.x,y:-p.y});
 return {...f,players:f.players.map(p=>({...p,...point(p),vx:-p.vx,vy:-p.vy,angle:p.angle+Math.PI})),
  ball:{...f.ball,...point(f.ball),vx:-f.ball.vx,vy:-f.ball.vy},
  restartInfo:f.restartInfo?{...f.restartInfo,spot:point(f.restartInfo.spot)}:undefined,
  control:f.control?{owner:f.control.owner,feet:f.control.feet.map(foot=>({...foot,...point(foot)}))}:undefined};
}
