// Manager scenarios (2026-10-09): one full match of one scenario arm through
// the official code path (lib/ballers/compute.ts computeMatch), with the input
// built the way private.ballers_freeze_match builds it: both sides are
// private.ballers_input_side(club, round) objects (sides/*.jsonb.txt, md5
// checked; scenario 1 reads the Chior Dior study's snapshot.json), side 0 =
// home, kickoff = seed % 2, duration 900.
//
// run.mjs bundles this file once per engine revision: every import below that
// lands in lib/ or packages/football-engine/src/ is redirected to that
// revision's copy, so compute, the chances table and the presets are the
// revision's own. Only "our" side varies by arm, and only through what Match
// prep can set (scenarios.mjs). The opponent varies only by the scenario's
// control (a preset, or a key player out). The captain never reaches the
// engine (engineTeam ignores it). Seeds are the harness's own.
import {computeMatch,type FrozenInput,type FrozenSide} from '../../../../lib/ballers/compute';
import {matchChances,shotChance,CHANCE_TABLE} from '../../../../lib/ballers/chances';
import {PRESETS} from '../../../../lib/ballers/league';
import {SCENARIOS as SET,ADHOC} from './scenarios.mjs';
const SCENARIOS={...SET,...ADHOC};

type Sides=Record<string,[FrozenSide,FrozenSide]>;
let SIDES:Sides={};
/** The frozen sides per scenario (run.mjs reads and checks the files, then hands them over). */
export function init(sides:Sides){SIDES=sides;}

const VALUES:Record<string,readonly (string|number)[]>={progression:['patient','mixed','direct'],width:['narrow','standard','wide'],line:['deep','standard','high'],
 press:['selective','balanced','aggressive'],commit:[1,2,3,4,5],striker:['mixed','link','pivot','run'],transition:['balanced','secure','counter'],onLoss:['regroup','balanced','counterpress']};
const NOT_BEFORE=[0,120,300,450,600,720],THRESHOLDS=[97,95,92];
const keeper=(p:{roles:readonly string[]})=>p.roles[0]==='GK';

/** Throws unless the arm is something the live Match prep could store (Subs.tsx, Prep, SQL checks). */
export function checkArm(base:FrozenSide,a:any,where:string){
 if(a.stored)return;
 const fail=(m:string)=>{throw Error(`${where}: ${m}`);};
 if(!['1-2-1','2-2','2-1-1'].includes(a.formation))fail('formation');
 for(const [k,vals] of Object.entries(VALUES))if(!vals.includes(a.approach?.[k]))fail(`approach.${k}=${a.approach?.[k]}`);
 if(Object.keys(a.approach).some(k=>!(k in VALUES)))fail('approach has an unknown key');
 const ids=a.lineup.map((s:string)=>idOf(base,s,where));
 if(new Set(ids).size!==5)fail('lineup needs five different players');
 const pl=(id:string)=>base.players.find(p=>p.id===id)!;
 if(!keeper(pl(ids[0]))||ids.slice(1).some((id:string)=>keeper(pl(id))))fail('keeper must be slot 1 and only there');
 const s=a.settings??{};
 if(Object.keys(s).some(k=>!['keeper','setPiece','taker'].includes(k)))fail('settings key');
 if(s.keeper!==undefined&&!['line','sweeper'].includes(s.keeper))fail('settings.keeper');
 if(s.setPiece!==undefined&&!['short','delivery'].includes(s.setPiece))fail('settings.setPiece (mixed = absent)');
 if(s.taker!==undefined&&!ids.slice(1).includes(idOf(base,s.taker,where)))fail('settings.taker must be an outfield starter');
 const subs=a.subs??[];if(subs.length>3)fail('at most 3 substitutions');
 const benchIds=base.players.map(p=>p.id).filter(id=>!ids.includes(id));
 for(const o of subs){
  if(!benchIds.includes(idOf(base,o.in,where)))fail(`sub ${o.id}: ${o.in} is not on the bench`);
  if(subs.filter((x:any)=>x.in===o.in).length>1)fail(`sub ${o.id}: ${o.in} comes on twice`);
  const t=o.trigger;
  if(t.kind==='tired'){if(!THRESHOLDS.includes(t.threshold))fail(`sub ${o.id}: tired threshold must be a level code`);if(o.out!==undefined&&o.out!==t.player)fail(`sub ${o.id}: tired out = the tired player`);}
  else if(t.kind==='score'){if(!['losing','drawing','winning'].includes(t.state))fail(`sub ${o.id}: score state`);}
  else if(t.kind==='margin'){if(t.atLeast!==2||!['up','down'].includes(t.direction))fail(`sub ${o.id}: margin`);}
  else if(t.kind==='half'){if(o.notBefore!==undefined)fail(`sub ${o.id}: half-time takes no "not before"`);}
  else fail(`sub ${o.id}: trigger kind`);
  if(o.notBefore!==undefined&&!NOT_BEFORE.includes(o.notBefore))fail(`sub ${o.id}: notBefore must be one of ${NOT_BEFORE}`);
 }
}
function idOf(base:FrozenSide,short:string,where=''):string{
 const m=base.players.filter(p=>p.short===short||p.id===short);
 if(m.length!==1)throw Error(`${where}: player '${short}' matches ${m.length} players of ${base.club.code}`);
 return m[0].id;
}
/** private.ballers_bench + ballers_input_side's player order: the rest of the squad by shirt number, players = lineup then bench. */
function withLineup(base:FrozenSide,lineup:string[]):Pick<FrozenSide,'lineup'|'bench'|'players'>{
 const bench=base.players.filter(p=>!lineup.includes(p.id)).sort((x,y)=>x.number-y.number).map(p=>p.id);
 return {lineup,bench,players:[...lineup,...bench].map(id=>base.players.find(p=>p.id===id)!)};
}
/** Our side as Match prep would freeze it for this arm. */
export function armSide(base:FrozenSide,a:any):FrozenSide{
 if(a.stored)return base;
 const id=(s:string)=>idOf(base,s);
 const lineup=a.lineup.map(id);
 const ms:any={...(a.settings??{})};if(ms.taker)ms.taker=id(ms.taker);
 const subs=(a.subs??[]).map((o:any)=>({...o,in:id(o.in),...(o.out?{out:id(o.out)}:{}),trigger:o.trigger.kind==='tired'?{...o.trigger,player:id(o.trigger.player)}:o.trigger}));
 const {settings:_s,substitutions:_u,...rest}=base;void _s;void _u;
 return {...rest,formation:a.formation,style:a.style,approach:{...a.approach},captain:lineup.includes(base.captain)?base.captain:lineup[1],...withLineup(base,lineup),plans:[],substitutions:subs,...(Object.keys(ms).length?{settings:ms}:{})};
}
/** The opponent for a variant: 'stored', or the scenario's control. */
export function oppSide(base:FrozenSide,v:any):FrozenSide{
 if(!v||v==='stored')return base;
 if(v.preset){const p=(PRESETS as any)[v.preset];if(!p)throw Error('unknown preset '+v.preset);return {...base,style:v.preset,approach:{...p}};}
 if(v.out){
  const out=idOf(base,v.out),inn=idOf(base,v.in);
  if(!base.lineup.includes(out)||base.lineup.includes(inn))throw Error('bad key-player-out control');
  const lineup=base.lineup.map(x=>x===out?inn:x);
  const settings=base.settings?.taker===out?(({taker:_t,...r})=>r)(base.settings as any):base.settings;
  return {...base,...withLineup(base,lineup),captain:lineup.includes(base.captain)?base.captain:lineup[1],...(settings&&Object.keys(settings).length?{settings}:{settings:undefined})};
 }
 throw Error('unknown opponent variant');
}
export function inputOf(t:{scenario:string;arm:string;opp:string;seed:number;duration?:number}):FrozenInput{
 const sc=(SCENARIOS as any)[t.scenario];if(!sc)throw Error('unknown scenario '+t.scenario);
 const arm=sc.arms[t.arm];if(!arm)throw Error(`unknown arm ${t.scenario}/${t.arm}`);
 const base=SIDES[t.scenario];if(!base)throw Error('sides not loaded for '+t.scenario);
 const variant=t.opp==='stored'?'stored':t.opp===sc.control.id?sc.control.opp:null;if(!variant)throw Error(`unknown opponent ${t.scenario}/${t.opp}`);
 const ours=sc.ours as 0|1,sides=[...base] as [FrozenSide,FrozenSide];
 sides[ours]=armSide(base[ours],arm);sides[1-ours]=oppSide(base[1-ours],variant);
 return {v:1,match:sc.matchId(t.seed),seed:t.seed,kickoff:(t.seed%2) as 0|1,duration:t.duration??900,sides};
}

// ------------------------------------------------------------------ mechanism
// As the Chior Dior study (match.ts there): each shot gets where its move
// began, from the compact replay. The spell = the run of frames with
// ps === shooter side before the shot; its first frame decides. A restart in
// its first frames makes the origin the restart kind, else 'won' with the
// regain's x (metres from the shooting side's own goal line) and seconds to the shot.
function classify(frames:any[],shotT:number,side:0|1){
 let i=frames.findIndex((f:any)=>f.t>shotT);if(i<0)i=frames.length;i=Math.max(0,i-1);
 let j=i;while(j>0&&frames[j-1].ps===side)j--;
 const f0=frames[j];
 let restart=false;for(let k=j;k<=Math.min(i,j+3);k++)if(frames[k].r){restart=true;break;}
 const x=f0.b[0]/100,startX=side===0?x:48-x;
 return {startT:f0.t,startX,restart};
}
const r3=(v:number)=>Math.round(v*1000)/1000;

export function play(t:{label:string;scenario:string;arm:string;opp:string;seed:number;rev:string;duration?:number;detail?:boolean}){
 const inp=inputOf(t),t0=performance.now();
 const r=computeMatch(inp);
 const ms=Math.round(performance.now()-t0),c=r.compact,ev=c.chunks.flatMap((ch:any)=>ch.e);
 const ch=matchChances(ev,c.header,r.engineBuild);
 const sideOf=new Map(c.header.players.map((p:any)=>[p.i,p.side]));
 const shortOf=new Map(c.header.players.map((p:any)=>[p.i,p.short]));
 const frames:any[]=c.chunks.flatMap((x:any)=>x.f);
 const shots=ev.filter((e:any)=>e.k==='shot'&&(e.s===0||e.s===1||sideOf.has(e.a)));
 // any-table chances: the revision's table even when it was measured on another build (flagged by tableBuild)
 let any:[number,number]|null=[0,0];
 for(const e of shots){const v=shotChance(e);const s=(e.s??sideOf.get(e.a)) as 0|1;if(v===null){any=null;break;}any[s]+=v;}
 const scored=new Set<any>();
 for(const g of ev)if(g.k==='goal'&&(g.s===0||g.s===1)){for(let k=shots.length-1;k>=0;k--){const x=shots[k];if(x.t>g.t)continue;if(x.t<g.t-4000)break;if((x.s??sideOf.get(x.a))===g.s){scored.add(x);break;}}}
 const shotRows=shots.map((e:any)=>{
  const side=(e.s??sideOf.get(e.a)) as 0|1,cl=classify(frames,e.t,side);
  let rk:string|null=null;
  if(cl.restart){for(let k=ev.indexOf(e)-1;k>=0;k--){const x=ev[k];if(x.t<cl.startT-1500)break;if(x.rk){rk=x.rk;break;}}if(!rk)rk='restart';}
  // [side, chance, kind (0 read, 1 header, 2 volley, 3 direct fk), origin, start x (m), secs from spell start, match second, shooter, goal, engine read q (null when unread)]
  return [side,r3(shotChance(e)??0),e.q!==undefined?0:e.sk??-1,rk??'won',Math.round(cl.startX*10)/10,Math.round((e.t-cl.startT)/100)/10,Math.round(e.t/1000),shortOf.get(e.a)??null,scored.has(e)?1:0,e.q??null];
 });
 const st=(s:0|1)=>{const x:any=c.stats[s];return {poss:Math.round(x.possession*10)/10,passes:x.passes,completed:x.completed,shots:x.shots,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,fouls:x.fouls};};
 const shortById=new Map(inp.sides.flatMap(s=>s.players.map(p=>[p.id,p.short])));
 // [side, status, match second, order id, on (short), off (short)]
 const subs=(c.substitutionNotes??[]).flatMap((n:any)=>n.notes.map((x:any)=>[n.side,x.status,x.time==null?null:Math.round(x.time),x.order,shortById.get(x.in)??null,x.out?shortById.get(x.out)??null:null]));
 const kinds:Record<string,number>={};if(t.detail)for(const e of ev)kinds[e.k]=(kinds[e.k]??0)+1;
 return {label:t.label,scenario:t.scenario,arm:t.arm,opp:t.opp,seed:t.seed,rev:t.rev,ours:(SCENARIOS as any)[t.scenario].ours,duration:inp.duration,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:r.engineBuild.slice(0,8),tableBuild:CHANCE_TABLE.build.slice(0,8),score:c.score,
  chances:ch?ch.map(r3):null,chancesAny:any?any.map(r3):null,
  stats:[st(0),st(1)],shots:shotRows,...(subs.length?{subs}:{}),...(t.detail?{kinds}:{}),dropped:r.dropped,ms};
}
