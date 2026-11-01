// One tap on a ready-made idea: it becomes the club's own saved idea (the
// same ballers_lab_save door the Lab uses, the same validatePlans check) and,
// while the next round is still open and has room, it goes into that match
// (ballers_save_prep, the same save the Lab's "Next match" switch makes).
// An already-saved starter is never re-posted, so edits the manager made to
// it in the Lab are kept; tapping it again only switches it on.
import {validatePlans} from '../../packages/football-engine/src/index';
import {labSave,loadMine,savePrep} from './data';
import {ideaAccent} from './ideas';
import {MAX_IDEAS_ON,MAX_IDEAS_SAVED,type Formation,type Idea,type Style} from './league';
import type {Starter} from './lab/starters';
import type {Approach} from './approach';

export interface PrepPayload {lineup:string[];captain:string;formation:Formation;style:Style;approach:Approach;ideas:string[];accents:Record<string,number>}
export type StarterState='new'|'saved'|'on';
export function starterState(st:Starter,ideas:Idea[],enabled:string[]):StarterState{
 const saved=ideas.find(i=>i.plan_key===st.key);
 return !saved?'new':enabled.includes(saved.id)?'on':'saved';
}
/** Why the next match can't take one more idea right now (null = it can). */
/** `plan`: the next match still uses a plan (a club switched off from Game
 * plan before this round locked, lib/ballers/compat.ts): it plays as picked. */
export function nextMatchRoom(round:{id:string}|null,locked:boolean,enabledCount:number,plan=false):'no-round'|'locked'|'plan'|'full'|null{
 return !round?'no-round':locked?'locked':plan?'plan':enabledCount>=MAX_IDEAS_ON?'full':null;
}

/** Saves the starter to the club (if it isn't there yet) and, given `next`,
 * switches it on for that round. Returns whether it went into the match. */
export async function adoptStarter(space:string,st:Starter,ideas:Idea[],lineup:string[],next:{round:string;prep:PrepPayload}|null):Promise<{on:boolean;name:string}>{
 let saved=ideas.find(i=>i.plan_key===st.key);
 const plan=validatePlans([st.plan()])[0];
 if(!saved){
  if(ideas.length>=MAX_IDEAS_SAVED)throw Error('max_12_ideas');
  await labSave(space,[{plan,lineup:[...lineup],enabled:false}],null,[]);
 }
 if(!next||next.prep.ideas.length>=MAX_IDEAS_ON)return {on:false,name:saved?.name??plan.name};
 if(!saved)saved=(await loadMine(space)).ideas.find(i=>i.plan_key===st.key);
 if(!saved)return {on:false,name:plan.name};
 if(next.prep.ideas.includes(saved.id))return {on:true,name:saved.name};
 await savePrep(next.round,{...next.prep,ideas:[...next.prep.ideas,saved.id],accents:{...next.prep.accents,[saved.id]:ideaAccent(saved)}});
 return {on:true,name:saved.name};
}
