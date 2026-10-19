// Caught kick build (2026-10-19): the bodies-probe round robin row (../2026-10-19-bodies-probe/rr.ts, unchanged: the
// keeper-fix row with the situation checks; its OPPONENT_BODIES switch stays off because this tree has no such flag)
// with the caught-kick flag set by the revision NAME: `off` = CAUGHT_KICK.byBall false, `on` = true.
import * as rr from '../2026-10-19-bodies-probe/rr';
import {setFlag} from './eb';
export const armTreatment=rr.armTreatment;
export function play(t:{label:string;arm:string;seed:number;rev:string}){
 const flag=setFlag(t.rev);
 try{return rr.play(t);}finally{if(flag)flag.byBall=true;}
}
