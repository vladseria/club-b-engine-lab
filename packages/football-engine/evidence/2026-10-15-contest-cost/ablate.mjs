// Contest cost (2026-10-15): ablation switches for the contest build (ballers-contest c072321a, ENGINE_BUILD b95cd493),
// applied to the engine source at bundle time (esbuild onLoad, as 2026-10-12-stamina/variants.mjs does), so the engine
// source and its default path stay byte-for-byte what they are, and the full build pays nothing for the switches.
// Each piece put back to Round 1's behaviour (ballers-r1 ce74b470, engine 8ae8dc61):
//   rx    reception duels: no receptionDuel at the touch (duel = null), and the contesting defender aims goal-side of
//         the meeting point as before (contestSpot) instead of stepping in (contestAim)
//   air   contests in the air: no defender attacks the ball (receiving = undefined: no airAttacks, no goers), no contest
//         at the touch (contest = undefined), standing headers only (aerialBand = the plain shape, no jump difficulty),
//         the fixed reactions .18 / .2 (no airReaction), and a defender's aerial preparation weighs his options with the
//         team's support plan as R1 did
//   shot  pressure on the shooter: R1's shot read in practiceOptions (near / pressure, feltPressure twice, perceive with
//         SHOT_BELIEF, HURRIED_READ x shotHurry, R1's score) and R1's shotHurry at the strike (no shotContest; strikeShot's
//         offBalance is then 0, so its pace is R1's)
// Variant names are '+'-joined pieces with the prefix "no", e.g. norx, noair, noshot, norx+noair+noshot (= alloff).
// Every replacement must match exactly once, or the bundle fails.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const PR=/football-engine\/src\/practice\.ts$/,PD=/football-engine\/src\/practice-defending\.ts$/,PA=/football-engine\/src\/practice-aerial\.ts$/;
const R1SHOT=JSON.stringify(path.join(here,'r1-shot.ts'));
const T={
 rx:[
  [PR,`const duel=!direct&&same&&p.role!=='GK'&&ball.mode==='pass'&&!!releaseBy&&releaseBy!==p.id&&get(releaseBy).side===p.side?receptionDuel(p,body,old,hit.t,point,relativeSpeed):null;`,
      `const duel=null as any;`],
  [PD,`if(goer){plan.collector={id:goer.q.id,meet:contestAim(goer.q,goer.late)};done.add(goer.q.id);}`,
      `if(goer){plan.collector={id:goer.q.id,meet:spot};done.add(goer.q.id);}`],
  [PD,`aim=contestAim(q,contestRead(q,contestSpot!));`,`aim=contestSpot!;`],
 ],
 air:[
  [PR,`const receiving=!owner&&!restart&&ball.mode==='pass'&&aerialDelivery&&flight.receiver?get(flight.receiver):undefined;`,
      `const receiving=undefined as any;`],
  [PR,`const duel=!hunters.includes(id),reaction=existing?0:airReaction(p);`,`const duel=!hunters.includes(id),reaction=existing?0:.18;`],
  [PR,`const choices=footballOptions(future,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),releaseBy,0,null,time,p.side===side?support:null);`,
      `const choices=footballOptions(future,players,new Set(players.filter(q=>q.duty==='run').map(q=>q.id)),releaseBy,0,null,time,support);`],
  [PR,`const contest=!hit.meeting&&p.role!=='GK'&&ball.mode!=='shot'&&ball.z>=AIR_MIN?airChallenger(p,hit.t):undefined;`,
      `const contest=undefined as any;`],
  [PA,`return technique==='header'?{min:shape.min,max:shape.max+jumpReach(p)}:shape;`,`return shape;`],
  [PA,`export function aerialMeetings(p:PracticePlayer,ball:MovingBall,reaction=airReaction(p),`,`export function aerialMeetings(p:PracticePlayer,ball:MovingBall,reaction=.18,`],
  [PA,`return aerialMeetings(p,ball,airReaction(p,.2),samples)`,`return aerialMeetings(p,ball,.2,samples)`],
  [PA,`+(shot?.08:0)+(heading?Math.max(0,ball.z-STANDING_HEAD)*JUMP_DIFFICULTY:0),0,1);`,`+(shot?.08:0),0,1);`],
 ],
 shot:[
  [PR,`import type {StandingNote} from './practice-standing.js';`,
      `import type {StandingNote} from './practice-standing.js';\nimport {shotHurry as __r1ShotHurry,HURRIED_READ as __R1_HURRIED_READ,SHOT_BELIEF as __R1_SHOT_BELIEF} from ${R1SHOT};\nimport {feltPressure as __r1Felt} from './practice-possession.js';`],
  [PR,` const forward=depth(p.side,p.x),s=sign(p.side);`,
      ` const near=Math.min(...outfield.map(q=>dist(q,p))),pressure=clamp((6-near)/6,0,1),forward=depth(p.side,p.x),s=sign(p.side);`],
  [PR,`  const contest=shotContest(p,players,assessment.aim,{lead:preparationTime(p,'shoot'),sinceDuel:p.duelAt===undefined?undefined:time-p.duelAt});\n  const quality=shotRead(p,assessment.open,contest.hurry,p,time);`,
      `  const feltShot=__r1Felt(p,assessment.pressure),felt=__r1Felt(p,pressure);\n  const quality=assessment.quality*(1-feltShot*.24)/(1-assessment.pressure*.24)*clamp(perceive(p,'shot',1+__R1_SHOT_BELIEF*audacity,SHOT_SPREAD,p,{time,salt:'chance'}),.5,1.6)*(1-__R1_HURRIED_READ*__r1ShotHurry(p,players,assessment.aim));`],
  [PR,`score:SHOT_BASE+quality*SHOT_WORTH+shotTemper(p,contest.pressure)-laneRisk(`,`score:.1+quality*1.2+p.traits.risk*.09-felt*.08-laneRisk(`],
  [PR,`const contest=shot&&!o.freeKick?shotContest(p,players,aerial?aerial.plan.aim:shotRead!.aim,{firstTime,sinceDuel:p.duelAt===undefined?undefined:time-p.duelAt}):undefined;`,
      `const contest=undefined as any;`],
  [PR,`hurry=contest?.hurry??0;`,`hurry=shot&&!o.freeKick?__r1ShotHurry(p,players,aerial?aerial.plan.aim:shotRead!.aim,firstTime):0;`],
 ],
};
// (duelAt confirm, 2026-10-15) the leading explanation of the cost: `p.duelAt=time` adds a property to player objects
// mid-match, so players (and their {...p} copies) come in two shapes.
//   du     (as nodu) remove the one duelAt write that survives alloff (a tackle he rode and kept the ball): with the
//          shot piece off nothing reads duelAt, so alloff+nodu is still R1's football
//   dupre  not an ablation: every player is created with duelAt (undefined), so the write never changes his shape;
//          reads are unchanged, so the full build's football must be unchanged too. Confirmed (run 38725437287) and now
//          the engine source itself (practicePlayers), so dupre only applies to the source before that commit.
T.du=[[PR,`recovering.set(d.id,{until:time+.45,opponent:p.id});p.duelAt=time;say('tackle',`,`recovering.set(d.id,{until:time+.45,opponent:p.id});say('tackle',`]];
T.dupre=[[PR,`archetype:p.archetype??'',temperament:p.temperament??''};`,`archetype:p.archetype??'',temperament:p.temperament??'',duelAt:undefined};`]];
// SHOT_SPREAD is re-exported (not imported) by practice.ts on the contest build; R1 used it locally: import it for ~noshot
T.shot.push([PR,`export {SHOT_SPREAD} from './practice-shot-contest.js';`,`export {SHOT_SPREAD} from './practice-shot-contest.js';\nimport {SHOT_SPREAD} from './practice-shot-contest.js';`]);

export const ABLATIONS=['rx','air','shot'];
/** 'norx+noshot' -> ['rx','shot']; 'full' / '' -> []; 'alloff' -> all three. */
export const pieces=name=>!name||name==='full'?[]:name.split('+').flatMap(k=>{if(k==='alloff')return [...ABLATIONS];if(T[k]&&!k.startsWith('no'))return [k];const p=k.replace(/^no/,'');if(!T[p])throw Error(`unknown ablation '${k}'`);return [p];});

/** esbuild plugin applying the named ablation to this tree's engine source. */
export function ablatePlugin(name){
 const edits=pieces(name).flatMap(k=>T[k]);
 return {name:'contest-ablation',setup(b){
  if(!edits.length)return;
  b.onLoad({filter:/football-engine\/src\/practice(-defending|-aerial)?\.ts$/},a=>{
   let src=readFileSync(a.path,'utf8');
   for(const [file,from,to] of edits){
    if(!file.test(a.path))continue;
    const n=src.split(from).length-1;if(n!==1)throw Error(`ablation ${name}: '${from.slice(0,70)}' matched ${n} times in ${a.path}`);
    src=src.replace(from,()=>to);
   }
   return {contents:src,loader:'ts'};
  });
 }};
}
