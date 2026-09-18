import { MDict } from './mdict.js';
import { putFile, getFile, delFile } from './db.js';

const SLOTS = {
  // Slot keys are historical (oxford/longman) — the LABELS below must name the
  // open-licensed dictionaries actually bundled in a public deployment, never
  // trademarks of data the app does not ship.
  oxford: { label: 'WordNet', accent: '#b91c1c' },
  longman: { label: 'Wiktionary', accent: '#1d4ed8' },
};

const state = {
  dicts: { oxford: null, longman: null }, // {mdx, mdd, cssCache, blobUrls}
  loading: { oxford: false, longman: false }, // a download is currently in progress for this slot
  history: JSON.parse(localStorage.getItem('history') || '[]'),
  vocab: JSON.parse(localStorage.getItem('vocab') || '[]'), // [{word, box, due, addedAt}]
  sentences: JSON.parse(localStorage.getItem('sentences') || '[]'), // [{word, sentence, source, addedAt}]
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

/** Human progress line with CORRECT units, e.g. "30% (531.9 MB of 1.72 GB) · 2.4 MB/s · ≈ 9 min left" */
function fmtProgress(slot, received, total) {
  const { speed, eta } = trackProgress(slot, received, total);
  let out = total ? Math.round((received / total) * 100) + '%' : '';
  out += ` (${fmtSize(received)}${total ? ' of ' + fmtSize(total) : ''})`;
  if (speed > 0 && received > 0) out += ` · ${(speed / 1048576).toFixed(1)} MB/s`;
  const e = fmtEta(eta);
  if (e) out += ` · ${e}`;
  return out;
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
const SRS_INTERVALS_DAYS = [1, 2, 4, 9, 20, 45]; // Leitner-style box → days until next review

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  wireUi();
  $('#btn-open-help')?.addEventListener('click', () => $('#help-dialog').showModal());
  $('#btn-open-advanced')?.addEventListener('click', () => $('#advanced-dialog').showModal());
  $('#btn-quickload')?.addEventListener('click', quickLoadOpenDicts);
  $('#btn-cancel-load')?.addEventListener('click', () => loadAbort?.abort());
  document.querySelectorAll('dialog .dialog-close').forEach((b) => {
    b.addEventListener('click', () => b.closest('dialog').close());
  });
  renderHistory();
  updateVocabBadge();
  setView(localStorage.getItem('view') || 'both');

  // migration: replace stale bundled dictionaries with the current build
  // (keeps files the user loaded themselves untouched)
  if ((await getBundleVer()) < BUNDLE_DATA_VERSION) {
    for (const slot of Object.keys(SLOTS)) {
      const mdx = await getFile(slot + '-mdx');
      if (!mdx || !BUNDLED_NAMES.includes(mdx.name)) continue;
      await delFile(slot + '-mdx');
      await delFile(slot + '-mdd');
      await delFile(slot + '-css');
      await delFile(slot + '-mdx-meta');
      state.dicts[slot] = null;
      setStatus(slot, 'updating bundled dictionary…');
      await quickLoadOne(slot, DEFAULT_DICTS[slot]);
    }
    await putFile('bundle-version', new Blob([String(BUNDLE_DATA_VERSION)], { type: 'text/plain' }));
  }

  // restore persisted dictionaries
  for (const slot of Object.keys(SLOTS)) {
    if (state.dicts[slot]) continue; // already loaded by the migration above
    const mdx = await getFile(slot + '-mdx');
    if (!mdx) continue;
    const mdd = await getFile(slot + '-mdd');
    try {
      await attachDict(slot, mdx, mdd, { persist: false });
    } catch (e) {
      console.error(e);
      setStatus(slot, 'reload error: ' + e.message);
    }
  }

  // first-ever visit: nothing loaded at all — do NOT silently start a multi-GB
  // download. Probe sizes and let the user start it explicitly (with Cancel).
  if (Object.keys(SLOTS).every((s) => !state.dicts[s])) {
    await showFirstLoadGate();
  }

  checkStorageHealth();
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
    suggest(input.value);
  });
  input.addEventListener('blur', () => setTimeout(() => $('#suggestions').classList.add('hidden'), 150));
  input.addEventListener('keydown', onSearchKeydown);
  $('#btn-clear').addEventListener('click', () => {
    input.value = '';
    $('#btn-clear').classList.add('hidden');
    $('#btn-speak').disabled = true;
    $('#btn-save-word').disabled = true;
    $('#suggestions').classList.add('hidden');
    input.focus();
  });
  $('#btn-speak').addEventListener('click', () => speak(input.value.trim()));
  $('#btn-save-word').addEventListener('click', () => toggleSaveWord(input.value.trim()));
  $('#btn-vocab')?.addEventListener('click', () => { renderVocab(); renderSentences(); $('#vocab-dialog').showModal(); });
  $('#vocab-export')?.addEventListener('click', exportVocab);
  $('#btn-clear-history')?.addEventListener('click', clearHistory);
  $('#btn-reader')?.addEventListener('click', openReader);
  $('#btn-envi-empty')?.addEventListener('click', loadEnViDictionary);
  $('#btn-envi-adv')?.addEventListener('click', loadEnViDictionary);
  $('#btn-reader-close')?.addEventListener('click', closeReader);
  $('#btn-reader-start')?.addEventListener('click', startReading);
  $('#btn-reader-load')?.addEventListener('click', loadReaderUrl);
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
  $('#btn-advanced')?.addEventListener('click', () => $('#advanced-dialog').showModal());
  $('#btn-help')?.addEventListener('click', () => $('#help-dialog').showModal());
  $('#vocab-dialog')?.addEventListener('click', onVocabAction); // covers vocab-list AND sentences-list
  if (!TTS_SUPPORTED) {
    const b = $('#btn-speak');
    if (b) { b.title = 'Text-to-speech is not supported by this browser'; }
  }
  $('#btn-dismiss-storage')?.addEventListener('click', () => {
    $('#storage-banner').classList.add('hidden');
    sessionStorage.setItem('storage-banner-dismissed', '1');
  });
  $('#url-load-oxford')?.addEventListener('click', () => loadFromUrl('oxford', $('#url-oxford').value));
  $('#url-load-longman')?.addEventListener('click', () => loadFromUrl('longman', $('#url-longman').value));
  document.querySelectorAll('.panel-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeDict(btn.dataset.slot));
  });
  document.querySelectorAll('#view-switch button').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.querySelectorAll('.panel-toggle').forEach((btn) => {
    btn.addEventListener('click', () => toggleReading(btn.dataset.slot));
  });
  window.addEventListener('resize', () => setView(localStorage.getItem('view') || 'both'));
}

/* ---- mobile view switch (WordNet | Wiktionary | both) ---- */
function setView(view) {
  document.querySelectorAll('#view-switch button').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  for (const slot of Object.keys(SLOTS)) {
    $('#panel-' + slot).classList.toggle('collapsed', view !== 'both' && view !== slot);
  }
  // On mobile, "Both" stacks the panels: tell the user the second one is below the fold.
  const hint = $('#both-hint');
  if (hint) {
    const show = view === 'both' && window.matchMedia('(max-width: 899.5px)').matches;
    hint.classList.toggle('hidden', !show);
    if (show) hint.textContent = `↓ ${state.dicts.longman
      ? (document.querySelector('#panel-longman .dict-name')?.textContent || 'Wiktionary')
      : 'Wiktionary'} results continue below`;
  }
  localStorage.setItem('view', view);
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
  setStatus(slot, `${label} ${name} — ${fmtProgress(slot, 0, total)}`, true);
  const blob = await readResponseWithProgress(resp, (received) => {
    setStatus(slot, `${label} ${name} — ${fmtProgress(slot, received, total)}`, true);
  });
  return new File([blob], name);
}

/** Load one bundled dictionary (mdx + optional mdd/css) into a slot, with progress + persistence.
 *  The .mdx is attached as soon as it arrives so the slot is searchable while the
 *  (much larger) .mdd resources are still downloading. */
async function quickLoadOne(slot, def, signal) {
  state.loading[slot] = true;
  try {
    const mdxFile = await fetchBundledFile(slot, def.url, def.name, 'loading', signal);
    await putFile(slot + '-mdx', mdxFile);
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
      setStatus(slot, 'Download cancelled');
      return;
    }
    console.error(e);
    // bundled defaults missing (public deploy without dicts/) → try the free
    // fallback as last resort
    const fb = FALLBACK_DICTS[slot];
    if (fb && def !== fb) {
      try {
        await quickLoadOne(slot, fb);
        setStatus(slot, 'open-licensed dictionary loaded — use ⚙ Advanced to load your own .mdx files');
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
  }
}

/** Quick-load the bundled default dictionaries (fetched from dicts/), cancellable. */
async function quickLoadOpenDicts() {
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
  // Name what will REALLY load: probe the sources first so a public deployment
  // (no dicts/ data) shows the open-licensed fallback name instead of promising
  // a commercial dictionary it does not ship.
  const probed = await probeDictionarySizes(signal).catch(() => null);
  const labelOf = (slot) => {
    const def = DEFAULT_DICTS[slot];
    const src = probed?.per?.[slot]?.source;
    if (src === 'default') return def.label;
    const fb = FALLBACK_DICTS[slot];
    if (fb && (src === 'open' || src === 'unknown')) {
      return FRIENDLY_TITLES[fb.name] || SLOTS[slot]?.label || def.label;
    }
    return def.label;
  };
  for (const [slot, def] of Object.entries(DEFAULT_DICTS)) {
    if (signal.aborted) { cancelled = true; break; }
    const other = Object.keys(DEFAULT_DICTS).find((s) => s !== slot);
    const otherLabel = labelOf(other);
    msgText = state.dicts[other]
      ? `Preparing ${labelOf(slot)} — you can search ${otherLabel} while this finishes.`
      : `Loading ${labelOf(slot)}… (one-time download, then stored offline)`;
    if (msg) msg.textContent = msgText;
    await quickLoadOne(slot, def, signal);
    if (!state.dicts[slot]) failed.push(labelOf(slot));
  }
  loadAbort = null;
  progressTrackers.clear();
  if (cancelBtn) cancelBtn.classList.add('hidden');
  if (btn) {
    btn.disabled = false;
    btn.textContent = failed.length
      ? '↻ Retry dictionary download'
      : `⬇ Download dictionaries${firstLoadTotal ? ` (≈ ${fmtSize(firstLoadTotal)})` : ''}`;
  }
  if (msg) msg.textContent = 'Loading the default dictionaries…';
  if (cancelled) {
    if (msg) msg.textContent = 'Download cancelled — no dictionary is loaded yet.';
    if (err) {
      err.textContent = 'Press “↻ Retry dictionary download” to try again, or use your own .mdx files via ⚙ Advanced.';
      err.hidden = false;
    }
  } else if (failed.length) {
    dataUnreachable = failed.length === Object.keys(DEFAULT_DICTS).length;
    if (msg) msg.textContent = 'Could not load the default dictionaries.';
    if (err) {
      err.textContent = `Failed to load: ${failed.join(', ')}. Check your connection and try again, ` +
        'or open ⚙ Advanced to load your own .mdx files.';
      err.hidden = false;
    }
  } else {
    showToast('Dictionaries loaded — you can search now.');
  }
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
async function probeDictionarySizes(signal) {
  const per = {};
  let total = 0;
  for (const slot of Object.keys(DEFAULT_DICTS)) {
    const def = DEFAULT_DICTS[slot];
    let bytes = 0;
    let source = 'unknown';
    for (const url of [def.url, def.mddUrl].filter(Boolean)) {
      const h = await headProbe(url, signal);
      if (h) { bytes += +h.headers.get('content-length') || 0; source = 'default'; }
    }
    if (!bytes) {
      const fb = FALLBACK_DICTS[slot];
      if (fb) {
        const h = await headProbe(fb.url, signal);
        if (h) { bytes = +h.headers.get('content-length') || 0; source = 'open'; }
      }
    }
    per[slot] = { bytes, source };
    total += bytes;
  }
  return { per, total };
}

/** First-ever visit: do NOT start a download silently. Show the real size, which
 *  dictionaries will load, and an explicit Start / Cancel choice. */
async function showFirstLoadGate() {
  const msg = $('#empty-state-msg');
  const btn = $('#btn-quickload');
  const err = $('#empty-state-error');
  const list = $('#first-load-sizes');
  if (btn) btn.disabled = true;
  if (msg) msg.textContent = 'Checking dictionary sizes…';
  if ($('#empty-state')) $('#empty-state').classList.remove('hidden');
  const { per, total } = await probeDictionarySizes();
  firstLoadTotal = total;
  if (list) {
    list.innerHTML = '';
    for (const slot of Object.keys(DEFAULT_DICTS)) {
      const info = per[slot];
      const def = DEFAULT_DICTS[slot];
      const openName = (FALLBACK_DICTS[slot] && FRIENDLY_TITLES[FALLBACK_DICTS[slot].name]) || def.label;
      const li = document.createElement('li');
      li.textContent = `${info.source === 'open' ? openName : def.label}: ` +
        (info.bytes ? `≈ ${fmtSize(info.bytes)}` : 'size unknown (usually a few GB)');
      list.appendChild(li);
      // Public edition: the open dictionary IS the default — label the panel now
      // so even the pre-load state shows the real source, never a false promise.
      if (info.source === 'open' && FALLBACK_DICTS[slot]) {
        const nameEl = document.querySelector(`#panel-${slot} .dict-name`);
        if (nameEl) {
          nameEl.textContent = openName;
          nameEl.title = `${openName}\nSource file: ${FALLBACK_DICTS[slot].name}`;
        }
      }
    }
  }
  if (total) {
    dataUnreachable = false;
    if (msg) {
      const openScale = total < 104857600;
      msg.textContent = `A one-time download of about ${fmtSize(total)}${openScale ? ' (open-licensed dictionaries — free for everyone)' : ''} — after that, everything works offline.`;
    }
    if (btn) {
      btn.textContent = `⬇ Download dictionaries (≈ ${fmtSize(total)})`;
      btn.disabled = false;
    }
  } else {
    // Probe found no reachable source — do NOT promise a download that cannot
    // happen. Say so, keep the buttons working, and label the CTA as a retry.
    dataUnreachable = true;
    if (msg) msg.textContent = 'No dictionary data is reachable from this deployment.';
    if (err) {
      err.textContent = 'The bundled download sources did not respond. Press “↻ Retry dictionary download” to try again, ' +
        'or use “Use my own .mdx files” below to load a dictionary manually.';
      err.hidden = false;
    }
    if (btn) {
      btn.textContent = '↻ Retry dictionary download';
      btn.disabled = false;
    }
  }
}

/** Remove a dictionary from a slot (IndexedDB + UI) and restore the bundled default. */
async function removeDict(slot) {
  if (!confirm('Remove this dictionary and restore the default one?')) return;
  await delFile(slot + '-mdx');
  await delFile(slot + '-mdd');
  await delFile(slot + '-css');
  await delFile(slot + '-mdx-meta');
  state.dicts[slot] = null;
  setStatus(slot, 'not loaded');
  $('#frame-' + slot).hidden = true;
  const nameEl = document.querySelector(`#panel-${slot} .dict-name`);
  if (nameEl) nameEl.textContent = slot === 'oxford' ? 'WordNet 3.1' : 'Simple English Wiktionary';
  const def = DEFAULT_DICTS[slot];
  if (def) await quickLoadOne(slot, def);
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  $('#empty-state').classList.toggle('hidden', anyLoaded);
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
      setStatus(slot, `${label} ${name} — ${fmtProgress(slot, 0, total)}`, true);
      const blob = await readResponseWithProgress(resp, (received) => {
        setStatus(slot, `${label} ${name} — ${fmtProgress(slot, received, total)}`, true);
      });
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
      if (kind === 'mdx') await delFile(slot + '-mdx-meta').catch(() => {});
    } catch (storageErr) {
      alert('Could not save to device storage: ' + storageErr.message +
        ' — try loading only the .mdx (without .mdd), or a smaller file.');
      return;
    }
    const existing = state.dicts[slot];
    await attachDict(
      slot,
      kind === 'mdx' ? file : existing?.mdxBlob ?? (await getFile(slot + '-mdx')),
      kind === 'mdd' ? file : existing?.mddBlob ?? (await getFile(slot + '-mdd')),
      { persist: false }
    );
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
  const entry = { mdx, mdd, mdxBlob, mddBlob, blobUrls: new Map(), cssCache: new Map(), bundledCss };
  state.dicts[slot] = entry;

  // Always show which dictionary is REALLY in the slot. On a public deployment
  // the open-licensed dictionaries ARE the default, never a "fallback".
  const display = dictDisplayName(mdx);
  const nameEl = document.querySelector(`#panel-${slot} .dict-name`);
  if (nameEl) {
    nameEl.textContent = display;
    nameEl.title = `${display}\nSource file: ${mdx.name}`;
  }
  const frame = $('#frame-' + slot);
  frame.hidden = false;
  frame.querySelector('iframe').title = `${display} entry`;
  frame.querySelector('iframe').srcdoc = welcomeDoc(slot); // no dead white panel before the first search
  setStatus(slot, `${mdx.numEntries.toLocaleString('en-US')} entries`);
  $('#empty-state').classList.add('hidden');

  // build key list in background for autocomplete
  mdx.loadAllKeys().catch(() => {});
}

function cleanTitle(t) {
  const ta = document.createElement('textarea');
  ta.innerHTML = String(t || '');
  return ta.value.replace(/<[^>]+>/g, '').trim() || 'Dictionary';
}

// Friendly display names for known files — the raw .mdx title metadata is
// unreliable (it can be empty, a file name like "oald10.mdx", or very long).
const FRIENDLY_TITLES = {
  'oald10.mdx': 'Oxford Advanced Learner’s Dictionary (10th ed.)',
  'ldoce6.mdx': 'Longman Dictionary of Contemporary English (6th ed.)',
  'wordnet31.mdx': 'WordNet 3.1 (Princeton)',
  'simple-en.mdx': 'Simple English Wiktionary (CC BY-SA 4.0)',
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

/* ---------------- search ---------------- */
async function search(word) {
  $('#search-input').value = word;
  $('#btn-clear').classList.toggle('hidden', !word);
  $('#btn-speak').disabled = !word.trim() || !TTS_SUPPORTED;
  $('#btn-save-word').disabled = !word.trim();
  updateSaveButtonState();
  $('#suggestions').classList.add('hidden');
  pushHistory(word);
  // Guard: never search "silently". If nothing is loaded, either show the
  // first-run panel (with a working CTA) or a "still loading" state — never a
  // dead end that points at a disabled button.
  const anyLoaded = Object.keys(SLOTS).some((s) => state.dicts[s]);
  const anyLoading = Object.keys(SLOTS).some((s) => state.loading[s]);
  const emptyState = $('#empty-state');
  if (!anyLoaded && !anyLoading && emptyState) {
    emptyState.classList.remove('hidden');
    if (dataUnreachable) {
      // The user searched while no data source is reachable — replace the
      // stale "one-time download" promise with the honest state + working CTAs.
      const msg = $('#empty-state-msg');
      const err = $('#empty-state-error');
      if (msg) msg.textContent = 'No dictionary data is loaded — the download sources are unreachable.';
      if (err) {
        err.textContent = 'Press “↻ Retry dictionary download” to try again, or use “Use my own .mdx files” to load a dictionary manually.';
        err.hidden = false;
      }
    }
  }
  await Promise.all(Object.keys(SLOTS).map((slot) => renderSlot(slot, word)));
}

async function renderSlot(slot, word) {
  const d = state.dicts[slot];
  const frame = $('#frame-' + slot);
  if (!d) {
    const loading = state.loading[slot];
    setStatus(slot, loading ? 'still loading…' : 'not loaded');
    // Make the missing/loading dictionary visible instead of a silent no-op.
    frame.hidden = false;
    frame.querySelector('iframe').srcdoc = loading ? loadingDoc(slot) : notLoadedDoc(slot);
    return;
  }
  if (d.mdx.ext !== 'mdx') return;
  setStatus(slot, 'searching…', true);
  try {
    let hits = await d.mdx.lookup(word);
    let phraseNote = '';
    let matchedKey = '';
    if (!hits.length) {
      // Phrase fallback: the exact key is missing, but a longer entry key
      // CONTAINS the phrase (e.g. "look forward to" inside "look forward to sb").
      const fb = d.mdx.allKeys ? await phraseFallback(d, word).catch(() => null) : null;
      if (fb) {
        hits = fb.hits;
        matchedKey = fb.key;
        phraseNote = `<div class="phrase-banner">No exact entry for “${escapeHtml(word)}” — showing <b>${escapeHtml(fb.key)}</b>.` +
          (fb.others.length ? ` Close matches: ${fb.others.map((o) => `<a data-search="${escapeHtml(o)}" href="#">${escapeHtml(o)}</a>`).join(', ')}` : '') +
          '</div>';
      }
    }
    if (!hits.length) {
      frame.querySelector('iframe').srcdoc = emptyDoc(slot, word);
      setStatus(slot, `no results found for "${word}"`);
      return;
    }
    const html = hits.map((h) => formatEntry(h.text)).join('<hr class="mdx-sep">');
    const doc = await buildEntryDoc(d, phraseNote + html);
    frame.querySelector('iframe').srcdoc = doc;
    setStatus(slot, matchedKey ? `phrase match: “${matchedKey}”` : `${d.mdx.numEntries.toLocaleString('en-US')} entries`);
  } catch (e) {
    console.error(e);
    frame.querySelector('iframe').srcdoc = `<p style="font-family:sans-serif;padding:16px">Error reading entry content: ${e.message}</p>`;
    setStatus(slot, 'lookup error');
  }
}

/** The real display name of a slot — the panel header always reflects what is
 *  (or will be) loaded, so messages never promise "Oxford" while serving WordNet. */
function slotPanelName(slot) {
  return document.querySelector(`#panel-${slot} .dict-name`)?.textContent
    || (slot === 'oxford' ? 'WordNet 3.1' : 'Simple English Wiktionary');
}

/** Phrase search fallback: the exact key is missing, but a longer entry key
 *  CONTAINS the phrase (e.g. "look forward to" inside "look forward to sb").
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
function welcomeDoc(slot) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:#374151;padding:24px;text-align:center;line-height:1.7;background:#fbfcfe}
    b{color:#0f766e} .icon{font-size:34px;margin-bottom:2px}
  </style></head><body>
    <p class="icon">📖</p>
    <p><b>${escapeHtml(slotPanelName(slot))}</b> is ready.</p>
    <p>Type a word above to start — results appear here.</p>
  </body></html>`;
}

function notLoadedDoc(slot) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:#374151;padding:24px;text-align:center;line-height:1.6}
    b{color:#0f766e}
  </style></head><body>
    <p><b>${escapeHtml(slotPanelName(slot))}</b> is not loaded yet.</p>
    <p>Tap <b>Download dictionaries</b> below, or open <b>⚙ Advanced</b> to use your own .mdx files.</p>
  </body></html>`;
}

function loadingDoc(slot) {
  const p = progressTrackers.get(slot);
  const eta = p && p.speed > 0 && p.total > p.received ? ` — ${fmtEta((p.total - p.received) / p.speed)}` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:#374151;padding:24px;text-align:center;line-height:1.6}
    b{color:#0f766e}
  </style></head><body>
    <p><b>${escapeHtml(slotPanelName(slot))}</b> resources are still loading${eta}.</p>
    <p>Watch the progress in the panel header, or search the other dictionary meanwhile.</p>
  </body></html>`;
}

/* ---------------- entry rendering ---------------- */
/**
 * Build a full HTML document for the iframe:
 * - strip <script>
 * - inline CSS files referenced by <link> from the MDD
 * - rewrite image/audio src/href to blob URLs from the MDD
 */
async function buildEntryDoc(d, html) {
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

  const body = parsed.body.innerHTML;
  const css = [...styles, d.bundledCss || ''].join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:">
<style>
  html{background:#fff;color:#1a1a1a;-webkit-text-size-adjust:100%;color-scheme:light}
  body{font-family:Georgia,'Times New Roman',serif;padding:14px 16px 20px;max-width:52rem;margin:0 auto;
    overflow-wrap:break-word;color:#1a1a1a;background:#fff;line-height:1.55}
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
</head><body>${body}<script>
function rp(){
  try{
    parent.postMessage({type:'resize',h:Math.ceil(document.documentElement.scrollHeight)},'*');
  }catch(e){}
}
addEventListener('load',rp);
document.fonts&&document.fonts.ready.then(rp);
setTimeout(rp,400);setTimeout(rp,1500);
if(window.ResizeObserver){new ResizeObserver(rp).observe(document.documentElement);}
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
  if(a2){e.preventDefault();parent.postMessage({type:'search',word:a2.dataset.search},'*');}
});<\/script></body></html>`;
}

/* message from iframes: internal link search + auto height */
window.addEventListener('message', (e) => {
  if (e.data?.type === 'search' && e.data.word) { search(e.data.word); return; }
  if (e.data?.type === 'resize' && e.data.h) {
    const frame = [...document.querySelectorAll('.entry-frame iframe')]
      .find((f) => f.contentWindow === e.source);
    if (frame) {
      const h = Math.min(Math.max(e.data.h + 28, 280), 20000);
      frame.style.height = h + 'px';
    }
  }
});

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

function bytesToDataURL(bytes, mime) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return 'data:' + mime + ';base64,' + btoa(bin);
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
        const url = bytesToDataURL(bytes, mime);
        d.blobUrls.set(key, url);
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
let suggestTimer = null;
function suggest(q) {
  clearTimeout(suggestTimer);
  $('#search-input').setAttribute('aria-expanded', 'false');
  if (!q || q.length < 2) { $('#suggestions').classList.add('hidden'); return; }
  suggestTimer = setTimeout(() => {
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
    if (!out.length) { box.classList.add('hidden'); return; }
    const SHOWN = 6; // keep the dropdown compact — panels must stay visible
    const shown = out.slice(0, SHOWN);
    const hasMore = out.length > SHOWN;
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
    for (const w of shown) addOption(w);
    if (hasMore) addOption(q, 'sug-more', `Show more results for “${q}”`);
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
function speak(word) {
  if (!word) return;
  if (!TTS_SUPPORTED) {
    alert('This browser does not support text-to-speech.');
    return;
  }
  speechSynthesis.cancel(); // stop anything already queued/speaking
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

/* ---------------- reader (Phase 2) ---------------- */
let readerSelection = null; // { word, sentence, source } — the last tapped word

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

/** Render plain text as tappable reading paragraphs. Every token is added via
 *  textContent (never innerHTML), so pasted content cannot inject markup —
 *  the pane only ever contains spans we created ourselves. */
function readerRender(text, source) {
  const pane = $('#reader-text');
  const wrap = $('#reader-input-wrap');
  if (!pane) return;
  const paragraphs = String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) { setReaderMsg('Nothing to read — the text is empty.'); return; }
  pane.innerHTML = '';
  for (const para of paragraphs) {
    const p = document.createElement('p');
    p.dataset.source = source || 'pasted';
    for (const token of para.split(/\s+/)) {
      const span = document.createElement('span');
      span.className = 'rw';
      span.dataset.word = token;
      span.textContent = token;
      p.appendChild(span);
      p.appendChild(document.createTextNode(' '));
    }
    pane.appendChild(p);
  }
  pane.classList.remove('hidden');
  if (wrap) wrap.classList.add('hidden');
  $('#btn-reader-start').textContent = '📖 Re-edit text';
  setReaderMsg(`${paragraphs.length} paragraph(s) · ${pane.textContent.trim().split(/\s+/).length} words — tap any word to look it up below.`);
}

function startReading() {
  const pane = $('#reader-text');
  const wrap = $('#reader-input-wrap');
  if (!pane || !wrap) return;
  if (!pane.classList.contains('hidden')) { // reading → back to the editor
    wrap.classList.remove('hidden');
    pane.classList.add('hidden');
    $('#btn-reader-start').textContent = '📖 Start reading';
    setReaderMsg('');
    return;
  }
  const text = $('#reader-input').value.trim();
  if (!text) { setReaderMsg('Paste some text first (or load a URL).'); return; }
  readerRender(text, 'pasted');
}

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
    readerRender(text, source);
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
  readerSelection = {
    word,
    sentence: para ? sentenceAround(para.textContent, word) : '',
    source: para?.dataset.source || 'pasted',
  };
  const btn = $('#btn-save-sentence');
  if (btn) {
    btn.disabled = !readerSelection.sentence;
    btn.textContent = '⭐ Save sentence';
  }
  search(word);
}

function saveSentence() {
  if (!readerSelection?.sentence) return;
  const { word, sentence, source } = readerSelection;
  if (!state.sentences.some((s) => s.word.toLowerCase() === word.toLowerCase() && s.sentence === sentence)) {
    state.sentences.unshift({ word, sentence, source, addedAt: Date.now() });
    state.sentences = state.sentences.slice(0, 200);
    saveSentences();
    renderSentences();
  }
  const btn = $('#btn-save-sentence');
  if (btn) {
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.textContent = '⭐ Save sentence'; }, 1500);
  }
}

function saveSentences() {
  localStorage.setItem('sentences', JSON.stringify(state.sentences));
}

function renderSentences() {
  const list = $('#sentences-list');
  if (!list) return;
  list.innerHTML = '';
  if (!state.sentences.length) {
    list.innerHTML = '<p class="hint">No sentences saved yet — open 📖 Reader, tap a word, then “⭐ Save sentence”.</p>';
    return;
  }
  for (const s of state.sentences) {
    const row = document.createElement('div');
    row.className = 'sentence-row';
    const w = escapeHtml(s.word);
    const full = escapeHtml(s.sentence);
    const text = s.sentence.length > 220 ? full.slice(0, 220) + '…' : full;
    const src = s.source && s.source !== 'pasted' ? ' · ' + escapeHtml(s.source).slice(0, 40) : '';
    row.innerHTML = `<p class="sentence-text">…${text}… <button type="button" class="sentence-word" data-word="${w}">${w}</button></p>` +
      `<span class="sentence-meta">${escapeHtml(new Date(s.addedAt).toLocaleDateString('en-US'))}${src}</span>` +
      `<button type="button" class="btn-vocab-del" data-act="del-sentence" data-added="${s.addedAt}" aria-label="Delete sentence">✕</button>`;
    list.appendChild(row);
  }
}

/* ---------------- toast feedback ---------------- */
let toastTimer;
function showToast(text, undoFn) {
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
    b.textContent = 'Undo';
    b.addEventListener('click', () => { undoFn(); el.classList.add('hidden'); });
    el.appendChild(b);
  }
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}

/* ---------------- saved words (vocab) ---------------- */
function saveVocab() {
  localStorage.setItem('vocab', JSON.stringify(state.vocab));
}

function findVocab(word) {
  const key = (word || '').trim().toLowerCase();
  if (!key) return null;
  return state.vocab.find((v) => v.word.toLowerCase() === key) || null;
}

function isSaved(word) {
  return !!findVocab(word);
}

/** Toggle save/unsave for the word currently in the search box. */
function toggleSaveWord(word) {
  const key = (word || '').trim();
  if (!key) return;
  const existing = findVocab(key);
  if (existing) {
    state.vocab = state.vocab.filter((v) => v !== existing);
    saveVocab();
    showToast('Removed “' + key + '” from Saved words', () => {
      if (!findVocab(key)) { state.vocab.unshift(existing); saveVocab(); updateSaveButtonState(); updateVocabBadge(); }
    });
  } else {
    state.vocab.unshift({ word: key, box: 1, due: Date.now(), addedAt: Date.now() });
    saveVocab();
    showToast('Saved “' + key + '” to Saved words', () => {
      if (findVocab(key)) {
        state.vocab = state.vocab.filter((v) => v.word.toLowerCase() !== key.toLowerCase());
        saveVocab(); updateSaveButtonState(); updateVocabBadge();
      }
    });
  }
  updateSaveButtonState();
  updateVocabBadge();
}

/** Reflect whether the current search-box word is already saved on the ☆/★ button. */
function updateSaveButtonState() {
  const btn = $('#btn-save-word');
  if (!btn) return;
  const word = $('#search-input').value.trim();
  const saved = word && isSaved(word);
  btn.textContent = saved ? '★' : '☆';
  btn.classList.toggle('is-saved', !!saved);
  const label = saved ? 'Remove word from your vocabulary list' : 'Save word to your vocabulary list';
  btn.title = saved ? 'Remove from saved words' : 'Save word';
  btn.setAttribute('aria-label', label);
}

/** Update the ★ badge in the top bar with the count of words due for review. */
function updateVocabBadge() {
  const badge = $('#vocab-badge');
  if (!badge) return;
  const due = state.vocab.filter((v) => v.due <= Date.now()).length;
  badge.textContent = due > 99 ? '99+' : String(due);
  badge.classList.toggle('hidden', due === 0);
}

/** Grade a saved word from the vocab dialog and reschedule it (simple Leitner-style SRS). */
function gradeVocab(word, action) {
  const v = findVocab(word);
  if (!v) return;
  if (action === 'remove') {
    state.vocab = state.vocab.filter((x) => x !== v);
  } else if (action === 'know') {
    v.box = Math.min(v.box + 1, SRS_INTERVALS_DAYS.length);
    v.due = Date.now() + SRS_INTERVALS_DAYS[v.box - 1] * 86400000;
  } else if (action === 'forgot') {
    v.box = 1;
    v.due = Date.now() + 10 * 60000; // due again in 10 minutes, not instantly re-shown
  }
  saveVocab();
  updateVocabBadge();
  updateSaveButtonState();
  renderVocab();
}

/** Click delegation for the saved-words dialog: grade buttons + tapping a word to look it up. */
function onVocabAction(e) {
  const actBtn = e.target.closest('button[data-act]');
  if (actBtn) {
    if (actBtn.dataset.act === 'del-sentence') {
      state.sentences = state.sentences.filter((s) => String(s.addedAt) !== actBtn.dataset.added);
      saveSentences();
      renderSentences();
      return;
    }
    gradeVocab(actBtn.dataset.word, actBtn.dataset.act);
    return;
  }
  const wordBtn = e.target.closest('.vocab-word') || e.target.closest('.sentence-word');
  if (wordBtn) {
    $('#vocab-dialog').close();
    search(wordBtn.dataset.word);
  }
}

/** Render the saved-words / spaced-repetition list inside #vocab-dialog. */
function renderVocab() {
  const list = $('#vocab-list');
  const count = $('#vocab-count');
  const exportBtn = $('#vocab-export');
  if (exportBtn) exportBtn.disabled = !(state.vocab.length || state.sentences.length);
  if (!list || !count) return;
  list.innerHTML = '';
  const now = Date.now();
  const dueCount = state.vocab.filter((v) => v.due <= now).length;
  count.textContent = state.vocab.length
    ? `${state.vocab.length} word${state.vocab.length === 1 ? '' : 's'} saved · ${dueCount} due for review`
    : 'No words saved yet. Tap ☆ next to the search box to save a word.';
  const sorted = [...state.vocab].sort((a, b) => a.due - b.due);
  for (const v of sorted) {
    const due = v.due <= now;
    const row = document.createElement('div');
    row.className = 'vocab-row';
    const w = escapeHtml(v.word);
    row.innerHTML = `
      <button type="button" class="vocab-word" data-word="${w}">${w}</button>
      <span class="vocab-gloss" aria-hidden="true"></span>
      <span class="vocab-meta">${due ? 'Due for review' : 'Review: ' + new Date(v.due).toLocaleDateString('en-US')}</span>
      <span class="vocab-actions">
        <button type="button" class="btn-vocab-ok" data-act="know" data-word="${w}" ${due ? '' : 'disabled'}>Know it</button>
        <button type="button" class="btn-vocab-bad" data-act="forgot" data-word="${w}" ${due ? '' : 'disabled'}>Forgot</button>
        <button type="button" class="btn-vocab-del" data-act="remove" data-word="${w}" aria-label="Remove ${w}">✕</button>
      </span>`;
    list.appendChild(row);
    // gloss fills in asynchronously — the list itself renders instantly
    quickGloss(v.word).then((g) => {
      const el = row.querySelector('.vocab-gloss');
      if (el && g) { el.textContent = g; el.title = g; }
    });
  }
}

/** Short meaning snippet for a word — powers the vocab list and history
 *  tooltips. Looks up the first loaded dictionary that has a hit; cached. */
const glossCache = new Map();
async function quickGloss(word) {
  const key = (word || '').toLowerCase().trim();
  if (!key) return '';
  if (glossCache.has(key)) return glossCache.get(key);
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
  glossCache.set(key, gloss);
  return gloss;
}

/** Export saved words as a JSON file — data ownership: nothing lives only in
 *  the app, the user can always take their vocabulary with them. */
function exportVocab() {
  if (!state.vocab.length) return;
  const payload = {
    app: 'Dual Dictionary',
    version: 2,
    exportedAt: new Date().toISOString(),
    words: [...state.vocab].sort((a, b) => a.word.localeCompare(b.word)),
    sentences: [...state.sentences].sort((a, b) => a.addedAt - b.addedAt),
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

function clearHistory() {
  state.history = [];
  localStorage.setItem('history', '[]');
  renderHistory();
}

/** One-click EN–VI: download the open OVDP dictionary into Slot 2 via the
 *  normal quick-load pipeline. Asks first when the slot holds user data. */
async function loadEnViDictionary() {
  const slot = 'longman';
  try {
    const existing = await getFile(slot + '-mdx');
    const isFallback = existing && (BUNDLED_NAMES.includes(existing.name) || existing.name === 'simple-en.mdx');
    if (existing && !isFallback && !confirm('Slot 2 already holds “' + existing.name + '”. Replace it with the EN–VI dictionary (' + ENVI_DICT.label + ')?')) return;
  } catch (e) { /* storage read failed — proceed, quickLoadOne will handle */ }
  if ($('#empty-state')) $('#empty-state').classList.remove('hidden');
  loadAbort = new AbortController();
  try {
    await quickLoadOne(slot, ENVI_DICT, loadAbort.signal);
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

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
