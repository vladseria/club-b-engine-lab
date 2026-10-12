// R1 (engine truthfulness review round, 2026-10-01): control back to the
// manager. Only "On winning it: Counter" changes how the team plays after a
// regain; "Bodies forward" is a strong, priced preference each player holds
// by his discipline, not a hard rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {counterOn,approachForSituation,COUNTER_FLIP,COUNTER_WINDOW} from '../dist/team-approach.js';
import {readTransition} from '../dist/practice-transition.js';
import {selectPossessionJobs} from '../dist/practice-job-selection.js';
import {commitBounds,commitmentPrice,commitHold,COMMIT_PRICE,isRest} from '../dist/practice-rest-defence.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));
// Team 0 (1-2-1) has just won the ball at (12, 0) with its CB; team 1 lost it
// high (the B3b scene): `theirRest` of theirs clearly goal-side of the ball,
// `oursAhead` of ours level with or ahead of it.
const regain=(theirRest,oursAhead)=>{
 const players=practicePlayers(structuredClone(fixture));
 const rest=[[30,-4],[32,4],[36,0]].slice(0,theirRest),press=[[13.5,2],[10,-3],[16,-6],[9,5]].slice(0,4-theirRest);
 const ahead=[[16,-8],[18,8],[20,0]].slice(0,oursAhead),behind=[[8,-9],[7,9],[6,0]].slice(0,3-oursAhead);
 place(players,[[2,0],[12,0],...ahead,...behind,[46,0],...rest,...press]);
 return {players,carrier:players[1]};
};
const base=fixture.teams[0].tactics;

test('Balanced and Keep it never change Progression, Striker or Bodies forward after a regain',()=>{
 const scenes=[[2,2],[2,1],[1,2],[1,3],[0,3],[3,2]].map(([r,a])=>regain(r,a));
 for(const transition of ['balanced','secure'])for(const progression of ['patient','mixed'])for(const striker of ['mixed','link'])for(const commit of [1,3,5]){
  const t={...base,transition,progression,striker,commit};
  for(const {players,carrier} of scenes)for(let age=0;age<COUNTER_WINDOW+1;age+=.5){
   const s=approachForSituation(t,players,carrier,age);
   // "Keep it" plays patient for 3 s after a regain: its own meaning, not a flip.
   const own=transition==='secure'&&age<3?'patient':progression;
   assert.equal(s.progression,own,`${transition} ${progression} at ${age} s`);
   assert.equal(s.striker,striker);assert.equal(s.commit,commit);
  }
 }
 // The carrier's own read of a counter that is on is kept (he does not kick
 // it away to nobody), and it is not a setting.
 const {players,carrier}=regain(2,2),t={...base,transition:'balanced'};
 assert(counterOn(t,players,carrier,1));
 assert.equal(approachForSituation(t,players,carrier,1).counter,true);
 assert.equal(approachForSituation({...t,transition:'secure'},players,carrier,1).counter,true,'Keep it with a clear man over');
});

test('Counter flips the team for 8 s after a regain: direct, striker in behind, four bodies forward',()=>{
 const {players,carrier}=regain(2,1),t={...base,transition:'counter',progression:'mixed',striker:'mixed',commit:3};
 const on=approachForSituation(t,players,carrier,1);
 assert.equal(on.progression,'direct');assert.equal(on.striker,'run');assert.equal(on.commit,4);assert.equal(on.counter,true);
 const late=approachForSituation(t,players,carrier,COUNTER_FLIP+.5);
 assert.equal(late.progression,'mixed','no flip once the live 8 s window has passed');assert.equal(late.striker,'mixed');assert.equal(late.commit,3);
 assert.equal(approachForSituation(t,players,carrier,-1),t,'no flip at kickoff');
 // An organised defence (a full rest defence, the numbers against us, no
 // open run) closes it, as live.
 const set=regain(3,0);
 assert(!counterOn(t,set.players,set.carrier,1)&&!readTransition(set.players,set.carrier,t,1).open);
 assert.equal(approachForSituation(t,set.players,set.carrier,1),t);
});

test('Bodies forward: 1 keeps two back, 5 lets at most one stay; the last man is the moment\'s',()=>{
 assert.deepEqual([1,2,3,4,5].map(c=>commitBounds(c)),[{minRest:2,maxRest:3},{minRest:1,maxRest:3},{minRest:0,maxRest:3},{minRest:0,maxRest:2},{minRest:0,maxRest:1}]);
 const d=(rest,discipline=.9)=>({rest,discipline});
 assert.equal(commitmentPrice(commitBounds(1),[d(true),d(true),d(false)]),0,'1: the third may join');
 assert.equal(commitmentPrice(commitBounds(5),[d(true),d(false),d(false)]),0,'5: one may stay');
 assert.equal(commitmentPrice(commitBounds(5),[d(false),d(false),d(false)]),0,'5: all may go');
 assert(commitmentPrice(commitBounds(1),[d(true),d(false),d(false)])>0);
 // A body out of the shape is charged at the least disciplined player who
 // could have honoured it: breaking it through him is the cheapest way.
 const surplus=commitmentPrice(commitBounds(5),[d(true,.2),d(true,.95),d(false)]);
 assert(Math.abs(surplus-commitHold(.2))<1e-12);
 assert(commitHold(.2)<commitHold(.95)&&commitHold(.95)<=COMMIT_PRICE);
 assert(Math.abs(commitmentPrice(commitBounds(5),[d(true,.9),d(true,.9),d(true,.9)])-2*commitHold(.9))<1e-12,'two surplus bodies cost twice');
});

// A settled attack: team 0's carrier at (30, 0) in the opponents' half, three
// outfield team-mates, each offered one job behind the ball and one joining it.
const attack=(disciplineA,stayValue,commit=5)=>{
 const f=structuredClone(fixture);
 const players=practicePlayers(f);
 place(players,[[4,0],[26,-8],[30,0],[27,9],[25,1],[46,0],[40,-3],[41,4],[38,0],[43,-6]]);
 const focus=players[2],mates=[players[1],players[3],players[4]];
 mates[0].traits={...mates[0].traits,discipline:disciplineA};
 for(const p of [mates[1],mates[2]])p.traits={...p.traits,discipline:.9};
 const job=(p,aim,purpose)=>({player:p.id,purpose,kind:'support',aim,speed:p.pace,since:10,until:12,reason:''});
 const candidates=new Map([
  // A: staying behind is worth `stayValue` more than joining.
  [mates[0].id,[{job:job(mates[0],{x:22,y:-8},'cover'),score:stayValue},{job:job(mates[0],{x:32,y:-8},'outlet'),score:0}]],
  // B holds behind (the one who may stay at 5); C joins.
  [mates[1].id,[{job:job(mates[1],{x:21,y:6},'cover'),score:2},{job:job(mates[1],{x:33,y:8},'outlet'),score:0}]],
  [mates[2].id,[{job:job(mates[2],{x:20,y:0},'cover'),score:-2},{job:job(mates[2],{x:34,y:2},'outlet'),score:0}]],
 ]);
 const jobs=selectPossessionJobs(players,focus,mates,{...f.teams[0].tactics,commit},laneRisk,candidates,new Set(),10);
 return {staysA:isRest(0,focus,jobs.find(j=>j.player===mates[0].id).aim),rest:jobs.filter(j=>isRest(0,focus,j.aim)).length};
};
test('commit is a preference: a low-discipline player breaks it when the football is worth it, a disciplined one holds it',()=>{
 const worth=1.1,small=.2;
 const low=attack(.1,worth),high=attack(.95,worth);
 assert(low.staysA&&low.rest===2,`an undisciplined player stays back when staying is clearly worth more (rest ${low.rest})`);
 assert(!high.staysA&&high.rest===1,`a disciplined one joins as the manager asked (rest ${high.rest})`);
 const lowSmall=attack(.1,small);
 assert(!lowSmall.staysA,'a small football edge does not break the shape, even for him');
 // At commit 3 nothing is priced: the football alone decides.
 assert(attack(.95,small,3).staysA,'commit 3: free');
});
