// Styles research, row entry for any revision (imports nothing that main lacks): the what-if row plus `extra.ph`, per
// side, where its chances AGAINST came from. Each opponent shot's chance (read as row.ts reads it) goes to one phase:
//   transition  within 10 s of the opponent winning the ball in open play (receive / turnover / save by them after our
//               possession), split by where we lost it (our own half / theirs) and how (a first-time pass of ours, any
//               other pass, anything else: a tackle, a lost duel, a clearance)
//   restart     within 10 s of a restart they took (corner, free kick, throw, goal kick, kick-off)
//   settled     anything later (their own build-up against our set defence)
// plus our losses in open play by the same split, and our first-time passes. Evidence only; plays nothing of its own.
import {setExtra,anatomy} from '../2026-10-22-whatif/row';
import {L} from '../../src/pitch';
import {shotChance} from '../../../../lib/ballers/chances';
export * from '../2026-10-22-whatif/row';

const STOP=new Set(['out','foul','offside','half','end','goal']);
const z=()=>({ca:0,caTransition:0,caTransOwnFt:0,caTransOwnPass:0,caTransOwnOther:0,caTransTheirs:0,caRestart:0,caSettled:0,
 loss:0,lossOwnFt:0,lossOwnPass:0,lossOwnOther:0,lossTheirs:0,ft:0});
function phases(runs:any[]){
 const out=[z(),z()];
 for(const r of runs){
  const roster:any[]=r.players??[],idx=new Map<string,number>(roster.map((p:any,i:number)=>[p.id,i]));
  const frames:any[]=r.frames??[];
  const frameAt=(time:number)=>{let lo=0,hi=frames.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(frames[m].time<=time+1e-6)lo=m;else hi=m-1;}return lo;};
  const posAt=(id:string,time:number)=>{if(!frames.length||!idx.has(id))return null;const f=frames[frameAt(time)],ri=idx.get(id)!;const j=f.lineup?f.lineup.indexOf(ri):ri;return j>=0?f.players?.[j]??null:null;};
  const own=(s:number,x:number)=>(s===0?x:L-x)<L/2;
  const ev:any[]=r.events??[];
  const chanceOf=(e:any)=>{const q=e.shot?.assessment?.quality,sk=e.technique==='header'?1:e.technique==='volley'?2:e.freeKick?3:undefined;return shotChance({q:typeof q==='number'?Math.round(q*1000)/1000:undefined,sk} as any)??0;};
  // the last ball action of each side, and the phase each side is in when it shoots
  let cur=-1,lastAct:any=null;
  const phase:{kind:'transition'|'restart'|'settled';at:number;how?:string}[]=[{kind:'settled',at:0},{kind:'settled',at:0}];
  for(const e of ev){
   if(e.kind==='pass'&&(e.side===0||e.side===1)&&e.firstTime)out[e.side].ft++;
   if(e.kind==='restart'){if(e.side===0||e.side===1){phase[e.side]={kind:'restart',at:e.time};cur=e.side;}lastAct=null;continue;}
   if(STOP.has(e.kind)){cur=-1;lastAct=null;continue;}
   if(e.side!==0&&e.side!==1)continue;
   if(e.kind==='receive'||e.kind==='turnover'||e.kind==='save'){
    if(cur>=0&&e.side!==cur){
     // we (cur) lost it: how and where
     const s=cur,a=out[s],p=lastAct&&lastAct.side===s?posAt(lastAct.actor,lastAct.time):null,ownHalf=!!p&&own(s,p.x);
     const how=!ownHalf?'theirs':lastAct?.kind==='pass'&&lastAct.firstTime?'ownFt':lastAct?.kind==='pass'?'ownPass':'ownOther';
     a.loss++;if(how==='theirs')a.lossTheirs++;else if(how==='ownFt')a.lossOwnFt++;else if(how==='ownPass')a.lossOwnPass++;else a.lossOwnOther++;
     phase[e.side]={kind:'transition',at:e.time,how};
    }
    cur=e.side;
   }
   if(e.kind==='pass'||e.kind==='clearance'||e.kind==='feint'||e.kind==='beat'||e.kind==='receive'||e.kind==='tackle')lastAct=e;
   if(e.kind==='shot'){
    const they=e.side,us=1-they,c=chanceOf(e),a=out[us],ph=phase[they],fresh=e.time-ph.at<=10;
    a.ca+=c;
    if(fresh&&ph.kind==='transition'){a.caTransition+=c;if(ph.how==='theirs')a.caTransTheirs+=c;else if(ph.how==='ownFt')a.caTransOwnFt+=c;else if(ph.how==='ownPass')a.caTransOwnPass+=c;else a.caTransOwnOther+=c;}
    else if(fresh&&ph.kind==='restart')a.caRestart+=c;
    else a.caSettled+=c;
   }
  }
 }
 return out;
}
setExtra((runs:any[],teams:any[],t:any)=>{const a=anatomy(runs,teams,t);a.ph=phases(runs);return a;});
