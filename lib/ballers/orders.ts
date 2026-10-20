// Ballers stage 0: orders (deliverables/ballers-players/STAGE-0.md) and the
// skill words every card shows (TRAITS.md §4.1–4.2). Pure: no reads, no React.
// The order doors and the builder live in SQL (migration 20261007090000_ballers_orders);
// ORDER_ROLES mirrors private.ballers_order_data() -> roles, which re-checks everything.
import type {Role} from '../../packages/football-engine/src/model';
import {isKeeper, type Player, type Temperament} from './league';
import {ARRIVAL_PREFIX, type NewsItem} from './news';
import {clubDay} from '../club-time';

export type SkillKey=keyof Player['skills'];
export type Tier='very'|'high'|'low';

// ------------------------------------------------------------------ skill words (TRAITS.md §4.1)
/** Very high / high / very low word and its one line, per skill. */
export const SKILL_WORDS:Record<SkillKey,Record<Tier,{word:string;line:string}>>={
 pace:{very:{word:'Speedster',line:'Wins nearly every foot race; he can’t be caught on the break and gets back before anyone.'},
  high:{word:'Quick',line:'Wins most foot races and recovers quickly.'},
  low:{word:'Heavy-Legged',line:'Loses foot races and arrives late to through balls and loose balls.'}},
 control:{very:{word:'Velvet Feet',line:'Kills the hardest pass dead, turns quickly, and beats men in tight spaces more often than not.'},
  high:{word:'Tidy Touch',line:'Controls the ball cleanly and keeps it when closed down.'},
  low:{word:'Heavy Touch',line:'Hard passes bounce off him; he loses the ball when closed down or when he tries to beat a man.'}},
 reading:{very:{word:'Sees Everything',line:'Rarely misjudges a pass or a run, reacts first, and is very hard to fool with a feint.'},
  high:{word:'Reads the Game',line:'Misjudges fewer passes and picks up runners early.'},
  low:{word:'Ball-Watcher',line:'Misjudges passes, loses runners, and falls for feints.'}},
 passing:{very:{word:'Pinpoint Passer',line:'Long and lofted passes land where he meant, so he tries them more.'},
  high:{word:'Clean Passer',line:'Passes arrive accurately, longer ones included.'},
  low:{word:'Wayward Passer',line:'Passes go astray at distance, so he plays it short and safe.'}},
 finishing:{very:{word:'Deadly',line:'Puts his shots where the keeper isn’t, and hits them hard.'},
  high:{word:'Finisher',line:'Gets his shots on target more often than most.'},
  low:{word:'Wasteful',line:'Shots fly wide or straight at the keeper.'}},
 defending:{very:{word:'Stopper',line:'Wins most of his tackles cleanly and rarely gives away a careless foul.'},
  high:{word:'Tackler',line:'Wins more tackles than he loses.'},
  low:{word:'Matador',line:'Attackers go past him; his tackles miss or end in fouls.'}},
 keeping:{very:{word:'Cat',line:'Gets to shots others don’t and holds most of them.'},
  high:{word:'Safe Hands',line:'Holds what he reaches.'},
  low:{word:'Soap Hands',line:'Spills shots he should hold, and reaches fewer.'}},
 strength:{very:{word:'Wardrobe',line:'Wins more shoulder-to-shoulder duels; the longest clearances and throws on the pitch.'},
  high:{word:'Strong',line:'Wins a few more duels; longer clearances and throws.'},
  low:{word:'Slight',line:'Loses body contests; his clearances and throws fall short.'}},
 stamina:{very:{word:'Tireless',line:'Barely slows down by the end of a match.'},
  high:{word:'Good Lungs',line:'Fades less than most by the end.'},
  low:{word:'Short of Breath',line:'Noticeably slower in the last minutes.'}},
 aerial:{very:{word:'Tower',line:'Heads it hard and accurately when he gets there first.'},
  high:{word:'Good in the Air',line:'Better headers when he reaches the ball.'},
  low:{word:'Hates Headers',line:'His headers go anywhere.'}},
 setPieces:{very:{word:'Free-Kick Specialist',line:'Usually takes his side’s free kicks and penalties (unless the plan names a taker), and his free kicks are struck well. Corners still go to whoever is nearest.'},
  high:{word:'Dead-Ball Taker',line:'Often takes the free kicks, and strikes them decently.'},
  low:{word:'Shanks It',line:'Never picked to take one, for good reason.'}},
};
/** What a keeper's reading adds to the line (§4.1). */
const KEEPER_READING:Partial<Record<Tier,string>>={very:' A keeper reacts early to shots.',low:' A keeper reacts late.'};

/** The card's skill order per role (TRAITS.md §4.2). FB has no row there: it reads as a defender. */
export const ROLE_ORDER:Record<Role,SkillKey[]>={
 GK:['keeping','reading','passing','pace','control','strength'],
 CB:['defending','reading','pace','strength','passing','aerial','control','stamina','setPieces','finishing'],
 FB:['defending','reading','pace','strength','passing','aerial','control','stamina','setPieces','finishing'],
 DM:['defending','reading','pace','strength','passing','aerial','control','stamina','setPieces','finishing'],
 CM:['passing','control','reading','pace','stamina','finishing','defending','setPieces','strength','aerial'],
 AM:['passing','control','reading','pace','stamina','finishing','defending','setPieces','strength','aerial'],
 W:['pace','control','finishing','passing','stamina','reading','setPieces','defending','strength','aerial'],
 ST:['finishing','pace','control','strength','aerial','reading','passing','setPieces','stamina','defending'],
};

/** The tier a value earns: 9–10 very high, 7–8 high, 1–3 very low; keeping uses the keeper scale (9–10 / 8 / 6 or less). */
export function tierOf(key:SkillKey,v:number):Tier|null{
 if(key==='keeping')return v>=9?'very':v>=8?'high':v<=6?'low':null;
 return v>=9?'very':v>=7?'high':v<=3?'low':null;
}
export interface SkillWord {key:SkillKey;tier:Tier;word:string;line:string}
/** Every word a player carries, in his role's order. A keeper shows only keeper-relevant words. */
export function skillWords(p:Pick<Player,'roles'|'skills'>):SkillWord[]{
 const gk=isKeeper(p),order=ROLE_ORDER[p.roles[0]]??ROLE_ORDER.CM;
 const keys=gk?order:order.filter(k=>k!=='keeping');
 return keys.flatMap(key=>{const tier=tierOf(key,p.skills[key]);if(!tier)return [];const w=SKILL_WORDS[key][tier];
  return [{key,tier,word:w.word,line:gk&&key==='reading'?w.line+(KEEPER_READING[tier]??''):w.line}];});
}
/** The front of the card: up to three words — every very high word, then very low words from the first half of his role's order, then high words (§4.2). */
export function frontWords(p:Pick<Player,'roles'|'skills'>):SkillWord[]{
 const all=skillWords(p),order=ROLE_ORDER[p.roles[0]]??ROLE_ORDER.CM,half=new Set(order.slice(0,Math.ceil(order.length/2)));
 return [...all.filter(w=>w.tier==='very'),...all.filter(w=>w.tier==='low'&&half.has(w.key)),...all.filter(w=>w.tier==='high')].slice(0,3);
}

// ------------------------------------------------------------------ describing an order
/** Mirrors private.ballers_order_data() -> roles: the words a manager may choose per role. */
export const ORDER_ROLES:{value:Role;label:string;words:SkillKey[]}[]=[
 {value:'GK',label:'Goalkeeper',words:['keeping','reading','passing','pace','control','strength']},
 {value:'CB',label:'Centre-back',words:['defending','reading','pace','strength','passing','aerial','control']},
 {value:'FB',label:'Full-back',words:['defending','reading','pace','strength','passing','aerial','control']},
 {value:'DM',label:'Defensive mid',words:['defending','reading','pace','strength','passing','aerial','control']},
 {value:'CM',label:'Midfielder',words:['passing','control','reading','pace','stamina','finishing','defending']},
 {value:'AM',label:'Attacking mid',words:['passing','control','reading','pace','stamina','finishing','defending']},
 {value:'W',label:'Winger',words:['pace','control','finishing','passing','stamina','reading','setPieces']},
 {value:'ST',label:'Striker',words:['finishing','pace','control','strength','aerial','reading','passing']},
];
export const orderRole=(r:Role)=>ORDER_ROLES.find(x=>x.value===r)!;
/** A skill's own name, plain (as the card's skill rows say it). */
export const WORD_NAMES:Record<SkillKey,string>={pace:'Pace',control:'Control',reading:'Reading',passing:'Passing',finishing:'Finishing',defending:'Defending',keeping:'Keeping',strength:'Strength',stamina:'Stamina',aerial:'In the air',setPieces:'Set pieces'};

/** One factual line per personality: what each one leans in his habits today. */
export const PERSONALITIES:{value:Temperament;line:string}[]=[
 {value:'cold',line:'Keeps his discipline in the tackle.'},
 {value:'fuse',line:'Gets rash in the tackle when you’re losing.'},
 {value:'diva',line:'Takes more risks on the ball and tries more dribbles.'},
 {value:'ambitious',line:'Makes more runs forward and takes a little more on.'},
 {value:'heart',line:'Comes short for the ball and works harder off it.'},
];

// ------------------------------------------------------------------ the point buy (STAGE-0.md "Revision, 7 Oct")
// Mirrors private.ballers_order_check_skills (migration 20261007150000), which re-checks everything.
export const SKILL_KEYS:SkillKey[]=['passing','control','finishing','defending','pace','strength','stamina','reading','aerial','setPieces','keeping'];
/** Cumulative price of a skill from the free baseline of 4: 5–6 cost 1 each, 7–8 cost 2, the 9th 4, the 10th 6. */
export const PRICE=[0,0,0,0,0,1,2,4,6,10,16] as const;
export const POINTS={baseline:4,floor:2,refundMax:4,cap:9,gemCap:10,keeperKeeping:7,keeperFinishing:3,budget:25,gemBudget:38} as const;
export type Skills=Record<SkillKey,number>;
const isGK=(role:Role)=>role==='GK';
/** Skills that cost points: outfield keeping is fixed at 1; a keeper's finishing is a rule (at most 3), not a buy. */
export const priced=(role:Role,key:SkillKey)=>isGK(role)?key!=='finishing':key!=='keeping';
/** Where an order starts: every skill at 4; outfield keeping 1; a keeper's keeping 7 and finishing 3. */
export function startSkills(role:Role):Skills{
 const s=Object.fromEntries(SKILL_KEYS.map(k=>[k,POINTS.baseline])) as Skills;
 if(isGK(role)){s.keeping=POINTS.keeperKeeping;s.finishing=POINTS.keeperFinishing;}else s.keeping=1;
 return s;
}
/** The same skills for another role: only the keeper rules move (keeping, finishing). */
export function forRole(skills:Skills,from:Role|null,to:Role):Skills{
 if(from!==null&&isGK(from)===isGK(to))return skills;
 const s={...skills};
 if(isGK(to)){s.keeping=from&&isGK(from)?s.keeping:POINTS.keeperKeeping;s.finishing=Math.min(s.finishing,POINTS.keeperFinishing);}
 else{s.keeping=1;if(from&&isGK(from))s.finishing=POINTS.baseline;}
 return s;
}
export interface Ledger {budget:number;cost:number;refunded:number;spent:number;left:number;tens:number}
/** `budget`: stage 1's age-chosen budget (lib/ballers/growth.ts orderAge, the server's ballers_order_age); absent, today's 25 / 38. */
export function ledger(role:Role,skills:Skills,gem:boolean,budget?:number):Ledger{
 let cost=0,refunded=0,tens=0;
 for(const k of SKILL_KEYS){if(!priced(role,k))continue;const v=skills[k];cost+=PRICE[Math.max(0,Math.min(10,v))];refunded+=Math.max(0,POINTS.baseline-v);if(v>POINTS.cap)tens++;}
 const b=budget??(gem?POINTS.gemBudget:POINTS.budget),spent=cost-refunded;
 return {budget:b,cost,refunded,spent,left:b-spent,tens};
}
/** How far one skill may move right now (the cap drawn on the pips; the floor; the refund limit). */
export function bounds(role:Role,key:SkillKey,skills:Skills,gem:boolean):{min:number;max:number}{
 if(!priced(role,key))return isGK(role)?{min:1,max:POINTS.keeperFinishing}:{min:1,max:1};
 const l=ledger(role,skills,gem),v=skills[key];
 const floor=isGK(role)&&key==='keeping'?POINTS.keeperKeeping:POINTS.floor;
 const refundRoom=POINTS.refundMax-l.refunded;
 const min=v<=POINTS.baseline?Math.max(floor,v-refundRoom):floor;
 const ten=gem&&(l.tens===0||v>POINTS.cap);
 return {min:Math.min(min,v),max:Math.max(v,ten?POINTS.gemCap:POINTS.cap)};
}
/** What the next step up costs, and what a step down gives back (points; a step below 4 gives back 1). */
export const stepUp=(v:number)=>v>=10?null:PRICE[v+1]-PRICE[v];
export const stepDown=(v:number)=>v<=POINTS.baseline?1:PRICE[v]-PRICE[v-1];
/** Can this skill go up one now (within the cap and the points left)? */
export function canRaise(role:Role,key:SkillKey,skills:Skills,gem:boolean,budget?:number){
 const b=bounds(role,key,skills,gem),v=skills[key];if(!priced(role,key)||v>=b.max)return false;
 const l=ledger(role,skills,gem,budget),cost=v<POINTS.baseline?-1:stepUp(v)!;return cost<=l.left;
}
export const canLower=(role:Role,key:SkillKey,skills:Skills,gem:boolean)=>{if(!priced(role,key))return false;return skills[key]>bounds(role,key,skills,gem).min;};
/** Why this order can't be built as it stands (the server says the same), else null. */
export function skillsProblem(role:Role,skills:Skills,gem:boolean,budget?:number):string|null{
 const l=ledger(role,skills,gem,budget);
 if(l.left<0)return `Over the budget by ${-l.left} ${-l.left===1?'point':'points'}.`;
 if(l.tens>(gem?1:0))return gem?'Only one skill can be a 10.':'Only the gem can have a 10.';
 if(l.refunded>POINTS.refundMax)return `At most ${POINTS.refundMax} points back from lowering skills.`;
 return null;
}
/** The word a skill earns at its value right now (what comes out, never picked); keeping only for keepers. */
export function liveWord(role:Role,key:SkillKey,v:number):{tier:Tier;word:string}|null{
 if(key==='keeping'&&!isGK(role))return null;
 const t=tierOf(key,v);return t?{tier:t,word:SKILL_WORDS[key][t].word}:null;
}

// ------------------------------------------------------------------ the gap line
const GAP_SKILLS:SkillKey[]=['defending','pace','reading','passing','control','finishing','strength','stamina','aerial'];
const GAP_NAMES:Partial<Record<SkillKey,string>>={aerial:'heading',reading:'reading the game'};
/** "Your starters are weakest at defending and pace.": the two lowest averages over the outfield starters. */
export function gapLine(starters:Pick<Player,'roles'|'skills'>[]):string|null{
 const field=starters.filter(p=>!isKeeper(p));if(!field.length)return null;
 const avg=(k:SkillKey)=>field.reduce((n,p)=>n+p.skills[k],0)/field.length;
 const [a,b]=[...GAP_SKILLS].sort((x,y)=>avg(x)-avg(y)||GAP_SKILLS.indexOf(x)-GAP_SKILLS.indexOf(y));
 const name=(k:SkillKey)=>GAP_NAMES[k]??WORD_NAMES[k].toLowerCase();
 return `Your starters are weakest at ${name(a)} and ${name(b)}.`;
}

// ------------------------------------------------------------------ orders on a squad
export const ORDER_SLOTS=[0,1,2,3] as const;
/** The squad's newcomers by slot. */
export function placedOrders(squad:Player[]):Map<number,Player>{
 return new Map(squad.filter(p=>p.order_slot!==null&&p.order_slot!==undefined).map(p=>[p.order_slot as number,p]));
}
export interface OrderState {placed:Map<number,Player>;left:number[];gemUsed:boolean;keeper:boolean;
 /** The last unplaced slot, when no keeper has come: it can only be a keeper. */ keeperOnly:number|null}
export function orderState(squad:Player[]):OrderState{
 const placed=placedOrders(squad),left=ORDER_SLOTS.filter(s=>!placed.has(s));
 const keeper=[...placed.values()].some(isKeeper),gemUsed=[...placed.values()].some(p=>p.gem);
 return {placed,left,gemUsed,keeper,keeperOnly:left.length===1&&!keeper?left[0]:null};
}

// ------------------------------------------------------------------ copy (approved by Vlad, 7 Oct)
/** The narration on the orders screen: an English lead-in, Bebe in Romanian. The one place it lives. */
export const NARRATION_DRAFT='A man gets out of a dusty Logan, waves at you, and shouts: „Șefule, eu îs Bebe Orfanu\', Todiraș pentru cunoscuți. Am auzit c-ai echipă da\' n-ai material. Zi-mi ce-ți trebe și-ți aduc ce-i mai talent pe lumea asta. Te revanșezi tu mai încolo.”';
/** Bebe's line on the plate and Home while orders remain. */
export const bebeLine=(left:number)=>`Bebe Todiraș Orfanu' is outside. ${left} to order`;
/** The arrival news line. */
export const arrivalTitle=(name:string,club:string)=>`${name} arrived at ${club}`;
export const ARRIVAL_BODY='Bebe brought him.';
/** Your club's arrivals as news lines ("{name} arrived at {club}. Bebe brought him."), newest first,
 * dated on the club's Bucharest day. */
export function arrivalNews(squad:Player[],club:{name:string}):NewsItem[]{
 const at=(p:Player)=>p.created_at??'';
 return squad.filter(p=>p.order_slot!==null&&p.order_slot!==undefined&&at(p)).sort((a,b)=>at(b).localeCompare(at(a)))
  .map(p=>({id:`${ARRIVAL_PREFIX}${p.id}`,date:clubDay(new Date(at(p))),title:arrivalTitle(p.name,club.name),body:ARRIVAL_BODY,link:{href:`/jocuri/ballers/player/${p.id}`,label:p.short}}));
}
/** The release notes with a club's arrivals merged in by date: newest day first, arrivals first on the
 * same day, each list's own order kept. Slice AFTER this, so older lines are never pushed out by order. */
export function withArrivals(items:readonly NewsItem[],arrivals:NewsItem[]):readonly NewsItem[]{
 if(!arrivals.length)return items;
 const out:NewsItem[]=[];let i=0,j=0;
 while(i<items.length||j<arrivals.length){
  if(j<arrivals.length&&(i>=items.length||arrivals[j].date>=items[i].date))out.push(arrivals[j++]);else out.push(items[i++]);
 }
 return out;
}
