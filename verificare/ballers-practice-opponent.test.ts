// Practice's opponent (lib/ballers/practice-opponent.ts, owner 24 Oct 2026): their last game's whole setup by
// default, the player's pick of their five otherwise; the likely five by minutes; orders that no longer fit the
// five left out; an answer from the function before migration 20261024150000 played exactly as before.
import {describe,it,expect} from 'vitest';
import {byMinutes,fitOrders,likelyFive,placeFive,theirSide} from '../lib/ballers/practice-opponent';
import {frozenSide} from '../lib/ballers/lab/team';
import type {PracticeSide} from '../lib/ballers/data';
import type {Player} from '../lib/ballers/league';
import type {PrepOrder} from '../lib/ballers/subs';

const man=(id:string,number:number,roles:string[]):Player=>({id,club_id:'them',name:id,short:id,number,roles,skills:{pace:5,passing:5,control:5,finishing:5,defending:5,stamina:5,keeping:roles.includes('GK')?7:1,reading:5,setPieces:5},
 traits:{},energy:100,archetype:'',temperament:'',note:'',portrait:'p01'} as unknown as Player);
// a 1-2-1 side: keeper, centre-back, two wingers, striker; a bench with a second keeper and three outfielders
const squad=[man('gk1',1,['GK']),man('cb1',2,['CB']),man('w1',7,['W']),man('w2',11,['W','ST']),man('st1',9,['ST']),
 man('gk2',12,['GK']),man('cb2',4,['CB','W']),man('st2',10,['ST']),man('am1',8,['AM','W'])];
const club={id:'them',name:'Them',code:'THM',color:'#ff0000'};
const last=['gk1','cb1','w1','w2','st1'];
const approach={progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced',onLoss:'balanced'} as PracticeSide['approach'];
const side=(extra:Partial<PracticeSide>={}):PracticeSide=>({formation:'1-2-1',style:'balanced',approach,lineup:[...last],captain:'w1',source:'last_match',...extra});
const tired=(id:string,inn:string,player:string):PrepOrder=>({id,in:inn,out:player,trigger:{kind:'tired',player,threshold:95}});

describe('likely five',()=>{
 const secs:Record<string,number>={gk2:900,gk1:300,st2:900,am1:900,cb2:600,w1:600,cb1:600,st1:100};
 const seconds=(id:string)=>secs[id]??0;
 it('is the keeper with the most minutes and the four outfielders with the most, ties by shirt number',()=>{
  // outfield: am1 (8) and st2 (10) on 900; then cb2 (4), cb1 (2), w1 (7) on 600: cb1 and cb2 by number
  expect(likelyFive(squad,seconds)).toEqual(['gk2','am1','st2','cb1','cb2']);
  // the squad list: most minutes first, keepers among them, ties by shirt number (am1 8, st2 10, gk2 12 on 900)
  expect(byMinutes(squad,seconds).map(p=>p.id).slice(0,4)).toEqual(['am1','st2','gk2','cb1']);
 });
 it('is nothing before anyone has played',()=>{
  expect(likelyFive(squad,()=>0)).toBeNull();
 });
 it('keeps who stays in his slot and fills the rest by listed position, then shirt number',()=>{
  // gk2 takes the keeper's slot; cb1 stays at centre-back; slot 3 (left winger) and 4 (right winger) and 5 (striker)
  // are free: am1 lists W second, st2 ST first, cb2 W second. Winger slots go first in slot order: am1 (W second,
  // number 8) v cb2 (W second, number 4) -> cb2 then am1; the striker slot -> st2.
  expect(placeFive(last,['gk2','am1','st2','cb1','cb2'],squad,'1-2-1')).toEqual(['gk2','cb1','cb2','am1','st2']);
  // a five that isn't a keeper and four outfielders changes nothing
  expect(placeFive(last,['gk1','gk2','cb1','w1','w2'],squad,'1-2-1')).toEqual(last);
 });
});

describe('orders against the picked five',()=>{
 it('leaves out an order whose man going off doesn’t start, and one whose man coming on now starts',()=>{
  const orders=[tired('a','st2','st1'),tired('b','cb2','w2'),{id:'c',in:'am1',trigger:{kind:'score',state:'losing'}} as PrepOrder];
  const five=['gk1','cb1','w1','am1','st2'];// w2 and st1 left out, st2 and am1 now start
  const r=fitOrders(orders,five,squad);
  expect(r.fit).toEqual([]);
  expect(r.unfit).toEqual([{id:'a',why:'in_starts'},{id:'b',why:'out_never_on'},{id:'c',why:'in_starts'}]);
 });
 it('keeps a chain (a man brought on by an earlier order going off later) and refuses a keeper for an outfielder',()=>{
  const orders=[tired('a','st2','st1'),{id:'b',in:'am1',out:'st2',trigger:{kind:'margin',atLeast:2,direction:'up'}} as PrepOrder,tired('c','gk2','w1')];
  const r=fitOrders(orders,last,squad);
  expect(r.fit.map(o=>o.id)).toEqual(['a','b']);
  expect(r.unfit).toEqual([{id:'c',why:'keeper'}]);
 });
});

describe('their side',()=>{
 it('from the function before the migration (no orders, no switch, no settings) is exactly today’s side',()=>{
  const s=side();
  expect(theirSide(club,squad,s).side).toEqual(frozenSide(club,squad,{lineup:s.lineup,formation:s.formation,style:s.style,approach:s.approach,captain:s.captain}));
  expect(theirSide(club,squad,s,null).unfit).toEqual([]);
 });
 const sw={id:'sw',trigger:{kind:'always'},notBefore:600,to:{plan:'p2',style:'counter',approach,settings:{},slots:[0,1,3,2,4]}} as unknown as NonNullable<PracticeSide['switch']>;
 const orders=[tired('a','st2','st1'),{id:'b',in:'am1',out:'w2',trigger:{kind:'score',state:'losing'},notBefore:450} as PrepOrder];
 it('plays their last game’s orders, change of plan and settings as they were set',()=>{
  const r=theirSide(club,squad,side({substitutions:orders,switch:sw,settings:{keeper:'sweeper',setPiece:'short',taker:'w2'}}));
  expect(r.side.substitutions).toEqual(orders);
  expect(r.side.switch).toEqual(sw);
  expect(r.side.settings).toEqual({keeper:'sweeper',setPiece:'short',taker:'w2'});
  expect(r.side.lineup).toEqual(last);
  // their own five passed back in is no pick
  expect(theirSide(club,squad,side({substitutions:orders}),[...last]).side.substitutions).toEqual(orders);
 });
 it('with the player’s five: orders that no longer fit, a taker off the pitch and the armband follow the five',()=>{
  const five=['gk1','cb1','am1','cb2','st1'];// w1 (captain) and w2 (taker; going off in order b) out
  const r=theirSide(club,squad,side({substitutions:orders,switch:sw,settings:{keeper:'sweeper',taker:'w2'}}),five);
  expect(r.side.lineup).toEqual(five);
  expect(r.side.substitutions).toEqual([orders[0]]);
  expect(r.unfit).toEqual([{id:'b',why:'in_starts'}]);
  expect(r.side.settings).toEqual({keeper:'sweeper'});
  expect(r.side.captain).toBe('cb1');
  expect(r.side.switch).toEqual(sw);
 });
});
