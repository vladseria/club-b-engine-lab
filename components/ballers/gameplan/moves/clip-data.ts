// The ready-made moves' clips (recorded by verificare/gp-wp2-clips.test.ts from
// real engine goes, the rehearsal's own runScenes path). One frame per 0.2 s:
// ten players' x, y (our five first, then theirs) and the ball's x, y, z, all
// in decimetres, then the ball owner's index (-1 = nobody).
import data from './clips.json';

export interface MoveClip {key:string;status:'to_plan'|'half'|'broke';shots:number;
 /** Seconds into the clip when the move started. */ start:number;step:number;frames:number[][]}
export interface MoveClips {engineBuild:string;clips:Record<string,MoveClip>}
export const CLIPS=data as unknown as MoveClips;
export const clipOf=(key:string|undefined):MoveClip|null=>key?CLIPS.clips[key]??null:null;

// ------------------------------------------------------------------ the clip as a chalk drawing
export type Pt={x:number;y:number};
/** One stroke of a move's drawing: a pass (solid), a run (dashed), a carry (wavy), a shot (dotted).
 * `pts` is the path (two points for a pass or a shot); `at` is when it happens in the clip, in seconds. */
export interface SketchMark {kind:'pass'|'run'|'carry'|'shot';pts:Pt[];at:number}
const ours=(o:number)=>o>=0&&o<5;
const dist=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.y-b.y);
const span=(pts:Pt[])=>pts.reduce((s,p,i)=>i?s+dist(pts[i-1],p):0,0);
export const playerAt=(f:readonly number[],n:number):Pt=>({x:f[n*2]/10,y:f[n*2+1]/10});
export const ballAt=(f:readonly number[]):Pt=>({x:f[20]/10,y:f[21]/10});

/** The move a clip shows, drawn the way the plan board draws: from the moment the move starts
 * until the ball is theirs, each pass between two of ours, the receiver's run to it, a carry
 * that really goes somewhere, and the shot when their keeper ends it. The real go, as chalk. */
export function clipDiagram(c:MoveClip):{marks:SketchMark[];from:number;involved:number[]}{
 const F=c.frames,from=Math.min(F.length-1,Math.max(0,Math.round(c.start/c.step))),at=(i:number)=>+(i*c.step).toFixed(2);
 const segs:{o:number;a:number;b:number}[]=[];
 for(let i=from;i<F.length;i++){const o=F[i][23],l=segs[segs.length-1];if(l&&l.o===o)l.b=i;else segs.push({o,a:i,b:i});}
 const marks:SketchMark[]=[],free=Array<number>(5).fill(from),involved=new Set<number>();
 const path=(a:number,b:number,pt:(f:readonly number[])=>Pt)=>{const out:Pt[]=[];for(let i=a;i<=b;i++)out.push(pt(F[i]));return out;};
 for(let k=0;k<segs.length;k++){
  const g=segs[k];
  if(g.o>=5)break;// theirs: the move is over
  if(ours(g.o)){involved.add(g.o);
   const p=path(g.a,g.b,ballAt);if(dist(p[0],p[p.length-1])>3)marks.push({kind:'carry',pts:p,at:at(g.a)});
   free[g.o]=g.b;continue;}
  const nx=segs[k+1],a=ballAt(F[g.a]);
  if(nx&&ours(nx.o)){
   marks.push({kind:'pass',pts:[a,ballAt(F[nx.a])],at:at(g.a)});
   const r=nx.o,run=path(free[r],nx.a,f=>playerAt(f,r));
   if(span(run)>3)marks.push({kind:'run',pts:run,at:at(free[r])});
   continue;}
  // in flight to their keeper (or still in the air at the end) near goal: the shot; a goal too, where the next
  // frame is already their kick-off on the centre spot, so the flight's own last point is where it went
  const kickoff=!!nx&&nx.o>5&&Math.abs(ballAt(F[nx.a]).x-24)<.5&&Math.abs(ballAt(F[nx.a]).y)<.5;
  if(!nx||nx.o===5||kickoff){const end=nx&&!kickoff?ballAt(F[nx.a]):ballAt(F[g.b]);if(end.x>40)marks.push({kind:'shot',pts:[a,{x:48,y:Math.max(-1.6,Math.min(1.6,end.y))}],at:at(g.a)});}
  break;
 }
 return {marks:marks.sort((x,y)=>x.at-y.at),from,involved:[...involved]};
}
