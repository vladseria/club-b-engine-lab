// Squad fit (2026-10-19), eyes-on: one arm's match through the official computeMatch (lib/ballers/compute.ts), returned
// as its compact replay (header, frames, events, score) so render.mjs can draw it on the laptop without playing a match.
// Same inputs as sf.ts (inputOf); run on the public lab with run.mjs --watch.
import {computeMatch} from '../../../../lib/ballers/compute';
import {inputOf,parseArm} from './sf';
export const armTreatment=parseArm;
export function watch(t:{label:string;arm:string;seed:number;rev:string}){
 const inp:any=inputOf(t.arm,t.seed),r=computeMatch(inp),c:any=r.compact;
 return {label:t.label,kind:'watch',arm:t.arm,seed:t.seed,rev:t.rev,ours:t.seed%2,build:r.engineBuild.slice(0,8),plat:`${process.platform}-${process.arch}-node${process.versions.node}`,
  score:c.score,header:c.header,frames:c.chunks.flatMap((x:any)=>x.f),events:c.chunks.flatMap((x:any)=>x.e),dropped:r.dropped};
}
