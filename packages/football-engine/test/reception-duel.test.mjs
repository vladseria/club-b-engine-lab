// Contest round (2026-10-15): the reception duel (src/practice-duel.ts). A defender whose foot can get to a pass
// as it is met contests the touch: he commits (nick it, or be turned) or holds (a hard touch), on his own read
// against the cost of being turned; the receiver's control, strength, body and composure fight for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {duelGeometry,readDuel,resolveDuel,holdOdds,stepInWillingness} from '../dist/practice-duel.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const players=practicePlayers(structuredClone(fixture));
// Team 0 attacks x = 48. A pass from (14, 0) runs along +x to a receiver meeting it at (24, 0).
const man=(side,at,skills={},traits={})=>{const p=structuredClone(players.find(q=>q.side===side&&q.role!=='GK'));
 return Object.assign(p,{x:at[0],y:at[1],vx:0,vy:0,angle:side===0?Math.PI:0,energy:100,skills:{...p.skills,control:6,strength:6,defending:6,reading:7,...skills},traits:{...p.traits,risk:.45,audacity:0,engagement:.55,discipline:.83,...traits}});};
const ball={x:23.4,y:0,vx:9,vy:0},goal={x:48,y:0};
const scene=(defAt,o={})=>{const r=man(0,[24,0],o.r,o.rt),d=man(1,defAt,o.d,o.dt);if(o.closing)d.vx=-o.closing;return {r,d,g:duelGeometry(r,d,ball,goal)};};

test('his body decides access: stepping across from the passer\'s side bites, behind a receiver who screens it barely does',()=>{
 const across=scene([23.4,.75]),behind=scene([24.8,0]);
 assert.ok(across.g.access>.75&&across.g.front>.5&&across.g.screen===0);
 assert.ok(behind.g.screen>.9&&behind.g.goalTight>.8,"a man on his back: no foot to the ball, but tight on him");
 const a=readDuel(across.r,across.d,across.g,0,0,ball,10),b=readDuel(behind.r,behind.d,behind.g,0,0,ball,10);
 assert.ok(a.nick>.3&&b.nick<.05,`across ${a.nick.toFixed(2)} behind ${b.nick.toFixed(2)}`);
 // out of reach there is no duel at all
 assert.equal(scene([26.5,2]).g.access,0);
});

test('good receivers stay good: a strong, composed controller keeps what a weak one loses',()=>{
 const good=scene([23.4,.75],{r:{control:9,strength:8,reading:8},rt:{discipline:.95},d:{defending:5}});
 const weak=scene([23.4,.75],{r:{control:4,strength:4},d:{defending:8,strength:8}});
 const g=readDuel(good.r,good.d,good.g,0,0,ball,10),w=readDuel(weak.r,weak.d,weak.g,0,0,ball,10);
 assert.ok(g.nick<w.nick-.2,`good ${g.nick.toFixed(2)} weak ${w.nick.toFixed(2)}`);
 assert.ok(g.turnChance>w.turnChance);
 const pivotGood=scene([24.8,0],{r:{control:9,strength:8,reading:8},rt:{discipline:.95}}),pivotWeak=scene([24.8,0],{r:{control:4,strength:4}});
 const hg=holdOdds(pivotGood.r,pivotGood.d,pivotGood.g,9),hw=holdOdds(pivotWeak.r,pivotWeak.d,pivotWeak.g,9);
 assert.ok(hg.loose<hw.loose&&hg.forced<hw.forced,'a strong, composed pivot holds his man off and can roll him');
});

test('personality is in the choice: the daring, eager defender commits where the cautious, disciplined one holds',()=>{
 const o={d:{reading:10}};
 const dare=scene([23.9,1],{...o,dt:{risk:.85,audacity:.8,engagement:.9,discipline:.55}}),caut=scene([23.9,1],{...o,dt:{risk:.2,audacity:0,engagement:.25,discipline:.97}});
 // 14 m from goal with nobody behind him: being turned is expensive
 const at=(s)=>readDuel(s.r,s.d,s.g,0,.6,ball,10);
 assert.equal(at(dare).commit,true);assert.equal(at(caut).commit,false);
 assert.ok(stepInWillingness(dare.d,.6,0)>stepInWillingness(caut.d,.6,0)+.3);
 // a commit that misses can turn him; holding never does
 const draws=(...v)=>{let i=0;return ()=>v[i++]??.99;};
 const miss=resolveDuel(dare.r,dare.d,at(dare),9,0,draws(.99,.99,0),ball,10);
 assert.equal(miss.outcome,'turned');
 const held=resolveDuel(caut.r,caut.d,at(caut),9,0,draws(.99,.99,.99,.99),ball,10);
 assert.notEqual(held.outcome,'turned');assert.notEqual(held.outcome,'nicked');
});

test('a forced receiver: the nervous one lays it off first time, the composed one shields',()=>{
 const o={d:{defending:7},r:{reading:9}};
 const forced=(rt)=>{const s=scene([24.6,.1],{...o,rt});const read={...readDuel(s.r,s.d,s.g,0,0,ball,10),commit:false};
  // the hold path's draw lands just past "loose": forced
  const h=holdOdds(s.r,s.d,s.g,9);assert.ok(h.forced>.05);
  return resolveDuel(s.r,s.d,read,9,0,()=>h.loose+.001,ball,10);};
 const nervous=forced({risk:.2,audacity:0,discipline:.4}),calm=forced({risk:.5,audacity:.4,discipline:1});
 assert.equal(nervous.outcome,'forced');assert.equal(calm.outcome,'forced');
 assert.equal(nervous.layoff,true);assert.equal(calm.layoff,false);
});

test('a match records reception duels, each with a defender within reach of the ball',async()=>{
 const {runMatch}=await import('../dist/index.js');
 const run=runMatch({fixture:structuredClone(fixture),durationSeconds:240,record:true});
 const duels=run.result.receptionDuels;
 assert.ok(duels.length>0,'no duel in four minutes');
 for(const d of duels){
  // (keeper fix, 2026-10-19) the engine picks defenders within 2.8 m of the ball's contact point; the record's `at` is
  // the receiver's body, up to about a metre from that point (the passage moved and has a winger 3.13 m from the body,
  // within reach of the ball), so the body-to-defender check allows that metre
  assert.ok(Math.hypot(d.at.x-d.defenderAt.x,d.at.y-d.defenderAt.y)<2.8+1);
  assert.ok(['clean','forced','loose','nicked','turned','foul'].includes(d.outcome));
 }
});
