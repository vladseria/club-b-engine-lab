export type {StandingInstruction,StandingNote} from './practice-standing.js';
export {teamApproaches,validateApproach,validateEntryTactics} from './team-approach.js';
export type {ApproachSettings} from './team-approach.js';
/** The same input contract is used in browser workers and background match jobs. */
import {simulatePractice, PRACTICE_VERSION} from './practice.js';
import type {PracticeResult} from './practice.js';
import type {Fixture} from './model.js';
import type {PlaybookConfig, TrainingSetup} from './practice-playbook.js';
import type {CoachingIntent} from './practice-coaching.js';
import {ENGINE_BUILD} from './build-info.js';
import {validateSubstitutionOrders} from './practice-substitutions.js';
import {validateEntryTactics} from './team-approach.js';
import type {SubstitutionOrder} from './practice-substitutions.js';
import {validateTacticsSwitches} from './practice-switch.js';
import type {TacticsSwitch} from './practice-switch.js';
export {ENGINE_BUILD};
export const ENGINE_VERSION = PRACTICE_VERSION;
export const INPUT_SCHEMA_VERSION = 1 as const;
export type {Fixture, Team, Player, Skills, Traits, Tactics} from './model.js';
export type {PracticeResult as SimulationResult} from './practice.js';
export type {CoachingIntent} from './practice-coaching.js';
export type {PlaybookConfig, PlaybookPlan, TrainingSetup, LessonSpec} from './practice-playbook.js';
export {samplePractice, practicePlayers, previewTrainingLesson} from './practice.js';
export {createTrainingSetup, createRestartSetup, validatePlans, validateTrainingSetup, playbookProgress} from './practice-playbook.js';
export {sceneBall, sceneMatches, sceneZoneOf, placeRoutine} from './practice-routine.js';
export type {LessonScene, SceneRestart, SceneSpot, SceneZone} from './practice-lesson.js';
export {defensiveApproaches,withDefensiveApproach} from './defensive-approaches.js';
export type {DefensiveApproach} from './defensive-approaches.js';
export {validateSubstitutionOrders,MAX_TRIGGERED_SUBSTITUTIONS} from './practice-substitutions.js';
export {LAST_ATTACK_MAX} from './practice-match.js';
export type {SubstitutionOrder,SubstitutionTrigger,SubstitutionNote,SubstitutionRecord} from './practice-substitutions.js';
export {validateTacticsSwitches,MAX_TACTICS_SWITCHES} from './practice-switch.js';
export type {TacticsSwitch,SwitchTrigger,SwitchNote,SwitchRecord} from './practice-switch.js';

interface CommonInput {
 fixture: Fixture;
 durationSeconds?: number;
 record?: boolean;
 policy?: 'classic' | 'coordinated';
 substitutions?: 'none' | 'planned';
 coaching?: CoachingIntent;
 playbook?: PlaybookConfig;
 playbooks?: PlaybookConfig[];
 /** Opt-in prepared substitutions (max 3 per side); omitted or empty changes nothing. */
 substitutionOrders?: SubstitutionOrder[];
 /** Opt-in tactics switch (at most one per side, practice-switch.ts); omitted or empty changes nothing. */
 tacticsSwitches?: TacticsSwitch[];
}
export interface MatchInput extends CommonInput {kind: 'match'}
export interface TrainingInput extends CommonInput {kind: 'training'; setup: TrainingSetup}
export type SimulationInput = MatchInput | TrainingInput;
export type NormalizedInput = SimulationInput & Required<Pick<CommonInput, 'durationSeconds' | 'record' | 'policy' | 'substitutions'>>;
export interface SimulationRequest {schemaVersion: 1; engineBuild: string; input: NormalizedInput}
export interface SimulationRun {schemaVersion: 1; engineBuild: string; engineVersion: string; input: NormalizedInput; result: PracticeResult}
export type Progress = (elapsedSeconds: number) => void;

/** Snapshot roster, tactics, emphasis and seed; no clock, storage or UI state. */
export function createSimulationRequest(input: SimulationInput): SimulationRequest {
 if(!input || !['match', 'training'].includes(input.kind))throw Error('Choose match or training.');
 if(!input.fixture || !Number.isInteger(input.fixture.seed) || input.fixture.seed<0 || input.fixture.seed>0xffffffff)throw Error('A fixture with an explicit seed is required.');
 for(const team of input.fixture.teams)if(team.tactics.marking!==undefined&&!['balanced','zonal','tight'].includes(team.tactics.marking))throw Error('Unknown marking style.');
 for(const team of input.fixture.teams)if(team.tactics.transition!==undefined&&!['balanced','secure','counter'].includes(team.tactics.transition))throw Error('Unknown transition approach.');
 validateEntryTactics(input.fixture.teams);
 const durationSeconds=input.durationSeconds??(input.kind==='match'?900:20);
 if(!Number.isFinite(durationSeconds)||durationSeconds<10||durationSeconds>5400)throw Error('Duration must be between 10 and 5400 seconds.');
 if(input.record!==undefined&&typeof input.record!=='boolean')throw Error('record must be a boolean.');
 if(input.policy!==undefined&&!['classic','coordinated'].includes(input.policy))throw Error('Unknown decision policy.');
 if(input.substitutions!==undefined&&!['none','planned'].includes(input.substitutions))throw Error('Unknown substitutions setting.');
 if(input.playbook&&input.playbooks)throw Error('Choose playbook or playbooks.');
 if(input.playbooks&&(!Array.isArray(input.playbooks)||input.playbooks.length>2||new Set(input.playbooks.map(p=>p.side)).size!==input.playbooks.length))throw Error('One playbook per side.');
 if(input.coaching&&(input.playbook||input.playbooks?.length))throw Error('Choose a coaching intention or a lesson playbook.');
 if(input.kind==='training'&&!input.setup)throw Error('Training needs an explicit setup.');
 if(input.kind==='match'&&('setup' in input||'trainingSetup' in input))throw Error('A normal match starts from kickoff, not a training setup.');
 const orders=input.substitutionOrders===undefined?[]:validateSubstitutionOrders(input.substitutionOrders,input.fixture);
 if(orders.length&&input.kind!=='match')throw Error('Substitution orders belong to matches.');
 if(orders.length&&input.coaching)throw Error('Choose a coaching intention or substitution orders.');
 if(orders.length&&input.substitutions==='planned')throw Error('Choose planned or triggered substitutions, not both.');
 const switches=input.tacticsSwitches===undefined?[]:validateTacticsSwitches(input.tacticsSwitches,input.fixture);
 if(switches.length&&input.kind!=='match')throw Error('Tactics switches belong to matches.');
 if(switches.length&&input.coaching)throw Error('Choose a coaching intention or a tactics switch.');
 if(switches.length&&input.substitutions==='planned')throw Error('Choose planned substitutions or a tactics switch.');
 if(switches.some(s=>s.slots)&&(input.playbook||input.playbooks?.length))throw Error('A switch that moves men to new slots cannot run with slot-addressed plans drawn for the old places.');
 const normalized: NormalizedInput={kind:input.kind,fixture:structuredClone(input.fixture),durationSeconds,record:input.record??true,policy:input.policy??'coordinated',substitutions:input.substitutions??'none',...(input.kind==='training'?{setup:structuredClone(input.setup)}:{}),...(input.coaching?{coaching:structuredClone(input.coaching)}:{}),...(input.playbook?{playbook:structuredClone(input.playbook)}:{}),...(input.playbooks?{playbooks:structuredClone(input.playbooks)}:{}),...(orders.length?{substitutionOrders:orders}:{}),...(switches.length?{tacticsSwitches:switches}:{})} as NormalizedInput;
 return {schemaVersion:INPUT_SCHEMA_VERSION,engineBuild:ENGINE_BUILD,input:normalized};
}

/** Execute a serialized job without silently switching it to a different build. */
export function runSimulation(request: SimulationRequest, progress?: Progress): SimulationRun {
 if(!request||request.schemaVersion!==INPUT_SCHEMA_VERSION)throw Error('Unsupported simulation input schema.');
 if(request.engineBuild!==ENGINE_BUILD)throw Error('This match requires a different football engine build.');
 const snapshot=createSimulationRequest(request.input),input=snapshot.input;
 // A match plays out the attack in progress at full time (practice-match.ts attackAtFullTime); training ends on the clock.
 const result=simulatePractice(input.fixture,input.durationSeconds,progress,input.record,{policy:input.policy,substitutions:input.substitutions,...(input.kind==='match'?{lastAttack:true}:{}),...(input.kind==='training'?{trainingSetup:input.setup}:{}),...(input.coaching?{coaching:input.coaching}:{}),...(input.playbook?{playbook:input.playbook}:{}),...(input.playbooks?{playbooks:input.playbooks}:{}),...(input.substitutionOrders?{substitutionOrders:input.substitutionOrders}:{}),...(input.tacticsSwitches?{tacticsSwitches:input.tacticsSwitches}:{})});
 return {...snapshot,engineVersion:ENGINE_VERSION,result};
}
export function runMatch(input: Omit<MatchInput, 'kind'>, progress?: Progress): SimulationRun {
 return runSimulation(createSimulationRequest({...input,kind:'match'}),progress);
}
export function runTraining(input: Omit<TrainingInput, 'kind'>, progress?: Progress): SimulationRun {
 return runSimulation(createSimulationRequest({...input,kind:'training'}),progress);
}
