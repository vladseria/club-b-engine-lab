// Ballers live report (deliverables/ballers-live-report/AS-DECIDED.md, "Energy (the real build)"): one whole-number energy
// reading per man on the pitch at the end of each match minute, riding in the compact replay as the `en` of each chunk's
// last frame (lib/ballers/replay.ts ReplayFrame). The engine is untouched: its recorded frames already carry each on-pitch
// man's energy (the fitness code reads it there too). The compact's `compact()` stamps them only for a LEAGUE match frozen
// with the fitness marker; Bebe's showcase and a match without fitness never carry one, so their compacts stay
// byte-identical (and a guest's energy never reaches a browser). Pure: no I/O; the screens' reader is
// lib/ballers/live-report/energy.ts.
import type {ReplayChunk, ReplayFrame} from './replay';

/** One frame's reading: each of the ten positions' energy in the frame's own order (its `l`, or the starters), rounded to a
 * whole number; null when any of them is missing or not a finite number (nothing is guessed). */
export function energyReading(players: readonly {energy?: number}[]): number[] | null {
  if (!players.length) return null;
  const out: number[] = [];
  for (const p of players) {
    const e = p.energy;
    if (typeof e !== 'number' || !Number.isFinite(e)) return null;
    out.push(Math.round(e));
  }
  return out;
}

/** Each chunk's last frame takes its reading (`en`): the end of that match minute; the chunk that ends at the half-time
 * whistle takes it at the whistle (before the break's rest), the last chunk at the final whistle. `energiesOf` gives the
 * engine frame's players behind a compact frame (undefined: no reading for it). */
export function stampReadings(chunks: readonly ReplayChunk[], energiesOf: (f: ReplayFrame) => readonly {energy?: number}[] | undefined): void {
  for (const c of chunks) {
    const f = c.f[c.f.length - 1];
    if (!f) continue;
    const players = energiesOf(f), en = players ? energyReading(players) : null;
    if (en) f.en = en;
  }
}
