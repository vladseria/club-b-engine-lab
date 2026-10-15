// Contest cost (2026-10-15): summarise a V8 .cpuprofile of one match (cost.mjs, node --cpu-prof) into self and total
// time per function, attributed to its engine source file through the bundle's esbuild module markers
// ("// packages/football-engine/src/practice.ts"). Times in ms. A sample lasts until the next one (DevTools' rule).
//   summarize(profile, bundleText) -> {totalMs, engineMs, gcMs, ..., fns:[{f,file,self,total}], files:{file:self}, callers}
// `engine` = samples with runMatch on the stack (the match itself; the row's reading of the record is outside it).
const PICK=new Set(['shotContest','shotRead','hurryCost','shotTemper','goalShadow','shotPoise','assessShot','practiceOptions',
 'footballOptions','aerialMeetings','readAerialKick','reachesAerialMeeting','openAerialMeeting','duelGeometry','readDuel','resolveDuel',
 'receptionDuel','layOff','airChallenger','challengePoint','airRace','attacksTheBall','resolveAirDuel','airStrength','airCommit',
 'flightSamples','flightContact','perceive','readNoise','misread','feltPressure','shotHurry','contestAim','stepInWillingness',
 'defendOutOfPossession','carryOptions','groundOptions','loftOptions','securePossessionOptions','laneRisk','turnoverPrice','preparationTime']);
const NEW=/practice-(shot-contest|duel|air-duel)\.ts$/;
export const short=f=>f?f.replace(/^.*football-engine\/src\//,'src/').replace(/^.*?(lib\/ballers\/)/,'$1').replace(/^.*evidence\//,'ev/'):'';
const base=n=>n.replace(/\d+$/,'');

export function markers(bundleText){
 const m=[];const lines=bundleText.split('\n');
 for(let i=0;i<lines.length;i++){const x=/^\/\/ (\S+\.(?:ts|tsx|mjs|js|json))$/.exec(lines[i]);if(x)m.push([i,short(x[1])]);}
 return line=>{let lo=0,hi=m.length-1,best='';while(lo<=hi){const k=(lo+hi)>>1;if(m[k][0]<=line){best=m[k][1];lo=k+1;}else hi=k-1;}return best;};
}

export function summarize(profile,bundleText){
 const fileAt=markers(bundleText);
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();
 for(const n of profile.nodes)for(const c of n.children??[])parent.set(c,n.id);
 const keyOf=new Map(),info=new Map();
 for(const n of profile.nodes){const cf=n.callFrame,name=cf.functionName||'(anonymous)';
  const file=cf.url&&cf.url.includes('.bundle.')?fileAt(cf.lineNumber):cf.url?short(cf.url.replace(/^file:\/\//,'')):'';
  const k=`${name}|${file}|${cf.url?cf.lineNumber:''}`;keyOf.set(n.id,k);if(!info.has(k))info.set(k,{f:name,file});}
 const S=profile.samples,D=profile.timeDeltas,N=S.length;
 const dur=i=>(i+1<N?D[i+1]:D[i])/1000;
 const self=new Map(),total=new Map(),callers=new Map();
 const add=(m,k,v)=>m.set(k,(m.get(k)??0)+v);
 let totalMs=0,engineMs=0;const special={};
 const stackCache=new Map();
 const stackOf=id=>{let s=stackCache.get(id);if(s)return s;s=[];for(let x=id;x!==undefined;x=parent.get(x))s.push(x);stackCache.set(id,s);return s;};
 for(let i=0;i<N;i++){
  const d=dur(i),id=S[i],k=keyOf.get(id),f=info.get(k).f;totalMs+=d;
  if(f.startsWith('('))special[f]=(special[f]??0)+d;
  add(self,k,d);
  const st=stackOf(id),seen=new Set(),pick=new Map();let engine=false;
  for(let j=0;j<st.length;j++){const kk=keyOf.get(st[j]);if(!seen.has(kk)){seen.add(kk);add(total,kk,d);}
   const nm=info.get(kk).f;if(nm==='runMatch')engine=true;
   if(PICK.has(base(nm))||NEW.test(info.get(kk).file)){const pk=j+1<st.length?keyOf.get(st[j+1]):'(root)';pick.set(kk,pk);}// outermost wins
  }
  if(engine)engineMs+=d;
  for(const [kk,pk] of pick){let m=callers.get(kk);if(!m)callers.set(kk,m=new Map());add(m,pk,d);}
 }
 const r=x=>Math.round(x*10)/10;
 const fns=[...info.keys()].map(k=>({...info.get(k),self:r(self.get(k)??0),total:r(total.get(k)??0),key:k}))
  .filter(x=>x.self>=engineMs*.0002||x.total>=engineMs*.002||NEW.test(x.file)||PICK.has(base(x.f))).sort((a,b)=>b.self-a.self).slice(0,600);
 const files={};for(const [k,v] of self){const f=info.get(k).file||'(vm)';files[f]=r((files[f]??0)+v);}
 const callerOut={};
 for(const [k,m] of callers){const i=info.get(k);callerOut[`${i.f}|${i.file}`]=Object.fromEntries([...m].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([pk,v])=>{const p=info.get(pk);return [p?`${p.f}|${p.file}`:pk,r(v)];}));}
 return {totalMs:r(totalMs),engineMs:r(engineMs),gcMs:r(special['(garbage collector)']??0),programMs:r(special['(program)']??0),idleMs:r(special['(idle)']??0),samples:N,
  fns:fns.map(({key,...x})=>x),files,callers:callerOut};
}
