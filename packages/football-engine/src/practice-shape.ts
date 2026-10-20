import * as S from './style.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Side,Tactics} from './model.js';
import type {Vec,MovingBall} from './movement.js';
import type {PracticePlayer,Duty} from './practice.js';
import {acuity,perceive} from './practice-perception.js';
import {arrivalTime} from './practice-arrival.js';
/** A defender's view of an attacker who is not on the ball (M3): the man as
 * this defender last saw him. Absent, reads are exact (scenes and tests). */
/** What `reader` sees of `target` (his own picture, a moment late); `before` s earlier still, when asked (the track-runner read of a run setting off compares the two). */
export type Sight=(reader:PracticePlayer,target:PracticePlayer,before?:number)=>PracticePlayer;

export interface ShapeSlot {aim:Vec;kind:Duty;speed:number;reason:string}
export interface TeamShape {
 side:Side;attacking:boolean;time:number;changedAt:number;
 phase:'build'|'advance'|'circulate'|'recover'|'block';
 /** Unit depths are measured from this team's own goal. */
 back:number;middle:number;front:number;shift:number;focus:Vec;
 slots:Record<string,ShapeSlot>;
 /** The team's Width, which also prices how far the block follows attackers. */
 width?:Tactics['width'];
 /** Defending only: each defender's lateral pull towards the attacker in his
  * zone (metres added to his ball-based slot), smoothed between re-plans. */
 pulls?:Record<string,number>;
 /** Each back-line player's drop from the unit's height towards his own goal
  * (metres, <= 0) to keep the Line's cushion to the deepest threatening
  * attacker as he reads him (M1), smoothed between re-plans. */
 drops?:Record<string,number>;
}
const depth=(side:Side,x:number)=>side===0?x:L-x;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const mean=(xs:number[],fallback:number)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
const toward=(old:number,next:number,limit:number)=>old+clamp(next-old,-limit,limit);
/** Press sets how far the block leans towards the ball's side (M2,
 * 2026-10-01): the block's lateral shift is `lean` x the ball's distance from
 * the centre line, up to `cap`. Before, every setting shifted 0.5 x (cap
 * 6.2 m) and the block slid only 0.17-0.29 m per metre of lateral ball
 * movement, so defending circulation was the easiest job in the game.
 * Selective stays compact in the middle (0.35): the far side stays covered
 * and a switch finds men in front of it, but the ball's side is given room.
 * Aggressive leans hard (0.7, up to 9.3 m): it crowds the ball's side and
 * leaves the far side and the switch open. Balanced keeps today's lean.
 * `effort` is how hard the shape players slide to get there. */
export const PRESS_LEAN={
 selective:{lean:.35,cap:Y(14),effort:1},
 balanced:{lean:.5,cap:Y(14),effort:1},
 aggressive:{lean:.7,cap:Y(21),effort:1.15},
} as const satisfies Record<Tactics['press'],{lean:number;cap:number;effort:number}>;
/** The lean reaches the markers too (M2). A man-marker's aim is his man's
 * position; before, every press setting marked the same way, so the block's
 * lean only moved the one or two players holding a shape slot and the block as
 * a whole followed the ball identically for every setting. Now each marker
 * sits (lean - 0.5) x MARK_LEAN x the ball's distance from the centre line
 * across from his man: Aggressive markers slide towards the ball's side (ball-
 * side men are crowded, the far man is left a few metres freer: the switch is
 * on); Selective markers stay towards the middle (the ball's side is given
 * room, the far side stays covered); Balanced marks as before. Near our goal
 * (a man within 10 m) everyone marks tight, whatever the setting. */
export const MARK_LEAN=2.2,MARK_LEAN_CAP=4.5;
export function markLean(press:Tactics['press'],side:Side,ball:Vec,man:Vec):number{
 const k=PRESS_LEAN[press].lean-PRESS_LEAN.balanced.lean;if(!k)return 0;
 const near=clamp((depth(side,man.x)-X(22))/X(13),0,1);
 return clamp(k*MARK_LEAN*ball.y*near,-MARK_LEAN_CAP,MARK_LEAN_CAP);
}
/** A width slot (a winger holding his lane) may stand 1.5 m from the touchline;
 * every other reference stays 3 m inside it. The old single ±(W/2−3) clamp
 * capped "wide" at the "standard" lane, so the setting could not reach it. */
const inside=(p:Vec,lane=false)=>({x:clamp(p.x,1,(L-1)),y:clamp(p.y,-(W/2-(lane?1.5:3)),(W/2-(lane?1.5:3)))});

/** Width is one disclosed field.
 * With the ball it sets how wide the wingers hold their lane (`lane`, from
 * the centre line), how far their idle position drifts towards the ball's
 * side (`pull`: narrow = closer support near the ball), and how much it costs
 * a winger to leave his lane for a support job (`discipline`, per metre
 * inside the lane band; narrow is free to come inside). `hold` is the base
 * value of the far-side "hold width" job: pin a defender or be the free man.
 * Without the ball it sets how far the block follows the attackers in its
 * zones (`follow`, a share of the gap to the attacker, and `reach`, metres
 * beyond the defender's ball-based offset from the block centre) and how
 * readily a defender leaves his zone towards the touchline to mark a man who
 * is not yet dangerous (`allowance`: it scales his leash and divides the cost
 * per metre) or steps inside to pick one up (`inward`: narrow is zone-minded
 * and steps in, not out, to protect the centre; wide is man-minded and
 * follows a man wherever he goes).
 * Narrow protects the centre and concedes the far man; wide follows him and
 * risks gaps inside; standard sits between. */
export const WIDTH:Record<Tactics['width'],{lane:number;pull:number;discipline:number;hold:number;follow:number;reach:number;allowance:number;inward:number}>=S.objView(S.WIDTH,['lane','pull','discipline','hold','follow','reach','allowance','inward']);
/** Width in a formation without wingers (2-1-1): how far the centre-backs
 * split in possession (`backs`, a factor on their lane offset) and how much
 * the midfielder follows the ball's side (`middle`, a factor on the team's
 * lateral shift). Formations with wingers keep both at 1: there the wingers
 * carry the setting. */
export function buildUpSpread(players:readonly {side:Side;role:string}[],side:Side,width:Tactics['width']):{backs:number;middle:number}{
 if(players.some(p=>p.side===side&&(p.role==='W'||p.role==='FB')))return {backs:1,middle:1};
 return BUILDUP_SPREAD[width];
}
const BUILDUP_SPREAD:Record<Tactics['width'],{backs:number;middle:number}>=S.spreadView();
/** A winger's lane in possession: how wide he holds, from the centre line. */
export const laneY=(width:Tactics['width'])=>Math.min(W/2-1.5,WIDTH[width].lane);

/** A moving team reference, with individual jobs around it. It observes the
 * ball's current motion, not the selected next pass or its eventual recipient.
 * All targets are invitations executed by normal movement/contact physics. */
export function teamShape(players:PracticePlayer[],ball:MovingBall,attacking:Side,side:Side,tactics:Tactics,time:number,previous:TeamShape|null=null,unavailable:ReadonlySet<string>=new Set(),ignore:ReadonlySet<string>=new Set(),sight?:Sight):TeamShape {
 const own=side===attacking,mates=players.filter(p=>p.side===side&&p.role!=='GK'&&!unavailable.has(p.id));
 const owner=players.find(p=>p.id===ball.owner);
 // Read a short visible flight, not the full destination of a fast pass.
 const focus=owner?{x:owner.x,y:owner.y}:inside({x:ball.x+ball.vx*.25,y:ball.y+ball.vy*.25});
 const bd=depth(side,focus.x),changed=!previous||previous.attacking!==own;
 const changedAt=changed?time:previous.changedAt,transition=time-changedAt<3;
 const dt=previous?clamp(time-previous.time,0,.5):0;
 const actualBack=mean(mates.filter(p=>p.role==='CB').map(p=>depth(side,p.x)),Math.max(X(6),bd-X(20)));
 const actualMiddle=mean(mates.filter(p=>p.role==='DM'||p.role==='CM'||p.role==='AM'||(tactics.formation==='5-4-1'||tactics.formation==='1-2-1')&&p.role==='W').map(p=>depth(side,p.x)),actualBack+X(14));
 let back:number,middle:number,front:number,shift:number;
 let phase:TeamShape['phase'];
 if(own){
  middle=clamp(bd-1+(tactics.commit-3),X(20),X(80));
  // Front/midfield should remain available to the actual supporting unit,
  // including during the seconds needed for the backs to join a recovery.
  middle=Math.min(middle,actualBack+X(25));
  // M1: only a deep line keeps an absolute cap on its rest defence; standard
  // and high support the attack from behind the ball, held back only by
  // their cushion to the opponents' deepest forward (drops, below).
  back=clamp(middle-X(15),X(6),LINE_SHAPE_CAP[tactics.line]);
  front=Math.min(X(96),middle+(tactics.progression==='direct'?X(20):X(16)),actualMiddle+X(26));
  shift=clamp(focus.y*.38,-Y(11),Y(11));
  const progressing=previous&&bd-depth(side,previous.focus.x)>1;
  phase=bd<X(35)?'build':progressing||transition?'advance':'circulate';
 }else{
  const nearest=owner?Math.min(...mates.filter(p=>depth(side,p.x)<bd+1).map(p=>distance(p,owner))):Infinity;
  const pressure=clamp((5-nearest)/4,0,1);
  // Pressure gives the supporting line permission to step. Without it the
  // same line protects more depth, while staying attached to its midfield.
  const ceiling={deep:X(36),standard:X(45),high:X(53)}[tactics.line];
  back=clamp(bd-X(22)+pressure*X(5),X(4),ceiling);
  const gap=clamp(bd*.17+X(3),X(7),X(13));
  middle=back+gap;front=middle+clamp(bd*.12+X(3),X(8),X(13));
  const {lean,cap}=PRESS_LEAN[tactics.press];
  shift=clamp(focus.y*lean,-cap,cap);
  phase=transition?'recover':'block';
 }
 // Ordinary passes retain a continuous reference. A turnover changes the
 // target immediately: smoothing across that change would send recovering
 // players forward for a second or two. Their physical motion never jumps.
 if(previous&&!changed){
  const rate=own?5.5:6.5;
  back=toward(previous.back,back,rate*dt);middle=toward(previous.middle,middle,rate*dt);front=toward(previous.front,front,rate*dt);
  shift=toward(previous.shift,shift,5*dt);
 }
 const slots:TeamShape['slots']={};
 const backCount=mates.filter(p=>p.role==='CB').length;
 // Without wingers (2-1-1) Width spreads the build-up instead: the centre-
 // backs split wider or stay closer, and the midfielder follows the ball's
 // side less (a switch angle through the middle) or more (closer support).
 const spread=buildUpSpread(players,side,tactics.width);
 const base:{p:PracticePlayer;x:number;y:number;kind:Duty}[]=[];
 for(const p of mates){
  let x:number,y:number,kind:Duty=own?'support':'hold';
  const wide=WIDTH[tactics.width].lane;
  if(own){
   if(p.role==='CB'){x=back;y=p.lane*Y(backCount===3?10:9)*spread.backs+shift*.75;kind='cover';}
   else if(p.role==='DM'){x=middle-X(7);y=p.lane*Y(8)+shift*.8;kind='cover';}
   else if(p.role==='FB'){
    const near=p.lane*focus.y>=0;
    x=tactics.fullbacks==='hold'?back+5:middle+(near?1:-5)+(tactics.fullbacks==='overlap'?3:0);
    y=p.lane*wide+shift*.4;kind=tactics.fullbacks==='hold'?'cover':'width';
   }else if(p.role==='CM'||p.role==='AM'){x=middle+(p.role==='AM'?7:1)-p.traits.comesShort*3;y=p.lane*11+shift*spread.middle;}
   // A winger holds his lane; narrow brings his resting position towards the
   // ball's side (closer support), wide keeps it on the touchline.
   else if(p.role==='W'){x=front-X(3);y=p.lane*wide+(focus.y-p.lane*wide)*WIDTH[tactics.width].pull;kind='width';}
   else{x=front;y=shift*.65;kind='show';}
  }else{
   if(p.role==='CB'){x=back;y=p.lane*Y(backCount===3?8:7)+shift;}
   else if(p.role==='FB'){x=back+1.5;y=p.lane*(backCount===3?16:18)+shift;}
   else if(p.role==='DM'){x=middle-3;y=p.lane*6+shift;}
   else if(p.role==='CM'||p.role==='AM'){x=middle+(p.role==='AM'?2:0);y=p.lane*9+shift;}
   else if(p.role==='W'){x=(tactics.formation==='5-4-1'||tactics.formation==='1-2-1')?middle:front-X(3);y=p.lane*((tactics.formation==='5-4-1'||tactics.formation==='1-2-1')?Y(18):Y(17))+shift;}
   else{x=front;y=shift*.7;}
   // The block narrows progressively near its own box. Far-side defenders
   // tuck with their unit; they do not keep occupying a distant touchline.
   // (Width no longer scales this ball-based spread: it prices how far the
   // block follows the attackers in its zones, below.)
   y=shift+(y-shift)*clamp(bd/X(42),.65,1);
   if(transition&&depth(side,p.x)>x+5)kind='recover';
  }
  base.push({p,x,y,kind});
 }
 const pulls:Record<string,number>={};
 if(!own){
  const target=blockPulls(players,side,base,shift,focus,bd,tactics.width,owner?.id,ignore,time,sight);
  for(const {p} of base){
   // How quickly he reacts to his man is his own read (R2): a sharp reader
   // adjusts at ~5.5 m/s, a poor one at ~3.5 m/s.
   const next=target[p.id]??0,old=previous&&!changed?previous.pulls?.[p.id]??0:next;
   pulls[p.id]=toward(old,next,(2.5+3*acuity(p,'threat'))*dt);
  }
 }
 // M1: each back-line player keeps the Line's cushion to the deepest
 // threatening attacker, as he reads him: defending, the other side's deepest
 // man bar the carrier; in possession, their deepest counter outlet (goal-
 // side of our ball and not pressing it), which is what holds our rest
 // defence back.
 const drops:Record<string,number>={},cushion=LINE_CUSHION[tactics.line];
 if(cushion!==null)for(const {p,x,kind} of base){
  if(p.role!=='CB'&&p.role!=='FB'||own&&kind!=='cover')continue;
  const seen=lineThreat(p,players,side,owner?.id,time,own?focus:undefined);
  const next=seen?Math.min(0,depth(side,seen.x)-cushion-x):0;
  const old=previous&&!changed?previous.drops?.[p.id]??0:next;
  drops[p.id]=toward(old,next,lineReaction(p,seen,next<old)*dt);
 }
 for(const {p,x:x0,y:y0,kind} of base){
  const y=y0+(pulls[p.id]??0),x=x0+(drops[p.id]??0);
  const aim=inside({x:depth(side,x),y},kind==='width'),gap=distance(p,aim);
  // Small positional corrections need less urgency than reconnecting a line.
  // Regroup ("On losing it") drops into shape at once: a full-speed run
  // back, which costs energy; otherwise a firm .9.
  const effort=kind==='recover'?(tactics.onLoss==='regroup'?1:.9):own?clamp(.32+gap*.033,.34,.78):clamp((.32+gap*.033)*PRESS_LEAN[tactics.press].effort,.34,.84*PRESS_LEAN[tactics.press].effort);
  slots[p.id]={aim,kind,speed:p.pace*effort,reason:own?
   'Se deplasează cu linia lui și păstrează legătura cu următorul compartiment.':
   kind==='recover'?'Revine spre colegi după pierdere, pentru a reface liniile.':
   'Glisează cu blocul; protejează spațiul dintre colegi și următoarea linie.'};
 }
 return {side,attacking:own,time,changedAt,phase,back,middle,front,shift,focus,slots,width:tactics.width,drops,...(own?{}:{pulls})};
}

/** M1, the no-offside Line. There is no offside, so the only reference for
 * the back line's height other than the ball is the deepest attacker. The
 * back line stands at the less exposed of its ball-based height (above; the
 * Line's ceiling is the press height) and a cushion to the deepest
 * threatening attacker (not the carrier, who is pressed) as each back-line
 * player reads him:
 *  - deep: at least LINE_CUSHION.deep m goal-side of him, dropping with a
 *    runner (read LINE_LEAD s ahead along his run towards goal) or a
 *    forward who stays up as a reference;
 *  - standard: roughly level with him;
 *  - high: holds its height and leaves him to his marker: the space behind
 *    is the price of a compact, high block.
 * The read is the defender's own (R2): where he puts the attacker is off by
 * up to LINE_SPREAD m for a non-reader, and how quickly he adjusts depends on
 * his reading, his legs (a tired player reacts slower) and whether the man
 * is in front of him or running from behind his shoulder. */
export const LINE_CUSHION:Record<Tactics['line'],number|null>=S.view(S.LINE,'cushion');
export const LINE_SPREAD=3,LINE_LEAD=.5,LINE_VIEW=100*Math.PI/180;
/** In possession, how high the back line may support the attack regardless
 * of the opponents (m from own goal): a deep line keeps its old cap; standard
 * and high are held back only by their cushion (the shape's unit, and each
 * back's build-up ceiling). */
export const LINE_SHAPE_CAP:Record<Tactics['line'],number>=S.view(S.LINE,'backCap');
export const LINE_BUILD_CAP:Record<Tactics['line'],number>=S.view(S.LINE,'buildCap');
/** The highest this back will stand for the Line's cushion to the deepest
 * attacker he reads (m from his own goal; Infinity for high or nobody).
 * `ball`: our ball, when we have it (see lineThreat). */
export function lineHeight(p:PracticePlayer,players:readonly PracticePlayer[],line:Tactics['line'],carrier?:string,time?:number,ball?:Vec):number{
 const cushion=LINE_CUSHION[line];if(cushion===null)return Infinity;
 const seen=lineThreat(p,players,p.side,carrier,time,ball);
 return seen?depth(p.side,seen.x)-cushion:Infinity;
}
/** How much an opponent is on our ball: the carrier's own pressure read
 * (practice-possession possessionSafety: within 4 m, or there within 1.2 s),
 * 0 when he is not. */
export const onOurBall=(a:PracticePlayer,ball:Vec)=>Math.max(clamp((4-distance(a,ball))/4,0,1),clamp((1.2-arrivalTime(a,ball))/1.2,0,1));
/** The deepest threatening attacker as this defender reads him: his read
 * position (depth along his own goal axis), or null when there is none.
 * In possession (`ball`, r1-shape 2026-10-14) the threat the Line keeps
 * cover for is a counter outlet: a man who would be free behind the ball if
 * we lost it. A man goal-side of the ball who is pressing it is not one (he
 * is the carrier's to play around; if he wins it, he is the ball, not a
 * runner behind it), and nobody upfield of the ball is either. Before, one
 * presser walking into our box held both backs on the goal line behind him
 * while their own keeper had the ball. */
export function lineThreat(p:PracticePlayer,players:readonly PracticePlayer[],side:Side,carrier:string|undefined,time?:number,ball?:Vec):(Vec&{id:string;behind:boolean})|null{
 let best:(Vec&{id:string;behind:boolean})|null=null,bestDepth=Infinity;
 const bd=ball?depth(side,ball.x):Infinity;
 for(const a of players){
  if(a.side===side||a.role==='GK'||a.id===carrier)continue;
  if(ball&&onOurBall(a,ball)>0)continue;
  const towards=side===0?-a.vx:a.vx;
  const lead=depth(side,a.x)-Math.max(0,towards)*LINE_LEAD;
  const seen=perceive(p,'threat',lead,LINE_SPREAD,a,{time,salt:`line${a.id}`});
  if(seen>=bestDepth||seen>=bd)continue;
  const bearing=Math.atan2(a.y-p.y,a.x-p.x),off=Math.abs(Math.atan2(Math.sin(bearing-p.angle),Math.cos(bearing-p.angle)));
  bestDepth=seen;best={x:side===0?seen:L-seen,y:a.y,id:a.id,behind:off>LINE_VIEW&&Math.hypot(a.vx,a.vy)>=2.5};
 }
 return best;
}
/** How fast (m/s of reference) he adjusts his depth to the man: a sharp,
 * fresh reader ~6.5, a poor or tired one ~3; half as fast dropping for a
 * runner from behind his shoulder. */
export function lineReaction(p:PracticePlayer,seen:{behind:boolean}|null,dropping:boolean):number{
 const legs=clamp(p.pace/Math.max(.1,p.basePace||p.pace),.6,1);
 return (2.5+4*acuity(p,'threat'))*legs*(dropping&&seen?.behind?.5:1);
}

/** The zonal block reacts to the attackers, not only to the ball. The
 * threatening attackers (not the carrier, who is pressed) are shared out
 * between the defenders' zones in lateral order, left to right, as a zonal
 * block does: every attacker who can be is someone's responsibility, and
 * among such sharings the one with the least lateral travel wins. A
 * defender's slot is drawn towards his attacker in proportion to the man's
 * threat (closer to our goal, and not far behind the ball) and to what Width asks:
 * narrow follows little and keeps the centre, conceding the far man; wide
 * follows him and leaves gaps inside. A compactness budget caps every pull:
 * no defender stands further from the block centre than his own ball-based
 * offset plus the setting's reach. The single front screen (ST) keeps his
 * place. Players under an explicit instruction, and the attackers they are
 * told to mark, are left to that instruction (`ignore`). */
export const THREAT_SPREAD=.5,MAN_SPREAD=2;
export function blockPulls(players:readonly PracticePlayer[],side:Side,base:readonly {p:PracticePlayer;x:number;y:number}[],shift:number,focus:Vec,bd:number,width:Tactics['width'],carrier:string|undefined,ignore:ReadonlySet<string>=new Set(),time?:number,sight?:Sight):Record<string,number>{
 const {follow,reach}=WIDTH[width];
 const zone=base.filter(b=>b.p.role!=='ST'&&!ignore.has(b.p.id));
 if(!zone.length)return {};
 const threats:{x:number;y:number;threat:number;id:string;a:PracticePlayer}[]=[];
 const threatOf=(a:Vec)=>{const da=depth(side,a.x);return clamp((X(75)-da)/X(45),0,1)*clamp((bd+8-da)/6,0,1);};
 for(const a of players){
  if(a.side===side||a.role==='GK'||a.id===carrier||ignore.has(a.id))continue;
  const threat=threatOf(a);
  if(threat>0)threats.push({x:a.x,y:a.y,threat,id:a.id,a});
 }
 // Order-preserving sharing (both lists left to right): most threat covered
 // first, then least lateral travel. At most four of each in 5v5.
 const D=zone.slice().sort((a,b)=>a.y-b.y||a.p.id.localeCompare(b.p.id)),A=threats.sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id));
 const best:number[][]=Array.from({length:D.length+1},()=>Array(A.length+1).fill(0));
 for(let i=1;i<=D.length;i++)for(let j=1;j<=A.length;j++)
  best[i][j]=Math.max(best[i-1][j],best[i][j-1],best[i-1][j-1]+A[j-1].threat*100-Math.abs(D[i-1].y-A[j-1].y));
 const claimed=new Map<string,{x:number;y:number;threat:number;id:string;a:PracticePlayer}>();
 for(let i=D.length,j=A.length;i>0&&j>0;){
  if(best[i][j]===best[i-1][j])i--;
  else if(best[i][j]===best[i][j-1])j--;
  else{claimed.set(D[i-1].p.id,A[j-1]);i--;j--;}
 }
 const pulls:Record<string,number>={};
 for(const b of zone){
  const a=claimed.get(b.p.id);if(!a)continue;
  // The sharing is the block's (zonal communication); how much each defender
  // makes of his man is his own read (R2): the man's threat and where he
  // stands, by reading (70%) and defending (30%). A good reader follows the
  // right man by the right amount; a poor one over- or under-reacts.
  // He reads his man as he last saw him (M3: a moment late, practice-
  // perception sightLag); the zonal sharing above is the block's.
  const v=sight?sight(b.p,a.a):a,exact=sight?threatOf(v):a.threat;
  const seen=clamp(perceive(b.p,'threat',exact,THREAT_SPREAD,a,{time,salt:a.id}),0,1);
  const ay=perceive(b.p,'threat',v.y,MAN_SPREAD,a,{time,salt:`y${a.id}`});
  const limit=Math.abs(b.y-shift)+reach;
  const y=shift+clamp(b.y+follow*seen*(ay-b.y)-shift,-limit,limit);
  pulls[b.p.id]=y-b.y;
 }
 return pulls;
}

/** Tight tracking is a local departure from the unit. Dangerous runners may
 * break the line at little cost. For anyone else following is a priced
 * trade-off, not a fixed leash: the defender follows as far as the man is
 * worth (nearer our goal, more), less far when going with him would leave the
 * centre empty (no team-mate inside him) and further when a team-mate still
 * covers inside; the team's Width sets the price (narrow protects the centre
 * and concedes the far man, wide follows him and risks the gap inside).
 * Declining returns null: the man stays free and the defender keeps his zone. */
export function markingDeparture(defender:PracticePlayer,target:PracticePlayer,aim:Vec,shape:TeamShape,style:Tactics['marking']='balanced'):number|null {
 const slot=shape.slots[defender.id];if(!slot)return null;
 const td=depth(defender.side,target.x),bd=depth(defender.side,shape.focus.x);
 const towardsGoal=(defender.side===0?-1:1)*target.vx,inward=-Math.sign(target.y)*target.vy;
 // Y(23) is a central channel from the 11-a-side pitch (10 m here). A 5 m goal
 // on a 30 m pitch is still attacked from wider: a player near goal who is
 // running goalward or inside is dangerous anywhere short of the touchline.
 const near=td<X(23)||td<shape.back+X(7)&&td<bd+X(7);
 const danger=Math.abs(target.y)<Y(23)&&(near||towardsGoal>1.5&&td<shape.back+X(13))||
  Math.abs(target.y)<W/2-2&&near&&(towardsGoal>1.5||inward>1.5);
 const departure=distance(slot.aim,aim);
 if(danger)return Math.max(0,departure-3)*.025;
 const leash=style==='tight'?(defender.role==='CB'?12:17):style==='zonal'?4:defender.role==='CB'?7:10;
 // Worth of the man: from nothing 27 m out to full value 9 m from our goal.
 const worth=clamp((X(60)-td)/X(40),0,1);
 // Going with him towards the touchline opens the centre unless a team-mate
 // (level or deeper) stands inside; stepping inwards opens nothing. Width
 // prices the outward trip; narrow also steps inside more readily. (A
 // narrow price on every departure left central runners free as well, the
 // opposite of protecting the centre.)
 const sd=depth(defender.side,slot.aim.x);
 const outward=Math.abs(aim.y)>Math.abs(slot.aim.y)+1;
 const setting=WIDTH[shape.width??'standard'],price=outward?setting.allowance:setting.inward;
 const covered=Object.entries(shape.slots).some(([id,q])=>id!==defender.id&&depth(defender.side,q.aim.x)<=sd+3&&Math.abs(q.aim.y)<Math.abs(slot.aim.y)-1);
 const gap=outward?(covered?1:.75):1.15;
 const allowance=leash*price*(.8+.4*worth)*gap;
 if(departure>allowance)return null;
 return Math.max(0,departure-3)*(style==='tight'?.06:style==='zonal'?.3:.16)/price;
}
