// Marking probe (2026-10-14): the support-proto row (support.ts) with the marking probe off (scale 1), free support off.
// mk = the probe's per-match counters (practice-marking-probe PROBE_COUNT). Imports only support.ts and the engine.
import {setMarkingProbe,resetProbeCount,PROBE_COUNT} from '../../src/practice-marking-probe';
import {setFreeSupport} from '../../src/practice-free-support';
import {play as supportPlay} from '../2026-10-14-support-proto/support';
export {extra,armTreatment} from '../2026-10-14-support-proto/support';
setMarkingProbe(false,1);setFreeSupport(false);
export function play(t:{label:string;arm:string;seed:number;rev:string}){resetProbeCount();const r:any=supportPlay(t);r.mk={...PROBE_COUNT};return r;}
