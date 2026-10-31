import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = (await fs.readFile('js/store.js', 'utf8')).replace(
  /import \{[^}]+\} from '\.\/db\.js';/,
  'const openDb = async () => ({}), putFile = async () => {}, dbAllKnownRecords = async () => [], dbClearKnown = async () => {}, putKnownRecord = async () => {};',
);
const { makeItem, itemIdentityKey } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const first = makeItem({
  type: 'word', text: 'bank',
  dictionary: { source: 'English–Vietnamese', entryKey: 'bank', definition: 'A financial institution.', senseKey: 'vi:bank-finance' },
  context: { sentence: 'The bank approved her loan.', sourceTitle: 'Reading' },
});
const second = makeItem({
  type: 'word', text: 'bank',
  dictionary: { source: 'English–Vietnamese', entryKey: 'bank', definition: 'The land beside a river.', senseKey: 'vi:bank-river' },
  context: { sentence: 'We sat on the bank of the river.', sourceTitle: 'Reading' },
});
const repeat = makeItem({ type: 'word', text: 'bank', dictionary: { senseKey: 'vi:bank-finance' } });
const legacy = makeItem({ type: 'word', text: 'bank' });

assert.notEqual(itemIdentityKey(first), itemIdentityKey(second), 'different senses of the same headword must remain separate cards');
assert.equal(itemIdentityKey(first), itemIdentityKey(repeat), 'the same selected sense must deduplicate');
assert.notEqual(itemIdentityKey(first), itemIdentityKey(legacy), 'legacy unsensed cards must not absorb a selected sense');
assert.equal(first.dictionary.definition, 'A financial institution.', 'full selected definition must persist on the item');
assert.equal(first.context.sentence, 'The bank approved her loan.', 'source sentence must persist on the item');
console.log('PASS: multiple meanings remain separate, repeat sense deduplicates, legacy unsensed cards remain distinct, full meaning and context persist');
