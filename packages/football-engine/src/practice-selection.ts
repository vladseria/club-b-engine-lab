import {WORLD} from './world.js';
/** These are competing football choices, not priorities or success modifiers.
 * Delivery techniques to one recipient share an opportunity. Taking on a
 * particular opponent remains distinct from carrying into space. More sampled
 * directions must not silently increase either choice's tactical preference. */
export interface ScoredAction {kind:string;target?:string;score:number}
export function actionIntention(option:ScoredAction):string {
 if(['pass','through','loft'].includes(option.kind))return `deliver:${option.target??'unassigned'}`;
 return `${option.kind}:${option.target??''}`;
}

const stable=(value:unknown):unknown=>value&&typeof value==='object'
 ?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable((value as Record<string,unknown>)[key])])):value;

/** Input is already filtered for viability and continuity. Score adjustments
 * from personality/coaching are retained. A group's best available execution
 * sets its weight; plausible variants share that weight instead of adding it.
 * New recipients and better routes remain genuinely new opportunities. */
export function actionWeights<T extends ScoredAction>(eligible:readonly T[]):{option:T;weight:number}[]{
 if(!eligible.length)throw Error('No viable football action');
 const unique=[...new Map(eligible.map(option=>[JSON.stringify(stable(option)),option])).values()];
 const groups=new Map<string,T[]>();
 for(const option of unique){const key=actionIntention(option);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(option);}
 const best=Math.max(...unique.map(option=>option.score));
 return [...groups.values()].flatMap(options=>{
  const groupBest=Math.max(...options.map(option=>option.score));
  const intentionWeight=Math.exp((groupBest-best)/WORLD.selection.choice.temperature.v);
  const variants=options.map(option=>({option,weight:Math.exp((option.score-groupBest)/WORLD.selection.choice.temperature.v)}));
  const total=variants.reduce((sum,variant)=>sum+variant.weight,0);
  return variants.map(({option,weight})=>({option,weight:intentionWeight*weight/total}));
 });
}

export function chooseAction<T extends ScoredAction>(eligible:readonly T[],random:()=>number):T {
 const weighted=actionWeights(eligible);let roll=random()*weighted.reduce((sum,variant)=>sum+variant.weight,0);
 for(const {option,weight}of weighted){roll-=weight;if(roll<=0)return option;}
 return weighted[weighted.length-1].option;
}
