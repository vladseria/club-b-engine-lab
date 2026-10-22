// Ballers league: row shapes as stored in Supabase (see the ballers_p1_*
// migrations) plus the pure helpers the screens share. No I/O here.
import {STYLE_BASE,playedApproach,withOnLoss,type Approach,type BaseKey,type StoredApproach} from './approach';
import type {PrepOrder} from './subs';
import type {MatchSettings} from './match-settings';
import type {Voice} from './voice';
import type {Player as EnginePlayer, Role} from '../../packages/football-engine/src/model';
import {LOCK_MS} from './schedule';
import {LAST_ATTACK_MAX} from '../../packages/football-engine/src/practice-match';
export {BASE_KEYS,STYLE_BASE,STYLE_KEYS,engineStyle,fitsStyle,isBaseKey,styleChoices,styleOfBase,withStyleBase,type BaseKey,type StyleKey} from './approach';
export {ON_LOSS,boardApproach,boardFormation,engineApproach,onLossOf,playedApproach,widthChosen,withOnLoss,type Approach,type OnLoss,type StoredApproach} from './approach';

/** Every formation a stored row, frozen input or replay may carry (the engine plays all three). */
export type Formation='1-2-1'|'2-2'|'2-1-1';
/** The formations a manager can pick: 2-1-1 is retired (owner, 15 Oct 2026; approach.ts boardFormation). */
export type BoardFormation=Exclude<Formation,'2-1-1'>;
export const BOARD_FORMATIONS:readonly BoardFormation[]=['1-2-1','2-2'];
/** The four styles ('combinations' is Short). Same keys as approach.ts StyleKey. */
export type Style='balanced'|'combinations'|'direct'|'counter';
export type Archetype='wall'|'libero'|'anchor'|'ballwinner'|'architect'|'motor'|'artist'|'runner'|'pivot'|'predator'|'maverick';
export type Temperament='cold'|'fuse'|'diva'|'ambitious'|'heart';

/** A club as everyone may read it. Current tactics are not public. */
export interface Club {id:string;space:string;name:string;code:string;color:string;crest:string;motto:string|null;anthem:string|null;chant:string|null;ai:boolean;manager:string|null;captain:string|null;created_at:string}
/** The signed-in member's own club, with its default tactics. */
export interface MyClub extends Club {formation:Formation;style:Style;approach:Approach;lineup:string[];updated_at:string;
 /** The season the name/code/crest were set in; they reopen once it has ended. */
 identity_season:number;identity_open:boolean;
 /** The club's commentary lines (lib/ballers/voice.ts); owner-only. Absent before its migration. */ voice?:Voice;
 /** Switched-on features (ballers_features via ballers_my_club), present only when there is one: 'game_plan'. */ features?:string[]}
export interface Player {id:string;club_id:string;space:string;name:string;short:string;number:number;roles:Role[];archetype:Archetype;temperament:Temperament;note:string;skills:EnginePlayer['skills'];traits:EnginePlayer['traits'];energy:number;portrait:string;founder:boolean;
 /** Stage 0 orders (migration ballers_orders): which of the four orders brought him, null for the original nine; and the club's one gem. Absent on rows read before the migration. */
 order_slot?:number|null;gem?:boolean;created_at?:string;
 /** Stage 1 (migration ballers_growth): his age, null until seeded; the age-curve traits (empty = the default curve). Absent on rows read before the migration. */
 age?:number|null;growth_traits?:string[]}
export interface Round {id:string;competition_id:string;space:string;number:number;kickoff_at:string;locks_at:string;status:'open'|'frozen'|'done'}
export interface Match {id:string;space:string;competition_id:string|null;round_id:string|null;kind:'league'|'friendly';home_club:string;away_club:string;kickoff_at:string;status:'scheduled'|'frozen'|'computing'|'done'|'failed'|'postponed';
 /** When the broadcast starts (kickoff, a delayed kickoff, or the postponed slot); set once a result exists. */
 live_from:string|null;
 /** The new slot of a postponed match (the next day at 20:00). */
 postponed_to:string|null}
/** A result row: readable only from live_from + duration (row security). */
export interface Result {match_id:string;competition_id:string|null;round_id:string|null;home_club:string;away_club:string;home_goals:number;away_goals:number;stats:[Record<string,number>,Record<string,number>];duration:number;engine_build:string;live_from:string;visible_from:string;
 /** Per-player lines (lib/ballers/stats.ts readPlayerStats); null before the record existed. */ player_stats?:unknown}
export interface Competition {id:string;space:string;season:number;name:string;status:'open'|'finished';ends_at:string|null;
 /** Set while the operator has paused the league: no round is frozen on its own. */
 paused_at:string|null}
export interface ArchiveRow {club:string;name:string;code:string;played:number;won:number;drawn:number;lost:number;gf:number;ga:number;points:number}
export interface Archive {competition_id:string;season:number;name:string;champion_club:string|null;standings:ArchiveRow[];finished_at:string}
/** One enabled idea as the players carry it: frozen with the prep at the lock. */
export interface PrepPlan {idea:string;key:string;name:string;plan:Record<string,unknown>;lineup:string[];accent:number;
 /** slot -> player who takes over an idea player not in this five (P5). */ assign?:Record<string,string>}
/** A round's prep, stored server-side for every club when the round is drawn:
 * 'carried' = last round's plan, 'defaults' = the club defaults, 'manager' = saved. */
export interface Prep {club_id:string;round_id:string;lineup:string[];bench:string[];captain:string;formation:Formation;style:Style;approach:Approach;ideas:string[];accents:Record<string,number>;plans:PrepPlan[];origin:'defaults'|'carried'|'manager';
 substitution_orders:PrepOrder[];idea_lineups:Record<string,Record<string,string>>;updated_at:string;
 /** Keeper / free kicks / taker (lib/ballers/match-settings.ts); `{}` = defaults. Absent before its migration. */ match_settings?:MatchSettings}
export interface Idea {id:string;club_id:string;plan_key:string;name:string;plan:Record<string,unknown>&{id:string;name?:string};lineup:string[];updated_at:string}

/** Each slot is named for the role the engine gives it (packages/football-engine
 * src/model.ts `shapes`: 1-2-1 = CB, W, W, ST; 2-2 = CB, CB, W, W; 2-1-1 =
 * CB, CB, CM, ST). The slot sets the role, whoever plays it; the positions on
 * a player's card never change it. `line`: what the shape gives you, under the
 * formation picker. 2-1-1 stays here for old replays and past preps only: no
 * picker offers it (BOARD_FORMATIONS). */
export const FORMATIONS:Record<Formation,{slots:[string,string,string,string,string];line:string;points:[number,number][]}>={
 // Engine-metre positions (x 0..48 attacking right, y -15..15) for the lineup pitch.
 '1-2-1':{slots:['Goalkeeper','Centre-back','Left winger','Right winger','Striker'],line:'A centre-back, two wingers side by side and a striker. One man stays back; the wingers hold the flanks and attack the box.',points:[[3.6,0],[12.5,0],[24,-7],[24,7],[35,0]]},
 '2-2':{slots:['Goalkeeper','Left centre-back','Right centre-back','Left winger','Right winger'],line:'Two centre-backs and two wingers. Two stay back, though at Bodies forward 5 one of them joins attacks in their half; the wingers do the attacking, and whichever is further forward follows your Striker setting.',points:[[3.6,0],[12.5,-5.5],[13,5.5],[29,-6],[31,5]]},
 '2-1-1':{slots:['Goalkeeper','Left centre-back','Right centre-back','Midfielder','Striker'],line:'Two centre-backs, a midfielder and a striker, one behind the other. The only shape with a man in the middle to link play.',points:[[3.6,0],[12.5,-5.5],[13,5.5],[24,0],[35.5,0]]},
};
/** What the formation is about (the plan page, above its options). */
export const FORMATION_ABOUT='Where your four outfield players stand. Each slot sets a role, whoever plays it.';
/** What a style is about (the plan page, above its options): a starting point for every setting. */
export const STYLE_ABOUT='What your team is: how it moves the ball and what it does the moment it wins it back. Picking one also puts the settings below back to its own.';
/** Where the positions on a player's card meet the slots (player cards, the lineup). */
export const ANY_SLOT='Anyone can play any slot: the slot sets his role, his skills decide how well.';
/** The four identities (owner's wording, 22 Oct 2026; STYLES-AS-IDENTITIES.md). `headline`: what the style is, in
 * a few words, the first thing a player sees; `line`: what it does and what it costs. No line claims a matchup or a
 * "suits" until one is measured. Each claim is the engine's: Short's one-touch (style.ts STYLE.combinations, the
 * receiver plays it first time when he is free) and Keep it (ON_WIN.secure: Patient for 3 s after every regain, a
 * break only a clear man up); Counter's surge (REWRITES.counter: 8 s, Direct, at least 4 forward, the lead forward
 * on In behind unless he is a Pivot or Drops deep, which keep their job); Direct (PROGRESSION.direct: runs in behind
 * from anywhere, the Direct delivery ranks passes by ground gained); Balanced (Mixed + Balanced: no rewrite, no
 * trait). */
export const STYLES:Record<Style,{label:string;headline:string;line:string}>={
 balanced:{label:'Balanced',headline:'No special trait',line:'Keeps it or goes forward as each attack offers, and breaks when a break is on. No big strength.'},
 combinations:{label:'Short',headline:'One-touch passing',line:'When the receiver is free he plays it first time, and the side keeps the ball after winning it. Slower to goal, and breaks only with a clear extra man.'},
 direct:{label:'Direct',headline:'Ball forward fast',line:'The ball goes forward fast from anywhere, with runs in behind at any time and passes picked for the ground they gain. Gives it away more.'},
 counter:{label:'Counter',headline:'The surge',line:'The moment it wins the ball, for eight seconds more men go forward, the ball goes forward fast and a Mixed or In behind striker runs in behind, then it settles. Gives it away more in those seconds.'},
};
/** Mirror of the engine's teamApproaches presets (and SQL private.ballers_preset),
 * "On losing it" (`onLoss`) included. Short combinations counter-press
 * (B3, decided 2026-09-30); Balanced, Direct and Counter stay Balanced
 * (Counter moved off Regroup in R1, 2026-10-01: Regroup cost Counter in four
 * bundles in a row and stays one choice away for a manager who wants it).
 * Short plays width Standard + striker Pivot (style-identity round, migration
 * 20261001202728_ballers_striker_pivot); a club that stored the old Short
 * (Narrow + Drops deep) keeps it, and now shows as "Adjusted". Change
 * this table AND SQL private.ballers_preset together (verificare/
 * ballers-approach pins the two). Stored approaches without the field read as
 * 'balanced', so clubs already on a preset keep playing it as before.
 * The ONE source of the four presets (engine as data, S1): the engine's
 * teamApproaches, the newest ballers_preset migration and the schema.sql
 * mirror are asserted equal to this table by verificare/ballers-preset-source. */
/** The fine-tunes each style starts from (everything but its base). */
export const STYLE_TUNES:Record<Style,Omit<Approach,BaseKey>>={
 balanced:{width:'standard',line:'standard',press:'balanced',commit:3,striker:'mixed',onLoss:'balanced'},
 combinations:{width:'standard',line:'high',press:'balanced',commit:3,striker:'mixed',onLoss:'counterpress'},
 direct:{width:'wide',line:'standard',press:'balanced',commit:4,striker:'run',onLoss:'balanced'},
 counter:{width:'standard',line:'deep',press:'selective',commit:3,striker:'mixed',onLoss:'balanced'},
};
/** A preset = the style's base (approach.ts STYLE_BASE) + its fine-tunes, keys in the stored order. */
const preset=(st:Style):Approach=>{const b=STYLE_BASE[st],t=STYLE_TUNES[st];
 return {progression:b.progression,width:t.width,line:t.line,press:t.press,commit:t.commit,striker:t.striker,transition:b.transition,onLoss:t.onLoss};};
export const PRESETS:Record<Style,Approach>={balanced:preset('balanced'),combinations:preset('combinations'),direct:preset('direct'),counter:preset('counter')};
/** One fine-tune row. `line` (per option): the short line shown under the row
 * for the selected option, written for the manager: what he gets, what it
 * costs, and which squad or opponent it suits. A "suits" claim names only a
 * skill the engine actually uses for that setting. Every line is checked against the engine
 * (packages/football-engine/src); the code that backs each is noted beside
 * it. Change a line only together with the behaviour it describes. */
export interface ApproachOption {value:string;label:string;line:string}
/** `about`: what the setting itself is about, in one line (the plan page shows it above the
 * options). Like the option lines, it says only what the engine does with the setting. */
export interface ApproachField {key:keyof Approach;label:string;about:string;options:ApproachOption[]}
/** The fine-tune rows a manager can change, in screen order: Width, Line, Press, Striker, Bodies forward, On losing
 * it. Progression and On winning it are no longer rows (styles as identities, slice 1, owner's decision 22 Oct
 * 2026): they are the style's base (BASE_FIELDS below keeps their words for what a past prep played). */
export const APPROACH_FIELDS:ApproachField[]=[
 // practice-shape.ts WIDTH (lane, pull, hold, follow, reach, allowance, inward), buildUpSpread; practice-coordination.ts hold-width job.
 // Wide no longer says "Hurts a side that presses hard": the width check (2026-10-11, 234 matches, branch
 // width-check) found no support for it (flat against the press in 1-2-1, likely worse in 2-2).
 // Board audit (2026-10-15, settings audit b0174c30): the three shapes look different but goals for and
 // against stay flat, so no option claims a gain or a cost any more (Narrow's "a switch hurts you", Wide's
 // "gaps open in your middle" and the "middle is shut" never landed). They say only how the team spreads.
 // (2026-10-16, recon finding 13) Width also sets the defending shape: practice-defending.ts BALANCE_Y (the free
 // man's tuck across: narrow 1 / standard 2.5 / wide 4.5 m) and WIDTH_SAG (how far a marker sags off a far man:
 // narrow x1.25 / wide x0.75), so the lines say so, still with no gain or cost.
 {key:'width',label:'Width',about:'How far apart your players spread with the ball, and how far across they cover without it.',options:[
  {value:'narrow',label:'Narrow',line:'Your players stay close together with the ball. Without it they tuck into the middle and give their far man room.'},
  {value:'standard',label:'Standard',line:'In between: some width, without spreading right out. Fits any squad.'},
  {value:'wide',label:'Wide',line:'Your players spread right out towards the touchlines with the ball. Without it they stay closer to their far man.'}]},
 // Without the ball (settings-truth round, 2026-10-04): practice-defending.ts DANGER_R (who is marked, by the
 // Line), BLOCK (how high the block sits and how hard it squeezes up when their man is pressed or plays it
 // back: blockDepth), ENGAGE_LINE; their furthest forward is always somebody's man, marked goal-side of him
 // (markSpot never level with him), or the balance stays goal-side of him (balanceAim). practice-keeper.ts
 // keeperLineDepth: a keeper plays off his back line (not one who stays on his line). With the ball:
 // practice-shape.ts LINE_CUSHION / lineHeight, practice-build-up.ts LINE_BUILD_CAP.
 {key:'line',label:'Line',about:'How high your team defends, and how hard it steps up when their man is under pressure or plays it back. Your last defender always keeps their furthest forward in front of him.',options:[
  {value:'deep',label:'Deep',line:'Stops quick forwards getting in behind, but you sit deeper and give up ground. Suits defenders who read the game.'},
  {value:'standard',label:'Standard',line:'The middle ground: steps up a little when their man is under pressure. Suits defenders who read the game.'},
  {value:'high',label:'High',line:'Steps up hardest when their man is under pressure. Beat it and your defenders face runners one on one. Suits quick defenders.'}]},
 // practice-defending.ts ENGAGE / ENGAGE_LINE (where the man on the carrier engages: 22 / 31 m / anywhere) and HOLD
 // (how far off he waits before that: 5.5 / 4 / 2.5 m), DANGER_PRESS / WATCH_PRESS (Aggressive marks more of their
 // men further out), PRESS_SAG, the Aggressive double; practice-coordination.ts the trap (TRAP_NEAR, trapTrigger)
 // Selective (settings close-out, 2026-10-04, gp-board-truth 12 seeds): the trap, 22-34.6 m from our goal, is clear;
 // its man stands further off the carrier than Balanced's only between the two engage points (23-31 m, +0.64 m);
 // deeper in their half he is not further off (6.02 against 6.88 m), so the line claims neither "gives them the
 // build-up" nor "stays compact" (its block is not measured deeper or tighter). The cue: their man near the
 // touchline, turned to his own goal, or just receiving a forward pass (trapTrigger).
 // Aggressive (board audit 2026-10-15): "a quick switch beats it" was never shown. Its goals trade (for +0.27,
 // against +0.21) was measured only on the older b0174c30 build, so the line says what the players do, no outcome
 // (owner: honest and thin while the engine changes).
 {key:'press',label:'Press',about:'When and how hard your players go after the ball when the other side has it.',options:[
  {value:'selective',label:'Selective',line:'Springs a two-man trap around halfway on a cue, holding off a little until then. Suits defenders who read the game.'},
  {value:'balanced',label:'Balanced',line:'Presses when it’s on without chasing everything. Fits any squad.'},
  {value:'aggressive',label:'Aggressive',line:'Hunts the ball and crowds their options, and runs the most. Suits fit players.'}]},
 // practice-coordination.ts pivotAnchor / pivotPoint / thirdManSpots, the link and depth offers; practice-attacking-space.ts setting; practice.ts runValue / showValue.
 // Settings round (engine d3edd2f3; evidence 2026-10-03-settings-build, verificare/gp-board-truth):
 // In behind waits on their last outfielder's shoulder (shoulderPost) and runs past him, no run when their
 // line is near their goal; he receives fewer balls to feet and lays off less. Drops deep holds a post
 // between their lines (LINK_GAP) and a team-mate is offered the run beyond him; he is in the box less.
 // Pivot: a pass preference into his feet while he shows, which did not raise the share of passes to him
 // (passes to him fell in the settings audit, b0174c30), so its line says where he stands, never "a target".
 // In behind (board audit 2026-10-15): it worked even against a deep line (settings audit), so the line no
 // longer says a deep defence leaves him no room; on 76d73f5c (2026-10-15-default) he still gets beyond their
 // last man more, with no clear edge in goals. No skill suits any of them more: no "Suits" line.
 {key:'striker',label:'Striker',about:'What your striker does when you have the ball (in 2-2, whichever winger is further forward).',options:[
  {value:'mixed',label:'Mixed',line:'Your striker plays his own game, coming short or going in behind as he sees it. Fits any striker.'},
  {value:'link',label:'Drops deep',line:'He holds a spot between their lines and comes short when a pass is on, and a team-mate can run beyond him. Less in the box.'},
  {value:'pivot',label:'Pivot',line:'He stays up against their last defender, holding his spot instead of coming short or running in behind.'},
  {value:'run',label:'In behind',line:'He waits on their last defender’s shoulder and runs in behind. He comes back to help the build-up less.'}]},
 // practice-rest-defence.ts commitBounds / commitHold (a strong preference kept by discipline, in their half)
 // 1 and 2 are retired from the board (owner, 15 Oct 2026; approach.ts boardApproach): 1 cost goals and
 // bought no safety, 2 played like 3. 4 (board audit): only about 0.06 fewer men back, so it no longer says
 // "fewer back"; it is a "join in more" setting, and its cost after a loss landed only for Balanced (+0.16
 // within 12 s, direct split 8ae8dc61; pooled borderline), so it claims none. 5: still two or more back about half
 // the time (settings audit), so neither "only one is back" nor "everyone piles forward"; its goals trade was
 // measured only on b0174c30, so 4 and 5 say what the players do (commitBounds), no outcome.
 // (2026-10-21, COPY-TRUTH) 4 and 5 now name their cost, which is what happens, not an outcome: an opponent
 // left free behind the ball weighs less in their arrangement (practice-exposure.ts, COMMIT.exposureBase/Per:
 // x0.76 at 4, x0.60 at 5).
 {key:'commit',label:'Bodies forward',about:'Once you are in their half: how many join the attack and how many stay back.',options:[
  {value:'3',label:'3',line:'Your players decide how many join each attack. Fits any squad.'},
  {value:'4',label:'4',line:'More of your players join each attack, so the man on the ball has company. They worry less about free opponents behind them.'},
  {value:'5',label:'5',line:'Your players join the attack in numbers, the most of any setting. They worry least about free opponents behind them.'}]},
 // practice-coordination.ts counterPressFires / counterPressRead (Counter-press goes whatever the numbers, Balanced
 // only a man up). Regroup (its drop and delay, practice-defending.ts intent / regroup) is retired from the board
 // (owner, 15 Oct 2026; approach.ts boardApproach): it cost at both ends. The engine still plays it for old inputs.
 {key:'onLoss',label:'On losing it',about:'What your team does in the first seconds after losing the ball.',options:[
  {value:'balanced',label:'Balanced',line:'Goes after the ball only with numbers around it, otherwise gets back into shape. Fits any squad.'},
  {value:'counterpress',label:'Counter-press',line:'Goes straight after the ball to win it back at once. Beat it and your pressers are out of the game. Suits good tacklers.'}]},
];

/** The two settings a style owns (its base: approach.ts STYLE_BASE). Never offered as rows; their words stay so a
 * past prep, a plan still waiting for its style or another club's last game can say what it played. */
export const BASE_FIELDS:ApproachField[]=[
 // team-approach.ts approachOptions (patient preference, purposeClock), practice-coordination.ts runStyle, practice-attacking-space.ts weight
 {key:'progression',label:'Progression',about:'How you move the ball up the pitch: keep it and build, or go forward quickly.',options:[
  {value:'patient',label:'Patient',line:'Keeps the ball longest, but is slower to goal and gives them time to set. Suits good passers who read the game.'},
  {value:'mixed',label:'Mixed',line:'Keeps it or goes forward, whichever each attack offers. No big strength or weakness. Fits any squad.'},
  {value:'direct',label:'Direct',line:'Gets the ball forward fast and makes the most shots, but gives it away more. Suits quick forwards.'}]},
 // team-approach.ts approachInPossession / counterOn / approachForSituation; practice-transition.ts threshold.
 // (pre-push, 4 Oct) Counter no longer promises "your striker ready on their last defender's shoulder": a Pivot or
 // Drops deep striker keeps his own job in the counter window (approachInPossession), so it holds only for two of four.
 // Keep it (board audit 2026-10-15): it handed the ball back more, not less (settings audit b0174c30), so
 // the line no longer says "loses it least"; it says only what the players do and what that costs.
 // (2026-10-16, recon finding 13) Counter's window (team-approach.ts approachInPossession, 8 s after a regain):
 // Direct progression, Bodies forward at least 4, and the lead forward on In behind unless the Striker setting is
 // Pivot or Drops deep (those keep their job), hence "a Mixed or In behind striker".
 {key:'transition',label:'On winning it',about:'What your team does in the first seconds after winning the ball back.',options:[
  {value:'balanced',label:'Balanced',line:'Breaks when it’s on, otherwise keeps playing your usual game. Fits any squad.'},
  {value:'secure',label:'Keep it',line:'Doesn’t rush after winning it: breaks only with a clear extra man, so it makes the fewest breaks.'},
  {value:'counter',label:'Counter',line:'Breaks at once: more bodies join for a few seconds and a Mixed or In behind striker runs in behind. Loses it more.'}]},
];

/** Options no longer offered (owner, 15 Oct 2026; approach.ts boardApproach), kept only so a past
 * prep that played one still shows its name. Never listed as a choice. */
export const RETIRED_OPTIONS:Partial<Record<keyof Approach,ApproachOption[]>>={
 commit:[{value:'1',label:'1',line:'At least two stayed back when you attacked.'},{value:'2',label:'2',line:'At least one stayed back when you attacked.'}],
 onLoss:[{value:'regroup',label:'Regroup',line:'Everyone sprinted back behind the ball.'}],
};

/** What stands where Width would in 2-1-1, which has no Width choice (approach.ts widthChosen):
 * how that shape spreads with the ball (width check, 2026-10-11: the centre-backs split wider to
 * start attacks and the midfielder stays central). `we` is the plan paragraph's own voice. */
export const WIDTH_NONE_WE='No wingers in this shape: our centre-backs split to start attacks and the midfielder links play through the middle.';

/** Keeper and free-kick calls (Match prep, and a plan's set pieces): the one
 * source of their words. A keeper option's `does` reads after his name
 * ("Lulu stays home: …"); `line` is the same with "He". 'own' and 'mixed' are
 * the defaults (stored as absent). match-settings.ts KEEPER_SWEEP;
 * practice-restarts.ts freeKickCallAims (the call sets the routine in their
 * half) and practice-set-pieces.ts FK_LEAN / FK_CONTEST / FK_PLAN_B (the taker
 * follows the call: he accepts a contested ball into the box for Into the box,
 * and leaving the call for the other kind of kick costs him). practice-keeper.ts
 * keeperLineDepth and practice-keeper-support.ts KEEPER_HOME: a keeper who stays
 * on his line does not play off his back line or offer a pass back from outside
 * his area; practice-carry.ts keeperNetWeight: he minds the goal he leaves most,
 * so he keeps the ball in his area (a price since 15 Oct, no longer a hard guard).
 * The lines describe what the call does, never how often free kicks come or
 * how much they decide (owner, 3 Oct). */
type KeeperCall='own'|'line'|'sweeper';
const keeperCall=(value:KeeperCall,label:string,does:string)=>({value,label,does,line:`He ${does}`});
/** What the keeper call is about (the plan page, above its options). */
export const KEEPER_ABOUT='How far your keeper comes off his line: for balls in behind, for high balls and when you have the ball.';
export const KEEPER_OPTIONS:readonly {value:KeeperCall;label:string;does:string;line:string}[]=[
 keeperCall('own','As usual','plays his own way.'),
 keeperCall('line','Stay on line','stays home: he comes for a ball in behind only when he’s clearly first, claims less in the air and stays in his area when you have the ball.'),
 keeperCall('sweeper','Sweeper','comes out for balls in behind and claims more in the air, but if he’s late the goal is open.'),
];
/** What the free-kick call is about (the plan page, above its options). */
export const FREE_KICK_ABOUT='How your team sets up for a free kick in their half: where your players stand and what the taker looks for.';
export const FREE_KICK_OPTIONS:readonly {value:'short'|'mixed'|'delivery';label:string;line:string}[]=[
 {value:'short',label:'Short',line:'Two players come short at different angles and one waits in the box. The taker looks for the short pass to keep the ball.'},
 {value:'mixed',label:'Mixed',line:'Your usual layout. The taker reads each kick: short, into the box or a shot.'},
 {value:'delivery',label:'Into the box',line:'Two players attack the posts and one waits on the edge for the knock-down. The taker looks for a ball into the box; if it’s cleared, nobody is back.'},
];
/** Same fine-tune, reading a missing "On losing it" as 'balanced' on either side. */
/** Whether two approaches play the same. With a `formation` that has no Width choice (2-1-1), Width is left out. */
export const sameApproach=(a:StoredApproach,b:StoredApproach,formation='')=>{const x=playedApproach(formation,withOnLoss(a)),y=playedApproach(formation,withOnLoss(b));return (Object.keys(PRESETS.balanced) as (keyof Approach)[]).every(k=>String(x[k])===String(y[k]));};

export const ARCHETYPES:Record<Archetype,string>={wall:'Shot-stopper',libero:'Sweeper keeper',anchor:'Anchor',ballwinner:'Ball-winner',architect:'Playmaker',motor:'Engine',artist:'Dribbler',runner:'Runner',pivot:'Target man',predator:'Poacher',maverick:'Maverick'};
/** What each player type brings, and what it costs (creation, player cards). */
export const ARCHETYPE_PROFILE:Record<Archetype,{good:string;risk:string}>={
 wall:{good:'Protects the goal; leaves distant balls to his defenders.',risk:'Plainer passing, less ground covered behind the line.'},
 libero:{good:'Comes out for balls in behind and helps build play.',risk:'Arrive late and the goal is open. Less sure at shot-stopping.'},
 anchor:{good:'Keeps the middle shut.',risk:'Rarely gets forward.'},
 ballwinner:{good:'Wins balls that are hard to win.',risk:'Throws himself in, and fouls more than most.'},
 architect:{good:'Starts an attack with one pass.',risk:'Needs protecting in duels.'},
 motor:{good:'Supports, presses and gets back.',risk:'Constant effort can leave nothing in reserve.'},
 artist:{good:'Takes a man out of the game with a feint.',risk:'One more trick when the pass was simple.'},
 runner:{good:'Attacks the space behind the defence.',risk:'Without space, waits for a run that never comes.'},
 pivot:{good:'Holds the ball until the others arrive.',risk:'Slow to turn towards goal.'},
 predator:{good:'Finds the space for the last touch.',risk:'Helps less in build-up.'},
 maverick:{good:'Tries things nobody else sees.',risk:'Wastes balls on very bold ideas.'},
};
export const TEMPERAMENTS:Record<Temperament,string>={cold:'Ice cold',fuse:'Short fuse',diva:'Prima donna',ambitious:'Ambitious',heart:'Dressing-room heart'};
export const ROLE_NAMES:Record<Role,string>={GK:'Goalkeeper',CB:'Centre-back',FB:'Full-back',DM:'Defensive mid',CM:'Midfielder',AM:'Attacking mid',W:'Winger',ST:'Striker'};
export const SKILL_LABELS:[keyof EnginePlayer['skills'],string][]=[['passing','Passing'],['control','Control'],['finishing','Finishing'],['defending','Defending'],['pace','Pace'],['strength','Strength'],['stamina','Stamina'],['reading','Reading'],['aerial','Aerial'],['setPieces','Set pieces'],['keeping','Keeping']];
export const isKeeper=(p:Pick<Player,'roles'>)=>p.roles.includes('GK');
export const roleLine=(p:Pick<Player,'roles'>)=>p.roles.map(r=>ROLE_NAMES[r]).join(' · ');
/** The attributes worth showing for a player: keepers lead with keeping. */
export function keySkills(p:Player):[string,number][]{
 const keys:(keyof EnginePlayer['skills'])[]=isKeeper(p)?['keeping','reading','passing','pace']:['passing','control','finishing','defending','pace','stamina'];
 return keys.map(k=>[SKILL_LABELS.find(([key])=>key===k)![1],p.skills[k]]);
}

// ---------- calendar ----------
/** The next round still ahead (kickoff in the future), else null. */
export function nextRound(rounds:Round[],now=Date.now()):Round|null{
 return rounds.filter(r=>Date.parse(r.kickoff_at)>now).sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at))[0]??null;
}
/** The open league's pause, if the operator paused it. */
export const openLeague=(competitions:Competition[]|undefined)=>competitions?.find(c=>c.status==='open')??null;
export const leaguePaused=(competitions:Competition[]|undefined)=>!!openLeague(competitions)?.paused_at;
/** The open league is the Preseason (season 0), where joins can reshuffle upcoming fixtures. */
export const inPreseason=(competitions:Competition[]|undefined)=>{const l=openLeague(competitions);return !!l&&l.season===0&&!l.paused_at;};
/** While paused, dates stop meaning anything: the round ahead is the first one
 * still open, whatever its (possibly past) date says. */
export function pausedRound(rounds:Round[],competitionId:string|undefined):Round|null{
 return rounds.filter(r=>r.status==='open'&&(!competitionId||r.competition_id===competitionId)).sort((a,b)=>a.number-b.number)[0]??null;
}
export type LockState='open'|'locked';
export function lockState(round:Pick<Round,'locks_at'|'status'>,now=Date.now()):LockState{
 return round.status==='open'&&now<Date.parse(round.locks_at)?'open':'locked';
}
export function countdown(ms:number){const s=Math.max(0,Math.floor(ms/1000));return {d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};}
const fmt=(opts:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',...opts});
const dayFmt=fmt({weekday:'short'}),timeFmt=fmt({hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),dateFmt=fmt({weekday:'short',day:'numeric',month:'short'});
export const day=(t:number|string)=>dayFmt.format(new Date(t));
export const clock=(t:number|string)=>timeFmt.format(new Date(t));
export const dateLine=(t:number|string)=>dateFmt.format(new Date(t));

// ---------- a match's state on the clock ----------
/** Match length (the engine plays 15:00). */
export const MATCH_SECONDS=900;
/** The longest a broadcast can run: full time plays out the attack in progress for
 * at most LAST_ATTACK_MAX (engine practice-match.ts). A match's real end is its
 * replay header's `duration`; this is only for screens that don't hold it. */
export {LAST_ATTACK_MAX};
export const BROADCAST_MAX_SECONDS=MATCH_SECONDS+LAST_ATTACK_MAX;
/** Timeline minute marks: every minute up to a Quick match (and its last attack), else every 3. */
export const tickEvery=(duration:number)=>duration<=QUICK_SECONDS+LAST_ATTACK_MAX?60:180;
/** A practice match's short length. Named "Quick", never "Short": Short is a style. */
export const QUICK_SECONDS=300;
/** The two practice lengths as a picker lists them. */
export const MATCH_LENGTHS=[{value:MATCH_SECONDS,label:'Full match · 15:00'},{value:QUICK_SECONDS,label:'Quick match · 5:00'}] as const;
/** "Quick match" / "Full match": a practice run's length in words. */
export const lengthWord=(seconds:number)=>seconds<=QUICK_SECONDS?'Quick match':'Full match';
export type MatchState='open'|'locked'|'delayed'|'postponed'|'inPlay'|'final'|'paused';
/** What a fixture is right now. The database decides what is readable; this
 * only names it. 'final' needs the result row (readable after full time).
 * 'paused': the league is paused and this fixture was never frozen, so it
 * will not play on its own (a match frozen before the pause, or pulled by
 * hand, still runs its normal course). */
export function matchState(m:Pick<Match,'kickoff_at'|'live_from'|'postponed_to'>&{status?:Match['status']},hasResult:boolean,now=Date.now(),paused=false):MatchState{
 if(hasResult)return 'final';
 if(paused&&!m.live_from&&!m.postponed_to&&(m.status??'scheduled')==='scheduled')return 'paused';
 const kickoff=Date.parse(m.kickoff_at),live=m.live_from?Date.parse(m.live_from):null;
 if(live!==null&&now>=live)return 'inPlay';
 if(m.postponed_to)return 'postponed';
 if(live!==null&&live>kickoff)return 'delayed';
 if(now>=kickoff)return 'delayed';
 return now>=kickoff-LOCK_MS?'locked':'open';
}
/** The new date a postponed fixture can promise. A 'failed' match (the
 * pipeline stopped retrying until an operator re-arms it) still shows "P",
 * but its postponed_to is only a placeholder: no date is promised. */
export const postponedDate=(m:Pick<Match,'postponed_to'>&{status?:Match['status']})=>m.status==='failed'?null:m.postponed_to;
/** The slot a fixture is shown at: its postponed date once it moved. */
export const slotOf=(m:Pick<Match,'kickoff_at'|'postponed_to'|'live_from'>)=>m.live_from??m.postponed_to??m.kickoff_at;

// ---------- fixtures and the table ----------
export function clubMatch(matches:Match[],roundId:string|null|undefined,clubId:string|null|undefined){
 if(!roundId||!clubId)return null;return matches.find(m=>m.round_id===roundId&&(m.home_club===clubId||m.away_club===clubId))??null;
}
export interface TableRow {club:Club;played:number;won:number;drawn:number;lost:number;gf:number;ga:number;points:number}
/** The table from results (the ones row security lets this viewer read, i.e.
 * matches past full time). No result yet: every club on zero, by name. */
export const tableResults=(results:Pick<Result,'home_club'|'away_club'|'home_goals'|'away_goals'>[])=>results.map(r=>({home:r.home_club,away:r.away_club,hs:r.home_goals,as:r.away_goals}));
export function standings(clubs:Club[],results:{home:string;away:string;hs:number;as:number}[]=[]):TableRow[]{
 return clubs.map(club=>{
  let won=0,drawn=0,lost=0,gf=0,ga=0,played=0;
  for(const r of results){if(r.home!==club.id&&r.away!==club.id)continue;const home=r.home===club.id,a=home?r.hs:r.as,b=home?r.as:r.hs;played++;gf+=a;ga+=b;if(a>b)won++;else if(a===b)drawn++;else lost++;}
  return {club,played,won,drawn,lost,gf,ga,points:won*3+drawn};
 }).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.club.name.localeCompare(b.club.name));
}

// ---------- squad ----------
export function squadOrder(players:Player[]){return [...players].sort((a,b)=>a.number-b.number);}
export function lineupFor(players:Player[],ids:string[]){return ids.map(id=>players.find(p=>p.id===id)).filter((p):p is Player=>!!p);}
export function benchFor(players:Player[],lineup:string[]){return players.filter(p=>!lineup.includes(p.id)).sort((a,b)=>a.number-b.number);}
/** Same rule the SQL doors enforce: five distinct squad players, keeper first. */
export function lineupProblem(players:Player[],lineup:string[]):string|null{
 if(lineup.length!==5||new Set(lineup).size!==5)return 'Pick five different players.';
 const picked=lineupFor(players,lineup);if(picked.length!==5)return 'Pick five players from your squad.';
 if(!isKeeper(picked[0]))return 'A goalkeeper starts in goal.';
 if(picked.slice(1).some(isKeeper))return 'Only one goalkeeper starts.';
 return null;
}
/** Swap a bench player into a slot. Keepers only swap with keepers. */
export function swapIn(players:Player[],lineup:string[],slot:number,benchId:string):string[]|null{
 const incoming=players.find(p=>p.id===benchId);if(!incoming||lineup.includes(benchId))return null;
 if(isKeeper(incoming)!==(slot===0))return null;
 const next=[...lineup];next[slot]=benchId;return next;
}
/** Ideas drawn for players who aren't starting now. */
export function ideaMissing(idea:Pick<Idea,'lineup'>,lineup:string[]){return idea.lineup.filter(id=>!lineup.includes(id));}
export const MAX_IDEAS_ON=3,MAX_IDEAS_SAVED=12;


// ---------- founding a club ----------
/** A three-character code from a club name (FC Prelungitorul -> FCP, Malpraxis -> MAL). */
export function codeFrom(name:string){
 const words=name.normalize('NFD').replace(/\p{M}/gu,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
 if(!words.length)return '';
 // Short words (FC, AS, CS) count whole; longer ones by their initial.
 const initials=words.map(w=>w.length<=3?w:w[0]).join('');
 return (initials.length>=3?initials:(initials+words[words.length-1].slice(1))).slice(0,3).padEnd(3,'X');
}
/** Mirrors the SQL check in ballers_create_club. */
export const validAnthem=(v:string)=>!v.trim()||/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[^\s<>"]{1,150}$/.test(v.trim());
/** Mirrors private.ballers_check_captain: letters first, 2-32 characters. */
export const validCaptainName=(v:string)=>/^\p{L}[\p{L} .'-]{1,31}$/u.test(v.trim());
/** A player's display name: everything after the first name (the whole surname), whitespace collapsed; a one-word name stays as is. Mirrors `short` in `private.ballers_draw`. */
export const shortName=(name:string)=>{const w=name.trim().split(/\s+/);return (w.length>1?w.slice(1):w).join(' ').slice(0,20);};

// ---------- the doors' refusals, in the world's words ----------
const REFUSALS:Record<string,string>={
 profile_required:'Sign in and claim your name in the clubhouse first.',
 idea_id:'This idea can’t be saved as it is. Start it again from a blank board.',
 ballers_closed:'Ballers isn’t open in this clubhouse.',
 club_exists:'You already run a club here.',
 no_club:'Found your club first.',
 name_taken:'Another club already has that name.',
 code_taken:'Another club already uses that code.',
 invalid_name:'Club names are 2–32 characters.',
 invalid_code:'The code is three letters or digits.',
 invalid_color:'Pick a kit colour.',
 invalid_crest:'Pick a crest.',
 invalid_motto:'Keep the motto under 80 characters.',
 invalid_lineup:'Pick a goalkeeper and four different outfield players.',
 invalid_tactics:'Pick a formation and a style.',
 invalid_approach:'One of those fine-tune settings doesn’t exist. Reload and pick again.',
 // board trim (migration 20261015200000_ballers_board_trim): a tab opened before it offering a retired choice
 retired_formation:'2-1-1 isn’t offered any more. Reload and pick 1-2-1 or 2-2.',
 retired_option:'That option isn’t offered any more. Reload and pick again.',
 invalid_ideas:'One of those ideas is no longer saved.',
 max_3_ideas:'Take at most three ideas into a match.',
 // Game plan switched off (lib/ballers/compat.ts): never reached by a club that was never switched on.
 plan_driven:'This match uses your plan. Plans are paused for your club, so it plays as picked. Change the five in Match prep.',
 no_plan_moves:'This match isn’t playing a plan’s moves any more.',
 // A tab opened before the club went on Game plan switching an idea on (go-live S1, migration ballers_moves_off_prep).
 moves_off:'Your club is on plans now, and moves are coming soon. Reload the page.',
 max_12_ideas:'Keep at most twelve ideas.',
 locked:'Too late — your players already have their instructions.',
 unknown_round:'That round is gone. Reload.',
 portraits_exhausted:'The league is full.',
 invalid_captain:'Your captain has to be one of the five who start.',
 invalid_captain_name:'Give your captain a name (letters, 2–32).',
 invalid_captain_face:'Pick one of the six faces.',
 invalid_swaps:'Replace at most three players, never the captain.',
 invalid_anthem:'The anthem is a YouTube link (https).',
 invalid_identity:'Check the club’s name and kit.',
 invalid_captain_tendencies:'Spend all three tendency points, at most two on any one.',
 invalid_chant:'Keep the chant under 40 characters.',
 invalid_voice:'Check your lines: three per moment at most, 90 characters each, and only the slots shown.',
 invalid_accents:'An idea’s emphasis runs from 0 to 100.',
 invalid_substitutions:'Check the substitutions: a bench player on, a starter (or someone brought on) off, keepers only for keepers.',
 invalid_idea_lineups:'Each idea part goes to a different outfield starter.',
 invalid_match_settings:'Check the keeper and free kicks: the set-piece taker has to be one of your four outfield starters.',
 identity_locked:'The name and code are locked for this season.',
 faces_changed:'Someone just signed one of these players for another club. Here is your squad as it stands now.',
 invalid_emphasis:'An idea’s emphasis runs from 0 to 100.',
 crest_upload:'Your crest didn’t upload, so nothing was saved. Try again, or pick a PNG, WebP or JPEG under 1 MB.',
 crest_too_big:'That crest is over 1 MB once cropped. Zoom in a little or pick a smaller image.', invalid_patch:'That change isn’t one the club allows.',
 invalid_prep:'Check the lineup and the ideas.',
 unknown_profile:'Sign in again.',
 max_12_styles:'Keep at most twelve styles. Save over one by using its name.',
 invalid_style_name:'Style names are 1–40 characters.',
 unknown_club:'That club isn’t in this league.',
 unknown_style:'That style is already gone.',
 invalid_style:'Pick one of the four styles.',
};
/** A request that never reached the club (offline, dropped connection). */
const OFFLINE=/Failed to fetch|NetworkError|Load failed|fetch failed|network/i;
export function refusal(error:unknown){
 const message=typeof error==='object'&&error&&'message' in error?String((error as {message:unknown}).message):String(error);
 return REFUSALS[message]??(OFFLINE.test(message)?'No connection, so nothing changed. Try again.':'That didn’t go through. Try again.');
}
