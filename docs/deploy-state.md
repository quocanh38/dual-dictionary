# DEPLOY STATE & RUNBOOK — Dual Dictionary (dualdictionary.netlify.app)

> LIVE v149 — IELTS wave 10; deploy `6ae3188c4be8b59f21e381ff`, source `949ac4c2f13806a4b0a5b66aefbfbe013092a914`, published 29 October 2026 16:58:05 VN; service-worker cache `mdx-dict-v149`. Production inventory: 20,790 files, zero live-only/SHA/document drift; 39 local-only QA release-input records. Production HTTP smoke 7/7 on attempt 1; Practice exposes 800 formative IELTS items (200 per stage, 50 per skill per stage), and Lesson Studio reports Ready offline. Production browser checks pass. IELTS feedback remains formative, not an official test or calibrated band diagnosis.

> LIVE v148 — Personalized offline IELTS assignments; deploy `6ae1c9175558bd6f42968032`, source `17095d772576c5eda1db04a312ff3ec0326397d1`, published 28 October 2026 17:06:38 VN; cache `mdx-dict-v144`. Netlify ready in 21s. Queue prioritizes due work, unseen tasks and optional review, balances the four skills from local history, groups shared-context questions and keeps diagnostics separate. Production and pinned snapshot smoke 7/7 on attempt 1; production assignment starts, persists and resumes after reload. Full inventory: 20,228 live files, zero live-only/hash/document drift; 39 local-only QA symlink aliases. IELTS advice remains formative.

> LIVE v146 — 33 approved offline Lesson Studio packs and staged IELTS Academic 5.0→6.0→6.5→7.0 practice; deploy `6ae0a7a1fd366f9a7d539fc0`, source `fcb7ce084a40d9cebaac97c5fc1498d32fbed4e9`, published 27 October 2026 20:31:13 VN; cache `mdx-dict-v140`. Snapshot and production browser smoke 7/7 with zero page errors; all 20,086 published files match with zero live-only/hash/document drift; 33/33 lesson packs match exact bytes and canonical checksums. Thirty-nine local-only QA symlink aliases are not served by Netlify. IELTS diagnostics comprise 40 Reading + 40 Listening items; 80 generated items span skills and stages. AI-assisted review and formative band guidance are not independent human certification or official calibrated scores.

> LIVE v144 — Offline Lesson Studio durability, bounded generation and QA tools; deploy `6ae00cadbf8111a5d8ab0224`, source `adb26369fca3bbc59dd3f1818d86c40aa1a3842c`, published 27 October 2026 09:30:32 VN; cache `mdx-dict-v121`. Post-deploy Chrome checks: authored example, offline reload, mobile 390px, no JS errors. Previewed 12 unapproved drafts offline; no provider calls or approvals. HTTP 7/7 on production and deploy snapshot ×3 each; exact file parity 18,677/18,677, zero live-only/mismatch/local-only (21 case-only path differences on macOS/Netlify).

> LIVE 2026-10-25 — **v142 Tutor review fixes and mobile modal**; deploy `6addcee0782eba4729379051`, source `396bb7895018d6f77f62bca5f1051bbda138b02c`, published **16:42:20 VN**; SW `mdx-dict-v118`. Full committed-snapshot parity **18,626/18,626**, zero live-only/mismatch/local-only; HTTP 7/7 ×3 and Chrome 7/7 with zero page errors. Release source is `netlify-deploy-mirror`; the separate `netlify-deploy` tree is not the deployment source. Real Meta targeted test retains one raw context overcorrection; the release guard prevents it becoming a confirmed language error. Demo recording follows on production.

> LIVE 2026-10-24 — v141 Tutor semantic meanings, shared evidence policy and new contexts; deploy `6adcb8b6e0d1eb6090ca3699`, source `2dfaa2314bf886fc3c07c42961a3fc2e3326e345`, published 20:55:28 VN; SW `mdx-dict-v117`. HTTP smoke 7/7 ×3; Chrome 7/7, zero page errors; full parity 18,617/18,617, zero drift/live-only. Real Meta reevaluation is recorded separately after execution.

> LIVE 2026-10-24 — v140 Tutor reliability; deploy `6adcb049f5ab53ff6222674b`, source `fe3ae48bddc78cfa852df0480c0cffce0728184b`, published 20:19:31 VN, SW `mdx-dict-v116`. Production HTTP smoke 7/7 ×3; Chrome smoke 7/7, zero page errors; post-deploy parity 18,613/18,613, zero live-only or SHA mismatch. Local API/storage-race/mock-provider/offline/backup regression suites PASS. No real-provider AI quality claim.

> LIVE 2026-10-24 — v139 Tutor meaning persistence + Reader baseline UX; deploy `6adc8aed280a273f460fd139`, source `8ad73d1295c1c8efeffa179bf003b5b310a548bc`, SW `mdx-dict-v115`. Production smoke 7/7 ×3; link check 119,304; 13 regression scenarios; committed-file parity 18,611/18,611, zero drift/live-only. Full Meta live Tutor loop checked on the candidate; production browser confirmed the updated evaluation page.

> LIVE 2026-10-24 — v138.2 visual blog release; final deploy `6adc7f4010f53f6ac77ca08d`, source `c4d2c01f10fc41962bff1657f75b624cb7024f07`, SW `mdx-dict-v114`. Blog content refresh covered 30 Vietnamese pages and added four SVG guides across six posts (seven placements). Two follow-up deploys polished Vietnamese labels. Netlify ready; 18,609/18,609 file parity, zero drift; browser checked the live article and all four live SVGs. Playwright smoke could not launch Chrome (SIGABRT).

> LIVE 2026-10-24 — offline IELTS/TOEIC practice + per-request BYOK feedback: deploy `6adc3ac076ab551515eeb478`, source commit `11d8dc7a82ebd9264f9d3323372a70aaf38e6e88`, SW `mdx-dict-v113`. Netlify ready; parity 18,605/18,605, no LIVE-ONLY, SHA-MISMATCH or LOCAL-ONLY files. Post-deploy HTTP smoke 7/7 URLs ×3; fresh deploy-origin browser confirms per-request exact-payload consent. Before deployment, local mock browser verified Tutor phrase→situation→cited feedback→accept→Vault→new situation and Writing/Speaking feedback, cancellation and payload limits. AI client/content checks PASS; 36 precache assets present. Live Meta connection and phrase extraction were tested separately with a short authored sample; no key was committed. Automated offline browser smoke remains blocked by local Chrome headless SIGABRT; offline content/schema checks pass.

> LIVE 2026-10-24 — UX fixes: deploy `6adc133d0ce9ad46a899dc91`, commit `bcfe9303c183b00c548d7f04bf02719a9e5481ef`, SW `mdx-dict-v104`. Netlify ready; snapshot smoke 7/7 PASS; all 18,592 live files match release source. Fresh Chrome 1280/390 regression covers Wiktionary-only auto-selection, Advanced AI defaults, Reader action visibility, empty Vault and tutorial handoff, zero JS errors. Help/onboarding updated for offline core, BYOK token costs and article/answer consent. Meta live phrase → prompt → feedback → accepted Vault save was verified separately before this UX release; keys were not committed. Release source remains netlify-deploy-mirror; separate netlify-deploy directory must be reconciled before future releases.

> LIVE 2026-10-23 — optional BYOK Tutor: deploy `6adb7d0733f298b4aaeb70ec`, source commit `210d3add25c2f2dd8e82cb32907a98d8ca2d65b1`, SW `mdx-dict-v103`. Netlify ready. Snapshot smoke 7/7 PASS; Tutor/sample desktop 1280 and mobile 390 PASS (authored walkthrough, draft reload, Reader → consent, zero page errors). Live AI generation remains NOT VERIFIED: no model key used. User study and real video remain pending. Release source is netlify-deploy-mirror; origin/main updates through v136 were retained. Before any later deploy, compare live against the candidate source; the separate netlify-deploy directory is not this release source.

> **ĐIỂM KHỞI ĐẦU BẮT BUỘC cho mọi AI tool (ZCode / AutoClaw / Claude Code /
> Codex / session khác) TRƯỚC KHI đụng vào deploy Netlify.**
>
> Khi chủ sở hữu nói **"cập nhật tình hình dự án mới nhất"** (hoặc biến thể:
> "update tình hình", "lên netlify xem tình hình"…) — nghĩa là: đọc file này,
> chạy mục §2, báo lại ngắn gọn, rồi mới code/deploy theo chỉ đạo tiếp theo.
> File này là nguồn sự thật về cách deploy AN TOÀN — sinh ra sau sự cố 30/09
> (deploy làm mất 2000 trang word pages khỏi production ~2 tiếng).

---

> **✔ v121–v124 LIVE (2026-10-16 chiều, deploy `6ad23c10fb392f06fd6e4014` — push `27d646b22` gộp 8 commit; health: smoke ×3 ALL PASS attempt 1 (7/7 URL, 0 pageerror) + parity **12.606/12.606** ✅ AN TOÀN LOCAL-ONLY 0 (case-diff info 2) + sw `mdx-dict-v99` KHÔNG bump — /vi/* bypass, shell không đổi):** **VI-P2 ENRICHMENT WAVES** (owner duyệt sau review ngoài góc nhìn IELTS): (1) **v121 batch 7** — 47 hand defs; (2) **v122 wave 1** — 62 defs hồi sinh pool thin-gate; (3) **v123 wave 2** — 66 IELTS collocations NGOÀI wordlist (gồm play a crucial role, in the long run — 2 ví dụ reviewer nêu) + back up 4 nghĩa verb + come up with enrich; (4) **v124 wave 3** — 70 tier A. Chuẩn soạn mới: pat + note văn phong + ≥2 ví dụ gốc. Phrase pages **2.777→3.022**, hand **266→512 (16,9%)**; sitemap **9.823 URL**; landing cập nhật theo live. Chi tiết: hàng v121–v124 `docs/deployment.md` + `docs/vi-p2-queue.json` v3 + `docs/vi-p2-pool.json` v2.

> **✔ v120 LIVE (2026-10-16, deploy `6ad1a50fb093f03c93105460` — push `7b8d156dd` gộp 3 commit; health: smoke ×3 ALL PASS attempt 1 (7/7 URL, 0 pageerror) + parity **12.356/12.356** ✅ AN TOÀN LOCAL-ONLY 1 (.gitignore dotfile) + sw `mdx-dict-v99`):** **Release SEO-structure lớn nhất từ v104:** (1) Fix lookup nhiều entry — term-bank viết hoa đè entry thật ("Access"/"Function"), `lookupBestEntry` chọn entry đúng; **+40 từ (6.896→6.936)**, function lên 332 blocks. (2) **172 mirror biến thể canonical→lemma**, loại khỏi sitemap words — hết cannibalization. (3) **Thin gate cụm từ:** <60 từ nội dung thật → remove, 5.660→**2.777** (266 hand nguyên vẹn; 91 hand <60 từ giữ theo owner — review 4.2). (4) **Chip từ→cụm any-token cap 8** — 1.713 word pages có chips, hub-only 559→202, internal links 90.303/0 dead. sw v98→v99. Chi tiết: hàng v120 `docs/deployment.md`.

> **✔ v119.1 LIVE (2026-10-14, deploy `6acf55dbbeae076ec50e1324` — push `4ba03e9c3`; health: smoke chuẩn ×3 ALL PASS attempt 1 (7/7 URL, 0 pageerror) + parity **9.465/9.465** ✅ AN TOÀN LOCAL-ONLY 0 + coverage-smoke ×3 ALL PASS + **SW reminder test trên live PASS** (notification thật "4 items due for review", app badge=4, click → app nhảy `#/review`); live sw `mdx-dict-v98`):** **Fix bug THẬT tìm bằng test tự động hoá — `notificationclick` gọi `await c.focus()` TRƯỚC `c.postMessage()`: trang ẩn/unfocused làm `focus()` reject và catch trong nuốt cả đường click, nên bấm notification khi app đã mở KHÔNG nhảy tới Ôn tập.** Đã đảo thứ tự (postMessage trước, focus best-effort sau); kèm SW test hook an toàn (test:due-check / test:notification-click / test:clients-diag qua MessageChannel, passive trong production) cho phép suite tự động chạy đúng đường reminder mà không cần thiết bị thật. Phụ: TTS speaking PASS, SpeechRecognition constructible PASS, PWA installability 11/11 PASS. sw v97→v98 (visitor cũ reload ×2). Chi tiết: hàng v119.1 `docs/deployment.md`.

> **✔ v119 LIVE (2026-10-12, deploy `6acc5e781134a4000889480a` — push `347d5e1cf` gộp A3 `92c651035` + A4 `67dff25ca` + blog/landing `347d5e1cf` + chip đổi mốc `55ef4bcdf` + records back-fill `358968b86`; health: smoke chuẩn ×3 ALL PASS attempt 1 (7/7 URL, 0 pageerror) + parity **9.465/9.465** ✅ AN TOÀN LOCAL-ONLY 0 (case-diff info duy nhất: sql-js-LICENSE.txt ↔ .txt — Netlify case-insensitive, vô hại) + coverage-smoke ×3 ALL PASS trên live + A3/A4 live E2E PASS (chip deck reading, .apkg tải về header zip hợp lệ — lần đầu timeout do wasm tải lần đầu, rerun PASS); live sw `mdx-dict-v97`):** (1) **A3 .apkg export** — Export dialog option "Anki deck (.apkg)", sql.js 1.13 MIT lazy-load (script-tag UMD loader; SW runtime-cache lần đầu dùng, không precache), zip STORE + Anki 2 schema v11, guid ổn định (re-import update không trùng), i18n en/vi; (2) **A4 reading-cloze deck** — deck "Từ bài đã đọc" trong Practice: vault items mang câu đã chụp thành bài điền từ, `clozeInflected()` gap từ biến dạng (run→running, say→said), fallback trung thực, FSRS grade THẬT (khác deck curriculum), known-status excluded; (3) **chip đổi mốc** ở ⚙ Advanced (delta-add, current+lower disabled); (4) **blog + landing** — banner "những gì app trả phí thu subscription — ở đây miễn phí" đầu section "Vì sao chọn" (LingQ $14.99/th, Readlang $6/th) + 3 feature card mới + JSON-LD + FAQ giá + 3 bài blog cập nhật + hub entry đầu danh sách; link-check 6.879 trang ALL OK, render-verify 5/5. sw v95→v96→v97 (visitor cũ reload ×2). Chi tiết: hàng v119 `docs/deployment.md`.

> **✔ v117+v118 LIVE (2026-10-12, deploy `6acc499777979b000866e386` — push `507069b03` gộp v117 `c353aa1f6` + plan `ffdb86518` + records back-fill `532ce6882`; health: smoke chuẩn ×3 ALL PASS attempt 1 (7/7 URL, 0 pageerror) + parity 9.460/9.460 ✅ AN TOÀN LOCAL-ONLY 0; live sw `mdx-dict-v95`, #cov-card + #known-empty-box served):** (1) **v117 A2 known-words setup** — DB v3→v4 thêm store `known` (mốc Top 1k/2k/5k/10k theo band freq-en.json precached, KHÔNG tạo vault items — Vault/stats/deck không đổi), CTA ở Vault empty-state + reset ở ⚙ Advanced→Data, key `known` additive trong export/import/auto-backup/encrypted backup, stats card "Known vocabulary"; (2) **v118 A1 coverage meter** — classify 1 lần khi render xong trên span .rw (mọi nguồn reader), vault-learning > vault-known/mốc > mới, skip số/tên riêng + contraction map, card % + 3 band bars + cảnh báo <60% KHÔNG chặn + ≤20 từ mới band-thấp-trước, highlight 3 màu mặc định BẬT (toggle persist localStorage), hint chọn mốc khi knownSet trống; E2E local 45/45 PASS (v117 21 + v118 24, gồm migration DB v3→v4 trên profile cũ + hồi quy chéo). sw v93→v94→v95 (visitor cũ reload ×2). Chi tiết: 2 hàng mới `docs/deployment.md`.

> **✔ v116 LIVE (2026-10-07, deploy `6ac5cba529617e00088e69eb` — push `7f2167de5`; health: live E2E PASS — first-load 0 request từ điển, history chỉ ghi từ có kết quả, re-offer toast 1 lần + Turn on hoạt động, sw `mdx-dict-v93`; **smoke chuẩn ×3 ALL PASS attempt 1 (7/7 URL, 0 pageerror) + parity 9.459/9.459 ✅ AN TOÀN LOCAL-ONLY 0** (chạy bù post-deploy — bẫy: live-smoke.js là tool Mac, bản PC = `ngsl2k-work/live-smoke-win.js`)):** (1) 404 OALD10/LDOCE6 lần này = stale shell sw v91 (v115 đã sạch từ bản trước; mọi nhãn/checkbox đều là fallback trên public); (2) history chỉ ghi lookup ra entry (miss/error không vào Recent); (3) nudge "Get a nudge": ẩn khi Notification không hỗ trợ + MỘT toast re-offer cho máy onboard trước v67 (flag `reminders-offered`); (4) nút Search ghost có tooltip = gate-note + submit scroll card tải vào view; (5) file shipped (samples/*, dicts-en-vi/*) bỏ HEAD probe — knownProbe từ KNOWN_DICT_SIZES, first-load 0 request từ điển trước khi user bấm tải. sw v92→v93 (visitor cũ reload ×2). Chi tiết: hàng v116 `docs/deployment.md`.

> **✔ v115 LIVE (2026-10-07, deploy `6ac5c68e61a9ab00080ec650` — push `918f60be2` gồm back-fill records v114 `ca6c3d5a4`; health: live E2E visitor-lần-đầu PASS — 0 request dicts/*, 🌓 header, tải + tra từ OK — smoke 7/7, sw `mdx-dict-v92`):** (1) public build KHÔNG còn request `dicts/*` — cờ `SHIP_COMMERCIAL_DEFAULTS=false` + `defaultDictOf()` (OALD10/LDOCE6 ẨN tới khi deployment serve dicts/: flip cờ + bump sw); (2) WordNet nội bộ kiểm chứng 200 + sha trùng local — "HEAD 404 nhưng UI báo tải xong" là 404 `dicts/*` + fallback im lặng, đã hết; (3) 🌓 ra header mọi screen size, ⋯ menu còn ⚙/?. sw v91→v92 (shell đổi — visitor cũ reload ×2). Chi tiết: hàng v115 `docs/deployment.md`.

> **✔ v114 LIVE (2026-10-07, deploy `6ac5b7885bd4790008c4bf3f` — push `7b61a669f`; health: live verify prod+snapshot PASS (apple→offngsl, ran→ngsl1, conversely→awl, adam không nút) + E2E phễu bấm nút → session mở ×3 + smoke chuẩn ×3 attempt 1, parity 9.459/9.459 ✅ AN TOÀN):** nút "🎯 Luyện bộ từ này trong app" cạnh CTA tra từ trên word pages → `/?deck=<deck>` (6.592 trang; 247 tên riêng/thán từ không deck giữ 1 nút; dạng chia theo deck lemma; **apple→offngsl theo data thật — apple không thuộc NGSL core**). Mapping = mirror `deckWords()` app. sw `mdx-dict-v91` KHÔNG bump (/vi/* bypass SW); sitemap lastmod → 2026-10-07. Chi tiết: hàng v114 `docs/deployment.md`.

> **✔ v112+v113 LIVE (2026-10-07, deploy `6ac5aaf0f67c260008abe05b` — push `d8c05ee74`; health: practice smoke trên PROD ALL PASS + smoke chuẩn ×3 attempt 1, parity ✅ AN TOÀN):** curriculum practice — deck picker 6 chip (NGSL 1k/2k/3k + Ngoài NGSL + AWL + Vault), generator choice/recall/listen/cloze/say + IPA drill mới, D1 (session ephemeral — chỉ CTA "Save to Vault" ghi), ?deck= deep-link; sw `mdx-dict-v91`. Chi tiết: hàng v112+v113 `docs/deployment.md`.

> **✔ v104 LIVE (2026-10-04, deploy `6ac1afe8481f1a00089b743c` — push `b1f1c9adc`; health: smoke 7/7 attempt 1, parity 8/8 mẫu sha khớp — CLI verify ETIMEDOUT, id lấy bằng REST API trực tiếp):** release P1–P5 từ review toàn bộ /vi/tu/ bằng kho LDOCE6+OALD10 — sửa data hỏng 17 từ + relabel POS 8 từ + REMOVE 3 trang (fart/po/papa; 6.842→**6.839**), tách ví dụ "=en+ vi" thành dòng riêng toàn site, gọn nhãn "(từ Mỹ…)", bỏ claim "nghĩa thông dụng nhất" ở auto-note, mục "Dễ nhầm" không còn dính biến thể; jewellery IPA + note way; vi landing/blog CTA → 6839. sw KHÔNG bump. **OWNER TODO: resubmit GSC sitemap 6.876 URL.** Chi tiết: hàng v104 `docs/deployment.md`. release P1–P5 từ review toàn bộ /vi/tu/ bằng kho LDOCE6+OALD10 — sửa data hỏng 17 từ + relabel POS 8 từ + REMOVE 3 trang (fart/po/papa; 6.842→**6.839**), tách ví dụ "=en+ vi" thành dòng riêng toàn site, gọn nhãn "(từ Mỹ…)", bỏ claim "nghĩa thông dụng nhất" ở auto-note, mục "Dễ nhầm" không còn dính biến thể; jewellery IPA + note way; vi landing/blog CTA → 6839. sw KHÔNG bump. QA: drift 0/362, CJK/mojibake thật 0, link-check ALL OK 6.879, screenshot desktop+mobile OK, parity mẫu thủ công 7 file (CLI ETIMEDOUT — bẫy quen). Chi tiết: hàng v104 `docs/deployment.md`. **Sau deploy: smoke + parity + owner resubmit GSC (sitemap 6.876 URL).**

> **✔ v103 LIVE (2026-10-03, deploy `6ac0feec28fc2d00085d70ce` — push `08d811f2`, gộp cả v102; health: smoke 7/7 attempt 1, parity 18/18 mẫu sha khớp — CLI verify bất ổn ngày 03/10):** +84 hand-note AWL (278→362; coverage **243/570 — đóng gói sublist 1–5; AWL DỪNG** theo lệnh owner, sublist 6–10 không làm để tránh filler). Chi tiết: hàng v103 `docs/deployment.md`.

> **✔ v102 LIVE (ship cùng deploy `6ac0feec28fc2d00085d70ce` với v103):** +40 hand-note AWL (238→278; coverage 159/570 — đạt mục tiêu 150+ của owner). Chi tiết: hàng v102 `docs/deployment.md`.

> **✔ v101 LIVE (2026-10-03, deploy `6ac0db4128fc2d000854b854` — push `aaa0d927`, gộp cả v100; health: smoke 7/7 attempt 1, parity 7226/7226):** hai lớp ghi chú — auto-note nâng cấp toàn bộ 6.842 trang (nghĩa đầu bảng 6.603 trang + collocation trích ví dụ thật 3.806 trang) + 50 hand-note AWL mới (188→238; AWL 119/570). Chi tiết: hàng v101 `docs/deployment.md`.

> **✔ v100 LIVE (ship cùng deploy `6ac0db4128fc2d000854b854` với v101):** trả lời review ngoài — chip "AWL #N" → "AWL Sublist N" + tooltip nguồn (OpenSubtitles/NGSL/Coxhead), nhãn nhóm hub "AWL — ngoài NGSL", auto-note mới cho từ ≥10 nghĩa, +51 hand-note (137→188; AWL 18→69/570), 2 note sửa lỗi content review bắt được (analysis dịch đảo, sustainable thiếu nghĩa "bền vững"). Rebuild đầy đủ cùng ngày — lastmod không đổi. Chi tiết: hàng v100 `docs/deployment.md`.

> **✔ v99 LIVE (2026-10-03, deploy `6ac0bab31a24fd0008f15dea`, push `2b6eac7b`; health: smoke 7/7 attempt 1, parity 7125/7125):** band-10k theo `docs/plan-band10k.md` — **6.842 word pages** (+2.566); gates band-10k: loại 5 entry OVDP hỏng >15KB (greet/lust/sickness/fortunate/learnt), 41 abbrev, 315 off-list mỏng; NGSL giữ 100%; +15 word-notes (137); word-notes drift 9→0; build tool khôi phục đúng fix v98 ở tầng nguồn. **Owner resubmit GSC sitemap 6.879 URL (còn TODO).** Chi tiết: hàng v99 `docs/deployment.md`.

> **✔ v98 LIVE (2026-10-03, deploy `6ac09917a1ab900008c5b122`, push `41f6447f`; health: smoke 7/7 attempt 1, parity 4542/4542):** dọn stale sau v96 — hub `/vi/tu/` bỏ filter "Từ tục / lóng" rỗng + intro bỏ "Từ tục"; blog index "2.000 từ" + vi landing "2.500+ từ" → **4276 từ**; bỏ CSS chết `.chip-vulgar`. 4 file, không đụng data/sitemap/sw. **Sau deploy: owner resubmit GSC sitemap 4313 URL (03/10) — việc chờ từ v96 XONG.** Chi tiết: hàng v98 `docs/deployment.md`.

> **✔ v97 LIVE (2026-10-02, deploy `6abf95565ac056000780ed5b`, push `a5304e35`; health: smoke 7/7 attempt 1, parity 4542/4542 — back-fill 03/10 từ records phiên v97):** bỏ view "Tất cả"/Both mọi kích thước — tab chọn 1 panel cả desktop; blog "tra song song" viết lại + 4 ảnh app thật mới. Chi tiết: hàng v97 `docs/deployment.md`.

> **✔ v96 LIVE (2026-10-02, deploy `6abf423f4725d90008edcf74`, push `cef35815`; health: smoke 7/7 attempt 1, parity 4539/4539):** nấc 2k→5k + REMOVE — 4.276 trang; bỏ 21 từ (18 vulgar + cannot/ma/ongoing; 14 trang bị xoá khỏi production có chủ đích), cứu 12 trang dạng bất quy tắc bằng entry nguyên mẫu. Chi tiết: hàng v96 `docs/deployment.md`.

> **✔ v95 LIVE (2026-10-02, deploy `6abf306937846a0007ebb403`, push `c4030382`; health: smoke 7/7 attempt 1 sau khi sửa marker cũ của tool smoke, parity 2773/2773):** batch 2 AWL — 512 trang mới (2512 tổng; 455 entry riêng + 56 dạng-biến-đổi hiển thị entry nguyên mẫu + bỏ `ongoing` vì OVDP không có key), chip/filter "Học thuật (AWL)", 15 note tay mới (107→122), NOTICE + attribution AWL, vi landing "2.500+ từ", **sw v87→v88** (NOTICE.md là precache asset). Dựng theo các bài học batch-1: IPA qua resolver + bảng clean, typo scan chủ động, lemmaStems fix (-ies→-y, phụ âm đôi), link lemma theo hợp đồng v89, leak-scan note. Chi tiết: hàng v95 `docs/deployment.md`.

> **✔ v94 LIVE (2026-10-02, deploy `6abf288e7563600008bd34f0`, push `3c450841`):** review ngoài 02/10 (đối chiếu Cambridge) phát hiện lớp lỗi lemma-copy IPA **chưa sửa ở nguồn** — v93 chỉ vá output trang tĩnh, `data/ipa-en.json` cho app runtime vẫn nguyên (`became:"bɪˈkʌm"`…). v94: `tools/clean-ipa-json.cjs` regen bảng (143 key), guard -ss trong `ipa-inflect.cjs` (sửa nốt boss/press/miss/pass/mess/discuss sai từ v93), +6 word-notes tay (101→107: research/benefit/contract/business/charge/company), sw **v86→v87** (bump chỉ để xoá runtime-cache ipa json cũ). DSH tự code + push (quy trình mới 02/10: DSH executes, không brief AutoClaw). Health: smoke 7/7 attempt 1, parity 2244/2244. Chi tiết: hàng v94 `docs/deployment.md`. Lưu ý: hàng v94 TRONG deploy này vẫn ghi "(this deploy)" — id thật nằm ở bản local (bẫy 11).

> **✔ v93.1 LIVE (2026-10-01 ~15:00):** lần 3 retrigger (push `72816896`, deploy `6abe13465214a30008049c10`) sau khi owner MUA credits — xác nhận lỗi "Skipped due to account credit usage exceeded" CHẾT người dù 98,6/100 credits còn là cơ chế mới của Netlify (deploy thành công ngay sau purchase). Live = git (v93.1: lastmod trong sitemap + v93 P0+P1). Bài học bẫy 15: deploy git-push bị "credit usage exceeded" ≠ hết quota — kiểm tra Deploys page + credits trước khi kết luận; retry bằng push rỗng; CLI deploy `--prod --dir .` bị Forbidden (token không đủ quyền).


## 1. TRẠNG THÁI LIVE HIỆN TẠI — ⚠️ UPDATE SAU MỖI DEPLOY (bắt buộc, là phần của quy trình)

> LIVE v151 — hero loop to top of main + 3-day reuse protocol; deploy id pending dashboard lookup, source `b152bc9f186cee08f114f04d4755c9ae2bba8c62`, published 30 October 2026; cache `mdx-dict-v150` (unchanged).

> LIVE v150 — P0 trust wording + Vietnamese labels + take-off exact-phrase priority; deploy `6ae40ee71d64556cb9adc628`, source `7b2efd655ca4f202cc6558015e6857a3992c061b`, published 30 October 2026 10:29 VN; cache `mdx-dict-v150`. Netlify state ready; build time 31s.

> LIVE v148 — Personalized offline IELTS assignments; deploy `6ae1c9175558bd6f42968032`, source `17095d772576c5eda1db04a312ff3ec0326397d1`, published 28 October 2026 17:06:38 VN; cache `mdx-dict-v144`. Netlify state ready; build time 21s.

| Mục | Giá trị |
|---|---|
| Phiên bản live | **v151 — hero loop to top of main + 3-day reuse protocol** (2026-10-30); repo root is the site root. |
| Deploy id | pending dashboard lookup — source `b152bc9f186cee08f114f04d4755c9ae2bba8c62` (origin/main tracking ref confirms push). |
| sw CACHE | `mdx-dict-v150` |
| IELTS practice | 800 formative Meta items (400 closed exercises + 200 Writing + 200 Speaking prompts), counted from the module on 30 October; 40 Reading + 40 Listening diagnostic questions. Assignment queue prioritizes due reviews, then unseen tasks, then optional review, balances skills, groups shared contexts and resumes local work. |
| Browser checks | Production assignment card, local persistence and reload resume PASS; production and pinned snapshot smoke 7/7 on attempt 1; offline cache 1280px/390px PASS. |
| Full-site parity | 20,799 live files; zero live-only, hash mismatch or document drift; 39 local-only QA release-input records. Pre-deploy verify matched all 27 changed files against baseline `949ac4c`; production HTTP smoke 7/7 on attempt 1. |

---
## 2. Khi owner nói "cập nhật tình hình dự án mới nhất" — checklist 5 phút

1. Đọc file này (§1) + vài hàng đầu `docs/deployment.md` + dòng đầu `SESSION-HANDOFF.md`.
2. Xác minh live THẬT (đừng tin ghi chép — 30/09 memory ghi "v88 chưa deploy" trong khi đã live):
   - `curl -s https://dualdictionary.netlify.app/sw.js | grep "const CACHE"`
   - Deploy id + danh sách deploy gần nhất: `npx --yes netlify-cli@latest api listSiteDeploys --data '{"site_id":"1af0641f-673e-48e9-9c86-1755d64b6558"}'` (đọc `created_at` + title — vài tool khác có thể vừa deploy).
   - `node tools/deploy-verify.js` → so local ↔ live (xem §4 mục FULL SNAPSHOT).
3. Đối chiếu lệch số liệu → sửa lại ghi chép (file wins, memory không tin nếu mâu thuẫn).
4. Báo ngắn: live đang là gì, local đang ở đâu, có drift không, việc đang dở.
5. Chờ chỉ đạo — trừ khi owner đã ra lệnh cụ thể ("deploy" = ủy quyền deploy luôn).

---

## 3. RUNBOOK DEPLOY CHUẨN (chạy theo thứ tự, không nhảy bước)

**Quy tắc Ask-first (khóa):** deploy luôn cần owner khởi lệnh. Lệnh kiểu "update
lại", "mở rộng…", "cập nhật netlify" trên nội dung cụ thể = ủy quyền deploy
cho đúng nội dung đó. Sau deploy: health check ×3 → ghi biên bản (mục 1 + deployment.md + handoff).

### Bước 0 — Môi trường (máy Mac DSH; máy khác xem §5)
```bash
# Node portable (máy KHÔNG có node/npm trên PATH; /tmp bị dọn — tải lại mỗi lần):
curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-arm64.tar.gz -o /tmp/node.tar.gz
mkdir -p /tmp/node-dsh && tar -xzf /tmp/node.tar.gz -C /tmp/node-dsh --strip-components 1
export PATH=/tmp/node-dsh/bin:$PATH
export npm_config_cache=/tmp/npm-cache-dsh2
# netlify-cli chạy qua npx (không cài global). Cần escalation (config Netlify
# tại ~/Library/Preferences/netlify nằm ngoài workspace + cần mạng).
```

### Bước 1 — Gates local (từ workspace root, node trên PATH)
```bash
node Dictionaries/../ui-check/scan-blog.js        # hoặc cd DSH/ui-check && node scan-blog.js
node DSH/../ui-check/link-check.js                # toàn site — ALL LINKS OK mới được đi tiếp
node DSH/../ui-check/sw-version-check.js          # FAIL = shell precache đổi mà chưa bump CACHE trong sw.js
node tools/word-notes-apply.js --check            # (chỉ khi đụng word pages) — phải 0 drift
```

### Bước 2 — Pre-deploy verify (CHẶN CLOBBER — không bỏ qua)
```bash
node tools/deploy-verify.js --baseline-ref netlify/main  # sau fetch; production phải khớp baseline, không LIVE-ONLY/BASELINE-DRIFT
```

`--baseline-ref netlify/main` dùng cho release có thay đổi nội dung đã duyệt: mỗi file production bị thay phải khớp đúng nội dung commit baseline vừa fetch; file live thiếu trong working tree hoặc production lệch baseline vẫn chặn deploy. Chạy không kèm cờ giữ chế độ strict cũ, hữu ích khi chỉ cần xác nhận parity.

### Bước 3 — Deploy
```bash
bash tools/deploy.sh "vN - <mô tả ngắn tiếng Anh>"   # backup zip vN nếu release lớn (loại .netlify, node_modules, dicts)
```

### Bước 4 — Post-deploy verify
```bash
node tools/deploy-verify.js          # giờ phải chỉ còn LOCAL-ONLY chủ ý (hoặc parity 100%)
node tools/live-smoke.js             # 7 URL chốt ×3 attempt — ALL PASS
# smoke đúng snapshot mới trước khi DNS chuyển:
node tools/live-smoke.js "https://<deploy-id>--dualdictionary.netlify.app"
curl -s https://dualdictionary.netlify.app/sw.js | grep "const CACHE"   # đúng CACHE kỳ vọng
```

### Bước 5 — Ghi biên bản (một gói, không tách rời)
- `docs/deployment.md` — thêm hàng: version | deploy id | ngày | nội dung | health check.
- File này — cập nhật bảng §1.
- `SESSION-HANDOFF.md` — cập nhật dòng trạng thái đầu.
- ZCode memory (nếu phiên ZCode) — hook vào `dual-dictionary-open-items`.

---

## 4. BẪY ĐÃ GẶP — KHÔNG LẶP LẠI (mỗi bẫy: hiện tượng → phòng tránh)

1. **FULL SNAPSHOT (30/09, mất 2000 trang ~2h):** deploy thay TOÀN BỘ production
   bằng nội dung `netlify-deploy/`. File feature ở ngoài folder (staging khác,
   /tmp, máy khác) → bị XOÁ khỏi live. → Mọi feature phải merge source vào
   `netlify-deploy/` TRƯỚC khi deploy; luôn chạy `tools/deploy-verify.js` bước 2.
2. **Ghi chép stale (30/09):** memory/handoff nói "v88 chưa deploy" trong khi
   v88 đã live từ 28/09 14:53. → Không tin ghi chép khi nghi ngờ: xác minh bằng
   API (`listSiteDeploys`) + curl live (mục §2).
3. **File tạm /tmp (25→30/09):** Node portable + npm cache trong /tmp bị dọn
   giữa các ngày; script smoke để trong /tmp biến mất. → Recipe tải lại trong
   §3 bước 0; tool dùng lâu dài đặt trong `DSH/tools/`.
4. **Netlify HUD chèn lúc serve:** mọi response HTML/XML qua URL public có đuôi
   `<script async src="/.netlify/scripts/hud…">`. Diff local↔live phải strip
   chuỗi này; so sánh đúng đắn = sha qua API (`deploy-verify.js` đã xử lý).
5. **Sha của API listSiteFiles = plain SHA1 nội dung** (không phải git-blob).
6. **Windows/PowerShell sessions (29/09):** lưu file UTF-16 + mojibake CP1252
   (deployment.md hỏng, mất hàng v88), đổi cả cây LF→CRLF, lowercase
   NOTICE/ROADMAP. → Trên máy Windows: save UTF-8 không BOM; sau khi chạy xong
   phải merge source về `netlify-deploy/` + đồng bộ ghi chép; không ghi đè
   markdown bằng encode mặc định của PowerShell.
7. **`/netlify.toml` — ĐÃ KHÔI PHỤC + REPAIR (2026-09-30):** copy nguyên xi từ
   staging `dual-dictionary-git/netlify.toml` về `netlify-deploy/`; nhưng publish
   path bị mangle (replace-paths 29/09) KHÔNG "vô hại" như ghi trước đó —
   netlify-cli trên Windows TỪ CHỐI deploy ("must be inside the repository root
   directory"). Đã repair `publish = "."` (deploy.sh vốn dùng `--dir .`) trong
   chính release v91. Bài học: publish path sai vẫn chết CLI dù không dùng.
8. **sw stale cache:** precache shell (index.html, app.js, style.css, ASSETS)
   đổi NỘI DUNG → phải bump `mdx-dict-vN` trong `sw.js`. Chỉ đổi CRLF (nội dung
   bất biến) thì không cần — `sw-version-check.js` + `sw-assets-hash.json`
   quản việc này. (Word pages `/vi/*` bypass SW hoàn toàn — đổi pages không
   cần bump.)
9. **zsh không tách từ biến:** `for w in $LIST` thành MỘT phần tử — dùng danh
   sách tường minh trong vòng lặp.
10. **$? sau pipe:** `cmd | tail` làm `$?` thành exit của tail — muốn exit thật
    thì dùng PIPESTATUS hoặc chạy không pipe.
11. **Deploy id trong biên bản:** hàng ghi về chính deploy đó sẽ ship cùng
    release SAU (bootstrap) — ghi "(this deploy)" rồi thay id thật vào lần
    ghi kế tiếp là đủ, đừng deploy lại chỉ cho id.

---

12. **`/netlify.toml` trong listSiteFiles là entry config ảo (2026-09-30):** sau
   khi file đã có local VÀ đã deploy, sha của nó trên API VẪN lệch — vì API
   trả digest của config ĐÃ RESOLVE (gộp plugin site-level, ví dụ
   @netlify/plugin-lighthouse vẫn chạy "from Netlify app" dù toml ghi
   `plugins = []`). Không bao giờ khớp file sha → nằm ALLOW-LIST với lý do MỚI
   này (không phải "live-only" như bẫy #7 cũ). File vẫn phải tồn tại local.
   Ghi thêm: deploy v91 chạy @netlify/build 37.3.3 (14.1s) và plugin Lighthouse
   chạy lại từ cấu hình site — số liệu không đọc được ("Summary: undefined").
13. **Ghi chú cơ chế (không phải bẫy):** Netlify TỰ đẩy commit
   "Update via Netlify [skip ci]" vào git repo (`git.netlify.com/quocanh38/dualdictionary`)
   sau mỗi deploy — repo là mirror TỰ ĐỘNG của nội dung deploy, không chỉ
   mirror thủ công. Deploy trên Windows đã chạy trọn runbook 30/09: git tại
   `AppData\Local\Programs\Git\cmd\git.exe` (không trên PATH), netlify-cli
   global + auth sẵn, `deploy-verify.js` tự nhận win32 (gọi run.js trực tiếp —
   spawnSync('npx') chết trên Node mới), `deploy.sh` chạy qua Git-Bash OK.
14. **Git push lên main = DEPLOY THẬT (30/09, v92):** push commit lên
   `git.netlify.com/quocanh38/dualdictionary` (branch main) TỰ KÍCH HOẠT
   deploy production (src=api) — bot commit "[skip ci]" chỉ chống LOOP
   (deploy không trigger deploy tiếp), KHÔNG tắt auto-deploy. Bằng chứng:
   push e0ed108 14:41 ICT → deploy `6abcbd8a` 07:43 UTC (14:43 ICT) = v92
   live KHÔNG cần `netlify deploy`. Hệ quả: (a) "site non-Git" trong
   AGENTS.md là GHI CHÉP CŨ — site đã nối Git (Netlify-managed);
   (b) deploy-verify PHẢI chạy trước mọi push, không chỉ trước `netlify
   deploy` — push sai nội dung = production sai thật; (c) cấm push
   WIP/thử nghiệm lên main; dùng branch khác nếu cần.
## 5. PHÂN VAI & QUY TẮC CHO MÁY/TOOL KHÁC (AutoClaw trên PC, Claude Code, …)

- **Ai deploy cũng phải chạy đủ runbook §3** — không có "deploy nhanh". **Push
  lên main cũng là deploy** (bẫy 14) — deploy-verify phải chạy trước mọi push.
- **Brief AutoClaw chứa việc liên quan deploy/sửa site:** dán luôn mục §3 (hoặc
  trỏ đường dẫn tuyệt đối file này) + mục §4 vào brief. Tiêu chí nghiệm thu
  phải gồm: `deploy-verify` ✅ trước + sau, `live-smoke` ALL PASS, biên bản §1
  + deployment.md + handoff đã ghi.
- **Làm xong trên máy khác:** merge toàn bộ source (kể cả file mới) về
  `netlify-deploy/` TRƯỚC deploy; sau deploy phải sync ghi chép về workspace
  chính (deployment.md, deploy-state.md §1, SESSION-HANDOFF.md) — nhớ quy tắc
  UTF-8 mục 4.6.
- **Mâu thuẫn ghi chép giữa các máy:** live (API + curl) là trọng tài cuối;
  sau đó cập nhật ghi chép theo live.

---

*File sinh 2026-09-30 sau sự cố clobber word-pages (v89/v90 cùng ngày khôi phục
+ vá). Người giữ "source of truth": workspace DSH — `Dictionaries/`.*
