// Practice "Play it again" (owner, 4 Oct): the same setup with a new kick-off, and a
// tally of this setup's runs in the tab (lib/ballers/practice-tally.ts).
import {describe,it,expect} from 'vitest';
import {addRun,outcomeOf,setupKey,totals,totalsText} from '../lib/ballers/practice-tally';
import type {FrozenInput} from '../lib/ballers/compute';

const side=(id:string,formation:'1-2-1'|'2-2'='1-2-1')=>({club:{id,name:id,code:id,color:'#fff'},formation,style:'balanced',approach:{} as never,captain:'a',lineup:['a'],bench:[],players:[],plans:[]});
const input=(seed:number,o:Partial<FrozenInput>={}):FrozenInput=>({v:1,match:`practice-${seed.toString(36)}`,seed,kickoff:0,duration:300,sides:[side('us'),side('them')],...o} as FrozenInput);

describe('practice tally',()=>{
 it('a new kick-off of the same setup keeps its key; any change to the setup does not',()=>{
  expect(setupKey([input(1)])).toBe(setupKey([input(99)]));
  expect(setupKey([input(1)])).not.toBe(setupKey([input(1,{duration:900})]));
  expect(setupKey([input(1)])).not.toBe(setupKey([input(1,{sides:[side('us','2-2'),side('them')]} as Partial<FrozenInput>)]));
  expect(setupKey([input(1)])).not.toBe(setupKey([input(1,{sides:[side('us'),side('other')]} as Partial<FrozenInput>)]));
  expect(setupKey([input(1)])).not.toBe(setupKey([input(1)],'compare'));
 });
 it('adds runs to the same setup and starts afresh for another',()=>{
  let t=addRun(null,'a',[{name:'Home plan',score:{gf:3,ga:1}}]);
  t=addRun(t,'a',[{name:'Home plan',score:{gf:2,ga:2}}]);
  t=addRun(t,'a',[{name:'Home plan',score:{gf:6,ga:6}}]);
  t=addRun(t,'a',[{name:'Home plan',score:{gf:0,ga:4}}]);
  expect(t.rows[0].runs.map(outcomeOf)).toEqual(['W','D','D','L']);
  expect(totalsText(totals(t.rows[0].runs))).toBe('W 1 · D 2 · L 1, goals 11–13');
  const fresh=addRun(t,'b',[{name:'Away plan',score:{gf:1,ga:0}}]);
  expect(fresh.rows).toEqual([{name:'Away plan',runs:[{gf:1,ga:0}]}]);
 });
 it('keeps one row per version played',()=>{
  let t=addRun(null,'a',[{name:'Home plan',score:{gf:1,ga:0}},{name:'Direct, as it comes',score:{gf:0,ga:0}}]);
  t=addRun(t,'a',[{name:'Home plan',score:{gf:1,ga:2}},{name:'Direct, as it comes',score:{gf:3,ga:0}}]);
  expect(t.rows.map(r=>totalsText(totals(r.runs)))).toEqual(['W 1 · D 0 · L 1, goals 2–2','W 1 · D 1 · L 0, goals 3–0']);
 });
});
