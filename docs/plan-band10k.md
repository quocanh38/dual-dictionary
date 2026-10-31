# KẾ HOẠCH BAND-10K — mở rộng word pages theo tiêu chí SEO + học thuật

> **TRẠNG THÁI: ĐÃ LIVE 03/10/2026 — v99 deploy `6ac0bab31a24fd0008f15dea` (push `2b6eac7b`); health: smoke 7/7 attempt 1, parity 7125/7125.** Owner: "code 2.568 URL
> mới nhé" → build thật: **+2.566 trang → 6.842** (chênh −2 so với ước tính:
> 5 entry OVDP hỏng >15KB bị loại thêm — greet/lust/sickness/fortunate/learnt —
> bù lại 13 entry dài hợp lệ 60–94 nghĩa giữ được; 41 abbrev thay 44 do trùng
> cổng thin). TODO còn lại: owner resubmit GSC sitemap 6.879 URL. Kết quả
> chi tiết: hàng v99 `docs/deployment.md`.

> Soạn 2026-10-03 sau khi owner hỏi "còn band 10k từ thì sao, có kế hoạch chi tiết
> cho các từ đáp ứng tiêu chí SEO và học thuật". Mọi số liệu bên dưới là **dry-run
> thật** trên dữ liệu repo (`freq-en.json` ∩ OVDP 386.600 keys ∩ regex, mô phỏng
> đúng admission của `tools/build-word-pages.cjs` v96 — KHÔNG build trang nào).
> Chờ owner duyệt rồi mới code.

## 1. Bối cảnh

- LIVE v98: **4.276 trang** word pages (2.000 tần suất 1k-2k + 1.764 band-5k + 512 AWL).
- Band 10k chưa đụng tới — v96 chủ đích để lại ("thin-content review first").
- GSC đã resubmit sitemap 4.313 URL ngày 03/10 → 2–4 tuần tới là baseline index
  cho batch hiện tại, đúng cửa sổ dữ liệu để quyết định nấc tiếp theo.
- AWL (danh sách học thuật chuẩn) đã build **100%** từ v95 — band-10k KHÔNG có
  AWL mới nào; "học thuật" ở nấc này = từ thuộc NGSL (kể cả supplementary).

## 2. Số liệu dry-run (khảo sát 03/10/2026)

| Bước | Số từ | Ghi chú |
|---|---|---|
| Candidate band-10k (freq ∩ regex ∩ OVDP key) | **3.081** | |
| Trừ 147 từ đã có trang (build từ trước qua batch AWL v95) | 2.934 | ví dụ academic, accompany, accurate… |
| auto-remove theo chính sách v96 (vulgar 3: bollocks, cunt, jackass; entry rỗng 4: bbc, co, emotionally, hath) | −7 | |
| **Truly new band-10k** | **2.927** | |
| ↳ nhóm NGSL (core, recognition) | 357 | abortion, absence, agenda, acknowledge… |
| ↳ nhóm Dạng chia (inflection của lemma đã build) | 494 | accepting, accompanied, accounting… |
| ↳ nhóm Ngoài danh sách (off-list) | 2.076 | accountant, accusation, addiction… |
| Chất lượng entry: entry riêng 2.924 (99,9%) — chỉ 3 trang cần entry nguyên mẫu | | tốt hơn nhiều lo lắng ban đầu cho 5k-10k |
| Nghiệm abbreviation "(viết tắt)" | 44 | ai, ammo, asap, ba, dc… |
| Entry mỏng ≤1 block nội dung (non-abbrev, off-list) | 315 | abigail, allah, ant, apologise, aspirin… |
| Entry khổng lồ >60 blocks (nghi anomaly dữ liệu OVDP) | 18 | greet 1412, lust 1324, sickness 1062… — kiểm tay lúc build |

## 3. Tiêu chí admission đề xuất (áp dụng CHO TỪ MỚI band-10k, không đụng chính sách các trang hiện có)

**Tiêu chí học thuật (giá trị học):**
1. **Từ thuộc NGSL (core) → giữ 100%**, kể cả entry chỉ có 1 nghĩa dài (email,
   finance, asset, corporation, elderly… — 34 từ). Lý do: đây là từ nằm trong
   khung học của app; giá trị học > độ dày entry. Cổng "≥2 nghĩa" cứng sẽ loại
   nhầm nhóm này.
2. **Dạng chia (inflection) → giữ 494/494.** Cải thiện chất lượng so với v96:
   dạng có entry riêng mỏng (≤1 block, ~139 từ) hiển thị **entry nguyên mẫu có
   dán nhãn** theo hợp đồng "showing X" v61/v96 — tránh trang 1 dòng trơ.
3. AWL đã build hết — không có thêm.

**Tiêu chí SEO (chống thin content):**
4. **Off-list phải có ≥2 block nội dung** (nghĩa/ví dụ/idiom) → loại 315 từ
   entry 1 dòng. Đây là lớp rủi ro thin-content thật sự (từ ngoài khung học,
   entry trơ).
5. **Loại 44 abbreviation** (ai, asap, dc…) — tra cứu rác, không giá trị học.
6. Vulgar/contentless: tự động theo chính sách v96 (đã loại 7 như trên).
7. Proper name ẩn (abigail, archie, armstrong… — OVDP không dán "tên riêng"):
   không lọc riêng; đa số rơi vào nhóm bị loại bởi cổng ≥2 nghĩa; số sót lại có
   entry thật — tiền lệ v96 (caesar, caroline được giữ).

**Kết quả lọc: giữ 2.568 / 2.927 (87,7%) — loại 359 (44 abbrev + 315 off-list mỏng).**

## 4. Quy mô dự kiến sau deploy

| Chỉ số | Hiện tại | Sau band-10k |
|---|---|---|
| Word pages | 4.276 | **6.844** (+2.568) |
| Hub `/vi/tu/` | ~774 KB | **~1,14 MB** (+370 KB) — cần theo dõi Lighthouse (baseline P94) |
| Sitemap index | 4.313 URL / 3 chunks | **6.881 URL / 4 chunks** — owner resubmit GSC 1 lần nữa lúc deploy |
| Files live | 4.542 | ~7.118 |

Phương án thay thế (nếu owner muốn đơn giản): build full band 2.927 từ, không
lọc → 7.203 trang, hub ~1,2 MB, sitemap 7.240 URL. Chênh 359 trang mỏng/abbrev.

## 5. Việc cần làm khi được duyệt (ước lượng ~1 ngày làm việc)

1. **Build tool** (`build-word-pages.cjs` + `wordlist-lib.cjs`): thêm gate
   band-10k — `SKIP_ABBREV`, `MIN_SENSES` cho off-list, hiển thị lemma entry
   cho inflection mỏng; chạy `WORD_MAXBAND=10k` (nhớ bẫy: build XÓA vi/tu trước
   khi dựng — default mới phải khớp cái đã deploy).
2. **Kiểm tay 18 entry khổng lồ** (>60 blocks) — nếu là rác dữ liệu OVDP thì
   đưa vào danh sách loại/norm.
3. **+15 word-notes viết tay** (122 → 137) cho từ band-10k ra thi nhất
   (agenda, acknowledge, adopt, criterion-family đã có, agenda…) — chọn lúc build.
4. **Gộp luôn follow-up word-notes drift 9 từ** (v96 để lại) — re-apply note.
5. **QA suite v96 đủ chuẩn**: ledger IPA qua resolver, typo scan, CJK leak scan,
   audit thin-pages, link-check toàn site (~6.880 trang), scan-blog, sw-version
   (không bump — `/vi/*` bypass SW), deploy-verify trước/sau (mismatch list =
   change-set có chủ ý, LIVE-ONLY=0 là gate thật).
6. **Biên bản** một gói như thường lệ.

## 6. Thời điểm deploy — KHUYẾN NGHỊ

- **Chuẩn bị build được làm ngay** sau khi owner duyệt (không rủi ro — chưa
  deploy).
- **Deploy nên chờ baseline GSC 2–4 tuần** kể từ 03/10 (đúng khuyến nghị gốc
  khi v96 ship): xem tốc độ index của 1.764 trang band-5k + 512 AWL trước khi
  thêm 2.568 URL. Owner vẫn có thể chốt deploy sớm — chỉ tốn 1 lần resubmit
  GSC và dữ liệu index sẽ trộn 2 batch.
- Sau deploy: theo dõi GSC theo lastmod (trang 10k có lastmod mới) — đòn bẩy
  `noindex` nhóm off-list vẫn giữ sẵn nếu dữ liệu cho thấy pha loãng.

## 7. Rủi ro & cách đo

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Thin content pha loãng GSC | Trung bình — đã lọc 359 từ mỏng nhất; còn ~304 entry >20 blocks | Cổng ≥2 nghĩa cho off-list; noindex lever sẵn sàng; theo dõi per-lastmod |
| Hub nặng 1,14 MB | Trung bình trên mobile 3G | Lighthouse trước/sau; nếu tụt: cân nhắc tách hub theo band (release sau) |
| Entry anomaly OVDP (greet 1412s…) | Thấp — 18 từ | Kiểm tay bắt buộc lúc build |
| Crawl chậm | Thấp | Sitemap lastmod đã có; resubmit lúc deploy |
