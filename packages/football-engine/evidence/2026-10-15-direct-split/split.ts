// Direct split (2026-10-15, branch ballers-direct-split, engine 8ae8dc61): the deep-study row
// (../2026-10-12-deep-study/deep.ts, unchanged; agg[].x.mv/lr/pl dropped as the R1 rows dropped them) plus `dx[side]`,
// the mechanism keys of Direct's pieces. Arms: mirror.ts `sp-<A>-<B>` (treated side A, other side B, both 1-2-1; a
// team is a preset plus .c3|.c4|.srun|.smix|.pmix|.wstd). Evidence only; reads the recorded match, changes nothing.
//
// dx[side] (per match, that side; depth = metres from the side's own goal line, pitch 48 x 30, box 8 m deep, 16 m wide):
//  lf    open-play long balls into the final third: passes lofted or 15 m+, gaining >= 5 m, aimed >= 32 m:
//        [n, first touch ours with no loose ball, first touch ours (any), the named target himself got it first]
//  runs  [depth-run starts by the striker (role ST), by the others, of those aimed beyond their deepest outfielder
//        (striker), (others), break-run starts (transition sprints), In-behind shoulder-post spells]
//  box   [box arrivals: an outfielder of ours entering their box during our open-play possession (each entry from
//        outside counts), our spells in which >= 2 of ours were in their box at once, sum over our shots of our outfielders
//        in their box at the shot, our shots]
//  st    [striker receptions, of those with him beyond their deepest outfielder at the reception, striker receptions
//        >= 32 m, receptions beyond their deepest outfielder by anyone of ours]
//  loss  [open-play losses (our spell ended by their possession, no restart between), of those with <= 1 of our
//        outfielders goal-side of the ball at the loss, goals conceded <= 12 s after a loss, of those after a <= 1-back
//        loss, sum of our outfielders goal-side of the ball at the losses, losses with <= 2 goal-side, goals conceded
//        <= 12 s after a <= 2-back loss]
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
export {armTreatment};
const L=48,BOX_DEPTH=8,BOX_HALF=8;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

export function dxKeys(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const n=frames.length;
 const frameAt=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const outfield=(s:number)=>roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i as number);
 const OF=[outfield(0),outfield(1)];
 const lastLine=(f:any,S:number)=>{let m=-1;for(const i of OF[1-S]){const q=pos(f,i);if(q)m=Math.max(m,depth(S,q.x));}return m;};// their deepest outfielder, in S's depth
 // box: y may be centred (|y| <= 15) or 0..30; decide from the data
 let yMin=Infinity;for(let k=0;k<n;k+=50)yMin=Math.min(yMin,frames[k].ball.y);
 const yc=yMin< -1?0:15;
 const inBox=(S:number,q:any)=>depth(S,q.x)>=L-BOX_DEPTH&&Math.abs(q.y-yc)<=BOX_HALF;
 const D=[0,1].map(()=>({lf:[0,0,0,0],runs:[0,0,0,0,0,0],box:[0,0,0,0],st:[0,0,0,0],loss:[0,0,0,0,0,0,0],yc}));
 const goals=events.filter((e:any)=>e.kind==='goal'&&(e.side===0||e.side===1));
 // possession per frame, as deep.ts
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 // long balls into the final third
 for(const e of events){
  if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const S=e.side,k0=frameAt(e.time),f=frames[k0],p=pos(f,idx.get(e.actor)!),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const len=dist(p,aim),from=depth(S,p.x),to=depth(S,aim.x);
  if(!((e.aerial||len>=15)&&to-from>=5&&to>=32))continue;
  const v=D[S].lf;v[0]++;let loose=false;
  for(let k=k0+1;k<n&&frames[k].time<=e.time+4;k++){const g=frames[k];if(g.restart)break;const o=g.ball?.owner;
   if(o&&!(o===e.actor&&g.time<e.time+.3)){if(sideOf(o)===S){v[2]++;if(!loose)v[1]++;if(o===e.target&&!loose)v[3]++;}break;}
   if(g.ball?.mode==='loose')loose=true;}
 }
 // runs (job choices): a start = a new (player, purpose, since)
 const seen=new Set<string>();
 for(const c of choices){
  const a=c.assignment;if(!a)continue;const pl=roster[c.player];if(!pl||pl.role==='GK')continue;const S=pl.side;
  if(!['depth','break','shoulder'].includes(a.purpose))continue;
  if(a.purpose!=='shoulder'&&c.kind!=='run')continue;
  const key=`${c.player}:${a.purpose}:${a.since}`;if(seen.has(key))continue;seen.add(key);
  if(a.purpose==='break'){D[S].runs[4]++;continue;}
  if(a.purpose==='shoulder'){D[S].runs[5]++;continue;}
  const st=pl.role==='ST',f=frames[frameAt(c.time)],ll=lastLine(f,S),beyond=a.aim&&depth(S,a.aim.x)>ll;
  D[S].runs[st?0:1]++;if(beyond)D[S].runs[st?2:3]++;
 }
 // box arrivals and bodies in the box per spell (open play)
 const was=new Map<number,boolean>();
 let spellStart=-1,spellSide=-1,spellTwo=false;
 for(let k=0;k<n;k++){
  const f=frames[k],S=poss[k];
  if(S!==spellSide){if(spellSide>=0&&spellTwo)D[spellSide].box[1]++;spellSide=S;spellStart=k;spellTwo=false;was.clear();}
  if(S<0||f.restart){was.clear();continue;}
  let inside=0;
  for(const i of OF[S]){const q=pos(f,i);if(!q)continue;const b=inBox(S,q);if(b)inside++;
   if(b&&was.get(i)===false)D[S].box[0]++;was.set(i,b);}
  if(inside>=2)spellTwo=true;
 }
 if(spellSide>=0&&spellTwo)D[spellSide].box[1]++;
 for(const e of events){if(e.kind!=='shot'||(e.side!==0&&e.side!==1))continue;const S=e.side,f=frames[frameAt(e.time)];
  let c=0;for(const i of OF[S]){const q=pos(f,i);if(q&&inBox(S,q))c++;}D[S].box[2]+=c;D[S].box[3]++;}
 // receptions beyond their deepest outfielder
 for(const e of events){
  if(e.kind!=='receive'||(e.side!==0&&e.side!==1))continue;const S=e.side,i=idx.get(e.actor);if(i===undefined)continue;
  const f=frames[frameAt(e.time)],q=pos(f,i);if(!q)continue;const beyond=depth(S,q.x)>lastLine(f,S);
  if(roster[i].role==='ST'){D[S].st[0]++;if(beyond)D[S].st[1]++;if(depth(S,q.x)>=32)D[S].st[2]++;}
  if(beyond)D[S].st[3]++;
 }
 const losses:{S:number;t:number;few:boolean;back:number}[]=[];
 // losses: possession passes from S to 1-S at a frame that is not a restart, with no restart since S's last owner
 for(let k=1;k<n;k++){
  const a=poss[k-1],b=poss[k];if(a<0||b<0||a===b)continue;
  const f=frames[k];if(f.restart||frames[k-1].restart)continue;
  const S=a,bd=depth(S,f.ball.x);let back=0;for(const i of OF[S]){const q=pos(f,i);if(q&&depth(S,q.x)<bd)back++;}
  const v=D[S].loss;v[0]++;v[4]+=back;const few=back<=1;if(few)v[1]++;if(back<=2)v[5]++;
  losses.push({S,t:f.time,few,back});
 }
 // each goal once: the scorer's opponent's latest loss before it, if <= 12 s
 for(const g of goals){const S=1-g.side;let l:any=null;for(const x of losses)if(x.S===S&&x.t<=g.time+1e-6)l=x;
  if(l&&g.time-l.t<=12){D[S].loss[2]++;if(l.few)D[S].loss[3]++;if(l.back<=2)D[S].loss[6]++;}}
 return D;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const row:any=deepPlay(t,R=>dxKeys(R));
 for(const a of row.agg){delete a.x.mv;delete a.x.lr;delete a.x.pl;}
 row.dx=row.st;delete row.st;
 return row;
}
