# Village Kit — Offline IELTS/TOEIC cho vùng sâu, máy rẻ, không mạng

Ngày: 31/10/2026 · Phạm vi: `lessons/` + IELTS/TOEIC offline trong app chính.
Câu chuyện: thầy cô chuẩn bị nơi có mạng → trẻ em học hoàn toàn offline.

## 1. Con số nhẹ thật (đo bằng `tools/lessons/village-weight.mjs`)

| Lớp | Kích thước đo được | Ghi chú |
|---|---|---|
| Studio shell (HTML+JS+CSS+provenance, chưa pack) | 275 KB | budget 290 KB — PASS |
| 1 pack lớn nhất | 11.2 KB | budget 12 KB — PASS |
| Bảng provenance 33 packs (1 fetch) | 17.6 KB | budget 24 KB — PASS |
| **Full learner kit (shell + cả 33 packs)** | **611.7 KB** | budget 700 KB — PASS |

Đối chứng trung thực: repo tổng ~241MB vì còn `data/` 36MB + `dicts-en-vi/` 11MB
+ `vi/` 102MB (tư liệu từ điển cho thầy cô, KHÔNG phải thứ máy học sinh cần).
Learner device chỉ cần 612KB trên + cache PWA là học được.

## 2. Code mới trong đợt này (không gọi provider, không sửa pack đã duyệt)

- `lessons/index.html` — hero kể chuyện vùng sâu + banner Village Kit.
- `lessons/village.js` (mới, defer sau app.js) — ô search offline lọc client-side,
  dòng provenance Meta từng pack (1 fetch `provenance.json`, có cache),
  low-memory mode (`prefers-reduced-motion` / save-data), banner tự chèn.
  Không sửa logic Studio lõi.
- `lessons/library/provenance.json` (sinh bằng `tools/lessons/build-provenance.mjs`)
  — 33 packs: provider/model/promptVersion/reviewerType/sha rút gọn.
- `tools/lessons/build-provenance.mjs` (mới) — đọc file local, 0 provider call.
- `tools/lessons/village-weight.mjs` (mới) — kiểm toán KB, fail-closed khi vượt budget.
- `sw.js` — precache thêm `village.js` + `provenance.json`, bump `mdx-dict-v150` → `v151`.
- `lessons/app.js` — danh sách `offlineReady()` thêm 2 file trên để báo "Ready offline" đúng.

## 3. IELTS/TOEIC offline — audit trung thực (đọc code `js/offline-study.js`)

- Listening/Reading: content pack gốc trong `js/study-content.js` + diagnostic
  40 câu/kỹ năng IELTS, TOEIC L&R theo SECTION_TARGETS — chấm bằng answer key
  cố định, giải thích có sẵn, KHÔNG cần mạng.
- Listening phát bằng `speechSynthesis` của trình duyệt (giọng máy, không phải đề thi
  chính thức, không chấm band) — đã ghi rõ trong UI.
- Writing/Speaking: prompt + tự đánh giá offline; nút "AI review" là OPTIONAL,
  cần key riêng + consent từng lần, thiếu key thì báo "Offline practice remains
  available without it". Không khoác lác AI chấm điểm vùng sâu.
- Không claim learning-gain, band diagnosis, đề thi chính thức.

## 4. Kịch bản triển khai vùng sâu (cho video + form)

1. Thầy cô (nơi có mạng): mở Studio → cài 33 packs + IELTS pack → verify
   "Ready offline" → export backup ra USB.
2. Máy học sinh (máy rẻ, airplane mode): mở PWA đã cài → học lesson, làm
   IELTS L/R, lưu Vault, review spaced — không tài khoản, không key, không tracking.
3. Mỗi pack ~10KB nên chép USB/Bluetooth cho cả lớp trong vài phút.

## 5. Validation đã chạy (workspace clone)

- `tools/lessons/check.mjs` — 27 contract groups PASS.
- `tools/lessons/library-check.mjs` — PASS, 0 provider calls.
- `tools/lessons/quality-gate-check.mjs` — PASS (gồm fix fileURLToPath).
- `tools/lessons/village-weight.mjs` — 4/4 PASS + learner kit 611.7 KB.

## 6. Chưa làm (chờ owner / checkout chính chủ)

- Port sang `work/github-studio` + push GitHub (chưa có lệnh).
- Quay clip 30s proof Install/search/provenance trên Chrome sạch.
- Publish video YouTube, dán URL, submit form.
