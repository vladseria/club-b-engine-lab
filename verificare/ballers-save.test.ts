// Ballers: saved tactics reach the match. The fixture is Miau's side as the
// REAL freeze wrote it after replaying the Lab and Match prep door calls the
// real pages sent (verificare/ballers-save-browser.mjs, rolled back). Here the
// frozen side goes through the official compute path's own readers
// (sidePlans, the engine's substitution validation) so nothing saved is
// dropped between prep and the pitch. Plus the small rules behind the fixes:
// an idea's emphasis is where its match accent starts, and a save that never
// reached the club says so.
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {sidePlans,type FrozenSide} from '../lib/ballers/simulation';
import {subsProblem,type PrepOrder} from '../lib/ballers/subs';
import {ideaAccent} from '../lib/ballers/ideas';
import {refusal} from '../lib/ballers/league';

const fx=JSON.parse(readFileSync(new URL('./fixtures/ballers-save-frozen.json',import.meta.url),'utf8')) as {
 saved:{formation:string;style:string;approach:Record<string,unknown>;captain:string;lineup:string[];accents:Record<string,number>;emphasis:Record<string,number>;assign:Record<string,Record<string,string>>;subs:string[]};
 frozen:FrozenSide;squad:{id:string;roles:string[]}[]};
const side=fx.frozen;

describe('what was saved is what the players carry',()=>{
 it('style, approach, formation, captain and the five are frozen exactly as saved',()=>{
  expect(side.formation).toBe(fx.saved.formation);
  expect(side.style).toBe(fx.saved.style);
  expect(side.approach).toEqual(fx.saved.approach);
  expect(side.captain).toBe(fx.saved.captain);
  expect(side.lineup).toEqual(fx.saved.lineup);
 });
 it('each idea: its plan (with the Lab emphasis), its accent and its stand-in',()=>{
  expect(side.plans.map(p=>p.key)).toEqual(Object.keys(fx.saved.accents));
  for(const p of side.plans){
   expect(p.accent).toBe(fx.saved.accents[p.key]);
   expect((p.plan as {emphasis?:number}).emphasis).toBe(fx.saved.emphasis[p.key]);
   expect(p.assign??{}).toEqual(fx.saved.assign[p.key]??{});
  }
 });
 it('the compute path takes every idea (none dropped), at the prep accent',()=>{
  const {plans,dropped}=sidePlans(side);
  expect(dropped).toEqual([]);
  expect(plans.map(p=>p.id)).toEqual(Object.keys(fx.saved.accents));
  expect(plans.map(p=>p.emphasis)).toEqual(Object.values(fx.saved.accents).map(a=>a/100));
 });
 it('the substitution orders are frozen in order and the engine accepts them',()=>{
  const orders=side.substitutions as PrepOrder[];
  expect(orders.map(o=>o.trigger.kind)).toEqual(fx.saved.subs);
  expect(subsProblem(orders,fx.squad,side.lineup)).toBeNull();
 });
});

describe('an idea’s emphasis is where its match accent starts',()=>{
 it('uses the saved emphasis (0-1) as 0-100',()=>{
  expect(ideaAccent({plan:{emphasis:.4}})).toBe(40);
  expect(ideaAccent({plan:{emphasis:0}})).toBe(0);
  expect(ideaAccent({plan:{emphasis:.855}})).toBe(86);
 });
 it('full when the idea has none or a broken one',()=>{
  expect(ideaAccent({plan:{}})).toBe(100);
  expect(ideaAccent({plan:{emphasis:'x'}})).toBe(100);
  expect(ideaAccent({plan:{emphasis:2}})).toBe(100);
  expect(ideaAccent({plan:null})).toBe(100);
 });
});

describe('a save that didn’t land says so',()=>{
 it('no connection is named, never a success',()=>{
  expect(refusal(new Error('TypeError: Failed to fetch'))).toBe('No connection, so nothing changed. Try again.');
  expect(refusal({message:'TypeError: Load failed'})).toMatch(/No connection/);
 });
 it('every refusal the save doors raise has its own words',()=>{
  for(const code of ['locked','invalid_emphasis','invalid_ideas','max_3_ideas','max_12_ideas','invalid_accents','invalid_substitutions','invalid_idea_lineups','invalid_captain','invalid_lineup','invalid_tactics','invalid_approach','invalid_prep','invalid_style','invalid_style_name','max_12_styles','unknown_round','no_club'])
   expect(refusal({message:code}),code).not.toBe('That didn’t go through. Try again.');
 });
});
