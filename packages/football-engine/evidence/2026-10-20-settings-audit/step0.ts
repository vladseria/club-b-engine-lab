// Settings audit step 0: what the engine is handed for every set-up and every Block B arm (no match is played).
import {engineTeam} from '../../../../lib/ballers/compute';
import {inputOf,SETUPS,CHANGES} from './sa';
const KEYS=['formation','progression','width','line','press','commit','striker','transition','onLoss','setPiece'];
export function report(){
 const rows:string[]=[];
 const show=(arm:string,label:string)=>{
  const inp=inputOf(arm,0),t:any=engineTeam(inp.sides[0]),gk=t.squad.find((p:any)=>p.roles.includes('GK'));
  rows.push(`${label.padEnd(22)} ${KEYS.map(k=>`${k}=${t.tactics[k]}`).join(' ')} keeperSweep=${gk.traits.keeperSweep}`);
 };
 for(const s of SETUPS)show(`A.${s}vba121`,`A ${s}`);
 for(const c of Object.keys(CHANGES))if(c!=='base'&&c!=='f22')show(`B.${c}vba`,`B ${c}`);
 return rows.join('\n');
}
