// Keeper giveaway study (2026-10-13): bundle-time variants of the engine source (esbuild onLoad), so no engine branch
// changes. A name is a '+'-joined list; `base` is the source as it is.
//   hook  read-only: every carrier choice by a keeper (its aim, kind, target, in hands, at a restart) reaches keeper.ts
//         through globalThis.__kgDecide; no effect on play.
//   fix   the prototype (practice.ts, main b8c183bb, ENGINE_BUILD b0174c30):
//         A. a keeper with the ball in his hands re-reads his prepared throw while he sets it, as a passer on his feet
//            does (practice.ts:1091 excluded inHands), choosing only among throws/rolls (pass, through, loft);
//         B. at the release, a keeper's throw or a goal kick whose freshly planned aim (the receiver has moved since the
//            choice) is more than REAIM m from the aim he read is not played blind: he decides again (at most twice a
//            possession). A real keeper looks again before he lets go.
import {readFileSync} from 'node:fs';

const PR=/football-engine\/src\/practice\.ts$/;
const REAIM=2.5;
const T={
 hook:[[PR,'const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);',
  'const option=rehearsed??chooseFootballOption(restartChoice??available,random,carryPlan,time);if(p.role===\'GK\')(globalThis as any).__kgDecide?.(time,p.id,option,inHands,restart?restart.kind:null);']],
 fix:[
  [PR,'let inHands=false,groundDelivery=false,aerialDelivery=false;','let inHands=false,groundDelivery=false,aerialDelivery=false,reaims=0;'],
  [PR,'aerialDelivery=false;inHands=hands;','aerialDelivery=false;inHands=hands;reaims=0;'],
  [PR,'if(prepared&&!mustRelease&&!inHands&&(closedRelease||time>=nextThink)){','if(prepared&&!mustRelease&&(closedRelease||time>=nextThink)){'],
  [PR,"const alternatives=footballOptions(p,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id));",
   "const alternatives=footballOptions(p,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),lastFrom,time-receivedAt,carryPlan,time,support,observedLine(p),feintMemory.get(p.id)).filter(o=>!inHands||o.kind==='pass'||o.kind==='through'||o.kind==='loft');"],
  [PR,'     const pressure=clamp((5-Math.min(...sidePlayers(other(p.side)).map(q=>dist(q,p))))/5,0,1);',
   `     if((inHands||takingRestart?.kind==='goalKick')&&!aerial&&target&&!o.receivingSpace&&(o.kind==='pass'||o.kind==='through'||o.kind==='loft')&&reaims<2){
      const run=activePassRun(support,p,target,time),fresh=o.kind==='loft'?loftPass(passer,target,run,ball,sidePlayers(other(p.side)),undefined,o.loft?.meetingTime,o.loft?.kind):groundPass(passer,target,o.kind==='through',o.kind==='through'?run:undefined,ball,sidePlayers(other(p.side)),undefined,o.pass?.meetingTime,o.pass?.weight);
      if(dist(fresh.aim,o.aim)>${REAIM}){reaims++;prepared=null;nextThink=time;return false;}
     }
     const pressure=clamp((5-Math.min(...sidePlayers(other(p.side)).map(q=>dist(q,p))))/5,0,1);`],
 ],
};
export const parts=name=>name==='base'?[]:name.split('+').map(k=>{if(!T[k])throw Error(`unknown variant part '${k}'`);return k;});

/** esbuild plugin applying the named variant; every replacement must match exactly once. */
export function variantPlugin(name){
 const edits=parts(name).flatMap(k=>T[k]);
 return {name:'kg-variant',setup(b){
  if(!edits.length)return;
  b.onLoad({filter:PR},a=>{
   let src=readFileSync(a.path,'utf8');
   for(const [file,from,to] of edits){
    if(!file.test(a.path))continue;
    const n=src.split(from).length-1;if(n!==1)throw Error(`variant ${name}: '${from.slice(0,60)}' matched ${n} times in ${a.path}`);
    src=src.replace(from,()=>to);
   }
   return {contents:src,loader:'ts'};
  });
 }};
}
