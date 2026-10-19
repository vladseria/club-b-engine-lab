// Practice "good chances" and what practice shows (owner, 4 Oct; ENGINE-PLANS-MATTER §3b):
// the calibration table belongs to this engine build, a match's good chances are the sum
// over its shots, the confidence words follow their rules, setups hash without the seed,
// the tab's store survives a storage that refuses, and the match report shows good chances
// only for a replay it can read on the table's build.
import {describe,it,expect,afterEach,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {ENGINE_BUILD} from '../packages/football-engine/src/index';
import {CHANCE_TABLE,chanceText,matchChances,rateOf,shotChance,type ChanceTable} from '../lib/ballers/chances';
import {amount,asShown,averagesOf,shownDiff,batchWords,compareOf,compareWords,floorFor,howYouPlayed,readOf,readWords,runStatsOf,sd,setupLabels,wonInTheirHalf} from '../lib/ballers/practice-read';
import {KEEP_REPLAYS,MAX_RUNS,NEWEST_CHIPS,chipsShown,MAX_SETUPS,addToBook,bookKey,emptyBook,loadBook,loadPace,retain,runChips,saveBook,savePace,versionKey,type Book,type RunFacts,type RunStats} from '../lib/ballers/practice-store';
import {buildReport,type ReportInput} from '../lib/ballers/plan-report';
import {computeMatch,type FrozenInput} from '../lib/ballers/compute';
import type {ReplayEvent,ReplayFrame,ReplayHeader} from '../lib/ballers/replay';

describe('the calibration table',()=>{
 it('was measured on this engine build (regenerate after any engine change: packages/football-engine/evidence/2026-10-04-practice-chances/run.mjs, then table.mjs)',()=>{
  expect(CHANCE_TABLE.build).toBe(ENGINE_BUILD);
 });
 it('is monotone in the quality read and every rate is a probability',()=>{
  const k=CHANCE_TABLE.knots;
  expect(k.length).toBeGreaterThan(2);
  for(let i=1;i<k.length;i++){expect(k[i][0]).toBeGreaterThan(k[i-1][0]);expect(k[i][1]).toBeGreaterThanOrEqual(k[i-1][1]);}
  for(const [,r] of k){expect(r).toBeGreaterThanOrEqual(0);expect(r).toBeLessThanOrEqual(1);}
  for(const r of Object.values(CHANCE_TABLE.kinds)){expect(r).toBeGreaterThanOrEqual(0);expect(r).toBeLessThanOrEqual(1);}
  expect(CHANCE_TABLE.sdDiff).toBeGreaterThan(0);
  expect(CHANCE_TABLE.matches).toBeGreaterThanOrEqual(100);
 });
});

// a small table so the arithmetic is checkable by hand
const T:ChanceTable={build:'b',knots:[[.1,.1],[.5,.3],[.9,.7]],kinds:{1:.2,2:.25,3:.05},sdDiff:2,sdFor:1.5,matches:100,shots:1000};
const header={players:[{i:0,side:0},{i:1,side:0},{i:5,side:1}]} as unknown as Pick<ReplayHeader,'players'>;
const shot=(o:Partial<ReplayEvent>):ReplayEvent=>({t:0,k:'shot',x:'',...o});

describe('good chances: the sum over a match\'s shots',()=>{
 it('reads a shot by its quality (linear between knots, flat beyond), an unread one by its kind',()=>{
  expect(rateOf(.05,T)).toBe(.1);expect(rateOf(.3,T)).toBeCloseTo(.2);expect(rateOf(.95,T)).toBe(.7);
  expect(shotChance({q:.5},T)).toBeCloseTo(.3);expect(shotChance({sk:1},T)).toBe(.2);expect(shotChance({sk:3},T)).toBe(.05);
  expect(shotChance({},T)).toBeNull();
 });
 it('sums each side, by the event side or the shooter\'s',()=>{
  const ev=[shot({q:.5,s:0,a:0}),shot({q:.9,a:1}),shot({sk:2,a:5}),{t:1,k:'goal',x:'',s:0} as ReplayEvent,shot({q:.1,s:1,a:5})];
  const c=matchChances(ev,header,'b',T)!;
  expect(c[0]).toBeCloseTo(.3+.7);expect(c[1]).toBeCloseTo(.25+.1);
 });
 it('is null for another build, or when any shot has no read (a replay from before 4 Oct)',()=>{
  const ev=[shot({q:.5,s:0}),shot({s:1})];
  expect(matchChances([shot({q:.5,s:0})],header,'other',T)).toBeNull();
  expect(matchChances([shot({q:.5,s:0})],header,null,T)).toBeNull();
  expect(matchChances(ev,header,'b',T)).toBeNull();
  expect(matchChances([],header,'b',T)).toEqual([0,0]);
 });
 it('reads one decimal',()=>{expect(chanceText(3.449)).toBe('3.4');expect(chanceText(0)).toBe('0.0');});
 it('the compactor stamps every shot of a real match with its read (q) or its kind (sk)',()=>{
  const fx=JSON.parse(readFileSync(new URL('../packages/football-engine/evidence/2026-10-03-defending-awareness/inputs/sides.json',import.meta.url),'utf8'));
  const side=(s:any)=>({club:s.club,formation:s.formation,style:s.style,approach:s.approach,captain:s.captain,lineup:s.lineup,
   bench:fx.players.filter((p:any)=>p.club_id===s.club.id&&!s.lineup.includes(p.id)).map((p:any)=>p.id),
   players:fx.players.filter((p:any)=>p.club_id===s.club.id).map((p:any)=>({id:p.id,name:p.name,short:p.short,number:p.number,roles:p.roles,skills:p.skills,traits:p.traits,energy:p.energy,archetype:p.archetype,temperament:p.temperament,note:p.note,portrait:p.portrait})),plans:[]});
  const input:FrozenInput={v:1,match:'chances-test',seed:7,kickoff:0,duration:180,sides:[side(fx.men),side(fx.mcb)] as FrozenInput['sides']};
  const c=computeMatch(input).compact,events=c.chunks.flatMap(x=>x.e),shots=events.filter(e=>e.k==='shot');
  expect(shots.length).toBeGreaterThan(0);
  for(const e of shots)expect(typeof e.q==='number'||[1,2,3].includes(e.sk as number)).toBe(true);
  for(const e of events.filter(e=>e.k!=='shot'))expect(e.q===undefined&&e.sk===undefined).toBe(true);
  const both=matchChances(events,c.header,ENGINE_BUILD)!;
  expect(both[0]+both[1]).toBeGreaterThan(0);
 },120000);
});

describe('confidence words',()=>{
 const F=2;
 it('one run: no verdict',()=>{
  const r=readOf([3.1],F);expect(r.band).toBe('early');expect(readWords(r)).toBe('One run: too early to read.');
 });
 it('a small sample never looks surer than the floor allows (two identical runs have sd 0)',()=>{
  const r=readOf([1.5,1.5],F);
  expect(sd([1.5,1.5])).toBe(0);
  expect(r.se).toBeCloseTo(F/Math.sqrt(2));
  expect(r.band).toBe('leaning');
 });
 it('< 1 se not sure yet; 1-2 se leaning; >= 2 se fairly sure; the owner\'s example reads as he liked it',()=>{
  // 5 runs, floor 2: se = 2 / sqrt 5 = 0.894
  expect(readWords(readOf([.5,.5,.5,.5,.5],F))).toBe('After 5 runs: you’re making about 0.5 more good chances a match than they are, not sure yet.');
  expect(readWords(readOf([1,1,1,1,1],F))).toBe('After 5 runs: you’re making about 1 more good chance a match than they are, leaning your way, not sure yet.');
  expect(readWords(readOf([-1.2,-1.2,-1.2,-1.2,-1.2],F))).toBe('After 5 runs: they’re making about 1.2 more good chances a match than you are, leaning their way, not sure yet.');
  expect(readWords(readOf([2,2,2,2,2],F))).toBe('After 5 runs: you’re making about 2 more good chances a match than they are, fairly sure.');
  expect(readWords(readOf([.02,-.01,.01],F))).toBe('After 3 runs: your good chances a match and theirs are about level, not sure yet.');
 });
 it('a wide sample uses its own spread, not the floor',()=>{
  const xs=[-4,6,-3,7,1],r=readOf(xs,F);
  expect(r.se).toBeCloseTo(sd(xs)/Math.sqrt(5));
 });
 it('the floor shrinks with a shorter match (sd scales with the square root of the length)',()=>{
  expect(floorFor(900,T)).toBeCloseTo(2);expect(floorFor(300,T)).toBeCloseTo(2*Math.sqrt(1/3));
 });
 it('comparing two setups: early while either has one run, then the same bands on the difference',()=>{
  expect(compareOf([1],[0,0],F).band).toBe('early');
  expect(compareWords(compareOf([1],[0,0],F),'Short plan','Direct plan',1,2)).toBe('Too early to compare: Short plan has 1 run.');
  // se = sqrt(4/5 + 4/5) = 1.265
  const lean=compareOf([1.5,1.5,1.5,1.5,1.5],[0,0,0,0,0],F);
  expect(lean.band).toBe('leaning');
  expect(compareWords(lean,'Short plan','Direct plan',5,5)).toBe('Short plan comes out about 1.5 good chances a match ahead of Direct plan, leaning towards Short plan, not sure yet.');
  const behind=compareOf([0,0,0,0,0],[3,3,3,3,3],F);
  expect(compareWords(behind,'Short plan','Direct plan',5,5)).toBe('Direct plan comes out about 3 good chances a match ahead of Short plan, fairly sure.');
 });
 it('never says a percentage, odds or xG',()=>{
  const all=[readOf([1,2],F),readOf([1,2,3,4,5],F),readOf([-3,-3,-3],F),compareOf([1,1],[0,0],F)].map(r=>readWords(r));
  for(const t of all)expect(t).not.toMatch(/%|odds|xG|probab|likely to win/i);
  expect(amount(1.04)).toBe('1');expect(amount(-0.25)).toBe('0.3');
 });
});

describe('one run, you v them',()=>{
 const frame=(ps:0|1,x:number,o:Partial<ReplayFrame>={}):ReplayFrame=>({t:0,p:[],b:[x,0,0],o:-1,ps,s:[0,0],...o});
 it('balls won in their half: open-play changes of possession, where the ball was',()=>{
  const f=[frame(0,1000),frame(1,1000),frame(0,3000),frame(0,3000),frame(1,1000,{r:1}),frame(0,4000),frame(1,4500,{c:1}),frame(0,2000)];
  // 1 wins at 10 m (their half for side 1: x < 24 m), 0 at 30 m (theirs), restart skipped, cut skipped, 0 wins at 20 m (own half)
  expect(wonInTheirHalf(f)).toEqual([1,1]);
 });
 it('rows you v them, good chances only when readable',()=>{
  const st=(possession:number,passes:number,completed:number,shots:number)=>({possession,passes,completed,shots,goals:0,clearances:0,saves:0,turnovers:0,tackles:0,tacklesWon:0,feints:0,beaten:0,fouls:0,offsides:0,pressSeconds:0,coverSeconds:0});
  const c={stats:[st(300,100,80,3),st(200,50,35,2)],header:{...header,duration:900} as ReplayHeader,chunks:[{v:2,i:0,t0:0,t1:60000,f:[],e:[shot({q:.5,s:0}),shot({sk:1,s:1})]}]} as never;
  const rows=howYouPlayed(c,0,'b',T);
  expect(rows.map(r=>[r.label,...r.text])).toEqual([['Possession %','60','40'],['Passes completed %','80','70'],['Shots','3','2'],['Good chances','0.3','0.2'],['Won the ball in their half','0','0']]);
  expect(howYouPlayed(c,1,'b',T)[0].text).toEqual(['40','60']);
  expect(howYouPlayed(c,0,'other',T).some(r=>r.key==='chances')).toBe(false);
  // what the book keeps of the run: the same numbers, yours first
  expect(runStatsOf(c,0)).toEqual({pos:[60,40],pc:[80,35],pa:[100,50],shots:[3,2],won:[0,0]});
  expect(runStatsOf(c,1)).toEqual({pos:[40,60],pc:[35,80],pa:[50,100],shots:[2,3],won:[0,0]});
 });
});

describe('across the runs: averages a match, you v them in the same runs',()=>{
 const st=(pos:[number,number],pc:[number,number],pa:[number,number],shots:[number,number],won:[number,number]):RunStats=>({pos,pc,pa,shots,won});
 const run=(s:RunStats|undefined,c:[number,number]|null=null):RunFacts=>({gf:0,ga:0,c,...(s?{s}:{})});
 const text=(rows:{label:string;text:[string,string]}[])=>rows.map(r=>[r.label,...r.text]);
 it('means a match for possession, shots, balls won and good chances; passes completed over all passes tried',()=>{
  const a=averagesOf([
   run(st([60,40],[80,35],[100,50],[3,2],[5,1]),[2,1]),
   run(st([50,50],[10,45],[20,50],[4,4],[2,2]),[1,1.5]),
   run(st([46,54],[30,40],[40,60],[2,6],[1,3]),[0.4,2.1]),
  ])!;
  expect(a.n).toBe(3);expect(a.nChances).toBe(3);
  // possession (60+50+46)/3 = 52 v 48; passes 120/160 = 75 % v 120/160 = 75 % (not the mean of 80, 50, 75 = 68 %);
  // shots 9/3 = 3.0 v 12/3 = 4.0; good chances 3.4/3 = 1.13 v 4.6/3 = 1.53; won 8/3 = 2.67 v 6/3 = 2
  expect(text(a.rows)).toEqual([['Possession %','52','48'],['Passes completed %','75','75'],['Shots','3.0','4.0'],['Good chances','1.1','1.5'],['Won the ball in their half','2.7','2.0']]);
  expect(a.rows.find(r=>r.key==='shots')).toMatchObject({us:3,them:4});
 });
 it('each side is anchored by the other in the same runs: swapping sides swaps every row',()=>{
  const runs=[run(st([55,45],[40,30],[50,40],[5,3],[4,2]),[2.2,1.1]),run(st([61,39],[45,20],[60,30],[7,1],[6,0]),[3,0.5])];
  const swap=(r:RunFacts):RunFacts=>({...r,c:r.c&&[r.c[1],r.c[0]],s:r.s&&{pos:[r.s.pos[1],r.s.pos[0]],pc:[r.s.pc[1],r.s.pc[0]],pa:[r.s.pa[1],r.s.pa[0]],shots:[r.s.shots[1],r.s.shots[0]],won:[r.s.won[1],r.s.won[0]]}});
  const a=averagesOf(runs)!,b=averagesOf(runs.map(swap))!;
  expect(b.rows.map(r=>r.text)).toEqual(a.rows.map(r=>[r.text[1],r.text[0]]));
 });
 it('possession adds up to 100 (yours rounded, theirs the rest)',()=>{
  const a=averagesOf([run(st([55,45],[1,1],[2,2],[1,1],[1,1])),run(st([50,50],[1,1],[2,2],[1,1],[1,1]))])!;
  // 52.5 v 47.5 would round to 53 v 48
  expect(a.rows[0].text).toEqual(['53','47']);
 });
 it('the read says the difference of the two numbers on screen, never a third number',()=>{
  // 1.36 v 2.24 shows as 1.4 v 2.2: the read says 0.8 (the unrounded 0.88 would say 0.9)
  expect(shownDiff(1.36,2.24)).toBeCloseTo(-0.8);
  const r=readOf([-0.88,-0.88,-0.88,-0.88],2);
  expect(readWords(asShown(r,shownDiff(1.36,2.24)))).toMatch(/^After 4 runs: they’re making about 0\.8 more good chances a match than you are, /);
  // a difference that shows as level never leans, whatever the band on the runs
  const lean={...readOf([0.3,0.3,0.3,0.3,0.3,0.3,0.3,0.3,0.3,0.3],0.2)};
  expect(lean.band).not.toBe('unsure');
  expect(asShown(lean,shownDiff(1.44,1.36))).toMatchObject({dir:0,band:'unsure'});
  expect(readWords(asShown(lean,shownDiff(1.44,1.36)))).toMatch(/about level, not sure yet\.$/);
  // early stays early
  expect(asShown(readOf([1],2),0.4).band).toBe('early');
 });
 it('counts every run that has its numbers; good chances over the runs that have them; nothing without numbers',()=>{
  // a run recorded before the numbers were kept (no s) counts in good chances only
  const a=averagesOf([run(undefined,[4,0]),run(st([50,50],[1,1],[2,2],[1,1],[1,1]),[2,2]),run(st([50,50],[1,1],[2,2],[3,3],[1,1]),null)])!;
  expect(a.n).toBe(2);expect(a.nChances).toBe(2);
  expect(a.rows.find(r=>r.key==='chances')!.text).toEqual(['3.0','1.0']);
  expect(a.rows.find(r=>r.key==='shots')!.text).toEqual(['2.0','2.0']);
  expect(averagesOf([run(undefined,[1,1])])).toBeNull();
  expect(averagesOf([])).toBeNull();
  // no good chances anywhere: no row rather than a made-up 0.0; a side that never passed: no completion row
  const b=averagesOf([run(st([50,50],[0,3],[0,4],[1,1],[1,1]),null)])!;
  expect(b.rows.map(r=>r.key)).toEqual(['possession','shots','won']);
 });
});

describe('replays kept: only the latest kick-offs, every run still counted',()=>{
 it('keeps the newest KEEP_REPLAYS, oldest dropped first',()=>{
  // 20, a whole batch at its most (owner, 19 Oct: "keep 20, but show the newest 5"); was 5 when a go was 5 runs
  expect(KEEP_REPLAYS).toBe(20);
  let kept:string[]=[];
  for(let i=1;i<=26;i++)kept=retain(kept,`k${i}`);
  expect(kept).toEqual(Array.from({length:20},(_,i)=>`k${i+7}`));
  expect(retain(['a','b'],'c',2)).toEqual(['b','c']);
 });
 it('a chip is watchable only while its replay is kept; older ones are results; the strip shows the latest, the rest are counted as earlier',()=>{
  const runs:RunFacts[]=Array.from({length:11},(_,i)=>({gf:i,ga:1,c:null,id:`k${i+1}`}));
  // a run from before ids were kept has none: never watchable
  runs[0]={gf:0,ga:0,c:null};
  const kept=new Set(['k7','k8','k9','k10','k11','other']);
  const all=runChips(runs,kept);
  expect(all.earlier).toBe(0);
  expect(all.chips.map(c=>c.id)).toEqual([null,null,null,null,null,null,'k7','k8','k9','k10','k11']);
  expect(all.chips.map(c=>c.i)).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
  const few=runChips(runs,kept,4);
  expect(few.earlier).toBe(7);
  expect(few.chips.map(c=>[c.i,c.id])).toEqual([[7,'k8'],[8,'k9'],[9,'k10'],[10,'k11']]);
 });
});

describe('the strip: the newest five out, the earlier ones on request',()=>{
 const chips=(n:number)=>Array.from({length:n},(_,i)=>({i,id:`k${i+1}`}));
 const ids=(r:{shown:{id:string|null}[]})=>r.shown.map(c=>c.id);
 it('few runs: all of them, no control',()=>{
  expect(NEWEST_CHIPS).toBe(5);
  for(const n of [0,1,3,5]){const r=chipsShown(chips(n),false,null);expect(r.shown.length).toBe(n);expect(r.earlier).toBe(0);expect(r.hidden).toBe(0);}
  // one to spare: shown, never hidden behind a control as big as the chip
  const six=chipsShown(chips(6),false,null);expect(six.shown.length).toBe(6);expect(six.earlier).toBe(0);
 });
 it('a batch of 20: the newest 5 shut, all 20 open, in run order',()=>{
  const shut=chipsShown(chips(20),false,'k20');
  expect(ids(shut)).toEqual(['k16','k17','k18','k19','k20']);expect(shut.earlier).toBe(15);expect(shut.hidden).toBe(15);
  const open=chipsShown(chips(20),true,'k20');
  expect(ids(open)).toEqual(chips(20).map(c=>c.id));expect(open.earlier).toBe(15);expect(open.hidden).toBe(0);
 });
 it('an earlier run on screen stays out when the list shuts',()=>{
  const r=chipsShown(chips(20),false,'k3');
  expect(ids(r)).toEqual(['k3','k16','k17','k18','k19','k20']);expect(r.earlier).toBe(15);expect(r.hidden).toBe(14);
  // a run with no replay is never the one on screen
  expect(chipsShown([{i:0,id:null},...chips(7)],false,null).shown.length).toBe(5);
 });
});

describe('setups and the tab\'s store',()=>{
 const side=(id:string,formation:'1-2-1'|'2-2'='1-2-1')=>({club:{id,name:id,code:id,color:'#fff'},formation,style:'balanced',approach:{} as never,captain:'a',lineup:['a'],bench:[],players:[],plans:[]});
 const input=(seed:number,o:Partial<FrozenInput>={}):FrozenInput=>({v:1,match:`practice-${seed.toString(36)}`,seed,kickoff:0,duration:900,sides:[side('us'),side('them')],...o} as FrozenInput);
 it('a setup is its inputs without the seed: a new kick-off is the same setup, a new formation is not',()=>{
  expect(versionKey(input(1),'p')).toBe(versionKey(input(2),'p'));
  expect(versionKey(input(1),'p')).not.toBe(versionKey(input(1,{sides:[side('us','2-2'),side('them')]} as Partial<FrozenInput>),'p'));
  expect(versionKey(input(1),'p')).not.toBe(versionKey(input(1,{duration:300}),'p'));
  // two plans that freeze to the same input are still two setups
  expect(versionKey(input(1),'p')).not.toBe(versionKey(input(1),'q'));
 });
 it('adds runs per setup, keeps first-played order, drops the stalest setup past the cap',()=>{
  const meta=(key:string)=>({key,name:key,formation:'1-2-1',style:'balanced',base:false,duration:900});
  let b:Book=emptyBook();
  b=addToBook(b,meta('a'),{gf:1,ga:0,c:[2,1]});b=addToBook(b,meta('b'),{gf:0,ga:0,c:[1,1]});b=addToBook(b,meta('a'),{gf:2,ga:2,c:null});
  expect(b.setups.map(s=>[s.key,s.runs.length])).toEqual([['a',2],['b',1]]);
  expect(b.setups[0].last).toBeGreaterThan(b.setups[1].last);
  for(let i=0;i<MAX_SETUPS;i++)b=addToBook(b,meta(`x${i}`),{gf:0,ga:0,c:null});
  expect(b.setups.length).toBe(MAX_SETUPS);expect(b.setups.some(s=>s.key==='b')).toBe(false);
 });
 it('keeps the latest 100 runs of a setup (owner, 16 Oct: five goes of 20), dropping the oldest first',()=>{
  expect(MAX_RUNS).toBe(100);
  const meta={key:'a',name:'a',formation:'1-2-1',style:'balanced',base:false,duration:900};
  let b:Book=emptyBook();
  for(let i=1;i<=105;i++)b=addToBook(b,meta,{gf:i,ga:0,c:null,id:`k${i}`});
  expect(b.setups[0].runs.length).toBe(100);
  expect(b.setups[0].runs[0].id).toBe('k6');expect(b.setups[0].runs[99].id).toBe('k105');
 });
 afterEach(()=>{vi.unstubAllGlobals();});
 it('round-trips through sessionStorage, keyed by club, opponent and build',()=>{
  const mem=new Map<string,string>();
  vi.stubGlobal('window',{sessionStorage:{getItem:(k:string)=>mem.get(k)??null,setItem:(k:string,v:string)=>{mem.set(k,v);}}});
  const key=bookKey('club','opp',ENGINE_BUILD);
  expect(key).toBe(`ballers:practice:v1:club:opp:${ENGINE_BUILD.slice(0,8)}`);
  const b=addToBook(emptyBook(),{key:'a',name:'Home plan',formation:'2-2',style:'direct',base:false,duration:900},{gf:3,ga:1,c:[4.1,2.2]});
  expect(saveBook(key,b)).toBe(true);
  expect(loadBook(key)).toEqual(b);
  // a full setup (100 runs, with their numbers) reads back whole; a book stored longer is trimmed to the latest 100
  const s1:RunStats={pos:[60,40],pc:[8,7],pa:[10,10],shots:[5,2],won:[3,1]};
  let full:Book=emptyBook();for(let i=1;i<=100;i++)full=addToBook(full,{key:'f',name:'Full',formation:'2-2',style:'direct',base:false,duration:900},{gf:1,ga:0,c:[1,1],id:`k${i}`,s:s1});
  expect(saveBook(key,full)).toBe(true);expect(loadBook(key)).toEqual(full);
  mem.set(key,JSON.stringify({v:1,setups:[{...full.setups[0],runs:[...full.setups[0].runs,{gf:9,ga:9,c:null,id:'k101'}]}]}));
  expect(loadBook(key).setups[0].runs.map(r=>r.id)).toEqual([...full.setups[0].runs.slice(1).map(r=>r.id),'k101']);
  savePace(140.5);expect(loadPace()).toBe(140.5);
  mem.set(key,'{not json');expect(loadBook(key)).toEqual(emptyBook());
  mem.set(key,JSON.stringify({v:1,setups:[{key:'x'}]}));expect(loadBook(key)).toEqual(emptyBook());
 });
 it('each opponent keeps its own book: switching opponent and back finds each one\'s runs as they were',()=>{
  const mem=new Map<string,string>();
  vi.stubGlobal('window',{sessionStorage:{getItem:(k:string)=>mem.get(k)??null,setItem:(k:string,v:string)=>{mem.set(k,v);}}});
  const meta={key:'s',name:'Home plan',formation:'2-2',style:'direct',base:false,duration:900};
  const one=bookKey('club','opp1',ENGINE_BUILD),two=bookKey('club','opp2',ENGINE_BUILD);
  const s1:RunStats={pos:[60,40],pc:[8,7],pa:[10,10],shots:[5,2],won:[3,1]};
  let a=loadBook(one);a=addToBook(a,meta,{gf:2,ga:0,c:[3,1],id:'k1',s:s1});a=addToBook(a,meta,{gf:1,ga:1,c:[2,2],id:'k2',s:s1});saveBook(one,a);
  let b=loadBook(two);expect(b.setups).toEqual([]);
  b=addToBook(b,meta,{gf:0,ga:3,c:[1,4],id:'k3',s:s1});saveBook(two,b);
  expect(loadBook(one).setups[0].runs.map(r=>r.id)).toEqual(['k1','k2']);
  expect(loadBook(two).setups[0].runs.map(r=>r.id)).toEqual(['k3']);
  expect(loadBook(one).setups[0].runs[0].s).toEqual(s1);
  // a stored run whose numbers are malformed is not trusted: the book reads as empty rather than wrong
  mem.set(one,JSON.stringify({v:1,setups:[{...a.setups[0],runs:[{gf:1,ga:0,c:null,s:{pos:[1]}}]}]}));
  expect(loadBook(one)).toEqual(emptyBook());
 });
 it('a storage that throws (private window, blocked site data) never breaks the page',()=>{
  vi.stubGlobal('window',{get sessionStorage():Storage{throw Error('SecurityError');}});
  expect(loadBook('k')).toEqual(emptyBook());
  expect(saveBook('k',emptyBook())).toBe(false);
  expect(loadPace()).toBeNull();
  expect(()=>savePace(100)).not.toThrow();
  vi.stubGlobal('window',{sessionStorage:{getItem:()=>{throw Error('x');},setItem:()=>{throw Error('QuotaExceeded');}}});
  expect(loadBook('k')).toEqual(emptyBook());expect(saveBook('k',emptyBook())).toBe(false);
 });
 it('names setups by the plan, then what differs, then now / earlier',()=>{
  const s=(key:string,name:string,formation:string,style:string,first:number)=>({key,name,formation,style,base:false,duration:900,first,last:first,runs:[]});
  const xs=[s('a','Home plan','2-2','direct',1),s('b','Away plan','1-2-1','counter',2),s('c','Home plan','2-1-1','direct',3),s('d','Home plan','2-1-1','direct',4)];
  const l=setupLabels(xs,'d',st=>st==='direct'?'Direct':st);
  expect([...l.values()]).toEqual(['Home plan (2-2 · Direct)','Away plan','Home plan (2-1-1 · Direct, earlier)','Home plan (2-1-1 · Direct, now)']);
 });
 it('before a batch: minutes on this device, or a multiple of one run when unmeasured',()=>{
  expect(batchWords(3,1,900,null)).toBe('3 runs play one after another: about 3 times as long as one.');
  // 3 x 900 s x 40 ms = 108 s
  expect(batchWords(3,1,900,40)).toBe('3 runs play one after another: about 2 minutes on this device.');
  expect(batchWords(2,1,300,20)).toBe('2 runs play one after another: under a minute on this device.');
  expect(batchWords(5,2,900,30)).toBe('5 runs play one after another: about 5 minutes on this device.');
  // up to 20 a go (owner, 16 Oct): 20 x 900 s x 20 ms = 6 min; 20 x 2 x 900 s x 50 ms = 30 min
  expect(batchWords(20,1,900,20)).toBe('20 runs play one after another: about 6 minutes on this device.');
  expect(batchWords(20,2,900,50)).toBe('20 runs play one after another: about 30 minutes on this device.');
  // an hour and past it reads in hours, to the nearest 5 minutes: 20 x 2 x 900 s x 100 ms = 60 min; x 125 ms = 75 min; x 200 ms = 120 min
  expect(batchWords(20,2,900,100)).toBe('20 runs play one after another: about 1 hour on this device.');
  expect(batchWords(20,2,900,125)).toBe('20 runs play one after another: about 1 hour 15 minutes on this device.');
  expect(batchWords(20,2,900,200)).toBe('20 runs play one after another: about 2 hours on this device.');
  expect(batchWords(20,1,900,3.4)).toBe('20 runs play one after another: about 1 minute on this device.');
 });
});

describe('the match report: good chances beside the score',()=>{
 interface Raw {header:ReplayHeader;frames:ReportInput['frames'];events:ReplayEvent[];markers:never[]}
 const raw=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/gp-wp6-matches.json.gz',import.meta.url))).toString()) as Record<string,Raw>;
 const m=Object.values(raw)[0];
 const input=(events:ReplayEvent[],build:string|null):ReportInput=>({header:m.header,frames:m.frames,events,side:0,markers:[],names:[],snapshot:null,build});
 it('a stored replay without shot reads builds a report with no chances',()=>{
  expect(m.events.some(e=>e.k==='shot')).toBe(true);
  expect(m.events.some(e=>e.q!==undefined)).toBe(false);
  expect(buildReport(input(m.events,ENGINE_BUILD)).chances).toBeNull();
 });
 it('with every shot read: yours first; on another build: none',()=>{
  const read=m.events.map(e=>e.k==='shot'?{...e,q:.5}:e);
  const mine=buildReport(input(read,ENGINE_BUILD)).chances!;
  const both=matchChances(read,m.header,ENGINE_BUILD)!;
  expect(mine).toEqual([both[0],both[1]]);
  expect(buildReport({...input(read,ENGINE_BUILD),side:1}).chances).toEqual([both[1],both[0]]);
  expect(buildReport(input(read,'0'.repeat(64))).chances).toBeNull();
  expect(buildReport(input(read,null)).chances).toBeNull();
 });
});
