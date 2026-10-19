// Caught kick build (2026-10-19): the engine audits' row (../2026-10-19-engine-audits/audit.ts, unchanged) with the
// caught-kick flag set by the revision NAME: `off` plays with practice-possession CAUGHT_KICK.byBall false, `on` with
// it true (one run per rev: erun.mjs takes a single rev). Any other name must be a revision without the flag.
import * as audit from '../2026-10-19-engine-audits/audit';
import * as poss from '../../src/practice-possession';
export const init=audit.init,inputOf=audit.inputOf,armTreatment=audit.armTreatment,plain=audit.plain;
export function setFlag(rev:string){
 const flag=(poss as any).CAUGHT_KICK;
 if(rev==='off'||rev==='on'||rev==='reach'){if(!flag)throw Error('this revision has no CAUGHT_KICK flag');flag.byBall=rev!=='off';flag.reachOnly=rev==='reach';}
 else if(flag)throw Error(`rev ${rev}: name a flagged build off, on or reach`);
 return flag;
}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const flag=setFlag(t.rev);
 try{return audit.play(t);}finally{if(flag){flag.byBall=true;flag.reachOnly=false;}}
}
