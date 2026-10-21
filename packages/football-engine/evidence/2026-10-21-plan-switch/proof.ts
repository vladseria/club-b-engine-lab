// Plan switch proof (owner's ask, 21 Oct): does changing plans change how the side plays? Two real-shaped official
// matches through the app's own path (lib/ballers/compute.ts computeMatch: engineTeam, sideSwitches, runMatch, compact),
// 900 s, the same seed: SHO (Short = combinations, 1-2-1) against BAL (Balanced, 2-2), two neutral fives (every outfielder
// the same card, every keeper the same card). SHO carries a switch: losing, from 5:00, to a Direct plan in 2-2. Its twin
// is the same input without the switch. The seed is the first of 1..MAX_SEEDS whose switch fires between 5:00 and 10:00,
// so the match has at least five minutes on each side of it; each tried seed plays one match, the chosen one two.
// Played on the public lab (one shard, one worker) through proof-run.mjs, which writes results/proof.jsonl.
import {computeMatch,type FrozenInput,type FrozenSide} from '../../../../lib/ballers/compute';
import {PRESETS} from '../../../../lib/ballers/league';

/** The SQL rule (private.ballers_switch_slots), as trace-ps1.ts mirrors it (copied: importing that file runs its loader). */
function slotMap(lineup:string[],toLineup:string[],formation:'1-2-1'|'2-2',players:{id:string;roles:string[];number:number}[]):number[]{
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

export const MAX_SEEDS=12;
const card=(gk:boolean)=>({passing:gk?4:6,control:gk?4:6,finishing:gk?2:6,defending:6,pace:6,strength:6,stamina:6,reading:6,aerial:6,setPieces:5,keeping:gk?7:1});
// GK, CB, W, W, ST (1-2-1's slots), then a bench: a CB, a W, an ST, a keeper. Roles first preferred.
const ROLES=[['GK'],['CB','W'],['W','CB'],['W','ST'],['ST','W'],['CB','W'],['W','ST'],['ST','W'],['GK']];
function side(code:string,name:string,color:string,formation:FrozenSide['formation'],style:keyof typeof PRESETS):FrozenSide{
 const players=ROLES.map((roles,n)=>({id:`${code.toLowerCase()}00000-0000-4000-8000-00000000000${n}`,name:`${name} ${n+1}`,short:`${code}${n+1}`,number:n+1,
  roles:roles as FrozenSide['players'][0]['roles'],skills:card(roles[0]==='GK'),traits:{risk:.5,dribble:.5,runs:.5,comesShort:.5,engagement:.5,discipline:.8},
  energy:100,archetype:'motor',temperament:'cold',note:'',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${code.toLowerCase()}-club`,name,code,color},formation,style,approach:{...(PRESETS as any)[style]},captain:lineup[1],
  lineup,bench:players.slice(5).map(p=>p.id),players,plans:[]} as unknown as FrozenSide;
}

/** The two inputs for a seed: [with the switch, the twin without it]. */
export function inputs(seed:number):[FrozenInput,FrozenInput]{
 const make=(withSwitch:boolean):FrozenInput=>{
  const sho=side('SHO','Short','#FF3D7F','1-2-1','combinations'),bal=side('BAL','Balanced','#3DA5FF','2-2','balanced');
  if(withSwitch){
   // Plan B's own five as the SQL would resolve it (DESIGN §2.4): the keeper, the centre-back and the two wingers at 2-2's
   // slots 1, 3 and 4, the bench centre-back at 2; the striker is the man plan B doesn't place, and the fill-in rule
   // (private.ballers_switch_slots, mirrored by slotMap) puts him in the free slot.
   const L5=sho.lineup,planB=[L5[0],L5[1],sho.bench[0],L5[2],L5[3]];
   (sho as any).switch={id:'sw',trigger:{kind:'score',state:'losing'},notBefore:300,
    to:{plan:'proof-direct-2-2',style:'direct',approach:{...(PRESETS as any).direct},settings:{},formation:'2-2',slots:slotMap(L5,planB,'2-2',sho.players as any)}};
  }
  return {v:1,match:`proof-${seed}`,seed,kickoff:0,duration:900,sides:[sho,bal]} as FrozenInput;
 };
 return [make(true),make(false)];
}

export function runProof(){
 const tried:{seed:number;fired:number|null;score:[number,number]}[]=[];
 for(let seed=1;seed<=MAX_SEEDS;seed++){
  const [a,b]=inputs(seed);
  const c=computeMatch(a);
  const e=c.compact.chunks.flatMap(ch=>ch.e).find(x=>x.k==='switch');
  tried.push({seed,fired:e?e.t:null,score:c.compact.score});
  if(e&&e.t>=300000&&e.t<=600000){
   const twin=computeMatch(b);
   return {seed,tried,with:{input:a,compact:c.compact,dropped:c.dropped,engineBuild:c.engineBuild},without:{input:b,compact:twin.compact,dropped:twin.dropped,engineBuild:twin.engineBuild}};
  }
 }
 return {seed:null,tried};
}
