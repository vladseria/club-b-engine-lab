// Squad fit (2026-10-19): one match of one arm, through exactly the runMatch call computeMatch makes for sides with
// no ideas and no substitution orders (the deep-study row, ../2026-10-12-deep-study/deep.ts: coordinated, substitutions
// none, record:true; its official block reproduces computeMatch's row). Evidence only.
//
// Arm  <squad>.<plan>~<opp>
//   squad  avg | h1..h8 (squads.ts ARCHETYPES), plan dir | bal | sho | p1..p8 (squads.ts PLANS)
//   opp    dir | bal | sho : the average squad on that plan (Direct / Balanced / Short combinations, 1-2-1)
//          MEN | MAL       : a real league side exactly as frozen at its lock (../2026-10-09-scenarios/sides, md5 in
//                            CHECKSUMS.json; neither has ideas or substitution orders, so the call is computeMatch's)
// Our side = seed % 2 (home and away), kick-off = (seed >> 1) % 2: every 4 seeds cover both sides x both kick-offs,
// and seed s is the same match set-up for every arm (paired seeds).
//
// The row: deep.ts's (official score, chances, per-shot rows, stats; agg[side] mechanism keys, documented there;
// x.lr / x.pl dropped, x.mv per shot kept) plus
//   sq     {ours, squad, plan, opp}
//   en[side]   mean outfield energy of the five on the pitch at the end of each minute 1..15
//   pace[side] mean outfield top speed (m/s) actually reached per 5-minute period [0-5, 5-10, 10-15]
import {readFileSync} from 'node:fs';
import {play as deepPlay} from '../2026-10-12-deep-study/deep';
import {side,ARCHETYPES,PLANS} from './squads';

const REAL=['MEN','MAL'];
const BASIC=['dir','bal','sho'];
const cache:Record<string,any>={};
function real(code:string){
 if(!cache[code])cache[code]=JSON.parse(readFileSync(new URL(`../../2026-10-09-scenarios/sides/${code}.jsonb.txt`,import.meta.url),'utf8'));
 const s=structuredClone(cache[code]);delete s.voice;return s;
}
export function parseArm(arm:string){
 const m=/^([a-z0-9]+)\.([a-z0-9]+)~([A-Za-z]+)$/.exec(arm);if(!m)throw Error('bad arm '+arm);
 const [,squad,plan,opp]=m;
 if(!ARCHETYPES[squad])throw Error('unknown squad '+squad);if(!PLANS[plan])throw Error('unknown plan '+plan);
 if(!REAL.includes(opp)&&!BASIC.includes(opp))throw Error('unknown opponent '+opp);
 return {squad,plan,opp};
}
export const armTreatment=parseArm;
function sidesOf(arm:string,seed:number){
 const {squad,plan,opp}=parseArm(arm),ours=seed%2;
 const us=side('SQD','#3fd38a',squad,plan);
 const them=REAL.includes(opp)?real(opp):side('OPP','#d33f6a','avg',opp);
 const sides=[null,null] as any[];sides[ours]=us;sides[1-ours]=them;
 return sides;
}

function extra(R:any){
 const roster:{id:string;side:number;role:string}[]=R.players,frames:any[]=R.frames;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100;
 const en:number[][]=[],pace:number[][]=[];
 for(const s of [0,1]){
  const ids=roster.map((p,i)=>({i,p})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i);
  en.push(Array.from({length:15},(_,m)=>{const f=frames[frameAt(60*(m+1))];let e=0,c=0;for(const i of ids){const p=pos(f,i);if(p){e+=p.energy;c++;}}return r1(c?e/c:0);}));
  const top=[[0,0,0,0],[0,0,0,0],[0,0,0,0]];// per period: per player max speed, averaged
  const mx=new Map<string,number>();
  for(let k=0;k<n;k++){const f=frames[k];if(f.cut||f.restart)continue;const q=f.time<300?0:f.time<600?1:2;
   for(const i of ids){const p=pos(f,i);if(!p)continue;const v=Math.hypot(p.vx,p.vy),key=q+':'+i;if(v>(mx.get(key)??0))mx.set(key,v);}}
  for(const [key,v] of mx){const q=Number(key.split(':')[0]);top[q][0]+=v;top[q][1]++;}
  pace.push(top.map(t=>t[1]?r2(t[0]/t[1]):0));
 }
 return {en,pace};
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const sq=parseArm(t.arm);
 const row:any=deepPlay(t,(R:any)=>extra(R),{base:'base',input:(inp:any)=>{inp.sides=sidesOf(t.arm,t.seed);}});
 row.sq={ours:t.seed%2,...sq};
 row.en=row.st.en;row.pace=row.st.pace;delete row.st;
 for(const a of row.agg){delete a.x.lr;delete a.x.pl;}
 return row;
}
/** The frozen input of an arm (for traces and the renderer). */
export function inputOf(arm:string,seed:number){
 return {v:1,match:`skill-${seed}`,seed,kickoff:((seed>>1)%2) as 0|1,duration:900,sides:sidesOf(arm,seed)};
}
