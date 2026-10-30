// Ballers P4: from incidents to commentary lines. Pure and deterministic.
// The words live in ./ro.ts (the file Vlad edits); this file decides which
// moment gets a line, when, and which variant.
//
// The announcement board: ONE line per moment, at least MIN_GAP apart. It is
// scheduled causally, in incident order, so the lines a live viewer sees at t
// are exactly the full-time lines up to t (no line is ever decided by
// something later than its own time):
//   - goals, own goals, kickoff and the final whistle always get a line (if
//     the previous line is too recent, it waits up to MIN_GAP);
//   - anything else gets a line only if it can be said within MAX_DELAY of
//     happening and enough calm has passed since the last line for its
//     weight (big moments: MIN_GAP; build-up: much longer), so ~30-45 lines
//     tell a 15-minute match without a transcript.
import type {ReplayHeader} from '../replay';
import {MUST_WEIGHT,type Incident} from '../incidents';
import {AT_HOME,FLAVOUR,LINES,PASS_COUNT,REPORT,SUB_REASON,SWITCH_REASON,SWITCH_STYLE,secondsWords,type FlavourOn,type HomeOn} from './ro';
import {normalizeVoice,type Voice} from '../voice';
import {OPEN_CLOCK,shownClock} from '../match-clock';

export const MIN_GAP=4000;
export const MAX_DELAY=2500;
/** Calm needed since the previous line before an incident of this weight gets one. */
export function calmFor(weight:number){return weight>=MUST_WEIGHT?0:weight>=55?MIN_GAP:weight>=40?10000:weight>=30?20000:30000;}
/** Club flavour (the AI clubs' FLAVOUR, a human club's own voice): at most
 * FLAVOUR_MAX per club per match, FLAVOUR_EVERY apart, and then only on one
 * eligible moment in three (a hash, so every viewer hears the same). */
export const FLAVOUR_EVERY=300000,FLAVOUR_MAX=2;
/** A ground's own lines (AT_HOME): always after the kickoff and a home win, after a home goal one time in two,
 * at most AT_HOME_GOALS times, and never on a line that already carries club flavour. */
export const AT_HOME_GOALS=2;

export interface Line {id:string;at:number;text:string;incident:Incident;
 /** The line's portrait (goals and key passes only): a player index. */ portrait?:number}

/** FNV-1a, 32-bit. */
export function hash(s:string){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;}
export const mmss=(ms:number)=>{const s=Math.max(0,Math.floor(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
/** {min}: the moment on the clock the match shows (incidents carry it; lib/ballers/match-clock.ts). */
const minOf=(x:Pick<Incident,'t'|'min'>)=>x.min??shownClock(x.t/1000,OPEN_CLOCK);
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();

type Header=Pick<ReplayHeader,'players'|'teams'>;
/** Fill {slots}; null when a slot the template needs is missing. */
export function fill(template:string,slots:Record<string,string|undefined>):string|null{
 let ok=true;
 const out=template.replace(/\{(\w+)\}/g,(_,k:string)=>{const v=slots[k];if(v===undefined||v===''){ok=false;return '';}return v;});
 return ok?out:null;
}
export function slotsFor(x:Incident,header:Header):Record<string,string|undefined>{
 const name=(i:number|undefined)=>i===undefined?undefined:header.players[i]?.name;
 const club=x.side===null?undefined:header.teams[x.side]?.name,opp=x.side===null?undefined:header.teams[1-x.side]?.name;
 const reason=x.kind==='substitution'&&x.facts.sub?fill(SUB_REASON[x.facts.sub]??'',{player:name(x.actors[0]),other:name(x.actors[1])})??undefined
  :x.kind==='switch'&&x.facts.sub?SWITCH_REASON[x.facts.sub]:undefined;
 const style=x.kind==='switch'&&x.facts.style?SWITCH_STYLE[x.facts.style]:undefined,shape=x.kind==='switch'?x.facts.shape:undefined;
 return {player:name(x.actors[0]),other:name(x.actors[1]),club,opp,home:header.teams[0].name,away:header.teams[1].name,score:`${x.score[0]}–${x.score[1]}`,min:minOf(x),reason:reason||undefined,style:style||undefined,shape:shape||undefined,
  passes:x.facts.passes!==undefined?PASS_COUNT[x.facts.passes]??(x.facts.passes>=7?'multe':undefined):undefined,secs:x.facts.surge!==undefined?secondsWords(x.facts.surge):undefined};
}
/** The template key for an incident. */
export function lineKey(x:Incident):string{
 switch(x.kind){
  // a goal that ends a surge gets its own words, unless it is a late equaliser or winner (those say more)
  case 'goal':return x.facts.late?`late_${x.facts.late}`:x.facts.surge!==undefined?'goal_surge':`goal_${x.facts.state??'extends'}`;
  case 'save':return x.facts.big?'save_big':'save';
  // the real whistle (a match with a half-time) or the clock's midpoint of one without
  case 'half':return x.facts.whistle?(x.score[0]===x.score[1]?'half_time_level':'half_time_lead'):x.score[0]===x.score[1]?'half_level':'half_lead';
  case 'end':return x.score[0]===x.score[1]?'end_draw':'end_win';
  case 'idea':return x.facts.finally?'idea_finally':'idea';
  // With the reason when there is one worth saying, else the plain change.
  case 'substitution':return x.facts.sub&&SUB_REASON[x.facts.sub]?'substitution':'substitution_plain';
  // a change of plan: the new shape when there is one, else the new style; the plain line when neither is known
  case 'switch':return x.facts.shape?'plan_switch_shape':x.facts.style&&SWITCH_STYLE[x.facts.style]?'plan_switch':'plan_switch_plain';
  // (styles) a Short side's one-touch move: one that made a shot, a long one, an ordinary one; a Counter surge's end
  case 'one_touch':return x.facts.shot?'one_touch_chance':(x.facts.passes??0)>=5?'one_touch_long':'one_touch';
  case 'surge':return x.facts.outcome==='shot'?'surge_shot':'surge_lost';
  default:return x.kind;
 }
}
/** Who "{club}" is for lines about the whole match (the leader / the winner). */
function leaderSide(x:Incident):0|1|null{return x.score[0]===x.score[1]?null:x.score[0]>x.score[1]?0:1;}

/** Pick a variant: start at a hash of match + incident and skip the variants
 * this key used most recently (`recent` remembers them per key), so a rout's
 * eighth goal doesn't read like its fourth. */
function pick(list:string[],seed:string,key:string,recent:Map<string,number[]>,slots:Record<string,string|undefined>):string|null{
 return pickAt(list,seed,key,recent,slots)?.text??null;
}
function pickAt(list:string[],seed:string,key:string,recent:Map<string,number[]>,slots:Record<string,string|undefined>):{i:number;text:string}|null{
 if(!list.length)return null;
 const start=hash(seed)%list.length,used=recent.get(key)??[];
 const memory=Math.min(list.length-1,Math.ceil(list.length/2));
 const avoid=new Set(used.slice(-memory));
 const order=Array.from({length:list.length},(_,k)=>(start+k)%list.length);
 for(const pass of [0,1])for(const i of order){
  if(pass===0&&avoid.has(i))continue;
  const text=fill(list[i],slots);if(text!==null){recent.set(key,[...used,i].slice(-8));return {i,text};}
 }
 return null;
}

/** The text for one incident (deterministic for the match + incident + the
 * lines already said, which only matters for the no-repeat rule). */
export function textFor(x:Incident,matchId:string,header:Header,last=new Map<string,number[]>()):string{
 const slots=slotsFor(x,header);
 if(x.kind==='half'||x.kind==='end'){const s=leaderSide(x);slots.club=s===null?undefined:header.teams[s].name;slots.opp=s===null?undefined:header.teams[1-s].name;}
 const key=lineKey(x);
 return pick(LINES[key]??[],`${matchId}|${x.id}`,key,last,slots)??(x.engine||'');
}

function flavourFor(x:Incident,header:Header):{club:string;side:0|1;on:FlavourOn}[]{
 if(x.side===null)return [];
 const us=header.teams[x.side].name,them=header.teams[1-x.side].name,other=(1-x.side) as 0|1;
 switch(x.kind){
  case 'goal':case 'own_goal':return [{club:us,side:x.side,on:'goal'},{club:them,side:other,on:'concede'}];
  case 'save':return [{club:us,side:x.side,on:'save'}];
  case 'foul':return [{club:us,side:x.side,on:'foul'}];
  default:return [];
 }
}

/** The slots a club-voice line may use (lib/ballers/voice.ts VOICE_SLOTS),
 * from the voice's own side: {club} is always that club. {player} is its
 * scorer / the one who scored against it (never on an own goal: the name
 * would be the wrong side's), its keeper, its player who fouled. */
export function voiceSlots(x:Incident,header:Header,side:0|1,on:FlavourOn):Record<string,string|undefined>{
 const name=(i:number|undefined)=>i===undefined?undefined:header.players[i]?.name;
 const base={club:header.teams[side]?.name,opp:header.teams[1-side]?.name,score:`${x.score[0]}–${x.score[1]}`,min:minOf(x)};
 if(on==='goal'||on==='concede')return {...base,player:x.kind==='goal'?name(x.actors[0]):undefined};
 return {...base,player:name(x.actors[0]),other:name(x.actors[1])};
}

/** The announcement board for a whole match (or everything up to a live horizon). */
export function boardLines(incidents:Incident[],matchId:string,header:Header):Line[]{
 const out:Line[]=[],last=new Map<string,number[]>(),saidFlavour=new Set<string>();
 const flavourUsed=new Map<string,{n:number;at:number}>();
 // A human club's own lines, as frozen in the header; a club with a voice
 // speaks only in its own words (never an AI club's FLAVOUR by name).
 const voices=([0,1] as const).map(side=>normalizeVoice((header.teams[side] as {voice?:Voice}|undefined)?.voice));
 let prev=-Infinity;
 // the home club's ground speaks too (ro.ts AT_HOME), and only at home: the home side is header.teams[0]
 const homeLines=AT_HOME[norm(header.teams[0]?.name??'')]??null,homeSaid=new Set<string>();let homeGoals=0;
 for(const x of incidents){
  const must=x.weight>=MUST_WEIGHT;
  const at=Math.max(x.t,prev+MIN_GAP);
  if(!must&&(at-x.t>MAX_DELAY||x.t-prev<calmFor(x.weight)))continue;
  let text=textFor(x,matchId,header,last);
  if(!text)continue;
  const before=text;
  // Club flavour: rare, deterministic, never twice within FLAVOUR_EVERY.
  for(const f of flavourFor(x,header)){
   const voice=voices[f.side];
   if(voice){
    // Like FLAVOUR, a line is never said twice in one match.
    // The budget is the side's (a voice belongs to a side, whatever its name).
    const own=(voice[f.on]??[]).filter(t=>!saidFlavour.has(`${f.side}|${t}`)),key=`voice|${f.side}`;if(!own.length)continue;
    const used=flavourUsed.get(key)??{n:0,at:-Infinity};
    if(used.n>=FLAVOUR_MAX||x.t-used.at<FLAVOUR_EVERY||hash(`${matchId}|${x.id}|voice|${f.side}`)%3!==0)continue;
    // The lines' own seeded picker, over the lines not yet said (so no
    // position memory: the list shrinks as lines are said).
    const got=pickAt(own,`${matchId}|${x.id}|voice`,'voice',new Map(),voiceSlots(x,header,f.side,f.on));if(!got)continue;
    saidFlavour.add(`${f.side}|${own[got.i]}`);
    text=`${text} ${got.text}`;
    flavourUsed.set(key,{n:used.n+1,at:x.t});break;
   }
   const key=norm(f.club),pool=(FLAVOUR[key]??[]).filter(v=>v.on===f.on&&!saidFlavour.has(v.text));if(!pool.length)continue;
   const used=flavourUsed.get(key)??{n:0,at:-Infinity};
   if(used.n>=FLAVOUR_MAX||x.t-used.at<FLAVOUR_EVERY||hash(`${matchId}|${x.id}|flavour|${key}`)%3!==0)continue;
   const said=pool[hash(`${matchId}|${x.id}|fl`)%pool.length].text;saidFlavour.add(said);
   text=`${text} ${said}`;
   flavourUsed.set(key,{n:used.n+1,at:x.t});break;
  }
  const flavoured=text!==before;
  // the home ground's own voice (its kickoff, a home goal, a home win)
  const on:HomeOn|null=x.kind==='kickoff'?'kickoff':(x.kind==='goal'||x.kind==='own_goal')&&x.side===0?'goal':x.kind==='end'&&x.score[0]>x.score[1]?'win':null;
  const own=(on&&homeLines?(homeLines[on]??[]):[]).filter(l=>!homeSaid.has(l));
  if(own.length&&!flavoured&&(on!=='goal'||(homeGoals<AT_HOME_GOALS&&hash(`${matchId}|${x.id}|home`)%2===0))){
   const said=own[hash(`${matchId}|${x.id}|home|${on}`)%own.length];homeSaid.add(said);
   text=`${text} ${said}`;if(on==='goal')homeGoals++;}
  out.push({id:x.id,at,text,incident:x,portrait:x.portrait});
  prev=at;
 }
 return out;
}
/** Lines a viewer at t (ms) may see. */
export function linesUntil(lines:Line[],tMs:number){let lo=0,hi=lines.length;while(lo<hi){const m=(lo+hi)>>1;if(lines[m].at<=tMs)lo=m+1;else hi=m;}return lines.slice(0,lo);}

// ---------- the post-match report ----------
export interface Report {headline:string;paragraphs:string[]}
export interface ReportIdeas {side:0|1;outcome:'ok'|'partly'|'x'|'faint'}
/** A short written summary from the incidents (after full time only). */
export function matchReport(incidents:Incident[],matchId:string,header:Header,shots:[number,number],ideas:ReportIdeas[]=[]):Report{
 const r=(key:string,slots:Record<string,string|undefined>)=>{const list=REPORT[key]??[];return list.length?fill(list[hash(`${matchId}|report|${key}`)%list.length],slots)??'':'';};
 const name=(i:number|undefined)=>i===undefined?undefined:header.players[i]?.name;
 const goals=incidents.filter(x=>x.kind==='goal'||x.kind==='own_goal');
 const end=incidents.find(x=>x.kind==='end');
 const final=end?.score??goals.at(-1)?.score??[0,0];
 const base={home:header.teams[0].name,away:header.teams[1].name,score:`${final[0]}–${final[1]}`};
 const winner=final[0]===final[1]?null:final[0]>final[1]?0:1;
 const club=winner===null?undefined:header.teams[winner].name;
 const trailed=winner!==null&&goals.some(g=>g.score[1-winner]>g.score[winner]);
 const headline=winner===null?r(final[0]===0?'head_goalless':'head_draw',base)
  :trailed?r('head_comeback',{...base,club}):Math.abs(final[0]-final[1])>=4?r('head_rout',{...base,club}):r('head_win',{...base,club});
 const paragraphs:string[]=[];
 // Turning points.
 const turns:string[]=[];
 const first=goals[0];
 if(first)turns.push(first.kind==='own_goal'?r('first_own',{min:minOf(first)}):r('first_goal',{player:name(first.actors[0]),min:minOf(first),club:first.side===null?undefined:header.teams[first.side].name}));
 if(winner!==null){
  // The goal after which the winner led for good.
  let decisive:Incident|undefined;
  for(const g of goals){if(g.score[winner]>g.score[1-winner]){if(!decisive)decisive=g;}else decisive=undefined;}
  if(decisive&&decisive!==first&&decisive.side===winner&&decisive.kind==='goal')turns.push(r('turn_lead',{player:name(decisive.actors[0]),club,min:minOf(decisive),score:`${decisive.score[0]}–${decisive.score[1]}`}));
 }
 const late=goals.filter(g=>g.facts.late&&g.kind==='goal').at(-1);
 if(late)turns.push(r('late',{player:name(late.actors[0]),min:minOf(late),score:`${late.score[0]}–${late.score[1]}`}));
 if(turns.length)paragraphs.push(turns.join(' '));
 // Player moments.
 const count=(xs:Incident[],pickActor:(x:Incident)=>number|undefined)=>{const m=new Map<number,number>();for(const x of xs){const a=pickActor(x);if(a!==undefined)m.set(a,(m.get(a)??0)+1);}return [...m].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);};
 const moments:string[]=[];
 const top=count(goals.filter(g=>g.kind==='goal'),g=>g.actors[0])[0];
 if(top&&top[1]>=2)moments.push(r(top[1]===3?'hat_trick':'top_scorer',{player:name(top[0]),n:String(top[1])}));
 const assist=count(goals.filter(g=>g.kind==='goal'),g=>g.facts.assist)[0];
 if(assist&&assist[1]>=2)moments.push(r('assists',{player:name(assist[0]),n:String(assist[1])}));
 const keeper=count(incidents.filter(x=>x.kind==='save'),x=>x.actors[0])[0];
 if(keeper&&keeper[1]>=3)moments.push(r('keeper',{player:name(keeper[0]),n:String(keeper[1])}));
 const dribbler=count(incidents.filter(x=>x.kind==='beat'),x=>x.actors[0])[0];
 if(dribbler&&dribbler[1]>=3)moments.push(r('dribbler',{player:name(dribbler[0]),n:String(dribbler[1])}));
 if(moments.length)paragraphs.push(moments.join(' '));
 // Idea record + shots.
 const rec:string[]=[];
 const ok=[0,1].map(s=>ideas.filter(i=>i.side===s&&i.outcome==='ok').length);
 const tried=ideas.some(i=>i.outcome!=='faint');
 if(tried){if(!ok[0]&&!ok[1])rec.push(r('ideas_none',{}));else [0,1].forEach(s=>{if(ok[s])rec.push(r('ideas',{club:header.teams[s].name,n:String(ok[s])}));});}
 rec.push(r('shots',{...base,first:String(shots[0]),second:String(shots[1])}));
 paragraphs.push(rec.join(' '));
 return {headline,paragraphs:paragraphs.filter(Boolean)};
}
