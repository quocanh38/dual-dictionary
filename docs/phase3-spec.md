# Phase 3 Spec — Study pillar as a 4-layer system

> Status: **approved** (2026-09-20). This document replaces the old
> "SRS (SM-2)" placeholder in ROADMAP.md.
> Layers: **Lookup → Context → Vault → Review.**
> The app is NOT a course and NOT a standalone flashcard app. It is a personal
> English OS: every saved item starts from the user's own reading/lookup
> context, and everything lives on the user's device.

## 0. Locked decisions for Phase 3 (approved 2026-09-20)

- **Status set**: `new | learning | known` (on `userData.status`).
  "Review later" is a **tag**, not a status.
  Legacy scheduling fields `box` (Leitner 1–6) and `due` are kept as hidden
  fields — "Needs review" = `due <= now && status !== 'known'`. The existing
  Leitner grading code is never deleted; it is hidden behind the status model.
- **Release split**: Release A (storage, invisible) ships and passes health
  check BEFORE Release B (IA rework) is built. One release at a time,
  fix-forward, health check + `docs/deployment.md` after each deploy.
- **Phrase capture MVP**: save phrase from the **Search** box (phrase search
  already works). Reader keeps single-word + sentence; tap-tap/drag selection
  in Reader is deferred to a later release.
- **"Meaning in this context" (Context layer)**: context **display only** —
  show the saved/original sentence with the word highlighted above the entry,
  plus "Add example". Sense disambiguation paraphrase („called off =
  cancelled") is P2 and only ever via BYO-key AI in the browser.
- History stays an ephemeral log in localStorage (24 chips). Batch actions
  live in the Vault, not in History.

## 1. LearningItem schema (v3)

Every saved thing — word, phrase, or sentence — is one record type.

```ts
interface LearningItem {
  id: string;                       // crypto.randomUUID()
  type: "word" | "phrase" | "sentence";

  text: string;                     // exact text as saved (word, phrase or sentence)
  normalizedText: string;           // see 1.1 — duplicate detection key

  context?: {
    sentence?: string;              // original sentence containing the item
    headword?: string;              // for sentence items: the word tapped
    sourceTitle?: string;           // reader source ("pasted", page title…)
    sourceUrl?: string;             // when the source is a URL
  };

  dictionary?: {                    // snapshot captured at save time (optional)
    definition?: string;
    translation?: string;
    partOfSpeech?: string;
    ipa?: string;
    audio?: string;                 // .mdd resource key or "tts" — NEVER a blob URL
  };

  userData: {
    note?: string;
    tags: string[];                 // suggested: work, travel, conversation,
                                    // academic, slang, review-later
    status: "new" | "learning" | "known";
  };

  createdAt: number;                // ms epoch
  lastReviewedAt?: number;
  reviewCount: number;              // number of review interactions

  // hidden legacy scheduling (Leitner) — kept for "Needs review" math
  box: number;                      // 1..6
  due: number;                      // ms epoch; intervals [1,2,4,9,20,45] days
}
```

### 1.1 normalizedText spec

Used for duplicate detection and (later) Vault search:

1. Unicode NFKC casefold
2. trim, collapse all whitespace to single spaces
3. strip surrounding/leading punctuation (keep in-word `-` and `'`)
4. sentence items additionally: strip the trailing punctuation run (`.` `!` `?` `…`)

### 1.2 Audio rule

`dictionary.audio` stores either a **.mdd resource key** (resolvable when the
owning dictionary is loaded) or the literal string `"tts"` (speechSynthesis).
Blob URLs die on reload/export and must never be persisted.

## 2. Storage (Release A)

- IndexedDB `mdx-dict`, **version 2** (db.js owns `openDb()` and the schema
  upgrade; both stores are created in the same upgrade transaction):
  - `files` — unchanged KV store for dictionary blobs (existing)
  - `items` — keyPath `id`, indexes:
    - `normalizedText`
    - `type`
    - `userData.status` → named `status`
    - `userData.tags` → named `tags` (multiEntry)
    - `due`
    - `createdAt`
- `localStorage` keeps only small settings: `view`, theme, history chips.
- Caps lifted by IndexedDB: sentences no longer capped at 200. History cap 24
  unchanged.

## 3. Migration plan (one-way, idempotent, reversible)

Source data (localStorage): `vocab` `[{word, box, due, addedAt}]`,
`sentences` `[{word, sentence, source, addedAt}]`.

Steps, executed once at boot before any render:

1. If the `items` store already contains any item with `sourceTag === 'migration-v3'`,
   skip (idempotent — a partially-completed run never duplicates).
2. Take a **backup snapshot** of the raw localStorage arrays into the IDB
   `files` store under key `backup-pre-migration-v3` (JSON blob).
3. Map `vocab` entries → items `type:'word'`:
   `status = box >= 2 ? 'learning' : 'new'`, `box`, `due`, `createdAt = addedAt`,
   `sourceTag = 'migration-v3'`.
4. Map `sentences` entries → items `type:'sentence'`:
   `text = sentence`, `normalizedText` per 1.1, `context = {sentence,
   headword: word, sourceTitle: source}`, `box: 1`, `due = now + 1 day`
   (context sentences are NOT scheduled immediately, so a first migration does
   not flood the Review badge/queue; a one-time repair fixes older data), `status: 'new'`.
5. Deduplicate inside the batch by (`type`, `normalizedText`).
6. Mark done: `localStorage.setItem('migrated-v3', <iso date>)`.

**Rollback policy** (aligned with fix-forward): the original localStorage keys
`vocab` / `sentences` are **never deleted** — they are the primary rollback
copy. The app stops reading them only after a successful migration. If
Release A must be reverted, redeploying the previous zip restores an app that
reads localStorage again; nothing was lost.

**Import files, not just export**: the import accepts
- v2 files (`{words, sentences}` — the current export format), and
- v3 files (`{items}`).
Merged into the `items` store with duplicate detection by
(`type`, `normalizedText`); older local data wins on conflict.
This closes the "export/import JSON replaces cloud sync" loop.

## 4. Phasing

### Release A — Foundation (invisible to the user) ← current

- [x] `js/store.js`: openDb v2 schema, LearningItem CRUD, duplicate detection
- [x] Migration of localStorage vocab/sentences → items (§3)
- [x] Save service rewired: save word (☆/★), save sentence, grade (know /
      forgot), remove — identical UI, IndexedDB underneath
- [x] Export JSON **v3** (`{items}` + derived v2-compat `words`/`sentences`
      arrays so nothing external breaks)
- [x] Import v2/v3 (in ⚙ Advanced), merge with dedupe
- [x] sw.js cache bump
- Accept: existing flows work identically; data survives a localStorage wipe
  (stored in IndexedDB); export/import round-trip v2⇄v3 without loss.

### Release B — Information architecture (visible) — shipped v43, 2026-09-20

- [x] Routes (hash): Search / Reader / Vault / Review (+ Settings in ⚙)
- [x] Mobile bottom nav `Search | Reader | Vault | Review`
- [x] Vault: tabs All / Words / Phrases / Sentences / Needs review; cards with
      audio, look-up, `•••` → item editor dialog (edit note, tags, status,
      delete, export); multi-select (Review now / Add tag / Mark as known /
      Export / Delete); empty state per spec draft
- [x] Regression: ui-check capture/diff before + after — desktop 0.072%
      (all changed regions inside the topbar = the new nav); mobile residual
      is the intended topbar-slim cascade (buttons moved to bottom nav)
- Accept: the loop *look up in Reader → save with context → back in Vault →
  30-second review* runs in ≤ 6 taps. (Save via ☆, Vault via ★ nav, Review
  queue one tap away from the Vault select bar.)
- Note: the spec draft's per-card ••• popover was collapsed into one item
  editor dialog (note/tags/status/delete/export) — fewer moving parts, same
  capabilities. Phrase capture MVP = save phrase from the Search box
  (multi-word input → `type: 'phrase'`), per the approved scope.

### Phase 3+ — Context layer (P1) — shipped v44, 2026-09-20

- [x] Saved/active sentence shown highlighted above the entry; "Add example"
- [x] Context metadata captured on every save (sourceTitle/sourceUrl)
- [ ] No-heuristic sense disambiguation; BYO-AI paraphrase is P2 optional

### Phase 4 — Export (P1) — shipped v45, 2026-09-20

- [x] CSV / TSV / Anki-compatible text, field selection, in the Vault

### Phase 5 — Micro-exercises (P1) — shipped v45, 2026-09-20

- [x] 5–10 item sessions from saved data: multiple choice, listen & type,
      cloze, dictation
- [x] States only: new / review-later(tag) / known; "Review again / Got it"

### Phase 6 — Pronunciation (P2) — shipped v45, 2026-09-20

- [x] US/UK IPA when data exists, 0.75× playback, stress marking, sentence
      replay. No speech recognition/scoring yet.

## 5. Explicitly out of scope (unchanged)

Account & cloud sync, social sharing, streaks/gamification, bulk AI-generated
examples, grammar courses, heavy SRS (SM-2/FSRS), speech scoring, bundling
commercial dictionary data.

## 6. MVP success metric

One loop, measured: *tap a word in Reader → saved with its sentence → open
Vault → complete one review item* in ≤ 6 taps and ≤ 30 seconds on mobile.
