// Game plan Match prep, scouting and practice (BUILD-PLAN WP3): the pure
// helpers behind "which plan + your five". Pure, no I/O: the screens load,
// this decides.
//
// - Prep stores the five, captain, set-piece taker, substitutions and the
//   move handovers; the plan supplies everything engine-facing
//   (lib/ballers/plans.ts pickPlan → SQL private.ballers_plan_write).
// - Handovers use the same resolveIdea as today's ideas, so what Prep shows is
//   exactly what the players carry (lib/ballers/compute.ts resolves the frozen
//   entry with the same function).
// - Scouting is past only and reads lib/ballers/scout.ts (no phase tallies
//   since the owner's playtest, 2 Oct: facts that help a decision only).
import {resolveIdea,type MissingPart} from './ideas';
import type {FrozenPlan} from './compute';
import type {Formation,Player} from './league';
import {isKeeper} from './league';
import type {Plan,PlanMove,PlanPrep} from './plans';
import type {PrepOrder} from './subs';

// ------------------------------------------------------------------ the prep's state
/** What a prep is to the screen. 'linked': it plays one of your plans (the
 * normal case). 'carried': linked, carried over from last round untouched.
 * 'custom': changed outside a plan (an older screen). 'plan_deleted': the plan
 * it played was deleted. 'none': no prep row yet. */
export type PrepState='linked'|'carried'|'custom'|'plan_deleted'|'none';
export function prepState(p:PlanPrep|null|undefined,plans:readonly Pick<Plan,'id'>[]):PrepState{
 if(!p)return 'none';
 if(p.plan_id&&plans.some(x=>x.id===p.plan_id))return p.origin==='carried'?'carried':'linked';
 if(p.plan_id||p.plan_snapshot?.detached==='plan_deleted')return 'plan_deleted';
 return 'custom';
}
/** Prep can change the five, captain, taker and subs only while it plays a plan
 * (the plan door is the one writer). Outside a plan the match plays as it is
 * until a plan is picked or the setup is saved as one. */
export const editable=(s:PrepState)=>s==='linked'||s==='carried';

// ------------------------------------------------------------------ the draft
/** What Prep edits. `taker`: null = Auto. `assign`: per move id, slot ("2"-"5")
 * → who plays a part whose player isn't in the five (the manager's picks). */
export interface PrepDraft {plan:string|null;lineup:string[];captain:string;taker:string|null;subs:PrepOrder[];assign:Record<string,Record<string,string>>}
export function draftOf(p:PlanPrep|null|undefined,fallback:{lineup:string[];captain:string|null}):PrepDraft{
 if(!p)return {plan:null,lineup:[...fallback.lineup],captain:fallback.captain??fallback.lineup[1],taker:null,subs:[],assign:{}};
 return {plan:p.plan_id??null,lineup:[...p.lineup],captain:p.captain,taker:p.match_settings?.taker??null,subs:p.substitution_orders??[],assign:p.idea_lineups??{}};
}

// ------------------------------------------------------------------ the five
/** Swapping a starter out: the new five, and where the armband went when the
 * captain was the one who left (today's rule: lineup slot 2). */
export function swapFive(lineup:readonly string[],slot:number,incoming:string,captain:string):{lineup:string[];captain:string;armbandFrom:string|null}{
 const next=[...lineup];const out=next[slot];next[slot]=incoming;
 if(captain!==out)return {lineup:next,captain,armbandFrom:null};
 return {lineup:next,captain:next[1],armbandFrom:out};
}
/** The taker still has to be one of the four outfield starters; otherwise Auto. */
export const takerFor=(taker:string|null,lineup:readonly string[])=>taker&&lineup.slice(1).includes(taker)?taker:null;

/** Who "Auto" usually sends to a free kick: the engine weighs set pieces most,
 * then passing or finishing (by the kick), then control
 * (packages/football-engine practice-set-pieces.ts chooseFreeKickTaker). It
 * changes with each kick, hence "usually". */
export function usualTaker<P extends Pick<Player,'id'|'roles'|'skills'>>(starters:readonly P[]):P|null{
 const value=(p:P)=>p.skills.setPieces*.65+(p.skills.passing+p.skills.finishing)/2*.25+p.skills.control*.1;
 return starters.filter(p=>!isKeeper(p)).sort((a,b)=>value(b)-value(a)||a.id.localeCompare(b.id))[0]??null;
}

// ------------------------------------------------------------------ moves and their men
export interface Handover {move:PlanMove;missing:MissingPart[];kept:{slot:number;id:string}[];dup:boolean;assign:Record<string,string>}
/** For each move of the plan: whose part needs a new man in this five. */
export function handovers(moves:readonly PlanMove[],lineup:readonly string[],assign:Record<string,Record<string,string>>):Handover[]{
 return moves.map(m=>{
  const r=resolveIdea({plan:m.plan,lineup:m.lineup},[...lineup],assign[m.id]??{});
  return {move:m,missing:r.missing,kept:r.kept,dup:r.issues.length>0,assign:r.assign};
 });
}
/** What prep stores: each move's full mapping as shown (suggestions included),
 * so the frozen entry plays exactly what Prep showed. */
export const moveLineups=(h:readonly Handover[])=>Object.fromEntries(h.filter(x=>Object.keys(x.assign).length).map(x=>[x.move.id,x.assign]));

/** The moves of a plan as the engine takes them (a practice match). */
export function frozenMoves(moves:readonly PlanMove[],lineup:readonly string[],assign:Record<string,Record<string,string>>):FrozenPlan[]{
 return handovers(moves,lineup,assign).map(h=>({idea:h.move.id,key:h.move.key,name:h.move.name,plan:h.move.plan,lineup:h.move.lineup,accent:h.move.emphasis,assign:h.assign}));
}

// ------------------------------------------------------------------ the plan list
/** How many finished matches each plan played (by the snapshot frozen with the prep). */
export function timesPlayed(preps:readonly PlanPrep[],finishedRounds:ReadonlySet<string>):Map<string,number>{
 const n=new Map<string,number>();
 for(const p of preps){const id=p.plan_snapshot?.detached?null:p.plan_snapshot?.id;if(id&&finishedRounds.has(p.round_id))n.set(id,(n.get(id)??0)+1);}
 return n;
}
export const playedLine=(n:number)=>n===0?'Not played yet':n===1?'Played once':`Played ${n} times`;

/** A formation change re-labels the slots; the five keep their order. */
export function reslotNote(from:Formation,to:Formation,slots:readonly string[],five:readonly Pick<Player,'short'>[]):string|null{
 if(from===to)return null;
 return five.map((p,i)=>`${p.short} ${slots[i]?.toLowerCase()??''}`).join(', ');
}

/** A name for a setup saved as a plan, free among the club's plans. */
export function freeName(base:string,taken:readonly string[]):string{
 const t=new Set(taken.map(x=>x.toLowerCase()));
 if(!t.has(base.toLowerCase()))return base.slice(0,40);
 for(let i=2;i<100;i++){const n=`${base.slice(0,36)} ${i}`;if(!t.has(n.toLowerCase()))return n;}
 return `${base.slice(0,30)} ${Date.now()%10000}`;
}

// ------------------------------------------------------------------ scouting
/** Their danger men for one count over the scouted matches (lib/ballers/scout.ts
 * scoutTallies): the leader, or the two who share the top (more shots first);
 * nobody on zero. */
export function scoutLeaders<T extends {id:string;matches:number;shots:number;goals:number;assists:number}>(tallies:readonly T[],k:'goals'|'assists'):T[]{
 const top=Math.max(0,...tallies.map(t=>t[k]));if(!top)return [];
 return tallies.filter(t=>t[k]===top).sort((a,b)=>b.shots-a.shots||a.matches-b.matches||a.id.localeCompare(b.id)).slice(0,2);
}

// ------------------------------------------------------------------ practice
/** How the opponent plays in a practice match, by where the server takes it from
 * (ballers_practice_side). Never their moves. Shown beside their crest, so no name. */
export function opponentLine(source:'last_match'|'ai'|'generic'|undefined):string{
 return source==='ai'?'As they’re set up, without moves.'
  :source==='generic'?'A plain Balanced 1-2-1, without moves.'
  :'As in their last game, without their moves.';
}
/** "Came up 27 times · to plan 11 · half 9 · broke down 7 · 4 shots". */
export function moveLine(t:{tried:number;to_plan:number;half:number;broke:number;shot:number;goal:number}):string{
 if(!t.tried)return 'Never came up';
 return [`Came up ${t.tried===1?'once':`${t.tried} times`}`,`to plan ${t.to_plan}`,`half ${t.half}`,`broke down ${t.broke}`,
  t.shot?`${t.shot} ${t.shot===1?'shot':'shots'}`:'',t.goal?`${t.goal} ${t.goal===1?'goal':'goals'}`:''].filter(x=>x&&!/ 0$/.test(x)).join(' · ');
}

/** "Also play it as <style>, as it comes" only says something when the plan
 * isn't already exactly that style: changed settings, moves, or its own
 * keeper / free-kick calls. */
export const differsFromStyle=(p:{moves:readonly unknown[];set_pieces:object;adjusted:boolean})=>p.adjusted||p.moves.length>0||Object.keys(p.set_pieces).length>0;
