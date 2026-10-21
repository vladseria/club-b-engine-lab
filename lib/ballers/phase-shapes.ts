// Phase pictures (TECH-SPEC §6.1; BUILD-PLAN WP4): where a side's five stand
// on average in each phase, from replay frames, labelled by the one phase
// function (lib/ballers/phase.ts). Pure: no I/O. The browser computes them from
// the public replay chunks and caches them per match (the stored-at-submit
// variant is not built).
//
// - By formation SLOT (position 0-4: 0 = keeper), following the `l` lineup map
//   after substitutions; each slot also tallies who stood there, so the
//   picture can name the man who played most of that phase in that slot.
// - Always in the side's own attacking direction (+x, engine metres), so a
//   match played as the away side reads the same way as a home one.
// - Weighted by seconds; merging matches is exact (pooled mean and spread).
// - Copy rule (RISKS T3): pictures are averages of short spells: "on average
//   while…", never that a phase "lasts".
import {PHASES,PITCH_LENGTH,phaseLabels,type Phase} from './phase';
import type {ReplayEvent,ReplayFrame,ReplayHeader} from './replay';

/** Bump when the shape of what is cached (or how it is computed) changes. */
export const PHASE_SHAPES_VERSION=1;
/** Draw a phase only with at least this much of it across the matches (TECH-SPEC §6.1). */
export const MIN_PHASE_SECONDS=60;

export interface SlotShape {
 /** Average spot, metres, in the side's attacking direction (x 0-48 towards their goal, y centred on 0). */ x:number;y:number;
 /** How far he roams around it: root-mean-square distance from the spot, metres. */ spread:number;
 /** Seconds each player (stored player id) stood in this slot during the phase. */ who:Record<string,number>;
}
export interface PhaseShape {seconds:number;slots:SlotShape[];ball:{x:number;y:number}}
export type PhaseShapes=Record<Phase,PhaseShape|null>;

const emptyShapes=():PhaseShapes=>({build:null,attack:null,loss:null,defend:null,set:null});

interface Acc {w:number;sx:number;sy:number;sxx:number;syy:number}
const acc=():Acc=>({w:0,sx:0,sy:0,sxx:0,syy:0});
const add=(a:Acc,x:number,y:number,w:number)=>{a.w+=w;a.sx+=x*w;a.sy+=y*w;a.sxx+=x*x*w;a.syy+=y*y*w;};

/** One match, one side. `frames` in time order (lib/ballers/replay.ts timeline). */
export function phaseShapes(tl:{header:ReplayHeader;frames:readonly ReplayFrame[];events:readonly ReplayEvent[]},side:0|1,pitchLength=PITCH_LENGTH):PhaseShapes{
 const {header,frames,events}=tl;
 const labels=phaseLabels(frames,events,side,pitchLength);
 const ids=header.players.map(p=>p.id);
 const mx=(x:number)=>x,my=(y:number)=>y;
 const per=Object.fromEntries(PHASES.map(p=>[p,{seconds:0,slots:[0,1,2,3,4].map(()=>acc()),who:[0,1,2,3,4].map(()=>({} as Record<string,number>)),ball:acc()}])) as Record<Phase,{seconds:number;slots:Acc[];who:Record<string,number>[];ball:Acc}>;
 for(let i=0;i+1<frames.length;i++){
  const f=frames[i],dt=(frames[i+1].t-f.t)/1000;if(!(dt>0))continue;
  const bucket=per[labels[i]];bucket.seconds+=dt;
  for(let k=0;k<5;k++){
   const pos=side*5+k,p=f.p[pos];if(!p)continue;
   add(bucket.slots[k],mx(p[0]/100),my(p[1]/100),dt);
   const id=ids[f.l?.[pos]??pos];if(id)bucket.who[k][id]=(bucket.who[k][id]??0)+dt;
  }
  add(bucket.ball,mx(f.b[0]/100),my(f.b[1]/100),dt);
 }
 const out=emptyShapes();
 for(const ph of PHASES){
  const b=per[ph];if(b.seconds<=0)continue;
  const mean=(a:Acc)=>({x:a.sx/a.w,y:a.sy/a.w});
  out[ph]={seconds:round1(b.seconds),
   slots:b.slots.map((a,k)=>{const m=mean(a),v=Math.max(0,a.sxx/a.w-m.x*m.x)+Math.max(0,a.syy/a.w-m.y*m.y);
    return {x:round2(m.x),y:round2(m.y),spread:round2(Math.sqrt(v)),who:roundWho(b.who[k])};}),
   ball:(()=>{const m=mean(b.ball);return {x:round2(m.x),y:round2(m.y)};})()};
 }
 return out;
}
const round1=(v:number)=>Math.round(v*10)/10,round2=(v:number)=>Math.round(v*100)/100;
const roundWho=(w:Record<string,number>)=>Object.fromEntries(Object.entries(w).map(([k,v])=>[k,round1(v)]));

/** Several matches pooled, weighted by seconds (exact pooled mean and spread). */
export function mergeShapes(list:readonly PhaseShapes[]):PhaseShapes{
 const out=emptyShapes();
 for(const ph of PHASES){
  const parts=list.map(s=>s[ph]).filter((s):s is PhaseShape=>!!s&&s.seconds>0);
  if(!parts.length)continue;
  const W=parts.reduce((n,s)=>n+s.seconds,0);
  const slots=[0,1,2,3,4].map(k=>{
   const x=parts.reduce((n,s)=>n+s.slots[k].x*s.seconds,0)/W,y=parts.reduce((n,s)=>n+s.slots[k].y*s.seconds,0)/W;
   // pooled variance: within-match variance plus the spread of the match means
   const v=parts.reduce((n,s)=>{const q=s.slots[k];return n+s.seconds*(q.spread*q.spread+(q.x-x)**2+(q.y-y)**2);},0)/W;
   const who:Record<string,number>={};for(const s of parts)for(const [id,t] of Object.entries(s.slots[k].who))who[id]=round1((who[id]??0)+t);
   return {x:round2(x),y:round2(y),spread:round2(Math.sqrt(v)),who};
  });
  out[ph]={seconds:round1(W),slots,ball:{x:round2(parts.reduce((n,s)=>n+s.ball.x*s.seconds,0)/W),y:round2(parts.reduce((n,s)=>n+s.ball.y*s.seconds,0)/W)}};
 }
 return out;
}

/** Enough of this phase to draw it. */
export const drawable=(s:PhaseShape|null|undefined):s is PhaseShape=>!!s&&s.seconds>=MIN_PHASE_SECONDS;
/** The player (id) who stood longest in a slot during the phase. */
export const mainPlayer=(slot:SlotShape)=>Object.entries(slot.who).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null;

// ------------------------------------------------------------------ which matches a plan's picture uses
/** What a club played in one match, as far as the picture cares: the
 * formation and every setting (a missing "On losing it" reads 'balanced',
 * as lib/ballers/approach.ts does). */
export interface PlayedSetup {formation:string;settings:Record<string,unknown>}
const SETTING_KEYS=['progression','width','line','press','commit','striker','transition','onLoss'] as const;
export const settingsKey=(s:PlayedSetup)=>`${s.formation}|${SETTING_KEYS.map(k=>String(s.settings[k]??(k==='onLoss'?'balanced':''))).join('|')}`;
/** Same formation and the same settings (TECH-SPEC §6.1 M12: a plan's picture
 * is grouped by what was played, never by plan id). */
export const samePlayed=(a:PlayedSetup,b:PlayedSetup)=>settingsKey(a)===settingsKey(b);

/** The matches a plan's picture may use: the club's finished league matches
 * whose prep for that round played the plan's formation and settings, newest
 * first, at most `max`. `played(round)` is the prep's plan_snapshot (or, before
 * plans, its formation + approach); a round with no prep is left out (we can't
 * say what was played). */
export function matchesForSetup<M extends {match_id:string;round_id:string|null;home_club:string;away_club:string;visible_from:string}>(
 results:readonly M[],clubId:string,want:PlayedSetup,played:(roundId:string)=>PlayedSetup|null,max=5,now=Date.now()):(M&{side:0|1})[]{
 return results
  .filter(r=>(r.home_club===clubId||r.away_club===clubId)&&r.round_id&&Date.parse(r.visible_from)<=now)
  .filter(r=>{const p=played(r.round_id!);return !!p&&samePlayed(p,want);})
  .sort((a,b)=>Date.parse(b.visible_from)-Date.parse(a.visible_from))
  .slice(0,max)
  .map(r=>({...r,side:(r.home_club===clubId?0:1) as 0|1}));
}
