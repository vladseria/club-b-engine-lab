// Board trim (owner, 15 Oct 2026): formation 2-1-1, Bodies forward 1 and 2 and
// On losing it Regroup are no longer offered. A club's current setup that still
// stores one reads as what now plays (2-1-1 -> 1-2-1, 1/2 -> 3, Regroup ->
// Balanced) through approach.ts boardFormation/boardApproach, applied only in
// plans.ts plan(), data.ts myClub and (boardSide) data.ts practiceSide. Frozen
// inputs never go through them: the engine keeps playing the old values, so an
// old match replays exactly.
//   npx vitest run verificare/ballers-board-trim.test.ts
import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {computeMatch,engineTeam,ENGINE_BUILD,type FrozenInput,type FrozenSide} from '../lib/ballers/compute';
import {demoSide,frozenSide,scratchSide,tacticsOf} from '../lib/ballers/lab/team';
import {BOARD_FORMATIONS,PRESETS,boardApproach,boardFormation} from '../lib/ballers/league';
import {boardSide} from '../lib/ballers/approach';
import {SETTINGS,optionOf,planUsage} from '../lib/ballers/plan-bands';
import type {Plan,PlanPrep} from '../lib/ballers/plans';
import type {Result} from '../lib/ballers/league';

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const asPlayers=(side:ReturnType<typeof demoSide>)=>side.team.squad.map((p,i)=>({id:p.id,club_id:side.team.id,space:'test',name:p.name,short:side.players[i].short,number:i+1,roles:p.roles,archetype:'motor' as const,temperament:'cold' as const,note:p.note||'x',skills:p.skills,traits:p.traits,energy:p.energy,portrait:side.players[i].portrait,founder:false}));
const home=demoSide(),away=scratchSide();
const OLD_HOME={progression:'mixed',width:'wide',line:'standard',press:'balanced',commit:1,striker:'mixed',transition:'balanced',onLoss:'regroup'} as const;
const OLD_AWAY={progression:'direct',width:'wide',line:'standard',press:'aggressive',commit:2,striker:'run',transition:'balanced',onLoss:'regroup'} as const;
/** An input as ballers_freeze_match wrote it before the trim: 2-1-1, 1 forward, Regroup v 2-2, 2 forward, Regroup. */
function oldInput():FrozenInput{
 const sides:[FrozenSide,FrozenSide]=[
  frozenSide({id:'home',name:'Home',code:'HOM',color:'#FF3D7F'},asPlayers(home),{lineup:home.team.lineup,formation:'2-1-1',style:'balanced',approach:OLD_HOME,captain:null}),
  frozenSide({id:'opp',name:'Opp',code:'OPP',color:'#C9CCD2'},asPlayers(away),{lineup:away.team.lineup,formation:'2-2',style:'direct',approach:OLD_AWAY,captain:null})];
 return {v:1,match:'board-trim',seed:9157,kickoff:0,duration:90,sides};
}

describe('frozen matches play exactly as before the trim',()=>{
 it('the engine still receives 2-1-1, 1 and 2 forward and Regroup from a frozen input',()=>{
  const [h,a]=oldInput().sides.map(engineTeam);
  expect([h.tactics.formation,h.tactics.commit,h.tactics.onLoss]).toEqual(['2-1-1',1,'regroup']);
  expect([a.tactics.formation,a.tactics.commit,a.tactics.onLoss]).toEqual(['2-2',2,'regroup']);
  // the Lab's tactics builder too
  expect([tacticsOf('2-1-1',OLD_HOME).formation,tacticsOf('2-1-1',OLD_HOME).commit,tacticsOf('2-1-1',OLD_HOME).onLoss]).toEqual(['2-1-1',1,'regroup']);
 });
 // The match computed from that input on c707eccd (before this change) on ENGINE_BUILD 76d73f5c. A new engine
 // build changes every match, so the pin applies to that build only; the test above guards the path for any build.
 it.runIf(ENGINE_BUILD.startsWith('76d73f5c'))('the whole match is byte-identical to the one computed before the trim',()=>{
  expect(hash(computeMatch(oldInput()).compact)).toBe('c781e637af053536a37959852a5114381f7c9d186ab4b2a30d7b02b8792cd154');
 },120_000);
});

describe('the board offers only what is still a choice',()=>{
 it('formations 1-2-1 and 2-2; Bodies forward 3, 4, 5; On losing it Balanced, Counter-press',()=>{
  expect(BOARD_FORMATIONS).toEqual(['1-2-1','2-2']);
  expect(SETTINGS.commit.options.map(o=>o.value)).toEqual(['3','4','5']);
  expect(SETTINGS.onLoss.options.map(o=>o.value)).toEqual(['balanced','counterpress']);
  // no style starts from a retired value
  for(const p of Object.values(PRESETS)){expect(p.commit).toBeGreaterThanOrEqual(3);expect(p.onLoss).not.toBe('regroup');}
 });
 it('a stored current setup reads as what now plays; everything else is untouched',()=>{
  expect(boardFormation('2-1-1')).toBe('1-2-1');expect(boardFormation('2-2')).toBe('2-2');expect(boardFormation('1-2-1')).toBe('1-2-1');
  expect(boardApproach(OLD_HOME)).toEqual({...OLD_HOME,commit:3,onLoss:'balanced'});
  expect(boardApproach({...OLD_HOME,commit:5,onLoss:'counterpress'})).toEqual({...OLD_HOME,commit:5,onLoss:'counterpress'});
  const keep={...PRESETS.direct};expect(boardApproach(keep)).toBe(keep);
  // a past prep that played a retired option still shows its own name
  expect(optionOf('onLoss','regroup').label).toBe('Regroup');expect(optionOf('commit','1').label).toBe('1');
 });
 it('another club played in practice as in their last game plays what its next match plays',()=>{
  // Malpraxis, 16 Oct: last game 2-1-1 Counter; practice showed and played 2-1-1, freeze plays 1-2-1
  const last={formation:'2-1-1',style:'counter',approach:{...PRESETS.counter,commit:2,onLoss:'regroup'},lineup:['a'],captain:'a',source:'last_match'} as const;
  expect(boardSide(last)).toEqual({...last,formation:'1-2-1',approach:{...PRESETS.counter,commit:3,onLoss:'balanced'}});
  const now={...last,formation:'2-2',approach:{...PRESETS.counter}} as const;expect(boardSide(now)).toBe(now);
 });
 it('a Home plan made from a 2-1-1 setup still counts exactly the matches it played before plans',()=>{
  // plan() hands the screens 1-2-1 and 3 forward and keeps the row's own values in `stored`
  const stored={...PRESETS.balanced,commit:1 as const};
  const plan={id:'h',origin:'home',migrated_at:'2026-10-10T00:00:00Z',version:1,formation:'1-2-1',based_on:'balanced',settings:boardApproach(stored),set_pieces:{},stored:{formation:'2-1-1',settings:stored}} as unknown as Plan;
  // r1 played that 2-1-1 setup; r2 played 1-2-1 with 3 forward, which is not what the plan was made from
  const preps=[{round_id:'r1',plan_id:null,plan_snapshot:null,formation:'2-1-1',approach:stored},{round_id:'r2',plan_id:null,plan_snapshot:null,formation:'1-2-1',approach:boardApproach(stored)}] as unknown as PlanPrep[];
  const res=(round:string,day:string)=>({match_id:round,round_id:round,home_club:'c',away_club:'x',live_from:`2026-10-0${day}T18:00:00Z`,visible_from:`2026-10-0${day}T18:15:00Z`});
  // exactly r1: one match, and the last one counted is r1's, not r2's
  const u=planUsage(plan,preps,[res('r1','1'),res('r2','2')] as unknown as Result[],'c',Date.parse('2026-10-12T00:00:00Z'));
  expect(u.before).toBe(1);expect(u.last).toBe('2026-10-01T18:00:00Z');
 });
});
