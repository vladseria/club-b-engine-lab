import test from 'node:test';
import assert from 'node:assert/strict';
import {kickClearsMovingBody} from '../dist/practice-control.js';
import {chooseFootballOption} from '../dist/practice-carry.js';
// Umanoeasy v Directia (13 Oct, official replay at b0174c30), moment B, 201.03: Tramvai's pass back to his keeper
// left 0.36 m from his torso while he stepped into its line, and met his own body 0.07 s later.
test('a pass is not released into the passer\'s own moving body; the same strike from a set body is',()=>{
 const p={x:29.214409655039457,y:-4.337910672743469,vx:-2.314758339527149,vy:-1.083852013112499};
 const ball={x:28.345949928461227,y:-4.856111720524897},v={vx:9.712067264133973,vy:2.1796591638092018};
 assert.equal(kickClearsMovingBody(p,ball,v),false);
 assert.equal(kickClearsMovingBody({...p,vx:0,vy:0},ball,v),true);
 assert.equal(kickClearsMovingBody({...p,vx:-p.vx,vy:-p.vy},ball,v),true,'stepping away from the line is fine');
});
// Moment C, 862.47: Varză held his carry route (0.251) while a better carry read 0.304; a clearance (0.184) entered
// the draw only because the cut-off came from the held route.
test('holding a carry route does not lower the bar for a clearance below the carry he has',()=>{
 const assessment={purpose:'advance',goalGain:2,shotGain:0,passGain:0,escapeGain:0,obstruction:.1,clearance:4,turnCost:0};
 const held={kind:'carry',score:.251,aim:{x:10,y:0},reason:'fixture',continuing:true,carry:assessment};
 const better={kind:'carry',score:.304,aim:{x:10,y:5},reason:'fixture',carry:assessment};
 const clear={kind:'clear',score:.184,aim:{x:30,y:12},reason:'fixture'};
 const plan={aim:held.aim,until:10,purpose:'advance',reason:'fixture'};
 for(let i=0;i<200;i++)assert.equal(chooseFootballOption([held,better,clear],()=>(i+.5)/200,plan,1),held);
 // a pass comparable to the carry he actually has stays a real choice
 const pass={kind:'pass',score:.29,target:'mate',aim:{x:12,y:3},reason:'fixture'};
 const picks=new Set(Array.from({length:200},(_,i)=>chooseFootballOption([held,better,pass],()=>(i+.5)/200,plan,1).kind));
 assert.deepEqual(picks,new Set(['carry','pass']));
});
