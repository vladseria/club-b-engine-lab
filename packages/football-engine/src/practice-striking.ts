import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {bodyTurnRate} from './practice-reception.js';
import {WORLD} from './world.js';

export type StrikeKind='pass'|'shot'|'clearance';
const difference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const smooth=(n:number)=>{const x=clamp(n,0,1);return x*x*(3-2*x);};

/** A lightweight repertoire, not a requirement to point the torso at the target.
 * Forward strikes and side-foot strikes share real foot/body contact checks.
 * Backheels are not assumed: a target beyond this repertoire needs a body turn.
 * These envelopes are prototype parameters, not measured human limits. */
export function strikeStance(p:PracticePlayer,ball:Vec,aim:Vec,kind:StrikeKind='pass'){
 const angle=Math.abs(difference(Math.atan2(aim.y-ball.y,aim.x-ball.x),p.angle));
 const limit=(kind==='shot'?WORLD.error.striking.shotTurnLimit.v:WORLD.error.striking.passTurnLimit.v)*Math.PI/180;
 const sideways=smooth((angle-Math.PI/3)/(limit-Math.PI/3));
 const stretch=smooth((Math.hypot(ball.x-p.x,ball.y-p.y)-WORLD.error.striking.stretchFrom.v)/WORLD.error.striking.stretchSpan.v);
 const speed=clamp(Math.hypot(p.vx,p.vy)/p.basePace,0,1);
 const technique=clamp((p.skills.control*WORLD.error.striking.techniqueControl.v+(kind==='shot'?p.skills.finishing:p.skills.passing)*WORLD.error.striking.techniqueKick.v)/10,0,1);
 const difficulty=clamp(sideways*(WORLD.error.striking.sidewaysBase.v+speed*WORLD.error.striking.sidewaysSpeed.v)+stretch*WORLD.error.striking.stretchShare.v,0,1);
 return {angle,limit,available:angle<=limit,technique:angle<=Math.PI/3?'forward' as const:'side-foot' as const,difficulty,
  powerScale:1-difficulty*(kind==='shot'?WORLD.error.striking.shotPowerLoss.v:WORLD.error.striking.passPowerLoss.v)*(1-technique*WORLD.error.striking.techniquePowerSave.v),
  errorScale:1+difficulty*(WORLD.error.striking.errorBase.v+(1-technique)*WORLD.error.striking.errorTechnique.v)};
}

/** Modify the existing sampled execution error once; no second failure roll.
 * A routine short pass keeps its planned weight. Awkward stance limits maximum
 * power rather than multiplying every pass into an unnecessary underhit. */
export function fitStrikeToStance(p:PracticePlayer,ball:Vec,aim:Vec,velocity:{vx:number;vy:number;vz:number},kind:StrikeKind){
 const stance=strikeStance(p,ball,aim,kind),desired=Math.atan2(aim.y-ball.y,aim.x-ball.x);
 const actual=Math.atan2(velocity.vy,velocity.vx),angle=desired+difference(actual,desired)*stance.errorScale;
 const requested=Math.hypot(velocity.vx,velocity.vy,velocity.vz);
 // Preserve the existing full strike (including height and sampled overhits)
 // at zero difficulty. Apply only the additional stance restriction, smoothly;
 // comparing a 3D shot with its old horizontal limit would create a sudden loss.
 const normal=strikePowerLimit(p,ball,aim,kind)/stance.powerScale;
 const factor=Math.min(1,Math.max(normal,requested)*stance.powerScale/Math.max(.001,requested));
 const speed=Math.hypot(velocity.vx,velocity.vy)*factor;
 return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:velocity.vz*factor};
}

export function strikePowerLimit(p:PracticePlayer,ball:Vec,aim:Vec,kind:StrikeKind='pass'){
 const normal=kind==='shot'?WORLD.ball.kick.shotBase.v+p.skills.finishing*WORLD.ball.kick.shotPer.v:kind==='clearance'?WORLD.ball.kick.clearBase.v+p.skills.strength*WORLD.ball.kick.clearPer.v:(WORLD.ball.kick.passBase.v+clamp(p.skills.strength,0,10)*WORLD.ball.kick.passPer.v)*(WORLD.ball.kick.passTiredFloor.v+WORLD.ball.kick.passTiredShare.v*p.energy/100);
 return normal*strikeStance(p,ball,aim,kind).powerScale;
}

export function strikeTurnTime(p:PracticePlayer,aim:Vec,kind:StrikeKind='pass'){
 const stance=strikeStance(p,p,aim,kind);
 const rate=bodyTurnRate(p);
 return Math.max(0,stance.angle-stance.limit)/rate;
}
