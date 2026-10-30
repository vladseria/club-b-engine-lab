import {rng} from './model.js';
import type {Fixture,Player,Role,Side,Team} from './model.js';

/**
 * Injuries (Bebe's showcase, 30 Oct 2026: deliverables/ballers-showcase/DESIGN.md §7 and contracts/ENGINE.md).
 * Opt-in, matches only: with no `injuries` key (or `on: false`) none of this code runs and the match is byte-identical
 * to one played before it existed. The dice are their own stream (rng(seed ^ salt ^ INJURY_SALT)): the match's own
 * random streams are never drawn, so a match with nobody hurt is the same football as the one without injuries.
 *
 * Two causes (the owner, 30 Oct: "mostly from tackles in our game"):
 * - a TACKLE INCIDENT: every challenge the engine resolves on a man (a standing tackle that wins the ball, is a foul
 *   or is ridden; a defender's foot at his reception, nicked or a foul; a foul in the air; a man barged as he loses
 *   the ball): the man challenged is rolled, never the tackler. A small risk for any challenge, more for the hit that
 *   went into him (practice-balance: m/s), much more for a HARD tackle (it put him on the floor, or it was a foul),
 *   all of it higher as he tires;
 * - FATIGUE: once a second of live play, a small risk that grows with the square of what he has spent below
 *   FATIGUE_FROM energy (it matters mostly late in a match, under about 80).
 * An age past AGE_FROM (only when the input gives ages) raises both. A man is rolled until he is hurt once.
 * Severity (matches out) is drawn from the same stream: SEVERITY (DESIGN §11), longer after a hard tackle.
 * The forced change itself lives in practice.ts (applyInjuries, at the next stoppage, outside the 3-change cap);
 * who comes on is injuryReplacement below.
 */
export interface InjuryInput {on:boolean;salt:number;
 /** Per side: squad id -> age in years. A player without one carries no age factor. */
 age?:[Record<string,number>,Record<string,number>]}
export type InjuryCause='tackle'|'fatigue';
export interface InjuryRecord {
 /** Match second (engine clock) of the hit or the roll. */ time:number;
 /** Practice id ('<side>:<squad id>'). */ player:string;side:Side;cause:InjuryCause;
 /** Tackle: the opponent who hit him (practice id). */ by?:string;
 /** Tackle: a hard one (it put him on the floor, or it was a foul). Fatigue: false. */ hard:boolean;
 /** His energy then (0-100, one decimal). */ energy:number;
 /** Matches out, 1-6. */ matches:number;
 /** When he went off (the forced change). Absent when he never did (hurt in the last attack after full time). */ off?:number;
 /** Who came on for him (practice id). */ replacement?:string;
 /** Nobody was left on the bench: he finished the match. */ playedOn?:true;
}
/** What an `injury` event carries; a forced change's `substitution` event carries cause and matches. */
export interface InjuryMark {cause:InjuryCause;hard?:boolean;matches:number;energy?:number}

/** Salt of the injury stream (xor-ed with the seed and the input's salt). */
export const INJURY_SALT=0x1c3a9e57;
/** A tackle incident's risk, rested, no age factor: TACKLE_RISK for any challenge, plus TACKLE_HIT per HIT_REF m/s
 * of hit that went into him (a challenge that met only the ball, or that he rode, carries the first part alone),
 * plus TACKLE_HARD for a hard tackle (it floored him, or it was a foul; severity then skews longer).
 * Tuned on the public lab (evidence/2026-10-30-showcase-injuries, contracts/ENGINE.md §6): with FATIGUE_RISK below,
 * F.C. Bebe Power (a select nine of real league players, 15-minute matches with substitutes) expects 0.40 injuries a
 * match against the drafted guest sides (one every 2.5 matches; 0.64 against the pirates, who foul twice as often),
 * 70% from tackles (45 / 20 / 35 base / hit / hard), 30% fatigue. */
export const TACKLE_RISK=0.0017,TACKLE_HIT=0.028,HIT_REF=3,TACKLE_HARD=0.048;
/** Tired legs: a tackle incident's risk x (1 + TIRED_TACKLE x (1 - energy / 100)): x1.6 at energy 70. */
export const TIRED_TACKLE=2;
/** Fatigue: per second of live play, FATIGUE_RISK x u^2 with u = (FATIGUE_FROM - energy) / FATIGUE_SPAN (0 when
 * fresher than FATIGUE_FROM): 0.021% a second at energy 70. Tuned with the tackle constants above. */
export const FATIGUE_RISK=0.00021,FATIGUE_FROM=100,FATIGUE_SPAN=30;
/** Age: x (1 + AGE_PER per year past AGE_FROM), for both causes. */
export const AGE_FROM=28,AGE_PER=0.05;
/** No single roll is surer than this. */
export const RISK_CAP=0.5;
/**
 * The injury stoppage (31 Oct, the owner's option B; contracts/ENGINE.md §4). From the moment he is hurt he is down:
 * he stays where he fell and takes no part (practice.ts puts him on the floor until he goes off). The referee stops
 * play for him (Laws of the Game, Law 5: he "stops play if a player is seriously injured and ensures that the player is
 * removed from the field of play"):
 *  - at once, unless an attack is in progress (the same "in an attack" the full-time whistle waits for,
 *    practice-match.ts attackAtFullTime), in which case he lets it play out (Law 5's advantage) until it ends (the
 *    attackers lose the ball, it goes back into their own half, their shot is over) or ADVANTAGE_MAX s have passed;
 *  - at once anyway when the hurt man has the ball, or is a keeper (nobody plays on against an empty goal);
 *  - if the ball goes dead by itself first (out, a goal, the foul that hurt him), that stoppage is the one.
 * He restarts with a dropped ball (Law 8, 2026-27: "the referee stops play and the Law does not require one of the
 * other restarts"): inside a penalty area, for the defending goalkeeper there; anywhere else for the team that had the
 * ball (at a man's feet), else the team that last touched it, where the ball was when play stopped; everyone else at
 * least DROP_DISTANCE m away (Law 8's 4 m, scaled as the engine scales 9.15 m to 5 m); a goal needs a second touch
 * (Law 8: "a goal cannot be scored until the ball has touched two players").
 * The stoppage, whichever it is, lasts at least INJURY_TREATMENT s of match time: the medics come on, he is helped
 * off and the substitute comes on (the forced change, as before, made at that stoppage). The clock runs on through it,
 * as through every dead ball (the engine adds no time; its only overrun is the last attack). None at the interval: a
 * man hurt in the attack that ends the first half goes off at the second half's kick-off, as before.
 */
export const ADVANTAGE_MAX=5,INJURY_TREATMENT=15,DROP_DISTANCE=2.2;
/** Matches out, 1..6: an ordinary injury (fatigue, or a contact that left him on his feet) and after a hard tackle.
 * DESIGN §11: 1 match 55%, 2 30%, 3 10%, 4-6 5%; hard tackles skew longer. */
export const SEVERITY:Record<'ordinary'|'hard',readonly number[]>={ordinary:[.55,.30,.10,.05/3,.05/3,.05/3],hard:[.40,.35,.15,.1/3,.1/3,.1/3]};

type Body={id:string;side:Side;energy:number};
const r1=(n:number)=>Math.round(n*10)/10;

/** Throws on an invalid key; returns a normalized copy. */
export function validateInjuries(value:unknown,fixture:Fixture):InjuryInput{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('injuries must be an object.');
 const v=value as Record<string,unknown>;
 if(typeof v.on!=='boolean')throw Error('injuries.on must be true or false.');
 if(!Number.isInteger(v.salt)||(v.salt as number)<0||(v.salt as number)>0xffffffff)throw Error('injuries.salt must be a whole number from 0 to 4294967295.');
 let age:InjuryInput['age'];
 if(v.age!==undefined){
  if(!Array.isArray(v.age)||v.age.length!==2)throw Error('injuries.age must hold one map per side.');
  age=v.age.map((m,side)=>{
   if(!m||typeof m!=='object'||Array.isArray(m))throw Error('injuries.age must hold one map per side.');
   const squad=new Set(fixture.teams[side].squad.map(p=>p.id)),out:Record<string,number>={};
   for(const [id,a] of Object.entries(m as Record<string,unknown>)){
    if(!squad.has(id))throw Error('injuries.age names a player outside that squad.');
    if(typeof a!=='number'||!Number.isFinite(a)||a<14||a>60)throw Error('injuries.age is a number of years from 14 to 60.');
    out[id]=a;
   }
   return out;
  }) as [Record<string,number>,Record<string,number>];
 }
 return {on:v.on,salt:v.salt as number,...(age?{age}:{})};
}

/** The injury state of one match: its own dice, who is hurt, who still has to go off. */
export class Injuries {
 readonly records:InjuryRecord[]=[];
 private readonly draw:()=>number;
 private readonly hurt=new Set<string>();
 private readonly ages:Map<string,number>;
 /** Hurt, still on the pitch, waiting for the next stoppage. */
 private waiting:InjuryRecord[]=[];
 /** Hurt, not yet announced as an event (practice.ts announces at the next tick or stoppage, whichever is first). */
 private fresh:InjuryRecord[]=[];
 constructor(input:InjuryInput,seed:number){
  this.draw=rng((seed^input.salt^INJURY_SALT)>>>0);
  this.ages=new Map((input.age??[{},{}]).flatMap((m,side)=>Object.entries(m).map(([id,a])=>[`${side}:${id}`,a] as [string,number])));
 }
 private ageFactor(id:string):number{const a=this.ages.get(id);return a===undefined?1:1+AGE_PER*Math.max(0,a-AGE_FROM);}
 private roll(_cause:InjuryCause,_side:Side,risk:number):boolean{return this.draw()<risk;}
 private injure(p:Body,cause:InjuryCause,time:number,hard:boolean,by?:string):InjuryRecord{
  const table=SEVERITY[hard?'hard':'ordinary'];let u=this.draw(),matches=table.length;
  for(let i=0;i<table.length;i++){u-=table[i];if(u<0){matches=i+1;break;}}
  const r:InjuryRecord={time,player:p.id,side:p.side,cause,...(by?{by}:{}),hard,energy:r1(p.energy),matches};
  this.hurt.add(p.id);this.records.push(r);this.waiting.push(r);this.fresh.push(r);return r;
 }
 /** A tackle incident on `p`: the hit that went into him (practice-balance Balance.hit, m/s; 0 for none), `down` > 0
  * when it put him on the floor, `foul` when the referee gave it; `by`: the man who made the challenge. */
 contact(p:Body,b:{hit:number;down:number},by:{id:string}|undefined,time:number,foul=false):void{
  if(this.hurt.has(p.id))return;
  const hard=b.down>0||foul;
  const risk=Math.min(RISK_CAP,(TACKLE_RISK+TACKLE_HIT*Math.max(0,b.hit)/HIT_REF+(hard?TACKLE_HARD:0))*(1+TIRED_TACKLE*(1-Math.max(0,Math.min(100,p.energy))/100))*this.ageFactor(p.id));
  if(this.roll('tackle',p.side,risk))this.injure(p,'tackle',time,hard,by?.id);
 }
 /** One second of live play for `p`. */
 fatigue(p:Body,time:number):void{
  if(this.hurt.has(p.id))return;
  const u=(FATIGUE_FROM-p.energy)/FATIGUE_SPAN;if(!(u>0))return;
  const risk=Math.min(RISK_CAP,FATIGUE_RISK*u*u*this.ageFactor(p.id));
  if(this.roll('fatigue',p.side,risk))this.injure(p,'fatigue',time,false);
 }
 /** Injuries not yet announced, in order (and forgotten here). */
 announce():InjuryRecord[]{const out=this.fresh;this.fresh=[];return out;}
 /** Injured men still to go off, in order (and forgotten here: the caller takes each off or marks playedOn). */
 due():InjuryRecord[]{const out=this.waiting;this.waiting=[];return out;}
 /** Injured men still to go off (a look: nothing is forgotten). */
 get waitingNow():readonly InjuryRecord[]{return this.waiting;}
}

/** Who comes on for an injured man: only a squad player who has not been on the pitch (`used` holds every practice id
 * that has played, `onPitch` the side's men now). A keeper: the bench keeper with the best keeping, else the outfield
 * bench player with the best keeping. An outfielder: an outfield bench player whose first role is the injured man's,
 * then one who lists it, then any; ties by energy, the larger outfield skill total, squad order. None outfield: the
 * bench keeper. Nobody: null (he plays on). */
export function injuryReplacement(team:Team,injured:{side:Side;role:Role},onPitch:readonly {id:string}[],used:ReadonlySet<string>):Player|null{
 const prefix=`${injured.side}:`,active=new Set(onPitch.map(p=>p.id)),order=new Map(team.squad.map((p,i)=>[p.id,i]));
 const bench=team.squad.filter(p=>!active.has(prefix+p.id)&&!used.has(prefix+p.id)),keeper=(p:Player)=>p.roles[0]==='GK';
 const total=(p:Player)=>{const s=p.skills;return s.passing+s.control+s.finishing+s.defending+s.pace+s.strength+s.stamina+s.reading+s.aerial+s.setPieces;};
 const byKeeping=(a:Player,b:Player)=>b.skills.keeping-a.skills.keeping||order.get(a.id)!-order.get(b.id)!;
 if(injured.role==='GK')return bench.filter(keeper).sort(byKeeping)[0]??bench.slice().sort(byKeeping)[0]??null;
 const tier=(p:Player)=>p.roles[0]===injured.role?2:p.roles.includes(injured.role)?1:0;
 return bench.filter(p=>!keeper(p)).sort((a,b)=>tier(b)-tier(a)||b.energy-a.energy||total(b)-total(a)||order.get(a.id)!-order.get(b.id)!)[0]??bench.filter(keeper).sort(byKeeping)[0]??null;
}
