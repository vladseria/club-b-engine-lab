import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practicePlayers,laneRisk} from '../dist/practice.js';
import {coordinateFootball} from '../dist/practice-coordination.js';
const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
const place=(players,at)=>players.forEach((p,i)=>Object.assign(p,{x:at[i][0],y:at[i][1],vx:0,vy:0}));
const plan=(players,owner,tactics,ticks=4,context={})=>{
 let result=null;
 for(let k=0;k<ticks;k++)result=coordinateFootball(players,{...owner,z:0,vz:0,mode:'control',owner:owner.id},owner.side,tactics,laneRisk,{time:10+k*.25,recoveredAt:-10,...context},result);
 return result;
};

// Change 1: Width reaches the attack. Team 0 (1-2-1) has the ball with its
// left winger on the left; where does the far (right) winger go?
const attack=(width,ballY=-9)=>{
 const f=structuredClone(fixture);f.teams[0].tactics={...f.teams[0].tactics,width};
 const players=practicePlayers(f);
 place(players,[[4,0],[14,-3],[24,ballY],[26,6],[30,-2],[46,0],[38,-2],[32,-6],[33,4],[27,-3]]);
 const v=plan(players,players[2],f.teams.map(t=>t.tactics)),far=players[3];
 return {slot:v.shapes[0].slots[far.id].aim.y,job:v.jobs[far.id]};
};
test('width with the ball: the far winger holds a lane as wide as the team asks, narrow brings him towards the ball',()=>{
 const narrow=attack('narrow'),standard=attack('standard'),wide=attack('wide');
 assert(wide.slot>12.5,`a wide winger's lane reaches the touchline band (${wide.slot.toFixed(1)} m), no longer capped at the standard lane`);
 assert(wide.slot>standard.slot+2&&standard.slot>narrow.slot+2,'the resting lane orders narrow < standard < wide');
 assert.equal(wide.job.purpose,'width','wide: he holds width on the far side');
 assert(wide.job.aim.y>=12.5);
 // Honest run timing (9306734b, 2026-10-11): in this scene Standard's far winger now
 // takes the ball-side depth run that Narrow's already took (aim y -7.9); the width
 // check (branch width-check) found that in matches Standard still holds the far
 // touchline 8% of the time against Narrow's 3% and Wide's 17% (clear steps). His
 // resting lane above still orders narrow < standard < wide; his job is a lane or a run.
 assert(standard.job.purpose==='width'?standard.job.aim.y>=10:standard.job.kind==='run','standard holds a lane too, less wide, unless he is given a run');
 assert(narrow.job.aim.y<wide.job.aim.y-6,'narrow: he comes towards the ball for close support');
});

// Change 2 (audit #7): without wingers (2-1-1) Width spreads the build-up.
const buildUp=(width,carrier=0)=>{
 const f=structuredClone(fixture);f.teams[0].tactics={...f.teams[0].tactics,formation:'2-1-1',width};
 const players=practicePlayers(f);
 place(players,[[4,0],[12,-4],[12,4],[20,1],[30,0],[46,0],[38,-2],[32,-6],[33,4],[27,-3]]);
 const v=plan(players,players[carrier],f.teams.map(t=>t.tactics)),[a,b]=[players[1],players[2]];
 return {slots:v.shapes[0].slots[b.id].aim.y-v.shapes[0].slots[a.id].aim.y,jobs:Math.abs(v.jobs[a.id].aim.y)+Math.abs(v.jobs[b.id].aim.y),depths:[v.jobs[a.id].aim.x,v.jobs[b.id].aim.x]};
};
test('2-1-1: Width splits the centre-backs wider or keeps them closer in possession',()=>{
 const narrow=buildUp('narrow'),standard=buildUp('standard'),wide=buildUp('wide');
 assert(wide.slots>standard.slots+2&&standard.slots>narrow.slots+1.5,'the backs\' resting spread orders narrow < standard < wide');
 // (r1-shape v5, 2026-10-14) Re-expressed: the offers to the keeper are wider
 // the wider the setting (wide > narrow by a clear margin), and neither back
 // gets that width by standing beside the keeper on the goal line. The old
 // narrow < standard < wide by 2 m each leaned on wide's second back at
 // (4, 7), level with the keeper; standard now sits between in its resting
 // spread (above) but its offers can tie with either end in this one scene.
 assert(wide.jobs>narrow.jobs+4,`and so do their offers to the keeper (narrow ${narrow.jobs.toFixed(1)}, wide ${wide.jobs.toFixed(1)})`);
 for(const r of [narrow,standard,wide])for(const x of r.depths)assert(x>4+3,`a back offers ahead of the keeper, not beside him on the line (${x.toFixed(1)})`);
 // With wingers, the wingers carry the setting: the back line is unchanged.
 const winged=width=>{const f=structuredClone(fixture);f.teams[0].tactics={...f.teams[0].tactics,formation:'2-2',width};
  const players=practicePlayers(f);place(players,[[4,0],[12,-4],[12,4],[26,-6],[26,6],[46,0],[38,-2],[32,-6],[33,4],[27,-3]]);
  const v=plan(players,players[0],f.teams.map(t=>t.tactics),1);return v.shapes[0].slots[players[2].id].aim.y-v.shapes[0].slots[players[1].id].aim.y;};
 assert.equal(winged('narrow'),winged('wide'));
});

// Change 3 (gap 2, audit #8 and #18): the block reacts to the attackers in
// its zones, and following the far man is a trade-off priced by the
// defending team's Width. Team 1 (1-2-1) defends; team 0's left winger has
// the ball on the left, its right winger (Van) stands wide on the far side
// and its striker (Golusor) centrally.
const {PracticePlaybook}=await import('../dist/practice-playbook.js');
const markVan={id:'policy',name:'Policy',weight:100,emphasis:1,instructions:[],preferred:null,lesson:{spaces:[],moments:[{id:'start',name:'Start',cue:{kind:'start'}}],jobs:[]},standing:[{id:'mark',actor:3,kind:'mark',opponent:4,phase:'defending'}]};
const block=(width,{ordered=false,far=[33,13]}={})=>{
 const f=structuredClone(fixture);f.teams[1].tactics={...f.teams[1].tactics,width,line:'standard',press:'balanced',marking:'balanced'};
 // Perfect readers (R2): the block's rule shows exactly; how far each
 // defender follows his man is otherwise his own read (r2-perception).
 for(const p of f.teams[1].squad)Object.assign(p.skills,{reading:10,defending:10});
 const players=practicePlayers(f);
 place(players,[[4,0],[20,-2],[28,-10],far,[34,0],[46,0],[38,-2],[32,-7],[32,5],[26,-4]]);
 const owner=players[2],tactics=f.teams.map(t=>t.tactics),ball={...owner,z:0,vz:0,mode:'control',owner:owner.id};
 const book=new PracticePlaybook({side:1,plans:[markVan]},2026);
 let v=null;
 for(let k=0;k<8;k++){const time=10+k*.25;v=coordinateFootball(players,ball,0,tactics,laneRisk,{time,recoveredAt:-10,...(ordered?{responsibilities:preview=>book.persistent(time,players,ball,preview.attacking,tactics[1],preview,new Set(),null)}:{})},v);}
 const by=n=>players.find(p=>p.side===1&&p.number===n);
 return {v,van:players[3],cb:by(2),near:by(3),far:by(4)};
};
test('the far man\'s defender tucks in towards the middle, goal-side; Width sets how far',()=>{
 // Defending rebuild (2026-10-03): there is no ball-anchored block any more.
 // Van (far side, two passes away) has an owner who stands goal-side of him,
 // sagged towards the middle as far as he can still reach him on a switch;
 // Narrow tucks him in further (protects the centre, concedes the switch),
 // Wide keeps him nearer his man.
 const narrow=block('narrow'),standard=block('standard'),wide=block('wide');
 const owner=b=>{const id=[...b.v.marks].find(([,t])=>t===b.van.id)?.[0];assert(id,'the far man has an owner');return b.v.jobs[id];};
 const off=b=>{const j=owner(b);return Math.hypot(j.aim.x-b.van.x,j.aim.y-b.van.y);};
 for(const b of [narrow,standard,wide]){
  const j=owner(b);assert(Math.hypot(j.aim.x-48,j.aim.y)<Math.hypot(b.van.x-48,b.van.y),'goal-side of him');
  assert(off(b)>3&&off(b)<12,`tucked in (${off(b).toFixed(2)} m off him)`);
 }
 assert(off(narrow)>off(standard)+.8&&off(standard)>off(wide)+.8,'Narrow tucks in furthest, Wide least');
 assert(owner(narrow).aim.y<owner(wide).aim.y-1,'and Narrow stands nearer the middle');
});

test('narrow is zone-minded: it steps inside to pick up a man, not out towards the touchline; wide follows him either way',async()=>{
 const {markingDeparture}=await import('../dist/practice-shape.js');
 // A midfield defender (slot y 8, 24 m from his goal, a team-mate inside him)
 // and an attacker who is not yet dangerous, 24 m out.
 const d={id:'1:d',side:1,role:'W'},t={id:'0:t',side:0,x:24,y:0,vx:0,vy:0};
 const follows=(width,y)=>markingDeparture(d,t,{x:24,y},{width,back:5,focus:{x:20,y:0},slots:{'1:d':{aim:{x:24,y:8}},'1:e':{aim:{x:40,y:2}}}})!==null;
 assert(follows('narrow',-2.8)&&!follows('standard',-2.8),'narrow steps in further than standard (10.8 m inside)');
 assert(!follows('narrow',17.6)&&!follows('standard',17.6)&&follows('wide',17.6),'only wide goes 9.6 m out with him');
 assert(follows('wide',-2.8),'wide follows a man wherever he goes');
});

// Explicit instructions beat team-level logic (Vlad, 30 Sep): a manager's
// standing order to mark a specific attacker is followed, and the block's
// zone logic neither overrides it nor draws a second defender onto him.
test('a standing mark order on a specific attacker beats the block\'s zone logic',()=>{
 for(const width of ['narrow','wide']){
  const s=block(width,{ordered:true});
  assert.equal(s.v.jobs[s.near.id].purpose,'playbook');assert.equal(s.v.jobs[s.near.id].target,s.van.id,'the ordered defender tracks his man');
  assert.equal(s.v.marks.get(s.near.id),s.van.id);
  assert.equal([...s.v.marks.values()].filter(id=>id===s.van.id).length,1,'nobody else is assigned to him');
 }
});

// Change 4 (gap 1, cheap form; audit #22): the passer values what the
// receiver can do next, beyond the 0.8 s at which receivingRoom saturates.
test('a receiver with more time and team-mates around him is worth more, even when both would have room to receive',async()=>{
 const {groundOptions,receivingRoom}=await import('../dist/practice-passing.js');
 // The carrier (20, 0) is closed down from behind; Van (26, 9) is the receiver.
 // The read is the passer's own (R2): a top reader (10) reads it nearly exactly.
 const read=(m,pressed=true)=>{const players=practicePlayers(fixture);Object.assign(players[2].skills,{reading:10,passing:10});
  place(players,[[4,0],[12,0],[20,0],[26,9],[26,-9],[46,0],[34.5,-9*m],[40,9*m],[43,0],pressed?[18,-1*m]:[44,-3*m]]);
  const o=groundOptions(players[2],players[3],players,false,undefined,players[2],laneRisk)[0];
  return {o,room:receivingRoom(o.aim,players.filter(q=>q.side===1),o.pass.flight)};};
 const free=read(1),closer=read(-1);
 assert.equal(free.room,1);assert.equal(closer.room,1,'both receptions saturate the old room read');
 assert(free.o.next>closer.o.next,'the uncapped read tells them apart');
 assert(free.o.score-closer.o.score>.03,'and the pass to the freer man is preferred');
 // Only what the pass ADDS to the carrier's own prospects is credited: a free
 // carrier gains little by giving the ball to another free man.
 assert(read(1,false).o.next<free.o.next-.03,'no flat credit for passing when keeping it offers the same');
});
test('patient play\'s switch credit tops up the receiver\'s prospects, it is never paid twice',async()=>{
 const {approachOptions,teamApproaches}=await import('../dist/team-approach.js');
 const d=(id,x,y)=>({id:`1:${id}`,side:1,role:'CB',x,y,vx:0,vy:0,pace:6.5,acceleration:5});
 const players=[d('a',24,-8),d('b',22,-4),d('c',26,-11),d('e',30,0),{id:'1:gk',side:1,role:'GK',x:47,y:0,vx:0,vy:0,pace:5,acceleration:4}];
 const p={id:'0:c',side:0,x:20,y:-8,vx:0,vy:0,role:'CM',traits:{risk:.5,dribble:.5}};
 const option=next=>({kind:'pass',target:'0:t',aim:{x:23,y:7},score:.5,pass:{risk:0,flight:.9},delivery:{connectionGain:0},next});
 const [unpaid,paid]=approachOptions(p,[option(0),option(.2)],teamApproaches.combinations.settings,players);
 assert(unpaid.score-paid.score>.05,'a switch the prospects term already paid for earns no second credit');
});
