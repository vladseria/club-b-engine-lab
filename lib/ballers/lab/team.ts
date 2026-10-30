// Teams for the browser engine: the member's club as the Lab and practice
// matches use it, the scratch side trials play against, and the demo club a
// visitor without a club practises with. Pure.
import fixtureJson from './practice-fixture.json';
import type {Fixture,Player as EnginePlayer,Tactics,Team} from '../../../packages/football-engine/src/model';
import {engineApproach,engineStyle,playedApproach,type StoredApproach} from '../approach';
import type {FrozenPlan,FrozenSide} from '../compute';
import {PRESETS,shortName,type Club,type Formation,type Player,type Style} from '../league';
import {isDefault,normalizeSettings,settingsSquad,settingsTactics,type MatchSettings} from '../match-settings';

/** Off-league names only: a trial is never a fixture between real clubs. */
const PRACTICE_OPPONENT='Practice opponent';
type FixturePlayer=EnginePlayer&{archetype?:string;temperament?:string;portrait?:{library:string;portrait:number}};
const FIXTURE=fixtureJson as unknown as {seed:number;kickoff:0|1;teams:[Team&{squad:FixturePlayer[]},Team&{squad:FixturePlayer[]}]};

/** A board player: who stands in a slot, with a face. */
export interface LabPlayer {id:string;name:string;short:string;number:number;portrait:string;keeper:boolean}
const fixturePortrait=(p:FixturePlayer)=>p.portrait?.library==='portraits-v1'&&p.portrait.portrait<=216?`p${String(p.portrait.portrait).padStart(4,'0')}`:'p0001';

/** `settings`: the next match's match settings (keeper, free kicks), if any. */
/** "On losing it" reaches the engine through engineApproach, as in lib/ballers/compute.ts engineTeam. */
/** `style`: the plan's style; the engine is told it only when the approach plays its base (approach.ts engineStyle). */
export const tacticsOf=(formation:Formation,approach:StoredApproach,settings?:MatchSettings,style?:string):Tactics=>settingsTactics({...engineApproach(playedApproach(formation,approach)),...(engineStyle(style,approach)?{style:engineStyle(style,approach)}:{}),formation,setPiece:'mixed',fullbacks:'balanced',marking:'balanced'} as unknown as Tactics,settings);
export const enginePlayerOf=(p:Player):EnginePlayer=>({id:p.id,name:p.name,roles:[...p.roles],skills:{...p.skills},traits:{...p.traits},energy:p.energy,note:p.note,archetype:p.archetype,temperament:p.temperament} as EnginePlayer);

export interface LabSide {team:Team;players:LabPlayer[]}
/** The member's club with a lineup, formation and approach (what trials use),
 * plus the next match's settings when given (read against this five). */
export function clubSide(club:Pick<Club,'id'|'name'|'code'|'color'>,squad:Player[],lineup:string[],formation:Formation,approach:StoredApproach,matchSettings?:unknown,style?:string):LabSide{
 const settings=matchSettings?normalizeSettings(matchSettings,lineup):undefined;
 return {team:{id:club.id,name:club.name,short:club.code,color:club.color,description:'Ballers',squad:settingsSquad(squad.map(enginePlayerOf),settings),lineup:[...lineup],tactics:tacticsOf(formation,approach,settings,style),orders:[]},
  players:squad.map(p=>({id:p.id,name:p.name,short:p.short,number:p.number,portrait:p.portrait,keeper:p.roles.includes('GK')}))};
}
/** The sandbox's own club, for visitors without one (the board works without a club). */
export function demoSide():LabSide{
 const t=structuredClone(FIXTURE.teams[0]);
 return {team:{...t,name:'Your club',color:'#FF3D7F',short:'YOU',tactics:{...t.tactics,...engineApproach(PRESETS.balanced),formation:t.tactics.formation}},players:t.squad.map((p,i)=>({id:p.id,name:p.name,short:shortName(p.name),number:i+1,portrait:fixturePortrait(p),keeper:p.roles.includes('GK')}))};
}
/** The scratch side every trial plays against (the sandbox's). */
export function scratchSide():LabSide{
 const t=structuredClone(FIXTURE.teams[1]);
 return {team:{...t,name:PRACTICE_OPPONENT,short:'OPP',color:'#C9CCD2'},players:t.squad.map(p=>({id:p.id,name:p.name,short:shortName(p.name),number:t.lineup.indexOf(p.id)+1,portrait:fixturePortrait(p),keeper:p.roles.includes('GK')}))};
}
export const SCRATCH_NAME=PRACTICE_OPPONENT;
export function trialFixture(home:Team,seed:number):Fixture{return {seed,kickoff:0,teams:[structuredClone(home),structuredClone(scratchSide().team)]};}
/** Who stands in slot n (1-5) of a lineup. */
export const inSlot=(side:LabSide,n:number)=>side.players.find(p=>p.id===side.team.lineup[n-1]);

/** One side of a practice match, in the official frozen shape (no bench changes, no ideas unless given).
 * `settings` (the prep's match settings) is carried only when not default, as the freeze does. */
export function frozenSide(club:Pick<Club,'id'|'name'|'code'|'color'>,squad:Player[],v:{lineup:string[];formation:Formation;style:Style;approach:StoredApproach;captain:string|null;settings?:unknown},plans:FrozenPlan[]=[]):FrozenSide{
 const settings=v.settings?normalizeSettings(v.settings,v.lineup):null;
 return {...(settings&&!isDefault(settings)?{settings}:{}),club:{id:club.id,name:club.name,code:club.code,color:club.color},formation:v.formation,style:v.style,approach:v.approach,
  captain:v.captain&&v.lineup.includes(v.captain)?v.captain:v.lineup[1],lineup:[...v.lineup],bench:squad.filter(p=>!v.lineup.includes(p.id)).map(p=>p.id),
  players:squad.map(p=>({id:p.id,name:p.name,short:p.short,number:p.number,roles:[...p.roles],skills:{...p.skills},traits:{...p.traits},energy:p.energy,archetype:p.archetype,temperament:p.temperament,note:p.note,portrait:p.portrait})),plans};
}
