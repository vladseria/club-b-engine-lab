// Pitch probe (2026-10-20): the table of class-(c) constants (README "Inventory" and "Scaling rule").
//   D(file, NAME, axis, keys?)  a declaration: every number of its initializer (or only `keys`) times the axis factor
//   S(file, snippet)            an inline literal: the snippet with «value:axis» markers; the anchor is the snippet with
//                               the plain values, the replacement has each marked value times its factor
//   WRAP(file, before, expr, after, axis)  `before+expr+after` becomes `before+(f)*(expr)+after` (unchanged when f = 1)
// Axes: L = along the pitch, or a radius from a goal (sL = L/48); W = across (sW = W/30); G = the goal mouth
// (sG = GH/2.5); A = the goal ANGLE normaliser (its own factor, hook.mjs factors(): the angle a central point at the
// reference distance subtends, new goal over old).
const M=/«(-?(?:\d+\.?\d*|\.\d+)):([LWGA])»/g;
const S=(file,snippet)=>({file,kind:'swap',axes:[...new Set([...snippet.matchAll(M)].map(m=>m[2]))].join(''),name:snippet.replace(M,'$1').slice(0,60),from:snippet.replace(M,'$1'),to:(f,num)=>snippet.replace(M,(_,v,a)=>num(Number(v)*f[a]))});
const D=(file,name,axis,keys)=>({file,name,axis,...(keys?{keys}:{})});
const WRAP=(file,before,expr,after,axis)=>{const plain=expr.replace(M,'$1');return {file,kind:'swap',axes:'×'+axis+[...new Set([...expr.matchAll(M)].map(m=>m[2]))].join(''),name:before.slice(0,60),from:before+plain+after,
 to:(f,num)=>{const e=expr.replace(M,(_,v,a)=>num(Number(v)*f[a]));return f[axis]===1?before+e+after:`${before}${num(f[axis])}*(${e})${after}`;}};};
const F={def:'practice-defending.ts',dfn:'practice-defense.ts',kp:'practice-keeper.ts',ks:'practice-keeper-support.ts',sd:'practice-shot-defense.ts',int:'practice-intensity.ts',thr:'practice-threat.ts',
 pr:'practice.ts',rs:'practice-restarts.ts',rl:'practice-restart-live.ts',co:'practice-coordination.ts',sh:'practice-shape.ts',su:'practice-support.ts',as:'practice-attacking-space.ts',
 tr:'practice-transition.ts',ta:'team-approach.ts',bu:'practice-build-up.ts',pa:'practice-passing.ts',po:'practice-possession.ts',ca:'practice-carry.ts',du:'practice-duel.ts',fo:'practice-football.ts'};

export const SCALE=[
 // ---- defending (practice-defending.ts): who matters, the press, the block, cover, box protection
 D(F.def,'DANGER_R','L'),D(F.def,'DANGER_PRESS','L'),D(F.def,'CENTRAL','L'),D(F.def,'AHEAD_R','L'),D(F.def,'RUN_R','L'),
 D(F.def,'BEHIND_R','L'),D(F.def,'BEHIND_WIDE','W'),D(F.def,'SPARE_BEHIND','L'),D(F.def,'SPARE_R','L'),D(F.def,'KEEP_MATTER','L'),
 D(F.def,'ENGAGE','L'),D(F.def,'ENGAGE_LINE','L'),D(F.def,'CLEAR_R','L'),D(F.def,'CLEAR_R_RUN','L'),D(F.def,'NEAR_BLOCK','L'),
 D(F.def,'NEAR_GOAL','L'),D(F.def,'NEAR_GOAL_FAR','L'),D(F.def,'FAR_CUSHION','L',['from']),D(F.def,'BLOCK','L'),D(F.def,'BALANCE_Y','W'),
 D(F.def,'COVER_DROP_R','L'),D(F.def,'COVER_DROP_WIDE','W'),D(F.def,'COVER_DROP_FAR','L'),D(F.def,'COVER_DROP_FREE','L'),D(F.def,'COVER_DROP_KEEP','L'),
 D(F.def,'COVER_DROP_THREAT','L'),D(F.def,'SCREEN_OFF','L'),D(F.def,'REGROUP_BEHIND','L'),D(F.def,'EDGE','L'),D(F.def,'SCREEN_UP','L'),
 D(F.def,'HABIT_IN','L'),D(F.def,'HABIT_FAR','L'),D(F.def,'RUN_HABIT','L'),D(F.def,'TIGHT_IN','L'),D(F.def,'TIGHT_FADE','L'),
 D(F.def,'HOLD_IN','L'),D(F.def,'COVER_SINK','L'),D(F.def,'PROTECT_R','L'),D(F.def,'PROTECT_FADE','L'),D(F.def,'PROTECT_SPREAD','G'),
 S(F.def,'CENTRAL*clamp(1-(Math.abs(v.y)-«3:G»)/«6:G»,0,1);'),
 S(F.def,'const close=clamp((R+«6:L»-dg)/«12:L»,0,1)*clamp(1-(Math.abs(v.y)-«5:W»)/«14:W»,.4,1);'),
 S(F.def,'const jobDepth=(dg:number)=>clamp(1-(dg-«6:L»)/«16:L»,0,1);'),
 S(F.def,'const far=clamp((«40:L»-depth(defending,carrier!.x))/«15:L»,.3,1);'),
 S(F.def,"clamp(1-(t.r.dg-«8:L»)/«24:L»,0,1)"),
 S(F.def,'(Math.abs(man.y-ref.y)>«8:W»?WIDTH_SAG'),
 S(F.def,'inward=Math.abs(v.y)>«3:G»&&dg<TIGHT_IN+TIGHT_FADE'),
 S(F.def,'*SIDE_SHADE*(1-fade*.5)*clamp((dg-«8:L»)/«6:L»,0,1);'),
 S(F.def,'*clamp(1-d/«45:L»,.05,1);};'),
 S(F.def,'(cd<«28:L»||running)'),
 S(F.def,'const shown=Math.abs(carrier.y)>«2:G»&&distance(carrier,g)>«10:L»?'),
 S(F.def,'-(Math.abs(carrier.y)>«2:G»?Math.sign(carrier.y)*SHOW:0)};'),
 S(F.def,'if(distance(carrier,g)>«14:L»&&depth(defending,point.x)>depth(defending,presserAim.x)-behind){'),
 S(F.def,"reason:distance(carrier,g)<«14:L»?"),
 S(F.def,'distance(a,g)>=COVER_DROP_R[tactics.line]+«2:L»)continue;'),
 S(F.def,'r.dg>=COVER_DROP_R[tactics.line]+(keep?«2:L»:0))continue;'),
 // ---- defence helpers (practice-defense.ts)
 S(F.dfn,"q.role!=='GK'&&distance(q,{x:owner.side===0?L:0,y:0})<«16:L»);"),
 S(F.dfn,'const routeDanger=.6+clamp((«22:L»-distance(owner,goalPoint))/«18:L»,0,1);'),
 S(F.dfn,"q.role!=='GK'&&distance(q,goalPoint)<«20:L»)){"),
 S(F.dfn,'cost+=response*clamp((«20:L»-distance(target,goalPoint))/«16:L»,.15,1);'),
 D(F.dfn,'COVER_NEAR','L'),D(F.dfn,'COVER_CENTRAL','G'),D(F.dfn,'BLOCK_NEAR','L'),
 S(F.dfn,'const near=clamp((COVER_NEAR+«4:L»-distance(seen,g))/«4:L»,0,1);'),
 S(F.dfn,'const wideBall=clamp((Math.abs(seen.y)-COVER_CENTRAL)/«5:G»,0,1);'),
 S(F.dfn,"p.role!=='GK'&&distance(p,goal(defender))<«16:L»);"),
 S(F.dfn,'&&distance(p,ball)<«46:L»)'),
 S(F.dfn,"(p.role==='CB'&&depth(defending,seen.x)>«38:L»?.9:0)+Math.abs((shape?.slots[p.id]?.aim.y??p.lane*«15:W»)-seen.y)"),
 // ---- keeper (practice-keeper.ts, practice-keeper-support.ts, practice-football.ts)
 D(F.kp,'ONE_ON_ONE','L'),D(F.kp,'KEEPER_BEHIND','L'),D(F.kp,'KEEPER_BEHIND_SWEEP','L'),D(F.kp,'KEEPER_FOLLOW_FROM','L'),D(F.kp,'KEEPER_FOLLOW_FULL','L'),D(F.kp,'SHOT_RANGE','L'),
 WRAP(F.kp,'const advance=',"closing&&oneOnOne&&bx<ONE_ON_ONE?clamp(5.2-bx*.13+(clamp(p.skills.keeping,0,10)-6)*.12,1.6,4.6):closing&&bx<«12:L»?clamp(3.8-bx*.11,1.2,3.2):clamp(bx*.12,.65,2.8)",';','G'),
 S(F.kp,'range:BOX_DEPTH+1+s*«9:L»};'),
 S(F.kp,'return ownBall?s*clamp((ballDepth-«16:L»)/«16:L»,0,1)*«5:L»:s*clamp((ballDepth-«12:L»)/«12:L»,0,1)*«4.5:L»;'),
 S(F.kp,'0,BOX_DEPTH+1+«4:L»*s);'),
 S(F.ks,'y:clamp(focus.y*.15,«-2:G»,«2:G»)};'),
 S(F.ks,'const step=clamp(bd-«12:L»,{deep:«3:L»,standard:«4:L»,high:«5:L»}[tactics.line],reachOut);'),
 S(F.ks,'[Math.max(2,step-«4:L»),step].flatMap(x=>[«-5:W»,0,«5:W»].map('),
 S(F.ks,'...(bd<«16:L»?[ready]:[])];'),
 WRAP(F.fo,'const advance=',"closing&&bd<X(23)&&Math.abs(ball.y)<Y(16)?Math.max(.8,Math.min(bd-1,clamp(10-bd*.25,2,6))):clamp(bd*.13,1,5.5)",';','G'),
 S(F.fo,'aim:{x,y:clamp(ball.y+(x-ball.x)/ball.vx*ball.vy,«-7:G»,«7:G»)}};'),
 // ---- the shot reads: distance fall-off (L) and goal-angle normaliser (A), shot-defence and keeper set
 S(F.fo,'const quality=clamp(angle/«.6:A»,0,1)*clamp(1-distanceToGoal/«45:L»,.05,1)'),
 S(F.fo,'const open=clamp(angle/«.6:A»,0,1)*clamp(1-distanceToGoal/«45:L»,.05,1)'),
 S('practice-carry.ts','clamp(goalAngle({...p,...point})/«.6:A»,0,1)*clamp(1-goalDistance(p,point)/«45:L»,0,1);'),
 S(F.thr,'return clamp(angle/«.6:A»,0,1)*clamp(1-Math.hypot(at.x-gx,at.y)/«45:L»,.05,1);'),
 S(F.sd,'const geometry=clamp(angle/«.55:A»,0,1)*clamp((«38:L»-length)/«24:L»,0,1);'),
 S(F.sd,'distance(keeper,goal)<«9:L»&&Math.abs(keeper.y)<«5:G»;'),
 // ---- urgency (practice-intensity.ts)
 D(F.int,'LEFT_BEHIND','L'),
 S(F.int,'if(dist(aim,goal)<«15:L»&&far>2)'),
 // ---- off the ball and shape (practice.ts, practice-shape.ts, practice-coordination.ts, practice-support.ts, practice-build-up.ts)
 D(F.pr,'CLEAR_READ','L'),
 S(F.pr,'if(d<2.8||d>40||progress< «-25:L»||'),
 S(F.pr,'if(d<8||d>55||progress< «-20:L»||'),
 S(F.pr,"ball.mode!=='shot'&&bd<«40:L»){"),
 S(F.pr,'clamp(bd+(t.commit-3)*«2:L»,X(18),X(83))'),
 S(F.pr,'x=Math.min(X(99),safeLine+runStep+(!ball.owner?«5:L»:0));'),
 S(F.pr,'clamp(ball.y*.45+p.lane*«4:W»,-Y(13),Y(13))'),
 S(F.pr,"if(kind==='run')x=Math.min(x,structure!.front+«6:L»+(runStep?«8:L»:0));"),
 S(F.pr,"x=Math.min(x,Math.max(bd,safeLine+(kind==='run'?runStep+(!ball.owner?«5:L»:0):0)));"),
 S(F.pr,'const spots=[{x,y},{x:x-«3:L»,y:y-«5:W»},{x:x-«2:L»,y:y+«5:W»}];'),
 S(F.pr,"x=line+(p.role==='CB'?0:p.role==='FB'?«2:L»:"),
 S(F.pr,"depth(team,spot.x)>(L-«3:L»)&&Math.abs(spot.y)<=«4.5:G»)spot={x:world(team,(L-«3:L»)),"),
 S(F.pr,'{x:exit.x<(L/2)?corner?1:«3:L»:corner?(L-1):(L-«3:L»),'),
 D(F.sh,'WIDTH','W',['reach']),
 // (the midfield's offset off the ball, -1 m + 1 m per commit step, scaled whole)
 {file:F.sh,kind:'swap',name:'middle offset',from:'middle=clamp(bd-1+(tactics.commit-3),X(20),X(80));',to:(f,num)=>f.L===1?'middle=clamp(bd-1+(tactics.commit-3),X(20),X(80));':`middle=clamp(bd+${num(f.L)}*(-1+(tactics.commit-3)),X(20),X(80));`},
 S(F.sh,"x=tactics.fullbacks==='hold'?back+«5:L»:middle+(near?«1:L»:«-5:L»)+(tactics.fullbacks==='overlap'?«3:L»:0);"),
 S(F.sh,"x=middle+(p.role==='AM'?«7:L»:«1:L»)-p.traits.comesShort*«3:L»;y=p.lane*«11:W»+shift*spread.middle;}"),
 S(F.sh,"else if(p.role==='FB'){x=back+«1.5:L»;y=p.lane*(backCount===3?«16:W»:«18:W»)+shift;}"),
 S(F.sh,"else if(p.role==='DM'){x=middle-«3:L»;y=p.lane*«6:W»+shift;}"),
 S(F.sh,"else if(p.role==='CM'||p.role==='AM'){x=middle+(p.role==='AM'?«2:L»:0);y=p.lane*«9:W»+shift;}"),
 S(F.sh,'clamp((bd+«8:L»-da)/«6:L»,0,1);};'),
 S(F.sh,"const leash=style==='tight'?(defender.role==='CB'?«12:L»:«17:L»):style==='zonal'?«4:L»:defender.role==='CB'?«7:L»:«10:L»;"),
 D(F.co,'TRAP_NEAR','L'),D(F.co,'COUNTER_PRESS_OWN','L'),D(F.co,'PIVOT_WIDTH','W'),D(F.co,'RUN_WIDTH','W'),D(F.co,'LINK_GAP','L'),D(F.co,'LINK_BEYOND','L'),
 S(F.co,'clamp((9-Math.abs(owner.y))/3,0,1)'.replace('9-','«9:W»-').replace('/3,','/«3:W»,')),
 S(F.co,'const band=laneY(t.width)-«4:W»,'),
 S(F.co,'const midTarget=(p:PracticePlayer)=>p.lane*«11:W»+'),
 S(F.co,"const lead=p.role==='CB'||p.role==='DM'?«-6:L»:p.role==='ST'?«8:L»:«4:L»;"),
 S(F.co,"point:{x:focus.x+s*«12:L»,y:0},range:34,"),
 S(F.co,'laneY(t.width)-p.lane*focus.y>=«6:W»,'),
 S(F.su,'...[«-11:W»,«-8:W»,«-5:W»,«5:W»,«8:W»,«11:W»].map(dy=>at(bd,owner.y+dy)),'),
 S(F.su,'...[BOX_DEPTH,BOX_DEPTH+«4:L»].flatMap(d=>[«-10:W»,«-5:W»,«5:W»,«10:W»].map(y=>at(d,y))),'),
 S(F.bu,'const inside=(p:Vec)=>({x:clamp(p.x,1,(L-1)),y:clamp(p.y,-(W/2-«5:W»),(W/2-«5:W»))});'),
 S(F.bu,'Math.max(LINE_BUILD_CAP[tactics.line],bd-«11:L»)'),
 S(F.bu,'centreBack?clamp(bd-3,«5:L»,ceiling):clamp(bd-X(16)+'),
 WRAP(F.bu,'clamp(bd-X(16)+','(tactics.commit-3)',',X(6),ceiling);','L'),
 // ---- attacking reads (practice-attacking-space.ts, practice-transition.ts, team-approach.ts)
 S(F.as,'const progress=clamp((depth(point)-depth(carrier))/«12:L»,0,1);'),
 S(F.as,'const progress=clamp((depth(moving)-initialDepth)/«8:L»,-1,1);'),
 S(F.tr,'depth(owner.side,p.x)<Math.min(L-«10:L»,Math.max(bd+«10:L»,front+2))'),
 S(F.tr,'clamp(Math.max(bd+«8:L»,depth(owner.side,p.x)+advance),3,L-4)'),
 S(F.ta,'const across=clamp((Math.abs(o.aim.y-p.y)-«6:W»)/«6:W»,0,1);'),
 S(F.ta,'return clamp(gain/«14:L»,-.55,1)*.21*feasible+(gap>«13:L»&&gain>«7:L»?.035:0);'),
 // ---- passing and possession (practice-passing.ts, practice-possession.ts, practice-carry.ts, practice-duel.ts)
 D(F.pa,'PROSPECT_BEHIND','L'),D(F.pa,'OWN_ZONE','L'),D(F.pa,'OWN_ZONE_FAR','L'),
 S(F.pa,'pd-qd>2&&pd-qd<«18:L»?'),
 S(F.pa,'Math.abs(qd-pd)<«10:L»?'),
 S(F.po,'const ownGoal=depth(p,aim.x)<«6:L»&&Math.abs(aim.y)<«6:G»?2:0;'),
 S(F.po,'const spots=[«20:L»,«12:L»,«16:L»,«24:L»,«28:L»].flatMap(x=>[W/2-2.5,W/2-«7:W»]'),
 S(F.po,'({aim:{x:p.x+s*«35:L»,'),
 S(F.po,'[0,«8:L»].map(x=>({aim:{x:clamp(p.x+s*x,1,(L-1)),y:y*(W/2+4)}'),
 S(F.po,"...(depth(p)<«12:L»&&p.role!=='GK'?"),
 S(F.po,'mates.filter(q=>depth(q)>depth(p)+«6:L»)'),
 S(F.po,'near=Math.min(«4.5:G»,distance(p,goal));'),
 S(F.ca,"if(p.role!=='GK'&&depth(p,aim.x)<«6:L»&&Math.abs(aim.y)<«6:G»&&depth(p,aim.x)<depth(p,p.x))continue;"),
 S(F.du,'export const dangerAt=(p:Vec,goal:Vec)=>clamp((«22:L»-distance(p,goal))/«14:L»,0,1);'),
 // ---- restarts (practice-restarts.ts, practice-restart-live.ts)
 S(F.rs,'y:[-Y(7),«2:W»,Y(11)][i]};'),
 S(F.rs,'y:[-Y(7),«2:W»,Y(11)][n]+1.5};'),
 {file:F.rs,kind:'swap',name:'corner box target y flank (1 m)',from:'{x:X(90),y:flank}];',to:(f,num)=>f.W===1?'{x:X(90),y:flank}];':`{x:X(90),y:flank*${num(f.W)}}];`},
 S(F.rs,'Math.min(depth(side,cover.x),at-«4.5:L»))),y:clamp(cover.y,«-6:W»,«6:W»)});'),
 D(F.rl,'THROW_COVER','L'),D(F.rl,'GOAL_KICK_LONG','L'),D(F.rl,'GOAL_KICK_PRESS_DEPTH','L'),
 D(F.rl,'TEMPLATE_FK','L'),D(F.rl,'TEMPLATE_THROW','L'),D(F.rl,'SP_BOX_IN','L'),D(F.rl,'SP_OUTLET_IN','L'),
 S(F.rl,'guard?Math.min(at-«4.5:L»,fd-THROW_GUARD):at-THROW_COVER)),y:guard?clamp(forward!.y*.6,«-6:W»,«6:W»):clamp(spot.y*.35,«-6:W»,«6:W»)};'),
 S(F.rl,'depth(side,aim.x)>=L-BOX_DEPTH-«6:L»&&'),
 S(F.rl,'const danger=clamp((«16:L»-d)/«10:L»,0,1)*clamp(1-(Math.abs(v.y)-«3:G»)/«10:W»,.3,1);'),
 S(F.rl,'for(const d of [line+«7:L»,line+«13:L»])for(const y of [«-9:W»,«-4.5:W»,0,«4.5:W»,«9:W»]){'),
 S(F.rl,'clamp(d,BOX_DEPTH+«6:L»,L-«9:L»)'),
];

/** Per entry, the axes its swap uses (for unit.mjs --table). */
export const AXES=SCALE.map(e=>e.axes??(e.kind==='swap'?(e.name==='middle offset'?'×L':'W'):''));
