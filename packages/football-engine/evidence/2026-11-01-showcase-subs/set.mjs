// Bebe's showcase, the coaches' substitutions (1 Nov 2026): the paired task list for row.ts. Block P: each (nine, guest
// side, seed) twice, once with the old freezer's orders and once with the new rule's (`orders` old / new).
//   --p-from n --p-seeds k   the seeds every nine x every guest side plays (defaults 13001 and 1: 98 pairs)
//   --x-from n --x-seeds k --x-guests a,b   extra seeds for these guest sides only (defaults 13002, 1 and the three
//                            sides away from the middle: the stronger Greucenii and Autospa Vampires, the weaker Inter Est;
//                            42 pairs). 140 pairs, 280 matches in all.
// --nines a,b / --guests a,b limit either list.
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
export const NINES=['excel','rutina','talent','burcea','ghidus','lansator','present'].flatMap(c=>[`${c}-a`,`${c}-b`]);
export const GUESTS=['greucenii','real-offshore','inter-est','autospa-vampires','lemne-verzi','cirque-du-sorin','pirates'];
export function tasks(){
 const nines=arg('nines',null)?.split(',')??NINES,guests=arg('guests',null)?.split(',')??GUESTS,out=[];
 const add=(seed,guest,nine)=>{for(const orders of ['old','new'])out.push({id:`P:${orders}:${nine}:${guest}:${seed}`,block:'P',kind:'match',nine,guest,seed,orders});};
 const pFrom=+arg('p-from',13001),pN=+arg('p-seeds',1);
 for(let k=0;k<pN;k++)for(const guest of guests)for(const nine of nines)add(pFrom+k,guest,nine);
 const xFrom=+arg('x-from',13002),xN=+arg('x-seeds',1),xGuests=arg('x-guests','greucenii,autospa-vampires,inter-est').split(',').filter(g=>guests.includes(g));
 for(let k=0;k<xN;k++)for(const guest of xGuests)for(const nine of nines)add(xFrom+k,guest,nine);
 return out;
}
