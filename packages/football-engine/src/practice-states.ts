import type {Side,Skills,Traits} from './model.js';

/**
 * Player match-states (1 Nov 2026; deliverables/ballers-showcase/contracts/ENGINE.md §10 and
 * evidence/2026-11-01-player-states/DESIGN.md).
 *
 * A state is something that happens to one man during a match and changes how he plays while it holds: an id, a start
 * (`from`, match seconds), an end (`until`; none = full time) and its effect (STATE_EFFECTS). One state exists:
 * **injured** ("injured, playing on"): a man hurt with no change left (practice.ts applyInjuries, `playedOn`), from the
 * moment he gets up after his treatment until full time. Inspired, power-ups and the like are future rows of
 * STATE_EFFECTS plus whatever begins them; the engine applies every state the same way.
 *
 * Where a state plugs in. Three channels, and nothing else:
 *  - LEGS (`form.top`, `form.acceleration`): practice.ts sets every man's top speed and acceleration once a tick from
 *    his energy and sprint reserve; a state multiplies them there. Every run, press, recovery, keeper's dive and every
 *    race read (arrivalTime: who gets there first, for both sides) moves at them, so team-mates and opponents read his
 *    legs as they are.
 *  - BODY (`form.strike`, `form.reach`): `p.form` is read as one factor where the body sets a physical output: the power
 *    of every foot strike (the pass he can hit, a lofted pass, a shot, a clearance, a direct free kick, and every read
 *    of how fast his shot travels) and a keeper's reach. Absent (every man without a state) the factor is 1.
 *  - SKILLS and HABITS: while a state holds, the man's `skills` and `traits` are scaled copies (his own are kept here
 *    and put back when it ends). Every duel, jump, touch and strike already reads p.skills, and every decision's
 *    appetite (taking a man on, running in behind, stepping in to press or tackle, a risky pass, a shot from range, a
 *    keeper leaving his line) reads p.traits, so neither needs a call-site change: he decides with what he has now.
 * Deterministic (no dice) and opt-in: the book exists only with the injury key on, so a match without it never reaches
 * any of this, and no other man's skills, habits or legs are touched.
 */
export type StateId='injured';
/** How his body works while the state holds: multipliers (1 = as he is). */
export interface Form {top:number;acceleration:number;strike:number;reach:number}
export type HabitKey='risk'|'dribble'|'runs'|'engagement'|'audacity'|'keeperSweep';
export interface StateEffect {
 form:Form;
 /** Multipliers on his own skills (only those named). */ skills:Partial<Record<keyof Skills,number>>;
 /** Multipliers on his own habits (only those named, and only those he has). */ habits:Partial<Record<HabitKey,number>>;
 /** The engine's event text (Romanian, as every engine event) as it starts, and as it ends before full time. */
 begins:(name:string)=>string;ends:(name:string)=>string;
}

/**
 * Injured, playing on (the owner, 1 Nov: "if he continues playing he should be significantly worse until the game ends
 * in speed etc."). A man playing through a knock to the leg:
 *  - legs: about half his sprint and half his push off the mark. An outfielder of pace 6 (6.9 m/s flat out) tops out
 *    near 3.8 m/s: a jog. A keeper's dive is a move at these legs too, so it is slower and shorter;
 *  - strikes: a quarter less power at most. The firmest pass he can hit drops from about 24 m/s to 18, so the long,
 *    driven pass is gone (he picks the passes he can make: practice-passing reads this limit) and a shot from range
 *    arrives softer;
 *  - a keeper's reach: a quarter less at full stretch (about 2.1 m to 1.6);
 *  - skills: strength 0.6 (shielding, tackling, riding a challenge, staying on his feet), aerial 0.5 (he can barely
 *    leave the ground), defending 0.8 (getting a foot in), control 0.85 (a heavier touch, worse balance), passing 0.9
 *    and finishing / set pieces 0.85 (a striking foot he cannot trust: less accurate), keeping 0.8. Reading and
 *    stamina are untouched: his head is fine; pace goes through the legs above;
 *  - habits: he avoids what hurts. Take-ons (dribble) and runs in behind (runs) to 0.3, stepping in (engagement) and
 *    risk to 0.6 (he plays it simple), audacity to 0.3 (no shots from range), a keeper's sweeping to 0.5 (he stays on
 *    his line).
 * The engine reads skills where they matter, so some reads blur a little with them (how well he judges the lane of
 * his own pass or the chance of his own shot): the engine's perception is built from the skills each read uses.
 */
export const INJURED_FORM:Form={top:.55,acceleration:.5,strike:.75,reach:.75};
export const INJURED_SKILLS:StateEffect['skills']={strength:.6,aerial:.5,defending:.8,control:.85,passing:.9,finishing:.85,setPieces:.85,keeping:.8};
export const INJURED_HABITS:StateEffect['habits']={dribble:.3,runs:.3,engagement:.6,risk:.6,audacity:.3,keeperSweep:.5};
export const STATE_EFFECTS:Record<StateId,StateEffect>={
 injured:{form:INJURED_FORM,skills:INJURED_SKILLS,habits:INJURED_HABITS,
  begins:name=>`${name} se ridică și continuă, accidentat.`,ends:name=>`${name} și-a revenit.`},
};
/** No skill above this (the engine's validated range), no habit above 1. */
const SKILL_MAX=12;

/** One state as it happened: who, which, from when (match seconds), and until when when it ended before full time. */
export interface StateRecord {player:string;side:Side;id:StateId;from:number;until?:number}
/** What a `state` event carries: which state, and whether it begins (true) or ends. */
export interface StateMark {id:StateId;on:boolean}

type Body={id:string;name:string;side:Side;skills:Skills;traits:Traits;form?:Form};
interface Active {p:Body;states:StateRecord[];own:{skills:Skills;traits:Traits};shown:{skills:Skills;traits:Traits}}

/** The states of one match: those waiting to begin, those holding, and every one that began (`records`). */
export class PlayerStates {
 readonly records:StateRecord[]=[];
 private waiting:{p:Body;r:StateRecord}[]=[];
 private active=new Map<string,Active>();
 /** A state for `p` from `from` (match seconds; it begins at the first tick at or after it) until `until` (absent =
  * full time). */
 begin(p:Body,id:StateId,from:number,until?:number):void{
  this.waiting.push({p,r:{player:p.id,side:p.side,id,from,...(until!==undefined?{until}:{})}});
 }
 /** Once a tick, before anything else is said: the states due begin, and those due end (a man no longer on the pitch
  * ends his). Returns them, in order, for the caller's `state` events. */
 tick(time:number,onPitch:(id:string)=>boolean):{began:{p:Body;r:StateRecord}[];ended:{p:Body;r:StateRecord}[]}{
  const began:{p:Body;r:StateRecord}[]=[],ended:{p:Body;r:StateRecord}[]=[];
  if(this.waiting.length){
   const due=this.waiting.filter(w=>time>=w.r.from-1e-9);
   if(due.length){
    this.waiting=this.waiting.filter(w=>!due.includes(w));
    for(const w of due){
     if(!onPitch(w.p.id))continue;
     const r={...w.r,from:time};this.records.push(r);began.push({p:w.p,r});
     const a=this.active.get(w.p.id);
     if(a)a.states.push(r);else this.active.set(w.p.id,{p:w.p,states:[r],own:{skills:w.p.skills,traits:w.p.traits},shown:{skills:w.p.skills,traits:w.p.traits}});
     this.apply(this.active.get(w.p.id)!);
    }
   }
  }
  for(const a of this.active.values()){
   this.rebase(a);
   const gone=!onPitch(a.p.id),over=a.states.filter(r=>gone||r.until!==undefined&&time>=r.until-1e-9);
   if(!over.length)continue;
   for(const r of over){r.until=time;ended.push({p:a.p,r});}
   a.states=a.states.filter(r=>!over.includes(r));
   this.apply(a);if(!a.states.length)this.active.delete(a.p.id);
  }
  return {began,ended};
 }
 /** Something else replaced his skills or habits while a state held (a plan switch sets a keeper's sweeping habit):
  * what it changed becomes his own, and the state applies on top of it again. */
 private rebase(a:Active){
  const p=a.p;if(p.skills===a.shown.skills&&p.traits===a.shown.traits)return;
  const own=(now:Record<string,unknown>,shown:Record<string,unknown>,base:Record<string,unknown>)=>{
   const out={...base};
   for(const k of new Set([...Object.keys(now),...Object.keys(shown)])){if(!(k in now))delete out[k];else if(now[k]!==shown[k])out[k]=now[k];}
   return out;
  };
  a.own={skills:own(p.skills as never,a.shown.skills as never,a.own.skills as never) as unknown as Skills,traits:own(p.traits as never,a.shown.traits as never,a.own.traits as never) as unknown as Traits};
  this.apply(a);
 }
 /** His skills, habits and form under every state he is in (they multiply); his own back when none is left. */
 private apply(a:Active){
  const p=a.p;
  if(!a.states.length){p.skills=a.own.skills;p.traits=a.own.traits;delete p.form;a.shown={skills:p.skills,traits:p.traits};return;}
  const skills={...a.own.skills},traits={...a.own.traits},form:Form={top:1,acceleration:1,strike:1,reach:1};
  for(const r of a.states){
   const e=STATE_EFFECTS[r.id];
   for(const [k,m] of Object.entries(e.skills) as [keyof Skills,number][])skills[k]=Math.min(SKILL_MAX,skills[k]*m);
   for(const [k,m] of Object.entries(e.habits) as [HabitKey,number][]){const v=traits[k];if(v!==undefined)traits[k]=Math.min(1,v*m);}
   form.top*=e.form.top;form.acceleration*=e.form.acceleration;form.strike*=e.form.strike;form.reach*=e.form.reach;
  }
  p.skills=skills;p.traits=traits;p.form=form;a.shown={skills,traits};
 }
}
