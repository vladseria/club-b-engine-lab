// Engine as data, S0: the 512 parity tasks, in one stable order (sharding takes task i to shard i % SHARD_TOTAL).
// Plan section 4.3, as built (README.md says where it differs from the plan and why):
//   A 128  the engine-speed set unchanged: 8 frozen pairings x keeper Line / Sweeper x seeds 0-7 (speed.ts inputs)
//   B 128  the four presets: 16 ordered pairings x 1-2-1 / 2-2 x seeds 0-3, the neutral five on both sides
//   C 128  every option, both sides: 32 single moves from Balanced (retired values and missing fields included) x home /
//          away x 2 real pairings (Global round 7 sides with Balanced, no plans / orders / settings)
//   D  64  real Global clubs (round 7 sides as frozen: plans, orders, captain, free-kick call, keeper call): 32
//          pairings over both formations x seeds 0 / 1; seed 1 adds a ready-made move (home) and the corner routine (away)
//   E  28  old inputs: frozen sides as stored before onLoss, optional keys removed, retired values, inert Team.orders
//   T   4  the four laptop traces (plan 4.2), also played on the lab
//   F  32  training and scenes: rehearsals (5 moves x 2 rounds, 2 goes with and without), restart setups, the corner
//          routine, Lab trials
export const MOVE_KEYS=['starter-in-behind','starter-lay-off','starter-drive-slip','starter-recycle','one-two'];
const STYLES=['balanced','combinations','direct','counter'];
const SPEED_PAIRS='MAL-FDD,TRS-FDD,FDD-INT,MEN-INT,MCB-MEN,MAL-MCB,INT-MAL,MEN-TRS'.split(',');

/** C: one setting moved from Balanced. Each entry edits the side spec and/or the engine tactics. */
export const OPTIONS=[
 ['progression=patient',{approach:{progression:'patient'}}],['progression=direct',{approach:{progression:'direct'}}],
 ['width=narrow',{approach:{width:'narrow'}}],['width=wide',{approach:{width:'wide'}}],
 ['line=deep',{approach:{line:'deep'}}],['line=high',{approach:{line:'high'}}],
 ['press=selective',{approach:{press:'selective'}}],['press=aggressive',{approach:{press:'aggressive'}}],
 ['commit=1',{approach:{commit:1}}],['commit=2',{approach:{commit:2}}],['commit=4',{approach:{commit:4}}],['commit=5',{approach:{commit:5}}],
 ['striker=link',{approach:{striker:'link'}}],['striker=pivot',{approach:{striker:'pivot'}}],['striker=run',{approach:{striker:'run'}}],['striker=(missing)',{drop:['striker']}],
 ['transition=secure',{approach:{transition:'secure'}}],['transition=counter',{approach:{transition:'counter'}}],['transition=(missing)',{drop:['transition']}],
 ['onLoss=regroup',{approach:{onLoss:'regroup'}}],['onLoss=counterpress',{approach:{onLoss:'counterpress'}}],['onLoss=(missing)',{drop:['onLoss']}],
 ['formation=2-1-1',{formation:'2-1-1'}],['formation=swap',{formation:'swap'}],
 ['setPiece=short+taker',{settings:{setPiece:'short'},taker:true}],['setPiece=delivery+taker',{settings:{setPiece:'delivery'},taker:true}],
 ['keeper=line',{settings:{keeper:'line'}}],['keeper=sweeper',{settings:{keeper:'sweeper'}}],
 ['marking=zonal',{team:{marking:'zonal'}}],['marking=tight',{team:{marking:'tight'}}],
 ['fullbacks=hold',{team:{fullbacks:'hold'}}],['fullbacks=overlap',{team:{fullbacks:'overlap'}}],
];
const C_PAIRS=[['FDD','RAP'],['UMA','TRS']];// [tested club, opponent]; FDD is 2-2, UMA 1-2-1
const FORM={FDD:'2-2',RAP:'1-2-1',UMA:'1-2-1',TRS:'2-2'};

const HUMAN=['FCD','FDD','MEN','RCS','TRS'],AI=['NEO','RAP','UMA','INT'];
export function dPairs(){
 const out=[];
 for(const h of HUMAN)for(const a of AI)out.push([h,a]);
 out.push(['FCD','FDD'],['MEN','RCS'],['TRS','FCD'],['RCS','FDD'],['MEN','TRS'],['FDD','MEN']);
 out.push(['RAP','INT'],['UMA','NEO'],['NEO','RAP'],['INT','UMA'],['INT','NEO'],['RAP','UMA']);
 return out.map((p,i)=>i%2?[p[1],p[0]]:p);
}

/** The four laptop traces (plan 4.2). */
export const TRACES=[
 {id:'T1:short-v-direct',block:'T',kind:'match',seed:7,kickoff:1,note:'Short v Direct in 1-2-1, a plan each, keeper on Sweeper',
  sides:[{src:'g7',code:'RAP',preset:'combinations',formation:'1-2-1',settings:{keeper:'sweeper'},plans:[{move:'starter-lay-off',accent:80}]},{src:'g7',code:'UMA',preset:'direct',formation:'1-2-1',settings:{keeper:'sweeper'},plans:[{move:'one-two',accent:80}]}]},
 {id:'T2:counter-v-balanced',block:'T',kind:'match',seed:8,kickoff:0,note:'Counter v Balanced in 2-2 with substitution orders and a free-kick call',
  sides:[{src:'g7',code:'FCD',preset:'counter',formation:'2-2',settings:{setPiece:'delivery'},taker:true},{src:'g7',code:'FDD',preset:'balanced',formation:'2-2'}]},
 {id:'T3:frozen-2-1-1-counter',block:'T',kind:'match',seed:0,kickoff:0,note:'a frozen pair: Malpraxis 2-1-1, Bodies forward 4, Counter transition (no onLoss key) v Directia',
  sides:[{src:'scen',code:'MAL'},{src:'scen',code:'FDD'}]},
 {id:'T4:old-regroup',block:'T',kind:'match',seed:3,kickoff:1,note:'an old input: optional fields missing (striker, transition) and onLoss regroup v a side with no onLoss key',
  sides:[{src:'scen',code:'MCB',drop:['striker','transition'],approach:{onLoss:'regroup'}},{src:'g7',code:'RAP'}]},
];

export function tasks(){
 const all=[];
 // A: speed.ts arms <H>-<A>-<k>, seeds 0-7, kickoff seed % 2 (the engine-speed order: seed-major, keeper L then S)
 for(const k of ['L','S'])for(let seed=0;seed<8;seed++)for(const p of SPEED_PAIRS){const [h,a]=p.split('-');
  all.push({id:`A:${p}-${k}:${seed}`,block:'A',kind:'match',seed,kickoff:seed%2,sides:[{src:'scen',code:h,keeper:k},{src:'scen',code:a,keeper:k}]});}
 // B: presets on the neutral five
 for(const formation of ['1-2-1','2-2'])for(let seed=0;seed<4;seed++)for(const h of STYLES)for(const a of STYLES)
  all.push({id:`B:${h}-${a}-${formation}:${seed}`,block:'B',kind:'match',seed:100+seed,kickoff:seed%2,sides:[{src:'neutral',code:'H',style:h,formation},{src:'neutral',code:'A',style:a,formation}]});
 // C: one option at a time, tested side home then away
 C_PAIRS.forEach(([club,opp],pi)=>{for(const [name,o] of OPTIONS)for(const home of [true,false]){
  const tested={src:'g7',code:club,preset:'balanced',settings:null,subs:'none',plans:[],...(o.approach?{approach:o.approach}:{}),...(o.drop?{drop:o.drop}:{}),...(o.settings?{settings:o.settings}:{}),...(o.taker?{taker:true}:{}),
   ...(o.formation?{formation:o.formation==='swap'?(FORM[club]==='2-2'?'1-2-1':'2-2'):o.formation}:{})};
  const other={src:'g7',code:opp,preset:'balanced',settings:null,subs:'none',plans:[]};
  const sides=home?[tested,other]:[other,tested],teamEdit=o.team?(home?[o.team,null]:[null,o.team]):undefined;
  all.push({id:`C:${name}:${home?'home':'away'}:${club}-${opp}`,block:'C',kind:'match',seed:200+pi,kickoff:pi%2,option:name,tested:home?0:1,sides,...(teamEdit?{teamEdit}:{})});
 }});
 // D: real Global sides as frozen; seed 1 also with a move (home) and the corner routine (away)
 dPairs().forEach(([h,a],i)=>{for(const s of [0,1]){
  const sides=[{src:'g7',code:h},{src:'g7',code:a}];
  if(s===1){sides[0].plans=[{move:MOVE_KEYS[i%5],accent:80}];sides[1].plans=[{routine:'corner'}];}
  all.push({id:`D:${h}-${a}:${s}`,block:'D',kind:'match',seed:300+i*2+s,kickoff:(i+s)%2,sides});
 }});
 // E: old inputs, 7 variants x 4 seeds
 const E=[
  ['as-stored-2-1-1',[{src:'scen',code:'MAL'},{src:'scen',code:'MCB'}]],
  ['optional-keys-removed',[{src:'g7',code:'MEN',drop:['striker','transition','onLoss']},{src:'g7',code:'NEO',drop:['striker','transition']}]],
  ['retired-values',[{src:'g7',code:'TRS',formation:'2-1-1',approach:{commit:2,onLoss:'regroup'}},{src:'g7',code:'RAP',approach:{commit:1,onLoss:'regroup'}}]],
  ['marking-fullbacks-keys-removed',[{src:'scen',code:'INT'},{src:'scen',code:'TRS'}],{teamEdit:[{marking:null,fullbacks:null},{marking:null,fullbacks:null}]}],
  ['team-tactics-order',[{src:'scen',code:'MEN'},{src:'scen',code:'FDD'}],{teamOrders:true}],
  ['drops-deep-narrow',[{src:'g7',code:'UMA'},{src:'g7',code:'RAP',approach:{width:'narrow'}}]],
  ['stale-taker',[{src:'g7',code:'FDD',settings:{setPiece:'short',taker:'not-in-lineup'}},{src:'scen',code:'MCB'}]],
 ];
 E.forEach(([name,sides,extra],vi)=>{for(let seed=0;seed<4;seed++)all.push({id:`E:${name}:${seed}`,block:'E',kind:'match',seed:400+vi*4+seed,kickoff:seed%2,sides,...(extra??{})});});
 // T: the laptop traces
 all.push(...TRACES);
 // F: training and scenes (opposition on side 1 through withDefensiveApproach)
 const scenesIds=['middle','left','right','back'];
 MOVE_KEYS.forEach((move,mi)=>{for(const round of [0,1])
  all.push({id:`F:scenes:${move}:${round}`,block:'F',kind:'scenes',move,round,duration:60,opposition:'original',scenes:[scenesIds[(mi+round)%4],scenesIds[(mi+round+1)%4]],sides:[{src:'g7',code:round?'RAP':'FDD'},{src:'g7',code:round?'INT':'NEO'}]});});
 const R=[['corner',{side:'left'}],['corner',{side:'right'}],['throw',{side:'left',zone:'attacking'}],['throw',{side:'right',zone:'middle'}],['freeKick',{zone:'attacking'}],['freeKick',{zone:'middle'}],['goalKick',{}],['goalKick',{}]];
 R.forEach(([restart,opts],i)=>all.push({id:`F:restart:${restart}:${i}`,block:'F',kind:'training',seed:500+i,duration:60,opposition:i===7?'press':'original',restart,restartOpts:opts,sides:[{src:'g7',code:i%2?'UMA':'TRS'},{src:'g7',code:i%2?'MEN':'INT'}]}));
 for(let i=0;i<6;i++)all.push({id:`F:routine:corner:${i}`,block:'F',kind:'training',seed:600+i,duration:60,opposition:['original','compact','tight'][i%3],routine:'corner',sides:[{src:'g7',code:i<3?'FDD':'RAP'},{src:'g7',code:i<3?'INT':'NEO'}]});
 for(let i=0;i<8;i++)all.push({id:`F:trial:${scenesIds[i%4]}:${i}`,block:'F',kind:'trial',seed:700+i,duration:60,opposition:i<4?'press':'tight',scene:scenesIds[i%4],move:MOVE_KEYS[i%5],sides:[{src:'g7',code:i%2?'MEN':'UMA'},{src:'g7',code:i%2?'RAP':'FCD'}]});
 return all;
}

if(process.argv[1]?.endsWith('set.mjs')){
 const t=tasks(),by={};for(const x of t)by[x.block]=(by[x.block]??0)+1;
 const ids=new Set(t.map(x=>x.id));
 console.log(`${t.length} tasks (${ids.size} distinct ids):`,JSON.stringify(by));
 if(process.argv.includes('--list'))for(const x of t)console.log(x.id);
}
