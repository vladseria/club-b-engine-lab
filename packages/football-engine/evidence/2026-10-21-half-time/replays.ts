// Half-time phase 2, the watching review's matches: six 900 s matches through the app's own path (lib/ballers/compute.ts
// computeMatch, and lib/ballers/simulation.ts submission for the payload), on the public lab. Each row holds the compact
// replay (header + chunks, gzipped JSON in base64) for the strips (render2.ts) and the browser screenshots, plus what
// the payload would send ballers_submit (chunk live t0, half, interval, played).
//   lab: node packages/football-engine/evidence/2026-10-21-half-time/replays-run.mjs   (via _ci/cloud.mjs, 1 shard)
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {init,sideOf} from '../2026-10-21-engine-as-data/parity';
import {tasks as parity512} from '../2026-10-21-engine-as-data/set.mjs';
import {computeMatch} from '../../../../lib/ballers/compute';
import {submission} from '../../../../lib/ballers/simulation';

const base=path.resolve('packages/football-engine/evidence');
const load=(dir:string)=>{
 const sums=JSON.parse(readFileSync(path.join(dir,'CHECKSUMS.json'),'utf8')).files,out:Record<string,unknown>={};
 for(const f of Object.keys(sums)){const txt=readFileSync(path.join(dir,f),'utf8');
  if(createHash('md5').update(txt).digest('hex')!==sums[f].md5)throw Error(f+': checksum');out[f.split('.')[0]]=JSON.parse(txt);}
 return out;
};

/** T1, T2 (FCD's at-half-time order without its notBefore, so the change comes at the interval) and four real Global
 * pairings from block D (plans, substitution orders), seeds as the parity set has them. */
export function picks(){
 const all=parity512() as any[];
 return [all.find(t=>t.id.startsWith('T1')),all.find(t=>t.id.startsWith('T2')),...all.filter(t=>t.block==='D').filter((_,i)=>i%9===0).slice(0,4)];
}
export function runReplays(){
 init({scen:load(path.join(base,'2026-10-09-scenarios/sides')),g7:load(path.join(base,'2026-10-21-engine-as-data/global-r7'))});
 return picks().map((t:any)=>{
  const sides=t.sides.map((s:any)=>sideOf(s,null));
  if(t.id.startsWith('T2'))sides[0].substitutions=(sides[0].substitutions??[]).map((o:any)=>o.trigger?.kind==='half'?(({notBefore:_n,...rest})=>rest)(o):o);
  const input:any={v:1,match:`ht-${t.id}`,seed:t.seed,kickoff:t.kickoff,duration:900,sides};
  const t0=Date.now(),c=computeMatch(input),ms=Date.now()-t0,pay=submission(c,input) as any;
  const half=c.compact.chunks.flatMap(ch=>ch.e).find(e=>e.k==='half');
  return {id:t.id,ms,score:c.compact.score,engineBuild:c.engineBuild,half:half?half.t:null,header:{duration:c.compact.header.duration,fullTime:c.compact.header.fullTime,interval:c.compact.header.interval,chunks:c.compact.header.chunks},
   payload:{duration:pay.duration,played:pay.played,half:pay.half,interval:pay.interval,chunks:pay.chunks.map((x:any)=>[x.i,x.t0,x.t1])},
   replay:gzipSync(Buffer.from(JSON.stringify({header:{...c.compact.header,engineBuild:c.engineBuild},chunks:c.compact.chunks,score:c.compact.score,stats:c.compact.stats}))).toString('base64')};
 });
}
