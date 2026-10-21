// Constructed starting situations for property tests (lane C, 2026-10-21): positions and facing only, the ball at
// its owner's foot, played on the public training path. A property test states what a player would expect from the
// situation; it does not search seeds for a moment. Side 0 attacks the goal at x = 48 (side 1 keeps it).
// Every scene's moment was swept over seeds 1-20 (evidence/2026-10-21-lane-c/README.md, "Seed sweep"); a test whose
// moment is not certain on every seed asserts it over several seeds (SEEDS below), never on one.
import {readFileSync} from 'node:fs';
import {runTraining,createTrainingSetup,createRestartSetup,practicePlayers} from '../dist/index.js';
export const fixture=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url)));
/** Seeds for a test that asserts a moment over several runs of the same start. */
export const SEEDS=[2026,1,2,3,4];

/** poses: [[x, y, angle?] x 5 for side 0, then x 5 for side 1], numbers 1-5 in order (the keeper is 1). Angles default to
 * facing the opponents' goal. owner: [side, number] on the ball, which sits 0.62 m in front of him. */
export function constructed(poses,owner=[0,5]){
 const list=poses.map(([x,y,angle],i)=>{const side=i<5?0:1;return {side,number:i%5+1,x,y,angle:angle??(side?Math.PI:0)};});
 const p=list.find(q=>q.side===owner[0]&&q.number===owner[1]);
 return {scene:'middle',poses:list,ball:{side:owner[0],number:owner[1],x:p.x+.62*Math.cos(p.angle),y:p.y+.62*Math.sin(p.angle)}};
}
/** Plays a constructed setup for the shortest training the engine allows (10 s). */
export function play(setup,{seed=2026,seconds=10,edit,...input}={}){
 const f=structuredClone(fixture);f.seed=seed;edit?.(f);
 return runTraining({fixture:f,setup,durationSeconds:seconds,...input}).result;
}
/** The angle from (x, y) to the centre of the goal side 0 attacks. */
export const facing=(x,y)=>Math.atan2(-y,48-x);
/** The same situation for the other team: every pose and the ball reflected through the centre spot, sides swapped. */
export const mirror=s=>({...s,poses:s.poses.map(p=>({...p,side:1-p.side,x:48-p.x,y:-p.y,angle:p.angle+Math.PI})),ball:{...s.ball,side:1-s.ball.side,x:48-s.ball.x,y:-s.ball.y}});

/** Side 0's #5 alone 10 m out in the middle, facing goal; every defender is 9 m or more behind him. */
export const clearShot=(x=38,y=0)=>constructed([[3,0],[14,0],[22,-8],[24,8],[x,y,facing(x,y)],[47,0],[26,2],[24,-4],[20,6],[18,-3]]);
/** The same, but he has the ball with his back to goal: he turns before he can strike, so the shot is long enough in
 * preparation for the release review to look at it. */
export const turnShot=()=>constructed([[3,0],[14,0],[22,-8],[24,8],[38,0,Math.PI],[47,0],[26,2],[24,-4],[20,6],[18,-3]]);
/** Side 0's #3 near the byline at (38, -7) facing across goal; #5 unmarked in front of goal at (39, 3). */
export const squareBall=()=>constructed([[3,0],[16,0],[38,-7,Math.PI/2],[33,0],[39,3],[47,0],[30,4],[28,-6],[25,6],[22,-2]],[0,3]);
/** Five runs at goal from 18-23 m (middle, both sides, wide), defenders behind, at a keeper 2 m off his line at (46, 1.5). */
export const runsAtGoal=()=>[[28,0],[27,-6],[29,7],[30,-10],[25,-2]].map(([x,y])=>constructed([[3,0],[8,0],[14,-8],[14,8],[x,y,facing(x,y)],[46,1.5],[16,2],[14,-4],[10,6],[9,-3]]));
/** A throw-in deep in side 0's half on the right: a team-mate's ball in flight near his own keeper. */
export const ownThrowIn=()=>createRestartSetup('throw',practicePlayers(structuredClone(fixture)),{side:'right',zone:'defensive'});
/** #3 on the ball at (14, 0); #5 checks short at (22, 2) with his marker a metre behind him. */
export const markedReceiver=()=>constructed([[3,0],[8,0],[14,0],[18,10],[22,2,Math.PI],[46,0],[30,-4],[23.2,2.2],[26,9],[20,-7]],[0,3]);

/** A top tackler (side 1's #3, Florin Paznic, defending 10) squared up to a poor carrier (side 0's #3, Crocodinho, control
 * 1) on the ball at (20, 0): 'front' 1.6 m in front of him, 'side' stepping in from his right shoulder, 'run' arriving
 * at speed from 4 m (a tackle through the man). Everyone else is 10 m or more away, so the duel is theirs. Pass
 * `edit: mismatch` to play(). */
export const tackle=where=>constructed([[3,0],[8,0],[20,0],[10,10],[12,-10],[46,0],[34,8],TACKLER[where],[34,-8],[30,0]],[0,3]);
/** Where the tackler starts, round the carrier at (20, 0) who faces goal ([x, y, facing]). */
export const TACKLER={front:[21.6,0],side:[20.9,1.1],run:[24,0],behind:[18.2,0.3,0],behindLeft:[19,-.8,.3],sideBack:[19.6,1,-.6]};
/** Tackles through the man: 'chase' a fast tackler (pace 10) running in from 3 m behind a carrier at (20, 0) with open
 * grass ahead; 'meet' a carrier at full pace (pace 10) running from (14, 0) at a tackler standing near his line at
 * (28, 0.6). The man is moving or the tackler arrives at speed, so a boot that goes through the ball into his leg hurts. */
export const through=kind=>kind==='chase'
 ?constructed([[3,0],[8,0],[20,0],[10,10],[12,-10],[46,0],[40,8],[17,.5,0],[40,-8],[36,0]],[0,3])
 :constructed([[3,0],[8,0],[14,0],[6,10],[6,-10],[46,0],[44,8],[28,.6,Math.PI],[44,-8],[42,0]],[0,3]);
export const throughEdit=kind=>f=>{
 const c=f.teams[0].squad.find(p=>p.id==='crocodinho'),d=f.teams[1].squad.find(p=>p.id==='motanescu');
 if(kind==='chase'){Object.assign(c.skills,{control:3,strength:3,passing:1,pace:6});Object.assign(c.traits,{dribble:.9,risk:.9});Object.assign(d.skills,{defending:7,strength:9,pace:10,reading:9});}
 else{Object.assign(c.skills,{control:4,strength:3,passing:1,pace:10});Object.assign(c.traits,{dribble:1,risk:1});Object.assign(d.skills,{defending:6,strength:9,pace:6,reading:8});}
 Object.assign(d.traits,{engagement:1,discipline:.2});
};
/** Seeds 1-20, the sweep's: for a moment too rare to promise on one seed, a test asserts it over these. */
export const SWEEP=Array.from({length:20},(_,i)=>i+1);
export const mismatch=f=>{
 const c=f.teams[0].squad.find(p=>p.id==='crocodinho');Object.assign(c.skills,{control:1,strength:2,passing:1,pace:3});Object.assign(c.traits,{dribble:.9,risk:.9});
 const d=f.teams[1].squad.find(p=>p.id==='motanescu');Object.assign(d.skills,{defending:10,strength:9,pace:8,reading:9});Object.assign(d.traits,{engagement:1,discipline:.5});
};
/** A poke rather than a clean tackle: a modest, clumsy tackler (defending 6, control 1, pace 4) against a quick, strong
 * carrier (pace 9, strength 9), so the ball is more often knocked loose for both men to chase. */
export const pokeLoose=f=>{
 mismatch(f);
 Object.assign(f.teams[0].squad.find(p=>p.id==='crocodinho').skills,{pace:9,strength:9});
 Object.assign(f.teams[1].squad.find(p=>p.id==='motanescu').skills,{defending:6,control:1,pace:4});
};
/** Tackles that took the ball (a 'tackle' event naming the victim's balance; a ridden tackle names none, a foul is a 'foul'). */
export const wonTackles=r=>r.events.filter(e=>e.kind==='tackle'&&e.balance?.victim);
/** Who is next on the ball after a tackle (within 3 s, before any restart), and when. */
export function nextOnBall(r,e){
 const k=r.frames.findIndex(x=>x.time>e.time+1e-6),next=r.frames.slice(k).find(x=>x.time>e.time+3||x.restart||(x.control?.owner??x.ball.owner));
 return next&&!next.restart&&next.time<=e.time+3?{who:next.control?.owner??next.ball.owner,after:next.time-e.time}:null;
}
/** The fixture with a bench (a keeper and two outfield players per side: rgk0, r10, r20 / rgk1, r11, r21). */
export function withBench(seed=2026){
 const f=structuredClone(fixture);f.seed=seed;
 for(const [side,t] of f.teams.entries()){
  const gk=t.squad.find(p=>p.roles[0]==='GK');
  t.squad.push({...structuredClone(gk),id:`rgk${side}`,name:`Portar rezervă ${side}`},
   {...structuredClone(t.squad[3]),id:`r1${side}`,name:`Rezerva unu ${side}`},
   {...structuredClone(t.squad[4]),id:`r2${side}`,name:`Rezerva doi ${side}`});
 }
 return f;
}
/** One set of orders covering every trigger kind (the substitution tests' 120 s run). `tired` is order t's threshold. */
export const subOrders=(tired=99.5)=>[
 {id:'h',side:0,in:'r10',trigger:{kind:'half'}},
 {id:'chain',side:0,in:'r20',out:'r10',trigger:{kind:'tired',player:'r10',threshold:99.9}},
 {id:'k',side:0,in:'rgk0',trigger:{kind:'score',state:'winning'}},
 {id:'t',side:1,in:'r11',trigger:{kind:'tired',player:'van',threshold:tired}},
 {id:'m',side:1,in:'r21',trigger:{kind:'margin',atLeast:1,direction:'down'},notBefore:30},
 {id:'d',side:1,in:'rgk1',trigger:{kind:'score',state:'drawing'}},
];
/** The training start for side 0 (#3 just recovered) and its mirror for side 1. */
export const bothStarts=()=>{const home=createTrainingSetup('middle');return [home,mirror(home)];};
