import * as S from './style.js';
import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {Tactics} from './model.js';
import type {Vec} from './movement.js';
import type {PracticePlayer} from './practice.js';
import type {SupportContext,SupportMove,SupportPlan} from './practice-support.js';
import {arrivalTime} from './practice-defense.js';
import {launchRisk} from './practice-possession.js';
import {buildUpSpread,lineHeight,LINE_BUILD_CAP,onOurBall} from './practice-shape.js';
import {ownGoalDanger} from './practice-possession.js';
import {LOSS_SCALE} from './practice-rest-defence.js';
import {supportWorth,releaseRoomAt,lossThreat,ownGoalSupportPoints,RECEIVE_LOSS} from './practice-support.js';
/** r1-shape v5: how much of the cover price each Line keeps in possession near our goal. */
export const LINE_CAUTION:Record<Tactics['line'],number>=S.view(S.LINE,'coverPrice');

type LaneRisk=(from:Vec,to:Vec,defenders:PracticePlayer[],speed?:number)=>number;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const depth=(side:number,x:number)=>side===0?x:L-x;
const world=depth;
const inside=(p:Vec)=>({x:clamp(p.x,1,(L-1)),y:clamp(p.y,-(W/2-5),(W/2-5))});

/** The back line travels with possession and offers return/switch angles.
 * One player remains the deeper balance; visible counter threats can keep
 * additional backs deeper. These are movement choices, never forced passes. */
export function assignBuildUp(players:PracticePlayer[],receiver:PracticePlayer,tactics:Tactics,laneRisk:LaneRisk,context:SupportContext,nearby:SupportMove[],previous:SupportPlan|null=null,unavailable:ReadonlySet<string>=new Set()):SupportMove[]{
 const owner=context.receiving?{...receiver,...context.receiving.aim}:receiver,side=owner.side,bd=depth(side,owner.x);
 const backs=players.filter(p=>p.side===side&&p.role==='CB'&&p.id!==owner.id&&!unavailable.has(p.id));
 if(!backs.length)return [];
 const mates=players.filter(p=>p.side===side&&p.id!==owner.id&&p.role!=='GK'&&!unavailable.has(p.id));
 const opponents=players.filter(p=>p.side!==side),outfield=opponents.filter(p=>p.role!=='GK');
 // A high line/commitment can connect farther forward, but this is not a
 // licence to send a centre-back beyond the ball.
 // M1: Line in possession. A deep line keeps its old cap (or 11 m behind the
 // ball); standard and high support from behind the ball. Each back also
 // keeps the Line's cushion to the opponents' deepest counter outlet as he
 // reads him (deep 2 m goal-side, standard level; high leaves him to the
 // counter-cover). A man pressing our ball is not one (lineThreat, r1-shape):
 // the backs play around him instead of standing behind him.
 const ceilingFor=(p:PracticePlayer)=>Math.min(Math.max(LINE_BUILD_CAP[tactics.line],bd-11),lineHeight(p,players,tactics.line,owner.id,context.time,owner));
 const goalkeeper=owner.role==='GK',centreBack=owner.role==='CB';
 const connectedFor=(ceiling:number)=>goalkeeper?clamp(bd+X(12),X(12),X(27)):centreBack?clamp(bd-3,5,ceiling):clamp(bd-X(16)+(tactics.commit-S.COMMIT.neutral.v),X(6),ceiling);
 // A player chasing the carrier from behind is not automatically an unmarked
 // counter-attacking outlet that should pin our last defender to his own goal.
 const threats=outfield.filter(p=>depth(side,p.x)<bd-X(7)&&Math.abs(p.y)<Y(22)&&distance(p,owner)>8)
  .filter(p=>!mates.some(q=>q.role!=='CB'&&depth(side,q.x)<depth(side,p.x)-1&&distance(q,p)<8))
  .sort((a,b)=>depth(side,a.x)-depth(side,b.x)||a.id.localeCompare(b.id));
 const old=previous?.side===side?previous.moves.filter(m=>['build-up','counter-cover'].includes(m.purpose)):[];
 const assigned=new Map<string,PracticePlayer>(),used=new Set<string>();
 // Match the most advanced counter outlets to distinct backs. The rest can
 // connect to midfield without all reacting to the same opponent.
 for(const threat of threats.slice(0,backs.length)){
  const point={x:world(side,depth(side,threat.x)-2),y:threat.y};
  const candidates=backs.filter(p=>!used.has(p.id)).sort((a,b)=>
   (distance(a,point)-(old.some(m=>m.player===a.id&&m.purpose==='counter-cover')?2:0))-
   (distance(b,point)-(old.some(m=>m.player===b.id&&m.purpose==='counter-cover')?2:0))||a.id.localeCompare(b.id));
  if(candidates[0]){assigned.set(candidates[0].id,threat);used.add(candidates[0].id);}
 }
 const balance=backs.slice().sort((a,b)=>
  ((a.lane*owner.y)-(old.some(m=>m.player===a.id&&m.purpose==='counter-cover')?8:0))-
  ((b.lane*owner.y)-(old.some(m=>m.player===b.id&&m.purpose==='counter-cover')?8:0))||a.id.localeCompare(b.id))[0];
 const selected:SupportMove[]=[];
 // Width spreads a wingerless build-up (buildUpSpread); the shape slot, when
 // used, already carries it.
 const spread=buildUpSpread(players,side,tactics.width).backs;
 // Resolve the deeper cover first, then create a different angle for the others.
 // (r1-shape v5) Near our own goal (ownGoalDanger, the carrier's own read)
 // the fixed connection depths fade out (`anchor`): a back's height there
 // comes from what the pass to him is worth and from the cover the team
 // needs if the ball is lost. Cover: the balance back keeps himself between
 // a ball lost where it is and our goal (goal-side of the ball, near its
 // line to our goal), priced at what that loss would give them (lossThreat)
 // x the chance the carrier loses it (RECEIVE_LOSS, more as he is pressed)
 // x how cautious the Line is (deep keeps more of it, high less). With the
 // keeper on the ball nobody can be goal-side of it, so it prices nothing:
 // both backs split and offer.
 const near=ownGoalDanger(owner),anchor=1-near;
 const pressed=Math.max(0,...outfield.map(q=>onOurBall(q,owner)));
 const lossHere=near>0?lossThreat(side,owner,players,owner.id):0,coverPrice=LOSS_SCALE*lossHere*(RECEIVE_LOSS+(1-RECEIVE_LOSS)*pressed)*LINE_CAUTION[tactics.line]*near;
 const goal={x:world(side,0),y:0};
 const coverCost=(aim:Vec)=>{
  if(!coverPrice)return 0;
  const behind=clamp((bd-depth(side,aim.x))/2,0,1);
  const vx=goal.x-owner.x,vy=goal.y-owner.y,len=Math.hypot(vx,vy)||1,t=clamp(((aim.x-owner.x)*vx+(aim.y-owner.y)*vy)/(len*len),0,1);
  const off=Math.hypot(owner.x+vx*t-aim.x,owner.y+vy*t-aim.y);
  return coverPrice*(1-behind*clamp(1-off/5,0,1));
 };
 const ordered=backs.slice().sort((a,b)=>Number(b.id===balance.id||assigned.has(b.id))-Number(a.id===balance.id||assigned.has(a.id))||a.id.localeCompare(b.id));
 for(const p of ordered){
  const threat=assigned.get(p.id),cover=p.id===balance.id||!!threat;
  const maximum=goalkeeper?Math.min(X(29),bd+X(17)):Math.max(3,bd-X(4));
  const slot=!goalkeeper&&!centreBack?context.shape?.slots[p.id]:undefined;
  // The unit shape already depends on the back's actual position. Taking only
  // that shape, subtracting cover depth and pricing travel can lock him there.
  // Keep a ball-relative connection target while retaining genuine threats.
  const ceiling=ceilingFor(p),connected=connectedFor(ceiling);
  const shared=slot?Math.max(depth(side,slot.aim.x),connected-1):connected;
  const desiredDepth=clamp(Math.min(shared+(cover?-1:2+p.traits.comesShort*2),threat?depth(side,threat.x)-2:Infinity),3,maximum);
  const nominalY=clamp(slot?.aim.y??p.lane*(goalkeeper?Y(15):Y(11))*spread+owner.y*.22,-Y(22),Y(22));
  const depthLimit=Math.min(maximum,threat?Math.max(3,Math.min(ceiling,depth(side,threat.x)-.8)):ceiling);
  const candidates:Vec[]=[];
  // (r1-shape) ... and the angle level with the play (as high as this back
  // may go), so what the spot is worth to the carrier can choose it.
  for(const x0 of [desiredDepth,desiredDepth-3,desiredDepth+3,depthLimit])for(const dy of [0,-5,5]){
   const x=clamp(x0,3,depthLimit);
   candidates.push(inside({x:world(side,x),y:nominalY+dy}));
  }
  // (r1-shape v5) Near our own goal the spots also come from the situation
  // (around him, level with and wide of the ball, ahead of it, the edge of
  // the box and beyond), within how high this back may go; the fixed
  // connection depth above fades out there (`anchor`), and what each spot is
  // worth to the carrier, and the cover it keeps, choose.
  if(near>0)for(const v of ownGoalSupportPoints(p,owner)){
   const d=depth(side,v.x);if(d<=depthLimit+.01)candidates.push(v);
  }
  const prior=old.find(m=>m.player===p.id&&m.until>context.time&&depth(side,m.aim.x)<=depthLimit&&distance(m.aim,{x:world(side,desiredDepth),y:nominalY})<8);
  if(prior)candidates.unshift(prior.aim);
  const risk=(aim:Vec)=>Math.max(laneRisk(owner,aim,opponents),launchRisk(owner,aim,players,.2));
  const score=(aim:Vec)=>{
   const space=Math.min(...outfield.map(q=>distance(q,aim)));
   const occupied=Math.max(0,...[...nearby,...selected].filter(m=>m.player!==p.id).map(m=>clamp((6-distance(aim,m.aim))/6,0,1)));
   const separation=Math.max(0,...mates.filter(q=>q.id!==p.id&&q.role!=='CB').map(q=>clamp((3.5-distance(q,aim))/3.5,0,1)));
   return risk(aim)*(.8+(1-p.traits.risk)*.25)+arrivalTime(p,aim)*.075+
    distance(aim,{x:world(side,desiredDepth),y:nominalY})*.025*anchor+Math.abs(aim.y-nominalY)*.025*(1-anchor)+occupied*1.5+separation+
    (cover&&!threat?coverCost(aim):0)+
    clamp((4-space)/4,0,1)*1.2+(distance(owner,aim)<5?2:0)+Math.max(0,distance(owner,aim)-12)*.09-(prior&&distance(prior.aim,aim)<.1?.13:0)+
    // (r1-shape) less what the pass there is worth to the carrier
    -supportWorth(owner,aim,risk(aim),releaseRoomAt(p,aim,players,owner),players,p.id);
  };
  const ranked=candidates.map(aim=>({aim,score:score(aim)}));
  const aim=ranked.reduce((a,b)=>b.score<a.score-.001?b:a).aim,available=risk(aim)<.72&&distance(owner,aim)<=33;
  const continuing=prior&&distance(prior.aim,aim)<.1;
  selected.push({player:p.id,purpose:cover?'counter-cover':'build-up',kind:cover?'cover':'support',aim,
   speed:p.pace*(context.time-context.recoveredAt<3?.8:.7),since:continuing?prior.since:context.time,
   until:continuing?prior.until:context.time+1.5,
   reason:threat?'Oferă un unghi de întoarcere, păstrând adversarul de contraatac în fața lui.':
    cover?'Urcă odată cu echipa, dar rămâne mai jos pentru întoarcerea mingii și acoperire.':
    available?'Iese din umbra adversarului și deschide o pasă înapoi, pentru continuare sau schimbarea flancului.':
    'Se apropie de construcție și caută un alt unghi; culoarul de întoarcere este încă închis.'});
 }
 return selected;
}
