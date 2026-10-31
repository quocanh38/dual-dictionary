# BLOG WRITING GUIDE — kỹ năng viết blog Dual Dictionary

> File kỹ năng gộp toàn bộ **4 vòng review** của owner + review giáo viên IELTS
> (09/2026) và quy trình xuất bản đã chạy ổn định qua 33 bài live.
> **Cách dùng:** đọc mục 2–5 trước khi viết; chạy mục 6 (checklist) trước khi
> xin deploy. Bất kỳ quy tắc nào ở đây đều có "vụ gốc" — xem mục 7 để hiểu vì sao.
> Phiên bản: 2026-10-24 (đối chiếu app hiện tại).

---

## 1. Bối cảnh

- Blog: `/vi/blog/` — hub + 3 mảng (IELTS / TOEIC / Phương pháp), 31 bài + 3 pillar.
- Sản phẩm: Dual Dictionary — PWA học offline-first. Từ điển, Reader, dữ liệu học, bài luyện đã tải, bản nháp và file người dùng lưu có thể dùng cục bộ; AI là ngoại lệ online, tùy chọn, BYOK.
- Nguyên tắc nội dung số 1 (tuyên ngôn hub): **mỗi bài phải có giá trị riêng — đọc xong làm được ngay, kể cả khi không dùng app**. Tỷ lệ 70/30 giá trị đứng riêng : phần app.
- DNA không được vi phạm: offline-first có nói rõ phạm vi; không hứa “riêng tư tuyệt đối” hoặc “không dữ liệu nào rời thiết bị” khi bài có nhắc AI; không nhắc thương hiệu tham khảo phương pháp (DOL/Linearthinking/Đình Lực — cấm trong mọi bài, scan tự động chặn).

## 2. Nhân vật & giọng văn (chuẩn đã khóa — plan §5.1)

**Persona:** Quốc Anh, ngoài ba mươi tuổi (KHÔNG bao giờ ghi số tuổi cụ thể), Senior Business Development tại TMA, tự xây Dual Dictionary cho đồng nghiệp luyện TOEIC, bản thân đang học IELTS. LinkedIn: linkedin.com/in/quocanh38.

**Giữ:**
- Ngôi "tôi / bạn" nhất quán xuyên bài; kể chuyện từ trải nghiệm thật của người học, không phải giảng viên.
- Code-switch tiếng Anh tự nhiên (thuật ngữ thi giữ tiếng Anh: passage, cue card, mock test...).
- Câu chốt ngắn, đắt: "Ba lần. Cùng một từ." — mỗi bài tối đa 1–2 câu kiểu này.
- Ẩn dụ đời thường được giải nghĩa ngay (không ẩn dụ phải đoán).

**Tránh (đã từng bị gạch):**
- Calque dịch sát: "trái tim của vấn đề", "điểm ngọt", "chưa chắc hẳn", "lấy từ từ danh sách".
- Hai mệnh đề treo trên một vị ngữ; từ lặp cạnh nhau đọc nhầm ("lấy từ từ").
- Giọng lên gân đột ngột; dồn 3+ thành ngữ cường điệu trong một đoạn ("chết yểu", "khóc không kịp", "chiến trường" cùng lúc).

## 3. Cấu trúc chuẩn một bài (template)

Copy từ bài gần nhất cùng mảng làm mẫu (bài mới nhất luôn là bản chuẩn). Skeleton bắt buộc:

1. `<head>`: title ≤70c, description ≤160c, canonical, OG (type article, og:image riêng), published/modified time, twitter card, JSON-LD (Person + BlogPosting + BreadcrumbList).
2. Breadcrumb (Trang chủ › Blog › [mảng] › bài).
3. H1 (có thể dài hơn title) + byline (tác giả · ngày · ~x phút đọc).
4. `[series-box]` nếu thuộc series — hộp liệt kê đủ các bài, link chéo cả hai chiều.
5. TOC với anchor id tiếng Việt không dấu.
6. Thân bài: mở bằng trải nghiệm cá nhân cụ thể (trừ bài theo cấu trúc khác — mục 4), các H2/H3 có id.
7. Ít nhất 1 figure ảnh app thật (chụp local, không stock) + figcaption nói đúng chức năng.
8. "Đọc tiếp": 3–4 link (pillar + bài anh em liên quan nhất).
9. CTA box: đúng 1 chiếc, cuối bài.
10. Author box: câu cuối xoay theo 1 trong 4 biến thể (mục 5-F).
11. "Nguồn tham khảo": 2–4 nguồn uy tín (ielts.org, British Council, ETS, IDP, Wikipedia) — link thật, đúng trang.
12. Footer chuẩn.

**Không hai bài nào dùng chung câu chốt/câu mở CTA.** Câu signature "miễn phí, offline, không cần tài khoản" chỉ được làm mốc ở tối đa 2–3 bài mỗi lần deploy.

## 4. Cấu trúc theo LOẠI BÀI (giáo viên review vòng 4 — quan trọng)

Đừng ép mọi bài vào khuôn "trải nghiệm → N nguyên tắc → CTA". Chọn cấu trúc theo loại:

| Loại bài | Cấu trúc | Ví dụ live |
|---|---|---|
| **Kỹ thuật/thuật toán** (FSRS, spaced repetition) | Ngắn gọn, trung tính, chính xác — ít chuyện cá nhân, nhiều định nghĩa đúng | fsrs-la-gi |
| **Lộ trình** (IELTS từ 0, TOEIC 750+) | Kể chuyện nhiều hơn: chặng đường, con số kỳ vọng, tâm lý | ielts/index, toeic/index |
| **Từ vựng** | Mở đầu bằng bài tập/thí nghiệm làm ngay được, lý thuyết sau | hoc-tu-vung-trong-ngu-canh |
| **Kỹ năng thi** | Chẩn đoán vấn đề → kỹ thuật từng bước → ví dụ từ đề thật | luyen-doc, listening-part-3-4 |
| **Series phương pháp** | Bài mở = câu chuyện cá nhân; các bài sau = mỗi bài một kỹ năng, hộp series link chéo | "Hiểu tiếng Anh không cần dịch" |
| **Tài liệu tham chiếu** (band descriptors) | Bảng theo tiêu chí, mô tả đúng văn bản gốc + ví dụ | ielts-band-descriptors |

**Series 7 bài "Hiểu tiếng Anh không cần dịch"**: mỗi bài bắt buộc chèn ảnh chức năng app giúp áp dụng phương pháp (Reading→Reader, Listening→Listening mode, Writing→Journal, Speaking→Practice, lỗi tiếng Việt→IPA entry, lộ trình→hàng đợi FSRS).


## 5. Quy tắc nội dung (mỗi mục = một vụ thật)

### App hiện tại — dữ kiện bắt buộc khi nhắc tới tính năng (2026-10-24)

- **Lưu từ/Review:** hộp lưu cho chọn mục từ điển và nghĩa đang xem; lưu định nghĩa đầy đủ (có thể sửa), nguồn từ điển và câu gốc. Một từ có thể có nhiều thẻ nghĩa riêng. Review phải được mô tả là ôn nội dung đã lưu; không nói app tra lại rồi tự cắt nghĩa đầu tiên.
- **Reader:** ước tính độ phủ chỉ có ý nghĩa sau khi người học chọn mốc vốn từ. Nếu chưa chọn, app báo chưa đủ thông tin; đừng viết rằng app mặc định 0%, tự gắn nhãn bài khó hay đo trình độ chính xác.
- **Offline:** chuẩn bị dữ liệu trước để dùng từ điển, nội dung đã lưu, Vault/Review, bài luyện mẫu, bản nháp và media người dùng đã lưu trên cùng hồ sơ trình duyệt. Dữ liệu không tự đồng bộ qua thiết bị; khuyên xuất backup trước khi chuyển/xóa hồ sơ. Nội dung ngoài chưa tải và mọi gọi AI cần mạng.
- **AI Tutor / Writing / Speaking:** tùy chọn online, dùng API key của chính người học. Trước yêu cầu phải nêu chính xác nội dung sẽ gửi và xin đồng ý; provider có thể tính phí token. Không nói “AI miễn phí”, “không dữ liệu nào rời thiết bị” hoặc hàm ý có key dùng chung. Chỉ Speaking notes/transcript dạng chữ được gửi bởi AI feedback; file ghi âm không gửi. Bài mẫu do tác giả biên soạn phải ghi là sample/demo; kết quả cache phải ghi là cache; chỉ gọi live khi thực sự có phản hồi trực tiếp từ provider.
- **Giới hạn thi:** gói hiện có là nội dung mẫu ngắn tự biên soạn, chưa đủ cho section/đề full-length: IELTS Listening 7/40, Reading 8/40; TOEIC Listening 8/100, Reading 8/100. IELTS Writing có Task 1/2 và Speaking có prompt Parts 1–3; TOEIC Part 1 có audio kèm sẵn. App không cấp band IELTS hay scaled score TOEIC chính thức. IELTS Writing/Speaking tự đánh giá; AI chỉ gợi ý luyện, không phải chấm chính thức. TOEIC hiện chỉ là Listening & Reading.
- **Audio/nhận dạng giọng nói:** file audio/transcript người dùng có thể lưu cục bộ để dùng offline. Ghi âm Speaking ở lại thiết bị qua luồng AI feedback. Nhận dạng giọng nói của browser có thể cần dịch vụ online; tuyệt đối không cam kết hoạt động offline.
- **Backup:** có JSON study backup và backup mã hóa; backup có thể chứa ghi chú, bản nháp, audio và phiên học. API key không nằm trong study backup. Không khẳng định dữ liệu tự đồng bộ hay được lưu trên cloud.
- Khi bài hướng dẫn thao tác cụ thể, link tới [Cẩm nang người học](../huong-dan-su-dung.html) và kiểm tra lại label thực tế trong `index.html`/`docs/huong-dan-su-dung.html` trước khi xuất bản.


**A. Sự thật về ngôn ngữ & kỳ thi — kiểm chứng nguồn, lớp lỗi nặng nhất:**
- Tiếng Việt CÓ phụ âm cuối (m, n, ng, p, t, c…) nhưng chỉ là **một âm đơn lẻ, không có cụm phụ âm cuối**, và thiếu các âm cuối /s, z, d/ của tiếng Anh. Đừng viết "hiếm phụ âm cuối / kết bằng nguyên âm".
- Mô hình nhấn âm phải đúng: sigNIFicant (nhấn NIF), không tự chế signifiCANT.
- Ví dụ collocation sai phải là lỗi THẬT người Việt hay mắc (do a mistake, big traffic, protect environment thiếu the) — không dựng ví dụ giả.

**B. Số liệu kỳ thi đã khóa (đừng tự đổi):**
- IELTS Việt Nam **thi máy 100%** từ 29/03/2025 (IDP) — không bao giờ viết lại logistics answer sheet; nói "chọn và rà đáp án trên màn hình".
- Lệ phí IELTS VN: IDP 4.664.000đ Academic/GT; One Skill Retake 2.940.000đ. Bài ghi "trên dưới bốn triệu rưỡi" — vẫn chuẩn.
- **Không có chuẩn wpm theo band** — wpm chỉ là số tự theo dõi tiến bộ (cả Reading lẫn Part 7).
- TOEIC **không có "band"** (từ của IELTS); số câu của part ≠ phần trăm điểm quy đổi (viết "69 trên 100 câu", đừng viết "70% điểm").
- ~200 giờ học thực chất cho **một band** (không phải nửa band).
- Format IELTS: Reading 60'/40q/3 passages; Task 2 40'/250 từ; Speaking Part 2 = 1' chuẩn bị + 2' nói. TOEIC: 200 câu, L 45'/100q (6-25-39-30), R 75'/100q (30-16-54), thang 10–990.
- **Quy tắc làm tròn IELTS — hai thứ khác nhau, đừng trộn:** gộp 4 tiêu chí thành band của kỹ năng (Writing/Speaking) IELTS KHÔNG công bố chi tiết — quy ước đào tạo giám khảo phổ biến là trung bình rồi làm tròn XUỐNG nửa band gần nhất (7.25→7.0); riêng ĐIỂM TỔNG cả bài thi (trung bình 4 kỹ năng) được làm tròn LÊN khi lẻ .25/.75 — quy tắc này IELTS công bố chính thức. Đã từng viết nhầm "làm tròn lên" cho tiêu chí (hotfix 28/09).
- **TOEIC format 2018** (tên gọi đợt thay đổi: toàn cầu 4/2018, Nhật/Hàn 5/2016 — vẫn hiện hành): điểm khác thật = audio chạy liên tục gần không nghỉ giữa các hội thoại, câu hỏi bám tài liệu in trong đề (Part 3), hội thoại 3 người, bài ba tài liệu (Part 7). Câu hỏi Part 3–4 KHÔNG ĐỌC TO ở cả hai format — đừng viết "đề cũ đọc to câu hỏi" (lỗi đã dính 28/09 do copy reviewer chưa kiểm chứng).
- **IELTS Listening hỏi chủ yếu chi tiết cụ thể** (số nhà, tên, ngày) — nhưng KHÔNG tuyệt đối hóa: Part 2 có vài câu hỏi bức tranh tổng thể.
- **TOEIC Part 7 KHÔNG có 75 phút riêng** — 75 phút là của cả Reading 100 câu; Part 7 chỉ chiếm ~55 phút cuối (sau 20 phút cho Part 5–6). Đã từng viết sai "54 câu, 75 phút" ở 7 chỗ (heading/TOC/meta/pillar card).
- **Thuật ngữ không qua biên giới kỳ thi:** TOEIC không có "band" (dùng "mức điểm 500–700"), không có "cue card"/"giám khảo" (đó là IELTS Speaking — TOEIC L&R không có nói viết). Nguồn takeielts.britishcouncil.org là trang IELTS của BC — bài TOEIC dùng learnenglish.britishcouncil.org hoặc ETS.

**C. Khái niệm app/thuật toán:**
- FSRS retrievability = **xác suất còn nhớ thẻ ở thời điểm hiện tại** (không phải "lợi ích nhận được khi ôn").
- Anki HIỆN TẠI hỗ trợ FSRS — đừng viết "Anki chạy SM-2" ở hiện tại; nói "SM-2 từng là mặc định của Anki và nhiều app".
- Từ điển: **386.600 mục từ** — một con số duy nhất mọi nơi (đã từng lệch 386.000/386.600 ở 7 file).
- FSRS/spaced repetition: giải thích cơ chế đầy đủ CHỈ ở 2 bài nền (spaced-repetition-la-gi, fsrs-la-gi); bài khác chỉ nhắc 1 câu + link chéo.
- Nội dung công việc dán vào app → luôn kèm nhắc xóa dữ liệu nhạy cảm (tên khách hàng, số tiền, hợp đồng).

**D. Claims:**
- Cấm hứa kết quả cụ thể: "sẽ được đánh giá cao hơn hẳn", "ai cũng có thể 90%", "sau hai tuần bạn sẽ…", "riêng tư tuyệt đối". Nới thành hành vi quan sát được ("thứ giám khảo để ý", "đa số người luyện đúng cách", "dù chưa hoàn hảo").
- Câu tuyệt đối ("cách duy nhất", "không bao giờ", "đúng nhất") cắt còn ~một nửa khi rà bài.
- Không có chuẩn chính thức thì nói rõ là ước lượng/kinh nghiệm cá nhân.

**E. Hướng dẫn bài tập phải đúng kỹ thuật:**
- Bài luyện collocation tiếng Anh thì bài tập phải là "viết câu TIẾNG ANH" (từng lỗi "câu Việt").
- Part 5 TOEIC: đừng nói "không đọc hiểu gì cả" — Part 6 và câu khó vẫn cần ngữ cảnh.
- Speaking Part 3 ≠ Part 1: cần ngôn ngữ suy đoán/nhượng bộ (I'd say, That's true to some extent, but…, tends to…) và khung 4 nhịp; đừng gộp chung một công thức.

**F. Khuôn mẫu & sự đa dạng:**
- CTA box: mỗi bài một câu mở riêng; có 4 biến thể author box xoay vòng (người học không phải thầy / bài tự đứng không cần app / app tự xây cho nhu cầu của mình / mã nguồn mở minh bạch) — câu gốc giữ đúng 2 bài neo.
- Ngày xuất bản dàn theo nhịp 2–3 bài/tuần, thứ tự logic; không dồn một ngày.
- Ẩn dụ phải giải mã là cấm: "da thịt", "độ dốc", "vật chủ", "từ đắt", "tắm nước ấm", "sân của người khác", "bắt mồi", "bần cùng", "làm việc bẩn thỉu". Thay bằng mô tả thẳng.
- Ảnh chụp app phải đúng chủ đề bài (đừng chèn ảnh cue card vào bài TOEIC); tái sử dụng ảnh từ kho được nếu ngữ cảnh khớp.

## 6. PRE-SHIP CHECKLIST — chạy đủ 9 mục trước khi xin deploy

> **Quy trình chống lặp lại (thiết lập 28/09 sau 5 vòng review):** "không lặp lại" không phải lời hứa mà là 4 lớp máy móc + quy trình dưới đây. Nguyên tắc gốc: **tôi (AI) viết từ trí nhớ thống kê — cảm giác "chắc chắn" không phân biệt được nhớ đúng với nhớ sai; claim của reviewer cũng phải qua cùng cổng kiểm chứng như claim của bài viết.**

**Lớp 1 — REGRESSION SCAN (máy, bắt buộc):** `scan-blog.js` chứa danh sách `BANNED_REGRESSION` — **mỗi lỗi từng sửa trở thành mẫu cấm vĩnh viễn** (lỗi gõ dở, ẩn dụ bị chối, claim sai sự thật, nhiễm chéo kỳ thi, số lệch 386.000, href slug sai…). Khi một lỗi mới bị bắt: thêm mẫu vào danh sách + deploy. Quét toàn blog trước mọi deploy; ALL PASS mới được xin deploy.

**Lớp 2 — FACT VERIFICATION lúc viết (không chờ "thấy nghi"):** mọi claim về kỳ thi/ngôn ngữ học trong bài mới phải tra nguồn **ngay lúc viết** (web search), ghi link nguồn vào cuối draft dạng chú thích tạm; dọn trước khi publish. Nếu không tra được nguồn → viết lại thành kinh nghiệm cá nhân có hedge, không viết thành fact.

**Lớp 3 — READ-THROUGH AGENT TRƯỚC deploy (trước khi owner nhìn thấy):** hai agent chạy trên DRAFT: (a) editorial read-through theo checklist mục 5–7; (b) fact-checker so mọi claim với §5B + nguồn. **Mọi quote của agent phải đối chiếu file thật trước khi sửa** (~4% bịa). Sau đó owner duyệt → deploy.

**Lớp 4 — CLAIM CỦA REVIEWER = CLAIM:** góp ý của owner/reviewer có giá trị chỉ ra ĐỂ SỬA, nhưng phần giải thích kỹ thuật kèm theo vẫn phải kiểm chứng nguồn trước khi đưa vào bài ("đề cũ đọc to câu hỏi" — sai — đã lọt qua cổng này 28/09).

**Checklist 9 mục (ráp vào 4 lớp trên):**

1. **Facts** — mọi khẳng định ngôn ngữ học/kỳ thi có nguồn? (mục 5A-B)
2. **Số liệu khóa** — so lại mục 5B-C; một con số duy nhất toàn site.
3. **Dấu vết biên tập** — quét mẫu từ mục 7; đọc trọn văn một lượt bằng mắt (bắt câu gãy, chữ dở, markup lòi).
4. **Giọng** — ẩn dụ được giải nghĩa? ≤2 thành ngữ đắt/bài? không nhảy giọng?
5. **Claims** — hứa hẹn đã nới? câu tuyệt đối đã cắt nửa?
6. **Hướng dẫn** — bài tập nói đúng hành động? đúng kỹ năng?
7. **Khuôn** — CTA riêng? câu chốt riêng? cấu trúc theo loại bài? không trùng câu chốt bài nào?
8. **Quyền riêng tư** — nhắc redact nếu bài khuyên dán tài liệu công việc.
9. **Cổng máy**: `scan-blog.js` (NFC, ký tự lạ, cân bằng thẻ, meta ≤70/160, JSON-LD, ảnh tồn tại, \bDOL\b) → `link-check.js` toàn site (BẮT BUỘC — bắt slug sai) → `verify-render-blog.js` local → agent đọc thử (nội dung mới, luôn kiểm chứng quote của agent).

## 7. Bẫy đã dính — đừng dính lại

- **Ảnh chụp tái sử dụng giữa các bài đọc liền nhau:** cùng một file webp trong 2 bài kề nhau (kể cả caption khác) là tín hiệu khuôn rõ nhất với người đọc liên tục — cần kho ảnh per-post hoặc chụp mới. Đã dính: review-fsrs.webp ×2, vault-tags.webp ×2, reader-save-sentence.webp ×2 (chờ chụp mới — việc mở).
- **Bài tập mở đầu cũng thành khuôn nếu lặp đúng công thức** ("làm bài tập → đúng thì bỏ qua / sai thì bài này cho bạn" ×3 bài liền): công thức được phép, NHÁNH THOÁT thì mỗi bài một kiểu diễn đạt.
- **Trộn hai câu chuyện gốc:** câu chuyện "app sinh ra cho đồng nghiệp luyện TOEIC" không được lòe vào câu chuyện gốc của bài khác (bài lộ trình IELTS từng kết đoạn mở bằng "…dạy lại cho đồng nghiệp luyện TOEIC" — mâu thuẫn với nhân vật vừa giới thiệu là người hỏi về IELTS). Câu cuối của đoạn mở phải quay đúng về nhân vật/vụ việc mà chính đoạn đó nêu.
- **Slug "Lộ trình tự học IELTS"** = pillar `/vi/blog/ielts/` — KHÔNG tồn tại slug `lo-trinh-tu-hoc-ielts`. Đã sai 3 lần; link-check bắt được cả 3 lần.
- Ký tự lạ sót trong draft: 流畅, 搭档, Dienst, cuentas, "marii" — scan bắt.
- "DOL" trong scan dùng `\bDOL\b` — không thì false positive với "dollars".
- Cụm tự đặt mơ hồ ("học theo dòng") bị owner chối — mọi khái niệm mô tả bằng hành vi + ví dụ.
- Quote của agent đọc-review phải đối chiếu file thật trước khi sửa (~4% bịa).
- Chỉnh meta description phải nhớ nó xuất hiện 2 chỗ (meta + JSON-LD) — đếm đủ.
- Node không có PATH: dùng portable `/tmp/node-v22.14.0-darwin-arm64/bin` (volatile — tải lại nếu mất).

## 8. Quy trình xuất bản (playbook 10 bước)

1. Chọn góc theo SERP (từ khóa long-tail, mô tả đúng intent).
2. Viết theo cấu trúc loại bài (mục 4) + giọng chuẩn (mục 2); chừa slot ảnh app.
3. Chụp ảnh app thật trên server local (`ui-check/blog-shot-reader*.js` là mẫu; WebP ≤100KB, 1200px).
4. Tạo OG 1200×630 (template teal `/tmp/og-card-*.html`, Chrome headless, dấu tiếng Việt kiểm tra bằng mắt).
5. Đặt ngày xuất bản theo nhịp dàn lịch; đồng bộ 4 chỗ: meta published/modified, JSON-LD, byline.
6. Link chéo 2 chiều: pillar + 3–4 bài anh em; thêm vào "Đọc tiếp" của pillar; sitemap +1 URL (xmllint).
7. Checklist 9 mục (mục 6) + `scan-blog.js` + `link-check.js`.
8. `verify-render-blog.js` — xem bằng mắt ảnh + layout.
9. **Xin owner "deploy"** (quy tắc khóa — không tự deploy).
10. Deploy → health check retry ×3 (curl markers + sitemap count + brand-check) → ghi dòng mới vào `docs/deployment.md` → cập nhật memory.

## 9. Công cụ

| Công cụ | Vị trí | Làm gì |
|---|---|---|
| Portable Node | `/tmp/node-v22.14.0-darwin-arm64/bin` (export PATH) | chạy mọi script dưới |
| `scan-blog.js` | `DSH/ui-check/` | NFC + ký tự cấm + thẻ + meta + JSON-LD + ảnh + \bDOL\b — walk toàn blog |
| `link-check.js` | `DSH/ui-check/` | internal href/src + anchor + sitemap file-backed, toàn website |
| `verify-render-blog.js` | `DSH/ui-check/` | render các trang trên server local, chụp PNG kiểm tra |
| `blog-shot-reader.js` / `-2` | `DSH/ui-check/` | chụp Reader có từ chạm + entry + context bar (tham số hóa passage/word/OUT khi cần) |
| Chrome headless | `/Applications/Google Chrome.app/.../Chrome` | render OG card 1200×630 từ HTML template |
| `deployment.md` | `netlify-deploy/docs/` | biên bản từng deploy — dòng mới chèn TRÊN dòng v cũ nhất gần nhất |
| `blog-content-plan.md` | `netlify-deploy/docs/` | plan + mục 9 (series) — cập nhật trạng thái sau mỗi đợt |

## 10. Việc mở

- Tái cấu trúc từng bài cũ theo loại bài (mục 4) — chờ plan riêng.
- E-E-A-T: bổ sung bằng chứng cá nhân (band điểm/chứng chỉ) — chờ owner cung cấp.
- Một ngày nào đó: rà lại pillar theo chu kỳ ~6 tháng.
