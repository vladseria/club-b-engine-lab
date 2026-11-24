// Ballers P6 L1: the React Lab's idea model against the sandbox it replaces.
// The golden side is not a stored snapshot: the test reads the live
// deliverables/football-practice/engine-audition/sandbox.js, lifts the pure
// helpers out of it (they read a global `state`), and runs the same editing
// scripts through both. Any drift in plans, inheritance, carriers, ghosts or
// lineup remaps fails here. Words differ on purpose (English UI), so names
// are compared only where they are structural.
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createTrainingSetup,validatePlans,practicePlayers,validateTrainingSetup} from '../packages/football-engine/src/index';
import * as M from '../lib/ballers/lab/model';
import * as T from '../lib/ballers/lab/text';
import type {Fixture} from '../packages/football-engine/src/model';

const fixture=JSON.parse(readFileSync('deliverables/football-practice/engine-audition/sandbox-fixture.json','utf8')) as Fixture;
const players=practicePlayers(fixture);
const nameOf=(n:number)=>players.find(p=>p.side===0&&p.number===n)?.name??`#${n}`;

// ---------- the sandbox, lifted ----------
const lines=readFileSync('deliverables/football-practice/engine-audition/sandbox.js','utf8').split('\n');
function lift(name:string){
 const i=lines.findIndex(l=>l.startsWith(`function ${name}(`));if(i<0)throw Error(`sandbox.js has no function ${name}`);
 let j=i+1;while(j<lines.length&&(lines[j].startsWith(' ')||lines[j]==='}')){j++;if(lines[j-1]==='}')break;}
 return lines.slice(i,j).join('\n');
}
const constLine=(prefix:string)=>{const l=lines.find(l=>l.startsWith(prefix));if(!l)throw Error(`sandbox.js lost ${prefix}`);return l;};
const LIFTED=['inheritedJob','displayedJob','localJob','effectiveJobs','intendedReceiver','receiverSlot','plannedCarrier','continuePass','linkPassToRunner','chooseKind','setSpace','referencePose','resolvedSpace','setSpacePoint','boundNumber','actorSlot','actorNumber','slotForNumber','addSpace','removeJobs','ancestors','ancestorJobs','preview','planSlots','preparedPlan','editorPlan'];
type Sandbox=Record<string,(...a:any[])=>any>&{reset:(s:any)=>void;state:any};
function sandbox():Sandbox{
 const code=`let state=deps.state;let counter=0;const uid=()=>'u'+(++counter);
const {validatePlans}=deps;const copy=v=>structuredClone(v),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const edit=fn=>{fn();return true;},render=()=>{},status=()=>{},activeRecognition=()=>state.rec,entries=()=>[],result=()=>undefined;
${constLine('const lesson=()=>')}
${constLine('const readActor=')}
${constLine('const job=()=>')}
${constLine('const moment=()=>')}
${constLine('const pose=n=>')}
${LIFTED.map(lift).join('\n')}
return {reset:s=>{state=s;counter=0;},get state(){return state;},${LIFTED.join(',')}};`;
 return new Function('deps',code)({state:{},validatePlans}) as Sandbox;
}
const SB=sandbox();

// ---------- the port, with the same deterministic ids ----------
let counter=0;const uid:M.Uid=()=>`u${++counter}`;
interface Case {plan:M.LabPlan;setup:M.TrainingSetup;moment:string;actor:M.Actor;rec?:any;preparation?:any}
function start(c:Case){counter=0;SB.reset({plan:structuredClone(c.plan),setup:structuredClone(c.setup),moment:c.moment,actor:structuredClone(c.actor),view:'edit',players,rec:c.rec,manager:'lesson',preparation:c.preparation,space:null,picking:null});}
const ctx=(c:Case):M.Ctx=>({ballNumber:c.setup.ball.number,rec:c.rec});
const pose=(c:Case,n:number)=>c.setup.poses.find(p=>p.side===0&&p.number===n)!;

/** Everything the board derives from a plan, per moment and actor, from both sides. */
function derived(c:Case){
 const l=c.plan.lesson,out:Record<string,unknown>={};
 for(const m of l.moments){
  SB.state.moment=m.id;
  out[`effective:${m.id}`]=[SB.effectiveJobs(m.id),M.effectiveJobs(l,m.id)];
  out[`carrier:${m.id}`]=[SB.plannedCarrier(m.id),M.plannedCarrier(l,m.id,c.setup.ball.number)];
  out[`ancestors:${m.id}`]=[SB.ancestors(m.id),M.ancestors(l,m.id)];
  out[`ancestorJobs:${m.id}`]=[SB.ancestorJobs(m.id),M.ancestorJobs(l,m.id)];
  out[`preview:${m.id}`]=[SB.preview(l,m.id,c.setup),M.previewPoses(l,m.id,c.setup,ctx(c))];
  for(const a of [2,3,4,5,...l.jobs.filter(j=>j.kind==='pass').map(j=>({receiverOf:j.id}))] as M.Actor[]){
   SB.state.actor=a;const k=M.jobActor(a);
   out[`inherited:${m.id}:${k}`]=[SB.inheritedJob()??null,M.inheritedJob(l,m.id,a)??null];
   out[`displayed:${m.id}:${k}`]=[SB.displayedJob()??null,M.displayedJob(l,m.id,a)??null];
   out[`number:${m.id}:${k}`]=[SB.actorNumber(a),M.actorNumber(a,l,m.id,ctx(c))];
  }
 }
 for(const j of l.jobs.filter(j=>j.kind==='pass'))out[`receiver:${j.id}`]=[[SB.intendedReceiver(j),SB.receiverSlot(j)],[M.intendedReceiver(l,j),M.receiverSlot(l,j)]];
 for(const s of l.spaces)out[`space:${s.id}`]=[SB.resolvedSpace(s),M.resolvedSpace(s,l,c.setup.poses,c.rec)];
 out.slots=[SB.planSlots(l,c.plan.standing),M.planSlots(l,c.plan.standing)];
 return out;
}
/** Space and moment names are words (Romanian there, English here): blank them. */
const words=(v:unknown):unknown=>JSON.parse(JSON.stringify(v??null,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)&&('radius' in x||'cue' in x)?{...x,name:''}:x));
function expectSame(c:Case){for(const [key,[a,b]] of Object.entries(derived(c) as Record<string,[unknown,unknown]>))expect(words(b),key).toEqual(words(a));}

/** One editing step, applied to the sandbox state and to the port. */
function choose(c:Case,a:M.Actor,kind:M.JobKind){
 SB.state.moment=c.moment;SB.state.actor=structuredClone(a);SB.chooseKind(kind);
 const origin=c.setup.poses.find(p=>p.side===0&&p.number===M.actorNumber(a,c.plan.lesson,c.moment,ctx(c)))!;
 M.chooseKind(c.plan,c.moment,a,kind,origin,c.setup.poses,uid);
 expect(words(c.plan)).toEqual(words(SB.state.plan));
}

const base=():Case=>({plan:M.freshPlan(()=>'plan-1'),setup:createTrainingSetup('middle'),moment:'start',actor:3});
function oneTwoIdea(){
 const c=base();start(c);
 choose(c,3,'advance');choose(c,5,'run');choose(c,3,'pass');
 const l=c.plan.lesson,pass=l.jobs.find(j=>j.kind==='pass')!,runner=l.jobs.find(j=>j.kind==='run')!;
 SB.linkPassToRunner(SB.state.plan.lesson.jobs.find((j:any)=>j.id===pass.id),SB.state.plan.lesson.jobs.find((j:any)=>j.id===runner.id));M.linkPassToRunner(pass,runner);
 expect(words(c.plan)).toEqual(words(SB.state.plan));
 SB.state.moment='start';SB.continuePass(SB.state.plan.lesson.jobs.find((j:any)=>j.id===pass.id));
 const next=M.continuePass(l,pass,uid);
 expect({moment:next.moment,actor:next.actor}).toEqual({moment:SB.state.moment,actor:SB.state.actor});
 c.moment=next.moment;c.actor=next.actor;
 choose(c,next.actor,'shoot');choose(c,4,'occupy');choose(c,2,'hold');
 return c;
}

describe('Ballers Lab model = the sandbox (golden)',()=>{
 it('lifts every helper it ports',()=>{for(const name of LIFTED)expect(typeof SB[name]).toBe('function');});
 it('drawing a one-two with a run, a continuation and off-ball jobs builds the same plan and the same board',()=>{
  const c=oneTwoIdea();expectSame(c);
  expect(()=>validatePlans([c.plan])).not.toThrow();
  // inheritance: #5's run carries into the receipt moment until overridden
  expect(M.effectiveJobs(c.plan.lesson,c.moment).some(j=>j.actor===5&&j.momentId==='start')).toBe(false);
  const second=c.plan.lesson.moments[1].id;expect(M.plannedCarrier(c.plan.lesson,second,3)).toBe(5);
 });
 it('re-choosing a job keeps its id, localJob copies an inherited job, and the same kind only re-arms',()=>{
  const c=oneTwoIdea();const l=c.plan.lesson,second=l.moments[1].id;
  // #4 occupies in the second moment; make #2's inherited hold local there
  SB.state.moment=second;SB.state.actor=2;const sbLocal=SB.localJob();const local=M.localJob(l,second,2,uid);
  expect(local).toEqual(sbLocal);expect(words(c.plan)).toEqual(words(SB.state.plan));
  const before=structuredClone(c.plan);const r=M.chooseKind(c.plan,second,4,'occupy',pose(c,4),c.setup.poses,uid);
  expect(r.changed).toBe(false);expect(r.picking).toBe('opponent');expect(c.plan).toEqual(before);
  expectSame(c);
 });
 it('removing a pass cascades to its receiver’s jobs and to the moments it cued',()=>{
  const c=oneTwoIdea();const l=c.plan.lesson,pass=l.jobs.find(j=>j.kind==='pass')!;
  SB.removeJobs([pass.id]);M.removeJobs(l,[pass.id]);
  expect(words(c.plan)).toEqual(words(SB.state.plan));expect(l.moments).toHaveLength(1);
  c.moment='start';SB.state.moment='start';expectSame(c);
 });
 it('anchored spaces follow their reference player, and moving the centre re-derives the offset',()=>{
  const c=oneTwoIdea();const l=c.plan.lesson,space=l.spaces[0];
  M.setSpaceAnchor(space,'player:5',l,c.setup.poses,c.rec);
  SB.state.plan=structuredClone(c.plan);
  const moved=structuredClone(c.setup);moved.poses.find(p=>p.side===0&&p.number===5)!.y+=4;c.setup=moved;SB.state.setup=structuredClone(moved);
  expectSame(c);
  SB.setSpacePoint(SB.state.plan.lesson.spaces[0],{x:30,y:6});M.setSpacePoint(space,{x:30,y:6},l,c.setup.poses,c.rec);
  expect(words(c.plan)).toEqual(words(SB.state.plan));
  const opp=structuredClone(c.plan);M.setSpaceAnchor(opp.lesson.spaces[0],'opponent:4',opp.lesson,c.setup.poses);
  expect(opp.lesson.spaces[0].anchor?.kind).toBe('opponent');
  expect(M.resolvedSpace(opp.lesson.spaces[0],opp.lesson,c.setup.poses)).toMatchObject({x:30,y:6});
 });
 it('flexible roles and recognition bindings resolve the same shirts',()=>{
  const c=oneTwoIdea();M.setRole(c.plan.lesson,3,'carrier');M.setRole(c.plan.lesson,5,'runner');
  c.rec={bindings:{3:4,5:2},receiverBindings:{}};
  start(c);expectSame(c);
  expect(M.boundNumber(3,c.plan.lesson,c.rec)).toBe(4);expect(M.slotForNumber(2,c.rec)).toBe(5);expect(SB.slotForNumber(2)).toBe(5);
  expect(M.freeRoles(c.plan.lesson,4)).toEqual(['support','runner']);
 });
 it('a pressed moment and a released moment inherit movement jobs the same way',()=>{
  const c=oneTwoIdea();const l=c.plan.lesson,pass=l.jobs.find(j=>j.kind==='pass')!;
  M.putMoment(l,'pressed-1','pressed','5',m=>T.cueText(m,l,nameOf));
  M.putMoment(l,'released-1','released',pass.id,m=>T.cueText(m,l,nameOf));
  start(c);expectSame(c);
  expect(M.ancestors(l,'pressed-1')).toEqual(['start']);
 });
 it('taking an idea into another lineup remaps every slot, and reports absent players',()=>{
  const c=oneTwoIdea();M.setStanding(c.plan,4,'mark',uid,0);
  const drawn=['mircea','flavius','crocodinho','van','golusor'];
  const cases:[string[],Record<number,string>][]=[
   [['mircea','golusor','van','crocodinho','flavius'],{}],
   [['mircea','flavius','crocodinho','van','sorin'],{}],
   [['mircea','flavius','crocodinho','van','sorin'],{5:'flavius'}],
   [['mircea','flavius','crocodinho','van','sorin'],{5:'sorin'}],
  ];
  for(const [target,assignments] of cases){
   start({...c,preparation:{lineup:target,assignments:{k:assignments}}});
   const golden=SB.preparedPlan({key:'k',plan:c.plan,lineup:drawn});
   const port=M.preparedPlan({plan:c.plan,lineup:drawn},target,assignments,p=>validatePlans([p])[0] as M.LabPlan);
   expect(words(port)).toEqual(words(golden));
  }
 });
 it('the one-two preset is the sandbox’s repeated pair, as an editable board idea',()=>{
  start({...base(),plan:M.freshPlan(()=>'x')});Object.assign(SB.state,{manager:'one-two',pairA:3,pairB:5,emphasis:70});
  const golden=SB.editorPlan(),port=M.oneTwoPlan(3,5,nameOf(3),nameOf(5),.7);
  expect({...port,name:''}).toEqual({...golden,name:'',lesson:{...golden.lesson,moments:golden.lesson.moments.map((m:any)=>({...m,name:'Start'}))}});
  expect(()=>validatePlans([port])).not.toThrow();
 });
 it('spaces are reused before new ones, and capped at eight',()=>{
  const c=base();start(c);
  for(let i=0;i<8;i++){const p={x:10+i*3,y:0};const a=SB.addSpace(p),b=M.addSpace(c.plan,p,uid);expect(b).toBe(a);c.plan.lesson.jobs.push({id:`j${i}`,momentId:'start',actor:2,kind:'hold',spaceId:b});SB.state.plan.lesson.jobs.push({id:`j${i}`,momentId:'start',actor:2,kind:'hold',spaceId:a});}
  expect(()=>M.addSpace(c.plan,{x:1,y:1},uid)).toThrow();expect(()=>SB.addSpace({x:1,y:1})).toThrow();
  c.plan.lesson.jobs.pop();SB.state.plan.lesson.jobs.pop();
  expect(M.addSpace(c.plan,{x:5,y:5},uid)).toBe(SB.addSpace({x:5,y:5}));
 });
});

describe('Ballers Lab model (unit)',()=>{
 it('standing instructions: one per player, spaces for protect / stay forward, phases per kind',()=>{
  const plan=M.freshPlan(()=>'p');M.setStanding(plan,2,'press',uid,0);M.setStanding(plan,3,'protect',uid,0);M.setStanding(plan,5,'stay-forward',uid,4);M.setStanding(plan,4,'mark',uid,0);
  expect(plan.standing).toHaveLength(4);expect(plan.standing!.find(s=>s.actor===5)).toMatchObject({phase:'always',kind:'stay-forward'});
  expect(plan.lesson.spaces).toHaveLength(2);expect(()=>validatePlans([plan])).not.toThrow();
  M.setStanding(plan,2,'',uid,0);expect(plan.standing).toHaveLength(3);
  expect(M.hasContent(plan)).toBe(true);
 });
 it('deleting a moment removes its jobs and everything that hangs on them',()=>{
  const c=oneTwoIdea();const second=c.plan.lesson.moments[1].id;M.deleteMoment(c.plan.lesson,second);
  expect(c.plan.lesson.moments.map(m=>m.id)).toEqual(['start']);expect(c.plan.lesson.jobs.every(j=>j.momentId==='start')).toBe(true);
 });
 it('warns about a carrier-role run, a self-pass and an action by a non-receiver',()=>{
  const c=oneTwoIdea();const l=c.plan.lesson,second=l.moments[1].id;
  M.setRole(l,4,'carrier');l.jobs.push({id:'r4',momentId:'start',actor:4,kind:'run',spaceId:l.spaces[0].id});
  expect(M.assignmentWarning(l,'start',4,3)).toEqual({kind:'carrier-run',slot:4});
  const two=l.jobs.find(j=>j.momentId===second&&j.actor===2)!;Object.assign(two,{kind:'pass',recipient:4});delete two.spaceId;
  expect(M.assignmentWarning(l,second,2,3)).toEqual({kind:'not-receiver',expected:5,slot:2});
  two.recipient=2;
  expect(M.assignmentWarning(l,second,2,3)).toEqual({kind:'self-pass'});
 });
 it('coaching sentences read the drawing in English',()=>{
  const c=oneTwoIdea();const l=c.plan.lesson,pass=l.jobs.find(j=>j.kind==='pass')!,second=l.moments[1];
  expect(T.coachingSentence(pass,l,nameOf)).toBe(`#3 ${nameOf(3)} looks for the pass to #5 ${nameOf(5)} in Space 2.`);
  expect(T.momentTitle(second,l,nameOf)).toBe(`When #5 ${nameOf(5)} receives from #3`);
  expect(T.description(l.jobs.find(j=>j.kind==='occupy')!,l,nameOf)).toMatch(/^Stays a threat next to defender #\d\.$/);
  expect(T.emphasisPlain(0)).toBe('Parked');expect(T.emphasisPlain(100)).toBe('Whenever it fits');
  expect(T.cueText({id:'x',name:'x',cue:{kind:'pressed',actor:5}},l,nameOf)).toBe('When #5 is pressed');
 });
 it('the training setup stays valid after every scripted edit',()=>{
  const c=oneTwoIdea();expect(()=>validateTrainingSetup(c.setup,players)).not.toThrow();
 });
});

// ---------- practice matches: the official code path, from browser-built sides ----------
import {computeMatch,validateInput,type FrozenInput} from '../lib/ballers/compute';
import {demoSide,frozenSide,scratchSide} from '../lib/ballers/lab/team';
import {ENGINE_BUILD} from '../packages/football-engine/src/build-info';
import {LAST_ATTACK_MAX} from '../packages/football-engine/src/index';
describe('Ballers practice (P6)',()=>{
 const asPlayers=(side:ReturnType<typeof demoSide>)=>side.team.squad.map((p,i)=>({id:p.id,club_id:side.team.id,space:'test',name:p.name,short:side.players[i].short,number:i+1,roles:p.roles,archetype:'motor',temperament:'cold',note:p.note||'x',skills:p.skills,traits:p.traits,energy:p.energy,portrait:side.players[i].portrait,founder:false})) as never;
 const home=demoSide(),away=scratchSide();
 const club=(s:typeof home)=>({id:s.team.id,name:s.team.name,code:'ABC',color:'#123456'});
 const idea=oneTwoIdeaPlan();
 const input=(seed:number):FrozenInput=>({v:1,match:'practice-x',seed,kickoff:0,duration:60,sides:[
  frozenSide(club(home),asPlayers(home),{lineup:home.team.lineup,formation:'1-2-1',style:'balanced',approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},captain:null},[{idea:'i',key:idea.id,name:idea.name,plan:idea as never,lineup:home.team.lineup,accent:80}]),
  frozenSide({...club(away),id:'opp'},asPlayers(away),{lineup:away.team.lineup,formation:'2-1-1',style:'direct',approach:{progression:'direct',width:'wide',line:'standard',press:'aggressive',commit:4,striker:'run',transition:'balanced'},captain:null})]});
 it('frozen practice sides pass the official input check',()=>{expect(()=>validateInput(input(7))).not.toThrow();});
 it('a practice match is deterministic for (input, build) and carries the idea',()=>{
  const a=computeMatch(input(11)),b=computeMatch(input(11));
  expect(a.engineBuild).toBe(ENGINE_BUILD);expect(a.compact.score).toEqual(b.compact.score);expect(a.compact.chunks[0].f.length).toBe(b.compact.chunks[0].f.length);
  // (R1 combine, 2026-10-14) header.duration is the time played: a match plays out an attack in progress at full time
  // (the last attack, up to LAST_ATTACK_MAX s), so the check is the full-time mark. (Lane C, 2026-10-21: the bound is the
  // engine's own LAST_ATTACK_MAX rather than a literal 80, and holds whether or not seed 11 ends in an attack.)
  expect(a.dropped).toEqual([]);expect(a.compact.header.duration).toBeGreaterThanOrEqual(60);expect(a.compact.header.duration).toBeLessThanOrEqual(60+LAST_ATTACK_MAX);
  expect(a.compact.header.fullTime).toBe(a.compact.header.duration>60?60:undefined);
 },60000);
 function oneTwoIdeaPlan(){return validatePlans([M.oneTwoPlan(3,5,'A','B',.8)])[0] as M.LabPlan;}
});

// ---------- the editor (fix round): undo runs, edit-then-act, broken drafts ----------
import {EditorCore,blankBoard,editorPlan,readDraft} from '../lib/ballers/lab/editor';
describe('Ballers Lab editor (fix round)',()=>{
 const check=(b:ReturnType<typeof blankBoard>)=>{validatePlans([b.plan]);validateTrainingSetup(b.setup,players);};
 it('one slider drag is one undo step; another control starts a new one',()=>{
  const ed=new EditorCore(blankBoard(),check);
  for(const v of [95,90,85,80,75])expect(ed.edit(d=>{d.emphasis=v;},'emphasis').ok).toBe(true);
  expect(ed.undo.length).toBe(1);
  ed.seal();ed.edit(d=>{d.emphasis=70;},'emphasis');expect(ed.undo.length).toBe(2);
  ed.edit(d=>{d.seed=7;},'seed');ed.edit(d=>{d.seed=77;},'seed');expect(ed.undo.length).toBe(3);
  ed.back();expect(ed.board.emphasis).toBe(70);expect(ed.board.seed).toBe(2026);
  ed.back();expect(ed.board.emphasis).toBe(75);ed.back();expect(ed.board.emphasis).toBe(100);
 });
 it('"New variant": the trial reads the board the variant edit produced, not the one before it',()=>{
  const ed=new EditorCore({...blankBoard(),manager:'one-two'},check);
  const before=ed.board;
  // Lab: nextSeed, edit, then runTrial() reads ed.current() (= core.board)
  expect(ed.edit(d=>{d.seed=424242;}).ok).toBe(true);
  const played=ed.board;
  expect(played.seed).toBe(424242);expect(before.seed).toBe(2026);
  expect(validatePlans([editorPlan(played,n=>`#${n}`)]).length).toBe(1);
 });
 it('a refused edit changes nothing and leaves no undo step',()=>{
  const ed=new EditorCore(blankBoard(),check);
  const r=ed.edit(d=>{d.setup.poses=[];});expect(r.ok).toBe(false);expect(ed.undo.length).toBe(0);
 });
 it('a draft whose setup no longer fits restores its idea leniently, never silently',()=>{
  const b={...blankBoard(),manager:'one-two' as const,seed:9};
  const raw=JSON.stringify({...b,setup:{...b.setup,poses:[]}});
  expect(()=>readDraft(raw,players)).toThrow();
  const back=readDraft(raw,players,false);expect(back.seed).toBe(9);expect(back.setup.poses.length).toBeGreaterThan(0);
  expect(()=>readDraft('{"plan":7}',players,false)).toThrow();
 });
});
