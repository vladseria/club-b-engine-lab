// Starting energy (2026-11-02, branch ballers-energy-start, measurement only): the row entry. The half-time study's row
// (../2026-10-21-half-time/row.ts: parity.ts's fingerprints, the what-if match anatomy and the per-half read) unchanged,
// plus one more kind of side for parity.ts (setSides): {src:'tired', code, style, formation, energy:E}, the neutral five
// exactly as parity.ts builds it ({src:'neutral'}) with every player's input `energy` set to E. At E = 100 the side is
// the neutral side, value for value (block I of set.mjs checks the fingerprints on the lab). It reads the record and
// changes nothing in the engine.
import '../2026-10-21-half-time/row';
import {setSides,sideOf} from '../2026-10-21-engine-as-data/parity';
export * from '../2026-10-21-half-time/row';

/** The dented side: parity.ts's neutral five for the same code, style and formation, every player starting at `energy`. */
export function tiredSide(spec:any):any{
 const E=spec.energy;
 if(!(typeof E==='number'&&Number.isFinite(E)&&E>=0&&E<=100))throw Error(`tired side: energy ${E} is not 0-100`);
 const {energy:_e,...rest}=spec;void _e;
 const b=sideOf({...rest,src:'neutral'});
 for(const p of b.players)p.energy=E;
 return b;
}
// Only 'tired' is handled here; every other source falls through to parity.ts as before (the what-if squads, src
// 'squad', are not used by this task list).
setSides((spec:any)=>spec.src==='tired'?tiredSide(spec):null);
