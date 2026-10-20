import test from 'node:test';
import assert from 'node:assert/strict';
import {contactLoad,felt,struck,lunged,STEP,FALL_FROM} from '../dist/practice-balance.js';
import {play,tackle,mismatch,wonTackles} from './constructed-scenes.mjs';

// Duel recovery (2026-10-16): each man's time out of the play follows what happened to his body in the duel
// (practice-balance.ts). Before: the beaten man 0.72 s at strength 6 whatever happened, the tackler 1.4 s from the start
// of every challenge.
const man=(strength=6,defending=6)=>({skills:{strength,defending}});
const poke={closingSpeed:1.5,ballFirst:true,leg:false,collision:false};
const collision={closingSpeed:5,ballFirst:false,leg:false,collision:true};

test('a clean poke: the man who lost it only has to put his foot down again; a collision costs him far longer, or puts him down',()=>{
 const p=man(),soft=struck(p,felt(contactLoad(poke),man(),p),0);
 assert.equal(soft.down,0);assert(soft.challenge<.5&&soft.touch>0,`poke: challenge ${soft.challenge}, touch ${soft.touch}`);
 const hit=felt(contactLoad(collision),man(),p);assert(hit>FALL_FROM,`a 5 m/s body collision is a fall risk (${hit})`);
 const hard=struck(p,hit,.99),floored=struck(p,hit,0);
 assert(hard.challenge>soft.challenge+.5,`collision ridden: ${hard.challenge} v poke ${soft.challenge}`);
 assert(floored.down>=.5&&floored.down<=2&&floored.touch>=floored.down&&floored.challenge>floored.down,`down for ${floored.down} s`);
});

test('a lunge that met nothing leaves the tackler out longer than a clean nick',()=>{
 const d=man();
 const nick=lunged(d,{reach:.7,closing:1.5,followThrough:.15,met:true,hit:0},1);
 const miss=lunged(d,{reach:1.25,closing:4,followThrough:.4,met:false,hit:0},1);
 assert(nick.challenge<.6,`nick ${nick.challenge}`);assert(miss.challenge>nick.challenge+.6,`miss ${miss.challenge} v nick ${nick.challenge}`);
 // the same lunge costs less when the boot met the ball than when it met nothing
 assert(lunged(d,{reach:1.25,closing:4,followThrough:.4,met:true,hit:0},1).challenge<miss.challenge);
});

test('strength rides a hit and lands one; defending keeps the tackler over his lunge',()=>{
 const load=contactLoad({closingSpeed:3,ballFirst:true,leg:true,collision:false});
 assert(felt(load,man(),man(9))<felt(load,man(),man(3)),'a strong man feels the same tackle less');
 assert(felt(load,man(9),man())>felt(load,man(3),man()),'a strong tackler lands it harder');
 assert(struck(man(9),1.5,1).challenge<struck(man(3),1.5,1).challenge,'and recovers from it sooner');
 const lunge={reach:1.1,closing:3,followThrough:.3,met:false,hit:0};
 assert(lunged(man(6,9),lunge,1).challenge<lunged(man(6,3),lunge,1).challenge,'a good defender recovers from the same lunge sooner');
});

// The gap the recovery probe found: after a won tackle that knocked the ball loose the tackled man had no touch ban and
// was next on the ball 0.05 s later in about 40% of those tackles. Now he cannot touch it before his foot is down again,
// and nobody reads him as first to it meanwhile.
test('the tackled man never re-collects the loose ball inside his touch ban',()=>{
 // If this fails: a tackle that wins nothing, the beaten man picking the loose ball straight back up (before the ban he
 // was next on it 0.05 s later in about 40% of such tackles). Enough: each duel knocks the ball loose at both men's feet;
 // in the side duel it comes to rest nearer the beaten man (0.59 m against 0.85 m), so only his ban keeps him off it.
 // (Lane C, 2026-10-21: replaces seed 2027's 300 s match, its "six or more" and the 20% share, which was a statistic of
 // that one passage.)
 for(const where of ['front','side']){
  const r=play(tackle(where),{edit:mismatch}),frames=r.frames,won=wonTackles(r);
  assert(won.length,`${where}: the top tackler knocks it loose`);
  for(const e of won){
   const k=frames.findIndex(x=>x.time>e.time+1e-6),next=frames.slice(k).find(x=>x.time>e.time+3||x.restart||(x.control?.owner??x.ball.owner));
   const who=next&&!next.restart&&next.time<=e.time+3?next.control?.owner??next.ball.owner:null;
   if(who===e.target)assert(next.time-e.time>=e.balance.victim.touch-1e-6,`${e.target} re-collected ${(next.time-e.time).toFixed(2)} s after the tackle at ${e.time.toFixed(2)}`);
  }
 }
});
