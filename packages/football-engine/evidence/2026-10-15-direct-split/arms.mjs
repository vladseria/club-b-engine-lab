// Direct split (2026-10-15): the arm list (mirror.ts sp-<A>-<B>), oriented so every cell pairs seed for seed with the
// plain preset-v-preset cell: the team earlier in the R1 round robin's order (di, sh, co, ba) is the treated side A.
//   node arms.mjs variants|baselines|skeleton|all   -> comma-separated arms
export const ORDER=['di','sh','co','ba'];
export const VARIANTS={di:['di.pmix','di.wstd','di.c3','di.smix','di.c3.smix'],ba:['ba.c4','ba.srun','ba.c4.srun'],sh:['sh.c4','sh.srun','sh.c4.srun'],co:['co.c4','co.srun','co.c4.srun']};
const parent=v=>v.split('.')[0];
// the cell for team v (a variant or a plain preset) against plain opponent o
export function cell(v,o){const p=parent(v);return ORDER.indexOf(o)<ORDER.indexOf(p)?`sp-${o}-${v}`:`sp-${v}-${o}`;}
export const variants=()=>Object.values(VARIANTS).flat().flatMap(v=>ORDER.map(o=>cell(v,o)));
export const baselines=()=>{const u=[];for(let i=0;i<4;i++)for(let j=i;j<4;j++)u.push(`sp-${ORDER[i]}-${ORDER[j]}`);return u;};
// everyone on Direct's skeleton (bodies forward 4 + striker In behind): the three new cross pairs
export const skeleton=()=>['sp-sh.c4.srun-co.c4.srun','sp-sh.c4.srun-ba.c4.srun','sp-co.c4.srun-ba.c4.srun'];
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())){
 const k=process.argv[2]??'all';
 const out=k==='variants'?variants():k==='baselines'?baselines():k==='skeleton'?skeleton():[...baselines(),...variants(),...skeleton()];
 console.log(out.join(','));
}
