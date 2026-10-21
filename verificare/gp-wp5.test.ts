// Game plan WP5: the league story (round lines, table moves, your place, a
// player's season story) and Home's one-amber rule.
// `npx vitest run verificare/gp-wp5.test.ts`
import {describe,it,expect} from 'vitest';
import {clubStory,countWord,nthWord,ordinal,placeOf,playedRounds,roundLine,seasonStory,tableMoves} from '../lib/ballers/league-story';
import {dayWord,homeAction,type HomeInput} from '../lib/ballers/home-state';
import type {Club,Result,Round} from '../lib/ballers/league';
import type {PlayerLine} from '../lib/ballers/stats';

const club=(id:string,name:string):Club=>({id,space:'t',name,code:id.toUpperCase(),color:'#fff',crest:'crest-01',motto:null,anthem:null,chant:null,ai:true,manager:null,captain:null,created_at:''});
const CLUBS=[club('a','Alpha'),club('b','Bravo'),club('c','Charlie'),club('d','Delta')];
const ROUNDS:Pick<Round,'id'|'number'>[]=[1,2,3,4].map(n=>({id:`r${n}`,number:n}));
let seq=0;
/** Stored lines carry real player ids (uuids): one per test name. */
const ID=(name:string)=>`00000000-0000-4000-8000-${[...name].map(c=>c.charCodeAt(0).toString(16)).join('').padStart(12,'0').slice(-12)}`;
const line=(id:string,side:0|1,o:Partial<PlayerLine>={}):PlayerLine=>({id:ID(id),side,m:900,st:1,g:0,a:0,sh:0,sv:0,og:0,...o});
const res=(round:number,h:string,a:string,hs:number,as:number,lines:PlayerLine[]=[]):Result=>({match_id:`m${++seq}`,competition_id:'c',round_id:`r${round}`,home_club:h,away_club:a,home_goals:hs,away_goals:as,
 stats:[{},{}],duration:900,engine_build:'x',live_from:`2026-09-0${round}T18:00:00Z`,visible_from:`2026-09-0${round}T18:15:00Z`,player_stats:lines});

describe('words',()=>{
 it('ordinals, counts and nth words',()=>{
  expect([1,2,3,4,11,12,13,21,22,101].map(ordinal)).toEqual(['1st','2nd','3rd','4th','11th','12th','13th','21st','22nd','101st']);
  expect(countWord(2)).toBe('two');expect(countWord(14)).toBe('14');
  expect(nthWord(4)).toBe('fourth');expect(nthWord(12)).toBe('12th');
 });
});

describe('the table over time',()=>{
 const results=[res(1,'a','b',3,0),res(1,'c','d',1,1),res(2,'b','c',5,0),res(2,'d','a',2,1)];
 it('played rounds are the ones with a result',()=>{expect(playedRounds(results,ROUNDS)).toEqual([1,2]);});
 it('moves compare the table after the last round with the one before',()=>{
  // after r1: a 3, c 1, d 1, b 0 → a, c(gd0 gf1), d(gd0 gf1, name), b
  // after r2: b 3 (+2), a 3 (+2), d 4? d: 1+3=4 → d first
  const m=tableMoves(CLUBS,results,ROUNDS);
  expect(m.round).toBe(2);expect(m.since).toBe(1);
  expect(m.moves.get('d')).toBe(2);   // 3rd → 1st
  expect(m.moves.get('c')).toBe(-2);  // 2nd → 4th
 });
 it('no moves before a second round',()=>{expect(tableMoves(CLUBS,results.slice(0,2),ROUNDS).moves.size).toBe(0);});
 it('the round line names the top, a climber, and the biggest win',()=>{
  expect(roundLine(2,CLUBS,results,ROUNDS)).toBe('Delta go top; Bravo climb 2 places; biggest win Bravo’s 5–0.');
  expect(roundLine(1,CLUBS,results,ROUNDS)).toBe('Alpha go top; biggest win Alpha’s 3–0.');
  expect(roundLine(3,CLUBS,results,ROUNDS)).toBeNull();
 });
 it('a hidden result moves the table but neither its score nor its clubs’ movement appears',()=>{
  const big=results[2],top=results[3];
  expect(roundLine(2,CLUBS,results,ROUNDS,r=>r.match_id===big.match_id)).toBe('Delta go top.');
  expect(roundLine(2,CLUBS,results,ROUNDS,r=>r.match_id===top.match_id)).toBe('Bravo climb 2 places; biggest win Bravo’s 5–0.');
  expect(roundLine(2,CLUBS,results,ROUNDS,r=>r.round_id===big.round_id)).toBeNull();
 });
 it('level at the top says so instead of naming a leader by alphabet',()=>{
  const r=[res(1,'a','b',2,0),res(1,'c','d',2,0)];
  expect(roundLine(1,CLUBS,r,ROUNDS)).toBe('Alpha and Charlie are level at the top.');
 });
 it('your place: position, gap to the leader, the move',()=>{
  const p=placeOf('c',CLUBS,results,ROUNDS)!;
  expect(p.pos).toBe(4);expect(p.line).toBe('4th · 1 pt, 3 behind Delta');expect(p.moveLine).toBe('Down two since round 1');
  expect(placeOf('d',CLUBS,results,ROUNDS)!.line).toBe('Top · 4 pts, 1 clear of Bravo');
  expect(placeOf('a',CLUBS,[],ROUNDS)).toBeNull();
 });
});

describe('his season story',()=>{
 const results=[
  res(1,'a','b',1,0,[line('p1',0,{g:1}),line('k',1)]),
  res(2,'c','a',0,2,[line('p1',1,{g:2,a:0}),line('x',0,{g:1})]),
  res(3,'a','d',3,0,[line('p1',0,{a:1}),line('k2',1,{gt:900,cs:0})]),
  res(4,'b','a',0,0,[line('k',0,{gt:900,cs:1}),line('p1',1)]),
 ];
 it('one line per round, newest first, the biggest moment of each',()=>{
  expect(seasonStory(ID('p1'),CLUBS,results,ROUNDS,5).map(s=>`${s.round} ${s.text}`)).toEqual([
   '3 His first assist, against Delta.',
   '2 His third goal: no one in the league has more.',
   '1 His first league goal, against Bravo.',
  ]);
 });
 it('a keeper’s first clean sheet; a debut only when nothing bigger happened',()=>{
  expect(seasonStory(ID('k'),CLUBS,results,ROUNDS).map(s=>s.text)).toEqual(['His first clean sheet, against Alpha.','His first league match, against Alpha.']);
 });
 it('a shared lead is not "no one has more"',()=>{
  const r=[res(1,'a','b',2,2,[line('p1',0,{g:2}),line('q',1,{g:2})])];
  expect(seasonStory(ID('p1'),CLUBS,r,ROUNDS)[0].text).toBe('His first league goals: two against Bravo.');
 });
 it('the club line skips debuts and takes the latest moment',()=>{
  expect(clubStory([ID('p1'),ID('k')],CLUBS,results,ROUNDS)).toMatchObject({player:ID('k'),round:4});
 });
});

describe('Home: one amber, following the evening',()=>{
 const base:HomeInput={paused:false,myMatch:{id:'m',kickoff_at:'2026-10-02T17:00:00Z',state:'open'},myLive:null,othersLive:null,locked:false,roundNumber:5,latest:null};
 const amberCount=(x:HomeInput)=>{const r=homeAction(x);return (r.action?.amber?1:0)+(r.resultAmber?1:0);};
 it('before the lock: Prepare match',()=>{expect(homeAction(base).action).toMatchObject({kind:'prepare',amber:true});});
 it('the hero’s Prepare match keeps the amber over your result below it',()=>{const r=homeAction({...base,latest:{match_id:'old',tonight:false}});expect(r.action).toMatchObject({kind:'prepare',amber:true});expect(r.resultAmber).toBe(false);});
 it('a plain hero action (View lineup) hands the amber to your result below',()=>{const r=homeAction({...base,locked:true,latest:{match_id:'old',tonight:false}});expect(r.action).toMatchObject({kind:'view_lineup',amber:false});expect(r.resultAmber).toBe(true);});
 it('lock to kickoff: the walk-out',()=>{expect(homeAction({...base,locked:true,myMatch:{...base.myMatch!,state:'locked'}}).action).toMatchObject({kind:'walkout',label:'Walk-out · 20:00'});});
 it('live: Watch live',()=>{expect(homeAction({...base,locked:true,myLive:'m'}).action).toMatchObject({kind:'watch_live',href:'/jocuri/ballers/match/m'});});
 it('full time tonight: Watch it',()=>{expect(homeAction({...base,latest:{match_id:'m',tonight:true}}).action).toMatchObject({kind:'watch_tonight'});});
 it('resting while others play: Watch live; resting otherwise: the round, plain',()=>{
  expect(homeAction({...base,myMatch:null,othersLive:'z'}).action).toMatchObject({kind:'watch_live',href:'/jocuri/ballers/match/z'});
  expect(homeAction({...base,myMatch:null}).action).toMatchObject({kind:'see_round',amber:false,href:'/jocuri/ballers/matches?round=5'});
 });
 it('paused: Practice match, the hero’s amber',()=>{expect(homeAction({...base,paused:true}).action).toMatchObject({kind:'practice',amber:true});expect(homeAction({...base,paused:true,latest:{match_id:'u',tonight:false}}).resultAmber).toBe(false);});
 it('never more than one amber',()=>{
  for(const paused of [false,true])for(const locked of [false,true])for(const live of [null,'m'])for(const others of [null,'z'])for(const latest of [null,{match_id:'u',tonight:false},{match_id:'u',tonight:true}])for(const mm of [null,base.myMatch,{...base.myMatch!,state:'locked' as const}])
   expect(amberCount({paused,locked,myLive:live,othersLive:others,latest,myMatch:mm,roundNumber:5})).toBeLessThanOrEqual(1);
 });
 it('day words only inside six days',()=>{
  const now=Date.parse('2026-10-01T10:00:00Z');
  expect(dayWord(Date.parse('2026-10-02T17:00:00Z'),now)).toBe('Friday');
  expect(dayWord(Date.parse('2026-10-13T17:00:00Z'),now)).toBeNull();
 });
});

import {counterpart,likeFor,startInstead} from '../lib/ballers/squad-pick';
import type {PrepOrder} from '../lib/ballers/subs';
describe('Compare: who with whom, and Start him instead',()=>{
 const P=(id:string,roles:string[],number:number)=>({id,roles:roles as never,number});
 const squad=[P('gk',['GK'],1),P('cb',['CB'],4),P('w1',['W'],7),P('w2',['W','AM'],11),P('st',['ST'],9),P('gk2',['GK'],12),P('cm',['CM'],8),P('w3',['W'],17),P('fb',['FB','CB'],5)];
 const lineup=['gk','cb','w1','w2','st'];
 it('a planned substitution pairs its two players, on then off',()=>{
  const o:PrepOrder={id:'s1',in:'w3',trigger:{kind:'tired',player:'w1',threshold:50}} as PrepOrder;
  expect(counterpart(squad[2],squad,lineup,[o])).toEqual({a:'w3',b:'w1',sub:true});
  expect(counterpart(squad[7],squad,lineup,[o])).toEqual({a:'w3',b:'w1',sub:true});
 });
 it('otherwise the most alike player on the other side of the five, keepers with keepers',()=>{
  expect(counterpart(squad[2],squad,lineup)).toEqual({a:'w3',b:'w1',sub:false});
  expect(counterpart(squad[0],squad,lineup)).toEqual({a:'gk2',b:'gk',sub:false});
  expect(counterpart(squad[8],squad,lineup)).toEqual({a:'fb',b:'cb',sub:false});
 });
 it('like-for-like in another squad',()=>{expect(likeFor(P('x',['ST'],9),squad)).toBe('st');expect(likeFor(P('y',['GK'],1),squad,['gk2'])).toBe('gk2');});
 it('start A instead of B: the slot, the armband (Match prep’s rule: the second slot), the taker and B’s move parts',()=>{
  const r=startInstead(squad,{lineup,captain:'w1',taker:'w1',moveLineups:{m:{'3':'w1','4':'w2'}}},'w3','w1')!;
  expect(r.lineup).toEqual(['gk','cb','w3','w2','st']);expect(r.captain).toBe('cb');expect(r.armbandFrom).toBe('w1');expect(r.taker).toBe('auto');expect(r.moveLineups).toEqual({m:{'4':'w2'}});
  expect(startInstead(squad,{lineup,captain:'cb',moveLineups:{}},'w3','w1')!.taker).toBeUndefined();
 });
 it('no swap across keepers, or for someone already starting',()=>{
  expect(startInstead(squad,{lineup,captain:'cb',moveLineups:{}},'gk2','cb')).toBeNull();
  expect(startInstead(squad,{lineup,captain:'cb',moveLineups:{}},'w2','w1')).toBeNull();
 });
});
