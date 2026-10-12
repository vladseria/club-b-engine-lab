// Chior Dior's arms v Neo-Testament: two reference setups (what the club has
// today) and three manager setups written from scouting only (FINDINGS.md
// "The three setups"), before any match was played.
// Lineup = slot order (FORMATIONS in lib/ballers/league.ts):
//   2-1-1  GK, left CB, right CB, midfielder, striker
//   1-2-1  GK, CB, left winger, right winger, striker
//   2-2    GK, left CB, right CB, left winger, right winger
// Any outfielder may fill any outfield slot (Match prep's Replace; SQL ballers_check_lineup).
// Keys: GK Borcan, LUS Lustră, NAE Nae, PAR Parchet, INT Interfon (the stored five);
// bench ZAC Zacuscă, CEA Ceaunu, COL Colivă, CHI Chiflă.
// settings = match_settings (keeper 'line'|'sweeper', setPiece 'short'|'delivery', taker id key);
// subs = substitution orders as Match prep stores them (tired threshold codes 97/95/92; notBefore s).
// The captain is not listed: it never reaches the engine (lib/ballers/compute.ts engineTeam).
export const PRESETS={ // lib/ballers/league.ts PRESETS
 balanced:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced',onLoss:'balanced'},
 combinations:{progression:'patient',width:'standard',line:'high',press:'balanced',commit:3,striker:'pivot',transition:'secure',onLoss:'counterpress'},
 direct:{progression:'direct',width:'wide',line:'standard',press:'balanced',commit:4,striker:'run',transition:'balanced',onLoss:'balanced'},
 counter:{progression:'mixed',width:'standard',line:'deep',press:'selective',commit:3,striker:'mixed',transition:'counter',onLoss:'balanced'},
};
export const ARMS={
 // ---- references
 // "Home plan" (club row + ballers_plans 'Home plan'): Short combinations preset, 2-1-1, the stored five, no subs, Auto taker.
 home:{formation:'2-1-1',style:'combinations',approach:{...PRESETS.combinations},lineup:['GK','LUS','NAE','PAR','INT']},
 // What round 4's prep holds today (carried from round 3, plan "Direct plan"): Direct preset, 1-2-1, same five.
 prepDirect:{formation:'1-2-1',style:'direct',approach:{...PRESETS.direct},lineup:['GK','LUS','NAE','PAR','INT']},

 // ---- A "Lock the door": two real defenders, deep and compact, Nae plays it through them.
 lockDoor:{formation:'2-1-1',style:'counter',
  approach:{progression:'patient',width:'standard',line:'deep',press:'balanced',commit:2,striker:'mixed',transition:'secure',onLoss:'regroup'},
  lineup:['GK','LUS','COL','NAE','INT'],
  settings:{keeper:'line',setPiece:'short',taker:'INT'},
  subs:[
   {id:'a1',in:'PAR',out:'NAE',trigger:{kind:'tired',player:'NAE',threshold:95},notBefore:450},
   {id:'a2',in:'CEA',trigger:{kind:'score',state:'losing'},notBefore:600},
   {id:'a3',in:'ZAC',trigger:{kind:'score',state:'drawing'},notBefore:600},
  ]},

 // ---- B "Hunt their heavy touches": press their poor passers high, break at once, two CBs behind it.
 huntPress:{formation:'2-2',style:'direct',
  approach:{progression:'direct',width:'standard',line:'standard',press:'aggressive',commit:3,striker:'mixed',transition:'counter',onLoss:'counterpress'},
  lineup:['GK','LUS','COL','ZAC','INT'],
  settings:{keeper:'sweeper',taker:'INT'},
  subs:[
   {id:'b1',in:'CEA',out:'ZAC',trigger:{kind:'tired',player:'ZAC',threshold:95}},
   {id:'b2',in:'PAR',trigger:{kind:'half'}},
   {id:'b3',in:'NAE',trigger:{kind:'score',state:'losing'},notBefore:600},
  ]},

 // ---- C "Two dribblers at one defender": wide 1-2-1, Parchet and Zacuscă take their wingers on 1v1.
 wingsAttack:{formation:'1-2-1',style:'balanced',
  approach:{progression:'mixed',width:'wide',line:'standard',press:'balanced',commit:4,striker:'mixed',transition:'balanced',onLoss:'balanced'},
  lineup:['GK','LUS','PAR','ZAC','INT'],
  subs:[
   {id:'c1',in:'CEA',out:'PAR',trigger:{kind:'tired',player:'PAR',threshold:95}},
   {id:'c2',in:'COL',trigger:{kind:'score',state:'winning'},notBefore:600},
   {id:'c3',in:'CHI',trigger:{kind:'score',state:'losing'},notBefore:450},
  ]},

 // ---- B′ (owner-approved follow-up, added after B's subs were seen to take Interfon off): B with the subs a manager means.
 // "Interfon plays the whole game. Ceaunu's pace comes on for the spent Zacuscă at 10:00, not at 6:00.
 //  Keep the back two while the press works. Throw Parchet on only if we're chasing it."
 // The subs UI has no plain clock trigger: a later change is "when tired" + "not before" (Subs.tsx).
 // Every order names who goes off (Subs.tsx "Take off"), so "most tired" can never pick Interfon.
 huntPress2:{formation:'2-2',style:'direct',
  approach:{progression:'direct',width:'standard',line:'standard',press:'aggressive',commit:3,striker:'mixed',transition:'counter',onLoss:'counterpress'},
  lineup:['GK','LUS','COL','ZAC','INT'],
  settings:{keeper:'sweeper',taker:'INT'},
  subs:[
   {id:'p1',in:'CEA',out:'ZAC',trigger:{kind:'tired',player:'ZAC',threshold:95},notBefore:600},
   {id:'p2',in:'PAR',out:'COL',trigger:{kind:'score',state:'losing'},notBefore:450},
  ]},
};
