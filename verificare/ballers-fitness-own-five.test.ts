// Fitness on, practice's default opponent (lib/ballers/practice-opponent.ts ownFive; deliverables/ballers-fitness/
// SCREENS.md §6): their last game's five as the lock would play it. A man out of the practised match gives his slot to
// the fill-in rule's man (the slot's role listed first, then anywhere, then shirt number; a keeper only for a keeper),
// never to one who is out himself; nobody out, or the switch off, is the five itself. Plays no match.
import {describe,expect,it} from 'vitest';
import {ownFive} from '../lib/ballers/practice-opponent';
import type {Player} from '../lib/ballers/league';

const man=(id:string,number:number,roles:Player['roles'])=>({id,number,roles});
// 1-2-1: GK, CB, W, W, ST (private.ballers_slot_role)
const squad=[man('gk',1,['GK']),man('cb',2,['CB']),man('w1',7,['W']),man('w2',11,['W','ST']),man('st',9,['ST']),
 man('gk2',12,['GK']),man('cb2',5,['CB','DM']),man('wing',17,['W']),man('fw',19,['ST','W'])];
const last=['gk','cb','w1','w2','st'];

describe('ownFive',()=>{
 it('is their last five with nobody out, or with the switch off',()=>{
  expect(ownFive(last,squad,'1-2-1')).toEqual(last);
  expect(ownFive(last,squad,'1-2-1',()=>false)).toEqual(last);
 });
 it('gives an out man\'s slot to the fill-in rule\'s man, never to one who is out',()=>{
  // the striker out: the man listing ST first (fw) before a winger who lists it second
  expect(ownFive(last,squad,'1-2-1',id=>id==='st')).toEqual(['gk','cb','w1','w2','fw']);
  // the keeper out: the other keeper; a winger out and the first wing pick out too: the next by the rule
  expect(ownFive(last,squad,'1-2-1',id=>id==='gk')).toEqual(['gk2','cb','w1','w2','st']);
  expect(ownFive(last,squad,'1-2-1',id=>id==='w1'||id==='wing')).toEqual(['gk','cb','fw','w2','st']);
 });
 it('keeps a man nobody can replace',()=>{
  expect(ownFive(last,squad,'1-2-1',id=>id==='gk'||id==='gk2')).toEqual(last);
 });
});
