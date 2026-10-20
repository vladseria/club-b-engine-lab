// Defensive ceiling (2026-10-20): the probe's bundle-time transform. Evidence only; the engine source is never edited.
// Every injected call goes through globalThis.__pdIs / __pdRun / __pdDefend. With no controller installed (every plain
// arm, every parity run) each is undefined and the bundle plays computeMatch's match exactly (run.mjs --parity checks
// it). Anchors must each be found exactly once.
//
// __pdIs(p, el): p is an outfielder of the probed side, that side is NOT in possession (practice.ts `side`), and PD
// element el ('a' | 'b') is on. __pdRun(d, a): defender d is locked onto runner a by element c. __pdDefend: the
// controller's wrapper round the side-without-the-ball plan (elements c and d), called only when its side defends.
//
// (a) perception noise  P1 misread(p) -> 0; P2 perceive(p) -> the exact value (no error, no bias)
// (b) reaction delays   P3 sightLag(p) -> 0 (the M3 picture is current; also cueDelay, which is sightLag)
//                       D1 commitFor -> COMMIT.fast (a perfect reader's commitment window)
//                       D2 callDelay -> 0 (calls heard at once)
//                       D3 readRun's horizon -> RUN_EARLY.max (a perfect reader spots the run that far ahead)
//                       D4 markLead's read-ahead -> LEAD.max (a perfect reader's)
//                       D5 the clear-run see delay -> 0;  D6 the cover-drop see delay -> 0
//                       S2 runnerPickupDelay: no lapse is set for the probed side's defenders
// (c) runner pickup     D7 readMan: a man locked to this defender by the controller reads as a runner
//                       D8 defendOutOfPossession -> __pdDefend.wrap(given, original) (adds the locks to `locked`)
// (d) compact block     D8 as well (the wrapper post-processes the plan's jobs)
// S1 practice.ts: exposes the possession side to the controller (__pdSideNow).
import {readFileSync} from 'node:fs';
const swap=(src,from,to,name)=>{if(src.split(from).length!==2)throw Error(`${name}: anchor not found exactly once`);return src.replace(from,()=>to);};
const IS=`(globalThis as any).__pdIs?.`;
export const A={
 P1:'export function misread(p:Reader,read:Read):number{return clamp(1.05-acuity(p,read),.05,1);}',
 P2:' return exact+spread*misread(p,read)*readNoise(p,read,at,o.time,o.salt)+(o.bias??0);',
 P3:"export function sightLag(p:Reader,o:SightContext):number{\n const a=acuity(p,'sight');",
 D1:"export function commitFor(p:PracticePlayer):number{return COMMIT.slow-(COMMIT.slow-COMMIT.fast)*acuity(p,'threat');}",
 D2:"export function callDelay(p:PracticePlayer):number{return CALL_FAST+(CALL_SLOW-CALL_FAST)*(1-acuity(p,'threat'));}",
 D3:" const before=input.view(d,a,RUN_LOOK),h=RUN_EARLY.min+(RUN_EARLY.max-RUN_EARLY.min)*acuity(d,'threat');",
 D4:" const exact=LEAD.min+(LEAD.max-LEAD.min)*acuity(q,'threat');",
 D5:"    const sees=(q:PracticePlayer)=>CLEAR_SEE+CLEAR_SLOW*(1-acuity(q,'threat'))-CLEAR_KEEN*eagerness(q);",
 D6:"sees=COVER_DROP_SEE+COVER_DROP_SLOW*(1-acuity(q,'threat'));",
 D7:' const running=goalward(seen,defending)>=RUN_GOALWARD||!!run;',
 D8:'export function defendOutOfPossession(given:DefendInput):DefendPlan{',
 S1:' const sightings=new Sightings();let sightingsLive=false;',
 S2:'     if(runner&&runnerBehindShoulder(q,runner))lapses.set(',
};
export const hook={name:'defensive-ceiling-hook',setup(b){
 b.onLoad({filter:/practice-perception\.ts$/},a=>{
  let s=readFileSync(a.path,'utf8');
  s=swap(s,A.P1,`export function misread(p:Reader,read:Read):number{if(${IS}(p,'a'))return 0;return clamp(1.05-acuity(p,read),.05,1);}`,'P1');
  s=swap(s,A.P2,` if(${IS}(p,'a'))return exact;\n`+A.P2,'P2');
  s=swap(s,A.P3,`export function sightLag(p:Reader,o:SightContext):number{\n if(${IS}(p,'b'))return 0;\n const a=acuity(p,'sight');`,'P3');
  return {contents:s,loader:'ts'};
 });
 b.onLoad({filter:/practice-defending\.ts$/},a=>{
  let s=readFileSync(a.path,'utf8');
  s=swap(s,A.D1,`export function commitFor(p:PracticePlayer):number{if(${IS}(p,'b'))return COMMIT.fast;return COMMIT.slow-(COMMIT.slow-COMMIT.fast)*acuity(p,'threat');}`,'D1');
  s=swap(s,A.D2,`export function callDelay(p:PracticePlayer):number{if(${IS}(p,'b'))return 0;return CALL_FAST+(CALL_SLOW-CALL_FAST)*(1-acuity(p,'threat'));}`,'D2');
  s=swap(s,A.D3,` const before=input.view(d,a,RUN_LOOK),h=${IS}(d,'b')?RUN_EARLY.max:RUN_EARLY.min+(RUN_EARLY.max-RUN_EARLY.min)*acuity(d,'threat');`,'D3');
  s=swap(s,A.D4,` const exact=${IS}(q,'b')?LEAD.max:LEAD.min+(LEAD.max-LEAD.min)*acuity(q,'threat');`,'D4');
  s=swap(s,A.D5,`    const sees=(q:PracticePlayer)=>${IS}(q,'b')?0:CLEAR_SEE+CLEAR_SLOW*(1-acuity(q,'threat'))-CLEAR_KEEN*eagerness(q);`,'D5');
  s=swap(s,A.D6,`sees=${IS}(q,'b')?0:COVER_DROP_SEE+COVER_DROP_SLOW*(1-acuity(q,'threat'));`,'D6');
  s=swap(s,A.D7,` const running=goalward(seen,defending)>=RUN_GOALWARD||!!run||!!(globalThis as any).__pdRun?.(d.id,a.id);`,'D7');
  s=swap(s,A.D8,'export function defendOutOfPossession(given:DefendInput):DefendPlan{const __c=(globalThis as any).__pdDefend;if(__c&&given.defending===__c.side)return __c.wrap(given,__pdDefendPlain);return __pdDefendPlain(given);}\nfunction __pdDefendPlain(given:DefendInput):DefendPlan{','D8');
  return {contents:s,loader:'ts'};
 });
 b.onLoad({filter:/[\\/]src[\\/]practice\.ts$/},a=>{
  let s=readFileSync(a.path,'utf8');
  s=swap(s,A.S1,A.S1+'(globalThis as any).__pdSideNow=()=>side;','S1');
  s=swap(s,A.S2,`     if(runner&&runnerBehindShoulder(q,runner)&&!${IS}(q,'b'))lapses.set(`,'S2');
  return {contents:s,loader:'ts'};
 });
}};
