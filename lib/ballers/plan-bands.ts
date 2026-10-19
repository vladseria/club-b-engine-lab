// A plan, read as the loop a match goes round (BRIEF D1, BUILD-PLAN WP1):
// With the ball → Losing the ball → Without the ball → Winning the ball, then
// Set pieces and keeper. Every setting sits in exactly one band; when the
// engine also reads it somewhere else, its row carries one honest "Also" line
// (the truth source is lib/ballers/setting-reach.ts, checked by
// verificare/gp-wp1.test.ts). Pure: no I/O, no React.
//
// Copy: every approach setting's words come from lib/ballers/league.ts
// (APPROACH_FIELDS, STYLES, FORMATIONS), the one source the player card and the
// old screens share. A row's short meaning is the first sentence of that line;
// the open row shows the whole line. Keeper and free-kick words come from
// league.ts KEEPER_OPTIONS / FREE_KICK_OPTIONS, the one source Match prep uses too.
import {APPROACH_FIELDS,FORMATIONS,FREE_KICK_ABOUT,FREE_KICK_OPTIONS,KEEPER_ABOUT,KEEPER_OPTIONS,PRESETS,RETIRED_OPTIONS,clock,type Formation,type Match,type Player,type Result,type Round} from './league';
import type {Approach} from './approach';
import type {Phase} from './phase';
import {finishedOnly} from './spoilers';
import {reachesOutside,type ReachKey} from './setting-reach';
import {STYLE_SHORT,type Plan,type PlanField,type PlanMove,type PlanPrep} from './plans';

// ------------------------------------------------------------------ bands
export type BandId='with'|'lose'|'without'|'win'|'set';
/** A setting on a plan: the eight approach keys, plus keeper and free kicks. */
export type SettingKey=ReachKey;
export interface Band {
 id:BandId;name:string;
 settings:readonly SettingKey[];
 /** The phases (lib/ballers/phase.ts) this band stands for. A setting that acts outside them has an "Also" line. */
 home:readonly Phase[];
}
/** The plan page's order: the loop a match goes round, then set pieces and keeper. */
export const BANDS:readonly Band[]=[
 {id:'with',name:'With the ball',settings:['progression','width','striker','commit'],home:['build','attack']},
 {id:'lose',name:'Losing the ball',settings:['onLoss'],home:['loss']},
 {id:'without',name:'Without the ball',settings:['line','press'],home:['defend']},
 {id:'win',name:'Winning the ball',settings:['transition'],home:['build','attack']},
 {id:'set',name:'Set pieces and keeper',settings:['keeper','setPiece'],home:['set']},
];
export const band=(id:BandId)=>BANDS.find(b=>b.id===id)!;
export const bandOf=(k:SettingKey)=>BANDS.find(b=>b.settings.includes(k))!;
/** Every setting, once, in loop order. */
export const ALL_SETTINGS:readonly SettingKey[]=BANDS.flatMap(b=>b.settings);

// ------------------------------------------------------------------ settings
export interface SettingOption {value:string;label:string;line:string}
/** `about`: what the setting is about, one line (league.ts, shown above its options). */
export interface SettingDef {key:SettingKey;label:string;about:string;options:readonly SettingOption[]}
/** Plainer lines for the Game plan screens only (FIX-ROUND U5: "when it's on" and "your usual game"
 * are banned there). The old screens keep league.ts's words exactly, so an unswitched club reads
 * what it read before; adopt these in league.ts when plans reach everyone. */
export const PLAN_LINES:Partial<Record<keyof Approach,Record<string,string>>>={
 press:{balanced:'Presses when a team-mate is close enough to help, and doesn’t chase every ball. Fits any squad.'},
 transition:{balanced:'Counter-attacks when there’s space ahead, otherwise keeps the ball. Fits any squad.'},
};
const fromLeague=(k:keyof Approach):SettingDef=>{const f=APPROACH_FIELDS.find(x=>x.key===k)!;
 return {key:k,label:f.label,about:f.about,options:f.options.map(o=>({...o,line:PLAN_LINES[k]?.[o.value]??o.line}))};};
export const KEEPER_OWN='own',FREE_KICKS_MIXED='mixed';
export const SETTINGS:Record<SettingKey,SettingDef>={
 progression:fromLeague('progression'),width:fromLeague('width'),line:fromLeague('line'),press:fromLeague('press'),
 striker:fromLeague('striker'),commit:fromLeague('commit'),transition:fromLeague('transition'),onLoss:fromLeague('onLoss'),
 // the words live in league.ts (KEEPER_OPTIONS / FREE_KICK_OPTIONS), shared with Match prep
 keeper:{key:'keeper',label:'Keeper',about:KEEPER_ABOUT,options:KEEPER_OPTIONS.map(({value,label,line})=>({value,label,line}))},
 setPiece:{key:'setPiece',label:'Free kicks',about:FREE_KICK_ABOUT,options:FREE_KICK_OPTIONS},
};
const APPROACH_KEYS:readonly (keyof Approach)[]=['progression','width','line','press','striker','commit','transition','onLoss'];
export const isApproachKey=(k:SettingKey):k is keyof Approach=>(APPROACH_KEYS as readonly string[]).includes(k);

/** The setting's value on this plan, as an option value ('own' / 'mixed' when the plan leaves it to the default). */
export function valueOf(p:Pick<Plan,'settings'|'set_pieces'>,k:SettingKey):string{
 if(k==='keeper')return p.set_pieces.keeper??KEEPER_OWN;
 if(k==='setPiece')return p.set_pieces.setPiece??FREE_KICKS_MIXED;
 return String(p.settings[k]);
}
/** A retired value (league.ts RETIRED_OPTIONS) still has its own name, so a past prep that played it never reads as another option. */
export const optionOf=(k:SettingKey,v:string)=>SETTINGS[k].options.find(o=>o.value===v)??(isApproachKey(k)?RETIRED_OPTIONS[k]?.find(o=>o.value===v):undefined)??SETTINGS[k].options[0];
/** The value as a word. Bodies forward reads "3 · their call" or "4 forward", never a bare digit. */
export const valueWord=(k:SettingKey,v:string)=>k==='commit'?(v==='3'?'3 · their call':`${v} forward`):optionOf(k,v).label;
/** A row's meaning: the first sentence of the option's line (the open row shows all of it). */
export const firstSentence=(line:string)=>line.match(/^.*?[.!?](?=\s|$)/)?.[0]??line;
export const meaning=(k:SettingKey,v:string)=>firstSentence(optionOf(k,v).line);
/** What a keeper does when left to himself (his keeperSweep trait, engine default 0.2), as Prep says it. */
export const keeperHabit=(p:Pick<Player,'short'|'traits'>)=>{const v=p.traits.keeperSweep??.2;
 return `${p.short} ${v>=.6?'comes off his line for balls in behind':v<=.2?'stays on his line':'picks his moments to come out'}.`;};

/** The style value a setting started from (approach settings only; keeper and free kicks have no style). */
export const baseValue=(p:Pick<Plan,'based_on'>,k:SettingKey)=>isApproachKey(k)?String(PRESETS[p.based_on][k]):undefined;
/** Amber dot: changed from the style the plan is based on. */
export const changedFromStyle=(p:Pick<Plan,'based_on'|'settings'|'set_pieces'>,k:SettingKey)=>isApproachKey(k)&&valueOf(p,k)!==baseValue(p,k);

/** The one honest "Also" line per setting (present tense, no roadmap talk). An
 * option-keyed entry applies to that option only. Must agree with
 * setting-reach.ts: a line exists exactly when the setting reaches outside its band. */
const ALSO:Partial<Record<SettingKey,string|Readonly<Record<string,string>>>>={
 width:'Without the ball, it also sets how far your defenders follow men out wide.',
 line:'With the ball, it also sets how high your defenders push up.',
 press:'In the first seconds after you lose the ball, it also sets how the players not chasing it press.',
 keeper:'In open play too: how far he comes for balls in behind and high balls, and how deep he stands when you build up.',
 // Regroup, the one On losing it option that reached further (setting-reach.ts), is retired from the board.
};
export function alsoLine(k:SettingKey,v:string):string|undefined{
 const a=ALSO[k];
 return typeof a==='string'?a:a?.[v];
}
/** Whether the reach table says this setting (with this option) needs an "Also" line. */
export const needsAlso=(k:SettingKey,v:string)=>reachesOutside(k,v,bandOf(k).home);

// ------------------------------------------------------------------ saving one field
/** The door's field name and value for a picked option (ballers_plan_set). */
export function fieldFor(k:SettingKey,v:string):{field:PlanField;value:unknown}{
 if(k==='keeper')return {field:'keeper',value:v===KEEPER_OWN?null:v};
 if(k==='setPiece')return {field:'setPiece',value:v===FREE_KICKS_MIXED?null:v};
 return {field:k,value:k==='commit'?Number(v):v};
}
/** A plan with one field changed, as the door would store it (optimistic display). */
export function withField(p:Plan,field:PlanField,value:unknown):Plan{
 if(field==='keeper'||field==='setPiece'){
  const sp={...p.set_pieces} as Record<string,unknown>;delete sp[field];
  if(value!==null&&value!==undefined&&!(field==='setPiece'&&value===FREE_KICKS_MIXED))sp[field]=value;
  return {...p,set_pieces:sp};
 }
 const m=/^moves\.(.+)\.(emphasis|start)$/.exec(field);
 if(m)return {...p,moves:p.moves.map(x=>x.id===m[1]?{...x,[m[2]]:value}:x)};
 return {...p,settings:{...p.settings,[field]:value}};
}
/** The plan's settings put back to its style's ("Back to Short"). */
export const styleSettings=(p:Pick<Plan,'based_on'>):Approach=>({...PRESETS[p.based_on]});

// ------------------------------------------------------------------ moves
/** A set-piece routine: its lesson has a restart scene (lib/ballers/lab/model.ts). */
export const isRoutine=(m:Pick<PlanMove,'plan'>)=>!!(m.plan as {lesson?:{scene?:unknown}}).lesson?.scene;
export const movesIn=(p:Pick<Plan,'moves'>,kind:'open'|'routine')=>p.moves.filter(m=>isRoutine(m)===(kind==='routine'));

// ------------------------------------------------------------------ the next match's clock
/** Plans count for the next match until its lock; from 30 minutes before, every plan screen says so. */
export const SOON_MS=30*60*1000;
export type LockPhase='none'|'paused'|'open'|'soon'|'locked';
export interface NextMatch {phase:LockPhase;/** "Friday" ('' while the league is paused: its dates mean nothing then) */day:string;/** "19:00" */lock:string}
const weekday=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',weekday:'long'});
export function nextMatchOf(round:Pick<Round,'kickoff_at'|'locks_at'|'status'>|null|undefined,paused:boolean,now=Date.now()):NextMatch{
 if(!round)return {phase:'none',day:'',lock:''};
 if(paused)return {phase:'paused',day:'',lock:''};
 const day=weekday.format(new Date(round.kickoff_at)),lock=clock(round.locks_at);
 const at=Date.parse(round.locks_at);
 if(round.status!=='open'||now>=at)return {phase:'locked',day,lock};
 return {phase:now>=at-SOON_MS?'soon':'open',day,lock};
}
/** "Friday", or "your next match" when the day isn't known. */
export const matchWord=(n:NextMatch)=>n.day||'your next match';
/** After a change: what it means for the next match (the Undo bar's second sentence).
 * `plan`: the plan changed, and whether it is the one picked for the next match (a plan
 * nobody picked changes nothing about the next match, so it just says where it saved). */
export function savedLine(n:NextMatch,plan?:{name:string;picked:boolean}){
 if(plan&&!plan.picked)return `Saved in ${plan.name}.`;
 const it=plan?plan.name:'it';
 switch(n.phase){
  case 'open':case 'soon':return `${n.day}’s match uses ${it} as it is at ${n.lock}.`;
  case 'locked':return 'It counts from the next round.';
  case 'paused':return `Your next match uses ${it}.`;
  default:return 'Saved.';
 }
}

// ------------------------------------------------------------------ how often a plan has played
/** What a plan was when the switch made it: its first linked snapshot (version 1),
 * else the plan itself while nobody has changed it. Null once that's unknowable. */
export function originalSetup(home:Pick<Plan,'id'|'version'|'formation'|'based_on'|'settings'|'set_pieces'|'stored'>,preps:readonly Pick<PlanPrep,'plan_snapshot'>[]){
 const snap=preps.map(p=>p.plan_snapshot).find(s=>s?.id===home.id&&s.version===1);
 if(snap)return {formation:snap.formation,based_on:snap.based_on,settings:snap.settings as Record<string,unknown>,set_pieces:snap.set_pieces};
 // a row holding a retired value is read as what now plays (plans.ts plan()); its past is what it stored
 if(home.version===1)return {formation:home.stored?.formation??home.formation,based_on:home.based_on,settings:(home.stored?.settings??home.settings) as unknown as Record<string,unknown>,set_pieces:home.set_pieces};
 return null;
}
const SETUP_KEYS=['progression','width','line','press','commit','striker','transition','onLoss'] as const;
const setupKey=(formation:string,s:Record<string,unknown>)=>`${formation}|${SETUP_KEYS.map(k=>String(s[k]??(k==='onLoss'?'balanced':''))).join('|')}`;

/** Finished league matches a plan played, counted ONE way everywhere (Plans, the
 * overview, Prep; FIX-ROUND A4): a round counts when its prep was linked to the
 * plan. For the Home plan the switch made, the club's matches before the switch
 * with the very setup it was made from count too ("before plans"), so a plan never
 * says "Not played yet" beside pictures of it playing. Your own unwatched results
 * count (after full time nothing is secret). */
export function planUsage(plan:Pick<Plan,'id'|'origin'|'migrated_at'|'version'|'formation'|'based_on'|'settings'|'set_pieces'|'stored'>,preps:readonly PlanPrep[],results:readonly Result[],clubId:string|null|undefined,now=Date.now()):{played:number;before:number;last:string|null}{
 if(!clubId)return {played:0,before:0,last:null};
 const mine=finishedOnly(results,now).filter(r=>r.round_id&&(r.home_club===clubId||r.away_club===clubId));
 const linked=new Set(preps.filter(p=>p.plan_id===plan.id||(p.plan_snapshot?.id===plan.id&&!p.plan_snapshot.detached)).map(p=>p.round_id));
 const played=mine.filter(r=>linked.has(r.round_id!));
 let before:typeof mine=[];
 const orig=plan.origin==='home'&&plan.migrated_at?originalSetup(plan,preps):null;
 if(orig){
  const want=setupKey(orig.formation,orig.settings),at=Date.parse(plan.migrated_at!);
  before=mine.filter(r=>{if(linked.has(r.round_id!)||Date.parse(r.live_from)>=at)return false;
   const p=preps.find(x=>x.round_id===r.round_id);return !!p&&!p.plan_snapshot&&p.formation===orig.formation&&setupKey(p.formation,p.approach as unknown as Record<string,unknown>)===want;});
 }
 const last=[...played,...before].map(r=>r.live_from).sort().at(-1)??null;
 return {played:played.length,before:before.length,last};
}
/** "Played 3 times · last Tue 30 Sep", "Not played yet". Matches before plans count, unlabelled. */
export const usedLine=(u:{played:number;before?:number;last:string|null},date:(t:string)=>string)=>{
 const n=u.played+(u.before??0);
 if(!n)return 'Not played yet';
 return `Played ${n===1?'once':`${n} times`}${u.last?` · last ${date(u.last)}`:''}`;
};
/** Every plan's count at once (Prep's picker): the same rule as planUsage. */
export const plansUsage=(plans:readonly Plan[],preps:readonly PlanPrep[],results:readonly Result[],clubId:string|null|undefined,now=Date.now())=>
 new Map(plans.map(p=>[p.id,planUsage(p,preps,results,clubId,now)]));

/** The next match's opponent, if your club has one. */
export const opponentOf=(m:Pick<Match,'home_club'|'away_club'>|null|undefined,clubId:string|null|undefined)=>
 !m||!clubId?null:m.home_club===clubId?m.away_club:m.away_club===clubId?m.home_club:null;

// ------------------------------------------------------------------ names and copies
export const MAX_NAME=40;
/** `base`, or `base 2`, `base 3`… so it never clashes (case-insensitive) and stays within 40 characters. */
export function uniqueName(base:string,taken:readonly string[]){
 const used=new Set(taken.map(n=>n.trim().toLowerCase())),b=base.trim().slice(0,MAX_NAME);
 if(!used.has(b.toLowerCase()))return b;
 for(let i=2;;i++){const s=` ${i}`,n=`${b.slice(0,MAX_NAME-s.length).trimEnd()}${s}`;if(!used.has(n.toLowerCase()))return n;}
}
export const styleName=(s:keyof typeof STYLE_SHORT)=>`${STYLE_SHORT[s]} plan`;
export const copyName=(name:string)=>`${name} (copy)`;

// ------------------------------------------------------------------ where things live
export const PLANS_HREF='/jocuri/ballers/plans';
export const PREP_HREF='/jocuri/ballers/prep';
export const MOVES_HREF=`${PLANS_HREF}/moves`;
export const planHref=(id:string,rest='')=>`${PLANS_HREF}/${id}${rest}`;
/** A part of a plan, on its one page (the old band pages' links land here). */
export const partHref=(id:string,b:BandId|'moves')=>planHref(id,`#${b}`);
/** New move (WP2): the ready-made moves, then a blank board; or New routine. */
export const teachHref=(id:string,routine=false)=>planHref(id,routine?'/teach?routine=1':'/teach');
/** A practice match with this plan. */
export const practiceHref=(planId?:string|null)=>`/jocuri/ballers/practice${planId?`?plan=${planId}`:''}`;
/** A move inside a plan (WP2's move page: "Editing for Home plan…"). */
export const moveHref=(id:string,moveId:string)=>planHref(id,`/teach/${moveId}`);
