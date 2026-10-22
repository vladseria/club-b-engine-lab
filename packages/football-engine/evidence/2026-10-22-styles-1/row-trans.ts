// Styles research, row entry for any revision (imports nothing main lacks): the what-if row plus `extra.tr`, per side,
// what happens at and after each ball it loses in open play. Evidence only; it plays nothing of its own.
//   For every loss (the ball changes sides on a receive / turnover / save by them, our last ball action before it):
//   where (their half / our half), and for a loss in their half, at the frame of the loss:
//     behind    our outfielders goal-side of the ball by REST_MARGIN or more (the rest defence)
//     ahead     their outfielders goal-side of the ball (towards our goal) by REST_MARGIN or more (who can run at it)
//     deficit   ahead − behind
//   then: whether a counter-press went (one of ours took the 'counter-press' job within 1 s), who (his defending,
//   strength, pace), whether we won the ball back within 5 s (a receive / turnover / save by us before any stoppage),
//   and the chance they made within 10 s (shot chance read as row.ts reads it).
//   Possessions: their spells (anatomy) and every chance against, so chances per opposing possession can be read.
import {setExtra,anatomy} from '../2026-10-22-whatif/row';
import {L} from '../../src/pitch';
import {REST_MARGIN} from '../../src/practice-rest-defence';
import {shotChance} from '../../../../lib/ballers/chances';
export * from '../2026-10-22-whatif/row';

const STOP=new Set(['out','foul','offside','half','end','goal','restart']);
const WIN=new Set(['receive','turnover','save']);
const z=()=>({lossOwn:0,lossTheirs:0,lossTheirsFt:0,deficitSum:0,deficitHi:0,behindSum:0,aheadSum:0,cp:0,cpWon5:0,won5:0,noCpWon5:0,
 caAfterTheirs:0,caAfterCp:0,caAfterNoCp:0,caAfterWon5:0,caAfterNotWon5:0,caAfterDeficitHi:0,caAfterDeficitLo:0,lossDeficitLo:0,
 goerDef:0,goerStr:0,goerPace:0,goers:0,ca:0});
function transitions(runs:any[]){
 const out=[z(),z()];
 for(const r of runs){
  const roster:any[]=r.players??[],idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const frames:any[]=r.frames??[];
  const frameAt=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
  const depth=(s:number,x:number)=>s===0?x:L-x;
  const ev:any[]=r.events??[],choices:any[]=r.choices??[];
  const chanceOf=(e:any)=>{const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;return shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;};
  for(const e of ev)if(e.kind==='shot'&&(e.side===0||e.side===1))out[1-e.side].ca+=chanceOf(e);
  let cur=-1,lastAct:any=null;
  ev.forEach((e:any,i:number)=>{
   if(STOP.has(e.kind)){cur=-1;lastAct=null;return;}
   if(e.side!==0&&e.side!==1)return;
   if(WIN.has(e.kind)&&cur>=0&&e.side!==cur&&lastAct&&lastAct.side===cur){
    const s=cur,they=1-s,a=out[s],f=frames[frameAt(e.time)];
    const ballX=f?.ball?.x??0,bd=depth(s,ballX);
    if(bd<L/2){a.lossOwn++;}
    else{
     a.lossTheirs++;if(lastAct.kind==='pass'&&lastAct.firstTime)a.lossTheirsFt++;
     // the rest defence at the loss: ours goal-side of the ball v theirs goal-side of it (towards our goal)
     let behind=0,ahead=0;
     (f?.players??[]).forEach((pose:any,j:number)=>{const ri=f.lineup?f.lineup[j]:j,p=roster[ri];if(!p||p.role==='GK')return;
      const d=depth(s,pose.x);if(p.side===s&&d<bd-REST_MARGIN)behind++;else if(p.side===they&&d<bd-REST_MARGIN)ahead++;});
     const deficit=ahead-behind;a.behindSum+=behind;a.aheadSum+=ahead;a.deficitSum+=deficit;const hi=deficit>=1;if(hi)a.deficitHi++;else a.lossDeficitLo++;
     // the counter-press: one of ours took the job within 1 s
     const goerC=choices.find((c:any)=>c.time>=e.time-1e-6&&c.time<=e.time+1&&c.assignment?.purpose==='counter-press'&&roster[c.player]?.side===s);
     const cp=!!goerC;if(cp){a.cp++;const g=roster[goerC.player];a.goers++;a.goerDef+=g?.skills?.defending??0;a.goerStr+=g?.skills?.strength??0;a.goerPace+=g?.skills?.pace??0;}
     // won back within 5 s, before any stoppage
     let won=false;for(let j=i+1;j<ev.length;j++){const x=ev[j];if(x.time>e.time+5)break;if(STOP.has(x.kind))break;if(WIN.has(x.kind)&&x.side===s){won=true;break;}}
     if(won){a.won5++;if(cp)a.cpWon5++;else a.noCpWon5++;}
     let against=0;for(const x of ev){if(x.time<e.time)continue;if(x.time>e.time+10)break;if(x.kind==='shot'&&x.side===they)against+=chanceOf(x);}
     a.caAfterTheirs+=against;if(cp)a.caAfterCp+=against;else a.caAfterNoCp+=against;if(won)a.caAfterWon5+=against;else a.caAfterNotWon5+=against;
     if(hi)a.caAfterDeficitHi+=against;else a.caAfterDeficitLo+=against;
    }
   }
   if(WIN.has(e.kind))cur=e.side;
   if(['pass','clearance','feint','beat','receive','tackle','shot'].includes(e.kind))lastAct=e;
  });
 }
 return out;
}
setExtra((runs:any[],teams:any[],t:any)=>{const a=anatomy(runs,teams,t);a.tr=transitions(runs);return a;});
