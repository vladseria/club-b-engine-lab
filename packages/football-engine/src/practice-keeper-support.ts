import {clamp} from './model.js';
import type {Tactics} from './model.js';
import {L,W,BOX_DEPTH} from './pitch.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import type {JobCandidate} from './practice-job-selection.js';
import {readSupportLocation} from './practice-support.js';
import {arrivalTime} from './practice-defense.js';
import {keeperReadyPosition,KEEPER_HOME} from './practice-keeper.js';

type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
/** A keeper offers a return angle while pricing the time needed to protect
 * the goal after a turnover. The selected movement uses ordinary physics;
 * defending, saves and sweeps retain their live-ball decisions. */
export function keeperSupportCandidates(p:PracticePlayer,focus:PracticePlayer,players:PracticePlayer[],tactics:Tactics,risk:Risk,time:number):JobCandidate[]{
 const depth=(v:Vec)=>p.side===0?v.x:L-v.x,world=(x:number)=>p.side===0?x:L-x;
 const bd=depth(focus),ready=keeperReadyPosition(p,focus,true);
 const nearest=Math.min(...players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>Math.hypot(q.x-focus.x,q.y-focus.y)));
 const danger=clamp((7-nearest)/6,0,1),sweep=clamp(p.traits.keeperSweep??.2,0,1);
 const baseline={x:world(3+bd*.035),y:clamp(focus.y*.15,-2,2)};
 // (settings-truth round) a keeper who stays on his line offers the angle from his own area, not 15-20 m
 // out as a sweeper-keeper does (the default trait, 0.2, and up: unchanged)
 const home=clamp((sweep-KEEPER_HOME)/(.2-KEEPER_HOME),0,1),reachOut=BOX_DEPTH+1+home*(L*.42-BOX_DEPTH-1);
 const step=clamp(bd-12,{deep:3,standard:4,high:5}[tactics.line],reachOut);
 const points=[baseline,...[Math.max(2,step-4),step].flatMap(x=>[-5,0,5].map(y=>({x:world(x),y:clamp(focus.y*.4+y,-W*.3,W*.3)})))];
 return points.map(aim=>{
  const read=readSupportLocation(p,aim,players,focus,risk,false,p.pace*.78);
  const returnTime=arrivalTime({...p,...aim,vx:0,vy:0},ready);
  const open=(1-read.risk)*read.releaseRoom*clamp((read.gap-3)/3,0,1)*clamp((26-read.gap)/10,0,1);
  return {score:.6+open*.7-read.travel*.055-returnTime*(.12+(1-sweep)*.07+danger*.25),job:{player:p.id,purpose:'build-up',kind:'keeper',aim,speed:p.pace*.78,since:time,until:time+2,reason:'Oferă un unghi de întoarcere, cântărind timpul necesar revenirii în poartă.'}};
 });
}
