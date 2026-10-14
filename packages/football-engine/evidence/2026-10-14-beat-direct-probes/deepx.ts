// Beat-direct probes (2026-10-14): ../2026-10-12-deep-study/deep.ts with the probe arms (./arms.ts) and one hook (tweak: the option on the test side's engine Tactics). Nothing else changed.
// Deep study (2026-10-12): one rich row per match on the live build (ENGINE_BUILD 3af89fa9). Evidence only.
//
// One neutral-mirror match (../2026-10-10-cloud-measure/mirror.ts inputOf: the same five on both sides, outfield
// skills 6, no plans, no subs; every existing arm works: <a><f>v<b><g> style x formation, p-/m-<skill>, di-/sh-<skill>)
// through EXACTLY the runMatch call computeMatch makes (lib/ballers/compute.ts: no plans and no orders -> coordinated,
// substitutions none, record:true). No hook, no patch: the match is the official one, the last-attack rule included
// (it lives in the engine). The row's `official` block is computed from compact() exactly as mirror.ts play() computes
// its row from computeMatch, so analyze.mjs --parity can prove the two agree field for field.
//
// Everything else reads the recorded result (frames every 0.1 s and at incidents, events, job choices) and is summed
// per side in `agg[side]` (keys documented at the end of this file). Depth = metres from the side's own goal line
// (pitch 48 x 30); thirds at 16 and 32 m. A clear chance = a shot whose table goal rate is >= 0.30.
import {runMatch} from '../../src/index';
import {engineTeam,compact} from '../../../../lib/ballers/compute';
import {matchChances,shotChance,CHANCE_TABLE} from '../../../../lib/ballers/chances';
import {inputOf,armTreatment,tweak} from './arms';
export {armTreatment};

const L=48,CLEAR=.3;
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100,r3=(v:number)=>Math.round(v*1000)/1000;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const third=(d:number)=>d<16?0:d<32?1:2;

// ---- the official row (mirror.ts play(), verbatim logic) -------------------------------------------------------
function classify(frames:any[],shotT:number,side:0|1){
 let i=frames.findIndex((f:any)=>f.t>shotT);if(i<0)i=frames.length;i=Math.max(0,i-1);
 let j=i;while(j>0&&frames[j-1].ps===side)j--;
 const f0=frames[j];
 let restart=false;for(let k=j;k<=Math.min(i,j+3);k++)if(frames[k].r){restart=true;break;}
 const x=f0.b[0]/100,startX=side===0?x:48-x;
 return {startT:f0.t,startX,restart};
}
function official(inp:any,c:any,engineBuild:string){
 const ev=c.chunks.flatMap((ch:any)=>ch.e);
 const ch=matchChances(ev,c.header,engineBuild);
 const sideOf=new Map(c.header.players.map((p:any)=>[p.i,p.side]));
 const frames:any[]=c.chunks.flatMap((x:any)=>x.f);
 const shots=ev.filter((e:any)=>e.k==='shot'&&(e.s===0||e.s===1||sideOf.has(e.a)));
 let any:[number,number]|null=[0,0];
 for(const e of shots){const v=shotChance(e);const s=(e.s??sideOf.get(e.a)) as 0|1;if(v===null){any=null;break;}any[s]+=v;}
 const scored=new Set<any>();
 for(const g of ev)if(g.k==='goal'&&(g.s===0||g.s===1)){for(let k=shots.length-1;k>=0;k--){const x=shots[k];if(x.t>g.t)continue;if(x.t<g.t-4000)break;if((x.s??sideOf.get(x.a))===g.s){scored.add(x);break;}}}
 // [side, chance, kind (0 read, 1 header, 2 volley, 3 direct fk), origin, start x (m), secs from spell start, match second, shooter index, goal, engine read q]
 const shotRows=shots.map((e:any)=>{
  const side=(e.s??sideOf.get(e.a)) as 0|1,cl=classify(frames,e.t,side);
  let rk:string|null=null;
  if(cl.restart){for(let k=ev.indexOf(e)-1;k>=0;k--){const x=ev[k];if(x.t<cl.startT-1500)break;if(x.rk){rk=x.rk;break;}}if(!rk)rk='restart';}
  return [side,r3(shotChance(e)??0),e.q!==undefined?0:e.sk??-1,rk??'won',Math.round(cl.startX*10)/10,Math.round((e.t-cl.startT)/100)/10,Math.round(e.t/1000),e.a??null,scored.has(e)?1:0,e.q??null];
 });
 const full=inp.duration*1000,lateEv=ev.filter((e:any)=>e.t>full),f900=frames.filter((f:any)=>f.t<=full).at(-1);
 const per=(pick:(e:any)=>boolean)=>[0,1].map(s=>lateEv.filter((e:any)=>pick(e)&&(e.s??sideOf.get(e.a))===s).length);
 const late={played:c.header.duration,at900:f900?.s??null,goals:per((e:any)=>e.k==='goal'),shots:per((e:any)=>e.k==='shot'),
  clear:per((e:any)=>e.k==='shot'&&(shotChance(e)??0)>=.3),last:lateEv.filter((e:any)=>e.k!=='end').at(-1)?.k??null};
 const st=(s:0|1)=>{const x:any=c.stats[s];return {poss:Math.round(x.possession*10)/10,passes:x.passes,completed:x.completed,shots:x.shots,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,fouls:x.fouls};};
 return {score:c.score,chances:ch?ch.map(r3):null,chancesAny:any?any.map(r3):null,stats:[st(0),st(1)],shots:shotRows,late};
}

// ---- the match ------------------------------------------------------------------------------------------------
export function play(t:{label:string;arm:string;seed:number;rev:string},extra?:(R:any,inp:any)=>any){
 const inp=inputOf(t.arm,t.seed),teams=inp.sides.map(engineTeam) as any;tweak(t.arm,teams,t.seed%2);const t0=performance.now();
 const run:any=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true} as any);
 const ms=Math.round(performance.now()-t0),R=run.result;
 const c=compact(inp,R);
 const off=official(inp,c,run.engineBuild);
 const tr=armTreatment(t.arm),treated=t.seed%2;
 const roster:{id:string;side:number;role:string}[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const roleOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].role:'?';
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const outfield=(s:number)=>roster.map((p,i)=>({i,p})).filter(x=>x.p.side===s&&x.p.role!=='GK').map(x=>x.i);
 const team=(f:any,s:number)=>outfield(s).map(i=>({i,q:pos(f,i)})).filter(x=>x.q);
 const n=frames.length;
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const evIdxAt=(time:number)=>{let lo=0,hi=events.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(events[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best;};
 const jobsBy=new Map<number,any[]>();
 for(const ch of choices){const a=jobsBy.get(ch.player)??[];a.push(ch);jobsBy.set(ch.player,a);}
 const jobAt=(i:number,time:number)=>{const a=jobsBy.get(i);if(!a)return null;let lo=0,hi=a.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}
  const ch=best>=0?a[best]:null;return ch?{kind:ch.kind,purpose:ch.assignment?.purpose??null}:null;};
 // shot chance per engine shot event, from the compact events (same table as the official row)
 const chanceAt=new Map<number,number>();
 for(const ch of c.chunks)for(const e of ch.e)if(e.k==='shot')chanceAt.set(e.t,shotChance(e)??0);
 const chanceOf=(e:any)=>{const t=Math.round(e.time*1000);for(const d of [0,1,-1,2,-2]){const v=chanceAt.get(t+d);if(v!==undefined)return v;}return 0;};

 // possession per frame (last side in control; a restart counts for its side) and spells
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 type Spell={side:number;k0:number;k1:number;t0:number;t1:number;how:string;startDepth:number;shots:any[];endHow:string};
 const spells:Spell[]=[];
 for(let k=0;k<n;){
  const s=poss[k];let j=k;while(j+1<n&&poss[j+1]===s)j++;
  if(s>=0){
   const f=frames[k],st0=f.time;let how='loose';
   if(f.restart&&f.restartInfo)how='r:'+f.restartInfo.kind;
   else if(k===0)how='r:kickoff';
   else{
    const prevT=spells.length?spells[spells.length-1].t0:0;
    for(let e=evIdxAt(st0);e>=0&&events[e].time>=prevT-1e-6&&events[e].time>st0-3;e--){
     const ev=events[e],es=ev.side;
     if(ev.kind==='save'&&es===s){how='keeper';break;}
     if(ev.kind==='tackle'&&es===s&&st0-ev.time<2){how='tackle';break;}
     if(ev.kind==='block'&&es===s){how='block';break;}
     if(es===1-s&&(ev.kind==='pass'||ev.kind==='clearance'||ev.kind==='shot')){how=ev.kind==='pass'?(ev.aerial?'intercept-loft':'intercept'):ev.kind==='clearance'?'clearance':'shot-loose';break;}
    }
   }
   spells.push({side:s,k0:k,k1:j,t0:st0,t1:frames[j].time,how,startDepth:depth(s,frames[k].ball.x),shots:[],endHow:''});
  }
  k=j+1;
 }
 const spellAt=(time:number,s:number)=>{for(let q=spells.length-1;q>=0;q--){const sp=spells[q];if(sp.t0<=time+1e-6)return sp.side===s?sp:null;}return null;};
 for(const e of events)if(e.kind==='shot'&&(e.side===0||e.side===1)){const sp=spellAt(e.time,e.side);if(sp)sp.shots.push({t:e.time,ch:chanceOf(e)});}
 for(let q=0;q<spells.length;q++){const sp=spells[q],nx=spells[q+1];sp.endHow=!nx?'end':frames[nx.k0].restart?'restart':'lost';}
 const after=(sp:Spell|null,from:number,to:number)=>{let shots=0,clear=0,good=0;if(sp)for(const x of sp.shots)if(x.t>from+1e-6&&x.t<=to+1e-6){shots++;good+=x.ch;if(x.ch>=CLEAR)clear++;}return [shots,clear,good];};

 // ---- per-side accumulators
 const mk=()=>({
  goals:0,shots:0,clear:0,good:0,onTarget:0,headers:0,goalsHalf:[0,0],goalsLate:0,
  pg:[[0,0],[0,0],[0,0],[0,0]],pl:[[0,0],[0,0]],restartPasses:0,fwd:[0,0],back:0,behind:[0,0],intoFinal:[0,0],passOut:{lost:0,out:0,offside:0,foul:0,other:0},
  spells:0,spellsDeep:0,reached:0,ent:{carry:[0,0,0,0],ground15:[0,0,0,0],groundShort:[0,0,0,0],loft:[0,0,0,0],other:[0,0,0,0]},
  entryPasses:[0,0,0,0,0,0,0],runs:{} as Record<string,Record<string,number[]>>,depthDeep:[0,0,0,0,0,0],
  regain:[0,0,0],regainHow:{} as Record<string,number>,ownThirdHanded:[0,0],counter:[0,0,0,0,0],
  looseWon:0,receives:0,quickLoss:0,restarts:{} as Record<string,number>,
  dist:0,hs:[0,0,0],energyEnd:0,energyMin:100,energyHalf:0,eng:null as any,
  x:{press:[0,0,0,0],long:[0,0,0,0,0,0],sweep:[0,0],mv:[] as any[],lr:[] as any[],pl:[] as any[]}});
 const A=[mk(),mk()];

 // goals and shots (engine events; the official row has the per-shot list)
 for(const e of events){
  if(e.side!==0&&e.side!==1)continue;const S=e.side;
  if(e.kind==='goal'){A[S].goals++;if(e.time<=450)A[S].goalsHalf[0]++;else A[S].goalsHalf[1]++;if(e.time>720)A[S].goalsLate++;}
  if(e.kind==='shot'){const ch=chanceOf(e);A[S].shots++;A[S].good+=ch;if(ch>=CLEAR)A[S].clear++;if(e.technique==='header')A[S].headers++;}
  if(e.kind==='save'&&S!==-1){/* a save by side S = a shot on target by 1-S */A[1-S].onTarget++;}
  if(e.restartKind){A[S].restarts[e.restartKind]=(A[S].restarts[e.restartKind]??0)+1;}
 }
 for(const S of [0,1])A[S].onTarget+=A[S].goals;

 // passes
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1))continue;
  const S=e.side,D=1-S,a=A[S],f=frames[frameAt(e.time)],pi=idx.get(e.actor)!,p=pos(f,pi),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  if(e.restartKind){a.restartPasses++;continue;}
  const len=dist(p,aim),from=depth(S,p.x),to=depth(S,aim.x),gain=to-from,defs=team(f,D),lastLine=Math.min(...defs.map(d=>depth(D,d.q.x)));
  let outcome='other';
  for(let r=q+1;r<events.length&&events[r].time<e.time+8;r++){const x=events[r];
   if(x.kind==='receive'&&x.side===S){outcome='kept';break;}
   if(x.kind==='turnover'||x.kind==='save'||(x.kind==='tackle'&&x.side===D)||x.kind==='block'||x.kind==='clearance'){outcome='lost';break;}
   if(x.kind==='out'||x.kind==='offside'||x.kind==='foul'){outcome=x.kind;break;}
  }
  const kept=outcome==='kept'?1:0;
  if(!kept)(a.passOut as any)[outcome]++;
  if(e.aerial){const b=len<20?0:1;a.pl[b][0]++;a.pl[b][1]+=kept;}
  else{const b=len<8?0:len<15?1:len<25?2:3;a.pg[b][0]++;a.pg[b][1]+=kept;}
  if(gain>=5){a.fwd[0]++;a.fwd[1]+=kept;}else if(gain<=-2)a.back++;
  if(depth(D,aim.x)<lastLine-.3){a.behind[0]++;a.behind[1]+=kept;}
  if(from<32&&to>=32){a.intoFinal[0]++;a.intoFinal[1]+=kept;}
  // the receiver's job at the pass: runs (kind 'run') by purpose and role; the direct-edge entry passes
  const ri=idx.get(e.target);if(ri===undefined)continue;
  const job=jobAt(ri,e.time),sp=spellAt(e.time,S),[sh8,cl8,gd8]=after(sp,e.time,e.time+8),rRole=roster[ri].role;
  if(job?.kind==='run'){
   const pu=job.purpose??'none',m=(a.runs[pu]??={}),v=(m[rRole]??=[0,0,0,0]);
   v[0]++;v[1]+=kept;v[2]+=sh8;v[3]+=cl8;
  }
  if(from<32&&to>=28){
   const ep=a.entryPasses;ep[0]++;if(e.aerial)ep[1]++;else if(len>=15)ep[2]++;ep[3]+=kept;ep[4]+=cl8;if(roster[pi].role==='CB')ep[5]++;ep[6]+=gd8;
   if(job?.purpose==='depth'&&rRole!=='ST'){const dd=a.depthDeep;dd[0]++;dd[1]+=kept;dd[2]+=sh8;dd[3]+=cl8;dd[4]+=gd8;dd[5]+=lastLine;}
  }
 }

 // (2026-10-12, stop-direct) extra keys in agg[side].x; nothing above changes
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
  const S=e.side,D=1-S,x=A[S].x,f=frames[frameAt(e.time)],p=pos(f,idx.get(e.actor)!),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
  const len=dist(p,aim),from=depth(S,p.x),to=depth(S,aim.x);
  if(from<32&&to>=28){const near=Math.min(...team(f,D).map(d=>dist(p,d.q)));x.press[0]++;x.press[1]+=near;if(near<2.5)x.press[2]++;if(near<4)x.press[3]++;}
  if((e.aerial||len>=15)&&to-from>=5){
   x.long[0]++;let k=frameAt(e.time)+1,loose=false,cat=5;
   for(;k<n&&frames[k].time<=e.time+4;k++){const g=frames[k];if(g.restart){cat=5;break;}const o=g.ball?.owner;
    if(o&&!(o===e.actor&&g.time<e.time+.3)){const w=sideOf(o);cat=loose?(w===S?3:4):(w===S?1:2);break;}
    if(g.ball?.mode==='loose')loose=true;}
   x.long[cat]++;
   // (2026-10-12, passer pressure) x.pl: the passer's nearest outfield defender at every long ball
   x.pl.push([e.aerial?1:0,Math.round(len),Math.round(from),Math.round(to),Math.round(Math.min(...team(f,D).map(d=>dist(p,d.q)))*10)/10,cat,roster[idx.get(e.actor)!].role]);
  }
 }
 for(const S of [0,1]){const gk=roster.findIndex(p=>p.side===S&&p.role==='GK');if(gk<0)continue;let prev='';
  for(const ch of jobsBy.get(gk)??[]){if(ch.kind==='sweep'&&prev!=='sweep'){A[S].x.sweep[0]++;
    for(let k=frameAt(ch.time);k<n&&frames[k].time<=ch.time+3;k++)if(frames[k].ball?.owner===roster[gk].id){A[S].x.sweep[1]++;break;}}
   prev=ch.kind;}}

 // spells: funnel and entries into the attacking third, regains, counters
 for(const sp of spells){
  const S=sp.side,a=A[S];a.spells++;
  const regain=!sp.how.startsWith('r:');
  if(regain){a.regain[third(sp.startDepth)]++;a.regainHow[sp.how]=(a.regainHow[sp.how]??0)+1;}
  if(sp.startDepth>=32)continue;
  a.spellsDeep++;
  let ke=-1;for(let k=sp.k0;k<=sp.k1;k++){if(depth(S,frames[k].ball.x)>=32){ke=k;break;}}
  if(regain&&sp.startDepth<16){a.ownThirdHanded[0]++;if(sp.endHow!=='end'&&sp.t1-sp.t0<8&&!sp.shots.some(x=>x.t<=sp.t0+8))a.ownThirdHanded[1]++;}
  if(regain){
   const reach=ke>=0&&frames[ke].time<=sp.t0+8;const [s12,c12,g12]=after(sp,sp.t0-1e-3,sp.t0+12);
   const v=a.counter;v[0]++;if(reach)v[1]++;v[2]+=s12;v[3]+=c12;v[4]+=g12;
  }
  if(ke<0)continue;
  a.reached++;
  const fe=frames[ke],te=fe.time,o=fe.control?.owner??fe.ball?.owner??null;
  let type='other';
  if(o&&sideOf(o)===S){
   // when did he get it: his last control start at or before te
   let ctl=-1;for(let r=evIdxAt(te);r>=0&&events[r].time>=sp.t0-1e-6;r--){const x=events[r];if(x.actor===o&&(x.kind==='receive'||x.kind==='turnover'||x.kind==='save')){ctl=x.time;break;}}
   const cq=ctl>=0?pos(frames[frameAt(ctl)],idx.get(o)!):null;
   if(cq&&depth(S,cq.x)<31.5&&te-ctl>.15)type='carry';
  }
  if(type==='other'){
   for(let r=evIdxAt(te);r>=0&&events[r].time>=sp.t0-1e-6;r--){const x=events[r];
    if(x.side===S&&(x.kind==='pass'||x.kind==='clearance')){
     if(x.kind==='pass'){const fp=frames[frameAt(x.time)],pp=pos(fp,idx.get(x.actor)!),aim=x.pass?.aim??x.aerial?.aim;
      type=x.aerial?'loft':pp&&aim&&dist(pp,aim)>=15?'ground15':'groundShort';}
     break;}
   }
  }
  const [s,cl,g]=after(sp,te-1e-3,sp.t1),v=(a.ent as any)[type];v[0]++;v[1]+=s;v[2]+=cl;v[3]+=g;
 }

 // loose balls: who wins the ball after it ran free (open play)
 for(let k=1;k<n;){
  const f=frames[k];
  if(!f.restart&&!f.ball.owner&&f.ball.mode==='loose'){
   let j=k;while(j+1<n&&!frames[j+1].restart&&!frames[j+1].ball.owner&&frames[j+1].ball.mode==='loose')j++;
   const nx=frames[j+1];if(nx&&!nx.restart&&nx.ball.owner){const w=sideOf(nx.ball.owner);if(w>=0)A[w].looseWon++;}
   k=j+1;
  }else k++;
 }

 // (2026-10-12, long-ball origins) x.mv one entry per shot (where the move came from), x.lr one entry per long ball
 // (the reception). Additive: nothing above changes. Keys documented at the end of this file.
 {
  const L1=(v:number)=>Math.round(v*10)/10;
  const choiceAt=(i:number,time:number)=>{const a=jobsBy.get(i);if(!a)return null;let lo=0,hi=a.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best>=0?a[best]:null;};
  const ownerAt=(k:number)=>{const g=frames[k];return g.restart?null:(g.control?.owner??g.ball?.owner??null);};
  const facing=(S:number,ang:number)=>Math.cos(ang)*(S===0?1:-1);
  // goals -> the shot that scored (same rule as the official row: the side's last shot within 4 s before the goal)
  const shotEv=events.filter(e=>e.kind==='shot'&&(e.side===0||e.side===1));
  const scoredT=new Set<number>();
  for(const g of events)if(g.kind==='goal'&&(g.side===0||g.side===1)){for(let k=shotEv.length-1;k>=0;k--){const x=shotEv[k];if(x.time>g.time+1e-6)continue;if(x.time<g.time-4)break;if(x.side===g.side){scoredT.add(x.time);break;}}}
  const passLen=(e:any)=>{const f=frames[frameAt(e.time)],p=pos(f,idx.get(e.actor)!),aim=e.pass?.aim??e.aerial?.aim;return p&&aim?{p,aim,len:dist(p,aim)}:null;};
  for(const e of shotEv){
   const S=e.side,sp=spellAt(e.time,S),ks=frameAt(e.time);
   const shooter=idx.get(e.actor),shPos=shooter!==undefined?pos(frames[ks],shooter):null;
   const row:any[]=[r3(chanceOf(e)),scoredT.has(e.time)?1:0,sp?sp.how:'?',sp?L1(sp.startDepth):-1,sp?L1(e.time-sp.t0):-1];
   let type='none',tEntry=-1,eLen=-1,eFrom=-1,second=0,passesAfter=-1,playersAfter=-1,selfShot=0,recvRole='?';
   let lp:any=null,spellLong=0;
   if(sp){
    // the last time the ball crossed into the attacking third (>= 32 m) in this spell before the shot
    let ke=-1;for(let k=ks;k>sp.k0;k--){if(depth(S,frames[k].ball.x)>=32&&depth(S,frames[k-1].ball.x)<32){ke=k;break;}}
    if(ke<0)type=sp.startDepth>=32?'high':'none';
    else{
     const fe=frames[ke],te=fe.time,o=ownerAt(ke);type='other';
     if(o&&sideOf(o)===S){
      let ctl=-1;for(let r=evIdxAt(te);r>=0&&events[r].time>=sp.t0-1e-6;r--){const x=events[r];if(x.actor===o&&(x.kind==='receive'||x.kind==='turnover'||x.kind==='save')){ctl=x.time;break;}}
      const cq=ctl>=0?pos(frames[frameAt(ctl)],idx.get(o)!):null;
      if(cq&&depth(S,cq.x)<31.5&&te-ctl>.15)type='carry';
     }
     let entryPass:any=null;
     if(type==='other'){
      for(let r=evIdxAt(te);r>=0&&events[r].time>=sp.t0-1e-6;r--){const x=events[r];
       if(x.side===S&&(x.kind==='pass'||x.kind==='clearance')){
        if(x.kind==='pass'){const pl=passLen(x);type=x.aerial?'loft':pl&&pl.len>=15?'ground15':'groundShort';entryPass=x;if(pl){eLen=L1(pl.len);eFrom=L1(depth(S,pl.p.x));}}
        else type='clearance';
        break;}
      }
     }
     tEntry=L1(e.time-te);
     // the entry's reception: the first owner after the entry pass (or the carrier at the entry)
     let tr=te,recv=o;
     if(entryPass){for(let k=frameAt(entryPass.time)+1;k<=ks;k++){const g=frames[k],ow=g.ball?.owner;if(ow&&!(ow===entryPass.actor&&g.time<entryPass.time+.3)){recv=ow;tr=g.time;break;}if(g.ball?.mode==='loose')second=1;}}
     if(recv&&idx.has(recv))recvRole=roleOf(recv);
     passesAfter=0;const touched=new Set<string>();
     for(let k=frameAt(tr);k<=ks;k++){const ow=frames[k].ball?.owner;if(ow&&sideOf(ow)===S)touched.add(ow);}
     playersAfter=touched.size;
     for(let r=evIdxAt(tr)+1;r<events.length&&events[r].time<e.time-1e-6;r++){const x=events[r];if(x.kind==='pass'&&x.side===S&&x.time>tr+1e-6)passesAfter++;}
     selfShot=recv===e.actor&&passesAfter===0?1:0;
    }
    // the last pass by the side before the shot (in the spell)
    for(let r=evIdxAt(e.time-1e-4);r>=0&&events[r].time>=sp.t0-1e-6;r--){const x=events[r];
     if(x.kind==='pass'&&x.side===S&&!x.restartKind&&x.actor!==e.actor){const pl=passLen(x);if(pl)lp=[L1(pl.len),L1(depth(S,pl.p.x)),L1(depth(S,pl.aim.x)),L1(Math.abs(pl.p.y-15)),x.aerial?1:0,L1(e.time-x.time)];break;}
     if(x.kind==='pass'&&x.side===S&&x.actor===e.actor)break;}
    for(let r=evIdxAt(e.time-1e-4);r>=0&&events[r].time>=sp.t0-1e-6;r--){const x=events[r];if(x.kind==='pass'&&x.side===S&&!x.restartKind){const pl=passLen(x);if(pl&&(x.aerial||pl.len>=15)&&depth(S,pl.aim.x)-depth(S,pl.p.x)>=5){spellLong=1;break;}}}
   }
   // the shooter's own carry: from his last control start to the shot
   let carryM=-1,heldS=-1;
   if(shooter!==undefined&&shPos){for(let r=evIdxAt(e.time-1e-4);r>=0&&events[r].time>e.time-15;r--){const x=events[r];if(x.actor===e.actor&&(x.kind==='receive'||x.kind==='turnover'||x.kind==='save'||x.kind==='restart')){const q=pos(frames[frameAt(x.time)],shooter);if(q){carryM=L1(dist(q,shPos));heldS=L1(e.time-x.time);}break;}if(x.kind==='pass'||x.kind==='shot'||x.kind==='clearance')break;}}
   row.push(type,tEntry,eLen,eFrom,second,passesAfter,playersAfter,selfShot,recvRole,lp,carryM,heldS,spellLong,e.technique??null,shPos?L1(depth(S,shPos.x)):-1,e.firstTime?1:0);
   A[S].x.mv.push(row);
  }
  // long balls: the reception
  for(let q=0;q<events.length;q++){
   const e=events[q];if(e.kind!=='pass'||(e.side!==0&&e.side!==1)||e.restartKind)continue;
   const S=e.side,D=1-S,k0=frameAt(e.time),f=frames[k0],p=pos(f,idx.get(e.actor)!),aim=e.pass?.aim??e.aerial?.aim;if(!p||!aim)continue;
   const len=dist(p,aim),from=depth(S,p.x),to=depth(S,aim.x);
   if(!((e.aerial||len>=15)&&to-from>=5))continue;
   const ti=idx.get(e.target);if(ti===undefined)continue;
   const defs0=team(f,D),tq0=pos(f,ti);if(!tq0||!defs0.length)continue;
   const lastLine=Math.min(...defs0.map(d=>depth(D,d.q.x)));
   const dRel=Math.min(...defs0.map(d=>dist(tq0,d.q)));
   // the defender marking the target at the pass (his job's target is the receiver)
   let marker=-1;for(const d of defs0){const c=choiceAt(d.i,e.time);if(c?.assignment?.target===e.target&&(c.assignment.purpose==='mark'||c.kind==='track')){marker=d.i;break;}}
   // arrival: the first frame the ball has an owner (not the passer just after release) or a restart
   let ka=-1,loose=false,cat=5;
   for(let k=k0+1;k<n&&frames[k].time<=e.time+4;k++){const g=frames[k];if(g.restart){cat=5;ka=k;break;}const o=g.ball?.owner;
    if(o&&!(o===e.actor&&g.time<e.time+.3)){const w=sideOf(o);cat=loose?(w===S?3:4):(w===S?1:2);ka=k;break;}
    if(g.ball?.mode==='loose')loose=true;}
   if(ka<0){A[S].x.lr.push([e.aerial?1:0,L1(len),L1(from),L1(to),cat,-1]);continue;}
   const fa=frames[ka],ta=fa.time,tq=pos(fa,ti),ow=ownerAt(ka)??fa.ball?.owner;
   const defs=team(fa,D);let near=-1,dNear=99;
   if(tq)for(const d of defs){const dd=dist(tq,d.q);if(dd<dNear){dNear=dd;near=d.i;}}
   const nq=near>=0?pos(fa,near):null,goalSide=nq&&tq?(depth(D,nq.x)<depth(D,tq.x)?1:0):-1;
   const mq=marker>=0?pos(fa,marker):null,dMark=mq&&tq?dist(mq,tq):-1;
   const nc=near>=0?choiceAt(near,ta):null;
   const clean=cat===1&&ow===e.target?1:0;
   // outcomes from the reception (only when the side has it)
   let turned=0,faced=0,lost3=0,cl8=0,sh8=0,gl8=0;
   if(ow&&sideOf(ow)===S){
    const ri=idx.get(ow)!,rq=pos(fa,ri);
    for(let k=ka;k<n&&frames[k].time<=ta+1.5;k++){const g=frames[k];if(g.restart)break;const o2=g.ball?.owner;if(o2&&sideOf(o2)!==S)break;
     if(o2===ow){const z=pos(g,ri);if(z&&rq&&depth(S,z.x)-depth(S,rq.x)>=2)turned=1;if(z&&g.time>=ta+.3&&facing(S,z.angle)>.5)faced=1;}}
    for(let r=evIdxAt(ta)+1;r<events.length&&events[r].time<=ta+1.5;r++){const x=events[r];if(x.actor!==ow)continue;
     if(x.kind==='shot'){turned=1;break;}
     if(x.kind==='pass'){const pl=passLen(x);if(pl&&depth(S,pl.aim.x)-depth(S,pl.p.x)>=3)turned=1;break;}
     if(x.kind==='turnover'||x.kind==='clearance')break;}
    for(let k=ka;k<n&&frames[k].time<=ta+3;k++){const g=frames[k];const o2=g.restart?null:g.ball?.owner;if(o2&&sideOf(o2)===D){lost3=1;break;}if(g.restart&&g.restartInfo?.side===D){lost3=1;break;}}
    const sp2=spellAt(ta,S);const [s8,c8]=after(sp2,ta-1e-3,ta+8);sh8=s8;cl8=c8;
    if(sp2)for(const x of sp2.shots)if(x.t>ta&&x.t<=ta+8&&scoredT.has(x.t))gl8++;
   }
   A[S].x.lr.push([e.aerial?1:0,L1(len),L1(from),L1(to),cat,r2(ta-e.time),L1(dRel),L1(dNear),goalSide,near>=0&&near===marker?1:0,L1(dMark),clean,turned,faced,lost3,sh8,cl8,gl8,
    roster[ti].role,L1(depth(D,aim.x)-lastLine),nc?.assignment?.purpose??nc?.kind??null,ow===e.target?1:0]);
  }
 }

 // receptions lost within 1.5 s before the receiver releases (heavy touch / dispossessed on receipt)
 for(let q=0;q<events.length;q++){
  const e=events[q];if(e.kind!=='receive'||(e.side!==0&&e.side!==1))continue;
  const S=e.side;A[S].receives++;
  for(let r=q+1;r<events.length&&events[r].time<=e.time+1.5;r++){const x=events[r];
   if(x.actor===e.actor&&(x.kind==='pass'||x.kind==='clearance'||x.kind==='shot'))break;
   if((x.kind==='turnover'||x.kind==='save')&&x.side===1-S){A[S].quickLoss++;break;}
   if(x.kind==='out'||x.kind==='foul'||x.kind==='restart')break;
  }
 }

 // movement and energy (outfielders)
 for(const S of [0,1]){
  const ids=outfield(S),a=A[S];
  for(let k=1;k<n;k++){const f=frames[k],g=frames[k-1];if(f.cut)continue;const dt=f.time-g.time;if(dt<=0||dt>.25)continue;
   for(const i of ids){const p=pos(f,i),q=pos(g,i);if(!p||!q)continue;const d=dist(p,q);a.dist+=d;const v=Math.hypot(p.vx,p.vy);if(v>4)a.hs[0]+=d;if(v>5.5)a.hs[1]+=d;if(v>6.5)a.hs[2]+=d;}}
  const fe=frames[frameAt(900)],fh=frames[frameAt(450)];let e1=0,e2=0,c1=0;
  for(const i of ids){const p=pos(fe,i),h=pos(fh,i);if(p){e1+=p.energy;c1++;a.energyMin=Math.min(a.energyMin,p.energy);}if(h)e2+=h.energy;}
  a.energyEnd=c1?e1/c1:0;a.energyHalf=c1?e2/c1:0;
  a.eng=R.stats[S];
 }
 const out=A.map(a=>{const o:any={...a};
  o.good=r3(a.good);o.dist=Math.round(a.dist);o.hs=a.hs.map(Math.round);o.energyEnd=r1(a.energyEnd);o.energyMin=r1(a.energyMin);o.energyHalf=r1(a.energyHalf);
  for(const k of Object.keys(o.ent))o.ent[k][3]=r3(o.ent[k][3]);o.entryPasses[6]=r3(a.entryPasses[6]);o.depthDeep[4]=r3(a.depthDeep[4]);o.depthDeep[5]=r1(a.depthDeep[5]);o.counter[4]=r3(a.counter[4]);o.x={...a.x,press:[a.x.press[0],r1(a.x.press[1]),a.x.press[2],a.x.press[3]]};
  const e:any={};for(const [k,v] of Object.entries(a.eng??{}))e[k]=typeof v==='number'?r2(v):v;o.eng=e;return o;});
 const sides=inp.sides as any[];
 return {label:t.label,kind:'deep',arm:t.arm,seed:t.seed,rev:t.rev,ours:treated,kickoff:inp.kickoff,duration:inp.duration,
  styles:sides.map(s=>s.style),forms:sides.map(s=>s.formation),skill:tr.skill?{side:treated,name:tr.skill,delta:tr.delta}:null,
  plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:run.engineBuild.slice(0,8),tableBuild:CHANCE_TABLE.build.slice(0,8),
  ...off,dropped:[],agg:out,ms,...(extra?{st:extra(R,inp)}:{})};
}
// agg[side] keys (per match, that side):
//  goals shots clear good(sum of table rates) onTarget(goals + opponent saves) headers goalsHalf[1st,2nd] goalsLate(after 12:00)
//  pg   open-play GROUND passes by length band [<8, 8-15, 15-25, 25+ m], each [attempts, kept by a team-mate (any)]
//  pl   open-play LOFTED passes [<20, 20+ m], each [attempts, kept]; restartPasses = passes that took a restart
//  fwd  [attempts, kept] gaining >= 5 m; back = passes losing >= 2 m; behind = aimed beyond the deepest outfield
//       defender [att, kept]; intoFinal = from < 32 m to >= 32 m [att, kept]; passOut = how the rest ended
//  spells (possession spells), spellsDeep (starting < 32 m), reached (of those, the ball got to >= 32 m in the spell)
//  ent  how a spell starting < 32 m first got the ball to >= 32 m: carry | ground15 (ground pass 15 m+) | groundShort |
//       loft | other, each [count, shots after in the spell, clear chances after, good chances after]
//  entryPasses  open-play passes from < 32 m aimed >= 28 m (direct-edge definition):
//       [n, lofted, ground 15 m+, kept, clear chances within 8 s in the spell, passer a CB, good chances within 8 s]
//  runs[purpose][receiverRole] passes to a receiver on a 'run' job: [n, kept, shots within 8 s, clear within 8 s]
//  depthDeep  entry passes to a non-striker on a 'depth' run (the direct-edge "pin and arrive"):
//       [n, kept, shots 8 s, clear 8 s, good 8 s, sum of the deepest defender's depth from his goal at the pass]
//  regain[own, middle, attacking third] open-play regains (spell not started by a restart) by where the spell began;
//       regainHow[tackle|intercept|intercept-loft|loose|keeper|block|clearance|shot-loose]
//  ownThirdHanded [own-third regains, handed back within 8 s without a shot]
//  counter  regains starting < 32 m: [n, ball reached >= 32 m within 8 s, shots within 12 s, clear within 12 s, good 12 s]
//  looseWon  loose balls (open play) this side got first; receives / quickLoss (lost within 1.5 s before releasing)
//  restarts[kind] restarts taken (the event that took it); dist / hs[>4, >5.5, >6.5 m/s] metres covered by the four outfielders
//  energyHalf / energyEnd mean outfield energy at 7:30 / 15:00, energyMin the lowest at 15:00; eng = engine stats
//  x (2026-10-12, stop-direct; rows made before it lack the key):
//    press  entry passes (as entryPasses) [n, sum of the nearest outfield defender's distance to the passer (m),
//           within 2.5 m, within 4 m]
//    long   open-play long balls (lofted, or ground 15 m+), gaining >= 5 m: [n, first touch ours with no loose ball,
//           first touch theirs with no loose ball, ran loose then ours, ran loose then theirs, nobody within 4 s / restart]
//    sweep  [keeper 'sweep' duty starts, the keeper had the ball within 3 s of the start]
//  x.mv, x.lr (2026-10-12, long-ball origins; rows made before it lack them):
//    mv   one entry per shot: [chance, goal (the side's last shot within 4 s before a goal), spell start (r:<restart> |
//         regain how), spell start depth, s from spell start, entry (the LAST time the ball crossed into >= 32 m in the
//         spell before the shot: carry | loft | ground15 | groundShort | clearance | other; high = spell began >= 32 m
//         and never left; none), s from entry to shot, entry pass length, entry pass from depth, second ball (the entry
//         pass ran loose before the side got it), passes by the side between the entry reception and the shot, players of
//         the side who had the ball from the reception to the shot, the entry receiver shot with no pass between, entry
//         receiver's role, last pass by a team-mate before the shot [len, from depth, to depth, from |y - 15|, lofted,
//         s before the shot] | null, shooter's carry m from his last control start, s he held it, the spell had a long
//         ball before the shot, technique, shot depth, first time]
//  x.pl (2026-10-12, passer pressure; rows made before it lack it): one entry per open-play long ball (as x.long):
//       [lofted, len (m), from depth, aim depth, nearest outfield defender to the passer at the pass (m), cat (as x.long), passer role]
//    lr   one entry per open-play long ball (lofted or ground 15 m+, gaining >= 5 m) with a named target: [lofted, len,
//         from depth, aim depth, cat (as x.long), s to arrival (first owner/restart; -1 none within 4 s: then only 6
//         fields), nearest defender to the target at the pass (m), at arrival (m), that defender goal-side of the target,
//         he is the target's marker (job target = target at the pass), the marker's distance at arrival (-1 none), clean
//         (cat 1 and the target has it), turned (within 1.5 s: shot, pass gaining >= 3 m, or carried >= 2 m forward),
//         faced goal (owning, 0.3-1.5 s, facing within 60 deg), lost within 3 s, shots / clear / goals within 8 s in the
//         spell, target role, aim depth beyond the deepest defender (m, from the defence's goal: negative = behind him),
//         nearest defender's job purpose at arrival, the target himself got it]
