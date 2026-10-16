// Striker options (2026-10-16): the deep-study row (../2026-10-12-deep-study/deep.ts, official fields and agg unchanged)
// plus `st.k[side]`, what the side's LEAD FORWARD did. Evidence only: reads the record, changes nothing.
//
// The lead forward is the engine's own definition (practice-coordination.ts leadForward, replicated on the recorded
// frames): the ST where the formation has one, otherwise (2-2) the more advanced winger; the incumbent keeps the role
// until another forward has been 2 m further forward for 1.5 s; afresh after a restart or a change of possession.
// "Last line" = their deepest outfielder (keeper excluded). rel = his depth - that defender's depth (m; > 0 = beyond).
// Depth = metres from the side's own goal (0..48).
//
// st.k[side] keys (per match, that side):
//  wb     open-play frames with the ball, sampled every 0.2 s
//  pos    with the ball: [sum rel, frames beyond the last line (rel > 0.5), on it (|rel| <= 2), between the lines (rel <= -3 and
//         >= 2 m ahead of the ball), level with or behind the ball (his depth <= ball depth + 2), in our half (depth < 24),
//         in their box (depth >= 40, |y| < 8), sum of his depth]  (frames; the analysis divides by wb)
//  posTh  the same rel sum and frame count with the ball in their half only: [sum rel, frames, beyond, between]
//  job    with the ball: frames on [shoulder|depth, pivot, link|channel, break, build-up|outlet|receive-short (support), other]
//  rec    receptions by the lead forward (open-play receive events; lead forward = at the pass, or at the receipt if no pass):
//         [all, beyond the last line as it stood when the pass was played (rel at the pass > 0 at his receipt spot), between the
//         lines (rel <= -3, beyond the passer by 2 m+), in our half (receipt depth < 24), team receptions (all), in their box]
//  build  our open-play passes from our half (passer depth < 24): [n, to the lead forward]
//  touch  [receptions, passes, shots, dribble/feint events] by the lead forward (open play and restarts alike)
//  thru   team shots (each counted once) that came within 8 s of a reception by him and before the other side had the ball:
//         [shots, clear chances (table >= 0.3)]
//  shots  per team shot, in event order: [side, 1 if the lead forward took it, 1 if the other forward (2-2 / 1-2-1 winger) took it]
//         -> joined with the official shot list in play(): k.sh = [his shots, clear, goals, good(sum)], k.osh the same for the
//            rest of the team
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
export {armTreatment};

const L=48,DT=.2,MARGIN=2,HOLD=1.5;
const r2=(v:number)=>Math.round(v*100)/100;

export function extra(R:any){
 const roster:{id:string;side:number;role:string}[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const depth=(s:number,x:number)=>s===0?x:L-x;
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const outIds=[0,1].map(s=>roster.map((p,i)=>({i,p})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i));
 const pool=[0,1].map(s=>{const st=outIds[s].filter(i=>roster[i].role==='ST');return st.length?st:outIds[s].filter(i=>roster[i].role==='W'||roster[i].role==='AM');});
 const fwds=[0,1].map(s=>outIds[s].filter(i=>['ST','W','AM'].includes(roster[i].role)));
 const jobsBy=new Map<number,any[]>();
 for(const ch of choices){const a=jobsBy.get(ch.player)??[];a.push(ch);jobsBy.set(ch.player,a);}
 const purposeAt=(i:number,time:number):string|null=>{const a=jobsBy.get(i);if(!a)return null;let lo=0,hi=a.length-1,best=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best>=0?(a[best].assignment?.purpose??a[best].kind??null):null;};
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 // lead forward per frame and side (leadForward with its hysteresis)
 const lead=[new Int16Array(n),new Int16Array(n)];
 const state:any[]=[null,null];
 for(let k=0;k<n;k++){
  const f=frames[k],t=f.time;
  if(f.restart||(k>0&&poss[k]!==poss[k-1])){state[0]=null;state[1]=null;}
  for(const s of [0,1]){
   const P=pool[s].map(i=>({i,q:pos(f,i)})).filter(x=>x.q);
   if(!P.length){lead[s][k]=-1;continue;}
   if(P.length<2){lead[s][k]=P[0].i;state[s]={id:P[0].i};continue;}
   const ranked=P.slice().sort((a,b)=>depth(s,b.q.x)-depth(s,a.q.x)||roster[a.i].id.localeCompare(roster[b.i].id));
   const prev=state[s],inc=P.find(x=>x.i===prev?.id),best=ranked[0];
   let nx:any;
   if(!inc)nx={id:best.i};
   else if(best.i===inc.i||depth(s,best.q.x)-depth(s,inc.q.x)<MARGIN)nx={id:inc.i};
   else{const since=prev.challenger===best.i&&prev.since!==undefined?prev.since:t;nx=t-since>=HOLD?{id:best.i}:{id:inc.i,challenger:best.i,since};}
   state[s]=nx;lead[s][k]=nx.id;
  }
 }
 const lastLine=(f:any,s:number)=>{let m=-1;for(const i of outIds[1-s]){const q=pos(f,i);if(q)m=Math.max(m,depth(s,q.x));}return m;};
 const mk=()=>({wb:0,pos:[0,0,0,0,0,0,0,0],posTh:[0,0,0,0],job:[0,0,0,0,0,0],rec:[0,0,0,0,0,0],build:[0,0],touch:[0,0,0,0],shots:[] as number[][]});
 const K=[mk(),mk()];
 let next=0;
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.time<next-1e-9)continue;next=f.time+DT;
  if(f.restart||poss[k]<0)continue;
  const s=poss[k],a=K[s],li=lead[s][k];if(li<0)continue;const q=pos(f,li);if(!q)continue;
  const ll=lastLine(f,s);if(ll<0)continue;
  const d=depth(s,q.x),rel=d-ll,bd=depth(s,f.ball.x);
  a.wb++;a.pos[0]+=rel;if(rel>.5)a.pos[1]++;if(Math.abs(rel)<=2)a.pos[2]++;if(rel<=-3&&d>=bd+2)a.pos[3]++;if(d<=bd+2)a.pos[4]++;if(d<24)a.pos[5]++;if(d>=40&&Math.abs(q.y)<8)a.pos[6]++;a.pos[7]+=d;
  if(bd>=24){a.posTh[0]+=rel;a.posTh[1]++;if(rel>.5)a.posTh[2]++;if(rel<=-3&&d>=bd+2)a.posTh[3]++;}
  const j=purposeAt(li,f.time)??'';
  a.job[j==='shoulder'||j==='depth'?0:j==='pivot'?1:j==='link'||j==='channel'?2:j==='break'?3:['build-up','outlet','receive','prepare'].includes(j)?4:5]++;
 }
 // passes and receptions
 const lastPass=new Map<string,any>();
 const receipts:{s:number;t:number;end:number}[]=[];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.side!==0&&e.side!==1)continue;const s=e.side,a=K[s];
  const k=frameAt(e.time),li=lead[s][k];
  if(e.kind==='pass'){
   if(e.target)lastPass.set(e.target,e);
   if(idx.get(e.actor)===li)a.touch[1]++;
   if(!e.restartKind){const p=pos(frames[k],idx.get(e.actor)!);if(p&&depth(s,p.x)<24){a.build[0]++;if(e.target&&idx.get(e.target)===li)a.build[1]++;}}
  }
  if(e.kind==='shot'){const si=idx.get(e.actor);a.shots.push([s,si===li?1:0,si!==undefined&&si!==li&&fwds[s].includes(si)?1:0,e.time]);if(si===li)a.touch[2]++;}
  if((e.kind==='feint'||e.kind==='beat')&&idx.get(e.actor)===li)a.touch[3]++;
  if(e.kind==='receive'){
   const ri=idx.get(e.actor);if(ri===undefined)continue;
   const pe=lastPass.get(e.actor);const fromPass=pe&&pe.side===s&&e.time-pe.time<6?pe:null;
   const kp=fromPass?frameAt(fromPass.time):k,lp=lead[s][kp];
   a.rec[4]++;
   if(ri!==lp&&ri!==li)continue;
   a.touch[0]++;
   const fr=frames[k],me=pos(fr,ri);if(!me)continue;const d=depth(s,me.x);
   a.rec[0]++;
   const llPass=lastLine(frames[kp],s),llNow=lastLine(fr,s);
   if(fromPass&&d-llPass>0)a.rec[1]++;
   const passer=fromPass?pos(frames[kp],idx.get(fromPass.actor)!):null;
   if(d-llNow<=-3&&(!passer||d>=depth(s,passer.x)+2))a.rec[2]++;
   if(d<24)a.rec[3]++;
   if(d>=40&&Math.abs(me.y)<8)a.rec[5]++;
   let end=e.time+8;for(let q2=k+1;q2<n&&frames[q2].time<=end;q2++)if(poss[q2]!==s&&poss[q2]>=0){end=frames[q2].time;break;}
   receipts.push({s,t:e.time,end});
  }
 }
 return {K,receipts,lead:[0,1].map(s=>{const c:Record<string,number>={};for(let k=0;k<n;k+=10){const i=lead[s][k];if(i>=0)c[roster[i].id]=(c[roster[i].id]??0)+1;}return c;})};
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 let X:any=null;
 const row:any=deepPlay(t,R=>{X=extra(R);return null;});
 delete row.st;
 for(const a of row.agg){delete a.x.mv;delete a.x.lr;delete a.x.pl;}
 // join the per-shot flags with the official shot list (official rows are in engine event order across both sides)
 const k:any[]=[0,1].map(()=>({sh:[0,0,0,0],osh:[0,0,0,0],thru:[0,0]}));
 const off=row.shots as any[],per=[X.K[0].shots.slice(),X.K[1].shots.slice()],timed:{s:number;t:number;ch:number}[]=[];
 let ok=true;
 for(const s of off){const f=per[s[0]].shift();if(!f){ok=false;break;}const tgt=f[1]?k[s[0]].sh:k[s[0]].osh;tgt[0]++;if(s[1]>=.3)tgt[1]++;tgt[2]+=s[8];tgt[3]+=s[1];timed.push({s:s[0],t:f[3],ch:s[1]});}
 if(per[0].length||per[1].length)ok=false;
 // thru: team shots / clear chances after a lead-forward reception, within 8 s and before the other side has it
 for(const x of timed)if(X.receipts.some((r:any)=>x.s===r.s&&x.t>r.t+1e-6&&x.t<=r.end+1e-6)){k[x.s].thru[0]++;if(x.ch>=.3)k[x.s].thru[1]++;}
 row.st={k:X.K.map((a:any,s:number)=>{const o:any={...a};delete o.shots;o.pos=a.pos.map(r2);o.posTh=a.posTh.map(r2);o.sh=k[s].sh.map(r2);o.osh=k[s].osh.map(r2);o.thru=k[s].thru;return o;}),shotsJoined:ok,lead:X.lead};
 return row;
}
