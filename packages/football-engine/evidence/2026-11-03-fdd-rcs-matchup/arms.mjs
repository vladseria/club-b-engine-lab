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

// ---- Added after the screen (2026-11-03, the owner's request through the lead; SETUPS.md "Added after the screen"):
// three lineup swaps on A0. `stored: true` + `lineup` = A0's frozen side with another five (slot order GK, CB, LW, RW, ST);
// plan, approach, free kicks, captain (Crizatu) and every order not dropped stay exactly as stored. Same seeds as the screen,
// paired with the stored A0 rows.
export const ADDED={
 // S1: Fotoliu starts at ST; Crizatu takes Orlandinho's LW slot; Orlandinho to the bench. The Crizatu->Fotoliu order is dropped;
 // Nevorbitu for Iacob (smvv7l5uj0) and Tramvai for Varză (smvv7m9ik1) stay.
 swapOrl:{stored:true,label:'S1 Fotoliu ST, Crizatu LW (for Orlandinho)',lineup:['Bulan','Iacob','Crizatu','Varză','Fotoliu'],dropOrders:['smvqxfjj21']},
 // S2: as S1, but Crizatu takes Varză's RW slot; Varză to the bench and his order dropped; Nevorbitu for Iacob stays.
 swapVar:{stored:true,label:'S2 Fotoliu ST, Crizatu RW (for Varză)',lineup:['Bulan','Iacob','Orlandinho','Crizatu','Fotoliu'],dropOrders:['smvqxfjj21','smvv7m9ik1']},
 // S3: Frigider in goal instead of Bulan; nothing else changes (all three stored orders stay).
 frigider:{stored:true,label:'S3 Frigider in goal',lineup:['Frigider','Iacob','Orlandinho','Varză','Crizatu']},
};
Object.assign(ARMS,ADDED);
export const SWAPS=Object.keys(ADDED);

// ---- Added after the swaps (2026-11-03; SETUPS.md "Added after the swaps"): the timing of the Crizatu<->Fotoliu change.
// A0's frozen side with only the Crizatu order (smvqxfjj21) changed in place (same id, same place in the list); Iacob->Nevorbitu
// and Varză->Tramvai stay as stored. A0 itself (prep) and A1 (keepCriz) are the other two timings.
export const TIMING={
 // "a bit tired" (code 97 = energy 88), no "not before"
 critEarly:{stored:true,label:'T-early Crizatu off at "a bit tired"',patchOrders:{smvqxfjj21:{trigger:{kind:'tired',player:'Crizatu',threshold:97}}}},
 // "tired" (95), not before 10:00
 crit10:{stored:true,label:'T-10 Crizatu off when tired, not before 10:00',patchOrders:{smvqxfjj21:{notBefore:600}}},
 // "tired" (95), not before 12:00
 crit12:{stored:true,label:'T-12 Crizatu off when tired, not before 12:00',patchOrders:{smvqxfjj21:{notBefore:720}}},
 // reverse: Fotoliu starts at ST (Crizatu's slot), Crizatu on for him at half-time
 revHalf:{stored:true,label:'R-half Fotoliu starts, Crizatu on at half-time',lineup:['Bulan','Iacob','Orlandinho','Varză','Fotoliu'],
  patchOrders:{smvqxfjj21:{in:'Crizatu',out:'Fotoliu',trigger:{kind:'half'}}}},
 // reverse: Fotoliu starts at ST, Crizatu on for him when Fotoliu is tired (95), not before 10:00
 revLate:{stored:true,label:'R-late Fotoliu starts, Crizatu on when Fotoliu tired, not before 10:00',lineup:['Bulan','Iacob','Orlandinho','Varză','Fotoliu'],
  patchOrders:{smvqxfjj21:{in:'Crizatu',out:'Fotoliu',trigger:{kind:'tired',player:'Fotoliu',threshold:95},notBefore:600}}},
};
Object.assign(ARMS,TIMING);
export const TIMING_ARMS=Object.keys(TIMING);

// ---- Added after the timing run (2026-11-03; SETUPS.md "Added after the timing run"): other plans. A0's frozen side with ONLY
// the plan changed (style + its preset, exactly as picking the style in the app sets them: private.ballers_preset, read live,
// equals PRESETS above); the same five in the same slots, 1-2-1, A0's three orders, A0's free kicks (Into the box), captain.
// G2 (`press`, the screen's arm, unchanged) plays only the 100 seeds it lacks.
export const PLANS={
 planBalanced:{stored:true,label:'P-Balanced preset',plan:{style:'balanced',approach:{...PRESETS.balanced}}},
 planDirect:{stored:true,label:'P-Direct preset',plan:{style:'direct',approach:{...PRESETS.direct}}},
 planShort:{stored:true,label:'P-Short preset (combinations)',plan:{style:'combinations',approach:{...PRESETS.combinations}}},
};
Object.assign(ARMS,PLANS);
export const PLAN_ARMS=Object.keys(PLANS);

// ---- Added after the plans run (2026-11-03; SETUPS.md "Added after the plans run"): Crizatu as the target man. A0's frozen
// side plus only what is listed: the Striker setting (approachPatch; the Counter style still fits), the Crizatu->Fotoliu order
// dropped, and a named free-kick taker (settingsPatch) so Crizatu is in the box: Orlandinho (see SETUPS.md).
export const TARGET={
 pivFull:{stored:true,label:'P-full Pivot, Crizatu all match, taker Orlandinho',approachPatch:{striker:'pivot'},dropOrders:['smvqxfjj21'],settingsPatch:{taker:'Orlandinho'}},
 pivOnly:{stored:true,label:'P-only Pivot',approachPatch:{striker:'pivot'}},
 mixFull:{stored:true,label:'M-full Mixed, Crizatu all match, taker Orlandinho',dropOrders:['smvqxfjj21'],settingsPatch:{taker:'Orlandinho'}},
 runFull:{stored:true,label:'R-full In behind, Crizatu all match, taker Orlandinho',approachPatch:{striker:'run'},dropOrders:['smvqxfjj21'],settingsPatch:{taker:'Orlandinho'}},
 runOnly:{stored:true,label:'R-only In behind',approachPatch:{striker:'run'}},
};
Object.assign(ARMS,TARGET);
export const TARGET_ARMS=Object.keys(TARGET);

// ---- Added after the target-man run (2026-11-03; SETUPS.md "Added after the target-man run"): position swaps within A0's
// five. A0's frozen side with the five re-slotted (GK, CB, LW, RW, ST) and the Crizatu->Fotoliu order dropped (a sub takes
// the outgoing man's slot, so Fotoliu would land on the wing). Free kicks as A0 (Into the box, taker Auto).
export const XSWAP={
 // X1: Orlandinho at ST, Crizatu in Orlandinho's LW slot; Iacob->Nevorbitu and Varză->Tramvai stay.
 xOrlST:{stored:true,label:'X1 Orlandinho ST, Crizatu LW',lineup:['Bulan','Iacob','Crizatu','Varză','Orlandinho'],dropOrders:['smvqxfjj21']},
 // X2: Varză at ST, Crizatu in Varză's RW slot; Iacob->Nevorbitu stays; Varză's own tired order (Tramvai for him) stays and
 // now targets him at ST (stamina 9: in the screen it never fired).
 xVarST:{stored:true,label:'X2 Varză ST, Crizatu RW',lineup:['Bulan','Iacob','Orlandinho','Crizatu','Varză'],dropOrders:['smvqxfjj21']},
};
Object.assign(ARMS,XSWAP);
export const XSWAP_ARMS=Object.keys(XSWAP);
