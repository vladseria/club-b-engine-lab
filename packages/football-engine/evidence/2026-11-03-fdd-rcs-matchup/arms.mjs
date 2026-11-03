// FC Directia Darmanesti's arms at Roman City Sport Club (global round 11). Written 2026-11-03, before any match was
// played. The reasoning for every arm is in SETUPS.md. Directia is the AWAY side (side 1); Roman City plays its stored
// round-11 side as frozen (sides/RCS.jsonb.txt), its switch included.
//
// An arm is what Match prep could store, by player short name:
//   formation  '1-2-1' (GK, CB, left winger, right winger, striker) or '2-2'; the board offers no other.
//   style      the style label; its base (progression, transition) must be the approach's (lib/ballers/approach.ts STYLE_BASE).
//   approach   the eight settings; Bodies forward 3-5, On losing it balanced | counterpress (the board's values).
//   lineup     slot order.
//   settings   match settings: keeper 'line'|'sweeper' (absent = each keeper's own habit), setPiece 'short'|'delivery'
//              (absent = Mixed), taker (absent = Auto).
//   subs       at most 3 orders (Subs.tsx): tired codes 97/95/92, score losing|drawing|winning, margin 2 up|down, half;
//              "not before" one of 0, 2:00, 5:00, 7:30, 10:00, 12:00 (none on a half-time order). Every order names who goes off.
//   switch     at most one change of plan (lib/ballers/switch.ts): if losing|level|winning, 2+ up|down, or whatever the
//              score; from one of the same minutes; to another saved plan of the same formation here (no slot map).
// The captain is not listed: it never reaches the engine (lib/ballers/compute.ts engineTeam).
// `stored: true` plays the frozen side unchanged; `dropOrders` removes named stored orders and nothing else.
export const PRESETS={ // lib/ballers/league.ts PRESETS at 529dde16
 balanced:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced',onLoss:'balanced'},
 combinations:{progression:'patient',width:'standard',line:'high',press:'balanced',commit:3,striker:'pivot',transition:'secure',onLoss:'counterpress'},
 direct:{progression:'direct',width:'wide',line:'standard',press:'balanced',commit:4,striker:'run',transition:'balanced',onLoss:'balanced'},
 counter:{progression:'mixed',width:'standard',line:'deep',press:'selective',commit:3,striker:'mixed',transition:'counter',onLoss:'balanced'},
};
const FIVE=['Bulan','Iacob','Orlandinho','Varză','Crizatu'];

// G1's plan: Balanced with Bodies forward 4.
const FEED={...PRESETS.balanced,commit:4};
// G2's plan: Counter with Aggressive press, Counter-press and a High line.
const PRESS={...PRESETS.counter,line:'high',press:'aggressive',onLoss:'counterpress'};
// G1+'s change of plan when losing: Direct, Wide, Aggressive, Bodies forward 5, Counter-press, striker Mixed.
const CHASE={progression:'direct',width:'wide',line:'standard',press:'aggressive',commit:5,striker:'mixed',transition:'balanced',onLoss:'counterpress'};

export const ARMS={
 // ---- A0: the carried prep, exactly as the lock would freeze it today.
 prep:{stored:true,label:'A0 carried prep (TikiTaka Darmanesti = Counter preset, 1-2-1, 3 tired-95 orders)'},
 // ---- A1: A0 without "Fotoliu on for Crizatu when tired" (order smvqxfjj21), nothing else.
 keepCriz:{stored:true,dropOrders:['smvqxfjj21'],label:'A1 A0 minus the Crizatu-off order'},
 // ---- A2: the two-minute fix: the Balanced preset; delete the Crizatu order; the other two changes late.
 quickFix:{label:'A2 Balanced preset, late changes, Crizatu stays',formation:'1-2-1',style:'balanced',approach:{...PRESETS.balanced},lineup:FIVE,
  settings:{setPiece:'delivery'},
  subs:[
   {id:'q1',in:'Nevorbitu',out:'Iacob',trigger:{kind:'tired',player:'Iacob',threshold:92},notBefore:600},
   {id:'q2',in:'Tramvai',out:'Varză',trigger:{kind:'tired',player:'Varză',threshold:92},notBefore:600},
  ]},
 // ---- G1: "Feed the finisher" (general).
 feed:{label:'G1 Feed the finisher: Balanced, Bodies forward 4, Crizatu all match',formation:'1-2-1',style:'balanced',approach:{...FEED},lineup:FIVE,
  settings:{setPiece:'delivery'},
  subs:[
   {id:'f1',in:'Nevorbitu',out:'Iacob',trigger:{kind:'tired',player:'Iacob',threshold:92},notBefore:600},
   {id:'f2',in:'Tramvai',out:'Varză',trigger:{kind:'tired',player:'Varză',threshold:92},notBefore:600},
  ]},
 // ---- G1k: G1 with Frigider in goal (each keeper plays his own habit; no keeper call).
 feedFrigider:{label:'G1k G1 with Frigider in goal',formation:'1-2-1',style:'balanced',approach:{...FEED},lineup:['Frigider','Iacob','Orlandinho','Varză','Crizatu'],
  settings:{setPiece:'delivery'},
  subs:[
   {id:'f1',in:'Nevorbitu',out:'Iacob',trigger:{kind:'tired',player:'Iacob',threshold:92},notBefore:600},
   {id:'f2',in:'Tramvai',out:'Varză',trigger:{kind:'tired',player:'Varză',threshold:92},notBefore:600},
  ]},
 // ---- G1+: G1 plus the in-match layer: named free-kick taker, score subs, a change of plan when losing.
 feedPlus:{label:'G1+ G1 + taker Orlandinho, score subs, chase switch if losing from 10:00',formation:'1-2-1',style:'balanced',approach:{...FEED},lineup:FIVE,
  settings:{setPiece:'delivery',taker:'Orlandinho'},
  subs:[
   {id:'p1',in:'Nevorbitu',out:'Iacob',trigger:{kind:'tired',player:'Iacob',threshold:92},notBefore:600},
   {id:'p2',in:'Fotoliu',out:'Varză',trigger:{kind:'score',state:'losing'},notBefore:600},
   {id:'p3',in:'Tramvai',out:'Orlandinho',trigger:{kind:'score',state:'winning'},notBefore:720},
  ],
  switch:{trigger:{kind:'score',state:'losing'},notBefore:600,to:{plan:'Chase',style:'direct',approach:{...CHASE},settings:{setPiece:'delivery'}}}},
 // ---- G2: "Run them down" (general).
 press:{label:'G2 Run them down: Counter, Aggressive, Counter-press, High line',formation:'1-2-1',style:'counter',approach:{...PRESS},lineup:FIVE,
  settings:{setPiece:'delivery'},
  subs:[
   {id:'r1',in:'Nevorbitu',out:'Iacob',trigger:{kind:'tired',player:'Iacob',threshold:95},notBefore:450},
   {id:'r2',in:'Tramvai',out:'Orlandinho',trigger:{kind:'tired',player:'Orlandinho',threshold:95},notBefore:600},
  ]},
 // ---- G2+: G2 plus the in-match layer: named free-kick taker, a score sub, a change of plan when winning.
 pressPlus:{label:'G2+ G2 + taker Orlandinho, Fotoliu if losing, sit-and-surge switch if winning from 10:00',formation:'1-2-1',style:'counter',approach:{...PRESS},lineup:FIVE,
  settings:{setPiece:'delivery',taker:'Orlandinho'},
  subs:[
   {id:'r1',in:'Nevorbitu',out:'Iacob',trigger:{kind:'tired',player:'Iacob',threshold:95},notBefore:450},
   {id:'r2',in:'Tramvai',out:'Orlandinho',trigger:{kind:'tired',player:'Orlandinho',threshold:95},notBefore:600},
   {id:'r3',in:'Fotoliu',out:'Varză',trigger:{kind:'score',state:'losing'},notBefore:600},
  ],
  switch:{trigger:{kind:'score',state:'winning'},notBefore:600,to:{plan:'Sit and surge',style:'counter',approach:{...PRESETS.counter},settings:{setPiece:'delivery'}}}},
 // ---- T: tuned to Roman City: G1 hunting their build-up.
 hunt:{label:'T G1 + Aggressive press + Counter-press (hunt RCS build-up)',formation:'1-2-1',style:'balanced',approach:{...FEED,press:'aggressive',onLoss:'counterpress'},lineup:FIVE,
  settings:{setPiece:'delivery'},
  subs:[
   {id:'h1',in:'Nevorbitu',out:'Iacob',trigger:{kind:'tired',player:'Iacob',threshold:95},notBefore:450},
   {id:'h2',in:'Tramvai',out:'Orlandinho',trigger:{kind:'tired',player:'Orlandinho',threshold:95},notBefore:600},
  ]},
};
/** The screen: every arm, in this order. */
export const SCREEN=['prep','keepCriz','quickFix','feed','feedFrigider','feedPlus','press','pressPlus','hunt'];
