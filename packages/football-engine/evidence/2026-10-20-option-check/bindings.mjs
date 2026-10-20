// Option check: (re)write bindings.json, simulatePractice's body bindings before the tick loop, for this tree's
// practice.ts (needs the TypeScript parser: laptop only). The lab runners use the committed file (hook.mjs).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseBindings} from './hook.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const src=readFileSync(path.join(here,'../../src/practice.ts'),'utf8');
const b=parseBindings(src);
writeFileSync(path.join(here,'bindings.json'),JSON.stringify({sha:createHash('sha256').update(src).digest('hex'),...b})+'\n');
console.log(`bindings.json: ${b.lets.length} lets, ${b.consts.length} consts`);
