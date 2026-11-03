// The broad sweep (2026-11-03; SETUPS-SWEEP.md): every Stage 1 arm as data, built from a few fives, the four presets and
// one-setting variations, plus five manager-idea combos. A0 itself is the stored side, unchanged (arm `prep`).
// Every arm except A0: free kicks Into the box (A0's), taker Auto, no keeper call (each keeper's own habit), captain Crizatu
// when he starts (else slot 2), and its five's default substitution orders: A0's own structure (three "tired" 95 orders, no
// "not before", every order naming who goes off), written once per five below.
import {PRESETS} from './arms.mjs';

const t95=(id,inn,out)=>({id,in:inn,out,trigger:{kind:'tired',player:out,threshold:95}});
/** The fives (slot order: 1-2-1 = GK, CB, LW, RW, ST; 2-2 = GK, LCB, RCB, LW, RW) and their default orders. */
export const FIVES={
 // 1-2-1
 F1:{formation:'1-2-1',lineup:['Bulan','Iacob','Orlandinho','Varză','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Nevorbitu','Iacob'),t95('d3','Tramvai','Varză')]},
 F1F:{formation:'1-2-1',lineup:['Frigider','Iacob','Orlandinho','Varză','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Nevorbitu','Iacob'),t95('d3','Tramvai','Varză')]},
 F2:{formation:'1-2-1',lineup:['Bulan','Nevorbitu','Orlandinho','Varză','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Iacob','Nevorbitu'),t95('d3','Tramvai','Varză')]},
 F2F:{formation:'1-2-1',lineup:['Frigider','Nevorbitu','Orlandinho','Varză','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Iacob','Nevorbitu'),t95('d3','Tramvai','Varză')]},
 F5:{formation:'1-2-1',lineup:['Bulan','Iacob','Orlandinho','Tramvai','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Nevorbitu','Iacob'),t95('d3','Varză','Tramvai')]},
 // 2-2
 G1:{formation:'2-2',lineup:['Bulan','Iacob','Nevorbitu','Orlandinho','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Tramvai','Nevorbitu'),t95('d3','Varză','Orlandinho')]},
 G1F:{formation:'2-2',lineup:['Frigider','Iacob','Nevorbitu','Orlandinho','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Tramvai','Nevorbitu'),t95('d3','Varză','Orlandinho')]},
 G2:{formation:'2-2',lineup:['Bulan','Iacob','Nevorbitu','Varză','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Tramvai','Nevorbitu'),t95('d3','Orlandinho','Varză')]},
 G3:{formation:'2-2',lineup:['Bulan','Iacob','Nevorbitu','Orlandinho','Varză'],subs:[t95('d1','Tramvai','Nevorbitu'),t95('d2','Crizatu','Orlandinho'),t95('d3','Fotoliu','Varză')]},
 G4:{formation:'2-2',lineup:['Bulan','Iacob','Tramvai','Orlandinho','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Nevorbitu','Iacob'),t95('d3','Varză','Orlandinho')]},
 G5:{formation:'2-2',lineup:['Bulan','Nevorbitu','Tramvai','Orlandinho','Crizatu'],subs:[t95('d1','Fotoliu','Crizatu'),t95('d2','Iacob','Nevorbitu'),t95('d3','Varză','Orlandinho')]},
};
const arm=(label,five,style,approach,extra={})=>({label,formation:FIVES[five].formation,style,approach:{...approach},lineup:[...FIVES[five].lineup],
 settings:{setPiece:'delivery'},subs:FIVES[five].subs.map(o=>({...o,trigger:{...o.trigger}})),five,...extra});
const P=PRESETS;
/** One-setting variations around a base plan: every other board value of Line, Press, Width, Bodies forward, Striker
 * (all but `skipStriker`), and On losing it. */
const OPTIONS={line:['deep','standard','high'],press:['selective','balanced','aggressive'],width:['narrow','standard','wide'],commit:[3,4,5],striker:['mixed','link','pivot','run'],onLoss:['balanced','counterpress']};
function variations(prefix,label,five,style,base,{only}={}){
 const out={};
 for(const [k,vals] of Object.entries(OPTIONS))for(const v of vals){
  if(base[k]===v)continue;if(only&&!only.some(([ok,ov])=>ok===k&&(ov===undefined||ov===v)))continue;
  out[`${prefix}_${k}_${v}`]=arm(`${label}, ${k} ${v}`,five,style,{...base,[k]:v});
 }
 return out;
}

export const SWEEP={
 // ---- A0, the stored side unchanged (1-2-1 Counter preset, F1, A0's orders)
 prep:{stored:true,label:'A0 carried prep (1-2-1 Counter preset, F1)'},
 // ---- the four presets in each formation, on the base fives (1-2-1 Counter is A0)
 w_bal:arm('1-2-1 Balanced preset (F1)','F1','balanced',P.balanced),
 w_dir:arm('1-2-1 Direct preset (F1)','F1','direct',P.direct),
 w_sho:arm('1-2-1 Short preset (F1)','F1','combinations',P.combinations),
 t_bal:arm('2-2 Balanced preset (G1)','G1','balanced',P.balanced),
 t_dir:arm('2-2 Direct preset (G1)','G1','direct',P.direct),
 t_sho:arm('2-2 Short preset (G1)','G1','combinations',P.combinations),
 t_cou:arm('2-2 Counter preset (G1)','G1','counter',P.counter),
 // ---- other fives, on the Balanced preset
 f2_bal:arm('1-2-1 Balanced, Nevorbitu at CB (F2)','F2','balanced',P.balanced),
 f5_bal:arm('1-2-1 Balanced, Tramvai for Varză (F5)','F5','balanced',P.balanced),
 g2_bal:arm('2-2 Balanced, wingers Varză + Crizatu (G2)','G2','balanced',P.balanced),
 g3_bal:arm('2-2 Balanced, wingers Orlandinho + Varză, Crizatu on the bench (G3)','G3','balanced',P.balanced),
 g4_bal:arm('2-2 Balanced, CBs Iacob + Tramvai (G4)','G4','balanced',P.balanced),
 g5_bal:arm('2-2 Balanced, CBs Nevorbitu + Tramvai (G5)','G5','balanced',P.balanced),
 // ---- keepers: Frigider for Bulan, once per formation (Balanced)
 w_bal_frig:arm('1-2-1 Balanced, Frigider in goal (F1F)','F1F','balanced',P.balanced),
 t_bal_frig:arm('2-2 Balanced, Frigider in goal (G1F)','G1F','balanced',P.balanced),
 // ---- one setting at a time around the better presets
 ...variations('wb','1-2-1 Balanced','F1','balanced',P.balanced),
 ...variations('wd','1-2-1 Direct','F1','direct',P.direct),
 ...variations('tb','2-2 Balanced','G1','balanced',P.balanced,{only:[['line'],['press'],['width'],['commit',4],['striker','run'],['onLoss']]}),
 ...variations('wc','1-2-1 Counter (F1)','F1','counter',P.counter,{only:[['line','standard'],['press','balanced']]}),
 // ---- manager ideas
 c_press:arm('Idea: press and surge (1-2-1 Counter, High, Aggressive, Counter-press)','F1','counter',{...P.counter,line:'high',press:'aggressive',onLoss:'counterpress'}),
 c_allin:arm('Idea: all-in Direct (1-2-1 Direct, Bodies forward 5, Counter-press)','F1','direct',{...P.direct,commit:5,onLoss:'counterpress'}),
 c_keep:arm('Idea: keep it without a high line (1-2-1 Short, Line Standard, Striker Mixed)','F1','combinations',{...P.combinations,line:'standard',striker:'mixed'}),
 c_22brk:arm('Idea: two banks and break (2-2 Direct, Line Deep, Press Selective)','G1','direct',{...P.direct,line:'deep',press:'selective'}),
 c_spine:arm('Idea: sturdy spine (1-2-1 Balanced, Nevorbitu at CB, Frigider in goal)','F2F','balanced',P.balanced),
};
/** Manager-idea reasoning, one line each ("Directia has X, so A"). */
export const IDEAS={
 c_press:'Directia has tireless wingers (Varză stamina 9, Orlandinho 8) and a ball-winner at CB (Iacob, defending 8), so press everywhere, chase every loss and surge on the regain.',
 c_allin:'Directia has two motors who can support every attack (Orlandinho pace 8, Varză stamina 9) and one finisher who needs company, so play forward fast with five joining and win it straight back.',
 c_keep:'Directia has eight outfielders who pass at 7 or more but no quick defenders, so keep the ball (Short) without the high line, and let the finisher play his own game.',
 c_22brk:'Directia has two defending-8 centre-backs (Iacob, Nevorbitu) and two forwards who finish or run (Crizatu, Orlandinho), so sit in two banks of two and hit them forward fast.',
 c_spine:'Directia has a strength-8 defender (Nevorbitu) and a reading-9 keeper (Frigider), so build the spine from them and play Balanced in front.',
};
export const SWEEP_ARMS=Object.keys(SWEEP);
/** Seeds: Stage 1 (fresh, shared by every arm) and Stage 2 (new). */
export const STAGE1_SEEDS='1104000-1104049',STAGE2_SEEDS='1105000-1105399';

// ---- Added after the Bodies-forward-5 run (2026-11-03; SETUPS-SWEEP.md "One setting at a time around wb_commit_5"):
// wb_commit_5 (1-2-1 Balanced + Bodies forward 5, F1, A0's three orders, free kicks Into the box, taker Auto, no keeper call)
// with exactly one of the manager's rows changed. Progression and On winning it stay the style's; they are not manager rows.
const B5=SWEEP.wb_commit_5;
const one=(row,v,label)=>({...B5,label:`wb_commit_5, ${label}`,approach:{...B5.approach,[row]:v},subs:B5.subs.map(o=>({...o,trigger:{...o.trigger}})),lineup:[...B5.lineup],settings:{...B5.settings}});
export const AROUND5={
 a5_width_narrow:one('width','narrow','Width Narrow'),
 a5_width_wide:one('width','wide','Width Wide'),
 a5_line_deep:one('line','deep','Line Deep'),
 a5_line_high:one('line','high','Line High'),
 a5_press_selective:one('press','selective','Press Selective'),
 a5_press_aggressive:one('press','aggressive','Press Aggressive'),
 a5_striker_link:one('striker','link','Striker Drops deep'),
 a5_striker_pivot:one('striker','pivot','Striker Pivot'),
 a5_striker_run:one('striker','run','Striker In behind'),
 a5_onLoss_counterpress:one('onLoss','counterpress','On losing it Counter-press'),
};
export const AROUND5_ARMS=Object.keys(AROUND5);
