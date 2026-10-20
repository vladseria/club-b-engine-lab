// Goal-line freeze (2026-10-20): play one audit match with record on and return the raw result for tracing.
import {runMatch} from '../../src/index';
import {engineTeam,sideOrders} from '../../../../lib/ballers/compute';
import {inputOf} from './sa';
export function raw(arm:string,seed:number){
 const inp=inputOf(arm,seed);
 const teams=inp.sides.map(engineTeam);
 const subs=sideOrders(inp,teams as any);
 const run=runMatch({fixture:{teams,seed:inp.seed,kickoff:inp.kickoff},durationSeconds:inp.duration,policy:'coordinated',substitutions:'none',record:true,...(subs.orders.length?{substitutionOrders:subs.orders}:{})} as any);
 return {inp,run};
}
