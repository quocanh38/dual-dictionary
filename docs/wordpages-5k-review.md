# Word pages 2k→5k — BÁO CÁO REVIEW v2 (chưa deploy)

> Trạng thái: STAGED trong `netlify-deploy/` — chờ owner nghiệm thu rồi mới push (v96).
> Mục đích chi phối chính sách: **SEO traffic + giá trị học** (chỉ đạo owner 02/10).
> Build: `node tools/build-word-pages.cjs` — band-cap `WORD_MAXBAND=5k` + chính sách REMOVE 2-pass.

## Phạm vi band
- Chỉ band 5k (1.916 từ mới). Cap theo BĂNG TẦN (count-cap 5000 đầu tiên làm lọt
  1.084 từ band 10k — đã sửa trước khi build).
- 132 từ AWL band-5k được hấp thụ vào batch-1 (giữ chip AWL, thêm chip tần suất).

## Chính sách REMOVE (owner: `remove 33 trang… luôn` + `có content thì giữ lại`)
Hai-pass build: pass xét duyệt trước khi viết bất kỳ file nào.
- **Bỏ hẳn 21 từ**: 18 vulgar (ass/fuck/bitch/damn…) + 3 không có nội dung
  (`cannot`, `ma`, `ongoing` — OVDP không có entry/render rỗng, không cứu được).
  → 14 trong số đó đang có trên live v95 — deploy v96 sẽ xoá chúng khỏi
  production CÓ CHỦ ĐÍCH (deploy-verify sẽ báo LIVE-ONLY=14 — đây là delta mong muốn).
- **Cứu 12 trang dạng bất quy tắc** (did/got/is/ran/blew/fed/hid/lit/led/those…):
  entry OVDP của chúng là crossref-stub render rỗng → fallback entry NGUYÊN MẪU
  có dán nhãn (`did` → mục của `do`) — đúng hợp đồng `showing X` của app từ v61.
  Owner xác nhận: `có content thì giữ lại`. Lemma map bổ sung these/those.
- Kết quả: **4.276 trang** (từ 4.297 ứng viên) · hub 4.276 dòng · sitemap 3 chunks
  (2000+2000+276) · index tổng **4.313 URL**.

## Audit SEO + học thuật trên TOÀN BỘ set (4.296 trước khi remove)
| Nhóm | Số trang | rich (≥2 nghĩa/idiom) | medium (≥1 block) | nothing |
|---|---|---|---|---|
| core (NGSL) | 2.250 | 2.097 | 153 | 0 |
| off-list | 1.141 | 938 | 200 | 3 |
| inflection | 742 | 556 | 174 | 12 |
| academic (AWL) | 145 | 116 | 29 | 0 |
| vulgar | 18 | 16 | 2 | 0 |
Kết luận: nội dung trống rỗng thật sự chỉ 15 trang (0,35%) — đã remove. Phần
còn lại là entry từ điển thật; nhóm off-list 45% của band 5k chủ yếu tên nhân
vật phim + từ hiếm, vẫn có giá trị tra cứu (không phải thin-content theo định
nghĩa Google). Lever SEO dự phòng nếu GSC xấu: noindex riêng nhóm off-list
(chưa áp).

## QA đã chạy (đều xanh)
- 0 violation · 0 thinPages · 116 IPA non-dataset kiểm tay 116/116.
- Typo scan + leak scan (CJK/mojibake) trên toàn trang mới: 0.
- fix `lemmaStems` (-ies→-y, phụ âm đôi) + admission dùng `lemmaCandidates`
  (resolver) TRƯỚC để tránh dính key rác (did phải về `do`, không phải `di`).
- Vulgar list +`pussy` (nhãn nhất quán).
- link-check ALL LINKS OK 4.316 trang · sw PASS v88 (word pages bypass SW) ·
  deploy-verify: LIVE-ONLY=14 = đúng danh sách remove có chủ đích (xem trên).

## Khi owner ra lệnh deploy
rsync mirror → commit v96 → push (push = deploy) → smoke + verify + ghi biên bản
(deployment.md v96 + deploy-state §1 + handoff). GSC: submit lại sitemap
(index 4.313 URL). Band 10k: chờ dữ liệu GSC 2–4 tuần của batch này.
`— DSH, 2026-10-02 —`
