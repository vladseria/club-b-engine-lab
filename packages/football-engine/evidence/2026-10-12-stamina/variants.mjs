// Stamina study (2026-10-12): scratch variants, applied to the engine source at bundle time (esbuild onLoad), so no
// engine branch changes. Each diagnosis variant puts stamina 6 into ONE channel through which stamina enters the
// engine (packages/football-engine/src/practice-match.ts on main 32d38e3b), everything else untouched:
//   drain    staminaDrain: the whole energy drain's stamina multiplier            (fatigueCost)
//   csE      critical speed in the energy drain (running above CS costs energy)    (fatigueCost)
//   csR      critical speed in the sprint reserve (drain above CS, refill below)  (reserveBalance)
//   size     reserve size D'                                                       (reserveBalance)
//   hl       reserve refill half-life                                              (reserveBalance)
// Combined: energy = drain+csE, reserve = csR+size+hl. `hook` adds the read-only legs hook stamina.ts reads (no
// effect on play). A bundle name is a '+'-joined list, e.g. `hook+reserve`; `base` is the source as it is.
import {readFileSync} from 'node:fs';

const PM=/football-engine\/src\/practice-match\.ts$/,PR=/football-engine\/src\/practice\.ts$/;
const T={
 drain:[[PM,'staminaScale=staminaDrain(stamina);','staminaScale=staminaDrain(6);']],
 csE:[[PM,'INTENSITY_COST*Math.max(0,movement-criticalSpeed(stamina,topPace))','INTENSITY_COST*Math.max(0,movement-criticalSpeed(6,topPace))']],
 csR:[[PM,' const cs=criticalSpeed(stamina,topPace),v=Math.max(0,speed)',' const cs=criticalSpeed(6,topPace),v=Math.max(0,speed)']],
 size:[[PM,'reserve-(v-cs)*dt/reserveSize(stamina)','reserve-(v-cs)*dt/reserveSize(6)']],
 hl:[[PM,'Math.LN2/reserveHalfLife(stamina)*dt','Math.LN2/reserveHalfLife(6)*dt']],
 hook:[[PR,'p.pace=p.basePace*energyTop(p.energy,p.role===\'GK\')*fit.top;p.acceleration=rested*fit.acceleration;',
  'p.pace=p.basePace*energyTop(p.energy,p.role===\'GK\')*fit.top;p.acceleration=rested*fit.acceleration;(globalThis as any).__staminaHook?.(time,p,fit,reserveOf(p));']],
};
const COMBO={base:[],energy:['drain','csE'],reserve:['csR','size','hl']};
export const parts=name=>name.split('+').flatMap(k=>COMBO[k]??(T[k]?[k]:(()=>{throw Error(`unknown variant part '${k}'`);})()));

/** esbuild plugin applying the named variant; every replacement must match exactly once. */
export function variantPlugin(name){
 const edits=parts(name).flatMap(k=>T[k]);
 return {name:'stamina-variant',setup(b){
  if(!edits.length)return;
  b.onLoad({filter:/football-engine\/src\/practice(-match)?\.ts$/},a=>{
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
