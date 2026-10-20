import {L,GH} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {composure,daring,nerve,perceive,misread} from './practice-perception.js';
import {WORLD} from './world.js';

/** (contest: pressure on the shooter, 2026-10-15) What the defence does to a shot, as football does it. Before, a man
 * on the shooter only counted by his distance (2.5 m or nearer) and a body in front of him only by whether the ball hit
 * it, so a defence could stop shots happening but barely make the ones it allowed worse. Now three things the
 * defenders do, each read from what is visible at the strike, rush, crowd and unsettle it:
 *  - TIME (rush): how near a man is by the time the foot meets the ball: his distance less what he closes in the
 *    swing (SWING s at his closing speed), so a man sprinting in from 3 m rushes it as much as one standing at 2 m. A
 *    sharp reader sees the shot coming and is there sooner (CLOSE_READ m per 5 points of reading). Rushed from RUSH_FAR
 *    m, fully at RUSH_NEAR m (as the old 2.5 to 0.5 m read, for a man standing still).
 *  - ANGLE (shadow): the share of the goal mouth that bodies within SHADOW_NEAR m of the ball hide from it. A good
 *    defender closes more of it (his leg, SHADOW_LEG x defending, beside his body, SHADOW_BODY). Fully cramped only
 *    when SHADOW_FULL of the goal is hidden: a gap is still a chance.
 *  - BALANCE: shoulder to shoulder (a man within CONTACT_NEAR..CONTACT_FAR m) or just out of a duel (DUEL_FADE s after
 *    a tackle he rode or a dribble).
 * How much of that reaches the strike is the shooter's (poise): finishing and composure resist it. A typical
 * finisher (poise POISE_TYPICAL) feels all of it, a better one less and a worse one more, RESIST per point of poise
 * (KEPT_MIN..KEPT_MAX of it). What is left (with what he does to himself: striking across his own
 * run, or first time, as before) is the shot's hurry, and it acts as before, only now from all of this: a hurried shot
 * is placed nearer the keeper and struck softer (practice-football placeHurried, strikeShot), and the keeper's edge
 * against it grows (keeperEdge). Never a wilder miss: the striking error is untouched. A free shot is what it was. */
export const RUSH_FAR=WORLD.contact.shotContest.RUSH_FAR.v,RUSH_NEAR=WORLD.contact.shotContest.RUSH_NEAR.v,SWING=WORLD.contact.shotContest.SWING.v,CLOSE_READ=WORLD.contact.shotContest.CLOSE_READ.v;
export const SHADOW_NEAR=WORLD.contact.shotContest.SHADOW_NEAR.v,SHADOW_BODY=WORLD.contact.shotContest.SHADOW_BODY.v,SHADOW_LEG=WORLD.contact.shotContest.SHADOW_LEG.v,SHADOW_FULL=WORLD.contact.shotContest.SHADOW_FULL.v;
export const CONTACT_FAR=WORLD.contact.shotContest.CONTACT_FAR.v,CONTACT_NEAR=WORLD.contact.shotContest.CONTACT_NEAR.v,DUEL_FADE=WORLD.contact.shotContest.DUEL_FADE.v;
export const RESIST=WORLD.contact.shotContest.RESIST.v,POISE_TYPICAL=WORLD.contact.shotContest.POISE_TYPICAL.v,KEPT_MIN=WORLD.contact.shotContest.KEPT_MIN.v,KEPT_MAX=WORLD.contact.shotContest.KEPT_MAX.v;
/** Striking across his own run (as shotHurry) and first time (HURRY_FIRST): what he does to himself. */
export const FIRST_TIME=WORLD.contact.shotContest.FIRST_TIME.v;
/** (2026-10-15, owner: "how well they read the game, rather than hardcoded") What the hurry costs his shot, as HE reads
 * it (practice-perception perceive, read 'shot': reading 0.6, finishing 0.4). Before, every shooter read it as the same
 * HURRIED_READ 0.3 x hurry.
 *  - The cost there is: HURRY_COST of the goal chance per unit of hurry. Through the engine's own shot functions
 *    (placeHurried, strikeShot's pace, keeperEdge, readKeeperFlight's reach), a fully hurried 6-12 m foot shot keeps
 *    3-26% of a free one's goals depending on the keeper (set or not, keeping 4-6); measured on R1, a man within 2 m
 *    left a third (0.24 to 0.08 goals a shot). HURRY_COST sits at the measured, gentler end: the owner asked for
 *    "substantially closer to the truth", not the whole of it.
 *  - What a reader sees of it: a perfect one nearly all (HURRY_UNDER x his misread short of it, plus spread); a poor
 *    one clearly less and less reliably (misread 0.65: about half of it, give or take a third). The error leans to
 *    underestimating it (bias, never more than HURRY_SEEN_MAX of it): the pull to the keeper and his edge are what a
 *    shooter learns last.
 *  - This is the one place pressure enters his read of the chance (shotRead). What he does with the chance he reads
 *    is his temperament, on the choice (shotTemper), never on the read.
 * (shot fix, 2026-10-15, after the contest cloud round: shooters with a man under 2 m shot more, 27% to 34% of their
 * choices, and those shots scored 5%) Two corrections, both towards what was measured:
 *  - The cost there is grows faster than the hurry (hurryTruth: HURRY_COST x hurry^HURRY_CURVE). Measured on the
 *    contest build (640 matches, foot shots 6-12 m, read units: the read's goal rate goes about with its square,
 *    luck study), a free shot keeps all of its chance, hurry 0.35 about 0.87 of it, 0.65 about 0.62, 0.88 about 0.48
 *    and a full hurry about 0.32: a little hurry costs little (the shot is still placed, the keeper barely gains), a
 *    lot costs most of it (pulled to the keeper, struck soft, half of them blocked). HURRY_CURVE 1.5 with HURRY_COST
 *    0.7 follows that (0.86, 0.63, 0.42, 0.30); the straight line read a mildly hurried free chance as worse than it is
 *    and a man on top of him as better.
 *  - What a reader misses of it falls faster than his misread (HURRY_UNDER x misread^2): a man on top of you is
 *    plain to see, and what it does to the shot is missed mostly by men who read the game badly. A good reader (8/7)
 *    now sees about 0.93 of it ("a good reader sees nearly all", the owner; it was 0.76), a typical one (6/6) about
 *    0.84 (0.63), a poor one (3/3) still only about 0.6, and less reliably (the spread is unchanged). */
export const HURRY_COST=.7,HURRY_CURVE=1.5,HURRY_UNDER=.8,HURRY_SPREAD=.5,HURRY_SEEN_MAX=1.3;
/** What the hurry really costs a shot's chance, as a share of it (before anyone's read of it). */
export const hurryTruth=(hurry:number)=>HURRY_COST*clamp(hurry,0,1)**HURRY_CURVE;
export function hurryCost(p:Pick<PracticePlayer,'skills'|'traits'|'id'|'side'>,hurry:number,at:Vec,time?:number):number{
 const miss=misread(p,'shot');
 const seen=clamp(perceive(p,'shot',1,HURRY_SPREAD,at,{time,salt:'hurry',bias:-HURRY_UNDER*miss*miss}),0,HURRY_SEEN_MAX);
 return hurryTruth(hurry)*seen;
}

/** (shot decision, 2026-10-15, owner: "what's the chance" is a skill, "do I take it" is a personality) The shooter's
 * read of his chance: the chance the place gives a free shot (`open`: practice-football assessShot's angle, distance
 * and keeper, before any pressure) less what the contest at the strike costs it as he reads it (hurryCost: time, angle
 * and balance, the one place pressure enters), misjudged as a whole by his reading and finishing (perceive, read
 * 'shot': a relative error up to SHOT_SPREAD for a man who cannot read it, held at SHOT_READ_MIN..SHOT_READ_MAX of
 * it). No temperament in it: a daring, nervous or composed man with the same skills reads the same chance. */
export const SHOT_SPREAD=.3,SHOT_READ_MIN=.5,SHOT_READ_MAX=1.6;
export function shotRead(p:Pick<PracticePlayer,'skills'|'traits'|'id'|'side'>,open:number,hurry:number,at:Vec,time?:number):number{
 return open*clamp(perceive(p,'shot',1,SHOT_SPREAD,at,{time,salt:'chance'}),SHOT_READ_MIN,SHOT_READ_MAX)*(1-clamp(hurryCost(p,hurry,at,time),0,.9));
}
/** How readily he takes the chance he reads, against his other options (added to the shot's score, the same scale as
 * every option's; the chance itself is worth SHOT_WORTH a unit). Never part of the read, and bounded, so it decides
 * close calls and cannot make a decent chance look small:
 *  - appetite: SHOT_DARE x daring (risk and audacity, practice-perception daring, -0.5..1): a daring man backs himself
 *    from a thin chance, "shoots on sight"; a cautious one would rather keep the ball. A typical man is 0.
 *  - nerve under the press: SHOT_NERVE x (nerve - 1) x the contest's pressure (as the defence makes it), for a nervous
 *    man only (nerve above 1): with a man on him he wants rid of the ball, so he releases. With no press, or for a
 *    man of nerve 1 or less, nothing. (shot fix, 2026-10-15: it used to run both ways, and nerve is below 1 for a
 *    composed or daring man, so it leaned them TOWARDS the pressed shot, up to +0.08: +0.02 for the contest round's
 *    composed side, +0.03 for its daring one, +0.01 for its typical men. That is a lean of their own, which a composed
 *    man must not have, and a daring man's appetite is already SHOT_DARE.)
 * A composed man has no lean of his own: he takes what his read says is best, a good chance himself, a clearly better
 * one a pass away. SHOT_BASE is the shot's own standing (the old 0.1 plus a typical man's old risk lean, 0.45 x
 * 0.09), so a typical man's free shot is worth what it was. */
export const SHOT_BASE=.14,SHOT_WORTH=1.2,SHOT_DARE=.15,SHOT_NERVE=.2;
export function shotTemper(p:Pick<PracticePlayer,'skills'|'traits'|'id'>,pressure:number):number{
 return SHOT_DARE*daring(p)-SHOT_NERVE*Math.max(0,nerve(p)-1)*clamp(pressure,0,1);
}

export interface ShotContest {
 /** 0..1 each, as the defence makes them (before the shooter's poise). */
 rush:number;shadow:number;balance:number;
 /** The defence's whole effect, 0..1, before poise. */
 pressure:number;
 /** The shooter's resistance, 0..1 (finishing and composure). */
 poise:number;
 /** Striking across his run or first time, 0..1. */
 self:number;
 /** What reaches the strike, 0..1: (pressure x kept) combined with self; kept = 1 + RESIST x (POISE_TYPICAL - poise). */
 hurry:number;
 /** The balance part that reaches the strike (struck softer). */
 offBalance:number;
 /** Who rushes it (the man arriving first), if anyone. */
 closer?:string;
}
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
export function shotPoise(p:Pick<PracticePlayer,'skills'|'traits'|'id'>):number{
 return clamp(.6*clamp(p.skills.finishing/10,0,1)+.4*composure(p),0,1);
}
/** The goal mouth's share hidden from the ball by these bodies (each SHADOW_BODY m plus his leg either side). */
export function goalShadow(ball:Vec,goalX:number,bodies:readonly PracticePlayer[]):number{
 const a=Math.atan2(-GH-ball.y,goalX-ball.x),b=Math.atan2(GH-ball.y,goalX-ball.x),lo=Math.min(a,b),hi=Math.max(a,b);
 if(hi-lo<1e-6||hi-lo>Math.PI)return 0;
 const spans:[number,number][]=[];
 for(const q of bodies){
  const r=distance(q,ball);if(r<.3||r>SHADOW_NEAR||(q.x-ball.x)*(goalX-ball.x)<=0)continue;
  const c=Math.atan2(q.y-ball.y,q.x-ball.x),w=Math.atan((SHADOW_BODY+SHADOW_LEG*clamp(q.skills.defending,0,10))/r);
  const s=Math.max(lo,c-w),e=Math.min(hi,c+w);if(e>s)spans.push([s,e]);
 }
 spans.sort((x,y)=>x[0]-y[0]);let hidden=0,end=-Infinity;
 for(const [s,e] of spans){const from=Math.max(s,end);if(e>from)hidden+=e-from;end=Math.max(end,e);}
 return clamp(hidden/(hi-lo),0,1);
}
/** The contest at the strike. `lead` (s) is how long before the strike this is read (the shooter deciding now, his
 * preparation still to come: the men keep closing meanwhile, at their closing speed now); `sinceDuel` (s) since he last came out of a duel with it. */
export function shotContest(p:PracticePlayer,players:readonly PracticePlayer[],aim:Vec,o:{firstTime?:boolean;lead?:number;sinceDuel?:number}={}):ShotContest{
 const goalX=p.side===0?L:0,men=players.filter(q=>q.side!==p.side&&q.role!=='GK');
 let rush=0,closer:string|undefined,nearest=99;
 for(const q of men){
  const d=distance(q,p);nearest=Math.min(nearest,d);
  const closing=d>.01?-((q.vx-p.vx)*(q.x-p.x)+(q.vy-p.vy)*(q.y-p.y))/d:0;
  const near=d-Math.max(0,closing)*(SWING+(o.lead??0))-CLOSE_READ*(clamp(q.skills.reading,0,10)-5)/5;
  const r=clamp((RUSH_FAR-near)/(RUSH_FAR-RUSH_NEAR),0,1);
  if(r>rush){rush=r;closer=q.id;}
 }
 const shadow=clamp(goalShadow(p,goalX,men)/SHADOW_FULL,0,1);
 const contact=clamp((CONTACT_FAR-nearest)/(CONTACT_FAR-CONTACT_NEAR),0,1);
 const duel=o.sinceDuel===undefined||o.sinceDuel<0?0:clamp(1-o.sinceDuel/DUEL_FADE,0,1)*.7;
 const balance=1-(1-contact)*(1-duel);
 const pressure=1-(1-rush)*(1-shadow)*(1-balance);
 const poise=shotPoise(p),kept=clamp(1+RESIST*(POISE_TYPICAL-poise),KEPT_MIN,KEPT_MAX);
 // what he does to himself (as before): striking across his own run, first time
 const speed=Math.hypot(p.vx,p.vy),running=clamp(speed/Math.max(1,p.basePace),0,1);
 let across=0;
 if(speed>.5){const a=Math.atan2(p.vy,p.vx),b=Math.atan2(aim.y-p.y,aim.x-p.x),d=Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));across=running*clamp((d-.6)/1.4,0,1);}
 const self=1-(1-across)*(1-(o.firstTime?FIRST_TIME:0));
 const hurry=1-(1-clamp(pressure*kept,0,1))*(1-self);
 return {rush,shadow,balance,pressure,poise,self,hurry,offBalance:clamp(balance*kept,0,1),closer};
}
