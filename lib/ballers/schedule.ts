/** Kickoffs are local civil time, including Bucharest daylight-saving changes.
 * Prep locks one absolute hour before kickoff (SQL: ballers_rounds.locks_at). */
export const LOCK_MS=60*60*1000;
export const locksAt=(kickoff:number)=>kickoff-LOCK_MS;
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function nextKickoff(after:number):number{
 let t=Math.floor(after/3600000)*3600000+3600000;
 for(let i=0;i<24*8;i++,t+=3600000){const parts=Object.fromEntries(clock.formatToParts(t).map(p=>[p.type,p.value]));if(['Tue','Fri'].includes(parts.weekday)&&parts.hour==='20'&&parts.minute==='00')return t;}
 throw Error('No league slot found');
}
/** Circle method; an odd roster has one bye. Entrants join the next unlocked round. */
export function pairings(ids:string[],round:number):[string,string][]{
 const slots:[...(string|null)[]]=[...ids].sort();if(slots.length%2)slots.push(null);
 if(slots.length<2)return [];
 const offset=round%(slots.length-1);for(let i=0;i<offset;i++)slots.splice(1,0,slots.pop()!);
 const pairs:[string,string][]=[];for(let i=0;i<slots.length/2;i++){const a=slots[i],b=slots[slots.length-1-i];if(a&&b)pairs.push(round%2?[b,a]:[a,b]);}return pairs;
}
/** Rounds in a double round robin: n-1 per leg (n even), n per leg (n odd). */
export const seasonRounds=(clubs:number)=>clubs<2?0:2*(clubs%2?clubs:clubs-1);
/** The fixed season schedule, generated once at season start (SQL mirror:
 * private.ballers_season_pairs). Leg one is the circle method above, round by
 * round; leg two replays it with home and away swapped. An odd roster has one
 * bye per round. */
export function seasonSchedule(ids:string[]):{round:number;home:string;away:string}[]{
 const n=ids.length+(ids.length%2),leg=n-1,out:{round:number;home:string;away:string}[]=[];
 if(ids.length<2)return out;
 for(let r=0;r<leg;r++)for(const [home,away] of pairings(ids,r))out.push({round:r+1,home,away});
 for(let r=0;r<leg;r++)for(const [home,away] of pairings(ids,r))out.push({round:leg+r+1,home:away,away:home});
 return out;
}
/** Preseason rebuild (SQL mirror: private.ballers_preseason_rebuild, with
 * private.ballers_bye_order and private.ballers_preseason_pairs). While the
 * Preseason (season 0) runs, a change in the club roster (a club joins)
 * rebuilds every round still open before its lock with nothing frozen or
 * played in it; locked, frozen and played rounds never change. From Season 1
 * the schedule is fixed and joiners take the bye (seat-joiners rule). */
export type RosterClub={id:string;ai:boolean;/** byes already taken in fixed rounds */byes:number;/** founding time, epoch ms */created:number};
/** Polygon order: AI clubs first, then humans; each by fewest byes so far,
 * founding time, id. */
export function byeOrder(clubs:RosterClub[]):string[]{
 return [...clubs].sort((a,b)=>Number(b.ai)-Number(a.ai)||a.byes-b.byes||a.created-b.created||(a.id<b.id?-1:a.id>b.id?1:0)).map(c=>c.id);
}
/** Weights of the repair matching (integers, so SQL and TS agree exactly). */
export const REBUILD_WEIGHTS={human:100,ai:1,deviation:1} as const;
/** The Preseason schedule for `rounds` remaining rounds (slot 0 = the first).
 *
 * Base: a double round robin over `order` by the polygon method. c = n (odd)
 * or n-1 (even; the last club is the pivot). Round r of a leg: order[r] has
 * the bye (odd) or meets the pivot (even; pivot at home when r is odd); for
 * j=1..(c-1)/2, order[r+j] meets order[r-j] (mod c), the plus side at home
 * when j is odd. Leg two swaps home and away; beyond two legs it repeats.
 *
 * STRICT bye rule (Vlad, 2026-09-25): no human club ever sits out while any
 * AI club exists. When the base round would bench a human, the AI club with
 * the fewest byes so far in this rebuild sits out instead (on a tie the one
 * latest in `order`, whose own base bye is furthest away), and that round is
 * re-paired by an exact minimum-cost perfect
 * matching over the other clubs (bitmask DP, pairs chosen lowest index first,
 * partners in ascending index, strict improvement only). A pair costs
 *   weight * meetings^2      (meetings so far in this rebuild; weight 100 if
 *                             a human is involved, else 1)
 *   + 1 if it is not a pair of the base round
 *   + (c - ahead) if it is a non-base pair with a human, where `ahead` is how
 *     many rounds later the base schedule would have paired them (so the one
 *     rematch a human cannot avoid comes as late as possible).
 * A base pair keeps its base home side; a new pair is hosted by the club with
 * fewer home games so far (lower index on a tie). Rosters above 17 clubs use
 * a plain swap instead (the human takes the sitting AI club's opponent). */
export function preseasonRebuild(order:string[],ai:boolean[],rounds:number):{slot:number;home:string;away:string}[]{
 const n=order.length,out:{slot:number;home:string;away:string}[]=[];
 if(n<2||rounds<1)return out;
 const c=n%2?n:n-1,anyAI=ai.some(Boolean);
 const byes=Array(n).fill(0),homes=Array(n).fill(0),met=Array.from({length:n},()=>Array(n).fill(0));
 const emit=(slot:number,h:number,a:number)=>{homes[h]++;met[h][a]++;met[a][h]++;out.push({slot,home:order[h],away:order[a]});};
 for(let s=0;s<rounds;s++){
  const k=s%(2*c),leg2=k>=c,r=k%c,base:[number,number][]=[];
  if(n%2===0)base.push(r%2?[n-1,r]:[r,n-1]);
  for(let j=1;j<=(c-1)/2;j++){const plus=(r+j)%c,minus=(r-j+c)%c;base.push(j%2?[plus,minus]:[minus,plus]);}
  const top=n%2?r:-1;let sitter=top;
  if(top>=0&&anyAI&&!ai[top]){sitter=-1;for(let i=0;i<n;i++)if(ai[i]&&(sitter<0||byes[i]<=byes[sitter]))sitter=i;}
  if(sitter>=0)byes[sitter]++;
  if(sitter===top){for(const [h,a] of base)leg2?emit(s,a,h):emit(s,h,a);continue;}
  const partner=Array(n).fill(-1);for(const [h,a] of base){partner[h]=a;partner[a]=h;}
  const players=[...Array(n).keys()].filter(i=>i!==sitter),m=players.length;
  let pairs:[number,number][]=[];
  if(m>16){
   // Plain swap: the benched human takes the sitting AI club's opponent.
   for(const [h,a] of base){pairs.push(h===sitter?[top,a]:a===sitter?[h,top]:[h,a]);}
   for(const [x,y] of pairs){const isBase=partner[x]===y;if(isBase)leg2?emit(s,y,x):emit(s,x,y);else emit(s,x,y);}
   continue;
  }
  const w=(x:number,y:number)=>{const t=met[x][y],hum=!ai[x]||!ai[y],rep=(hum?REBUILD_WEIGHTS.human:REBUILD_WEIGHTS.ai)*t*t;
   if(partner[x]===y)return rep;const sum=(x+y)%c,when=sum%2===0?sum/2:(sum+c)/2,ahead=(when-r+c)%c;
   return rep+REBUILD_WEIGHTS.deviation+(hum?c-ahead:0);};
  const full=(1<<m)-1,cost=new Array<number>(full+1).fill(Infinity),pick=new Array<number>(full+1).fill(-1);cost[full]=0;
  for(let mask=full-1;mask>=0;mask--){let i=0;while(mask&(1<<i))i++;
   for(let j=i+1;j<m;j++){if(mask&(1<<j))continue;const next=cost[mask|(1<<i)|(1<<j)];if(next===Infinity)continue;
    const tot=next+w(players[i],players[j]);if(tot<cost[mask]){cost[mask]=tot;pick[mask]=j;}}}
  for(let mask=0;mask!==full;){let i=0;while(mask&(1<<i))i++;const j=pick[mask];pairs.push([players[i],players[j]]);mask|=(1<<i)|(1<<j);}
  for(const [x,y] of pairs){
   if(partner[x]===y){const [h,a]=base.find(p=>p[0]===x||p[1]===x)!;leg2?emit(s,a,h):emit(s,h,a);}
   else if(homes[y]<homes[x])emit(s,y,x);else emit(s,x,y);
  }
 }
 return out;
}
