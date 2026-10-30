// Bebe's showcase, Track E (30 Oct 2026): the injury-tuning task list. Block S: F.C. Bebe Power against each guest
// profile (sides.ts), seeds from --s-from (default 7000), --s-seeds per profile (default 18); Bebe at home on even
// seeds, the kickoff alternating, a salt per task. --profiles a,b limits the profiles.
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
export const PROFILE_KEYS=['greucenii','realOffshore','interEst','sangeRece','lemneVerzi','cirque','postmen','pirates'];
export function tasks(){
 const from=+arg('s-from',7000),n=+arg('s-seeds',18),only=arg('profiles',null),keys=only?only.split(','):PROFILE_KEYS,out=[];
 for(let k=0;k<n;k++)for(const profile of keys){
  const seed=from+k;
  out.push({id:`S:${profile}:${seed}`,block:'S',kind:'match',profile,seed,kickoff:(seed>>1)%2,home:seed%2===0,salt:Math.imul(seed,2654435761)>>>0});
 }
 return out;
}
