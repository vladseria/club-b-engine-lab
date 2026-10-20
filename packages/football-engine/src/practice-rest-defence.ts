import * as S from './style.js';
import {L} from './pitch.js';
import {clamp} from './model.js';
import type {Vec} from './movement.js';
import {daring,perceive} from './practice-perception.js';
import type {Reader} from './practice-perception.js';
import {WORLD} from './world.js';

type Body=Vec&{id:string;side:number;role:string};
const depthOf=(side:number,x:number)=>side===0?x:L-x;

/** What losing the ball costs: the goals the opponent can expect to score in
 * the next seconds after winning it, from where it is lost (depth from our
 * own goal as a share of the pitch) and the rest defence behind it. The
 * `deficit` is the opponents who would be free behind the ball (outfielders
 * already goal-side of it) plus the man who wins it, against our outfielders
 * goal-side of it: +1 or more is a counter with numbers, 0 or below a
 * covered loss.
 *
 * An authored football price (R2; it replaces B3's Poisson fit on the
 * engine's own outcomes, which is engine knowledge, not football), from the
 * transition benchmarks (research/football-style-balance/notes/
 * transition-danger-benchmarks.md):
 *  - location: a loss in our own third is worth what the old positional
 *    price said and the engine agrees (~0.2 goals at 6 m); a balanced loss
 *    high up about 0.035, the 2-4% of goals a high turnover gives (Opta
 *    ~2% in 11v11, 5v5 and futsal score more). That is a ~6x gradient over
 *    the pitch, inside the 5-8x of real data and flatter for a 48 m pitch;
 *  - imbalance: each man short multiplies it by 1.55 (a covered surplus
 *    divides by it), so 2-3 short is 2.4-3.7x a balanced loss (real counters
 *    against an unbalanced defence are 3-5x more productive; Tenga 2010,
 *    Gonzalez-Rodenas 2015) and three of four caught ahead high up costs
 *    ~0.13, inside the 0.10-0.18 extrapolated for 5v5. It bites from a
 *    quarter of the pitch and fully past 60%: deep in our half the ball is
 *    near our goal whoever stands behind it. */
export const LOSS_OWN=.268,LOSS_FALL=2.45,LOSS_SHORT=1.55;
export function lossDanger(depthShare:number,deficit:number):number{
 const d=clamp(depthShare,0,1),k=clamp(deficit,-1,3),reach=clamp((d-.25)/.35,0,1);
 return LOSS_OWN*Math.exp(-LOSS_FALL*d)*LOSS_SHORT**(k*reach);
}
/** Goals to price units: the scale the passer's other terms use (the old
 * positional price, 0.55 at our goal line, was 2.2x these goals). */
export const LOSS_SCALE=2.2;

export interface RestRead {depth:number;rest:number;threats:number;deficit:number}
/** The rest defence behind a ball at `at` (default: where p stands): our
 * outfielders except p goal-side of it, and the opponents' outfielders who
 * would be free behind it if it were lost. */
export function restDefence(p:Body,players:readonly Body[],at:Vec=p):RestRead{
 const bd=depthOf(p.side,at.x);let rest=0,threats=0;
 for(const q of players){
  if(q.role==='GK'||q.id===p.id)continue;
  const d=depthOf(p.side,q.x);
  if(q.side===p.side){if(d<bd)rest++;}
  else if(d<bd-1)threats++;
 }
 return {depth:bd,rest,threats,deficit:threats+1-rest};
}
/** The price of losing the ball here (pass and loft valuation; the carry's
 * and the shot's own loss reads). It no longer vanishes past 28 m: a carrier
 * with three team-mates ahead of the ball and the opponents' forwards free
 * behind it knows what a loss would cost.
 *
 * It is the player's own read of it (R2): a daring player (risk, audacity)
 * underestimates it (by LOSS_OPTIMISM x daring), and everyone misjudges it by
 * his reading (a relative error up to LOSS_SPREAD). Without the player's
 * skills (a bare body) the read is exact. */
export const LOSS_OPTIMISM=WORLD.perception.restDefence.LOSS_OPTIMISM.v,LOSS_SPREAD=WORLD.perception.restDefence.LOSS_SPREAD.v;
/** What one ball lost costs a kick's valuation (the ground pass's and the
 * loft's loss term, per unit of their loss read): a base that a daring player
 * (risk) weighs less, plus the price of losing it there (turnoverPrice).
 * Shared since B2 (2026-10-09) with the carry, whose read of being tackled
 * is priced the same way: one ball lost, one price, whatever lost it. */
export const deliveryLossWeight=(p:{traits:{risk:number}},lossCost:number)=>.68-p.traits.risk*.3+lossCost;
export function lossRead(p:Body&Reader,at:Vec):number{
 return clamp(perceive(p,'loss',1-LOSS_OPTIMISM*daring(p),LOSS_SPREAD,at,{salt:'loss'}),.4,1.6);
}
export function turnoverPrice(p:Body&Reader,players:readonly Body[],at:Vec=p):number{
 const r=restDefence(p,players,at);
 return LOSS_SCALE*lossDanger(r.depth/L,r.deficit)*lossRead(p,at);
}

/** "Bodies forward" is a strong preference each player follows by his
 * discipline, not a hard rule. In an established attack (the ball in the
 * opponents' half, not at our keeper) `commit` says how many of the carrier's
 * outfield team-mates the manager wants behind the ball as rest defence,
 * clearly (4 m or more) goal-side of it; the others join the attack, level
 * with the ball or ahead of it:
 *   1: at least two stay behind   2: at least one stays behind
 *   3: free (the ordinary valuation decides, as always)
 *   4: at least one joins         5: at least two join (at most one stays)
 * The ends leave the last man to the moment: at 1 the third may join and at
 * 5 the last may go too when the football says so. Every body short of or
 * beyond those bounds costs the arrangement a price (commitmentPrice) that
 * competes with its football value, so a disciplined side keeps the shape the
 * manager asked for and an undisciplined player breaks it when the moment is
 * worth it. Which players go, and to which job, is still the ordinary choice.
 * The old form, about a metre of midfield per step, left all three behind
 * the ball most of the time whatever the setting. */
export const REST_MARGIN=4;
export interface CommitBounds {minRest:number;maxRest:number}
export function commitBounds(commit:number):CommitBounds{
 const c=Math.round(clamp(commit,S.COMMIT.lowest.v,S.COMMIT.highest.v));
 return c<S.COMMIT.neutral.v?{minRest:S.COMMIT.restFloorBase.v-c,maxRest:S.COMMIT.restCapFree.v}:{minRest:0,maxRest:S.COMMIT.restCapBase.v-c};
}
export const constrains=(b:CommitBounds)=>b.minRest>0||b.maxRest<3;
export function establishedAttack(focus:Vec&{side:number;role:string}):boolean{
 return focus.role!=='GK'&&depthOf(focus.side,focus.x)>=L/2;
}
export function isRest(side:number,ball:Vec,aim:Vec):boolean{return depthOf(side,aim.x)<depthOf(side,ball.x)-REST_MARGIN;}
/** How far a count of rest defenders is from the committed bounds. */
export const restMiss=(b:CommitBounds,rest:number)=>Math.max(0,b.minRest-rest)+Math.max(0,rest-b.maxRest);
/** What one body out of the committed shape costs, in arrangement-value
 * units, for a player of this discipline (0..1): a fully disciplined player
 * holds it against about a strong alternative's worth of football value; an
 * undisciplined one a fraction of that. */
export const COMMIT_PRICE=S.COMMIT.price.v;
export const commitHold=(discipline:number)=>COMMIT_PRICE*(S.COMMIT.holdFloor.v+S.COMMIT.holdPer.v*clamp(discipline,0,1));
export interface Placed {rest:boolean;discipline:number}
/** The price of an arrangement's rest defence against the committed bounds.
 * Each body short of or beyond them is charged to one player who could have
 * honoured it: the least disciplined of those staying behind when too many
 * stay, of those joining when too few stay. So the arrangement that breaks the
 * shape through its least disciplined player is the cheapest one to break. */
export function commitmentPrice(b:CommitBounds,placed:readonly Placed[]):number{
 const rest=placed.filter(x=>x.rest).map(x=>x.discipline).sort((a,c)=>a-c);
 const join=placed.filter(x=>!x.rest).map(x=>x.discipline).sort((a,c)=>a-c);
 let price=0;
 for(let i=0;i<rest.length-b.maxRest;i++)price+=commitHold(rest[i]);
 for(let i=0;i<b.minRest-rest.length&&i<join.length;i++)price+=commitHold(join[i]);
 return price;
}
/** How far a set of supporting outfield destinations is from the committed
 * rest defence (0 = honoured, or not an established attack). */
export function commitmentMiss(focus:Vec&{side:number;role:string},commit:number,aims:readonly Vec[]):number{
 if(!establishedAttack(focus))return 0;
 const b=commitBounds(commit);if(!constrains(b))return 0;
 return restMiss(b,aims.filter(aim=>isRest(focus.side,focus,aim)).length);
}
/** The price of supporting outfield destinations (each with its player's
 * discipline) against the committed rest defence: 0 when honoured or when
 * not an established attack. Every arrangement step (ordinary allocation,
 * pressure release, reception refinement) subtracts it from football value. */
export function commitmentCost(focus:Vec&{side:number;role:string},commit:number,rows:readonly {aim:Vec;discipline:number}[]):number{
 if(!establishedAttack(focus))return 0;
 const b=commitBounds(commit);if(!constrains(b))return 0;
 return commitmentPrice(b,rows.map(r=>({rest:isRest(focus.side,focus,r.aim),discipline:r.discipline})));
}
