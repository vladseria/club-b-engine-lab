import type {Fixture,Side,Tactics} from './model.js';

export const defensiveApproaches={
 original:{name:'Tactica echipei',description:'Folosește tactica obișnuită a adversarului.',tactics:{}},
 press:{name:'Presing sus',description:'Închide purtătorul devreme și strânge opțiunile de pasă. Poate lăsa spațiu în spate.',tactics:{line:'high',press:'aggressive',width:'standard',marking:'balanced'}},
 compact:{name:'Bloc compact',description:'Protejează centrul, glisează împreună și iese la minge când atacul se apropie.',tactics:{line:'deep',press:'selective',width:'narrow',marking:'zonal'}},
 tight:{name:'Marcaj strâns',description:'Urmărește primitorii mai aproape și mai departe de propria zonă. Cursele îi pot scoate din poziție.',tactics:{line:'standard',press:'balanced',width:'standard',marking:'tight'}},
} as const satisfies Record<string,{name:string;description:string;tactics:Partial<Tactics>}>;
export type DefensiveApproach=keyof typeof defensiveApproaches;

/** Ordinary team tactics, usable by a match job or a training fixture alike. */
export function withDefensiveApproach(fixture:Fixture,side:Side,approach:DefensiveApproach):Fixture {
 if(!Object.hasOwn(defensiveApproaches,approach)||![0,1].includes(side))throw Error('Unknown defensive approach or team.');
 const result=structuredClone(fixture);
 Object.assign(result.teams[side].tactics,defensiveApproaches[approach].tactics);
 return result;
}
