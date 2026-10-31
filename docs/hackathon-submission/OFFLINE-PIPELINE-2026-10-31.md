# Offline Lesson Pipeline — workplace English where the network drops

Ngày: 31/10/2026 · Phạm vi: `lessons/` + IELTS/TOEIC offline trong app chính.
Câu chuyện: người đi làm ở nơi mạng chập chờn chuẩn bị pack nơi có mạng → tự học hoàn toàn offline.

## Tại sao là người lớn, không phải trẻ em

33 packs là workplace (20) + academic (13), B1 (20) + B2 (13): handover ca,
supplier delivery, safety plan, audit, rota — nội dung người đi làm.
IELTS pathway lên tới 6.5→7.0, diagnostic 40 câu/kỹ năng, timed 90 phút.
Kể đúng hàng: ca đêm, công trường, vùng ven, xe đường dài — mạng yếu nhưng vẫn học được.

## 1. Con số nhẹ thật (đo bằng `tools/lessons/village-weight.mjs`)

| Lớp | Kích thước đo được | Ghi chú |
|---|---|---|
| Studio shell (HTML+JS+CSS+provenance, chưa pack) | 275 KB | budget 290 KB — PASS |
| 1 pack lớn nhất | 11.2 KB | budget 12 KB — PASS |
| Bảng provenance 33 packs (1 fetch) | 17.6 KB | budget 24 KB — PASS |
| **Full learner kit (shell + cả 33 packs)** | **~612 KB** | budget 700 KB — PASS |

Đối chứng trung thực: repo tổng ~241MB vì còn `data/` 36MB + `dicts-en-vi/` 11MB
+ `vi/` 102MB (tư liệu từ điển, KHÔNG phải thứ thiết bị học cần sau khi cài).
App chính `js/` 1.6MB (`app.js` 428KB, `ielts-meta-practice.js` 866KB) — first-load
từ điển vẫn là điểm trừ đã biết; đường learner (lessons + IELTS L/R offline) tách rõ.

## 2. Code đã làm (không gọi provider, không sửa pack đã duyệt)

- `lessons/index.html` — hero offline pipeline + banner: prepare nơi có mạng,
  học airplane-mode; install 1 lần, học mãi.
- `lessons/village.js` (overlay, defer sau app.js) — search offline client-side,
  dòng provenance Meta từng pack (1 fetch `provenance.json`, có cache),
  low-memory mode (`prefers-reduced-motion` / save-data). Không sửa logic Studio lõi.
- `lessons/library/provenance.json` (sinh bằng `tools/lessons/build-provenance.mjs`)
  — 33 packs: provider/model/promptVersion/reviewerType/sha rút gọn.
- `tools/lessons/build-provenance.mjs` — đọc file local, 0 provider call.
- `tools/lessons/village-weight.mjs` — kiểm toán KB, fail-closed khi vượt budget.
- `sw.js` — precache `village.js` + `provenance.json`, cache v152.
- `lessons/app.js` — `offlineReady()` bao 2 file trên để báo "Ready offline" đúng.
- App chính `index.html` — banner offline pipeline + 2 CTA không key
  (33 packs · IELTS/TOEIC lab); IELTS lab badge `OFFLINE · no key` + dòng offline path;
  2 khối AI feedback gắn badge `ONLINE · own key`. i18n EN/VI đủ bộ, CSS tôn trọng reduced-motion.

## 3. IELTS/TOEIC offline — audit trung thực (đọc code `js/offline-study.js`)

- Listening/Reading: content pack gốc trong `js/study-content.js` + diagnostic
  40 câu/kỹ năng IELTS, TOEIC L&R theo SECTION_TARGETS — chấm bằng answer key
  cố định, giải thích có sẵn, KHÔNG cần mạng.
- Listening phát bằng `speechSynthesis` của trình duyệt (giọng máy, không phải đề thi
  chính thức, không chấm band) — đã ghi rõ trong UI.
- Writing/Speaking: prompt + tự đánh giá offline; nút "AI review" là OPTIONAL,
  cần key riêng + consent từng lần. Không claim AI chấm điểm offline.
- Không claim learning-gain, band diagnosis, đề thi chính thức.

## 4. Kịch bản triển khai (cho video + form)

1. Nơi có mạng: mở Studio → cài 33 packs + IELTS pack → verify "Ready offline"
   → export backup ra USB/file.
2. Nơi mạng yếu/mất mạng: mở PWA đã cài → học lesson, làm IELTS L/R, lưu Vault,
   review spaced — không tài khoản, không key, không tracking.
3. Mỗi pack ~10KB nên chép cho cả nhóm trong vài phút.

## 5. Validation đã chạy

- `tools/lessons/check.mjs` — 27 contract groups PASS.
- `tools/lessons/library-check.mjs` — PASS, 0 provider calls.
- `tools/lessons/quality-gate-check.mjs` — PASS (gồm fix fileURLToPath).
- `tools/lessons/village-weight.mjs` — 4/4 PASS.
- `node --check js/app.js` + `tools/sw-shell-check.cjs` — PASS.

## 6. Giới hạn công khai (giữ trong form + README)

- Review là AI-assisted (model chấm model, agent tự duyệt theo ủy quyền 27/10),
  không phải human review hay chứng nhận sư phạm.
- Demo là Chrome DevTools offline emulation, footage biên tập lại cho 3 phút,
  giọng synthetic — không phải rút mạng vật lý, máy thật hay nghiên cứu người học.
- Creation route mới đi Baseten Muse Spark Open; Meta Model API là repair optional;
  bằng chứng Meta mạnh nhất nằm trong metadata pack lịch sử (muse-spark-1.3).
- Video URL, 2 surveys, consent, submit cuối: chờ owner.
