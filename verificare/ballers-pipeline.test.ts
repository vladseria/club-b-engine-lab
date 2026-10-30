// Ballers P2: official computation, compact replay v2 and the season schedule.
import {describe,it,expect} from 'vitest';
import {gunzipSync} from 'node:zlib';
import {compact,computeMatch,submission,validateInput,type FrozenInput,type FrozenSide} from '../lib/ballers/simulation';
import {LAST_ATTACK_MAX} from '../packages/football-engine/src/index';
import {sample,frameAt,timeline,highlightWindows,scorer,type ReplayChunk,type ReplayHeader} from '../lib/ballers/replay';
import {seasonSchedule,seasonRounds,preseasonRebuild,byeOrder} from '../lib/ballers/schedule';
import {defaultPlans} from '../packages/football-engine/src/practice-playbook';

const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:4+n%5,defending:5,pace:4+n%4,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:gk?8:1});
function side(tag:string,formation:FrozenSide['formation'],style:string,withPlans=false):FrozenSide{
 const players=Array.from({length:9},(_,n)=>({id:`${tag}000000-0000-4000-8000-00000000000${n}`,name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,roles:(n===0||n===8?['GK']:['CM','ST']) as FrozenSide['players'][0]['roles'],
  skills:skills(n===0||n===8,n),traits:{risk:.5,dribble:.4+n/40,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation,style,
  approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},
  captain:lineup[2],lineup,bench:players.slice(5).map(p=>p.id),players,
  plans:withPlans?defaultPlans().slice(0,2).map((plan,i)=>({idea:`idea-${i}`,key:plan.id,name:`Secret idea ${i}`,plan:plan as unknown as Record<string,unknown>,lineup,accent:80})):[]};
}
const input=(duration=120,seed=4242):FrozenInput=>({v:1,match:'m',seed,kickoff:(seed%2) as 0|1,duration,sides:[side('aa','1-2-1','balanced',true),side('bb','2-1-1','counter')]});

describe('official computation → compact replay v2',()=>{
 // (Lane C, 2026-10-21) Any seed serves here. From 13 Oct to 21 Oct the seed had to end its 120 s in an attack at full
 // time for the chunk test (4242 -> 4244 -> 4252 -> 4253 -> 4256 -> 4257, five re-pins); that case is now checked on a
 // result stub below, and the last attack itself is the engine's own test (packages/football-engine/test/last-attack.test.mjs).
 // Plan switch, build 58a06b82: a match without a switch is byte-identical to 6c8b7c82 (512/512 on the public lab), so 4257
 // holds unchanged, not re-pinned. Half-time, build 377e7a94: a 120 s match has no half-time (600 s or more), its engine
 // result is byte-identical (block Q / F on the lab), so 4257 holds again. The release build c622728d adds only the plan switch's 'always'
 // condition (no switch here), so 4257 holds. Styles as identities 47b95519: side aa is named Balanced, whose trait is
 // zero, and bb's pair is no style's base (no trait); only a Short side changes (lab: every task without one identical), so 4257 holds.
 // Showcase injuries f3d6df87: an opt-in input key this match does not carry (lab: 256/256 tasks identical), so 4257 holds.
 const SEED=4257,inp=input(120,SEED);const c=computeMatch(validateInput(inp));const sub=submission(c,inp);
 const unpack=(b64:string)=>JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString());
 it('is deterministic for the same frozen input',()=>{
  const again=computeMatch(input(120,SEED));
  expect(again.compact.score).toEqual(c.compact.score);
  expect(JSON.stringify(again.compact.chunks)).toBe(JSON.stringify(c.compact.chunks));
 },60000); // a second full engine run; can exceed vitest's 5 s default on a busy machine
 it('chunks cover the match in 60 s pieces with integer cm/ms units',()=>{
  // (12 Oct, last attack) a 120 s match in an attack at full time plays it out: the chunk count stays the match
  // length's, the last chunk runs to the whistle, the submission keeps duration 120. Read from this match whichever way
  // it ended; the played-out case is the stub test below.
  // (half-time build) the header, readable from kickoff, holds the match length only; when the whistle went comes in
  // the last chunk's `end`, and timeline() reads it back into the header as before
  const h=timeline(c.compact.header,c.compact.chunks).header,end=h.duration*1000,over=h.duration>120;
  expect(c.compact.header.duration).toBe(120);expect(c.compact.header.fullTime).toBeUndefined();
  expect(h.duration).toBeGreaterThanOrEqual(120);expect(h.duration).toBeLessThanOrEqual(120+LAST_ATTACK_MAX);
  expect(h.fullTime).toBe(over?120:undefined);expect(c.compact.header.chunks).toBe(2);
  expect(sub.duration).toBe(120);expect(sub.played).toBe(over?h.duration:undefined);
  expect(c.compact.chunks.map(ch=>[ch.t0,ch.t1])).toEqual([[0,60000],[60000,end]]);
  // time on the pitch counts to the match length, so growth still reads a full match as one (fullMatch per second)
  expect(Math.max(...sub.players!.map(l=>Math.max(l.m??0,l.gt??0)))).toBe(120);
  const all=c.compact.chunks.flatMap(ch=>ch.f);
  expect(all.every(f=>Number.isInteger(f.t)&&f.p.length===10&&f.p.flat().every(Number.isInteger)&&f.b.every(Number.isInteger))).toBe(true);
  const bad=all.filter((f,i)=>i>0&&!(f.t>all[i-1].t||(f.t===all[i-1].t&&f.c===1))).map(f=>[f.t,f.c,f.r]);
  expect(bad).toEqual([]);
  expect(all.at(-1)!.t).toBe(end);
  expect(all.at(-1)!.s).toEqual(c.compact.score);
 });
 it('a match played on past full time keeps two chunks, the last one to the whistle, and duration 120 for the database',()=>{
  // If this fails: a match whose last attack runs past full time is cut at 120 s, or stored as three chunks that
  // ballers_submit refuses. Enough: the chunking reads only the result's duration and played time, so a stub result
  // that ends at 121.03 s (what seed 4257 did) is the case itself. (Lane C, 2026-10-21: replaces the seed search.)
  const ids=inp.sides.flatMap((s,side)=>s.lineup.map(id=>({id:`${side}:${id}`,side:side as 0|1,role:'CM'})));
  const pose={x:24,y:0,angle:0},played=121.03;
  const stub=(p?:number)=>compact(inp,{duration:120,...(p===undefined?{}:{played:p}),players:ids,score:[0,0],stats:c.compact.stats,
   frames:Array.from({length:Math.ceil((p??120)/.2)+1},(_,n)=>({time:Math.min(n*.2,p??120),players:ids.map(()=>pose),ball:{x:24,y:0,z:0,owner:null},score:[0,0] as [number,number],restart:false,side:0 as const})),
   events:[{time:0,kind:'start',text:''},{time:p??120,kind:'end',text:''}]});
  const long=stub(played),plain=stub();
  expect(long.header).toMatchObject({duration:120,chunks:2});expect(long.header.fullTime).toBeUndefined();expect(plain.header.fullTime).toBeUndefined();
  expect(long.chunks[1].end).toEqual({played,fullTime:120});expect(plain.chunks[1].end).toBeUndefined();
  expect(timeline(long.header,long.chunks).header).toMatchObject({duration:played,fullTime:120,length:120});
  expect(long.chunks.map(ch=>[ch.t0,ch.t1])).toEqual([[0,60000],[60000,121030]]);expect(plain.chunks.map(ch=>[ch.t0,ch.t1])).toEqual([[0,60000],[60000,120000]]);
  expect(long.chunks[1].f.at(-1)!.t).toBe(121030);expect(long.chunks[1].e.at(-1)!.t).toBe(121030);
  const s=submission({compact:long,dropped:[],engineBuild:c.engineBuild},inp);
  expect(s.duration).toBe(120);expect(s.played).toBe(played);expect(s.chunks.map(ch=>[ch.t0,ch.t1])).toEqual([[0,60],[60,played]]);
  expect(submission({compact:plain,dropped:[],engineBuild:c.engineBuild},inp).played).toBeUndefined();
 });
 // Duel recovery (16 Oct): a frame lists the positions lying on the floor (`d`) only when someone is; a frame without it
 // (every replay stored before) samples as nobody down, so the pitch draws exactly as before.
 it('marks knocked-down players per frame, only when someone is down, and samples older frames as nobody down',()=>{
  const all=c.compact.chunks.flatMap(ch=>ch.f);
  expect(all.every(f=>f.d===undefined||(f.d.length>0&&f.d.every(k=>Number.isInteger(k)&&k>=0&&k<10)))).toBe(true);
  const f0={t:0,p:Array.from({length:10},()=>[0,0,0] as [number,number,number]),b:[0,0,0] as [number,number,number],o:-1,ps:0 as const,s:[0,0] as [number,number]};
  expect(sample([f0,{...f0,t:200}],100).down).toBeNull();
  expect(sample([{...f0,d:[6]},{...f0,t:200}],100).down).toEqual([6]);
 });
 it('keeps every engine event and real possession (owner index + side)',()=>{
  const events=c.compact.chunks.flatMap(ch=>ch.e);
  expect(events.length).toBeGreaterThan(50);
  expect(new Set(events.map(e=>e.k))).toContain('pass');
  const all=c.compact.chunks.flatMap(ch=>ch.f);
  const owned=all.filter(f=>f.o>=0);
  expect(owned.length/all.length).toBeGreaterThan(.3);
  expect(all.every(f=>f.o>=-1&&f.o<10&&(f.ps===0||f.ps===1))).toBe(true);
  // A carrier belongs to the possessing side nearly always.
  expect(owned.filter(f=>Math.floor(f.o/5)===f.ps).length/owned.length).toBeGreaterThan(.9);
 });
 it('tags ideas with their side; names go only to the owner-only list',()=>{
  expect(c.compact.ideas.length).toBeGreaterThan(0);
  expect(c.compact.ideas.every(i=>i.side===0)).toBe(true);
  const named=sub.ideas.filter(i=>i.name);
  expect(named.every(i=>['two-lanes','link-and-go'].includes(i.plan_key!))).toBe(true);
  // No chunk or header carries an idea name.
  for(const ch of sub.chunks)expect(JSON.stringify(unpack(ch.data))).not.toMatch(/Secret idea|Două culoare|Sprijin și plecare/);
  expect(JSON.stringify(unpack(sub.header))).not.toMatch(/Secret idea/);
 });
 it('packs gzip+base64 that round-trips, and reads back through the viewer helpers',()=>{
  const header=unpack(sub.header) as ReplayHeader;
  expect(header.v).toBe(2);
  // P5: starters 0-9, then both benches (home first) so a substitute has an index.
  expect(header.players.map(p=>p.i)).toEqual(Array.from({length:18},(_,i)=>i));
  expect(header.players.slice(10).every(p=>p.bench&&p.slot===-1)).toBe(true);
  expect(header.players.slice(10,14).every(p=>p.side===0)&&header.players.slice(14).every(p=>p.side===1)).toBe(true);
  expect(header.players[2].captain).toBe(true);expect(header.engineBuild).toBe(c.engineBuild);
  const chunks=sub.chunks.map(ch=>unpack(ch.data) as ReplayChunk);
  const tl=timeline(header,chunks);
  expect(frameAt(tl.frames,-1)).toBe(-1);
  const mid=sample(tl.frames,30000);expect(mid.players).toHaveLength(10);expect(Math.abs(mid.ball.x)).toBeLessThan(60);
  for(const g of tl.events.filter(e=>e.k==='goal'))expect(scorer(g,header.players)).not.toBeNull();
  const reel=highlightWindows(tl.events,header.duration);
  expect(reel.every((w,i)=>w.from<w.to&&(i===0||w.from>reel[i-1].to))).toBe(true);
 });
});

describe('season schedule (double round robin)',()=>{
 it('every club meets every other club home and away; one bye per round when odd',()=>{
  for(const n of [2,3,4,5,6,7,8]){
   const ids=Array.from({length:n},(_,i)=>`c${i}`),s=seasonSchedule(ids),rounds=seasonRounds(n);
   expect(Math.max(...s.map(p=>p.round))).toBe(rounds);
   const pairs=new Set(s.map(p=>`${p.home}>${p.away}`));
   expect(pairs.size).toBe(n*(n-1));
   for(let r=1;r<=rounds;r++){const inRound=s.filter(p=>p.round===r).flatMap(p=>[p.home,p.away]);expect(new Set(inRound).size).toBe(inRound.length);expect(inRound.length).toBe(n-(n%2));}
  }
 });
 it('TS and SQL agree (values recorded from private.ballers_season_pairs, 5 clubs)',()=>{
  const u=(n:number)=>`00000000-0000-0000-0000-00000000000${n}`;
  const sql=[[1,2,5],[1,3,4],[2,3,2],[2,5,1],[3,1,4],[3,5,3],[4,2,4],[4,3,1],[5,1,2],[5,4,5],[6,4,3],[6,5,2],[7,1,5],[7,2,3],[8,3,5],[8,4,1],[9,1,3],[9,4,2],[10,2,1],[10,5,4]];
  const ts=seasonSchedule([3,1,5,2,4].map(u)).map(p=>[p.round,Number(p.home.slice(-1)),Number(p.away.slice(-1))]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  expect(ts).toEqual(sql);
 });
 it('round 1 is the P1 circle-method round 1 (existing rounds stay valid)',()=>{
  const u=(n:number)=>`00000000-0000-0000-0000-00000000000${n}`;
  expect(seasonSchedule([3,1,5,2,4].map(u)).filter(p=>p.round===4).map(p=>[p.home,p.away])).toEqual([[u(3),u(1)],[u(2),u(4)]]);
 });
});

describe('preseason rebuild (a club joins: the unplayed rounds are rebuilt; strict AI-only byes)',()=>{
 const u=(n:number)=>`00000000-0000-0000-0000-0000000000${String(n).padStart(2,'0')}`;
 type Fx={slot:number;home:string;away:string};
 const digits=(s:Fx[])=>s.map(p=>[p.slot,Number(p.home.slice(-2)),Number(p.away.slice(-2))]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const sitting=(s:Fx[],order:string[],slot:number)=>{const seated=new Set(s.filter(p=>p.slot===slot).flatMap(p=>[p.home,p.away]));return order.filter(id=>!seated.has(id));};
 const firstRepeat=(s:Fx[],id:string)=>{const seen=new Set<string>();for(const m of [...s].sort((a,b)=>a.slot-b.slot).filter(p=>p.home===id||p.away===id)){const o=m.home===id?m.away:m.home;if(seen.has(o))break;seen.add(o);}return seen.size;};
 it('TS and SQL agree (values recorded from private.ballers_preseason_pairs after 20260925103504: 6 AI + 3 humans x 20, 2 AI + 6 humans x 15, 2 AI + 9 humans x 14)',()=>{
  expect(digits(preseasonRebuild([7,3,9,1,5,2,8,4,6].map(u),[true,true,true,true,true,true,false,false,false],20))).toEqual([[0,1,8],[0,2,5],[0,3,6],[0,4,9],[1,5,4],[1,6,1],[1,8,2],[1,9,7],[2,1,3],[2,2,6],[2,4,8],[2,7,5],[3,3,2],[3,5,9],[3,6,4],[3,8,7],[4,2,1],[4,4,3],[4,7,6],[4,9,8],[5,1,4],[5,3,7],[5,6,9],[5,8,5],[6,3,8],[6,5,6],[6,7,4],[6,9,1],[7,2,4],[7,6,8],[7,7,1],[7,9,3],[8,5,3],[8,7,4],[8,8,6],[8,9,2],[9,5,2],[9,6,3],[9,8,1],[9,9,4],[10,1,6],[10,2,8],[10,4,5],[10,7,9],[11,3,1],[11,5,7],[11,6,2],[11,8,4],[12,2,3],[12,4,6],[12,7,8],[12,9,5],[13,1,2],[13,3,4],[13,6,7],[13,8,9],[14,4,1],[14,5,8],[14,7,3],[14,9,6],[15,1,7],[15,2,4],[15,3,8],[15,6,5],[16,1,5],[16,4,2],[16,7,9],[16,8,6],[17,1,5],[17,2,9],[17,3,8],[17,4,6],[18,1,8],[18,2,5],[18,3,6],[18,4,9],[19,5,4],[19,6,1],[19,8,2],[19,9,7]]);
  expect(digits(preseasonRebuild([4,8,2,6,1,7,3,5].map(u),[true,true,false,false,false,false,false,false],15))).toEqual([[0,4,5],[0,6,1],[0,7,2],[0,8,3],[1,1,7],[1,2,4],[1,3,6],[1,5,8],[2,2,5],[2,4,1],[2,6,8],[2,7,3],[3,1,2],[3,3,4],[3,5,6],[3,8,7],[4,1,5],[4,2,3],[4,4,8],[4,7,6],[5,3,1],[5,5,7],[5,6,4],[5,8,2],[6,1,8],[6,2,6],[6,3,5],[6,4,7],[7,1,6],[7,2,7],[7,3,8],[7,5,4],[8,4,2],[8,6,3],[8,7,1],[8,8,5],[9,1,4],[9,3,7],[9,5,2],[9,8,6],[10,2,1],[10,4,3],[10,6,5],[10,7,8],[11,3,2],[11,5,1],[11,6,7],[11,8,4],[12,1,3],[12,2,8],[12,4,6],[12,7,5],[13,5,3],[13,6,2],[13,7,4],[13,8,1],[14,4,5],[14,6,1],[14,7,2],[14,8,3]]);
  expect(digits(preseasonRebuild([11,10,9,8,7,6,5,4,3,2,1].map(u),[true,true,false,false,false,false,false,false,false,false,false],14))).toEqual([[0,2,9],[0,4,7],[0,6,5],[0,8,3],[0,10,1],[1,1,8],[1,3,6],[1,5,4],[1,7,2],[1,9,11],[2,2,5],[2,4,3],[2,6,1],[2,9,8],[2,11,7],[3,1,4],[3,3,2],[3,7,9],[3,8,5],[3,10,6],[4,2,1],[4,6,8],[4,7,3],[4,9,5],[4,11,4],[5,3,1],[5,5,7],[5,8,4],[5,9,6],[5,10,2],[6,1,7],[6,2,8],[6,3,9],[6,4,6],[6,11,5],[7,1,9],[7,3,5],[7,6,2],[7,8,7],[7,10,4],[8,2,4],[8,5,1],[8,7,6],[8,9,8],[8,11,3],[9,1,3],[9,4,9],[9,6,2],[9,8,7],[9,10,5],[10,5,8],[10,6,1],[10,7,3],[10,9,4],[10,11,2],[11,1,10],[11,3,8],[11,5,6],[11,7,4],[11,9,2],[12,2,7],[12,4,5],[12,6,3],[12,8,1],[12,11,9],[13,3,4],[13,5,2],[13,7,1],[13,9,6],[13,10,8]]);
 });
 it('TS and SQL agree on the bye order (recorded from private.ballers_bye_order)',()=>{
  const clubs=[{id:u(5),ai:false,byes:0,created:1},{id:u(3),ai:true,byes:1,created:1},{id:u(2),ai:true,byes:0,created:9},
   {id:u(4),ai:true,byes:0,created:2},{id:u(1),ai:false,byes:0,created:1},{id:u(6),ai:true,byes:0,created:2}];
  expect(byeOrder(clubs)).toEqual([4,6,2,3,1,5].map(u));
 });
 it('all-AI, all-human or even rosters keep the plain double round robin (every pair once per leg, home and away)',()=>{
  for(const n of [2,3,4,5,6,7,8,9,10,11,12])for(const kind of ['ai','human','mixed-even']){
   if(kind==='mixed-even'&&n%2)continue;
   const ids=Array.from({length:n},(_,i)=>`c${i}`),ai=ids.map((_,i)=>kind==='ai'||(kind==='mixed-even'&&i<n/2)),leg=n%2?n:n-1,s=preseasonRebuild(ids,ai,2*leg);
   for(let slot=0;slot<2*leg;slot++){const inRound=s.filter(p=>p.slot===slot).flatMap(p=>[p.home,p.away]);expect(new Set(inRound).size).toBe(inRound.length);expect(inRound.length).toBe(n-(n%2));}
   expect(new Set(s.filter(p=>p.slot<leg).map(p=>[p.home,p.away].sort().join())).size).toBe(n*(n-1)/2);
   expect(new Set(s.map(p=>`${p.home}>${p.away}`)).size).toBe(n*(n-1));
  }
 });
 it('home and away balance within a leg of the plain schedule (at most one apart, never three in a row)',()=>{
  for(const n of [4,5,6,7,8,9,10,11,12]){
   const ids=Array.from({length:n},(_,i)=>`c${i}`),leg=n%2?n:n-1,s=preseasonRebuild(ids,ids.map(()=>true),leg);
   for(const id of ids){
    const seq=Array.from({length:leg},(_,slot)=>s.find(p=>p.slot===slot&&(p.home===id||p.away===id))).filter(Boolean).map(p=>p!.home===id?'H':'A').join('');
    const h=seq.split('H').length-1;expect(Math.abs(2*h-seq.length)).toBeLessThanOrEqual(1);expect(seq).not.toMatch(/HHH|AAA/);
   }
  }
 });
 const six3=()=>{const clubs=[...Array.from({length:6},(_,i)=>({id:`ai${i}`,ai:true,byes:0,created:i})),...Array.from({length:3},(_,i)=>({id:`hu${i}`,ai:false,byes:0,created:100+i}))];
  const order=byeOrder(clubs);return {order,s:preseasonRebuild(order,order.map(id=>id.startsWith('ai')),10)};};
 it('6 AI + 3 humans: no human bye in any round 1-10; 4 matches a round; AI byes spread evenly',()=>{
  const {order,s}=six3();const count:Record<string,number>={};
  for(let slot=0;slot<10;slot++){
   expect(s.filter(p=>p.slot===slot)).toHaveLength(4);
   const out=sitting(s,order,slot);expect(out).toHaveLength(1);expect(out[0].startsWith('ai')).toBe(true);count[out[0]]=(count[out[0]]||0)+1;
  }
  const b=Object.values(count);expect(Object.keys(count)).toHaveLength(6);expect(Math.max(...b)-Math.min(...b)).toBeLessThanOrEqual(1);
 });
 it('humans still meet as many different opponents as possible before repeating (6 AI + 3 humans: all 8 others first)',()=>{
  const {s}=six3();
  for(const h of ['hu0','hu1','hu2'])expect(firstRepeat(s,h)).toBe(8);
 });
 it('strict rule across rosters: no human ever sits out while an AI club exists; nobody plays twice a round',()=>{
  for(let n=3;n<=15;n+=2)for(let a=1;a<n;a++){
   const ids=Array.from({length:n},(_,i)=>`c${String(i).padStart(2,'0')}`),ai=ids.map((_,i)=>i<a),c=n,s=preseasonRebuild(ids,ai,2*c);
   for(let slot=0;slot<2*c;slot++){
    const seat=s.filter(p=>p.slot===slot).flatMap(p=>[p.home,p.away]);expect(new Set(seat).size).toBe(n-1);expect(seat.length).toBe(n-1);
    const out=ids.filter(id=>!seat.includes(id));expect(ai[ids.indexOf(out[0])]).toBe(true);
   }
   // Humans meet at least n-4 different clubs before any rematch (6 AI + 3 humans: all n-1, above).
   for(const h of ids.filter((_,i)=>!ai[i]))expect(firstRepeat(s,h)).toBeGreaterThanOrEqual(n-4);
  }
 });
 it('with no AI club left, humans take the bye in turn (the plain round robin)',()=>{
  const ids=['h0','h1','h2','h3','h4'],s=preseasonRebuild(ids,ids.map(()=>false),5);
  expect(Array.from({length:5},(_,slot)=>sitting(s,ids,slot)[0])).toEqual(ids);
 });
 it('is deterministic (same roster, same rounds: same fixtures)',()=>{
  const order=[5,1,4,2,3].map(u),ai=[true,false,true,false,false];expect(preseasonRebuild(order,ai,7)).toEqual(preseasonRebuild([...order],[...ai],7));
  expect(preseasonRebuild([u(1)],[false],5)).toEqual([]);expect(preseasonRebuild(order,ai,0)).toEqual([]);
 });
});

describe('compute route (sync mode, Supabase mocked)',()=>{
 it('checks the dispatch HMAC, claims with its own HMAC, submits with the lease',async()=>{
  const {createHmac}=await import('node:crypto');
  const secret='s'.repeat(40),match='11111111-2222-4333-8444-555555555555';
  process.env.BALLERS_COMPUTE_SECRET=secret;process.env.NEXT_PUBLIC_SUPABASE_URL='https://db.example';process.env.NEXT_PUBLIC_SUPABASE_KEY='pk';
  const calls:{name:string;body:Record<string,unknown>}[]=[];
  const real=globalThis.fetch;
  globalThis.fetch=(async(url:string,init:{body:string})=>{
   const name=url.split('/').pop()!,body=JSON.parse(init.body);calls.push({name,body});
   if(name==='ballers_claim')return new Response(JSON.stringify({ok:true,lease:'lease-1',attempt:1,input:{...input(60,99),match}}));
   return new Response(JSON.stringify({ok:true,live_from:'x'}));
  }) as typeof fetch;
  try{
   const {POST}=await import('../app/api/ballers/compute/route');
   const ts=Math.floor(Date.now()/1000),sig=(p:string)=>createHmac('sha256',secret).update(`${p}:${match}:${ts}`).digest('hex');
   const bad=await POST(new Request('http://x',{method:'POST',body:JSON.stringify({match,ts,sig:sig('claim'),mode:'sync'})}));
   expect(bad.status).toBe(403);expect(calls).toHaveLength(0);
   const ok=await POST(new Request('http://x',{method:'POST',body:JSON.stringify({match,ts,sig:sig('dispatch'),mode:'sync'})}));
   const out=await ok.json();
   expect(out.outcome).toBe('submitted');expect(out.cpu_ms).toBeGreaterThan(0);expect(out.rss_mb).toBeGreaterThan(0);
   expect(calls.map(c=>c.name)).toEqual(['ballers_claim','ballers_submit']);
   expect(calls[0].body.p_sig).toBe(sig('claim'));
   expect(calls[1].body.p_lease).toBe('lease-1');
   const payload=calls[1].body.p_payload as {chunks:unknown[];cost:{wall_ms:number}};
   expect(payload.chunks).toHaveLength(1);expect(payload.cost.wall_ms).toBeGreaterThanOrEqual(0);
   expect(JSON.stringify(calls)).not.toContain(secret);
  }finally{globalThis.fetch=real;}
 });
});
