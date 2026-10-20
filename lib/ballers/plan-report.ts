// How the plan played (TECH-SPEC §6.4; BUILD-PLAN WP6), rebuilt thin (Vlad,
// 2 Oct; deliverables/ballers-redesign/game-plan/REPORT-FEASIBILITY.md). Pure,
// computed in the browser from what Watch already loads (the replay's frames
// and events, the match's move markers with the owner's names, the prep's
// plan_snapshot) plus league rows the page already has (skills, results).
//
// Honest but thin: it says only what holds whatever the engine's calibration.
//  - Squads on paper: the two starting fives' skills, in three words (level /
//    slightly / clearly stronger). No odds.
//  - Against your own season: at most three things this match is your most or
//    fewest of, only with three or more earlier matches of the same season.
//  - Your moves in words, each with a way into Watch at its first go.
//  - Moments to watch: every goal, and the closest chances that didn't go in.
//  - At most one suggestion, only when this match shows it, with its action.
//  - Good chances (owner, 4 Oct): "you X.X, them Y.Y" beside the score, from
//    the engine's own read of each shot (stored on the replay's shot events
//    from 4 Oct) turned into a goal chance by a table calibrated per engine
//    build (lib/ballers/chances.ts). Anchored by the opponent in the same
//    match only; shown only when the match's build is the table's and every
//    shot carries its read, else nothing at all (no placeholder).
// Never: league-wide norms, odds, the word "xG", style matchups, "lucky",
// per-phase counts, or a claim that tactics caused the result.
//
// Spoilers: callers build a report only for a match past its full time
// (`reportOpen`, from the RESULT row's visible_from — never a replay chunk's
// or a marker's, which run on the broadcast clock; REVIEW-WP0 S5).
import {phaseAt,phaseLabels,phaseRuns} from './phase';
import {MOVES_ON} from './moves-off';
import {followUp,emptyTally,runWord,tallyStarts,type MoveTally,type RunWord} from './result-words';
import {pastFullTime} from './spoilers';
import {matchChances} from './chances';
import type {IdeaName,Marker} from './ideas';
import type {IdeaRun} from './idea-run';
import type {ReplayEvent,ReplayFrame,ReplayHeader} from './replay';
import type {PlanSnapshot} from './plans';

/** The report opens at the match's official full time (the result row), never before. */
export const reportOpen=(result:{visible_from:string|null|undefined}|null|undefined,now=Date.now())=>!!result&&pastFullTime(result,now);

// ------------------------------------------------------------------ inputs
export interface ReportInput {
 header:Pick<ReplayHeader,'duration'|'players'|'teams'>;
 frames:readonly Pick<ReplayFrame,'t'|'ps'|'b'|'r'>[];
 events:readonly ReplayEvent[];
 /** Your side in this match. */
 side:0|1;
 /** Public markers (unnamed) and your own name rows (owner-only). */
 markers:readonly Marker[];names:readonly IdeaName[];
 /** What the prep played: the plan snapshot (null = before plans). */
 snapshot:PlanSnapshot|null|undefined;
 /** The engine build the match was played on (the stored header's); good chances need the table's. */
 build?:string|null;
}

// ------------------------------------------------------------------ output
export type ReportKind='plan'|'before'|'custom';
export interface MoveReport {key:string;name:string;tally:MoveTally;
 /** Goals it led to, each counted once (the tally counts goes). */ goals:number;
 /** In the plan but never came up this match. */ quiet:boolean;
 /** When it first came up (seconds), for "Watch the goes"; null when it never did. */ first:number|null}
/** One plan as it played. A match plays one today; a match that switches
 * plans will carry a second, so the page renders a list. */
export interface PlanPart {name:string|null;moves:MoveReport[]}
export interface GoalMark {t:number;side:0|1;us:boolean;label:string;
 /** Your named move that led to it (its latest go within 10 s before, before the ball changed sides). */ move?:string;moveKey?:string}
export interface Moment {t:number;kind:'goal'|'chance';us:boolean;word:string;label:string}
export interface Suggestion {before:string;bold:string;after:string;act:'band-with'|'band-without'|'plans';actLabel:string}
export interface PlanReport {
 kind:ReportKind;
 duration:number;
 goals:GoalMark[];
 plans:PlanPart[];
 moments:Moment[];
 suggestion:Suggestion|null;
 /** Good chances [yours, theirs]; null when the match can't be read (another build, or a replay from before shot reads). */
 chances:[number,number]|null;
}

// ------------------------------------------------------------------ words
const WORDS=['no','one','two','three','four','five','six','seven','eight','nine','ten'];
const numWord=(n:number)=>n>=0&&n<WORDS.length?WORDS[n]:String(n);
const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
const list=(xs:string[])=>xs.length<2?xs.join(''):`${xs.slice(0,-1).join(', ')} and ${xs.at(-1)}`;
export const timesWord=(n:number)=>n===1?'once':n===2?'twice':`${n} times`;
/** k of n goes, in words where a word is exact: all / both / half. */
const share=(k:number,n:number)=>k===n?(n===2?'both':'all'):String(k);

/** One move's result, in plain words, after "<name> came up N times: ".
 * `goals` = the goals it led to, each goal once (two goes before the same goal
 * are one goal; GoalMark.move); defaults to the tally's goes that led to one. */
export function moveWords(t:MoveTally,goals=t.goal):string{
 const n=t.tried;
 if(n===1){
  const how=t.to_plan?'it went to plan':'it didn’t go to plan';
  return `${how}${goals?' and led to a goal':t.shot?' and led to a shot':t.lost?' and lost the ball within 5 seconds':''}.`;
 }
 const bits=[t.to_plan?`${share(t.to_plan,n)} went to plan`:'none went to plan'];
 if(t.shot)bits.push(`${share(t.shot,n)} led to a shot${goals?` (${goals===1?'one goal':`${goals} goals`})`:''}`);
 if(t.lost)bits.push(`${share(t.lost,n)} lost the ball within 5 seconds`);
 else if(n>=4)bits.push('none lost the ball within 5 seconds');
 return `${list(bits)}.`;
}

// ------------------------------------------------------------------ moves
/** Your named starts, grouped by move: the plan's moves in plan order (also
 * the ones that never came up), then anything else that played, in order of
 * first use. No cap: a fourth move never vanishes (PARITY W-45). */
export function moveStarts(input:Pick<ReportInput,'markers'|'names'|'side'|'snapshot'>){
 const byseq=new Map(input.names.map(n=>[n.seq,n]));
 const groups:{key:string;name:string;starts:(Marker&{run?:IdeaRun|null})[];quiet:boolean}[]=[];
 const snap=input.snapshot&&!input.snapshot.detached?input.snapshot:null;
 for(const m of snap?.moves??[])groups.push({key:m.key,name:m.name,starts:[],quiet:true});
 for(const m of input.markers){
  if(m.side!==input.side||m.free)continue;
  const n=byseq.get(m.seq);
  const key=n?.plan_key??n?.name??'(yours)';
  let g=groups.find(x=>x.key===key);
  if(!g){g={key,name:n?.name??'Your moves',starts:[],quiet:true};groups.push(g);}
  g.quiet=false;
  g.starts.push({...m,run:n?.detail?.run??m.run??null});
 }
 return groups;
}

// ------------------------------------------------------------------ moments
/** A chance worth watching: a shot that didn't go in, from this close (metres). */
export const CLOSE_M=6;
/** At most this many chances beside the goals: the list stays short. */
export const CHANCES=3;
const OUTCOME:Record<string,string>={save:'saved',block:'blocked',out:'wide'};

// ------------------------------------------------------------------ the report
export function buildReport(input:ReportInput):PlanReport{
 const {frames,events,side,header}=input,duration=header.duration;
 const kind:ReportKind=input.snapshot?input.snapshot.detached?'custom':'plan':'before';
 const name=(i:number|undefined)=>i===undefined?undefined:header.players[i];
 const groups=moveStarts(input);
 const tallyOf=(starts:{t:number;run?:IdeaRun|null}[])=>tallyStarts(starts.map(s=>({t:s.t*1000,run:s.run})),side,frames as ReplayFrame[],events);
 const snap=input.snapshot&&!input.snapshot.detached?input.snapshot:null;

 // Goals, each with the move of yours that led to it (the latest go before it, if one did).
 const goals:GoalMark[]=events.filter(e=>e.k==='goal').map(e=>{
  const s=(e.s??0) as 0|1,who=name(e.lt??e.a),own=!!who&&who.side!==s,us=s===side;
  let move:{key:string;name:string;t:number}|undefined;
  if(us)for(const g of groups)for(const m of g.starts){
   if(m.t*1000>e.t||e.t-m.t*1000>10000||(move&&move.t>=m.t))continue;
   if(followUp(m.t*1000,side,frames as ReplayFrame[],events).goal)move={key:g.key,name:g.name,t:m.t};
  }
  return {t:e.t/1000,side:s,us,label:who?own?`Own goal by ${who.short}`:who.short:header.teams[s]?.name??'',move:move?.name,moveKey:move?.key};
 });
 const moves:MoveReport[]=groups.map(g=>({key:g.key,name:g.name,tally:g.starts.length?tallyOf(g.starts):emptyTally(),quiet:g.quiet,
  goals:goals.filter(x=>x.moveKey===g.key).length,first:g.starts.length?Math.min(...g.starts.map(s=>s.t)):null}));

 const both=matchChances(events,header,input.build);
 const chances:[number,number]|null=both?[both[side],both[side===0?1:0]]:null;
 return {kind,duration,goals,plans:[{name:snap?.name??null,moves}],moments:momentsOf(goals,events,header,side),suggestion:suggestionOf(input,kind,groups),chances};
}

/** Every goal, then the closest chances that didn't go in (both sides), in match order. */
export function momentsOf(goals:readonly GoalMark[],events:readonly ReplayEvent[],header:Pick<ReplayHeader,'players'>,side:0|1):Moment[]{
 const out:Moment[]=goals.map(g=>({t:g.t,kind:'goal',us:g.us,word:g.us?'Goal':'Their goal',label:g.move?`${g.label} · from ${g.move}`:g.label}));
 const chances:(Moment&{d:number})[]=[];
 for(const [i,e] of events.entries()){
  if(e.k!=='shot'||!e.sh||(e.s!==0&&e.s!==1))continue;
  const d=Math.hypot(e.sh.o[0]-e.sh.a[0],e.sh.o[1])/100;
  if(d>CLOSE_M)continue;
  // What became of it: the next save, block, goal or ball out, before the next shot.
  let end:string|undefined;
  for(const f of events.slice(i+1)){if(f.t>e.t+2500||f.k==='shot')break;if(f.k in OUTCOME||f.k==='goal'){end=f.k;break;}}
  if(end==='goal')continue;
  const who=header.players[e.a??-1]?.short??'';
  const us=e.s===side;
  chances.push({t:e.t/1000,kind:'chance',us,word:us?'Chance':'Their chance',label:`${who} from ${Math.max(1,Math.round(d))} m${end?`, ${OUTCOME[end]}`:''}`,d});
 }
 chances.sort((a,b)=>a.d-b.d||a.t-b.t);
 for(const {d:_d,...c} of chances.slice(0,CHANCES))out.push(c);
 return out.sort((a,b)=>a.t-b.t);
}

/** At most one suggestion, only where this match shows it, always with an
 * action. It states what happened; it never says the tactics caused the result. */
export function suggestionOf(input:ReportInput,kind:ReportKind,groups:ReturnType<typeof moveStarts>):Suggestion|null{
 const {frames,events,side}=input;
 // Their goals within 3 seconds of you losing the ball (the one phase function).
 const labels=phaseLabels(frames as ReplayFrame[],events,side);
 const fromLoss=events.filter(e=>e.k==='goal'&&e.s!==side&&phaseAt(frames,labels,e.t-200)==='loss').length;
 // Moves off (owner, 2 Oct; lib/ballers/moves-off.ts): no line that sends you to a move.
 return lossLine(kind,fromLoss)??(MOVES_ON?moveLine(kind,groups,side,frames as ReplayFrame[],events):null);
}
export function lossLine(kind:ReportKind,fromLoss:number):Suggestion|null{
 if(fromLoss<2)return null;
 return {before:'',bold:`${cap(numWord(fromLoss))} of their goals came within 3 seconds of you losing the ball.`,after:' How your players react when they lose it is one setting.',
  act:kind==='plan'?'band-without':'plans',actLabel:kind==='plan'?'Change Losing the ball':'Open your plans'};
}
/** A move that lost the ball within 5 seconds on at least half of its goes (and more often than it went to plan), with eight goes or more. */
export function moveLine(kind:ReportKind,groups:ReturnType<typeof moveStarts>,side:0|1,frames:readonly ReplayFrame[],events:readonly ReplayEvent[]):Suggestion|null{
 for(const g of groups){
  const n=g.starts.length;if(n<8)continue;
  const lost=g.starts.filter(m=>followUp(m.t*1000,side,frames,events).lost).length;
  const ok=g.starts.filter(m=>runWord(m.run)==='to_plan').length;
  if(lost*2>=n&&lost>ok)return {before:'',bold:`${g.name} lost the ball within 5 seconds more often than it went to plan.`,after:'',
   act:kind==='plan'?'band-with':'plans',actLabel:kind==='plan'?`Open ${g.name}`:'Open your plans'};
 }
 return null;
}

// ------------------------------------------------------------------ squads on paper
/** The skills that rate an outfielder: every skill but keeping. */
const outfieldAvg=(skills:Record<string,number>)=>{const v=Object.entries(skills).filter(([k])=>k!=='keeping').map(([,x])=>x);return v.length?v.reduce((a,b)=>a+b,0)/v.length:NaN;};
/** Outfield-average gaps (skill points): under LEVEL_GAP level, from CLEAR_GAP clearly stronger.
 * A comparison of the two fives' own numbers, nothing measured from the engine; the
 * luck round (2026-10-01) used the same squad comparison. */
export const LEVEL_GAP=.3,CLEAR_GAP=.9,KEEPER_GAP=2;
export interface Five {keeper:{skills:Record<string,number>};outfield:{skills:Record<string,number>}[]}
export interface Paper {band:'level'|'slightly'|'clearly';ahead:'us'|'them'|null;outfield:[number,number];keeper:[number,number];keeperAhead:'us'|'them'|null}
export function onPaper(us:Five,them:Five):Paper|null{
 const avg=(f:Five)=>f.outfield.length?f.outfield.reduce((a,p)=>a+outfieldAvg(p.skills),0)/f.outfield.length:NaN;
 const o:[number,number]=[avg(us),avg(them)],k:[number,number]=[us.keeper.skills.keeping,them.keeper.skills.keeping];
 if(![...o,...k].every(Number.isFinite))return null;
 const gap=o[0]-o[1],kg=k[0]-k[1];
 const band=Math.abs(gap)<LEVEL_GAP?'level':Math.abs(gap)<CLEAR_GAP?'slightly':'clearly';
 return {band,ahead:band==='level'?null:gap>0?'us':'them',outfield:o,keeper:k,keeperAhead:Math.abs(kg)>=KEEPER_GAP?kg>0?'us':'them':null};
}
/** The two starting fives of a match (slot 0 = keeper), from its replay header
 * and the league's players; null when any of the ten isn't there to read. */
export function startingFives(header:Pick<ReplayHeader,'players'>,skillsOf:(id:string)=>Record<string,number>|undefined):[Five,Five]|null{
 const five=(s:0|1):Five|null=>{
  const ps=header.players.filter(p=>p.side===s&&p.slot>=0&&!p.bench).sort((a,b)=>a.slot-b.slot);
  const sk=ps.map(p=>skillsOf(p.id));
  if(ps.length!==5||ps[0].slot!==0||sk.some(x=>!x))return null;
  return {keeper:{skills:sk[0]!},outfield:sk.slice(1).map(x=>({skills:x!}))};
 };
 const a=five(0),b=five(1);return a&&b?[a,b]:null;
}
/** The paper verdict in words: a bold lead and the rest. `them` = the other club's name. */
export function paperWords(p:Paper,them:string):{lead:string;rest:string}{
 const keeper=p.keeperAhead==='us'?'Your keeper rates higher.':p.keeperAhead==='them'?'Their keeper rates higher.':'';
 if(p.band==='level')return p.keeperAhead?{lead:'Level on paper, apart from the keepers.',rest:p.keeperAhead==='us'?'Yours rates higher.':'Theirs rates higher.'}:{lead:'Level on paper.',rest:'Matches like this can go either way.'};
 return {lead:p.ahead==='us'?`You were ${p.band} stronger on paper.`:`${them} were ${p.band} stronger on paper.`,rest:keeper};
}

// ------------------------------------------------------------------ against your own season
export interface SeasonRow {match_id:string;competition_id:string|null;home_club:string;away_club:string;home_goals:number;away_goals:number;stats:[Record<string,number>,Record<string,number>]|null|undefined;visible_from:string}
export interface SeasonFact {value:number;unit:string;dir:'most'|'fewest';scope:string}
/** Earlier matches of the same season it takes before a "most" or "fewest" means anything. */
export const SEASON_MIN_EARLIER=3;
const METRICS:{unit:[string,string];of:(r:SeasonRow,s:0|1)=>number|undefined}[]=[
 {unit:['shot','shots'],of:(r,s)=>r.stats?.[s]?.shots},
 {unit:['shot against','shots against'],of:(r,s)=>r.stats?.[s===0?1:0]?.shots},
 {unit:['goal','goals'],of:(r,s)=>s===0?r.home_goals:r.away_goals},
 {unit:['goal against','goals against'],of:(r,s)=>s===0?r.away_goals:r.home_goals},
];
/** Where this match is your most or fewest of something against your own
 * earlier matches of the same season (ties say nothing): at most `max` facts,
 * none before SEASON_MIN_EARLIER earlier matches. */
export function seasonFacts(rows:readonly SeasonRow[],matchId:string,club:string,max=3):SeasonFact[]{
 const me=rows.find(r=>r.match_id===matchId);
 if(!me?.competition_id)return [];
 const mine=rows.filter(r=>r.competition_id===me.competition_id&&(r.home_club===club||r.away_club===club)).sort((a,b)=>Date.parse(a.visible_from)-Date.parse(b.visible_from));
 const at=mine.findIndex(r=>r.match_id===matchId),earlier=mine.slice(0,at);
 if(earlier.length<SEASON_MIN_EARLIER)return [];
 const side=(r:SeasonRow):0|1=>r.home_club===club?0:1;
 const n=at+1,scope=at<mine.length-1?`your first ${n} matches this season`:`your ${n} matches this season`;
 const out:SeasonFact[]=[];
 for(const m of METRICS){
  const v=m.of(me,side(me)),prev=earlier.map(r=>m.of(r,side(r)));
  if(v===undefined||prev.some(x=>x===undefined))continue;
  const p=prev as number[];
  const dir=v>Math.max(...p)?'most':v<Math.min(...p)?'fewest':null;
  if(dir)out.push({value:v,unit:m.unit[v===1?0:1],dir,scope});
  if(out.length>=max)break;
 }
 return out;
}

// ------------------------------------------------------------------ Watch's timeline
export type LampWord=RunWord|'unknown';
/** One lamp per time a move came up, coloured by how it played (To plan / Half / Broke down). */
export interface LaneLamp {t:number;end:number;word:LampWord;seq:number}
export interface MoveLane {key:string;name:string;lamps:LaneLamp[]}
/** Your moves as Watch lanes, up to `upTo` seconds (live: the playhead). A
 * move that has started but not yet ended by `upTo` is only "Came up": its
 * row already carries how it went, which would tell the result early
 * (review S1). */
export function moveLanes(input:Pick<ReportInput,'markers'|'names'|'side'|'snapshot'>,upTo=Infinity):MoveLane[]{
 return moveStarts(input).filter(g=>g.starts.length).map(g=>({key:g.key,name:g.name,
  lamps:g.starts.filter(m=>m.t<=upTo).map(m=>{const end=m.ended_at??m.t+8;return {t:m.t,end,word:end<=upTo?runWord(m.run)??'unknown':'unknown',seq:m.seq};})}));
}
/** The other side's clues, reduced (PARITY W-48): only the times one of their
 * moves was really tried, never a moment merely spotted, and only once that
 * try has ended by `upTo` (whether it was "really tried" is known only then). */
export const theirClues=(markers:readonly Marker[],side:0|1,upTo=Infinity)=>markers.filter(m=>m.side===side&&!m.free&&(m.ended_at??m.t+8)<=upTo&&(m.progress==='attempted'||m.run==='ran'||m.run==='partly'));

/** Watch's Stats panel before you've seen the end of your own match: only what
 * the replay can count up to `tMs`, so nothing runs ahead of the playhead
 * (W-71). Shots, saves, players beaten and fouls are the engine's own events
 * (they add up to the full-time stats exactly); possession is the share of
 * time each side had the ball. Passes, tackles and turnovers wait for full time. */
export function statsSoFar(frames:readonly Pick<ReplayFrame,'t'|'ps'>[],events:readonly Pick<ReplayEvent,'t'|'k'|'s'>[],tMs:number):[string,number,number][]{
 const count=(k:string)=>{const n:[number,number]=[0,0];for(const e of events){if(e.t>tMs)continue;if(e.k===k&&(e.s===0||e.s===1))n[e.s]++;}return n;};
 const own:[number,number]=[0,0];
 for(let i=1;i<frames.length&&frames[i-1].t<tMs;i++){const a=frames[i-1],dt=Math.min(frames[i].t,tMs)-a.t;if(dt>0&&(a.ps===0||a.ps===1))own[a.ps]+=dt;}
 const pos=own[0]+own[1],pct=(x:number)=>pos?Math.round(x/pos*100):0;
 const [shots,saves,beaten,fouls]=[count('shot'),count('save'),count('beat'),count('foul')];
 return [['Shots',...shots],['Saves',...saves],['Possession %',pct(own[0]),pct(own[1])],['Players beaten',...beaten],['Fouls',...fouls]];
}
/** The ribbon's runs for one side, from the one phase function. */
export function ribbonRuns(frames:readonly Pick<ReplayFrame,'t'|'ps'|'b'|'r'>[],events:readonly ReplayEvent[],side:0|1){
 const labels=phaseLabels(frames as ReplayFrame[],events,side);
 return phaseRuns(frames,labels).map(r=>({kind:r.phase,from:r.from/1000,to:r.to/1000}));
}
