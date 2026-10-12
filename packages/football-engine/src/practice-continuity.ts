import type {MovingBall,Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';

/** Remember the intention during a short local scramble, not possession itself.
 * Callers suspend tactical assignments: ordinary football decides who collects.
 * No prediction of a winner, completed pass, or successful touch is made here. */
export class LooseBallContinuity {
 private interruption?:{since:number;origin:Vec};
 get suspended(){return !!this.interruption;}
 clear(){this.interruption=undefined;}
 update(time:number,ball:MovingBall,participants:PracticePlayer[]):'play'|'pause'|'expired' {
  if(!ball.owner&&ball.mode==='loose')this.interruption??={since:time,origin:{x:ball.x,y:ball.y}};
  const interruption=this.interruption;
  if(!interruption)return 'play';
  const local=Math.hypot(ball.x-interruption.origin.x,ball.y-interruption.origin.y)<=6;
  const nearby=participants.some(p=>Math.hypot(p.x-ball.x,p.y-ball.y)<=5);
  if(time-interruption.since>1.2||!local||!nearby)return 'expired';
  if(ball.owner){this.clear();return 'play';}
  return 'pause';
 }
}
