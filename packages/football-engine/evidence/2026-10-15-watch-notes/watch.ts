// Watch notes (2026-10-15, branch ballers-watch-notes, base ballers-contest c707eccd, ENGINE_BUILD 76d73f5c). Evidence only:
// one neutral mirror match (../2026-10-10-cloud-measure/mirror.ts inputOf, through the same runMatch call computeMatch makes,
// as ../2026-10-12-deep-study/deep.ts does) and keys read from the recorded result. Nothing in the engine changes.
//
// Row keys (per match):
//  sp    individual spells on the ball, one tuple each (see SP below): from a player gaining control (event receive,
//        turnover, or a keeper's catch 'save ... prinde') to his release (pass / clearance / shot event by him), or the ball
//        leaving him otherwise (lost), or a stoppage. Touches = his recorded control contacts (controlContacts) in the spell,
//        the releasing kick included (a first-time pass is one touch).
//  gl    goals, one tuple each (GL)
//  pr    keeper parries ('save ... respinge') and blocks, one tuple each (PR)
//  ls    open-play possession losses within LOSS_R m of the losing side's goal centre, one tuple each (LS)
//  bu    bunching counts, open play sampled every 0.2 s: frames; n5[k] frames with k outfielders (both sides) within 5 m of
//        the ball (k capped 6); d5[k] frames with k of the defending side's outfielders within 5 m of the ball (capped 4);
//        own3[k] the same restricted to frames with the ball in the possessing side's own third (< 16 m from its goal);
//        ov frames with any two players (keepers included) under 0.6 m apart, ovSame / ovOpp pairs-frames by team, ovDuty
//        the duty pairs of same-team overlaps; duty3 the duties of the defending outfielders within 5 m when 3+ of them are
//        (frame duty, practice.ts Duty)
//  tp    team possessions (runs of frames with the same side in possession; a restart for that side continues it, kick-offs
//        and restarts for them start it): n, sum of seconds, hist of passes per possession [0,1,2,3,4,5-6,7-9,10+], hist of
//        seconds [<2,2-5,5-10,10-20,20+]
//  rd/ad counts of reception duels / aerial duels recorded (current build only; 0 on R1)
import {runMatch} from '../../src/index';
import {engineTeam} from '../../../../lib/ballers/compute';
import {inputOf,armTreatment} from '../2026-10-10-cloud-measure/mirror';
export {armTreatment};

const L=48,LOSS_R=12;
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const ROLE:Record<string,number>={GK:0,CB:1,FB:1,DM:1,CM:2,AM:2,W:2,ST:3};
const ACT:Record<string,number>={pass:0,through:0,loft:0,clear:1,shoot:2,carry:3,feint:4};
// SP tuple: [0 side, 1 role (0 GK,1 back,2 mid/wing,3 ST), 2 how (0 pass from a team-mate, 1 regain from the opponents,
//  2 keeper catch, 3 other own-side ball: loose/rebound), 3 depth*10 (m from own goal), 4 |y|*10, 5 nearest opponent*10 (m),
//  6 his closing speed*10 (m/s towards the receiver), 7 duration*100 (s), 8 touches, 9 outcome (0 pass,1 clearance,2 shot,
//  3 lost with an opponent's tackle event, 4 lost otherwise, 5 stoppage/foul/out/goal/half), 10 first decision delay*100
//  (first owner choice with an action; -1 none), 11 its action (ACT; -1 none), 12 owner choices in the spell,
//  13 first-time release (0/1), 14 expected (the pass's intended receiver, 0/1), 15 match second, 16 nearest opponent at the
//  first decision*10 (-1 none), 17 reception duel at the gain (0 none, 1 yes), 18 metres carried*10]
// GL tuple: [0 side, 1 second, 2 type (0 open play no rebound, 1 rebound after a keeper parry, 2 after a block, 3 restart
//  move <= 6 s, 4 no shot found / own goal), 3 passes by the scorer's side between the parry/block and the scoring shot (-1),
//  4 secs from the parry/block to the scoring shot (-1), 5 keeper's gap to the shot line*10 (m; how far from covering it),
//  6 keeper's distance from his goal centre*10, 7 assisted (a team-mate's pass received <= 2.5 s before the shot), 8 keeper
//  gap at that pass*10 (-1), 9 keeper's distance to the passer at that pass*10 (-1), 10 scorer's touches before the shot,
//  11 keeper duty at the shot (index in DUTIES), 12 scorer's distance from goal*10, 13 the shot's spell start: own loss
//  within LOSS_R of the conceding side's goal <= 5 s before (1) or not (0)]
// PR tuple: [0 kind (0 parry,1 block by an outfielder,2 block by the keeper's body), 1 second, 2 next control (0 shooting
//  side, 1 defending outfielder, 2 defending keeper, 3 out/stoppage, 4 goal without control), 3 secs to it, 4 nearest
//  attacker to the ball at the parry*10, 5 nearest defending outfielder*10, 6 nearest attacker to where it was next
//  controlled at the parry instant*10 (-1), 7 nearest defending outfielder to that spot*10 (-1), 8 shot by the shooting side
//  <= 5 s (0/1), 9 goal by it <= 5 s, 10 keeper's distance from his goal centre at +1 s*10, 11 keeper gap to the follow-up
//  shot's line*10 (-1 none), 12 the ball's speed off the parry*10]
// LS tuple: [0 losing side, 1 second, 2 how (0 pass intercepted/lost, 1 clearance won by them, 2 tackled (their tackle
//  event), 3 control lost without a tackle event (heavy touch, nick at the reception, spill), 4 keeper's throw/kick lost),
//  3 loser role, 4 distance from goal centre*10, 5 his spell length*100 (-1), 6 nearest opponent at his gain*10 (-1),
//  7 their goal <= 5 s (0/1), 8 their shot <= 5 s, 9 his first decision delay*100 (-1 none), 10 their goal <= 10 s,
//  11 his spell how (SP how, -1)]
export const DUTIES=['hold','support','run','show','width','press','jockey','challenge','block','track','cover','intercept','recover','carry','prepare','receive','feint','wrongfoot','keeper','dive','sweep','restart'];

export function watchKeys(R:any,snapsWanted=false){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[],contacts:any[]=R.controlContacts??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const roleOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].role as string:'?';
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const n=frames.length;
 const frameAt=(t:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const goalC=(s:number)=>({x:s===0?0:L,y:0});
 const keeperIdx=[0,1].map(s=>roster.findIndex((p:any)=>p.side===s&&p.role==='GK'));
 const opps=(f:any,s:number,out=false)=>roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.side!==s&&(!out||x.p.role!=='GK')).map((x:any)=>({i:x.i,q:pos(f,x.i)})).filter((x:any)=>x.q);
 const nearest=(f:any,at:any,s:number,out=false)=>{let best=Infinity,who=-1;for(const x of opps(f,s,out)){const d=dist(x.q,at);if(d<best){best=d;who=x.i;}}return {d:best,i:who};};
 const closing=(f:any,i:number,at:any)=>{const q=pos(f,i);if(!q)return 0;const d=dist(q,at)||1;return ((at.x-q.x)*q.vx+(at.y-q.y)*q.vy)/d;};
 const ownerAt=(f:any)=>f.restart?null:(f.control?.owner??f.ball?.owner??null);
 const keeperGap=(f:any,s:number,from:any,to:any)=>{// keeper of side s: distance from the segment from->to
  const k=keeperIdx[s];if(k<0)return -1;const q=pos(f,k);if(!q)return -1;
  const dx=to.x-from.x,dy=to.y-from.y,d2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((q.x-from.x)*dx+(q.y-from.y)*dy)/d2));
  return Math.hypot(q.x-from.x-dx*t,q.y-from.y-dy*t);};
 const keeperHome=(f:any,s:number)=>{const k=keeperIdx[s];const q=k>=0?pos(f,k):null;return q?dist(q,goalC(s)):-1;};
 const isCatch=(e:any)=>e.kind==='save'&&/prinde/.test(e.text??'');
 const isParry=(e:any)=>e.kind==='save'&&!isCatch(e);
 const gainKinds=(e:any)=>e.kind==='receive'||e.kind==='turnover'||isCatch(e);
 // owner choices with an action, per roster index
 const ownChoices=new Map<number,number[]>();
 for(let c=0;c<choices.length;c++){const ch=choices[c];if(ch.action===undefined)continue;const a=ownChoices.get(ch.player)??[];a.push(c);ownChoices.set(ch.player,a);}
 const contactsBy=new Map<string,any[]>();for(const c of contacts){const a=contactsBy.get(c.actor)??[];a.push(c);contactsBy.set(c.actor,a);}
 const duelAt=new Map<string,number[]>();for(const d of R.receptionDuels??[]){const a=duelAt.get(d.receiver)??[];a.push(d.time);duelAt.set(d.receiver,a);}

 // ---- individual spells
 const sp:number[][]=[];const spellOf:any[]=[];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(!gainKinds(e)||!e.actor)continue;
  const p=e.actor,pi=idx.get(p)!,S=sideOf(p),t0=e.time;
  // how: a team-mate's pass / a regain / a catch / other
  let how=isCatch(e)?2:e.kind==='turnover'?1:3,expected=0;
  if(how===3){for(let r=q-1;r>=0&&events[r].time>t0-6;r--){const x=events[r];if(x.kind==='pass'||x.kind==='clearance'||x.kind==='shot'){if(sideOf(x.actor)===S&&x.kind==='pass'){how=0;expected=x.target===p?1:0;}break;}if(gainKinds(x))break;}}
  // end
  let end=-1,outcome=5,rel:any=null;
  for(let r=q+1;r<events.length;r++){const x=events[r];
   if(x.time>t0+30){break;}
   if((x.kind==='pass'||x.kind==='clearance'||x.kind==='shot')&&x.actor===p){end=x.time;outcome=x.kind==='pass'?0:x.kind==='clearance'?1:2;rel=x;break;}
   if(gainKinds(x)&&x.actor!==p){end=x.time;outcome=4;break;}
   if(gainKinds(x)&&x.actor===p&&x.time>t0+1e-6){end=x.time;outcome=5;break;}
   if(['foul','out','offside','goal','half','end','restart','substitution'].includes(x.kind)){end=x.time;outcome=5;break;}
  }
  if(end<0)continue;
  if(outcome===4){// when did the ball leave him; was there their tackle on the way
   const k0=frameAt(t0);let k=k0;while(k+1<n&&frames[k+1].time<=end+1e-6&&frames[k+1].ball?.owner===p)k++;
   const left=k+1<n?frames[k+1].time:end;
   let tackled=false;for(let r=q+1;r<events.length&&events[r].time<=end+1e-6;r++){const x=events[r];if(x.kind==='tackle'&&sideOf(x.actor)!==S&&x.target===p&&x.time<=left+.05){tackled=true;}}
   outcome=tackled?3:4;end=Math.min(end,left);
  }
  const f0=frames[frameAt(t0)],at=f0.ball,nr=nearest(f0,at,S);
  const cl=nr.i>=0?closing(f0,nr.i,at):0;
  const mine=(ownChoices.get(pi)??[]).map(c=>choices[c]).filter((c:any)=>c.time>=t0-1e-6&&c.time<=end+1e-6);
  const first=mine[0];
  let nf=-1;if(first){const ff=frames[frameAt(first.time)];nf=nearest(ff,ff.ball,S).d;}
  const touches=(contactsBy.get(p)??[]).filter((c:any)=>c.time>=t0-.1&&c.time<=end+.02).length;
  const firstTime=rel&&rel.time-t0<1e-3?1:0;
  const duel=(duelAt.get(p)??[]).some(t=>Math.abs(t-t0)<.1)?1:0;
  let carried=0;{let prev:any=null;for(let k=frameAt(t0);k<n&&frames[k].time<=end+1e-6;k++){const b=frames[k].ball;if(prev)carried+=dist(prev,b);prev=b;}}
  const tup=[S,ROLE[roleOf(p)]??-1,how,Math.round(depth(S,at.x)*10),Math.round(Math.abs(at.y)*10),Number.isFinite(nr.d)?Math.round(nr.d*10):999,Math.round(cl*10),Math.round((end-t0)*100),touches,outcome,
   first?Math.round((first.time-t0)*100):-1,first?ACT[first.action]??-1:-1,mine.length,firstTime,expected,Math.round(t0),nf>=0&&Number.isFinite(nf)?Math.round(nf*10):-1,duel,Math.round(carried*10)];
  sp.push(tup);spellOf.push({p,t0,end,outcome,how,first});
 }
 const spellEndingAt=(p:string,t:number)=>{for(let k=spellOf.length-1;k>=0;k--){const s=spellOf[k];if(s.p===p&&s.t0<=t+1e-6)return s.end>=t-.3?k:-1;}return -1;};

 // ---- team possession per frame, losses near goal
 const poss=new Int8Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=ownerAt(f);if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 const goals=events.filter((e:any)=>e.kind==='goal'),shots=events.filter((e:any)=>e.kind==='shot');
 const ls:number[][]=[];const snapsT:{t:number;why:string}[]=[];
 for(let k=1;k<n;k++){
  const a=poss[k-1],b=poss[k];if(a<0||b<0||a===b)continue;
  const f=frames[k];if(f.restart||frames[k-1].restart)continue;
  // the losing side's last owner
  let j=k-1;while(j>0&&!ownerAt(frames[j]))j--;const lo=ownerAt(frames[j]);if(!lo||sideOf(lo)!==a)continue;
  const at=frames[j].ball,dg=dist(at,goalC(a));if(dg>LOSS_R)continue;
  const tl=frames[j].time,tg=f.time;
  let how=3;
  for(let r=0;r<events.length;r++){const x=events[r];if(x.time<tl-.05)continue;if(x.time>tg+.05)break;
   if(x.actor===lo&&(x.kind==='pass'||x.kind==='clearance')){how=roleOf(lo)==='GK'&&x.kind==='pass'?4:x.kind==='pass'?0:1;}
   if(x.kind==='tackle'&&sideOf(x.actor)===b&&how===3)how=2;}
  const si=spellEndingAt(lo,tl),s=si>=0?spellOf[si]:null,st=si>=0?sp[si]:null;
  const g5=goals.some((x:any)=>x.side===b&&x.time>tg&&x.time<=tg+5),g10=goals.some((x:any)=>x.side===b&&x.time>tg&&x.time<=tg+10),s5=shots.some((x:any)=>x.side===b&&x.time>tg&&x.time<=tg+5);
  ls.push([a,Math.round(tg),how,ROLE[roleOf(lo)]??-1,Math.round(dg*10),s?Math.round((s.end-s.t0)*100):-1,st?st[5]:-1,g5?1:0,s5?1:0,st?st[10]:-1,g10?1:0,s?s.how:-1]);
  if(snapsWanted&&g5)for(const dt of [-2,-1,-.5,0,1,2])snapsT.push({t:tg+dt,why:`loss${a}-${how}@${r1(tg)}${dt>=0?'+':''}${dt}`});
 }

 // ---- parries and blocks
 const pr:number[][]=[];
 for(let q=0;q<events.length;q++){
  const e=events[q];if(!(isParry(e)||e.kind==='block'))continue;
  const D=sideOf(e.actor),A=1-D,kind=isParry(e)?0:roleOf(e.actor)==='GK'?2:1,f=frames[frameAt(e.time)];
  let nxt=3,dt=-1,spot:any=null;
  for(let r=q+1;r<events.length&&events[r].time<=e.time+8;r++){const x=events[r];
   if(gainKinds(x)){const s=sideOf(x.actor);nxt=s===A?0:roleOf(x.actor)==='GK'?2:1;dt=x.time-e.time;spot=frames[frameAt(x.time)].ball;break;}
   if(x.kind==='goal'){nxt=4;dt=x.time-e.time;break;}
   if(['out','foul','offside','restart','half','end'].includes(x.kind)){nxt=3;dt=x.time-e.time;break;}}
  const nA=nearest(f,f.ball,D).d,nD=nearest(f,f.ball,A,true).d;
  const sA=spot?nearest(f,spot,D).d:-1,sD=spot?nearest(f,spot,A,true).d:-1;
  const fs=shots.find((x:any)=>x.side===A&&x.time>e.time&&x.time<=e.time+5),gg=goals.some((x:any)=>x.side===A&&x.time>e.time&&x.time<=e.time+5);
  let fg=-1;if(fs&&fs.shot){const ff=frames[frameAt(fs.time)];fg=keeperGap(ff,D,fs.shot.origin,{x:goalC(D).x,y:fs.shot.aim.y});}
  const f1=frames[frameAt(e.time+1)],fa=frames[Math.min(n-1,frameAt(e.time)+1)],sp0=Math.hypot(fa.ball.vx,fa.ball.vy);
  pr.push([kind,Math.round(e.time),nxt,dt>=0?r2(dt):-1,Math.round(nA*10),Math.round(nD*10),sA>=0?Math.round(sA*10):-1,sD>=0?Math.round(sD*10):-1,fs?1:0,gg?1:0,Math.round(keeperHome(f1,D)*10),fg>=0?Math.round(fg*10):-1,Math.round(sp0*10)]);
 }

 // ---- goals
 const gl:number[][]=[];
 for(const g of goals){
  const S=g.side,D=1-S;if(S!==0&&S!==1)continue;
  const shot=[...shots].reverse().find((x:any)=>x.side===S&&x.time<=g.time+1e-6&&x.time>=g.time-4);
  if(!shot||!shot.shot||sideOf(g.lastTouch??g.actor)!==S){gl.push([S,Math.round(g.time),4,-1,-1,-1,-1,0,-1,-1,-1,-1,-1,0]);continue;}
  const fs=frames[frameAt(shot.time)];
  // a parry/block of S's earlier shot, with no D control in between
  let type=0,passes=-1,since=-1;
  for(let r=events.indexOf(shot)-1;r>=0&&events[r].time>=shot.time-4;r--){const x=events[r];
   if(gainKinds(x)&&sideOf(x.actor)===D)break;
   if(isParry(x)||x.kind==='block'&&sideOf(x.actor)===D){type=isParry(x)?1:2;since=shot.time-x.time;passes=events.filter((y:any)=>y.kind==='pass'&&y.side===S&&y.time>x.time&&y.time<shot.time).length;break;}}
  // restart move: S's possession began at a restart <= 6 s before
  if(type===0){let k=frameAt(shot.time);while(k>0&&poss[k-1]===S&&!frames[k].restart)k--;if(frames[k].restart&&shot.time-frames[k].time<=6)type=3;}
  const kg=keeperGap(fs,D,shot.shot.origin,{x:goalC(D).x,y:shot.shot.aim.y}),kh=keeperHome(fs,D);
  // assisted: S's pass received by the shooter <= 2.5 s before
  let assisted=0,kgp=-1,kdp=-1;
  const rcv=[...events].reverse().find((x:any)=>x.kind==='receive'&&x.actor===shot.actor&&x.time<=shot.time+1e-6&&x.time>=shot.time-2.5);
  if(rcv){const pass=[...events].reverse().find((x:any)=>x.kind==='pass'&&x.side===S&&x.time<=rcv.time&&x.time>=rcv.time-3);
   if(pass){assisted=1;const fp=frames[frameAt(pass.time)],pp=pos(fp,idx.get(pass.actor)!);kgp=keeperGap(fp,D,fp.ball,{x:goalC(D).x,y:0});const kq=pos(fp,keeperIdx[D]);kdp=pp&&kq?dist(pp,kq):-1;}}
  const touches=(contactsBy.get(shot.actor)??[]).filter((c:any)=>c.time>=(rcv?.time??shot.time)-.1&&c.time<shot.time-1e-3).length;
  const kq=pos(fs,keeperIdx[D]),kd=kq?DUTIES.indexOf(kq.duty):-1;
  const lossNear=ls.some(l=>l[0]===D&&l[1]>=shot.time-6&&l[1]<=shot.time)?1:0;
  gl.push([S,Math.round(g.time),type,passes,since>=0?r2(since):-1,Math.round(kg*10),Math.round(kh*10),assisted,kgp>=0?Math.round(kgp*10):-1,kdp>=0?Math.round(kdp*10):-1,touches,kd,Math.round(dist(shot.shot.origin,goalC(D))*10),lossNear]);
  if(snapsWanted){if(type===1||type===2)for(const dt of [-since-.3,-since+.3,-since+.8,0])snapsT.push({t:shot.time+dt,why:`reb${type}g${S}@${r1(g.time)}`});
   else if(kg>1.5)for(const dt of [-1.5,-.7,0])snapsT.push({t:shot.time+dt,why:`open${S}@${r1(g.time)}`});}
 }

 // ---- bunching
 const z=(m:number)=>Array.from({length:m},()=>0);
 const bu={frames:0,n5:z(7),d5:z(5),own3:z(5),own3frames:0,ov:0,ovSame:0,ovOpp:0,ovDuty:{} as Record<string,number>,duty3:{} as Record<string,number>,ovOwner:0};
 const outIdx=roster.map((p:any,i:number)=>({i,p})).filter((x:any)=>x.p.role!=='GK').map((x:any)=>x.i);
 let nextT=-1,bunchSnaps=0;
 for(let k=0;k<n;k++){
  const f=frames[k];if(f.restart||f.cut)continue;if(f.time<nextT-1e-6)continue;nextT=f.time+.2;
  const S=poss[k];if(S<0)continue;bu.frames++;
  const b=f.ball;let n5=0,d5=0;const near:number[]=[];
  for(const i of outIdx){const q=pos(f,i);if(!q)continue;if(dist(q,b)<5){n5++;if(roster[i].side!==S){d5++;near.push(i);}}}
  bu.n5[Math.min(6,n5)]++;bu.d5[Math.min(4,d5)]++;
  if(depth(S,b.x)<16){bu.own3frames++;bu.own3[Math.min(4,d5)]++;}
  if(d5>=3)for(const i of near){const du=pos(f,i).duty;bu.duty3[du]=(bu.duty3[du]??0)+1;}
  let any=false;const owner=ownerAt(f);
  for(let a=0;a<roster.length;a++){const qa=pos(f,a);if(!qa)continue;for(let c=a+1;c<roster.length;c++){const qc=pos(f,c);if(!qc)continue;
   if(dist(qa,qc)<.6){any=true;if(roster[a].side===roster[c].side){bu.ovSame++;const key=[qa.duty,qc.duty].sort().join('+');bu.ovDuty[key]=(bu.ovDuty[key]??0)+1;}else{bu.ovOpp++;if(roster[a].id===owner||roster[c].id===owner)bu.ovOwner++;}}}}
  if(any)bu.ov++;
  if(snapsWanted&&d5>=3&&depth(S,b.x)<16&&bunchSnaps<40&&(k%7===0)){snapsT.push({t:f.time,why:`bunch${S}d${d5}`});bunchSnaps++;}
 }

 // ---- team possessions
 const tp={n:0,secs:0,passes:z(8),dur:z(5)};
 for(let k=0;k<n;){const s=poss[k];let j=k;while(j+1<n&&poss[j+1]===s)j++;
  if(s>=0){const t0=frames[k].time,t1=frames[j].time,d=t1-t0;if(d>0){tp.n++;tp.secs+=d;
   const np=events.filter((e:any)=>e.kind==='pass'&&e.side===s&&e.time>=t0-1e-6&&e.time<=t1+1e-6).length;
   tp.passes[np<=4?np:np<=6?5:np<=9?6:7]++;tp.dur[d<2?0:d<5?1:d<10?2:d<20?3:4]++;}}
  k=j+1;}

 let snaps:any[]|undefined;
 if(snapsWanted){
  snaps=snapsT.map(s=>{const f=frames[frameAt(s.t)];return {why:s.why,t:r1(f.time),owner:ownerAt(f),ball:[r2(f.ball.x),r2(f.ball.y)],score:f.score,
   p:roster.map((p:any,i:number)=>{const q=pos(f,i);return q?{id:p.id,s:p.side,r:p.role,n:p.number,x:r2(q.x),y:r2(q.y),vx:r1(q.vx),vy:r1(q.vy),d:q.duty}:null;}).filter(Boolean)};});
 }
 return {sp,gl,pr,ls,bu,tp,rd:(R.receptionDuels??[]).length,ad:(R.aerialDuels??[]).length,snaps};
}

export function play(t:{label:string;arm:string;seed:number;rev:string},snapsWanted=false){
 const inp=inputOf(t.arm,t.seed),teams=inp.sides.map(engineTeam) as any,t0=performance.now();
 const run:any=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true} as any);
 const ms=Math.round(performance.now()-t0),R=run.result;
 const k=watchKeys(R,snapsWanted);
 return {label:t.label,arm:t.arm,seed:t.seed,rev:t.rev,ours:t.seed%2,plat:`${process.platform}-${process.arch}-node${process.versions.node}`,build:String(run.engineBuild).slice(0,8),score:R.score,ms,...k};
}
