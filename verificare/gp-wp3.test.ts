// Game plan WP3: Match prep, scouting and practice helpers (lib/ballers/prep-plan.ts).
// `npx vitest run verificare/gp-wp3.test.ts`
import {describe,it,expect} from 'vitest';
import {draftOf,editable,freeName,frozenMoves,handovers,moveLine,moveLineups,opponentLine,playedLine,prepState,scoutLeaders,swapFive,takerFor,timesPlayed,usualTaker} from '../lib/ballers/prep-plan';
import {oneTwoPlan} from '../lib/ballers/lab/model';
import type {PlanMove,PlanPrep} from '../lib/ballers/plans';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const FIVE=[id(1),id(2),id(3),id(4),id(5)];
const move=(mid:string,a=2,b=4,lineup=FIVE):PlanMove=>{const key=`move:${mid}`;return {id:mid,key,name:`Move ${mid}`,plan:{...oneTwoPlan(a as 2,b as 4,'a','b',.8),id:key} as unknown as PlanMove['plan'],lineup,emphasis:80,start:'any'};};
const prep=(o:Partial<PlanPrep>):PlanPrep=>({club_id:'c',round_id:'r1',lineup:FIVE,bench:[],captain:FIVE[1],formation:'1-2-1',style:'balanced',approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced',onLoss:'balanced'},
 ideas:[],accents:{},plans:[],origin:'manager',substitution_orders:[],idea_lineups:{},updated_at:'',plan_id:null,plan_snapshot:null,...o} as PlanPrep);

describe('the prep’s state',()=>{
 const plans=[{id:'p1'}];
 it('linked, carried, changed outside a plan, plan deleted, none',()=>{
  expect(prepState(prep({plan_id:'p1'}),plans)).toBe('linked');
  expect(prepState(prep({plan_id:'p1',origin:'carried'}),plans)).toBe('carried');
  expect(prepState(prep({}),plans)).toBe('custom');
  expect(prepState(prep({plan_snapshot:{detached:'plan_deleted'} as PlanPrep['plan_snapshot']}),plans)).toBe('plan_deleted');
  expect(prepState(prep({plan_id:'gone'}),plans)).toBe('plan_deleted');
  expect(prepState(null,plans)).toBe('none');
 });
 it('only a prep that plays a plan is edited here (the plan door is its one writer)',()=>{
  expect(editable('linked')&&editable('carried')).toBe(true);
  expect(editable('custom')||editable('plan_deleted')||editable('none')).toBe(false);
 });
 it('the draft reads exactly the stored prep; with none, the club’s five',()=>{
  const d=draftOf(prep({plan_id:'p1',match_settings:{taker:FIVE[3]},idea_lineups:{m:{'2':FIVE[4]}}}),{lineup:FIVE,captain:null});
  expect(d).toMatchObject({plan:'p1',lineup:FIVE,captain:FIVE[1],taker:FIVE[3],assign:{m:{'2':FIVE[4]}}});
  expect(draftOf(null,{lineup:FIVE,captain:null})).toMatchObject({plan:null,captain:FIVE[1],taker:null,subs:[]});
 });
});

describe('the five',()=>{
 it('a swap keeps the armband unless the captain left; then slot 2 has it, and Prep says so',()=>{
  expect(swapFive(FIVE,4,id(9),FIVE[1])).toEqual({lineup:[...FIVE.slice(0,4),id(9)],captain:FIVE[1],armbandFrom:null});
  const r=swapFive(FIVE,1,id(9),FIVE[1]);
  expect(r.captain).toBe(id(9));expect(r.armbandFrom).toBe(FIVE[1]);
  const r2=swapFive(FIVE,3,id(9),FIVE[3]);
  expect(r2.captain).toBe(FIVE[1]);expect(r2.armbandFrom).toBe(FIVE[3]);
 });
 it('the taker must be an outfield starter, else Auto',()=>{
  expect(takerFor(FIVE[2],FIVE)).toBe(FIVE[2]);
  expect(takerFor(FIVE[0],FIVE)).toBeNull();
  expect(takerFor(id(9),FIVE)).toBeNull();
  expect(takerFor(null,FIVE)).toBeNull();
 });
 it('Auto’s usual taker: set pieces first, never the keeper',()=>{
  const p=(n:number,setPieces:number,gk=false)=>({id:id(n),roles:gk?['GK']:['ST'],skills:{setPieces,passing:5,finishing:5,control:5}}) as never;
  expect((usualTaker([p(1,10,true),p(2,4),p(3,8),p(4,6)]) as unknown as {id:string}).id).toBe(id(3));
 });
});

describe('a move whose man isn’t in the five',()=>{
 const m=move('m1');
 it('nothing to hand over when his men start',()=>{
  const h=handovers([m],FIVE,{});
  expect(h[0].missing).toEqual([]);expect(moveLineups(h)).toEqual({});
 });
 it('a benched man: the suggestion is stored as shown; the manager’s pick wins; two parts on one man is flagged',()=>{
  const five=[FIVE[0],id(6),FIVE[2],FIVE[3],FIVE[4]];
  const h=handovers([m],five,{});
  expect(h[0].missing).toEqual([{slot:2,id:FIVE[1],assigned:id(6),chosen:false}]);
  expect(moveLineups(h)).toEqual({m1:{'2':id(6)}});
  const picked=handovers([m],five,{m1:{'2':FIVE[4]}});
  expect(picked[0].missing[0]).toMatchObject({assigned:FIVE[4],chosen:true});
  expect(handovers([m],five,{m1:{'2':FIVE[3]}})[0].dup).toBe(true);
 });
 it('a practice match carries the same handover the prep stores',()=>{
  const five=[FIVE[0],id(6),FIVE[2],FIVE[3],FIVE[4]];
  const f=frozenMoves([m],five,{});
  expect(f).toEqual([{idea:'m1',key:'move:m1',name:'Move m1',plan:m.plan,lineup:FIVE,accent:80,assign:{'2':id(6)}}]);
 });
});

describe('the plan list',()=>{
 it('counts finished matches per plan from the frozen snapshot, never a detached one',()=>{
  const preps=[prep({round_id:'r1',plan_snapshot:{id:'p1'} as never}),prep({round_id:'r2',plan_snapshot:{id:'p1'} as never}),
   prep({round_id:'r3',plan_snapshot:{id:'p1'} as never}),prep({round_id:'r4',plan_snapshot:{id:'p2',detached:'paused'} as never})];
  const n=timesPlayed(preps,new Set(['r1','r2','r4']));
  expect(n.get('p1')).toBe(2);expect(n.get('p2')).toBeUndefined();
  expect([playedLine(0),playedLine(1),playedLine(3)]).toEqual(['Not played yet','Played once','Played 3 times']);
 });
 it('a free name for a setup saved as a plan',()=>{
  expect(freeName('Round 6 setup',['Home plan'])).toBe('Round 6 setup');
  expect(freeName('Round 6 setup',['round 6 SETUP','Round 6 setup 2'])).toBe('Round 6 setup 3');
 });
});

describe('scouting: danger men',()=>{
 const tl=(id:string,goals:number,assists:number,shots=0,matches=3)=>({id,matches,goals,assists,saves:0,shots});
 it('the leader of a count, or the two who share it; nobody on zero',()=>{
  const ts=[tl('a',9,4,10),tl('b',9,1,14),tl('c',7,11),tl('d',9,0,2)];
  expect(scoutLeaders(ts,'goals').map(t=>t.id)).toEqual(['b','a']);
  expect(scoutLeaders(ts,'assists').map(t=>t.id)).toEqual(['c']);
  expect(scoutLeaders([tl('a',0,0)],'goals')).toEqual([]);
  expect(scoutLeaders([],'assists')).toEqual([]);
 });
});

describe('practice words',()=>{
 it('the opponent line follows where their side comes from, and never promises their moves',()=>{
  // where their side comes from, and which five of theirs the player chose, each its own line (the words are copy)
  expect(new Set([opponentLine('last_match'),opponentLine('ai'),opponentLine('generic'),opponentLine('last_match','likely'),opponentLine('last_match','pick')]).size).toBe(5);
  expect(opponentLine('ai','pick')).toBe(opponentLine('last_match','pick'));
  expect(opponentLine('last_match')).not.toMatch(/move/i);
 });
 it('a move’s line after the practice',()=>{
  expect(moveLine({tried:0,to_plan:0,half:0,broke:0,shot:0,goal:0})).toBe('Never came up');
  expect(moveLine({tried:27,to_plan:11,half:9,broke:7,shot:4,goal:1})).toBe('Came up 27 times · to plan 11 · half 9 · broke down 7 · 4 shots · 1 goal');
  expect(moveLine({tried:3,to_plan:2,half:0,broke:1,shot:0,goal:0})).toBe('Came up 3 times · to plan 2 · broke down 1');
 });
});
