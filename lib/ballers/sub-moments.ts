// A substitution on the pitch (12 Oct): the player coming off walks to the
// nearest touchline and fades out, the substitute jogs on from the bench
// touchline to where the match has him (a few metres along from the ghost's
// exit when both use the bench touchline, so neither hides the other), and the fourth official's board
// (red number off, green number on, the clock) stands on the bench side.
//
// View code, never engine code, and nothing stored. Like the referee's calls
// (calls.ts) every piece is a pure function of the playhead, read on every
// paint: paused, sought, at 4x, in Highlights or live, the same time gives
// the same picture, and nothing shows before the substitution's own instant
// (the live rule: nothing past the playhead).
//
// What really happens (football-engine practice.ts): a change is made only
// inside startRestart, i.e. at a stoppage. The replacement takes the
// outgoing player's place and position in one cut frame (`c`, with the new
// `l`), and the ball then stays dead for the restart's gather (2 s at least,
// 5 s at a kick-off). So the walk fits inside that dead ball: the substitute
// is drawn off his real spot only while nobody can play, and he is back on it
// before the kick. The one who walks off is an extra ghost token; he never
// stands in for anyone on the pitch.
//
// A change made at the kick-off after a goal (a "when losing" order) happens
// under the goal's takeover (GOAL_MS on the watch screens), so it waits for
// the takeover to finish: later than the match, never earlier.
import {frameAt, sample, type ReplayEvent, type ReplayFrame, type ReplayHeader} from './replay';

/** The walk at 1x, in match time (a faster replay walks longer in match time, as long as the ball stays dead). */
export const SUB_WALK_MS=2000;
/** A dead ball too short to walk in: the swap shows in place. */
export const SUB_WALK_MIN_MS=700;
/** The one going off fades out at the touchline. */
export const SUB_FADE_MS=500;
/** The board, as you watch it (a faster replay spends match time faster, as calls.ts BIG_MS does), and its cap in match time. */
export const SUB_BOARD_MS=3600;
export const SUB_BOARD_MAX_MS=9000;
/** The goal takeover on the watch screens (WatchGP / LiveGP GOAL_MS). */
export const SUB_TAKEOVER_MS=3000;
/** The walk ends this long before the kick, so the substitute is on his spot when play restarts. */
const DEAD_MARGIN_MS=150;
/** Touchline (engine y) and how far past it the walk ends (the run-off is 2 m). */
const TOUCH=15,PAST=1.1,X_MIN=3,X_MAX=45;
/** The bench touchline: the near one (bottom of the landscape pitch, right of the portrait one). */
const BENCH=1;
/** When the one going off leaves by the bench touchline too, the substitute comes on this far along it (towards
 * halfway, where the bench is), so the two never walk the same line and the ghost is not lost under his name. */
const APART=5;
/** Where the substitute steps on (engine x), given the one going off: his exit x and side of the pitch. */
const entryX=(exitX:number,offY:number)=>Math.sign(offY||1)!==BENCH?exitX:clamp(exitX+(exitX<=24?APART:-APART),X_MIN,X_MAX);

/** One change as the replay holds it. pos = the position (0-9) he takes;
 * dead = how long the ball stayed dead after it (ms), null while live play has
 * not reached the kick yet; goal = made at the kick-off after a goal. */
export interface SubMoment {t:number;side:0|1;on:number;off:number;pos:number;dead:number|null;goal:boolean;ball:[number,number]}

/** Every change of a replay, in time order. A change whose frame has not
 * arrived (live) waits until it has. */
export function subMoments(frames:readonly ReplayFrame[],events:readonly ReplayEvent[]):SubMoment[]{
 const goals=events.filter(e=>e.k==='goal').map(e=>e.t),out:SubMoment[]=[];
 for(const e of events){
  if(e.k!=='substitution'||e.a===undefined||e.g===undefined)continue;
  const i=frameAt(frames as ReplayFrame[],e.t),f=frames[i];if(!f||!f.l)continue;
  const pos=f.l.indexOf(e.a);if(pos<0)continue;
  let j=i;while(frames[j+1]?.r)j++;
  const dead=!f.r?0:frames[j+1]?frames[j+1].t-e.t:null;
  out.push({t:e.t,side:(e.s??(e.a>=5&&e.a<10?1:0)) as 0|1,on:e.a,off:e.g,pos,dead,goal:goals.some(g=>Math.abs(g-e.t)<50),ball:[f.b[0]/100,f.b[1]/100]});
 }
 return out.slice(0,-1);
}

const smooth=(k:number)=>k*k*(3-2*k);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

/** The timing of one change at a playback rate: when the walk starts (ms), how long it lasts, when the board shows. */
export function subTiming(m:SubMoment,rate=1){
 const r=Math.max(1,rate),dead=m.dead??Infinity,wait=m.goal?SUB_TAKEOVER_MS*r:0;
 const start=m.t+Math.min(wait,Math.max(0,dead-SUB_WALK_MIN_MS-DEAD_MARGIN_MS));
 const room=dead-(start-m.t)-DEAD_MARGIN_MS,walk0=Math.min(SUB_WALK_MS*r,room),walk=walk0>=SUB_WALK_MIN_MS?walk0:0;
 const board=m.t+wait;
 return {start,walk,fade:Math.min(1500,SUB_FADE_MS*r),board,boardTo:board+Math.min(SUB_BOARD_MAX_MS,SUB_BOARD_MS*r)};
}

/** What the pitch draws (components/ballers/kit/pitch.ts), all in engine metres:
 *  - hold: positions still showing the outgoing player (a change waiting out the goal takeover);
 *  - ghosts: the players walking off (replay index, where, opacity);
 *  - arrive: substitutes on their way on, drawn at lerp(from, real position, k);
 *  - fresh: positions whose newcomer is lit (the green ring and his name) while it all plays;
 *  - board: the fourth official's board, one row per change at that stoppage. `at` = the
 *    stoppage's clock (ms); `along` = where on the bench touchline it stands (engine x end it
 *    leans to: mid, or away from a ball lying under it). */
export interface SubBoardRow {color:string;code:string;off:{no:number;name:string};on:{no:number;name:string}}
export interface SubBoard {key:string;at:number;along:'mid'|'lo'|'hi';rows:SubBoardRow[]}
export interface PitchSub {hold:{pos:number;player:number}[];ghosts:{player:number;x:number;y:number;alpha:number}[];arrive:{pos:number;x:number;y:number;k:number}[];fresh:number[];board:SubBoard|null}

/** Where on the bench touchline the board stands (engine x): halfway, where the fourth official is, unless something
 * to watch lies under it there; then the end that keeps clearest of it. */
const ALONG={mid:24,lo:11,hi:37} as const,CLEAR=9;
function boardAlong(busy:number[]):'mid'|'lo'|'hi'{
 const room=(x:number)=>busy.length?Math.min(...busy.map(b=>Math.abs(b-x))):Infinity;
 if(room(ALONG.mid)>=CLEAR)return 'mid';
 return room(ALONG.lo)>=room(ALONG.hi)?'lo':'hi';
}

/** The substitution picture at t (ms), or null when none is playing. */
export function pitchSub(moments:readonly SubMoment[],frames:readonly ReplayFrame[],header:ReplayHeader,colors:readonly string[],t:number,rate=1):PitchSub|null{
 let out:PitchSub|null=null;const make=()=>out??={hold:[],ghosts:[],arrive:[],fresh:[],board:null};
 let shown:number|null=null;
 for(const m of moments){
  if(m.t>t)break;
  const tm=subTiming(m,rate),end=tm.start+tm.walk+tm.fade;
  if(t>=tm.board&&t<tm.boardTo)shown=m.t;
  if(t>=end)continue;
  const o=make();
  if(t<tm.start){o.hold.push({pos:m.pos,player:m.off});continue;}
  const from=sample(frames as ReplayFrame[],tm.start).players[m.pos];if(!from)continue;
  const k=tm.walk?Math.min(1,(t-tm.start)/tm.walk):1,e=smooth(k);
  const x=clamp(from.x,X_MIN,X_MAX),exitY=(from.y<0?-1:1)*(TOUCH+PAST);
  o.ghosts.push({player:m.off,x:from.x+(x-from.x)*e,y:from.y+(exitY-from.y)*e,alpha:k<1?1:Math.max(0,1-(t-tm.start-tm.walk)/tm.fade)});
  if(k<1)o.arrive.push({pos:m.pos,x:entryX(x,from.y),y:BENCH*(TOUCH+PAST),k:e});
  o.fresh.push(m.pos);
 }
 if(shown!==null){
  const at=shown,group=moments.filter(m=>m.t===at).sort((a,b)=>a.side-b.side),first=group[0];
  const p=(i:number)=>header.players[i];
  // What the board must not cover on its touchline: the ball lying near it, and where the players walk off and on.
  const busy=[...(first.ball[1]*BENCH>5?[first.ball[0]]:[]),...group.flatMap(m=>{const f=sample(frames as ReplayFrame[],subTiming(m,rate).start).players[m.pos],x=clamp(f?.x??24,X_MIN,X_MAX);return [x,entryX(x,f?.y??0)];})];
  make().board={key:String(at),at,along:boardAlong(busy),
   rows:group.map(m=>({color:colors[m.side],code:header.teams[m.side].code,off:{no:p(m.off)?.number??0,name:p(m.off)?.short??''},on:{no:p(m.on)?.number??0,name:p(m.on)?.short??''}}))};
 }
 return out;
}
