// Ballers reads and writes. Reads are plain table selects (RLS: the league is
// public, prep/ideas are the owner's); every write is one of the
// SECURITY DEFINER doors from the ballers_p1_* migrations. Nothing here
// talks to the old Cloudflare league worker.
import {supabase} from '../supabase';
import {boardApproach,boardFormation,boardSide,withOnLoss,type Approach,type StoredApproach} from './approach';
import type {Role} from '../../packages/football-engine/src/model';
import type {Archetype,Archive,Club,Competition,Formation,Idea,Match,MyClub,Player,Prep,Result,Round,Style,Temperament} from './league';
import {clock} from './league';
import type {ReplayChunk,ReplayHeader} from './replay';
import type {IdeaName,Marker} from './ideas';
import type {PrepOrder,StoredNote} from './subs';
import type {MatchSettings} from './match-settings';
import type {FrozenSwitch} from './switch-input';
import type {Voice} from './voice';
import {loadPlans,type Plan,type PlanPrep} from './plans';
import {withRules,type GrowthAfter,type GrowthRow,type GrowthRules} from './growth';
import {BROADCAST_MAX_SECONDS} from './league';
import type {GrowthTick} from './memory';

const CLUB_COLUMNS='id,space,name,code,color,crest,motto,anthem,chant,ai,manager,captain,created_at';

export interface LeagueData {clubs:Club[];players:Player[];rounds:Round[];matches:Match[];results:Result[];competitions:Competition[];archive:Archive[]}
/** `plans`: the club's plans.
 * `prep` rows carry plan_id / plan_snapshot (null for a prep not linked to a plan). */
export interface MineData {club:MyClub|null;prep:PlanPrep[];ideas:Idea[];plans:Plan[]}

function must<T>(r:{data:T|null;error:{message:string}|null}):T{if(r.error)throw Error(r.error.message);return r.data as T;}
/** Rows written before "On losing it" existed read it as 'balanced'
 * (lib/ballers/approach.ts): past this file every approach is complete. */
function withApproach<T extends {approach:StoredApproach}>(row:T):T{return {...row,approach:withOnLoss(row.approach)};}
/** The club defaults are a current setup: a retired formation or option reads as what now plays
 * (approach.ts boardFormation/boardApproach). Preps stay as stored: they are what a round played. */
const myClub=(c:MyClub|null)=>c&&{...c,formation:boardFormation(c.formation),approach:boardApproach(withOnLoss(c.approach))};

/** Creates the round ahead if nobody has yet (signed-in callers only). */
/** The space's switched-on features, one read shared by every caller of one page load (the shell and
 * the grounds switch), kept a minute. Null when it couldn't be read: callers keep what they knew. */
const spaceReads=new Map<string,Promise<string[]|null>>();
export function spaceFeaturesShared(space:string):Promise<string[]|null>{
 const have=spaceReads.get(space);if(have)return have;
 const p=(async()=>{try{const r=await supabase().rpc('ballers_space_features',{p_space:space});return r.error||!Array.isArray(r.data)?null:r.data as string[];}catch{return null;}})();
 spaceReads.set(space,p);
 void p.then(()=>setTimeout(()=>{if(spaceReads.get(space)===p)spaceReads.delete(space);},60_000));
 return p;
}
export async function ensureRound(space:string){return must(await supabase().rpc('ballers_ensure_round',{p_space:space})) as string;}

export async function loadLeague(space:string):Promise<LeagueData>{
 const db=supabase();
 const [clubs,players,rounds,matches,results,competitions,archive]=await Promise.all([
  db.from('ballers_clubs').select(CLUB_COLUMNS).eq('space',space).order('name'),
  db.from('ballers_players').select('*').eq('space',space).order('number'),
  db.from('ballers_rounds').select('*').eq('space',space).order('number'),
  db.from('ballers_matches').select('id,space,competition_id,round_id,kind,home_club,away_club,kickoff_at,status,live_from,postponed_to').eq('space',space).order('kickoff_at'),
  // Row security returns only results past full time: the table can never spoil a match.
  db.from('ballers_results').select('match_id,competition_id,round_id,home_club,away_club,home_goals,away_goals,stats,duration,engine_build,live_from,visible_from,player_stats').eq('space',space),
  db.from('ballers_competitions').select('id,space,season,name,status,ends_at,paused_at').eq('space',space).eq('kind','league').order('season'),
  db.from('ballers_season_archive').select('competition_id,season,name,champion_club,standings,finished_at').eq('space',space).order('season'),
 ]);
 return {clubs:must(clubs) as Club[],players:must(players) as Player[],rounds:must(rounds) as Round[],matches:must(matches) as Match[],
  results:must(results) as Result[],competitions:must(competitions) as Competition[],archive:must(archive) as Archive[]};
}

// ---------- watching a match ----------
/** PostgREST returns bytea as "\x<hex>". */
function hexBytes(hex:string){const h=hex.startsWith('\\x')?hex.slice(2):hex,out=new Uint8Array(h.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(h.substr(i*2,2),16);return out;}
async function gunzipJson<T>(bytes:Uint8Array):Promise<T>{
 const stream=new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
 return JSON.parse(await new Response(stream).text()) as T;
}
/** Every chunk the clock has released so far (after full time: all of them). */
export async function loadReplay(matchId:string):Promise<{header:ReplayHeader;chunks:ReplayChunk[]}|null>{
 const rows=must(await supabase().from('ballers_replay_chunks').select('idx,data').eq('match_id',matchId).order('idx')) as {idx:number;data:string}[];
 const head=rows.find(r=>r.idx===-1);if(!head)return null;
 const [header,...chunks]=await Promise.all([gunzipJson<ReplayHeader>(hexBytes(head.data)),...rows.filter(r=>r.idx>=0).map(r=>gunzipJson<ReplayChunk>(hexBytes(r.data)))]);
 return {header,chunks};
}
/** Only the replay headers (one small row a match: formations, slots, length) of finished matches,
 * by match id: what a season of marks needs (lib/ballers/ratings-read.ts). Missing ones are left out. */
export async function loadReplayHeaders(matchIds:readonly string[]):Promise<Map<string,ReplayHeader>>{
 const out=new Map<string,ReplayHeader>();
 for(let i=0;i<matchIds.length;i+=40){
  const rows=must(await supabase().from('ballers_replay_chunks').select('match_id,data').in('match_id',matchIds.slice(i,i+40)).eq('idx',-1)) as {match_id:string;data:string}[];
  await Promise.all(rows.map(async r=>{out.set(r.match_id,await gunzipJson<ReplayHeader>(hexBytes(r.data)));}));
 }
 return out;
}
/** Some of one replay's chunks (by index), for their events. */
export async function loadReplayChunks(matchId:string,idx:readonly number[]):Promise<ReplayChunk[]>{
 const rows=must(await supabase().from('ballers_replay_chunks').select('idx,data').eq('match_id',matchId).in('idx',[...idx]).order('idx')) as {idx:number;data:string}[];
 return Promise.all(rows.filter(r=>r.idx>=0).map(r=>gunzipJson<ReplayChunk>(hexBytes(r.data))));
}
/** The live read (ballers_live): the database clock, the match's slot, and
 * every released chunk not in `have`. `sample` feeds ServerClock. */
export interface LiveSlot {id:string;status:string;kickoff_at:string;live_from:string|null;postponed_to:string|null}
export interface LiveRead {sample:{sent:number;received:number;server:number};match:LiveSlot|null;header:ReplayHeader|null;chunks:ReplayChunk[]}
function b64Bytes(b64:string){const s=atob(b64),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
export async function loadLive(matchId:string,have:number[]):Promise<LiveRead>{
 const sent=Date.now();
 const r=await supabase().rpc('ballers_live',{p_match:matchId,p_have:have});
 const received=Date.now();
 const v=must(r) as {now:string;match:LiveSlot|null;chunks:{idx:number;data:string}[]};
 const head=v.chunks.find(c=>c.idx===-1);
 const [header,...chunks]=await Promise.all([head?gunzipJson<ReplayHeader>(b64Bytes(head.data)):Promise.resolve(null),
  ...v.chunks.filter(c=>c.idx>=0).map(c=>gunzipJson<ReplayChunk>(b64Bytes(c.data)))]);
 return {sample:{sent,received,server:Date.parse(v.now)},match:v.match,header,chunks:chunks as ReplayChunk[]};
}
export type IdeaMarker=Marker;
/** Unnamed markers for everyone; names (and the owner-only detail: pitch
 * links, why an attempt ended) only for the manager whose idea it was. */
export async function loadMatchIdeas(matchId:string,signedIn:boolean):Promise<{markers:IdeaMarker[];names:IdeaName[]}>{
 const db=supabase();
 const [markers,names]=await Promise.all([
  db.from('ballers_match_ideas').select('seq,side,t,ended_at,status,end_reason,progress,free,run').eq('match_id',matchId).order('seq'),
  signedIn?db.from('ballers_match_idea_names').select('seq,name,plan_key,detail').eq('match_id',matchId):Promise.resolve({data:[],error:null}),
 ]);
 return {markers:must(markers) as IdeaMarker[],names:must(names) as IdeaName[]};
}
/** The owner's substitution notes (row security: own club, after full time). */
export async function loadSubNotes(matchId:string):Promise<{side:0|1;notes:StoredNote[]}[]>{
 return must(await supabase().from('ballers_match_sub_notes').select('side,notes').eq('match_id',matchId)) as {side:0|1;notes:StoredNote[]}[];
}

const PREP_COLUMNS='club_id,round_id,lineup,bench,captain,formation,style,approach,ideas,accents,plans,origin,substitution_orders,idea_lineups,updated_at';
/** Game plan (migration ballers_game_plan_foundation): the prep's plan link and what it played. */
const PLAN_PREP_COLUMNS='plan_id,plan_snapshot';
/** The club's preps. `match_settings` arrives with migration
 * 20260928193034_ballers_match_settings; until that column exists the read
 * falls back to the old columns (every match on default settings), so a
 * client deployed first never breaks Match prep. */
async function loadPrep(club:string):Promise<PlanPrep[]>{
 const db=supabase(),r=await db.from('ballers_prep').select(`${PREP_COLUMNS},match_settings,${PLAN_PREP_COLUMNS}`).eq('club_id',club);
 if(r.error&&/match_settings/.test(r.error.message))return (must(await db.from('ballers_prep').select(PREP_COLUMNS).eq('club_id',club)) as Prep[]).map(withApproach);
 return (must(r) as Prep[]).map(withApproach);
}

export async function loadMine(space:string):Promise<MineData>{
 const db=supabase(),club=myClub(must(await db.rpc('ballers_my_club',{p_space:space})) as MyClub|null);
 if(!club)return {club:null,prep:[],ideas:[],plans:[]};
 const [prep,ideas,plans]=await Promise.all([
  loadPrep(club.id),
  db.from('ballers_ideas').select('id,club_id,plan_key,name,plan,lineup,updated_at').eq('club_id',club.id).order('updated_at',{ascending:false}),
  loadPlans(club.id),
 ]);
 return {club,prep,ideas:must(ideas) as Idea[],plans};
}

// ---------- founding a club (identity -> captain -> plan -> squad -> review) ----------
/** The captain as the manager describes him: never ratings, only a position, a
 * profile and up to three tendency points (server config captain.tendencies). */
export interface CaptainChoice {position:Role;archetype:Archetype;tendencies:Record<string,number>;name:string;face:string}
/** A drawn player as the preview shows it (no row exists yet). */
export interface DraftPlayer {slot:number;name:string;short:string;number:number;face:string;roles:Role[];archetype:Archetype;temperament:Temperament;note:string;skills:Player['skills'];traits:Player['traits'];captain:boolean;swapped?:boolean}
export interface CreationPreview {faces:string[];players?:DraftPlayer[];offers?:Record<string,DraftPlayer[]>;captainSlot?:number}
/** The member's six cosmic faces, and once the captain is described, the nine and every slot's offers. */
export async function creationPreview(space:string,captain:CaptainChoice|null){
 return must(await supabase().rpc('ballers_creation_preview',{p_space:space,p_captain:captain})) as CreationPreview;
}
/** Confirm: the server re-draws everything from the member's seed; idempotent.
 * `faces` are the nine faces the member saw, in slot order: if one was claimed
 * by another club meanwhile the door refuses (faces_changed) instead of
 * quietly handing over different players. */
export async function createClub(space:string,identity:{name:string;code:string;color:string;crest:string;motto:string;anthem:string;chant:string},captain:CaptainChoice,plan:{formation:Formation;style:Style},swaps:Record<string,number>,faces:string[]){
 return myClub(must(await supabase().rpc('ballers_create_club',{p_space:space,p_identity:identity,p_captain:captain,p_plan:plan,p_swaps:swaps,p_faces:faces})) as MyClub)!;
}

// ---------- stage 0: orders (migration ballers_orders; lib/ballers/orders.ts) ----------
/** Orders are on: for your club, exactly what ballers_my_club says (the server already lets a club row
 * win over the space row); with no club (signed out, not founded), the space's own switch. */
export const ordersOn=(club:MyClub|null|undefined,space:readonly string[]|undefined)=>club?!!club.features?.includes('orders'):!!space?.includes('orders');
type SkillKey=keyof Player['skills'];
/** What the manager describes: every skill, bought with points (migration 20261007150000); the name and face only matter when he signs. */
export interface OrderChoice {role:Role;skills:Record<SkillKey,number>;temperament:Temperament;gem:boolean;name?:string;face?:string;
 /** Stage 1: his age (18-34), sent only while growth is on; the budget follows it. */ age?:number}
/** The player an order builds, exactly as he would be signed (no row exists yet). */
export interface OrderPlayer {slot:number;name:string|null;short:string;number:number;face:string;roles:Role[];archetype:Archetype;temperament:Temperament;note:string;skills:Player['skills'];traits:Player['traits'];gem:boolean}
/** The six faces and a suggested name; with an order, the player too. `room`: budget left
 * for one more strength. `nameTaken`: that surname is already in the clubhouse. */
export interface OrderPreview {faces:string[];name:string|null;nameTaken?:boolean;spent?:number;player?:OrderPlayer}
export const orderBody=(o:OrderChoice)=>({role:o.role,skills:o.skills,temperament:o.temperament,gem:o.gem,
 ...(typeof o.age==='number'?{age:o.age}:{}),
 ...(o.name!==undefined&&o.name.trim()?{name:o.name}:{}),...(o.face?{face:o.face}:{})});
export async function orderPreview(space:string,slot:number,order:OrderChoice|null){
 return must(await supabase().rpc('ballers_order_preview',{p_space:space,p_slot:slot,p_order:order?orderBody(order):null})) as OrderPreview;
}
/** Sign him: the server builds him again from the description and saves him. Idempotent per slot. */
export async function placeOrder(space:string,slot:number,order:OrderChoice&{name:string;face:string}){
 return must(await supabase().rpc('ballers_place_order',{p_space:space,p_slot:slot,p_order:orderBody(order)})) as Player;
}
// ---------- stage 1: growth and age (migration ballers_growth; lib/ballers/growth.ts) ----------
/** Growth is on: for your club, what ballers_my_club says (club row wins); with no club, the space's switch. */
export const growthOn=(club:MyClub|null|undefined,space:readonly string[]|undefined)=>club?!!club.features?.includes('growth'):!!space?.includes('growth');
// ---------- match ratings (lib/ballers/ratings.ts; deliverables/ballers-players/RATINGS-FORMULAS.md) ----------
/** Marks are on: the space's `ratings` row. For your club, what ballers_my_club says (it already
 * folds the space row in, and a club row would win); with no club, the space's switch.
 * Off, every screen is today's exactly. */
export const ratingsOn=(club:MyClub|null|undefined,space:readonly string[]|undefined)=>club?!!club.features?.includes('ratings'):!!space?.includes('ratings');
/** Development only: `?ratings=1` turns the marks on for this tab on localhost (`?ratings=0` off).
 * The production build drops it (NODE_ENV is replaced at build time). */
export function readRatingsSwitch():boolean{
 if(process.env.NODE_ENV==='production')return false;
 try{if(!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname))return false;
  const q=new URLSearchParams(window.location.search).get('ratings');
  if(q==='1')sessionStorage.setItem('ballers:ratings','1');else if(q==='0')sessionStorage.removeItem('ballers:ratings');
  return sessionStorage.getItem('ballers:ratings')==='1';}catch{return false;}
}
// ---------- Tribuna, the round's paper (lib/ballers/tribuna.ts; deliverables/ballers-tribuna/DESIGN.md) ----------
/** The round's newspaper is on: the space's `tribuna` row (your club's list when you have one, which folds the
 * space row in and lets a club row win). Off, every screen is today's exactly. */
export const tribunaOn=(club:MyClub|null|undefined,space:readonly string[]|undefined)=>club?!!club.features?.includes('tribuna'):!!space?.includes('tribuna');
/** Development only: `?tribuna=1` turns the paper on for this tab on localhost (`?tribuna=0` off). */
export function readTribunaSwitch():boolean{
 if(process.env.NODE_ENV==='production')return false;
 try{if(!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname))return false;
  const q=new URLSearchParams(window.location.search).get('tribuna');
  if(q==='1')sessionStorage.setItem('ballers:tribuna','1');else if(q==='0')sessionStorage.removeItem('ballers:tribuna');
  return sessionStorage.getItem('ballers:tribuna')==='1';}catch{return false;}
}
// ---------- practice counts (migration 20261023210000_ballers_practice_counts; the Tribuna's "Antrenamentul etapei") ----------
/** One finished practice batch: how many kick-offs ran against `opponent`. Fire-and-forget: it never throws, never
 * waits on anything the practice screen needs, and a refusal (or the door not applied yet) is silent. */
export function logPractice(space:string,opponent:string,games:number):void{
 try{void Promise.resolve(supabase().rpc('ballers_practice_log',{p_space:space,p_opponent:opponent,p_games:games})).catch(()=>{});}catch{/* no client: nothing kept */}
}
/** A published round's practice: each league match's [home, away] practice kick-offs against the opponent faced
 * (ballers_practice_round answers only once the round is out). Null when it can't be read (the door not applied
 * yet, offline): the paper then prints no practice line. */
export async function loadPracticeRound(round:string):Promise<Map<string,[number,number]>|null>{
 try{const r=await supabase().rpc('ballers_practice_round',{p_round:round});
  if(r.error||!Array.isArray(r.data))return null;
  return new Map((r.data as {match_id:string;home:number;away:number}[]).map(x=>[x.match_id,[x.home,x.away]]));}catch{return null;}
}
/** Development only: `?practice=1` makes the paper read made-up practice counts on localhost, so the line can be
 * seen before the migration is applied and a round is played (`?practice=0` off). Never stored, never sent. */
export function readPracticeDemo():boolean{
 if(process.env.NODE_ENV==='production')return false;
 try{if(!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname))return false;
  const q=new URLSearchParams(window.location.search).get('practice');
  if(q==='1')sessionStorage.setItem('ballers:practice-demo','1');else if(q==='0')sessionStorage.removeItem('ballers:practice-demo');
  return sessionStorage.getItem('ballers:practice-demo')==='1';}catch{return false;}
}
/** The rules the screens need (phases, head skills, fade, order ages and budgets, the two step curves). Null when unreadable. */
export async function loadGrowthRules(space:string):Promise<GrowthRules|null>{
 try{const r=await supabase().rpc('ballers_growth_rules',{p_space:space});return r.error||!r.data?null:withRules(r.data);}catch{return null;}
}
/** Your own players' focus, progress and hint ([] when growth is off for your club). Null when unreadable. */
export async function loadGrowthMine(space:string):Promise<GrowthRow[]|null>{
 try{const r=await supabase().rpc('ballers_growth_mine',{p_space:space});return r.error||!Array.isArray(r.data)?null:r.data as GrowthRow[];}catch{return null;}
}
/** What grew after a club's last round (public; null before the first growth round). */
export async function loadGrowthAfter(space:string,club:string){
 return must(await supabase().rpc('ballers_growth_after',{p_space:space,p_club:club})) as GrowthAfter|null;
}
/** How one player grew, round by round: every skill that ticked (ballers_growth_story, migration 20261022160000). Null when it can't be read (the door not applied
 * yet, offline): the Memory tab then shows no growth moments rather than guessing them. */
export async function loadGrowthStory(player:string):Promise<GrowthTick[]|null>{
 try{const r=await supabase().rpc('ballers_growth_story',{p_player:player});return r.error||!Array.isArray(r.data)?null:r.data as GrowthTick[];}catch{return null;}
}
/** Moves one of your players' focus (null clears it); the progress on the old focus starts again. */
export async function setGrowthFocus(player:string,skill:SkillKey|null){
 return must(await supabase().rpc('ballers_set_focus',{p_player:player,p_skill:skill})) as GrowthRow;
}

/** Every player's skills as frozen at a match's lock (ballers_match_paper), by player id, from full time on.
 * Null when it can't be read (the door not there yet, offline): callers fall back to today's skills. */
export async function loadMatchPaper(matchId:string):Promise<Record<string,Player['skills']>|null>{
 try{const r=await supabase().rpc('ballers_match_paper',{p_match:matchId});return r.error||!r.data||typeof r.data!=='object'?null:r.data as Record<string,Player['skills']>;}catch{return null;}
}

/** Renames one of the club's newcomers (the original nine keep their names). */
export async function renamePlayer(player:string,name:string){return must(await supabase().rpc('ballers_rename_player',{p_player:player,p_name:name})) as Player;}

/** Uploads a 512x512 PNG crest into the member's own folder of the public
 * `ballers-crests` bucket and returns the value the club's crest field takes. */
export async function uploadCrest(png:Blob){
 const db=supabase(),{data}=await db.auth.getUser();
 if(!data.user)throw Error('profile_required');
 const name=`${data.user.id}/crest-${Date.now().toString(36)}.png`;
 const r=await db.storage.from('ballers-crests').upload(name,png,{contentType:'image/png',upsert:false});
 if(r.error){console.warn('ballers crest upload',r.error);throw Error('crest_upload');}
 return `ballers-crests/${name}`;
}

/** The crest changes any time; the name and code only while identity_open
 * (the door refuses otherwise: identity_locked). */
export type ClubPatch=Partial<{name:string;code:string;crest:string;color:string;motto:string;anthem:string;chant:string;captain:string;formation:Formation;style:Style;approach:Approach;lineup:string[]}>;
export async function updateClub(space:string,patch:ClubPatch){return myClub(must(await supabase().rpc('ballers_update_club',{p_space:space,p_patch:patch})) as MyClub)!;}
/** The club's commentary lines (lib/ballers/voice.ts): the whole voice at once; `{}` clears it. */
export async function setVoice(space:string,voice:Voice){return myClub(must(await supabase().rpc('ballers_set_voice',{p_space:space,p_voice:voice})) as MyClub)!;}

export async function savePrep(round:string,v:{lineup:string[];captain:string;formation:Formation;style:Style;approach:Approach;ideas:string[];accents:Record<string,number>;/** Omitted = keep what's stored (the Lab saves a prep without touching them). */ subs?:PrepOrder[];ideaLineups?:Record<string,Record<string,string>>;
 /** Omitted = keep what's stored (sent only when the manager changed them). */ settings?:MatchSettings}){
 return withApproach(must(await supabase().rpc('ballers_save_prep',{p_round:round,p_lineup:v.lineup,p_captain:v.captain,p_formation:v.formation,p_style:v.style,p_approach:v.approach,p_ideas:v.ideas,p_accents:v.accents,
  p_substitutions:v.subs??null,p_idea_lineups:v.ideaLineups??null,...(v.settings?{p_match_settings:v.settings}:{})})) as Prep);
}

/** The Lab bridge: ideas to upsert, the plan keys the member deleted, plus
 * the next round's prep. An idea that is not posted is never deleted. */
export interface LabLibraryEntry {plan:{id:string;name?:string};lineup:string[];enabled:boolean}
/** An idea's id as the club stores it (the SQL check is the same). */
export const IDEA_ID=/^[A-Za-z0-9_:.-]{1,64}$/;
export async function labSave(space:string,library:LabLibraryEntry[],prep:{lineup:string[];formation:Formation;style:Style;approach:Approach;ideas:string[]}|null,deleteKeys:string[]=[]){
 if(library.some(e=>!IDEA_ID.test(e.plan.id)))throw new Error('idea_id');
 return must(await supabase().rpc('ballers_lab_save',{p_space:space,p_library:library,p_prep:prep,p_delete_keys:deleteKeys})) as {ideas:number;prep:'saved'|'locked'|'skipped';round:string|null};
}

// ---------- P6: practice sides and club styles ----------
/** Another club's general tactics for a practice match, from the PAST only:
 * any club, AI or member, as it lined up in its most recent revealed league
 * match. Never its ideas, never a round's prep. */
export interface PracticeSide {formation:Formation;style:Style;approach:Approach;lineup:string[];captain:string|null;
 /** 'last_match' = its most recent revealed league match (AI or member); 'ai' = an AI club with none yet: its fixed tactics; 'generic' = a member club with none yet. */ source?:'last_match'|'ai'|'generic';
 /** That match's substitution orders, change of plan and match settings, as frozen (migration
  * 20261024150000_ballers_practice_side_full; each only when it had one, never for 'ai' or 'generic'). */
 substitutions?:PrepOrder[];switch?:FrozenSwitch;settings?:MatchSettings}
/** Their side as practice and rehearsals play it: the stored side with a retired formation or option
 * read as what it plays now (approach.ts boardSide; 2-1-1 -> 1-2-1, 1/2 forward -> 3, Regroup -> Balanced),
 * the same mapping their next official match gets at freeze; their change of plan's target likewise. */
export async function practiceSide(space:string,club:string):Promise<PracticeSide>{
 const side=await practiceSideStored(space,club),sw=side.switch;
 return boardSide({...side,approach:withOnLoss(side.approach),
  ...(sw?{switch:{...sw,to:{...sw.to,approach:boardApproach(sw.to.approach),...(sw.to.formation?{formation:boardFormation(sw.to.formation)}:{})}}}:{})});
}
/** The same side exactly as stored: its approach may lack "On losing it"
 * (an input frozen before the field). Scouting reads this to tell an adjusted
 * approach from a preset without mistaking the missing field for a change. */
export type StoredPracticeSide=Omit<PracticeSide,'approach'>&{approach:StoredApproach};
export async function practiceSideStored(space:string,club:string){return must(await supabase().rpc('ballers_practice_side',{p_space:space,p_club:club})) as StoredPracticeSide;}
/** A saved named style (club-level, at most 12). */
export interface SavedStyle {id:string;name:string;settings:Approach;preset:Style;updated_at:string}
const savedStyle=(row:SavedStyle):SavedStyle=>({...row,settings:withOnLoss(row.settings)});
export async function loadStyles(clubId:string){return (must(await supabase().from('ballers_styles').select('id,name,settings,preset,updated_at').eq('club_id',clubId).order('name')) as SavedStyle[]).map(savedStyle);}

// ---------- the arcade cabinet's badge ----------
/** What the hall's Ballers cabinet says: LIVE while a match of the space is
 * on the air, "Kickoff 20:00" from a round's lock to its kickoff, "Locks in …"
 * in the last 24 h before the next round locks, nothing otherwise. A few tiny
 * reads; never a score. */
export async function cabinetTag(space:string,now=Date.now()):Promise<string|null>{
 const db=supabase(),BROADCAST_MS=BROADCAST_MAX_SECONDS*1000,DAY_MS=24*3600*1000;
 const [live,round,league,walkout]=await Promise.all([
  db.from('ballers_matches').select('id').eq('space',space).lte('live_from',new Date(now).toISOString()).gt('live_from',new Date(now-BROADCAST_MS).toISOString()).limit(1),
  db.from('ballers_rounds').select('locks_at').eq('space',space).eq('status','open').gt('locks_at',new Date(now).toISOString()).order('locks_at').limit(1),
  db.from('ballers_competitions').select('paused_at').eq('space',space).eq('kind','league').eq('status','open').limit(1),
  db.from('ballers_rounds').select('kickoff_at').eq('space',space).lte('locks_at',new Date(now).toISOString()).gt('kickoff_at',new Date(now).toISOString()).order('kickoff_at').limit(1),
 ]);
 if(live.data?.length)return 'LIVE';
 // A paused league promises no lock: say so instead of counting down.
 if((league.data?.[0] as {paused_at:string|null}|undefined)?.paused_at)return 'PAUSED';
 // Locked, not kicked off: the walk-out is on, so say when the match starts.
 const kickoff=(walkout.data?.[0] as {kickoff_at:string}|undefined)?.kickoff_at;
 if(kickoff)return `Kickoff ${clock(kickoff)}`;
 const locks=round.data?.[0]?Date.parse((round.data[0] as {locks_at:string}).locks_at):NaN;
 const left=locks-now;
 if(!(left>0&&left<=DAY_MS))return null;
 return left<3600000?`Locks in ${Math.max(1,Math.ceil(left/60000))}m`:`Locks in ${Math.floor(left/3600000)}h`;
}

