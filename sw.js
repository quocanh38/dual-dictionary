// Service worker: cache-first app shell. Dictionary .mdx/.mdd files live in IndexedDB.
// Bump version whenever app shell changes!
// v61–v63: UX/UI pass (U3 first-run state, U5 attribution, U6 entry line measure,
// U7 mobile reader tap, U8 one highlight convention, U10–U18) changed index.html,
// js/app.js and css/style.css — all precached, hence the bump.
// v64: residual UI close-out (R-A Search not-ready paint, R-B condensed footer,
// R-C Stats grouping/contrast/units, R-E mobile bottom inset, R-G one fallback
// statement) changed index.html, js/app.js and css/style.css — bump again.
// v65–v66: residual close-out continued — R-D (a tapped inflected form opens at
// its own part of speech, carrying the tapped sentence into the result) landed in
// two edits of js/app.js while v65 was still unreleased, so the shell was bumped
// again rather than shipping one CACHE name for two different shells.
// R-F (legacy 150k-iteration .ddbackup import) is verified, not changed.
// v67: import fix + touch targets. js/store.js (a stock Anki .txt export — the one
// with `#separator:tab` / `#html:true` / `#columns:Front<TAB>Back<TAB>Tags` —
// imported as nothing, because the `#columns:` value was split on commas instead
// of the file's own separator and Anki's column names were then adopted as this
// app's field mapping), js/app.js (the vault row checkbox rides in a 44×44 label
// so its tap target reaches the app's own minimum) and css/style.css (touch
// targets at ≤899.5px) — all three precached, hence the bump.
// v68: the two residual items of that same batch. js/app.js — the FIRST-LOAD CARD
// (the element the user actually clicks) now carries the live download figures
// instead of one static line for a ~13 MB transfer (fmtProgressFigures +
// paintFirstLoadFigures, i18n firstload.downloading / firstload.done, and the card
// ends on an honest ready/failed copy). css/style.css — the panel licence chip
// (.dict-lic) clears the WCAG 2.5.8 AA 24×24 floor at every width. Both precached,
// hence the bump.
// v70: the feedback ask moves out of the footer/Stats into ONE opt-in line at the
// end of the About details (about.feedback replaces foot.feedback, EN+VI; the
// coffee footer link is unchanged); dead widget-era support CSS dropped. All three
// precached files change — index.html, js/app.js, css/style.css — hence the bump.
// v71: bundled IPA for the pron strip (data/ipa-en.json, open data — thichhoc-en-vi
// CC BY-SA 4.0 + CMUdict PD, see NOTICE.md). The JSON is deliberately NOT precached
// (~3.8 MB): js/app.js lazy-fetches it on first use and the runtime branch caches
// it, same trade-off as the PDF engine below. js/app.js changed too — hence the bump.
// v72: review reminders (opt-in, local-only — no push, no server). New
// periodicsync/notificationclick handlers below read the items store READ-ONLY at
// the CURRENT db version; js/app.js + index.html changed too — hence the bump.
// v73: hotfix within the v67 release — the activate cleanup deleted every cache
// that was not the app shell, including 'mdx-dict-meta' (the reminders 12h guard
// + notification language), right after a client had written it. The meta cache
// is version-independent state and now survives activations. sw.js changed — bump.
// v74: FSRS scheduler (Phase 6 R3). js/db.js gains the `reviews` store (IDB
// version 2→3 — one added empty store, no records touched), js/store.js the
// FSRS-4.5 default-weight functions, js/app.js the rewritten gradeById (FSRS +
// per-grade review-log append). All three precached — hence the bump.
// v75: say-it-aloud practice + pron-strip mic (Phase 6 R4). The browser's own
// Web Speech API, one-shot — no key, no server of ours (Chrome sends the audio
// to Google, Safari to Apple; tooltips disclose it). index.html, js/app.js,
// css/style.css changed — hence the bump.
// v76: Help/About/onboarding + SEO refreshed for Phase 6 (IPA, reminders, FSRS,
// speaking) per the owner's standing directive — index.html + js/app.js
// precached changed — hence the bump. (vi/ landing is served fresh, not precached.)
// v77: quality pass after Lighthouse re-measure (perf had slipped to 72): CLS
// fixes (gate-note pre-rendered, view-switch/both-hint gated on "ready",
// empty-state min-height flip removed, correct reserves) + probe fallback with
// embedded sizes + parallel probes — index.html, css/style.css, js/app.js
// precached changed — hence the bump.
// v78: v71 on-device FSRS weight optimizer — new js/fsrs-opt.js precached
// (small, pure JS), js/db.js (+allReviews), js/store.js (+apply/resetFsrsWeights),
// js/app.js (boot loader + Advanced section wiring) and index.html changed.
// v79: v72 Phase 7 P1 — YouTube transcript → Reader: index.html (+yt-dialog),
// js/app.js (+parseTranscript, dialog wiring), css/style.css (dialog fields).
// v80: v73 — Advanced dialog reorganized into three tabs (Dictionaries/Data/
// Learning; context-based default) — index.html, css/style.css, js/app.js changed.
// v81: v74 — reading pace clock in the Reader (elapsed/words/wpm).
// v82: v75 — writing journal in the Vault (editor + word count + Task 2 countdown;
//       entries are Vault items tagged 'journal', status 'known').
// v83: v76 — Practice cue card (prompt bank + 1:00 prep + 2:00 speak) and
//       sentence-level spokenCoverage for the say-aloud drill.
// v84: v77 — Listening: user audio file + synced transcript in the Reader
//       (session-only object URL; tap a cue to seek; playing line follows).
// v81-v84 all touch index.html / js/app.js / css/style.css — hence the bumps.
// v85: v78 — student-review fixes: EN–VI hint above the panels, cue-card
// skip-prep, deadline-based countdowns, FSRS label in Stats — index.html,
// css/style.css, js/app.js changed.
// v86: v91 — first-run chooser (pick which of the 3 dictionaries to download),
// real-name tabs + "All" view, bundled-table-first IPA (deduped), teal slot-1
// head, i18n'd gate/panel copy — index.html, css/style.css, js/app.js changed.
// v87: v94 — shell itself unchanged; the bump exists ONLY to invalidate the
// runtime-cached data/ipa-en.json (cached in THIS cache by the fetch branch):
// the table's content was cleaned (lemma-copy fixes, became:"bɪˈkeɪm"…) and
// a returning client must re-fetch it instead of keeping the stale copy.
// v88: v95 — NOTICE.md (precache asset) gained the AWL attribution section and
// the word-pages set grew by the AWL supplement; bump so returning clients
// refresh the shell. (data/ipa-en.json unchanged this release.)
// v89: v97 — the stacked "Both"/"Tất cả" view is REMOVED (owner call): the
// dictionary tabs now pick the one panel to show on every screen size, desktop
// switches from the side-by-side grid to the same single-panel tab layout.
// index.html (tab strip + JSON-LD/About/onboarding copy), js/app.js (setView/
// rememberedView rework + old-'both' localStorage migration), css/style.css
// (universal tab bar, single reading-width panel column) — hence the bump.
// v90: v111 — "did you mean" fuzzy suggestions on a failed lookup
// (docs/plan-p2-fuzzy-practice.md). js/fuzzy.js is a NEW precached asset (the
// pure suggestion engine, also unit-tested in Node), data/built-words.json
// (6,839 built headwords + band/rank/AWL, generated by tools/build-word-pages.cjs)
// is precached too — same class as data/freq-en.json (small, needed offline from
// the start). index.html (script tag), js/app.js (loader + chips on the miss
// path), css/style.css (.didyoumean chips) changed — hence the bump.
// v91: v112/v113 — curriculum practice decks (owner-approved D1/D2, D3 dropped):
// deck picker on the Practice view, question generation from built-words.json +
// loaded entries (choice/recall/listen/cloze/say + new IPA-match drill), the
// wrong-answer "Save to Vault" CTA (D1: no FSRS writes without the user's tap)
// and the ?deck= deep-link parse. js/app.js (generator + render branches +
// ephemeral finish path + i18n) and css/style.css (.practice-decks) changed —
// hence the bump.
// v92: first-load cleanup — public builds stop requesting dicts/ entirely
// (SHIP_COMMERCIAL_DEFAULTS=false in js/app.js; the OALD10/LDOCE6 options stay
// hidden until a deployment actually serves dicts/, whose HEAD probes were four
// guaranteed 404s on every first load) and the 🌓 theme toggle moves out of the
// ⋯ menu onto the header on every screen size. index.html (topbar buttons +
// menu), js/app.js (default-dict resolver, more-menu wiring, i18n keys),
// css/style.css (U11 comments only) changed — hence the bump.
// v106: versioned offline content packs, mixed-format IELTS/TOEIC questions,
// timed starter simulations and local skill accuracy statistics.
// v105: local IELTS/TOEIC practice engine, recoverable writing/speaking sessions,
// local audio library and full study-backup integration; DB v6 adds study store.
// Journal remains available in an empty Vault. index.html, js/app.js, js/db.js,
// js/offline-study.js and css/style.css changed.
// v93: v116 QA round — history records only lookups that produced an entry
// (misses/errors stay out of "Recent"; parked ?q= replays record on success),
// one-time quiet reminders re-offer for devices onboarded before the onboarding
// link existed (+ showToast action label), the ghosted Search button carries its
// gate note as a tooltip and a submit scrolls the download card into view, and
// same-origin files with known byte sizes (samples/*, dicts-en-vi/*) skip the
// HEAD probe entirely — the last dictionary requests a first load could fire.
// js/app.js only — hence the bump.
// Review fixes: FSRS restore/grading, boot queue, search/cache lifecycle and replay.
// v109: IELTS/TOEIC timed practice filters by skill, records its section choice,
// scales the clock to authored item coverage and explains remaining bank size.
// v110: expanded original IELTS/TOEIC practice questions and updated user guide.
// v111: add the complete Vietnamese user guide and link it from in-app Help.
// v112: require separate, exact-payload consent for each live Tutor/Writing/Speaking call;
// add cancel controls, strict AI-feedback quote checks, and live provider attribution.
// v113: preserve consented Tutor action metadata and show the configured provider label.
// v114: simplify optional AI setup to provider + key, with model and endpoint under
// an advanced disclosure; update in-app and full user guide setup instructions.
// v115: add selected-sense saving, local Tutor meaning persistence, saved-value
// recovery and baseline-aware Reader estimates; refresh consent and setup UX.
// v122: classify safe DNS/TLS causes from Meta requests and preflight batch,
// repair inputs, and ledger state before any API call.
// v123: resolve the active shell cache dynamically in Lesson Studio so the
// offline-ready check follows each service-worker version without drift.
// v128: send bounded reasoning/output settings for Meta Muse Spark Tutor calls.
// v130: add the conference-travel lesson pack to the offline library.
// v131: add the community-garden resource-sharing lesson pack offline.
// v132: add three newly approved P1 offline lesson packs.
// v133: add three more exact-reviewed offline lessons.
// v134: add three newly reviewed batch-9 offline lessons.
// v135: add three newly reviewed batch-10 offline lessons.
// v136: add three cross-reviewed batch-11 offline lessons.
// v137: add three cross-reviewed batch-12 offline lessons.
// v138: add IELTS pathway stages, Linear Thinking guidance from the app author's
// blog, upper-stage original practice and offline Academic Writing task visuals.
// v139: add complete 40-item-per-skill IELTS objective diagnostics and the
// 6.5→7.0 pathway stage; cache the new diagnostic content module for offline use.
// v140: add the first 80 GPT-cross-reviewed original IELTS practice items.
// v142: add 80 more cross-reviewed items and label short-form Reading texts.
// v144: personalized offline IELTS assignments, prompt-specific drafts and
// strict separation between practice sets and the 40-question diagnostics.
// v145: add wave 4, bringing reviewed IELTS Meta practice to 320 items.
// v147: add waves 6–10, bringing reviewed IELTS Meta practice to 800 items.
// v149: release the merged wave-10 library and 800-item IELTS practice pack.
// v153: Why-Meta page + photo-to-reading author path (overlays only, core untouched).
// v152: Village path on main app — banner + offline/online badges + EN/VI i18n.
// v151: Village Kit — precache village.js + provenance.json for cheap-device offline.
// v150: route lesson draft creation to Baseten and optional repair to Meta;
// add provider metadata to the offline Studio shell.
const CACHE = 'mdx-dict-v154';
const ASSETS = [
  './',
  './index.html',
  './robots.txt',
  './NOTICE.md',
  './css/style.css',
  './js/mdict.js',
  './js/db.js',
  './js/fuzzy.js',
  './js/store.js',
  './js/fsrs-opt.js',
  './js/app.js',
  './js/ai-client.js',
  './js/tutor-validation.js',
  './js/tutor-prompts.js',
  './js/tutor-selection.js',
  './js/tutor-cache.js',
  './js/offline-study.js',
  './js/assignment-engine.js',
  './js/study-content.js',
  './js/ielts-diagnostic-content.js',
  './js/ielts-meta-practice.js',
  './assets/study/toeic-office-desk.svg',
  './assets/study/audio/toeic-part1-a.wav',
  './assets/study/audio/toeic-part1-b.wav',
  './assets/study/audio/toeic-part1-c.wav',
  './assets/study/audio/toeic-part1-d.wav',
  './assets/study/ielts-compost-process.svg',
  './assets/study/ielts-campus-maps.svg',
  './assets/study/ielts-transport-line-graph.svg',
  './demo/tutor.html',
  './demo/lesson.js',
  './lessons/',
  './lessons/index.html',
  './lessons/app.js',
  './lessons/schema.js',
  './lessons/storage.js',
  './lessons/generator.js',
  './lessons/provider.js',
  './lessons/backup.js',
  './lessons/draft-file.js',
  './lessons/library.js',
  './lessons/village.js',
  './lessons/photo-pane.js',
  './lessons/photo-request.js',
  './lessons/photo-downscale.js',
  './lessons/why-meta.html',
  './lessons/library/index.json',
  './lessons/library/provenance.json',
  './lessons/library/library-hours.json',
  './lessons/library/tracking-work.json',
  './lessons/library/coastal-survey.json',
  './lessons/library/hotel-shift-handover.json',
  './lessons/library/campus-water-study.json',
  './lessons/library/workshop-safety-plan.json',
  './lessons/library/supplier-delivery.json',
  './lessons/library/museum-access.json',
  './lessons/library/remote-team-handover.json',
  './lessons/library/urban-tree-survey.json',
  './lessons/library/food-bank-volunteer-briefing.json',
  './lessons/library/lab-equipment-audit.json',
  './lessons/library/station-maintenance-notice.json',
  './lessons/library/conference-travel.json',
  './lessons/library/community-garden-water-rotation.json',
  './lessons/library/clinic-appointment-process.json',
  './lessons/library/city-bus-temporary-diversion.json',
  './lessons/library/coastal-bird-count-method.json',
  './lessons/library/community-centre-emergency-drill.json',
  './lessons/library/equipment-loan-desk.json',
  './lessons/library/coastal-temperature-sampling.json',
  './lessons/library/community-kitchen-volunteer-shift.json',
  './lessons/library/urban-heat-survey-method.json',
  './lessons/library/rail-station-lost-property.json',
  './lessons/library/east-market-repair-cafe-volunteer-shift.json',
  './lessons/library/school-library-survey-privacy.json',
  './lessons/library/riverside-centre-class-registration.json',
  './lessons/library/university-photo-archive-catalogue.json',
  './lessons/library/community-arts-open-day-volunteers.json',
  './lessons/library/volunteer-rota-schedule-change.json',
  './lessons/library/east-dock-refill-shop-stock-check.json',
  './lessons/library/student-podcast-interview-editing.json',
  './lessons/library/staggered-start-time-policy-rollout.json',
  './lessons/studio.css',
  './lessons/example.json',
  './js/epub.js',
  './js/pdf.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data-loading-guide.md',
  './docs/huong-dan-su-dung.html',
  // frequency band shown next to a looked-up word — small, and looked up on the
  // first search after install, so it is precached (offline from the start).
  './data/freq-en.json',
  // v111: built headword index for the "did you mean" chips — generated by the
  // word-pages builder, so it can never drift from the deployed page set.
  './data/built-words.json',
  // bundled demo dictionary — precached so the test sample works offline
  './samples/sample.mdx',
  './samples/sample.mdd',
  // free fallback dictionaries — used when the full dicts/ folder is absent
  './samples/wordnet31.mdx',
  './samples/simple-en.mdx',
  // The PDF engine (js/vendor/pdf.min.mjs + pdf.worker.min.mjs, ~1.3 MB) is
  // deliberately NOT precached. It is dynamically imported only when a PDF is
  // actually opened, and the runtime branch of the fetch handler below caches it
  // on first use — so "open one PDF, then work offline" still holds, while the
  // other users never pay the 1.3 MB on install (the install is the one step a
  // slow connection is most likely to abandon). Precaching them is the change to
  // make if offline PDF support must work on the very first open.
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // 'mdx-dict-meta' is version-independent reminder state (12h guard + the
      // user's language for notification copy) — old shell caches go, it stays.
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'mdx-dict-meta').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Never cache the bundled dictionary files (multi-GB) — they go straight to
  // IndexedDB on load and would blow up the Cache Storage quota otherwise.
  // remote-config.json is optional (private deployments only) — never cache it.
  const path = new URL(e.request.url).pathname;
  if (path.includes('/dicts/') || path.endsWith('/remote-config.json')) return;
  // Vietnamese landing + blog (/vi/...) are marketing content that changes
  // independently of app releases — never enter the app cache (stale pages +
  // blog images would eat the Cache Storage quota). Network pass-through only;
  // the app shell never references /vi/, so users are unaffected.
  if (path === '/vi/' || path.startsWith('/vi/')) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit || fetch(e.request).then((resp) => {
        // Cache ONLY successful responses — a cached 404/HTML error page would
        // permanently shadow the real asset on the next deploy (this is what
        // broke the previous deployment: style.css/app.js were served from an
        // old broken deploy and never refreshed).
        if (!resp || !resp.ok || resp.type === 'opaque') return resp;
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => {
        // Offline fallback only for page navigations — never for assets like
        // css/js, where index.html would be parsed as garbage.
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
    )
  );
});

/* ---------------- Review reminders (v67 R2 — opt-in, local-only) ----------------
 * Periodic Background Sync (installed Android/desktop-Chrome PWAs only; the
 * browser decides when to run this — never a fixed clock time). Reads the SAME
 * IndexedDB the page uses, READ-ONLY, at the CURRENT version — this handler
 * must never upgrade the schema, that would break open pages. Guard state and
 * the user's language live in a meta Cache Storage entry (the SW cannot read
 * localStorage). No server, no push service, no counters: the notification is
 * generated here and says only how many items are due. */
const DUE_CHECK_TAG = 'due-check';
const REMINDER_NOTIFY_GAP = 12 * 3600 * 1000;

async function readRemindersMeta() {
  try {
    const hit = await caches.open('mdx-dict-meta').then((c) => c.match('./reminders-meta'));
    return hit ? await hit.json() : {};
  } catch (e) { return {}; }
}

async function writeRemindersMeta(meta) {
  try {
    const c = await caches.open('mdx-dict-meta');
    await c.put('./reminders-meta', new Response(JSON.stringify(meta)));
  } catch (e) { /* non-critical */ }
}

async function countDueItems() {
  const now = Date.now();
  let due = 0;
  await new Promise((res) => {
    const done = () => res();
    const timer = setTimeout(done, 3000); // never hang the sync event
    try {
      const req = indexedDB.open('mdx-dict');
      req.onerror = done;
      req.onsuccess = () => {
        const db = req.result;
        try {
          const cur = db.transaction('items', 'readonly').objectStore('items').openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) { clearTimeout(timer); return done(); }
            const i = c.value;
            // keep in sync with the canonical dueItems() filter in js/app.js
            if (i && i.due <= now && i.userData && i.userData.status !== 'known') due++;
            c.continue();
          };
          cur.onerror = done;
        } catch (e) { clearTimeout(timer); done(); }
      };
    } catch (e) { clearTimeout(timer); done(); }
  });
  return due;
}

async function checkDueAndNotify() {
  const meta = await readRemindersMeta();
  const now = Date.now();
  if (now - (meta.lastNotified || 0) < REMINDER_NOTIFY_GAP) return;
  const due = await countDueItems();
  try {
    if (due > 0) {
      const body = meta.lang === 'vi'
        ? due + ' mục đến hạn ôn — mở Dual Dictionary'
        : due + ' item' + (due === 1 ? '' : 's') + ' due for review — open Dual Dictionary';
      await self.registration.showNotification('Dual Dictionary', {
        body: body,
        tag: DUE_CHECK_TAG,
        data: { url: './index.html#/review' },
      });
      meta.lastNotified = now;
      await writeRemindersMeta(meta);
    }
    if (due > 0) await self.registration.setAppBadge(due);
    else await self.registration.clearAppBadge();
  } catch (e) { /* badge/notification unsupported on this platform */ }
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === DUE_CHECK_TAG) e.waitUntil(checkDueAndNotify());
});

/* v119 test hook — lets the automated suite drive the REAL reminder paths
 * (checkDueAndNotify / notificationclick) from a page on this same origin,
 * because periodic background sync itself only fires in an installed PWA at
 * browser-chosen times. The hook is passive in production: it does nothing
 * unless a page explicitly postMessages {type:'test:...'} with a MessageChannel. */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (!d.type || !d.type.startsWith('test:')) return;
  const reply = (payload) => { if (e.ports && e.ports[0]) e.ports[0].postMessage(payload); };
  if (d.type === 'test:due-check') {
    e.waitUntil((async () => {
      try {
        let shown = false, body = '';
        const origShow = self.registration.showNotification.bind(self.registration);
        self.registration.showNotification = async (title, opts) => { shown = true; body = (opts && opts.body) || ''; };
        let badge = null;
        const origSet = self.registration.setAppBadge;
        self.registration.setAppBadge = async (n) => { badge = n; };
        const origClear = self.registration.clearAppBadge;
        self.registration.clearAppBadge = async () => { badge = 0; };
        await checkDueAndNotify();
        self.registration.showNotification = origShow;
        self.registration.setAppBadge = origSet;
        self.registration.clearAppBadge = origClear;
        reply({ notificationShown: shown, body, badgeValue: badge });
      } catch (err) {
        reply({ error: String(err).slice(0, 200) });
      }
    })());
  } else if (d.type === 'test:clients-diag') {
    e.waitUntil((async () => {
      const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      reply({ clientCount: cs.length, urls: cs.map((c) => c.url.slice(0, 60)), focusMode: self.clients.matchAll ? 'ok' : 'missing' });
    })());
  } else if (d.type === 'test:notification-click') {
    e.waitUntil((async () => {
      try {
        const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of cs) {
          try {
            if (new URL(c.url).pathname.endsWith('/index.html') || new URL(c.url).pathname === '/') {
              // v119: notify FIRST, focus SECOND — headless/hidden pages can
              // reject focus(), and throwing before postMessage silently ate
              // the whole click path (caught by the inner catch).
              c.postMessage({ type: 'due-review' });
              try { await c.focus(); } catch (focusErr) { /* focus best-effort */ }
              return;
            }
          } catch (err) { /* next */ }
        }
      } catch (err) { /* ignore */ }
    })());
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
      try {
        if (new URL(c.url).pathname.endsWith('/index.html') || new URL(c.url).pathname === '/') {
          // v119: notify FIRST, focus SECOND — a hidden/unfocused client can
          // reject focus(); throwing before postMessage silently ate the whole
          // click path (the inner catch moved on to the next client), so an
          // already-open app never jumped to Review on the real flow either.
          c.postMessage({ type: 'due-review' });
          try { await c.focus(); } catch (focusErr) { /* focus best-effort */ }
          return;
        }
      } catch (err) { /* next client */ }
    }
    await clients.openWindow((e.notification.data && e.notification.data.url) || './index.html#/review');
  })());
});
