// Play-off odds (2026-11-14, measurement only): one full match of a freshly founded squad AWAY at Rapid Pensia, the
// league's weakest AI club, through the official code path (lib/ballers/compute.ts computeMatch, the function the
// browser engine worker and the compute route both run). Every Rapid Pensia man (bench included) starts at the task's
// energy; the new club's men start at 100. README.md in this folder says where each rule below comes from.
//
// The input, as practice builds one (components/ballers/next/ready/practice-run.ts inputOf) with the league's kickoff
// rule (private.ballers_freeze_match, 20261102200300_ballers_fitness_league.sql: kickoff = seed % 2, duration 900):
//   {v:1, match, seed, kickoff: seed % 2, duration: 900, sides: [Rapid Pensia (home), the new club]}
// No `injuries` key and no `fitness` marker: practice inputs carry neither, and the play-off is designed to run in the
// player's browser the way practice does (deliverables/ballers-joiner/DESIGN.md, rule 3). The marker never reaches the
// engine anyway (compute.ts FrozenFitness).
import {computeMatch,validateInput,engineTeam,sideOrders,sideSwitches,type FrozenInput,type FrozenSide} from '../../../../lib/ballers/compute';
import {frozenSide} from '../../../../lib/ballers/lab/team';
import {atStarts,theirSide} from '../../../../lib/ballers/practice-opponent';
import {PRESETS,type Player,type Style,type BoardFormation} from '../../../../lib/ballers/league';
import {boardApproach,boardFormation} from '../../../../lib/ballers/approach';
import {matchChances} from '../../../../lib/ballers/chances';
import {ENGINE_BUILD} from '../../src/build-info';
import {createHash} from 'node:crypto';

// ------------------------------------------------------------------ the design
/** The four start levels the owner named, in ladder order (fitness.ts: Fresh >= 96, Match fit >= 88; 80 is the lowest
 * start the fitness feature ever gives (`floor`), "Tired"; 72 is below it, the owner's "running on empty"). */
export const LEVELS={fresh:100,fit:90,tired:80,empty:72} as const;
export type Level=keyof typeof LEVELS;
export const LEVEL_ORDER:Level[]=['fresh','fit','tired','empty'];
/** The plans the founding page offers (FoundPage.tsx: BOARD_FORMATIONS x STYLE_KEYS), eight in all. */
const FORMS:BoardFormation[]=['1-2-1','2-2'];
const STYLES:Style[]=['balanced','combinations','direct','counter'];
/** Squad n's plan. The 24 squads cycle four captains (n-1) % 4; block b = floor((n-1)/4). Formation by block parity,
 * style rotated by captain + block: each of the eight plans is played by exactly three squads, and each captain meets
 * three styles in both shapes rather than one plan. */
export function planOf(n:number):{formation:BoardFormation;style:Style}{
 const k=n-1,c=k%4,b=Math.floor(k/4);
 return {formation:FORMS[b%2],style:STYLES[(c+b)%4]};
}
/** Squad n's four seeds; the SAME four at every level (paired). */
export const seedsOf=(n:number)=>[0,1,2,3].map(j=>1114000+(n-1)*4+j);

// ------------------------------------------------------------------ data
type FreshPlayer={id:string;name:string;short:string;number:number;slot:number;roles:string[];skills:any;traits:any;archetype:string;temperament:string;note:string;face:string|null;captain:boolean};
type Data={pensia:{club:any;players:any[]};fresh:{n:number;seed:number;captain:{position:string};squad:{captainSlot:number;players:FreshPlayer[]}}[]};
let D:Data|null=null;
/** run.mjs reads input.json and hands it over. */
export function init(d:Data){D=d;}
const data=()=>{if(!D)throw Error('input not loaded');return D;};
const md5=(x:unknown)=>createHash('md5').update(JSON.stringify(x)).digest('hex').slice(0,12);

/** A squad in league order: the five as given, then the rest by shirt number (private.ballers_bench, and
 * private.ballers_input_side's player order: lineup || bench). */
function leagueOrder<P extends {id:string;number:number}>(men:P[],lineup:string[]):P[]{
 const five=lineup.map(id=>{const p=men.find(m=>m.id===id);if(!p)throw Error(`lineup man ${id} not in squad`);return p;});
 return [...five,...men.filter(m=>!lineup.includes(m.id)).sort((a,b)=>a.number-b.number)];
}

// ------------------------------------------------------------------ Rapid Pensia
/** The twin of private.ballers_showcase_subs (20261031090000_ballers_showcase.sql), the three orders
 * private.ballers_fitness_ai_side (20261102200200_ballers_fitness_ai.sql step 6) gives an AI side that has none: bench
 * outfielders in the given bench order, for the outfield starters (lineup slots 2-5) with the least stamina (missing = 5,
 * ties by slot); the first two on "tired" (code 95) not before 450 s, the third if losing, not before 720 s. */
export function aiOrders(players:{id:string;roles:string[];skills:{stamina?:number}}[],lineup:string[],bench:string[],prefix:string){
 const role=(id:string)=>players.find(p=>p.id===id)!;
 const benched=bench.filter(id=>players.some(p=>p.id===id)&&!role(id).roles.includes('GK'));
 const starters=lineup.slice(1).map((id,i)=>({id,n:i+2,st:role(id).skills.stamina??5})).sort((a,b)=>a.st-b.st||a.n-b.n).map(x=>x.id);
 const out:any[]=[];
 for(let k=1;k<=3;k++){
  const inn=benched[k-1],off=starters[k-1];if(!inn||!off)continue;
  out.push(k<3?{id:prefix+k,in:inn,out:off,trigger:{kind:'tired',player:off,threshold:95},notBefore:450}
              :{id:prefix+k,in:inn,out:off,trigger:{kind:'score',state:'losing'},notBefore:720});
 }
 return out;
}
const pensiaSquad=():Player[]=>{
 const {club,players}=data().pensia;
 return leagueOrder(players.map(p=>({id:p.id,name:p.name,short:p.short,number:p.number,roles:[...p.roles],skills:{...p.skills},traits:{...p.traits},
  energy:p.energy,archetype:p.archetype,temperament:p.temperament,note:p.note??'',portrait:p.portrait??'',club_id:club.id,space:'',founder:false} as unknown as Player)),club.lineup);
};
/** Rapid Pensia as the league freezes an AI side with fitness on (private.ballers_input_side, 20261021120000; then
 * private.ballers_fitness_ai_side): the club row's five, formation, style and approach (board-trimmed), the club's
 * captain if he starts, else slot 2; the bench by shirt number; no plans, settings, voice or switch (an AI prep carries
 * none); Bebe's three orders. Played through practice's own opponent builder (practice-opponent.ts theirSide: frozenSide
 * with each man at his start, plus the orders), every man at `energy`.
 * With every man at one energy nobody is rested or replaced (fitness_ai_side step 3 only swaps a Tired starter for a man
 * who is neither out nor Tired), so the five is the club row at every level. The orders are built as on a night when
 * Pensia are fresh (the bench in shirt order) and are the same at every level: see README.md, "Choices". */
export function pensiaSide(energy:number):FrozenSide{
 const {club}=data().pensia,squad=pensiaSquad();
 const formation=boardFormation(club.formation) as BoardFormation,approach=boardApproach(club.approach);
 const lineup=[...club.lineup] as string[],bench=squad.filter(p=>!lineup.includes(p.id)).map(p=>p.id);
 const captain=lineup.includes(club.captain)?club.captain:lineup[1];
 const substitutions=aiOrders(squad,lineup,bench,`ai:${club.id}:`);
 const side={lineup,formation,style:club.style,approach,captain,substitutions} as Parameters<typeof theirSide>[2];
 return theirSide({id:club.id,name:club.name,code:club.code,color:club.color},squad,side,null,{start:()=>energy,out:()=>false}).side;
}

// ------------------------------------------------------------------ the new club
/** A new club as founding stores it (20261113120000_ballers_founding_captain_points.sql): private.ballers_generate_squad
 * inserts the nine in slot order and sets lineup = the first five (slots 0-4) and captain = the captainSlot man;
 * public.ballers_create_club stores {formation, style} from the page and approach = private.ballers_preset(style)
 * (= PRESETS[style]); private.ballers_seed_plans makes the Home plan from that (settings = the preset, set pieces none),
 * and the founding prep has no orders and default match settings. As practice plays the plan
 * (practice-run.ts ourSide: frozenSide with the plan's settings and set pieces, the squad at its starts): every man at 100. */
export function newSide(n:number):FrozenSide{
 const f=data().fresh.find(x=>x.n===n);if(!f)throw Error('no squad '+n);
 const {formation,style}=planOf(n);
 const men=f.squad.players.map(p=>({id:p.id,name:p.name,short:p.short,number:p.number,roles:[...p.roles],skills:{...p.skills},traits:{...p.traits},energy:100,
  archetype:p.archetype,temperament:p.temperament,note:p.note??'',portrait:p.face??'',club_id:`new-${n}`,space:'',founder:true} as unknown as Player));
 const lineup=f.squad.players.filter(p=>p.slot<5).sort((a,b)=>a.slot-b.slot).map(p=>p.id);
 const captain=f.squad.players.find(p=>p.slot===f.squad.captainSlot)!.id;
 const squad=atStarts(leagueOrder(men,lineup),()=>100);
 return frozenSide({id:`new-club-${n}`,name:`New club ${n}`,code:'NEW',color:'#2F6FDB'},squad,{lineup,formation,style,approach:PRESETS[style],captain,settings:{}},[]);
}

// ------------------------------------------------------------------ the match
export interface Task {label?:string;n:number;level:Level;seed:number}
export function inputOf(t:Task):FrozenInput{
 const e=LEVELS[t.level];if(e===undefined)throw Error('unknown level '+t.level);
 return validateInput({v:1,match:`playoff-odds-${t.n}-${t.seed}`,seed:t.seed,kickoff:t.seed%2,duration:900,sides:[pensiaSide(e),newSide(t.n)]}) as FrozenInput;
}
/** Builds a task's input and both engine teams, orders and switches as computeMatch does, WITHOUT playing; throws if the
 * engine would leave anything out, or if the pairing does not hold (the new club's side, and Pensia's side but for the
 * energies, are the same at every level). */
export function dryCheck(t:Task){
 const inp=inputOf(t),teams=inp.sides.map(engineTeam) as [any,any];
 const o=sideOrders(inp,teams),w=sideSwitches(inp,teams);
 if(o.dropped.length||w.dropped.length)throw Error(`${t.n}/${t.level}: the engine refuses ${[...o.dropped,...w.dropped].join(', ')}`);
 if(o.orders.filter(x=>x.side===0).length!==3)throw Error(`${t.n}/${t.level}: Pensia's three orders do not all reach the engine`);
 if(o.orders.some(x=>x.side===1)||w.switches.length)throw Error(`${t.n}: the new club carries orders or a switch`);
 const [p,m]=inp.sides,e=LEVELS[t.level];
 if(p.players.some(x=>x.energy!==e)||teams[0].squad.some((x:any)=>x.energy!==e))throw Error('Pensia energies');
 if(m.players.some(x=>x.energy!==100))throw Error('new club energies');
 return {pensiaFp:md5({...p,players:p.players.map(x=>({...x,energy:0}))}),newFp:md5(m),
  pensia:{formation:p.formation,style:p.style,approach:p.approach,lineup:p.lineup.map(id=>p.players.find(x=>x.id===id)!.short),captain:p.players.find(x=>x.id===p.captain)!.short,
   tactics:teams[0].tactics,orders:o.orders.filter(x=>x.side===0).map(x=>({id:x.id,in:p.players.find(q=>q.id===x.in)!.short,out:p.players.find(q=>q.id===x.out)!.short,trigger:x.trigger,notBefore:x.notBefore}))},
  newClub:{formation:m.formation,style:m.style,approach:m.approach,lineup:m.lineup.map(id=>m.players.find(x=>x.id===id)!.short),captain:m.players.find(x=>x.id===m.captain)!.short,settings:m.settings??null,tactics:teams[1].tactics}};
}
export function play(t:Task){
 const t0=Date.now(),inp=inputOf(t),r=computeMatch(inp),c=r.compact;
 if(r.engineBuild!==ENGINE_BUILD)throw Error('engine build mismatch');
 const events=c.chunks.flatMap(ch=>ch.e);
 const subs=(side:0|1)=>((c.substitutionNotes??[]).find(s=>s.side===side)?.notes??[]).filter((x:any)=>x.status==='made').map((x:any)=>Math.round(x.time??-1));
 const [pa,na]=[c.score[0],c.score[1]];
 return {label:t.label,n:t.n,cap:data().fresh.find(x=>x.n===t.n)!.captain.position,...planOf(t.n),level:t.level,energy:LEVELS[t.level],seed:t.seed,kickoff:inp.kickoff,
  score:[pa,na],gf:na,ga:pa,res:na>pa?'W':na===pa?'D':'L',shots:[c.stats[0].shots,c.stats[1].shots],chances:matchChances(events,c.header,r.engineBuild),
  possession:[c.stats[0].possession,c.stats[1].possession],subsAt:{pensia:subs(0),new:subs(1)},dropped:r.dropped,engineBuild:r.engineBuild.slice(0,8),ms:Date.now()-t0};
}
