import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers} from '../dist/practice.js';
import {aerialMeetings,aerialContact,readAerialKick,strikeAerial,cushionChest,aerialContactShape} from '../dist/practice-aerial.js';
import {advanceFlight,flightContact} from '../dist/practice-flight.js';
import {L} from '../dist/pitch.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const player=()=>Object.assign(practicePlayers(fixture)[4],{x:30,y:0,vx:0,vy:0,angle:Math.PI});
const ball=(extra={})=>({x:29,y:0,z:1.7,vx:10,vy:0,vz:-2,owner:null,mode:'pass',...extra});

test('aerial contacts need preparation and the right body part at the actual height, on either side',()=>{
 for(const mirror of [false,true])for(const technique of ['header','chest','volley']){
  const p=player(),shape=aerialContactShape[technique],before=ball({x:p.x-shape.offset-.4,z:(shape.min+shape.max)/2}),after={...before,x:p.x-shape.offset+.05};
  if(mirror){p.x=L-p.x;p.angle+=Math.PI;for(const b of [before,after]){b.x=L-b.x;b.vx=-b.vx;}}
  assert.notEqual(aerialContact(p,p,before,after,technique,.4),null);
  assert.equal(aerialContact(p,p,before,after,technique,.05),null);
  assert.equal(aerialContact(p,p,{...before,z:0},{...after,z:0},technique,.4),null);
  const away={...p,y:2};assert.equal(aerialContact(away,away,before,after,technique,.4),null);
 }
 // Crossing the lower edge after horizontal contact has ended is not a header.
 assert.equal(flightContact({x:-2,y:0,z:1},{x:2,y:0,z:1.6},{x:0,y:0},{x:0,y:0},.1,1.95,undefined,1.5),null);
});

test('aerial forecasts use actual movement and do not grant remote or ground-level headers',()=>{
 const p=player(),b=ball({x:24,z:2,vx:10,vz:3});
 assert(aerialMeetings(p,b).some(m=>m.technique==='header'));
 assert.equal(aerialMeetings({...p,y:12,pace:1,acceleration:1},b).length,0);
 assert.equal(aerialMeetings(p,ball({z:0,vz:0})).length,0);
});

test('chest control absorbs a normal delivery but leaves a free, falling ball and cannot erase extreme momentum',()=>{
 const p=player(),b=ball({x:29.6,z:1.25,vx:8,vz:-4}),copy={...b};
 const normal=cushionChest(p,b,0,()=>.5);
 assert(normal.vx<1&&normal.vx> -2);assert(normal.vz<0);
 assert.deepEqual(b,copy,'reading a touch must not move or acquire the ball');
 const heavy=cushionChest(p,{...b,vx:60},0,()=>.5);assert(heavy.vx>p.pace);
 assert.equal(b.owner,null);
});

test('headers and volleys solve outgoing flight from contact height and retain execution error',()=>{
 for(const technique of ['header','volley'])for(const mirror of [false,true]){
  const p=player();p.angle=0;p.skills.aerial=8;p.skills.control=8;
  const b=ball({x:30.5,z:technique==='header'?1.7:.6,vx:5,vz:-2});
  const option={kind:'pass',aim:{x:37,y:2}};
  if(mirror){p.x=L-p.x;p.angle+=Math.PI;b.x=L-b.x;b.vx=-b.vx;option.aim={x:L-option.aim.x,y:-option.aim.y};}
  const plan=readAerialKick(p,b,technique,option);assert(plan);
  const flight={...b,vx:plan.vx,vy:plan.vy,vz:plan.vz};advanceFlight(flight,plan.flight);
  assert(Math.hypot(flight.x-option.aim.x,flight.y-option.aim.y)<.02);
  assert(Math.abs(flight.z-.08)<.02,'arrival height uses the same integration as the match');
  const exact=strikeAerial(p,b,technique,plan,0,()=>.5),error=strikeAerial(p,b,technique,plan,.9,()=>.9);
  assert.notDeepEqual(error,exact);
  assert.equal(readAerialKick(p,{...b,z:3},technique,option),null);
  assert.equal(readAerialKick(p,{...b,vx:100},technique,option),null,'no unlimited reversal impulse');
  assert.equal(readAerialKick(p,b,technique,{kind:'pass',aim:{x:mirror?48:0,y:0}}),null,'not an acrobatic backward kick');
 }
});

test('live training chest control remains free until a real foot reception',async()=>{
 const {runTraining,createTrainingSetup}=await import('../dist/index.js');
 // A seeded passage. Passers valuing what the receiver can do next
 // (2026-10-01, B2) changed seed 4401's (the opening loft now meets a foot);
 // 4479 is the next seed whose 10 s contain a chest control followed by a
 // foot reception (evidence/2026-10-01-b2-width-and-block/repin-chest.mjs).
 // The passing-and-control round (2026-10-10: control above 5 sets the touch
 // gap, body opening and re-setting touches; this receiver has control 9)
 // changed 4479-4548; 4549 has both (evidence/2026-10-10-passing-control/repin.mjs chest).
 // The matchups-combined build (2026-10-10) changed 4549-4595; 4596 has both
 // (evidence/2026-10-10-matchups-combined/repin.mjs chest); with movement intensity merged in, 4596-4599
 // changed; 4600 has both (same repin.mjs chest). The threat-defending round (2026-10-10, with its goal-line and
 // role additions) changed 4600-4731; 4732 has both (evidence/2026-10-10-threat-defending/repin.mjs chest).
 const f=structuredClone(fixture);f.seed=4732;
 const receiver=f.teams[0].squad.find(p=>p.id===f.teams[0].lineup[4]);Object.assign(receiver.skills,{passing:2,finishing:2,control:9});
 const setup=createTrainingSetup('middle');
 for(const p of setup.poses){
  if(p.side&&p.number!==1){p.x=44;p.y=(p.number-3)*5;}
  if(p.side===0&&p.number===3)Object.assign(p,{x:8,y:-7,angle:0});
  if(p.side===0&&p.number===5)Object.assign(p,{x:28,y:1,angle:-2});
  // The other two out of the carrier's picture: an idea only breaks near-ties
  // (IDEA_PREFERENCE_CAP), so an easy pass to #4 would rightly beat the loft.
  if(p.side===0&&p.number===4)Object.assign(p,{x:6,y:12});
  if(p.side===0&&p.number===2)Object.assign(p,{x:4,y:-12});
 }
 setup.ball={side:0,number:3,x:8.6,y:-7};
 const lesson={spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[{id:'pass',momentId:'start',actor:3,kind:'pass',recipient:5,delivery:'loft'},{id:'hold',momentId:'start',actor:5,kind:'hold'}]};
 const playbook={side:0,adaptive:true,plans:[{id:'air',name:'Air',weight:100,emphasis:1,instructions:[],preferred:null,lesson}]};
 const r=runTraining({fixture:f,setup,playbook,durationSeconds:10}).result;
 const chest=r.controlContacts.find(c=>c.technique==='chest');assert(chest,'Live forecast and body contact must connect');
 const receipt=r.events.find(e=>e.actor===chest.actor&&e.kind==='receive'&&e.time>chest.time);
 assert(receipt&&receipt.time>chest.time+.1);
 assert(r.controlContacts.some(c=>c.actor===chest.actor&&c.foot&&c.time>chest.time&&c.time<=receipt.time));
 assert(r.frames.filter(f=>f.time>chest.time&&f.time<receipt.time).every(f=>f.ball.owner===null));
 assert(r.controlContacts.some(c=>c.actor===chest.actor&&c.time>receipt.time),'The player can continue after the reception');
});

test('ordinary match aerial releases have matching physical contacts without a coached combination',async()=>{
 const {runMatch,teamApproaches,defensiveApproaches}=await import('../dist/index.js');
 // A sampled ordinary passage containing both contacts, not a header-frequency
 // target. Moving-release forecasting changed the previous seeded passage, and
 // live restart setups (2026-09-29) changed 13093-13115, and long goal kicks
 // changed 13116-13122; 13123 had both. Styles choosing which pass rather than
 // whether to pass (2026-09-30) changed 13123-13152; 13153 has both again
 // (evidence/2026-09-30-which-pass-release/repin.mjs). Acceleration fatigue
 // (2026-09-30) changed 13153-13189; 13190 has both
 // (evidence/2026-09-30-balance-v3/repin.mjs). Keepers holding shots at the body,
 // soft wide parries and decisive clearing (2026-09-30) changed 13191-13199;
 // 13200 has both (same repin.mjs). "Links play" keeping its own striker off
 // the run it adds for the others (2026-10-01) changed 13200-13212; 13213 has
 // both. Box arrivals offered by position (same day) changed 13213-13243;
 // 13244 has both. Wide attackers running at goal counting as danger (same
 // day) changed 13244-13277; 13278 has both. Marking anchored to each
 // defender's shape slot (same day) changed 13278-13333; 13334 has both.
 // Short passes led to where a moving receiver will be (same day) changed
 // 13334-13404; 13405 has both (same repin.mjs). Patient play pricing only
 // depth and break runs (2026-10-01, B1) changed 13405-13475; 13476 has both.
 // Wingers holding the lane Width asks for (2026-10-01, B2) changed
 // 13476-13546; 13547 has both. The block reacting to the attackers in its
 // zones (same day) changed 13547-13557; 13558 has both. Passers valuing what
 // the receiver can do next (same day) changed 13558-13645; 13646 had both;
 // crediting only what a pass adds, in the attacking zones, changed 13646-13647;
 // 13648 had both; narrow stepping inside rather than out (same day) changed
 // 13648-13683; 13684 had both. Pricing a loss by the rest defence behind
 // the ball, and "Bodies forward" setting that rest defence (2026-10-01, B3),
 // changed 13684-13698; 13699 had both; the counter-press after a loss (same
 // bundle) changed 13699-13735; 13736 had both; Short combinations
 // counter-pressing by preset (same bundle) changed 13736-13756; 13757 had
 // both. The B3b transition builds (2026-10-01: counter runs commit, a
 // counter read by the numbers, running with the ball into open ground)
 // changed 13757-13846; 13847 had both
 // (evidence/2026-10-01-b3b-transitions/repin.mjs). B4's defending near goal
 // (2026-10-01) changed 13847-13886; 13887 had both
 // (evidence/2026-10-01-b4-defending-near-goal/repin.mjs). R1's Counter-only
 // team flip (2026-10-01) changed 13887-13907; 13908 had both; Bodies
 // forward as a priced preference (same round) changed 13908-13918; 13919
 // has both (evidence/2026-10-01-r1-agency/repin.mjs). R2+R3's individual
 // reads and purpose over safety (2026-10-01) changed 13919-13935; 13936
 // had both (evidence/2026-10-01-r2r3-reads-and-purpose/repin.mjs). Silly
 // moments' touches and through-ball weight (2026-10-01) changed
 // 13936-13949; 13950 had both (evidence/2026-10-01-silly-moments/repin.mjs).
 // The combined style build (silly moments, M1 Line, M2/M3 press lean and
 // sight lag, Pivot and the third man; 2026-10-01) has both at 13936 again
 // (evidence/2026-10-01-silly-moments/repin.mjs). The settings round
 // (2026-10-03: Pivot's pass preference, Short's preset) changed 13936-13941;
 // 13942 has both (same repin.mjs). The behaviour round (2026-10-03: the
 // line in a no-offside game, the drop zone, Counter's window, the lay-off
 // read) changed 13942-13960; 13961 has both
 // (evidence/2026-10-03-behaviour-round/repin.mjs). The defending round
 // (2026-10-03: everyone keeps a man, runners followed, set-piece template)
 // changed 13962-13967; 13968 has both (evidence/2026-10-03-defending-build/repin.mjs).
 // The defending rebuild (2026-10-03) kept 13968: with the receiver's own
 // defender contesting a ball in the air it again has both. The defending-close
 // round (2026-10-04) changed 13968-13991; 13992 has both
 // (evidence/2026-10-04-defending-close/repin.mjs aerial). The step-across round
 // (2026-10-04: the passer's own lane read) changed 13992-14050 (headers were
 // missing); 14051 has both (evidence/2026-10-04-stepacross-giveaways/repin.mjs aerial).
 // The settings-truth round (2026-10-04: line keepers stay home, Counter-press
 // goes whatever the numbers) changed 14051, and no seed in 14052-14121 has
 // both (headers and volleys are each about one in five 300 s matches here: in
 // 14051-14055 d7bc2fb5 had 1 header and 1 volley, this build 1 header), so
 // the two techniques are pinned on separate seeds: 14059 has a header, 14065 a
 // volley on the final build (evidence/2026-10-04-settings-truth/repin.mjs header /
 // volley; 14053 and 14060 on its first build). The passing-and-control round
 // (2026-10-10) changed 14059-14065 for headers; 14066 has one, and 14065 still
 // has its volley (evidence/2026-10-10-passing-control/repin.mjs header / volley). The honest-reads round
 // (2026-10-10) changed 14066-14119 for headers; 14120 has one, and 14065 still has its volley
 // (evidence/2026-10-10-honest-reads/repin.mjs header / volley). The matchups-combined build (2026-10-10:
 // honest reads, tiredness, cover defender, B2, B3, marking items 1-2/4/5) changed 14120-14124 for headers
 // and 14065-14066 for volleys; 14125 has a header, 14067 a volley
 // (evidence/2026-10-10-matchups-combined/repin.mjs header / volley); with movement intensity merged in,
 // 14125-14129 lost theirs for headers and 14067-14068 for volleys; 14130 has a header, 14069 a volley (same repin.mjs).
 // The threat-defending round (2026-10-10) changed 14130-14150 for headers and 14069-14074 for volleys; 14151 has a
 // header, 14075 a volley (evidence/2026-10-10-threat-defending/repin.mjs header / volley). The final
 // matchups-combined build (2026-10-11: threat defending + honest run timing) changed 14151-14171 for headers;
 // 14172 has one, and 14075 still has its volley (same repin.mjs header / volley). The tiredness bite
 // (2026-10-11) changed 14172-14208 for headers and 14075-14076 for volleys; 14209 has a header, 14077 a volley
 // (evidence/2026-10-11-tiredness-bite-build/repin.mjs header / volley). The collect read (2026-10-11: the
 // receiver's marker goes for a ball in the air on his own read of the race, within a skill window) changed
 // 14209-14214 for headers; 14215 has one (evidence/2026-10-11-collect-read/repin.mjs header). (The regain fixes,
 // built on the matchups-combined build before the tiredness bite, moved its header from 14172 to 14177:
 // evidence/2026-10-11-regain-fixes/repin.mjs header / volley.) The combined build with both (70c5f925) changed
 // 14215-14221 for headers; 14222 has one, and 14077 still has its volley (collect-read repin.mjs header / volley).
 // Track the runner (2026-10-11: runs read from their start) changed 14222-14225 for headers and 14077 for volleys;
 // 14226 has a header, 14078 a volley (evidence/2026-10-11-track-runner/repin.mjs header / volley). Its wider skill
 // range (a run read 0.1 s ahead by a man who cannot read the game, 0.8 s by a sharp one) changed 14226-14227 for
 // headers; 14228 has one, and 14078 still has its volley (same repin.mjs header / volley). The pre-push fixes
 // (2026-10-12: a carrier meets a man in his path; an outlet steps off a marker who beats the ball) kept 14228's
 // header and changed 14078 for volleys; 14079 has one (evidence/2026-10-12-prepush-fixes/repin.mjs header / volley).
 // The combined build with stamina as lasting (the sprint reserve the same at any stamina) and box defending (markers
 // near goal step into the open shot lane, a set blocker's leg), b0174c30, 2026-10-13, changed 14228-14266 for headers
 // and 14079 for volleys; 14267 has a header, 14080 a volley (evidence/2026-10-12-box-defending/repin.mjs header /
 // volley). (On their own, box defending had moved them to 14229 / 14080 and stamina to 14234 / 14080.) The keeper
 // upgrade and the keeper with the ball in his hands (2026-10-13) changed both; searching on, 14277 has a header and
 // 14085 a volley (evidence/2026-10-13-keeper-2/repin.mjs header / volley).
 const sandbox=JSON.parse(readFileSync(new URL('../../../deliverables/football-practice/engine-audition/sandbox-fixture.json',import.meta.url)));
 for(const [technique,seed] of [['header',14277],['volley',14085]]){
  const f=structuredClone(sandbox);f.seed=seed;
  f.teams[0].lineup[1]='motanescu';Object.assign(f.teams[0].tactics,teamApproaches.combinations.settings);
  Object.assign(f.teams[1].tactics,defensiveApproaches.press.tactics);
  const r=runMatch({fixture:f,durationSeconds:300}).result;
  const events=r.events.filter(e=>e.technique===technique);assert(events.length,`A live ${technique} opportunity must reach execution`);
  for(const event of events){
   const contact=r.controlContacts.find(c=>c.actor===event.actor&&c.technique===technique&&c.kind===event.kind&&Math.abs(c.time-event.time)<1/60);
   assert(contact&&contact.z>.25&&contact.incoming.vz<0);
   assert(!r.frames.some(f=>f.time>event.time&&f.time<event.time+.05&&f.ball.owner===event.actor),'A strike releases the ball rather than granting possession');
  }
 }
});
