// A local/background-job adapter. Scheduling and result storage belong to the caller.
import {readFile,writeFile} from 'node:fs/promises';
import {runSimulation} from '../dist/index.js';
const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath){console.error('Usage: node scripts/simulate.mjs request.json result.json');process.exitCode=1;}
else try{const request=JSON.parse(await readFile(inputPath,'utf8'));const result={...runSimulation(request),executionRuntime:{kind:'node',version:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch}};await writeFile(outputPath,JSON.stringify(result));console.log(`Match computed with ${result.engineBuild.slice(0,12)} → ${outputPath}`);}catch(error){console.error(error.message);process.exitCode=1;}
