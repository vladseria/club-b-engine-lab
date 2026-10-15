// Contest combine (2026-10-15, branch ballers-contest: reception duels + contests in the air + pressure on the shooter,
// on ballers-r1). One row per match. Evidence only; reads the recorded match.
//
// The row: the deep-study row (../2026-10-12-deep-study/deep.ts: official fields + agg, the official runMatch call), and
// st[side] = the R1 situation row (../2026-10-14-r1/sit.ts: the support study's keys + r1) plus
//   d    the reception-duel keys (../2026-10-15-contest-reception/duel.ts duelKeys; side = the RECEIVING side): duels,
//        outcomes, commits, long-ball duels, per-duel rows, first touch after >= 0.8 s flights [ours, theirs] (ft, ftNear),
//        receptions with a man < 1.25 m (rec), long balls into the final third received in front of / behind their last
//        man with goals within 12 s (front100)
//   air  the air keys (a copy of ../2026-10-15-contest-aerial/aerial.ts play(), which keeps them inline; side = the side
//        whose ball it was): long (lofted passes > 0.8 s), lt first touch [ours, theirs, none], ltNear, air contacts by
//        technique [attacking, defending], airShot/airPass/airClear, duels {n, won [attackers, defenders], out, second,
//        unc (a lone defender's challenge), uncRes, uncNext [ours, theirs]}, possSpell
//   sh   the shot keys (../2026-10-15-contest-shot/shot.ts extra): one row per shot with distance, nearest man, closing
//        speed, lane, pressure band (0 free, 1 man < 2 m, 2 body hiding >= 30% of the goal), outcome, ..., and the
//        engine's own contest at the strike (rush, shadow, balance, hurry) where recorded; dec[band] the carrier's
//        choices in shooting range by pressure [n, shoot, pass, carry, feint, other]; cut (cutbacks)
//        sh.decL[band]: the same choices in shooting range by the shot.ts strike bands, read at the choice (0 free: nobody
//        < 2 m and bodies hide < 30% of the goal; 1 a man < 2 m; 2 bodies 0.3-6 m out hide >= 30% of the goal from the
//        ball): [n, shoot]. With sh.shots (distance [1], nearest man [3], band [6], outcome [7]: g goal, b blocked, ...)
//        this gives goals per shot and shoot share by nearest-man band (>= 4 / 2-4 / < 2 m: sh.dec) and by free / man /
//        body in lane, shot distance and blocked shots (cmp.mjs).
// On the base build (ballers-r1) d and air hold only what can be read from frames/contacts (no duel records).
//
// Arms: any mirror arm (../2026-10-10-cloud-measure/mirror.ts: <a><f>v<b><g>, p-/m-<skill>, ...), optionally with
// modifiers, each `~<mod>`, applied to the treated side (seed % 2, the first-named configuration) unless said:
//   dare | caut   reception-duel presets on its outfielders (duel.ts): daring/eager (risk .8, audacity .8, engagement
//                 .85, discipline .6) | cautious (risk .2, audacity 0, engagement .25, discipline .95)
//   eh | el       air presets on its outfielders (aerial.ts): brave (engagement .9, risk .85, audacity .8) | hesitant
//                 (engagement .15, risk .15, audacity 0)
//   comp          shot temperament (shot.ts tm-): its outfielders composed (discipline .97), the other side's nervous (.45)
//   tight         its engine Tactics.marking = 'tight' (beat-Direct C5)
//   hf            its engine Tactics.holdFront + holdFrontCue (beat-Direct P1 retry, p1b; ported onto this branch)
//   opivot        the OTHER side's striker = 'pivot' (beat-Direct opponent dp)
// beat-Direct names: ref-di = di121vdi121, c5-di = di121vdi121~tight, p1b-di = di121vdi121~hf, ref-sh = di121vsh121,
// ref-dp = di121vdi121~opivot (treated side = the Direct 1-2-1 side with the option, as arms.ts builds them).
import {play as deepPlay,armTreatment as mirrorArm} from '../2026-10-12-deep-study/deep';
import {r1Keys} from '../2026-10-14-r1/sit';
import {extra as supportExtra} from '../2026-10-14-support-study/support';
import {duelKeys} from '../2026-10-15-contest-reception/duel';
import {extra as shotExtra} from '../2026-10-15-contest-shot/shot';

const OUT=(f:(p:any)=>void)=>(inp:any,treated:number)=>{for(const p of inp.sides[treated].players)if(!p.roles.includes('GK'))f(p);};
const MODS:Record<string,{input?:(inp:any,treated:number)=>void;teams?:(teams:any[],treated:number)=>void}>={
 dare:{input:OUT(p=>Object.assign(p.traits,{risk:.8,audacity:.8,engagement:.85,discipline:.6}))},
 caut:{input:OUT(p=>Object.assign(p.traits,{risk:.2,audacity:0,engagement:.25,discipline:.95}))},
 eh:{input:OUT(p=>Object.assign(p.traits,{engagement:.9,risk:.85,audacity:.8}))},
 el:{input:OUT(p=>Object.assign(p.traits,{engagement:.15,risk:.15,audacity:0}))},
 comp:{input:(inp,treated)=>inp.sides.forEach((sd:any,i:number)=>{for(const p of sd.players)if(!p.roles.includes('GK'))p.traits={...p.traits,discipline:i===treated?.97:.45};})},
 tight:{teams:(teams,treated)=>{teams[treated].tactics.marking='tight';}},
 hf:{teams:(teams,treated)=>{teams[treated].tactics.holdFront=true;teams[treated].tactics.holdFrontCue=true;}},
 opivot:{input:(inp,treated)=>{const s=inp.sides[1-treated];if(!('striker' in s.approach))throw Error('this revision has no striker setting');s.approach={...s.approach,striker:'pivot'};}},
};
function parse(arm:string){const [base,...mods]=arm.split('~');for(const m of mods)if(!MODS[m])throw Error('unknown modifier '+m);return {base,mods};}
export function armTreatment(arm:string){const {base}=parse(arm);return mirrorArm(base);}

// the air keys: ../2026-10-15-contest-aerial/aerial.ts play(), the reading part, unchanged in substance
export function airKeys(R:any){
 const roster:any[]=R.players,frames:any[]=R.frames,events:any[]=R.events,contacts:any[]=R.controlContacts??[];
 const idx=new Map(roster.map((p:any,i:number)=>[p.id,i]));
 const sideOf=(id:any)=>id!=null&&idx.has(id)?roster[idx.get(id)!].side as number:-1;
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const fi=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const mk=()=>({possSpell:0,spells:0,long:0,lt:[0,0,0],ltNear:[0,0],
  air:{chest:[0,0],header:[0,0],volley:[0,0]} as Record<string,number[]>,airShot:0,airPass:0,airClear:0,
  duels:{n:0,won:[0,0],out:{} as Record<string,number>,second:[0,0]} as any});
 const A=[mk(),mk()];
 let cur=-1,since=0;const owned=[0,0];
 for(const f of frames){const o=f.restart?null:f.ball?.owner;const s=o?sideOf(o):-1;if(s<0)continue;if(s!==cur){if(cur>=0){owned[cur]+=f.time-since;A[cur].spells++;}cur=s;since=f.time;}}
 if(cur>=0){owned[cur]+=frames.at(-1).time-since;A[cur].spells++;}
 for(const s of [0,1])A[s].possSpell=Math.round(owned[s]/Math.max(1,A[s].spells)*100)/100;
 const releases=events.filter((e:any)=>e.kind==='pass'||e.kind==='clearance'||e.kind==='shot');
 const releaseBefore=(time:number)=>{let lo=0,hi=releases.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(releases[m].time<=time+1e-6){best=m;lo=m+1;}else hi=m-1;}return best>=0?releases[best]:null;};
 const NEXT=new Set(['receive','turnover','out','save','goal','restart','foul','offside']);
 const touchEvents=events.filter((e:any)=>e.kind==='receive'||e.kind==='turnover'||e.kind==='save');
 for(let k=0;k<events.length;k++){
  const e=events[k];if(e.kind!=='pass'||!e.aerial||e.aerial.flight<=.8)continue;const s=sideOf(e.actor);if(s<0)continue;const st=A[s];
  let next:any=null;for(let q=k+1;q<events.length;q++)if(NEXT.has(events[q].kind)){next=events[q];break;}
  st.long++;
  const stop=next?next.time:e.time+6;
  const c=contacts.find((c:any)=>c.time>e.time+1e-6&&c.time<=stop+1e-6&&!(c.actor===e.actor&&c.time<e.time+.3));
  const h=touchEvents.find((x:any)=>x.time>e.time+1e-6&&x.time<=stop+1e-6);
  const first=c&&(!h||c.time<=h.time)?{actor:c.actor,time:c.time}:h?{actor:h.actor,time:h.time}:null;
  if(!first){st.lt[2]++;continue;}
  const fs=sideOf(first.actor),ours=fs===s;st.lt[ours?0:1]++;
  const f=frames[fi(first.time)],me=pos(f,idx.get(first.actor)!);
  if(me&&roster.some((p:any,i:number)=>p.side!==fs&&p.role!=='GK'&&(()=>{const q=pos(f,i);return q&&Math.hypot(q.x-me.x,q.y-me.y)<1;})()))st.ltNear[ours?0:1]++;
 }
 for(const c of contacts){
  if(!c.technique||!A[0].air[c.technique])continue;const s=sideOf(c.actor);if(s<0)continue;const r=releaseBefore(c.time),owner=r?sideOf(r.actor):-1;
  A[s].air[c.technique][owner===s||owner<0?0:1]++;
  if(owner===s){if(c.kind==='shot')A[s].airShot++;else if(c.kind==='pass')A[s].airPass++;else if(c.kind==='clearance')A[s].airClear++;}
 }
 for(const d of (R.aerialDuels??[])){
  const att=sideOf(d.attacker);if(att<0)continue;const D=A[att].duels;D.n++;
  const wonBy=d.winner===d.attacker?0:d.winner===d.defender?1:-1;if(wonBy>=0)D.won[wonBy]++;
  D.out[d.outcome]=(D.out[d.outcome]??0)+1;
  if(d.outcome==='knock'||d.result==='header-pass'||d.result==='cushion'){const nx=events.find((e:any)=>e.time>d.time+1e-6&&(e.kind==='receive'||e.kind==='turnover'||e.kind==='save'));if(nx){const s2=sideOf(nx.actor);if(s2>=0)D.second[s2===att?0:1]++;}}
 }
 for(const c of (R.aerialChallenges??[])){const s=sideOf(c.id);if(s<0)continue;const D:any=A[1-s].duels;D.unc=(D.unc??0)+1;(D.uncRes??={})[c.result]=(D.uncRes[c.result]??0)+1;
  const nx=events.find((e:any)=>e.time>c.time+1e-6&&(e.kind==='receive'||e.kind==='turnover'||e.kind==='save'));if(nx){(D.uncNext??=[0,0])[sideOf(nx.actor)===s?1:0]++;}}
 return A;
}

// the carrier's choices in shooting range (shot.ts extra's filter) by the strike bands of shot.ts, read at the choice
export function laneDecisions(R:any){
 const L=48,GH=2.5,BODY=.45,SHADOW=.3;
 const roster:any[]=R.players,frames:any[]=R.frames,choices:any[]=R.choices??[];
 const pos=(f:any,i:number)=>{if(f.lineup){const s=f.lineup.indexOf(i);return s>=0?f.players[s]:null;}return f.players[i];};
 const n=frames.length,frameAt=(time:number)=>{let lo=0,hi=n-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
 const out=[0,1].map(()=>[0,1,2].map(()=>[0,0]));
 for(const c of choices){
  if(!c.action)continue;const p=roster[c.player];if(!p||p.role==='GK')continue;
  const f=frames[frameAt(c.time)];if(f.restart||f.ball?.owner!==p.id)continue;
  const me=pos(f,c.player);if(!me)continue;
  const d=p.side===0?me.x:L-me.x;if(d<L*73/105||Math.abs(me.y)>30*24/68)continue;
  const goalX=p.side===0?L:0,aL=Math.atan2(-GH-me.y,goalX-me.x),aR=Math.atan2(GH-me.y,goalX-me.x),lo=Math.min(aL,aR),hi=Math.max(aL,aR);
  let near=99;const cover:[number,number][]=[];
  roster.forEach((q:any,i:number)=>{if(q.side===p.side||q.role==='GK')return;const o=pos(f,i);if(!o)return;const r=Math.hypot(o.x-me.x,o.y-me.y);near=Math.min(near,r);
   if(r>.3&&r<6&&(o.x-me.x)*(goalX-me.x)>0){const a=Math.atan2(o.y-me.y,o.x-me.x),w=Math.atan(BODY/r);const x=Math.max(lo,a-w),y=Math.min(hi,a+w);if(y>x)cover.push([x,y]);}});
  cover.sort((a,b)=>a[0]-b[0]);let hid=0,end=-9;for(const [a,b] of cover){const s0=Math.max(a,end);if(b>s0)hid+=b-s0;end=Math.max(end,b);}
  const shadow=hi>lo?hid/(hi-lo):0,band=shadow>=SHADOW?2:near<2?1:0,o=out[p.side][band];o[0]++;if(c.action==='shoot')o[1]++;
 }
 return out;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const {base,mods}=parse(t.arm);
 const hooks=mods.length?{base,input:(inp:any,tr:number)=>{for(const m of mods)MODS[m].input?.(inp,tr);},teams:(teams:any[],tr:number)=>{for(const m of mods)MODS[m].teams?.(teams,tr);}}:undefined;
 return deepPlay(t,(R:any)=>{
  const A:any[]=supportExtra(R),k=r1Keys(R),d=duelKeys(R,t.seed%2),air=airKeys(R),sh=shotExtra(R),dl=laneDecisions(R);
  A.forEach((a,s)=>{a.r1=k[s];a.d=d[s];a.air=air[s];a.sh={...sh[s],decL:dl[s]};});
  return A;
 },hooks);
}
