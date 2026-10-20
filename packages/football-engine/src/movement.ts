import { clamp, rng } from './model.js';
import {WORLD} from './world.js';
/** Hot-path aliases (engine as data W9b): world reads used inside this file's functions, read once at load. */
const MOTION_STEER_ARRIVAL_RADIUS=WORLD.motion.steer.arrivalRadius.v;
const MOTION_STEER_FACE_FROM=WORLD.motion.steer.faceFrom.v;
const MOTION_STEER_SEPARATION=WORLD.motion.steer.separation.v;
const MOTION_STEER_SEPARATION_GAIN=WORLD.motion.steer.separationGain.v;
const MOTION_STEER_TURN_RATE=WORLD.motion.steer.turnRate.v;
const MOTION_STEER_TURN_RATE_BACK=WORLD.motion.steer.turnRateBack.v;

// A bounded movement experiment, in metres and seconds. It is not the full-match resolver.
export const STEP = 1/WORLD.clock.sim.ticksPerSecond.v;
export type Cover = 'track' | 'step';
export interface Vec {x:number;y:number}
export interface MovingPlayer extends Vec {
  id:string;name:string;number:number;side:0|1;role:string;
  vx:number;vy:number;angle:number;pace:number;acceleration:number;job:string;
}
export interface MovingBall extends Vec {vx:number;vy:number;z:number;vz:number;owner:string|null;mode:'control'|'pass'|'shot'|'loose'}
export interface MovementEvent {time:number;kind:'start'|'prepare'|'pass'|'receive'|'run'|'shot'|'goal'|'save'|'interception'|'out'|'end';text:string;actor?:string;target?:string}
export interface MovementFrame {time:number;players:MovingPlayer[];ball:MovingBall;event:number;score:number;phase:string}
export interface MovementResult {seed:number;cover:Cover;duration:number;frames:MovementFrame[];events:MovementEvent[];outcome:string;releaseGap:number|null;offside:boolean}
export const magnitude=(p:Vec)=>Math.hypot(p.x,p.y);
const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDiff=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const unit=(p:Vec):Vec=>{const d=magnitude(p);return d?{x:p.x/d,y:p.y/d}:{x:0,y:0};};
const noNeighbours:MovingPlayer[]=[],stationaryTarget:Vec={x:0,y:0};
/** Shared physical steering; forecasts can omit the unused visual orientation update. */
export function steerMotion(p:MovingPlayer,target:Vec,dt:number,limit=p.pace,neighbours:MovingPlayer[]=noNeighbours,targetVelocity:Vec=stationaryTarget,arrivalRadius=MOTION_STEER_ARRIVAL_RADIUS) {
  const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy);
  const directionX=distance?dx/distance:0,directionY=distance?dy/distance:0;
  // Arrive under braking rather than crossing the target and snapping back.
  const speed=Math.min(limit,Math.sqrt(2*p.acceleration*Math.max(0,distance-arrivalRadius)));
  // Moving targets require matching their velocity, not braking to a standstill behind them.
  let desiredX=targetVelocity.x+directionX*speed,desiredY=targetVelocity.y+directionY*speed;
  for(const q of neighbours){if(q.id===p.id)continue;const d=dist(p,q);if(d>0&&d<MOTION_STEER_SEPARATION){const strength=(MOTION_STEER_SEPARATION-d)*MOTION_STEER_SEPARATION_GAIN;desiredX+=(p.x-q.x)/d*strength;desiredY+=(p.y-q.y)/d*strength;}}
  const length=Math.hypot(desiredX,desiredY);if(length>limit){desiredX*=limit/length;desiredY*=limit/length;}
  const dvx=desiredX-p.vx,dvy=desiredY-p.vy,change=Math.hypot(dvx,dvy),factor=Math.min(1,p.acceleration*dt/Math.max(change,.00001));
  p.vx+=dvx*factor;p.vy+=dvy*factor;p.x+=p.vx*dt;p.y+=p.vy*dt;
}
export function steer(p:MovingPlayer,target:Vec,dt:number,limit=p.pace,neighbours:MovingPlayer[]=noNeighbours,targetVelocity:Vec=stationaryTarget) {
  steerMotion(p,target,dt,limit,neighbours,targetVelocity);
  const aim=Math.atan2(p.vy,p.vx);if(Math.hypot(p.vx,p.vy)>MOTION_STEER_FACE_FROM)p.angle+=clamp(angleDiff(aim,p.angle),MOTION_STEER_TURN_RATE_BACK*dt,MOTION_STEER_TURN_RATE*dt);
}
// Relative swept-segment collision catches a fast ball even between two ticks.
export function contact(a:Vec,b:Vec,oldPlayer:Vec,newPlayer:Vec,radius:number):number|null {
  const start={x:a.x-oldPlayer.x,y:a.y-oldPlayer.y},end={x:b.x-newPlayer.x,y:b.y-newPlayer.y};
  const v={x:end.x-start.x,y:end.y-start.y},v2=v.x*v.x+v.y*v.y;
  const c=start.x*start.x+start.y*start.y-radius*radius;
  if(c<=0)return 0;
  if(v2<1e-10)return null;
  const d=start.x*v.x+start.y*v.y,disc=d*d-v2*c;if(disc<0)return null;
  const fraction=(-d-Math.sqrt(disc))/v2;return fraction>=0&&fraction<=1?fraction:null;
}
export function movementCast():MovingPlayer[]{
  const rows:[string,string,string,number,number][]=[
    ['keeper','Mircea Portărescu','GK',6,0],['leftback','Moto Cross','FB',42,-27],['back1','Flavius Copac','CB',34,-8],['back2','Radu Felinul','CB',34,9],['rightback','Motănescu','FB',44,27],
    ['pivot','Crocodinho','DM',47,0],['maker','Van Pisi','CM',58,-12],['right','Golusor Dan','CM',54,14],['wing','Vali Bulan','W',70,-26],['runner','Fleașcă','ST',75,-3],['farwing','Codrin Țâf','W',71,25],
    ['aKeeper','Doru Mănușă','GK',100,0],['fullback','Toni Bordură','FB',77,-25],['marker','Dorel Beton','CB',81,-7],['cover','Gică Placă','CB',82,9],['aRightback','Paul Tencuială','FB',78,24],
    ['screen','Adi Părere','DM',68,1],['presser','Mihai Mortar','CM',65,-3],['aRight','Costel Var','CM',62,15],['aWing','Nelu Diblul','W',53,-27],['aStriker','Sandu Șurub','ST',46,-7],['aFarwing','Dani Rigips','W',53,27],
  ];
  return rows.map(([id,name,role,x,y],i)=>({id,name,role,x,y,number:i%11+1,side:i<11?0:1,vx:0,vy:0,angle:i<11?0:Math.PI,pace:role==='GK'?5.4:id==='runner'?7.5:6.8,acceleration:4.6,job:'Păstrează forma'}));
}
export function simulateMovement(seed=2026,cover:Cover='step'):MovementResult {
  const random=rng(seed),players=movementCast(),byId=new Map(players.map(p=>[p.id,p])),get=(id:string)=>byId.get(id)!;
  const initial=new Map(players.map(p=>[p.id,{x:p.x,y:p.y}]));
  const events:MovementEvent[]=[],frames:MovementFrame[]=[];
  let time=0,score=0,outcome='',endAt=25,receivedAt=0,stage=0,preparedAt=-1,releaseAt=-1,releaseBy='',intended='',runAt=Infinity,shotAt=Infinity,releaseGap:number|null=null,offside=false;
  let ball:MovingBall={x:47.7,y:0,vx:0,vy:0,z:0,vz:0,owner:'pivot',mode:'control'};
  const plan=['pivot','right','pivot','maker','wing','maker','runner'];
  const say=(kind:MovementEvent['kind'],text:string,actor?:string,target?:string)=>events.push({time,kind,text,actor,target});
  say('start','Crocodinho începe construcția. Van Pisi caută loc între linii.','pivot');
  const end=(kind:MovementEvent['kind'],text:string,actor?:string)=>{if(outcome)return;outcome=kind;endAt=Math.min(25,time+2.4);say(kind,text,actor);};
  const frame=()=>frames.push({time,players:players.map(p=>({...p})),ball:{...ball},event:events.length-1,score,phase:outcome?'Faza s-a încheiat':ball.mode==='shot'?'Șut':ball.owner?'Construcție':'Mingea circulă'});
  frame();
  for(let tick=1;tick<=25/STEP;tick++){
    time=tick*STEP;
    const old=new Map(players.map(p=>[p.id,{x:p.x,y:p.y}]));
    const owner=ball.owner?get(ball.owner):null;
    if(stage>=5&&runAt===Infinity&&!outcome){runAt=time;say('run','Fleașcă schimbă ritmul și atacă spațiul. Van Pisi ridică privirea.','runner');}
    // Perception is delayed: a defender follows where he has seen a run, not its future endpoint.
    const past=frames[Math.max(0,frames.length-1-Math.round(.24*30))];
    const seenRunner=past?.players.find(p=>p.id==='runner')??get('runner');
    for(const p of players){
      const home=initial.get(p.id)!;let target:Vec={...home},limit=3.4;p.job='Păstrează forma';
      const advance=clamp((ball.x-47)*.28,0,12);
      if(p.side===0){
        target.x+=advance;
        if(p.id==='pivot'){target={x:50+Math.min(stage,3)*1.2,y:stage>=2?1:-1};}
        if(p.id==='right'){target={x:57+Math.min(stage,2),y:14};}
        if(p.id==='maker'){target={x:stage>=4?72:stage>=3?66:60,y:stage>=4?-13:-11};p.job='Se oferă la pasă';}
        if(p.id==='wing'){target={x:stage>=4?77:72,y:-26};p.job='Ține lățimea';}
        if(p.id==='runner'){
          if(time>=runAt){target={x:96,y:1};limit=p.pace;p.job='Atacă spațiul';}
          else {target={x:76+Math.sin(time*.45)*1.2,y:-2+Math.sin(time*.6)};limit=2.8;p.job='Pregătește cursa';}
        }
        if(ball.mode==='pass'&&intended===p.id&&time-releaseAt>.12){
          let intercept={x:ball.x+ball.vx*.5,y:ball.y+ball.vy*.5};
          for(let lead=.1;lead<=2.5;lead+=.1){const point={x:ball.x+ball.vx*lead,y:ball.y+ball.vy*lead};if(dist(p,point)<p.pace*lead*.9){intercept=point;break;}}
          target=intercept;limit=p.pace;p.job='Ajustează cursa la minge';
        }
        if(p.id==='farwing'){target={x:78+advance*.4,y:20};p.job='Atacă bara a doua';}
        if(p.role==='GK'){target={x:16,y:clamp(ball.y*.15,-7,7)};limit=2;}
      }else{
        const shift=clamp((ball.x-47)*.12,0,7);target.x+=shift;target.y+=ball.y*.06;
        if(p.id==='presser'){
          const relevant=owner&&['maker','wing'].includes(owner.id);
          target=relevant?{x:owner.x+.6,y:owner.y+1}:{x:65+shift,y:-3+ball.y*.12};
          limit=relevant?5.3:2.8;p.job=relevant?'Închide purtătorul':'Închide culoarul';
        }
        if(p.id==='fullback'){const winger=get('wing');target={x:winger.x+3.4,y:winger.y+1.7};limit=4.2;p.job='Urmărește extrema';}
        if(p.id==='marker'){
          if(time>=runAt){
            target=cover==='track'?{x:Math.max(p.x,seenRunner.x+1.5+Math.max(0,seenRunner.vx)*.45),y:seenRunner.y-.4}:{x:get('maker').x+1,y:get('maker').y};
            if(cover==='track'&&owner?.id==='runner')target={x:owner.x+.15,y:owner.y};
            limit=p.pace;p.job=cover==='track'?'Urmărește cursa':'Iese la pasator';
          }else {target={x:82+shift*.15,y:-6};limit=2;p.job='Acoperă adâncimea';}
        }
        if(p.id==='cover'){target={x:84+shift*.6,y:5+ball.y*.1};limit=3.4;p.job='Acoperă centrul';}
        if(p.id==='screen'){target={x:68+shift,y:2+ball.y*.2};limit=3.6;p.job='Protejează centrul';}
        if(p.role==='GK'){
          target={x:100-clamp((ball.x-80)*.06,0,1),y:clamp(ball.y*.18,-3.1,3.1)};limit=3.1;p.job='Închide unghiul';
          if(ball.mode==='shot'&&time-shotAt>.23){const remaining=Math.max(0,(p.x-ball.x)/Math.max(1,ball.vx));target={x:p.x-.5,y:clamp(ball.y+ball.vy*remaining,-5,5)};limit=p.pace;p.job='Intervine la șut';}
        }
      }
      if(owner?.id===p.id){
        limit=p.id==='runner'?5.4:1.65;
        if(p.id==='runner')target={x:92,y:-5};
        else target={x:p.x+.6,y:p.y};
        if(preparedAt>=0||time-receivedAt<.45){target={x:p.x,y:p.y};limit=0;}
        p.job=preparedAt>=0?'Pregătește lovitura':time-receivedAt<.45?'Preia mingea':'Conduce mingea';
      }
      if(outcome){target={x:p.x,y:p.y};limit=0;p.job='Faza s-a încheiat';}
      const challenging=owner&&p.side!==owner.side&&(p.job==='Închide purtătorul'||(p.id==='marker'&&cover==='track'&&owner.id==='runner'));
      steer(p,target,STEP,limit,challenging?players.filter(q=>q.side===p.side):players);
      if((owner?.id===p.id&&preparedAt>=0)||Math.hypot(p.vx,p.vy)<.3){
        const aim=owner?.id===p.id&&stage<plan.length-1?get(plan[stage+1]):ball;
        p.angle+=clamp(angleDiff(Math.atan2(aim.y-p.y,aim.x-p.x),p.angle),-4*STEP,4*STEP);
      }
    }
    if(!outcome&&ball.owner){
      const p=get(ball.owner),hold=time-receivedAt;
      const step=.65+Math.sin(hold*9)*.13;
      ball.x=p.x+Math.cos(p.angle)*step;ball.y=p.y+Math.sin(p.angle)*step;ball.vx=p.vx;ball.vy=p.vy;
      // A dribbler can lose the ball to a defender who physically gets close.
      const tackler=players.filter(q=>q.side!==p.side&&q.role!=='GK'&&dist(q,ball)<.8).sort((a,b)=>dist(a,ball)-dist(b,ball))[0];
      if(tackler&&hold>.5){ball.owner=tackler.id;end('interception',`${tackler.name} ajunge la minge. Atacul se oprește aici.`,tackler.id);}
      else if(p.side===0){
        const pressure=Math.min(...players.filter(q=>q.side!==p.side).map(q=>dist(q,p)));
        const ready=stage===plan.length-1?hold>.65&&p.x>=87:hold>(pressure<3.5?.5:stage<3?2.0:1.15);
        if(ready&&preparedAt<0){preparedAt=time;say('prepare',stage===plan.length-1?`${p.name} își așază mingea pentru șut…`:`${p.name} se deschide pentru pasă…`,p.id);}
        if(preparedAt>=0&&time-preparedAt>.4){
          const shooting=stage===plan.length-1,target=shooting?null:get(plan[stage+1]);
          let aim:Vec;
          if(shooting){
            const nearest=Math.min(...players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>dist(q,p)));
            const pressure=clamp((3.5-nearest)/3.5,0,1);
            aim={x:106,y:(random()<.5?-1:1)*(1.8+random()*2.3+pressure*1.6)};shotAt=time;
          }
          else {
            const through=target!.id==='runner',flight=dist(p,target!)/14;
            aim=through?{x:target!.x+target!.vx*(flight+.25)+2,y:target!.y+target!.vy*flight}:{x:target!.x+target!.vx*flight*.6,y:target!.y+target!.vy*flight*.6};
            aim.y+=(random()-.5)*.45;aim.x=clamp(aim.x,1,101);
            if(through){releaseGap=dist(get('marker'),target!);const line=players.filter(q=>q.side===1).map(q=>q.x).sort((a,b)=>b-a)[1];offside=target!.x>Math.max(52.5,p.x,line);}
          }
          const direction=unit({x:aim.x-ball.x,y:aim.y-ball.y});
          ball={...ball,vx:direction.x*(shooting?25:14.5),vy:direction.y*(shooting?25:14.5),owner:null,mode:shooting?'shot':'pass',z:shooting?.2:0,vz:shooting?2:0};
          releaseAt=time;releaseBy=p.id;intended=target?.id??'';preparedAt=-1;
          say(shooting?'shot':'pass',shooting?`${p.name} lovește spre colțul porții!`:target!.id==='runner'?`${p.name} trimite în fața lui ${target!.name}. Cursa continuă!`:`${p.name} pasează către ${target!.name}.`,p.id,target?.id);
          if(offside)end('out','Fleașcă plecase dincolo de ultimul apărător. Fanionul se ridică.','runner');
        }
      }
    }else if(!outcome){
      const before={x:ball.x,y:ball.y};ball.x+=ball.vx*STEP;ball.y+=ball.vy*STEP;
      const speed=Math.hypot(ball.vx,ball.vy),friction=ball.z>.01?0:.6,factor=Math.max(0,speed-friction*STEP)/Math.max(.001,speed);ball.vx*=factor;ball.vy*=factor;
      ball.z=Math.max(0,ball.z+ball.vz*STEP);ball.vz-=9.81*STEP;if(ball.z===0)ball.vz=Math.abs(ball.vz)>.8?-ball.vz*.16:0;
      const contacts=players.flatMap(p=>{
        if(p.id===releaseBy&&time-releaseAt<.35)return [];
        if(ball.z>(p.role==='GK'?2.3:1.2))return [];
        const keeper=p.role==='GK'&&ball.mode==='shot';
        const radius=keeper?(time-shotAt>.23?1.25:.6):p.side===0?1.0:.72;
        const t=contact(before,ball,old.get(p.id)!,p,radius);return t===null?[]:[{p,t}];
      }).sort((a,b)=>a.t-b.t);
      const hit=contacts[0];
      if(hit){
        const p=hit.p;
        // Resolve at the physical contact, not by moving the receiver to the aim point.
        ball.x=before.x+(ball.x-before.x)*hit.t;ball.y=before.y+(ball.y-before.y)*hit.t;ball.owner=p.id;ball.vx=p.vx;ball.vy=p.vy;ball.z=0;ball.vz=0;
        if(p.side===1){const saved=ball.mode==='shot'&&p.role==='GK';end(saved?'save':'interception',saved?`${p.name} închide colțul și oprește șutul.`:`${p.name} taie traiectoria. Mingea e a lui Inter Beton.`,p.id);ball.mode='control';}
        else {ball.mode='control';receivedAt=time;preparedAt=-1;const next=plan.indexOf(p.id,stage+1);if(next>=0)stage=next;say('receive',`${p.name} preia și își întoarce corpul spre joc.`,p.id);}
      }else if(ball.x>105){if(Math.abs(ball.y)<3.66&&ball.z<2.44&&ball.mode==='shot'){score=1;end('goal','GOOOL! Fleașcă găsește colțul. Pe margine, Vali revendică jumătate din gol.','runner');}else end('out','Mingea trece pe lângă poartă. Se aude un oftat de pe margine.');}
      else if(ball.x<0||Math.abs(ball.y)>34)end('out','Mingea iese din teren. Faza se încheie.');
      else if(time-releaseAt>4.5)end('out','Pasa se duce prea departe. Apărarea închide spațiul.');
    }
    if(tick%2===0||time>=endAt)frame();
    if(time>=endAt)break;
  }
  if(!outcome){outcome='end';say('end','Apărarea ține forma. Fereastra de atac s-a închis.');frame();}
  return {seed,cover,duration:time,frames,events,outcome,releaseGap,offside};
}
export function sampleMovement(result:MovementResult,time:number):MovementFrame {
  const t=clamp(time,0,result.duration),i=Math.min(result.frames.length-1,Math.floor(t*30)),a=result.frames[i],b=result.frames[Math.min(i+1,result.frames.length-1)];
  if(t>=result.duration)return result.frames.at(-1)!;
  const f=clamp((t-a.time)/Math.max(.0001,b.time-a.time),0,1),lerp=(x:number,y:number)=>x+(y-x)*f;
  return {...a,time:t,players:a.players.map((p,i)=>({...p,x:lerp(p.x,b.players[i].x),y:lerp(p.y,b.players[i].y),angle:p.angle+angleDiff(b.players[i].angle,p.angle)*f})),ball:{...a.ball,x:lerp(a.ball.x,b.ball.x),y:lerp(a.ball.y,b.ball.y),z:lerp(a.ball.z,b.ball.z)}};
}
