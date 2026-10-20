// Option check: unit checks, no match played (node unit.mjs bundles this through hook.mjs and runs it).
import assert from 'node:assert/strict';
import {describe,classify,snapshot,restore,reseed} from './option';
import {rng} from '../../src/model';

export function run(){
 const out:string[]=[];
 // ---- classify: carrier side 0 at x 20; their outfielders' deepest (in our attacking frame) at x 30
 const p={id:'0:A',side:0,x:20,y:0};
 const players=[p,{id:'1:GK',side:1,role:'GK',x:47,y:0},{id:'1:D',side:1,role:'CB',x:30,y:0},{id:'1:W',side:1,role:'W',x:25,y:3}];
 assert.equal(classify(p,players,{kind:'through',aim:{x:28,y:0},run:{}}),'behind');// run in behind
 assert.equal(classify(p,players,{kind:'pass',aim:{x:31,y:2}}),'behind');// beyond their last outfielder
 assert.equal(classify(p,players,{kind:'pass',aim:{x:24,y:2}}),'pass');
 assert.equal(classify(p,players,{kind:'loft',aim:{x:17,y:2}}),'back');
 assert.equal(classify(p,players,{kind:'clear',aim:{x:40,y:2}}),'back');
 assert.equal(classify(p,players,{kind:'feint',aim:{x:22,y:0},target:'1:W'}),'takeon');
 assert.equal(classify(p,players,{kind:'shoot',aim:{x:48,y:0}}),'shot');
 assert.equal(classify({...p,side:1,x:28},players.map(q=>({...q,side:1-q.side,x:48-q.x})),{kind:'pass',aim:{x:16,y:0}}),'behind');// mirrored
 out.push('classify ok');
 // ---- describe: a held carry route (continuing, inside its plan) drawn at the best carry's value (chooseFootballOption's
 // stand-in), a better-scored new carry the engine filters out, a take-on .066 below, a back pass outside the band
 const carry=(score:number,continuing:boolean)=>({kind:'carry',aim:{x:23,y:0},score,continuing,reason:'',
  carry:{purpose:'advance',goalGain:.1,shotGain:0,passGain:0,escapeGain:0,obstruction:.1,clearance:4,turnCost:0}});
 const held=carry(.40,true),fresh=carry(.461,false),feint={kind:'feint',aim:{x:22,y:0},target:'1:W',score:.395,reason:''},back={kind:'pass',aim:{x:12,y:0},target:'0:B',score:.1,reason:''};
 fresh.carry.goalGain=.05;// so neither carry dominates the other
 const d=describe(p,players,[fresh,held,feint,back],{aim:{x:23,y:0},until:10,purpose:'advance',reason:''},5);
 assert.equal(d.cls.carry!.i,1,'carry representative = the held route');
 assert.equal(d.cls.carry!.score,.461);assert.equal(d.cls.carry!.raw,.40);
 assert.equal(d.topCls,'carry');assert.equal(d.top,.461);
 const w=Math.exp((.395-.461)/.04);
 assert.ok(Math.abs(d.cls.takeon!.p-w/(1+w))<1e-12,`takeon p ${d.cls.takeon!.p}`);
 assert.equal(d.cls.back!.p,0);assert.equal(d.viableCls,2);
 // no plan: nothing is held, the fresh carry is the representative at its own score
 const e=describe(p,players,[fresh,held,feint,back],null,5);
 assert.equal(e.cls.carry!.i,0);assert.equal(e.cls.carry!.score,.461);
 out.push(`describe ok (held-route stand-in, takeon p ${d.cls.takeon!.p.toFixed(3)})`);
 // ---- snapshot / restore: identity, contents, key order, Map/Set order, appended records, rng state, let bindings
 const g=rng(7),inner={a:1,b:[1,2,{c:3}]},m=new Map<any,any>([['x',inner],['y',2]]),st=new Set([1,2]);
 const root:any={tick:5,obj:{k1:1,k2:inner,k3:g},m,st,events:[{e:1}],arr:[inner,inner],time:1.5};
 let lets:any={tick:5,time:1.5};
 const S=snapshot(root,['time']);
 const before=JSON.stringify([root.obj,[...m],[...st],root.arr,root.events]),r0=g();
 // mutate everything
 inner.a=9;inner.b.push(4);(inner.b[2] as any).c=7;delete (root.obj as any).k1;(root.obj as any).k1=1;(root.obj as any).k4=4;
 m.delete('x');m.set('z',3);m.set('x',{});st.delete(1);st.add(1);st.add(3);root.events.push({e:2});root.arr[1]={};g();g();
 restore(S,v=>{lets=v;});
 assert.equal(JSON.stringify([root.obj,[...m],[...st],root.arr,root.events]),before);
 assert.equal(Object.keys(root.obj).join(),'k1,k2,k3','key order restored');
 assert.ok(m.get('x')===inner&&root.arr[0]===inner&&root.arr[1]===inner&&root.obj.k2===inner,'identity preserved');
 assert.equal(g(),r0,'rng state restored');
 assert.deepEqual(lets,{tick:5,time:1.5});
 out.push('snapshot/restore ok');
 // ---- reseed: same (frame, seed index) -> same streams; another seed index -> different
 restore(S,()=>{});reseed(S,123,0);const a1=g();restore(S,()=>{});reseed(S,123,0);const a2=g();restore(S,()=>{});reseed(S,123,1);const a3=g();
 assert.equal(a1,a2);assert.notEqual(a1,a3);
 out.push('reseed ok');
 return out;
}
