// (shot decision, 2026-10-15) Owner: "what's the chance" is a skill, "do I take it" is a personality; "I don't want
// players to pass every time in positions where they have a decent chance to score". The read of the chance is the
// shooter's skill alone (practice-shot-contest shotRead); his temperament acts on the choice (shotTemper).
// Units: the read is the engine's chance value (assessShot's scale), not a probability. Measured goal rates by read
// (evidence/2026-10-04-luck-study): about 0.45 converts ~15%, about 0.8 converts ~50%.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,practiceOptions} from '../dist/practice.js';
import {viableOptions} from '../dist/practice-carry.js';
import {actionWeights} from '../dist/practice-selection.js';
import {shotRead,HURRY_COST} from '../dist/practice-shot-contest.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const temperaments={composed:{risk:.45,audacity:0,discipline:.97},nervous:{risk:.1,audacity:0,discipline:.45},daring:{risk:.9,audacity:.8,discipline:.83}};
// Team 0 attacks x = 48; the shooter is index 2 (reading 7, finishing 6).
const decide=(at,traits)=>{
 const players=practicePlayers(structuredClone(fixture));
 players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0,energy:90,angle:p.side?Math.PI:0}));
 const p=players[2];Object.assign(p.skills,{reading:7,finishing:6});Object.assign(p.traits,traits);
 const options=practiceOptions(p,players,new Set(),'',0,null,40),weights=actionWeights(viableOptions(options));
 const total=weights.reduce((s,w)=>s+w.weight,0),share=kind=>weights.filter(w=>w.option.kind===kind).reduce((s,w)=>s+w.weight,0)/total;
 return {read:options.find(o=>o.kind==='shoot')?.quality,shoot:share('shoot'),pass:share('pass')+share('through'),top:weights.sort((a,b)=>b.weight-a.weight)[0].option,mate:players[1].id};
};
const others=(sx,dx=-2,dy=-5)=>[[sx+dx,dy],[sx-3,6],[24,-3],[18,4]];

test('a real ~0.5 chance is taken by a composed, a nervous and a daring player alike',()=>{
 const scenes={
  // 8 m out, central, free (read ~0.76)
  free:[[4,0],[28,-9],[40,1],[27,9],[20,0],[46.6,0],...others(40)],
  // 6 m out, a man 1.5 m beside him rushing the shot (hurry ~0.55, read ~0.7)
  pressed:[[4,0],[28,-9],[42,1],[27,9],[20,0],[46.6,0],[42,2.5],[39,6],[24,-3],[18,4]],
 };
 for(const [scene,at] of Object.entries(scenes)){
  const reads=new Set();
  for(const [name,traits] of Object.entries(temperaments)){
   const d=decide(at,traits);reads.add(d.read);
   assert.ok(d.read>.55,`${scene}: a decent chance (${d.read})`);
   assert.ok(d.shoot>.9,`${scene}: the ${name} player shoots (P ${d.shoot.toFixed(2)})`);
  }
  // Free, the same skills read the same chance whatever the temperament. Pressed, composure is part of his poise
 // (how much of the press reaches the strike, shotContest), so the chance itself differs a little.
  if(scene==='free')assert.equal(reads.size,1,'the same skills read the same chance, whatever the temperament');
 }
});

test('a thin ~0.15 chance: the daring player shoots, the composed one passes to a team-mate with a clearly better chance',()=>{
 // 12 m out (read ~0.47); a free team-mate 8 m out, nearer the goal.
 const at=[[4,0],[40,-3],[36,1],[27,9],[20,0],[46.6,0],...others(36)];
 const daring=decide(at,temperaments.daring),composed=decide(at,temperaments.composed);
 assert.equal(daring.read,composed.read,'the same read');
 assert.ok(daring.read>.35&&daring.read<.55,`a thin chance (${daring.read})`);
 assert.ok(daring.shoot>.5,`the daring player backs himself (P ${daring.shoot.toFixed(2)})`);
 assert.ok(composed.shoot<.05,`the composed one does not shoot (P ${composed.shoot.toFixed(2)})`);
 assert.ok(['pass','through'].includes(composed.top.kind)&&composed.top.target===composed.mate,`he lays it on to the better-placed man (${composed.top.kind} to ${composed.top.target})`);
});

test('a good reader reads his chance closer to the true one than a poor reader',()=>{
 const shooter=(reading,finishing)=>({id:'0:s',side:0,skills:{reading,finishing},traits:{risk:.45,discipline:.83}});
 const error=p=>{let s=0,n=0;
  for(let x=34;x<=44;x+=1)for(let y=-6;y<=6;y+=1.5)for(let t=0;t<30;t+=3.7)for(const hurry of [0,.4,.8]){
   const open=.6,truth=open*(1-HURRY_COST*hurry);s+=Math.abs(shotRead({...p,x,y},open,hurry,{x,y},t)-truth)/truth;n++;}
  return s/n;};
 const good=error(shooter(9,8)),poor=error(shooter(3,3));
 assert.ok(good<poor*.5,`good ${good.toFixed(3)} v poor ${poor.toFixed(3)} (mean relative error)`);
});
