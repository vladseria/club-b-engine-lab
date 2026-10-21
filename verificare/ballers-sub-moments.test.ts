// A substitution on the pitch (lib/ballers/sub-moments.ts): honest to the
// match clock. Nothing before the change's instant, the substitute back on his
// real spot before the kick at any speed, the same picture for the same time
// (seeking), and a change made under a goal's takeover waits it out.
import {describe,it,expect} from 'vitest';
import {computeMatch,validateInput,type FrozenInput,type FrozenSide} from '../lib/ballers/simulation';
import {sample,timeline,type ReplayFrame,type ReplayHeader} from '../lib/ballers/replay';
import {pitchSub,subMoments,subTiming,SUB_TAKEOVER_MS} from '../lib/ballers/sub-moments';
import type {PrepOrder} from '../lib/ballers/subs';

const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:4+n%5,defending:5,pace:4+n%4,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:gk?8:1});
const pid=(tag:string,n:number)=>`${tag}000000-0000-4000-8000-00000000000${n}`;
function side(tag:string,subs:PrepOrder[]):FrozenSide{
 const players=Array.from({length:9},(_,n)=>({id:pid(tag,n),name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,roles:(n===0||n===8?['GK']:['CM','ST']) as FrozenSide['players'][0]['roles'],
  skills:skills(n===0||n===8,n),traits:{risk:.5,dribble:.4+n/40,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation:'1-2-1',style:'balanced',
  approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},
  captain:lineup[2],lineup,bench:players.slice(5).map(p=>p.id),players,plans:[],substitutions:subs};
}
const COLORS=['#0EA47F','#FF3D7F'];

describe('a substitution on the pitch, from an engine match',()=>{
 const input:FrozenInput={v:1,match:'subs',seed:777,kickoff:1,duration:300,sides:[
  side('aa',[{id:'half',in:pid('aa',5),out:pid('aa',4),trigger:{kind:'half'}},{id:'tired',in:pid('aa',6),trigger:{kind:'tired',player:pid('aa',3),threshold:99.5}}]),
  side('bb',[{id:'tired-b',in:pid('bb',6),trigger:{kind:'tired',player:pid('bb',2),threshold:99}}])]};
 const c=computeMatch(validateInput(input)),tl=timeline(c.compact.header,c.compact.chunks),h=tl.header;
 const moments=subMoments(tl.frames,tl.events);
 it('every change is found, at a stoppage, with the position he takes',()=>{
  expect(moments.length).toBe(tl.events.filter(e=>e.k==='substitution').length);
  // (Lane C, 2026-10-21) every order the engine made is found, however many this seed makes (it was ">= 3", seed 777's
  // count); at least one, because the half-time order needs only one stoppage in the last 150 s
  const made=(c.compact.substitutionNotes??[]).flatMap(s=>s.notes as {status?:string}[]).filter(n=>n.status==='made').length;
  expect(moments.length).toBe(made);expect(made).toBeGreaterThan(0);
  for(const m of moments){expect(m.dead).toBeGreaterThan(1500);expect(sample(tl.frames,m.t).lineup?.[m.pos]).toBe(m.on);}
 },60000);
 it('nothing shows before the change happens',()=>{
  for(const m of moments)for(const rate of [1,2,4,8])expect(pitchSub(moments.filter(x=>x.t<m.t),tl.frames,h,COLORS,m.t-1,rate)?.board??null).toBeNull();
  const first=moments[0];
  for(const rate of [1,4])expect(pitchSub(moments,tl.frames,h,COLORS,first.t-1,rate)).toBeNull();
 });
 it('at the change: the one going off stands where he was, the substitute starts at the bench touchline, the board names both',()=>{
  const m=moments[0],p=pitchSub(moments,tl.frames,h,COLORS,m.t,1)!;
  const at=sample(tl.frames,m.t).players[m.pos];
  const ghost=p.ghosts.find(g=>g.player===m.off)!;
  expect(ghost.x).toBeCloseTo(at.x,5);expect(ghost.y).toBeCloseTo(at.y,5);expect(ghost.alpha).toBe(1);
  expect(p.arrive.find(a=>a.pos===m.pos)).toMatchObject({k:0,y:16.1});
  const row=p.board!.rows.find(r=>r.on.no===h.players[m.on].number)!;
  expect(row.off.no).toBe(h.players[m.off].number);expect(p.board!.at).toBe(m.t);
 });
 it('the substitute is on his real spot before the kick, at every speed',()=>{
  for(const m of moments)for(const rate of [.5,1,2,4,8]){
   const tm=subTiming(m,rate),kick=m.t+(m.dead??0);
   expect(tm.start+tm.walk).toBeLessThan(kick);
   const p=pitchSub(moments,tl.frames,h,COLORS,kick-1,rate);
   expect(p?.arrive.some(a=>a.pos===m.pos)??false).toBe(false);
  }
 });
 it('the same time gives the same picture (seeking, scrubbing)',()=>{
  const m=moments[0];
  for(const dt of [0,400,1300,2600])expect(pitchSub(moments,tl.frames,h,COLORS,m.t+dt,4)).toEqual(pitchSub(moments,tl.frames,h,COLORS,m.t+dt,4));
 });
 it('it ends: no picture long after the last change',()=>{
  const last=moments.at(-1)!;
  expect(pitchSub(moments,tl.frames,h,COLORS,last.t+20000,8)).toBeNull();
 });
});

describe('a change at the kick-off after a goal waits out the takeover',()=>{
 // One cut frame at 10 s (the goal and the change), dead until 16 s.
 const fr=(t:number,r:boolean,l?:number[]):ReplayFrame=>({t,p:Array.from({length:10},(_,i)=>[i*400,-500,0] as [number,number,number]),b:[2400,0,0],o:-1,ps:0,s:[1,0],...(r?{r:1 as const}:{}),...(l?{l}:{})});
 const frames=[fr(9800,false),fr(10000,true,[0,1,2,3,10,5,6,7,8,9]),fr(13000,true,[0,1,2,3,10,5,6,7,8,9]),fr(16000,false,[0,1,2,3,10,5,6,7,8,9])];
 frames[1].c=1;
 const events=[{t:10000,k:'goal',x:'',s:1 as const},{t:10000,k:'substitution',x:'',a:10,g:4,s:0 as const}];
 const header={teams:[{code:'AAA'},{code:'BBB'}],players:Array.from({length:11},(_,i)=>({i,number:i+1,short:`p${i}`}))} as unknown as ReplayHeader;
 const ms=subMoments(frames,events);
 it('is found as a goal stoppage',()=>{expect(ms).toHaveLength(1);expect(ms[0]).toMatchObject({goal:true,dead:6000,pos:4,on:10,off:4});});
 it('under the takeover the one going off still stands there; then the swap and the board',()=>{
  const under=pitchSub(ms,frames,header,COLORS,10000+SUB_TAKEOVER_MS-1,1)!;
  expect(under.hold).toEqual([{pos:4,player:4}]);expect(under.board).toBeNull();expect(under.ghosts).toHaveLength(0);
  const after=pitchSub(ms,frames,header,COLORS,10000+SUB_TAKEOVER_MS+10,1)!;
  expect(after.hold).toHaveLength(0);expect(after.ghosts).toHaveLength(1);expect(after.board?.rows[0]).toMatchObject({code:'AAA',off:{no:5},on:{no:11}});
 });
 it('at 8x the walk still ends before the kick (the takeover is longer than the dead ball)',()=>{
  const tm=subTiming(ms[0],8);expect(tm.start+tm.walk).toBeLessThan(16000);
 });
});

describe('leaving by the bench touchline, the ghost and the substitute keep apart',()=>{
 // A change at a throw-in at 10 s with the one going off (position 4) on the bench half, dead until 14 s.
 const fr=(t:number,r:boolean,l?:number[]):ReplayFrame=>({t,p:Array.from({length:10},(_,i)=>[1000+i*300,600,0] as [number,number,number]),b:[2400,1500,0],o:-1,ps:0,s:[0,0],...(r?{r:1 as const}:{}),...(l?{l}:{})});
 const l=[0,1,2,3,10,5,6,7,8,9],frames=[fr(9800,false),fr(10000,true,l),fr(14000,false,l)];
 const header={teams:[{code:'AAA'},{code:'BBB'}],players:Array.from({length:11},(_,i)=>({i,number:i+1,short:`p${i}`}))} as unknown as ReplayHeader;
 const ms=subMoments(frames,[{t:10000,k:'substitution',x:'',a:10,g:4,s:0}]);
 it('the substitute steps on a few metres along from where the ghost walks off',()=>{
  const p=pitchSub(ms,frames,header,COLORS,10000,1)!,g=p.ghosts[0],a=p.arrive[0];
  expect(g.y).toBeGreaterThan(0);expect(a.y).toBeCloseTo(16.1,5);
  expect(Math.abs(a.x-g.x)).toBeGreaterThanOrEqual(4);
 });
});
