// R1 combine (2026-10-14): the support-study row (../2026-10-14-support-study/support.ts: deep.ts + sup, unchanged)
// plus st[side].r1, the situations the three R1 branches aimed at and their guardrails. Evidence only; reads the
// recorded match. Definitions follow the branches' own harnesses (r1-shape r1.ts, r1-mech measure.ts, r1-keeper
// keeper.ts):
//  own3 / own3Two  s of open-play possession with the ball <= 16 m from our goal / of those, with >= 2 of our
//                  outfielders < 5 m from our goal line and |y| < 9 (r1-shape)
//  gkCarry         keeper spells with the ball at his feet (frame.control, live) in which he moves >= 1 m start to end;
//                  gkCarryBack: of those, begun from a team-mate's pass (r1-keeper); gkFeet: all such spells
//  selfDefl        passes whose ball goes loose < 0.8 m from the passer <= 0.4 s after the release (r1-mech)
//  clears, clrOurs / clrTheirs / clrOut  every clearance by who touches it next (or out / a restart)
//  channel, chOurs / chTheirs / chOut    the same for channel clearances (the 'în teren, unde pot ajunge colegii' reason)
//  own3Losses / own3LossGoals  turnovers with the ball <= 16 m from the loser's goal / a goal for the winner <= 8 s after
//  longFinal       passes and clearances aimed >= 32 m from our goal and >= 20 m long; longClean: the next touch is
//                  our receive (not a turnover, out, save or their touch)
//  lofted          passes in the air (e.aerial or pass.lofted); toKeeper: passes to our own keeper; passes; shots
import {play as deepPlay,armTreatment} from '../2026-10-12-deep-study/deep';
import {extra as supportExtra} from '../2026-10-14-support-study/support';
export {armTreatment};
const L=48;
const depthOf=(s:number,x:number)=>s===0?x:L-x;
const NEXT=new Set(['receive','turnover','out','save','goal','shot','pass','clearance','block','tackle','restart']);
export function r1Keys(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,choices:any[]=R.choices??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const posAt=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const fi=(t:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi)>>1;if(frames[m].time<t)lo=m+1;else hi=m;}return lo;};
 const per=[0,1].map(()=>({own3:0,own3Two:0,gkFeet:0,gkCarry:0,gkCarryBack:0,passes:0,selfDefl:0,clears:0,clrOurs:0,clrTheirs:0,clrOut:0,
  channel:0,chOurs:0,chTheirs:0,chOut:0,own3Losses:0,own3LossGoals:0,longFinal:0,longClean:0,lofted:0,toKeeper:0,shots:0}));
 const goals=events.filter((e:any)=>e.kind==='goal');
 // frame-weighted own-third possession
 for(let k=0;k+1<frames.length;k++){
  const f=frames[k],dt=Math.min(.2,frames[k+1].time-f.time);if(dt<=0)continue;
  const o=f.ball.owner;if(!o||f.restart)continue;const s=sideOf(o);if(s<0)continue;
  if(depthOf(s,f.ball.x)>16)continue;per[s].own3+=dt;
  let at=0;roster.forEach((p:any,i:number)=>{if(p.side!==s||p.role==='GK')return;const q=posAt(f,i);if(q&&depthOf(s,q.x)<5&&Math.abs(q.y)<9)at++;});
  if(at>=2)per[s].own3Two+=dt;
 }
 // keeper spells at his feet
 for(const [ki,K] of roster.entries()){
  if(K.role!=='GK')continue;const S=K.side;
  const feet=(f:any)=>f.ball.owner===K.id&&!f.restart&&!!f.control;
  for(let k=0;k<frames.length;k++){
   if(!feet(frames[k])||(k>0&&feet(frames[k-1])))continue;
   let j=k;while(j+1<frames.length&&feet(frames[j+1]))j++;
   const a=posAt(frames[k],ki),b=posAt(frames[j],ki);
   if(a&&b){per[S].gkFeet++;
    if(Math.hypot(a.x-b.x,a.y-b.y)>=1){per[S].gkCarry++;
     const t0=frames[k].time;let back=false;
     for(let e=events.length-1;e>=0;e--){const x=events[e];if(x.time>t0+1e-6)continue;if(x.time<t0-5)break;if(x.kind==='pass'||x.kind==='clearance'){back=x.actor!==K.id&&sideOf(x.actor)===S;break;}if(x.kind==='restart'||x.kind==='save'||x.kind==='turnover'||x.kind==='tackle')break;}
     if(back)per[S].gkCarryBack++;}}
   k=j;
  }
 }
 for(const e of events)if(e.kind==='shot'){const s=sideOf(e.actor);if(s>=0)per[s].shots++;}
 for(let k=0;k<events.length;k++){
  const e=events[k];if(e.kind!=='pass'&&e.kind!=='clearance')continue;
  const s=sideOf(e.actor);if(s<0)continue;const st=per[s];
  let next:any=null;for(let q=k+1;q<events.length;q++)if(NEXT.has(events[q].kind)){next=events[q];break;}
  const who=!next||next.kind==='out'||next.kind==='restart'||next.kind==='goal'?'out':sideOf(next.actor)===s?'ours':'theirs';
  const f0=frames[fi(e.time)];
  const aim=e.pass?.aim??e.aerial?.aim;
  if(aim&&f0&&depthOf(s,aim.x)>=32&&Math.hypot(aim.x-f0.ball.x,aim.y-f0.ball.y)>=20){st.longFinal++;if(next&&next.kind==='receive'&&sideOf(next.actor)===s)st.longClean++;}
  if(e.kind==='pass'){
   st.passes++;
   let self=false;
   for(let j=fi(e.time);j<frames.length&&frames[j].time<=e.time+.4;j++){const f=frames[j];if(next&&f.time>=next.time)break;
    if(f.ball.mode==='loose'&&!f.ball.owner){const q=posAt(f,idx.get(e.actor)!);if(q&&Math.hypot(q.x-f.ball.x,q.y-f.ball.y)<.8)self=true;break;}}
   if(self)st.selfDefl++;
   if(e.aerial||e.pass?.lofted)st.lofted++;
   if(e.target&&roster[idx.get(e.target)!]?.role==='GK'&&sideOf(e.target)===s)st.toKeeper++;
  }else{
   st.clears++;if(who==='ours')st.clrOurs++;else if(who==='theirs')st.clrTheirs++;else st.clrOut++;
   const pi=idx.get(e.actor);let why='';for(const c of choices){if(c.time>e.time)break;if(c.player===pi&&c.action==='clear')why=c.reason??'';}
   if(/în teren, unde pot ajunge colegii/.test(why)){st.channel++;if(who==='ours')st.chOurs++;else if(who==='theirs')st.chTheirs++;else st.chOut++;}
  }
 }
 for(const e of events){if(e.kind!=='turnover')continue;const winner=sideOf(e.actor);if(winner<0)continue;const loser=1-winner;
  const f=frames[fi(e.time)];if(f&&depthOf(loser,f.ball.x)<=16){per[loser].own3Losses++;if(goals.some((g:any)=>g.side===winner&&g.time>=e.time&&g.time<=e.time+8))per[loser].own3LossGoals++;}}
 for(const p of per){p.own3=Math.round(p.own3*10)/10;p.own3Two=Math.round(p.own3Two*10)/10;}
 return per;
}
// st = the support study's per-side array, unchanged, with each side's r1 keys added as st[side].r1
export function play(t:{label:string;arm:string;seed:number;rev:string}){return deepPlay(t,R=>{const A:any[]=supportExtra(R),k=r1Keys(R);A.forEach((a,s)=>{a.r1=k[s];});return A;});}
