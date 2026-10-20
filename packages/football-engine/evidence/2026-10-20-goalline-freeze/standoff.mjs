// Goal-line freeze (2026-10-20): the standoff scan. A standoff is the ball staying within NEAR m of a goal line and
// within STILL m of where it was when that began, with no restart in between. Returns the longest one (seconds, start)
// and how many lasted more than LONG s.
export const NEAR=3,STILL=1,L=48,LONG=20;
export function longestStandoff(frames){
 let best={seconds:0,at:null,x:null,y:null},start=null,long=0,counted=false;
 for(const f of frames){
  const near=f.x<NEAR||f.x>L-NEAR;
  if(!near||f.restart||start&&Math.hypot(f.x-start.x,f.y-start.y)>STILL){start=near&&!f.restart?f:null;counted=false;continue;}
  if(!start){start=f;counted=false;continue;}
  const s=f.t-start.t;
  if(s>LONG&&!counted){long++;counted=true;}
  if(s>best.seconds)best={seconds:Math.round(s*10)/10,at:Math.round(start.t*10)/10,x:Math.round(start.x*10)/10,y:Math.round(start.y*10)/10};
 }
 return {...best,long};
}
