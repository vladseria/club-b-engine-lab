// Beat-direct probes (2026-10-14, scratch, branch ballers-beat-direct): the arms.
//   <opt>-<opp>   test side = Direct 1-2-1 + option, the other side = opponent; the neutral five on both sides
//                 (../2026-10-10-cloud-measure/mirror.ts inputOf), test side = seed % 2, kick-off = (seed >> 1) % 2.
//   opt  ref (nothing) | p1 (Hold them in front: Tactics.holdFront) | c5 (Tight man-marking: Tactics.marking 'tight')
//        | p3 (Leave a man up: Tactics.leaveUp) | p1b (P1 retry: holdFront + holdFrontCue, the hold also weighed in the
//        job that closes a man as the pass to him is prepared)
//   opp  di (Direct 1-2-1) | sh (Short 1-2-1) | dp (Direct 1-2-1, striker Pivot) | dc2 (Direct 1-2-1, Bodies forward 2)
// ref-<opp> builds exactly the inputs of mirror di121v<opp's style+formation> (ref-sh = di121vsh121), and the option
// only touches the engine Tactics after engineTeam (the official path never sends these: compute.ts sends 'balanced').
import {inputOf as mirrorInput} from '../2026-10-10-cloud-measure/mirror';
const OPPS:Record<string,{arm:string;set?:Record<string,string|number>}>={di:{arm:'di121'},sh:{arm:'sh121'},dp:{arm:'di121',set:{striker:'pivot'}},dc2:{arm:'di121',set:{commit:2}}};
const OPTS=new Set(['ref','p1','p1b','c5','p3']);
export function armTreatment(arm:string):{opt:string;opp:string}{
 const m=/^([a-z0-9]+)-([a-z0-9]+)$/.exec(arm);
 if(!m||!OPTS.has(m[1])||!OPPS[m[2]])throw Error('unknown arm '+arm);
 return {opt:m[1],opp:m[2]};
}
export function inputOf(arm:string,seed:number){
 const {opp}=armTreatment(arm),o=OPPS[opp],inp:any=mirrorInput(`di121v${o.arm}`,seed),treated=seed%2;
 if(o.set){const s=inp.sides[1-treated];for(const [k,v] of Object.entries(o.set)){if(!(k in s.approach))throw Error('unknown setting '+k);}s.approach={...s.approach,...o.set};}
 return inp;
}
export function tweak(arm:string,teams:any[],treated:number){
 const {opt}=armTreatment(arm),t=teams[treated].tactics;
 if(opt==='p1')t.holdFront=true;
 if(opt==='p1b'){t.holdFront=true;t.holdFrontCue=true;}
 if(opt==='p3')t.leaveUp=true;
 if(opt==='c5')t.marking='tight';
}
