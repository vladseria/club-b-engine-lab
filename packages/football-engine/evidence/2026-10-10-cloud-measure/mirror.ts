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

function side(code:string,treat:{skill?:Skill;delta?:number;style?:Style}):FrozenSide{
 const players=ROLES.map((roles,i)=>{
  const gk=i===0,skills={...(gk?GK_SKILLS:OUT_SKILLS)};
  if(treat.skill&&(treat.skill==='keeping'?gk:!gk))skills[treat.skill]=Math.max(0,Math.min(10,skills[treat.skill]+treat.delta!));
  return {id:`${code}${i+1}`,name:`${code} ${i+1}`,short:`${code}${i+1}`,number:i+1,roles:[...roles],skills,traits:gk?{...TRAITS,keeperSweep:.5}:{...TRAITS},energy:100,archetype:'x',temperament:'x',note:'x',portrait:'p0001'};
 });
 const style=treat.style??'balanced',approach=(PRESETS as any)[style];
 if(!approach)throw Error(`this revision has no ${style} preset`);
 return {club:{id:code,name:code,code,color:code==='AAA'?'#3fd38a':'#d33f6a'},formation:'2-1-1',style,approach:{...approach},captain:`${code}2`,lineup:players.map(p=>p.id),bench:[],players,plans:[]} as any;
}

export function armTreatment(arm:string):{skill?:Skill;delta?:number;style?:Style;vs?:Style}{
 if(arm==='base')return {};
 const mv=/^(ba|di|sh|co)v(ba|di|sh|co)$/.exec(arm);if(mv){const st=(k:string)=>k==='ba'?'balanced' as Style:STYLE[k];return {style:st(mv[1]),vs:st(mv[2])};}
 const m0=/^(di|sh|co)0$/.exec(arm);if(m0)return {style:STYLE[m0[1]]};
 const [k,s]=arm.split('-') as [string,Skill];
 if(!SKILLS.includes(s))throw Error('unknown arm '+arm);
 if(k==='p')return {skill:s,delta:3};
 if(k==='m')return {skill:s,delta:-3};
 if(STYLE[k])return {skill:s,delta:3,style:STYLE[k]};
 throw Error('unknown arm '+arm);
}

export function inputOf(arm:string,seed:number):FrozenInput{
 const treated=seed%2,t=armTreatment(arm);
 const sides=[0,1].map(s=>side(s===0?'AAA':'BBB',s===treated?t:(t.vs?{style:t.vs}:{}))) as [FrozenSide,FrozenSide];
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
 const st=(s:0|1)=>{const x:any=c.stats[s];return {poss:Math.round(x.possession*10)/10,passes:x.passes,completed:x.completed,shots:x.shots,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,fouls:x.fouls};};
 return {label:t.label,kind:'mirror',arm:t.arm,seed:t.seed,rev:t.rev,ours:t.seed%2,kickoff:inp.kickoff,duration:inp.duration,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:r.engineBuild.slice(0,8),tableBuild:CHANCE_TABLE.build.slice(0,8),score:c.score,
  chances:ch?ch.map(r3):null,chancesAny:any?any.map(r3):null,stats:[st(0),st(1)],shots:shotRows,dropped:r.dropped,ms};
}
