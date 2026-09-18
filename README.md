# Dual Dictionary

Offline-first English dictionary for study and research.

Live app: [dualdictionary.netlify.app](https://dualdictionary.netlify.app/)

Dual Dictionary is a browser-based PWA that brings two dictionary sources into
one search workflow. When both sources are available, it can show WordNet 3.1
and Simple English Wiktionary side by side. The app also supports an optional
English–Vietnamese dictionary, reading mode, saved words, saved sentences,
browser text-to-speech, and user-provided `.mdx` / `.mdd` files.

## Highlights

- Parallel lookup across WordNet 3.1 and Simple English Wiktionary
- Optional open English–Vietnamese dictionary add-on
- Phrase and multi-word search
- Reading mode with tap-to-lookup and saved sentences
- Saved words with lightweight review actions
- PWA installation and offline use after dictionary data finishes downloading
- Local-first storage with no account required
- Bring your own authorized `.mdx`, `.mdd`, and optional `.css` files

## Run locally

This is a static app with no build step. Serve the repository with any static
HTTP server, then open the local URL in a modern browser. Opening `index.html`
directly may prevent service-worker and local-file features from working.

For deployment notes, see [`docs/deployment.md`](docs/deployment.md).

## Dictionary data and licensing

The public sample dictionaries are open-licensed. See [`NOTICE.md`](NOTICE.md)
for attribution and license details. Commercial dictionaries are not bundled;
users must load only files they are authorized to use.

The app is provided for personal study and research. Check the applicable
license terms before redistributing code or dictionary data.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the current direction, including the MDX-first
reader workflow and future study features.
