// Bebe's showcase, the two-tier guest sides and the leaning pick (1 Nov 2026): the task list for row2.ts (nines-v2.json).
//   block C (calibration): every nine x every guest side x each variant in --c-variants (default A,B) x --c-seeds seeds
//            from --c-from (defaults 2 from 12001)
//   block V (verification): every nine x every guest side (variant A, the catalogue's) x --v-seeds seeds from --v-from
//            (defaults 4 from 13001)
// --nines a,b / --guests a,b limit either list.
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
export const NINES=['excel','rutina','talent','burcea','ghidus','lansator','present'].flatMap(c=>[`${c}-a`,`${c}-b`]);
export const GUESTS=['greucenii','real-offshore','inter-est','autospa-vampires','lemne-verzi','cirque-du-sorin','pirates'];
export function tasks(){
 const nines=arg('nines',null)?.split(',')??NINES,guests=arg('guests',null)?.split(',')??GUESTS,out=[];
 const cFrom=+arg('c-from',12001),cN=+arg('c-seeds',2),variants=arg('c-variants','A,B').split(',');
 for(let k=0;k<cN;k++)for(const variant of variants)for(const nine of nines)for(const guest of guests){
  const seed=cFrom+k;out.push({id:`C:${variant}:${nine}:${guest}:${seed}`,block:'C',kind:'match',nine,guest,variant,seed});
 }
 const vFrom=+arg('v-from',13001),vN=+arg('v-seeds',4);
 for(let k=0;k<vN;k++)for(const nine of nines)for(const guest of guests){
  const seed=vFrom+k;out.push({id:`V:${nine}:${guest}:${seed}`,block:'V',kind:'match',nine,guest,variant:'A',seed});
 }
 return out;
}
