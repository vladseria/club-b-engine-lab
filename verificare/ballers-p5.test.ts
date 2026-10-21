// Ballers P5: triggered substitutions (prep -> frozen input -> engine ->
// replay/commentary/report), an idea's lineup mapping, and the idea lanes,
// pitch line and review on the broadcast.
import {describe,it,expect} from 'vitest';
import {computeMatch,sidePlans,submission,validateInput,type FrozenInput,type FrozenSide} from '../lib/ballers/simulation';
import {sample,timeline} from '../lib/ballers/replay';
import {buildIncidents} from '../lib/ballers/incidents';
import {boardLines} from '../lib/ballers/commentary';
import {SUB_REASON} from '../lib/ballers/commentary/ro';
import {engineThreshold,keepValid,noteLine,orderPhrase,subsProblem,tiredLevel,TIRED_LEVELS,type PrepOrder,type StoredNote} from '../lib/ballers/subs';
import {engineTeam,sideOrders} from '../lib/ballers/compute';
import {activeLinks,ideaLanes,ideaReview,resolveIdea,type IdeaName,type Marker} from '../lib/ballers/ideas';
import {oneTwoPlan} from '../lib/ballers/lab/model';

const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:4+n%5,defending:5,pace:4+n%4,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:gk?8:1});
const pid=(tag:string,n:number)=>`${tag}000000-0000-4000-8000-00000000000${n}`;
function side(tag:string,subs?:PrepOrder[]):FrozenSide{
 const players=Array.from({length:9},(_,n)=>({id:pid(tag,n),name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,roles:(n===0||n===8?['GK']:['CM','ST']) as FrozenSide['players'][0]['roles'],
  skills:skills(n===0||n===8,n),traits:{risk:.5,dribble:.4+n/40,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation:'1-2-1',style:'balanced',
  approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},
  captain:lineup[2],lineup,bench:players.slice(5).map(p=>p.id),players,plans:[],...(subs?{substitutions:subs}:{})};
}
const squadOf=(tag:string)=>side(tag).players.map(p=>({id:p.id,roles:p.roles as string[]}));
const lineupOf=(tag:string)=>side(tag).lineup;

describe('triggered substitutions through the official path',()=>{
 const a=pid('aa',5),b=pid('aa',6),out=pid('aa',4);
 const orders:PrepOrder[]=[{id:'half-change',in:a,out,trigger:{kind:'half'}},{id:'tired-change',in:b,trigger:{kind:'tired',player:pid('aa',3),threshold:99.5}}];
 const input:FrozenInput={v:1,match:'m5',seed:777,kickoff:1,duration:300,sides:[side('aa',orders),side('bb')]};
 const c=computeMatch(validateInput(input)),sub=submission(c,input);
 const tl=timeline(c.compact.header,c.compact.chunks);
 it('the half-time order happens at a stoppage after 2:30, recorded as a substitution event',()=>{
  const ev=tl.events.find(e=>e.k==='substitution'&&e.a===10);
  expect(ev).toBeDefined();
  expect(ev!.g).toBe(4);expect(ev!.s).toBe(0);expect(ev!.sb?.k).toBe('half');
  // (Lane C, 2026-10-21) at the first stoppage from 2:30, whenever this match has it (was: any time after 2:30 in seed 777)
  const stoppage=tl.events.find(e=>['goal','out','foul','offside'].includes(e.k)&&e.t>=150000);
  expect(ev!.t).toBe(stoppage!.t);
 },60000);
 it('frames name who stands at each position from the change on, and never blend across it',()=>{
  const ev=tl.events.find(e=>e.k==='substitution'&&e.a===10)!;
  const after=tl.frames.filter(f=>f.t>ev.t+100);
  expect(after.length).toBeGreaterThan(0);
  expect(after.every(f=>f.l?.[4]===10)).toBe(true);
  const first=tl.events.find(e=>e.k==='substitution')!;
  expect(tl.frames.filter(f=>f.t<first.t).every(f=>!f.l)).toBe(true);
  expect(sample(tl.frames,ev.t+500).lineup?.[4]).toBe(10);
 });
 it('the header lists both benches so the newcomer has a name and a portrait',()=>{
  const p=c.compact.header.players[10];
  expect(p).toMatchObject({i:10,side:0,id:a,bench:true,slot:-1});
 });
 it('substitution notes: one per order, owner-only, with the trigger they came from',()=>{
  expect(sub.sub_notes).toHaveLength(1);
  const notes=sub.sub_notes[0].notes as StoredNote[];
  expect(sub.sub_notes[0].side).toBe(0);
  expect(notes.map(n=>n.order).sort()).toEqual(['half-change','tired-change']);
  expect(notes.find(n=>n.order==='half-change')).toMatchObject({status:'made',trigger:{kind:'half'}});
  // Nothing about the orders leaks into the public header.
  expect(JSON.stringify(c.compact.header)).not.toMatch(/half-change|tired-change/);
 });
 it('commentary gives every substitution a Romanian line naming both players',()=>{
  const incidents=buildIncidents({header:c.compact.header,events:tl.events,frames:tl.frames});
  const subs=incidents.filter(x=>x.kind==='substitution');
  expect(subs.length).toBe(tl.events.filter(e=>e.k==='substitution').length);
  const lines=boardLines(incidents,'m5',c.compact.header).filter(l=>l.incident.kind==='substitution');
  expect(lines.length).toBe(subs.length);
  const half=lines.find(l=>l.incident.actors[0]===10)!;
  expect(half.text).toContain('AA Player 5');expect(half.text).toContain('AA Player 4');
  expect(half.text).toContain(SUB_REASON.half);
 });
});

describe('substitution orders: no orders = the P2 engine input; a bad side never costs the match',()=>{
 it('omitted and empty orders compute the identical match',()=>{
  const base:FrozenInput={v:1,match:'p',seed:31337,kickoff:0,duration:90,sides:[side('aa'),side('bb')]};
  const empty:FrozenInput={...base,sides:[side('aa',[]),side('bb',[])]};
  const x=computeMatch(base),y=computeMatch(empty);
  expect(JSON.stringify(y.compact.chunks)).toBe(JSON.stringify(x.compact.chunks));
  expect(y.compact.substitutionNotes).toEqual([]);
 },60000);
 it('an invalid order on one side is dropped and reported; the other side keeps its own',()=>{
  const bad:PrepOrder[]=[{id:'x',in:pid('bb',1),trigger:{kind:'half'}}]; // a starter can't come on
  const good:PrepOrder[]=[{id:'g',in:pid('aa',5),trigger:{kind:'half'}}];
  const c=computeMatch({v:1,match:'q',seed:99,kickoff:0,duration:200,sides:[side('aa',good),side('bb',bad)]});
  expect(c.dropped).toContain('subs:1');
  expect(c.compact.substitutionNotes?.map(n=>n.side)).toEqual([0]);
 },60000);
});

describe('prep validation mirrors the engine',()=>{
 const sq=squadOf('aa'),lu=lineupOf('aa');
 it('accepts a normal set of three',()=>{
  expect(subsProblem([{id:'1',in:pid('aa',5),trigger:{kind:'score',state:'losing'}},{id:'2',in:pid('aa',6),out:pid('aa',2),trigger:{kind:'margin',atLeast:2,direction:'up'},notBefore:600},
   {id:'3',in:pid('aa',8),out:pid('aa',0),trigger:{kind:'tired',player:pid('aa',0),threshold:95}}],sq,lu)).toBeNull();
 });
 it('refuses a keeper for an outfield slot and the reverse',()=>{
  expect(subsProblem([{id:'1',in:pid('aa',8),out:pid('aa',2),trigger:{kind:'half'}}],sq,lu)).toMatch(/Keepers/);
  expect(subsProblem([{id:'1',in:pid('aa',5),out:pid('aa',0),trigger:{kind:'half'}}],sq,lu)).toMatch(/Keepers/);
 });
 it('refuses re-entry, a starter coming on, more than three, and a tired order for someone else',()=>{
  expect(subsProblem([{id:'1',in:pid('aa',5),trigger:{kind:'half'}},{id:'2',in:pid('aa',5),trigger:{kind:'half'}}],sq,lu)).toMatch(/only once/);
  expect(subsProblem([{id:'1',in:pid('aa',2),trigger:{kind:'half'}}],sq,lu)).toMatch(/bench/);
  expect(subsProblem(Array.from({length:4},(_,i)=>({id:`o${i}`,in:pid('aa',5+i),trigger:{kind:'half'} as const})),sq,lu)).toMatch(/At most 3/);
  expect(subsProblem([{id:'1',in:pid('aa',5),out:pid('aa',2),trigger:{kind:'tired',player:pid('aa',3),threshold:95}}],sq,lu)).toMatch(/tired/);
 });
 it('someone brought on can be taken off later, never someone who never plays',()=>{
  expect(subsProblem([{id:'1',in:pid('aa',5),out:pid('aa',2),trigger:{kind:'half'}},{id:'2',in:pid('aa',6),out:pid('aa',5),trigger:{kind:'score',state:'winning'}}],sq,lu)).toBeNull();
  expect(subsProblem([{id:'2',in:pid('aa',6),out:pid('aa',7),trigger:{kind:'half'}}],sq,lu)).toMatch(/start or come on/);
 });
 it('a lineup change keeps only the orders that still fit',()=>{
  const orders:PrepOrder[]=[{id:'1',in:pid('aa',5),trigger:{kind:'half'}},{id:'2',in:pid('aa',6),trigger:{kind:'half'}}];
  const newLineup=[...lu];newLineup[3]=pid('aa',5);
  expect(keepValid(orders,sq,newLineup).map(o=>o.id)).toEqual(['2']);
 });
 it('tiredness levels map to measured thresholds and read in plain English',()=>{
  expect(TIRED_LEVELS.map(l=>l.threshold)).toEqual([97,95,92]);
  expect(tiredLevel(94.6).label).toBe('tired');
  const name=(id:string)=>id===pid('aa',5)?'Rex':'Van Pisi';
  expect(orderPhrase({id:'1',in:pid('aa',5),out:pid('aa',3),trigger:{kind:'tired',player:pid('aa',3),threshold:95},notBefore:600},name)).toBe('Rex on for Van Pisi if Van Pisi is tired, not before 10:00.');
  expect(orderPhrase({id:'1',in:pid('aa',5),trigger:{kind:'margin',atLeast:2,direction:'down'}},name)).toBe('Rex on for the most tired player if we’re 2+ down.');
  expect(TIRED_LEVELS.map(l=>l.name)).toEqual(['A bit tired','Tired','Running on empty']);
 });
 it('a stored level code reaches the engine as that level’s energy on today’s fatigue curve',()=>{
  // Orders saved before acceleration fatigue keep their intent: 95 was "tired, late on", not energy 95 (now ~5:00).
  // Recalibrated for the tiredness bite (build 45a18f07): the levels were 95/90/86, now 88/79/75 at the same times.
  expect([97,95,92].map(engineThreshold)).toEqual([88,79,75]);
  expect(engineThreshold(99.5)).toBe(99.5); // not a code: already an energy
  const tired:PrepOrder={id:'t',in:pid('aa',5),out:pid('aa',3),trigger:{kind:'tired',player:pid('aa',3),threshold:95},notBefore:600};
  const half:PrepOrder={id:'h',in:pid('bb',5),out:pid('bb',4),trigger:{kind:'half'}};
  const input:FrozenInput={v:1,match:'mc',seed:1,kickoff:0,duration:900,sides:[side('aa',[tired]),side('bb',[half])]};
  const {orders}=sideOrders(input,input.sides.map(engineTeam) as never);
  expect(orders).toEqual([{id:'t',side:0,in:pid('aa',5),out:pid('aa',3),trigger:{kind:'tired',player:pid('aa',3),threshold:79},notBefore:600},{id:'h',side:1,in:pid('bb',5),out:pid('bb',4),trigger:{kind:'half'}}]);
  expect(input.sides[0].substitutions![0].trigger).toEqual({kind:'tired',player:pid('aa',3),threshold:95}); // the frozen input is untouched
  const name=(id:string)=>id===pid('aa',5)?'Rex':'Van Pisi';
  expect(noteLine({order:'t',side:0,status:'waiting',in:pid('aa',5),out:pid('aa',3),detail:'',trigger:{kind:'tired',player:pid('aa',3),threshold:92}},name).text)
   .toBe('Rex for Van Pisi didn’t happen: Van Pisi never ran on empty.');
 });
 it('the report explains an order that never happened',()=>{
  const name=(id:string)=>id===pid('aa',5)?'Rex':'Van Pisi';
  expect(noteLine({order:'1',side:0,status:'waiting',in:pid('aa',5),detail:'Condiția nu a fost îndeplinită la nicio oprire a jocului.',trigger:{kind:'score',state:'losing'}},name).text)
   .toBe('Rex for the most tired player didn’t happen: we were never losing.');
  expect(noteLine({order:'1',side:0,status:'made',in:pid('aa',5),out:pid('aa',3),time:452.3,detail:'',trigger:{kind:'half'}},name))
   .toEqual({made:true,text:'7:32 Rex on for Van Pisi (half-time).'});
 });
});

describe('an idea drawn for another five',()=>{
 const drawn=lineupOf('aa');                                   // slot n = drawn[n-1]
 const plan=oneTwoPlan(2,4,'two','four',.8) as unknown as Record<string,unknown>;
 const idea={plan,lineup:drawn};
 it('the same five: nothing to reassign, the plan is unchanged',()=>{
  const r=resolveIdea(idea,drawn);
  expect(r.missing).toEqual([]);expect(r.issues).toEqual([]);
  expect((r.plan as {lesson:{jobs:{actor:number;recipient:number}[]}}).lesson.jobs[0]).toMatchObject({actor:2,recipient:4});
 });
 it('players who moved slot keep their part (no more running on slot numbers)',()=>{
  const moved=[drawn[0],drawn[3],drawn[2],drawn[1],drawn[4]];     // #2 and #4 swapped places
  const r=resolveIdea(idea,moved);
  expect(r.missing).toEqual([]);
  expect((r.plan as {lesson:{jobs:{actor:number;recipient:number}[]}}).lesson.jobs[0]).toMatchObject({actor:4,recipient:2});
 });
 it('a missing player: a suggested stand-in, or the manager’s pick; two parts on one player is refused',()=>{
  const target=[drawn[0],pid('aa',6),drawn[2],drawn[3],drawn[4]];   // #2 is on the bench now
  const r=resolveIdea(idea,target);
  expect(r.missing).toEqual([{slot:2,id:drawn[1],assigned:pid('aa',6),chosen:false}]);
  expect(r.assign).toEqual({'2':pid('aa',6)});
  const picked=resolveIdea(idea,target,{'2':drawn[4]});
  expect(picked.missing[0]).toMatchObject({assigned:drawn[4],chosen:true});
  expect((picked.plan as {lesson:{jobs:{actor:number}[]}}).lesson.jobs[0].actor).toBe(5);
  const dup=resolveIdea(idea,target,{'2':drawn[3]});                // #4 already has his own part
  expect(dup.issues.some(i=>i.reason==='duplicate')).toBe(true);
 });
 it('the frozen plan is resolved with the stored mapping; an unplaceable idea is dropped, never guessed',()=>{
  const target=[drawn[0],pid('aa',6),drawn[2],drawn[3],drawn[4]];
  const s={...side('aa'),lineup:target,plans:[{idea:'i',key:'k',name:'One-two',plan,lineup:drawn,accent:100,assign:{'2':drawn[4]}}]};
  const r=sidePlans(s);
  expect(r.dropped).toEqual([]);
  const jobs=(r.plans[0] as unknown as {lesson:{jobs:{actor:number;recipient:number}[]}}).lesson.jobs;
  expect(jobs[0]).toMatchObject({actor:5,recipient:4});
  const clash=sidePlans({...s,plans:[{...s.plans[0],assign:{'2':drawn[3]}}]});
  expect(clash.dropped).toEqual(['k']);
 });
});

describe('ideas on the broadcast',()=>{
 const m=(seq:number,side:0|1,t:number,progress:Marker['progress'],end:string|null,endedAt:number|null=t+5,free=false):Marker=>({seq,side,t,ended_at:endedAt,status:'ended',end_reason:end,progress,free});
 const markers=[m(0,0,10,'attempted','complete'),m(1,0,40,'attempted','loss'),m(2,1,50,'attempted','complete'),m(3,0,70,'recognised','restart'),m(4,0,80,'pursued','duration'),m(5,0,90,'recognised',null,95,true)];
 const names:IdeaName[]=[{seq:0,name:'Left overload',plan_key:'a'},{seq:1,name:'Left overload',plan_key:'a'},{seq:3,name:'Press high',plan_key:'b',detail:{links:[[70000,2,4],[72000,3,-1]]}},{seq:4,name:'Cutback',plan_key:'c'}];
 it('one named lane per idea for the owner; the opponent’s markers have no name to show',()=>{
  const lanes=ideaLanes(markers,names,0);
  expect(lanes.map(l=>[l.name,l.markers.length])).toEqual([['Left overload',2],['Press high',1],['Cutback',1]]);
  expect(ideaLanes(markers,names,1)).toEqual([]);
 });
 it('the review counts ✓/✗ with the Q5.1 rule and says why an attempt didn’t start',()=>{
  const r=ideaReview(markers,names,0,[]);
  expect(r[0]).toMatchObject({name:'Left overload',fired:2,ok:1,x:1,faint:0});
  expect(r[1].entries[0].why).toBe('Spotted the moment; nobody moved for it (play stopped).');
  expect(r[2].entries[0].why).toBe('Players moved for it, but the key action never started (it ran out of time).');
 });
 it('the faint pitch line follows the idea’s latest link while it is active only',()=>{
  expect(activeLinks(markers,names,0,71)).toEqual([{a:2,g:4}]);
  // an actor-only step joins the previous distinct actor (the real traces look like this)
  expect(activeLinks(markers,names,0,73)).toEqual([{a:3,g:2}]);
  expect(activeLinks(markers,names,0,76)).toEqual([]);
  expect(activeLinks(markers,names,1,71)).toEqual([]);
  const solo:IdeaName[]=[{seq:3,name:'Press high',plan_key:'b',detail:{links:[[70000,6,-1]]}}];
  expect(activeLinks(markers,solo,0,71)).toEqual([{a:6,g:-1}]);
 });
});
