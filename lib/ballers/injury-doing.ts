// What a hurt man was doing at the second he got hurt, read from the stored replay alone (the owner's decision: a tiredness
// injury's caption says "muscle injury, while chasing back · he was a bit tired · out for 1 match", so a manager sees at
// that moment that a tired man got hurt doing something). Pure, deterministic and backward-looking: only frames and
// events at or before the injury's own second are read, so the live broadcast (which holds them by the time the knock
// shows) and the replay say the same words, and a chunk arriving later never changes them.
//
// Read in this order; the first that holds wins:
//  1. 'shooting': a shot of his within SHOT_MS before the injury (the `shot` event, a = him);
//  2. 'dribbling': he has the ball at his feet in his last frame before going down (o = him, live play, the ball under
//     FEET_CM high: a keeper holding it in his hands, 100 cm in the stored frames, is not dribbling, and is read on by
//     the running checks below);
//  3. 'pass': a pass to him is on its way (the last ball event at or before the injury is a `pass` with g = him, made at
//     most PASS_MS before, and nobody has the ball in that frame);
//  4. 'back': running fast towards his own goal (the goal-axis speed at least FAST m/s, averaged over the last WINDOW_MS
//     before he went down) while the other side has the ball;
//  5. 'forward': running fast towards the other goal, without the ball (any possession);
//  otherwise null (the caption then says "muscle injury" alone).
//
// The attacking direction: the stored coordinates are team-relative for the whole match. Side 0 always attacks the goal
// at x = L and side 1 the goal at x = 0, in both halves: the engine never swaps them at half-time ("Coordinates stay
// team-relative", packages/football-engine/src/practice.ts, the half-time block), only the watch screens turn the second
// half round on screen (lib/ballers/half-view.ts turnPitch). Checked on the recording of 12 Nov (78 Global league
// matches, every shot: side 0 aimed at the high-x goal 1140 times in the first half and 335 in the second, never at the
// low one; side 1 the other way round, 1061 and 291). So the per-half direction is the same sign in both halves.
//
// The thresholds (measured on the same recording, frames 0.2 s apart): a man's goal-axis speed off the ball has a median
// under 1 m/s and its top tenth from about 4.4 m/s (towards the other goal, his side on the ball) or 5.0 m/s (towards his
// own, the other side on the ball); the engine's fastest men reach 7-8 m/s. FAST = 4 m/s over the last 0.4 s is clearly
// running, not jogging: in the last four minutes of those matches it marks 9 % of an outfielder's live moments as
// chasing back and 8 % as running forward (dribbling 6 %, a pass on its way 4 %, shooting 0.3 %, nothing 72 %). A pass is
// in flight under 2.9 s in 99 % of cases (PASS_MS 3 s). The three tiredness injuries on the recording read: running
// forward (7.0 m/s), chasing back (4.4 m/s, the other side on the ball), and nothing (0.8 m/s).
import {frameAt, type ReplayEvent, type ReplayFrame} from './replay';

export type HurtDoing='shooting'|'dribbling'|'pass'|'back'|'forward';

/** A shot of his this long before the injury (ms) is "while shooting". */
export const SHOT_MS=500;
/** A pass to him made at most this long before (ms), not yet taken by anyone, is "while reaching for a pass". */
export const PASS_MS=3000;
/** The ball at most this high (cm) with him as its owner is at his feet. */
export const FEET_CM=50;
/** Running fast: at least this speed (m/s) along the length of the pitch... */
export const FAST=4;
/** ...averaged over this long (ms) up to his last frame before going down. */
export const WINDOW_MS=400;

/** The events that say where the ball is (a `pass` stays the last of them while it is in flight). */
const BALL=new Set(['pass','receive','shot','clearance','turnover','tackle','out','save','block','goal','restart','foul','offside']);

/** The goal-axis sign for a side: +1 when it attacks the high-x goal (side 0), -1 for side 1, in both halves. */
export const attackSign=(side:0|1)=>side===0?1:-1;

/** What `player` (replay index) of `side` was doing at `t` (ms, the injury event's own second); null for none of the
 * above, or when the frames don't show him. */
export function hurtDoing(frames:readonly ReplayFrame[],events:readonly ReplayEvent[],k:{t:number;player:number;side:0|1}):HurtDoing|null{
 const {t,player,side}=k;
 if(events.some(e=>e.k==='shot'&&e.a===player&&e.t<=t&&e.t>=t-SHOT_MS))return 'shooting';
 const F=frames as ReplayFrame[];
 // his position in a frame (0-9): the identity until the first change, then through the frame's lineup (`l`)
 const slot=(f:ReplayFrame)=>f.l?f.l.indexOf(player):player<10?player:-1;
 // his last frame before he went down: from the knock he lies on the floor (`d` lists him), so step back past those
 let n=frameAt(F,t);
 while(n>=0&&F[n].t>=t-1000&&(F[n].d??[]).includes(slot(F[n])))n--;
 if(n<0)return null;
 const f=F[n],j=slot(f);
 if(j<0||f.r)return null;
 // the ball at his feet: dribbling; in a keeper's hands (or otherwise off the ground), read on as for a man without it
 if(f.o===player&&f.b[2]<FEET_CM)return 'dribbling';
 let last:ReplayEvent|undefined;
 for(const e of events)if(e.t<=t&&BALL.has(e.k)&&(!last||e.t>=last.t))last=e;
 if(last&&last.k==='pass'&&last.g===player&&t-last.t<=PASS_MS&&f.o<0)return 'pass';
 // his speed along the pitch over the last WINDOW_MS: no cut or dead ball in between
 const s=frameAt(F,f.t-WINDOW_MS);
 if(s<0||s>=n)return null;
 for(let i=s;i<=n;i++)if(F[i].r||i>s&&F[i].c)return null;
 const a=F[s],ja=slot(a),dt=(f.t-a.t)/1000;
 if(ja<0||dt<0.3||dt>0.8)return null;
 const along=(f.p[j][0]-a.p[ja][0])/100/dt*attackSign(side);
 if(along>=FAST)return 'forward';
 if(-along>=FAST&&f.ps!==side)return 'back';
 return null;
}
