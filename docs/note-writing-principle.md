# Nguyên tắc viết note (note-writing principle)

> Áp dụng cho mọi lô note tay (`data/word-notes/*.md`) từ nay trở đi.
> Chốt bởi owner khi lập lô 1: **"chọn từ theo GIÁ TRỊ BẪY, không theo rank"**.
> Bản tóm gọn do owner phê duyệt (05/10):

## Nguyên tắc cốt lõi

> **Rank quyết định từ nào có trang; bẫy quyết định từ nào xứng có note.**

- **Rank** (tần suất — `data/ngsl.json`, `data/freq-en.json`) quyết định từ nào được
  build thành trang. Đó là việc của generator, không phải của biên tập.
- **Bẫy** (giá trị bẫy cho người học Việt) quyết định từ nào được viết note tay.
  Auto-note đã phủ nghĩa cơ bản cho 100% trang; note tay chỉ xứng tồn tại khi mang
  thứ auto-note không thể có.

## 5 nhóm bẫy (ví dụ chuẩn từ các note đã live)

1. **Cấu trúc / collocation** — have difficulty + V-ing; prevent FROM V-ing;
   argue WITH sb ABOUT sth; cope WITH; capable OF V-ing; recommend + V-ing.
2. **Cặp từ dễ nhầm** — affect/effect; issue/problem; economic/economical;
   refuse/reject/deny; historic/historical; effective/efficient.
3. **Phát âm** — tear /teə/–/tɪə/; suspect /ˈsʌspekt/(n)–/səˈspekt/(v);
   content (n)–conTENT (adj); row /rəʊ/–/raʊ/; perfect (adj)–perFECT (v).
4. **Chính tả Anh–Mỹ** — favour/favor; licence/license; gray/grey;
   analyse/analyze; honour/honor; theatre/theater.
5. **Dịch chệch từ tiếng Việt** — "rich experience" ✗ → extensive experience;
   "quite a few" ≠ "một vài"; "learn knowledge" ✗ → acquire knowledge.

## Quyết định có / không có note

**Có note** khi từ có ≥1 bẫy thật (một trong 5 nhóm), HOẶC thuộc danh sách đã
cam kết phủ kín (AWL 1–5, NGSL 1001–2000 — giữ trọn vẹn, không bỏ lại).

**Không note** khi:
- từ phổ biến mà không bẫy (table, door, kitchen) — auto-note đã đủ, note tay = filler;
- dạng biến thể của lemma đã có note (abandon→abandoned) — trang đã có chip "Dạng chia";
- phần đuôi tần suất thấp mà đợt chọn lọc đã bỏ qua (NGSL A1–A2, AWL non-Oxford
  không chọn, inflection AWL) — KHÔNG làm lại, làm thêm = filler.

**Bẫy làm trọng tâm nội dung:** mục "Điểm cần nhớ" của mọi note dẫn bằng
pattern/collocation/bẫy — KHÔNG chép lại định nghĩa từ điển. Nguồn LDOCE6/OALD10
chỉ để ĐỐI CHIẾU; nội dung viết bằng lời DSH (quy tắc số 1, dữ liệu © LOCAL-ONLY).

## Lịch sử áp dụng

- **v105/v106** — phủ kín range theo lệnh owner (top-1000, 1001–2000); bẫy vẫn là
  trọng tâm từng note.
- **v107** — bẫy làm **bộ lọc**: NGSL 2001–2809 chỉ lấy 252 từ (Oxford 3000 ∩
  CEFR B1+; loại 134 từ A1–A2); AWL 6–10 lấy 152 từ (120 Oxford-tagged + 32 curated
  conversely/notwithstanding/implicit/intrinsic…), bỏ ~124 từ giá trị thấp.

## Checklist khi đề xuất lô mới

1. Liệt kê bẫy thật của từng từ ứng viên — kiểm chứng bằng kho LDOCE6/OALD10
   (không đoán từ trí nhớ).
2. Từ nào không nêu được ≥1 bẫy cụ thể → loại khỏi lô, bất kể tần suất.
3. Quy mô lô do giá trị quyết định — KHÔNG do mục tiêu "đạt 100%".
4. Đủ pipeline: verify pattern → validate-then-write (3 section + NFC + CJK +
   artifact-scan, assert trước khi ghi) → apply-only (không rebuild, giữ lastmod)
   → drift 0 → CJK 0 → link-check ALL OK.
