// Defensive ceiling, recon round 2 (20 Oct): the box reception behind every clear chance after a depth run, from the
// FULL engine record of a replayed match (no behaviour change; pd.ts calls this only with --recon). Evidence only.
//
// The chance types are recon.mjs's (a reception after a run of >= 6 m toward goal that started >= 20 m out, in the
// spell, <= 10 s before the shot; the last pass to the shooter a team-mate's, cleanly received). The reception that
// leads to the shot: the runner's own receive when he shot himself, else the shooter's receive of the last pass.
// Per chance:
//  flight    lofted (the pass event is an aerial) or ground; apex height (m, max ball z from the pass to the receive);
//            landing point: a lofted ball's first fall below 0.5 m after its apex (else where it was received), a ground
//            ball's reception point; its distance from the goal centre
//  landing   at the landing moment: the receiver's, his marker's (the defender whose job target was the receiver at the
//            pass) and the keeper's distance to the landing point; the nearest of those three and the nearest
//            defender of all; the marker goal-side of the receiver, and of the landing point (nearer goal than it)
//  duel      a reception duel (engine receptionDuels) on that receive, its defender and outcome; aerial duels there;
//            challenges by any defender from the receive to the shot (duty 'challenge') and tackles on the receiver
//  marker    his duties in the 2 s after the receive, up to the shot (frames' duty), summarised challenge > block > press/jockey >
//            track/recover (mark) > cover > other
//  keeper    came (a 'sweep' duty from the pass to the shot), stepped (moved >= 1 m toward the landing point from the
//            pass to the receive) or stayed; his distance from the landing point at landing and from his goal line
//  then      seconds from the receive to the shot, the shot's table rate, goal
import {shotChance} from '../../../../lib/ballers/chances';
import {L,DEEP_FROM,SL} from './measure';

const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const r1=(v:number)=>Math.round(v*10)/10,r2=(v:number)=>Math.round(v*100)/100;
export const kindOf=(c:any)=>c.via==='restart'?'restart':c.via==='none'?'no pass':c.via==='loose'?'loose':c.chain?(c.chain.from>=DEEP_FROM?(c.chain.shooter?'depth run: runner shot':'depth run: then a team-mate'):'short run'):c.ballDepth<4*SL?'cut-back':'other pass';

/** opts.all (recon round 3, styles): every clear chance, not only the depth-run ones (a chance with no clean reception
 * keeps only its type, table rate and goal); opts.noWins: keep no compact windows. */
export function boxRecon(R:any,rIdx:Map<string,number>,ch:any[],A:number,compactFrames:any[],compactEvents:any[],opts:{all?:boolean;noWins?:boolean}={}){
 const roster:any[]=R.players,F:any[]=R.frames,D=1-A,g={x:D===0?0:L,y:0};
 const rosterOfC=new Map<number,number>();roster.forEach((p,i)=>{const c=rIdx.get(p.id);if(c!==undefined)rosterOfC.set(c,i);});
 const fAt=(t:number)=>{let lo=0,hi=F.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(F[m].time<=t+1e-6)lo=m;else hi=m-1;}return lo;};
 const pos=(f:any,i:number)=>f.players[i];
 const gk=roster.findIndex(p=>p.side===D&&p.role==='GK'),outD=roster.map((p,i)=>i).filter(i=>roster[i].side===D&&roster[i].role!=='GK');
 const byPlayer=new Map<number,any[]>();for(const c of R.choices??[]){if(!c.assignment)continue;const a=byPlayer.get(c.player)??[];a.push(c);byPlayer.set(c.player,a);}
 const jobAt=(i:number,t:number)=>{let best:any=null;for(const c of byPlayer.get(i)??[]){if(c.time<=t+1e-6)best=c;else break;}return best;};
 const out:any[]=[],wins:any[]=[];
 for(const c of ch){
  const kind=kindOf(c);if(!opts.all&&!kind.startsWith('depth run'))continue;
  if(c._q===undefined&&kind!=='depth run: runner shot'){const shot=R.events[c._sq];
   out.push({t:r1(shot?.time??0),kind,noReception:true,chance:r2(shotChance(compactEvents[c._sq])??0),goal:R.events.some((e:any)=>e.kind==='goal'&&e.side===A&&e.time>=shot.time&&e.time<=shot.time+4)});continue;}
  const own=kind==='depth run: runner shot',q=own?c.chain._q:c._q,rc=own?c.chain._g:c._g;
  const pass=R.events[q],shot=R.events[c._sq],rr=rosterOfC.get(rc)!,rid=roster[rr]?.id;
  if(!pass||!shot||rr===undefined){out.push({t:r1(shot?.time??0),kind,error:'index'});continue;}
  // (a first-time finish: the receive is the shot itself)
  const rt=Math.min(own?c.chain._rt:c._rt,shot.time);
  // (round 3) aimed beyond D's deepest outfielder at the pass: the shot-leading pass, and the depth run's pass
  const behindOf=(e:any)=>{const aim=e?.pass?.aim??e?.aerial?.aim;if(!aim)return null;const f=F[fAt(e.time)],dd=(x:number)=>D===0?x:L-x;return dd(aim.x)<Math.min(...outD.map(i=>dd(f.players[i].x)))-.3;};
  // flight
  const k0=fAt(pass.time),k1=Math.max(k0,fAt(rt));
  let apex=0,ka=k0;for(let k=k0;k<=k1;k++)if(F[k].ball.z>apex){apex=F[k].ball.z;ka=k;}
  const lofted=!!pass.aerial;let kl=k1;
  if(lofted)for(let k=ka;k<=k1;k++)if(F[k].ball.z<.5){kl=k;break;}
  const fl=F[kl],land={x:fl.ball.x,y:fl.ball.y};
  const marker=outD.find(i=>jobAt(i,pass.time)?.assignment?.target===rid);
  const dR=dist(pos(fl,rr),land),dM=marker!==undefined?dist(pos(fl,marker),land):null,dK=gk>=0?dist(pos(fl,gk),land):null;
  const three=[['receiver',dR],['marker',dM],['keeper',dK]].filter(x=>x[1]!==null).sort((a:any,b:any)=>a[1]-b[1]) as [string,number][];
  const allD=outD.map(i=>({i,d:dist(pos(fl,i),land)})).sort((a,b)=>a.d-b.d)[0];
  const fr=F[k1];
  const markerGoalSide=marker!==undefined?dist(pos(fr,marker),g)<dist(pos(fr,rr),g):null;
  const markerGoalSideOfLanding=marker!==undefined?dist(pos(fl,marker),g)<dist(land,g):null;
  // duels and challenges
  const duels=(R.receptionDuels??[]).filter((d:any)=>d.receiver===rid&&d.time>=pass.time-1e-6&&d.time<=rt+.35);
  const air=(R.aerialDuels??[]).filter((d:any)=>(d.attacker===rid||d.toucher===rid)&&d.time>=pass.time-1e-6&&d.time<=rt+.35);
  const ks=fAt(shot.time);
  const challengers=new Set<string>();for(let k=k1;k<=ks;k++)for(const i of outD)if(F[k].players[i].duty==='challenge')challengers.add(roster[i].id);
  const tackles=R.events.filter((e:any)=>e.kind==='tackle'&&e.time>=rt-1e-6&&e.time<=shot.time+1e-6&&(e.actor===rid||e.target===rid)).map((e:any)=>e.text);
  // the marker's duties in the 2 s after the receive
  const duties=new Set<string>();if(marker!==undefined)for(let k=k1;k<F.length&&F[k].time<=Math.min(rt+2,shot.time)+1e-6;k++)duties.add(F[k].players[marker].duty);
  const summary=marker===undefined?'no marker':duties.has('challenge')?'challenge':duties.has('block')?'block':duties.has('press')||duties.has('jockey')?'press':duties.has('track')||duties.has('recover')?'mark':duties.has('cover')?'cover':'other';
  // the keeper
  let came=false;if(gk>=0)for(let k=k0;k<=ks;k++)if(F[k].players[gk].duty==='sweep'){came=true;break;}
  const kStart=gk>=0?dist(pos(F[k0],gk),land):0,kRecv=gk>=0?dist(pos(fr,gk),land):0;
  const keeper=gk<0?'none':came?'came':kStart-kRecv>=1?'stepped':'stayed';
  const goal=R.events.some((e:any)=>e.kind==='goal'&&e.side===A&&e.time>=shot.time&&e.time<=shot.time+4);
  const se=compactEvents[c._sq];
  out.push({t:r1(shot.time),kind,recv:roster[rr].role,recvGoal:r1(dist(pos(fr,rr),g)),dMarkerRecv:marker!==undefined?r1(dist(pos(fr,marker),pos(fr,rr))):null,behind:behindOf(pass),chainBehind:c.chain?behindOf(R.events[c.chain._q]):null,lofted,apex:r1(apex),landGoal:r1(dist(land,g)),
   dRecv:r1(dR),dMarker:dM===null?null:r1(dM),dKeeper:dK===null?null:r1(dK),nearest:three[0]?.[0]??null,nearestBy:three[1]?r1(three[1][1]-three[0][1]):null,
   nearestD:allD?(allD.i===marker?'marker':allD.i===undefined?null:'other defender'):null,nearestDd:allD?r1(allD.d):null,
   markerGoalSide,markerGoalSideOfLanding,duel:duels.length?{n:duels.length,by:duels.map((d:any)=>d.defender===roster[marker??-1]?.id?'marker':'other'),outcome:duels.map((d:any)=>d.outcome)}:null,
   air:air.length?air.map((d:any)=>({winner:d.winner===rid?'receiver':'defender',outcome:d.outcome})):null,challengers:challengers.size,challengedByMarker:marker!==undefined&&challengers.has(roster[marker].id),tackles,
   markerDuties:[...duties],marker:summary,keeper,keeperDist:r1(kRecv),keeperLine:gk>=0?r1(Math.abs(pos(fr,gk).x-g.x)):null,recvToShot:r2(shot.time-rt),chance:r2(shotChance(se)??0),goal});
  if(!opts.noWins)wins.push({t:r1(shot.time),from:Math.round((shot.time-12)*1000),frames:compactFrames.filter((f:any)=>f.t>=(shot.time-12)*1000&&f.t<=(shot.time+1)*1000)});
 }
 return {chances:out,wins};
}
