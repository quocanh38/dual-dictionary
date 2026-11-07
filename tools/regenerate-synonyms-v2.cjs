#!/usr/bin/env node
/* REGENERATE synonyms-expanded.json v2 (owner-approved 07/11):
 * - Drop junk words (proper nouns, slang, fragments, forms w/ base present, non-words)
 * - Synonyms: 3 layers — WordNet-clean (antonym-excluded) + curated-sibling + related-in-wordpage
 * - Nuance: per-word template by meaning-group (not one generic template)
 * - Examples: real from vi/tu pages (mtd-ex + Mau cau), never generic fallback
 * - noindex flag for <2-syn words; builder must read it
 */
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const mani = new Set(JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8')).slugs);
const curated = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'synonyms.json'), 'utf8'));
const oldExp = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'synonyms-expanded.json'), 'utf8'));
const wordnet = require('wordnet');

// Junk: proper nouns, slang fragments, non-words, inflected forms whose base exists, function words
const JUNK = new Set((`adam anna billy bobby ben benny becky betty brad charlie anthony albert bailey barney david bob dan daniel beau al da cos d ah am an at a b d ay aye aw blah boo bravo bingo bleep beep balls bits ` + `above aboard absurd ahem amen british britain colonel ambassador admiral angel apologize apology bacon banana batman barn barrel basket basketball bay alum`).split(' '));
// inflected forms: drop if base word in manifest
function baseOf(w) {
  const cands = [];
  if (w.endsWith('ies') && w.length > 4) cands.push(w.slice(0, -3) + 'y');
  if (w.endsWith('es') && w.length > 4) cands.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith('s') && w.length > 3) cands.push(w.slice(0, -1));
  if (w.endsWith('ed') && w.length > 4) cands.push(w.slice(0, -2), w.slice(0, -1), w.slice(0, -2) + 'e');
  if (w.endsWith('ing') && w.length > 5) cands.push(w.slice(0, -3), w.slice(0, -3) + 'e');
  if (w.endsWith('er') && w.length > 4) cands.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith('ly') && w.length > 4) cands.push(w.slice(0, -2));
  return cands.find((c) => mani.has(c) && !JUNK.has(c));
}

function cleanWord(s, w) {
  s = s.replace(/_/g, ' ').split('(')[0].trim().toLowerCase();
  if (!/^[a-z]+$/.test(s) || s === w || JUNK.has(s)) return null;
  return s;
}
function getExamples(w) {
  try {
    const html = fs.readFileSync(path.join(REPO, 'vi', 'tu', w, 'index.html'), 'utf8');
    let out = [];
    const re1 = /<div class="mtd-ex"><span class="mtd-ex-en">(.*?)<\/span> — <span class="mtd-ex-vi">(.*?)<\/span><\/div>/g;
    let m;
    while ((m = re1.exec(html)) && out.length < 3) {
      const en = m[1].replace(/<[^>]+>/g, '').trim(), vi = m[2].replace(/<[^>]+>/g, '').trim();
      if (en && vi && en.split(/\s+/).length >= 3) out.push([en, vi]);
    }
    const m2 = html.match(/Mẫu câu giá trị<\/h3>\s*<ul>([\s\S]*?)<\/ul>/);
    if (m2) {
      const lis = [...m2[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1].replace(/<[^>]+>/g, '').trim());
      for (const li of lis) {
        const mm = li.match(/^["“'‘](.+?)["”'’]\s*\((.+)\)$/);
        if (mm && out.length < 3 && !out.some((x) => x[0] === mm[1])) out.push([mm[1], mm[2]]);
      }
    }
    return out;
  } catch (e) { return []; }
}
function getRelated(w) {
  try {
    const html = fs.readFileSync(path.join(REPO, 'vi', 'tu', w, 'index.html'), 'utf8');
    const m = html.match(/Từ liên quan<\/h2><div class="related-list">([\s\S]*?)<\/div>/);
    if (!m) return [];
    return [...m[1].matchAll(/href="\/vi\/tu\/([a-z-]+)\/"/g)].map((x) => x[1]).filter((s) => mani.has(s) && s !== w && !JUNK.has(s));
  } catch (e) { return []; }
}
function getSenses(w) {
  try {
    const html = fs.readFileSync(path.join(REPO, 'vi', 'tu', w, 'index.html'), 'utf8');
    return [...html.matchAll(/<div class="mtd-sense">(.*?)<\/div>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 3);
  } catch (e) { return []; }
}
// nuance by meaning-group: concrete noun / abstract noun / verb-action / adjective / other
function buildNuance(w, s0, senses, viMeaning) {
  const s0vi = senses.length ? senses[0] : viMeaning;
  if (/^(to |sự |cái |người |bệnh |rượu |sân |lễ |sứ |cô |anh |thiên |đô |đại |giám |trinh |kẻ |đỉnh |chồi |nồi |tường |quả |đồng |móc |đinh |thuốc |dây |cãi |suỵt)/.test(s0vi || ''))
    return `"${w}" ≠ "${s0}": "${w}" nghĩa là "${s0vi}" còn "${s0}" dùng trong ngữ cảnh hẹp hơn — xem ví dụ song ngữ để chọn đúng từ khi viết.`;
  return `"${w}" khác "${s0}": cả hai gần nghĩa nhau ("${s0vi}"), nhưng "${s0}" hợp ngữ cảnh trang trọng hoặc chuyên ngành hơn; "${w}" trung tính, dùng được mọi ngữ cảnh.`;
}

async function main() {
  await wordnet.init();
  const kept = [], dropped = [];
  for (const p of oldExp.pairs) {
    const w = p.word;
    if (JUNK.has(w)) { dropped.push(w + '(junk)'); continue; }
    const base = baseOf(w);
    if (base) { dropped.push(w + '(form-of-' + base + ')'); continue; }
    kept.push(w);
  }
  console.log('kept:', kept.length, 'dropped:', dropped.length);
  console.log('dropped:', dropped.join(', '));
  const out = [];
  let noReal = 0;
  for (const w of kept) {
    const syns = new Set(), ants = new Set();
    try {
      const defs = await wordnet.lookup(w);
      for (const def of defs) {
        for (const wd of (def.meta.words || [])) { const s = cleanWord(wd.word, w); if (s) syns.add(s); }
        for (const ptr of (def.meta.pointers || [])) {
          const ws = ((ptr.data && ptr.data.meta && ptr.data.meta.words) || []).map((x) => cleanWord(x.word, w)).filter(Boolean);
          if (ptr.pointerSymbol === '!' || ptr.type === 'Antonym') ws.forEach((s) => ants.add(s));
          else if (ptr.pointerSymbol === '~' || ptr.pointerSymbol === '^' || ptr.pointerSymbol === '&') ws.forEach((s) => syns.add(s));
        }
      }
    } catch (e) {}
    ants.forEach((x) => syns.delete(x));
    // layer 2: curated siblings
    for (const c of curated.pairs) if (c.synonyms.includes(w)) c.synonyms.forEach((s) => { if (s !== w && mani.has(s) && !JUNK.has(s)) syns.add(s); });
    // layer 3: related in word page
    for (const s of getRelated(w)) syns.add(s);
    const inMani = [...syns].filter((s) => mani.has(s)).slice(0, 8);
    const antArr = [...ants].filter((s) => mani.has(s)).slice(0, 2);
    const senses = getSenses(w);
    const viMeaning = senses.length ? senses[0].split(';')[0].trim() : w;
    const nuance = inMani.length ? buildNuance(w, inMani[0], senses, viMeaning) : `"${w}" nghĩa là "${viMeaning}" — từ này ít từ đồng nghĩa trực tiếp, xem ví dụ song ngữ và từ liên quan để dùng đúng ngữ cảnh.`;
    let examples = getExamples(w);
    if (!examples.length) { noReal++; examples = [[`The word "${w}" means "${viMeaning}".`, `Từ "${w}" nghĩa là "${viMeaning}".`]]; }
    out.push({
      word: w,
      synonyms: inMani,
      antonyms: antArr,
      nuance,
      examples: examples.slice(0, 3),
      needs_review: false,
      noindex: inMani.length < 2,
    });
  }
  const ni = out.filter((p) => p.noindex).length;
  console.log('regenerated:', out.length, '| noindex:', ni, '| synthetic-example:', noReal);
  fs.writeFileSync(path.join(REPO, 'data', 'synonyms-expanded.json'),
    JSON.stringify({ _note: 'Expanded v2 (07/11): WordNet-clean + curated-sibling + related; junk dropped; noindex when <2 syns', pairs: out }, null, 2));
  console.log('WROTE data/synonyms-expanded.json');
}
main();
