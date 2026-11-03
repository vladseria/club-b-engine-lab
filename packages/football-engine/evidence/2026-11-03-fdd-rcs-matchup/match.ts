// FC Directia Darmanesti at Roman City Sport Club (2026-11-03, global round 11): one full match of one arm through
// the official code path (lib/ballers/compute.ts computeMatch), with the input built the way
// private.ballers_freeze_match builds it today (read live with pg_get_functiondef on 2026-11-03):
//   {v:1, match, seed, kickoff: seed % 2, duration: 900, sides: [home, away]}
//   || {fitness: {v: 1}, injuries: {on: true, salt: (seed * 2654435761) mod 2^32, age: [home ages, away ages],
//       scale: 0.47, strength: 0.15}}
// because fitness is on for both clubs (ballers_fitness_on), so the marker and the league injuries key are both added.
// Both sides are private.ballers_input_side(club, round 11) (sides/*.jsonb.txt, md5 checked by run.mjs); the fitness
// step (private.ballers_fitness_side) leaves them byte-identical (every forecast energy is 100). Side 0 = Roman City
// (home, always its stored side), side 1 = Directia (the arm). Seeds are this study's own; the fixture's official seed
// is never read.
import {computeMatch,validateInput,engineTeam,sideOrders,sideSwitches,type FrozenInput,type FrozenSide} from '../../../../lib/ballers/compute';
import {matchChances,shotChance} from '../../../../lib/ballers/chances';
import {PRESETS as LIB_PRESETS} from '../../../../lib/ballers/league';
import {STYLE_BASE} from '../../../../lib/ballers/approach';
import {matchPlayerStats} from '../../../../lib/ballers/stats';
import {ARMS,PRESETS} from './arms.mjs';

type Sides={RCS:FrozenSide;FDD:FrozenSide;ages:{RCS:Record<string,number>;FDD:Record<string,number>}};
let S:Sides|null=null;
/** run.mjs reads and md5-checks the side files, then hands them over. */
export function init(s:Sides){S=s;}

// The arms' preset copy must be the code's.
for(const k of Object.keys(LIB_PRESETS))if(JSON.stringify((PRESETS as any)[k])!==JSON.stringify((LIB_PRESETS as any)[k]))throw Error(`arms.mjs PRESETS.${k} differs from lib/ballers/league.ts`);

const VALUES:Record<string,readonly (string|number)[]>={progression:['patient','mixed','direct'],width:['narrow','standard','wide'],line:['deep','standard','high'],
 press:['selective','balanced','aggressive'],commit:[3,4,5],striker:['mixed','link','pivot','run'],transition:['balanced','secure','counter'],onLoss:['balanced','counterpress']};
const NOT_BEFORE=[0,120,300,450,600,720],THRESHOLDS=[97,95,92];
const isKeeper=(p:{roles:readonly string[]})=>p.roles.includes('GK');

function idOf(base:FrozenSide,short:string,where=''):string{
 const m=base.players.filter(p=>p.short===short||p.id===short);
 if(m.length!==1)throw Error(`${where}: player '${short}' matches ${m.length} players of ${base.club.code}`);
 return m[0].id;
}
function checkApproach(style:string,a:any,where:string){
 for(const [k,vals] of Object.entries(VALUES))if(!vals.includes(a?.[k]))throw Error(`${where}: approach.${k}=${a?.[k]}`);
 if(Object.keys(a).some(k=>!(k in VALUES)))throw Error(`${where}: approach has an unknown key`);
 const b=(STYLE_BASE as any)[style];if(!b)throw Error(`${where}: style ${style}`);
 if(a.progression!==b.progression||a.transition!==b.transition)throw Error(`${where}: approach is not ${style}'s base`);
}
/** Throws unless the arm is something the live Match prep could store (lib/ballers/subs.ts, switch.ts, approach.ts). */
/** A stored-side arm's orders: the stored list, minus `dropOrders`, with `patchOrders` (id -> {in?, out?, trigger?, notBefore?},
 * players by short name; notBefore null removes it) merged in place, so the list keeps its stored order and ids. */
function storedOrders(base:FrozenSide,a:any,where=''):any[]{
 for(const id of [...(a.dropOrders??[]),...Object.keys(a.patchOrders??{})])if(!(base.substitutions??[]).some(o=>o.id===id))throw Error(`${where}: no stored order ${id}`);
 const id=(s:string)=>idOf(base,s,where);
 return (base.substitutions??[]).filter(o=>!(a.dropOrders??[]).includes(o.id)).map(o=>{
  const p=a.patchOrders?.[o.id];if(!p)return o;
  const {notBefore:_n,...rest}=o as any;
  const nb=p.notBefore===undefined?(o as any).notBefore:p.notBefore;
  const trigger=p.trigger?(p.trigger.kind==='tired'?{...p.trigger,player:id(p.trigger.player)}:p.trigger):o.trigger;
  return {...rest,...(p.in?{in:id(p.in)}:{}),...(p.out?{out:id(p.out)}:{}),trigger,...(nb!=null?{notBefore:nb}:{})};
 });
}
export function checkArm(base:FrozenSide,a:any,where:string){
 const fail=(m:string)=>{throw Error(`${where}: ${m}`);};
 if(a.stored){
  // the stored side with another five and/or changed orders (added after the screen): the same lineup rules as Match prep
  // (ballers_check_lineup), the order rules of ballers_check_subs and the prep UI's values (Subs.tsx), against the five
  const kept=storedOrders(base,a,where);
  if(!a.lineup&&!a.patchOrders)return;
  const ids=(a.lineup??[]).length?a.lineup.map((s:string)=>idOf(base,s,where)):[...base.lineup];
  if(new Set(ids).size!==5)fail('lineup needs five different players');
  const pl=(id:string)=>base.players.find(p=>p.id===id)!;
  if(!isKeeper(pl(ids[0]))||ids.slice(1).some((id:string)=>isKeeper(pl(id))))fail('keeper must be slot 1 and only there');
  // the captain never reaches the engine; one not in the five passes the armband to slot 2, as ballers_resolve_setup does (armSide)
  const t=(base.settings as any)?.taker;if(t&&!ids.slice(1).includes(t))fail('the stored taker is not in the new five');
  if(kept.length>3)fail('at most 3 substitutions');
  const ins=new Set<string>();
  for(const o of kept){
   const tr=o.trigger;
   if(tr.kind==='tired'){if(!THRESHOLDS.includes(tr.threshold))fail(`order ${o.id}: tired level code`);}
   else if(tr.kind==='score'){if(!['losing','drawing','winning'].includes(tr.state))fail(`order ${o.id}: score state`);}
   else if(tr.kind==='margin'){if(tr.atLeast!==2||!['up','down'].includes(tr.direction))fail(`order ${o.id}: margin`);}
   else if(tr.kind==='half'){if(o.notBefore!==undefined)fail(`order ${o.id}: half-time takes no "not before"`);}
   else fail(`order ${o.id}: trigger kind`);
   if(o.notBefore!==undefined&&!NOT_BEFORE.includes(o.notBefore))fail(`order ${o.id}: notBefore must be one of ${NOT_BEFORE}`);
   if(ids.includes(o.in))fail(`order ${o.id}: its incoming man starts`);
   if(ins.has(o.in))fail(`order ${o.id}: ${o.in} comes on twice`);ins.add(o.in);
   const out=(o as any).out;if(!ids.includes(out)&&!kept.some(x=>x.in===out))fail(`order ${o.id}: its outgoing man neither starts nor comes on`);
   if(o.trigger.kind==='tired'&&(o.trigger as any).player!==out)fail(`order ${o.id}: tired out = the tired player`);
   // private.ballers_check_subs 'keeper': a man in slot 1 is replaced only by a keeper, an outfielder only by an outfielder
   const slot=ids.indexOf(out);if(slot>=0&&(slot===0)!==isKeeper(pl(o.in)))fail(`order ${o.id}: keeper for keeper only`);
  }
  return;
 }
 if(!['1-2-1','2-2'].includes(a.formation))fail('formation');
 checkApproach(a.style,a.approach,where);
 const ids=a.lineup.map((s:string)=>idOf(base,s,where));
 if(new Set(ids).size!==5)fail('lineup needs five different players');
 const pl=(id:string)=>base.players.find(p=>p.id===id)!;
 if(!isKeeper(pl(ids[0]))||ids.slice(1).some((id:string)=>isKeeper(pl(id))))fail('keeper must be slot 1 and only there');
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
  if(o.out===undefined)fail(`sub ${o.id}: name who goes off`);
  if(isKeeper(pl(idOf(base,o.in,where)))!==isKeeper(pl(idOf(base,o.out,where))))fail(`sub ${o.id}: keeper for keeper only`);
  const t=o.trigger;
  if(t.kind==='tired'){if(!THRESHOLDS.includes(t.threshold))fail(`sub ${o.id}: tired level code`);if(o.out!==t.player)fail(`sub ${o.id}: tired out = the tired player`);}
  else if(t.kind==='score'){if(!['losing','drawing','winning'].includes(t.state))fail(`sub ${o.id}: score state`);}
  else if(t.kind==='margin'){if(t.atLeast!==2||!['up','down'].includes(t.direction))fail(`sub ${o.id}: margin`);}
  else if(t.kind==='half'){if(o.notBefore!==undefined)fail(`sub ${o.id}: half-time takes no "not before"`);}
  else fail(`sub ${o.id}: trigger kind`);
  if(o.notBefore!==undefined&&!NOT_BEFORE.includes(o.notBefore))fail(`sub ${o.id}: notBefore must be one of ${NOT_BEFORE}`);
 }
 if(a.switch){
  const w=a.switch,t=w.trigger;
  const ok=t.kind==='always'||(t.kind==='score'&&['losing','drawing','winning'].includes(t.state))||(t.kind==='margin'&&t.atLeast===2&&['up','down'].includes(t.direction));
  if(!ok)fail('switch trigger');
  if(w.notBefore!==undefined&&!NOT_BEFORE.includes(w.notBefore))fail('switch from-minute');
  checkApproach(w.to.style,w.to.approach,`${where} switch`);
  if(Object.keys(w.to.settings??{}).some(k=>!['keeper','setPiece'].includes(k)))fail('switch settings: keeper / free kicks only');
  if(w.to.formation&&w.to.formation!==a.formation)fail('switch to another formation needs the SQL slot map: not used here');
 }
}

/** private.ballers_bench + ballers_input_side's player order: the rest of the squad by shirt number; players = lineup then bench. */
function withLineup(base:FrozenSide,lineup:string[]):Pick<FrozenSide,'lineup'|'bench'|'players'>{
 const bench=base.players.filter(p=>!lineup.includes(p.id)).sort((x,y)=>x.number-y.number).map(p=>p.id);
 return {lineup,bench,players:[...lineup,...bench].map(id=>base.players.find(p=>p.id===id)!)};
}
/** Directia's side as Match prep would freeze it for this arm. */
export function armSide(base:FrozenSide,a:any):FrozenSide{
 if(a.stored){
  if(!a.dropOrders?.length&&!a.lineup&&!a.patchOrders)return base;
  const subs=storedOrders(base,a);
  // another five: lineup in slot order, the bench and the player order rebuilt as ballers_bench / ballers_input_side do;
  // plan, approach, settings, captain and the kept orders exactly as stored
  const five:any=a.lineup?withLineup(base,a.lineup.map((s:string)=>idOf(base,s))):{};
  const captain=five.lineup&&!five.lineup.includes(base.captain)?{captain:five.lineup[1]}:{};
  return {...base,...five,...captain,substitutions:subs};
 }
 const id=(s:string)=>idOf(base,s);
 const lineup=a.lineup.map(id);
 const ms:any={...(a.settings??{})};if(ms.taker)ms.taker=id(ms.taker);
 const subs=(a.subs??[]).map((o:any)=>({id:o.id,in:id(o.in),out:id(o.out),trigger:o.trigger.kind==='tired'?{...o.trigger,player:id(o.trigger.player)}:o.trigger,...(o.notBefore!==undefined?{notBefore:o.notBefore}:{})}));
 const {settings:_s,substitutions:_u,switch:_w,...rest}=base as any;void _s;void _u;void _w;
 const sw=a.switch?{switch:{id:'sw',trigger:a.switch.trigger,...(a.switch.notBefore!==undefined?{notBefore:a.switch.notBefore}:{}),
  to:{plan:a.switch.to.plan,style:a.switch.to.style,approach:{...a.switch.to.approach},settings:{...(a.switch.to.settings??{})}}}}:{};
 return {...rest,formation:a.formation,style:a.style,approach:{...a.approach},captain:lineup.includes(base.captain)?base.captain:lineup[1],...withLineup(base,lineup),plans:[],
  substitutions:subs,...(Object.keys(ms).length?{settings:ms}:{}),...sw};
}
export function inputOf(t:{arm:string;seed:number;duration?:number}):FrozenInput{
 if(!S)throw Error('sides not loaded');
 const arm=(ARMS as any)[t.arm];if(!arm)throw Error('unknown arm '+t.arm);
 const salt=Number((BigInt(t.seed)*2654435761n)%4294967296n);
 const inp={v:1,match:`fdd-rcs-study-${t.seed}`,seed:t.seed,kickoff:(t.seed%2) as 0|1,duration:t.duration??900,sides:[S.RCS,armSide(S.FDD,arm)],
  fitness:{v:1},injuries:{on:true,salt,age:[S.ages.RCS,S.ages.FDD],scale:.47,strength:.15}};
 return validateInput(inp) as FrozenInput;
}
/** Builds an arm's input and both sides' engine teams, orders and switches exactly as computeMatch does, WITHOUT playing:
 * throws if the engine would leave anything out (an order or a switch it refuses). */
export function dryCheck(t:{arm:string;seed:number}){
 const inp=inputOf(t),teams=inp.sides.map(engineTeam) as [any,any];
 const o=sideOrders(inp,teams),w=sideSwitches(inp,teams);
 if(o.dropped.length||w.dropped.length)throw Error(`${t.arm}: the engine refuses ${[...o.dropped,...w.dropped].join(', ')}`);
 const mine=(inp.sides[1].substitutions??[]).length;
 if(o.orders.filter(x=>x.side===1).length!==mine)throw Error(`${t.arm}: ${mine} orders stored, ${o.orders.filter(x=>x.side===1).length} reach the engine`);
 const short=(id?:string)=>id===undefined?undefined:inp.sides[1].players.find(p=>p.id===id)?.short??id;
 return {lineup:inp.sides[1].lineup.map(short),captain:short(inp.sides[1].captain),
  orders:o.orders.filter(x=>x.side===1).map(x=>({id:x.id,in:short(x.in),out:short(x.out),trigger:x.trigger.kind==='tired'?{...x.trigger,player:short(x.trigger.player)}:x.trigger,...(x.notBefore!==undefined?{notBefore:x.notBefore}:{})}))};
}

// ------------------------------------------------------------------ mechanism
// As the Chior Dior study (../2026-10-08-chior-dior-matchup/match.ts): each shot gets where its move began, from the
// compact replay. The spell = the run of frames with ps === shooter side before the shot; its first frame decides. A
// restart in its first frames makes the origin the restart kind, else 'won' with the regain's x (metres from the
// shooting side's own goal line) and seconds to the shot. Frame x in cm, pitch 48 m, side 0 attacks +x.
function classify(frames:any[],shotT:number,side:0|1){
 let i=frames.findIndex((f:any)=>f.t>shotT);if(i<0)i=frames.length;i=Math.max(0,i-1);
 let j=i;while(j>0&&frames[j-1].ps===side)j--;
 const f0=frames[j];
 let restart=false;for(let k=j;k<=Math.min(i,j+3);k++)if(frames[k].r){restart=true;break;}
 const x=f0.b[0]/100,startX=side===0?x:48-x;
 return {startT:f0.t,startX,restart};
}
const r3=(v:number)=>Math.round(v*1000)/1000;

export function play(t:{label:string;arm:string;seed:number;duration?:number;detail?:boolean}){
 const inp=inputOf(t),t0=performance.now();
 const r=computeMatch(inp);
 const ms=Math.round(performance.now()-t0),c=r.compact;
 const ev:any[]=c.chunks.flatMap((ch:any)=>ch.e),frames:any[]=c.chunks.flatMap((ch:any)=>ch.f);
 const ch=matchChances(ev,c.header,r.engineBuild);
 const P=new Map(c.header.players.map((p:any)=>[p.i,p]));
 const sideOf=(e:any)=>e.s===0||e.s===1?e.s:(P.get(e.a) as any)?.side;
 const shots=ev.filter((e:any)=>e.k==='shot'&&(sideOf(e)===0||sideOf(e)===1));
 // a shot "scored" when its side scored within 4 s and it was that side's last shot before the goal
 const scored=new Set<any>();
 for(const g of ev)if(g.k==='goal'&&(g.s===0||g.s===1)){for(let k=shots.length-1;k>=0;k--){const x=shots[k];if(x.t>g.t)continue;if(x.t<g.t-4000)break;if(sideOf(x)===g.s){scored.add(x);break;}}}
 const shotRows=shots.map((e:any)=>{
  const side=sideOf(e) as 0|1,cl=classify(frames,e.t,side);
  let rk:string|null=null;
  if(cl.restart){for(let k=ev.indexOf(e)-1;k>=0;k--){const x=ev[k];if(x.t<cl.startT-1500)break;if(x.rk){rk=x.rk;break;}}if(!rk)rk='restart';}
  // [side, chance, kind (0 read, 1 head, 2 volley, 3 fk), origin, start x, secs from spell start, match second, shooter, goal]
  return [side,r3(shotChance(e)??0),e.q!==undefined?0:e.sk??-1,rk??'won',Math.round(cl.startX*10)/10,Math.round((e.t-cl.startT)/100)/10,Math.round(e.t/1000),(P.get(e.a) as any)?.short??null,scored.has(e)?1:0];
 });
 // every player who stood on the pitch: [side, short, seconds, shots, on target, goals, started]
 const lines=matchPlayerStats(c.header,ev,frames).map(l=>{const p=c.header.players.find((q:any)=>q.id===l.id&&q.side===l.side) as any;return [l.side,p?.short??l.id,Math.round(l.m??0),l.sh,l.so??0,l.g,l.st];});
 const st=(s:0|1)=>{const x:any=c.stats[s];return {poss:Math.round(x.possession*10)/10,passes:x.passes,completed:x.completed,shots:x.shots,saves:x.saves,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,fouls:x.fouls,surges:x.surges,surgeShots:x.surgeShots};};
 const subs=(c.substitutionNotes??[]).flatMap((n:any)=>n.notes.map((x:any)=>[n.side,x.status,x.time==null?null:Math.round(x.time),x.order??null]));
 const sw=(c.switchNotes??[]).map((n:any)=>[n.side,n.status,n.time==null?null:Math.round(n.time)]);
 const injuries=(r.injuries??[]).map(j=>[j.side,(c.header.players.find((q:any)=>q.id===j.id&&q.side===j.side) as any)?.short??j.id,Math.round(j.t),j.cause,j.off==null?null:Math.round(j.off),j.played_on?1:0]);
 const kinds:Record<string,number>={};if(t.detail)for(const e of ev)kinds[e.k]=(kinds[e.k]??0)+1;
 return {label:t.label,arm:t.arm,seed:t.seed,duration:inp.duration,build:r.engineBuild.slice(0,8),score:c.score,chances:ch?ch.map(v=>r3(v)):null,
  stats:[st(0),st(1)],shots:shotRows,lines,...(subs.length?{subs}:{}),...(sw.length?{sw}:{}),...(injuries.length?{injuries}:{}),...(t.detail?{kinds}:{}),dropped:r.dropped,ms};
}
