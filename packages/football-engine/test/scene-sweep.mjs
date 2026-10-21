// Seed sweep of the constructed scenes (lane C, 2026-10-21; the owner's rule: a start that only works on one seed is a
// seed pin). For every scene: on how many of seeds 1-20 its moment happens, and whether the property held each time.
//   node packages/football-engine/test/scene-sweep.mjs            training scenes only (10 s runs, no match)
//   --build   transpile src to dist first (the public lab has esbuild, not tsc)
//   --rows    append rows to evidence/2026-10-21-lane-c/results/sweep.jsonl (the path the lab collects)
// The substitution run is a match: scene-sweep-matches.mjs, on the lab only.
import {mkdirSync,appendFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),pkg=path.resolve(here,'..'),argv=process.argv.slice(2);
if(argv.includes('--build')){
 const {build}=await import('esbuild');
 await build({entryPoints:readdirSync(path.join(pkg,'src')).filter(n=>n.endsWith('.ts')).map(n=>path.join(pkg,'src',n)),outdir:path.join(pkg,'dist'),format:'esm',platform:'node',target:'node22',logLevel:'warning'});
}
const H=await import('./constructed-scenes.mjs');

const {defaultPlans}=await import('../dist/practice-playbook.js');
const {L,GH}=await import('../dist/pitch.js');
const seeds=H.SWEEP,rows=[];
const record=(scene,moment,hits,n,propertyFailures,note='')=>{rows.push({scene,moment,hits,n,propertyFailures,note});console.log(`${scene.padEnd(34)} ${moment.padEnd(52)} ${String(hits).padStart(2)}/${n}${propertyFailures?`  PROPERTY FAILED ${propertyFailures}`:''}${note?`  ${note}`:''}`);};
const sweep=(scene,moment,run)=>{let hits=0,n=0,bad=0;for(const seed of seeds){const o=run(seed);if(o===undefined)continue;n++;if(o.hit){hits++;if(o.ok===false)bad++;}}record(scene,moment,hits,n,bad);};

// shots
const shooter=setup=>seed=>{const r=H.play(setup,{seed}),i=r.players.findIndex(p=>p.side===0&&p.number===5),shot=r.events.find(e=>e.kind==='shot');
 const hit=!!shot&&shot.actor===r.players[i].id&&!shot.firstTime&&!shot.technique;if(!hit)return {hit};
 const preps=r.choices.filter(c=>c.player===i&&c.kind==='prepare'&&c.action&&c.time<shot.time);
 return {hit,ok:preps.filter(c=>c.action==='shoot').length===1&&preps.at(-1).action==='shoot'&&shot.time-preps.at(-1).time<2};};
sweep('clearShot','he prepares and strikes an ordinary shot',shooter(H.clearShot()));
sweep('turnShot','he prepares and strikes an ordinary shot',shooter(H.turnShot()));
sweep('squareBall','#5 strikes it first time',seed=>({hit:H.play(H.squareBall(),{seed}).events.some(e=>e.kind==='shot'&&e.firstTime)}));
// keeper
const firstMiss=r=>{const e=r.events.find(e=>e.kind==='shot'&&e.actor);if(!e)return null;
 const d=1-r.players.find(p=>p.id===e.actor).side,g=r.players.findIndex(p=>p.side===d&&p.role==='GK');
 const fr=r.frames.findLast(x=>x.time<=e.time-.02),from=fr.players[r.players.findIndex(p=>p.id===e.actor)],k=fr.players[g];
 const dd=q=>d===0?q.x:L-q.x,bx=dd(from),a=(Math.atan2(GH-from.y,-bx)+Math.atan2(-GH-from.y,-bx))/2;return Math.abs((dd(k)-bx)*Math.sin(a)-(k.y-from.y)*Math.cos(a));};
sweep('runsAtGoal (5 runs)','at least 3 of the 5 runs end in a shot',seed=>({hit:H.runsAtGoal().map(s=>firstMiss(H.play(s,{seed}))).filter(x=>x!==null).length>=3}));
sweep('clearShot + squareBall + ownThrowIn','the keeper dives',seed=>{let dived=0,bad=0;
 for(const s of [H.clearShot(),H.squareBall(),H.ownThrowIn()]){const r=H.play(s,{seed}),rel=r.events.filter(e=>['pass','clearance','shot','turnover'].includes(e.kind)&&e.actor);
  const all=r.choices.filter(c=>r.players[c.player].role==='GK'&&c.kind==='dive'&&c.reason.startsWith('Împinge'));
  const dives=all.filter((c,i)=>!all.slice(0,i).some(b=>b.player===c.player&&c.time-b.time<.6+1e-6));dived+=dives.length;
  for(const c of dives){const last=rel.findLast(e=>e.time<=c.time+1e-6);if(r.players.find(p=>p.id===last.actor).side===r.players[c.player].side)bad++;}}
 return {hit:dived>0,ok:bad===0};});
// duels
const duel=(setup,edit)=>seed=>{const r=H.play(setup,{seed,edit}),e=H.wonTackles(r)[0];return {r,e};};
for(const where of ['front','side']){
 sweep(`tackle ${where}`,'the top tackler takes the ball',seed=>({hit:!!duel(H.tackle(where),H.mismatch)(seed).e}));
 sweep(`tackle ${where}`,'the beaten man goes in again after his ban',seed=>{const {r,e}=duel(H.tackle(where),H.mismatch)(seed);if(!e)return;
  const vi=r.players.findIndex(p=>p.id===e.target),ban=e.balance.victim.challenge,ch=r.choices.filter(c=>c.player===vi&&c.kind==='challenge'&&c.time>e.time+1e-6);
  return {hit:ch.some(c=>c.time>=e.time+ban-.01),ok:!ch.some(c=>c.time<e.time+ban-.01)};});
}
for(const where of ['side','behind'])
 sweep(`tackle ${where}, poked loose`,'the beaten man is next on the ball (any tackle)',seed=>{const r=H.play(H.tackle(where),{seed,edit:H.pokeLoose}),won=H.wonTackles(r);if(!won.length)return;
  const back=won.map(e=>[e,H.nextOnBall(r,e)]).filter(([e,n])=>n?.who===e.target);return {hit:back.length>0,ok:back.every(([e,n])=>n.after>=e.balance.victim.touch-1e-6)};});
for(const kind of ['chase','meet'])
 sweep(`through ${kind}`,'a hit through the man (tackle or foul, hit > 0)',seed=>{const r=H.play(H.through(kind),{seed,edit:H.throughEdit(kind)});
  const e=r.events.find(e=>(e.kind==='tackle'||e.kind==='foul')&&e.balance?.victim&&e.balance.hit>0);return {hit:!!e,ok:!e||e.balance.victim.challenge>e.balance.victim.touch};});
sweep('markedReceiver','#3 passes to #5 and his touch is contested',seed=>{const r=H.play(H.markedReceiver(),{seed}),five=r.players.find(p=>p.side===0&&p.number===5).id;return {hit:r.receptionDuels.some(d=>d.receiver===five)};});
// playbooks
const playbooks=[0,1].map(side=>({side,adaptive:true,plans:defaultPlans().map(p=>({...p,id:`team-${side}-${p.id}`}))})),[home,away]=H.bothStarts();
sweep('training start, side 0 on the ball','side 0 chooses one of its own ideas',seed=>({hit:H.play(home,{seed,playbooks}).playbookSelections.some(s=>s.planId?.startsWith('team-0-'))}));
sweep('mirrored start, side 1 on the ball','side 1 chooses one of its own ideas',seed=>({hit:H.play(away,{seed,playbooks}).playbookSelections.some(s=>s.planId?.startsWith('team-1-'))}));
if(argv.includes('--rows')){const dir=path.join(pkg,'evidence/2026-10-21-lane-c/results');mkdirSync(dir,{recursive:true});for(const r of rows)appendFileSync(path.join(dir,'sweep.jsonl'),JSON.stringify({...r,arch:process.arch})+'\n');}
