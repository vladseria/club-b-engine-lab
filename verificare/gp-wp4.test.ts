// Game plan WP4: phase pictures, rehearsal situations and the counting behind
// rehearsal's one comparison line. Real engine, real compact(), no mocks: a
// short match from the practice fixture gives the frames; the rehearsal plays
// a ready-made move from moments sampled out of them.
//   npx vitest run verificare/gp-wp4.test.ts
import {describe,it,expect,beforeAll} from 'vitest';
import fixtureJson from '../lib/ballers/lab/practice-fixture.json';
import {practicePlayers,validateTrainingSetup,ENGINE_BUILD} from '../packages/football-engine/src/index';
import {laneRisk} from '../packages/football-engine/src/practice';
import {coordinateFootball} from '../packages/football-engine/src/practice-coordination';
import {computeMatch,engineTeam,type FrozenInput,type FrozenSide} from '../lib/ballers/compute';
import {timeline,type CompactMatch,type ReplayFrame} from '../lib/ballers/replay';
import {PHASES,phaseLabels,phaseSeconds} from '../lib/ballers/phase';
import {MIN_PHASE_SECONDS,drawable,mainPlayer,matchesForSetup,mergeShapes,phaseShapes,samePlayed,settingsKey} from '../lib/ballers/phase-shapes';
import {GOES,GO_SECONDS,STOCK_SCENES,routineSetup,comparisonLine,countGo,findMoments,neverLine,pickSituations,runScenes,seedsFor,setupFromFrame,stockSituations,tallyGoes} from '../lib/ballers/scenes';
import {STARTERS} from '../lib/ballers/lab/starters';
import {PRESETS} from '../lib/ballers/league';

type FixturePlayer={id:string;name:string;roles:string[];skills:Record<string,number>;traits:Record<string,number>;energy:number;note:string;archetype?:string;temperament?:string};
const FIX=fixtureJson as unknown as {teams:{id:string;name:string;lineup:string[];squad:FixturePlayer[];tactics:{formation:'1-2-1'}}[]};
function side(i:0|1,approach=PRESETS.balanced,plans:FrozenSide['plans']=[]):FrozenSide{
 const t=FIX.teams[i];
 return {club:{id:t.id,name:t.name,code:i?'OPP':'YOU',color:i?'#C9CCD2':'#FF3D7F'},formation:t.tactics.formation,style:'balanced',approach,captain:t.lineup[1],lineup:[...t.lineup],
  bench:t.squad.filter(p=>!t.lineup.includes(p.id)).map(p=>p.id),
  players:t.squad.map((p,n)=>({id:p.id,name:p.name,short:p.name.split(' ')[0],number:n+1,roles:p.roles as never,skills:p.skills as never,traits:p.traits as never,energy:p.energy,archetype:p.archetype??'',temperament:p.temperament??'',note:p.note,portrait:'p0001'})),plans};
}
const move=STARTERS.find(s=>s.key==='starter-in-behind')!.plan();
const withMove=(lineup:string[])=>[{idea:'m1',key:move.id,name:move.name,plan:move as unknown as Record<string,unknown>,lineup,accent:80}];

let match:CompactMatch,tl:ReturnType<typeof timeline>;
beforeAll(()=>{
 // Seed 4242 -> 4245 (16 Oct 2026, release 2, engine ba53642a). The "decide before receiving" round (commit 5376d118)
 // pulled the forwards back when their side attacks: over 24 seeds x 2 sides on this fixture the forward's
 // attack-minus-defend gap went from +5.9 m (live 9af97c9c) to +4.0 m (se ~0.6), and 8 of 48 single readings came out
 // negative (2 of 48 on live). 4242 first failed at the lane re-check (552c93c9), and 4243/4244 fail too; 4245 passes.
 // The owner accepted the narrower gap and asked for it to be written down: if forwards ever look like they don't
 // push up enough, this is where it started (evidence/2026-10-16-release-2/run.sh has the probe). (Lane C, 2026-10-21:
 // the forward check now reads the engine's targets from a constructed state, below; this match only feeds the pictures
 // and the rehearsal moments, and any seed does that.)
 const input:FrozenInput={v:1,match:'wp4-test',seed:4245,kickoff:0,duration:240,sides:[side(0),side(1)]};
 match=computeMatch(input).compact;tl=timeline(match.header,match.chunks);
},120000);

describe('phase pictures',()=>{
 it('splits every second of the match into the five phases, like the phase function',()=>{
  for(const s of [0,1] as const){
   const shapes=phaseShapes(tl,s),secs=phaseSeconds(tl.frames,phaseLabels(tl.frames,tl.events,s));
   const total=PHASES.reduce((n,p)=>n+(shapes[p]?.seconds??0),0);
   expect(total).toBeCloseTo((tl.frames.at(-1)!.t-tl.frames[0].t)/1000,0);
   for(const p of PHASES)expect(shapes[p]?.seconds??0).toBeCloseTo(secs[p],0);
  }
 });
 it('reads both sides in their own attacking direction (the keeper stays near his own goal)',()=>{
  for(const s of [0,1] as const){const sh=phaseShapes(tl,s);
   for(const p of PHASES){const x=sh[p];if(!x)continue;expect(x.slots[0].x).toBeLessThan(12);}
  }
 });
 it('the forward aims further up when his side has the ball than when the other side has it at the same spot',()=>{
  // If this fails: the attack and defend pictures stop showing a forward who pushes up when his side has the ball,
  // because the engine no longer asks him to. Enough: both teams stand in one neutral shape and only who owns the ball
  // changes, at three spots along the pitch, read for both sides in their own direction.
  // (Lane C, 2026-10-21: before, this read the phase pictures of seed 4245, chosen on 16 Oct because 4242-4244 had come
  // out negative after the decide round narrowed the gap; the owner accepted the narrower gap, see the note above.)
  const teams=[engineTeam(side(0)),engineTeam(side(1))],tactics=teams.map(t=>t.tactics) as [never,never];
  const shape=[[3,0],[14,0],[20,-7],[20,7],[23,0]];
  const aimOf=(owner:0|1,x:number,forward:0|1)=>{
   const players=practicePlayers({seed:1,kickoff:0,teams} as never);
   for(const p of players){const [px,py]=shape[p.number-1];Object.assign(p,{x:p.side?48-px:px,y:p.side?-py:py,vx:0,vy:0,angle:p.side?Math.PI:0});}
   const o=players.find(p=>p.side===owner&&p.number===3)!;Object.assign(o,{x,y:owner?7:-7});
   // one plan is enough: the forward's target after one 0.25 s plan is the one he still has after six (checked when this
   // was written; only a defender's mark drifts by centimetres as plans repeat)
   const v=coordinateFootball(players,{x:o.x,y:o.y,vx:0,vy:0,z:0,vz:0,mode:'control',owner:o.id},owner,tactics,laneRisk,{time:10,recoveredAt:-10});
   const ax=v.jobs[players.find(p=>p.side===forward&&p.number===5)!.id].aim.x;
   return forward?48-ax:ax;// metres up the pitch in his own direction
  };
  for(const s of [0,1] as const)for(const x of [16,24,32])expect(aimOf(s,x,s),`side ${s}, ball at x ${x}`).toBeGreaterThan(aimOf((1-s) as 0|1,x,s));
 });
 it('the attack and defend pictures are the right way round, for both sides',()=>{
  // If this fails: the board shows a side's attacking shape as its defending one, or reads the away side the wrong way
  // up, and the tests above (which compare pictures with each other) would not notice. Enough: a hand-made minute where
  // the answer is not in doubt: 30 s of side 0 on the ball 40 m up the pitch with its forward at 42 m, then 30 s of
  // side 1 on the ball 8 m from side 0's goal with side 0's forward back at 20 m; side 1 stands as the mirror image.
  const pos=(x:number,y:number):[number,number,number]=>[Math.round(x*100),Math.round(y*100),0];
  const frame=(t:number,home:boolean):ReplayFrame=>{
   const ours=home?[[3,0],[20,0],[30,-6],[30,6],[42,0]]:[[1,0],[6,0],[10,-6],[10,6],[20,0]];
   const theirs=home?[[47,0],[44,0],[40,-6],[40,6],[30,0]]:[[45,0],[30,0],[18,-6],[18,6],[9,0]];
   return {t,p:[...ours,...theirs].map(([x,y])=>pos(x,y)),b:home?pos(40,0):pos(8,0),o:home?4:9,ps:home?0:1,s:[0,0]};
  };
  const frames=Array.from({length:301},(_,i)=>frame(i*200,i<150));
  const header={players:Array.from({length:10},(_,i)=>({i,id:`p${i}`}))} as never;
  const home=phaseShapes({header,frames,events:[]},0),away=phaseShapes({header,frames,events:[]},1);
  expect(home.attack!.slots[4].x).toBeCloseTo(42,0);expect(home.defend!.slots[4].x).toBeCloseTo(20,0);
  expect(home.attack!.ball.x).toBeCloseTo(40,0);expect(home.defend!.ball.x).toBeCloseTo(8,0);
  // side 1 read in its own direction: with the ball 40 m up its pitch (x 8) its forward is 39 m up (x 9)
  expect(away.attack!.slots[4].x).toBeCloseTo(39,0);expect(away.defend!.slots[4].x).toBeCloseTo(18,0);
  expect(away.attack!.ball.x).toBeCloseTo(40,0);
 });
 it('names the man who stood in each slot, and merges matches exactly',()=>{
  const a=phaseShapes(tl,0);
  expect(mainPlayer(a.attack!.slots[0])).toBe(FIX.teams[0].lineup[0]);
  const m=mergeShapes([a,a]);
  for(const p of PHASES){if(!a[p])continue;expect(m[p]!.seconds).toBeCloseTo(a[p]!.seconds*2,0);expect(m[p]!.slots[3].x).toBeCloseTo(a[p]!.slots[3].x,1);expect(m[p]!.slots[3].spread).toBeCloseTo(a[p]!.slots[3].spread,1);}
 });
 it('draws a phase only from 60 s of it',()=>{
  expect(MIN_PHASE_SECONDS).toBe(60);
  expect(drawable({seconds:59.9,slots:[],ball:{x:0,y:0}})).toBe(false);
  expect(drawable({seconds:60,slots:[],ball:{x:0,y:0}})).toBe(true);
 });
 it('groups a plan picture by what was played: formation and every setting, never plan id',()=>{
  const direct={formation:'2-1-1',settings:{...PRESETS.direct}};
  expect(samePlayed(direct,{formation:'2-1-1',settings:{...PRESETS.direct,onLoss:'balanced'}})).toBe(true);
  const {onLoss:_,...noOnLoss}=PRESETS.direct;
  expect(samePlayed(direct,{formation:'2-1-1',settings:noOnLoss})).toBe(true); // a missing "On losing it" is Balanced
  expect(samePlayed(direct,{formation:'2-2',settings:{...PRESETS.direct}})).toBe(false);
  expect(samePlayed(direct,{formation:'2-1-1',settings:{...PRESETS.direct,width:'narrow'}})).toBe(false);
  expect(settingsKey(direct)).toContain('2-1-1|direct');
  const res=[
   {match_id:'a',round_id:'r1',home_club:'C',away_club:'X',visible_from:'2026-09-01T00:00:00Z'},
   {match_id:'b',round_id:'r2',home_club:'X',away_club:'C',visible_from:'2026-09-08T00:00:00Z'},
   {match_id:'c',round_id:'r3',home_club:'C',away_club:'Y',visible_from:'2026-09-15T00:00:00Z'},
   {match_id:'d',round_id:'r4',home_club:'C',away_club:'Y',visible_from:'2999-01-01T00:00:00Z'},
   {match_id:'e',round_id:'r5',home_club:'Z',away_club:'Y',visible_from:'2026-09-15T00:00:00Z'}];
  const played=(r:string)=>r==='r3'?{formation:'2-2',settings:PRESETS.direct}:r==='r9'?null:direct;
  const got=matchesForSetup(res,'C',direct,played);
  expect(got.map(m=>[m.match_id,m.side])).toEqual([['b',1],['a',0]]); // newest first; other setups, unfinished and other clubs' matches out
 });
});

describe('rehearsal situations',()=>{
 it('finds open-play moments with our outfielder on the ball, from both sides of a match',()=>{
  for(const s of [0,1] as const){
   const ms=findMoments({match:'m',side:s,...tl});
   expect(ms.length).toBeGreaterThan(4);
   for(const m of ms){expect(m.frame.ps).toBe(s);expect(m.frame.r).toBeUndefined();const pos=m.frame.l?m.frame.l.indexOf(m.frame.o):m.frame.o;expect(pos%5).toBeGreaterThan(0);expect(Math.floor(pos/5)).toBe(s);}
  }
 });
 it('turns a frame into a start the engine accepts, mirrored for the away side',()=>{
  const fx={seed:1,kickoff:0 as const,teams:[engineTeam(side(0)),engineTeam(side(1))]};
  const players=practicePlayers(fx as never);
  let ok=0,tried=0;
  for(const s of [0,1] as const)for(const m of findMoments({match:'m',side:s,...tl},2000)){
   tried++;const setup=setupFromFrame(m.frame,s);if(!setup)continue;ok++;
   expect(()=>validateTrainingSetup(setup,players)).not.toThrow();
   expect(setup.ball.side).toBe(0);
   // the man on the ball is ours and in the right place (mirrored for side 1)
   const f=m.frame,pos=f.l?f.l.indexOf(f.o):f.o,raw=f.p[pos],owner=setup.poses.find(p=>p.side===0&&p.number===setup.ball.number)!;
   const x=raw[0]/100,y=raw[1]/100;
   expect(Math.hypot(owner.x-(s===0?x:48-x),owner.y-(s===0?y:-y))).toBeLessThan(1.2);
  }
  // measured share of usable frames (TECH-SPEC §6.3 asks to measure it before promising a count)
  console.log(`usable moments: ${ok} of ${tried}`);
  expect(ok/tried).toBeGreaterThan(.6);
 });
 it('picks 8 situations spread over the match, deterministically',()=>{
  const ms=findMoments({match:'m',side:0,...tl},4000);
  const a=pickSituations(ms),b=pickSituations(ms);
  expect(a.picked.length).toBe(GOES);
  expect(a.picked.map(p=>p.moment.t)).toEqual(b.picked.map(p=>p.moment.t));
  const ts=a.picked.map(p=>p.moment.t);expect(ts.at(-1)!-ts[0]).toBeGreaterThan(90000);
  expect(a.found).toBe(ms.length);
 });
 it('has the four labelled stock scenes for a new club',()=>{
  const fx={seed:1,kickoff:0 as const,teams:[engineTeam(side(0)),engineTeam(side(1))]};
  const players=practicePlayers(fx as never);
  expect(STOCK_SCENES.map(s=>s.label)).toEqual(['Through the middle','Down the left','Down the right','From the back']);
  for(const s of STOCK_SCENES)expect(()=>validateTrainingSetup(s.setup(),players)).not.toThrow();
  expect(stockSituations().length).toBe(GOES);
 });
 it('derives the same seeds from the same key',()=>{
  expect(seedsFor('k',8)).toEqual(seedsFor('k',8));expect(seedsFor('k',8)).not.toEqual(seedsFor('j',8));
  for(const s of seedsFor('k',8))expect(Number.isInteger(s)&&s>=0&&s<=0xffffffff).toBe(true);
 });
});

describe('rehearsal: 8 goes, each with and without the move, counted from the frames',()=>{
 let result:ReturnType<typeof runScenes>;
 beforeAll(()=>{
  const ours=side(0,PRESETS.balanced,withMove(FIX.teams[0].lineup)),theirs=side(1);
  const {picked}=pickSituations(findMoments({match:'m',side:0,...tl},4000));
  const t0=performance.now();
  result=runScenes({type:'scenes',mode:'rehearse',sides:[ours,theirs],opposition:'original',setups:picked.map(p=>p.setup),seeds:seedsFor('t',GOES),duration:GO_SECONDS});
  console.log(`rehearsal (8 goes x 2, ${GO_SECONDS} s, node): ${Math.round(performance.now()-t0)} ms`);
 },180000);
 it('returns 8 watchable goes, each with its ghost',()=>{
  expect(result.engineBuild).toBe(ENGINE_BUILD);
  expect(result.goes!.length).toBe(GOES);
  for(const g of result.goes!){
   for(const c of [g.with,g.without]){const f=c.chunks.flatMap(x=>x.f);expect(f.length).toBeGreaterThan(GO_SECONDS*5-5);expect(f.at(-1)!.t).toBe(GO_SECONDS*1000);}
   expect(g.dropped).toEqual([]);
   // the ghost never has the move
   expect(countGo(g.without,move.id).status).toBe('never');
  }
  const json=JSON.stringify(result.goes).length;console.log(`rehearsal payload: ${Math.round(json/1024)} KB`);
  expect(json).toBeLessThan(2_000_000);
 });
 it('the move starts in most goes, and the line counts exactly the shots in the frames',()=>{
  const withIt=result.goes!.map(g=>countGo(g.with,move.id)),without=result.goes!.map(g=>countGo(g.without,move.id));
  console.log('goes:',withIt.map(g=>g.status).join(' '));
  expect(withIt.filter(g=>g.status!=='never').length).toBeGreaterThan(3);
  const shots=(c:CompactMatch)=>c.chunks.flatMap(x=>x.e).filter(e=>e.k==='shot'&&e.s===0).length;
  expect(tallyGoes(withIt).shots).toBe(result.goes!.reduce((n,g)=>n+shots(g.with),0));
  expect(tallyGoes(without).shots).toBe(result.goes!.reduce((n,g)=>n+shots(g.without),0));
  console.log(comparisonLine(tallyGoes(withIt),tallyGoes(without)));
 });
});

describe('the words',()=>{
 it('one plain comparison',()=>{
  expect(comparisonLine({shots:3,goals:0},{shots:1,goals:0})).toBe('With it: 3 shots. Without it: 1.');
  expect(comparisonLine({shots:1,goals:0},{shots:0,goals:0})).toBe('With it: 1 shot. Without it: 0.');
  expect(comparisonLine({shots:3,goals:1},{shots:1,goals:0})).toBe('With it: 3 shots and 1 goal. Without it: 1 shot and no goal.');
 });
 it('"never on" only when it happened',()=>{
  expect(neverLine(0)).toBeNull();
  expect(neverLine(1)).toBe('Once it was never on: the pass or run it needs wasn’t there, so they played their normal game.');
  expect(neverLine(2)).toMatch(/^Twice/);expect(neverLine(3)).toMatch(/^3 times/);expect(neverLine(8)).toMatch(/^Every time/);
 });
 it('a go that never started is "never", from the compact ideas',()=>{
  const fake=(ideas:CompactMatch['ideas'],e:{k:string;s:0|1}[]=[]):CompactMatch=>({header:match.header,chunks:[{v:2,i:0,t0:0,t1:20000,f:[] as ReplayFrame[],e:e.map((x,i)=>({t:i*1000,x:'',...x}))}],score:[0,0],stats:match.stats,ideas});
  expect(countGo(fake([]),'k').status).toBe('never');
  const idea=(run:'ran'|'partly'|'broke'|undefined,t=1000)=>({seq:0,side:0 as const,t,endedAt:null,status:'ended',endReason:null,progress:'attempted' as const,planId:'k',name:'k',detail:run?{run}:{}});
  expect(countGo(fake([idea('ran')]),'k').status).toBe('to_plan');
  expect(countGo(fake([idea('partly')]),'k').status).toBe('half');
  expect(countGo(fake([idea(undefined)]),'k').status).toBe('broke');
  expect(countGo(fake([idea('broke',5000),idea('ran',1000)]),'k').status).toBe('to_plan'); // the first start
  const c=countGo(fake([],[{k:'shot',s:0},{k:'shot',s:1},{k:'goal',s:0},{k:'shot',s:0}]),'k');
  expect([c.shots,c.goals]).toEqual([2,1]);
 });
});

describe('a set-piece routine rehearses from its own restart',()=>{
 const lesson={scene:{restart:'corner' as const,side:'any' as const,ball:{x:47,y:-14.5},taker:3 as const,spots:[{number:2 as const,x:30,y:0,leash:1},{number:5 as const,x:38,y:0,leash:1}]},
  spaces:[{id:'near',name:'Near',x:45,y:-3.5,radius:2.5}],
  moments:[{id:'start',name:'The set-up',cue:{kind:'start' as const}},{id:'kick',name:'At the kick',cue:{kind:'restart-taken' as const}}],
  jobs:[{id:'cross',momentId:'start',actor:3 as const,kind:'pass' as const,recipient:5 as const,spaceId:'near',delivery:'auto' as const,fallback:true},{id:'attack',momentId:'kick',actor:5 as const,kind:'run' as const,spaceId:'near'}]};
 const plan={id:'move:corner',name:'Near-post corner',weight:100,emphasis:.8,instructions:[],preferred:null,lesson};
 it('every go starts at the corner, taker on the ball, drawn spots taken, and the routine is counted',()=>{
  const ours=side(0,PRESETS.balanced,[{idea:'c1',key:plan.id,name:plan.name,plan:plan as unknown as Record<string,unknown>,lineup:FIX.teams[0].lineup,accent:80}]);
  const players=practicePlayers({seed:1,kickoff:0,teams:[engineTeam(ours),engineTeam(side(1))]} as never);
  const setup=routineSetup(lesson.scene as never,players);
  expect(setup.restart?.kind).toBe('corner');expect(setup.ball.number).toBe(3);
  expect(setup.poses.find(p=>p.side===0&&p.number===5)).toMatchObject({x:38,y:0});
  const r=runScenes({type:'scenes',mode:'rehearse',sides:[ours,side(1)],opposition:'original',setups:[setup,setup],seeds:seedsFor('corner',2),duration:GO_SECONDS});
  const counts=r.goes!.map(g=>countGo(g.with,plan.id));
  console.log('routine goes:',counts.map(c=>c.status).join(' '));
  expect(counts.some(c=>c.status!=='never')).toBe(true);
  expect(r.goes!.every(g=>countGo(g.without,plan.id).status==='never')).toBe(true);
 },120000);
});
