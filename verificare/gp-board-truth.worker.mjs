// Worker for verificare/gp-board-truth.test.ts: plays one real engine match
// (or one free-kick training go) and hands back a slim record. Runs the engine
// SOURCE (packages/football-engine/src), never a build: TypeScript is
// transpiled on load with esbuild (Node's own type stripping refuses the
// engine's parameter properties) and the engine's `.js` specifiers resolve to
// their `.ts` files. The test checks once that a worker plays the very same
// match as the test process itself.
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parentPort} from 'node:worker_threads';
import {transformSync} from 'esbuild';

registerHooks({
 resolve(spec,ctx,next){
  if(spec.endsWith('.js')&&ctx.parentURL?.endsWith('.ts')){
   const ts=new URL(spec,ctx.parentURL).href.replace(/\.js$/,'.ts');
   if(existsSync(fileURLToPath(ts)))return next(ts,ctx);
  }
  return next(spec,ctx);
 },
 load(url,ctx,next){
  if(!url.endsWith('.ts'))return next(url,ctx);
  const {code}=transformSync(readFileSync(fileURLToPath(url),'utf8'),{loader:'ts',format:'esm',target:'es2022',sourcefile:fileURLToPath(url)});
  return {format:'module',source:code,shortCircuit:true};
 },
});
// GP_TRUTH_ENGINE=<dir> plays another engine source instead (e.g. a `git archive` of main's
// packages/football-engine/src, to compare a claim across builds); the test's own same-match check
// still uses this checkout's source, so run such a comparison filtered with -t and GP_TRUTH_NOFILL=1.
const engine=await import(process.env.GP_TRUTH_ENGINE?new URL('index.ts',`file://${process.env.GP_TRUTH_ENGINE.replace(/\/?$/,'/')}`).href:new URL('../packages/football-engine/src/index.ts',import.meta.url).href);

/** Frames 0.2 s apart (plus every dead-ball change), as the stored replay keeps them. */
function slim(r){
 const index=new Map(r.players.map((p,i)=>[p.id,i]));
 const idx=id=>id==null?-1:index.get(id)??-1;
 const frames=[];let last=-Infinity,dead=false;
 for(const [n,f] of r.frames.entries()){
  if(!(n===0||f.time>=last+.2-1e-9||f.restart!==dead||n===r.frames.length-1))continue;
  last=f.time;dead=f.restart;
  frames.push({t:Math.round(f.time*1000),ps:f.side,b:[f.ball.x,f.ball.y,f.ball.z],o:idx(f.control?.owner??f.ball.owner),r:f.restart?1:0,
   p:f.players.map(p=>[p.x,p.y,p.duty])});
 }
 const events=r.events.map(e=>({t:Math.round(e.time*1000),k:e.kind,a:idx(e.actor),g:idx(e.target),s:e.side,rk:e.restartKind,
  aim:e.pass?.aim?[e.pass.aim.x,e.pass.aim.y]:e.aerial?.aim?[e.aerial.aim.x,e.aerial.aim.y]:e.shot?.aim?[e.shot.aim.x,e.shot.aim.y]:null,
  loft:!!e.aerial}));
 // each player's football job as the engine assigned it, from each of his decisions: [time ms, player, purpose | null]
 const jobs=r.choices.map(c=>[Math.round(c.time*1000),c.player,c.assignment?.purpose??null]);
 return {players:r.players.map(p=>({id:p.id,side:p.side,role:p.role,lane:p.lane})),frames,events,jobs,score:r.score};
}

parentPort.on('message',({id,job})=>{
 try{
  const common={fixture:job.fixture,durationSeconds:job.duration,policy:'coordinated',substitutions:'none',record:true};
  let r;
  if(job.kind==='freeKick'){
   const players=engine.practicePlayers(job.fixture);
   const setup=engine.createRestartSetup('freeKick',players,{ball:job.ball});
   r=engine.runTraining({...common,setup}).result;
  }else r=engine.runMatch(common).result;
  parentPort.postMessage({id,out:{build:engine.ENGINE_BUILD,...slim(r)}});
 }catch(e){parentPort.postMessage({id,error:String(e?.stack??e)});}
});
