import {L,W} from './pitch.js';
import {clamp,rng} from './model.js';
import {STEP, contact, steer, movementCast, Cover, Vec, MovingPlayer, MovingBall, MovementEvent, MovementFrame, MovementResult} from './movement.js';
import {WORLD} from './world.js';

export interface DecisionConfig {
  seed:number;cover:Cover;striker:'channels'|'feet';passer:'inventive'|'careful';
  makerSkill?:number;energy?:number;maxSeconds?:number;
}
export const DEFAULT_DECISIONS:DecisionConfig={seed:2026,cover:'track',striker:'feet',passer:'inventive'};
export type Action='carry'|'pass'|'through'|'shoot';
export interface Option {kind:Action;target?:string;aim:Vec;score:number;risk:number;reason:string}
export interface Decision {time:number;actor:string;kind:string;target?:string;reason:string;options?:{kind:Action;target?:string;score:number;risk:number}[]}
export interface DecisionResult extends MovementResult {config:DecisionConfig;decisions:Decision[];metrics:{passes:number;through:number;shots:number;carries:number;runSeconds:number;showSeconds:number;attackDepth:number}}
interface Profile {risk:number;reading:number;passing:number;control:number;finishing:number}
interface Intent {kind:string;aim:Vec;speed:number;until:number;started:number;reason:string}
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(a:Vec)=>{const d=Math.hypot(a.x,a.y)||1;return {x:a.x/d,y:a.y/d};};
const diff=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const number=(v:number)=>Math.round(v*1000)/1000;
// Search for a reachable point on the actual ball trajectory. Maximum running
// speed alone overestimates what a receiver can reach while braking or turning.
export function receptionTarget(p:MovingPlayer,ball:MovingBall):Vec {
 const speed=Math.hypot(ball.vx,ball.vy),direction=unit({x:ball.vx,y:ball.vy});
 let best={x:ball.x,y:ball.y},bestGap=Infinity;
 for(let lead=.15;lead<=2.55;lead+=.15){
  const travel=Math.max(0,speed*lead-WORLD.ball.flight.receptionDecay.v*lead*lead);
  const aim={x:ball.x+direction.x*travel,y:ball.y+direction.y*travel};
  if(aim.x<.3||aim.x>L-.3||Math.abs(aim.y)>W/2-.3)continue;
  const preview={...p};
  for(let t=0;t<lead;t+=.05)steer(preview,aim,Math.min(.05,lead-t),p.pace);
  const gap=distance(preview,aim);
  if(gap<bestGap){best=aim;bestGap=gap;}
  if(gap<.65)break;
 }
 return best;
}
function profile(p:MovingPlayer,c:DecisionConfig):Profile {
 const attacking=['ST','W'].includes(p.role);
 return {risk:p.id==='maker'?(c.passer==='inventive'?.82:.18):attacking?.62:.4,reading:p.id==='maker'?.85:.72,passing:p.id==='maker'?(c.makerSkill??.82):p.role==='CB'?.62:.73,control:attacking?.8:.74,finishing:attacking?.82:.54};
}
function lineRisk(from:Vec,to:Vec,defenders:MovingPlayer[],speed=16):number {
 const vx=to.x-from.x,vy=to.y-from.y,length=Math.hypot(vx,vy);if(length<1)return 1;
 let risk=0;
 for(const d of defenders){
  const along=clamp(((d.x-from.x)*vx+(d.y-from.y)*vy)/(length*length),0,1);
  if(along<.05||along>.98)continue;
  const point={x:from.x+vx*along,y:from.y+vy*along},flight=length*along/speed;
  const anticipated={x:d.x+d.vx*Math.min(.4,flight),y:d.y+d.vy*Math.min(.4,flight)};
  const reach=.8+Math.min(2.8,flight*1.3),clearance=distance(anticipated,point);
  risk=Math.max(risk,clamp(1-clearance/reach,0,1));
 }
 return risk;
}
export function optionsFor(p:MovingPlayer,players:MovingPlayer[],c:DecisionConfig,running:ReadonlySet<string>=new Set(),lastFrom?:string):Option[]{
 const traits=profile(p,c),defenders=players.filter(q=>q.side!==p.side),outfield=defenders.filter(q=>q.role!=='GK');
 const nearest=Math.min(...outfield.map(q=>distance(q,p))),pressure=clamp((7-nearest)/7,0,1);
 const line=defenders.map(q=>q.x).sort((a,b)=>b-a)[1];
 const options:Option[]=[];
 for(const side of [-1,0,1]){
  const aim={x:Math.min(99,p.x+7),y:clamp(p.y+side*5,-30,30)},space=clamp(Math.min(...outfield.map(q=>distance(q,aim)))/9,0,1);
  const central=1-Math.abs(aim.y)/36;
  options.push({kind:'carry',aim,score:.16+space*.18+central*.04-pressure*.2,risk:1-space,reason:space>.65?'Are teren liber în față și duce mingea mai departe.':'Caută un unghi mai bun înainte să dea drumul mingii.'});
 }
 for(const q of players.filter(q=>q.side===p.side&&q.id!==p.id&&q.role!=='GK')){
  const d=distance(p,q);if(d<5||d>38||q.x<p.x-19||q.x>Math.max(52.5,p.x,line)+.05)continue;
  const modes:Action[]=running.has(q.id)&&q.x>p.x-2?['pass','through']:['pass'];
  for(const kind of modes){
   const through=kind==='through',flight=d/16;
   const aim={x:clamp(q.x+q.vx*flight*(through?.9:.55)+(through?2.5:0),2,101),y:clamp(q.y+q.vy*flight*(through?.9:.55),-32,32)};
   const risk=lineRisk(p,aim,defenders),recipientSpace=clamp(Math.min(...outfield.map(d=>distance(d,aim)))/7,0,1);
   const progress=clamp((aim.x-p.x)/24,-.8,1),threat=clamp((aim.x-64)/32,0,1)*(1-Math.abs(aim.y)/40);
   const technicalRisk=(1-traits.passing)*d/65;
   const score=.24+progress*(.24+traits.risk*.18)+recipientSpace*.15+threat*.24-(risk+technicalRisk)*(.68-traits.risk*.32)-d*.002-(q.id===lastFrom?.14:0)+(through?.07*traits.risk:0);
   options.push({kind,target:q.id,aim,score,risk,reason:through?'Observă o cursă în spatele liniei și încearcă să o găsească.':risk>.25&&traits.risk>.6?'Acceptă un culoar riscant pentru a avansa atacul.':progress>.4?'Vede un coleg mai aproape de poartă, într-un culoar disponibil.':pressure>.4?'Presiunea crește; caută sprijin pentru a păstra mingea.':'Alege o soluție de sprijin cu risc redus.'});
  }
 }
 if(p.x>72&&Math.abs(p.y)<25){
  const goalDistance=distance(p,{x:105,y:0}),angle=clamp(1-Math.abs(p.y)/28,0,1),quality=clamp(1-goalDistance/38,0,1)*angle;
  const risk=lineRisk(p,{x:105,y:0},outfield,25);
  options.push({kind:'shoot',aim:{x:106,y:0},score:.18+quality*.92+traits.risk*.12-pressure*.16-risk*.14,risk,reason:pressure>.5?'Spațiul se închide; încearcă șutul înainte să fie blocat.':'Are un unghi de șut și încearcă să încheie faza.'});
 }
 return options;
}
function pick(options:Option[],random:()=>number,reading:number):Option {
 // Tiny perception differences only compete among viable, near-best options.
 const ranked=options.map(o=>({o,value:o.score+(random()-.5)*(1-reading)*.1})).sort((a,b)=>b.value-a.value);
 const shortlist=ranked.filter(o=>o.value>=ranked[0].value-.1);
 const weights=shortlist.map(o=>Math.exp((o.value-ranked[0].value)/.045));let choice=random()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<shortlist.length;i++){choice-=weights[i];if(choice<=0)return shortlist[i].o;}
 return shortlist[0].o;
}
export function simulateDecisions(input:DecisionConfig=DEFAULT_DECISIONS):DecisionResult {
 const c={...input},duration=c.maxSeconds??35;
 if(!Number.isInteger(c.seed)||c.seed<0||c.seed>0xffffffff||!['track','step'].includes(c.cover)||!['channels','feet'].includes(c.striker)||!['inventive','careful'].includes(c.passer)||duration<5||duration>45||!Number.isFinite(duration)||(c.makerSkill!==undefined&&(!Number.isFinite(c.makerSkill)||c.makerSkill<0||c.makerSkill>1))||(c.energy!==undefined&&(!Number.isFinite(c.energy)||c.energy<0||c.energy>100)))throw Error('Invalid decision-study setup.');
 const random=rng(c.seed^0x51f047),execution=rng(c.seed^0xf2ac91),players=movementCast(),get=(id:string)=>players.find(p=>p.id===id)!;
 const home=new Map(players.map(p=>[p.id,{x:p.x,y:p.y}])),intents=new Map<string,Intent>();
 const frames:MovementFrame[]=[],events:MovementEvent[]=[],decisions:Decision[]=[];
 const metrics={passes:0,through:0,shots:0,carries:0,runSeconds:0,showSeconds:0,attackDepth:47};
 const energy=(c.energy??100)/100;players.forEach(p=>{p.pace*=.72+.28*energy;p.acceleration*=.8+.2*energy;});
 let time=0,score=0,outcome='',endAt=duration,receivedAt=0,lastFrom='',nextThink=.65,releaseAt=-1,releaseBy='',intended='',shotAt=Infinity,releaseGap:number|null=null,offside=false;
 let presser='',nextAssignment=0,prepared:{option:Option;release:number}|null=null,carry:Vec={x:53,y:-1};
 let reception:Vec|null=null,nextReception=0;
 let ball:MovingBall={x:47.65,y:0,vx:0,vy:0,z:0,vz:0,owner:'pivot',mode:'control'};
 const say=(kind:MovementEvent['kind'],text:string,actor?:string,target?:string)=>events.push({time,kind,text,actor,target});
 const end=(kind:MovementEvent['kind'],text:string,actor?:string)=>{if(outcome)return;outcome=kind;endAt=Math.min(duration,time+2);say(kind,text,actor);};
 const save=()=>frames.push({time,players:players.map(p=>({...p})),ball:{...ball},event:events.length-1,score,phase:outcome?'Faza s-a încheiat':ball.mode==='shot'?'Șut':ball.owner?'Construcție':'Mingea circulă'});
 const log=(p:MovingPlayer,kind:string,reason:string,target?:string,options?:Option[])=>decisions.push({time,actor:p.id,kind,target,reason,options:options?.map(o=>({kind:o.kind,target:o.target,score:number(o.score),risk:number(o.risk)}))});
 const choiceFor=(p:MovingPlayer,owner:MovingPlayer):Intent=>{
  const defenders=players.filter(q=>q.side===1),line=defenders.map(q=>q.x).sort((a,b)=>b-a)[1],base=home.get(p.id)!;
  const advance=clamp((ball.x-47)*.5,0,23);
  let kind='support',aim={x:base.x+advance,y:base.y},speed=3.7,reason='Rămâne disponibil și păstrează distanța față de colegi.';
  if(p.role==='GK'){kind='protect';aim={x:14,y:clamp(ball.y*.15,-6,6)};speed=2;reason='Oferă o soluție în spate și protejează poarta.';}
  else if(p.role==='CB'||p.role==='DM'){
   kind='protect';aim={x:Math.min(p.role==='CB'?56:70,base.x+advance*.5),y:base.y+ball.y*.1};reason='Rămâne în spatele mingii pentru a acoperi o pierdere.';
  }else if(p.role==='ST'||p.role==='W'){
   const willingness=p.id==='runner'?(c.striker==='channels'?.87:.15):.48;
   const open=clamp((105-line)/22,0,1),connection=distance(p,owner)<33?1:.3;
   const previous=intents.get(p.id),staleRun=previous?.kind==='run'&&time-previous.started>3&&ball.owner;
   const runScore=.17+willingness*.5+open*.12+connection*.12+(owner.x>60?.12:-.16)-(connection<1?.3:0)-(staleRun?.45:0);
   const showScore=.22+(1-willingness)*.46+(owner.x<65?.12:0);
   if(runScore+(random()-.5)*.12>showScore){
    kind='run';const choices=[p.y-7,p.y,p.y+7].map(y=>({x:Math.min(97,line-.8),y:clamp(y,-28,28)}));
    choices.sort((a,b)=>Math.min(...defenders.filter(d=>d.role!=='GK').map(d=>distance(d,b)))-Math.min(...defenders.filter(d=>d.role!=='GK').map(d=>distance(d,a))));
    aim=choices[0];speed=p.pace*.92;reason='Preferă adâncimea și caută un interval lângă fundași.';
   }else{
    kind='show';aim={x:clamp(Math.max(owner.x+10,p.x-9),55,Math.min(89,line-3)),y:p.role==='W'?Math.sign(base.y)*24:clamp(owner.y+(owner.y>0?-9:9),-17,17)};
    speed=4.3;reason=staleRun?'Cursa nu a primit pasa; revine să ofere o soluție nouă.':'Se apropie de pasator pentru a primi mingea la picior.';
   }
  }else if(p.role==='FB'){
   kind='width';aim={x:Math.min(79,base.x+advance*.75),y:base.y};reason='Păstrează lățimea fără să lase toată apărarea descoperită.';
  }else{
   const lane=Math.sign(base.y)||1;
   const spots=[{x:owner.x+10,y:owner.y+lane*11},{x:owner.x+6,y:owner.y-lane*12},{x:base.x+advance,y:base.y}].map(a=>({x:clamp(a.x,43,83),y:clamp(a.y,-24,24)}));
   spots.sort((a,b)=>Math.min(...defenders.map(d=>distance(d,b)))-Math.min(...defenders.map(d=>distance(d,a))));aim=spots[0];reason='Caută un unghi de pasă în afara presiunii.';
  }
  const previous=intents.get(p.id);
  return {kind,aim,speed,until:time+1.1+random()*.45,started:previous?.kind===kind?previous.started:time,reason};
 };
 say('start','Crocodinho are mingea. Colegii caută soluții, Inter Beton închide spațiile.','pivot');save();
 for(let tick=1;tick<=Math.ceil(duration/STEP);tick++){
  time=tick*STEP;const old=new Map(players.map(p=>[p.id,{x:p.x,y:p.y}])),owner=ball.owner?get(ball.owner):null;
  const past=frames[Math.max(0,frames.length-1-7)]??frames[0];
  const seen=(id:string)=>past.players.find(p=>p.id===id)!;
  if(owner&&time>=nextAssignment&&!outcome){
   const candidates=players.filter(p=>p.side===1&&p.role!=='GK'&&(p.role!=='CB'||owner.x>77));
   const selected=c.cover==='step'&&owner.x>65&&Math.abs(owner.y)<19?get('marker'):candidates.sort((a,b)=>distance(a,owner)-distance(b,owner))[0];
   presser=distance(selected,owner)<19?selected.id:'';nextAssignment=time+.7;
  }
  const line=players.filter(p=>p.side===1).map(p=>p.x).sort((a,b)=>b-a)[1];
  for(const p of players){
   const base=home.get(p.id)!;let target:Vec={...base},limit=3.4,challenging=false;
   if(p.side===0&&p.id!==owner?.id){
    let intent=intents.get(p.id);
    const context=owner?.side===0?owner:get(releaseBy||'pivot');
    if(!intent||(!outcome&&time>=intent.until)){const next=choiceFor(p,context);if(next.kind!==intent?.kind&&!outcome)log(p,next.kind,next.reason);intents.set(p.id,next);intent=next;}
    target={...intent.aim};limit=intent.speed;
    if(intent.kind==='run'&&ball.owner)target.x=Math.min(target.x,Math.max(owner?.x??0,line-.6));
    p.job={run:'Atacă spațiul',show:'Vine la minge',protect:'Păstrează acoperirea',support:'Caută un unghi de pasă',width:'Ține lățimea'}[intent.kind]??'Se oferă';
    if(p.id==='runner'&&!outcome){if(intent.kind==='run')metrics.runSeconds+=STEP;if(intent.kind==='show')metrics.showSeconds+=STEP;}
    if(ball.mode==='pass'&&intended===p.id&&time-releaseAt>.12){
     if(!reception||time>=nextReception){reception=receptionTarget(p,ball);nextReception=time+.2;}
     target=reception;limit=p.pace;p.job='Ajustează cursa la minge';
    }
   }else if(p.side===1){
    const retreat=clamp((ball.x-63)*.35,0,15);target={x:Math.min(98,base.x+retreat),y:base.y+ball.y*.1};p.job='Protejează spațiul';
    if(p.id===presser&&owner?.side===0){const perceived=seen(owner.id);target={x:perceived.x+.5,y:perceived.y};limit=p.pace*.86;p.job='Închide purtătorul';challenging=true;}
    else if(p.id==='marker'&&c.cover==='track'){
     const r=seen('runner');target={x:Math.min(98,Math.max(base.x+retreat*.2,r.x+1.4+Math.max(0,r.vx)*.35)),y:r.y-.8};limit=p.pace*.95;p.job='Urmărește atacantul';
     if(owner?.id==='runner'){target={x:seen(owner.id).x+.2,y:seen(owner.id).y};challenging=true;}
    }else if(p.id==='cover'){target={x:Math.min(97,Math.max(83,ball.x+7)),y:clamp(ball.y*.3,-5,9)};p.job='Acoperă centrul';}
    else if(p.role==='FB'){
     const winger=seen(p.id==='fullback'?'wing':'farwing');target={x:Math.min(98,Math.max(77,winger.x+2.7)),y:winger.y+Math.sign(-winger.y)*1.3};limit=4.8;p.job='Acoperă banda';
    }
    if(p.role==='GK'){
     target={x:100-clamp((ball.x-80)*.07,0,1.8),y:clamp(ball.y*.18,-3.1,3.1)};limit=3.2;p.job='Închide unghiul';
     if(ball.mode==='shot'&&time-shotAt>.23){const left=Math.max(0,(p.x-ball.x)/Math.max(1,ball.vx));target={x:p.x-.25,y:clamp(ball.y+ball.vy*left,-5,5)};limit=p.pace;p.job='Intervine la șut';}
    }
   }
   if(owner?.id===p.id){
    target=carry;limit=Math.min(4.8,p.pace*.7);p.job='Conduce mingea';
    if(time-receivedAt<.35||prepared){target={x:p.x,y:p.y};limit=0;p.job=prepared?'Pregătește lovitura':'Preia mingea';}
   }
   if(outcome){target={x:p.x,y:p.y};limit=0;p.job='Faza s-a încheiat';}
   steer(p,target,STEP,limit,challenging?players.filter(q=>q.side===p.side):players);
   if(prepared&&owner?.id===p.id||Math.hypot(p.vx,p.vy)<.3){
    const aim=prepared&&owner?.id===p.id?prepared.option.aim:ball;
    p.angle+=clamp(diff(Math.atan2(aim.y-p.y,aim.x-p.x),p.angle),-4*STEP,4*STEP);
   }
  }
  if(!outcome)metrics.attackDepth=Math.max(metrics.attackDepth,Math.min(105,ball.x));
  if(!outcome&&ball.owner){
   const p=get(ball.owner),traits=profile(p,c),held=time-receivedAt,touch=.65+Math.sin(held*9)*.12;
   ball.x=p.x+Math.cos(p.angle)*touch;ball.y=p.y+Math.sin(p.angle)*touch;ball.vx=p.vx;ball.vy=p.vy;
   const defender=players.find(q=>q.side===1&&q.role!=='GK'&&distance(q,ball)<.8);
   if(defender&&held>.42){ball.owner=defender.id;end('interception',`${defender.name} ajunge la minge. Inter Beton oprește atacul.`,defender.id);}
   else if(time>=nextThink&&!prepared){
    const runners=new Set(Array.from(intents).filter(([,i])=>i.kind==='run').map(([id])=>id));
    const options=optionsFor(p,players,c,runners,lastFrom),option=pick(options,random,traits.reading);
    log(p,option.kind,option.reason,option.target,options);nextThink=time+.8+random()*.3;
    if(option.kind==='carry'){carry=option.aim;metrics.carries++;}
    else{prepared={option,release:time+.24+(1-traits.control)*.2};say('prepare',option.kind==='shoot'?`${p.name} își așază mingea pentru șut…`:`${p.name} ridică privirea și pregătește pasa…`,p.id);}
   }
   if(!outcome&&prepared&&time>=prepared.release){
    const option=prepared.option,shooting=option.kind==='shoot',receiver=option.target?get(option.target):null;
    const nearest=Math.min(...players.filter(q=>q.side===1&&q.role!=='GK').map(q=>distance(q,p))),pressure=clamp((5-nearest)/5,0,1);
    let aim:Vec;
    if(shooting){aim={x:106,y:(execution()<.5?-1:1)*(1.1+execution()*(1.1+(1-traits.finishing)*4)+pressure*1.4)};shotAt=time;metrics.shots++;}
    else {
     const through=option.kind==='through',flight=distance(p,receiver!)/16;
     aim={x:receiver!.x+receiver!.vx*flight*(through?.9:.6)+(through?2:0),y:receiver!.y+receiver!.vy*flight*(through?.9:.6)};
     const error=(1-traits.passing)*1.6+pressure*.55+(1-energy)*.4;aim.x+=(execution()-.5)*error;aim.y+=(execution()-.5)*error;
     aim.x=clamp(aim.x,1,102);aim.y=clamp(aim.y,-34,34);
     const releaseLine=players.filter(q=>q.side===1).map(q=>q.x).sort((a,b)=>b-a)[1];offside=receiver!.x>Math.max(52.5,p.x,releaseLine)+.05;
     if(receiver!.id==='runner')releaseGap=distance(get('marker'),receiver!);
     metrics.passes++;if(through)metrics.through++;
    }
    const dir=unit({x:aim.x-ball.x,y:aim.y-ball.y});ball={...ball,owner:null,mode:shooting?'shot':'pass',vx:dir.x*(shooting?25:16),vy:dir.y*(shooting?25:16),z:shooting?.18:0,vz:shooting?1.8:0};
    releaseAt=time;releaseBy=p.id;intended=receiver?.id??'';prepared=null;reception=null;
    say(shooting?'shot':'pass',shooting?`${p.name} încearcă poarta!`:option.kind==='through'?`${p.name} trimite în spațiu pentru ${receiver!.name}.`:`${p.name} îl caută la picior pe ${receiver!.name}.`,p.id,receiver?.id);
    if(offside)end('out',`${receiver!.name} plecase prea devreme. Se ridică fanionul.`,receiver!.id);
   }
  }else if(!outcome){
   const before={x:ball.x,y:ball.y};ball.x+=ball.vx*STEP;ball.y+=ball.vy*STEP;
   const v=Math.hypot(ball.vx,ball.vy),factor=Math.max(0,v-(ball.z>.01?0:.6)*STEP)/Math.max(.001,v);ball.vx*=factor;ball.vy*=factor;
   ball.z=Math.max(0,ball.z+ball.vz*STEP);ball.vz-=9.81*STEP;if(ball.z===0)ball.vz=Math.abs(ball.vz)>.8?-ball.vz*.16:0;
   const hits=players.flatMap(p=>{
    if(p.id===releaseBy&&time-releaseAt<.35||ball.z>(p.role==='GK'?2.3:1.2))return [];
    const radius=p.role==='GK'&&ball.mode==='shot'?(time-shotAt>.23?1.25:.6):p.side===0?1:.72;
    const t=contact(before,ball,old.get(p.id)!,p,radius);return t===null?[]:[{p,t}];
   }).sort((a,b)=>a.t-b.t);
   const hit=hits[0];
   if(hit){
    const p=hit.p,shot=ball.mode==='shot';ball.x=before.x+(ball.x-before.x)*hit.t;ball.y=before.y+(ball.y-before.y)*hit.t;ball.owner=p.id;ball.vx=p.vx;ball.vy=p.vy;ball.z=0;ball.vz=0;ball.mode='control';
    if(p.side===1)end(shot&&p.role==='GK'?'save':'interception',shot?`${p.name} ${p.role==='GK'?'ajunge la șut și îl oprește':'se pune în calea șutului și îl blochează'}.`:`${p.name} citește pasa. Mingea e a lui Inter Beton.`,p.id);
    else{receivedAt=time;nextThink=time+.4+(1-profile(p,c).reading)*.3;lastFrom=releaseBy;carry={x:Math.min(99,p.x+6),y:p.y};say('receive',`${p.name} preia și caută următoarea soluție.`,p.id);}
   }else if(ball.x>105){if(Math.abs(ball.y)<3.66&&ball.z<2.44&&ball.mode==='shot'){score=1;end('goal',`GOOOL! ${get(releaseBy).name} găsește colțul. Pe margine se sare de pe scaune.`,releaseBy);}else end('out','Mingea trece pe lângă poartă. Se aude un oftat de pe margine.');}
   else if(ball.x<0||Math.abs(ball.y)>34)end('out','Mingea iese din teren. Faza se încheie.');
   else if(time-releaseAt>4.5)end('out','Pasa se duce prea departe. Fereastra de atac s-a închis.');
  }
  if(tick%2===0||time>=endAt)save();if(time>=endAt)break;
 }
 if(!outcome){outcome='end';say('end','Atacul nu a găsit finalizarea în această secvență.');save();}
 return {config:c,seed:c.seed,cover:c.cover,duration:time,frames,events,outcome,releaseGap,offside,decisions,metrics};
}
