/** Real metres. Only tactical reference locations use X/Y. */
export const L=48,W=30,GH=2.5,HEIGHT=2,BOX_DEPTH=8,BOX_HALF=8,SPOT=6;
export const X=(reference:number)=>reference*L/105;
export const Y=(reference:number)=>reference*W/68;
export const G=(reference:number)=>reference*GH/3.66;
export const pitch={length:L,width:W,goalWidth:GH*2,goalDepth:1.5,penaltyDepth:BOX_DEPTH,penaltyWidth:BOX_HALF*2,penaltySpot:SPOT,goalAreaDepth:3,goalAreaWidth:9,restartRadius:5};
