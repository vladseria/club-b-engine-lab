import {clamp} from './model.js';
import {L} from './pitch.js';
import type {Vec} from './movement.js';
import {WORLD} from './world.js';

/** What the engine knows is not what the player knows (R2, 2026-10-01).
 *
 * Every read below starts from the exact visible picture (positions,
 * velocities, the ball) and returns what THIS player makes of it. Two things
 * separate the player from the engine:
 *  - noise: how well he reads it. A top reader is nearly exact; a poor one is
 *    clearly off. The spread comes from the skills the read uses (reading, and
 *    passing, finishing, control/dribble, keeping or defending where they
 *    apply), never from new stats;
 *  - bias: which way he misjudges it. Daring players (risk, audacity) are
 *    optimistic about lanes, races and the price of losing the ball; composed
 *    players feel pressure less than nervous ones. The average player is not
 *    systematically wrong.
 * Discipline and engagement separately shape how strictly a player follows a
 * team job against his own read (followsTeam, eagerness).
 *
 * The noise is deterministic and consumes no shared random stream: it is a
 * smooth value-noise field keyed on the player, the read and (optionally) the
 * thing read, over the place read and, where the caller knows it, time. The
 * same inputs give the same match; a misread persists while the situation
 * holds (a few metres, about a second) and changes as it changes, instead of
 * flickering from one tick to the next. */
export type Read='arrival'|'lane'|'block'|'pressure'|'shot'|'race'|'carry'|'keeper'|'threat'|'numbers'|'loss'|'sight'|'trigger';
/** A player as the layer reads him. Missing skills or traits (bare test
 * stubs, never a real roster) read as a perfect reader of typical temperament. */
export interface Reader {id:string;side?:number;skills?:Partial<{reading:number;passing:number;finishing:number;control:number;keeping:number;defending:number}>;traits?:Partial<{risk:number;dribble:number;discipline:number;engagement:number;audacity:number}>}

const skill=(n:number|undefined)=>clamp((n??10)/10,0,1);
const trait=(p:Reader,k:'risk'|'dribble'|'discipline'|'engagement',typical:number)=>p.traits?.[k]??typical;
/** How sharp this player's read of this kind of situation is, 0..1. */
export function acuity(p:Reader,read:Read):number{
 const s=p.skills??{},r=skill(s.reading);
 switch(read){
  case 'arrival':case 'lane':return WORLD.perception.acuity.laneReading.v*r+WORLD.perception.acuity.lanePassing.v*skill(s.passing);
  case 'shot':return WORLD.perception.acuity.shotReading.v*r+WORLD.perception.acuity.shotFinishing.v*skill(s.finishing);
  case 'carry':return WORLD.perception.acuity.carryControl.v*skill(s.control)+WORLD.perception.acuity.carryDribble.v*clamp(trait(p,'dribble',1),0,1)+WORLD.perception.acuity.carryReading.v*r;
  case 'keeper':return WORLD.perception.acuity.keeperKeeping.v*skill(s.keeping)+WORLD.perception.acuity.keeperReading.v*r;
  case 'threat':case 'trigger':return WORLD.perception.acuity.threatReading.v*r+WORLD.perception.acuity.threatDefending.v*skill(s.defending);
  default:return r;
 }
}
/** The size of his errors as a share of the read's full spread: 0.05 for a
 * perfect reader (10), about 0.35 for a good one (7), 0.65 for a poor one (4). */
export function misread(p:Reader,read:Read):number{return clamp(WORLD.perception.acuity.misreadTop.v-acuity(p,read),WORLD.perception.acuity.misreadFloor.v,1);}

/** Optimism, -0.5..1: how much a player underestimates what can go wrong.
 * Centred on the squad's typical risk trait (0.45); audacity ("tries the
 * audacious", "shoots on sight") adds to it. Missing audacity reads as none. */
export function daring(p:Reader):number{return clamp((trait(p,'risk',.45)-.45)*.9+(p.traits?.audacity??0)*.6,-.5,1);}
/** Composure, 0..1: keeping his head (discipline and reading, the "Keeps his
 * head" tendency). */
export function composure(p:Reader):number{return clamp(.55*trait(p,'discipline',.83)+.45*skill(p.skills?.reading??7),0,1);}
/** How strongly he feels the pressure he sees: below 1 for a daring or
 * composed player, above 1 for a nervous one; about 1 for a typical player. */
export function nerve(p:Reader):number{return clamp(1-.3*daring(p)-.5*(composure(p)-.78),.6,1.4);}
/** How strictly he follows a team job against his own read, 0..1. */
export const followsTeam=(p:Reader)=>clamp(trait(p,'discipline',.83),0,1);
/** His own appetite to engage, centred on the squad's typical engagement. */
export const eagerness=(p:Reader)=>clamp(trait(p,'engagement',.55)-.55,-.5,.5);

// ---- deterministic smooth noise ------------------------------------------
const hashes=new Map<string,number>();
function keyHash(key:string):number{
 let h=hashes.get(key);
 if(h===undefined){
  h=2166136261;
  for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}
  h>>>=0;
  if(hashes.size>100000)hashes.clear();
  hashes.set(key,h);
 }
 return h;
}
function lattice(h:number,i:number,j:number,k:number):number{
 let x=(h^Math.imul(i,0x27d4eb2d)^Math.imul(j,0x165667b1)^Math.imul(k,0x1b873593))>>>0;
 x=Math.imul(x^(x>>>15),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);x=(x^(x>>>16))>>>0;
 return x/4294967296*2-1;
}
const fade=(t:number)=>t*t*(3-2*t);
/** The engine's side prefix on player ids ("0:", "1:"). */
const SIDE=/(^|[^0-9A-Za-z])[01]:/g;
/** (engine speed, 2026-10-19) keyHash(`${id}|${read}|${salt}` without the side prefixes), remembered per (id, read,
 * salt) as given, so a repeated read skips building the key string and the prefix-stripping replace. The value is a
 * pure function of the three strings: what is remembered is exactly what would be computed. */
const readHashes=new Map<string,Map<string,Map<unknown,number>>>();let readHashCount=0;
function readHash(id:string,read:string,salt:unknown):number{
 let byRead=readHashes.get(id);if(byRead===undefined){byRead=new Map();readHashes.set(id,byRead);}
 let bySalt=byRead.get(read);if(bySalt===undefined){bySalt=new Map();byRead.set(read,bySalt);}
 let h=bySalt.get(salt);
 if(h===undefined){
  h=keyHash(`${id}|${read}|${salt}`.replace(SIDE,'$1'));
  if(readHashCount>100000){readHashes.clear();readHashCount=0;byRead=new Map();readHashes.set(id,byRead);bySalt=new Map();byRead.set(read,bySalt);}
  bySalt.set(salt,h);readHashCount++;
 }
 return h;
}
/** A misread persists over about this many metres of the place read ... */
export const READ_CELL=WORLD.perception.perception.READ_CELL.v;
/** ... and about this many seconds, where the caller knows the time. */
export const READ_TICK=WORLD.perception.perception.READ_TICK.v;
/** Standard deviation of the raw 2-D and 3-D fields (measured), so the
 * returned noise has unit spread. */
const SD2=.43,SD3=.37;
/** Unit-spread (sd 1, clipped to +-2.5) deterministic noise for this player,
 * read and thing read, smooth over the place and time read. */
export function readNoise(p:{id:string;side?:number},read:Read,at:Vec,time?:number,salt=''):number{
 // Read in the player's own frame (his own goal at x = 0, distance from the
 // centre line across) and keyed on the squad player, not the side he
 // happens to play on: a mirrored situation (end to end, or flank to flank)
 // is read the same way by the same player.
 const h=readHash(p.id,read,salt);
 const ax=p.side===1?L-at.x:at.x,ay=Math.abs(at.y);
 const x=ax/READ_CELL,y=ay/READ_CELL,i=Math.floor(x),j=Math.floor(y),u=fade(x-i),v=fade(y-j);
 let s=0;
 if(time===undefined){
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)s+=(a?u:1-u)*(b?v:1-v)*lattice(h,i+a,j+b,0);
  return clamp(s/SD2,-2.5,2.5);
 }
 const z=time/READ_TICK,k=Math.floor(z),w=fade(z-k);
 for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)s+=(a?u:1-u)*(b?v:1-v)*(c?w:1-w)*lattice(h,i+a,j+b,k+c);
 return clamp(s/SD3,-2.5,2.5);
}
/** The exact visible value `exact` as this player reads it: plus his error
 * (`spread` is the error of a player who cannot read at all, in the read's
 * own units) and his bias. */
export function perceive(p:Reader,read:Read,exact:number,spread:number,at:Vec,o:{time?:number;salt?:string;bias?:number}={}):number{
 return exact+spread*misread(p,read)*readNoise(p,read,at,o.time,o.salt)+(o.bias??0);
}

// ---- M3: seeing the picture a little late ---------------------------------
/** A defender reads an attacker who is NOT on the ball from what he saw a
 * moment ago, not from where the man is now (M3, 2026-10-01). The engine
 * re-plans every 0.25 s from exact positions, so before this a defender knew
 * every run the instant it began, and quick circulation opened lanes LESS
 * often than slow (evidence 2026-09-30-short-possession). How late he is:
 *  - reading: a top reader is almost current (~0.06 s), a typical one (6)
 *    ~0.18 s, a poor one (3) ~0.27 s;
 *  - legs: a tired player (energy under 90) is slower to take it in, up to
 *    +0.2 s at 50;
 *  - field of view: a man he cannot see (behind him, more than 100 degrees
 *    from where he is looking: at the ball when he is standing or shuffling,
 *    the way he runs when he is running) is picked up late, +~0.3 s;
 *  - the ball: while a pass is in the air he watches it, and his picture of
 *    the men around goes stale with the flight (a typical reader +~0.2 s for
 *    a 0.7 s pass), coming back quickly once it is received. Quick
 *    circulation keeps him there;
 *  - and a smooth individual variation, like every other read.
 * It is a read like the others: it never touches the ball. Going for the ball
 * (pressing, intercepting, covering the presser) is always exact. */
export const SIGHT={sharp:WORLD.perception.perception.SIGHT.sharp.v,span:WORLD.perception.perception.SIGHT.span.v,blind:WORLD.perception.perception.SIGHT.blind.v,tired:WORLD.perception.perception.SIGHT.tired.v,watch:WORLD.perception.perception.SIGHT.watch.v,cap:WORLD.perception.perception.SIGHT.cap.v,view:WORLD.perception.perception.SIGHT.view.v*Math.PI/180};
export interface SightContext {energy?:number;inView:boolean;watching:number;at:Vec;time?:number;salt?:string}
export function sightLag(p:Reader,o:SightContext):number{
 const a=acuity(p,'sight');
 let lag=SIGHT.sharp+SIGHT.span*(1-a);
 if(o.energy!==undefined)lag+=SIGHT.tired*clamp((WORLD.perception.acuity.tiredFrom.v-o.energy)/WORLD.perception.acuity.tiredSpan.v,0,1);
 if(!o.inView)lag+=SIGHT.blind*(WORLD.perception.acuity.blindBase.v-WORLD.perception.acuity.blindSharp.v*a);
 lag+=SIGHT.watch*(1-WORLD.perception.acuity.watchSharp.v*a)*clamp(o.watching,0,1);
 return clamp(lag*(1+WORLD.perception.acuity.lagNoise.v*readNoise(p,'sight',o.at,o.time,o.salt)),0,SIGHT.cap);
}
/** Whether `target` is in the field of view of a player at `from`, looking
 * along `facing` (radians). */
export function inView(from:Vec,facing:number,target:Vec):boolean{
 const bearing=Math.atan2(target.y-from.y,target.x-from.x);
 return Math.abs(Math.atan2(Math.sin(bearing-facing),Math.cos(bearing-facing)))<=SIGHT.view;
}
/** Where he looks: at the ball while standing or shuffling (under 2.5 m/s),
 * the way he runs when he is running. */
export function lookingAt(p:Vec&{vx:number;vy:number;angle:number},ball:Vec):number{
 return Math.hypot(p.vx,p.vy)<WORLD.perception.acuity.lookAtBallBelow.v?Math.atan2(ball.y-p.y,ball.x-p.x):p.angle;
}
/** A short memory of what everyone looked like (position and velocity), so a
 * read can be taken from a moment ago. Snapshots every `every` seconds over
 * the last `span` seconds; between snapshots the picture is interpolated. A
 * player with no history yet (just on, or asked about before the first
 * snapshot) is read as he is now. */
export class Sightings{
 private readonly size:number;private times:Float64Array;private rows=new Map<string,Float64Array>();private count=0;private head=-1;private last=-Infinity;
 constructor(private readonly every=1/20,span=1.2){this.size=Math.ceil(span/every)+2;this.times=new Float64Array(this.size);}
 /** Record the current picture (skips if the last snapshot is too recent). */
 record(time:number,players:readonly (Vec&{id:string;vx:number;vy:number})[]):void{
  if(time<this.last)this.clear();
  if(time-this.last<this.every-1e-9)return;
  this.head=(this.head+1)%this.size;this.count=Math.min(this.count+1,this.size);this.times[this.head]=time;this.last=time;
  for(const p of players){let r=this.rows.get(p.id);if(!r){r=new Float64Array(this.size*4).fill(NaN);this.rows.set(p.id,r);}const k=this.head*4;r[k]=p.x;r[k+1]=p.y;r[k+2]=p.vx;r[k+3]=p.vy;}
 }
 clear():void{this.count=0;this.head=-1;this.last=-Infinity;this.rows.clear();}
 /** The target as seen `lag` seconds before `time`. */
 at<T extends Vec&{id:string;vx:number;vy:number}>(target:T,time:number,lag:number):T{
  const r=this.rows.get(target.id);if(!r||!this.count||lag<=0)return target;
  const when=time-lag;
  // Newest first: find the first snapshot at or before `when`.
  let newer=-1;
  for(let n=0;n<this.count;n++){
   const i=(this.head-n+this.size)%this.size,t=this.times[i];
   if(!Number.isFinite(r[i*4]))break;
   if(t<=when+1e-9){
    if(newer<0){
     // Newer than every snapshot: between the last one and now.
     const span=time-t;if(span<=1e-9)return target;
     const u=clamp((when-t)/span,0,1);
     return {...target,x:r[i*4]+(target.x-r[i*4])*u,y:r[i*4+1]+(target.y-r[i*4+1])*u,vx:r[i*4+2]+(target.vx-r[i*4+2])*u,vy:r[i*4+3]+(target.vy-r[i*4+3])*u};
    }
    const t1=this.times[newer],u=clamp((when-t)/Math.max(1e-9,t1-t),0,1),a=i*4,b=newer*4;
    return {...target,x:r[a]+(r[b]-r[a])*u,y:r[a+1]+(r[b+1]-r[a+1])*u,vx:r[a+2]+(r[b+2]-r[a+2])*u,vy:r[a+3]+(r[b+3]-r[a+3])*u};
   }
   newer=i;
  }
  // Older than the memory: the oldest picture he still has.
  if(newer<0)return target;
  const b=newer*4;return {...target,x:r[b],y:r[b+1],vx:r[b+2],vy:r[b+3]};
 }
}
