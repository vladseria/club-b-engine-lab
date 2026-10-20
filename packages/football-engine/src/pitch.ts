import {WORLD} from './world.js';
/** Real metres. Only tactical reference locations use X/Y. */
export const L=WORLD.pitch.core.length.v,W=WORLD.pitch.core.width.v,GH=WORLD.pitch.core.goalHalf.v,HEIGHT=WORLD.pitch.core.goalHeight.v,BOX_DEPTH=WORLD.pitch.core.boxDepth.v,BOX_HALF=WORLD.pitch.core.boxHalf.v,SPOT=WORLD.pitch.core.spot.v;
export const X=(reference:number)=>reference*L/WORLD.pitch.reference.length.v;
export const Y=(reference:number)=>reference*W/WORLD.pitch.reference.width.v;
export const G=(reference:number)=>reference*GH/WORLD.pitch.reference.goalHalf.v;
export const pitch={length:L,width:W,goalWidth:GH*2,goalDepth:WORLD.pitch.core.shape.goalDepth.v,penaltyDepth:BOX_DEPTH,penaltyWidth:BOX_HALF*2,penaltySpot:SPOT,goalAreaDepth:WORLD.pitch.core.shape.goalAreaDepth.v,goalAreaWidth:WORLD.pitch.core.shape.goalAreaWidth.v,restartRadius:WORLD.pitch.core.shape.restartRadius.v};
