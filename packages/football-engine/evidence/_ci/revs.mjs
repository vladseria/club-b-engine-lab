// Bundle one harness entry once per engine revision, so baseline and
// candidate play side by side in the same job (cloud rows never pool with
// laptop rows, so a cloud check always carries its own baseline).
// The same mechanism as 2026-10-09-scenarios/run.mjs, shared for new harnesses:
// every import that resolves into this tree's lib/ or
// packages/football-engine/src/ is redirected to the revision's copy
// (`git archive <rev> lib packages/football-engine/src`), so compute, presets,
// the chances table and the engine are the revision's own; the harness code
// itself is this tree's.
//
//   const bundles=await bundleRevs({entry,revs:parseRevs('base=<sha>,cand=<sha>'),outDir});
//   // -> {base:'/abs/.bundle.base.<hash>.mjs', cand:...}
// A rev is `working` (this tree), a git rev (branch, tag or sha; the clone
// must contain it), or `dir:<path>` (another checkout).
import {build} from 'esbuild';
import {existsSync,mkdirSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
export const repo=path.resolve(here,'../../../..');
const roots=[path.join(repo,'lib'),path.join(repo,'packages/football-engine/src')];

/** 'base=<rev>,cand=<rev>' -> {base:'<rev>',cand:'<rev>'} */
export const parseRevs=s=>Object.fromEntries(s.split(',').map(r=>{const [n,...v]=r.split('=');if(!/^[a-z0-9_-]+$/i.test(n)||!v.length)throw Error(`bad rev '${r}' (want name=<rev>)`);return [n,v.join('=')];}));

/** The full sha of a git rev, or null for `working` / `dir:`. */
export const revSha=rev=>rev==='working'||rev.startsWith('dir:')?null:execSync(`git rev-parse --verify ${rev}^{commit}`,{cwd:repo,encoding:'utf8'}).trim();

function revRoot(rev,outDir){
 if(rev==='working')return repo;
 if(rev.startsWith('dir:'))return path.resolve(rev.slice(4));
 const sha=revSha(rev),dir=path.join(outDir,`.rev-${sha.slice(0,12)}`);
 if(!existsSync(path.join(dir,'packages/football-engine/src/build-info.ts'))||!existsSync(path.join(dir,'lib/ballers/compute.ts'))){
  rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
  execSync(`git archive ${sha} lib packages/football-engine/src | tar -x -C "${dir}"`,{cwd:repo});
 }
 return dir;
}
const at=root=>({name:'rev-at',setup(b){
 if(path.resolve(root)===repo)return;
 b.onResolve({filter:/^\./},a=>{
  if(!a.resolveDir||a.resolveDir.startsWith(root+path.sep))return;
  const abs=path.resolve(a.resolveDir,a.path);
  if(!roots.some(r=>abs===r||abs.startsWith(r+path.sep)))return;
  let target=path.join(root,path.relative(repo,abs));
  for(const ext of ['','.ts','.tsx','.js','.json'])if(existsSync(target+ext)&&!target.endsWith(path.sep)){target+=ext;break;}
  if(!existsSync(target))throw Error(`rev ${root}: ${path.relative(repo,abs)} does not exist there`);
  return {path:target};
 });
}});

/** One esm bundle of `entry` per revision, written under outDir (git-ignore `.bundle.*` and `.rev-*` there). */
export async function bundleRevs({entry,revs,outDir}){
 mkdirSync(outDir,{recursive:true});
 const bundles={};
 for(const [name,rev] of Object.entries(revs)){
  bundles[name]=path.join(outDir,`.bundle.${name}.${createHash('md5').update(rev).digest('hex').slice(0,8)}.mjs`);
  await build({entryPoints:[entry],bundle:true,format:'esm',platform:'node',target:'node22',outfile:bundles[name],logLevel:'warning',plugins:[at(revRoot(rev,outDir))]});
 }
 return bundles;
}
