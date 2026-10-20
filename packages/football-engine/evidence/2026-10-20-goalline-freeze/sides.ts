// Settings audit (2026-10-20): the frozen sides. Evidence only.
//
// THE TWO DEFAULTS. Every side in every cell plays striker 'run' (In behind) and commit 4 (Bodies forward 4), whatever
// its preset or arm says. They are fixed in the frozen input (the approach object), the one thing computeMatch takes, so
// the engine plays exactly what it would play if both were engine defaults no player controls: no engine source and no
// bundle transform is involved (no hook), and the rest of the preset reaches the engine unchanged (step0.mjs prints the
// engine Tactics of every set-up to show it). Counter's 8 s window (team-approach.ts:38) sets striker 'run' unless
// pivot/link and commit max(4, commit): with the defaults it changes only progression -> 'direct'.
//
// The squad: the neutral five of ../2026-10-10-cloud-measure/mirror.ts (as ../2026-10-20-defensive-ceiling/squads.ts
// `eq`): every outfield skill 6 (keeping 1), the same keeper, traits 0.5 (discipline 0.8, frustration 1), keeperSweep
// 0.5, no bench, no plans. The engine takes each slot's role from the formation (model.ts FORMATIONS), so the same five
// plays 1-2-1 and 2-2.
import {PRESETS} from '../../../../lib/ballers/league';

const OUT={pace:6,aerial:6,control:6,passing:6,reading:6,stamina:6,strength:6,defending:6,finishing:6,setPieces:6,keeping:1};
const GK={pace:5,aerial:6,control:5,passing:5,reading:6,stamina:6,strength:6,defending:3,finishing:2,setPieces:3,keeping:6};
const TRAITS={risk:.5,runs:.5,dribble:.5,comesShort:.5,engagement:.5,discipline:.8,frustration:1,audacity:.5};
const ROLES=[['GK'],['CB'],['CB'],['CM'],['ST']];
export const STYLE:Record<string,'balanced'|'combinations'|'direct'|'counter'>={ba:'balanced',sh:'combinations',di:'direct',co:'counter'};
export const FORM:Record<string,'1-2-1'|'2-2'>={'121':'1-2-1','22':'2-2'};
/** The two settings this audit takes off the board. */
export const DEFAULTS={striker:'run',commit:4} as const;

/** One change from a preset (Block B arms). `fk`/`keeper` are match settings, the rest approach keys. */
export interface Change {formation?:'1-2-1'|'2-2';set?:Record<string,string|number>;keeper?:'line'|'sweeper';fk?:'short'|'delivery'}

export function side(code:string,color:string,style:string,formation:'1-2-1'|'2-2',ch:Change={}):any{
 const st=STYLE[style];if(!st)throw Error('unknown style '+style);
 const players=ROLES.map((roles,i)=>{
  const gk=i===0;
  return {id:`${code}${i+1}`,name:`${code} ${i+1}`,short:`${code}${i+1}`,number:i+1,roles:[...roles],skills:{...(gk?GK:OUT)},traits:gk?{...TRAITS,keeperSweep:.5}:{...TRAITS},energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'};
 });
 // the preset, then the two defaults, then the one change. Only Block B's c3 / c5 arms (Bodies forward 3 / 5, added by
 // the coordinator 20 Oct) touch a default, and only commit; striker is never an arm.
 if(ch.set&&'striker' in ch.set)throw Error('striker is fixed In behind');
 const approach:any={...(PRESETS as any)[st],...DEFAULTS,...(ch.set??{})};
 const settings=ch.keeper||ch.fk?{...(ch.keeper?{keeper:ch.keeper}:{}),...(ch.fk?{setPiece:ch.fk}:{})}:undefined;
 return {club:{id:code,name:code,code,color},formation:ch.formation??formation,style:st,approach,captain:`${code}2`,lineup:players.map(p=>p.id),bench:[],players,plans:[],...(settings?{settings}:{})};
}
