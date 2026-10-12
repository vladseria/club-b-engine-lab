import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {teamApproaches} from '../dist/index.js';
import {coordinateFootball,runStyle} from '../dist/practice-coordination.js';
import {attackingSpaceReader} from '../dist/practice-attacking-space.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));
const short=teamApproaches.combinations.settings,balanced=teamApproaches.balanced.settings;

// Audit #1: patient progression prices only the runs that bypass the build-up.
test('patient play charges depth and break runs, not the return after a pass or arriving in the box',()=>{
 const patient={...short,transition:'balanced'};
 for(const purpose of ['depth','break'])assert(runStyle(patient,purpose)<runStyle(balanced,purpose),`${purpose}: patient keeps a real cost`);
 for(const purpose of ['near-post','far-post','cutback'])assert.equal(runStyle(short,purpose),runStyle(balanced,purpose),`${purpose}: arriving in the box is not bypassing the build-up`);
 assert(runStyle(short,'give-and-go')>runStyle(balanced,'give-and-go'),'the continuation after the pass is what a patient side asks for');
});

// Audit #2: "bodies forward" does not tax the return run beside the ball.
test('commit prices runs ahead of the ball, not the give-and-go return',()=>{
 const at=commit=>({...balanced,commit});
 assert.equal(runStyle(at(1),'give-and-go'),runStyle(at(5),'give-and-go'),'a wall-pass return costs the same at commit 1 and 5');
 assert(runStyle(at(1),'depth')<runStyle(at(5),'depth'),'commit still prices a depth run');
 assert(runStyle(at(1),'near-post')<runStyle(at(5),'near-post'),'and bodies arriving in the box');
});

// Audit #13: "Keep it" keeps one brake on a break (the openness threshold).
test('"Keep it" does not tax a break that has cleared its own higher threshold',()=>{
 assert.equal(runStyle(short,'break'),runStyle(balanced,'break'),'a Short side taking a free break pays no patience cost on it');
 assert(runStyle({...short,transition:'balanced'},'break')<runStyle(balanced,'break'),'patience still costs a break a Short side has not screened with Keep it');
 assert(runStyle(short,'depth')<runStyle(balanced,'depth'),'depth runs keep patience\'s cost');
});

// Scenes: the ball wide in the final third; which jobs does a Short side's
// team hand out, compared with the same side playing Balanced?
const arrivals=settings=>{
 let n=0;
 for(const x of [34,37])for(const y of [-10,10])for(const lift of [0,2]){
  const f=structuredClone(fixture);
  const players=practicePlayers(f);
  place(players,[[3,0],[24,-4],[x-8,y>0?2:-2],[x,y],[x-6+lift,-y*.4],[46,0],[41,y*.4],[40,-y*.3],[37,y*.8],[30,0]]);
  const owner=players[3],tactics=f.teams.map((t,i)=>({...t.tactics,...(i===0?settings:{})}));
  const plan=coordinateFootball(players,{...owner,z:0,vz:0,mode:'control',owner:owner.id},0,tactics,laneRisk,{time:10,recoveredAt:-10});
  for(const p of players.filter(p=>p.side===0))if(['near-post','far-post','cutback'].includes(plan.jobs[p.id]?.purpose))n++;
 }
 return n;
};
test('a Short side still sends runners into the box when the ball is wide in the final third',()=>{
 const patient=arrivals(short),mixed=arrivals({...short,progression:'mixed'});
 assert(patient>0,'patient attackers arrive in the box');
 assert(patient>=mixed,`patient ${patient} vs mixed ${mixed}: no longer a run the style refuses`);
});

// Audit #4: the progression weight scales going forward, not the third-man link.
test('a patient side values a third-man link at least as much as a balanced side, while still valuing depth less',()=>{
 const players=practicePlayers(fixture);
 players.forEach((p,i)=>Object.assign(p,{x:p.side?44:10+i*3,y:p.side?12:-5+i*2,vx:0,vy:0}));
 const carrier=players[2],pivot=players[3],runner=players[4];
 Object.assign(carrier,{x:18,y:0});Object.assign(pivot,{x:21,y:-6});Object.assign(runner,{x:29,y:6});
 const hold=p=>({player:p.id,purpose:'depth',kind:'support',aim:{x:p.x,y:p.y},speed:p.pace,since:0,until:4,reason:''});
 const blocked=(from,to)=>from.x===carrier.x&&to.y>0?.9:0;
 const link=progression=>{const read=attackingSpaceReader(players,carrier,{...fixture.teams[0].tactics,progression},blocked);
  const a=read.read(pivot,hold(pivot),0),b=read.read(runner,hold(runner),0);return {connection:read.connection(a,b),value:b.value};};
 const patient=link('patient'),mixed=link('mixed'),direct=link('direct');
 assert(mixed.connection>0);
 assert(patient.connection>=mixed.connection-1e-12,'patience does not discount the combination');
 assert(direct.connection>=mixed.connection,'direct keeps its own scale');
 assert(patient.value<mixed.value,'a patient side still values the deep reception itself less');
});

// Audit #3: a patient side measures "long" by the lines a pass crosses and
// its risk, not metres, and credits switches and resets that have a purpose.
const keeper={id:'1:gk',side:1,role:'GK',x:47,y:0,vx:0,vy:0,pace:5,acceleration:4};
const defender=(id,x,y,vx=0,vy=0)=>({id:`1:${id}`,side:1,role:'CB',x,y,vx,vy,pace:6.5,acceleration:5});
const pass=(target,aim,risk,flight)=>({kind:'pass',target,aim,score:.5,pass:{risk,flight},delivery:{connectionGain:0}});
test('patient play: a switch to a free receiver is not penalised for its length; forcing a pass past defenders is',async()=>{
 const {approachOptions}=await import('../dist/team-approach.js');
 const p={id:'0:c',side:0,x:20,y:-8,vx:0,vy:0,role:'CM',traits:{risk:.5,dribble:.5}};
 const block=[defender('a',26,-8),defender('b',26,-2),defender('c',29,4),defender('d',23,-12)];
 const sideways=pass('0:a',{x:20,y:-2},.05,.45),sw=pass('0:b',{x:21,y:10},.05,1.1),forced=pass('0:e',{x:31,y:-5},.5,.9);
 const pick=options=>approachOptions(p,options,short,[p,keeper,...block]);
 const [a,b]=pick([sideways,sw]);
 assert(b.score>a.score,'an 18 m switch to a free team-mate beats a short sideways pass into the same block');
 const [c,d]=pick([sideways,forced]);
 assert(c.score>d.score,'a contested pass past two defenders is not what a patient side forces');
});

test('patient play credits a reset that takes the pressure off a team-mate',async()=>{
 const {approachOptions}=await import('../dist/team-approach.js');
 const p={id:'0:c',side:0,x:24,y:0,vx:0,vy:0,role:'CM',traits:{risk:.5,dribble:.5}};
 const others=[defender('q',27,7),defender('r',29,-7)];
 const back=pass('0:b',{x:15,y:-4},.05,.8),across=pass('0:a',{x:25,y:6},.15,.45);
 const [r,a]=approachOptions(p,[back,across],short,[p,keeper,defender('p',25.5,0,-2),...others]);
 assert(r.score>a.score,'under pressure, the free team-mate behind is the patient ball');
 const [r2,a2]=approachOptions(p,[back,across],short,[p,keeper,defender('p',36,0),...others]);
 assert(a2.score>r2.score,'without pressure, going backward earns nothing');
});

// Audit #5: close support can stand between the lines, on a forward diagonal.
test('a combining side offers close support on a forward diagonal, as support rather than a run',async()=>{
 const {shortSupportPoints}=await import('../dist/practice-support.js');
 const players=practicePlayers(fixture),owner={...players[2],x:20,y:0},mate={...players[3],x:18,y:6};
 const ahead=points=>points.filter(v=>v.x-owner.x>=4);
 assert.equal(ahead(shortSupportPoints(mate,owner)).length,0,'ordinary support stays level or behind');
 const forward=ahead(shortSupportPoints(mate,owner,true));
 assert(forward.some(v=>Math.abs(v.x-25)<1e-9)&&forward.some(v=>Math.abs(v.x-27)<1e-9),'5 and 7 m ahead');
 assert(forward.every(v=>Math.abs(v.y-owner.y)>=5),'on a diagonal, off the ball\'s line');
 // In play: a Short side's outlets use them.
 let between=0;
 for(const x of [16,20,24])for(const y of [-6,0,6]){
  const f=structuredClone(fixture),ps=practicePlayers(f);
  // A pressing defender beside the ball, the back line 13 m ahead of it.
  place(ps,[[3,0],[x-9,-5],[x,y],[x+1,y>0?y-8:y+8],[x+10,-y],[46,0],[x+2,y>0?y+2:y-2],[x+13,-6],[x+13,6],[x+16,0]]);
  const o=ps[2],tactics=f.teams.map((t,i)=>({...t.tactics,...(i===0?short:{})}));
  const plan=coordinateFootball(ps,{...o,z:0,vz:0,mode:'control',owner:o.id},0,tactics,laneRisk,{time:10,recoveredAt:-10});
  for(const p of ps.filter(p=>p.side===0&&p.id!==o.id)){const j=plan.jobs[p.id];if(j?.purpose==='outlet'&&j.kind==='support'&&j.aim.x-o.x>=4&&Math.hypot(j.aim.x-p.x,j.aim.y-p.y)>1)between++;}
 }
 assert(between>0,'at least one team-mate moves to support between the lines');
});
