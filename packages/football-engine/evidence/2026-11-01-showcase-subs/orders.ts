// Bebe's showcase, the coaches' substitutions (1 Nov 2026): the twin of the freezer's orders, as a rewrite of the
// orders the old freezer froze. Evidence only; the game's orders are the SQL's (supabase/migrations/
// 20261031090000_ballers_showcase.sql: private.ballers_showcase_subs for F.C. Bebe Power, ballers_showcase_guest_side
// for a guest side), and verificare/showcase-db.test.ts checks this twin against both.
//
// Before: Bebe two "tired" orders (prep's code 95) and a third if losing, not before 10:00; a guest side three "tired"
// orders. After: the first two "tired" orders not before half-time (7:30); the third if losing, not before 12:00, for
// the man the old third named (Bebe's: its `out`; a guest's: his tired trigger's player). Same ids, same bench men.
export const HALF_TIME=450,LATE=720;
export interface Order {id:string;in:string;out?:string;trigger:any;notBefore?:number}
export function halfTimeOrders(orders:readonly Order[]):Order[]{
 return orders.map((o,k)=>k<2
  ?{...o,trigger:{...o.trigger},notBefore:HALF_TIME}
  :{id:o.id,in:o.in,out:o.out??o.trigger.player,trigger:{kind:'score',state:'losing'},notBefore:LATE});
}
