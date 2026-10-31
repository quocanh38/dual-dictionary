# Plan — P2 fuzzy "Có phải bạn muốn tìm…?" + Practice layer

> Trạng thái: **CHỜ OWNER DUYỆT** — không code trước khi duyệt (quy tắc feature app).
> Điều tra hiện trạng: 06/10, trên working copy v110 (commit `4ddaaab10`).
> Ranh giới chung: app là PWA tĩnh, **no-tracking** (mọi số liệu ở local), offline-first,
> non-commercial. Mọi thay đổi `js/app.js` / `index.html` / `css/style.css` là precache shell
> → **bump `mdx-dict-vN`** trong sw.js (bẫy 8, sw-version-check chặn). Runbook deploy áp dụng
> nguyên văn (gates → deploy-verify → push = deploy → smoke ×3 + parity → biên bản).

---

## 0. Hiện trạng (điều tra 06/10)

| Mảng | Thực tế trong code |
|---|---|
| Search | `search(word)` → `renderSlot(slot, word)` mỗi dict; form biến thể đã resolve (U2, banner "No exact entry — showing X"); **miss** = dòng status `no results found for "…"` — không có gợi ý gì thêm |
| Autocomplete | `suggest(q)` — prefix + phrase matching trên `mdx.allKeys` của dict đã load (OVDP ~386k, WordNet, Wiktionary). **Không có Levenshtein/fuzzy** |
| Practice | ĐÃ CÓ: `#practice-view` + `startPractice(ids)` — pool = **chỉ item đã lưu trong Vault** (due trước, mới sau), session 10 câu, 6 loại bài: cloze, dictation, listen (TTS), choice (MCQ qua `quickGloss`), recall, say (speech recognition). Vault trống → practice trống (dead-end) |
| FSRS/Vault | `db.js`: stores `files` / `items` / `reviews`; FSRS due + review queue riêng; export CSV/Anki |
| Data client | `data/ipa-en.json` 3.7 MB — lazy fetch, **không precache** (pattern chuẩn cho JSON lớn); freq-en 148K, classification 180K, ngsl 40K, awl 12K — build-time, app chưa fetch |

**Khoảng trống mà 2 feature này lấp:**
1. Gõ sai chính tả → chỉ nhận "no results" (mấtLead: user từ Google vào word page → app → gõ sai → bí).
2. Practice chỉ chạy trên thứ user đã lưu — người mới (nhóm chính mà word pages kéo về) không có gì để luyện.

**File data chung cho cả 2 feature — `data/built-words.json`** (sinh bởi `tools/build-word-pages.cjs`):
mảng 6.839 từ đã build, mỗi phần tử `{w, b (band 1k–10k|awl), r (ngslRank|null), a (awlSublist|null)}` —
~170 KB minified. Lazy fetch như `ipa-en.json` (không precache), cache in-memory qua promise.
Builder sinh cùng lúc build word pages → không bao giờ lệch với site.

---

## 1. Feature A — P2 fuzzy "Có phải bạn muốn tìm…?" (release v111)

### Nguyên lý
Khi lookup **không có entry chính xác** (miss thật, không phải dạng biến thể đã resolve) → hiện
dưới status miss một hàng chip: `Có phải bạn muốn tìm: [apple] [apply] [aptly]?` — bấm là tra ngay.

### Thuật toán (client-side, không đụng suggest/autocomplete hiện có)
1. **Tập ứng viên**: `built-words.json` (6.839 từ — ưu tiên, có band để xếp hạng) ∪ `mdx.allKeys`
   của các dict đã load (phủ cả từ chưa build).
2. **Prefilter rẻ** (trước Levenshtein): `|len(q) − len(k)| ≤ 2` AND (chữ cái đầu giống OR k chứa q).
3. **Levenshtein banded** ngưỡng theo độ dài: `q` ≥ 5 ký tự → dist ≤ 2; 3–4 ký tự → ≤ 1; < 3 → không gợi ý.
   Early-exit khi vượt ngưỡng. Chạy 1 lần trên submit (không chạy theo keystroke) — ước lượng < 30 ms.
4. **Xếp hạng**: built-words trước (band 1k → 10k → AWL), sau đó key dict (alphabet). **Tối đa 3 chip.**
5. **Ẩn** khi: query chính là một key (khôngMiss), đã resolve dạng biến thể (U2 lo), query < 3 ký tự,
   hoặc không ứng viên qua ngưỡng.

### UI/UX
- Vị trí: ngay dưới dòng status miss, trong mỗi panel dict (dùng lại class chip có sẵn của hub-style).
- i18n: `search.didYouMean` = "Có phải bạn muốn tìm…?" / "Did you mean…?" — theo pattern `i18nFmt`.
- Offline: lần đầu dùng mà chưa có `built-words.json` trong cache → vẫn chạy với `allKeys` (graceful).

### Gates + nghiệm thu (v111)
- `sw.js` bump **v89 → v90** (app.js + index.html đổi; built-words.json lazy, không precache).
- Smoke mới (ui-check, chạy cả prod lẫn local): tra "aple" → panel hiện ≥1 chip; bấm chip → entry
  "apple" render; tra từ đúng → KHÔNG hiện chip; tra 2 ký tự → không chip.
- Suite cũ phải xanh nguyên (relA/relB/ux3/context/gap3/ipa/fsrs…).
- Ước lượng: **~1 buổi** (code + smoke + records).

---

## 2. Feature B — Practice layer (v112 MVP → v113 mở rộng)

### Nguyên lý thiết kế
Practice hiện tại = luyện trên **Vault của tôi**. Lớp mới thêm **curriculum có sẵn**: luyện theo
band từ vựng (NGSL 1k→10k, AWL) mà **không cần lưu gì trước** — khớp đúng hành trình user mới
từ word pages → app. Sinh câu hỏi **tại chỗ** từ entry OVDP đã load trong app (nghĩa vi, ví dụ
"=EN+VI" qua marker tokenizer có sẵn của app) — không thêm API, không thêm data lớn.

### Quyết định thiết kế (owner cần chốt — mặc định đề xuất)
| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| D1 | Practice curriculum có tự tạo card FSRS trong Vault không? | **Không.** Session luyện là ephemeral; từ trả lời SAI hiện CTA "Lưu vào Vault để ôn sau" (dùng save flow có sẵn). FSRS vẫn chỉ chạy trên vault → không phá SRS, không phình queue |
| D2 | Deck nào trong MVP? | `NGSL 1k`, `2k`, `3k–5k` (gộp), `6k–10k` (gộp), `AWL`, `Vault của tôi` (pool hiện tại). 6 chip |
| D3 | Có cộng điểm/streak dài hạn không? | Không — giữ `practiceStats` trong session như hiện tại (no-tracking tối giản). Đếm số session hoàn thành theo deck (localStorage, 1 số/deck) chỉ để hiện "đã luyện N lần" |

### MVP (v112)
- **Deck picker**: hàng chip trên `#practice-view` (thay dead-end "practice-empty" khi vault trống).
- **Sinh câu hỏi** từ `built-words.json` + entry OVDP runtime:
  - `choice` EN→VI: prompt = từ (+IPA nếu có), 4 lựa chọn = nghĩa đúng + 3 nghĩa của từ **cùng band**
    (lọc: nghĩa 20–90 ký tự, bỏ nghĩa chứa label rác "(từ lóng)/(Mỹ)" ở đầu khi có thể).
  - `recall` VI→EN: prompt = nghĩa vi, 4 lựa chọn = từ tiếng Anh.
  - Pool đề: 40 từ đầu deck chưa xuất hiện trong session này; loại từ user đã có trong Vault (tránh trùng ôn).
- **Session**: 10 câu như hiện tại; kết thúc = summary hiện có + CTA lưu từ sai.
- **Tái dùng**: item tổng hợp cùng shape `{id, type:'word', text, context}` → `renderPractice` /
  `practiceExercise` chạy nguyên bản, chỉ thêm nguồn pool. Kinds mới = 0; UI mới = deck chips + CTA.

### Mở rộng (v113 — chỉ làm khi MVP đã sống trên thiết bị thật)
- `listen` (TTS phát từ → chọn nghĩa) và `cloze` (điền từ vào ví dụ "=EN+VI" lấy từ entry) —
  cả hai đã có sẵn machinery, chỉ thêm generator.
- IPA drill (nhìn phiên âm → chọn từ) — dùng `ipa-en.json` đã lazy.
- Deep-link từ word pages: CTA "Luyện band này" trên word page tĩnh → `/?deck=ngsl1`
  (parse 1 param tại boot; word page đổi template ở lần build kế — tách release content nếu làm).

### Gates + nghiệm thu (v112)
- sw bump **v90 → v91** (app.js + index.html; built-words.json vẫn lazy).
- Smoke mới: chọn deck NGSL 1k → 10 câu render, loại choice/recall xen kẽ, trả lời → summary;
  vault trống → vẫn luyện được; từ sai → CTA lưu hiện; lưu → item xuất hiện trong Vault.
- Suite cũ xanh; **owner device test trên Android PWA thật** (điều kiện nghiệm thu release).
- Ước lượng: MVP **~2 buổi**; v113 mỗi mục ~nửa buổi.

---

## 3. Thứ tự + runbook

| Release | Nội dung | sw | Rủi ro |
|---|---|---|---|
| **v111** | Fuzzy + `built-words.json` (builder sinh) | v89→v90 | Thấp — thêm hiển thị trên miss, không đổi logic lookup |
| **v112** | Practice MVP (deck picker + choice/recall) | v90→v91 | Trung bình — chạm `renderPractice` dùng chung; bắc cầu bằng synthetic-item shape + smoke |
| **v113** | Practice mở rộng (listen/cloze/IPA/deep-link) | v91→v92 (nếu precache đổi) | Thấp — cộng thêm generator |

Mỗi release chạy đúng runbook §3 (gates → deploy-verify → push = deploy → smoke ×3 + parity →
biên bản một gói). Không gộp v111+v112 thành một deploy — tách để nếu practice có vấn đề,
fuzzy không bị kéo theo.

## 4. Rủi ro & biện pháp
- **Nghĩa OVDP làm distractor xấu** (label rác, nghĩa trùng): lọc độ dài + loại trùng chữ đầu;
  nếu vẫn xấu trên thiết bị thật → hạ scope còn `recall` VI→EN (không cần distractor).
- **built-words.json lệch với site**: sinh bởi chính builder trong cùng lần build → không thể lệch;
  drift-check = số từ trong file == 6.839 (assert trong build).
- **Levenshtein chậm trên máy yếu**: prefilter + banded + chỉ chạy trên submit; nếu vẫn chậm
  (đo trên device test) → giới hạn ứng viên vào built-words (6.839) thay vì allKeys.
- **Không-tracking**: mọi counter chỉ localStorage trên máy; không có fetch đo lường nào thêm.
