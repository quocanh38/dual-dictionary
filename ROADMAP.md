# Dual Dictionary — MDX-first Personal English OS

> Positioning: not "another dictionary app", not a generic English OS.
> **The only web app where your own .mdx/.mdd library IS the OS.**
> Read → tap → look up in *your* dictionaries → save the original sentence → remember forever. Offline-first, no account, no tracking.

## Why MDX-first (the moat)

Existing products (wusiyu, EngAce, lexicon…) build their own word databases and
ask users to import content into *their* format. The MDict ecosystem already has
hundreds of high-quality dictionaries users own as `.mdx/.mdd` files. We parse
them natively in the browser (JS-MDict + IndexedDB) — nobody else does this
offline-first on the web. Every phase below keeps MDX at the center.

## Non-negotiables (inherited from the original direction)

- **Offline-first**: after one-time load, everything works without network.
- **Data ownership**: dictionaries, saved words, progress live in the user's
  IndexedDB. Export/import file replaces cloud sync.
- **No account, no tracking, non-commercial.**
- **AI, if ever**: bring-your-own API key, called directly from the user's
  browser, key stored only locally — never a server-side proxy.

## Phases

### Phase 0 — Ship the current fix (shipped — v34 era, superseded)

- [x] Deploy `netlify-deploy` (v34) to production
- [x] Verify live: `remote-config.json` 404 gone, honest empty-state + retry
- [x] Silence `/dicts/*.mdx` probe 404 noise → superseded by the open-dictionary
      default + honest empty state

### Phase 1 — Finish the Dictionary pillar (MVP done-right)

- [x] Probe retry: cold-edge HEAD timeout no longer reports "unreachable"
- [x] Phrase / multi-word search (suggest + entry fallback with close-match links)
- [x] Result rendering polish: readability CSS, `color-scheme: light`, phrase banner
- [x] History & saved-words UX: gloss snippets, gloss tooltips, clear history,
      JSON export (data ownership)
- Accept: a user with their own .mdx files gets a result that looks *better*
  than MDict PC software, fully offline.

### Phase 2 — Reader-lite (the "wow" pillar)

- [x] Paste text → clean reading view (sanitized textContent tokens, 1.85 line-height)
- [x] **Tap-to-lookup**: tap any word → the SAME search machinery renders both panels below
- [x] "Save sentence": word + its original sentence (staged on tap, listed in Saved
      words dialog, deletable, click-to-search) — localStorage only
- [x] URL load: Wikipedia adapter (CORS via origin=*), honest CORS error for other sites
- [x] Export JSON v2 includes sentences
- Reading history is local; nothing leaves the device
- Accept: reading a real article, a user builds vocabulary *in context* without
  leaving the app.

### Phase 1.5 — Open EN–VI dictionary (pluggable, never bundled-commercial)

- [x] Ship the open OVDP "Từ điển Anh–Việt v1.1" (386,600 entries incl. inflected
      forms, MIT) same-origin at `dicts-en-vi/` — one-click into Slot 2 via the
      normal quick-load pipeline (confirm before replacing user data)
- [x] Attribution in NOTICE.md + footer; button in empty-state and ⚙ Advanced
- [x] EN-VI UI strings — EN/VI toggle across the UI chrome (nav, headings, buttons,
      Help/About/onboarding, dialogs); defaults to VI on Vietnamese browsers
- Principle: the app stays dictionary-agnostic; commercial .mdx (Lạc Việt…) stay
  bring-your-own. Open data ships; proprietary data never does.
- Accept: a Vietnamese user gets full EN–VI lookup in one click, offline after
  one download, with clean licensing.

### Phase 3 — Study pillar: 4-layer system (spec: `docs/phase3-spec.md`)

> **Launch status (2026-09-24):** **v65 live** — Phase 0–5 COMPLETE + fix passes v61/v62/v63 + v64 (VI dynamic gate copy, slot-3 `.dict-lic` chip, volunteer feedback mailto) + **v65** (feedback ask moved to one opt-in line in About; footer coffee kept). Deploy id `6ab528a91040035f08a558b0`, `sw.js` `CACHE` = **`mdx-dict-v70`**, archive `dual-dictionary-v65.zip`. Lighthouse: pre-v61 build measured 90 (manual); plugin removed 2026-09-21 → v62+ have no Lighthouse number (measure manually).

> Approved 2026-09-20. Layers: **Lookup → Context → Vault → Review** — not a
> course, not a standalone flashcard app. Replaces the old "SRS (SM-2)" plan.

- [x] **Release A — Foundation (invisible)**: IndexedDB `items` store (v3
      schema), LearningItem CRUD + duplicate detection, one-way idempotent
      migration of localStorage vocab/sentences (originals kept as rollback),
      save service rewired, export JSON v3 (+ v2-compat), import v2/v3
- [x] **Release B — IA (v43, 2026-09-20)**: routes Search/Reader/Vault/Review
      (hash-based, no redirects needed), mobile bottom nav, Vault tabs
      (All/Words/Phrases/Sentences/Needs review), search-within-Vault,
      multi-select (Review now / Add tag / Mark known / Export / Delete),
      item editor dialog (note/tags/status/delete/export — the spec's ••• menu
      collapsed into one dialog by design), phrase save via Search box,
      ui-check regression: desktop 0.072% (topbar only), mobile = intended
      topbar-slim cascade
- [x] **Context layer (P1, v44, 2026-09-20)**: saved/active sentence
      highlighted above the entry (headword marked) + "Add example"; context
      (sourceTitle/sourceUrl) captured on every save; no heuristic sense
      disambiguation (BYO-AI = P2 optional)
- [x] **Export (P1, v45, 2026-09-20)**: JSON / CSV / TSV / Anki-compatible text,
      field selection (Vault + item editor)
- [x] **Micro-exercises (P1, v45, 2026-09-20)**: 5–10 item sessions (choice,
      listen & type, cloze, dictation); states new / review-later(tag) / known
- [x] **Pronunciation (P2, v45)**: IPA when data exists, 0.75× playback,
      stress marking, sentence replay
- [x] Stats (v45): words learned, retention, sources read
- Accept: from reading to long-term memory without any account or cloud;
  MVP loop (Reader → save with context → Vault → 30 s review) in ≤ 6 taps.

### Phase 4 — Data, polish & i18n (started 2026-09-20)

> Quick wins shipped v49; the larger ideas stay in Deferred until demanded.

- [x] i18n depth: full EN/VI for Help/About/onboarding + dialogs; default follows the browser language (v49)
- [x] Advanced redesigned (grouped sections, per-slot status, **Swap slots**) (v49)
- [x] a11y: `:focus-visible` ring + `/` shortcut to search (v49)
- [x] Tidy stale Phase 0 checkboxes; close the EN–VI UI-strings item
- [x] A11y pass (v50): WCAG AA contrast, skip link, landmarks, focus-visible; keyboard shortcuts + `/` (P2-04 done)
- [ ] Dictionary manager full (custom slot labels, 3rd panel for EN–VI) — optional
- [x] Performance budget (v51): Lighthouse **85** (met) — third-party script removed + first-visit work deferred + CLS reserves

### Phase 5 — Reach & depth (owner-approved 2026-09-21: build ALL, deploy ONE release at the end)

> From the competitor review (Eudic / Readlang / LingQ / Anki / VN vocab apps).
> Everything stays local until the owner says deploy (Netlify deploy gate was 403).

**Stage 1 — Quick wins**
- [x] D: Anki/CSV import + auto-backup rotation + restore points (v52)
- [x] G: save a web-article snapshot for offline reading (v52)
- [x] B: word-frequency badges Top 1k/2k/5k/10k (open data, hermitdave MIT) (v52)

**Stage 2 — Study depth**
- [x] C: recall (meaning→word), hint, practice-day streak (v52)
- [x] F: dictionary manager — 3rd slot (EN–VI lives there), decks (themed sets) + deck filter, multi-example per word (v54)
- [x] A: bookmarklet "Send to Dual Dictionary" + ?q=/?read= handoff (v52)

**Stage 3 — Large (reopened from Deferred)**
- [x] E (EPUB): dependency-free EPUB → Reader with tap-to-lookup (v57)
- [x] E (PDF): pdf.js text-layer extraction, lazy-loaded (v59)
- [x] H: E2E-encrypted backup (AES-256-GCM, PBKDF2) — export/import a .ddbackup file (v52)

### Fix pass — data correctness, Reader perf, SW hygiene (2026-09-21 · **DEPLOYED as v61**)

> Second half of a fix pass whose first half (PBKDF2 600k, error-message escaping,
> postMessage origin allow-list, `createObjectURL`, suggestion-timer cancel,
> lemmatized lookup, submitted-query styling, Vault delete `btn-danger`) landed
> earlier the same day. Both halves are now **live as v61 on 2026-09-21** —
> deploy id `6ab1010a987f7a5ba30b29ff`, `sw.js` `CACHE` = **`mdx-dict-v63`**,
> archive `Dictionaries/dual-dictionary-v61.zip` (25 MB, 39 files); the deploy
> record lives in `netlify-deploy/docs/deployment.md`.

- [x] **C1 CSV round-trip (data loss)**: the importer split on TAB/`;` while the
      exporter wrote comma CSV, so re-importing the app's OWN export produced one
      junk item per line — header row included. Now: delimiter detection
      (comma/tab/semicolon, tab-first for Anki parity), Anki `#separator:` +
      `#columns:` directives honoured, and quote-aware records where quoting is
      written by the same helper the importer parses (`formatDeckCell` /
      `splitDelimitedRecords` in `store.js`). Header rows are recognised and mapped
      by column name, so type/status/tags/deck/note/sentence/source/created survive
      a round trip. Header-less Anki tab decks behave exactly as before.
- [x] **C2 stale dictionary resources**: all three replacement paths
      (`quickLoadOne`, `applyRemoteUrl`, `onFilePicked`) now drop the previous
      dictionary's `.mdd`/`.css`/`.mdx-meta` before the new `.mdx` is attached;
      boot restore only re-attaches resources whose base name matches.
- [x] **C6 restore points**: `restore-point-*` entries are capped at the newest 5
      (ISO names sort chronologically). Auto-backup rotation untouched.
- [x] **C9 Reader performance**: no second full-DOM scan for the word count (it is
      accumulated while tokens are built) and spans are appended in bounded
      4000-word batches instead of one span per word up-front, with a render
      sequence guard. Tap-to-lookup, word highlight, save-sentence and the context
      bar unchanged.
- [x] **C10 service worker**: `./data/freq-en.json` precached; `CACHE` → v63; the
      PDF engine (~1.3 MB) deliberately stays out of the precache and is cached on
      first use by the runtime branch (trade-off documented in `sw.js`).
- [x] **C11 guard**: `ui-check/sw-version-check.js` hashes the precached app shell
      and fails when an asset changed without a `CACHE` bump (also fails on a
      precached asset missing from the deploy).
- [x] **C13/C15/C16/C17/C18**: swap button now says exactly what it swaps (slots
      1↔2, EN+VI); `?q=` handoff is replayed once dictionaries exist; `cleanTitle`
      uses `DOMParser`; `deck` is an export field again (its label was falling back
      to the raw i18n key); `escapeHtml` lives in the utilities section.
- [x] **Regression found while verifying**: the same-day `search()` rework returned
      early when no dictionary was loaded, which skipped history, the context bar
      and the pronunciation strip — 6 assertions across `context-smoke`,
      `phase3plus-smoke`, `ux-pack-smoke` and `p5-smoke` were failing on that. All
      three are now painted before the dictionary gate, so the honest not-loaded
      state is kept without losing the user's own data.
- [x] Tests: `ui-check/fix-csv-roundtrip-smoke.js` (22 checks) and
      `ui-check/fix-mdd-clear-smoke.js` (14 checks) — both verified to FAIL against
      the pre-fix build.

### Residual close-out — R-A…R-G (2026-09-21 · **DEPLOYED as v62**)

> Closes **all six** "Known residuals" the v61 pass left open — nothing on that
> list is an open item any more (R-G was added in the same pass). Released **v62**
> with `bash tools/deploy.sh`: deploy id `6ab1205a43064f5278f75c67`, `sw.js`
> `CACHE` = **`mdx-dict-v66`**, archive
> `Dictionaries/dual-dictionary-v62.zip` (25 MB, 39 files); the deploy row and
> health check live in `netlify-deploy/docs/deployment.md`. Netlify build **7.5s
> with no plugin step** (v61: 33.6s, the Lighthouse plugin ran there) — **no
> Lighthouse report exists for v62**; measure manually if a number is wanted.

- [x] **R-A (was a) — Search button not-ready state**: while no dictionary is
      loaded the whole lookup surface takes a not-ready treatment (`search-box-idle`,
      `aria-disabled`) instead of a saturated primary; typing and the `/` shortcut
      still work, and the button returns to a filled accent primary the moment a
      dictionary loads. Measured: not-ready fill contrast 1:1 with the page, label
      AA 4.92:1 light / 7.3:1 dark; ready fill 5.47:1, label 5.47:1 light /
      8.73:1 dark.
- [x] **R-B (was b) — footer legal block on one line**: condensed to a single line
      (88 chars, h 22px vs line-height 22px) linking to NOTICE.md, terms still
      stated, EN+VI.
- [x] **R-C (was c) — Stats grouping**: Vocabulary (3) / Review (4) / Sources &
      streak (2), so no single-card rows remain; group titles 13.46:1 light /
      15.43:1 dark, active nav pill 5.47:1 / 8.73:1; one value convention
      (`.stat-value` = bare number or the "not computable" dash, unit in `.stat-unit`).
- [x] **R-D (was d) — POS-aware lookup for inflected forms**: when a Reader tap
      has no exact entry and the resolved key came from the lemma rules for an
      `-ed`/`-ing` form, the result anchors on that entry's verb section and shows
      the tapped source sentence with the result. Scope: only Reader taps on the
      lemma path — typed searches, history/suggestion clicks and exact hits are
      unchanged. Measured (WordNet "call" after tapping "called"): verb section
      y≈192 inside the visible area at 1440×900, y≈280 at 390×844, sentence block
      16px above the heading; verified in both entry dialects, including the EN–VI
      MTD `.mtd-pos` blocks for the third slot.
      `ui-check/rd-pos-lookup-smoke.js` (34 checks; reports 15 FAIL with the
      tap-origin disabled, i.e. it catches the bug).
- [x] **R-E (was e) — mobile bottom inset**: entry documents reserve 28px +
      `env(safe-area-inset-bottom)` so the last line is never flush under the
      fixed bottom nav.
- [x] **R-F (was f) — legacy `.ddbackup` verified with a real legacy file** (no
      code change needed): a v1 container (PBKDF2-SHA-256 at 150,000 iterations,
      AES-256-GCM, 16-byte salt, 12-byte IV) with 3 items imports correctly through
      the app's real import path; a legacy-shaped file written at 600,000 is
      correctly rejected (the legacy branch really derives 150,000); a new export
      (`{v:2, kdf:PBKDF2-SHA256, iter:600000}`) re-imports into a fresh install
      with the items intact. `ui-check/fix-legacy-ddbbackup-smoke.js` (18 checks).
- [x] **R-G — one fallback statement**: the "no exact entry → showing X" fact is
      stated once per panel (the panel head no longer repeats it).
- [x] Verification: 15 local runs, **0 FAIL, 281 PASS** (v62-verify 39/39,
      rd-pos-lookup-smoke 34/34 + fix-legacy-ddbbackup-smoke 18/18 new, plus the
      12 suites green) and a production health check in a fresh browser context.

**Fix-round caveats to carry forward (not open items — the fixes above are live
in v62; the deploy row has the full measurement detail)**

- At 1440×900 only one panel can show its anchored section (the two anchors are
  ~800px apart vs ~788px of usable viewport): the tapped entry owns the single
  window scroll, while the other panel still carries its marker and sentence.
- A legacy `.ddbackup` written at an iteration count other than 150,000 *and*
  with no `iter` field is inherently unrecoverable.
- The sentence block's label is baked into the entry document at render time, so
  a later language switch does not retranslate an already-rendered result.
- Geometry was measured in system Chrome headless only — no real iOS device run.

### v63 pass — Anki import + touch targets (2026-09-23 · **DEPLOYED as v63**)

> Released **v63** with `bash tools/deploy.sh`: deploy id `6ab3319a2db45e2c9a2b4a7f`,
> `sw.js` `CACHE` = **`mdx-dict-v68`**, archive
> `Dictionaries/dual-dictionary-v63.zip` (25 MB; excludes `.netlify/`,
> `node_modules/`, `dicts/`); the deploy row and health check live in
> `netlify-deploy/docs/deployment.md`. Netlify reported "Deploy is live!" — CDN diff
> uploaded 6 changed assets, build **7.3s with no plugin step** (no Lighthouse runs
> on deploys any more; **no Lighthouse report exists for v63** — measure manually).

- [x] **Anki import fix (user-facing bug)**: a standard Anki `.txt` export
      (`#separator:tab`, `#html:true`, `#columns:Front<TAB>Back<TAB>Tags`) imported
      nothing and reported "No rows found — expected front<TAB>back per line". Two
      causes in `js/store.js` `parseDeckRows()`: the `#columns:` directive was split
      on commas although Anki separates column names with the file's own separator,
      and Anki's column names (`Front`/`Back`/`Tags`) are not this app's export field
      names, so every row was skipped. Now the directive is split with the file's
      separator and adopted as a field mapping **only** when the names are this app's
      export fields; otherwise the header-less Anki path runs (front → text, back →
      meaning/translation plus the context sentence when sentence-shaped, third column
      → tags). New `ui-check/fix-anki-headers-smoke.js` (20 checks), proven to catch
      the bug: **13/20 on the pre-fix code, 20/20 after**.
- [x] **Touch targets to 44px**: full inventory of 509 controls across every route and
      overlay at 390×844 → 25 controls were under 44px, now **0**. Includes the panel
      expand/collapse toggle (24.9×32 → 44×44), the header brand mark (30×30 → 44×44),
      the search input (34 → 44 tall), the Vault row checkbox tap area (25×28 → 44×44
      via a label wrapper; two related bugs fixed: CSS padding never enlarges a drawn
      checkbox glyph, and `<a class="btn-…">` is inline so its own `min-height` was
      ignored — now `display:inline-flex`), plus selects, `<summary>` rows,
      bulk-action buttons and filter pills. Verified no horizontal overflow at 390 and
      360 px.
- [x] **`.dict-lic` licence chip raised to the 24×24 AA floor** (was 20.5px tall) at all
      widths; the panel head at 390px is unchanged in shape and the audit now measures
      the chip instead of exempting it (`AA-FLOOR CONTROLS — measured against 24×24,
      NOT exempted`).
- [x] **Live download progress in the first-load card**: while the dictionaries
      download, the card the user clicked shows live progress from the shared formatter,
      e.g. `Downloading WordNet 3.1… 34% (3.6 MB of 10.6 MB) · 0.1 MB/s · ≈ 2 min left`
      (VI: `Đang tải …`), updating continuously; before the first byte it keeps the
      honest one-time size line, and it ends on a ready line. Verified under CDP
      throttling at 500 kbps on both viewports — on mobile the panel status line sits
      behind the fixed bottom nav while the card's line is on screen, which is why this
      mattered. Related bug fixed: `updateEmptyStateCopy()` used to fall through to the
      idle wording as soon as a dictionary attached, so after a successful load the card
      still read "No dictionary is loaded yet…".
- [x] Verification: 19 local runs, **0 FAIL, 302 PASS** (fix-anki-headers-smoke 20/20,
      touch-target-audit `0 of 509 under-sized` with 2 controls measured against the AA
      floor, fix-touch-targets-hit-test all hit-target checks PASS,
      gap3-download-progress-verify 52 PASS/0 FAIL, v62-verify 39/39, plus the older
      suites green, sw-version-check PASS at `mdx-dict-v68`) and a production health
      check in a fresh browser context — including a **real Anki import on the live
      site**: 3 items imported with the right text/translation/tags.
- [x] **Closed in v64 — gate dynamic copy now fully VI**: the
      first-run gate's dynamic copy (CTA, size list, cancel/failed strings) has no VI
      strings; only the card's progress line is translated (`Đang tải …`).
- [x] **Closed in v64 — slot 3 now has the `.dict-lic` element**: the
      EN–VI OVDP/MIT attribution never renders in the third panel head although
      `LICENCES['star_anhviet.mdx']` exists, so that dictionary ships without its
      in-app attribution.

### v64 pass — VI gate copy + slot-3 chip + feedback link (2026-09-24 · **DEPLOYED as v64**)

> Owner directive: absolute no-tracking (no counter, no pixel — even cookie-less). Feedback = user-initiated mailto only.

- [x] VI dynamic gate copy (CTA + size list + `chưa rõ dung lượng` fallback + card progress + checking/cancelled/failed/unreachable) via `firstload.*` new keys + `i18nFmt()` — EN unchanged
- [x] Slot 3 `.dict-lic` chip (OVDP EN–VI MIT attribution; hidden for unknown files)
- [x] Volunteer feedback mailto in footer + Stats footer (quiet, user-initiated)
- [x] ux-pack-smoke assertion updated: footer now has 3 quiet support links
- Verify: local 19 runs 0 FAIL (302+ PASS), live slot-3 chip MIT 24px + VI card progress + feedback links + 0 page errors
- [ ] **Open (low) — `probeDictionarySizes()` intermittently misses Content-Length from the CDN**: CTA flips between `≈ 12.7 MB` / `≈ 10.6 MB` / retry mode; direct curl shows correct headers both files → HEAD probe/retry path needs a look. User-visible impact: retry click instead of honest size (download still works).

### v65 pass — feedback moved into About, footer coffee kept (2026-09-24 · **DEPLOYED as v65**)

> Owner directive 2026-09-24: two stacked support lines in the footer felt
> unreasonable/annoying. Decision: **keep** the "buy me a coffee ☕" footer link
> (U17 unchanged); the feedback ask should be subtle — one opt-in line, out of
> the main flow. This supersedes the footer+Stats feedback mailto part of v64.

- [x] **Feedback ask removed from footer AND from the Stats view** (it was the
      same sentence twice: `#feedback-link`, `#feedback-link-stats`),
- [x] **One opt-in line at the end of the About details** (`about.feedback`,
      EN+VI): "If this app helps your study, I'd genuinely like to hear it —
      one email is enough." / "Nếu app giúp bạn học tốt hơn, mình rất muốn
      nghe — một email là đủ." No emoji, no screenshot request; still a plain
      user-initiated mailto (absolute no-tracking unchanged).
- [x] i18n: `foot.feedback` removed EN+VI; dead widget-era CSS dropped
      (`.support-note`, `.support [data-name="bmc-button"]`).
- [x] ux-pack-smoke assertion updated (0 feedback in footer/Stats + exactly 1
      mailto in About + 1 coffee footer link + 2 `.support-link` total).
- Verify: local 20 suites **0 FAIL** (ux-pack 39/39, gap3 52 PASS on retry —
  first run died mid-suite on an environment flake, not a regression);
  live health (fresh context EN+VI): sw `mdx-dict-v70`, footer = coffee +
  legal + offline only, About renders the new line in both languages,
  2 `.support-link` in the DOM, 0 page errors. Deploy id
  `6ab528a91040035f08a558b0`; the deploy row is in `docs/deployment.md`.

## Deferred / out of scope for now

- **R5 built-in AI (Gemini Nano / Translator API)** — dropped 2026-09-25: the
  ~22 GiB disk prerequisite and browser-managed model download do not fit most
  users or the app's lightweight identity. Plan kept at
  `work/briefs/2026-09-25-v70-builtin-ai.md`. Revisit when on-device AI is
  lighter (smaller models, Safari/Firefox support) — the AI clause stays
  "BYO-key only" until then.
- Cloud sync across devices (violates offline-first; the opt-in file-based E2EE variant is Phase 5-H)
- (EPUB/PDF moved to Phase 5-E)
- EN/VI bundled dictionaries (user can load their own .mdx; keep the app
  dictionary-agnostic)

## Phase 6 — Retention & voice (owner-approved 2026-09-24, order: IPA → A → B → D → AI)

> Owner directive: keep the sequence A (review reminders) → B (FSRS) →
> D (speaking) → built-in AI enhancement, with **bundled IPA flagged as very
> important** — slotted first as R1 because it is small, independent, and lifts
> every panel (headwords are English regardless of dictionary). Each release:
> build → verify → owner-gated deploy → record in `docs/deployment.md`.

- [x] **R1 — Bundled IPA (v66, DEPLOYED 2026-09-25)**: open-data IPA lookup so
      `#pron-strip` shows real IPA for most English headwords across all panels
      (`data/ipa-en.json`, 149,600 keys / 3.83 MB, from thichhoc-org/
      thichhoc-dict v0.9.0 — code MIT, data CC BY-SA 4.0 — plus a CMUdict fill
      for function words; only pronunciations extracted, no definitions).
      Lazy-cached like the PDF engine (NOT precached); attribution in
      NOTICE.md + About. Deploy id `6ab5ec81f4c677e9aaf3c93c`, sw
      `mdx-dict-v71`; `ui-check/ipa-smoke.js` 12/12; battery 21 suites 0 FAIL.
- [x] **R2 — Review reminders (A) (v67, DEPLOYED 2026-09-25)**: local-only,
      opt-in (default OFF; permission only via the Advanced toggle or a
      one-time quiet onboarding link — never at boot). OS app badge mirrors
      the review badge; quiet due banner ≤1/24h with dismiss; closed-app
      notification ONLY via Periodic Background Sync on installed
      Android/desktop-Chrome PWAs (browser-chosen timing), iOS = in-app only —
      stated honestly in the Advanced status line. SW reads IDB read-only at
      the current version; 12h guard + lang in `mdx-dict-meta` (survives SW
      activations after the in-release hotfix). Deploy id
      `6ab5f58f2f2b7b82bc40f3a1` (+ hotfix redeploy), sw `mdx-dict-v73`;
      `ui-check/reminders-smoke.js` 20/20; battery 22 suites 0 FAIL. Owner
      device test pending (real closed-app nudge needs an installed PWA).
- [x] **R3 — FSRS (v68, DEPLOYED 2026-09-25)**: plan B — FSRS-4.5 with
      default weights + the `reviews` log written from day one (not
      backfillable; the optimizer can be trained later). IDB v2→v3 adds ONLY
      the empty reviews store; `warmInitFsrs` starts old items from the
      interval their Leitner box earned and never resets a due date. know→Good
      (interval ≈ stability days), forgot→Again (keeps the 10-min drill).
      Deploy id `6ab61613b6507a69a6647603`, sw `mdx-dict-v74`;
      `ui-check/fsrs-smoke.js` 14/14; battery 23 suites 0 FAIL.
- [x] **R4 — Speaking practice (D) (v69, DEPLOYED 2026-09-25)**: browser's own SpeechRecognition (one-shot, en-US,
      feature-detected — hidden entirely when unsupported). Practice's
      fall-through drill becomes **"Say it aloud"** (see the word, speak, hear
      ✓/✗ Heard) with a sample-hear button; the pron strip gains a 🎤 mic
      checked against the current word. No AI server — but honest disclosure
      in the tooltips: Chrome sends the audio to Google, Safari to Apple.
      sw `mdx-dict-v75`; `ui-check/speech-smoke.js` 9/9 (stubbed
      SpeechRecognition: match/mismatch/error paths + unsupported case);
      battery 24 suites 0 FAIL. Deploy id `6ab670a1fd7a433e2b5a0aae`, sw
      `mdx-dict-v76` — the same release refreshed Help/About/onboarding + SEO
      (JSON-LD EN+VI, VI landing/meta/FAQ) for ALL of Phase 6, per the owner's
      standing directive. Live health 6/6. Archive `dual-dictionary-v69.zip`.
- [x] **R5 — Built-in AI enhancement: DROPPED (owner decision 2026-09-25)**.
      The plan (`work/briefs/2026-09-25-v70-builtin-ai.md`) was written and
      verified against the shipping APIs (Prompt API/LanguageModel stable in
      Chrome 148, Translator API with `vi`), but the owner rejected it: the
      Gemini Nano prerequisites (~22 GiB free disk, browser-managed ~2 GB
      model download outside the app's control) do not fit most users —
      especially on modest hardware — or the app's lightweight 25 MB identity.
      The AI clause stays UNCHANGED ("BYO-key only"). Revisit only when
      on-device AI gets lighter and more universal (see Deferred).

- [x] **v70 — Quality close-out (DEPLOYED 2026-09-25, deploy id `6ab6857f4e0342b46093a204`, sw `mdx-dict-v77`, archive `dual-dictionary-v70.zip`)**.
      Lighthouse re-measured manually on production after 8 releases without a
      score (plugin removed at v61): **Perf 72 (run2: 85) / A11y 100 / BP 96 /
      SEO 100** — budget ≥85 breached by CLS **0.18–0.39** (budget ≤0.1).
      Root causes (Playwright + trace, mobile-throttled): (a) `#search-gate-note`
      flashed in at boot above the download card; (b) `view-switch`, `both-hint`,
      `dict-grid` keyed on non-idle — boot passes idle→loading→idle, flashing
      them on and off (±196px); (c) `#empty-state` min-height flipped 0↔24rem
      between idle/loading; (d) reserves under-sized (`3em` < 2 lines at fs-sm,
      and `min-height` ignored on inline `<strong>`). Fixes: gate-note
      pre-rendered with `data-i18n`, view-switch/both-hint gated on "ready",
      grid gated on `ready` OR `data-downloading` (new depth-counted flag set in
      `quickLoadOne`), min-height flip removed, reserves recomputed
      (`display:block; 5.1em` msg, `3.4em` sizes, `calc(3em + 18px)` gate-note).
      Local re-measure: **CLS 0.025–0.028, Perf 83–84** (local FCP/SI worse than
      prod CDN; re-measure on production right after deploy). Also closed the
      v64 open item: `probeDictionarySizes()` now embeds `KNOWN_DICT_SIZES`
      (samples/wordnet31.mdx 11,094,719 B, samples/simple-en.mdx 2,222,808 B —
      verify if samples are ever rebuilt) as fallback for 200-without-
      Content-Length at a cold edge, and probes slots in parallel. Owner
      device-test checklist added: `docs/device-test-checklist.md`.
      sw `mdx-dict-v77`. **DEPLOYED + VERIFIED**: battery 24 suites 0 FAIL;
      live health ×3 (fresh context): sw v77, gate 12.7 MB, 0 page errors;
      **Lighthouse production post-deploy ×3: Perf 94/92/97, CLS 0.023–0.039,
      A11y 100, BP 96, SEO 100** — budget met with margin (full record in
      `docs/deployment.md` row v70).

- [x] **v71 — On-device FSRS weight optimizer (DEPLOYED 2026-09-25, deploy id `6ab6912e9f74e18041f1c494`, sw `mdx-dict-v78`, archive `dual-dictionary-v71.zip`)**.
      The batch-B "optimizer skeleton" delivered as an IN-APP feature instead of a
      Node harness — the review log lives only in the owner's browser (IndexedDB is
      per-profile), so an external script can neither read it nor write trained
      weights back where they matter. Architecture: new `js/fsrs-opt.js` (the single
      optimizer source, lazy-imported only when the user clicks) fits the 17 FSRS-4.5
      weights to the owner's own review log with the official BCE objective + L2 pull
      toward defaults; replay mirrors gradeById exactly (first contact through the
      R(0)=0.995 forgetting-curve branch, same-day short-term, warm-start items).
      ⚙ Advanced gains an "Adaptive review scheduling" section (EN+VI): live count of
      logged reviews with an honest verdict (unlocks at 200, best from 400), one-click
      Optimize (applies immediately, persists `{version:1, weights, trainedAt,
      reviews, bce0, bce1, lambda}` into `files`['fsrs-custom-weights']), one-click
      Reset. `store.js` gains `applyFsrsWeights`/`resetFsrsWeights` (element-wise
      mutation of the exported FSRS_W, strict validation — garbage falls back, never
      half-applies); `boot()` applies persisted weights before anything schedules and
      exposes `<html data-fsrs-weights="default|custom|default:invalid|default:error">`;
      `db.js` gains read-only `allReviews()`. Boot-loader + full UI flow verified by
      the new `fsrs-weights-smoke.js` (12 checks: default/custom/invalid markers,
      optimize → marker + blob + honest status, reset → clean); `fsrs-optimizer-smoke.js`
      imports the shipped module in Node via a temp .mjs copy and enforces
      weight/formula parity with store.js + the synthetic round trip (BCE 0.386→0.351,
      recovered weights closer to truth than defaults). Help (EN+VI) and About
      features refreshed per the standing directive. sw `mdx-dict-v78`, fsrs-opt.js
      precached. Battery 26 suites 0 FAIL. **DEPLOYED + VERIFIED**: live health ×3 (sw v78, marker default, honest 0-review status, button correctly disabled, 0 page errors); Lighthouse production ×2: Perf 97 / A11y 100 / BP 96 / SEO 100, CLS 0.039 — no regression. Full record in docs/deployment.md row v71.

- [x] **v72 — Phase 7 P1: YouTube transcript → Reader (DEPLOYED 2026-09-26, deploy id `6ab6feab2dcca90c91389187`, sw `mdx-dict-v79`, archive `dual-dictionary-v72.zip`)**.
      Spec `docs/phase7-spec.md`. The owner's original "paste a link → auto-fetch captions"
      is impossible client-side (YouTube sends no CORS headers — browser security, not a
      bug), and the compliant alternatives (third-party CORS proxy, YouTube iframe
      player) violate the no-tracking DNA — so P1 is the one-paste flow: Reader gains a
      🎬 YouTube transcript button + dialog (optional video link as the source label +
      transcript paste). `parseTranscript()` detects and cleans three formats — YouTube
      transcript copies (bare m:ss lines, ≥3 to trigger), SRT/VTT (arrows/sequence/
      header stripped), plain text passthrough — re-flowing cues into readable
      paragraphs (break at sentence end after ≥40 words or hard at 80) and collapsing
      adjacent duplicate cues. Timestamps never reach the reading pane; tap-to-lookup,
      Save sentence and Save offline work unchanged (snapshot keeps the video link via
      #reader-url). Pasting a transcript into the MAIN textarea is auto-cleaned too.
      Phase 2 (optional, deferred): bring-your-own Invidious/Piped instance for
      link→caption auto-fetch, in the spirit of BYO dictionaries. **Bonus latent-bug
      fix**: #btn-reader-start sat inside #reader-input-wrap, which readerRender hides
      while reading — the "Re-edit text" toggle branch of startReading() was
      unreachable; the button is now a sibling and serves both states (and the word
      count line is visible while reading). Help quick-start (EN+VI) + JSON-LD
      featureList refreshed. New `yt-transcript-smoke.js` (11 checks). sw
      `mdx-dict-v79`. Battery 27 suites 0 FAIL. **DEPLOYED + VERIFIED**: live health ×3
      (sw v79, dialog opens, live transcript parsed on production with timestamps gone
      and the link source label, 0 page errors); Lighthouse ×2 Perf 98/97 / 100 / 96 /
      100, CLS 0–0.039 — best recorded scores. Full record in docs/deployment.md v72.

- [x] **v73 — Advanced dialog → three tabs (P2-01 lite; DEPLOYED 2026-09-26)**.
      The owner flagged ⚙ Advanced as overloaded (seven <details> sections mixing
      dictionary setup, data care and study behaviour). Restructured into a segmented
      control — **Dictionaries / Data / Learning** — with a context-based default tab
      (Dictionaries while no dictionary is loaded, Learning afterwards; set in
      renderAdvStatus). "How loading works" becomes the condensed 3-line hint + guide
      link at the bottom of the Dictionaries tab (full text unchanged at
      data-loading-guide.md). All element IDs preserved (pure visibility plumbing +
      `setAdvTab`); `.adv-tab` mirrors the view-switch segmented pattern incl. the
      dark-mode near-black accent label. "Advanced"→"Settings" rename considered and
      deferred (touches nav labels; owner can bundle it later). Suites updated for the
      new geometry: reminders-smoke + fsrs-weights-smoke select the Learning tab (+1
      check: no-dicts default tab), p5-smoke + fix-legacy-ddbbackup-smoke select the
      Data tab; e-smoke now BUILDS its own /tmp EPUB+PDF fixtures (the old ones were
      /tmp leftovers lost between sessions). sw `mdx-dict-v80`. Battery 27 suites 0 FAIL. **DEPLOYED as part of the v73–v77
      single release** (deploy id `6ab70c1d8a010d0599a15c7f`).

- [~] **v74–v77 — Study features batch (owner order 2026-09-26; PREP DONE, PENDING DEPLOY; sw `mdx-dict-v84`)**.
      Four features, each placement AUDITED with real mobile+desktop screenshots per the
      owner's request (all four hold; details below). New `study-batch-smoke.js` (16 checks)
      covers the whole batch end-to-end; battery 28 suites 0 FAIL. **DEPLOYED +
      VERIFIED**: live health ×3 (tabs + defaults, journal, cue card, listening
      dialog, pace clock — 0 page errors); Lighthouse ×2 Perf 97/94 / 100 / 96 /
      100, CLS 0.023–0.039. Full record in docs/deployment.md row v73–v77.
      - **v74 Reading pace (Reader toolbar)**: live `⏱ elapsed · words · wpm` span driven
        by a session-only timer that starts when a document renders and STOPS itself the
        moment the pane is hidden (re-edit / another route) — only real reading time
        counts; wpm appears after 15s. Bug found by its own smoke: the timer originally
        started BEFORE the pane unhide, so its first tick killed it (start moved after
        unhide).
      - **v75 Writing journal (Vault → ✍ Journal tab)**: editor + live word count +
        IELTS Task 2 40:00 countdown (start/pause/reset at zero) + one-click save into
        the Vault. Entries are plain items (type sentence, tag `journal`, status `known`,
        due never) — Vault search/notes/decks and export/import cover them for free, and
        `known` keeps them out of the review queue (a journal is not a flashcard). Entries
        list with date + word count + delete; duplicate text is reported, not re-saved.
        Placement rationale: entries ARE vault items (owner asked "lưu bài vào Vault"), so
        the editor lives next to them; the 6-tab row wraps to two lines on mobile —
        accepted, revisit only if it bothers.
      - **v76 Speaking (Practice)**: 🎤 cue card — 24-prompt bank, 1:00 prep → 2:00 speak
        countdowns, browser's own recognition reads the attempt back for self-assessment
        (free speech has no single right answer, so no scoring); the card works with zero
        saved items. Plus `spokenCoverage()` — sentence-level, in-order word-boundary
        coverage — used for say-aloud drills whose target is ≥6 words (≥80% reads as
        correct, percentage shown); word drills keep the strict `spokenMatch`.
      - **v77 Listening (Reader → 🎧 Listening)**: the user's own audio file + pasted
        transcript (YouTube copy / SRT / VTT / plain via `parseTranscriptCues`, the
        timestamp-keeping sibling of `parseTranscript`). Cue lines render in the reading
        pane with words still tappable for lookup; tap a line to seek; the playing line
        highlights and follows via timeupdate. The audio is a session-only object URL on
        the device — nothing uploaded, nothing persisted (a multi-MB media file is not
        silently duplicated into IDB); leaving reading mode ends the session.
      - Placement audit (screenshots at 390×844 + 1440×900): tabs look clean on both
        viewports with the context-based default tab; timer sits in the toolbar;
        journal-as-Vault-tab co-locates editor and entries; cue card usable with no
        items; listening dialog honest about session-only audio. One PRE-EXISTING quirk
        observed, not from this batch: on a no-dictionary profile the download card
        shows below Reader content (idle-state coexistence) — recorded as a cosmetic
        residual, untouched.

- [x] **v78 — Student-review fix pass (DEPLOYED 2026-09-26: deploy id `6ab71df0552deadef7399f7b`, sw `mdx-dict-v85`, archive `dual-dictionary-v78.zip`)**.
      The owner's student role-play review of live v77 (IELTS coverage re-estimated
      ~55–60%, up from the teacher review's ~30–35%) surfaced six friction points; the
      top three are fixed here, the rest triaged as v79 candidates:
      1. **EN–VI discoverability** — the one-click EN–VI loader lived only in the
         first-load card, which hides the moment a dictionary attaches, so the students
         who need Vietnamese meanings most lost it by doing the expected thing. A quiet
         one-line hint now sits above the panels while a dictionary is loaded and slot 3
         is empty (`envi.hint` EN+VI, same one-click handler, ✕ dismiss remembered in
         localStorage, auto-hides when slot 3 fills or nothing is loaded).
      2. **Cue card skip-prep + honest timers** — during prep the primary button becomes
         "I'm ready — speak now" (jumps straight to the speak window; Stop reset was the
         only option before). All countdowns (cue card prep/speak, journal Task 2) are
         now DEADLINE-based (`deadline − Date.now()`) instead of per-tick decrements —
         background-tab throttling fired setInterval late and the clocks visibly fell
         behind the wall clock (observed by the owner: 0:58→0:40 over a real minute).
         Task 2 gains a clean pause/resume (⏸/▶ with remaining time kept).
      3. **Stats label** — "Leitner box average" (stale since the v68 FSRS switch) is now
         "average FSRS box equivalent" (EN+VI).
      v79 candidates (triaged, not scheduled): mini-cloze for sentence review cards;
      Enter-in-search behavior (search directly when suggestions are closed); word-link
      affordance on Review cards (dotted underline + tooltip).
      New `v78-ux-smoke.js` (12 checks incl. a real local quick-load to prove the hint
      appears with slot 3 empty). Battery 29 suites 0 FAIL (gap3 flaked once, 52/52 on
      re-run — known environment flake since v65). **DEPLOYED + VERIFIED**: live health
      ×3 (sw v85, hint hidden pre-load, skip-prep jumps to speak, no Leitner in Stats,
      0 page errors); Lighthouse ×2 Perf 98/94 / 100 / 96 / 100, CLS 0–0.023. Full
      record in docs/deployment.md row v78.

## Hackathon local candidate — 27 October 2026

Offline Lesson Studio MVP implemented on v143 baseline; not deployed. New /lessons/ author/review/offline learner workflow, strict packs, isolated storage and explicit Meta calls. See docs/LESSON-STUDIO.md and NEW-WORK.md for scope, real pilot failures, verification and remaining curation. Production remains v143; candidate cache v120.

Quality process added 27 October: exact-payload editorial gate, 17-criterion reviews, original/corrected evidence and offline candidate previews; see docs/HACKATHON-QUALITY-PROCESS.md. Three candidates ready for editor approval, not approved/deployed.
