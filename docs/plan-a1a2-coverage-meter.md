# Plan A1+A2 — Coverage Meter & Known-words setup (v117/v118)

**Trạng thái: CHỜ OWNER DUYỆT — không code trước khi duyệt** (viết 07/10/2026).
Nguồn đề xuất: `01-projects/dual-dictionary/research/2026-10-07-market-competitor-report.md`
(A1 known-words coverage meter + A2 auto-mark theo tần suất), đánh giá fact-vs-proposal trong
cùng thư mục. Nguyên tắc: mục **FACT** = đọc trực tiếp từ code (file:line, repo `dual-dictionary-git`
v116 live); mục **PHÂN ĐỊNH** = thiết kế của ZCODE, chưa có nguồn ngoài hay owner brief — owner
chất vấn được từng dòng.

---

## 1. Hai tính năng

- **A1 — Coverage meter**: trước/khi đọc một bài (paste, URL, YouTube transcript, epub/pdf),
  app tính "% từ đã biết" + số từ đang học/mới, highlight 3 nhóm màu trong Reader.
- **A2 — Known-words setup**: một mốc "Tôi đã biết Top-N từ phổ thông" (1k/2k/5k/10k) làm
  điểm xuất phát, để A1 đo đúng ngay cả khi Vault còn trống.

## 2. FACT nền từ code (điều tra 07/10/2026)

**Pipeline Reader — 1 điểm chốt duy nhất cho mọi nguồn:**
- `readerRender(text, source, sourceUrl)` (app.js:3106) là nơi TẤT CẢ nguồn đi qua: paste
  (`startReading` app.js:3158 → 3178), URL (`loadReaderUrl` app.js:3375), YouTube transcript
  paste, epub (app.js:698-699), pdf (app.js:710-711). Token hoá = mỗi từ 1
  `<span class="rw" data-word>` (app.js:3139-3142), render theo chunk 4000 từ
  (`READER_CHUNK_WORDS` app.js:3057). → Bắt classify + highlight tại đây là phủ mọi nguồn.
- **"Dán URL → app quét" ĐÃ TỒN TẠI** (sửa nhận định trong assessment research):
  `loadReaderUrl` (app.js:3375-3407) fetch Wikipedia qua API (`origin=*`) và URL generic
  `fetch(url, {mode:'cors'})` + DOMParser dọn nav/script; CORS chặn thì báo lỗi + hướng dẫn
  paste (app.js:3405). A1 KHÔNG cần làm bước fetch.
- Tap-lookup hiện có: `onReaderTap` (app.js:3417), strip punctuation (app.js:3420), lookup
  xuống panels + ⭐ Save sentence (index.html:198). Popup tra tại chỗ kiểu prototype
  KHÔNG tồn tại — hiện trạng là lookup ở panels bên dưới (mobile đã có auto-scroll
  `revealLookupAfterTap` app.js:3458).

**Lemmatizer có sẵn:**
- `lemmaCandidates(word)` (app.js:2182-2225): ~40 dạng bất quy tắc + quy tắc ies→y,
  -ed/-ing/-s/-es với de-doubling consonant. Đang phục vụ lookup; tái dùng nguyên văn cho matching.

**Dữ liệu tần suất — đã precached, offline từ đầu:**
- `data/freq-en.json` = map word→band `'1k'|'2k'|'5k'|'10k'` (top 10.000 headword, OpenSubtitles
  2018 en_50k, **MIT** — notice.md:27-31). **Precache trong sw** (sw.js:131-133), client đã load
  qua `loadFreqMap`/`freqBand` (app.js:6598-6607). → A1/A2 KHÔNG thêm file data nào, KHÔNG thêm
  request first-load (giữ thành tích "0 request" của v116).
- `data/built-words.json` [word, band, ngslRank, awlSublist] 6.839 rows, precached (sw.js:134-137),
  `deckWords` (app.js:3633) — chỉ cần nếu muốn gắn thông tin NGSL/AWL; core A1/A2 dùng freq-en.json là đủ.

**Vault model — 'known' đã là status chuẩn nhưng dùng làm known-set số lượng lớn sẽ gây 4 hậu quả:**
- FACT: `STATUS_VALUES = ['new','learning','known']` (store.js:8); review queue loại `known`
  (app.js:3783, 4751, 5194, 6129); Vault ĐÃ có bulk "Mark as known" cho items chọn sẵn
  (`batchMarkKnown` app.js:5078); journal đã tạo items status 'known' (app.js:4851, comment
  thiết kế 4787-4788).
- FACT (cost nếu nhồi 3-10k items 'known' vào vault): (1) `renderVault` (app.js:4910-4942)
  render TẤT CẢ items không phân trang, mỗi card 1 DOM + 1 `quickGloss` async (app.js:4973);
  (2) `vaultFiltered` (app.js:4745) không có filter theo status → không giấu được; (3) Stats
  `retention = 100*known/reviewed` (app.js:4152) sẽ phình ~100% vì mốc never-reviewed; (4)
  **practice deck pool lọc `!isSaved(w)`** (app.js:3648; `isSaved`→vault app.js:4504) → deck
  ngsl1 (911 từ) sẽ cạn vì hầu hết nằm trong mốc.

**Hạ tầng:**
- db.js: `DB_VERSION = 3` (db.js:10), `onupgradeneeded` pattern append-only
  `if (!contains(...))` (db.js:16-38) → thêm store mới với version 4 an toàn cho máy cũ.
- Export/import/backup: payload `{app, version:3, items}` (exportItems app.js:5349-5359;
  auto-backup app.js:6105; restore-point app.js:6468; `importItems` store.js:524) → thêm key
  additive là backward-compatible (bản cũ import = bỏ qua key lạ).
- i18n en/vi (app.js:5477+). sw `mdx-dict-v93` (sw.js:122) — đổi app.js/index.html/db.js/store.js
  = **bắt buộc bump sw** (trap đã ghi deploy-state).
- Onboarding: `maybeOnboard` (app.js:6245), flag `onboarded` localStorage; v116 vừa sửa hành vi
  (nudge 1 lần) — đụng tiếp = rủi ro hồi quy.
- No-tracking/offline-first (roadmap.md): coverage chạy 100% client, không có gì rời máy.

## 3. PHÂN ĐỊNH THIẾT KẾ (đề xuất chờ owner chốt — từng cái có thể veto)

**D1 — Known-set để store riêng, KHÔNG tạo vault items (khuyến nghị mạnh).**
Store mới `known` trong IndexedDB (DB_VERSION 3→4), 1 record `{level, words:[...lemma], updatedAt}`.
Lý do: tránh cả 4 cost ở §2; đúng ngữ nghĩa LingQ ("biết" ≠ "đang lưu học"); practice decks,
Vault UI, stats không phải vá gì. Chi phí đánh đổi: export/import thêm key `known`; ⚙ Advanced
thêm mục quản lý nhỏ (số từ, đổi mốc, xoá).

**D2 — Mốc = Top 1k / 2k / 5k / 10k theo band của freq-en.json.**
Prototype vẽ chip "Top 3k" nhưng data KHÔNG có band 3k (chỉ 1k/2k/5k/10k — notice.md:31);
NGSL core 2809 là lựa chọn thay thế nhưng trộn hai đơn vị khác nhau. Khuyến nghị 4 chip theo
band thật. Chọn mốc cao hơn sau này = thêm delta (idempotent); reset trong ⚙ Advanced.

**D3 — Công thức phân loại mỗi token** (chuẩn hoá như app.js:3420 + lowercase):
1. lemma candidates = `lemmaCandidates(token)` (token gốc đứng đầu);
2. **Đã biết** = có candidate ∈ knownSet ∪ vault item (type word) status 'known';
3. **Đang học** = có candidate = vault item status 'learning'/'new' (ưu tiên cao hơn knownSet —
   cho phép "từ mốc mà tôi thực sự chưa biết" được ghi đè bằng cách lưu vào Vault);
4. **Mới** = còn lại.
Loại khỏi mẫu số: số thuần, token không có chữ cái, tên riêng (heuristic: viết hoa giữa câu
VÀ không có trong freq-en.json). Contractions (don't, won't): map nhỏ ~20 mục về lemma
(khuyến nghị làm, chi phí thấp). Out-of-vocab ngoài top-10k = "Mới" (đúng mục đích cho người học).

**D4 — Ngưỡng band:** ≥90% dễ · 60–90% i+1 · <60% khó (theo prototype; hằng số để chỉnh).
Card hiển thị: % đã biết, 3 band đếm từ, tối đa ~20 từ "mới" đầu tiên xếp theo band thấp trước.

**D5 — UI A1: passive, KHÔNG chặn, KHÔNG popup mới.**
Coverage card nhỏ sau khi render xong (thay vì modal gate kiểu prototype — giảm friction);
cảnh báo "bài khó" khi <60%. Highlight 3 màu trên `.rw` (toggle trong reader toolbar, mặc định
BẬT, persist localStorage). % thêm vào status line hiện có (`setReaderMsg`). Tap-lookup + ☆/⭐
giữ nguyên hành vi; nút "Đề xuất bài khác" của prototype = B4, ngoài scope.

**D6 — UI A2: đặt trong Vault + ⚙ Advanced, KHÔNG đụng onboarding.**
Vault empty-state thêm CTA "Tôi đã biết N từ phổ thông" (chọn mốc) — đúng ngữ cảnh "vault trống";
⚙ Advanced thêm mục Known words (đổi mốc/reset/đếm). Onboarding v116 vừa sửa, không đụng.

**D7 — Backup round-trip:** payload v3 thêm `known` (additive); passphrase-encrypted backup bọc
cùng payload nên đi kèm tự động. Bản app CŨ import file mới = bỏ qua known (chấp nhận được, ghi note).

**D8 — Tách 2 release, mỗi release 1 deploy riêng** (như v111/v112):
- **v117 = A2** (~1 buổi): db v4 + store known, UI D6, export/import, i18n, sw v93→v94.
  Làm trước vì A1 không có known-set thì đo sai với người dùng mới (0-5% cho mọi bài).
- **v118 = A1** (~1.5-2 buổi): classify engine + coverage card + highlight + chip + CSS + i18n, sw v94→v95.

**D9 — Stats thêm 1 dòng "Known vocabulary"** (mốc N + vault-known M) — optional, nhỏ, đề nghị có.

## 4. KHÔNG làm trong scope này

Popup tra từ inline kiểu prototype (tap-lookup hiện tại + auto-scroll đã giải quyết mobile);
URL fetch cho site không CORS (đã có message hướng dẫn paste); "Đề xuất bài khác"/news feed (B4);
Whisper (B1); text simplification (A5); .apkg (A3); đụng onboarding; bất cứ network call mới nào.

## 5. Rủi ro

| Rủi ro | Biện pháp |
|---|---|
| Tên riêng (aaron, batman…) nằm trong freq list → đếm sai | Rule skip D3; card ghi "ước tính theo top-10k từ phổ thông" |
| DB v3→v4 trên máy cũ | Pattern append-only đã có (db.js:16-38); smoke migration từ profile cũ |
| Doc dài (6k+ từ) | Classify O(n × ≤10 candidates) trên Set — tính 1 lần/render, cache Map token→class |
| Owner profile hiện có: knownSet trống | Card gợi ý "chọn điểm xuất phát" (state gallery của prototype) thay vì hiện 0% trống |
| sw bump quên | Bump v94/v95 trong cùng commit; smoke first-load 0 request mới |

## 6. Nghiệm thu (checklist đo được)

**v117 (A2):** Vault trống → chọn Top-2k → store `known` ~2k lemma; **item count Vault/stats không đổi**;
deck ngsl1 practice vẫn 911 từ (isSaved không đổi); export JSON chứa `known` + import round-trip
khôi phục; passphrase backup khôi phục; ⚙ đổi mốc = delta-add, reset = sạch; offline (sw precached)
set mốc được; first-load 0 request mới; smoke chuẩn ×3 ALL PASS + deploy-verify.

**v118 (A1):** paste sample 200 từ có 10 từ mới → % + counts khớp tính tay; Wikipedia URL analyzed
như paste; highlight counts = band counts; toggle off bỏ class + persist reload; <60% hiện cảnh báo
không chặn; knownSet trống → gợi ý chọn mốc; tap-lookup/⭐/☆ không đổi hành vi; doc 5k từ classify
≤ +250ms; sw v95; **coverage-smoke-win.js mới** (playwright-core + NODE_PATH theo gates chuẩn) ×3
ALL PASS + smoke chuẩn ×3 + deploy-verify.

## 5 quyết định chờ owner chốt

- **D1** known-set = store riêng (khuyến nghị) hay vault items 'known'
- **D2** mốc chips 1k/2k/5k/10k (khuyến nghị) hay giữ "Top 3k" kiểu prototype
- **D5** highlight mặc định BẬT + không popup mới (khuyến nghị)
- **D6** đặt A2 ở Vault + Advanced, không đụng onboarding (khuyến nghị)
- **D9** stats thêm dòng Known vocabulary (khuyến nghị có)
