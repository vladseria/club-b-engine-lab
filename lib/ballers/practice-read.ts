// What a practice shows (owner, 4 Oct; ENGINE-PLANS-MATTER §3b "What practice
// is for"): a rehearsal, not a crystal ball.
//  - Every run: how you played, you v them in that same match (possession,
//    passes completed, shots, good chances, balls won in their half). How a
//    plan plays shows in one run.
//  - Across runs of one setup: the same numbers as averages a match, you v
//    them in the same runs (every run of the setup, not just the replays
//    kept), and good chances a match with a confidence word on the difference. The result a plan earns needs about
//    20 runs, so the word stays modest until the runs say otherwise.
//  - Across setups against the same opponent: each setup's good chances a
//    match with its run count, and a confidence word on the difference.
// Every number has an anchor from the player's own runs; no league norms, no
// odds, no percentages of winning.
//
// Confidence words, on the mean difference d over n runs and its standard
// error se = s / sqrt(n), where s = max(the runs' own sd, the floor). The
// floor is the per-match sd of the chance difference between kick-offs of one
// fixed setup, measured with the table (chances-table.ts sdDiff, about 2 for
// a full match), scaled by sqrt(length / 900) for a shorter match: a 2-run
// sample sd means nothing, so a small sample can never look surer than the
// engine's own spread allows.
//   1 run           no verdict ("One run: too early to read.")
//   |d| < 1 se      "not sure yet"
//   1-2 se          "leaning your way / their way, not sure yet"
//   >= 2 se         "fairly sure"
// Pure: no I/O, no React (storage lives in practice-store.ts).
import {CHANCE_TABLE,chanceText,matchChances,type ChanceTable} from './chances';
import type {CompactMatch,ReplayFrame} from './replay';
import type {RunFacts,RunStats,SetupRuns} from './practice-store';

// ------------------------------------------------------------------ one run
/** Pitch length in cm (packages/football-engine/src/pitch.ts L = 48 m); side 0 attacks x = L the whole match. */
export const PITCH_CM=4800;

/** Times each side won the ball in the other side's half: open play only (a
 * change of the side in possession between two live frames, never a restart
 * or a camera cut), where the ball was at that moment. */
export function wonInTheirHalf(frames:readonly Pick<ReplayFrame,'ps'|'b'|'r'|'c'>[]):[number,number]{
 const n:[number,number]=[0,0];
 for(let i=1;i<frames.length;i++){
  const a=frames[i-1],f=frames[i];
  if(f.ps===a.ps||f.r||a.r||f.c||(f.ps!==0&&f.ps!==1))continue;
  if(f.ps===0?f.b[0]>PITCH_CM/2:f.b[0]<PITCH_CM/2)n[f.ps]++;
 }
 return n;
}

export type RowKey='possession'|'passes'|'shots'|'chances'|'won';
export interface PlayedRow {key:RowKey;label:string;us:number;them:number;
 /** What the player reads ("58", "3.4", "12"; the label carries any "%"). */ text:[string,string]}

/** One run's numbers you v them (kept per run in the tab's book, so averages count every run). `side` = yours. */
export function runStatsOf(c:Pick<CompactMatch,'stats'|'chunks'>,side:0|1):RunStats{
 const them=(1-side) as 0|1,[a,b]=[c.stats[side],c.stats[them]];
 const pos=a.possession+b.possession,pct=(x:number)=>pos>0?Math.round(x/pos*100):0;
 const won=wonInTheirHalf(c.chunks.flatMap(ch=>ch.f));
 return {pos:[pct(a.possession),pct(b.possession)],pc:[a.completed,b.completed],pa:[a.passes,b.passes],shots:[a.shots,b.shots],won:[won[side],won[them]]};
}

const pctOf=(done:number,tried:number)=>tried>0?Math.round(done/tried*100):0;
/** The rows, in the order the page reads them, from one run's numbers (or averages: the same arithmetic). */
function rowsOf(st:RunStats,chances:[number,number]|null,count:(v:number)=>string):PlayedRow[]{
 const rows:PlayedRow[]=[];
 const add=(key:RowKey,label:string,us:number,th:number,fmt:(v:number)=>string)=>rows.push({key,label,us,them:th,text:[fmt(us),fmt(th)]});
 add('possession','Possession %',st.pos[0],st.pos[1],v=>String(Math.round(v)));
 // A side that passed nothing has no completion rate: no row rather than a made-up 0%.
 if(st.pa[0]>0&&st.pa[1]>0)add('passes','Passes completed %',pctOf(st.pc[0],st.pa[0]),pctOf(st.pc[1],st.pa[1]),String);
 add('shots','Shots',st.shots[0],st.shots[1],count);
 if(chances)add('chances','Good chances',chances[0],chances[1],chanceText);
 add('won','Won the ball in their half',st.won[0],st.won[1],count);
 return rows;
}

/** How you played in one run, you v them in that match. `side` = yours. The
 * good chances row is left out when the run can't be read on the table's build. */
export function howYouPlayed(c:Pick<CompactMatch,'stats'|'chunks'|'header'>,side:0|1,build:string|null|undefined,table:ChanceTable=CHANCE_TABLE):PlayedRow[]{
 const events=c.chunks.flatMap(ch=>ch.e),ch=matchChances(events,c.header,build,table);
 return rowsOf(runStatsOf(c,side),ch?[ch[side],ch[1-side]]:null,String);
}

/** Averages a match over a setup's runs, you v them in the same runs: possession,
 * shots and balls won as means of the runs; passes completed as all the passes
 * completed over all tried (a match with few passes weighs less); good chances
 * over the runs that have them. `n` = the runs the numbers come from; `nChances`
 * when good chances come from fewer (a run that couldn't be read). Null with no
 * numbers at all. */
export function averagesOf(runs:readonly Pick<RunFacts,'s'|'c'>[]):{n:number;nChances:number;rows:PlayedRow[]}|null{
 const st=runs.flatMap(r=>r.s?[r.s]:[]),ch=runs.flatMap(r=>r.c?[r.c]:[]);
 if(!st.length)return null;
 const n=st.length,sum=(f:(x:RunStats)=>[number,number]):[number,number]=>st.reduce<[number,number]>((a,x)=>{const v=f(x);return [a[0]+v[0],a[1]+v[1]];},[0,0]);
 const mean=(f:(x:RunStats)=>[number,number]):[number,number]=>{const v=sum(f);return [v[0]/n,v[1]/n];};
 // possession shares add up to 100: yours rounded, theirs the rest (never 53 v 48)
 const us=Math.round(mean(x=>x.pos)[0]);
 const avg:RunStats={pos:[us,100-us],pc:sum(x=>x.pc),pa:sum(x=>x.pa),shots:mean(x=>x.shots),won:mean(x=>x.won)};
 const chances:[number,number]|null=ch.length?[ch.reduce((a,c)=>a+c[0],0)/ch.length,ch.reduce((a,c)=>a+c[1],0)/ch.length]:null;
 return {n,nChances:ch.length,rows:rowsOf(avg,chances,chanceText)};
}

// ------------------------------------------------------------------ confidence
export type Band='early'|'unsure'|'leaning'|'sure';
export interface Read {n:number;mean:number;se:number;band:Band;
 /** The direction as the player reads it: the mean rounded to one decimal (0 = level). */ dir:-1|0|1}

const mean=(xs:readonly number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
/** Sample sd (n - 1); 0 for fewer than two values. */
export function sd(xs:readonly number[]):number{
 if(xs.length<2)return 0;
 const m=mean(xs);return Math.sqrt(xs.reduce((a,x)=>a+(x-m)**2,0)/(xs.length-1));
}
/** The floor for one match of `duration` seconds (the full match's sd scaled by sqrt of the length). */
export const floorFor=(duration:number,table:ChanceTable=CHANCE_TABLE)=>table.sdDiff*Math.sqrt(Math.max(60,Math.min(900,duration))/900);
const round1=(v:number)=>Math.round(v*10)/10;
const dirOf=(m:number):-1|0|1=>{const r=round1(m);return r>0?1:r<0?-1:0;};
const bandOf=(m:number,se:number):Band=>{
 // a mean that reads as 0.0 never leans, however small the se
 if(dirOf(m)===0)return 'unsure';
 const z=Math.abs(m)/se;return z<1?'unsure':z<2?'leaning':'sure';
};

/** Your runs of one setup: each run's (your good chances - theirs). */
export function readOf(diffs:readonly number[],floor:number):Read{
 const n=diffs.length;
 if(!n)return {n,mean:0,se:Infinity,band:'early',dir:0};
 const m=mean(diffs);
 if(n<2)return {n,mean:m,se:Infinity,band:'early',dir:dirOf(m)};
 const se=Math.max(sd(diffs),floor)/Math.sqrt(n);
 return {n,mean:m,se,band:bandOf(m,se),dir:dirOf(m)};
}
/** Two setups against the same opponent: A's per-run differences against B's.
 * The read is on (A's mean - B's mean); each side's spread floored. Early
 * while either has a single run. */
export function compareOf(a:readonly number[],b:readonly number[],floor:number):Read{
 const n=Math.min(a.length,b.length);
 if(!a.length||!b.length)return {n,mean:0,se:Infinity,band:'early',dir:0};
 const m=mean(a)-mean(b);
 if(n<2)return {n,mean:m,se:Infinity,band:'early',dir:dirOf(m)};
 const sa=Math.max(sd(a),floor),sb=Math.max(sd(b),floor);
 const se=Math.sqrt(sa*sa/a.length+sb*sb/b.length);
 return {n,mean:m,se,band:bandOf(m,se),dir:dirOf(m)};
}

/** The read as the player can check it: its amount is the difference of the two
 * numbers on screen (each rounded to one decimal first), so "1.4 v 2.2" reads
 * "about 0.8", never 0.9; the band stays the one measured on the runs, and a
 * difference that shows as level never leans. */
export function asShown(r:Read,shownDiff:number):Read{
 if(r.band==='early')return r;
 const m=round1(shownDiff),dir=dirOf(m);
 return {...r,mean:m,dir,band:dir===0?'unsure':r.band};
}
/** The difference of two one-decimal numbers as they are shown. */
export const shownDiff=(a:number,b:number)=>round1(round1(a)-round1(b));

// ------------------------------------------------------------------ words
/** A per-match difference with its sign ("+0.5", "−0.4", "0.0"). */
export const signed=(v:number)=>{const r=round1(v);return r>0?`+${r.toFixed(1)}`:r<0?`−${Math.abs(r).toFixed(1)}`:'0.0';};
/** "1", "1.2", "0.4": one decimal, a whole number without its ".0". */
export const amount=(v:number)=>{const r=round1(Math.abs(v));return Number.isInteger(r)?String(r):r.toFixed(1);};
const chancesWord=(v:number)=>amount(v)==='1'?'good chance':'good chances';
const runsWord=(n:number)=>n===1?'1 run':`${n} runs`;

/** The across-runs read of one setup, as one sentence. */
export function readWords(r:Read):string{
 if(r.band==='early')return r.n?'One run: too early to read.':'';
 const what=r.dir>0?`you’re making about ${amount(r.mean)} more ${chancesWord(r.mean)} a match than they are`
  :r.dir<0?`they’re making about ${amount(r.mean)} more ${chancesWord(r.mean)} a match than you are`
  :'your good chances a match and theirs are about level';
 const sure=r.band==='sure'?'fairly sure':r.band==='leaning'?`leaning ${r.dir>0?'your':'their'} way, not sure yet`:'not sure yet';
 return `After ${runsWord(r.n)}: ${what}, ${sure}.`;
}
/** Two setups compared, as one sentence: `a` is the one on screen. */
export function compareWords(r:Read,a:string,b:string,aRuns:number,bRuns:number):string{
 if(r.band==='early'){const one=aRuns<2?a:b;return `Too early to compare: ${one} has ${aRuns<2?runsWord(aRuns):runsWord(bRuns)}.`;}
 const [ahead,behind]=r.dir>=0?[a,b]:[b,a];
 const what=r.dir===0?`${a} and ${b} come out about level`:`${ahead} comes out about ${amount(r.mean)} ${chancesWord(r.mean)} a match ahead of ${behind}`;
 const sure=r.band==='sure'?'fairly sure':r.band==='leaning'?`leaning towards ${ahead}, not sure yet`:'not sure yet';
 const s=`${what}, ${sure}.`;return s[0].toUpperCase()+s.slice(1);
}

// ------------------------------------------------------------------ batches
/** How long `total` kick-offs of `matches` matches each take here, in words; a multiple of one run when the tab hasn't timed one yet. */
export function batchWords(total:number,matches:number,duration:number,pace:number|null){
 if(pace===null)return `${total} runs play one after another: about ${total} times as long as one.`;
 const min=total*matches*duration*pace/60000;
 return `${total} runs play one after another: ${min<1?'under a minute':`about ${longWords(min)}`} on this device.`;
}
/** Minutes in words: "7 minutes"; from an hour, to the nearest 5 minutes ("1 hour 15 minutes", "2 hours"). */
function longWords(min:number){
 const m=Math.round(min);
 if(m<60)return `${m} minute${m===1?'':'s'}`;
 const five=Math.round(min/5)*5,h=Math.floor(five/60),rest=five%60;
 return `${h} hour${h===1?'':'s'}${rest?` ${rest} minutes`:''}`;
}

// ------------------------------------------------------------------ names
/** Labels for the setups: the plan's name, then what differs (formation and
 * style), then which is on screen ("now") and which came before. */
export function setupLabels(setups:readonly SetupRuns[],current:string,styleName:(style:string)=>string=s=>s):Map<string,string>{
 const out=new Map<string,string>();
 const what=(s:SetupRuns)=>`${s.formation} · ${styleName(s.style)}`;
 for(const s of setups){
  const same=setups.filter(x=>x.name===s.name);
  let label=s.name;
  if(same.length>1){
   const sameWhat=same.filter(x=>what(x)===what(s));
   const bits=sameWhat.length<same.length?[what(s)]:[];
   if(sameWhat.length>1){
    const earlier=sameWhat.filter(x=>x.key!==current).sort((a,b)=>a.first-b.first);
    const k=earlier.findIndex(x=>x.key===s.key);
    bits.push(s.key===current?'now':earlier.length>1?`earlier ${k+1}`:'earlier');
   }
   if(bits.length)label=`${s.name} (${bits.join(', ')})`;
  }
  out.set(s.key,label);
 }
 return out;
}
