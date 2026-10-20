import {clamp} from './model.js';
import {WORLD} from './world.js';

/** Recovery follows the duel (2026-10-16). Before, every close-quarters loss cost the same: the beaten man 0.6 s plus
 * 0.03 s a strength point under 10 (a touch ban of half that, except after a won tackle, where he had none and picked
 * the loose ball straight back up), the tackler always 1.4 s from the start of his challenge, a reception-duel lunge
 * that missed 0.45 s. Nobody went to ground.
 *
 * Now each player's time out of the play comes from what physically happened to his body in the duel:
 * - The man who lost the ball must first put down the foot the ball was taken from (a step), and then absorb whatever
 *   of the tackler's momentum went into him rather than into the ball. A poke that only meets the ball costs him the
 *   step; a boot through his standing leg, or a body arriving at speed, costs him his balance for longer, and past a
 *   point he goes down and needs a second or so to get up.
 * - The tackler pays for how he committed. His planted foot has to come back under him; whatever momentum and reach he
 *   put into the lunge has to be arrested by his own legs if his foot met nothing (a miss), and is mostly absorbed by
 *   the ball or the man when it met something (a nick or a tackle through him). Contact through a man jolts him too,
 *   less than the man he hit, because he was braced for it.
 * - Strength is mass and core stability: a strong man's tackle lands harder and he rides a hit better. Defending is
 *   technique: a good defender's foot stops sooner (shorter follow-through, practice-challenge followThroughOf) and his
 *   body stays over the tackle, so a lunge costs him less.
 *
 * No source measures these times (recovery probe, 2026-10-15). The anchors are lab balance-recovery times after a
 * landing or a jolt, about 1-2 s to full steadiness, and futsal footage, where a man who goes down is up within a
 * second or two. Every constant below says what it stands for. */

/** The foot the ball was taken from must be put down again before he can go in or take a controlled touch: one step,
 * about 0.35 s for a strong man (a stride at match tempo is 0.3-0.4 s), STEP_STRENGTH s longer a point under 10. */
export const STEP=WORLD.contact.balance.FOOT_STEP.v,STEP_STRENGTH=WORLD.contact.balance.STEP_STRENGTH.v;
/** How much of the tackler's closing speed goes into the man rather than the ball: none for a boot that meets only the
 * ball, LEG_AFTER_BALL when the boot goes through the ball into his shin (the ball took some of it), LEG_FIRST when his
 * leg is taken before the ball (his support goes: a trip), all of it in a body collision. */
export const LEG_AFTER_BALL=WORLD.contact.balance.LEG_AFTER_BALL.v,LEG_FIRST=WORLD.contact.balance.LEG_FIRST.v,COLLISION=WORLD.contact.balance.COLLISION.v;
/** A leg taken from under a running man is a trip: his own momentum carries him over the leg that is no longer there,
 * whoever was faster. TRIP_FIRST of his own speed when his leg goes before the ball, TRIP_AFTER_BALL when the boot came
 * through the ball into his shin (it takes less of his leg); a collision or a poke takes no leg. */
export const TRIP_FIRST=WORLD.contact.balance.TRIP_FIRST.v,TRIP_AFTER_BALL=WORLD.contact.balance.TRIP_AFTER_BALL.v;
/** Strength scales a hit both ways, STRENGTH_HIT a point from 6: the same closing speed lands harder from a strong man
 * and is ridden better by one (about +-25% across the scale). */
export const STRENGTH_HIT=WORLD.contact.balance.STRENGTH_HIT.v;
/** Off balance this much longer per m/s of the hit he takes (a 3 m/s collision on an even match-up: 0.66 s on top of
 * the step, about the 1-1.5 s of a lab jolt in all). */
export const IMPACT_TIME=WORLD.contact.balance.IMPACT_TIME.v;
/** Past FALL_FROM m/s of hit his feet cannot get back under him in time and he may go down, surely at FALL_FROM +
 * FALL_SPAN: a man shoulder-charged at a jog stays up, one hit at a sprint goes over. */
export const FALL_FROM=WORLD.contact.balance.FALL_FROM.v,FALL_SPAN=WORLD.contact.balance.FALL_SPAN.v;
/** On the floor: FLOOR s, up to FLOOR_SEVERE more for the hardest hits, FLOOR_STRENGTH s less a strength point above 6;
 * then RISE s getting up and steady before he can go in again (he moves, but cannot challenge). In all about 1-2 s. */
export const FLOOR=WORLD.contact.balance.FLOOR.v,FLOOR_SEVERE=WORLD.contact.balance.FLOOR_SEVERE.v,FLOOR_STRENGTH=WORLD.contact.balance.FLOOR_STRENGTH.v,RISE=WORLD.contact.balance.RISE.v;
/** A body on the floor slides to a stop: the speed he keeps at the moment he goes down. */
export const FALL_KEEP=WORLD.contact.balance.FALL_KEEP.v;

/** The tackler: his planted foot has to come back under him even after a clean nick (PLANT s). A lunge adds: its reach
 * past a comfortable step (STRETCH_FROM m, at most 1.3 m: practice-challenge resolveChallengeContact) at STRETCH_TIME s
 * for a full stretch, his closing speed at MOMENTUM_TIME s per m/s, and the boot's follow-through at FOLLOW_TIME s per
 * metre. When the boot met the ball or the man, only RESISTED of that lunge is his to arrest; a miss is all his. */
export const PLANT=WORLD.contact.balance.PLANT.v,STRETCH_FROM=WORLD.contact.balance.STRETCH_FROM.v,STRETCH_SPAN=WORLD.contact.balance.STRETCH_SPAN.v,STRETCH_TIME=WORLD.contact.balance.STRETCH_TIME.v,MOMENTUM_TIME=WORLD.contact.balance.MOMENTUM_TIME.v,FOLLOW_TIME=WORLD.contact.balance.FOLLOW_TIME.v,RESISTED=WORLD.contact.balance.RESISTED.v;
/** A good defender's body stays over his tackle: the lunge costs DEFENDING_BALANCE less (more) a point above (below) 6. */
export const DEFENDING_BALANCE=WORLD.contact.balance.DEFENDING_BALANCE.v;
/** Braced for the contact he chose, the tackler takes BRACED of the hit he gives. */
export const BRACED=WORLD.contact.balance.BRACED.v;
/** A tackler whose boot met nothing spends the first TACKLER_STAGGER of his recovery getting his feet back under him:
 * he only recovers his position, and nobody counts on him for the ball; for the rest he moves normally but cannot go in
 * again (before: 0.45 s, or 0.4 s when the ball was gone before his foot arrived). */
export const TACKLER_STAGGER=WORLD.contact.balance.TACKLER_STAGGER.v;
/** A kick blocked at his feet: his kicking leg is still swinging through, about this long, before it lands. */
export const KICK_FOLLOW=WORLD.contact.balance.KICK_FOLLOW.v;

type Body={skills:{strength:number;defending:number}};
const s10=(n:number)=>clamp(n,0,10);

/** The duel's outcome for one player, as durations from now (s). down 0 = he stays on his feet. */
export interface Balance {challenge:number;touch:number;down:number;hit:number}

/** The hit (m/s) the duel puts into the man: the share of the tackler's closing speed that goes into him (LEG_*,
 * COLLISION) and, when his leg is taken, the share of his own speed (`ownSpeed`, m/s) that trips him (TRIP_*). */
export function contactLoad(c:{closingSpeed:number;ballFirst:boolean;leg:boolean;collision:boolean},ownSpeed=0):number{
 const share=c.collision?COLLISION:c.leg?(c.ballFirst?LEG_AFTER_BALL:LEG_FIRST):0;
 const trip=c.collision||!c.leg?0:c.ballFirst?TRIP_AFTER_BALL:TRIP_FIRST;
 return Math.max(0,c.closingSpeed)*share+Math.max(0,ownSpeed)*trip;
}
/** The hit as the struck man feels it: the load, harder from a strong hitter, ridden better by a strong man. */
export const felt=(load:number,hitter:Body,struck:Body)=>load*Math.max(.5,1+STRENGTH_HIT*(s10(hitter.skills.strength)-6))/Math.max(.5,1+STRENGTH_HIT*(s10(struck.skills.strength)-6));
/** The chance a hit of `hit` m/s puts him on the floor. */
export const fallChance=(hit:number)=>clamp((hit-FALL_FROM)/FALL_SPAN,0,1);

/** A man who took a hit of `hit` m/s (0: the ball was simply taken off his foot). `roll` in [0, 1) decides a fall
 * (fallChance); `extra` adds a fixed cost (a kick still swinging through, KICK_FOLLOW). */
export function struck(p:Body,hit:number,roll:number,extra=0):Balance{
 const step=STEP+STEP_STRENGTH*(10-s10(p.skills.strength))+extra;
 const chance=fallChance(hit);
 if(chance>0&&roll<chance){
  const severity=clamp((hit-FALL_FROM)/FALL_SPAN,0,1);
  const down=Math.max(.5,FLOOR+FLOOR_SEVERE*severity-FLOOR_STRENGTH*(s10(p.skills.strength)-6));
  return {challenge:down+RISE,touch:down,down,hit};
 }
 return {challenge:step+IMPACT_TIME*hit,touch:step,down:0,hit};
}

/** The tackler after his lunge: `reach` (m, foot from body), `closing` (m/s into the man), `followThrough` (m),
 * whether his boot met the ball or the man (`met`), and the hit he gave (m/s as the man felt it, 0 for none). */
export function lunged(d:Body,l:{reach:number;closing:number;followThrough:number;met:boolean;hit:number},roll:number):Balance{
 const stretch=clamp((l.reach-STRETCH_FROM)/STRETCH_SPAN,0,1);
 const lunge=(STRETCH_TIME*stretch+MOMENTUM_TIME*Math.max(0,l.closing)+FOLLOW_TIME*Math.max(0,l.followThrough))*Math.max(.5,1-DEFENDING_BALANCE*(s10(d.skills.defending)-6));
 const own=PLANT+(l.met?RESISTED:1)*lunge;
 // the jolt of a tackle through the man: his own feet were set for it, so no step to replant, only the hit to ride
 const jolt=l.hit*BRACED,fall=jolt>0?struck(d,jolt,roll):undefined;
 if(fall?.down)return fall;
 return {challenge:own+IMPACT_TIME*jolt,touch:0,down:0,hit:jolt};
}
