// Ceiling routes (2026-10-20): the squads and plans. Evidence only.
// The budget, the means, the traits, the ranges, the average squad and side() are the squad-fit study's (branch
// squad-fit-study, packages/football-engine/evidence/2026-10-19-squad-fit/squads.ts, 19 Oct), copied; added here:
// per-winger deltas/traits (w3 = SQD3, lane -1; w4 = SQD4, lane +1), the three route squads and their pace-boosted
// variants, and the opponent plans deep / high.
//
// THE BUDGET (squad-fit). Nine players, the same average keeper, four outfield starters built from the real league's role
// means. A squad moves skill points between skills of the SAME player: every player's deltas sum to zero, so each
// player, and the squad, keeps exactly the average total. Guards (validate()): every skill inside the league's outfield
// range; no skill more than 3 points from its group mean. Pace stays at the group mean in the route squads (the pace
// variants are labelled separately). Traits stay at the group means except the one a route names.
import {PRESETS} from '../../../../lib/ballers/league';

export type Skills={pace:number;aerial:number;control:number;passing:number;reading:number;stamina:number;strength:number;defending:number;finishing:number;setPieces:number;keeping:number};
type Group='GK'|'DEF'|'MID'|'ST';
const r1=(v:number)=>Math.round(v*10)/10;
export const MEAN:Record<Group,Skills>={
 GK: {pace:5.3,aerial:6.0,control:6.0,passing:5.3,reading:8.5,stamina:6.8,strength:6.1,defending:3.9,finishing:2.5,setPieces:4.0,keeping:8.3},
 DEF:{pace:5.0,aerial:6.4,control:5.0,passing:6.2,reading:6.8,stamina:6.8,strength:6.8,defending:6.8,finishing:4.0,setPieces:4.7,keeping:1},
 MID:{pace:6.1,aerial:5.1,control:7.1,passing:6.9,reading:6.1,stamina:7.2,strength:4.6,defending:4.2,finishing:4.7,setPieces:6.3,keeping:1},
 ST: {pace:5.4,aerial:6.3,control:5.6,passing:5.1,reading:6.1,stamina:6.3,strength:6.7,defending:2.8,finishing:8.2,setPieces:6.4,keeping:1},
};
export const TRAITS:Record<Group,Record<string,number>>={
 GK: {risk:.28,runs:.34,dribble:.07,comesShort:.34,discipline:.76,engagement:.54,keeperSweep:.31},
 DEF:{risk:.40,runs:.44,dribble:.32,comesShort:.41,discipline:.80,engagement:.56,audacity:.50},
 MID:{risk:.68,runs:.49,dribble:.46,comesShort:.55,discipline:.79,engagement:.56,audacity:.65},
 ST: {risk:.58,runs:.63,dribble:.38,comesShort:.36,discipline:.76,engagement:.54,audacity:.74},
};
export const RANGE:Record<keyof Skills,[number,number]>={pace:[3,10],aerial:[4,9],control:[2,10],passing:[2,10],reading:[2,10],stamina:[3,10],strength:[3,10],defending:[1,10],finishing:[1,10],setPieces:[2,10],keeping:[1,1]};

type Delta=Partial<Record<keyof Skills,number>>;
/** Deltas per outfield slot: d = SQD2 (centre-back), w3 = SQD3 (left winger, lane -1), w4 = SQD4 (right winger), s = SQD5. */
interface Squad {name:string;story:string;d:Delta;w3:Delta;w4:Delta;s:Delta;traits?:Partial<Record<'d'|'w3'|'w4'|'s',Record<string,number>>>}
const both=(x:Delta)=>({w3:x,w4:x});
export const SQUADS:Record<string,Squad>={
 avg:{name:'Average',story:'Every man at his group mean.',d:{},...both({}),s:{}},
 // Isolation: an elite dribbler on the left (control to 10, dribble trait 0.9); a passing winger, a passing centre-back
 // and a linking striker to find him early.
 iso:{name:'Isolation',story:'Elite dribbler on the left; passers to find him.',
  d:{passing:2,aerial:-1,finishing:-1},
  w3:{control:2.9,aerial:-1,strength:-1,setPieces:-0.9},
  w4:{passing:2.5,reading:0.5,finishing:-1.5,setPieces:-1,aerial:-0.5},
  s:{passing:1.5,control:1,aerial:-1,strength:-0.5,setPieces:-1},traits:{w3:{dribble:.9}}},
 // Pivot: a target man who holds it (strength, control, passing; reading = the skill half of his composure), runners who
 // read the lay-off and finish it, a centre-back who can find the pivot.
 piv:{name:'Pivot lay-off',story:'A target man who holds and lays off; wingers who read and finish.',
  d:{passing:1.5,finishing:-1.5},
  ...both({reading:1.5,finishing:2,setPieces:-1.5,aerial:-1,strength:-1}),
  s:{strength:2,control:2,passing:2,reading:1,finishing:-2.5,setPieces:-2.5,defending:-1.5,stamina:-0.5}},
 // Overload: tireless passing wingers who make runs (runs trait 0.75), a solid centre-back, a linking striker.
 ovl:{name:'Flank overload',story:'Two tireless passing wingers who go to one flank together; a solid centre-back.',
  d:{defending:2,reading:1,strength:0.5,finishing:-1.5,setPieces:-1,control:-1},
  ...both({stamina:2,passing:1.5,aerial:-1,strength:-1,defending:-1.5}),
  s:{passing:1,stamina:1,aerial:-1,setPieces:-1},traits:{w3:{runs:.75},w4:{runs:.75}}},
 // Pace-boosted variants (labelled separately): the route's key men +2 pace, paid by the same man.
 isoP:{name:'Isolation, quick dribbler',story:'As Isolation; the dribbler +2 pace (paid with defending, stamina).',
  d:{passing:2,aerial:-1,finishing:-1},
  w3:{control:2.9,aerial:-1,strength:-1,setPieces:-0.9,pace:2,defending:-1.5,stamina:-0.5},
  w4:{passing:2.5,reading:0.5,finishing:-1.5,setPieces:-1,aerial:-0.5},
  s:{passing:1.5,control:1,aerial:-1,strength:-0.5,setPieces:-1},traits:{w3:{dribble:.9}}},
 pivP:{name:'Pivot lay-off, quick runners',story:'As Pivot lay-off; the wingers +2 pace (paid with defending).',
  d:{passing:1.5,finishing:-1.5},
  ...both({reading:1.5,finishing:2,setPieces:-1.5,aerial:-1,strength:-1,pace:2,defending:-2}),
  s:{strength:2,control:2,passing:2,reading:1,finishing:-2.5,setPieces:-2.5,defending:-1.5,stamina:-0.5}},
 ovlP:{name:'Flank overload, quick wingers',story:'As Flank overload; the wingers +2 pace (paid with set pieces).',
  d:{defending:2,reading:1,strength:0.5,finishing:-1.5,setPieces:-1,control:-1},
  ...both({stamina:2,passing:1.5,aerial:-1,strength:-1,defending:-1.5,pace:2,setPieces:-2}),
  s:{passing:1,stamina:1,aerial:-1,setPieces:-1},traits:{w3:{runs:.75},w4:{runs:.75}}},
};

type Approach=typeof PRESETS.balanced;
interface Plan {name:string;style:keyof typeof PRESETS;set?:Partial<Record<keyof Approach,string|number>>}
/** Board plans. Every route plays on the Direct preset (the route layer is the probe's, routes.ts). */
export const PLANS:Record<string,Plan>={
 dir:{name:'Direct 1-2-1',style:'direct'},
 deep:{name:'Direct, line Deep',style:'direct',set:{line:'deep'}},
 high:{name:'Direct, line High',style:'direct',set:{line:'high'}},
};

const GROUP_OF=(slot:number):Group=>slot===0?'GK':slot===1?'DEF':slot===4?'ST':'MID';
const KEY=['','d','w3','w4','s'] as const;
const ROLE_OF:Record<Group,string[]>={GK:['GK'],DEF:['CB'],MID:['W'],ST:['ST']};
const deltaOf=(q:Squad,slot:number):Delta=>slot===0?{}:(q as any)[KEY[slot]];

export function validate(){
 for(const [k,q] of Object.entries(SQUADS))for(const slot of [1,2,3,4]){
  const g=GROUP_OF(slot),d=deltaOf(q,slot),sum=Object.values(d).reduce((x,y)=>x+(y??0),0);
  if(Math.abs(sum)>1e-9)throw Error(`${k} slot ${slot}: deltas sum to ${sum}`);
  for(const [s,v] of Object.entries(d)){
   const val=r1(MEAN[g][s as keyof Skills]+v!),[lo,hi]=RANGE[s as keyof Skills];
   if(Math.abs(v!)>3+1e-9)throw Error(`${k} slot ${slot} ${s}: delta ${v} beyond 3`);
   if(val<lo-1e-9||val>hi+1e-9)throw Error(`${k} slot ${slot} ${s}: ${val} outside ${lo}-${hi}`);
   if(s==='pace'&&!k.endsWith('P'))throw Error(`${k}: pace must stay at the mean outside the pace variants`);
  }
 }
}
validate();

export function player(code:string,slot:number,squad:string,bench=false){
 const q=SQUADS[squad];if(!q)throw Error('unknown squad '+squad);
 const g=GROUP_OF(slot),d=bench?{}:deltaOf(q,slot);
 const skills:any={...MEAN[g]};for(const [s,v] of Object.entries(d))skills[s]=r1(skills[s]+v!);
 const traits={...TRAITS[g],...(bench||slot===0?{}:(q.traits as any)?.[KEY[slot]]??{})};
 const n=bench?slot+6:slot+1,id=`${code}${bench?'b':''}${slot+1}`;
 return {id,name:`${code} ${bench?'bench ':''}${slot+1}`,short:id,number:n,roles:ROLE_OF[g],skills,traits,energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'};
}
/** A side: 5 starters of the squad + 4 average bench players, on a board plan (1-2-1). */
export function side(code:string,color:string,squad:string,planKey:string){
 const plan=PLANS[planKey];if(!plan)throw Error('unknown plan '+planKey);
 const starters=[0,1,2,3,4].map(i=>player(code,i,squad));
 const bench=[0,1,2,4].map(i=>player(code,i,'avg',true));
 const approach:any={...(PRESETS as any)[plan.style]};
 for(const [k,v] of Object.entries(plan.set??{})){if(!(k in approach))throw Error('unknown setting '+k);approach[k]=v;}
 return {club:{id:code,name:code,code,color},formation:'1-2-1',style:plan.style,approach,captain:starters[1].id,
  lineup:starters.map(p=>p.id),bench:bench.map(p=>p.id),players:[...starters,...bench],plans:[]};
}
