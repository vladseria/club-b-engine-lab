// Ceiling routes (2026-10-20): the "perfect route" controllers, installed as globalThis.__rt for one side through the
// hook points in hook.mjs. Evidence only. Nothing here touches skills, duel odds, finishing, keepers or physics: the
// controller only (a) gives team-mates manager-committed runs to the pattern's spots, inside the route's window only
// (H1: ordinary movement at the player's own pace and acceleration, run speed 0.94 x pace as the engine's own runs;
// receivers and unavailable men are excluded by the engine), and (b) at a carrier's ordinary decision, with his options
// recomputed from the TRUE picture (exact()), plays the route when it is really on, otherwise leaves his ordinary
// (imperfect) choice untouched. Execution is the engine's.
//
// THE GATE ("really on"), the same for every route and for perfect Direct:
//  1. the route option exists among his options read from the true picture (no read error; the read `bias` argument
//     removed. Temperament applied outside perceive() stays: e.g. the shot's appetite, the price of losing it as a daring
//     man feels it; those are personality, not reads);
//  2. the route's own conditions hold on exact positions (per route below; every lane is the option's own exact risk,
//     LANE_OK);
//  3. it is the best, or within NEAR (0.06, 1.5 x the choice temperature 0.04 of practice-selection) of the best, of his
//     options on the true picture. Then he plays it (no draw). Otherwise nothing changes.
//  A prepared route kick survives the +0.18 re-read (H3) only while it is still near-best on the true picture with its
//  lane open; otherwise the ordinary re-read decides. Veto points NOT hooked (they stay as live, imperfect): a prepared
//  shot's recheck at release (no route kick is a prepared shot), the pass-into-space recheck at release, and the receiver's
//  check at the touch (P-shot can be dropped there).
// Exception, said in the readout: the take-on's choice score is a trait formula with no read in it, and its outcome is a
// known roll (practice.ts: 0.42 + (control - defender reading) x 0.055 + (1 - defender discipline) x 0.1, 0.12..0.8). For
// Isolation's take-on the gate is "truly 1 v 1 and the odds >= TAKE_ODDS (0.45)", unless a shot is clearly best: he knows
// his odds. (0.45, not 0.5: at 0.5 the average squad's winger (control 7.1, odds 0.46-0.50) could never take a man on.)
//
// Routes (ours = the probed side; slots: SQD2 centre-back, SQD3 left winger (lane -1), SQD4 right winger, SQD5 striker):
//  iso  Isolation, SQD3 the dribbler. Window: our ball at depth >= 16 (our possession). Moves: the dribbler holds a wide
//       spot in their half on his flank; once he is there (depth >= 22, wide) or has/is getting the ball, the striker and
//       the other winger clear to the far side (for 6 s after he receives). Gates: I-feed (anyone passes to him: he is in
//       their half, wide (|y| >= W/2 - 7), at most one outfielder within 7 m of him); I-take (he takes his man on:
//       depth >= 20, exactly one outfielder within 6 m, no other within 6 m of the take-on's exit, odds >= 0.45).
//  piv  Pivot lay-off, SQD5 the pivot. Window: our ball at depth 12-36 (he shows), and while the ball is his (5 s) or on
//       its way to him (the runners). Moves: he shows at a spot 12 m ahead of the ball (depth 28-35, |y| <= 4); once the
//       ball is his or on its way to him, the winger who gets there first runs to a lay-off spot 3.5 m behind him and 3 m
//       across, the other runs wide-far. Gates: P-in (a ground pass into his feet: he is in the zone, depth 26-37,
//       |y| <= 7); P-lay (within 5 s of receiving: a pass to an arriving winger 2-10 m from him, at most 9 m behind and
//       3 m ahead, running goalwards (>= 1 m/s) or at the spot); P-shot (that winger's in-flight plan: a shot, when it is
//       near-best on the true picture; first time or not is the engine's call, with its physical gates).
//  ovl  Flank overload. The flank is the ball's side once the ball is >= 3 m off the middle. Window: our ball at depth
//       >= 18. Moves: the far winger crosses to the flank (7 m in, 5 m ahead of the ball); once one of the two wingers has
//       the ball, the other overlaps (outside if the carrier is inside, else underlaps) 5 m ahead. Gates (carrier one of
//       the two, depth >= 18, mate 3-14 m away, exactly one opposing outfielder within 7 m of either): O-pass (that
//       defender is on the carrier: within 5 m and nearer him than the mate: pass to the mate); O-carry (the defender is
//       nearer the mate: carry forward >= 2 m, obstruction < 0.3); O-feed (another carrier finds the ball-side winger when
//       he is wide, depth >= 16, the far winger within 12 m of him and at most one outfielder within 7 m of either).
//  pd   Perfect Direct (the control): no moves; D-run: a through ball or loft to the striker while he is running in
//       behind (engine duty 'run', or >= 3 m/s goalwards at depth >= 24), lane LANE_OK.
// The centre-back, the keeper and every opponent are never instructed. Outside a window the engine's own jobs apply.
//
// shadow: the same detector, acting on nothing: logs [t, code, near-best on the true picture ? 1 : 0] where the route's
// conditions held on his ordinary options (the Direct arms carry it: a fired route compared with comparable moments).
import {L,W} from '../../src/pitch';
import {laneRisk} from '../../src/practice';

export type Route='iso'|'piv'|'ovl'|'pd';
export const NEAR=.06,LANE_OK=.25,TAKE_ODDS=.45,RUN=.94,JOG=.85;
const D=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const r1=(v:number)=>Math.round(v*10)/10;
const PASSES=['pass','through','loft'];

export interface RouteLog {
 fires:[number,string,string,string][];      // [t, code, actor slot, target slot]
 /** per gate code: [moments the route option existed on the true picture with its conditions, of those near-best (fired)];
  *  P-shot counts once per lay-off */
 met:Record<string,[number,number]>;
 setup:number;                                // seconds with route runs issued (time between coordination ticks, capped 0.25)
 shadow:[number,string,number][];             // [t, code, near-best] (shadow mode)
 keeps:number;                                // prepared route kicks kept through the +0.18 re-read
}

export function controller(route:Route,ours:0|1,shadow=false){
 const log:RouteLog={fires:[],met:{},setup:0,shadow:[],keeps:0};
 const id=(n:number)=>`${ours}:SQD${n}`,slot=(pid:string)=>pid?pid.split(':')[1]?.replace('SQD',''):'';
 const dep=(x:number)=>ours===0?x:L-x,wx=(d:number)=>ours===0?d:L-d,fwd=ours===0?1:-1;
 const get=(players:any[],pid:string)=>players.find((q:any)=>q.id===pid);
 const opp=(players:any[])=>players.filter((q:any)=>q.side!==ours&&q.role!=='GK');
 const oppAll=(players:any[])=>players.filter((q:any)=>q.side!==ours);
 const near=(players:any[],at:any,r:number)=>opp(players).filter((q:any)=>D(q,at)<r);
 const risk=(p:any,o:any,players:any[])=>o.pass?.risk??o.loft?.risk??laneRisk(p,o.aim,oppAll(players),22);
 const met=(code:string,fired:boolean)=>{const m=log.met[code]??(log.met[code]=[0,0]);m[0]++;if(fired)m[1]++;};
 const top=(all:any[])=>Math.max(...all.map((o:any)=>o.score));
 /** near-best on the true picture: the best candidate if within NEAR of his best option */
 const nearBest=(cands:any[],all:any[])=>{if(!cands.length)return null;const c=cands.reduce((a,b)=>b.score>a.score?b:a);return c.score>=top(all)-NEAR?c:null;};
 // route state (reset when possession changes)
 let possSide=-1,flank=0,recvAt:Record<string,number>={},lastOwner='',layTo='',layAt=-9,shotMet='',lastMoves=-1;
 const prevMove=new Map<string,{kind:string;aim:any;since:number;at:number}>();
 const track=(players:any[],ball:any,time:number)=>{
  const o=ball.owner?get(players,ball.owner):null;
  if(o){if(o.side!==possSide){possSide=o.side;flank=0;recvAt={};layTo='';layAt=-9;prevMove.clear();}
   if(o.id!==lastOwner){recvAt[o.id]=time;lastOwner=o.id;}}
  if(possSide===ours&&Math.abs(ball.y)>=3)flank=Math.sign(ball.y);
  return o;
 };
 /** a manager-committed run; `since` held while the same run continues (so the engine's records see one choice) */
 const mv=(p:any,aim:any,speed:number,kind:string,time:number,reason:string)=>{
  const a={x:clamp(aim.x,1,L-1),y:clamp(aim.y,-(W/2-1.2),W/2-1.2)},old=prevMove.get(p.id);
  const since=old&&old.kind===kind&&time-old.at<.6&&D(old.aim,a)<3?old.since:time;
  prevMove.set(p.id,{kind,aim:a,since,at:time});
  return {player:p.id,purpose:'playbook',kind,aim:a,speed:Math.min(p.pace,speed),since,until:time+.5,reason};
 };
 const at=(d:number,y:number)=>({x:wx(d),y});

 // ---------------------------------------------------------------- H1 moves
 function moves(time:number,players:any[],ball:any,preview:any,proposed:any,unavailable:Set<string>){
  const owner=track(players,ball,time);
  if(shadow||route==='pd')return undefined;
  if(preview.attacking!==ours)return undefined;
  if(!owner&&ball.mode!=='pass')return undefined;// loose balls: everyone's ordinary job
  if(owner&&owner.side!==ours)return undefined;
  const bd=dep(ball.x),out:any[]=[],free=(p:any)=>p&&!unavailable.has(p.id)&&p.id!==ball.owner&&p.id!==preview.flight?.receiver;
  const recv=preview.flight?.receiver as string|undefined;
  if(route==='iso'){
   if(bd<16)return undefined;
   const d=get(players,id(3)),s=get(players,id(5)),w=get(players,id(4)),fy=d.lane||-1;
   const dOn=(ball.owner===d.id&&time-(recvAt[d.id]??time)<6)||recv===d.id;
   const inSpot=dep(d.x)>=22&&Math.abs(d.y)>=W/2-7;
   if(free(d))out.push(mv(d,at(clamp(bd+8,26,36),fy*(W/2-1.8)),d.pace*JOG,'width',time,'Isolation: holds the wide spot in their half.'));
   if(dOn){
    if(free(s))out.push(mv(s,at(41,-fy*3),s.pace*JOG,'run',time,'Isolation: clears to the far post.'));
    if(free(w))out.push(mv(w,at(clamp(dep(d.x)+2,26,40),-fy*7),w.pace*JOG,'support',time,'Isolation: far half-space.'));
   }else if(inSpot){
    if(free(s))out.push(mv(s,at(clamp(bd+12,30,40),-fy*4),s.pace*JOG,'support',time,'Isolation: clears the dribbler\'s side.'));
    if(free(w))out.push(mv(w,at(clamp(bd+6,22,36),-fy*(W/2-3)),w.pace*JOG,'width',time,'Isolation: far flank.'));
   }
  }else if(route==='piv'){
   const s=get(players,id(5)),w3=get(players,id(3)),w4=get(players,id(4));
   const sPhase=(ball.owner===s.id&&time-(recvAt[s.id]??time)<5)||recv===s.id;
   if(sPhase){
    const ref=ball.owner===s.id?s:preview.flight?.meetings?.[s.id]??s,sd=dep(ref.x);
    const spot=(w:any)=>{const sy=Math.sign(w.y-ref.y)||(w===w3?-1:1);return at(sd-3.5,clamp(ref.y+sy*3,-(W/2-2),W/2-2));};
    const ws=[w3,w4].filter(free);
    if(ws.length){
     const runner=ws.reduce((a,b)=>D(b,spot(b))/b.pace<D(a,spot(a))/a.pace?b:a);
     out.push(mv(runner,spot(runner),runner.pace*RUN,'run',time,'Pivot: arrives for the lay-off.'));
     for(const w of ws)if(w!==runner){const sy=Math.sign(w.y)||1;out.push(mv(w,at(sd+1,sy*9),w.pace*JOG,'run',time,'Pivot: second option wide.'));}
    }
   }else if(bd>=12&&bd<36&&ball.owner!==s.id){
    const sd=clamp(bd+12,28,35);
    if(free(s))out.push(mv(s,at(sd,clamp(ball.y*.3,-4,4)),s.pace*JOG,'show',time,'Pivot: shows back to goal for the ball into feet.'));
   }
  }else if(route==='ovl'){
   if(!flank||bd<18)return undefined;
   const w3=get(players,id(3)),w4=get(players,id(4)),wb=flank<0?w3:w4,wo=flank<0?w4:w3;
   const overlap=(c:any,m:any)=>{if(!free(m))return;const outside=Math.abs(c.y)<W/2-4;out.push(mv(m,at(dep(c.x)+5,outside?flank*(W/2-1.6):flank*6),m.pace*RUN,'run',time,outside?'Overload: overlaps outside the carrier.':'Overload: underlaps inside the carrier.'));};
   if(ball.owner===wb.id||recv===wb.id)overlap(wb,wo);
   else if(ball.owner===wo.id||recv===wo.id)overlap(wo,wb);
   else if(free(wo))out.push(mv(wo,at(clamp(bd+5,18,36),flank*7),wo.pace*JOG,'support',time,'Overload: far winger joins the flank.'));
  }
  if(!out.length)return undefined;
  log.setup+=lastMoves<0?.25:clamp(time-lastMoves,0,.25);lastMoves=time;
  return {owner:ball.owner??'',side:ours,moves:[...(proposed?.side===ours?proposed.moves.filter((m:any)=>!out.some(o=>o.player===m.player)):[]),...out]};
 }

 // ---------------------------------------------------------------- the detectors (shared by gate and shadow)
 /** The route groups for carrier p among `opts`: [] when the route's position conditions fail. */
 function candidates(p:any,players:any[],ball:any,time:number,opts:any[]):{code:string;cands:any[];force?:boolean}[]{
  const res:{code:string;cands:any[];force?:boolean}[]=[];
  const pass=(target:any)=>opts.filter((o:any)=>PASSES.includes(o.kind)&&o.target===target.id&&risk(p,o,players)<LANE_OK);
  if(route==='iso'){
   const d=get(players,id(3));
   if(p.id!==d.id){
    if(dep(d.x)>=22&&Math.abs(d.y)>=W/2-7&&near(players,d,7).length<=1)res.push({code:'I-feed',cands:pass(d)});
   }else if(dep(p.x)>=20){
    const close=near(players,p,6);
    if(close.length===1){
     const m=close[0],others=opp(players).filter((q:any)=>q.id!==m.id);
     const odds=clamp(.42+(p.skills.control-m.skills.reading)*.055+(1-m.traits.discipline)*.1,.12,.8);
     if(odds>=TAKE_ODDS)res.push({code:'I-take',cands:opts.filter((o:any)=>o.kind==='feint'&&o.target===m.id&&Math.min(99,...others.map((q:any)=>D(q,o.aim)))>=6),force:true});
    }
   }
  }else if(route==='piv'){
   const s=get(players,id(5));
   if(p.id!==s.id){
    if(dep(s.x)>=26&&dep(s.x)<=37&&Math.abs(s.y)<=7)res.push({code:'P-in',cands:opts.filter((o:any)=>o.kind==='pass'&&o.target===s.id&&risk(p,o,players)<LANE_OK)});
   }else if(time-(recvAt[s.id]??-9)<5){
    const sd=dep(s.x),cands:any[]=[];
    for(const w of [get(players,id(3)),get(players,id(4))]){
     const dd=D(w,s),wd=dep(w.x),goalward=w.vx*fwd;
     if(dd<2||dd>10||wd<sd-9||wd>sd+3)continue;
     const spotNear=Math.abs(wd-(sd-3.5))<1.5&&Math.abs(Math.abs(w.y-s.y)-3)<1.5;
     if(goalward<1&&!spotNear)continue;
     cands.push(...opts.filter((o:any)=>(o.kind==='pass'||o.kind==='through')&&o.target===w.id&&risk(p,o,players)<LANE_OK));
    }
    res.push({code:'P-lay',cands});
   }
  }else if(route==='ovl'){
   const w3=get(players,id(3)),w4=get(players,id(4));
   if((p.id===w3.id||p.id===w4.id)&&dep(p.x)>=18){
    const m=p.id===w3.id?w4:w3,dm=D(p,m);
    if(dm>=3&&dm<=14){
     const ds=new Set([...near(players,p,7),...near(players,m,7)]);
     if(ds.size===1){
      const d=[...ds][0];
      if(D(d,p)<D(d,m)&&D(d,p)<5)res.push({code:'O-pass',cands:pass(m)});
      else if(D(d,m)<D(d,p))res.push({code:'O-carry',cands:opts.filter((o:any)=>o.kind==='carry'&&dep(o.aim.x)-dep(p.x)>=2&&(o.carry?.obstruction??1)<.3)});
     }
    }
   }else if(p.id!==w3.id&&p.id!==w4.id&&flank){
    const wb=flank<0?w3:w4,wo=flank<0?w4:w3;
    if(Math.abs(wb.y)>=W/2-7&&dep(wb.x)>=16&&D(wb,wo)<=12&&new Set([...near(players,wb,7),...near(players,wo,7)]).size<=1)res.push({code:'O-feed',cands:pass(wb)});
   }
  }else if(route==='pd'){
   const s=get(players,id(5));
   if(p.id!==s.id&&(s.duty==='run'||(s.vx*fwd>=3&&dep(s.x)>=24)))res.push({code:'D-run',cands:opts.filter((o:any)=>(o.kind==='through'||o.kind==='loft')&&o.target===s.id&&risk(p,o,players)<LANE_OK)});
  }
  return res;
 }
 /** the gate on true-picture options: the option to play, or null */
 function gate(g:{code:string;cands:any[];force?:boolean},ex:any[]){
  if(!g.cands.length)return null;
  if(g.force){
   const best=g.cands.reduce((a:any,b:any)=>b.score>a.score?b:a),t=ex.reduce((a:any,b:any)=>b.score>a.score?b:a);
   return t.kind==='shoot'&&t.score>best.score+.1?null:best;
  }
  return nearBest(g.cands,ex);
 }

 // ---------------------------------------------------------------- H2 decide
 function decide(p:any,players:any[],ball:any,time:number,available:any[],exact:()=>any[]){
  track(players,ball,time);
  if(p.side!==ours)return undefined;
  // the route's position conditions first (they do not depend on his reads): none hold, no recompute
  const pre=candidates(p,players,ball,time,available);
  if(!pre.length&&!(route==='iso'&&p.id===id(3)&&dep(p.x)>=20))return undefined;
  if(shadow){
   if(!pre.some(g=>g.cands.length))return undefined;
   const ex=exact();
   for(const g of pre)if(g.cands.length){const gx=candidates(p,players,ball,time,ex).find(x=>x.code===g.code);log.shadow.push([r1(time),g.code,gx&&gate(gx,ex)?1:0]);}
   return undefined;
  }
  const ex=exact();
  for(const g of candidates(p,players,ball,time,ex)){
   if(!g.cands.length)continue;
   const pick=gate(g,ex);
   met(g.code,!!pick);
   if(pick){log.fires.push([r1(time),g.code,slot(p.id),slot(pick.target??'')]);if(g.code==='P-lay'){layTo=pick.target;layAt=time;}return [pick];}
  }
  return undefined;
 }

 // ---------------------------------------------------------------- H3 keep (the prepared route kick, on the true picture)
 function keep(p:any,o:any,players:any[],ball:any,time:number,exact?:()=>any[]):any{
  if(shadow||p.side!==ours||!o?.target||!exact)return false;
  const last=log.fires.at(-1);
  if(!last||time-last[0]>3||slot(p.id)!==last[2]||slot(o.target)!==last[3])return false;
  const ex=exact(),same=ex.filter((x:any)=>x.kind===o.kind&&x.target===o.target&&!!x.receivingSpace===!!o.receivingSpace).sort((a:any,b:any)=>D(a.aim,o.aim)-D(b.aim,o.aim))[0];
  const still=!!same&&risk(p,same,players)<LANE_OK+.05&&same.score>=top(ex)-NEAR;
  if(!still)return false;
  log.keeps++;return same;// the kick, refreshed from the true picture (as the engine refreshes a kept kick from its re-read)
 }

 // ---------------------------------------------------------------- H4 plan (the lay-off's receiver)
 function plan(p:any,meeting:any,arrive:number,available:any[],option:any,time:number,players:any[],exact:()=>any[]){
  if(shadow||route!=='piv'||p.side!==ours||p.id!==layTo||time-layAt>3)return undefined;
  const ex=exact(),pick=nearBest(ex.filter((o:any)=>o.kind==='shoot'),ex);
  const key=`${layTo}@${layAt}`;
  if(shotMet!==key||pick&&!log.fires.some(f=>f[1]==='P-shot'&&time-f[0]<3&&f[2]===slot(p.id))){
   if(shotMet!==key){shotMet=key;const m=log.met['P-shot']??(log.met['P-shot']=[0,0]);m[0]++;}
   if(pick){log.met['P-shot'][1]++;log.fires.push([r1(time),'P-shot',slot(p.id),'']);}
  }
  return pick??undefined;
 }
 return {rt:{moves,decide,keep,plan},log};
}
