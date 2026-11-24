// Game plan WP5: who a player is compared with, and "Start him instead"
// (DESIGN-SPEC-2 §2 Compare). Pure.
import {isKeeper,type Player} from './league';
import {swapFive} from './prep-plan';
import type {PrepOrder} from './subs';

type P=Pick<Player,'id'|'roles'|'number'>;
/** The player a card's Compare opens against: the other half of a planned
 * substitution if there is one; else, for a starter, the bench player most
 * like him (same keeper-ness, then a shared position); for a bench player,
 * the starter most like him. `sub` = the pair is that substitution, in order (on, off). */
export function counterpart(p:P,squad:readonly P[],lineup:readonly string[],orders:readonly PrepOrder[]=[]):{a:string;b:string;sub:boolean}|null{
 const o=orders.find(x=>x.in===p.id||x.out===p.id||(x.trigger.kind==='tired'&&x.trigger.player===p.id));
 if(o){const off=o.trigger.kind==='tired'?o.trigger.player:o.out;if(off&&off!==o.in)return {a:o.in,b:off,sub:true};}
 const starts=lineup.includes(p.id);
 const pool=squad.filter(x=>x.id!==p.id&&isKeeper(x)===isKeeper(p)&&lineup.includes(x.id)!==starts);
 const score=(x:P)=>x.roles.filter(r=>p.roles.includes(r)).length*10+(x.roles[0]===p.roles[0]?5:0);
 const best=[...pool].sort((x,y)=>score(y)-score(x)||x.number-y.number)[0];
 if(!best)return null;
 return starts?{a:best.id,b:p.id,sub:false}:{a:p.id,b:best.id,sub:false};
}

/** The same player as `p` in another squad (Compare with yours / theirs). */
export function likeFor(p:P,squad:readonly P[],lineup:readonly string[]=[]):string|null{
 const same=squad.filter(x=>x.id!==p.id&&isKeeper(x)===isKeeper(p));
 const score=(x:P)=>(x.roles[0]===p.roles[0]?20:0)+x.roles.filter(r=>p.roles.includes(r)).length*5+(lineup.includes(x.id)?3:0);
 return [...same].sort((x,y)=>score(y)-score(x)||x.number-y.number)[0]?.id??null;
}

export interface PrepFive {lineup:string[];captain:string;taker?:string;moveLineups:Record<string,Record<string,string>>}
/** "Start A instead": A (on the bench) takes B's slot. If B wore the armband
 * it goes where Match prep sends it (lib/ballers/prep-plan.ts swapFive: the
 * second slot, one rule for both screens); a set-piece taker who leaves goes back to Auto;
 * move parts handed to B are let go (Prep hands them over again). Null when
 * the swap isn't a bench-for-starter of the same kind. */
export function startInstead(squad:readonly P[],v:PrepFive,aId:string,bId:string):(PrepFive&{taker:string|'auto'|undefined;armbandFrom:string|null})|null{
 const a=squad.find(x=>x.id===aId),b=squad.find(x=>x.id===bId),slot=v.lineup.indexOf(bId);
 if(!a||!b||slot<0||v.lineup.includes(aId)||isKeeper(a)!==isKeeper(b))return null;
 const {lineup,captain,armbandFrom}=swapFive(v.lineup,slot,aId,v.captain);
 const moveLineups=Object.fromEntries(Object.entries(v.moveLineups).map(([k,m])=>[k,Object.fromEntries(Object.entries(m).filter(([,id])=>id!==bId))]));
 return {lineup,captain,armbandFrom,taker:v.taker===bId?'auto':undefined,moveLineups};
}
