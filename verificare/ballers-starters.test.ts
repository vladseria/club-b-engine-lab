// Ready-made ideas: every starter is an ordinary Lab plan (the engine's
// validatePlans, the club's IDEA_ID, prep's resolveIdea), it actually gets
// tried in a real match (the official computeMatch path practice and league
// matches share), and one tap saves it and switches it on through the same
// doors the Lab uses, respecting the 12-idea and 3-per-match caps.
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {validatePlans} from '../packages/football-engine/src/index';
import {STARTERS} from '../lib/ballers/lab/starters';
import * as M from '../lib/ballers/lab/model';
import {resolveIdea} from '../lib/ballers/ideas';
import {computeMatch,type FrozenInput} from '../lib/ballers/compute';
import {demoSide,frozenSide,scratchSide} from '../lib/ballers/lab/team';

const db=vi.hoisted(()=>({labSave:vi.fn(),loadMine:vi.fn(),savePrep:vi.fn()}));
vi.mock('../lib/ballers/data',async orig=>({...(await orig<typeof import('../lib/ballers/data')>()),...db}));
import {IDEA_ID} from '../lib/ballers/data';
import {adoptStarter,nextMatchRoom,starterState} from '../lib/ballers/starter-save';

const LINEUP=['gk','a','b','c','d'];
describe('Ballers starters: the real idea format',()=>{
 it('there are a few, with distinct stable keys and names',()=>{
  expect(STARTERS.length).toBeGreaterThanOrEqual(3);expect(STARTERS.length).toBeLessThanOrEqual(5);
  expect(new Set(STARTERS.map(s=>s.key)).size).toBe(STARTERS.length);expect(new Set(STARTERS.map(s=>s.name)).size).toBe(STARTERS.length);
 });
 for(const st of STARTERS)it(`${st.name}: validates like a drawn idea and re-points at another five`,()=>{
  const plan=st.plan();
  expect(plan.id).toBe(st.key);expect(IDEA_ID.test(plan.id)).toBe(true);
  const [checked]=validatePlans([plan]) as M.LabPlan[];
  expect(checked).toEqual(plan);// nothing is repaired on the way in
  expect(M.hasContent(plan)).toBe(true);
  expect(M.planSlots(plan.lesson,plan.standing).every(n=>n>=2&&n<=5)).toBe(true);
  const r=resolveIdea({plan:plan as never,lineup:LINEUP},['gk','d','c','b','a']);
  expect(r.issues).toEqual([]);expect(()=>validatePlans([r.plan])).not.toThrow();
 });
});

describe('Ballers starters: each one gets tried in a real match',()=>{
 const asPlayers=(side:ReturnType<typeof demoSide>)=>side.team.squad.map((p,i)=>({id:p.id,club_id:side.team.id,space:'test',name:p.name,short:side.players[i].short,number:i+1,roles:p.roles,archetype:'motor',temperament:'cold',note:p.note||'x',skills:p.skills,traits:p.traits,energy:p.energy,portrait:side.players[i].portrait,founder:false})) as never;
 const home=demoSide(),away=scratchSide();
 const club=(s:typeof home,id=s.team.id)=>({id,name:s.team.name,code:'ABC',color:'#123456'});
 const approach={progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'} as const;
 for(const st of STARTERS)it(`${st.name} is attempted at least once in five minutes`,()=>{
  const plan=validatePlans([st.plan()])[0];
  const input:FrozenInput={v:1,match:`starter-${st.key}`,seed:1,kickoff:1,duration:300,sides:[
   frozenSide(club(home),asPlayers(home),{lineup:home.team.lineup,formation:'1-2-1',style:'balanced',approach,captain:null},[{idea:'i',key:plan.id,name:plan.name,plan:plan as never,lineup:home.team.lineup,accent:80}]),
   frozenSide(club(away,'opp'),asPlayers(away),{lineup:away.team.lineup,formation:'2-1-1',style:'direct',approach:{...approach,progression:'direct',press:'aggressive'},captain:null})]};
  const r=computeMatch(input);
  expect(r.dropped).toEqual([]);
  const mine=r.compact.ideas.filter(i=>i.side===0&&i.planId===plan.id);
  expect(mine.filter(i=>i.progress==='attempted').length).toBeGreaterThan(0);
 },120000);
});

describe('Ballers starters: one tap',()=>{
 const st=STARTERS[0];
 const idea=(over:object={})=>({id:'row-1',club_id:'c',plan_key:st.key,name:st.name,plan:st.plan() as never,lineup:LINEUP,updated_at:'',...over});
 const prep={lineup:LINEUP,captain:'a',formation:'1-2-1' as const,style:'balanced' as const,approach:{} as never,ideas:['x'],accents:{x:60}};
 beforeEach(()=>{db.labSave.mockReset().mockResolvedValue({ideas:1,prep:'skipped',round:null});db.savePrep.mockReset().mockResolvedValue({});db.loadMine.mockReset().mockResolvedValue({club:null,prep:[],ideas:[idea()]});});
 it('saves a new starter, then switches it on next to the ideas already on, at its own emphasis',async()=>{
  const r=await adoptStarter('test',st,[],LINEUP,{round:'r1',prep});
  expect(r.on).toBe(true);
  expect(db.labSave).toHaveBeenCalledWith('test',[{plan:st.plan(),lineup:LINEUP,enabled:false}],null,[]);
  expect(db.savePrep).toHaveBeenCalledWith('r1',{...prep,ideas:['x','row-1'],accents:{x:60,'row-1':80}});
 });
 it('never re-posts a starter the club already has (its Lab edits stay); it only switches it on',async()=>{
  const r=await adoptStarter('test',st,[idea({name:'My version'})],LINEUP,{round:'r1',prep});
  expect(r).toEqual({on:true,name:'My version'});expect(db.labSave).not.toHaveBeenCalled();expect(db.loadMine).not.toHaveBeenCalled();
 });
 it('with no open round or three ideas on, it is only saved',async()=>{
  expect((await adoptStarter('test',st,[],LINEUP,null)).on).toBe(false);
  expect((await adoptStarter('test',st,[],LINEUP,{round:'r1',prep:{...prep,ideas:['x','y','z']}})).on).toBe(false);
  expect(db.savePrep).not.toHaveBeenCalled();expect(db.labSave).toHaveBeenCalledTimes(2);
 });
 it('refuses a thirteenth idea',async()=>{
  const twelve=Array.from({length:12},(_,i)=>idea({id:`i${i}`,plan_key:`k${i}`}));
  await expect(adoptStarter('test',st,twelve,LINEUP,{round:'r1',prep})).rejects.toThrow('max_12_ideas');
  expect(db.labSave).not.toHaveBeenCalled();
 });
 it('states and room',()=>{
  expect(starterState(st,[],[])).toBe('new');expect(starterState(st,[idea()],[])).toBe('saved');expect(starterState(st,[idea()],['row-1'])).toBe('on');
  expect(nextMatchRoom(null,false,0)).toBe('no-round');expect(nextMatchRoom({id:'r'},true,0)).toBe('locked');expect(nextMatchRoom({id:'r'},false,3)).toBe('full');expect(nextMatchRoom({id:'r'},false,2)).toBeNull();
 });
});
