// Per-match manager settings (Match prep): the keeper's starting position,
// how free kicks are played and who takes them. Pure. Each one only exposes an
// engine lever that already exists; nothing here changes the football.
//
// Stored normalized in ballers_prep.match_settings (SQL
// private.ballers_check_match_settings mirrors normalizeSettings) and frozen
// into the match input as FrozenSide.settings, only when not empty. An absent
// key is today's behaviour: the keeper's own keeperSweep trait, 'mixed' free
// kicks, the engine picking the taker. So `{}` reproduces an untouched club's
// match byte for byte.
import type {Player as EnginePlayer,Tactics} from '../../packages/football-engine/src/model';

export type KeeperSetting='line'|'sweeper';
export type FreeKickPlay='short'|'mixed'|'delivery';
export interface MatchSettings {keeper?:KeeperSetting;setPiece?:Exclude<FreeKickPlay,'mixed'>;taker?:string}

/** The keeper override, as the per-player keeperSweep trait (0..1). These are
 * the two authored keeper profiles' own values (Zidul/wall 0.08, Libero 0.9 in
 * the squad generator): real players already play with them, both sit inside
 * the engine's clamp. Every keeper judges a ball in behind by forecast arrival
 * at the meeting point; the value sets how eager he is (the head start he
 * wants over the attacker, how far out he goes and how high he stands:
 * `keeperSweepReach` / `keeperSweepDepth` in practice-keeper.ts), and widens
 * (sweeper) or narrows (line) his high-ball claims and build-up depth. */
export const KEEPER_SWEEP:Record<KeeperSetting,number>={line:.9,sweeper:.08};

const KEEPERS:readonly KeeperSetting[]=['line','sweeper'];
const PLAYS:readonly FreeKickPlay[]=['short','mixed','delivery'];

/** What the stored/frozen settings mean for this five: unknown values drop,
 * 'mixed' is the default (omitted), a taker must be an outfield starter
 * (lineup slots 2-5). Same rule as the SQL keep path. */
export function normalizeSettings(value:unknown,lineup:readonly string[]):MatchSettings{
 const v=(value&&typeof value==='object'&&!Array.isArray(value)?value:{}) as Record<string,unknown>,out:MatchSettings={};
 if(KEEPERS.includes(v.keeper as KeeperSetting))out.keeper=v.keeper as KeeperSetting;
 if(v.setPiece==='short'||v.setPiece==='delivery')out.setPiece=v.setPiece;
 if(typeof v.taker==='string'&&lineup.slice(1,5).includes(v.taker))out.taker=v.taker;
 return out;
}
export const isDefault=(s:MatchSettings)=>!s.keeper&&!s.setPiece&&!s.taker;
export const sameSettings=(a:MatchSettings,b:MatchSettings)=>a.keeper===b.keeper&&(a.setPiece??'mixed')===(b.setPiece??'mixed')&&a.taker===b.taker;
export const freeKickPlay=(s:MatchSettings):FreeKickPlay=>s.setPiece??'mixed';
export function withPlay(s:MatchSettings,play:FreeKickPlay):MatchSettings{const {setPiece:_drop,...rest}=s;void _drop;return play==='mixed'?rest:{...rest,setPiece:play};}
export function withKeeper(s:MatchSettings,keeper:KeeperSetting|null):MatchSettings{const {keeper:_drop,...rest}=s;void _drop;return keeper?{...rest,keeper}:rest;}
export function withTaker(s:MatchSettings,taker:string|null):MatchSettings{const {taker:_drop,...rest}=s;void _drop;return taker?{...rest,taker}:rest;}

/** The tactics with the free-kick settings. Default settings return the very
 * same object (no keys added), so an untouched side's engine input is unchanged. */
export function settingsTactics(t:Tactics,s:MatchSettings|undefined):Tactics{
 if(!s||(!s.setPiece&&!s.taker))return t;
 return {...t,...(s.setPiece?{setPiece:s.setPiece}:{}),...(s.taker?{taker:s.taker}:{})};
}
/** The squad with the keeper override on every keeper (whoever ends up in goal,
 * a substitute keeper included). Outfield players are never touched. */
export function settingsSquad<P extends Pick<EnginePlayer,'roles'|'traits'>>(squad:P[],s:MatchSettings|undefined):P[]{
 if(!s?.keeper)return squad;
 const sweep=KEEPER_SWEEP[s.keeper];
 return squad.map(p=>p.roles.includes('GK')?{...p,traits:{...p.traits,keeperSweep:sweep}}:p);
}
