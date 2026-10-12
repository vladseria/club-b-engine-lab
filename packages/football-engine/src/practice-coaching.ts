import {L,W} from './pitch.js';
import {clamp} from './model.js';
import type {Side} from './model.js';
import type {MovingBall,Vec} from './movement.js';
import type {PracticePlayer,Option} from './practice.js';
import type {SupportPlan,SupportMove} from './practice-support.js';
import {timeSupportRun} from './practice-support.js';
import type {CoordinationView} from './practice-coordination.js';
import {assessShot} from './practice-football.js';
import {carryOptions} from './practice-carry.js';
import {LooseBallContinuity} from './practice-continuity.js';
import {possessionSafety} from './practice-possession.js';
import type {CarryPlan} from './practice-carry.js';

/** A football intention. The corridor is an area of preference, never a release point. */
export interface CoachingIntent {kind:'advance-combine'|'repeat-one-two';side:Side;carrier:number;partner:number;channelY:number;width:number;emphasis?:number}
export interface CoachingNote {time:number;kind:'start'|'decision'|'support'|'pass'|'receipt'|'end';actor?:string;text:string;aim?:Vec;phase:string;chosen?:{kind:string;target?:string;aim:Vec};outcome?:'shot';options?:{kind:string;target?:string;aim?:Vec;score:number;coachedScore:number;risk?:number}[]}
type LaneRisk=(from:Vec,to:Vec,opponents:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(v:Vec)=>({x:clamp(v.x,1,L-1),y:clamp(v.y,-W/2+1,W/2-1)});
const sig=(o:Option)=>`${o.kind}:${o.target??''}`;

/** Local preferences over normal football options; the opposition receives no plan information. */
export class FootballCoaching {
 readonly notes:CoachingNote[]=[];
 private started=-1;
 private ended=false;
 private phase:'advance'|'outbound'|'return'|'inbound'|'finish'='advance';
 private carrier='';private partner='';
 private route:SupportMove|null=null;
 private lastRouteNote=-10;
 private lastDecision='';private lastDecisionAt=-10;
 private rated:CoachingNote['options']=[];
 private lastPressure=0;
 private continuity=new LooseBallContinuity();
 private blockedPass?:{owner:string;since:number};
 get suspended(){return this.continuity.suspended;}
 constructor(readonly config:CoachingIntent){
  if(config.emphasis!==undefined&&(!Number.isFinite(config.emphasis)||config.emphasis<0||config.emphasis>1))throw Error('Emphasis must be between 0 and 1.');
  if(!['advance-combine','repeat-one-two'].includes(config.kind)||![0,1].includes(config.side)||![2,3,4,5].includes(config.carrier)||![2,3,4,5].includes(config.partner)||config.carrier===config.partner||!Number.isFinite(config.channelY)||Math.abs(config.channelY)>W/2-2||!Number.isFinite(config.width)||config.width<3||config.width>W)throw Error('Invalid coaching intention');
 }
 private get emphasis(){return this.config.kind==='repeat-one-two'?(this.config.emphasis??1):1;}
 private get repeating(){return this.config.kind==='repeat-one-two';}
 private paired(p:PracticePlayer){return p.side===this.config.side&&[this.config.carrier,this.config.partner].includes(p.number);}
 private lastPairFrom='';
 private lastPairAt=-100;
 private pendingPair:{from:string;to:string}|null=null;
 get active(){return this.emphasis>0&&this.started>=0&&!this.ended;}
 private note(time:number,kind:CoachingNote['kind'],text:string,actor?:string,aim?:Vec){this.notes.push({time,kind,text,actor,phase:this.phase,...(aim?{aim:{...aim}}:{})});}
 end(time:number,text:string,outcome?:'shot'){if(!this.active)return;this.ended=true;this.route=null;this.pendingPair=null;this.continuity.clear();this.note(time,'end',text);if(outcome)this.notes.at(-1)!.outcome=outcome;}
 receive(time:number,p:PracticePlayer,from:string,pass:boolean){
  if(this.emphasis===0)return;
  if(this.repeating){
   if(!this.paired(p)){this.end(time,'Mingea a ajuns în afara perechii; așteaptă o nouă ocazie.');return;}
   if(!this.active){this.started=time;this.ended=false;this.phase='advance';this.note(time,'start',`#${p.number}: caută un-doiul cu partenerul, apoi repetă până se deschide șutul.`,p.id);}
   if(pass&&this.pendingPair?.from===from&&this.pendingPair.to===p.id){this.lastPairFrom=from;this.lastPairAt=time;this.phase='return';this.note(time,'receipt',`#${p.number} a primit. Partenerul pleacă pentru retur; continuă schimbul dacă nu apare șutul.`,p.id);}
   else this.phase='advance';
   this.pendingPair=null;
   return;
  }
  if(this.started<0&&p.side===this.config.side&&p.number===this.config.carrier){
   this.started=time;this.carrier=p.id;this.note(time,'start',`#${p.number}: avansează pe acest culoar și caută o combinație. Adaptează-te dacă se închide.`,p.id);return;
  }
  if(!this.active)return;
  if(p.side!==this.config.side){this.end(time,'Adversarul a recuperat; echipa revine la jocul obișnuit.');return;}
  if(![this.carrier,this.partner].includes(p.id)){this.end(time,'Un alt coleg a preluat mingea; combinația lasă loc noii situații.');return;}
  if(!pass){this.phase=p.id===this.carrier?'advance':'return';this.route=null;this.note(time,'decision','A recuperat controlul în pereche; recitește combinația fără a număra o pasă reușită.',p.id);return;}
  if(this.phase==='return'&&p.id===this.carrier){this.end(time,'Mingea a revenit fără pasa de retur; continuă din noua situație.');return;}
  if(pass&&from===this.carrier&&this.phase==='outbound'){
   if(p.id===this.partner){this.phase='return';this.note(time,'receipt',`#${p.number} a primit. Caută întoarcerea dacă se deschide un culoar.`,p.id);}
   else this.end(time,'Pasa a ajuns la alt coleg; continuă cu soluțiile din noua situație.');
  }else if(pass&&from===this.partner&&this.phase==='inbound'){
   if(p.id===this.carrier){this.phase='finish';this.note(time,'receipt',`#${p.number} a primit returul. Compară șutul cu celelalte soluții.`,p.id);}
   else this.end(time,'Returul nu a ajuns la alergător; combinația se încheie.');
  }
 }
 update(time:number,players:PracticePlayer[],ball:MovingBall,restart:boolean){
  if(this.emphasis===0)return;
  if(this.active){
   const owner=players.find(p=>p.id===ball.owner);
   if(restart||owner&&!this.paired(owner)){this.end(time,restart?'Jocul s-a oprit; combinația se încheie.':'Mingea a ajuns în afara perechii; continuă din noua situație.');return;}
   const wasSuspended=this.suspended,continuity=this.continuity.update(time,ball,players.filter(p=>this.paired(p)));
   if(continuity==='expired'){this.end(time,'Mingea s-a îndepărtat sau duelul a durat prea mult; reorganizează jocul.');return;}
   if(continuity==='pause'){if(!wasSuspended){this.route=null;this.note(time,'decision','Mingea este liberă: reacționează la duel, păstrând pentru scurt timp combinația.');}return;}
   if(wasSuspended)this.note(time,'decision','Controlul a revenit în pereche; caută un nou unghi din pozițiile actuale.');
  }
  if(this.repeating){
   const owner=players.find(p=>p.id===ball.owner);
   if(restart||owner&&!this.paired(owner)){this.end(time,restart?'Reluare de joc; perechea așteaptă următoarea posesie.':'Combinația s-a rupt; reacționează la joc.');return;}
   if(owner&&this.paired(owner)){
    if(!this.active)this.receive(time,owner,'',false);
    this.carrier=owner.id;this.partner=players.find(p=>this.paired(p)&&p.id!==owner.id)?.id??'';
   }
   return;
  }
  if(!this.active)return;
  if(restart){this.end(time,'Jocul s-a oprit; combinația se încheie.');return;}
  if(time-this.started>=15){this.end(time,'Ocazia pentru combinație a trecut; continuă jocul obișnuit.');return;}
  const owner=players.find(p=>p.id===ball.owner);
  if(owner&&owner.side!==this.config.side)this.end(time,'Adversarul a câștigat mingea.');
  if(!this.partner)this.partner=players.find(p=>p.side===this.config.side&&p.number===this.config.partner)?.id??'';
 }
 release(time:number,p:PracticePlayer,option:Option){
  if(!this.active)return;
  if(this.repeating){
   if(option.kind==='shoot'){this.end(time,`#${p.number} găsește un unghi și șutează; schimbul se încheie.`,'shot');return;}
   if(option.target&&[this.carrier,this.partner].includes(option.target)){this.pendingPair={from:p.id,to:option.target};this.lastPairFrom=p.id;this.lastPairAt=time;this.phase='outbound';this.route=null;this.note(time,'pass',`#${p.number} pasează partenerului și caută spațiu pentru retur.`,p.id,option.aim);}
   else this.end(time,`#${p.number} alege o altă ieșire; un-doiul nu era soluția aleasă.`);
   return;
  }
  if(option.kind==='shoot'){if(p.id===this.carrier||p.id===this.partner)this.end(time,`#${p.number} a găsit un șut și a încercat poarta.`);return;}
  if(p.id===this.carrier&&this.phase==='advance'){
   if(option.target===this.partner){this.phase='outbound';this.route=null;this.note(time,'pass',this.lastPressure>=.5?'Eliberează mingea sub presiune; începe să ofere o opțiune pentru retur.':'A găsit combinația; se mișcă pentru eventuala întoarcere.',p.id);}
   else this.end(time,`#${p.number} a ales altă soluție; echipa continuă fără a forța combinația.`);
  }else if(p.id===this.partner&&this.phase==='return'){
   if(option.target===this.carrier){this.phase='inbound';this.note(time,'pass','Încearcă pasa de retur către colegul care s-a desprins.',p.id);}
   else this.end(time,`#${p.number} a ales o altă ieșire în locul returului.`);
  }
 }
 private pressure(p:PracticePlayer,players:PracticePlayer[]){
  const near=players.filter(q=>q.side!==p.side&&q.role!=='GK').map(q=>{
   const gap=distance(p,q),closing=((q.vx-p.vx)*(p.x-q.x)+(q.vy-p.vy)*(p.y-q.y))/Math.max(.1,gap);
   return clamp((5-gap)/3.4,0,1)+clamp(closing/5,0,.2)*clamp((7-gap)/3,0,1);
  }).sort((a,b)=>b-a);
  return clamp((near[0]??0)+(near[1]??0)*.55,0,1);
 }
 options(time:number,p:PracticePlayer,players:PracticePlayer[],ball:MovingBall,ordinary:Option[],laneRisk:LaneRisk,held:number,carryPlan:CarryPlan|null):Option[]{
  if(!this.active||this.suspended||!ball.owner&&ball.mode==='loose'||p.side!==this.config.side)return ordinary;
  if(this.repeating)return this.repeatOptions(time,p,players,ball,ordinary,laneRisk);
  // The existing receiving planner also asks about the next action while a
  // pass is travelling. Let it prepare for this intention before contact,
  // without advancing the sequence or logging a decision that did not happen.
  const preview=ball.mode==='pass'&&!ball.owner;
  const advancing=p.id===ball.owner&&p.id===this.carrier&&this.phase==='advance';
  const returning=p.id===this.partner&&(p.id===ball.owner&&this.phase==='return'||preview&&this.phase==='outbound');
  const finishing=p.id===this.carrier&&(p.id===ball.owner&&this.phase==='finish'||preview&&this.phase==='inbound');
  if(!advancing&&!returning&&!finishing)return ordinary;
  const pressure=this.pressure(p,players),sign=p.side===0?1:-1,center=p.side===0?this.config.channelY:-this.config.channelY;
  if(!preview)this.lastPressure=pressure;
  // Corridor-centred options still pass through the existing carry risk assessment.
  const additions=advancing?carryOptions(p,players,held,laneRisk,carryPlan,time,[-2,0,2].map(dy=>inside({x:p.x+sign*6,y:center+dy}))).filter(o=>!ordinary.some(q=>q.kind==='carry'&&distance(q.aim,o.aim)<.2)):[];
  const all:Option[]=[...ordinary,...additions];const best=Math.max(...all.map(o=>o.score));
  const traitWeight=.85+p.skills.reading*.012+p.traits.discipline*.08;
  const scored=all.map(o=>{
   let bonus=0,why='';const delivery=o.pass??o.loft;
   const viable=delivery?clamp(1-delivery.risk/.5,0,1)*clamp(1-delivery.controlRisk/.5,0,1)*clamp((delivery.reachMargin+.6)/1.2,0,1):1;
   // Preference cannot resurrect an option that normal football already rates far below the alternatives.
   const competitive=clamp(1-Math.max(0,best-o.score-.08)/.35,0,1);
   if(advancing&&o.carry){
    const forward=(o.aim.x-p.x)*sign,alignment=clamp(1-Math.abs(o.aim.y-center)/this.config.width,0,1);
    bonus=.26*clamp(forward/5,0,1)*alignment*clamp(1-o.carry.obstruction/.65,0,1)*(1-pressure*.8);
    if(bonus>.025)why='Avansează pe culoarul cerut cât timp drumul rămâne utilizabil.';
   }
   if(delivery&&o.target===(advancing?this.partner:returning?this.carrier:'')){
    bonus=(returning?.21:.04+pressure*.2)*viable;
    if(bonus>.025)why=returning?'Caută returul către colegul care se desprinde; pasa rămâne o alegere, nu o obligație.':pressure>.45?'Presiunea vine mai devreme: caută colegul disponibil, fără să aștepte un punct fix.':'Caută partenerul combinației când pasa oferă o continuare.';
   }
   if(finishing&&o.kind==='shoot'){bonus=.07;why='După retur, caută finalizarea dacă poziția justifică șutul.';}
   bonus*=competitive*traitWeight;
   return bonus>.01?{...o,score:o.score+bonus,reason:why}:o;
  });
  if(!preview)this.rated=all.map((o,i)=>({kind:o.kind,target:o.target,aim:{...o.aim},score:o.score,coachedScore:scored[i].score,risk:o.carry?.obstruction??o.pass?.risk??o.loft?.risk}));
  return scored;
 }
 private repeatOptions(time:number,p:PracticePlayer,players:PracticePlayer[],ball:MovingBall,ordinary:Option[],laneRisk:LaneRisk):Option[]{
  if(!this.paired(p))return ordinary;
  const partner=players.find(q=>this.paired(q)&&q.id!==p.id);if(!partner)return ordinary;
  const shot=ordinary.find(o=>o.kind==='shoot'),read=shot?assessShot(p,players):undefined;
  // Coaching changes the objective, never pass accuracy or the opponent's response.
  // A real shooting opportunity ends the repetitions, including for either partner.
  const finish=!!read&&read.quality>.2&&read.angle>.18;
  const open=ordinary.some(o=>{const d=o.pass??o.loft;return o.target===partner.id&&d&&d.risk<=.42&&d.controlRisk<=.48&&d.reachMargin>=-.6;});
  if(ball.owner===p.id){if(open)this.blockedPass=undefined;else if(this.blockedPass?.owner!==p.id)this.blockedPass={owner:p.id,since:time};}
  const safety=possessionSafety(p,players),route=this.route;
  const developing=!finish&&!open&&ball.owner===p.id&&this.blockedPass&&time-this.blockedPass.since<1.1&&route?.player===partner.id&&route.until>time&&distance(partner,route.aim)>1&&distance(partner,route.aim)<partner.pace*1.5&&laneRisk(p,route.aim,players.filter(q=>q.side!==p.side))<.4&&safety.contactTime>.7&&safety.urgency<.25;
  const setup=developing?ordinary.filter(o=>o.kind==='carry'&&o.carry&&o.carry.obstruction<.3&&o.carry.clearance>1.5).sort((a,b)=>b.score-a.score)[0]:undefined;
  const bestNonShot=Math.max(...ordinary.filter(o=>o.kind!=='shoot').map(o=>o.score));
  const scored=ordinary.map(o=>{
   const delivery=o.pass??o.loft;
   if(finish&&o.kind==='shoot')return {...o,score:o.score+.85*this.emphasis,reason:'A apărut un șut: încheie combinațiile și încearcă poarta.'};
   if(o===setup)return {...o,score:o.score+Math.max(0,bestNonShot-o.score+.12)*this.emphasis,reason:'Protejează mingea pentru scurt timp; partenerul caută un nou unghi pentru retur.'};
   if(!finish&&delivery&&o.target===partner.id&&Number.isFinite(delivery.flight)&&delivery.reachMargin>-.9){
    const risk=delivery.risk,control=delivery.controlRisk;
    // Strong preference tolerates contested passes, but does not compel a kick
    // straight into a body or an unreachable return. No ordinary-score veto.
    const bonus=.85*this.emphasis*clamp((.9-risk)/.65,0,1)*clamp((.8-control)/.5,0,1);
    if(bonus>.01)return {...o,score:o.score+bonus,reason:`Indicația de un-doi: caută din nou #${partner.number}, apoi pleacă pentru retur.`};
   }
   return o;
  });
  if(ball.owner===p.id)this.rated=ordinary.map((o,i)=>({kind:o.kind,target:o.target,aim:{...o.aim},score:o.score,coachedScore:scored[i].score,risk:o.pass?.risk??o.loft?.risk}));
  return scored;
 }
 choose(time:number,p:PracticePlayer,o:Option){
  if(!this.active||![this.carrier,this.partner].includes(p.id))return;
  const key=`${p.id}:${sig(o)}:${o.reason}`;
  if(key===this.lastDecision&&time-this.lastDecisionAt<1.5)return;
  this.lastDecision=key;this.lastDecisionAt=time;
  this.note(time,'decision',o.reason,p.id,o.aim);this.notes.at(-1)!.options=this.rated;this.notes.at(-1)!.chosen={kind:o.kind,target:o.target,aim:{...o.aim}};
 }
 /** Offer the ball or the return by finding a passable angle, with commitment until conditions materially change. */
 apply(time:number,players:PracticePlayer[],ball:MovingBall,coordination:CoordinationView|null,support:SupportPlan|null,unavailable:ReadonlySet<string>,laneRisk:LaneRisk):SupportPlan|null {
  if(!this.active||this.suspended||!ball.owner&&ball.mode==='loose'||!['advance','outbound','return'].includes(this.phase))return support;
  const repeatOwner=this.repeating?players.find(p=>p.id===ball.owner):undefined;
  const repeatAnchor=this.repeating?(repeatOwner??players.find(p=>p.id===this.partner)):undefined;
  const repeatRunner=this.repeating?players.find(p=>this.paired(p)&&p.id!==repeatAnchor?.id):undefined;
  const isReturn=this.repeating?!!repeatRunner&&repeatRunner.id===this.lastPairFrom&&time-this.lastPairAt<5:this.phase!=='advance',runner=this.repeating?repeatRunner:players.find(p=>p.id===(isReturn?this.carrier:this.partner)),anchor=this.repeating?repeatAnchor:players.find(p=>p.id===(isReturn?this.partner:this.carrier));
  if(!runner||!anchor||runner.id===ball.owner||unavailable.has(runner.id)||coordination?.flight.receiver===runner.id)return support;
  const opponents=players.filter(p=>p.side!==runner.side),mates=players.filter(p=>p.side===runner.side&&p.id!==runner.id&&p.id!==anchor.id),sign=runner.side===0?1:-1;
  const center=this.repeating?anchor.y:runner.side===0?this.config.channelY:-this.config.channelY;
  const rate=(point:Vec)=>{
   const gap=distance(anchor,point),travel=distance(runner,point),room=Math.min(...opponents.map(q=>distance(q,point)));
   if(gap<3.5||gap>20||travel>14||room<1.2||mates.some(q=>distance(q,point)<2.5))return -10;
   const risk=laneRisk(anchor,point,opponents),pathRisk=laneRisk(runner,point,opponents,runner.pace*.85);
   const advance=clamp((point.x-anchor.x)*sign/7,-1,1),channel=clamp(1-Math.abs(point.y-center)/(this.config.width+3),0,1);
   const momentum=Math.hypot(runner.vx,runner.vy)>.5?clamp(((point.x-runner.x)*runner.vx+(point.y-runner.y)*runner.vy)/(Math.max(.1,travel)*Math.hypot(runner.vx,runner.vy)),-1,1):0;
   return .9*(1-risk)+clamp(room/5,0,1)*.22+advance*(this.repeating?.45:isReturn?.27:.06)+channel*.13-travel*.025-pathRisk*.19+momentum*.07;
  };
  const candidates=[{x:runner.x,y:runner.y},...[-3,1,5,9].flatMap(dx=>[-8,-4,4,8].map(dy=>inside({x:anchor.x+sign*dx,y:anchor.y+dy})))];
  const ordinary=coordination?.jobs[runner.id];if(ordinary)candidates.push(ordinary.aim);
  if(this.route?.player===runner.id)candidates.push(this.route.aim);
  let aim=candidates.reduce((best,q)=>rate(q)>rate(best)?q:best,candidates[0]);
  const previous=this.route?.player===runner.id?this.route:null;
  const dangerAtOld=previous?Math.min(...opponents.map(q=>distance(q,previous.aim))):0;
  if(previous&&time<previous.until&&dangerAtOld>1.8&&rate(previous.aim)>=rate(aim)-.16)aim=previous.aim;
  const rating=rate(aim);
  // At low emphasis, keep an ordinary useful assignment unless the combination
  // offers enough extra value. This chooses a purpose, not a blended fake route.
  if(this.repeating&&ordinary&&ordinary.purpose!=='give-and-go'&&this.emphasis<1&&rate(ordinary.aim)+(1-this.emphasis)*.65>=rating){this.route=null;return support;}
  if(rating<.35){this.route=null;return support;}
  const continuing=previous&&distance(previous.aim,aim)<.6;
  const lane=laneRisk(anchor,aim,opponents),progress=(aim.x-runner.x)*sign;
  const kind:SupportMove['kind']=isReturn&&progress>1?'run':distance(runner,aim)<.9?'hold':'show';
  const reason=isReturn?(lane<.3?'Se desprinde pentru retur într-un culoar disponibil.':'Ajustează cursa pentru a ieși din umbra apărătorului; returul poate să nu se deschidă.'):'Se oferă într-un unghi de pasă, păstrând distanță față de purtător.';
  const move:SupportMove={player:runner.id,purpose:'give-and-go',kind,aim:{...aim},speed:runner.pace*(kind==='run'?.92:kind==='hold'?0:.8),since:continuing?previous.since:time,until:continuing?previous.until:time+1.1,reason};
  if(kind==='run'){
   const meeting=coordination?.flight.meetings[anchor.id],reference=meeting?{...anchor,...meeting}:anchor;
   const incoming=ball.owner?0:Math.min(2.5,distance(ball,reference)/Math.max(3,Math.hypot(ball.vx,ball.vy)));
   const timing=timeSupportRun(runner,aim,move.speed,reference,players,incoming);
   move.speed=timing.speed;if(timing.waiting)move.reason+=' Își dozează cursa pentru momentul returului.';
  }
  const changed=!previous||distance(previous.aim,aim)>1.5;
  this.route=move;
  if(changed&&time-this.lastRouteNote>.45){this.lastRouteNote=time;this.note(time,'support',reason,runner.id,aim);}
  
  const result:SupportPlan={side:runner.side,owner:ball.owner??anchor.id,moves:[...(support?.side===runner.side?support.moves:[]).filter(m=>m.player!==runner.id),move]};
  
  return result;
 }
}
