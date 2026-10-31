# HANDOFF — Dual Dictionary: mở rộng `/vi/tu` (VI-P0 → VI-P2) — 15/10/2026

> File này để mở chat mới làm tiếp. Đọc xong mục 1–3 là đủ ngữ cảnh; mục 4 là việc đã duyệt chờ làm; mục 6 là các cạm bẫy ĐÃ TỐN GIỜ ĐỒNG — đừng dẫm lại.

---

## 1. Bối cảnh & đường dẫn

- **Repo (source of truth):** `C:\Users\nqanh2\Documents\DSH\01-projects\dual-dictionary\dual-dictionary-git` — Netlify site `dualdictionary.netlify.app`, publish = `.`, deploy qua **git push** (quy trình: local verify ALL PASS → mới push, "trap 11").
- **File MDX thương mại** (oald10.mdx 40MB, ldoce6.mdx 162MB) nằm ở thư mục cha `dual-dictionary\` — CHỈ local, KHÔNG BAO GIỜ vào repo/deploy (chính ToS của site cấm redistribute).
- **Shell thao tác repo qua exec (PowerShell 5.1)** — file tools của AutoClaw bị giới hạn trong workspace. Viết code vào repo = ghi file .mjs/.py vào workspace rồi `Copy-Item` hoặc chạy script (node/python).
- **Workspace này** chứa: plan files, audit scripts, backups, dữ liệu GSC (mục 7).

## 2. Trạng thái hiện tại (sau phiên 15/10/2026)

| Thành phần | Số lượng | Ghi chú |
|---|---|---|
| Trang từ `/vi/tu/{word}/` | **6.896** | VI-P0: +57 so với 6.839; audit rich: 6.882 rich / 14 medium / **0 thin** |
| Trang cụm từ `/vi/tu/{phrase}/` | **5.660** | 266 hand-written + 5.394 OVDP đạt rich bar (5.401 có section WordNet 3.1) |
| Tổng nội dung `/vi/tu` | **12.556 trang** | sitemap: words 4 chunks + phrases 3 chunks + 2 index |
| Git | **CHƯA commit** | mọi thay đổi local; chưa push, chưa deploy |

**GSC (export 15/10, site mới 3,5 tuần tuổi):** 624/6.886 indexed (9%) · "Discovered — currently not indexed" = **6.252** · "Crawled — not indexed" = 5 · velocity +8 indexed/ngày. **Chẩn đoán: nút thắt là crawl priority (authority + internal linking), KHÔNG phải chất lượng nội dung** — các trang bị crawl gần như 100% được index.

## 3. Thay đổi code (tất cả CHƯA commit)

**`tools/build-word-pages.cjs`** (sửa — +51/−2 từ VI-P0, +guard/exports):
- Admission thêm fallback `dict.normKey` (exact-match trước — trang cũ không đổi) → +77 ứng viên, +57 trang sau gate.
- Wipe blanket → **manifest ownership** (`docs/wordpages-manifest.json`): build từ chỉ sở hữu/xoá dir trong manifest của mình — sống còn cho trang cụm từ cùng thư mục.
- Thêm `if (require.main === module)` guard + `module.exports` (escapeHtml, sanitizeRaw, mtdToBlocks, renderEntry, applyOvdpFixes, dropLeadingIpaFragment, REMOVE_WORDS, SITE, REPORT_EMAIL) — để phrase builder tái dùng, không drift.

**`tools/build-phrase-pages.cjs`** (mới, v5):
- Nguồn: `data/phrase-wordlist.json` (**union** 24.934 cụm multiword — KHÔNG dùng giao 2 bộ: OALD khóa phrasal verb riêng, LDOCE nhúng trong entry → giao mất toàn bộ phrasal).
- Admission: OVDP coverage (exact + normKey) HOẶC corpus hand-written; skip vulgar/collision với word manifest.
- **RICH BAR (chỉ thị owner):** giữ chỉ khi = hand OR (OVDP ≥2 content blocks AND có ví dụ `=en+vi`) OR (có định nghĩa WordNet). Không đạt → removedThin.
- Enrichment: **WordNet 3.1** từ `samples/wordnet31.mdx` (bundled, open licence) — section "Định nghĩa tiếng Anh (WordNet 3.1)" trên trang được phủ (72%).
- Corpus VI-P2: `data/vi-phrase-defs/defs-0[1-6].json` (266 nghĩa tiếng Việt TỰ VIẾT — original, có `hideOvdp` flag cho "give up").
- Slug Windows-safe: lowercase NFC, space→hyphen, strip trailing dots, Win32 chars → hyphen. Trùng slug với trang từ → skip.
- Ownership riêng: `docs/phrasepages-manifest.json`; sitemap riêng `vi/tu/sitemap/phrases-*.xml` + `phrases-index.xml` (không đụng words-*.xml/index.xml).
- Root `sitemap.xml` đã thêm entry phrases-index + lastmod 2026-10-15.

**Lịch sử số trang cụm từ:** 7.452 (build union) → 3.770 (thin gate vòng 1) → **5.660** (WordNet cứu ~2.682 + remove 1.792 không làm giàu được).

## 4. Việc đã DUYỆT — chờ làm (chat kế tiếp)

### 4.1. Đòn bẩy link nội bộ (URL hub ĐÃ DUYỆT: `/vi/tu/cum-tu/`)
- **Hub mới** `/vi/tu/cum-tu/index.html`: liệt kê 5.660 trang cụm từ (3 cột + ô tìm kiếm client-side, chip ★ "Biên soạn riêng" cho 266) — pattern y hệt hub từ. Đã verify: `cum-tu` không trùng word/phrase manifest, dir chưa tồn tại, không thuộc manifests (không bao giờ bị build khác xoá).
- **Word builder** thêm section "Cụm từ liên quan" trên trang từ: đọc `docs/phrasepages-manifest.json`, chip các cụm cùng first-token (max ~6, link `phrasePageUrl`). Nhớ cả hub từ `/vi/tu/index.html` thêm link sang hub cụm.
- **Landing `/vi/index.html`**: thêm link tới hub cụm.
- Build lại cả hai builder → QA: đếm inbound (mục tiêu: 1.594 trang zero-inbound → 0), link-check.
- *Mục đích: GSC cho thấy bottleneck là crawl priority; 624 trang đã index trỏ vào graph cụm từ = con đường crawl ưu tiên.*

### 4.2. Owner review (trước push)
- 20 trang hand mẫu (list đã gửi trong chat 15/10: run-out-of, get-rid-of, give-up/hideOvdp, take-care-of/co-render, rub-it-in, grow-out-of...), corpus `defs-0[1-6].json`.
- 14 trang từ MEDIUM (accounts, bonds, colours, mines, recovered, um...) — chấp nhận được; muốn polish: hand-note qua pipeline `data/word-notes/`.

### 4.3. Pre-push QA + deploy
- Link-check toàn site (~12.5k trang — tool: `ngsl2k-work/link-check-win.js`), deploy-verify, render smoke.
- SW: `/vi/` đã bị né ở `sw.js:187` (blog chưa tồn tại); `data/built-words.json` đổi → bump SW CACHE khi release (kỷ luật trap 11: records local tới khi push).
- Push → GSC submit lại sitemap; Request indexing ~10 seed/ngày (run-out-of, give-up, acid-rain...).

### 4.4. Post-deploy monitoring
- GSC Coverage sau 4 tuần: mục tiêu velocity 8 → 20–30 indexed/ngày; lý do not-index chính phải chuyển từ "Discovered" sang "Crawled" rồi "Indexed".
- Backlink: 2–3 link thật cho trang chủ lực (backlink-kit có sẵn trong project).

## 5. Hàng đợi tương lai

- `docs/vi-p2-queue.json` — 109 ứng viên 3-token đã xếp hạng, chưa soạn nghĩa (VI-P2 đợt 2: soạn thêm vào `data/vi-phrase-defs/` rồi rebuild — mọi cơ chế đã khép vòng).
- 3.682 + 1.792 cụm đã remove: có giá trị → hồi bằng override corpus; compound kỹ thuật → bỏ vĩnh viễn.
- **Plan EN–EN** (chưa làm): `plan-tu-dien-en-en.md` — wordlist giao OALD∩LDOCE 39.966, rich bar 3 lớp, URL `/word/{headword}/`, corpus `data/en-defs/`, `check-originality.cjs` chống paraphrase.
- **Plan blog EN** (chưa làm): `plan-blog-en.md` — `/blog/` + `/vi/blog/` hreflang pairs, 4 bài evergreen trước.

## 6. Cạm bẫy đã học — đừng lặp lại

1. **NUL (`\u0000`) là terminator chuẩn của entry OVDP** — tuyệt đối không gate theo nó (v2 từng làm admission = 0).
2. **PS 5.1 `Set-Content -Encoding UTF8` thêm BOM** → node --check fail. Ghi file qua node/python script, không qua PS.
3. **`node -e "..."` trong PowerShell = quoting地狱** (dấu ', ", ${}) — luôn viết file .mjs/.py rồi chạy.
4. **Slug cụm phải strip trailing dots** ("op. cit." → Windows tạo ghost dir, git lỗi).
5. **"con"** không tồn tại trên disk Windows (reserved name) — git/Netlify vẫn phục vụ; đừng sửa.
6. **Đừng rebuild word builder với WORD_LIMIT/MAXBAND nhỏ** — manifest sẽ xoá các trang out-of-cap (đúng thiết kế nhưng là xoá thật).
7. **Attachment (zip/csv) của AutoClaw bị ảo hóa**: `read` tool thấy binary nhưng chặn; shell list được nhưng .NET open fail → xử lý qua PowerShell enumeration (`Get-ChildItem | Select -Expand FullName`) + Get-Content -Encoding Byte; CSV text thì `read` trực tiếp được.
8. Trang từ `con` — xem mục 5.

## 7. File tham chiếu trong workspace (AutoClaw Default project)

- Plans: `plan-vi-tu-mo-rong.md` (gốc — mục 8/8b/8c/8d/8e/8f có kết quả thực tế từng phase), `plan-tu-dien-en-en.md`, `plan-blog-en.md`
- Data: `en-en-intersection.json`, `vi-p2-candidates.json`, `vi-p0-fresh-words.json`, `word-thin-audit.json`, `gsc-coverage/` (GSC export đã giải nén)
- Scripts tái dùng: `intersect.mjs`, `wordnet-probe.mjs`, `originality-check.mjs` (chạy local-only với MDX thương mại), `gen-review-index.mjs` (tạo `_review-phrases.html` — review helper, KHÔNG commit), `gen-phrase-wordlist.mjs`
- Backups: `build-word-pages.cjs.vi-p0-backup`, `build-word-pages.cjs.vi-p1-backup`

## 8. Số liệu gốc (để đối chiếu khi nghi ngờ)

- Từ: 6.839 → 6.896 (+57; gates: thin 315→334, abbrev 41→42; removedVulgar 21, empty 7, fat 5, corrupt 3 không đổi)
- Cụm union 24.934 → admitted 5.660 (no-source 17.351 · NOT-RICH 1.792 · empty 86 · vulgar 32 · collision 27 · abbrev 8 · fat 1)
- Hand: 266 (builtHand 266 ✓ — 4 trang từng bị gate nhầm đã hồi sau fix `&& !hand`)
- WordNet: phủ 2.719/3.770 (72%) tại thời điểm probe; built with WN section: 5.401
- Originality: 293 câu ví dụ → 45 hits 5-gram → viết lại 45 → còn 10 hits cấu trúc (cụm + từ công năng, không tránh được, không phải copy)
- GSC 09/10: indexed 624 · discovered-not-crawled 6.252 · crawled-not-indexed 5 · impressions ~200/ngày

— Hết handoff. Chat mới: đọc mục 1–4, xác nhận lại URL hub `/vi/tu/cum-tu/` đã duyệt, rồi làm 4.1.
