// Ballers match ratings: a mark out of 10 for every player in one match, read
// on demand from the stored player lines (lib/ballers/stats.ts PlayerLine).
// Nothing is stored and nothing is migrated: an old match is re-rated whenever
// it is read. Design and worked examples: deliverables/ballers-players/RATINGS-FORMULAS.md.
//
//   mark = 6.0 + role job + universal bonuses − universal penalties
//
// - The role is the formation slot actually played (keeper, centre-back,
//   winger, striker), never the card position: matchRoles reads it from the
//   replay header and the substitution events.
// - Role job: what the role is there to do; falling short costs.
// - Role extras: things the role isn't judged on; upside only.
// - Universal bonuses (goals, assists): upside only, the same credit in every
//   role, scaled by how close the final result was and tapered from a
//   player's second goal on.
// - Universal penalties (own goals) hurt anyone.
//
// Counted facts are read against this match's own average over every outfielder
// (both sides, scaled to his seconds), so the mark doesn't drift when the
// engine changes how often things happen. The keeper is read on his own save
// rate against a declared break-even (three in four), counted per shot he
// faced: the one part of the mark that moves with the engine's scoring rate.
// Only rare, decisive facts are fixed counts.
//
// Engine-agnostic: only the facts in the lines plus the score, the match length
// and the slot. Pure: no I/O, no React.
import type {PlayerLine} from './stats';

export type RatingRole='GK'|'CB'|'W'|'ST';

/** The roles each formation's slots play (model.ts shapes), by the slot actually played. Retired 2-1-1
 * (old replays keep its real slots): both centre-backs are judged as centre-backs, and the midfielder (CM in
 * the engine, "Midfielder" in Lineups) by the winger's formula, the closest to a link player (owner, 21 Oct). */
export const SLOT_ROLES:Record<string,readonly RatingRole[]>={
 '1-2-1':['GK','CB','W','W','ST'],
 '2-2':['GK','CB','CB','W','W'],
 '2-1-1':['GK','CB','CB','W','ST'],
};

/** The slice of a replay header and its events matchRoles needs. */
export interface RolesHeader {teams:readonly {formation:string}[];players:readonly {i:number;side:0|1;slot:number;id:string;bench?:boolean}[]}
export interface RolesEvent {k:string;a?:number;g?:number}

/** Each player's role (by stored player id), from the slot he played. A
 * substitute takes the position of the man he replaced (the engine copies
 * role, lane and number to him), and nobody comes back on, so every player
 * has exactly one slot per match. */
export function matchRoles(header:RolesHeader,events:readonly RolesEvent[]):Map<string,RatingRole>{
 const byIndex=new Map(header.players.map(p=>[p.i,p]));
 const slotOf=new Map<number,number>();
 for(const p of header.players)if(p.slot>=0&&!p.bench)slotOf.set(p.i,p.slot);
 // Who stands at each of the ten positions (0-4 home, 5-9 away), as stats.ts matchDetail walks it.
 const pos=[0,1,2,3,4,5,6,7,8,9];
 for(const e of events){
  if(e.k!=='substitution'||e.a===undefined||e.g===undefined)continue;
  const at=pos.indexOf(e.g);if(at<0)continue;
  slotOf.set(e.a,at%5);pos[at]=e.a;
 }
 const out=new Map<string,RatingRole>();
 for(const [i,slot] of slotOf){
  const p=byIndex.get(i);if(!p)continue;
  const role=(SLOT_ROLES[header.teams[p.side]?.formation]??SLOT_ROLES['1-2-1'])[slot];
  if(role)out.set(p.id,role);
 }
 return out;
}

// ---------- the weights (declared, not fitted: RATINGS-FORMULAS.md §2) ----------
export const BASE=6;
export const MARK_MIN=3,MARK_MAX=10;
/** No mark under this share of the match (Sofascore's 10 minutes of 90). */
export const MIN_SHARE=1/9;
/** Player of the Match needs at least this share of the match. */
export const POTM_SHARE=1/3;

type Volume='won'|'cl'|'kp'|'dr'|'so';
const VOLUME:Record<Volume,(l:PlayerLine)=>number>={
 won:l=>(l.tk??0)+(l.it??0),cl:l=>l.cl??0,kp:l=>l.kp??0,dr:l=>l.dr??0,so:l=>l.so??0,
};
/** Per role: [fact, weight, upside only]. The index is (count − expected) /
 * max(expected, 1), clamped to −1…+2 (job) or 0…+2 (extra). */
export const ROLE_FACTS:Record<RatingRole,readonly (readonly [Volume,number,boolean])[]>={
 GK:[],
 CB:[['won',1.0,false],['cl',0.3,true],['kp',0.3,true]],
 W:[['kp',0.8,false],['so',0.3,false],['dr',0.3,true],['won',0.3,true]],
 ST:[['so',0.6,false],['kp',0.3,true],['dr',0.3,true],['won',0.2,true]],
};
/** Pass % against the match's outfield pass %, per 10 points (at most ±0.6, from 5 passes). */
export const PASSING:Record<RatingRole,number>={GK:0.3,CB:0.3,W:0.2,ST:0.2};
export const PASSING_CAP=0.6,PASSING_MIN=5;
/** Keeper, on a declared scale: break-even is saving three shots on target in
 * four; every save above that adds half a point (so each save is +0.125 and
 * each goal let in −0.375: a goal costs through the rate, never twice).
 * Counting by shots faced means 15 of 16 beats 3 of 3, and a keeper who faced
 * nothing stays near 6. This scale drifts when the engine's scoring rate moves
 * (RATINGS-FORMULAS.md §2). */
export const KEEPER_BREAK_EVEN=0.75,KEEPER_PER_SAVE_ABOVE=0.5,KEEPER_CAP=2.5;
export const CLEAN_SHEET:Record<'GK'|'CB',number>={GK:0.5,CB:0.6};
export const CB_CONCEDED=-0.3;
export const FOUL=-0.2;
export const OWN_GOAL=-1;
/** Goal and assist credit by order in the match (1st, 2nd, then each one after). */
export const GOAL_STEPS=[1.0,0.8] as const,GOAL_REST=0.5;
export const ASSIST_STEPS=[0.6,0.6] as const,ASSIST_REST=0.3;
/** How much a goal, an assist and a clean sheet count by the final margin:
 * a goal in a 4–3 matters more than one in a 12–1. */
export function closeness(margin:number):number{return margin<=1?1:margin===2?0.85:margin===3?0.7:0.5;}
const stepped=(n:number,steps:readonly number[],rest:number)=>{let s=0;for(let i=0;i<n;i++)s+=i<steps.length?steps[i]:rest;return s;};

// ---------- the ratings ----------
export type PartKey='won'|'cl'|'kp'|'dr'|'so'|'passing'|'saveRate'|'cleanSheet'|'conceded'|'fouls'|'goals'|'assists'|'ownGoals';
export interface RatingPart {key:PartKey;kind:'job'|'extra'|'bonus'|'penalty';credit:number;
 /** His count (or for passing / saves: what he managed of `of`). */ value:number;of?:number;
 /** What the match's own average expected for his time (counted facts). */ expected?:number;
 /** `value` is an estimate (a centre-back's goals conceded when he didn't play the whole match). */ estimate?:boolean}
export interface PlayerRating {id:string;side:0|1;role:RatingRole|null;seconds:number;
 /** One decimal, 3–10; null when he played under a ninth of the match or the line can't be rated. */ mark:number|null;
 /** Unrounded total (ties, Player of the Match). */ raw:number;
 job:number;bonuses:number;penalties:number;parts:RatingPart[];
 /** One short player-first line: what he did, anchored in this match. */ reason:string}
export interface RatingFacts {
 /** Final score, [home, away]. */ score:readonly [number,number];
 /** The match length in seconds (the replay header's fullTime ?? duration; 900 for a league match). */ matchSeconds:number;
 /** Role by player id (matchRoles). */ roles:ReadonlyMap<string,RatingRole>;
}

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const r2=(v:number)=>Math.round(v*100)/100;

export function matchRatings(lines:readonly PlayerLine[],facts:RatingFacts):PlayerRating[]{
 const full=facts.matchSeconds,margin=Math.abs(facts.score[0]-facts.score[1]),close=closeness(margin);
 const rated=lines.length>0&&lines.every(l=>l.m!==undefined)&&full>0;
 const roleOf=(l:PlayerLine)=>facts.roles.get(l.id)??null;
 // The match's own averages: every outfielder, both sides, per second on the pitch.
 const outfield=lines.filter(l=>{const r=roleOf(l);return r!==null&&r!=='GK';});
 const seconds=outfield.reduce((s,l)=>s+(l.m??0),0);
 const perSecond={} as Record<Volume,number>;
 for(const k of Object.keys(VOLUME) as Volume[])perSecond[k]=seconds>0?outfield.reduce((s,l)=>s+VOLUME[k](l),0)/seconds:0;
 const passes=outfield.reduce((s,l)=>s+(l.ps??0),0),found=outfield.reduce((s,l)=>s+(l.pc??0),0);
 const matchPass=passes>0?found/passes:null;

 return lines.map(l=>{
  const role=roleOf(l),m=l.m??0,share=full>0?m/full:0;
  const empty:PlayerRating={id:l.id,side:l.side,role,seconds:m,mark:null,raw:BASE,job:0,bonuses:0,penalties:0,parts:[],reason:''};
  if(!rated||role===null)return empty;
  const parts:RatingPart[]=[];
  for(const [k,w,upside] of ROLE_FACTS[role]){
   const expected=perSecond[k]*m,value=VOLUME[k](l);
   const index=clamp((value-expected)/Math.max(expected,1),upside?0:-1,2);
   parts.push({key:k,kind:upside?'extra':'job',credit:r2(w*index),value,expected:Math.round(expected*10)/10});
  }
  const ps=l.ps??0,pc=l.pc??0;
  if(matchPass!==null&&ps>=PASSING_MIN)parts.push({key:'passing',kind:'job',credit:r2(clamp(PASSING[role]*(pc/ps-matchPass)*10,-PASSING_CAP,PASSING_CAP)),value:pc,of:ps});
  const against=l.side===0?facts.score[1]:facts.score[0];
  if(role==='GK'){
   const sf=l.sf??0,ss=l.ss??0;
   if(sf>0)parts.push({key:'saveRate',kind:'job',credit:r2(clamp(KEEPER_PER_SAVE_ABOVE*(ss-KEEPER_BREAK_EVEN*sf),-KEEPER_CAP,KEEPER_CAP)),value:ss,of:sf});
   if(l.cs)parts.push({key:'cleanSheet',kind:'job',credit:r2(CLEAN_SHEET.GK*close),value:1});
  }
  if(role==='CB'){
   // Goals conceded while he played: the team's, by his share of the match, until the lines carry goal times
   // (an estimate for anyone who didn't play it all: the reason line then says only what the team conceded).
   const on=Math.round(against*share);
   if(on)parts.push({key:'conceded',kind:'job',credit:r2(CB_CONCEDED*on),value:on,of:against,...(m>=full-1?{}:{estimate:true})});
   else if(share>=2/3)parts.push({key:'cleanSheet',kind:'job',credit:r2(CLEAN_SHEET.CB*close),value:1});
  }
  if(role!=='GK'&&l.fc)parts.push({key:'fouls',kind:'job',credit:r2(FOUL*l.fc),value:l.fc});
  if(l.g)parts.push({key:'goals',kind:'bonus',credit:r2(stepped(l.g,GOAL_STEPS,GOAL_REST)*close),value:l.g});
  if(l.a)parts.push({key:'assists',kind:'bonus',credit:r2(stepped(l.a,ASSIST_STEPS,ASSIST_REST)*close),value:l.a});
  if(l.og)parts.push({key:'ownGoals',kind:'penalty',credit:r2(OWN_GOAL*l.og),value:l.og});
  const sum=(k:RatingPart['kind'][])=>r2(parts.filter(p=>k.includes(p.kind)).reduce((s,p)=>s+p.credit,0));
  const job=sum(['job','extra']),bonuses=sum(['bonus']),penalties=-sum(['penalty']);
  const raw=Math.round((BASE+job+bonuses-penalties)*1000)/1000;
  const mark=share<MIN_SHARE?null:clamp(Math.round(raw*10)/10,MARK_MIN,MARK_MAX);
  return {...empty,mark,raw,job,bonuses,penalties,parts,reason:mark===null?'':reasonFor(parts,job)};
 });
}

/** The best player in the match: the highest mark among those who played at
 * least a third of it; ties go to the unrounded total, then the winning side. */
export function playerOfTheMatch(ratings:readonly PlayerRating[],facts:Pick<RatingFacts,'score'|'matchSeconds'>):PlayerRating|null{
 const winner=facts.score[0]>facts.score[1]?0:facts.score[1]>facts.score[0]?1:-1;
 const eligible=ratings.filter(r=>r.mark!==null&&r.seconds>=facts.matchSeconds*POTM_SHARE);
 eligible.sort((a,b)=>b.mark!-a.mark!||b.raw-a.raw||Number(b.side===winner)-Number(a.side===winner)||a.id.localeCompare(b.id));
 return eligible[0]??null;
}

// ---------- the reason line ----------
const plural=(n:number,one:string,many:string)=>n===1?one:many;
function phrase(p:RatingPart):string{
 const n=p.value,good=p.credit>=0;
 switch(p.key){
  case 'goals':return n===1?'scored':n===2?'scored twice':n===3?'hat-trick':`scored ${n}`;
  case 'assists':return n===1?'set up a goal':`set up ${n} goals`;
  case 'ownGoals':return n===1?'own goal':`${n} own goals`;
  case 'won':return good?`won the ball ${n} ${plural(n,'time','times')} (${Math.round(p.expected??0)} is usual for his time)`:`won the ball only ${n} ${plural(n,'time','times')}`;
  case 'cl':return `${n} ${plural(n,'clearance','clearances')}`;
  case 'kp':return good?`created ${n} ${plural(n,'chance','chances')}`:n===0?'created no chances':`created only ${n} ${plural(n,'chance','chances')}`;
  case 'so':return good?`${n} ${plural(n,'shot','shots')} on target`:n===0?'no shot on target':`only ${n} ${plural(n,'shot','shots')} on target`;
  case 'dr':return `beat ${n} ${plural(n,'man','men')}`;
  case 'passing':return good?`found a team-mate with ${n} of ${p.of} passes`:`gave away ${(p.of??0)-n} of ${p.of} passes`;
  case 'saveRate':return `saved ${n} of ${p.of}`;
  case 'cleanSheet':return 'clean sheet';
  case 'conceded':return p.estimate?`team conceded ${p.of??n}`:`${n} conceded`;
  case 'fouls':return `${n} ${plural(n,'foul','fouls')}`;
 }
}
/** Goals, assists, own goals and a keeper's saves first, then what mattered most: his biggest
 * credits, led by the costliest shortfall when his job came out below par. */
function reasonFor(parts:RatingPart[],job:number):string{
 const lead=parts.filter(p=>p.kind==='bonus'||p.kind==='penalty'||p.key==='saveRate');
 const rest=parts.filter(p=>(p.kind==='job'||p.kind==='extra')&&p.key!=='saveRate'&&Math.abs(p.credit)>=0.05);
 const worst=job<0?rest.slice().sort((a,b)=>a.credit-b.credit).filter(p=>p.credit<0).slice(0,1):[];
 const best=rest.filter(p=>p.credit>0&&!worst.includes(p)).sort((a,b)=>b.credit-a.credit);
 const picked=[...lead,...worst,...best].slice(0,3);
 if(!picked.length)return 'A quiet match.';
 const text=picked.map(phrase).join(', ');
 return text[0].toUpperCase()+text.slice(1)+'.';
}
