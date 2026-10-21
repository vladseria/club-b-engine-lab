// Plan switch, formation step 0: ONE match with a formation-changing switch, through the app's own path
// (lib/ballers/compute.ts computeMatch: engineTeam, sideSwitches, runMatch, compact). The input is the engine-as-data
// trace T1 (RAP 1-2-1 Combinations v UMA Direct, seed 7, kickoff away; 0-4 without a switch) plus a switch for RAP:
// losing, from 5:00, to a Direct plan in 2-2. Plan B's own five (for the slot map) is RAP's keeper, centre-back and
// two wingers in 2-2's slots 1, 3 and 4 and a bench man at 2, so the striker is the one man plan B doesn't place: the
// fill-in rule (DESIGN §2.4, SQL private.ballers_switch_slots, mirrored by slotMap below) puts him at centre-back.
// Played on the public lab (one shard, one worker) through trace-run.mjs, which writes results/trace-ps1.jsonl.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {init,sideOf} from '../2026-10-21-engine-as-data/parity';
import {TRACES} from '../2026-10-21-engine-as-data/set.mjs';
import {computeMatch,engineTeam,sideSwitches} from '../../../../lib/ballers/compute';
import {PRESETS} from '../../../../lib/ballers/league';
import {L as PITCH} from '../../src/pitch';

/** The SQL rule (private.ballers_switch_slots), mirrored for this trace: the keeper stays; a man in plan B's own five
 * takes plan B's slot; the rest fill the remaining slots in slot order by the fill-in rule (his listed position for the
 * slot's role, first preferred, absent last; then shirt number; then id). Returns new slot by lineup slot (0-based). */
export function slotMap(lineup:string[],toLineup:string[],formation:'1-2-1'|'2-2',players:{id:string;roles:string[];number:number}[]):number[]{
 const ROLES:Record<string,string[]>={'2-2':['GK','CB','CB','W','W'],'1-2-1':['GK','CB','W','W','ST']};
 const out:(number|null)[]=[0,null,null,null,null],taken=new Set([0]);
 for(let i=1;i<5;i++){const s=toLineup.indexOf(lineup[i]);if(s>0&&!taken.has(s)){out[i]=s;taken.add(s);}}
 for(let s=1;s<5;s++){
  if(taken.has(s))continue;
  const role=ROLES[formation][s],free=[1,2,3,4].filter(i=>out[i]===null);
  const rank=(i:number)=>{const p=players.find(q=>q.id===lineup[i]);const at=p?p.roles.indexOf(role):-1;return [at<0?99:at,p?.number??99,lineup[i]] as const;};
  free.sort((a,b)=>{const x=rank(a),y=rank(b);return x[0]-y[0]||x[1]-y[1]||(x[2]<y[2]?-1:x[2]>y[2]?1:0);});
  out[free[0]]=s;taken.add(s);
 }
 return out as number[];
}

const here=path.resolve(process.argv[2]??'packages/football-engine/evidence/2026-10-21-engine-as-data');
const load=(dir:string)=>{
 const sums=JSON.parse(readFileSync(path.join(dir,'CHECKSUMS.json'),'utf8')).files,out:Record<string,unknown>={};
 for(const f of Object.keys(sums)){const txt=readFileSync(path.join(dir,f),'utf8');
  if(createHash('md5').update(txt).digest('hex')!==sums[f].md5)throw Error(f+': checksum');out[f.split('.')[0]]=JSON.parse(txt);}
 return out;
};
init({scen:load(path.join(here,'../2026-10-09-scenarios/sides')),g7:load(path.join(here,'global-r7'))});

export function runTrace():string[]{
 const t=(TRACES as any[]).find(x=>x.id.startsWith('T1'));
 const sides=t.sides.map((s:any)=>sideOf(s,null));
 const rap=sides[0],L5=rap.lineup as string[];
 const planB=[L5[0],L5[1],rap.bench[0]??L5[4],L5[2],L5[3]];
 const slots=slotMap(L5,planB,'2-2',rap.players);
 rap.switch={id:'sw',trigger:{kind:'score',state:'losing'},notBefore:300,
  to:{plan:'trace-direct-2-2',style:'direct',approach:{...(PRESETS as any).direct},settings:{keeper:'sweeper',setPiece:'delivery'},formation:'2-2',slots}};
 const input:any={v:1,match:'ps1-trace',seed:t.seed,kickoff:t.kickoff,duration:900,sides};
 const teams=sides.map(engineTeam);
 const sw=sideSwitches(input,teams as any);
 const t0=performance.now();
 const c=computeMatch(input);
 const ms=Math.round(performance.now()-t0);
 const events=c.compact.chunks.flatMap(ch=>ch.e),frames=c.compact.chunks.flatMap(ch=>ch.f);
 const k=events.findIndex(e=>e.k==='switch'),e=events[k];
 const clock=(v:number)=>`${Math.floor(v/60000)}:${String(Math.floor(v/1000)%60).padStart(2,'0')}.${String(v%1000).padStart(3,'0')}`;
 const out:string[]=[];const say=(s:string)=>{out.push(s);console.log(s);};
 const name=(id:string)=>rap.players.find((p:any)=>p.id===id)?.short??id;
 say(`plan switch trace ps1: ${t.id} + RAP losing from 5:00 -> Direct in 2-2 (formation change)`);
 say(`engine build ${c.engineBuild}; dropped ${JSON.stringify(c.dropped)}; ${ms} ms; final score ${c.compact.score.join('-')}`);
 say(`RAP five (1-2-1 slots 1-5): ${L5.map((id,i)=>`${i+1}:${name(id)}(${rap.players.find((p:any)=>p.id===id).roles.join('/')})`).join(' ')}`);
 say(`plan B's own five (2-2): ${planB.map((id,i)=>`${i+1}:${name(id)}`).join(' ')}; slot map (new slot by lineup slot, 0-based): ${JSON.stringify(slots)}`);
 say(`switch to: ${JSON.stringify(sw.switches[0]?.tactics)} slots ${JSON.stringify(sw.switches[0]?.slots??null)}`);
 if(!e){say('NO SWITCH EVENT');return out;}
 say(`goals: ${events.filter(x=>x.k==='goal').map(x=>`${clock(x.t)} side ${x.s}`).join(', ')}`);
 say(`stoppage before it: ${JSON.stringify(events[k-1])}`);
 say(`the marker (replay event): ${JSON.stringify(e)}`);
 const f=frames.find(x=>x.t>=e.t);say(`first frame at/after it: t=${clock(f!.t)} dead ball r=${f!.r??0} score ${f!.s.join('-')}`);
 say(`switchNotes: ${JSON.stringify((c.compact as any).switchNotes)}`);
 say(`header teams (unchanged): ${JSON.stringify(c.compact.header.teams.map(x=>({code:x.code,formation:x.formation,style:x.style})))}`);
 const roleOf=new Map((e.sw?.ro??[]).map(([i,r])=>[i,r]));
 // Each RAP outfielder's mean distance from his own goal line, without the ball, before and after (a reading).
 const where=(fr:any,i:number)=>{const at=fr.l?fr.l.indexOf(i):i;return at<0?null:fr.p[at];};
 for(const i of [1,2,3,4]){
  const p=c.compact.header.players.find(q=>q.i===i)!;
  const depth=(lo:number,hi:number)=>{const xs=frames.filter(x=>x.t>=lo&&x.t<hi&&!x.r&&x.ps!==0).map(x=>where(x,i)).filter(Boolean).map((q:any)=>q[0]/100);return xs.length?(xs.reduce((a:number,b:number)=>a+b,0)/xs.length).toFixed(1):'-';};
  const lanes=(lo:number,hi:number)=>{const ys=frames.filter(x=>x.t>=lo&&x.t<hi&&!x.r).map(x=>where(x,i)).filter(Boolean).map((q:any)=>q[1]/100);return ys.length?(ys.reduce((a:number,b:number)=>a+b,0)/ys.length).toFixed(1):'-';};
  say(`  ${p.short}: ${p.role} -> ${roleOf.get(i)??'(same)'}; depth without the ball ${depth(0,e.t)} m before, ${depth(e.t,1e9)} m after; mean y ${lanes(0,e.t)} -> ${lanes(e.t,1e9)} (pitch ${PITCH} m)`);
 }
 return out;
}
