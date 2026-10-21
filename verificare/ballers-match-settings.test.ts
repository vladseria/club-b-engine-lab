// Ballers match settings (keeper, free kicks, taker): defaults reproduce the
// old engine input byte for byte, and each non-default setting really changes
// what the players do. Real engine, real practice-fixture squads.
import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {runTraining,createTrainingSetup,type TrainingSetup} from '../packages/football-engine/src/index';
import {simulatePractice} from '../packages/football-engine/src/practice';
import {ENGINE_BUILD} from '../packages/football-engine/src/build-info';
import {computeMatch,engineTeam,validateInput,type FrozenInput,type FrozenSide} from '../lib/ballers/compute';
import {clubSide,demoSide,frozenSide,scratchSide} from '../lib/ballers/lab/team';
import {KEEPER_SWEEP,normalizeSettings,sameSettings,settingsSquad,settingsTactics,withKeeper,withPlay,withTaker,type MatchSettings} from '../lib/ballers/match-settings';

const asPlayers=(side:ReturnType<typeof demoSide>)=>side.team.squad.map((p,i)=>({id:p.id,club_id:side.team.id,space:'test',name:p.name,short:side.players[i].short,number:i+1,roles:p.roles,archetype:'motor',temperament:'cold',note:p.note||'x',skills:p.skills,traits:p.traits,energy:p.energy,portrait:side.players[i].portrait,founder:false})) as never;
const home=demoSide(),away=scratchSide();
const approach={progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'} as const;
// FC Prelungitorul: Mircea (keeperSweep 0.08) in goal, Van Pisi (set pieces 8) the natural taker, Flavius (3) not.
const LINEUP=home.team.lineup,LIBERO_LINEUP=['radu',...LINEUP.slice(1)];
function sides(settings?:unknown,lineup=LINEUP):[FrozenSide,FrozenSide]{return [
 frozenSide({id:'home',name:'Home',code:'HOM',color:'#FF3D7F'},asPlayers(home),{lineup,formation:'1-2-1',style:'balanced',approach,captain:null,settings}),
 frozenSide({id:'opp',name:'Opp',code:'OPP',color:'#C9CCD2'},asPlayers(away),{lineup:away.team.lineup,formation:'2-1-1',style:'direct',approach:{...approach,progression:'direct',width:'wide',press:'aggressive',commit:4,striker:'run'},captain:null})];}
const input=(seed:number,settings?:unknown,duration=300,lineup=LINEUP):FrozenInput=>({v:1,match:'ms',seed,kickoff:0,duration,sides:sides(settings,lineup)});
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('match settings: the rules',()=>{
 it('normalize keeps only known values and a taker among the outfield starters',()=>{
  expect(normalizeSettings({keeper:'sweeper',setPiece:'delivery',taker:'van'},LINEUP)).toEqual({keeper:'sweeper',setPiece:'delivery',taker:'van'});
  expect(normalizeSettings({keeper:'x',setPiece:'mixed',taker:'mircea',extra:1},LINEUP)).toEqual({});
  expect(normalizeSettings({taker:'captain'},LINEUP)).toEqual({});// on the bench
  expect(normalizeSettings(null,LINEUP)).toEqual({});expect(normalizeSettings([1],LINEUP)).toEqual({});
  expect(withPlay(withTaker(withKeeper({},'line'),'van'),'mixed')).toEqual({keeper:'line',taker:'van'});
  expect(sameSettings({},{setPiece:undefined})).toBe(true);
 });
 it('defaults hand back the very same tactics and squad objects',()=>{
  const t=engineTeam(sides()[0]);
  expect(settingsTactics(t.tactics,{})).toBe(t.tactics);expect(settingsSquad(t.squad,{})).toBe(t.squad);
  expect(t.tactics).toEqual({...approach,formation:'1-2-1',setPiece:'mixed',fullbacks:'balanced',marking:'balanced'});
  expect(Object.keys(t.tactics)).not.toContain('taker');
 });
 it('the keeper override lands on every keeper and nobody else, at the authored profile values',()=>{
  expect(KEEPER_SWEEP).toEqual({line:.08,sweeper:.9});
  const t=engineTeam(sides({keeper:'sweeper'})[0]);
  for(const p of t.squad)expect(p.traits.keeperSweep).toBe(p.roles.includes('GK')?.9:undefined);
  const lab=clubSide({id:'h',name:'H',code:'HHH',color:'#FF3D7F'},asPlayers(home),LINEUP,'1-2-1',approach,{keeper:'line',taker:'flavius',setPiece:'short'});
  expect(lab.team.tactics).toMatchObject({taker:'flavius',setPiece:'short'});
  expect(lab.team.squad.find(p=>p.id==='radu')!.traits.keeperSweep).toBe(.08);
 });
 it('a practice side carries settings only when they are not the default',()=>{
  expect('settings' in sides()[0]).toBe(false);expect('settings' in sides({})[0]).toBe(false);
  expect('settings' in sides({setPiece:'mixed',taker:'captain'})[0]).toBe(false);
  expect(sides({taker:'van'})[0].settings).toEqual({taker:'van'});
  expect(()=>validateInput(input(1,{keeper:'sweeper'}))).not.toThrow();
 });
});

/** Recorded from the pre-settings code (commit 7edafba) on this engine build:
 * sha256 of computeMatch(input(20260928)).compact. */
const GOLDEN:Record<string,string>={
 '8034f01b67e8102fa49b82ac8629d9b0aa851d77a82e2e0ae0960f37de0f2482':'84bc15f20b3ddf3b4fc291cd4ddbcc3be168e7086d66b3597e6a74f08b131de0',
 // c7652514 (2026-09-29: idea runs commit, the carrier's idea preference capped
 // at 0.2, the start/end commentary counts seconds). None of that touches a
 // match without ideas, so the ideas-free golden is unchanged: this entry is
 // the proof, measured on the new build.
 'c7652514eb5d0def78ac2c047b3f41b158a9b5ad421ae6c531e1a61bc00540d6':'84bc15f20b3ddf3b4fc291cd4ddbcc3be168e7086d66b3597e6a74f08b131de0',
};
describe('match settings: defaults are byte-identical',()=>{
 it('no settings, empty settings, Mixed and a stale taker all play the same match, the one the old code played',()=>{
  const base=hash(computeMatch(input(20260928)).compact);
  // Settings that must be treated as absent, even if a stale row carries them.
  const raw=input(20260928);raw.sides[0].settings={setPiece:'mixed' as never,taker:'captain'};
  expect(hash(computeMatch(input(20260928,{})).compact)).toBe(base);
  expect(hash(computeMatch(raw).compact)).toBe(base);
  if(GOLDEN[ENGINE_BUILD])expect(base).toBe(GOLDEN[ENGINE_BUILD]);
 },240000);
});

type Raw={frames:{players:{duty:string}[];restartInfo?:{taker:string}}[];players:{side:number;role:string}[];events:{kind:string;actor?:string;pass?:{aim:{x:number;y:number}};loft?:{aim:{x:number;y:number}}}[]};
// (Lane C, 2026-10-21; owner's decision: no metre figure, an ordering) Where the home keeper stands while the opponents
// have the ball, and how often he sweeps a ball in behind (frames on the engine's 'sweep' duty), from constructed starts
// with the away side on the ball, 10 s each: the engine's three training scenes mirrored (they have just won it in their
// own half), three with their runner level with our last defender and space behind him, three with the runner already
// past him. Repeated runs of the same starts are four seeds. The spread is the standard deviation across those seeds of
// the per-seed result (mean depth over the frames; total sweep frames over the starts); a setting differs from another
// when the gap between their means is larger than the larger of their two spreads. Before: two seeds (4242, 4244) of a
// 300 s match per setting, ten matches, against a 1.5 m bar that came from them.
// Depth is read where only the stand-off the setting gives (keeperSweepDepth) moves him: the six starts that begin in
// our half, frames with their man on the ball 12-24 m from our goal, never while he is sweeping. Further out his back
// line pulls him up too (keeperLineDepth, from 24 m), and in the mirrored starts he is still walking back from there.
const KEEPER_SEEDS=[1,2,3,4];
type P=[number,number,number,number,number];// side, number, x, y, angle
const KEEPER_STARTS:(()=>TrainingSetup)[]=(()=>{
 const setup=(poses:P[],cx:number,cy:number)=>({scene:'middle' as const,poses:poses.map(([side,number,x,y,angle])=>({side:side as 0|1,number,x,y,angle})),ball:{side:1 as const,number:4,x:cx-.62,y:cy}});
 const mirrored=(scene:'middle'|'left'|'right')=>()=>{const s=createTrainingSetup(scene);return {...s,poses:s.poses.map(p=>({...p,side:(1-p.side) as 0|1,x:48-p.x,y:-p.y,angle:p.angle+Math.PI})),ball:{...s.ball,side:1 as const,x:48-s.ball.x,y:-s.ball.y}};};
 const level=(ry:number,cy=0)=>()=>setup([[0,1,2,0,0],[0,2,15,ry>0?ry-2:ry+2,0],[0,3,24,-7,0],[0,4,24,7,0],[0,5,30,0,0],[1,1,46,0,Math.PI],[1,2,34,0,Math.PI],[1,3,28,-6,Math.PI],[1,4,24,cy,Math.PI],[1,5,16,ry,Math.PI]],24,cy);
 const past=(rx:number,ry:number,cx:number,cy:number)=>()=>setup([[0,1,2,0,0],[0,2,15,ry/2,Math.PI],[0,3,26,-7,0],[0,4,26,7,0],[0,5,32,0,0],[1,1,46,0,Math.PI],[1,2,36,0,Math.PI],[1,3,30,-6,Math.PI],[1,4,cx,cy,Math.PI],[1,5,rx,ry,Math.PI]],cx,cy);
 return [mirrored('middle'),mirrored('left'),mirrored('right'),level(.5),level(-5,-2),level(5,2),past(12,0,21,0),past(11,-4,20,2),past(12,5,22,-1)];
})();
const DEPTH_STARTS=KEEPER_STARTS.slice(3);
function keeperRun(settings:unknown,lineup:string[],start:()=>TrainingSetup,seed:number){
 const teams=sides(settings,lineup).map(engineTeam) as never;
 const r=runTraining({fixture:{teams,seed,kickoff:0},setup:start(),durationSeconds:10,policy:'coordinated',substitutions:'none'}).result as unknown as {players:{id:string;side:number;role:string}[];frames:{players:{x:number;duty?:string}[];ball:{x:number};restart?:boolean;control?:{owner:string}}[]};
 const gk=r.players.findIndex(p=>p.side===0&&p.role==='GK'),at:number[]=[];
 // The band is where the setting's stand-off alone moves him: keeperSweepDepth starts with their ball 12 m out
 // (homeTheirsFrom, world.ts:143) and keeperLineDepth, the back-line pull, starts at 24 m (KEEPER_FOLLOW_FROM, world.ts:148).
 for(const f of r.frames)if(!f.restart&&f.control&&r.players.find(p=>p.id===f.control!.owner)?.side===1&&f.ball.x>=12&&f.ball.x<=24&&f.players[gk].duty!=='sweep')at.push(f.players[gk].x);
 return {at,sweeps:r.frames.filter(f=>f.players[gk]?.duty==='sweep').length};
}
/** Per seed: his mean depth over the depth starts' frames, total sweep frames over the sweep starts; then each one's mean
 * and spread (standard deviation across the seeds). */
function keeperRead(settings:unknown,lineup=LINEUP,sweepStarts:(()=>TrainingSetup)[]=KEEPER_STARTS){
 const per=KEEPER_SEEDS.map(seed=>{
  const runs=new Map([...new Set([...DEPTH_STARTS,...sweepStarts])].map(s=>[s,keeperRun(settings,lineup,s,seed)]));
  const at=DEPTH_STARTS.flatMap(s=>runs.get(s)!.at);
  return {depth:at.reduce((a,b)=>a+b,0)/Math.max(1,at.length),frames:at.length,sweeps:sweepStarts.reduce((n,s)=>n+runs.get(s)!.sweeps,0)};
 });
 const stat=(xs:number[])=>{const m=xs.reduce((a,b)=>a+b,0)/xs.length;return {mean:m,spread:Math.sqrt(xs.reduce((a,b)=>a+(b-m)**2,0)/(xs.length-1))};};
 return {depth:stat(per.map(p=>p.depth)),sweeps:stat(per.map(p=>p.sweeps)),per};
}
/** a is above b by more than the run-to-run spread of either. */
const clearlyAbove=(a:{mean:number;spread:number},b:{mean:number;spread:number})=>a.mean-b.mean>Math.max(a.spread,b.spread);
const said=(x:{mean:number;spread:number})=>`${x.mean.toFixed(2)} (spread ${x.spread.toFixed(2)})`;
// Since 2026-09-30 every keeper judges a ball in behind by forecast arrival, so
// a keeper who stays on his line also comes for a ball he clearly gets first:
// nobody swept before, and "Sweeper sweeps 3x as often" stopped being the
// difference that matters. What the setting changes is how high he stands and
// how far out he will go (keeperSweepDepth / keeperSweepReach): that is asserted.
// If these fail: the keeper setting a manager picks makes no visible difference to where his keeper stands or to how
// often he comes for a ball in behind. Enough: the setting's whole job is his depth while they have the ball and the
// balls in behind he goes for, and the starts give them both (runners level with and past our last defender).
// Mutation check (2026-10-21, lab): keeperSweepDepth zeroed in src fails the depth half on its own; the two keeper
// profiles swapped fails both tests.
describe('match settings: the keeper',()=>{
 it('Sweeper stands a stay-at-home keeper higher and sweeps more; his own habit is what "As usual" plays',()=>{
  const line=keeperRead({keeper:'line'}),sweeper=keeperRead({keeper:'sweeper'});
  // "As usual" is his own trait, which is already the Line value: the same runs, frame for frame (three starts, one seed)
  for(const start of KEEPER_STARTS.slice(0,3))expect(keeperRun(undefined,LINEUP,start,1)).toEqual(keeperRun({keeper:'line'},LINEUP,start,1));
  process.stdout.write(`\nstay-at-home keeper, metres off his line: line ${said(line.depth)}, sweeper ${said(sweeper.depth)}; sweep frames: line ${said(line.sweeps)}, sweeper ${said(sweeper.sweeps)}\n`);
  expect(line.per.every(p=>p.frames>0)&&sweeper.per.every(p=>p.frames>0),'the depth starts give frames to read').toBe(true);
  expect(clearlyAbove(sweeper.depth,line.depth),'stands higher').toBe(true);
  expect(clearlyAbove(sweeper.sweeps,line.sweeps),'sweeps more').toBe(true);
 },600000);
 it('Stay on line keeps a born sweeper deeper',()=>{
  const usual=keeperRead(undefined,LIBERO_LINEUP,[]),line=keeperRead({keeper:'line'},LIBERO_LINEUP,[]);
  process.stdout.write(`\nlibero keeper, metres off his line: usual ${said(usual.depth)}, line ${said(line.depth)}\n`);
  expect(clearlyAbove(usual.depth,line.depth),'stands higher as usual').toBe(true);
 },600000);
});
/** One opening free kick for the home side: who takes it and what he does first. */
function kick(seed:number,settings:MatchSettings|undefined,spot:{x:number;y:number}){
 const r=simulatePractice({teams:sides(settings).map(engineTeam) as never,seed,kickoff:0},12,undefined,true,{policy:'coordinated',substitutions:'none',initialRestart:{kind:'freeKick',side:0,spot}}) as unknown as Raw;
 const taker=r.frames.find(f=>f.restartInfo)!.restartInfo!.taker,first=r.events.find(e=>e.actor===taker&&e.kind!=='restart'&&e.kind!=='kickoff');
 const aim=first?.pass?.aim??first?.loft?.aim;
 return {taker,choice:`${first?.kind}:${aim?`${Math.round(aim.x)},${Math.round(aim.y)}`:''}`};
}
const SPOTS=[{x:36,y:-12},{x:38,y:12},{x:40,y:-9},{x:30,y:0},{x:34,y:5},{x:28,y:-12},{x:42,y:11},{x:24,y:6}];
describe('match settings: free kicks',()=>{
 it('the nominated taker takes every free kick; Auto picks the specialist',()=>{
  for(const spot of SPOTS.slice(0,4)){expect(kick(1,undefined,spot).taker).toBe('0:van');expect(kick(1,{taker:'flavius'},spot).taker).toBe('0:flavius');}
 },120000);
 it('Short and Into the box change what the taker chooses (a small nudge, not a script)',()=>{
  const grid=(s?:MatchSettings)=>[1,2,3].flatMap(seed=>SPOTS.map(spot=>kick(seed,s,spot).choice));
  const mixed=grid(),short=grid({setPiece:'short'}),delivery=grid({setPiece:'delivery'});
  const changed=(x:string[])=>x.filter((c,i)=>c!==mixed[i]).length;
  process.stdout.write(`\nopening free kicks whose first action changed vs Mixed (of ${mixed.length}): short ${changed(short)}, into the box ${changed(delivery)}\n`);
  expect(changed(short)).toBeGreaterThan(0);expect(changed(delivery)).toBeGreaterThan(0);
  // (recon 2026-10-16, finding 16) "changed" holds for a change in any direction; the calls' own direction: Into the box
  // puts more first balls into their box (x >= 40, |y| <= 8; home attacks x = 48) than Mixed, Short fewer
  const intoBox=(x:string[])=>x.filter(c=>{const m=/:(-?\d+),(-?\d+)$/.exec(c);return !!m&&+m[1]>=40&&Math.abs(+m[2])<=8;}).length;
  process.stdout.write(`first balls into the box (of ${mixed.length}): short ${intoBox(short)}, mixed ${intoBox(mixed)}, into the box ${intoBox(delivery)}\n`);
  expect(intoBox(delivery)).toBeGreaterThan(intoBox(mixed));expect(intoBox(short)).toBeLessThan(intoBox(mixed));
 },300000);
});
