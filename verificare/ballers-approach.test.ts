// "On losing it" (onLoss: regroup / balanced / counterpress): stored rows and
// frozen inputs without it read as 'balanced'; the presets (TS and SQL) take
// their value by football identity (Short counter-presses; Balanced, Direct
// and Counter stay Balanced, R1); the screen offers Balanced and Counter-press
// (Regroup retired from the board, 15 Oct) while the SQL validator, stored rows
// and the engine still take all three; and the engine receives it through
// engineApproach, where a missing value plays exactly as an explicit Balanced.
// Striker (style-identity round): four options, Mixed / Drops deep ('link',
// the old "Links play", renamed on screen only) / Pivot / In behind (was Runs in behind); the
// Short preset is width Standard + striker Pivot; TS, SQL and engine agree.
import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {APPROACH_FIELDS,ON_LOSS,PRESETS,engineApproach,onLossOf,sameApproach,withOnLoss,type Approach,type OnLoss,type StoredApproach} from '../lib/ballers/league';
import {computeMatch,engineTeam,type FrozenInput,type FrozenSide} from '../lib/ballers/compute';
import {clubSide,demoSide,frozenSide,scratchSide,tacticsOf} from '../lib/ballers/lab/team';
import {teamApproaches,validateApproach} from '../packages/football-engine/src/team-approach';

const SEVEN={progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'} as const;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

// The newest migration that (re)defines a SQL function: what the database runs.
const MIGRATIONS=new URL('../supabase/migrations/',import.meta.url);
function latestBody(name:string){
 const file=readdirSync(MIGRATIONS).filter(f=>f.endsWith('.sql')).sort().reverse()
  .find(f=>readFileSync(new URL(f,MIGRATIONS),'utf8').includes(`create or replace function ${name}(`));
 expect(file,name).toBeTruthy();
 const src=readFileSync(new URL(file!,MIGRATIONS),'utf8'),start=src.indexOf(`create or replace function ${name}(`);
 const open=src.indexOf('$$',start);return src.slice(open+2,src.indexOf('$$',open+2));
}

describe('On losing it: the data',()=>{
 it('the screen offers Balanced / Counter-press (Regroup is retired), the last row (On winning it is the style\'s since 22 Oct)',()=>{
  const i=APPROACH_FIELDS.findIndex(f=>f.key==='onLoss');
  expect(APPROACH_FIELDS[i].label).toBe('On losing it');
  expect(APPROACH_FIELDS[i].options.map(o=>[o.value,o.label])).toEqual([['balanced','Balanced'],['counterpress','Counter-press']]);
  expect(i).toBe(APPROACH_FIELDS.length-1);
  // the rows are every key but the style's base (Progression, On winning it: styles as identities, slice 1)
  expect(APPROACH_FIELDS.map(f=>f.key).sort()).toEqual(Object.keys(PRESETS.balanced).filter(k=>k!=='progression'&&k!=='transition').sort());
  expect(APPROACH_FIELDS[i].options.map(o=>o.value)).toEqual(ON_LOSS.filter(v=>v!=='regroup'));
 });
 it('each preset loses the ball its own way (B3), and is exactly the engine\'s', ()=>{
  // Change this, PRESETS and the SQL preset together.
  // R1 (2026-10-01): Counter's preset moved from Regroup to Balanced.
  expect(Object.fromEntries(Object.entries(PRESETS).map(([k,v])=>[k,v.onLoss]))).toEqual({balanced:'balanced',combinations:'counterpress',direct:'balanced',counter:'balanced'});
  for(const style of Object.keys(PRESETS) as (keyof typeof PRESETS)[])
   expect(engineApproach(PRESETS[style])).toEqual(teamApproaches[style].settings);
 });
 it('the SQL preset mirror says exactly what PRESETS say',()=>{
  const body=latestBody('private.ballers_preset'),sql:Record<string,unknown>={};
  for(const m of body.matchAll(/when '(\w+)' then '(\{[^']*\})'::jsonb/g))sql[m[1]]=JSON.parse(m[2]);
  expect(sql).toEqual(PRESETS);
 });
 it('the SQL validator admits every value a stored row may hold (Regroup too), and keeps the seven-key form',()=>{
  const body=latestBody('private.ballers_valid_approach');
  const listed=body.match(/p->>'onLoss' in \(([^)]*)\)/)?.[1].split(',').map(s=>s.trim().replace(/'/g,''));
  expect(listed).toEqual([...ON_LOSS]);
  expect(body).toMatch(/case when p \? 'onLoss' then 8 else 7 end/);
 });
 it('a stored approach without the field reads as Balanced; a known value is kept',()=>{
  expect(withOnLoss(SEVEN)).toEqual({...SEVEN,onLoss:'balanced'});
  for(const v of ON_LOSS)expect(withOnLoss({...SEVEN,onLoss:v}).onLoss).toBe(v);
  expect(onLossOf({onLoss:'counter'})).toBe('balanced');expect(onLossOf(null)).toBe('balanced');expect(onLossOf({})).toBe('balanced');
  // The input is never mutated.
  const stored={...SEVEN};withOnLoss(stored);expect(stored).toEqual(SEVEN);
 });
 it('a missing field and an explicit Balanced are the same fine-tune; any other value is not',()=>{
  expect(sameApproach(SEVEN,PRESETS.balanced)).toBe(true);
  expect(sameApproach(PRESETS.balanced,SEVEN)).toBe(true);
  expect(sameApproach(SEVEN,{...PRESETS.balanced,onLoss:'counterpress'})).toBe(false);
  expect(sameApproach({...SEVEN,onLoss:'regroup'},{...PRESETS.balanced,onLoss:'counterpress'})).toBe(false);
 });
});

describe('Striker: four options, and the Short preset plays the Pivot',()=>{
 const STRIKER=[['mixed','Mixed'],['link','Drops deep'],['pivot','Pivot'],['run','In behind']];
 it('the screen offers Mixed / Drops deep / Pivot / In behind (Drops deep is the old Links play: same stored value)',()=>{
  const f=APPROACH_FIELDS.find(x=>x.key==='striker')!;
  expect(f.label).toBe('Striker');
  expect(f.options.map(o=>[o.value,o.label])).toEqual(STRIKER);
 });
 it('the Short preset is width Standard + striker Pivot; everything else in it is unchanged',()=>{
  expect(PRESETS.combinations).toEqual({progression:'patient',width:'standard',line:'high',press:'balanced',commit:3,striker:'pivot',transition:'secure',onLoss:'counterpress'});
  expect(Object.fromEntries(Object.entries(PRESETS).map(([k,v])=>[k,v.striker]))).toEqual({balanced:'mixed',combinations:'pivot',direct:'run',counter:'mixed'});
 });
 it('the SQL validator and the engine admit exactly the values the screen offers',()=>{
  const body=latestBody('private.ballers_valid_approach');
  const listed=body.match(/p->>'striker' in \(([^)]*)\)/)?.[1].split(',').map(s=>s.trim().replace(/'/g,''));
  expect(listed).toEqual(STRIKER.map(([v])=>v));
  for(const [v] of STRIKER)expect(validateApproach({...SEVEN,striker:v}).striker).toBe(v);
  expect(()=>validateApproach({...SEVEN,striker:'target'})).toThrow();
 });
 it('a stored Pivot reaches the engine tactics, in official matches and in the Lab',()=>{
  const pivot={...SEVEN,striker:'pivot'} as const;
  expect(engineApproach(pivot).striker).toBe('pivot');
  expect(tacticsOf('1-2-1',pivot).striker).toBe('pivot');
  expect(engineTeam(frozenSide({id:'c',name:'C',code:'CCC',color:'#FFFFFF'},asPlayers(home),{lineup:home.team.lineup,formation:'1-2-1',style:'combinations',approach:pivot,captain:null})).tactics.striker).toBe('pivot');
 });
});

describe('Styles as identities: the engine is told the style only when the approach plays its base',()=>{
 it('engineTeam and the Lab name it for a fitting approach (Short brings its one-touch), never for a plan still waiting for its pick',()=>{
  const side=(style:keyof typeof PRESETS,approach:StoredApproach)=>engineTeam(frozenSide({id:'c',name:'C',code:'CCC',color:'#FFFFFF'},asPlayers(home),{lineup:home.team.lineup,formation:'1-2-1',style,approach,captain:null})).tactics;
  for(const st of Object.keys(PRESETS) as (keyof typeof PRESETS)[])expect(side(st,PRESETS[st]).style).toBe(st);
  // Short label on mixed + secure (the two AI Short sides): no style, plays exactly as stored
  const waiting=side('combinations',{...PRESETS.combinations,progression:'mixed'});
  expect('style' in waiting).toBe(false);expect(waiting.progression).toBe('mixed');
  // Direct + the surge under a Counter label (six Global plans in the 21 Oct backup): no style
  expect('style' in side('counter',{...PRESETS.counter,progression:'direct'})).toBe(false);
  expect(tacticsOf('1-2-1',PRESETS.combinations,undefined,'combinations').style).toBe('combinations');
  expect('style' in tacticsOf('1-2-1',PRESETS.combinations)).toBe(false);
 });
});

const asPlayers=(side:ReturnType<typeof demoSide>)=>side.team.squad.map((p,i)=>({id:p.id,club_id:side.team.id,space:'test',name:p.name,short:side.players[i].short,number:i+1,roles:p.roles,archetype:'motor' as const,temperament:'cold' as const,note:p.note||'x',skills:p.skills,traits:p.traits,energy:p.energy,portrait:side.players[i].portrait,founder:false}));
const home=demoSide(),away=scratchSide();
function input(homeApproach:typeof SEVEN|Approach,awayOnLoss?:OnLoss,duration=240):FrozenInput{
 const away7={...SEVEN,progression:'direct',width:'wide',press:'aggressive',commit:4,striker:'run'} as const;
 const sides:[FrozenSide,FrozenSide]=[
  frozenSide({id:'home',name:'Home',code:'HOM',color:'#FF3D7F'},asPlayers(home),{lineup:home.team.lineup,formation:'1-2-1',style:'balanced',approach:homeApproach,captain:null}),
  frozenSide({id:'opp',name:'Opp',code:'OPP',color:'#C9CCD2'},asPlayers(away),{lineup:away.team.lineup,formation:'2-1-1',style:'direct',approach:awayOnLoss?{...away7,onLoss:awayOnLoss}:away7,captain:null})];
 return {v:1,match:'on-loss',seed:4242,kickoff:0,duration,sides};
}

describe('On losing it: the engine takes it, and a missing value is Balanced',()=>{
 it('engineApproach passes every key through in its stored order, onLoss included',()=>{
  // Postgres jsonb hands keys back in its own order; that order must survive.
  const stored=JSON.parse('{"line":"deep","press":"selective","width":"standard","commit":3,"onLoss":"counterpress","striker":"mixed","transition":"counter","progression":"mixed"}');
  expect(JSON.stringify(engineApproach(stored))).toBe(JSON.stringify(stored));
  // An input frozen before the field passes through exactly as it was.
  const old=JSON.parse('{"line":"deep","press":"selective","width":"standard","commit":3,"striker":"mixed","transition":"counter","progression":"mixed"}');
  expect(JSON.stringify(engineApproach(old))).toBe(JSON.stringify(old));
  expect(engineApproach({...SEVEN,onLoss:'counter' as never}).onLoss).toBe('balanced');// unknown reads as Balanced
  expect(stored.onLoss).toBe('counterpress');// not mutated
 });
 it('engine tactics carry the stored value; without it they are exactly today\'s',()=>{
  const base=engineTeam(input(SEVEN).sides[0]).tactics;
  expect(Object.keys(base)).not.toContain('onLoss');
  for(const v of ON_LOSS){
   const t=engineTeam(input({...SEVEN,onLoss:v}).sides[0]).tactics;
   expect(t.onLoss).toBe(v);
   const {onLoss:_,...rest}=t;expect(JSON.stringify(rest)).toBe(JSON.stringify(base));
  }
  // The Lab builds its sides the same way.
  const squad=asPlayers(home);
  for(const v of ON_LOSS){
   expect(tacticsOf('1-2-1',{...SEVEN,onLoss:v}).onLoss).toBe(v);
   expect(clubSide({id:'c',name:'C',code:'CCC',color:'#FFFFFF'},squad,home.team.lineup,'1-2-1',{...SEVEN,onLoss:v}).team.tactics.onLoss).toBe(v);
  }
  expect(Object.keys(tacticsOf('1-2-1',SEVEN))).not.toContain('onLoss');
  expect(demoSide().team.tactics.onLoss).toBe('balanced');
 });
 it('a whole match: an old input plays exactly as explicit Balanced; the other values play differently',()=>{
  const ref=hash(computeMatch(input(SEVEN)).compact);
  expect(hash(computeMatch(input({...SEVEN,onLoss:'balanced'},'balanced')).compact)).toBe(ref);
  // (recon 2026-10-16, finding 16) one match changed both sides' values, so either could be inert; each on its own:
  expect(hash(computeMatch(input({...SEVEN,onLoss:'counterpress'})).compact)).not.toBe(ref);
  expect(hash(computeMatch(input(SEVEN,'regroup')).compact)).not.toBe(hash(computeMatch(input(SEVEN,'balanced')).compact));
 },240_000);
});

describe('Fine-tune descriptions',()=>{
 it('every option of every row has one short line, with no numbers (keep the illusion)',()=>{
  for(const f of APPROACH_FIELDS)for(const o of f.options){
   expect(o.line.trim().length,`${f.label} · ${o.label}`).toBeGreaterThan(20);
   expect(o.line.length,`${f.label} · ${o.label}`).toBeLessThanOrEqual(125);
   expect(o.line,`${f.label} · ${o.label}`).not.toMatch(/\d/);
  }
 });
});
