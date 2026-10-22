// CB role (2026-10-23): the row entry. Evidence only: it reads the recorded match and changes nothing in the engine
// (ENGINE_BUILD c622728d, main). It is ../2026-10-21-engine-as-data/parity.ts (every parity fingerprint unchanged) plus
// extra.cb[0|1] (home, away), the reads this question needs. Roles are the ENGINE's slot roles (model.ts shapes: 1-2-1 =
// GK CB W W ST, 2-2 = GK CB CB W W); a substitute takes the slot's role (practice.ts applySubstitutions).
// depth(S, x) = metres from S's own goal line. Sampled frames: every 2nd recorded frame, never a restart frame.
// Possession per frame: the last owner's side (a restart: the taker's side), as ../2026-10-23-direct-edge/row.ts.
//
// extra.cb[S]:
//  team      {fm, commit, striker, line} S's resolved engine tactics
//  att[role] in S's possession, per player-frame of that role: [frames, in their half (depth >= 24), in their box
//            (depth >= 40, |y| <= 8), the side's deepest outfielder, ahead of the ball (deeper into their half than it)]
//  attHalf   frames in S's possession with the ball in their half: [frames, frames whose deepest outfielder is a CB]
//  attAll    frames in S's possession: [frames, frames whose deepest outfielder is a CB]
//  def[role] out of possession (the other side has it), per player-frame: [frames, the side's deepest outfielder]
//  shots[role] [shots, chance sum (lib/ballers/chances), goals, shots from a set piece, goals from a set piece]
//            set piece = the spell began with S's restart and is at most 8 s old at the shot
//  goalsBy   goals of S by the goal event's actor (last touch): his role, OG for an own goal
//  shotsMain shots by '<main role>@<slot role>' (main role = his first listed role in the squad): [shots, goals]
//  goalsCB   one entry per CB goal: [time, spell age s, set piece 0/1, CB depth 10 s before, shot depth, depth where the
//            spell began (the ball), CB was the deepest outfielder 10 s before 0/1]
//  loss      open-play losses (possession S -> other, no restart either frame): n, then per role [goal-side of the ball,
//            depth sum, the deepest outfielder, in their half, ahead of the ball]; noCB / withCB: [losses with no CB
//            goal-side of the ball (with at least one), their shots, chance sum, goals within 12 s of that loss]
//  mark[A|B][M1|M2|M3]  S defending; target A = their ST (slot role), B = their most advanced outfielder (nearest S's goal)
//            M1 frames in their possession with the target within 14 m of S's goal; M2 their open-play passes to him (at
//            the kick); M3 those passes aimed beyond S's deepest outfielder and inside S's half (a ball in behind)
//            {n, mk:{role|none: n} who has him (a defender whose current job is mark or press with him as target: CB if any
//            CB, else the first one's role), nr:{role: n} S's nearest outfielder, cbd: sum of the nearest CB's distance,
//            cbgs: n with a CB goal-side of him, cbn: n with a CB nearest}
import {setExtra} from '../2026-10-21-engine-as-data/parity';
import {shotChance} from '../../../../lib/ballers/chances';
export * from '../2026-10-21-engine-as-data/parity';

const L=48,HALF=24;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const r3=(v:number)=>Math.round(v*1000)/1000;
const inc=(o:Record<string,number>,k:string,v=1)=>{o[k]=(o[k]??0)+v;};
const vec=(o:Record<string,number[]>,k:string,n:number)=>o[k]??(o[k]=Array.from({length:n},()=>0));
const mark0=()=>({n:0,mk:{} as Record<string,number>,nr:{} as Record<string,number>,cbd:0,cbgs:0,cbn:0});

export function cbRole(runs:any[],teams:any[]){
 const out=[0,1].map(s=>{const t=teams[s]?.tactics??{};return {team:{fm:t.formation,commit:t.commit,striker:t.striker,line:t.line},
  att:{} as Record<string,number[]>,attHalf:[0,0],attAll:[0,0],def:{} as Record<string,number[]>,shots:{} as Record<string,number[]>,goalsBy:{} as Record<string,number>,shotsMain:{} as Record<string,number[]>,goalsCB:[] as number[][],
  loss:{n:0,role:{} as Record<string,number[]>,noCB:[0,0,0,0],withCB:[0,0,0,0]},
  mark:{A:{M1:mark0(),M2:mark0(),M3:mark0()},B:{M1:mark0(),M2:mark0(),M3:mark0()}}};});
 for(const R of runs){
  const roster:any[]=R.players??[],frames:any[]=R.frames??[],events:any[]=R.events??[];
  const n=frames.length;if(!n)continue;
  const idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
  const roleOfI=(i:number)=>roster[i].role as string;
  const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
  const frameAt=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
  const OF=[0,1].map(s=>roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.side===s&&x.p.role!=='GK').map((x:any)=>x.i as number));
  const onPitch=(f:any,s:number)=>OF[s].map(i=>({i,q:pos(f,i)})).filter((x:any)=>x.q) as {i:number;q:any}[];
  const deepestOf=(f:any,s:number)=>{let b=-1,bd=Infinity;for(const {i,q} of onPitch(f,s)){const d=depth(s,q.x);if(d<bd){bd=d;b=i;}}return b;};
  const owner=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
  // possession per frame, and spells (a new spell at a change of side or at a restart)
  const poss=new Int8Array(n),spellStart=new Float64Array(n),spellSet=new Uint8Array(n),spellFrom=new Float64Array(n);
  {let last=-1,start=0,set=0,from=0;
   for(let k=0;k<n;k++){const f=frames[k];const o=owner(f);let cur=last;
    if(o)cur=sideOf(o);else if(f.restart&&f.restartInfo)cur=f.restartInfo.side;
    if(f.restart){if(!(k>0&&frames[k-1].restart&&cur===last)){start=f.time;set=1;from=cur>=0?depth(cur,f.ball.x):0;}}
    else if(cur!==last){start=f.time;set=0;from=cur>=0?depth(cur,f.ball.x):0;}
    last=cur;poss[k]=cur;spellStart[k]=start;spellSet[k]=set;spellFrom[k]=from;}}
  // each player's current job (purpose, target) from the recorded decisions (challenge / action records carry none)
  const jobT:number[][]=roster.map(()=>[]),jobTarget:string[][]=roster.map(()=>[]),jobPurpose:string[][]=roster.map(()=>[]);
  for(const c of R.choices??[]){if(c.challenge||c.action)continue;const i=c.player;if(!(i>=0&&i<roster.length))continue;
   jobT[i].push(c.time);jobTarget[i].push(c.assignment?.target??'');jobPurpose[i].push(c.assignment?.purpose??'');}
  const jobAt=(i:number,t:number)=>{const a=jobT[i];let lo=0,hi=a.length-1,b=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m]<=t+1e-6){b=m;lo=m+1;}else hi=m-1;}
   return b<0?null:{target:jobTarget[i][b],purpose:jobPurpose[i][b]};};
  // the player's own main role (his first listed role in the club's squad), as the league's per-role tables count it
  const mainRole=new Map<string,string>();for(const tm of teams)for(const p of tm?.squad??[])mainRole.set(String(p.id),p.roles?.[0]??'?');
  const mainOf=(i:number)=>{const id=String(roster[i].id);return mainRole.get(id)??mainRole.get(id.replace(/^\d+:/,''))??roster[i].roles?.[0]??'?';};
  const chanceOf=(e:any)=>{const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;
   return shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;};
  // ---- sampled frames: possession and defence shape
  for(let k=0;k<n;k+=2){const f=frames[k];if(f.restart)continue;const S=poss[k];if(S!==0&&S!==1)continue;const T=1-S;
   const bS=depth(S,f.ball.x),dS=deepestOf(f,S),dT=deepestOf(f,T);
   const deepCB=dS>=0&&roleOfI(dS)==='CB';
   out[S].attAll[0]++;if(deepCB)out[S].attAll[1]++;
   if(bS>=HALF){out[S].attHalf[0]++;if(deepCB)out[S].attHalf[1]++;}
   for(const {i,q} of onPitch(f,S)){const v=vec(out[S].att,roleOfI(i),5),d=depth(S,q.x);
    v[0]++;if(d>=HALF)v[1]++;if(d>=L-8&&Math.abs(q.y)<=8)v[2]++;if(i===dS)v[3]++;if(d>bS)v[4]++;}
   for(const {i} of onPitch(f,T)){const v=vec(out[T].def,roleOfI(i),2);v[0]++;if(i===dT)v[1]++;}
   // S has the ball: T defends. Targets: S's ST (A), S's most advanced outfielder (B)
   const tgts:[string,number][]=[];
   const st=onPitch(f,S).find(x=>roleOfI(x.i)==='ST');if(st)tgts.push(['A',st.i]);
   {let b=-1,bd=-1;for(const {i,q} of onPitch(f,S)){const d=depth(S,q.x);if(d>bd){bd=d;b=i;}}if(b>=0)tgts.push(['B',b]);}
   for(const [kind,i] of tgts){const q=pos(f,i);if(depth(T,q.x)<=14)markRead(out[T].mark[kind as 'A'|'B'].M1,f,T,i,q);}
  }
  function markRead(m:any,f:any,D:number,ti:number,tq:any){
   const id=roster[ti].id,defs=onPitch(f,D);
   m.n++;
   const markers=defs.filter(x=>{const j=jobAt(x.i,f.time);return !!j&&j.target===id&&(j.purpose==='mark'||j.purpose==='press');});
   inc(m.mk,markers.length?(markers.some(x=>roleOfI(x.i)==='CB')?'CB':roleOfI(markers[0].i)):'none');
   let nb=-1,nd=Infinity,cbd=Infinity,gs=false;
   for(const {i,q} of defs){const d=dist(q,tq);if(d<nd){nd=d;nb=i;}if(roleOfI(i)==='CB'){cbd=Math.min(cbd,d);if(depth(D,q.x)<depth(D,tq.x))gs=true;}}
   if(nb>=0)inc(m.nr,roleOfI(nb));
   if(Number.isFinite(cbd))m.cbd+=cbd;if(gs)m.cbgs++;if(nb>=0&&roleOfI(nb)==='CB')m.cbn++;
  }
  // ---- passes to their striker / most advanced man (M2, M3), read at the kick
  for(const e of events){
   if(e.kind!=='pass'||e.restartKind||!e.actor||!e.target)continue;
   const S=sideOf(e.actor);if(S!==0&&S!==1)continue;const T=1-S;
   const ti=idx.get(e.target);if(ti===undefined||roster[ti].side!==S)continue;
   const k=frameAt(e.time),f=frames[k],tq=pos(f,ti);if(!tq)continue;
   const kinds:string[]=[];
   if(roleOfI(ti)==='ST')kinds.push('A');
   {let b=-1,bd=-1;for(const {i,q} of onPitch(f,S)){const d=depth(S,q.x);if(d>bd){bd=d;b=i;}}if(b===ti)kinds.push('B');}
   if(!kinds.length)continue;
   const aim=e.pass?.aim??e.aerial?.aim;
   let last=Infinity;for(const {q} of onPitch(f,T))last=Math.min(last,depth(T,q.x));
   const behind=!!aim&&depth(T,aim.x)<last&&depth(T,aim.x)<=HALF;
   for(const kd of kinds){const M=out[T].mark[kd as 'A'|'B'];markRead(M.M2,f,T,ti,tq);if(behind)markRead(M.M3,f,T,ti,tq);}
  }
  // ---- shots and goals by role
  const shots=events.filter((e:any)=>e.kind==='shot'&&(e.side===0||e.side===1)&&e.actor);
  const goals=events.filter((e:any)=>e.kind==='goal'&&(e.side===0||e.side===1));
  for(const g of goals){const i=idx.get(g.actor);inc(out[g.side].goalsBy,i===undefined?'?':roster[i].side!==g.side?'OG':roleOfI(i));}
  for(const s of shots){
   const S=s.side,i=idx.get(s.actor);if(i===undefined)continue;const role=roleOfI(i);
   const k=frameAt(s.time),set=spellSet[k]===1&&s.time-spellStart[k]<=8&&poss[k]===S;
   const g=goals.find((x:any)=>x.side===S&&x.time>=s.time-1e-6&&x.time<=s.time+3&&!shots.some((y:any)=>y!==s&&y.side===S&&y.time>s.time+1e-6&&y.time<=x.time));
   const v=vec(out[S].shots,role,5);v[0]++;v[1]+=chanceOf(s);if(g)v[2]++;if(set){v[3]++;if(g)v[4]++;}
   const mv=vec(out[S].shotsMain,`${mainOf(i)}@${role}`,2);mv[0]++;if(g)mv[1]++;
   if(g&&role==='CB'){
    const k10=frameAt(s.time-10),q10=pos(frames[k10],i),qs=pos(frames[k],i);
    out[S].goalsCB.push([r3(s.time),r3(s.time-spellStart[k]),set?1:0,q10?r3(depth(S,q10.x)):-1,qs?r3(depth(S,qs.x)):-1,r3(spellFrom[k]),deepestOf(frames[k10],S)===i?1:0]);
   }
  }
  // ---- open-play losses
  const losses:{S:number;t:number;cb:boolean}[]=[];
  for(let k=1;k<n;k++){
   const a=poss[k-1],b=poss[k];if(a<0||b<0||a===b)continue;
   const f=frames[k];if(f.restart||frames[k-1].restart)continue;
   const S=a,bd=depth(S,f.ball.x),dS=deepestOf(f,S);let cbAny=false,cbBack=false;
   out[S].loss.n++;
   for(const {i,q} of onPitch(f,S)){const v=vec(out[S].loss.role,roleOfI(i),5),d=depth(S,q.x);
    if(d<bd)v[0]++;v[1]+=d;if(i===dS)v[2]++;if(d>=HALF)v[3]++;if(d>bd)v[4]++;
    if(roleOfI(i)==='CB'){cbAny=true;if(d<bd)cbBack=true;}}
   if(cbAny){const w=cbBack?out[S].loss.withCB:out[S].loss.noCB;w[0]++;losses.push({S,t:f.time,cb:cbBack});}
  }
  const latest=(S:number,t:number)=>{let l:any=null;for(const x of losses)if(x.S===S&&x.t<=t+1e-6)l=x;return l&&t-l.t<=12?l:null;};
  for(const s of shots){const S=1-s.side,l=latest(S,s.time);if(!l)continue;const w=l.cb?out[S].loss.withCB:out[S].loss.noCB;w[1]++;w[2]+=chanceOf(s);}
  for(const g of goals){const S=1-g.side,l=latest(S,g.time);if(!l)continue;(l.cb?out[S].loss.withCB:out[S].loss.noCB)[3]++;}
 }
 for(const o of out){
  for(const v of Object.values(o.shots))v[1]=r3(v[1]);
  for(const v of Object.values(o.loss.role))v[1]=r3(v[1]);
  o.loss.noCB[2]=r3(o.loss.noCB[2]);o.loss.withCB[2]=r3(o.loss.withCB[2]);
  for(const A of ['A','B'] as const)for(const M of ['M1','M2','M3'] as const)o.mark[A][M].cbd=r3(o.mark[A][M].cbd);
 }
 return out;
}

setExtra((runs:any[],teams:any[])=>({cb:cbRole(runs,teams)}));
