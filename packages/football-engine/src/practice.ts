import type {StandingNote} from './practice-standing.js';
import {aerialMeetings,reachesAerialMeeting,openAerialMeeting,aerialContact,readAerialKick,strikeAerial,cushionChest} from './practice-aerial.js';
import type {AerialTechnique,AerialMeeting,AerialKick} from './practice-aerial.js';
import {approachForSituation,approachOptions} from './team-approach.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {FootballCoaching} from './practice-coaching.js';
import type {CoachingIntent,CoachingNote} from './practice-coaching.js';
import {PracticePlaybook,validateTrainingSetup} from './practice-playbook.js';
import type {PlaybookConfig,PlaybookSelection,TrainingSetup} from './practice-playbook.js';
import {previewLessonRecognition} from './practice-recognition.js';
import type {LessonSpec} from './practice-lesson.js';
import {throwOptions,strikeThrow} from './practice-throw.js';
import {keeperReadyPosition,readKeeperFlight,keeperHandling,keeperSweepReach,keeperSweepDepth,keeperRead,keeperLineDepth,keeperSweepNeed,SWEEP_READ_SPREAD} from './practice-keeper.js';
import {coordinateFootball,CoordinationPlan,FootballJob} from './practice-coordination.js';
import {Fixture,Player,Role,Side,Skills,Traits,Tactics,clamp,rng,shapes} from './model.js';
import {MovingPlayer,MovingBall,Vec,steer,steerMotion,contact,STEP} from './movement.js';
import {receptionTarget} from './decisions.js';
import {practiceFixture} from './practice-data.js';
import {carryOptions,chooseFootballOption,commitCarry,CarryPlan,CarryAssessment,CarryOption} from './practice-carry.js';
import type {ShotAssessment} from './practice-football.js';
import {assessShot,strikeShot,keeperReach,goalBoundFlight,markPosition,goalAngle,pitchExit} from './practice-football.js';
import {arrivalTime,assignDefense,containMovement,coverPosition,shootingThreat,DefenseAssignment,assignFlight,assignMarking,FlightAssignment,runnerBehindShoulder,runnerPickupDelay} from './practice-defense.js';
import {offGoalLine} from './practice-defending.js';
import {duelChance,readChallenge,startChallenge,bodyScreensBall,recoveryPosition,resolveChallengeContact,beatenRecovery,BEATEN_WINDOW,BEATEN_NEAR,BEATEN_TOUCH,ChallengeContact,ChallengeRead,ChallengeAttempt} from './practice-challenge.js';
import {possessionSafety,lookAgain,securePossessionOptions,feltPressure,recoveryTouch,preparationTime,strikeClearance,launchRisk,ClearanceIntent,footToBall} from './practice-possession.js';
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
import {chooseFreeKickTaker,freeKickOptions,setPiecePlayer,strikeFreeKick,DirectFreeKickPlan} from './practice-set-pieces.js';
import {createOffsideAwareness,perceivedOffside,runReleaseAllowance,ReleaseCue} from './practice-awareness.js';
import {feintOptions,feintDuration,finishFeint,feintReleaseOpening,FeintMemory} from './practice-feints.js';
import {strikeStance} from './practice-striking.js';
import {carryPace,captureControl,faceControl,steerControl,advanceControl,receivingContact,cushionControl,controlReleaseAvailable,controlStrikeReady,strikeControl,rollControlRemainder,deflectBodyBall,TouchControl,ControlContact} from './practice-control.js';

export const PRACTICE_VERSION='five-shared-1';
/** The least time between two closing-lane rechecks of a prepared kick (honest-reads round): a minimum hold, so a
 * carrier does not re-plan every tick while a presser closes. */
export const RELEASE_RECHECK=.1;
export type Duty='hold'|'support'|'run'|'show'|'width'|'press'|'jockey'|'challenge'|'block'|'track'|'cover'|'intercept'|'recover'|'carry'|'prepare'|'receive'|'feint'|'wrongfoot'|'keeper'|'dive'|'sweep'|'restart';
export const dutyNames:Record<Duty,string>={hold:'Protejează spațiul',support:'Oferă o pasă',run:'Atacă spațiul',show:'Vine la picior',width:'Ține lățimea',press:'Închide purtătorul',jockey:'Îl ține în față',challenge:'Încearcă deposedarea',block:'Acoperă șutul',track:'Urmărește o cursă',cover:'Acoperă un coleg',intercept:'Atacă mingea',recover:'Revine în apărare',carry:'Conduce mingea',prepare:'Pregătește lovitura',receive:'Iese la primire',feint:'Încearcă o fentă',wrongfoot:'Își reface echilibrul',keeper:'Închide unghiul',dive:'Plonjează după minge',sweep:'Iese din poartă',restart:'Pregătește reluarea'};
export interface PracticePlayer extends MovingPlayer {role:Role;skills:Skills;traits:Traits;energy:number;archetype:string;temperament:string;lane:number;basePace:number;duty:Duty}
export interface Pose {x:number;y:number;vx:number;vy:number;angle:number;energy:number;duty:Duty}
export type Incident='start'|'pass'|'clearance'|'receive'|'turnover'|'tackle'|'feint'|'beat'|'shot'|'save'|'block'|'goal'|'out'|'offside'|'foul'|'restart'|'half'|'substitution'|'end';
/** Goal side is the beneficiary; actor/lastTouch identifies the final contact,
 * not an adjudication of scorer versus own goal. Shot assessment is a utility
 * heuristic, not xG; it is present only for ordinary foot strikes. */
export interface PracticeEvent {substitution?:SubstitutionRecord;lastTouch?:string;shot?:{aim:Vec;origin:Vec&{z:number};velocity:{vx:number;vy:number;vz:number};assessment?:ShotAssessment};technique?:AerialTechnique;firstTime?:boolean;time:number;kind:Incident;text:string;actor?:string;target?:string;side?:Side;challengeContact?:ChallengeContact;restartKind?:RestartKind;restartSpot?:Vec;restartPlayers?:{id:string;x:number;y:number;vx:number;vy:number}[];incoming?:string;outgoing?:string;pass?:{meetingTime?:number;weight:GroundPass['weight'];aim:Vec;intendedSpeed:number;actualSpeed:number;arrivalSpeed:number};freeKick?:DirectFreeKickPlan;aerial?:{meetingTime?:number;kind:LoftPass['kind'];aim:Vec;intendedSpeed:number;actualSpeed:number;intendedVz:number;actualVz:number;flight:number;apex:number;risk:number}}
export interface Choice {assignment?:Pick<FootballJob,'purpose'|'since'|'until'|'target'> & {aim:Vec};time:number;player:number;kind:Duty;reason:string;action?:Action;carry?:CarryAssessment&{aim:Vec;continuing:boolean;committedUntil:number};challenge?:ChallengeRead&{opponent:string;resolvesAt:number}}
export interface PracticeFrame {time:number;half:1|2;cut?:boolean;lineup?:number[];players:Pose[];ball:MovingBall;score:[number,number];event:number;restart:boolean;restartInfo?:RestartInfo;side:Side;control?:{owner:string;feet:{side:'left'|'right';x:number;y:number;active:boolean}[]}}
export interface PracticeStats {passes:number;completed:number;clearances:number;shots:number;goals:number;saves:number;turnovers:number;tackles:number;tacklesWon:number;feints:number;beaten:number;fouls:number;offsides:number;possession:number;pressSeconds:number;coverSeconds:number}
/** `duration`: the match length asked for. `played`: when the final whistle went, present only when a last attack
 * carried the match past `duration` (practice-match.ts LAST_ATTACK_MAX); otherwise the match ended at `duration`. */
export interface PracticeResult {version:string;seed:number;duration:number;played?:number;teams:[string,string];players:PracticePlayer[];frames:PracticeFrame[];events:PracticeEvent[];choices:Choice[];stats:[PracticeStats,PracticeStats];score:[number,number];controlContacts?:ControlContact[];playbookSelections?:PlaybookSelection[];standingNotes?:StandingNote[];coachingNotes?:CoachingNote[];substitutionNotes?:SubstitutionNote[]}
type Action='pass'|'through'|'loft'|'carry'|'shoot'|'feint'|'clear';
export interface Option {/** What the receiver can do next, already in `score` (receiverProspects). */next?:number;/** A delivery's pass-only pressure credits (relief, retreat, pressure x space), already in `score`: what the purpose clock decays (R3). */relief?:number;/** A shot: the shooter's own read of his chance (R2), already in `score`. */quality?:number;/** Interception risk of a planned throw (throw-ins only). */throwRisk?:number;/** A throw that leads a run: where the receiver meets it. */throwLead?:Vec;kind:Action;clearance?:ClearanceIntent;target?:string;aim:Vec;score:number;reason:string;carry?:CarryAssessment;continuing?:boolean;delivery?:DeliveryRead;run?:PassRun;pass?:GroundPass;loft?:LoftPass;freeKick?:DirectFreeKickPlan;teachingStep?:string;teachingPlan?:string;teachingFit?:number;teachingSpace?:boolean;receivingSpace?:ReceivingSpace}
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
   return {...p,id:`${side}:${p.id}`,side:side as Side,number:i+1,role,lane,x:world(side as Side,x),y,vx:0,vy:0,angle:side?Math.PI:0,basePace,pace:basePace,acceleration:role==='GK'?3.1+p.skills.pace*.19:3.5+p.skills.pace*.22,job:'',duty:'hold' as Duty,archetype:p.archetype??'',temperament:p.temperament??''};
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
export function laneRisk(from:Vec,to:Vec,defenders:PracticePlayer[],speed=16):number{
 const dx=to.x-from.x,dy=to.y-from.y,d2=dx*dx+dy*dy;if(d2<1)return 1;
 const length=Math.sqrt(d2);let risk=0;
 for(const p of defenders){
  const projection=clamp(((p.x-from.x)*dx+(p.y-from.y)*dy)/d2,.06,1);
  // Include the receiver's end of the lane: a marker can intercept just before reception.
  for(const t of [projection,Math.min(1,projection+.15)]){
   const flight=length*t/speed,available=Math.max(0,flight-.22),point={x:from.x+dx*t,y:from.y+dy*t};
   const delta=unit(point.x-p.x,point.y-p.y),towards=p.vx*delta.x+p.vy*delta.y;
   const reach=Math.max(0,Math.min(p.pace*available,towards*available+.5*p.acceleration*available*available));
   risk=Math.max(risk,clamp((reach+1.1-dist(point,p))/2,0,1));
  }
 }
 return risk;
}
/** How far a shooter who cannot read his chance misjudges it (a relative
 * error), and how much an audacious one over-believes it (R2). */
export const SHOT_SPREAD=.3,SHOT_BELIEF=.25;
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
 const near=Math.min(...outfield.map(q=>dist(q,p))),pressure=clamp((6-near)/6,0,1),forward=depth(p.side,p.x),s=sign(p.side);
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
  // The chance is the shooter's own read (R2): the pressure he feels (his
  // nerve, feltPressure) in place of the pressure there is, his misjudgement
  // of the chance by reading and finishing, and an audacious player's
  // belief in it. A daring or composed player shoots under pressure more; a
  // nervous one releases.
  const feltShot=feltPressure(p,assessment.pressure),felt=feltPressure(p,pressure);
  const quality=assessment.quality*(1-feltShot*.24)/(1-assessment.pressure*.24)*clamp(perceive(p,'shot',1+SHOT_BELIEF*audacity,SHOT_SPREAD,p,{time,salt:'chance'}),.5,1.6);
  // What a shot gives away (R2, beside the pass's loss price): unless it
  // goes in, the ball is the opponents' against the rest defence we have now
  // (priced as a loss where he shoots from), though their keeper's restart
  // buys us back some of the seconds (SHOT_RESTART). Read as he reads it.
  const given=(1-clamp(quality*.6,0,.9))*SHOT_RESTART*turnoverPrice(p,players,p);
  options.push({kind:'shoot',quality,aim:assessment.aim,score:.1+quality*1.2+p.traits.risk*.09-felt*.08-laneRisk(p,assessment.aim,outfield,22+p.skills.finishing*.3)*.22+(uncovered?.22:0)-given,reason:uncovered?'Portarul e ieșit; încearcă să profite de poarta expusă.':'Găsește un unghi și încearcă poarta.'});
 }
 // Keep one best duel in ordinary selection; the lesson may prefer another
 // exit toward its taught destination without multiplying random chances.
 const duel=feintOptions(p,players,lastFeint,time)[0];if(duel)options.push(duel);
 return securePossessionOptions(p,players,options,laneRisk);
}
// (B2) the duel's odds live with the challenge model, where the carrier's own read of them can use them too
export {duelChance} from './practice-challenge.js';
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
 const footballOptions=(...args:Parameters<typeof practiceOptions>):Option[]=>{let available=approachOptions(args[0],practiceOptions(...args),tacticsFor(args[0].side),args[1],showingPivot(args[0].side));if(coaching)available=coaching.options(args[6]??0,args[0],args[1],ball,available,laneRisk,args[4]??0,args[5]??null);return bookFor(args[0].side)?.options(args[6]??0,args[0],args[1],ball,args[7]??null,available)??available;};
 const rosterIndex=new Map(roster.map((p,i)=>[p.id,i])),used=new Set(players.map(p=>p.id)),subCounts=[0,0];
 let half:1|2=1,lineup:number[]|undefined,needsFrame=false,cut=false;
 // Set when full time finds a side in an attack (the loop below, practice-match.ts attackAtFullTime).
 let lastAttack:{side:Side;shot:boolean}|null=null;
 const frameStride=duration>900?30:6;
 const get=(id:string)=>byId.get(id)!,sidePlayers=(side:Side)=>players.filter(p=>p.side===side);
 const random=rng(f.seed^0x884411),execution=rng(f.seed^0x547293),stats:[PracticeStats,PracticeStats]=[blank(),blank()],score:[number,number]=[0,0];
 const frames:PracticeFrame[]=[],events:PracticeEvent[]=[],choices:Choice[]=[],intents=new Map<string,Intent>(),duelAfter=new Map<string,number>(),wrongfoot=new Map<string,{until:number;aim:Vec}>(),lastChoice=new Map<string,{kind:Duty;reason:string;assignment?:string}>(),intercepts=new Map<string,{at:number;aim:Vec}>(),actionReasons=new Map<string,string>();
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
 type Continuation={receiver:string;release:number;option:Option;since:number;checked:number};
 let continuation:Continuation|null=null as Continuation|null;
 let clearing:Continuation|null=null as Continuation|null;
 type AerialPreparation={meeting:AerialMeeting;option?:Option;since:number;checked:number;release:number;at:number};
 const aerialPreparations=new Map<string,AerialPreparation>();
 let defense:DefenseAssignment|null=null;
 let support:SupportPlan|null=null,completedPass:SupportContext['lastPass'],passContinuation:SupportContext['passContinuation'];
 let teamShapes:[TeamShape|null,TeamShape|null]=[null,null];
 let flight:FlightAssignment={hunters:[],meetings:{},coverer:''},flightAt=0;
 let challenge:ChallengeAttempt|null=null;
 // (regain fixes) who last had the ball at his feet before it left him (a kick, or it came off him), and when
 let dispossessed:{id:string;at:number}|null=null;
 const recovering=new Map<string,{until:number;opponent:string}>();
 const blocks=new Map<string,{opponent:string;aim:Vec;until:number}>();
 let inHands=false,groundDelivery=false,aerialDelivery=false;
 const controls=new Map<string,TouchControl>(),controlContacts:ControlContact[]=[];
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
 const own=(p:PracticePlayer,kind:'receive'|'turnover'|'save'|'silent'='receive',hands=false)=>{
  feintMemory.delete(p.id);
  playbook=bookFor(p.side);const arrivingPass=ball.mode==='pass';coaching?.receive(time,p,releaseBy,arrivingPass);playbook?.received(time,p,releaseBy,arrivingPass,players,ball);if(arrivingPass&&kind==='receive'&&releaseBy&&get(releaseBy).side===p.side){completedPass={from:releaseBy,to:p.id,at:time};
   const clock=recycle[p.side],reached=depth(p.side,p.x);if(clock.max<0)clock.max=releaseFrom?depth(p.side,releaseFrom.x):reached;
   if(reached>=clock.max+PROGRESS_METRES){clock.count=0;clock.max=reached;}else{clock.count++;clock.max=Math.max(clock.max,reached);}}
  const lost=side!==p.side;if(lost)resetClock();
  // (regain fixes) an opponent who lost it to this man at close quarters a moment ago is off balance too
  if(lost&&kind==='turnover'&&dispossessed&&time-dispossessed.at<=BEATEN_WINDOW){const q=byId.get(dispossessed.id);if(q&&q.side!==p.side&&dist(q,p)<BEATEN_NEAR){const r=beatenRecovery(q);duelAfter.set(q.id,Math.max(duelAfter.get(q.id)??0,time+r));duelAfter.set('touch:'+q.id,Math.max(duelAfter.get('touch:'+q.id)??0,time+r*BEATEN_TOUCH));}}
  dispossessed=null;side=p.side;if(lost){support=null;completedPass=undefined;passContinuation=undefined;transitionAt=time;stats[p.side].turnovers++;intents.clear();assignmentAt=0;lapses.clear();}
  // A new receiver changes the threat even when possession stays with the same team.
  assignmentAt=0;for(const q of players)if(q.side!==p.side)intents.delete(q.id);
  challenge=null;
  actionReasons.delete(p.id);carryPlan=null;dives.delete(p.id);groundDelivery=false;aerialDelivery=false;inHands=hands;
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
     const strike=aerial?strikeAerial(p,ball,aerial.technique,aerial.plan,pressure,execution):throwStrike?{vx:throwStrike.vx,vy:throwStrike.vy,vz:throwStrike.vz}:o.freeKick?strikeFreeKick(p,ball,o.freeKick,execution):shot?strikeShot(p,ball,shotRead!,execution):clear?strikeClearance(p,ball,aim,pressure,execution,o.clearance??'long'):groundStrike?{vx:groundStrike.vx,vy:groundStrike.vy,vz:0}:{vx:loftStrike!.vx,vy:loftStrike!.vy,vz:loftStrike!.vz};
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
     releaseBy=p.id;releaseAt=time;dispossessed={id:p.id,at:time};intended=target?.id??'';lastTouch=p.id;prepared=null;reception=null;flight={hunters:[],meetings:{},coverer:''};assignmentAt=0;if(mustRelease)restartKicker=p.id;mustRelease=false;intercepts.clear();
     bookFor(p.side)?.released(time,p,o);coaching?.release(time,p,o);
     say(shot?'shot':clear?'clearance':'pass',shot?o.freeKick?`${p.name} execută direct lovitura liberă!`:`${p.name} încearcă poarta!`:clear?`${p.name} îndepărtează mingea din zona periculoasă!`:loftStrike?`${p.name} ${loftStrike.plan.kind==='chip'?'strecoară o pasă săltată':'ridică mingea peste linie'} pentru ${target!.name}${o.run?', care atacă spațiul':''}.`:o.delivery?.kind==='cutback'?`${p.name} întoarce mingea din lateral pentru ${target!.name}.`:o.delivery?.kind==='square'?`${p.name} trimite în fața porții pentru ${target!.name}.`:o.kind==='through'?`${p.name} trimite în spațiu pentru ${target!.name}.`:`${p.name} pasează către ${target!.name}.`,p,target??undefined);
     if(shot)events.at(-1)!.shot={aim:{...aim},origin:{x:ball.x,y:ball.y,z:ball.z},velocity:{vx:ball.vx,vy:ball.vy,vz:ball.vz},...(!aerial&&shotRead?{assessment:{...shotRead,aim:{...shotRead.aim}}}:{})};
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
   const basePace=4.5+source.skills.pace*.34;
   const replacement:PracticePlayer={...outgoing,...source,id:`${team}:${source.id}`,role:outgoing.role,lane:outgoing.lane,side:team,
    number:f.teams[team].squad.findIndex(q=>q.id===source.id)+1,archetype:source.archetype??'',temperament:source.temperament??'',
    vx:0,vy:0,basePace,pace:basePace*(.7+.3*source.energy/100),acceleration:3.1+source.skills.pace*.19,duty:'restart',job:'Intră în joc'};
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
  const engineTaker=opening?get(opening.taker):kind==='freeKick'||kind==='indirect'?chooseFreeKickTaker(players,team,spot,f.teams[team].tactics.taker,kind):candidates.slice().sort((a,b)=>kind==='penalty'?(b.skills.finishing+b.skills.setPieces)-(a.skills.finishing+a.skills.setPieces):dist(a,spot)-dist(b,spot))[0];
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
   const set=keeperReadyPosition(p,seen,!ownTeam&&!!owner),position=tracking?{x:set.x,y:clamp(set.y+read.offset,-GH+.18,GH-.18)}:set;kind='keeper';x=Math.max(.3,(ownTeam?X(7)+bd*.035:depth(p.side,position.x))+keeperSweepDepth(sweep,bd,ownTeam));y=ownTeam?clamp(ball.y*.15,-G(3.2),G(3.2)):position.y;speed=p.pace*(!ownTeam&&bd<X(23)?.9:.55);reason='Își potrivește poziția cu mingea și păstrează poarta acoperită.';
   // Behaviour round A: defending, he plays off his back line (keeperLineDepth),
   // and comes for a ball as far beyond where he usually stands as he now stands.
   let higher=0,lastLine=Infinity;
   if(tracking){const usual=x;lastLine=Math.min(...sidePlayers(p.side).filter(q=>q.role!=='GK').map(q=>depth(p.side,q.x)));x=Math.max(x,keeperLineDepth(sweep,lastLine,bd));higher=x-usual;
    // Caught off his line as the ball comes into range: he sprints back to set himself.
    if(depth(p.side,p.x)>x+1.5)speed=p.pace*.9;}
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
    const standing=Math.min(depth(p.side,p.x),depth(p.side,meet.x)-1.25,2.8+keeperSweepDepth(sweep,L,false)+higher);
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
 // How hard each off-ball positional move is made (practice-intensity): his last read and his spot's motion.
 const intensities=new Map<string,{kind:Duty;defending:boolean;at:number;urgency:number;why:string}>(),spotDrift=new SpotDrift();
 const marks=new Map<string,string>();
 // Full time (practice-match.ts attackAtFullTime): the clock ends the match
 // unless a side is in an attack, which plays out for at most LAST_ATTACK_MAX.
 const regular=Math.round(duration/STEP),lastView=()=>({restart,side,ball});
 for(let tick=1;;tick++){
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
  if(challenge&&time>=challenge.resolveAt&&owner?.id!==challenge.opponent){recovering.set(challenge.defender,{until:time+.4,opponent:challenge.opponent});challenge=null;}
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
  if(!playbook?.strictTeachingActive&&!owner&&!restart&&ball.mode==='pass'&&flight.receiver&&time-releaseAt>.05){
   const receiver=get(flight.receiver);
   if(receiver.side===side&&dist(receiver,ball)<14&&(!continuation||continuation.receiver!==receiver.id||continuation.release!==releaseAt||time-continuation.checked>=.18)){
    const meeting=flight.meetings[receiver.id]??receptionTarget(receiver,ball),future={...receiver,...meeting};
    const runs=new Set(players.filter(q=>q.duty==='run').map(q=>q.id));
    const available=footballOptions(future,players,runs,releaseBy,0,null,time,support);
    const best=Math.max(...available.map(o=>o.score));
    const option=available.filter(o=>(o.kind==='carry'||o.kind==='pass'||o.kind==='through'||o.kind==='shoot')&&o.score>=best-.06&&(o.carry?.obstruction??o.pass?.risk??laneRisk(future,o.aim,sidePlayers(other(side)),22))<.28).sort((a,b)=>b.score-a.score)[0];
    if(option){const same:boolean=continuation?.receiver===receiver.id&&continuation.release===releaseAt&&continuation.option.target===option.target&&continuation.option.kind===option.kind;
     continuation={receiver:receiver.id,release:releaseAt,option,since:same?continuation!.since:time,checked:time};
    }else continuation=null;
   }
  }else continuation=null;
  // A defender meeting the opponents' ball (their pass, a loose ball) in his own
  // box may plan to clear it first time, when a clearance is his best option there.
  if(!owner&&!restart&&ball.mode!=='shot'&&time-releaseAt>.05){
   const defender=flight.hunters.map(get).find(q=>q.side!==side&&q.role!=='GK'),meeting=defender?flight.meetings[defender.id]:undefined;
   if(!defender||!meeting||depth(defender.side,meeting.x)>BOX_DEPTH+1||Math.abs(meeting.y)>BOX_HALF+1||!sidePlayers(side).some(q=>q.role!=='GK'&&dist(q,meeting)<3.5))clearing=null;
   else if(!clearing||clearing.receiver!==defender.id||clearing.release!==releaseAt||time-clearing.checked>=.18){
    const available=footballOptions({...defender,...meeting},players,new Set<string>(),releaseBy,0,null,time,null);
    const best=Math.max(...available.map(o=>o.score)),option=available.filter(o=>o.kind==='clear'&&o.score>=best-.12).sort((a,b)=>b.score-a.score)[0];
    const same=clearing?.receiver===defender.id&&clearing.release===releaseAt;
    clearing=option?{receiver:defender.id,release:releaseAt,option,since:same?clearing!.since:time,checked:time}:null;
   }
  }else clearing=null;
  const hunters=!owner&&!restart?flight.hunters.filter(id=>time>=(recovering.get(id)?.until??0)&&time>=(wrongfoot.get(id)?.until??0)):[];
  for(const [id,plan] of aerialPreparations)if(owner||restart||plan.release!==releaseAt||time>plan.at+.15||!hunters.includes(id))aerialPreparations.delete(id);
  if(tick%12===0&&!owner&&!restart&&ball.mode!=='shot'&&(ball.z>.25||ball.vz>1))for(const id of hunters){
   const p=get(id);if(canUseHands(p)&&depth(p.side,p.x)<BOX_DEPTH&&Math.abs(p.y)<BOX_HALF)continue;
   const existing=aerialPreparations.get(id);
   if(existing&&(time-existing.checked<.18||existing.at-time<.23))continue;
   const candidates:{meeting:AerialMeeting;option?:Option;score:number}[]=[];
   for(const meeting of aerialMeetings(p,ball,existing?0:.18,undefined,existing?{angle:existing.meeting.angle,age:time-existing.since}:undefined)){
    const future={...p,...meeting.aim,angle:meeting.angle},incoming={...ball,...meeting.ball};
    const pressure=clamp((4-Math.min(...sidePlayers(other(p.side)).map(q=>dist(q,meeting.ball))))/4,0,1);
    if(meeting.technique==='chest'){
     const settled={...incoming,...cushionChest(future,incoming,pressure,()=>.5)};
     const preview={...settled};advanceFlight(preview,.45);
     if(!pitchExit(incoming,preview)&&dist(preview,meeting.aim)<2.7)candidates.push({meeting,score:.47+p.skills.control*.015-pressure*.28});
    }else{
     const choices=footballOptions(future,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),releaseBy,0,null,time,support);
     for(const option of choices){
      const opened=openAerialMeeting(meeting,option.aim);if(!reachesAerialMeeting(p,opened,existing?0:.18))continue;
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
    aerialPreparations.set(id,{meeting:best.meeting,option:best.option,since:same?existing!.since:time,checked:time,release:releaseAt,at:time+best.meeting.ball.time});
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
      const u=unit(world(p.side,0)-owner.x,-owner.y);aim=inside({x:owner.x+u.x*1.8,y:owner.y+u.y*1.8});kind='jockey';reason=read.reason;
     }
    }
    const block=blocks.get(p.id);
    if(!owner&&ball.mode==='shot'&&p.side!==side&&block&&block.opponent===releaseBy&&time<block.until){aim=block.aim;kind='block';limit=p.pace*.94;trackingVelocity=undefined;reason='A pornit să acopere șutul; ține corpul pe traiectorie.';}
    const recoveringStep=recovering.get(p.id);
    if(recoveringStep&&time<recoveringStep.until&&p.side!==side){aim=recoveryPosition(p,get(recoveringStep.opponent));kind='recover';reason='A ratat intrarea; își reface poziția înainte să încerce din nou.';trackingVelocity=undefined;}
    if(challenge?.defender===p.id){aim=challenge.aim;trackingVelocity=challenge.velocity;kind='challenge';reason=challenge.read.reason;limit=p.pace*.94;}
    if(ball.mode==='pass'&&flight.receiver===p.id&&hunters.includes(p.id)&&time-releaseAt>.12){if(!reception||time>=receptionAt){reception=aerialDelivery?flightMeeting(p,ball).aim:receptionTarget(p,ball);receptionAt=time+.2;}aim=reception;limit=p.pace;kind='receive';reason=p.id===intended?'Ajustează cursa la traiectoria reală a pasei.':'Preia cursa spre pasă; colegul poate oferi următoarea soluție.';}
    else if(!owner&&kind!=='block'&&hunters.includes(p.id)&&time-releaseAt>.2){let meeting=intercepts.get(p.id);if(!meeting||time>=meeting.at){meeting={at:time+.25,aim:flight.meetings[p.id]??(aerialDelivery?flightMeeting(p,ball).aim:receptionTarget(p,ball))};intercepts.set(p.id,meeting);}aim=meeting.aim;limit=p.pace*.93;kind='intercept';reason='Caută un punct de întâlnire cu mingea, în loc să alerge în urma ei.';}
    const read=p.role==='GK'?readKeeperFlight(p,ball,time-releaseAt):null;
    // A ball his own side played (a back-pass, a throw, a clearance gone astray)
    // is received, not saved: he gets in line with it and never dives at it.
    const mates=!!read&&p.side===side&&ball.mode!=='shot';
    if(mates&&kind!=='receive'&&kind!=='intercept'){aim=read!.aim;limit=p.pace;kind='receive';reason='Mingea vine de la un coleg; se așază în calea ei ca s-o preia.';trackingVelocity=undefined;}
    const incoming=mates?null:read;
    if(incoming&&!(kind==='sweep'&&ball.mode!=='shot')&&time-releaseAt>.2+(10-p.skills.reading)*.015){
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
   const fooled=wrongfoot.get(p.id);if(fooled&&time<fooled.until){aim=fooled.aim;limit=p.pace*.65;kind='wrongfoot';reason='A mușcat fenta; are nevoie de timp să întoarcă.';trackingVelocity=undefined;}
   const aerialPlan=!owner&&!restart?aerialPreparations.get(p.id):undefined;
   if(aerialPlan&&!['dive','wrongfoot','recover','challenge'].includes(kind)){aim=aerialPlan.meeting.aim;kind=p.side===side?'receive':'intercept';limit=p.pace;reason=aerialPlan.meeting.technique==='chest'?'Se pregătește să amortizeze mingea pe piept.':aerialPlan.meeting.technique==='header'?'Se așază pentru o lovitură cu capul.':'Își pregătește piciorul pentru un voleu.';}
   // Defending round (step 1): the keeper owns the goal line; an outfielder
   // not going for the ball never aims on his own (offGoalLine).
   if(!restart&&p.role!=='GK'&&p.id!==owner?.id&&!['challenge','block','intercept','receive','dive','keeper','wrongfoot','feint'].includes(kind)){
    const kept=offGoalLine(p.side,aim,ball);
    // (threat round, goal-line fixes) a spot clamped off the goal line is braked into: no goalward run carried into it
    if(kept!==aim&&trackingVelocity&&(p.side===0?trackingVelocity.x<0:trackingVelocity.x>0))trackingVelocity={x:0,y:trackingVelocity.y};
    aim=kept;
   }
   decision(p,kind,reason);
   const facing=p.angle,acceleration=p.acceleration;limit=Math.min(limit,p.pace);
   if(kind==='dive'&&dive&&time<dive.until)p.acceleration*=2.2;
   // Movement intensity (2026-10-10, practice-intensity): an off-ball positional move is made as hard as the
   // situation he reads needs, braking gently into his spot and moving with it; everything else stays at full effort.
   if(!restart&&p.role!=='GK'&&p.id!==owner?.id&&POSITIONAL_KINDS.has(kind)){
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
   else if(restart&&!liningUp){p.angle=facing;const a=Math.atan2(restart.spot.y-p.y,restart.spot.x-p.x);p.angle+=clamp(angleDiff(a,p.angle),-4*STEP,4*STEP);}
   if((owner||restart)&&!physicalOwner)receivingContact(p,old.get(p.id)!,ball,ball,controlFor(p),time,STEP,false);
  }
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
     challenge=startChallenge(candidate.p,p,ball,candidate.read,time);duelAfter.set(candidate.p.id,time+1.4);stats[candidate.p.side].tackles++;
     choices.push({time,player:rosterIndex.get(candidate.p.id)!,kind:'challenge',reason:candidate.read.reason,challenge:{...candidate.read,opponent:p.id,resolvesAt:challenge.resolveAt}});
    }
   }
   if(challenge&&time>=challenge.resolveAt&&ball.owner===challenge.opponent){
    const attempt=challenge,d=get(attempt.defender);challenge=null;
    const deficit=Math.max(0,score[p.side]-score[d.side]);
    const touch=resolveChallengeContact(d,p,ball,attempt,deficit),reachable=touch.ball,screened=bodyScreensBall(d,p,ball);
    const foul=touch.body&&execution()<touch.foulChance;
    if(foul){stats[d.side].fouls++;const type=foulRestartFor(p.side,touch.spot);say('foul',type==='penalty'?`${d.name} îl agață pe ${p.name}, în careu. Penalty!`:`${d.name} îl agață pe ${p.name}. Fluier — mingea rămâne la ${f.teams[p.side].name}.`,d,p);Object.assign(events.at(-1)!,{challengeContact:touch});startRestart(type,p.side,touch.spot);}
    else if(reachable&&!screened&&time>=(wrongfoot.get(d.id)?.until??0)&&execution()<duelChance(p,d,sidePlayers(d.side).filter(q=>q.id!==d.id&&dist(q,p)<6).length)){
     stats[d.side].tacklesWon++;
     // (regain fixes) the man who lost it is off balance before he can go in again
     duelAfter.set(p.id,Math.max(duelAfter.get(p.id)??0,time+beatenRecovery(p)));dispossessed={id:p.id,at:time};
     const relativeSpeed=Math.hypot(d.vx-p.vx,d.vy-p.vy),clean=execution()<clamp(.25+d.skills.defending*.035+d.skills.control*.025-relativeSpeed*.03,.2,.85);
     if(clean){say('tackle',`${d.name} pune piciorul pe minge și o scoate din duel.`,d,p);
      ball={...ball,owner:null,mode:'loose',vx:d.vx*.65,vy:d.vy*.65};lastTouch=d.id;noHandsSide=null;noHandsKeeper='';releaseBy=d.id;releaseAt=time;assignmentAt=0;intended='';prepared=null;firstTouch=null;feint=null;flags=[];
     }
     else {say('tackle',`${d.name} intră la minge și o desprinde din picior.`,d,p);
     const away=unit(d.x-p.x,d.y-p.y),lateral=execution()<.5?-1:1;
     ball={...ball,owner:null,mode:'loose',vx:away.x*2.5-away.y*lateral*3,vy:away.y*2.5+away.x*lateral*3};lastTouch=d.id;noHandsSide=null;noHandsKeeper='';flags=[];releaseBy=d.id;releaseAt=time;assignmentAt=0;intended='';prepared=null;feint=null;}
    }else {recovering.set(d.id,{until:time+.45,opponent:p.id});say('tackle',`${p.name} păstrează mingea; ${d.name} trebuie să revină.`,p,d);}
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
    const closedRelease=prepared&&['pass','through','loft'].includes(prepared.option.kind)&&time>=recheckAt&&launchRisk(p,prepared.option.aim,players,Math.max(0,prepared.at+footToBall(p)-time))>.55;
    if(closedRelease)recheckAt=time+RELEASE_RECHECK;
    if(prepared&&!mustRelease&&!inHands&&(closedRelease||time>=nextThink)){
     const alternatives=footballOptions(p,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));
     const current=alternatives.filter(o=>o.kind===prepared!.option.kind&&o.target===prepared!.option.target&&!!o.receivingSpace===!!prepared!.option.receivingSpace).sort((a,b)=>dist(a.aim,prepared!.option.aim)-dist(b.aim,prepared!.option.aim))[0];
     if(!current||Math.max(...alternatives.map(o=>o.score))>current.score+.18)prepared=null;
     else prepared.option=current;
     nextThink=prepared?time+.2:time;
    }
    if(time>=nextThink&&!prepared){
     const runs=new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),free=restart&&(restart.kind==='freeKick'||restart.kind==='indirect');let available=footballOptions(free?setPiecePlayer({...p,...restart!.spot}):p,players,runs,lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));
     if(mustRelease){available=restart?.kind==='throw'?throwOptions(p,ball,players,available):free?freeKickOptions(p,players,restart!,available,f.teams[p.side].tactics):available.filter(o=>o.kind==='pass'||o.kind==='through'||o.kind==='loft');if(!available.length){const q=sidePlayers(p.side).filter(q=>q.id!==p.id).sort((a,b)=>dist(a,p)-dist(b,p))[0];available=[{kind:'pass',target:q.id,aim:q,score:1,reason:'Reia jocul cu o pasă către colegul apropiat.'}];}}
     if(inHands){
      available=available.filter(o=>o.kind==='pass'||o.kind==='through'||o.kind==='loft');
      if(!available.length){const q=sidePlayers(p.side).filter(q=>q.id!==p.id).sort((a,b)=>dist(a,p)-dist(b,p))[0];available.push({kind:'loft',target:q.id,aim:q,score:.1,reason:'Colegul e departe; caută o repunere lungă.'});}
      if(time-receivedAt<3.5)available.push({kind:'carry',aim:{x:p.x,y:p.y},score:.38,reason:'Ține mingea în mâini și așteaptă să se deschidă o soluție de repunere.'});
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
     nextThink=time+Math.min(possessionSafety(p,players).urgency>.25||(option.delivery?.shotGain??0)>.1?.16:.38+random()*.18,lookAgain(p,players,time));
     if(option.kind==='carry')carry=option.aim;
     else if(option.kind==='feint'){stats[p.side].feints++;const marker=get(option.target!);feintMemory.set(p.id,{opponent:marker.id,at:time,attacker:{x:p.x,y:p.y},defender:{x:marker.x,y:marker.y}});feint={attacker:p.id,defender:marker.id,check:time+.26,aim:option.aim,resolved:false,score:option.score,review:time+.41,finish:time+feintDuration(p,option.aim)};say('feint',`${p.name} scoate o fentă din buzunar. ${marker.name} îl așteaptă.`,p,marker);}
     else {
      prepared={option,at:time+preparationTime(p,option.kind)};recheckAt=time+RELEASE_RECHECK;
      // Teammates can read their release cue. The private target must not
      // reset the opposing unit's assessment schedule.
      if(option.target&&(option.kind==='through'||option.kind==='loft')&&(option.run||get(option.target).duty==='run')){
       intents.delete(option.target);
      }
     }
     }
    }
    if(prepared&&time>=prepared.at&&(restart||inHands?Math.abs(angleDiff(Math.atan2(prepared.option.aim.y-p.y,prepared.option.aim.x-p.x),p.angle))<.32:controlStrikeReady(p,ball,controlFor(p),prepared.option.aim,prepared.option.kind==='shoot'?'shot':prepared.option.kind==='clear'?'clearance':'pass'))&&(!restart||restartPlayersReady(restart,players,routineRelaxed(restart,time))&&(restart.kind==='throw'||controlReleaseAvailable(p,ball,prepared.option.aim)))){
     releaseOption(p,prepared.option);
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
    const body=separating?null:flightContact(before,ball,previous,p,.31,1.1);
    const area=p.side===0?{minX:0,maxX:BOX_DEPTH,minY:-BOX_HALF,maxY:BOX_HALF}:{minX:(L-BOX_DEPTH),maxX:L,minY:-BOX_HALF,maxY:BOX_HALF};
    const handRadius=goalThreats.has(p.id)?keeperReach(p,time-releaseAt):aerialDelivery?1.1:.72+(p.side===side?.15:0);
    const catchAt=canUseHands(p)&&time>=(duelAfter.get('touch:'+p.id)??0)?flightContact(before,ball,previous,p,handRadius,2.3,area):null;
    const preparation=aerialPreparations.get(p.id),aerialAt=preparation&&time>=(duelAfter.get('touch:'+p.id)??0)?aerialContact(p,previous,before,ball,preparation.meeting.technique,time-preparation.since):null;
    const first=Math.min(feet??Infinity,body??Infinity,catchAt??Infinity,aerialAt??Infinity),hands=catchAt===first,t=Number.isFinite(first)?first:null;
    if(t===null||t>boundary)return [];
    const gap=Math.hypot(before.x+(ball.x-before.x)*t-previous.x-(p.x-previous.x)*t,before.y+(ball.y-before.y)*t-previous.y-(p.y-previous.y)*t);
    return [{p,t,hands,aerial:!hands&&aerialAt===t?preparation:undefined,meeting:!hands&&feet===t?meeting:null,gap,id:p.id}];
   }).sort(compareFlightContacts);
   const hit=hits[0];
   if(hit){
    const p=hit.p;Object.assign(ball,before);advanceFlight(ball,STEP*hit.t);
    const secondTouch=p.id===restartKicker;if(!secondTouch){restartKicker='';restrictedGoal=false;}
    if(secondTouch){say('foul',`${p.name} atinge din nou mingea înaintea altui jucător. Lovitură indirectă.`,p);startRestart('indirect',other(p.side),p);}
    else if(flags.includes(p.id)){stats[p.side].offsides++;say('offside',`${p.name} ajunge la minge, dar fanionul e sus. Plecase prea devreme.`,p);startRestart('indirect',other(p.side),p);}
    else if((ball.mode==='shot'||goalThreats.has(p.id))&&p.side!==side){
     const previous=old.get(p.id)!,dive=dives.get(p.id);
     const handling=hit.hands?keeperHandling({...p,x:previous.x+(p.x-previous.x)*hit.t,y:previous.y+(p.y-previous.y)*hit.t},ball,{gap:hit.gap,reach:keeperReach(p,time-releaseAt),shotAge:time-releaseAt,diving:!!dive&&time<dive.until,recovering:!!dive&&time>=dive.until&&time<dive.recoverUntil},sidePlayers(other(p.side))):null;
     if(handling&&execution()<handling.catchChance){own(p,'save',true);}
     else{if(hit.hands)stats[p.side].saves++;say(hit.hands?'save':'block',hit.hands?`${p.name} respinge! Mingea rămâne în joc.`:`${p.name} blochează șutul. Se joacă în continuare!`,p);
      if(handling)Object.assign(ball,handling.parry);else deflectBodyBall(ball,{x:previous.x+(p.x-previous.x)*hit.t,y:previous.y+(p.y-previous.y)*hit.t},{x:p.vx,y:p.vy});ball.mode='loose';noteTouch(p.id);duelAfter.set('touch:'+p.id,time+.4);releaseAt=time;releaseBy=p.id;intended='';assignmentAt=0;
      const state=controlFor(p),impact={x:ball.x,y:ball.y};rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t);collectContacts(state);resolveExit(impact);}
    }else if(hit.hands){own(p,p.side===side?'receive':'save',true);
    }else {
     const same=p.side===side,state=controlFor(p),point={x:ball.x,y:ball.y};
     if(hit.aerial){
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
      let plan=continuation?.receiver===p.id&&continuation.release===releaseAt?continuation:clearing?.receiver===p.id&&clearing.release===releaseAt?clearing:null;
      const runs=new Set(players.filter(q=>q.duty==='run').map(q=>q.id));
      // A defender clears for his own side: his plan reads options without the attack's support plan.
      const clearingPlan=!!plan&&plan===clearing;
      // Reflex: with an opponent on top of him in his own box, a defender meeting
      // the opponents' ball may hack it clear first time, like a planned clearance.
      const reflex=!plan&&!same&&p.role!=='GK'&&opponents.some(q=>dist(q,ball)<2)&&depth(p.side,ball.x)<=BOX_DEPTH+1&&Math.abs(ball.y)<=BOX_HALF+1;
      const defending=clearingPlan||reflex;
      const fresh=plan||reflex?footballOptions(hit.meeting.body,players,runs,releaseBy,0,null,time,defending?null:support):[];
      // A clearance goes wherever his body can strike it now, among his best options.
      const top=Math.max(...fresh.map(o=>o.score)),body=hit.meeting.body;
      const next=defending?fresh.filter(o=>o.kind==='clear'&&o.score>=top-.14&&strikeStance(body,ball,o.aim,'clearance').available&&controlReleaseAvailable(body,ball,o.aim)).sort((a,b)=>b.score-a.score)[0]
       :plan?fresh.filter(o=>o.kind===plan!.option.kind&&o.target===plan!.option.target&&o.carry?.purpose===plan!.option.carry?.purpose).sort((a,b)=>dist(a.aim,plan!.option.aim)-dist(b.aim,plan!.option.aim))[0]:undefined;
      if(reflex&&next)plan={receiver:p.id,release:releaseAt,option:next,since:-Infinity,checked:time};
      const viable=next&&next.score>=top-(defending?.14:.08)&&(next.kind==='clear'?launchRisk(body,next.aim,players,0,next.clearance==='touchline'||next.clearance==='corner'?4:1.6)<.5:(next.carry?.obstruction??next.pass?.risk??laneRisk(p,next.aim,opponents,22))<.32)?next:undefined;
      const firstAim=pressed?recoveryTouch(hit.meeting.body,players):viable?.aim;
      const contactTime=time-STEP+STEP*hit.t,relativeSpeed=Math.hypot(ball.vx-p.vx,ball.vy-p.vy);
      const foot=state.feet.find(f=>f.side===hit.meeting!.foot.side)!,endFoot={...foot};Object.assign(foot,hit.meeting.foot);state.time=contactTime;
      const direct=viable&&viable.kind!=='carry'&&plan&&time-plan.since>=.13+(10-p.skills.reading)*.012&&relativeSpeed<7+p.skills.control*.75&&controlStrikeReady(hit.meeting.body,ball,state,viable.aim,viable.kind==='shoot'?'shot':viable.kind==='clear'?'clearance':'pass');
      let released=false,received=false;
      if(direct){
       // Contact was reached and the outgoing lane/body alignment is still valid.
       // Receiving speed increases execution difficulty; it never guarantees a pass.
       const incoming={...ball};own(p,same?'receive':'turnover');Object.assign(ball,incoming);received=true;state.time=contactTime;
       const load=clamp((relativeSpeed-4)/8,0,1),striker={...hit.meeting.body,skills:{...p.skills,passing:Math.max(1,p.skills.passing-load*1.4),finishing:Math.max(1,p.skills.finishing-load*1.8)}};
       released=releaseOption(striker,viable,true);
       // A rejected outgoing strike falls back to one cushion, keeping the reception counted once.
      }
      Object.assign(foot,endFoot);
      if(!released)cushionControl(ball,state,hit.meeting,contactTime,firstAim?{aim:firstAim,opponents,release:!!viable&&viable.kind!=='carry'&&!pressed}:undefined);
      const lost=rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t);collectContacts(state);state.time=time;
      if(released){if(lost){ball.mode='loose';intended='';}resolveExit(point);}
      else if(!lost&&!pitchExit(point,ball)){
       if(!received)own(p,same?'receive':'turnover');else {ball.owner=p.id;ball.mode='control';}
       if(firstAim){firstTouch=null;carry=firstAim;}
       if(viable?.kind==='carry'){carryPlan=commitCarry(p,viable as CarryOption,time,null);actionReasons.set(p.id,viable.reason);nextThink=time+.2;}
       else if(viable&&plan){prepared={option:viable,at:Math.max(time,plan.since+preparationTime(p,viable.kind))};recheckAt=time+RELEASE_RECHECK;nextThink=time+.15;}
      }
      else {ball.owner=null;ball.mode='loose';intended='';assignmentAt=0;resolveExit(point);}

     }else{
      const body={x:old.get(p.id)!.x+(p.x-old.get(p.id)!.x)*hit.t,y:old.get(p.id)!.y+(p.y-old.get(p.id)!.y)*hit.t};
      const incoming={x:ball.vx,y:ball.vy};deflectBodyBall(ball,body,{x:p.vx,y:p.vy});
      state.contacts.push({actor:p.id,time:time-STEP+STEP*hit.t,x:ball.x,y:ball.y,kind:'body',body:{...body,angle:p.angle},incoming,outgoing:{x:ball.vx,y:ball.vy}});
      ball.mode='loose';ball.owner=null;lastTouch=p.id;intended='';assignmentAt=0;
      rollControlRemainder(ball,players,old,state,time-STEP,STEP,hit.t);collectContacts(state);resolveExit(point);
     }
    }
   }else if(exit)resolveExit(before);
  }
  if(tick%frameStride===0||needsFrame)frame();if(tick%1800===0)progress?.(time);
 }
 for(const b of playbooks)b.end(time,'end');
 say('end',`Fluier final. ${span(duration)}, destule povești pentru marginea terenului.`);frame();
 return {version:PRACTICE_VERSION,seed:f.seed,duration,...(lastAttack?{played:time}:{}),teams:[f.teams[0].name,f.teams[1].name],players:roster,frames,events,choices,stats,score,controlContacts:record?controlContacts:undefined,...(playbooks.length?{playbookSelections:playbooks.flatMap(b=>b.selections.map(sel=>({...sel,side:b.config.side}))),...(playbooks.some(b=>b.standing.notes.length)?{standingNotes:playbooks.flatMap(b=>b.standing.notes)}:{})}:{}),...(coaching?{coachingNotes:coaching.notes}:{}),...(orders.length?{substitutionNotes:orderNotes}:{})};
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
