// Ready-made ideas: a few named starting points in the Lab's own plan format
// (the engine's PlaybookPlan with a lesson), saved to a club exactly like an
// idea drawn on the board and validated by the same validatePlans. Nothing
// here is a parallel format: once saved, a starter is an ordinary idea the
// manager can open, edit, rename or delete.
//
// Every starter uses flexible roles (carrier / support / runner) and spaces
// anchored to a player, so it can start wherever the ball is and with
// whoever has it, in any formation. verificare/ballers-starters.test.ts plays
// each one in real matches and fails if it never gets tried.
import type {LabPlan} from './model';

export interface Starter {
 /** Stable plan id: saving the same starter twice updates one idea, never two. */
 key:string;name:string;
 /** One line for the picker. */
 line:string;
 plan:()=>LabPlan;
}
const EMPHASIS=.8;
const idea=(key:string,name:string,lesson:LabPlan['lesson']):LabPlan=>({id:key,name,weight:100,emphasis:EMPHASIS,instructions:[],preferred:null,lesson});
const start={id:'start',name:'Start',cue:{kind:'start'}} as const;

export const STARTERS:readonly Starter[]=[
 {key:'starter-in-behind',name:'Ball in behind',line:'The runner goes beyond the last man; the pass meets him there.',
  plan:()=>idea('starter-in-behind','Ball in behind',{
   roles:{3:'carrier',5:'runner'},
   spaces:[{id:'behind',name:'The space in behind',x:35,y:2,radius:3.5,anchor:{kind:'player',number:5,dx:8,dy:0}}],
   moments:[start,{id:'arrives',name:'When the runner receives',cue:{kind:'received',jobId:'through'}}],
   jobs:[
    {id:'run',momentId:'start',actor:5,kind:'run',spaceId:'behind'},
    {id:'through',momentId:'start',actor:3,kind:'pass',recipient:5,spaceId:'behind',delivery:'auto',fallback:true},
    {id:'finish',momentId:'arrives',actor:{receiverOf:'through'},kind:'shoot'},
   ]})},
 {key:'starter-lay-off',name:'Drop short, lay it off',line:'One comes short for the ball and plays it on to a runner.',
  plan:()=>idea('starter-lay-off','Drop short, lay it off',{
   roles:{3:'carrier',5:'support',4:'runner'},
   spaces:[{id:'channel',name:'The channel',x:28,y:7,radius:3.5,anchor:{kind:'player',number:4,dx:8,dy:0}}],
   moments:[start,{id:'set',name:'When the ball arrives short',cue:{kind:'received',jobId:'short'}},{id:'arrives',name:'When the runner receives',cue:{kind:'received',jobId:'on'}}],
   jobs:[
    {id:'show',momentId:'start',actor:5,kind:'offer',teammate:'carrier'},
    {id:'short',momentId:'start',actor:3,kind:'pass',recipient:5,delivery:'ground',fallback:true},
    {id:'go',momentId:'set',actor:4,kind:'run',spaceId:'channel'},
    {id:'on',momentId:'set',actor:{receiverOf:'short'},kind:'pass',recipient:4,spaceId:'channel',delivery:'auto',fallback:true},
    {id:'finish',momentId:'arrives',actor:{receiverOf:'on'},kind:'shoot'},
   ]})},
 {key:'starter-drive-slip',name:'Drive and slip',line:'Carry it at them; when pressed, slip the runner through.',
  plan:()=>idea('starter-drive-slip','Drive and slip',{
   roles:{3:'carrier',5:'runner'},
   spaces:[
    {id:'drive',name:'The drive lane',x:26,y:-4,radius:3.5,anchor:{kind:'player',number:3,dx:8,dy:0}},
    {id:'slip',name:'The slip space',x:37,y:2,radius:3.5,anchor:{kind:'player',number:5,dx:10,dy:0}},
   ],
   moments:[start,{id:'pressed',name:'When the carrier is pressed',cue:{kind:'pressed',actor:3}},{id:'arrives',name:'When the runner receives',cue:{kind:'received',jobId:'slide'}}],
   jobs:[
    {id:'carry',momentId:'start',actor:3,kind:'advance',spaceId:'drive'},
    {id:'run',momentId:'start',actor:5,kind:'run',spaceId:'slip'},
    {id:'slide',momentId:'pressed',actor:3,kind:'pass',recipient:5,spaceId:'slip',delivery:'auto',fallback:true},
    {id:'finish',momentId:'arrives',actor:{receiverOf:'slide'},kind:'shoot'},
   ]})},
 {key:'starter-recycle',name:'Back, then forward',line:'Play it back to the spare man, who finds the runner.',
  plan:()=>idea('starter-recycle','Back, then forward',{
   roles:{3:'carrier',2:'support',4:'runner'},
   spaces:[
    {id:'spare',name:'The space behind the ball',x:11,y:-4,radius:3.5,anchor:{kind:'player',number:3,dx:-7,dy:0}},
    {id:'far',name:'The far lane',x:28,y:7,radius:3.5,anchor:{kind:'player',number:4,dx:8,dy:0}},
   ],
   moments:[start,{id:'back',name:'When the ball goes back',cue:{kind:'received',jobId:'reset'}},{id:'arrives',name:'When the runner receives',cue:{kind:'received',jobId:'out'}}],
   jobs:[
    {id:'drop',momentId:'start',actor:2,kind:'hold',spaceId:'spare'},
    {id:'reset',momentId:'start',actor:3,kind:'pass',recipient:2,spaceId:'spare',delivery:'ground',fallback:true},
    {id:'go',momentId:'back',actor:4,kind:'run',spaceId:'far'},
    {id:'out',momentId:'back',actor:{receiverOf:'reset'},kind:'pass',recipient:4,spaceId:'far',delivery:'auto',fallback:true},
    {id:'finish',momentId:'arrives',actor:{receiverOf:'out'},kind:'shoot'},
   ]})},
];
export const starterByKey=(key:string)=>STARTERS.find(s=>s.key===key);
