// Direct edge, squad dependence (2026-10-23): the row entry. Evidence only: it reads the recorded match and changes
// nothing in the engine (ENGINE_BUILD c622728d, main). It is ../2026-10-22-whatif/row.ts (the match anatomy, every
// parity fingerprint unchanged) plus:
//  - one more kind of side (setSides): {src:'squad', code, squad:'avg', mods:{<slot>:{<skill>:delta}}}: the squad-fit
//    study's average squad (../2026-10-19-engine-audits/squads.ts: the real league's group means, 1-2-1: GK, CB, W, W,
//    ST), starters only, with per-player skill moves. Every move set sums to zero per player (set.mjs checks it), so a
//    fast or slow man keeps the average skill total. parity.ts sideOf then applies preset / approach / settings.
//  - extra.de[0|1] (home, away): the reads this question needs, below.
//
// extra.de[S], S's view (`last` = their deepest outfielder's depth from our goal line, read at the frame of the event):
//  bib      balls in behind: open-play passes by S (no restart) whose aim is beyond `last` at the kick, aim in their
//           half (depth >= 24 m). [n, first owner within 4 s: the target, another of ours, their keeper, their
//           outfielder, nobody (out / restart)]
//  bibST    the same for passes meant for our ST
//  rec      receptions by S in their half (receiver depth >= 24 m), by band at the reception frame:
//           behind = beyond `last`; front4 = within 4 m in front of `last`; front = further in front; tight = any band
//           with their nearest outfielder within 1 m. Each [n, shots, chance sum, goals] by S within 8 s of the
//           reception and before the other side has the ball (frame ownership; a restart ends it too).
//  recST    the same, receptions by our ST only
//  race     our ST's receptions behind: [n, sum of the nearest opposing outfielder's distance, n with that man within
//           2 m, n contested by a reception duel (receptionDuels at that time)]
//  loss     open-play losses (frame ownership passes to them, no restart either side): [n, sum of our outfielders
//           goal-side of the ball at the loss, their shots / chance sum / goals within 12 s of our latest loss
//           (each counted once, against that loss)]
//  lossHi   the same for losses in their half (ball depth >= 24 m from our goal)
//  stLast   frames (in our possession, ball in their half) with our ST within 1 m of `last` or beyond it: [frames, n]
import {setExtra,setSides} from '../2026-10-21-engine-as-data/parity';
import {anatomy} from '../2026-10-22-whatif/row';
import {shotChance} from '../../../../lib/ballers/chances';
import {PRESETS} from '../../../../lib/ballers/league';
import {player as squadPlayer} from '../2026-10-19-engine-audits/squads';
export * from '../2026-10-21-engine-as-data/parity';

const L=48,HALF=24;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const r3=(v:number)=>Math.round(v*1000)/1000;

setSides((spec:any)=>{
 if(spec.src!=='squad')return null;
 const starters=[0,1,2,3,4].map(i=>{
  const p=squadPlayer(spec.code,i,spec.squad??'avg');
  const m=spec.mods?.[i];
  if(m){let sum=0;for(const [k,v] of Object.entries(m)){if(!(k in p.skills))throw Error('unknown skill '+k);p.skills[k]=Math.round((p.skills[k]+(v as number))*10)/10;sum+=v as number;
   if(!(p.skills[k]>=0&&p.skills[k]<=12))throw Error(`${spec.code}${i+1} ${k}=${p.skills[k]} out of range`);}
   if(Math.abs(sum)>1e-9)throw Error(`${spec.code} slot ${i}: moves sum to ${sum}`);}
  return p;
 });
 return {club:{id:spec.code,name:spec.code,code:spec.code,color:'#888888'},formation:'1-2-1',style:'balanced',approach:{...(PRESETS as any).balanced},
  captain:starters[1].id,lineup:starters.map((p:any)=>p.id),bench:[],players:starters,plans:[]};
});

const z=(n:number)=>Array.from({length:n},()=>0);
function side0(){return {bib:z(6),bibST:z(6),rec:{behind:z(4),front4:z(4),front:z(4),tight:z(4)},recST:{behind:z(4),front4:z(4),front:z(4),tight:z(4)},
 race:z(4),loss:z(5),lossHi:z(5),stLast:z(2)};}

export function directEdge(runs:any[]){
 const out=[side0(),side0()];
 for(const R of runs){
  const roster:any[]=R.players??[],frames:any[]=R.frames??[],events:any[]=R.events??[],duels:any[]=R.receptionDuels??[];
  if(!frames.length)continue;
  const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
  const roleOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].role as string:'';
  const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
  const n=frames.length;
  const frameAt=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
  const OF=[0,1].map(s=>roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i as number));
  const ST=[0,1].map(s=>roster.findIndex((p:any)=>p.side===s&&p.role==='ST'));
  // their deepest outfielder (S's view) and their outfielders at a frame
  const lastLine=(f:any,S:number)=>{let m=-1;for(const i of OF[1-S]){const q=pos(f,i);if(q)m=Math.max(m,depth(S,q.x));}return m;};
  const nearestOpp=(f:any,S:number,at:{x:number;y:number})=>{let d=Infinity;for(const i of OF[1-S]){const q=pos(f,i);if(q)d=Math.min(d,dist(q,at));}return d;};
  const owner=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
  // possession per frame (last owner; a restart sets the taker's side) and when it next changes
  const poss=new Int8Array(n);let last=-1;
  for(let k=0;k<n;k++){const f=frames[k];const o=owner(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
  const until=new Float64Array(n);// time the side in possession at frame k stops having it (a change, or a restart)
  {let t=frames[n-1].time+1;for(let k=n-1;k>=0;k--){if(k<n-1&&(poss[k+1]!==poss[k]||frames[k+1].restart))t=frames[k+1].time;until[k]=t;}}
  const shots=events.filter((e:any)=>e.kind==='shot'&&(e.side===0||e.side===1));
  const goals=events.filter((e:any)=>e.kind==='goal'&&(e.side===0||e.side===1));
  const chanceOf=(e:any)=>{const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;
   return shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;};
  // ---- balls in behind
  for(const e of events){
   if(e.kind!=='pass'||e.restartKind||!e.actor)continue;
   const S=sideOf(e.actor);if(S!==0&&S!==1)continue;
   const aim=e.pass?.aim??e.aerial?.aim;if(!aim)continue;
   const k0=frameAt(e.time),f=frames[k0],ll=lastLine(f,S),ad=depth(S,aim.x);
   if(!(ad>ll&&ad>=HALF))continue;
   let res=5;
   for(let k=k0+1;k<n&&frames[k].time<=e.time+4;k++){const g=frames[k];if(g.restart)break;const o=g.ball?.owner??g.control?.owner;
    if(o&&!(o===e.actor&&g.time<e.time+.3)){const os=sideOf(o);res=os===S?(o===e.target?1:2):(roleOf(o)==='GK'?3:4);break;}}
   const toST=ST[S]>=0&&e.target===roster[ST[S]].id;
   for(const v of toST?[out[S].bib,out[S].bibST]:[out[S].bib]){v[0]++;v[res]++;}
  }
  // ---- receptions in their half, and what follows within 8 s
  for(const e of events){
   if(e.kind!=='receive'||!e.actor)continue;
   const S=sideOf(e.actor);if(S!==0&&S!==1)continue;
   const i=idx.get(e.actor)!,k=frameAt(e.time),f=frames[k],q=pos(f,i);if(!q)continue;
   const d=depth(S,q.x);if(d<HALF)continue;
   const ll=lastLine(f,S),near=nearestOpp(f,S,q);
   const band=d>ll?'behind':d>=ll-4?'front4':'front';
   const end=Math.min(e.time+8,until[k]);
   let sh=0,ch=0,gl=0;
   for(const s of shots)if(s.side===S&&s.time>e.time&&s.time<=end){sh++;ch+=chanceOf(s);}
   for(const g of goals)if(g.side===S&&g.time>e.time&&g.time<=end+.25)gl++;
   const isST=i===ST[S];
   const add=(o:any)=>{for(const b of near<=1?[band,'tight']:[band]){const v=o[b];v[0]++;v[1]+=sh;v[2]+=ch;v[3]+=gl;}};
   add(out[S].rec);if(isST)add(out[S].recST);
   if(isST&&band==='behind'){const r=out[S].race;r[0]++;r[1]+=Number.isFinite(near)?near:0;if(near<=2)r[2]++;
    if(duels.some((x:any)=>x.receiver===e.actor&&Math.abs(x.time-e.time)<.6))r[3]++;}
  }
  // ---- losses and what the other side makes of them within 12 s
  const losses:{S:number;t:number;hi:boolean}[]=[];
  for(let k=1;k<n;k++){
   const a=poss[k-1],b=poss[k];if(a<0||b<0||a===b)continue;
   const f=frames[k];if(f.restart||frames[k-1].restart)continue;
   const S=a,bd=depth(S,f.ball.x);let back=0;for(const i of OF[S]){const q=pos(f,i);if(q&&depth(S,q.x)<bd)back++;}
   const hi=bd>=HALF;
   for(const v of hi?[out[S].loss,out[S].lossHi]:[out[S].loss]){v[0]++;v[1]+=back;}
   losses.push({S,t:f.time,hi});
  }
  const latest=(S:number,t:number)=>{let l:any=null;for(const x of losses)if(x.S===S&&x.t<=t+1e-6)l=x;return l&&t-l.t<=12?l:null;};
  for(const s of shots){const S=1-s.side,l=latest(S,s.time);if(!l)continue;const c=chanceOf(s);
   for(const v of l.hi?[out[S].loss,out[S].lossHi]:[out[S].loss]){v[2]++;v[3]+=c;}}
  for(const g of goals){const S=1-g.side,l=latest(S,g.time);if(!l)continue;for(const v of l.hi?[out[S].loss,out[S].lossHi]:[out[S].loss])v[4]++;}
  // ---- our ST on (or beyond) their last line, in our possession with the ball in their half
  for(let k=0;k<n;k+=2){const f=frames[k];if(f.restart)continue;const S=poss[k];if(S!==0&&S!==1||ST[S]<0)continue;
   if(depth(S,f.ball.x)<HALF)continue;const q=pos(f,ST[S]);if(!q)continue;
   out[S].stLast[0]++;if(depth(S,q.x)>=lastLine(f,S)-1)out[S].stLast[1]++;}
 }
 for(const o of out){for(const g of [o.rec,o.recST])for(const v of Object.values(g) as number[][])v[2]=r3(v[2]);o.loss[3]=r3(o.loss[3]);o.lossHi[3]=r3(o.lossHi[3]);o.race[1]=r3(o.race[1]);}
 return out;
}

setExtra((runs:any[],teams:any[],t:any)=>({...anatomy(runs,teams,t),de:directEdge(runs)}));
