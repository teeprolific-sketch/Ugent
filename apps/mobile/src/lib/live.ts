/* Voice confirmations for Live conversations: "yes" and "no" in the six languages. */
import { norm } from '@ugent/core';

const clean = (s: string) => norm(s).replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();

const YES = ['yes', 'yeah', 'yep', 'yes please', 'do it', 'go ahead', 'ok', 'okay', 'sure', 'please do', 'yes do it',
  'oya', 'do am', 'abeg do am', 'na so', 'correct',
  'beeni', 'ee', 'o daa', 'se e',
  'eh', 'ehn', 'mee ya', 'o di mma',
  'i', 'to', 'eh to', 'yi shi', 'yi',
  'oui', 'vas y', "d'accord", 'oui vas y', 'fais le'];
const NO = ['no', 'nope', 'not now', 'cancel', 'no thanks', 'leave it', "don't", 'dont',
  'no be am', 'leave am', 'no do am',
  'rara', 'beko', 'ma se', 'mba', 'emela', "a'a", 'aa', "kar ka yi", 'non', 'annule', 'pas maintenant'];
const END = ['bye', 'goodbye', 'stop', 'end', 'that is all', "that's all", 'thank you bye', 'odabo', 'ka emesia', 'sai anjima', 'au revoir'];

export const isYes = (s: string) => YES.includes(clean(s));
export const isNo = (s: string) => NO.includes(clean(s));
export const isGoodbye = (s: string) => END.includes(clean(s));
