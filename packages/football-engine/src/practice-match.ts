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
export function fatigueCost(speed:number,stamina:number,seconds:number,acceleration=0):number{
 const movement=Math.max(0,speed),slope=Math.max(0,acceleration)/G_ACC;
 const surcharge=slope>0?Math.max(0,runningCost(slope)*Math.sqrt(slope*slope+1)-3.6)*movement*METABOLIC_SCALE:0;
 return Math.max(0,seconds)*(movement*movement*.0006+surcharge)*(1.5-clamp(stamina,0,12)*.08);
}
export function fatigueEnergy(energy:number,speed:number,stamina:number,seconds:number,acceleration=0):number{
 return clamp(energy-fatigueCost(speed,stamina,seconds,acceleration),0,100);
}
/** A short recovery at the interval, not a fresh player's full reservoir. */
export function halfEnergy(energy:number):number{return clamp(energy+6,0,100);}
