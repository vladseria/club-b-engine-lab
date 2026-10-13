// The manager scenario set (ENGINE-MATCHUPS-DIRECTION.md §3), written 2026-10-09
// BEFORE any match of scenarios 2-4 was played. The reasoning behind every
// setup is in SCENARIOS.md; this file is the same setups as data.
//
// A scenario = one real fixture: both sides exactly as private.ballers_input_side
// builds them for the lock (sides/*.jsonb.txt, checked by md5 against the
// server: sides/CHECKSUMS.json), the side a manager plays ("ours"), the
// stored prep as the reference arm, 2-3 blind setups, and a control that
// keeps the opponent's players and changes ONE thing (their preset, or a key
// player out).
//
// An arm is a complete Match prep for "our" side, written as Match prep stores it:
//   formation, style (the preset it was based on; informational), approach (all
//   eight settings), lineup (player `short` names, slot order of FORMATIONS in
//   lib/ballers/league.ts), settings (match_settings: keeper 'line'|'sweeper',
//   setPiece 'short'|'delivery', taker = a starter's short name; absent = default),
//   subs (substitution orders as Subs.tsx writes them: tired threshold CODES
//   97/95/92, notBefore in {0,120,300,450,600,720} s, never on a 'half' order;
//   in/out/trigger.player by short name).
//   `stored: true` = play our side exactly as frozen (the reference).
// Slot order:
//   1-2-1  GK, centre-back, left winger, right winger, striker
//   2-2    GK, left CB, right CB, left winger, right winger
//   2-1-1  GK, left CB, right CB, midfielder, striker
//
// Opponent variants ("opp"):
//   stored              the opponent exactly as frozen
//   {preset:'<style>'}  same players and formation, style + all eight settings
//                       replaced by that preset (lib/ballers/league.ts PRESETS
//                       of the engine revision being run)
//   {out, in}           a key player out: `in` (from their bench) takes his slot;
//                       bench recomputed as private.ballers_bench does (by number)
//
// Seeds are this harness's own (never a fixture's official seed). Arms are
// paired on seeds; kickoff = seed % 2 (as ballers_freeze_match).


// ---------------------------------------------------------------- scenario 1
// Chior Dior v Neo-Testament: the 2026-10-08 study, unchanged. Its arms use
// keys, mapped here to shorts. Match ids stay `chior-study-<seed>` and seeds
// 720000+/730000+ so its rows reproduce the study's on the same platform/build.
const CHIOR_KEYS={GK:'Borcan',LUS:'Lustră',NAE:'Nae',PAR:'Parchet',INT:'Interfon',ZAC:'Zacuscă',CEA:'Ceaunu',COL:'Colivă',CHI:'Chiflă'};
import {ARMS as CHIOR_ARMS} from '../2026-10-08-chior-dior-matchup/arms.mjs';
const unkey=a=>{const k=x=>CHIOR_KEYS[x]??x;
 return {...a,lineup:a.lineup.map(k),...(a.settings?{settings:{...a.settings,...(a.settings.taker?{taker:k(a.settings.taker)}:{})}}:{}),
  ...(a.subs?{subs:a.subs.map(o=>({...o,in:k(o.in),...(o.out?{out:k(o.out)}:{}),trigger:o.trigger.kind==='tired'?{...o.trigger,player:k(o.trigger.player)}:o.trigger}))}:{})};};

export const SCENARIOS={
 'chior-neo':{
  n:1,title:'F.C Chior Dior v Neo-Testament',fixture:'global round 4, match 2539f719 (Chior Dior home)',
  source:{kind:'snapshot',file:'../2026-10-08-chior-dior-matchup/snapshot.json'},ours:0,matchId:seed=>`chior-study-${seed}`,
  stresses:'An AI Counter side of three Speedsters/finishers who sit deep and break; plan choice v reading the opponent (the first study).',
  arms:{
   prep:{stored:true,label:'Stored prep (carried "Direct plan", 1-2-1 Direct)'},
   lockDoor:{...unkey(CHIOR_ARMS.lockDoor),label:'A "Lock the door"'},
   huntPress:{...unkey(CHIOR_ARMS.huntPress),label:'B "Hunt their heavy touches"'},
   wingsAttack:{...unkey(CHIOR_ARMS.wingsAttack),label:'C "Two dribblers at one defender"'},
   // extras from the study (not in the default plans)
   home:{...unkey(CHIOR_ARMS.home),label:'Home plan (Short preset, stored five)'},
   huntPress2:{...unkey(CHIOR_ARMS.huntPress2),label:'B′ (B with the subs a manager means)'},
  },
  core:['prep','lockDoor','huntPress','wingsAttack'],trim:['prep','huntPress','wingsAttack'],headline:'huntPress',
  control:{id:'neoBal',opp:{preset:'balanced'},why:'Neo’s same five on the Balanced preset instead of Counter.'},
  seeds:{main:720000,control:730000},
 },

 // -------------------------------------------------------------- scenario 2
 'mcb-trs':{
  n:2,title:'FC Prizantemele v Trăsnetul Malmö',fixture:'global round 4, match 4ef140df (Prizantemele home); human v human',
  source:{kind:'sides',home:'sides/MCB.jsonb.txt',away:'sides/TRS.jsonb.txt'},ours:0,matchId:seed=>`scenario-mcb-trs-${seed}`,
  stresses:'Human v human; the opponent plays Direct (three passers of 9 feeding a finishing-10 striker); our stored prep is the untouched default, with our finishing-10 striker at centre-back and our defending-9 centre-back on the bench.',
  arms:{
   prep:{stored:true,label:'Stored prep (defaults since round 1: 2-1-1 Balanced, Tigaie and Pervaz at centre-back)'},
   stoppers:{label:'A "Two stoppers against the long ball"',formation:'2-2',style:'counter',
    approach:{progression:'direct',width:'standard',line:'deep',press:'balanced',commit:2,striker:'mixed',transition:'counter',onLoss:'balanced'},
    lineup:['Riciu Gros','Plăcintă','Clătită','Ghiveci','Tigaie'],
    settings:{keeper:'line',taker:'Ghiveci'},
    subs:[
     {id:'a1',in:'Covrig',out:'Ghiveci',trigger:{kind:'tired',player:'Ghiveci',threshold:95},notBefore:600},
     {id:'a2',in:'Ceaunu',out:'Clătită',trigger:{kind:'score',state:'losing'},notBefore:450},
    ]},
   runAt:{label:'B "Run at their slow back two"',formation:'1-2-1',style:'direct',
    approach:{progression:'direct',width:'wide',line:'standard',press:'balanced',commit:4,striker:'run',transition:'counter',onLoss:'balanced'},
    lineup:['Riciu Gros','Plăcintă','Ghiveci','Pervaz','Tigaie'],
    settings:{taker:'Ghiveci'},
    subs:[
     {id:'b1',in:'Ceaunu',out:'Pervaz',trigger:{kind:'tired',player:'Pervaz',threshold:95},notBefore:600},
     {id:'b2',in:'Clătită',out:'Ghiveci',trigger:{kind:'score',state:'winning'},notBefore:600},
     {id:'b3',in:'Covrig',out:'Plăcintă',trigger:{kind:'margin',atLeast:2,direction:'down'},notBefore:450},
    ]},
   starve:{label:'C "Take the ball off their passers"',formation:'2-1-1',style:'combinations',
    approach:{progression:'patient',width:'standard',line:'standard',press:'aggressive',commit:3,striker:'pivot',transition:'secure',onLoss:'counterpress'},
    lineup:['Riciu Gros','Plăcintă','Clătită','Ceaunu','Tigaie'],
    settings:{keeper:'sweeper',setPiece:'short',taker:'Tigaie'},
    subs:[
     {id:'c1',in:'Ghiveci',out:'Tigaie',trigger:{kind:'score',state:'drawing'},notBefore:600},
     {id:'c2',in:'Mititelu',out:'Ceaunu',trigger:{kind:'tired',player:'Ceaunu',threshold:95},notBefore:600},
     {id:'c3',in:'Pervaz',out:'Plăcintă',trigger:{kind:'score',state:'losing'},notBefore:600},
    ]},
  },
  core:['prep','stoppers','runAt','starve'],trim:['prep','stoppers','starve'],headline:'stoppers',
  control:{id:'trsShort',opp:{preset:'combinations'},why:'Trăsnetul’s same five in their 2-1-1 on the Short combinations preset instead of Direct.'},
  seeds:{main:740000,control:741000},
 },

 // -------------------------------------------------------------- scenario 3
 'men-mal':{
  n:3,title:'Ceata Mentala v Malpraxis',fixture:'global round 5, match d00ae8e2 (Ceata Mentala home); MEN’s round-4 manager prep carried, as ballers_freeze_prep would',
  source:{kind:'sides',home:'sides/MEN.jsonb.txt',away:'sides/MAL.jsonb.txt'},ours:0,matchId:seed=>`scenario-men-mal-${seed}`,
  stresses:'An AI side that presses Aggressively and pushes four forward; tiredness as a real dilemma (our best defender Capac has stamina 4) and a youngster’s minutes (Pătlăgea, 21, benched after 4 goals in 2 starts; two 18-year-olds start).',
  arms:{
   prep:{stored:true,label:'Stored prep (manager, 8 Oct: 1-2-1 Direct narrow, Capac on the left wing)'},
   passThrough:{label:'A "Pass through the press"',formation:'2-1-1',style:'balanced',
    approach:{progression:'mixed',width:'wide',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'counter',onLoss:'balanced'},
    lineup:['Caposu','Clătită','Capac','Zacuscă','Ceaunu'],
    settings:{keeper:'sweeper',taker:'Zacuscă'},
    subs:[
     {id:'a1',in:'Frigider',out:'Capac',trigger:{kind:'tired',player:'Capac',threshold:95},notBefore:450},
     {id:'a2',in:'Dementoru',out:'Zacuscă',trigger:{kind:'score',state:'losing'},notBefore:450},
     {id:'a3',in:'Pătlăgea',out:'Ceaunu',trigger:{kind:'margin',atLeast:2,direction:'up'},notBefore:600},
    ]},
   kids:{label:'B "Let the kids run at them"',formation:'1-2-1',style:'direct',
    approach:{progression:'direct',width:'wide',line:'standard',press:'balanced',commit:4,striker:'run',transition:'counter',onLoss:'balanced'},
    lineup:['Caposu','Capac','Dementoru','Pătlăgea','Ceaunu'],
    settings:{keeper:'sweeper',taker:'Pătlăgea'},
    subs:[
     {id:'b1',in:'Clătită',out:'Capac',trigger:{kind:'tired',player:'Capac',threshold:95},notBefore:600},
     {id:'b2',in:'Frigider',out:'Pătlăgea',trigger:{kind:'score',state:'winning'},notBefore:720},
    ]},
   pressBack:{label:'C "Press the pressers, Capac off the bench"',formation:'2-2',style:'direct',
    approach:{progression:'direct',width:'standard',line:'standard',press:'aggressive',commit:3,striker:'mixed',transition:'counter',onLoss:'counterpress'},
    lineup:['Caposu','Clătită','Frigider','Dementoru','Ceaunu'],
    settings:{keeper:'sweeper',taker:'Dementoru'},
    subs:[
     {id:'c1',in:'Capac',out:'Frigider',trigger:{kind:'half'}},
     {id:'c2',in:'Pătlăgea',out:'Ceaunu',trigger:{kind:'tired',player:'Ceaunu',threshold:95},notBefore:600},
     {id:'c3',in:'Tramvai',out:'Dementoru',trigger:{kind:'score',state:'winning'},notBefore:600},
    ]},
  },
  core:['prep','passThrough','kids','pressBack'],trim:['prep','passThrough','pressBack'],headline:'passThrough',
  control:{id:'malCounter',opp:{preset:'counter'},why:'Malpraxis’s same five on their style’s own Counter preset (deep line, Selective press, 3 forward): the aggressive-press adjustment removed.'},
  seeds:{main:750000,control:751000},
 },

 // -------------------------------------------------------------- scenario 4
 'fdd-int':{
  n:4,title:'FC Directia Darmanesti v Inter',fixture:'global round 6, match 74e61bcb (Directia home); FDD’s round-4 manager prep carried, as ballers_freeze_prep would',
  source:{kind:'sides',home:'sides/FDD.jsonb.txt',away:'sides/INT.jsonb.txt'},ours:0,matchId:seed=>`scenario-fdd-int-${seed}`,
  stresses:'A quality mismatch: the league’s strongest squad (Inter, lineup mean skill 5.91, 23-10 in three wins, Direct with an Aggressive press) against a squad of passers with one real defender. Does reasoning matter for the underdog?',
  arms:{
   prep:{stored:true,label:'Stored prep (manager, 6 Oct: "Home plan", 2-2 Direct + counter-press)'},
   shutBreak:{label:'A "Shut the door, hit them on the break"',formation:'2-1-1',style:'counter',
    approach:{progression:'mixed',width:'standard',line:'deep',press:'selective',commit:2,striker:'mixed',transition:'counter',onLoss:'regroup'},
    lineup:['Frigider','Tramvai','Varză','Lustră','Crizatu'],
    settings:{keeper:'line',taker:'Crizatu'},
    subs:[
     {id:'a1',in:'Calorifer',out:'Lustră',trigger:{kind:'score',state:'losing'},notBefore:450},
     {id:'a2',in:'Fotoliu',out:'Varză',trigger:{kind:'margin',atLeast:2,direction:'down'},notBefore:450},
    ]},
   throughPress:{label:'B "Pass through their press to their lone centre-back"',formation:'2-1-1',style:'direct',
    approach:{progression:'direct',width:'wide',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'counter',onLoss:'balanced'},
    lineup:['Frigider','Tramvai','Lustră','Calorifer','Crizatu'],
    settings:{taker:'Lustră'},
    subs:[
     {id:'b1',in:'Varză',out:'Calorifer',trigger:{kind:'tired',player:'Calorifer',threshold:95},notBefore:600},
     {id:'b2',in:'Fotoliu',out:'Lustră',trigger:{kind:'margin',atLeast:2,direction:'down'},notBefore:450},
    ]},
   keepBall:{label:'C "Keep the ball away from them"',formation:'2-1-1',style:'combinations',
    approach:{progression:'patient',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'secure',onLoss:'balanced'},
    lineup:['Frigider','Ceaunu','Tramvai','Lustră','Crizatu'],
    settings:{setPiece:'short',taker:'Lustră'},
    subs:[
     {id:'c1',in:'Calorifer',out:'Ceaunu',trigger:{kind:'score',state:'losing'},notBefore:450},
     {id:'c2',in:'Varză',out:'Lustră',trigger:{kind:'tired',player:'Lustră',threshold:95},notBefore:600},
     {id:'c3',in:'Fotoliu',out:'Crizatu',trigger:{kind:'score',state:'winning'},notBefore:720},
    ]},
  },
  core:['prep','shutBreak','throughPress','keepBall'],trim:['prep','shutBreak','throughPress'],headline:'shutBreak',
  control:{id:'intNoThuram',opp:{out:'Thuram',in:'Henrique'},why:'Inter without Thuram (11 goals in 3, their runner in behind): Henrique, the bench winger, takes his right-wing slot; Inter’s plan unchanged.'},
  seeds:{main:760000,control:761000},
 },
};

// ---------------------------------------------------- one-off fixtures
// Played only when named with --scenarios (run.mjs, match.ts); NOT in
// SCENARIOS, so every harness that enumerates the set above is unchanged.
export const ADHOC={
 // ------------------------------------------------- one-off: today's fixture
 // Rapid Pensia v F.C Chior Dior as both clubs had it set on 2026-10-13
 // 13:27 UTC (global round 5, lock 16:00 UTC): stored preps only, no arms.
 'rap-fcd':{
  n:5,title:'Rapid Pensia v F.C Chior Dior',fixture:'global round 5, match 8bce6eaa (Rapid Pensia home), preps as of 2026-10-13 13:27 UTC',
  source:{kind:'sides',home:'sides/RAP.jsonb.txt',away:'sides/FCD.jsonb.txt'},ours:1,matchId:seed=>`scenario-rap-fcd-${seed}`,
  stresses:'Both stored preps as set, ~100 matches on the live engine (asked 13 Oct).',
  arms:{prep:{stored:true,label:'Stored prep (manager: 1-2-1 Direct, wide, striker run, Parchet on at half-time)'}},
  core:['prep'],trim:['prep'],headline:'prep',
  control:{id:'rapStored',opp:'stored',why:'none: no control was run'},
  seeds:{main:770000,control:771000},
 },
};

/** Run plans: which arms, opponent variants and seeds each scenario plays
 * (every plan's seeds are the first ones of the full plan's ranges, so rows
 * of a smaller plan are a subset of the full plan's).
 * full    the direction's bar: core arms x 200 paired seeds v the stored
 *         opponent + core arms x 80 v the control. 1,120 matches a scenario.
 * trim    a cloud check for ONE revision when the baseline's rows are cached
 *         from an earlier run on the same runner: `trim` arms x 25 seeds +
 *         (prep, headline) x 12 v the control. 99 matches a scenario.
 * lean    a cloud check with baseline AND candidate in the same run:
 *         (prep, headline) x 20 + (prep, headline) x 10 v the control. 60 a scenario.
 * det     determinism sample: the stored prep on its first 3 seeds (re-run
 *         beside a cached baseline to prove its rows still reproduce: same.mjs).
 * smoke   one match per scenario (stored prep v stored opponent). */
export const PLANS={
 full:s=>[{opp:'stored',arms:s.core,from:s.seeds.main,count:200},{opp:s.control.id,arms:s.core,from:s.seeds.control,count:80}],
 trim:s=>[{opp:'stored',arms:s.trim,from:s.seeds.main,count:25},{opp:s.control.id,arms:['prep',s.headline],from:s.seeds.control,count:12}],
 lean:s=>[{opp:'stored',arms:['prep',s.headline],from:s.seeds.main,count:20},{opp:s.control.id,arms:['prep',s.headline],from:s.seeds.control,count:10}],
 det:s=>[{opp:'stored',arms:['prep'],from:s.seeds.main,count:3}],
 smoke:s=>[{opp:'stored',arms:['prep'],from:s.seeds.main,count:1}],
};

