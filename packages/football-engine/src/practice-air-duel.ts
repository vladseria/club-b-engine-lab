import {clamp} from './model.js';
import {L} from './pitch.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import {perceive,eagerness,daring} from './practice-perception.js';
import {WORLD} from './world.js';

/** Contests in the air (2026-10-15). Before this a lofted ball went to whichever body touched it first: headers were
 * standing contacts, the marker stood a metre goal-side of where the ball was met, and a defender got the first touch
 * of about 3% of long passes (evidence/2026-10-13-defence-read). Now a ball coming down near players of both sides is
 * contested: who reads it and gets there, who goes up (and how high), who bumps, who nips in front.
 *
 * The jump. A header can be met above standing height: JUMP_BASE m plus JUMP_SKILL m a point of aerial ("in the
 * air": height and spring). A header met above standing reach is harder to direct (practice-aerial readAerialKick). */
export const JUMP_BASE=WORLD.contact.airDuel.JUMP_BASE.v,JUMP_SKILL=WORLD.contact.airDuel.JUMP_SKILL.v,STANDING_HEAD=WORLD.contact.airDuel.STANDING_HEAD.v;
export const jumpReach=(p:{skills:{aerial:number}})=>JUMP_BASE+JUMP_SKILL*clamp(p.skills.aerial,0,10);
/** How much later a poor reader starts setting himself for a ball in the air (s, at reading 0 vs 10, centred on 6). */
export const AIR_READ=.015;
export const airReaction=(p:{skills:{reading:number}},base=.18)=>Math.max(.08,base+(6-clamp(p.skills.reading,0,10))*AIR_READ);

/** Who is in the contest. An opponent whose body is within AIR_REACH m of the ball (horizontally) when it is touched
 * at AIR_MIN m or higher, and who can get his head that high (standing head height plus his jump), challenges the
 * touch. Below AIR_MIN it is a reception at the feet or the thighs, not a duel in the air. */
export const AIR_REACH=WORLD.contact.airDuel.AIR_REACH.v,AIR_MIN=WORLD.contact.airDuel.AIR_MIN.v;
/** After it, the man who lost it is still landing: no touch for AIR_LAND s, no tackle for AIR_LAND_CHALLENGE s. A
 * knock-down leaves at up to KNOCK_SPREAD radians off its line, with a fifth to a half of its pace, popped up. */
export const AIR_LAND=WORLD.contact.airDuel.AIR_LAND.v,AIR_LAND_CHALLENGE=WORLD.contact.airDuel.AIR_LAND_CHALLENGE.v,KNOCK_SPREAD=WORLD.contact.airDuel.KNOCK_SPREAD.v;

/** How each man contests it, in log-odds. Two ways, and each man takes the one his body suits:
 *  - UP: he attacks the ball and jumps. AIR_JUMP a point of aerial (height, spring, timing), AIR_BUMP a point of
 *    strength more than the other man (the bump that knocks him off his jump), AIR_RUN for coming onto it at speed
 *    rather than standing (the run-up), more as the ball is higher;
 *  - NIP: he gets in front and takes it first, lower (chest or a stooping header). Only for the man the ball reaches
 *    first (AIR_FRONT), AIR_NIP_PACE a point of pace, AIR_NIP_READ of reading; harder the higher the ball is.
 * Common to both: AIR_CLOSE for being at the spot (falling off to nothing at AIR_REACH), AIR_FIRST for the man whose
 * body reaches it first, AIR_INSIDE for a defender goal-side of the attacker (the inside track: he sees the ball and the
 * man and attacks it going forward), AIR_READING a point of reading (he read the flight first), and the man's nerve:
 * AIR_EAGER a unit of eagerness and AIR_DARE of daring. A brave, eager man attacks the ball at its highest; a hesitant
 * one waits for it to drop and is beaten to it. The price of attacking it is in the outcome (fouls, mistimed jumps). */
export const AIR_JUMP=WORLD.contact.airDuel.AIR_JUMP.v,AIR_BUMP=WORLD.contact.airDuel.AIR_BUMP.v,AIR_RUN=WORLD.contact.airDuel.AIR_RUN.v,AIR_FRONT=WORLD.contact.airDuel.AIR_FRONT.v,AIR_NIP_PACE=WORLD.contact.airDuel.AIR_NIP_PACE.v,AIR_NIP_READ=WORLD.contact.airDuel.AIR_NIP_READ.v,AIR_NIP_HIGH=WORLD.contact.airDuel.AIR_NIP_HIGH.v;
export const AIR_CLOSE=WORLD.contact.airDuel.AIR_CLOSE.v,AIR_FIRST=WORLD.contact.airDuel.AIR_FIRST.v,AIR_INSIDE=WORLD.contact.airDuel.AIR_INSIDE.v,AIR_READING=WORLD.contact.airDuel.AIR_READING.v,AIR_EAGER=WORLD.contact.airDuel.AIR_EAGER.v,AIR_DARE=WORLD.contact.airDuel.AIR_DARE.v;

export interface AirMan {p:PracticePlayer;body:Vec;velocity:Vec;first:boolean}
export interface AirRead {score:number;way:'up'|'nip';front:boolean;behind:boolean;commit:number}
const goalOf=(side:number)=>({x:side===0?0:L,y:0});
/** The nerve he brings to it: brave and eager attack the ball, the hesitant wait for the drop. */
export const airCommit=(p:PracticePlayer)=>AIR_EAGER*eagerness(p)+AIR_DARE*daring(p);

/** One man's strength in this contest against the other (log-odds; only the difference matters). */
export function airStrength(me:AirMan,them:AirMan,ball:Vec&{z:number;vx:number;vy:number},defending:boolean):AirRead{
 const p=me.p,q=them.p,s=p.skills;
 const d=Math.hypot(me.body.x-ball.x,me.body.y-ball.y);
 // the ball's incoming direction: the man nearer where it comes from meets it first
 const sp=Math.hypot(ball.vx,ball.vy)||1,ux=ball.vx/sp,uy=ball.vy/sp;
 const along=(b:Vec)=>(b.x-ball.x)*ux+(b.y-ball.y)*uy;
 const front=along(me.body)<along(them.body)-.25,behind=along(me.body)>along(them.body)+.25;
 const toBall={x:ball.x-me.body.x,y:ball.y-me.body.y},tb=Math.hypot(toBall.x,toBall.y)||1;
 const run=clamp((me.velocity.x*toBall.x+me.velocity.y*toBall.y)/tb/Math.max(1,p.pace),0,1);
 const high=clamp((ball.z-1.6)/.8,0,1);
 const up=AIR_JUMP*(s.aerial-5)+AIR_BUMP*(s.strength-q.skills.strength)+AIR_RUN*run*(.5+high*.5);
 const nip=front?AIR_FRONT+AIR_NIP_PACE*(s.pace-5)+AIR_NIP_READ*(s.reading-5)-AIR_NIP_HIGH*high:-Infinity;
 const g=goalOf(p.side),inside=defending&&Math.hypot(me.body.x-g.x,me.body.y-g.y)<Math.hypot(them.body.x-g.x,them.body.y-g.y)-.2;
 const commit=airCommit(p);
 const common=-AIR_CLOSE*clamp(d/AIR_REACH,0,1)+(me.first?AIR_FIRST:0)+(inside?AIR_INSIDE:0)+AIR_READING*(s.reading-5)+commit;
 return {score:common+Math.max(up,nip),way:nip>up?'nip':'up',front,behind,commit};
}

/** What came of it. The winner's touch is clean (his header or cushion goes where he meant, with the other man on him)
 * more the clearer he won it and the better he is in the air; otherwise it comes off him (a knock-down, a flick
 * nobody meant): a loose ball. A foul: someone went through the back or led with an arm. The man coming from behind,
 * the reckless (eager, daring, undisciplined, frustrated when losing) and the one who jumps into a stronger man foul
 * more. A mistimed jump: an eager man who cannot read the flight goes too early and wins it badly. */
export const AIR_CLEAN=WORLD.contact.airDuel.AIR_CLEAN.v,AIR_CLEAN_MARGIN=WORLD.contact.airDuel.AIR_CLEAN_MARGIN.v,AIR_CLEAN_SKILL=WORLD.contact.airDuel.AIR_CLEAN_SKILL.v,AIR_MISTIME=WORLD.contact.airDuel.AIR_MISTIME.v;
export const AIR_FOUL={base:WORLD.contact.airDuel.AIR_FOUL.base.v,discipline:WORLD.contact.airDuel.AIR_FOUL.discipline.v,commit:WORLD.contact.airDuel.AIR_FOUL.commit.v,behind:WORLD.contact.airDuel.AIR_FOUL.behind.v,frustration:WORLD.contact.airDuel.AIR_FOUL.frustration.v,attacker:WORLD.contact.airDuel.AIR_FOUL.attacker.v};
export interface AirDuel {winner:PracticePlayer;loser:PracticePlayer;chance:number;outcome:'clean'|'knock'|'foul';fouler?:PracticePlayer;way:'up'|'nip';reads:[AirRead,AirRead]}
export function resolveAirDuel(a:AirMan,b:AirMan,ball:Vec&{z:number;vx:number;vy:number},attacking:number,deficit:(p:PracticePlayer)=>number,random:()=>number):AirDuel{
 const ra=airStrength(a,b,ball,a.p.side!==attacking),rb=airStrength(b,a,ball,b.p.side!==attacking);
 const pa=1/(1+Math.exp(rb.score-ra.score));
 const foulRisk=(m:AirMan,r:AirRead)=>{
  const p=m.p,frustration=(p.traits.frustration??0)*Math.min(3,Math.max(0,deficit(p)))/3;
  const risk=AIR_FOUL.base+(1-clamp(p.traits.discipline,0,1))*AIR_FOUL.discipline+Math.max(0,r.commit)*AIR_FOUL.commit+(r.behind?AIR_FOUL.behind:0)+frustration*AIR_FOUL.frustration;
  return risk*(p.side===attacking?AIR_FOUL.attacker:1);
 };
 const fa=foulRisk(a,ra),fb=foulRisk(b,rb),roll=random();
 const aWins=random()<pa,winner=aWins?a:b,loser=aWins?b:a,wr=aWins?ra:rb,chance=aWins?pa:1-pa;
 if(roll<fa+fb){const fouler=roll<fa?a.p:b.p;return {winner:fouler===a.p?b.p:a.p,loser:fouler,chance,outcome:'foul',fouler,way:wr.way,reads:[ra,rb]};}
 const s=winner.p.skills,mistime=Math.max(0,wr.commit)*AIR_MISTIME*(1-clamp(s.reading/10,0,1));
 const clean=clamp(AIR_CLEAN+AIR_CLEAN_MARGIN*(chance-.5)+AIR_CLEAN_SKILL*((wr.way==='up'?s.aerial:s.control)-5)-mistime,.12,.9);
 return {winner:winner.p,loser:loser.p,chance,outcome:random()<clean?'clean':'knock',way:wr.way,reads:[ra,rb]};
}

/** A defender whose man is about to meet a ball in the air decides whether to attack it (go up with him, at the ball)
 * or hold a metre goal-side and let him have it in front. He weighs his own read of the duel (his aerial and strength
 * against the man's, misread by up to AIR_READ_SPREAD for a man who cannot read the game) with the inside track and his
 * nerve. A strong header of the ball goes; a poor one holds unless he is brave; a hesitant one holds. */
export const AIR_READ_SPREAD=.8,AIR_GO=0;
export function attacksTheBall(d:PracticePlayer,man:PracticePlayer,at:Vec,time:number,goalSide:boolean):number{
 const s=d.skills,m=man.skills;
 const edge=AIR_JUMP*(s.aerial-m.aerial)+AIR_BUMP*(s.strength-m.strength);
 const read=perceive(d,'race',edge,AIR_READ_SPREAD,at,{time,salt:'air'});
 return read+(goalSide?AIR_INSIDE:0)+airCommit(d)-AIR_GO;
}

/** Attacking the ball. A defender who goes up for it does not wait for a set header: he runs at full effort to where
 * the ball comes down through his head height (challengePoint) and gets his head (or body) to it if it passes within
 * challengeReach of him, between AIR_MIN and his jumping height, once he has had AIR_SET s to set himself. It is a
 * challenge, not a planned header: what he does with it is decided by the contest and by what his body can make of it
 * (practice.ts). */
export const AIR_SET=WORLD.contact.airDuel.AIR_SET.v,CHALLENGE_REACH=WORLD.contact.airDuel.CHALLENGE_REACH.v,CHALLENGE_SKILL=WORLD.contact.airDuel.CHALLENGE_SKILL.v;
/** With nobody on him, his challenge is clean (a header he directs, or a cushion) this often at aerial 5, AIR_CLEAN_SKILL
 * more a point; otherwise it just comes off him. */
export const AIR_UNCONTESTED=WORLD.contact.airDuel.AIR_UNCONTESTED.v;
/** The receiver goes up with a defender who is attacking his ball once that defender is within AIR_REACH + AIR_UP_WITH m
 * of it: he challenges for it in the air rather than waiting for it to drop into the defender's header. */
export const AIR_UP_WITH=WORLD.contact.airDuel.AIR_UP_WITH.v;
export const challengeReach=(p:{skills:{aerial:number}})=>CHALLENGE_REACH+CHALLENGE_SKILL*clamp(p.skills.aerial,0,10);
/** Where he goes for it: the first point of the visible flight, coming down, inside his jumping height that he can reach
 * in time (full pace, a step's reaction), else the one he comes closest to making; `need` is how late he would be (s). */
export function challengePoint(p:PracticePlayer,samples:readonly {x:number;y:number;z:number;time:number}[],reaction=AIR_STEP):{aim:Vec;need:number}|null{
 const top=STANDING_HEAD+jumpReach(p),reach=challengeReach(p);
 let best:{aim:Vec;need:number}|null=null;
 for(const s of samples){
  if(s.z<AIR_MIN||s.z>top)continue;
  const need=Math.max(0,Math.hypot(s.x-p.x,s.y-p.y)-reach)/Math.max(1,p.pace)+reaction-s.time;
  if(need<=0)return {aim:{x:s.x,y:s.y},need};
  if(!best||need<best.need)best={aim:{x:s.x,y:s.y},need};
 }
 return best;
}
/** Who goes for it is decided every AIR_EVERY ticks. A defender goes only if he reads he gets there no more than AIR_LATE s
 * late (a brave one dares AIR_DARE_LATE s more a unit of nerve), misjudged by up to AIR_RACE_SPREAD s for a man who cannot
 * read the game: who reads the flight first. A defender other than the receiver's marker leaves his own man for it only
 * if that man is at least AIR_LEAVE m from where the ball comes down. */
export const AIR_EVERY=6,AIR_LATE=.08,AIR_DARE_LATE=.12,AIR_RACE_SPREAD=.4,AIR_LEAVE=6;
/** Setting off costs AIR_STEP s; once on his way he keeps going unless he reads he is AIR_KEEP s later than that. */
export const AIR_STEP=WORLD.contact.airDuel.AIR_STEP.v,AIR_KEEP=WORLD.contact.airDuel.AIR_KEEP.v;
export const airRace=(p:PracticePlayer,point:{aim:Vec;need:number},time:number)=>perceive(p,'race',point.need,AIR_RACE_SPREAD,point.aim,{time,salt:'airRace'});
