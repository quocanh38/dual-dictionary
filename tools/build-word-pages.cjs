#!/usr/bin/env node
/* Word page generator for Dual Dictionary (batch 1: top 2,000 frequent words).
 *
 * Mirrors the DOL Dictionary idea: every headword gets its own static,
 * indexable page at /vi/tu/{word}/ with:
 *   - headword + IPA + part(s) of speech + Vietnamese senses (from the OVDP
 *     star_anhviet.mdx, rendered with the SAME mtd marker conventions as the
 *     app's entry renderer: * pos, @ domain, - sense, = example, + translation,
 *     ! idiom)
 *   - related words (shared prefix / same suffix family, top 6)
 *   - a CTA deep-linking into the offline app (?q=word)
 *   - full SEO meta + JSON-LD (DefinedTerm + BreadcrumbList) + word sitemap
 *
 * Data sources (all already shipped in this repo):
 *   dicts-en-vi/star_anhviet.mdx  - 386,600 entries (OVDP v1.1, MIT)
 *   data/ipa-en.json              - 149,600 IPA transcriptions
 *   data/freq-en.json             - top 10,000 headwords with frequency band
 *
 * Entry HTML fragments are untrusted dictionary content: this generator emits
 * them ESCAPED through the same marker parser the app uses (mtdToBlocks port),
 * never as raw HTML - if a fragment contains real HTML tags we strip them.
 */

const fs = require('fs');
const path = require('path');
const { MDict } = require('../js/mdict.js');
const { buildAutoNote, loadHandNote, renderNoteHTML, lemmaStems, compactRegisterLabels } = require('./word-notes-lib.cjs');
const { resolveIpa, IPA_CHAR_OK, lemmaCandidates } = require('./ipa-inflect.cjs');
const { wordGroup, ABBREV_RE, FRAGMENTS, PROPER_RE } = require('./wordlist-lib.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'tu');
const QA_PATH = path.join(REPO, 'docs', 'wordpages-qa.json');
const SITE = 'https://dualdictionary.netlify.app';
// P0: same volunteer feedback channel as the app (mailto, no tracking)
const REPORT_EMAIL = 'quocanh38@gmail.com';

/* v92: crossref targets outside the built 2,000-word set must NOT become
 * word-page links (they 404) — v89 patched 248 of those by hand; the generator
 * now does it natively: in-set → word page, out-set → /?q= search handoff. */
let BUILT = new Set();

/* ---------- tiny helpers (port of the app's conventions) ---------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* v104 (review 04/10, P2): OVDP sense text embeds its example pairs inline as
 * "=English+ Vietnamese" — rendered raw it reads as noise on every page.
 * Split each piece into the sense head plus structured pairs so the renderer
 * can show examples as their own lines. A "pair" candidate whose English part
 * has no real word (e.g. the "=2+2=4" shape) is kept as literal head text.
 * v109 (word-review 06/10): pieces whose example has NO Vietnamese part
 * ("==come here" — the "=" doubled in OVDP) are now en-only pairs instead of
 * leaking as literal "==…" text; the plus-pair letter guard is relaxed so
 * non-word examples like "1540 a.d." still split. */
function splitSensePairs(piece) {
  const parts = String(piece).split('=');
  const headParts = [parts.shift()];
  const pairs = [];
  for (const part of parts) {
    const plus = part.indexOf('+');
    const en = plus === -1 ? part : part.slice(0, plus);
    const vi = plus === -1 ? '' : part.slice(plus + 1);
    const lettersTotal = (en.match(/[a-zA-Z]/g) || []).length;
    const enOk = en.trim().length >= 3 && lettersTotal >= 2
      && (plus !== -1 || /[a-zA-Z]{2,}/.test(en));
    if (enOk) {
      pairs.push({ en: en.replace(/\s{2,}/g, ' ').trim(), vi: vi.replace(/\s{2,}/g, ' ').replace(/^[\s:]+/, '').trim() });
    } else {
      headParts.push('=' + part);
    }
  }
  return { head: headParts.join('='), pairs };
}

/* Port of the app's mtdToBlocks() (js/app.js). Input is raw MTD marker text;
 * output is structured blocks. Everything is escaped here (the app escapes
 * inside its crossref/escapeHtml too).
 *
 * LEGACY semantics — used for admission gates (thin-content counting) and the
 * JSON-LD pos list. Do NOT change what it counts: the v99 owner-approved page
 * set depends on it (04/10 lesson: counting the new mtd-ex lines shifted the
 * admitted set by ~30 words). */
function mtdToBlocks(text) {
  const blocks = [];
    const crossref = (s) => {
      const e = escapeHtml(s);
      // "(xem) word" crossrefs link into the word pages — or to the /?q= search
      // handoff when the target is not one of the built pages (v89 contract)
      return e.replace(/\(xem\)\s*([A-Za-z][^<>]*)$/, (m, word) => {
        // v109: a closing paren after the crossref (OVDP "(xem) pro_and_con)")
        // belongs to the outer paren pair — keep it OUT of the link text/href
        const w = word.endsWith(')') ? word.slice(0, -1).trimEnd() : word;
        const target = w.trim().toLowerCase();
        const href = BUILT.has(target) ? wordPageUrl(target) : '/?q=' + encodeURIComponent(target);
        return `(xem) <a href="${href}">${w}</a>${word.endsWith(')') ? ')' : ''}`;
      });
    };
  for (const seg of String(text).split(/(?=[@*!])/)) {
    if (!seg) continue;
    const type = '@*!'.includes(seg[0]) ? seg[0] : '';
    const body = type ? seg.slice(1) : seg;
    const pieces = body.split(/\s+-\s*/).map((p) => p.trim()).filter(Boolean);
    if (!pieces.length) continue;
    if (type === '*') blocks.push({ type: 'pos', text: pieces[0] });
    else if (type === '@') blocks.push({ type: 'domain', text: pieces[0] });
    else if (type === '!') blocks.push({ type: 'idiom', text: pieces[0] });
    else if (pieces[0]) blocks.push({ type: 'line', text: crossref(pieces[0]) });
    for (const p of pieces.slice(1)) blocks.push({ type: 'sense', text: crossref(p) });
  }
  for (const b of blocks) {
    if (b.type === 'domain') b.text = b.text.replace(/\s+-\s*$/, '');
  }
  return blocks;
}

/* Render variant: same parse, but "=English+ Vietnamese" example pairs are
 * split out of each piece into their own ex blocks (v104 P2). Rendering only —
 * admission never sees this. */
/* v110: OVDP also uses literal "!" as punctuation inside examples/translations
 * ("=all aboard!+ đề nghị…", "chao ôi!, than ôi!", "!agreed! - đồng ý!") — the
 * marker split reads each of those as an idiom section, which rendered as 864
 * fake bold blocks ("+ đề nghị mọi người lên tàu", ", trời ơi", whole
 * "=EN+VI" pairs…). A '!' segment is a FALSE split when its first piece is
 * empty, starts with "=" / "+" / "," / "-" / "(" / ";" (continuation of a pair,
 * multi-variant example list, sense or annotation — real idioms never start
 * with punctuation) or carries
 * Vietnamese diacritics (real idioms are English). False splits are
 * re-attached to the previous segment so the pair/sense parsers see the
 * original text again, punctuation intact. Legacy mtdToBlocks keeps the old
 * segmentation on purpose: admission gates + JSON-LD pos must not shift. */
const VN_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
function isFalseIdiomSplit(seg) {
  if (seg[0] !== '!') return false;
  const firstPiece = seg.slice(1).split(/\s+-\s*/)[0].trim();
  return firstPiece === '' || /^[=(+,;-]/.test(firstPiece) || VN_DIACRITICS.test(firstPiece);
}
function mergeFalseIdiomSplits(text) {
  const segs = String(text).split(/(?=[@*!])/).filter(Boolean);
  const out = [];
  for (const seg of segs) {
    if (out.length && isFalseIdiomSplit(seg)) out[out.length - 1] += seg;
    else out.push(seg);
  }
  return out;
}
function mtdToBlocksRender(text) {
  const blocks = [];
    const crossref = (s) => {
      const e = escapeHtml(s);
      return e.replace(/\(xem\)\s*([A-Za-z][^<>]*)$/, (m, word) => {
        // v109: a closing paren after the crossref (OVDP "(xem) pro_and_con)")
        // belongs to the outer paren pair — keep it OUT of the link text/href
        const w = word.endsWith(')') ? word.slice(0, -1).trimEnd() : word;
        const target = w.trim().toLowerCase();
        const href = BUILT.has(target) ? wordPageUrl(target) : '/?q=' + encodeURIComponent(target);
        return `(xem) <a href="${href}">${w}</a>${word.endsWith(')') ? ')' : ''}`;
      });
    };
  for (const seg of mergeFalseIdiomSplits(text)) {
    if (!seg) continue;
    const type = '@*!'.includes(seg[0]) ? seg[0] : '';
    const body = type ? seg.slice(1) : seg;
    const pieces = body.split(/\s+-\s*/).map((p) => p.trim()).filter(Boolean);
    if (!pieces.length) continue;
    if (type === '*') blocks.push({ type: 'pos', text: pieces[0] });
    else if (type === '@') blocks.push({ type: 'domain', text: pieces[0] });
    else if (type === '!') {
      // v110: merged false splits can leave "=EN+VI" pairs inside an idiom
      // piece — split them so the idiom head stays clean and pairs render as ex
      const { head, pairs } = splitSensePairs(pieces[0]);
      const headText = head.trim();
      if (headText) blocks.push({ type: 'idiom', text: headText });
      for (const pr of pairs) blocks.push({ type: 'ex', en: crossref(pr.en), vi: crossref(pr.vi) });
    }
    else if (pieces[0]) {
      const { head, pairs } = splitSensePairs(pieces[0]);
      const headText = head.trim();
      if (headText) blocks.push({ type: 'line', text: crossref(headText) });
      for (const pr of pairs) blocks.push({ type: 'ex', en: crossref(pr.en), vi: crossref(pr.vi) });
    }
    for (const p of pieces.slice(1)) {
      const { head, pairs } = splitSensePairs(p);
      const headText = head.trim();
      if (headText) blocks.push({ type: 'sense', text: crossref(headText) });
      for (const pr of pairs) blocks.push({ type: 'ex', en: crossref(pr.en), vi: crossref(pr.vi) });
    }
  }
  for (const b of blocks) {
    if (b.type === 'domain') b.text = b.text.replace(/\s+-\s*$/, '');
  }
  return blocks;
}

/* v104 (review 04/10, P3): an entry that OPENS with a domain group reads as if
 * the specialized meaning were the main one — move a leading domain group to
 * the end (stable; domain groups mid-entry keep their position). */
function demoteLeadingDomain(blocks) {
  if (!blocks.length || blocks[0].type !== 'domain') return blocks;
  let i = 1;
  const group = [blocks[0]];
  while (i < blocks.length && blocks[i].type !== 'domain' && blocks[i].type !== 'pos') group.push(blocks[i++]);
  return [...blocks.slice(i), ...group];
}

/* Raw OVDP fragments are plain marker text; if a fragment sneaks in real HTML
 * we drop the tags first so the marker parser only ever sees text.
 * v109: OVDP writes compound cross-references with underscores ("bully_beef",
 * "(xem) Gordian_knot") — display them with spaces; a trailing "_)" gets its
 * orphan space collapsed. */
function sanitizeRaw(raw) {
  return compactRegisterLabels(String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/_/g, ' ')
    .replace(/ +\)/g, ')')
    .trim());
}

/* ---------- v104 source-data repair layer (review 04/10, P1/P4) ----------
 * The OVDP open-data dump carries a handful of corrupted entries (mojibake,
 * neighbor-headword pollution, broken leading pronunciation fragments) and a
 * dozen objectively wrong POS labels. Per project DNA the .mdx data is never
 * edited — these repairs are applied at BUILD time, to the rendered word
 * pages only. The app keeps serving the raw entry untouched. */

/* Entries whose OVDP content is polluted beyond repair (neighbor blob, like
 * the v99 greet/lust drops): no page at all — the app still serves the raw. */
const REMOVE_WORDS = new Set([
  'fart',  // carries farther's entry wholesale
  'po',    // carries poach's entry wholesale
  'papa',  // whole entry is garbage ("uây (Mỹ) b") — review 04/10
]);

/* Pages that only ever occur as the listed lemma's inflection but whose own
 * OVDP entry duplicates unrelated senses — serve the lemma entry under the
 * standard "showing X" label instead. */
const FORCE_LEMMA = { held: 'hold' };

/* Per-word repairs: [regexSource, replacement, flags] applied to the raw entry
 * text after the leading-fragment guard. Written against the exact corrupted
 * strings of the 04/10 review — keep them anchored so they cannot over-match. */
const OVDP_FIXES = {
  abandon: [['bộm \\(nhiếp ảnh\\) \\(nhiếp ảnh\\) \\(từ Mỹ,nghĩa Mỹ\\) từ bỏ', 'từ bỏ']], // neighbor-pollution head, dup paren (review 04/10)
  ought: [['\\s+\\*\\s+danh từ - nuôi[\\s\\S]*$', '']], // mojibake tail "nuôi ,4æʃ!æɔ5…"
  needs: [['^[\\s\\S]*?\\(tục ngữ\\)', '*  phó từ - (tục ngữ)']], // whole head corrupted, keep the one real sense
  barb: [['\\(nhập từ Bác õi \\(7ʃ\\) ri\\)', '', 'g']], // broken etymology paren, glosses stay
  mama: [['uây khyếm mẹ', 'mẹ']],
  mamma: [['uây khyếm mẹ', 'mẹ']],
  momma: [['uây khyếm mẹ', 'mẹ']],
  mom: [['uây khyếm mẹ', 'mẹ']],
  pin: [['thùng nhỏ \\(41 quoành galông\\)', 'thùng nhỏ (4,5 galông)']], // pin (cask) = 4.5 gallons
  obviously: [
    // wrong POS + two "hopeful" senses polluting the entry
    ['\\* tính từ - một cách rõ ràng; có thể thấy được - hy vọng, đầy hy vọng - đầy hứa hẹn, có triển vọng', '*  phó từ - một cách rõ ràng; có thể thấy được'],
  ],
  at: [['\\*  danh từ - ở tại', '*  giới từ - ở tại']],
  during: [['\\*  danh từ - trải qua', '*  giới từ - trải qua']],
  per: [['\\*  danh từ - mỗi', '*  giới từ - mỗi']],
  them: [['\\*  danh từ - chúng, chúng nó, họ', '*  đại từ - chúng, chúng nó, họ']],
  we: [['\\*  danh từ - chúng tôi, chúng ta', '*  đại từ - chúng tôi, chúng ta']],
  thee: [['\\*  danh từ - \\(thơ ca\\); \\(tôn giáo\\) ngươi', '*  đại từ - (thơ ca); (tôn giáo) ngươi']],
  concentrate: [['\\*  tính từ - tập trung', '*  ngoại động từ - tập trung']],
  confused: [['\\*  danh từ - lẫn lộn, lộn xộn, rối rắm', '*  tính từ - lẫn lộn, lộn xộn, rối rắm']],
  shaped: [['\\*  danh từ - có hình, có hình dạng', '*  tính từ - có hình, có hình dạng']],
  gee: [['- khuấy thán từ - đi nào', '- (thán từ) đi nào']], // "khuấy" is corruption before "thán từ"
  seeing: [['^- liên từ - xét thấy', '*  liên từ - xét thấy']],
  grandma: [['\\s*\\*\\s+danh từ - uây oác\\[\'grænmə,mɑ:\\]', '']], // garbage section; "(thân mật) bà" stays
  care: [['c oào sạch 7ʃ X', 'c/o X']], // corrupted "c/o" expansion
  ton: [[' poào ặn\\[[^\\]\\n]*\\]', '', 'g']], // garbage + neighbor IPA, twice
  mummy: [['\\s*\\*\\s+danh từ - nuây\\[\'mʌmikeis\\]', '']], // garbage section
  scholar: [['ghuôi ỉ\\[\'skɔləli\\]', '']], // garbage fragment
  mum: [['nuây \\(sử học\\)', '(sử học)']], // garbage prefix; the Mumme-beer sense stays
  /* v109 (word-review 06/10) — mojibake/garbage still in OVDP source after v104: */
  absent: [['phãn thân', 'phản thân', 'g']], // ả→ã mojibake in "động từ phản thân"
  busy: [['phãn thân', 'phản thân', 'g']],
  draw: [['phãn thân', 'phản thân', 'g']],
  drawn: [['phãn thân', 'phản thân', 'g']],
  drew: [['phãn thân', 'phản thân', 'g']],
  candy: [['danh từ đường phèn; miếng đường phèn \\(\\(cũng\\) sugar gõn', 'danh từ - đường phèn; miếng đường phèn']], // missing "-" merged the sense into the POS label; "sugar gõn" unrecoverable garbage
  pie: [["printers' gõn", "printers' pie)"]], // "gõn" corrupts "pie)" — printer's pie = đống chữ in lộn xộn
  same: [['\\(the gõn', '(the same)', 'g']], // "the same)" label corrupted, twice (noun + adv)
  ruby: [['cỡ 51 quoành', 'cỡ 5,5'], ['cỡ 31 quoành', 'cỡ 3,5']], // "½"→"1 quoành" mojibake (same family as pin v104)
  open: [['huồm poảy khyếm ', '']], // garbage prefix before "bắt đầu nói (người)"
  g: [[' =g\\+ khoá xon', '']], // self-example junk ("g" exemplifying "g")
  theater: [['thetre', 'theatre']], // OVDP typo, also carried into "(như)" label
  /* v109 batch 2 — English words mojibake'd with VN diacritics + labels/slugs
   * that leaked into the "=example" slot (word-review 06/10, ex-en sweep): */
  sir: [['Sir Walter Scolt', 'Sir Walter Scott']],
  rat: [['=lóng rats!\\+ chuyện vô lý! chuyện lếu láo, chuyện tầm bậy!', '=rats+ chuyện vô lý, chuyện lếu láo, chuyện tầm bậy']], // "(từ lóng) Rats!" — drop the "!"s so the marker parser does not split fake idiom blocks (547-block class, parser-level fix = next release)
  narrow: [['strêt', 'street']],
  nasty: [['a nasty bôk', 'a nasty book']],
  blade: [['ơolly', 'jolly']],
  attraction: [['cạpillary', 'capillary']],
  buck: [['to fêl greatly', 'to feel greatly']],
  drum: [['pianô', 'piano', 'g']],
  devil: [['to ráie the devil', 'to raise the devil']],
  fold: [["one's ám", "one's arms"]],
  getaway: [["one's ơn", "one's own"]], // "to get back one's own" (trả được thù)
  go: [['as for as 100 đ', 'as far as 100 đ']],
  roll: [['on the grá', 'on the grass']],
  touch: [['do the báll touch\\?', 'do the balls touch?']],
  /* labels abbreviated inside the "=example" slot by OVDP — move into the vi part */
  mount: [['=quân to mount guard\\+', '=to mount guard+ (quân sự) '], ['=mỹ to mount an attack\\+', '=to mount an attack+ (Mỹ) ']],
  serpent: [['=thiên the Serpent\\+', '=the Serpent+ (thiên văn) ']],
  work: [["=hải to work one's passage\\+", "=to work one's passage+ (hải quân) "]],
  /* "=EN VI+" / inverted pairs OVDP mangles — re-pair at source */
  bearing: [['=to be past bearing quá thời kỳ sinh nở\\+ thái độ, dáng điệu, bộ dạng, tác phong', '=to be past bearing+ quá thời kỳ sinh nở - thái độ, dáng điệu, bộ dạng, tác phong']],
  hump: [["=to hump one's gù lưng xuống\\+ làm chán nản, làm chán chường; làm buồn phiền", "=to hump one's back+ gù lưng xuống - làm chán nản, làm chán chường; làm buồn phiền"]],
  /* v110 — "!X!+vi" idioms with pair-style vi: drop ONE "!" so the false-split
   * merge re-glues the whole "=EN+VI" pair (word-review 06/10, last 7 leaks) */
  ready: [['=ready! go!\\+', '=ready go!+']],
  good: [['=good! good!\\+', '=good, good!+']],
  help: [['=help! help!\\+', '=help help!+']],
  mister: [['=here! mister', '=here mister']],
  get: [['=ah! I', "=ah I"]],
  got: [['=ah! I', "=ah I"]], // got/gotten render get's entry via lemma fallback — same raw
  /* v110 — idiom sections with cross-variant glue (last 3 fake-idiom blocks) */
  pick: [['!to pick on !mỹ, nh to pick at', '!to pick on (Mỹ), (như) to pick at']],
  rag: [[' !x Ảchew', '']], // unrecoverable cross-ref fragment after "to chew the rag"
  sort: [['!a poet of a sort !\\(thông tục\\) a poet of sorts', '!a poet of a sort - (thông tục) a poet of sorts']],
  gotten: [['=ah! I', "=ah I"]],
  introduce: [['=ddưa vào \\(phong tục, cây lạ...\\)\\+ đưa \\(đạo luật dự thảo\\) ra nghị viện', '- đưa vào (phong tục, cây lạ...) - đưa (đạo luật dự thảo) ra nghị viện']],
};
function applyOvdpFixes(word, raw) {
  const fixes = OVDP_FIXES[word];
  if (!fixes) return raw;
  let t = raw;
  for (const [src, rep, flags] of fixes) t = t.replace(new RegExp(src, flags ?? ''), rep);
  return t;
}

/* Some entries start with a broken pronunciation fragment ("- ɔ:'gʌst/",
 * "-morrow) /tə'mɔrou/") left over from OVDP compound splitting — drop it. */
function dropLeadingIpaFragment(text) {
  const m = text.match(/^\s*-\s*([^*!@\n]{1,80})/);
  if (m && m[1].includes('/') && m[1].trimEnd().endsWith('/')) {
    return text.slice(m[0].length).replace(/^\s+/, '');
  }
  return text;
}

function renderEntry(raw, word) {
  const text = sanitizeRaw(raw);
  const blocks = applySensePriority(word, demoteLeadingDomain(mtdToBlocksRender(text)));
  if (!blocks.length) return '';
  // sense/line/ex texts are already escaped + crossref-linked by mtdToBlocks
  return blocks
    .map((b) => {
      if (b.type === 'pos') return `<div class="mtd-pos">${escapeHtml(b.text)}</div>`;
      if (b.type === 'domain') return `<div class="mtd-domain">${escapeHtml(b.text)}</div>`;
      if (b.type === 'idiom') return `<div class="mtd-idiom"><b>${escapeHtml(b.text)}</b></div>`;
      if (b.type === 'ex') {
        return `<div class="mtd-ex"><span class="mtd-ex-en">${b.en}</span>${b.vi ? ` — <span class="mtd-ex-vi">${b.vi}</span>` : ''}</div>`;
      }
      if (b.type === 'sense') return `<div class="mtd-sense">${b.text}</div>`;
      return `<div class="mtd-line">${b.text}</div>`;
    })
    .join('\n');
}

/* ---------- P0 sense priority (owner-approved 01/11/2026) ----------
 * data/sense-priority.json maps a headword to Vietnamese keywords whose
 * matching sense is the EXAM meaning (e.g. evidence -> bang chung). The
 * matching line/sense block (+ its trailing ex blocks) moves to the front of
 * the FIRST pos group at RENDER time. Source .mdx is never edited and the
 * admission gates keep legacy semantics, so the page set cannot shift.
 * Only words listed in the JSON are touched; everything else renders byte-
 * identical. Reorders are logged to docs/wordpages-qa.json (qa.sensePriority).
 */
/* P1 exam tags loader (shared by word + phrase builders via core export). */
let EXAM_TAGS = null;
function examTags() {
  if (EXAM_TAGS === null) {
    try { EXAM_TAGS = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'exam-tags.json'), 'utf8')); }
    catch (e) { EXAM_TAGS = { words: {}, phrases: {} }; }
  }
  return EXAM_TAGS;
}
function examTagsFor(word, slug) {
  const t = examTags();
  if (word && t.words && t.words[String(word).toLowerCase()]) return t.words[String(word).toLowerCase()];
  if (slug && t.phrases && t.phrases[slug]) return t.phrases[slug];
  return null;
}
let SENSE_PRIORITY = null;
function sensePriorityFor(word) {
  if (SENSE_PRIORITY === null) {
    try { SENSE_PRIORITY = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'sense-priority.json'), 'utf8')); }
    catch (e) { SENSE_PRIORITY = {}; }
  }
  const kws = SENSE_PRIORITY[String(word || '').toLowerCase()];
  return Array.isArray(kws) && kws.length ? kws : null;
}
function decodeEnt(s) {
  return String(s || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
function plainText(s) {
  return decodeEnt(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function applySensePriority(word, blocks) {
  const kws = sensePriorityFor(word);
  if (!kws || !blocks.length) return blocks;
  const firstPos = blocks.findIndex((b) => b.type === 'pos');
  if (firstPos === -1) return blocks;
  let end = blocks.length;
  for (let i = firstPos + 1; i < blocks.length; i++) {
    if (blocks[i].type === 'pos') { end = i; break; }
  }
  const norm = (s) => plainText(s).toLowerCase();
  const keys = kws.map((k) => String(k).toLowerCase());
  // units: a line/sense head + its trailing ex blocks; domain blocks stay put
  const units = [];
  let cur = null;
  for (let i = firstPos + 1; i < end; i++) {
    const b = blocks[i];
    if (b.type === 'ex' && cur) { cur.blocks.push(b); continue; }
    if (b.type === 'line' || b.type === 'sense') {
      cur = { head: b, blocks: [b], match: keys.some((k) => norm(b.text).includes(k)) };
      units.push(cur);
      continue;
    }
    cur = null; // domain / idiom / pos-adjacent: fixed position
    units.push({ head: b, blocks: [b], match: false, fixed: true });
  }
  if (!units.some((u) => u.match)) return blocks;
  const moved = units.filter((u) => u.match).flatMap((u) => u.blocks);
  const rest = units.filter((u) => !u.match).flatMap((u) => u.blocks);
  if (!moved.length || !rest.length) return blocks;
  // no-op guard: first content unit already matches
  const firstUnit = units.find((u) => !u.fixed);
  if (firstUnit && firstUnit.match) return blocks;
  return [...blocks.slice(0, firstPos + 1), ...moved, ...rest, ...blocks.slice(end)];
}
/* First rendered sense head AFTER priority reorder - feeds the unique meta
 * description (P0 SEO). Falls back to '' so callers use the generic template. */
function firstSenseOf(word, raw) {
  try {
    const blocks = applySensePriority(word, demoteLeadingDomain(mtdToBlocksRender(sanitizeRaw(raw))));
    const b = blocks.find((x) => x.type === 'line' || x.type === 'sense');
    if (!b) return '';
    return plainText(b.text).split('=')[0].trim();
  } catch (e) { return ''; }
}
function wordMetaDesc(word, ipa, raw) {
  const head = `${word}${ipa ? ` /${ipa}/` : ''}`;
  const s = firstSenseOf(word, raw);
  if (s) {
    const short = s.length > 140 ? s.slice(0, 140).replace(/\s+\S*$/, '') + '...' : s;
    return `${head} nghĩa là: ${short} — Loại từ, ví dụ và ghi chú sử dụng chi tiết — tra offline miễn phí trong app Dual Dictionary.`;
  }
  return `${head} nghĩa tiếng Việt là gì? Loại từ, nghĩa và ví dụ chi tiết của "${word}" — tra cứu offline miễn phí trong app Dual Dictionary.`;
}

function wordPageUrl(word) {
  return `/vi/tu/${encodeURIComponent(String(word).toLowerCase())}/`;
}

function slugOf(word) {
  return String(word).toLowerCase();
}

/* VI-P1 internal linking (15/10/2026): phrase pages built by
 * tools/build-phrase-pages.cjs live in the same vi/tu folder. The word builder
 * reads their manifest (docs/phrasepages-manifest.json) and chips up to 6
 * same-first-token phrases onto every word page + links the phrase hub from
 * the word hub. Missing manifest = no chips, build still succeeds. */
const PHRASE_MANIFEST_PATH = path.join(REPO, 'docs', 'phrasepages-manifest.json');
const PHRASE_HUB_URL = '/vi/tu/cum-tu/';
function loadPhraseIndex() {
  const byFirst = new Map();
  const byTerm = new Map();
  const phrases = [];
  let handCount = 0;
  let m = null;
  try { m = JSON.parse(fs.readFileSync(PHRASE_MANIFEST_PATH, 'utf8')); } catch (e) { m = null; }
  const entries = m && Array.isArray(m.entries) && m.entries.length
    ? m.entries
    : (m && Array.isArray(m.slugs) ? m.slugs.map((s) => ({ slug: s, phrase: String(s).replace(/-/g, ' '), hand: false })) : []);
  for (const e of entries) {
    phrases.push(e);
    if (e.hand) handCount++;
    const first = String(e.phrase).toLowerCase().split(/\s+/)[0].replace(/[^a-z'’-]/g, '');
    if (!first) continue;
    if (!byFirst.has(first)) byFirst.set(first, []);
    byFirst.get(first).push(e);
    // VI-LINKS (16/10/2026, owner-approved): also index EVERY token so word
    // pages chip phrases containing the word anywhere ("ballot" chips
    // "absentee ballot"), not just as the first token — boosts inbound links
    // across the phrase graph (GSC crawl-priority lever).
    for (const tok of new Set(String(e.phrase).toLowerCase().split(/\s+/)
        .map((t) => t.replace(/[^a-z'’-]/g, '')).filter((t) => t.length > 1))) {
      if (!byTerm.has(tok)) byTerm.set(tok, []);
      byTerm.get(tok).push(e);
    }
  }
  return { byFirst, byTerm, phrases, handCount };
}


/* Related words: same headword family (prefix^4 or suffix match), max 6,
 * sorted by frequency band then alphabetically. Junk filter: min 3 chars,
 * must contain a vowel, no lone letters or fragments. */
function relatedWords(word, allKeys, freqMap) {
  const w = word.toLowerCase();
  const band = (k) => {
    const b = freqMap[k];
    if (!b) return 99;
    return parseInt(b, 10) || 99;
  };
  const isReal = (k) =>
    k.length >= 3 && /[aeiouy]/.test(k) && /^[a-z][a-z'-]*[a-z]$/.test(k) && k !== w;
  const cands = [];
  for (const k of allKeys) {
    if (!isReal(k)) continue;
    if (k.startsWith(w) || w.startsWith(k) || k.endsWith(w)) {
      if (Math.abs(k.length - w.length) <= 6) cands.push(k);
    }
    if (cands.length > 40) break;
  }
  cands.sort((a, b) => band(a) - band(b) || a.localeCompare(b));
  return cands.slice(0, 6);
}

/* ---------- page template ---------- */

/* P1 badge row: frequency band + learning-group chips. Frequency bands
 * (OpenSubtitles) and learning membership (NGSL) are labeled DISTINCTLY —
 * never merged into one "top 2000" claim. */
function badgeRowHtml(word, labels, builtSet) {
  const chips = [];
  // v100: tooltip explains what "top Nk" means and where it comes from
  // (review 03/10: frequency bands need their corpus + purpose stated).
  if (labels.band) chips.push(`<span class="chip chip-band" title="Từ nằm trong ${escapeHtml(labels.band.replace('k', 'K'))} từ xuất hiện nhiều nhất trong corpus phụ đề phim OpenSubtitles — nhãn tần suất, KHÔNG phải khung học. Khung học xem chip NGSL/AWL bên cạnh.">Tần suất: top ${escapeHtml(labels.band.replace('k', 'K'))}</span>`);
  if (labels.group === 'core') {
    const coreTip = 'Thứ hạng của từ trong danh sách NGSL (New General Service List, Browne & Culligan) — số càng nhỏ càng phổ biến.';
    if (labels.ngslRank) chips.push(`<span class="chip chip-core" title="${coreTip}">Học chính (NGSL #${labels.ngslRank})</span>`);
    else chips.push(`<span class="chip chip-core" title="${coreTip}">Học chính (NGSL bổ sung)</span>`);
  } else if (labels.group === 'inflection') {
    const lemmaHref = builtSet && builtSet.has(labels.lemma) ? wordPageUrl(labels.lemma) : '';
    chips.push(`<span class="chip chip-infl">Dạng chia của ${lemmaHref ? `<a href="${lemmaHref}">“${escapeHtml(labels.lemma)}”</a>` : `“${escapeHtml(labels.lemma || '?')}”`}</span>`);
  } else if (labels.group === 'off-list') {
    chips.push('<span class="chip chip-off">Ngoài danh sách học chính</span>');
  } else if (labels.group === 'vulgar') {
    chips.push('<span class="chip chip-vulgar">Từ tục / tiếng lóng — cẩn trọng ngữ cảnh</span>');
  }
  if (labels.awl) chips.push(`<span class="chip chip-awl" title="Từ thuộc Academic Word List (Coxhead, 570 họ từ chia 10 sublist theo tần suất trong văn học thuật) — sublist càng nhỏ càng gặp trong bài đọc học thuật.">Học thuật (AWL Sublist ${escapeHtml(String(labels.awl))})</span>`);
  else if (labels.group === 'academic') chips.push('<span class="chip chip-awl" title="Từ thuộc Academic Word List (Coxhead).">Học thuật (AWL)</span>');
  if (labels.learning === 'active') chips.push('<span class="chip chip-learn">Nên chủ động sử dụng</span>');
  else if (labels.learning === 'recognition') chips.push('<span class="chip chip-learn2">Nên nhận biết</span>');
  /* P1 exam tags (owner-approved 01/11/2026): derived in-repo (NGSL/AWL/freq),
   * CEFR is an estimate — tooltip says so, never asserted as official. */
  const exam = examTagsFor(word, null);
  if (exam) {
    if (exam.tags.includes('ielts')) chips.push('<span class="chip chip-exam" title="Từ lõi cho IELTS (thuộc AWL hoặc NGSL top 2000)">IELTS Core</span>');
    if (exam.tags.includes('giao-tiep')) chips.push('<span class="chip chip-exam2" title="Từ giao tiếp nền (NGSL top 1000, tần suất cao)">Giao tiếp</span>');
    if (exam.cefr) chips.push(`<span class="chip chip-cefr" title="Trình độ ước tính suy từ NGSL/AWL/tần suất — tham khảo, không phải chứng nhận chính thức">~${exam.cefr}</span>`);
  }
  return chips.length ? `<div class="word-badges">${chips.join(' ')}</div>` : '';
}

/* v114 practice CTA: which ?deck= deep-link a word page points to. MUST stay a
 * mirror of the app's deckWords() membership (js/app.js, built-words rows
 * [word, band, ngslRank, awlSublist]) so a "Luyện bộ từ này" tap always lands
 * on a session that really contains this word. Inflected forms follow their
 * lemma's deck (ran → run → NGSL 1k); words in no curriculum deck (mostly
 * proper nouns / interjections — bob, adam, ah…) return null and the page
 * keeps only the plain ?q= CTA. */
const awlSubOf = (a) => Number((a && typeof a === 'object' ? (a.sublist ?? a.sub ?? 0) : a) || 0);
function deckOfRow(rank, sub, band) {
  if (awlSubOf(sub) > 0) return 'awl';
  const r = rank || 0;
  if (r >= 1 && r <= 1000) return 'ngsl1';
  if (r >= 1001 && r <= 2000) return 'ngsl2';
  if (r >= 2001) return 'ngsl3';
  if (band === '5k' || band === '10k') return 'offngsl';
  return null;
}
function practiceDeckFor(word, labels, ngsl, awl, freq) {
  const own = deckOfRow(labels.ngslRank, labels.awl, labels.band);
  if (own) return own;
  const lemma = labels.lemma;
  if (lemma && lemma !== word) {
    return deckOfRow(ngsl.core[lemma] || 0, awl.words[lemma] || null, String(freq[lemma] || ''));
  }
  return null;
}

const { breOf } = require('./bre-ipa.cjs');
/* P1 BrE + audio (owner-approved 01/11/2026): BrE derived ONLY for safe
 * patterns (tools/bre-ipa.cjs) — uncertain words show AmE only. Audio: no
 * bundled TTS (bandwidth + voice rights) — deep-link into the offline app
 * which already plays audio from the user's own loaded dictionaries. */
/* P1 exam examples loader (hand-written seed, never bulk-generated). */
let EXAM_EXAMPLES = null;
function examExamples() {
  if (EXAM_EXAMPLES === null) {
    try { EXAM_EXAMPLES = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'exam-examples.json'), 'utf8')); }
    catch (e) { EXAM_EXAMPLES = { words: {}, phrases: {} }; }
  }
  return EXAM_EXAMPLES;
}
function examExamplesHtml(word, slug) {
  const db = examExamples();
  const list = (word && db.words && db.words[String(word).toLowerCase()])
    || (slug && db.phrases && db.phrases[slug])
    || null;
  if (!list || !list.length) return '';
  const rows = list.map(([en, vi, src]) =>
    `<div class="mtd-ex"><span class="mtd-ex-en exam-en">${escapeHtml(en)}</span> — <span class="mtd-ex-vi">${escapeHtml(vi)}</span>${src ? ` <span class="exam-src">(${escapeHtml(src)})</span>` : ''}</div>`).join('\n');
  return `<section class="word-note exam-note"><h2>Ví dụ thi</h2><p class="exam-sub">Câu mẫu viết tay theo văn IELTS / TOEIC — dùng lại được trong bài thi.</p>\n${rows}</section>`;
}
function ipaLineHtml(word, ipa) {
  if (!ipa) return '';
  const bre = breOf(ipa, word);
  const brePart = bre && bre !== ipa
    ? ` <span class="ipa-bre" title="Phiên âm Anh-Anh (suy từ quy tắc chắc ăn; từ không chắc chỉ hiện Mỹ)">BrE /${escapeHtml(bre)}/</span>`
    : '';
  return `<p class="word-ipa"><span class="ipa-label">Phiên âm</span> <span class="ipa-ame" title="Phiên âm Anh-Mỹ">Mỹ /${escapeHtml(ipa)}/</span>${brePart} <a class="ipa-hear" href="/?q=${encodeURIComponent(word)}" title="Nghe phát âm trong app offline">🔊 Nghe</a></p>`;
}
function pageHtml({ word, ipa, entryLemma, entryHtml, related, phrases, posList, noteHtml, noteIsHand, labels, builtSet, practiceDeck, canonicalOverride, raw }) {
  /* P1 deck CTA (owner-approved 01/11): word pages point at the matching exam
   * deck (?deck=ielts / ?deck=toeic) instead of the NGSL band deck. */
  const exam = examTagsFor(word, null);
  const bizHead = /^(account|bank|balance|invoice|payment|budget|finance|marketing|sales|contract|meeting|office|shipping|delivery|order|customer|client|employee|manager|payroll|revenue|profit|audit|tax|loan|credit|stock|share|board|quarter|expense|claim|warranty|supplier|retail|import|export|freight|cargo|warehouse|inventory|deadline|overtime|salary|conference|proposal|dividend|interest|mortgage|insurance|premium|booking|memo|agenda)$/.test(String(word).toLowerCase());
  const examDeck = bizHead ? 'toeic' : exam && exam.tags.includes('ielts') ? 'ielts' : null;
  const practiceCta = (examDeck || practiceDeck)
    ? `\n        <a class="word-cta-btn word-cta-btn-practice" href="/?deck=${examDeck || practiceDeck}">${examDeck === 'toeic' ? '💼' : '🎯'} Luyện ${examDeck === 'toeic' ? 'TOEIC Business' : examDeck === 'ielts' ? 'IELTS Core' : 'bộ từ này'} trong app ↗</a>`
    : '';
  const title = `${word} nghĩa là gì? — Phiên âm & nghĩa tiếng Việt | Dual Dictionary`;
  /* P0 SEO: unique meta per page — first rendered sense (post-priority) + IPA.
   * raw is passed from the build loop; direct renderEntry() callers without
   * raw keep the old generic template via the '' fallback in wordMetaDesc. */
  const desc = wordMetaDesc(word, ipa, raw || '');
  const canonical = canonicalOverride || `${SITE}${wordPageUrl(word)}`;
  const relatedHtml = related.length
    ? `<section class="related"><h2>Từ liên quan</h2><div class="related-list">${related
        .map((r) => `<a class="related-chip" href="${wordPageUrl(r)}">${escapeHtml(r)}</a>`)
        .join('')}</div></section>`
    : '';

  const phraseHtml = (phrases && phrases.length)
    ? `<section class="related"><h2>Cụm từ liên quan</h2><div class="related-list">${phrases
        .map((e) => `<a class="related-chip" href="/vi/tu/${encodeURIComponent(e.slug)}/">${escapeHtml(e.phrase)}</a>`)
        .join('')}</div></section>`
    : '';
  /* P1 schema-rich (owner-approved 01/11): subject tags + first exam example
   * as schema example. about[] points at the tag collection pages (built in
   * the same run below); example[] carries 1 hand-written exam sentence. */
  const examTag = examTagsFor(word, null);
  const examAbout = [];
  if (examTag && examTag.tags.includes('ielts')) examAbout.push({ '@type': 'Thing', name: 'IELTS Core', url: `${SITE}/vi/tu/ielts/` });
  if (examTag && examTag.tags.includes('giao-tiep')) examAbout.push({ '@type': 'Thing', name: 'Giao tiếp', url: `${SITE}/vi/tu/giao-tiep/` });
  let examExample = null;
  try {
    const db = examExamples();
    const list = db.words && db.words[String(word).toLowerCase()];
    if (list && list.length && list[0][0]) examExample = list[0][0];
  } catch (e) { /* no example */ }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        name: word,
        alternateName: posList.length ? `${word} (${posList.join(', ')})` : undefined,
        description: desc,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: 'Từ điển Anh-Việt Dual Dictionary',
          url: `${SITE}/vi/`,
        },
        url: canonical,
        termCode: word,
        ...(examAbout.length ? { about: examAbout } : {}),
        ...(examExample ? { example: examExample } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Từ điển', item: `${SITE}/vi/tu/` },
          { '@type': 'ListItem', position: 3, name: word, item: canonical },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
<nav class="breadcrumb" aria-label="Breadcrumb">
  <a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">${escapeHtml(word)}</span>
</nav>

<main class="page">
  <header class="word-head">
    <p class="word-kicker">Nghĩa tiếng Việt của</p>
    <h1>${escapeHtml(word)}</h1>
    ${ipaLineHtml(word, ipa)}
    ${badgeRowHtml(word, labels, builtSet)}${entryLemma ? `
    <p class="entry-lemma-note">Trong từ điển không có mục riêng cho dạng “${escapeHtml(word)}” — mục dưới đây là của nguyên mẫu ${builtSet.has(entryLemma)
      ? `<a href="${wordPageUrl(entryLemma)}">“${escapeHtml(entryLemma)}”</a>`
      : `<a href="/?q=${encodeURIComponent(entryLemma)}">“${escapeHtml(entryLemma)}”</a>`} (như trong app: tra dạng chia, hiện mục gốc).</p>` : ''}
    <div class="entry-body">${entryHtml || '<p class="word-empty">Chưa có dữ liệu nghĩa chi tiết cho từ này trong bản từ điển hiện tại.</p>'}</div>
    <div class="word-cta">
      <div class="word-cta-actions">
        <a class="word-cta-btn" href="/?q=${encodeURIComponent(word)}">Tra "${escapeHtml(word)}" trong app offline ↗</a>${practiceCta}
      </div>
      <p class="word-cta-note">App Dual Dictionary: từ điển Anh-Việt offline, không cần mạng, không tài khoản.</p>
      <p class="word-report"><a href="mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(`Lỗi mục từ "${word}" — Dual Dictionary`)}">Phát hiện lỗi (phiên âm, nghĩa, ví dụ)? Báo qua email — mình sửa trong bản tới.</a></p>
    </div>
  </header>

  ${noteHtml ? `<section class="word-note"><h2>Ghi chú sử dụng</h2>${noteIsHand ? '' : '<span class="note-badge note-badge-auto">Tự sinh — chưa biên tập</span>'}${noteHtml}</section>` : ''}

  ${examExamplesHtml(word, null)}

  ${relatedHtml}

  ${phraseHtml}
</main>

<footer class="blog-footer">
  <p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p>
</footer>
</body>
</html>
`;
}

/* ---------- main ---------- */

async function main() {
  const mdxPath = path.join(REPO, 'dicts-en-vi', 'star_anhviet.mdx');
  const ipa = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'ipa-en.json'), 'utf8'));
  const freq = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'freq-en.json'), 'utf8'));
  const ngsl = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'ngsl.json'), 'utf8'));
  // v95: batch 2 — Academic Word List supplement (Coxhead 570 families). See
  // data/awl.json for attribution; NOTICE.md carries the licence note.
  const awl = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'awl.json'), 'utf8'));
  const awlSet = new Set(Object.keys(awl.words));

  const buf = fs.readFileSync(mdxPath);
  const dict = new MDict(new Blob([buf]), 'star_anhviet.mdx');
  await dict.init();
  const allKeys = (await dict.loadAllKeys()).map(String);
  const allKeysSet = new Set(allKeys);
  // VI-P0 (15/10/2026): admission used to match OVDP keys EXACTLY, so freq
  // words whose dictionary key differs only in case/punctuation ("T-shirt",
  // "O'clock"...) were wrongly excluded (~470 pages missing). lookup() itself
  // resolves keys through normKey (lowercase, punctuation stripped per
  // StripKey/KeyCase defaults), so admission now falls back to the same
  // normalization. Exact match stays FIRST: nothing changes for the live
  // pages, the norm path only ADDS previously-excluded words.
  const keyNormSet = new Set(allKeys.map((k) => dict.normKey(k)));
  const dictHasKey = (w) => allKeysSet.has(w) || keyNormSet.has(dict.normKey(w));

  // Batch 1: words present in BOTH the frequency top-list and the dictionary,
  // sorted by frequency band (1k first), then alphabetically. v96: band-based
  // cap (was 5k); v99: full 10k — owner-approved per docs/plan-band10k.md
  // (~2,568 new pages after the band-10k quality gates below). Keep this
  // default in sync with what is actually deployed: a rebuild with a smaller
  // band cap DELETES the out-of-cap pages (the build wipes vi/tu first).
  const BAND_ORDER = { '1k': 1, '2k': 2, '5k': 3, '10k': 4 };
  const maxOrder = BAND_ORDER[process.env.WORD_MAXBAND || '10k'] || 4;
  const LIMIT = parseInt(process.env.WORD_LIMIT || '99999', 10);
  const candidates = Object.keys(freq)
    .filter((w) => /^[a-z][a-z'’-]{0,24}$/.test(w))
    .filter(dictHasKey)
    .filter((w) => (BAND_ORDER[freq[w]] || 9) <= maxOrder)
    .sort((a, b) => {
      const oa = BAND_ORDER[freq[a]] || 9;
      const ob = BAND_ORDER[freq[b]] || 9;
      return oa - ob || a.localeCompare(b);
    })
    .slice(0, LIMIT);

  // v95 batch 2: AWL headwords the frequency list does not already cover.
  // Same admission rules as batch 1 (regex + must exist in the dictionary);
  // batch-1 words that are also AWL keep their existing page and just gain
  // the AWL chip below — no duplicate pages.
  const awlNew = Object.keys(awl.words)
    .filter((w) => /^[a-z][a-z'’-]{0,24}$/.test(w))
    .filter((w) => !candidates.includes(w))
    .sort((a, b) => a.localeCompare(b));
  // AWL forms with no dictionary key of their own (identified, strategies…) stay
  // in the list: the build loop falls back to the lemma entry and labels it.
  const candidatesAll = candidates.concat(awlNew);

  console.log(`Batch 1: ${candidates.length} frequent words + batch 2 (AWL): ${awlNew.length} new pages ` +
    `(${awl.words && Object.keys(awl.words).length - awlNew.length} AWL words already built or not dictionary keys)`);
  // v96 (owner order: REMOVE, don't ship): two-pass admission. Pass A decides
  // who gets a page at all — vulgar-group words and entries that render no
  // content are dropped BEFORE anything is written: no page, no hub row, no
  // sitemap URL; crossrefs to them fall back to /?q= via the v89 contract.
  // Form words the dictionary does not key separately (identified, strategies…)
  // AND keyed irregular crossref stubs that render nothing (did, got, led) are
  // rescued by the lemma's entry — the same "showing X" contract since v61.
  // NOTE: admission counting uses the LEGACY block semantics (sense/line/idiom
  // with example pairs still inline) — identical to the live v99 gate. The
  // v104 mtd-ex render lines must NOT influence who gets a page (04/10 lesson:
  // counting them shifted the admitted set by ~30 words).
  const entryHasContent = (txt) =>
    mtdToBlocks(sanitizeRaw(txt)).some((b) => b.type === 'sense' || b.type === 'line' || b.type === 'idiom');
  const contentBlocks = (txt) =>
    mtdToBlocks(sanitizeRaw(txt)).filter((b) => b.type === 'sense' || b.type === 'line' || b.type === 'idiom').length;

  /* VI-FIXA (16/10/2026, owner-approved): dict.lookup() can return MULTIPLE
   * entries for one headword — the main dictionary key ("access", 33 senses)
   * plus capitalised term-bank entries ("Access", one Econ gloss) that sort
   * first. Taking r[0] rendered the term-bank gloss and hid the real entry
   * (158 pages, e.g. function −332 blocks — live since first deploy).
   * Pick the result with the most content blocks; ties prefer the key that
   * equals the headword exactly (case-sensitive). */
  const lookupBestEntry = async (dict, w) => {
    let r;
    try { r = await dict.lookup(w); } catch (e) { return ''; }
    if (!Array.isArray(r) || r.length === 0) return '';
    if (r.length === 1) return r[0] && r[0].text ? r[0].text : '';
    const scored = r.map((x) => ({
      text: x && x.text ? x.text : '',
      rich: (() => { try { return contentBlocks(x.text || ''); } catch (e) { return 0; } })(),
      exact: x && x.keyText === w ? 1 : 0,
    }));
    scored.sort((a, b) => b.rich - a.rich || b.exact - a.exact);
    return scored[0].text;
  };
  /* defsKey: order-insensitive fingerprint of an entry's rendered definitions.
   * Equality with the lemma's entry marks a mirror page (VI-CANNI). */
  const defsKey = (txt) => {
    try {
      return mtdToBlocks(sanitizeRaw(txt))
        .filter((b) => b.type === 'sense' || b.type === 'line' || b.type === 'idiom')
        .map((b) => String(b.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .sort()
        .join('¦');
    } catch (e) { return ''; }
  };
  const removedVulgar = [];
  const removedEmpty = [];
  const removedCorrupt = []; // v104: OVDP entries corrupted beyond repair (fart, po)
  // v99 band-10k gates (docs/plan-band10k.md, owner-approved) — apply ONLY to
  // freq==='10k' words; the already-live bands ≤5k keep the v96 policy as-is.
  const removedAbbrev = [];
  const removedFat = [];
  const removedThin = [];
  const prep = new Map(); // word -> { raw, rawLemma, lbl } (insertion order kept)
  for (const word of candidatesAll) {
    const lbl = wordGroup(word, { allKeys: allKeysSet, ngsl, awl: awlSet });
    if (lbl.group === 'vulgar') { removedVulgar.push(word); continue; }
    // v104: corrupted-beyond-repair entries → no page (same policy as the v99
    // fat-blob drops); crossrefs to them fall back to /?q= via BUILT
    if (REMOVE_WORDS.has(word)) { removedCorrupt.push(word); continue; }
    let raw = '';
    let rawLemma = null;
    if (FORCE_LEMMA[word]) {
      try {
        const t0 = await lookupBestEntry(dict, FORCE_LEMMA[word]);
        if (t0) { raw = t0; rawLemma = FORCE_LEMMA[word]; }
      } catch (e) { /* leave raw empty */ }
    } else {
      try {
        const t0 = await lookupBestEntry(dict, word);
        if (t0) raw = t0;
      } catch (e) { /* leave raw empty */ }
    }
    // v104 repair layer runs AFTER the lemma fallback so the actually-rendered
    // entry (own or lemma's) is always the patched text
    if (!raw.trim() || !entryHasContent(raw)) {
      // resolver candidates FIRST — they carry the irregular lemma (did→do, is→be);
      // lemmaStems (mechanical stripping) can hit junk OVDP keys like "di" first
      const stems = [...new Set([...lemmaCandidates(word), ...lemmaStems(word)])];
      for (const stem of stems) {
        if (stem === word) continue;
        try {
          const t2 = await lookupBestEntry(dict, stem);
          if (t2 && entryHasContent(t2)) { raw = t2; rawLemma = stem; break; }
        } catch (e) { /* next stem */ }
      }
    }
    if (!raw.trim() || !entryHasContent(raw)) { removedEmpty.push(word); continue; }
    if (freq[word] === '10k') {
      // OVDP blob anomaly (greet 45 KB of unrelated sections, lust 46 KB…) —
      // the headword's real content is a fraction of the entry; drop, the app
      // still serves the raw entry for whoever needs it.
      if (raw.length > 15000) { removedFat.push(word); continue; }
      // "(viết tắt)" junk lookups (ai, asap, dc…) — no learning or SEO value
      if (ABBREV_RE.test(sanitizeRaw(raw))) { removedAbbrev.push(word); continue; }
      // anti thin-content: off-list words outside the learning frame need a
      // real entry (≥2 content blocks); NGSL/academic words are exempt —
      // learning value outranks entry length (email/finance/asset…)
      if (lbl.group === 'off-list' && contentBlocks(raw) < 2) { removedThin.push(word); continue; }
      // thin inflection stub → prefer the lemma's entry under the labeled
      // "showing X" contract (v61/v96) instead of a one-line page
      if (lbl.group === 'inflection' && contentBlocks(raw) < 2 && !rawLemma) {
        const stems = [...new Set([lbl.lemma, ...lemmaCandidates(word), ...lemmaStems(word)].filter(Boolean))];
        for (const stem of stems) {
          if (stem === word) continue;
          try {
            const t2 = await lookupBestEntry(dict, stem);
            if (t2 && entryHasContent(t2)) { raw = t2; rawLemma = stem; break; }
          } catch (e) { /* next stem */ }
        }
      }
    }
    // v104 repair layer — RENDERING ONLY, after every admission gate (gates
    // count the unpatched raw so the admitted set stays identical to live;
    // 04/10 lesson: patching before the thin gate dropped 2 extra pages)
    raw = dropLeadingIpaFragment(applyOvdpFixes(word, raw));
    if (!raw.trim() || !entryHasContent(raw)) { removedEmpty.push(word); continue; }
    prep.set(word, { raw, rawLemma, lbl });
  }
  console.log(`Admitted ${prep.size}/${candidatesAll.length} words — removed ` +
    `${removedVulgar.length} vulgar (${removedVulgar.slice(0, 6).join(', ')}${removedVulgar.length > 6 ? '…' : ''}) + ` +
    `${removedEmpty.length} contentless (${removedEmpty.slice(0, 6).join(', ')}${removedEmpty.length > 6 ? '…' : ''}) + ` +
    `${removedFat.length} fat-blob (band-10k: ${removedFat.join(', ') || '—'}) + ` +
    `${removedAbbrev.length} abbrev + ${removedThin.length} thin off-list + ` +
    `${removedCorrupt.length} corrupt-entry (v104: ${removedCorrupt.join(', ') || '—'})`);

  BUILT = new Set(prep.keys()); // crossrefs leave the set via /?q= instead of dead links

  /* VI-P0 (15/10/2026): manifest-based ownership replaces the blanket wipe.
   * The upcoming phrase-page builder writes DIFFERENT dirs into the same
   * vi/tu folder; a blanket rmSync would delete them on every word rebuild.
   * Contract: this build owns exactly the dirs listed in
   * docs/wordpages-manifest.json — owned dirs that fall out of the admitted
   * set are removed, everything else (phrases, future batches) is untouched.
   * First run migrates: with no manifest, every existing subdir counts as
   * word-owned (all of them are word pages today). */
  const MANIFEST_PATH = path.join(REPO, 'docs', 'wordpages-manifest.json');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const newSlugs = [...new Set([...prep.keys()].map(slugOf))];
  const newSlugSet = new Set(newSlugs);
  let ownedSlugs = null;
  if (fs.existsSync(MANIFEST_PATH)) {
    try { ownedSlugs = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).slugs || []; }
    catch (e) { ownedSlugs = null; }
  }
  if (ownedSlugs === null) {
    ownedSlugs = fs.existsSync(OUT_DIR)
      ? fs.readdirSync(OUT_DIR, { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name !== 'sitemap')
          .map((e) => e.name)
      : [];
  }
  let removedStale = 0;
  for (const slug of ownedSlugs) {
    if (!newSlugSet.has(slug)) {
      fs.rmSync(path.join(OUT_DIR, slug), { recursive: true, force: true });
      removedStale++;
    }
  }
  // word-build-owned sitemap chunks (name pattern) must not go stale either
  const smDir = path.join(OUT_DIR, 'sitemap');
  if (fs.existsSync(smDir)) {
    for (const f of fs.readdirSync(smDir)) {
      if (/^words-\d+\.xml$/.test(f)) fs.rmSync(path.join(smDir, f), { force: true });
    }
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(
    { v: 1, source: 'tools/build-word-pages.cjs', count: newSlugs.length, slugs: newSlugs.sort() },
  ));
  console.log(`Manifest: owned ${ownedSlugs.length}, stale removed ${removedStale}, building ${newSlugs.length} — non-owned vi/tu dirs preserved`);

  /* VI-P1 linking: phrase chips source — loaded after ownership cleanup,
   * before the page build. byFirst: first token -> [{slug, phrase, hand}]. */
  const phraseIndex = loadPhraseIndex();
  console.log(`Phrase index: ${phraseIndex.phrases.length} phrase pages (${phraseIndex.handCount} hand) grouped by first token`);

  const built = [];
  // VI-CANNI: inflection pages whose defs == the lemma's (canonical -> lemma, out of sitemap)
  const mirrorSlugs = new Set();
  const labelsByWord = {};
  /* P0 QA ledger: IPA resolution per word (lemma-copy bug fix + gate) and any
   * data-field violations. Written to docs/wordpages-qa.json at the end. */
  const qa = { ipa: [], violations: [], thinPages: [], removedVulgar, removedEmpty, removedAbbrev, removedFat, removedThin, removedCorrupt, formOfLemma: [], sensePriority: {} };
  const resolvedIpa = {};
  const builtCandidates = [...prep.keys()];
  for (const [word, p] of prep) {
    // IPA: raw dataset value runs through the inflection resolver first — a
    // value equal to a plausible lemma's IPA is a lemma-copy bug and gets the
    // curated irregular IPA, a phonological derivation, or NOTHING (hidden).
    const ipaRes = resolveIpa(word, ipa);
    let ipaOut = ipaRes.ipa;
    if (ipaOut && !IPA_CHAR_OK.test(ipaOut)) {
      qa.violations.push({ word, kind: 'ipa-charset', value: ipaOut });
      ipaOut = '';
    }
    resolvedIpa[word] = ipaOut;
    qa.ipa.push({ word, source: ipaRes.source, ipa: ipaOut, prev: ipaRes.prev, lemma: ipaRes.lemma });

    // P1: learning-group label (NGSL frame) + frequency band, kept distinct
    const labels = { ...p.lbl, band: String(freq[word] || ''), ngslRank: ngsl.core[word] || null, awl: awl.words[word] || null };
    labelsByWord[word] = labels;
    // v114: ?deck= deep-link target for the word-page practice CTA (null → no button)
    const practiceDeck = practiceDeckFor(word, labels, ngsl, awl, freq);

    const raw = p.raw;
    const rawLemma = p.rawLemma;
    const entryHtml = renderEntry(raw, word);
    // P0 QA: record which listed words actually reordered (silent no-match =
    // keyword absent from entry — owner reviews the JSON, no build failure)
    if (sensePriorityFor(word)) {
      const before = (() => { try {
        const bs = demoteLeadingDomain(mtdToBlocksRender(sanitizeRaw(raw)));
        const b = bs.find((x) => x.type === 'line' || x.type === 'sense');
        return b ? plainText(b.text).slice(0, 80) : '';
      } catch (e) { return ''; } })();
      const after = firstSenseOf(word, raw).slice(0, 80);
      qa.sensePriority[word] = { reordered: before !== after, before, after };
    }
    // collect parts of speech from pos blocks for the JSON-LD
    const posList = [];
    for (const b of mtdToBlocks(sanitizeRaw(raw))) {
      if (b.type === 'pos' && !posList.includes(b.text)) posList.push(b.text);
    }

    const rel = relatedWords(word, builtCandidates, freq);
    const phraseFam = (phraseIndex.byTerm.get(word.toLowerCase()) || [])
      .slice()
      .sort((a, b) => (b.hand ? 1 : 0) - (a.hand ? 1 : 0) || a.phrase.localeCompare(b.phrase))
      .slice(0, 8);

    // Ghi chú: hand-written note wins; deterministic auto-note as fallback
    const NOTES_DIR = path.join(REPO, 'data', 'word-notes');
    const hand = loadHandNote(word, NOTES_DIR);
    let noteHtml = '';
    let noteIsHand = false;
    if (hand && hand.length) {
      noteHtml = renderNoteHTML(hand);
      noteIsHand = true;
    } else {
      // v92: inflected page words (accepted, abandoned…) usually hold bare
      // crossref entries without '=en+vi' example pairs — fall back to the
      // lemma entry so "Mẫu câu giá trị" still has real material to mine.
      let noteRaw = raw;
      if (!/=[^=\n]*?\+/.test(sanitizeRaw(raw))) {
        for (const stem of lemmaStems(word)) {
          if (stem === word) continue;
          try {
            const t2 = await lookupBestEntry(dict, stem);
            if (t2 && /=[^=\n]*?\+/.test(sanitizeRaw(t2))) {
              noteRaw = raw + '\n' + t2;
              break;
            }
          } catch (e) { /* next stem */ }
        }
      }
      const auto = buildAutoNote(word, noteRaw, ipaOut, rel);
      noteHtml = renderNoteHTML(auto.sections);
    }
    // gate warning: entry rendered nothing and no note — page would be empty
    if (!entryHtml && !noteHtml) qa.thinPages.push(word);

    // VI-CANNI (16/10/2026, owner-approved): an inflection page whose rendered
    // definitions are IDENTICAL to the lemma's is a duplicate URL competing
    // with the lemma page (68 mirrors in the 16/10 audit — led/lead 117
    // senses, logs/log 58...). Keep the page for users (badge + link back)
    // but hand the canonical signal to the lemma page and leave the sitemaps.
    let canonicalOverride = null;
    if (labels.group === 'inflection' && labels.lemma && labels.lemma !== word && BUILT.has(labels.lemma)) {
      const ownDefs = defsKey(raw);
      if (ownDefs) {
        try {
          const lemmaRaw = await lookupBestEntry(dict, labels.lemma);
          if (lemmaRaw && defsKey(lemmaRaw) === ownDefs) {
            canonicalOverride = `${SITE}${wordPageUrl(labels.lemma)}`;
            mirrorSlugs.add(word);
          }
        } catch (e) { /* keep self-canonical */ }
      }
    }

    const html = pageHtml({
      word,
      ipa: ipaOut,
      entryLemma: rawLemma,
      entryHtml,
      related: rel,
      phrases: phraseFam,
      posList,
      noteHtml,
      noteIsHand,
      labels,
      builtSet: BUILT,
      practiceDeck,
      canonicalOverride,
      raw,
    });

    const dir = path.join(OUT_DIR, slugOf(word));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    built.push(word);
  }
  if (mirrorSlugs.size) console.log(`VI-CANNI: ${mirrorSlugs.size} mirror inflection pages -> canonical to lemma (kept for users, out of sitemap)`);

  // sitemap index + chunked sitemaps (2000 URLs/file, DOL-style).
  // <lastmod> = build date: tells Google exactly when page content changed,
  // so each deploy triggers a targeted recrawl instead of slow drift.
  const LASTMOD = new Date().toISOString().slice(0, 10); // W3C date (YYYY-MM-DD)
  const sitemapDir = path.join(OUT_DIR, 'sitemap');
  fs.mkdirSync(sitemapDir, { recursive: true });
  const CHUNK = 2000;
  // VI-CANNI: mirror pages (canonical -> lemma) stay out of the sitemaps
  const sitemapWords = mirrorSlugs.size ? built.filter((w) => !mirrorSlugs.has(w)) : built;
  const chunks = [];
  for (let i = 0; i < sitemapWords.length; i += CHUNK) {
    chunks.push(sitemapWords.slice(i, i + CHUNK));
  }
  const sitemapIndexEntries = [];
  chunks.forEach((chunk, i) => {
    const name = `words-${String(i + 1).padStart(3, '0')}.xml`;
    const urls = chunk
      .map((w) => `  <url><loc>${SITE}${wordPageUrl(w)}</loc><lastmod>${LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`)
      .join('\n');
    fs.writeFileSync(
      path.join(sitemapDir, name),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
    sitemapIndexEntries.push(`  <sitemap><loc>${SITE}/vi/tu/sitemap/${name}</loc><lastmod>${LASTMOD}</lastmod></sitemap>`);
  });
  fs.writeFileSync(
    path.join(sitemapDir, 'index.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapIndexEntries.join('\n')}\n</sitemapindex>\n`,
  );
  /* P1 sitemap-tag (owner-approved 01/11): topical sitemaps per exam tag so
   * Google sees the IELTS/TOEIC clusters. Additive — chunk sitemaps above
   * are untouched. */
  const tagGroups = { ielts: [], 'giao-tiep': [] };
  for (const w of sitemapWords) {
    const t = (examTagsFor(w, null) || {}).tags || [];
    if (t.includes('ielts')) tagGroups.ielts.push(w);
    if (t.includes('giao-tiep')) tagGroups['giao-tiep'].push(w);
  }
  for (const [tag, words] of Object.entries(tagGroups)) {
    if (!words.length) continue;
    const name = `words-${tag}.xml`;
    fs.writeFileSync(
      path.join(sitemapDir, name),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${words.map((w) => `  <url><loc>${SITE}${wordPageUrl(w)}</loc><lastmod>${LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`,
    );
    sitemapIndexEntries.push(`  <sitemap><loc>${SITE}/vi/tu/sitemap/${name}</loc><lastmod>${LASTMOD}</lastmod></sitemap>`);
  }
  fs.writeFileSync(
    path.join(sitemapDir, 'index.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapIndexEntries.join('\n')}\n</sitemapindex>\n`,
  );
  console.log(`TAG-SITEMAP: ielts ${tagGroups.ielts.length} · giao-tiep ${tagGroups['giao-tiep'].length}`);

  // a lightweight word.css reusing the app's own entry visual language
  fs.writeFileSync(
    path.join(OUT_DIR, 'word.css'),
    `/* Word pages - same teal/ink visual language as the app's entry renderer */
:root{--ink:#172026;--muted:#53616c;--paper:#fff;--soft:#f6f4ef;--line:#dedbd2;--teal:#0f766e;--teal-dark:#115e59;--coral:#e85d4f}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:var(--ink);background:var(--paper);line-height:1.6}
a{color:inherit}
.breadcrumb{max-width:860px;margin:0 auto;padding:16px 20px 0;color:var(--muted);font-size:.9rem}
.breadcrumb a{text-decoration:none;color:var(--teal);font-weight:700}
.page{max-width:860px;margin:0 auto;padding:24px 20px 60px}
.word-kicker{margin:0 0 6px;color:var(--coral);font-weight:800;text-transform:uppercase;font-size:.84rem;letter-spacing:.04em}
h1{margin:0 0 8px;font-size:3rem;line-height:1.05}
.word-ipa{margin:0 0 18px;color:var(--muted);font-size:1.05rem}
.ipa-label{display:inline-block;padding:2px 8px;margin-right:6px;border-radius:999px;background:var(--soft);color:var(--teal-dark);font-size:.75rem;font-weight:800;text-transform:uppercase}
.ipa-bre{color:var(--muted)}
.ipa-hear{display:inline-block;margin-left:8px;padding:2px 10px;border:1px solid var(--line);border-radius:999px;font-size:.82rem;font-weight:700;color:var(--teal-dark);text-decoration:none}
.entry-body{border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:22px 24px;box-shadow:0 10px 30px rgba(23,32,38,.06)}
.entry-lemma-note{margin:0 0 10px;color:var(--muted);font-size:.92rem}
.entry-lemma-note a{color:var(--teal);font-weight:700}
.mtd-pos{font-weight:700;color:var(--teal);margin:12px 0 4px;font-size:.95rem}
.entry-body .mtd-pos:first-child{margin-top:0}
.mtd-domain{font-weight:600;color:var(--muted);margin:12px 0 4px;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
.mtd-sense{padding-left:14px;position:relative;margin:4px 0}
.mtd-sense::before{content:'-';position:absolute;left:0;color:var(--teal)}
/* v104: ví dụ tách khỏi nghĩa (P2) — "=English+ dịch" của OVDP thành dòng riêng */
.mtd-ex{padding-left:14px;position:relative;margin:2px 0;color:var(--muted);font-size:.95rem}
.mtd-ex-en{font-style:italic;color:var(--teal-dark)}
.mtd-ex-vi{color:var(--muted)}
.mtd-idiom{margin:6px 0;padding-left:14px}
.mtd-idiom b{color:#134e4a}
.mtd-line{margin:4px 0}
.word-cta{margin-top:26px;padding:20px 22px;border-radius:10px;background:var(--soft);border:1px solid var(--line)}
.word-cta-actions{display:flex;flex-wrap:wrap;gap:10px}
.word-cta-btn{display:inline-flex;align-items:center;min-height:48px;padding:0 18px;border-radius:8px;background:var(--coral);color:#fff;font-weight:800;text-decoration:none}
.word-cta-btn-practice{background:var(--teal)}
.word-cta-note{margin:12px 0 0;color:var(--muted);font-size:.92rem}
.word-report{margin:10px 0 0}
.word-report a{color:var(--muted);font-size:.9rem;text-decoration:underline;text-underline-offset:3px}
.related{margin-top:34px}
.related h2{font-size:1.3rem;margin:0 0 12px}
.related-list{display:flex;flex-wrap:wrap;gap:10px}
.related-chip{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--teal-dark);font-weight:700;text-decoration:none}
.related-chip:hover{border-color:var(--teal)}
@media (max-width:560px){h1{font-size:2.2rem}.page{padding:16px 14px 48px}}

/* Ghi chú sử dụng (usage notes) — hand-written + auto-generated */
.word-note{margin-top:34px;border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:10px;background:var(--soft);padding:20px 22px;position:relative}
.word-note h2{margin:0 0 10px;font-size:1.25rem}
.word-note p{margin:8px 0;color:#2c3a42;font-size:.98rem}
.word-note b{color:var(--teal-dark)}
.word-note ul{margin:8px 0;padding-left:20px}
.word-note li{margin:5px 0}
.word-note h3{margin:14px 0 6px;font-size:1.02rem;color:var(--teal-dark)}
.note-badge{position:absolute;top:14px;right:16px;padding:3px 10px;border-radius:999px;background:var(--teal);color:#fff;font-size:.72rem;font-weight:800;letter-spacing:.03em}
.note-badge{position:static;display:inline-block;margin-left:10px;vertical-align:middle}
.word-note code{background:#eef4f2;padding:1px 6px;border-radius:4px;font-size:.9em;color:var(--teal-dark)}

/* P1: nhãn nhóm / tần suất / trạng thái biên tập */
.word-badges{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.chip{display:inline-flex;align-items:center;min-height:28px;padding:0 12px;border-radius:999px;font-size:.78rem;font-weight:700}
.chip-band{background:var(--soft);color:var(--muted);border:1px solid var(--line)}
.chip-core{background:#e6f4f2;color:var(--teal-dark);border:1px solid var(--teal)}
.chip-infl{background:var(--soft);color:var(--teal-dark);border:1px solid var(--line)}
.chip-infl a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.chip-off{background:#f1f2f4;color:#4b5563;border:1px solid #d1d5db}
.chip-awl{background:#fdf3e3;color:#92400e;border:1px solid #e7c88f}
.chip-learn{background:var(--teal);color:#fff}
.chip-learn2{background:#eef4f2;color:var(--teal-dark);border:1px solid var(--teal)}
.chip-exam{background:#1d4ed8;color:#fff}
.chip-exam2{background:#e0e7ff;color:#1e40af;border:1px solid #93c5fd}
.chip-cefr{background:#f5f3ff;color:#5b21b6;border:1px solid #c4b5fd}
.exam-note{border-left-color:var(--coral)}
.exam-sub{margin:0 0 8px;color:var(--muted);font-size:.9rem}
.exam-src{color:var(--muted);font-size:.82rem}
.note-badge-auto{background:#6b7280}
.hub-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:18px 0 14px}
.hub-filters input,.hub-filters select{min-height:40px;padding:0 12px;border:1px solid var(--line);border-radius:8px;font:inherit;color:var(--ink);background:var(--paper)}
.hub-filters input{min-width:200px;flex:1}
#hub-count{color:var(--muted);font-size:.88rem}
.hub-ipa{color:var(--muted);font-size:.9em}
.hub-suggest{position:absolute;z-index:20;max-width:480px;background:var(--paper);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(23,32,38,.12);overflow:hidden}
.hub-suggest a{display:flex;gap:8px;align-items:baseline;padding:9px 14px;text-decoration:none;color:var(--ink)}
.hub-suggest a:hover,.hub-suggest a.active{background:var(--soft)}
.hub-suggest button{display:flex;width:100%;gap:8px;align-items:baseline;padding:9px 14px;background:none;border:0;font:inherit;color:var(--ink);cursor:pointer;text-align:left}
.hub-suggest button:hover,.hub-suggest button.active{background:var(--soft)}
.hub-suggest .sg-tag{margin-left:auto;font-size:.75rem;color:var(--muted);white-space:nowrap}
.hub-filters{position:relative}
`,
  );

  // hub page /vi/tu/ listing all built words (by frequency band) + P1 filters:
  // client-side only (no tracking, no backend) over data-attrs emitted at build
  // P0 hub declutter (owner-approved 01/11/2026): client-side toggle hides
  // fragments/interjections + proper nouns + abbreviations. Pages stay live
  // (no URL removed); frag detection mirrors wordlist-lib FRAGMENTS + the
  // no-vowel rule + PROPER/ABBREV entry phrasing. Default OFF.
  const hubFragSet = new Set([...FRAGMENTS]);
  // P1 hub-lite: SSR first 300 (core-first for SEO), rest client-side.
  const hubSsrWords = built.slice(0, 300);
  const hubClientIndex = built.map((w) => {
    const L = labelsByWord[w];
    const ex = ((examTagsFor(w, null) || {}).tags || []).join(' ');
    return [w, L.group || '', L.band || '', L.awl ? 'awl' : '', ex, resolvedIpa[w] || ''];
  });
  const hubNoiseMap = {};
  const hubRows = hubSsrWords
    .map((w) => {
      const L = labelsByWord[w];
      const lw = String(w).toLowerCase();
      let noiselike = hubFragSet.has(lw) || lw.length <= 2 || !/[aeiouy]/.test(lw) ? 1 : 0;
      // P0 fix 01/11: entry-ABBREV/PROPER check MUST NOT scan the raw entry —
      // real words (care: "c/o" example, change: "change of air") contain the
      // phrasing mid-entry. Only flag when the head pos-line itself says so.
      // Proper nouns are additionally 3rd-person-name shaped (capitalized key
      // with a (ten rieng) head). Conservative: never flag group=core.
      if (!noiselike && L.group !== 'core' && L.group !== 'inflection') {
        try {
          const rawT = prep.get(w) ? sanitizeRaw(prep.get(w).raw) : '';
          const headLine = rawT.split(/[@*!]/)[0].slice(0, 400);
          if (ABBREV_RE.test(headLine)) noiselike = 1;
        } catch (e) { /* keep heuristic value */ }
      }
      hubNoiseMap[w] = noiselike;
      return `    <li data-word="${escapeHtml(w)}" data-group="${L.group}" data-band="${escapeHtml(L.band)}" data-awl="${L.awl ? 'awl' : ''}" data-learning="${L.learning || ''}" data-exam="${escapeHtml(((examTagsFor(w, null) || {}).tags || []).join(' '))}" data-noise="${noiselike}"><a href="${wordPageUrl(w)}">${escapeHtml(w)}</a>${resolvedIpa[w] ? ` <span class="hub-ipa">/${escapeHtml(resolvedIpa[w])}/</span>` : ''}</li>`;
    })
    .join('\n');
  const GROUP_NAMES = {
    '': 'Tất cả nhóm',
    core: 'Học chính (NGSL)',
    inflection: 'Dạng chia',
    'off-list': 'Ngoài danh sách học',
    academic: 'Học thuật (AWL — ngoài NGSL)',
  };
  const hubFilterBar = `
  <div class="hub-filters">
    <input id="hub-q" type="search" placeholder="Tìm trong danh sách…" aria-label="Tìm từ trong danh sách" autocomplete="off">
    <div id="hub-suggest" class="hub-suggest" hidden></div>
    <select id="hub-group" aria-label="Lọc theo nhóm">
${Object.entries(GROUP_NAMES).map(([v, n]) => `      <option value="${v}">${escapeHtml(n)}</option>`).join('\n')}
    </select>
    <select id="hub-band" aria-label="Lọc theo tần suất">
      <option value="">Tất cả tần suất</option>
      <option value="1k">Top 1K</option>
      <option value="2k">Top 2K</option>
      <option value="5k">Top 5K</option>
      <option value="10k">Top 10K</option>
    </select>
    <select id="hub-awl" aria-label="Lọc theo danh sách học thuật">
      <option value="">Tất cả danh sách</option>
      <option value="awl">Thuộc AWL (học thuật)</option>
    </select>
    <select id="hub-exam" aria-label="Lọc theo mục tiêu thi">
      <option value="">Tất cả mục tiêu</option>
      <option value="ielts">IELTS Core</option>
      <option value="giao-tiep">Giao tiếp</option>
    </select>
    <label style="display:inline-flex;align-items:center;gap:6px;font-size:.9rem;color:var(--muted)"><input id="hub-clean" type="checkbox" style="min-width:0;flex:none;width:18px;height:18px"> Ẩn cảm thán / tên riêng / viết tắt</label>
    <span id="hub-count" aria-live="polite"></span>
  </div>`;
  fs.writeFileSync(
    path.join(OUT_DIR, 'index.html'),
    `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Từ điển Anh-Việt: ${built.length} từ phổ biến nhất | Dual Dictionary</title>
<meta name="description" content="Danh sách ${built.length} từ tiếng Anh (phổ biến nhất + học thuật AWL) kèm phiên âm và nghĩa tiếng Việt chi tiết."
<link rel="canonical" href="${SITE}/vi/tu/">
<meta name="robots" content="index, follow">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
</head>
<body class="word-page">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <span aria-current="page">Từ điển</span></nav>
<main class="page">
  <p class="word-kicker">Từ điển Anh-Việt</p>
  <h1 style="font-size:2.4rem">${built.length} từ tiếng Anh phổ biến nhất</h1>
  <p style="color:var(--muted)">Mỗi từ có trang riêng: phiên âm, loại từ, nghĩa tiếng Việt và ví dụ. Nhãn <b>Học chính</b> dựa trên danh sách NGSL (New General Service List, Browne &amp; Culligan), nhóm <b>Học thuật (AWL)</b> dựa trên Academic Word List của Coxhead (570 họ từ chia 10 sublist — chip ghi đúng số sublist, ví dụ "AWL Sublist 1"). <b>Tần suất</b> (top 1K/2K/5K/10K) tính riêng theo corpus phụ đề phim OpenSubtitles — nhãn tần suất và nhãn học không trộn vào nhau: một từ có thể "top 10K" mà vẫn thuộc NGSL. Nhóm "Dạng chia" là biến thể của từ gốc (trang hiển thị mục của từ gốc, có dán nhãn). Từ ngoài các danh sách học vẫn có trang riêng, được dán nhãn rõ ràng.</p>
  <p style="margin:12px 0 0"><a href="${PHRASE_HUB_URL}">Duyệt thêm ${phraseIndex.phrases.length.toLocaleString('vi-VN')} cụm từ tiếng Anh (phrasal verbs, collocations) →</a></p>
  <p style="margin:8px 0 0"><a class="word-cta-btn word-cta-btn-practice" style="display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:8px;background:var(--teal);color:#fff;font-weight:800;text-decoration:none" href="/?deck=ielts">🎯 Luyện IELTS Core trong app ↗</a></p>
  ${hubFilterBar}
  <ul class="hub-list" id="hub-list" style="columns:2;gap:20px;padding-left:18px;line-height:2">
${hubRows}
  </ul>
  <p id="hub-more-wrap" style="margin:14px 0 0"><button type="button" id="hub-more" class="related-chip" style="cursor:pointer">Hiện thêm (${(built.length - hubSsrWords.length).toLocaleString('vi-VN')} từ còn lại)</button></p>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
<script>
window.__HUB_INDEX__ = ${JSON.stringify(hubClientIndex)};
window.__HUB_NOISE__ = ${JSON.stringify(hubNoiseMap)};
(function () {
  var q = document.getElementById('hub-q');
  var g = document.getElementById('hub-group');
  var b = document.getElementById('hub-band');
  var count = document.getElementById('hub-count');
  var list = document.getElementById('hub-list');
  var moreBtn = document.getElementById('hub-more');
  var moreWrap = document.getElementById('hub-more-wrap');
  var IDX = window.__HUB_INDEX__ || [];
  var NOISE = window.__HUB_NOISE__ || {};
  var rendered = list.querySelectorAll('li').length;
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function row(r){
    var w=r[0],grp=r[1],band=r[2],awl=r[3],exam=r[4],ipa=r[5];
    return '<li data-word="'+esc(w)+'" data-group="'+esc(grp)+'" data-band="'+esc(band)+'"'+(awl?' data-awl="awl"':'')+' data-exam="'+esc(exam)+'" data-noise="'+(NOISE[w]?1:0)+'">'+rowInner(w,ipa)+'</li>';
  }
  function rowInner(w, ipa){
    // link-check-safe: href built by concat, never a literal '/vi/tu/…' string
    return '<a data-h="'+encodeURIComponent(w)+'" href="/vi/tu/">'+esc(w)+'</a>'+(ipa?' <span class="hub-ipa">/'+esc(ipa)+'/</span>':'');
  }
  // upgrade data-h anchors to real word URLs (runs once after render)
  function fixHubLinks(){
    var as = document.querySelectorAll('#hub-list a[data-h]');
    for (var i=0;i<as.length;i++){ as[i].setAttribute('href','/vi/tu/'+as[i].getAttribute('data-h')+'/'); as[i].removeAttribute('data-h'); }
  }
  function renderMore(){
    var frag = '';
    var end = Math.min(rendered + 1500, IDX.length);
    for (var i = rendered; i < end; i++) frag += row(IDX[i]);
    list.insertAdjacentHTML('beforeend', frag);
    rendered = end;
    if (rendered >= IDX.length && moreWrap) moreWrap.style.display = 'none';
    fixHubLinks();
    apply();
  }
  if (moreBtn) moreBtn.addEventListener('click', renderMore);
  /* P1 autocomplete (owner-approved 01/11): prefix matches first (max 5),
   * then DSFuzzy.suggestFor for typos (max 3). Runs on the client-side IDX
   * (no fetch). Keyboard: Up/Down + Enter + Esc. Never hijacks typing. */
  var sgBox = document.getElementById('hub-suggest');
  var sgIdx = -1;
  function lev(a, b, max){
    if (a === b) return 0;
    var m=a.length,n=b.length;
    if (Math.abs(m-n) > max) return max+1;
    var p=[],c=[],j,i;
    for (j=0;j<=n;j++) p[j]=j;
    for (i=1;i<=m;i++){ c[0]=i; var rm=c[0];
      for (j=1;j<=n;j++){ var v=p[j]+1; var u=c[j-1]+1; if(u<v)v=u; var d=p[j-1]+(a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1); if(d<v)v=d; if(v>max)v=max+1; c[j]=v; if(v<rm)rm=v; }
      if(rm>max) return max+1; var t=p;p=c;c=t; }
    return p[n]<=max?p[n]:max+1;
  }
  function tagOf(w){
    for (var i=0;i<IDX.length;i++) if(IDX[i][0]===w){ var e=IDX[i][4]||''; if(e.indexOf('ielts')!==-1)return 'IELTS'; if(e.indexOf('giao-tiep')!==-1)return 'Giao tiếp'; }
    return '';
  }
  function suggest(term){
    term = String(term||'').toLowerCase().trim();
    if (term.length < 2) return [];
    var pre = [], i, w;
    for (i=0;i<IDX.length && pre.length<5;i++){ w=IDX[i][0]; if(w.indexOf(term)===0) pre.push(w); }
    if (term.length < 3) return pre;
    var max = term.length>=5?2:1, seen={}, out=pre.slice(), fy=[];
    for (i=0;i<pre.length;i++) seen[pre[i]]=1;
    for (i=0;i<IDX.length;i++){ w=IDX[i][0];
      if(seen[w]||Math.abs(w.length-term.length)>max) continue;
      if(w.charCodeAt(0)!==term.charCodeAt(0)&&w.indexOf(term)===-1) continue;
      if(lev(term,w,max)>max) continue;
      seen[w]=1; fy.push(w); if(fy.length>=3) break; }
    return out.concat(fy).slice(0,8);
  }
  function renderSg(list2){
    if(!sgBox) return;
    if(!list2.length){ sgBox.hidden=true; sgBox.innerHTML=''; sgIdx=-1; return; }
    /* link-check-safe: suggestion rows are <button data-w> (JS navigates),
     * so no href literal exists for the scanner to flag. */
    sgBox.innerHTML = list2.map(function(w,i){
      var t=tagOf(w);
      return '<button type="button" data-w="'+esc(w)+'" data-i="'+i+'">'+esc(w)+(t?' <span class="sg-tag">'+t+'</span>':'')+'</button>';
    }).join('');
    sgBox.hidden=false; sgIdx=-1;
    var btns=sgBox.querySelectorAll('button[data-w]');
    for(var b=0;b<btns.length;b++) btns[b].addEventListener('click', function(){ window.location.href='/vi/tu/'+this.getAttribute('data-w')+'/'; });
  }
  var sgTimer=null;
  q.addEventListener('input', function(){
    if(sgTimer) clearTimeout(sgTimer);
    sgTimer=setTimeout(function(){ renderSg(suggest(q.value)); }, 120);
  });
  q.addEventListener('keydown', function(ev){
    if(!sgBox||sgBox.hidden) return;
    var links=sgBox.querySelectorAll('button[data-w]');
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
      ev.preventDefault();
      sgIdx = ev.key==='ArrowDown' ? Math.min(sgIdx+1,links.length-1) : Math.max(sgIdx-1,0);
      for(var i=0;i<links.length;i++) links[i].classList.toggle('active', i===sgIdx);
    } else if(ev.key==='Enter'&&sgIdx>=0&&links[sgIdx]){
      ev.preventDefault(); window.location.href='/vi/tu/'+links[sgIdx].getAttribute('data-w')+'/';
    } else if(ev.key==='Escape'){ sgBox.hidden=true; }
  });
  document.addEventListener('click', function(ev){
    if(sgBox&&!sgBox.hidden&&!sgBox.contains(ev.target)&&ev.target!==q) sgBox.hidden=true;
  });
  function apply() {
    // searching/filtering implies full list: render all once
    var needsAll = q.value.trim() || g.value || b.value || document.getElementById('hub-awl').value || document.getElementById('hub-exam').value || (document.getElementById('hub-clean') && document.getElementById('hub-clean').checked);
    if (needsAll && rendered < IDX.length) {
      var frag = '';
      for (var i = rendered; i < IDX.length; i++) frag += row(IDX[i]);
      list.insertAdjacentHTML('beforeend', frag);
      rendered = IDX.length;
      if (moreWrap) moreWrap.style.display = 'none';
    }
    fixHubLinks();
    var items = Array.prototype.slice.call(list.querySelectorAll('li'));
    var term = q.value.trim().toLowerCase();
    var grp = g.value, band = b.value, awl = document.getElementById('hub-awl').value, exam = document.getElementById('hub-exam').value, clean = document.getElementById('hub-clean').checked, shown = 0;
    for (var it of items) {
      var ok = (!grp || it.dataset.group === grp) &&
               (!band || it.dataset.band === band) &&
               (!awl || it.dataset.awl === 'awl') &&
               (!exam || (it.dataset.exam || '').split(' ').indexOf(exam) !== -1) &&
               (!clean || it.dataset.noise !== '1') &&
               (!term || it.dataset.word.indexOf(term) === 0);
      it.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    count.textContent = 'Hiển thị ' + shown + '/' + items.length + ' từ';
  }
  var w = document.getElementById('hub-awl');
  var x = document.getElementById('hub-exam');
  var c = document.getElementById('hub-clean');
  ['input', 'change'].forEach(function (ev) {
    q.addEventListener(ev, apply); g.addEventListener(ev, apply); b.addEventListener(ev, apply); w.addEventListener(ev, apply); x.addEventListener(ev, apply); c.addEventListener(ev, apply);
  });
  apply();
})();
</script>
</body>
</html>
`,
  );

  /* v111 (docs/plan-p2-fuzzy-practice.md): client-side headword index for the
   * fuzzy "did you mean" suggestion and the practice decks. Generated HERE so
   * it can never drift from the deployed page set. Compact rows keep the file
   * small (precached): [word, band('1k'..'10k'|'awl'|''), ngslRank, awlSublist]. */
  const builtRows = Object.keys(labelsByWord).sort((a, b) => a.localeCompare(b)).map((w) => {
    const l = labelsByWord[w];
    const band = l.band || (l.awl ? 'awl' : '');
    const rank = l.ngslRank || 0;
    const sub = l.awl && typeof l.awl === 'object' ? (l.awl.sublist ?? l.awl.sub ?? 0) : (l.awl || 0);
    return [w, band, rank, Number(sub) || 0];
  });
  if (builtRows.length !== built.length) {
    throw new Error(`built-words.json drift: rows ${builtRows.length} vs built pages ${built.length}`);
  }
  fs.writeFileSync(path.join(REPO, 'data', 'built-words.json'),
    JSON.stringify({ v: 1, source: 'tools/build-word-pages.cjs', count: builtRows.length, words: builtRows }));

  /* QA ledger out: aggregate the IPA resolution + violations so every build
   * leaves a machine-checkable quality record next to the deploy docs. */
  const srcCount = {};
  for (const r of qa.ipa) srcCount[r.source] = (srcCount[r.source] || 0) + 1;
  qa.summary = {
    built: built.length,
    ipaSources: srcCount,
    ipaChanged: qa.ipa.filter((r) => r.prev && r.prev !== r.ipa).length,
    ipaHidden: qa.ipa.filter((r) => r.source === 'copybug-hidden').length,
    violations: qa.violations.length,
    thinPages: qa.thinPages.length,
    removedVulgar: qa.removedVulgar.length,
    removedEmpty: qa.removedEmpty.length,
    removedAbbrev: qa.removedAbbrev.length,
    removedFat: qa.removedFat.length,
    removedThin: qa.removedThin.length,
    sensePriority: qa.sensePriority,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(QA_PATH, JSON.stringify(qa, null, 2));
  console.log(`QA: ${JSON.stringify(qa.summary)}`);
  if (qa.violations.length) {
    console.error(`GATE VIOLATIONS (${qa.violations.length}): field dropped — fix data or update the gate`);
    for (const v of qa.violations.slice(0, 20)) console.error(`  - ${v.word}: ${v.kind} "${v.value}"`);
  }
  const hidden = qa.ipa.filter((r) => r.source === 'copybug-hidden').map((r) => r.word);
  if (hidden.length) console.warn(`IPA hidden (no derivation rule, no table entry): ${hidden.join(', ')}`);

  console.log(`DONE: ${built.length} pages -> vi/tu/{word}/index.html`);
  console.log(`Not built (vulgar + contentless, xem Removed ở trên): ${candidatesAll.length - built.length}`);
  console.log(`Sitemap chunks: ${chunks.length} -> vi/tu/sitemap/`);
  const totalBytes = (() => {
    let t = 0;
    for (const w of built) {
      t += fs.statSync(path.join(OUT_DIR, slugOf(w), 'index.html')).size;
    }
    return t;
  })();
  console.log(`Total HTML: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
}

/* VI-P1: shared rendering core for tools/build-phrase-pages.cjs — the OVDP
 * marker parser and entry renderer live HERE so word pages and phrase pages
 * can never drift apart. Requiring this file runs no build (guarded above). */
module.exports = {
  SITE,
  REPORT_EMAIL,
  REMOVE_WORDS,
  escapeHtml,
  sanitizeRaw,
  mtdToBlocks,
  applyOvdpFixes,
  dropLeadingIpaFragment,
  renderEntry,
  applySensePriority,
  firstSenseOf,
  wordMetaDesc,
  examTagsFor,
};
