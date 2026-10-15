export type Side = 0 | 1;
export type Lane = -1 | 0 | 1;
export type Role = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST';
export type Formation = '1-2-1' | '2-2' | '2-1-1' | '4-3-3' | '4-2-3-1' | '5-4-1';
export interface Skills { passing: number; control: number; finishing: number; defending: number; pace: number; strength: number; stamina: number; reading: number; aerial: number; setPieces: number; keeping: number }
export interface Traits { risk: number; dribble: number; runs: number; comesShort: number; engagement: number; discipline: number; frustration?: number; audacity?: number; keeperSweep?: number }
export interface Player { id: string; name: string; roles: Role[]; skills: Skills; traits: Traits; energy: number; note: string }
export interface Tactics {
  formation: Formation; line: 'deep' | 'standard' | 'high'; press: 'selective' | 'balanced' | 'aggressive';
  width: 'narrow' | 'standard' | 'wide'; progression: 'patient' | 'mixed' | 'direct';
  setPiece: 'mixed' | 'short' | 'delivery'; commit: number; taker?: string;
  fullbacks?: 'balanced' | 'overlap' | 'hold'; striker?: 'mixed' | 'link' | 'pivot' | 'run';
  marking?: 'balanced' | 'zonal' | 'tight';
  transition?: 'balanced' | 'secure' | 'counter';
  /** "On losing it": the first seconds after a loss. Missing = 'balanced'. */
  onLoss?: 'regroup' | 'balanced' | 'counterpress';
  /** (beat-direct probe P1, 2026-10-14, ported for the contest combine's cloud arms; scratch, never a Ballers setting)
   * Hold them in front (practice-defending holdFrontCushion). Missing = off. */
  holdFront?: boolean;
  /** (P1 retry) the hold read also weighs inside the job that closes a man as the pass to him is prepared. */
  holdFrontCue?: boolean;
  /** (rest-defence sketch, 2026-10-15; a test switch, not yet a Ballers setting) Defending: "Leave a man up". A free
   * defender weighs staying high as the outlet for the regain against what the block loses (practice-defending
   * leaveUpChoice). Missing = 'no' = nobody stays up, as before. */
  leaveUp?: 'no' | 'on' | 'always';
  /** (rest-defence sketch) Attacking: the rest defence follows their men left up, as a risk attitude priced through the
   * turnover price: safe / even / bold (practice-rest-defence restRisk, practice-coordination followGuards). Missing =
   * Bodies forward's own bounds and REST_GUARDS, as before. */
  restDefence?: 'safe' | 'even' | 'bold';
}
export interface Order { id: string; minute: number; when: 'always' | 'losing' | 'winning' | 'booked'; player?: string; substitute?: string; tactics?: Partial<Tactics> }
export interface Team { id: string; name: string; short: string; color: string; description: string; squad: Player[]; lineup: string[]; tactics: Tactics; orders: Order[] }
export interface Fixture { seed: number; teams: [Team, Team]; kickoff: Side }
export interface Footballer extends Player { side: Side; role: Role; lane: Lane; x: number; y: number; active: boolean; entered: boolean; yellow: number; red: boolean; until: number; holdUntil: number; duty: string; pressTarget?: string }
export type EventKind = 'kickoff' | 'circulation' | 'pass' | 'through' | 'dribble' | 'challenge' | 'foul' | 'card' | 'offside' | 'restart' | 'cross' | 'shot' | 'rebound' | 'goal' | 'substitution' | 'order' | 'half' | 'end';
export interface Dot { id: string; side: Side; x: number; y: number; energy: number; duty: string }
export interface MatchEvent {
  id: number; parent: number | null; time: number; half: number; side: Side; kind: EventKind;
  actor?: string; target?: string; opponent?: string; outcome: string;
  from: [number, number]; to: [number, number]; score: [number, number];
  facts: Record<string, string | number | boolean>; dots: Dot[];
}
export interface TeamStats { goals: number; shots: number; onTarget: number; through: number; throughReceived: number; crosses: number; turnovers: number; fouls: number; yellows: number; reds: number; possessionSeconds: number; entries: number; energyUsed: number; shotDistance: number }
export type ReplayPlayer = [index:number,x:number,y:number,energy:number,yellow:number,keeper:number];
export interface ReplayFrame { time:number; eventId:number; half:number; score:[number,number]; players:ReplayPlayer[]; ball:[number,number,number|null]; cut:boolean }
export interface ReplayTrack { schema:1; roster:{id:string;side:Side;number:number}[]; frames:ReplayFrame[] }
export interface MatchResult { scope:'match'|'encounter'; encounter?:string; version: string; seed: number; fixture: Fixture; score: [number, number]; stats: [TeamStats, TeamStats]; events: MatchEvent[]; players: Footballer[]; diagnostic: string | null; replay?:ReplayTrack }
export type Restart = { kind: 'kickoff' | 'free' | 'indirect' | 'corner' | 'goalKick' | 'throw' | 'penalty'; side: Side; x: number; y: number };
export const VERSION = '0.3.0';
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const other = (side: Side): Side => side === 0 ? 1 : 0;
export const forward = (side: Side, x: number) => side === 0 ? x : 100 - x;
export const absolute = forward;
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * .72);
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function weighted<T>(items: T[], weight: (item: T) => number, random: () => number): T | undefined {
  const ws = items.map(p => Math.max(0, weight(p))); let cursor = random() * ws.reduce((a,b) => a+b, 0);
  for (let i = 0; i < items.length; i++) { cursor -= ws[i]; if (cursor < 0) return items[i]; }
  return items[items.length - 1];
}
export const emptyStats = (): TeamStats => ({ goals:0, shots:0, onTarget:0, through:0, throughReceived:0, crosses:0, turnovers:0, fouls:0, yellows:0, reds:0, possessionSeconds:0, entries:0, energyUsed:0, shotDistance:0 });
export const shapes: Record<Formation, [Role, Lane][]> = {
  '1-2-1': [['GK',0],['CB',0],['W',-1],['W',1],['ST',0]],
  '2-2': [['GK',0],['CB',-1],['CB',1],['W',-1],['W',1]],
  '2-1-1': [['GK',0],['CB',-1],['CB',1],['CM',0],['ST',0]],
  '4-3-3': [['GK',0],['FB',-1],['CB',-1],['CB',1],['FB',1],['DM',0],['CM',-1],['CM',1],['W',-1],['ST',0],['W',1]],
  '4-2-3-1': [['GK',0],['FB',-1],['CB',-1],['CB',1],['FB',1],['DM',-1],['CM',1],['W',-1],['AM',0],['W',1],['ST',0]],
  '5-4-1': [['GK',0],['FB',-1],['CB',-1],['CB',0],['CB',1],['FB',1],['W',-1],['CM',-1],['CM',1],['W',1],['ST',0]],
};
