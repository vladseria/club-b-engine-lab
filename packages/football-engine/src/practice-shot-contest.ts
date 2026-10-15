import {L,GH} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';
import {composure,daring,nerve,perceive,misread} from './practice-perception.js';

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
export const RUSH_FAR=2.5,RUSH_NEAR=.7,SWING=.25,CLOSE_READ=.25;
export const SHADOW_NEAR=5,SHADOW_BODY=.3,SHADOW_LEG=.035,SHADOW_FULL=1;
export const CONTACT_FAR=1.2,CONTACT_NEAR=.6,DUEL_FADE=.8;
export const RESIST=1,POISE_TYPICAL=.64,KEPT_MIN=.5,KEPT_MAX=1.3;
/** Striking across his own run (as shotHurry) and first time (HURRY_FIRST): what he does to himself. */
export const FIRST_TIME=.3;
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
 *    is his temperament, on the choice (shotTemper), never on the read. */
export const HURRY_COST=.7,HURRY_UNDER=.8,HURRY_SPREAD=.5,HURRY_SEEN_MAX=1.3;
export function hurryCost(p:Pick<PracticePlayer,'skills'|'traits'|'id'|'side'>,hurry:number,at:Vec,time?:number):number{
 const seen=clamp(perceive(p,'shot',1,HURRY_SPREAD,at,{time,salt:'hurry',bias:-HURRY_UNDER*misread(p,'shot')}),0,HURRY_SEEN_MAX);
 return HURRY_COST*clamp(hurry,0,1)*seen;
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
 *  - nerve under the press: SHOT_NERVE x (nerve - 1) x the contest's pressure (as the defence makes it): a nervous man
 *    with a man on him wants rid of the ball, so he releases; a composed one is not hurried into it. With no press,
 *    or for a typical man (nerve 1), nothing.
 * A composed man has no lean of his own: he takes what his read says is best, a good chance himself, a clearly better
 * one a pass away. SHOT_BASE is the shot's own standing (the old 0.1 plus a typical man's old risk lean, 0.45 x
 * 0.09), so a typical man's free shot is worth what it was. */
export const SHOT_BASE=.14,SHOT_WORTH=1.2,SHOT_DARE=.15,SHOT_NERVE=.2;
export function shotTemper(p:Pick<PracticePlayer,'skills'|'traits'|'id'>,pressure:number):number{
 return SHOT_DARE*daring(p)-SHOT_NERVE*(nerve(p)-1)*clamp(pressure,0,1);
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
