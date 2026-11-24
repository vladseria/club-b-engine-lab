// Ballers set-piece routines: the Lab's routine editing (a restart scene on
// the board, spots, taker, sides, thirds), the idea model's slot re-pointing
// for a routine, the prep's resolveIdea, the run classifier's spot parts and
// the official path (a routine plan survives sidePlans and plays its corner).
import {describe,it,expect} from 'vitest';
import {createRestartSetup,createTrainingSetup,practicePlayers,runTraining,validatePlans,validateTrainingSetup} from '../packages/football-engine/src/index';
import * as M from '../lib/ballers/lab/model';
import {editorPlan,blankBoard} from '../lib/ballers/lab/editor';
import {resolveIdea} from '../lib/ballers/ideas';
import {ideaRunFacts,routineUnkicked} from '../lib/ballers/idea-run';
import {beatsOf} from '../lib/ballers/lab/beats';
import {sceneLine,cueText} from '../lib/ballers/lab/text';
import {demoSide,trialFixture} from '../lib/ballers/lab/team';

const side=demoSide(),players=practicePlayers(trialFixture(side.team,1));
const names=(n:number)=>`P${n}`;
/** The Lab's "Where → Corner" on a board that already has an open-play run for #5. */
function cornerBoard(){
 const b=blankBoard();
 b.plan.lesson.spaces.push({id:'near',name:'Near post',x:45,y:-3.5,radius:2.5});
 b.plan.lesson.jobs.push({id:'go',momentId:'start',actor:5,kind:'run',spaceId:'near'});
 b.setup=createRestartSetup('corner',players,{side:'left',taker:3});b.scene='corner';
 M.setRoutine(b.plan,{restart:'corner',side:'any'},b.setup);
 return b;
}

describe('the Lab turns an idea into a set-piece routine',()=>{
 it('adds the kick, files everyone but the taker under it and reads the spots from the board',()=>{
  const b=cornerBoard(),l=b.plan.lesson;
  expect(l.scene?.taker).toBe(3);
  expect(l.moments.map(m=>m.cue.kind)).toEqual(['start','restart-taken']);
  expect(l.jobs.find(j=>j.id==='go')?.momentId).toBe(M.kickMoment(l)!.id);
  expect(l.scene!.spots.map(q=>q.number)).toEqual([2,4,5]);
  expect(l.scene!.spots.every(q=>q.leash===M.LEASH.loose)).toBe(true);
  // What the engine takes validates, board and setup together.
  const plan=validatePlans([editorPlan(b,names)])[0];
  expect(plan.lesson?.scene?.restart).toBe('corner');
  expect(()=>validateTrainingSetup(b.setup,players)).not.toThrow();
  expect(cueText(l.moments[0],l,names)).toBe('The set-up');
  expect(cueText(l.moments[1],l,names)).toBe('At the kick');
  expect(sceneLine(l.scene!)).toBe('Corner, either side');
 });
 it('a job drawn for anyone but the taker in the set-up goes to the kick',()=>{
  const b=cornerBoard(),l=b.plan.lesson,kick=M.kickMoment(l)!.id;
  expect(M.routineMoment(l,'start',4)).toBe(kick);
  expect(M.routineMoment(l,'start',3)).toBe('start');
  expect(M.takerKinds('corner')).toEqual(['pass']);
  expect(M.takerKinds('freeKick')).toEqual(['pass','shoot']);
 });
 it('swapping the taker swaps jobs, spots and places; mirroring and shifting keep it valid',()=>{
  const b=cornerBoard();
  const p5=b.setup.poses.find(p=>p.side===0&&p.number===5)!,before={x:p5.x,y:p5.y};
  M.swapSlots(b.plan,b.setup,3,5);M.syncScene(b.plan.lesson,b.setup);
  expect(b.plan.lesson.scene!.taker).toBe(5);expect(b.setup.ball.number).toBe(5);
  expect(b.plan.lesson.jobs.find(j=>j.id==='go')?.actor).toBe(3);
  const p3=b.setup.poses.find(p=>p.side===0&&p.number===3)!;expect({x:p3.x,y:p3.y}).toEqual(before);
  M.mirrorRoutine(b.plan,b.setup);M.syncScene(b.plan.lesson,b.setup);
  expect(b.setup.ball.y).toBeGreaterThan(0);expect(b.plan.lesson.spaces[0].y).toBe(3.5);
  expect(()=>validatePlans([editorPlan(b,names)])).not.toThrow();
  expect(()=>validateTrainingSetup(b.setup,players)).not.toThrow();
  const fk=blankBoard();fk.setup=createRestartSetup('freeKick',players,{side:'right',zone:'attacking',taker:2});
  M.setRoutine(fk.plan,{restart:'freeKick',side:'any',zone:'attacking'},fk.setup);
  M.shiftRoutine(fk.plan,fk.setup,-9);fk.plan.lesson.scene!.zone='middle';M.syncScene(fk.plan.lesson,fk.setup);
  expect(fk.setup.ball.x).toBe(24);expect(()=>validatePlans([editorPlan(fk,names)])).not.toThrow();
 });
 it('back to open play: the kick moment and scene go, the runs return to the start',()=>{
  const b=cornerBoard();M.setRoutine(b.plan,null,b.setup);b.setup=createTrainingSetup('middle');
  expect(b.plan.lesson.scene).toBeUndefined();
  expect(b.plan.lesson.moments.map(m=>m.cue.kind)).toEqual(['start']);
  expect(b.plan.lesson.jobs.find(j=>j.id==='go')?.momentId).toBe('start');
  expect(()=>validatePlans([editorPlan(b,names)])).not.toThrow();
 });
 it('a saved routine comes back on its restart with its players on their spots',()=>{
  const b=cornerBoard(),plan=validatePlans([editorPlan(b,names)])[0] as M.LabPlan,sc=plan.lesson.scene!;
  const setup=M.sceneSetup(createRestartSetup(sc.restart,players,{ball:sc.ball,taker:sc.taker}),sc);
  for(const q of sc.spots){const p=setup.poses.find(x=>x.side===0&&x.number===q.number)!;expect([p.x,p.y]).toEqual([q.x,q.y]);}
  expect(()=>validateTrainingSetup(setup,players)).not.toThrow();
 });
});

describe('a routine in match prep and the official path',()=>{
 const lineup=['g','a','b','c','d'],target=['g','b','a','x','d'];
 const b=cornerBoard(),plan=validatePlans([editorPlan(b,names)])[0] as unknown as Record<string,unknown>;
 it('re-points its taker and spots at the match five (the keeper needs none)',()=>{
  const r=resolveIdea({plan,lineup},target);
  // #3 (b) is now #2; #2 (a) is #3; #4 (c) is missing and taken over by x (#4).
  const sc=(r.plan as unknown as M.LabPlan).lesson.scene!;
  expect(sc.taker).toBe(2);
  expect(sc.spots.map(q=>q.number).sort()).toEqual([3,4,5]);
  expect(r.missing.map(m=>m.slot)).toEqual([4]);
  expect(M.planSlots((plan as unknown as M.LabPlan).lesson)).not.toContain(1);
 });
 it('plays its corner in a watch: the spots and the kick run are judged, the beats say so',()=>{
  const p=validatePlans([editorPlan(b,names)]) as M.LabPlan[];
  const r=runTraining({fixture:trialFixture(side.team,7),durationSeconds:20,policy:'coordinated',setup:b.setup,playbook:{side:0,plans:p,adaptive:true}}).result;
  const sel=r.playbookSelections!.find(s=>s.planId===p[0].id)!;
  const facts=ideaRunFacts(sel,p[0].lesson)!;
  expect(facts.parts.filter(q=>q.kind==='spot').length).toBe(3);
  expect(facts.parts.find(q=>q.id==='go')?.due).toBe(true);
  const beats=beatsOf(sel,p[0].lesson,names,()=>'x',20);
  expect(beats.map(x=>x.title)).toEqual(expect.arrayContaining(['Step 1 · The set-up','Step 2 · At the kick']));
  expect(beats.find(x=>x.title==='Step 1 · The set-up')?.label).not.toBe('Not reached');
 });
});

describe('fix round 2026-09-29: the side follows the drawing; the kick decides the verdict',()=>{
 it('a one-sided routine switched to the other flank is used there (side and ball agree)',()=>{
  const b=cornerBoard(),sc=b.plan.lesson.scene!;
  sc.side='left';M.routineSide(b.plan,b.setup,'right');
  expect(b.setup.ball.y).toBeGreaterThan(0);expect(b.plan.lesson.scene!.side).toBe('right');
  expect(()=>validatePlans([editorPlan(b,names)])).not.toThrow();
  // Either side stays either side.
  const e=cornerBoard();M.routineSide(e.plan,e.setup,'right');expect(e.plan.lesson.scene!.side).toBe('any');
  // The engine refuses the old desync outright.
  const bad=cornerBoard();bad.plan.lesson.scene!.side='left';M.mirrorRoutine(bad.plan,bad.setup);M.syncScene(bad.plan.lesson,bad.setup);
  expect(()=>validatePlans([editorPlan(bad,names)])).toThrow(/side/);
 });
 // A routine: #3 crosses from the corner (start), #5 attacks at the kick, #2 and #4 hold spots.
 const lesson={scene:{restart:'corner' as const,side:'any' as const,ball:{x:47,y:-14.5},taker:3 as const,spots:[{number:2 as const,x:30,y:0,leash:1},{number:5 as const,x:38,y:0,leash:1}]},
  spaces:[{id:'near',name:'Near',x:45,y:-3.5,radius:2.5}],
  moments:[{id:'start',name:'The set-up',cue:{kind:'start' as const}},{id:'kick',name:'At the kick',cue:{kind:'restart-taken' as const}}],
  jobs:[{id:'cross',momentId:'start',actor:3 as const,kind:'pass' as const,recipient:5 as const,spaceId:'near',delivery:'auto' as const,fallback:true},{id:'attack',momentId:'kick',actor:5 as const,kind:'run' as const,spaceId:'near'}]};
 const spots=(t:number)=>[2,5].flatMap(n=>[{time:t,stepId:`spot:${n}`,phase:'active' as const,actor:`p${n}`},{time:t,stepId:`spot:${n}`,phase:'arrived' as const,actor:`p${n}`}]);
 const due=[{time:1,stepId:'cross',phase:'active' as const,actor:'p3'}];
 it('spots set but the drawn delivery cut out: broke off, not partly',()=>{
  const trace=[...due,...spots(3),{time:3,stepId:'cross',phase:'released' as const,intent:'alternative' as const,actor:'p3'},{time:3,stepId:'attack',phase:'active' as const,actor:'p5'},{time:4,stepId:'attack',phase:'arrived' as const,actor:'p5'}];
  const f=ideaRunFacts({trace,restartTakenAt:3},lesson as never)!;
  expect(f.run).toBe('broke');expect(f.delivered).toBe(false);
  const beats=beatsOf({time:0,planId:'r',name:'r',candidates:[],reason:'',status:'ended',trace} as never,lesson as never,names,()=>'x',20);
  expect(beats.find(x=>x.title==='Step 1 · The set-up')?.label).toBe('Broke off');
  // Delivered as drawn: the other parts decide as before.
  const ok=[...due,...spots(3),{time:3,stepId:'cross',phase:'released' as const,intent:'attempted' as const,actor:'p3'},{time:3,stepId:'attack',phase:'active' as const,actor:'p5'},{time:4,stepId:'attack',phase:'arrived' as const,actor:'p5'}];
  expect(ideaRunFacts({trace:ok,restartTakenAt:3},lesson as never)!.run).toBe('ran');
 });
 it('a routine chosen but never kicked (full time) is left out, not counted as broke',()=>{
  expect(routineUnkicked({trace:due},lesson as never)).toBe(true);
  expect(ideaRunFacts({trace:due},lesson as never)).toBeNull();
  expect(routineUnkicked({trace:due,restartTakenAt:5},lesson as never)).toBe(false);
  // Open-play ideas are never "unkicked".
  expect(routineUnkicked({trace:due},{...lesson,scene:undefined} as never)).toBe(false);
 });
});
