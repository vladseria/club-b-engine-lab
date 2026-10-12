import {L,W,GH,HEIGHT,BOX_DEPTH,BOX_HALF,SPOT,X,Y,G} from './pitch.js';
import {clamp} from './model.js';
import type {PracticePlayer} from './practice.js';
import type {Vec} from './movement.js';

const depth=(p:Pick<PracticePlayer,'side'>,x:number)=>p.side===0?x:L-x;
export interface ReleaseCue {target:string;at:number}

/** A player's last scan, not the referee's continuously updated offside line. */
export function createOffsideAwareness(){
 return {lineFor(_observer:PracticePlayer,_players:readonly PracticePlayer[],_time:number,_pressure=0):number{return L;},clear(){}};
}
export function perceivedOffside(_observer:Pick<PracticePlayer,'side'|'x'|'y'>,_target:Vec,_line:number,_ball:Vec=_observer):boolean{return false;}

/** A visible passing preparation can start the receiver's next stride before contact. */
export function runReleaseAllowance(player:Pick<PracticePlayer,'id'|'pace'>,time:number,cue?:ReleaseCue):number{
 if(!cue||cue.target!==player.id||time<cue.at-.35||time>cue.at+.8)return 0;
 return clamp(player.pace*.55,2,4);
}
