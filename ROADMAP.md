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

### Phase 0 — Ship the current fix (now)

- [ ] Deploy `netlify-deploy` (v34) to production
- [ ] Verify live: `remote-config.json` 404 gone, honest empty-state + retry
- [ ] Optional: silence `/dicts/*.mdx` probe 404 console noise

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
- [ ] EN-VI UI strings (i18n layer — separate, later)
- Principle: the app stays dictionary-agnostic; commercial .mdx (Lạc Việt…) stay
  bring-your-own. Open data ships; proprietary data never does.
- Accept: a Vietnamese user gets full EN–VI lookup in one click, offline after
  one download, with clean licensing.

### Phase 3 — Study pillar

- [ ] SRS (SM-2) over saved words **with their saved sentences**
- [ ] Stats: words learned, retention, sources read
- [ ] Export/import: one file containing vocab + SRS progress
- [ ] (Later, optional) AI explanation of a saved sentence, BYO-key
- Accept: from reading to long-term memory without any account or cloud.

## Deferred / out of scope for now

- Cloud sync across devices (violates offline-first; revisit as file export first)
- EPUB/PDF parsing engines (heavy; re-evaluate after reader-lite proves demand —
  paste-text covers most study reading)
- EN/VI bundled dictionaries (user can load their own .mdx; keep the app
  dictionary-agnostic)
