// Where each plan setting really acts (TECH-SPEC §4.4), as data. This is the
// truth source for every "Also: …" note on a plan (lib/ballers/plan-bands.ts):
// a setting carries a note exactly when it reaches a phase outside the band it
// is shown in. verificare/gp-wp1.test.ts keeps it honest twice over:
//  - every read of a setting in the engine (packages/football-engine/src) is
//    counted per file and must match `sites` below, so a new read can't slip in
//    unreviewed (TECH-SPEC M7);
//  - a setting has an "Also" note if and only if `reachesOutside` says so.
// Pure data, no engine import (the client bundle never loads engine modules).
import type {Phase} from './phase';

/** A plan setting: one of the eight approach keys, or the keeper / free kicks in Set pieces and keeper. */
export type ReachKey='progression'|'width'|'line'|'press'|'striker'|'commit'|'transition'|'onLoss'|'keeper'|'setPiece';

export interface Reach {
 /** The phases (lib/ballers/phase.ts) where the engine reads it. */
 phases:readonly Phase[];
 /** A phase it touches only through the phase function's own edges, not a
  * read of its own (Progression shapes the first pass after a set piece is
  * taken, which the phase function still counts as Set pieces for 4 s).
  * Listed for the record; never a reason for an "Also" note. */
  edges?:readonly Phase[];
 /** One option reaches further than the others (Regroup: retired from the board on 15 Oct 2026, kept
  * here because the engine still plays it for stored and frozen setups). */
 options?:Readonly<Record<string,{phases:readonly Phase[];why:string}>>;
 /** Engine read sites: file (under packages/football-engine/src) → how many reads.
  * The pattern counted is `tactics.<key>`, `tactics[side].<key>` or `t.<key>`
  * (keeper: the `keeperSweep` trait the setting writes, as a whole word; free kicks: `tactics.setPiece`). */
 sites:Readonly<Record<string,number>>;
 /** Plain words for what the reads do, for whoever reviews a change here. */
 why:string;
}

export const REACH:Readonly<Record<ReachKey,Reach>>={
 progression:{phases:['build','attack'],edges:['set'],
  sites:{'practice-coordination.ts':8,'practice-support.ts':2,'practice-attacking-space.ts':2,'team-approach.ts':6,'practice-shape.ts':1},
  why:'How patient the man on the ball is, the runs and supports around him, and how far the front unit pushes: all with the ball.'},
 width:{phases:['build','attack','loss','defend'],
  sites:{'practice-shape.ts':5,'practice-build-up.ts':1,'practice-coordination.ts':6,'practice.ts':1,'practice-defending.ts':4},
  why:'The lanes and spread with the ball; without it, how far the free man tucks in and how far a marker sags off a wide man (practice-defending, 4 Oct).'},
 line:{phases:['build','attack','loss','defend'],
  sites:{'practice-shape.ts':3,'practice-build-up.ts':3,'practice-coordination.ts':2,'practice-keeper-support.ts':1,'practice.ts':1,'practice-defending.ts':9},
  why:'Without the ball: how high the block sits and squeezes, how many of theirs are marked, where the man on the ball engages, how far from goal the free man drops to cover a man ahead of the ball (practice-defending; the cover defender, 10 Oct), and how far out and how fully the markers leave their men for the open shot lane when the ball is near your goal (box defending, 12 Oct: Deep all the way, Standard part of it, High stays nearer its men). With it: how high the centre-backs push up and the cushion the men kept back keep, and, near your own goal, how much the covering centre-back pays to stay between a pressed team-mate on the ball and your goal (Deep most, High least; R1, 14 Oct).'},
 press:{phases:['loss','defend'],
  sites:{'practice-shape.ts':3,'practice-coordination.ts':1,'practice-defense.ts':4,'practice-challenge.ts':1,'practice-restart-live.ts':1,'practice-defending.ts':9},
  why:'Where the man on their carrier engages and how far off he waits, how many of theirs are marked further out, Selective’s trap and Aggressive’s double, the players not chasing it in the first seconds after a loss, and the block at their goal kicks.'},
 striker:{phases:['build','attack'],
  sites:{'practice-support.ts':2,'practice-coordination.ts':6,'practice-attacking-space.ts':2,'practice.ts':2,'team-approach.ts':3},
  why:'Where the striker (or the furthest-forward winger in 2-2) looks to receive, also in a counter’s first seconds (a Pivot or Drops deep keeps his job there).'},
 commit:{phases:['build','attack'],
  sites:{'practice-shape.ts':1,'practice-build-up.ts':1,'practice-coordination.ts':5,'practice-exposure.ts':1,'practice-arrangements.ts':2,'practice-job-selection.ts':1,'practice-support.ts':2,'practice-attacking-space.ts':1,'practice.ts':1,'team-approach.ts':1},
  why:'How many join an attack and how many stay back while you have the ball.'},
 transition:{phases:['build','attack'],
  sites:{'team-approach.ts':6,'practice-coordination.ts':2,'practice-transition.ts':2,'index.ts':2},
  why:'What the team does in the first 10 seconds after winning the ball (counted as Attacking by the phase function).'},
 onLoss:{phases:['loss'],
  options:{regroup:{phases:['loss','defend','set'],why:'Regroup’s full-effort recovery runs on any change of possession, so it also fires after a restart goes to them and while the ball is dead.'}},
  sites:{'practice-coordination.ts':1,'practice-shape.ts':1},
  why:'Chase the ball or get back, in the 3 seconds after losing it.'},
 keeper:{phases:['build','loss','defend','set'],
  sites:{'practice-keeper.ts':3,'practice-keeper-support.ts':1,'practice.ts':1,'practice-carry.ts':3},
  why:'How eager the keeper is to come for balls in behind and high balls, how deep he stands to help the build-up, (stays on his line) that he never offers a pass back from outside his area, and how much he minds the goal he leaves open when he carries the ball at his feet (keeperNetWeight; R1, 14 Oct: two of the three counted reads are its doc comment and type; since 15 Oct that price alone keeps a keeper who stays on his line from carrying it out of his area, the old hard guard is gone).'},
 setPiece:{phases:['set'],
  sites:{'practice-set-pieces.ts':5,'practice.ts':5},
  why:'At your free kicks: the routine your men line up in (practice.ts, freeKickCallAims) and the kick the taker looks for.'},
};

/** Where a setting reaches, for one of its options (an option may reach further). */
export const reachOf=(key:ReachKey,option?:string|number):readonly Phase[]=>{
 const r=REACH[key],o=option===undefined?undefined:r.options?.[String(option)];
 return o?o.phases:r.phases;
};
/** True when a setting (with this option) acts in a phase outside `home`, the
 * phases of the band it is shown in. Edges never count. */
export const reachesOutside=(key:ReachKey,option:string|number|undefined,home:readonly Phase[])=>
 reachOf(key,option).some(p=>!home.includes(p));
