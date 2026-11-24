// Moves: off (owner, 2 Oct 2026). "For now we should do a 'coming soon' for
// anything about creating your own game ideas. It needs more thought ... it
// needs a dedicated session." For a club on Game plan nothing creates, teaches,
// draws, rehearses or edits a move, and no move plays: the plan doors refuse
// one (`moves_off`, migration ballers_moves_off) and the switch-on seed copies
// none. Saved ideas stay stored (ballers_ideas) for when they come back.
//
// The move code (components/ballers/gameplan/moves/**, the rehearsal, the
// move routes) is kept in the repo, only unreachable. Past matches that had
// moves still show them in How the plan played and Watch: that's history.
// Turning moves back on is this flag plus a migration that drops the
// refusals; the dedicated session decides the rest.
export const MOVES_ON:boolean=false;
