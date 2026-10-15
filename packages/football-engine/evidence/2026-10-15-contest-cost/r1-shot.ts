// Contest cost (2026-10-15): R1's shot-read pieces that the contest build removed, copied verbatim from ballers-r1
// ce74b470 (packages/football-engine/src/practice-football.ts shotHurry + HURRY_*, HURRIED_READ; practice.ts
// SHOT_BELIEF), for the ~noshot ablation (ablate.mjs). Evidence only: the engine never imports this file.
import {clamp} from '../../src/model';
import type {PracticePlayer} from '../../src/practice';
import type {Vec} from '../../src/movement';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
export const HURRIED_READ=.3,SHOT_BELIEF=.25;
export const HURRY_NEAR=2.5,HURRY_FULL=2,HURRY_FIRST=.3;
/** How hurried a shot from here is (0 settled .. 1): a defender close, striking across his own run, first time. */
export function shotHurry(p:PracticePlayer,players:readonly PracticePlayer[],aim:Vec,firstTime=false):number{
 const nearest=Math.min(99,...players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>distance(q,p)));
 const close=clamp((HURRY_NEAR-nearest)/HURRY_FULL,0,1);
 const speed=Math.hypot(p.vx,p.vy),running=clamp(speed/Math.max(1,p.basePace),0,1);
 let offBalance=0;
 if(speed>.5){const a=Math.atan2(p.vy,p.vx),b=Math.atan2(aim.y-p.y,aim.x-p.x),d=Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));offBalance=running*clamp((d-.6)/1.4,0,1);}
 return 1-(1-close)*(1-offBalance)*(1-(firstTime?HURRY_FIRST:0));
}
