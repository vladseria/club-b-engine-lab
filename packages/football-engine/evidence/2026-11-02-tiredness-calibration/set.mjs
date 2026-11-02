// Tiredness calibration (2026-11-02, branch ballers-tiredness-calibration, measurement only): the task list. QUESTION.md
// is the design and the readings. Played through ../2026-10-21-engine-as-data/run.mjs with --entry
// ../2026-11-02-tiredness-calibration/row.ts --set ../2026-11-02-tiredness-calibration/set.mjs, so every match goes
// through parity.ts play (computeMatch's runMatch call, the fingerprints) and row.ts only adds sides and the opt-in
// `injuries` key (parity.ts setCall).
//
// League blocks: Global's round-7 sides (../2026-10-21-engine-as-data/global-r7, real squads, no member identity), all
// 72 ordered pairings of the nine clubs; injuries on (scale, strength 0.15, the ages known from the 29 Oct snapshot);
// the AI clubs (NEO RAP UMA INT) carry the planned AI orders (the twin of private.ballers_showcase_subs: the first two
// bench outfielders for the two starters with the least stamina, "tired" 95 not before 7:30; the third if losing, not
// before 12:00); the human clubs their own frozen orders.
//   L   72 x seeds 0-3, scale S1 (288)              the main league read (rate, causes, length, strength, energy spend)
//   La  72 x seed 0, scale S1 / 2 (72)              a second scale (the same football as L seed 0 until the first injury)
//   Lb  72 x seed 0, scale 2 x S1 (72)              a third scale
//   H   72 x seeds 0-1, one side's whole squad made Short fuses (frustration 1, discipline - 0.25 for every man not
//       already one): seed 0 the home side, seed 1 the away side (144); its control is L at the same pairing and seed
//   E   72 x seed 0, no orders on either side, no injuries (72): every starter plays the whole match (the energy spend)
//   W   (run 2, after L) one human side's starters at their start after two weeks away (4 untouched matches), the bench
//       at 100, orders on; control L at the same pairing and seed (W_SEEDS seeds; added for run 2)
// Neutral blocks (the what-if block R design, ../2026-10-22-whatif/set.mjs, seeds 0-4, no injuries):
//   N   ONE outfielder of one side starts at E (80, 87), everyone else at 100; the dented side d = (n + i) % 2 and the
//       man (squad slot 1-4) cycled per dented set-up and slot (tiredMan) for set-up i (0-63) and seed n (640); control: the stored block R
//       rows of lab run 41362402602 (same build 57f11aee, same platform; branch ballers-energy-start)
//   NI  the N path at E = 100, seed 0, even set-ups (32): fingerprints must equal the stored R rows
// Showcase blocks (Bebe's showcase as played since 1 Nov: the strength study's real freezer nines and the two-tier guest
// sides of nines-v2.json, the half-time orders rewrite, computeMatch's input; ../2026-11-01-showcase-subs, orders 'new'):
//   S   the subs study's 140 (nine, guest, seed) at scale SB, strength 0.15 (140)
//   SI  28 of them (every nine x 2 guests) with today's key (no scale, no strength), played on main AND this branch
//       (--revs base=<main>,cand=working): every fingerprint must be equal (56 plays)
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {rTasks,SETUPS} from '../2026-10-22-whatif/set.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
/** The run's constants. S1 and SB are the first guesses from the laptop traces (QUESTION.md (c)). */
export const S1=0.45,SB=0.65,STRENGTH=0.15;
export const HUMAN=['FCD','FDD','MEN','RCS','TRS'],AI=['NEO','RAP','UMA','INT'],CLUBS=[...HUMAN,...AI];
export const PAIRS=CLUBS.flatMap(h=>CLUBS.filter(a=>a!==h).map(a=>[h,a]));
export const N_LEVELS=[80,87],N_SEEDS=5;
const salt=seed=>Math.imul(seed,2654435761)>>>0;
const g7side=(code,extra={})=>({src:'g7x',code,...(AI.includes(code)?{ai:true}:{}),...extra});
function league(block,pi,n,{scale,injuries=true,orders=true,edit=null}={}){
 const [h,a]=PAIRS[pi],seed=31000+pi*8+n;
 const sides=[g7side(h,orders?{}:{noOrders:true}),g7side(a,orders?{}:{noOrders:true})];
 if(edit)Object.assign(sides[edit.side],edit.spec);
 return {block,kind:'match',seed,kickoff:(pi+n)%2,pair:`${h}-${a}`,n,sides,
  ...(injuries?{injuries:{on:true,salt:salt(seed),scale,strength:STRENGTH,ages:true}}:{})};
}
export function lTasks(){
 const out=[];
 for(let n=0;n<4;n++)PAIRS.forEach(([h,a],pi)=>out.push({...league('L',pi,n,{scale:S1}),id:`L:${h}-${a}:${n}`}));
 PAIRS.forEach(([h,a],pi)=>out.push({...league('La',pi,0,{scale:S1/2}),id:`La:${h}-${a}:0`,control:`L:${h}-${a}:0`}));
 PAIRS.forEach(([h,a],pi)=>out.push({...league('Lb',pi,0,{scale:S1*2}),id:`Lb:${h}-${a}:0`,control:`L:${h}-${a}:0`}));
 for(let n=0;n<2;n++)PAIRS.forEach(([h,a],pi)=>out.push({...league('H',pi,n,{scale:S1,edit:{side:n,spec:{fuse:true}}}),id:`H:${h}-${a}:${n}:t${n}`,treated:n,control:`L:${h}-${a}:${n}`}));
 PAIRS.forEach(([h,a],pi)=>out.push({...league('EN',pi,0,{injuries:false,orders:false}),id:`EN:${h}-${a}:0`}));
 return out;
}
// ------------------------------------------------------------------ W (run 2): two weeks away
/** The start levels for block W (run 2): squad id -> energy for each human club's starters, from w-levels.json (written
 * by levels.mjs from run 1's measured spend by stamina). Absent before run 2: block W lists no task. */
export const W_SEEDS=4;
function wLevels(){try{return JSON.parse(readFileSync(path.join(here,'w-levels.json'),'utf8'));}catch{return null;}}
export function wTasks(){
 const L=wLevels();if(!L)return [];
 const out=[];
 for(let n=0;n<W_SEEDS;n++)PAIRS.forEach(([h,a],pi)=>{
  const hum=[h,a].map(c=>HUMAN.includes(c));if(!hum[0]&&!hum[1])return;
  const d=hum[0]&&hum[1]?n%2:hum[0]?0:1,code=d?a:h;
  out.push({...league('W',pi,n,{scale:S1,edit:{side:d,spec:{energies:L.clubs[code]}}}),id:`W:${h}-${a}:${n}:d${d}`,dented:d,control:`L:${h}-${a}:${n}`});
 });
 return out;
}
// ------------------------------------------------------------------ N / NI: one tired man, the neutral fives
const setupIndex=new Map(SETUPS.flatMap((h,hi)=>SETUPS.map((a,ai)=>[`${h}-${a}`,hi*SETUPS.length+ai])));
export const dentedSlot=(pair,n)=>(n+setupIndex.get(pair))%2;
/** The tired man (squad slot 1-4): cycled per (dented set-up, dented slot) in block R's task order, so every set-up's
 * dented side has each man about equally often, home and away; the same man at every level. */
let MEN=null;
export function tiredMan(pair,n){
 if(!MEN){MEN=new Map();const c=new Map();
  for(const t of controlTasks()){const [,p,k]=t.id.split(':'),d=dentedSlot(p,Number(k)),key=`${t.sides[d].style}.${t.sides[d].formation}|${d}`,i=c.get(key)??0;c.set(key,i+1);MEN.set(`${p}:${k}`,1+i%4);}}
 return MEN.get(`${pair}:${n}`);
}
function controlTasks(){
 const out=rTasks().filter(t=>t.seed<1000+N_SEEDS).map(t=>({...t,sides:t.sides.map(s=>({...s}))}));
 if(out.length!==SETUPS.length**2*N_SEEDS)throw Error(`control: ${out.length} tasks (is --r-seeds below ${N_SEEDS}?)`);
 return out;
}
function oneTired(t,E,block,id){
 const [,pair,n]=t.id.split(':'),d=dentedSlot(pair,Number(n)),man=tiredMan(pair,Number(n));
 const sides=t.sides.map((s,i)=>i===d?{...s,src:'onetired',energy:E,man}:{...s});
 return {...t,id:id(pair,n,d,man),block,sides,dented:d,man,level:E,control:t.id};
}
export function nTasks(){
 const ctrl=controlTasks();
 return [...N_LEVELS.flatMap(E=>ctrl.map(t=>oneTired(t,E,'N',(pair,n,d,m)=>`N:${E}:${pair}:${n}:d${d}:m${m}`))),
  ...ctrl.filter(t=>t.seed===1000&&setupIndex.get(t.id.split(':')[1])%2===0).map(t=>oneTired(t,100,'NI',(pair,n,d,m)=>`NI:${pair}:${n}:d${d}:m${m}`))];
}
// ------------------------------------------------------------------ S / SI: Bebe's showcase
const SUBS_NINES=['excel','rutina','talent','burcea','ghidus','lansator','present'].flatMap(c=>[`${c}-a`,`${c}-b`]);
const SUBS_GUESTS=['greucenii','real-offshore','inter-est','autospa-vampires','lemne-verzi','cirque-du-sorin','pirates'];
const showcase=(block,nine,guest,seed,key)=>({block,kind:'match',seed,kickoff:seed%2,nine,guest,
 sides:[{src:'nine',nine},{src:'guest',guest}],injuries:{on:true,salt:Number((BigInt(seed)*2654435761n)%4294967296n),showcase:true,...key}});
export function sTasks(){
 const out=[];
 // the subs study's 140: every nine x every guest at 13001, the three sides away from the middle again at 13002
 for(const guest of SUBS_GUESTS)for(const nine of SUBS_NINES)out.push({...showcase('S',nine,guest,13001,{scale:SB,strength:STRENGTH}),id:`S:${nine}:${guest}:13001`,subs:`P:new:${nine}:${guest}:13001`});
 for(const guest of ['greucenii','autospa-vampires','inter-est'])for(const nine of SUBS_NINES)out.push({...showcase('S',nine,guest,13002,{scale:SB,strength:STRENGTH}),id:`S:${nine}:${guest}:13002`,subs:`P:new:${nine}:${guest}:13002`});
 // SI: today's key (no scale, no strength), every nine against two guests (a rotation over the seven), seed 13001
 SUBS_NINES.forEach((nine,i)=>{for(const k of [0,1]){const guest=SUBS_GUESTS[(i+3*k)%SUBS_GUESTS.length];
  out.push({...showcase('SI',nine,guest,13001,{}),id:`SI:${nine}:${guest}:13001`,subs:`P:new:${nine}:${guest}:13001`});}});
 return out;
}
export function tasks(){return [...lTasks(),...wTasks(),...nTasks(),...sTasks()];}

if(process.argv[1]?.endsWith('2026-11-02-tiredness-calibration/set.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 console.log(`${t.length} tasks (${new Set(t.map(x=>x.id)).size} distinct ids):`,JSON.stringify(by));
 const n=t.filter(x=>x.block==='N'&&x.level===80),cell={};for(const x of n){const k=`d${x.dented}m${x.man}`;cell[k]=(cell[k]??0)+1;}
 console.log('N (each level): dented side x tired man',JSON.stringify(cell));
 const st={};for(const x of n){const k=`${x.sides[x.dented].style}.${x.sides[x.dented].formation}:m${x.man}`;st[k]=(st[k]??0)+1;}
 console.log('N (each level): dented set-up x man (min / max)',Math.min(...Object.values(st)),Math.max(...Object.values(st)));
}
