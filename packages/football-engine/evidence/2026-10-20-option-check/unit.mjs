// Option check: unit checks (no match). node unit.mjs
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundleRevs} from '../_ci/revs.mjs';
import {hook} from './hook.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const b=(await bundleRevs({entry:path.join(here,'unit.ts'),revs:{eng:'working'},outDir:path.join(here,'results'),extraPlugins:[hook],tag:'unit'})).eng;
const m=await import(pathToFileURL(b).href);
for(const l of m.run())console.log(l);
console.log('unit: all passed');
