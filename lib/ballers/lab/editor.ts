'use client';
// The Lab editor's state: the idea on the board, where the editor stands, the
// trial setup. Every change goes through edit(): clone, apply, validate with
// the engine (validatePlans + validateTrainingSetup), then keep it with a
// 30-deep undo stack and a per-club local draft, exactly like the sandbox's
// edit(). A change the engine refuses is dropped with its reason. A slider
// drag or a number being typed is one undo step (the `merge` key), and a
// stored draft that no longer opens is set aside for the manager to restore
// or discard, never dropped silently.
import {useCallback, useEffect, useRef, useState} from 'react';
import {createTrainingSetup,validatePlans,validateTrainingSetup} from '../../../packages/football-engine/src/index';
import type {PracticePlayer} from '../../../packages/football-engine/src/practice';
import {copy,freshPlan,makeUid,oneTwoPlan,syncScene,UNDO_DEPTH,type Actor,type LabPlan,type Picking,type Scene,type SceneRestart,type Slot,type TrainingSetup} from './model';
import type {Opposition} from './protocol';
import {friendly} from './text';

export interface Board {
 plan:LabPlan;emphasis:number;manager:'lesson'|'one-two';pairA:Slot;pairB:Slot;
 moment:string;actor:Actor;
 /** Open play ('middle' / flanks / your own layout) or a restart scene (a set-piece routine). */
 setup:TrainingSetup;scene:Scene|'custom'|SceneRestart;seed:number;opposition:Opposition;
 /** The five an opened idea was drawn with (kept for the draft; the Lab reads the saved idea's own five); null = the next match's five. */
 lineup:string[]|null;
}
/** What is on screen but not part of an undo step. */
export interface View {space:string|null;picking:Picking;setupMode:boolean}
export const uid=makeUid();

export function blankBoard():Board{
 return {plan:freshPlan(uid),emphasis:100,manager:'lesson',pairA:3,pairB:5,moment:'start',actor:3,setup:createTrainingSetup('middle'),scene:'middle',seed:2026,opposition:'original',lineup:null};
}
/** The idea as the engine takes it: the one-two preset, or the board with its emphasis. */
export function editorPlan(b:Board,name:(n:number)=>string):LabPlan{
 if(b.manager==='one-two')return oneTwoPlan(b.pairA,b.pairB,name(b.pairA),name(b.pairB),b.emphasis/100);
 const plan={...copy(b.plan),emphasis:b.emphasis/100};
 // A routine's spots are where the board stands its players.
 if(plan.lesson.scene)syncScene(plan.lesson,b.setup);
 return plan;
}

const draftKey=(club:string)=>`ballers:${club}:lab-v2`;
/** Drafts the old Lab (the iframe) kept per club, so an unsaved board carries over once. */
const legacyKey=(club:string)=>`ballers:${club}:football-coaching-responsibilities-v1`;
/** A draft that no longer opens is set aside here, never silently dropped. */
const brokenKey=(club:string)=>`ballers:${club}:lab-v2-broken`;

/** Read a stored draft. `strict`: every part must pass the engine's checks;
 * otherwise the parts that don't (the setup, the moment) fall back to the
 * blank board's and only the idea itself must still be valid. Throws when
 * even that fails. */
export function readDraft(raw:string,players:PracticePlayer[],strict=true):Board{
 const s=JSON.parse(raw) as Partial<Board>&{plan:LabPlan};const base=blankBoard();
 const plan=validatePlans([s.plan])[0] as LabPlan;
 let setup:TrainingSetup;
 try{setup=validateTrainingSetup(s.setup,players);}catch(e){if(strict)throw e;setup=base.setup;}
 const pair=(v:unknown,d:Slot)=>([2,3,4,5].includes(v as number)?v:d) as Slot;
 const keptSetup=setup!==base.setup;
 const b:Board={...base,plan,setup,scene:keptSetup&&(['middle','left','right','custom','corner','freeKick','throw','goalKick'] as const).includes(s.scene as Scene)?s.scene as Board['scene']:'middle',
  seed:Number.isInteger(s.seed)?s.seed!:2026,emphasis:Number.isFinite(s.emphasis)?Math.max(0,Math.min(100,s.emphasis!)):100,
  manager:s.manager==='one-two'?'one-two':'lesson',pairA:pair(s.pairA,3),pairB:pair(s.pairB,5),
  opposition:(['original','press','compact','tight'] as const).includes(s.opposition as Opposition)?s.opposition!:'original',
  moment:plan.lesson.moments.some(m=>m.id===s.moment)?s.moment!:'start',actor:(s.actor??3) as Actor,
  lineup:Array.isArray(s.lineup)&&s.lineup.length===5?s.lineup:null};
 if(b.pairA===b.pairB)b.pairB=b.pairA===2?3:2;
 return b;
}
/** A stored draft that failed to open: kept aside until the manager decides. */
export interface BrokenDraft {raw:string;
 /** What can come back (the idea with a fresh setup), or null when nothing can. */ partial:Board|null}
function restore(club:string,players:PracticePlayer[]):{board:Board|null;broken:BrokenDraft|null}{
 let raw:string|null=null;
 try{
  const aside=localStorage.getItem(brokenKey(club));
  raw=localStorage.getItem(draftKey(club))??localStorage.getItem(legacyKey(club));
  if(!raw)return {board:null,broken:aside?{raw:aside,partial:lenient(aside,players)}:null};
  return {board:readDraft(raw,players),broken:aside?{raw:aside,partial:lenient(aside,players)}:null};
 }catch{
  if(!raw)return {board:null,broken:null};
  // Keep it: set aside under its own key (the next edit overwrites the draft key).
  try{localStorage.setItem(brokenKey(club),raw);localStorage.removeItem(draftKey(club));}catch{/* private mode: it stays in memory for this visit */}
  return {board:null,broken:{raw,partial:lenient(raw,players)}};
 }
}
function lenient(raw:string,players:PracticePlayer[]):Board|null{try{return readDraft(raw,players,false);}catch{return null;}}

export interface Editor {
 board:Board;view:View;undoCount:number;message:{text:string;error:boolean}|null;
 /** Apply a change to a clone; kept only if the engine accepts it. Returns
  * success. `merge`: consecutive edits with the same key (one slider drag, one
  * number being typed) share one undo step until `seal()`. */
 edit:(fn:(d:Board)=>void,message?:string,merge?:string)=>boolean;
 /** End the current merge run (pointer released, field left). */
 seal:()=>void;
 /** The board as of the last edit, even before React re-renders. */
 current:()=>Board;
 /** Move around without an undo step (selection, the moment on screen). */
 move:(patch:Partial<Pick<Board,'moment'|'actor'>>&Partial<View>)=>void;
 setView:(patch:Partial<View>)=>void;
 undo:()=>void;
 say:(text:string,error?:boolean)=>void;
 load:(b:Board,message?:string)=>void;
 /** A stored draft that didn't open; restore what can come back, or discard it. */
 broken:BrokenDraft|null;
 restoreBroken:()=>void;
 discardBroken:()=>void;
}

/** The editor without React: the board, its undo stack and the merge run.
 * `check` throws when the engine refuses a board. Pure, so the undo rules and
 * "edit, then act on the edited board" are unit-tested (verificare/ballers-lab). */
export class EditorCore {
 board:Board;undo:Board[]=[];private merging:string|null=null;
 constructor(board:Board,private check:(b:Board)=>void){this.board=board;}
 private push(b:Board){this.undo.push(b);if(this.undo.length>UNDO_DEPTH)this.undo.shift();}
 /** Apply to a clone; kept only when `check` accepts it. Consecutive edits with the same `merge` key share one undo step. */
 edit(fn:(d:Board)=>void,merge?:string):{ok:true}|{ok:false;error:string}{
  const before=this.board,draft=copy(before);
  try{fn(draft);this.check(draft);}catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
  if(!merge||this.merging!==merge)this.push(before);
  this.merging=merge??null;this.board=draft;return {ok:true};
 }
 seal(){this.merging=null;}
 /** Replace without an undo step (moving around the idea). */
 set(b:Board){this.board=b;}
 load(b:Board){this.merging=null;this.push(this.board);this.board=b;}
 back():Board|null{const b=this.undo.pop();if(!b)return null;this.merging=null;this.board=b;return b;}
 reset(b:Board){this.undo=[];this.merging=null;this.board=b;}
}

export function useEditor(club:string|null,players:PracticePlayer[]|null):Editor{
 const [board,setBoard]=useState<Board>(blankBoard);
 const [view,setViewState]=useState<View>({space:null,picking:null,setupMode:false});
 const [message,setMessage]=useState<Editor['message']>(null);
 const [broken,setBroken]=useState<BrokenDraft|null>(null);
 const [undoCount,setUndoCount]=useState(0);
 const playersRef=useRef(players);playersRef.current=players;
 const core=useRef<EditorCore|null>(null);
 core.current??=new EditorCore(board,d=>{validatePlans([d.plan]);if(playersRef.current)validateTrainingSetup(d.setup,playersRef.current);});
 const key=club??'guest';
 const sync=useCallback(()=>{const c=core.current!;setBoard(c.board);setUndoCount(c.undo.length);},[]);

 // Restore once the club's squad is known (a draft never brings players of its own).
 const restored=useRef<string|null>(null);
 useEffect(()=>{if(!players||restored.current===key)return;restored.current=key;const r=restore(key,players);setBroken(r.broken);core.current!.reset(r.board??blankBoard());sync();},[key,players,sync]);
 const persist=useCallback((b:Board)=>{try{localStorage.setItem(draftKey(key),JSON.stringify(b));}catch{/* private mode: the board stays on the page */}},[key]);

 const say=useCallback((text:string,error=false)=>setMessage({text,error}),[]);
 const edit=useCallback((fn:(d:Board)=>void,msg?:string,merge?:string)=>{
  const r=core.current!.edit(fn,merge);
  if(!r.ok){say(friendly(r.error,'That change doesn’t fit this idea.'),true);return false;}
  sync();persist(core.current!.board);if(msg)say(msg);return true;
 },[persist,say,sync]);
 const seal=useCallback(()=>core.current!.seal(),[]);
 const current=useCallback(()=>core.current!.board,[]);
 const move=useCallback((patch:Partial<Pick<Board,'moment'|'actor'>>&Partial<View>)=>{
  const {moment,actor,...rest}=patch;
  if(moment!==undefined||actor!==undefined){const next={...core.current!.board,...(moment!==undefined?{moment}:{}),...(actor!==undefined?{actor}:{})};core.current!.set(next);sync();persist(next);}
  if(Object.keys(rest).length)setViewState(v=>({...v,...rest}));
 },[persist,sync]);
 const setView=useCallback((patch:Partial<View>)=>setViewState(v=>({...v,...patch})),[]);
 const undo=useCallback(()=>{const b=core.current!.back();if(!b)return;sync();persist(b);setViewState(v=>({...v,space:null,picking:null}));say('Last edit undone.');},[persist,say,sync]);
 const load=useCallback((b:Board,msg?:string)=>{core.current!.load(b);sync();persist(b);setViewState({space:null,picking:null,setupMode:false});if(msg)say(msg);},[persist,say,sync]);
 const dropBroken=useCallback(()=>{try{localStorage.removeItem(brokenKey(key));}catch{/* nothing stored */}setBroken(null);},[key]);
 const restoreBroken=useCallback(()=>{const b=broken?.partial;if(!b)return;load(b,'Your last board is back, from the default starting setup.');dropBroken();},[broken,load,dropBroken]);
 return {board,view,undoCount,message,edit,seal,current,move,setView,undo,say,load,broken,restoreBroken,discardBroken:dropBroken};
}
