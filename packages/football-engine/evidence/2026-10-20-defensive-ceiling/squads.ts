// Defensive ceiling (2026-10-20): the two mirror squads. Evidence only.
//  eq  the neutral five of ../2026-10-10-cloud-measure/mirror.ts (copied): every outfield skill 6 (keeping 1), the same
//      keeper, traits at 0.5 (discipline 0.8, frustration 1), no bench, no plans.
//  rp  the same five with the Global pool's average pace by position (the brief, 20 Oct): CB 5.1, W 7.8, W 7.8, ST 5.6
//      (1-2-1 slots: model.ts FORMATIONS '1-2-1' = GK, CB, W -1, W +1, ST); everything else as eq. Both sides use it
//      (a mirror), so fast forwards meet slow defenders on both sides.
// A side plays Direct (di) or Balanced (ba), the preset unchanged except its Line (deep | standard | high).
import {PRESETS} from '../../../../lib/ballers/league';

const OUT={pace:6,aerial:6,control:6,passing:6,reading:6,stamina:6,strength:6,defending:6,finishing:6,setPieces:6,keeping:1};
const GK={pace:5,aerial:6,control:5,passing:5,reading:6,stamina:6,strength:6,defending:3,finishing:2,setPieces:3,keeping:6};
const TRAITS={risk:.5,runs:.5,dribble:.5,comesShort:.5,engagement:.5,discipline:.8,frustration:1,audacity:.5};
const ROLES=[['GK'],['CB'],['CB'],['CM'],['ST']];
export const PACE:Record<string,number[]|null>={eq:null,rp:[5,5.1,7.8,7.8,5.6]};
export const STYLE:Record<string,'direct'|'balanced'|'combinations'|'counter'>={di:'direct',ba:'balanced',sh:'combinations',co:'counter'};
/** `pre` keeps the preset's own Line (recon round 3, the four styles as shipped). */
export const LINE:Record<string,'deep'|'standard'|'high'|'pre'>={deep:'deep',std:'standard',high:'high',pre:'pre'};

export function side(code:string,color:string,squad:string,style:string,line:string):any{
 const pace=PACE[squad];if(pace===undefined)throw Error('unknown squad '+squad);
 const st=STYLE[style];if(!st)throw Error('unknown style '+style);
 const ln=LINE[line];if(!ln)throw Error('unknown line '+line);
 const players=ROLES.map((roles,i)=>{
  const gk=i===0,skills:any={...(gk?GK:OUT)};
  if(pace&&!gk)skills.pace=pace[i];
  return {id:`${code}${i+1}`,name:`${code} ${i+1}`,short:`${code}${i+1}`,number:i+1,roles:[...roles],skills,traits:gk?{...TRAITS,keeperSweep:.5}:{...TRAITS},energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'};
 });
 const approach:any={...(PRESETS as any)[st]};if(ln!=='pre')approach.line=ln;
 return {club:{id:code,name:code,code,color},formation:'1-2-1',style:st,approach,captain:`${code}2`,lineup:players.map(p=>p.id),bench:[],players,plans:[]};
}
