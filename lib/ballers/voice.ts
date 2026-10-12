// Club voice: a human club's own flavour lines for the live commentary
// (2026-09-29). The AI clubs' FLAVOUR table (commentary/ro.ts) gives them a
// personality; this lets a manager write the same kind of sentence for their
// own club. Pure, no I/O.
//
// Stored on ballers_clubs.voice (owner-only; SQL private.ballers_check_voice
// mirrors checkVoice below), frozen into the match input at the lock
// (FrozenSide.voice, only when not empty) and carried into the replay header
// (ReplayTeam.voice), which is what the commentary reads at view time. So a
// match says what the club's voice was when its players got their
// instructions; editing the lines later never rewrites a past match.
//
// A club without a voice produces exactly today's commentary.

/** When a line may be said: the club scores, concedes, its keeper saves, it fouls (the FLAVOUR hooks). */
export type VoiceMoment='goal'|'concede'|'save'|'foul';
export type Voice=Partial<Record<VoiceMoment,string[]>>;

export const VOICE_MOMENTS:readonly VoiceMoment[]=['goal','concede','save','foul'];
export const VOICE_MAX_LINES=3;
export const VOICE_MAX_CHARS=90;

/** The slots each moment can fill. `{club}` is always the voice's own club,
 * `{opp}` the other one. `{player}`: goal = your scorer, concede = who scored
 * against you (neither on an own goal), save = your keeper, foul = your
 * player who fouled; `{other}`: the shooter denied / the player fouled. */
export const VOICE_SLOTS:Record<VoiceMoment,readonly string[]>={
 goal:['player','club','opp','score','min'],
 concede:['player','club','opp','score','min'],
 save:['player','other','club','opp','score','min'],
 foul:['player','other','club','opp','score','min'],
};

/** Control and invisible direction characters: each becomes a space. */
const CONTROL=/[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;
/** Anything written in braces must be one of the moment's slots. */
const BRACES=/\{[^{}]*\}/g;

/** One line as stored: control characters out, runs of spaces folded, ends trimmed (spaces only, as SQL btrim). */
export function cleanVoiceLine(s:string){return s.replace(CONTROL,' ').replace(/ {2,}/g,' ').replace(/^ +| +$/g,'');}
/** Length in characters (code points), as Postgres char_length counts. */
export const voiceLength=(s:string)=>[...s].length;

export type VoiceLineProblem={kind:'long'}|{kind:'slot';slot:string};
/** Why one (cleaned) line can't be saved for this moment, or null. */
export function voiceLineProblem(moment:VoiceMoment,line:string):VoiceLineProblem|null{
 if(voiceLength(line)>VOICE_MAX_CHARS)return {kind:'long'};
 for(const m of line.match(BRACES)??[]){const slot=m.slice(1,-1);if(!VOICE_SLOTS[moment].includes(slot))return {kind:'slot',slot:m};}
 return null;
}

const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);

/** The strict check a save goes through (mirror of SQL private.ballers_check_voice):
 * an object of known moments, each an array of at most three strings; every
 * line cleaned, blank ones dropped, each at most 90 characters with only its
 * moment's slots. Returns the stored shape (a moment with no lines is left
 * out), or throws Error('invalid_voice'). */
export function checkVoice(value:unknown):Voice{
 if(value===null||value===undefined)return {};
 if(!isObject(value))throw Error('invalid_voice');
 const out:Voice={};
 for(const [key,list] of Object.entries(value)){
  if(!(VOICE_MOMENTS as readonly string[]).includes(key)||!Array.isArray(list)||list.length>VOICE_MAX_LINES)throw Error('invalid_voice');
  const moment=key as VoiceMoment,lines:string[]=[];
  for(const raw of list){
   if(typeof raw!=='string')throw Error('invalid_voice');
   const line=cleanVoiceLine(raw);if(!line)continue;
   if(voiceLineProblem(moment,line))throw Error('invalid_voice');
   lines.push(line);
  }
  if(lines.length)out[moment]=lines;
 }
 return out;
}

/** The lenient read (the frozen input, the replay header): whatever is valid
 * is kept, anything else dropped; null when nothing is left. */
export function normalizeVoice(value:unknown):Voice|null{
 if(!isObject(value))return null;
 const out:Voice={};
 for(const moment of VOICE_MOMENTS){
  const list=value[moment];if(!Array.isArray(list))continue;
  const lines=list.filter((x):x is string=>typeof x==='string').map(cleanVoiceLine).filter(l=>l&&!voiceLineProblem(moment,l)).slice(0,VOICE_MAX_LINES);
  if(lines.length)out[moment]=lines;
 }
 return Object.keys(out).length?out:null;
}

/** How many lines a voice holds. */
export const voiceCount=(v:Voice|null|undefined)=>VOICE_MOMENTS.reduce((n,m)=>n+(v?.[m]?.length??0),0);
