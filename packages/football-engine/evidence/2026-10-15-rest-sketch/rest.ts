// Rest-defence sketch (2026-10-15, branch ballers-rest-sketch: Tactics.leaveUp + Tactics.restDefence on ballers-rest-defence
// 15c49f16 = ballers-contest 4357ec90, engine d58f7153). One row per match. Evidence only; reads the recorded match.
//
// The row: the deep-study row (../2026-10-12-deep-study/deep.ts: official fields + agg, the official runMatch call), and
// st[side] = {tr: the audit's trace keys (../2026-10-15-rest-defence/trace.ts traceKeys), rs: the keys below}.
//
// Arms: any mirror arm (../2026-10-10-cloud-measure/mirror.ts), optionally with modifiers `~<mod>`; the treated side is
// seed % 2 (the first-named configuration), `o...` modifiers act on the OTHER side:
//   up | upon          treated side Tactics.leaveUp = 'always' | 'on'
//   safe | even | bold treated side Tactics.restDefence = 'safe' | 'even' | 'bold' (risk attitudes)
//   oup | oupon | osafe | oeven | obold   the same on the other side
//
// rs[side S] (S = the side in the role named):
//  upFr   [open-play frames sampled every 0.2 s with the other side on the ball, of those with an S man on the 'up' job]
//  upAt   while S has a man up (same samples): [n, sum of his depth from S's goal, sum of his distance ahead of the ball
//         (depth), sum of his speed (m/s), sum of the nearest opponent's distance to him, samples he moved < 0.3 m/s,
//         sum of the distance from the nearest opponent outfielder goal-side of him (their guard; -1 not counted)]
//  guards while the OTHER side has a man up and S has the ball (same samples): [k = 0..3 of S's outfielders on a rest
//         guard job ('Echilibru în atac'), as counts], rest [0..3 of S's outfielders >= 4 m goal-side of the ball]
//  turn   one entry per S open-play regain (possession passes to S between two non-restart frames):
//         [t, ball depth from S's goal, S had a man on 'up' (0/1), he had the ball in S's spell within 8 s (0/1),
//          the first S pass after the regain went to him (0/1), s to his first touch (-1), S shots <= 12 s,
//          S goals <= 12 s, the losers' men >= 4 m goal-side of the ball (their rest), S outfielders >= 4 m nearer the
//          losers' goal than the ball (the losers' "their men up"), the loss was in the losers' established attack
//          (ball >= 24 m from their goal) (0/1)]
//  stint  flip-flop check, from the recorded job choices of S's outfielders: up = the 'up' job, guard = a rest guard
//         ('Echilibru în atac'), each [stints, total s, stints under 1 s, stints starting within 2 s of the same
//         player's previous stint of that job ending, flips: stints under 1 s that ended inside the same phase (the
//         same side on the ball 0.5 s later, no restart between)]
import {play as deepPlay,armTreatment as mirrorArm} from '../2026-10-12-deep-study/deep';
import {traceKeys} from '../2026-10-15-rest-defence/trace';

const L=48,MARGIN=4;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const r1=(v:number)=>Math.round(v*10)/10;

const SET:Record<string,[string,string]>={up:['leaveUp','always'],upon:['leaveUp','on'],safe:['restDefence','safe'],even:['restDefence','even'],bold:['restDefence','bold']};
function parse(arm:string){
 const [base,...mods]=arm.split('~');
 for(const m of mods){const k=!SET[m]&&m.startsWith('o')?m.slice(1):m;if(!SET[k])throw Error('unknown modifier '+m);}
 return {base,mods};
}
export function armTreatment(arm:string){const {base}=parse(arm);return mirrorArm(base);}

export function restKeys(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const OF=[0,1].map(s=>roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i as number));
 const byPlayer=new Map<number,any[]>();
 for(const c of choices){const a=byPlayer.get(c.player)??[];a.push(c);byPlayer.set(c.player,a);}
 const jobAt=(i:number,t:number)=>{const a=byPlayer.get(i);if(!a)return null;let lo=0,hi=a.length-1,b=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=t+1e-6){b=m;lo=m+1;}else hi=m-1;}return b>=0?a[b]:null;};
 const purpose=(i:number,t:number)=>jobAt(i,t)?.assignment?.purpose??null;
 const isGuard=(i:number,t:number)=>{const c=jobAt(i,t);return c?.assignment?.purpose==='counter-cover'&&String(c.reason??'').startsWith('Echilibru în atac');};
 const n=frames.length;
 const owner=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=owner(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const goals=events.filter((e:any)=>e.kind==='goal');
 const shots=events.filter((e:any)=>e.kind==='shot');
 const D=[0,1].map(()=>({upFr:[0,0],upAt:[0,0,0,0,0,0,0,0],guards:[0,0,0,0],rest:[0,0,0,0],turn:[] as number[][],stint:{up:[0,0,0,0,0],guard:[0,0,0,0,0]}}));
 const end=frames.length?frames[frames.length-1].time:0;
 for(const [i,cs] of byPlayer){
  const S=roster[i].side,D0=D[S];if(roster[i].role==='GK')continue;
  for(const [key,is] of [['up',(c:any)=>c.assignment?.purpose==='up'],['guard',(c:any)=>c.assignment?.purpose==='counter-cover'&&String(c.reason??'').startsWith('Echilibru în atac')]] as [string,(c:any)=>boolean][]){
   let on=-1,lastEnd=-99;const st=(D0.stint as any)[key];
   // a flip: a stint under 1 s that ends while the same phase goes on (the side that had the ball 0.5 s later still has it, no restart)
   const phase=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
   const close=(t:number)=>{const d=t-on;st[0]++;st[1]+=d;if(d<1){st[2]++;const a=phase(on),b=phase(t+.5);if(poss[a]===poss[b]&&!frames.slice(a,b+1).some((f:any)=>f.restart))st[4]++;}on=-1;lastEnd=t;};
   for(const c of cs){if(is(c)){if(on<0){if(c.time-lastEnd<2)st[3]++;on=c.time;}}else if(on>=0)close(c.time);}
   if(on>=0)close(end);
   st[1]=r1(st[1]);
  }
 }
 let nextT=-1;
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.restart)continue;const o=owner(f);if(!o)continue;
  if(f.time<nextT-1e-6)continue;nextT=f.time+.2;
  const A=sideOf(o),S=1-A,bdS=depth(S,f.ball.x);
  D[S].upFr[0]++;
  const upI=OF[S].find(i=>purpose(i,f.time)==='up');
  if(upI!==undefined){
   const q=pos(f,upI);D[S].upFr[1]++;
   if(q){
    const u=D[S].upAt;u[0]++;u[1]+=depth(S,q.x);u[2]+=depth(S,q.x)-bdS;const v=Math.hypot(q.vx??0,q.vy??0);u[3]+=v;
    const opp=OF[A].map(i=>pos(f,i)).filter(Boolean);
    u[4]+=Math.min(...opp.map((p:any)=>dist(p,q)));if(v<.3)u[5]++;
    // their guard: the nearest of theirs goal-side of him (nearer their own goal = deeper from S's goal)
    const gs=opp.filter((p:any)=>depth(S,p.x)>depth(S,q.x));if(gs.length){u[6]+=Math.min(...gs.map((p:any)=>dist(p,q)));u[7]++;}
   }
   const owneri=idx.get(o)!;
   if(roster[owneri].role!=='GK'){
    D[A].guards[Math.min(3,OF[A].filter(i=>isGuard(i,f.time)).length)]++;
    const bdA=depth(A,f.ball.x);D[A].rest[Math.min(3,OF[A].filter(i=>i!==owneri).map(i=>pos(f,i)).filter((p:any)=>p&&depth(A,p.x)<bdA-MARGIN).length)]++;
   }
  }
 }
 // regains (from the regaining side S's point of view)
 for(let k=1;k<n;k++){
  const a=poss[k-1],b=poss[k];if(a<0||b<0||a===b)continue;
  const f=frames[k];if(f.restart||frames[k-1].restart)continue;
  const S=b,O=a,t=f.time,prev=frames[k-1].time;
  const upI=OF[S].find(i=>purpose(i,prev)==='up');
  let got=0,touch=-1,first=0;
  if(upI!==undefined){
   const id=roster[upI].id;
   for(let j=k;j<n&&frames[j].time<=t+8;j++){const g=frames[j];if(g.restart||poss[j]!==S)break;if(owner(g)===id){got=1;touch=r1(g.time-t);break;}}
   for(const e of events){if(e.time<=t-1e-6)continue;if(e.time>t+8)break;
    if(e.kind==='pass'&&sideOf(e.actor)===S){first=e.target===id?1:0;break;}
    if(e.kind==='turnover'&&sideOf(e.actor)!==S||e.kind==='restart'||e.kind==='out'||e.kind==='goal')break;}
  }
  const sh=shots.filter((e:any)=>e.side===S&&e.time>t&&e.time<=t+12).length,gl=goals.filter((e:any)=>e.side===S&&e.time>t&&e.time<=t+12).length;
  const bdO=depth(O,f.ball.x);
  const restO=OF[O].map(i=>pos(f,i)).filter((q:any)=>q&&depth(O,q.x)<bdO-MARGIN).length;
  const upS=OF[S].map(i=>pos(f,i)).filter((q:any)=>q&&depth(O,q.x)<bdO-MARGIN).length;
  D[S].turn.push([r1(t),r1(depth(S,f.ball.x)),upI!==undefined?1:0,got,first,touch,sh,gl,restO,upS,bdO>=L/2?1:0]);
 }
 return D;
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const {base,mods}=parse(t.arm);
 const hooks=mods.length?{base,teams:(teams:any[],tr:number)=>{for(const m of mods){const other=!SET[m];const [k,v]=SET[other?m.slice(1):m];teams[other?1-tr:tr].tactics[k]=v;}}}:undefined;
 return deepPlay(t,(R:any)=>{const tr=traceKeys(R),rs=restKeys(R);return [0,1].map(s=>({tr:tr[s],rs:rs[s]}));},hooks);
}

// ---- laptop traces only (run-trace.mjs): the same match, plus snapshots to render -----------------------------------
// snaps: every open-play moment (sampled 0.5 s) where a side has a man on 'up', and each regain by a side that had one
// (the regain frame and 1, 2, 3 s after): positions, velocities, job purposes and aims, the ball and its owner.
export function traceMatch(t:{label:string;arm:string;seed:number;rev:string}){
 const {base,mods}=parse(t.arm);const snaps:any[]=[];
 const hooks={base,teams:(teams:any[],tr:number)=>{for(const m of mods){const other=!SET[m];const [k,v]=SET[other?m.slice(1):m];teams[other?1-tr:tr].tactics[k]=v;}}};
 const row:any=deepPlay(t,(R:any)=>{
  const tr=traceKeys(R),rs=restKeys(R);
  const roster:any[]=R.players,frames:any[]=R.frames,choices:any[]=R.choices??[];
  const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
  const by=new Map<number,any[]>();for(const c of choices){const a=by.get(c.player)??[];a.push(c);by.set(c.player,a);}
  const job=(i:number,tm:number)=>{const a=by.get(i);if(!a)return null;let lo=0,hi=a.length-1,b=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=tm+1e-6){b=m;lo=m+1;}else hi=m-1;}return b>=0?a[b]:null;};
  const frameAt=(tm:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=tm+1e-6)lo=m;else hi=m-1;}return lo;};
  const snap=(f:any,why:string)=>({t:r1(f.time),why,ball:[r1(f.ball.x),r1(f.ball.y)],owner:f.restart?null:(f.control?.owner??f.ball?.owner??null),
   p:roster.map((p:any,i:number)=>{const q=pos(f,i);const c=job(i,f.time);return q?{id:p.id,s:p.side,r:p.role,x:r1(q.x),y:r1(q.y),vx:r1(q.vx??0),vy:r1(q.vy??0),j:c?.assignment?.purpose??c?.kind??null,aim:c?.assignment?.aim?[r1(c.assignment.aim.x),r1(c.assignment.aim.y)]:null}:null;}).filter(Boolean)});
  let next=-1;
  for(const f of frames){if(f.restart||f.time<next)continue;
   if(roster.some((p:any,i:number)=>p.role!=='GK'&&job(i,f.time)?.assignment?.purpose==='up')){snaps.push(snap(f,'up'));next=f.time+.5;}}
  for(const S of [0,1])for(const x of rs[S].turn)if(x[2])for(const dt of [0,1,2,3])snaps.push(snap(frames[frameAt(x[0]+dt)],`regain${S}+${dt}`));
  // how each 'up' stint ended: its length and the job that followed (flip-flop diagnosis)
  for(const [i,cs] of by)for(let k=0;k<cs.length;k++)if(cs[k].assignment?.purpose==='up'&&(k===0||cs[k-1].assignment?.purpose!=='up')){
   let e=k;while(e+1<cs.length&&cs[e+1].assignment?.purpose==='up')e++;const nx=cs[e+1];
   snaps.push({why:'upEnd',player:i,t:r1(cs[k].time),len:nx?r1(nx.time-cs[k].time):null,next:nx?{purpose:nx.assignment?.purpose??null,kind:nx.kind,reason:String(nx.reason).slice(0,70)}:null});
  }
  return [0,1].map(s=>({tr:tr[s],rs:rs[s]}));
 },hooks);
 return {row,snaps};
}
