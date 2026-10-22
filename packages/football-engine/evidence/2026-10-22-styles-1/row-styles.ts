// Styles as identities, research row entry: the what-if row (../2026-10-22-whatif/row.ts: parity.ts plus each side's
// match anatomy) plus `extra.sty`, per side, read from the raw engine result after the match. Evidence only; it plays
// nothing of its own and changes no input.
//   surge.*        Counter's surges (the engine's own record, PracticeResult.surges, on revisions that keep it) and what
//                  came of them (lib/ballers/style-moments.ts, the app's own reading): n, goal, shot, lost, stopped,
//                  settled; regains: every time the side won the ball in open play (the ball changing sides on a
//                  receive / turnover / save), and how many of those happened in the side's own half; surgeOwnHalf:
//                  surges whose regain was in its own half (regain spot = the winner's position in that frame)
//   moves          Short's one-touch moves (style-moments), shots after one
//   ftLoss.*       first-time passes lost (the next ball event is the other side's), by where the pass was struck
//                  (own / their half), and the chance the opponent made within 10 s of such a loss (shot chance read as
//                  row.ts reads it); otherLoss.*: the same for every other loss in open play
import {setExtra,anatomy} from '../2026-10-22-whatif/row';
import {L} from '../../src/pitch';
import {shotChance} from '../../../../lib/ballers/chances';
import {styleMoments} from '../../../../lib/ballers/style-moments';
export * from '../2026-10-22-whatif/row';

const BALL=new Set(['receive','turnover','save','tackle','pass','clearance','shot','feint','beat']);
const STOP=new Set(['out','foul','offside','restart','half','end','goal']);
const z=()=>({surges:0,goal:0,shot:0,lost:0,stopped:0,settled:0,regains:0,regainsOwnHalf:0,surgeOwnHalf:0,moves:0,moveShots:0,
 ftLoss:0,ftLossOwn:0,ftLossChanceAgainst:0,ftLossOwnChanceAgainst:0,otherLoss:0,otherLossChanceAgainst:0});

export function styleExtra(runs:any[],teams:any[]){
 const out=[z(),z()];
 for(const r of runs){
  const roster:any[]=r.players??[],idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const frames:any[]=r.frames??[];
  const frameAt=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
  const posAt=(id:string,time:number)=>{if(!frames.length||!idx.has(id))return null;const f=frames[frameAt(time)],ri=idx.get(id)!;const j=f.lineup?f.lineup.indexOf(ri):ri;return j>=0?f.players?.[j]??null:null;};
  const own=(s:number,x:number)=>(s===0?x:L-x)<L/2;
  const ev:any[]=r.events??[];
  const chanceOf=(e:any)=>{const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;return shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;};
  // regains in open play
  let cur=-1;
  for(const e of ev){
   if(STOP.has(e.kind)){cur=-1;continue;}
   if(e.side!==0&&e.side!==1)continue;
   if(e.kind==='receive'||e.kind==='turnover'||e.kind==='save'){
    if(cur>=0&&e.side!==cur){out[e.side].regains++;const p=posAt(e.actor,e.time);if(p&&own(e.side,p.x))out[e.side].regainsOwnHalf++;}
    cur=e.side;
   }
  }
  // surges and one-touch moves (styles as the engine was told them)
  const styles=teams.map((t:any)=>t?.tactics?.style);
  for(const m of styleMoments(ev,r.surges,styles)){
   const a=out[m.mark.s];
   if(m.mark.k==='onetouch'){a.moves++;if(m.mark.shot)a.moveShots++;continue;}
   a.surges++;(a as any)[m.mark.o!]++;
  }
  for(const g of r.surges??[]){const e=ev.find((x:any)=>x.time>=g.regain-1e-6&&x.side===g.side&&(x.kind==='receive'||x.kind==='turnover'||x.kind==='save'));const p=e?posAt(e.actor,e.time):null;if(p&&own(g.side,p.x))out[g.side].surgeOwnHalf++;}
  // losses: after a first-time pass v any other, and what the opponent made of it within 10 s
  ev.forEach((e:any,i:number)=>{
   if(e.side!==0&&e.side!==1||!BALL.has(e.kind))return;
   const next=ev.find((x:any,j:number)=>j>i&&(BALL.has(x.kind)||STOP.has(x.kind)));
   if(!next||STOP.has(next.kind)||next.side===e.side||next.side===undefined)return;
   if(!(next.kind==='receive'||next.kind==='turnover'||next.kind==='save'))return;
   if(e.kind!=='pass'&&e.kind!=='clearance'&&e.kind!=='feint'&&e.kind!=='beat'&&e.kind!=='receive')return;
   const s=e.side,they=1-s;
   let against=0;for(const x of ev){if(x.time<next.time)continue;if(x.time>next.time+10)break;if(x.kind==='shot'&&x.side===they)against+=chanceOf(x);}
   if(e.kind==='pass'&&e.firstTime){const p=posAt(e.actor,e.time),ownHalf=!!p&&own(s,p.x);
    out[s].ftLoss++;out[s].ftLossChanceAgainst+=against;if(ownHalf){out[s].ftLossOwn++;out[s].ftLossOwnChanceAgainst+=against;}}
   else{out[s].otherLoss++;out[s].otherLossChanceAgainst+=against;}
  });
 }
 return out;
}
setExtra((runs:any[],teams:any[],t:any)=>{const a=anatomy(runs,teams,t);a.sty=styleExtra(runs,teams);return a;});
