// Direct edge, squad dependence (2026-10-23): the task list. DESIGN.md says why each block exists and what it reads.
// Every match: the squad-fit study's average squad on both sides (real league group means, 1-2-1: GK, CB, W, W, ST,
// starters only), Balanced's base on both sides unless a cell says otherwise, 900 s, seed 5000 + n, kickoff n % 2,
// the tested side home and away. A seed is the 2 matches (home, away) of every cell.
//   S  In behind v Mixed (tested striker) x our ST's pace (slow / avg / fast) x their CB's pace (slow / avg / fast)
//   B  Bodies forward 3 v 4 (tested) x our CB's pace (slow / avg / fast) x their style (Balanced / Counter)
//   L  In behind v Mixed x their line / keeper / press: Deep, High, keeper Sweeper, Deep + Sweeper, Press Aggressive
//      (their Standard / default keeper / Balanced press is S's avg-avg cell)
// A cell shared by two blocks is the same task (same id), listed once (S first, then B, then L).
// Pace moves keep each player's skill total (squads.ts budget): a fast ST is pace +2, defending -1, set pieces -1
// (5.4 -> 7.4, 2.8 -> 1.8, 6.4 -> 5.4); a slow ST the reverse (3.4, 3.8, 7.4). A fast CB is pace +2, finishing -1,
// set pieces -1 (5.0 -> 7.0, 4.0 -> 3.0, 4.7 -> 3.7); a slow CB the reverse (3.0, 5.0, 5.7). All inside the real
// league's outfield ranges and the study's 3-point guard.
//   --seeds N       seeds per cell (default 40)    --seed-from M   first seed (default 0): seeds M .. M+N-1
//   --cells <regex> keep only cells whose key matches (the confirmation round)
export const ST_PACE={slow:{pace:-2,defending:1,setPieces:1},avg:null,fast:{pace:2,defending:-1,setPieces:-1}};
export const CB_PACE={slow:{pace:-2,finishing:1,setPieces:1},avg:null,fast:{pace:2,finishing:-1,setPieces:-1}};
const PACES=['slow','avg','fast'];
for(const m of [...Object.values(ST_PACE),...Object.values(CB_PACE)])if(m&&Object.values(m).reduce((a,b)=>a+b,0)!==0)throw Error('a pace move does not sum to 0');

/** A side: {st, stp, cb, commit} for the tested side, {style, cb, line, keeper, press} for the opponent. */
function testedSpec(code,c){
 const mods={};if(ST_PACE[c.stp??'avg'])mods[4]=ST_PACE[c.stp];if(CB_PACE[c.cb??'avg'])mods[1]=CB_PACE[c.cb];
 const approach={};if(c.st)approach.striker=c.st;if(c.commit)approach.commit=c.commit;
 return {src:'squad',code,squad:'avg',mods,preset:'balanced',approach};
}
function oppSpec(code,o){
 const mods={};if(CB_PACE[o.cb??'avg'])mods[1]=CB_PACE[o.cb];
 const approach={};if(o.line)approach.line=o.line;if(o.press)approach.press=o.press;
 return {src:'squad',code,squad:'avg',mods,preset:o.style??'balanced',approach,...(o.keeper?{settings:{keeper:o.keeper}}:{})};
}
/** The cell key: tested ~ opponent, every field spelled out so equal cells get equal keys ('preset': the preset's own value, 'trait': the keeper's own habit, no call). */
export function cellKey(c,o){
 return `T[st=${c.st??'mixed'},stp=${c.stp??'avg'},cb=${c.cb??'avg'},commit=${c.commit??3}]~O[style=${o.style??'balanced'},cb=${o.cb??'avg'},line=${o.line??'preset'},keeper=${o.keeper??'trait'},press=${o.press??'preset'}]`;
}
export function cells(){
 const out=[],seen=new Set();
 const add=(block,c,o)=>{const key=cellKey(c,o);if(seen.has(key))return;seen.add(key);out.push({block,key,c,o});};
 for(const st of ['mixed','run'])for(const stp of PACES)for(const cb of PACES)add('S',{st,stp},{cb});
 for(const commit of [3,4])for(const cb of PACES)for(const style of ['balanced','counter'])add('B',{commit,cb},{style});
 for(const st of ['mixed','run'])for(const o of [{line:'deep'},{line:'high'},{keeper:'sweeper'},{line:'deep',keeper:'sweeper'},{press:'aggressive'}])add('L',{st},o);
 return out;
}
function arg(name,d,argv=process.argv){const i=argv.indexOf(`--${name}`);return i>=0?argv[i+1]:d;}
export function tasks(argv=process.argv){
 const n=Number(arg('seeds','40',argv)),from=Number(arg('seed-from','0',argv)),re=arg('cells',null,argv);
 if(!(Number.isInteger(n)&&n>=1&&Number.isInteger(from)&&from>=0))throw Error('--seeds / --seed-from want whole numbers');
 const keep=re?new RegExp(re):null,out=[];
 for(let seed=from;seed<from+n;seed++)for(const cell of cells()){
  if(keep&&!keep.test(cell.key))continue;
  for(const home of [true,false]){
   const t=testedSpec(home?'H':'A',cell.c),o=oppSpec(home?'A':'H',cell.o);
   out.push({id:`DE:${cell.key}:${home?'home':'away'}:${seed}`,block:cell.block,kind:'match',seed:5000+seed,kickoff:seed%2,
    tested:home?0:1,cell:cell.key,sides:home?[t,o]:[o,t]});
  }
 }
 return out;
}

if(process.argv[1]?.endsWith('2026-10-23-direct-edge/set.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 console.log(`${cells().length} cells, ${t.length} tasks (${new Set(t.map(x=>x.id)).size} distinct ids):`,JSON.stringify(by));
 if(process.argv.includes('--list'))for(const c of cells())console.log(c.block,c.key);
}
