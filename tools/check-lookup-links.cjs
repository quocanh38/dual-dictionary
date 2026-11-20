const fs = require('node:fs');
const path = require('node:path');
const { MDict } = require('../js/mdict.js');
const { lemmaCandidates } = require('../js/lookup-lemmas.js');

const root = path.resolve(__dirname, '..');
const site = 'https://hocta.app';
const normalize = value => value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, entity) => {
  const named = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  return entity[0] === '#' ? String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === 'x' ? 2 : 1), entity[1].toLowerCase() === 'x' ? 16 : 10)) : named[entity.toLowerCase()];
});

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/lookup-supplement.json'), 'utf8'));
  const dict = await new MDict(new Blob([fs.readFileSync(path.join(root, 'dicts-en-vi/star_anhviet.mdx'))]), 'star_anhviet.mdx').init();
  const keys = new Set((await dict.loadAllKeys()).map(key => dict.normKey(key)));
  const queries = new Map();
  const errors = [];
  let links = 0;
  const files = htmlFiles(path.join(root, 'vi'));
  for (const file of files) {
    const source = '/' + path.relative(root, file).split(path.sep).join('/').replace(/index\.html$/, '');
    const html = fs.readFileSync(file, 'utf8');
    const h1 = decode((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g, '')).trim();
    for (const [tag, , href] of html.matchAll(/<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>/gi)) {
      const url = new URL(decode(href), site + source);
      if (url.origin !== site || !url.searchParams.has('q')) continue;
      links++;
      const q = url.searchParams.get('q');
      if (url.pathname !== '/' || url.searchParams.getAll('q').length !== 1 || !q.trim()) {
        errors.push(`${source}: invalid lookup URL ${href}`);
        continue;
      }
      if (Object.hasOwn(data.corrections, normalize(q))) errors.push(`${source}: incorrect query ${q}`);
      if (/\bclass=(['"])word-cta-btn\1/.test(tag) && normalize(h1) !== normalize(q)) errors.push(`${source}: heading ${h1} differs from query ${q}`);
      if (!queries.has(q)) queries.set(q, []);
      queries.get(q).push(source);
    }
  }
  for (const [query, sources] of queries) {
    if (data.entries[normalize(query)] || keys.has(dict.normKey(query)) || lemmaCandidates(query).some(key => keys.has(dict.normKey(key)))) continue;
    errors.push(`Unsupported query ${JSON.stringify(query)} from ${sources.join(', ')}`);
  }
  console.log(`Lookup link check: ${files.length} HTML pages, ${links} links, ${queries.size} queries`);
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
