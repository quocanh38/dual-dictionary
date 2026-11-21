#!/usr/bin/env node
/**
 * Builds the Vietnamese -> English reverse dictionary:
 *  1. data/vi-en-index.json (7,032 canonical entries for in-app offline reverse lookup)
 *  2. data/vi-en-concepts.json (2,800+ Vietnamese headword concept groups: Vietnamese headword FIRST -> English words)
 *  3. /vi/viet-anh/<slug>/index.html (2,800+ Programmatic SEO & GEO static concept pages, zero accent collisions)
 *  4. /vi/viet-anh/index.html (True Vietnamese -> English hub: Vietnamese headword cards + Vietnamese alphabet A, Ă, Â, B, C, D, Đ… directory)
 *  5. Two-way internal links between /vi/tu/<word>/ and /vi/viet-anh/<slug>/
 */
const fs = require('fs');
const path = require('path');
const { navHtml } = require('./nav-partial.cjs');

const ROOT = path.resolve(__dirname, '..');
const TU_DIR = path.join(ROOT, 'vi', 'tu');
const PHAN_BIET_DIR = path.join(ROOT, 'vi', 'phan-biet');
const DONG_NGHIA_DIR = path.join(ROOT, 'vi', 'dong-nghia');
const OUT_JSON = path.join(ROOT, 'data', 'vi-en-index.json');
const OUT_CONCEPTS_JSON = path.join(ROOT, 'data', 'vi-en-concepts.json');
const VIET_ANH_DIR = path.join(ROOT, 'vi', 'viet-anh');
const OUT_HTML = path.join(VIET_ANH_DIR, 'index.html');
const MAX_CONCEPT_PAGES = 2800;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/<\//g, '<\\/');
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldSlug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const VI_ALPHA_ORDER = [
  'A', 'Ă', 'Â', 'B', 'C', 'D', 'Đ', 'E', 'Ê', 'G', 'H', 'I',
  'K', 'L', 'M', 'N', 'O', 'Ô', 'Ơ', 'P', 'Q', 'R', 'S', 'T',
  'U', 'Ư', 'V', 'X', 'Y'
];

function viInitialLetter(term) {
  const ch = String(term || '').trim().charAt(0).toLowerCase();
  if (!ch) return 'A';
  if ('ăằắẳẵặ'.includes(ch)) return 'Ă';
  if ('âầấẩẫậ'.includes(ch)) return 'Â';
  if ('àáảãạa'.includes(ch)) return 'A';
  if (ch === 'đ') return 'Đ';
  if ('êềếểễệ'.includes(ch)) return 'Ê';
  if ('èéẻẽẹe'.includes(ch)) return 'E';
  if ('ìíỉĩịi'.includes(ch)) return 'I';
  if ('ôồốổỗộ'.includes(ch)) return 'Ô';
  if ('ơờớởỡợ'.includes(ch)) return 'Ơ';
  if ('òóỏõọo'.includes(ch)) return 'O';
  if ('ưừứửữự'.includes(ch)) return 'Ư';
  if ('ùúủũụu'.includes(ch)) return 'U';
  if ('ỳýỷỹỵy'.includes(ch)) return 'Y';
  const up = ch.toUpperCase();
  return VI_ALPHA_ORDER.includes(up) ? up : 'A';
}

const SKIP_SENSE_RE = /^\s*\(?\s*\((?:cổ|từ cổ|nghĩa cổ|thơ ca|cũ|từ lóng|thông tục|khẩu ngữ|đùa cợt|xem|viết tắt|như|sử học|đánh cờ|hàng hải|thổ ngữ|phương ngữ|từ hiếm|hiếm|quân sự|tôn giáo|từ Mỹ,nghĩa Mỹ|từ Anh,nghĩa Anh)[^)]*\)?\s*/i;
const SKIP_WHOLE_SENSE_RE = /^(?:\(?\s*\((?:cổ|từ cổ|nghĩa cổ|thơ ca|cũ|từ lóng|đùa cợt|xem|viết tắt|sử học|đánh cờ|thổ ngữ|phương ngữ|từ hiếm|hiếm)[^)]*\)|số nhiều của\b|quá khứ của\b|phân từ\b|\(xem\)\s)/i;

// Per-word OVDP typo fixes and erroneous/archaic sense exclusions
const OVDP_TYPO_FIXES = {
  castle: [[/\blâu dài\b/gi, 'lâu đài']],
  reject: [[/\bkhông nhanh\b/gi, 'không nhận']],
  send: [[/\bcho đi scend\b/gi, 'gửi đi']],
};
const WORD_BAD_SENSES = {
  bee: [/nhà thơ/i],
  always: [/đôi khi|đôi lúc|thỉnh thoảng/i],
  mud: [/bảo thủ|chậm tiến|lạc hậu/i],
  cope: [/áo khoác|áo lễ/i],
  dot: [/của hồi môn/i],
  continent: [/điều độ|tiết dục/i],
  vacation: [/bỏ không|bỏ trống/i],
  can: [/bi đông|vỏ đồ hộp|hộp đồ hộp|nhà tiêu|nhà tù/i],
  deal: [/gỗ tùng|gỗ thông|tấm ván cây/i],
  lay: [/bài thơ ngắn|bài vè|bài hát|bài ca|tiếng chim/i],
  wife: [/bà già/i],
  customer: [/anh chàng|gã/i],
  silly: [/choáng váng|mê mẩn/i],
  fly: [/con ruồi|ruồi \(/i],
  hang: [/sự cúi xuống|sự gục xuống|mặt dốc/i],
  fast: [/ăn chay|bệnh gút/i],
  husband: [/tiết kiệm/i],
  jack: [/từ bỏ/i],
  do: [/an toàn/i],
  doctor: [/anh nuôi/i],
  red: [/ác liệt/i],
};
const SKIP_HEADWORDS = new Set([
  'sammy', 'johnny', 'joker', 'thy', 'thee', 'thou', 'ye',
  'ate', 'eaten', 'became', 'began', 'begun', 'blown', 'bought', 'brought', 'built',
  'caught', 'children', 'chose', 'chosen', 'could', 'cried', 'dealt', 'drawn', 'drew',
  'dreamt', 'drank', 'driven', 'fell', 'fallen', 'feet', 'felt', 'flew', 'flown',
  'forgot', 'forgotten', 'fought', 'froze', 'frozen', 'gave', 'given', 'goes', 'gone',
  'gotten', 'grew', 'grown', 'had', 'heard', 'held', 'heroes', 'hid', 'hidden', 'hung',
  'kept', 'knew', 'known', 'laid', 'led', 'lent', 'lied', 'made', 'meant', 'men', 'met',
  'mice', 'paid', 'ran', 'ridden', 'risen', 'rode', 'said', 'sang', 'sat', 'seen', 'sent',
  'shook', 'shaken', 'shown', 'slept', 'sold', 'spoke', 'spoken', 'spent', 'stole', 'stolen',
  'stood', 'sung', 'swam', 'swum', 'swore', 'sworn', 'taken', 'taught', 'teeth', 'thought',
  'threw', 'thrown', 'told', 'took', 'tore', 'torn', 'understood', 'was', 'went', 'were',
  'wives', 'woke', 'woken', 'women', 'won', 'wore', 'worn', 'would', 'written', 'wrote',
  'been', 'did', 'done', 'does', 'has', 'is', 'are', 'am', 'yourselves', 'themselves', 'ourselves'
]);

const UK_TO_US = {
  licence: 'license',
  offence: 'offense',
  recognised: 'recognized',
  recognise: 'recognize',
  favour: 'favor',
  favourite: 'favorite',
  colour: 'color',
  centre: 'center',
  grey: 'gray',
  disc: 'disk',
  organisation: 'organization',
  organise: 'organize',
  programme: 'program',
  defence: 'defense',
  labour: 'labor',
  behaviour: 'behavior',
  analyse: 'analyze',
  realise: 'realize',
  apologise: 'apologize',
  criticise: 'criticize',
  emphasise: 'emphasize',
  minimise: 'minimize',
  maximise: 'maximize',
  practise: 'practice',
  travelling: 'traveling',
  travelled: 'traveled',
  cancelled: 'canceled',
  catalogue: 'catalog',
  dialogue: 'dialog',
  amongst: 'among',
  anyhow: 'anyway',
  tyre: 'tire',
  enquiry: 'inquiry',
};

function truncateClean(str, maxLen) {
  const s = String(str || '').trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  // Prefer cutting at a delimiter (·, ;, ,) so no Vietnamese phrase is cut mid-word
  const delim = Math.max(cut.lastIndexOf(' · '), cut.lastIndexOf('; '), cut.lastIndexOf(', '));
  if (delim >= Math.floor(maxLen * 0.45)) return cut.slice(0, delim).trim();
  const sp = cut.lastIndexOf(' ');
  if (sp >= Math.floor(maxLen * 0.5)) return cut.slice(0, sp).trim();
  return cut.trim();
}

function cleanSense(raw, head) {
  let s = decodeEntities(raw.replace(/<[^>]+>/g, ' '));
  if (!s || SKIP_WHOLE_SENSE_RE.test(s)) return '';

  // Remove OVDP double-parentheses tags including ((nghĩa đen) & (nghĩa bóng)) and ((thường) + out)
  s = s.replace(/\(\([^)]*\)\s*(?:&\s*\([^)]*\))?[^)]*\)/g, ' ');
  s = s.replace(/\(\([^)]*\)\)/g, ' ');
  // Remove leading domain/register parens
  s = s.replace(SKIP_SENSE_RE, '');
  // Remove remaining parenthetical clarifications (nested or single)
  s = s.replace(/\([^)]*\)/g, ' ');
  // Clean stray unmatched parens, standalone &, leading "+ prep" fragments, and punctuation
  s = s.replace(/[()]/g, ' ').replace(/(?:^|\s)&\s*/g, ' ').replace(/^\+\s*[a-z]+\s+/i, '');
  s = s.replace(/\s*([,;:])\s*/g, '$1 ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[,;:\-–—&\s]+|[,;:\-–—&\s]+$/g, '').trim();
  if (!s || !/[a-zA-ZÀ-ỹ]/.test(s)) return '';

  const lowHead = String(head || '').toLowerCase();
  if (OVDP_TYPO_FIXES[lowHead]) {
    for (const [re, rep] of OVDP_TYPO_FIXES[lowHead]) s = s.replace(re, rep);
  }
  if (WORD_BAD_SENSES[lowHead]) {
    if (WORD_BAD_SENSES[lowHead].some((re) => re.test(s))) return '';
  }
  return s;
}

function buildIndex() {
  const quickSensesPath = path.join(ROOT, 'data', 'word-quick-senses.json');
  const quickSenses = fs.existsSync(quickSensesPath)
    ? JSON.parse(fs.readFileSync(quickSensesPath, 'utf8'))
    : {};

  const dirs = fs.readdirSync(TU_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const rawRecords = [];

  for (const d of dirs) {
    if (['cum-tu', 'ielts', 'toeic'].includes(d.name)) continue;
    const htmlPath = path.join(TU_DIR, d.name, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (html.includes('entry-lemma-note')) continue;

    const h1Match = html.match(/<h1>([^<]+)<\/h1>/);
    if (!h1Match) continue;
    const head = decodeEntities(h1Match[1]);
    if (!head) continue;
    const lowHead = head.toLowerCase();
    if (SKIP_HEADWORDS.has(lowHead) || UK_TO_US[lowHead]) continue;

    // Parse POS blocks + senses so we capture primary meanings across all POS (not just first 2 raw senses)
    const tokens = [...html.matchAll(/<div class="mtd-(pos|sense)">([\s\S]*?)<\/div>/g)];
    const posGroups = [];
    let current = { pos: '', senses: [] };
    for (const m of tokens) {
      if (m[1] === 'pos') {
        if (current.senses.length) posGroups.push(current);
        current = { pos: decodeEntities(m[2].replace(/<[^>]+>/g, ' ')), senses: [] };
      } else {
        const cleaned = cleanSense(m[2], head);
        if (cleaned) current.senses.push(cleaned);
      }
    }
    if (current.senses.length) posGroups.push(current);

    // Collect up to 2 clean senses per POS group for concept extraction, and pick top 2-3 for display gloss
    const allCleanSenses = [];
    const displaySenses = [];

    if (quickSenses[lowHead] && Array.isArray(quickSenses[lowHead])) {
      for (const qs of quickSenses[lowHead]) {
        if (qs && qs[0]) {
          const cleanQ = String(qs[0]).trim();
          if (cleanQ && !displaySenses.includes(cleanQ)) displaySenses.push(cleanQ);
          if (cleanQ && !allCleanSenses.includes(cleanQ)) allCleanSenses.push(cleanQ);
        }
      }
    }

    // First pass: take 1 primary sense from each POS group (ensures verbs/adjectives aren't drowned out by homonym nouns)
    for (const grp of posGroups) {
      if (grp.senses[0]) {
        const s0 = truncateClean(grp.senses[0], 64);
        if (s0 && !displaySenses.includes(s0) && displaySenses.length < 3) {
          displaySenses.push(s0);
        }
      }
      for (const s of grp.senses.slice(0, 2)) {
        if (!allCleanSenses.includes(s)) allCleanSenses.push(s);
      }
    }
    // Fallback: if only 1 POS group, take its 2nd sense for display
    if (displaySenses.length < 2 && posGroups[0] && posGroups[0].senses[1]) {
      const s1 = truncateClean(posGroups[0].senses[1], 64);
      if (s1 && !displaySenses.includes(s1)) displaySenses.push(s1);
    }

    if (!displaySenses.length) continue;
    const viGloss = truncateClean(displaySenses.join(' · '), 96);
    if (!viGloss) continue;

    const ipaMatch = html.match(/class="ipa-ame"[^>]*>([^<]+)<\/span>/);
    const ipa = ipaMatch ? decodeEntities(ipaMatch[1]).replace(/^Mỹ\s*/i, '').trim() : '';

    const tags = [];
    const cefrMatch = html.match(/<span class="chip chip-cefr"[^>]*>~?([A-C][12])<\/span>/);
    if (cefrMatch) tags.push(cefrMatch[1]);
    if (html.includes('Từ học thuật (AWL)') || html.includes('AWL Sublist')) tags.push('AWL');
    if (html.includes('>IELTS Core<')) tags.push('IELTS');
    if (html.includes('>TOEIC<') || html.includes('TOEIC Business')) tags.push('TOEIC');
    if (html.includes('Học chính (NGSL')) tags.push('NGSL');
    if (head.includes(' ')) tags.push('PHRASE');

    const isOffList = html.includes('chip-off');
    if (isOffList && !tags.length) continue;

    rawRecords.push({
      row: [head, d.name, viGloss, tags.join(' '), ipa],
      allSenses: allCleanSenses
    });
  }

  const rankOf = (row) => {
    const t = row[3];
    let score = 0;
    if (t.includes('IELTS')) score += 4;
    if (t.includes('AWL')) score += 3;
    if (t.includes('NGSL')) score += 3;
    if (t.includes('PHRASE')) score += 2;
    return -score;
  };
  rawRecords.sort((a, b) => rankOf(a.row) - rankOf(b.row) || a.row[0].localeCompare(b.row[0]));

  // Deduplicate exact-gloss inflected/variant twins (keep higher-ranked / shorter lemma)
  const seenExactGloss = new Map();
  const keptRecords = [];
  for (const rec of rawRecords) {
    const g = rec.row[2];
    const head = rec.row[0].toLowerCase();
    if (seenExactGloss.has(g)) {
      const prevHead = seenExactGloss.get(g);
      // Skip if same stem (e.g. broadcast/broadcasting, deserve/deserved, basis/bases, medium/media)
      if (head.slice(0, 4) === prevHead.slice(0, 4)) continue;
    } else {
      seenExactGloss.set(g, head);
    }
    keptRecords.push(rec);
  }

  const items = keptRecords.map((r) => r.row);
  const allSensesMap = new Map(keptRecords.map((r) => [r.row[0], r.allSenses]));

  const payload = { v: 2, count: items.length, items };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload));
  console.log(`Wrote ${OUT_JSON}: ${items.length} entries (${(fs.statSync(OUT_JSON).size / 1024).toFixed(1)} KB)`);
  payload._allSensesMap = allSensesMap;
  return payload;
}

const VI_VOWEL_RE = /[aeiouyàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
const VI_VALID_CODA_RE = /(?:ng|nh|ch|[aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵcmnpt])$/i;
const VI_DIACRITIC_RE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

function isValidViSyllable(w) {
  if (!w || w.length > 7) return false;
  if (/[fjwz0-9]/i.test(w)) return false;
  if (!VI_VOWEL_RE.test(w)) return false;
  if (!VI_VALID_CODA_RE.test(w)) return false;
  if (w.length === 1 && !/^[ýởủứơêôảáàạỷỹỳ]$/.test(w)) return false;
  return true;
}

function isValidViConcept(p, noiseSet) {
  if (!p || p.length < 4 || p.length > 26 || noiseSet.has(p)) return false;
  if (!VI_DIACRITIC_RE.test(p)) return false;
  // Reject possessive pronouns & grammatical fragments
  if (/^(?:của|chính)\s+(?:anh|chị|em|ông|bà|cô|chú|bác|mày|tao|nó|ngài|chúng|họ|bạn|tôi|mình)\b/.test(p)) return false;
  if (/^(?:được|bị|chỉ là|đúng là|đúng với|cho đến|do bởi|bao gồm cả|chủ yếu là|về phía|về một bên|vào lúc|vậy thì|tất cả|mọi người|mỗi người)\b/.test(p)) return false;
  if (/\b(?:của|và|hoặc|nhưng|mà|để|với|trong|về|từ|bởi|vì|nếu|khi|như|là|một|các|những|rất|quá)$/.test(p)) return false;

  const words = p.split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  return words.every(isValidViSyllable);
}

function lemmaKey(enWord) {
  const w = String(enWord || '').toLowerCase().trim();
  if (w.includes(' ')) return w;
  if (UK_TO_US[w]) return UK_TO_US[w];
  return w.replace(/(ies|ied|ing|ed|es|s)$/, '').slice(0, 6);
}

function extractConceptClusters(payload) {
  const NOISE_VI = new Set([
    'ai cập', 'hy lạp', 'la mã', 'anh quốc', 'nước anh', 'nước mỹ', 'nước pháp',
    'việt nam', 'trung quốc', 'nhật bản', 'ấn độ', 'châu âu', 'châu á', 'châu mỹ',
    'do thái', 'anh ấy', 'cô ấy', 'ông ấy', 'bà ấy', 'chúng tôi', 'chúng ta', 'của tôi',
    'của bạn', 'chính mình', 'có thể', 'làm cho', 'thuộc về', 'liên quan', 'có ý', 'ăn cơm',
    'vả chăng', 'vả lại', 'áo lễ', 'thằng cha', 'vỏ đồ hộp', 'vũng nước bẩn', 'vò chơi khăm',
    'xe bò', 'xe ngựa', 'ăn thủng', 'bi đông', 'bà già', 'bài ca', 'bỏ không', 'bán rẻ',
    'cấp đăng ký', 'cấp giấy phép', 'cấp môn bài', 'bản báo cáo', 'người báo cáo',
    'ở ni nào', 'ao nuôi cá', 'anh nuôi'
  ]);

  const allSensesMap = payload._allSensesMap || new Map();

  // Step 1: Group strictly by EXACT diacritic Vietnamese term (never merge bảo thủ with báo thù!)
  const exactMap = new Map();

  for (const row of payload.items) {
    const [head, , gloss, tags] = row;
    const senseList = allSensesMap.get(head) || [gloss];
    const seen = new Set();

    for (const rawSense of senseList) {
      const cleanStr = rawSense.replace(/\([^)]*\)?/g, ' ').replace(/…/g, ' ');
      const rawParts = cleanStr
        .split(/[·;,/]/)
        .map((s) => s.replace(/[^a-zA-ZÀ-ỹ\s-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase());

      for (let p of rawParts) {
        // Only strip neutral abstract nominalizers (sự / việc); NEVER strip người/kẻ/vật/cái!
        p = p.replace(/^(?:sự|việc)\s+/i, '').trim();
        p = p.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
        if (!isValidViConcept(p, NOISE_VI)) continue;
        if (seen.has(p)) continue;
        seen.add(p);

        if (!exactMap.has(p)) {
          exactMap.set(p, {
            term: p,
            baseSlug: foldSlug(p),
            entries: [],
            seenLemmas: new Set(),
            ieltsCount: 0,
            awlCount: 0
          });
        }
        const g = exactMap.get(p);
        const lk = lemmaKey(head);
        if (g.seenLemmas.has(lk)) continue;
        g.seenLemmas.add(lk);
        g.entries.push(row);
        if (tags.includes('IELTS')) g.ieltsCount++;
        if (tags.includes('AWL')) g.awlCount++;
      }
    }
  }

  // Curated flagship concepts with verified English words (only kept if present in payload.items)
  const byHead = new Map(payload.items.map((r) => [r[0].toLowerCase(), r]));
  const mustTopics = [
    ['danh-gia', 'đánh giá', ['evaluate', 'assessment', 'estimate', 'appreciate', 'judge', 'rate', 'review', 'value']],
    ['ben-vung', 'bền vững', ['sustainable', 'sustain', 'permanent', 'maintain', 'last', 'endure', 'steady', 'stable']],
    ['tiet-kiem', 'tiết kiệm', ['economical', 'save', 'saving', 'economy', 'spare', 'cut down', 'budget']],
    ['giai-quyet', 'giải quyết', ['resolve', 'solve', 'settle', 'deal with', 'handle', 'address', 'work out', 'sort out']],
    ['anh-huong', 'ảnh hưởng', ['affect', 'impact', 'influence', 'effect', 'consequence']],
    ['duy-tri', 'duy trì', ['maintain', 'sustain', 'keep up', 'preserve', 'retain', 'continue', 'hold']],
    ['tu-bo', 'từ bỏ', ['abandon', 'give up', 'quit', 'drop', 'leave', 'surrender', 'renounce']],
    ['can-kiet', 'cạn kiệt', ['run out of', 'run out', 'drain', 'empty', 'consume', 'use up', 'dry up']],
    ['dong-y', 'đồng ý', ['agree', 'approve', 'consent', 'accept', 'accord', 'favor']],
    ['thuc-day', 'thúc đẩy', ['promote', 'boost', 'encourage', 'drive', 'push', 'advance', 'foster', 'stimulate']],
  ];
  const mustTerms = new Set(mustTopics.map((x) => x[1]));

  for (const [mSlug, mTerm, preferredWords] of mustTopics) {
    const picked = [];
    const pickedLemmas = new Set();
    for (const w of preferredWords) {
      const row = byHead.get(w);
      if (row) {
        picked.push(row);
        pickedLemmas.add(lemmaKey(row[0]));
      }
    }
    const existing = exactMap.get(mTerm);
    if (existing) {
      for (const row of existing.entries) {
        const lk = lemmaKey(row[0]);
        if (!pickedLemmas.has(lk) && picked.length < 14) {
          picked.push(row);
          pickedLemmas.add(lk);
        }
      }
    }
    if (picked.length >= 2) {
      exactMap.set(mTerm, {
        term: mTerm,
        baseSlug: mSlug,
        entries: picked,
        ieltsCount: picked.filter((r) => r[3].includes('IELTS')).length,
        awlCount: picked.filter((r) => r[3].includes('AWL')).length
      });
    }
  }

  // Filter to exact Vietnamese terms that have at least 2 distinct English lemmas
  const validGroups = [...exactMap.values()].filter(
    (g) => mustTerms.has(g.term) || (g.entries.length >= 2 && g.entries.length <= 32)
  );

  // Sort by academic/learning utility so if two distinct Vietnamese terms share a baseSlug,
  // the higher-utility term gets the primary slug and the second gets a disambiguated slug (-enWord)
  validGroups.sort((a, b) => {
    const aMust = mustTerms.has(a.term) ? 10000 : 0;
    const bMust = mustTerms.has(b.term) ? 10000 : 0;
    const aScore = aMust + a.ieltsCount * 3 + a.awlCount * 2 + a.entries.length;
    const bScore = bMust + b.ieltsCount * 3 + b.awlCount * 2 + b.entries.length;
    return bScore - aScore || a.term.localeCompare(b.term, 'vi');
  });

  const usedSlugs = new Set();
  const finalClusters = [];

  for (const g of validGroups) {
    if (finalClusters.length >= MAX_CONCEPT_PAGES) break;
    let slug = g.baseSlug;
    if (!slug || slug.length < 3) continue;
    if (usedSlugs.has(slug)) {
      const disambig = foldSlug(g.entries[0][0]);
      slug = `${slug}-${disambig}`;
      if (usedSlugs.has(slug)) continue;
    }
    usedSlugs.add(slug);
    finalClusters.push({
      slug,
      term: g.term,
      entries: g.entries,
      ieltsCount: g.ieltsCount,
      awlCount: g.awlCount
    });
  }

  // Save compact Vietnamese->English concept index for the /vi/viet-anh/ hub page
  // Schema: [viTerm, slug, [[enWord, enSlug, ipa, tags, shortGloss], ...], totalCount]
  const conceptsPayload = {
    v: 3,
    count: finalClusters.length,
    concepts: [...finalClusters]
      .sort((a, b) => a.term.localeCompare(b.term, 'vi'))
      .map((c) => [
        c.term,
        c.slug,
        c.entries.slice(0, 8).map((r) => [r[0], r[1], r[4] || '', r[3] || '', r[2] || '']),
        c.entries.length
      ])
  };
  fs.writeFileSync(OUT_CONCEPTS_JSON, JSON.stringify(conceptsPayload));
  console.log(`Wrote ${OUT_CONCEPTS_JSON}: ${finalClusters.length} Vietnamese concepts (${(fs.statSync(OUT_CONCEPTS_JSON).size / 1024).toFixed(1)} KB)`);

  return finalClusters;
}

function registerGuide(tags) {
  const t = String(tags || '');
  const cefr = (t.match(/\b[A-C][12]\b/) || [])[0] || '';
  if (t.includes('AWL') && t.includes('IELTS')) {
    return `Học thuật & IELTS Writing/Reading${cefr ? ' (~' + cefr + ')' : ''}`;
  }
  if (t.includes('PHRASE')) {
    return `Cụm từ / Phrasal verb tự nhiên (Speaking & Giao tiếp${cefr ? ' ~' + cefr : ''})`;
  }
  if (t.includes('IELTS')) {
    return `Từ vựng cốt lõi IELTS & Viết luận${cefr ? ' (~' + cefr + ')' : ''}`;
  }
  if (t.includes('NGSL')) {
    return `Từ thông dụng tần suất cao (NGSL${cefr ? ' ~' + cefr : ''})`;
  }
  return cefr ? `Từ vựng trình độ ~${cefr}` : 'Từ vựng mở rộng theo ngữ cảnh';
}

function badgeChipsHtml(tags) {
  const parts = String(tags || '').split(' ').filter(Boolean);
  return parts
    .map((t) => {
      if (t === 'IELTS') return '<span class="chip chip-exam">IELTS Core</span>';
      if (t === 'AWL') return '<span class="chip chip-awl">AWL</span>';
      if (t === 'PHRASE') return '<span class="chip chip-core">Cụm từ</span>';
      if (t === 'NGSL') return '<span class="chip chip-band">NGSL</span>';
      if (/^[A-C][12]$/.test(t)) return `<span class="chip chip-cefr">~${t}</span>`;
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

function buildConceptPages(clusters) {
  const comparePages = fs.existsSync(PHAN_BIET_DIR)
    ? fs.readdirSync(PHAN_BIET_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const synSet = new Set(
    fs.existsSync(DONG_NGHIA_DIR)
      ? fs.readdirSync(DONG_NGHIA_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : []
  );

  const wordToConcepts = new Map();

  clusters.forEach((cluster, idx) => {
    const { slug, term, entries } = cluster;
    const capTerm = term.charAt(0).toUpperCase() + term.slice(1);
    const topWords = entries.slice(0, 5).map((r) => r[0]);
    const topWordsPlain = topWords.join(', ');

    for (const r of entries) {
      const enSlug = r[1];
      if (!wordToConcepts.has(enSlug)) wordToConcepts.set(enSlug, []);
      const arr = wordToConcepts.get(enSlug);
      if (arr.length < 4 && !arr.some((x) => x.slug === slug)) {
        arr.push({ slug, term });
      }
    }

    const academicChoices = entries.filter((r) => r[3].includes('AWL') || r[3].includes('C1') || r[3].includes('B2')).slice(0, 3).map((r) => r[0]);
    const phraseChoices = entries.filter((r) => r[3].includes('PHRASE') || r[3].includes('A2') || r[3].includes('B1')).slice(0, 3).map((r) => r[0]);

    const directAnswerText =
      `Trong tiếng Anh, “${term}” có thể diễn đạt bằng ${entries.length} từ và cụm từ tùy ngữ cảnh: phổ biến nhất là ${topWordsPlain}. ` +
      (academicChoices.length
        ? `Khi viết học thuật hoặc IELTS Writing, nên ưu tiên ${academicChoices.join(', ')}; `
        : '') +
      (phraseChoices.length
        ? `trong giao tiếp hàng ngày hoặc IELTS Speaking, có thể dùng ${phraseChoices.join(', ')}.`
        : 'hãy đối chiếu bảng trình độ CEFR và sắc thái nghĩa dưới đây để chọn đúng từ.');

    const entrySlugs = new Set(entries.map((r) => r[1]));
    const relatedCompares = comparePages
      .filter((c) => {
        const parts = c.split('-vs-');
        return parts.some((p) => entrySlugs.has(p));
      })
      .slice(0, 4);
    const relatedSyns = entries.filter((r) => synSet.has(r[1])).slice(0, 4);

    const neighbors = [];
    for (let step = 1; neighbors.length < 6 && step < clusters.length; step++) {
      const n = clusters[(idx + step) % clusters.length];
      if (n.slug !== slug) neighbors.push(n);
    }

    const faq1Q = `“${capTerm}” tiếng Anh là gì?`;
    const faq1A = directAnswerText;
    const faq2Q = `Khi nào dùng ${entries[0][0]} và ${entries[1] ? entries[1][0] : entries[0][0]} để diễn đạt “${term}”?`;
    const faq2A = entries[1]
      ? `“${entries[0][0]}” (${entries[0][4] || 'từ vựng chính'}) mang sắc thái: ${entries[0][2]}. Trong khi đó, “${entries[1][0]}” (${entries[1][4] || 'từ liên quan'}) được dùng với nghĩa: ${entries[1][2]}.`
      : `“${entries[0][0]}” được dùng với nghĩa: ${entries[0][2]}.`;

    const pageUrl = `https://hocta.app/vi/viet-anh/${slug}/`;
    const jsonld = safeJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'DefinedTermSet',
          name: `${capTerm} tiếng Anh là gì? Từ điển Việt–Anh theo trình độ`,
          url: pageUrl,
          inLanguage: ['vi', 'en'],
          description: directAnswerText,
          hasDefinedTerm: entries.slice(0, 10).map((r) => ({
            '@type': 'DefinedTerm',
            name: r[0],
            description: r[2],
            url: `https://hocta.app/vi/tu/${r[1]}/`
          }))
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: faq1Q, acceptedAnswer: { '@type': 'Answer', text: faq1A } },
            { '@type': 'Question', name: faq2Q, acceptedAnswer: { '@type': 'Answer', text: faq2A } }
          ]
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://hocta.app/vi/' },
            { '@type': 'ListItem', position: 2, name: 'Từ điển Việt–Anh', item: 'https://hocta.app/vi/viet-anh/' },
            { '@type': 'ListItem', position: 3, name: capTerm, item: pageUrl }
          ]
        }
      ]
    });

    const tableRows = entries
      .map((r) => {
        const [head, enSlug, gloss, tags, ipa] = r;
        return `<tr>
          <td><a href="/vi/tu/${esc(enSlug)}/"><strong>${esc(head)}</strong></a>${ipa ? `<br><span class="word-ipa" style="font-size:.85rem">${esc(ipa)}</span>` : ''}</td>
          <td>${badgeChipsHtml(tags)}<div style="font-size:.8rem;color:var(--muted);margin-top:4px">${esc(registerGuide(tags))}</div></td>
          <td>${esc(gloss)}<div style="margin-top:4px;font-size:.82rem"><a href="/vi/tu/${esc(enSlug)}/">Xem ví dụ &amp; cách dùng →</a> · <a href="/?q=${encodeURIComponent(head)}">Tra offline ↗</a></div></td>
        </tr>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(capTerm)} tiếng Anh là gì? ${entries.length} từ &amp; cụm từ (${esc(topWords.slice(0, 3).join(', '))}) | HọcTA</title>
<meta name="description" content="${esc(directAnswerText.slice(0, 158))}">
<link rel="canonical" href="${pageUrl}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="HọcTA">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${esc(capTerm)} tiếng Anh là gì? Phân biệt ${esc(topWords.slice(0, 3).join(', '))} | HọcTA">
<meta property="og:description" content="${esc(directAnswerText.slice(0, 158))}">
<meta property="og:image" content="https://hocta.app/vi/images/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://hocta.app/vi/images/og-default.jpg">
<link rel="icon" href="/favicon.ico">
<meta name="theme-color" content="#293CC8">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${jsonld}</script>
<script defer src="/js/section-switcher.js"></script>
<style>
.vien-answer-box{border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:10px;background:var(--paper);padding:16px 18px;margin:14px 0 22px}
.vien-table-wrap{overflow-x:auto;margin:16px 0 24px;border:1px solid var(--line);border-radius:10px;background:var(--paper)}
.vien-table{width:100%;border-collapse:collapse;font-size:.94rem}
.vien-table th,.vien-table td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.vien-table th{background:var(--soft);font-weight:800}
.vien-table tr:last-child td{border-bottom:0}
</style>
</head>
<body class="word-page">
${navHtml('viet-anh')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/viet-anh/">Từ điển Việt–Anh</a> › <span aria-current="page">${esc(capTerm)}</span></nav>
<main class="page">
  <p class="word-kicker">Từ điển Việt–Anh theo trình độ &amp; ngữ cảnh</p>
  <h1 style="font-size:2.2rem">“${esc(capTerm)}” tiếng Anh là gì?</h1>

  <section class="vien-answer-box" aria-label="Tóm tắt nhanh">
    <p style="margin:0"><strong>Trả lời nhanh:</strong> Trong tiếng Anh, <strong>“${esc(term)}”</strong> được diễn đạt bằng <strong>${entries.length} từ và cụm từ</strong> tùy trình độ và ngữ cảnh, tiêu biểu là ${entries.slice(0, 4).map((r) => `<a href="/vi/tu/${esc(r[1])}/"><strong>${esc(r[0])}</strong></a>${r[4] ? ` (${esc(r[4])})` : ''}`).join(', ')}. ${academicChoices.length ? `Trong bài viết học thuật / IELTS Writing, nên ưu tiên <strong>${esc(academicChoices.join(', '))}</strong>.` : ''}</p>
  </section>

  <h2>Bảng so sánh ${entries.length} từ tiếng Anh nghĩa là “${esc(term)}”</h2>
  <div class="vien-table-wrap">
    <table class="vien-table">
      <thead>
        <tr>
          <th>Từ / Cụm từ tiếng Anh</th>
          <th>Trình độ &amp; Ngữ cảnh</th>
          <th>Sắc thái nghĩa tiếng Việt &amp; Ví dụ</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <section class="word-note faq-sec">
    <h2>Câu hỏi thường gặp khi dịch “${esc(term)}” sang tiếng Anh</h2>
    <details open>
      <summary>${esc(faq1Q)}</summary>
      <p>${esc(faq1A)}</p>
    </details>
    <details open>
      <summary>${esc(faq2Q)}</summary>
      <p>${esc(faq2A)}</p>
    </details>
  </section>

  ${(relatedCompares.length || relatedSyns.length) ? `<section class="related">
    <h2>Phân biệt &amp; Đồng nghĩa liên quan</h2>
    <div class="related-list">
      ${relatedCompares.map((c) => `<a class="related-chip" href="/vi/phan-biet/${esc(c)}/">⚖️ Phân biệt ${esc(c.replace(/-vs-/g, ' vs '))} →</a>`).join('\n      ')}
      ${relatedSyns.map((r) => `<a class="related-chip" href="/vi/dong-nghia/${esc(r[1])}/">🔄 Từ đồng nghĩa của ${esc(r[0])} →</a>`).join('\n      ')}
    </div>
  </section>` : ''}

  <section class="related">
    <h2>Mục từ Việt–Anh liên quan</h2>
    <div class="related-list">
      ${neighbors.map((n) => `<a class="related-chip" href="/vi/viet-anh/${esc(n.slug)}/">🇻🇳→🇬🇧 ${esc(n.term)} (${n.entries.length} từ) →</a>`).join('\n      ')}
      <a class="related-chip" href="/vi/viet-anh/">Xem toàn bộ Từ điển Việt–Anh →</a>
    </div>
  </section>

  <div class="word-cta">
    <div class="word-cta-actions">
      <a class="word-cta-btn" href="/?q=${encodeURIComponent(entries[0][0])}">Luyện &amp; lưu từ “${esc(entries[0][0])}” trong App offline ↗</a>
      <a class="word-cta-btn word-cta-btn-practice" href="/vi/viet-anh/">Tra mục Việt–Anh khác →</a>
    </div>
    <p class="word-cta-note">App HọcTA hỗ trợ tra cả Việt→Anh lẫn Anh→Việt 100% offline, ôn tập ngắt quãng FSRS miễn phí.</p>
  </div>
</main>
<footer class="blog-footer">
  <p><a href="/vi/">HọcTA</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p>
</footer>
</body>
</html>`;

    const outDir = path.join(VIET_ANH_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  });

  // Remove stale concept directories no longer in the clean cluster set
  const activeSlugs = new Set(clusters.map((c) => c.slug));
  let removed = 0;
  if (fs.existsSync(VIET_ANH_DIR)) {
    for (const d of fs.readdirSync(VIET_ANH_DIR, { withFileTypes: true })) {
      if (d.isDirectory() && !activeSlugs.has(d.name)) {
        fs.rmSync(path.join(VIET_ANH_DIR, d.name), { recursive: true, force: true });
        removed++;
      }
    }
  }

  console.log(`Built ${clusters.length} static /vi/viet-anh/<slug>/ concept pages (removed ${removed} stale dirs, 0 accent collisions).`);
  return wordToConcepts;
}

function injectReverseLinksIntoWordPages(wordToConcepts) {
  let injected = 0;
  const dirs = fs.readdirSync(TU_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of dirs) {
    const enSlug = d.name;
    if (['evaluate', 'economical', 'sustain'].includes(enSlug)) continue;
    const p = path.join(TU_DIR, enSlug, 'index.html');
    if (!fs.existsSync(p)) continue;
    let html = fs.readFileSync(p, 'utf8');
    const hadOld = html.includes('vien-backlinks');
    if (hadOld) {
      html = html.replace(/<section class="related vien-backlinks">[\s\S]*?<\/section>\n?/g, '');
    }
    const concepts = wordToConcepts.get(enSlug);
    if (!concepts || !concepts.length) {
      if (hadOld) fs.writeFileSync(p, html, 'utf8');
      continue;
    }

    const chips = concepts
      .map((c) => `<a class="related-chip" href="/vi/viet-anh/${esc(c.slug)}/">🇻🇳→🇬🇧 “${esc(c.term)}” tiếng Anh là gì? →</a>`)
      .join(' ');
    const block = `<section class="related vien-backlinks"><h2>Diễn đạt cùng ý tiếng Việt</h2><div class="related-list">${chips}</div></section>\n`;

    const anchor = '<p class="upd"';
    const pos = html.indexOf(anchor);
    if (pos !== -1) {
      html = html.slice(0, pos) + block + html.slice(pos);
      fs.writeFileSync(p, html, 'utf8');
      injected++;
    }
  }
  console.log(`Injected two-way Việt–Anh internal links into ${injected} /vi/tu/<word>/ pages.`);
}

function buildHtmlPage(payload, clusters) {
  const clusterBySlug = new Map(clusters.map((c) => [c.slug, c]));
  const curatedSlugs = [
    'danh-gia', 'ben-vung', 'tiet-kiem', 'giai-quyet', 'anh-huong',
    'duy-tri', 'tu-bo', 'can-kiet', 'dong-y', 'thuc-day'
  ];
  const curatedTopics = curatedSlugs
    .map((slug) => clusterBySlug.get(slug))
    .filter(Boolean)
    .map((c) => ({
      q: c.term,
      slug: c.slug,
      label: `${c.term} → ${c.entries.slice(0, 2).map((r) => r[0]).join(', ')}`
    }));

  const jsonld = safeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Từ điển Việt–Anh theo trình độ & ngữ cảnh (IELTS / TOEIC / Giao tiếp) | HọcTA',
        url: 'https://hocta.app/vi/viet-anh/',
        inLanguage: 'vi',
        description: `Từ điển Việt–Anh với ${clusters.length.toLocaleString('vi-VN')} mục từ tiếng Việt đối chiếu sang ${payload.count.toLocaleString('vi-VN')} từ và cụm từ tiếng Anh theo cấp độ CEFR B1–C1, IELTS Core, AWL.`
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://hocta.app/vi/' },
          { '@type': 'ListItem', position: 2, name: 'Từ điển', item: 'https://hocta.app/vi/tu/' },
          { '@type': 'ListItem', position: 3, name: 'Từ điển Việt–Anh', item: 'https://hocta.app/vi/viet-anh/' }
        ]
      }
    ]
  });

  // Group all concept pages by true Vietnamese Alphabet (A, Ă, Â, B, C, D, Đ, E, Ê...)
  const byLetter = new Map();
  const sortedByAlpha = [...clusters].sort((a, b) => a.term.localeCompare(b.term, 'vi'));
  for (const c of sortedByAlpha) {
    const letter = viInitialLetter(c.term);
    if (!byLetter.has(letter)) byLetter.set(letter, []);
    byLetter.get(letter).push(c);
  }
  const letters = VI_ALPHA_ORDER.filter((L) => byLetter.has(L));
  const directoryHtml = letters
    .map((L) => {
      const list = byLetter.get(L);
      const itemsHtml = list
        .map((c) => {
          const sampleEn = c.entries.slice(0, 3).map((r) => r[0]).join(', ');
          return `<li><a href="/vi/viet-anh/${esc(c.slug)}/"><strong>${esc(c.term)}</strong></a> <span style="color:var(--muted);font-size:.84rem">→ ${esc(sampleEn)}${c.entries.length > 3 ? ` (+${c.entries.length - 3})` : ''}</span></li>`;
        })
        .join('\n        ');
      return `<details class="vien-alpha-group"${['A', 'B', 'C', 'Đ'].includes(L) ? ' open' : ''}>
      <summary><strong>Vần ${esc(L)}</strong> <span style="color:var(--muted);font-weight:400">(${list.length} mục từ Việt → Anh)</span></summary>
      <ul class="vien-dir-list">
        ${itemsHtml}
      </ul>
    </details>`;
    })
    .join('\n    ');

  // Pre-render the 12 flagship/top Vietnamese->English cards statically in HTML for instant paint & SEO
  const staticCardsHtml = clusters.slice(0, 12).map((c) => {
    const pills = c.entries.slice(0, 5).map((r) => {
      const [enWord, enSlug, , tags, ipa] = r;
      const cefr = (tags.match(/\b[A-C][12]\b/) || [])[0] || '';
      const badge = tags.includes('IELTS') ? 'IELTS' : tags.includes('AWL') ? 'AWL' : tags.includes('PHRASE') ? 'Cụm từ' : '';
      const meta = [cefr ? `~${cefr}` : '', badge].filter(Boolean).join(' · ');
      return `<a class="vien-en-pill" href="/vi/tu/${esc(enSlug)}/"><strong>${esc(enWord)}</strong>${ipa ? ` <span class="vien-ipa">${esc(ipa)}</span>` : ''}${meta ? ` <span class="vien-pill-tag">${esc(meta)}</span>` : ''}</a>`;
    }).join(' ');
    return `<div class="vien-card">
      <div class="vien-card-head">
        <a class="vien-vi-head" href="/vi/viet-anh/${esc(c.slug)}/">🇻🇳 ${esc(c.term)}</a>
        <a class="vien-compare-link" href="/vi/viet-anh/${esc(c.slug)}/">So sánh ${c.entries.length} từ tiếng Anh →</a>
      </div>
      <div class="vien-en-list">${pills}</div>
    </div>`;
  }).join('\n    ');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Từ điển Việt–Anh theo trình độ &amp; ngữ cảnh (IELTS / TOEIC / Giao tiếp) | HọcTA</title>
<meta name="description" content="Từ điển Việt–Anh với ${clusters.length.toLocaleString('vi-VN')} mục từ tiếng Việt đối chiếu sang ${payload.count.toLocaleString('vi-VN')} từ và cụm từ tiếng Anh theo cấp độ CEFR B1–C1, IELTS Academic, AWL.">
<link rel="canonical" href="https://hocta.app/vi/viet-anh/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="HọcTA">
<meta property="og:url" content="https://hocta.app/vi/viet-anh/">
<meta property="og:title" content="Từ điển Việt–Anh theo trình độ &amp; ngữ cảnh | HọcTA">
<meta property="og:description" content="Đang viết câu tiếng Anh mà bí từ? Gõ nghĩa tiếng Việt để tìm ngay từ đơn và cụm từ tiếng Anh chuẩn theo cấp độ B1–C1, IELTS, TOEIC.">
<meta property="og:image" content="https://hocta.app/vi/images/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://hocta.app/vi/images/og-default.jpg">
<link rel="icon" href="/favicon.ico">
<meta name="theme-color" content="#293CC8">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${jsonld}</script>
<script defer src="/js/section-switcher.js"></script>
<style>
.vien-search-box{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 12px}
.vien-search-box input{flex:1;min-width:220px;min-height:46px;padding:0 14px;border:2px solid var(--teal);border-radius:10px;font-size:1.05rem;background:var(--paper);color:var(--ink)}
.vien-search-box select{min-height:46px;padding:0 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:var(--paper);color:var(--ink)}
.vien-quick-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
.vien-quick-chip{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;padding:5px 12px;font-size:.83rem;font-weight:600;cursor:pointer;text-decoration:none}
.vien-quick-chip:hover{border-color:var(--teal);color:var(--teal)}
.vien-grid{display:grid;grid-template-columns:1fr;gap:12px;margin:14px 0 28px}
.vien-card{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink)}
.vien-card:hover{border-color:var(--teal)}
.vien-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.vien-vi-head{font-size:1.22rem;font-weight:800;color:var(--ink);text-decoration:none}
.vien-vi-head:hover{color:var(--teal);text-decoration:underline}
.vien-compare-link{font-size:.84rem;font-weight:700;color:var(--teal);text-decoration:none}
.vien-compare-link:hover{text-decoration:underline}
.vien-en-list{display:flex;flex-wrap:wrap;gap:8px}
.vien-en-pill{display:inline-flex;align-items:baseline;gap:5px;padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--ink);text-decoration:none;font-size:.93rem}
.vien-en-pill strong{color:var(--teal);font-weight:800}
.vien-en-pill:hover{border-color:var(--teal)}
.vien-ipa{font-size:.82rem;color:var(--muted)}
.vien-pill-tag{font-size:.73rem;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(41,60,200,.14);color:var(--teal)}
.vien-dir-list{columns:2 260px;column-gap:24px;padding-left:18px;line-height:1.85;margin:10px 0 4px}
.vien-alpha-group{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0;background:var(--paper)}
.vien-alpha-group summary{cursor:pointer}
</style>
</head>
<body class="word-page">
${navHtml('viet-anh')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Từ điển Việt–Anh</span></nav>
<main class="page">
  <p class="word-kicker">Từ điển Việt–Anh theo ngữ cảnh</p>
  <h1 style="font-size:2.3rem">Từ điển Việt → Anh cho Viết &amp; Nói</h1>
  <p>Đang viết bài luận IELTS, email công việc hay tập nói tiếng Anh mà nghĩ ra ý tiếng Việt nhưng bí từ tiếng Anh? Gõ <strong>mục từ tiếng Việt</strong> (có dấu hoặc không dấu, ví dụ: <em>đánh giá</em>, <em>bền vững</em>, <em>giải quyết</em>) để đối chiếu ngay các <strong>từ đơn &amp; cụm từ tiếng Anh tương ứng</strong> theo đúng trình độ (<strong>B1–C1, IELTS Core, Học thuật AWL, Cụm từ</strong>).</p>

  <div class="vien-search-box">
    <input id="vien-q" type="search" placeholder="Gõ mục từ tiếng Việt (vd: đánh giá, bền vững, giải quyết, bảo thủ…)" aria-label="Nhập mục từ tiếng Việt để tìm từ tiếng Anh" autocomplete="off" autofocus>
    <select id="vien-filter" aria-label="Lọc theo nhóm từ tiếng Anh">
      <option value="">Tất cả trình độ (${clusters.length.toLocaleString('vi-VN')} mục Việt–Anh)</option>
      <option value="IELTS">Có từ IELTS Core</option>
      <option value="AWL">Có từ Học thuật (AWL)</option>
      <option value="PHRASE">Có Cụm từ &amp; Phrasal verbs</option>
      <option value="C1">Trình độ ~C1</option>
      <option value="B2">Trình độ ~B2</option>
      <option value="B1">Trình độ ~B1</option>
    </select>
  </div>

  <div class="vien-quick-chips" aria-label="Các mục từ Việt–Anh tiêu biểu">
    ${curatedTopics.map((t) => `<a class="vien-quick-chip" href="/vi/viet-anh/${t.slug}/" data-q="${t.q}">🇻🇳 ${t.label}</a>`).join('\n    ')}
  </div>

  <p id="vien-status" style="color:var(--muted);font-size:.9rem" role="status" aria-live="polite">Các mục từ Việt → Anh tiêu biểu (gõ tiếng Việt vào ô trên để tra trong ${clusters.length.toLocaleString('vi-VN')} mục từ Việt–Anh):</p>
  <div id="vien-results" class="vien-grid">
    ${staticCardsHtml}
  </div>

  <section class="word-note" style="margin-top:32px">
    <h2>Danh mục ${clusters.length.toLocaleString('vi-VN')} mục từ Việt–Anh theo bảng chữ cái Tiếng Việt (A–Y)</h2>
    <p style="color:var(--muted);font-size:.92rem">Được sắp xếp đúng chuẩn bảng chữ cái Tiếng Việt (tách riêng <strong>A / Ă / Â, D / Đ, E / Ê, O / Ô / Ơ, U / Ư</strong>) — mỗi trang phân tích các từ tiếng Anh tương ứng theo cấp độ Giao tiếp (A2–B1), Cụm động từ và Học thuật / IELTS (B2–C1):</p>
    ${directoryHtml}
  </section>

  <div class="word-cta">
    <div class="word-cta-actions">
      <a class="word-cta-btn" href="/">Mở App HọcTA (tra cả Việt–Anh &amp; Anh–Việt offline) ↗</a>
      <a class="word-cta-btn word-cta-btn-practice" href="/vi/tu/">Chuyển sang Từ điển Anh–Việt (${payload.count.toLocaleString('vi-VN')} từ) →</a>
    </div>
    <p class="word-cta-note">Trong app HọcTA, bạn cũng có thể gõ trực tiếp tiếng Việt vào ô tìm kiếm chính để tra ngược Việt → Anh ngay cả khi đang ở chế độ máy bay.</p>
  </div>
</main>
<footer class="blog-footer">
  <p><a href="/vi/">HọcTA</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p>
</footer>
<script>
(function(){
  var qInput = document.getElementById('vien-q');
  var filterSel = document.getElementById('vien-filter');
  var statusEl = document.getElementById('vien-status');
  var resultsEl = document.getElementById('vien-results');
  var concepts = null;

  function foldVi(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9\\s-]/g, ' ')
      .replace(/\\s+/g, ' ').trim();
  }

  function renderViEnCards() {
    if (!concepts) return;
    var rawQ = (qInput.value || '').trim().toLowerCase();
    var foldedQ = foldVi(rawQ);
    var tagFilter = filterSel.value;
    var matches = [];

    for (var i = 0; i < concepts.length; i++) {
      var c = concepts[i];
      var viTerm = c[0], viSlug = c[1], enList = c[2], totalCount = c[3] || enList.length, viFold = c[4] || '';

      var filteredEn = tagFilter
        ? enList.filter(function(r) { return (' ' + (r[3] || '') + ' ').indexOf(' ' + tagFilter + ' ') !== -1; })
        : enList;
      if (!filteredEn.length) continue;

      if (!rawQ) {
        matches.push({ c: c, enList: filteredEn, totalCount: tagFilter ? filteredEn.length : totalCount, score: 1 });
        if (matches.length >= 24) break;
        continue;
      }

      var score = 0;
      if (viTerm === rawQ) score = 120;
      else if (viTerm.indexOf(rawQ) === 0) score = 100;
      else if (viTerm.indexOf(' ' + rawQ) !== -1) score = 90;
      else if (viTerm.indexOf(rawQ) !== -1) score = 80;
      else if (foldedQ.length >= 2 && viFold === foldedQ) score = 85;
      else if (foldedQ.length >= 2 && (viFold.indexOf(foldedQ) === 0 || viFold.indexOf(' ' + foldedQ) !== -1)) score = 70;
      else if (foldedQ.length >= 3 && viFold.indexOf(foldedQ) !== -1) score = 55;
      else {
        for (var j = 0; j < filteredEn.length; j++) {
          if (filteredEn[j][0].toLowerCase().indexOf(rawQ) !== -1 || filteredEn[j][4].toLowerCase().indexOf(rawQ) !== -1) {
            score = 45;
            break;
          }
        }
      }

      if (score > 0) {
        matches.push({ c: c, enList: filteredEn, totalCount: tagFilter ? filteredEn.length : totalCount, score: score + Math.min(8, filteredEn.length) });
      }
    }

    if (rawQ) {
      matches.sort(function(a, b) { return b.score - a.score || a.c[0].localeCompare(b.c[0], 'vi'); });
    }
    var top = matches.slice(0, 24);
    statusEl.textContent = rawQ
      ? ('Tìm thấy ' + matches.length + ' mục từ Việt → Anh cho “' + qInput.value.trim() + '”' + (matches.length > 24 ? ' (hiển thị 24 mục sát nhất)' : ''))
      : ('Hiển thị ' + top.length + ' mục từ Việt → Anh — gõ tiếng Việt vào ô trên hoặc duyệt theo vần A–Y bên dưới.');

    resultsEl.innerHTML = '';
    top.forEach(function(m) {
      var viTerm = m.c[0], viSlug = m.c[1], enList = m.enList, totalCount = m.totalCount;
      var conceptUrl = '/vi/viet-anh/' + viSlug + '/';

      var card = document.createElement('div');
      card.className = 'vien-card';

      var headDiv = document.createElement('div');
      headDiv.className = 'vien-card-head';
      var viA = document.createElement('a');
      viA.className = 'vien-vi-head';
      viA.setAttribute('hr' + 'ef', conceptUrl);
      viA.textContent = '🇻🇳 ' + viTerm;

      var cmpA = document.createElement('a');
      cmpA.className = 'vien-compare-link';
      cmpA.setAttribute('hr' + 'ef', conceptUrl);
      cmpA.textContent = 'So sánh ' + totalCount + ' từ tiếng Anh →';
      headDiv.append(viA, cmpA);

      var listDiv = document.createElement('div');
      listDiv.className = 'vien-en-list';

      enList.slice(0, 6).forEach(function(r) {
        var enWord = r[0], enSlug = r[1], ipa = r[2], tags = r[3] || '';
        var pill = document.createElement('a');
        pill.className = 'vien-en-pill';
        pill.setAttribute('hr' + 'ef', '/vi/tu/' + enSlug + '/');

        var st = document.createElement('strong');
        st.textContent = enWord;
        pill.appendChild(st);

        if (ipa) {
          var ip = document.createElement('span');
          ip.className = 'vien-ipa';
          ip.textContent = ipa;
          pill.appendChild(ip);
        }

        var cefrMatch = tags.match(/\\b[A-C][12]\\b/);
        var cefr = cefrMatch ? '~' + cefrMatch[0] : '';
        var badge = tags.indexOf('IELTS') !== -1 ? 'IELTS' : tags.indexOf('AWL') !== -1 ? 'AWL' : tags.indexOf('PHRASE') !== -1 ? 'Cụm từ' : '';
        var meta = [cefr, badge].filter(Boolean).join(' · ');
        if (meta) {
          var tg = document.createElement('span');
          tg.className = 'vien-pill-tag';
          tg.textContent = meta;
          pill.appendChild(tg);
        }

        listDiv.appendChild(pill);
      });

      card.append(headDiv, listDiv);
      resultsEl.appendChild(card);
    });
  }

  fetch('/data/vi-en-concepts.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      concepts = (data.concepts || []).map(function(c) {
        c[4] = foldVi(c[0]);
        return c;
      });
      var urlQ = new URLSearchParams(location.search).get('q');
      if (urlQ) {
        qInput.value = urlQ;
        renderViEnCards();
      }
    })
    .catch(function() {});

  qInput.addEventListener('input', renderViEnCards);
  filterSel.addEventListener('change', renderViEnCards);
})();
</script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
  fs.writeFileSync(OUT_HTML, html, 'utf8');
  console.log(`Wrote ${OUT_HTML}`);
}

const payload = buildIndex();
const clusters = extractConceptClusters(payload);
const wordToConcepts = buildConceptPages(clusters);
injectReverseLinksIntoWordPages(wordToConcepts);
buildHtmlPage(payload, clusters);
