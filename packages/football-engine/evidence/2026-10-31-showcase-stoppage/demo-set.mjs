// Bebe's showcase, the injury stoppage (31 Oct 2026): the demo's seed search (block X), one task per seed, in order.
// --x-seeds a,b,... (default ten seeds after the demo script's own four). --x-repeat n (default 1): every seed n times
// as separate tasks (X:<seed>, X:<seed>#2, ...), so they run on separate runners: is the lab self-consistent?
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
export function tasks(){
 const seeds=arg('x-seeds','5203,5311,5477,5521,5639,5741,5857,5903,6011,6133').split(',').map(Number);
 const repeat=Math.max(1,Number(arg('x-repeat','1'))||1);
 return seeds.flatMap((seed,k)=>Array.from({length:repeat},(_,r)=>({id:r?`X:${seed}#${r+1}`:`X:${seed}`,block:'X',kind:'match',seed,order:k*repeat+r})));
}
