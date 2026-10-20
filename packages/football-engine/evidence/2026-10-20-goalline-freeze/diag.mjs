// Goal-line freeze (2026-10-20): one match on two engine revisions (2 matches; the lab when the laptop's traces are spent).
// Finds the longest hold (one owner, the ball within 1.5 m of where the hold began), the first frame where the two
// revisions differ, and writes the hold's opening frame, the owner's choices and the events around it.
//   node diag.mjs --revs base=<rev>,cand=working A.ba22vsh121 42      -> results/diag.jsonl (one row per revision)
import {appendFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs,parseRevs} from '../_ci/revs.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2),i=argv.indexOf('--revs'),revs=parseRevs(argv[i+1]),[arm,seedS]=argv.filter((a,j)=>j!==i&&j!==i+1);
if(!process.env.GITHUB_ACTIONS&&!process.env.SHARD_TOTAL&&Number(process.env.MATCHES)<Object.keys(revs).length)throw Error('declare MATCHES');
if(process.env.SHARD_INDEX&&process.env.SHARD_INDEX!=='0')process.exit(0);// one shard plays it
const outDir=path.join(here,'results');mkdirSync(outDir,{recursive:true});
const bundles=await bundleRevs({entry:path.join(here,'trace.ts'),revs,outDir,tag:'diag'});
const runs={};
for(const [name,b] of Object.entries(bundles)){const {raw}=await import(pathToFileURL(b).href);runs[name]=raw(arm,+seedS).run;}
const names=Object.keys(runs),F=names.map(n=>runs[n].result.frames);
let diverge=null;for(let k=0;k<Math.min(...F.map(f=>f.length));k++)if(F.some(f=>JSON.stringify(f[k])!==JSON.stringify(F[0][k]))){diverge=F[0][k].time;break;}
for(const n of names){
 const R=runs[n].result,fr=R.frames;let best={seconds:0},s=null;
 for(const f of fr){const o=f.control?.owner??f.ball.owner??null;
  if(!o||f.restart||s&&(o!==s.o||Math.hypot(f.ball.x-s.x,f.ball.y-s.y)>1.5)){s=o&&!f.restart?{o,t:f.time,x:f.ball.x,y:f.ball.y}:null;continue;}
  if(!s){s={o,t:f.time,x:f.ball.x,y:f.ball.y};continue;}
  if(f.time-s.t>best.seconds)best={seconds:f.time-s.t,owner:s.o,from:s.t,to:f.time,x:s.x,y:s.y};}
 const at=t=>fr.find(f=>f.time>=t),oi=R.players.findIndex(p=>p.id===best.owner);
 appendFileSync(path.join(outDir,'diag.jsonl'),JSON.stringify({kind:'diag',rev:n,arm,seed:+seedS,build:runs[n].engineBuild.slice(0,8),plat:`${process.platform}-${process.arch}`,score:R.score,diverge,hold:best,
  roster:R.players.map(p=>({id:p.id,side:p.side,role:p.role})),frames:best.seconds?[at(best.from+1),at(best.from+10),at(best.from+60)]:[],
  choices:best.seconds?R.choices.filter(c=>c.player===oi&&c.time>=best.from-5&&c.time<=best.from+30):[],
  events:best.seconds?R.events.filter(e=>e.time>=best.from-20&&e.time<=best.from+5):[]})+'\n');
 console.log(n,R.score,'hold',JSON.stringify(best),'diverge',diverge);
}
