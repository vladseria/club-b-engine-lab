// Copied unchanged (below this line) from branch squad-fit-study, packages/football-engine/evidence/2026-10-19-squad-fit/squads.ts (19 Oct).
// Squad fit (2026-10-19): the squads and the plans of the squad-fit experiment. Evidence only, no engine or game change.
//
// THE BUDGET. Every squad is nine players (five starters + four on the bench, as every Ballers squad), the same
// average keeper, and four outfield starters built from the real league's role means (108 players of the 12 global
// clubs, 2026-10-15 snapshot: ../2026-10-15-chances-cloud/inputs/ballers_players.json; groups by first role:
// DEF = CB/FB/DM, MID = CM/AM/W, ST = ST). The "average" squad plays every man at his group's mean profile (one
// decimal). An archetype moves skill points between skills of the SAME player: every player's deltas sum to zero,
// so each player, and so the squad, keeps exactly the average total. Two guards keep it real (validate()):
//  - every skill stays inside the range the real league's outfielders have (all 96: pace 3-10, aerial 4-9, ...);
//  - no skill moves more than 3 points from its group mean (at most about 2 standard deviations).
// Traits stay at the group means; the one exception is the dribbler story's dribble trait (named in its story).
// Bench players never come on (no substitution orders, as every round robin); they are there for the squad shape.
// Starters: GK, DEF in the centre-back slot, two MIDs on the wings, ST up front (1-2-1, every plan here).
import {PRESETS} from '../../../../lib/ballers/league';

export type Skills={pace:number;aerial:number;control:number;passing:number;reading:number;stamina:number;strength:number;defending:number;finishing:number;setPieces:number;keeping:number};
type Group='GK'|'DEF'|'MID'|'ST';
const r1=(v:number)=>Math.round(v*10)/10;

/** Group means of the real league (2026-10-15 snapshot, one decimal). */
export const MEAN:Record<Group,Skills>={
 GK: {pace:5.3,aerial:6.0,control:6.0,passing:5.3,reading:8.5,stamina:6.8,strength:6.1,defending:3.9,finishing:2.5,setPieces:4.0,keeping:8.3},
 DEF:{pace:5.0,aerial:6.4,control:5.0,passing:6.2,reading:6.8,stamina:6.8,strength:6.8,defending:6.8,finishing:4.0,setPieces:4.7,keeping:1},
 MID:{pace:6.1,aerial:5.1,control:7.1,passing:6.9,reading:6.1,stamina:7.2,strength:4.6,defending:4.2,finishing:4.7,setPieces:6.3,keeping:1},
 ST: {pace:5.4,aerial:6.3,control:5.6,passing:5.1,reading:6.1,stamina:6.3,strength:6.7,defending:2.8,finishing:8.2,setPieces:6.4,keeping:1},
};
export const TRAITS:Record<Group,Record<string,number>>={
 GK: {risk:.28,runs:.34,dribble:.07,comesShort:.34,discipline:.76,engagement:.54,keeperSweep:.31},
 DEF:{risk:.40,runs:.44,dribble:.32,comesShort:.41,discipline:.80,engagement:.56,audacity:.50},
 MID:{risk:.68,runs:.49,dribble:.46,comesShort:.55,discipline:.79,engagement:.56,audacity:.65},
 ST: {risk:.58,runs:.63,dribble:.38,comesShort:.36,discipline:.76,engagement:.54,audacity:.74},
};
/** The real league's outfield range per skill (all 96 outfielders). */
export const RANGE:Record<keyof Skills,[number,number]>={pace:[3,10],aerial:[4,9],control:[2,10],passing:[2,10],reading:[2,10],stamina:[3,10],strength:[3,10],defending:[1,10],finishing:[1,10],setPieces:[2,10],keeping:[1,1]};

type Delta=Partial<Record<keyof Skills,number>>;
/** An archetype: per-group skill deltas for the four outfield starters (each must sum to 0) and trait overrides. */
interface Archetype {name:string;story:string;def:Delta;mid:Delta;st:Delta;traits?:Partial<Record<'DEF'|'MID'|'ST',Record<string,number>>>}

export const ARCHETYPES:Record<string,Archetype>={
 avg:{name:'Average',story:'Every man at his group mean.',def:{},mid:{},st:{}},
 // H1 (owner): "fast with high stamina: does Counter beat Direct?"
 h1:{name:'Fast and tireless',story:'Quick, fit players who are light: pace and stamina bought with strength, aerial and touch.',
  def:{pace:2.5,stamina:2,strength:-2,aerial:-1.5,control:-1},
  mid:{pace:2.5,stamina:2,strength:-1.5,aerial:-1,control:-1,setPieces:-1},
  st: {pace:2.5,stamina:2,strength:-2,aerial:-1.5,control:-1}},
 // H2 (owner): "a fast attacker + defenders who pass well: can Direct work with a low line?"
 h2:{name:'Fast striker, passing back line',story:'A quick striker; a centre-back and wingers who can hit him from deep.',
  def:{passing:3,finishing:-1,setPieces:-1,aerial:-1},
  mid:{passing:2,finishing:-1,setPieces:-1},
  st: {pace:3,aerial:-1,strength:-1,setPieces:-1}},
 // H3: strong passers everywhere + Short combinations
 h3:{name:'Passers everywhere',story:'Good passers with a good touch, paid for with pace, strength and aerial.',
  def:{passing:2.5,control:2,pace:-2,strength:-1.5,aerial:-1},
  mid:{passing:2.5,control:2,pace:-2,strength:-1.5,aerial:-1},
  st: {passing:2,control:2,pace:-2,strength:-1,aerial:-1}},
 // H4: big aerial and strength side + Direct with a target man and deliveries
 h4:{name:'Big and strong',story:'Tall, strong players: aerial and strength bought with pace, touch and passing.',
  def:{aerial:2.5,strength:2.5,pace:-2,control:-1.5,passing:-1.5},
  mid:{aerial:2.5,strength:2.5,pace:-2,control:-1.5,passing:-1.5},
  st: {aerial:1.7,strength:2.3,pace:-2,control:-1,passing:-1}},
 // H5: tireless pressers + aggressive press and counter-press
 h5:{name:'Tireless pressers',story:'Fit ball-winners who read the game, paid for with finishing, touch and set pieces.',
  def:{stamina:2.5,defending:1.5,reading:1,finishing:-2,control:-1.5,setPieces:-1.5},
  mid:{stamina:2.5,defending:1.5,reading:1,finishing:-2,control:-1.5,setPieces:-1.5},
  st: {stamina:1.5,defending:1.5,reading:1,finishing:-2,control:-1,setPieces:-1}},
 // H6: a deep, strong-defending side + Counter (a quick striker as the outlet)
 h6:{name:'Deep defenders, quick outlet',story:'Strong defenders and defending wingers; a quick striker to break; paid for with touch, passing and finishing.',
  def:{defending:2.5,strength:1,reading:1,control:-1.5,passing:-1.5,finishing:-1.5},
  mid:{defending:2.5,strength:1,reading:1,control:-1.5,passing:-1.5,finishing:-1.5},
  st: {pace:2.5,control:-1,passing:-1,setPieces:-0.5}},
 // H7: a dribbler-heavy side
 h7:{name:'Dribblers',story:'Wingers and a striker who take men on: touch and pace bought with passing, aerial, strength; dribble trait 0.8.',
  def:{control:2,pace:1,aerial:-1,strength:-1,setPieces:-1},
  mid:{control:2.5,pace:1.5,passing:-1.5,aerial:-1,strength:-1,setPieces:-0.5},
  st: {control:2.5,pace:1.5,passing:-1.5,aerial:-1,strength:-1,setPieces:-0.5},
  traits:{MID:{dribble:.8},ST:{dribble:.8}}},
 // H8: a slow but technical side
 h8:{name:'Slow but technical',story:'Touch, passing and reading everywhere, bought with pace, strength and aerial.',
  def:{control:2,passing:2,reading:2,pace:-2,strength:-2,aerial:-2},
  mid:{control:2,passing:2,reading:2,pace:-3,strength:-1.5,aerial:-1,setPieces:-0.5},
  st: {control:2,passing:1.9,reading:1.9,pace:-2.4,strength:-2,aerial:-1.4}},
};

type Approach=typeof PRESETS.balanced;
interface Plan {name:string;style:keyof typeof PRESETS;set?:Partial<Record<keyof Approach,string|number>>;keeper?:'line'|'sweeper';setPiece?:'short'|'delivery';formation?:'1-2-1'|'2-2'}
/** The plans: a board style plus the fine-tune choices a sensible manager makes for the squad (board options only). */
export const PLANS:Record<string,Plan>={
 dir:{name:'Direct 1-2-1',style:'direct'},
 bal:{name:'Balanced 1-2-1',style:'balanced'},
 sho:{name:'Short combinations 1-2-1',style:'combinations'},
 p1:{name:'Counter, striker In behind',style:'counter',set:{striker:'run'}},
 p2:{name:'Direct, line Deep',style:'direct',set:{line:'deep'}},
 p3:{name:'Short combinations',style:'combinations'},
 p4:{name:'Direct, striker Pivot, free kicks Into the box',style:'direct',set:{striker:'pivot'},setPiece:'delivery'},
 p5:{name:'Balanced, press Aggressive, Counter-press, line High, Sweeper keeper',style:'balanced',set:{press:'aggressive',onLoss:'counterpress',line:'high'},keeper:'sweeper'},
 p6:{name:'Counter, striker In behind, keeper Stay on line',style:'counter',set:{striker:'run'},keeper:'line'},
 p7:{name:'Balanced, width Wide, Bodies forward 4',style:'balanced',set:{width:'wide',commit:4}},
 p8:{name:'Balanced, progression Patient, line Deep, press Selective, striker Drops deep',style:'balanced',set:{progression:'patient',line:'deep',press:'selective',striker:'link'}},
};
/** Each hypothesis: its archetype and the plan a sensible manager would pick for it. */
export const HYP:Record<string,{squad:string;plan:string}>={h1:{squad:'h1',plan:'p1'},h2:{squad:'h2',plan:'p2'},h3:{squad:'h3',plan:'p3'},h4:{squad:'h4',plan:'p4'},
 h5:{squad:'h5',plan:'p5'},h6:{squad:'h6',plan:'p6'},h7:{squad:'h7',plan:'p7'},h8:{squad:'h8',plan:'p8'}};

const GROUP_OF=(slot:number):Group=>slot===0?'GK':slot===1?'DEF':slot===4?'ST':'MID';
const ROLE_OF:Record<Group,string[]>={GK:['GK'],DEF:['CB'],MID:['W'],ST:['ST']};
function deltaOf(a:Archetype,g:Group):Delta{return g==='DEF'?a.def:g==='MID'?a.mid:g==='ST'?a.st:{};}

/** Throws unless every archetype keeps the budget and the guards. */
export function validate(){
 for(const [k,a] of Object.entries(ARCHETYPES))for(const g of ['DEF','MID','ST'] as const){
  const d=deltaOf(a,g),sum=Object.values(d).reduce((x,y)=>x+(y??0),0);
  if(Math.abs(sum)>1e-9)throw Error(`${k} ${g}: deltas sum to ${sum}`);
  for(const [s,v] of Object.entries(d)){
   const val=r1(MEAN[g][s as keyof Skills]+v!),[lo,hi]=RANGE[s as keyof Skills];
   if(Math.abs(v!)>3+1e-9)throw Error(`${k} ${g} ${s}: delta ${v} beyond 3`);
   if(val<lo-1e-9||val>hi+1e-9)throw Error(`${k} ${g} ${s}: ${val} outside the league range ${lo}-${hi}`);
  }
 }
}
validate();

export function player(code:string,slot:number,arch:string,bench=false){
 const a=ARCHETYPES[arch];if(!a)throw Error('unknown squad '+arch);
 const g=GROUP_OF(slot),d=bench?{}:deltaOf(a,g);
 const skills:any={...MEAN[g]};for(const [s,v] of Object.entries(d))skills[s]=r1(skills[s]+v!);
 const traits={...TRAITS[g],...(bench?{}:a.traits?.[g as 'DEF'|'MID'|'ST']??{})};
 const n=bench?slot+6:slot+1,id=`${code}${bench?'b':''}${slot+1}`;
 return {id,name:`${code} ${bench?'bench ':''}${slot+1}`,short:id,number:n,roles:ROLE_OF[g],skills,traits,energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'};
}
/** A side: the squad (5 starters of the archetype + 4 average bench players: keeper, defender, midfielder, striker) on a plan. */
export function side(code:string,color:string,arch:string,planKey:string){
 const plan=PLANS[planKey];if(!plan)throw Error('unknown plan '+planKey);
 const starters=[0,1,2,3,4].map(i=>player(code,i,arch));
 const bench=[0,1,2,4].map(i=>player(code,i,'avg',true));
 const approach:any={...(PRESETS as any)[plan.style]};
 for(const [k,v] of Object.entries(plan.set??{})){if(!(k in approach))throw Error('unknown setting '+k);approach[k]=v;}
 const settings={...(plan.keeper?{keeper:plan.keeper}:{}),...(plan.setPiece?{setPiece:plan.setPiece}:{})};
 return {club:{id:code,name:code,code,color},formation:plan.formation??'1-2-1',style:plan.style,approach,captain:starters[1].id,
  lineup:starters.map(p=>p.id),bench:bench.map(p=>p.id),players:[...starters,...bench],plans:[],...(Object.keys(settings).length?{settings}:{})};
}
