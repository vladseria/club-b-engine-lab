// Settings audit step 0: node step0.mjs > results/step0-tactics.txt (no match is played)
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs} from '../_ci/revs.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const b=(await bundleRevs({entry:path.join(here,'step0.ts'),revs:{eng:'working'},outDir:path.join(here,'results'),tag:'step0'})).eng;
console.log((await import(pathToFileURL(b).href)).report());
