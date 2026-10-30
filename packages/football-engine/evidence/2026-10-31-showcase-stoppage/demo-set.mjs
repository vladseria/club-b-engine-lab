// Bebe's showcase, the injury stoppage (31 Oct 2026): the demo's seed search (block X), one task per seed, in order.
// --x-seeds a,b,... (default ten seeds after the demo script's own four).
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
export function tasks(){
 const seeds=arg('x-seeds','5203,5311,5477,5521,5639,5741,5857,5903,6011,6133').split(',').map(Number);
 return seeds.map((seed,order)=>({id:`X:${seed}`,block:'X',kind:'match',seed,order}));
}
