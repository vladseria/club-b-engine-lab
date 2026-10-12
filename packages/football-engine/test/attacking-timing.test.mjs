import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {attackingSpaceReader} from '../dist/practice-attacking-space.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(mirror=false){
 const players=practicePlayers(fixture),carrier=players[2],pivot=players[3],runner=players[4];
 players.filter(p=>p.side).forEach(p=>Object.assign(p,{x:46,y:13,vx:0,vy:0}));
 Object.assign(carrier,{x:18,y:0,vx:0,vy:0,angle:0});
 Object.assign(pivot,{x:21,y:-6,vx:0,vy:0,angle:0});
 Object.assign(runner,{x:29,y:6,vx:0,vy:0,angle:0});
 const job=(p,aim)=>({player:p.id,purpose:'depth',kind:'run',aim,speed:p.pace,since:0,until:4,reason:''});
 const first=job(pivot,{x:21,y:-6}),second=job(runner,{x:29,y:13});
 if(mirror){for(const p of players)Object.assign(p,{side:1-p.side,x:48-p.x,vx:-p.vx,angle:Math.PI-p.angle});for(const j of [first,second])j.aim.x=48-j.aim.x;}
 return {players,carrier,pivot,runner,first,second};
}
for(const mirror of [false,true]){
 test(`an onward run is valued at delivery, not at its independently best instant (mirror=${mirror})`,()=>{
  const s=scene(mirror),depth=v=>mirror?48-v.x:v.x;
  const assess=openLater=>{
   // Freeze the pass windows to isolate timing: the direct route is blocked;
   // the relay route either closes or opens as the runner moves laterally.
   const risk=(from,to)=>depth(from)<20?(to.y>0?.9:0):openLater?(to.y>10?0:1):(to.y<7?0:1);
   const read=attackingSpaceReader(s.players,s.carrier,fixture.teams[0].tactics,risk);
   const a=read.read(s.pivot,s.first,0),b=read.read(s.runner,s.second,0);
   assert.equal(b.at,0,'The independent peak is his initial position in both cases');
   return read.connection(a,b);
  };
  assert.equal(assess(false),0,'Do not credit a lane the runner has left by the second delivery');
  assert(assess(true)>0,'Retain preparation for an onward lane that opens after the first pass');
 });
 test(`a relay needs enough time to prepare its onward release (mirror=${mirror})`,()=>{
  const s=scene(mirror),depth=v=>mirror?48-v.x:v.x;
  const risk=(from,to)=>depth(from)<20&&to.y>0?.9:0;
  const score=()=>{const r=attackingSpaceReader(s.players,s.carrier,fixture.teams[0].tactics,risk);return r.connection(r.read(s.pivot,s.first,0),r.read(s.runner,s.second,0));};
  const free=score();assert(free>0);
  const d=s.players.find(p=>p.side!==s.carrier.side&&p.role!=='GK');
  Object.assign(d,{x:s.pivot.x,y:s.pivot.y+.5,vx:0,vy:0});
  assert.equal(score(),0,'The receiving intermediary cannot also promise a prepared pass through immediate pressure');
 });
}
test('connection forecasts are repeatable, do not mutate players, and honour an expired moving job',()=>{
 const s=scene(),before=structuredClone(s.players);
 const r=attackingSpaceReader(s.players,s.carrier,fixture.teams[0].tactics,(from,to)=>from.x<20&&to.y>0?.9:0);
 const a=r.read(s.pivot,s.first,0),b=r.read(s.runner,s.second,0);
 assert.equal(r.connection(a,b),r.connection(a,b));assert.deepEqual(s.players,before);
 const expired=r.read(s.runner,{...s.second,until:.1},0);
 assert.equal(r.connection(a,expired),0,'Do not invent a continued run after the responsibility expires');
});
