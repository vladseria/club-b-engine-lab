import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {aerialContact,aerialBand} from '../dist/practice-aerial.js';
import {resolveAirDuel,attacksTheBall,jumpReach} from '../dist/practice-air-duel.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
// Contests in the air (2026-10-15): two men under a ball coming down, both sides. A seeded stream, not Math.random.
const stream=(seed=7)=>()=>((seed=Math.imul(seed^seed>>>15,2246822507)+0x9e3779b9>>>0)/4294967296);
const pair=(defender={},attacker={})=>{
 const all=practicePlayers(fixture),d=all.find(p=>p.side===1&&p.role!=='GK'),a=all.find(p=>p.side===0&&p.role!=='GK');
 for(const p of [d,a])Object.assign(p.skills,{aerial:6,strength:6,pace:6,reading:6,defending:6,control:6}),Object.assign(p.traits,{engagement:.55,risk:.45,audacity:0,discipline:.85,frustration:0});
 Object.assign(d.skills,defender.skills??{});Object.assign(d.traits,defender.traits??{});Object.assign(a.skills,attacker.skills??{});Object.assign(a.traits,attacker.traits??{});
 // a ball played towards side 1's goal (x = 48), dropping on the attacker; the defender a step goal-side of him
 Object.assign(a,{x:30,y:0,vx:0,vy:0,angle:Math.PI});Object.assign(d,{x:30.7,y:.2,vx:0,vy:0,angle:Math.PI});
 return {d,a};
};
const ball={x:30.15,y:0,z:1.9,vx:11,vy:0,vz:-6};
const share=(d,a,n=3000)=>{const r=stream();let won=0,fouls=0;
 for(let i=0;i<n;i++){const x=resolveAirDuel({p:a,body:a,velocity:{x:0,y:0},first:true},{p:d,body:d,velocity:{x:0,y:0},first:false},ball,0,()=>0,r);
  if(x.outcome==='foul')fouls++;else if(x.winner===d)won++;}
 return {won:won/n,fouls:fouls/n};};

test('a header can be met with a jump, higher for a man good in the air',()=>{
 const {a}=pair();a.skills.aerial=9;const high=aerialBand(a,'header').max;a.skills.aerial=3;const low=aerialBand(a,'header').max;
 assert(high>low&&low>1.95,'the jump adds to standing height and grows with aerial');
 // a ball coming at his face at 2.3 m: within a good header's jump, above a man who cannot jump
 const good={...a,angle:0,skills:{...a.skills,aerial:9}},poor={...good,skills:{...good.skills,aerial:0}};
 const before={x:a.x+.65,y:0,z:2.3,vx:-10,vy:0,vz:0},after={...before,x:a.x+.15};
 assert.notEqual(aerialContact(good,good,before,after,'header',.4),null);
 assert.equal(aerialContact(poor,poor,before,after,'header',.4),null);
 assert(jumpReach({skills:{aerial:10}})<.7,'a jump, not a ladder');
});

test('the contest is decided by the men in it: in the air, strength, nerve',()=>{
 const even=share(...Object.values(pair())).won;
 const strong=share(...Object.values(pair({skills:{aerial:9,strength:9}}))).won;
 const weak=share(...Object.values(pair({skills:{aerial:3,strength:3}}))).won;
 assert(strong>even+.1&&even>weak+.1,`a good header of the ball wins more (${weak.toFixed(2)} / ${even.toFixed(2)} / ${strong.toFixed(2)})`);
 assert(even>.15&&even<.85,'two equal men: neither wins it by construction');
 const brave=share(...Object.values(pair({traits:{engagement:.95,risk:.9,audacity:.8}})));
 const hesitant=share(...Object.values(pair({traits:{engagement:.1,risk:.1,audacity:0}})));
 assert(brave.won>hesitant.won+.1,'the brave man attacks it; the hesitant one waits for the drop and is beaten to it');
 assert(brave.fouls>hesitant.fouls,'attacking it has a price: more fouls');
});

test('a defender attacks the ball when he reads he can win it; a poor or hesitant one holds',()=>{
 const sharp={reading:10};
 const go=(d)=>{const {d:q,a}=pair(d);return attacksTheBall(q,a,{x:30,y:0},10,true);};
 assert(go({skills:{...sharp}})>0,'an ordinary defender goal-side of his man goes up with him');
 assert(go({skills:{...sharp,aerial:3,strength:3}})<0,'a poor header of the ball holds goal-side');
 assert(go({skills:{...sharp},traits:{engagement:.1,risk:.1}})<0,'a hesitant one holds');
 assert(go({skills:{...sharp,aerial:3,strength:3},traits:{engagement:.95,risk:.9,audacity:.8}})>0,'a brave one goes even so');
});
