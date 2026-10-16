// Striker outlet (2026-10-17): one row per match = the striker study's row (../2026-10-16-striker/striker.ts: the deep-study
// row + st.k, what each side's LEAD FORWARD did, shots joined as there) plus `sit[side]`, the R1 situation checks
// (../2026-10-14-r1/sit.ts: the support study's sup keys + r1 keys; build-up forward options noFwd, outfielders on our own
// goal line own3Two, passes to nobody selfDefl, keeper recycles toKeeper / gkCarryBack). Evidence only: reads the record.
// The support study's `ex` (worst examples) and per-purpose `jobs` are dropped to keep rows small.
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {extra as strikerExtra} from '../2026-10-16-striker/striker';
import {extra as supportExtra} from '../2026-10-14-support-study/support';
import {r1Keys} from '../2026-10-14-r1/sit';
export {armTreatment};

const r2=(v:number)=>Math.round(v*100)/100;

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 let X:any=null,S:any=null;
 const row:any=deepPlay(t,R=>{
  X=strikerExtra(R);
  const A:any[]=supportExtra(R),k=r1Keys(R);
  S=A.map((a:any,s:number)=>{const o:any={...a,r1:k[s]};delete o.ex;delete o.jobs;return o;});
  return null;
 });
 delete row.st;
 for(const a of row.agg){delete a.x.mv;delete a.x.lr;delete a.x.pl;}
 // the striker study's shot join (striker.ts play), unchanged
 const k:any[]=[0,1].map(()=>({sh:[0,0,0,0],osh:[0,0,0,0],thru:[0,0]}));
 const off=row.shots as any[],per=[X.K[0].shots.slice(),X.K[1].shots.slice()],timed:{s:number;t:number;ch:number}[]=[];
 let ok=true;
 for(const s of off){const f=per[s[0]].shift();if(!f){ok=false;break;}const tgt=f[1]?k[s[0]].sh:k[s[0]].osh;tgt[0]++;if(s[1]>=.3)tgt[1]++;tgt[2]+=s[8];tgt[3]+=s[1];timed.push({s:s[0],t:f[3],ch:s[1]});}
 if(per[0].length||per[1].length)ok=false;
 for(const x of timed)if(X.receipts.some((r:any)=>x.s===r.s&&x.t>r.t+1e-6&&x.t<=r.end+1e-6)){k[x.s].thru[0]++;if(x.ch>=.3)k[x.s].thru[1]++;}
 row.st={k:X.K.map((a:any,s:number)=>{const o:any={...a};delete o.shots;o.pos=a.pos.map(r2);o.posTh=a.posTh.map(r2);o.sh=k[s].sh.map(r2);o.osh=k[s].osh.map(r2);o.thru=k[s].thru;return o;}),shotsJoined:ok,lead:X.lead};
 row.sit=S;
 return row;
}
