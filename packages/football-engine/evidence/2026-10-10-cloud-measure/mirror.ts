// Neutral mirror matches for comparing engine revisions (2026-10-10).
// The skill-expression audit's mirror (../2026-10-10-skill-expression/tape.ts,
// branch worktree-agent-a282203b49fab3ab5), played through the official path
// (lib/ballers/compute.ts computeMatch, which makes the same runMatch call the
// audit made: no plans, no subs) and summarised as one compact row in the
// scenario harness's shape (../2026-10-09-scenarios/match.ts), so it can run
// in the cloud for two revisions side by side. run.mjs bundles this file once
// per revision: lib/ and engine src/ are the revision's own (its presets too).
//
// Spec  <arm>:<seed>
//   base                       the mirror: both sides the same neutral five, Balanced, 2-1-1
//   di0 | sh0 | co0            treated side on the Direct | Short (combinations) | Counter preset;
//                              the other side on Balanced; same players
//   p-<skill> | m-<skill>      treated side: +3 | -3 on <skill> for every outfielder (keeping: the keeper)
//   di-<skill> | sh-<skill> | co-<skill>   the style arm plus +3 on <skill>
//   <a>v<b>, a,b in ba|di|sh|co  treated side on style a, the other side on style b
//                              (2026-10-11, for the style round robin; same players)
//   dx-<k>                     (2026-10-11, direct-edge ablation) treated side on Direct with ONE setting reset
//                              to Balanced's value; the other side Balanced. k: prog | wid | com | str
//                              (progression direct->mixed, width wide->standard, commit 4->3, striker run->mixed;
//                              ps = progression AND striker)
//   bx-<k>                     Balanced with ONE setting switched to Direct's value; the other side Balanced
//   ds-<skill>                 (2026-10-11, track-runner) treated side Balanced with +3 on <skill> for every outfielder,
//                              the other side Direct: does the skilled defence read Direct's runs better?
//   ks-<NN>                    (2026-10-11, hold-line) treated side Balanced with its keeper's keeperSweep NN/100 (the
//                              mirror's keepers are 0.5), the other side Direct: does the sweep trait become a must-have?
//   di0f121 | di0f22           Direct v Balanced with BOTH sides in 1-2-1 | 2-2 (the engine takes each slot's
//                              role from the formation, model.ts; the players are the same neutral five)
//   ad-<k>[_<k>...]           (2026-10-12, stop-direct) treated side Balanced 1-2-1 with the named changes, the other
//                              side Direct 1-2-1. k: ref (none) | nar (width narrow) | agg (press aggressive) |
//                              swp (keeper call Sweeper, match settings) | c2 (bodies forward 2) | deep (line deep) |
//                              reg (on losing it regroup). ad-ref builds exactly the inputs of ba121vdi121.
//   <a><f>v<b><g>              (2026-10-11, cloud formations) treated side on style a in formation f, the other
//                              side on style b in formation g; a,b in ba|di|sh|co, f,g in 211|121|22. Each
//                              style keeps its own preset; only the formation changes. <a>211v<b>211 builds
//                              exactly the inputs of <a>v<b> (and di211vba211 those of di0).
//   cx-<k>[_<k>...] | cd-<k>[_<k>...]   (2026-10-12, counter-preset) treated side Counter 1-2-1 with the named
//                              changes, the other side Balanced 1-2-1 (cx) | Direct 1-2-1 (cd). k: ref (none) |
//                              std (line standard) | bal (press balanced) | tb (transition balanced: no counter window).
//                              cx-ref builds exactly the inputs of co121vba121; cx-std_bal_tb those of ba121vba121.
//   s1-<k>-<o>                 (2026-10-13, settings audit) treated side Balanced 1-2-1 with ONE choice changed, the other
//                              side opponent o in ba121 | di121 | sh121 | co121 | ba211 (that style's preset in that formation).
//                              k: ref (none) | pat | dir (progression) | nar | wid (width) | deep | high (line) | sel | agg
//                              (press) | c1 | c2 | c4 | c5 (bodies forward) | link | piv | run (striker) | reg | cp (on losing
//                              it) | sec | cou (on winning it) | kln | ksw (keeper call Stay on line | Sweeper, match settings)
//                              | fks | fkd (free-kick call Short | Into the box, match settings) | f211 | f22 (formation).
//                              s1-ref-<o> builds exactly the inputs of ba121v<o>.
//   sp-<A>-<B>                 (2026-10-15, direct split; ported from branch ballers-direct-split) treated side team A, the
//                              other side team B, both 1-2-1 unless a team says otherwise. A team is a preset (ba|di|sh|co)
//                              plus optional .<k> changes: c3 | c4 (bodies forward 3 | 4) | srun | smix (striker In behind |
//                              mixed) | pmix (progression mixed) | wstd (width standard); added 2026-10-15 (default
//                              measurement, branch ballers-contest-live): ldeep (line deep) | psel (press selective) | pdir
//                              (progression direct) | f22 | f211 (that team's formation 2-2 | 2-1-1).
//                              Added 2026-10-16 (striker options): slink | spiv (striker Drops deep | Pivot).
//                              sp-<a>-<b> with no changes builds exactly the inputs of <a>121v<b>121.
// Treated side = seed % 2; kick-off = (seed >> 1) % 2, so every 4 seeds cover
// both sides x both kick-offs. Match id `skill-<seed>`, as the audit's, so a
// base-revision row on the same platform reproduces the audit's tape score.
import {computeMatch,type FrozenInput,type FrozenSide} from '../../../../lib/ballers/compute';
import {matchChances,shotChance,CHANCE_TABLE} from '../../../../lib/ballers/chances';
import {PRESETS} from '../../../../lib/ballers/league';

export const SKILLS=['pace','aerial','control','passing','reading','stamina','strength','defending','finishing','setPieces','keeping'] as const;
type Skill=typeof SKILLS[number];
type Style='balanced'|'combinations'|'direct'|'counter';
const OUT_SKILLS:Record<Skill,number>={pace:6,aerial:6,control:6,passing:6,reading:6,stamina:6,strength:6,defending:6,finishing:6,setPieces:6,keeping:1};
const GK_SKILLS:Record<Skill,number>={pace:5,aerial:6,control:5,passing:5,reading:6,stamina:6,strength:6,defending:3,finishing:2,setPieces:3,keeping:6};
const TRAITS={risk:.5,runs:.5,dribble:.5,comesShort:.5,engagement:.5,discipline:.8,frustration:1,audacity:.5};
const ROLES=[['GK'],['CB'],['CB'],['CM'],['ST']] as const;
const STYLE:Record<string,Style>={di:'direct',sh:'combinations',co:'counter'};
const FORM:Record<string,string>={'211':'2-1-1','121':'1-2-1','22':'2-2'};
const ABLATE:Record<string,string[]>={prog:['progression'],wid:['width'],com:['commit'],str:['striker'],ps:['progression','striker']};

const ANTI:Record<string,{set?:Record<string,string|number>;keeper?:'sweeper'|'line'}>={ref:{},nar:{set:{width:'narrow'}},agg:{set:{press:'aggressive'}},
 swp:{keeper:'sweeper'},c2:{set:{commit:2}},deep:{set:{line:'deep'}},reg:{set:{onLoss:'regroup'}}};
const CPRE:Record<string,Record<string,string|number>>={ref:{},std:{line:'standard'},bal:{press:'balanced'},tb:{transition:'balanced'}};
const ONE:Record<string,{set?:Record<string,string|number>;keeper?:'sweeper'|'line';fk?:'short'|'delivery';formation?:string}>={ref:{},
 pat:{set:{progression:'patient'}},dir:{set:{progression:'direct'}},nar:{set:{width:'narrow'}},wid:{set:{width:'wide'}},
 deep:{set:{line:'deep'}},high:{set:{line:'high'}},sel:{set:{press:'selective'}},agg:{set:{press:'aggressive'}},
 c1:{set:{commit:1}},c2:{set:{commit:2}},c4:{set:{commit:4}},c5:{set:{commit:5}},
 link:{set:{striker:'link'}},piv:{set:{striker:'pivot'}},run:{set:{striker:'run'}},reg:{set:{onLoss:'regroup'}},cp:{set:{onLoss:'counterpress'}},
 sec:{set:{transition:'secure'}},cou:{set:{transition:'counter'}},kln:{keeper:'line'},ksw:{keeper:'sweeper'},fks:{fk:'short'},fkd:{fk:'delivery'},
 f211:{formation:'2-1-1'},f22:{formation:'2-2'}};
function side(code:string,treat:{skill?:Skill;delta?:number;style?:Style;from?:Style;key?:string[];formation?:string;sweep?:number;set?:Record<string,string|number>;keeper?:'sweeper'|'line';fk?:'short'|'delivery'}):FrozenSide{
 const players=ROLES.map((roles,i)=>{
  const gk=i===0,skills={...(gk?GK_SKILLS:OUT_SKILLS)};
  if(treat.skill&&(treat.skill==='keeping'?gk:!gk))skills[treat.skill]=Math.max(0,Math.min(10,skills[treat.skill]+treat.delta!));
  return {id:`${code}${i+1}`,name:`${code} ${i+1}`,short:`${code}${i+1}`,number:i+1,roles:[...roles],skills,traits:gk?{...TRAITS,keeperSweep:treat.sweep??.5}:{...TRAITS},energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'};
 });
 const style=treat.style??'balanced',approach=(PRESETS as any)[style];
 if(!approach)throw Error(`this revision has no ${style} preset`);
 const tuned:any={...approach};for(const k of treat.key??[])tuned[k]=(PRESETS as any)[treat.from!][k];
 for(const [k,v] of Object.entries(treat.set??{})){if(!(k in tuned))throw Error('unknown setting '+k);tuned[k]=v;}
 return {club:{id:code,name:code,code,color:code==='AAA'?'#3fd38a':'#d33f6a'},formation:(treat.formation??'2-1-1') as any,style,approach:tuned,captain:`${code}2`,lineup:players.map(p=>p.id),bench:[],players,plans:[],...(treat.keeper||treat.fk?{settings:{...(treat.keeper?{keeper:treat.keeper}:{}),...(treat.fk?{setPiece:treat.fk}:{})}}:{})} as any;
}

const SPLIT:Record<string,Record<string,string|number>>={c3:{commit:3},c4:{commit:4},srun:{striker:'run'},smix:{striker:'mixed'},slink:{striker:'link'},spiv:{striker:'pivot'},pmix:{progression:'mixed'},wstd:{width:'standard'},
 ldeep:{line:'deep'},psel:{press:'selective'},pdir:{progression:'direct'}};
const SPLIT_FORM:Record<string,string>={f22:'2-2',f211:'2-1-1'};
function splitTeam(code:string):{style:Style;set?:Record<string,string|number>;formation:string}{
 const [k,...mods]=code.split('.'),style=k==='ba'?'balanced' as Style:STYLE[k];if(!style)throw Error('unknown team '+code);
 const set:Record<string,string|number>={};let formation='1-2-1';
 for(const m of mods){if(SPLIT_FORM[m]){formation=SPLIT_FORM[m];continue;}const a=SPLIT[m];if(!a)throw Error('unknown change '+m);Object.assign(set,a);}
 return {style,formation,...(Object.keys(set).length?{set}:{})};
}
export function armTreatment(arm:string):{skill?:Skill;delta?:number;style?:Style;vs?:Style;from?:Style;key?:string[];formation?:string;vsFormation?:string;vsSet?:Record<string,string|number>;sweep?:number;set?:Record<string,string|number>;keeper?:'sweeper'|'line';fk?:'short'|'delivery'}{
 if(arm==='base')return {};
 const sp=/^sp-((?:ba|di|sh|co)(?:\.[a-z0-9]+)*)-((?:ba|di|sh|co)(?:\.[a-z0-9]+)*)$/.exec(arm);
 if(sp){const a=splitTeam(sp[1]),b=splitTeam(sp[2]);return {style:a.style,formation:a.formation,...(a.set?{set:a.set}:{}),vs:b.style,vsFormation:b.formation,...(b.set?{vsSet:b.set}:{})};}
 const s1=/^s1-([a-z0-9]+)-(ba|di|sh|co)(211|121|22)$/.exec(arm);
 if(s1){const o=ONE[s1[1]];if(!o)throw Error('unknown arm '+arm);const st=(k:string)=>k==='ba'?'balanced' as Style:STYLE[k];
  return {style:'balanced',formation:o.formation??'1-2-1',vs:st(s1[2]),vsFormation:FORM[s1[3]],...(o.set?{set:{...o.set}}:{}),...(o.keeper?{keeper:o.keeper}:{}),...(o.fk?{fk:o.fk}:{})};}
 const ad=/^ad-([a-z0-9_]+)$/.exec(arm);
 if(ad){const set:Record<string,string|number>={};let keeper:'sweeper'|'line'|undefined;
  for(const k of ad[1].split('_')){const a=ANTI[k];if(!a)throw Error('unknown arm '+arm);Object.assign(set,a.set??{});if(a.keeper)keeper=a.keeper;}
  return {style:'balanced',formation:'1-2-1',vs:'direct',vsFormation:'1-2-1',...(Object.keys(set).length?{set}:{}),...(keeper?{keeper}:{})};}
 const cx=/^c([xd])-([a-z_]+)$/.exec(arm);
 if(cx){const set:Record<string,string|number>={};
  for(const k of cx[2].split('_')){const a=CPRE[k];if(!a)throw Error('unknown arm '+arm);Object.assign(set,a);}
  return {style:'counter',formation:'1-2-1',vs:cx[1]==='x'?'balanced':'direct',vsFormation:'1-2-1',...(Object.keys(set).length?{set}:{})};}
 const ks=/^ks-(\d\d)$/.exec(arm);if(ks)return {style:'balanced',vs:'direct',sweep:Number(ks[1])/100};
 const ff=/^(ba|di|sh|co)(211|121|22)v(ba|di|sh|co)(211|121|22)$/.exec(arm);
 if(ff){const st=(k:string)=>k==='ba'?'balanced' as Style:STYLE[k];return {style:st(ff[1]),formation:FORM[ff[2]],vs:st(ff[3]),vsFormation:FORM[ff[4]]};}
 const mf=/^di0f(121|22)$/.exec(arm);if(mf)return {style:'direct',vs:'balanced',formation:mf[1]==='121'?'1-2-1':'2-2'};
 const mx=/^(dx|bx)-(prog|wid|com|str|ps)$/.exec(arm);
 if(mx)return mx[1]==='dx'?{style:'direct',from:'balanced',key:ABLATE[mx[2]]}:{style:'balanced',from:'direct',key:ABLATE[mx[2]]};
 const mv=/^(ba|di|sh|co)v(ba|di|sh|co)$/.exec(arm);if(mv){const st=(k:string)=>k==='ba'?'balanced' as Style:STYLE[k];return {style:st(mv[1]),vs:st(mv[2])};}
 const m0=/^(di|sh|co)0$/.exec(arm);if(m0)return {style:STYLE[m0[1]]};
 const ds=/^ds-(\w+)$/.exec(arm);if(ds){if(!SKILLS.includes(ds[1] as Skill))throw Error('unknown arm '+arm);return {skill:ds[1] as Skill,delta:3,style:'balanced',vs:'direct'};}
 const [k,s]=arm.split('-') as [string,Skill];
 if(!SKILLS.includes(s))throw Error('unknown arm '+arm);
 if(k==='p')return {skill:s,delta:3};
 if(k==='m')return {skill:s,delta:-3};
 if(STYLE[k])return {skill:s,delta:3,style:STYLE[k]};
 throw Error('unknown arm '+arm);
}

export function inputOf(arm:string,seed:number):FrozenInput{
 const treated=seed%2,t=armTreatment(arm);
 const sides=[0,1].map(s=>side(s===0?'AAA':'BBB',s===treated?t:(t.vs?{style:t.vs,formation:t.vsFormation??t.formation,...(t.vsSet?{set:t.vsSet}:{})}:{}))) as [FrozenSide,FrozenSide];
 return {v:1,match:`skill-${seed}`,seed,kickoff:((seed>>1)%2) as 0|1,duration:900,sides};
}

// Where each shot's move began (the scenario harness's classify, unchanged).
function classify(frames:any[],shotT:number,side:0|1){
 let i=frames.findIndex((f:any)=>f.t>shotT);if(i<0)i=frames.length;i=Math.max(0,i-1);
 let j=i;while(j>0&&frames[j-1].ps===side)j--;
 const f0=frames[j];
 let restart=false;for(let k=j;k<=Math.min(i,j+3);k++)if(frames[k].r){restart=true;break;}
 const x=f0.b[0]/100,startX=side===0?x:48-x;
 return {startT:f0.t,startX,restart};
}
const r3=(v:number)=>Math.round(v*1000)/1000;

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const inp=inputOf(t.arm,t.seed),t0=performance.now();
 const r=computeMatch(inp);
 const ms=Math.round(performance.now()-t0),c=r.compact,ev=c.chunks.flatMap((ch:any)=>ch.e);
 const ch=matchChances(ev,c.header,r.engineBuild);
 const sideOf=new Map(c.header.players.map((p:any)=>[p.i,p.side]));
 const frames:any[]=c.chunks.flatMap((x:any)=>x.f);
 const shots=ev.filter((e:any)=>e.k==='shot'&&(e.s===0||e.s===1||sideOf.has(e.a)));
 let any:[number,number]|null=[0,0];
 for(const e of shots){const v=shotChance(e);const s=(e.s??sideOf.get(e.a)) as 0|1;if(v===null){any=null;break;}any[s]+=v;}
 const scored=new Set<any>();
 for(const g of ev)if(g.k==='goal'&&(g.s===0||g.s===1)){for(let k=shots.length-1;k>=0;k--){const x=shots[k];if(x.t>g.t)continue;if(x.t<g.t-4000)break;if((x.s??sideOf.get(x.a))===g.s){scored.add(x);break;}}}
 // [side, chance, kind (0 read, 1 header, 2 volley, 3 direct fk), origin, start x (m), secs from spell start, match second, shooter index, goal, engine read q]
 const shotRows=shots.map((e:any)=>{
  const side=(e.s??sideOf.get(e.a)) as 0|1,cl=classify(frames,e.t,side);
  let rk:string|null=null;
  if(cl.restart){for(let k=ev.indexOf(e)-1;k>=0;k--){const x=ev[k];if(x.t<cl.startT-1500)break;if(x.rk){rk=x.rk;break;}}if(!rk)rk='restart';}
  return [side,r3(shotChance(e)??0),e.q!==undefined?0:e.sk??-1,rk??'won',Math.round(cl.startX*10)/10,Math.round((e.t-cl.startT)/100)/10,Math.round(e.t/1000),e.a??null,scored.has(e)?1:0,e.q??null];
 });
 // (2026-10-12, last attack) what happened past the match length: the whistle's time, the score at the
 // match length, and per side the goals, shots and clear chances (a read shot worth >= 0.3) after it.
 const full=inp.duration*1000,lateEv=ev.filter((e:any)=>e.t>full),f900=frames.filter((f:any)=>f.t<=full).at(-1);
 const per=(pick:(e:any)=>boolean)=>[0,1].map(s=>lateEv.filter((e:any)=>pick(e)&&(e.s??sideOf.get(e.a))===s).length);
 const late={played:c.header.duration,at900:f900?.s??null,goals:per((e:any)=>e.k==='goal'),shots:per((e:any)=>e.k==='shot'),
  clear:per((e:any)=>e.k==='shot'&&(shotChance(e)??0)>=.3),last:lateEv.filter((e:any)=>e.k!=='end').at(-1)?.k??null};
 const st=(s:0|1)=>{const x:any=c.stats[s];return {poss:Math.round(x.possession*10)/10,passes:x.passes,completed:x.completed,shots:x.shots,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,fouls:x.fouls};};
 return {label:t.label,kind:'mirror',arm:t.arm,seed:t.seed,rev:t.rev,ours:t.seed%2,kickoff:inp.kickoff,duration:inp.duration,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:r.engineBuild.slice(0,8),tableBuild:CHANCE_TABLE.build.slice(0,8),score:c.score,
  chances:ch?ch.map(r3):null,chancesAny:any?any.map(r3):null,stats:[st(0),st(1)],shots:shotRows,late,dropped:r.dropped,ms};
}
