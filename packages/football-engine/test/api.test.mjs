import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSimulationRequest,runSimulation,runMatch,runTraining,createTrainingSetup,ENGINE_BUILD} from '../dist/index.js';
import {simulatePractice} from '../dist/practice.js';
const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
const coaching={kind:'repeat-one-two',side:0,carrier:3,partner:5,channelY:0,width:20,emphasis:.25};

test('serialized job snapshots tactics, emphasis and roster, and replays exactly',()=>{
 const input={kind:'match',fixture:structuredClone(fixture),durationSeconds:30,coaching:{...coaching}};
 const request=createSimulationRequest(input),original=structuredClone(request);
 input.fixture.teams[0].squad[0].skills.control=0;input.coaching.emphasis=1;
 const run=runSimulation(request);
 assert.equal(run.input.coaching.emphasis,.25);assert.deepEqual(request,original);
 assert.deepEqual(run,runSimulation(JSON.parse(JSON.stringify(request))));
 assert.deepEqual(run.result,simulatePractice(fixture,30,undefined,true,{policy:'coordinated',substitutions:'none',coaching}));
});

test('training and ordinary-match entry points use the same core without importing drill positions',()=>{
 const setup=createTrainingSetup('middle');
 const training=runTraining({fixture,setup,durationSeconds:20,coaching});
 assert.deepEqual(training.result,simulatePractice(fixture,20,undefined,true,{policy:'coordinated',substitutions:'none',coaching,trainingSetup:setup}));
 const match=runMatch({fixture,durationSeconds:20,coaching});
 assert(!('setup' in match.input));assert.equal(match.result.events[0].kind,'start');
 assert.deepEqual(match.result,simulatePractice(fixture,20,undefined,true,{policy:'coordinated',substitutions:'none',coaching}));
 assert.throws(()=>runMatch({fixture,setup,durationSeconds:20}),/normal match/);
});

test('disabled emphasis is identical to ordinary play through the public API',()=>{
 const normal=runMatch({fixture,durationSeconds:20});
 const off=runMatch({fixture,durationSeconds:20,coaching:{...coaching,emphasis:0}});
 assert.deepEqual(off.result.coachingNotes,[]);delete off.result.coachingNotes;
 assert.deepEqual(off.result,normal.result);
});

test('wrong engine versions and invalid job configurations fail explicitly',()=>{
 const request=createSimulationRequest({kind:'match',fixture,durationSeconds:20});
 assert.throws(()=>runSimulation({...request,engineBuild:'different'}),/different football engine build/);
 assert.throws(()=>runSimulation({...request,schemaVersion:2}),/schema/);
 assert.throws(()=>runMatch({fixture,durationSeconds:Infinity}),/Duration/);
 assert.throws(()=>runTraining({fixture}),/setup/);
 assert.throws(()=>runMatch({fixture,coaching,playbook:{side:0,plans:[]}}),/Choose/);
});

test('a separate background process executes the exact browser-compatible JSON job',async()=>{
 const scratch=await mkdtemp(path.join(tmpdir(),'football-job-'));
 try{
  const request=createSimulationRequest({kind:'match',fixture,durationSeconds:20,coaching});
  const input=path.join(scratch,'input.json'),output=path.join(scratch,'output.json');
  await writeFile(input,JSON.stringify(request));
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/simulate.mjs',import.meta.url)),input,output]);
  const separate=JSON.parse(await readFile(output,'utf8'));
  assert.equal(separate.engineBuild,ENGINE_BUILD);
  const {executionRuntime,...computed}=separate;assert.equal(executionRuntime.version,process.version);
  assert.deepEqual(computed,JSON.parse(JSON.stringify(runSimulation(request))));
 }finally{await rm(scratch,{recursive:true,force:true});}
});
