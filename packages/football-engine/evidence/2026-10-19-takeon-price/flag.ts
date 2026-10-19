// Take-on price: the arm is the rev's NAME (as the bodies probe): rev `on` plays with TAKEON_PRICE on, any other name
// (off, live) with it off. The engine module is read as a namespace so a revision without the flag (live main) bundles.
import * as feints from '../../src/practice-feints';
export function setFlag(rev:string):boolean{
 const f=(feints as any).TAKEON_PRICE,on=rev==='on';
 if(f)f.on=on;else if(on)throw Error('this revision has no TAKEON_PRICE flag');
 return on;
}
