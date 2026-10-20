import * as S from './style.js';
import {clamp} from './model.js';
import {L} from './pitch.js';
import {ARRIVAL_SPREAD,ARRIVAL_OPTIMISM} from './practice-passing.js';
import {arrivalTime} from './practice-defense.js';
import {possessionSafety,feltPressure} from './practice-possession.js';
import type {Tactics} from './model.js';
import type {Option,PracticePlayer} from './practice.js';
import {readTransition} from './practice-transition.js';
import {REST_MARGIN} from './practice-rest-defence.js';
import {daring,perceive} from './practice-perception.js';
import type {TransitionRun} from './practice-transition.js';

/** The style fine-tune. `onLoss` ("On losing it") is optional everywhere:
 * missing means 'balanced', so inputs from before the field play as before. */
export type ApproachSettings=Pick<Tactics,'progression'|'width'|'line'|'press'|'commit'|'striker'|'onLoss'> & {transition:'balanced'|'secure'|'counter'};
/** The four presets' settings are a copy of lib/ballers/league.ts PRESETS, their one source (the engine package
 * cannot import the app); verificare/ballers-preset-source.test.ts asserts the copy equal, key for key. */
export const teamApproaches:Record<string,{name:string;description:string;settings:ApproachSettings}>={
 balanced:{name:'Echilibrat',description:'Pase, avansări și curse în funcție de situație. Păstrează sprijinul și acoperirea.',settings:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced',onLoss:'balanced'}},
 combinations:{name:'Combinații scurte',description:'Colegi aproape, în unghiuri diferite. Caută schimburi scurte și continuarea după pasă.',settings:{progression:'patient',width:'standard',line:'high',press:'balanced',commit:3,striker:'pivot',transition:'secure',onLoss:'counterpress'}},
 direct:{name:'Joc direct',description:'Caută mai repede colegul din față. Curse în adâncime și pase mai lungi când se deschide culoarul.',settings:{progression:'direct',width:'wide',line:'standard',press:'balanced',commit:4,striker:'run',transition:'balanced',onLoss:'balanced'}},
 counter:{name:'Contraatac',description:'Apără mai jos; după recuperare, caută imediat spațiul din față. Dacă ieșirea se închide, reconstruiește.',settings:{progression:'mixed',width:'standard',line:'deep',press:'selective',commit:3,striker:'mixed',transition:'counter',onLoss:'balanced'}}
};
export function validateApproach(value:unknown):ApproachSettings{
 const v=value as ApproachSettings;
 if(!v||!['patient','mixed','direct'].includes(v.progression)||!['narrow','standard','wide'].includes(v.width)||!['deep','standard','high'].includes(v.line)||!['selective','balanced','aggressive'].includes(v.press)||!['mixed','link','pivot','run'].includes(v.striker??'')||!['balanced','secure','counter'].includes(v.transition)||!Number.isFinite(v.commit)||v.commit<1||v.commit>5||v.onLoss!==undefined&&!['regroup','balanced','counterpress'].includes(v.onLoss))throw Error('Invalid team approach');
 return {progression:v.progression,width:v.width,line:v.line,press:v.press,commit:v.commit,striker:v.striker,transition:v.transition,...(v.onLoss!==undefined?{onLoss:v.onLoss}:{})};
}
/** The recovery window changes the team's invitations, never running speed or
 * striking accuracy. No counter bonus at kickoff or merely after our own pass.
 * Behaviour round C (2026-10-03): Counter's window adds forward intent and
 * never removes what the manager chose. A Pivot or Drops-deep striker keeps
 * his own job; any other lead forward plays on their last man's shoulder
 * (In behind's post), and in the window he times his run on his own read of
 * the ball-winner (practice-coordination winnerFree): he goes when the ball
 * can reach him now, and holds on the shoulder, ready, while the ball-winner
 * is pressed or turned (`regainWindow`). */
export function approachInPossession(t:Tactics,recoveryAge:number):SituationTactics{
 if(recoveryAge<0)return t;
 if(t.transition==='counter'&&recoveryAge<8)return {...t,progression:'direct',striker:t.striker==='pivot'||t.striker==='link'?t.striker:'run',commit:Math.max(4,t.commit),regainWindow:true};
 if(t.transition==='secure'&&recoveryAge<3)return {...t,progression:'patient'};
 return t;
}
/** The numbers of a transition, from visible positions: our outfielders level
 * with or ahead of the ball (the carrier included) against their rest
 * defence, their outfielders clearly (REST_MARGIN, 4 m) goal-side of it.
 * The men around the ball are the counter-press, a question of pressure
 * that the carrier's own options already price; once the ball is past them
 * they are out of the counter. Their keeper is not counted: he is always
 * there. */
export function counterNumbers(players:ReadonlyArray<PracticePlayer>,carrier:PracticePlayer):{ours:number;theirs:number}{
 const depth=(x:number)=>carrier.side===0?x:L-x,bd=depth(carrier.x);
 let ours=carrier.role==='GK'?0:1,theirs=0;
 for(const q of players){
  if(q.role==='GK'||q.id===carrier.id)continue;
  if(q.side===carrier.side){if(depth(q.x)>=bd-1)ours++;}
  else if(depth(q.x)>bd+REST_MARGIN)theirs++;
 }
 return {ours,theirs};
}
/** A counter is on while a recovery is recent (COUNTER_WINDOW) and the
 * defence is still unsorted by the numbers. "On winning it" sets how clear
 * the numbers must be: Counter goes even one short, Balanced at parity,
 * "Keep it" only with a man over (a clear 2-v-1). A counter needs space: at
 * most two in their rest defence (three for Counter). It is the carrier's
 * read (he does not kick a counter away to nobody); only Counter's team
 * changes how it plays because of it (approachForSituation). */
export const COUNTER_WINDOW=10;
export function counterOn(t:Tactics,players:ReadonlyArray<PracticePlayer>,carrier:PracticePlayer|undefined,recoveryAge:number):boolean{
 if(!carrier||carrier.role==='GK'||recoveryAge<0||recoveryAge>=COUNTER_WINDOW)return false;
 const {ours,theirs}=counterNumbers(players,carrier);
 const need=t.transition==='counter'?-1:t.transition==='secure'?1:0;
 return theirs<=(t.transition==='counter'?3:2)&&ours-theirs>=need;
}
/** The situation's tactics; `counter` marks a counter that is on (counterOn),
 * an internal read, never a manager's input. */
export type SituationTactics=Tactics&{counter?:boolean;
 /** Counter's regain window is on (approachInPossession). */
 regainWindow?:true;
 /** The purpose clock (R3 P4): completed passes in a row that have not
  * taken the ball forward, a visible count. */
 recycled?:number};
/** The purpose clock (R3 P4). Circulation has a purpose: moving the block.
 * After PURPOSE_AFTER such passes (one more for a patient side, which
 * circulates longer by identity) the team starts to look for the way
 * through: over the next two passes the pass-only pressure credits a reset
 * earns fade (CLOCK_RELIEF of them), a real shot gains CLOCK_SHOT, a pass
 * through an open lane past defenders (penetration) or a switch to a free
 * man gains, and a ball back loses a little. A patient side's keep and reset
 * credits fade the same way and its penetration and switch credits grow;
 * which pass it plays is still its own style's choice. 0 = the clock has not
 * started, 1 = fully on. */
export const PURPOSE_AFTER=S.COMMON.purposeAfter.v,CLOCK_RELIEF=S.COMMON.clockRelief.v,CLOCK_SHOT=S.COMMON.clockShot.v,CLOCK_PEN=S.COMMON.clockPen.v,CLOCK_SWITCH=S.COMMON.clockSwitch.v,CLOCK_BACK=S.COMMON.clockBack.v;
export function purposeClock(t:SituationTactics):number{
 const n=t.recycled??0,start=PURPOSE_AFTER+S.PROGRESSION[t.progression].clockStartsAfter.v;
 return clamp((n-start+1)/S.COMMON.clockRamp.v,0,1);
}
/** Let a visible recovery opportunity influence the first allocation too.
 * Requiring an already-selected counter run makes that first decision use the
 * ordinary approach, precisely when the manager wants a different response.
 *
 * Only a side whose "On winning it" is Counter changes how the team plays
 * after a regain (the manager asked for it): for 8 s, while a counter is on
 * by the numbers (counterOn) or a run is open (readTransition), it plays
 * direct with the striker running in behind and at least four bodies
 * forward. Balanced and "Keep it" keep their own Progression, Striker and
 * Bodies forward: their players still take a break that is on (individual
 * runs, readTransition at the side's own bar), run with the ball into open
 * ground, and do not kick a counter that is on away to nobody (`counter`,
 * the carrier's read, which changes no setting). */
export const COUNTER_FLIP=8;
export function approachForSituation(t:Tactics,players:PracticePlayer[],carrier:PracticePlayer|undefined,recoveryAge:number,continuing:ReadonlyArray<TransitionRun>=[],time=0):SituationTactics{
 const on=counterOn(t,players,carrier,recoveryAge);
 if(t.transition==='counter'){
  if(recoveryAge<0||recoveryAge>=COUNTER_FLIP||!carrier)return on?{...t,counter:true}:t;
  if(on)return {...approachInPossession(t,recoveryAge),counter:true};
  if(!readTransition(players,carrier,t,recoveryAge,continuing,time).open)return t;
  return approachInPossession(t,recoveryAge);
 }
 const own=approachInPossession(t,recoveryAge);
 return on?{...own,counter:true}:own;
}
/** What the defending block is doing right now, read from visible positions
 * and motion only (never an opponent's assigned job). */
export interface BlockRead {opponents:PracticePlayer[];sliding:number;pressure:number}
export function readBlock(p:PracticePlayer,players:ReadonlyArray<PracticePlayer>):BlockRead{
 const opponents=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 const vy=opponents.length?opponents.reduce((a,q)=>a+q.vy,0)/opponents.length:0;
 // 0 while the block stands, 1 when it is shuttling across at >= 2 m/s:
 // as this player reads it (R2), sharper the better he reads the game.
 const sliding=clamp((perceive(p,'block',Math.abs(vy),SLIDE_SPREAD,p,{salt:'slide'})-.6)/1.4,0,1);
 return {opponents,sliding,pressure:opponents.length?feltPressure(p,possessionSafety(p,players as PracticePlayer[]).pressure):0};
}
/** How far a player who cannot read the game misjudges a patient side's
 * reads (R2): the block's lateral speed (m/s) and a contested lane's
 * interception risk; how much a daring passer shades that risk down. The
 * receiver's room uses the passer's arrival-time read (ARRIVAL_SPREAD). A
 * good reader errs by about a third of these. */
export const SLIDE_SPREAD=.8,LANE_SPREAD=.15,LANE_OPTIMISM=.05;
/** What a delivery does for a patient side, from what the passer can see (0
 * when there is no defending block to read):
 *  - bypassed: defending outfielders it goes past (the lines it crosses);
 *  - open: the lane past them is clear (low interception risk) and the
 *    receiver has room to receive;
 *  - penetration: going past them through that open lane ("go now"), worth
 *    more while the block is still sliding after circulation;
 *  - shift: a switch across to a genuinely free receiver, into an area with
 *    fewer defenders than around the passer, so the block has to slide;
 *  - reset: a ball back to a free team-mate that takes the pressure off. */
export function patientPurpose(p:PracticePlayer,o:Option,block:BlockRead):{bypassed:number;open:number;penetration:number;shift:number;reset:number}{
 const none={bypassed:0,open:0,penetration:0,shift:0,reset:0};
 if(!block.opponents.length||!o.target)return none;
 const depth=(x:number)=>p.side===0?x:L-x,from=depth(p.x),to=depth(o.aim.x);
 const bypassed=block.opponents.filter(q=>{const d=depth(q.x);return d>from&&d<to;}).length;
 // The lane and the room are the passer's read (R2): his error by reading
 // and passing; a daring passer sees the lane a little more open.
 // A clearly open lane stays open; a contested one is where reads differ.
 const exactRisk=clamp(o.pass?.risk??o.loft?.risk??1,0,1),contested=.2+.8*clamp(exactRisk/.3,0,1);
 const risk=clamp(perceive(p,'lane',exactRisk,LANE_SPREAD*contested,o.aim,{salt:`lane${o.target}`,bias:-LANE_OPTIMISM*daring(p)*contested}),0,1);
 const flight=o.pass?.flight??o.loft?.flight??0;
 const first=Math.min(...block.opponents.map(q=>arrivalTime(q,o.aim)));
 const room=clamp((perceive(p,'arrival',first,ARRIVAL_SPREAD,o.aim,{salt:`room${o.target}`,bias:ARRIVAL_OPTIMISM*daring(p)})-flight)/.8,0,1);
 const open=clamp((.3-risk)/.3,0,1)*clamp((room-.3)/.5,0,1);
 const penetration=bypassed?open*(1+.4*Math.min(1,bypassed-1))*(1+.6*block.sliding):0;
 const across=clamp((Math.abs(o.aim.y-p.y)-6)/6,0,1);
 const near=(v:{x:number;y:number})=>block.opponents.filter(q=>Math.hypot(q.x-v.x,q.y-v.y)<7).length;
 const relief=clamp((near(p)-near(o.aim))/2,0,1);
 const free=clamp((room-.3)/.5,0,1);
 const shift=across*free*(.4+.6*relief)*(1-risk*.65);
 const reset=to<from-1?block.pressure*free*(1-risk):0;
 return {bypassed,open,penetration,shift,reset};
}
/** What a counter that is on is worth to the side that has it, in price
 * units (LOSS_SCALE x goals): a break against an unbalanced defence (about a
 * tenth of a goal, Opta's fast breaks). Kicking the ball away to nobody (a
 * long, touchline or corner clearance) throws it away, so under a counter
 * those clearances pay it; a clearance into a team-mate's path does not. */
export const COUNTER_VALUE=S.COMMON.counterValue.v;
/** Striker: Pivot (settings round, 2026-10-03). While the pivot is showing for
 * it (practice-coordination pivotPoint: his own read that the lane to his feet
 * is open), a ball into his feet is preferred among the deliveries, the more
 * so the more pressure the passer feels: PIVOT_PULL always, PIVOT_PRESSED at
 * full pressure. It is a delivery preference like a style's (which pass, not
 * whether to pass): it is re-centred with them, so it never turns a better
 * shot, carry or feint into a pass. */
export const PIVOT_PULL=.06,PIVOT_PRESSED=.4;
/** A style chooses WHICH delivery, not WHETHER to deliver. The preference
 * reorders passes and lofts among themselves, then the whole delivery set is
 * re-centred so its best member keeps the neutral best delivery's value: a
 * carry, feint or shot that was better on neutral still is. Direct play
 * favours forward gain.
 *
 * Patient play keeps the ball: it credits a pass that keeps possession
 * without forcing it, whatever its length. "Long" for a patient side means
 * crossing defenders' lines without an open lane, not metres: circulation
 * that goes past nobody earns the full keep-ball credit, a pass past
 * defenders earns it only as far as the lane is open. A backward ball earns
 * it only through a connection it opens or as a reset that takes the
 * pressure off a team-mate. On top, it goes through an open lane when one
 * appears (more so while the block slides) and credits a switch to a free
 * receiver. A ball with none of these purposes that crosses lines or risks
 * the ball costs a little. The exact same plans reach execution. */
export function approachOptions(p:PracticePlayer,options:Option[],t:SituationTactics,players:ReadonlyArray<PracticePlayer>=[],pivot?:string):Option[]{
 if(t.counter)options=options.map(o=>o.kind==='clear'&&o.clearance!=='mate'&&o.clearance!=='channel'?{...o,score:o.score-COUNTER_VALUE}:o);
 const clock=purposeClock(t),s=p.side===0?1:-1;
 const block=S.PROGRESSION[t.progression].readsBlock.v||clock>0?readBlock(p,players):null;
 if(clock>0)options=options.map(o=>{
  let score=o.score-CLOCK_RELIEF*clock*(o.relief??0);
  if(o.kind==='shoot')score+=CLOCK_SHOT*clock;
  else if(S.PROGRESSION[t.progression].clockDeliveryTerms.v&&(o.pass||o.loft)&&o.target){
   const purpose=patientPurpose(p,o,block!),gain=(o.aim.x-p.x)*s;
   score+=clock*(CLOCK_PEN*purpose.penetration+CLOCK_SWITCH*purpose.shift-(gain<S.COMMON.clockBackGain.v?CLOCK_BACK:0));
  }
  return score===o.score?o:{...o,score};
 });
 // Striker: Pivot: a ball into his feet while he shows (PIVOT_PULL).
 const into=pivot&&pivot!==p.id?options.filter(o=>o.kind==='pass'&&o.target===pivot):[];
 const felt=into.length?feltPressure(p,possessionSafety(p,players as PracticePlayer[]).pressure):0;
 const pull=(o:Option)=>into.includes(o)?PIVOT_PULL+PIVOT_PRESSED*felt:0;
 if(S.PROGRESSION[t.progression].delivery.v==='none'&&!into.length)return options;
 const style=(o:Option)=>{
  if(S.PROGRESSION[t.progression].delivery.v==='none')return 0;
  const gap=Math.hypot(o.aim.x-p.x,o.aim.y-p.y),gain=(o.aim.x-p.x)*s;
  const risk=o.pass?.risk??o.loft?.risk??0;
  const feasible=1-clamp(risk,0,1)*S.COMMON.feasibleRisk.v;
  if(S.PROGRESSION[t.progression].delivery.v==='patient'){
   const connection=o.delivery?.connectionGain??0;
   const purpose=patientPurpose(p,o,block!);
   // The purpose clock fades keeping and resetting and grows going through.
   const keeps=Math.max(clamp(S.PATIENT_DELIVERY.keepBase.v+gain/S.PATIENT_DELIVERY.keepGainPer.v+connection*S.PATIENT_DELIVERY.keepConnection.v,0,1)*(1-S.PATIENT_DELIVERY.clockFade.v*clock),purpose.reset*(1-clock));
   const through=purpose.bypassed?S.PATIENT_DELIVERY.throughBase.v+S.PATIENT_DELIVERY.throughOpen.v*purpose.open:1;
   const purposeful=Math.max(purpose.penetration,purpose.shift,purpose.reset,clamp(connection*S.PATIENT_DELIVERY.purposeConnection.v,0,1));
   const forcing=Math.max(clamp(purpose.bypassed/S.PATIENT_DELIVERY.forcingLines.v,0,1)*(1-purpose.open),clamp((risk-S.PATIENT_DELIVERY.forcingRisk.v)/S.PATIENT_DELIVERY.forcingSpan.v,0,1));
   // The switch credit tops up what the receiver's prospects (o.next, every
   // style) already pay for the same free man; it is never paid twice.
   return S.PATIENT_DELIVERY.keep.v*feasible*keeps*through-(1-clamp(purposeful,0,1))*forcing*S.PATIENT_DELIVERY.forcingCost.v+purpose.penetration*S.PATIENT_DELIVERY.penetration.v*(1+clock)+Math.max(0,purpose.shift*S.PATIENT_DELIVERY.switch.v*(1+S.PATIENT_DELIVERY.switchClock.v*clock)-(o.next??0))+(o.run&&gap<S.PATIENT_DELIVERY.runnerRange.v?S.PATIENT_DELIVERY.runnerBonus.v:0);
  }
  return clamp(gain/S.DIRECT_DELIVERY.gainSpan.v,S.DIRECT_DELIVERY.gainFloor.v,1)*S.DIRECT_DELIVERY.weight.v*feasible+(gap>S.DIRECT_DELIVERY.longGap.v&&gain>S.DIRECT_DELIVERY.longGain.v?S.DIRECT_DELIVERY.longBonus.v:0);
 };
 const preference=(o:Option)=>into.length?style(o)+pull(o):style(o);
 const deliveries=options.filter(o=>o.pass||o.loft);
 if(!deliveries.length)return options;
 const styled=new Map(deliveries.map(o=>[o,o.score+preference(o)]));
 const shift=Math.max(...deliveries.map(o=>o.score))-Math.max(...styled.values());
 return options.map(o=>styled.has(o)?{...o,score:styled.get(o)!+shift}:o);
}
