import {WORLD} from './world.js';
/** Hot-path aliases (engine as data W9b): world reads used inside this file's functions, read once at load. */
const PITCH_REFERENCE_GOAL_HALF=WORLD.pitch.reference.goalHalf.v;
const PITCH_REFERENCE_LENGTH=WORLD.pitch.reference.length.v;
const PITCH_REFERENCE_WIDTH=WORLD.pitch.reference.width.v;
/** Real metres. Only tactical reference locations use X/Y. */
export const L=WORLD.pitch.core.length.v,W=WORLD.pitch.core.width.v,GH=WORLD.pitch.core.goalHalf.v,HEIGHT=WORLD.pitch.core.goalHeight.v,BOX_DEPTH=WORLD.pitch.core.boxDepth.v,BOX_HALF=WORLD.pitch.core.boxHalf.v,SPOT=WORLD.pitch.core.spot.v;
export const X=(reference:number)=>reference*L/PITCH_REFERENCE_LENGTH;
export const Y=(reference:number)=>reference*W/PITCH_REFERENCE_WIDTH;
export const G=(reference:number)=>reference*GH/PITCH_REFERENCE_GOAL_HALF;
export const pitch={length:L,width:W,goalWidth:GH*2,goalDepth:WORLD.pitch.core.shape.goalDepth.v,penaltyDepth:BOX_DEPTH,penaltyWidth:BOX_HALF*2,penaltySpot:SPOT,goalAreaDepth:WORLD.pitch.core.shape.goalAreaDepth.v,goalAreaWidth:WORLD.pitch.core.shape.goalAreaWidth.v,restartRadius:WORLD.pitch.core.shape.restartRadius.v};
