import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Player,Team} from './model.js';
import type {PracticePlayer} from './practice.js';

export const MATCH_LENGTHS=[300,900,5400] as const;
export type MatchLength=typeof MATCH_LENGTHS[number];
export const HALF_SECONDS=2700;
export const SUB_MINUTES=[60,70,80] as const;

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
const G_ACC=9.81,HIGH_INTENSITY=5.5,METABOLIC_SCALE=.0006*HIGH_INTENSITY*HIGH_INTENSITY/(3.6*HIGH_INTENSITY);
const runningCost=(slope:number)=>{const e=clamp(slope,-.45,.45);return 155.4*e**5-30.4*e**4-43.3*e**3+46.3*e**2+19.5*e+3.6;};
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
 */
export const INTENSITY_SHARE=.42,MOVEMENT_SHARE=1-INTENSITY_SHARE,INTENSITY_COST=.4108;
export const STAMINA6_DRAIN=1.02,STAMINA_DRAIN_SLOPE=.11,STAMINA_DRAIN_FLOOR=.3;
const staminaDrain=(stamina:number)=>STAMINA6_DRAIN*Math.max(STAMINA_DRAIN_FLOOR,1-STAMINA_DRAIN_SLOPE*(clamp(stamina,0,12)-6));
export function fatigueCost(speed:number,stamina:number,seconds:number,acceleration=0,topPace?:number):number{
 const movement=Math.max(0,speed),slope=Math.max(0,acceleration)/G_ACC;
 const surcharge=slope>0?Math.max(0,runningCost(slope)*Math.sqrt(slope*slope+1)-3.6)*movement*METABOLIC_SCALE:0;
 const base=movement*movement*.0006+surcharge,staminaScale=staminaDrain(stamina);
 if(topPace===undefined)return Math.max(0,seconds)*base*staminaScale;
 return Math.max(0,seconds)*(MOVEMENT_SHARE*base+INTENSITY_COST*Math.max(0,movement-criticalSpeed(stamina,topPace)))*staminaScale;
}
export function fatigueEnergy(energy:number,speed:number,stamina:number,seconds:number,acceleration=0,topPace?:number):number{
 return clamp(energy-fatigueCost(speed,stamina,seconds,acceleration,topPace),0,100);
}
/** A short recovery at the interval, not a fresh player's full reservoir. */
export function halfEnergy(energy:number):number{return clamp(energy+6,0,100);}

/**
 * Short-term sprint reserve: D′, the running form of W′ (the work available
 * above critical power), kept as a fraction 0–1 of the player's own reserve.
 * - Above critical speed (CS) it falls by the distance run above CS (the
 *   distance form of the CS model: Hughson et al. 1984; Pettitt et al. 2012).
 * - Below CS it refills exponentially, faster the further below CS he runs
 *   (Skiba et al. 2012, 2015): standing still halves the deficit in about
 *   30 s, a jog at half of CS in about a minute. PCr resynthesis half-time is
 *   21–57 s (Harris et al. 1976; Bogdanis et al. 1995; McMahon & Jenkins
 *   2002), and aerobic fitness speeds it (Tomlin & Wenger 2001): 35 s at
 *   stamina 6, 2 s less per stamina point, then all 15% slower for the
 *   tiredness bite (below): stamina 3 / 6 / 9 gives 47 / 40 / 33 s.
 * - CS is set by the share of match time spent above it, not by its real
 *   3.9 m/s: the engine's outfielders cover ~190 m/min with 38% of their time
 *   above 4 m/s, against ~110–120 m/min and roughly a tenth of the time above
 *   CS in real futsal and football (Barbero-Alvarez et al. 2008; Bradley et al.
 *   2009). At 0.8 × top pace (the engine's 5.5 m/s high-intensity line for
 *   pace 6) they spend 13% of the time above it. Stamina moves it 0.77–0.83
 *   of top pace from stamina 3 to 9, about the spread of real CS (± 10%).
 * - Accelerations are not charged here. The engine's steering speeds up and
 *   brakes at full rate every few seconds (smoothed acceleration above
 *   3 m/s² for 16% of the time, against roughly 1% in real matches), so a
 *   metabolic-power charge left every outfielder near empty all match.
 * - D′ (metres above CS) is sized so repeated-sprint tests lose 3–8% (see
 *   `legs`); stamina moves it 6.5% a point around stamina 6 (±20% from
 *   stamina 3 to 9, a little wider than D′'s real ±15%, so stamina shows).
 * - Tiredness bite (2026-10-11, see `fatigueCost`): D′ 13 m at stamina 6
 *   (was 16 m, ±15%) and the 15% slower refill, so a run of sprints or a long
 *   press empties the reserve sooner and it takes longer to come back; the
 *   reserve is below half for about half of a match (was a seventh).
 */
export const criticalSpeed=(stamina:number,topPace:number)=>(.74+clamp(stamina,0,12)*.01)*topPace;
export const RESERVE_SIZE=13,RESERVE_STAMINA_SLOPE=.065;
export const reserveSize=(stamina:number)=>RESERVE_SIZE*(1+RESERVE_STAMINA_SLOPE*(clamp(stamina,0,12)-6));
export const RESERVE_HALF_LIFE=35,RESERVE_HALF_LIFE_SLOPE=2,RESERVE_REFILL_SLOWER=1.15;
export const reserveHalfLife=(stamina:number)=>RESERVE_REFILL_SLOWER*(RESERVE_HALF_LIFE-RESERVE_HALF_LIFE_SLOPE*(clamp(stamina,0,12)-6));
export function reserveBalance(reserve:number,speed:number,stamina:number,topPace:number,seconds:number):number{
 const cs=criticalSpeed(stamina,topPace),v=Math.max(0,speed),dt=Math.max(0,seconds);
 const next=v>cs?reserve-(v-cs)*dt/reserveSize(stamina):reserve+(1-reserve)*(cs-v)/cs*Math.LN2/reserveHalfLife(stamina)*dt;
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
 *   tiredness bite's smaller, slower reserve it loses 11.6 / 8.2 / 4.2%: the
 *   top of the real range at stamina 6 and past it at stamina 3, on purpose,
 *   so that a run of sprints costs and stamina shows.
 * - Centred, not a fitness tax: pace and acceleration were tuned on matches
 *   where every player is part-spent, so the skill values stay the legs of a
 *   stamina-6 outfielder at his usual state in the neutral mirror
 *   (TYPICAL_SPENT, the mean squared spent share, measured: .31 under the
 *   tiredness bite's smaller, slower reserve, .18 before). A fresh
 *   substitute or a rested player is sharper than that, a player in a run of
 *   sprints duller, and low stamina sits below it on average.
 * - Energy, the long-term fatigue, also scales acceleration (`energyAcceleration`),
 *   as it scales top pace (`energyTop`). Keepers keep 0.8 + 0.2 × energy/100.
 */
export const RESERVE_TOP=.15,RESERVE_ACCELERATION=.6,TYPICAL_SPENT=.31;
export function legs(energy:number,reserve?:number):{top:number;acceleration:number}{
 // Keepers: short dives from set positions never draw the reserve (it stays above 0.96 all match),
 // so it is not applied to them; centring on outfielders would otherwise make every keeper sharper.
 // Their energy barely moves either, so they keep the old linear energy line.
 if(reserve===undefined)return {top:1,acceleration:.8+.2*clamp(energy,0,100)/100};
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
 *   the bite (ENERGY_SPENT_SQ_MEAN, (100 − energy)², measured). A typical
 *   player at a typical moment keeps his listed skills on average; fresh
 *   players are a little sharper (1.005 pace and 1.024 acceleration at 100),
 *   tired ones duller (0.92 and 0.91 at 69, a stamina-6 player's usual end).
 * - Keepers keep the linear lines (their energy barely moves).
 * Evidence: evidence/2026-10-11-tiredness-bite (branch ballers-overnight-run,
 * 3caaeb6a: patch.mjs, centre.mjs on results/pilot*.jsonl, results/tables.md).
 */
export const ENERGY_TOP_MEAN=.9729,ENERGY_ACCELERATION_MEAN=.9819,ENERGY_SPENT_SQ_MEAN=352;
export const ENERGY_TOP_LOSS=.9e-4,ENERGY_ACCELERATION_LOSS=1.2e-4;
const spentSq=(energy:number)=>(100-clamp(energy,0,100))**2;
export const energyTop=(energy:number,keeper=false)=>keeper?.7+.3*energy/100:Math.max(.5,ENERGY_TOP_MEAN-ENERGY_TOP_LOSS*(spentSq(energy)-ENERGY_SPENT_SQ_MEAN));
export const energyAcceleration=(energy:number)=>Math.max(.5,ENERGY_ACCELERATION_MEAN-ENERGY_ACCELERATION_LOSS*(spentSq(energy)-ENERGY_SPENT_SQ_MEAN));
