// The Lab's words (English UI): the sandbox's coaching sentences, cue titles,
// space meanings and decision evidence, rebuilt as plain functions over the
// plan. `names(n)` gives the player standing in slot n of the practice lineup.
import type {LessonJob,LessonMoment,LessonSpec,LessonSpace,RecognisedEntry} from '../../../packages/football-engine/src/practice-playbook';
import type {ActionTrace} from '../../../packages/football-engine/src/practice-teaching';
import {intendedReceiver,momentOf,type Actor,type JobKind,type Slot,type StandingKind} from './model';

export type Names=(n:number)=>string;
/** Roles read mid-sentence ("when the runner receives from the carrier"); cap() starts a sentence. */
export const ROLE_LABELS={carrier:'the ball carrier',support:'the team-mate in support',runner:'the runner'} as const;
export const ROLE_SHORT={carrier:'the carrier',support:'the support player',runner:'the runner'} as const;
export const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
export const KIND_LABELS:Record<JobKind,[string,string]>={
 advance:['Carry it forward','Look for space and invite the press'],
 offer:['Offer a pass','Stay available for a team-mate'],
 run:['Attack a space','Find room to receive'],
 occupy:['Pin a defender','A threat next to him'],
 pass:['Look for the pass','A team-mate or a shared space'],
 shoot:['Look for the shot','When a real shot appears'],
 hold:['Hold the zone','Stay in support of the team'],
};
export const STANDING_LABELS:Record<StandingKind,string>={press:'Press the ball carrier',mark:'Mark an opponent',protect:'Protect a zone','stay-forward':'Stay forward for the outlet'};
export const DELIVERY_LABELS={auto:'Whatever the moment asks',ground:'Along the ground',loft:'In the air'} as const;
export const OPPOSITION_LABELS:Record<string,[string,string]>={
 original:['Their usual game','The practice opponent plays its own tactics.'],
 press:['High press','Closes the carrier early and squeezes the passing options. Can leave space behind.'],
 compact:['Compact block','Protects the middle, slides together, steps out when the attack comes close.'],
 tight:['Tight marking','Follows receivers closer and further from their zone. Runs can drag them out.'],
};
export const SCENE_LABELS={middle:'Middle',left:'Top flank',right:'Bottom flank'} as const;
/** Set pieces as the Start fold and the shelf name them. */
export const RESTART_LABELS={corner:'Corner',freeKick:'Free kick',throw:'Throw-in',goalKick:'Goal kick'} as const;
export const ZONE_LABELS={defensive:'Own third',middle:'Middle',attacking:'Attacking third'} as const;
/** "Corner from the left", "Free kick · final third, right", for the fold and the shelf. */
export function sceneLine(sc:{restart:keyof typeof RESTART_LABELS;side?:'left'|'right'|'any';zone?:string;ball:{y:number}}){
 const side=sc.ball.y<0?'left':'right',either=!sc.side||sc.side==='any';
 if(sc.restart==='goalKick')return 'Goal kick';
 if(sc.restart==='corner')return either?'Corner, either side':`Corner from the ${side}`;
 const zone=ZONE_LABELS[(sc.zone??'attacking') as keyof typeof ZONE_LABELS]?.toLowerCase()??'any third';
 return `${RESTART_LABELS[sc.restart]} · ${zone}, ${either?'either side':side}`;
}
/** A commentary line as shown under the pitch. A watch lasts 20 seconds, and
 * the final whistle counts minutes: "0.3333333333333333 minute" reads as seconds. */
export const commentary=(text:string)=>text.replace(/(\d+\.\d+) minute/g,(_,m:string)=>ro(Math.round(Number(m)*60),'secunde'));
/** A Romanian count: 1–19 (and 101–119…) take the noun directly, 20+ take "de" ("5 secunde", "20 de secunde"). */
export const ro=(n:number,noun:string)=>`${n} ${n%100>=20||(n>=100&&n%100===0)?'de ':''}${noun}`;
/** Plain words for the opponent's approach and the emphasis. */
export const OPPOSITION_PLAIN:Record<string,string>={original:'Normal',press:'High press',compact:'Compact block',tight:'Tight marking'};
export const emphasisPlain=(v:number)=>v===0?'Parked':v<=25?'Rarely':v<=50?'Sometimes':v<=75?'Often':'Whenever it fits';
export const ROLE_PLAIN={carrier:'on the ball',support:'in support',runner:'the runner'} as const;

export function slotLabel(n:number,l:LessonSpec,names:Names,short=false){
 const role=l.roles?.[n as Slot];
 return role?(short?ROLE_SHORT:ROLE_LABELS)[role]:short?`#${n}`:`#${n} ${names(n)}`;
}
/** A space's name mid-sentence: "attacks the channel", not "attacks The channel". */
export const spaceName=(j:{spaceId?:string},l:LessonSpec)=>{const n=l.spaces.find(s=>s.id===j.spaceId)?.name;return !n?'the chosen space':/^(The|A|An) /.test(n)?n.charAt(0).toLowerCase()+n.slice(1):n;};
export function passDestination(j:LessonJob,l:LessonSpec,names:Names){
 const receiver=intendedReceiver(l,j),who=typeof receiver==='number'?slotLabel(receiver,l,names):receiver?'the receiver':null;
 return j.spaceId?`${who??'a team-mate'} in ${spaceName(j,l)}`:who??'any free team-mate';
}
export function passLabel(j:LessonJob|undefined,l:LessonSpec,names:Names){
 if(!j)return 'the pass';
 return `the pass ${typeof j.actor==='number'?`from ${slotLabel(j.actor,l,names,true)}`:'from the receiver'} to ${passDestination(j,l,names)}`;
}
export function cueText(m:LessonMoment|undefined,l:LessonSpec,names:Names){
 if(!m)return 'The idea’s moment';const c=m.cue;
 if(c.kind==='start')return l.scene?'The set-up':'At the start';
 if(c.kind==='restart-taken')return 'At the kick';
 if(c.kind==='pressed')return `When ${typeof c.actor==='number'?slotLabel(c.actor,l,names,true):'the receiver'} is pressed`;
 const pass=l.jobs.find(j=>j.id===c.jobId);
 return c.kind==='received'?`After ${passLabel(pass,l,names)}`:`When ${passLabel(pass,l,names)} is played`;
}
/** "When X receives from Y" where the drawing says who receives. */
export function momentTitle(m:LessonMoment,l:LessonSpec,names:Names){
 if(m.cue.kind!=='received')return cueText(m,l,names);
 const cue=m.cue,pass=l.jobs.find(j=>j.id===cue.jobId),receiver=intendedReceiver(l,pass);
 return receiver!==null?`When ${typeof receiver==='number'?slotLabel(receiver,l,names):'the receiver'} receives from ${typeof pass?.actor==='number'?slotLabel(pass.actor,l,names,true):'a team-mate'}`:`After ${passLabel(pass,l,names)}`;
}
export function actorText(a:Actor,l:LessonSpec,names:Names){return typeof a==='number'?slotLabel(a,l,names):`whoever receives ${passLabel(l.jobs.find(j=>j.id===a.receiverOf),l,names)}`;}
/** One job as a plain instruction (the step list and "Together in this moment"). */
export function description(j:LessonJob,l:LessonSpec,names:Names){
 if(j.repeat)return `Plays a repeated one-two with ${slotLabel(j.recipient as number,l,names,true)}: pass, go for the return, shoot when it opens.`;
 if(j.kind==='advance')return `Carries it through ${spaceName(j,l)} while there is room.`;
 if(j.kind==='run')return `Attacks ${spaceName(j,l)} and looks to receive.`;
 if(j.kind==='offer')return `Offers a pass to ${j.teammate==='carrier'||!j.teammate?'the ball carrier':slotLabel(j.teammate,l,names,true)}; adjusts the angle.`;
 if(j.kind==='occupy')return `Stays a threat next to defender #${j.opponent}.`;
 if(j.kind==='hold')return `Holds ${j.spaceId?spaceName(j,l):'the zone he is in'}.`;
 if(j.kind==='shoot')return 'Looks for a real shot; keeps the other options.';
 return `Looks for the pass to ${passDestination(j,l,names)}${j.delivery==='loft'?', in the air if he can':j.delivery==='ground'?', along the ground':''}${j.fallback?'; may carry on through another team-mate':''}.`;
}
/** The short sentence per job the moment strip reads out. */
export function coachingSentence(j:LessonJob,l:LessonSpec,names:Names){
 const who=typeof j.actor==='number'?slotLabel(j.actor,l,names):'the receiver';
 const actions:Record<JobKind,string>={run:`attacks ${spaceName(j,l)} and stays available`,pass:`looks for the pass to ${passDestination(j,l,names)}`,offer:'offers a passing angle',shoot:'looks for the shot',advance:`carries it towards ${spaceName(j,l)}`,hold:`holds ${j.spaceId?spaceName(j,l):'the zone'}`,occupy:`keeps defender #${j.opponent} busy`};
 return `${cap(who)} ${j.repeat?'goes for the repeated one-two':actions[j.kind]}.`;
}
const metres=(v:number)=>Math.abs(v).toFixed(1);
export function spaceMeaning(s:LessonSpace,l:LessonSpec,names:Names){
 if(!s.anchor)return 'This part of the pitch.';const a=s.anchor,reference=a.kind==='opponent'?`opponent #${a.number}`:slotLabel(a.number,l,names,true);
 return `From ${reference}: ${metres(a.dx)} m ${a.dx>=0?'ahead':'behind'}, ${metres(a.dy)} m ${a.dy>=0?'down':'up'}.`;
}
export function receiverIdentity(a:{receiverOf:string},l:LessonSpec,mid:string,names:Names,rec?:RecognisedEntry|null,bound?:(slot:number)=>number|null){
 const actual=rec?.receiverBindings?.[a.receiverOf];if(actual)return `Receiver → #${actual} ${names(actual)}`;
 const m=l.moments.find(m=>m.id===mid),entry=m?.entry??l.moments.find(m=>m.id===rec?.momentId)?.entry,slot=entry?.receiverBindings?.[a.receiverOf];
 if(!slot)return 'Whoever receives';const n=bound?.(slot),role=slotLabel(slot,l,names,true);
 return `Receiver → ${role}${l.roles?.[slot]&&n?` (#${n})`:''}`;
}
/** Everyone's job in the moment, one line each, for the moment strip. */
export function momentSummary(l:LessonSpec,mid:string,jobs:LessonJob[],names:Names){
 return jobs.map(j=>`${j.momentId!==mid?'Continues: ':''}${coachingSentence(j,l,names)}`).join(' ');
}
export const stepTitle=(l:LessonSpec,mid:string,names:Names)=>momentTitle(momentOf(l,mid),l,names);

// ---------- trial evidence (sandbox decisionEvidence) ----------
export interface TrialPlayer {id:string;side:0|1;number:number;name:string}
const ACTION_WORDS:Record<string,string>={pass:'a pass',through:'a through ball',loft:'a lofted pass',carry:'a carry',shoot:'a shot',shot:'a shot',feint:'a dribble',clear:'a clearance',shield:'shielding the ball',offer:'a support position',show:'a support position',run:'a run',occupy:'a position by the defender',hold:'holding the zone',advance:'carrying it forward'};
export function decisionEvidence(e:ActionTrace,players:TrialPlayer[],trace:ActionTrace[]):string[]{
 const facts:string[]=[],v=e.evidence;if(!v)return facts;
 const who=(id?:string)=>{const p=players.find(p=>p.id===id);return p?`${p.side===0?'your':'their'} #${p.number}`:'a player';};
 if(v.entry?.independent)facts.push('The moment started from the situation on the pitch. The earlier pass was not assumed.');
 const cue=v.cue;
 if(cue?.kind==='pressed'&&cue.opponent){const gap=Number.isFinite(cue.distance)?` at ${cue.distance!.toFixed(1)} m`:'';facts.push(`At ${(e.momentTime??e.time).toFixed(1)} s, ${who(cue.opponent)} ${(cue.closingSpeed??0)>.35?'was closing on':'was next to'} ${who(cue.actor)}${gap}. That set the shared moment off.`);}
 else if(cue?.kind==='received'){const receipt=trace.findLast(q=>q.stepId===cue.jobId&&q.phase==='received'&&q.time<=e.time);if(receipt?.target)facts.push(`The pass really reached ${who(receipt.target)}. The next step follows this receiver if you chose “whoever receives”.`);}
 const action=(o:{kind:string;target?:string})=>`${ACTION_WORDS[o.kind]??'another option'}${o.target?` to ${who(o.target)}`:''}`;
 if(v.chosen)facts.push(`Chose ${action(v.chosen)}.`);
 if(v.reference)facts.push(`Adjusts his position to ${who(v.reference)}.`);
 const alternatives=[...new Set((v.options??[]).filter(o=>!v.chosen||o.kind!==v.chosen.kind||o.target!==v.chosen.target).map(action))].slice(0,2);
 if(v.chosen&&alternatives.length)facts.push(`Also weighed ${alternatives.join('; ')}.`);
 return facts;
}

/** A seed as players see it: "Variation 3", numbered in the order this page
 * met them (the raw seed is engine plumbing, never shown). */
const variations=new Map<number,number>();
export function variation(seed:number){
 let n=variations.get(seed);
 if(n===undefined){n=variations.size+1;variations.set(seed,n);}
 return `Variation ${n}`;
}

/** The validator's and the engine's own words are for the console, never the
 * pitch: a few known ones get a plain sentence, the rest the caller's fallback.
 * The raw error is always logged. */
const FRIENDLY:[RegExp,string][]=[
 // the board's own words pass through
 [/^Tap a grey defender\.$/,'Tap a grey defender.'],
 [/eight spaces/,'You already have eight spaces. Pick one of them.'],
 [/players overlap/i,'Two players stand on the same spot. Move one of them.'],
 [/ball must be in front of its owner/i,'Put the ball at the feet of the player who has it.'],
 [/pose does not match a starter|Starter missing/i,'The board’s players changed. Start from a blank board.'],
 [/at most \d+/i,'That’s as many steps as one idea can hold.'],
 [/receiverOf|pass (step|responsibility)|cannot follow|unknown condition step/i,'One step waits for a pass that isn’t there any more. Redraw that pass or remove the step.'],
 [/need unique valid IDs|shared lesson or legacy/i,'This idea can’t be saved as it is. Start it again from a blank board.'],
 [/emphasis/i,'Emphasis runs from 0 to 100.'],
 [/different football engine build|mismatch/i,'The Lab needs a reload to catch up. Refresh the page.'],
 [/timeout|took too long/i,'That took too long. Try again.'],
 [/Un-doiul repetat/i,'A one-two needs a partner, with no fixed spot or height.'],
];
export function friendly(error:unknown,fallback:string){
 const message=error instanceof Error?error.message:String(error);
 const code=typeof error==='object'&&error&&'code' in error?String((error as {code:unknown}).code):'';
 console.error('ballers:',error);
 for(const [re,text] of FRIENDLY)if(re.test(message)||re.test(code))return text;
 return fallback;
}
