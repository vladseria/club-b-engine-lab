// Default measurement (2026-10-15, branch ballers-contest-live = ballers-contest + main's keeper tune and cap removal).
// Evidence only: reads the recorded match, changes nothing. One row per match:
//   the deep-study row (../2026-10-12-deep-study/deep.ts play(), the official runMatch call; agg[].x.mv/lr/pl dropped as
//   the direct split dropped them) plus st[side] = {dx, rd}:
//   dx  the direct split's mechanism keys (dxKeys, a copy of branch ballers-direct-split
//       evidence/2026-10-15-direct-split/split.ts, unchanged) with three fields appended to dx.loss:
//         loss = [open-play losses, of those with <= 1 of ours goal-side of the ball, their goals <= 12 s after a loss,
//                 of those after a <= 1-back loss, sum of ours goal-side at the losses, losses with <= 2 goal-side, their
//                 goals <= 12 s after a <= 2-back loss,
//                 (new) their shots <= 12 s after a loss, their clear chances (table rate >= 0.30) among them, the sum of
//                 their table rates among them]
//       each goal or shot counts once, against our latest open-play loss before it, when that loss is <= 12 s before it.
//   rd  the rest-defence trace keys (traceKeys, a copy of branch ballers-rest-defence
//       evidence/2026-10-15-rest-defence/trace.ts, unchanged except that the `examples` list is dropped): att, rest[k],
//       lvl[k], guard, guardRole, up/upAll/upJob/upCover, defFrames/defUp/defUpAll, loss[8], lossBy[k] (see that file).
// Arms: any mirror arm (../2026-10-10-cloud-measure/mirror.ts), in practice sp-<A>-<B> (a team = preset + .srun, .ldeep,
// .psel, .pdir, .f22, ...). Table rates come from lib/ballers/chances.ts shotChance with whatever table the revision
// carries (its `chances` field is null when the table was measured on another build; agg.good / agg.clear are not).
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {compact} from '../../../../lib/ballers/compute';
import {shotChance} from '../../../../lib/ballers/chances';
export {armTreatment};
const L=48,BOX_DEPTH=8,BOX_HALF=8,MARGIN=4,CLEAR=.3;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const r3=(v:number)=>Math.round(v*1000)/1000;

// ---- dxKeys (split.ts), plus the chance fields on loss ----------------------------------------------------------
export function dxKeys(R:any,chanceOf:(e:any)=>number){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const n=frames.length;
 const frameAt=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const outfield=(s:number)=>roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i as number);
 const OF=[outfield(0),outfield(1)];
 const lastLine=(f:any,S:number)=>{let m=-1;for(const i of OF[1-S]){const q=pos(f,i);if(q)m=Math.max(m,depth(S,q.x));}return m;};
 let yMin=Infinity;for(let k=0;k<n;k+=50)yMin=Math.min(yMin,frames[k].ball.y);
 const yc=yMin< -1?0:15;
 const inBox=(S:number,q:any)=>depth(S,q.x)>=L-BOX_DEPTH&&Math.abs(q.y-yc)<=BOX_HALF;
 const D=[0,1].map(()=>({lf:[0,0,0,0],runs:[0,0,0,0,0,0],box:[0,0,0,0],st:[0,0,0,0],loss:[0,0,0,0,0,0,0,0,0,0],yc}));
 const goals=events.filter((e:any)=>e.kind==='goal'&&(e.side===0||e.side===1));
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
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
 const was=new Map<number,boolean>();
 let spellSide=-1,spellTwo=false;
 for(let k=0;k<n;k++){
  const f=frames[k],S=poss[k];
  if(S!==spellSide){if(spellSide>=0&&spellTwo)D[spellSide].box[1]++;spellSide=S;spellTwo=false;was.clear();}
  if(S<0||f.restart){was.clear();continue;}
  let inside=0;
  for(const i of OF[S]){const q=pos(f,i);if(!q)continue;const b=inBox(S,q);if(b)inside++;
   if(b&&was.get(i)===false)D[S].box[0]++;was.set(i,b);}
  if(inside>=2)spellTwo=true;
 }
 if(spellSide>=0&&spellTwo)D[spellSide].box[1]++;
 for(const e of events){if(e.kind!=='shot'||(e.side!==0&&e.side!==1))continue;const S=e.side,f=frames[frameAt(e.time)];
  let c=0;for(const i of OF[S]){const q=pos(f,i);if(q&&inBox(S,q))c++;}D[S].box[2]+=c;D[S].box[3]++;}
 for(const e of events){
  if(e.kind!=='receive'||(e.side!==0&&e.side!==1))continue;const S=e.side,i=idx.get(e.actor);if(i===undefined)continue;
  const f=frames[frameAt(e.time)],q=pos(f,i);if(!q)continue;const beyond=depth(S,q.x)>lastLine(f,S);
  if(roster[i].role==='ST'){D[S].st[0]++;if(beyond)D[S].st[1]++;if(depth(S,q.x)>=32)D[S].st[2]++;}
  if(beyond)D[S].st[3]++;
 }
 const losses:{S:number;t:number;few:boolean;back:number}[]=[];
 for(let k=1;k<n;k++){
  const a=poss[k-1],b=poss[k];if(a<0||b<0||a===b)continue;
  const f=frames[k];if(f.restart||frames[k-1].restart)continue;
  const S=a,bd=depth(S,f.ball.x);let back=0;for(const i of OF[S]){const q=pos(f,i);if(q&&depth(S,q.x)<bd)back++;}
  const v=D[S].loss;v[0]++;v[4]+=back;const few=back<=1;if(few)v[1]++;if(back<=2)v[5]++;
  losses.push({S,t:f.time,few,back});
 }
 const latestLoss=(S:number,t:number)=>{let l:any=null;for(const x of losses)if(x.S===S&&x.t<=t+1e-6)l=x;return l&&t-l.t<=12?l:null;};
 for(const g of goals){const S=1-g.side,l=latestLoss(S,g.time);
  if(l){D[S].loss[2]++;if(l.few)D[S].loss[3]++;if(l.back<=2)D[S].loss[6]++;}}
 for(const e of events){if(e.kind!=='shot'||(e.side!==0&&e.side!==1))continue;const S=1-e.side,l=latestLoss(S,e.time);
  if(l){const ch=chanceOf(e),v=D[S].loss;v[7]++;if(ch>=CLEAR)v[8]++;v[9]+=ch;}}
 for(const d of D)d.loss[9]=r3(d.loss[9]);
 return D;
}

// ---- traceKeys (trace.ts), examples dropped ---------------------------------------------------------------------
export function traceKeys(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const OF=[0,1].map(s=>roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i as number));
 const byPlayer=new Map<number,any[]>();
 for(const c of choices){const a=byPlayer.get(c.player)??[];a.push(c);byPlayer.set(c.player,a);}
 const jobAt=(i:number,t:number)=>{const a=byPlayer.get(i);if(!a)return null;let lo=0,hi=a.length-1,b=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=t+1e-6){b=m;lo=m+1;}else hi=m-1;}return b>=0?a[b]:null;};
 const n=frames.length;
 const frameAt=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const backSpeed=(f:any,i:number,O:number)=>{const g=frames[frameAt(f.time-.3)],a=pos(g,i),b=pos(f,i);if(!a||!b||f.time-g.time<.05)return 0;return (depth(O,a.x)-depth(O,b.x))/(f.time-g.time);};
 const owner=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=owner(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const goals=events.filter((e:any)=>e.kind==='goal').map((e:any)=>({t:e.time,s:e.side}));
 const shots=events.filter((e:any)=>e.kind==='shot').map((e:any)=>({t:e.time,s:e.side}));
 const z=(m:number)=>Array.from({length:m},()=>0);
 const D=[0,1].map(()=>({att:0,rest:z(4),lvl:z(4),guard:0,guardRole:{} as Record<string,number>,up:z(4),upAll:z(4),upJob:{} as Record<string,number>,upCover:[z(4),z(4),z(4),z(4)],defFrames:0,defUp:z(4),defUpAll:z(4),
  loss:[0,0,0,0,0,0,0,0],lossBy:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]]}));
 let nextT=-1;
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.restart)continue;
  const o=owner(f);if(!o)continue;
  if(f.time<nextT-1e-6)continue;nextT=f.time+.2;
  const S=sideOf(o),O=1-S,ci=idx.get(o)!;const carrier=pos(f,ci);if(!carrier)continue;
  const bd=depth(S,f.ball.x);
  const upIds=OF[O].filter(i=>{const q=pos(f,i);return q&&depth(S,q.x)<bd-MARGIN&&dist(q,carrier)>2.5;});
  const stationed=upIds.filter(i=>{const a=jobAt(i,f.time)?.assignment?.aim;return a&&depth(S,a.x)<bd-MARGIN&&backSpeed(f,i,O)<2;});
  const upMen=stationed.map(i=>pos(f,i));
  D[O].defFrames++;D[O].defUp[Math.min(3,upMen.length)]++;D[O].defUpAll[Math.min(3,upIds.length)]++;
  if(roster[ci].role==='GK'||bd<L/2)continue;
  const mates=OF[S].filter(i=>i!==ci).map(i=>({i,q:pos(f,i)})).filter((x:any)=>x.q);
  const rest=mates.filter((x:any)=>depth(S,x.q.x)<bd-MARGIN).length,lvl=mates.filter((x:any)=>depth(S,x.q.x)>=bd-1).length;
  const d=D[S];d.att++;d.rest[Math.min(3,rest)]++;d.lvl[Math.min(3,lvl)]++;
  const g=mates.find((x:any)=>{const c=jobAt(x.i,f.time);return c?.assignment?.purpose==='counter-cover'&&String(c.reason??c.assignment?.reason??'').startsWith('Echilibru în atac');});
  if(g){d.guard++;const r=roster[g.i].role;d.guardRole[r]=(d.guardRole[r]??0)+1;}
  const ku=Math.min(3,upMen.length);d.up[ku]++;d.upAll[Math.min(3,upIds.length)]++;
  for(const i of stationed){const pu=jobAt(i,f.time)?.assignment?.purpose??'none';D[O].upJob[pu]=(D[O].upJob[pu]??0)+1;}
  if(upMen.length){const deepest=Math.min(...upMen.map((q:any)=>depth(S,q.x)));d.upCover[ku][Math.min(3,mates.filter((x:any)=>depth(S,x.q.x)<deepest).length)]++;}
 }
 for(let k=1;k<n;k++){
  const a=poss[k-1],b=poss[k];if(a<0||b<0||a===b)continue;
  const f=frames[k];if(f.restart||frames[k-1].restart)continue;
  const S=a,O=b,bd=depth(S,f.ball.x);if(bd<L/2)continue;
  const rest=OF[S].map(i=>pos(f,i)).filter((q:any)=>q&&depth(S,q.x)<bd-MARGIN).length;
  const upI=OF[O].filter(i=>{const q=pos(f,i);return q&&depth(S,q.x)<bd-MARGIN;}),up=upI.length;
  const st=upI.filter(i=>{const a=jobAt(i,frames[k-1].time)?.assignment?.aim;return a&&depth(S,a.x)<bd-MARGIN&&backSpeed(frames[k-1],i,O)<2;}).length;
  const gl=goals.some((x:any)=>x.s===O&&x.t>f.time&&x.t<=f.time+12),sh=shots.some((x:any)=>x.s===O&&x.t>f.time&&x.t<=f.time+12);
  const L0=D[S].loss;L0[0]++;L0[1]+=rest;
  const lb=D[S].lossBy[Math.min(3,rest)];lb[0]++;if(gl)lb[1]++;if(sh)lb[2]++;
  if(up>=2){L0[2]++;if(gl)L0[3]++;if(sh)L0[4]++;}
  if(st>=1){L0[5]++;if(gl)L0[6]++;if(sh)L0[7]++;}
 }
 return D;
}

export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const row:any=deepPlay(t,(R:any,inp:any)=>{
  // table rate per engine shot event, from the compact events (as deep.ts chanceOf)
  const c:any=compact(inp,R),at=new Map<number,number>();
  for(const ch of c.chunks)for(const e of ch.e)if(e.k==='shot')at.set(e.t,shotChance(e)??0);
  const chanceOf=(e:any)=>{const t=Math.round(e.time*1000);for(const d of [0,1,-1,2,-2]){const v=at.get(t+d);if(v!==undefined)return v;}return 0;};
  const dx=dxKeys(R,chanceOf),rd=traceKeys(R);
  return [0,1].map(s=>({dx:dx[s],rd:rd[s]}));
 });
 for(const a of row.agg){delete a.x.mv;delete a.x.lr;delete a.x.pl;}
 return row;
}
