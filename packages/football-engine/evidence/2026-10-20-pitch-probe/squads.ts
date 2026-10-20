// Pitch probe (2026-10-20): the neutral mirror squad, copied from ../2026-10-20-defensive-ceiling/squads.ts (branch
// defensive-ceiling), eq only. Evidence only.
//  eq  the neutral five of ../2026-10-10-cloud-measure/mirror.ts: every outfield skill 6 (keeping 1), the same keeper,
//      traits at 0.5 (discipline 0.8, frustration 1), no bench, no plans. Formation 1-2-1 (GK, CB, W -1, W +1, ST).
// A side plays one of the four styles with its preset exactly as shipped (its own Line): di Direct, ba Balanced,
// sh Short (= combinations), co Counter.
import {PRESETS} from '../../../../lib/ballers/league';

const OUT={pace:6,aerial:6,control:6,passing:6,reading:6,stamina:6,strength:6,defending:6,finishing:6,setPieces:6,keeping:1};
const GK={pace:5,aerial:6,control:5,passing:5,reading:6,stamina:6,strength:6,defending:3,finishing:2,setPieces:3,keeping:6};
const TRAITS={risk:.5,runs:.5,dribble:.5,comesShort:.5,engagement:.5,discipline:.8,frustration:1,audacity:.5};
const ROLES=[['GK'],['CB'],['CB'],['CM'],['ST']];
export const STYLE:Record<string,'direct'|'balanced'|'combinations'|'counter'>={di:'direct',ba:'balanced',sh:'combinations',co:'counter'};

export function side(code:string,color:string,style:string):any{
 const st=STYLE[style];if(!st)throw Error('unknown style '+style);
 const players=ROLES.map((roles,i)=>{
  const gk=i===0,skills:any={...(gk?GK:OUT)};
  return {id:`${code}${i+1}`,name:`${code} ${i+1}`,short:`${code}${i+1}`,number:i+1,roles:[...roles],skills,traits:gk?{...TRAITS,keeperSweep:.5}:{...TRAITS},energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'};
 });
 const approach:any={...(PRESETS as any)[st]};
 return {club:{id:code,name:code,code,color},formation:'1-2-1',style:st,approach,captain:`${code}2`,lineup:players.map(p=>p.id),bench:[],players,plans:[]};
}
