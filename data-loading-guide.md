# Loading your own .mdx/.mdd dictionaries (Advanced section)

This app is a personal study & research tool — **non-commercial use only**. The app is just a
**reader**. The public build ships with two open-licensed default dictionaries,
**WordNet 3.1** (Princeton) and **Simple English Wiktionary** (CC BY-SA 4.0) — they load
automatically when you open the app (~13 MB, stored in IndexedDB on first run only).
Private deployments (with a `dicts/` folder or a remote data server) may instead load full
commercial dictionaries — in that case the data (~3 GB) is stored in IndexedDB on first run only.
The ability to load your own .mdx/.mdd files remains available under ⚙ Advanced. If you have
other `.mdx`/`.mdd` files you are authorized to use (you found/bought them yourself and are
responsible for licensing, personal use only), this guide covers **how to load them into the
app and how to handle errors**.

---

## 1. What files do you need?

Each dictionary consists of 2–3 files (the names must be **identical except for the extension**):

| Dictionary | Content file | Resource file | Stylesheet (optional) |
|---|---|---|---|
| Oxford | `OALD10.mdx` (or similar, ~50–100 MB) | `OALD10.mdd` (~1–2 GB, contains audio + images) | — |
| Longman | `LDOCE6.mdx` (~40–80 MB) | `LDOCE6.mdd` (~1–2 GB) | `LDOCE6.css` (LDOCE keeps its CSS **outside** the .mdd — without it entries render unstyled) |

- You can load only the `.mdx` (no `.mdd`) — lookups still work, just without audio/images.
- Files are often shared as `.zip` / `.7z` / `.rar` archives — **extract them first** before loading.
- For **LDOCE specifically, keep the `.css` next to the `.mdx`** — do not ignore it. Other
  loose companion files (`.js`, `.png`) are usually already packed inside the `.mdd`.

## 2. Loading into the app

### Option A — Load from URL (for study-group members, one time only)

**One URL loads the whole set.** The app fetches the `.mdx` you point at, then automatically
picks up the matching `.mdd` (audio/images) and `.css` (stylesheet) sitting next to it in the
same server folder — you never load the files one by one.

1. Open the app (the Netlify link, or [localhost:8080](http://localhost:8080)).
2. Tap the **⚙ Advanced** icon in the top bar.
3. Under **Slot 1**, paste the URL of the `.mdx` file — credentials may be embedded in it,
   e.g. `https://user:pass@your-home-server/dicts/mydict.mdx` — then tap **⬇ Load from URL**.
   The matching `.mdd` and `.css` files sitting next to the `.mdx` on the server are picked up automatically.
4. Do the same for **Slot 2** (e.g. `…/dicts/ldoce6.mdx`).
5. Done — the data (~3 GB) is saved into the app (IndexedDB). **Credentials are only needed
   for this one-time load.** After that, the app works fully offline: no login, no server.

> After loading, the panel status confirms exactly what was fetched, e.g.
> `loaded from URL — dictionary (.mdx) + resources (.mdd) + stylesheet (.css) saved in this app`.
> If it ends with `⚠ stylesheet (.css) not found`, the `.css` is missing next to the `.mdx`
> on the server — upload it there and load the URL again.

> Tip: if you load the wrong file, just load the new `.mdx` again — it overwrites the old one.

> Tip: re-loading the **same** dictionary (same URL, same name and size) is a no-op —
> the app checks before downloading and skips the multi-GB transfer with the message
> `… already loaded, unchanged — download skipped`. Loaded data lives in the app's own
> storage (IndexedDB), stored by a fixed key per slot, so files never pile up as copies
> the way repeated browser downloads do.

### Option B — Load from local files

1. Open the app ([localhost:8080](http://localhost:8080) or your HTTPS link).
2. Tap the **⚙ Advanced** icon in the top bar.
3. Under **Slot 1**: tap **📄 .mdx** → choose your `.mdx` file → then tap
   **🔊 .mdd** → choose the matching `.mdd` file (if any) → for LDOCE also tap
   **🎨 .css** → choose the matching `.css` file.
4. Do the same for **Slot 2** if you want to replace the other dictionary.
5. Close the dialog, type any word (e.g. `take`, `run up`) → both panels show results side by side.
6. Data is stored in the app (IndexedDB) — the next time you open it, **no reload is needed**.
   A manually loaded `.css` is remembered and re-applied automatically to the dictionary with
   the same base name (e.g. `ldoce6.css` ↔ `ldoce6.mdx`).
   To go back to the bundled defaults: tap **"Remove & restore default"** in the Advanced section.

> Tip: if you load the wrong file, just load the new `.mdx` again — it overwrites the old one.

## 3. Only use files you are authorized to use

The app follows the principle that standard readers (such as Medict) set: **"Only use dictionary
files you are authorized to use."** You should only load files that fall into one of these cases:

- **Files you legally bought/own** (the DVD/online-code edition of a printed book, or data
  you converted from a source you are licensed to use).
- **Official free content**: look words up directly on the web at
  [oxfordlearnersdictionaries.com](https://www.oxfordlearnersdictionaries.com) /
  [ldoceonline.com](https://www.ldoceonline.com), or buy the official OUP/Pearson apps.

> The app **does not** help you find unofficial .mdx/.mdd copies on sharing forums — that is
> copyrighted data owned by Oxford University Press / Pearson. Loading a file into the app is
> your own responsibility and decision, same as with every MDX reader.

## 4. Check the file before loading

- Open the file with a hex viewer (or let the app report it): a standard `.mdx` starts with
  the header length + XML `<Dictionary ...>`. The app shows a clear error if the file is wrong.
- The extension must be a real `.mdx`/`.mdd`, not a `.txt` or HTML file that was renamed.
- An unusual size (a few dozen KB for a "full" dictionary) → almost certainly a junk file.

## 5. Common errors and fixes

| Symptom | Cause | Fix |
|---|---|---|
| "File does not look like an MDX/MDD file" | A compressed archive (.zip/.7z) was loaded without extracting, or the file is corrupted | Extract first; double-check the file name |
| "File is passcode-encrypted (Encrypted=1)" | An mdx encrypted with a passcode (rare) | Find a **non-encrypted** copy (Encrypted="No") — the most common form. `Encrypted="2"` (key-index encrypted with a fixed key) is **supported out of the box** and loads normally |
| "This dictionary uses LZO compression" | File built with the old 1.2 engine / LZO compression | Find a 2.0-engine zlib build; or open it in MDict/Eudic and re-export |
| `.mdx` loads but tapping 🔊 plays nothing | The `.mdd` was not loaded, its name doesn't match, or the `.mdd` is from a different source | Load the matching `.mdx`+`.mdd` pair from the same source; load the `.mdd` and search again |
| Images missing, CSS broken | The `.mdd` lacks CSS/images, or (LDOCE) the `.css` was not loaded — LDOCE6 keeps its stylesheet **outside** the `.mdd` | Load the complete `.mdd` from the same source as the `.mdx`; for LDOCE also load the matching `.css` (via ⚙ Advanced file picker, or keep it next to the `.mdx` on the server and use **Load from URL**) |
| Data disappears after reopening the app | The browser evicted IndexedDB (private/incognito mode, or Safari storage cleanup) | Load again; avoid private mode; use normal Safari/Chrome |
| iOS reports out of memory while loading the `.mdd` | Safari limits stored data (device dependent) | Load only the `.mdx` (no audio), or use a trimmed-down .mdd |
| Word suggestions don't appear | The app is building the word list in the background (large files take tens of seconds) | Wait a bit; lookups work normally meanwhile |

## 6. Test dictionary (free, bundled)

The `samples/` folder contains `sample.mdx` + `sample.mdd` generated by the app itself
(4 demo words with playable audio) — use it to verify the app works before you have real files.

## 7. Online lookups

- Oxford: <https://www.oxfordlearnersdictionaries.com>
- Longman: <https://www.ldoceonline.com>

---

## 8. For study groups (private dictionary server)

The **Load from URL** feature works with any private server — for example a home NAS
serving **open-licensed dictionaries** (the same WordNet / Simple English files the app
bundles), dictionaries authored by the group itself, or content the server owner is
**licensed to redistribute** (e.g. an institution-wide license). If you received a URL
like `https://user:pass@host/dicts/wordnet31.mdx`, read this first:

- **Authorization is what makes this legal — not the password.** A password-protected
  link only controls *access*; it does not turn a copyrighted dictionary into content
  the group members are licensed to have. Only point the group at files the server
  owner is entitled to share.
- **One-time load.** After "Load from URL" finishes, the data is stored inside your
  app and works offline — you never need the URL or password again. They
  live in memory only during the download; nothing is saved or re-shared.
- **Think of the link as a key, not a secret from the internet.** The page is
  not indexed anywhere, but anyone holding the URL and password can download —
  treat it like a shared flat key: fine for the people it was given to, useless
  to leak beyond them. Don't post it publicly; rotate the password if it leaks.
- **iOS / iPadOS storage caveat:** the full `.mdd` (~1–2 GB) may fail to save on
  iPhone/iPad (Safari storage limits). If loading stops with a storage error,
  load only the `.mdx` — lookups work fine, you just lose embedded audio/images.
  Prefer Wi-Fi; don't background the app mid-download.
- **Problems?** See the error table in section 5 above; most issues are the
  archive-not-extracted or wrong-file-name cases.
