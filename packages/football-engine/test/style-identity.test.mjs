// (styles as identities, slice 1, 2026-10-22) A style is its base (Progression + On winning it, which the manager can't
// take apart) and its trait (Short's one-touch). A side that names its style must play that base; a side that names
// none plays as stored with no trait. Plays no match: every refusal happens at the entrance, and the accepted inputs
// are only built.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSimulationRequest,runMatch,teamApproaches,validateTacticsSwitches} from '../dist/index.js';
import {STYLE,styleBaseProblem} from '../dist/style.js';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
const STYLES=['balanced','combinations','direct','counter'];
const PAIRS=['patient','mixed','direct'].flatMap(progression=>['balanced','secure','counter'].map(transition=>({progression,transition})));
const named=(side,style,pair)=>{const f=structuredClone(fixture);Object.assign(f.teams[side].tactics,{style,...pair});return f;};

test('the four bases: distinct pairs, equal to the presets the app owns, and only Short carries a trait',()=>{
 assert.deepEqual(Object.keys(STYLE),STYLES);
 const pairs=STYLES.map(s=>`${STYLE[s].progression.v}+${STYLE[s].transition.v}`);
 assert.equal(new Set(pairs).size,4);
 for(const s of STYLES){
  assert.equal(STYLE[s].progression.v,teamApproaches[s].settings.progression,s);
  assert.equal(STYLE[s].transition.v,teamApproaches[s].settings.transition,s);
 }
 for(const s of ['balanced','direct','counter']){assert.equal(STYLE[s].touchPrice.v,0);assert.equal(STYLE[s].strikeSpeed.v,0);}
 assert.equal(STYLE.combinations.touchPrice.v,.17);
 assert.equal(STYLE.combinations.strikeSpeed.v,4);
});

test('a side that names its style plays its base: every other pair is refused at the entrance, naming side, style and pair',()=>{
 for(const style of STYLES)for(const pair of PAIRS)for(const [side,name] of [[0,'home'],[1,'away']]){
  const base=STYLE[style],fits=pair.progression===base.progression.v&&pair.transition===base.transition.v;
  const f=named(side,style,pair);
  if(fits){assert.doesNotThrow(()=>createSimulationRequest({kind:'match',fixture:f,durationSeconds:20}));continue;}
  const message=`Invalid tactics: ${name}.style ${style} plays progression ${base.progression.v} and transition ${base.transition.v} (got ${pair.progression}, ${pair.transition})`;
  assert.throws(()=>createSimulationRequest({kind:'match',fixture:f,durationSeconds:20}),{message});
  assert.throws(()=>runMatch({fixture:f,durationSeconds:20}),{message});
 }
 // a missing transition reads balanced: Direct needs none
 const f=structuredClone(fixture);f.teams[1].tactics.style='direct';
 assert.equal('transition' in f.teams[1].tactics,false);
 assert.doesNotThrow(()=>createSimulationRequest({kind:'match',fixture:f,durationSeconds:20}));
 const g=structuredClone(fixture);g.teams[0].tactics.style='short';
 assert.throws(()=>createSimulationRequest({kind:'match',fixture:g,durationSeconds:20}),{message:'Invalid tactics: home.style is "short" (expected balanced, combinations, direct, counter)'});
});

test('no style: every pair still runs as stored (old inputs, a plan waiting for its pick)',()=>{
 for(const pair of PAIRS){
  const f=structuredClone(fixture);Object.assign(f.teams[0].tactics,pair);
  assert.equal(styleBaseProblem(f.teams[0].tactics),null);
  const request=createSimulationRequest({kind:'match',fixture:f,durationSeconds:20});
  assert.equal('style' in request.input.fixture.teams[0].tactics,false);
 }
});

test('a change of plan into a named style must carry that style\'s base, whatever its condition (the half-time release\'s \'always\' too)',()=>{
 const f=structuredClone(fixture);
 const to=(style,pair)=>({...f.teams[0].tactics,style,...pair});
 for(const trigger of [{kind:'score',state:'losing'},{kind:'always'}]){
  const sw=tactics=>[{id:'sw1',side:0,trigger,...(trigger.kind==='always'?{notBefore:600}:{}),tactics}];
  const ok=validateTacticsSwitches(sw(to('combinations',{progression:'patient',transition:'secure'})),f)[0];
  assert.equal(ok.tactics.style,'combinations');assert.deepEqual(ok.trigger,trigger);
  assert.throws(()=>validateTacticsSwitches(sw(to('counter',{progression:'direct',transition:'counter'})),f),
   {message:'Invalid switch tactics: style counter plays progression mixed and transition counter (got direct, counter).'});
  assert.doesNotThrow(()=>validateTacticsSwitches(sw({...f.teams[0].tactics,progression:'direct',transition:'counter'}),f));
 }
});
