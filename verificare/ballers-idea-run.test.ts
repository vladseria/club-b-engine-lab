// The honest idea classifier (lib/ballers/idea-run.ts): ran / partly / broke
// from the idea's own trace; the replay lamp and review that read it; and the
// official computation that stores it with the owner-only detail.
import {describe,expect,it} from 'vitest';
import {classifyIdeaRun,ideaRunFacts} from '../lib/ballers/idea-run';
import type {ActionTrace} from '../packages/football-engine/src/practice-teaching';
import {STARTERS} from '../lib/ballers/lab/starters';
import {ideaOutcome} from '../lib/ballers/replay';
import {ideaReview,withRun,whyLine,type IdeaName,type Marker} from '../lib/ballers/ideas';
import {validatePlans} from '../packages/football-engine/src/index';
import {computeMatch,type FrozenInput} from '../lib/ballers/compute';
import {submission} from '../lib/ballers/simulation';
import {ideaRecord} from '../lib/ballers/scout';
import {buildIncidents} from '../lib/ballers/incidents';
import {matchReport} from '../lib/ballers/commentary';
import {demoSide,frozenSide,scratchSide} from '../lib/ballers/lab/team';

type T={time:number;stepId:string;phase:ActionTrace['phase'];intent?:ActionTrace['intent'];actor?:string;target?:string;responsibility?:ActionTrace['responsibility'];evidence?:{spaceId?:string}};
const inBehind=STARTERS.find(s=>s.key==='starter-in-behind')!.plan().lesson;
const w=(stepId:string,responsibility:T['responsibility']):T=>({time:0,stepId,phase:'waiting',responsibility});
const a=(time:number,stepId:string,actor:string,responsibility:T['responsibility'],extra:Partial<T>={}):T=>({time,stepId,phase:'active',actor,responsibility,...extra});
const base=[w('run','run'),w('through','pass'),w('finish','shoot'),a(0,'run','5','run'),a(0,'through','3','pass')];

describe('ideaRunFacts / classifyIdeaRun',()=>{
 it('ran: the runner reached the drawn space and the key pass was released as drawn (the shot is not required)',()=>{
  const trace:T[]=[...base,{time:.4,stepId:'through',phase:'released',intent:'attempted',actor:'3',target:'5'},{time:1.2,stepId:'run',phase:'arrived',actor:'5'}];
  const f=ideaRunFacts({trace},inBehind)!;
  expect(f.run).toBe('ran');expect(f.due).toBe(2);expect(f.done).toBe(2);expect(f.shot).toBe(false);
 });
 it('a run is also done when the runner received a pass of this idea before reaching the space',()=>{
  const trace:T[]=[...base,{time:.4,stepId:'through',phase:'released',intent:'attempted',actor:'3',target:'5'},{time:1,stepId:'through',phase:'received',actor:'3',target:'5'}];
  expect(classifyIdeaRun({trace},inBehind)).toBe('ran');
 });
 it('partly: the runner made the run, the carrier chose something else (an allowed alternative is not the drawn pass)',()=>{
  const trace:T[]=[...base,{time:1.2,stepId:'run',phase:'arrived',actor:'5'},{time:1.5,stepId:'through',phase:'released',intent:'alternative',actor:'3',target:'4'}];
  const f=ideaRunFacts({trace},inBehind)!;
  expect(f.run).toBe('partly');expect(f.parts.find(p=>p.id==='through')!.released).toBe('alternative');
 });
 it('broke: nothing drawn happened before it ended; an idea with no due part is broke',()=>{
  expect(classifyIdeaRun({trace:base},inBehind)).toBe('broke');
  expect(classifyIdeaRun({trace:[w('run','run'),w('through','pass')]},inBehind)).toBe('broke');
 });
 it('skipped parts and parts whose moment never came do not count against it',()=>{
  const layOff=STARTERS.find(s=>s.key==='starter-lay-off')!.plan().lesson;
  const trace:T[]=[{time:0,stepId:'show',phase:'skipped',responsibility:'offer'},{time:0,stepId:'short',phase:'skipped',responsibility:'pass'},
   a(0,'go','4','run'),a(0,'on','5','pass'),w('finish','shoot'),{time:.3,stepId:'on',phase:'released',intent:'attempted',actor:'5',target:'4'},{time:1,stepId:'go',phase:'arrived',actor:'4'}];
  const f=ideaRunFacts({trace},layOff)!;
  expect(f.run).toBe('ran');expect(f.skipped).toBe(2);expect(f.due).toBe(2);
 });
 it('offer is done when the player moved for it; without a lesson, kinds and spaces are read from the trace',()=>{
  const trace:T[]=[a(0,'show','5','offer'),{time:.6,stepId:'show',phase:'active',intent:'pursued',actor:'5',responsibility:'offer'}];
  expect(classifyIdeaRun({trace})).toBe('ran');
  expect(classifyIdeaRun({trace:[a(0,'go','4','run',{evidence:{spaceId:'far'}}),{time:.6,stepId:'go',phase:'active',intent:'pursued',actor:'4',responsibility:'run'}]})).toBe('broke');
 });
 it('a part the idea itself moved on from (the drive, once "when pressed, slip" begins) counts as done; another interruption does not',()=>{
  const drive=STARTERS.find(s=>s.key==='starter-drive-slip')!.plan().lesson;
  const start:T[]=[a(0,'carry','3','advance'),a(0,'run','5','run'),w('slide','pass'),w('finish','shoot')];
  const moved:T[]=[...start,{time:.5,stepId:'carry',phase:'interrupted',actor:'3'},a(.5,'slide','3','pass'),{time:.8,stepId:'slide',phase:'released',intent:'attempted',actor:'3',target:'5'},{time:1.2,stepId:'run',phase:'arrived',actor:'5'}];
  expect(classifyIdeaRun({trace:moved},drive)).toBe('ran');
  const other:T[]=[...start,{time:.5,stepId:'carry',phase:'interrupted',actor:'3'},{time:1.2,stepId:'run',phase:'arrived',actor:'5'}];
  expect(classifyIdeaRun({trace:other},drive)).toBe('partly');
 });
 it('a firing whose only due part is the finish is judged on it: shot taken = ran, none = broke',()=>{
  const due:T[]=[w('run','run'),w('through','pass'),a(0,'finish','5','shoot')];
  const shot:T[]=[...due,{time:.8,stepId:'finish',phase:'complete',intent:'attempted',actor:'5'}];
  const f=ideaRunFacts({trace:shot},inBehind)!;
  expect(f.run).toBe('ran');expect(f.shotOnly).toBe(true);expect(f.shot).toBe(true);
  expect(classifyIdeaRun({trace:due},inBehind)).toBe('broke');
  // with another due part the finish is not required again
  expect(ideaRunFacts({trace:[...base,{time:.8,stepId:'finish',phase:'complete',intent:'attempted',actor:'3'}]},inBehind)!.shotOnly).toBe(false);
 });
 it('no trace: not classified',()=>{expect(classifyIdeaRun({trace:[]})).toBeNull();expect(classifyIdeaRun({})).toBeNull();});
});

describe('on this engine build, Lab watches classify every start',()=>{
 it('each ready-made move, a few seeds: every start of the idea gets ran / partly / broke',async()=>{
  const {runTraining,validatePlans,createTrainingSetup,withDefensiveApproach,ENGINE_BUILD}=await import('../packages/football-engine/src/index');
  const {demoSide,trialFixture}=await import('../lib/ballers/lab/team');
  // Pinned to the engine build this was last checked on: 8034f01b until
  // 2026-09-29, then c7652514 (idea runs commit for the idea's life; the
  // carrier's idea preference capped at 0.2), then 014140d4 (live restart setups and
  // long goal kicks; idea code unchanged), then a348676d (set-piece routines; open-play
  // ideas byte-identical), then d48a2fe6 (routine fixes: side/third checks, fit,
  // taker reach, wall gap, set-up cap; open-play ideas byte-identical), then
  // 12bf22ee (a routine's taker plays the drawn delivery unless it is clearly
  // off; open-play ideas byte-identical), then 2822b91b (a pressed keeper's
  // long goal kick goes over a contested ground lane; changes every match, idea
  // code unchanged), then 4e7ccf0e (styles choose which pass, not whether to
  // pass: the style preference is re-centred on the neutral best delivery;
  // changes every match, idea code unchanged), then cfc3f98c (fatigue charges
  // the metabolic cost of accelerating; changes every match, idea code
  // unchanged), then 07ffe814 (a last man holds the space behind after a
  // throw-in; keepers sweep by forecast arrival; changes every match, idea code unchanged), then 5b2caf68
  // (keepers hold shots at the body and push the rest wide or round the post;
  // no dive at a team-mate's ball; decisive clearing in the own box; own-goal
  // guards on carries and loose control; changes every match, idea code
  // unchanged), then 88f656f9 (B0 correctness: the striker setting follows the
  // most advanced forward; box arrivals by position; Auto free-kick taker,
  // danger width, marking anchor and press radius fit the 5v5 pitch; short
  // passes led to where the receiver will be; changes every match, idea code
  // unchanged), then 94f3bea5 (the lead forward changes hands only after the
  // other winger has been clearly ahead for 1.5 s; idea code unchanged), then
  // the B1 Short-truthfulness builds (patient play and "Keep it" only charge
  // what they promise; changes Short's matches, idea code unchanged), then
  // the B2 width-and-block builds (wingers hold the lane Width asks for; the
  // block reacts to attackers; passers value what the receiver can do next;
  // changes every match; a standing mark order still beats the zone logic),
  // then the B3 losing-the-ball builds (a loss priced by the rest defence
  // behind the ball; "Bodies forward" sets that rest defence; counter-press
  // carried by "On losing it"; changes every match, idea code unchanged),
  // then the B3b transition builds (a counter run commits while its race is
  // being won; a counter is read by the numbers against the rest defence and
  // every side plays it; running with the ball into open ground; changes
  // every match, idea code unchanged), then the B4 defending-near-goal builds
  // (the keeper keeps setting himself against the ball; Regroup drops behind
  // the ball with the delay covered; a runner from behind a pressing
  // defender's shoulder is picked up a moment late; changes every match, idea
  // code unchanged), then the R1 agency builds (Counter's "On losing it"
  // preset is Balanced; only Counter's team flips after a regain; "Bodies
  // forward" is a priced preference each player follows by discipline;
  // changes every match, idea code unchanged), then the R2+R3 builds (each
  // player reads the game by his own eye; an authored loss price; pressure
  // relief belongs to escaping pressure; advancing means towards the goal;
  // a purpose clock; changes every match, idea code unchanged), then the
  // silly-moments build (touches no longer hand the ball the body's run away
  // from the aim; a set touch stops the ball where the body stops; through
  // balls no harder than a firm pass; changes every match, idea code
  // unchanged), then the combined style build (silly moments; M1 the
  // no-offside Line; M2/M3 press lean, Selective's trap, defenders' sight
  // lag; Pivot and the third man; Short plays width standard + Pivot;
  // changes every match, idea code unchanged), then the trap fix (no trap
  // within 22 m of our goal; a centre-back never springs it alone; changes
  // Counter's matches, idea code unchanged), then the settings round (In
  // behind on their last line, Pivot's pass preference, Drops deep as a false
  // nine, free-kick routines, 2-1-1 Width; idea code unchanged): see the
  // commit log for each. A new build re-runs this and re-pins. Then the
  // behaviour round and the defending round (everyone keeps a man; runners
  // followed; set-piece template; idea code unchanged), then the defending
  // rebuild (one out-of-possession system; rest defence in possession; idea
  // code unchanged), then the defending-close round (set-piece plans by the
  // attackers there, duplicate marks resolved, tight marking near goal,
  // transitions in our own third; idea code unchanged), then the step-across
  // round (the step-across held, beaten chasers priced, counter-press ends near
  // our goal; the passer's own lane read; idea code unchanged), then the
  // settings-truth round (line keepers stay home, the free-kick taker follows
  // the call, Counter-press goes whatever the numbers, the spare man's marker
  // re-decides at once; idea code unchanged), then the settings close-out
  // (the counter-press reason text only; no behaviour change), then the B3
  // long-ball round (the keeper's read of a ball behind his line, the
  // contested touch; idea code unchanged), then the matchups-combined build
  // (honest pass reads, tiredness, the cover defender, B2's pressed carrier,
  // marking items 1-2/4/5 and movement intensity on top of B3; idea code unchanged),
  // then threat-to-goal defending and honest run timing merged in, then the
  // tiredness bite (players tire more, stamina shows; idea code unchanged),
  // then the collect read (the receiver's marker goes for a ball in the air on
  // his own read) and the regain fixes (off balance after losing it at close
  // quarters; escaping passes near goal) merged in (idea code unchanged),
  // then track the runner (a defender reads a forward run from its start,
  // earlier the better he reads the game) merged in (idea code unchanged),
  // then the pre-push fixes (a carrier meets a man in his path before he
  // kicks; an outlet steps off a marker who beats the ball; idea code unchanged),
  // then the last attack (full time plays out the attack in progress; matches
  // only, so these training starts are unchanged; idea code unchanged),
  // then stamina as lasting (the sprint reserve the same at any stamina) and
  // box defending (a defence near its goal protects the box) merged in
  // (idea code unchanged), then the keeper upgrade (an edge per shot scaled by
  // keeping; with the ball in his hands he moves anywhere in his area at a jog
  // and reads an arriving presser before the throw; idea code unchanged),
  // then R1 (no pass into the passer's own moving body, a held carry no
  // longer lowers the bar for a clearance, channel clearances to where a
  // team-mate arrives first, the keeper's carry priced, the Line ignoring the
  // man pressing our ball, support spots near our goal chosen by worth, a man
  // pulling up a metre from a keeper holding the ball; idea code unchanged),
  // then the R1 keeper tune (a sweeper weighs the goal he leaves less, the
  // stay-at-home keeper's hard carry limit gone; idea code unchanged),
  // then the contest build (reception duels with a man on the receiver's back,
  // duels in the air, pressure on the shooter read by his own skill and nerve,
  // the shot decision read once; idea code unchanged),
  // then release 2 (the reception read in flight and the decision made before
  // the ball arrives, a committed ground pass looked at again when a man gets
  // into its lane, time out of the play following what a duel did to each
  // man's body; idea code unchanged),
  // then release 3 (a counter-press or trap goer covered goal-side behind him,
  // a player left behind the play hurrying up into it, shot lanes read inside
  // the posts, the plan's taker on penalties; idea code unchanged),
  // then release 4 (the keeper reads the attack, not his back line, and his
  // support job prices the goal a loss would leave open; idea code unchanged),
  // then engine-speed dbdb6b81 (four speed-ups, match results byte-identical
  // to 31573ffb; idea code unchanged).
  expect(ENGINE_BUILD.slice(0,8)).toBe('dbdb6b81');
  const side=demoSide(),seen:Record<string,number>={};
  for(const st of STARTERS)for(const seed of [3,11,2026]){
   const fixture=withDefensiveApproach(trialFixture(side.team,seed),1,'original');fixture.seed=seed;
   const plans=validatePlans([st.plan()]) as {lesson:Parameters<typeof classifyIdeaRun>[1]}[];
   const r=runTraining({fixture,durationSeconds:20,policy:'coordinated',setup:createTrainingSetup('middle'),substitutions:'none',playbook:{side:0,plans:plans as never,adaptive:true}}).result;
   for(const sel of (r.playbookSelections??[]).filter(x=>x.planId)){const run=classifyIdeaRun(sel,plans[0].lesson);expect(['ran','partly','broke']).toContain(run);seen[run!]=(seen[run!]??0)+1;}
  }
  expect(Object.values(seen).reduce((a,b)=>a+b,0)).toBeGreaterThan(0);
  console.log(`starts by class on ${ENGINE_BUILD.slice(0,8)}:`,JSON.stringify(seen));
 },120000);
});

describe('the replay lamp reads the classification',()=>{
 const m=(over:Partial<Marker&{run:'ran'|'partly'|'broke'}>={})=>({seq:1,side:0 as const,t:10,ended_at:12,status:'ended',end_reason:'complete',progress:'attempted' as const,free:false,...over});
 it('ran = ok, partly = partly, broke = x, whatever the engine end reason says',()=>{
  expect(ideaOutcome(m({run:'ran',end_reason:'loss'}),[])).toBe('ok');
  expect(ideaOutcome(m({run:'partly'}),[])).toBe('partly');
  expect(ideaOutcome(m({run:'broke',end_reason:'complete'}),[])).toBe('x');
 });
 it('unclassified rows (older matches, public markers) keep the older rule',()=>{
  expect(ideaOutcome(m(),[])).toBe('ok');
  expect(ideaOutcome(m({end_reason:'loss'}),[])).toBe('x');
  expect(ideaOutcome(m({progress:'recognised'}),[])).toBe('faint');
 });
 it('the owner review merges run from the owner-only detail',()=>{
  const names:IdeaName[]=[{seq:1,name:'A',plan_key:'a',detail:{run:'partly'}},{seq:2,name:'A',plan_key:'a',detail:{run:'ran'}}];
  const markers=[m(),m({seq:2,t:30,ended_at:31})];
  expect(withRun(markers,names).map(x=>x.run)).toEqual(['partly','ran']);
  const [r]=ideaReview(markers,names,0,[]);
  expect([r.ok,r.partly,r.x,r.faint]).toEqual([1,1,0,0]);
  expect(whyLine({...markers[0],run:'partly'})).toBe('Partly played out as drawn; ended because it was completed.');
 });
});

describe('an official computation stores the classification with the owner-only detail',()=>{
 it('every named idea firing carries run; free play carries none',()=>{
  const asPlayers=(side:ReturnType<typeof demoSide>)=>side.team.squad.map((p,i)=>({id:p.id,club_id:side.team.id,space:'test',name:p.name,short:side.players[i].short,number:i+1,roles:p.roles,archetype:'motor',temperament:'cold',note:p.note||'x',skills:p.skills,traits:p.traits,energy:p.energy,portrait:side.players[i].portrait,founder:false})) as never;
  const home=demoSide(),away=scratchSide(),club=(s:typeof home,id=s.team.id)=>({id,name:s.team.name,code:'ABC',color:'#123456'});
  const approach={progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'} as const;
  const plan=validatePlans([STARTERS[0].plan()])[0];
  const input:FrozenInput={v:1,match:'idea-run',seed:3,kickoff:0,duration:120,sides:[
   frozenSide(club(home),asPlayers(home),{lineup:home.team.lineup,formation:'1-2-1',style:'balanced',approach,captain:null},[{idea:'i',key:plan.id,name:plan.name,plan:plan as never,lineup:home.team.lineup,accent:80}]),
   frozenSide(club(away,'opp'),asPlayers(away),{lineup:away.team.lineup,formation:'2-1-1',style:'direct',approach,captain:null})]};
  const c=computeMatch(input),ideas=c.compact.ideas;
  const named=ideas.filter(i=>i.planId!==null);
  expect(named.length).toBeGreaterThan(0);
  for(const i of named)expect(['ran','partly','broke']).toContain(i.detail?.run);
  for(const i of ideas.filter(i=>i.planId===null))expect(i.detail?.run).toBeUndefined();
  // The submission lifts the one word onto the public marker (ballers_submit
  // stores `run` on ballers_match_ideas); free play carries none, and the
  // marker fields the public row is built from carry nothing of the lesson.
  const sub=submission(c,input);
  const PUBLIC=['seq','side','t','ended_at','status','end_reason','progress','run'];
  for(const i of sub.ideas){
   const src=ideas.find(x=>x.seq===i.seq)!;
   if(src.planId===null)expect('run' in i).toBe(false);else expect((i as {run?:string}).run).toBe(src.detail!.run);
   for(const k of Object.keys(i))expect([...PUBLIC,'plan_key','name','detail']).toContain(k);
  }
 },120000);
});

describe('public markers carry the classification (2026-09-29)',()=>{
 const m=(over:Partial<Marker>={}):Marker=>({seq:1,side:1,t:10,ended_at:12,status:'ended',end_reason:'complete',progress:'attempted',free:false,...over});
 it('an opponent’s marker reads its own public run; no owner detail needed',()=>{
  expect(ideaOutcome(m({run:'broke'}),[])).toBe('x');
  expect(ideaOutcome(m({run:'partly',end_reason:'loss'}),[])).toBe('partly');
  expect(ideaOutcome(m({run:'ran',end_reason:'loss'}),[])).toBe('ok');
  // null (free play, older rows) = the older rule
  expect(ideaOutcome(m({run:null}),[])).toBe('ok');
  expect(ideaOutcome(m({run:null,end_reason:'loss'}),[])).toBe('x');
 });
 it('the owner’s detail still wins; a name without a run keeps the public one',()=>{
  const names:IdeaName[]=[{seq:1,name:'A',plan_key:'a',detail:{run:'ran'}},{seq:2,name:'A',plan_key:'a',detail:{}}];
  expect(withRun([m({run:'broke'}),m({seq:2,run:'partly'})],names).map(x=>x.run)).toEqual(['ran','partly']);
 });
 it('scouting counts “came off” as ran as drawn; older rows keep “ran to its end”',()=>{
  const markers=[m({seq:1,run:'ran',end_reason:'loss'}),m({seq:2,run:'broke',end_reason:'complete'}),m({seq:3,run:'partly',progress:'pursued'}),
   m({seq:4,run:'broke',progress:'recognised'}),m({seq:5}),m({seq:6,free:true,run:null}),m({seq:7,side:0,run:'ran'})];
  expect(ideaRecord([{side:1,markers}])).toEqual({matches:1,tried:4,worked:2});
 });
 it('the report counts ideas by the public run',()=>{
  const header={teams:[{name:'Acasă',code:'ACA'},{name:'Oaspeți',code:'OAS'}],players:[],duration:120} as never;
  const report=(run:Marker['run'])=>matchReport([],'x',header,[0,0],[{side:1,outcome:ideaOutcome(m({run}),[])}]).paragraphs.join(' ');
  expect(report('broke')).not.toBe(report('ran'));
  expect(report(null)).toBe(report('ran'));
 });
 it('spoiler gate: the word is known on the row, but no idea incident surfaces before its moment on the clock',()=>{
  const header={players:[],duration:120};
  const ideas=[{...m({run:'ran',end_reason:'loss'}),side:1 as const}];
  const at=(horizon:number)=>buildIncidents({header,events:[],frames:[],ideas,horizon}).filter(x=>x.kind==='idea');
  expect(at(10000)).toEqual([]);
  expect(at(11999)).toEqual([]);
  expect(at(12000).map(x=>[x.t,x.side])).toEqual([[12000,1]]);
  // broke never becomes a "came off" line; partly neither
  expect(buildIncidents({header,events:[],frames:[],ideas:[{...ideas[0],run:'broke'}]}).filter(x=>x.kind==='idea')).toEqual([]);
  expect(buildIncidents({header,events:[],frames:[],ideas:[{...ideas[0],run:'partly'}]}).filter(x=>x.kind==='idea')).toEqual([]);
 });
});
