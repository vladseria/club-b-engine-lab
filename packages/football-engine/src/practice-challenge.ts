import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp,Tactics} from './model.js';
import type {PracticePlayer} from './practice.js';
import {contact,Vec} from './movement.js';
import {readShotDanger,ShotDanger} from './practice-shot-defense.js';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x:number,y:number)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
export interface ChallengeRead {
 mode:'contain'|'challenge'|'recover'|'block';reason:string;distance:number;screened:boolean;
 closingSpeed:number;opportunity:number;threshold:number;
 shot:ShotDanger;emergency:boolean;penaltyRisk:number;
}
export interface ChallengeAttempt {defender:string;opponent:string;aim:Vec;velocity:Vec;resolveAt:number;read:ChallengeRead}
export interface ChallengeContact {
 ball:boolean;body:boolean;ballFirst:boolean;leg:boolean;collision:boolean;
 foot:Vec;spot:Vec;closingSpeed:number;foulChance:number;
}

/** Resolve the committed reach, not a circle around the defender. Radii approximate
 * a boot/ball and an opponent's legs; they are deliberately smaller than reach.
 * A clean poke cannot foul someone the boot and body never contact. */
export function resolveChallengeContact(d:PracticePlayer,a:PracticePlayer,ball:Vec,attempt:ChallengeAttempt,deficit=0):ChallengeContact{
 const toOpponent=unit(a.x-d.x,a.y-d.y);
 const closingSpeed=Math.max(0,(d.vx-a.vx)*toOpponent.x+(d.vy-a.vy)*toOpponent.y);
 const rushed=clamp((closingSpeed-3)/6,0,1),technique=clamp(d.skills.defending/10,0,1);
 const tired=1-clamp(d.energy/100,0,1),frustration=(d.traits.frustration??0)*Math.min(3,Math.max(0,deficit))/3;
 // A planted step cannot chase a dodge, but the boot can make a small final
 // adjustment. Good technique/reading help; fatigue and rushed contact hurt.
 const adjustment=(.08+technique*.22+clamp(d.skills.reading/10,0,1)*.1)*(1-tired*.35)*(1-rushed*.5);
 const error=distance(attempt.aim,ball),correction=Math.min(1,adjustment/Math.max(error,.00001));
 const aim={x:attempt.aim.x+(ball.x-attempt.aim.x)*correction,y:attempt.aim.y+(ball.y-attempt.aim.y)*correction};
 const direction=unit(aim.x-d.x,aim.y-d.y);
 // Skilled, composed players stop their foot sooner. Momentum and frustration
 // extend the follow-through, but never beyond a physically bounded reach.
 const followThrough=.08+(1-technique)*.14+(1-d.traits.discipline)*.12+tired*.06+rushed*.15+frustration*.1;
 const reach=Math.min(1.3,distance(d,aim)+followThrough);
 const foot={x:d.x+direction.x*reach,y:d.y+direction.y*reach};
 const ballAt=contact(d,foot,ball,ball,.24),legAt=contact(d,foot,a,a,.38);
 const collision=distance(d,a)<.6,leg=legAt!==null,body=leg||collision;
 const ballFirst=ballAt!==null&&!collision&&(legAt===null||ballAt<legAt);
 // Contact with the legs before the ball is usually a trip. Ball-first contact
 // can still be careless; simply brushing alongside someone is less serious.
 const careless=challengeFoulChance(d,{closingSpeed},deficit,!ballFirst);
 const foulChance=!body?0:clamp((leg&&!ballFirst?.58:0)+careless+rushed*(ballFirst?.3:.15),0,.98);
 // The offence belongs where contact occurred, not where the ball happens to be.
 const at=legAt??0,impact=leg?{x:d.x+(foot.x-d.x)*at,y:d.y+(foot.y-d.y)*at}:d;
 const toward=unit(impact.x-a.x,impact.y-a.y),spot={x:a.x+toward.x*.3,y:a.y+toward.y*.3};
 return {ball:ballAt!==null,body,ballFirst,leg,collision,foot,spot,closingSpeed,foulChance};
}

/** The tackle's odds once a defender commits to it and reaches the ball: his
 * defending against the carrier's control, strength, energy, and the cover he
 * has (his team-mates, keeper included, within 6 m of the carrier). Moved here from practice.ts
 * unchanged (B2), so the carrier's read of a duel can use the same odds. */
export function duelChance(attacker:PracticePlayer,defender:PracticePlayer,cover:number):number{
 return clamp(.46+(defender.skills.defending-attacker.skills.control)*.035+(defender.skills.strength-attacker.skills.strength)*.014+(defender.energy-attacker.energy)*.001+cover*.06,.15,.85);
}

/** Regain fixes (2026-10-11): a player who has just lost the ball at close
 * quarters is off balance: tackled (his weight was on the ball and the tackle
 * took his foot away), the ball knocked or squirting off him, or his kick
 * blocked by the man in front of him (he is still in the follow-through). He
 * needs a moment to plant and turn before he can go in again: until then he
 * chases, but cannot commit a challenge of his own, so the man who won it has
 * a moment to move it away from him. A strong player rides it a little
 * better. Close quarters: an opponent within BEATEN_NEAR m of him takes it
 * within BEATEN_WINDOW s of it leaving his feet (a tackle always counts).
 * Before, he could challenge again at once (only a man who had just tackled
 * waited, 1.4 s), and two players stood glued together while the ball changed
 * owner three or four times in two seconds. Team-mates who were not in the
 * duel can still counter-press at once. For the first BEATEN_TOUCH of that
 * moment he cannot take a controlled touch either (his body still stops the
 * ball): the ball that bounced off him as the winner set off used to be his
 * again at once. */
export const BEATEN_BALANCE=.6,BEATEN_STRENGTH=.03,BEATEN_WINDOW=1,BEATEN_NEAR=2,BEATEN_TOUCH=.5;
export const beatenRecovery=(p:{skills:{strength:number}})=>BEATEN_BALANCE+BEATEN_STRENGTH*(10-clamp(p.skills.strength,0,10));

/** Access to the ball is not the same as proximity to the carrier. */
export function bodyScreensBall(defender:Vec,attacker:Vec,ball:Vec):boolean{
 const dx=ball.x-defender.x,dy=ball.y-defender.y,d2=dx*dx+dy*dy;
 if(d2<.01)return false;
 const t=((attacker.x-defender.x)*dx+(attacker.y-defender.y)*dy)/d2;
 return t>.08&&t<.95&&distance(attacker,{x:defender.x+t*dx,y:defender.y+t*dy})<.42;
}

export function readChallenge(d:PracticePlayer,a:PracticePlayer,ball:Vec,players:PracticePlayer[],tactics:Tactics,deficit=0):ChallengeRead{
 const gap=distance(d,ball),toBall=unit(ball.x-d.x,ball.y-d.y),screened=bodyScreensBall(d,a,ball);
 const closingSpeed=(d.vx-a.vx)*toBall.x+(d.vy-a.vy)*toBall.y;
 const goal={x:d.side===0?0:L,y:0},toGoal=unit(goal.x-a.x,-a.y);
 const goalSide=(d.x-a.x)*toGoal.x+(d.y-a.y)*toGoal.y;
 const shot=readShotDanger(d,a,ball,players),urgency=shot.level;
 const cover=players.some(q=>q.id!==d.id&&q.side===d.side&&q.role!=='GK'&&distance(q,a)<10&&
  (q.x-a.x)*toGoal.x+(q.y-a.y)*toGoal.y>1);
 const reach=clamp((2.4-gap)/1.6,0,1),exposed=clamp((distance(d,a)-gap+.15)/.8,0,1);
 const balance=1-clamp((Math.abs(closingSpeed)-1.5)/5,0,1);
 const opportunity=reach*.3+exposed*.3+balance*.18+clamp(d.skills.defending/10,0,1)*.1+clamp(d.skills.reading/10,0,1)*.06+urgency*.06;
 const frustration=(d.traits.frustration??0)*Math.min(3,Math.max(0,deficit))/3;
 const ordinaryThreshold=.66-d.traits.engagement*.1+(d.traits.discipline-.5)*.08-(cover?.035:0)
  -(tactics.press==='aggressive'?.025:0)-frustration*.06;
 const inBox=Math.abs(goal.x-a.x)<BOX_DEPTH&&Math.abs(a.y)<BOX_HALF;
 // A foul can turn a harmless box possession into a penalty even if the
 // defender is balanced. Imminent shooting danger can justify accepting it.
 const penaltyRisk=inBox?challengeFoulChance(d,{closingSpeed},deficit)*(1.5+d.traits.discipline*2)*(1-urgency*.75):0;
 const emergencyAllowance=urgency>.32?urgency*(.06+d.traits.engagement*.14+frustration*.06):0;
 const threshold=ordinaryThreshold+penaltyRisk-emergencyAllowance;
 const ordinaryMargin=opportunity-ordinaryThreshold;
 const preferBlock=shot.canBlock&&urgency>.32&&ordinaryMargin<.05+d.traits.discipline*.16-d.traits.engagement*.15;
 let emergency=false;
 let mode:ChallengeRead['mode']='contain',reason='Ține drumul spre poartă închis și așteaptă să poată ataca mingea.';
 if(preferBlock){
  mode='block';reason='Are culoar de șut; intră pe traiectorie ca să acopere poarta.';
 }else if(screened){
  mode=goalSide<-.3?'recover':'contain';
  reason=mode==='recover'?'Adversarul protejează mingea; revine pe lângă el spre drumul porții.':'Mingea e protejată de corp; rămâne în față fără să intre prin adversar.';
 }else if(gap<=2.2&&opportunity>=threshold){
  mode='challenge';emergency=opportunity<ordinaryThreshold+penaltyRisk;
  reason=emergency?'Poate șuta la poartă; riscă intrarea, deși nu are pasul bine așezat.':'Mingea e accesibilă; își așază pasul și încearcă s-o ia.';
 }
 else if(Math.abs(closingSpeed)>4){reason='Ajunge prea repede; își potrivește pașii înainte să intre la minge.';}
 return {mode,reason,distance:gap,screened,closingSpeed,opportunity,threshold,shot,emergency,penaltyRisk};
}

/** Urgency affects willingness; poor approach/contact makes the attempt more dangerous. */
export function challengeFoulChance(d:PracticePlayer,read:Pick<ChallengeRead,'closingSpeed'>,deficit=0,screenedAtContact=false):number{
 const frustration=(d.traits.frustration??0)*Math.min(3,Math.max(0,deficit))/3;
 const rushed=clamp((Math.abs(read.closingSpeed)-3)/6,0,1);
 const technique=clamp(d.skills.defending/10,0,1),tired=1-clamp(d.energy/100,0,1);
 // Skill reduces execution errors; it cannot erase reckless intent or a
 // body moving across the contact. Pressure at contact still matters.
 return clamp(.008+(1-technique)*.045+tired*.015+(1-d.traits.discipline)*.075+frustration*.06+rushed*(.075-technique*.025)+(screenedAtContact?.08:0),0,.4);
}

/** A committed step aims at an observed ball trajectory; it cannot follow every dodge. */
export function startChallenge(d:PracticePlayer,a:PracticePlayer,ball:Vec,read:ChallengeRead,time:number):ChallengeAttempt{
 const preparation=.16+(1-clamp(d.skills.reading/10,0,1))*.14;
 return {defender:d.id,opponent:a.id,aim:{x:ball.x+a.vx*preparation,y:ball.y+a.vy*preparation},velocity:{x:a.vx,y:a.vy},resolveAt:time+preparation,read};
}

/** Regain the goal-side route without trying to run straight through the carrier. */
export function recoveryPosition(d:PracticePlayer,a:PracticePlayer):Vec{
 const toGoal=unit((d.side===0?0:L)-a.x,-a.y),lateral={x:-toGoal.y,y:toGoal.x};
 const side=(d.x-a.x)*lateral.x+(d.y-a.y)*lateral.y>=0?1:-1;
 return {x:clamp(a.x+toGoal.x*2.2+lateral.x*side*1.8,.8,(L-.8)),y:clamp(a.y+toGoal.y*2.2+lateral.y*side*1.8,-(W/2-1),(W/2-1))};
}
