const fs = require('node:fs');
const path = require('node:path');
const { MDict } = require('../js/mdict.js');
const { loadCorpus, phrasePageUrl } = require('./build-phrase-pages.cjs');

const root = path.resolve(__dirname, '..');
const normalize = value => value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');

async function buildLookupData() {
  const pages = {};
  const words = require('../docs/wordpages-manifest.json');
  const phrases = require('../docs/phrasepages-manifest.json');
  for (const slug of words.slugs) pages[normalize(slug)] = `/vi/tu/${encodeURIComponent(slug)}/`;
  for (const entry of phrases.entries) pages[normalize(entry.phrase)] = phrasePageUrl(entry.phrase);
  const dict = await new MDict(new Blob([fs.readFileSync(path.join(root, 'dicts-en-vi/star_anhviet.mdx'))]), 'star_anhviet.mdx').init();
  const entries = {};
  const corpus = loadCorpus();
  for (const entry of require('../data/lookup-extra.json')) {
    pages[normalize(entry.phrase)] = entry.source;
    corpus.set(normalize(entry.phrase), entry);
  }
  for (const [query, entry] of corpus) {
    if (!pages[normalize(query)] || (await dict.lookup(query)).length) continue;
    if (!entry.senses.every(sense => typeof sense.m === 'string' && Array.isArray(sense.ex) &&
        sense.ex.every(example => Array.isArray(example) && example.length === 2 && example.every(text => typeof text === 'string')))) {
      throw new Error(`Invalid authored lookup entry: ${query}`);
    }
    entries[normalize(query)] = { ...entry, source: pages[normalize(query)] };
  }
  return { entries, pages, corrections: require('../data/lookup-corrections.json') };
}

if (require.main === module) buildLookupData().then(data => {
  const file = path.join(root, 'data/lookup-supplement.json');
  const text = JSON.stringify(data) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(file, 'utf8') !== text) throw new Error('Lookup data changed. Run node tools/build-lookup-data.cjs');
  } else fs.writeFileSync(file, text);
  console.log(`Lookup supplement: ${Object.keys(data.entries).length} entries, ${Object.keys(data.pages).length} page links, ${Buffer.byteLength(text)} bytes`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { buildLookupData };
