# Deployment record — Dual Dictionary (dualdictionary.netlify.app)

> Platform: Netlify · Deploy method: `netlify deploy --prod --dir .` from this
> folder (pre-built static, no build step) · Domain: dualdictionary.netlify.app

| Version | Deploy SHA | Date | Contents | Health check |
|---|---|---|---|---|
| v34 | 6aace43e9e5f64841fb7247e | 2026-09-18 | remote-config removed, honest empty-state + retry, BMC floating + inline | ✅ live smoke |
| v34 hotfix | 6aace724d538bb39d4bf850e | 2026-09-18 | BMC raised above Netlify attribution badge | ✅ overlap=false |
| v35 | 6aaced1f5128081e93262a24 | 2026-09-18 | Phase 1: probe retry, phrase search, gloss, export v2 | ✅ live smoke |
| v36 | 6aacf2cf48646f91f1068944 | 2026-09-18 | Phase 2: Reader-lite (tap-to-lookup, save sentence, Wikipedia adapter) | ✅ live smoke |
| v37 | 6aacf77f12ac4effe16e0ed2 | 2026-09-18 | Phase 1.5: open EN–VI dictionary (OVDP 386,600 entries) at `dicts-en-vi/`, 1-click buttons | ✅ live smoke (attempt 1): apple has VN meaning, "ran" → "xem run" crossref |
| v38 | 6aacfd727b97f0fa3a8be9c8 | 2026-09-18 | MTD formatter: marker-driven tokenizer renders OVDP single-line entries (@ domain, * pos, - sense, ! idiom) as structured HTML; "(xem) X" → search links; gloss uses same tokenizer | ✅ live smoke (attempt 1): apple → pos + 6 domains + 13 senses + idiom bold + crossref, 0 raw markers; WordNet HTML pass-through |

## Health-check procedure (every deploy)

1. `curl sw.js` → CACHE version matches the release
2. Static greps for new UI markers in index.html / app.js
3. Playwright smoke with fresh context (no cache), retry loop ×3: the new
   feature's user path runs end-to-end on production
4. Only a pass on production counts — local pass is "chỉnh thô", live is "khóa chuẩn"

## Rollback

Fix-forward policy (no rollbacks of published deploys). If a release is broken,
redeploy the previous zip (`dual-dictionary-vXX.zip` in `Dictionaries/`) as the
fix — it is the retained artifact. The service worker cache constant is bumped
every release (`mdx-dict-vN` in `sw.js`) so returning clients always pick up the
new app code.

## Notes

- `.netlify/` (CLI state + 328MB plugin cache) is gitignored and excluded from
  every zip — never commit or package it.
- Phase order per ROADMAP.md: 0 → 1 → 2 → 1.5 (EN–VI, pluggable open data) → 3 (SRS study pillar, next).
