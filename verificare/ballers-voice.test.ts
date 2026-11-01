// Ballers club voice (2026-09-29): validation (the client mirror of SQL
// private.ballers_check_voice), freezing (frozen input -> replay header, and
// it never touches the football), parity (a club without a voice hears exactly
// the commentary it heard before: verificare/fixtures/ballers-commentary-parity.json
// was written by the pre-voice boardLines on the three stored matches), and
// how the lines appear (seeded, rare, only on the club's own moments).
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildIncidents} from '../lib/ballers/incidents';
import {boardLines,FLAVOUR_EVERY,FLAVOUR_MAX,AT_HOME_GOALS} from '../lib/ballers/commentary';
import {AT_HOME} from '../lib/ballers/commentary/ro';
import {checkVoice,cleanVoiceLine,normalizeVoice,voiceLineProblem,VOICE_SLOTS,type Voice} from '../lib/ballers/voice';
import {compact,computeMatch,validateInput,type EngineResult,type FrozenInput,type FrozenSide} from '../lib/ballers/compute';
import type {ReplayEvent,ReplayFrame,ReplayHeader} from '../lib/ballers/replay';

type Raw={header:ReplayHeader;events:ReplayEvent[];frames:[number,number,number,number,0|1,number,number][]};
const raw=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/ballers-matches.json.gz',import.meta.url))).toString()) as Record<string,Raw>;
const matches=Object.entries(raw).map(([id,m])=>({id,header:m.header,inc:buildIncidents({header:m.header,events:m.events,
 frames:m.frames.map(([t,x,y,o,ps,a,b])=>({t,p:[],b:[x,y,0],o,ps,s:[a,b]}) as ReplayFrame)})}));
const parity=JSON.parse(readFileSync(new URL('./fixtures/ballers-commentary-parity.json',import.meta.url),'utf8')) as Record<string,[number,string][]>;
const OWN_GOAL_MATCH='25294cfd-3081-4f3e-8413-647d2c47d2a7';
const withTeams=(h:ReplayHeader,t:[Partial<ReplayHeader['teams'][0]>,Partial<ReplayHeader['teams'][0]>]):ReplayHeader=>({...h,teams:[{...h.teams[0],...t[0]},{...h.teams[1],...t[1]}]});
/** A template as a pattern its filled lines match. */
const re=(t:string)=>new RegExp(`^${t.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\w+\}/g,'.+')}$`);
const said=(inc:typeof matches[0]['inc'],id:string,h:ReplayHeader)=>boardLines(inc,id,h).map(l=>[l.at,l.text] as [number,string]);
/** A home ground's own sentences (ro.ts AT_HOME, added 2026-10-06 for Inter at San Siro) taken back out, so the
 * parity recorded before them still holds for everything else. */
const HOME_SAID=Object.values(AT_HOME).flatMap(o=>Object.values(o).flat());
const withoutHome=(lines:[number,string][])=>lines.map(([t,x])=>{for(const h of HOME_SAID)if(x.endsWith(` ${h}`))return [t,x.slice(0,-h.length-1)] as [number,string];return [t,x] as [number,string];});

const VOICE_A:Voice={goal:['Pisicile torc de bucurie!','{player} face {score} pentru {club}.','La {min}, {opp} doarme.'],concede:['{club} strânge din dinți.'],save:['{player} zice miau lui {other}.'],foul:['{player} a zgâriat puțin.']};
const VOICE_B:Voice={goal:['Motanii nu iartă.'],concede:['La {club} se caută vinovatul.','{opp} a avut noroc.'],save:['Zid la {club}!'],foul:['{other} s-a plâns.']};

describe('club voice: validation (mirror of private.ballers_check_voice)',()=>{
 it('cleans control and direction characters, folds spaces, trims, drops blank lines and empty moments',()=>{
  expect(cleanVoiceLine('  a\tb\u2028c\u202Ed  \u0085e ')).toBe('a b c d e');
  expect(checkVoice({goal:['  Hai {club}!\n','   ',''],save:[],foul:['\u0007']})).toEqual({goal:['Hai {club}!']});
  expect(checkVoice(null)).toEqual({});expect(checkVoice({})).toEqual({});
 });
 it('refuses a wrong shape',()=>{
  for(const bad of [[],'x',1,{goal:'x'},{goal:[1]},{goal:[null]},{goal:['a','b','c','d']},{assist:['x']},{Goal:['x']}])
   expect(()=>checkVoice(bad),JSON.stringify(bad)).toThrow('invalid_voice');
 });
 it('counts characters as code points, at most 90',()=>{
  expect(checkVoice({goal:['ă'.repeat(90)]}).goal![0]).toHaveLength(90);
  expect(checkVoice({goal:['😀'.repeat(90)]}).goal).toHaveLength(1);
  expect(()=>checkVoice({goal:['x'.repeat(91)]})).toThrow('invalid_voice');
  // Measured after cleaning: surrounding spaces don't count.
  expect(checkVoice({goal:[`  ${'x'.repeat(90)}  `]}).goal![0]).toHaveLength(90);
 });
 it('allows only the moment’s own slots; anything in braces must be one',()=>{
  expect(voiceLineProblem('save','{player} vs {other}')).toBeNull();
  expect(voiceLineProblem('goal','{other} a pasat')).toEqual({kind:'slot',slot:'{other}'});
  expect(voiceLineProblem('goal','{jucător}')).toEqual({kind:'slot',slot:'{jucător}'});
  expect(voiceLineProblem('goal','{}')).toEqual({kind:'slot',slot:'{}'});
  expect(voiceLineProblem('goal','{Player}')).toEqual({kind:'slot',slot:'{Player}'});
  expect(voiceLineProblem('goal','un { singur')).toBeNull();
  expect(voiceLineProblem('foul','{a{b}}')).toEqual({kind:'slot',slot:'{b}'});
  expect(()=>checkVoice({concede:['{reason}']})).toThrow('invalid_voice');
  expect(VOICE_SLOTS.goal).not.toContain('other');
 });
 it('answers exactly as the live SQL check does',()=>{
  for(const [name,v,want] of SQL_MIRROR){
   if(want==='invalid')expect(()=>checkVoice(v),name).toThrow('invalid_voice');else expect(checkVoice(v),name).toEqual(want);
  }
 });
 it('reads leniently from a frozen input or header: keeps what is valid, else null',()=>{
  expect(normalizeVoice(undefined)).toBeNull();expect(normalizeVoice({})).toBeNull();expect(normalizeVoice([])).toBeNull();
  expect(normalizeVoice({goal:['ok','{other}',7,'x'.repeat(91),'b','c','d'],weird:['x']})).toEqual({goal:['ok','b','c']});
 });
});

// The same cases through the live SQL (private.ballers_check_voice, 2026-09-29,
// after applying 20260929111450): its answers, which the client must match.
const SQL_MIRROR:[string,unknown,Voice|'invalid'][]=[
 ['other in a goal',{goal:['x{other}']},'invalid'],['empty braces',{goal:['{}']},'invalid'],['nested braces',{foul:['{a{b}}']},'invalid'],
 ['own slots and a lone brace',{save:['{player} vs {other}','un { singur']},{save:['{player} vs {other}','un { singur']}],
 ['four lines',{goal:['a','b','c','d']},'invalid'],['unknown moment',{assist:['x']},'invalid'],['an array',[],'invalid'],
 ['a number line',{goal:[1]},'invalid'],['a string moment',{goal:'x'},'invalid'],['json null',null,{}],
 ['controls and blanks',{concede:['  a\u0085b\u2028c\t\td  ',' ']},{concede:['a b c d']}],['case matters',{goal:['{Player}']},'invalid'],
 ['diacritics in braces',{goal:['{jucător}']},'invalid'],['89 two-byte letters',{goal:['ă'.repeat(89)]},{goal:['ă'.repeat(89)]}],['91 characters',{goal:['x'.repeat(91)]},'invalid'],
];

describe('club voice: parity',()=>{
 // (owner, 24 Oct: no exact-wording pins on copy) the fixture's words date from before the Romanian copy pass and are
 // free to change; when the board speaks, and that no voice or an empty one changes nothing, are not
 it('a match without a voice speaks at the moments it spoke before the voice existed; an empty voice is no voice',()=>{
  const at=(l:readonly [number,string][]|undefined)=>(l??[]).map(([t])=>t);
  for(const m of matches)for(const mid of [m.id,'parity-alt']){
   const plain=said(m.inc,mid,m.header);
   expect(at(withoutHome(plain))).toEqual(at(parity[`${m.id}|${mid}`]));
   for(const [,x] of plain)expect(x).not.toMatch(/[{}]/);
   const ai=withTeams(m.header,[{name:'Malpraxis'},{name:'Neo-Testament'}]),aiSaid=said(m.inc,mid,ai);
   expect(at(aiSaid)).toEqual(at(parity[`${m.id}|${mid}|ai`]));
   // An empty or unreadable voice is no voice.
   expect(said(m.inc,mid,withTeams(ai,[{voice:{}},{voice:{goal:[5 as never]}}]))).toEqual(aiSaid);
  }
 });
});

describe('a ground speaks at home (AT_HOME)',()=>{
 it('Inter at San Siro: a line after the kickoff always, after a home win, after at most two home goals; never away',()=>{
  for(const m of matches)for(const mid of [m.id,'parity-alt']){
   const home=boardLines(m.inc,mid,withTeams(m.header,[{name:'Inter'},{name:'Malpraxis'}])),away=boardLines(m.inc,mid,withTeams(m.header,[{name:'Malpraxis'},{name:'Inter'}]));
   const has=(text:string,on:'kickoff'|'goal'|'win')=>(AT_HOME.inter[on]??[]).some(h=>text.endsWith(` ${h}`));
   expect(has(home.find(l=>l.incident.kind==='kickoff')!.text,'kickoff')).toBe(true);
   expect(home.filter(l=>has(l.text,'goal')).length).toBeLessThanOrEqual(AT_HOME_GOALS);
   for(const l of home.filter(l=>has(l.text,'goal')))expect(l.incident.side).toBe(0);
   const end=home.find(l=>l.incident.kind==='end')!;expect(has(end.text,'win')).toBe(end.incident.score[0]>end.incident.score[1]);
   expect(away.some(l=>HOME_SAID.some(h=>l.text.endsWith(` ${h}`)))).toBe(false);
  }
 });
});

describe('club voice: in the commentary',()=>{
 const names=[{name:'Pisicile FC'},{name:'Motanii'}] as const;
 const plain=(m:typeof matches[0],mid:string)=>said(m.inc,mid,withTeams(m.header,[names[0],names[1]]));
 const voiced=(m:typeof matches[0],mid:string)=>boardLines(m.inc,mid,withTeams(m.header,[{...names[0],voice:VOICE_A},{...names[1],voice:VOICE_B}]));
 const ids=Array.from({length:40},(_,i)=>`voice-${i}`);
 it('only ever appends one of the club’s lines to a line about that club’s own moment; the schedule never moves',()=>{
  let n=0;
  for(const m of matches)for(const mid of ids){
   const base=plain(m,mid),lines=voiced(m,mid);
   expect(lines.map(l=>l.at)).toEqual(base.map(l=>l[0]));
   lines.forEach((l,i)=>{
    if(l.text===base[i][1])return;
    n++;
    expect(l.text.startsWith(`${base[i][1]} `)).toBe(true);
    const x=l.incident,extra=l.text.slice(base[i][1].length+1);
    const who=(side:0|1)=>side===0?VOICE_A:VOICE_B,templates=(v:Voice,on:keyof Voice)=>v[on]??[];
    const allowed=x.side===null?[]:x.kind==='goal'||x.kind==='own_goal'?[...templates(who(x.side),'goal'),...templates(who((1-x.side) as 0|1),'concede')]
     :x.kind==='save'?templates(who(x.side),'save'):x.kind==='foul'?templates(who(x.side),'foul'):[];
    // The filled line matches one of its club's templates for this moment.
    expect(allowed.some(t=>re(t).test(extra)),`${x.kind}: ${extra}`).toBe(true);
    expect(extra).not.toMatch(/\{\w+\}/);
   });
  }
  expect(n).toBeGreaterThan(0);
 });
 it('is deterministic for a match, and differs between matches',()=>{
  const m=matches[0];
  expect(voiced(m,'x').map(l=>l.text)).toEqual(voiced(m,'x').map(l=>l.text));
  const sets=new Set(ids.map(mid=>voiced(m,mid).map(l=>l.text).join('|')));
  expect(sets.size).toBeGreaterThan(1);
 });
 it('is rare: at most two per club per match, five match-minutes apart, never the same line twice',()=>{
  const perClub:number[]=[];
  for(const m of matches)for(const mid of ids){
   const base=plain(m,mid),lines=voiced(m,mid);
   const hits:{side:0|1;t:number;extra:string}[]=[];
   lines.forEach((l,i)=>{if(l.text===base[i][1])return;const x=l.incident,extra=l.text.slice(base[i][1].length+1);
    hits.push({side:Object.values(VOICE_A).flat().some(t=>re(t).test(extra))?0:1,t:x.t,extra});});
   for(const side of [0,1] as const){
    const mine=hits.filter(h=>h.side===side);perClub.push(mine.length);
    expect(mine.length).toBeLessThanOrEqual(FLAVOUR_MAX);
    for(let i=1;i<mine.length;i++)expect(mine[i].t-mine[i-1].t).toBeGreaterThanOrEqual(FLAVOUR_EVERY);
    expect(new Set(mine.map(h=>h.extra)).size).toBe(mine.length);
   }
  }
  const mean=perClub.reduce((a,b)=>a+b,0)/perClub.length;
  console.log(`club voice: ${mean.toFixed(2)} lines per club per 15-minute match (${perClub.length} club-matches)`);
  expect(mean).toBeGreaterThan(.3);expect(mean).toBeLessThanOrEqual(2);
 });
 it('never names the wrong side’s player: {player} goal lines skip own goals',()=>{
  const m=matches.find(x=>x.id===OWN_GOAL_MATCH)!;
  const only:Voice={goal:['{player} semnează!'],concede:['{player} ne-a lovit.']};
  let owns=0;
  for(const mid of ids){
   const lines=boardLines(m.inc,mid,withTeams(m.header,[{...names[0],voice:only},{...names[1],voice:only}]));
   for(const l of lines)if(l.incident.kind==='own_goal'){owns++;expect(l.text).not.toMatch(/semnează|ne-a lovit/);}
  }
  expect(owns).toBeGreaterThan(0);
 });
 it('a club with a voice speaks only its own words (no AI FLAVOUR by name), the other side is untouched',()=>{
  for(const m of matches)for(const mid of ids.slice(0,10)){
   const lines=boardLines(m.inc,mid,withTeams(m.header,[{name:'Malpraxis',voice:{save:['Doar parade.']}},{name:'Motanii'}]));
   for(const l of lines)expect(l.text).not.toMatch(/intervenția e gratuită|Diagnostic clar: gol|Pacientul încă respiră/);
  }
 });
});

// ---------- freezing: frozen input -> replay header ----------
const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:4+n%5,defending:5,pace:4+n%4,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:gk?8:1});
function side(tag:string,voice?:unknown):FrozenSide{
 const players=Array.from({length:9},(_,n)=>({id:`${tag}000000-0000-4000-8000-00000000000${n}`,name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,roles:(n===0||n===8?['GK']:['CM','ST']) as FrozenSide['players'][0]['roles'],
  skills:skills(n===0||n===8,n),traits:{risk:.5,dribble:.4+n/40,runs:.5,comesShort:.4,engagement:.5,discipline:.8},energy:100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`}));
 const lineup=players.slice(0,5).map(p=>p.id);
 return {club:{id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},formation:'1-2-1',style:'balanced',
  approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},
  captain:lineup[2],lineup,bench:players.slice(5).map(p=>p.id),players,plans:[],...(voice!==undefined?{voice:voice as Voice}:{})};
}
const input=(a?:unknown,b?:unknown,duration=60):FrozenInput=>({v:1,match:'m',seed:77,kickoff:1,duration,sides:[side('aa',a),side('bb',b)]});
const empty={duration:60,players:[],frames:[],events:[],stats:[{},{}],score:[0,0]} as unknown as EngineResult;

describe('club voice: frozen with the match',()=>{
 it('the header carries the frozen voice; without one the header is exactly what it was',()=>{
  const none=compact(input(),empty).header;
  expect(none.teams.every(t=>!('voice' in t))).toBe(true);
  expect(JSON.stringify(none.teams[0])).toBe(JSON.stringify({club:'aa-club',name:'Club aa',code:'AAX',color:'#FF3D7F',formation:'1-2-1',style:'balanced'}));
  const h=compact(input(VOICE_A,{}),empty).header;
  expect(h.teams[0].voice).toEqual(VOICE_A);
  expect('voice' in h.teams[1]).toBe(false);
  // Whatever an input holds, only valid lines reach the header.
  expect(compact(input({goal:['ok','{other}'],evil:['x']},'nope'),empty).header.teams.map(t=>t.voice)).toEqual([{goal:['ok']},undefined]);
 });
 it('the voice never touches the football: same input with and without a voice plays the same match',()=>{
  const a=computeMatch(validateInput(input(undefined,undefined,60))),b=computeMatch(validateInput(input(VOICE_A,VOICE_B,60)));
  expect(JSON.stringify(b.compact.chunks)).toBe(JSON.stringify(a.compact.chunks));
  expect(b.compact.score).toEqual(a.compact.score);
  const {teams:ta,...restA}=a.compact.header,{teams:tb,...restB}=b.compact.header;
  expect(restB).toEqual(restA);
  expect(tb.map(({voice:_v,...t})=>t)).toEqual(ta);
 },120000);
});
