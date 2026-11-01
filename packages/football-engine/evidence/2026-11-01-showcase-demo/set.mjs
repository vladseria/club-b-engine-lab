// Bebe's showcase demo (1 Nov 2026): the seed search's task list (block D), one task per seed, in order.
// --d-from n --d-seeds k: the seeds n, n+1, ... n+k-1 (defaults 7001 and 100); --d-list a,b,...: these seeds instead.
// --d-keep a,b,...: keep the whole payload for these seeds (the final replay); every other row keeps the summary only.
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:d;};
export function tasks(){
 const list=arg('d-list',null),from=Number(arg('d-from','7001')),n=Number(arg('d-seeds','100'));
 const seeds=list?list.split(',').map(Number):Array.from({length:n},(_,k)=>from+k);
 const keep=new Set(arg('d-keep','').split(',').filter(Boolean).map(Number));
 return seeds.map((seed,order)=>({id:`D:${seed}`,block:'D',kind:'match',seed,order,...(keep.has(seed)?{keep:true}:{})}));
}
