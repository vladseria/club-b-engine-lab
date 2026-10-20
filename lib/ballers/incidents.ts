// Ballers P4: the incident layer. Engine events + frames -> a short list of
// football INCIDENTS (a goal, a big save, a man beaten...). The commentary
// (lib/ballers/commentary), the goal takeover, Highlights and the post-match
// report all read incidents, never raw events.
//
// Where it runs: at VIEW time, from the stored replay chunks (compact replay
// v2 keeps every engine event plus the per-frame ball, owner and possession),
// so no schema change and no recompute. Pure and deterministic.
//
// Never past the playhead. Every incident is stamped with the time its LAST
// piece of evidence happened (a shot's incident sits on its save/block/goal,
// a key pass sits after the goal it made). Nothing decides an incident at t
// from anything later than t, and `horizon` (the last second of match the
// viewer holds) cuts off everything not yet decidable. So incidents built
// from a half-loaded live feed are exactly the full-time incidents up to that
// horizon (a unit test holds this), and a viewer shows an incident only once
// the playhead reaches its t.
//
// Never invents football: every incident names what the events say. The
// engine's goal actor is the LAST TOUCH; the scorer credit follows football's
// rule (creditGoal): an on-target shot that goes in is the shooter's even off
// a keeper's spill or a defender's deflection, unless a team-mate touched it
// in last (then it is his); a conceding player redirecting anything else in
// (back-pass, clearance, cross, a shot going wide) = autogol.
import type {ReplayEvent, ReplayFrame, ReplayHeader} from './replay';

export type IncidentKind='kickoff'|'goal'|'own_goal'|'save'|'wide'|'blocked'|'chance'|'beat'|'key_pass'|'tackle'|'turnover'|'foul'|'half'|'end'|'quiet'|'idea'|'substitution';
export type GoalState='opens'|'equalises'|'leads'|'extends'|'pulls_back';
export interface Incident {
 /** Stable across viewers and horizons: `${kind}@${t}` (+ `#n` on a clash). */ id:string;
 /** ms: when the incident is complete (its last piece of evidence). */ t:number;
 kind:IncidentKind;
 /** The side the incident is FOR (the scorer's team, the saving keeper's team...); null = neutral. */ side:0|1|null;
 /** Player indices (replay header order). [0] = the protagonist; [1] = the other one (keeper beaten, assister, man beaten...). */ actors:number[];
 /** Importance, 0-100. Picks the line when two moments compete; >= MUST_WEIGHT always gets a line. */ weight:number;
 /** Player index whose portrait may show: only goals and the pass that made one. */ portrait?:number;
 /** Score (home, away) once the incident is done. */ score:[number,number];
 /** The engine's own Romanian line for the key event: the commentary's fallback. */ engine:string;
 /** Facts the lines may use (all read from events at or before t). */
 facts:{state?:GoalState;late?:'lead'|'equaliser';dist?:number;big?:boolean;finally?:boolean;shooter?:number;assist?:number;goalAt?:number;
  /** A substitution's trigger (P5): tired | losing | drawing | winning | up | down | half. */ sub?:string};
}
export const MUST_WEIGHT=90;
const W:Record<IncidentKind,number>={kickoff:95,goal:100,own_goal:100,end:95,key_pass:62,save:48,chance:56,idea:55,substitution:92,half:50,blocked:42,wide:34,beat:36,turnover:28,foul:32,tackle:26,quiet:12};
export const weightOf=(k:IncidentKind)=>W[k];

/** When a late goal counts as late (s from the end). */
export const LATE_S=150;
/** No incident for this long = a quiet spell (one line, then at least this long again). */
export const QUIET_MS=45000;
/** A key pass is told after the takeover has had the scorer to itself. */
export const KEY_PASS_DELAY=4000;
const SHOT_WINDOW=3000;

// Pitch (cm): side 0 attacks x = 4800, side 1 attacks x = 0.
const LENGTH=4800;
const depth=(side:0|1,x:number)=>side===0?x:LENGTH-x;
const goalDistance=(side:0|1,o:[number,number])=>Math.hypot(LENGTH-depth(side,o[0]),o[1])/100;

/** Half the goal's width (cm): an aim inside it is a shot on target. */
export const GOAL_HALF_WIDTH=250;
/** Events that end a shot's flight: after one of these the ball is in a new
 * phase of play and the shot no longer owns the goal. A save or a block does
 * not end it (a parry or deflection that still goes in is the shooter's). */
const NEW_PHASE=new Set(['pass','receive','clearance','turnover','tackle','restart','out','shot','foul','offside','goal','feint','beat']);
/** Player credited with a goal (DECISIONS Q4.5, football's rule):
 * - a shot ON TARGET by the scoring side whose flight ends in the net is the
 *   shooter's, even when the keeper spills it in or a defender deflects it,
 *   but a team-mate who turns it in last scores it himself (the shooter stays
 *   in `shooter`);
 * - otherwise a last touch by the conceding side (a back-pass, a clearance,
 *   a cross turned in, a deflected shot that was going wide) is an autogol;
 * - otherwise the scoring side's last touch scores.
 * `before` = the events up to (not including) the goal. */
export function creditGoal(goal:ReplayEvent,before:ReplayEvent[],header:Pick<ReplayHeader,'players'>):{player:number;own:boolean;shooter?:number}|null{
 const side=(goal.s??0) as 0|1,last=goal.lt??goal.a;
 for(let i=before.length-1;i>=0;i--){const e=before[i];
  if(goal.t-e.t>5000)break;
  if(e.k==='shot'){
   if(e.s===side&&e.a!==undefined&&(!e.sh||Math.abs(e.sh.a[1])<=GOAL_HALF_WIDTH)){
    if(last!==undefined&&last!==e.a&&header.players[last]?.side===side)return {player:last,own:false,shooter:e.a};
    return {player:e.a,own:false,shooter:e.a};
   }
   break; // off target, or the other side's: the shot doesn't own this goal
  }
  if(NEW_PHASE.has(e.k))break;
 }
 if(last!==undefined&&header.players[last]&&header.players[last].side!==side)return {player:last,own:true};
 return last===undefined?null:{player:last,own:false};
}

export interface IdeaInput {seq:number;side:0|1;t:number;ended_at:number|null;progress:string;end_reason:string|null;free?:boolean;
 /** Whether it played out as drawn (lib/ballers/idea-run.ts; the public marker's `run`). Absent: the older rule below. */ run?:'ran'|'partly'|'broke'|null}
export interface IncidentInput {header:Pick<ReplayHeader,'players'|'duration'|'fullTime'>;events:ReplayEvent[];frames:ReplayFrame[];
 /** Idea markers (seconds, as ballers_match_ideas stores them). Optional. */ ideas?:IdeaInput[];
 /** ms; nothing after it is known yet. Omit = the whole match is held. */ horizon?:number}

function frameIndex(frames:ReplayFrame[],t:number){let lo=0,hi=frames.length-1,best=-1;while(lo<=hi){const m=(lo+hi)>>1;if(frames[m].t<=t){best=m;lo=m+1;}else hi=m-1;}return best;}

export function buildIncidents(input:IncidentInput):Incident[]{
 const {header,frames}=input,dur=header.duration*1000;
 const horizon=Math.min(input.horizon??Infinity,dur);
 const events=input.events.filter(e=>e.t<=horizon);
 const side=(i:number|undefined)=>i===undefined?undefined:header.players[i]?.side;
 const out:Incident[]=[];
 const score:[number,number]=[0,0];
 const add=(i:Omit<Incident,'id'|'weight'|'score'>&{weight?:number;score?:[number,number]})=>{
  out.push({id:'',weight:i.weight??W[i.kind],score:i.score??[score[0],score[1]],...i} as Incident);
 };
 const possessionBefore=(t:number)=>{const f=frames[Math.max(0,frameIndex(frames,t-1))];return f?.ps;};
 const ballAt=(t:number)=>{const f=frames[Math.max(0,frameIndex(frames,t))];return f?.b;};
 const resolved=new Set<number>(); // shot event indices already told

 for(let i=0;i<events.length;i++){
  const e=events[i];
  switch(e.k){
   case 'start':add({t:e.t,kind:'kickoff',side:null,actors:[],engine:e.x,facts:{}});break;
   case 'end':add({t:e.t,kind:'end',side:null,actors:[],engine:e.x,facts:{}});break;
   case 'goal':{
    const s=(e.s??0) as 0|1,credit=creditGoal(e,events.slice(0,i),header);
    score[s]++;
    const own=score[s],against=score[1-s];
    const state:GoalState=own+against===1?'opens':own===against?'equalises':own===against+1?'leads':own>against?'extends':'pulls_back';
    const late=dur-e.t<=LATE_S*1000&&(state==='equalises'||state==='leads')?(state==='equalises'?'equaliser':'lead'):undefined;
    // The shot this goal resolves is not told separately.
    for(let j=i-1;j>=0&&e.t-events[j].t<=5000;j--)if(events[j].k==='shot'&&events[j].s===s){resolved.add(j);break;}
    if(credit?.own){add({t:e.t,kind:'own_goal',side:s,actors:[credit.player],portrait:credit.player,engine:e.x,facts:{state,late}});break;}
    const scorer=credit?.player;
    const assist=scorer===undefined?undefined:assistFor(events,i,scorer,s);
    add({t:e.t,kind:'goal',side:s,actors:scorer===undefined?[]:assist===undefined?[scorer]:[scorer,assist],portrait:scorer,engine:e.x,facts:{state,late,shooter:credit?.shooter,assist}});
    if(assist!==undefined&&scorer!==undefined&&e.t+KEY_PASS_DELAY<=horizon)
     add({t:e.t+KEY_PASS_DELAY,kind:'key_pass',side:s,actors:[assist,scorer],portrait:assist,engine:e.x,facts:{goalAt:e.t},
      // In a rout the fifth assist is not news; a pass that changed the game is.
      weight:state==='extends'?38:W.key_pass});
    break;
   }
   case 'shot':break; // told when its outcome arrives (below)
   case 'save':case 'block':case 'out':{
    // The outcome of the latest untold shot within SHOT_WINDOW, if any.
    let j=i-1;for(;j>=0&&e.t-events[j].t<=SHOT_WINDOW;j--){if(events[j].k==='shot'||events[j].k==='goal'||events[j].k==='save'||events[j].k==='block')break;}
    if(j<0||events[j].k!=='shot'||e.t-events[j].t>SHOT_WINDOW||resolved.has(j))break;
    if(e.k==='out'&&!e.x.includes('linia porții')&&!e.x.includes('Corner'))break; // a throw-in is not how a shot ends
    const shot=events[j],s=(shot.s??0) as 0|1;resolved.add(j);
    const dist=shot.sh?Math.round(goalDistance(s,shot.sh.o)*10)/10:undefined;
    if(e.k==='save'){const big=dist!==undefined&&dist<=9;
     add({t:e.t,kind:'save',side:(1-s) as 0|1,actors:e.a!==undefined&&shot.a!==undefined?[e.a,shot.a]:e.a!==undefined?[e.a]:[],weight:big?W.save+16:W.save,engine:e.x,facts:{dist,big,shooter:shot.a}});}
    else if(e.k==='block')add({t:e.t,kind:'blocked',side:(1-s) as 0|1,actors:e.a!==undefined&&shot.a!==undefined?[e.a,shot.a]:[],engine:e.x,facts:{dist,shooter:shot.a}});
    else{const close=dist!==undefined&&dist<=7;
     add({t:e.t,kind:close?'chance':'wide',side:s,actors:shot.a!==undefined?[shot.a]:[],engine:shot.x,facts:{dist,shooter:shot.a}});}
    break;
   }
   case 'substitution':{
    // a = coming on, g = going off; sb = the trigger that fired (always a line).
    if(e.a===undefined)break;
    const k=e.sb?.k,sub=k==='score'?e.sb?.st:k==='margin'?e.sb?.d:k;
    add({t:e.t,kind:'substitution',side:(e.s??side(e.a)??0) as 0|1,actors:e.g!==undefined?[e.a,e.g]:[e.a],engine:e.x,facts:{sub}});
    break;
   }
   case 'beat':if(e.a!==undefined&&e.g!==undefined)add({t:e.t,kind:'beat',side:(e.s??side(e.a)??0) as 0|1,actors:[e.a,e.g],engine:e.x,facts:{}});break;
   case 'foul':if(e.a!==undefined)add({t:e.t,kind:'foul',side:(e.s??side(e.a)??0) as 0|1,actors:e.g!==undefined?[e.a,e.g]:[e.a],engine:e.x,facts:{}});break;
   case 'tackle':{
    // a = the player left with the ball, s = his side. Won = the ball changed hands.
    if(e.a===undefined||e.s===undefined||possessionBefore(e.t)===e.s)break;
    const b=ballAt(e.t);if(!b||depth(e.s,b[0])>1600)break; // last-ditch: in his own third
    add({t:e.t,kind:'tackle',side:e.s,actors:e.g!==undefined?[e.a,e.g]:[e.a],engine:e.x,facts:{}});break;
   }
   case 'turnover':{
    if(e.a===undefined||e.s===undefined)break;
    const b=ballAt(e.t);if(!b||depth(e.s,b[0])<3200)break; // won high: the other side lost it near its own goal
    add({t:e.t,kind:'turnover',side:e.s,actors:[e.a],engine:e.x,facts:{}});break;
   }
  }
 }

 // Halfway on the clock (a 15-minute match has no interval, so this is the
 // clock's fact, not an invented half-time).
 const half=Math.round((header.fullTime??header.duration)*1000/2); // half the match length, not of a last attack's extra seconds
 if(dur>=300000&&half<=horizon){const f=frames[Math.max(0,frameIndex(frames,half))];add({t:half,kind:'half',side:null,actors:[],engine:'',score:f?[f.s[0],f.s[1]]:[0,0],facts:{}});}

 // Ideas that came off (P5 names them for their owner; here: that one did).
 if(input.ideas?.length)ideaIncidents(input.ideas,events,horizon).forEach(x=>add({...x,score:scoreAt(out,x.t)}));

 out.sort(order);
 const withQuiet=quietSpells(out,horizon,dur);
 // Ids: kind@t, unique.
 const seen=new Map<string,number>();
 for(const x of withQuiet){const base=`${x.kind}@${x.t}`,n=seen.get(base)??0;seen.set(base,n+1);x.id=n?`${base}#${n}`:base;}
 return withQuiet;
}
const order=(a:Incident,b:Incident)=>a.t-b.t||b.weight-a.weight||a.kind.localeCompare(b.kind)||(a.actors[0]??-1)-(b.actors[0]??-1);
function scoreAt(list:Incident[],t:number):[number,number]{let s:[number,number]=[0,0];for(const x of list)if((x.kind==='goal'||x.kind==='own_goal')&&x.t<=t)s=x.score;return [s[0],s[1]];}

/** The last pass by the scoring side to the scorer before his shot, in the
 * same move (no possession change, restart or save in between). */
function assistFor(events:ReplayEvent[],goalIdx:number,scorer:number,side:0|1){
 for(let j=goalIdx-1;j>=0;j--){const e=events[j];
  if(events[goalIdx].t-e.t>10000)return undefined;
  if(e.k==='restart'||e.k==='save'||e.k==='out'||e.k==='goal')return undefined;
  if((e.k==='turnover'||e.k==='tackle')&&e.s!==side)return undefined;
  if(e.k==='pass'&&e.s===side){return e.g===scorer&&e.a!==undefined&&e.a!==scorer?e.a:undefined;}
 }
 return undefined;
}

/** One quiet line after QUIET_MS without anything worth a line; never inside
 * the last 30 s, never before the horizon knows the spell really was quiet. */
function quietSpells(list:Incident[],horizon:number,dur:number):Incident[]{
 const out:Incident[]=[];let busy=0;
 const fill=(until:number)=>{while(until-busy>=QUIET_MS){const t=busy+QUIET_MS;if(t>horizon||t>dur-30000)return;
  out.push({id:'',t,kind:'quiet',side:null,actors:[],weight:W.quiet,score:scoreAt(list,t),engine:'',facts:{}});busy=t+QUIET_MS;}};
 for(const x of list){if(x.weight>=30||x.kind==='kickoff'){fill(x.t);out.push(x);busy=Math.max(busy,x.t);}else out.push(x);}
 fill(Math.min(horizon,dur)+1);
 return out.sort(order);
}

/** An idea that came off: attempted, and the move completed (at its end) or
 * produced a shot/goal by that side within 3 s of its end (at that shot).
 * `finally` = an earlier idea of that side had failed. At most 3 per side. */
function ideaIncidents(ideas:IdeaInput[],events:ReplayEvent[],horizon:number){
 const res:{t:number;kind:'idea';side:0|1;actors:number[];engine:string;facts:Incident['facts']}[]=[];
 // Each idea resolves at one instant (its shot, its completion, or its
 // failure); walking those instants in time order keeps `finally` causal.
 const beats:{at:number;ok:boolean;side:0|1;actor?:number;seq:number}[]=[];
 for(const m of ideas){
  if(m.free)continue;
  const start=m.t*1000,end=(m.ended_at??m.t+8)*1000;
  const shot=events.find(e=>(e.k==='shot'||e.k==='goal')&&e.s===m.side&&e.t>=start&&e.t<=end+3000);
  // Classified firings: it came off only if it ran as drawn; broke = failed; partly = neither.
  if(m.run){if(m.run==='ran')beats.push({at:shot?shot.t:end,ok:true,side:m.side,actor:shot?.a,seq:m.seq});else if(m.run==='broke')beats.push({at:end,ok:false,side:m.side,seq:m.seq});continue;}
  if(m.progress!=='attempted')continue;
  const at=shot?shot.t:m.end_reason==='complete'&&m.ended_at!==null?end:null;
  if(at!==null)beats.push({at,ok:true,side:m.side,actor:shot?.a,seq:m.seq});
  else if(['loss','aborted','conflict'].includes(m.end_reason??''))beats.push({at:end,ok:false,side:m.side,seq:m.seq});
 }
 beats.sort((a,b)=>a.at-b.at||a.seq-b.seq);
 const failed=[false,false],count=[0,0];
 for(const b of beats){
  if(b.at>horizon)break;
  if(!b.ok){failed[b.side]=true;continue;}
  if(count[b.side]<3){res.push({t:b.at,kind:'idea',side:b.side,actors:b.actor!==undefined?[b.actor]:[],engine:'',facts:{finally:failed[b.side]}});count[b.side]++;}
  failed[b.side]=false;
 }
 return res;
}

/** Incidents at or before t (ms): what a viewer at t may know. */
export const incidentsUntil=(list:Incident[],tMs:number)=>list.filter(x=>x.t<=tMs);

// ---------- Highlights ----------
export interface ReelWindow {from:number;to:number;at:number;incidents:Incident[]}
/** The key incidents as a reel of [from, to] windows (ms), ~2-3 minutes for a
 * 15-minute match: every goal, then the best saves / chances / ideas / blocks
 * by weight while the budget lasts. */
export function highlightReel(list:Incident[],duration:number,o:{lead?:number;tail?:number;budget?:number}={}):ReelWindow[]{
 const lead=o.lead??6000,tail=o.tail??3500,budget=o.budget??170000,dur=duration*1000;
 const keys=list.filter(x=>x.kind==='goal'||x.kind==='own_goal');
 const extras=list.filter(x=>['save','chance','idea','blocked','beat'].includes(x.kind)).sort((a,b)=>b.weight-a.weight||a.t-b.t);
 const windows=(xs:Incident[])=>{
  const ws:ReelWindow[]=[];
  for(const x of [...xs].sort((a,b)=>a.t-b.t)){const from=Math.max(0,x.t-lead),to=Math.min(dur,x.t+tail),last=ws.at(-1);
   if(last&&from<=last.to){last.to=Math.max(last.to,to);last.incidents.push(x);if(x.weight>last.incidents[0].weight)last.at=x.t;continue;}
   ws.push({from,to,at:x.t,incidents:[x]});}
  return ws;
 };
 const total=(ws:ReelWindow[])=>ws.reduce((n,w)=>n+w.to-w.from,0);
 let picked=[...keys];
 for(const x of extras){const next=[...picked,x];if(total(windows(next))>budget)continue;picked=next;}
 return windows(picked);
}
