// A practice setup's runs in this browser tab (owner, 4 Oct: "Play it again"
// means the same setup with a new kick-off, to see whether the first result was
// a pattern or a one-off). Client state only: nothing is stored, nothing counts,
// and any change to the setup (plan, opponent, length, the five, their side)
// starts a fresh tally. Pure: no I/O, no React.
import type {FrozenInput} from './compute';

export interface TallyScore {gf:number;ga:number}
/** One version played per run (the plan, and the "also play it as" one when there is one). */
export interface TallyRow {name:string;runs:TallyScore[]}
export interface Tally {key:string;rows:TallyRow[]}

export type Outcome='W'|'D'|'L';
export const outcomeOf=(r:TallyScore):Outcome=>r.gf>r.ga?'W':r.gf<r.ga?'L':'D';
export const OUTCOME_WORD:Readonly<Record<Outcome,string>>={W:'won',D:'drew',L:'lost'};

/** What a run was played from, without its kick-off: the frozen inputs with seed and match id left out
 * (`extra` for anything the inputs don't carry, such as a comparison run). Hashed, so the state stays small. */
export function setupKey(inputs:readonly FrozenInput[],extra=''):string{
 const text=JSON.stringify([extra,inputs.map(({seed:_seed,match:_match,...rest})=>rest)]);
 // cyrb53: a 53-bit string hash, plenty to tell two setups apart in one tab
 let h1=0xdeadbeef,h2=0x41c6ce57;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
 h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
 return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}

/** The tally after one more run: added to the same setup's, or a fresh one for a new setup. */
export function addRun(prev:Tally|null,key:string,played:readonly {name:string;score:TallyScore}[]):Tally{
 if(!prev||prev.key!==key||prev.rows.length!==played.length)return {key,rows:played.map(p=>({name:p.name,runs:[p.score]}))};
 return {key,rows:prev.rows.map((row,i)=>({name:played[i].name,runs:[...row.runs,played[i].score]}))};
}

export interface Totals {n:number;w:number;d:number;l:number;gf:number;ga:number}
export function totals(runs:readonly TallyScore[]):Totals{
 const t:Totals={n:runs.length,w:0,d:0,l:0,gf:0,ga:0};
 for(const r of runs){const o=outcomeOf(r);if(o==='W')t.w++;else if(o==='D')t.d++;else t.l++;t.gf+=r.gf;t.ga+=r.ga;}
 return t;
}
/** "W 1 · D 1 · L 1, goals 11–9". */
export const totalsText=(t:Totals)=>`W ${t.w} · D ${t.d} · L ${t.l}, goals ${t.gf}–${t.ga}`;
