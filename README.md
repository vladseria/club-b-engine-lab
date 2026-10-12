# club-b-engine-lab

Snapshots of a 5-a-side football match engine and the harness that plays batch
simulations with it, so the batches can run on GitHub Actions.

Each commit here is one exported snapshot, `engine at <sha>`, of an upstream
repository's engine code at that commit; the tag `p-<sha12>` names the upstream
commit. Only the engine package, its tests, the simulation harness and the few
match-computation modules the harness imports are exported. Development happens
upstream: this repository does not take issues or pull requests.

## Layout

- `packages/football-engine/src` — the engine (`src/build-info.ts` holds the build hash)
- `packages/football-engine/test`, `scripts` — package tests and the build script
- `lib/ballers/` — the official match-computation path (`compute.ts` and what it imports)
- `packages/football-engine/evidence/_ci/` — sharding (`shard.mjs`) and multi-revision bundling (`revs.mjs`)
- `packages/football-engine/evidence/2026-10-10-cloud-measure/` — neutral mirror matches (`run.mjs`, `mirror.ts`), the combined plan (`measure.mjs`) and its reader (`lights.mjs`)
- `packages/football-engine/evidence/2026-10-09-scenarios/` — manager scenarios on frozen club sides (`sides/`, md5-checked)

## Running

```sh
npm install                      # esbuild (+ typescript for the package tests)
node packages/football-engine/evidence/2026-10-10-cloud-measure/run.mjs \
  --label smoke --revs base=working co0:0
```

`--revs name=<rev>` takes `working` (this checkout) or any git rev of this
repository; an older engine is the tag of its snapshot, e.g.
`--revs base=p-0123456789ab,cand=working` (`git tag -l 'p-*'`).

On Actions: `.github/workflows/sims.yml` (dispatch only) runs one command on up
to 20 runners, each with `SHARD_INDEX`/`SHARD_TOTAL`/`SIM_WORKERS` set, and
uploads what each shard wrote as artifact `shard-<i>`.

Rows reproduce bit for bit only on the same CPU architecture and Node build:
V8's transcendental `Math` functions differ in the last bits between x64 and
arm64 builds. Never pool rows from different platforms; run a baseline and its
candidate in the same batch.
