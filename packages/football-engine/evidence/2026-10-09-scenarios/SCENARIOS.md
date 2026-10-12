# Manager scenarios: the fixture set and the harness

Written 2026-10-09, for [ENGINE-MATCHUPS-DIRECTION.md](../../../../deliverables/ballers-redesign/ENGINE-MATCHUPS-DIRECTION.md) §3. Engine 56fc996d.

- **No result matches were played.** The setups for scenarios 2–4 below were written before any match of them ran. The only matches played were a 7-match smoke test, to prove the harness runs (results not read or reported).
- The database was only read (SELECT through the Supabase MCP). No official match seed was read: `ballers_match_inputs` was never queried.
- Each fixture is a frozen snapshot. Every side file in `sides/` is `private.ballers_input_side(club, round)::text` byte for byte. Its md5 equals the server's (`sides/CHECKSUMS.json`), and `run.mjs` refuses to play a side whose md5 has changed.
- A manager can still change a stored prep before the lock. The snapshot is the prep as of 2026-10-08 21:47 UTC.

## The set

| # | Fixture | Ours | What it stresses that the others don't |
|---|---|---|---|
| 1 | F.C Chior Dior v Neo-Testament (global R4) | Chior Dior | An AI Counter side of three Speedsters who sit deep and break. This is the first study, unchanged. |
| 2 | FC Prizantemele v Trăsnetul Malmö (global R4) | Prizantemele | Human v human, against a Direct opponent. Our stored prep is the untouched default, with our best finisher at centre-back and our best defender on the bench. |
| 3 | Ceata Mentala v Malpraxis (global R5) | Ceata Mentala | An Aggressive press. A tiredness dilemma: our best defender has stamina 4. A youngster's minutes. |
| 4 | FC Directia Darmanesti v Inter (global R6) | Directia | A quality mismatch: the underdog against the league's strongest squad. |

Every scenario has the stored prep as its reference, three blind setups, and one control. The control keeps the opponent's players and changes one thing:

| # | Control | Kind | The question it asks |
|---|---|---|---|
| 1 | Neo on the Balanced preset | plan | Do the setups win *because of* Neo's Counter? |
| 2 | Trăsnetul on Short combinations | plan | Does the answer to Direct only pay against Direct? |
| 3 | Malpraxis on their style's own Counter preset (the Aggressive press taken out) | plan | Does "pass through the press" only pay against a press? |
| 4 | Inter without Thuram | condition (key player out) | Does "shut the door on their runner" only pay when the runner plays? |

Why these three, out of the candidates in the brief:
- **Aggressive press and Direct.** Malpraxis (Counter style, press Aggressive, 4 forward) and Trăsnetul (Direct) are the opponents the press and Direct items in §1 of the direction are about. Inter is also Direct with an Aggressive press, but scenario 4 is there for the quality gap.
- **Human v human.** Of the global R4 fixtures, Prizantemele v Trăsnetul is the human v human game whose opponent has the most distinct style. Roman City v Ceata Mentala is two Balanced/Direct sides.
- **Tiredness and a youngster.** Ceata Mentala is the clearest case in the league:
  - Capac (CB/DM, defending 9, reading 9, a gem) has stamina 4, the lowest of any outfielder in a human club's five.
  - Pătlăgea (21) scored 4 and set up 3 in his two starts. He was dropped in round 3 and stayed on the bench when two new signings came in.
  - Two 18-year-olds start.
  - Stage 1 growth went live on 8 Oct, so minutes now grow a young player.
- **Squad mismatch.** Inter's starting five averages skill 5.91, the highest in the league. They have won 8-3, 8-5 and 7-2. Directia's five averages 5.56, and their squad is four playmakers and one real defender. Round 6 is the next Inter fixture against a human club.
- **Best players don't fit the stored plan.** This comes with scenario 2 (Prizantemele's default lineup) and partly with scenario 3 (Capac plays left wing in Ceata Mentala's prep).

Not picked: the `test` space. Its two human clubs are Vlad's test sides, and global gives better cases.

---

## How the setups were written

Each setup was written as Chior Dior's were (`../2026-10-08-chior-dior-matchup/SETUPS.md`), using only what the app shows a manager:
- Match prep › Scouting: the opponent's last shape, last 3 results, top scorer and assists, keeper saves.
- The opponent's team page: player types and skill numbers and words.
- Our own cards and results.
- The setting descriptions (`APPROACH_FIELDS`, keeper and free-kick lines in `lib/ballers/league.ts`).

Only choices the live app allows were used:
- formation, the eight settings, the keeper call, the free-kick call and taker, the five and their slots;
- up to three substitution orders, built from `Subs.tsx`: tired codes 97/95/92, "not before" from {0, 2:00, 5:00, 7:30, 10:00, 12:00}, no "not before" on a half-time order.

`run.mjs` checks every arm against these rules before it plays.

The known traps are avoided on purpose:
- Every order names who goes off, so "most tired" can never take off the best finisher.
- Every "when tired" order has a "not before" of 7:30 or later, because "Tired" actually fires around 6:00, not the 9:30 the picker says.

**What is not a lever:**
- Moves are off.
- The captain never reaches the engine.
- Corners go to whoever is nearest.

---

## Scenario 1: F.C Chior Dior v Neo-Testament

- **Fixture:** global round 4, match `2539f719`, Chior Dior at home.
- **Snapshot:** the study's own `../2026-10-08-chior-dior-matchup/snapshot.json`.
- **Seeds:** 720000+ main, 730000+ control, the same as the study. Match ids stay `chior-study-<seed>`.

The stored preps, the three setups and their rationales are unchanged; see that study's `SETUPS.md` and `FINDINGS.md`.

| Arm | What it is |
|---|---|
| `prep` | The stored prep: carried "Direct plan", 1-2-1 Direct. |
| `lockDoor` | A "Lock the door" |
| `huntPress` | B "Hunt their heavy touches" |
| `wingsAttack` | C "Two dribblers at one defender" |
| `home`, `huntPress2` | Extras from the study, not in the default plans. |

- **Neo's stored prep:** 2-2 Counter (deep, Selective press, 3 forward, counter on winning it), Psalm; Pocăitu, Clopot; Mătanie, Apostol. Carried AI prep.
- **Control `neoBal`:** Neo's same five on Balanced.
- **Headline setup:** `huntPress`. Trim arms: prep, huntPress, wingsAttack.
- **Checked:** `analyze.mjs` on the study's own rows reproduces every number in its FINDINGS (for example huntPress +0.94 ±0.33 chances, +0.22 ±0.49 GD).
- **One thing the study's text missed:** its new matchup check finds the Home plan's *points* edge differs between the two opponents: −0.77 ±0.27 v Counter and −0.20 ±0.44 v Balanced, a difference of −0.56 ±0.51. That is "clear" only by a hair, and it is one of six comparisons, so it is weak. The chance edges are the same, as the study said.

---

## Scenario 2: FC Prizantemele v Trăsnetul Malmö

- **Fixture:** global round 4, match `4ef140df`, Prizantemele at home. Human v human.
- **Seeds:** 740000+ main, 741000+ control.

**What it stresses:**
- Our stored prep is the club's untouched default. It has been carried since round 1; Prizantemele's manager has never saved a prep.
- In it, our finishing-10 striker plays centre-back, and our defending-9 centre-back sits on the bench.
- The opponent is a human manager's Direct side: three passers of 9 feeding a finishing-10 striker.
- This is the case where picking players by their skills should pay. The control checks whether the reading of *Direct* adds anything beyond that.

### The two stored preps

**Ours, FC Prizantemele** (origin `carried`, defaults since round 1):
- 2-1-1, Balanced preset: progression Mixed · width Standard · line Standard · press Balanced · 3 forward · striker Mixed · on winning it Balanced · on losing it absent (plays Balanced).
- Riciu Gros (GK); **Tigaie** (LCB; ST, finishing 10, defending 1); **Pervaz** (RCB; FB/CB runner, pace 9, defending 3); Ceaunu (mid; DM/CM, passing 10); Ghiveci (ST; AM/W dribbler, pace 9, control 10).
- Bench by number: Covrig, Clătită, Mititelu, Plăcintă. No subs, no match settings.

**Theirs, Trăsnetul Malmö** (origin `manager`, saved 8 Oct, plan "Home plan"):
- 2-1-1, Direct: progression Direct · width Wide · line Standard · press Balanced · 4 forward · striker In behind · on winning it Balanced · on losing it absent (Balanced).
- Clătită (GK); Ștergar (LCB; CB/CM playmaker, passing 9, control 9, **defending 4, pace 4**, signed 8 Oct); Pervaz (RCB; CM/DM playmaker, passing 9, stamina 9, **defending 4**); Alecuș (mid; AM playmaker, passing 9, finishing 7); Tobă (ST; poacher, **finishing 10**, passing 3, control 4).
- Bench: Zacuscă (poacher, finishing 10), Preș (CB anchor, defending 7, aerial 8), Aragaz, Tramvai (anchor), Frigider (FB/CB anchor, defending 9). No subs.

### What our manager can see

**Scout them:**
- Last game: 7–1 v F.C Chior Dior, shape 1-2-1 Counter.
- Last 3: W 7–3 v Rapid Pensia (2-1-1 Direct), L 4–8 at Umanoeasy (2-1-1 Direct), W 7–1 v Chior Dior. 18 scored, 12 conceded.
- Most goals: **Tobă, 12** (7, 1, 4). Most assists: **Alecuș, 7**. Keeper Clătită: 33 saves in 3.
- They shot 14, 13 and 24 times and conceded 15, 32 and 16 shots.

**Their cards:**
- Three playmakers with passing 9 (Ștergar, Pervaz, Alecuș) behind one poacher.
- Both centre-backs in their recent fives are playmakers with defending 4. Ștergar has pace 4.
- Tobă cannot build play ("helps less in build-up"), but finishes everything.

**Our results:**
- W 6–4 at Adjud, L 5–8 v Inter, L 2–3 at Ceata Mentala. **15 conceded in 3**; opponents shot 16, 30 and 18 times.
- Ghiveci scored 8 of our 13. Riciu Gros (keeping 10, reading 10) made 30 saves.
- Same five and no subs every match.

**Our squad:**
- Plăcintă: CB anchor, defending 9, aerial 9, strength 9, pace 3. Never played.
- Clătită: W/AM engine, defending 7, reading 8, stamina 10.
- Mititelu: CM engine, stamina 9.
- Covrig: ST maverick, finishing 8.

**What a manager concludes:**
- We concede far too much, and the man at left centre-back is our best finisher, with defending 1.
- They are Direct with three good passers looking for Tobă in the box.
- Their own back two are slow passers who can't defend.

### Setup A: "Two stoppers against the long ball" (`stoppers`)

*Reading:* their whole game is three passers finding Tobă. Put our two real defenders in front of the keeper, and sit deeper so a ball over the top has no grass to land in. When we win it, break at once with Ghiveci's pace against their slow back two. Tigaie goes back up front, where his finishing belongs.

- 2-2: **Riciu Gros; Plăcintă (LCB), Clătită (RCB); Ghiveci (LW), Tigaie (RW)**. Ceaunu and Pervaz to the bench.
- Plan: progression Direct · width Standard · **line Deep** · press Balanced · **bodies forward 2** · striker Mixed · **on winning it Counter** · on losing it Balanced.
- Keeper **Stay on line** (a shot-stopper behind a deep line). Free kicks Mixed, taker **Ghiveci**.
- Subs:
  - Covrig on for Ghiveci when Ghiveci is tired, not before 10:00.
  - Ceaunu on for Clătită if we're losing, not before 7:30 (a passer for a defender when chasing).

### Setup B: "Run at their slow back two" (`runAt`)

*Reading:* they push four forward and their centre-backs are playmakers with defending 4, one of them pace 4. When their attack breaks down, the space behind them is ours. Our two quickest (Ghiveci and Pervaz, pace 9) go wide and Tigaie waits on the last man's shoulder. Plăcintă stays alone at the back: his aerial 9 deals with their long balls.

- 1-2-1: **Riciu Gros; Plăcintă (CB); Ghiveci (LW), Pervaz (RW); Tigaie (ST)**. Ceaunu and Clătită to the bench.
- Plan: progression Direct · **width Wide** · line Standard · press Balanced · **bodies forward 4** · **striker In behind** · **on winning it Counter** · on losing it Balanced.
- Keeper As usual. Free kicks Mixed, taker **Ghiveci**.
- Subs:
  - Ceaunu on for Pervaz when Pervaz is tired, not before 10:00.
  - Clătită on for Ghiveci if we're winning, not before 10:00.
  - Covrig on for Plăcintă if we're 2+ down, not before 7:30.

### Setup C: "Take the ball off their passers" (`starve`)

*Reading:* everything they do starts with three passers, and Tobă can't build play (passing 3, control 4). Keep the ball with Ceaunu (passing 10). When they have it, hunt their playmakers so Tobă never gets served. Two real defenders sit behind the press, and the keeper sweeps behind it. Tigaie is the target up front.

- 2-1-1: **Riciu Gros; Plăcintă (LCB), Clătită (RCB); Ceaunu (mid); Tigaie (ST)**. Ghiveci (our top scorer) to the bench.
- Plan: **progression Patient** · width Standard · line Standard (not High: Plăcintă has pace 3) · **press Aggressive** · bodies forward 3 · **striker Pivot** · **on winning it Keep it** · **on losing it Counter-press**.
- Keeper **Sweeper**. Free kicks **Short**, taker **Tigaie**.
- Subs:
  - Ghiveci on for Tigaie if we're drawing, not before 10:00.
  - Mititelu on for Ceaunu when Ceaunu is tired, not before 10:00 (pressing tires him).
  - Pervaz on for Plăcintă if we're losing, not before 10:00.

### Control: `trsShort`

- Trăsnetul's same five in their 2-1-1, on the **Short combinations preset**: patient, standard width, high line, balanced press, 3 forward, pivot, keep it, counter-press.
- **Prediction to test:** A and B are answers to Direct, so their edge should shrink against Short. C hunts passers, so its edge should hold or grow against a side that passes more.
- **Headline:** `stoppers`. Trim arms: prep, stoppers, starve.

---

## Scenario 3: Ceata Mentala v Malpraxis

- **Fixture:** global round 5, match `d00ae8e2`, Ceata Mentala at home.
- **The snapshot:** neither club has a round-5 prep yet, so the lock would carry each club's round-4 prep (`ballers_freeze_prep`). The carried side was built in SQL with `ballers_input_side`'s own body, and its md5 equals the round-4 side for both clubs.
- **Seeds:** 750000+ main, 751000+ control.

**What it stresses:**
- An AI opponent that presses Aggressively, pushes four forward and counters at once.
- Tiredness as a real dilemma: our best defender, Capac, has stamina 4.
- A youngster's minutes: Pătlăgea (21), and the 18-year-olds Dementoru and Ceaunu.
- Each setup handles Capac differently: A starts him and takes him off when tired; B plays him all match; C keeps him for the second half.

### The two stored preps

**Ours, Ceata Mentala** (origin `manager`, saved 8 Oct, plan "Short Cezarificatorul"; carried to round 5):
- 1-2-1, Direct, adjusted: progression Direct · **width Narrow** · line Standard · press Balanced · 4 forward · striker In behind · on winning it Balanced · on losing it Balanced.
- Caposu (GK; sweeper keeper, keeping 9, stamina 3, signed 7 Oct); Clătită (CB; FB/CB anchor, defending 8, strength 10); **Capac (LW; CB/DM ball-winner, pace 9, defending 9, reading 9, passing 8, stamina 4, gem, signed 7 Oct)**; Ceaunu (RW; ST poacher, finishing 10, age 18); Dementoru (ST; W/ST/AM dribbler, pace 10, control 10, age 18, founder).
- Bench: Lustră (GK, passing 9), Tramvai (CM playmaker, stamina 8), **Pătlăgea (AM maverick, finishing 8, passing 8, age 21)**, Mușama (ST poacher, finishing 8), Zacuscă (DM playmaker, passing 10, pace 3), Frigider (CB ball-winner, defending 7, reading 9).
- No subs. Also has a voice (commentary only).

**Theirs, Malpraxis** (AI, carried):
- 2-1-1, Counter, adjusted: progression Mixed · width Standard · **line Standard · press Aggressive · 4 forward · striker In behind** · on winning it Counter · on losing it absent (Balanced).
- Cateter (GK; sweeper keeper, keeping 7, reading 9); Ghips (LCB; ball-winner, defending 9, strength 10, **control 2**); **Tăiș (RCB; a W runner, pace 10, passing 3, defending 5)**; Tensiune (mid; DM ball-winner, defending 8, **control 3**); Sutură (ST; poacher, finishing 10, **control 3**).
- Bench of 8, including Bisturiu and Iod (defending 10) and Pansament (W dribbler). No subs.

### What our manager can see

**Scout them:**
- Last game: 8–5 at Adjud, shape 2-1-1 Counter, adjusted.
- Last 3: L 5–6 v Roman City, L 4–8 at Directia, W 8–5 at Adjud. 17 scored, **19 conceded**.
- Most goals: **Tăiș, 9**; Sutură 6. Assists spread thin (Tăiș 3). Keeper Cateter: 25 saves in 3.
- They shot 14, 24 and 25 times and faced 23, 19 and 18 shots.

**Their cards:**
- A side of ball-winners who can't keep the ball: control 2, 3 and 3, and Tăiș has passing 3.
- Their right centre-back is a winger.
- The setting card for Aggressive says "runs the most and a quick switch beats it". Wide says it "hurts a side that presses hard".

**Our results:**
- W 9–1 v Umanoeasy, W 4–2 at Chior Dior, W 3–2 v Prizantemele: top of the form.
- Ceaunu 5 goals; Pătlăgea 4 goals and 3 assists in his two starts; Dementoru 5 goals and 4 assists.
- In rounds 1–2 we brought Frigider on for Zacuscă around 10:00–12:30.
- Capac and Caposu are new; neither has played yet.

**What a manager concludes:**
- Our best defender is playing left wing and has the stamina of a keeper.
- Malpraxis will chase us everywhere and leave a winger at the back.
- And there is a 21-year-old on the bench who scores.

### Setup A: "Pass through the press" (`passThrough`)

*Reading:* they press hard and push four forward, and the card says a quick switch beats that press. Play our passers: Capac in his real position at centre-back (passing 8, control 8, reading 9), and Zacuscă (passing 10) in the middle, with width to switch. Then Ceaunu gets the ball with their pressers behind him. Capac's stamina 4 means he comes off when he's tired, but not early.

- 2-1-1: **Caposu; Clătită (LCB), Capac (RCB); Zacuscă (mid); Ceaunu (ST)**. Dementoru and Pătlăgea to the bench.
- Plan: progression Mixed · **width Wide** · line Standard · press Balanced · bodies forward 3 · striker Mixed · **on winning it Counter** · on losing it Balanced.
- Keeper **Sweeper** (Caposu is a sweeper keeper; Tăiș, pace 10, runs in behind). Free kicks Mixed, taker **Zacuscă**.
- Subs:
  - Frigider on for Capac when Capac is tired, not before 7:30.
  - Dementoru on for Zacuscă if we're losing, not before 7:30.
  - Pătlăgea on for Ceaunu if we're 2+ up, not before 10:00 (minutes for the kid once it's safe).

### Setup B: "Let the kids run at them" (`kids`)

*Reading:* their right centre-back is a winger who goes forward, and they conceded 19 in three. Our three youngsters play the whole match, and minutes grow them: Dementoru (18, pace 10, control 10), Ceaunu (18, finishing 10) and Pătlăgea (21, 4 goals and 3 assists in his two starts). Capac plays alone at the back as our fastest defender, with reading 9. Break at once while their four are still up.

- 1-2-1: **Caposu; Capac (CB); Dementoru (LW), Pătlăgea (RW); Ceaunu (ST)**. Clătită to the bench.
- Plan: progression Direct · **width Wide** · line Standard · press Balanced · **bodies forward 4** · **striker In behind** · **on winning it Counter** · on losing it Balanced.
- Keeper **Sweeper**. Free kicks Mixed, taker **Pătlăgea**.
- Subs:
  - Clătită on for Capac when Capac is tired, not before 10:00.
  - Frigider on for Pătlăgea if we're winning, not before 12:00.

### Setup C: "Press the pressers, Capac off the bench" (`pressBack`)

*Reading:* they can't play out (Ghips control 2, Tensiune 3, Sutură 3, Tăiș passing 3). Hunt them all over and counter-press. Pressing needs legs, so Capac (stamina 4) starts on the bench and comes on fresh at half-time for the second-half push. Meanwhile two ball-winners hold the back.

- 2-2: **Caposu; Clătită (LCB), Frigider (RCB); Dementoru (LW), Ceaunu (RW)**. Capac to the bench.
- Plan: progression Direct · width Standard · line Standard · **press Aggressive** · bodies forward 3 · striker Mixed · **on winning it Counter** · **on losing it Counter-press**.
- Keeper **Sweeper**. Free kicks Mixed, taker **Dementoru**.
- Subs:
  - Capac on for Frigider at half-time.
  - Pătlăgea on for Ceaunu when Ceaunu is tired, not before 10:00.
  - Tramvai on for Dementoru if we're winning, not before 10:00.

### Control: `malCounter`

- Malpraxis's same five on **their style's own Counter preset**: deep line, Selective press, 3 forward, striker Mixed, counter on winning it. This takes out exactly the Aggressive-press adjustment.
- **Prediction to test:** A's edge exists *because* they press, so it should shrink against a deep, Selective side.
- **Headline:** `passThrough`. Trim arms: prep, passThrough, pressBack.

---

## Scenario 4: FC Directia Darmanesti v Inter

- **Fixture:** global round 6, match `74e61bcb`, Directia at home.
- **The snapshot:** carried as in scenario 3 (md5 equal to round 4).
- **Seeds:** 760000+ main, 761000+ control.

**What it stresses:**
- A quality mismatch: Inter's starting five average skill 5.91 against Directia's 5.56.
- Inter have won 8–3, 8–5 and 7–2, shooting 22–30 times a match.
- Directia have four playmakers and one real defender.
- The question: does reasoning matter for the underdog, or does quality decide whatever he does?

### The two stored preps

**Ours, FC Directia Darmanesti** (origin `manager`, saved 6 Oct, plan "Home plan"; carried to round 6):
- 2-2, Direct, adjusted: progression Direct · width Wide · line Standard · press Balanced · 4 forward · striker In behind · on winning it Balanced · **on losing it Counter-press**.
- Frigider (GK; shot-stopper, keeping 9, reading 9, pace 3); Ceaunu (LCB; CB playmaker, passing 9, **defending 5, pace 4**); Tramvai (RCB; FB/CB engine, defending 7, pace 7); Varză (LW; W/AM engine, reading 8, stamina 9); Crizatu (RW; poacher, **finishing 10, pace 4**, founder).
- Bench: Butelie (CM playmaker), Calorifer (AM playmaker, passing 10), Lustră (DM playmaker, passing 9, reading 9), Fotoliu (ST target man, aerial 8, strength 9). No subs.

**Theirs, Inter** (AI, carried):
- 1-2-1, Direct, adjusted: progression Direct · width Wide · line Standard · **press Aggressive** · 4 forward · striker In behind · on winning it Balanced.
- Martínez (GK; sweeper keeper, keeping 8, reading 9); **Bastoni (CB, alone; defending 8, passing 8, pace 5)**; Diouf (LW; FB/W dribbler, pace 7, control 8); **Thuram (RW; ST/W runner, pace 7, aerial 8, strength 8, control 8)**; Lautaro (ST; poacher, finishing 9, reading 8).
- Bench of 8, including Henrique, Çalhanoğlu, Barella and Esposito. No subs.

### What our manager can see

**Scout them:**
- Last game: 7–2 v Roman City, shape 1-2-1 Direct, adjusted.
- Last 3: W 8–3 v Chior Dior, W 8–5 at Prizantemele, W 7–2 v Roman City. **23 scored**, 10 conceded.
- Most goals: **Thuram, 11**; Diouf 6, Lautaro 6. Assists: Bastoni 5, Diouf 5. Keeper Martínez: 30 saves in 3.
- They shot 22, 30 and 29 times.

**Their cards:**
- Five players of 7–9 almost everywhere.
- Only one centre-back behind four attackers, and he has pace 5.
- The Aggressive press "runs the most and a quick switch beats it".

**Our results:**
- L 1–3 at Neo (1-2-1 Balanced), W 8–4 v Malpraxis (2-2 Direct), D 1–1 at Rapid (2-2 Balanced).
- Crizatu 7 goals; Varză 2 goals and 4 assists.
- We had more of the ball at Rapid (218 s) and took 21 shots for one goal.

**What a manager concludes:**
- We are clearly worse player for player.
- Their goals come from Thuram running at people.
- Behind their four attackers there is one centre-back.
- We have more good passers than anyone.

### Setup A: "Shut the door, hit them on the break" (`shutBreak`)

*Reading:* they score through Thuram's runs and take 22–30 shots a match. Sit deep with two who get back: Tramvai (pace 7, defending 7) and Varză (stamina 9, reading 8). Lustră (reading 9) screens in front of them. Regroup when we lose it. Their press and four forward leave space when we win the ball, and Crizatu finishes the breaks.

- 2-1-1: **Frigider; Tramvai (LCB), Varză (RCB); Lustră (mid); Crizatu (ST)**. Ceaunu to the bench.
- Plan: progression Mixed · width Standard · **line Deep** · **press Selective** · **bodies forward 2** · striker Mixed · **on winning it Counter** · **on losing it Regroup**.
- Keeper **Stay on line**. Free kicks Mixed, taker **Crizatu**.
- Subs:
  - Calorifer on for Lustră if we're losing, not before 7:30.
  - Fotoliu on for Varză if we're 2+ down, not before 7:30.

### Setup B: "Pass through their press to their lone centre-back" (`throughPress`)

*Reading:* Inter press Aggressively and send four forward. Behind them stands one centre-back with pace 5. Our strength is passing: Calorifer (10) and Lustră (9) play through the first wave, then we switch wide and run at Bastoni. Lustră plays as a ball-playing centre-back beside Tramvai.

- 2-1-1: **Frigider; Tramvai (LCB), Lustră (RCB); Calorifer (mid); Crizatu (ST)**. Ceaunu and Varză to the bench.
- Plan: progression Direct · **width Wide** · line Standard · press Balanced · bodies forward 3 · striker Mixed · **on winning it Counter** · on losing it Balanced.
- Keeper As usual. Free kicks Mixed, taker **Lustră**.
- Subs:
  - Varză on for Calorifer when Calorifer is tired, not before 10:00.
  - Fotoliu on for Lustră if we're 2+ down, not before 7:30.

### Setup C: "Keep the ball away from them" (`keepBall`)

*Reading:* the best defence against the league's best attack is not giving them the ball. Ceaunu (passing 9) and Lustră (passing 9, reading 9) keep it patiently, and we break only with a clear extra man. When we lead late, Fotoliu comes on to hold the ball up.

- 2-1-1: **Frigider; Ceaunu (LCB), Tramvai (RCB); Lustră (mid); Crizatu (ST)**. Varză to the bench.
- Plan: **progression Patient** · width Standard · line Standard (not High: pace-4 centre-backs) · press Balanced · bodies forward 3 · striker Mixed · **on winning it Keep it** · on losing it Balanced.
- Keeper As usual. Free kicks **Short**, taker **Lustră**.
- Subs:
  - Calorifer on for Ceaunu if we're losing, not before 7:30.
  - Varză on for Lustră when Lustră is tired, not before 10:00.
  - Fotoliu on for Crizatu if we're winning, not before 12:00.

### Control: `intNoThuram` (a condition: key player out)

- Inter without Thuram, their top scorer and runner in behind. Henrique (AM/W dribbler, pace 8), the bench winger, takes his right-wing slot, and Inter's plan is unchanged.
- **Prediction to test:** A is built to stop Thuram's runs, so its edge should shrink when he is out. B's reasoning is about the press, which stays, so its edge should hold.
- **Headline:** `shutBreak`. Trim arms: prep, shutBreak, throughPress.

---

## Predictions for step 1 (written 9 Oct, before B2/B3 exist)

**What a pass means (Vlad, 9 Oct).** A good plan doesn't have to win.
- The squads are unequal, and a better squad may still be favourite.
- What a fix must do is make the reasoned setup **move the result in its favour, relative to the same squad's naive setup**, by about one good chance a match or more.
- The measure is the **shift**: each setup's chance difference against the stored prep, on the candidate build minus the same on the base build. Paired seeds; goals and W/D/L reported alongside.
- **Matchup test:** the shift is smaller in the control, where the opponent no longer does the thing the reasoning answered.
- **A fail:** no shift, or the same shift for every setup and every opponent. That would be the universal ranking again.

| Fix | Scenario: setup | Predicted shift v stored prep | In the control |
|---|---|---|---|
| **B2** pressed carrier uses the free man | 3: A "Pass through the press" (v Malpraxis, aggressive press) | **+1 good chance or more** | smaller (Malpraxis on Counter, no press) |
| B2 | 1: B "Hunt their heavy touches" (pressing Neo's poor passers) | holds most of today's +0.94. Poor readers still escape late, because reading sets re-think speed | n/a (control changes Neo's plan, not its passers) |
| **B3** keeper and last defender answer long balls | 2: A "Two stoppers against the long ball" (v Trăsnetul, Direct) | **+1 good chance or more** | smaller (Trăsnetul on Short) |
| B3 | 1: A "Lock the door" (deep, v Neo's runners) | today's −2.64 gap to the Direct prep shrinks by about 1 or more | smaller against Neo on Balanced |
| B3 | 4: A "Shut the door, hit them on the break" (v Inter) | positive, size uncertain | no specific prediction (the control is a key player out) |

**Caveat for B3:** setups 2A and 4A chose "Stay on line" keepers, so their gain must come from the last defender's contest, not the keeper. The owner's decision stands: a stay-at-home keeper may still be beaten by the right ball. A smaller B3 shift there is not by itself a fail.

**Outside the scenarios: no new bad behaviour.** Every candidate also passes these:
- **Blind render review across varied matchups,** not only these fixtures. Nobody looks stupid; every choice has a defensible purpose.
- **Warning lights:** goals, shots, turnovers, and goal sources against the futsal ranges.
- **Board-truth,** and the existing ship gate: no style beats all the others.

## The harness

**Files in this folder:**

| File | What it does |
|---|---|
| `scenarios.mjs` | The four scenarios as data: sides, arms, controls, seeds, plans. |
| `match.ts` | Builds the frozen input and plays one match through `lib/ballers/compute.ts` `computeMatch`. Records score, good chances (`lib/ballers/chances.ts`), stats, every shot (side, chance, kind, origin, start x, seconds, minute, shooter, goal, engine read `q`) and every substitution (order, status, time, who on, who off). Also checks that each arm is something the live app could store. |
| `run.mjs` | The runner: revisions, plans, workers, sharding, resume. |
| `analyze.mjs` | Paired diffs per scenario. |
| `same.mjs` | Checks whether two runs' rows reproduce each other. |
| `sides/` | The frozen sides and their server md5s. |

**What `run.mjs` does:**
- It checks every side's md5 and every arm's legality before anything plays.
- It bundles `match.ts` once per engine revision. Every import of `lib/` and `packages/football-engine/src/` is redirected to that revision's copy (`git archive <rev> lib packages/football-engine/src`). So `compute`, the presets and the chances table are the revision's own, and baseline and candidate run side by side in one job.
- **Seeds are paired:** every arm and revision plays the same seeds, with kickoff = seed % 2.
- **Plans** (`scenarios.mjs` `PLANS`):

  | Plan | What it plays | Matches per scenario per revision |
  |---|---|---|
  | `full` | Core arms × 200 + core arms × 80 v the control. | 1,120 |
  | `trim` | Trim arms × 25 + (prep, headline) × 12 v the control. | 99 |
  | `lean` | (prep, headline) × 20 + (prep, headline) × 10 v the control. | 60 |
  | `det` | The stored prep on its first 3 seeds. | 3 |
  | `smoke` | One match. | 1 |

**Locally (laptop, at most 6 workers):**

```sh
cd packages/football-engine/evidence/2026-10-09-scenarios
node run.mjs --label check-<cand> --plan full --revs base=<base sha>,cand=<cand sha> --workers 6
node analyze.mjs results/check-<cand>.jsonl            # --md for tables, --detail for shooters and subs
node run.mjs --label x --plan full --dry               # count the tasks
node run.mjs --probe --scenario men-mal --arm kids --seed 750000   # one match, printed
```

A stopped run resumes: rows already in the file are skipped.

**In the cloud** (on the engine branch, pushed; `../_ci/README.md`):

```sh
node packages/football-engine/evidence/_ci/cloud.mjs --runner ubuntu-24.04-arm --shards 20 \
  --command "node packages/football-engine/evidence/2026-10-09-scenarios/run.mjs --label lean-<cand> --plan lean --revs base=<base sha>,cand=<cand sha>" \
  --into packages/football-engine/evidence/2026-10-09-scenarios/results/lean-<cand>.jsonl
```

**Parity:**
- Every row carries `plat` (OS, CPU and node version), `rev`, `build` and `tableBuild`. `analyze.mjs` warns when a revision's chances table was measured on another build.
- Never mix laptop and cloud files in one analysis.
- A cached baseline is only valid for the same runner type and node version. Prove it before reusing it, by re-running the `det` plan beside it and checking with `node same.mjs results/base-cache.jsonl results/det-<cand>.jsonl`.

**Before every candidate:** regenerate `lib/ballers/chances-table.ts` for the candidate build (the direction requires it). Until then the candidate's chance numbers use a table from another build, and `analyze.mjs` says so.

**What the analysis prints**, per scenario, revision and opponent:
- Each setup v the stored prep: n, W/D/L, goals and chances for and against.
- Δ chances, Δ GD, Δ win share and Δ points per match, each with a 95% CI, and a word: *clear* (the CI excludes 0), *likely* (|mean| ≥ 1.28 se) or *too few to tell*.
- **The matchup check:** each setup's edge v the stored opponent against its edge v the control, with the difference and its CI (independent seeds), plus the best setup under each opponent.
- **With two revisions:** what the candidate changed for every arm, and how each setup's edge moved, paired by seed.

### Smoke test

- **What ran:** seven matches on the laptop, at most 4 workers:
  - one per scenario (stored prep v stored opponent);
  - Ceata Mentala C v the control on two revisions (working tree and git HEAD), to exercise extraction, a preset control and a half-time sub;
  - Directia A v the key-player-out control.
- **Result:** it ran. No arm was dropped, every row carries chances, and every substitution order fired with the named players. Results are not reported, and the smoke rows are git-ignored.
- **Checks:**
  - The Chior Dior match reproduced the study's stored row for the same arm and seed bit for bit (`same.mjs`).
  - The git-extracted revision (HEAD) reproduced the working tree bit for bit, so the revision mechanism adds nothing of its own.

---

## Cloud budget

**Cost per match** (`../_ci/README.md`, measured):
- About 300 matches in 120–140 billed minutes on arm64 (`ubuntu-24.04-arm`): **0.40–0.47 billed minutes a match**.
- x64 is about 40% dearer (160–220 minutes for the same 300).
- The figures below use arm64.

| Check | Matches | Billed minutes |
|---|---|---|
| Full, one revision: 4 scenarios × (4 arms × 200 + 4 arms × 80) | 4,480 | **1,800–2,100** |
| Full, baseline and candidate together | 8,960 | 3,600–4,200 |
| Trim, candidate only, baseline cached (4 × 99) + `det` sample (12) | 408 | **165–190** |
| Lean, baseline and candidate together: 2 × 4 × 60 | 480 | **190–225** |
| One-time baseline cache for `trim` (4 × 99) | 396 | 160–185 |

**Against the 450 minutes left in October**, the full check (200 + 80 per arm) does not fit even once. Even one revision is four times the budget. Two trimmed options fit about 150–200 minutes per candidate:

1. **Trim with a cached baseline** (recommended if one runner type is kept).
   - The first check pays the baseline once (≈170 min). Each candidate then costs ≈165–190.
   - October allows the cache plus one candidate, about 340–375 minutes.
   - Each scenario gets 3 arms × 25 seeds. The chance-diff CI is about ±0.95 per match, so it detects only an edge of about a chance a match or more. Results (wins, points) stay "too few to tell" except for big swings.
   - The control has 12 seeds, so the matchup check only sees a large interaction (CI about ±1.65 chances).
2. **Lean with both revisions together** (≈190–225 min per candidate). This needs no cache and has no cross-run risk, but it is thinner: 2 arms × 20 seeds, about ±1.05 on chance diff, and 10 control seeds (interaction CI about ±1.8).

These CIs assume the per-match sd of the paired chance difference seen in the Chior Dior study, about 2.4.

**The full bar on the laptop:**
- A match took 66 s per worker in the Chior Dior study, under load. Today's smoke test took 167–170 s per match on 4 workers, under heavier load from other sessions. Unloaded, one worker takes 38 s.
- At 6 workers, a full check of one revision (4,480 matches) takes about 14 hours at the study's pace and about 35 hours at today's. Both revisions together take twice that.
- It costs no minutes, and laptop rows pair fine with laptop rows.
- The Chior Dior study's 1,520 laptop rows on 56fc996d already cover scenario 1's baseline on the laptop, and the new harness reproduces them.

---

## Open questions for the owner

1. **Budget route.**
   - Option (a): the full bar on the laptop overnight. One revision per night, or the cached baseline plus one candidate per night.
   - Option (b): trimmed checks in the cloud, which only detect edges of about a chance a match.
   - Option (c): both — the cloud trim as a quick screen, the laptop full run for the build you want to ship.
2. **Cached baselines.** Cloud rows are deterministic per runner type. May a baseline be run once and reused, proved each time by the `det` sample? Or must baseline and candidate always share the job?
3. **Scenario 2's lesson might be trivial.** Prizantemele's default lineup is so wrong (a finishing-10 striker at centre-back) that any sensible setup should beat it. That still tests "reasoning pays", but the matchup check (Direct v Short) is the more informative half there. Keep it, or swap in a fixture where the stored prep is a real manager's choice?
4. **Snapshots go stale.** Managers may still change their preps before the locks, and growth after round 4 will change skills. Keep these frozen sides as the permanent set (recommended: comparability across builds), or refresh after each lock?
5. **Control kinds.** Scenarios 1–3 swap the opponent's plan; scenario 4 takes a key player out. The direction also mentions tiredness, but energy starts at 100 for every player in every real match, so a lower-energy control would be an artificial condition. Add one once tiredness lands (part 2), or not?
