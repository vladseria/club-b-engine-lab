// Game plan WP5: the league as a story you follow (DESIGN-SPEC-2 §2, §4).
// Pure: everything here is built from results past full time (row security
// returns nothing else) and the round calendar. The owner's spoiler rule
// (lib/ballers/spoilers.ts): your own unwatched results count in every table
// and tally; only a SCORE is ever kept dark, so the one helper that prints a
// score (the round line's biggest win) takes `hidden` and skips those.
import {standings,tableResults,type Club,type Result,type Round,type TableRow} from './league';
import {readPlayerStats,type PlayerLine} from './stats';

// ------------------------------------------------------------------ words
/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st … */
export function ordinal(n:number){const t=n%100,u=n%10;return `${n}${t>=11&&t<=13?'th':u===1?'st':u===2?'nd':u===3?'rd':'th'}`;}
const COUNT=['no','one','two','three','four','five','six','seven','eight','nine','ten'];
/** "two" up to ten, digits after. */
export const countWord=(n:number)=>COUNT[n]??String(n);
const NTH=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
/** "fourth" up to tenth, "11th" after. */
export const nthWord=(n:number)=>NTH[n]??ordinal(n);
/** A result in words, from one side: "Won 4–3 at Umanoizii", "Lost 2–1 to Inter" (the winner's score first, as a
 * result is told), "Drew 2–2 with Inter". `away`: that side was the away side ("at Umanoizii", whatever the result);
 * at home or on neutral ground it is against / to / with. Split so the verb and the score can be lit. */
export function resultWords(us:number,them:number,opp:string,away:boolean):{lead:string;rest:string}{
 const lead=us>them?`Won ${us}–${them}`:us<them?`Lost ${them}–${us}`:`Drew ${us}–${them}`;
 return {lead,rest:away?`at ${opp}`:us>them?`against ${opp}`:us<them?`to ${opp}`:`with ${opp}`};
}

// ------------------------------------------------------------------ rounds and tables
type R=Pick<Result,'match_id'|'round_id'|'home_club'|'away_club'|'home_goals'|'away_goals'>;
/** The round number of each round id. */
const numbers=(rounds:readonly Pick<Round,'id'|'number'>[])=>new Map(rounds.map(r=>[r.id,r.number]));
/** Round numbers that have at least one result, ascending. */
export function playedRounds(results:readonly R[],rounds:readonly Pick<Round,'id'|'number'>[]):number[]{
 const n=numbers(rounds);
 return [...new Set(results.map(r=>r.round_id?n.get(r.round_id):undefined).filter((x):x is number=>x!==undefined))].sort((a,b)=>a-b);
}
/** The table after round `upTo` (every result of rounds ≤ upTo). */
export function tableAfter(clubs:Club[],results:readonly R[],rounds:readonly Pick<Round,'id'|'number'>[],upTo:number):TableRow[]{
 const n=numbers(rounds);
 return standings(clubs,tableResults(results.filter(r=>{const k=r.round_id?n.get(r.round_id):undefined;return k!==undefined&&k<=upTo;})));
}
/** How far each club moved in the table over the latest played round
 * (positive = up). Empty before a second round has been played. */
export function tableMoves(clubs:Club[],results:readonly R[],rounds:readonly Pick<Round,'id'|'number'>[]):{round:number|null;since:number|null;moves:Map<string,number>}{
 const played=playedRounds(results,rounds),last=played.at(-1)??null,prev=played.at(-2)??null;
 const moves=new Map<string,number>();
 if(last===null||prev===null)return {round:last,since:prev,moves};
 const before=tableAfter(clubs,results,rounds,prev),after=tableAfter(clubs,results,rounds,last);
 after.forEach((row,i)=>{const was=before.findIndex(x=>x.club.id===row.club.id);if(was>=0)moves.set(row.club.id,was-i);});
 return {round:last,since:prev,moves};
}

/** Level on every tie-break the table uses (points, goal difference, goals). */
const level=(a:TableRow,b:TableRow)=>a.points===b.points&&a.gf-a.ga===b.gf-b.ga&&a.gf===b.gf;

/** One line on what round `round` did to the league ("Inter stay top;
 * Umanoizii climb 2 places; biggest win Adjud Style's 10–5."), built from its
 * results and the table before and after it. `hidden` = results whose score
 * this viewer hasn't opened: they still move the table (a W/D/L is a table
 * fact), but their score never appears in the line, and neither club of a
 * hidden result is named as going top, level at the top or climbing, so the
 * line can't tell you how your own unwatched match went (UX review #7). */
export function roundLine(round:number,clubs:Club[],results:readonly R[],rounds:readonly Pick<Round,'id'|'number'>[],hidden:(r:R)=>boolean=()=>false):string|null{
 const n=numbers(rounds),inRound=results.filter(r=>r.round_id&&n.get(r.round_id)===round);
 if(!inRound.length||!clubs.length)return null;
 const played=playedRounds(results,rounds),prev=played.filter(x=>x<round).at(-1)??null;
 const after=tableAfter(clubs,results,rounds,round),before=prev===null?null:tableAfter(clubs,results,rounds,prev);
 const name=(id:string)=>clubs.find(c=>c.id===id)?.name??'?';
 const dark=new Set(inRound.filter(hidden).flatMap(r=>[r.home_club,r.away_club]));
 const parts:string[]=[];
 const top=after[0];
 if(after[1]&&level(top,after[1])){if(!dark.has(top.club.id)&&!dark.has(after[1].club.id))parts.push(`${top.club.name} and ${after[1].club.name} are level at the top`);}
 else if(!dark.has(top.club.id))parts.push(before&&before[0].club.id===top.club.id?`${top.club.name} stay top`:`${top.club.name} go top`);
 if(before){
  const rise=after.map((row,i)=>({row,move:before.findIndex(x=>x.club.id===row.club.id)-i})).filter(x=>x.row.club.id!==top.club.id&&!dark.has(x.row.club.id)&&x.move>=2).sort((a,b)=>b.move-a.move)[0];
  if(rise)parts.push(`${rise.row.club.name} climb ${rise.move} places`);
 }
 const big=inRound.filter(r=>!hidden(r)&&Math.abs(r.home_goals-r.away_goals)>=3).sort((a,b)=>Math.abs(b.away_goals-b.home_goals)-Math.abs(a.away_goals-a.home_goals))[0];
 if(big){const homeWon=big.home_goals>big.away_goals;
  parts.push(`biggest win ${name(homeWon?big.home_club:big.away_club)}’s ${Math.max(big.home_goals,big.away_goals)}–${Math.min(big.home_goals,big.away_goals)}`);}
 if(!parts.length)return null;
 const t=parts.join('; ');
 return `${t[0].toUpperCase()}${t.slice(1)}.`;
}

/** Your place in a few words: "4th · 6 pts, 4 behind Inter" (or "top, 2 clear
 * of Inter"), and the move since the round before. */
export interface Place {pos:number;of:number;points:number;line:string;move:number|null;moveLine:string|null}
export function placeOf(club:string,clubs:Club[],results:readonly R[],rounds:readonly Pick<Round,'id'|'number'>[]):Place|null{
 const rows=standings(clubs,tableResults([...results])),i=rows.findIndex(r=>r.club.id===club);
 if(i<0||!rows[i].played)return null;
 const me=rows[i],lead=rows[0],pts=`${me.points} ${me.points===1?'pt':'pts'}`;
 let line:string;
 if(i===0){const next=rows[1];line=!next?`Top · ${pts}`:next.points===me.points?`Top · ${pts}, level with ${next.club.name}`:`Top · ${pts}, ${me.points-next.points} clear of ${next.club.name}`;}
 else line=lead.points===me.points?`${ordinal(i+1)} · ${pts}, level with ${lead.club.name}`:`${ordinal(i+1)} · ${pts}, ${lead.points-me.points} behind ${lead.club.name}`;
 const mv=tableMoves(clubs,results,rounds),move=mv.moves.has(club)?mv.moves.get(club)!:null;
 const moveLine=move===null||mv.since===null?null:move>0?`Up ${countWord(move)} since round ${mv.since}`:move<0?`Down ${countWord(-move)} since round ${mv.since}`:`Same place as after round ${mv.since}`;
 return {pos:i+1,of:rows.length,points:me.points,line,move,moveLine};
}

/** What one round did to your place (Your match): the table after that round against the table after the round
 * before it, from the results this viewer can read (past full time). `move`: "Up two, from 5th" / "Down one, from
 * 2nd" / "Same place"; null after your first round. `gap`: "9 pts, 2 behind Inter" ("3 clear of Inter" when top). */
export interface RoundPlace {round:number;pos:number;from:number|null;move:string|null;gap:string}
export function roundPlace(club:string,clubs:Club[],results:readonly R[],rounds:readonly Pick<Round,'id'|'number'>[],roundId:string):RoundPlace|null{
 const k=numbers(rounds).get(roundId);if(k===undefined)return null;
 const after=tableAfter(clubs,results,rounds,k),i=after.findIndex(r=>r.club.id===club);
 if(i<0||!after[i].played)return null;
 const prev=playedRounds(results,rounds).filter(x=>x<k).at(-1)??null;
 let from:number|null=null;
 if(prev!==null){const before=tableAfter(clubs,results,rounds,prev),j=before.findIndex(r=>r.club.id===club);if(j>=0&&before[j].played)from=j+1;}
 const pos=i+1,me=after[i],pts=`${me.points} ${me.points===1?'pt':'pts'}`;
 const other=i===0?after[1]:after[0];
 const gap=!other?pts:other.points===me.points?`${pts}, level with ${other.club.name}`:i===0?`${pts}, ${me.points-other.points} clear of ${other.club.name}`:`${pts}, ${other.points-me.points} behind ${other.club.name}`;
 const move=from===null?null:from>pos?`Up ${countWord(from-pos)}, from ${ordinal(from)}`:from<pos?`Down ${countWord(pos-from)}, from ${ordinal(from)}`:'Same place';
 return {round:k,pos,from,move,gap};
}

// ------------------------------------------------------------------ his season story
export interface StoryLine {round:number;match_id:string;text:string}
type SR=R&{player_stats?:unknown};
/** Real milestones from the stored match records, newest first: a hat-trick
 * or two goals in a match, a goal or assist that puts him alone at the top of
 * the league, his first goal, first assist, first clean sheet (a keeper), and
 * his first league match. One line per round, the biggest moment of it. No
 * scores (a score is the one thing that waits for the reveal). */
export function seasonStory(playerId:string,clubs:Club[],results:readonly SR[],rounds:readonly Pick<Round,'id'|'number'>[],limit=3):StoryLine[]{
 const n=numbers(rounds),name=(id:string)=>clubs.find(c=>c.id===id)?.name??'?';
 const byRound=new Map<number,{r:SR;lines:PlayerLine[]}[]>();
 for(const r of results){const k=r.round_id?n.get(r.round_id):undefined,lines=readPlayerStats(r.player_stats);if(k===undefined||!lines)continue;
  if(!byRound.has(k))byRound.set(k,[]);byRound.get(k)!.push({r,lines});}
 const goals=new Map<string,number>(),assists=new Map<string,number>();
 let mineGoals=0,mineAssists=0,cleanSheets=0,apps=0;
 const out:StoryLine[]=[];
 const alone=(m:Map<string,number>,v:number)=>[...m.entries()].every(([id,x])=>id===playerId||x<v);
 for(const k of [...byRound.keys()].sort((a,b)=>a-b)){
  let mine:{r:SR;l:PlayerLine}|null=null;
  for(const {r,lines} of byRound.get(k)!)for(const l of lines){
   goals.set(l.id,(goals.get(l.id)??0)+l.g);assists.set(l.id,(assists.get(l.id)??0)+l.a);
   if(l.id===playerId)mine={r,l};
  }
  if(!mine)continue;
  const {r,l}=mine,opp=name(l.side===0?r.away_club:r.home_club);
  const firstGoal=mineGoals===0&&l.g>0,firstAssist=mineAssists===0&&l.a>0,firstCs=cleanSheets===0&&l.cs===1,debut=apps===0;
  mineGoals+=l.g;mineAssists+=l.a;cleanSheets+=l.cs===1?1:0;apps++;
  const leadsGoals=l.g>0&&mineGoals>=2&&alone(goals,mineGoals),leadsAssists=l.a>0&&mineAssists>=2&&alone(assists,mineAssists);
  const text=l.g>=3?`A hat-trick against ${opp}.`
   :leadsGoals?`His ${nthWord(mineGoals)} goal: no one in the league has more.`
   :l.g===2?(firstGoal?`His first league goals: two against ${opp}.`:`Two goals against ${opp}.`)
   :firstGoal?`His first league goal, against ${opp}.`
   :leadsAssists?`His ${nthWord(mineAssists)} assist: no one in the league has more.`
   :firstAssist?`His first assist, against ${opp}.`
   :firstCs?`His first clean sheet, against ${opp}.`
   :debut?`His first league match, against ${opp}.`:null;
  if(text)out.push({round:k,match_id:r.match_id,text});
 }
 return out.reverse().slice(0,limit);
}

/** The club's latest story moment across its squad (Home's one line). */
export function clubStory(playerIds:readonly string[],clubs:Club[],results:readonly SR[],rounds:readonly Pick<Round,'id'|'number'>[]):(StoryLine&{player:string})|null{
 let best:(StoryLine&{player:string})|null=null;
 for(const id of playerIds){const s=seasonStory(id,clubs,results,rounds,1)[0];
  // the debut line is a card moment, not a club headline
  if(s&&!s.text.startsWith('His first league match')&&(!best||s.round>best.round))best={...s,player:id};}
 return best;
}
