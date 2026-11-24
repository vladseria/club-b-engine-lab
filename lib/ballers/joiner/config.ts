// The joiner's constants: the TypeScript twin of `private.ballers_joiner_config()` (file B of the joiner migrations,
// deliverables/ballers-joiner/db/DB-PLAN.md §2), key for key and value for value. The server is the authority (it
// decides the step and writes the energies); the client reads these only to word and time what the server already did.
// A change is made in both places together (verificare/ballers-joiner-client.test.ts holds the keys).
export const JOINER_CONFIG={
 /** rounds played (done AND visible) from which a founding gets the deal instead of a re-draw */ threshold:5,
 /** awarded points: the last-placed member's points minus this, never below 0 */ margin:3,
 /** seconds of walk-out before a pace-'match' try kicks off */ walkout:150,
 /** seconds a quick try may run before it times out */ quickTimeout:600,
 /** the AI side's start energy at each step of the ladder (every man, bench included) */ steps:{fit:90,tired:80,empty:72},
 /** try 1, 2, 3 (and every later try: the last) */ ladder:['fit','tired','empty'],
 /** every newcomer man's start energy */ newcomerEnergy:100,
 /** dropped tries a play-off may have ("Bebe has had a word") */ maxDropped:30,
 /** days a takeover's lines stay open from its shown_from */ lineDays:7,
 /** hours a line may be edited after it is first said */ lineEditHours:24,
 /** the largest engine input ballers_playoff_start takes, in bytes */ inputBytes:300000,
 /** the most goals a side may score in a reported try or a stored win (the engine has made 29-0) */ maxGoals:40,
} as const;
export type JoinerConfig=typeof JOINER_CONFIG;
