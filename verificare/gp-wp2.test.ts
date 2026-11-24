// Game plan WP2: the pure half of moves (lib/ballers/moves.ts). Real engine
// validation (validatePlans, compute.sidePlans, one rehearsal go), no mocks.
//   npx vitest run verificare/gp-wp2.test.ts
import {describe,it,expect} from 'vitest';
import fixtureJson from '../lib/ballers/lab/practice-fixture.json';
import {validatePlans} from '../packages/football-engine/src/index';
import {sidePlans,type FrozenSide} from '../lib/ballers/compute';
import {GO_SECONDS,STOCK_SCENES,countGo,runScenes} from '../lib/ballers/scenes';
import {PRESETS,type Idea} from '../lib/ballers/league';
import {MAX_MOVES,NEW_MOVE_EMPHASIS,type PlanMove} from '../lib/ballers/plans';
import type {LabPlan} from '../lib/ballers/lab/model';
import {
 MovesFull,ONE_TWO_KEY,TEMPLATES,addTo,answerPart,boardPlan,ideaMove,inPlansLine,moveSentence,offJobs,partAnswer,partSlot,partsOf,plansWith,
 refreshFromSaved,replaceIn,resolveMove,sameMove,savedIsNewer,savedParam,shelves,slotsMoved,swapSlots,templateFor,templateMove,templateOf,withOffJob,
} from '../lib/ballers/moves';

type FixturePlayer={id:string;name:string;roles:string[];skills:Record<string,number>;traits:Record<string,number>;energy:number;note:string;archetype?:string;temperament?:string};
const FIX=fixtureJson as unknown as {teams:{id:string;name:string;lineup:string[];squad:FixturePlayer[];tactics:{formation:'1-2-1'}}[]};
const LINEUP=FIX.teams[0].lineup;
function side(i:0|1,plans:FrozenSide['plans']=[]):FrozenSide{
 const t=FIX.teams[i];
 return {club:{id:t.id,name:t.name,code:i?'OPP':'YOU',color:'#000000'},formation:t.tactics.formation,style:'balanced',approach:PRESETS.balanced,captain:t.lineup[1],lineup:[...t.lineup],
  bench:t.squad.filter(p=>!t.lineup.includes(p.id)).map(p=>p.id),
  players:t.squad.map((p,n)=>({id:p.id,name:p.name,short:p.name.split(' ')[0],number:n+1,roles:p.roles as never,skills:p.skills as never,traits:p.traits as never,energy:p.energy,archetype:p.archetype??'',temperament:p.temperament??'',note:p.note,portrait:'p0001'})),plans};
}
const frozen=(m:PlanMove)=>({idea:m.id,key:m.key,name:m.name,plan:m.plan,lineup:m.lineup,accent:m.emphasis,assign:{}});
const valid=(p:unknown)=>validatePlans([p])[0] as LabPlan;
let n=0;const uid=()=>`c-test-${++n}`;
const tpl=(k:string)=>templateOf(k)!;
const behind=()=>tpl('starter-in-behind').plan();
const NAMES=(s:number)=>['','Keeper','Bidinea','Tramvai','Garoafă','Pantofaru'][s];

describe('ready-made moves',()=>{
 it('every template is a valid board plan with one or two who questions',()=>{
  for(const t of TEMPLATES){
   const p=t.plan();
   expect(()=>valid(p)).not.toThrow();
   expect(t.parts.length).toBeGreaterThanOrEqual(1);
   expect(t.parts.length).toBeLessThanOrEqual(2);
   for(const q of t.parts)expect(partSlot(p,q)).not.toBeNull();
   expect(templateFor({plan:p})?.key).toBe(t.key);
  }
 });
 it('starts with "whoever fits" where the move has a flexible role',()=>{
  const p=behind();
  expect(tpl('starter-in-behind').parts.map(q=>partAnswer(p,q))).toEqual(['any','any']);
  const one=tpl(ONE_TWO_KEY);
  expect(one.parts.map(q=>partAnswer(one.plan(),q))).toEqual([3,5]);
 });
 it('a copy for a plan gets a fresh id and key, keenness "Often", and starts anywhere',()=>{
  const m=templateMove(tpl('starter-lay-off'),LINEUP);
  expect(m.key).toBe(`move:${m.id}`);
  expect(m.plan.id).toBe(m.key);
  expect(m.emphasis).toBe(NEW_MOVE_EMPHASIS);
  expect(m.start).toBe('any');
  expect(m.lineup).toEqual(LINEUP);
  // a copy is still recognised as its template (by its job ids), so its questions and clip follow it
  expect(templateFor(m)?.key).toBe('starter-lay-off');
 });
});

describe('answering who',()=>{
 it('the clip follows the answers: each recorded slot maps to the one now doing its job (a whole permutation)',()=>{
  const [runner,passer]=tpl('starter-in-behind').parts,base=behind();
  const was=partSlot(base,runner)!,p=answerPart(base,runner,2);
  const m=slotsMoved(base,p);
  expect(m[was]).toBe(2);
  expect(m[1]).toBe(1);
  expect(Object.values(m).sort()).toEqual([1,2,3,4,5]);
  // two answers: still one man per slot, and each part's recorded man lands on its answer
  const q=answerPart(p,passer,5),n=slotsMoved(base,q);
  expect(n[partSlot(base,passer)!]).toBe(5);
  expect(Object.values(n).sort()).toEqual([1,2,3,4,5]);
  expect(slotsMoved(base,base)).toEqual({1:1,2:2,3:3,4:4,5:5});
 });
 it('naming the runner moves his job to that slot and makes it fixed',()=>{
  const [runner,passer]=tpl('starter-in-behind').parts;
  const p=answerPart(behind(),runner,4);
  expect(partSlot(p,runner)).toBe(4);
  expect(partAnswer(p,runner)).toBe(4);
  expect(p.lesson.roles?.[4]).toBeUndefined();
  expect(partAnswer(p,passer)).toBe('any');
  // the anchored space follows the runner
  expect(p.lesson.spaces.find(s=>s.id==='behind')?.anchor?.number).toBe(4);
  expect(()=>valid(p)).not.toThrow();
  // and back to whoever fits
  const q=answerPart(p,runner,'any');
  expect(partAnswer(q,runner)).toBe('any');
  expect(q.lesson.roles?.[4]).toBe('runner');
 });
 it('naming the passer as the runner\'s man swaps the two parts',()=>{
  const [runner,passer]=tpl('starter-in-behind').parts;
  const p=answerPart(behind(),passer,5);
  expect(partSlot(p,passer)).toBe(5);
  expect(partSlot(p,runner)).toBe(3);
  expect(partAnswer(p,runner)).toBe('any');
  expect(()=>valid(p)).not.toThrow();
 });
 it('the one-two swaps its pair rather than naming one man twice',()=>{
  const [a,b]=tpl(ONE_TWO_KEY).parts,p0=tpl(ONE_TWO_KEY).plan();
  const p=answerPart(p0,a,5);
  expect([partSlot(p,a),partSlot(p,b)]).toEqual([5,3]);
  const q=answerPart(p,b,2);
  expect([partSlot(q,a),partSlot(q,b)]).toEqual([5,2]);
  expect(()=>valid(q)).not.toThrow();
 });
 it('the carrier role stays one player\'s',()=>{
  const p=behind();p.lesson.roles={3:'carrier',5:'runner',2:'carrier'};
  const q=answerPart(p,tpl('starter-in-behind').parts[1],'any');
  expect(Object.values(q.lesson.roles!).filter(r=>r==='carrier')).toHaveLength(1);
 });
 it('swapSlots moves every reference, off-the-ball jobs included',()=>{
  const p=withOffJob(behind(),{slot:2,kind:'mark',opponent:4},uid);
  swapSlots(p,2,4);
  expect(offJobs(p)[0].actor).toBe(4);
  expect(()=>valid(p)).not.toThrow();
 });
 it('a drawn move asks about its first job with the ball and its first job off it',()=>{
  const p=behind();p.id='c-drawn';p.lesson.jobs=p.lesson.jobs.map(j=>({...j,id:`x-${j.id}`}));
  p.lesson.moments=p.lesson.moments.map(m=>m.cue.kind==='received'?{...m,cue:{...m.cue,jobId:`x-${m.cue.jobId}`}}:m);
  for(const j of p.lesson.jobs)if(typeof j.actor!=='number')j.actor={receiverOf:`x-${j.actor.receiverOf}`};
  const parts=partsOf({plan:p});
  expect(parts.map(q=>q.ask)).toEqual(['Who plays the pass?','Who makes the run?']);
  expect(parts.map(q=>partAnswer(p,q))).toEqual(['any','any']);
 });
 it('a routine asks nobody (its spots are its players)',()=>{
  const p=behind();(p.lesson as {scene?:unknown}).scene={restart:'corner',side:'any',ball:{x:47,y:-14},taker:3,spots:[]};
  expect(partsOf({plan:p})).toEqual([]);
 });
});

describe('off the ball',()=>{
 it('one player, one job; a zone job gets a zone and the engine accepts it',()=>{
  const p=withOffJob(behind(),{slot:2,kind:'protect'},uid);
  const jobs=offJobs(p);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({actor:2,kind:'protect',phase:'defending'});
  expect(p.lesson.spaces.some(s=>s.id===jobs[0].spaceId)).toBe(true);
  expect(()=>valid(p)).not.toThrow();
  // another player replaces him (one job on this page); press needs no zone, so the zone goes
  const q=withOffJob(p,{slot:4,kind:'press'},uid);
  expect(offJobs(q)).toEqual([expect.objectContaining({actor:4,kind:'press',phase:'defending'})]);
  expect(q.lesson.spaces.some(s=>s.id===jobs[0].spaceId)).toBe(false);
  expect(()=>valid(q)).not.toThrow();
  // stay up is for all game; clearing removes the job
  expect(offJobs(withOffJob(q,{slot:4,kind:'stay-forward'},uid))[0].phase).toBe('always');
  expect(offJobs(withOffJob(q,null,uid))).toEqual([]);
 });
 it('keeps the zone where it was placed while the kind stays the same',()=>{
  const p=withOffJob(behind(),{slot:2,kind:'protect'},uid),zone=offJobs(p)[0].spaceId!;
  p.lesson.spaces.find(s=>s.id===zone)!.x=6;
  const q=withOffJob(p,{slot:2,kind:'protect',phase:'always'},uid);
  expect(offJobs(q)[0]).toMatchObject({spaceId:zone,phase:'always'});
  expect(q.lesson.spaces.find(s=>s.id===zone)!.x).toBe(6);
 });
 it('a move carrying several jobs (an old Lab idea) keeps the others',()=>{
  let p=behind();
  p=withOffJob(p,{slot:2,kind:'protect'},uid);
  p.standing!.push({id:'b',actor:4,kind:'stay-forward',phase:'always',spaceId:'behind'});
  const q=withOffJob(p,{slot:4,kind:'press'},uid);
  expect(offJobs(q).map(j=>[j.actor,j.kind])).toEqual([[2,'protect'],[4,'press']]);
 });
});

describe('copies in a plan',()=>{
 const idea:Idea={id:'11111111-1111-4111-8111-111111111111',club_id:'c',plan_key:'c-mine',name:'Drive and slip',plan:{...tpl('starter-drive-slip').plan(),id:'c-mine',emphasis:.5},lineup:LINEUP,updated_at:'2026-10-01T10:00:00Z'};
 it('a saved move copies with its own keenness and remembers where it came from',()=>{
  const m=ideaMove(idea);
  expect(m.emphasis).toBe(50);
  expect(m.from_move).toBe(idea.id);
  expect(m.from_updated_at).toBe(idea.updated_at);
  expect(m.plan.id).toBe(m.key);
  expect(savedIsNewer(m,idea)).toBe(false);
  // a rename (or a save that drew the same thing) is not a new version
  expect(savedIsNewer(m,{updated_at:'2026-10-02T10:00:00Z',plan:{...idea.plan,name:'Renamed'}})).toBe(false);
  // drawn differently and saved later: a new version
  const redrawn=answerPart(boardPlan(idea.plan)!,tpl('starter-drive-slip').parts[1],4);
  expect(savedIsNewer(m,{updated_at:'2026-10-02T10:00:00Z',plan:{...redrawn,id:'c-mine'}})).toBe(true);
  expect(savedIsNewer(m,{updated_at:'2026-09-30T10:00:00Z',plan:{...redrawn,id:'c-mine'}})).toBe(false);
  const r=refreshFromSaved({...m,emphasis:100},{...idea,name:'Drive and slip 2',updated_at:'2026-10-02T10:00:00Z'});
  // keeps the copy's own name (a rename isn't a version), id, key and keenness
  expect(r).toMatchObject({id:m.id,key:m.key,emphasis:100,name:m.name,from_updated_at:'2026-10-02T10:00:00Z'});
  expect(r.plan.id).toBe(m.key);
 });
 it('using the new version keeps the copy\'s answers where they still fit, and its job off the ball',()=>{
  const t=tpl('starter-drive-slip'),m=ideaMove(idea);
  // the copy names slot 2 as the runner and gives slot 3 a job off the ball
  let own=answerPart(boardPlan(m.plan)!,t.parts[1],2);
  own=withOffJob(own,{slot:3,kind:'protect'},uid);
  const copyNow={...m,plan:{...own,id:m.key} as PlanMove['plan']};
  // the saved move is redrawn: the driver is now named (slot 4); no job off the ball
  const saved={...idea,updated_at:'2026-10-02T10:00:00Z',plan:{...answerPart(boardPlan(idea.plan)!,t.parts[0],4),id:'c-mine'}};
  const r=refreshFromSaved(copyNow,saved),rp=boardPlan(r.plan)!;
  expect(partAnswer(rp,t.parts[1])).toBe(partAnswer(own,t.parts[1]));
  expect(offJobs(rp).map(j=>[j.actor,j.kind])).toEqual(offJobs(own).map(j=>[j.actor,j.kind]));
  expect(rp.lesson.spaces.some(z=>z.id===offJobs(rp)[0].spaceId)).toBe(true);
 });
 it(`a plan holds ${MAX_MOVES}; the fourth needs one taken out, in its place`,()=>{
  const ms=[0,1,2].map(()=>templateMove(tpl('starter-recycle'),LINEUP));
  const extra=templateMove(tpl('starter-in-behind'),LINEUP);
  expect(()=>addTo(ms,extra)).toThrow(MovesFull);
  const swapped=addTo(ms,extra,ms[1].id);
  expect(swapped.map(m=>m.id)).toEqual([ms[0].id,extra.id,ms[2].id]);
  expect(addTo(ms.slice(0,2),extra)).toHaveLength(3);
  expect(replaceIn(ms,{...ms[2],name:'x'})[2].name).toBe('x');
 });
 it('editing one plan\'s copy never touches another plan\'s',()=>{
  const a=ideaMove(idea),b=ideaMove(idea);
  const edited={...a,plan:{...answerPart(boardPlan(a.plan)!,tpl('starter-drive-slip').parts[1],2),id:a.key} as PlanMove['plan']};
  const planA=replaceIn([a],edited),planB=[b];
  expect(planB[0].plan).toEqual(b.plan);
  expect(sameMove(planA[0].plan,planB[0].plan)).toBe(false);
  expect(a.id).not.toBe(b.id);
 });
 it('says which plans hold a copy',()=>{
  const plans=[{name:'Home plan',moves:[ideaMove(idea)]},{name:'Chase',moves:[ideaMove(idea)]},{name:'Hold on',moves:[]}];
  expect(inPlansLine(plansWith(idea.id,plans))).toBe('In Home plan, Chase');
  expect(inPlansLine(plansWith('other',plans))).toBe('Not in a plan');
 });
 it('finds the move a page asks for: the plan\'s copy, a ready-made move, one of Your moves',()=>{
  const own=ideaMove(idea),plan={moves:[own]};
  expect(resolveMove(own.id,plan,[idea]).kind).toBe('plan');
  expect(resolveMove('starter-recycle',plan,[idea]).kind).toBe('template');
  expect(resolveMove(savedParam(idea.id),plan,[idea]).kind).toBe('saved');
  expect(resolveMove('nope',plan,[idea]).kind).toBe('gone');
 });
 it('puts moves the board can\'t open on the old-board shelf',()=>{
  const old={...idea,id:'o',plan:{id:'legacy',name:'Old',instructions:[{}]}};
  const {board,old:shelf}=shelves([idea,old]);
  expect(board.map(i=>i.id)).toEqual([idea.id]);
  expect(shelf.map(i=>i.id)).toEqual(['o']);
 });
 it('sameMove ignores the name, key and keenness',()=>{
  const p=behind();
  expect(sameMove(p,{...p,id:'other',name:'other',emphasis:.1})).toBe(true);
  expect(sameMove(p,answerPart(p,tpl('starter-in-behind').parts[0],2))).toBe(false);
 });
});

describe('the sentence says what they look for',()=>{
 it('names the players you picked, and never promises',()=>{
  const [runner]=tpl('starter-in-behind').parts;
  const said=moveSentence({plan:answerPart(behind(),runner,5)},NAMES);
  expect(said).toContain('Pantofaru can get in behind');
  expect(said).toContain('look to');
  expect(moveSentence({plan:behind()},NAMES)).toContain('you have the ball and a runner');
 });
});

describe('a copy plays in the engine',()=>{
 it('an answered template with a job off the ball is never dropped, and a go starts it',()=>{
  const [runner]=tpl('starter-in-behind').parts;
  const base=templateMove(tpl('starter-in-behind'),LINEUP);
  const plan=withOffJob(answerPart(boardPlan(base.plan)!,runner,4),{slot:2,kind:'protect'},uid);
  const m:PlanMove={...base,plan:{...plan,id:base.key} as PlanMove['plan']};
  const ours=side(0,[frozen(m)]);
  expect(sidePlans(ours).dropped).toEqual([]);
  const res=runScenes({type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups:[STOCK_SCENES[0].setup(),STOCK_SCENES[1].setup()],seeds:[11,12],duration:GO_SECONDS});
  expect(res.goes!.some(g=>countGo(g.with,m.key).startAt!==null)).toBe(true);
 },120000);
});
