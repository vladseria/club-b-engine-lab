import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {bodyTurnRate} from './practice-reception.js';
import {WORLD} from './world.js';
/** Hot-path aliases (engine as data W9b): world reads used inside this file's functions, read once at load. */
const BALL_KICK_CLEAR_BASE=WORLD.ball.kick.clearBase.v;
const BALL_KICK_CLEAR_PER=WORLD.ball.kick.clearPer.v;
const BALL_KICK_PASS_BASE=WORLD.ball.kick.passBase.v;
const BALL_KICK_PASS_PER=WORLD.ball.kick.passPer.v;
const BALL_KICK_PASS_TIRED_FLOOR=WORLD.ball.kick.passTiredFloor.v;
const BALL_KICK_PASS_TIRED_SHARE=WORLD.ball.kick.passTiredShare.v;
const BALL_KICK_SHOT_BASE=WORLD.ball.kick.shotBase.v;
const BALL_KICK_SHOT_PER=WORLD.ball.kick.shotPer.v;
const ERROR_STRIKING_ERROR_BASE=WORLD.error.striking.errorBase.v;
const ERROR_STRIKING_ERROR_TECHNIQUE=WORLD.error.striking.errorTechnique.v;
const ERROR_STRIKING_PASS_POWER_LOSS=WORLD.error.striking.passPowerLoss.v;
const ERROR_STRIKING_PASS_TURN_LIMIT=WORLD.error.striking.passTurnLimit.v;
const ERROR_STRIKING_SHOT_POWER_LOSS=WORLD.error.striking.shotPowerLoss.v;
const ERROR_STRIKING_SHOT_TURN_LIMIT=WORLD.error.striking.shotTurnLimit.v;
const ERROR_STRIKING_SIDEWAYS_BASE=WORLD.error.striking.sidewaysBase.v;
const ERROR_STRIKING_SIDEWAYS_SPEED=WORLD.error.striking.sidewaysSpeed.v;
const ERROR_STRIKING_STRETCH_FROM=WORLD.error.striking.stretchFrom.v;
const ERROR_STRIKING_STRETCH_SHARE=WORLD.error.striking.stretchShare.v;
const ERROR_STRIKING_STRETCH_SPAN=WORLD.error.striking.stretchSpan.v;
const ERROR_STRIKING_TECHNIQUE_CONTROL=WORLD.error.striking.techniqueControl.v;
const ERROR_STRIKING_TECHNIQUE_KICK=WORLD.error.striking.techniqueKick.v;
const ERROR_STRIKING_TECHNIQUE_POWER_SAVE=WORLD.error.striking.techniquePowerSave.v;

export type StrikeKind='pass'|'shot'|'clearance';
const difference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const smooth=(n:number)=>{const x=clamp(n,0,1);return x*x*(3-2*x);};

/** A lightweight repertoire, not a requirement to point the torso at the target.
 * Forward strikes and side-foot strikes share real foot/body contact checks.
 * Backheels are not assumed: a target beyond this repertoire needs a body turn.
 * These envelopes are prototype parameters, not measured human limits. */
export function strikeStance(p:PracticePlayer,ball:Vec,aim:Vec,kind:StrikeKind='pass'){
 const angle=Math.abs(difference(Math.atan2(aim.y-ball.y,aim.x-ball.x),p.angle));
 const limit=(kind==='shot'?ERROR_STRIKING_SHOT_TURN_LIMIT:ERROR_STRIKING_PASS_TURN_LIMIT)*Math.PI/180;
 const sideways=smooth((angle-Math.PI/3)/(limit-Math.PI/3));
 const stretch=smooth((Math.hypot(ball.x-p.x,ball.y-p.y)-ERROR_STRIKING_STRETCH_FROM)/ERROR_STRIKING_STRETCH_SPAN);
 const speed=clamp(Math.hypot(p.vx,p.vy)/p.basePace,0,1);
 const technique=clamp((p.skills.control*ERROR_STRIKING_TECHNIQUE_CONTROL+(kind==='shot'?p.skills.finishing:p.skills.passing)*ERROR_STRIKING_TECHNIQUE_KICK)/10,0,1);
 const difficulty=clamp(sideways*(ERROR_STRIKING_SIDEWAYS_BASE+speed*ERROR_STRIKING_SIDEWAYS_SPEED)+stretch*ERROR_STRIKING_STRETCH_SHARE,0,1);
 return {angle,limit,available:angle<=limit,technique:angle<=Math.PI/3?'forward' as const:'side-foot' as const,difficulty,
  powerScale:1-difficulty*(kind==='shot'?ERROR_STRIKING_SHOT_POWER_LOSS:ERROR_STRIKING_PASS_POWER_LOSS)*(1-technique*ERROR_STRIKING_TECHNIQUE_POWER_SAVE),
  errorScale:1+difficulty*(ERROR_STRIKING_ERROR_BASE+(1-technique)*ERROR_STRIKING_ERROR_TECHNIQUE)};
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
 const normal=kind==='shot'?BALL_KICK_SHOT_BASE+p.skills.finishing*BALL_KICK_SHOT_PER:kind==='clearance'?BALL_KICK_CLEAR_BASE+p.skills.strength*BALL_KICK_CLEAR_PER:(BALL_KICK_PASS_BASE+clamp(p.skills.strength,0,10)*BALL_KICK_PASS_PER)*(BALL_KICK_PASS_TIRED_FLOOR+BALL_KICK_PASS_TIRED_SHARE*p.energy/100);
 return normal*strikeStance(p,ball,aim,kind).powerScale;
}

export function strikeTurnTime(p:PracticePlayer,aim:Vec,kind:StrikeKind='pass'){
 const stance=strikeStance(p,p,aim,kind);
 const rate=bodyTurnRate(p);
 return Math.max(0,stance.angle-stance.limit)/rate;
}
