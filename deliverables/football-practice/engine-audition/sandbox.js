import {playbookProgress,samplePractice,practicePlayers,createTrainingSetup,validatePlans,validateTrainingSetup,defensiveApproaches,teamApproaches,validateApproach} from './football-engine/index.js';
const $=id=>document.getElementById(id),copy=v=>structuredClone(v),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const matchKey='football-match-preparation-v1';
const formations={'1-2-1':{label:'Losange · 1–2–1',note:'Un apărător, două opțiuni laterale și un vârf.',slots:['Portar','Apărător','Flanc sus','Flanc jos','Vârf'],points:[[8,50],[28,50],[51,23],[51,77],[77,50]]},'2-2':{label:'Pătrat · 2–2',note:'Doi jucători în spate și două opțiuni avansate.',slots:['Portar','Apărător sus','Apărător jos','Atacant sus','Atacant jos'],points:[[8,50],[32,28],[32,72],[69,25],[69,75]]},'2-1-1':{label:'Două linii de sprijin · 2–1–1',note:'Doi în spate, un mijlocaș central și un vârf.',slots:['Portar','Apărător sus','Apărător jos','Mijlocaș','Vârf'],points:[[8,50],[29,28],[29,72],[53,50],[79,50]]}};
const libraryKey='football-saved-tactics-v1';
const key='football-coaching-responsibilities-v1',uid=()=>`c-${crypto.randomUUID()}`;
const fresh=()=>({id:uid(),name:'Schema mea',weight:100,instructions:[],preferred:null,lesson:{spaces:[],moments:[{id:'start',name:'La început',cue:{kind:'start'}}],jobs:[]}});
const kinds={advance:['Avansează cu mingea','Caută spațiu și invită presiunea'],offer:['Oferă o pasă','Rămâi disponibil pentru un coleg'],run:['Atacă un spațiu','Găsește loc pentru o primire'],occupy:['Ocupă un apărător','Oferă o amenințare lângă el'],pass:['Caută pasa','Un coleg sau un spațiu comun'],shoot:['Caută șutul','Când apare o execuție viabilă'],hold:['Păstrează zona','Rămâi în sprijinul echipei']};
const paths={advance:'M2 18Q9 1 22 8m-5-5 5 5-5 3',offer:'M2 12h19m-6-5 6 5-6 5M3 4v16',run:'M2 20 21 3m-7 0h7v7',occupy:'M7 4v16M3 12h8M17 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10',pass:'M2 12h20m-6-6 6 6-6 6',shoot:'M16 3h7v18h-7M2 19 20 9m-6 0h6v6',hold:'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M4 12h16'};
const colors={home:'#ff4f7b',away:'#ffd23f',homeKeeper:'#80dfff',awayKeeper:'#c3a2ff',paper:'#f5f7ee',teal:'#37d3c0'};
const state={opposition:'original',manager:'lesson',emphasis:100,library:[],pairA:3,pairB:5,plan:fresh(),moment:'start',actor:3,space:null,fixture:null,players:[],setup:null,scene:'middle',seed:2026,view:'edit',setupMode:false,picking:null,undo:[],busy:false,worker:null,request:0,timer:0,drag:null,last:null,previous:null,which:'current',attempt:0,selectedTrace:null,time:0,playing:false,speed:1,raf:0,lastTick:0,overlay:true,traceKey:'',editingMoment:null,recognition:null,previewWorker:null,previewRequest:0,previewTimer:0,previewTimeout:0,previewSignature:'',previewBusy:false,previewError:'',entryOpen:false};
const roleLabels={carrier:'Purtătorul mingii',support:'Un coleg în sprijin',runner:'Un alergător'},roleShort={carrier:'Purtător',support:'Sprijin',runner:'Alergător'};
const lesson=()=>state.plan.lesson,jobActor=a=>typeof a==='number'?String(a):`receiver:${a.receiverOf}`;
const readActor=v=>v.startsWith('receiver:')?{receiverOf:v.slice(9)}:Number(v);
const job=()=>lesson().jobs.find(j=>j.momentId===state.moment&&jobActor(j.actor)===jobActor(state.actor));
// A continuation edits only the responsibilities that change. The engine already
// keeps active movement jobs; the editor must expose those same instructions.
function inheritedJob(){if(moment().entry)return undefined;return ancestorJobs(state.moment).find(j=>jobActor(j.actor)===jobActor(state.actor)&&!['pass','shoot'].includes(j.kind));}
function displayedJob(){return job()??inheritedJob();}
function localJob(){let j=job();if(!j){const previous=inheritedJob();if(previous){j={...copy(previous),id:uid(),momentId:state.moment};lesson().jobs.push(j);}}return j;}
function effectiveJobs(mid,l=lesson()){
 const current=l.jobs.filter(j=>j.momentId===mid),old=l.moments.find(m=>m.id===mid)?.entry?[]:ancestorJobs(mid,l);
 return [...current,...old.filter(j=>!['pass','shoot'].includes(j.kind)&&!current.some(q=>jobActor(q.actor)===jobActor(j.actor)))];
}
function intendedReceiver(pass,l=lesson()){
 if(!pass)return null;if(typeof pass.recipient==='number')return pass.recipient;
 if(!pass.spaceId)return null;
 const runners=effectiveJobs(pass.momentId,l).filter(j=>j.kind==='run'&&j.spaceId===pass.spaceId&&jobActor(j.actor)!==jobActor(pass.actor));
 return runners.length===1?runners[0].actor:null;
}
function receiverSlot(pass,l=lesson(),seen=new Set()){
 if(!pass||seen.has(pass.id))return null;seen.add(pass.id);const receiver=intendedReceiver(pass,l);
 return typeof receiver==='number'?receiver:receiver?receiverSlot(l.jobs.find(j=>j.id===receiver.receiverOf),l,seen):null;
}
function plannedCarrier(mid,l=lesson(),seen=new Set()){
 if(seen.has(mid))return null;seen.add(mid);const m=l.moments.find(m=>m.id===mid);
 if(m?.entry)return m.entry.carrier;if(m?.cue.kind==='start')return state.setup.ball.number;
 const pass=l.jobs.find(j=>j.id===m?.cue.jobId);
 if(m?.cue.kind==='received')return receiverSlot(pass,l);
 return pass?plannedCarrier(pass.momentId,l,seen):null;
}
function passDestination(j,l=lesson()){
 const receiver=intendedReceiver(j,l),who=typeof receiver==='number'?slotLabel(receiver,l):receiver?'primitorul':null;
 return j.spaceId?`${who??'un coleg'} în ${spaceName(j,l)}`:who??'un coleg disponibil';
}
function coachingSentence(j,l=lesson()){
 const who=typeof j.actor==='number'?slotLabel(j.actor,l):'Primitorul';
 const actions={run:`atacă ${spaceName(j,l)} și rămâne disponibil acolo`,pass:`caută pasa către ${passDestination(j,l)}`,offer:'oferă un unghi de pasă',shoot:'caută șutul',advance:`conduce mingea spre ${spaceName(j,l)}`,hold:`păstrează ${j.spaceId?spaceName(j,l):'zona'}`,occupy:`ține ocupat apărătorul #${j.opponent}`};
 return `${who} ${j.repeat?'caută un-doiul repetat':actions[j.kind]}.`;
}
function momentTitle(m,l=lesson()){
 if(m.cue.kind!=='received')return cueText(m,l);
 const pass=l.jobs.find(j=>j.id===m.cue.jobId),receiver=intendedReceiver(pass,l);
 return receiver!==null?`Când ${typeof receiver==='number'?slotLabel(receiver,l):'primitorul'} primește de la ${typeof pass?.actor==='number'?slotLabel(pass.actor,l,true):'coleg'}`:`După ${passLabel(pass,l)}`;
}
function continuePass(pass){
 const existing=lesson().moments.find(m=>m.cue.kind==='received'&&m.cue.jobId===pass.id);
 const actor=intendedReceiver(pass)??{receiverOf:pass.id};
 if(existing){const receiverJob=lesson().jobs.find(j=>j.momentId===existing.id&&typeof j.actor!=='number'&&j.actor.receiverOf===pass.id);state.moment=existing.id;state.actor=copy(receiverJob?.actor??actor);state.picking=null;state.space=null;render();return;}
 edit(()=>{
  const id=uid(),m={id,name:'După primire',cue:{kind:'received',jobId:pass.id}};lesson().moments.push(m);
  // The passer offers a return option; all other active jobs carry on unchanged.
  lesson().jobs.push({id:uid(),momentId:id,actor:copy(pass.actor),kind:'offer',teammate:'carrier'});
  state.moment=id;state.actor=copy(actor);state.picking=null;state.space=null;
 },'Alege ce face primitorul. Colegii își continuă indicațiile; pasatorul oferă sprijin.');
}
function linkPassToRunner(pass,runner){setSpace(pass,runner.spaceId);if(typeof runner.actor==='number')pass.recipient=runner.actor;}
const moment=()=>lesson().moments.find(m=>m.id===state.moment)??lesson().moments[0];
const pose=n=>state.setup.poses.find(p=>p.side===0&&p.number===n),player=n=>(state.view==='replay'?result()?.players??state.players:state.players).find(p=>p.side===0&&p.number===n),name=n=>player(n)?.name??`#${n}`;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,cls){const b=node('button',text,cls);b.onclick=fn;return b;}
function options(e,rows,value){e.replaceChildren(...rows.map(([v,t])=>{const o=node('option',t);o.value=String(v);return o;}));e.value=String(value);}
function field(label,rows,value,handler){const l=node('label',label),s=node('select');options(s,rows,value);s.onchange=()=>handler(s.value);l.append(s);return l;}
function icon(kind){const s=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(s.namespaceURI,'path');s.setAttribute('viewBox','0 0 26 24');s.setAttribute('aria-hidden','true');p.setAttribute('d',paths[kind]);s.append(p);return s;}
function status(t,error=false){$('status').textContent=t;$('status').classList.toggle('error',error);}
function slotLabel(n,l=lesson(),short=false){return l.roles?.[n]?(short?roleShort:roleLabels)[l.roles[n]]:short?`#${n}`:`#${n} ${name(n)}`;}
function previewEntry(){const rows=state.recognition?.entries??[];return rows.find(e=>e.momentId===state.moment)??state.recognition?.best??rows[0];}
function activeRecognition(){return state.view==='replay'?attempts()[state.attempt]?.recognition:previewEntry();}
function boundNumber(n,l=lesson(),recognition=activeRecognition()){return recognition?.bindings?.[n]??(l.roles?.[n]?null:Number(n));}
function slotForNumber(n,l=lesson()){const bindings=activeRecognition()?.bindings??{};return Number(Object.keys(bindings).find(slot=>bindings[slot]===n)??n);}
function actorSlot(a,l=lesson()){if(typeof a==='number')return a;const binding=moment().entry?.receiverBindings?.[a.receiverOf];if(binding)return binding;const source=l.jobs.find(j=>j.id===a.receiverOf);return receiverSlot(source,l)??state.setup.ball.number;}
function actorNumber(a,l=lesson()){if(typeof a!=='number'&&activeRecognition()?.receiverBindings?.[a.receiverOf])return activeRecognition().receiverBindings[a.receiverOf];return boundNumber(actorSlot(a,l),l)??actorSlot(a,l);}
function actorText(a,l=lesson()){return typeof a==='number'?slotLabel(a,l):`cel care primește ${passLabel(l.jobs.find(j=>j.id===a.receiverOf),l)}`;}
function receiverIdentity(a,l=lesson(),mid=state.moment){
 const rec=activeRecognition(),actualReceiver=rec?.receiverBindings?.[a.receiverOf];if(actualReceiver)return `Primitor → #${actualReceiver} ${name(actualReceiver)}`;
 const m=l.moments.find(m=>m.id===mid),entry=m?.entry??l.moments.find(m=>m.id===rec?.momentId)?.entry,slot=entry?.receiverBindings?.[a.receiverOf];
 if(!slot)return 'Primitorul pasei';const actual=boundNumber(slot,l),role=slotLabel(slot,l,true);
 return `Primitor → ${role}${l.roles?.[slot]&&actual?` (#${actual})`:''}`;
}
function passLabel(j,l=lesson()){if(!j)return 'pasa';return `pasa ${typeof j.actor==='number'?`de la ${slotLabel(j.actor,l,true)}`:'primitorului'} către ${passDestination(j,l)}`;}
function cueText(m,l=lesson()){if(!m)return 'Momentul ideii';const c=m.cue;return c.kind==='start'?'La început':c.kind==='pressed'?`Când ${typeof c.actor==='number'?slotLabel(c.actor,l,true):'primitorul'} este presat`:c.kind==='received'?`După ${passLabel(l.jobs.find(j=>j.id===c.jobId),l)}`:`Când pleacă ${passLabel(l.jobs.find(j=>j.id===c.jobId),l)}`;}
function spaceName(j,l=lesson()){return l.spaces.find(s=>s.id===j.spaceId)?.name??'spațiul ales';}
function description(j,l=lesson()){
 if(j.repeat)return `Combină repetat cu ${slotLabel(j.recipient,l,true)}: pasează, pleacă pentru retur, caută șutul când apare.`;
 if(j.kind==='advance')return `Avansează prin ${spaceName(j,l)}, cât timp există loc.`;
 if(j.kind==='run')return `Atacă ${spaceName(j,l)} și caută o primire.`;
 if(j.kind==='offer')return `Oferă o pasă ${j.teammate==='carrier'||!j.teammate?'purtătorului mingii':`pentru ${slotLabel(j.teammate,l,true)}`}; ajustează unghiul.`;
 if(j.kind==='occupy')return `Oferă o amenințare lângă apărătorul #${j.opponent}.`;
 if(j.kind==='hold')return `Păstrează ${j.spaceId?spaceName(j,l):'zona în care te afli'}.`;
 if(j.kind==='shoot')return 'Caută un șut executabil; păstrează celelalte soluții.';
 return `Caută pasa către ${passDestination(j,l)}${j.delivery==='loft'?', de preferat pe sus':''}${j.fallback?'; poate continua și prin alt coleg':''}.`;
}
function editorPlan(){
 if(state.manager!=='one-two')return {...copy(state.plan),emphasis:state.emphasis/100};
 return {id:`one-two-${state.pairA}-${state.pairB}`,name:`Un-doi · ${name(state.pairA)} și ${name(state.pairB)}`,weight:100,emphasis:state.emphasis/100,instructions:[],preferred:null,lesson:{spaces:[],moments:[{id:'start',name:'La început',cue:{kind:'start'}}],jobs:[{id:'pair',momentId:'start',actor:state.pairA,kind:'pass',recipient:state.pairB,repeat:true}]}};
}
function storeLibrary(){try{localStorage.setItem(libraryKey,JSON.stringify(state.library));$('library-status').textContent='Tacticile se păstrează în acest browser.';}catch{$('library-status').textContent='Salvarea în browser nu este disponibilă.';}}
function renderLibrary(){
 const replay=state.view==='replay';$('tactic-library').hidden=replay;$('save-tactic').hidden=replay;
 $('save-tactic').disabled=state.manager==='lesson'&&!lesson().jobs.length&&!state.plan.standing?.length;
 const active=state.library.filter(r=>r.enabled&&r.plan.emphasis>0);$('tactic-count').textContent=`· ${active.length} active`;
 $('play-saved').disabled=!active.length||state.busy;
 const box=$('saved-tactics');box.replaceChildren();
 if(active.length>1)box.append(node('p','Ideile cu participanți diferiți pot funcționa împreună. Când cer același jucător, accentul și situația decid ce începe; combinația începută are continuitate.','hint'));
 if(!state.library.length)box.append(node('p','Salvează prima idee de pe tablă sau combinația un-doi.','hint'));
 for(const row of state.library){
  const item=node('div',undefined,'saved-tactic'),label=node('label',undefined,'check'),check=node('input');check.type='checkbox';check.checked=row.enabled;check.onchange=()=>{row.enabled=check.checked;storeLibrary();renderLibrary();};label.append(check,node('span',row.plan.name));
  const level=node('label',`Accent · ${Math.round(row.plan.emphasis*100)}`),range=node('input');range.type='range';range.min=0;range.max=100;range.step=5;range.value=row.plan.emphasis*100;range.setAttribute('aria-label',`Accent pentru ${row.plan.name}`);range.oninput=()=>{row.plan.emphasis=Number(range.value)/100;level.firstChild.textContent=`Accent · ${range.value}`;};range.onchange=()=>{storeLibrary();renderLibrary();};level.append(range);
  item.append(label,level,button('Editează',()=>{edit(()=>{if(row.lineup){state.fixture.teams[0].lineup=[...row.lineup];state.players=practicePlayers(state.fixture);}state.plan=copy(row.plan);state.manager='lesson';state.emphasis=Math.round((row.plan.emphasis??1)*100);state.moment=state.plan.lesson.moments[0].id;state.actor=3;state.space=null;},'Tactica este pe tablă. Salvează din nou pentru a actualiza varianta de meci.');}),button('Șterge',()=>{state.library=state.library.filter(r=>r!==row);storeLibrary();renderLibrary();},'quiet'));box.append(item);
 }
}
function trialPlan(){const t=viewTrial();return t?.input.plans.find(p=>p.id===attempts()[state.attempt]?.planId)??t?.input.plans[0]??state.plan;}
function snapshot(){return copy({opposition:state.opposition,plan:state.plan,setup:state.setup,scene:state.scene,seed:state.seed,moment:state.moment,actor:state.actor,manager:state.manager,emphasis:state.emphasis,pairA:state.pairA,pairB:state.pairB,trainingTeam:state.fixture?{lineup:state.fixture.teams[0].lineup,tactics:state.fixture.teams[0].tactics}:undefined});}
function save(){try{localStorage.setItem(key,JSON.stringify(snapshot()));$('save-status').textContent='Ideea se păstrează în acest browser.';}catch{$('save-status').textContent='Salvarea în browser nu este disponibilă.';}}
function restoreEditor(saved){Object.assign(state,saved);if(saved.trainingTeam){Object.assign(state.fixture.teams[0],copy(saved.trainingTeam));state.players=practicePlayers(state.fixture);}}
function stop(){state.playing=false;cancelAnimationFrame(state.raf);}
function edit(fn,message='Idee salvată. Încearc-o pe teren.'){
 const before=snapshot();try{fn();validatePlans([state.plan]);validateTrainingSetup(state.setup,state.players);}catch(e){restoreEditor(before);render();status(`Nu am păstrat modificarea: ${e.message}`,true);return false;}
 state.undo.push(before);if(state.undo.length>30)state.undo.shift();stop();state.view='edit';state.selectedTrace=null;save();render();status(message);return true;
}
function selectedSpace(){return lesson().spaces.find(s=>s.id===state.space);}
function addSpace(point){let s=lesson().spaces.find(s=>!lesson().jobs.some(j=>j.spaceId===s.id)&&!state.plan.standing?.some(j=>j.spaceId===s.id)&&!lesson().moments.some(m=>m.entry?.conditions.some(c=>c.spaceId===s.id)));if(s){delete s.anchor;Object.assign(s,point);return s.id;}if(lesson().spaces.length>=8)throw Error('Ai deja opt spații. Alege unul existent.');s={id:uid(),name:`Spațiul ${lesson().spaces.length+1}`,x:point.x,y:point.y,radius:3.5};lesson().spaces.push(s);return s.id;}
function chooseKind(kind){
 const existing=job(),shown=displayedJob();if(shown?.kind===kind){state.picking=['advance','run','hold'].includes(kind)?'space':kind==='pass'?'pass':kind==='occupy'?'opponent':null;render();return;}
 edit(()=>{
 const origin=pose(actorNumber(state.actor));const j={id:existing?.id??uid(),momentId:state.moment,actor:copy(state.actor),kind};
 if(['advance','run'].includes(kind))j.spaceId=shown?.spaceId??addSpace({x:clamp(origin.x+8,.8,47.2),y:origin.y});
 if(kind==='offer')j.teammate='carrier';
 if(kind==='occupy')j.opponent=state.setup.poses.filter(p=>p.side===1&&p.number!==1).sort((a,b)=>dist(a,origin)-dist(b,origin))[0].number;
 if(kind==='pass'){j.recipient='free';j.delivery='auto';j.fallback=true;}
 if(kind==='hold'&&shown?.spaceId)j.spaceId=shown.spaceId;
 if(existing)lesson().jobs[lesson().jobs.indexOf(existing)]=j;else lesson().jobs.push(j);
 state.space=j.spaceId??null;state.picking=['advance','run','hold'].includes(kind)?'space':kind==='pass'?'pass':kind==='occupy'?'opponent':null;
 },kind==='offer'?'Îl va căuta pe coleg și va ajusta unghiul de sprijin.':'Responsabilitate adăugată. Arată pe teren spațiul sau legătura.');
}
function setSpace(j,id){delete j.repeat;delete j.recipient;j.spaceId=id;state.space=id;state.picking=null;}
function identifiedField(label,rows,value,handler,id){const fieldNode=field(label,rows,value,handler);if(id)fieldNode.querySelector('select').id=id;return fieldNode;}
function slotRows(){return [2,3,4,5].map(n=>[n,slotLabel(n)]);}
function referencePose(anchor,poses=state.setup.poses,l=lesson(),recognition=activeRecognition()){
 const n=anchor.kind==='opponent'?anchor.number:boundNumber(anchor.number,l,recognition)??anchor.number;
 return poses.find(p=>p.side===(anchor.kind==='opponent'?1:0)&&p.number===n);
}
function resolvedSpace(s,l=lesson(),poses=state.setup.poses,recognition=activeRecognition()){
 if(state.view==='replay'){const observed=entries().findLast(e=>e.time<=state.time&&(e.evidence?.space?.id===s.id||e.evidence?.resolvedSpaces?.some(q=>q.id===s.id)));const recorded=observed?.evidence?.space??observed?.evidence?.resolvedSpaces?.find(q=>q.id===s.id)??recognition?.resolvedSpaces?.find(q=>q.id===s.id);if(recorded)return recorded;}
 if(!s.anchor)return s;const ref=referencePose(s.anchor,poses,l,recognition);if(!ref)return s;
 return {...s,x:ref.x+s.anchor.dx,y:ref.y+s.anchor.dy};
}
function setSpacePoint(s,p){Object.assign(s,p);if(s.anchor){const ref=referencePose(s.anchor);if(ref){s.anchor.dx=p.x-ref.x;s.anchor.dy=p.y-ref.y;}}}
function spaceMeaning(s,l=lesson()){
 if(!s.anchor)return 'Această zonă a terenului';const a=s.anchor,reference=a.kind==='opponent'?`galben #${a.number}`:slotLabel(a.number,l,true);
 const forward=Math.abs(a.dx).toFixed(1).replace('.',','),side=Math.abs(a.dy).toFixed(1).replace('.',',');
 return `Față de ${reference}: ${forward} m ${a.dx>=0?'înainte':'înapoi'}, ${side} m spre ${a.dy>=0?'jos':'sus'}.`;
}
function renderRole(){
 const box=$('role-settings');box.replaceChildren();if(typeof state.actor!=='number')return;const slot=state.actor,current=lesson().roles?.[slot]??'fixed';
 const used=Object.entries(lesson().roles??{}).filter(([n])=>Number(n)!==slot).map(([,role])=>role);
 const advanced=node('details');advanced.open=current!=='fixed';advanced.append(node('summary',current==='fixed'?'Schimbă jucătorul cu un rol flexibil':'Rol flexibil pentru toată combinația'));advanced.append(identifiedField('Cine preia aceste indicații?', [['fixed',`Doar #${slot} ${name(slot)}`],...Object.entries(roleLabels).filter(([role])=>role!=='carrier'||role===current||!used.includes(role))],current,value=>edit(()=>{lesson().roles??={};if(value==='fixed')delete lesson().roles[slot];else lesson().roles[slot]=value;},'Atribuire păstrată pentru toată ideea.'),'role-assignment'));
 const actual=boundNumber(slot),text=current==='fixed'?`#${slot} rămâne ales în toate momentele ideii.`:`Acest rol preia indicațiile lui #${slot} în toată ideea. ${actual?`Acum: #${actual} ${name(actual)}.`:'Atribuirea depinde de situația de pornire.'}`;
 box.append(node('p',text,'hint'),advanced);
}
function renderSpaceMeaning(s,container){
 const box=node('div',undefined,'space-meaning'),value=s.anchor?`${s.anchor.kind}:${s.anchor.number}`:'fixed';
 const rows=[['fixed','Această zonă a terenului'],...[2,3,4,5].map(n=>[`player:${n}`,`Față de ${slotLabel(n)}`]),...[2,3,4,5].map(n=>[`opponent:${n}`,`Față de galben #${n}`])];
 box.append(identifiedField('Ce înseamnă spațiul desenat?',rows,value,next=>edit(()=>{const p=resolvedSpace(s);if(next==='fixed'){delete s.anchor;Object.assign(s,{x:p.x,y:p.y});}else{const [kind,n]=next.split(':'),anchor={kind,number:Number(n),dx:0,dy:0},ref=referencePose(anchor);s.anchor={...anchor,dx:p.x-(ref?.x??p.x),dy:p.y-(ref?.y??p.y)};Object.assign(s,{x:p.x,y:p.y});}},'Sensul spațiului s-a păstrat. Mută jucătorii pentru a vedea cum se adaptează.'),'space-anchor'));
 box.append(node('p',spaceMeaning(s),'hint'));box.append(node('p',s.anchor?(s.anchor.kind==='player'?'Spațiul se stabilește față de coleg la începutul momentului, apoi rămâne o destinație. Mută centrul pentru a schimba direcția.':'Spațiul urmărește schimbările importante de poziție ale apărătorului. Mută centrul pentru a schimba direcția.'):'Spațiul rămâne aici când muți jucătorii.','hint'));container.append(box);
}
function renderEntry(){
 const box=$('entry-settings'),m=moment();box.replaceChildren();
 if(['received','pressed'].includes(m.cue.kind))box.append(node('p','Jucătorii pot recunoaște această continuare și în joc, dacă situația se potrivește. Nu trebuie să repete începutul.','hint'));
 if(m.entry)box.append(node('p','Condițiile salvate pentru acest moment apar în explicația de mai jos.','hint'));
}
function previewRecognition(){
 if(!state.fixture||state.view!=='edit')return;const signature=JSON.stringify({lesson:lesson(),setup:state.setup,opposition:state.opposition});if(signature===state.previewSignature)return;
 state.previewSignature=signature;state.recognition=null;state.previewError='';state.previewBusy=!!lesson().jobs.length;clearTimeout(state.previewTimer);clearTimeout(state.previewTimeout);const request=++state.previewRequest;if(!lesson().jobs.length)return;
 state.previewTimer=setTimeout(()=>{
  if(!state.previewWorker){const w=new Worker('./sandbox-worker.js',{type:'module'});state.previewWorker=w;w.onmessage=({data})=>{if(data.request!==state.previewRequest)return;clearTimeout(state.previewTimeout);state.previewBusy=false;if(data.type==='preview'){state.recognition=data.recognition;state.previewError='';}else{state.previewError='Nu am putut verifica așezarea de acum.';}if(state.view==='edit')render();};w.onerror=()=>{clearTimeout(state.previewTimeout);w.terminate();state.previewWorker=null;state.previewBusy=false;state.previewError='Recunoașterea nu s-a încărcat. Ideea ta este păstrată.';if(state.view==='edit')render();};}
  state.previewWorker.postMessage({type:'preview',request,fixture:state.fixture,opposition:state.opposition,setup:copy(state.setup),lesson:copy(lesson())});state.previewTimeout=setTimeout(()=>{if(request!==state.previewRequest)return;state.previewWorker?.terminate();state.previewWorker=null;state.previewBusy=false;state.previewError='Verificarea a durat prea mult. Poți reîncerca.';if(state.view==='edit')render();},12000);
 },160);
}
function bindingList(recognition,l=lesson()){
 const list=node('ul',undefined,'recognition-bindings');for(const [slot,actual] of Object.entries(recognition?.bindings??{})){if(!l.roles?.[slot]&&Number(slot)===actual)continue;list.append(node('li',`${slotLabel(Number(slot),l,true)}: #${actual} ${name(actual)}`));}return list;
}
function recognitionCheckKey(c){return [c.kind,c.actor,c.target,c.spaceId,c.available,c.evaluated!==false].join(':');}
function renderRecognitionEvidence(box,rec,replay=false){
 const checks=rec.evidence?.checks??[],authored=checks.filter(c=>c.source==='entry').sort((a,b)=>a.conditionIndex-b.conditionIndex),seen=new Set(authored.map(recognitionCheckKey));
 const ordinary=checks.filter(c=>c.source!=='entry'&&c.kind!=='role').filter(c=>{const key=recognitionCheckKey(c);if(seen.has(key))return false;seen.add(key);return true;});
 const list=(rows,explicit=false)=>{const ul=node('ul',undefined,'recognition-reasons');for(const c of rows){const li=node('li',explicit?`${c.evaluated===false?'Neverificată':c.available?'Îndeplinită':'Neîndeplinită'} — ${c.text}`:c.text);if(explicit)li.dataset.entryCondition=c.conditionIndex;ul.append(li);}return ul;};
 const missing=ordinary.filter(c=>!c.available);if(missing.length)box.append(list(missing));
 if(authored.length){box.append(node('h3',replay?'De ce a început aici':rec.automatic?'Situația recunoscută':'Condițiile tale'));box.append(list(authored,true));}
 if(!rec.eligible&&!missing.length&&!authored.some(c=>!c.available)&&rec.reasons?.length)box.append(list([...new Set(rec.reasons)].map(text=>({text}))));
 const extra=ordinary.filter(c=>c.available);if(extra.length){if(rec.independent){const more=node('details');more.append(node('summary','Alte relații verificate'),list(extra));box.append(more);}else box.append(list(extra));}
}
function renderRecognition(){
 const box=$('recognition-preview');box.hidden=state.view!=='edit';if(box.hidden)return;box.replaceChildren();box.setAttribute('aria-busy',String(state.previewBusy));
 const m=moment(),future=m.cue.kind!=='start';box.append(node('h3',future?'Când începe această etapă':'Poate începe din această așezare?'));
 if(future)box.append(node('p',`${momentTitle(m)}. Indicațiile de aici așteaptă acest moment în timpul probei.`,'hint'));
 if(!lesson().jobs.length){box.append(node('p',state.plan.standing?.length?'Indicațiile persistente se aplică în faza aleasă; nu au nevoie să recunoască începutul unei combinații.':'Selectează un jucător, alege ce face și arată pe teren unde.','hint'));return;}
 if(state.previewBusy){box.append(node('p','Verifică așezarea de pornire…','hint'));return;}
 if(state.previewError){box.append(node('p',state.previewError,'hint'),button('Verifică din nou',()=>{state.previewSignature='';render();},'quiet'));return;}
 const rows=state.recognition?.entries??[],entry=rows.find(r=>r.momentId===state.moment);if(!entry)return;
 if(future){
  const more=node('details');more.append(node('summary',entry.eligible?'Poate recunoaște și această continuare direct':'Recunoaștere directă din așezarea de pornire'));
  more.append(node('p','Această verificare întreabă dacă poate sări direct aici din pozițiile inițiale. Nu verifică dacă etapa va funcționa după pasele anterioare.','hint'),bindingList(entry));renderRecognitionEvidence(more,entry);box.append(more);
 }else{box.append(node('p',entry.eligible?'Da. Echipa recunoaște începutul; execuția se decide pe teren.':'Începutul nu se potrivește încă. Verifică indicațiile și jucătorul cu mingea.','hint'),bindingList(entry));renderRecognitionEvidence(box,entry);}
}
function renderAttemptEntry(a,l){
 const box=$('attempt-entry');box.replaceChildren();const rec=a?.recognition;if(!rec)return;const m=l.moments.find(q=>q.id===rec.momentId),heading=node('p');heading.append(node('strong',rec.independent?`A început direct din momentul ${l.moments.indexOf(m)+1}`:`A recunoscut începutul: ${cueText(m,l)}`));box.append(heading,bindingList(rec,l));
 
 renderRecognitionEvidence(box,rec,true);
}
function renderMoments(){
 $('moments').replaceChildren(...lesson().moments.map(m=>{const b=button('',()=>{state.moment=m.id;state.entryOpen=false;$('other-jobs').open=false;state.actor=plannedCarrier(m.id)??state.actor;state.space=null;state.picking=null;render();});b.append(node('strong',momentTitle(m)),node('small',effectiveJobs(m.id).map(j=>`${j.momentId!==m.id?'Continuă: ':''}${coachingSentence(j)}`).join(' ')||'Selectează un jucător și desenează prima indicație.'));b.dataset.moment=m.id;b.setAttribute('aria-pressed',String(m.id===state.moment));return b;}));
 $('add-moment').disabled=state.busy||lesson().moments.length>=8;$('edit-moment').hidden=moment().cue.kind==='start';
}
function renderCueEditor(){const kind=$('cue-kind').value,passes=lesson().jobs.filter(j=>j.kind==='pass');const rows=kind==='pressed'?slotRows():passes.map(j=>[j.id,`${passLabel(j)} · ${lesson().moments.find(m=>m.id===j.momentId)?.name??'La început'}`]);options($('cue-reference'),rows,kind==='pressed'?actorSlot(state.actor):rows[0]?.[0]);$('confirm-moment').disabled=!rows.length;$('cue-reference-label').firstChild.textContent=kind==='pressed'?'Cine este presat':'Care pasă';$('cue-help').textContent=rows.length?'Adaugă aici toate responsabilitățile care răspund aceluiași moment.': 'Desenează întâi o pasă. Apoi poți lega primirea ei de un nou moment.';}
function renderChoices(container,items,current){$(container).replaceChildren(...items.map(kind=>{const b=button('',()=>chooseKind(kind));b.dataset.kind=kind;b.setAttribute('aria-pressed',String(current?.kind===kind));const text=node('span',kinds[kind][0]);text.append(node('small',kinds[kind][1]));b.append(icon(kind),text);return b;}));}
function renderCoach(){
 const j=displayedJob(),m=moment(),n=actorNumber(state.actor);$('player-tabs').replaceChildren(...[2,3,4,5].map(i=>{const b=button(`#${i}`,()=>{state.actor=i;$('other-jobs').open=false;state.picking=null;state.space=displayedJob()?.spaceId??null;render();});if(lesson().roles?.[i])b.append(node('small',roleShort[lesson().roles[i]]));b.dataset.player=i;b.setAttribute('aria-pressed',String(state.actor===i));return b;}));
 $('shirt').textContent=typeof state.actor==='number'?state.actor:(activeRecognition()?.receiverBindings?.[state.actor.receiverOf]||moment().entry?.receiverBindings?.[state.actor.receiverOf]?n:'↳');$('player-name').textContent=typeof state.actor==='number'?(lesson().roles?.[state.actor]?slotLabel(state.actor):name(n)):receiverIdentity(state.actor);$('actor-note').textContent=momentTitle(m);renderRole();
 const pass=lesson().jobs.find(p=>p.id===m.cue.jobId),canInherit=m.cue.kind==='received'&&!!pass;
 $('actor-choice').hidden=!canInherit;
 $('follow-receiver').checked=typeof state.actor!=='number';if(canInherit){const rows=[...slotRows(),[`receiver:${pass.id}`,`Oricine primește ${passLabel(pass)}`]];options($('job-actor'),rows,jobActor(state.actor));$('follow-receiver').onchange=()=>{$('job-actor').value=$('follow-receiver').checked?`receiver:${pass.id}`:String(typeof pass.recipient==='number'?pass.recipient:state.setup.ball.number);$('job-actor').onchange();};}
 const expectedOwner=plannedCarrier(m.id),owner=expectedOwner===null?null:boundNumber(expectedOwner)??expectedOwner;
 const main=n===owner||typeof state.actor!=='number'?['advance','pass','shoot']:['offer','run','occupy','hold'];renderChoices('main-jobs',main,j);renderChoices('more-jobs',Object.keys(kinds).filter(k=>!main.includes(k)),j);
 if(j&&!main.includes(j.kind))$('other-jobs').open=true;
 const warning=$('assignment-warning');warning.replaceChildren();warning.hidden=true;
 const role=typeof state.actor==='number'?lesson().roles?.[state.actor]:null;
 if(role==='carrier'&&j?.kind==='run'){warning.hidden=false;warning.append(node('p',`Această cursă este atribuită purtătorului mingii, nu lui ${name(state.actor)}. Pentru o cursă fără minge a acestui jucător, păstrează-l pe nume.`),button(`Atribuie lui ${name(state.actor)}`,()=>edit(()=>{delete lesson().roles[state.actor];})));}
 else if(j?.kind==='pass'&&typeof j.recipient==='number'&&j.recipient===state.actor){warning.hidden=false;warning.append(node('p','Jucătorul nu își poate pasa singur. Alege un coleg sau leagă pasa de cursa lui.'));}
 else if(j&&['pass','shoot','advance'].includes(j.kind)&&m.cue.kind==='received'&&expectedOwner!==null&&typeof state.actor==='number'&&state.actor!==expectedOwner&&!role){warning.hidden=false;warning.append(node('p',`Această etapă urmărește primirea lui ${slotLabel(expectedOwner)}. ${name(state.actor)} poate executa indicația doar dacă mingea ajunge apoi la el. Dacă vrei acțiunea imediat după primire, selectează ${name(expectedOwner)}.`));}
 const d=$('job-details');d.replaceChildren();$('job-advanced').replaceChildren();
 const change=fn=>edit(()=>fn(localJob()));
 const carried=j&&j.momentId!==state.moment;$('ongoing-instruction').hidden=!carried;$('ongoing-instruction').textContent=carried?`Continuă: ${description(j)} Schimbă indicația aici doar dacă vrei să facă altceva.`:'';
 if(j){
 if(j.kind==='pass'){
  const runners=effectiveJobs(state.moment).filter(q=>q.kind==='run'&&jobActor(q.actor)!==jobActor(state.actor));
  if(runners.length){const links=node('div',undefined,'pass-links');links.append(node('p','Leagă pasa de o cursă','hint'));for(const runner of runners){const b=button(`${actorText(runner.actor)} în ${spaceName(runner)}`,()=>change(q=>linkPassToRunner(q,runner)));b.dataset.linkRunner=jobActor(runner.actor);b.setAttribute('aria-pressed',String(j.spaceId===runner.spaceId));links.append(b);}d.append(links);}
 }
 if(['advance','run','hold','pass'].includes(j.kind)){
 const row=[...(j.kind==='pass'?[['free','Un coleg disponibil'],...[2,3,4,5].filter(i=>i!==state.actor).map(i=>[`player:${i}`,slotLabel(i)])]:j.kind==='hold'?[['here','Zona actuală']]:[]),...lesson().spaces.map(s=>[`space:${s.id}`,s.name])];
 const value=j.spaceId?`space:${j.spaceId}`:typeof j.recipient==='number'?`player:${j.recipient}`:j.kind==='hold'?'here':'free';
 if(row.length)d.append(field(j.kind==='pass'?'Pe cine sau ce spațiu îl înveți să caute?':'Spațiul comun',row,value,v=>change(q=>{delete q.repeat;delete q.spaceId;delete q.recipient;if(v.startsWith('space:'))setSpace(q,v.slice(6));else if(j.kind==='pass')q.recipient=v==='free'?'free':Number(v.slice(7));state.space=q.spaceId??null;})));
 d.append(button(j.kind==='pass'?'Arată colegul sau spațiul pe teren':'Desenează alt spațiu',()=>{state.picking=j.kind==='pass'?'pass':'new-space';render();},'quiet'));
 }
 if(j.kind==='offer')d.append(field('Rămâne disponibil pentru',[['carrier','Purtătorul mingii'],...[2,3,4,5].filter(i=>i!==state.actor).map(i=>[i,slotLabel(i)])],j.teammate??'carrier',v=>change(q=>q.teammate=v==='carrier'?v:Number(v))));
 if(j.kind==='occupy')d.append(field('Apărătorul pe care îl ocupă',[2,3,4,5].map(i=>[i,`Galben #${i}`]),j.opponent,v=>change(q=>q.opponent=Number(v))));
 if(j.kind==='pass'){
 if(typeof j.recipient==='number'&&!j.spaceId){const l=node('label',undefined,'check'),c=node('input');c.id='repeat-pair';c.type='checkbox';c.checked=!!j.repeat;c.onchange=()=>change(q=>{q.repeat=c.checked;if(c.checked)q.delivery='auto';});l.append(c,node('span','Un-doi repetat: pasează și pleacă pentru retur'));d.append(l);if(j.repeat)d.append(node('p','Ambii caută schimbul și își fac loc pentru retur, până apare șutul sau se rupe combinația.','hint'));}
 const passingOptions=node('details',undefined,'passing-options');passingOptions.append(node('summary',`Tipul pasei: ${{auto:'după situație',ground:'pe jos',loft:'pe sus'}[j.delivery??'auto']}`));passingOptions.append(field('Cum preferă să paseze',[['auto','Alege după situație'],['ground','Pe jos'],['loft','Pe sus']],j.delivery??'auto',v=>change(q=>{q.delivery=v;if(v!=='auto')delete q.repeat;})));
 const l=node('label',undefined,'check'),c=node('input');c.type='checkbox';c.checked=j.fallback!==false;c.onchange=()=>change(q=>q.fallback=c.checked);l.append(c,node('span','Continuă și dacă pasa ajunge la alt coleg'));passingOptions.append(l);
 passingOptions.append(node('p','În momentul următor alegi dacă indicația aparține unui jucător anume sau celui care primește.','hint'));d.append(passingOptions);
 }
 if(j.spaceId){const s=lesson().spaces.find(p=>p.id===j.spaceId);if(s){const geometryOptions=node('details',undefined,'space-options');geometryOptions.append(node('summary','Ajustează zona și reperul'));renderSpaceMeaning(s,geometryOptions);const l=node('label','Mărimea spațiului'),r=node('input');r.type='range';r.min='1';r.max='8';r.step='.5';r.value=s.radius;r.setAttribute('aria-label','Mărimea spațiului comun');r.onchange=()=>change(()=>s.radius=Number(r.value));l.append(r);geometryOptions.append(l);const count=lesson().jobs.filter(q=>q.spaceId===s.id).length;geometryOptions.append(node('p',`${s.name} este folosit de ${count} ${count===1?'responsabilitate':'responsabilități'}. Mută centrul pe teren; toate legăturile îl urmează.`,'hint'));d.append(geometryOptions);}}
 }
 const continuation=$('pass-continuation');continuation.replaceChildren();continuation.hidden=j?.kind!=='pass';
 if(j?.kind==='pass'){const receiver=intendedReceiver(j),next=lesson().moments.find(m=>m.cue.kind==='received'&&m.cue.jobId===j.id),b=button(next?'Editează ce urmează după primire':`Când ${typeof receiver==='number'?name(receiver):'colegul'} primește…`,()=>continuePass(j));b.id='continue-pass';b.disabled=!next&&(lesson().moments.length>=8||lesson().jobs.length>=12);continuation.append(b,node('p','După o primire reală. Colegii își continuă cursele.','hint'));}
 const advancedControls=[...d.querySelectorAll(':scope > details')];for(const detail of advancedControls)$('job-advanced').append(detail);$('job-advanced').hidden=!advancedControls.length;
 $('job-sentence').textContent=j?description(j):'Alege o responsabilitate. Poți schimba jucătorul direct pe teren.';$('remove-job').hidden=!job();$('remove-job').textContent=inheritedJob()?'Revino la indicația anterioară':'Elimină indicația';
 const current=lesson().jobs.filter(j=>j.momentId===state.moment),inherited=effectiveJobs(state.moment).filter(j=>j.momentId!==state.moment);
 $('team-jobs').replaceChildren(...[...current,...inherited].map(j=>{const li=node('li',undefined,`team-job${j.momentId!==state.moment?' inherited':''}`),b=button(typeof j.actor==='number'?slotLabel(j.actor,lesson(),true):receiverIdentity(j.actor,lesson(),j.momentId),()=>{state.actor=copy(j.actor);state.space=j.spaceId??null;render();});if(typeof j.actor!=='number')b.classList.add('receiver-label');const text=node('span',description(j));if(j.momentId!==state.moment)text.append(node('small','Continuă din momentul anterior'));li.append(b,text);return li;}));
 $('delete-moment').hidden=m.cue.kind==='start';
}
function ancestors(id,l=lesson(),seen=new Set()){
 const m=l.moments.find(m=>m.id===id);if(!m||seen.has(id)||m.cue.kind==='start')return [];seen.add(id);
 const source=m.cue.jobId?l.jobs.find(j=>j.id===m.cue.jobId):l.jobs.find(j=>j.kind==='advance'&&jobActor(j.actor)===jobActor(m.cue.actor)&&j.momentId!==id);
 const parent=source?.momentId??l.moments.find(m=>m.cue.kind==='start')?.id;return parent?[...ancestors(parent,l,seen),parent]:[];
}
function ancestorJobs(id,l=lesson()){const map=new Map();for(const mid of ancestors(id,l))for(const j of l.jobs.filter(j=>j.momentId===mid))map.set(jobActor(j.actor),j);return [...map.values()];}
function preview(l,mid,setup){
 const poses=copy(setup.poses);if(l.moments.find(m=>m.id===mid)?.entry)return poses;for(const j of ancestorJobs(mid,l)){const raw=l.spaces.find(s=>s.id===j.spaceId),s=raw&&resolvedSpace(raw,l,poses),p=poses.find(p=>p.side===0&&p.number===actorNumber(j.actor,l));if(p&&s&&['advance','run','hold'].includes(j.kind))Object.assign(p,{x:s.x,y:s.y,ghost:true});}return poses;
}
function renderManager(){
 const t=state.view==='replay'?viewTrial():null,coached=t?!!t.coaching:state.manager==='one-two';
 const noCombination=t&&!t.coaching&&!t.input.plans.length;
 $('manager-mode').parentElement.hidden=!!noCombination;
 $('manager-mode').value=coached?'one-two':'lesson';$('manager-mode').disabled=!!t;
 $('pair-controls').hidden=!coached;$('to-board').hidden=!!t||!coached;
 $('emphasis-control').hidden=!!noCombination;const emphasis=t?(state.which==='baseline'?0:Math.round((t.coaching?.emphasis??trialPlan()?.emphasis??1)*100)):state.emphasis;
 $('emphasis').value=emphasis;$('emphasis').disabled=!!t;
 const strength=emphasis===0?'Dezactivat':emphasis<=25?'Ușor':emphasis<=50?'Moderat':emphasis<=75?'Accentuat':'Dominant';
 $('emphasis-value').textContent=`${emphasis} · ${strength}`;$('emphasis').setAttribute('aria-valuetext',`${emphasis} · ${strength}`);
 options($('pair-a'),[2,3,4,5].map(n=>[n,`#${n} ${name(n)}`]),t?.coaching?.carrier??state.pairA);
 options($('pair-b'),[2,3,4,5].filter(n=>n!==(t?.coaching?.carrier??state.pairA)).map(n=>[n,`#${n} ${name(n)}`]),t?.coaching?.partner??state.pairB);
 $('pair-a').disabled=$('pair-b').disabled=!!t;
 $('manager-note').textContent=coached?(emphasis===0?'Indicația este dezactivată. Jucătorii folosesc comportamentul obișnuit, inclusiv un-doiuri când le găsesc singuri.':'Caută partenerul, pleacă pentru retur și repetă până apare un șut. Accentul mai mare favorizează pasele și mișcările acestei combinații. Nu reprezintă un procent de posesii sau de reușită; execuția depinde în continuare de jucători și adversari.'):(emphasis===0?'Ideea este dezactivată. Echipa joacă obișnuit.':'Accentul favorizează deciziile și mișcările cerute. Nu schimbă precizia execuției. Jucătorii se adaptează dacă situația se închide.');
 if(noCombination)$('manager-note').textContent=`Stilul echipei: ${t.input.compareApproach&&state.which==='baseline'?'Echilibrat':t.input.approachName??'Obișnuit'}. Fără combinații personalizate.`;
 if(!t){const tactics=state.fixture.teams[0].tactics;try{const settings=validateApproach(tactics),preset=Object.values(teamApproaches).find(p=>sameApproach(p.settings,settings));$('manager-note').textContent+=` Stil la antrenament: ${preset?.name??'Personalizat'}.`;}catch{}}
 const opposition=t?.input.opposition??state.opposition;options($('opposition'),Object.entries(defensiveApproaches).map(([id,p])=>[id,p.name]),opposition);$('opposition').disabled=!!t;$('opposition-note').textContent=defensiveApproaches[opposition].description+' Aceiași jucători și aceleași abilități.';
 $('match-summary').hidden=!t;
 if(t){const r=result(),c=t.coaching,pair=c?r.players.filter(p=>p.side===c.side&&[c.carrier,c.partner].includes(p.number)).map(p=>p.id):[];
  const passes=r.events.filter(e=>e.kind==='pass'&&pair.includes(e.actor)&&pair.includes(e.target)).length;
  const attempts=(r.playbookSelections??[]).filter(a=>a.planId);const received=(r.coachingNotes??[]).filter(n=>n.kind==='receipt').length;
  $('match-summary').textContent=`${r.teams[0]} ${r.score.join(' – ')} ${r.teams[1]} · ${coached?`${passes} pase încercate între cei doi${state.which!=='baseline'?` · ${received} primiri confirmate`:''}`:progressSummary(attempts)}${state.which==='baseline'?' · Fără combinații':''}`;
 }
}
function render(){
 if(!state.setup)return;const focusId=document.activeElement?.id;for(const control of document.querySelectorAll('#app button,#app select,#app input'))control.disabled=false;const replay=state.view==='replay',preparing=state.view==='prepare';$('match-preparation').hidden=!preparing;$('workspace').hidden=preparing;$('manager').hidden=preparing;$('match-review').hidden=!replay||viewTrial()?.mode!=='match';$('prepare').hidden=preparing||!replay;
 if(preparing){for(const id of ['editing','playback','training','tactic-library','opposition-controls','run','undo','edit','match'])$(id).hidden=true;renderPreparation();if(state.busy)for(const c of document.querySelectorAll('#app button,#app select,#app input'))c.disabled=true;return;}
 $('opposition-controls').hidden=false;if(!replay)previewRecognition();$('event').hidden=!replay;$('editing').hidden=replay;$('playback').hidden=!replay;$('coach-panel').hidden=replay;$('observation').hidden=!replay;$('run').hidden=replay;$('undo').hidden=replay;$('edit').hidden=!replay;$('setup-mode').hidden=replay;$('show-intent').hidden=!replay;$('training').hidden=replay;
 $('plan-name').value=state.plan.name;$('run').disabled=state.busy||(state.manager==='lesson'&&!lesson().jobs.length&&!state.plan.standing?.length);$('match').hidden=replay;$('match').disabled=$('run').disabled;$('undo').disabled=state.busy||!state.undo.length;$('another').disabled=$('run').disabled;$('edit').disabled=state.busy;
 $('setup-controls').hidden=!state.setupMode||replay;$('setup-mode').textContent=state.setupMode?'Înapoi la indicații':'Așază jucătorii';
 $('seed').value=state.seed;$('scene').value=state.scene;options($('ball-owner'),[2,3,4,5].map(n=>[n,`#${n} ${name(n)}`]),state.setup.ball.number);
 $('sketch-label').hidden=replay||moment().cue.kind==='start'||!!moment().entry;
 if(!replay){renderMoments();renderEntry();renderCoach();renderStanding();$('board-title').textContent=cueText(moment());renderSpaces();}
 else renderReplay(true);
 $('board-hint').textContent=replay?'Selectează un moment din explicații pentru a vedea intenția și situația reală.':state.setupMode?'Trage orice jucător într-o poziție de pornire. Adversarii vor decide singuri după start.':state.picking==='opponent'?'Selectează un apărător galben. Jucătorul tău va încerca să-i ocupe atenția.':state.picking==='pass'?'Selectează un coleg sau un spațiu existent. Poți desena și un spațiu nou.':state.picking?'Trage pe teren pentru a alege spațiul. Centrul poate fi mutat apoi, împreună cu toate legăturile.':'Selectează un jucător. Trage centrul unui spațiu pentru a muta toate indicațiile legate de el.';
 renderManager();renderLibrary();renderRecognition();if(state.manager==='one-two'){$('editing').hidden=true;$('coach-panel').hidden=true;$('shared-spaces').hidden=true;$('recognition-preview').hidden=true;$('sketch-label').hidden=true;}else $('shared-spaces').hidden=false;if(!replay&&state.manager==='one-two'){$('board-title').textContent=`${name(state.pairA)} ↔ ${name(state.pairB)}`;$('board-hint').textContent='Alege perechea de mai sus. Poți muta jucătorii pentru o probă sau porni un meci de la centru.';}if(state.busy)for(const c of document.querySelectorAll('#app button,#app select,#app input'))c.disabled=true;draw();if(focusId&&$(focusId)&&!$(focusId).disabled&&$(focusId).getClientRects().length)$(focusId).focus({preventScroll:true});
}
const standingNames={'press':'Presează purtătorul','mark':'Marchează un adversar','protect':'Protejează o zonă','stay-forward':'Rămâi avansat pentru ieșire'};
function renderStanding(){
 const box=$('standing-fields');box.replaceChildren();
 if(typeof state.actor!=='number'){box.append(node('p','Selectează un jucător din #2–#5 pentru o indicație persistentă.','hint'));return;}
 const n=state.actor,j=state.plan.standing?.find(j=>j.actor===n);
 box.append(node('p',`Doar #${n} ${name(n)}. Ce face fără minge, dincolo de combinație?`,'hint'));
 const change=fn=>edit(()=>fn(state.plan.standing.find(q=>q.actor===n)));
 box.append(field('Responsabilitate persistentă',[['','Joc obișnuit'],...Object.entries(standingNames)],j?.kind??'',kind=>edit(()=>{
  state.plan.standing=(state.plan.standing??[]).filter(q=>q.actor!==n);if(!kind)return;
  const next={id:uid(),actor:n,kind,phase:kind==='stay-forward'?'always':'defending'};
  if(kind==='mark')next.opponent=5;
  if(kind==='protect'||kind==='stay-forward')next.spaceId=addSpace(kind==='protect'?{x:10,y:0}:{x:39,y:pose(n)?.y??0});
  state.plan.standing.push(next);
 })));
 if(!j)return;
 if(j.kind==='mark')box.append(field('Adversarul urmărit',[2,3,4,5].map(n=>[n,`Galben #${n}`]),j.opponent,value=>change(q=>q.opponent=Number(value))));
 if(j.spaceId){
  box.append(field('Zona',lesson().spaces.map(s=>[s.id,s.name]),j.spaceId,value=>change(q=>q.spaceId=value)));
  box.append(button('Alege zona pe teren',()=>{state.space=j.spaceId;state.picking=`standing:${j.id}`;render();},'quiet'));
  const area=lesson().spaces.find(s=>s.id===j.spaceId),label=node('label','Mărimea zonei'),range=node('input');range.type='range';range.min=1.5;range.max=7;range.step=.5;range.value=area.radius;range.onchange=()=>edit(()=>area.radius=Number(range.value));label.append(range);box.append(label);
  box.append(field('Când se aplică',[['defending','Când apărăm'],['always','Tot timpul fără minge']],j.phase,value=>change(q=>q.phase=value)));
 }
 box.append(node('p','Accentul tactic schimbă cât de des urmează indicația într-o fază. La 100 o urmărește ori de câte ori se aplică. Primirea mingii și recuperarea fizică au prioritate.','hint'));
}
function renderSpaces(){const l=state.view==='replay'?trialPlan()?.lesson??lesson():lesson();$('shared-spaces').replaceChildren(...l.spaces.filter(s=>[...l.jobs,...(state.view==='replay'?trialPlan()?.standing??[]:state.plan.standing??[])].some(j=>j.spaceId===s.id)).map(s=>{const count=[...l.jobs,...(state.view==='replay'?trialPlan()?.standing??[]:state.plan.standing??[])].filter(j=>j.spaceId===s.id).length,b=button('',()=>{state.space=s.id;draw();});b.append(node('i'),node('span',`${s.name} · ${count} ${count===1?'legătură':'legături'}`));return b;}));}
function viewTrial(){return state.which==='previous'?state.previous:state.last;}
function result(){const t=viewTrial();return state.which==='baseline'?t?.baseline:t?.plan;}
const progressLabels={recognised:'Doar recunoscută',pursued:'Pusă în mișcare',attempted:'Execuție încercată'};
function progressSummary(rows){const counts={recognised:0,pursued:0,attempted:0};for(const a of rows)counts[playbookProgress(a)]++;return `${counts.attempted} cu execuție încercată · ${counts.pursued} puse în mișcare · ${counts.recognised} doar recunoscute`;}
function attempts(){return (result()?.playbookSelections??[]).filter(a=>a.planId);}
function entries(){const a=attempts()[state.attempt];return a?.trace??[];}
function attemptIsCurrent(){const a=attempts()[state.attempt];return !!a&&state.time>=a.time&&state.time<=(a.endedAt??result().duration);}
function recordedActor(j,players,time){
 if(typeof j.actor==='number')return players.find(p=>p.side===0&&p.number===(activeRecognition()?.bindings?.[j.actor]??j.actor));
 const observed=entries().findLast(e=>e.time<=time&&e.stepId===j.id&&e.actor),receipt=entries().findLast(e=>e.time<=time&&e.stepId===j.actor.receiverOf&&e.phase==='received');
 return players.find(p=>p.id===(observed?.actor??receipt?.target));
}
function decisionEvidence(e,r){
 const facts=[],v=e.evidence;if(!v)return facts;
 const who=id=>{const p=r.players.find(p=>p.id===id);return p?`${p.side===0?'roz':'galben'} #${p.number}`:'un jucător';};
 if(v.entry?.independent)facts.push('Momentul a început din situația prezentă. Pasa anterioară nu a fost presupusă.');const cue=v.cue;if(cue?.kind==='pressed'&&cue.opponent){const gap=Number.isFinite(cue.distance)?` la ${cue.distance.toFixed(1).replace('.',',')} m`:'';facts.push(`La ${(e.momentTime??e.time).toFixed(1).replace('.',',')} s, ${who(cue.opponent)} ${cue.closingSpeed>.35?'se apropia de':'era lângă'} ${who(cue.actor)}${gap}. Acesta a declanșat momentul comun.`);}
 else if(cue?.kind==='received'){const receipt=entries().findLast(q=>q.stepId===cue.jobId&&q.phase==='received'&&q.time<=e.time);if(receipt?.target)facts.push(`Pasa a ajuns efectiv la ${who(receipt.target)}. Continuarea urmărește acest primitor dacă ai ales rolul „cine primește”.`);}
 const action=o=>{const label=({pass:'pasă',through:'pasă în adâncime',loft:'pasă pe sus',carry:'avansare cu mingea',shoot:'șut',shot:'șut',feint:'dribling',clear:'degajare',shield:'protejarea mingii',offer:'poziție de sprijin',show:'poziție de sprijin',run:'cursă',occupy:'poziție lângă apărător',hold:'menținerea zonei',advance:'avansare'})[o.kind]??'altă soluție';return `${label}${o.target?` spre ${who(o.target)}`:''}`;};
 if(v.chosen)facts.push(`A ales: ${action(v.chosen)}.`);
 if(v.reference)facts.push(`Ajustează poziția față de ${who(v.reference)}.`);
 const alternatives=[...new Set((v.options??[]).filter(o=>!v.chosen||o.kind!==v.chosen.kind||o.target!==v.chosen.target).map(action))].slice(0,2);if(v.chosen&&alternatives.length)facts.push(`A mai evaluat: ${alternatives.join('; ')}.`);
 return facts;
}
function renderReplay(force=false){
 const t=viewTrial(),r=result();if(!r)return;const same=state.previous&&JSON.stringify(state.previous.input.setup)===JSON.stringify(state.last.input.setup)&&state.previous.input.seed===state.last.input.seed;
 $('comparison-note').textContent=state.which==='previous'?`Proba anterioară · ${t.input.plans.map(p=>p.name).join(' / ')}. ${same?'Aceleași poziții și aceeași variantă.':'Pozițiile sau varianta diferă între probe.'}`:state.which==='baseline'?'Aceleași poziții inițiale, fără responsabilitățile tale. Jocul poate evolua diferit.':state.previous?`Proba nouă · ${same?'comparabilă cu proba anterioară din aceeași situație':'situație diferită față de proba anterioară'}.`:'Prima probă. Următoarea editare va putea fi comparată cu aceasta.';
 for(const b of $('trial-tabs').querySelectorAll('button')){b.setAttribute('aria-pressed',String(b.dataset.view===state.which));b.disabled=b.dataset.view==='previous'&&!state.previous;}
 if(t.mode==='match')$('comparison-note').textContent=state.which==='baseline'?'Meci de la centru, aceeași variantă, fără indicație. Evoluția poate diferi.':`Meci de 15 minute · ${t.coaching?'Un-doi repetat':t.input.plans.map(p=>p.name).join(' / ')} · Selectează o activare pentru explicații.`;
 const styleCompare=t.input.compareApproach;
 document.querySelector('[data-view="baseline"]').textContent=styleCompare?'Echilibrat':'Fără indicații';
 document.querySelector('[data-view="current"]').textContent=state.last?.input.compareApproach?state.last.input.approachName:'Proba nouă';
 if(t.mode==='match')$('comparison-note').textContent=styleCompare?`${state.which==='baseline'?'Echilibrat':t.input.approachName} · Fără combinații personalizate în ambele meciuri. Aceiași jucători, formație, adversar și variantă; evoluția jocului poate diferi.`:`${t.input.approachName??'Stilul echipei'} · ${state.which==='baseline'?'Fără combinații personalizate':t.input.plans.length?t.input.plans.map(p=>p.name).join(' / '):'Fără combinații personalizate'} · Meci de 15 minute.`;
 $('comparison-note').textContent+=` Adversar: ${defensiveApproaches[t.input.opposition??'original'].name}.`;if(state.previous&&(state.previous.input.opposition??'original')!==(state.last.input.opposition??'original')&&state.which!=='baseline')$('comparison-note').textContent+=' Abordarea adversarului diferă între probe.';
 $('variation-hint').textContent=`Altă variantă păstrează ${state.which==='baseline'?'jocul fără instrucțiuni':'tactica'}, jucătorii și pozițiile de pornire, dar joacă ${t.mode==='match'?'meciul':'faza'} din nou. De la început reia exact proba afișată.`;
 renderManager();
 $('clock').textContent=`${state.time.toFixed(1).replace('.',',')} / ${r.duration} s`;$('seek').max=r.duration;$('seek').value=state.time;$('play').textContent=state.playing?'Pauză':'Redă';
 const f=samplePractice(r,state.time);$('event').hidden=false;$('event').textContent=r.events[f.event]?.text??'';
 const rows=attempts();state.attempt=Math.min(state.attempt,Math.max(0,rows.length-1));
 const sig=`${state.which}:${state.attempt}:${state.last?.serial}:${state.previous?.serial}`;
 if(force||sig!==state.traceKey){renderMatchReview();state.traceKey=sig;options($('attempt'),rows.map((a,i)=>[i,`${i+1} · ${a.time.toFixed(1)} s · ${progressLabels[playbookProgress(a)]} · ${a.name}`]),state.attempt);$('attempt-label').hidden=rows.length<2;
 const a=rows[state.attempt];
 renderAttemptEntry(a,trialPlan().lesson);const trace=entries();$('trace').replaceChildren(...trace.map((e,i)=>{if(e.phase==='skipped')return null;const li=node('li');li.dataset.phase=e.phase;const b=button('',()=>{stop();state.selectedTrace=i;state.time=e.time;renderReplay();draw();});b.dataset.trace=i;b.append(node('time',`${e.time.toFixed(1)} s`));const label=node('span');label.append(node('strong',e.text));if(e.momentId){const m=trialPlan().lesson?.moments.find(m=>m.id===e.momentId);if(m)label.append(node('small',e.evidence?.entry?.independent?'Intrare directă din situația observată':cueText(m,trialPlan().lesson)));}b.append(label);li.append(b);return li;}).filter(Boolean));const skipped=trace.filter(e=>e.phase==='skipped');if(skipped.length)$('attempt-entry').append(node('p',`${skipped.length} indicații din momentele anterioare au fost omise.`,'hint'));renderSpaces();}
 const shown=rows[state.attempt];$('attempt-note').textContent=shown?`${progressLabels[playbookProgress(shown,state.time)]}. ${attemptIsCurrent()?'Ideea este activă acum.':state.time<shown.time?'Încercarea selectată nu a început încă.':'Încercarea selectată s-a încheiat; vezi jocul de după ea.'} Interval: ${shown.time.toFixed(1)}–${(shown.endedAt??r.duration).toFixed(1)} s. Istoricul de mai jos aparține acestei activări. Execuție încercată înseamnă pasa sau șutul cerut, nu o reușită garantată.`:'Jucătorii decid după comportamentul lor obișnuit.';
 const activeNow=(r.playbookSelections??[]).filter(a=>a.planId&&a.time<=state.time&&state.time<(a.endedAt??r.duration));
 if(activeNow.length)$('attempt-note').textContent+=` Active pe teren: ${activeNow.map(a=>a.name).join(' + ')}.`;
 if(shown?.endedAt!==undefined&&state.time>=shown.endedAt&&shown.endDetail)$('attempt-note').textContent+=` Motivul încheierii: ${shown.endDetail}`;
 const latestCandidates=new Map();for(const a of r.playbookSelections??[]){if(a.time>state.time)break;for(const c of a.candidates??[])latestCandidates.set(c.id,c);}
 const waiting=[...latestCandidates.values()].filter(c=>c.fit>0&&!activeNow.some(a=>a.planId===c.id)&&c.blockedBy?.some(id=>activeNow.some(a=>a.planId===id)));
 if(waiting.length)$('attempt-note').textContent+=` Așteaptă participanți: ${waiting.map(c=>`${c.name} (${c.blockedBy.filter(id=>activeNow.some(a=>a.planId===id)).map(id=>activeNow.find(a=>a.planId===id).name).join(', ')})`).join('; ')}.`;
 const lastCheck=(r.playbookSelections??[]).findLast(a=>a.time<=state.time&&a.status==='fallback');
 if(!activeNow.length&&lastCheck)$('attempt-note').textContent+=` La ultima verificare (${lastCheck.time.toFixed(1)} s): ${lastCheck.candidates.filter(c=>!c.blockedBy?.length).map(c=>`${c.name}: ${c.reason}`).join(' ')||lastCheck.reason}`;
 for(const b of $('trace').querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.trace)===state.selectedTrace));
 const standingNow=new Map();for(const n of r.standingNotes??[]){if(n.time>state.time)break;standingNow.set(n.planId+':'+n.instructionId,n);}
 const persistent=$('standing-observation');persistent.replaceChildren();if(!shown&&standingNow.size&&!t.input.plans.some(p=>p.lesson?.jobs.length||p.steps?.length||p.instructions?.length))$('attempt-note').textContent='Nu există o combinație activă. Indicațiile persistente sunt explicate mai jos.';if(standingNow.size){persistent.append(node('h3','Indicații persistente'));if(f.restart)persistent.append(node('p','La reluare, jucătorii își ocupă pozițiile pentru minge; indicațiile revin în joc deschis.','hint'));for(const n of f.restart?[]:standingNow.values())persistent.append(node('p',`${n.status==='active'?'În lucru':n.status==='waiting'?'Așteaptă':'Inactivă'} · ${n.text}`,'hint'));}
 const e=entries()[state.selectedTrace],d=$('decision');d.hidden=!e;d.replaceChildren();if(e){d.append(node('p',e.text));const l=trialPlan().lesson,j=l?.jobs.find(j=>j.id===e.stepId);if(j)d.append(node('small',`${actorText(j.actor,l)}: ${description(j,l)}`));for(const fact of decisionEvidence(e,r))d.append(node('p',fact,'evidence-fact'));const blockers=e.evidence?.blockers;if(blockers?.length){const ul=node('ul');for(const b of blockers)ul.append(node('li',typeof b==='string'?b:b.text));d.append(ul);}}
 $('board-title').textContent=e?.momentId?cueText(trialPlan().lesson.moments.find(m=>m.id===e.momentId),trialPlan().lesson):'Proba pe teren';
}
function tick(now){if(!state.playing)return;state.time=Math.min(result().duration,state.time+Math.min(.12,(now-state.lastTick)/1000)*state.speed);state.lastTick=now;renderReplay();draw();if(state.time<result().duration)state.raf=requestAnimationFrame(tick);else{stop();renderReplay();}}
function geometry(){const c=$('board'),w=c.clientWidth,h=c.clientHeight,scale=Math.min((w-40)/50,(h-54)/30);return{w,h,scale,ox:(w-48*scale)/2,oy:h/2+8};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function point(e){const rect=$('board').getBoundingClientRect(),g=geometry();return {x:clamp((e.clientX-rect.left-g.ox)/g.scale,.8,47.2),y:clamp((e.clientY-rect.top-g.oy)/g.scale,-14,14)};}
function arrow(ctx,g,a,b,kind,selected=false){ctx.strokeStyle=ctx.fillStyle=selected?colors.paper:colors.teal;ctx.lineWidth=(selected?2.3:1.6)/g.scale;ctx.setLineDash(kind==='run'?[.6,.4]:kind==='offer'?[.12,.35]:kind==='advance'?[.3,.2]:[]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);const angle=Math.atan2(b.y-a.y,b.x-a.x),size=.75;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-size*Math.cos(angle-.5),b.y-size*Math.sin(angle-.5));ctx.lineTo(b.x-size*Math.cos(angle+.5),b.y-size*Math.sin(angle+.5));ctx.closePath();ctx.fill();}
function draw(){
 if(!state.setup||$('app').hidden)return;const canvas=$('board'),g=geometry(),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(g.w*dpr);canvas.height=Math.round(g.h*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#14594f';ctx.fillRect(0,0,g.w,g.h);ctx.save();ctx.translate(g.ox,g.oy);ctx.scale(g.scale,g.scale);ctx.fillStyle='#175d53';for(let i=0;i<6;i++)ctx.fillRect(i*8,-15,4,30);ctx.strokeStyle='#88b9ad';ctx.lineWidth=1/g.scale;ctx.strokeRect(0,-15,48,30);ctx.beginPath();ctx.moveTo(24,-15);ctx.lineTo(24,15);ctx.stroke();ctx.beginPath();ctx.arc(24,0,5,0,Math.PI*2);ctx.stroke();
 for(const side of [0,1]){ctx.save();if(side){ctx.translate(48,0);ctx.scale(-1,1);}ctx.strokeRect(0,-8,8,16);ctx.strokeRect(0,-4.5,3,9);ctx.strokeRect(-1,-2.5,1,5);ctx.beginPath();ctx.arc(6,0,.13,0,Math.PI*2);ctx.fillStyle='#bdd7cc';ctx.fill();ctx.beginPath();const a=Math.acos(2/5);ctx.arc(6,0,5,-a,a);ctx.stroke();ctx.restore();}
 const replay=state.view==='replay',t=replay?viewTrial():null,r=replay?result():null,f=r?samplePractice(r,state.time):null,l=replay?(trialPlan()?.lesson??lesson()):lesson();let mid=state.moment;
 if(replay){const ev=entries()[state.selectedTrace]??entries().findLast(e=>e.time<=state.time&&e.momentId);mid=ev?.momentId??l.moments[0].id;}
 const positions=f?f.players.map((p,i)=>({...r.players[f.lineup?.[i]??i],...p})):(state.setupMode||state.manager==='one-two'?state.setup.poses:preview(l,mid,state.setup)).map(p=>({...state.players.find(q=>q.side===p.side&&q.number===p.number),...p}));
 const b=f?{...f.ball}:{...state.setup.ball,z:0};if(!f&&!state.setupMode&&state.manager!=='one-two'){const m=l.moments.find(m=>m.id===mid);const expected=plannedCarrier(mid,l);if(!m?.entry&&expected!==null)b.number=boundNumber(expected,l)??expected;}const owner=f?positions.find(p=>p.id===b.owner):positions.find(p=>p.side===b.side&&p.number===b.number);if(!f&&!state.setupMode&&owner)Object.assign(b,{x:owner.x+.62,y:owner.y});
 if(state.drag?.pose){const p=positions.find(p=>p.side===state.drag.pose.side&&p.number===state.drag.pose.number);Object.assign(p,state.drag.point);if(p===owner)Object.assign(b,{x:p.x+.62,y:p.y});}
 if((!replay||state.overlay&&attemptIsCurrent())&&!(replay?t?.coaching:state.manager==='one-two')){
 const continuing=replay&&activeRecognition()?.independent?l.jobs.filter(j=>activeRecognition().continuingJobs?.includes(j.id)).map(j=>({...j,momentId:activeRecognition().momentId})):[];
 const activeJobs=[...l.jobs.filter(j=>j.momentId===mid&&!continuing.some(c=>c.id===j.id)),...continuing.filter(j=>j.momentId===mid)],old=(l.moments.find(m=>m.id===mid)?.entry||replay&&activeRecognition()?.independent?[]:ancestorJobs(mid,l)).filter(a=>!activeJobs.some(j=>jobActor(j.actor)===jobActor(a.actor))),visible=[...old,...activeJobs].filter(j=>!replay||!activeRecognition()?.allowedMoments||activeRecognition().allowedMoments.includes(j.momentId));
 const standing=replay?(trialPlan()?.standing??[]):(state.plan.standing??[]);
 for(const s0 of l.spaces.filter(s=>visible.some(j=>j.spaceId===s.id)||standing.some(j=>j.spaceId===s.id))){const s=state.drag?.space===s0.id?{...s0,...state.drag.point}:resolvedSpace(s0,l,positions);if(!Number.isFinite(s.x)||!Number.isFinite(s.y))continue;ctx.fillStyle='#37d3c01b';ctx.strokeStyle=s.id===state.space?colors.paper:colors.teal;ctx.lineWidth=1.3/g.scale;ctx.setLineDash([.4,.3]);ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(s.x,s.y,.4,0,Math.PI*2);ctx.fillStyle=colors.teal;ctx.fill();ctx.font=`${Math.max(.7,10/g.scale)}px Verdana`;ctx.textAlign='center';ctx.fillStyle=colors.paper;ctx.fillText(s.name,s.x,s.y-s.radius-.55);}
 if(!replay)for(const j of standing){const a=positions.find(p=>p.side===0&&p.number===j.actor),area=l.spaces.find(s=>s.id===j.spaceId);if(a&&area)arrow(ctx,g,a,resolvedSpace(area,l,positions),'offer',state.actor===j.actor);}
 for(const j of visible){const a=replay?recordedActor(j,positions,state.time):positions.find(p=>p.side===0&&p.number===actorNumber(j.actor,l));if(!a)continue;const raw=l.spaces.find(s=>s.id===j.spaceId),s=raw&&resolvedSpace(raw,l,positions);let dest=s?state.drag?.space===s.id?state.drag.point:s:j.kind==='pass'&&typeof j.recipient==='number'?positions.find(p=>p.side===0&&p.number===(boundNumber(j.recipient,l)??j.recipient)):j.kind==='offer'?positions.find(p=>p.side===0&&p.number===(j.teammate==='carrier'||!j.teammate?owner?.number:boundNumber(j.teammate,l)??j.teammate)):j.kind==='occupy'?positions.find(p=>p.side===1&&p.number===j.opponent):j.kind==='shoot'?{x:48,y:0}:null;if(dest){ctx.globalAlpha=j.momentId!==mid ? .35 : .85;arrow(ctx,g,a,dest,j.kind,jobActor(j.actor)===jobActor(state.actor)&&!replay);ctx.globalAlpha=1;}}
 }
 if(replay&&state.overlay&&attemptIsCurrent()&&state.selectedTrace!==null){const e=entries()[state.selectedTrace],origin=positions.find(p=>p.id===e?.actor),aim=e?.evidence?.chosen?.aim??e?.evidence?.aim;if(origin&&aim)arrow(ctx,g,origin,aim,'pass',true);}
 if(state.drag?.new){const a=positions.find(p=>p.side===0&&p.number===actorNumber(state.actor));if(a)arrow(ctx,g,a,state.drag.point,displayedJob()?.kind??'run',true);}
 for(const p of positions){const radius=Math.max(.65,8.5/g.scale),keeper=p.number===1,active=!replay&&!state.setupMode&&p.side===0&&p.number===actorNumber(state.actor);ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=p.ghost?.65:1;ctx.lineWidth=1.8/g.scale;ctx.strokeStyle='#08241f';ctx.fillStyle=p.side?(keeper?colors.awayKeeper:colors.away):(keeper?colors.homeKeeper:colors.home);ctx.beginPath();if(keeper)ctx.rect(-radius,-radius,2*radius,2*radius);else ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=colors.paper;ctx.beginPath();ctx.moveTo(Math.cos(p.angle)*radius,Math.sin(p.angle)*radius);ctx.lineTo(Math.cos(p.angle)*radius*1.6,Math.sin(p.angle)*radius*1.6);ctx.stroke();if(active){ctx.beginPath();ctx.arc(0,0,radius+.3,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#081813';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${Math.max(.75,11/g.scale)}px Verdana`;ctx.fillText(p.number,0,0);ctx.restore();}
 const height=Math.max(0,b.z||0);if(height>.15){ctx.beginPath();ctx.ellipse(b.x,b.y,.28,.16,0,0,Math.PI*2);ctx.fillStyle='#08241f99';ctx.fill();}ctx.beginPath();ctx.arc(b.x,b.y-Math.min(height,5)*.6,Math.max(.19,3/g.scale),0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#0a3028';ctx.lineWidth=1/g.scale;ctx.stroke();ctx.restore();
 const label=replay?owner:positions.find(p=>p.side===0&&p.number===actorNumber(state.actor));if(label){ctx.font='bold 11px Verdana';const text=label.name,w=ctx.measureText(text).width+14,x=clamp(g.ox+label.x*g.scale-w/2,4,g.w-w-4),y=clamp(g.oy+label.y*g.scale-36,26,g.h-25);ctx.fillStyle='#0b201fe8';ctx.fillRect(x,y,w,23);ctx.fillStyle=colors.paper;ctx.textBaseline='middle';ctx.fillText(text,x+7,y+12);}
}
function boardPositions(){return state.setupMode?state.setup.poses:preview(lesson(),state.moment,state.setup);}
function nearest(point,filter=()=>true){return boardPositions().filter(filter).sort((a,b)=>dist(a,point)-dist(b,point))[0];}
function hitSpace(point){return lesson().spaces.filter(s=>dist(resolvedSpace(s),point)<s.radius).sort((a,b)=>dist(resolvedSpace(a),point)-dist(resolvedSpace(b),point))[0];}
$('board').addEventListener('pointerdown',e=>{
 if(state.view!=='edit'||state.busy)return;const p=point(e),g=geometry(),near=nearest(p),onPlayer=near&&dist(near,p)*g.scale<19;
 if(state.setupMode){if(!onPlayer)return;state.drag={id:e.pointerId,start:p,point:p,pose:{side:near.side,number:near.number},moved:false};}
 else if(state.picking?.startsWith('standing:')||state.picking==='pass'||state.picking==='opponent'||state.picking==='new-space'){state.drag={id:e.pointerId,start:p,point:p,new:true,moved:false,pick:state.picking};}
 else{
 const space=lesson().spaces.find(s=>dist(resolvedSpace(s),p)*g.scale<15);
 if(space){state.space=space.id;state.drag={id:e.pointerId,start:p,point:p,space:space.id,moved:false};}
 else if(onPlayer&&near.side===0&&near.number!==1){state.actor=slotForNumber(near.number);state.space=displayedJob()?.spaceId??null;state.drag={id:e.pointerId,start:p,point:p,new:true,moved:false,player:near.number};render();}
 else if(state.picking==='space'){state.drag={id:e.pointerId,start:p,point:p,new:true,moved:false,pick:'space'};}
 else return;
 }
 $('board').setPointerCapture(e.pointerId);draw();
});
$('board').addEventListener('pointermove',e=>{const d=state.drag;if(!d||d.id!==e.pointerId)return;d.point=point(e);d.moved ||=dist(d.start,d.point)*geometry().scale>5;draw();});
$('board').addEventListener('pointerup',e=>{
 const d=state.drag;if(!d)return;state.drag=null;const p=point(e);
 if(d.pose){if(d.moved)edit(()=>{const target=state.setup.poses.find(q=>q.side===d.pose.side&&q.number===d.pose.number);Object.assign(target,p);if(target.side===0&&target.number===state.setup.ball.number)Object.assign(state.setup.ball,{x:target.x+.62,y:target.y});state.scene='custom';},'Poziție de pornire schimbată.');draw();return;}
 if(d.space){if(d.moved)edit(()=>setSpacePoint(lesson().spaces.find(s=>s.id===d.space),p),'Spațiul comun s-a mutat. Toate responsabilitățile legate de el îl urmează.');draw();return;}
 if(!d.moved&&!d.pick){draw();return;}
 if(d.pick?.startsWith('standing:')){edit(()=>{const j=state.plan.standing?.find(j=>j.id===d.pick.slice(9)),area=lesson().spaces.find(s=>s.id===j?.spaceId);if(area)setSpacePoint(area,p);state.picking=null;},'Zona indicației persistente a fost mutată.');return;}
 let j=displayedJob();if(!j&&d.moved){chooseKind(actorNumber(state.actor)===state.setup.ball.number?'advance':'run');j=job();}if(!j)return;
 const target=nearest(p,q=>q.number!==1),close=target&&dist(target,p)*geometry().scale<20,zone=hitSpace(p);
 edit(()=>{
 j=localJob();
 if(j.kind==='occupy'||d.pick==='opponent'){if(close&&target.side===1){j.opponent=target.number;state.picking=null;}else throw Error('Selectează un apărător galben.');}
 else if(j.kind==='pass'||d.pick==='pass'){
 if(close&&target.side===0&&target.number!==actorNumber(j.actor)){const slot=slotForNumber(target.number),runner=effectiveJobs(state.moment).find(q=>q.actor===slot&&q.kind==='run');if(runner)linkPassToRunner(j,runner);else{j.recipient=slot;delete j.spaceId;delete j.repeat;state.space=null;}}else if(zone)setSpace(j,zone.id);
 else setSpace(j,addSpace(p));state.picking=null;
 }else if(['advance','run','hold'].includes(j.kind)){
 if(d.pick==='new-space'||!j.spaceId)setSpace(j,addSpace(p));else{setSpacePoint(lesson().spaces.find(s=>s.id===j.spaceId),p);state.space=j.spaceId;}state.picking=null;
 }
 },'Legătură salvată. Poți muta spațiul comun și încerca din nou.');
});
$('board').addEventListener('pointercancel',()=>{state.drag=null;draw();});
function removeJobs(ids){
 const removed=new Set(ids);let changed=true;while(changed){changed=false;for(const j of lesson().jobs)if(!removed.has(j.id)&&typeof j.actor!=='number'&&removed.has(j.actor.receiverOf)){removed.add(j.id);changed=true;}
 for(const m of lesson().moments)if(m.cue.jobId&&removed.has(m.cue.jobId)){for(const j of lesson().jobs.filter(j=>j.momentId===m.id))if(!removed.has(j.id)){removed.add(j.id);changed=true;}}}
 lesson().moments=lesson().moments.filter(m=>!m.cue.jobId||!removed.has(m.cue.jobId));lesson().jobs=lesson().jobs.filter(j=>!removed.has(j.id));if(!lesson().moments.some(m=>m.id===state.moment))state.moment=lesson().moments[0].id;
}
$('remove-job').onclick=()=>{const j=job();if(j)edit(()=>{removeJobs([j.id]);state.picking=null;},'Responsabilitate și continuările ei eliminate. Poți anula editarea.');};
$('delete-moment').onclick=()=>edit(()=>{const id=state.moment;removeJobs(lesson().jobs.filter(j=>j.momentId===id).map(j=>j.id));lesson().moments=lesson().moments.filter(m=>m.id!==id);state.moment='start';},'Moment eliminat. Poți anula editarea.');
$('add-moment').onclick=()=>{state.editingMoment=null;$('confirm-moment').textContent='Adaugă momentul';$('moment-editor').hidden=false;renderCueEditor();};
$('edit-moment').onclick=()=>{state.editingMoment=state.moment;$('moment-editor').hidden=false;$('cue-kind').value=moment().cue.kind;renderCueEditor();$('cue-reference').value=String(moment().cue.actor??moment().cue.jobId);$('confirm-moment').textContent='Păstrează momentul';};$('cancel-moment').onclick=()=>{$('moment-editor').hidden=true;};$('cue-kind').onchange=renderCueEditor;
$('confirm-moment').onclick=()=>{
 const kind=$('cue-kind').value,value=$('cue-reference').value,id=state.editingMoment??uid();const cue=kind==='pressed'?{kind,actor:Number(value)}:{kind,jobId:value};
 if(edit(()=>{const m={id,name:'Moment comun',cue};m.name=cueText(m);const existing=lesson().moments.findIndex(m=>m.id===id);if(existing>=0)lesson().moments[existing]={...lesson().moments[existing],...m};else lesson().moments.push(m);state.moment=id;state.picking=null;const source=lesson().jobs.find(j=>j.id===cue.jobId);state.actor=kind==='received'&&source?{receiverOf:source.id}:kind==='pressed'?Number(value):3;},'Moment comun adăugat. Alege ce face fiecare jucător când apare.'))$('moment-editor').hidden=true;
};
$('job-actor').onchange=()=>{const j=job(),actor=readActor($('job-actor').value);if(j)edit(()=>{j.actor=actor;state.actor=copy(actor);});else{state.actor=actor;render();}};
$('setup-mode').onclick=()=>{state.setupMode=!state.setupMode;state.picking=null;render();};$('setup-done').onclick=()=>{state.setupMode=false;render();};
$('ball-owner').onchange=()=>edit(()=>{const p=pose(Number($('ball-owner').value));p.angle=0;state.setup.ball={side:0,number:p.number,x:p.x+.62,y:p.y};},'Purtătorul de la început s-a schimbat.');
$('opposition').onchange=()=>edit(()=>{state.opposition=$('opposition').value;},'Abordarea adversarului s-a schimbat. Încearcă aceeași idee împotriva ei.');
$('scene').onchange=()=>{const scene=$('scene').value;edit(()=>{state.scene=scene;state.setup=createTrainingSetup(scene);},'Situația de pornire s-a schimbat.');};
$('seed').onchange=()=>{const v=clamp(Math.trunc(Number($('seed').value)||0),0,4294967295);edit(()=>state.seed=v,'Variantă schimbată.');};
$('plan-name').onchange=()=>{const v=$('plan-name').value.trim();edit(()=>state.plan.name=v||'Schema mea','Nume salvat.');};
$('undo').onclick=()=>{const before=state.undo.pop();if(!before)return;restoreEditor(before);state.space=null;state.picking=null;save();render();status('Ultima editare a fost anulată.');};
$('blank').onclick=()=>edit(()=>{state.plan=fresh();state.moment='start';state.actor=3;state.space=null;state.picking=null;},'O tablă nouă. Poți reveni cu Anulează editarea.');
function worker(){
 if(state.worker)return state.worker;const w=new Worker('./sandbox-worker.js',{type:'module'});state.worker=w;
 w.onmessage=({data})=>{if(data.request!==state.request)return;if(data.type==='progress'){status(`${data.label} · ${Math.floor(data.seconds/60)} / 15 min calculate…`);return;}clearTimeout(state.timer);state.busy=false;
 if(data.type==='error'){render();status(`Proba nu a putut fi calculată: ${data.message}`,true);return;}
 if(data.type==='trial'||data.type==='match'){state.previous=state.pendingRun.previous;state.last={...data.result,requestInput:state.pendingRun.input,serial:(state.last?.serial??0)+1};state.which=state.pendingRun.view;state.pendingRun=null;state.view='replay';state.setupMode=false;state.entryOpen=false;state.time=0;state.attempt=0;state.selectedTrace=null;state.traceKey='';render();status('Proba e gata. Urmărește ideea, apoi selectează o decizie pentru a o înțelege.');}
 };
 w.onerror=()=>{clearTimeout(state.timer);w.terminate();state.worker=null;state.busy=false;render();status('Motorul nu s-a încărcat. Reîncarcă pagina și încearcă din nou.',true);};return w;
}
function nextSeed(seed){const drawn=crypto.getRandomValues(new Uint32Array(1))[0];return drawn===seed?(seed+1)>>>0:drawn;}
function run(mode='trial',saved=false,source=null){
 if(state.busy||(!source&&!saved&&state.manager==='lesson'&&!lesson().jobs.length&&!state.plan.standing?.length))return;
 const input=source?{...copy(source.requestInput),seed:nextSeed(source.input.seed)}:{type:mode,fixture:copy(state.fixture),opposition:state.opposition,seed:state.seed,scene:state.setup.scene,setup:copy(state.setup),plans:saved?state.library.filter(r=>r.enabled&&r.plan.emphasis>0).map(r=>copy(r.plan)):[editorPlan()]};
 startSimulation(input,source);
}
function startSimulation(input,source=null){
 state.pendingRun={input,previous:source??state.last,view:source&&state.which==='baseline'?'baseline':'current'};
 if(source){state.seed=input.seed;save();}
 stop();state.busy=true;state.picking=null;render();status(source?'Aceeași idee și aceeași așezare. Se joacă o nouă variantă…':'Se joacă ideea ta împotriva adversarilor…');
 worker().postMessage({...input,request:++state.request});
 state.timer=setTimeout(()=>{state.worker.terminate();state.worker=null;state.busy=false;render();status('Calculul s-a oprit. Ideea ta este păstrată; poți reîncerca.',true);},60000);
}
$('retry-variation').onclick=()=>run('trial',false,viewTrial());
$('to-board').onclick=()=>edit(()=>{state.plan=editorPlan();state.manager='lesson';state.moment='start';state.actor=state.pairA;},'Combinația este acum o responsabilitate editabilă pe tablă.');
$('save-tactic').onclick=()=>{try{const plan=validatePlans([editorPlan()])[0],existing=state.library.find(r=>r.plan.id===plan.id);if(existing){existing.plan=plan;existing.lineup=[...state.fixture.teams[0].lineup];}else {if(state.library.length>=12)throw Error('Poți păstra până la 12 tactici.');state.library.push({plan,enabled:true,lineup:[...state.fixture.teams[0].lineup]});}storeLibrary();renderLibrary();$('tactic-library').open=true;status(`Tactica „${plan.name}” este salvată pentru meci.`);}catch(e){status(e.message,true);}};
$('play-saved').onclick=()=>{openPreparation();state.preparation.useBoard=false;savePreparation();renderPreparation();};
$('run').onclick=()=>run();$('match').onclick=()=>openPreparation();
$('manager-mode').onchange=()=>{state.manager=$('manager-mode').value;save();render();};
$('emphasis').oninput=()=>{state.emphasis=Number($('emphasis').value);renderManager();};
$('emphasis').onchange=()=>{state.emphasis=Number($('emphasis').value);save();};
$('pair-a').onchange=()=>{state.pairA=Number($('pair-a').value);if(state.pairA===state.pairB)state.pairB=[2,3,4,5].find(n=>n!==state.pairA);save();render();};
$('pair-b').onchange=()=>{state.pairB=Number($('pair-b').value);save();render();};$('another').onclick=()=>{if(edit(()=>state.seed=nextSeed(state.seed)))run();};
$('edit').onclick=()=>{stop();state.view='edit';state.picking=null;render();status('Modifică ideea. Proba de acum rămâne disponibilă pentru comparație.');};
$('play').onclick=()=>{if(state.playing)stop();else{if(state.time>=result().duration)state.time=0;state.playing=true;state.lastTick=performance.now();state.raf=requestAnimationFrame(tick);}renderReplay();};
$('rewind').onclick=()=>{stop();state.time=0;state.selectedTrace=null;renderReplay();draw();};$('seek').oninput=()=>{stop();state.time=Number($('seek').value);state.selectedTrace=null;renderReplay();draw();};$('speed').onchange=()=>state.speed=Number($('speed').value);
for(const b of $('trial-tabs').querySelectorAll('button'))b.onclick=()=>{stop();state.which=b.dataset.view;state.attempt=0;state.selectedTrace=null;renderReplay(true);draw();};
$('attempt').onchange=()=>{stop();state.attempt=Number($('attempt').value);state.time=attempts()[state.attempt].time;state.selectedTrace=null;renderReplay(true);draw();};
$('show-intent').onclick=()=>{state.overlay=!state.overlay;$('show-intent').setAttribute('aria-pressed',String(state.overlay));draw();};
new ResizeObserver(draw).observe($('board'));document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if(state.view==='replay')renderReplay();}});

const approachKey='football-team-approaches-v1';
let savedApproaches=[];
try{savedApproaches=JSON.parse(localStorage.getItem(approachKey)||'[]').slice(0,12).map(r=>({name:String(r.name).slice(0,60),settings:validateApproach(r.settings)}));}catch{}
const approachFields=[
 ['progression','Progressia cu mingea',[['patient','Pase scurte'],['mixed','După situație'],['direct','Mai direct']]],
 ['transition','După recuperare',[['secure','Asigură prima pasă'],['balanced','După situație'],['counter','Caută contraatacul']]],
 ['width','Lățime',[['narrow','Mai aproape'],['standard','Echilibrată'],['wide','Mai larg']]],
 ['line','Linia defensivă',[['deep','Mai jos'],['standard','Standard'],['high','Mai sus']]],
 ['press','Presing',[['selective','Selectiv'],['balanced','Echilibrat'],['aggressive','Agresiv']]],
 ['striker','Atacantul',[['link','Vine să lege jocul'],['mixed','După situație'],['run','Caută adâncimea']]],
 ['commit','Jucători care se alătură atacului',[[1,'Foarte puțini'],[2,'Mai puțini'],[3,'Echilibrat'],[4,'Mai mulți'],[5,'Foarte mulți']]]
];
const sameApproach=(a,b)=>JSON.stringify(validateApproach(a))===JSON.stringify(validateApproach(b));
function approachName(){const p=state.preparation;const preset=teamApproaches[p.approachPreset]??teamApproaches.balanced;if(p.approachName)return p.approachName;return sameApproach(p.approach,preset.settings)?preset.name:p.approachName||'Stil personalizat';}
function renderApproach(){
 const focused=document.activeElement?.dataset.approachField,focusedPreset=document.activeElement?.dataset.approachPreset;
 const p=state.preparation,presets=$('approach-presets');presets.replaceChildren();
 for(const [id,preset] of Object.entries(teamApproaches)){const b=button(preset.name,()=>{p.approachPreset=id;p.approach=copy(preset.settings);p.approachName='';savePreparation();renderPreparation();});b.dataset.approachPreset=id;b.setAttribute('aria-pressed',String(sameApproach(p.approach,preset.settings)));presets.append(b);}
 const custom=!sameApproach(p.approach,(teamApproaches[p.approachPreset]??teamApproaches.balanced).settings);
 $('approach-description').textContent=custom?`${approachName()} · ${approachFields.map(([key,label,choices])=>`${label}: ${choices.find(([v])=>String(v)===String(p.approach[key]))?.[1]}`).join(' · ')}.`:teamApproaches[p.approachPreset].description;
 $('approach-summary').textContent=custom?'Ajustează stilul · Personalizat':'Ajustează stilul';
 const fields=$('approach-fields');fields.replaceChildren();for(const [key,label,choices] of approachFields){const f=field(label,choices,p.approach[key],value=>{p.approach[key]=key==='commit'?Number(value):value;p.approachName='';savePreparation();renderApproach();});f.querySelector('select').dataset.approachField=key;fields.append(f);}
 options($('saved-approach'),[['','Alege un stil salvat'],...savedApproaches.map((r,i)=>[String(i),r.name])],String(savedApproaches.findIndex(r=>r.name===p.approachName&&sameApproach(r.settings,p.approach))));
 $('approach-name').value=p.approachName||'';$('delete-approach').hidden=!$('saved-approach').value;
 $('compare-approach').disabled=state.busy||sameApproach(p.approach,teamApproaches.balanced.settings);
 $('train-approach').disabled=state.busy;
 if(focused)fields.querySelector(`[data-approach-field="${focused}"]`)?.focus({preventScroll:true});
 if(focusedPreset)presets.querySelector(`[data-approach-preset="${focusedPreset}"]`)?.focus({preventScroll:true});
}
function loadPreparation(){
 const t=state.fixture.teams[0];state.preparation={lineup:[...t.lineup],formation:t.tactics.formation,opposition:state.opposition,seed:state.seed,useBoard:!state.library.some(r=>r.enabled),boardEmphasis:state.emphasis,assignments:{},approachPreset:'balanced',approach:copy(teamApproaches.balanced.settings),approachName:'',combinations:true};
 try{const saved=JSON.parse(localStorage.getItem(matchKey)||'null');if(saved&&formations[saved.formation]&&Array.isArray(saved.lineup)&&saved.lineup.length===5&&new Set(saved.lineup).size===5&&saved.lineup.every((id,i)=>t.squad.some(p=>p.id===id&&(i===0?p.roles.includes('GK'):!p.roles.includes('GK'))))&&Object.hasOwn(defensiveApproaches,saved.opposition))state.preparation={...state.preparation,...saved,seed:Number.isInteger(saved.seed)?saved.seed:2026,assignments:saved.assignments??{}};}catch{}
}
function savePreparation(){try{localStorage.setItem(matchKey,JSON.stringify(state.preparation));}catch{status('Pregătirea rămâne disponibilă în această pagină; browserul nu a putut-o salva.',true);}}
function openPreparation(){if(state.library.some(r=>r.enabled&&r.plan.id===editorPlan().id))state.preparation.useBoard=false;stop();state.view='prepare';state.picking=null;render();status('Alege echipa și ce vrei să încerce. Meciul pornește de la centru.');}
function matchFixture(){const f=copy(state.baseFixture);f.teams[0].lineup=[...state.preparation.lineup];Object.assign(f.teams[0].tactics,validateApproach(state.preparation.approach),{formation:state.preparation.formation});f.seed=state.preparation.seed;return f;}
function preparationRows(){return [...(state.plan.lesson.jobs.length||state.plan.standing?.length||state.manager==='one-two'?[{key:'board',plan:{...editorPlan(),emphasis:state.preparation.boardEmphasis/100},lineup:state.fixture.teams[0].lineup,enabled:state.preparation.useBoard,board:true}]:[]),...state.library.map(r=>({...r,key:r.plan.id}))];}
function planSlots(l,standing=[]){
 const slots=new Set(),add=n=>{if(typeof n==='number')slots.add(n);};
 for(const j of l.jobs){add(j.actor);add(j.recipient);add(j.teammate);}
 for(const j of standing)add(j.actor);
 const spaces=new Set([...l.jobs,...standing].map(j=>j.spaceId));for(const m of l.moments){add(m.cue.actor);if(m.entry){add(m.entry.carrier);for(const c of m.entry.conditions){add(c.runner);spaces.add(c.spaceId);}for(const n of Object.values(m.entry.receiverBindings??{}))add(n);}}
 for(const space of l.spaces)if(spaces.has(space.id)&&space.anchor?.kind==='player')add(space.anchor.number);
 return [...slots];
}
function preparedPlan(row){
 const target=state.preparation.lineup,overrides=state.preparation.assignments[row.key]??{},mapping={},issues=[];
 for(const n of planSlots(row.plan.lesson,row.plan.standing)){const id=overrides[n]??row.lineup[n-1],slot=target.indexOf(id)+1;if(slot<2)issues.push({slot:n,id:row.lineup[n-1],reason:'missing'});else mapping[n]=slot;}
 const values=Object.values(mapping);if(new Set(values).size!==values.length)issues.push({reason:'duplicate'});
 if(issues.length)return {issues};
 const plan=copy(row.plan),l=plan.lesson,number=n=>typeof n==='number'?mapping[n]??n:n;
 for(const j of plan.standing??[])j.actor=number(j.actor);
 for(const j of l.jobs){j.actor=number(j.actor);if(typeof j.recipient==='number')j.recipient=number(j.recipient);if(typeof j.teammate==='number')j.teammate=number(j.teammate);}
 for(const m of l.moments){if(m.cue.kind==='pressed')m.cue.actor=number(m.cue.actor);if(m.entry){m.entry.carrier=number(m.entry.carrier);for(const c of m.entry.conditions)if(typeof c.runner==='number')c.runner=number(c.runner);if(m.entry.receiverBindings)for(const k of Object.keys(m.entry.receiverBindings))m.entry.receiverBindings[k]=number(m.entry.receiverBindings[k]);}}
 for(const space of l.spaces)if(space.anchor?.kind==='player')space.anchor.number=number(space.anchor.number);
 if(l.roles)l.roles=Object.fromEntries(Object.entries(l.roles).map(([n,role])=>[number(Number(n)),role]));
 return {plan:validatePlans([plan])[0],issues};
}
function renderPreparation(){
 const prep=state.preparation,team=state.baseFixture.teams[0],shape=formations[prep.formation],get=id=>team.squad.find(p=>p.id===id);
 renderApproach();$('prep-combinations').checked=prep.combinations!==false;$('prep-tactics').hidden=prep.combinations===false;
 $('prep-title').textContent=`${team.name} contra ${state.baseFixture.teams[1].name}`;
 options($('prep-formation'),Object.entries(formations).map(([v,f])=>[v,f.label]),prep.formation);$('prep-formation-note').textContent=shape.note;
 options($('prep-opposition'),Object.entries(defensiveApproaches).map(([id,p])=>[id,p.name]),prep.opposition);$('prep-opposition-note').textContent=defensiveApproaches[prep.opposition].description;
 $('prep-seed').value=prep.seed;
 const pitch=$('prep-players'),roster=$('prep-roster');pitch.replaceChildren();roster.replaceChildren();
 prep.lineup.forEach((id,i)=>{
  const player=get(id),marker=button('',()=>document.querySelector(`[data-lineup-slot="${i}"]`).focus());marker.style.left=shape.points[i][0]+'%';marker.style.top=shape.points[i][1]+'%';marker.className='prep-player';marker.classList.toggle('keeper',i===0);marker.append(node('b',String(i+1)),node('span',player.name));pitch.append(marker);
  const row=node('div',undefined,'prep-roster-row'),label=field(`#${i+1} · ${shape.slots[i]}`,team.squad.filter(p=>i===0?p.roles.includes('GK'):!p.roles.includes('GK')).map(p=>[p.id,p.name]),id,next=>{const other=prep.lineup.indexOf(next);if(other>=0)prep.lineup[other]=id;prep.lineup[i]=next;savePreparation();renderPreparation();});label.querySelector('select').dataset.lineupSlot=i;
  const stats=i===0?`Portar ${player.skills.keeping} · Pasă ${player.skills.passing}`:`Pasă ${player.skills.passing} · Control ${player.skills.control} · Șut ${player.skills.finishing} · Apărare ${player.skills.defending}`;
  row.append(label,node('p',`${player.temperament??''} · ${stats}`,'hint'));roster.append(row);
 });
 $('prep-bench').textContent=`Pe bancă: ${team.squad.filter(p=>!prep.lineup.includes(p.id)).map(p=>p.name).join(', ')}. Fără schimbări automate în această probă.`;
 const tactics=$('prep-tactics');tactics.replaceChildren();const rows=preparationRows();let invalid=false,active=0;const identities=new Set();
 if(!rows.length)tactics.append(node('p','Poți juca fără indicații sau poți crea prima combinație pe tabla de antrenament.','hint'));
 for(const row of rows){
  const item=node('div',undefined,'prep-tactic'),toggle=node('label',undefined,'check'),check=node('input');check.type='checkbox';check.checked=row.enabled;check.dataset.prepTactic=row.key;check.onchange=()=>{if(row.board)prep.useBoard=check.checked;else state.library.find(r=>r.plan.id===row.key).enabled=check.checked;storeLibrary();savePreparation();renderPreparation();};toggle.append(check,node('span',row.board?`Ideea de pe tablă · ${row.plan.name}`:row.plan.name));item.append(toggle);
  const emphasis=node('label',`Accent · ${Math.round((row.plan.emphasis??1)*100)}`),range=node('input');range.type='range';range.min=0;range.max=100;range.step=5;range.value=Math.round((row.plan.emphasis??1)*100);range.disabled=!row.enabled;range.setAttribute('aria-label',`Accent în meci pentru ${row.plan.name}`);range.oninput=()=>emphasis.firstChild.textContent=`Accent · ${range.value}`;range.onchange=()=>{if(row.board)prep.boardEmphasis=Number(range.value);else state.library.find(r=>r.plan.id===row.key).plan.emphasis=Number(range.value)/100;storeLibrary();savePreparation();renderPreparation();};emphasis.append(range);item.append(emphasis);
  const enabled=prep.combinations!==false&&row.enabled&&row.plan.emphasis>0;
  if(enabled){
   active++;if(identities.has(row.plan.id)){invalid=true;item.append(node('p','Această idee este deja activată de pe tablă. Păstrează o singură versiune activă.','error'));}identities.add(row.plan.id);
   const mapped=preparedPlan(row);if(mapped.issues.length)invalid=true;
   for(const issue of mapped.issues){if(issue.reason==='duplicate'){item.append(node('p','Două responsabilități au fost atribuite aceluiași jucător. Alege înlocuitori diferiți.','error'));continue;}item.append(node('p',`${get(issue.id)?.name??`#${issue.slot}`} nu este în primul cinci. Cine îi preia indicațiile?`,'hint'));item.append(field('Înlocuitor pentru această tactică',[['','Alege un jucător'],...prep.lineup.slice(1).map(id=>[id,get(id).name])],prep.assignments[row.key]?.[issue.slot]??'',id=>{prep.assignments[row.key]??={};if(id)prep.assignments[row.key][issue.slot]=id;else delete prep.assignments[row.key][issue.slot];savePreparation();renderPreparation();}));}
   const changed=planSlots(row.plan.lesson,row.plan.standing).filter(n=>prep.assignments[row.key]?.[n]);for(const n of changed){item.append(field(`Indicațiile lui ${get(row.lineup[n-1])?.name??`#${n}`} pentru`,[['','Jucătorul inițial'],...prep.lineup.slice(1).map(id=>[id,get(id).name])],prep.assignments[row.key][n],id=>{if(id)prep.assignments[row.key][n]=id;else delete prep.assignments[row.key][n];savePreparation();renderPreparation();}));}
  }
  tactics.append(item);
 }
 $('prep-readiness').textContent=invalid?'Rezolvă atribuirea indicațiilor înainte de meci.':active?`${active} ${active===1?'idee activă':'idei active'}. Ideile cu participanți diferiți pot funcționa împreună; cele care cer același jucător așteaptă. Echipa caută ocaziile potrivite.`:`Fără combinații personalizate. Echipa joacă în stilul ${approachName()}.`;
 $('start-match').disabled=invalid||state.busy;
}
function renderMatchReview(){
 const box=$('match-review'),t=viewTrial();box.hidden=state.view!=='replay'||t?.mode!=='match';if(box.hidden)return;box.replaceChildren();const r=result(),home=r.stats[0],away=r.stats[1];box.append(node('h2','Ce s-a întâmplat în meci'));
 const table=node('table'),head=node('tr');for(const text of ['Joc',r.teams[0],r.teams[1]])head.append(node('th',text));table.append(head);
 for(const [label,key] of [['Șuturi','shots'],['Pase reușite','completed'],['Pase încercate','passes'],['Driblinguri încercate','feints']]){const tr=node('tr');tr.append(node('th',label),node('td',String(home[key])),node('td',String(away[key])));table.append(tr);}box.append(table);
 if(state.which!=='baseline')for(const plan of t.input.plans){const attempts=(r.playbookSelections??[]).filter(a=>a.planId===plan.id),receipts=attempts.flatMap(a=>a.trace??[]).filter(e=>e.phase==='received').length;const row=node('div',undefined,'match-plan-review');row.append(node('p',`${plan.name}: ${progressSummary(attempts)} · ${receipts} primiri confirmate în timpul ideii.`),button('Ajustează la antrenament',()=>trainMatchPlan(t,plan)));if(plan.standing?.length){const notes=(r.standingNotes??[]).filter(n=>n.planId===plan.id),first=notes.find(n=>n.status==='active');row.append(node('p',`${plan.standing.length} indicații persistente fără minge. ${first?'Au fost aplicate în joc.':'Nu au fost aplicate în acest meci.'}`,'hint'));if(first)row.append(button('Vezi prima aplicare',()=>{stop();state.time=first.time;state.selectedTrace=null;renderReplay();draw();}));}box.append(row);}
 box.append(node('p',t.input.compareApproach?'Compară stilurile folosind butoanele de deasupra terenului. Combinațiile personalizate sunt oprite în ambele meciuri.':'Compară cu „Fără indicații”: același stil, aceiași jucători, formație, adversar și variantă.','hint'));
}
function trainMatchPlan(t,plan){
 stop();state.fixture=copy(t.requestInput.fixture);state.players=practicePlayers(state.fixture);state.plan=copy(plan);state.manager='lesson';state.emphasis=Math.round((plan.emphasis??1)*100);state.moment=plan.lesson.moments[0].id;state.actor=3;state.opposition=t.input.opposition;state.setup=createTrainingSetup('middle');state.scene='middle';state.seed=t.input.seed;state.undo=[];state.view='edit';state.picking=null;state.space=null;save();render();status('Aceeași echipă și aceleași indicații, pe tabla de antrenament. Mută jucătorii pentru a pregăti situația dorită.');
}
$('prepare').onclick=openPreparation;$('back-to-training').onclick=()=>{state.view='edit';render();};
$('prep-formation').onchange=()=>{state.preparation.formation=$('prep-formation').value;savePreparation();renderPreparation();};
$('prep-opposition').onchange=()=>{state.preparation.opposition=$('prep-opposition').value;savePreparation();renderPreparation();};
$('prep-seed').onchange=()=>{state.preparation.seed=clamp(Math.trunc(Number($('prep-seed').value)||0),0,4294967295);savePreparation();};
$('prep-combinations').onchange=()=>{state.preparation.combinations=$('prep-combinations').checked;savePreparation();renderPreparation();};
$('saved-approach').onchange=()=>{const r=savedApproaches[Number($('saved-approach').value)];if($('saved-approach').value&&r){state.preparation.approach=copy(r.settings);state.preparation.approachName=r.name;savePreparation();renderApproach();}};
$('save-approach').onclick=()=>{const name=$('approach-name').value.trim();if(!name){status('Alege un nume pentru stilul tău.',true);return;}const r={name,settings:validateApproach(state.preparation.approach)},i=savedApproaches.findIndex(r=>r.name===name);if(i<0&&savedApproaches.length>=12){status('Poți păstra până la 12 stiluri. Înlocuiește unul folosind același nume.',true);return;}try{const next=copy(savedApproaches);if(i>=0)next[i]=r;else next.push(r);localStorage.setItem(approachKey,JSON.stringify(next));savedApproaches=next;state.preparation.approachName=name;savePreparation();renderApproach();status(`Stilul „${name}” este salvat în acest browser.`);}catch{status('Browserul nu a putut salva stilul. Setările tale rămân pe pagină.',true);}};
$('delete-approach').onclick=()=>{const i=Number($('saved-approach').value);if(!$('saved-approach').value)return;try{const next=savedApproaches.filter((_,n)=>n!==i);localStorage.setItem(approachKey,JSON.stringify(next));savedApproaches=next;state.preparation.approachName='';savePreparation();renderApproach();status('Stilul salvat a fost șters. Setările curente sunt păstrate.');}catch{status('Browserul nu a putut șterge stilul.',true);}};
$('compare-approach').onclick=()=>{if(state.busy)return;startSimulation({type:'match',fixture:matchFixture(),opposition:state.preparation.opposition,seed:state.preparation.seed,plans:[],compareApproach:true,approachName:approachName()});};
$('train-approach').onclick=()=>{Object.assign(state.fixture.teams[0].tactics,validateApproach(state.preparation.approach));save();state.view='edit';render();status(`Stilul ${approachName()} se folosește acum și la antrenament.`);};
$('start-match').onclick=()=>{if(state.busy)return;try{const selected=preparationRows().filter(r=>state.preparation.combinations!==false&&r.enabled&&r.plan.emphasis>0),mapped=selected.map(preparedPlan);if(mapped.some(r=>r.issues.length))throw Error('Alege cine preia indicațiile jucătorilor absenți.');const plans=mapped.map(r=>r.plan);if(new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('Activează o singură versiune a aceleiași idei.');const fixture=matchFixture();practicePlayers(fixture);startSimulation({type:'match',fixture,opposition:state.preparation.opposition,seed:state.preparation.seed,plans,approachName:approachName()});}catch(e){status(e.message,true);}};
async function init(){try{const response=await fetch('./sandbox-fixture.json');if(!response.ok)throw Error('Echipele nu sunt disponibile');state.fixture=await response.json();state.baseFixture=copy(state.fixture);state.players=practicePlayers(state.fixture);state.setup=createTrainingSetup('middle');
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){if(saved.trainingTeam){const trial=copy(state.fixture);Object.assign(trial.teams[0],saved.trainingTeam);practicePlayers(trial);state.fixture=trial;state.players=practicePlayers(trial);}state.plan=validatePlans([saved.plan])[0];state.setup=validateTrainingSetup(saved.setup,state.players);state.scene=saved.scene;state.seed=Number.isInteger(saved.seed)?saved.seed:2026;state.moment=state.plan.lesson.moments.some(m=>m.id===saved.moment)?saved.moment:'start';state.actor=saved.actor??3;state.opposition=Object.hasOwn(defensiveApproaches,saved.opposition)?saved.opposition:'original';state.emphasis=Number.isFinite(saved.emphasis)?clamp(saved.emphasis,0,100):100;state.manager=saved.manager==='one-two'?'one-two':'lesson';state.pairA=[2,3,4,5].includes(saved.pairA)?saved.pairA:3;state.pairB=[2,3,4,5].includes(saved.pairB)&&saved.pairB!==state.pairA?saved.pairB:5;if(state.pairA===state.pairB)state.pairB=2;}}catch{status('Începem cu o tablă nouă.');}
 try{state.library=(JSON.parse(localStorage.getItem(libraryKey)||'[]')).slice(0,12).map(r=>({plan:{...validatePlans([r.plan])[0],emphasis:r.plan.emphasis??1},enabled:r.enabled!==false,lineup:Array.isArray(r.lineup)?r.lineup:[...state.baseFixture.teams[0].lineup]}));}catch{state.library=[];}
 if(!localStorage.getItem(key)&&new URLSearchParams(location.search).get('instruction')==='one-two')state.manager='one-two';
 loadPreparation();try{state.preparation.approach=validateApproach(state.preparation.approach);}catch{state.preparation.approach=copy(teamApproaches.balanced.settings);}if(!teamApproaches[state.preparation.approachPreset])state.preparation.approachPreset='balanced';$('boot').hidden=true;$('app').hidden=false;if(new URLSearchParams(location.search).get('view')==='match')state.view='prepare';render();}catch(e){$('boot').textContent=`${e.message}. Reîncarcă pagina pentru a reîncerca.`;}}
init();
