import test from 'node:test';
import assert from 'node:assert/strict';
import {actionWeights as optionWeights,chooseAction as selectEligible,actionIntention as intentionKey} from '../dist/practice-selection.js';
import {chooseFootballOption} from '../dist/practice-carry.js';
const option=(kind,score,target,aim={x:10,y:0})=>({kind,score,target,aim,reason:'fixture'});
const chance=(options,key)=>{const weighted=optionWeights(options);return weighted.filter(o=>intentionKey(o.option)===key).reduce((s,o)=>s+o.weight,0)/weighted.reduce((s,o)=>s+o.weight,0);};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('recorded clearance alternatives do not multiply the preference for clearing',()=>{
 const pass=option('pass',.4981174843141815,'keeper'),clear=option('clear',.4795064485461261);
 const baseline=chance([pass,clear],'clear:');
 close(baseline,1/(1+Math.exp((pass.score-clear.score)/.04)));
 close(chance([pass,clear,{...clear,aim:{x:10,y:8}}],'clear:'),baseline);
 close(chance([pass,clear,{...clear,score:clear.score-.02,aim:{x:10,y:-8}}],'clear:'),baseline);
});
test('exact duplicate generation preserves every option probability',()=>{
 const a=option('carry',.5),b=option('clear',.48),c=option('pass',.49,'mate');
 for(const duplicate of[a,b,c])for(const key of['carry:','clear:','deliver:mate'])close(chance([a,b,c],key),chance([a,b,c,structuredClone(duplicate)],key));
});
test('ground and aerial variants to one recipient retain their own selection chances',()=>{
 const pass=option('pass',.5,'mate'),loft=option('loft',.49,'mate'),carry=option('carry',.5);
 close(chance([pass,loft,carry],'deliver:mate'),.5);
 const choices=new Set(Array.from({length:1000},(_,i)=>selectEligible([pass,loft,carry],()=>(i+.5)/1000).kind));
 assert.deepEqual(choices,new Set(['pass','loft','carry']));
});
test('a genuinely better route raises intention value; another recipient is a distinct opportunity',()=>{
 const pass=option('pass',.5,'mate'),carry=option('carry',.5);
 assert.ok(chance([pass,carry,option('loft',.53,'mate')],'deliver:mate')>.5);
 close(chance([pass,carry,option('pass',.5,'other')],'carry:'),1/3);
});
test('manager-adjusted scores still determine preference without modifying execution data',()=>{
 const pass={...option('loft',.52,'mate'),loft:{speed:15,vz:6}},carry=option('carry',.5);
 const before=structuredClone(pass);assert.ok(chance([pass,carry],'deliver:mate')>.5);
 assert.equal(selectEligible([pass,carry],()=>0),pass);assert.deepEqual(pass,before);
});
test('more carry routes do not change willingness to take on the same defender',()=>{
 const carry=option('carry',.5),feint=option('feint',.5,'defender'),pass=option('pass',.5,'mate');
 const before=chance([carry,feint,pass],'feint:defender');
 close(chance([carry,{...carry,aim:{x:10,y:5}},feint,pass],'feint:defender'),before);
 assert.ok(chance([carry,{...feint,score:.54},pass],'feint:defender')>before,'A stronger trait/football score still changes willingness');
});
test('existing viability, carry commitment and the one-draw contract survive selection',()=>{
 const assessment={purpose:'advance',goalGain:4,shotGain:0,passGain:0,escapeGain:0,obstruction:0,clearance:5,turnCost:0};
 const continuing={...option('carry',.5),continuing:true,carry:assessment};
 const route={...option('carry',.52,undefined,{x:10,y:5}),carry:assessment};
 const plan={aim:continuing.aim,until:10,purpose:'advance',reason:'fixture'};let calls=0;
 assert.equal(chooseFootballOption([continuing,route,option('clear',.1)],()=>{calls++;return .99;},plan,1),continuing);
 assert.equal(calls,1);
});
test('the ordinary chooser excludes an inferior action despite many copies',()=>{
 const pass=option('pass',.6,'mate'),bad=option('clear',.4);
 const candidates=[pass,...Array.from({length:100},(_,i)=>({...bad,aim:{x:10,y:i}}))];
 assert.equal(chooseFootballOption(candidates,()=>.999),pass);
});
