// Duel recovery (2026-10-16): the recovery probe's measure.ts (../2026-10-15-recovery-probe, branch ballers-recovery-probe)
// unchanged, plus `dr` at the end: re-collections after won tackles, knock-downs, and players on top of each other.
//
// Recovery probe (2026-10-15): copied from ../2026-10-11-regain-fixes/measure.ts so its metrics stay comparable, with
// three changes only: the mirror is ../2026-10-10-cloud-measure/mirror.ts (it builds the <a>121v<b>121 arms), the tape
// writer is gone (its import is not on the public lab), and the row carries `rec` (see the end of play) plus `pp` (each
// ping-pong flip pair, compact, for picking frames). Everything else is the regain-fixes row, unchanged.
//
// Counter regains (2026-10-11): what happens in the 8 s after every open-play change of possession, on the final
// build (ac3f36db, engine 9306734b). One mirror match (../2026-10-10-cloud-measure/mirror.ts inputOf: identical
// five-player sides, 2-1-1, all skills 6; arms <a>v<b> | di0 | co0) through the same runMatch call computeMatch
// makes (no plans, no orders in the mirror), record:true. Trace only: nothing here changes play; run.mjs checks
// every score against the overnight run's rows for the same arm and seed.
//
// A REGAIN is the first frame a player has the ball (frame.control / ball.owner, no restart) for the side that did
// not have it last (possession = last side in control; restarts count for their side). Per regain:
//   at the regain  where (winner's depth from own goal, m), the regainer and his pressure (nearest opponent, how
//                  many within 3 m), the losers ahead of the ball (beyond it, towards the winner's goal) and how
//                  far, the losers goal-side of it, the winners ahead of it and how many of them are free (no
//                  opponent within 5 m), the winners' most advanced player's distance to goal, open options for
//                  the regainer (team-mate with no opponent within 4 m and no opponent within 1.5 m of the lane)
//   first action   every release by the winners in the window (pass/through/loft/clear/shot), with time from the
//                  regain, start, aim, gain, whether the aim is beyond the losers' last outfielder ("in behind"),
//                  the engine's own action + reason (the carrier's last 'prepare' choice), the target and how close
//                  his nearest opponent was at the release, and who controlled the ball next
//   break runs     coordination 'break' assignments (practice-coordination.ts) for the winners: first time from the
//                  regain, how many players; every 'run' duty too
//   the end        the first moment within 8 s the losers have the ball again (control or a restart for them) or
//                  the window closes; a goal; the winners' shots; the ball's furthest depth; the first moment a
//                  loser outfielder is within 2 m of the winners' man on the ball ("counter-press arrival")
//   how they lost  the losers' last release before the regain (so regains from long balls can be split out)
import {runMatch} from '../../src/index';
import {engineTeam} from '../../../../lib/ballers/compute';
import {inputOf,armTreatment} from '../2026-10-10-cloud-measure/mirror';
import {rateOf,shotChance} from '../../../../lib/ballers/chances';
export {armTreatment};

const L=48,WIN=8;
const r2=(v:number)=>Math.round(v*100)/100;
const depth=(s:number,x:number)=>s===0?x:L-x;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const segDist=(p:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number})=>{const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;const t=l2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};

export function play(t:{label:string;arm:string;seed:number;rev:string;tapes?:string;diag?:boolean}){
 const inp=inputOf(t.arm,t.seed),teams=inp.sides.map(engineTeam) as any,t0=performance.now();
 const run:any=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true} as any);
 const ms=Math.round(performance.now()-t0),R=run.result;
 const roster:{id:string;side:number;role:string}[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices;
 const idx=new Map(roster.map((p,i)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side:-1;
 const roleOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].role:'?';
 const tr=armTreatment(t.arm),styles=[0,1].map(s=>s===t.seed%2?(tr.style??'balanced'):(tr.vs??'balanced'));
 const posOf=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const team=(f:any,s:number,gk=false)=>roster.map((p,i)=>({id:p.id,role:p.role,q:posOf(f,i)})).filter(x=>x.q&&roster[idx.get(x.id)!].side===s&&(gk||x.role!=='GK'));
 // possession per frame
 const n=frames.length,poss=new Int8Array(n),owner:(string|null)[]=new Array(n);let last=-1;
 for(let k=0;k<n;k++){const f=frames[k];const o=f.restart?null:(f.control?.owner??f.ball?.owner??null);owner[k]=o;if(o)last=sideOf(o);else if(f.restart&&f.restartInfo)last=f.restartInfo.side;poss[k]=last;}
 // choices by player index, sorted by time (already in time order)
 const prepBy=new Map<number,any[]>();for(const c of choices)if(c.action){const a=prepBy.get(c.player)??[];a.push(c);prepBy.set(c.player,a);}
 const lastPrep=(id:string,time:number)=>{const a=prepBy.get(idx.get(id)!)??[];let best=null;for(const c of a){if(c.time>time+1e-6)break;best=c;}return best&&time-best.time<4?best:null;};
 const breaks=choices.filter(c=>c.assignment?.purpose==='break');
 const runs=choices.filter(c=>c.kind==='run');
 const frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const releaseKinds=new Set(['pass','clearance','shot']);
 const relOf=(e:any,wi:number,tRef:number)=>{
  const k=frameAt(e.time),f=frames[k],start={x:f.ball.x,y:f.ball.y},aim=e.pass?.aim??e.aerial?.aim??e.shot?.aim??null;
  const prep=lastPrep(e.actor,e.time),los=team(f,1-wi);
  const lastLoser=Math.max(...los.map(x=>depth(wi,x.q.x)));
  const gain=aim?depth(wi,aim.x)-depth(wi,start.x):0,len=aim?dist(aim,start):0;
  let tgtPress=null;if(e.target&&idx.has(e.target)){const tq=posOf(f,idx.get(e.target)!);if(tq)tgtPress=Math.min(...team(f,1-wi,true).map(x=>dist(x.q,tq)));}
  // who controls it next (or a restart)
  let next='none',nextRole='',nextT=null as number|null;
  for(let j=k+1;j<n&&frames[j].time<=e.time+6;j++){const g=frames[j];if(g.restart&&g.restartInfo){next=g.restartInfo.side===wi?'R-own:'+g.restartInfo.kind:'R-opp:'+g.restartInfo.kind;nextT=g.time;break;}
   const o=owner[j];if(o&&o!==e.actor||o===e.actor&&g.time>e.time+.5){next=sideOf(o)===wi?(o===e.target?'target':'mate'):'opp';nextRole=roleOf(o);nextT=g.time;break;}}
  const kind=e.kind==='shot'?'shot':e.kind==='clearance'?'clear':e.aerial?'loft':/în spațiu/.test(e.text)?'through':'pass';
  return {t:r2(e.time-tRef),kind,action:prep?.action??null,reason:prep?.reason??null,actor:roleOf(e.actor),self:false,target:e.target?roleOf(e.target):null,
   sx:r2(depth(wi,start.x)),ax:aim?r2(depth(wi,aim.x)):null,gain:r2(gain),len:r2(len),behind:!!aim&&e.kind!=='shot'&&depth(wi,aim.x)>lastLoser+.5&&gain>3,
   lastLoser:r2(lastLoser),tgtPress:tgtPress===null?null:r2(tgtPress),next,nextRole,nextT:nextT===null?null:r2(nextT-e.time),firstTime:!!e.firstTime,
   press:r2(Math.min(...team(f,1-wi,true).map(x=>dist(x.q,start))))};
 };
 const regains:any[]=[];
 let prevStart=0;
 for(let k=1;k<n;k++){
  const o=owner[k];if(!o)continue;const wi=sideOf(o);if(wi<0||poss[k-1]===wi||poss[k-1]<0)continue;
  const f=frames[k],lo=1-wi,t0r=f.time,ball={x:f.ball.x,y:f.ball.y},bd=depth(wi,ball.x);
  // the losers' possession that just ended: its start, and their last release in it
  let j0=k-1;while(j0>0&&poss[j0-1]===lo)j0--;
  const loStart=frames[j0].time;
  const loEv=events.filter(e=>e.time>=loStart-1e-6&&e.time<=t0r+1e-6&&sideOf(e.actor)===lo&&releaseKinds.has(e.kind));
  const loLast=loEv.at(-1),loRel=loLast?relOf(loLast,lo,loLast.time):null;
  const loTackle=events.some(e=>e.kind==='tackle'&&sideOf(e.actor)===wi&&e.time>=t0r-.6&&e.time<=t0r+.05);
  const loRestart=frames[j0].restart?frames[j0].restartInfo?.kind??'r':null;
  const W0=team(f,wi),L0=team(f,lo),LG=team(f,lo,true);
  const me=W0.find(x=>x.id===o)??team(f,wi,true).find(x=>x.id===o)!;
  const nearest=(q:any,arr:any[])=>Math.min(...arr.map(x=>dist(x.q,q)));
  const press=nearest(me.q,LG),within3=LG.filter(x=>dist(x.q,me.q)<3).length;
  const losersAhead=L0.filter(x=>depth(wi,x.q.x)<bd);// beyond the ball towards the winners' goal: out of the play
  const losersGoalSide=L0.filter(x=>depth(wi,x.q.x)>=bd);
  const mates=W0.filter(x=>x.id!==o);
  const winnersAhead=mates.filter(x=>depth(wi,x.q.x)>bd+1);
  const free=winnersAhead.filter(x=>nearest(x.q,LG)>5);
  const mostAdv=Math.max(...W0.map(x=>depth(wi,x.q.x)));
  const open=team(f,wi,true).filter(x=>x.id!==o).map(x=>({x,ok:nearest(x.q,LG)>=4&&LG.every(d=>segDist(d.q,ball,x.q)>1.5)})).filter(v=>v.ok).map(v=>v.x);
  const openFwd=open.filter(x=>depth(wi,x.q.x)>bd+3);
  const lastLoserD=Math.max(...L0.map(x=>depth(wi,x.q.x)));
  // the window: first loss (opponent control, or a restart for them) before t0+8
  let tThird:number|null=null,maxD5=bd;let tLoss:number|null=null,lossHow='',kEnd=k,maxD=bd,third=false,pressAt:number|null=null,lastCtl=t0r,lastCtlId=o,goal=false;
  const goalEv=events.find(e=>e.kind==='goal'&&e.side===wi&&e.time>=t0r&&e.time<=t0r+WIN);
  for(let j=k;j<n&&frames[j].time<=t0r+WIN;j++){
   const g=frames[j];kEnd=j;
   if(goalEv&&g.time>=goalEv.time-1e-6){goal=true;break;}
   if(g.restart&&g.restartInfo){if(g.restartInfo.side===lo){tLoss=g.time;lossHow='R:'+g.restartInfo.kind;break;}continue;}
   const oj=owner[j];
   if(oj&&sideOf(oj)===lo){tLoss=g.time;lossHow='ctl';break;}
   if(oj&&sideOf(oj)===wi){lastCtl=g.time;lastCtlId=oj;
    if(pressAt===null){const q=posOf(g,idx.get(oj)!);if(q&&team(g,lo).some(x=>dist(x.q,q)<2))pressAt=r2(g.time-t0r);}}
   const d=depth(wi,g.ball.x);if(d>maxD)maxD=d;if(d>=32&&!third){third=true;tThird=r2(g.time-t0r);}if(g.time-t0r<=5&&d>maxD5)maxD5=d;
  }
  const tEnd=tLoss??Math.min(t0r+WIN,frames[kEnd].time);
  const rels=events.filter(e=>e.time>=t0r-1e-6&&e.time<=tEnd+1e-6&&sideOf(e.actor)===wi&&releaseKinds.has(e.kind)).map(e=>relOf(e,wi,t0r));
  const shots=rels.filter(r=>r.kind==='shot').length;
  // how the possession ended, if it did
  let end='kept';
  if(goal)end='goal';
  else if(tLoss!==null){
   const lastRel=[...rels].reverse().find(r=>r.t+t0r<=tLoss!+1e-6);
   const inFlight=lastRel&&lastRel.t+t0r>=lastCtl-.05;// nobody of ours controlled it after the release
   if(lossHow.startsWith('R:')){
    const rk=lossHow.slice(2);
    end=rk==='kickoff'?'goal-against?':rk==='freeKick'||rk==='indirect'||rk==='penalty'?(lastRel&&lastRel.behind&&inFlight?'offside/foul after in-behind':'foul/offside'):inFlight&&lastRel?`out after ${lastRel.kind==='shot'?'shot':lastRel.kind==='clear'?'clearance':lastRel.behind?'in-behind':'pass'}`:'out off carrier';
   }else if(inFlight&&lastRel){
    end=lastRel.kind==='shot'?'shot then lost':lastRel.kind==='clear'?'clearance lost':lastRel.behind?'in-behind lost':rels.filter(r=>r.kind!=='shot').indexOf(lastRel)===0?'first pass cut out':'later pass cut out';
   }else{
    const tackled=events.some(e=>e.kind==='tackle'&&sideOf(e.actor)===lo&&e.time>=lastCtl-.4&&e.time<=tLoss!+.1);
    const isRegainer=lastCtlId===o&&rels.length===0;
    let rcvPress=null;
    if(!isRegainer){const rcv=[...rels].reverse().find(r=>r.t+t0r<=lastCtl&&r.kind!=='shot');if(rcv)rcvPress=rcv.tgtPress;}
    end=(isRegainer?'regainer ':'receiver ')+(tackled?'tackled':'lost it (loose/duel)');
    if(!isRegainer&&rcvPress!==null&&rcvPress<2.5)end+=' [marked at pass]';
   }
  }
  // the regainer's own decisions until his first release (or the loss / window end), and the ground he carried
  const tFirst=rels.length?rels[0].t+t0r:tEnd;
  const myDec=(prepBy.get(idx.get(o)!)??[]).filter(c=>c.time>=t0r-1e-6&&c.time<=tFirst+1e-6).slice(0,6).map(c=>[r2(c.time-t0r),c.action,c.reason]);
  const kFirst=frameAt(tFirst),carryGain=r2(depth(wi,frames[kFirst].ball.x)-bd);
  const brk=breaks.filter(c=>roster[c.player]?.side===wi&&c.time>=t0r-.2&&c.time<=t0r+WIN);
  const brkPlayers=new Set(brk.filter(c=>c.time<=t0r+3).map(c=>c.player));
  const runN=new Set(runs.filter(c=>roster[c.player]?.side===wi&&c.time>=t0r-.2&&c.time<=t0r+3).map(c=>c.player));
  regains.push({t:r2(t0r),wi,lo,ws:styles[wi],ls:styles[lo],role:roleOf(o),bd:r2(bd),
   press:r2(press),within3,open:open.length,openFwd:openFwd.length,
   loAhead:losersAhead.length,loAheadM:r2(losersAhead.reduce((a,x)=>a+bd-depth(wi,x.q.x),0)),loAheadMax:r2(Math.max(0,...losersAhead.map(x=>bd-depth(wi,x.q.x)))),
   loGoalSide:losersGoalSide.length,wAhead:winnersAhead.length,wFree:free.length,advToGoal:r2(L-mostAdv),lastLoser:r2(lastLoserD),
   loRel:loRel?{kind:loRel.kind,sx:loRel.sx,gain:loRel.gain,len:loRel.len,behind:loRel.behind,action:loRel.action}:null,loTackle,loRestart,loDur:r2(t0r-loStart),
   rels,myDec,carryGain,end,tLoss:tLoss===null?null:r2(tLoss-t0r),shots,goal,maxD:r2(maxD),third,tThird,gain5:r2(maxD5-bd),pressAt,
   brk0:brk.length?r2(brk[0].time-t0r):null,brkN:brkPlayers.size,runN:runN.size});
  prevStart=t0r;
 }

 // ---- regain-fixes (2026-10-11) additions: flips (ping-pong), six-yard short passes, headline lights ----
 // A FLIP is a frame where an outfielder/keeper of the side that did not have the ball last takes control
 // (the same rule as a regain, any zone). Ping-pong: a flip within 2 s of the previous flip that hands it back
 // between the same two players (winner = the previous loser, loser = the previous winner), or within 2 m of it.
 const flips:any[]=[];let prevCtl:string|null=null;
 for(let k=0;k<n;k++){const f=frames[k];if(f.restart){prevCtl=null;continue;}const o=owner[k];if(!o)continue;
  if(prevCtl&&sideOf(o)!==sideOf(prevCtl)){
   // cause: the winner's won tackle just before; a release by the losers (interception); else a loose ball / body contact
   const tPrev=flips.length?flips[flips.length-1].t:-9,win=events.filter(e=>e.time>Math.max(tPrev,f.time-1.5)-1e-6&&e.time<=f.time+1e-6);
   const cause=win.some(e=>e.kind==='tackle'&&e.actor===o&&!/păstrează/.test(e.text))?'tackle':win.some(e=>(e.kind==='pass'||e.kind==='clearance'||e.kind==='shot')&&sideOf(e.actor)===sideOf(prevCtl))?'release':'loose';
   flips.push({t:r2(f.time),w:o,l:prevCtl,x:r2(f.ball.x),y:r2(f.ball.y),wr:roleOf(o),bd:r2(depth(sideOf(o),f.ball.x)),cause});}
  prevCtl=o;}
 const ppDiag:any[]=[],ppCause:Record<string,number>={},flipCause:Record<string,number>={};let ppSame=0,pp2m=0,ppAny=0,pp1s=0;const ppT:number[]=[];
 for(let i=1;i<flips.length;i++){const a=flips[i-1],b=flips[i];if(b.t-a.t>2)continue;
  const same=b.w===a.l&&b.l===a.w,near=Math.hypot(b.x-a.x,b.y-a.y)<=2;
  if(same)ppSame++;if(near)pp2m++;if((same||near)&&b.t-a.t<1)pp1s++;if(same||near)ppCause[b.cause]=(ppCause[b.cause]??0)+1;if(same||near){ppAny++;ppT.push(b.t);if(t.diag)ppDiag.push({a,b,same,near,ev:events.filter(e=>e.time>=a.t-1&&e.time<=b.t+.05).map(e=>[r2(e.time),e.kind,e.actor?roleOf(e.actor)+sideOf(e.actor):'',e.text])});}}
 for(const x of flips)flipCause[x.cause]=(flipCause[x.cause]??0)+1;
 // Won back within 3 s of losing it: by the man who lost it (re-challenge) or by a team-mate (counter-press)
 let backSame=0,backMate=0;for(let i=1;i<flips.length;i++){const a=flips[i-1],b=flips[i];if(b.t-a.t>3)continue;if(b.w===a.l)backSame++;else backMate++;}
 // chains: 3+ flips inside 2 s
 let chains=0;for(let i=2;i<flips.length;i++)if(flips[i].t-flips[i-2].t<=2&&!(i>2&&flips[i-1].t-flips[i-3].t<=2))chains++;
 // Six-yard short passes under pressure: a pass (not a clearance, loft or shot) struck from inside the passer's own
 // goal area (depth <= 3.5 m, |y| <= 5.5 m: the 3 x 9 m area plus a stride) or the wider near-goal zone (depth < 6 m,
 // |y| < 8 m), length < 6 m, with an opponent within 2.5 m of the passer at the strike.
 const sixDiag:any[]=[];const six={strict:0,wide:0,strictAll:0,wideAll:0,lostWide:0};const sixT:number[]=[];
 for(const e of events){if(e.kind!=='pass'||e.aerial||!e.pass?.aim)continue;const s=sideOf(e.actor);if(s<0)continue;
  const k=frameAt(e.time),f=frames[k],q=posOf(f,idx.get(e.actor)!);if(!q)continue;
  const d=depth(s,f.ball.x),len=dist(e.pass.aim,f.ball),press=Math.min(...team(f,1-s,true).map(x=>dist(x.q,q)));
  const strict=d<=3.5&&Math.abs(f.ball.y)<=5.5,wide=d<6&&Math.abs(f.ball.y)<8;
  if(!wide||len>=6)continue;
  if(strict)six.strictAll++;six.wideAll++;
  if(press<2.5){if(strict)six.strict++;six.wide++;sixT.push(r2(e.time));if(t.diag){const pr=lastPrep(e.actor,e.time);sixDiag.push([r2(e.time),roleOf(e.actor),roleOf(e.target),r2(d),r2(len),r2(press),pr?.action,pr?.reason,r2(e.time-(pr?.time??e.time))]);}
   for(let j=k+1;j<n&&frames[j].time<=e.time+3;j++){const g=frames[j];if(g.restart)break;const o=owner[j];if(o&&sideOf(o)!==s){six.lostWide++;break;}if(o&&sideOf(o)===s&&o!==e.actor)break;}}}
 // Headline lights from the official compaction: clear chance = a read shot worth >= 0.3 on the repo table.
 const shotsE=events.filter(e=>e.kind==='shot');
 const shotRows=shotsE.map(e=>{const s=sideOf(e.actor),q=e.shot?.assessment?.quality;const v=q!==undefined&&Number.isFinite(q)?rateOf(Math.round(q*1000)/1000):e.technique==='header'?shotChance({sk:1} as any):e.technique==='volley'?shotChance({sk:2} as any):e.freeKick?shotChance({sk:3} as any):0;return {s,v:v??0,read:q!==undefined};});
 const lights=[0,1].map(s=>({goals:R.score[s],shots:shotRows.filter(r=>r.s===s).length,clear:shotRows.filter(r=>r.s===s&&r.read&&r.v>=.3).length,xg:r2(shotRows.filter(r=>r.s===s).reduce((a,r)=>a+r.v,0))}));
 // ---- recovery probe (2026-10-15) additions ----
 // rec: every flip is a loss for the side that had it. Won back = the next flip hands it back to that side in open play
 // (no restart in between). Binned by time from the loss [<1, 1-2, 2-3, 3-5 s] and by who won it back: the man who lost
 // it (same) or a team-mate (mate). tackleSame: of the losses to a won tackle, won back by the tackled man within 2 s.
 // pp: each ping-pong pair as [t of the first flip, t of the hand-back, same two players 0/1, within 2 m 0/1, cause of
 // the hand-back, winner role+side], for picking frames to look at.
 const restartAt:number[]=[];for(let k=0;k<n;k++)if(frames[k].restart&&(k===0||!frames[k-1].restart))restartAt.push(frames[k].time);
 const bin=(dt:number)=>dt<1?0:dt<2?1:dt<3?2:dt<5?3:-1;
 const rec={loss:flips.length,same:[0,0,0,0],mate:[0,0,0,0],tackleLoss:0,tackleSame:0};
 for(let i=0;i<flips.length;i++){const a=flips[i],b=flips[i+1];if(a.cause==='tackle')rec.tackleLoss++;
  if(!b||sideOf(b.w)!==sideOf(a.l)||restartAt.some(x=>x>a.t+1e-6&&x<b.t-1e-6))continue;
  const k2=bin(b.t-a.t);if(k2<0)continue;(b.w===a.l?rec.same:rec.mate)[k2]++;if(a.cause==='tackle'&&b.w===a.l&&b.t-a.t<2)rec.tackleSame++;}
 const pp:any[]=[];for(let i=1;i<flips.length;i++){const a=flips[i-1],b=flips[i];if(b.t-a.t>2)continue;const same=b.w===a.l&&b.l===a.w,near=Math.hypot(b.x-a.x,b.y-a.y)<=2;if(same||near)pp.push([a.t,b.t,same?1:0,near?1:0,b.cause,b.wr+sideOf(b.w)]);}
 // ---- duel recovery (2026-10-16) additions: dr ----
 // wonLoose: won tackles that knock the ball loose (the won-tackle branch: "o scoate din duel" / "o desprinde din
 // picior"); who controls it next within 3 s (tackled / tackler / a mate of either / a restart / nobody) and, for the
 // tackled man, how soon [< 0.25, 0.25-0.5, 0.5-1, 1-3 s].
 const dr:any={wonLoose:0,next:{tackled:0,tackler:0,mateTackler:0,mateTackled:0,restart:0,none:0},tackledAt:[0,0,0,0],downs:[],top:{}};
 for(const e of events){
  if(e.kind!=='tackle'||!/o scoate din duel|o desprinde din picior/.test(e.text))continue;
  dr.wonLoose++;let k=frameAt(e.time);while(k<n&&frames[k].time<=e.time+1e-6)k++;
  let who:any=null,dt=0;for(;k<n&&frames[k].time<=e.time+3;k++){const f=frames[k];if(f.restart){who='R';break;}const o=owner[k];if(o){who=o;dt=f.time-e.time;break;}}
  const kind=who===null?'none':who==='R'?'restart':who===e.target?'tackled':who===e.actor?'tackler':sideOf(who)===sideOf(e.actor)?'mateTackler':'mateTackled';
  dr.next[kind]++;if(kind==='tackled')dr.tackledAt[dt<.25?0:dt<.5?1:dt<1?2:3]++;
 }
 // downs: every spell a player spends on the floor (duty 'down', frames), [start s, length s, role+side]
 {const open=new Map<number,number>();
  for(let k=0;k<n;k++){const f=frames[k];f.players.forEach((q:any,slot:number)=>{const i=f.lineup?f.lineup[slot]:slot;
   if(q.duty==='down'){if(!open.has(i))open.set(i,f.time);}else if(open.has(i)){dr.downs.push([r2(open.get(i)!),r2(f.time-open.get(i)!),roleOf(roster[i].id)+roster[i].side]);open.delete(i);}});}}
 // top: players on top of each other. For every frame in open play, every pair of players (keepers included) closer than
 // 1 m (and 0.6 m: discs overlapping), classed as team-mates, opponents with the ball within 2 m of either (a duel /
 // tackle contact) or opponents away from the ball. Seconds per match (frame time, a pair counted once a frame) and
 // episodes (a pair under 1 m for at least 0.4 s running: something the eye sees), with the duties of the two men at the
 // start of each episode (the commonest duty pairs per class) and the longest episodes (for frames).
 {const dt=n>1?(frames[n-1].time-frames[0].time)/(n-1):.05,sec:Record<string,number>={mate:0,duel:0,off:0,mate6:0,duel6:0,off6:0};
  const run=new Map<string,{t0:number;cls:string;a:string;b:string;da:string;db:string;min:number}>(),eps:any[]=[];
  const close=(key:string,tEnd:number)=>{const r=run.get(key)!;run.delete(key);const len=tEnd-r.t0;if(len>=.4)eps.push({t:r2(r.t0),len:r2(len),cls:r.cls,a:r.a,b:r.b,da:r.da,db:r.db,min:r2(r.min)});};
  for(let k=0;k<n;k++){const f=frames[k],seen=new Set<string>();
   if(!f.restart){
    const ps=roster.map((p,i)=>({p,q:posOf(f,i)})).filter(x=>x.q);
    for(let a=0;a<ps.length;a++)for(let b=a+1;b<ps.length;b++){const A=ps[a],B=ps[b],d=dist(A.q,B.q);if(d>=1)continue;
     const cls=A.p.side===B.p.side?'mate':Math.min(dist(A.q,f.ball),dist(B.q,f.ball))<2?'duel':'off';
     sec[cls]+=dt;if(d<.6)sec[cls+'6']+=dt;
     const key=A.p.id+'|'+B.p.id;seen.add(key);const r=run.get(key);
     if(!r)run.set(key,{t0:f.time,cls,a:roleOf(A.p.id)+A.p.side,b:roleOf(B.p.id)+B.p.side,da:A.q.duty,db:B.q.duty,min:d});else r.min=Math.min(r.min,d);}
   }
   for(const key of [...run.keys()])if(!seen.has(key))close(key,f.time);
  }
  for(const key of [...run.keys()])close(key,frames[n-1].time);
  const pairs:Record<string,Record<string,number>>={mate:{},duel:{},off:{}},count:Record<string,number>={mate:0,duel:0,off:0},len:Record<string,number>={mate:0,duel:0,off:0};
  for(const e of eps){count[e.cls]++;len[e.cls]+=e.len;const dp=[e.da,e.db].sort().join('+');pairs[e.cls][dp]=(pairs[e.cls][dp]??0)+1;}
  const topPairs=(o:Record<string,number>)=>Object.entries(o).sort((x,y)=>y[1]-x[1]).slice(0,6);
  dr.top={sec:Object.fromEntries(Object.entries(sec).map(([k,v])=>[k,r2(v)])),eps:count,epLen:Object.fromEntries(Object.entries(len).map(([k,v])=>[k,r2(v)])),
   pairs:{mate:topPairs(pairs.mate),duel:topPairs(pairs.duel),off:topPairs(pairs.off)},longest:[...eps].sort((x,y)=>y.len-x.len).slice(0,8)};}
 const st=(s:number)=>{const x=R.stats[s];return {passes:x.passes,completed:x.completed,shots:x.shots,turnovers:x.turnovers,tackles:x.tackles,tacklesWon:x.tacklesWon,fouls:x.fouls,beaten:x.beaten};};
 return {label:t.label,kind:'regains',arm:t.arm,seed:t.seed,rev:t.rev,ours:t.seed%2,styles,kickoff:inp.kickoff,build:run.engineBuild.slice(0,8),score:R.score,stats:[st(0),st(1)],dropped:[],ms,regains,flips:flips.length,flipCause,ppCause,ppSame,pp1s,backSame,backMate,pp2m,ppAny,ppT,chains,six,sixT,lights,rec,pp,dr,...(t.diag?{ppDiag,flipList:flips,sixDiag}:{})};
}
