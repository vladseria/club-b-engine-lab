// Ballers per-player records: the match lines the compute route submits
// (lib/ballers/stats.ts matchPlayerStats) against the replay's own events and
// the broadcast's incident layer, own goals, substitutes, the stored shape,
// and season totals over every result past full time.
import {describe,it,expect} from 'vitest';
import {computeMatch,submission,validateInput,type FrozenInput,type FrozenSide} from '../lib/ballers/simulation';
import {timeline,type ReplayEvent,type ReplayHeader,type ReplayPlayer} from '../lib/ballers/replay';
import {buildIncidents} from '../lib/ballers/incidents';
import {clubSeasonStats,emptySeason,matchPlayerStats,readPlayerStats,seasonStats,topScorers,type PlayerLine,type StatsResult} from '../lib/ballers/stats';
import type {PrepOrder} from '../lib/ballers/subs';
import {statRows} from '../lib/ballers/match-stats';

const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:6+n%4,defending:4,pace:5+n%4,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:gk?6:1});
const pid=(tag:string,n:number)=>`${tag}000000-0000-4000-8000-00000000000${n}`;
function side(tag:string,subs?:PrepOrder[]):FrozenSide{
 const players=Array.from({length:9},(_,n)=>({id:pid(tag,n),name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,roles:(n===0||n===8?['GK']:['CM','ST']) as FrozenSide['players'][0]['roles'],
  skills:skills(n===0||n===8,n),traits:{risk:.5,dribble:.4+n/40,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation:'1-2-1',style:'direct',
  approach:{progression:'direct',width:'wide',line:'standard',press:'balanced',commit:4,striker:'run',transition:'balanced'},
  captain:lineup[2],lineup,bench:players.slice(5).map(p=>p.id),players,plans:[],...(subs?{substitutions:subs}:{})};
}

describe('match lines from a simulated official match',()=>{
 const orders:PrepOrder[]=[{id:'half-change',in:pid('aa',5),out:pid('aa',4),trigger:{kind:'half'}}];
 const input:FrozenInput={v:1,match:'ms',seed:9191,kickoff:0,duration:420,sides:[side('aa',orders),side('bb')]};
 const c=computeMatch(validateInput(input)),sub=submission(c,input);
 const tl=timeline(c.compact.header,c.compact.chunks);
 const lines=sub.players!;
 const incidents=buildIncidents({header:c.compact.header,events:tl.events,frames:tl.frames});
 const byId=(id:string)=>lines.find(l=>l.id===id);
 it('goals and own goals add up to the final score, per side',()=>{
  const score=[0,1].map(s=>lines.filter(l=>l.side===s).reduce((n,l)=>n+l.g,0)+lines.filter(l=>l.side!==s).reduce((n,l)=>n+l.og,0));
  expect(score).toEqual(c.compact.score);
  // (Lane C, 2026-10-21: "the fixture has goals" was seed 9191's passage; the sums hold at any score, and crediting a
  // goal, an assist and an own goal is checked on the hand-made replay below)
 },120000);
 it('each goal is the broadcast\'s scorer, each assist the broadcast\'s key pass',()=>{
  const want=new Map<string,{g:number;a:number;og:number}>();
  const bump=(i:number|undefined,k:'g'|'a'|'og')=>{if(i===undefined)return;const id=c.compact.header.players[i].id;const w=want.get(id)??{g:0,a:0,og:0};w[k]++;want.set(id,w);};
  for(const x of incidents){if(x.kind==='goal'){bump(x.actors[0],'g');bump(x.facts.assist,'a');}if(x.kind==='own_goal')bump(x.actors[0],'og');}
  for(const l of lines){const w=want.get(l.id)??{g:0,a:0,og:0};expect([l.g,l.a,l.og]).toEqual([w.g,w.a,w.og]);}
  expect(lines.reduce((n,l)=>n+l.a,0)).toBe(incidents.filter(x=>x.kind==='goal'&&x.facts.assist!==undefined).length);
 });
 it('shots and saves are the engine\'s own events and match its team stats',()=>{
  for(const s of [0,1] as const){
   expect(lines.filter(l=>l.side===s).reduce((n,l)=>n+l.sh,0)).toBe(c.compact.stats[s].shots);
   expect(lines.filter(l=>l.side===s).reduce((n,l)=>n+l.sv,0)).toBe(c.compact.stats[s].saves);
  }
  const shots=tl.events.filter((e:ReplayEvent)=>e.k==='shot'&&e.a!==undefined);
  expect(lines.reduce((n,l)=>n+l.sh,0)).toBe(shots.length);
 });
 it('ten starters, the substitute who came on counted as off the bench, unused bench left out',()=>{
  expect(lines.filter(l=>l.st===1)).toHaveLength(10);
  expect(byId(pid('aa',5))).toMatchObject({side:0,st:0});
  expect(byId(pid('aa',4))).toMatchObject({side:0,st:1}); // went off, still started
  expect(byId(pid('aa',6))).toBeUndefined();
  expect(byId(pid('bb',5))).toBeUndefined();
  expect(lines.filter(l=>l.st===0).length).toBe(tl.events.filter(e=>e.k==='substitution').length);
 });
 it('the detail agrees with the engine\'s team stats and the substitution times',()=>{
  for(const s of [0,1] as const){
   const mine=lines.filter(l=>l.side===s),add=(k:'ps'|'tk'|'fc'|'dr'|'cl'|'m'|'gt')=>mine.reduce((n,l)=>n+(l[k]??0),0);
   expect([add('ps'),add('tk'),add('fc'),add('dr'),add('cl')]).toEqual([c.compact.stats[s].passes,c.compact.stats[s].tacklesWon,c.compact.stats[s].fouls,c.compact.stats[s].beaten,c.compact.stats[s].clearances]);
   expect(Math.abs(add('m')-5*input.duration)).toBeLessThanOrEqual(5);
   expect(Math.abs(add('gt')-input.duration)).toBeLessThanOrEqual(1);
  }
  const change=tl.events.find(e=>e.k==='substitution')!;
  expect(Math.abs(byId(pid('aa',5))!.m!-(input.duration-change.t/1000))).toBeLessThanOrEqual(1);
  expect(Math.abs(byId(pid('aa',4))!.m!-change.t/1000)).toBeLessThanOrEqual(1);
 });
 it('rides the submit payload in a shape the database check and the reader accept',()=>{
  expect(sub.players).toBeDefined();
  expect(lines.length).toBeLessThanOrEqual(40);
  expect(JSON.stringify(lines).length).toBeLessThanOrEqual(16000);
  expect(readPlayerStats(JSON.parse(JSON.stringify(lines)))).toEqual(lines);
 });
});

// A hand-made replay: one assisted goal, one own goal, one goal with no pass.
const P=(i:number,side:0|1,slot:number,bench=false):ReplayPlayer=>({i,side,slot,id:pid(side?'bb':'aa',i%5+(bench?5:0)),name:`P${i}`,short:`P${i}`,number:i+1,role:'CM',portrait:'p0010',captain:false,...(bench?{bench:true}:{})});
const header:Pick<ReplayHeader,'players'|'duration'>={duration:120,players:[...Array.from({length:10},(_,i)=>P(i,(i<5?0:1) as 0|1,i%5)),P(10,0,-1,true),P(11,1,-1,true)]};
const frames=[{t:0,p:Array.from({length:10},()=>[2400,0,0] as [number,number,number]),b:[2400,0,0] as [number,number,number],o:-1,ps:0 as const,s:[0,0] as [number,number]}];
const ev:ReplayEvent[]=[
 {t:0,k:'start',x:''},
 {t:10000,k:'pass',x:'',a:2,g:4,s:0},{t:11000,k:'receive',x:'',a:4,s:0},
 {t:12000,k:'shot',x:'',a:4,s:0,sh:{o:[4000,0],a:[4800,100]}},{t:12800,k:'goal',x:'',s:0,lt:4,a:4},
 {t:30000,k:'substitution',x:'',a:11,g:9,s:1},
 {t:40000,k:'clearance',x:'',a:6,s:1},{t:40600,k:'goal',x:'',s:0,lt:6,a:6},
 {t:60000,k:'turnover',x:'',a:11,s:1},{t:61000,k:'shot',x:'',a:11,s:1,sh:{o:[900,0],a:[0,-50]}},{t:61500,k:'save',x:'',a:0,s:0},
 {t:70000,k:'shot',x:'',a:11,s:1,sh:{o:[900,0],a:[0,50]}},{t:70700,k:'goal',x:'',s:1,lt:11,a:11},
 {t:120000,k:'end',x:''},
];
describe('match lines from a hand-made replay',()=>{
 const lines=matchPlayerStats(header,ev,frames);
 const at=(i:number)=>lines.find(l=>l.id===header.players[i].id)!;
 it('credits the shooter and the passer',()=>{expect(at(4)).toMatchObject({g:1,sh:1,a:0});expect(at(2)).toMatchObject({a:1,g:0});});
 it('an own goal is the defender\'s own goal, never a goal for anyone',()=>{
  expect(at(6)).toMatchObject({g:0,og:1});
  expect(lines.reduce((n,l)=>n+l.g,0)).toBe(2);
 });
 it('the substitute has a line (off the bench) and his own goal, save and shots',()=>{
  expect(at(11)).toMatchObject({side:1,st:0,g:1,sh:2,a:0});
  expect(at(0)).toMatchObject({sv:1});
  expect(lines.find(l=>l.id===header.players[10].id)).toBeUndefined();
 });
});

describe('season totals',()=>{
 const L=(id:string,side:0|1,st:0|1,g=0,a=0):PlayerLine=>({id,side,st,g,a,sh:g,sv:0,og:0});
 const x=pid('aa',1),y=pid('bb',2),z=pid('aa',3);
 const results:StatsResult[]=[
  {match_id:'m1',competition_id:'c1',home_club:'A',away_club:'B',player_stats:[L(x,0,1,2,0),L(y,1,1,1,0),L(z,0,0,0,2)]},
  {match_id:'m2',competition_id:'c1',home_club:'B',away_club:'A',player_stats:[L(y,0,1,2,1),L(x,1,1,1,0)]},
  {match_id:'m3',competition_id:'c1',home_club:'A',away_club:'C',player_stats:null},       // before the record existed
  {match_id:'m4',competition_id:'c0',home_club:'A',away_club:'B',player_stats:[L(x,0,1,5)]},// another season
  {match_id:'m5',competition_id:'c1',home_club:'A',away_club:'B',player_stats:[L(x,0,1,4)]},// your own, not watched yet: still counts
 ];
 it('adds up one season, keeps the club, counts starts and substitute appearances',()=>{
  const s=seasonStats(results,{competition:'c1'});
  expect(s.get(x)).toMatchObject({club:'A',apps:3,starts:3,subs:0,goals:7});
  expect(s.get(z)).toMatchObject({club:'A',apps:1,starts:0,subs:1,assists:2});
  expect(s.get(y)).toMatchObject({club:'B',apps:2,goals:3,assists:1});
 });
 it('every visible result counts, watched or not; a result with no record adds nothing',()=>{
  expect(seasonStats(results,{competition:'c1'}).get(x)!.goals).toBe(7);
  expect(seasonStats(results.filter(r=>r.match_id!=='m5'),{competition:'c1'}).get(x)!.goals).toBe(3);
  expect(seasonStats([results[2]]).size).toBe(0);
 });
 it('top scorers: goals, then assists; ties share a rank; no goal, no place',()=>{
  const top=topScorers(seasonStats(results,{competition:'c1'}).values());
  expect(top.map(t=>[t.id,t.rank])).toEqual([[x,1],[y,2]]);
  expect(topScorers(seasonStats(results.filter(r=>r.match_id!=='m5'),{competition:'c1'}).values()).map(t=>[t.id,t.rank])).toEqual([[y,1],[x,2]]);
  const tied=topScorers([{...emptySeason('p','A'),apps:1,starts:1,goals:1,shots:1},{...emptySeason('q','B'),apps:1,starts:1,goals:1,shots:1}]);
  expect(tied.map(t=>t.rank)).toEqual([1,1]);
  expect(topScorers(tied,0)).toEqual([]);
 });
 it('one club\'s players only (scouting helper)',()=>{
  expect(clubSeasonStats(results,'B',{competition:'c1'}).map(l=>l.id)).toEqual([y]);
 });
 it('reads stored values defensively',()=>{
  expect(readPlayerStats(null)).toBeNull();
  expect(readPlayerStats([{id:'nope',side:0},{id:x,side:2},{id:x,side:1,st:1,g:-3,a:2.5,sh:'x'}])).toEqual([{id:x,side:1,st:1,g:0,a:0,sh:0,sv:0,og:0}]);
 });
});

describe('the match stats table',()=>{
 it('labels the engine\'s turnovers counter by what it counts: balls the side won (recon 2026-10-16, finding 10)',()=>{
  const blank={passes:0,completed:0,clearances:0,shots:0,goals:0,saves:0,turnovers:0,tackles:0,tacklesWon:0,feints:0,beaten:0,fouls:0,offsides:0,possession:0,pressSeconds:0,coverSeconds:0};
  // packages/football-engine practice.ts own(): the counter goes up for the side that gains the ball
  const rows=statRows({stats:[{...blank,turnovers:7},{...blank,turnovers:3}]} as never);
  expect(rows.find(([,a,b])=>a===7&&b===3)?.[0]).toBe('Balls won');
  expect(rows.some(([k])=>/turnover/i.test(k))).toBe(false);
 });
});
