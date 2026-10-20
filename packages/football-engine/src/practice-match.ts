import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Player,Team} from './model.js';
import type {PracticePlayer} from './practice.js';
import {WORLD} from './world.js';

export const MATCH_LENGTHS=[WORLD.clock.match.MATCH_LENGTHS.five.v,WORLD.clock.match.MATCH_LENGTHS.fifteen.v,WORLD.clock.match.MATCH_LENGTHS.ninety.v] as const;
export type MatchLength=typeof MATCH_LENGTHS[number];
export const HALF_SECONDS=WORLD.clock.match.HALF_SECONDS.v;
export const SUB_MINUTES=[WORLD.clock.match.SUB_MINUTES.first.v,WORLD.clock.match.SUB_MINUTES.second.v,WORLD.clock.match.SUB_MINUTES.third.v] as const;

/**
 * Full time plays out the last attack (owner-approved, 12 Oct 2026). Matches
 * only (runSimulation's kind 'match'); training runs end on the clock.
 *
 * When the clock reaches the match length, a side is IN AN ATTACK if, with
 * play live, its shot is in flight or it has the ball (at its feet, in flight
 * from its own kick, or loose since it last had it) in the opponents' half;
 * an awarded penalty waiting to be taken counts too. Anything else ends the
 * match on the clock, exactly as before. An attack carries on until:
 *  - the ball goes out of play or the referee stops it (goal, out, foul, offside),
 *    except an awarded penalty, which is taken;
 *  - a shot is resolved: it is no longer in flight (goal, save, miss, block);
 *  - the defending side wins the ball (a keeper's catch included);
 *  - the ball goes back into the attacking side's own half (the attack is over);
 *  - LAST_ATTACK_MAX seconds past full time, whatever is happening.
 * The engine's play before full time is untouched: a match that ends in an
 * attack is the same match up to the clock, plus these seconds.
 * Half-time (matches over 2700 s) is left alone: delaying it would shift the
 * whole second half's clock.
 */
export const LAST_ATTACK_MAX=WORLD.clock.match.LAST_ATTACK_MAX.v;
export interface LastAttackView {restart:{kind:string}|null;side:0|1;ball:{x:number;mode:'control'|'pass'|'shot'|'loose'}}
const ownHalf=(side:0|1,x:number)=>(side===0?x:L-x)<=L/2;
/** At full time: is `view.side` in an attack worth playing out? */
export function attackAtFullTime(view:LastAttackView):boolean{
 if(view.restart)return view.restart.kind==='penalty';
 return view.ball.mode==='shot'||!ownHalf(view.side,view.ball.x);
}
/** After full time: is the attack by `attacking` over? `shotSeen`: one of its shots has been in flight since full time. */
export function lastAttackOver(view:LastAttackView,attacking:0|1,shotSeen:boolean):boolean{
 if(view.side!==attacking)return true;
 if(view.restart)return view.restart.kind!=='penalty';
 if(view.ball.mode==='shot')return false;
 return shotSeen||ownHalf(attacking,view.ball.x);
}

export interface PlannedReplacement {outgoing:PracticePlayer;incoming:Player}

/**
 * Pick a like-for-like outfield change when a scheduled substitution is due.
 * The caller applies it at a stoppage and owns the schedule and substitution count.
 * `used` contains every player who has entered, using practice IDs (`0:van`).
 * Squad IDs and the returned incoming player's ID remain unprefixed (`van`).
 */
export function chooseReplacement(team:Team,activeForSide:readonly PracticePlayer[],used:ReadonlySet<string>):PlannedReplacement|null{
 if(!activeForSide.length)return null;
 const side=activeForSide[0].side;
 if(activeForSide.some(p=>p.side!==side))throw Error('Substitution selection needs one team');
 const prefix=`${side}:`,activeIds=new Set(activeForSide.map(p=>p.id));
 const bench=team.squad.filter(p=>!activeIds.has(prefix+p.id)&&!used.has(prefix+p.id));
 // Original squad order breaks equal-energy ties, independently of live array order.
 const squadOrder=new Map(team.squad.map((p,i)=>[prefix+p.id,i]));
 const outgoing=activeForSide.filter(p=>p.role!=='GK').slice().sort((a,b)=>a.energy-b.energy||(squadOrder.get(a.id)??Infinity)-(squadOrder.get(b.id)??Infinity));
 for(const player of outgoing){
  const incoming=bench.filter(p=>p.roles.includes(player.role)&&p.roles[0]!=='GK').sort((a,b)=>Number(b.roles[0]===player.role)-Number(a.roles[0]===player.role)||b.energy-a.energy)[0];
  if(incoming)return {outgoing:player,incoming};
 }
 return null;
}

/** Preserve the practice's movement-based drain; inputs use metres/second and seconds.
 * `acceleration` (m/s^2, change of speed) adds the metabolic cost of speeding
 * up: pressing, sprints and recoveries without the ball are high-intensity
 * work, while the ball-holding team's circulation is not charged for having
 * the ball. Metabolic power model (di Prampero et al. 2005; Minetti et al.
 * 2002): accelerating at a is running up an equivalent slope ES = a/g, with
 * cost EC(ES) = 155.4ES^5 - 30.4ES^4 - 43.3ES^3 + 46.3ES^2 + 19.5ES + 3.6 J/kg/m
 * and equivalent mass sqrt(ES^2+1). Only the surcharge over constant-speed
 * running is added (speeding up costs extra, slowing down does not refund).
 * Its scale converts J/kg into energy points with the existing drain at the
 * high-intensity threshold (5.5 m/s = 19.8 km/h): 0.0006*5.5^2 points/s for
 * 3.6*5.5 W/kg, so constant running costs exactly what it did before. */
const G_ACC=WORLD.fatigue.match.G_ACC.v,HIGH_INTENSITY=WORLD.fatigue.match.HIGH_INTENSITY.v,METABOLIC_SCALE=WORLD.fatigue.match.speedCost.v*HIGH_INTENSITY*HIGH_INTENSITY/(WORLD.fatigue.match.flatCost.v*HIGH_INTENSITY);
const runningCost=(slope:number)=>{const e=clamp(slope,WORLD.fatigue.match.slopeMin.v,WORLD.fatigue.match.slopeMax.v);return WORLD.fatigue.match.minetti5.v*e**5-WORLD.fatigue.match.minetti4.v*e**4-WORLD.fatigue.match.minetti3.v*e**3+WORLD.fatigue.match.minetti2.v*e**2+WORLD.fatigue.match.minetti1.v*e+WORLD.fatigue.match.flatCost.v;};
/**
 * Intensity is what costs (with `topPace`): the same drain is split so that
 * running above the player's own critical speed carries INTENSITY_SHARE of a
 * stamina-6 outfielder's match drain in the neutral mirror. Efforts above
 * 20 W/kg are 26% of the distance and about 42% of the energy of a real match
 * (Osgnach et al. 2010), and late-match fatigue follows glycogen emptied from
 * the fast fibres that high-intensity running recruits (Krustrup et al. 2006).
 * The rest of the movement cost is scaled down to match, so a stamina-6
 * player's total stayed where it was (until the tiredness bite below); a player who
 * presses and sprints more pays more, and stamina's higher critical speed
 * makes the same running cheaper on top of the existing stamina multiplier.
 * Without `topPace` the cost is the old one (kept for callers outside matches).
 *
 * Tiredness that bites (2026-10-11): futsal players tire heavily and are
 * rotated, and stamina should be a skill a manager picks for. With the split
 * above alone a stamina-6 outfielder ended a 15-minute match near energy 82,
 * no player ever dropped below 78, and +3 stamina on every outfielder was worth
 * no clear goal difference. So:
 * - INTENSITY_COST is 2.6 × the share-matched .158: the running above critical
 *   speed now drains 2.6 times as much (constant-speed movement is unchanged),
 *   so the players who press and sprint most are the ones who empty.
 * - Stamina scales the whole drain more steeply: 1.02 × (1 − 0.11 × (stamina − 6))
 *   (was 1.5 − 0.08 × stamina = 1.02 × (1 − 0.078 × (stamina − 6))), floored
 *   at 0.3 of a stamina-6 player's drain.
 * In the neutral style round robin a stamina-6 outfielder's energy is about
 * 87 at 5:00, 78 at 10:00 and 69 at the end (was 93 / 88 / 82); among real
 * clubs' players stamina 4 ends near 60 and stamina 9 near 76, and +3 stamina
 * on every outfielder is worth +2.6 goals a match (was +0.75). Goals, shots and
 * chances per match did not move. Evidence: evidence/2026-10-11-tiredness-bite
 * (branch ballers-overnight-run, 3caaeb6a: variant bite-mid in patch.mjs,
 * results/tables.md).
 * Stamina as lasting (2026-10-12, evidence/2026-10-12-stamina): the sprint
 * reserve no longer favours a fresh fit player, so fresh legs are sharper than
 * before and late ones duller for everyone (see `reserveBalance`), and players
 * run more early. STAMINA6_DRAIN is re-centred to 0.98 (was 1.02) so a
 * stamina-6 outfielder still ends a neutral match near 68 (84.7 / 74.8 / 68.0
 * at 5 / 10 / 15 min in the style round robin, against 87.0 / 77.0 / 68.4).
 */
/** The aerobic threshold for the energy drain: running above it costs energy (INTENSITY_COST), and a fitter
 * player's is higher, so the same running costs him less (0.77–0.83 of top pace from stamina 3 to 9, about the
 * spread of real CS, ± 10%). Energy only: the sprint reserve uses `sprintThreshold`, the same for every stamina. */
export const criticalSpeed=(stamina:number,topPace:number)=>(WORLD.fatigue.match.criticalBase.v+clamp(stamina,0,12)*WORLD.fatigue.match.criticalPer.v)*topPace;
export const INTENSITY_SHARE=WORLD.fatigue.match.INTENSITY_SHARE.v,MOVEMENT_SHARE=1-INTENSITY_SHARE,INTENSITY_COST=WORLD.fatigue.match.INTENSITY_COST.v;
export const STAMINA6_DRAIN=WORLD.fatigue.match.STAMINA6_DRAIN.v,STAMINA_DRAIN_SLOPE=WORLD.fatigue.match.STAMINA_DRAIN_SLOPE.v,STAMINA_DRAIN_FLOOR=WORLD.fatigue.match.STAMINA_DRAIN_FLOOR.v;
const staminaDrain=(stamina:number)=>STAMINA6_DRAIN*Math.max(STAMINA_DRAIN_FLOOR,1-STAMINA_DRAIN_SLOPE*(clamp(stamina,0,12)-WORLD.fatigue.match.drainCentre.v));
export function fatigueCost(speed:number,stamina:number,seconds:number,acceleration=0,topPace?:number):number{
 const movement=Math.max(0,speed),slope=Math.max(0,acceleration)/G_ACC;
 const surcharge=slope>0?Math.max(0,runningCost(slope)*Math.sqrt(slope*slope+1)-WORLD.fatigue.match.flatCost.v)*movement*METABOLIC_SCALE:0;
 const base=movement*movement*WORLD.fatigue.match.speedCost.v+surcharge,staminaScale=staminaDrain(stamina);
 if(topPace===undefined)return Math.max(0,seconds)*base*staminaScale;
 return Math.max(0,seconds)*(MOVEMENT_SHARE*base+INTENSITY_COST*Math.max(0,movement-criticalSpeed(stamina,topPace)))*staminaScale;
}
export function fatigueEnergy(energy:number,speed:number,stamina:number,seconds:number,acceleration=0,topPace?:number):number{
 return clamp(energy-fatigueCost(speed,stamina,seconds,acceleration,topPace),0,100);
}
/** A short recovery at the interval, not a fresh player's full reservoir. */
export function halfEnergy(energy:number):number{return clamp(energy+WORLD.fatigue.match.halfTimeRest.v,0,100);}

/**
 * Short-term sprint reserve: D′, the running form of W′ (the work available
 * above critical power), kept as a fraction 0–1 of the player's own reserve.
 * - Above the sprint threshold (CS, critical speed) it falls by the distance
 *   run above it (the distance form of the CS model: Hughson et al. 1984;
 *   Pettitt et al. 2012).
 * - Below CS it refills exponentially, faster the further below CS he runs
 *   (Skiba et al. 2012, 2015). PCr resynthesis half-time is 21–57 s (Harris et
 *   al. 1976; Bogdanis et al. 1995; McMahon & Jenkins 2002).
 * - CS is set by the share of match time spent above it, not by its real
 *   3.9 m/s: the engine's outfielders cover ~190 m/min with 38% of their time
 *   above 4 m/s, against ~110–120 m/min and roughly a tenth of the time above
 *   CS in real futsal and football (Barbero-Alvarez et al. 2008; Bradley et al.
 *   2009). At 0.8 × top pace (the engine's 5.5 m/s high-intensity line for
 *   pace 6) they spend 13% of the time above it.
 * - Accelerations are not charged here. The engine's steering speeds up and
 *   brakes at full rate every few seconds (smoothed acceleration above
 *   3 m/s² for 16% of the time, against roughly 1% in real matches), so a
 *   metabolic-power charge left every outfielder near empty all match.
 * - D′ is 13 m, sized so repeated-sprint tests lose 3–8% (see `legs`); the
 *   tiredness bite (2026-10-11, see `fatigueCost`) made it smaller and the
 *   refill slower, so a run of sprints or a long press empties it sooner.
 *
 * Stamina is how long a player lasts, not a second pace skill (2026-10-12).
 * Stamina used to raise CS (0.77–0.83 of top pace from stamina 3 to 9), D′
 * (±20%) and the refill (47 / 40 / 33 s), so a fresh +3 side had a fuller
 * reserve within two minutes: +10–14% acceleration all match, which carried
 * the whole of stamina's +3.5 goal swing and put a +3 side ahead from the
 * first minutes. Now a fresh player's burst is the same at any stamina, and
 * stamina acts through energy, which it drains more slowly (`fatigueCost`):
 * - CS follows his top pace of the moment: SPRINT_SHARE × listed pace ×
 *   `energyTop`, 0.834 of listed pace fresh, 0.80 at a typical moment and 0.76
 *   at energy 69, so it falls as he tires: CS and W′ both decline after
 *   prolonged exercise (Clark et al. 2019). Before, a tired player whose top speed sank under a CS fixed on his
 *   listed pace stopped drawing on the reserve at all; it refilled, his
 *   acceleration came back, and tiredness cancelled itself (a 27-point energy
 *   gap at 15:00 was worth nothing in the last five minutes).
 * - The refill slows as he tires: 34 s at energy 100, 41 s at 83 and 47 s at
 *   69 (a stamina-6 player's match average and usual end; it was a flat 40 s
 *   at stamina 6). Repeated-sprint ability
 *   falls late in matches with the glycogen emptied from the fast fibres
 *   (Krustrup et al. 2006; Mohr et al. 2005), so whoever has more left in the
 *   tank recovers faster between efforts.
 * Fresh, a stamina-3 and a stamina-9 player run the same repeated-sprint test
 * (6 × 30 m every 25 s: 5.4% decrement, evidence/2026-10-12-stamina/rsa.mjs).
 * In matches (+3 / −3 stamina on every outfielder, 80 each against the neutral
 * five) stamina's good-chance swing is +0.1 in the first five minutes, +0.7
 * from 5 to 10 and +0.9 from 10 to 15 (was +1.1 / +1.3 / +1.0), and the goal
 * swing +2.5 (was +4.1). Evidence: evidence/2026-10-12-stamina.
 */
export const SPRINT_SHARE=WORLD.fatigue.match.SPRINT_SHARE.v;
export const sprintThreshold=(topPace:number,energy:number)=>SPRINT_SHARE*topPace*energyTop(energy);
export const RESERVE_SIZE=WORLD.fatigue.match.RESERVE_SIZE.v;
export const RESERVE_HALF_LIFE_FRESH=WORLD.fatigue.match.RESERVE_HALF_LIFE_FRESH.v,RESERVE_FATIGUE_SLOWER=WORLD.fatigue.match.RESERVE_FATIGUE_SLOWER.v;
export const reserveHalfLife=(energy:number)=>RESERVE_HALF_LIFE_FRESH*(1+RESERVE_FATIGUE_SLOWER*(100-clamp(energy,0,100))/100);
export function reserveBalance(reserve:number,speed:number,energy:number,topPace:number,seconds:number):number{
 const cs=sprintThreshold(topPace,energy),v=Math.max(0,speed),dt=Math.max(0,seconds);
 const next=v>cs?reserve-(v-cs)*dt/RESERVE_SIZE:reserve+(1-reserve)*(cs-v)/cs*Math.LN2/reserveHalfLife(energy)*dt;
 return clamp(next,0,1);
}
/**
 * What the reserve does to the next effort: it limits acceleration most and
 * top speed a little.
 * - The loss grows with the square of the spent share: between the classic
 *   CP model (no loss until W′ is empty) and Morton's (1996) linear fall of
 *   the power available above CP.
 * - Slopes and D′ are calibrated on repeated-sprint tests, where the
 *   sprint-to-sprint loss is 3–8% (Spencer et al. 2005; Girard et al. 2011):
 *   6 × 30 m from a standing start, one every 25 s, lost 8.9 / 4.8 / 2.4%
 *   at stamina 3 / 6 / 9 (evidence/2026-10-10-tiredness/rsa.mjs). With the
 *   tiredness bite's smaller, slower reserve it lost 11.6 / 8.2 / 4.2%. Since
 *   stamina reaches the reserve only through energy (2026-10-12) a fresh
 *   player loses 5.4% at any stamina (evidence/2026-10-12-stamina/rsa.mjs);
 *   a tired one loses more, which is where stamina shows.
 * - Centred, not a fitness tax: pace and acceleration were tuned on matches
 *   where every player is part-spent, so the skill values stay the legs of a
 *   stamina-6 outfielder at his usual state in the neutral mirror
 *   (TYPICAL_SPENT, the mean squared spent share: .31 under the tiredness
 *   bite's smaller, slower reserve, .18 before; .32 since the reserve follows
 *   energy, 2026-10-12, set with ENERGY_SPENT_SQ_MEAN so the match-average top
 *   pace and acceleration of stamina-6 outfielders equal the build before,
 *   within 1%, evidence/2026-10-12-stamina centre.mjs). A fresh
 *   substitute or a rested player is sharper than that, a player in a run of
 *   sprints duller, and low stamina sits below it on average.
 * - Energy, the long-term fatigue, also scales acceleration (`energyAcceleration`),
 *   as it scales top pace (`energyTop`). Keepers keep 0.8 + 0.2 × energy/100.
 */
export const RESERVE_TOP=WORLD.fatigue.match.RESERVE_TOP.v,RESERVE_ACCELERATION=WORLD.fatigue.match.RESERVE_ACCELERATION.v,TYPICAL_SPENT=WORLD.fatigue.match.TYPICAL_SPENT.v;
export function legs(energy:number,reserve?:number):{top:number;acceleration:number}{
 // Keepers: short dives from set positions never draw the reserve (it stays above 0.96 all match),
 // so it is not applied to them; centring on outfielders would otherwise make every keeper sharper.
 // Their energy barely moves either, so they keep the old linear energy line.
 if(reserve===undefined)return {top:1,acceleration:WORLD.fatigue.match.keeperAccelFloor.v+WORLD.fatigue.match.keeperAccelShare.v*clamp(energy,0,100)/100};
 const tired=energyAcceleration(energy);
 const spent=(1-clamp(reserve,0,1))**2;
 return {top:(1-RESERVE_TOP*spent)/(1-RESERVE_TOP*TYPICAL_SPENT),acceleration:(1-RESERVE_ACCELERATION*spent)/(1-RESERVE_ACCELERATION*TYPICAL_SPENT)*tired};
}

/**
 * What energy (the long-term fatigue) does to an outfielder's legs: top pace
 * (`energyTop`, times basePace) and acceleration (`energyAcceleration`, in `legs`).
 * - The loss grows with the square of the energy spent, so it bites late and
 *   hardest on whoever ran most: a player at 95 has almost his full legs, one
 *   at 60 has clearly lost a step. Linear lines (0.7 + 0.3 × energy/100 for
 *   pace, 0.8 + 0.2 × energy/100 for acceleration) charged the first points
 *   spent as much as the last.
 * - Centred, not a fitness tax: pace and acceleration were tuned on matches
 *   played with the linear lines, so the factors equal those lines' time-mean
 *   over outfielders (ENERGY_TOP_MEAN, ENERGY_ACCELERATION_MEAN, measured on
 *   the build before the tiredness bite) at the time-mean squared spend under
 *   the bite (ENERGY_SPENT_SQ_MEAN, (100 − energy)², measured: 352). A typical
 *   player at a typical moment keeps his listed skills on average. Since the
 *   sprint reserve follows energy (2026-10-12) tiredness no longer cancels
 *   itself through the reserve, so ENERGY_SPENT_SQ_MEAN is re-centred to 425
 *   (with TYPICAL_SPENT, see `legs`) to keep the match-average legs: fresh
 *   players are sharper (1.011 pace and 1.033 acceleration at 100), tired ones
 *   duller (0.925 and 0.918 at 69, a stamina-6 player's usual end).
 * - Keepers keep the linear lines (their energy barely moves).
 * Evidence: evidence/2026-10-11-tiredness-bite (branch ballers-overnight-run,
 * 3caaeb6a: patch.mjs, centre.mjs on results/pilot*.jsonl, results/tables.md).
 */
export const ENERGY_TOP_MEAN=WORLD.fatigue.match.ENERGY_TOP_MEAN.v,ENERGY_ACCELERATION_MEAN=WORLD.fatigue.match.ENERGY_ACCELERATION_MEAN.v,ENERGY_SPENT_SQ_MEAN=WORLD.fatigue.match.ENERGY_SPENT_SQ_MEAN.v;
export const ENERGY_TOP_LOSS=WORLD.fatigue.match.ENERGY_TOP_LOSS.v,ENERGY_ACCELERATION_LOSS=WORLD.fatigue.match.ENERGY_ACCELERATION_LOSS.v;
const spentSq=(energy:number)=>(100-clamp(energy,0,100))**2;
export const energyTop=(energy:number,keeper=false)=>keeper?WORLD.fatigue.match.keeperTopFloor.v+WORLD.fatigue.match.keeperTopShare.v*energy/100:Math.max(WORLD.fatigue.match.topFloor.v,ENERGY_TOP_MEAN-ENERGY_TOP_LOSS*(spentSq(energy)-ENERGY_SPENT_SQ_MEAN));
export const energyAcceleration=(energy:number)=>Math.max(WORLD.fatigue.match.accelerationFloor.v,ENERGY_ACCELERATION_MEAN-ENERGY_ACCELERATION_LOSS*(spentSq(energy)-ENERGY_SPENT_SQ_MEAN));
