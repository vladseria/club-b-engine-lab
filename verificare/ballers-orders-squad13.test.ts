// Stage 0 orders, "what must keep working" (STAGE-0.md): a 13-man squad with a bench of eight reaches the
// engine input, the substitution validators (prep's and the engine's) accept a newcomer from the far end of
// the bench, a full match computes with one of them coming on, and the replay, its timeline and the player
// stats carry all thirteen. The frozen side is built exactly as private.ballers_input_side builds it: the
// lineup, `bench` = everyone else, and `players` in lineup-then-bench order.
import {describe,it,expect} from 'vitest';
import {gunzipSync} from 'node:zlib';
import {computeMatch,submission,validateInput,type FrozenInput,type FrozenSide} from '../lib/ballers/simulation';
import {timeline,type ReplayChunk,type ReplayHeader} from '../lib/ballers/replay';
import {matchPlayerStats} from '../lib/ballers/stats';
import {subsProblem} from '../lib/ballers/subs';
import {frozenSide} from '../lib/ballers/lab/team';
import type {Player} from '../lib/ballers/league';

const skills=(gk:boolean,n:number)=>({passing:5+n%3,control:5+n%4,finishing:gk?2:4+n%5,defending:5,pace:4+n%4,strength:5,stamina:6,reading:6,aerial:5,setPieces:5,keeping:gk?8:1});
/** Thirteen: the original nine (keepers 0 and 8) plus four ordered newcomers (9–12, a keeper at 12). */
function squad(tag:string):Player[]{
 return Array.from({length:13},(_,n)=>({id:`${tag}000000-0000-4000-8000-0000000000${String(n).padStart(2,'0')}`,club_id:`${tag}-club`,space:'test',name:`${tag.toUpperCase()} Player ${n}`,short:`${tag}${n}`,number:n+1,
  roles:(n===0||n===8||n===12?['GK']:['CM','ST']) as Player['roles'],skills:skills(n===0||n===8||n===12,n),traits:{risk:.5,dribble:.4+n/40,runs:.5,comesShort:.4,engagement:.5,discipline:.8},
  energy:100,archetype:n===0?'wall':'motor',temperament:'cold',note:'x',portrait:`p00${10+n}`,founder:false,order_slot:n>=9?n-9:null,gem:n===10}) as Player);
}
function side(tag:string):FrozenSide{
 const sq=squad(tag),lineup=sq.slice(0,5).map(p=>p.id);
 const s=frozenSide({id:`${tag}-club`,name:`Club ${tag}`,code:tag.toUpperCase().padEnd(3,'X'),color:'#FF3D7F'},sq,
  {lineup,formation:'1-2-1',style:'balanced',approach:{progression:'mixed',width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',transition:'balanced'},captain:lineup[2]});
 return s;
}

describe('a 13-man squad end to end',()=>{
 const a=side('aa'),b=side('bb');
 // Bring on the newcomer at the far end of the bench (index 11 of 13) at half time, for a starter.
 const late=a.players[11].id,off=a.lineup[3];
 a.substitutions=[{id:'o1',in:late,out:off,trigger:{kind:'half'}},{id:'o2',in:a.players[9].id,out:a.lineup[4],trigger:{kind:'half'}}];
 const input:FrozenInput={v:1,match:'m13',seed:777,kickoff:0,duration:240,sides:[a,b]};

 it('the frozen side carries a bench of eight, players in lineup-then-bench order',()=>{
  expect(a.bench).toHaveLength(8);
  expect(a.players.map(p=>p.id)).toEqual([...a.lineup,...a.bench]);
 });
 it('prep and the engine accept substitutions from anywhere on a bench of eight',()=>{
  expect(subsProblem(a.substitutions!,squad('aa'),a.lineup)).toBeNull();
 });
 const c=computeMatch(validateInput(input)),sub=submission(c,input);
 const unpack=(b64:string)=>JSON.parse(gunzipSync(Buffer.from(b64,'base64')).toString());
 const header=unpack(sub.header) as ReplayHeader,chunks=sub.chunks.map(x=>unpack(x.data) as ReplayChunk);
 it('computes, with both newcomers coming on',()=>{
  expect(c.dropped).toEqual([]);
  const notes=(c.compact.substitutionNotes??[]) as {notes:{status:string;in:string}[]}[];
  const made=notes.flatMap(s=>s.notes).filter(n=>n.status==='made').map(n=>n.in);
  expect(made).toEqual(expect.arrayContaining([late,a.players[9].id]));
 },120000);
 it('the replay header and the player stats know all thirteen of each side',()=>{
  expect(header.players.length).toBe(26);
  const t=timeline(header,chunks);
  const stats=matchPlayerStats(header,t.events,t.frames);
  const lateLine=stats.find(l=>l.id===late);
  expect(lateLine?.st).toBe(0);
  expect(lateLine?.m??0).toBeGreaterThan(0);
  expect(stats.filter(l=>a.bench.includes(l.id)).map(l=>l.id).sort()).toEqual([late,a.players[9].id].sort());
 });
});
