/** Local-only ranking: the provider never receives Vault contents or review history. */
import { normalizeText } from './store.js';
export function rankTutorPhrases(phrases, { savedItems = [], confirmedErrors = [], now = Date.now() } = {}) {
  const saved = new Set(savedItems.filter((x) => x.type === 'phrase').map((x) => normalizeText(x.text)));
  const due = new Set(savedItems.filter(x => x.type === 'phrase' && Number(x.due) <= now && x.userData?.status !== 'known').map(x => normalizeText(x.text)));
  const errorCounts = new Map();
  for (const row of confirmedErrors) {
    const key = normalizeText(row.phrase);
    if (key) errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
  }
  return phrases.map((p) => {
    const key=normalizeText(p.phrase), isSaved=saved.has(key), errors=errorCounts.get(key)||0;
    const isDue=due.has(key);
    const localReason=isDue?'This phrase is due for review in your local study schedule.':errors?`You've confirmed ${errors} earlier issue${errors===1?'':'s'} with this phrase.`
      :isSaved?'Already in your Vault; practise it in a fresh context.':'New phrase for your Vault.';
    return {...p,localReason,_rank:errors*100+(isDue?50:0)+(isSaved?10:0)};
  }).sort((a,b)=>b._rank-a._rank||a.phrase.localeCompare(b.phrase)).map(({_rank,...p})=>p);
}
