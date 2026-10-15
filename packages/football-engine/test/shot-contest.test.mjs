import test from 'node:test';
import assert from 'node:assert/strict';
import {shotContest,shotTemper} from '../dist/practice-shot-contest.js';
import {placeHurried} from '../dist/practice-football.js';

// (contest: pressure on the shooter, 2026-10-15) The defence acts on the shot itself: a man arriving, a body hiding
// the goal, a man on the shoulder. The shooter's finishing and composure resist it; his composure and daring set how
// he reads it. A free shot is unchanged.
const skills={passing:6,control:6,finishing:6,defending:6,pace:6,strength:6,stamina:6,reading:6,aerial:6,setPieces:6,keeping:1};
const traits={risk:.45,runs:.5,dribble:.5,comesShort:.5,engagement:.55,discipline:.83,audacity:0};
const man=(id,side,x,y,o={})=>({id,side,role:o.role??'CM',x,y,vx:o.vx??0,vy:o.vy??0,angle:0,pace:6.85,basePace:6.85,acceleration:4.8,
 skills:{...skills,...o.skills},traits:{...traits,...o.traits},energy:100});
const keeper=man('1:gk',1,47.2,0,{role:'GK'});
const shooter=(o)=>man('0:s',0,38,1,o);
const aim={x:48,y:-1.8};

test('time, angle and balance each rush the shot; a free shot is not hurried at all',()=>{
 const s=shooter();
 const free=shotContest(s,[s,keeper,man('1:d',1,30,6)],aim);
 assert.equal(free.hurry,0);
 // the same 3 m: standing off him, or sprinting in at 5 m/s (as near as a man standing at 1.75 m)
 const standing=shotContest(s,[s,keeper,man('1:d',1,38,4)],aim),arriving=shotContest(s,[s,keeper,man('1:d',1,38,4,{vy:-5})],aim);
 const at175=shotContest(s,[s,keeper,man('1:d',1,38,2.75)],aim);
 assert.ok(standing.rush===0&&Math.abs(arriving.rush-at175.rush)<1e-9&&arriving.rush>.35,`arriving rushes it: ${standing.rush} -> ${arriving.rush}`);
 // a body 2 m in front of the ball hides more than half the goal from it
 const lane=shotContest(s,[s,keeper,man('1:d',1,40.2,.4)],aim);
 assert.ok(lane.shadow>.5,`shadow ${lane.shadow}`);
 // a man on his shoulder
 const tight=shotContest(s,[s,keeper,man('1:d',1,37.7,1.4)],aim);
 assert.ok(tight.balance>.9&&tight.offBalance>0);
 // a sharp reader sees it coming and closes sooner; a good defender hides more of the goal
 const slow=shotContest(s,[s,keeper,man('1:d',1,38,3,{skills:{reading:3}})],aim),sharp=shotContest(s,[s,keeper,man('1:d',1,38,3,{skills:{reading:9}})],aim);
 assert.ok(sharp.rush>slow.rush);
 const poor=shotContest(s,[s,keeper,man('1:d',1,41.5,2,{skills:{defending:3}})],aim),good=shotContest(s,[s,keeper,man('1:d',1,41.5,2,{skills:{defending:9}})],aim);
 assert.ok(good.shadow>poor.shadow);
});

test('finishing and composure resist the pressure; temperament sets the choice, not the read',()=>{
 const d=man('1:d',1,38,3.6,{vy:-4});
 const weak=shooter({skills:{finishing:3},traits:{discipline:.5}}),cool=shooter({skills:{finishing:9},traits:{discipline:.97}});
 const a=shotContest(weak,[weak,keeper,d],aim),b=shotContest(cool,[cool,keeper,d],aim);
 assert.equal(a.pressure,b.pressure);
 assert.ok(b.hurry<a.hurry*.8,`${a.hurry} -> ${b.hurry}`);
 // (shot decision) temperament acts on the choice, never the read: a daring man leans to the shot anywhere; with a man
 // on him a nervous one leans away from it; a composed one has no lean of his own, pressed or not (shot fix: the nerve
 // term used to lean him, and a daring man, towards the pressed shot); a typical man has no lean
 const composed=shooter({traits:{discipline:.97},skills:{reading:8}}),nervous=shooter({traits:{discipline:.5},skills:{reading:5}}),daring=shooter({traits:{risk:.9,audacity:.8}});
 assert.ok(shotTemper(daring,0)>.1&&shotTemper(nervous,1)<shotTemper(nervous,0));
 assert.equal(shotTemper(composed,1),shotTemper(composed,0),'the press gives a composed man no lean');
 assert.equal(shotTemper(daring,1),shotTemper(daring,0),'nor a daring one: his appetite is the same anywhere');
 assert.ok(Math.abs(shotTemper(shooter(),0))<.01&&Math.abs(shotTemper(shooter(),1))<.02);
 // a hurried shot is placed nearer the keeper, never wider
 const placed=placeHurried(aim,keeper,a.hurry);
 assert.ok(Math.abs(placed.y-keeper.y)<Math.abs(aim.y-keeper.y)&&Math.abs(placed.y)<=Math.abs(aim.y));
});

test('what the hurry costs his shot is his read: a good reader sees most of it, a poor one underestimates it',async()=>{
 const {hurryCost,hurryTruth}=await import('../dist/practice-shot-contest.js');
 // the same shooter (the same misreads' pattern), the same pressure, over many places and moments; only his reading differs
 const reader=(reading,finishing)=>shooter({skills:{reading,finishing}});
 const reads=(p,h=.8)=>{const out=[];for(let x=34;x<=42;x+=1)for(let y=-6;y<=6;y+=1.5)for(let t=0;t<30;t+=3.7)out.push(hurryCost({...p,x,y},h,{x,y},t)/hurryTruth(h));return out;};
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,sd=a=>Math.sqrt(mean(a.map(v=>(v-mean(a))**2)));
 const perfect=reads(reader(10,10)),good=reads(reader(8,7)),poor=reads(reader(3,3));
 assert.ok(mean(perfect)>.95,`a perfect reader sees all of it (${mean(perfect).toFixed(2)})`);
 // (shot fix) the owner: "a good reader sees nearly all of it"; a poor one still clearly underestimates it
 assert.ok(mean(good)>.85,`a good reader sees nearly all of it (${mean(good).toFixed(2)})`);
 assert.ok(mean(poor)<.65&&poor.filter(v=>v<1).length/poor.length>.8,`a poor reader mostly underestimates it (${mean(poor).toFixed(2)})`);
 assert.ok(sd(poor)>sd(good)*1.5,`and less reliably (sd ${sd(poor).toFixed(2)} v ${sd(good).toFixed(2)})`);
 assert.equal(hurryCost(reader(3,3),0,{x:38,y:1},5),0,'a free shot costs nothing, whoever reads it');
 // (shot fix) the cost grows faster than the hurry: a lightly hurried chance keeps nearly all of it, so a decent
 // chance with nobody on him is not passed up; a man on top of him (full hurry) takes most of it
 assert.ok(mean(reads(reader(6,6),.2).map(v=>v*hurryTruth(.2)))<.06,'a light hurry costs a typical reader little');
 assert.ok(hurryTruth(1)>2*hurryTruth(.5),'a full hurry costs more than twice a half one');
});
