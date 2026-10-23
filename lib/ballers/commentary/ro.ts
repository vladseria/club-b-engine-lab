// =====================================================================
//  BALLERS COMMENTARY: THE LINES (Romanian)
// =====================================================================
//
//  Vlad: this is the only file you need to edit to change what the
//  commentator says. Everything else (when a line appears, which variant,
//  which club) is decided elsewhere and stays out of your way.
//
//  HOW IT WORKS
//  - Each key below is one kind of moment. Its list holds the variants.
//    Add as many as you like, remove any, reorder freely. A list may even
//    be empty: the engine's own line is used instead.
//  - Every viewer of a match sees the same variant (it is picked by a hash
//    of the match and the moment, not at random), and a key skips the
//    variants it used most recently (about half its list), so a rout's
//    eighth goal doesn't read like its fourth.
//  - Slots, written in curly braces, get filled in:
//      {player}  the main player (the scorer, the keeper who saved, ...)
//      {other}   the second player (the assister, the shooter who was
//                denied, the man beaten, the player fouled)
//      {club}    the club of the moment (the one scoring / saving / winning)
//      {opp}     the other club
//      {home} {away}  the two clubs, home first
//      {score}   the score, home first, e.g. 3–2
//      {min}     the match clock, e.g. 7:31
//      {reason}  why a substitution was made (SUB_REASON below), or why the
//                plan changed (SWITCH_REASON below)
//      {style}   the style a club switches to (SWITCH_STYLE below)
//      {shape}   the formation it switches to, e.g. 2-2
//      {passes}  how many first-time passes a one-touch move strung together, in
//                words (PASS_COUNT below: trei, patru, ...)
//      {secs}    how many seconds a counter-attack took from winning the ball to
//                the goal, in words (secondsWords below: "șase secunde")
//    A slot the moment doesn't have makes that variant unusable, so a
//    line with {other} is simply skipped when there is no second player.
//  - Names are all male players: "lui {player}" and "pe {player}" read right.
//
//  TONE (DECISIONS Q4.3)
//  - Street banter, mild. No slurs. Never mock a real person: the Inter
//    players carry real footballers' names, so the lines are about the
//    moment, never about the man.
//  - Energy for goals, near misses, saves, late drama and ideas coming off.
//    Build-up and quiet spells are calm.
//  - Never invent football: no injuries, cards, deflections or causes the
//    match did not have. Colourful metaphor is welcome.
//
//  CLUB FLAVOUR (bottom of the file) is a spare extra sentence, added now and
//  then after a line about that club. Keep it to 2-3 per club: it is
//  punctuation, not the voice.
// =====================================================================

export const LINES:Record<string,string[]>={
 // ---------- start / clock ----------
 kickoff:[
  'A început! {home} și {away}, cincisprezece minute, fără scuze.',
  'Fluierul de start! {home} contra {away}, să vedem cine a venit să joace.',
  'Mingea se pune în mișcare. {home} – {away}, meciul serii.',
  'Gata cu vorba, începe fotbalul: {home} – {away}!',
 ],
 half_level:[
  'Jumătate de meci și e {score}. Totul e încă pe masă.',
  'Am trecut de jumătate, {score}. Nimeni nu poate dormi liniștit.',
  'Mijlocul meciului, egalitate: {score}.',
 ],
 half_lead:[
  'Jumătate de meci: {club} e în față, {score}.',
  'La jumătatea drumului, {club} conduce, {score}. {opp} mai are timp.',
  'Am trecut de jumătate. {score}, iar {opp} trebuie să se trezească.',
 ],
 // The real half-time whistle (a match with a half-time: the 15-minute match). The lists above
 // (half_level / half_lead) stay for matches without one: the clock's midpoint of a quick match
 // and every replay from before the half-time.
 half_time_level:[
  'Pauză! {score} după prima repriză. Totul se joacă în a doua.',
  'Fluier de pauză, {score}. Vestiarele au de lucru.',
  'Gata prima repriză, {score}. Cinci minute de stat pe bancă și de făcut planuri.',
 ],
 half_time_lead:[
  'Pauză! {club} conduce cu {score}.',
  'Gata prima repriză: {club} e în față, {score}. {opp} are cinci minute să-și revină.',
  'Fluier de pauză, {score}. {club} pleacă la cabine cu avantaj.',
 ],
 // The second half's kickoff ({club} kicks off; the teams have swapped ends).
 second_half:[
  'Începe repriza a doua! {club} pune mingea în joc, porțile s-au schimbat.',
  'Ne-am întors. A doua repriză, {club} dă lovitura de început.',
  'Repriza a doua, la {score}. {club} pornește de la centru.',
 ],
 end_win:[
  'Fluier final! {club} câștigă, {score}.',
  'S-a terminat! {club} ia victoria, {score}. {opp} pleacă acasă cu mâna goală.',
  'Gata! {score}, iar seara e a celor de la {club}.',
  'Final de meci: {home} {score} {away}. {club} are motive de bere.',
 ],
 end_draw:[
  'Fluier final, {score}. Nimeni nu pleacă învins, nimeni nu pleacă fericit.',
  'S-a terminat egal, {score}. Punctele se împart frățește.',
  'Final: {home} {score} {away}. Remiză, și parcă nimeni nu e mulțumit.',
 ],
 quiet:[
  'Mingea circulă, dar poarta nu se vede deocamdată.',
  'Moment mai liniștit. Se construiește răbdător.',
  'Cine face următoarea mișcare? Deocamdată toată lumea se studiază.',
  'Joc de mijloc. Nimeni nu vrea să greșească primul.',
 ],

 // ---------- goals ----------
 goal_opens:[
  'GOOOL! {player} deschide scorul pentru {club}!',
  'GOOOL! Primul gol al serii e al lui {player}! {score}.',
  'GOOOL! {player} sparge gheața! {club} conduce.',
  'GOOOL! {player} nu mai așteaptă pe nimeni: {score}!',
 ],
 goal_equalises:[
  'GOOOL! {player} egalează! {score}, o luăm de la capăt!',
  'GOOOL! {club} revine, {player} face {score}!',
  'GOOOL! Egalitate! {player} readuce {club} în meci.',
 ],
 goal_leads:[
  'GOOOL! {player} dă lovitura, {club} trece în față! {score}.',
  'GOOOL! {club} preia conducerea prin {player}! {score}.',
  'GOOOL! {player}! Și {club} e din nou deasupra, {score}.',
 ],
 goal_extends:[
  'GOOOL! {player} mai pune unul. {score}!',
  'GOOOL! {club} nu se oprește, {player} face {score}.',
  'GOOOL! {player} înscrie, {opp} se uită la tabelă și oftează: {score}.',
  'GOOOL! Încă unul pentru {club}! {player}, {score}.',
 ],
 goal_pulls_back:[
  'GOOOL! {player} reduce din diferență: {score}!',
  'GOOOL! {club} nu s-a predat, {player} face {score}.',
  'GOOOL! {player} aprinde speranța: {score}!',
 ],
 late_lead:[
  'GOOOL PE FINAL! {player}, la {min}! {club} trece în față, {score}!',
  'GOOOL! Când nimeni nu mai credea, {player}! {score} pentru {club}!',
  'GOOOL! {player} lovește pe ultima sută de metri! {score}!',
 ],
 late_equaliser:[
  'GOOOL PE FINAL! {player} egalează la {min}! {score}!',
  'GOOOL! {club} scapă din ghearele înfrângerii: {player}, {score}!',
  'GOOOL! {player} salvează {club} pe final! {score}!',
 ],
 own_goal:[
  'Autogol! {player} trimite în propria poartă. {score} pentru {club}.',
  'Vai de mine, autogol! Mingea de la {player} ajunge în plasă. {score}.',
  'Autogol! Se întâmplă și la case mai mari. {club} se bucură: {score}.',
 ],
 key_pass:[
  'Pasa decisivă a venit de la {player}. Pentru așa ceva plătești bilet.',
  'Să nu uităm cine a pregătit golul: {player}, pasă de milimetru.',
  'Golul se trage din pasa lui {player}. Totul pe tavă.',
  '{player} a văzut culoarul înaintea tuturor. Pasă de gol.',
 ],

 // ---------- chances ----------
 save:[
  '{player} respinge! {other} nu trece de el.',
  'Parată! {player} spune nu șutului lui {other}.',
  '{player} e acolo! Mingea nu intră.',
  '{other} încearcă, {player} rezolvă.',
 ],
 save_big:[
  'CE PARADĂ! {player} îl refuză pe {other} de aproape!',
  'Incredibil! {player} scoate mingea din gol! {other} rămâne fără gol.',
  'Aproape gol, dar {player} zice NU! Intervenție uriașă!',
  'De la câțiva metri, și totuși {player} o oprește! Portar de meserie.',
 ],
 chance:[
  'Ce ocazie! {player} ratează de aproape!',
  'Uuuh! {player} avea poarta în față și a trimis pe lângă!',
  'Nu se poate! {player} avea golul la picior și a trimis pe lângă!',
  'Mare ocazie pentru {club}! {player} n-a nimerit poarta.',
 ],
 wide:[
  '{player} încearcă, dar pe lângă.',
  'Șut de la {player}, mingea trece pe lângă poartă.',
  '{player} caută vinclul, găsește tribuna.',
  'Încercare de la {player}. Aproape, dar nu destul.',
 ],
 blocked:[
  '{player} se aruncă și blochează șutul lui {other}!',
  'Blocat! {player} pune corpul în calea mingii.',
  '{other} șutează, {player} blochează. Apărare cu tot sufletul.',
 ],

 // ---------- build-up and duels ----------
 beat:[
  '{player} trece de {other}! Mai e cineva?',
  'Driblingul lui {player}! {other} rămâne pe loc.',
  '{player} îl lasă în urmă pe {other}. Se deschide terenul!',
 ],
 tackle:[
  '{player} intervine la timp! {other} nu mai trece.',
  'Deposedare curată a lui {player} în fața propriei porți.',
  '{player} stinge focul la timp.',
 ],
 turnover:[
  '{player} fură mingea sus! {club} are o șansă.',
  'Pierdere periculoasă, iar {player} profită. {club} atacă!',
  '{player} recuperează aproape de poarta adversă. Atenție!',
 ],
 foul:[
  'Fault! {player} îl oprește pe {other}.',
  '{player} îl agață pe {other}. Arbitrul fluieră.',
  'Fluier! {player} intră prea tare peste {other}.',
 ],

 // ---------- substitutions ({player} comes on, {other} goes off) ----------
 substitution:[
  'Schimbare la {club}: iese {other}, intră {player}. {reason}',
  '{club} schimbă: {player} intră în locul lui {other}. {reason}',
  'Mișcare pe bancă la {club}: {other} lasă locul lui {player}. {reason}',
 ],
 substitution_plain:[
  'Schimbare la {club}: iese {other}, intră {player}.',
  '{club} schimbă: {player} intră în locul lui {other}.',
  'Mișcare pe bancă la {club}: {other} lasă locul lui {player}.',
 ],

 // ---------- a change of plan (the manager's one switch, set before the match) ----------
 // {style} is the style the new plan is based on (SWITCH_STYLE), never the plan's own name.
 plan_switch:[
  'Schimbare de plan la {club}: de acum se joacă {style}. {reason}',
  '{club} schimbă macazul și trece pe {style}. {reason}',
  'Antrenorul de la {club} schimbă abordarea: {style}. {reason}',
 ],
 // the new plan has another formation: the same men, new places
 plan_switch_shape:[
  '{club} trece pe {shape}: aceiași jucători, alte locuri. {reason}',
  'Se mută piesele la {club}: de acum {shape}. {reason}',
  '{club} schimbă așezarea în {shape}. {reason}',
 ],
 plan_switch_plain:[
  '{club} își schimbă planul de joc.',
  'Antrenorul de la {club} schimbă abordarea.',
  'Se schimbă ceva la {club}: alt plan de acum.',
 ],

 // ---------- the styles' own moments (styles as identities, 22 Oct) ----------
 // a Short side strings first-time passes together ({passes}: trei, patru, ...)
 one_touch:[
  '{club} leagă {passes} pase dintr-o atingere. Mingea nu stă o clipă.',
  'Din prima, din prima, din prima: {club} trece prin linii cu {passes} pase.',
  '{passes} pase dintr-o atingere la {club}. Așa se joacă pe scurt.',
 ],
 one_touch_long:[
  'Ce circulație la {club}: {passes} pase dintr-o atingere, adversarii doar se uită.',
  '{club} face jocul cu {passes} pase din prima, una după alta. Spectacol!',
  'Fotbal la o atingere la {club}: {passes} pase la rând, fără să oprească mingea.',
 ],
 // a first-time pass (a one-two, a quick combination) sets up a shot
 one_touch_chance:[
  'Una-două din prima și {club} ajunge la șut!',
  'Combinație dintr-o atingere la {club}, și apare poarta!',
  'Pase din prima, apărarea rămâne în urmă: {club} trage la poartă!',
 ],
 // a Counter side wins the ball and rushes forward (the surge)
 surge_shot:[
  'Contraatac fulgerător al celor de la {club}, încheiat cu un șut!',
  '{club} câștigă mingea și pleacă imediat. Șut la capătul contraatacului!',
  'Recuperare și viteză: {club} ajunge la poartă în câteva secunde.',
 ],
 surge_lost:[
  '{club} pleacă pe contraatac, dar pierde mingea pe drum.',
  'Contraatacul celor de la {club} se stinge înainte de poartă.',
  'Prea repede pentru ei înșiși: {club} pierde mingea în plin contraatac.',
 ],
 // a counter-attack that ends in a goal ({secs}: how long it took from winning the ball)
 goal_surge:[
  'Contraatac fulgerător și gol! {player} înscrie pentru {club}, în {secs} de la recuperare. {score}.',
  'De la o poartă la alta în {secs}! {player} termină contraatacul celor de la {club}: {score}.',
  'Au recuperat și au lovit imediat: gol {player}, {club}, {score}.',
 ],

 // ---------- ideas (a prepared move comes off) ----------
 idea:[
  'Asta s-a antrenat! {club} execută exact ce a pregătit.',
  'Faza de la antrenament iese la meci! {club} știe ce face.',
  'Mișcare pregătită și dusă la capăt de {club}.',
 ],
 idea_finally:[
  'În sfârșit! Ideea celor de la {club} iese, după câteva încercări.',
  'A treia oară e cu noroc: {club} reușește faza pregătită!',
  'Au tot încercat, și acum iese! {club} își vede planul pe teren.',
 ],
};

// ---------------------------------------------------------------------
//  HOW MANY: {passes} in a one-touch move (3 at least; 7 and more read "multe")
export const PASS_COUNT:Record<number,string>={3:'trei',4:'patru',5:'cinci',6:'șase'};
/** {secs}: a counter-attack's seconds from winning the ball to the goal, in words. */
export function secondsWords(s:number):string{
 const n=Math.max(1,Math.round(s));
 const W:Record<number,string>={1:'o secundă',2:'două secunde',3:'trei secunde',4:'patru secunde',5:'cinci secunde',6:'șase secunde',7:'șapte secunde',8:'opt secunde',9:'nouă secunde',10:'zece secunde'};
 return W[n]??`${n} de secunde`;
}

// ---------------------------------------------------------------------
//  WHY A SUBSTITUTION WAS MADE: the {reason} of the lines above, by the
//  manager's trigger. {player} = the one coming on, {other} = going off.
//  Leave one empty ('') to use the plain lines for that trigger.
// ---------------------------------------------------------------------
export const SUB_REASON:Record<string,string>={
 tired:'{other} a rămas fără aer.',
 losing:'Antrenorul caută o reacție.',
 drawing:'Se caută golul care rupe egalitatea.',
 winning:'Se apără avantajul.',
 down:'Scorul cere schimbări.',
 up:'Avantajul e liniștitor, titularii mai respiră.',
 half:'Schimbarea stabilită pentru a doua jumătate.',
};

// ---------------------------------------------------------------------
//  WHY THE PLAN CHANGED: the {reason} of the change-of-plan lines, by the
//  condition the manager set. Leave one empty ('') to drop it.
// ---------------------------------------------------------------------
export const SWITCH_REASON:Record<string,string>={
 losing:'E nevoie de o reacție.',
 drawing:'Se caută golul care rupe egalitatea.',
 winning:'Acum se apără avantajul.',
 down:'Scorul cere altceva.',
 up:'Avantajul permite altă abordare.',
 always:'Așa era stabilit dinaintea meciului.',
};
/** The style a club switches to, as the line says it ({style}). */
export const SWITCH_STYLE:Record<string,string>={
 balanced:'un joc echilibrat',
 combinations:'combinații scurte',
 direct:'joc direct',
 counter:'contraatac',
};

// ---------------------------------------------------------------------
//  CLUB FLAVOUR: an extra sentence after a line about that club.
//  `on`: goal (the club scores), concede (the club concedes),
//        save (the club's keeper saves), foul (the club fouls).
//  Match by club name (case and diacritics ignored).
// ---------------------------------------------------------------------
export type FlavourOn='goal'|'concede'|'save'|'foul';
export const FLAVOUR:Record<string,{on:FlavourOn;text:string}[]>={
 'malpraxis':[
  {on:'foul',text:'La Malpraxis, intervenția e gratuită, fără programare.'},
  {on:'goal',text:'Diagnostic clar: gol. Malpraxis nu dă a doua opinie.'},
  {on:'concede',text:'Malpraxis nu renunță niciodată. Pacientul încă respiră.'},
 ],
 'umanoizii':[
  {on:'goal',text:'Umanoizii execută programul: minge, poartă, repetă.'},
  {on:'concede',text:'Eroare la Umanoizii: apărarea nu răspunde la comenzi.'},
  {on:'save',text:'Portarul Umanoizilor a calculat traiectoria cu trei zecimale.'},
 ],
 'umanoeasy':[
  {on:'goal',text:'Umanoeasy execută programul: minge, poartă, repetă.'},
  {on:'concede',text:'Eroare la Umanoeasy: apărarea nu răspunde la comenzi.'},
  {on:'save',text:'Portarul de la Umanoeasy a calculat traiectoria cu trei zecimale.'},
 ],
 'rapid pensia':[
  {on:'goal',text:'Rapid Pensia înscrie, iar pensia parcă vine mai devreme luna asta!'},
  {on:'concede',text:'La Rapid Pensia se cere o pauză de pastile.'},
  {on:'foul',text:'Rapid Pensia apără ca la coada de la farmacie: nu trece nimeni.'},
 ],
 'adjud style':[
  {on:'goal',text:'Adjud Style schimbă macazul, iar trenul intră direct în gară!'},
  {on:'concede',text:'La Adjud, trenul a mai întârziat o dată.'},
 ],
 'neo-testament':[
  {on:'goal',text:'Și s-a făcut gol. Și a văzut Neo-Testament că e bine.'},
  {on:'save',text:'Minune la Neo-Testament! Portarul a despărțit apele.'},
  {on:'concede',text:'Neo-Testament întoarce și celălalt obraz.'},
 ],
 'inter':[
  {on:'goal',text:'Inter joacă direct, fără complicații. Stil milanez, livrat la domiciliu.'},
  {on:'concede',text:'Chiar și Inter mai are serile lui.'},
 ],
};

// ---------------------------------------------------------------------
//  AT HOME (a club's own ground speaking): a spare sentence after the
//  kickoff line, after a home goal (now and then, at most twice) and after
//  a home win at the final whistle. Only when that club plays at home.
//  Inter plays at San Siro, "La Scala del calcio"; the Curva Nord sings
//  what it really sings ("Pazza Inter amala", "C'è solo l'Inter",
//  "Chi non salta rossonero è"). No ultras group names, by choice.
// ---------------------------------------------------------------------
export type HomeOn='kickoff'|'goal'|'win';
export const AT_HOME:Record<string,Partial<Record<HomeOn,string[]>>>={
 'inter':{
  kickoff:[
   'Seară de San Siro: La Scala del calcio e plină, iar Curva Nord cântă de dinainte de fluier.',
   'Ceață de Milano, luminile pe acoperișul roșu și San Siro în picioare. Inter e acasă.',
   'Bine ați venit pe San Siro! Curva Nord a ridicat deja eșarfele.',
  ],
  goal:[
   'San Siro explodează, din Curva Nord se aude: „Pazza Inter, amala!”',
   'Torțele se aprind în Curva Nord. Tot stadionul: „Pazza Inter, amala!”',
   'Se zguduie La Scala del calcio! „C’è solo l’Inter”, cântă tribunele.',
  ],
  win:[
   'Și acum sare tot San Siro: „Chi non salta rossonero è!”',
   'Curva Nord nu pleacă acasă: „È una gioia infinita, che dura una vita.”',
  ],
 },
};

// ---------------------------------------------------------------------
//  THE POST-MATCH REPORT (shown after full time). Same slots, plus:
//    {n}  a count (goals, saves...)     {list}  a list of names
//    {first} {second}  times like 7:31
// ---------------------------------------------------------------------
export const REPORT:Record<string,string[]>={
 head_win:['{club} câștigă, {score}.','Victorie pentru {club}: {score}.'],
 head_comeback:['{club} întoarce meciul și câștigă, {score}.','Revenire mare: {club} câștigă {score} după ce a fost condusă.'],
 head_rout:['{club} face show: {score}.','Seară de neuitat pentru {club}: {score}.'],
 head_draw:['Egal, {score}. Nimeni nu pleacă învins.','{home} și {away} își împart punctele: {score}.'],
 head_goalless:['0–0. Portarii au avut ultimul cuvânt.'],
 first_goal:['{player} a deschis scorul la {min} pentru {club}.'],
 first_own:['Primul gol a venit dintr-un autogol, la {min}.'],
 turn_lead:['Momentul-cheie: la {min}, {player} a dus {club} în față, {score}, iar rezultatul nu s-a mai întors.'],
 turn_equal:['La {min}, {player} a egalat, {score}.'],
 late:['Pe final, la {min}, {player} a lovit decisiv: {score}.'],
 top_scorer:['{player} a înscris {n} goluri.','{player}: {n} goluri într-o singură seară.'],
 hat_trick:['{player} a reușit hat-trick-ul!','Hat-trick pentru {player}!'],
 assists:['{player} a pasat decisiv de {n} ori.'],
 keeper:['{player} a avut {n} parade.'],
 dribbler:['{player} a trecut de {n} adversari.'],
 ideas_none:['Nicio idee pregătită nu a ieșit în meciul ăsta.'],
 ideas:['Ideile pregătite: {club} a reușit {n}.'],
 shots:['La șuturi: {home} {first}, {away} {second}.'],
};
