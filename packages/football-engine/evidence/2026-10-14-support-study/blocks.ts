// Support study, part 2 (2026-10-14): the support.ts row (deep row + st[side] support keys) plus st[side].blk:
// does Short's circulation move the defence, and does a deep block buy what sitting deep is for? Evidence only; reads
// the recorded match. Depth = metres from the side's own goal; zones by depth <16 / <32 / >=32.
//
// blk[side] keys (per match, that side):
//  circ[z][c]  open-play passes by this side from zone z (0 own third, 1 middle; passer's depth), c = 0 sideways/back
//              (aim gain < 2 m), 1 forward (gain >= 5 m, the comparison): [n, received by us, open forward option at the
//              release instant, any open forward option in the 3 s before the release (our ball), any in the 3 s after
//              the reception (our ball; 0 if not received), opened (none before, some after), closed (some before, none
//              after), progressed: our owned ball >= 8 m beyond the passer's depth within 5 s of the release without
//              a loss, lost within 5 s of the release]
//              open forward option = an open (>=2.5 m from every opposing outfielder) outfield team-mate of the carrier
//              >=5 m upfield of the ball, <=22 m from it (support.ts's noFwd, lane check left out)
//  shotsAg     shots this side conceded: [n, sum distance to goal centre, <=8 m, central (|y|<=3.5 and <=14 m),
//              close or central, headers]
//  regain[z]   this side's open-play regains (a spell after the opponent's, not at a restart), by the regain zone:
//              [n, sum metres between the opponents' last outfielder and their goal line, sum opponents' outfielders
//              goal-side of the ball, reached the final third in the same spell, sum s to get there, sum m/s to get
//              there ((32 - regain depth) / s), a shot in the spell within 12 s]
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {extra as supportExtra} from './support';
export {armTreatment};

const L=48,DT=.25;
export function blocks(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events;
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const depth=(s:number,x:number)=>s===0?x:L-x,zone=(d:number)=>d<16?0:d<32?1:2;
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const ownerOf=(f:any)=>f.restart?null:(f.ball?.owner??null);
 const out=[0,1].map(s=>roster.map((p:any,i:number)=>({p,i})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i));
 // open forward option for the carrier at frame k: [side, has option] or null
 const fwdMemo=new Map<number,[number,boolean]|null>();
 const fwdAt=(k:number)=>{if(fwdMemo.has(k))return fwdMemo.get(k)!;const f=frames[k],o=ownerOf(f);let r:[number,boolean]|null=null;
  if(o){const s=sideOf(o),ci=idx.get(o)!,bd=depth(s,f.ball.x);const opp=out[1-s].map(i=>pos(f,i)).filter(Boolean);
   let ok=false;for(const i of out[s]){if(i===ci)continue;const q=pos(f,i);if(!q)continue;
    if(depth(s,q.x)-bd>=5&&Math.hypot(q.x-f.ball.x,q.y-f.ball.y)<=22&&opp.every((d:any)=>Math.hypot(d.x-q.x,d.y-q.y)>=2.5)){ok=true;break;}}
   r=[s,ok];}
  fwdMemo.set(k,r);return r;};
 // any open forward option for side s in [t0,t1], our ball, sampled every DT
 const anyFwd=(s:number,t0:number,t1:number)=>{for(let t=t0;t<=t1+1e-9;t+=DT){const r=fwdAt(frameAt(t));if(r&&r[0]===s&&r[1])return true;}return false;};
 const mk=()=>({circ:[0,1].map(()=>[0,1].map(()=>[0,0,0,0,0,0,0,0,0])),shotsAg:[0,0,0,0,0,0],regain:[0,1,2].map(()=>[0,0,0,0,0,0,0])});
 const B=[mk(),mk()];
 // ---- circulation
 const STOP=new Set(['receive','turnover','out','save','goal','shot','pass','clearance','block','tackle','restart','offside','foul']);
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||e.restartKind||(e.side!==0&&e.side!==1))continue;
  const s=e.side,k0=frameAt(e.time),f=frames[k0],pi=idx.get(e.actor);if(pi===undefined)continue;const p=pos(f,pi),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const d0=depth(s,p.x),z=zone(d0);if(z>1)continue;const gain=depth(s,aim.x)-d0;const c=gain<2?0:gain>=5?1:-1;if(c<0)continue;
  const v=B[s].circ[z][c];v[0]++;
  // the release instant: the last frame the passer owned
  let kr=k0;while(kr>0&&ownerOf(frames[kr])!==e.actor&&frames[kr].time>e.time-.5)kr--;
  const r0=fwdAt(kr);if(r0&&r0[0]===s&&r0[1])v[2]++;
  const before=anyFwd(s,e.time-3,e.time-.01);if(before)v[3]++;
  let nx:any=null;for(let r=q+1;r<events.length;r++){if(STOP.has(events[r].kind)){nx=events[r];break;}}
  const got=nx&&nx.kind==='receive'&&sideOf(nx.actor)===s;let after=false;
  if(got){v[1]++;after=anyFwd(s,nx.time,nx.time+3);if(after)v[4]++;}
  if(!before&&after)v[5]++;if(before&&!after)v[6]++;
  // progression / loss within 5 s of the release
  let prog=false,lost=false;
  for(let k=k0;k<n&&frames[k].time<=e.time+5;k++){const g=frames[k];if(g.restart)break;const o=ownerOf(g);if(!o)continue;
   if(sideOf(o)!==s){lost=true;break;}if(depth(s,g.ball.x)-d0>=8){prog=true;break;}}
  if(prog)v[7]++;if(lost)v[8]++;
 }
 // ---- shots conceded
 for(const e of events){if(e.kind!=='shot'||(e.side!==0&&e.side!==1))continue;const S=e.side,D=1-S,o=e.shot?.origin;if(!o)continue;
  const gx=S===0?L:0,dist=Math.hypot(o.x-gx,o.y),a=B[D].shotsAg;a[0]++;a[1]+=dist;const close=dist<=8,central=Math.abs(o.y)<=3.5&&dist<=14;
  if(close)a[2]++;if(central)a[3]++;if(close||central)a[4]++;if(e.technique==='header')a[5]++;}
 // ---- regains
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=ownerOf(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const shots=events.filter((e:any)=>e.kind==='shot');
 let prevSide=-1;
 for(let k=0;k<n;){const s=poss[k];let j=k;while(j+1<n&&poss[j+1]===s)j++;
  if(s>=0&&prevSide===1-s&&!frames[k].restart){
   // the first owned frame of the spell
   let k1=k;while(k1<=j&&!(ownerOf(frames[k1])&&sideOf(ownerOf(frames[k1]))===s))k1++;
   if(k1<=j){const f=frames[k1],rd=depth(s,f.ball.x),z=zone(rd),v=B[s].regain[z];v[0]++;
    const opp=out[1-s].map(i=>pos(f,i)).filter(Boolean) as any[];
    if(opp.length){v[1]+=L-Math.max(...opp.map(d=>depth(s,d.x)));v[2]+=opp.filter(d=>depth(s,d.x)>rd).length;}
    for(let m=k1;m<=j;m++){const g=frames[m],o=ownerOf(g);if(o&&sideOf(o)===s&&depth(s,g.ball.x)>=32){const dt=g.time-f.time;v[3]++;v[4]+=dt;v[5]+=dt>0?(32-Math.min(32,rd))/Math.max(dt,.1):0;break;}}
    if(shots.some((e:any)=>e.side===s&&e.time>=f.time&&e.time<=Math.min(f.time+12,frames[j].time+.5)))v[6]++;}
  }
  if(s>=0)prevSide=s;k=j+1;}
 const r2=(x:number)=>Math.round(x*100)/100;
 for(const b of B){b.shotsAg[1]=r2(b.shotsAg[1]);for(const v of b.regain){v[1]=r2(v[1]);v[4]=r2(v[4]);v[5]=r2(v[5]);}}
 return B;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 return deepPlay(t,R=>{const A:any[]=supportExtra(R),B=blocks(R);A[0].blk=B[0];A[1].blk=B[1];return A;});
}
