// Stage 1 growth and age (deliverables/ballers-players/STAGE-1.md), the client side.
// The game's truth is in Postgres (migration 20261008120000_ballers_growth): ages on ballers_players,
// the pool / progress / focus behind the doors (ballers_growth_mine for your own players, never the
// pool), what grew after a round in the round ledger (ballers_growth_after), the rules the screens
// need in ballers_growth_rules. This module turns those reads into what the screens draw. It mirrors
// only what a screen must know before a read lands (the default rules, the same as the config) and
// the "can this skill still grow" rule; growth itself is never computed here.
// Pure except readGrowthSwitch (a localhost-only convenience).
import {isKeeper, openLeague, type Club, type Competition, type Player, type Result, type Round} from './league';
import {readPlayerStats} from './stats';
import {WORD_NAMES, type SkillKey} from './orders';

export type Phase='young'|'prime'|'veteran';
export const PHASE_WORDS:Record<Phase,string>={young:'Young',prime:'In his prime',veteran:'Veteran'};
/** The headroom words (STAGE-1.md "Potential"), falling as he grows. Fixed copy; the server picks one. */
export const HINT_WORDS=['Could go a long way','Plenty still to come','Some way still to go','Close to his best','At his peak','Past his peak'] as const;
export type Hint=typeof HINT_WORDS[number];
export const FADE_SKILLS:readonly SkillKey[]=['pace','stamina'];

// ------------------------------------------------------------------ the rules (ballers_growth_rules)
export interface OrderAgeRule {age:[number,number];budget:number}
export interface GrowthRules {
 phases:{youngTo:number;primeTo:number};
 /** The skills a veteran still grows. */ headSkills:SkillKey[];
 fade:{from:number;skills:SkillKey[];by:number;floor:number};
 orders:{ageMin:number;ageMax:number;gemExtra:number;young:OrderAgeRule;prime:OrderAgeRule;veteran:OrderAgeRule};
 /** Progress a step needs to tick (index = the value reached). */ stepProgress:number[];
 /** What the pool pays when that point lands. */ stepPool:number[];
}
/** The defaults, exactly private.ballers_growth_config() (verificare/ballers-growth.test.ts holds them equal). */
export const DEFAULT_RULES:GrowthRules={
 phases:{youngTo:22,primeTo:30},
 headSkills:['reading','passing','setPieces','keeping'],
 fade:{from:31,skills:['pace','stamina'],by:1,floor:1},
 orders:{ageMin:18,ageMax:34,gemExtra:13,young:{age:[18,22],budget:18},prime:{age:[23,30],budget:25},veteran:{age:[31,34],budget:31}},
 stepProgress:[0,1,1,1,1,1,1,2,3,5,8],
 stepPool:[0,1,1,1,1,1,1,2,2,4,6],
};
/** A rules read laid over the defaults (a missing or odd key keeps the default). */
export function withRules(read:unknown):GrowthRules{
 if(!read||typeof read!=='object')return DEFAULT_RULES;
 const r=read as Partial<GrowthRules>;
 return {...DEFAULT_RULES,...Object.fromEntries(Object.entries(r).filter(([,v])=>v!==null&&v!==undefined)),
  orders:{...DEFAULT_RULES.orders,...(r.orders??{})}} as GrowthRules;
}

export const phaseOf=(age:number,rules:GrowthRules=DEFAULT_RULES):Phase=>age<=rules.phases.youngTo?'young':age<=rules.phases.primeTo?'prime':'veteran';
/** A robot (Umanoizii's players, trait `robot`; config traitCurves.robot = {ages: false}): no birthdays, no
 * fade, growth as prime. The screens show him a build number where everyone else has an age. */
export const isRobot=(p:Pick<Player,'growth_traits'>)=>!!p.growth_traits?.includes('robot');
/** A robot's build: v1.<season> of the league (the open one, else the latest; Preseason = 0 → v1.0). */
export function buildOf(competitions:Competition[]|undefined):number{
 const l=openLeague(competitions)??(competitions??[]).reduce<Competition|undefined>((m,c)=>!m||c.season>m.season?c:m,undefined);
 return l?.season??0;
}
export const BUILD_WORD=(build:number)=>`v1.${build}`;
/** His age and phase, once he has an age (seeded, or ordered with one); a robot's `build` instead of an
 * age to show (his phase is prime; pass the competitions for the build's season). */
export function ageOf(p:Pick<Player,'age'|'growth_traits'>,rules:GrowthRules=DEFAULT_RULES,competitions?:Competition[]):{age:number;phase:Phase;build:number|null}|undefined{
 if(typeof p.age!=='number')return undefined;
 const robot=isRobot(p);
 return {age:p.age,phase:robot?'prime':phaseOf(p.age,rules),build:robot?buildOf(competitions):null};
}
/** Can this skill still grow (private.ballers_growth_can_grow): below 10, a keeper's finishing and an
 * outfield player's keeping never, a veteran only in the head skills. Whether his pool can still pay
 * is the server's to know. */
export function canGrow(p:Pick<Player,'roles'|'skills'>,k:SkillKey,phase:Phase,rules:GrowthRules=DEFAULT_RULES){
 const gk=isKeeper(p);
 return p.skills[k]<10&&!(k==='keeping'&&!gk)&&!(k==='finishing'&&gk)&&(phase!=='veteran'||rules.headSkills.includes(k));
}

// ------------------------------------------------------------------ one player's growth facts
/** One of your own players as ballers_growth_mine returns him. */
export interface GrowthRow {id:string;focus:SkillKey|null;focusSetAt:string|null;progress:Partial<Record<SkillKey,number>>;hint:Hint|null;
 /** Matches at this pace until the focus skill's next point (migration 20261008210000; absent before it). Null: nothing left to grow there. */ matches?:number|null}
export interface Growth {
 age:number;phase:Phase;
 /** The potential hint, your own players only (null for anyone else, or before the read lands). */ hint:Hint|null;
 /** Progress toward the next point, 0..1 per skill (0 where it cannot grow, and for anyone not yours). */ progress:Record<SkillKey,number>;
 /** The one skill he is working on, or none (his natural direction). Your own players only. */ focus:SkillKey|null;
 /** Skills that still grow at his age. */ grows:(k:SkillKey)=>boolean;
 /** A veteran: pace and stamina go down at each season rollover. Never a robot. */ fading:boolean;
 /** A robot's build to show where everyone else has an age; null for anyone who ages. */ build:number|null;
 /** Matches at this pace until the focus skill's next point; null when he has nothing left to grow there; undefined when not known (not yours, no focus, a read from before the door said). */ matches:number|null|undefined;
}
const ALL:SkillKey[]=['passing','control','finishing','setPieces','pace','stamina','strength','aerial','reading','defending','keeping'];
/** His growth facts: age and phase for everyone; progress, focus and hint from `row` (your own player). Null without an age. */
export function growthOf(p:Player,row:GrowthRow|undefined,mine:boolean,rules:GrowthRules=DEFAULT_RULES,competitions?:Competition[]):Growth|null{
 const a=ageOf(p,rules,competitions);if(!a)return null;
 const grows=(k:SkillKey)=>canGrow(p,k,a.phase,rules);
 const own=mine?row:undefined;
 const progress=Object.fromEntries(ALL.map(k=>{const v=Number(own?.progress?.[k]??0);return [k,grows(k)&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):0];})) as Record<SkillKey,number>;
 const focus=own?.focus&&grows(own.focus)?own.focus:null;
 const hint=own?.hint&&(HINT_WORDS as readonly string[]).includes(own.hint)?own.hint:null;
 const matches=own&&focus?(typeof own.matches==='number'?Math.max(1,Math.round(own.matches)):own.matches===null?null:undefined):undefined;
 return {age:a.age,phase:a.phase,hint,progress,focus,grows,fading:a.phase==='veteran',build:a.build,matches};
}
/** Four lit steps for "how far to the next point", never a bar: ember, warm, glowing, nearly lit. */
export const chargeOf=(f:number):0|1|2|3|4=>f<=0?0:f<.25?1:f<.5?2:f<.75?3:4;
export const CHARGE_WORDS=['','just started','some way along','most of the way','nearly there'] as const;
export const skillName=(k:SkillKey)=>WORD_NAMES[k];

// ------------------------------------------------------------------ what grew after the last round (STAGE-1.md §6)
export type GrowthLine=
 |{kind:'up';player:Player;skill:SkillKey;from:number;to:number;mentor:Player|null}
 |{kind:'fade';player:Player;skill:SkillKey;from:number;to:number};
/** What ballers_growth_after returns for a club. */
export interface GrowthAfter {round:number|null;roundId:string;appliedAt:string;played:number;grew:number;
 /** Players who moved closer without ticking (migration 20261008180000; absent before it). */ moved?:number;
 lines:{player:string;kind:'up'|'fade';skill:SkillKey;from:number;to:number;mentor?:string|null}[]}
export interface RoundGrowth {round:number|null;key:string;lines:GrowthLine[];closer:number;played:number;
 /** Distinct players with a line that went up. */ grew:number}
/** The ledger's lines as the board draws them: players found in the league (anyone gone is left out).
 * "Others moved closer": the door's `moved` (who gained progress without ticking), else the men who
 * played with no line that went up. */
export function roundGrowthOf(a:GrowthAfter|null,players:Player[]):RoundGrowth|null{
 if(!a||!a.roundId)return null;
 const byId=new Map(players.map(p=>[p.id,p]));
 const lines:GrowthLine[]=[];
 for(const l of a.lines??[]){
  const player=byId.get(l.player);if(!player||!(l.skill in WORD_NAMES))continue;
  if(l.kind==='up')lines.push({kind:'up',player,skill:l.skill,from:l.from,to:l.to,mentor:l.mentor?byId.get(l.mentor)??null:null});
  else lines.push({kind:'fade',player,skill:l.skill,from:l.from,to:l.to});
 }
 const grew=new Set(lines.filter(l=>l.kind==='up').map(l=>l.player.id)).size;
 return {round:a.round,key:`${a.roundId}:${a.appliedAt}`,lines,grew,played:a.played??0,
  closer:typeof a.moved==='number'?a.moved:Math.max(0,(a.played??0)-grew)};
}

// ------------------------------------------------------------------ memory (real facts from stored lines; STAGE-1.md §5)
export interface MemoryLine {key:string;text:string;matchId:string|null;round:number|null}
/** First goal, best night, the streak he is on, the club he keeps scoring against; a keeper's clean sheets. Nothing invented. */
export function memoryOf(p:Player,results:Result[],clubs:Club[],rounds:Round[]):MemoryLine[]{
 const gk=isKeeper(p);
 const played=results.filter(r=>(r.home_club===p.club_id||r.away_club===p.club_id)).map(r=>({r,l:readPlayerStats(r.player_stats)?.find(l=>l.id===p.id)??null})).filter(x=>!!x.l).sort((a,b)=>Date.parse(a.r.live_from)-Date.parse(b.r.live_from));
 if(!played.length)return [];
 const roundOf=(r:Result)=>rounds.find(x=>x.id===r.round_id)?.number??null;
 const oppOf=(r:Result)=>clubs.find(c=>c.id===(r.home_club===p.club_id?r.away_club:r.home_club))?.name??'them';
 const out:MemoryLine[]=[];
 const first=played.find(x=>x.l!.g>0);
 if(first)out.push({key:'first',text:`First goal: vs ${oppOf(first.r)}, round ${roundOf(first.r)??'?'}.`,matchId:first.r.match_id,round:roundOf(first.r)});
 else{const assist=played.find(x=>x.l!.a>0);if(assist&&!gk)out.push({key:'first',text:`First assist: vs ${oppOf(assist.r)}, round ${roundOf(assist.r)??'?'}. No goal yet.`,matchId:assist.r.match_id,round:roundOf(assist.r)});}
 if(gk){
  const best=[...played].filter(x=>(x.l!.sv??0)>0).sort((a,b)=>(b.l!.sv-a.l!.sv)||((b.l!.cs??0)-(a.l!.cs??0)))[0];
  if(best&&best.l!.sv>=3)out.push({key:'best',text:`Best night: ${best.l!.sv} saves${best.l!.cs?' and a clean sheet':''} vs ${oppOf(best.r)}, round ${roundOf(best.r)??'?'}.`,matchId:best.r.match_id,round:roundOf(best.r)});
  let run=0;for(let i=played.length-1;i>=0&&played[i].l!.cs;i--)run++;
  if(run>=2)out.push({key:'streak',text:`${run} clean sheets in a row.`,matchId:null,round:null});
 }else{
  const best=[...played].sort((a,b)=>(b.l!.g-a.l!.g)||(b.l!.a-a.l!.a))[0];
  if(best&&best.l!.g>=2)out.push({key:'best',text:`Best night: ${best.l!.g} goals${best.l!.a?` and ${best.l!.a===1?'an assist':`${best.l!.a} assists`}`:''} vs ${oppOf(best.r)}, round ${roundOf(best.r)??'?'}.`,matchId:best.r.match_id,round:roundOf(best.r)});
  let run=0;for(let i=played.length-1;i>=0&&played[i].l!.g>0;i--)run++;
  if(run>=2)out.push({key:'streak',text:`Scored in ${run} straight matches.`,matchId:null,round:null});
  const vs=new Map<string,{goals:number;met:number}>();
  for(const x of played){const o=oppOf(x.r),v=vs.get(o)??{goals:0,met:0};v.goals+=x.l!.g;v.met++;vs.set(o,v);}
  const fav=[...vs.entries()].sort((a,b)=>b[1].goals-a[1].goals)[0];
  if(fav&&fav[1].goals>=2&&fav[1].met>=2)out.push({key:'vs',text:`Keeps scoring against ${fav[0]}: ${fav[1].goals} in ${fav[1].met} meetings.`,matchId:null,round:null});
 }
 return out;
}

// ------------------------------------------------------------------ orders choose an age (STAGE-1.md)
export interface OrderAge {phase:Phase;label:string;from:number;to:number;start:number;budget:number;line:string}
const ORDER_LINES:Record<Phase,string>={young:'Arrives thin. The best long bet.',prime:'Ready now, with some way still to go.',veteran:'Results now. Fades from next season.'};
/** The three bays (the budget follows the age; the gem adds rules.orders.gemExtra whichever age). */
export function orderAges(rules:GrowthRules=DEFAULT_RULES):OrderAge[]{
 return (['young','prime','veteran'] as const).map(phase=>{const o=rules.orders[phase],[from,to]=o.age;
  return {phase,label:PHASE_WORDS[phase],from,to,start:phase==='young'?Math.min(to,from+2):phase==='prime'?Math.min(to,from+3):Math.min(to,from+1),budget:o.budget,line:ORDER_LINES[phase]};});
}
export const ORDER_AGES:readonly OrderAge[]=orderAges();
export const orderAge=(age:number,rules:GrowthRules=DEFAULT_RULES)=>{const all=orderAges(rules);return all.find(a=>age>=a.from&&age<=a.to)??all[1];};

// ------------------------------------------------------------------ the switch
/** The real switch is the `growth` row in ballers_features (data.ts growthOn). On localhost only,
 * `?growth=1` turns the screens on for this tab (`?growth=0` off), to look at them before a space
 * is switched on; the doors still answer as the server says. Call once on mount. */
export function readGrowthSwitch():boolean{
 try{if(!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname))return false;
  const q=new URLSearchParams(window.location.search).get('growth');
  if(q==='1')sessionStorage.setItem('ballers:growth','1');else if(q==='0')sessionStorage.removeItem('ballers:growth');
  return sessionStorage.getItem('ballers:growth')==='1';}catch{return false;}
}
