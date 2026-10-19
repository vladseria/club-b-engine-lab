// Take-on price: the engine-audits row (../2026-10-19-engine-audits/audit.ts, unchanged: skill prices E) with the flag
// set from the rev name (flag.ts).
import {play as aPlay,init,inputOf,plain,armTreatment} from '../2026-10-19-engine-audits/audit';
import {setFlag} from './flag';
export {init,inputOf,plain,armTreatment};
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const on=setFlag(t.rev);let row:any;
 try{row=aPlay(t);}finally{setFlag('off');}
 row.flag=on;row.rev=t.rev;row.label=t.label;return row;
}
