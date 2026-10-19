// Ballers news: what players can see or use that is new since the league
// opened. Player-facing, one line each: what it is and why it matters, never
// how it was built. No balance or tuning notes. Newest first; a new update is
// one more entry at the top. `id` is permanent (the unread marker remembers it).
export interface NewsLink {href:string;label:string}
export interface NewsItem {id:string;date:string;title:string;body:string;link?:NewsLink;
 /** Shown only to a club with Game plan on (ballers_features): the line
  * appears the moment that club is switched, never before. */
 gamePlan?:true}

const PREP={href:'/jocuri/ballers/prep',label:'Match prep'};
const LAB={href:'/jocuri/ballers/lab',label:'Lab'};
const CLUB={href:'/jocuri/ballers/club',label:'Club'};
const MATCHES={href:'/jocuri/ballers/matches',label:'Matches'};
const TABLE={href:'/jocuri/ballers/table',label:'Table'};
const PLANS={href:'/jocuri/ballers/plans',label:'Plans'};

/** The day Game plan goes live for Global (REVIEW-GOLIVE runbook). The line
 * dated with it shows only to switched clubs, so it appears with the switch
 * whatever day the merge lands; set this to the flip's day if it moves. */
const GAME_PLAN_LIVE='2026-10-03';

/** The engine-truthfulness release (build b8b17932), shipped 30 Sep 2026. */
const ENGINE_RELEASE='2026-09-30';

export const NEWS:readonly NewsItem[]=[
 {id:'defenders-guard-goal',date:'2026-10-12',title:'Defenders guard the goal',body:'They mark the man who could score, pick up runners from deep and stay goal-side when they can’t win it. A tackled player needs a moment.'},
 {id:'tiredness-bites',date:'2026-10-12',title:'Tiredness bites',body:'Players tire sooner and slow down when they do. Fitter players last longer, so your subs matter more.',link:PREP},
 {id:'your-ground',date:'2026-10-05',title:'Every club has a ground',body:'Build yours: pieces, your own pictures, a tifo and the pitch. Your home matches are played there, with friends watching from the stands.',link:CLUB},
 {id:'defenders-read',date:'2026-10-04',title:'Defenders read the game',body:'They mark goal-side, step across when a team-mate is beaten, and set up properly at corners and free kicks.'},
 {id:'lab-is-plans',date:GAME_PLAN_LIVE,gamePlan:true,title:'The Lab is now Plans',body:'Your tactics carried over as your Home plan; pick a plan in Match prep. Moves are coming soon, and the ideas you saved are kept.',link:PLANS},
 {id:'slot-roles',date:'2026-10-01',title:'Every slot says what it is',body:'Slots are named for their role, and each formation says what it gives you. Anyone can play any slot; his skills decide how well.',link:PREP},
 {id:'striker-pivot',date:ENGINE_RELEASE,title:'New striker option: Pivot',body:'He stays up on their last defender, comes to meet the pass, then holds it up or turns and shoots. Links play is now called Drops deep.',link:PREP},
 {id:'short-retuned',date:ENGINE_RELEASE,title:'Short combinations, retuned',body:'Short now plays at standard width with a Pivot up front, and counter-presses when it loses the ball.',link:PREP},
 {id:'on-losing-it',date:ENGINE_RELEASE,title:'New row: On losing it',body:'Regroup and get back, press only when you have the numbers around the ball, or counter-press straight away.',link:PREP},
 {id:'line-follows',date:ENGINE_RELEASE,title:'Line sets your block',body:'No offside, so Line sets how high your team defends and how hard it steps up when their man is pressed or plays it back.'},
 {id:'press-block',date:ENGINE_RELEASE,title:'Press shapes the whole block',body:'Aggressive hunts the ball and marks more of their men further out. Selective holds off, then springs a trap around halfway.'},
 {id:'width-means',date:ENGINE_RELEASE,title:'Width works both ways',body:'Wide spreads to the touchlines with the ball and stays nearer the far man without it. Narrow stays close and tucks into the middle.'},
 {id:'counters-bodies',date:ENGINE_RELEASE,title:'Counters and bodies forward',body:'Counters go when the numbers favour you. Bodies forward is firm: at 1 two stay back, at 5 one does. Lose it high and it costs you.'},
 {id:'reading-game',date:ENGINE_RELEASE,title:'Players read the game',body:'Good readers see passes, runs and space sooner. Daring players back themselves, nervous ones play safe, and defenders pick up runs late.'},
 {id:'cleaner-ball',date:ENGINE_RELEASE,title:'Cleaner on the ball',body:'A turn stops the ball, strikers set it for the shot, through balls come at a pace you can take, and players shoot when it’s on.'},
 {id:'safe-hands',date:'2026-09-29',title:'Safer hands at the back',body:'Keepers hold shots struck at them and tip the rest round the post, and defenders clear first time when an attacker is on them.'},
 {id:'season-stats',date:'2026-09-29',title:'Season stats',body:'Passing, chances, tackles, saves and clean sheets on every card, Table leaders, and numbers side by side when you pick your five or subs.',link:TABLE},
 {id:'subs-by-tiredness',date:'2026-09-29',title:'Subs by how tired',body:'Players now tire as the match wears on. Plan a change for when one is a bit tired, tired or running on empty.',link:PREP},
 {id:'keepers-sweep',date:'2026-09-29',title:'Keepers come off their line',body:'They rush out for balls played in behind, and a defender stays back after your throw-ins.'},
 {id:'commentary-under-pitch',date:'2026-09-29',title:'Commentary under the pitch',body:'The latest line sits right below the play, so you never scroll to follow a match.',link:MATCHES},
 {id:'club-voice',date:'2026-09-29',title:'Your club’s voice',body:'Write what the commentator says when you score, concede, save or foul.',link:CLUB},
 {id:'lab-next-five',date:'2026-09-29',title:'The Lab picks your next five',body:'The board starts with the players you’re fielding next.',link:LAB},
 {id:'new-lab',date:'2026-09-28',title:'A new Lab',body:'Your ideas sit on one shelf. Watch one play out on the same board and see which steps ran, partly ran or broke off.',link:LAB},
 {id:'set-piece-routines',date:'2026-09-28',title:'Set-piece routines',body:'Draw your own corners, free kicks, throw-ins and goal kicks.',link:LAB},
 {id:'keeper-free-kicks',date:'2026-09-28',title:'Keeper and free kicks',body:'Keep your keeper at home or let him sweep, pick a free-kick style and choose the taker.',link:PREP},
 {id:'quick-restarts',date:'2026-09-28',title:'Restarts that flow',body:'Nobody freezes at throw-ins, free kicks or goal kicks, and keepers go long over a high press.'},
 {id:'idea-lamps',date:'2026-09-28',title:'Idea lamps for both sides',body:'In every match, each idea lights up as ran, partly ran or broke off: yours and theirs.',link:MATCHES},
 {id:'walk-out',date:'2026-09-27',title:'The walk-out',body:'From the team lock to kickoff, Home takes you straight to your match’s walk-out.',link:MATCHES},
 {id:'scouting',date:'2026-09-27',title:'Scout your opponent',body:'Before each match: their last shape, form and the players to watch.',link:PREP},
 {id:'player-records',date:'2026-09-27',title:'Player records',body:'Every player card keeps season goals, assists and saves. The Table has top scorers.',link:TABLE},
 {id:'ready-made-ideas',date:'2026-09-27',title:'Ready-made ideas',body:'Four moves in the Lab, one tap to switch on.',link:LAB},
 {id:'surnames-crests',date:'2026-09-27',title:'Surnames and new crests',body:'Players go by their surname on the pitch, and the AI clubs wear new crests.',link:TABLE},
];

/** The lines everyone sees. There is no Lab any more: old lines that pointed at
 * it point at Plans (where /lab lands anyway). History is never rewritten. */
export function newsFor():readonly NewsItem[]{
 return NEWS.map(n=>n.link?.href===LAB.href?{...n,link:PLANS}:n);
}

/** Entries grouped by day, newest day first, order kept inside a day. */
export function newsByDay(items:readonly NewsItem[]=NEWS):{date:string;items:NewsItem[]}[]{
 const days:{date:string;items:NewsItem[]}[]=[];
 for(const n of items){const d=days.find(x=>x.date===n.date);if(d)d.items.push(n);else days.push({date:n.date,items:[n]});}
 return days.sort((a,b)=>b.date.localeCompare(a.date));
}

/** "29" and "SEP" for the date plate. */
export function newsDay(date:string):{day:string;month:string}{
 const [,m,d]=date.split('-').map(Number);
 return {day:String(d),month:['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][m-1]};
}

// ---------- unread, per browser ----------
const SEEN_KEY='ballers:news-seen';
/** Stage 0 orders: a club's arrival lines (lib/ballers/orders.ts arrivalNews) are remembered as seen too. */
export const ARRIVAL_PREFIX='arrival-';
export function readSeen():Set<string>|null{
 try{const raw=localStorage.getItem(SEEN_KEY);if(raw===null)return new Set();const v=JSON.parse(raw);return new Set(Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[]);}
 catch{return null;}
}
export function markSeen(ids:readonly string[]):void{
 try{const seen=readSeen();if(!seen)return;let grew=false;for(const id of ids)if(!seen.has(id)){seen.add(id);grew=true;}
  if(grew)localStorage.setItem(SEEN_KEY,JSON.stringify([...seen].filter(id=>id.startsWith(ARRIVAL_PREFIX)||NEWS.some(n=>n.id===id))));}
 catch{/* private mode or blocked storage: nothing is remembered, nothing breaks */}
}
