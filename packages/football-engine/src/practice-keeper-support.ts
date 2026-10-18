import {clamp} from './model.js';
import type {Tactics} from './model.js';
import {L,W,BOX_DEPTH} from './pitch.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import type {JobCandidate} from './practice-job-selection.js';
import {readSupportLocation,lossThreat} from './practice-support.js';
import {arrivalTime} from './practice-defense.js';
import {keeperReadyPosition,KEEPER_HOME,attackTime,keeperGiveBack,KEEPER_SPRINT} from './practice-keeper.js';
import {LOSS_SCALE,LOSS_OWN,lossDanger,restDefence} from './practice-rest-defence.js';

type Risk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
/** Keeper fix (2026-10-19): what a loss with him at a point would give away. "If we lose the ball now, how out of
 * position am I" comes first, the angle he offers second. He prices each point by:
 *  - how likely a loss is right now: LOSS_LIKELY always (a pass can be cut out, a touch can go astray), more as the
 *    carrier is pressed (the nearest opponent within 7 m) or as the ball to this very point could be cut out (its lane);
 *  - what a loss at the ball would give them: the shot the man who wins it gets near our goal, or the counter further
 *    up with whoever is free behind the ball (lossThreat, lossDanger with the rest defence: the passers' own reads), as
 *    a share of a loss on our goal line;
 *  - how much of the goal he would leave open to it: the metres still between him and his ready spot when they could
 *    shoot (attackTime from the ball, his sprint back after his reaction: keeperGiveBack), from OPEN_FROM m (about
 *    where shots stopped beating a set keeper) growing over OPEN_SPAN m (full from 4 m off) to EMPTY_NET, the goals a shot gains against a
 *    keeper that far off (the study's shots: goals minus their chance -0.07 with him set, +0.17 at 3-6 m off, +0.24 beyond);
 *  - a sweeper accepts a little more of it (SWEEPER_EASE): his habit, not a licence to leave the goal.
 * In the loss price's units (LOSS_SCALE). It comes on top of his old habit (the return time, more of it with the carrier
 * pressed), which alone read a 1.06 s standing-start run back (about 1.5 s or more was observed) and ignored where the ball
 * was and who was goal-side: he offered points 5 m beside his goal at a ball 10 m out on every setting. Far from his goal,
 * with team-mates behind the ball and the carrier free, it adds nothing and his angle is what it was. */
export const LOSS_LIKELY=.25,OPEN_FROM=1,OPEN_SPAN=3,EMPTY_NET=.3,SWEEPER_EASE=.3;
/** A keeper offers a return angle while pricing what a turnover would leave
 * open behind him. The selected movement uses ordinary physics;
 * defending, saves and sweeps retain their live-ball decisions. */
export function keeperSupportCandidates(p:PracticePlayer,focus:PracticePlayer,players:PracticePlayer[],tactics:Tactics,risk:Risk,time:number):JobCandidate[]{
 const depth=(v:Vec)=>p.side===0?v.x:L-v.x,world=(x:number)=>p.side===0?x:L-x;
 const bd=depth(focus),ready=keeperReadyPosition(p,focus,true);
 const attackers=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 const nearest=Math.min(...attackers.map(q=>Math.hypot(q.x-focus.x,q.y-focus.y)));
 const danger=clamp((7-nearest)/6,0,1),sweep=clamp(p.traits.keeperSweep??.2,0,1);
 const baseline={x:world(3+bd*.035),y:clamp(focus.y*.15,-2,2)};
 // (settings-truth round) a keeper who stays on his line offers the angle from his own area, not 15-20 m
 // out as a sweeper-keeper does (the default trait, 0.2, and up: unchanged)
 // (keeper fix, 2026-10-19) ... inside it: "he stays in his area when you have the ball" (the setting's words). His far
 // point was a metre outside it, and he stood 8 m+ out in 16% of his side's possession with the ball 24-32 m out.
 const home=clamp((sweep-KEEPER_HOME)/(.2-KEEPER_HOME),0,1),reachOut=BOX_DEPTH-1+home*(L*.42-BOX_DEPTH+1);
 const step=clamp(bd-12,{deep:3,standard:4,high:5}[tactics.line],reachOut);
 // (keeper fix, 2026-10-19) ... and with the ball in our third (where a loss is a shot) staying set on his ready spot is
 // one of his options: with a team-mate on the ball right in front of goal the baseline and the middle points are on the
 // carrier's own spot, and the only points left were 5 m to either side of the goal, so he went wide however the price
 // read them. (Further out it is not offered: it took the sweeper's height in his side's possession away, 8.0 to 5.8 m.)
 const points=[baseline,...[Math.max(2,step-4),step].flatMap(x=>[-5,0,5].map(y=>({x:world(x),y:clamp(focus.y*.4+y,-W*.3,W*.3)}))),...(bd<16?[ready]:[])];
 const given=Math.min(1,Math.max(lossThreat(p.side,focus,players,focus.id),lossDanger(bd/L,restDefence(focus,players).deficit))/LOSS_OWN);
 const back=keeperGiveBack(p,attackTime(p.side,focus,attackers),KEEPER_SPRINT);
 return points.map(aim=>{
  const read=readSupportLocation(p,aim,players,focus,risk,false,p.pace*.78);
  const returnTime=arrivalTime({...p,...aim,vx:0,vy:0},ready);
  const open=(1-read.risk)*read.releaseRoom*clamp((read.gap-3)/3,0,1)*clamp((26-read.gap)/10,0,1);
  const likely=LOSS_LIKELY+(1-LOSS_LIKELY)*Math.max(danger,clamp(read.risk,0,1));
  const left=clamp((Math.hypot(aim.x-ready.x,aim.y-ready.y)-back-OPEN_FROM)/OPEN_SPAN,0,1);
  const exposed=LOSS_SCALE*likely*given*EMPTY_NET*left*(1-SWEEPER_EASE*sweep);
  return {score:.6+open*.7-read.travel*.055-returnTime*(.12+(1-sweep)*.07+danger*.25)-exposed,job:{player:p.id,purpose:'build-up',kind:'keeper',aim,speed:p.pace*.78,since:time,until:time+2,reason:'Oferă un unghi de întoarcere, cântărind timpul necesar revenirii în poartă.'}};
 });
}
