// Engine speed (2026-10-19): the byte-identical speed-ups against the code they replaced, bit for bit (Object.is on
// every number) over many random inputs. If one of these fails, a speed-up has started to change football.
import test from 'node:test';
import assert from 'node:assert/strict';
import {steerMotion,STEP} from '../dist/movement.js';
import {advanceFlight,previewGap} from '../dist/practice-flight.js';
import {leadForecast} from '../dist/practice-control.js';
import {laneRisk} from '../dist/practice.js';
import {readNoise} from '../dist/practice-perception.js';
import {clamp,rng} from '../dist/model.js';

const same=(a,b,what)=>assert.ok(Object.is(a,b),`${what}: ${a} vs ${b}`);

// previewGap before the speed-up: a copied player steered with steerMotion each tick
function previewGapBefore(p,point,reaction){
 const delay=Math.min(reaction,point.time),preview={...p,side:p.side??0,role:p.role??'',x:p.x+p.vx*delay,y:p.y+p.vy*delay};
 for(let time=delay;time<point.time-1e-9;time+=STEP)steerMotion(preview,point,Math.min(STEP,point.time-time),p.pace);
 return Math.hypot(preview.x-point.x,preview.y-point.y);
}
// laneRisk before the speed-up
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
function laneRiskBefore(from,to,defenders,speed=16,delay=0){
 const dx=to.x-from.x,dy=to.y-from.y,d2=dx*dx+dy*dy;if(d2<1)return 1;
 const length=Math.sqrt(d2);let risk=0;
 for(const p of defenders){
  const projection=clamp(((p.x-from.x)*dx+(p.y-from.y)*dy)/d2,.06,1);
  for(const t of [projection,Math.min(1,projection+.15)]){
   const flight=length*t/speed,available=Math.max(0,flight+delay-.22),point={x:from.x+dx*t,y:from.y+dy*t};
   const delta=unit(point.x-p.x,point.y-p.y),towards=p.vx*delta.x+p.vy*delta.y;
   const reach=Math.max(0,Math.min(p.pace*available,towards*available+.5*p.acceleration*available*available));
   risk=Math.max(risk,clamp((reach+1.1-Math.hypot(point.x-p.x,point.y-p.y))/2,0,1));
  }
 }
 return risk;
}

test('previewGap is the steerMotion run it replaced, to the last bit',()=>{
 const r=rng(20261019);
 for(let i=0;i<20000;i++){
  const p={id:'0:a',x:r()*48,y:(r()-.5)*30,vx:(r()-.5)*14,vy:(r()-.5)*14,pace:4+r()*4,acceleration:2+r()*4,angle:0,name:'',number:1,job:''};
  if(i%7===0){p.vx=0;p.vy=0;}
  const point={x:p.x+(r()-.5)*(i%5===0?.3:20),y:p.y+(r()-.5)*(i%5===0?.3:20),z:0,vx:0,vy:0,vz:0,time:i%11===0?0:r()*3};
  if(i%13===0){point.x=p.x;point.y=p.y;}
  const reaction=i%3===0?0:r()*.4;
  same(previewGap(p,point,reaction),previewGapBefore(p,point,reaction),`case ${i}`);
 }
});

test('the receiving forecasts are advanceFlight({...ball}, lead), shared or not',()=>{
 const r=rng(7);
 for(let i=0;i<3000;i++){
  const ball={x:r()*48,y:(r()-.5)*30,z:i%4===0?0:r()*2,vx:(r()-.5)*24,vy:(r()-.5)*24,vz:i%4===0?0:(r()-.5)*8,owner:null,mode:'pass'};
  if(i%17===0){ball.vx=0;ball.vy=1e-4;}
  // several players read the same ball with different horizons, then a different ball, then the first again
  for(const horizon of [.38,.22,.3,.38]){
   for(let lead=0,index=0;lead<=horizon+1e-8;lead+=.02,index++){
    const expected=advanceFlight({...ball},lead),got=leadForecast(ball,index,lead);
    for(const k of ['x','y','z','vx','vy','vz'])same(got[k],expected[k],`ball ${i} lead ${lead} ${k}`);
    if(r()<.1)break;// a reader who found his touch early
   }
  }
 }
 // out of order and non-grid leads fall back to the plain call
 const ball={x:10,y:2,z:.4,vx:9,vy:-3,vz:1,owner:null,mode:'pass'};
 for(const [index,lead] of [[5,.1],[0,0],[3,.06],[2,.5],[1,STEP],[1,STEP+5e-10]]){
  const expected=advanceFlight({...ball},lead),got=leadForecast(ball,index,lead);
  for(const k of ['x','y','z','vx','vy','vz'])same(got[k],expected[k],`lead ${lead} ${k}`);
 }
});

test('laneRisk on scalars is the laneRisk it replaced, to the last bit',()=>{
 const r=rng(99);
 for(let i=0;i<20000;i++){
  const from={x:r()*48,y:(r()-.5)*30},to={x:r()*48,y:(r()-.5)*30};
  if(i%50===0){to.x=from.x+.3;to.y=from.y;}
  const defenders=Array.from({length:1+Math.floor(r()*5)},()=>({x:r()*48,y:(r()-.5)*30,vx:(r()-.5)*12,vy:(r()-.5)*12,pace:4+r()*4,acceleration:2+r()*4}));
  if(i%9===0){defenders[0].x=from.x+(to.x-from.x)*.5;defenders[0].y=from.y+(to.y-from.y)*.5;}// on the lane
  const speed=i%4===0?undefined:8+r()*16,delay=i%3===0?undefined:r()*.5;
  same(laneRisk(from,to,defenders,speed,delay),laneRiskBefore(from,to,defenders,speed,delay),`case ${i}`);
 }
});

test('readNoise keeps one value per player, read and salt, side prefixes stripped as before',()=>{
 const at={x:20,y:5};
 for(const salt of ['', '0:x', 'room1:y', 'a0:b']){
  same(readNoise({id:'0:p',side:0},'lane',at,3,salt),readNoise({id:'1:p',side:0},'lane',at,3,salt.replace(/(^|[^0-9A-Za-z])[01]:/g,'$1')),salt);
  same(readNoise({id:'0:p',side:1},'lane',at,undefined,salt),readNoise({id:'0:p',side:1},'lane',at,undefined,salt),salt+' again');
 }
});
