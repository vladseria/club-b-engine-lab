// Rest-defence traces (2026-10-15, branch ballers-rest-defence, engine d58f7153). Evidence only: reads the recorded
// match (../2026-10-12-deep-study/deep.ts play(), the official runMatch call), changes nothing.
//
// Per side S, sampled every 0.2 s of open play (no restart frames, someone of S on the ball, not S's keeper):
//  att     established attacks (ball >= 24 m from S's goal): frames; rest[k] = frames with k of S's outfielders (carrier
//          excluded) clearly (>= 4 m, REST_MARGIN) goal-side of the ball; lvl[k] = frames with k of them level with or
//          ahead of the ball (depth >= ball - 1, counterNumbers); guard = frames with a REST_GUARDS job on
//          (purpose counter-cover, reason "Echilibru în atac"), guardRole[role] who held it
//  up      the same frames, the defending side's outfielders left up: depth (from S's goal) < ball - 4 and not within
//          2.5 m of S's carrier (not pressing him). up[k] = frames with k of them; upCover[k][j] = frames with k up and j
//          of S's outfielders goal-side of the deepest of them. upAll counts every such man; up/upCover only the men
//          STATIONED up: their own current job's aim (as last recorded) is also >= 4 m on S's side of the ball and they
//          are not running back towards their own goal faster than 2 m/s over the last 0.3 s (not a man bypassed and
//          recovering); upJob[purpose] = frames-men stationed up by job purpose
//  defUp   every open-play frame where S defends (any ball depth): frames with k of S's outfielders stationed up
//          (as above); defUpAll the same counting every man up, stationed or running back
//  loss    S's open-play losses (possession passes to the other side between two non-restart frames) in an established
//          attack: [n, sum of S's rest at the loss, of those with their men up (stationed or not) >= 2: n, goals by them <= 12 s,
//          shots <= 12 s, with >= 1 of their men stationed up: n, goals <= 12 s, shots <= 12 s],
//          lossBy[k] = [n, their goals <= 12 s, their shots <= 12 s] by k = S's outfielders >= 4 m goal-side at the loss
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
export {armTreatment};
const L=48,MARGIN=4;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

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
 // goalward speed of O's man i (towards O's own goal), m/s over the last 0.3 s
 const backSpeed=(f:any,i:number,O:number)=>{const g=frames[frameAt(f.time-.3)],a=pos(g,i),b=pos(f,i);if(!a||!b||f.time-g.time<.05)return 0;return (depth(O,a.x)-depth(O,b.x))/(f.time-g.time);};
 const owner=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=owner(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const goals=events.filter((e:any)=>e.kind==='goal').map((e:any)=>({t:e.time,s:e.side}));
 const shots=events.filter((e:any)=>e.kind==='shot').map((e:any)=>({t:e.time,s:e.side}));
 const z=(m:number)=>Array.from({length:m},()=>0);
 const D=[0,1].map(()=>({att:0,rest:z(4),lvl:z(4),guard:0,guardRole:{} as Record<string,number>,up:z(4),upAll:z(4),upJob:{} as Record<string,number>,upCover:[z(4),z(4),z(4),z(4)],defFrames:0,defUp:z(4),defUpAll:z(4),
  loss:[0,0,0,0,0,0,0,0],lossBy:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]],examples:[] as any[]}));
 let nextT=-1;
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.restart)continue;
  const o=owner(f);if(!o)continue;
  if(f.time<nextT-1e-6)continue;nextT=f.time+.2;
  const S=sideOf(o),O=1-S,ci=idx.get(o)!;const carrier=pos(f,ci);if(!carrier)continue;
  const bd=depth(S,f.ball.x);
  // the defending side's men left up (as seen from S: nearer S's goal than the ball by MARGIN, not pressing)
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
 // losses in an established attack
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
  if((st>=1||gl)&&D[S].examples.length<8)D[S].examples.push({t:Math.round(f.time*10)/10,ballDepth:Math.round(bd*10)/10,rest,theirUp:up,theirStationed:st,goal12:gl,shot12:sh});
 }
 return D;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const row:any=deepPlay(t,R=>traceKeys(R));
 return {arm:row.arm,seed:row.seed,build:row.build,ours:row.ours,styles:row.styles,forms:row.forms,score:row.score,ms:row.ms,trace:row.st};
}
