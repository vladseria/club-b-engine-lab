// The match stats table (Watch's Stats tab, the broadcast, practice). Rows read the engine's team stats
// (packages/football-engine practice.ts PracticeStats) as stored with each result.
import type {Result} from './league';

/** Each row: label, home, away. The engine's `turnovers` counts the times a side WINS the ball from the other
 * (practice.ts own(): the new owner's side), so its row says "Balls won". Stored results keep that meaning, so the
 * label is the fix, not the counter (recon 2026-10-16, finding 10). */
export function statRows(r:Result):[string,number,number][]{
 const [a,b]=r.stats,n=(o:Record<string,number>,k:string)=>Math.round(o?.[k]??0);
 const pos=n(a,'possession')+n(b,'possession');
 return [
  ['Shots',n(a,'shots'),n(b,'shots')],
  ['Saves',n(a,'saves'),n(b,'saves')],
  ['Possession %',pos?Math.round(n(a,'possession')/pos*100):0,pos?Math.round(n(b,'possession')/pos*100):0],
  ['Passes completed',n(a,'completed'),n(b,'completed')],
  ['Tackles won',n(a,'tacklesWon'),n(b,'tacklesWon')],
  ['Players beaten',n(a,'beaten'),n(b,'beaten')],
  ['Balls won',n(a,'turnovers'),n(b,'turnovers')],
  ['Fouls',n(a,'fouls'),n(b,'fouls')],
 ];
}
