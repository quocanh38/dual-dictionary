#!/usr/bin/env node
/* "Ghi chú" (usage notes) generator for word pages — the DOL-style value-add.
 *
 * Hybrid content model (honest, no thin AI filler):
 *   1. HAND-WRITTEN notes: top ~120 most-visited words get rich, curated
 *      Vietnamese notes (usage, distinction pairs, register warnings) written
 *      by the operator in notes/{word}.md (data/word-notes/*.md). Present if
 *      the file exists.
 *   2. DATA-DRIVEN auto notes: every word also gets deterministic notes
 *      computed from its OVDP entry itself:
 *      - senses overview: how many meanings, grouped by part of speech
 *      - domain labels (technical/figurative…) when present
 *      - idiom highlights (real idioms from the entry, up to 3)
 *      - frequent collocations mined from the entry's =example lines
 *        (English phrases that appear with the headword)
 *      - confusion warnings: derived from marker data (e.g. crossrefs "(xem)")
 *
 * The build reads notes from data/word-notes/{word}.md when present.
 */

const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---- shared mini-parser (same conventions as build-word-pages) ---- */
/* v104 (review 04/10, P3): OVDP register labels like "(từ Mỹ,nghĩa Mỹ)" are
 * verbose and, when they OPEN a sense, get bolded by the auto-note as if they
 * were the meaning itself. Compact them to the short Vietnamese lexicographic
 * shorthand — register info is kept, clutter is gone. */
const REGISTER_LABELS = [
  ['(từ Mỹ,nghĩa Mỹ)', '(Mỹ)'],
  ['(từ cổ,nghĩa cổ)', '(cổ)'],
  ['(từ hiếm,nghĩa hiếm)', '(hiếm)'],
  ['(tiếng địa phương)', '(địa phương)'],
];
function compactRegisterLabels(text) {
  let t = String(text || '');
  for (const [long, short] of REGISTER_LABELS) t = t.split(long).join(short);
  return t;
}

function sanitizeRaw(raw) {
  return compactRegisterLabels(String(raw || '').replace(/\u0000/g, '').replace(/<[^>]*>/g, '').trim());
}

function mtdToBlocks(text) {
  const blocks = [];
  for (const seg of String(text).split(/(?=[@*!])/)) {
    if (!seg) continue;
    const type = '@*!'.includes(seg[0]) ? seg[0] : '';
    const body = type ? seg.slice(1) : seg;
    const pieces = body.split(/\s+-\s*/).map((p) => p.trim()).filter(Boolean);
    if (!pieces.length) continue;
    if (type === '*') blocks.push({ type: 'pos', text: pieces[0] });
    else if (type === '@') blocks.push({ type: 'domain', text: pieces[0] });
    else if (type === '!') blocks.push({ type: 'idiom', text: pieces[0] });
    else if (pieces[0]) blocks.push({ type: 'line', text: pieces[0] });
    for (const p of pieces.slice(1)) blocks.push({ type: 'sense', text: p });
  }
  for (const b of blocks) {
    if (b.type === 'domain') b.text = b.text.replace(/\s+-\s*$/, '');
  }
  return blocks;
}

/* Extract English example + Vietnamese translation pairs: the '=english+vi'
 * segments of each sense. OVDP marker: sense text is
 * "vi meaning =English example+Vi translation". */
function extractExamplePairs(raw) {
  const out = [];
  const text = sanitizeRaw(raw);
  for (const m of text.matchAll(/=([^=\n]*?)\+([^=]*?)(?=$|[\s]-(?:\s|$)|[@*!])/g)) {
    const en = m[1].replace(/\s{2,}/g, ' ').trim();
    const vi = m[2].replace(/\s{2,}/g, ' ').replace(/^[\s:]+/, '').trim();
    if (en && /[a-zA-Z]{2,}/.test(en) && en.length >= 4) out.push({ en, vi });
  }
  return out;
}

/* ---- auto-note builder ---- */
/* v92: auto notes follow the hand-written 3-section format (Điểm cần nhớ /
 * Dễ nhầm / Mẫu câu giá trị). The flat one-paragraph notes they replace read
 * as thin filler next to the curated ones, and they threw away the Vietnamese
 * translations that make "Mẫu câu giá trị" the most valuable section. */
function buildAutoNote(word, raw, ipa, related) {
  const blocks = mtdToBlocks(sanitizeRaw(raw));
  const posList = [];
  const domains = [];
  const idioms = [];
  const senseCount = blocks.filter((b) => b.type === 'sense' || b.type === 'line').length;
  for (const b of blocks) {
    if (b.type === 'pos' && !posList.includes(b.text)) posList.push(b.text);
    if (b.type === 'domain' && !domains.includes(b.text)) domains.push(b.text);
    if (b.type === 'idiom' && idioms.length < 4) idioms.push(b.text.split('+')[0].trim());
  }
  const examples = extractExamplePairs(raw);

  // Mẫu câu: a real sentence (≥4 tokens) with a Vietnamese gloss that uses the
  // word OR its stem family — inflected page words (accepted, abandoned) draw
  // their examples from the lemma entry, so the match must reach across forms.
  const stems = [...new Set([word, word.replace(/(ed|ing|s)$/, ''), word.replace(/(d|s)$/, '')])].filter(Boolean);
  const stemRe = new RegExp('\\b(' + stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es|ed|d|ing)?').join('|') + ')\\b', 'i');
  const seenEx = new Set();
  const sentences = [];
  for (const ex of examples) {
    if (!ex.vi || ex.vi.length < 2) continue;
    const m = stemRe.exec(ex.en);
    if (!m) continue;
    // the sentence must CONTINUE past the headword — "his health is a" ends
    // with the match and is a dictionary fragment, not a usable example
    if (!ex.en.slice(m.index + m[0].length).trim()) continue;
    const tokens = ex.en.trim().split(/\s+/);
    if (tokens.length < 4 || ex.en.length > 90) continue;
    const key = ex.en.toLowerCase();
    if (seenEx.has(key)) continue;
    seenEx.add(key);
    sentences.push(ex);
    if (sentences.length >= 4) break;
  }

  const sections = [];
  sections.push({ type: 'heading', text: 'Điểm cần nhớ' });
  const dcn = [];
  // v101 (review 03/10): lead with the common sense and real, reusable
  // phrases — both mined from the entry itself, nothing invented.
  const firstSense = blocks.find((b) => b.type === 'line' || b.type === 'sense');
  let firstSenseText = firstSense ? firstSense.text.split(/\s*=/)[0].trim() : '';
  if (firstSenseText.length > 90) firstSenseText = firstSenseText.slice(0, 90).replace(/\s+\S*$/, '') + '…';
  if (firstSenseText) dcn.push(`Nghĩa đầu bảng trong từ điển: **“${firstSenseText}”**.`);
  // Stop lists: articles/pronouns/auxiliaries only — PREPOSITIONS are kept on
  // purpose ("charge on", "invest in" ARE the collocations). Word-second grams
  // additionally drop "of/to" fragments ("of charges", "to charge").
  const STOP_ANY = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'that', 'which', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'our', 'his', 'her', 'its', 'their', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'than', 'so', 'if', 'will', 'would', 'can', 'could', 'not', 'no']);
  const STOP_LEFT = new Set([...STOP_ANY, 'of', 'to', 'as']);
  const gramCount = new Map();
  for (const ex of examples) {
    const toks = ex.en.toLowerCase().replace(/[^a-z'\s-]/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
      if (!stemRe.test(toks[i])) continue;
      for (const j of [i - 1, i + 1]) {
        const nb = toks[j];
        if (!nb || nb === toks[i]) continue;
        const gram = j < i ? `${nb} ${toks[i]}` : `${toks[i]} ${nb}`;
        if (j < i ? STOP_LEFT.has(nb) : STOP_ANY.has(nb)) continue;
        gramCount.set(gram, (gramCount.get(gram) || 0) + 1);
      }
    }
  }
  const collocations = [...gramCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([g]) => g);
  if (senseCount >= 10) {
    // v100 (review 03/10): a 10+-sense word needs a reading strategy, not
    // "read the dashes" — tell the learner what to look for and where.
    dcn.push(`Từ này có **${senseCount} nghĩa** trong từ điển${posList.length ? ` · loại từ: ${posList.join(', ')}` : ''} — nghĩa thông dụng, đời thường thường đứng **đầu bảng**; nghĩa chuyên ngành (“${domains.slice(0, 2).join('”, “') || 'kỹ thuật, kinh tế'}”…) nằm **cuối bảng**. Tra nghĩa nào bạn cần thì đọc đúng vạch đó, không học thuộc cả ${senseCount} nghĩa.`);
  } else {
    dcn.push(`Từ này có **${senseCount} nghĩa** trong từ điển${posList.length ? ` · loại từ: ${posList.join(', ')}` : ''} — đọc bảng nghĩa phía trên theo từng vạch gạch ngang thay vì đọc dồn một dòng.`);
  }
  if (domains.length) {
    dcn.push(`Một số nghĩa thuộc văn cảnh chuyên ngành: ${domains.slice(0, 3).map((d) => `“${d}”`).join(', ')}.`);
  }
  if (idioms.length) {
    dcn.push(`Thành ngữ/cụm cố định có sẵn trong từ điển: ${idioms.map((i) => `“${i}”`).join(', ')}.`);
  }
  if (collocations.length >= 1) {
    dcn.push(`Cụm hay gặp trong ví dụ của từ điển: ${collocations.map((c) => `**${c}**`).join(', ')}.`);
  }
  for (const b of dcn) sections.push(b);

  // Dễ nhầm chỉ khi có ý nghĩa: từ đủ dài để có "họ" thật. Với từ 1–3 ký tự
  // (a, an, at…) danh sách cùng tiền tố là nhiễu, không phải cảnh báo.
  // v104 (review 04/10, P5): dạng chia của chính từ đó (abandon→abandoned)
  // KHÔNG phải "từ dễ nhầm" — trang đã có chip "Dạng chia của…"; lọc chúng ra
  // và bỏ luôn mục nếu không còn ai, thay cho câu template "nghĩa khác nhau"
  // vốn sai với các cặp biến thể.
  if (word.length >= 4 && related && related.length) {
    const stems = new Set(lemmaStems(word));
    const realSiblings = related.filter((r) => {
      if (stems.has(r)) return false;                 // abandoned của abandon
      for (const s of lemmaStems(r)) if (s === word) return false; // chính nó là lemma của r
      return true;
    });
    if (realSiblings.length) {
      sections.push({ type: 'heading', text: 'Dễ nhầm' });
      sections.push(`Các từ cùng họ dễ nhầm: ${realSiblings.slice(0, 4).map((r) => `“${r}”`).join(', ')} — nghĩa và cách dùng có thể khác, tra kỹ trước khi dùng.`);
    }
  }

  if (sentences.length) {
    sections.push({ type: 'heading', text: 'Mẫu câu giá trị' });
    sections.push({ type: 'list', items: sentences.map((s) => `**“${s.en}”** — ${s.vi}`) });
  }

  return { posList, sections };
}

/* Render note sections (hand-written md subset + auto sections) to HTML */
function renderNoteHTML(noteSections) {
  let html = '';
  for (const s of noteSections) {
    if (typeof s === 'string') {
      // markdown-lite: **bold** and `code`
      const t = esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
      html += `<p>${t}</p>\n`;
    } else if (s && s.type === 'list') {
      html += `<ul>${s.items.map((i) => `<li>${esc(i).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')}</li>`).join('')}</ul>\n`;
    } else if (s && s.type === 'heading') {
      html += `<h3>${esc(s.text)}</h3>\n`;
    }
  }
  return html;
}

/* Hand-written note file format (data/word-notes/{word}.md):
 *   ### Ý chính
 *   prose line
 *   - list item
 * Blank lines are optional separators — a '### ' line ALWAYS starts a new
 * section, whether or not a blank line precedes it. */
function loadHandNote(word, notesDir) {
  const f = path.join(notesDir, `${word}.md`);
  if (!fs.existsSync(f)) return null;
  const md = fs.readFileSync(f, 'utf8');
  const sections = [];
  for (const rawLine of md.split('\n')) {
    const l = rawLine.trim();
    if (!l) continue;
    if (l.startsWith('### ')) {
      sections.push({ type: 'heading', text: l.slice(4) });
      continue;
    }
    if (l.startsWith('- ')) {
      let last = sections[sections.length - 1];
      if (!last || last.type !== 'list') { last = { type: 'list', items: [] }; sections.push(last); }
      last.items.push(l.slice(2));
    } else {
      sections.push(l);
    }
  }
  return sections;
}

/* Possible lemma stems of a (possibly inflected) page word — accepted → accept.
 * Regular suffix stripping only; irregulars (left → leave) stay uncovered.
 * v95: added -ies/-ied→-y (strategies→strategy, implies→imply) and
 * doubled-consonant restore (submitted→submitt→submit, inferred→inferr→infer) —
 * OVDP keys lemmas only, and the AWL batch is full of such forms. */
function lemmaStems(word) {
  const w = String(word || '').toLowerCase();
  const out = new Set([w, w.replace(/(ed|ing|s)$/, ''), w.replace(/(d|s)$/, '')]);
  if (w.length > 4 && w.endsWith('ies')) out.add(w.slice(0, -3) + 'y');
  if (w.length > 4 && w.endsWith('ied')) out.add(w.slice(0, -3) + 'y');
  const dd = w.match(/^([a-z]+)([bdfgmnprt])\2(ed|ing|s)$/); // submitted → submit
  if (dd) out.add(dd[1] + dd[2]);
  const dde = w.match(/^([a-z]+)([bdfgmnprt])\2ed$/); // doubled consonant + "ed" → +e stem
  if (dde) out.add(dde[1] + dde[2] + 'e');
  return [...out].filter((s) => s.length >= 2);
}

module.exports = { esc, mtdToBlocks, sanitizeRaw, compactRegisterLabels, extractExamplePairs, lemmaStems, buildAutoNote, loadHandNote, renderNoteHTML };

/* CLI test: node build-word-notes.cjs word1 word2 ... */
if (require.main === module) {
  const REPO = path.join(__dirname, '..');
  (async () => {
    const { MDict } = require('../js/mdict.js');
    const ipa = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'ipa-en.json'), 'utf8'));
    const buf = fs.readFileSync(path.join(REPO, 'dicts-en-vi', 'star_anhviet.mdx'));
    const dict = new MDict(new Blob([buf]), 'star_anhviet.mdx');
    await dict.init();
    const words = process.argv.slice(2).length ? process.argv.slice(2) : ['time', 'look', 'happy'];
    for (const w of words) {
      const r = await dict.lookup(w);
      if (!r || !r[0]) { console.log(`${w}: no entry`); continue; }
      const hand = loadHandNote(w, path.join(REPO, 'data', 'word-notes'));
      const auto = buildAutoNote(w, r[0].text, ipa[w] || '', []);
      const sections = hand || auto.sections;
      console.log(`\n===== ${w} ${hand ? '(HAND-WRITTEN)' : '(AUTO)'} =====`);
      console.log(renderNoteHTML(sections));
    }
  })();
}
