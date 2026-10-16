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
 let X:any=null,S:any=null,D:any=null;
 const row:any=deepPlay(t,R=>{
  X=strikerExtra(R);D=deepKeys(R);
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
 row.dp=D;
 return row;
}

// dp[side] (added for the fix2 round): the bug's own measure. Every 0.2 s of open play with this side on the ball IN
// THEIR HALF (ball depth >= 24): [frames, frames the lead forward stands in our half (depth < 24), within 12 m of our goal,
// deeper than every outfield team-mate], plus jobs{purpose: frames} while he stands in our half. Lead forward here = the
// ST, or in a formation without one the further-forward W/AM at that frame (no hysteresis; deepjobs.ts used the ST only).
function deepKeys(R:any){
 const roster:any[]=R.players,L=48;
 const chBy=new Map<number,any[]>();for(const c of R.choices){const a=chBy.get(c.player)??[];a.push(c);chBy.set(c.player,a);}
 const at=(i:number,time:number)=>{const a=chBy.get(i)??[];let lo=0,hi=a.length-1,b=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){b=m;lo=m+1;}else hi=m-1;}return b>=0?a[b]:null;};
 const out=[0,1].map(()=>({n:[0,0,0,0],jobs:{} as Record<string,number>}));
 const out_=[0,1].map(s=>roster.map((p:any,i:number)=>({p,i})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK'));
 let next=0,last=-1;
 for(const f of R.frames){
  const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);
  if(o){const p=roster.find((q:any)=>q.id===o);if(p)last=p.side;}
  if(f.time<next-1e-9)continue;next=f.time+.2;
  if(f.restart||last<0||f.lineup)continue;
  const s=last,depth=(x:number)=>s===0?x:L-x;
  if(depth(f.ball.x)<24)continue;
  const mates=out_[s],st=mates.find((x:any)=>x.p.role==='ST');
  const lead=st??mates.filter((x:any)=>['W','AM'].includes(x.p.role)).sort((a:any,b:any)=>depth(f.players[b.i].x)-depth(f.players[a.i].x))[0];
  if(!lead)continue;
  const d=depth(f.players[lead.i].x),k=out[s];k.n[0]++;
  if(d>=24)continue;k.n[1]++;if(d<12)k.n[2]++;
  if(mates.every((x:any)=>x.i===lead.i||depth(f.players[x.i].x)>d))k.n[3]++;
  const c=at(lead.i,f.time),j=c?.assignment?.purpose??c?.kind??'-';k.jobs[j]=(k.jobs[j]??0)+1;
 }
 return out;
}
