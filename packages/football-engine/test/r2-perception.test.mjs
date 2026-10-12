// R2 (engine truthfulness review round, 2026-10-01): players read the game
// individually and imperfectly. The perception layer turns an exact visible
// read into what THIS player makes of it: noise by skill, bias by temperament,
// deterministic and consuming no shared random stream.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acuity,misread,daring,composure,nerve,readNoise,perceive} from '../dist/practice-perception.js';
import {practicePlayers,practiceOptions} from '../dist/practice.js';
import {feltPressure} from '../dist/practice-possession.js';
import {lossDanger,lossRead,LOSS_SCALE} from '../dist/practice-rest-defence.js';
import {receiverProspects} from '../dist/practice-passing.js';
import {patientPurpose,readBlock} from '../dist/team-approach.js';
import {counterPressRead} from '../dist/practice-coordination.js';
import {keeperRead} from '../dist/practice-keeper.js';
import {blockPulls} from '../dist/practice-shape.js';
import {readTransition} from '../dist/practice-transition.js';
import {carryPace,CARRY_OPEN,CARRY_CLOSE} from '../dist/practice-control.js';

const player=(id,{reading=7,passing=6,finishing=5,control=6,keeping=1,defending=5,risk=.45,dribble=.3,discipline=.83,engagement=.55,audacity}={})=>
 ({id,skills:{reading,passing,finishing,control,keeping,defending},traits:{risk,dribble,discipline,engagement,...(audacity!==undefined?{audacity}:{})}});

test('the same player, read and situation always give the same read; no shared random stream',()=>{
 const p=player('0:a');
 const before=Math.random;let draws=0;Math.random=()=>{draws++;return before();};
 try{
  const a=perceive(p,'arrival',1.2,.4,{x:30,y:4},{salt:'q',time:61.3}),b=perceive(p,'arrival',1.2,.4,{x:30,y:4},{salt:'q',time:61.3});
  assert.equal(a,b);assert.equal(draws,0);
 }finally{Math.random=before;}
 // Another player, or another thing read, misreads it differently.
 const n=[readNoise(p,'arrival',{x:30,y:4},61.3,'q'),readNoise(player('0:b'),'arrival',{x:30,y:4},61.3,'q'),readNoise(p,'arrival',{x:30,y:4},61.3,'r')];
 assert.ok(new Set(n).size===3);
});

test('the noise has unit spread, no bias, and a misread persists over a short step',()=>{
 let s=0,s2=0,n=0,jump=0;
 for(let k=0;k<60;k++){const p=player(`1:${k}`);
  for(let i=0;i<60;i++){const at={x:(i*7.3)%48,y:(i*3.1)%30-15},v=readNoise(p,'lane',at,i*2.1);s+=v;s2+=v*v;n++;
   jump+=Math.abs(readNoise(p,'lane',{x:at.x+.2,y:at.y},i*2.1+.05)-v);}
 }
 const mean=s/n,sd=Math.sqrt(s2/n-mean*mean);
 assert.ok(Math.abs(mean)<.08,`mean ${mean}`);assert.ok(sd>.85&&sd<1.15,`sd ${sd}`);
 assert.ok(jump/n<.12,`a 0.2 m, 0.05 s step moved the read by ${jump/n} on average`);
});

test('top readers are nearly exact, poor readers clearly worse; each read uses its own skills',()=>{
 const sharp=player('0:s',{reading:10,passing:10}),good=player('0:g',{reading:7,passing:7}),poor=player('0:p',{reading:3,passing:3});
 assert.ok(misread(sharp,'arrival')<=.06);
 assert.ok(misread(good,'arrival')>.3&&misread(good,'arrival')<.4);
 assert.ok(misread(poor,'arrival')>.6);
 const errors=p=>{let e=0;for(let i=0;i<400;i++)e+=Math.abs(perceive(p,'arrival',1,.5,{x:i*.9%48,y:(i*1.7)%30-15},{time:i*.8,salt:'x'})-1);return e/400;};
 assert.ok(errors(sharp)<errors(good)&&errors(good)<errors(poor));
 // A keeper's read leans on keeping; a pass read on passing; a shot read on finishing.
 assert.ok(acuity(player('0:k',{keeping:9,reading:6}),'keeper')>acuity(player('0:k2',{keeping:3,reading:6}),'keeper'));
 assert.ok(acuity(player('0:f',{finishing:9}),'shot')>acuity(player('0:f2',{finishing:3}),'shot'));
 assert.ok(acuity(player('0:c',{control:9,dribble:.8}),'carry')>acuity(player('0:c2',{control:4,dribble:.1}),'carry'));
});

test('audacity is read: daring players are optimistic, composed ones feel pressure less',()=>{
 assert.ok(Math.abs(daring(player('0:t',{risk:.45})))<.01,'a typical player is not biased');
 assert.ok(daring(player('0:a',{risk:.45,audacity:.8}))>daring(player('0:b',{risk:.45})));
 assert.ok(daring(player('0:c',{risk:.9}))>0&&daring(player('0:d',{risk:.1}))<0);
 assert.ok(Math.abs(nerve(player('0:t',{risk:.45,discipline:.83,reading:7}))-1)<.06,'a typical player feels pressure as it is');
 const nervous=player('0:n',{risk:.1,discipline:.5,reading:4}),cool=player('0:m',{risk:.8,audacity:.6,discipline:.95,reading:9});
 assert.ok(nerve(nervous)>1.1&&nerve(cool)<.85);
 assert.ok(composure(cool)>composure(nervous));
});

// ---- routed reads: passing (#18 receiver prospects, #12 patient purpose)
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const scene=()=>{const players=practicePlayers(structuredClone(fixture));
 [[4,0],[12,0],[20,0],[26,9],[26,-9],[46,0],[34.5,-9],[40,9],[43,0],[18,-1]].forEach(([x,y],i)=>Object.assign(players[i],{x,y,vx:0,vy:0}));
 return players;};
const as=(p,skills,traits={})=>({...p,skills:{...p.skills,...skills},traits:{...p.traits,...traits}});

test('receiver prospects are the passer\'s read: a sharp reader is nearly exact, a poor one is off, a daring one optimistic',()=>{
 const players=scene(),q=players[3],carrier=players[2];
 const err=reader=>{let e=0,n=0;for(let x=22;x<=38;x+=2)for(let y=-10;y<=10;y+=4){const aim={x,y};e+=Math.abs(receiverProspects(q,aim,players,.6,reader).time-receiverProspects(q,aim,players,.6).time);n++;}return e/n;};
 const sharp=as(carrier,{reading:10,passing:10}),poor=as(carrier,{reading:3,passing:3});
 assert.ok(err(sharp)<.02,`sharp ${err(sharp)}`);assert.ok(err(poor)>2*err(sharp)+.03,`poor ${err(poor)}`);
 // Same situation, same reading, opposite temperaments: the daring passer sees more time.
 const mean=reader=>{let s=0,n=0;for(let x=22;x<=38;x+=2)for(let y=-10;y<=10;y+=4){s+=receiverProspects(q,{x,y},players,.3,reader).time;n++;}return s/n;};
 assert.ok(mean(as(carrier,{reading:7,passing:7},{risk:.9,audacity:.8}))>mean(as(carrier,{reading:7,passing:7},{risk:.1})));
});

test('a patient passer reads the lane and the receiver\'s room by his own eye',()=>{
 const players=scene(),carrier=players[2];
 const read=reader=>{const block=readBlock(reader,players);const out=[];
  for(let x=24;x<=36;x+=3)for(let y=-10;y<=10;y+=5)out.push(patientPurpose(reader,{kind:'pass',target:players[3].id,aim:{x,y},score:0,pass:{risk:.2,flight:.8}},block).open);return out;};
 const exact=read({...carrier,skills:undefined}),sharp=read(as(carrier,{reading:10,passing:10})),poor=read(as(carrier,{reading:3,passing:3}));
 const dev=a=>a.reduce((s,v,i)=>s+Math.abs(v-exact[i]),0)/a.length;
 assert.ok(dev(sharp)<dev(poor),`sharp ${dev(sharp)} poor ${dev(poor)}`);
 assert.ok(dev(poor)>.03,`poor ${dev(poor)}`);
});

// ---- routed reads: running (#26 break-run race, #27 carrying into open ground)
test('a break run is the runner\'s own race: sharp readers read it nearly exactly, daring ones believe in it more',()=>{
 const base=practicePlayers(structuredClone(fixture));
 const scene=(reading,traits={})=>{const ps=structuredClone(base);
  [[4,0],[12,0],[18,-8],[18,8],[21,0],[46,0],[26,-4],[24,6],[16,2],[14,-3]].forEach(([x,y],i)=>Object.assign(ps[i],{x,y,vx:0,vy:0}));
  for(const i of [2,3,4]){Object.assign(ps[i].skills,{reading});Object.assign(ps[i].traits,traits);}
  return ps;};
 const adv=(ps,t)=>readTransition(ps,ps[1],{...fixture.teams[0].tactics,transition:'counter'},.5,[],t).lanes.map(l=>l.advantage);
 const spread=(reading,traits)=>{const all=[];for(let t=0;t<12;t+=1.1)all.push(...adv(scene(reading,traits),t));return all;};
 const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length);};
 const top=spread(10),poor=spread(3);
 assert.ok(top.length&&poor.length);
 assert.ok(sd(poor)>sd(top)+.02,`a poor reader's race read wanders (${sd(poor)} vs ${sd(top)})`);
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 assert.ok(mean(spread(10,{risk:.95,audacity:.9}))>mean(spread(10,{risk:.05})),'the daring runner believes in the race more');
});
test('knocking it on into open ground is the carrier\'s read: a confident carrier goes sooner than an unsure one',()=>{
 const carrier=(id,control,dribble,reading)=>({id,side:0,x:20,y:0,pace:7,skills:{control,reading},traits:{dribble}});
 const pace=p=>{let s=0,n=0;for(let x=4;x<=36;x+=2.3)for(let gap=3;gap<=8;gap+=.5)for(let y=-12;y<=12;y+=3.1){s+=carryPace({...p,x,y},{x:x+8,y},[{x:x+gap,y}]);n++;}return s/n;};
 const sure=carrier('0:s',9,.8,8),unsure=carrier('0:u',3,.05,4);
 assert.ok(pace(sure)>pace(unsure)+.1,`${pace(sure)} vs ${pace(unsure)}`);
 // Nobody ahead: open ground for everyone.
 assert.equal(carryPace(unsure,{x:28,y:0},[]),7*CARRY_OPEN);
 assert.equal(carryPace(sure,{x:28,y:0},[{x:20.5,y:0}]),7*CARRY_CLOSE,'a man at his feet: close control for everyone');
});

// ---- routed reads: pressure (shot or release)
test('under the same pressure a daring or composed shooter shoots more; a nervous one releases',()=>{
 const shotScore=traits=>{let s=0,n=0;
  for(let k=0;k<12;k++){const players=practicePlayers(structuredClone(fixture));
   // Team 0's striker 9 m out, a defender 1.5 m away; team-mates to pass to.
   [[4,0],[20,-6],[26,8],[30,-9],[38,1+k*.2],[46,0],[36,4],[39.5,2],[28,-2],[30,6]].forEach(([x,y],i)=>Object.assign(players[i],{x,y,vx:0,vy:0}));
   const p=players[4];Object.assign(p.skills,{reading:7,finishing:6});Object.assign(p.traits,traits);
   const shot=practiceOptions(p,players,new Set(),'',0,null,40+k).find(o=>o.kind==='shoot');s+=shot.score;n++;}
  return s/n;};
 const cool=shotScore({risk:.8,audacity:.7,discipline:.95}),typical=shotScore({risk:.45,discipline:.83}),nervous=shotScore({risk:.1,discipline:.45});
 assert.ok(cool>typical&&typical>nervous,`${cool} ${typical} ${nervous}`);
 assert.ok(feltPressure({...player('0:n',{risk:.1,discipline:.45,reading:4}),x:30,y:2},.6)>feltPressure({...player('0:c',{risk:.8,audacity:.7,discipline:.95,reading:9}),x:30,y:2},.6));
 assert.equal(feltPressure({...player('0:x'),x:30,y:2},0),0,'no pressure is never felt as pressure');
});

// ---- the loss price (#20, #22): authored football, read by each player
test('the loss price is authored from football benchmarks and read by each player',()=>{
 const g=(m,k)=>lossDanger(m/48,k);
 assert.ok(Math.abs(g(6,0)*LOSS_SCALE-.434)<.03,'own third keeps the old positional scale');
 assert.ok(g(40,0)>.025&&g(40,0)<.045,`a balanced high loss is worth ~2-4% of a goal (${g(40,0)})`);
 assert.ok(g(40,3)>.1&&g(40,3)<.18,`three of four caught ahead high up: 0.10-0.18 (${g(40,3)})`);
 assert.ok(g(40,2)/g(40,0)>2.2&&g(40,3)/g(40,0)<4,'imbalanced vs balanced 2-4x');
 assert.ok(g(6,3)/g(6,0)<1.01,'deep in our half the ball is near our goal whoever stands behind it');
 // Read by the player: a daring passer underestimates it; a typical one is not biased.
 const at={x:30,y:3},mean=p=>{let s=0;for(let i=0;i<50;i++)s+=lossRead({...p,x:0,y:0},{x:4+i*.8,y:(i*1.9)%24-12});return s/50;};
 assert.ok(mean(player('0:d',{risk:.9,audacity:.8}))<mean(player('0:t',{risk:.45}))-.15);
 assert.ok(Math.abs(mean(player('0:s',{risk:.45,reading:10}))-1)<.03,'a sharp, typical reader reads it as it is');
 assert.ok(lossRead(player('0:x'),at)>0);
});

// ---- routed reads: defending (#17 block, #29 keeper, #23 counter-press, #30 regroup)
test('the counter-press is the call of the man who would go: reading, engagement and discipline',()=>{
 const grid=(p,margin)=>{let n=0,go=0;for(let x=4;x<44;x+=3)for(let t=0;t<40;t+=3.7){n++;
  // Balanced goes with one man over: ours - theirs = margin + 1.
  if(counterPressRead('balanced',2+margin,1,false,p,{x,y:3},t))go++;}return go/n;};
 const perfect=player('1:p',{reading:10,discipline:1}),poorKeen=player('1:k',{reading:3,discipline:.3,engagement:.95}),reluctant=player('1:r',{reading:7,discipline:.3,engagement:.35});
 assert.equal(grid(perfect,-1),0,'a perfect, disciplined reader never goes a man short');
 assert.equal(grid(perfect,0),1,'and always goes when the numbers are there');
 assert.ok(grid(poorKeen,-1)>.3,`a poor, keen, loose player often goes a man short (${grid(poorKeen,-1)})`);
 assert.ok(grid(reluctant,0)<grid(player('1:t',{reading:7}),0),'a reluctant, loose one waits more than a typical one');
 assert.equal(counterPressRead('regroup',4,1,false,poorKeen,{x:10,y:0},3),false,'Regroup never engages');
});
test('a keeper\'s set position is his own read: a top keeper nearly exact, a poor one off the angle and slower to re-read',()=>{
 const top=player('1:gk',{keeping:10,reading:10}),poor=player('1:gk2',{keeping:4,reading:4});
 const off=k=>{let e=0,n=0;for(let x=30;x<46;x+=2)for(let y=-10;y<=10;y+=2.5){e+=Math.abs(keeperRead(k,{x,y},x*.37+y).offset);n++;}return e/n;};
 assert.ok(off(top)<.03,`top ${off(top)}`);assert.ok(off(poor)>.15,`poor ${off(poor)}`);
 assert.ok(keeperRead(poor,{x:40,y:0},1).reread>keeperRead(top,{x:40,y:0},1).reread);
 assert.ok(keeperRead(poor,{x:40,y:0},1).lead<keeperRead(top,{x:40,y:0},1).lead);
});
test('each defender makes his own read of the man in his zone',()=>{
 // Team 1 defends (goal at x = 48); two attackers of team 0 in its zones.
 const d=(id,x,y,reading)=>({id:`1:${id}`,side:1,role:'FB',x,y,vx:0,vy:0,skills:{reading,defending:reading},traits:{discipline:.83}});
 const a=(id,x,y)=>({id:`0:${id}`,side:0,role:'W',x,y,vx:0,vy:0});
 const pullsFor=reading=>{const out=[];for(let t=0;t<30;t+=1.3){const base=[{p:d('l',36,-6,reading),x:12,y:-6},{p:d('r',36,6,reading),x:12,y:6}];
  const players=[...base.map(b=>b.p),a('x',37,-11),a('y',37,12),a('c',25,0)];
  const pulls=blockPulls(players,1,base,0,{x:25,y:0},23,'standard','0:c',new Set(),t);out.push(pulls['1:l']??0,pulls['1:r']??0);}return out;};
 const exact=(()=>{const base=[{p:{id:'1:l',side:1,role:'FB',x:36,y:-6},x:12,y:-6},{p:{id:'1:r',side:1,role:'FB',x:36,y:6},x:12,y:6}];const players=[...base.map(b=>b.p),a('x',37,-11),a('y',37,12),a('c',25,0)];const p=blockPulls(players,1,base,0,{x:25,y:0},23,'standard','0:c');return [p['1:l'],p['1:r']];})();
 const dev=r=>{const v=pullsFor(r);return v.reduce((s,x,i)=>s+Math.abs(x-exact[i%2]),0)/v.length;};
 assert.ok(dev(10)<.1,`a top reader follows his man by the right amount (${dev(10)})`);
 assert.ok(dev(3)>2*dev(10)+.1,`a poor reader over- or under-reacts (${dev(3)})`);
});
