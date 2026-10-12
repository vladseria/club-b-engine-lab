export function matchIntegrity(r){
 const restarts=[];let start=null,kind;
 for(const f of r.frames){
  if(f.restart&&start===null){start=f.time;kind=f.restartInfo?.kind;}
  if(!f.restart&&start!==null){restarts.push({start,end:f.time,duration:f.time-start,kind});start=null;}
 }
 if(start!==null)restarts.push({start,end:r.duration,duration:r.duration-start,kind});
 const events=r.events.filter(e=>!['end','start'].includes(e.kind));
 const gaps=events.map((e,i)=>({start:e.time,end:events[i+1]?.time??r.duration,duration:(events[i+1]?.time??r.duration)-e.time}));
 const longestRestart=restarts.sort((a,b)=>b.duration-a.duration)[0]??null;
 const longestQuiet=gaps.sort((a,b)=>b.duration-a.duration)[0]??null;
 const warnings=[...restarts.filter(s=>s.duration>30).map(s=>({type:'restart-over-30s',...s})),...gaps.filter(s=>s.duration>60).map(s=>({type:'no-event-over-60s',...s}))];
 return {ok:!warnings.length,longestRestart,longestQuiet,warnings};
}
