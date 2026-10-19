// Reading start (2026-10-19): ../2026-10-19-keeper-fix/repin.ts plus `tackled` (test/b3-losing-the-ball.test.mjs), `keeperBox` (test/keeper-box.test.mjs, the pressed
// keeper's 300 s passage, aggressive press) and `standing` (test/standing-instructions.test.mjs, the 40 s match and training
// runs with and without the press order on fixture.json), each copied from its test.
// Keeper fix (2026-10-19): ../2026-10-16-release-3/repin.ts plus `ordinary` (test/shot-reconsideration.test.mjs) and
// `subs` (test/triggered-substitutions.test.mjs), copied from ../2026-10-12-box-defending/repin.mjs.
// Release 3 (2026-10-16): the seeded-passage checks of ../2026-10-16-press-cover/repin.mjs that move on the combined
// build (header, volley, takeonGolusor, shotTrace), unchanged but for reading the engine from src through the bundle
// (so the public lab, which has no dist, can run them), plus `pipeline` (verificare/ballers-pipeline.test.ts: the
// 120 s official computation that plays an attack out past full time, 120 < duration <= 140). Imports only the
// engine, its test fixtures and lib/ballers/compute. Each check returns a note when the seed's passage again holds
// what the test looks for, else null. Runner: repin.mjs.
import {runMatch,runTraining,createTrainingSetup,teamApproaches,defensiveApproaches} from '../../src/index';
import {advanceFlight} from '../../src/practice-flight';
import {STEP as BEATEN} from '../../src/practice-balance';
import {defaultPlans} from '../../src/practice-playbook';
import {ENGINE_BUILD} from '../../src/build-info';
import {computeMatch,validateInput} from '../../../../lib/ballers/compute';
import sandbox from '../../../../deliverables/football-practice/engine-audition/sandbox-fixture.json';
import scene from '../../test/feint-release-scene.json';
import fixtureBase from '../../test/fixture.json';

const base=(scene as any).fixture;
const make=(fixture:any,seed:number,style:string,opponent?:string)=>{const f=structuredClone(fixture);f.seed=seed;f.teams[0].lineup[1]='motanescu';Object.assign(f.teams[0].tactics,(teamApproaches as any)[style].settings);if(opponent)Object.assign(f.teams[1].tactics,(defensiveApproaches as any)[opponent].tactics);return f;};

const checks:Record<string,(seed:number)=>string|null>={
 header(seed){return aerial(seed,['header']);},
 volley(seed){return aerial(seed,['volley']);},
 takeonGolusor(seed){return takeon(seed,'0:golusor');},
 shotTrace(seed){
  // test/shot-trace.test.mjs: both tests on the same 100 s passage.
  if(!ownTouch(seed))return null;
  const f=structuredClone(base);f.seed=seed;f.teams[0].lineup[1]='motanescu';Object.assign(f.teams[0].tactics,(teamApproaches as any).balanced.settings);Object.assign(f.teams[1].tactics,(defensiveApproaches as any).press.tactics);
  const r:any=runMatch({fixture:f,durationSeconds:100}).result;
  if(!r.events.some((e:any)=>e.kind==='shot'))return null;
  for(const e of r.events.filter((e:any)=>e.kind==='shot')){
   const frame=r.frames.findLast((g:any)=>g.time<=e.time),s=e.shot;if(!s||frame.time!==e.time||frame.ball.mode!=='shot')return null;
   if(e.firstTime||e.technique){
    const c=r.controlContacts.find((c:any)=>c.kind==='shot'&&c.actor===e.actor&&c.technique===e.technique&&e.time-c.time>=0&&e.time-c.time<1/60);
    if(!c||s.origin.x!==c.x||s.origin.y!==c.y||s.velocity.vx!==c.outgoing.x||s.velocity.vy!==c.outgoing.y)return null;
    const flight:any={...s.origin,...s.velocity,owner:null,mode:'shot'};advanceFlight(flight,e.time-c.time);
    if(['x','y','z','vx','vy','vz'].some(k=>!(Math.abs(flight[k]-frame.ball[k])<1e-8)))return null;
   }else if(s.origin.x!==frame.ball.x||s.origin.y!==frame.ball.y||s.origin.z!==frame.ball.z||s.velocity.vx!==frame.ball.vx||s.velocity.vy!==frame.ball.vy||s.velocity.vz!==frame.ball.vz)return null;
  }
  return 'goal after an opponent touch; every shot trace exact';},
 ordinary(seed){const r:any=runMatch({fixture:make(base,seed,'balanced','press'),durationSeconds:75}).result,shots=r.events.filter((e:any)=>e.kind==='shot');
  const ok=shots.some((e:any)=>{const index=r.players.findIndex((p:any)=>p.id===e.actor),preparation=r.choices.findLast((c:any)=>c.player===index&&c.action&&c.time<e.time);return !e.firstTime&&!e.technique&&!e.freeKick&&preparation?.action==='shoot'&&e.time-preparation.time<2&&!r.events.some((n:any)=>n.actor===e.actor&&n.kind==='receive'&&n.time>preparation.time&&n.time<e.time);});
  return ok?`${shots.length} shots, an ordinary prepared foot shot`:null;},
 subs(seed){
  const f:any=structuredClone(fixtureBase);f.seed=seed;
  for(const [side,t] of f.teams.entries()){const gk=t.squad.find((p:any)=>p.roles[0]==='GK');
   t.squad.push({...structuredClone(gk),id:`rgk${side}`,name:`Portar rezervă ${side}`},{...structuredClone(t.squad[3]),id:`r1${side}`,name:`Rezerva unu ${side}`},{...structuredClone(t.squad[4]),id:`r2${side}`,name:`Rezerva doi ${side}`});}
  const orders=[{id:'h',side:0,in:'r10',trigger:{kind:'half'}},{id:'chain',side:0,in:'r20',out:'r10',trigger:{kind:'tired',player:'r10',threshold:99.9},notBefore:200},{id:'k',side:0,in:'rgk0',trigger:{kind:'score',state:'winning'}},{id:'w',side:1,in:'r11',trigger:{kind:'score',state:'losing'}},{id:'m',side:1,in:'r21',trigger:{kind:'margin',atLeast:1,direction:'down'},notBefore:100},{id:'d',side:1,in:'rgk1',trigger:{kind:'score',state:'drawing'}}];
  const r:any=runMatch({fixture:f,durationSeconds:300,substitutionOrders:orders} as any).result,made=r.events.filter((e:any)=>e.kind==='substitution');
  const half=made.find((e:any)=>e.substitution.order==='h'),draw=made.find((e:any)=>e.substitution.order==='d'),chain=made.find((e:any)=>e.substitution.order==='chain');
  if(!half||!draw||!chain||draw.time<=0||draw.outgoing!=='1:mircea'||chain.outgoing!=='0:r10'||!(chain.time>half.time))return null;
  const first=r.events.find((e:any)=>['goal','out','foul','offside','half'].includes(e.kind)&&e.time>=150);if(!first||half.time!==first.time)return null;
  return `half ${half.time.toFixed(2)} s, drawing ${draw.time.toFixed(2)} s, chain ${chain.time.toFixed(2)} s`;},
 keeperBox(seed){
  const f:any=structuredClone(fixtureBase);f.seed=seed;for(const t of f.teams)t.tactics.press='aggressive';
  const r:any=runMatch({fixture:f,durationSeconds:300,policy:'coordinated'}).result;
  const pos=(fr:any,i:number)=>fr.lineup?fr.players[fr.lineup.indexOf(i)]:fr.players[i];
  const at=new Map<string,number>(r.players.map((p:any,i:number)=>[p.id,i])),gk=new Set(r.players.filter((p:any)=>p.role==='GK').map((p:any)=>p.id));
  const near=(fr:any,k:string)=>Math.min(...r.players.map((p:any,i:number)=>({p,q:pos(fr,i)})).filter((x:any)=>x.q&&x.p.role!=='GK'&&x.p.side!==r.players[at.get(k)!].side).map((x:any)=>{const g=pos(fr,at.get(k)!);return Math.hypot(x.q.x-g.x,x.q.y-g.y);}));
  let spells=0,pressed=0,moved=0,cur:any=null;
  for(let n=0;n<r.frames.length;n++){
   const fr=r.frames[n],o=fr.ball.owner,hands=!!o&&gk.has(o)&&!fr.restart&&!fr.control;
   if(hands){if(!cur||cur.id!==o)cur={id:o,from:fr.time,start:{...pos(fr,at.get(o)!)},pressed:false};cur.last=n;const d=near(fr,o);if(d<2)cur.pressed=true;if(fr.time-cur.from>=1.2&&d<.8)return null;continue;}
   if(!cur)continue;
   spells++;const last=r.frames[cur.last],k=pos(last,at.get(cur.id)!);
   if(last.time-cur.from>4.1)return null;
   if(cur.pressed&&last.time-cur.from>1){pressed++;if(Math.hypot(k.x-cur.start.x,k.y-cur.start.y)>.5)moved++;}
   const next=r.frames.slice(n,n+60).find((g:any)=>g.ball.owner&&g.ball.owner!==cur.id);
   if(next&&r.players[at.get(next.ball.owner)!].side!==r.players[at.get(cur.id)!].side){const q=pos(last,at.get(next.ball.owner)!);if(Math.hypot(q.x-k.x,q.y-k.y)<2)return null;}
   cur=null;
  }
  return spells>=3&&pressed>=2&&moved>=2?`${spells} spells, ${moved} of ${pressed} pressed holds moved`:null;},
 standing(seed){
  const f:any=structuredClone(fixtureBase);f.seed=seed;
  const p={id:'policy',name:'Policy',weight:100,emphasis:1,instructions:[],preferred:null,lesson:{spaces:[{id:'area',name:'Area',x:39,y:5,radius:3}],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[]},standing:[{id:'stay',actor:5,kind:'stay-forward',spaceId:'area',phase:'always'},{id:'press',actor:4,kind:'press',phase:'defending'}]};
  const notes:string[]=[];
  for(const mode of ['match','training']){
   const run=(book:boolean)=>((mode==='match'?runMatch:runTraining) as any)({fixture:f,durationSeconds:40,...(mode==='training'?{setup:createTrainingSetup('middle')}:{}),...(book?{playbook:{side:0,plans:[p],adaptive:true}}:{})}).result;
   const result=run(true);if(!result.standingNotes.some((n:any)=>n.status==='active')||!result.standingNotes.some((n:any)=>n.kind==='press'&&n.status==='active'))return null;
   const actor=result.players.findIndex((q:any)=>q.side===0&&q.number===4);
   const pressing=(r:any)=>r.frames.filter((fr:any)=>['press','jockey'].includes(fr.players[fr.lineup?fr.lineup.indexOf(actor):actor]?.duty)).length;
   const a=pressing(result),b=pressing(run(false));if(!(a>b))return null;notes.push(`${mode} ${a} v ${b}`);
  }
  return notes.join(', ');},
 tackled(seed){
  // test/b3-losing-the-ball.test.mjs: five or more tackles won in 240 s, none answered by the loser inside STEP
  const f:any=structuredClone(fixtureBase);f.seed=seed;
  const r:any=runMatch({fixture:f,durationSeconds:240}).result;
  const id=(i:number)=>r.players[i].id;
  const challenges=r.choices.filter((c:any)=>c.kind==='challenge'&&c.challenge);
  const won=challenges.filter((c:any)=>r.events.some((e:any)=>e.kind==='tackle'&&e.actor===id(c.player)&&Math.abs(e.time-c.challenge.resolvesAt)<.05));
  if(won.length<5)return null;
  for(const c of won){const loser=c.challenge.opponent,t=c.challenge.resolvesAt;if(challenges.some((x:any)=>id(x.player)===loser&&x.time>t+1e-6&&x.time<t+BEATEN-1e-6))return null;}
  return `${won.length} tackles won, none answered`;},
 pipeline(seed){
  // verificare/ballers-pipeline.test.ts input(120, seed): the same two sides, then the chunk test's precondition.
  const c=computeMatch(validateInput(pipelineInput(seed)));const d=c.compact.header.duration;
  return d>120&&d<=140?`plays an attack out to ${d} s`:null;},
};
function aerial(seed:number,techniques:string[]){const r:any=runMatch({fixture:make(sandbox,seed,'combinations','press'),durationSeconds:300}).result;
 for(const technique of techniques){const events=r.events.filter((e:any)=>e.technique===technique);if(!events.length)return null;
  for(const event of events){const c=r.controlContacts.find((c:any)=>c.actor===event.actor&&c.technique===technique&&c.kind===event.kind&&Math.abs(c.time-event.time)<1/60);
   if(!(c&&c.z>.25&&c.incoming.vz<0))return null;if(r.frames.some((f:any)=>f.time>event.time&&f.time<event.time+.05&&f.ball.owner===event.actor))return null;}}
 return techniques.join(' and ');}
function takeon(seed:number,receiver?:string){const r:any=runMatch({fixture:make(base,seed,'direct'),durationSeconds:40}).result;
 for(const attempt of r.events.filter((e:any)=>e.kind==='feint'&&e.actor?.startsWith('0:'))){
  const player=r.players.findIndex((p:any)=>p.id===attempt.actor),prepare=r.choices.find((c:any)=>c.player===player&&c.kind==='prepare'&&c.action&&c.time>attempt.time);
  const pass=r.events.find((e:any)=>e.kind==='pass'&&e.actor===attempt.actor&&e.time>attempt.time);
  if(!(prepare&&pass&&prepare.time>=attempt.time+.41&&pass.time>prepare.time+.2&&pass.time<attempt.time+1.7))continue;
  if(receiver&&(pass.target!==receiver||attempt.actor!=='0:crocodinho'))continue;
  if(!r.controlContacts.some((c:any)=>c.actor===pass.actor&&c.kind==='pass'&&Math.abs(c.time-pass.time)<1e-6&&c.foot))continue;
  if(!r.events.some((e:any)=>e.kind==='receive'&&e.actor===pass.target&&e.time>pass.time&&e.time<pass.time+2))continue;
  return `${attempt.actor} take-on at ${attempt.time.toFixed(3)} s released to ${pass.target} at ${pass.time.toFixed(3)} s`;}
 return null;}
function ownTouch(seed:number){const f=structuredClone(base);f.seed=seed;f.teams[0].lineup[1]='motanescu';Object.assign(f.teams[0].tactics,(teamApproaches as any).balanced.settings);Object.assign(f.teams[1].tactics,(defensiveApproaches as any).press.tactics);
 const r:any=runMatch({fixture:f,durationSeconds:100}).result;return r.events.some((e:any)=>e.kind==='goal'&&r.players.find((p:any)=>p.id===e.lastTouch).side!==e.side)?'goal after an opponent touch':null;}

// verificare/ballers-pipeline.test.ts, copied: skills, side() and input().
const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:4+n%5,defending:5,pace:4+n%4,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:gk?8:1});
function side(tag:string,formation:string,style:string,withPlans=false):any{
 const players=Array.from({length:9},(_,n)=>({id:`${tag}000000-0000-4000-8000-00000000000${n}`,name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,roles:(n===0||n===8?['GK']:['CM','ST']),
  skills:skills(n===0||n===8,n),traits:{risk:.5,dribble:.4+n/40,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation,style,
  approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},
  captain:lineup[2],lineup,bench:players.slice(5).map(p=>p.id),players,
  plans:withPlans?defaultPlans().slice(0,2).map((plan:any,i:number)=>({idea:`idea-${i}`,key:plan.id,name:`Secret idea ${i}`,plan,lineup,accent:80})):[]};
}
const pipelineInput=(seed:number)=>({v:1,match:'m',seed,kickoff:(seed%2),duration:120,sides:[side('aa','1-2-1','balanced',true),side('bb','2-1-1','counter')]});

export function play(task:{kind:string;seed:number}){
 const t0=Date.now(),check=checks[task.kind];if(!check)throw Error(`unknown check ${task.kind}`);
 return {kind:task.kind,seed:task.seed,found:check(task.seed),build:ENGINE_BUILD.slice(0,8),platform:`${process.platform}-${process.arch}-node${process.versions.node}`,ms:Date.now()-t0};
}
