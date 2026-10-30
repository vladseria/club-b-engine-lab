// Bebe's showcase, Track E (30 Oct 2026): the sides of the injury tuning runs. Evidence only; nothing here is the game.
//
// F.C. BEBE POWER: a select nine built from real Global league players (live snapshot 30 Oct, read-only; names, roles,
// ages, skills and traits only: no club owner, no member handle, no ids), picked the way DESIGN §5/§11 picks: the
// friends' clubs first, a club's only keeper never, one AI player (Lautaro, "playing next to Lautaro is fine"), two
// keepers. Balanced (Domnu' Excel), 1-2-1. Substitutions the normal way: three "tired" orders (the prep's code 95,
// energy 79 on today's curve: lib/ballers/subs.ts), the keeper never changed.
//
// GUEST SIDES: drafts for the data track (contracts/ENGINE.md §7). Each is nine generated players (five starters,
// three outfield subs, a second keeper) built from the real league's group means (../2026-10-19-engine-audits
// squads.ts MEAN / TRAITS, 108 players, 15 Oct) plus a level, the profile's own skill deltas (its gimmick, which the
// engine plays through skills and traits), a small fixed spread so nobody is a clone, rounded to whole skills in 1-10.
// Real Offshore's oligarch is one hand-made terrible player who always starts and is never in an order.
import {PRESETS} from '../../../../lib/ballers/league';
import {MEAN,TRAITS} from '../2026-10-19-engine-audits/squads';

type Skills=Record<'pace'|'aerial'|'control'|'passing'|'reading'|'stamina'|'strength'|'defending'|'finishing'|'setPieces'|'keeping',number>;
type Group='GK'|'DEF'|'MID'|'ST';
type Delta=Partial<Skills>;

const BEBE:{id:string;name:string;short:string;club:string;roles:string[];age:number;archetype:string;temperament:string;skills:Skills;traits:Record<string,number>}[]=[
 {id:'gk1',name:'Calu Caposu',short:'Caposu',club:'MEN',roles:['GK'],age:23,archetype:'libero',temperament:'cold',skills:{pace:7,aerial:4,control:4,keeping:9,passing:7,reading:9,stamina:4,strength:4,defending:4,finishing:3,setPieces:2},traits:{risk:.53,runs:.29,dribble:.11,comesShort:.33,discipline:.9,engagement:.44,keeperSweep:.87}},
 {id:'cb1',name:'Viorel Siguranță',short:'Siguranță',club:'RCS',roles:['CB','DM'],age:23,archetype:'ballwinner',temperament:'cold',skills:{pace:7,aerial:4,control:6,keeping:1,passing:6,reading:9,stamina:7,strength:7,defending:10,finishing:2,setPieces:2},traits:{risk:.37,runs:.35,dribble:.32,comesShort:.35,discipline:.68,engagement:.76}},
 {id:'w1',name:'Orlandinho',short:'Orlandinho',club:'FDD',roles:['W','CM'],age:20,archetype:'motor',temperament:'diva',skills:{pace:8,aerial:4,control:8,keeping:1,passing:8,reading:7,stamina:8,strength:4,defending:5,finishing:6,setPieces:4},traits:{risk:.42,runs:.62,dribble:.4,comesShort:.54,discipline:.79,engagement:.64}},
 {id:'w2',name:'Dimitru Dementoru',short:'Dementoru',club:'MEN',roles:['W','ST','AM'],age:18,archetype:'artist',temperament:'cold',skills:{pace:10,aerial:5,control:10,keeping:1,passing:6,reading:4,stamina:7,strength:4,defending:2,finishing:7,setPieces:8},traits:{risk:.83,runs:.35,dribble:.98,audacity:.3,comesShort:.32,discipline:.89,engagement:.5}},
 {id:'st1',name:'Ovidiu Cașcaval',short:'Cașcaval',club:'TRS',roles:['AM','ST'],age:31,archetype:'maverick',temperament:'ambitious',skills:{pace:10,aerial:7,control:7,keeping:1,passing:7,reading:6,stamina:6,strength:6,defending:6,finishing:9,setPieces:2},traits:{risk:.88,runs:.59,dribble:.6,audacity:.78,comesShort:.37,discipline:.81,engagement:.47}},
 {id:'cb2',name:'Lucian Clătită',short:'Clătită',club:'MEN',roles:['FB','CB'],age:27,archetype:'anchor',temperament:'ambitious',skills:{pace:6,aerial:7,control:4,keeping:1,passing:7,reading:5,stamina:7,strength:10,defending:8,finishing:4,setPieces:2},traits:{risk:.22,runs:.49,dribble:.28,comesShort:.27,discipline:.9,engagement:.42}},
 {id:'cm1',name:'Nae',short:'Nae',club:'FCD',roles:['CM','DM','AM'],age:26,archetype:'architect',temperament:'fuse',skills:{pace:4,aerial:7,control:8,keeping:1,passing:10,reading:7,stamina:7,strength:6,defending:4,finishing:4,setPieces:7},traits:{risk:.9,runs:.45,dribble:.41,audacity:.3,comesShort:.66,discipline:.49,engagement:.51,frustration:1}},
 {id:'st2',name:'Lautaro Martínez',short:'Lautaro',club:'INT',roles:['ST'],age:29,archetype:'predator',temperament:'ambitious',skills:{pace:6,aerial:7,control:7,keeping:1,passing:6,reading:8,stamina:8,strength:7,defending:4,finishing:9,setPieces:6},traits:{risk:.6,runs:.75,dribble:.45,comesShort:.35,discipline:.75,engagement:.7}},
 {id:'gk2',name:'Silviu Pastramă',short:'Pastramă',club:'TRS',roles:['GK'],age:31,archetype:'libero',temperament:'heart',skills:{pace:7,aerial:4,control:4,keeping:9,passing:7,reading:9,stamina:6,strength:5,defending:4,finishing:3,setPieces:4},traits:{risk:.6,runs:.37,dribble:.05,comesShort:.4,discipline:.83,engagement:.54,keeperSweep:.95}},
];

const frozen=(p:{id:string;name:string;short:string;roles:string[];skills:Skills;traits:Record<string,number>;archetype?:string;temperament?:string},number:number)=>
 ({id:p.id,name:p.name,short:p.short,number,roles:[...p.roles],skills:{...p.skills},traits:{...p.traits},energy:100,archetype:p.archetype??'x',temperament:p.temperament??'x',note:'x',portrait:'p0001'});

/** F.C. Bebe Power as a frozen side (lib/ballers/compute.ts FrozenSide), and the ages its injuries read. */
export function bebeSide(){
 const players=BEBE.map((p,i)=>frozen(p,i+1));
 return {side:{club:{id:'BEBE',name:'F.C. Bebe Power',code:'FBP',color:'#f2c400'},formation:'1-2-1',style:'balanced',approach:{...(PRESETS as any).balanced},captain:'st1',
  lineup:['gk1','cb1','w1','w2','st1'],bench:['cb2','cm1','st2','gk2'],players,plans:[],
  substitutions:[{id:'s1',in:'st2',trigger:{kind:'tired',player:'st1',threshold:95}},{id:'s2',in:'cm1',trigger:{kind:'tired',player:'w2',threshold:95}},{id:'s3',in:'cb2',trigger:{kind:'tired',player:'cb1',threshold:95}}]},
  ages:Object.fromEntries(BEBE.map(p=>[p.id,p.age]))};
}

export interface Profile {name:string;placeholder?:boolean;story:string;style:keyof typeof PRESETS;formation:'1-2-1'|'2-2'|'2-1-1';
 approach?:Record<string,string|number>;level:number;age:number;delta:Partial<Record<Group,Delta>>;traits?:Record<string,number>}
/** The guest sides (DESIGN §10). `level`: added to every group mean (F.C. Bebe Power's outfielders sit about +0.45
 * above the league's means, its keepers +0.7); `delta`: the gimmick, per group (OUT = every outfield group).
 * Round 1 (levels 0.5-1.0) left Bebe topping the group 79% of the time: round 2 raised every level by about the goal
 * difference Bebe had over the side (lab-s1 -> lab-s2). */
export const PROFILES:Record<string,Profile&{delta:Partial<Record<Group|'OUT',Delta>>}>={
 greucenii:{name:'Greucenii',story:'Sumo wrestlers: strength and aerial, no pace.',style:'direct',formation:'2-1-1',level:2,age:30,
  delta:{OUT:{strength:3,aerial:2.5,pace:-3,control:-1,stamina:-.5},GK:{strength:2,aerial:2,pace:-2}},traits:{engagement:.6}},
 realOffshore:{name:'Real Offshore',story:'The oligarch and his bodyguards: one terrible player always plays.',style:'balanced',formation:'1-2-1',level:2,age:36,
  delta:{OUT:{strength:3,defending:2,reading:.5,control:-2,passing:-1.5,finishing:-1,pace:-1}}},
 interEst:{name:'Inter Est',story:'Accountants: perfect positioning, zero flair.',style:'balanced',formation:'2-2',level:1.5,age:42,approach:{press:'selective'},
  delta:{OUT:{reading:3,defending:1.5,passing:1,control:-.5,finishing:-1.5,pace:-1,setPieces:-1,strength:-1}},traits:{discipline:.95,dribble:.08,risk:.12,audacity:.1,runs:.3}},
 sangeRece:{name:'Sânge Rece',story:'Vampires: quick early, fade fast.',style:'counter',formation:'1-2-1',level:0.8,age:28,approach:{press:'aggressive'},
  delta:{OUT:{pace:3,stamina:-3.5,strength:.5,control:.5,aerial:-.5}},traits:{engagement:.75}},
 lemneVerzi:{name:'Lemne Verzi',story:'Lumberjacks: strength, long balls.',style:'direct',formation:'2-1-1',level:1.6,age:34,
  delta:{OUT:{strength:2.5,aerial:1.5,stamina:1,control:-1.5,passing:-1.5,pace:-1,reading:-1}}},
 cirque:{name:'Cirque du Sorin',story:'A circus troupe: dribbling and control, cannot defend.',style:'combinations',formation:'1-2-1',level:1.5,age:27,
  delta:{OUT:{control:3,passing:1,pace:.5,defending:-3,reading:-1,strength:-1.5}},traits:{dribble:.85,audacity:.9,risk:.85}},
 postmen:{name:'(postmen, name to come)',placeholder:true,story:'Retired postmen: stamina and passing.',style:'balanced',formation:'2-2',level:1.8,age:58,
  delta:{OUT:{stamina:3,passing:2,pace:-2.5,finishing:-1,strength:-1,aerial:-.5}}},
 pirates:{name:'(pirates, name to come)',placeholder:true,story:'Pirates: tackle everything.',style:'counter',formation:'2-2',level:1.4,age:34,approach:{press:'aggressive',onLoss:'counterpress'},
  delta:{OUT:{defending:2,strength:2,aerial:.5,passing:-2,control:-1.5,reading:-1}},traits:{engagement:.95,discipline:.3}},
};
const SKILLS=['pace','aerial','control','passing','reading','stamina','strength','defending','finishing','setPieces'] as const;
const SLOTS:Record<string,[Group,string[]][]>={
 '1-2-1':[['GK',['GK']],['DEF',['CB','FB']],['MID',['W','AM']],['MID',['W','AM']],['ST',['ST']]],
 '2-2':[['GK',['GK']],['DEF',['CB','FB']],['DEF',['CB','FB']],['MID',['W','AM']],['MID',['W','AM']]],
 '2-1-1':[['GK',['GK']],['DEF',['CB','FB']],['DEF',['CB','FB']],['MID',['CM','DM']],['ST',['ST']]],
};
const BENCH:[Group,string[]][]=[['DEF',['CB','FB']],['MID',['CM','W']],['ST',['ST']],['GK',['GK']]];
/** A guest player: group mean + level + the profile's delta + a small fixed spread (sums to about zero), whole skills in 1-10. */
function guestPlayer(key:string,p:Profile&{delta:any},i:number,g:Group,roles:string[]){
 const d={...(g==='GK'?{}:p.delta.OUT??{}),...(p.delta[g]??{})},skills:any={};
 SKILLS.forEach((s,k)=>{const spread=((i*7+k*3)%3)-1;skills[s]=Math.max(1,Math.min(10,Math.round(MEAN[g][s]+p.level+(d[s]??0)+spread*.6)));});
 skills.keeping=g==='GK'?Math.max(1,Math.min(10,Math.round(MEAN.GK.keeping+p.level+(d.keeping??0)))):1;
 const traits={...TRAITS[g],...(g==='GK'?{}:p.traits??{})};
 return frozen({id:`${key.slice(0,3)}${i+1}`,name:`${p.name} ${i+1}`,short:`${key.slice(0,3)}${i+1}`,roles,skills,traits},i+1);
}
/** A guest side as a frozen side, its ages, and its subs (three "tired" orders on its outfield starters, as Bebe's). */
export function guestSide(key:string){
 const p=PROFILES[key];if(!p)throw Error('unknown profile '+key);
 const slots=[...SLOTS[p.formation],...BENCH],players=slots.map(([g,roles],i)=>guestPlayer(key,p,i,g,roles));
 const ages:Record<string,number>=Object.fromEntries(players.map(q=>[q.id,p.age]));
 if(key==='realOffshore'){
  // the oligarch: in the last starting slot (the striker), every skill 2-3, sure he is Messi; never in an order
  const o=players[4];Object.assign(o,{name:'Oligarhul',short:'Oligarhul',skills:{pace:2,aerial:2,control:3,passing:2,reading:2,stamina:2,strength:3,defending:1,finishing:3,setPieces:3,keeping:1},traits:{...o.traits,risk:.95,dribble:.9,audacity:.95,discipline:.5,runs:.2}});
  ages[o.id]=56;
 }
 const ids=players.map(q=>q.id),lineup=ids.slice(0,5),bench=ids.slice(5);
 // each outfield sub replaces a starter of his own group where one is left (the oligarch is never replaced)
 const open=[1,2,3,4].filter(i=>!(key==='realOffshore'&&i===4)),groupOf=(i:number)=>slots[i][0];
 const substitutions=[0,1,2].map(k=>{const g=groupOf(5+k),at=open.find(i=>groupOf(i)===g)??open[0];open.splice(open.indexOf(at),1);
  return {id:`g${k}`,in:bench[k],trigger:{kind:'tired',player:lineup[at],threshold:95}};});
 const approach={...(PRESETS as any)[p.style],...(p.approach??{})};
 return {side:{club:{id:key,name:p.name,code:key.slice(0,3).toUpperCase(),color:'#666666'},formation:p.formation,style:p.style,approach,captain:lineup[1],lineup,bench,players,plans:[],substitutions},ages};
}
