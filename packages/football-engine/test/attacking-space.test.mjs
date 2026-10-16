import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {practicePlayers} from '../dist/index.js';
import {attackingSpaceReader} from '../dist/practice-attacking-space.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));
function scene(){
 const players=practicePlayers(fixture);
 players.forEach((p,i)=>Object.assign(p,{x:p.side?44:10+i*3,y:p.side?12:-5+i*2,vx:0,vy:0}));
 const carrier=players[2],runner=players[4];Object.assign(carrier,{x:18,y:0});Object.assign(runner,{x:22,y:5});
 const job={player:runner.id,purpose:'depth',kind:'run',aim:{x:32,y:5},speed:runner.pace,since:0,until:4,reason:''};
 return {players,carrier,runner,job,tactics:fixture.teams[0].tactics};
}
test('reachable progress adds value; a blocked pass, closed reception, or expired movement cannot claim that opening',()=>{
 const s=scene(),before=structuredClone(s.players),read=risk=>attackingSpaceReader(s.players,s.carrier,s.tactics,risk);
 const open=read(()=>0).read(s.runner,s.job,0),hold=read(()=>0).read(s.runner,{...s.job,aim:{x:s.runner.x,y:s.runner.y}},0);
 assert(open.gain>hold.gain);assert(open.point.x>s.runner.x&&open.point.x<s.job.aim.x,'Value a reachable point along the run, not a teleported endpoint');
 assert.equal(read(()=>1).read(s.runner,s.job,0).gain,0);
 assert.equal(read(()=>0).read(s.runner,s.job,4).gain,hold.gain);
 assert.deepEqual(s.players,before);
 for(const p of s.players.filter(p=>p.side===1))Object.assign(p,{x:s.runner.x+.5,y:s.runner.y,vx:s.runner.pace,vy:0});
 assert(read(()=>0).read(s.runner,s.job,0).gain<open.gain,'A defender able to meet the reception reduces its value');
});
test('a second pass earns value only for an opening the first recipient actually adds',()=>{
 const s=scene(),pivot=s.players[3];Object.assign(pivot,{x:21,y:-6});Object.assign(s.runner,{x:29,y:6});
 const hold=p=>({...s.job,player:p.id,kind:'support',aim:{x:p.x,y:p.y}});
 const blocked=(from,to)=>from.x===s.carrier.x&&to.y>0?.9:0;
 const read=attackingSpaceReader(s.players,s.carrier,s.tactics,blocked),a=read.read(pivot,hold(pivot),0),b=read.read(s.runner,hold(s.runner),0);
 assert(read.connection(a,b)>0);
 const open=attackingSpaceReader(s.players,s.carrier,s.tactics,()=>0);
 assert.equal(open.connection(open.read(pivot,hold(pivot),0),open.read(s.runner,hold(s.runner),0)),0,'An unnecessary extra pass has no opening credit');
 assert.equal(read.connection({...a,access:0},b),0,'An unreachable intermediary cannot open the attack');
});
test('attacking value mirrors and does not depend on calling the movement a run',()=>{
 const s=scene(),read=attackingSpaceReader(s.players,s.carrier,s.tactics,()=>0),a=read.read(s.runner,s.job,0);
 assert.equal(read.read(s.runner,{...s.job,kind:'support',purpose:'outlet'},0).gain,a.gain);
 assert.equal(read.read(s.runner,{...s.job,kind:'support',purpose:'outlet'},0).development,a.development);
 const ps=s.players.map(p=>({...p,side:1-p.side,x:48-p.x,vx:-p.vx,angle:Math.PI-p.angle}));
 const b=attackingSpaceReader(ps,ps[2],s.tactics,()=>0).read(ps[4],{...s.job,aim:{x:48-s.job.aim.x,y:s.job.aim.y}},0);
 assert(Math.abs(a.gain-b.gain)<1e-9);assert(Math.abs(a.point.x+b.point.x-48)<1e-9);
 assert(Math.abs(a.development-b.development)<1e-9);
});
test('joining an attack has purpose before a forward reception is available, with role and tactical priorities',()=>{
 const s=scene();Object.assign(s.carrier,{x:28});Object.assign(s.runner,{x:14,y:5});
 const job={...s.job,aim:{x:25,y:5}},read=(p,t=s.tactics)=>attackingSpaceReader(s.players,s.carrier,t,()=>1).read(p,job,0);
 const forward=read({...s.runner,role:'ST'}),back=read({...s.runner,role:'CB'});
 assert.equal(forward.gain,0,'Preparation must not be reported as an available pass');
 assert(forward.development>0,'Catching up into connected space is useful even while behind the carrier');
 assert(forward.development>back.development,'Becoming an attacking threat is a stronger default priority for the forward');
 // (recon 2026-10-16, finding 16) one check changed two settings at once, so either could be inert; each in its own direction:
 const dev=over=>read({...s.runner,role:'ST'},{...s.tactics,...over}).development;
 assert(dev({striker:'link'})<dev({striker:'mixed'})&&dev({striker:'mixed'})<dev({striker:'run'}),'Striker: Drops deep < Mixed < In behind');
 assert(dev({progression:'patient'})<dev({progression:'mixed'})&&dev({progression:'mixed'})<dev({progression:'direct'}),'Progression: Patient < Mixed < Direct');
 assert(dev({commit:2})<dev({commit:3})&&dev({commit:3})<dev({commit:4}),'Bodies forward: more bodies, more ambition');
 const hold=attackingSpaceReader(s.players,s.carrier,s.tactics,()=>1).read(s.runner,{...job,aim:{x:s.runner.x,y:s.runner.y}},0);
 assert.equal(hold.development,0,'Standing still must not claim preparation progress');
 assert.equal(attackingSpaceReader(s.players,s.carrier,s.tactics,()=>1).read(s.runner,job,job.until).development,0);
});
test('preparation values connected space rather than movement into a marker or away from the attack',()=>{
 const s=scene();Object.assign(s.runner,{x:18,y:5});
 const job={...s.job,aim:{x:26,y:5}},read=()=>attackingSpaceReader(s.players,s.carrier,s.tactics,()=>0).read(s.runner,job,0);
 const open=read().development;assert(open>0);
 Object.assign(s.players[6],{x:22,y:5});
 assert(read().development<open,'A marker occupying the route reduces its preparatory value');
 const away=attackingSpaceReader(s.players,s.carrier,s.tactics,()=>0).read(s.runner,{...job,aim:{x:5,y:13}},0);
 assert(away.development<open,'Distance travelled is not itself a benefit');
});
