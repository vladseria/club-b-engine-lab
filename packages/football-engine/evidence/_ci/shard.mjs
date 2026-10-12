// Cloud sharding for evidence harnesses (README.md in this folder).
// The workflow .github/workflows/ballers-sims.yml (on main) runs ONE command
// on up to 20 runners, each with SHARD_INDEX / SHARD_TOTAL / SIM_WORKERS set.
// Locally they are unset: every task stays and the harness's --workers applies.
//
// Opting a harness in (see 2026-10-01-r1-agency/run.mjs):
//   import {shardTasks,simWorkers} from '../_ci/shard.mjs';
//   const workers=simWorkers(Number(arg('workers',5)));
//   const tasks=shardTasks(allTasks).filter(t=>!done.has(key(t)));
const int=(name,fallback)=>{
 const v=process.env[name];if(v===undefined||v==='')return fallback;
 const n=Number(v);if(!Number.isInteger(n))throw new Error(`${name} must be an integer, got '${v}'`);
 return n;
};
export const SHARD_INDEX=int('SHARD_INDEX',0),SHARD_TOTAL=int('SHARD_TOTAL',1);
if(SHARD_TOTAL<1||SHARD_INDEX<0||SHARD_INDEX>=SHARD_TOTAL)throw new Error(`bad shard ${SHARD_INDEX}/${SHARD_TOTAL}`);

/** This shard's tasks: task i of the FULL enumeration (stable order) goes to
 * shard i % SHARD_TOTAL. Filter before dropping already-finished tasks, so the
 * split never depends on what one machine has on disk. */
export const shardTasks=tasks=>SHARD_TOTAL===1?tasks:tasks.filter((_,i)=>i%SHARD_TOTAL===SHARD_INDEX);

/** Worker count: SIM_WORKERS when set (the runner knows its cores; it wins
 * over a --workers copied from a laptop command), else the harness's value. */
export const simWorkers=fallback=>int('SIM_WORKERS',fallback);

/** " [shard 3/20]" in the cloud, "" locally: for log lines. */
export const shardNote=()=>SHARD_TOTAL>1?` [shard ${SHARD_INDEX+1}/${SHARD_TOTAL}]`:'';
