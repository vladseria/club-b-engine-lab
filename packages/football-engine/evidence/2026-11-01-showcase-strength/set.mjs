// Bebe's showcase, guest-side strength (1 Nov 2026): the task list. Every task is one showcase match, F.C. Bebe Power
// (a sample nine, nines.json) at home against one ready guest side, as the freezer frames it.
//   block M (main grid): every nine x every guest side x --m-seeds seeds from --m-from (defaults 5 from 11001)
//   block G (developed): every nine with a season of growth (nines.json `grown`) x every guest side x --g-seeds seeds
//            (default 2), the SAME seeds as block M's first ones, so each G task has its M twin
// --nines a,b / --guests a,b limit either list.
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
export const NINES=['excel','rutina','talent','burcea','ghidus','lansator','present'].flatMap(c=>[`${c}-a`,`${c}-b`]);
export const GUESTS=['greucenii','real-offshore','inter-est','autospa-vampires','lemne-verzi','cirque-du-sorin','pirates'];
export function tasks(){
 const from=+arg('m-from',11001),m=+arg('m-seeds',5),g=+arg('g-seeds',2);
 const nines=arg('nines',null)?.split(',')??NINES,guests=arg('guests',null)?.split(',')??GUESTS,out=[];
 for(const [block,n,grown] of [['M',m,false],['G',g,true]])
  for(let k=0;k<n;k++)for(const nine of nines)for(const guest of guests){
   const seed=from+k;
   out.push({id:`${block}:${nine}:${guest}:${seed}`,block,kind:'match',nine,guest,seed,grown});
  }
 return out;
}
