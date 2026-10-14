// Beat-direct probes (2026-10-14, scratch): one row per match = the deep-study row (./deepx.ts: deep.ts with the probe arms)
// plus st[side] = {r1: the R1 combine's keys (../2026-10-14-r1/sit.ts r1Keys: long balls into the final third, clean, shots,
// passes...), pb: the probe keys below}. Evidence only; reads the recorded match.
//
// pb[side] (side = the side WITH the ball, attacking the other side's goal; per match):
//  rb    receptions of a pass by this side in the opponents' half (receiver < 24 m from their goal), by where the receiver
//        is against their deepest outfielder at that moment: [behind him, 0-4 m in front, 4 m+ in front], each
//        [n, shots, clear chances, goals] within 8 s (cut at the next opponent possession or restart)
//  rbL   the same for long balls only (the received pass lofted, or 15 m+ on the ground)
//  u1 / u1L  receptions (all / long) with an opposing outfielder within 1 m of the receiver: [n, shots, clear, goals]
//  line  frames every 0.25 s with this side on the ball in the opponents' half (no restart): [n, sum of their deepest
//        outfielder's distance from his goal, sum of our most advanced outfielder's distance from their goal]
//  job   this side's defenders' seconds (out of possession, from the job choices): [P1 'hold them in front' seconds,
//        P3 'man up' seconds, seconds on any marking job]
//  up    this side's open-play regains (a spell not begun by a restart) with a man up at the moment of the regain:
//        [regains, the man up received the ball within 8 s in the spell, shots, clear chances, goals within 12 s in the spell]
//  noUp  the same for regains without a man up: [regains, -, shots, clear, goals]
//  lb    (P1 retry) one entry per open-play long ball by this side aimed into the final third (lofted or 15 m+, gaining 5 m+,
//        named target): [aim beyond their deepest outfielder (m from their goal; negative = behind him), the target's nearest
//        goal-side defender at the pass (m; -1 = nobody goal-side), the target's marker (job target) was on a P1 job (1/0),
//        first touch theirs (1/0), the target received it behind their deepest outfielder (1/0)]
//  conc  goals conceded: [all, with a man of ours up at any moment in the 10 s before the goal]
// Clear chance = a shot whose table rate is >= 0.30 (the official row's per-shot chance, matched to the engine's shot
// events in order).
import {play as deepPlay,armTreatment} from './deepx';
import {r1Keys} from '../2026-10-14-r1/sit';
export {armTreatment};
const L=48,CLEAR=.3;
const depthOf=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
function probeKeys(R:any,shotRows:any[]){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const n=frames.length,end=frames[n-1]?.time??900;
 const frameAt=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const outfield=(s:number)=>roster.map((p:any,i:number)=>({p,i})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i);
 // shots with exact time and chance (official rows in the same order as the engine's shot events)
 const shotEv=events.filter((e:any)=>e.kind==='shot'&&(e.side===0||e.side===1));
 const shots=shotEv.map((e:any,k:number)=>({t:e.time,s:e.side,ch:shotRows.length===shotEv.length?shotRows[k][1]:0,goal:shotRows.length===shotEv.length?shotRows[k][8]:0}));
 const goals=events.filter((e:any)=>e.kind==='goal'&&(e.side===0||e.side===1));
 // possession by frame (control or ball owner; a restart counts for its side)
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 // the end of this side's possession after t: the first frame the other side has it (or a restart for it)
 const lostAfter=(s:number,t:number)=>{for(let k=frameAt(t)+1;k<n;k++){if(poss[k]===1-s)return frames[k].time;}return end;};
 const window=(s:number,t0:number,t1:number)=>{let sh=0,cl=0,gl=0;for(const x of shots)if(x.s===s&&x.t>t0+1e-6&&x.t<=t1+1e-6){sh++;if(x.ch>=CLEAR)cl++;if(x.goal)gl++;}return [sh,cl,gl];};
 const mk=()=>({rb:[[0,0,0,0],[0,0,0,0],[0,0,0,0]],rbL:[[0,0,0,0],[0,0,0,0],[0,0,0,0]],u1:[0,0,0,0],u1L:[0,0,0,0],line:[0,0,0],job:[0,0,0],up:[0,0,0,0,0],noUp:[0,0,0,0,0],conc:[0,0],lb:[] as number[][]});
 const P=[mk(),mk()];
 const add=(a:number[],b:number[])=>{a[0]++;for(let j=0;j<3;j++)a[j+1]+=b[j];};
 // receptions
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='receive'||(e.side!==0&&e.side!==1))continue;
  const s=e.side,D=1-s,ri=idx.get(e.actor);if(ri===undefined)continue;
  const f=frames[frameAt(e.time)],rq=pos(f,ri);if(!rq)continue;
  const dr=depthOf(D,rq.x);if(dr>=24)continue;
  const defs=outfield(D).map((i:number)=>pos(f,i)).filter(Boolean);if(!defs.length)continue;
  const lastDef=Math.min(...defs.map((d:any)=>depthOf(D,d.x))),rel=dr-lastDef,band=rel<0?0:rel<4?1:2;
  const near=Math.min(...defs.map((d:any)=>dist(d,rq)));
  // the pass he received: the side's last pass to him within 5 s
  let pass:any=null;for(let r=q-1;r>=0&&events[r].time>e.time-5;r--){const x=events[r];if(x.kind==='pass'&&x.side===s){pass=x.target===e.actor?x:null;break;}}
  let long=false;
  if(pass){const f0=frames[frameAt(pass.time)],pi=idx.get(pass.actor),pp=pi!==undefined?pos(f0,pi):null,aim=pass.pass?.aim??pass.aerial?.aim;long=!!pass.aerial||!!pass.pass?.lofted||(!!pp&&!!aim&&dist(pp,aim)>=15);}
  const out=window(s,e.time,Math.min(e.time+8,lostAfter(s,e.time)));
  add(P[s].rb[band],out);if(long)add(P[s].rbL[band],out);
  if(near<1){add(P[s].u1,out);if(long)add(P[s].u1L,out);}
 }
 // the line while this side has the ball in the opponents' half
 let next=0;
 for(let k=0;k<n;k++){const f=frames[k];if(f.time<next-1e-9)continue;next=f.time+.25;
  if(f.restart)continue;const o=f.control?.owner??f.ball?.owner;if(!o)continue;const s=sideOf(o);if(s<0)continue;const D=1-s;
  if(depthOf(D,f.ball.x)>=24)continue;
  const defs=outfield(D).map((i:number)=>pos(f,i)).filter(Boolean),atk=outfield(s).map((i:number)=>pos(f,i)).filter(Boolean);if(!defs.length||!atk.length)continue;
  const l=P[s].line;l[0]++;l[1]+=Math.min(...defs.map((d:any)=>depthOf(D,d.x)));l[2]+=Math.min(...atk.map((a:any)=>depthOf(D,a.x)));
 }
 // job seconds and the man-up intervals, from the job choices (each choice holds until the player's next one)
 const by=new Map<number,any[]>();for(const c of choices){const a=by.get(c.player)??[];a.push(c);by.set(c.player,a);}
 const upIv:[number,number,number][]=[];// [side, from, to] of a man up
 const upAt=(s:number,t:number)=>{for(const [ss,a,b] of upIv)if(ss===s&&a<=t+1e-6&&b>t+1e-6)return true;return false;};
 const upWho=(s:number,t:number)=>{for(const [i,a] of by){if(roster[i].side!==s)continue;let c:any=null;for(const x of a){if(x.time<t-1e-6)c=x;else break;}if(c&&String(c.reason??'').startsWith('[P3]'))return roster[i].id;}return null;};
 for(const [i,a] of by){
  const s=roster[i].side;
  for(let k=0;k<a.length;k++){const c=a[k],t1=k+1<a.length?a[k+1].time:end,dt=Math.max(0,t1-c.time),why=String(c.reason??'');
   if(why.startsWith('[P1]'))P[s].job[0]+=dt;
   if(why.startsWith('[P3]')){P[s].job[1]+=dt;upIv.push([s,c.time,t1]);}
   if(c.assignment?.purpose==='mark')P[s].job[2]+=dt;}
 }
 // (P1 retry) long balls into the final third: the gap at the pass, the marker's job, the first touch, the reception
 const latestOf=(i:number,t:number)=>{let c:any=null;for(const x of by.get(i)??[]){if(x.time<=t+1e-6)c=x;else break;}return c;};
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const s=e.side,D=1-s,f=frames[frameAt(e.time)],pi=idx.get(e.actor),ti=idx.get(e.target);if(pi===undefined||ti===undefined)continue;
  const p=pos(f,pi),tq=pos(f,ti),aim=e.pass?.aim??e.aerial?.aim;if(!p||!tq||!aim)continue;
  const len=dist(p,aim);if(!(e.aerial||e.pass?.lofted||len>=15)||depthOf(s,aim.x)<32||depthOf(s,aim.x)-depthOf(s,p.x)<5)continue;
  const di=outfield(D),defs=di.map((i:number)=>pos(f,i)).filter(Boolean);if(!defs.length)continue;
  const lastDef=Math.min(...defs.map((d:any)=>depthOf(D,d.x)));
  const gs=defs.filter((d:any)=>depthOf(D,d.x)<depthOf(D,tq.x)).map((d:any)=>dist(d,tq));
  const mk=di.find((i:number)=>latestOf(i,e.time)?.assignment?.target===e.target);
  const onP1=mk!==undefined&&String(latestOf(mk,e.time)?.reason??'').startsWith('[P1]')?1:0;
  let theirs=0,recvBehind=0;
  for(let k=frameAt(e.time)+1;k<n&&frames[k].time<=e.time+4;k++){const g=frames[k];if(g.restart)break;const o=g.ball?.owner;if(!o||(o===e.actor&&g.time<e.time+.3))continue;
   if(sideOf(o)===D)theirs=1;else if(o===e.target){const z=pos(g,ti),dd=outfield(D).map((i:number)=>pos(g,i)).filter(Boolean);if(z&&dd.length&&depthOf(D,z.x)<Math.min(...dd.map((d:any)=>depthOf(D,d.x))))recvBehind=1;}
   break;}
  P[s].lb.push([Math.round((depthOf(D,aim.x)-lastDef)*10)/10,gs.length?Math.round(Math.min(...gs)*100)/100:-1,onP1,theirs,recvBehind]);
 }
 // regains
 for(let k=1;k<n;k++){
  const s=poss[k];if(s<0||poss[k-1]===s||poss[k-1]<0||frames[k].restart)continue;
  const t0=frames[k].time;let j=k;while(j+1<n&&poss[j+1]===s)j++;const t1=frames[j].time;
  const who=upWho(s,t0),w=window(s,t0-1e-3,Math.min(t1,t0+12));
  if(who){const u=P[s].up;u[0]++;if(events.some((x:any)=>x.kind==='receive'&&x.actor===who&&x.time>=t0-1e-6&&x.time<=Math.min(t1,t0+8)))u[1]++;u[2]+=w[0];u[3]+=w[1];u[4]+=w[2];}
  else{const u=P[s].noUp;u[0]++;u[2]+=w[0];u[3]+=w[1];u[4]+=w[2];}
 }
 for(const g of goals){const s=1-g.side;P[s].conc[0]++;if(upIv.some(([ss,a,b])=>ss===s&&a<=g.time+1e-6&&b>=g.time-10))P[s].conc[1]++;}
 for(const p of P){p.job=p.job.map(v=>Math.round(v*10)/10);p.line=[p.line[0],Math.round(p.line[1]*10)/10,Math.round(p.line[2]*10)/10];}
 return {P,shotsMatched:shotRows.length===shotEv.length};
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 let raw:any=null,k1:any=null;
 const row:any=deepPlay(t,(R:any)=>{raw=R;if((globalThis as any).__keepR)(globalThis as any).__R=R;k1=r1Keys(R);return null;});
 const {P,shotsMatched}=probeKeys(raw,row.shots);
 row.st=[0,1].map(s=>({r1:k1[s],pb:P[s]}));row.shotsMatched=shotsMatched;
 return row;
}
