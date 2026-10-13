// Keeper 2 (2026-10-13): copied unchanged from ../2026-10-13-keeper-fix (branch ballers-keeper-fix).
// Keeper giveaway study: one match's timeline around a moment (evidence only).
//   node trace.mjs --revs live=working sc/men-mal/prep/stored 740000 160 168
// Prints every frame (0.1 s) in [from, to]: ball owner (hands / feet / loose), each player's position, duty and job,
// distance to the ball; every event; every choice (with the carrier's option and reason). The match is played through
// keeper.ts's run (the computeMatch call).
import {runMatch} from '../../src/index';
import {engineTeam,sidePlans,sideOrders} from '../../../../lib/ballers/compute';
import {inputOf as mirrorInput} from '../2026-10-10-cloud-measure/mirror';
import {inputOf as scenarioInput,init as scenarioInit} from '../2026-10-09-scenarios/match';
import {analyse} from './keeper';
export {scenarioInit};

export function trace(t:any,from:number,to:number,options=false){
 const decisions:{t:number;l:string}[]=[];
 const inp0:any=t.scenario?scenarioInput(t):mirrorInput(t.arm,t.seed);
 const names=new Map<string,string>();for(const s of inp0.sides)for(const p of s.players)names.set(p.id,p.short);
 const nm=(id:any)=>{if(!id)return '-';const raw=String(id).split(':').slice(1).join(':');return (names.get(raw)??raw)+'('+String(id).split(':')[0]+')';};
 const hook=options?(g:any)=>{if(g.p.role!=='GK'||g.time<from||g.time>to)return;
  const opp=g.players.filter((q:any)=>q.side!==g.p.side&&q.role!=='GK');
  const nearest=(v:any)=>Math.min(...opp.map((q:any)=>Math.hypot(q.x-v.x,q.y-v.y)));
  const top=[...g.available].sort((a:any,b:any)=>b.score-a.score).slice(0,7);
  decisions.push({t:g.time,l:`   DECIDE ${g.time.toFixed(2)} keeper at (${g.p.x.toFixed(1)},${g.p.y.toFixed(1)}) hands=${g.inHands} nearest opp ${nearest(g.p).toFixed(1)} m -> ${g.option.kind} ${g.option.target?nm(g.option.target):''} score ${g.option.score.toFixed(3)}`});
  for(const o of top)decisions.push({t:g.time,l:`      ${o===g.option?'*':' '} ${o.kind.padEnd(7)} ${(o.target?nm(o.target):'').padEnd(14)} score ${o.score.toFixed(3)} aim(${o.aim.x.toFixed(1)},${o.aim.y.toFixed(1)}) laneRisk ${(o.pass?.risk??o.loft?.risk??-1).toFixed?.(2)} ctl ${(o.pass?.controlRisk??-1).toFixed(2)} reach ${(o.pass?.reachMargin??-9).toFixed(2)} oppNearAim ${nearest(o.aim).toFixed(1)} relief ${(o.relief??0).toFixed(2)} ${o.reason??''}`});
 }:undefined;
 const inp:any=t.scenario?scenarioInput(t):mirrorInput(t.arm,t.seed);
 const teams=inp.sides.map(engineTeam);
 const plans=inp.sides.map(sidePlans);
 const playbooks=plans.flatMap((p:any,side:number)=>p.plans.length?[{side,plans:p.plans,adaptive:true}]:[]);
 const subs=sideOrders(inp,teams);
 if(hook)(globalThis as any).__kgHook=hook;
 const r:any=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,
  ...(playbooks.length?{playbooks}:{}),...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 (globalThis as any).__kgHook=undefined;
 const R=r.result,roster=R.players;
 const lines:string[]=[];
 lines.push(`build ${r.engineBuild.slice(0,8)} score ${R.score} goals ${JSON.stringify(R.events.filter((e:any)=>e.kind==='goal').map((e:any)=>[e.side,Math.round(e.time*10)/10]))}`);
 lines.push('roster: '+roster.map((p:any,i:number)=>`${i}=${nm(p.id)} ${p.role}`).join(', '));
 const pos=(f:any,i:number)=>{if(f.lineup){const slot=f.lineup.indexOf(i);return slot>=0?f.players[slot]:null;}return f.players[i];};
 const evs=R.events.filter((e:any)=>e.time>=from&&e.time<=to);
 const chs=(R.choices??[]).filter((c:any)=>c.time>=from&&c.time<=to);
 let ei=0,ci=0;
 for(const f of R.frames){
  if(f.time<from||f.time>to)continue;
  while(decisions.length&&decisions[0].t<=f.time+1e-6)lines.push(decisions.shift()!.l);
  while(ei<evs.length&&evs[ei].time<=f.time+1e-6){const e=evs[ei++];lines.push(`   EVENT ${e.time.toFixed(2)} ${e.kind} ${nm(e.actor)}${e.target?' -> '+nm(e.target):''} ${e.text}${e.pass?.aim?` aim(${e.pass.aim.x.toFixed(1)},${e.pass.aim.y.toFixed(1)})`:''}${e.aerial?' aerial':''}`);}
  while(ci<chs.length&&chs[ci].time<=f.time+1e-6){const c=chs[ci++];const p=roster[c.player];lines.push(`   CHOICE ${c.time.toFixed(2)} ${nm(p.id)} ${c.kind}${c.action?'/'+c.action:''}${c.assignment?` [${c.assignment.purpose}${c.assignment.target?'->'+nm(c.assignment.target):''}]`:''} ${c.reason??''}`);}
  const o=f.ball.owner,hands=o&&!f.restart&&!f.control;
  const ps=roster.map((p:any,i:number)=>{const q=pos(f,i);if(!q)return '';return `${nm(p.id).padEnd(14)}(${q.x.toFixed(1)},${q.y.toFixed(1)}) ${q.duty} d${Math.hypot(q.x-f.ball.x,q.y-f.ball.y).toFixed(1)}`;}).filter(Boolean);
  lines.push(`${f.time.toFixed(1)} ball(${f.ball.x.toFixed(1)},${f.ball.y.toFixed(1)},${f.ball.z.toFixed(1)}) ${f.ball.mode} owner ${nm(o)}${hands?' HANDS':''}${f.restart?' RESTART '+f.restartInfo?.kind:''}`);
  for(const s of ps)lines.push('     '+s);
 }
 return {lines,kp:analyse(R,true)};
}
