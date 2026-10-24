// A tab's practice runs against one opponent (owner, 4 Oct): every setup's
// runs for this club + opponent + engine build, kept in sessionStorage so they
// survive going to edit the plan and coming back within the tab. Nothing is
// stored server-side; a closed tab forgets. Every storage touch is wrapped:
// private windows, full or blocked storage just mean the page keeps the runs
// in memory for as long as it is open (the caller holds the book in state).
// Also the tab's own timing (milliseconds of wall time per simulated second),
// for the "about N minutes" before a batch.
// Each run keeps only its small numbers (score, good chances, possession,
// passes, shots, balls won in their half: under 100 bytes), so the averages
// count every run of a setup; the replays themselves stay in the page's
// memory, the latest KEEP_REPLAYS kick-offs only (owner, 4 Oct: "not sure I
// want a huge list of 40 individual runs"). Since batches go to 20 (owner, 19
// Oct) a whole batch stays watchable, but the strip shows the newest
// NEWEST_CHIPS and keeps the rest one tap away ("the option should exist, but
// shouldn't be thrown at you unless you want to look at an older game").
import {setupKey} from './practice-tally';
import type {FrozenInput} from './compute';

/** One run's numbers you v them, [yours, theirs] each: possession % (as the run shows it), passes completed and tried, shots, balls won in their half. */
export interface RunStats {pos:[number,number];pc:[number,number];pa:[number,number];shots:[number,number];won:[number,number]}
/** One run of one setup: its score and good chances [yours, theirs] (null when unread); `id`
 * names its kick-off (the seed, base 36) so a kept replay can be found; `s` its numbers
 * (both absent on runs recorded before they were kept). */
export interface RunFacts {gf:number;ga:number;c:[number,number]|null;id?:string;s?:RunStats}
export interface SetupRuns {key:string;name:string;formation:string;style:string;base:boolean;duration:number;
 /** Order of first play in this tab (labels "earlier" / "now"). */ first:number;
 /** Order of the latest run (the setup on screen is the latest). */ last:number;
 runs:RunFacts[]}
export interface Book {v:1;setups:SetupRuns[]}
export const emptyBook=():Book=>({v:1,setups:[]});

/** At most this many setups per opponent, and runs per setup, are kept (the oldest go first).
 * 100 runs (owner, 16 Oct: up to 20 kick-offs a go) is about 10 KB a setup, 80 KB a full book. */
export const MAX_SETUPS=8,MAX_RUNS=100;

export const bookKey=(club:string,opp:string,build:string)=>`ballers:practice:v1:${club}:${opp}:${build.slice(0,8)}`;
const PACE_KEY='ballers:practice:pace';

function storage():Storage|null{try{return typeof window==='undefined'?null:window.sessionStorage;}catch{return null;}}

const isPair=(p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0);
const isStats=(s:unknown):s is RunStats=>{const x=s as RunStats;return !!x&&typeof x==='object'&&isPair(x.pos)&&isPair(x.pc)&&isPair(x.pa)&&isPair(x.shots)&&isPair(x.won);};
const isFacts=(r:unknown):r is RunFacts=>{const x=r as RunFacts;return !!x&&Number.isInteger(x.gf)&&Number.isInteger(x.ga)&&(x.c===null||(Array.isArray(x.c)&&x.c.length===2&&x.c.every(Number.isFinite)))
 &&(x.id===undefined||typeof x.id==='string')&&(x.s===undefined||isStats(x.s));};
const isSetup=(s:unknown):s is SetupRuns=>{const x=s as SetupRuns;return !!x&&typeof x.key==='string'&&typeof x.name==='string'&&typeof x.formation==='string'&&typeof x.style==='string'&&Number.isFinite(x.duration)&&Number.isFinite(x.first)&&Number.isFinite(x.last)&&Array.isArray(x.runs)&&x.runs.every(isFacts);};

/** The tab's book for this club + opponent + build; empty when there is none or it can't be read. */
export function loadBook(key:string):Book{
 try{
  const raw=storage()?.getItem(key);if(!raw)return emptyBook();
  const b=JSON.parse(raw) as Book;
  if(b?.v!==1||!Array.isArray(b.setups))return emptyBook();
  return {v:1,setups:b.setups.filter(isSetup).slice(-MAX_SETUPS).map(x=>({...x,runs:x.runs.slice(-MAX_RUNS)}))};
 }catch{return emptyBook();}
}
/** Writes the book; false when storage refused (the page keeps it in memory). */
export function saveBook(key:string,book:Book):boolean{
 try{const s=storage();if(!s)return false;s.setItem(key,JSON.stringify(book));return true;}catch{return false;}
}

/** The setup a version played: its frozen input without seed or match id, and
 * which version it was (a plan id, or 'base'), so two plans that happen to
 * freeze to the same input stay two setups. */
export const versionKey=(input:FrozenInput,version:string)=>setupKey([input],version);

/** The book after one more run of `setup` (pure). */
export function addToBook(book:Book,setup:Omit<SetupRuns,'runs'|'first'|'last'>,run:RunFacts):Book{
 const clock=book.setups.reduce((m,s)=>Math.max(m,s.first,s.last),0)+1;
 const prev=book.setups.find(s=>s.key===setup.key);
 const next:SetupRuns=prev?{...prev,...setup,first:prev.first,last:clock,runs:[...prev.runs,run].slice(-MAX_RUNS)}:{...setup,first:clock,last:clock,runs:[run]};
 const setups=[...book.setups.filter(s=>s.key!==setup.key),next].sort((a,b)=>a.first-b.first);
 // too many: drop the setups played longest ago
 while(setups.length>MAX_SETUPS){let o=0;for(let i=1;i<setups.length;i++)if(setups[i].last<setups[o].last)o=i;setups.splice(o,1);}
 return {v:1,setups};
}

// ------------------------------------------------------------------ replays kept
/** At most this many kick-offs keep their replay in the page (each one's versions: two when "also play it as").
 * 20 = a whole batch at MAX_RUNS (owner, 19 Oct: "keep 20, but show the newest 5"); about 1 MB each. */
export const KEEP_REPLAYS=20;
/** The watchable runs the strip shows until the player asks for the earlier ones. */
export const NEWEST_CHIPS=5;
/** The kept list after one more kick-off arrives: the newest `max`, oldest dropped first (pure). */
export function retain<T>(kept:readonly T[],add:T,max:number=KEEP_REPLAYS):T[]{return [...kept,add].slice(-Math.max(1,max));}

export interface RunChip {
 /** Its place in the setup's runs (0 = the first). */ i:number;
 gf:number;ga:number;
 /** Its kick-off, when its replay is still kept here (selectable); null for a result only. */ id:string|null}
/** The setup's runs as chips: the latest `show` of them, each selectable when its replay is
 * kept, and how many earlier runs are left off the strip (they still count in the totals). */
export function runChips(runs:readonly RunFacts[],kept:ReadonlySet<string>,show=15):{earlier:number;chips:RunChip[]}{
 const from=Math.max(0,runs.length-show);
 return {earlier:from,chips:runs.slice(from).map((r,k)=>({i:from+k,gf:r.gf,ga:r.ga,id:r.id&&kept.has(r.id)?r.id:null}))};
}

/** Which watchable chips the strip shows (pure). Open: all of them. Shut: the newest `newest`, plus the one
 * on screen when it is older (a run you picked stays in sight). `earlier` is how many sit before the newest
 * (0: no control at all); `hidden` how many the shut strip leaves out. One chip to spare is shown rather
 * than hidden behind a control as big as itself. */
export function chipsShown<C extends {id:string|null}>(chips:readonly C[],open:boolean,onScreen:string|null,newest=NEWEST_CHIPS):{shown:C[];earlier:number;hidden:number}{
 const earlier=chips.length>newest+1?chips.length-newest:0;
 if(!earlier||open)return {shown:[...chips],earlier,hidden:0};
 const shown=chips.filter((c,k)=>k>=earlier||(c.id!==null&&c.id===onScreen));
 return {shown,earlier,hidden:chips.length-shown.length};
}

/** Wall milliseconds per simulated second of one match on this device, as last measured in this
 * tab with `together` matches playing at once (a batch side by side: each match is slower, the
 * batch faster); one at a time keeps the key it always had. */
const paceKey=(together:number)=>together>1?`${PACE_KEY}:${together}`:PACE_KEY;
export function loadPace(together=1):number|null{
 try{const v=Number(storage()?.getItem(paceKey(together)));return Number.isFinite(v)&&v>0?v:null;}catch{return null;}
}
export function savePace(msPerSecond:number,together=1){
 try{if(Number.isFinite(msPerSecond)&&msPerSecond>0)storage()?.setItem(paceKey(together),String(Math.round(msPerSecond*100)/100));}catch{/* the estimate falls back to "N times as long" */}
}

// ------------------------------------------------------------------ their five, picked (owner, 24 Oct)
/** The practising player's pick of an opponent's five, this tab only (lib/ballers/practice-opponent.ts): it survives
 * a look at a player's page and back, and never leaves the browser. Null when none is kept or it can't be read. */
const fiveKey=(club:string,opp:string)=>`ballers:practice:their5:v1:${club}:${opp}`;
export function loadTheirFive(club:string,opp:string):string[]|null{
 try{
  const raw=storage()?.getItem(fiveKey(club,opp));if(!raw)return null;
  const v=JSON.parse(raw) as unknown;
  return Array.isArray(v)&&v.length===5&&v.every(id=>typeof id==='string')&&new Set(v).size===5?v as string[]:null;
 }catch{return null;}
}
/** Keeps the pick (null forgets it); false when storage refused (the page keeps it in memory). */
export function saveTheirFive(club:string,opp:string,five:readonly string[]|null):boolean{
 try{const s=storage();if(!s)return false;if(five)s.setItem(fiveKey(club,opp),JSON.stringify(five));else s.removeItem(fiveKey(club,opp));return true;}catch{return false;}
}
/** The book's opponent for a picked five: its own book, so runs against it never mix with runs against their own. */
export const bookOpponent=(opp:string,five:readonly string[]|null)=>five?`${opp}~${five.map(id=>id.slice(0,8)).join('')}`:opp;
