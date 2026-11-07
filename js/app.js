import { MDict } from './mdict.js';
import { openDb, putFile, getFile, delFile, putReview, allReviews, putTutorRecord, getTutorRecord, allTutorRecords, deleteTutorRecord, clearTutorRecords } from './db.js';
import { askTutor, getAiSettings, saveAiSettings, clearAiSettings, PROVIDERS } from './ai-client.js';
import { validateTutorPhrases, validateTutorFeedback, validateTutorSituation } from './tutor-validation.js';
import { TUTOR_PHRASE_INSTRUCTIONS, TUTOR_FEEDBACK_INSTRUCTIONS, TUTOR_SITUATION_INSTRUCTIONS, makeTutorSituationPayload } from './tutor-prompts.js';
import { rankTutorPhrases } from './tutor-selection.js';
import { getTutorCache, setTutorCache, clearTutorCache } from './tutor-cache.js';
import {
  SRS_INTERVALS_DAYS,
  parseDeckRows,
  formatDeckCell,
  makeItem,
  normalizeText,
  allItems,
  addItem,
  putItem,
  putItems,
  deleteItem,
  migrateLegacyData,
  repairMigratedSentenceSchedule,
  importItems,
  knownState,
  setKnownLevel,
  resetKnown,
  knownRecordsForExport,
  fsrsInitStability,
  fsrsInitDifficulty,
  fsrsNextDifficulty,
  fsrsRetrievability,
  fsrsRecallStability,
  fsrsForgetStability,
  fsrsShortTermStability,
  warmInitFsrs,
  applyFsrsWeights,
  resetFsrsWeights,
} from './store.js';
import { parseEpub } from './epub.js';
import { parsePdf } from './pdf.js';
import { initOfflineStudy, exportOfflineStudy, importOfflineStudy } from './offline-study.js';

const SLOTS = {
  // Slot keys are historical (oxford/longman) — the LABELS below must name the
  // open-licensed dictionaries actually bundled in a public deployment, never
  // trademarks of data the app does not ship.
  oxford: { label: 'WordNet', accent: '#b91c1c' },
  longman: { label: 'Wiktionary', accent: '#1d4ed8' },
  // optional 3rd slot — no bundled default; load your own .mdx or the open EN–VI
  third: { label: 'Slot 3', accent: '#7c3aed' },
};

const state = {
  dicts: { oxford: null, longman: null }, // {mdx, mdd, cssCache, blobUrls}
  loading: { oxford: false, longman: false }, // a download is currently in progress for this slot
  history: JSON.parse(localStorage.getItem('history') || '[]'),
  // Phase 3 Release A: saved words + sentences are LearningItems in IndexedDB
  // (js/store.js) — loaded at boot. localStorage vocab/sentences keys remain
  // untouched as the pre-migration rollback copy.
  items: [],
  itemsReady: false,
  // C15: a ?q= handoff search that could not run yet (no dictionary loaded).
  // Replayed once the boot dictionary restore has finished.
  pendingQuery: null,
  // v117 A2: known-words baseline — { records, words:Set, highest } (store.js
  // knownState()); null until boot loads it. Words here are NOT vault items.
  known: null,
};

let loadAbort = null; // AbortController for the current default-dictionary download run
let firstLoadTotal = 0; // probed total size of the default dictionaries (0 = unknown)
let dataUnreachable = false; // probe found NO reachable dictionary source — empty state must say so
const progressTrackers = new Map(); // slot -> {t, received, total, speed}

/** Rolling speed/ETA tracker (exponential smoothing over ~sample windows). */
function trackProgress(slot, received, total) {
  const now = Date.now();
  const prev = progressTrackers.get(slot);
  let speed = prev?.speed || 0;
  if (prev && now > prev.t && received >= prev.received) {
    const inst = (received - prev.received) / ((now - prev.t) / 1000);
    if (isFinite(inst) && inst >= 0) speed = speed ? speed * 0.6 + inst * 0.4 : inst;
  }
  progressTrackers.set(slot, { t: now, received, total, speed });
  return {
    speed,
    eta: total && speed > 0 && received < total ? (total - received) / speed : 0,
  };
}

function fmtEta(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 90) return `≈ ${Math.max(1, Math.round(seconds))} s left`;
  return `≈ ${Math.ceil(seconds / 60)} min left`;
}

function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/** The figures of ONE sample, e.g. "30% (531.9 MB of 1.72 GB) · 2.4 MB/s · ≈ 9 min left".
 *  Pure on purpose (speed comes in as an argument): the first-load card renders the
 *  SAME numbers as the panel line, and a second trackProgress() for the same byte
 *  count would be a zero-progress window that shrinks the smoothed speed. */
function fmtProgressFigures(received, total, speed) {
  let out = total ? Math.round((received / total) * 100) + '%' : '';
  out += ` (${fmtSize(received)}${total ? ' of ' + fmtSize(total) : ''})`;
  if (speed > 0 && received > 0) out += ` · ${(speed / 1048576).toFixed(1)} MB/s`;
  const eta = total && speed > 0 && received < total ? (total - received) / speed : 0;
  const e = fmtEta(eta);
  if (e) out += ` · ${e}`;
  return out;
}

/** Human progress line with CORRECT units, e.g. "30% (531.9 MB of 1.72 GB) · 2.4 MB/s · ≈ 9 min left" */
function fmtProgress(slot, received, total) {
  const { speed } = trackProgress(slot, received, total);
  return fmtProgressFigures(received, total, speed);
}

// Bundled dictionary data version — bump whenever the bundled defaults change,
// so browsers self-migrate stale persisted copies.
const BUNDLE_DATA_VERSION = 6;
// Old (open-licensed) bundled mdx names that must be replaced by the real defaults.
const BUNDLED_NAMES = ['wordnet31.mdx', 'gcide.mdx', 'anh-viet-open.mdx', 'simple-en.mdx'];
const DEFAULT_DICTS = {
  oxford: {
    url: 'dicts/oald10.mdx',
    name: 'oald10.mdx',
    mddUrl: 'dicts/oald10.mdd',
    mddName: 'oald10.mdd',
    label: 'Oxford (OALD)',
  },
  longman: {
    url: 'dicts/ldoce6.mdx',
    name: 'ldoce6.mdx',
    mddUrl: 'dicts/ldoce6.mdd',
    mddName: 'ldoce6.mdd',
    // LDOCE6's .mdd packs css/js inside a 7z archive, so the stylesheet ships
    // alongside the dictionaries and is injected into every entry.
    cssUrl: 'dicts/ldoce6.css',
    label: 'Longman (LDOCE)',
  },
};

// Public deployments (e.g. Netlify) exclude the copyrighted dicts/ data entirely —
// when the defaults are missing, gracefully fall back to the bundled open-licensed
// dictionaries instead of showing load errors.
const FALLBACK_DICTS = {
  oxford: { url: 'samples/wordnet31.mdx', name: 'wordnet31.mdx' },
  longman: { url: 'samples/simple-en.mdx', name: 'simple-en.mdx' },
};

// The OALD10/LDOCE6 options above stay HIDDEN until a deployment actually serves
// dicts/ — a public build must never request those URLs, every one of them is a
// guaranteed 404 from the very first load. While this is false the open-licensed
// fallbacks ARE the defaults (probed, named and licensed as such, with zero
// dicts/ traffic). Flip to true ONLY in a deployment that ships dicts/.
const SHIP_COMMERCIAL_DEFAULTS = false;
/** The default dictionary THIS deployment offers for a slot: the commercial
 *  default when shipped, otherwise the open-licensed fallback. */
const defaultDictOf = (slot) =>
  (SHIP_COMMERCIAL_DEFAULTS && DEFAULT_DICTS[slot]) || FALLBACK_DICTS[slot] || null;

// The optional remote-config.json data-source mechanism was removed:
// the public deployment ships only the open-licensed samples and users load
// their own .mdx via ⚙ Advanced.

async function getBundleVer() {
  const b = await getFile('bundle-version');
  if (!b) return 0;
  try { return parseInt(await b.text(), 10) || 0; } catch (e) { return 0; }
}

const $ = (sel) => document.querySelector(sel);
const TTS_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;
/* Speech recognition (Phase 6 R4): the browser's OWN Web Speech API, one shot.
 * No key, no server of ours — on Chrome the audio goes to Google, on Safari to
 * Apple (the mic buttons' tooltips say so). Hidden everywhere when unsupported. */
const SR_CLASS = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition) || null;
/** One-shot recognition, en-US. `cb({ ok, heard })` fires exactly once. */
function recognizeOnce(cb) {
  if (!SR_CLASS) { cb({ ok: false, heard: '', error: 'unsupported' }); return () => {}; }
  let settled = false;
  const done = (r) => { if (!settled) { settled = true; clearTimeout(guard); cb(r); } };
  let rec = null;
  const guard = setTimeout(() => { try { rec && rec.abort(); } catch (e) {} done({ ok: false, heard: '', error: 'timeout' }); }, 10000);
  try {
    rec = new SR_CLASS();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      const alt = e.results && e.results[0] ? Array.from(e.results[0]).map((x) => x.transcript || '') : [];
      done({ ok: true, heard: alt.join(' / ') });
    };
    rec.onerror = (e) => done({ ok: false, heard: '', error: (e && e.error) || 'error' });
    rec.onend = () => done({ ok: false, heard: '', error: 'no-speech' });
    rec.start();
  } catch (e) { done({ ok: false, heard: '', error: 'start-failed' }); }
  return () => { try { rec && rec.abort(); } catch (e) {} };
}
/** Does the spoken transcript match the target word/phrase? Exact normalized
 *  equality, or the normalized transcript contains the target at a boundary. */
function spokenMatch(target, transcript) {
  const t = normalizeText(target);
  const heard = normalizeText(transcript || '');
  if (!t || !heard) return false;
  if (heard === t) return true;
  return new RegExp('(^|[^\\p{L}\\p{N}\'-])' + escapeRegExp(t) + '($|[^\\p{L}\\p{N}\'-])', 'iu').test(heard);
}

/** v76: sentence-level check for drills whose target is a whole sentence — the
 *  share of the target's words spoken at word boundaries IN ORDER. Recognition
 *  on long sentences always drops words, so the old exact-containment match
 *  failed every realistic attempt; ≥0.8 coverage reads as "said it". */
function spokenCoverage(target, transcript) {
  const heardRaw = normalizeText(transcript || '');
  const words = normalizeText(target).split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  if (!words.length || !heardRaw) return 0;
  const heard = ' ' + heardRaw + ' ';
  let at = 0, hits = 0;
  for (const w of words) {
    const m = new RegExp('(^|[^\\p{L}\\p{N}\'-])' + escapeRegExp(w) + '($|[^\\p{L}\\p{N}\'-])', 'iu').exec(heard.slice(at));
    if (m) { hits++; at += m.index + m[0].length - 1; } // -1 keeps the trailing boundary char for the next word
  }
  return hits / words.length;
}

/* ---------- v76: cue card — prompt + 1:00 prep + 2:00 speak, browser's own
 * recognition reads the attempt back. Session state only; nothing persisted,
 * nothing scored (free speech has no single right answer). ---------- */
const CUE_PREP = 60, CUE_SPEAK = 120;
const CUE_PROMPTS = [
  'Describe a place you like to go to relax.', 'Describe a person who has influenced you.',
  'Talk about a book or article that changed how you think.', 'Describe a skill you would like to learn.',
  'Talk about a decision you made that was difficult.', 'Describe a meal you enjoyed recently.',
  'Talk about a habit you want to build.', 'Describe a time you helped someone.',
  'Talk about something you bought but rarely use.', 'Describe your favourite way to spend a free evening.',
  'Talk about a place in your city worth visiting.', 'Describe a piece of technology you use every day.',
  'Talk about a song or piece of music you love.', 'Describe a journey you remember well.',
  'Talk about a teacher you still remember.', 'Describe something surprising you learned recently.',
  'Talk about a photo that means a lot to you.', 'Describe a small thing that makes you happy.',
  'Talk about a goal you are working towards.', 'Describe a tradition in your family.',
  'Talk about a time you were wrong about something.', 'Describe an app or website you find useful.',
  'Talk about a friend you have known for a long time.', 'Describe what you would do with a free month.',
];
let cueCard = { idx: -1, phase: 'idle', deadline: 0, interval: null, stopRec: null };

/* v78: countdowns are DEADLINE-based (deadline − Date.now()), not per-tick
 * decrements — background-tab throttling fires setInterval late, which used to
 * make the prep clock fall behind the wall clock. */
const CUE_PREP_MS = CUE_PREP * 1000, CUE_SPEAK_MS = CUE_SPEAK * 1000;

function cueRemainingSec() {
  return Math.max(0, Math.ceil((cueCard.deadline - Date.now()) / 1000));
}

function cueClockLabel() {
  return cueCard.phase === 'speak'
    ? i18nFmt('practice.cueSpeak', { t: fmtJournalClock(cueRemainingSec()) })
    : i18nFmt('practice.cuePrep', { t: fmtJournalClock(cueRemainingSec()) });
}

function cueCardPaint() {
  const clock = $('#cue-clock');
  if (clock) clock.textContent = cueClockLabel();
  const start = $('#btn-cue-start');
  if (start) start.textContent = cueCard.phase === 'prep' ? i18n('practice.cueReady')
    : cueCard.phase === 'speak' ? i18n('practice.cueStop') : i18n('practice.cueStart');
  const mic = $('#btn-cue-mic');
  if (mic) mic.hidden = !(cueCard.phase === 'speak' && SR_CLASS);
}

function cueCardReset(msg) {
  if (cueCard.interval) clearInterval(cueCard.interval);
  if (cueCard.stopRec) { try { cueCard.stopRec(); } catch (e) {} }
  cueCard = { idx: cueCard.idx, phase: 'idle', deadline: 0, interval: null, stopRec: null };
  cueCardPaint();
  const res = $('#cue-result');
  if (res && msg) res.textContent = msg;
}

function cueCardNext() {
  let i = Math.floor(Math.random() * CUE_PROMPTS.length);
  if (CUE_PROMPTS.length > 1 && i === cueCard.idx) i = (i + 1) % CUE_PROMPTS.length;
  cueCard.idx = i;
  const p = $('#cue-prompt');
  if (p) p.textContent = CUE_PROMPTS[i];
  const res = $('#cue-result');
  if (res) res.textContent = '';
  cueCardReset();
}

function cueCardTick() {
  if (cueRemainingSec() > 0) { cueCardPaint(); return; }
  if (cueCard.phase === 'prep') {
    // prep over — roll straight into the speak window
    cueCard.phase = 'speak';
    cueCard.deadline = Date.now() + CUE_SPEAK_MS;
    cueCardPaint();
  } else {
    // speak window over — stop the clock but let an in-flight recording settle
    if (cueCard.interval) clearInterval(cueCard.interval);
    cueCard.interval = null;
    cueCard.phase = 'idle';
    cueCard.deadline = 0;
    cueCardPaint();
    const res = $('#cue-result');
    if (res && !res.textContent) res.textContent = i18n('practice.cueTimeUp');
  }
}

function cueCardToggle() {
  if (cueCard.phase === 'idle') {
    if (cueCard.idx < 0) cueCardNext();
    cueCard.phase = 'prep';
    cueCard.deadline = Date.now() + CUE_PREP_MS;
    cueCard.interval = setInterval(cueCardTick, 500);
    cueCardPaint();
  } else if (cueCard.phase === 'prep') {
    // v78: "I'm ready — speak now" — skipping the rest of the prep window
    cueCard.phase = 'speak';
    cueCard.deadline = Date.now() + CUE_SPEAK_MS;
    cueCardPaint();
  } else {
    cueCardReset();
  }
}

function cueCardRecord() {
  if (cueCard.phase !== 'speak') return;
  const res = $('#cue-result');
  cueCard.stopRec = recognizeOnce((out) => {
    cueCard.stopRec = null;
    if (res) res.textContent = out.ok
      ? i18nFmt('practice.cueHeard', { heard: out.heard, n: String(out.heard.trim().split(/\s+/).length) })
      : i18n('practice.micError');
  });
}

/* ---------- shared helpers ----------
 * escapeHtml lives here (not at the bottom of the file) because nearly every
 * render path needs it — utilities belong in the utility section. */
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Origins a message may come from. Every entry iframe is sandbox="allow-scripts"
 *  WITHOUT allow-same-origin, so its origin is opaque and browsers serialise it
 *  as the literal string "null" in postMessage events. We accept "null" (the
 *  legitimate frame origin) plus our own origin, and nothing else. */
const IFRAME_MESSAGE_ORIGINS = (() => {
  const list = [];
  try { if (location.origin && location.origin !== 'null') list.push(location.origin); } catch (e) { /* opaque origin */ }
  list.push('null');
  return list;
})();

/** Delete every persisted companion of a slot's dictionary. Without this,
 *  loading dictionary B into a slot that held A leaves A's .mdd/.css behind —
 *  and the boot restore then re-attaches that stale .mdd to B.
 *  keepCss: set when the user picked the .css by hand for this slot; attachDict
 *  still refuses to apply it unless its base name matches the .mdx. */
async function clearSlotCompanions(slot, { keepMdx = true, keepCss = false } = {}) {
  const keys = ['-mdd', '-mdx-meta'];
  if (!keepCss) keys.push('-css');
  if (!keepMdx) keys.unshift('-mdx');
  for (const suf of keys) {
    try { await delFile(slot + suf); } catch (e) { /* already gone */ }
  }
}

/** Release the object URLs a slot's entry still holds, so blobs never outlive
 *  the dictionary they came from. */
function revokeSlotUrls(slot) {
  const d = state.dicts[slot];
  if (!d || !d.blobUrls) return;
  for (const url of d.blobUrls.values()) {
    try { URL.revokeObjectURL(url); } catch (e) { /* already revoked */ }
  }
  d.blobUrls.clear();
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  // Reading navigator.serviceWorker itself can throw on opaque/sandboxed
  // origins, so the whole registration stays inside the try — the `in` guard
  // alone does not protect the property access.
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) { /* service worker unavailable (sandboxed/unsupported) */ }
  wireUi();
  setTheme(localStorage.getItem('theme') || 'auto');
  captureI18nOriginals();
  applyLang();
  updateNetBanner();
  $('#btn-open-help')?.addEventListener('click', () => $('#help-dialog').showModal());
  for (const [name, sel] of [['dicts', '#adv-tab-dicts'], ['data', '#adv-tab-data'], ['learning', '#adv-tab-learning']]) {
    $(sel)?.addEventListener('click', () => setAdvTab(name));
  }
  $('#btn-fsrs-optimize')?.addEventListener('click', optimizeFsrs);
  $('#btn-fsrs-reset')?.addEventListener('click', resetFsrsWeightsUi);
  $('#btn-open-advanced')?.addEventListener('click', () => { populateTutorSettings(); renderAdvStatus(); renderBackupManager(); renderKnownAdvanced(); $('#advanced-dialog').showModal(); });
  $('#btn-quickload')?.addEventListener('click', () => quickLoadOpenDicts(selectedFirstloadSlots()));
  // v91 chooser: "Download all" ticks every card, then runs the same pipeline
  $('#btn-download-all')?.addEventListener('click', () => {
    for (const s of CHOOSER_ORDER) { const c = document.getElementById('chk-firstload-' + s); if (c) c.checked = true; }
    updateFirstloadCta();
    quickLoadOpenDicts(selectedFirstloadSlots());
  });
  $('#btn-cancel-load')?.addEventListener('click', () => loadAbort?.abort());
  document.querySelectorAll('dialog .dialog-close').forEach((b) => {
    b.addEventListener('click', () => b.closest('dialog').close());
  });

  // Paint the shell immediately. Everything heavier (storage migration, saved
  // items, dictionary restore, first-run gate, maintenance) is deferred to idle
  // so it never blocks the first paint / LCP.
  renderHistory();
  setView(rememberedView());
  window.addEventListener('hashchange', () => applyView(currentView()));
  applyView(currentView());
  handleUrlHandoff(); // bookmarklet / external handoff (?q= / ?read=)

  const defer = (fn) => { setTimeout(fn, 0); };
  // Netlify's free-plan attribution badge is an iframe fixed bottom-right that
  // can overlap the mobile bottom-nav. Detect it and lift the nav clear of it
  // (we never hide the badge itself).
  const markNetlifyBadge = () => { if (document.getElementById('nl-badge-frame')) document.documentElement.classList.add('has-netlify-badge'); };
  markNetlifyBadge();
  window.addEventListener('load', markNetlifyBadge);
  setTimeout(markNetlifyBadge, 1200);

  defer(async () => {
    // v71: personalized FSRS weights — trained ON THIS DEVICE by the ⚙ Advanced
    // optimizer (js/fsrs-opt.js) and stored in the `files` store — replace the
    // defaults before anything can schedule a review. Observable marker on
    // <html data-fsrs-weights>: default | custom | default:invalid | default:error.
    try {
      const wb = await getFile('fsrs-custom-weights');
      if (wb) {
        const rec = JSON.parse(await wb.text());
        document.documentElement.dataset.fsrsWeights = applyFsrsWeights(rec && rec.weights) ? 'custom' : 'default:invalid';
      } else document.documentElement.dataset.fsrsWeights = 'default';
    } catch (e) {
      console.warn('could not load custom FSRS weights:', e);
      document.documentElement.dataset.fsrsWeights = 'default:error';
    }
    // Phase 3 Release A: one-way idempotent migration of legacy localStorage
    // vocab/sentences into the items store (originals kept as rollback).
    try {
      const m = await migrateLegacyData();
      if (m.ran) console.info(`migrated learning items: ${m.words} words, ${m.sentences} sentences`);
    } catch (e) { console.warn('learning-items migration failed:', e); }
    // One-time repair: the original migration scheduled context sentences as due
    // immediately (due = addedAt), flooding the Review badge/queue.
    try {
      const rep = await repairMigratedSentenceSchedule();
      if (rep.fixed) console.info(`rescheduled ${rep.fixed} migrated sentence(s) off the due queue`);
    } catch (e) { console.warn('migrated-sentence schedule repair failed:', e); }
    try { state.items = await allItems(); } catch (e) { console.warn('could not load learning items:', e); }
    state.itemsReady = true;
    // v117 A2: known-words baseline (IndexedDB store `known`) — loaded once at
    // boot, kept OUT of state.items so Vault UI / stats / decks never see it.
    try { state.known = await knownState(); } catch (e) { console.warn('could not load known baseline:', e); }
    updateVocabBadge();
    updateReviewBadge();
    try { renderWotd(); } catch (e) {}
    applyView(currentView()); // refresh the active view now that items exist

    // dictionary init: replace stale bundled dicts, then restore persisted ones
    let dictsReady = false;
    try {
      if ((await getBundleVer()) < BUNDLE_DATA_VERSION) {
        for (const slot of Object.keys(SLOTS)) {
          const mdx = await getFile(slot + '-mdx');
          if (!mdx || !BUNDLED_NAMES.includes(mdx.name)) continue;
          // drop the bundle AND everything that belonged to it — a stale .mdd
          // must never survive into the replacement dictionary
          await clearSlotCompanions(slot, { keepMdx: false });
          state.dicts[slot] = null;
          invalidateGlossCache();
          setStatus(slot, 'updating bundled dictionary…');
          const replacement = defaultDictOf(slot);
          if (replacement) await quickLoadOne(slot, replacement);
        }
        await putFile('bundle-version', new Blob([String(BUNDLE_DATA_VERSION)], { type: 'text/plain' }));
      }
      for (const slot of Object.keys(SLOTS)) {
        if (state.dicts[slot]) continue;
        const mdx = await getFile(slot + '-mdx');
        if (!mdx) continue;
        const mdd = await getFile(slot + '-mdd');
        // Safety net for copies written before the stale-companion cleanup
        // existed: only re-attach a .mdd that belongs to THIS .mdx (same base
        // name; legacy "res.mdd" and unnamed blobs keep the historical pairing).
        const mddBelongs = !mdd || !mdd.name || !mdx.name ||
          /^res\.mdd$/i.test(mdd.name) || baseNameOf(mdd.name) === baseNameOf(mdx.name);
        if (mdd && !mddBelongs) {
          try { await delFile(slot + '-mdd'); } catch (e) { /* ignore */ }
        }
        try { await attachDict(slot, mdx, mddBelongs ? mdd : null, { persist: false }); }
        catch (e) { console.error(e); setStatus(slot, 'reload error: ' + e.message); }
      }
      dictsReady = true;
      // first-ever visit: nothing loaded — probe sizes, let the user start it.
      if (Object.keys(SLOTS).every((s) => !state.dicts[s])) await showFirstLoadGate();
    } catch (e) { console.warn('dictionary init failed:', e); }
    // U3: boot is over — from here on "no dictionary" means really none (a failed
    // init included), so the surface may say so instead of "checking…".
    dictInit.done = true;
    // U3: the lookup surface must reflect the REAL state once init has settled
    updateIdleDictState();
    // C15: a ?q= handoff ran before any dictionary existed — run it again now
    await replayPendingQuery();
    // v113: a ?deck= handoff behaves the same way (word pages' practice CTA)
    parseDeckParam();
    replayPendingDeck();
    if (!dictsReady) console.warn('dictionary init did not complete — lookup stays gated until a dictionary loads');

    checkStorageHealth();
    maybeAutoBackup();
    // v67 R2: quiet due surface + the background-tab nudge timer (both no-ops
    // unless there is something due; the timer only ever fires when hidden)
    maybeShowDueBanner();
    scheduleBackgroundNotify();
    setTimeout(() => maybeOnboard(), 400);
    // after the onboarding window: first-visit users are marked offered there;
    // everyone else gets the one-time quiet toast (never both)
    setTimeout(() => maybeReofferReminders(), 3000);
  });
}

function wireUi() {
  document.querySelectorAll('input[type=file][data-slot]').forEach((inp) => {
    inp.addEventListener('change', () => onFilePicked(inp));
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const word = $('#search-input').value.trim();
    if (word) search(word);
  });
  const input = $('#search-input');
  input.addEventListener('input', () => {
    const hasWord = !!input.value.trim();
    $('#btn-clear').classList.toggle('hidden', !input.value);
    $('#btn-speak').disabled = !hasWord || !TTS_SUPPORTED;
    $('#btn-save-word').disabled = !hasWord;
    updateSaveButtonState();
    updateSearchFilledState();
    suggest(input.value);
  });
  input.addEventListener('blur', () => setTimeout(() => hideSuggestions(), 150));
  input.addEventListener('keydown', onSearchKeydown);
  $('#btn-clear').addEventListener('click', () => {
    input.value = '';
    $('#btn-clear').classList.add('hidden');
    $('#btn-speak').disabled = true;
    $('#btn-save-word').disabled = true;
    hideSuggestions();
    updateSearchFilledState();
    $('#context-bar')?.classList.add('hidden');
    input.focus();
  });
  // U11: on narrow screens the remaining header controls pushed the app title onto
  // two lines — advanced + help move into a compact overflow menu there (the
  // buttons themselves are hidden by CSS; this only drives the ⋯ toggle). The 🌓
  // theme button stays in the bar on every screen size.
  $('#btn-more')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const m = $('#more-menu');
    if (!m) return;
    const open = m.classList.toggle('hidden');
    $('#btn-more').setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', (e) => {
    const m = $('#more-menu');
    if (!m || m.classList.contains('hidden')) return;
    if (e.target.closest('#more-menu') || e.target.closest('#btn-more')) return;
    m.classList.add('hidden');
    $('#btn-more')?.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = $('#more-menu');
    if (m && !m.classList.contains('hidden')) { m.classList.add('hidden'); $('#btn-more')?.setAttribute('aria-expanded', 'false'); }
  });
  $('#more-advanced')?.addEventListener('click', () => {
    $('#more-menu')?.classList.add('hidden');
    populateTutorSettings(); renderAdvStatus(); renderBackupManager(); renderKnownAdvanced(); $('#advanced-dialog')?.showModal();
  });
  $('#more-help')?.addEventListener('click', () => {
    $('#more-menu')?.classList.add('hidden');
    $('#btn-more')?.setAttribute('aria-expanded', 'false');
    $('#help-dialog')?.showModal();
  });
  // keep the responsive header consistent with the viewport (same breakpoint as CSS)
  const syncTopbar = () => {
    const narrow = window.matchMedia('(max-width: 899.5px)').matches;
    $('#btn-more')?.classList.toggle('hidden', !narrow);
    if (!narrow) $('#more-menu')?.classList.add('hidden');
  };
  syncTopbar();
  window.addEventListener('resize', syncTopbar);
  $('#btn-speak').addEventListener('click', () => speak(input.value.trim(), $('#btn-speak')));
  $('#btn-save-word').addEventListener('click', () => openSenseSaveDialog(input.value.trim()));
  $('#sense-save-entry')?.addEventListener('change', renderSenseSaveCandidate);
  $('#btn-sense-save')?.addEventListener('click', saveSelectedSense);
  $('#btn-sense-cancel')?.addEventListener('click', () => $('#sense-save-dialog')?.close());
  $('#import-file')?.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importDataFile(f);
    e.target.value = ''; // allow re-picking the same file
  });
  wireVault(); // Phase 3 Release B: Vault view + item editor + batch bar
  $('#btn-swap-slots')?.addEventListener('click', swapSlots);
  // Context layer (P1): "Add example" + jump to the Vault for this word
  $('#btn-context-add')?.addEventListener('click', () => {
    const w = ($('#search-input')?.value || '').trim() || $('#context-bar')?.dataset.word || '';
    openExampleDialog(w);
  });
  $('#btn-context-vault')?.addEventListener('click', () => {
    const w = ($('#search-input')?.value || '').trim();
    if (w) { vaultQuery = w; const vs = $('#vault-search'); if (vs) vs.value = w; }
    navigate('vault');
  });
  $('#example-save')?.addEventListener('click', saveExample);
  // Phase 3+: pronunciation controls
  $('#btn-pron-speak')?.addEventListener('click', () => speakAt(($('#search-input')?.value || '').trim()));
  $('#btn-pron-slow')?.addEventListener('click', toggleTtsRate);
  $('#btn-pron-replay')?.addEventListener('click', (e) => speakAt(e.currentTarget.dataset.sentence || ''));
  // v69 R4: say-the-word mic — one-shot browser recognition checked against the
  // strip's current word. Unsupported browsers never see the button at all.
  const micBtn = $('#btn-pron-mic');
  if (micBtn && !SR_CLASS) micBtn.classList.add('hidden');
  else micBtn?.classList.remove('hidden');
  micBtn?.addEventListener('click', () => {
    const strip = $('#pron-strip');
    const target = (strip && strip.dataset.word) || '';
    const outEl = $('#pron-mic-result');
    if (!target || !outEl) return;
    micBtn.disabled = true; outEl.classList.remove('hidden'); outEl.textContent = i18n('pron.micListening');
    recognizeOnce((out) => {
      micBtn.disabled = false;
      const ok = out.ok && spokenMatch(target, out.heard);
      outEl.textContent = ok ? '✓ ' + target : out.ok ? i18n('pron.micHeard') + ': “' + out.heard + '”' : i18n('pron.micError');
      outEl.classList.toggle('bad', !ok);
    });
  });
  // Phase 3+: export dialog + practice/stats entry points
  $('#export-run')?.addEventListener('click', runExport);
  // v119 A3: a real Anki deck has a fixed note type — the field pickers only
  // apply to the text formats, so they hide while .apkg is selected.
  $('#export-format')?.addEventListener('change', () => {
    const fs = $('#export-fields');
    if (fs) fs.classList.toggle('hidden', $('#export-format').value === 'apkg');
  });
  $('#btn-vault-stats')?.addEventListener('click', () => navigate('stats'));
  $('#btn-vault-practice')?.addEventListener('click', () => startPractice([...vaultSelected]));
  $('#btn-review-practice')?.addEventListener('click', () => startPractice(dueItems().map((i) => i.id)));
  // UX pack (v47)
  $('#btn-install')?.addEventListener('click', promptInstall);
  $('#btn-theme')?.addEventListener('click', cycleTheme);
  $('#btn-lang')?.addEventListener('click', toggleLang);
  $('#vault-sort')?.addEventListener('change', (e) => { vaultSort = e.target.value; localStorage.setItem('vault-sort', vaultSort); renderVault(); });
  $('#vault-deck')?.addEventListener('change', (e) => { vaultDeck = e.target.value; renderVault(); });
  if ($('#vault-sort')) $('#vault-sort').value = vaultSort;
  $('#btn-vault-tags')?.addEventListener('click', () => { renderTagManager(); $('#tags-dialog').showModal(); });
  $('#btn-clear-history-full')?.addEventListener('click', () => { clearHistory(); renderHistoryView(); });
  $('#btn-restore-backup')?.addEventListener('click', () => restoreFromKey(($('#backup-select') && $('#backup-select').value) || 'auto-backup-latest'));
  $('#btn-create-restore-point')?.addEventListener('click', createRestorePoint);
  $('#btn-export-full-backup')?.addEventListener('click', exportCompleteStudyBackup);
  $('#btn-export-encrypted')?.addEventListener('click', exportEncrypted);
  $('#import-encrypted')?.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) importEncryptedFile(f); e.target.value = ''; });
  $('#crypto-confirm')?.addEventListener('click', () => { if (passResolve) { const r = passResolve; passResolve = null; $('#crypto-dialog').close(); r($('#crypto-pass').value); } });
  $('#crypto-dialog')?.addEventListener('close', () => { if (passResolve) { const r = passResolve; passResolve = null; r(null); } });
  addEventListener('online', updateNetBanner);
  addEventListener('offline', updateNetBanner);
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btn-install')?.classList.remove('hidden'); });
  addEventListener('keydown', onGlobalKeydown);
  addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) {
      e.preventDefault();
      const s = $('#search-input');
      if (s) { const v = currentView(); if (v !== 'search' && v !== 'reader') navigate('search'); s.focus(); }
    }
  });
  $('#btn-clear-history')?.addEventListener('click', clearHistory);
  $('#btn-envi-empty')?.addEventListener('click', loadEnViDictionary);
  // v78: the quiet EN–VI hint above the panels — same one-click loader, plus a dismiss
  $('#btn-envi-hint')?.addEventListener('click', () => {
    try { localStorage.setItem('envi-hint-dismissed', '1'); } catch (e) { /* storage off */ }
    $('#envi-hint')?.classList.add('hidden');
    loadEnViDictionary();
  });
  $('#btn-envi-hint-close')?.addEventListener('click', () => {
    try { localStorage.setItem('envi-hint-dismissed', '1'); } catch (e) { /* storage off */ }
    $('#envi-hint')?.classList.add('hidden');
  });
  $('#btn-envi-adv')?.addEventListener('click', loadEnViDictionary);
  $('#btn-reader-close')?.addEventListener('click', () => navigate('search'));
  $('#btn-cov-hl')?.addEventListener('click', covToggleHighlight); // v118 A1
  $('#btn-reader-start')?.addEventListener('click', startReading);
  const tutorialArticle=sessionStorage.getItem('dd-tutorial-article');
  if(tutorialArticle) { sessionStorage.removeItem('dd-tutorial-article'); $('#reader-input').value=tutorialArticle; navigate('reader'); $('#reader-input').focus(); }
  $('#btn-tutor-start')?.addEventListener('click', () => startTutor().catch(tutorActionError));

  $('#btn-tutor-setup-save')?.addEventListener('click', saveTutorQuickSetup);
  $('#btn-tutor-setup-cancel')?.addEventListener('click', () => {
    tutorSetupContinuation = null;
    $('#tutor-setup-dialog')?.close();
  });
  $('#tutor-setup-provider')?.addEventListener('change', syncTutorQuickSetupFields);
  $('#tutor-setup-dialog')?.addEventListener('close', () => { tutorSetupContinuation = null; });
  $('#btn-tutor-clear-data')?.addEventListener('click', clearTutorData);
  $('#tutor-dialog')?.addEventListener('close', cancelTutorRequest);
  $('#btn-ai-save')?.addEventListener('click', saveTutorSettings);
  $('#btn-ai-test')?.addEventListener('click', testTutorConnection);
  $('#btn-ai-clear')?.addEventListener('click', () => { clearAiSettings(); $('#ai-api-key').value = ''; $('#ai-settings-status').textContent = 'Key removed from this browser.'; });
  $('#btn-ai-clear-cache')?.addEventListener('click', () => { clearTutorCache(); $('#ai-settings-status').textContent = 'Cached phrase suggestions cleared from this browser.'; });
  $('#btn-open-advanced')?.addEventListener('click', () => { const s=getAiSettings(); $('#ai-api-key').value=s.apiKey; $('#ai-provider').value=s.provider; $('#ai-model').value=s.model; $('#ai-base-url').value=s.baseUrl; $('#ai-advanced-fields').open=s.provider==='compatible'; syncAiProviderFields(); });
  $('#ai-provider')?.addEventListener('change', (e) => { const p=PROVIDERS[e.target.value]; if(p){$('#ai-base-url').value=p.baseUrl;$('#ai-model').value=p.model; $('#ai-advanced-fields').open=e.target.value==='compatible'; syncAiProviderFields();} });
  // A stage replacement removes the focused button. Keep keyboard navigation
  // inside the open dialog, without moving focus away from an existing control.
  const tutorStage = $('#tutor-stage');
  if(tutorStage) new MutationObserver(() => {
    const dialog=$('#tutor-dialog'), active=document.activeElement;
    if(!dialog?.open || (active!==document.body && active!==dialog)) return;
    tutorStage.querySelector('textarea, input, button, summary')?.focus({preventScroll:true});
  }).observe(tutorStage,{childList:true});
  $('#tutor-stage')?.addEventListener('click', (e) => handleTutorClick(e).catch(tutorActionError));
  $('#tutor-stage')?.addEventListener('submit', (e) => handleTutorSubmit(e).catch(tutorActionError));
  $('#tutor-stage')?.addEventListener('input', (e) => { if(e.target?.name==='answer' && tutorSession) { tutorSession.answer=e.target.value; persistTutor().catch(()=>tutorStatus('Could not save draft. Keep this tab open.')); } });
  $('#btn-reader-load')?.addEventListener('click', loadReaderUrl);
  $('#btn-reader-youtube')?.addEventListener('click', () => { if ($('#yt-transcript')) $('#yt-transcript').value = ''; $('#yt-dialog')?.showModal(); });
  $('#btn-reader-yt-read')?.addEventListener('click', readYouTubeTranscript);
  // v77 listening wiring
  $('#btn-listening')?.addEventListener('click', () => $('#listen-dialog')?.showModal());
  $('#listen-audio-file')?.addEventListener('change', (e) => {
    const el = $('#listen-file-name');
    if (el) el.textContent = e.target.files[0] ? '🎧 ' + e.target.files[0].name : '';
  });
  $('#btn-listen-start')?.addEventListener('click', startListening);
  $('#btn-save-offline')?.addEventListener('click', saveSnapshot);
  $('#epub-file')?.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      showToast('Opening EPUB…');
      const { title, text } = await parseEpub(await f.arrayBuffer());
      if (!text) { showToast('The EPUB has no readable text'); return; }
      $('#reader-input').value = text;
      readerRender(text, 'epub: ' + (title || f.name));
    } catch (err) { showToast('Could not read the EPUB: ' + (err.message || 'unknown')); }
  });
  $('#pdf-file')?.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      showToast('Opening PDF… (first use loads the PDF engine)');
      const text = await parsePdf(await f.arrayBuffer());
      if (!text) { showToast('No selectable text in this PDF (it may be a scan)'); return; }
      $('#reader-input').value = text;
      readerRender(text, 'pdf: ' + f.name);
    } catch (err) { showToast('Could not read the PDF: ' + (err.message || 'unknown')); }
  });
  $('#btn-open-snapshots')?.addEventListener('click', openSnapshots);
  $('#btn-save-sentence')?.addEventListener('click', saveSentence);
  $('#reader-text')?.addEventListener('click', onReaderTap);
  // BMC fade while scrolling (backlog P1-01): the CTA never sits over content
  // being read — it fades out on scroll and returns when scrolling stops.
  let bmcFadeTimer;
  addEventListener('scroll', () => {
    const c = $('.bmc-btn-container');
    if (!c) return;
    c.classList.add('bmc-fade');
    clearTimeout(bmcFadeTimer);
    bmcFadeTimer = setTimeout(() => c.classList.remove('bmc-fade'), 1500);
  }, { passive: true });
  $('#btn-advanced')?.addEventListener('click', () => { populateTutorSettings(); renderAdvStatus(); renderBackupManager(); renderKnownAdvanced(); $('#advanced-dialog').showModal(); });
  $('#btn-help')?.addEventListener('click', () => $('#help-dialog').showModal());
  if (!TTS_SUPPORTED) {
    const b = $('#btn-speak');
    if (b) { b.title = 'Text-to-speech is not supported by this browser'; }
  }
  $('#btn-dismiss-storage')?.addEventListener('click', () => {
    $('#storage-banner').classList.add('hidden');
    sessionStorage.setItem('storage-banner-dismissed', '1');
  });
  // v67 R2 — review reminders wiring (all opt-in, never at boot)
  $('#reminders-toggle')?.addEventListener('change', (e) => {
    e.target.checked ? enableReminders() : disableReminders();
  });
  $('#onboard-reminders')?.addEventListener('click', async (e) => {
    await enableReminders();
    // one quiet offer: hide the link once used (even if permission was denied —
    // nagging in onboarding is exactly what this release is against)
    e.target.classList.add('hidden');
  });
  $('#btn-dismiss-due')?.addEventListener('click', () => {
    $('#due-banner')?.classList.add('hidden');
    localStorage.setItem('reminders-last-banner', String(Date.now()));
  });
  $('#due-banner-cta')?.addEventListener('click', () => {
    $('#due-banner')?.classList.add('hidden');
  });
  // SW-driven notificationclick focuses the app and asks it to open the Review
  // queue via postMessage (Client.navigate is unreliable across browsers)
  try {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'due-review') { location.hash = '#/review'; updateReviewBadge(); }
    });
  } catch (e) { /* serviceWorker unavailable */ }
  $('#url-load-oxford')?.addEventListener('click', () => loadFromUrl('oxford', $('#url-oxford').value));
  $('#url-load-longman')?.addEventListener('click', () => loadFromUrl('longman', $('#url-longman').value));
  $('#url-load-third')?.addEventListener('click', () => loadFromUrl('third', $('#url-third').value));
  document.querySelectorAll('.panel-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeDict(btn.dataset.slot));
  });
  document.querySelectorAll('#view-switch button').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.querySelectorAll('.panel-toggle').forEach((btn) => {
    btn.addEventListener('click', () => toggleReading(btn.dataset.slot));
  });
}

/* ---- dictionary tab switch: ONE panel at a time, every screen size ---- */
/** v97 removed the stacked "Both"/"Tất cả" view and the desktop side-by-side
 *  grid with it: the tabs pick the one dictionary to show, on all widths. The
 *  view to open on: the saved choice wins — but the old "both" value and a
 *  saved slot whose dictionary is no longer loaded fall through to the default,
 *  so removing a slot's dictionary can never leave an all-collapsed surface.
 *  Default: vi-locale users with the EN–VI dictionary loaded land on it (their
 *  most valuable panel), everyone else on WordNet. */
function rememberedView() {
  const saved = localStorage.getItem('view');
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  if (saved && SLOTS[saved] && (state.dicts[saved] || !anyLoaded)) return saved;
  return (lang === 'vi' && state.dicts?.third) ? 'third' : Object.keys(SLOTS).find(slot => state.dicts[slot]) || 'oxford';
}

function setView(view) {
  if (!SLOTS[view]) view = rememberedView(); // stale/migrated value (incl. old 'both')
  document.querySelectorAll('#view-switch button').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  for (const slot of Object.keys(SLOTS)) {
    $('#panel-' + slot).classList.toggle('collapsed', view !== slot);
  }
  // Slot 3 is optional: hide its panel + tab until a dictionary is actually there.
  const hasThird = !!(state.dicts && state.dicts.third);
  $('#panel-third')?.classList.toggle('hidden', !hasThird);
  document.querySelector('#view-switch button[data-view="third"]')?.classList.toggle('hidden', !hasThird);
  // Persist only once a dictionary is actually loaded: a pre-download default is
  // the layout default, not a choice — baking it in would stop rememberedView()
  // from auto-landing vi users on Anh–Việt at the first attach (v91 field fix).
  if (document.body.dataset.dictState === 'ready') localStorage.setItem('view', view);
}

/* ---- Phase 3 Release B: IA routing (hash-based) ---- */
const VIEWS = ['search', 'reader', 'vault', 'review', 'practice', 'stats', 'history'];

function currentView() {
  const m = location.hash.match(/^#\/(search|reader|vault|review|practice|stats|history)$/);
  return m ? m[1] : 'search';
}

function navigate(view) {
  if (!VIEWS.includes(view)) view = 'search';
  if (currentView() === view) applyView(view); // re-apply (e.g. initial load)
  else location.hash = '#/' + view;            // hashchange fires applyView
}

let lastAppliedView = 'search';

function applyView(view) {
  if (!VIEWS.includes(view)) view = 'search';
  const showSearchReader = view === 'search' || view === 'reader';
  $('#search-form')?.classList.toggle('hidden', !showSearchReader);

  // #history, #empty-state manage their own visibility — only ADD
  // 'hidden' when leaving their view; never unhide them here (an empty history
  // bar would otherwise push the whole layout down — caught by the ui-check diff).
  if (view !== 'search') $('#history')?.classList.add('hidden');
  else renderHistory();
  $('#about')?.classList.toggle('hidden', view !== 'search');
  if (!showSearchReader) { $('#context-bar')?.classList.add('hidden'); $('#pron-strip')?.classList.add('hidden'); }
  else { updateContextBar(($('#search-input')?.value || '').trim()); updatePronStrip(($('#search-input')?.value || '').trim()); }
  $('#view-switch')?.classList.toggle('hidden', !showSearchReader);
  $('#dict-grid')?.classList.toggle('hidden', !showSearchReader);
  $('#reader')?.classList.toggle('hidden', view !== 'reader');
  $('#vault-view')?.classList.toggle('hidden', view !== 'vault');
  $('#review-view')?.classList.toggle('hidden', view !== 'review');
  $('#practice-view')?.classList.toggle('hidden', view !== 'practice');
  $('#stats-view')?.classList.toggle('hidden', view !== 'stats');
  $('#history-view')?.classList.toggle('hidden', view !== 'history');
  // first-load gate (dictionary download) belongs to the lookup surface only
  if (!showSearchReader) {
    $('#empty-state')?.classList.add('hidden');
  } else if (view === 'search' || view === 'reader') {
    const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
    $('#empty-state')?.classList.toggle('hidden', anyLoaded);
    setView(rememberedView()); // restores which single panel is visible
  }
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === view;
    a.classList.toggle('active', on);
    a.setAttribute('aria-current', on ? 'page' : 'false');
  });
  if (lastAppliedView === 'review' && view !== 'review') reviewQueueIds = null; // session ends when you leave
  lastAppliedView = view;
  window.scrollTo(0, 0);
  if (view === 'reader') openReader();
  else closeReader();
  if (view === 'vault') renderVault();
  if (view === 'review') renderReview();
  if (view === 'stats') { renderStats(); renderBackupInfo(); }
  if (view === 'history') renderHistoryView();
  if (view === 'practice') { if (practiceQueue.length) renderPractice(); else renderPracticePicker(); }
}

/* ---- full-screen reading view (per panel) ---- */
function toggleReading(slot) {
  const panel = $('#panel-' + slot);
  const btn = document.querySelector(`.panel-toggle[data-slot="${slot}"]`);
  const on = !panel.classList.contains('reading');
  panel.classList.toggle('reading', on);
  document.body.classList.toggle('reading-mode', on);
  if (btn) {
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Exit full-screen reading view' : 'Full-screen reading view';
    btn.textContent = on ? '⤡' : '⤢';
  }
}

/* ---- keyboard navigation in suggestions ---- */
function onSearchKeydown(e) {
  const box = $('#suggestions');
  if (box.classList.contains('hidden')) return;
  const items = [...box.querySelectorAll('div')];
  if (!items.length) return;
  let idx = items.findIndex((d) => d.classList.contains('active'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    idx = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items.forEach((d, i) => {
      d.classList.toggle('active', i === idx);
      d.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
    $('#search-input').setAttribute('aria-activedescendant', items[idx].id);
    items[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && idx >= 0) {
    e.preventDefault();
    const item = items[idx];
    search(item.dataset.word || item.textContent);
  } else if (e.key === 'Escape') {
    box.classList.add('hidden');
  }
}

/** Read a response body in chunks, reporting progress (bytes, total) as it streams —
 *  a 1–2 GB .mdd must show percent/MB, not a silent spinner. Falls back to blob()
 *  when the browser offers no streaming body. */
async function readResponseWithProgress(resp, onProgress) {
  const total = +resp.headers.get('content-length') || 0;
  if (!resp.body || typeof resp.body.getReader !== 'function') {
    const blob = await resp.blob();
    onProgress(blob.size, blob.size);
    return blob;
  }
  const reader = resp.body.getReader();
  const parts = [];
  let received = 0;
  let lastUpdate = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.length;
    const now = Date.now();
    if (now - lastUpdate > 400) { lastUpdate = now; onProgress(received, total); }
  }
  onProgress(received, received);
  return new Blob(parts);
}

/** Fetch a (potentially huge) bundled file into a File blob. Streams to a blob so
 *  the data stays out of JS memory and progress (%, MB/s, ETA) can be reported
 *  while downloading. Supports cancellation via signal. */
async function fetchBundledFile(slot, url, name, label, signal) {
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + url);
  const total = +resp.headers.get('content-length') || 0;
  progressTrackers.delete(slot);
  setDownloadStatus(slot, label, name, 0, total);
  const blob = await readResponseWithProgress(resp, (received) => setDownloadStatus(slot, label, name, received, total));
  return new File([blob], name);
}

/** Load one bundled dictionary (mdx + optional mdd/css) into a slot, with progress + persistence.
 *  The .mdx is attached as soon as it arrives so the slot is searchable while the
 *  (much larger) .mdd resources are still downloading. */
// CLS (v70): CSS needs to tell "boot is restoring" from "a real download is in
// flight" — only the latter may reveal the panel grid (its appearance/disappearance
// during the boot window moved the whole page twice on a first visit). quickLoadOne
// recurses into the fallback path, so depth-count instead of a boolean.
let downloadDepth = 0;
function setBodyDownloading(on) {
  downloadDepth = Math.max(0, downloadDepth + (on ? 1 : -1));
  if (downloadDepth) document.body.dataset.downloading = '1';
  else delete document.body.dataset.downloading;
}

async function quickLoadOne(slot, def, signal) {
  state.loading[slot] = true;
  setBodyDownloading(true);
  updateIdleDictState();
  try {
    const mdxFile = await fetchBundledFile(slot, def.url, def.name, 'loading', signal);
    await putFile(slot + '-mdx', mdxFile);
    // C2: the slot now holds a NEW .mdx — every companion of the previous
    // dictionary (.mdd audio/images, .css, .mdx-meta validators) must go, or the
    // old .mdd would be re-attached to the new dictionary on the next boot.
    await clearSlotCompanions(slot);
    await attachDict(slot, mdxFile, null, { persist: false });
    if (def.mddUrl) {
      try {
        const mddFile = await fetchBundledFile(slot, def.mddUrl, def.mddName, 'loading resources', signal);
        try {
          await putFile(slot + '-mdd', mddFile);
        } catch (storageErr) {
          // Huge .mdd may fail to persist on some devices — keep it for this session only.
          console.warn('could not persist .mdd:', storageErr);
          setStatus(slot, '⚠ resources too large to save — audio works until you close the app');
        }
        if (state.dicts[slot]) {
          state.dicts[slot].mdd = await new MDict(mddFile, mddFile.name || 'res.mdd').init();
          state.dicts[slot].mddBlob = mddFile;
          setStatus(slot, `${state.dicts[slot].mdx.numEntries.toLocaleString('en-US')} entries`);
        }
      } catch (mddErr) {
        if (mddErr.name === 'AbortError') throw mddErr;
        console.warn('could not load .mdd:', mddErr);
        setStatus(slot, '⚠ resources (.mdd) failed to load — definitions still work, audio/images may not');
      }
    }
    if (state.dicts[slot] && def.cssUrl) {
      // optional bundled stylesheet fallback (LDOCE6 keeps its css in a 7z inside the .mdd)
      try {
        const r = await fetch(def.cssUrl, { signal });
        if (r.ok && state.dicts[slot]) state.dicts[slot].bundledCss = await r.text();
      } catch (cssErr) { if (cssErr.name === 'AbortError') throw cssErr; }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      setStatus(slot, i18n('slot.cancelled'));
      return;
    }
    console.error(e);
    // bundled defaults missing (public deploy without dicts/) → try the free
    // fallback as last resort
    const fb = FALLBACK_DICTS[slot];
    if (fb && def !== fb) {
      try {
        await quickLoadOne(slot, fb);
        setStatus(slot, i18n('slot.openLoaded'));
        return;
      } catch (fbErr) {
        if (fbErr.name === 'AbortError') { setStatus(slot, 'Download cancelled'); return; }
        console.error(fbErr);
        e = fbErr;
      }
    }
    const offline = !navigator.onLine ? ' (you appear to be offline — try again once connected)' : '';
    setStatus(slot, 'quick-load error: ' + e.message + offline);
  } finally {
    state.loading[slot] = false;
    setBodyDownloading(false);
    updateIdleDictState();
  }
}

/** Quick-load dictionaries into their slots (defaults from dicts/, the same-origin
 *  open copies, or the EN–VI file), cancellable. `requested` = slots in order —
 *  the chooser's selection; empty/omitted = the classic EN–EN pair. Slot 3 loads
 *  the open EN–VI dictionary through the same pipeline (progress + persistence). */
async function quickLoadOpenDicts(requested) {
  const btn = $('#btn-quickload');
  const cancelBtn = $('#btn-cancel-load');
  const msg = $('#empty-state-msg');
  const err = $('#empty-state-error');
  if (err) { err.hidden = true; err.textContent = ''; }
  if ($('#empty-state')) $('#empty-state').classList.remove('hidden');
  loadAbort = new AbortController();
  const signal = loadAbort.signal;
  if (cancelBtn) cancelBtn.classList.remove('hidden');
  if (btn) btn.disabled = true;
  const failed = [];
  let cancelled = false;
  let msgText;
  // The EN–VI dictionary first when selected — it is the one vi-locale users are
  // waiting for, so it lands (and becomes searchable) as early as possible.
  const queue = ((requested && requested.length) ? requested : ['oxford', 'longman']).filter((s) => SLOTS[s]);
  // Name what will REALLY load: probe the sources first so a public deployment
  // (no dicts/ data) shows the open-licensed fallback name instead of promising
  // a commercial dictionary it does not ship.
  const probed = await probeDictionarySizes(signal).catch(() => null);
  const defOf = (slot) => (slot === 'third' ? ENVI_DICT : defaultDictOf(slot));
  const labelOf = (slot) => {
    if (slot === 'third') return FRIENDLY_TITLES[ENVI_DICT.name] || ENVI_DICT.label;
    const def = defaultDictOf(slot);
    const src = probed?.per?.[slot]?.source;
    if (src === 'default') return def.label;
    const fb = FALLBACK_DICTS[slot];
    if (fb && (src === 'open' || src === 'unknown')) {
      return FRIENDLY_TITLES[fb.name] || SLOTS[slot]?.label || def.label;
    }
    return def.label;
  };
  for (const slot of queue) {
    if (signal.aborted) { cancelled = true; break; }
    const def = defOf(slot);
    const loadedOther = Object.keys(SLOTS).find((s) => s !== slot && state.dicts[s]);
    const otherLabel = loadedOther ? labelOf(loadedOther) : '';
    msgText = otherLabel
      ? i18nFmt('firstload.preparing', { name: labelOf(slot), other: otherLabel })
      : i18nFmt('firstload.loadingOne', { name: labelOf(slot) });
    if (msg) msg.textContent = msgText;
    markChooserCard(slot, 'loading');
    await quickLoadOne(slot, def, signal);
    markChooserCard(slot, state.dicts[slot] ? 'done' : 'failed');
    if (!state.dicts[slot]) failed.push(labelOf(slot));
  }
  loadAbort = null;
  progressTrackers.clear();
  if (cancelBtn) cancelBtn.classList.add('hidden');
  if (btn) btn.disabled = false;
  updateFirstloadCta();
  // ITEM A: the card ends on what really happened. Ready when every dictionary
  // landed (the card is hidden by then, but this is the copy it would show if it
  // is ever read — it used to keep claiming a download was still running); the
  // cancel and failed branches right below replace it with their own wording.
  if (msg) msg.textContent = (cancelled || failed.length) ? i18n('firstload.loading') : i18n('firstload.done');
  updateIdleDictState();
  if (cancelled) {
    if (msg) msg.textContent = i18n('firstload.cancelled');
    if (err) {
      err.textContent = i18n('firstload.cancelHint');
      err.hidden = false;
    }
  } else if (failed.length) {
    dataUnreachable = failed.length === queue.length;
    updateEmptyStateCopy();
    if (err) {
      err.textContent = i18nFmt('firstload.failed', { names: failed.join(', ') });
      err.hidden = false;
    }
  } else {
    // U16: scoped to the lookup surface AND to the moment it is on screen — the
    // toast must never appear over Vault/Review/Stats, and must not float over the
    // footer while the user is reading the bottom of the page. Short-lived: the
    // panel headers already say which dictionary loaded.
    if (lookupSurfaceVisible()) showToast(i18n('firstload.done'), null, 2000);
  }
  updateIdleDictState();
  // C15: a ?q= handoff that arrived before the dictionaries existed gets its
  // answer now, without the user having to submit again.
  await replayPendingQuery();
  // v113: same for a ?deck= handoff — glosses work once a dictionary is in
  parseDeckParam();
  replayPendingDeck();
}

/** HEAD-probe one URL with retry: first-time visitors hit a cold CDN edge, where
 *  the origin fetch for a multi-MB file can exceed a single short timeout —
 *  a probe that fails once does NOT mean the file is unreachable. Retries on
 *  network errors/timeouts; a 404 is definitive (file truly missing). */
async function headProbe(url, signal) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const h = await fetch(url, { method: 'HEAD', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
      if (h.ok) return h;
      if (h.status === 404) return null;
    } catch (e) {
      if (signal?.aborted) return null;
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  return null;
}

/** HEAD-probe dictionary URLs to tell the user the real download size BEFORE any
 *  download starts. Returns per-slot info: bytes + which dictionary will actually
 *  load ('default' = bundled OALD/LDOCE, 'open' = the open-licensed defaults of
 *  the public edition, 'unknown' = nothing reachable). */
// v70: the open-licensed fallback files ship with this release, so their byte
// sizes are known at build time. A cold CDN edge occasionally answers the HEAD
// with 200 but no Content-Length header (the v64 probe miss) — the embedded
// size fills that gap without ever inventing a number for a file we don't ship.
// Update these if samples/*.mdx are ever rebuilt.
const KNOWN_DICT_SIZES = {
  'samples/wordnet31.mdx': 11094719,
  'samples/simple-en.mdx': 2222808,
  'dicts-en-vi/star_anhviet.mdx': 11383493,
};

function probedBytes(url, resp) {
  const len = +resp.headers.get('content-length') || 0;
  if (len) return len;
  const path = String(url).replace(/^\.?\//, '');
  return KNOWN_DICT_SIZES[path] || 0;
}

/** Files whose byte size we KNOW because they ship with this deployment. v116:
 *  same-origin assets in this table skip the HEAD probe entirely — a HEAD we
 *  fire at a file we authored is one more round trip and one more confusing
 *  signal to debug (field report: "HEAD 404 but the download works", from a
 *  deploy swap / edge hiccup). The GET in quickLoadOne stays the ground truth:
 *  a missing file still fails loudly there. Update the table if these files
 *  are ever rebuilt. */
function knownProbe(url, source) {
  const bytes = KNOWN_DICT_SIZES[String(url).replace(/^\.?\//, '')];
  return bytes ? { bytes, source } : null;
}

/** Probe one slot: its bundled default URLs first, then the open fallback. Slots
 *  run via Promise.all from probeDictionarySizes — headProbe() already
 *  serializes its own retries, so a cold-CDN slot no longer delays the other. */
async function probeSlotSize(slot, def, signal) {
  const known = knownProbe(def.url, def === FALLBACK_DICTS[slot] ? 'open' : 'default');
  if (known) return known;   // shipped file — nothing to learn from the network
  let bytes = 0;
  let source = 'unknown';
  const urls = [def.url, def.mddUrl].filter(Boolean);
  const resps = await Promise.all(urls.map((u) => headProbe(u, signal)));
  // A public edition probes the fallback itself (defaultDictOf), so the label
  // must follow the probed definition, not the probe stage.
  urls.forEach((u, i) => {
    if (resps[i]) {
      bytes += probedBytes(u, resps[i]);
      source = def === FALLBACK_DICTS[slot] ? 'open' : 'default';
    }
  });
  if (!bytes) {
    const fb = FALLBACK_DICTS[slot];
    if (fb) {
      const knownFb = knownProbe(fb.url, 'open');
      if (knownFb) return knownFb;
      // A 200 without Content-Length on the fallback still proves the file is
      // reachable — count it as 'open' with the embedded size, never 'unknown'.
      const h = await headProbe(fb.url, signal);
      if (h) { bytes = probedBytes(fb.url, h); source = 'open'; }
    }
  }
  return { bytes, source };
}

async function probeDictionarySizes(signal) {
  const slots = Object.keys(DEFAULT_DICTS);
  const results = await Promise.all(slots.map((slot) => probeSlotSize(slot, defaultDictOf(slot), signal)));
  const per = {};
  let total = 0;
  slots.forEach((slot, i) => { per[slot] = results[i]; total += results[i].bytes; });
  return { per, total };
}

/** v91 chooser: the first-load card lists all THREE open dictionaries as
 *  selectable cards. Order puts the EN–VI dictionary on top — it is the one
 *  vi-locale visitors are here for. Sizes/names are probed, never invented. */
const CHOOSER_ORDER = ['third', 'oxford', 'longman'];
let firstLoadPer = {}; // slot -> { bytes, source } from the last gate probe

function selectedFirstloadSlots() {
  return CHOOSER_ORDER.filter((s) => document.getElementById('chk-firstload-' + s)?.checked);
}

/** Per-card state while the queue runs: neutral → is-loading → is-done/is-failed. */
function markChooserCard(slot, mark) {
  const card = document.querySelector(`#first-load-sizes .dict-choice[data-slot="${slot}"]`);
  if (!card) return;
  card.classList.remove('is-loading', 'is-done', 'is-failed');
  if (mark) card.classList.add('is-' + mark);
}

/** The CTA always names exactly what the chooser has selected — it must never
 *  promise more or less than the checkboxes ("Tải 2 từ điển (≈ 21,6 MB)"). */
function updateFirstloadCta() {
  const btn = $('#btn-quickload');
  const all = $('#btn-download-all');
  if (all) all.disabled = !!dataUnreachable;
  if (!btn) return;
  if (dataUnreachable) {
    btn.textContent = i18n('firstload.retry');
    btn.disabled = false;
    return;
  }
  const sel = selectedFirstloadSlots();
  if (!sel.length) {
    btn.textContent = i18n('firstload.pickOne');
    btn.disabled = true;
    return;
  }
  const bytes = sel.reduce((sum, s) => sum + ((firstLoadPer[s] && firstLoadPer[s].bytes) || 0), 0);
  btn.textContent = i18nFmt(sel.length === 1 ? 'firstload.ctaOne' : 'firstload.ctaN',
    { n: sel.length, size: bytes ? fmtSize(bytes) : '…' });
  btn.disabled = false;
}

/** First-ever visit: do NOT start a download silently. Show the chooser — which
 *  of the three open dictionaries to download, real sizes probed first — plus an
 *  explicit Start / Cancel choice. */
async function showFirstLoadGate() {
  const msg = $('#empty-state-msg');
  const btn = $('#btn-quickload');
  const err = $('#empty-state-error');
  const list = $('#first-load-sizes');
  if (btn) btn.disabled = true;
  if (msg) msg.textContent = i18n('firstload.checking');
  if ($('#empty-state')) $('#empty-state').classList.remove('hidden');
  // Probe the two EN–EN slots AND the same-origin EN–VI file in one pass.
  const [enEN, envi] = await Promise.all([
    probeDictionarySizes(),
    probeSlotSize('third', ENVI_DICT).catch(() => ({ bytes: KNOWN_DICT_SIZES[ENVI_DICT.url] || 0, source: 'open' })),
  ]);
  firstLoadPer = { ...enEN.per, third: envi };
  firstLoadTotal = enEN.total + (envi.bytes || 0);
  if (list) {
    list.innerHTML = '';
    // vi-locale visitors get the EN–VI dictionary pre-selected — the one they are
    // most likely here for; other locales default to the classic EN–EN pair.
    const defaults = (lang === 'vi')
      ? { third: true, oxford: true, longman: false }
      : { third: false, oxford: true, longman: true };
    for (const slot of CHOOSER_ORDER) {
      const info = firstLoadPer[slot] || { bytes: 0, source: 'unknown' };
      let name;
      if (slot === 'third') name = FRIENDLY_TITLES[ENVI_DICT.name] || ENVI_DICT.label;
      else {
        const def = defaultDictOf(slot);
        const openName = (FALLBACK_DICTS[slot] && FRIENDLY_TITLES[FALLBACK_DICTS[slot].name]) || def.label;
        name = info.source === 'open' ? openName : (def.label || openName);
      }
      const li = document.createElement('li');
      li.className = 'dict-choice';
      li.dataset.slot = slot;
      const label = document.createElement('label');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = 'chk-firstload-' + slot;
      chk.checked = !!defaults[slot];
      chk.addEventListener('change', updateFirstloadCta);
      const nameEl = document.createElement('span');
      nameEl.className = 'dc-name';
      nameEl.textContent = name;
      const desc = document.createElement('span');
      desc.className = 'dc-desc';
      desc.textContent = i18n(slot === 'third' ? 'firstload.enviDesc'
        : slot === 'oxford' ? 'firstload.oxfordDesc' : 'firstload.longmanDesc');
      const size = document.createElement('span');
      size.className = 'dc-size';
      size.textContent = info.bytes ? `≈ ${fmtSize(info.bytes)}` : i18n('firstload.sizeUnknown');
      label.append(chk, nameEl, desc, size);
      li.appendChild(label);
      list.appendChild(li);
      // Public edition: the open dictionary IS the default — label the panel now
      // so even the pre-load state shows the real source, never a false promise.
      if (slot !== 'third' && info.source === 'open' && FALLBACK_DICTS[slot]) {
        const nameEl2 = document.querySelector(`#panel-${slot} .dict-name`);
        if (nameEl2) {
          nameEl2.textContent = name;
          nameEl2.title = `${name}\nSource file: ${FALLBACK_DICTS[slot].name}`;
        }
        paintPanelLicence(slot, FALLBACK_DICTS[slot].name); // U5: attribute what will really load
      } else if (slot !== 'third' && info.source === 'default') {
        // This deployment serves the commercial defaults: the open-licensed chip
        // baked into the HTML would be a false attribution — drop it.
        paintPanelLicence(slot, null);
      }
    }
  }
  if (firstLoadTotal) {
    dataUnreachable = false;
    if (msg) msg.textContent = i18nFmt('firstload.desc', { size: fmtSize(firstLoadTotal) });
  } else {
    // Probe found no reachable source — do NOT promise a download that cannot
    // happen. Say so, keep the buttons working, and label the CTA as a retry.
    dataUnreachable = true;
    if (msg) msg.textContent = i18n('firstload.unreachable');
    if (err) {
      err.textContent = i18n('firstload.unreachableHint');
      err.hidden = false;
    }
  }
  updateFirstloadCta();
}

/** Remove a dictionary from a slot (IndexedDB + UI). Slots 1 and 2 then restore
 *  their bundled default; slot 3 has NO bundled default, so it is simply emptied
 *  (its panel/tab hide again via setView) instead of silently loading the default
 *  of another slot. */
async function removeDict(slot) {
  const hasDefault = !!defaultDictOf(slot);
  if (!confirm(hasDefault
    ? 'Remove this dictionary and restore the default one?'
    : 'Remove the dictionary from this slot?')) return;
  revokeSlotUrls(slot);
  await clearSlotCompanions(slot, { keepMdx: false });
  state.dicts[slot] = null;
  invalidateGlossCache();
  setStatus(slot, 'not loaded');
  $('#frame-' + slot).hidden = true;
  const nameEl = document.querySelector(`#panel-${slot} .dict-name`);
  if (nameEl) {
    // label guarded BY SLOT — never claim a dictionary the empty slot does not hold
    nameEl.textContent = SLOT_FALLBACK_LABELS[slot] || SLOTS[slot]?.label || 'Dictionary';
    nameEl.title = '';
  }
  // the empty slot's default is the open-licensed one of a public deployment —
  // attribute it as such (or drop the chip if this slot has no known default)
  paintPanelLicence(slot, (defaultDictOf(slot) && FALLBACK_DICTS[slot]) ? FALLBACK_DICTS[slot].name : null);
  const def = defaultDictOf(slot);
  if (def) await quickLoadOne(slot, def);
  else setView(rememberedView()); // re-hide the emptied optional slot
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  $('#empty-state').classList.toggle('hidden', anyLoaded);
  updateIdleDictState();
  // ITEM A: if this removal emptied the whole surface, the card goes back to the
  // honest "no dictionary is loaded yet" line. updateIdleDictState() deliberately
  // leaves the idle card alone (that state belongs to the size gate), so without
  // this a removed dictionary of the last filled slot left the ready copy on a card
  // that is visible again over two empty panels.
  if (!anyLoaded && !Object.keys(SLOTS).some((s) => state.loading[s])) updateEmptyStateCopy();
}

/** What an EMPTY slot is expected to hold (used for the pre-load label). Slots 1/2
 *  name the open-licensed defaults of the public edition; slot 3 has no default.
 *  U5: names only — the licence is its own chip (.dict-lic), never glued onto the
 *  dictionary name, so both panels read in the same shape. */
const SLOT_FALLBACK_LABELS = {
  oxford: 'WordNet 3.1',
  longman: 'Simple English Wiktionary',
  third: 'Slot 3 (optional — your own .mdx)',
};

/** U5: ONE attribution convention — the panel head shows the dictionary NAME plus
 *  a licence chip whose short form IS the licence's own name. The full wording (and
 *  the CC BY-SA "share-alike" details) lives in the chip's tooltip, one hover/focus
 *  or one click (NOTICE.md) away. Attribution stays visible either way: CC BY-SA
 *  only requires the name + licence to be shown, which they are.
 *  A dictionary this app cannot attribute (anything the user loaded themselves, or a
 *  commercial file) gets NO chip — the app never guesses a licence. */
const LICENCES = {
  'wordnet31.mdx': {
    short: 'WordNet licence',
    full: 'WordNet 3.1 — definitions under the WordNet 3.1 license (Princeton University — wordnet.princeton.edu). '
      + 'IPA portions come from CMUdict (public domain / BSD) and Simple English Wiktionary (CC BY-SA). Full text: NOTICE.md',
  },
  'simple-en.mdx': {
    short: 'CC BY-SA & GFDL',
    full: 'Simple English Wiktionary — dictionary content from Simple English Wiktionary '
      + '(simple.wiktionary.org), CC BY-SA 3.0+/4.0 (dual-licensed) & GFDL. Full text: NOTICE.md',
  },
  'star_anhviet.mdx': {
    short: 'MIT',
    full: 'Từ điển Anh–Việt v1.1 © Open Vietnamese Dictionary Project (catusf/tudien) — MIT. Full text: NOTICE.md',
  },
};

/** Paint the licence chip of a slot from a .mdx file name (null = hide it). */
function paintPanelLicence(slot, mdxName) {
  const el = document.querySelector(`#panel-${slot} .dict-lic`);
  if (!el) return;
  const lic = LICENCES[String(mdxName || '').toLowerCase()];
  if (!lic) { el.hidden = true; el.textContent = ''; el.removeAttribute('title'); return; }
  el.hidden = false;
  el.textContent = lic.short;
  el.title = lic.full;
  el.setAttribute('href', 'NOTICE.md');
}

/** Fetch a (potentially huge) file into a File blob, with optional auth header.
 *  Retries up to 3 times — tunnels occasionally reset connections (ECONNRESET).
 *  Reports streaming progress so big downloads (1 GB+) never look frozen. */
async function fetchAuthFile(slot, url, name, authHeader, label = 'loading', signal) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
        signal,
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + url);
      const total = +resp.headers.get('content-length') || 0;
      progressTrackers.delete(slot);
      setDownloadStatus(slot, label, name, 0, total);
      const blob = await readResponseWithProgress(resp, (received) => setDownloadStatus(slot, label, name, received, total));
      return new File([blob], name);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
      console.warn(`download attempt ${attempt}/3 failed:`, e.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

/** Core loader: apply a remote dictionary URL (mdx + auto-discovered .mdd/.css
 *  siblings) to a slot. ONE URL loads the whole set stored in that dicts/ folder —
 *  the user never has to fetch the individual files. Throws on failure — used by
 *  both the manual inputs and the automatic first-visit download.
 *  Credentials may be embedded in the URL as https://user:pass@host/… and are sent
 *  as an Authorization header (required for cross-origin fetch).
 *  Returns a summary: { mdx: true, mdd: boolean, css: boolean }. */
async function applyRemoteUrl(slot, urlStr) {
  const url = new URL(urlStr.trim());
  let authHeader = null;
  if (url.username || url.password) {
    authHeader = 'Basic ' + btoa(decodeURIComponent(url.username || '') + ':' + decodeURIComponent(url.password || ''));
    url.username = '';
    url.password = '';
  }
  const mdxName = decodeURIComponent((url.pathname.split('/').pop() || '').trim());
  if (!mdxName.toLowerCase().endsWith('.mdx')) {
    throw new Error('URL must point to a .mdx file (the .mdd and .css siblings are picked up automatically)');
  }
  const auth = authHeader ? { Authorization: authHeader } : undefined;
  // Skip-if-unchanged: a HEAD probe returns the file's identity — size plus the
  // server's content fingerprint (ETag / Last-Modified). When the slot already
  // holds a file with the SAME name, SAME byte size and the SAME server validators
  // (persisted from the last download), the multi-GB download is skipped entirely.
  // Name+size alone can't tell identical content apart; the stored ETag/Last-Modified
  // from the previous download can — without hashing gigabytes in the browser.
  let headResp = null;
  try {
    headResp = await fetch(url.href, { method: 'HEAD', headers: auth });
    const remoteLen = headResp.ok ? (+headResp.headers.get('content-length') || 0) : 0;
    if (remoteLen > 0) {
      const existing = await getFile(slot + '-mdx');
      let savedValidators = null;
      try {
        const vb = await getFile(slot + '-mdx-meta');
        if (vb) savedValidators = JSON.parse(await vb.text());
      } catch (e) { /* no metadata yet — name+size check only */ }
      const etag = headResp.headers.get('etag') || '';
      const lastModified = headResp.headers.get('last-modified') || '';
      const validatorsMatch =
        (savedValidators?.etag && etag) ? savedValidators.etag === etag
        : (savedValidators?.lastModified && lastModified) ? savedValidators.lastModified === lastModified
        : true; // server offers no fingerprint — fall back to name+size only
      if (existing && existing.name === mdxName && existing.size === remoteLen && validatorsMatch) {
        if (!state.dicts[slot]) {
          const savedMdd = await getFile(slot + '-mdd');
          await attachDict(slot, existing, savedMdd, { persist: false });
        }
        setStatus(slot, `${mdxName} is already loaded (${fmtSize(remoteLen)}, unchanged on server) — download skipped`);
        return { mdx: true, mdd: !!state.dicts[slot]?.mdd, css: !!state.dicts[slot]?.bundledCss, skipped: true, name: mdxName, bytes: remoteLen };
      }
    }
  } catch (e) { /* HEAD unsupported/unreachable — fall through to the normal download */ }
  const mdxFile = await fetchAuthFile(slot, url.href, mdxName, authHeader);
  await putFile(slot + '-mdx', mdxFile);
  // C2: a NEW .mdx is in the slot — drop the previous dictionary's companions
  // (.mdd audio/images, .css, stale validators) BEFORE fetching the new ones, so
  // a failed/absent sibling can never leave the old resources paired with B.
  await clearSlotCompanions(slot);
  // persist this download's server fingerprint so the NEXT load of the same URL
  // can skip with a content-level check (not just name+size)
  try {
    const validators = {
      etag: headResp?.headers?.get('etag') || '',
      lastModified: headResp?.headers?.get('last-modified') || '',
    };
    await putFile(slot + '-mdx-meta', new Blob([JSON.stringify(validators)], { type: 'application/json' }));
  } catch (e) { /* metadata is an optimization — never fail the load over it */ }

  // try the sibling .mdd (audio/images)
  let mddFile = null;
  const mddName = mdxName.replace(/\.mdx$/i, '.mdd');
  try {
    const mddUrl = new URL(mddName, url.href).href;
    const head = await fetch(mddUrl, { method: 'HEAD', headers: auth });
    if (head.ok) {
      mddFile = await fetchAuthFile(slot, mddUrl, mddName, authHeader, 'loading resources');
      try { await putFile(slot + '-mdd', mddFile); }
      catch (err) { console.warn('could not persist .mdd:', err); }
    }
  } catch (err) { console.warn('no sibling .mdd:', err.message); }

  await attachDict(slot, mdxFile, mddFile, { persist: false });

  // sibling .css (LDOCE6 keeps its stylesheet outside the .mdd) — a MISSING css is
  // reported to the user, not silently swallowed: an unstyled LDOCE entry is the
  // classic symptom of exactly this file being absent.
  const cssName = mdxName.replace(/\.mdx$/i, '.css');
  let cssOk = false;
  try {
    const cssUrl = new URL(cssName, url.href).href;
    const r = await fetch(cssUrl, { headers: auth });
    if (r.ok && state.dicts[slot]) {
      state.dicts[slot].bundledCss = await r.text();
      cssOk = true;
      const w = $('#search-input').value.trim();
      if (w) await renderSlot(slot, w); // re-style the entry already on screen
    }
  } catch (err) { /* optional — reported via the summary below */ }
  return { mdx: true, mdd: !!mddFile, css: cssOk };
}

/** UI wrapper for the manual "Load from URL" inputs in ⚙ Advanced.
 *  One URL pulls the ENTIRE set from dicts/ on the server: .mdx + matching .mdd
 *  + matching .css are fetched automatically, so the user loads a single link
 *  instead of one file at a time. */
async function loadFromUrl(slot, urlStr) {
  urlStr = (urlStr || '').trim();
  if (!urlStr) {
    alert('Paste a dictionary URL first, e.g. https://user:pass@your-home-server/dicts/ldoce6.mdx');
    return;
  }
  try {
    const got = await applyRemoteUrl(slot, urlStr);
    if (got.skipped) {
      setStatus(slot, `${got.name} unchanged (${fmtSize(got.bytes)} already saved) — download skipped`);
      return;
    }
    const parts = ['dictionary (.mdx)'];
    if (got.mdd) parts.push('resources (.mdd)');
    if (got.css) parts.push('stylesheet (.css)');
    let msg = 'loaded from URL — ' + parts.join(' + ') + ' saved in this app';
    if (!got.css) msg += ' · ⚠ stylesheet (.css) not found next to the .mdx — entries may render unstyled';
    setStatus(slot, msg);
  } catch (e) {
    console.error(e);
    let msg = e.message;
    if (urlStr.includes('@') && msg.includes('401')) msg += ' — check the user:pass part of the URL';
    setStatus(slot, 'URL load error: ' + msg);
    alert('Could not load from URL: ' + msg);
  }
}

async function onFilePicked(inp) {
  const file = inp.files[0];
  if (!file) return;
  const slot = inp.dataset.slot;
  const kind = inp.dataset.kind;
  try {
    // .css is a plain-text companion file (e.g. ldoce6.css): save it, apply it to
    // the loaded dictionary immediately, and re-render the current entry.
    if (kind === 'css') {
      const text = await file.text();
      try { await putFile(slot + '-css', file); }
      catch (storageErr) { console.warn('could not persist .css:', storageErr); }
      if (state.dicts[slot]) {
        state.dicts[slot].bundledCss = text;
        const w = $('#search-input').value.trim();
        if (w) await renderSlot(slot, w);
        setStatus(slot, 'stylesheet loaded — entries are styled');
      } else {
        setStatus(slot, 'stylesheet saved — it will apply once a dictionary is loaded');
      }
      return;
    }
    // Skip-if-unchanged for picked files too: same name + same byte size already
    // stored in this slot → keep the stored copy, skip the (GB-scale) re-write.
    const alreadySaved = await getFile(slot + '-' + kind).catch(() => null);
    if (alreadySaved && alreadySaved.name === file.name && alreadySaved.size === file.size) {
      if (!state.dicts[slot] && kind === 'mdx') {
        const savedMdd = await getFile(slot + '-mdd');
        await attachDict(slot, alreadySaved, savedMdd, { persist: false });
      }
      if (state.dicts[slot]) {
        const w = $('#search-input').value.trim();
        if (w) await renderSlot(slot, w);
      }
      setStatus(slot, `${file.name} is already loaded (${fmtSize(file.size)}, unchanged) — nothing to do`);
      return;
    }
    // check header quickly (first bytes of an mdx/mdd: 00 00 <len> <len> BE + UTF16 xml)
    const probe = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const headerLen = (probe[0] << 24) | (probe[1] << 16) | (probe[2] << 8) | probe[3];
    if (headerLen <= 0 || headerLen > 100000) {
      throw new Error('File does not look like an MDX/MDD file. Please check the file (it must be a real, non-encrypted .mdx or .mdd).');
    }
    if (file.size > 800 * 1048576 && !confirm('This file is ' +
        (file.size / 1073741824).toFixed(1) + ' GB. Very large files (especially .mdd) may fail to save ' +
        'on some devices (iOS Safari in particular). Continue anyway?')) return;
    try {
      await putFile(slot + '-' + kind, file);
      // C2: a picked .mdx replaces the whole set for this slot — the previous
      // dictionary's .mdd must not survive into the new one. A picked .mdd only
      // invalidates the URL "unchanged" fingerprint. (.css is kept: it is an
      // explicit user choice and attachDict already refuses it unless the base
      // name matches the new .mdx.)
      if (kind === 'mdx') await clearSlotCompanions(slot, { keepCss: true });
      else await delFile(slot + '-mdx-meta').catch(() => {});
    } catch (storageErr) {
      alert('Could not save to device storage: ' + storageErr.message +
        ' — try loading only the .mdx (without .mdd), or a smaller file.');
      return;
    }
    const existing = state.dicts[slot];
    // An .mdx is a complete replacement: never re-attach a previously loaded
    // .mdd to it (its resources belong to the dictionary that was just replaced).
    const nextMdd = kind === 'mdd' ? file : null;
    const nextMdx = kind === 'mdx' ? file : existing?.mdxBlob ?? (await getFile(slot + '-mdx'));
    await attachDict(slot, nextMdx, nextMdd, { persist: false });
  } catch (e) {
    console.error(e);
    setStatus(slot, 'error: ' + e.message);
    alert('Could not load the file: ' + e.message);
  } finally {
    inp.value = '';
  }
}

/* ---------------- dict attach ---------------- */
/** "dicts/ldoce6.mdx" → "ldoce6" — used to pair a saved .css with its .mdx. */
function baseNameOf(n) {
  return String(n || '').replace(/\\+/g, '/').split('/').pop().replace(/\.(mdx|mdd|css)$/i, '').toLowerCase();
}

async function attachDict(slot, mdxBlob, mddBlob, { persist = false } = {}) {
  if (!mdxBlob) return;
  const name = mdxBlob.name || (slot + '.mdx');
  const mdx = await new MDict(mdxBlob, name).init();
  const mdd = mddBlob ? await new MDict(mddBlob, mddBlob.name || 'res.mdd').init() : null;
  // A manually saved .css (persisted as slot-css) re-applies to the dictionary it
  // belongs to: match by base file name (ldoce6.css ↔ ldoce6.mdx) so a stale
  // stylesheet never leaks into a different dictionary loaded into the slot.
  let bundledCss = '';
  try {
    const cssBlob = await getFile(slot + '-css');
    if (cssBlob && cssBlob.name && baseNameOf(cssBlob.name) === baseNameOf(mdxBlob.name)) {
      bundledCss = await cssBlob.text();
    }
  } catch (e) { /* no persisted css — fine */ }
  // C8: if the slot already held a dictionary, release its object URLs before
  // the entry is replaced — otherwise every later render holds the old blobs.
  revokeSlotUrls(slot);
  // Bounded LRU: an unbounded blob map on a multi-GB .mdd with hundreds of
  // images would grow for the lifetime of the tab.
  const entry = { mdx, mdd, mdxBlob, mddBlob, blobUrls: new Map(), blobUrlOrder: [], cssCache: new Map(), bundledCss };
  state.dicts[slot] = entry;
  invalidateGlossCache();

  // Always show which dictionary is REALLY in the slot. On a public deployment
  // the open-licensed dictionaries ARE the default, never a "fallback".
  const display = dictDisplayName(mdx);
  const nameEl = document.querySelector(`#panel-${slot} .dict-name`);
  if (nameEl) {
    nameEl.textContent = display;
    nameEl.title = `${display}\nSource file: ${mdx.name}`;
  }
  // U5: the chip always describes THIS file — a user's own .mdx has no chip.
  paintPanelLicence(slot, mdx.name);
  const frame = $('#frame-' + slot);
  frame.hidden = false;
  frame.querySelector('iframe').title = `${display} entry`;
  frame.querySelector('iframe').srcdoc = welcomeDoc(slot); // no dead white panel before the first search
  setStatus(slot, `${mdx.numEntries.toLocaleString('en-US')} entries`);
  $('#empty-state').classList.add('hidden');
  updateIdleDictState(); // U3: a dictionary is live — the lookup surface is real now

  // build key list in background for autocomplete
  mdx.loadAllKeys().catch(() => {});
  setView(rememberedView());
}

/** C16: decode HTML entities without a live DOM parsing sink. A <textarea>
 *  round-trip is a known HTML-injection foot-gun (its content is parsed as
 *  markup), so this uses DOMParser with a text/html document and then strips any
 *  tags the source string contained. */
function cleanTitle(t) {
  let text = String(t || '');
  try {
    const doc = new DOMParser().parseFromString('<div>' + text + '</div>', 'text/html');
    text = doc.body ? doc.body.textContent : text;
  } catch (e) { /* DOMParser unavailable (never in a browser) — fall back to raw text */ }
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || 'Dictionary';
}

// Friendly display names for known files — the raw .mdx title metadata is
// unreliable (it can be empty, a file name like "oald10.mdx", or very long).
// U5: the NAME only. Licences have their own chip (see LICENCES) so the two
// panels never mix "publisher" into one name and "licence" into the other.
const FRIENDLY_TITLES = {
  'oald10.mdx': 'Oxford Advanced Learner’s Dictionary (10th ed.)',
  'ldoce6.mdx': 'Longman Dictionary of Contemporary English (6th ed.)',
  'wordnet31.mdx': 'WordNet 3.1',
  'simple-en.mdx': 'Simple English Wiktionary',
  'star_anhviet.mdx': 'Từ điển Anh–Việt v1.1 (OVDP)',
};

// Open-licensed EN–VI dictionary shipped same-origin (OVDP via catusf/tudien,
// MIT) — one click downloads it into Slot 2 through the normal quick-load
// pipeline (progress + offline persistence included).
const ENVI_DICT = { url: 'dicts-en-vi/star_anhviet.mdx', name: 'star_anhviet.mdx', label: 'Từ điển Anh–Việt (OVDP)' };

function dictDisplayName(mdx) {
  return FRIENDLY_TITLES[mdx.name] || cleanTitle(mdx.title);
}

function setStatus(slot, text, loading = false) {
  const el = $('#status-' + slot);
  el.textContent = text;
  el.classList.toggle('loading', !!loading);
}

/* ---------------- v111: "did you mean" fuzzy chips (docs/plan-p2-fuzzy-practice.md) ----------------
 * Painted ONLY on a real miss — no exact entry AND no lemma/phrase fallback (renderSlot's
 * `no results found` branch). The engine (js/fuzzy.js) never runs per keystroke; the chip
 * row lives in the panel between the status line and the entry frame. Every failure mode
 * is silent: a slow or missing data file must never break the miss render. */
let builtWordsPromise = null;
function loadBuiltWords() {
  if (!builtWordsPromise) {
    builtWordsPromise = fetch('./data/built-words.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return builtWordsPromise;
}
function clearDidYouMean(slot) {
  const el = document.getElementById('dym-' + slot);
  if (el) el.remove();
}
async function showDidYouMean(slot, word) {
  const gen = lookupGen;
  try {
    const built = await loadBuiltWords();
    if (gen !== lookupGen) return;               // a newer lookup took over while we fetched
    if (document.getElementById('dym-' + slot)) return;
    if (!window.DSFuzzy) return;
    const keyLists = Object.keys(SLOTS)
      .map((s) => (state.dicts[s] && state.dicts[s].mdx && state.dicts[s].mdx.allKeys) || null)
      .filter(Boolean);
    // built-words.json = {v, source, count, words:[[word, band, rank, awl]]} — the
    // engine wants the ROWS; allKeys may still be building in the background (fine)
    const sug = window.DSFuzzy.suggestFor(word, built && built.words, keyLists, { limit: 3 });
    if (!sug.length) return;
    const frame = $('#frame-' + slot);
    if (!frame) return;
    const box = document.createElement('div');
    box.id = 'dym-' + slot;
    box.className = 'didyoumean';
    const label = document.createElement('span');
    label.className = 'didyoumean-label';
    label.textContent = i18n('search.didYouMean');
    box.appendChild(label);
    for (const s of sug) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s;
      b.addEventListener('click', () => { search(s); });
      box.appendChild(b);
    }
    frame.parentNode.insertBefore(box, frame);
  } catch (e) { /* suggestion is best-effort — the miss render is already done */ }
}

/* ---------------- search ---------------- */
/* R-D: where the current lookup came from. Only a Reader tap can move the result
 * to a part of speech or attach the tapped sentence, so this is set by the tap
 * alone and cleared by every other way into search() — a typed query renders
 * exactly as it always did. `word` is re-checked on render, so a stale tap can
 * never decorate a different lookup. */
let tapOrigin = null;   // { word, sentence, sourceTitle, sourceUrl }
let lookupGen = 0;      // one per lookup: re-renders of the same result stay one batch
let anchoredLookupGen = -1; // last lookup that opened a panel at a section (R-D)
let latestLookupEntries = { generation: 0, word: '', bySlot: {} };

/** The tap that produced this lookup, or null. */
function tapOriginFor(word) {
  if (!tapOrigin) return null;
  return normalizeText(tapOrigin.word) === normalizeText(word) ? tapOrigin : null;
}

async function search(word, fromReaderTap = false) {
  if (!fromReaderTap) tapOrigin = null;
  lookupGen++;
  latestLookupEntries = { generation: lookupGen, word: String(word || ''), bySlot: {} };
  // U1: submitting a search ends the suggestion session. Cancel any pending
  // debounce timer BEFORE it can re-open the dropdown over the results, and
  // record what was submitted so `suggest()` knows the value did not change.
  lastSubmittedQuery = String(word || '').trim().toLowerCase();
  hideSuggestions();
  for (const s of Object.keys(SLOTS)) clearDidYouMean(s);   // v111: a new lookup retires the old chips
  $('#search-input').value = word;
  $('#btn-clear').classList.toggle('hidden', !word);
  $('#btn-speak').disabled = !word.trim() || !TTS_SUPPORTED;
  $('#btn-save-word').disabled = !word.trim();
  updateSaveButtonState();
  updateSearchFilledState();
  // These two are NOT dictionary data — they are the search's own record of
  // the user's request: the user's own sentence for the word (staged by a
  // Reader tap) and the pronunciation strip. They must be painted BEFORE the
  // dictionary gate below, which would otherwise swallow them: with no
  // dictionary loaded, tapping a word in the Reader left "Save sentence"
  // enabled while the context bar explaining it stayed hidden and the pron
  // strip never appeared. History is recorded AFTER the lookup instead — and
  // only when it produced an entry (v116): a miss has no result to bring back
  // from "Recent", and the parked ?q= replay records on its own success.
  updateContextBar(word);
  updatePronStrip(word);
  // U3: with no dictionary loaded there is nothing to look up. Do not invite a
  // fake lookup: keep the honest not-loaded panel (CTA first) in charge and stop
  // before the lookup surface pretends to work.
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  const anyLoading = Object.keys(SLOTS).some((s) => state.loading[s]);
  if (!anyLoaded) {
    state.pendingQuery = word;   // C15: replayed after the boot dictionary restore
    updateIdleDictState();
    if (!anyLoading) {
      $('#empty-state')?.classList.remove('hidden');
      updateEmptyStateCopy();
      // v116: the submit itself must surface the guidance — the download card
      // can sit below the fold (or behind the closed keyboard) with the ghosted
      // Search button giving no other feedback.
      $('#empty-state')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }
  state.pendingQuery = null;
  updateIdleDictState();
  const gen = lookupGen;
  const found = await Promise.all(Object.keys(SLOTS).map((slot) => renderSlot(slot, word)));
  if (gen === lookupGen && found.some(Boolean)) pushHistory(word);
}

/** U3: the not-loaded state has ONE source of truth (body[data-dict-state]) and
 *  ONE vocabulary. Called whenever a dictionary is attached or the surface is
 *  (re)painted, so no view can contradict another. "loading" is derived, not
 *  stored: a download in flight is visible through state.loading, and the boot
 *  window (restoring a persisted dictionary) counts as loading too — otherwise a
 *  returning user would briefly be told "no dictionary loaded yet".
 *
 *  The field stays editable on purpose — the moment a download starts, typing
 *  while it runs is legitimate — but it is presented as inactive (search-box-idle)
 *  and both the Enter path and the Search button are gated (search() shows the
 *  download card instead of faking a lookup), so the surface never looks ready. */
const dictInit = { done: false };
let lastDictState = null;

/** v91: tabs carry REAL names — the slot-3 tab never shows the "Slot 3" jargon
 *  once a dictionary is loaded. (v97 dropped the "Both"/"Tất cả" tab with the
 *  stacked view: the tabs now pick the ONE dictionary to show, on all sizes.) */
function shortSlotLabel(slot) {
  const n = (document.querySelector(`#panel-${slot} .dict-name`)?.textContent || '').trim();
  if (slot === 'oxford' && /^WordNet/i.test(n)) return 'WordNet';
  if (slot === 'longman' && /Wiktionary/i.test(n)) return 'Wiktionary';
  if (/anh\s*[–-]?\s*vi|OVDP/i.test(n)) return i18n('envi.short');
  const words = n.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ') || i18n('slot.third');
}

function updateTabLabels() {
  for (const slot of Object.keys(SLOTS)) {
    const b = document.querySelector(`#view-switch button[data-view="${slot}"]`);
    if (b) b.textContent = slot === 'third' && !state.dicts.third ? i18n('slot.third') : shortSlotLabel(slot);
  }
}

function updateIdleDictState() {
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  const anyLoading = Object.keys(SLOTS).some((s) => state.loading[s]) || !dictInit.done;
  const st = anyLoaded ? 'ready' : (anyLoading ? 'loading' : 'idle');
  document.body.dataset.dictState = st;
  const form = $('#search-form');
  if (form) form.dataset.dictState = st;
  const box = document.querySelector('.search-box');
  if (box) box.classList.toggle('search-box-idle', st !== 'ready');
  // One neutral status convention per slot: a panel with no dictionary is a
  // neutral state, not an error — CSS keys off .has-dict, never off the accent.
  for (const slot of Object.keys(SLOTS)) {
    const panel = $('#panel-' + slot);
    if (panel) panel.classList.toggle('has-dict', !!state.dicts[slot]);
  }
  // The Search button is still clickable (it reveals the download card rather
  // than a fake result), so it announces itself as "not ready" instead of being
  // disabled — a disabled button would also kill Enter-to-submit. R-A: the paint
  // follows the announcement — CSS (.search-wrap .search-box-idle .btn-search)
  // renders it as a muted ghost until a dictionary is loaded, so the surface never
  // promises a lookup it cannot run.
  const btn = $('.btn-search');
  if (btn) btn.setAttribute('aria-disabled', String(st !== 'ready'));
  const gateText = i18n(!dictInit.done ? 'search.gateStarting' : (st === 'loading' ? 'search.gateLoading' : 'search.gateIdle'));
  // v116: the ghosted button explains itself on hover/focus too — the gate note
  // below the box scrolls away, the pointer lands on the button.
  if (btn) btn.title = st === 'ready' ? '' : gateText;
  const note = $('#search-gate-note');
  if (note) {
    if (st === 'ready') {
      note.classList.add('hidden');
      $('#search-input')?.removeAttribute('aria-describedby');
    } else {
      note.textContent = gateText;
      note.classList.remove('hidden');
      $('#search-input')?.setAttribute('aria-describedby', 'search-gate-note');
    }
  }
  // The mobile "results continue below" cue is owned by setView() — re-run it when
  // the state flips (ready ↔ not), so the cue appears exactly when a panel grid
  // with results exists and never over an empty grid.
  if (st !== lastDictState) {
    lastDictState = st;
    try { setView(rememberedView()); } catch (e) { /* early boot */ }
  }
  if (st !== 'idle') updateEmptyStateCopy();
  updateEnviHint();
  try { updateTabLabels(); } catch (e) { /* panel DOM may not exist during early boot */ }
  return st;
}

/** v78: the EN–VI one-click used to live only in the first-load card, which
 *  hides the moment a dictionary attaches — the students who need Vietnamese
 *  meanings most lost it by doing the expected thing. Show a quiet line above
 *  the panels while slot 3 is empty and a dictionary is loaded, until dismissed
 *  (remembered) or slot 3 fills. Hidden entirely when nothing is loaded yet —
 *  the first-load card already offers the same button there. */
function updateEnviHint() {
  const el = $('#envi-hint');
  if (!el) return;
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  let dismissed = false;
  try { dismissed = localStorage.getItem('envi-hint-dismissed') === '1'; } catch (e) { /* storage off */ }
  el.classList.toggle('hidden', !anyLoaded || !!state.dicts.third || dismissed);
}

/** Wording for the empty/not-loaded card — one place, so the panels, the card
 *  and the search field can never disagree. */
function updateEmptyStateCopy() {
  const msg = $('#empty-state-msg');
  if (!msg) return;
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  const anyLoading = Object.keys(SLOTS).some((s) => state.loading[s]);
  // ITEM A: a successful load ends on the ready line. The card is hidden as soon as
  // a dictionary is in a slot, but its copy must stop claiming that nothing is
  // loaded (or that a download is still running) — it used to fall through to the
  // idle wording the moment the first dictionary attached.
  if (anyLoaded && !anyLoading) { msg.textContent = i18n('firstload.done'); return; }
  if (anyLoading) {
    // ITEM A: while a download runs the card carries the LIVE figures (see
    // paintFirstLoadFigures). The static line is what is left before the first
    // byte lands — still honest, and the same copy as before this change.
    if (!paintFirstLoadFigures(msg)) msg.textContent = i18n('firstload.loading');
    return;
  }
  if (dataUnreachable) { msg.textContent = i18n('firstload.unreachable'); return; }
  msg.textContent = i18n('firstload.idle');
}

/** ITEM A — the first-load card is the element the user actually clicked, so while
 *  a download runs it shows the SAME live figures as that slot's status line:
 *  "Downloading WordNet 3.1… 19% (2.0 MB of 10.6 MB) · 0.1 MB/s · ≈ 3 min left".
 *  Before this the card said only "Loading the default dictionaries…" for the
 *  whole ~13 MB transfer, and on a phone the slot status line sits below the fold,
 *  so the one element on screen showed no number at all.
 *
 *  Two deliberate properties:
 *   - it reads the LAST tracker sample instead of calling fmtProgress(slot, …)
 *     again, because a second trackProgress() for the same byte count is a
 *     zero-progress window that would shrink the smoothed speed the panel line
 *     (the verified one) shows;
 *   - it names the dictionary through slotPanelName(), the same source the panel
 *     head uses, so the card can never promise "Oxford" while downloading WordNet.
 *  Returns false while there is nothing measured yet — the caller then keeps the
 *  static loading line. */
function paintFirstLoadFigures(msg) {
  const slot = Object.keys(SLOTS).find((s) => state.loading[s] && progressTrackers.has(s));
  if (!slot) return false;
  const p = progressTrackers.get(slot);
  if (!p.received) return false;
  // v91: slot 3 pre-load still carries the generic fallback label — the card must
  // name what is REALLY downloading (the open EN–VI dictionary), not "Slot 3".
  const name = (slot === 'third' && !state.dicts.third)
    ? (FRIENDLY_TITLES[ENVI_DICT.name] || ENVI_DICT.label)
    : slotPanelName(slot);
  msg.textContent = `${i18n('firstload.downloading')} ${name}… `
    + fmtProgressFigures(p.received, p.total, p.speed);
  return true;
}

/** ITEM A: repaint the card for one download sample. A no-op unless a download is
 *  really in flight, so a stray call can never overwrite other card copy. */
function paintFirstLoadProgress() {
  if (Object.keys(SLOTS).some((s) => state.loading[s])) updateEmptyStateCopy();
}

/** One download sample, two readers: the slot status line always gets the figures,
 *  and the first-load card gets them too whenever a download is what it shows. Both
 *  download helpers write their progress through here, so the line and the card can
 *  never drift apart. (The card itself only updates for the gate's quick-load, which
 *  is the flow that sets state.loading — the ⚙ Advanced URL loader does not, and by
 *  then loaded panels hide the card anyway.) */
function setDownloadStatus(slot, label, name, received, total) {
  setStatus(slot, `${label} ${name} — ${fmtProgress(slot, received, total)}`, true);
  paintFirstLoadProgress();
}

/** U4: a submitted query must not look like an empty (placeholder-grey) field.
 *  The filled state is announced with data-filled on the search box, styled in
 *  CSS, and mirrored by the clear button which is only useful once text exists. */
function updateSearchFilledState() {
  const box = document.querySelector('.search-box');
  if (!box) return;
  box.dataset.filled = ($('#search-input')?.value || '').trim() ? 'true' : 'false';
}

/** C15: run the ?q= handoff search as soon as dictionaries exist. A handoff that
 *  fired while nothing was loaded is parked on state.pendingQuery and replayed
 *  here — the query text is still in the box, so a silent failure never happens. */
async function replayPendingQuery() {
  const q = state.pendingQuery;
  if (!q) return false;
  if (!Object.keys(SLOTS).some((s) => state.dicts[s])) return false;
  if (($('#search-input')?.value || '').trim() !== q) { state.pendingQuery = null; return false; }
  state.pendingQuery = null;
  $('#empty-state')?.classList.add('hidden');
  updateContextBar(q);
  updatePronStrip(q);
  // v116: recorded only when the replayed lookup produced an entry — same rule
  // as a direct search.
  const found = await Promise.all(Object.keys(SLOTS).map((slot) => renderSlot(slot, q)));
  if (found.some(Boolean)) pushHistory(q);
  return true;
}

async function renderSlot(slot, word) {
  const d = state.dicts[slot];
  const frame = $('#frame-' + slot);
  if (!d) {
    const loading = state.loading[slot];
    setStatus(slot, loading ? 'still loading…' : 'not loaded');
    // Keep the frame hidden while nothing is loaded (the panel header + the
    // first-load card already explain the state) — this avoids a layout shift
    // when the iframe would otherwise appear after paint.
    frame.hidden = true;
    return false;
  }
  if (d.mdx.ext !== 'mdx') return false;
  const ifr = frame.querySelector('iframe');
  // every render invalidates the previous document's anchor report: the token is
  // what ties a late message to the render that asked for it
  delete ifr.dataset.anchorToken;
  anchorJumps.delete(ifr);
  // A NEW lookup opens at the top of the entry: on a phone the frame is a scroll
  // container whose offset survives the document swap, so without this a fresh
  // search could open halfway down the previous word's entry (R-D scrolls it by
  // design, but a user's own scroll had the same effect before). A re-render of
  // the SAME lookup — a panel switch, the dictionary finally arriving — keeps the
  // offset, exactly as it did before R-D.
  const gen = String(lookupGen);
  const isCurrent = () => gen === String(lookupGen) && state.dicts[slot] === d;
  if (ifr.dataset.renderGen !== gen) {
    frame.scrollTop = 0;
    ifr.dataset.renderGen = gen;
  }
  setStatus(slot, 'searching…', true);
  try {
    let hits = await d.mdx.lookup(word);
    if (!isCurrent()) return false;
    let note = '';
    let resolvedKey = word;   // R-D: the key the entry on screen really belongs to
    if (/\S\s+\S/.test(String(word || ''))) { const slug = String(word).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); note += `<div class="phrase-banner">Curated teaching senses (biên soạn gọn): <a href="https://dualdictionary.netlify.app/vi/tu/${slug}/" target="_blank" rel="noopener">/vi/tu/${slug}/</a> — raw dictionary entries follow below.</div>`; }
    if (!hits.length) {
      // U2: an inflected form ("called") must resolve to its base entry
      // ("call") — never to whatever longer key happens to contain the text
      // ("so-called"). Lemma + prefix matching runs first; plain containment is
      // the last resort and always says so.
      const lemma = await lookupLemmatized(d, word).catch(() => null);
      if (lemma) {
        hits = lemma.hits;
        resolvedKey = lemma.key;
        note = `<div class="phrase-banner">No exact entry for “${escapeHtml(word)}” — showing <b>${escapeHtml(lemma.key)}</b>.</div>`;
      } else {
        const fb = d.mdx.allKeys ? await phraseFallback(d, word).catch(() => null) : null;
        if (fb) {
          hits = fb.hits;
          resolvedKey = fb.key;
          note = `<div class="phrase-banner">No exact entry for “${escapeHtml(word)}” — showing <b>${escapeHtml(fb.key)}</b>.` +
            (fb.others.length ? ` Close matches: ${fb.others.map((o) => `<a data-search="${escapeHtml(o)}" href="#">${escapeHtml(o)}</a>`).join(', ')}` : '') +
            '</div>';
        }
      }
    }
    if (!isCurrent()) return false;
    if (!hits.length) {
      ifr.srcdoc = emptyDoc(slot, word);
      setStatus(slot, `no results found for "${word}"`);
      showDidYouMean(slot, word);
      return false;
    }
/** Exact-phrase priority: MDX StripKey merges spaces/hyphens/punctuation, so
 *  `take off` also matches `take-off` and the noun `takeoff`. Keep every hit
 *  (no data hidden) but render the exact spelling first and label merged
 *  variants, so phrasal-verb senses are not buried in noun/technical senses. */
function rankExactPhraseHits(word, hits) {
  const q = String(word || '').trim().toLowerCase();
  const normSpace = (k) => String(k || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normSpaceDash = (k) => normSpace(k).replace(/[\-‐‑‒–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const normStrip = (k) => normSpace(k).replace(/[\s\-.,:;!?'"()\[\]{}\/\\]/g, '');
  const scored = hits.map((h, i) => {
    const k = h.keyText || '';
    let rank = 3;
    if (normSpace(k) === q) rank = 0;
    else if (normSpaceDash(k) === normSpaceDash(q)) rank = 1;
    else if (normStrip(k) === normStrip(q)) rank = 2;
    return { h, i, rank };
  });
  scored.sort((a, b) => (a.rank - b.rank) || (a.i - b.i));
  return scored;
}
    const ranked = rankExactPhraseHits(resolvedKey, hits);
    latestLookupEntries.bySlot[slot] = ranked.map(({ h }) => ({
      slot,
      source: dictDisplayName(d.mdx),
      sourceFile: d.mdx.name || '',
      keyText: h.keyText || resolvedKey,
      raw: h.text,
    }));
    const html = ranked.map(({ h, rank }) => {
      const entry = formatEntry(h.text);
      if (rank === 0 || !/\S\s+\S/.test(String(word || ''))) return entry;
      if (rank === 1) return `<div class="phrase-banner">Spelling variant: <b>${escapeHtml(h.keyText || '')}</b> — exact “${escapeHtml(word)}” senses are shown first.</div>` + entry;
      return `<details class="mdx-variant"><summary>Merged entry: <b>${escapeHtml(h.keyText || '')}</b> (dictionary key rules ignore spaces/hyphens — tap to expand)</summary>` + entry + `</details>`;
    }).join('<hr class="mdx-sep">');
    // R-D: only a Reader tap on an inflected form (see tapPosHint) gets the POS
    // jump and the sentence block; everything else renders exactly as before.
    const tap = (tapOrigin && note) ? tapOriginFor(word) : null;
    const token = gen + ':' + slot;
    const built = await buildEntryDoc(d, note + html, tap ? {
      sentence: tap.sentence ? { text: tap.sentence, headword: word, source: tap.sourceTitle } : null,
      posHint: tapPosHint(word, resolvedKey),
      token,
    } : null);
    if (!isCurrent()) return false;
    ifr.srcdoc = built.doc;
    if (built.anchored) {
      ifr.dataset.anchorToken = token;
      anchoredLookupGen = lookupGen;
      anchorJumps.set(ifr, { until: performance.now() + ANCHOR_WINDOW_MS, gen: lookupGen, top: 0, moved: false });
    } else {
      delete ifr.dataset.anchorToken;
      anchorJumps.delete(ifr);
    }
    // R-G: the head reports the dictionary, never the fallback. It used to say
    // `showing "call"` while the entry's own notice banner already said
    // `No exact entry for "called" — showing call.` — the same fact twice, in two
    // places, in two wordings. The banner is the better statement (it names the
    // word that was typed and offers the close matches), so it is the only one now.
    setStatus(slot, `${d.mdx.numEntries.toLocaleString('en-US')} entries`);
    clearDidYouMean(slot);   // v111: the lookup recovered — chips have nothing to say here
    return true;
  } catch (e) {
    console.error(e);
    if (!isCurrent()) return false;
    // C4: the message is user/dictionary-controlled text — escape it before it
    // is interpolated into the frame document.
    ifr.srcdoc = `<p style="font-family:sans-serif;padding:16px">Error reading entry content: ${escapeHtml(e.message)}</p>`;
    setStatus(slot, 'lookup error');
    return false;
  }
}

/** The real display name of a slot — the panel header always reflects what is
 *  (or will be) loaded, so messages never promise "Oxford" while serving WordNet. */
function slotPanelName(slot) {
  return document.querySelector(`#panel-${slot} .dict-name`)?.textContent
    || (slot === 'oxford' ? 'WordNet 3.1' : 'Simple English Wiktionary');
}

/** U2: candidate base forms for an inflected word, most-likely first.
 *  Dictionary key lists are alphabetical, so this is a cheap deterministic rule
 *  set (no data, no dependency): "called" → ["called","call"], "studies" →
 *  ["studies","study","studie"], "running" → ["running","run","runn"], …
 *  The original word always comes first so an exact key still wins. */
function lemmaCandidates(word) {
  const w = String(word || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const out = [];
  const push = (s) => { if (s && s.length >= 2 && out.indexOf(s) === -1) out.push(s); };
  push(w);
  const cut = (base, suffixes, restored) => {
    for (const suf of suffixes) {
      if (w.length > suf.length + 1 && w.endsWith(suf)) push(w.slice(0, -suf.length) + restored);
    }
  };
  // irregular forms worth naming (the ones a rule set cannot guess)
  const IRREGULAR = {
    ran: 'run', went: 'go', gone: 'go', did: 'do', done: 'do', was: 'be', were: 'be', been: 'be',
    had: 'have', has: 'have', said: 'say', made: 'make', took: 'take', taken: 'take', gave: 'give',
    given: 'give', got: 'get', gotten: 'get', came: 'come', saw: 'see', seen: 'see', knew: 'know',
    known: 'know', thought: 'think', found: 'find', told: 'tell', felt: 'feel', left: 'leave',
    men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth', mice: 'mouse',
    better: 'good', best: 'good', worse: 'bad', worst: 'bad', those: 'that', these: 'this',
  };
  if (IRREGULAR[w]) push(IRREGULAR[w]);
  // ...-ies → ...-y
  cut('', ['ies'], 'y');
  // ...-ed → base / base+e / de-doubled consonant
  if (w.length > 3 && w.endsWith('ied')) push(w.slice(0, -3) + 'y');
  if (w.length > 3 && w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    push(stem);
    push(stem + 'e');
    if (/([bdfglmnprt])\1$/.test(stem)) push(stem.slice(0, -1));
    push(w.slice(0, -1)); // "moved" → "move", already covered by stem+'e'; keeps "liked"→"like"
  }
  // ...-ing → base / base+e / de-doubled consonant
  if (w.length > 4 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    push(stem);
    push(stem + 'e');
    if (/([bdfglmnprt])\1$/.test(stem)) push(stem.slice(0, -1));
  }
  // ...-es / ...-s (plural + 3rd person)
  if (w.length > 3 && w.endsWith('es')) push(w.slice(0, -2));
  if (w.length > 2 && w.endsWith('s')) push(w.slice(0, -1));
  if (w.length > 4 && w.endsWith('ses')) push(w.slice(0, -2)); // "classes" → "class"
  return out.filter((c) => c.length >= 2);
}

/** Look up `query`, walking its lemma candidates: exact first, then prefix
 *  matches on the lemma ("call" finds the "call" entry, not "so-called").
 *  Substring containment is deliberately NOT used here — that is the very
 *  fallback that turned "called" into "so-called". */
async function lookupLemmatized(d, query) {
  const tried = new Set();
  for (const cand of lemmaCandidates(query)) {
    if (tried.has(cand)) continue;
    tried.add(cand);
    const hits = await d.mdx.lookup(cand);
    if (hits.length) return { key: cand, hits, kind: 'exact' };
    if (d.mdx.allKeys) {
      const pfx = await lookupPrefixKey(d, cand);
      if (pfx) return { key: pfx.key, hits: pfx.hits, kind: 'prefix' };
    }
  }
  return null;
}

/** First dictionary key that starts with `cand` (binary-searched, so a 386k-key
 *  list costs ~19 comparisons instead of a full scan). */
async function lookupPrefixKey(d, cand) {
  const keys = d.mdx.allKeys;
  if (!keys || cand.length < 2) return null;
  let lo = 0, hi = keys.length - 1, start = keys.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].toLowerCase() >= cand) { start = mid; hi = mid - 1; } else lo = mid + 1;
  }
  for (let i = start; i < keys.length && i < start + 4; i++) {
    const k = keys[i].toLowerCase();
    if (!k.startsWith(cand)) break;
    if (/[\s(]/.test(k)) continue; // prefer the plain headword over "call (sb)"
    const hits = await d.mdx.lookup(keys[i]);
    if (hits.length) return { key: keys[i], hits };
  }
  return null;
}

/** Phrase search fallback: lemma lookups first, then the containment match
 *  ("look forward to" inside "look forward to sb") as the LAST resort.
 *  Returns the best candidate (shortest matching key = most specific headword)
 *  plus the other matching keys, or null when nothing matches / keys not loaded. */
async function phraseFallback(d, word) {
  const keys = d.mdx.allKeys;
  if (!keys) return null;
  const ql = word.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!ql) return null;
  const matches = [];
  for (let i = 0; i < keys.length && matches.length < 9; i++) {
    if (keys[i].toLowerCase().includes(ql)) matches.push(keys[i]);
  }
  if (!matches.length) return null;
  matches.sort((a, b) => a.length - b.length);
  const best = matches[0];
  const hits = await d.mdx.lookup(best);
  if (!hits.length) return null;
  return { key: best, hits, others: matches.slice(1, 7) };
}

/* ---------------- R-D: opening a tapped inflected form at its own part of speech ---------------- */
/* A Reader tap looks up a SURFACE form ("called") that the dictionary does not
 * contain, so the entry that comes back is its lemma's ("call") — and an entry
 * opens at its first section, which for "call" is a long NOUN block. The verb
 * senses the user actually tapped sit below the fold, with nothing on screen
 * tying the result to the sentence it came from. What fixes that is the lookup's
 * ORIGIN, and only that:
 *
 *   Reader tap on an inflected form → open the entry at the matching part of
 *     speech and carry the tapped sentence into the result, next to the senses.
 *   Everything else (typed search, history/suggestion click, entry cross-ref,
 *     exact hit) → unchanged: first section, no sentence block. `tapOrigin` is
 *     set by the tap and cleared by every other path into search().
 *
 * The heuristic, stated: a tap counts as an inflected form when
 *   (a) the dictionary has no entry for the tapped word itself — the lookup had
 *       to walk the lemma rules (the "no exact entry" banner is on screen), and
 *   (b) the tapped word ends in -ed / -ing AND the key the lookup resolved to is
 *       one that lemmaCandidates() itself proposed (so the guess rides on the
 *       same rules that found the entry).
 * -ed and -ing are English verb inflections and nothing else, so they imply
 * "verb". -s / -es is a plural noun OR a 3rd-person verb, and the irregulars
 * ("ran", "went") are past-tense verbs whose lemma may also be a noun — neither
 * identifies a part of speech, so no guess is made and the entry stays where it
 * opens. The hint only ever decides where the result is scrolled to: nothing is
 * hidden, reordered or dropped, and when the entry has no section with that part
 * of speech nothing moves at all. */
const POS_LABELS = {
  // heading text → part of speech. Exact matches cover the English dialect
  // (WordNet/Wiktionary: <p><i><u>verb</u></i></p>); the contains-entry covers the
  // Vietnamese MTD dialect (.mtd-pos: "ngoại động từ", "nội động từ").
  verb: { exact: ['verb', 'verbs'], contains: ['động từ'] },
};

/** Part of speech implied by a tapped inflected form, or null when the ending
 *  does not identify one. See the heuristic above. */
function tapPosHint(tapped, resolvedKey) {
  const w = String(tapped || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const k = String(resolvedKey || '').toLowerCase().trim();
  if (!w || !k || k === w || /\s/.test(w)) return null;   // exact hit or a phrase — never reposition
  if (w.length < 4 || !/(ed|ing)$/.test(w)) return null;
  const cands = lemmaCandidates(w);
  if (cands.indexOf(k) <= 0) return null;                  // resolved key is not one of the lemma's own candidates
  return 'verb';
}

/** The heading text of `el` when it is a heading-like element (leaves only, no
 *  block children), normalised for comparison — else ''. */
function posHeadingText(el) {
  if (el.querySelector('p,div,ol,ul,li,table,blockquote,section,article')) return '';
  const t = String(el.textContent || '').replace(/\s+/g, ' ').trim().replace(/^\*+\s*/, '').replace(/[\s.:;,–-]+$/, '');
  return t.length <= 24 ? t.toLowerCase() : '';
}

/** The first element in the entry that names the part of speech `pos`, or null.
 *  Entries are rendered by two different printers (raw HTML from the dictionary,
 *  and the MTD marker dialect converted by mtdToBlocks), so both dialects are
 *  matched on the TEXT of a heading-like element — never on a class name, which
 *  only one dialect has. */
function posSection(root, pos) {
  const alias = POS_LABELS[pos];
  if (!alias || !root) return null;
  for (const el of root.querySelectorAll('p,div,span,b,i,u,em,strong,dt,h1,h2,h3,h4,h5,h6')) {
    const t = posHeadingText(el);
    if (!t) continue;
    if (alias.exact.indexOf(t) !== -1 || alias.contains.some((c) => t.indexOf(c) !== -1)) return el;
  }
  return null;
}

/** The top-level child of `root` that contains `el` — the sentence block is
 *  inserted in front of a whole section, not inside it. */
function topLevelChild(root, el) {
  let n = el;
  while (n && n.parentNode !== root) n = n.parentNode;
  return n;
}

/** R-D: the sentence the word was tapped in, as a block for the entry document.
 *  Built as DOM (never as an HTML string) so dictionary text and the user's own
 *  sentence are both inserted as TEXT, and highlighted with the same <mark>
 *  convention as the context bar (U8). */
function sourceSentenceBlock(doc, sentence, headword, sourceTitle) {
  const block = doc.createElement('div');
  block.className = 'src-sentence';
  const label = doc.createElement('span');
  label.className = 'src-label';
  label.textContent = i18n('reader.srcLabel');
  const line = doc.createElement('p');
  line.className = 'src-text';
  line.appendChild(highlightHeadword(sentence, headword));
  block.appendChild(label);
  block.appendChild(line);
  if (sourceTitle && sourceTitle !== 'pasted') {
    const src = doc.createElement('span');
    src.className = 'src-source';
    src.textContent = i18n('reader.srcSource') + ' ' + sourceTitle;
    block.appendChild(src);
  }
  return block;
}

/** Format one raw MDX entry for display.
 *  - Entries already containing HTML pass through untouched (WordNet, LDOCE…)
 *  - Plain text in the classic Vietnamese MTD convention (@ domain, * part of
 *    speech, - sense, ! idiom — used by OVDP EN–VI data) is converted to
 *    structured HTML at render time. OVDP entries are a SINGLE line where the
 *    markers are the only structure, so tokenization is marker-driven, not
 *    line-driven: split before every @ * !, and at any dash preceded by a
 *    space (the MTD sense separator). The .mdx data stays untouched. */
function formatEntry(raw) {
  const text = String(raw || '').replace(/\u0000/g, '');
  if (/<\w/.test(text)) return text; // real HTML — leave alone
  if (!/(^|\s)[@*!]/.test(text)) {
    return '<p>' + escapeHtml(text.trim()).replace(/\n/g, '<br>') + '</p>';
  }
  return mtdToBlocks(text).map((b) => {
    const t = b.type === 'sense' ? b.text /* already escaped by crossref */ : escapeHtml(b.text);
    if (b.type === 'pos') return t ? `<div class="mtd-pos">${t}</div>` : '';
    if (b.type === 'domain') return t ? `<div class="mtd-domain">${t}</div>` : '';
    if (b.type === 'idiom') return `<div class="mtd-idiom"><b>${t}</b></div>`;
    if (b.type === 'sense') return t ? `<div class="mtd-sense">${t}</div>` : '';
    return t ? `<div class="mtd-line">${t}</div>` : '';
  }).join('\n');
}

/** Tokenize MTD-convention text into typed blocks. Sense separators are dashes
 *  preceded by whitespace ("quả táo - táo" or "kinh tế -táo"); "(xem) X"
 *  cross-references become tappable search links. */
function mtdToBlocks(text) {
  const blocks = [];
  const crossref = (s) => {
    const e = escapeHtml(s);
    return e.replace(/\(xem\)\s*([A-Za-z][^<>]*)$/, '(xem) <a data-search="$1" href="#">$1</a>');
  };
  for (const seg of text.split(/(?=[@*!])/)) {
    if (!seg) continue;
    const type = '@*!'.includes(seg[0]) ? seg[0] : '';
    const body = type ? seg.slice(1) : seg;
    const pieces = body.split(/\s+-\s*/).map((p) => p.trim()).filter(Boolean);
    if (!pieces.length) continue;
    if (type === '*') blocks.push({ type: 'pos', text: pieces[0] });
    else if (type === '@') blocks.push({ type: 'domain', text: pieces[0] });
    else if (type === '!') blocks.push({ type: 'idiom', text: pieces[0] });
    else if (pieces[0]) blocks.push({ type: 'line', text: pieces[0] });
    for (const p of pieces.slice(1)) blocks.push({ type: 'sense', text: crossref(p) });
  }
  // idiom senses may carry crossrefs too
  for (const b of blocks) {
    if (b.type === 'domain') b.text = b.text.replace(/\s+-\s*$/, '');
  }
  return blocks;
}

function emptyDoc(slot, word) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:#374151;padding:24px;text-align:center;line-height:1.7}
    b{color:#0f766e}
    .tips{color:#6b7280;font-size:14px}
  </style></head><body>
    <p>No entry found for <b>${escapeHtml(word)}</b> in ${escapeHtml(slotPanelName(slot))}.</p>
    <p class="tips">Check the spelling, or try a shorter form (e.g. “run” instead of “running”).<br>
       The other panel may still have a match for this word.</p>
  </body></html>`;
}

/** Friendly panel state right after a dictionary loads — never a dead white
 *  rectangle before the user's first search (backlog P1-02). */
/** v91: the entry docs follow the app's theme + language — they used to be a
 *  hard-coded light slab with English copy inside a dark VI interface. */
function docSkin() {
  const mode = localStorage.getItem('theme') || 'auto';
  let dark = mode === 'dark';
  if (mode === 'auto') {
    try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { /* very old engines */ }
  }
  return dark
    ? { bg: '#161d24', fg: '#d7dde3', link: '#2dd4bf' }
    : { bg: '#fbfcfe', fg: '#374151', link: '#0f766e' };
}

function welcomeDoc(slot) {
  const s = docSkin();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:${s.fg};padding:24px;text-align:center;line-height:1.7;background:${s.bg}}
    b{color:${s.link}} .icon{font-size:34px;margin-bottom:2px}
  </style></head><body>
    <p class="icon">📖</p>
    <p><b>${escapeHtml(slotPanelName(slot))}</b> ${escapeHtml(i18n('panel.ready'))}</p>
    <p>${escapeHtml(i18n('panel.readyHint'))}</p>
  </body></html>`;
}

function notLoadedDoc(slot) {
  const s = docSkin();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:${s.fg};padding:24px;text-align:center;line-height:1.6}
    b{color:${s.link}}
  </style></head><body>
    <p><b>${escapeHtml(slotPanelName(slot))}</b> ${escapeHtml(i18n('panel.notLoaded'))}</p>
    <p>${escapeHtml(i18n('panel.notLoadedHint'))}</p>
  </body></html>`;
}

function loadingDoc(slot) {
  const p = progressTrackers.get(slot);
  const eta = p && p.speed > 0 && p.total > p.received ? ` — ${fmtEta((p.total - p.received) / p.speed)}` : '';
  const s = docSkin();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:${s.fg};padding:24px;text-align:center;line-height:1.6}
    b{color:${s.link}}
  </style></head><body>
    <p><b>${escapeHtml(slotPanelName(slot))}</b> ${escapeHtml(i18nFmt('panel.loadingRes', { eta }))}</p>
    <p>${escapeHtml(i18n('panel.loadingResHint'))}</p>
  </body></html>`;
}

/* ---------------- entry rendering ---------------- */
/**
 * Build a full HTML document for the iframe:
 * - strip <script>
 * - inline CSS files referenced by <link> from the MDD
 * - rewrite image/audio src/href to blob URLs from the MDD
 * - R-D: when `opts` asks for it, mark the section of `opts.posHint` and put
 *   `opts.sentence` in front of it, then report that section's offset back to
 *   the parent so it can scroll the result there. Returns { doc, anchored }.
 */
async function buildEntryDoc(d, html, opts) {
  const o = opts || {};
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  // MDX content is UNTRUSTED (dictol-style): strip executable & embed vectors;
  // the iframe sandbox + CSP are the real boundary, this is defense in depth.
  parsed.querySelectorAll('script, iframe, object, embed, link[rel="import"], base').forEach((el) => el.remove());
  for (const el of parsed.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase();
      const v = attr.value.trim().toLowerCase();
      if (n.startsWith('on') || (n === 'href' && v.startsWith('javascript:')) || n === 'srcdoc') {
        el.removeAttribute(attr.name);
      }
    }
  }

  // R-D: mark the section to open at, and carry the tapped sentence. Both run
  // after the sanitize pass — they are app-authored nodes, not dictionary text —
  // and the sentence goes in FRONT of the marked section, so scrolling to the
  // marker puts the sentence and the senses on screen together.
  let anchor = 0;
  if (o.posHint && o.token) {
    const sec = posSection(parsed.body, o.posHint);
    if (sec) {
      sec.setAttribute('data-lookup-anchor', o.posHint);
      anchor = o.token;
    }
  }
  if (o.sentence) {
    const block = sourceSentenceBlock(parsed, o.sentence.text, o.sentence.headword, o.sentence.source);
    const at = anchor ? topLevelChild(parsed.body, parsed.body.querySelector('[data-lookup-anchor]')) : parsed.body.firstChild;
    parsed.body.insertBefore(block, at || null); // null = append (empty entry)
  }

  // stylesheets
  const styles = [];
  for (const link of parsed.querySelectorAll('link[href]')) {
    const href = link.getAttribute('href');
    link.remove(); // always drop dangling <link> — it cannot resolve inside a srcdoc iframe
    const cssText = await resolveResourceText(d, href);
    if (cssText) styles.push(await inlineCssUrls(d, cssText));
  }

  // images
  for (const img of parsed.querySelectorAll('img[src]')) {
    const url = await resolveResourceUrl(d, img.getAttribute('src'));
    if (url) img.setAttribute('src', url);
  }

  // U6: a wide table keeps its own layout but scrolls inside the panel, so the
  // 68ch measure applied to text blocks never clips entry data.
  for (const t of [...parsed.querySelectorAll('table')]) {
    const wrap = parsed.createElement('div');
    wrap.className = 'tbl-wrap';
    t.replaceWith(wrap);
    wrap.appendChild(t);
  }

  // audio links: sound://xxx.mp3, or href ending in audio ext
  for (const a of parsed.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/^(?:sound|audio|bword)?:\/\/(.+)$/i) ||
             (/^(?:[^#]*\.(mp3|wav|ogg|aac|m4a))(?:\?|#|$)/i.test(href) ? [, href] : null);
    if (m) {
      const url = await resolveResourceUrl(d, m[1]);
      if (url) {
        // Play button instead of an <audio controls> element: idle players show
        // "0:00 / 0:00", which reads as broken. Audio loads on demand.
        const btn = parsed.createElement('button');
        btn.type = 'button';
        btn.className = 'audio-btn';
        btn.textContent = '🔊 Play';
        btn.dataset.audio = url;
        a.replaceWith(btn);
      } else {
        a.removeAttribute('href');
        a.style.opacity = '.5';
        a.title = 'Audio not found in the .mdd (or no .mdd loaded)';
      }
    } else if (href.startsWith('entry://') || href.startsWith('bword://')) {
      // internal links → let parent search
      const word = decodeURIComponent(href.replace(/^[^:]+:\/\//, '')).replace(/^\//, '');
      a.setAttribute('href', '#');
      a.dataset.search = word;
    }
  }

  const rawBody = parsed.body.innerHTML;
  const body = rawBody.replace(/\bvirr\+/gi, ''); // display cleanup: strip raw MDX grammar codes leaked as text (e.g. take-off entry); dictionary data itself is unchanged
  const css = [...styles, d.bundledCss || ''].join('\n');
  const htmlDoc = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data: blob:">
<style>
  html{background:#fff;color:#1a1a1a;-webkit-text-size-adjust:100%;color-scheme:light}
  /* R-E: bottom reserve. The frame is a scroll container whose bottom edge sits
     just above the fixed bottom nav on a phone; 20px left the entry's last line
     visually flush against that edge (and against the nav on devices with a home
     indicator). 28px + the device's own inset keeps a real gap under the final
     line, and it lands inside the document so it survives every frame height. */
  body{font-family:Georgia,'Times New Roman',serif;padding:14px 16px calc(28px + env(safe-area-inset-bottom,0px));margin:0 auto;
    overflow-wrap:break-word;color:#1a1a1a;background:#fff;line-height:1.55}
  /* U6: readable line measure. On a 1440px screen a panel is ~660px wide, which
     measured 75 characters per line in this serif face — past the comfortable
     range. Text blocks are capped at 58ch (the ch unit is the "0" glyph, wider
     than the average character: 58ch ≈ 576px ≈ 67 characters of real prose here,
     dead centre of the 60–70 target). Wide entry furniture (tables, images, media)
     keeps the full panel width instead of being squeezed into that column. */
  p,li,dd,dt,blockquote,.mtd-line,.mtd-sense,.mtd-idiom,.mtd-pos,.mtd-domain{max-width:58ch}
  .tbl-wrap{max-width:100%;overflow-x:auto}
  h1,h2,h3{line-height:1.25}
  a{color:#0f766e}
  .audio-btn{border:1px solid #0f766e;color:#0f766e;background:#fff;border-radius:999px;
    padding:2px 10px;font:inherit;font-size:.9em;cursor:pointer;margin:0 2px;vertical-align:middle}
  .audio-btn:disabled{opacity:.5;cursor:default}
  .mdx-sep{border:none;border-top:1px solid #ddd;margin:18px 0}
  img{max-width:100%}
  .phrase-banner{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;
    padding:8px 12px;margin:0 0 12px;font-family:-apple-system,sans-serif;font-size:.85em;
    line-height:1.5;color:#134e4a}
  .phrase-banner a{color:#0f766e;cursor:pointer;text-decoration:underline}
  .mdx-variant{border:1px solid #e5e7eb;border-radius:8px;margin:8px 0;padding:4px 10px;background:#f9fafb}
  .mdx-variant summary{cursor:pointer;color:#0f766e;font-size:14px}
  /* R-D: the sentence a word was tapped in, riding in the result itself. Same
     teal family as .phrase-banner (this document is always light "paper"), so it
     reads as app-authored furniture and never as part of the dictionary text. */
  .src-sentence{background:#f0fdfa;border:1px solid #99f6e4;border-left:3px solid #0f766e;border-radius:8px;
    padding:8px 12px;margin:0 0 14px;font-family:-apple-system,sans-serif;font-size:.85em;line-height:1.5;color:#134e4a}
  .src-sentence .src-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;
    letter-spacing:.05em;color:#0f766e;margin-bottom:2px}
  .src-sentence .src-text{margin:0;max-width:58ch}
  .src-sentence .src-source{display:block;margin-top:3px;font-size:11px;color:#6b7280}
  .src-sentence mark{background:#fde68a;color:#513c06;padding:0 1px;border-radius:3px}
  .mtd-pos{font-weight:700;color:#0f766e;margin:10px 0 4px;font-family:-apple-system,sans-serif;font-size:.9em}
  .mtd-domain{font-weight:600;color:#6b7280;margin:12px 0 4px;font-family:-apple-system,sans-serif;font-size:.82em;
    text-transform:uppercase;letter-spacing:.04em}
  .mtd-sense{padding-left:14px;position:relative;margin:4px 0}
  .mtd-sense::before{content:'–';position:absolute;left:0;color:#0f766e}
  .mtd-idiom{margin:6px 0;padding-left:14px}
  .mtd-idiom b{color:#134e4a}
  .mtd-line{margin:4px 0}
</style>
<style>${css}</style>
</head><body>${body}<script>var AT=${JSON.stringify(anchor ? String(anchor) : '')};
function rp(){
  try{
    parent.postMessage({type:'resize',h:Math.ceil(document.documentElement.scrollHeight)},'*');
  }catch(e){}
}
function anchorPost(){
  var a=document.querySelector('[data-lookup-anchor]');
  if(!a||!AT)return;
  var s=document.querySelector('.src-sentence');
  var r=a.getBoundingClientRect();
  try{
    parent.postMessage({type:'anchor',token:AT,
      top:Math.max(0,Math.round(s?s.getBoundingClientRect().top:r.top))},'*');
  }catch(e){}
}
addEventListener('load',rp);
document.fonts&&document.fonts.ready.then(rp);
setTimeout(rp,400);setTimeout(rp,1500);
if(window.ResizeObserver){new ResizeObserver(rp).observe(document.documentElement);}
/* R-D: report as soon as the entry is laid out (before the first paint, so the
   result does not flash at its top first), then re-report on reflow — the frame
   is cross-origin, so this offset is the only way the parent can scroll to it. */
anchorPost();
addEventListener('load',anchorPost);
document.fonts&&document.fonts.ready.then(anchorPost);
setTimeout(anchorPost,600);
document.addEventListener('click',function(e){
  var b=e.target.closest('button.audio-btn');
  if(b){
    if(b._a){try{b._a.pause();}catch(x){}}
    b.textContent='⏳ Loading…';
    var a=new Audio(b.dataset.audio);
    b._a=a;
    a.addEventListener('playing',function(){b.textContent='⏸ Playing…';});
    a.addEventListener('ended',function(){b.textContent='🔊 Play';});
    a.addEventListener('error',function(){b.textContent='🔊 Unavailable';b.disabled=true;});
    a.play().catch(function(){b.textContent='🔊 Play';});
    return;
  }
  var a2=e.target.closest('a[data-search]');
  if(a2){e.preventDefault();parent.postMessage({type:'search',word:a2.dataset.search},'*');return;}
  var a3=e.target.closest('a[href^="http"]');
  if(a3){e.preventDefault();parent.postMessage({type:'open-external',url:a3.href},'*');}
});<\/script></body></html>`;
  return { doc: htmlDoc, anchored: anchor };
}

/* message from iframes: internal link search + auto height.
 * C5 defense-in-depth: entry iframes are sandboxed without allow-same-origin, so
 * they report the opaque origin "null"; we accept only that or our own origin
 * (never "*"), and always re-check the sender is one of OUR frames. */
window.addEventListener('message', (e) => {
  if (!e.origin || IFRAME_MESSAGE_ORIGINS.indexOf(e.origin) === -1) return;
  if (e.data?.type === 'search' && e.data.word) {
    const fromEntryFrame = [...document.querySelectorAll('.entry-frame iframe')].some((f) => f.contentWindow === e.source);
    if (!fromEntryFrame) return;
    search(String(e.data.word));
    return;
  }
  if (e.data?.type === 'open-external' && typeof e.data.url === 'string') {
    const fromEntryFrame = [...document.querySelectorAll('.entry-frame iframe')].some((f) => f.contentWindow === e.source);
    if (!fromEntryFrame) return;
    if (!/^https:\/\/dualdictionary\.netlify\.app\/vi\/tu\//.test(e.data.url)) return;
    window.open(e.data.url, '_blank', 'noopener');
    return;
  }
  if (e.data?.type === 'resize' && e.data.h) {
    const frame = [...document.querySelectorAll('.entry-frame iframe')]
      .find((f) => f.contentWindow === e.source);
    if (frame) {
      const h = Math.min(Math.max(e.data.h + 28, 280), 20000);
      frame.style.height = h + 'px';
      // R-D: the frame just changed height, so the page grew and an earlier
      // scroll to a section may have been clamped by the (then shorter) document.
      // Re-place it — this is a layout event, not a user scroll.
      const st = anchorJumps.get(frame);
      if (st && typeof st.top === 'number') jumpResultToAnchor(frame, st.top);
    }
    return;
  }
  if (e.data?.type === 'anchor' && typeof e.data.top === 'number') {
    const frame = [...document.querySelectorAll('.entry-frame iframe')]
      .find((f) => f.contentWindow === e.source);
    // the token ties the report to the render that asked for it — a late message
    // from a document that has already been replaced is ignored, not acted on
    if (frame && frame.dataset.anchorToken === String(e.data.token)) jumpResultToAnchor(frame, e.data.top);
  }
});

/* ---------------- R-D: bringing a marked section into the visible result ---------------- */
/* The entry is rendered inside a sandboxed iframe, so the parent cannot read (or
 * set) anything in there — the frame reports the offset of the section it was
 * asked to open at, and this is the one place that turns that offset into
 * pixels. Two scroll containers are involved depending on the layout:
 *   - phone (<900px): `.dict-panel` is capped at 78vh, so `.entry-frame` is the
 *     scroll container and the frame inside it is as tall as the entry;
 *   - desktop: nothing caps the panel, the frame is content-height and the
 *     WINDOW scrolls.
 * So the frame's own container is scrolled first (a no-op on desktop), and then
 * the result is brought under the sticky header. With two panels side by side on
 * desktop only one window position exists, and the anchors are at different
 * depths: the DEEPEST one wins, because it is the one that would otherwise stay
 * below the fold (the shallower panels show their section from the entry's own
 * top anyway). */
const ANCHOR_WINDOW_MS = 3000;
const ANCHOR_LEAD = 8;
const anchorJumps = new Map();   // iframe -> { until, gen, winY, frameTop, moved }
let anchorDeepest = { gen: '', depth: -1, iframe: null };

/** The bottom of the sticky header stack — where visible content starts. */
function anchorVisibleTop() {
  let y = 0;
  for (const el of [document.querySelector('.topbar'), document.querySelector('.search-wrap')]) {
    if (!el || el.classList.contains('hidden')) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.bottom > 0) y = Math.max(y, r.bottom);
  }
  return Math.round(y) + ANCHOR_LEAD;
}

function jumpResultToAnchor(iframe, top) {
  const scroller = iframe.closest('.entry-frame');
  const st = anchorJumps.get(iframe);
  if (!scroller || !st) return;
  if (performance.now() > st.until) { anchorJumps.delete(iframe); return; }
  // the user moved the result (or the page) after we last did: they are reading,
  // so stop correcting and leave the view alone
  if (st.moved && (Math.round(scroller.scrollTop) !== st.frameTop || Math.round(window.scrollY) !== st.winY)) {
    anchorJumps.delete(iframe);
    return;
  }
  const target = Math.max(0, Math.round(top));
  st.top = target;
  // Depth of the section inside the PAGE. Measured on the scroll container, not
  // on the (already scrolled) frame element, so it does not change when the
  // container scrolls — this is the quantity the two panels are compared on.
  const depth = Math.round(scroller.getBoundingClientRect().top + window.scrollY + target);
  // 1. the frame's own container (a no-op on desktop, where nothing caps the panel)
  const scrollsInside = scroller.scrollHeight > scroller.clientHeight + 4;
  if (scrollsInside) scroller.scrollTop = Math.max(0, target - ANCHOR_LEAD);
  // 2. the page: only the DEEPEST anchor of this lookup may move it (with two
  //    panels side by side there is one window position, and the deepest anchor
  //    is the one that would otherwise stay below the fold), and only when it is
  //    not already on screen — on a phone the tapped panel is usually in view
  //    already (U7 revealed it), so the frame's own scroll is the whole fix there
  //    and the page must not be yanked around under the user.
  if (st.gen !== anchorDeepest.gen) anchorDeepest = { gen: st.gen, depth: -1, iframe: null };
  if (depth >= anchorDeepest.depth) { anchorDeepest.depth = depth; anchorDeepest.iframe = iframe; }
  if (anchorDeepest.iframe === iframe) {
    const y = iframe.getBoundingClientRect().top + target;
    const vTop = anchorVisibleTop();
    // A frame that scrolls inside a capped panel (phone) can keep the panel's own
    // head on screen with the section — the head sits directly above the frame and
    // the frame's visible top IS the section, so the page is left with the head
    // showing and the sentence just under it. On desktop the head is at the top of
    // an entry the page has scrolled 900px into: it cannot be on screen with a
    // deep section, so the sentence alone takes the top of the visible area.
    const head = scrollsInside ? iframe.closest('.dict-panel')?.querySelector('.panel-head') : null;
    const lead = head ? Math.round(head.getBoundingClientRect().height) : 0;
    const headShown = !head || Math.round(head.getBoundingClientRect().top) >= vTop - 1;
    if (!headShown || y < vTop + 2 || y > (window.innerHeight || 0) - 80) {
      window.scrollBy({ top: Math.round(y - vTop - lead), behavior: 'auto' });
    }
  }
  st.frameTop = Math.round(scroller.scrollTop);
  st.winY = Math.round(window.scrollY);
  st.moved = true;
}

/* ---------------- MDD helpers ---------------- */
function resourceCandidates(path) {
  const clean = String(path).replace(/^(?:sound|audio|bword|entry)?:\/+/i, '').replace(/^\/+/, '');
  const base = clean.split('/').pop();
  // MDD keys often use backslash separators (e.g. \hwd\bre\6\run_up0205.mp3)
  const bs = clean.replace(/\//g, '\\');
  const bsLower = bs.toLowerCase();
  const list = [clean, '/' + clean, '\\' + clean, bs, '\\' + bs, '\\' + bsLower];
  for (const c of [clean, base]) {
    const lower = c.toLowerCase();
    list.push('\\' + lower, '\\' + c);
  }
  return [...new Set(list)];
}

/** C8: blob URL cap per dictionary. Large .mdd files carry thousands of audio
 *  clips and images; an eviction cap keeps memory flat while a whole document
 *  (typically a few dozen resources) still hits the cache. */
const BLOB_URL_MAX = 400;

/** MDD bytes → object URL. Object URLs are used instead of base64 `data:` URIs:
 *  no 33% size inflation, no multi-MB strings held twice (source + base64), and
 *  the browser can stream/discard a blob instead of materialising a whole
 *  document's worth of base64. Each URL is revoked when its dictionary is
 *  replaced, and the oldest are revoked past BLOB_URL_MAX. */
function bytesToObjectUrl(bytes, mime) {
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

async function resolveResourceUrl(d, path) {
  if (!d || !d.mdd || !path) return null;
  const key = path;
  if (d.blobUrls.has(key)) return d.blobUrls.get(key);
  for (const cand of resourceCandidates(path)) {
    try {
      const hits = await d.mdd.lookup(cand);
      if (hits.length) {
        const bytes = hits[0].bytes;
        const ext = (cand.split('.').pop() || '').toLowerCase();
        const mime = { css: 'text/css', js: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2' }[ext] || 'application/octet-stream';
        const url = bytesToObjectUrl(bytes, mime);
        d.blobUrls.set(key, url);
        if (!d.blobUrlOrder) d.blobUrlOrder = [];
        d.blobUrlOrder.push(key);
        // LRU bound: revoke the oldest entries once the cap is exceeded. An
        // evicted URL that is still referenced by a mounted document is only
        // reloaded on the NEXT render of that entry, so nothing breaks.
        while (d.blobUrlOrder.length > BLOB_URL_MAX) {
          const old = d.blobUrlOrder.shift();
          const oldUrl = d.blobUrls.get(old);
          if (oldUrl && oldUrl !== url) {
            d.blobUrls.delete(old);
            try { URL.revokeObjectURL(oldUrl); } catch (e) { /* ignore */ }
          }
        }
        return url;
      }
    } catch (e) { /* keep trying */ }
  }
  return null;
}

async function inlineCssUrls(d, cssText) {
  let out = cssText;
  for (const m of [...cssText.matchAll(/url\((['"]?)([^)'"]+?)\1\)/gi)]) {
    const url = await resolveResourceUrl(d, m[2]);
    if (url) out = out.split(m[0]).join('url("' + url + '")');
  }
  return out;
}

async function resolveResourceText(d, path) {
  if (!d || !d.mdd || !path) return null;
  if (d.cssCache.has(path)) return d.cssCache.get(path);
  const url = await resolveResourceUrl(d, path);
  let text = null;
  if (url) text = await (await fetch(url)).text();
  d.cssCache.set(path, text);
  return text;
}

/* ---------------- suggestions ---------------- */
/* U1 invariant: the dropdown may only be OPEN while the search input holds focus
 * AND its value differs from the last submitted query. Submitting a search
 * (which is what happened before every "dropdown covers the results" report)
 * cancels the pending debounce timer and hides the box in the same tick, so a
 * timer that was already scheduled can never re-open it afterwards. */
let suggestTimer = null;
let lastSubmittedQuery = ''; // lowercase; set by search(), cleared when the value changes

function queryChangedSinceSubmit() {
  const v = ($('#search-input')?.value || '').trim().toLowerCase();
  return v !== lastSubmittedQuery;
}

function hideSuggestions() {
  clearTimeout(suggestTimer);
  suggestTimer = null;
  $('#suggestions')?.classList.add('hidden');
  $('#search-input')?.setAttribute('aria-expanded', 'false');
}

function suggest(q) {
  clearTimeout(suggestTimer);
  suggestTimer = null;
  $('#search-input').setAttribute('aria-expanded', 'false');
  if (!q || q.length < 2) { $('#suggestions').classList.add('hidden'); return; }
  suggestTimer = setTimeout(() => {
    suggestTimer = null;
    // the user may have submitted, blurred, or cleared while the timer ran
    if (document.activeElement !== $('#search-input')) return;
    if (($('#search-input').value || '').trim().length < 2) return;
    if (!queryChangedSinceSubmit()) return;
    const ql = q.toLowerCase();
    const out = [];
    const seen = new Set();
    const MAX = 14; // collect a few extra so we can show a "more results" hint
    for (const slot of Object.keys(SLOTS)) {
      const keys = state.dicts[slot]?.mdx?.allKeys;
      if (!keys) continue;
      // binary search start
      let lo = 0, hi = keys.length - 1, start = keys.length;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (keys[mid].toLowerCase() >= ql) { start = mid; hi = mid - 1; } else lo = mid + 1;
      }
      for (let i = start; i < keys.length && out.length < MAX; i++) {
        const k = keys[i].toLowerCase();
        if (!k.startsWith(ql)) break;
        if (!seen.has(k)) { seen.add(k); out.push(keys[i]); }
      }
      // Phrase matching: multi-word queries (or thin prefix results) also match
      // keys that CONTAIN the phrase anywhere — "look forward to" finds
      // "look forward to somebody". Prefix matches stay first in the list.
      const wantsPhrase = ql.includes(' ') || out.length < 3;
      if (wantsPhrase && ql.length >= 3) {
        for (let i = 0; i < keys.length && out.length < MAX; i++) {
          const k = keys[i].toLowerCase();
          if (k.includes(ql) && !seen.has(k)) { seen.add(k); out.push(keys[i]); }
        }
      }
    }
    const box = $('#suggestions');
    box.innerHTML = '';
    // U12: never offer a suggestion identical to what is already typed — the user
    // gains nothing from a row that just repeats the query. Compared on a
    // NORMALISED form (trim + collapsed inner spaces + case), so a stray trailing
    // space or double space cannot slip the duplicate back into the list.
    const qnorm = String(q).trim().replace(/\s+/g, ' ').toLowerCase();
    const shown = out.filter((w) => String(w).trim().replace(/\s+/g, ' ').toLowerCase() !== qnorm);
    if (!shown.length) { box.classList.add('hidden'); return; }
    const SHOWN = 6; // keep the dropdown compact — panels must stay visible
    const visible = shown.slice(0, SHOWN);
    const hasMore = shown.length > SHOWN;
    const addOption = (word, cls, label) => {
      const div = document.createElement('div');
      if (cls) div.className = cls;
      div.textContent = label || word;
      div.setAttribute('role', 'option');
      div.id = 'sug-' + box.children.length;
      div.setAttribute('aria-selected', 'false');
      div.dataset.word = word;
      div.addEventListener('mousedown', (e) => { e.preventDefault(); search(word); });
      box.appendChild(div);
    };
    for (const w of visible) addOption(w);
    if (hasMore) { const qTrim = String(q).trim(); addOption(qTrim, 'sug-more', `Show more results for “${qTrim}”`); }
    box.classList.remove('hidden');
    $('#search-input').setAttribute('aria-expanded', 'true');
  }, 120);
}

/* ---------------- history ---------------- */
function pushHistory(word) {
  state.history = [word, ...state.history.filter((w) => w !== word)].slice(0, 24);
  localStorage.setItem('history', JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  const wrap = $('#history');
  const box = $('#history-chips');
  box.innerHTML = '';
  if (!state.history.length) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  for (const w of state.history) {
    const b = document.createElement('button');
    b.textContent = w;
    b.title = '';
    quickGloss(w).then((g) => { if (g) b.title = w + ' — ' + g; });
    b.addEventListener('click', () => search(w));
    box.appendChild(b);
  }
}

/* ---------------- text-to-speech ---------------- */
function speak(word, btn) {
  if (!word) return;
  if (!TTS_SUPPORTED) { showToast('Text-to-speech is not supported by this browser'); return; }
  speechSynthesis.cancel(); // stop anything already queued/speaking
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = ttsRate;
  if (btn) {
    btn.classList.add('playing');
    btn.setAttribute('aria-busy', 'true');
    const done = () => { btn.classList.remove('playing'); btn.removeAttribute('aria-busy'); };
    u.addEventListener('end', done);
    u.addEventListener('error', done);
  }
  speechSynthesis.speak(u);
}

/* ---------------- reader (Phase 2) ---------------- */
let readerSelection = null; // { word, sentence, source, sourceUrl } — the last tapped word
let readerCtx = null;       // Context layer (P1): { headword, sentence, sourceTitle, sourceUrl }

function openReader() {
  $('#reader')?.classList.remove('hidden');
  $('#reader-input-wrap')?.classList.remove('hidden');
  $('#reader-input')?.focus();
  const btn = $('#btn-save-sentence');
  if (btn) btn.title = 'Tap a word in the text first';
  setReaderMsg('Tap any word to look it up below — then “⭐ Save sentence” keeps its original sentence.');
}

function closeReader() {
  $('#reader')?.classList.add('hidden');
}

function setReaderMsg(text) {
  const el = $('#reader-msg');
  if (el) el.textContent = text || '';
}

/* C9: one <span class="rw"> per word is what makes tap-to-lookup work, but an
 * EPUB/PDF-length document is tens of thousands of spans — building them all in
 * one go locked the tab. Spans are now appended in bounded batches (the first
 * batch runs synchronously, so a tap immediately after the click still finds its
 * word) and the word count is accumulated from the tokens as they are created,
 * instead of re-reading the whole pane's textContent and re-splitting it. */
const READER_CHUNK_WORDS = 4000;
let readerRenderSeq = 0;    // bumped per render — a stale batch stops instead of mixing two documents
let readerChunkTimer = null;

/* v74: live reading pace — a session-only timer that runs while the reading pane
 * is actually on screen. The tick stops itself the moment the pane is hidden
 * (re-edit, another route) so the wpm figure only counts real reading time. */
let readerTimer = { start: 0, words: 0, interval: null };

function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function readerTimerTick() {
  const el = $('#reader-timer');
  const pane = $('#reader-text');
  if (!el) return;
  const visible = pane && !pane.classList.contains('hidden') && !$('#reader')?.classList.contains('hidden');
  if (!visible || !readerTimer.start) { readerTimerStop(); return; }
  const elapsed = Date.now() - readerTimer.start;
  // wpm is meaningless under a few seconds — show a placeholder until it settles
  const wpm = elapsed > 15000 && readerTimer.words ? Math.round(readerTimer.words / (elapsed / 60000)) : 0;
  el.textContent = i18nFmt('reader.timer', { time: fmtClock(elapsed), words: String(readerTimer.words || 0), wpm: wpm ? String(wpm) : '…' });
}

function readerTimerStart() {
  readerTimerStop();
  readerTimer = { start: Date.now(), words: 0, interval: setInterval(readerTimerTick, 1000) };
  readerTimerTick();
}

function readerTimerStop() {
  if (readerTimer.interval) clearInterval(readerTimer.interval);
  readerTimer = { start: 0, words: 0, interval: null };
  const el = $('#reader-timer');
  if (el) el.textContent = '';
}

/** Stop a render that is still appending batches (leaving reading mode, or a new
 *  document taking over) so a stale batch cannot repaint the word count. */
function cancelReaderRender() {
  readerRenderSeq++;
  if (readerChunkTimer) { clearTimeout(readerChunkTimer); readerChunkTimer = null; }
}

/** Render plain text as tappable reading paragraphs. Every token is added via
 *  textContent (never innerHTML), so pasted content cannot inject markup —
 *  the pane only ever contains spans we created ourselves. */
function readerRender(text, source, sourceUrl) {
  const pane = $('#reader-text');
  const wrap = $('#reader-input-wrap');
  if (!pane) return;
  const paragraphs = String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) { covLast = null; covRender(); setReaderMsg('Nothing to read — the text is empty.'); return; }
  cancelReaderRender();               // a batch from a previous render must not append here
  const seq = readerRenderSeq;        // this render's sequence number
  pane.innerHTML = '';
  pane.classList.remove('hidden');
  if (wrap) wrap.classList.add('hidden');
  $('#btn-reader-start').textContent = '📖 Re-edit text';
  // v74: the pace clock starts AFTER the pane is visible — its first tick stops
  // the timer if the pane still reads as hidden.
  readerTimerStart();

  let words = 0;    // accumulated while building — the count is a by-product, not a second scan
  let pi = 0;       // paragraph index
  let tokens = null; // tokens of the paragraph currently being built
  let ti = 0;       // token index inside that paragraph
  let p = null;     // that paragraph's <p>, kept across a batch boundary
  const step = () => {
    if (seq !== readerRenderSeq) return;   // superseded by a newer render
    const frag = document.createDocumentFragment();
    let built = 0;
    while (pi < paragraphs.length && built < READER_CHUNK_WORDS) {
      if (!tokens) {
        p = document.createElement('p');
        p.dataset.source = source || 'pasted';
        if (sourceUrl) p.dataset.sourceUrl = sourceUrl;
        tokens = paragraphs[pi].split(/\s+/);
        ti = 0;
      }
      const span = document.createElement('span');
      span.className = 'rw';
      span.dataset.word = tokens[ti];
      span.textContent = tokens[ti];
      p.appendChild(span);
      p.appendChild(document.createTextNode(' '));
      built++;
      words++;
      if (++ti >= tokens.length) { frag.appendChild(p); tokens = null; p = null; pi++; }
    }
    pane.appendChild(frag);                 // one insertion per batch, not one per word
    const done = pi >= paragraphs.length && !tokens;
    setReaderMsg(`${paragraphs.length} paragraph(s) · ${words} word${words === 1 ? '' : 's'}${done ? '' : '…'} — tap any word to look it up below.`);
    readerChunkTimer = done ? null : setTimeout(step, 0);
    if (done) { readerTimer.words = words; readerTimerTick(); covOnRenderDone(seq); } // v118 A1 // v74: the final count feeds the wpm figure
  };
  step();
}

function startReading() {
  const pane = $('#reader-text');
  const wrap = $('#reader-input-wrap');
  if (!pane || !wrap) return;
  if (!pane.classList.contains('hidden')) { // reading → back to the editor
    cancelReaderRender(); // a batch still running must not repaint the count over the editor
    readerTimerStop();    // v74: leaving reading mode stops the pace clock
    stopListening();      // v77: leaving reading mode ends the listening session
    wrap.classList.remove('hidden');
    pane.classList.add('hidden');
    $('#btn-reader-start').textContent = '📖 Start reading';
    setReaderMsg('');
    return;
  }
  let text = $('#reader-input').value.trim();
  if (!text) { setReaderMsg('Paste some text first (or load a URL).'); return; }
  // Phase 7 P1: a transcript pasted straight into the main textarea is cleaned
  // automatically — timestamps must never reach the reading pane as "words".
  const parsed = parseTranscript(text);
  if (parsed.format !== 'plain') text = parsed.text;
  readerRender(text, 'pasted');
}

/* ---- Phase 7 P1: YouTube transcript → Reader ----
 * A direct caption fetch from a link is impossible without a server (YouTube
 * sends no CORS headers on the watch page or timedtext), so the app takes the
 * transcript the user copies from YouTube's own "Show transcript" panel — one
 * paste, zero network calls, and SRT/VTT/plain text also work. The video never
 * plays here; only the words reach the Reader. */

const YT_TS_LINE = /^\d{1,2}:\d{2}(?::\d{2})?$/;      // bare "0:07" / "1:02:03"
const SRT_TS_LINE = /^\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/;

/** Detect and clean a pasted transcript. Returns { text, format } where
 *  format ∈ 'youtube' | 'srt' | 'vtt' | 'plain'. Cue text is joined into
 *  readable paragraphs; timestamps are stripped; duplicated adjacent cues
 *  (auto-caption copies sometimes double lines) collapse. */
function parseTranscript(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const has = lines.filter(Boolean);
  if (has.length < 3) return { text: String(raw || '').trim(), format: 'plain' };

  // SRT / VTT: cue blocks with "-->" timing arrows
  const arrows = has.filter((l) => l.includes('-->')).length;
  if (arrows >= 2 || (arrows >= 1 && /^WEBVTT/i.test(has[0]))) {
    const cues = [];
    for (const l of has) {
      if (l.includes('-->') || SRT_TS_LINE.test(l) || /^WEBVTT/i.test(l) || /^NOTE\b/i.test(l)) continue;
      if (/^\d+$/.test(l)) continue;                     // SRT sequence numbers
      if (cues.length && cues[cues.length - 1] === l) continue; // adjacent duplicate
      cues.push(l);
    }
    return { text: cuesToParagraphs(cues), format: arrows >= 1 && /^WEBVTT/i.test(has[0]) ? 'vtt' : 'srt' };
  }

  // YouTube transcript copy: bare timestamp lines interleaved with text
  const tsCount = has.filter((l) => YT_TS_LINE.test(l)).length;
  if (tsCount >= 3) {
    const cues = [];
    let cur = null;
    for (const l of has) {
      if (YT_TS_LINE.test(l)) { cur = []; cues.push(cur); continue; }
      if (cur && l) cur.push(l);
    }
    const joined = cues.filter((c) => c.length).map((c) => c.join(' '))
      .filter((c, i, a) => c !== a[i - 1]);              // collapse adjacent duplicates
    if (joined.length >= 3) return { text: cuesToParagraphs(joined), format: 'youtube' };
  }
  return { text: String(raw || '').trim(), format: 'plain' };
}

/** Group short cue fragments into readable paragraphs: a new paragraph starts
 *  when the previous cue ended a sentence and the paragraph has ≥40 words, or
 *  hard at 80 words. Without this, a 10-minute video is one 1,500-word blob. */
function cuesToParagraphs(cues) {
  const paras = [];
  let para = [], words = 0;
  for (const cue of cues) {
    para.push(cue);
    words += cue.split(/\s+/).length;
    if ((words >= 40 && /[.!?…]$/.test(cue)) || words >= 80) { paras.push(para.join(' ')); para = []; words = 0; }
  }
  if (para.length) paras.push(para.join(' '));
  return paras.join('\n\n');
}

/** ⚙ Reader dialog: clean the pasted transcript, hand it to the Reader. */
function readYouTubeTranscript() {
  const link = ($('#yt-url')?.value || '').trim();
  const raw = $('#yt-transcript')?.value || '';
  const parsed = parseTranscript(raw);
  if (parsed.format === 'plain' && !parsed.text) { setReaderMsg('Paste the transcript text first.'); return; }
  const src = link ? 'youtube: ' + link : 'youtube transcript';
  if ($('#reader-input')) $('#reader-input').value = parsed.text; // re-edit shows the cleaned text
  if ($('#reader-url') && link) $('#reader-url').value = link;    // snapshots carry the source
  $('#yt-dialog')?.close();
  readerRender(parsed.text, src, link || undefined);
}

/* ---- v77: Listening — the user's own audio file + pasted transcript, synced.
 * Cues keep their timestamps; tapping a cue line seeks the audio, and the line
 * being played is highlighted as it goes. Words stay tappable for lookup. The
 * audio never leaves the device (object URL, session-only by design — a
 * multi-MB media file is not something to silently duplicate into IDB). ---- */
let listenSession = { url: null, audio: null, cueEls: [] };

function tsToSec(ts) {
  const p = ts.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

/** Like parseTranscript but keeps the time: youtube/srt/vtt → cues [{t, text}];
 *  plain text degrades to one cue at t=0 (audio plays, no line sync). */
function parseTranscriptCues(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const arrows = lines.filter((l) => l.includes('-->')).length;
  const bareTs = lines.filter((l) => YT_TS_LINE.test(l)).length;
  const cues = [];
  if (arrows >= 2 || (arrows >= 1 && /^WEBVTT/i.test(lines[0]))) {
    let t = 0;
    for (const l of lines) {
      if (l.includes('-->')) { t = tsToSec(l.split('-->')[0].trim().replace(',', '.')); continue; }
      if (SRT_TS_LINE.test(l) || /^WEBVTT/i.test(l) || /^NOTE\b/i.test(l) || /^\d+$/.test(l)) continue;
      if (!l) continue;
      cues.push({ t, text: (cues.length && cues[cues.length - 1].text === l) ? '' : l });
    }
  } else if (bareTs >= 3) {
    let cur = null;
    for (const l of lines) {
      if (YT_TS_LINE.test(l)) { cur = { t: tsToSec(l), text: '' }; cues.push(cur); continue; }
      if (cur && l) cur.text = (cur.text ? cur.text + ' ' : '') + l;
    }
  } else if (lines.length) {
    cues.push({ t: 0, text: lines.join(' ') });
  }
  return { cues: cues.filter((c) => c.text), format: cues.length ? 'synced' : 'empty' };
}

function listenTimeupdate() {
  const audio = listenSession.audio;
  if (!audio || !listenSession.cueEls.length) return;
  const t = audio.currentTime;
  let active = -1;
  for (let i = 0; i < listenSession.cueEls.length; i++) {
    if (Number(listenSession.cueEls[i].dataset.t) <= t) active = i; else break;
  }
  listenSession.cueEls.forEach((el, i) => el.classList.toggle('listen-active', i === active));
  if (active >= 0 && listenSession.cueEls[active].classList.contains('listen-active')) {
    const el = listenSession.cueEls[active];
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 80) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function stopListening() {
  if (listenSession.audio) { listenSession.audio.pause(); listenSession.audio.removeEventListener('timeupdate', listenTimeupdate); }
  if (listenSession.url) { try { URL.revokeObjectURL(listenSession.url); } catch (e) {} }
  listenSession = { url: null, audio: null, cueEls: [] };
}

function startListening(fileArg, rawArg) {
  const file = fileArg || $('#listen-audio-file')?.files[0];
  const raw = rawArg ?? ($('#listen-transcript')?.value || '');
  const { cues } = parseTranscriptCues(raw);
  if (!file && !cues.length) { setReaderMsg('Pick an audio file and paste a transcript first.'); return; }
  stopListening();
  cancelReaderRender();
  readerTimerStop();
  const pane = $('#reader-text');
  const wrap = $('#reader-input-wrap');
  if (!pane || !wrap) return;
  pane.innerHTML = '';
  pane.classList.remove('hidden');
  wrap.classList.add('hidden');
  $('#btn-reader-start').textContent = '📖 Re-edit text';
  setReaderMsg(cues.length > 1 ? `${cues.length} lines synced — tap a line to jump, words are tappable.` : 'Audio loaded — words are tappable.');
  // the audio element rides on top of the reading pane
  if (file) {
    listenSession.url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.id = 'listen-audio';
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = listenSession.url;
    audio.style.width = '100%';
    audio.addEventListener('timeupdate', listenTimeupdate);
    pane.appendChild(audio);
    listenSession.audio = audio;
  }
  const frag = document.createDocumentFragment();
  listenSession.cueEls = [];
  for (const cue of cues) {
    const p = document.createElement('p');
    p.className = 'listen-cue';
    p.dataset.t = String(cue.t);
    for (const w of cue.text.split(/\s+/)) {
      const span = document.createElement('span');
      span.className = 'rw';
      span.dataset.word = w;
      span.textContent = w;
      p.appendChild(span);
      p.appendChild(document.createTextNode(' '));
    }
    p.addEventListener('click', (e) => {
      if (e.target.classList.contains('rw')) return; // word taps stay lookup-only
      if (listenSession.audio) { listenSession.audio.currentTime = Number(p.dataset.t); listenSession.audio.play().catch(() => {}); }
    });
    listenSession.cueEls.push(p);
    frag.appendChild(p);
  }
  pane.appendChild(frag);
  $('#listen-dialog')?.close();
}
window.DD_START_LISTENING = startListening;

/** Best-effort URL load. Wikipedia gets a first-class adapter (its API allows
 *  CORS via origin=*); other sites mostly block cross-origin reads (CORS) —
 *  that is a browser security rule, not a bug, so the error says so. */
async function loadReaderUrl() {
  const url = ($('#reader-url')?.value || '').trim();
  if (!url) { setReaderMsg('Enter a URL first.'); return; }
  setReaderMsg('Fetching…');
  try {
    const wiki = url.match(/^https?:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/);
    let text = '';
    let source = url;
    if (wiki) {
      const api = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&origin=*';
      const r = await fetch(api + '&titles=' + encodeURIComponent(decodeURIComponent(wiki[1])));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const page = Object.values(data?.query?.pages || {})[0];
      text = String(page?.extract || '').trim();
      if (page?.title) source = 'wikipedia: ' + page.title;
      if (text.length < 200) throw new Error('too little readable text');
    } else {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, nav, header, footer, aside, form, iframe, noscript, svg').forEach((el) => el.remove());
      const article = doc.querySelector('article') || doc.querySelector('main') || doc.body;
      text = (article?.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (text.length < 200) throw new Error('too little readable text');
    }
    $('#reader-input').value = text;
    readerRender(text, source, url);
  } catch (e) {
    setReaderMsg('Could not fetch this page (' + e.message.split('\n')[0] + '). Most sites block cross-origin reads (CORS) — copy & paste the text instead. Wikipedia pages work.');
  }
}

function sentenceAround(paragraph, word) {
  const wl = word.toLowerCase();
  const sentences = paragraph.split(/(?<=[.!?…])\s+/);
  return (sentences.find((s) => s.toLowerCase().includes(wl)) || paragraph).trim().slice(0, 400);
}

/** Tap a word in the reading pane → look it up in the panels below (the SAME
 *  search machinery as normal searches) and stage its sentence for saving. */
function onReaderTap(e) {
  const span = e.target.closest('span.rw');
  if (!span) return;
  const word = (span.dataset.word || '').replace(/^[^A-Za-z0-9'-]+|[^A-Za-z0-9'-]+$/g, '');
  if (!word) return;
  document.querySelectorAll('#reader-text .rw.sel').forEach((el) => el.classList.remove('sel'));
  span.classList.add('sel');
  const para = span.closest('p');
  document.querySelectorAll('#reader-text p.sel-para').forEach((p) => p.classList.remove('sel-para'));
  if (para) para.classList.add('sel-para'); // highlight the sentence's paragraph (P1-05)
  const sentence = para ? sentenceAround(para.textContent, word) : '';
  const sourceTitle = para?.dataset.source || 'pasted';
  const sourceUrl = para?.dataset.sourceUrl || '';
  readerSelection = { word, sentence, source: sourceTitle, sourceUrl };
  readerCtx = { headword: word, sentence, sourceTitle, sourceUrl };
  const btn = $('#btn-save-sentence');
  if (btn) {
    btn.disabled = !readerSelection.sentence;
    btn.textContent = '⭐ Save sentence';
  }
  // R-D: this lookup came from text the user is reading — the result may open at
  // the part of speech of the form they tapped, carrying this sentence with it.
  tapOrigin = { word, sentence, sourceTitle, sourceUrl };
  search(word, true).then(() => {
    // U7's reveal and the R-D jump both want the window. When the result is going
    // to open at a section, that jump knows exactly where to put it (and brings
    // the panel's head along); letting the generic reveal start a smooth scroll
    // underneath it would race the two and leave the page wherever the loser
    // stopped. So the reveal stays the answer for everything else — exact hits,
    // words with no guessed part of speech, and the not-loaded surface.
    if (anchoredLookupGen !== lookupGen) revealLookupAfterTap();
  });
}

/** U7: on a phone the tapped word's definition used to land below the reader
 *  toolbar, the Recent bar, the WordNet/Wiktionary switch and the attribution —
 *  you tapped a word and nothing appeared to happen. Bring the answer into view
 *  instead (auto-scroll, the least invasive option: nothing is moved, duplicated
 *  or re-parented, and desktop is untouched because the panels sit beside the
 *  text there). The target follows the real state: the panel grid once a
 *  dictionary exists, the download card while the surface is still gated. */
function revealLookupAfterTap() {
  if (!window.matchMedia('(max-width: 899.5px)').matches) return;
  const idle = document.body.dataset.dictState === 'idle';
  const target = idle ? $('#empty-state') : $('#dict-grid');
  if (!target || target.classList.contains('hidden')) return;
  // Already readable? Then don't fight the user — tapping a second word while the
  // definition is on screen must not yank the page around.
  const r = target.getBoundingClientRect();
  const vh = window.innerHeight || 0;
  const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  if (visible > vh * 0.4) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  catch (e) { /* no scrollIntoView options support — leave the page where it is */ }
}

/** Save the staged sentence as a LearningItem (type "sentence") — context is
 *  captured automatically (headword + source). Duplicate-safe via store. */
async function saveSentence() {
  if (!readerSelection?.sentence) return;
  const { word, sentence, source } = readerSelection;
  let r;
  try {
    r = await addItem({
      type: 'sentence',
      text: sentence,
      context: { sentence, headword: word, sourceTitle: source, sourceUrl: readerSelection.sourceUrl || '' },
      box: 1,
      due: Date.now(),
    });
  } catch (e) {
    console.warn('could not save sentence:', e);
    showToast('Could not save the sentence — storage error');
    return;
  }
  if (!r.merged) {
    state.items = state.items.filter((i) => i.id !== r.item.id);
    state.items.unshift(r.item);
  }
  const btn = $('#btn-save-sentence');
  if (btn) {
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.textContent = '⭐ Save sentence'; }, 1500);
  }
  updateContextBar($('#search-input').value.trim());
}

/* ---------------- toast feedback ---------------- */
let tutorSession = null;
let tutorPendingResume = null;
let tutorPendingRequest = null;
let tutorBusy = false;
let tutorController = null;
let tutorRequestId = 0;
let tutorSetupContinuation = null;
const TUTOR_PROMPT_VERSION = 'tutor-v3-meaning';
function syncTutorQuickSetupFields() {
  const provider = $('#tutor-setup-provider')?.value || 'meta';
  const defaults = PROVIDERS[provider] || PROVIDERS.meta;
  $('#tutor-setup-model').value = defaults.model;
  $('#tutor-setup-url').value = defaults.baseUrl;
  $('#tutor-setup-advanced').open = provider === 'compatible';
}
function openTutorQuickSetup(continuation) {
  const settings = getAiSettings();
  tutorSetupContinuation = continuation || null;
  $('#tutor-setup-provider').value = settings.provider;
  $('#tutor-setup-key').value = settings.apiKey;
  $('#tutor-setup-model').value = settings.model;
  $('#tutor-setup-url').value = settings.baseUrl;
  $('#tutor-setup-advanced').open = settings.provider === 'compatible';
  $('#tutor-setup-status').textContent = '';
  if (!$('#tutor-setup-dialog').open) $('#tutor-setup-dialog').showModal();
  $('#tutor-setup-key').focus();
}
function saveTutorQuickSetup() {
  const key = $('#tutor-setup-key').value.trim();
  if (!key) { $('#tutor-setup-status').textContent = 'Enter your provider API key to continue. No request has been sent.'; return; }
  try {
    saveAiSettings({
      provider: $('#tutor-setup-provider').value,
      apiKey: key,
      model: $('#tutor-setup-model').value,
      baseUrl: $('#tutor-setup-url').value,
    });
    const continuation = tutorSetupContinuation;
    tutorSetupContinuation = null;
    $('#tutor-setup-dialog').close();
    Promise.resolve(continuation?.()).catch(tutorActionError);
  } catch (error) { $('#tutor-setup-status').textContent = error.message; }
}
function tutorText(tag, text, cls) { const el=document.createElement(tag); if(cls) el.className=cls; el.textContent=String(text||''); return el; }
function tutorButton(label, action, cls='btn-secondary') { const b=tutorText('button',label,cls); b.type='button'; b.dataset.tutorAction=action; return b; }
function isTutorConfigError(message) { return /rejected the key|rejected the request|API key|endpoint and model|Could not reach|Choose an API/i.test(String(message || '')); }
function tutorErrorActions(retryLabel, retryAction) { const stage=$('#tutor-stage'); if(!stage) return; stage.replaceChildren(tutorButton(retryLabel, retryAction, 'btn-primary'), tutorButton('Open AI settings', 'open-ai-settings'), tutorButton('Cancel request', 'cancel')); }
function tutorShowError(retryLabel, retryAction, error) { const hint=isTutorConfigError(error && error.message) ? ' Same settings will likely fail again \u2014 open AI settings to check the key/model first.' : ''; tutorStatus(String((error && error.message) || 'Request failed.') + hint); tutorErrorActions(retryLabel, retryAction); }
function tutorPreflight() { const st=getAiSettings(); if(!st.apiKey) return {ok:false, reason:'missing-key'}; try { const u=new URL(st.baseUrl); if(!['https:','http:'].includes(u.protocol)) return {ok:false, reason:'bad-url'}; } catch { return {ok:false, reason:'bad-url'}; } if(!st.model) return {ok:false, reason:'missing-model'}; return {ok:true, provider:st.provider, model:st.model}; }
function tutorActionError(error) { tutorStatus('Could not save or restore this practice. Keep this tab open and retry. '+error.message); }
function tutorStatus(text) { const el=$('#tutor-status'); if(el) el.textContent=text; }
function tutorProviderLabel() { return PROVIDERS[getAiSettings().provider]?.label || 'selected provider'; }
function tutorProviderMatchesSession() {
  if(!tutorSession) return false;
  const settings=getAiSettings();
  if(settings.provider===tutorSession.provider && settings.model===tutorSession.model) return true;
  tutorStatus(`This saved session belongs to ${PROVIDERS[tutorSession.provider]?.label||tutorSession.provider} / ${tutorSession.model}. Restore those settings or start a new session to use another provider.`);
  return false;
}
async function persistTutor() {
  if(!tutorSession) return;
  tutorSession.updatedAt=Date.now();
  const session=tutorSession;
  await putTutorRecord(session);
  if(tutorSession===session) localStorage.setItem('dd-tutor-current',session.id);
}
async function tutorLocalHistory() {
  const sessions=await allTutorRecords().catch(()=>[]);
  return { sessions, confirmedErrors:sessions.flatMap((session)=>session.confirmedErrors||[]) };
}
function tutorRenderSuggestions() {
  const stage=$('#tutor-stage');
  const provider=PROVIDERS[tutorSession.provider]?.label||tutorSession.provider||'selected provider';
  stage.replaceChildren(tutorText('p','Choose one phrase to practise. Suggestions and source sentences were checked against the article.','hint'),tutorText('p',tutorSession.resultSource==='cache'?`Cached result · ${provider} / ${tutorSession.model||'saved model'} · no provider request was made.`:`Live result · ${provider} / ${tutorSession.model||''}`,'hint'));
  tutorSession.phrases.forEach((p,i)=>{
    const card=document.createElement('section'); card.className='adv-section';
    card.append(tutorText('h3',p.phrase),tutorText('p',p.sourceSentence));
    if(p.meaningVi) card.append(tutorText('p',`Meaning (VI): ${p.meaningVi}`,'hint'));
    else card.append(tutorText('p','This older suggestion has no saved Vietnamese meaning. Start a new practice to refresh it.','hint'));
    if(p.selectionReason || p.reason) card.append(tutorText('p',`Why suggested: ${p.selectionReason || p.reason}`,'hint'));
    if(p.localReason) card.append(tutorText('p',`Study context: ${p.localReason}`,'hint'));
    const b=tutorButton('Practise this phrase',`choose:${i}`,'btn-primary'); card.append(b); stage.append(card);
  });
  stage.append(tutorButton('Start a new practice','new'));
  stage.append(tutorButton('Discard this session','discard'));
}
function tutorConsentCopy(kind, payload) {
  const settings=getAiSettings(), provider=PROVIDERS[settings.provider]?.label||'the selected provider';
  const kindLabel={phrases:'find phrase suggestions',prompt:'create a practice situation',feedback:'review your answer'}[kind]||'provide tutoring';
  return `This request will ${kindLabel} using ${provider} / ${settings.model}. The provider receives the data shown below and the app's tutor instructions. Token charges may apply. The provider may process this data under its own terms. Your current session is saved in this browser. Agree only if you want to send this request.`;
}
function tutorShowRequestConsent(kind, payload, title, metadata={}) {
  tutorPendingRequest={kind,payload,...metadata};
  const stage=$('#tutor-stage'), details=document.createElement('details'), summary=tutorText('summary','Review the exact learner data to be sent');
  details.append(summary,tutorText('pre',typeof payload==='string'?payload:JSON.stringify(payload,null,2),'tutor-payload-preview'));
  const consent=document.createElement('label'), checkbox=document.createElement('input');
  checkbox.type='checkbox'; checkbox.id='tutor-request-consent';
  consent.append(checkbox,document.createTextNode(' I agree to send the data shown above for this request.'));
  stage.replaceChildren(tutorText('h3',title),tutorText('p',tutorConsentCopy(kind,payload),'hint'),details,consent,tutorButton('Agree and send request','confirm-ai-request','btn-primary'),tutorButton('Back without sending','cancel-ai-consent'));
}
async function startTutor({fresh=false}={}) {
  if(tutorBusy) return;
  const reading=$('#reader-text');
  if(!reading || reading.classList.contains('hidden') || reading.innerText.trim().length<80) { setReaderMsg('Start a reading of at least 80 characters before using optional AI practice.'); $('#reader-input')?.focus(); return; }
  const currentArticle=reading.innerText.trim().slice(0,12000), settings=getAiSettings();
  { const pre=tutorPreflight(); if(!pre.ok && !getTutorCache({provider:settings.provider,model:settings.model,task:'phrases',input:currentArticle.slice(0,12000),promptVersion:TUTOR_PROMPT_VERSION})) { tutorStatus(pre.reason==='missing-key' ? 'Add your provider key first \u2014 no request was sent. Save, then use Save & test connection in Advanced \u2192 Learning before the demo.' : 'Saved AI settings look incomplete (endpoint/model). Open AI settings to fix them before the demo \u2014 no request was sent.'); openTutorQuickSetup(() => startTutor({fresh})); return; } }
  if(fresh) {
    const article=currentArticle;
    if(!article || article.length<80) { showToast('Open a reading of at least 80 characters first.'); return; }
    const cached=getTutorCache({provider:settings.provider,model:settings.model,task:'phrases',input:article.slice(0,12000),promptVersion:TUTOR_PROMPT_VERSION});
    if(!settings.apiKey && !cached) { openTutorQuickSetup(() => startTutor({fresh:true})); return; }
    if(tutorSession?.id && tutorSession.stage!=='saved' && !confirm('Start a new session? The current session will remain saved so you can resume it later.')) return;
    tutorSession={id:crypto.randomUUID(),article:article.slice(0,12000),articleTitle:$('#reader-title')?.textContent||'',createdAt:Date.now(),phrases:[],confirmedErrors:[],stage:'select',consentedAt:0,provider:settings.provider,model:settings.model};
    await persistTutor();
  } else {
    const article=currentArticle;
    if(!article || article.length<80) { showToast('Open a reading of at least 80 characters first.'); return; }
    const currentText=article.slice(0,12000), priorId=localStorage.getItem('dd-tutor-current');
    const prior=priorId ? await getTutorRecord(priorId).catch(()=>null) : null;
    if(prior && prior.stage!=='saved' && prior.article!==currentText) {
      tutorPendingResume=prior;
      $('#tutor-stage').replaceChildren(tutorText('p',`You have an unfinished session${prior.articleTitle?` from “${prior.articleTitle}”`:''}. Resuming keeps that saved reading and answer on this device until an individual request is approved. Choose which reading to practise.`,'hint'),tutorButton('Resume saved session','resume-saved','btn-primary'),tutorButton('Practice this reading','fresh-reading'));
      $('#tutor-dialog').showModal(); return;
    }
    if(prior && prior.stage!=='saved') {
      const settings=getAiSettings();
      if(prior.provider!==settings.provider || prior.model!==settings.model) { prior.provider=settings.provider; prior.model=settings.model; prior.consentedAt=Date.now(); await putTutorRecord(prior); }
      tutorSession=prior;
    } else {
      const cached=getTutorCache({provider:settings.provider,model:settings.model,task:'phrases',input:currentText,promptVersion:TUTOR_PROMPT_VERSION});
      if(!settings.apiKey && !cached) { openTutorQuickSetup(() => startTutor()); return; }
      tutorSession={id:crypto.randomUUID(),article:currentText,articleTitle:$('#reader-title')?.textContent||'',createdAt:Date.now(),phrases:[],confirmedErrors:[],stage:'select',consentedAt:0,provider:settings.provider,model:settings.model};
      await persistTutor();
    }
  }
  $('#tutor-dialog').showModal(); renderTutorStage();
  if(tutorSession.stage==='select' && !tutorSession.phrases.length) await findTutorPhrases();
  else tutorStatus('Practice session restored from this browser.');
}
function renderTutorStage() {
  if(!tutorSession) return;
  if(tutorSession.stage==='select') {
    if(tutorSession.phrases.length) tutorRenderSuggestions();
    else $('#tutor-stage').replaceChildren(tutorText('p','No phrase suggestions are loaded yet. Starting the request will show exactly what is sent.','hint'),tutorButton('Continue to phrase request','retry-select','btn-primary'));
  } else if(tutorSession.stage==='answer') renderTutorAnswer();
  else if(tutorSession.stage==='feedback') renderTutorFeedback();
  else if(tutorSession.stage==='saved') {
    $('#tutor-stage').replaceChildren(tutorText('p','This phrase was saved to your Vault. You can continue with another phrase.','hint'),tutorRenderSavedChoices());
  }
}
function tutorRenderSavedChoices() {
  const wrap=document.createElement('div');
  tutorSession.phrases.forEach((p,i)=>{ const b=tutorButton(`Practise: ${p.phrase}`,`choose:${i}`,'btn-primary'); wrap.append(b); });
  wrap.append(tutorButton('Start a new practice','new'),tutorButton('Discard this session','discard'));
  return wrap;
}
async function findTutorPhrases({consented=false}={}) {
  if(!tutorSession) return;
  if(!tutorProviderMatchesSession()) return;
  const settings=getAiSettings(), input=tutorSession.article;
  const cacheArgs={provider:settings.provider,model:settings.model,task:'phrases',input,promptVersion:TUTOR_PROMPT_VERSION};
  let cached=getTutorCache(cacheArgs);
  // Older caches may contain rejected provider output. Never let it block a live retry.
  if(cached) {
    try { if(!validateTutorPhrases(cached.value?.phrases,input).length) cached=null; }
    catch { cached=null; }
  }
  if(!cached) {
    if(!settings.apiKey) { tutorStatus('Add an API key in Advanced → Learning to request new phrase suggestions.'); $('#btn-open-advanced')?.click(); return; }
    if(!consented) { tutorShowRequestConsent('phrases',input,'Review before finding phrase suggestions'); return; }
  }
  const requestId=++tutorRequestId; tutorController=new AbortController(); tutorBusy=true;
  tutorStatus(cached?`Using a cached phrase result from ${tutorProviderLabel()} (${settings.model}).`:`Finding useful phrases with ${tutorProviderLabel()}…`);
  if(!cached) $('#tutor-stage').replaceChildren(tutorText('p','Requesting live phrase suggestions…','hint'),tutorButton('Cancel request','cancel'));
  try {
    const out=cached?.value || await askTutor({signal:tutorController.signal,instructions:TUTOR_PHRASE_INSTRUCTIONS,input});
    if(requestId!==tutorRequestId || !tutorSession) return;
    const validated=validateTutorPhrases(out?.phrases,input);
    if(!validated.length) throw new Error('No suggestions passed the source checks. Try a shorter or cleaner article.');
    if(!cached) setTutorCache(cacheArgs,out);
    const {confirmedErrors}=await tutorLocalHistory();
    if(requestId!==tutorRequestId || !tutorSession) return;
    tutorSession.phrases=rankTutorPhrases(validated,{savedItems:state.items,confirmedErrors}).slice(0,3);
    tutorSession.resultSource=cached?'cache':'live';
    tutorSession.stage='select'; await persistTutor();
    if(requestId!==tutorRequestId || !tutorSession) return;
    tutorRenderSuggestions(); tutorStatus(cached?'Loaded and rechecked the cached phrase result; no AI request was made.':'Live suggestions are checked against the reading. Your Vault and review history stayed on this device.');
  } catch(error) {
    if(requestId===tutorRequestId) { tutorShowError('Retry phrase selection','retry-select',error); }
  } finally { if(requestId===tutorRequestId){tutorBusy=false;tutorController=null;} }
}
function cancelTutorRequest() {
  tutorPendingRequest=null;
  if(!tutorController) return;
  tutorRequestId++; tutorController.abort(); tutorController=null; tutorBusy=false; tutorStatus('Request cancelled. Your draft is saved. The provider may still process it if it already received the request.'); renderTutorStage();
}
async function handleTutorClick(e) {
  const action=e.target?.dataset?.tutorAction;
  if(!action) return;
  if(action==='confirm-ai-request') {
    if(!$('#tutor-request-consent')?.checked) { tutorStatus('Check the consent box before sending. No request was sent.'); return; }
    const pending=tutorPendingRequest; tutorPendingRequest=null;
    if(!pending) return;
    if(tutorSession) { tutorSession.consentedAt=Date.now(); await persistTutor(); }
    if(pending.kind==='phrases') { await findTutorPhrases({consented:true}); return; }
    if(pending.kind==='prompt') { await createTutorPrompt(pending.index,{freshContext:!!pending.freshContext}); return; }
    if(pending.kind==='feedback') { await requestTutorFeedback(pending.answer); return; }
    return;
  }
  if(action==='cancel-ai-consent') { tutorPendingRequest=null; renderTutorStage(); tutorStatus('No request was sent.'); return; }
  if(action==='fresh-reading') { tutorPendingResume=null; await startTutor({fresh:true}); return; }
  if(action==='resume-saved') {
    if(!tutorPendingResume) return;
    const settings=getAiSettings(); tutorSession=tutorPendingResume; tutorPendingResume=null;
    tutorSession.provider=settings.provider; tutorSession.model=settings.model;
    await persistTutor(); renderTutorStage();
    if(tutorSession.stage==='select'&&!tutorSession.phrases.length) await findTutorPhrases(); else tutorStatus('Resumed the saved practice session.');
    return;
  }
  if(action==='open-ai-settings') { openTutorQuickSetup(null); tutorStatus('Check the provider key/model, save, then retry. Full check: Advanced \u2192 Learning \u2192 Save & test connection (small paid request).'); return; }
  if(action==='cancel') { cancelTutorRequest(); return; }
  if(action==='retry-select') { if(!tutorBusy) await findTutorPhrases(); return; }
  if(action==='retry-feedback') { if(!tutorSession || tutorBusy) return; tutorSession.stage='answer'; renderTutorAnswer(); const area=$('#tutor-stage textarea'); if(area) area.value=tutorSession.answer||''; return; }
  if(action==='back-choices') { tutorSession.stage='select'; await persistTutor(); tutorRenderSuggestions(); return; }
  if(action==='new') { await startTutor({fresh:true}); return; }
  if(action==='discard') {
    if(tutorBusy) cancelTutorRequest();
    if(!confirm('Discard this tutor session and its saved answers?')) return;
    const id=tutorSession?.id; if(id) await deleteTutorRecord(id).catch(()=>{});
    if(localStorage.getItem('dd-tutor-current')===id) localStorage.removeItem('dd-tutor-current');
    tutorSession=null; $('#tutor-stage').replaceChildren(); tutorStatus('Session discarded.'); return;
  }
  if(action==='accept-feedback' || action==='reject-feedback') {
    if(!tutorSession?.feedback || tutorSession.feedbackDecision) return;
    tutorSession.feedback=validateTutorFeedback(tutorSession.feedback,tutorSession.answer);
    if(action==='accept-feedback' && tutorSession.feedback.evidenceStatus==='missing-quote') { tutorStatus('This feedback has no supporting quote and cannot be confirmed as an error.'); return; }
    tutorSession.feedbackDecision=action==='accept-feedback'?'accepted':'rejected';
    if(action==='accept-feedback' && tutorSession.feedback.verdict==='incorrect' && tutorSession.feedback.quote) {
      const row={phrase:tutorSession.target.phrase,issue:tutorSession.feedback.issue,suggestion:tutorSession.feedback.suggestion,quote:tutorSession.feedback.quote,answer:tutorSession.answer,confirmedAt:Date.now(),sessionId:tutorSession.id};
      tutorSession.confirmedErrors=[...(tutorSession.confirmedErrors||[]),row];
    }
    await persistTutor(); renderTutorFeedback(); tutorStatus(action==='accept-feedback'?(tutorSession.feedback.verdict==='incorrect'?'Feedback saved as a confirmed error.':tutorSession.feedback.verdict==='uncertain'?'Feedback saved. No language error was confirmed.':'Feedback saved as useful.'):'Feedback marked not useful and excluded from phrase ranking.'); return;
  }
  if(action==='save-phrase') {
    if(!tutorSession?.target || !tutorSession.feedback || !tutorSession.feedbackDecision || tutorBusy) return;
    tutorBusy=true;
    try {
      const p=tutorSession.target, f=tutorSession.feedback;
      const noteParts=[f.explanation_vi||f.suggestion||'Practise this phrase in context.',tutorSession.feedbackDecision==='accepted'?'Learner accepted tutor feedback.':null].filter(Boolean);
      // Keep the phrase's semantic gloss as the review answer. localReason is
      // only a personalization/ranking explanation (for example, already due).
      const tutorMeaning=String(p.meaningVi||'').trim();
      if(!tutorMeaning) throw new Error('This older suggestion has no saved Vietnamese meaning. Start a new practice to refresh it.');
      const tutorSense=senseStableKey({slot:'ai-tutor',sourceFile:`${tutorSession.provider}/${tutorSession.model}/${tutorSession.resultSource||'unknown'}`,keyText:p.phrase},`${tutorMeaning}\n${p.sourceSentence}`);
      const r=await addItem({type:'phrase',text:p.phrase,note:`Tutor: ${noteParts.join(' ')}`,tags:['ai-tutor'],dictionary:{source:`AI Tutor suggestion · ${PROVIDERS[tutorSession.provider]?.label||tutorSession.provider} (${tutorSession.resultSource==='cache'?'cached':'live'})`,sourceFile:tutorSession.model||'',entryKey:p.phrase,definition:tutorMeaning,senseKey:tutorSense},context:{sentence:p.sourceSentence,headword:p.phrase,sourceTitle:tutorSession.articleTitle||'AI tutor reading practice'}});
      if(!r.merged){state.items.unshift(r.item);renderVault();}
      tutorSession.savedItemId=r.item?.id||null; tutorSession.stage='saved'; await persistTutor(); renderTutorStage();
      tutorStatus(r.merged?'This phrase is already in your Vault.':'Saved to your Vault for future FSRS review. Saving is not counted as a review.');
    } catch(error) { tutorStatus('Could not save the review card: '+error.message); }
    finally { tutorBusy=false; }
    return;
  }
  if(action==='revise-answer') {
    if(!tutorSession?.feedbackDecision || tutorBusy) return;
    tutorSession.feedback=null; tutorSession.feedbackDecision=null;
    tutorSession.stage='answer'; await persistTutor(); renderTutorAnswer(); tutorStatus('Revise your answer in the same situation.'); return;
  }
  if(action==='retry-answer') {
    if(!tutorSession?.feedbackDecision || tutorBusy || !tutorProviderMatchesSession()) return;
    const index=tutorSession.phrases.findIndex(p=>p.phrase===tutorSession.target?.phrase && p.sourceSentence===tutorSession.target?.sourceSentence);
    if(index<0) return;
    const payload=makeTutorSituationPayload(tutorSession.phrases[index],tutorSession,true);
    const showConsent=()=>tutorShowRequestConsent('prompt',payload,'Review before creating a new situation',{index,freshContext:true});
    if(!getAiSettings().apiKey) openTutorQuickSetup(showConsent); else showConsent();
    return;
  }
  if(action.startsWith('choose:')) {
    if(tutorBusy || !tutorSession || !tutorProviderMatchesSession()) return;
    const index=Number(action.slice(7)), p=tutorSession.phrases[index]; if(!p) return;
    if(!getAiSettings().apiKey) {
      openTutorQuickSetup(() => tutorShowRequestConsent('prompt',makeTutorSituationPayload(p,tutorSession),'Review before creating a situation',{index}));
      return;
    }
    tutorShowRequestConsent('prompt',makeTutorSituationPayload(p,tutorSession),'Review before creating a situation',{index});
  }
}
async function createTutorPrompt(index,{freshContext=false}={}) {
  if(tutorBusy || !tutorSession) return;
  const p=tutorSession.phrases[index]; if(!p) return;
  const payload=makeTutorSituationPayload(p,tutorSession,freshContext);
  tutorBusy=true; tutorController=new AbortController(); const requestId=++tutorRequestId;
  const controller=tutorController;
  try {
    await persistTutor();
    if(requestId!==tutorRequestId || !tutorSession) return;
    tutorStatus('Creating a fresh speaking prompt…'); $('#tutor-stage').replaceChildren(tutorText('p','Requesting a live situation prompt…','hint'),tutorButton('Cancel request','cancel'));
    const out=await askTutor({signal:controller.signal,instructions:TUTOR_SITUATION_INSTRUCTIONS,input:JSON.stringify(payload)});
    if(requestId!==tutorRequestId || !tutorSession) return;
    const situation=validateTutorSituation(out,payload);
    if(tutorSession.prompt) tutorSession.promptHistory=[...(tutorSession.promptHistory||[]),{prompt:tutorSession.prompt,contextId:tutorSession.promptContextId||'study'}].slice(-10);
    tutorSession.promptContextId=situation.contextId; tutorSession.feedback=null; tutorSession.feedbackDecision=null;
    tutorSession.target=p; tutorSession.prompt=situation.prompt; tutorSession.promptSource='live'; tutorSession.answer=''; tutorSession.stage='answer'; await persistTutor();
    if(requestId!==tutorRequestId || !tutorSession) return;
    renderTutorAnswer(); tutorStatus('Write one or two sentences.');
  } catch(error) { if(requestId===tutorRequestId){tutorShowError('Retry prompt',freshContext?'retry-answer':'choose:'+index,error);} }
  finally { if(requestId===tutorRequestId){tutorBusy=false;tutorController=null;} }
}
function renderTutorAnswer() {
  const s=$('#tutor-stage'); s.replaceChildren(tutorText('p',tutorSession.target.phrase,'chip'),tutorText('p',tutorSession.prompt));
  s.append(tutorText('p',tutorSession.promptSource==='live'?`Live AI prompt · ${PROVIDERS[tutorSession.provider]?.label||tutorSession.provider} / ${tutorSession.model}`:'Saved practice prompt · source not recorded','hint'));
  const form=document.createElement('form'); form.id='tutor-answer-form';
  const area=document.createElement('textarea'); area.name='answer'; area.required=true; area.maxLength=1200; area.rows=4; area.value=tutorSession.answer||''; area.setAttribute('aria-label','Your English answer');
  const btn=tutorText('button','Get feedback','btn-primary'); btn.type='submit';
  form.append(area,btn); s.append(form,tutorButton('Back to phrase choices','back-choices'));
}
async function handleTutorSubmit(e) {
  if(e.target?.id!=='tutor-answer-form') return;
  e.preventDefault(); if(tutorBusy || !tutorSession || !tutorProviderMatchesSession()) return;
  const answer=String(new FormData(e.target).get('answer')||'').trim(); if(!answer) return;
  tutorSession.answer=answer; await persistTutor();
  const payload={phrase:tutorSession.target.phrase,sourceSentence:tutorSession.target.sourceSentence,prompt:tutorSession.prompt,answer};
  if(!getAiSettings().apiKey) {
    openTutorQuickSetup(() => tutorShowRequestConsent('feedback',payload,'Review before requesting answer feedback',{answer}));
    return;
  }
  tutorShowRequestConsent('feedback',payload,'Review before requesting answer feedback',{answer});
}
async function requestTutorFeedback(answer) {
  if(tutorBusy || !tutorSession || !tutorProviderMatchesSession()) return;
  tutorBusy=true; tutorController=new AbortController(); const requestId=++tutorRequestId;
  const controller=tutorController;
  try {
    tutorSession.answer=answer; await persistTutor();
    if(requestId!==tutorRequestId || !tutorSession) return;
    tutorStatus('Checking your answer…'); $('#tutor-stage').replaceChildren(tutorText('p','Requesting live answer feedback…','hint'),tutorButton('Cancel request','cancel'));
    const out=await askTutor({signal:controller.signal,instructions:TUTOR_FEEDBACK_INSTRUCTIONS,input:JSON.stringify({phrase:tutorSession.target.phrase,sourceSentence:tutorSession.target.sourceSentence,prompt:tutorSession.prompt,answer})});
    if(requestId!==tutorRequestId || !tutorSession) return;
    tutorSession.feedback=validateTutorFeedback(out,answer); tutorSession.feedbackSource='live'; tutorSession.feedbackDecision=null; tutorSession.stage='feedback'; await persistTutor();
    if(requestId!==tutorRequestId || !tutorSession) return;
    renderTutorFeedback();
    tutorStatus(tutorSession.feedback.verdict==='uncertain'?'The tutor is unsure. Review the feedback before accepting it.':'Review the feedback and choose whether it is useful.');
  } catch(error) { if(requestId===tutorRequestId){tutorShowError('Retry feedback','retry-feedback',error);} }
  finally { if(requestId===tutorRequestId){tutorBusy=false;tutorController=null;} }
}
function renderTutorFeedback() {
  const s=$('#tutor-stage'), f=validateTutorFeedback(tutorSession.feedback,tutorSession.answer); tutorSession.feedback=f; if(f.evidenceStatus==='missing-quote' && tutorSession.feedbackDecision==='accepted') tutorSession.feedbackDecision=null; s.replaceChildren(tutorText('p',tutorSession.answer));
  s.append(tutorText('p',tutorSession.feedbackSource==='live'?`Live AI feedback · ${PROVIDERS[tutorSession.provider]?.label||tutorSession.provider} / ${tutorSession.model} · verify the quote before deciding.`:'Saved feedback · source not recorded','hint'));
  if(f.quote) s.append(tutorText('blockquote',f.quote));
  const title=f.verdict==='correct'?'Good use':f.verdict==='uncertain'?'The tutor is unsure':'One thing to improve';
  s.append(tutorText('h3',title),tutorText('p',f.verdict==='correct'?(f.explanation_vi||'Your phrase fits the context.'):f.suggestion||f.issue||'The tutor could not identify a clear correction.',f.verdict==='uncertain'?'hint':''));
  if(f.explanation_vi) s.append(tutorText('p',f.explanation_vi,'hint'));
  if(!tutorSession.feedbackDecision) {
    if(f.evidenceStatus==='missing-quote') s.append(tutorButton('Request feedback again','retry-feedback','btn-primary'));
    else s.append(tutorButton('Accept feedback','accept-feedback','btn-primary'));
    s.append(tutorButton('Mark not useful','reject-feedback'));
  } else s.append(tutorText('p',tutorSession.feedbackDecision==='accepted'?'You accepted this feedback.':'You marked this feedback not useful.','hint'));
  if(tutorSession.feedbackDecision && tutorSession.target?.meaningVi) s.append(tutorButton('Save phrase to Vault','save-phrase','btn-primary'));
  else if(tutorSession.feedbackDecision) s.append(tutorText('p','Start a new practice to get a Vietnamese meaning before saving this older suggestion.','hint'),tutorButton('Start a new practice','new'));
  else s.append(tutorText('p','Choose whether this feedback is useful before saving the phrase.','hint'));
  if(tutorSession.feedbackDecision) s.append(tutorButton('Revise this answer','revise-answer'),tutorButton('Try another situation','retry-answer'));
  s.append(tutorButton('Back to phrase choices','back-choices'));
}
function populateTutorSettings() {
  const settings = getAiSettings();
  for (const [id, value] of Object.entries({'ai-provider':settings.provider,'ai-base-url':settings.baseUrl,'ai-model':settings.model,'ai-api-key':settings.apiKey})) {
    const field = document.getElementById(id); if (field) field.value = value;
  }
  const advanced=document.getElementById('ai-advanced-fields'); if(advanced) advanced.open=settings.provider==='compatible';
  syncAiProviderFields();
}
function syncAiProviderFields() {
  const provider=document.getElementById('ai-provider')?.value||'meta';
  const field=document.getElementById('ai-api-key');
  if(field) field.setAttribute('aria-label',`${PROVIDERS[provider]?.label||'AI provider'} API key`);
}
async function saveTutorSettings() {
  try { const settings=saveAiSettings({provider:$('#ai-provider').value,apiKey:$('#ai-api-key').value,model:$('#ai-model').value,baseUrl:$('#ai-base-url').value}); $('#ai-api-key').value=settings.apiKey; $('#ai-settings-status').textContent=`Saved ${PROVIDERS[settings.provider].label} settings in this browser profile.`; return true; }
  catch(error) { $('#ai-settings-status').textContent=error.message; return false; }
}
async function testTutorConnection() {
  try { if(!await saveTutorSettings()) return; $('#ai-settings-status').textContent='Testing connection… this small request may use provider tokens.'; const result=await askTutor({instructions:'Return only JSON: {"status":"ok"}.',input:'Connection check.'}); if(result?.status!=='ok') throw new Error('The provider responded, but the connection check returned an unexpected format.'); $('#ai-settings-status').textContent=`Connected to ${PROVIDERS[getAiSettings().provider].label} / ${getAiSettings().model}.`; }
  catch(error) { $('#ai-settings-status').textContent=error.message; }
}

let toastTimer;

/** Is the lookup surface (search box + panels) on screen right now? Feedback that
 *  only makes sense while looking something up ("you can search now") is scoped
 *  with this, so it can never pop over Vault/Review/Stats or cover the footer. */
function lookupSurfaceVisible() {
  const v = currentView();
  if (v !== 'search' && v !== 'reader') return false;
  const form = $('#search-form');
  if (!form || form.classList.contains('hidden')) return false;
  const r = form.getBoundingClientRect();
  return r.height > 0 && r.bottom > 0 && r.top < (window.innerHeight || 0);
}

function showToast(text, undoFn, ms = 5000, actionLabel = 'Undo') {
  const el = $('#toast');
  if (!el) return;
  el.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  if (undoFn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-undo';
    b.textContent = actionLabel;
    b.addEventListener('click', () => { undoFn(); el.classList.add('hidden'); });
    el.appendChild(b);
  }
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

/* ================= Phase 3+ : Export CSV/TSV/Anki (P1) ================= */
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

let exportScope = [];
const EXPORT_FIELDS = ['text', 'type', 'status', 'tags', 'deck', 'note', 'sentence', 'source', 'created'];

function openExportDialog(items) {
  const scope = (items && items.length) ? items : state.items.slice();
  if (!scope.length) { showToast('Nothing to export yet'); return; }
  exportScope = scope;
  const el = $('#export-scope');
  if (el) el.textContent = scope.length + ' item' + (scope.length === 1 ? '' : 's') + ' to export';
  $('#export-dialog').showModal();
}

/* C1: quoting lives in store.js (formatDeckCell) so the exporter and the
 *  importer's parser cannot drift apart — every export must read back exactly. */
const exportCell = formatDeckCell;

function itemFieldValue(item, f) {
  switch (f) {
    case 'text': return item.text;
    case 'type': return item.type;
    case 'status': return item.userData.status;
    case 'tags': return (item.userData.tags || []).join(' ');
    case 'deck': return item.deck || '';
    case 'note': return item.userData.note || '';
    case 'sentence': return (item.context && item.context.sentence) || '';
    case 'source': return (item.context && item.context.sourceTitle) || '';
    case 'created': return new Date(item.createdAt).toISOString().slice(0, 10);
    default: return '';
  }
}

function runExport() {
  const fmt = ($('#export-format') && $('#export-format').value) || 'csv';
  const fields = [...document.querySelectorAll('#export-fields input:checked')].map((c) => c.dataset.field);
  // v119 A3: the .apkg path ignores the field checkboxes — an Anki deck has a
  // fixed two-field note type (Front/Back) built by buildApkgNotes().
  if (fmt === 'apkg') { const s = exportScope; $('#export-dialog').close(); exportApkg(s); return; }
  if (!fields.length) { showToast('Pick at least one field'); return; }
  if (fmt === 'json') { const s = exportScope; $('#export-dialog').close(); exportItems(s); return; }
  const delim = fmt === 'csv' ? ',' : '\t';
  const lines = [];
  if (fmt === 'anki') { lines.push('#separator:tab'); lines.push('#html:false'); lines.push('#columns:' + fields.join(',')); }
  lines.push(fields.join(delim));
  for (const it of exportScope) lines.push(fields.map((f) => exportCell(itemFieldValue(it, f), delim)).join(delim));
  const ext = fmt === 'csv' ? 'csv' : (fmt === 'tsv' ? 'tsv' : 'txt');
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain' }), 'dual-dictionary-export-' + new Date().toISOString().slice(0, 10) + '.' + ext);
  $('#export-dialog').close();
  showToast('Exported ' + exportScope.length + ' item' + (exportScope.length === 1 ? '' : 's') + ' (' + fmt.toUpperCase() + ')');
}

/* ================= v119 A3: Anki .apkg export (real deck, offline) =================
 * The vault already exports an Anki-ready .txt; this ships the actual .apkg so
 * the deck imports in one step. Everything stays client-side: sql.js (MIT,
 * lazily fetched like the PDF engine — see sw.js runtime caching) builds
 * collection.anki2, js/vendor/apkg-writer.js zips it, then the blob downloads.
 * No network call, no server: the .wasm rides in the app's own origin. */

let apkgWriterPromise = null;
/** Lazy-load sql.js + the apkg writer once per page. The two vendored files are
 *  fetched on first export and then served from the SW runtime cache (offline
 *  from the second export on). */
function loadApkgWriter() {
  if (!apkgWriterPromise) {
    // sql-wasm.js ships as a UMD script (no ES exports), so it loads via a
    // classic script tag and hands over window.initSqlJs; the ES-module
    // apkg-writer.js imports normally. Both files come from our own origin and
    // the SW runtime-caches them on first use — offline from the second export.
    apkgWriterPromise = new Promise((resolve, reject) => {
      if (window.initSqlJs) { resolve(); return; }
      const sc = document.createElement('script');
      sc.src = './js/vendor/sql-wasm.js';
      sc.onload = resolve;
      sc.onerror = () => reject(new Error('could not load js/vendor/sql-wasm.js'));
      document.head.appendChild(sc);
    })
      .then(() => Promise.all([window.initSqlJs({ locateFile: (f) => './js/vendor/' + f }), import('./vendor/apkg-writer.js')]))
      .then(([SQL, writer]) => ({ SQL, writer }))
      .catch((e) => {
        apkgWriterPromise = null; // let a retry (e.g. back online) try again
        throw e;
      });
  }
  return apkgWriterPromise;
}

/** Map vault items → Anki notes (Front = the saved text, Back = the gloss-ish
 *  context, Tags = the item tags + type/status/deck markers). */
function buildApkgNotes(items, writer) {
  return items.map((it) => {
    const parts = [];
    const note = (it.userData && it.userData.note) || '';
    const sentence = (it.context && it.context.sentence) || '';
    const source = (it.context && it.context.sourceTitle) || '';
    if (note) parts.push('<div class="note">' + escapeHtml(note) + '</div>');
    if (sentence) parts.push('<div class="ctx">' + escapeHtml(sentence) + '</div>');
    if (source) parts.push('<div class="src">' + escapeHtml(source) + '</div>');
    const tags = [...(it.userData && it.userData.tags ? it.userData.tags : [])];
    tags.push(it.type);
    if (it.userData && it.userData.status) tags.push(it.userData.status);
    if (it.deck) tags.push(it.deck);
    return {
      id: apkgNoteId(it.id),
      guid: writer.guidFor(it.id),
      front: escapeHtml(it.text),
      back: parts.join('\n'),
      tags: ' ' + tags.map((t) => String(t).replace(/\s+/g, '_')).join(' ') + ' ',
      mod: Math.floor((it.createdAt || Date.now()) / 1000),
      sortField: it.text,
    };
  });
}

/** Anki note ids must be positive integers that fit SQLite's INTEGER (and stay
 *  under 2^63). Hash the item id into a stable 13-digit number. */
function apkgNoteId(id) {
  const s = String(id || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 1700000000000 + (h % 1000000000);
}

async function exportApkg(items) {
  if (!items || !items.length) { showToast(i18n('apkg.nothing')); return; }
  showToast(i18n('apkg.building'));
  try {
    const { SQL, writer } = await loadApkgWriter();
    const notes = buildApkgNotes(items, writer);
    const deckName = 'Dual Dictionary' + (notes.length ? '' : '');
    const { bytes, noteCount } = writer.buildApkg(SQL, notes, { deckName });
    downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }),
      'dual-dictionary-anki-' + new Date().toISOString().slice(0, 10) + '.apkg');
    showToast(i18nFmt('apkg.done', { n: noteCount }));
  } catch (e) {
    console.warn('apkg export failed:', e);
    showToast(i18n('apkg.failed'));
  }
}

/* ================= Phase 3+ : Micro-exercises (P1) ================= */
/* 5–10 item sessions built from what you saved. Four exercise kinds:
 *   cloze      — fill the missing word in your saved sentence
 *   dictation  — hear the sentence, type it
 *   listen     — hear the item, type it
 *   choice     — pick the correct meaning
 * Offline-first: cloze / dictation / listen need no dictionary; choice turns on
 * when glosses are available (a dictionary is loaded). */
let practiceQueue = [];
let practiceIndex = 0;
let practiceStats = { done: 0, ok: 0, streak: 0 };
let practiceChecked = false;
let practiceGloss = new Map();

/* ===== v112/v113: curriculum practice (docs/plan-p2-fuzzy-practice.md) =====
 * Practice so far only ran over SAVED vault items — a new user with an empty
 * vault hit a dead end. The decks below practice the built headword list
 * (data/built-words.json, generated by the word-pages builder) WITHOUT touching
 * the FSRS queue (D1): sessions are ephemeral, and a wrong answer offers a
 * one-tap "Save to Vault" that goes through the same addItem pipeline as the
 * ☆ button. D3 (long-term counters) was dropped by the owner. */
/* Deck membership against the real data shape [word, band('1k'|'2k'|'5k'|'10k'|'awl'),
 * ngslRank(1..2809|0), awlSublist(1..10|0)] — counts at build time:
 * ngsl1 911 · ngsl2 783 · ngsl3 580 · offngsl 3,488 · awl 569 (6,331/6,839 words;
 * the rest are low-band forms with no NGSL rank, still reachable via search). */
const PRACTICE_DECKS = [
  { id: 'ielts', key: 'practice.deck.ielts' },
  { id: 'toeic', key: 'practice.deck.toeic' },
  { id: 'ngsl1', key: 'practice.deck.ngsl1' },
  { id: 'ngsl2', key: 'practice.deck.ngsl2' },
  { id: 'ngsl3', key: 'practice.deck.ngsl3' },
  { id: 'offngsl', key: 'practice.deck.offngsl' },
  { id: 'awl', key: 'practice.deck.awl' },
  { id: 'reading', key: 'practice.deck.reading' },   // v119 A4: cloze from your own reading
  { id: 'vault', key: 'practice.deck.vault' },
];
let curriculumDeck = null;   // the deck the current session came from (summary "again")

/* P1 exam decks (owner-approved 01/11): IELTS Core = exam-tagged words;
 * TOEIC Business = the business-headword subset (shared BIZ list with the
 * build-time CTA). Membership comes from data/exam-tags.json (built-words
 * rows carry no exam tags). Loaded once, cached like loadBuiltWords. */
const TOEIC_BIZ_WORDS = 'account bank balance invoice payment budget finance marketing sales contract meeting office shipping delivery order customer client employee manager payroll revenue profit audit tax loan credit stock share board quarter expense claim warranty supplier retail import export freight cargo warehouse inventory deadline overtime salary conference proposal dividend interest mortgage insurance premium booking memo agenda'.split(' ');
let examTagsPromise = null;
function loadExamTags() {
  if (!examTagsPromise) {
    examTagsPromise = fetch('./data/exam-tags.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return examTagsPromise;
}
let examTagSet = null;
function examTagHas(word, deckId) {
  const t = examTagSet && examTagSet.words && examTagSet.words[String(word).toLowerCase()];
  if (!t) return false;
  if (deckId === 'ielts') return (t.tags || []).includes('ielts');
  if (deckId === 'toeic') return TOEIC_BIZ_WORDS.indexOf(String(word).toLowerCase()) !== -1;
  return false;
}
function deckWords(deckId, rows) {
  return rows.filter(([w, b, r, a]) => {
    if (w.length < 3) return false;   // "a"/"i" are real NGSL words but pointless drills
    if (deckId === 'ielts' || deckId === 'toeic') return examTagHas(w, deckId);
    if (deckId === 'awl') return a > 0;
    if (deckId === 'ngsl1') return a === 0 && r >= 1 && r <= 1000;
    if (deckId === 'ngsl2') return a === 0 && r >= 1001 && r <= 2000;
    if (deckId === 'ngsl3') return a === 0 && r >= 2001;
    if (deckId === 'offngsl') return a === 0 && r === 0 && (b === '5k' || b === '10k');
    return false;
  }).map((row) => row[0]);
}

/* v119 A4 — the "reading cloze" deck: everything the user SAVED while reading
 * (a word/phrase carrying its captured sentence, or a saved sentence with a
 * headword) becomes a fill-the-gap drill over the sentence they actually read.
 * Unlike the curriculum decks these items are REAL vault items with FSRS state:
 * "Got it"/"Review again" grade through finishPracticeCard, so the reading
 * loop actually moves the review schedule. Items already marked 'known' are
 * skipped — the A2 milestone/known flow says those need no practice. */
function readingClozePool() {
  return state.items.filter((it) => {
    if (it.userData && it.userData.status === 'known') return false;
    if (it.type === 'sentence') return !!(it.context && it.context.headword && it.text);
    return !!(it.context && it.context.sentence);
  });
}

async function startReadingClozePractice() {
  const pool = shuffleArr(readingClozePool()).slice(0, 10);
  if (!pool.length) { showToast(i18n('practice.deckEmpty')); return; }
  curriculumDeck = 'reading';
  practiceQueue = pool.map((it) => ({ ...it, forceCloze: true }));
  practiceIndex = 0;
  practiceStats = { done: 0, ok: 0, streak: 0 };
  practiceChecked = false;
  practiceGloss = new Map();
  renderPractice();
}

async function startCurriculumPractice(deckId) {
  const bw = await loadBuiltWords();
  if (!bw || !bw.words) { showToast(i18n('practice.deckUnavailable')); return; }
  if (deckId === 'ielts' || deckId === 'toeic') { try { examTagSet = await loadExamTags(); } catch (e) { examTagSet = null; } }
  const pool = deckWords(deckId, bw.words).filter((w) => !isSaved(w));
  if (!pool.length) { showToast(i18n('practice.deckEmpty')); return; }
  shuffleArr(pool);
  curriculumDeck = deckId;
  practiceQueue = pool.slice(0, 10).map((w) => ({
    id: 'cur:' + deckId + ':' + w,
    synthetic: true,          // D1: never graded into the FSRS queue
    type: 'word',
    text: w,
    context: { headword: w },
  }));
  practiceIndex = 0;
  practiceStats = { done: 0, ok: 0, streak: 0 };
  practiceChecked = false;
  practiceGloss = new Map();
  const countEl = $('#practice-count');
  if (countEl) countEl.textContent = i18n('practice.deckLoading');
  // mine material in the background, like startPractice does for glosses: a
  // Vietnamese gloss (choice/recall), a real example sentence (cloze) and the
  // bundled IPA (the v113 IPA drill). Whatever comes back too late or empty
  // simply falls through to a listen drill.
  await Promise.all(practiceQueue.map(async (it) => {
    try { const g = await quickGloss(it.text); if (g) practiceGloss.set(it.id, g); } catch (e) { /* next */ }
    try { const sent = await firstExampleSentence(it.text); if (sent) it.context.sentence = sent; } catch (e) { /* next */ }
    try { it.ipa = (await ipaForWord(it.text))[0] || ''; } catch (e) { it.ipa = ''; }
  }));
  assignCurriculumKinds(pool);
  renderPractice();
}

/* P1 TOEIC mix (owner-approved 01/11): 44 business words are a thin deck —
 * mix in the 161 TOEIC-tagged phrases as EN->VI flashcards + cloze over the
 * hand-written exam sentences. Phrases skip IPA/listen drills (no word IPA). */
let examPhrasePool = null;
async function loadToeicPhrases() {
  if (examPhrasePool) return examPhrasePool;
  try {
    const [tags, ex] = await Promise.all([
      fetch('./data/exam-tags.json').then((r) => (r.ok ? r.json() : null)),
      fetch('./data/exam-examples.json').then((r) => (r.ok ? r.json() : null)),
    ]);
    const out = [];
    const pt = (tags && tags.phrases) || {};
    const exP = (ex && ex.phrases) || {};
    for (const slug of Object.keys(pt)) {
      if (!((pt[slug].tags || []).includes('toeic'))) continue;
      const key = slug.replace(/-/g, ' ');
      const entry = exP[slug] || exP[key];
      if (!entry) continue;
      const [en, vi] = Array.isArray(entry[0]) ? entry[0] : entry;
      out.push({ phrase: key, slug, gloss: entry.m || vi || '', en, vi });
    }
    examPhrasePool = out;
  } catch (e) { examPhrasePool = []; }
  return examPhrasePool;
}

async function startToeicMixPractice() {
  const bw = await loadBuiltWords();
  if (!bw || !bw.words) { showToast(i18n('practice.deckUnavailable')); return; }
  try { examTagSet = await loadExamTags(); } catch (e) { examTagSet = null; }
  const words = deckWords('toeic', bw.words).filter((w) => !isSaved(w));
  const phrases = (await loadToeicPhrases()).slice();
  shuffleArr(words); shuffleArr(phrases);
  const queue = [];
  for (const w of words.slice(0, 5)) queue.push({ id: 'cur:toeic:' + w, synthetic: true, type: 'word', text: w, context: { headword: w } });
  for (const ph of phrases.slice(0, 5)) queue.push({ id: 'cur:toeicp:' + ph.slug, synthetic: true, type: 'phrase', text: ph.phrase, context: { headword: ph.phrase, sentence: ph.en }, gloss: ph.gloss, vi: ph.vi });
  if (!queue.length) { showToast(i18n('practice.deckEmpty')); return; }
  shuffleArr(queue);
  curriculumDeck = 'toeic';
  practiceQueue = queue;
  practiceIndex = 0;
  practiceStats = { done: 0, ok: 0, streak: 0 };
  practiceChecked = false;
  practiceGloss = new Map();
  for (const it of practiceQueue) if (it.gloss) practiceGloss.set(it.id, it.gloss);
  await Promise.all(practiceQueue.filter((it) => it.type === 'word').map(async (it) => {
    try { const g = await quickGloss(it.text); if (g && !practiceGloss.has(it.id)) practiceGloss.set(it.id, g); } catch (e) {}
    try { const sent = await firstExampleSentence(it.text); if (sent) it.context.sentence = sent; } catch (e) {}
    try { it.ipa = (await ipaForWord(it.text))[0] || ''; } catch (e) { it.ipa = ''; }
  }));
  // phrases: EN->VI choice/recall + cloze over the exam sentence only
  for (const it of practiceQueue) if (it.type === 'phrase') it.drillKinds = ['choice', 'recall', 'cloze'];
  assignToeicDeepKinds(practiceQueue);
  assignCurriculumKinds(practiceQueue.map((it) => it.text));
  renderPractice();
}

/* P2 TOEIC-deep (owner-approved 01/11): two extra drill shapes for phrases.
 * 1. prep-gap: hide the PREPOSITION inside a phrasal phrase (look forward TO,
 *    take care OF, in charge OF) — the learner types the missing particle.
 * 2. near-pick: confuse with a NEAR phrase sharing a token (take care of vs
 *    take charge of, look forward to vs look up to) — EN->VI choice with the
 *    near gloss as distractor.
 * Both are best-effort: phrases without a known prep or near pair keep the
 * standard choice/recall/cloze rotation. */
const PREP_WORDS = ['to','of','for','with','on','in','at','up','out','off','into','over','from','about','after','before','between','through','during','without','within','along','across','behind','beyond','plus','except','but','toward','towards','upon','among','per'];
const NEAR_PAIRS = { 'take care of':['take charge of','take part in'], 'take charge of':['take care of','take part in'], 'look forward to':['look up to','look out for'], 'deal with':['cope with','come up with'], 'come up with':['deal with','keep up with'], 'in charge of':['take charge of','out of stock'], 'out of stock':['in charge of','out of order'], 'as a result':['result in','lead to'], 'result in':['as a result','lead to'], 'lead to':['result in','as a result'] };
function prepGapOf(phrase, sent) {
  const toks = String(phrase).split(/\s+/);
  const preps = toks.map((w,i)=>({w:w.toLowerCase(),i})).filter((o)=>PREP_WORDS.indexOf(o.w)!==-1);
  if (!preps.length || !sent) return null;
  const target = preps[preps.length-1];
  const re = new RegExp('(^|[^\\p{L}])(' + target.w + ')(?=[^\\p{L}]|$)', 'i');
  const m = String(sent).match(re);
  if (!m) return null;
  const idx = m.index + m[1].length;
  return { text: sent.slice(0,idx) + '_____' + sent.slice(idx + m[2].length), answer: m[2].toLowerCase(), hint: 'điền giới từ còn thiếu' };
}
function assignToeicDeepKinds(queue) {
  const phrases = queue.filter((it)=>it.type==='phrase');
  if (phrases.length < 2) return;
  // rotate: every 3rd phrase gets prep-gap, every 4th gets near-pick
  let n = 0;
  for (const it of phrases) {
    n++;
    if (n % 3 === 0) {
      const g = prepGapOf(it.text, it.context && it.context.sentence);
      if (g) { it.deepKind = 'prep-gap'; it.deepGap = g; }
    } else if (n % 4 === 0) {
      const nears = NEAR_PAIRS[it.text.toLowerCase()];
      if (nears && nears.length) { it.deepKind = 'near-pick'; it.deepNears = nears; }
    }
  }
}
function assignCurriculumKinds(deckPool) {
  const cycle = ['choice', 'recall', 'listen', 'cloze', 'ipa', 'say'];
  let i = 0;
  for (const it of practiceQueue) {
    if (quizModeLock && quizModeLock.length && it.drillKinds === undefined) {
      it.practiceKind = quizModeLock[0] === 'recall' ? 'recall' : quizModeLock[0];
      if (quizModeLock[0] === 'cards') it.practiceKind = 'recall';
      continue;
    }
    const has = {
      choice: practiceGloss.has(it.id),
      recall: practiceGloss.has(it.id),
      listen: true,
      cloze: !!(it.context && it.context.sentence),
      ipa: !!it.ipa,
      say: !!SR_CLASS,
    };
    let kind = 'listen';
    for (let k = 0; k < cycle.length; k++) {
      const cand = cycle[(i + k) % cycle.length];
      if (has[cand]) { kind = cand; break; }
    }
    it.practiceKind = kind;
    if (kind === 'ipa') {
      // distractors: three other words from the same session, shuffled in later
      it.ipaOptions = shuffleArr([it.text].concat(shuffleArr(deckPool.filter((w) => w !== it.text)).slice(0, 3)));
    }
    i++;
  }
}

/* Mine the first "=English+ Vietnamese" example that actually contains the
 * headword — OVDP-convention raws only (same detection quickGloss uses). */
async function firstExampleSentence(word) {
  for (const slot of Object.keys(SLOTS)) {
    const d = state.dicts[slot];
    if (!d) continue;
    try {
      const hits = await d.mdx.lookup(word);
      if (!hits.length) continue;
      const raw = String(hits[0].text).replace(/\u0000/g, '');
      if (!/(^|\s)[@*!]/.test(raw) || /<\w/.test(raw)) continue; // MTD plain text only
      const wRe = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(word) + '(?=[^\\p{L}\\p{N}]|$)', 'iu');
      for (const m of raw.matchAll(/=([A-Za-z][^=\n+]{5,140}?)\+[^=\n]{0,140}/g)) {
        const sent = m[1].replace(/\s+/g, ' ').trim();
        if (sent.length < 12 || sent.length > 140) continue;
        if (!/^[A-Za-z][A-Za-z'’\- ,.;:!?()]+$/.test(sent)) continue; // latin-only, no leaks
        if (wRe.test(sent)) return sent;
      }
    } catch (e) { /* try the next slot */ }
  }
  return '';
}

function renderPracticePicker() {
  const stage = $('#practice-stage');
  if (!stage) return;
  stage.innerHTML = '';
  const empty = $('#practice-empty');
  empty && empty.classList.add('hidden');
  const c = $('#practice-count'); if (c) c.textContent = '';
  const card = document.createElement('div');
  card.className = 'practice-card';
  const p = document.createElement('p');
  p.className = 'practice-prompt';
  p.textContent = i18n('practice.pickDeck');
  card.appendChild(p);
  const box = document.createElement('div');
  box.className = 'practice-decks';
  for (const d of PRACTICE_DECKS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-secondary';
    b.textContent = i18n(d.key);
    b.addEventListener('click', () => {
      if (d.id === 'vault') startPractice();
      else if (d.id === 'reading') startReadingClozePractice();
      else if (d.id === 'toeic') startToeicMixPractice();
      else startCurriculumPractice(d.id);
    });
    box.appendChild(b);
  }
  card.appendChild(box);
  stage.appendChild(card);
}

/* v113 deep-link: /?deck=ngsl1 lands on Practice with that deck started —
 * the word pages' "Luyện band này" CTA points here (page-side CTA ships with
 * the next content rebuild per the plan). */
let pendingDeck = null;
function parseDeckParam() {
  try {
    const d = new URLSearchParams(location.search).get('deck');
    if (d && PRACTICE_DECKS.some((x) => x.id === d)) pendingDeck = d;
  } catch (e) { /* best-effort */ }
}
function replayPendingDeck() {
  if (!pendingDeck) return;
  const deck = pendingDeck;
  pendingDeck = null;
  navigate('practice');
  if (deck === 'vault') startPractice();
  else if (deck === 'reading') startReadingClozePractice();
  else if (deck === 'toeic') startToeicMixPractice();
  else startCurriculumPractice(deck);
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

function practicePool() {
  const now = Date.now();
  const due = state.items.filter((i) => i.due <= now && i.userData.status !== 'known');
  const rest = state.items.filter((i) => due.indexOf(i) === -1).sort((a, b) => b.createdAt - a.createdAt);
  return due.concat(rest);
}

/* Quiz Vault 07/11 (Cambridge +Plus 3 dạng): flashcards / nghe-gõ / trắc nghiệm
 * trên chính Vault user — tái dùng practiceQueue + drills sẵn có. */
function startVaultQuiz(mode) {
  const pool = practicePool().slice(0, 10);
  if (!pool.length) { showToast(i18n('practice.deckEmpty')); return; }
  const kinds = { cards: ['recall'], listen: ['listen', 'dictation'], choice: ['choice'] }[mode] || ['recall'];
  curriculumDeck = 'vault';
  practiceQueue = pool.map((it) => ({ ...it }));
  practiceIndex = 0;
  practiceStats = { done: 0, ok: 0, streak: 0 };
  practiceChecked = false;
  practiceGloss = new Map();
  quizModeLock = kinds;
  renderPractice();
  Promise.all(practiceQueue.map(async (it) => {
    if (it.type === 'word' || it.type === 'phrase') {
      try { const g = await meaningForItem(it); if (g) practiceGloss.set(it.id, g); } catch (e) {}
    }
  })).then(() => { if (practiceIndex === 0 && practiceQueue.length) renderPractice(); });
}
let quizModeLock = null;
/* Level test 07/11 trong app: 20 câu trắc nghiệm A2–C1 (giống web quiz),
 * lưu level → gợi packs + WOTD theo level. */
const LEVEL_QS = [
  ["abandon","bỏ rơi / từ bỏ","giữ lại","sửa chữa","đón nhận",0,"B2"],
  ["ability","khả năng","sự yếu đuối","sự chậm trễ","từ chối",0,"A2"],
  ["benefit","lợi ích","tác hại","chi phí","rủi ro",0,"B1"],
  ["deadline","hạn chót","khởi đầu","giờ nghỉ","ngày lễ",0,"B1"],
  ["sustainable","bền vững","tạm thời","tốn kém","nguy hiểm",0,"C1"],
  ["opportunity","cơ hội","khó khăn","thất bại","nguy cơ",0,"B1"],
  ["acquire","đạt được","đánh mất","bỏ qua","trì hoãn",0,"C1"],
  ["efficient","hiệu quả","lãng phí","chậm chạp","cẩu thả",0,"B2"],
  ["diverse","đa dạng","đồng nhất","đơn điệu","hạn chế",0,"B2"],
  ["phenomenon","hiện tượng","nguyên nhân","kết quả","giả thuyết",0,"C1"],
  ["reluctant","miễn cưỡng","hăng hái","vui vẻ","tự nguyện",0,"C1"],
  ["compulsory","bắt buộc","tự chọn","không cần thiết","tạm hoãn",0,"B2"],
  ["fragile","dễ vỡ","cứng cáp","bền bỉ","dẻo dai",0,"B2"],
  ["controversy","tranh cãi","đồng thuận","im lặng","bí mật",0,"C1"],
  ["diligent","chăm chỉ","lười biếng","cẩu thả","kiêu ngạo",0,"B2"],
  ["obsolete","lỗi thời","hiện đại","mới mẻ","thịnh hành",0,"C1"],
  ["generous","hào phóng","keo kiệt","ích kỷ","lạnh lùng",0,"B1"],
  ["ambiguous","mơ hồ","hăng hái","rõ ràng","chắc chắn",0,"C1"],
  ["thrive","phát triển mạnh","suy tàn","dậm chân","biến mất",0,"C1"],
  ["punctual","đúng giờ","trễ nãi","vội vàng","thong thả",0,"B1"]
];
let levelAnswers = null;
function startLevelTest() {
  levelAnswers = new Array(LEVEL_QS.length).fill(-1);
  practiceQueue = [];
  practiceIndex = 0;
  navigate('practice');
  renderLevelTest();
}
function renderLevelTest() {
  const stage = document.getElementById('practice-stage');
  if (!stage) return;
  const empty = document.getElementById('practice-empty');
  empty && empty.classList.add('hidden');
  let h = '<div class="practice-card"><p class="practice-prompt">Test trình độ (20 câu, ~3 phút)</p>';
  LEVEL_QS.forEach((q, i) => {
    h += '<p style="margin:10px 0 4px"><strong>Câu ' + (i + 1) + ' [' + q[6] + ']: ' + escapeHtml(q[0]) + '</strong></p><div>';
    for (let k = 1; k <= 4; k++) {
      const sel = levelAnswers[i] === k - 1;
      h += '<button type="button" class="btn-secondary" data-q="' + i + '" data-k="' + (k - 1) + '" style="' + (sel ? 'border-color:#0f766e;background:#ecfdf5' : '') + '">' + escapeHtml(q[k]) + '</button> ';
    }
    h += '</div>';
  });
  h += '<p style="margin-top:12px"><button type="button" class="btn-primary" id="level-finish">Xem kết quả</button></p><div id="level-res"></div></div>';
  stage.innerHTML = h;
  stage.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    levelAnswers[+b.dataset.q] = +b.dataset.k;
    renderLevelTest();
  }));
  document.getElementById('level-finish').addEventListener('click', () => {
    let score = 0;
    LEVEL_QS.forEach((q, i) => { if (levelAnswers[i] === q[5]) score++; });
    const lv = score >= 17 ? 'C1' : score >= 12 ? 'B2' : score >= 7 ? 'B1' : 'A2';
    try { localStorage.setItem('dd-level', lv); } catch (e) {}
    const deck = { A2: 'ngsl1', B1: 'ngsl2', B2: 'ielts', C1: 'awl' }[lv];
    document.getElementById('level-res').innerHTML = '<p class="practice-prompt">Kết quả: ' + score + '/20 — trình độ ' + lv + '</p><p><button type="button" class="btn-primary" id="level-go">Học ngay gói ' + deck.toUpperCase() + ' →</button></p>';
    document.getElementById('level-go').addEventListener('click', () => startCurriculumPractice(deck));
  });
}
async function startPractice(ids) {
  let items;
  if (ids && ids.length) items = ids.map(getItemById).filter(Boolean);
  else items = practicePool();
  practiceQueue = items.slice(0, 10);
  practiceIndex = 0;
  practiceStats = { done: 0, ok: 0, streak: 0 };
  practiceChecked = false;
  practiceGloss = new Map();
  renderPractice();
  // best-effort glosses (no dictionary → 'choice' is simply not used)
  await Promise.all(practiceQueue.map(async (it) => {
    if (it.type === 'word' || it.type === 'phrase') {
      try { const g = await meaningForItem(it); if (g) practiceGloss.set(it.id, g); } catch (e) { /* next */ }
    }
  }));
  if (practiceIndex === 0 && practiceQueue.length) renderPractice();
}

function practiceExercise(item) {
  // v112: curriculum items carry a pre-assigned kind (data mined at session
  // start) and MUST NOT fall through to the vault logic below — a synthetic
  // item without userData would mis-render and D1 forbids grading it anyway.
  // v119 A4: the reading deck forces the cloze shape and matches INFLECTED
  // forms — hw 'run' gaps 'running' via lemmaCandidates, hw 'say' gaps 'said'
  // (the irregular map). No candidate matches → honest fallback, never a
  // fake gap. Items here are real vault rows, so grading below stays FSRS.
  if (item.forceCloze) {
    const sent = item.type === 'sentence' ? item.text : (item.context && item.context.sentence);
    const hw = item.type === 'sentence' ? (item.context && item.context.headword) || '' : item.text;
    if (sent && hw) {
      const c = clozeInflected(sent, hw);
      if (c) return { kind: 'cloze', hw: c.answer, sent: sent };
    }
    return item.type === 'sentence' ? { kind: 'dictation', sent: sent || '' } : { kind: 'listen', text: item.text };
  }
  if (item.synthetic) {
    if (item.deepKind === 'prep-gap' && item.deepGap) return { kind: 'prep-gap', gap: item.deepGap, gloss: practiceGloss.get(item.id) };
    if (item.deepKind === 'near-pick') return { kind: 'near-pick', nears: item.deepNears || [], gloss: practiceGloss.get(item.id) };
    const g = practiceGloss.get(item.id);
    switch (item.practiceKind) {
      case 'choice': if (g) return { kind: 'choice', gloss: g }; break;
      case 'recall': if (g) return { kind: 'recall', gloss: g }; break;
      case 'cloze': if (item.context && item.context.sentence) return { kind: 'cloze', hw: item.context.headword || item.text, sent: item.context.sentence }; break;
      case 'ipa': if (item.ipa && item.ipaOptions) return { kind: 'ipa', ipa: item.ipa, answer: item.text, options: item.ipaOptions }; break;
      case 'say': if (SR_CLASS) return { kind: 'say' }; break;
    }
    return { kind: 'listen', text: item.text };   // curriculum fallback: hear + type
  }
  const hw = (item.context && item.context.headword) || (item.type !== 'sentence' ? item.text : '');
  const sent = (item.context && item.context.sentence) || (item.type === 'sentence' ? item.text : '');
  if (item.type === 'sentence' && sent) return { kind: 'dictation', sent: sent };
  const g = practiceGloss.get(item.id);
  if (g && practiceGloss.size >= 4) return { kind: 'choice', gloss: g };
  // A saved dictionary sense is the review answer even when there are too few
  // cards to build a multiple-choice set. Never fall through to a fresh
  // dictionary lookup or hide the selected sense behind a generic sentence.
  if (g) return { kind: 'recall', gloss: g };
  if (sent && hw) return { kind: 'cloze', hw: hw, sent: sent };
  const tr = item.dictionary && item.dictionary.translation;
  if (tr) return { kind: 'recall', gloss: tr };
  // v69 R4: with browser speech recognition the fall-through drill becomes
  // "say it aloud" (see the word, speak it, get checked); without it, listen.
  if (SR_CLASS && (item.type === 'word' || item.type === 'phrase')) return { kind: 'say' };
  return { kind: 'listen', text: item.text };
}

function clozeSentence(sent, hw) {
  const esc = escapeRegExp(hw).replace(/\\ /g, '\\s+');
  const re = new RegExp('(^|[^\\p{L}\\p{N}\'-])(' + esc + ')(?=[^\\p{L}\\p{N}\'-]|$)', 'iu');
  const m = String(sent).match(re);
  if (m) {
    const answer = m[2];
    const idx = m.index + m[1].length;
    return { text: sent.slice(0, idx) + '_____' + sent.slice(idx + answer.length), answer: answer };
  }
  return { text: String(sent), answer: hw };
}

/** v119 A4 — cloze that also gaps INFLECTED occurrences of the headword: hw
 *  'run' gaps 'running', 'says'/'said'; 'city' gaps 'cities'. The base match is
 *  tried first (exact), then the regular suffix set; irregular forms come from
 *  lemmaCandidates' IRREGULAR map reversed onto the sentence tokens. Returns
 *  null when nothing matches — the caller falls back honestly (no fake gap). */
function clozeInflected(sent, hw) {
  const base = clozeSentence(sent, hw);
  if (base.text !== String(sent)) return base;
  const tokens = String(sent).match(/[\p{L}\p{N}'-]+/gu) || [];
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lemmaCandidates(lower).indexOf(hw.toLowerCase()) !== -1) {
      const c = clozeSentence(sent, lower);
      if (c.text !== String(sent)) return c;
    }
  }
  return null;
}

function renderPractice() {
  const stage = $('#practice-stage');
  if (!stage) return;
  const empty = $('#practice-empty');
  empty && empty.classList.add('hidden');
  const countEl = $('#practice-count');
  if (!practiceQueue.length) {
    stage.innerHTML = '';
    empty && empty.classList.remove('hidden');
    if (countEl) countEl.textContent = '';
    return;
  }
  if (practiceIndex >= practiceQueue.length) { renderPracticeSummary(); return; }
  if (countEl) countEl.textContent = (practiceIndex + 1) + '/' + practiceQueue.length + ' · ' + practiceStats.ok + ' got it · streak ' + practiceStats.streak;
  const item = practiceQueue[practiceIndex];
  const ex = practiceExercise(item);
  stage.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'practice-card';
  const KIND = { cloze: i18n('practice.cloze'), dictation: i18n('practice.dictation'), listen: i18n('practice.listen'), choice: i18n('practice.choice'), recall: i18n('practice.recall'), say: i18n('practice.say'), ipa: i18n('practice.ipa') };
  const head = document.createElement('p');
  head.className = 'practice-kind';
  head.textContent = KIND[ex.kind] + ' · ' + item.type;
  card.appendChild(head);
  const prompt = document.createElement('p');
  prompt.className = 'practice-prompt';
  card.appendChild(prompt);
  const feedback = document.createElement('p');
  feedback.className = 'practice-feedback';
  const actions = document.createElement('div');
  actions.className = 'review-actions';
  const gotBtn = document.createElement('button');
  gotBtn.type = 'button'; gotBtn.className = 'btn-secondary'; gotBtn.textContent = i18n('practice.got'); gotBtn.disabled = true;
  gotBtn.dataset.act = 'got';
  const againBtn = document.createElement('button');
  againBtn.type = 'button'; againBtn.className = 'btn-secondary'; againBtn.textContent = i18n('practice.again'); againBtn.disabled = true;
  againBtn.dataset.act = 'again';
  gotBtn.addEventListener('click', () => finishPracticeCard(item, true));
  againBtn.addEventListener('click', () => finishPracticeCard(item, false));

  if (ex.kind === 'near-pick' && ex.nears && ex.nears.length) {
    prompt.textContent = '“' + (ex.gloss || item.text) + '” — cụm nào có nghĩa này?';
    card.dataset.answer = item.text;
    const opts = shuffleArr([item.text].concat(ex.nears.slice(0, 3)));
    const box = document.createElement('div');
    box.className = 'practice-options';
    for (const o of opts) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-secondary practice-option'; b.textContent = o;
      b.addEventListener('click', () => {
        const ok = o === item.text;
        practiceChecked = true;
        practiceStats.done++;
        if (ok) practiceStats.ok++;
        else practiceStats.streak = 0;
        feedback.textContent = ok ? '✓ Correct — ' + item.text : '✗ Đáp án: ' + item.text;
        feedback.classList.toggle('ok', ok); feedback.classList.toggle('bad', !ok);
        gotBtn.disabled = false; againBtn.disabled = false;
      });
      box.appendChild(b);
    }
    card.appendChild(box);
    card.appendChild(feedback);
    actions.append(gotBtn, againBtn); card.appendChild(actions);
    stage.appendChild(card);
    return;
  }
  if (ex.kind === 'choice') {
    prompt.textContent = item.text;
    card.dataset.answer = ex.gloss;
    const distractors = [];
    for (const pair of practiceGloss) { if (pair[0] !== item.id && pair[1] !== ex.gloss) distractors.push(pair[1]); }
    const opts = shuffleArr([ex.gloss].concat(shuffleArr(distractors).slice(0, 3)));
    const box = document.createElement('div');
    box.className = 'practice-options';
    for (const o of opts) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-secondary practice-option'; b.textContent = o;
      b.addEventListener('click', () => {
        if (practiceChecked) return;
        practiceChecked = true;
        const ok = o === ex.gloss;
        practiceStats.streak = ok ? practiceStats.streak + 1 : 0;
        [...box.children].forEach((c) => { c.disabled = true; if (c.textContent === ex.gloss) c.classList.add('opt-ok'); });
        if (!ok) b.classList.add('opt-bad');
        feedback.textContent = ok ? '✓ Correct' : '✗ Meaning: ' + ex.gloss;
        feedback.classList.toggle('ok', ok); feedback.classList.toggle('bad', !ok);
        gotBtn.disabled = false; againBtn.disabled = false;
        addPracticeSaveCta(actions, item, ok);
      });
      box.appendChild(b);
    }
    card.appendChild(box); card.appendChild(feedback);
    actions.append(gotBtn, againBtn); card.appendChild(actions);
    stage.appendChild(card);
    return;
  }

  if (ex.kind === 'ipa') {
    // v113: see the bundled IPA, pick the word it spells — distractors come
    // from the same session's deck so the confusion is plausible.
    prompt.textContent = '/' + ex.ipa + '/';
    const box = document.createElement('div');
    box.className = 'practice-options';
    for (const o of ex.options) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-secondary practice-option'; b.textContent = o;
      b.addEventListener('click', () => {
        if (practiceChecked) return;
        practiceChecked = true;
        const ok = o === ex.answer;
        practiceStats.streak = ok ? practiceStats.streak + 1 : 0;
        [...box.children].forEach((c) => { c.disabled = true; if (c.textContent === ex.answer) c.classList.add('opt-ok'); });
        if (!ok) b.classList.add('opt-bad');
        feedback.textContent = ok ? '✓ Correct — ' + ex.answer : '✗ Answer: ' + ex.answer;
        feedback.classList.toggle('ok', ok); feedback.classList.toggle('bad', !ok);
        gotBtn.disabled = false; againBtn.disabled = false;
        addPracticeSaveCta(actions, item, ok);
      });
      box.appendChild(b);
    }
    card.appendChild(box); card.appendChild(feedback);
    actions.append(gotBtn, againBtn); card.appendChild(actions);
    stage.appendChild(card);
    return;
  }

  if (ex.kind === 'say') {
    // see the word, say it aloud, get checked by the browser's speech engine
    prompt.textContent = i18n('practice.say') + ':';
    const wordEl = document.createElement('p');
    wordEl.className = 'practice-word';
    wordEl.textContent = item.text;
    card.appendChild(wordEl);
    if (TTS_SUPPORTED) {
      const pb = document.createElement('button');
      pb.type = 'button'; pb.className = 'btn-secondary'; pb.textContent = i18n('practice.hear');
      pb.addEventListener('click', () => speakAt(item.text));
      card.appendChild(pb);
    }
    card.appendChild(feedback);
    const mic = document.createElement('button');
    mic.type = 'button'; mic.className = 'btn-primary'; mic.textContent = i18n('practice.mic');
    mic.addEventListener('click', () => {
      if (practiceChecked) return;
      mic.disabled = true; mic.textContent = i18n('practice.micListening');
      recognizeOnce((out) => {
        mic.disabled = false; mic.textContent = i18n('practice.mic');
        practiceChecked = true;
        // v76: sentence-length targets get the coverage match — word drills keep
        // the strict spokenMatch. The heard line shows the coverage percentage.
        const sentenceTarget = item.text.trim().split(/\s+/).length >= 6;
        const cov = sentenceTarget ? spokenCoverage(item.text, out.heard) : 0;
        const ok = out.ok && (sentenceTarget ? cov >= 0.8 : spokenMatch(item.text, out.heard));
        const pct = sentenceTarget && out.ok ? ' (' + Math.round(cov * 100) + '%)' : '';
        practiceStats.streak = ok ? practiceStats.streak + 1 : 0;
        feedback.textContent = ok ? '✓ Correct — ' + item.text
          : out.ok ? '✗ ' + i18n('practice.heard') + ': “' + out.heard + '”' + pct + ' — ' + item.text
          : '✗ ' + i18n('practice.micError');
        feedback.classList.toggle('ok', ok); feedback.classList.toggle('bad', !ok);
        gotBtn.disabled = false; againBtn.disabled = false;
      });
    });
    actions.append(mic, gotBtn, againBtn); card.appendChild(actions);
    stage.appendChild(card);
    return;
  }

  let answer; let hear;
  if (ex.kind === 'prep-gap' && ex.gap) { prompt.textContent = ex.gap.text + ' (' + ex.gap.hint + ')'; answer = ex.gap.answer; hear = ''; }
  else if (ex.kind === 'cloze') { const c = clozeSentence(ex.sent, ex.hw); prompt.textContent = c.text; answer = c.answer; hear = ex.sent; }
  else if (ex.kind === 'dictation') { prompt.textContent = i18n('practice.dictation') + ':'; answer = ex.sent; hear = ex.sent; }
  else if (ex.kind === 'recall') { prompt.textContent = '“' + ex.gloss + '” — ' + i18n('practice.recall') + ':'; answer = item.text; hear = ''; }
  else { prompt.textContent = i18n('practice.listen') + ':'; answer = item.text; hear = item.text; }
  card.dataset.answer = answer;
  if (hear && TTS_SUPPORTED) {
    const pb = document.createElement('button');
    pb.type = 'button'; pb.className = 'btn-secondary'; pb.textContent = i18n('practice.hear');
    pb.addEventListener('click', () => speakAt(hear));
    card.appendChild(pb);
    if (ex.kind !== 'cloze') speakAt(hear);
  }
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'practice-input'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('aria-label', 'Your answer');
  card.appendChild(input); card.appendChild(feedback);
  const hintBtn = document.createElement('button');
  hintBtn.type = 'button'; hintBtn.className = 'btn-secondary'; hintBtn.textContent = i18n('practice.hint');
  let hintUsed = false;
  hintBtn.addEventListener('click', () => {
    if (hintUsed || practiceChecked) return;
    hintUsed = true; hintBtn.disabled = true;
    const a = String(answer || '');
    const hintEl = document.createElement('p');
    hintEl.className = 'practice-hint';
    hintEl.textContent = a.slice(0, 1) + ' ' + '•'.repeat(Math.max(0, a.length - 1)) + '  (' + a.length + ')';
    card.insertBefore(hintEl, feedback);
  });
  const checkBtn = document.createElement('button');
  checkBtn.type = 'button'; checkBtn.className = 'btn-primary'; checkBtn.textContent = i18n('practice.check');
  checkBtn.addEventListener('click', () => {
    if (practiceChecked) return;
    practiceChecked = true;
    const ok = normalizeText(input.value) === normalizeText(answer);
    practiceStats.streak = ok ? practiceStats.streak + 1 : 0;
    feedback.textContent = ok ? '✓ Correct — ' + answer : '✗ Answer: ' + answer;
    feedback.classList.toggle('ok', ok); feedback.classList.toggle('bad', !ok);
    gotBtn.disabled = false; againBtn.disabled = false; checkBtn.disabled = true;
    addPracticeSaveCta(actions, item, ok);
  });
  actions.append(hintBtn, checkBtn, gotBtn, againBtn);
  card.appendChild(actions);
  stage.appendChild(card);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!practiceChecked) checkBtn.click(); else gotBtn.click(); } });
  setTimeout(() => input.focus(), 30);
}

/* D1: a missed curriculum word never enters the FSRS queue on its own — the
 * user decides, with a one-tap save through the same addItem pipeline as the ☆
 * button. Only word items get it (sentences/phrases have no curriculum path). */
function addPracticeSaveCta(actions, item, ok) {
  if (ok || !item.synthetic || item.type !== 'word' || isSaved(item.text)) return;
  if (actions.querySelector('.practice-save')) return;
  const save = document.createElement('button');
  save.type = 'button'; save.className = 'btn-secondary practice-save';
  save.textContent = i18n('practice.saveCta');
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const r = await addItem({ type: 'word', text: item.text, box: 1, due: Date.now(), status: 'new' });
      if (!r.merged) state.items.unshift(r.item);
      updateVocabBadge();
      showToast(i18n('practice.savedToast'));
      save.textContent = '★';
    } catch (e) {
      showToast(i18n('practice.saveFail'));
      save.disabled = false;
    }
  });
  actions.appendChild(save);
}

async function finishPracticeCard(item, gotIt) {
  // D1: curriculum items are ephemeral — no FSRS grade, no vault write, the
  // only persistence path is the explicit save CTA the user just saw.
  if (item.synthetic) {
    if (gotIt) practiceStats.ok++;
    practiceStats.done++;
    practiceIndex++;
    practiceChecked = false;
    renderPractice();
    return;
  }
  if (gotIt) { await gradeById(item.id, 'know'); practiceStats.ok++; markPracticeDay(); }
  else {
    // Reading exercises are copies; only the canonical item owns scheduling.
    const saved = getItemById(item.id);
    if (saved && !saved.userData.tags.includes('review-later')) saved.userData.tags.push('review-later');
    await gradeById(item.id, 'forgot');
  }
  practiceStats.done++;
  practiceIndex++;
  practiceChecked = false;
  updateReviewBadge();
  renderPractice();
}

function renderPracticeSummary() {
  const stage = $('#practice-stage');
  if (!stage) return;
  stage.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'practice-card practice-summary';
  const t = document.createElement('p');
  t.className = 'practice-kind';
  t.textContent = i18n('practice.done');
  const p = document.createElement('p');
  p.className = 'practice-prompt';
  p.textContent = practiceStats.done + ' reviewed · ' + practiceStats.ok + ' got it · ' + (practiceStats.done - practiceStats.ok) + ' to review again';
  card.append(t, p);
  const actions = document.createElement('div');
  actions.className = 'review-actions';
  const again = document.createElement('button');
  again.type = 'button'; again.className = 'btn-primary'; again.textContent = i18n('practice.again2');
  again.addEventListener('click', () => {
    // v112: replay the deck the session came from — vault sessions keep vault
    if (curriculumDeck === 'reading') startReadingClozePractice();
    else if (curriculumDeck) startCurriculumPractice(curriculumDeck);
    else startPractice();
  });
  const vault = document.createElement('a');
  vault.className = 'btn-secondary'; vault.href = '#/vault'; vault.textContent = i18n('practice.openVault');
  actions.append(again, vault);
  card.appendChild(actions);
  stage.appendChild(card);
  const c = $('#practice-count'); if (c) c.textContent = '';
}

/* ================= Phase 3+ : Stats ================= */
/** Fill {placeholders} in an i18n template. */
function tpl(key, vars) {
  return String(i18n(key)).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
}
/** Pick the singular/plural variant of a key by count (VI has the same string twice). */
function tplN(oneKey, manyKey, n, vars) {
  return tpl(n === 1 ? oneKey : manyKey, Object.assign({ n }, vars || {}));
}

/** U10/R-C: Stats is grouped into labelled sections (vocabulary / review /
 *  activity) instead of one 8+1 grid whose last card wrapped onto a line of its
 *  own. Grouping is presentational: the same nine .stat-card elements are rendered,
 *  so nothing that reads #stats-grid .stat-card changes.
 *  Two rules keep the layout honest:
 *   - a group no longer ends up as a single card alone on its row: the group's
 *     card count is published as data-cards, so CSS sizes the row to its contents
 *     (this is why Sources and Streak now share one "activity" group);
 *   - ONE value convention: .stat-value holds a bare number and any unit (%, /6,
 *     days) is a separate .stat-unit span, so "0", "0%", "0 days" and "1.3/6" stop
 *     being four different spellings of the same thing. "—" stays reserved for a
 *     metric that genuinely cannot be computed yet — always paired with a note
 *     saying why. */
function renderStats() {
  const grid = $('#stats-grid');
  if (!grid) return;
  const items = state.items;
  const now = Date.now();
  const cnt = (fn) => items.filter(fn).length;
  const words = cnt((i) => i.type === 'word');
  const phrases = cnt((i) => i.type === 'phrase');
  const sentences = cnt((i) => i.type === 'sentence');
  const known = cnt((i) => i.userData.status === 'known');
  const learning = cnt((i) => i.userData.status === 'learning');
  const neu = cnt((i) => i.userData.status === 'new');
  const due = cnt((i) => i.due <= now && i.userData.status !== 'known');
  const reviews = items.reduce((s, i) => s + (i.reviewCount || 0), 0);
  const reviewed = cnt((i) => i.reviewCount > 0);
  const retention = reviewed ? Math.round((100 * known) / reviewed) : null;
  const avgBox = items.length ? items.reduce((s, i) => s + (i.box || 1), 0) / items.length : 0;
  const streak = practiceDayStreak();
  const sources = [...new Set(items.map((i) => i.context && i.context.sourceTitle).filter((s) => s && s !== 'pasted' && s !== 'your example'))];
  const c = $('#stats-count');
  if (c) c.textContent = items.length ? tplN('stats.trackedOne', 'stats.tracked', items.length) : '';
  const NONE = i18n('stats.none');
  const card = (label, value, unit, note) =>
    '<div class="stat-card"><span class="stat-metric">' +
      '<span class="stat-value">' + value + '</span>' +
      (unit ? '<span class="stat-unit">' + escapeHtml(unit) + '</span>' : '') +
    '</span>' +
    '<span class="stat-label">' + escapeHtml(label) + '</span>' +
    (note ? '<span class="stat-note">' + escapeHtml(note) + '</span>' : '') + '</div>';
  const group = (labelKey, cards) =>
    '<section class="stat-group" data-cards="' + cards.length + '"><h3 class="stat-group-title">' + escapeHtml(i18n(labelKey)) + '</h3>' +
    '<div class="stat-cards">' + cards.join('') + '</div></section>';
  grid.innerHTML = [
    group('stats.gVocab', [
      card(i18n('stats.itemsSaved'), items.length, '', [
        tplN('stats.wordsOne', 'stats.words', words),
        tplN('stats.phrasesOne', 'stats.phrases', phrases),
        tplN('stats.sentencesOne', 'stats.sentences', sentences),
      ].join(' · ')),
      card(i18n('stats.wordsLearned'), known, '', i18n('stats.noteKnown')),
      card(i18n('stats.inProgress'), learning + neu, '', tpl('stats.noteProgress', { l: learning, n: neu })),
    ]),
    group('stats.gVocab2', [
      // v117 A2 (plan D9): the reading-coverage baseline shown next to the
      // saved-vocab numbers — milestone + vault-known, two different things.
      card(i18n('known.statsLabel'), state.known ? state.known.words.size : 0, '',
        state.known && state.known.highest
          ? tpl('known.statsNote', { n: KNOWN_LEVELS_META[state.known.highest].n, m: state.items.filter((i) => i.userData.status === 'known').length })
          : i18n('known.statsNone')),
    ]),
    group('stats.gReview', [
      card(i18n('stats.dueNow'), due, '', i18n('stats.noteDue')),
      card(i18n('stats.reviewsDone'), reviews, '', tplN('stats.noteReviewedOne', 'stats.noteReviewed', reviewed)),
      card(i18n('stats.retention'), retention == null ? NONE : retention, retention == null ? '' : '%',
        retention == null ? i18n('stats.noteRetentionNone') : i18n('stats.noteRetention')),
      card(i18n('stats.avgMastery'), avgBox ? avgBox.toFixed(1) : NONE, avgBox ? '/6' : '',
        avgBox ? i18n('stats.noteMastery') : i18n('stats.noteMasteryNone')),
    ]),
    // R-C: Sources and Streak were two one-card groups — each card sat alone on a
    // row of its own with the rest of the panel empty. They are both "how much
    // have I actually done" numbers, so they now share one paired group.
    group('stats.gActivity', [
      card(i18n('stats.sourcesRead'), sources.length, '', sources.slice(0, 3).join(', ') || i18n('stats.noteSourcesNone')),
      card(i18n('stats.practiceStreak'), streak, i18n(streak === 1 ? 'stats.streakUnitOne' : 'stats.streakUnit'), i18n('stats.noteStreak')),
    ]),
  ].join('');
}

/* ================= Pronunciation (Phase 6 / P2) ================= */
/* TTS with a 0.75x slow mode + sentence replay, and IPA shown when the loaded
 * dictionary entry provides it (US/UK split only when the data has it). No
 * speech recognition / scoring (out of scope). */
let ttsRate = parseFloat(localStorage.getItem('tts-rate')) || 0.9;

function speakAt(text, rate) {
  if (!text) return;
  if (!TTS_SUPPORTED) { showToast('Text-to-speech is not supported by this browser'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate || ttsRate;
  speechSynthesis.speak(u);
}

function toggleTtsRate() {
  ttsRate = Math.abs(ttsRate - 0.75) < 0.01 ? 0.9 : 0.75;
  localStorage.setItem('tts-rate', String(ttsRate));
  const slow = $('#btn-pron-slow');
  if (slow) { slow.classList.toggle('active', ttsRate === 0.75); slow.setAttribute('aria-pressed', String(ttsRate === 0.75)); }
  showToast(ttsRate === 0.75 ? 'Slow playback (0.75×)' : 'Normal playback');
}

/** IPA-like tokens (/…/ or […] containing IPA characters) found in an entry. */
function extractIpa(text) {
  const t = String(text || '').replace(/<[^>]+>/g, ' ');
  const out = [];
  const re = /[\/\[]([^\/\]]{2,40})[\/\]]/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const s = m[1].trim();
    if (/[ˈˌəɪʊɛæɑɔʌθðʃʒŋɜɒɹ]/.test(s) && out.indexOf(s) === -1) out.push(s);
    if (out.length >= 2) break;
  }
  return out;
}

/** Wrap the syllable after a primary/secondary stress mark (stress marking). */
function markStress(ipa) {
  return String(ipa).replace(/([ˈˌ])([^ˈˌ]+)/g, '<span class="ipa-stress">$1$2</span>');
}

const pronIpaCache = new Map();
// v66: bundled IPA table (open data — thichhoc-en-vi CC BY-SA 4.0 + CMUdict
// public domain, see NOTICE.md). Lazy-loaded once on first use like the PDF
// engine: the SW runtime branch caches it, deliberately NOT precached (size).
let ipaMapPromise = null;
function loadIpaMap() {
  if (!ipaMapPromise) {
    ipaMapPromise = fetch('./data/ipa-en.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return ipaMapPromise;
}
async function ipaForWord(word) {
  const key = (word || '').toLowerCase().trim();
  if (!key) return [];
  if (pronIpaCache.has(key)) return pronIpaCache.get(key);
  let found = [];
  // v91: bundled table FIRST. It carries clean CMUdict-derived IPA for 149,600
  // headwords; the entry-text extraction (now the fallback) also matches legacy
  // notations like WordNet's diacritic "ə-mā'zĭng", which rendered as mojibake
  // on real devices when they won the strip (field report 2026-09-30). The
  // entry path remains the only source for BYO dictionaries the table misses.
  const map = await loadIpaMap();
  if (map) {
    const cands = [key];
    for (const c of lemmaCandidates(key)) {
      const lc = String(c).toLowerCase().trim();
      if (lc && cands.indexOf(lc) === -1) cands.push(lc);
    }
    for (const k of cands) {
      const v = map[k];
      if (!v) continue;
      found = Array.isArray(v) ? v.slice(0, 2) : [v];
      break;
    }
  }
  if (!found.length) {
    for (const slot of Object.keys(SLOTS)) {
      const d = state.dicts[slot];
      if (!d) continue;
      try {
        const hits = await d.mdx.lookup(word);
        if (!hits.length) continue;
        found = extractIpa(hits.map((h) => h.text).join(' '));
        if (found.length) break;
      } catch (e) { /* next slot */ }
    }
  }
  // US/UK variants are often identical — showing the same IPA twice is noise.
  found = [...new Set(found)].slice(0, 2);
  pronIpaCache.set(key, found);
  return found;
}

function updatePronStrip(word) {
  const strip = $('#pron-strip');
  if (!strip) return;
  const key = (word || '').trim();
  if (!key) { strip.classList.add('hidden'); return; }
  strip.classList.remove('hidden');
  strip.dataset.word = key;
  const w = $('#pron-word');
  if (w) w.textContent = key;
  const band = $('#pron-freq');
  if (band) {
    freqBand(key).then((b) => {
      if (strip.dataset.word !== key) return;
      if (!b) { band.classList.add('hidden'); return; }
      band.classList.remove('hidden');
      band.textContent = 'Top ' + b + ' freq';
      band.title = 'Among the most frequent ' + b + ' English words (OpenSubtitles open data)';
    });
  }
  const ipaEl = $('#pron-ipa');
  if (ipaEl) {
    ipaEl.textContent = '';
    ipaForWord(key).then((list) => {
      if (strip.dataset.word !== key) return;
      if (!list.length) { ipaEl.classList.add('hidden'); return; }
      ipaEl.classList.remove('hidden');
      list.forEach((ipa, i) => {
        const span = document.createElement('span');
        span.className = 'ipa';
        span.innerHTML = '/' + markStress(escapeHtml(ipa)) + '/';
        if (i) span.style.marginLeft = ''; // spacing is the stylesheet's job (.pron-ipa gap)
        ipaEl.appendChild(span);
      });
    });
  }
  const slow = $('#btn-pron-slow');
  if (slow) { slow.classList.toggle('active', ttsRate === 0.75); slow.setAttribute('aria-pressed', String(ttsRate === 0.75)); }
  const rep = $('#btn-pron-replay');
  if (rep) {
    const ctx = contextForWord(key);
    rep.classList.toggle('hidden', !(ctx && ctx.sentence));
    rep.dataset.sentence = (ctx && ctx.sentence) ? ctx.sentence : '';
  }
}

/* ---------------- Context layer (Phase 3+, P1) ---------------- */
/* Show the user's own sentence for the word being looked up — with the headword
 * highlighted — above the entry, plus "Add example". Context display only: no
 * sense disambiguation (BYO-key AI paraphrase stays P2). readerCtx is the active
 * reader tap; saved items are the durable copy. */

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Text-node-only fragment with every occurrence of `headword` wrapped in <mark>
 *  (never innerHTML — the sentence may come from pasted/untrusted text). */
function highlightHeadword(sentence, headword) {
  const frag = document.createDocumentFragment();
  const text = String(sentence || '');
  const hw = String(headword || '').trim();
  if (!hw) { frag.appendChild(document.createTextNode(text)); return frag; }
  const re = new RegExp('(^|[^\\p{L}\\p{N}\'-])(' + escapeRegExp(hw).replace(/\\ /g, '\\s+') + ')(?=[^\\p{L}\\p{N}\'-]|$)', 'giu');
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1].length;
    if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));
    const mark = document.createElement('mark');
    mark.textContent = m[2];
    frag.appendChild(mark);
    last = start + m[2].length;
    if (re.lastIndex <= m.index) re.lastIndex = m.index + 1;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

/** All saved examples for `word` (deduped) — lets one word carry examples for
 *  several senses. Phase 5-F. */
function examplesForWord(word) {
  const norm = normalizeText(word);
  if (!norm) return [];
  const out = [];
  if (readerCtx && readerCtx.sentence && normalizeText(readerCtx.headword) === norm) {
    out.push({ sentence: readerCtx.sentence, sourceTitle: readerCtx.sourceTitle || '' });
  }
  for (const i of state.items) {
    if (i.type === 'sentence' && i.context && i.context.headword && normalizeText(i.context.headword) === norm && i.text) {
      out.push({ sentence: i.text, sourceTitle: i.context.sourceTitle || '' });
    } else if ((i.type === 'word' || i.type === 'phrase') && i.normalizedText === norm && i.context && i.context.sentence) {
      out.push({ sentence: i.context.sentence, sourceTitle: i.context.sourceTitle || '' });
    }
  }
  const seen = new Set(); const uniq = [];
  for (const e of out) { const k = (e.sentence || '').trim(); if (k && !seen.has(k)) { seen.add(k); uniq.push(e); } }
  return uniq;
}

/** Context to show for `word`: the active reader tap when it matches, else a
 *  saved item that carries a sentence for this word. */
function contextForWord(word) {
  const norm = normalizeText(word);
  if (!norm) return null;
  if (readerCtx && readerCtx.sentence && normalizeText(readerCtx.headword) === norm) return readerCtx;
  const wordItem = state.items.find((i) => (i.type === 'word' || i.type === 'phrase') &&
    i.normalizedText === norm && i.context && i.context.sentence);
  if (wordItem) {
    return { headword: wordItem.text, sentence: wordItem.context.sentence,
      sourceTitle: wordItem.context.sourceTitle || '', sourceUrl: wordItem.context.sourceUrl || '' };
  }
  const sentItem = state.items.find((i) => i.type === 'sentence' && i.context &&
    i.context.headword && normalizeText(i.context.headword) === norm && i.text);
  if (sentItem) {
    return { headword: sentItem.context.headword, sentence: sentItem.text,
      sourceTitle: sentItem.context.sourceTitle || '', sourceUrl: sentItem.context.sourceUrl || '' };
  }
  return null;
}

/** Render/refresh the context bar above the entry panels. */
function updateContextBar(word) {
  const bar = $('#context-bar');
  if (!bar) return;
  const list = examplesForWord(word);
  if (!list.length) { bar.classList.add('hidden'); return; }
  const ctx = contextForWord(word) || list[0];
  const hw = ctx.headword || word;
  const sentEl = $('#context-sentence');
  if (sentEl) { sentEl.textContent = ''; sentEl.appendChild(highlightHeadword(ctx.sentence, hw)); }
  const srcEl = $('#context-source');
  if (srcEl) {
    const s = ctx.sourceTitle && ctx.sourceTitle !== 'pasted' ? 'Source: ' + ctx.sourceTitle : '';
    srcEl.textContent = s;
    srcEl.classList.toggle('hidden', !s);
  }
  // extra examples (other senses) below the primary one
  const moreEl = $('#context-more');
  if (moreEl) {
    moreEl.innerHTML = '';
    const extras = list.filter((e) => (e.sentence || '').trim() !== (ctx.sentence || '').trim()).slice(0, 3);
    if (extras.length) {
      moreEl.classList.remove('hidden');
      for (const e of extras) {
        const p = document.createElement('p');
        p.className = 'context-extra';
        p.textContent = '＋ ' + e.sentence + (e.sourceTitle && e.sourceTitle !== 'pasted' ? '  (' + e.sourceTitle + ')' : '');
        moreEl.appendChild(p);
      }
    } else moreEl.classList.add('hidden');
  }
  bar.dataset.word = word || hw || '';
  bar.classList.remove('hidden');
}

function openExampleDialog(word) {
  const w = (word || '').trim();
  if (!w) return;
  $('#example-word').textContent = w;
  $('#example-text').value = '';
  $('#example-dialog').showModal();
  setTimeout(() => $('#example-text').focus(), 30);
}

async function saveExample() {
  const word = $('#example-word').textContent.trim();
  const sentence = $('#example-text').value.trim();
  if (!sentence) { showToast('Type an example sentence first'); return; }
  let r;
  try {
    r = await addItem({
      type: 'sentence',
      text: sentence,
      context: { sentence, headword: word, sourceTitle: 'your example' },
      box: 1,
      due: Date.now(),
    });
  } catch (e) {
    console.warn('could not save example:', e);
    showToast('Could not save the example — storage error');
    return;
  }
  if (!r.merged) { state.items = state.items.filter((i) => i.id !== r.item.id); state.items.unshift(r.item); }
  $('#example-dialog').close();
  showToast(r.merged ? 'That example is already saved' : 'Example added');
  updateContextBar(($('#search-input')?.value || '').trim());
  updateReviewBadge();
  if (!$('#vault-view')?.classList.contains('hidden')) renderVault();
}

/* ---------------- learning items (Phase 3 Release A) ---------------- */
/* Saved words + sentences are LearningItems in IndexedDB (js/store.js).
 * state.items is the in-memory mirror; every write goes through the store
 * first, then updates the mirror. UI markup is unchanged (Release A is
 * invisible). */

function vocabItems() {
  return state.items.filter((i) => i.type === 'word');
}

/** The saved word item matching the given text (dup key = normalizedText). */
function findVocab(word) {
  const norm = normalizeText(word);
  if (!norm) return null;
  return state.items.find((i) => i.type === 'word' && i.normalizedText === norm) || null;
}

function isSaved(word) {
  return !!findVocab(word);
}

let pendingSenseCandidates = [];

function dictionaryEntryPlainText(raw) {
  const source = String(raw || '').replace(/\u0000/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|dd|dt|tr|h[1-6])\s*>/gi, '\n');
  const html = formatEntry(source)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|dd|dt|tr|h[1-6])\s*>/gi, '\n');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.textContent || '').replace(/[\t ]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}

function senseStableKey(candidate, definition) {
  const source = `${candidate.slot}\n${candidate.sourceFile}\n${candidate.keyText}\n${normalizeText(definition)}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `${candidate.slot}:${(hash >>> 0).toString(16)}`;
}

async function openSenseSaveDialog(word) {
  const key = String(word || '').trim();
  if (!key) return;
  const dialog = $('#sense-save-dialog');
  const select = $('#sense-save-entry');
  const definition = $('#sense-save-definition');
  const status = $('#sense-save-status');
  if (!dialog || !select || !definition) return;
  status.textContent = 'Loading the entries currently available on this device…';
  select.replaceChildren();
  definition.value = '';
  const sourceSentence = contextForWord(key);
  $('#sense-save-context').value = sourceSentence?.sentence || '';
  dialog.showModal();

  let candidates = latestLookupEntries.generation === lookupGen &&
      normalizeText(latestLookupEntries.word) === normalizeText(key)
    ? Object.values(latestLookupEntries.bySlot).flat()
    : [];
  if (!candidates.length) {
    for (const slot of Object.keys(SLOTS)) {
      const dict = state.dicts[slot];
      if (!dict) continue;
      try {
        const hits = await dict.mdx.lookup(key);
        candidates.push(...hits.map((hit) => ({ slot, source: dictDisplayName(dict.mdx), sourceFile: dict.mdx.name || '', keyText: hit.keyText || key, raw: hit.text })));
      } catch (error) { console.debug('Could not read dictionary candidate', slot, error); }
    }
  }
  pendingSenseCandidates = candidates.filter((item) => dictionaryEntryPlainText(item.raw));
  select.replaceChildren();
  if (pendingSenseCandidates.length) {
    pendingSenseCandidates.forEach((candidate, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${candidate.source}${candidate.keyText && candidate.keyText !== key ? ` · ${candidate.keyText}` : ''}`;
      select.appendChild(option);
    });
    const currentView = localStorage.getItem('view') || rememberedView();
    const preferred = pendingSenseCandidates.findIndex((candidate) => candidate.slot === currentView);
    select.value = String(preferred >= 0 ? preferred : 0);
    renderSenseSaveCandidate();
    status.textContent = 'The full entry is prefilled. Keep or edit the text so this card represents the meaning you want to learn.';
  } else {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No dictionary entry is loaded for this word';
    select.appendChild(option);
    status.textContent = 'You can still save the word and source sentence. Load a dictionary to save a specific meaning.';
  }
}

function renderSenseSaveCandidate() {
  const candidate = pendingSenseCandidates[Number($('#sense-save-entry')?.value)];
  $('#sense-save-definition').value = candidate ? dictionaryEntryPlainText(candidate.raw) : '';
}

async function saveSelectedSense() {
  const key = ($('#search-input')?.value || '').trim();
  const definition = ($('#sense-save-definition')?.value || '').trim();
  const candidate = pendingSenseCandidates[Number($('#sense-save-entry')?.value)];
  if (!key) return;
  if (pendingSenseCandidates.length && !definition) {
    $('#sense-save-status').textContent = 'Add the meaning you want to remember, or cancel and load a dictionary.';
    return;
  }
  const senseKey = candidate && definition ? senseStableKey(candidate, definition) : '';
  const ctx = contextForWord(key);
  const dictionary = candidate && definition ? {
    slot: candidate.slot,
    source: candidate.source,
    sourceFile: candidate.sourceFile,
    entryKey: candidate.keyText,
    definition,
    senseKey,
  } : {};
  const sentence = ($('#sense-save-context')?.value || '').trim();
  try {
    const result = await addItem({
      type: /\s/.test(key) ? 'phrase' : 'word',
      text: key,
      dictionary,
      box: 1,
      due: Date.now(),
      status: 'new',
      context: sentence ? {
        headword: ctx?.headword || key,
        sentence,
        sourceTitle: ctx?.sourceTitle || 'Reading context',
        sourceUrl: ctx?.sourceUrl || '',
      } : undefined,
    });
    if (!result.merged) state.items.unshift(result.item);
    $('#sense-save-dialog')?.close();
    showToast(result.merged ? `This meaning of “${key}” is already in your Vault.` : `Saved this meaning of “${key}” to your Vault.`);
    updateContextBar(key);
    updateSaveButtonState();
    updateVocabBadge();
    if (!$('#vault-view')?.classList.contains('hidden')) renderVault();
  } catch (error) {
    console.warn('could not save selected meaning:', error);
    $('#sense-save-status').textContent = 'Could not save — device storage error.';
  }
}

/** Reflect whether the current search-box word is already saved on the ☆/★ button. */
function updateSaveButtonState() {
  const btn = $('#btn-save-word');
  if (!btn) return;
  const word = $('#search-input').value.trim();
  const saved = word && isSaved(word);
  btn.textContent = saved ? '★' : '☆';
  btn.classList.toggle('is-saved', !!saved);
  const label = saved ? 'Add or review a saved meaning' : 'Choose a meaning and save this word';
  btn.title = saved ? 'Add another meaning or source sentence' : 'Choose meaning to save';
  btn.setAttribute('aria-label', label);
}

/** Update the due badges on the Vault nav links (desktop + bottom nav). */
function updateVocabBadge() {
  const now = Date.now();
  const due = vocabItems().filter((v) => v.due <= now).length;
  for (const badge of document.querySelectorAll('.vocab-due')) {
    badge.textContent = due > 99 ? '99+' : String(due);
    badge.classList.toggle('hidden', due === 0);
  }
}

/** Review badge: every item (word/phrase/sentence) due, except known ones. */
function updateReviewBadge() {
  const now = Date.now();
  const due = state.items.filter((i) => i.due <= now && i.userData.status !== 'known').length;
  for (const badge of document.querySelectorAll('.review-due')) {
    badge.textContent = due > 99 ? '99+' : String(due);
    badge.classList.toggle('hidden', due === 0);
  }
  // v67 R2: the OS app badge mirrors the in-app review badge (feature-detected)
  syncAppBadge(due);
}

function getItemById(id) {
  return state.items.find((i) => i.id === id) || null;
}

/** Grade a saved item — FSRS scheduler since v68 (was Leitner since v34).
 *  Shared by the Review view, Practice and the saved-words dialog. The app's
 *  two buttons map to FSRS ratings: know→3 (Good), forgot→1 (Again). Every
 *  grade appends one record to the `reviews` log (Phase 6 R3) — the log is the
 *  future optimizer's training data and is not backfillable. A log failure is
 *  warned and never blocks the grade itself. */
async function gradeById(id, action) {
  const v = getItemById(id);
  if (!v) return;
  const rating = action === 'know' ? 3 : action === 'forgot' ? 1 : 0;
  if (!rating) return; // skip is not a grade — nothing to schedule or log
  const now = Date.now();
  const elapsedDays = v.lastReviewedAt ? (now - v.lastReviewedAt) / 86400000 : 0;
  let sBefore = v.fsrs ? v.fsrs.s : null;
  let dBefore = v.fsrs ? v.fsrs.d : null;
  if (!v.fsrs) {
    // first FSRS contact: a brand-new item initializes from the rating itself,
    // an item graded under Leitner warms up from the box it earned — its `due`
    // is left untouched so nobody's schedule resets to day one.
    if (!v.reviewCount) {
      v.fsrs = { s: fsrsInitStability(rating), d: fsrsInitDifficulty(rating) };
    } else {
      v.fsrs = warmInitFsrs(v);
      // Preserve the warmed starting state so optimizer replay sees the same input.
      sBefore = v.fsrs.s;
      dBefore = v.fsrs.d;
    }
  }
  const longTerm = !v.lastReviewedAt || elapsedDays >= 1;
  if (longTerm) {
    // across a day: run the forgetting curve and grow/decay stability
    const r = fsrsRetrievability(v.fsrs.s, elapsedDays);
    v.fsrs.s = rating === 1 ? fsrsForgetStability(v.fsrs.d, v.fsrs.s, r) : fsrsRecallStability(v.fsrs.d, v.fsrs.s, r);
  } else {
    // same-day re-review (the 10-minute forgot drill window): short-term growth
    v.fsrs.s = fsrsShortTermStability(v.fsrs.s, rating);
  }
  v.fsrs.d = fsrsNextDifficulty(v.fsrs.d, rating);
  if (rating === 1) {
    v.due = now + 10 * 60000; // due again in 10 minutes, not instantly re-shown
    v.box = 1;
  } else {
    // request retention 0.9 → the FSRS-4.5 interval is ≈ stability in days
    const interval = Math.max(Math.round(v.fsrs.s), 1);
    v.due = now + interval * 86400000;
    // keep the Leitner box in sync for Stats/export/display consumers
    let b = 1;
    for (let i = 0; i < SRS_INTERVALS_DAYS.length; i++) if (interval >= SRS_INTERVALS_DAYS[i]) b = i + 1;
    v.box = Math.min(b, SRS_INTERVALS_DAYS.length);
  }
  v.lastReviewedAt = now;
  v.reviewCount = (v.reviewCount || 0) + 1;
  if (rating === 3) v.userData.status = 'learning'; // preserved Leitner-era behaviour
  try { await putItem(v); } catch (e) {
    console.warn('could not persist grade:', e);
    return;
  }
  try {
    await putReview({ id: v.id + ':' + now, itemId: v.id, at: now, rating,
      elapsedDays, longTerm,
      sBefore, dBefore, sAfter: v.fsrs.s, dAfter: v.fsrs.d });
  } catch (e) {
    console.warn('could not append review log:', e);
  }
  updateVocabBadge();
  updateReviewBadge();
  updateSaveButtonState();
}

/* ---------------- Vault (Phase 3 Release B) ---------------- */
/* Tab state + selection are session-only (never persisted — the Vault shows
 * whatever the user last chose per visit; items themselves live in IDB). */
let vaultTab = 'all';
let vaultDeck = '';
let vaultQuery = '';
const vaultSelected = new Set();
let reviewQueueIds = null; // null = derive from due items when entering Review
let reviewTotal = 0;
let editorItemId = null;

function wireVault() {
  $('#vault-search')?.addEventListener('input', (e) => {
    vaultQuery = e.target.value.trim();
    renderVault();
  });
  $('#vault-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    vaultTab = btn.dataset.tab;
    document.querySelectorAll('#vault-tabs button').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    renderVault();
  });
  // v75 journal wiring
  $('#btn-journal-save')?.addEventListener('click', saveJournalEntry);
  $('#btn-journal-timer')?.addEventListener('click', journalTimerToggle);
  $('#journal-input')?.addEventListener('input', updateJournalCount);
  $('#journal-input')?.addEventListener('input', persistJournalDraft);
  restoreJournalDraft();
  journalTimerPaint();
  // v76 cue card wiring
  $('#btn-cue-next')?.addEventListener('click', cueCardNext);
  $('#btn-cue-start')?.addEventListener('click', cueCardToggle);
  $('#btn-cue-mic')?.addEventListener('click', cueCardRecord);
  cueCardNext();
  initOfflineStudy();
  $('#btn-vault-select-all')?.addEventListener('click', () => {
    const list = vaultFiltered();
  $('#vault-view')?.classList.toggle('vault-is-empty', state.items.length === 0);
    const allSelected = list.length && list.every((i) => vaultSelected.has(i.id));
    if (allSelected) list.forEach((i) => vaultSelected.delete(i.id));
    else list.forEach((i) => vaultSelected.add(i.id));
    renderVault();
  });
  $('#btn-vault-review')?.addEventListener('click', () => {
    if (!vaultSelected.size) return;
    reviewQueueIds = [...vaultSelected];
    vaultSelected.clear();
    navigate('review');
  });
  $('#btn-vault-tag')?.addEventListener('click', batchAddTag);
  $('#btn-vault-known')?.addEventListener('click', batchMarkKnown);
  $('#btn-vault-export')?.addEventListener('click', () => {
    const items = [...vaultSelected].map(getItemById).filter(Boolean);
    openExportDialog(items.length ? items : vaultFiltered());
  });
  $('#btn-vault-delete')?.addEventListener('click', batchDelete);
  $('#vault-list')?.addEventListener('click', onVaultListClick);
  $('#item-editor-save')?.addEventListener('click', saveItemEditor);
  $('#item-editor-delete')?.addEventListener('click', deleteFromEditor);
  $('#item-editor-export')?.addEventListener('click', exportFromEditor);
}

function vaultFiltered() {
  let list = state.items.slice();
  if (vaultTab === 'word' || vaultTab === 'phrase' || vaultTab === 'sentence') {
    list = list.filter((i) => i.type === vaultTab);
  } else if (vaultTab === 'due') {
    const now = Date.now();
    list = list.filter((i) => i.due <= now && i.userData.status !== 'known');
  }
  if (vaultDeck) list = list.filter((i) => (i.deck || '') === vaultDeck);
  if (vaultQuery) {
    const q = normalizeText(vaultQuery);
    const raw = vaultQuery.toLowerCase();
    list = list.filter((i) =>
      i.normalizedText.includes(q) ||
      (i.context?.sentence || '').toLowerCase().includes(raw) ||
      (i.userData.note || '').toLowerCase().includes(raw) ||
      (i.userData.tags || []).some((t) => t.toLowerCase().includes(raw))
    );
  }
  list = sortVaultList(list);
  return list;
}

function truncateText(s, n) {
  return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;
}

function renderDeckOptions() {
  const decks = [...new Set(state.items.map((i) => i.deck).filter(Boolean))].sort();
  const sel = $('#vault-deck');
  if (sel) {
    const cur = vaultDeck;
    sel.innerHTML = '<option value="">All decks</option>' + decks.map((d) => '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + '</option>').join('');
    sel.value = decks.indexOf(cur) !== -1 ? cur : '';
    if (decks.indexOf(cur) === -1) vaultDeck = '';
  }
  const dl = $('#deck-options');
  if (dl) dl.innerHTML = decks.map((d) => '<option value="' + escapeHtml(d) + '">').join('');
}

/* ---- v75: Writing journal — editor + word count + Task 2 countdown + save
 * into the Vault. Entries are plain items (type 'sentence', tag 'journal',
 * status 'known') so Vault search/notes/decks and the export/import round trip
 * cover them for free, while 'known' keeps them out of the review queue — a
 * journal is not a flashcard. ---- */
const JOURNAL_FULL = 40 * 60;
let journalTimer = { remain: JOURNAL_FULL, deadline: 0, running: false, interval: null };

function fmtJournalClock(s) {
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* v78: deadline-based countdown — throttled background tabs fire setInterval
 * late, which used to make the 40:00 clock fall behind the wall clock. */
function journalTimerTick() {
  journalTimer.remain = Math.max(0, Math.round((journalTimer.deadline - Date.now()) / 1000));
  if (journalTimer.remain <= 0 && journalTimer.running) {
    journalTimer.running = false;
    if (journalTimer.interval) { clearInterval(journalTimer.interval); journalTimer.interval = null; }
  }
  journalTimerPaint();
  if (!journalTimer.running) persistJournalDraft();
}

function journalTimerPaint() {
  const el = $('#journal-timer');
  const btn = $('#btn-journal-timer');
  if (journalTimer.remain <= 0) {
    if (el) el.textContent = i18n('journal.timeUp');
    if (btn) btn.textContent = '↺';
    return;
  }
  if (el) el.textContent = '⏱ Task 2 — ' + fmtJournalClock(journalTimer.remain);
  if (btn) btn.textContent = journalTimer.running ? '⏸' : '▶';
}

function journalTimerToggle() {
  if (journalTimer.remain <= 0) { // ↺ reset
    journalTimer = { remain: JOURNAL_FULL, deadline: 0, running: false, interval: null };
    journalTimerPaint();
    persistJournalDraft();
    return;
  }
  if (journalTimer.running) { // pause — remember what is left
    journalTimer.running = false;
    if (journalTimer.interval) { clearInterval(journalTimer.interval); journalTimer.interval = null; }
  } else { // start / resume
    journalTimer.deadline = Date.now() + journalTimer.remain * 1000;
    journalTimer.running = true;
    if (!journalTimer.interval) journalTimer.interval = setInterval(journalTimerTick, 500);
  }
  journalTimerPaint();
  persistJournalDraft();
}

function persistJournalDraft() {
  const payload={text:$('#journal-input')?.value||'',remain:journalTimer.remain,deadline:journalTimer.deadline,running:journalTimer.running,updatedAt:Date.now()};
  try { localStorage.setItem('dd-journal-draft',JSON.stringify(payload)); } catch(e) { /* editor remains usable when storage is full */ }
}
function restoreJournalDraft() {
  try {
    const d=JSON.parse(localStorage.getItem('dd-journal-draft')||'null'); if(!d)return;
    if($('#journal-input'))$('#journal-input').value=String(d.text||'');
    if(Number.isFinite(d.remain))journalTimer.remain=Math.max(0,Math.min(JOURNAL_FULL,d.remain));
    if(d.running&&Number.isFinite(d.deadline)){journalTimer.deadline=d.deadline;journalTimer.running=true;journalTimer.interval=setInterval(journalTimerTick,500);journalTimerTick();}
    updateJournalCount(); journalTimerPaint();
  } catch(e) { localStorage.removeItem('dd-journal-draft'); }
}

function updateJournalCount() {
  const el = $('#journal-count');
  const text = $('#journal-input')?.value.trim() || '';
  if (el) {
    const n = text ? text.split(/\s+/).length : 0;
    el.textContent = i18nFmt('journal.words', { n: String(n) }) + (text && n < 250 ? '' : '');
    el.classList.toggle('journal-ok', n >= 250);
  }
}

async function saveJournalEntry() {
  const text = $('#journal-input')?.value.trim();
  const msg = $('#journal-msg');
  if (!text) { if (msg) msg.textContent = i18n('journal.empty'); return; }
  const res = await addItem({ type: 'sentence', text, tags: ['journal'], status: 'known', due: 8640000000000000 });
  if (!res.merged && res.item) state.items.push(res.item);
  if ($('#journal-input')) $('#journal-input').value = '';
  localStorage.removeItem('dd-journal-draft');
  persistJournalDraft();
  updateJournalCount();
  renderJournal();
  if (msg) msg.textContent = i18n(res.merged ? 'journal.dupe' : 'journal.saved');
}

function renderJournal() {
  const list = $('#journal-list');
  if (!list) return;
  const entries = state.items
    .filter((i) => i.type === 'sentence' && (i.userData?.tags || []).includes('journal'))
    .sort((a, b) => b.createdAt - a.createdAt);
  list.innerHTML = '';
  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = i18n('journal.noEntries');
    list.appendChild(p);
    return;
  }
  for (const it of entries) {
    const row = document.createElement('div');
    row.className = 'journal-entry';
    const meta = document.createElement('div');
    meta.className = 'hint journal-meta';
    meta.textContent = new Date(it.createdAt).toLocaleString() + ' · ' +
      i18nFmt('journal.words', { n: String(it.text.split(/\s+/).length) });
    const body = document.createElement('p');
    body.className = 'journal-text';
    body.textContent = it.text;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-secondary journal-del';
    del.textContent = '🗑';
    del.title = i18n('journal.delete');
    del.setAttribute('aria-label', i18n('journal.delete'));
    del.addEventListener('click', async () => {
      await deleteItem(it.id);
      state.items = state.items.filter((i) => i.id !== it.id);
      renderJournal();
      renderVault();
    });
    row.append(meta, body, del);
    list.appendChild(row);
  }
}

function setJournalVisible(on) {
  const panel = $('#journal-panel');
  if (!panel) return;
  panel.classList.toggle('hidden', !on);
  for (const sel of ['#vault-list', '#vault-select-bar', '#vault-search', '#vault-empty', '#vault-no-results']) {
    $(sel)?.classList.toggle('hidden', on);
  }
  if (on) renderJournal();
}

function renderVault() {
  // v75: the Journal tab replaces the item list with the writing editor
  setJournalVisible(vaultTab === 'journal');
  if (vaultTab === 'journal') return;
  renderDeckOptions();
  const wrap = $('#vault-list');
  if (!wrap) return;
  const empty = $('#vault-empty');
  const noResults = $('#vault-no-results');
  const count = $('#vault-count');
  const list = vaultFiltered();
  $('#vault-view')?.classList.toggle('vault-is-empty', state.items.length === 0);
  if (count) {
    count.textContent = state.items.length
      ? `${state.items.length} item${state.items.length === 1 ? '' : 's'} · ${list.length} shown`
      : '';
  }
  wrap.innerHTML = '';
  if (!state.items.length) {
    empty?.classList.remove('hidden');
    noResults?.classList.add('hidden');
    updateSelectBar();
    renderKnownEmpty();
    return;
  }
  empty?.classList.add('hidden');
  if (!list.length) {
    noResults?.classList.remove('hidden');
    updateSelectBar();
    return;
  }
  noResults?.classList.add('hidden');
  for (const item of list) wrap.appendChild(buildVaultCard(item));
  updateSelectBar();
}

function buildVaultCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card' + (vaultSelected.has(item.id) ? ' is-selected' : '');
  card.dataset.id = item.id;
  // The checkbox stays 18px (its drawn size) but rides inside a 44×44 label, so
  // the TAP TARGET is 44×44 without a giant checkmark: padding the input itself
  // just scales the glyph (Chrome draws the control at the border box).
  const cbWrap = document.createElement('label');
  cbWrap.className = 'item-select-hit';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'item-select';
  cb.checked = vaultSelected.has(item.id);
  cb.setAttribute('aria-label', 'Select ' + item.text);
  cbWrap.appendChild(cb);
  card.appendChild(cbWrap);

  const main = document.createElement('div');
  main.className = 'item-main';
  const t = document.createElement('button');
  t.type = 'button';
  t.className = 'item-text';
  t.title = 'Look this up';
  t.textContent = item.text;
  main.appendChild(t);
  const gloss = document.createElement('p');
  gloss.className = 'item-gloss';
  gloss.textContent = '…';
  main.appendChild(gloss);
  Promise.resolve(savedMeaning(item)).then((g) => {
    if (g) gloss.textContent = g;
    else { gloss.textContent = 'Meaning not saved for this card. Open the word and save a specific meaning.'; gloss.classList.add('hint'); }
  });
  if (item.dictionary?.source) {
    const source = document.createElement('span');
    source.className = 'item-meta';
    source.textContent = `Meaning source: ${item.dictionary.source}${item.dictionary.entryKey ? ` · ${item.dictionary.entryKey}` : ''}`;
    main.appendChild(source);
  }
  if (item.context?.sentence) {
    const c = document.createElement('p');
    c.className = 'item-context';
    c.textContent = item.context.sentence;
    main.appendChild(c);
  }
  const meta = document.createElement('span');
  meta.className = 'item-meta';
  const tagHtml = (item.userData.tags || [])
    .map((x) => `<span class="item-tag">${escapeHtml(x)}</span>`).join('');
  meta.innerHTML = `${escapeHtml(item.type)} · ${escapeHtml(item.userData.status)} · ` +
    `${new Date(item.createdAt).toLocaleDateString('en-US')}${item.userData.note ? ' · 📝 note' : ''}` +
    (tagHtml ? ' · ' + tagHtml : '');
  main.appendChild(meta);
  card.appendChild(main);

  const acts = document.createElement('div');
  acts.className = 'item-actions';
  const audio = document.createElement('button');
  audio.type = 'button';
  audio.className = 'icon-btn';
  audio.dataset.act = 'audio';
  audio.textContent = '🔊';
  audio.title = 'Listen';
  audio.setAttribute('aria-label', 'Listen to ' + item.text);
  acts.appendChild(audio);
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'icon-btn';
  menu.dataset.act = 'menu';
  menu.textContent = '•••';
  menu.title = 'Edit note, tags, status, delete, export';
  menu.setAttribute('aria-label', 'Item actions for ' + item.text);
  acts.appendChild(menu);
  card.appendChild(acts);
  return card;
}

async function onVaultListClick(e) {
  const card = e.target.closest('.item-card');
  if (!card) return;
  const id = card.dataset.id;
  const checkbox = e.target.closest('.item-select');
  if (checkbox) {
    if (checkbox.checked) vaultSelected.add(id);
    else vaultSelected.delete(id);
    card.classList.toggle('is-selected', checkbox.checked);
    updateSelectBar();
    return;
  }
  const actBtn = e.target.closest('button[data-act]');
  if (actBtn) {
    const item = getItemById(id);
    if (!item) return;
    if (actBtn.dataset.act === 'audio') speak(item.text, actBtn);
    else if (actBtn.dataset.act === 'menu') openItemEditor(item);
    return;
  }
  const textBtn = e.target.closest('.item-text');
  if (textBtn) {
    const item = getItemById(id);
    if (!item) return;
    $('#search-input').value = item.text;
    navigate('search');
    search(item.text);
  }
}

function updateSelectBar() {
  const n = vaultSelected.size;
  const countEl = $('#vault-selected-count');
  if (countEl) countEl.textContent = `${n} selected`;
  for (const act of ['review', 'tag', 'known', 'export', 'delete']) {
    const btn = $('#btn-vault-' + act);
    if (btn) btn.disabled = n === 0;
  }
  const selectAll = $('#btn-vault-select-all');
  if (selectAll) {
    const shown = vaultFiltered();
    selectAll.textContent = shown.length && shown.every((i) => vaultSelected.has(i.id)) ? 'Deselect all' : 'Select all';
  }
}

async function batchAddTag() {
  const items = [...vaultSelected].map(getItemById).filter(Boolean);
  if (!items.length) return;
  const tag = (prompt(`Tag to add to ${items.length} item${items.length === 1 ? '' : 's'}:`, 'review-later') || '').trim().toLowerCase();
  if (!tag) return;
  for (const item of items) {
    if (!item.userData.tags.includes(tag)) item.userData.tags.push(tag);
  }
  try {
    await Promise.all(items.map((i) => putItem(i)));
  } catch (e) {
    showToast('Could not save tags — storage error');
    return;
  }
  showToast(`Tagged ${items.length} item${items.length === 1 ? '' : 's'} with “${tag}”`);
  renderVault();
}

async function batchMarkKnown() {
  const items = [...vaultSelected].map(getItemById).filter(Boolean);
  if (!items.length) return;
  if (!confirm(`Mark ${items.length} item${items.length === 1 ? '' : 's'} as known? They leave the review queue.`)) return;
  for (const item of items) {
    item.userData.status = 'known';
    item.lastReviewedAt = Date.now();
  }
  try {
    await Promise.all(items.map((i) => putItem(i)));
  } catch (e) {
    showToast('Could not save — storage error');
    return;
  }
  showToast(`Marked ${items.length} item${items.length === 1 ? '' : 's'} as known`);
  updateReviewBadge();
  renderVault();
}

async function batchDelete() {
  const items = [...vaultSelected].map(getItemById).filter(Boolean);
  if (!items.length) return;
  if (!confirm(`Delete ${items.length} item${items.length === 1 ? '' : 's'}? This cannot be undone with one click — but you can undo via the toast for the last action.`)) return;
  try {
    await Promise.all(items.map((i) => deleteItem(i.id)));
  } catch (e) {
    showToast('Could not delete — storage error');
    return;
  }
  const ids = new Set(items.map((i) => i.id));
  state.items = state.items.filter((i) => !ids.has(i.id));
  vaultSelected.clear();
  updateVocabBadge();
  updateReviewBadge();
  showToast(`Deleted ${items.length} item${items.length === 1 ? '' : 's'}`);
  renderVault();
}

/* ---- item editor dialog (the Vault ••• menu) ---- */
function openItemEditor(item) {
  editorItemId = item.id;
  $('#item-editor-text').textContent = item.text;
  $('#item-note').value = item.userData.note || '';
  $('#item-tags').value = (item.userData.tags || []).join(', ');
  $('#item-status').value = item.userData.status || 'new';
  if ($('#item-deck')) $('#item-deck').value = item.deck || '';
  renderDeckOptions();
  $('#item-editor').showModal();
}

async function saveItemEditor() {
  const item = getItemById(editorItemId);
  if (!item) return;
  item.userData.note = $('#item-note').value.trim();
  item.userData.tags = $('#item-tags').value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const status = $('#item-status').value;
  if (['new', 'learning', 'known'].includes(status)) item.userData.status = status;
  if ($('#item-deck')) item.deck = $('#item-deck').value.trim();
  try {
    await putItem(item);
  } catch (e) {
    showToast('Could not save — storage error');
    return;
  }
  $('#item-editor').close();
  updateReviewBadge();
  showToast('Saved changes');
  renderVault();
}

async function deleteFromEditor() {
  const item = getItemById(editorItemId);
  if (!item) return;
  try {
    await deleteItem(item.id);
  } catch (e) {
    showToast('Could not delete — storage error');
    return;
  }
  state.items = state.items.filter((i) => i.id !== item.id);
  vaultSelected.delete(item.id);
  $('#item-editor').close();
  updateVocabBadge();
  updateReviewBadge();
  showToast(`Deleted “${truncateText(item.text, 30)}”`, async () => {
    try {
      const r = await addItem({
        type: item.type,
        text: item.text,
        context: item.context,
        dictionary: item.dictionary,
        note: item.userData.note,
        tags: item.userData.tags,
        status: item.userData.status,
        createdAt: item.createdAt,
        box: item.box,
        due: item.due,
      });
      if (!r.merged) {
        state.items.unshift(r.item);
        renderVault();
      }
    } catch (e) { /* ignore */ }
  });
  renderVault();
}

function exportFromEditor() {
  const item = getItemById(editorItemId);
  if (item) openExportDialog([item]);
}

/* ---------------- Review (Phase 3 Release B) ---------------- */
/** Items currently due: due <= now and not known. */
function dueItems() {
  const now = Date.now();
  return state.items.filter((i) => i.due <= now && i.userData.status !== 'known');
}

function renderReview() {
  const list = $('#review-list');
  if (!list) return;
  const count = $('#review-count');
  const empty = $('#review-empty');
  // A direct #/review route renders before IndexedDB finishes booting.
  if (!state.itemsReady) {
    if (count) count.textContent = '…';
    list.innerHTML = '';
    empty?.classList.add('hidden');
    return;
  }
  if (reviewQueueIds === null) { reviewQueueIds = dueItems().map((i) => i.id); reviewTotal = reviewQueueIds.length; }
  const queue = reviewQueueIds.map(getItemById).filter(Boolean);
  if (count) {
    const done = Math.max(0, reviewTotal - queue.length);
    count.textContent = reviewTotal ? `${done}/${reviewTotal} done · ${queue.length} left` : '';
  }
  list.innerHTML = '';
  if (!queue.length) {
    const msg = $('#review-empty-msg');
    if (msg) msg.textContent = i18n('review.emptyTitle');
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  for (const item of queue) list.appendChild(buildReviewCard(item));
}

function buildReviewCard(item) {
  const card = document.createElement('div');
  card.className = 'review-card';
  card.dataset.id = item.id;

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
  const t = document.createElement('button');
  t.type = 'button';
  t.className = 'item-text';
  t.textContent = item.text;
  t.title = 'Type: ' + item.type;
  head.appendChild(t);
  const audio = document.createElement('button');
  audio.type = 'button';
  audio.className = 'icon-btn';
  audio.textContent = '🔊';
  audio.title = 'Listen';
  audio.setAttribute('aria-label', 'Listen to ' + item.text);
  audio.addEventListener('click', () => speak(item.text, audio));
  head.appendChild(audio);
  card.appendChild(head);

  const answer = document.createElement('div');
  answer.className = 'review-answer hidden';
  if (item.context?.sentence) {
    const c = document.createElement('p');
    c.className = 'item-context';
    c.textContent = item.context.sentence;
    answer.appendChild(c);
  }
  const glossP = document.createElement('p');
  glossP.className = 'item-gloss';
  const savedGloss = meaningForItem(item);
  glossP.textContent = savedGloss || 'No meaning was saved with this card. Look up the word and save a specific meaning to review it here.';
  if (!savedGloss) glossP.classList.add('hint');
  answer.appendChild(glossP);
  if (item.dictionary?.source) {
    const source = document.createElement('p');
    source.className = 'item-meta';
    source.textContent = `Source: ${item.dictionary.source}${item.dictionary.entryKey ? ` · ${item.dictionary.entryKey}` : ''}`;
    answer.appendChild(source);
  }
  if (item.userData.note) {
    const n = document.createElement('p');
    n.className = 'item-gloss';
    n.textContent = '📝 ' + item.userData.note;
    answer.appendChild(n);
  }
  card.appendChild(answer);

  const show = document.createElement('button');
  show.type = 'button';
  show.className = 'btn-secondary btn-show-answer';
  show.textContent = i18n('review.show');
  show.addEventListener('click', () => {
    answer.classList.remove('hidden');
    show.remove();
  });
  card.appendChild(show);

  const actions = document.createElement('div');
  actions.className = 'review-actions';
  const mk = (label, act, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.dataset.reviewAct = act;
    b.addEventListener('click', () => advanceReview(item.id, act));
    return b;
  };
  actions.appendChild(mk(i18n('review.know'), 'know', 'btn-secondary'));
  actions.appendChild(mk(i18n('review.forgot'), 'forgot', 'btn-secondary'));
  actions.appendChild(mk(i18n('review.skip'), 'skip', 'btn-secondary'));
  card.appendChild(actions);
  return card;
}

async function advanceReview(id, action) {
  if (action !== 'skip') await gradeById(id, action);
  reviewQueueIds = (reviewQueueIds || []).filter((x) => x !== id);
  if (!reviewQueueIds.length) {
    const msg = $('#review-empty-msg');
    if (msg) msg.textContent = 'Session complete — you reviewed everything in this queue 🎉';
    $('#review-empty')?.classList.remove('hidden');
    $('#review-list').innerHTML = '';
    return;
  }
  renderReview();
}

/** Short fallback gloss for legacy cards, vocabulary lists and history
 *  tooltips. Looks up the first loaded dictionary that has a hit; cached. */
const glossCache = new Map();
let glossGeneration = 0;
function invalidateGlossCache() {
  glossGeneration++;
  glossCache.clear();
}
async function quickGloss(word) {
  const key = (word || '').toLowerCase().trim();
  if (!key) return '';
  if (glossCache.has(key)) return glossCache.get(key);
  const gen = glossGeneration;
  let gloss = '';
  for (const slot of Object.keys(SLOTS)) {
    const d = state.dicts[slot];
    if (!d) continue;
    try {
      const hits = await d.mdx.lookup(word);
      if (!hits.length) continue;
      const raw = hits[0].text.replace(/\u0000/g, '');
      let plain;
      if (/<\w/.test(raw)) {
        plain = raw
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (/(^|\s)[@*!]/.test(raw)) {
        // MTD-convention plain text — take the first pos + first meaning
        const blocks = mtdToBlocks(raw).filter((b) => b.type === 'pos' || b.type === 'sense' || b.type === 'idiom');
        plain = blocks.slice(0, 2).map((b) => b.text.replace(/<[^>]+>/g, '')).join(' — ').trim();
      } else {
        plain = raw.replace(/\s+/g, ' ').trim();
      }
      if (plain) {
        gloss = plain.length > 110 ? plain.slice(0, 110).replace(/\s+\S*$/, '') + '…' : plain;
        break;
      }
    } catch (e) { /* try the next slot */ }
  }
  if (gen !== glossGeneration) return quickGloss(word);
  // An absent source is not a permanent negative result.
  if (gloss) glossCache.set(key, gloss);
  return gloss;
}

function savedMeaning(item) {
  return String(item?.dictionary?.definition || item?.dictionary?.translation || '').trim();
}

function meaningForItem(item) { return savedMeaning(item); }

/** Export LearningItems as a JSON file — data ownership: nothing lives only
 *  in the app. v3 payload {items} plus derived v2-compat words/sentences arrays
 *  so older external tooling keeps working. Used by the Vault (all / selected /
 *  single) via exportItems. */
async function exportItems(items) {
  if (!items || !items.length) return;
  const words = items.filter((i) => i.type === 'word')
    .map((i) => ({ word: i.text, box: i.box, due: i.due, addedAt: i.createdAt }))
    .sort((a, b) => a.word.localeCompare(b.word));
  const sentences = items.filter((i) => i.type === 'sentence')
    .map((i) => ({ word: i.context?.headword || '', sentence: i.text, source: i.context?.sourceTitle || '', addedAt: i.createdAt }))
    .sort((a, b) => a.addedAt - b.addedAt);
  const payload = {
    app: 'Dual Dictionary',
    version: 3,
    exportedAt: new Date().toISOString(),
    items: [...items].sort((a, b) => a.createdAt - b.createdAt),
    words,
    sentences,
    // v117 A2 (additive, backward-compatible): the known-words baseline rides
    // along; an old app importing this file ignores the unknown key.
    known: (await knownRecordsForExport()).filter((r) => r && Array.isArray(r.words)),
    tutor: await tutorRecordsForExport(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dual-dictionary-vocab-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function exportCompleteStudyBackup() {
  try {
    const items=await allItems(); const study=await exportOfflineStudy(); const tutor=await tutorRecordsForExport();
    const payload={app:'Dual Dictionary',version:3,completeBackup:true,exportedAt:new Date().toISOString(),items,known:await knownRecordsForExport(),tutor,study};
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));a.download='dual-dictionary-complete-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    showToast(`Complete study backup downloaded (${items.length} Vault items, ${study.length} offline study records)`);
  } catch(e) { showToast('Could not create a complete backup: '+(e.message||'storage error')); }
}

/** Import a previously exported data file (v2 {words,sentences} or v3 {items}).
 *  Merge-only: duplicates are skipped, local data wins. */
async function importDataFile(file) {
  const nm = (file && file.name || '').toLowerCase();
  if (/\.(txt|tsv|csv)$/.test(nm)) { await importDeckFile(file); return; }
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (e) {
    showToast('Import failed — not a valid JSON file');
    return;
  }
  try {
    const res = await importItems(payload);
    const tutorAdded = await importTutorRecords(payload);
    const studyAdded = await importOfflineStudy(payload.study);
    state.items = await allItems();
    try { state.known = await knownState(); } catch (e) { /* keep previous */ }
    updateVocabBadge();
    updateSaveButtonState();
    showToast(`Imported ${res.added} item${res.added === 1 ? '' : 's'} — ${res.skipped} duplicate${res.skipped === 1 ? '' : 's'} skipped` + (res.knownRestored ? ' + ' + res.knownRestored + ' known-word milestone' + (res.knownRestored === 1 ? '' : 's') : '') + (tutorAdded ? ` + ${tutorAdded} tutor session${tutorAdded===1?'':'s'}` : '') + (studyAdded ? ` + ${studyAdded} offline study record${studyAdded===1?'':'s'}` : ''));
  } catch (e) {
    console.warn('import failed:', e);
    showToast('Import failed: ' + (e.message || 'unknown error'));
  }
}

async function tutorRecordsForExport() {
  try { return (await allTutorRecords()).sort((a,b)=>(Number(a.updatedAt)||0)-(Number(b.updatedAt)||0)).slice(-100).map((session)=>({ ...session, apiKey:undefined })); }
  catch { return []; }
}
async function importTutorRecords(payload) {
  const rows=Array.isArray(payload?.tutor)?payload.tutor.slice(0,100):[];
  let added=0;
  for(const row of rows) {
    if(!row || typeof row.id!=='string' || !row.id || row.id.length>200 || !['select','answer','feedback','saved'].includes(row.stage)) continue;
    if(typeof row.article!=='string' || row.article.length>12000) continue;
    if(await getTutorRecord(row.id).catch(()=>null)) continue;
    const phrases=validateTutorPhrases(Array.isArray(row.phrases)?row.phrases:[],row.article).slice(0,3);
    const targetCandidate=row.target&&typeof row.target==='object'?validateTutorPhrases([row.target],row.article)[0]:null;
    const target=targetCandidate&&phrases.some((item)=>item.phrase.toLowerCase()===targetCandidate.phrase.toLowerCase())?targetCandidate:null;
    let feedback=null;
    try { if(row.feedback&&typeof row.feedback==='object') feedback=validateTutorFeedback(row.feedback,String(row.answer||'')); } catch { feedback=null; }
    let stage=row.stage;
    if(['answer','feedback','saved'].includes(stage)&&!target) stage='select';
    if(stage==='feedback'&&!feedback) stage='answer';
    const safe={id:row.id,stage,article:row.article,articleTitle:String(row.articleTitle||'').slice(0,300),createdAt:Number(row.createdAt)||Date.now(),updatedAt:Number(row.updatedAt)||Date.now(),consentedAt:Number(row.consentedAt)||0,provider:String(row.provider||'').slice(0,40),model:String(row.model||'').slice(0,120),phrases,target,prompt:String(row.prompt||'').slice(0,1200),answer:String(row.answer||'').slice(0,1200),feedback,feedbackDecision:['accepted','rejected'].includes(row.feedbackDecision)?row.feedbackDecision:null,resultSource:['live','cache'].includes(row.resultSource)?row.resultSource:null,confirmedErrors:Array.isArray(row.confirmedErrors)?row.confirmedErrors.slice(0,40):[],savedItemId:String(row.savedItemId||'')};
    await putTutorRecord(safe); added++;
  }
  if(added && !localStorage.getItem('dd-tutor-current')) {
    const sessions=await allTutorRecords(); const latest=sessions.filter((row)=>row.stage!=='saved').sort((a,b)=>b.updatedAt-a.updatedAt)[0];
    if(latest) localStorage.setItem('dd-tutor-current',latest.id);
  }
  return added;
}
async function clearTutorData() {
  if(!confirm('Delete tutor sessions, drafts, and cached suggestions from this browser? Vault cards and AI keys will remain.')) return;
  cancelTutorRequest();
  try {
    await clearTutorRecords(); clearTutorCache(); localStorage.removeItem('dd-tutor-current'); tutorSession=null; $('#tutor-stage')?.replaceChildren();
    let backupFailures=0;
    for(const key of await listBackups()) {
      try { const blob=await getFile(key); if(!blob) continue; const payload=JSON.parse(await blob.text()); if(!Array.isArray(payload.tutor)) continue; delete payload.tutor; await putFile(key,new Blob([JSON.stringify(payload)],{type:'application/json'})); } catch { backupFailures++; }
    }
    $('#ai-settings-status').textContent=backupFailures?`Tutor sessions, drafts, and cache deleted; ${backupFailures} unreadable local backup(s) could not be scrubbed.`:'Tutor sessions, drafts, cache, and local-backup copies deleted.';
  } catch { $('#ai-settings-status').textContent='Could not delete all tutor data. Please retry.'; }
}

function clearHistory() {
  state.history = [];
  localStorage.setItem('history', '[]');
  renderHistory();
}

/** One-click EN–VI: download the open OVDP dictionary into Slot 2 via the
 *  normal quick-load pipeline. Asks first when the slot holds user data. */
async function loadEnViDictionary() {
  const slot = 'third'; // keep WordNet + Wiktionary intact; EN–VI lives in slot 3
  try {
    const existing = await getFile(slot + '-mdx');
    const isFallback = existing && (BUNDLED_NAMES.includes(existing.name) || existing.name === 'simple-en.mdx');
    if (existing && !isFallback && !confirm('Slot 3 already holds “' + existing.name + '”. Replace it with the EN–VI dictionary (' + ENVI_DICT.label + ')?')) return;
  } catch (e) { /* storage read failed — proceed, quickLoadOne will handle */ }
  if ($('#empty-state')) $('#empty-state').classList.remove('hidden');
  loadAbort = new AbortController();
  try {
    await quickLoadOne(slot, ENVI_DICT, loadAbort.signal);
    if (state.dicts[slot]) setView('third');
  } finally {
    loadAbort = null;
    progressTrackers.clear();
    $('#btn-cancel-load')?.classList.add('hidden');
  }
}

/* ---------------- storage health ---------------- */
function showStorageBanner(text) {
  const banner = $('#storage-banner');
  const label = $('#storage-banner-text');
  if (!banner || !label) return;
  label.textContent = text;
  banner.classList.remove('hidden');
}

/** Warn if the browser's storage is nearly full (data could be evicted, e.g. private/incognito mode). */
async function checkStorageHealth() {
  if (sessionStorage.getItem('storage-banner-dismissed')) return;
  if (!navigator.storage || !navigator.storage.estimate) return;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota) return;
    const pct = usage / quota;
    if (pct > 0.85) {
      showStorageBanner(
        `Browser storage is nearly full (${Math.round(pct * 100)}%) — loaded dictionaries may be ` +
        `evicted by the system at any time. Avoid private/incognito mode and free up device storage if possible.`
      );
    }
  } catch (e) { /* estimate() not available/reliable on this browser — skip silently */ }
  // Ask the browser to keep this site's storage from being evicted under pressure, when supported.
  if (navigator.storage.persist && navigator.storage.persisted) {
    try {
      if (!(await navigator.storage.persisted())) await navigator.storage.persist();
    } catch (e) { /* not critical */ }
  }
}

/* ================= UX pack (v47) ================= */
/* theme (manual; 'auto' = system via prefers-color-scheme) */
function setTheme(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  const btn = $('#btn-theme');
  if (btn) btn.textContent = mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '🌓';
}
function cycleTheme() {
  const cur = localStorage.getItem('theme') || 'auto';
  const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
  setTheme(next);
  showToast(next === 'auto' ? 'Theme: system' : 'Theme: ' + next);
}

/* i18n — EN/VI for the main chrome (nav, headings). Dictionary-entry content
 * comes from the dictionary itself and stays as-shipped. */
const I18N = {
  en: {
    'nav.search': 'Search', 'nav.reader': 'Reader', 'nav.vault': 'Vault', 'nav.review': 'Review', 'nav.practice': 'Practice', 'nav.stats': 'Stats',
    'section.vault': 'Vault', 'section.review': 'Review', 'section.practice': 'Practice', 'section.stats': 'Stats',
    'top.lang': 'Language (EN / VI)', 'top.theme': 'Theme: auto / light / dark',
    'top.home': 'Dual Dictionary — go to search', 'top.homeAria': 'Dual Dictionary — go to search',
    'top.install': 'Install app', 'top.installAria': 'Install app',
    'top.langAria': 'Navigation language: English or Vietnamese',
    'top.themeAria': 'Theme: system, light or dark',
    // top.advanced / top.help were referenced by data-i18n-title in the header but
    // never defined, so both tooltips literally read "top.advanced" / "top.help".
    'top.advanced': 'Advanced', 'top.help': 'Help',
    'top.advancedAria': 'Advanced settings — load your own .mdx files',
    'top.helpAria': 'Help — how to use this app',
    'top.moreAria': 'More options: advanced settings, help', 'top.more': 'More options',
    'top.tipInstall': 'Install', 'top.tipLang': 'EN / VI', 'top.tipTheme': 'Theme',
    'top.tipAdvanced': 'Advanced', 'top.tipHelp': 'Help', 'top.tipMore': 'More',
    'top.advancedShort': '⚙ Advanced', 'top.helpShort': '? Help',
    'search.placeholder': 'Type an English word…',
    'search.gateIdle': 'No dictionary loaded yet — download one below to start looking up words.',
    'search.gateLoading': 'Downloading dictionaries… lookup turns on as soon as the first one is ready.',
    'search.gateStarting': 'Checking for a dictionary stored on this device…',
    'search.didYouMean': 'Did you mean…?',
    'practice.pickDeck': 'Practice — pick a deck:',
    'practice.deck.ngsl1': 'NGSL 1k', 'practice.deck.ngsl2': 'NGSL 2k', 'practice.deck.ngsl3': 'NGSL 3k',
    'practice.deck.ielts': '🎯 IELTS Core', 'practice.deck.toeic': '💼 TOEIC Business',
    'practice.deck.offngsl': 'Off-NGSL (by frequency)', 'practice.deck.awl': 'AWL', 'practice.deck.reading': '📖 From your reading', 'practice.deck.vault': 'My Vault',
    'practice.ipa': 'IPA match',
    'practice.saveCta': '⭐ Save to Vault for later review',
    'practice.savedToast': 'Saved to Vault', 'practice.saveFail': 'Could not save — storage error',
    'practice.deckLoading': 'preparing questions…',
    'practice.deckEmpty': 'This deck has no words in the current build.',
    'practice.deckUnavailable': 'Word list not available yet — try again once the app finishes loading.',
    'reader.back': '← Back to search', 'reader.backTitle': 'Back to search — the Reader keeps its text',
    'reader.save': '⭐ Save sentence', 'reader.start': '📖 Start reading', 'reader.load': 'Load URL',
    'reader.paste': 'Paste an English article here…', 'reader.url': '…or a page URL (CORS-friendly sources work, e.g. wikipedia.org)',
    'reader.yt.btn': '🎬 YouTube transcript', 'reader.yt.title': 'Read a YouTube video as text',
    'reader.yt.hint': 'On the video page, open the description → Show transcript, select all, copy, and paste it below. The video itself never plays in the app — you read the words and tap any word to look it up. A direct link fetch is impossible without a server (CORS), so this is one paste.',
    'reader.yt.linkPh': 'https://youtube.com/watch?v=… (optional — kept as the source label)',
    'reader.yt.pastePh': 'Paste the transcript here (0:07⏎text… — SRT / VTT / plain text also work)',
    'reader.yt.read': '📖 Read transcript',
    'reader.timer': '⏱ {time} · {words} words · {wpm} wpm',
    'vault.tab.journal': '✍ Journal',
    'journal.ph': 'Write in English — a diary entry, a summary of something you read, an IELTS Task 2 essay…',
    'journal.save': '💾 Save to Vault',
    'journal.words': '{n} words',
    'journal.empty': 'Write something first — even two sentences count.',
    'journal.saved': 'Saved to your Vault.',
    'journal.dupe': 'This exact text is already in your Vault.',
    'journal.noEntries': 'No entries yet — your saved writing will appear here.',
    'journal.delete': 'Delete this entry',
    'journal.timeUp': "⏱ Task 2 time is up — click ↺ to reset.",
    'practice.cueNext': 'Next →', 'practice.cueStart': 'Start', 'practice.cueStop': 'Stop',
    'practice.cueReady': "I'm ready — speak now", 'practice.cueTimeUp': "⏱ Time — read the transcript above: does it sound like what you meant?",
    'practice.cuePrep': '{t} to prepare', 'practice.cueSpeak': '⏱ {t} — speak!',
    'practice.cueRecord': '🎤 Record', 'practice.cueHeard': 'Heard: “{heard}” — {n} words. Read it back: does it match what you meant?',
    'reader.listen.btn': '🎧 Listening', 'reader.listen.title': 'Listen & read along',
    'reader.listen.hint': 'Pick an audio file from this device and paste its transcript (YouTube copy, SRT/VTT or plain text). The audio plays locally — nothing is uploaded, and the session lasts until you close the page.',
    'reader.listen.start': '🎧 Start listening',
    'reader.srcLabel': 'From your reading', 'reader.srcSource': 'Source:',
    'history.recent': 'Recent:', 'history.viewAll': 'View all', 'history.clear': 'Clear', 'history.head': 'Search history',
    'history.clearAll': 'Clear all', 'history.empty': 'No recent searches yet — look up a word to start.',
    'firstload.download': '⬇ Download dictionaries', 'firstload.own': 'Use my own .mdx files',
    'firstload.envi': '🇻🇳 Add English–Vietnamese dictionary', 'firstload.help': 'Help',
    // These three were referenced by updateEmptyStateCopy() but never defined, so
    // i18n() fell through to the raw key ("firstload.idle") in the card.
    'firstload.idle': 'No dictionary is loaded yet — download the dictionaries to start looking up words.',
    'firstload.loading': 'Loading the default dictionaries…',
    // ITEM A: "Downloading" is the verb of the live card line — paintFirstLoadFigures()
    // appends the dictionary name, "…" and the figures from fmtProgress. The figures
    // keep the formatter's units (MB/%/min left) exactly as the panel status line
    // shows them, in both languages, so the two can never disagree.
    'firstload.downloading': 'Downloading',
    'firstload.done': 'Dictionaries ready — search is live.',
    'firstload.unreachable': 'No dictionary data is reachable from this deployment.',
    // v64: the DYNAMIC gate copy (assembled in code) now goes through i18n too.
    'firstload.retry': '↻ Retry dictionary download',
    'firstload.ctaSize': '⬇ Download dictionaries (≈ {size})',
    'firstload.sizeUnknown': 'size unknown (usually a few GB)',
    'firstload.cancelled': 'Download cancelled — no dictionary is loaded yet.',
    'firstload.cancelHint': 'Press “↻ Retry dictionary download” to try again, or use your own .mdx files via ⚙ Advanced.',
    'firstload.failed': 'Failed to load: {names}. Check your connection and try again, or open ⚙ Advanced to load your own .mdx files.',
    'firstload.unreachableHint': 'The bundled download sources did not respond. Press “↻ Retry dictionary download” to try again, or use “Use my own .mdx files” below to load a dictionary manually.',
    'firstload.checking': 'Checking dictionary sizes…',
    'firstload.note': 'One-time download, stored in the app, fully offline afterwards.',
    'vault.tab.all': 'All', 'vault.tab.word': 'Words', 'vault.tab.phrase': 'Phrases', 'vault.tab.sentence': 'Sentences', 'vault.tab.due': 'Needs review',
    'vault.selectAll': 'Select all', 'vault.reviewNow': 'Review now', 'vault.addTag': 'Add tag', 'vault.markKnown': 'Mark as known',
    'vault.export': 'Export', 'vault.delete': 'Delete', 'vault.search': 'Search your vault — text, notes, tags…',
    'vault.emptyTitle': 'Your Vault is empty', 'vault.emptyHint': 'Save a word or phrase while reading — your examples and notes will appear here.',
    'vault.openReader': '📖 Open Reader', 'vault.searchWord': '🔍 Search a word',
    'vault.noneTitle': 'No items match', 'vault.noneHint': 'Try a different search, or clear the filters. Tip: use the sort menu or a tag to narrow things down.',
    'review.practice': '🎯 Practice', 'review.openVault': 'Open Vault',
    'review.emptyTitle': 'Nothing due for review', 'review.emptyHint': "Words and phrases you save from Search or Reader appear here when they're due. Come back later, or practice from the Vault.",
    'review.show': 'Show answer', 'review.know': 'Know it', 'review.forgot': 'Forgot', 'review.skip': 'Skip',
    'practice.emptyTitle': 'Nothing to practice yet', 'practice.openVault': 'Open Vault',
    'practice.emptyHint': 'Save a few words, phrases or sentences first, then come back — Practice builds quick fill-the-gap and listen-and-type drills from your Vault.',
    'practice.cloze': 'Fill in the missing word', 'practice.dictation': 'Listen and type the sentence', 'practice.listen': 'Type what you hear', 'practice.choice': 'Choose the meaning',
    'practice.check': 'Check', 'practice.got': 'Got it', 'practice.again': 'Review again', 'practice.hear': '🔊 Hear',
    'practice.hint': '💡 Hint', 'practice.recall': 'type the word',
    'practice.done': 'Session complete 🎉', 'practice.again2': 'Practice again',
    'known.title': 'I already know the most common words',
    'known.hint': 'Pick a starting milestone so "words you know" is counted correctly from day one. Nothing is added to your Vault — this is only a reading-coverage baseline, offline on this device.',
    'known.cta': 'I know the top {n} words',
    'known.status': 'Milestone set: top {n} — {count} words marked known. Change it in ⚙ Advanced (reset there first to pick a lower one).',
    'known.advTitle': 'Known words — reading-coverage baseline',
    'known.advNone': 'No milestone set yet — the Vault empty state offers one when your Vault is still empty.',
    'known.advSet': 'Milestone: {level} — {count} words marked known.',
    'known.reset': 'Reset known words',
    'known.resetConfirm': 'Clear the known-words baseline? Coverage estimates will count these words as unknown again (your saved items are not touched).',
    'known.resetDone': 'Known-words baseline cleared',
    'known.setLevel': 'Known-words milestone set: top {n} words',
    'known.statsLabel': 'Known vocabulary',
    'known.statsNote': 'top-{n} milestone + {m} marked known in the Vault',
    'known.statsNone': 'no milestone set',
    'stats.gVocab2': 'Reading coverage',
    'cov.knownOf': '{known} of {total} words in estimated coverage',
    'cov.noEstimate': 'Not enough information to estimate how suitable this reading is yet. Choose the closest starting vocabulary level; this stays on your device.',
    'cov.chooseBaseline': 'My starting point is closest to:',
    'cov.noEstimateStatus': 'Choose a starting vocabulary level to estimate reading coverage, or tap any word to look it up.',
    'cov.highlight': '🎨 Highlight',
    'cov.hlTitle': 'Highlight known / learning / new words in the text',
    'cov.easy': 'Easy read', 'cov.mid': 'Challenging (i+1)', 'cov.hard': 'Hard text',
    'cov.hardWarn': 'Hard text — under 60% within estimated coverage. A shorter or easier article may fit better.',
    'cov.newHead': 'New words:',
    'cov.estimateNote': 'Estimate against the top-10k most common English words (offline, on this device). Proper nouns and numbers are left out of the count.',
    'cov.statusDone': '{pct}% within estimated coverage · {words} words — tap any word to look it up below.',
    'cov.noMilestone': 'No starting milestone set yet — pick one in the Vault so "known" is counted correctly.',
    'known.current': 'current',
    'apkg.building': 'Building Anki deck…',
    'apkg.done': 'Anki deck exported — {n} note(s). Import it with File → Import in Anki.',
    'apkg.nothing': 'Nothing to export',
    'apkg.failed': 'Could not build the Anki deck — try again (the first export needs a moment to load the writer).',
    'cov.band1k': 'top 1k', 'cov.band2k': 'top 2k', 'cov.band5k': 'top 5k', 'cov.band10k': 'top 10k', 'hero.ctaOffline': '📚 Start offline lessons — no key', 'hero.hint': 'Paste a short paragraph in the Reader below, press Start reading, then choose AI practice \u2014 or start a free offline lesson (no key needed).', 'tutor.start': '✨ AI practice (online · own key)', 'tutor.title': 'Reading to speaking practice', 'tutor.hint': 'AI suggestions are checked against your reading. Review feedback before saving it to your study history.', 'hero.offline': 'Start a free offline lesson (no key)', 'village.title': 'Learn workplace English where the network drops.', 'village.body': 'Prepare packs where you have a connection; then read, practise and review fully offline — no key, no account, no tracking.', 'village.lessons': 'Offline lessons (33 packs · ~340 KB)', 'village.ielts': 'IELTS/TOEIC offline lab', 'village.offlineBadge': 'OFFLINE · no key', 'village.labNote': 'Offline path: Listening/Reading with fixed answer keys work in airplane mode. Optional AI feedback below needs internet + your own key.', 'reader.offlinePacks': 'Offline lesson packs', 'reader.loopHint': 'Read → phrase → new situation → Vault — or start an offline pack, no key.', 'reader.freeLesson': 'Start a free offline lesson', 'reader.savedArticles': '📁 Saved articles', 'reader.tools': 'Reading tools', 'reader.saveOffline': '💾 Save offline', 'sense.title': 'Save this meaning', 'sense.entry': 'Dictionary entry', 'sense.meaning': 'Meaning to remember', 'sense.context': 'Source sentence (optional)', 'sense.save': 'Save meaning', 'sense.cancel': 'Cancel', 'search.search': 'Search', 'ui.skip': 'Skip to search', 'ui.clear': 'Clear', 'ui.listenTts': 'Listen (text-to-speech)', 'ui.listenPron': 'Listen to pronunciation', 'ui.saveWord': 'Save word', 'ui.saveWordAria': 'Save word to your vocabulary list', 'ui.dismissShort': 'Dismiss', 'ui.dismiss': 'Dismiss this suggestion', 'ui.moreWays': 'More ways to read: file, URL, transcript or audio', 'ui.tsTitle': 'Connect your AI account', 'ui.tsHint': 'This is optional. Offline study stays free. Your key stays in this browser and is sent only to the provider you choose after you approve each request. The provider may charge for tokens.', 'ui.tsProvider': 'Provider', 'ui.tsOther': 'Other compatible service', 'ui.tsKey': 'Provider API key', 'ui.tsAdv': 'Advanced: model and endpoint', 'ui.tsEndpoint': 'API endpoint', 'ui.tsModel': 'Model', 'ui.tsSave': 'Save and continue', 'ui.btnCancel': 'Cancel', 'ui.btnClose': 'Close', 'ui.chooseDict': 'Choose dictionary', 'ui.hearWord': 'Hear the word', 'ui.slowPlayback': 'Slow playback (0.75\u00d7)', 'ui.replaySentence': 'Replay the saved sentence', 'ui.savedCtx': 'Saved context for this word', 'ui.inSavedCtx': 'In your saved context', 'ui.addExample': '\u2795 Add example', 'ui.openInVault': 'Open in Vault', 'ui.cancelDownload': 'Cancel download', 'ui.fullscreen': 'Full-screen reading view', 'ui.fsOxford': 'Full-screen reading view for WordNet', 'ui.fsLongman': 'Full-screen reading view for Wiktionary', 'ui.fsThird': 'Full-screen reading view for slot 3', 'ui.slot3name': 'Slot 3 (optional \u2014 your own .mdx)', 'ui.closeEditor': 'Close editor', 'ui.ppTitle': 'Passphrase', 'ui.ppGo': 'Continue', 'ui.snapTitle': 'Saved articles', 'ui.snapHint': 'Articles you saved for offline reading. Tap one to load it into the Reader \u2014 no network needed.',
  },
  vi: {
    'nav.search': 'Tra từ', 'nav.reader': 'Đọc', 'nav.vault': 'Sổ tay', 'nav.review': 'Ôn tập', 'nav.practice': 'Luyện tập', 'nav.stats': 'Thống kê',
    'section.vault': 'Sổ tay', 'section.review': 'Ôn tập', 'section.practice': 'Luyện tập', 'section.stats': 'Thống kê',
    'top.lang': 'Ngôn ngữ (EN / VI)', 'top.theme': 'Giao diện: auto / sáng / tối',
    'top.home': 'Dual Dictionary — về trang tra từ', 'top.homeAria': 'Dual Dictionary — về trang tra từ',
    'top.install': 'Cài ứng dụng', 'top.installAria': 'Cài ứng dụng',
    'top.langAria': 'Ngôn ngữ điều hướng: tiếng Anh hoặc tiếng Việt',
    'top.themeAria': 'Giao diện: theo hệ thống, sáng hoặc tối',
    'top.advanced': 'Nâng cao', 'top.help': 'Trợ giúp',
    'top.advancedAria': 'Cài đặt nâng cao — nạp file .mdx của bạn',
    'top.helpAria': 'Trợ giúp — cách dùng ứng dụng',
    'top.moreAria': 'Thêm tuỳ chọn: nâng cao, trợ giúp', 'top.more': 'Thêm tuỳ chọn',
    'top.tipInstall': 'Cài đặt', 'top.tipLang': 'EN / VI', 'top.tipTheme': 'Giao diện',
    'top.tipAdvanced': 'Nâng cao', 'top.tipHelp': 'Trợ giúp', 'top.tipMore': 'Thêm',
    'top.advancedShort': '⚙ Nâng cao', 'top.helpShort': '? Trợ giúp',
    'search.placeholder': 'Gõ một từ tiếng Anh…',
    'search.gateIdle': 'Chưa có từ điển — tải ở dưới để bắt đầu tra từ.',
    'search.gateLoading': 'Đang tải từ điển… tra từ sẽ bật ngay khi từ điển đầu tiên sẵn sàng.',
    'search.gateStarting': 'Đang kiểm tra từ điển đã lưu trên máy…',
    'search.didYouMean': 'Có phải bạn muốn tìm…?',
    'practice.pickDeck': 'Luyện tập — chọn một bộ từ:',
    'practice.deck.ngsl1': 'NGSL 1k', 'practice.deck.ngsl2': 'NGSL 2k', 'practice.deck.ngsl3': 'NGSL 3k',
    'practice.deck.ielts': '🎯 IELTS Core', 'practice.deck.toeic': '💼 TOEIC Business',
    'practice.deck.offngsl': 'Ngoài NGSL (theo tần suất)', 'practice.deck.awl': 'AWL', 'practice.deck.reading': '📖 Từ bài đã đọc', 'practice.deck.vault': 'Vault của tôi',
    'practice.ipa': 'Phiên âm IPA',
    'practice.saveCta': '⭐ Lưu vào Vault để ôn sau',
    'practice.savedToast': 'Đã lưu vào Vault', 'practice.saveFail': 'Không lưu được — lỗi storage',
    'practice.deckLoading': 'đang chuẩn bị câu hỏi…',
    'practice.deckEmpty': 'Bộ từ này chưa có từ nào trong bản build hiện tại.',
    'practice.deckUnavailable': 'Danh sách từ chưa sẵn sàng — thử lại khi app tải xong.',
    'reader.back': '← Về tra từ', 'reader.backTitle': 'Về trang tra từ — bài đọc vẫn giữ nguyên',
    'reader.save': '⭐ Lưu câu', 'reader.start': '📖 Bắt đầu đọc', 'reader.load': 'Tải URL',
    'reader.paste': 'Dán một bài tiếng Anh vào đây…', 'reader.url': '…hoặc URL trang (nguồn hỗ trợ CORS, ví dụ wikipedia.org)',
    'reader.yt.btn': '🎬 Phụ đề YouTube', 'reader.yt.title': 'Đọc video YouTube dưới dạng chữ',
    'reader.yt.hint': 'Trang video: mở phần mô tả → Hiện bảng transcript, chọn tất cả, sao chép rồi dán vào dưới. Video không chạy trong app — bạn đọc chữ và bấm vào từ bất kỳ để tra. Tự lấy caption từ link là bất khả thi nếu không có server (CORS), nên chỉ cần một lần dán.',
    'reader.yt.linkPh': 'https://youtube.com/watch?v=… (tùy chọn — dùng làm nhãn nguồn)',
    'reader.yt.pastePh': 'Dán transcript vào đây (0:07⏎chữ… — SRT / VTT / văn bản thường đều được)',
    'reader.yt.read': '📖 Đọc transcript',
    'reader.timer': '⏱ {time} · {words} từ · {wpm} từ/phút',
    'vault.tab.journal': '✍ Viết',
    'journal.ph': 'Viết tiếng Anh — nhật ký, tóm tắt bài đã đọc, bài viết IELTS Task 2…',
    'journal.save': '💾 Lưu vào Sổ tay',
    'journal.words': '{n} từ',
    'journal.empty': 'Viết gì đó đã — hai câu cũng tính.',
    'journal.saved': 'Đã lưu vào Sổ tay.',
    'journal.dupe': 'Đoạn này đã có trong Sổ tay rồi.',
    'journal.noEntries': 'Chưa có bài nào — bài viết đã lưu sẽ hiện ở đây.',
    'journal.delete': 'Xoá bài này',
    'journal.timeUp': '⏱ Hết giờ Task 2 — bấm ↺ để đặt lại.',
    'practice.cueNext': 'Tiếp →', 'practice.cueStart': 'Bắt đầu', 'practice.cueStop': 'Dừng',
    'practice.cueReady': 'Tôi sẵn sàng — nói ngay', 'practice.cueTimeUp': '⏱ Hết giờ — đọc lại transcript phía trên: có đúng ý bạn muốn nói không?',
    'practice.cuePrep': '{t} để chuẩn bị', 'practice.cueSpeak': '⏱ {t} — nói đi!',
    'practice.cueRecord': '🎤 Ghi âm', 'practice.cueHeard': 'Nghe được: “{heard}” — {n} từ. Đọc lại xem có đúng ý bạn không?',
    'reader.listen.btn': '🎧 Nghe', 'reader.listen.title': 'Vừa nghe vừa đọc theo',
    'reader.listen.hint': 'Chọn một file âm thanh trên máy và dán transcript của nó (bản copy YouTube, SRT/VTT hoặc văn bản thường). Audio phát tại chỗ — không tải lên đâu, phiên nghe kéo dài đến khi đóng trang.',
    'reader.listen.start': '🎧 Bắt đầu nghe',
    'reader.srcLabel': 'Từ câu bạn đang đọc', 'reader.srcSource': 'Nguồn:',
    'history.recent': 'Gần đây:', 'history.viewAll': 'Xem tất cả', 'history.clear': 'Xóa', 'history.head': 'Lịch sử tra từ',
    'history.clearAll': 'Xóa hết', 'history.empty': 'Chưa có lịch sử — tra một từ để bắt đầu.',
    'firstload.download': '⬇ Tải từ điển', 'firstload.own': 'Dùng file .mdx của tôi',
    'firstload.envi': '🇻🇳 Thêm từ điển Anh–Việt', 'firstload.help': 'Trợ giúp',
    'firstload.idle': 'Chưa có từ điển nào — hãy tải từ điển để bắt đầu tra từ.',
    'firstload.loading': 'Đang tải các từ điển mặc định…',
    'firstload.downloading': 'Đang tải',
    'firstload.done': 'Từ điển đã sẵn sàng — tra từ được ngay.',
    'firstload.unreachable': 'Không kết nối được tới nguồn dữ liệu từ điển của bản triển khai này.',
    'firstload.retry': '↻ Tải lại từ điển',
    'firstload.ctaSize': '⬇ Tải từ điển (≈ {size})',
    'firstload.sizeUnknown': 'chưa rõ dung lượng (thường vài GB)',
    'firstload.cancelled': 'Đã huỷ tải — chưa có từ điển nào được nạp.',
    'firstload.cancelHint': 'Bấm “↻ Tải lại từ điển” để thử lại, hoặc dùng file .mdx của bạn trong ⚙ Nâng cao.',
    'firstload.failed': 'Tải thất bại: {names}. Kiểm tra kết nối rồi thử lại, hoặc mở ⚙ Nâng cao để nạp file .mdx của bạn.',
    'firstload.unreachableHint': 'Các nguồn tải từ điển không phản hồi. Bấm “↻ Tải lại từ điển” để thử lại, hoặc dùng “Dùng file .mdx của tôi” bên dưới để nạp thủ công.',
    'firstload.checking': 'Đang kiểm tra dung lượng từ điển…',
    'firstload.note': 'Tải một lần, lưu trong ứng dụng, sau đó dùng hoàn toàn offline.',
    'vault.tab.all': 'Tất cả', 'vault.tab.word': 'Từ', 'vault.tab.phrase': 'Cụm từ', 'vault.tab.sentence': 'Câu', 'vault.tab.due': 'Cần ôn',
    'vault.selectAll': 'Chọn tất cả', 'vault.reviewNow': 'Ôn ngay', 'vault.addTag': 'Thêm nhãn', 'vault.markKnown': 'Đánh dấu đã biết',
    'vault.export': 'Xuất', 'vault.delete': 'Xóa', 'vault.search': 'Tìm trong sổ tay — chữ, ghi chú, nhãn…',
    'vault.emptyTitle': 'Sổ tay trống', 'vault.emptyHint': 'Lưu một từ hoặc cụm từ khi đang đọc — ví dụ và ghi chú sẽ hiện ở đây.',
    'vault.openReader': '📖 Mở Đọc', 'vault.searchWord': '🔍 Tra một từ',
    'vault.noneTitle': 'Không có mục nào khớp', 'vault.noneHint': 'Thử từ khóa khác hoặc bỏ bộ lọc. Mẹo: dùng menu sắp xếp hoặc một nhãn để thu hẹp.',
    'review.practice': '🎯 Luyện tập', 'review.openVault': 'Mở Sổ tay',
    'review.emptyTitle': 'Chưa có gì cần ôn', 'review.emptyHint': 'Từ và cụm từ bạn lưu sẽ hiện ở đây khi đến hạn ôn. Quay lại sau, hoặc luyện tập từ Sổ tay.',
    'review.show': 'Xem đáp án', 'review.know': 'Biết', 'review.forgot': 'Quên', 'review.skip': 'Bỏ qua',
    'practice.emptyTitle': 'Chưa có gì để luyện', 'practice.openVault': 'Mở Sổ tay',
    'practice.emptyHint': 'Hãy lưu vài từ, cụm từ hoặc câu trước, rồi quay lại — Luyện tập tạo bài điền từ và nghe-gõ từ Sổ tay của bạn.',
    'practice.cloze': 'Điền từ còn thiếu', 'practice.dictation': 'Nghe và gõ lại câu', 'practice.listen': 'Gõ từ bạn nghe được', 'practice.choice': 'Chọn nghĩa đúng',
    'practice.check': 'Kiểm tra', 'practice.got': 'Đã hiểu', 'practice.again': 'Ôn lại', 'practice.hear': '🔊 Nghe',
    'practice.hint': '💡 Gợi ý', 'practice.recall': 'gõ từ ứng với nghĩa',
    'practice.done': 'Hoàn thành phiên 🎉', 'practice.again2': 'Luyện lại',
    'known.title': 'Tôi đã biết những từ phổ thông nhất',
    'known.hint': 'Chọn mốc xuất phát để app đếm đúng "từ bạn đã biết" ngay từ đầu. Không có gì được thêm vào Sổ tay — đây chỉ là mốc đo độ phủ khi đọc, nằm offline trên máy bạn.',
    'known.cta': 'Tôi biết {n} từ phổ thông nhất',
    'known.status': 'Đã chọn mốc: Top {n} — {count} từ được đánh dấu đã biết. Muốn đổi, hãy xoá mốc trong ⚙ Nâng cao rồi chọn lại.',
    'known.advTitle': 'Từ đã biết — mốc đo độ phủ khi đọc',
    'known.advNone': 'Chưa chọn mốc nào — màn hình Sổ tay trống sẽ gợi ý chọn một mốc.',
    'known.advSet': 'Mốc: {level} — {count} từ được đánh dấu đã biết.',
    'known.reset': 'Xoá mốc từ đã biết',
    'known.resetConfirm': 'Xoá mốc từ đã biết? Ước lượng độ phủ sẽ tính lại các từ này là chưa biết (các mục đã lưu trong Sổ tay không bị ảnh hưởng).',
    'known.resetDone': 'Đã xoá mốc từ đã biết',
    'known.setLevel': 'Đã chọn mốc từ đã biết: Top {n} từ',
    'known.statsLabel': 'Vốn từ đã biết',
    'known.statsNote': 'mốc top-{n} + {m} từ đánh dấu đã biết trong Sổ tay',
    'known.statsNone': 'chưa chọn mốc',
    'stats.gVocab2': 'Độ phủ khi đọc',
    'cov.knownOf': '{known}/{total} từ trong phạm vi ước tính',
    'cov.highlight': '🎨 Tô nổi',
    'cov.hlTitle': 'Tô nổi từ đã biết / đang học / mới trong bài',
    'cov.easy': 'Dễ', 'cov.mid': 'Vừa (i+1)', 'cov.hard': 'Bài khó',
    'cov.hardWarn': 'Bài khó — dưới 60% từ trong phạm vi ước tính. Một bài ngắn hơn hoặc dễ hơn có thể phù hợp hơn.',
    'cov.newHead': 'Từ mới:',
    'cov.estimateNote': 'Ước tính theo top-10k từ tiếng Anh phổ thông nhất (offline, trên máy bạn). Tên riêng và số liệu không được đếm.',
    'cov.noEstimate': 'Chưa đủ thông tin để ước tính độ phù hợp của bài đọc. Hãy chọn mốc vốn từ gần với bạn nhất; lựa chọn này chỉ lưu trên thiết bị.',
    'cov.chooseBaseline': 'Mốc xuất phát của tôi gần với:',
    'cov.noEstimateStatus': 'Chọn mốc vốn từ để ước tính độ phủ, hoặc bấm vào từ để tra.',
    'cov.statusDone': '{pct}% từ trong phạm vi ước tính · {words} từ — bấm vào từ bất kỳ để tra bên dưới.',
    'cov.noMilestone': 'Chưa chọn mốc xuất phát — hãy chọn trong Sổ tay để app đếm đúng "từ đã biết".',
    'known.current': 'hiện tại',
    'apkg.building': 'Đang tạo bộ thẻ Anki…',
    'apkg.done': 'Đã xuất bộ thẻ Anki — {n} thẻ. Mở Anki → File → Import để nạp file.',
    'apkg.nothing': 'Không có gì để xuất',
    'apkg.failed': 'Không tạo được bộ thẻ Anki — thử lại (lần xuất đầu cần chút thời gian nạp bộ dựng).',
    'cov.band1k': 'top 1k', 'cov.band2k': 'top 2k', 'cov.band5k': 'top 5k', 'cov.band10k': 'top 10k', 'hero.ctaOffline': '📚 H\u1ecdc offline — kh\u00f4ng c\u1ea7n key', 'hero.hint': 'D\u00e1n \u0111o\u1ea1n v\u0103n ng\u1eafn v\u00e0o Reader \u1edf d\u01b0\u1edbi, b\u1ea5m B\u1eaf\u0111 \u0111\u1ea7u \u0111\u1ecdc, r\u1ed3i ch\u1ecdn AI practice \u2014 ho\u1eb7c h\u1ecdc offline mi\u1ec5n ph\u00ed kh\u00f4ng c\u1ea7n key.', 'tutor.start': '✨ Luy\u1ec7n AI (online \u00b7 key c\u1ee7a b\u1ea1n)', 'tutor.title': 'Luy\u1ec7n \u0111\u1ecdc \u2192 n\u00f3i', 'tutor.hint': 'G\u1ee3i \u00fd AI \u0111\u01b0\u1ee3c \u0111\u1ed1i chi\u1ebfu v\u1edbi b\u00e0i \u0111\u1ecdc. H\u00e3y duy\u1ec7t feedback tr\u01b0\u1edbc khi l\u01b0u v\u00e0o l\u1ecbch s\u1eed h\u1ecdc.', 'hero.offline': 'H\u1ecdc offline mi\u1ec5n ph\u00ed (kh\u00f4ng c\u1ea7n key)', 'village.title': 'H\u1ecdc ti\u1ebfng Anh c\u00f4ng s\u1edf n\u01a1i m\u1ea1ng ch\u1eadp ch\u1eddn.', 'village.body': 'Chu\u1ea9n b\u1ecb pack n\u01a1i c\u00f3 m\u1ea1ng; sau \u0111\u00f3 \u0111\u1ecdc, luy\u1ec7n v\u00e0 \u00f4n ho\u00e0n to\u00e0n offline — kh\u00f4ng key, kh\u00f4ng t\u00e0i kho\u1ea3n, kh\u00f4ng theo d\u00f5i.', 'village.lessons': 'B\u00e0i h\u1ecdc offline (33 packs · ~340 KB)', 'village.ielts': 'Lab IELTS/TOEIC offline', 'village.offlineBadge': 'OFFLINE · không cần key', 'village.labNote': 'Đường học offline: Listening/Reading chấm key cố định chạy ở chế độ máy bay. AI feedback optional bên dưới cần mạng + key riêng.', 'reader.offlinePacks': 'B\u1ed9 b\u00e0i h\u1ecdc offline', 'reader.loopHint': 'Đ\u1ecdc → c\u1ee5m t\u1eeb → t\u00ecnh hu\u1ed1ng m\u1edbi → Vault — ho\u1eb7c h\u1ecdc pack offline, kh\u00f4ng c\u1ea7n key', 'reader.freeLesson': 'H\u1ecdc th\u1eed offline mi\u1ec5n ph\u00ed', 'reader.savedArticles': '📁 B\u00e0i \u0111\u00e3 l\u01b0u', 'reader.tools': 'C\u00f4ng c\u1ee5 \u0111\u1ecdc', 'reader.saveOffline': '💾 L\u01b0u offline', 'sense.title': 'L\u01b0u ngh\u0129a n\u00e0y', 'sense.entry': 'M\u1ee5c t\u1eeb \u0111i\u1ec3n', 'sense.meaning': 'Ngh\u0129a c\u1ea7n nh\u1edb', 'sense.context': 'C\u00e2u ngu\u1ed3n (t\u00f9y ch\u1ecdn)', 'sense.save': 'L\u01b0u ngh\u0129a', 'sense.cancel': 'H\u1ee7y', 'search.search': 'T\u00ecm', 'ui.skip': 'B\u1ecf qua \u0111\u1ebfn t\u00ecm ki\u1ebfm', 'ui.clear': 'X\u00f3a', 'ui.listenTts': 'Nghe \u0111\u1ecdc (text-to-speech)', 'ui.listenPron': 'Nghe ph\u00e1t \u00e2m', 'ui.saveWord': 'L\u01b0u t\u1eeb', 'ui.saveWordAria': 'L\u01b0u t\u1eeb v\u00e0o S\u1ed5 tay', 'ui.dismissShort': '\u0110\u00f3ng', 'ui.dismiss': '\u0110\u00f3ng g\u1ee3i \u00fd n\u00e0y', 'ui.moreWays': 'Th\u00eam c\u00e1ch \u0111\u1ecdc: file, URL, transcript ho\u1eb7c audio', 'ui.tsTitle': 'K\u1ebft n\u1ed1i t\u00e0i kho\u1ea3n AI', 'ui.tsHint': 'M\u1ee5c n\u00e0y t\u00f9y ch\u1ecdn. H\u1ecdc offline v\u1eabn mi\u1ec5n ph\u00ed. Key ch\u1ec9 l\u01b0u trong tr\u00ecnh duy\u1ec7t n\u00e0y v\u00e0 ch\u1ec9 g\u1eedi \u0111\u1ebfn nh\u00e0 cung c\u1ea5p b\u1ea1n ch\u1ecdn sau khi b\u1ea1n duy\u1ec7t t\u1eebng y\u00eau c\u1ea7u. Nh\u00e0 cung c\u1ea5p c\u00f3 th\u1ec3 t\u00ednh ph\u00ed token.', 'ui.tsProvider': 'Nh\u00e0 cung c\u1ea5p', 'ui.tsOther': 'D\u1ecbch v\u1ee5 t\u01b0\u01a1ng th\u00edch kh\u00e1c', 'ui.tsKey': 'API key c\u1ee7a nh\u00e0 cung c\u1ea5p', 'ui.tsAdv': 'N\u00e2ng cao: model v\u00e0 endpoint', 'ui.tsEndpoint': 'API endpoint', 'ui.tsModel': 'Model', 'ui.tsSave': 'L\u01b0u v\u00e0 ti\u1ebfp t\u1ee5c', 'ui.btnCancel': 'H\u1ee7y', 'ui.btnClose': '\u0110\u00f3ng', 'ui.chooseDict': 'Ch\u1ecdn t\u1eeb \u0111i\u1ec3n', 'ui.hearWord': 'Nghe t\u1eeb', 'ui.slowPlayback': 'Nghe ch\u1eadm (0.75\u00d7)', 'ui.replaySentence': 'Nghe l\u1ea1i c\u00e2u \u0111\u00e3 l\u01b0u', 'ui.savedCtx': 'Ng\u1eef c\u1ea3nh \u0111\u00e3 l\u01b0u c\u1ee7a t\u1eeb n\u00e0y', 'ui.inSavedCtx': 'Trong ng\u1eef c\u1ea3nh \u0111\u00e3 l\u01b0u', 'ui.addExample': '\u2795 Th\u00eam v\u00ed d\u1ee5', 'ui.openInVault': 'M\u1edf trong Vault', 'ui.cancelDownload': 'H\u1ee7y t\u1ea3i xu\u1ed1ng', 'ui.fullscreen': 'Xem \u0111\u1ecdc to\u00e0n m\u00e0n h\u00ecnh', 'ui.fsOxford': 'Xem \u0111\u1ecdc to\u00e0n m\u00e0n h\u00ecnh cho WordNet', 'ui.fsLongman': 'Xem \u0111\u1ecdc to\u00e0n m\u00e0n h\u00ecnh cho Wiktionary', 'ui.fsThird': 'Xem \u0111\u1ecdc to\u00e0n m\u00e0n h\u00ecnh cho khung 3', 'ui.slot3name': 'Khung 3 (t\u00f9y ch\u1ecdn \u2014 file .mdx c\u1ee7a b\u1ea1n)', 'ui.closeEditor': '\u0110\u00f3ng tr\u00ecnh s\u1eeda', 'ui.ppTitle': 'C\u1ee5m m\u1eadt kh\u1ea9u', 'ui.ppGo': 'Ti\u1ebfp t\u1ee5c', 'ui.snapTitle': 'B\u00e0i \u0111\u00e3 l\u01b0u', 'ui.snapHint': 'B\u00e0i b\u1ea1n \u0111\u00e3 l\u01b0u \u0111\u1ec3 \u0111\u1ecdc offline. Ch\u1ea1m m\u1ed9t b\u00e0i \u0111\u1ec3 m\u1edf trong Reader \u2014 kh\u00f4ng c\u1ea7n m\u1ea1ng.',
  },
};
Object.assign(I18N.en, {
  'dialog.itemEdit': 'Edit item', 'dialog.addExample': 'Add an example', 'dialog.export': 'Export',
  'dialog.tags': 'Tags', 'dialog.welcome': 'Welcome 👋', 'dialog.advanced': 'Advanced',
  'about.title': 'A study & research dictionary, right in your browser',
  'about.summary': 'About this app — features & terms of use',
  'about.licH': 'Dictionaries & licenses',
  'about.feedback': 'If this app helps your study, I\'d genuinely like to hear it — <a class="support-link" href="mailto:quocanh38@gmail.com?subject=Dual%20Dictionary%20%E2%80%94%20feedback">one email is enough</a>.',
  'help.title': 'How to use',
});
Object.assign(I18N.vi, {
  'dialog.itemEdit': 'Sửa mục', 'dialog.addExample': 'Thêm ví dụ', 'dialog.export': 'Xuất',
  'dialog.tags': 'Nhãn', 'dialog.welcome': 'Chào mừng 👋', 'dialog.advanced': 'Nâng cao',
  'about.title': 'Từ điển học tập & tra cứu, ngay trong trình duyệt',
  'about.summary': 'Về ứng dụng — tính năng &amp; điều khoản sử dụng',
  'about.licH': 'Từ điển &amp; giấy phép',
  'about.intro': '<strong>Dual Dictionary là ứng dụng web offline-first cho việc học và tra cứu cá nhân: tra từ tiếng Anh với nhiều từ điển — một chạm chuyển khung — hỗ trợ file từ điển .mdx/.mdd của riêng bạn. Mọi thứ chạy ngay trong trình duyệt — dữ liệu ở lại trên máy bạn, không tài khoản, không theo dõi, không quảng cáo.</strong>',
  'about.terms': 'Ứng dụng chỉ dành cho mục đích học tập và tra cứu cá nhân. Đây không phải sản phẩm thương mại, không nhằm thương mại hoá hay phát hành lại bất kỳ nội dung từ điển nào. Dữ liệu mở đi kèm vẫn theo giấy phép riêng (xem NOTICE.md) — điều khoản này chỉ áp dụng cho bản triển khai này.',
  'about.features': '<li><strong>Nhiều từ điển một chỗ:</strong> một lần tìm, một chạm chuyển giữa các từ điển đang tải.</li>'
    + '<li><strong>Chế độ Đọc:</strong> dán bài viết hoặc mở trang Wikipedia, bấm vào từ bất kỳ để tra ở khung bên dưới — không rời khỏi bài đọc.</li>'
    + '<li><strong>Mặc định mở sẵn:</strong> bản công khai đi kèm từ điển giấy phép mở (WordNet 3.1, Simple English Wiktionary) — miễn phí, không cần đăng nhập. Có thể thêm từ điển Anh–Việt mở (OVDP, 386.600 mục) chỉ với một cú bấm.</li>'
    + '<li><strong>Dùng từ điển của riêng bạn:</strong> nạp file .mdx / .mdd bạn sở hữu (định dạng MDX) vào khung bất kỳ — chỉ dùng file bạn được phép dùng.</li>'
    + '<li><strong>Công cụ học tập:</strong> gợi ý từ, lịch sử tra từ, Sổ tay lưu mọi từ/cụm từ/câu kèm ghi chú và nhãn, cùng hàng đợi Ôn tập lặp lại ngắt quãng — sau vài trăm lượt ôn có thể tinh chỉnh trọng số FSRS theo đúng lịch sử của bạn (trên máy, trong ⚙ Nâng cao).</li>'
    + '<li><strong>Ngữ cảnh đọng lại:</strong> tra một từ đã lưu sẽ thấy câu gốc của bạn được tô nổi phía trên mục từ — thêm ví dụ bất cứ lúc nào.</li>'
    + '<li><strong>Luyện tập &amp; theo dõi:</strong> biến mục đã lưu thành bài tập nhanh (điền từ, nghe &amp; gõ, đọc to bằng nhận dạng giọng của trình duyệt) và xem từ đã học, tỷ lệ nhớ, nguồn đã đọc trong Thống kê. Ôn tập chạy theo thuật toán FSRS (tinh chỉnh được theo lịch sử của bạn trong ⚙ Nâng cao, hoàn toàn trên máy), phiên âm IPA hiện cho hầu hết từ tiếng Anh. Luyện tập có thêm 🎤 cue card (đề bài, 1 phút chuẩn bị, 2 phút nói), Reader có đồng hồ tốc độ đọc, Sổ tay có tab ✍ Viết kèm đếm từ và hẹn giờ Task 2.</li>'
    + '<li><strong>Dữ liệu là của bạn:</strong> xuất / nhập mọi thứ dạng JSON, CSV, TSV hoặc văn bản cho Anki — không cloud, không tài khoản. AI tùy chọn gửi bài và câu trả lời tới nhà cung cấp bạn chọn sau khi bạn đồng ý; tự trả phí token bằng API key của bạn.</li>'
    + '<li><strong>Cài như ứng dụng:</strong> Thêm vào Màn hình chính trên iOS/Android — sau đó chạy hoàn toàn offline. Có thể bật nhắc ôn (tùy chọn, chỉ chạy local) trong ⚙ Nâng cao.</li>',
  'about.licP': 'Bản công khai chỉ đi kèm dữ liệu giấy phép mở (xem <a href="NOTICE.md" target="_blank" rel="noopener">NOTICE.md</a>):',
  // U5: một dòng ngắn cho mỗi nguồn (tên + tên ngắn của giấy phép); toàn văn nằm
  // trong tooltip của liên kết và trong NOTICE.md — nội dung giấy phép không đổi.
  'about.licList': '<li><strong>WordNet 3.1</strong> — <a href="NOTICE.md" target="_blank" rel="noopener" title="Giấy phép WordNet 3.1 (Đại học Princeton). Có nhúng IPA từ CMUdict (phạm vi công cộng / BSD) và từ Simple English Wiktionary (CC BY-SA). Toàn văn: NOTICE.md">giấy phép WordNet</a></li>'
    + '<li><strong>Simple English Wiktionary</strong> — <a href="NOTICE.md" target="_blank" rel="noopener" title="Phái sinh từ Simple English Wiktionary: CC BY-SA 3.0+/4.0 (song giấy phép) &amp; GFDL — simple.wiktionary.org. Toàn văn: NOTICE.md">CC BY-SA &amp; GFDL</a></li>'
    + '<li><strong>Phát âm</strong> — <a href="NOTICE.md" target="_blank" rel="noopener" title="CMUdict (phạm vi công cộng / BSD, cmusphinx). Toàn văn: NOTICE.md">CMUdict</a></li>'
    + '<li><strong>Tần suất từ</strong> — <a href="NOTICE.md" target="_blank" rel="noopener" title="Dải tần suất top 10k từ hermitdave/FrequencyWords, giấy phép MIT. Toàn văn: NOTICE.md">MIT</a></li>'
    + '<li><strong>Phiên âm (IPA)</strong> — <a href="NOTICE.md" target="_blank" rel="noopener" title="Bảng IPA từ thichhoc-org/thichhoc-dict (CC BY-SA 4.0; thượng nguồn WordNet, CMUdict, Wiktionary), lấp chỗ thiếu từ CMUdict (phạm vi công cộng / BSD). Toàn văn: NOTICE.md">CC BY-SA 4.0 &amp; CMUdict</a></li>',
  'about.licNote': 'Từ điển thương mại (ví dụ OALD, LDOCE) không bao giờ đi kèm ở đây; chỉ nạp file của bạn qua ⚙ Nâng cao nếu bạn được phép dùng.',
  'about.feedback': 'Nếu app giúp bạn học tốt hơn, mình rất muốn nghe — <a class="support-link" href="mailto:quocanh38@gmail.com?subject=Dual%20Dictionary%20%E2%80%94%20feedback">một email là đủ</a>.',
  'help.title': 'Cách sử dụng',
  'help.quick': '<li><strong>Chờ tải lần đầu</strong> — từ điển được tải một lần rồi lưu trong app, sau đó dùng offline. Tiến độ, tốc độ và thời gian còn lại hiển thị ở đầu mỗi khung; có thể huỷ hoặc thử lại từ màn hình đầu.</li>'
    + '<li><strong>Gõ một từ</strong> (ví dụ <code>apple</code>) rồi Enter — bấm tab trên kết quả để đổi từ điển đang xem.</li>'
    + '<li><strong>Đọc &amp; bấm</strong> — mở 📖 <em>Đọc</em>, dán bài viết (hoặc dán URL Wikipedia), rồi bấm vào từ bất kỳ để tra ngay bên dưới mà không rời bài đọc. 🎬 <em>Phụ đề YouTube</em> biến phụ đề video thành bài đọc bấm-tra được như vậy.</li>'
    + '<li><strong>Lưu nghĩa</strong> — ☆ mở các mục từ điển đã tải để chọn nguồn. Có thể sửa toàn bộ định nghĩa để mỗi thẻ ứng với một nghĩa; câu đã chạm trong Reader được lưu kèm. ⭐ <em>Lưu câu</em> lưu riêng cả câu.</li>'
    + '<li><strong>Ôn tập</strong> — mở ★ <em>Sổ tay</em> để xem mọi thứ kèm ghi chú, nhãn và bộ lọc, rồi 🔁 <em>Ôn tập</em> chạy hàng đợi lặp lại ngắt quãng.</li>',
  'help.more': '<li><strong>Mục đích:</strong> app là công cụ học &amp; tra cứu cá nhân — phi thương mại, không tài khoản, không theo dõi. Mọi dữ liệu từ điển ở lại trên máy bạn.</li>'
    + '<li><strong>Nghe, đọc to, xem IPA:</strong> bấm 🔊 để nghe đọc từ (text-to-speech của trình duyệt); dải phát âm hiện IPA thật cho hầu hết từ tiếng Anh; bấm 🎤 để đọc từ và được kiểm tra bằng nhận dạng giọng của trình duyệt (Luyện tập cũng có bài đọc to). Trên Chrome audio do Google xử lý, trên Safari do Apple — app này không có server.</li>'
    + '<li><strong>Nhắc ôn (tùy chọn):</strong> bật trong <em>⚙ Nâng cao</em> — chỉ chạy local và tự nguyện: badge trên icon app, banner nhẹ và thông báo trên PWA đã cài (Android/Chrome desktop) vào thời điểm browser chọn. Không gửi đi đâu.</li>'
    + '<li><strong>Nạp file từ điển của bạn:</strong> mở <em>⚙ Nâng cao</em> để nạp file .mdx/.mdd bạn có quyền dùng vào một khung. Bản công khai mặc định đi kèm từ điển giấy phép mở (WordNet 3.1, Simple English) — chỉ nạp từ điển thương mại như OALD/LDOCE nếu bạn sở hữu. Xem <a href="data-loading-guide.md" target="_blank" rel="noopener">hướng dẫn nạp chi tiết + xử lý lỗi</a>.</li>'
    + '<li><strong>Cài lên điện thoại:</strong> iPhone/iPad (Safari): Chia sẻ → <em>Thêm vào Màn hình chính</em>. Android (Chrome): menu ⋮ → <em>Thêm vào Màn hình chính / Cài đặt ứng dụng</em>. Cần iOS 16.4+.</li>'
    + '<li><strong>Tự triển khai app:</strong> kéo thư mục vào <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">Netlify Drop</a> (miễn phí) hoặc GitHub Pages. Chỉ phát hành công khai với dữ liệu <strong>giấy phép mở</strong> đi kèm; nếu nạp từ điển <strong>thương mại</strong> thì giữ bản triển khai riêng tư.</li>'
    + '<li><strong>Bàn phím (máy tính):</strong> ↑/↓ chọn gợi ý, Enter để tra, Esc để ẩn.</li>'
    + '<li><strong>Chế độ Đọc:</strong> dán văn bản hoặc mở trang rồi bấm từ để tra; câu đã lưu ở lại với từ — hiện tô nổi phía trên mục từ, kèm <em>Thêm ví dụ</em>.</li>'
    + '<li><strong>Sổ tay &amp; Ôn tập:</strong> mọi từ, cụm từ và câu nằm một chỗ — ghi chú, nhãn, trạng thái, tìm trong sổ tay, chọn nhiều. <em>Ôn tập</em> là hàng đợi FSRS (biết / quên / bỏ qua).</li>'
    + '<li><strong>Dữ liệu là của bạn:</strong> xuất / nhập mọi thứ dạng JSON — không cloud, không tài khoản. AI tùy chọn gửi bài và câu trả lời tới nhà cung cấp bạn chọn sau khi bạn đồng ý; tự trả phí token bằng API key của bạn.</li>'
    + '<li><strong>Anh–Việt một cú bấm:</strong> thêm từ điển Anh–Việt mở (OVDP, 386.600 mục) từ màn hình đầu hoặc ⚙ Nâng cao.</li>'
    + '<li><strong>Luyện tập &amp; thống kê:</strong> 🎯 <em>Luyện tập</em> (từ Sổ tay hoặc Ôn tập) tạo bài nhanh — điền từ còn thiếu, nghe &amp; gõ — với <em>Đã hiểu</em> / <em>Ôn lại</em>. 📊 <em>Thống kê</em> hiện từ đã học, tỷ lệ nhớ, số cần ôn và nguồn đã đọc.</li>'
    + '<li><strong>Xuất đi bất cứ đâu:</strong> Sổ tay xuất mục dạng JSON, CSV, TSV hoặc văn bản cho Anki, có chọn trường.</li>'
    + '<li><strong>Phát âm:</strong> 🔊 đọc từ, 🐢 <em>0.75×</em> đọc chậm, và ↺ đọc lại câu đã lưu. IPA hiện khi dữ liệu từ điển có.</li>',
  'help.licenses': 'Ứng dụng chỉ dành cho <strong>mục đích học tập và tra cứu cá nhân</strong> — phi thương mại. File từ điển bạn nạp vẫn thuộc về nhà phát hành tương ứng (ví dụ Oxford University Press, Pearson): chỉ dùng file bạn được phép, giữ trên máy bạn, không phát hành lại hay chia sẻ công khai.<br>Âm thanh đọc dùng text-to-speech của trình duyệt (không kèm file audio).',
  'onboarding.steps': '<li><strong>Tra từ</strong> — gõ một từ, rồi bấm tab để chọn từ điển đang xem; đổi qua lại bất cứ lúc nào. Muốn nghĩa tiếng Việt? Thêm từ điển Anh–Việt chỉ với một cú bấm.</li>'
    + '<li><strong>Đọc &amp; lưu</strong> — mở 📖 <em>Đọc</em>, dán bài viết (hoặc URL Wikipedia), bấm từ để tra. ☆ mở các nghĩa để chọn và lưu; ⭐ lưu cả câu nguồn.</li>'
    + '<li><strong>Ôn &amp; luyện</strong> — mục đã lưu nằm trong ★ <em>Sổ tay</em>: lọc, gắn nhãn, sắp xếp. 🔁 <em>Ôn tập</em> chạy hàng đợi lặp lại ngắt quãng; 🎯 <em>Luyện tập</em> biến thành bài tập nhanh.</li>'
    + '<li><strong>Cá nhân hoá</strong> — đổi giao diện (🌓) hoặc ngôn ngữ điều hướng (EN/VI); bật nhắc ôn (tùy chọn) trong ⚙ <em>Nâng cao</em>; từ điển và ôn tập chạy offline miễn phí; AI tùy chọn cần mạng và key của bạn. Xuất/nhập dữ liệu bất cứ lúc nào — dữ liệu học được lưu trên máy. AI tùy chọn chỉ gửi bài và câu trả lời sau khi bạn đồng ý; phí token do bạn trả nhà cung cấp.</li>',
});
Object.assign(I18N.en, {
  'field.note': 'Note', 'field.tags': 'Tags (comma-separated)', 'field.deck': 'Deck (theme)', 'field.status': 'Status',
  'field.format': 'Format', 'field.fields': 'Fields', 'field.example': 'Example sentence',
  // Export-dialog column labels. These are UI labels only — the exported header
  // row always writes the English field keys, so a CSV written in VI still reads
  // back with the same columns.
  'field.fText': 'text', 'field.fType': 'type', 'field.fStatus': 'status', 'field.fTags': 'tags',
  'field.fDeck': 'deck', 'field.fNote': 'note', 'field.fSentence': 'sentence', 'field.fSource': 'source',
  'field.fCreated': 'created',
  'btn.swapSlots': '⇄ Swap slots 1 ↔ 2',
  'opt.new': 'New', 'opt.learning': 'Learning', 'opt.known': 'Known',
  'btn.save': 'Save', 'btn.delete': 'Delete', 'btn.export': 'Export', 'btn.saveExample': 'Save example',
  'tags.hint': 'Rename or delete a tag across all saved items.',
  'onboard.cta': "Got it — let's go", 'help.cta': 'Got it',
  // R-B: the footer's legal/attribution block is ONE short line + ONE link. The
  // use terms stay visible; the source names + licence short forms live in the
  // panel-head chips (v61) and in About, and the full wording is one hop away in
  // NOTICE.md. Licence NAMES stay in English (translating legal wording would not
  // be truthful) — the link's tooltip is bilingual because it is only a signpost.
  'foot.termsShort': 'Personal study & research only — no redistribution or commercial use.',
  'foot.licLink': 'Licences & sources',
  'foot.licLinkTitle': 'Full licence text and the bundled dictionary sources (WordNet 3.1, Simple English Wiktionary, EN–VI OVDP). Also in-app under About — “Dictionaries & licenses”. Full text: NOTICE.md',
  'foot.offline': 'Offline & non-commercial · bring your own .mdx / .mdd files',
  // Encrypted-backup dialog copy: these three keys were referenced from JS but
  // never defined in either table, so the dialog/toast showed the raw key.
  'crypto.passNew': 'Choose a passphrase for this backup — you will need it to restore it',
  'crypto.passOpen': 'Enter the passphrase for this backup',
  'crypto.failed': 'Could not restore this backup — wrong passphrase, or the file is damaged',
});
Object.assign(I18N.vi, {
  'field.note': 'Ghi chú', 'field.tags': 'Nhãn (phân cách bằng dấu phẩy)', 'field.deck': 'Bộ từ (chủ đề)', 'field.status': 'Trạng thái',
  'field.format': 'Định dạng', 'field.fields': 'Trường dữ liệu', 'field.example': 'Câu ví dụ',
  'field.fText': 'văn bản', 'field.fType': 'loại', 'field.fStatus': 'trạng thái', 'field.fTags': 'nhãn',
  'field.fDeck': 'bộ từ', 'field.fNote': 'ghi chú', 'field.fSentence': 'câu ví dụ', 'field.fSource': 'nguồn',
  'field.fCreated': 'ngày tạo',
  'btn.swapSlots': '⇄ Đổi chỗ khung 1 ↔ 2',
  'opt.new': 'Mới', 'opt.learning': 'Đang học', 'opt.known': 'Đã biết',
  'btn.save': 'Lưu', 'btn.delete': 'Xóa', 'btn.export': 'Xuất', 'btn.saveExample': 'Lưu ví dụ',
  'tags.hint': 'Đổi tên hoặc xóa một nhãn trên toàn bộ mục đã lưu.',
  'example.hint': 'Câu ví dụ của riêng bạn cho “<strong id="example-word"></strong>”.',
  'onboard.cta': 'Bắt đầu thôi', 'help.cta': 'Đã hiểu',
  'foot.termsShort': 'Chỉ dùng cho học tập & tra cứu cá nhân — không phát hành lại, không dùng cho mục đích thương mại.',
  'foot.licLink': 'Giấy phép & nguồn dữ liệu',
  'foot.licLinkTitle': 'Toàn văn giấy phép và các nguồn từ điển đi kèm (WordNet 3.1, Simple English Wiktionary, Anh–Việt OVDP). Cũng có trong ứng dụng ở mục “Về ứng dụng” — “Từ điển & giấy phép”. Toàn văn: NOTICE.md',
  'foot.offline': 'Offline & phi thương mại · tự mang file .mdx / .mdd của bạn',
  'crypto.passNew': 'Chọn mật khẩu cho bản sao lưu này — bạn sẽ cần nó khi phục hồi',
  'crypto.passOpen': 'Nhập mật khẩu của bản sao lưu này',
  'crypto.failed': 'Không phục hồi được bản sao lưu — sai mật khẩu hoặc file bị hỏng',
});

/* U10: Stats groups + card labels/notes. Card VALUES are numbers or the "—"
 * placeholder, so the strings live here (with {placeholders} filled by
 * renderStats) — EN and VI in lockstep, like the rest of the chrome. */
Object.assign(I18N.en, {
  'stats.gVocab': 'Vocabulary', 'stats.gReview': 'Review', 'stats.gActivity': 'Sources & streak',
  'stats.tracked': '{n} items tracked', 'stats.trackedOne': '{n} item tracked',
  'stats.itemsSaved': 'Items saved', 'stats.wordsLearned': 'Words learned', 'stats.inProgress': 'In progress',
  'stats.dueNow': 'Due now', 'stats.reviewsDone': 'Reviews done', 'stats.retention': 'Retention',
  'stats.avgMastery': 'Avg mastery', 'stats.sourcesRead': 'Sources read', 'stats.practiceStreak': 'Practice streak',
  'stats.noteKnown': 'marked as known',
  // Counts are pluralised per noun ("1 phrases" read wrong even before this pass).
  'stats.wordsOne': '{n} word', 'stats.words': '{n} words',
  'stats.phrasesOne': '{n} phrase', 'stats.phrases': '{n} phrases',
  'stats.sentencesOne': '{n} sentence', 'stats.sentences': '{n} sentences',
  'stats.noteProgress': '{l} learning · {n} new',
  'stats.noteDue': 'in the review queue',
  'stats.noteReviewedOne': '{n} item reviewed', 'stats.noteReviewed': '{n} items reviewed',
  'stats.noteRetention': 'known ÷ reviewed', 'stats.noteRetentionNone': 'no reviews yet',
  'stats.noteMastery': 'average FSRS box equivalent', 'stats.noteMasteryNone': 'no items yet',
  'stats.noteSourcesNone': 'none yet',
  'stats.noteStreak': 'consecutive days with practice',
  // R-C: the streak's unit is its own token now — .stat-value holds the bare number
  // and .stat-unit holds the word, matching how % and /6 are rendered.
  'stats.streakUnitOne': 'day', 'stats.streakUnit': 'days',
  // "—" means "cannot be computed yet" and never stands in for a real 0.
  'stats.none': '—',
});
Object.assign(I18N.vi, {
  'stats.gVocab': 'Từ vựng', 'stats.gReview': 'Ôn tập', 'stats.gActivity': 'Nguồn đọc & chuỗi ngày',
  'stats.tracked': '{n} mục đang theo dõi', 'stats.trackedOne': '{n} mục đang theo dõi',
  'stats.itemsSaved': 'Mục đã lưu', 'stats.wordsLearned': 'Từ đã học', 'stats.inProgress': 'Đang học',
  'stats.dueNow': 'Cần ôn ngay', 'stats.reviewsDone': 'Lượt ôn', 'stats.retention': 'Tỷ lệ nhớ',
  'stats.avgMastery': 'Mức nắm TB', 'stats.sourcesRead': 'Nguồn đã đọc', 'stats.practiceStreak': 'Chuỗi luyện tập',
  'stats.noteKnown': 'đã đánh dấu biết',
  'stats.wordsOne': '{n} từ', 'stats.words': '{n} từ',
  'stats.phrasesOne': '{n} cụm từ', 'stats.phrases': '{n} cụm từ',
  'stats.sentencesOne': '{n} câu', 'stats.sentences': '{n} câu',
  'stats.noteProgress': '{l} đang học · {n} mới',
  'stats.noteDue': 'trong hàng đợi ôn tập',
  'stats.noteReviewedOne': '{n} mục đã ôn', 'stats.noteReviewed': '{n} mục đã ôn',
  'stats.noteRetention': 'đã biết ÷ đã ôn', 'stats.noteRetentionNone': 'chưa ôn lần nào',
  'stats.noteMastery': 'trung bình hộp FSRS tương đương', 'stats.noteMasteryNone': 'chưa có mục nào',
  'stats.noteSourcesNone': 'chưa có',
  'stats.noteStreak': 'số ngày luyện tập liên tiếp',
  'stats.streakUnitOne': 'ngày', 'stats.streakUnit': 'ngày',
  'stats.none': '—',
});
// v67 R2 — review reminders (opt-in, local-only). Notification copy for the
// background-tab path; the SW side reads `lang` from the meta cache instead.
Object.assign(I18N.en, {
  'dueBanner.text': '{n} items are due for review — a short session keeps them fresh',
  'dueBanner.cta': 'Review now',
  'adv.reminders.label': 'Nudge me when words are due for review',
  'adv.reminders.note': 'Local-only: notifications are generated on this device and nothing is sent anywhere. While the app is closed, nudges only work on an installed Android / desktop-Chrome PWA, at times the browser chooses; on iOS the app nudges only while it is open.',
  'adv.fsrs.optimize': '⚙ Optimize with my review history',
  'adv.fsrs.reset': '↩ Back to default weights',
  'adv.fsrs.note': 'Trains the 17 FSRS scheduling weights on YOUR review history, entirely on this device — no server, nothing exported. Recommended from ~400 graded reviews (200 minimum); below that the button stays off and the defaults keep scheduling.',
  'fsrsOpt.waiting': 'Logged {n} reviews across {items} items — optimization unlocks at 200, works best from 400. Keep reviewing; this page turns on automatically.',
  'fsrsOpt.tiny': 'Logged {n} reviews across {items} items — enough for a cautious optimization (kept close to the defaults).',
  'fsrsOpt.ready': 'Logged {n} reviews across {items} items — a good size to optimize with.',
  'fsrsOpt.custom': 'Personalized weights are active.',
  'fsrsOpt.running': 'Optimizing on this device…',
  'fsrsOpt.done': 'Done: prediction error {b0} → {b1} over {n} reviews. Personalized weights are active — ↩ below returns to the defaults.',
  'fsrsOpt.tooFew': 'Only {n} reviews — optimization unlocks at 200.',
    'fsrsOpt.error': 'Could not read the review log on this device.',
    'envi.hint': 'Want Vietnamese meanings? Add the open EN–VI dictionary — one click.',
    'envi.hintBtn': 'Add EN–VI',
  'adv.reminders.off': 'Reminders are off.',
  'adv.reminders.onOpen': 'On — the app nudges while it is open (badge + banner).',
  'adv.reminders.onSync': 'On — background nudges enabled (installed app; the browser chooses the timing).',
  'adv.reminders.blocked': 'Notification permission is blocked — allow notifications for this site in your browser settings, then toggle again.',
  'adv.reminders.unsupported': 'This browser does not support notifications.',
  'onboard.reminders': '🔔 Get a nudge when words are due',
  'reminders.reoffer': '🔔 Want a nudge when words are due for review? Reminders are local-only.',
  'reminders.reofferAction': 'Turn on',
  'remind.title': '{n} item(s) due for review',
  'remind.body': 'Open Dual Dictionary — nothing leaves your device.',
});
// v69 R4 — say-it-aloud practice + pron-strip mic (browser speech recognition)
Object.assign(I18N.en, {
  'practice.say': 'Say it aloud',
  'practice.mic': '🎤 Speak',
  'practice.micListening': '🎤 Listening…',
  'practice.heard': 'Heard',
  'practice.micError': 'Microphone unavailable — check the browser permission and try again.',
  'pron.micTitle': 'Say the word and check it — your browser\'s speech recognition (Chrome sends the audio to Google, Safari to Apple; this app has no server)',
  'pron.micListening': '🎤 Listening…',
  'pron.micHeard': 'Heard',
  'pron.micError': 'Microphone unavailable — check the browser permission.',
});
Object.assign(I18N.vi, {
  'practice.say': 'Đọc to',
  'practice.mic': '🎤 Nói',
  'practice.micListening': '🎤 Đang nghe…',
  'practice.heard': 'Nghe được',
  'practice.micError': 'Không dùng được micro — kiểm tra quyền trong browser rồi thử lại.',
  'pron.micTitle': 'Đọc từ và kiểm tra — dùng nhận dạng giọng của browser (Chrome gửi audio lên Google, Safari lên Apple; app này không có server)',
  'pron.micListening': '🎤 Đang nghe…',
  'pron.micHeard': 'Nghe được',
  'pron.micError': 'Không dùng được micro — kiểm tra quyền trong browser.',
});
Object.assign(I18N.vi, {
  'dueBanner.text': '{n} mục đến hạn ôn — một phiên ngắn giúp nhớ lâu hơn',
  'dueBanner.cta': 'Ôn ngay',
  'adv.reminders.label': 'Nhắc tôi khi có từ đến hạn ôn',
  'adv.reminders.note': 'Chỉ chạy local: thông báo được tạo trên chính thiết bị này, không gửi đi đâu. Khi app đang đóng, nhắc chỉ hoạt động trên PWA đã cài (Android / Chrome desktop) và vào thời điểm browser tự chọn; trên iOS app chỉ nhắc khi đang mở.',
  'adv.fsrs.optimize': '⚙ Tối ưu theo lịch sử ôn của tôi',
  'adv.fsrs.reset': '↩ Trở về trọng số mặc định',
  'adv.fsrs.note': 'Huấn luyện 17 trọng số lập lịch FSRS trên chính lịch sử ôn của bạn, hoàn toàn trên máy này — không server, không xuất dữ liệu. Khuyến nghị từ ~400 lượt ôn (tối thiểu 200); dưới ngưỡng đó nút tắt và mặc định tiếp tục lập lịch.',
  'fsrsOpt.waiting': 'Đã ghi {n} lượt ôn trên {items} mục — mở khóa ở 200, tốt nhất từ 400. Cứ ôn bình thường; trang này tự bật khi đủ.',
  'fsrsOpt.tiny': 'Đã ghi {n} lượt ôn trên {items} mục — đủ để tối ưu thận trọng (giữ sát mặc định).',
  'fsrsOpt.ready': 'Đã ghi {n} lượt ôn trên {items} mục — lượng dữ liệu tốt để tối ưu.',
  'fsrsOpt.custom': 'Đang dùng trọng số cá nhân hóa.',
  'fsrsOpt.running': 'Đang tối ưu trên máy này…',
  'fsrsOpt.done': 'Xong: sai số dự đoán {b0} → {b1} trên {n} lượt ôn. Đang dùng trọng số cá nhân hóa — ↩ bên dưới trở về mặc định.',
  'fsrsOpt.tooFew': 'Chỉ có {n} lượt ôn — mở khóa ở 200.',
    'fsrsOpt.error': 'Không đọc được nhật ký ôn trên máy này.',
    'envi.hint': 'Muốn xem nghĩa tiếng Việt? Thêm từ điển Anh–Việt mở — một cú bấm.',
    'envi.hintBtn': 'Thêm Anh–Việt',
  'adv.reminders.off': 'Đang tắt nhắc ôn.',
  'adv.reminders.onOpen': 'Đang bật — app nhắc khi đang mở (badge + banner).',
  'adv.reminders.onSync': 'Đang bật — nhắc nền hoạt động (app đã cài; thời điểm do browser chọn).',
  'adv.reminders.blocked': 'Quyền thông báo bị chặn — cho phép thông báo cho trang này trong cài đặt browser rồi bật lại.',
  'adv.reminders.unsupported': 'Browser này không hỗ trợ thông báo.',
  'onboard.reminders': '🔔 Nhắc tôi khi có từ đến hạn',
  'reminders.reoffer': '🔔 Nhắc tôi khi có từ đến hạn ôn tập? Nhắc nhở chỉ nằm trên máy bạn.',
  'reminders.reofferAction': 'Bật',
  'remind.title': '{n} mục đến hạn ôn',
  'remind.body': 'Mở Dual Dictionary — không gì rời khỏi thiết bị của bạn.',
});
// v91 — first-run chooser, real-name tabs, i18n'd panel docs (everything the
// audit found still hard-coded English inside the VI interface)
Object.assign(I18N.en, {
  'firstload.title': 'Choose dictionaries to download',
  'firstload.desc': 'One-time download of about {size} (open-licensed data — free for everyone) — after that, everything works offline.',
  'firstload.unreachable': 'No dictionary data is reachable from this deployment.',
  'firstload.enviDesc': 'Vietnamese meanings for 386,600 words — open data (MIT)',
  'firstload.oxfordDesc': "The standard English–English learner's dictionary",
  'firstload.longmanDesc': 'Definitions in simple English — easy to read',
  'firstload.ctaOne': 'Download 1 dictionary (≈ {size})',
  'firstload.ctaN': 'Download {n} dictionaries (≈ {size})',
  'firstload.pickOne': 'Pick at least one dictionary',
  'firstload.downloadAll': 'Download all',
  'firstload.preparing': 'Preparing {name} — you can search {other} while this finishes.',
  'firstload.loadingOne': 'Loading {name}… (one-time download, then stored offline)',
  'envi.short': 'EN–VI',
  'slot.third': 'Slot 3',
  'slot.openLoaded': 'Open-licensed dictionary loaded — use ⚙ Advanced to load your own .mdx files',
  'slot.cancelled': 'Download cancelled',
  'panel.ready': 'is ready.',
  'panel.readyHint': 'Type a word above to start — results appear here.',
  'panel.notLoaded': 'is not loaded yet.',
  'panel.notLoadedHint': 'Tap Download dictionaries below, or open ⚙ Advanced to use your own .mdx files.',
  'panel.loadingRes': 'resources are still loading{eta}.',
  'panel.loadingResHint': 'Watch the progress in the panel header, or search the other dictionary meanwhile.',
});
Object.assign(I18N.vi, {
  'firstload.title': 'Chọn từ điển để tải',
  'firstload.desc': 'Tải một lần khoảng {size} (dữ liệu mở — miễn phí cho mọi người) — sau đó mọi thứ chạy hoàn toàn offline.',
  'firstload.unreachable': 'Không đọc được dữ liệu từ điển từ bản cài này.',
  'firstload.enviDesc': 'Nghĩa tiếng Việt cho 386.600 từ — dữ liệu mở (MIT)',
  'firstload.oxfordDesc': 'Từ điển Anh–Anh chuẩn cho người học',
  'firstload.longmanDesc': 'Định nghĩa tiếng Anh đơn giản, dễ hiểu',
  'firstload.ctaOne': 'Tải 1 từ điển (≈ {size})',
  'firstload.ctaN': 'Tải {n} từ điển (≈ {size})',
  'firstload.pickOne': 'Chọn ít nhất một từ điển',
  'firstload.downloadAll': 'Tải tất cả',
  'firstload.preparing': 'Đang chuẩn bị {name} — bạn có thể tra {other} trong lúc chờ.',
  'firstload.loadingOne': 'Đang tải {name}… (tải một lần, sau đó lưu offline)',
  'envi.short': 'Anh–Việt',
  'slot.third': 'Slot 3',
  'slot.openLoaded': 'Đã tải từ điển mở — dùng ⚙ Nâng cao để dùng file .mdx của bạn',
  'slot.cancelled': 'Đã hủy tải xuống',
  'panel.ready': 'đã sẵn sàng.',
  'panel.readyHint': 'Gõ một từ ở trên để bắt đầu — kết quả hiện ở đây.',
  'panel.notLoaded': 'chưa được tải.',
  'panel.notLoadedHint': 'Bấm Tải từ điển ở dưới, hoặc mở ⚙ Nâng cao để dùng file .mdx của bạn.',
  'panel.loadingRes': 'vẫn đang tải tài nguyên{eta}.',
  'panel.loadingResHint': 'Theo dõi tiến độ ở phần đầu panel, hoặc tra từ điển khác trong lúc chờ.',
});
let lang = localStorage.getItem('lang') || ((String(navigator.language || '').toLowerCase().indexOf('vi') === 0) ? 'vi' : 'en');
function i18n(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; }
/** i18n with {placeholders}: i18nFmt('firstload.ctaSize', {size: fmtSize(n)}) */
function i18nFmt(k, vars) {
  let t = i18n(k);
  for (const [key, val] of Object.entries(vars || {})) t = t.replaceAll('{' + key + '}', val);
  return t;
}
function captureI18nOriginals() {
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { if (el.dataset.i18nEn == null) el.dataset.i18nEn = el.innerHTML; });
}
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = i18n(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', i18n(el.dataset.i18nPh)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = i18n(el.dataset.i18nTitle); });
  // U11: accessible names and the visible hover/focus tooltips are i18n too —
  // before this, data-i18n-aria was dead markup (the keys did not exist and
  // nothing read the attribute), so the four header controls kept a hard-coded
  // English aria-label while their title switched language.
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', i18n(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-tip]').forEach((el) => { el.dataset.tip = i18n(el.dataset.i18nTip); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const vi = I18N.vi[el.dataset.i18nHtml];
    el.innerHTML = (lang === 'vi' && vi) ? vi : (el.dataset.i18nEn != null ? el.dataset.i18nEn : el.innerHTML);
  });
  const b = $('#btn-lang'); if (b) b.textContent = lang === 'vi' ? 'VI' : 'EN';
  // JS-built copy (the not-ready gate line, the empty card's message) has no
  // data-i18n attribute to re-render, so it is repainted here — otherwise
  // switching language left those two lines in the previous language.
  try { updateIdleDictState(); updateEmptyStateCopy(); } catch (e) { /* not ready yet */ }
  try { if (covLast) covRender(); } catch (e) { /* reader not active */ } // v118 A1
  // refresh the active dynamic view so JS-built strings pick up the language
  try { applyView(currentView()); } catch (e) { /* not ready yet */ }
}
function toggleLang() { lang = lang === 'en' ? 'vi' : 'en'; localStorage.setItem('lang', lang); applyLang(); showToast(lang === 'vi' ? 'Tiếng Việt' : 'English'); }

/* install prompt + offline indicator */
let installEvt = null;
function promptInstall() {
  if (!installEvt) return;
  installEvt.prompt();
  installEvt = null;
  $('#btn-install')?.classList.add('hidden');
}
function updateNetBanner() {
  const b = $('#net-banner');
  if (!b) return;
  const off = navigator.onLine === false;
  b.classList.toggle('hidden', !off);
  const el = $('#net-banner-text');
  if (el) el.textContent = 'Offline — saved words and loaded dictionaries still work.';
}

/* search history page */
function renderHistoryView() {
  const list = $('#history-full');
  if (!list) return;
  list.innerHTML = '';
  if (!state.history.length) { list.innerHTML = '<p class="hint">' + escapeHtml(i18n('history.empty')) + '</p>'; return; }
  for (const w of state.history) {
    const row = document.createElement('div');
    row.className = 'hist-row';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vocab-word'; b.textContent = w;
    b.addEventListener('click', () => { navigate('search'); search(w); });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn-vocab-del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Remove ' + w);
    del.addEventListener('click', () => {
      state.history = state.history.filter((x) => x !== w);
      localStorage.setItem('history', JSON.stringify(state.history));
      renderHistory(); renderHistoryView();
    });
    row.append(b, del);
    list.appendChild(row);
  }
}

/* vault sort + tag manager */
let vaultSort = localStorage.getItem('vault-sort') || 'new';
function sortVaultList(list) {
  const arr = list.slice();
  if (vaultSort === 'due') arr.sort((a, b) => a.due - b.due);
  else if (vaultSort === 'hard') arr.sort((a, b) => (a.box || 1) - (b.box || 1) || a.due - b.due);
  else if (vaultSort === 'alpha') arr.sort((a, b) => a.text.localeCompare(b.text));
  else arr.sort((a, b) => b.createdAt - a.createdAt);
  return arr;
}
function renderTagManager() {
  const wrap = $('#tags-list');
  if (!wrap) return;
  const counts = new Map();
  for (const it of state.items) for (const tg of (it.userData.tags || [])) counts.set(tg, (counts.get(tg) || 0) + 1);
  wrap.innerHTML = '';
  if (!counts.size) { wrap.innerHTML = '<p class="hint">No tags yet — add tags from an item’s ••• menu.</p>'; return; }
  for (const pair of [...counts.entries()].sort()) {
    const tg = pair[0]; const n = pair[1];
    const row = document.createElement('div');
    row.className = 'tag-row';
    const name = document.createElement('span');
    name.className = 'tag-name'; name.textContent = tg + ' (' + n + ')';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'tag-edit'; inp.value = tg;
    inp.setAttribute('aria-label', 'Rename tag ' + tg);
    const ren = document.createElement('button');
    ren.type = 'button'; ren.className = 'btn-secondary'; ren.textContent = 'Rename';
    ren.addEventListener('click', () => renameTag(tg, inp.value));
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn-secondary'; del.textContent = 'Delete';
    del.addEventListener('click', () => deleteTag(tg));
    row.append(name, inp, ren, del);
    wrap.appendChild(row);
  }
}
async function renameTag(from, toRaw) {
  const to = String(toRaw == null ? from : toRaw).trim().toLowerCase();
  if (!to || to === from) return;
  const hit = state.items.filter((i) => i.userData.tags.includes(from));
  for (const i of hit) {
    i.userData.tags = i.userData.tags.filter((x) => x !== from);
    if (i.userData.tags.indexOf(to) === -1) i.userData.tags.push(to);
  }
  try { await putItems(hit); } catch (e) { showToast('Could not rename tag — storage error'); return; }
  showToast('Renamed tag → ' + to);
  renderTagManager(); renderVault();
}
async function deleteTag(tg) {
  const hit = state.items.filter((i) => i.userData.tags.includes(tg));
  for (const i of hit) i.userData.tags = i.userData.tags.filter((x) => x !== tg);
  try { await putItems(hit); } catch (e) { showToast('Could not delete tag — storage error'); return; }
  showToast('Deleted tag ' + tg, async () => {
    for (const i of hit) if (i.userData.tags.indexOf(tg) === -1) i.userData.tags.push(tg);
    try { await putItems(hit); } catch (e) { /* ignore */ }
    renderTagManager(); renderVault();
  });
  renderTagManager(); renderVault();
}

/* auto-backup (once a day, into IndexedDB files store) + restore */
async function maybeAutoBackup() {
  try {
    const now = Date.now();
    const last = parseInt(localStorage.getItem('auto-backup-at') || '0', 10);
    if (now - last < 24 * 3600 * 1000) return;
    const items = await allItems();
    const tutor = await tutorRecordsForExport();
    const study = await exportOfflineStudy();
    if (!items.length && !tutor.length && !study.length) return;
    const known = await knownRecordsForExport();
    const payload = JSON.stringify({ app: 'Dual Dictionary', version: 3, autoBackupAt: new Date().toISOString(), items, known, tutor, study });
    const blob = new Blob([payload], { type: 'application/json' });
    await putFile('auto-backup-latest', blob);
    await writeRotatingBackup('auto-backup-' + new Date().toISOString().slice(0, 10), new Blob([payload], { type: 'application/json' }));
    localStorage.setItem('auto-backup-at', String(now));
  } catch (e) { /* non-critical */ }
}
/* ---------------- Review reminders (Phase 6 R2, v67 — opt-in, local-only) ----------------
 * No server, no push, no counters: notifications are generated on this device.
 * While the app is CLOSED this only works where Periodic Background Sync exists
 * (installed Android/desktop-Chrome PWAs) and at browser-chosen times; iOS gets
 * the in-app banner + badge only — the Advanced status line says so honestly.
 * Default OFF; permission is requested from exactly two places (onboarding link,
 * Advanced toggle), never at boot. The 12h notify guard lives in localStorage on
 * the page side and in a meta Cache Storage entry on the SW side (SW cannot read
 * localStorage); both sides respect it. */
const REMINDER_NOTIFY_GAP = 12 * 3600 * 1000;
const DUE_BANNER_GAP = 24 * 3600 * 1000;
const REMINDERS_META = './reminders-meta';

function remindersOn() { return localStorage.getItem('reminders') === 'on'; }

function dueCount() {
  const now = Date.now();
  return state.items.filter((i) => i.due <= now && i.userData.status !== 'known').length;
}

async function writeRemindersMeta(patch) {
  try {
    const c = await caches.open('mdx-dict-meta');
    let meta = {};
    try { meta = await (await c.match(REMINDERS_META)).json(); } catch (e) { /* first write */ }
    await c.put(REMINDERS_META, new Response(JSON.stringify(Object.assign(meta, patch))));
  } catch (e) { /* cache unavailable — SW falls back to bilingual copy */ }
}

async function registerDueSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg && 'PeriodicSyncManager' in window) {
      const tags = await reg.periodicSync.getTags();
      if (!tags.includes('due-check')) {
        await reg.periodicSync.register('due-check', { minInterval: REMINDER_NOTIFY_GAP });
      }
    }
  } catch (e) { /* not installed / unsupported — in-app surfaces still work */ }
}

async function unregisterDueSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      const tags = await reg.periodicSync.getTags();
      if (tags.includes('due-check')) await reg.periodicSync.unregister('due-check');
    }
  } catch (e) { /* ignore */ }
}

async function enableReminders() {
  if (!('Notification' in window)) { renderRemindersStatus(); return; }
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch (e) { perm = 'denied'; }
  }
  if (perm !== 'granted') { renderRemindersStatus(); return; }
  localStorage.setItem('reminders', 'on');
  // hand the SW the user's language for notification copy (it cannot read localStorage)
  await writeRemindersMeta({ lang: lang, lastNotified: 0 });
  await registerDueSync();
  renderRemindersStatus();
}

async function disableReminders() {
  localStorage.setItem('reminders', 'off');
  await unregisterDueSync();
  syncAppBadge(0);
  renderRemindersStatus();
}

function renderRemindersStatus() {
  const toggle = $('#reminders-toggle');
  const status = $('#reminders-status');
  if (toggle) toggle.checked = remindersOn();
  if (!status) return;
  if (!('Notification' in window)) { status.textContent = i18n('adv.reminders.unsupported'); return; }
  if (Notification.permission === 'denied') { status.textContent = i18n('adv.reminders.blocked'); return; }
  if (!remindersOn()) { status.textContent = i18n('adv.reminders.off'); return; }
  status.textContent = ('PeriodicSyncManager' in window) ? i18n('adv.reminders.onSync') : i18n('adv.reminders.onOpen');
}

function syncAppBadge(count) {
  try {
    if (count > 0 && navigator.setAppBadge) navigator.setAppBadge(count);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch (e) { /* unsupported platform */ }
}

/** Quiet in-app due surface: at most once a day, dismissible. Shown or
 *  dismissed both write the guard, so dismissing silences it for the day. */
function maybeShowDueBanner() {
  const banner = $('#due-banner');
  if (!banner || !banner.classList.contains('hidden')) return;
  const now = Date.now();
  const last = parseInt(localStorage.getItem('reminders-last-banner') || '0', 10);
  const due = dueCount();
  if (!due || now - last < DUE_BANNER_GAP) return;
  localStorage.setItem('reminders-last-banner', String(now));
  const el = $('#due-banner-text');
  if (el) el.textContent = i18nFmt('dueBanner.text', { n: due });
  banner.classList.remove('hidden');
}

/** Background-tab nudge while the page itself stays open (desktop case): a
 *  self-rescheduling 15-minute timer that only fires when the tab is hidden,
 *  reminders are on, permission is granted and the 12h guard allows it. */
function scheduleBackgroundNotify() {
  setTimeout(() => {
    try {
      if (document.visibilityState === 'hidden' && remindersOn() && 'Notification' in window && Notification.permission === 'granted') {
        const now = Date.now();
        const last = parseInt(localStorage.getItem('reminders-last-notified') || '0', 10);
        const due = dueCount();
        if (due > 0 && now - last >= REMINDER_NOTIFY_GAP) {
          const n = new Notification(i18nFmt('remind.title', { n: due }), { body: i18n('remind.body'), tag: 'due-review' });
          n.addEventListener('click', () => { window.focus(); location.hash = '#/review'; n.close(); });
          localStorage.setItem('reminders-last-notified', String(now));
        }
      }
    } catch (e) { /* notification constructor unsupported here */ }
    scheduleBackgroundNotify();
  }, 15 * 60 * 1000);
}

function renderBackupInfo() {
  const el = $('#backup-info');
  if (!el) return;
  const at = parseInt(localStorage.getItem('auto-backup-at') || '0', 10);
  el.textContent = at ? 'Last auto-backup: ' + new Date(at).toLocaleString('en-US') : 'No auto-backup yet (it runs once a day when you have saved items).';
}
/* onboarding (first visit) */
function maybeOnboard() {
  if (localStorage.getItem('onboarded')) return;
  const d = $('#onboarding-dialog');
  if (!d) return;
  // The nudge link is a dead button where notifications don't exist at all
  // (iOS Safari in-browser) — hide it instead of silently doing nothing.
  if (!('Notification' in window)) $('#onboard-reminders')?.classList.add('hidden');
  d.showModal();
  localStorage.setItem('onboarded', '1');
  // this visit WAS the reminders offer — never toast the same thing on top
  localStorage.setItem('reminders-offered', '1');
}

/** v116: the onboarding nudge link shows exactly once, on the FIRST visit —
 *  devices onboarded before it existed (every install from before v67) never
 *  see ANY offer anywhere, which reads as the feature being hidden for no
 *  reason. One quiet, ignorable toast for them, once per profile: users who
 *  saw the onboarding link are marked offered at that moment, and tapping the
 *  action runs the same opt-in (permission prompt from the tap itself). */
function maybeReofferReminders() {
  if (!('Notification' in window)) return;
  if (localStorage.getItem('reminders-offered')) return;
  localStorage.setItem('reminders-offered', '1');   // one quiet offer, ever
  if (localStorage.getItem('reminders') === 'on') return;
  showToast(i18n('reminders.reoffer'), () => enableReminders(), 9000, i18n('reminders.reofferAction'));
}

/* review keyboard shortcuts (Space = show answer, 1/2/3 = know/forgot/skip) */
function onGlobalKeydown(e) {
  if (currentView() !== 'review') return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const card = document.querySelector('#review-list .review-card');
  if (!card) return;
  if (e.key === ' ') { const b = card.querySelector('.btn-show-answer'); if (b) { e.preventDefault(); b.click(); } }
  else if (e.key === '1') { const b = card.querySelector('[data-review-act="know"]'); if (b) b.click(); }
  else if (e.key === '2') { const b = card.querySelector('[data-review-act="forgot"]'); if (b) b.click(); }
  else if (e.key === '3') { const b = card.querySelector('[data-review-act="skip"]'); if (b) b.click(); }
}

/* ===== Phase 4: dictionary manager + a11y helpers ===== */
function renderAdvStatus() {
  const el = $('#adv-status');
  if (!el) return;
  const parts = [];
  Object.keys(SLOTS).forEach((slot, i) => {
    const d = state.dicts[slot];
    const name = d && d.mdx && d.mdx.name ? d.mdx.name : (d ? 'loaded' : 'not loaded');
    parts.push('Slot ' + (i + 1) + ': ' + name);
  });
  el.textContent = parts.join('   ·   ');
  renderRemindersStatus();
  renderFsrsOptimizer();
  // v73 tabs: the dialog opens on the tab the visitor most likely came for —
  // dictionary setup while nothing is loaded yet, study behaviour afterwards.
  setAdvTab(Object.keys(SLOTS).some((s) => state.dicts[s]) ? 'learning' : 'dicts');
}

/* v73 — the Advanced dialog's three tabs. Panels keep every existing element ID,
 * so this is purely visibility plumbing. */
const ADV_TABS = [
  ['dicts', '#adv-tab-dicts', '#adv-panel-dicts'],
  ['data', '#adv-tab-data', '#adv-panel-data'],
  ['learning', '#adv-tab-learning', '#adv-panel-learning'],
];

function setAdvTab(name) {
  for (const [key, tabSel, panelSel] of ADV_TABS) {
    const on = key === name;
    $(tabSel)?.setAttribute('aria-selected', String(on));
    const panel = $(panelSel);
    if (panel) panel.hidden = !on;
  }
}

/* v71 — on-device FSRS weight optimizer (⚙ Advanced). One button: reads the
 * review log, fits the 17 weights (js/fsrs-opt.js, lazy-loaded — this code
 * path never runs unless the user clicks), applies them via store.js and
 * persists the blob for future boots. Opt-in, local-only, one-click revert. */
async function renderFsrsOptimizer() {
  const statusEl = $('#fsrs-opt-status');
  const btn = $('#btn-fsrs-optimize');
  if (!statusEl || !btn) return;
  const custom = document.documentElement.dataset.fsrsWeights === 'custom';
  $('#btn-fsrs-reset')?.classList.toggle('hidden', !custom);
  try {
    const revs = await allReviews();
    const n = revs.length;
    const items = new Set(revs.map((r) => r.itemId)).size;
    const key = n >= 400 ? 'fsrsOpt.ready' : n >= 200 ? 'fsrsOpt.tiny' : 'fsrsOpt.waiting';
    statusEl.textContent = i18nFmt(key, { n: String(n), items: String(items) }) + (custom ? ' ' + i18n('fsrsOpt.custom') : '');
    btn.disabled = n < 200;
  } catch (e) {
    statusEl.textContent = i18n('fsrsOpt.error');
    btn.disabled = true;
  }
}

async function optimizeFsrs() {
  const btn = $('#btn-fsrs-optimize');
  const statusEl = $('#fsrs-opt-status');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  if (statusEl) statusEl.textContent = i18n('fsrsOpt.running');
  await new Promise((r) => setTimeout(r, 30)); // let the status paint before the sync fit
  try {
    const { parseLog, train } = await import('./fsrs-opt.js');
    const log = parseLog(await allReviews());
    if (log.points < 200) {
      if (statusEl) statusEl.textContent = i18nFmt('fsrsOpt.tooFew', { n: String(log.points) });
      return;
    }
    // thin log → strong pull toward the defaults; thick log → trust the history
    const lambda = log.points >= 400 ? 0.1 : 0.25;
    const res = train(log.sequences, { lambda, iters: 250 });
    if (!applyFsrsWeights(res.weights)) throw new Error('trained weights failed the sanity gate');
    await putFile('fsrs-custom-weights', new Blob([JSON.stringify({
      version: 1, weights: res.weights, trainedAt: Date.now(),
      reviews: log.points, bce0: res.bce0, bce1: res.bce1, lambda,
    })], { type: 'application/json' }));
    document.documentElement.dataset.fsrsWeights = 'custom';
    $('#btn-fsrs-reset')?.classList.remove('hidden');
    if (statusEl) statusEl.textContent = i18nFmt('fsrsOpt.done', { b0: res.bce0.toFixed(3), b1: res.bce1.toFixed(3), n: String(log.points) });
  } catch (e) {
    console.error('FSRS optimization failed:', e);
    if (statusEl) statusEl.textContent = i18n('fsrsOpt.error');
  } finally {
    btn.disabled = false;
  }
}

async function resetFsrsWeightsUi() {
  try { await delFile('fsrs-custom-weights'); } catch (e) { /* nothing persisted */ }
  resetFsrsWeights();
  document.documentElement.dataset.fsrsWeights = 'default';
  $('#btn-fsrs-reset')?.classList.add('hidden');
  renderFsrsOptimizer();
}
/* C13: the button swaps slot 1 and slot 2 only — the label must say exactly that.
 *  (A generic "Swap slots" promised more than the code did.) */
async function swapSlots() {
  const a = 'oxford', b = 'longman';
  try {
    revokeSlotUrls(a); revokeSlotUrls(b);
    for (const suf of ['-mdx', '-mdd', '-css', '-mdx-meta']) {
      const fa = await getFile(a + suf);
      const fb = await getFile(b + suf);
      if (fb) await putFile(a + suf, fb); else await delFile(a + suf);
      if (fa) await putFile(b + suf, fa); else await delFile(b + suf);
    }
    location.reload();
  } catch (e) { showToast('Could not swap panels 1 and 2: ' + (e.message || 'storage error')); }
}

/* ================= Phase 5-D: Anki/CSV import + backup rotation/restore points ================= */
const BACKUP_KEEP = 7;        // dated auto-backups kept
const RESTORE_POINT_KEEP = 5; // manual restore points kept (C6: they were never pruned)

/** Import an Anki-style .txt/.tsv deck or a .csv (front;back;tags?) by mapping
 *  rows onto LearningItems, then merging through the normal importItems dedupe. */
async function importDeckFile(file) {
  let text;
  try { text = await file.text(); } catch (e) { showToast('Could not read the file'); return; }
  const parsed = parseDeckRows(text, file.name);
  if (!parsed.rows.length) { showToast('No rows found — expected front<TAB>back per line'); return; }
  const payload = { app: 'Dual Dictionary', version: 3, importedFrom: file.name, items: parsed.rows.map((f) => makeItem(f)) };
  try {
    const res = await importItems(payload);
    state.items = await allItems();
    updateVocabBadge(); updateReviewBadge();
    renderVault();
    showToast(`Imported ${res.added} item${res.added === 1 ? '' : 's'} — ${res.skipped} duplicate${res.skipped === 1 ? '' : 's'} skipped`);
  } catch (e) {
    console.warn('deck import failed:', e);
    showToast('Import failed: ' + (e.message || 'unknown'));
  }
}

/** List backup/restore-point keys in the files store (auto-backup-* / restore-point-*). */
async function listBackups() {
  const db = await openDb();
  return new Promise((resolve) => {
    const out = [];
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').openKeyCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(out.sort()); return; }
      const k = String(cur.key);
      if (k.indexOf('auto-backup-') === 0 || k.indexOf('restore-point-') === 0 || k === 'auto-backup-latest') out.push(k);
      cur.continue();
    };
    req.onerror = () => resolve(out.sort());
  });
}

/** Write a backup blob and rotate: keep only the newest BACKUP_KEEP dated keys. */
async function writeRotatingBackup(key, blob) {
  await putFile(key, blob);
  const keys = (await listBackups()).filter((k) => k.indexOf('auto-backup-') === 0 && k !== 'auto-backup-latest');
  const dated = keys.sort(); // ISO dates sort chronologically
  for (const old of dated.slice(0, Math.max(0, dated.length - BACKUP_KEEP))) {
    try { await delFile(old); } catch (e) { /* ignore */ }
  }
}

/** C6: restore points are written on demand and were never pruned — keep only the
 *  newest RESTORE_POINT_KEEP so a long-lived device cannot fill its storage.
 *  Timestamps are ISO (restore-point-YYYY-MM-DDTHH-MM-SS-mmm), so a plain string
 *  sort is chronological. */
async function pruneRestorePoints() {
  const points = (await listBackups()).filter((k) => k.indexOf('restore-point-') === 0).sort();
  for (const old of points.slice(0, Math.max(0, points.length - RESTORE_POINT_KEEP))) {
    try { await delFile(old); } catch (e) { /* ignore */ }
  }
  return points.length;
}

/** Create a manual restore point (snapshot of the current items). */
async function createRestorePoint() {
  try {
    const items = await allItems();
    const tutor = await tutorRecordsForExport();
    const study = await exportOfflineStudy();
    if (!items.length && !tutor.length && !study.length) { showToast('Nothing to back up yet'); return; }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = JSON.stringify({ app: 'Dual Dictionary', version: 3, restorePointAt: new Date().toISOString(), items, known: await knownRecordsForExport(), tutor, study });
    await putFile('restore-point-' + stamp, new Blob([payload], { type: 'application/json' }));
    await pruneRestorePoints(); // C6: cap the on-device snapshots (newest N kept)
    showToast(`Restore point created (${items.length} items) — restoring one merges, it never rolls back`);
    renderBackupInfo();
    renderBackupManager();
  } catch (e) { showToast('Could not create a restore point'); }
}

/** Restore from a chosen backup/restore-point key. MERGE-ONLY by design: items
 *  that are missing locally are added back, existing ones are skipped, nothing is
 *  deleted or overwritten. */
async function restoreFromKey(key) {
  if (!key) { showToast('Pick a restore point first'); return; }
  let blob = null;
  try { blob = await getFile(key); } catch (e) { /* ignore */ }
  if (!blob) { showToast('Restore point not found'); return; }
  try {
    const payload = JSON.parse(await blob.text());
    const res = await importItems(payload);
    const tutorAdded = await importTutorRecords(payload);
    const studyAdded = await importOfflineStudy(payload.study);
    state.items = await allItems();
    updateVocabBadge(); updateReviewBadge(); renderVault();
    showToast(`Merged ${res.added} item${res.added === 1 ? '' : 's'} back — ${res.skipped} duplicate${res.skipped === 1 ? '' : 's'} skipped` + (tutorAdded ? ` + ${tutorAdded} tutor session${tutorAdded===1?'':'s'}` : '') + ' (nothing was deleted)');
  } catch (e) { showToast('Restore failed: ' + (e.message || 'unknown')); }
}

/** Render the backup manager (list + create + restore). */
async function renderBackupManager() {
  const sel = $('#backup-select');
  if (!sel) return;
  const keys = (await listBackups()).filter((k) => k !== 'auto-backup-latest').reverse();
  sel.innerHTML = '';
  if (!keys.length) {
    const o = document.createElement('option');
    o.textContent = 'No backups yet'; o.value = '';
    sel.appendChild(o);
    return;
  }
  for (const k of keys) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = k.indexOf('restore-point-') === 0
      ? 'Restore point — ' + k.replace('restore-point-', '').replace(/-/g, (c, i) => (i > 9 ? ':' : c)).slice(0, 19)
      : 'Auto-backup — ' + k.replace('auto-backup-', '');
    sel.appendChild(o);
  }
}

/* ================= Phase 5-G: offline article snapshots ================= */
const SNAPSHOT_KEEP = 20;

async function listSnapshots() {
  const db = await openDb();
  return new Promise((resolve) => {
    const out = [];
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').openKeyCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(out.sort().reverse()); return; }
      const k = String(cur.key);
      if (k.indexOf('snapshot-') === 0) out.push(k);
      cur.continue();
    };
    req.onerror = () => resolve(out.sort().reverse());
  });
}

async function saveSnapshot() {
  const pane = $('#reader-text');
  if (!pane || pane.classList.contains('hidden')) { showToast('Load an article first'); return; }
  try {
    const paras = [...pane.querySelectorAll('p')].map((p) => p.textContent).join('\n\n');
    if (!paras.trim()) { showToast('Nothing to save yet'); return; }
    const stamp = new Date().toISOString();
    const payload = JSON.stringify({
      app: 'Dual Dictionary', kind: 'reader-snapshot', savedAt: stamp,
      title: (document.title || 'Article').slice(0, 120),
      url: ($('#reader-url') && $('#reader-url').value) || '',
      text: paras,
    });
    await putFile('snapshot-' + stamp, new Blob([payload], { type: 'application/json' }));
    const keys = await listSnapshots(); // newest first
    for (const old of keys.slice(SNAPSHOT_KEEP)) { try { await delFile(old); } catch (e) { /* ignore */ } }
    showToast('Saved for offline reading');
  } catch (e) { showToast('Could not save the snapshot'); }
}

async function loadSnapshot(key) {
  let blob = null;
  try { blob = await getFile(key); } catch (e) { /* ignore */ }
  if (!blob) { showToast('Snapshot not found'); return; }
  try {
    const data = JSON.parse(await blob.text());
    $('#reader-input').value = data.text || '';
    if (data.url && $('#reader-url')) $('#reader-url').value = data.url;
    setReaderMsg((data.title ? '“' + data.title + '” — ' : '') + 'loaded from your offline snapshot.');
    readerRender(data.text || '', data.url ? 'snapshot: ' + (data.title || data.url) : 'snapshot');
  } catch (e) { showToast('Could not load the snapshot'); }
}

async function openSnapshots() {
  const list = $('#snapshots-list');
  if (!list) return;
  const keys = await listSnapshots();
  list.innerHTML = '';
  if (!keys.length) { list.innerHTML = '<p class="hint">No saved articles yet — load a page or paste text, then “💾 Save offline”.</p>'; }
  for (const k of keys) {
    const row = document.createElement('div');
    row.className = 'hist-row';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vocab-word';
    b.textContent = k.replace('snapshot-', '').replace('T', ' ').slice(0, 16);
    b.addEventListener('click', async () => {
      $('#snapshots-dialog')?.close();
      navigate('reader');
      await loadSnapshot(k);
    });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn-vocab-del'; del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete snapshot');
    del.addEventListener('click', async () => {
      try { await delFile(k); } catch (e) { /* ignore */ }
      openSnapshots();
    });
    row.append(b, del);
    list.appendChild(row);
  }
  $('#snapshots-dialog').showModal();
}

/* ================= v117 A2: known-words setup (plan A2, D1/D2/D6/D9) =================
 * The milestone ("I already know the top-N most common words") lives in the
 * IndexedDB `known` store — NOT in the vault — so a 1k–10k baseline never
 * touches the Vault UI, the stats denominators or the practice deck pools.
 * Each level stores its CUMULATIVE lemma list (every band up to its ceiling)
 * computed offline from the precached data/freq-en.json; levelling up is an
 * idempotent delta-add, ⚙ Advanced reset is the only way down. */

const KNOWN_LEVELS_META = {
  top1k: { n: 1000, band: '1k' },
  top2k: { n: 2000, band: '2k' },
  top5k: { n: 5000, band: '5k' },
  top10k: { n: 10000, band: '10k' },
};
const KNOWN_LEVEL_LABELS = { top1k: 'top 1k', top2k: 'top 2k', top5k: 'top 5k', top10k: 'top 10k' };

/** Cumulative headword list for a milestone: every entry of data/freq-en.json
 *  whose band is at or below the level's ceiling (bands are cumulative by
 *  construction: 1k ⊂ 2k ⊂ 5k ⊂ 10k). Offline — the map is precached. */
async function computeKnownLevelWords(levelId) {
  const meta = KNOWN_LEVELS_META[levelId];
  if (!meta) throw new Error('unknown known-level: ' + levelId);
  const map = await loadFreqMap();
  const words = [];
  for (const [w, band] of Object.entries(map)) {
    if (band === '1k' || band === '2k' || band === '5k' || band === '10k') {
      if (KNOWN_BAND_ORDER[band] <= KNOWN_BAND_ORDER[meta.band]) words.push(w);
    }
  }
  return words;
}
const KNOWN_BAND_ORDER = { '1k': 1, '2k': 2, '5k': 3, '10k': 4 };

/** Set one milestone (idempotent re-set of the same level), refresh the boot
 *  state, repaint the Vault empty state and the Advanced line. */
async function applyKnownLevel(levelId) {
  const words = await computeKnownLevelWords(levelId);
  await setKnownLevel(levelId, words);
  state.known = await knownState();
  renderKnownEmpty();
  renderKnownAdvanced();
  if (covLast) {
    const st = await covAnalyze();
    covRender();
    if (currentView() === 'reader') setReaderMsg(i18nFmt('cov.statusDone', { pct: st.pct, words: st.total }));
  }
  showToast(i18nFmt('known.setLevel', { n: KNOWN_LEVELS_META[levelId].n.toLocaleString('en-US') }));
}

/** ⚙ Advanced → Data: the known-words management block (plan D6). */
function renderKnownAdvanced() {
  const status = $('#known-adv-status');
  if (!status) return;
  const st = state.known;
  status.textContent = st && st.highest
    ? i18nFmt('known.advSet', { level: KNOWN_LEVEL_LABELS[st.highest], count: st.words.size.toLocaleString('en-US') })
    : i18n('known.advNone');
  // Plan D2/D6: levelling UP is an idempotent delta-add (each level stores its
  // cumulative list), so the chips stay live here; lower levels are disabled —
  // going down is a full reset, not a chip.
  const wrap = $('#known-adv-chips');
  if (wrap) {
    wrap.innerHTML = '';
    for (const id of Object.keys(KNOWN_LEVELS_META)) {
      const meta = KNOWN_LEVELS_META[id];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'btn-secondary known-chip';
      const current = st && st.highest === id;
      const lower = st && st.highest && KNOWN_LEVELS_META[id].n < KNOWN_LEVELS_META[st.highest].n;
      chip.textContent = i18nFmt('known.cta', { n: meta.n.toLocaleString('en-US') }) + (current ? ' · ' + i18n('known.current') : '');
      chip.disabled = !!current || !!lower;
      chip.addEventListener('click', () => { chip.disabled = true; applyKnownLevel(id).catch((e) => { console.warn('known level failed:', e); chip.disabled = false; }); });
      wrap.appendChild(chip);
    }
  }
  const btn = $('#known-adv-reset');
  if (!btn) return;
  btn.disabled = !(st && st.highest);
  if (!btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', resetKnownUi);
  }
}

async function resetKnownUi() {
  if (!confirm(i18n('known.resetConfirm'))) return;
  await resetKnown();
  state.known = await knownState();
  renderKnownAdvanced();
  renderKnownEmpty();
  if (covLast) {
    await covAnalyze();
    covRender();
    covApplyHighlight();
    if (currentView() === 'reader') setReaderMsg(i18n('cov.noEstimateStatus'));
  }
  showToast(i18n('known.resetDone'));
}

/** Vault empty state (plan D6): the milestone CTA lives exactly where an empty
 *  vault asks "what now?". A non-empty vault hides this block entirely — the
 *  management entry point stays in ⚙ Advanced. */
let knownEmptyBusy = false;
async function renderKnownEmpty() {
  if (knownEmptyBusy) return;
  knownEmptyBusy = true;
  try {
    const box = $('#known-empty-box');
    const line = $('#known-empty-status');
    if (!box || !line) return;
    const st = state.known;
    if (st && st.highest) {
      line.textContent = i18nFmt('known.status', { n: KNOWN_LEVELS_META[st.highest].n.toLocaleString('en-US'), count: st.words.size.toLocaleString('en-US') });
      box.classList.add('hidden');
      line.classList.remove('hidden');
      return;
    }
    line.textContent = '';
    line.classList.add('hidden');
    box.classList.remove('hidden');
    const wrap = $('#known-empty-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const id of Object.keys(KNOWN_LEVELS_META)) {
      const meta = KNOWN_LEVELS_META[id];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'btn-secondary known-chip';
      chip.textContent = i18nFmt('known.cta', { n: meta.n.toLocaleString('en-US') });
      chip.setAttribute('aria-label', i18nFmt('known.cta', { n: meta.n.toLocaleString('en-US') }));
      chip.addEventListener('click', () => { chip.disabled = true; applyKnownLevel(id).catch((e) => { console.warn('known level failed:', e); chip.disabled = false; }); });
      wrap.appendChild(chip);
    }
  } finally {
    knownEmptyBusy = false;
  }
}

/* ================= v118 A1: reading-coverage meter (plan A1, D3/D4/D5) =================
 * One classification pass per finished render, straight over the .rw spans that
 * readerRender already built (every reader source funnels through readerRender).
 * Classes: 1 known (A2 milestone ∪ vault 'known'), 2 learning (vault — wins over
 * the milestone so a saved word always reads as in-progress), 0 fresh. Numbers,
 * letter-less tokens and capitalized unknown proper nouns stay out of the sample
 * (plan D3). Passive UI: one card + a 3-way highlight toggle, never a gate (D5). */

const COV_EASY_PCT = 90;   // ≥ easy (plan D4)
const COV_HARD_PCT = 60;   // < hard (plan D4)
const COV_MAX_NEW = 20;    // newest-word list cap (plan D4)
const COV_BAND_ORDER = { '1k': 1, '2k': 2, '5k': 3, '10k': 4 };
let covLast = null;        // last finished analysis: { pct, known, learning, fresh, total, bands, newWords }
let covCache = new Map();  // raw token -> class, valid for the last analysis only

/* contractions → their function-word base (plan D3, the ~20-entry mini map) */
const COV_CONTRACTIONS = {
  "don't": 'do', "doesn't": 'do', "didn't": 'do', "won't": 'will', "wouldn't": 'would',
  "can't": 'can', 'cannot': 'can', "couldn't": 'could', "shouldn't": 'should',
  "isn't": 'is', "aren't": 'are', "wasn't": 'was', "weren't": 'were',
  "hasn't": 'has', "haven't": 'have', "hadn't": 'had',
  "it's": 'it', "that's": 'that', "there's": 'there', "what's": 'what', "who's": 'who',
  "let's": 'let', "i'm": 'i', "i've": 'i', "i'd": 'i', "i'll": 'i',
  "you're": 'you', "you've": 'you', "you'll": 'you', "we're": 'we', "we've": 'we',
  "they're": 'they', "they've": 'they', "he's": 'he', "she's": 'she',
};

function covStripToken(tok) {
  let w = String(tok || '').toLowerCase().replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/g, '');
  return COV_CONTRACTIONS[w] || w;
}

/** Class of one raw reader token against this render's reference maps.
 *  -1 = out of the sample (numbers, letter-less, skipped proper nouns). */
function covTokenClass(raw, refs) {
  const w = covStripToken(raw);
  if (!w || !/[a-z]/.test(w) || /[0-9]/.test(w)) return -1;
  const cands = [w, ...lemmaCandidates(w)];
  for (const c of cands) { if (refs.vaultMap.get(c) === 2) return 2; }   // learning beats everything
  for (const c of cands) {                                               // then known
    if (refs.vaultMap.get(c) === 1 || refs.knownSet.has(c)) return 1;
  }
  // proper-noun heuristic (plan D3): capitalized form AND no candidate in the
  // frequency map → treated as a name, out of the sample ("Aaron" IS in the
  // freq list, hence the card's "estimate" note).
  if (/^[A-Z][a-zA-Z]/.test(String(raw || '')) && !cands.some((c) => refs.freqMap[c])) return -1;
  return 0;
}

/** Band of a lemma chain, or null when outside the top-10k. */
function covBandOf(w, refs) {
  for (const c of [w, ...lemmaCandidates(w)]) {
    const b = refs.freqMap[c];
    if (b) return b;
  }
  return null;
}

/** The full analyze pass (one per render). 100% offline: freq-en.json is
 *  precached, vault + known-set are local. O(spans × ≤10 candidates) on Sets. */
async function covAnalyze() {
  const refs = {
    vaultMap: new Map(),
    knownSet: (state.known && state.known.words) || new Set(),
    freqMap: await loadFreqMap(),
  };
  for (const it of state.items || []) {
    if (it.type !== 'word') continue;
    const key = it.normalizedText || String(it.text || '').toLowerCase().trim();
    if (!key) continue;
    if (!refs.vaultMap.has(key)) refs.vaultMap.set(key, it.userData && it.userData.status === 'known' ? 1 : 2);
  }
  covCache = new Map();
  const t0 = performance.now();
  const st = { total: 0, known: 0, learning: 0, fresh: 0, bands: { '1k': 0, '2k': 0, '5k': 0, '10k': 0 }, newWords: [] };
  const freshSeen = new Set();
  const freshRanked = [];
  const spans = document.querySelectorAll('#reader-text .rw');
  for (const span of spans) {
    const raw = span.dataset.word || '';
    let cls = covCache.get(raw);
    if (cls === undefined) { cls = covTokenClass(raw, refs); covCache.set(raw, cls); }
    if (cls === -1) continue;
    st.total++;
    if (cls === 1) st.known++; else if (cls === 2) st.learning++;
    const w = covStripToken(raw);
    const band = covBandOf(w, refs);
    if (band) st.bands[band]++;
    if (cls === 0 && !freshSeen.has(w) && freshSeen.size < 500) {
      freshSeen.add(w);
      freshRanked.push({ w, rank: band ? COV_BAND_ORDER[band] : 9 });
    }
  }
  st.pct = st.total ? Math.round((100 * st.known) / st.total) : 0;
  st.newWords = freshRanked.sort((a, b) => a.rank - b.rank).slice(0, COV_MAX_NEW).map((x) => x.w);
  st.ms = Math.round(performance.now() - t0);
  document.documentElement.dataset.covMs = String(st.ms); // smoke hook: classify cost
  covLast = st;
  return st;
}

/** Called from readerRender's final batch (with the render's seq so a newer
 *  render can supersede this pass). Analyzes, paints the card, applies the
 *  highlight, and rewrites the done status line with the % (plan D5). */
async function covOnRenderDone(seq) {
  if (seq !== readerRenderSeq) return;
  try {
    const st = await covAnalyze();
    if (seq !== readerRenderSeq) return;
    covRender();
    const tb = document.getElementById('btn-cov-hl');
    if (tb) tb.classList.toggle('is-off', localStorage.getItem('cov-highlight') === 'off');
    covApplyHighlight();
    if (st.total > 0) setReaderMsg(state.known?.highest
      ? i18nFmt('cov.statusDone', { pct: st.pct, words: st.total })
      : i18n('cov.noEstimateStatus'));
  } catch (e) { console.warn('coverage analysis failed:', e); }
}

/** The passive coverage card (plan D5): % + tone word, three band bars, the
 *  hard-text warning, the first ≤20 fresh words (lowest band first) and the
 *  estimate note. One element, rebuilt per render, i18n repainted by applyLang. */
function covRender() {
  const card = document.getElementById('cov-card');
  if (!card) return;
  if (!covLast) { card.classList.add('hidden'); card.innerHTML = ''; return; }
  const st = covLast;
  if (!(state.known && state.known.highest)) {
    card.dataset.tone = 'unknown';
    card.innerHTML = '<p class="cov-note hint">' + escapeHtml(i18n('cov.noEstimate')) + '</p>' +
      '<p class="cov-baseline-label">' + escapeHtml(i18n('cov.chooseBaseline')) + '</p>';
    const choices = document.createElement('div');
    choices.className = 'cov-baseline-choices';
    for (const id of Object.keys(KNOWN_LEVELS_META)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-secondary known-chip';
      button.textContent = i18nFmt('known.cta', { n: KNOWN_LEVELS_META[id].n.toLocaleString('en-US') });
      button.addEventListener('click', () => {
        button.disabled = true;
        applyKnownLevel(id).catch((error) => {
          console.warn('known level failed:', error);
          button.disabled = false;
        });
      });
      choices.appendChild(button);
    }
    card.appendChild(choices);
    card.classList.remove('hidden');
    const toolbarToggle = document.getElementById('btn-cov-hl');
    if (toolbarToggle) { toolbarToggle.disabled = true; toolbarToggle.title = i18n('cov.noEstimate'); }
    covApplyHighlight();
    return;
  }
  const tone = st.pct >= COV_EASY_PCT ? 'easy' : st.pct >= COV_HARD_PCT ? 'mid' : 'hard';
  const hlOn = localStorage.getItem('cov-highlight') !== 'off';
  const bar = (band, labelKey, n) =>
    '<div class="cov-bar" data-band="' + band + '">' +
      '<span class="cov-bar-label">' + escapeHtml(i18n(labelKey)) + '</span>' +
      '<span class="cov-bar-track"><span class="cov-bar-fill" style="width:' + (st.total ? Math.round((100 * n) / st.total) : 0) + '%"></span></span>' +
      '<span class="cov-bar-num">' + n + '</span></div>';
  card.dataset.tone = tone;
  const milestoneHint = !(state.known && state.known.highest)
    ? '<p class="cov-milestone hint"><a href="#/vault">' + escapeHtml(i18n('cov.noMilestone')) + '</a></p>'
    : '';
  card.innerHTML =
    milestoneHint +
    '<div class="cov-head">' +
      '<span class="cov-pct">' + st.pct + '%</span>' +
      '<span class="cov-word">' + escapeHtml(i18nFmt('cov.knownOf', { known: st.known, total: st.total })) + '</span>' +
      '<span class="cov-tone">' + escapeHtml(i18n(tone === 'easy' ? 'cov.easy' : tone === 'mid' ? 'cov.mid' : 'cov.hard')) + '</span>' +
      '<button type="button" id="cov-toggle" class="btn-secondary cov-toggle' + (hlOn ? '' : ' is-off') +
        '" aria-pressed="' + hlOn + '">' + escapeHtml(i18n('cov.highlight')) + '</button>' +
    '</div>' +
    '<div class="cov-bars">' +
      bar('1k', 'cov.band1k', st.bands['1k']) + bar('2k', 'cov.band2k', st.bands['2k']) +
      bar('5k', 'cov.band5k', st.bands['5k']) + bar('10k', 'cov.band10k', st.bands['10k']) +
    '</div>' +
    (tone === 'hard' ? '<p class="cov-warn">' + escapeHtml(i18n('cov.hardWarn')) + '</p>' : '') +
    (st.newWords.length ? '<p class="cov-new hint"><strong>' + escapeHtml(i18n('cov.newHead')) + '</strong> ' +
      escapeHtml(st.newWords.join(', ')) + '</p>' : '') +
    '<p class="cov-note hint">' + escapeHtml(i18n('cov.estimateNote')) + '</p>';
  card.classList.remove('hidden');
  const toolbarToggle = document.getElementById('btn-cov-hl');
  if (toolbarToggle) { toolbarToggle.disabled = false; toolbarToggle.title = i18n('cov.hlTitle'); }
  document.getElementById('cov-toggle')?.addEventListener('click', covToggleHighlight);
}

/** Highlight toggle (plan D5): default ON, persisted in localStorage; both the
 *  toolbar button and the card's button stay in sync. */
function covToggleHighlight() {
  if (!(state.known && state.known.highest)) {
    setReaderMsg(i18n('cov.noEstimateStatus'));
    return;
  }
  const turningOn = localStorage.getItem('cov-highlight') === 'off';
  localStorage.setItem('cov-highlight', turningOn ? 'on' : 'off');
  covApplyHighlight();
  for (const sel of ['#cov-toggle', '#btn-cov-hl']) {
    const b = document.querySelector(sel);
    if (b) { b.classList.toggle('is-off', !turningOn); if (sel === '#cov-toggle') b.setAttribute('aria-pressed', String(turningOn)); }
  }
}

/** Apply (or clear) the three-way highlight over the current spans. */
function covApplyHighlight() {
  const pane = document.getElementById('reader-text');
  if (!pane) return;
  const spans = pane.querySelectorAll('.rw');
  if (!(state.known && state.known.highest) || localStorage.getItem('cov-highlight') === 'off') {
    pane.classList.remove('cov-hl');
    spans.forEach((el) => el.classList.remove('cov-k', 'cov-l', 'cov-n'));
    return;
  }
  pane.classList.add('cov-hl');
  spans.forEach((el) => {
    const cls = covCache.get(el.dataset.word);
    el.classList.remove('cov-k', 'cov-l', 'cov-n');
    if (cls === 1) el.classList.add('cov-k');
    else if (cls === 2) el.classList.add('cov-l');
    else if (cls === 0) el.classList.add('cov-n');
  });
}

/* ================= Phase 5-B: word-frequency bands (open data) ================= */
let freqMapPromise = null;
function loadFreqMap() {
  if (!freqMapPromise) {
    freqMapPromise = fetch('data/freq-en.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  }
  return freqMapPromise;
}
async function freqBand(word) {
  const key = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return null;
  const map = await loadFreqMap();
  return map[key] || null;
}

/* ================= Phase 5-A: bookmarklet / external handoff ================= */
function handleUrlHandoff() {
  try {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const rd = params.get('read');
    if (rd) {
      navigate('reader');
      $('#reader-input').value = rd;
      readerRender(rd, 'shared');
    } else if (q) {
      search(q);
    }
  } catch (e) { /* ignore */ }
}

/* ================= Phase 5-C: practice depth (recall, hint, streak) ================= */
function markPracticeDay() {
  try {
    const days = JSON.parse(localStorage.getItem('practice-days') || '[]');
    const today = new Date().toISOString().slice(0, 10);
    if (days.indexOf(today) === -1) {
      days.push(today);
      localStorage.setItem('practice-days', JSON.stringify(days.slice(-400)));
    }
  } catch (e) { /* ignore */ }
}
/* WOTD 07/11 (giữ chân): 1 từ/ngày theo level user, streak có sẵn.
 * Level từ quiz trong app (localStorage dd-level) hoặc exam-tags CEFR B1 mặc định. */
async function wordOfDay() {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const cached = JSON.parse(localStorage.getItem('wotd') || '{}');
    if (cached.day === day && cached.word) return cached;
  } catch (e) {}
  const lvl = (localStorage.getItem('dd-level') || 'B1').toUpperCase();
  const pick = { A2: 'ngsl1', B1: 'ngsl2', B2: 'ielts', C1: 'awl' }[lvl] || 'ngsl2';
  let word = 'abandon', ipa = '', gloss = '';
  try {
    const bw = await loadBuiltWords();
    if (bw && bw.words) {
      if (typeof examTagSet === 'undefined' || !examTagSet) { try { examTagSet = await loadExamTags(); } catch (e) {} }
      const pool = deckWords(pick, bw.words).filter((w) => !isSaved(w));
      if (pool.length) {
        let h = 0; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        word = pool[h % pool.length];
      }
    }
    try { gloss = await quickGloss(word) || ''; } catch (e) {}
    try { ipa = ((await ipaForWord(word))[0]) || ''; } catch (e) {}
  } catch (e) {}
  const out = { day, word, ipa, gloss };
  try { localStorage.setItem('wotd', JSON.stringify(out)); } catch (e) {}
  return out;
}
async function renderWotd() {
  const el = document.getElementById('wotd-card');
  if (!el) return;
  const w = await wordOfDay();
  const streak = practiceDayStreak();
  el.innerHTML = '<strong>📅 Từ hôm nay: ' + escapeHtml(w.word) + '</strong>' +
    (w.ipa ? ' <span class="hint">/' + escapeHtml(w.ipa) + '/</span>' : '') +
    (w.gloss ? '<br><span>' + escapeHtml(w.gloss.slice(0, 80)) + '</span>' : '') +
    '<br><span class="hint">🔥 Streak ' + streak + ' ngày · ' +
    '<a href="#" id="wotd-practice">Luyện ngay</a> · ' +
    '<a href="#" id="wotd-quiz">Quiz Vault</a> · ' +
    '<a href="#" id="wotd-level">Test trình độ</a></span>';
  const p1 = document.getElementById('wotd-practice');
  if (p1) p1.addEventListener('click', (e) => { e.preventDefault(); startCurriculumPractice('ngsl2'); navigate('practice'); });
  const p2 = document.getElementById('wotd-quiz');
  if (p2) p2.addEventListener('click', (e) => { e.preventDefault(); startVaultQuiz('choice'); });
  const p3 = document.getElementById('wotd-level');
  if (p3) p3.addEventListener('click', (e) => { e.preventDefault(); startLevelTest(); });
}
function practiceDayStreak() {
  try {
    const days = JSON.parse(localStorage.getItem('practice-days') || '[]').sort();
    if (!days.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last = days[days.length - 1];
    if (last !== today && last !== yest) return 0;
    let streak = 1;
    let d = last;
    for (let i = days.length - 2; i >= 0; i--) {
      const prev = new Date(new Date(d).getTime() - 86400000).toISOString().slice(0, 10);
      if (days[i] === prev) { streak++; d = prev; } else break;
    }
    return streak;
  } catch (e) { return 0; }
}

/* ================= Phase 5-H: E2E-encrypted backup (AES-256-GCM) ================= */
/* Container format:
 *   v2 (current): { v:2, kdf:'PBKDF2-SHA256', iter:<n>, salt, iv, data }
 *   v1 (legacy, pre-2026-09): { v:1, salt, iv, data } — 150000 iterations, no
 *   iteration count in the file. Reading code MUST keep accepting these: the
 *   count is unknown to the file, so v1 (and anything without an `iter` field)
 *   decodes with the historical 150000. The iteration count is never baked into
 *   the ciphertext, so raising it going forward does not invalidate old files. */
const PBKDF2_ITER = 600000;       // current default for NEW backups
const PBKDF2_ITER_LEGACY = 150000; // files written before the count was stored
function b64ToBytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function bytesToB64(u) { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
async function pbkdf2Key(pass, salt, iterations = PBKDF2_ITER) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptString(plain, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await pbkdf2Key(pass, salt, PBKDF2_ITER);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return JSON.stringify({ v: 2, kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ct)) });
}
/** Iteration count to use for a container: the value stored in the file when it
 *  has one, otherwise the historical 150000 for legacy (v1 / pre-iter) files. */
function containerIterations(o) {
  const n = parseInt(o && o.iter, 10);
  return Number.isFinite(n) && n > 0 ? n : PBKDF2_ITER_LEGACY;
}
async function decryptString(wrap, pass, iterations) {
  const o = (typeof wrap === 'string') ? JSON.parse(wrap) : wrap;
  const key = await pbkdf2Key(pass, b64ToBytes(o.salt), iterations || containerIterations(o));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(o.iv) }, key, b64ToBytes(o.data));
  return new TextDecoder().decode(pt);
}

let passResolve = null;
function askPassphrase(label) {
  return new Promise((resolve) => {
    const lbl = $('#crypto-label'); if (lbl) lbl.textContent = label;
    const inp = $('#crypto-pass'); if (inp) inp.value = '';
    passResolve = resolve;
    $('#crypto-dialog').showModal();
  });
}
async function exportEncrypted() {
  try {
    const pass = await askPassphrase(i18n('crypto.passNew'));
    if (!pass) return;
    const items = await allItems();
    const tutor = await tutorRecordsForExport();
    const study = await exportOfflineStudy();
    if (!items.length && !tutor.length && !study.length) { showToast('Nothing to back up yet'); return; }
    const known = await knownRecordsForExport();
    const payload = JSON.stringify({ app: 'Dual Dictionary', version: 3, encryptedAt: new Date().toISOString(), items, known, tutor, study });
    const wrap = await encryptString(payload, pass);
    downloadBlob(new Blob([wrap], { type: 'application/octet-stream' }), 'dual-dictionary-backup-' + new Date().toISOString().slice(0, 10) + '.ddbackup');
    showToast('Encrypted off-device backup downloaded (' + items.length + ' items) — keep it somewhere else than this device');
  } catch (e) { showToast('Encryption failed — this browser may not support Web Crypto'); }
}
async function importEncryptedFile(file) {
  try {
    const pass = await askPassphrase(i18n('crypto.passOpen'));
    if (!pass) return;
    const wrap = await file.text();
    const env = JSON.parse(wrap); // container: { v, iter?, salt, iv, data }
    // Files written from now on carry their iteration count; anything older
    // (v1, or no `iter` field) was produced with the historical 150000.
    const json = JSON.parse(await decryptString(wrap, pass, containerIterations(env)));
    const res = await importItems(json);
    const tutorAdded = await importTutorRecords(json);
    const studyAdded = await importOfflineStudy(json.study);
    state.items = await allItems();
    try { state.known = await knownState(); } catch (e) { /* keep previous */ }
    updateVocabBadge(); updateReviewBadge(); renderVault();
    showToast('Restored ' + res.added + ' item' + (res.added === 1 ? '' : 's') + ' — ' + res.skipped + ' duplicate' + (res.skipped === 1 ? '' : 's') + ' skipped' + (tutorAdded ? ` + ${tutorAdded} tutor session${tutorAdded===1?'':'s'}` : ''));
  } catch (e) {
    console.warn('encrypted import failed:', e);
    showToast(i18n('crypto.failed'));
  }
}
