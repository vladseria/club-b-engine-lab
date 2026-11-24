// The ready-made moves and which one a move was taken from: the half of lib/ballers/moves.ts that never touches the
// football engine (the starters and the lab model are plain data and types), so a screen that only names or pictures
// a move (the plan page's Moves row) doesn't carry the engine with it. moves.ts re-exports all of it.
import {STARTERS} from './lab/starters';
import {oneTwoPlan,type LabPlan,type LessonSpec} from './lab/model';

// ------------------------------------------------------------------ the ready-made moves
export type Role='carrier'|'runner'|'support';
/** One "who" question: the job it asks about, and the flexible role that answers "whoever fits". */
export interface Part {id:string;ask:string;
 /** The job whose actor this part is (a start-moment job with a numbered actor). */ job:string;
 /** The flexible role offered as the first answer; absent = a player must be named. */ role?:Role}
export interface Template {key:string;name:string;
 /** The one line under the name: what it is, in the Lab's own words. */ line:string;
 plan:()=>LabPlan;parts:Part[];
 /** Words for the always-true sentence, given each part's answer as a name or null (= whoever fits). */
 sentence:(who:Record<string,string|null>)=>string}

/** "Whoever fits", in each role's own words (the engine's binding rules, practice-recognition.ts). */
export const ROLE_ANY:Record<Role,{label:string;line:string}>={
 carrier:{label:'Whoever has the ball',line:'It can start with any of them on the ball.'},
 runner:{label:'Whoever can get there first',line:'The best-placed player makes the run.'},
 support:{label:'Whoever gives the best angle',line:'The best-placed player comes to help.'},
};

export const ONE_TWO_KEY='one-two';
const starter=(key:string)=>STARTERS.find(s=>s.key===key)!;
const has=(n:string|null,any:string)=>n??any;
export const TEMPLATES:readonly Template[]=[
 {key:'starter-in-behind',name:'Ball in behind',line:starter('starter-in-behind').line,plan:starter('starter-in-behind').plan,
  parts:[{id:'runner',ask:'Who runs in behind?',job:'run',role:'runner'},{id:'passer',ask:'Who plays it?',job:'through',role:'carrier'}],
  sentence:w=>`When ${w.passer?`${w.passer} has the ball`:'you have the ball'} and ${has(w.runner,'a runner')} can get in behind, they look to slip it through to him. If it reaches him, he looks for the shot.`},
 {key:'starter-lay-off',name:'Drop short, lay it off',line:starter('starter-lay-off').line,plan:starter('starter-lay-off').plan,
  parts:[{id:'short',ask:'Who comes short?',job:'show',role:'support'},{id:'runner',ask:'Who runs on to it?',job:'go',role:'runner'}],
  sentence:w=>`${w.short?`${w.short} comes`:'One of them comes'} short for the ball. When it reaches him, ${has(w.runner,'a runner')} goes, and they look to lay it on to him for a shot.`},
 {key:'starter-drive-slip',name:'Drive and slip',line:starter('starter-drive-slip').line,plan:starter('starter-drive-slip').plan,
  parts:[{id:'driver',ask:'Who drives at them?',job:'carry',role:'carrier'},{id:'runner',ask:'Who makes the run?',job:'run',role:'runner'}],
  sentence:w=>`${w.driver?`${w.driver} carries`:'Whoever has the ball carries'} it at them while ${has(w.runner,'a runner')} runs. When he is pressed, they look to slip the runner through for a shot.`},
 {key:'starter-recycle',name:'Back, then forward',line:starter('starter-recycle').line,plan:starter('starter-recycle').plan,
  parts:[{id:'spare',ask:'Who is the spare man?',job:'drop',role:'support'},{id:'runner',ask:'Who runs?',job:'go',role:'runner'}],
  sentence:w=>`${w.spare?`${w.spare} drops`:'One of them drops'} behind the ball to take it back. When it reaches him, ${has(w.runner,'a runner')} goes on the far side, and they look to find him for a shot.`},
 {key:ONE_TWO_KEY,name:'Repeated one-two',line:'Two players pass and go for the return, again and again, until a shot opens or it breaks.',
  plan:()=>({...oneTwoPlan(3,5,'#3','#5',.8),id:ONE_TWO_KEY,name:'Repeated one-two'}),
  parts:[{id:'a',ask:'Who starts it?',job:'pair'},{id:'b',ask:'Who is his partner?',job:'pair'}],
  sentence:w=>`${w.a??'One of them'} and ${w.b??'his partner'} look to pass and go for the return, again and again, until a shot opens or the move breaks.`},
];
export const templateOf=(key:string)=>TEMPLATES.find(t=>t.key===key);

// ------------------------------------------------------------------ reading a move
export const isRoutine=(plan:unknown)=>!!(plan as {lesson?:{scene?:unknown}}|null)?.lesson?.scene;
export const lessonOf=(plan:unknown)=>(plan as {lesson?:LessonSpec}|null)?.lesson??null;
const isOneTwo=(l:LessonSpec)=>l.jobs.length===1&&!!l.jobs[0].repeat&&typeof l.jobs[0].actor==='number'&&typeof l.jobs[0].recipient==='number';
/** The template a move was taken from, when its plan still has that shape. */
export function templateFor(m:{key?:string;plan:unknown}):Template|undefined{
 const id=(m.plan as {id?:string})?.id??m.key,l=lessonOf(m.plan);if(!l)return undefined;
 const fromKey=TEMPLATES.find(t=>t.key===id);
 if(fromKey)return fromKey;
 if(isOneTwo(l))return templateOf(ONE_TWO_KEY);
 // A copy keeps the template's job ids (copyMove only renames the plan).
 return TEMPLATES.find(t=>t.key!==ONE_TWO_KEY&&t.parts.every(p=>l.jobs.some(j=>j.id===p.job&&typeof j.actor==='number'))&&l.jobs.length===(t.plan().lesson.jobs.length));
}
