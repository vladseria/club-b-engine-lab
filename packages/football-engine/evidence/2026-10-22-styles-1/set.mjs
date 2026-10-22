// Styles as identities: extra task blocks for the research runs, on top of the what-if set (../2026-10-22-whatif/set.mjs).
// Played with run.mjs --set ../2026-10-22-styles-1/set.mjs --entry ../2026-10-22-whatif/row.ts on ONE revision: each
// question compares task variants played side by side (same seeds, same opponents), not two revisions.
//   AI  (open question 1): the two AI 'Short' sides (Global round 7, RAP and UMA: combinations label, mixed + secure)
//       as stored v moved onto Short's base (patient + secure, so the engine is told 'combinations': one-touch), against
//       every other round-7 side, home and away. --ai-seeds N (default 10).
//   X   (slice 3 a, Direct's edge): block R's set-ups with the tested side swapped: 'dB' = Direct's base on Balanced's
//       fine-tunes (standard width, 3 forward, Mixed striker), 'bD' = Balanced's base on Direct's fine-tunes (wide,
//       4 forward, In behind). Same ids, seeds and opponents as R, so each pairs with R's Direct / Balanced task.
//       --x-seeds N (default 20).
import {tasks as whatif,STYLES,FORMATIONS} from '../2026-10-22-whatif/set.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?+process.argv[i+1]:d;};
const G7=['FCD','FDD','INT','MEN','NEO','RAP','RCS','TRS','UMA'];
export function aiTasks(){
 const out=[],n=arg('ai-seeds',10);
 for(let seed=0;seed<n;seed++)for(const ai of ['RAP','UMA'])for(const opp of G7.filter(c=>c!==ai))for(const home of [true,false])for(const v of ['stored','short']){
  const tested={src:'g7',code:ai,...(v==='short'?{approach:{progression:'patient'}}:{})},them={src:'g7',code:opp};
  out.push({id:`AI:${ai}.${v}-v-${opp}_${home?'home':'away'}:${seed}`,block:'AI',kind:'match',seed:5000+seed,kickoff:seed%2,sides:home?[tested,them]:[them,tested]});
 }
 return out;
}
const SWAP={dB:{style:'direct',approach:{width:'standard',commit:3,striker:'mixed'}},bD:{style:'balanced',approach:{width:'wide',commit:4,striker:'run'}}};
export function xTasks(){
 const out=[],n=arg('x-seeds',20);
 for(let seed=0;seed<n;seed++)for(const v of Object.keys(SWAP))for(const hf of FORMATIONS)for(const a of STYLES)for(const af of FORMATIONS)for(const home of [true,false]){
  const tested={src:'neutral',code:home?'H':'A',style:SWAP[v].style,formation:hf,approach:SWAP[v].approach},opp={src:'neutral',code:home?'A':'H',style:a,formation:af};
  out.push({id:`X:${v}.${hf}-${a}.${af}_${home?'home':'away'}:${seed}`,block:'X',kind:'match',seed:1000+seed,kickoff:seed%2,sides:home?[tested,opp]:[opp,tested]});
 }
 return out;
}
//   Y   (slice 3 a/b, which of Direct's fine-tunes): Balanced's base with ONE of Direct's fine-tunes ('bW' Wide, 'b4'
//       4 forward, 'bR' In behind striker), block R's set-ups and seeds like X. --y-seeds N (default 20).
const ONE={bW:{width:'wide'},b4:{commit:4},bR:{striker:'run'}};
export function yTasks(){
 const out=[],n=arg('y-seeds',20);
 for(let seed=0;seed<n;seed++)for(const v of Object.keys(ONE))for(const hf of FORMATIONS)for(const a of STYLES)for(const af of FORMATIONS)for(const home of [true,false]){
  const tested={src:'neutral',code:home?'H':'A',style:'balanced',formation:hf,approach:ONE[v]},opp={src:'neutral',code:home?'A':'H',style:a,formation:af};
  out.push({id:`Y:${v}.${hf}-${a}.${af}_${home?'home':'away'}:${seed}`,block:'Y',kind:'match',seed:1000+seed,kickoff:seed%2,sides:home?[tested,opp]:[opp,tested]});
 }
 return out;
}
//   V   (one-touch v2 recon, 23 Oct): Short with the squad-fit study's passers (h3) and big-and-strong (h4) against the
//       average squad on Balanced, exactly block Q's set-up and seeds, as it is ('base') and with ONE fine-tune that
//       might keep a possession side from being caught without defending deeper: 'narrow' (Width Narrow: closer
//       together with the ball), 'link' (a Drops deep striker: one more man near the ball), 'aggr' (Press Aggressive).
//       --v-seeds N (default 40).
const TUNE={base:{},narrow:{width:'narrow'},link:{striker:'link'},aggr:{press:'aggressive'}};
export function vTasks(){
 const out=[],n=arg('v-seeds',40);
 for(let seed=0;seed<n;seed++)for(const v of Object.keys(TUNE))for(const squad of ['h3','h4'])for(const home of [true,false]){
  const tested={src:'squad',code:home?'H':'A',squad,preset:'combinations',...(Object.keys(TUNE[v]).length?{approach:TUNE[v]}:{})},opp={src:'squad',code:home?'A':'H',squad:'avg',preset:'balanced'};
  out.push({id:`V:${v}.${squad}_${home?'home':'away'}:${seed}`,block:'V',kind:'match',seed:3000+seed,kickoff:seed%2,sides:home?[tested,opp]:[opp,tested]});
 }
 return out;
}
export function tasks(){return [...whatif(),...aiTasks(),...xTasks(),...yTasks(),...vTasks()];}
