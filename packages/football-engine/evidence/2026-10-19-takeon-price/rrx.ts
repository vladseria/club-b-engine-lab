// Take-on price: the keeper-fix round robin row (../2026-10-19-keeper-fix/rr.ts, unchanged: the 8x8 style mirrors with
// the situation checks) with the flag set from the rev name (flag.ts).
import {play as rPlay,armTreatment} from '../2026-10-19-keeper-fix/rr';
import {setFlag} from './flag';
export {armTreatment};
export function inputOf(arm:string){return armTreatment(arm);}
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const on=setFlag(t.rev);let row:any;
 try{row=rPlay(t);}finally{setFlag('off');}
 row.flag=on;row.rev=t.rev;row.label=t.label;return row;
}
