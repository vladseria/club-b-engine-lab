// Engine as data, S0 tool 4 (the row): one parity task on one engine revision. Evidence only; nothing here writes to
// the engine. Bundled once per revision by run.mjs (../_ci/revs.mjs), so compute, presets, scenes and the engine are
// the revision's own and this file is the harness's.
//
// Task kinds (set.mjs builds the 512):
//   match     computeMatch's exact runMatch call (lib/ballers/compute.ts, as ../2026-10-19-engine-speed/speed.ts plays
//             it), from frozen sides (../2026-10-09-scenarios/sides, ./global-r7) or the neutral five, with the side
//             edits a task names; `teamEdit` edits the engine Tactics after engineTeam (fields the app fixes: marking,
//             fullbacks; a key removed = an old input), `teamOrders` puts a tactics order in Team.orders.
//   scenes    lib/ballers/scenes.ts runScenes's rehearsal, re-done here so the RAW engine results are hashed (runScenes
//             returns compacts only): per go, runTraining with the move and without it, same moment, same seed.
//   training  runTraining from a stock scene or a restart setup (createRestartSetup), optionally with a playbook (the
//             corner routine of test/set-piece-routines.test.mjs), the opposition through withDefensiveApproach.
//   trial     lib/ballers/engine.worker.ts `trial`: the baseline run and the run with the plan.
// Row: print = [length, fnv32 a, fnv32 b] over the compact replay(s), full = sha256 over the WHOLE engine result(s),
// key by key and element by element (speed.ts's fullHash; for several runs, the sha256 of their full hashes in
// order), build, ms, score, the resolved tactics of both sides, and a variety read (plans, subs, restarts, purposes).
import {runMatch,runTraining,createSimulationRequest,ENGINE_BUILD,createTrainingSetup,createRestartSetup,practicePlayers,validatePlans,withDefensiveApproach} from '../../src/index';
import {engineTeam,sidePlans,sideOrders,compact} from '../../../../lib/ballers/compute';
import {PRESETS} from '../../../../lib/ballers/league';
import {STOCK_SCENES,seedsFor} from '../../../../lib/ballers/scenes';
import MOVES from '../2026-10-16-release-3/move-plans.json';
import {createHash} from 'node:crypto';

let DATA:{scen:Record<string,any>;g7:Record<string,any>}={scen:{},g7:{}};
export function init(d:any){DATA=d;}
/** --build-only (run.mjs): every input is built and validated exactly as for a real run, but no simulation is played. */
let DRY=false;export function setDry(v:boolean){DRY=v;}
/** An optional read of the raw results (../2026-10-22-whatif/row.ts sets it): its value is added to the row as `extra`.
 * Unset (every run before the what-if harness) the row is exactly what it was. It reads the results; it changes nothing. */
let EXTRA:null|((runs:any[],teams:any[],t:any)=>any)=null;export function setExtra(f:typeof EXTRA){EXTRA=f;}
const FAKE=(d:number)=>({result:{duration:d,players:[],frames:[],events:[],choices:[],stats:[{},{}],score:[0,0]}});
const RUN_MATCH=(i:any)=>DRY?(createSimCheck(i),FAKE(i.durationSeconds)):runMatch(i);
const RUN_TRAINING=(i:any)=>DRY?(createSimCheck({...i,kind:'training'}),FAKE(i.durationSeconds)):runTraining(i);
const createSimCheck=(i:any)=>createSimulationRequest({kind:'match',...i});

// ------------------------------------------------------------------ fingerprints (speed.ts, unchanged)
const fnv=(s:string,h:number)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const print=(c:any)=>{const s=JSON.stringify(c);return [s.length,fnv(s,2166136261),fnv(s,0x9747b28c)];};
function fullHash(r:any){
 const h=createHash('sha256');
 for(const k of Object.keys(r)){
  h.update(k+'\0');const v=r[k];
  if(Array.isArray(v)){h.update('['+v.length+']');for(const e of v)h.update(JSON.stringify(e)??'u');}
  else h.update(JSON.stringify(v)??'u');
 }
 return h.digest('hex').slice(0,24);
}
const combine=(xs:string[])=>xs.length===1?xs[0]:createHash('sha256').update(xs.join(',')).digest('hex').slice(0,24);

// ------------------------------------------------------------------ sides
/** The neutral five of ../2026-10-20-pitch-probe/squads.ts (branch pitch-probe), copied: every outfield skill 6
 * (keeping 1), traits 0.5 (discipline 0.8, frustration 1), no bench, no plans; a preset exactly as shipped. */
const OUT={pace:6,aerial:6,control:6,passing:6,reading:6,stamina:6,strength:6,defending:6,finishing:6,setPieces:6,keeping:1};
const GK={pace:5,aerial:6,control:5,passing:5,reading:6,stamina:6,strength:6,defending:3,finishing:2,setPieces:3,keeping:6};
const TRAITS={risk:.5,runs:.5,dribble:.5,comesShort:.5,engagement:.5,discipline:.8,frustration:1,audacity:.5};
function neutral(code:string,style:string,formation:string):any{
 const roles=[['GK'],['CB'],['CB'],['CM'],['ST']];
 const players=roles.map((r,i)=>({id:`${code}${i+1}`,name:`${code} ${i+1}`,short:`${code}${i+1}`,number:i+1,roles:[...r],skills:{...(i?OUT:GK)},traits:i?{...TRAITS}:{...TRAITS,keeperSweep:.5},energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'}));
 return {club:{id:code,name:code,code,color:'#888888'},formation,style,approach:{...(PRESETS as any)[style]},captain:`${code}2`,lineup:players.map(p=>p.id),bench:[],players,plans:[]};
}
/** The corner routine of test/set-piece-routines.test.mjs corner(), copied: #3 takes, #5 attacks the near post. */
function cornerRoutine(fixture:any){
 const players=practicePlayers(fixture);
 const setup=createRestartSetup('corner',players,{side:'left',taker:3});
 for(const p of setup.poses)if(p.side===0&&p.number===5)Object.assign(p,{x:38,y:0});
 const spots=setup.poses.filter(p=>p.side===0&&p.number>1&&p.number!==3).map(p=>({number:p.number,x:p.x,y:p.y,leash:1}));
 const lesson={scene:{restart:'corner',side:'any',ball:{x:setup.ball.x,y:setup.ball.y},taker:3,spots},
  spaces:[{id:'near',name:'Near post',x:45,y:-3.5,radius:2.5}],
  moments:[{id:'start',name:'The set-up',cue:{kind:'start'}},{id:'kick',name:'At the kick',cue:{kind:'restart-taken'}}],
  jobs:[{id:'cross',momentId:'start',actor:3,kind:'pass',spaceId:'near',recipient:5,delivery:'auto',fallback:true},{id:'attack',momentId:'kick',actor:5,kind:'run',spaceId:'near'}]};
 return {setup,plan:{id:'corner-near',name:'Near post',weight:100,instructions:[],preferred:null,lesson}};
}
const moveOf=(key:string)=>{const m=(MOVES as any[]).find(x=>x.key===key);if(!m)throw Error('unknown move '+key);return m.plan;};

/** A side as the task names it. spec: {src:'scen'|'g7'|'neutral', code, style?, formation?, keeper?:'L'|'S'|'D'|'O',
 * preset?, approach?:{...}, drop?:[keys], settings?:{}|null, subs?:'none', plans?:[{move,accent}|{routine:'corner'}], bench?:'none'} */
export function sideOf(spec:any,routineFixture?:any):any{
 let b:any;
 if(spec.src==='neutral')b=neutral(spec.code,spec.style??'balanced',spec.formation??'1-2-1');
 else{const s=(DATA as any)[spec.src]?.[spec.code];if(!s)throw Error(`no side ${spec.src}:${spec.code}`);b=JSON.parse(JSON.stringify(s));}
 if(spec.keeper){// speed.ts inputOf, exactly: the stored keeper call is dropped, then L / S set it, D sets every keeper's trait to .2
  const settings={...(b.settings??{})};delete settings.keeper;
  if(spec.keeper==='L')settings.keeper='line';
  if(spec.keeper==='S')settings.keeper='sweeper';
  if(spec.keeper==='D')b.players=b.players.map((p:any)=>p.roles.includes('GK')?{...p,traits:{...p.traits,keeperSweep:.2}}:p);
  if(Object.keys(settings).length)b.settings=settings;else delete b.settings;
 }
 if(spec.preset){b.approach={...(PRESETS as any)[spec.preset]};b.style=spec.preset;}
 if(spec.approach)b.approach={...b.approach,...spec.approach};
 for(const k of spec.drop??[])delete b.approach[k];
 if(spec.formation&&spec.src!=='neutral')b.formation=spec.formation;
 if(spec.settings===null)delete b.settings;else if(spec.settings)b.settings={...spec.settings};
 if(spec.taker!==undefined){b.settings={...(b.settings??{}),taker:spec.taker===true?b.lineup[4]:spec.taker};}
 if(spec.subs==='none')delete b.substitutions;
 if(spec.bench==='none'){b.bench=[];}
 if(spec.plans){
  // a routine needs the fixture's players to lay out its spots: left out until the caller has one (play() builds twice)
  b.plans=spec.plans.filter((p:any)=>!p.routine||routineFixture).map((p:any)=>{
   const plan=p.routine?cornerRoutine(routineFixture).plan:moveOf(p.move);
   return {idea:p.routine?'routine':'move',key:plan.id,name:plan.name,plan,lineup:[...b.lineup],accent:p.accent??80,assign:{}};
  });
 }
 return b;
}
const TACTIC_KEYS=['formation','progression','width','line','press','commit','striker','transition','onLoss','setPiece','taker','marking','fullbacks'];
const tacticsRead=(t:any,squad:any[],lineup:string[])=>{
 const o:any={};for(const k of TACTIC_KEYS)o[k]=k in t?t[k]:'(missing)';
 if(o.taker!=='(missing)')o.taker='set';
 const gk=squad.find(p=>p.id===lineup[0]);o.keeperSweep=gk?.traits?.keeperSweep??'(missing)';
 return o;
};

// ------------------------------------------------------------------ variety (read from the first revision's result)
function variety(results:any[],teams:any[]){
 const v:any={runs:results.length,plansActive:0,plansAttempted:0,routinesTaken:0,subsMade:0,subsOrders:0,restarts:{},purposes:{},sweeps:0,breaksByCounterSide:0,shots:0,goals:0};
 const counterSide=teams.map(t=>t.tactics.transition==='counter');
 for(const r of results){
  v.goals+=r.score[0]+r.score[1];
  for(const e of r.events){if(e.restartKind)v.restarts[e.restartKind]=(v.restarts[e.restartKind]??0)+1;if(e.kind==='shot')v.shots++;}
  for(const s of r.playbookSelections??[]){if(s.planId){if(s.status==='active'||s.status==='ended')v.plansActive++;if((s.trace??[]).some((x:any)=>x.intent==='attempted'))v.plansAttempted++;if(s.restartTakenAt!==undefined)v.routinesTaken++;}}
  for(const n of r.substitutionNotes??[]){v.subsOrders++;if(n.status==='made')v.subsMade++;}
  const sideOf=(i:number)=>r.players[i]?.side;
  for(const c of r.choices){
   const pu=c.assignment?.purpose;if(pu&&['counter-press','counter-screen','trap','trap-screen','break','pivot','third-man','overlap','playbook','shoulder','drop','last-man'].includes(pu))v.purposes[pu]=(v.purposes[pu]??0)+1;
   if(c.kind==='sweep')v.sweeps++;
   if(pu==='break'&&counterSide[sideOf(c.player)])v.breaksByCounterSide++;
  }
 }
 return v;
}

// ------------------------------------------------------------------ play one task
export function play(t:any){
 const t0=performance.now(),c0=process.cpuUsage();
 const runs:any[]=[],prints:number[][]=[];let teamsOut:any[]=[],dropped:string[]=[],score:[number,number]=[0,0];
 if(t.kind==='match'){
  const sides=t.sides.map((s:any)=>sideOf(s,null));
  // a routine plan needs the fixture's players to lay out its spots: built from the sides as the match will see them
  if(t.sides.some((s:any)=>s.plans?.some((p:any)=>p.routine))){
   const fx={seed:t.seed,kickoff:t.kickoff,teams:sides.map(engineTeam)};
   t.sides.forEach((s:any,i:number)=>{if(s.plans?.some((p:any)=>p.routine))sides[i]=sideOf(s,i===0?fx:{...fx,teams:[fx.teams[1],fx.teams[0]]});});
  }
  const input={v:1,match:t.id,seed:t.seed,kickoff:t.kickoff,duration:t.duration??900,sides};
  const teams=input.sides.map(engineTeam);
  (t.teamEdit??[]).forEach((e:any,i:number)=>{if(!e)return;for(const [k,v] of Object.entries(e)){if(v===null)delete (teams[i].tactics as any)[k];else (teams[i].tactics as any)[k]=v;}});
  if(t.teamOrders)teams.forEach((tm:any)=>{tm.orders=[{id:'o1',minute:5,when:'always',tactics:{press:'aggressive',line:'high'}}];});
  const plans=input.sides.map(sidePlans);
  const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
  const subs=sideOrders(input as any,teams as any);
  dropped=[...plans.flatMap((p:any)=>p.dropped),...subs.dropped];
  const run=RUN_MATCH({fixture:{teams,seed:input.seed,kickoff:input.kickoff},durationSeconds:input.duration,policy:'coordinated',substitutions:'none',record:true,...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
  runs.push(run.result);prints.push(print(compact(input as any,run.result as any)));teamsOut=teams;score=(run.result as any).score;
 }else{
  // training kinds: a fixture from two sides, the opposition on side 1
  const sides=t.sides.map((s:any)=>sideOf(s,null));
  const input:any={v:1,match:t.id,seed:0,kickoff:0,duration:t.duration,sides};
  const fixtureFor=(seed:number)=>withDefensiveApproach({seed,kickoff:0,teams:[engineTeam(sides[0]),engineTeam(sides[1])]} as any,1,t.opposition??'original');
  const base=fixtureFor(t.seed);teamsOut=base.teams;
  const common=(fixture:any,setup:any)=>({fixture,durationSeconds:t.duration,policy:'coordinated' as const,setup,substitutions:'none' as const});
  const add=(r:any)=>{runs.push(r);prints.push(print(compact(input,r)));score=[score[0]+r.score[0],score[1]+r.score[1]];};
  if(t.kind==='scenes'){
   // runScenes (lib/ballers/scenes.ts), re-done to keep the raw results: same fixture per go, with and without the move
   const ours=sideOf({...t.sides[0],plans:[{move:t.move,accent:100}]},null);
   const {plans,dropped:d}=sidePlans(ours);dropped=d;
   const setups=t.scenes.map((id:string)=>STOCK_SCENES.find(s=>s.id===id)!.setup());
   const seeds=seedsFor(`ead:${t.move}:${t.round}`,setups.length);
   setups.forEach((setup:any,i:number)=>{
    const c=common(fixtureFor(seeds[i]),setup);
    add(RUN_TRAINING(plans.length?{...c,playbook:{side:0,plans,adaptive:true}}:c).result);
    add(RUN_TRAINING(c).result);
   });
  }else if(t.kind==='training'){
   let setup:any,playbook:any;
   if(t.scene)setup=STOCK_SCENES.find(s=>s.id===t.scene)!.setup();
   if(t.restart)setup=createRestartSetup(t.restart,practicePlayers(base),t.restartOpts??{});
   if(t.routine){const r=cornerRoutine(base);setup=r.setup;playbook={side:0,plans:validatePlans([r.plan]),adaptive:true};}
   add(RUN_TRAINING({...common(base,setup),...(playbook?{playbook}:{})}).result);
  }else if(t.kind==='trial'){
   const setup=STOCK_SCENES.find(s=>s.id===t.scene)!.setup();
   const plans=validatePlans([moveOf(t.move)]);
   add(RUN_TRAINING(common(base,setup)).result);
   add(RUN_TRAINING({...common(base,setup),playbook:{side:0,plans,adaptive:true}}).result);
  }else throw Error('unknown task kind '+t.kind);
 }
 const ms=Math.round(performance.now()-t0),cpu=process.cpuUsage(c0),cpuMs=Math.round((cpu.user+cpu.system)/1000);
 const full=combine(runs.map(fullHash));
 const pr=prints.length===1?prints[0]:prints.reduce((a,p)=>[a[0]+p[0],fnv(String(p[1]),a[1]),fnv(String(p[2]),a[2])],[0,2166136261,0x9747b28c]);
 return {id:t.id,ms,cpuMs,score,print:pr,full,runs:runs.length,frames:runs.reduce((n,r)=>n+r.frames.length,0),build:ENGINE_BUILD.slice(0,8),plat:`${process.platform}-${process.arch}-node${process.versions.node}`,
  dropped,tactics:teamsOut.map((tm:any)=>tacticsRead(tm.tactics,tm.squad,tm.lineup)),variety:variety(runs,teamsOut),...(EXTRA?{extra:(()=>{try{return EXTRA!(runs,teamsOut,t);}catch(e){return {error:String(e)};}})()}:{})};
}
