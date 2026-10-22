// Styles research, the one-touch v2 run's row entry: the what-if anatomy plus `extra.sty` (style moments, row-styles.ts)
// and `extra.tr` (each loss and what follows, row-trans.ts, which also adds squad h5). Evidence only.
import {setExtra,anatomy} from '../2026-10-22-whatif/row';
import {styleExtra} from './row-styles';
import {transitions} from './row-trans';
export * from '../2026-10-22-whatif/row';
setExtra((runs:any[],teams:any[],t:any)=>{const a=anatomy(runs,teams,t);a.sty=styleExtra(runs,teams);a.tr=transitions(runs);return a;});
