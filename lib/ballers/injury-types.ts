// Ballers injury types (deliverables/ballers-injury-types/CATALOGUE.md, approved with the owner's decisions of 25 Nov):
// which injury a hurt man got, picked ONCE when the match is computed (lib/ballers/compute.ts compact) and stored, so
// every screen and the paper name the same injury: on the replay's injury event (`ij.t`), in the submit payload's
// injuries (`type`) and in public.ballers_injuries (`type`, written by private.ballers_fitness_after_submit).
//
// Pure and deterministic: the picking reads only the moment's facts and a seed drawn from the match seed and the injury.
// It imports nothing that plays a match, so its rules are checked on the laptop (verificare/ballers-injury-types.test.ts).
//
// A missing or unknown id reads as T0, exactly today's words ("muscle injury", "after X's tackle"): every replay and row
// stored before this, and whatever a later id this build does not know.
import {TIRED_LEVELS} from './subs';
import type {HurtDoing} from './injury-doing';

/** Every id that can be stored. The variants name a part the caption says, so a screen without frames (the squad lines,
 * the player page) names the same injury as the match: T3 a front-of-thigh strain (shooting, nothing in particular, a
 * challenge) and T3h a hamstring strain (sprinting: chasing back or running forward); T6a/T6c/T6s/T6t a bruised
 * ankle/calf/shin/thigh. The same list is the column's check (supabase/migrations/20261125120000_ballers_injury_types.sql);
 * verificare/fitness-db.test.ts compares them. Append only: a stored id never changes meaning. */
export const INJURY_TYPES=['T1','T2','T3','T3h','T4','T5','T6a','T6c','T6s','T6t','T7','T8','T9','T10','T11','F1','F2','F3'] as const;
export type StoredInjuryType=typeof INJURY_TYPES[number];
/** T0: the fallback, never stored (an injury typed T0 carries no id). */
export type InjuryType='T0'|StoredInjuryType;
const KNOWN=new Set<string>(INJURY_TYPES);
/** The type an id stands for: a known id, else T0 (missing, empty, unknown). */
export const injuryType=(v:unknown):InjuryType=>typeof v==='string'&&KNOWN.has(v)?v as StoredInjuryType:'T0';

/** The fun ones (owner, 25 Nov: about 1 in 6 of the 1-match injuries where one fits, never two in the same match). */
export const FUN_TYPES:ReadonlySet<InjuryType>=new Set<InjuryType>(['F1','F2','F3']);
export const FUN_ODDS=1/6;
/** The league stores a tiredness injury at most this many matches long (migration 20261124120000): the TWIN of
 * FITNESS.fatigueMaxMatches (lib/ballers/fitness.ts; verificare/ballers-injury-types.test.ts checks they agree). Kept
 * here so the match computation does not load the fitness screens' module. */
export const LEAGUE_FATIGUE_MAX=2;

/** The caption's English (owner, 25 Nov: football words are fine, "hamstring strain", "groin strain"). */
export const INJURY_EN:Readonly<Record<InjuryType,string>>={
 T0:'muscle injury',T1:'cramp',T2:'tight calf',T3:'thigh strain',T3h:'hamstring strain',T4:'groin strain',T5:'twisted ankle',
 T6a:'bruised ankle',T6c:'bruised calf',T6s:'bruised shin',T6t:'bruised thigh',T7:'torn thigh muscle',T8:'knee injury',T9:'knee injury',
 T10:'dislocated finger',T11:'bruised shoulder',F1:'hurt big toe',F2:'twisted ankle: stepped on the ball',F3:'twisted ankle: tripped',
};
/** A bruise's part (T6), as the commentary says it: „contuzie la gleznă / gambă / coapsă” (calf and shin are both the
 * „gambă”, as the catalogue's line says). Null for every other type. */
export const bruisePart=(t:InjuryType):'a'|'c'|'s'|'t'|null=>t==='T6a'?'a':t==='T6c'?'c':t==='T6s'?'s':t==='T6t'?'t':null;

/** The facts of one injury the type is picked from. `matches`: the length it is stored with (typingMatches); `exhausted`:
 * how tired he was as he got hurt reads "exhausted" (tiredLevelAt, the caption's own word); `keeper`: he plays in goal. */
export interface InjuryMoment {cause:'tackle'|'fatigue';hard:boolean;keeper:boolean;doing:HurtDoing|null;matches:number;exhausted:boolean}

/** The length a type is picked for: the engine's roll, a league tiredness injury capped as the league stores it
 * (LEAGUE_FATIGUE_MAX). `league` false (Bebe's showcase, or not known): the roll as given. */
export const typingMatches=(cause:'tackle'|'fatigue',rolled:number,league:boolean)=>cause==='fatigue'&&league?Math.min(rolled,LEAGUE_FATIGUE_MAX):rolled;

/** The substitution orders' level for an energy, exactly as lib/ballers/fitness.ts tiredAt reads it (rounded to a whole
 * point, as the replay keeps it): 'bit', 'tired', 'empty' (exhausted), or null (not even a bit tired, or unknown). */
export function tiredLevelAt(energy:number|null|undefined):'bit'|'tired'|'empty'|null{
 if(typeof energy!=='number'||!Number.isFinite(energy))return null;
 const e=Math.round(energy);
 return [...TIRED_LEVELS].reverse().find(t=>e<=t.energy)?.id??null;
}

/** The types a moment may draw (CATALOGUE.md §1c with the owner's decisions): `plain` always, `fun` only for a 1-match
 * injury where one fits. Empty `plain`: T0 (a tiredness injury of 3+ matches, which only Bebe's keeps, or a length
 * outside 1-6). A bruise (T6) is listed once and gets its part after (bruiseParts). */
export function typeCandidates(m:InjuryMoment):{plain:readonly ('T6'|InjuryType)[];fun:readonly InjuryType[]}{
 const n=m.matches,none={plain:[],fun:[]};
 if(!Number.isInteger(n)||n<1||n>6)return none;
 const {doing}=m,sprint=doing==='back'||doing==='forward';
 if(m.cause==='fatigue'){
  if(n>2)return none;
  // cramps: only an exhausted man out for exactly one match (owner, 25 Nov)
  const cramp=n===1&&m.exhausted?['T1' as const]:[];
  if(m.keeper)return {plain:[...cramp,'T2'],fun:[]};
  if(doing===null)return {plain:[...cramp,'T2','T3'],fun:[]};
  if(sprint)return {plain:n===1?['T3h',...cramp,'T2']:['T3h','T2'],fun:n===1?['F3']:[]};
  if(doing==='dribbling')return {plain:['T5'],fun:n===1?['F2']:[]};
  if(doing==='shooting')return {plain:['T3'],fun:n===1?['F1']:[]};
  return {plain:['T4'],fun:[]};
 }
 // a keeper hurt in a challenge or a collision, for a match or two: his fingers or his shoulder (owner, 25 Nov: never at
 // a save); longer, as an outfielder
 if(m.keeper&&n<=2)return {plain:['T10','T11'],fun:[]};
 // stretching in the duel: the inner thigh on the ball or reaching for a pass, else the thigh (the back of it sprinting)
 const stretch=doing==='pass'||doing==='dribbling'?'T4':sprint?'T3h':'T3';
 // stepped on as he ran with the ball (an outfielder, one match)
 const toe=n===1&&doing==='dribbling'&&!m.keeper?['F1' as const]:[];
 if(!m.hard){
  if(n<=2)return {plain:['T6','T5',stretch],fun:toe};
  // a soft tackle's long tail (owner, 25 Nov): 3 a twisted ankle, 4-6 a torn thigh muscle
  return {plain:n===3?['T5']:['T7'],fun:[]};
 }
 if(n<=2)return {plain:['T6','T5'],fun:toe};
 return {plain:n===3?['T5','T8']:['T8','T9','T7'],fun:[]};
}

/** Where a bruise lands (CATALOGUE.md §1c): on the ball or shooting, the ankle or the thigh; reaching for a pass, the
 * thigh; nothing in particular, the shin or the calf; chasing back or running forward, the calf. */
export function bruiseParts(doing:HurtDoing|null):readonly ('T6a'|'T6c'|'T6s'|'T6t')[]{
 return doing==='dribbling'||doing==='shooting'?['T6a','T6t']:doing==='pass'?['T6t']:doing===null?['T6s','T6c']:['T6c'];
}

/** mulberry32 (the club's usual seeded generator). */
function stream(seed:number){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
/** An injury's own seed: FNV-1a of the match seed, his second (ms) and his squad id. */
export function injurySeed(matchSeed:number,t:number,player:string):number{
 let h=2166136261;for(const c of `${matchSeed>>>0}:${Math.round(t)}:${player}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 return h;
}

/** The type for one moment. `funLeft`: no fun type yet in this match. With a fun type that fits and one left, it is
 * picked one time in six (FUN_ODDS); otherwise one of the plain ones, evenly; a bruise then gets its part, evenly. */
export function pickInjuryType(m:InjuryMoment,seed:number,funLeft:boolean):InjuryType{
 const c=typeCandidates(m),r=stream(seed);
 const u=r(),v=r(),w=r();
 if(funLeft&&c.fun.length&&u<FUN_ODDS)return c.fun[Math.floor(v*c.fun.length)];
 if(!c.plain.length)return 'T0';
 const base=c.plain[Math.floor(v*c.plain.length)];
 if(base!=='T6')return base;
 const parts=bruiseParts(m.doing);
 return parts[Math.floor(w*parts.length)];
}

/** A match's injuries, typed in the order given (the replay's event order): never two fun ones in one match. */
export function pickMatchTypes(list:readonly {moment:InjuryMoment;seed:number}[]):InjuryType[]{
 let funLeft=true;
 return list.map(({moment,seed})=>{const t=pickInjuryType(moment,seed,funLeft);if(FUN_TYPES.has(t))funLeft=false;return t;});
}

/** Whether the referee gave a foul on him at the second he got hurt: a `foul` event at that very millisecond with him as
 * its target (the engine says the foul and rolls the injury in the same tick, at the same time). The caption then says
 * "fouled by", the commentary „faultat”. Replay events (t ms, k, g). */
export const fouledAt=(events:readonly {t:number;k:string;g?:number}[],t:number,player:number)=>events.some(e=>e.k==='foul'&&e.t===t&&e.g===player);
