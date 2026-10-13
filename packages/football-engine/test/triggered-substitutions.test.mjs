import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runMatch,createSimulationRequest,validateSubstitutionOrders,MAX_TRIGGERED_SUBSTITUTIONS} from '../dist/index.js';
import {triggerHolds,resolveOrder,halfTime} from '../dist/practice-substitutions.js';
import {practicePlayers} from '../dist/practice.js';
import {defaultPlans} from '../dist/practice-playbook.js';

const base=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
// The shared fixture has no bench. Add a keeper and two outfield players per side.
const withBench=(seed=2026)=>{
 const f=structuredClone(base);f.seed=seed;
 for(const [side,t] of f.teams.entries()){
  const gk=t.squad.find(p=>p.roles[0]==='GK');
  t.squad.push({...structuredClone(gk),id:`rgk${side}`,name:`Portar rezervă ${side}`},
   {...structuredClone(t.squad[3]),id:`r1${side}`,name:`Rezerva unu ${side}`},
   {...structuredClone(t.squad[4]),id:`r2${side}`,name:`Rezerva doi ${side}`});
 }
 return f;
};
const STOPPAGES=['goal','out','foul','offside','half'];
const subs=r=>r.events.filter(e=>e.kind==='substitution');
// Every substitution is made during the stoppage its preceding event created.
function assertAtStoppage(r){
 for(const e of subs(r)){
  const i=r.events.indexOf(e);let j=i-1;while(r.events[j].kind==='substitution')j--;
  assert(STOPPAGES.includes(r.events[j].kind),`substitution follows ${r.events[j].kind}`);
  assert.equal(r.events[j].time,e.time,'made in the same tick as the stoppage');
  const frame=r.frames.find(f=>f.event>=i);
  assert(frame.restart,'the ball is dead while the player comes on');
 }
}
const COMPARED=['frames','events','choices','stats','score','players','controlContacts','playbookSelections','standingNotes','coachingNotes'];

test('orders are validated: bench only, once each, max three per side, keeper for keeper',()=>{
 const f=withBench();
 const ok={id:'a',side:0,in:'r10',trigger:{kind:'half'}};
 assert.equal(validateSubstitutionOrders([ok],f).length,1);
 assert.equal(MAX_TRIGGERED_SUBSTITUTIONS,3);
 f.teams[0].squad.push({...structuredClone(f.teams[0].squad[3]),id:'r30',name:'Rezerva trei'});
 const four=['r10','r20','r30','rgk0'].map((id,i)=>({id:`o${i}`,side:0,in:id,trigger:{kind:'half'}}));
 assert.throws(()=>validateSubstitutionOrders(four,f),/At most 3/);
 assert.equal(validateSubstitutionOrders([...four.slice(0,3),{id:'x',side:1,in:'r11',trigger:{kind:'half'}}],f).length,4,'the limit is per side');
 assert.throws(()=>validateSubstitutionOrders([{...ok,in:'van'}],f),/bench/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,in:'nobody'}],f),/squad/);
 assert.throws(()=>validateSubstitutionOrders([ok,{...ok,id:'b'}],f),/only once/);
 assert.throws(()=>validateSubstitutionOrders([ok,{...ok,in:'r20'}],f),/distinct id/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,in:'rgk0',out:'van'}],f),/Keepers/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,out:'mircea'}],f),/Keepers/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,out:'r20'}],f),/start or come on/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'tired',player:'van',threshold:90},out:'golusor'}],f),/tired player/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'tired',player:'van',threshold:0}}],f),/threshold/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'margin',atLeast:1.5,direction:'up'}}],f),/Margin/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'score',state:'ahead'}}],f),/Score/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,trigger:{kind:'injured'}}],f),/Unknown/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,side:2}],f),/side/);
 assert.throws(()=>validateSubstitutionOrders([{...ok,notBefore:-1}],f),/notBefore/);
 // A later order may take off a player whom an earlier order brought on.
 assert.equal(validateSubstitutionOrders([ok,{id:'b',side:0,in:'r20',out:'r10',trigger:{kind:'half'}}],f).length,2);
 // The tired player is the outgoing player by default.
 assert.equal(validateSubstitutionOrders([{...ok,trigger:{kind:'tired',player:'van',threshold:95}}],f)[0].out,'van');
 // API boundaries: matches only, not with coaching or the automatic 60/70/80 schedule.
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,substitutions:'planned',substitutionOrders:[ok]}),/planned or triggered/);
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,coaching:{kind:'repeat-one-two',side:0,carrier:3,partner:5,channelY:0,width:20,emphasis:.6},substitutionOrders:[ok]}),/coaching/);
 // Omitted and empty orders leave the frozen input unchanged.
 const plain=createSimulationRequest({kind:'match',fixture:f});
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,substitutionOrders:[]}),plain);
 assert(!('substitutionOrders' in plain.input));
 assert.deepEqual(createSimulationRequest({kind:'match',fixture:f,substitutionOrders:[ok]}).input.substitutionOrders,[ok]);
});

test('each trigger kind reads score, margin, clock and energy as specified',()=>{
 const f=withBench(),players=practicePlayers(f);
 assert.equal(halfTime(900),450,'7:30 of a 15-minute match');assert.equal(halfTime(5400),2700);
 const h=(t,side,score,time=100,duration=900)=>triggerHolds(t,side,time,duration,score,players);
 assert(h({kind:'score',state:'losing'},0,[0,1])&&!h({kind:'score',state:'losing'},1,[0,1]));
 assert(h({kind:'score',state:'winning'},1,[0,1])&&!h({kind:'score',state:'winning'},0,[1,1]));
 assert(h({kind:'score',state:'drawing'},0,[2,2])&&!h({kind:'score',state:'drawing'},0,[2,1]));
 assert(h({kind:'margin',atLeast:2,direction:'up'},0,[3,1])&&!h({kind:'margin',atLeast:2,direction:'up'},0,[2,1]));
 assert(h({kind:'margin',atLeast:2,direction:'down'},1,[4,2])&&!h({kind:'margin',atLeast:2,direction:'down'},0,[4,2]));
 assert(!h({kind:'half'},0,[0,0],449.9)&&h({kind:'half'},0,[0,0],450));
 const van=players.find(p=>p.id==='0:van');van.energy=94;
 assert(h({kind:'tired',player:'van',threshold:95},0,[0,0])&&!h({kind:'tired',player:'van',threshold:94},0,[0,0]));
 assert(!h({kind:'tired',player:'r10',threshold:100},0,[0,0]),'a player who is not on the pitch is not tired');
 // Keeper-for-keeper also holds at run time when no outgoing player is named.
 const keeperIn=resolveOrder({id:'k',side:0,in:'rgk0',trigger:{kind:'half'}},f,players,new Set());
 assert.equal(keeperIn.outgoing.id,'0:mircea');
 const outfieldIn=resolveOrder({id:'o',side:0,in:'r10',trigger:{kind:'half'}},f,players,new Set());
 assert.equal(outfieldIn.outgoing.id,'0:van','the most tired outfield player');
 assert.match(resolveOrder({id:'g',side:0,in:'r10',out:'van',trigger:{kind:'half'}},f,players.filter(p=>p.id!=='0:van'),new Set(['0:van'])).impossible,/ieșit/);
 assert.match(resolveOrder({id:'w',side:0,in:'r20',out:'r10',trigger:{kind:'half'}},f,players,new Set()).wait,/nu este pe teren/,'waits for a substitute who has not come on yet');
});

test('a tired trigger replaces that player at the next stoppage; the newcomer inherits slot and role',()=>{
 const f=withBench(2026);
 const r=runMatch({fixture:f,durationSeconds:300,substitutionOrders:[{id:'t',side:0,in:'r10',trigger:{kind:'tired',player:'van',threshold:98}}]}).result;
 const [e]=subs(r);assert(e,'the order fired');
 assert.equal(e.outgoing,'0:van');assert.equal(e.incoming,'0:r10');assert.equal(e.side,0);
 assert.deepEqual(e.substitution.trigger,{kind:'tired',player:'van',threshold:98});
 assert(e.substitution.energy<98,'the player was below the threshold when he went off');
 assertAtStoppage(r);
 // The previous stoppage found him still above the threshold (else he would have gone then).
 const outIndex=r.players.findIndex(p=>p.id==='0:van'),prior=r.events.filter(x=>STOPPAGES.includes(x.kind)&&x.time<e.time).at(-1);
 const priorFrame=r.frames.filter(fr=>fr.time<=prior.time).at(-1);
 assert(priorFrame.players[outIndex].energy>=98-0.05,'not yet tired at the previous stoppage');
 const incoming=r.players.find(p=>p.id==='0:r10'),outgoing=r.players[outIndex];
 assert.equal(incoming.number,outgoing.number);assert.equal(incoming.role,outgoing.role);assert.equal(incoming.lane,outgoing.lane);
 assert.equal(incoming.energy,100,'comes on fresh');
 assert.deepEqual(r.substitutionNotes,[{order:'t',side:0,status:'made',in:'r10',out:'van',detail:r.substitutionNotes[0].detail,time:e.time}]);
 const last=r.frames.at(-1);assert(last.lineup.includes(r.players.indexOf(incoming))&&!last.lineup.includes(outIndex));
});

test('score, margin and half-time triggers fire at stoppages when true; three per side at most; no re-entry',()=>{
 // A seeded passage: seed 2026's 300 s had all three triggers fire; wingers
 // holding the lane Width asks for (2026-10-01, B2) changed it, and 2027 was
 // the next seed that did; pricing a loss by the rest defence (B3) changed
 // that, and 2028 is the next (evidence/2026-09-30-balance-v3/repin.mjs subs).
 // The settings-truth round (2026-10-04: line keepers stay home, Counter-press
 // goes whatever the numbers) changed it; 2029 is the next
 // (evidence/2026-10-04-settings-truth/repin.mjs subs). The matchups-combined
 // build (2026-10-10) changed it; 2030 is the next
 // (evidence/2026-10-10-matchups-combined/repin.mjs subs). Still 2030 on the
 // combined build with stamina as lasting and box defending (b0174c30,
 // evidence/2026-10-12-box-defending/repin.mjs subs). The keeper fix (2026-10-13: nobody stands on a keeper with
 // the ball in his hands; futsal's 4 s hold) changed it; 2031 is the next (evidence/2026-10-13-keeper-fix/repin.mjs subs).
 const f=withBench(2031);
 const orders=[
  {id:'h',side:0,in:'r10',trigger:{kind:'half'}},
  {id:'chain',side:0,in:'r20',out:'r10',trigger:{kind:'tired',player:'r10',threshold:99.9},notBefore:200},
  {id:'k',side:0,in:'rgk0',trigger:{kind:'score',state:'winning'}},
  {id:'w',side:1,in:'r11',trigger:{kind:'score',state:'losing'}},
  {id:'m',side:1,in:'r21',trigger:{kind:'margin',atLeast:1,direction:'down'},notBefore:100},
  {id:'d',side:1,in:'rgk1',trigger:{kind:'score',state:'drawing'}},
 ];
 const r=runMatch({fixture:f,durationSeconds:300,substitutionOrders:orders}).result;
 assertAtStoppage(r);
 const made=subs(r);
 for(const side of [0,1])assert(made.filter(e=>e.side===side).length<=3);
 for(const e of made){
  const [own,opp]=e.substitution.score,t=e.substitution.trigger;
  if(t.kind==='score')assert(t.state==='winning'?own>opp:t.state==='losing'?own<opp:own===opp,`${t.state} held`);
  if(t.kind==='margin')assert((t.direction==='up'?own-opp:opp-own)>=t.atLeast);
  if(t.kind==='half')assert(e.time>=150);
  const order=orders.find(o=>o.id===e.substitution.order);if(order.notBefore)assert(e.time>=order.notBefore);
 }
 // Half-time: the first stoppage from 2:30 of a 5-minute match.
 const half=made.find(e=>e.substitution.order==='h'),firstAfter=r.events.find(e=>STOPPAGES.includes(e.kind)&&e.time>=150);
 assert.equal(half.time,firstAfter.time);
 // A drawing trigger does not act at the opening kickoff; it waits for the first stoppage.
 const draw=made.find(e=>e.substitution.order==='d');assert(draw.time>0);
 assert.equal(draw.outgoing,'1:mircea','keeper incoming replaces the keeper');
 // The chain: r10 comes on, then goes off for r20; nobody who went off returns.
 const chain=made.find(e=>e.substitution.order==='chain');
 assert(chain,'the substitute tired and was replaced');assert.equal(chain.outgoing,'0:r10');assert(chain.time>half.time);
 const wentOff=new Set();
 for(const e of made){assert(!wentOff.has(e.incoming),'no re-entry');wentOff.add(e.outgoing);}
 const last=r.frames.at(-1);
 for(const id of wentOff)assert(!last.lineup.includes(r.players.findIndex(p=>p.id===id)),`${id} stays off`);
 assert.equal(new Set(last.lineup).size,10);
 assert.deepEqual(r.substitutionNotes.map(n=>n.status),orders.map(o=>made.some(e=>e.substitution.order===o.id)?'made':'waiting'));
});

test('an order whose trigger never fires changes nothing; identical inputs reproduce exactly',()=>{
 const f=withBench(13009),common={fixture:f,durationSeconds:120};
 const plain=runMatch(common).result;
 const idle=runMatch({...common,substitutionOrders:[{id:'never',side:0,in:'r10',trigger:{kind:'margin',atLeast:20,direction:'up'}},{id:'late',side:1,in:'r11',trigger:{kind:'half'},notBefore:5000}]}).result;
 for(const k of COMPARED)assert.deepEqual(idle[k],plain[k],k);
 assert.deepEqual(idle.substitutionNotes.map(n=>n.status),['waiting','waiting']);
 assert(!('substitutionNotes' in plain));
 const orders=[{id:'t',side:1,in:'r11',trigger:{kind:'tired',player:'van',threshold:99.5}},{id:'k',side:0,in:'rgk0',trigger:{kind:'half'}}];
 const a=runMatch({...common,substitutionOrders:orders}),b=runMatch({...common,substitutionOrders:structuredClone(orders)});
 assert.equal(subs(a.result).length,2);
 assert.deepEqual(a,b);
});

test('slot-addressed plans pass to the newcomer when he inherits the slot',()=>{
 // A seeded passage: seed 2026's side 0 selected plans after the half-time
 // change until the counter-press after a loss (2026-10-01, B3); 2027 is the
 // next seed that does (evidence/2026-10-01-b3-losing-the-ball/repin.mjs slot). Track the runner's wider skill
 // range (2026-10-11: a run read 0.1-0.8 s ahead by reading) changed 2027; 2028 is the next
 // (evidence/2026-10-11-track-runner/repin.mjs slot).
 const f=withBench(2028),playbooks=[0,1].map(side=>({side,adaptive:true,plans:defaultPlans().map(p=>({...p,id:`team-${side}-${p.id}`,name:`Team ${side} ${p.name}`}))}));
 const r=runMatch({fixture:f,durationSeconds:240,playbooks,substitutionOrders:[{id:'h',side:0,in:'r10',out:'van',trigger:{kind:'half'}}]}).result;
 const [e]=subs(r);assert(e);assertAtStoppage(r);
 const incoming=r.players.find(p=>p.id==='0:r10');
 assert.equal(incoming.number,r.players.find(p=>p.id==='0:van').number);
 // After the change the newcomer takes part in his team's plays, and the departed player takes none.
 const afterSel=r.playbookSelections.filter(s=>s.side===0&&s.time>e.time&&s.planId);
 assert(afterSel.length,'side 0 keeps selecting plans');
 const index=r.players.indexOf(incoming),vanIndex=r.players.findIndex(p=>p.id==='0:van');
 assert(r.choices.some(c=>c.player===index&&c.time>e.time&&c.assignment?.purpose==='playbook'),'newcomer carries out slot #4 plan jobs');
 assert(!r.choices.some(c=>c.player===vanIndex&&c.time>e.time),'departed player makes none');
});
