# Blog Content Plan — IELTS & TOEIC (thị trường Việt Nam)

> _Status: **ĐÃ DUYỆT** bởi owner (2026-09-26): URL `/vi/blog/` + 3 quy tắc
> (dẫn nguồn uy tín trong bài; ảnh chụp app làm minh họa chính, stock free bổ
> sung; cập nhật sitemap sau mỗi bài) + chỉ đạo "đẩy `/vi/` lên vai trò trung
> tâm". Từng cụm bài sẽ được viết thành brief giao AutoClaw execute (đúng mô
> hình WORKING_RULES). Brief scaffold đã xuất: `work/briefs/2026-09-26-blog-scaffold-vi-central.md`._

Mục tiêu: traffic organic tiếng Việt → landing `/vi/` → cài PWA và dùng thật.
Mục tiêu phụ: backlink tự nhiên (các bài "method" có khả năng được share trên
group học tiếng Anh hơn bài "list từ").

## 1. Định vị chiến lược

**Khe hổng SERP hiện tại** (check 2026-09-26): query "từ vựng TOEIC/IELTS" bị
lấp bởi trang list từ (easyword.vn, study4.com, zim.vn) — đầu bài nào cũng chốt
bằng chốt sales "học khóa của chúng tôi". Hai khe hổng thật:

1. **Method + tool content**: "cách học từ vựng không quên", spaced repetition,
   luyện nói cue card, luyện đọc tap-to-lookup — ít bài cạnh tranh trực tiếp,
   đúng chỗ Dual Dictionary là câu trả lời.
2. **Chốt CTA khác biệt**: mọi đối thủ chốt khóa học trả phí; Dual Dictionary
   chốt "làm ngay, miễn phí, offline, không cần tài khoản" — trung thực 100% với
   DNA no-account/no-tracking. Đây là lợi thế content marketing thật, không cần
   phóng đại gì.

**Ngôn ngữ**: bài viết tiếng Việt (khớp `/vi/`), giữ nguyên thuật ngữ tiếng Anh
thông dụng (IELTS, Listening, cue card...). Lưu ý: app UI vẫn English-only —
blog là content marketing, không phải UI.

**Kiểu bài**: mỗi bài = 70% giá trị standalone (đọc được mà không cần app) +
30% thực hành bằng app. Bài chỉ PR không có giá trị riêng sẽ không rank và không
được share.

## 2. Cấu trúc URL (ĐÃ DUYỆT — chủ sở hữu chọn `/vi/blog/`)

```
dualdictionary.netlify.app/
├── (app EN — không đổi)
└── vi/
    ├── index.html                       → /vi/             (landing VN — NÂNG CẤP thành content hub VI)
    └── blog/
        ├── index.html                   → /vi/blog/        (hub: bài mới + 2 mảng)
        ├── ielts/
        │   ├── index.html               → /vi/blog/ielts/  (PILLAR: Lộ trình tự học IELTS)
        │   └── <slug>/index.html        → /vi/blog/ielts/<slug>/   (bài thường)
        ├── toeic/
        │   ├── index.html               → /vi/blog/toeic/  (PILLAR: Lộ trình tự học TOEIC)
        │   └── <slug>/index.html
        └── phuong-phap/                 (PHASE 2 — method/cluster chung)
            ├── index.html
            └── <slug>/index.html
```

**Quyết định & lý do:**

- **Đặt dưới `/vi/`** (quyết định owner 2026-09-26, ghi đè đề xuất `/blog/` ở
  root của DSH): toàn bộ content tiếng Việt gom về một khu `/vi/` — nhất quán với
  landing VI sẵn có, hreflang sạch (`en` = `/`, `vi` = `/vi/` và mọi thứ dưới
  `/vi/` là tiếng Việt, không cần cặp en cho blog).
- **Depth 4 cấp** (`/vi/blog/ielts/<slug>/`): chấp nhận — lợi ích cụm hoá topical
  authority + nhất quán ngôn ngữ quan trọng hơn độ sâu; Google xử lý tốt với
  internal linking rõ ràng.
- **Category index = pillar page** (không làm riêng trang category rỗng):
  `/vi/blog/ielts/` vừa là bài "Lộ trình tự học IELTS" dài vừa là list bài trong
  cụm — chuẩn model hub-and-spoke, tiết kiệm công cho blog tĩnh.
- **Folder + `index.html`** (URL có `/` cuối, không `.html`): khớp với `/vi/`
  hiện có, canonical sạch, về sau có gắn SSG cũng không đổi URL.
- **Quy tắc slug**: tiếng Việt **bỏ dấu** → ASCII, lowercase, nối bằng `-`,
  3–6 từ, chứa từ khóa chính, **không** nhét năm/ngày (bài evergreen, cập nhật
  bằng `dateModified`).

### 2.1 Vai trò trung tâm của `/vi/` (chỉ đạo owner 2026-09-26)

`/vi/` là **cửa ngõ duy nhất của kênh tiếng Việt** và là trang chuyển đổi của
toàn bộ funnel: blog bắt intent học tập → CTA về `/vi/` → cài PWA. Để `/vi/`
đáng vai trò đó (và tự rank query sản phẩm VI), Giai đoạn 0 sẽ **enrich landing**:

- Thêm 2 section content tiếng Việt thật (hiện chỉ có H1 + feature cards + 3
  bước + FAQ — quá mỏng cho vai trò hub): "Học IELTS & TOEIC với Dual
  Dictionary" (use case thật, trung thực) + link sang `/vi/blog/`.
- Giữ nguyên H1/meta/hreflang/JSON-LD hiện có; không thêm JS; giữ Lighthouse.
- Mọi bài blog CTA về `/vi/` (không phải `/`) — nội bộ: `/vi/` nhận toàn bộ
  internal link equity của kênh VI.

## 3. Bản đồ tính năng app → chủ đề PR

| Tính năng app (thật) | Use case học viên VN | Bài tiêu biểu |
|---|---|---|
| Từ điển Anh–Việt 386,600 entries, mở 1 click, offline | Tra từ không cần mạng, không quảng cáo | Luyện TOEIC/IELTS trên điện thoại không mạng |
| **Tra song song 2 từ điển** (Anh–Việt + Anh–Anh) | Chuyển cấp độ: hiểu nghĩa VI → đọc nghĩa EN | Từ điển Anh–Anh hay Anh–Việt khi học IELTS |
| Reader mode: dán bài đọc/Wikipedia/**YouTube transcript**, chạm từ để tra | Học từ trong ngữ cảnh thật | Luyện đọc IELTS; học qua YouTube |
| Reading pace (wpm, số từ) | Đo tốc độ đọc — yếu tố sống còn Part 7 TOEIC | Đọc nhanh TOEIC Part 7 |
| Save từ + câu gốc, notes, tags (Vault) | Vốn từ cá nhân hóa theo đề | Từ vựng theo chủ đề IELTS/TOEIC |
| **Review FSRS** spaced repetition | Học mà không quên — nỗi đau số 1 | Cách học từ vựng không quên (bài flagship) |
| Practice: fill-the-gap, listen & type, say it aloud | Tự kiểm tra đa kỹ năng | Luyện nghe + phát âm |
| Cue card Speaking (1' prep, 2' speak, speech readback) | **Đúng format IELTS Speaking Part 2** | Bài Speaking Part 2 (matching 1-1) |
| Journal + word count + **IELTS Task 2 timer** | Luyện viết đúng thời gian thi | Writing Task 2 |
| Listening: audio tự chọn + transcript sync | Nghe lại audio luyện tập có lời thoại | TOEIC Listening Part 3–4 |
| IPA + mic đọc to | Phát âm chuẩn để nghe tốt hơn | Bài phát âm IPA |
| Nhắc ôn opt-in (local-only) | Duy trì thói quen 20-30'/ngày | Ôn 30 phút mỗi ngày |
| Export CSV/TSV/**Anki-ready** | Người dùng Anki sẵn có | So sánh/RA với Anki |
| BYO .mdx/.mdd | Người có từ điển Lạc Việt... | (Phase 2, cẩn thận bản quyền — chỉ nói "app là reader, bạn tự đưa file") |

## 4. Content plan chi tiết

Quy ước cột: KW = từ khóa chính nhắm; Ct = mức cạnh tranh (Cao/Vừa/Thấp —
đánh giá định tính từ SERP, không có số volume chính xác).

### 4.1 Pillar IELTS — `/vi/blog/ielts/`

| # | Tiêu đề bài | KW chính | Ct | PR tính năng | Slug |
|---|---|---|---|---|---|
| P1 | Lộ trình tự học IELTS từ con số 0 (pillar) **— ĐÃ LIVE 2026-09-26** (`vi/blog/ielts/index.html`, ~2.100 từ, table 3 chặng, ảnh practice-cue-card.webp; link chéo 2 chiều với bài 1.1) | lộ trình tự học IELTS | Cao | Tổng quan app + CTA /vi/ | `(category index)` |
| 1 | Cách học từ vựng IELTS để không bao giờ quên **— ĐÃ LIVE** | cách học từ vựng IELTS | Vừa | Review FSRS (flagship) | `cach-hoc-tu-vung-ielts-khong-quen/` |
| 2 | Từ vựng IELTS theo 16 chủ đề hay gặp & cách tự học **— ĐÃ LIVE** | từ vựng IELTS theo chủ đề | Cao | Save từ + tags + FSRS | `tu-vung-ielts-theo-chu-de/` |
| 3 | IELTS Speaking Part 2: chiến lược làm bài cue card 1 phút **— ĐÃ LIVE** | IELTS Speaking part 2 | Vừa | Cue card (matching 1-1 với format thi) | `ielts-speaking-part-2-cue-card/` |
| 4 | Luyện đọc IELTS: đọc nhanh mà không cần biết hết từng từ **— ĐÃ LIVE** | luyện đọc IELTS | Cao | Reader tap-to-lookup + pace wpm | `luyen-doc-ielts-doc-nhanh/` |
| 5 | Học tiếng Anh qua YouTube: cách biến video thành bài học **— ĐÃ LIVE** | học tiếng anh qua youtube | Vừa | Reader + YouTube transcript | `hoc-tieng-anh-qua-youtube/` |
| 6 | IELTS Writing Task 2: luyện viết dưới áp lực thời gian **— ĐÃ LIVE** | IELTS Writing task 2 | Cao | Journal + Task 2 timer + word count | `ielts-writing-task-2-luyen-viet/` |
| 7 | Từ điển Anh–Anh hay Anh–Việt: nên dùng loại nào khi học IELTS **— ĐÃ LIVE** | từ điển anh anh hay anh việt | Thấp | **Tra song song 2 từ điển** (độc nhất) | `tu-dien-anh-anh-hay-anh-viet/` |
| 8 | Luyện phát âm IPA từ số 0: nền tảng cho Nghe & Nói **— ĐÃ LIVE** | luyện phát âm IPA | Vừa | IPA + say it aloud | `luyen-phat-am-ipa/` |
| 9 | IELTS Listening: nghe gì và luyện sao cho đúng cách **— ĐÃ LIVE** | luyện nghe IELTS | Cao | Listening + transcript sync, listen & type | `luyen-nghe-ielts/` |
| 10 | Collocations IELTS: cặp từ hay đi cùng nhau **— ĐÃ LIVE** | collocations IELTS | Vừa | Phrase search + save phrase | `collocations-ielts/` |
| 11 | Ôn IELTS 30 phút mỗi ngày: lịch cho người bận rộn **— ĐÃ LIVE** | ôn IELTS bao lâu | Thấp | PWA offline + nhắc ôn opt-in | `on-ielts-30-phut-moi-ngay/` |

### 4.2 Pillar TOEIC — `/vi/blog/toeic/`

| # | Tiêu đề bài | KW chính | Ct | PR tính năng | Slug |
|---|---|---|---|---|---|
| P2 | Lộ trình tự học TOEIC từ 0 lên 750+ (pillar) **— ĐÃ LIVE** | lộ trình học TOEIC | Cao | Tổng quan app + CTA /vi/ | `(category index)` |
| 1 | 600+ từ vựng TOEIC thường gặp & cách học không quên **— ĐÃ LIVE** | từ vựng TOEIC | Cao | List (standalone) + save + FSRS | `tu-vung-toeic-thuong-gap/` |
| 2 | Từ vựng TOEIC Part 5–6: mẹo từ loại & ngữ cảnh **— ĐÃ LIVE** | từ vựng TOEIC part 5 | Vừa | Ví dụ trong ngữ cảnh + notes | `tu-vung-toeic-part-5-6/` |
| 3 | TOEIC Listening Part 3–4: luyện nghe hội thoại hiệu quả **— ĐÃ LIVE** | TOEIC listening part 3 | Vừa | Listening + transcript sync + listen & type | `toeic-listening-part-3-4/` |
| 4 | TOEIC Part 7: làm sao đọc nhanh 400 từ/phút **— ĐÃ LIVE** | TOEIC part 7 luyện đọc | Vừa | Reading pace wpm + Reader | `toeic-part-7-doc-nhanh/` |
| 5 | Tiếng Anh thương mại: học từ qua email, báo cáo thật **— ĐÃ LIVE** | tiếng anh thương mại | Vừa | Reader dán bài + save theo ngữ cảnh | `tieng-anh-thuong-mai-email-bao-cao/` |
| 6 | Nghe không ra là do tai hay do không biết từ? **— ĐÃ LIVE** | nghe tiếng anh không ra | Thấp | IPA + listen & type (chẩn đoán) | `nghe-tieng-anh-khong-ra/` |
| 7 | Luyện TOEIC trên điện thoại, không cần mạng **— ĐÃ LIVE** | app học TOEIC offline | Thấp | PWA offline + từ điển offline 386k | `luyen-toeic-tren-dien-thoai-offline/` |
| 8 | Học TOEIC bằng flashcard: đúng cách và sai cách **— ĐÃ LIVE** | học từ vựng bằng flashcard | Vừa | FSRS + export Anki-ready (móc cộng đồng Anki VN) | `hoc-toeic-flashcard-anki/` |

### 4.3 Cluster "Phương pháp" — `/vi/blog/phuong-phap/` (PHASE 2, sau khi 2 pillar có ≥6 bài)

| Tiêu đề | KW chính | PR | Slug |
|---|---|---|---|
| Spaced repetition là gì? Vì sao học 100 lần vẫn quên **— ĐÃ LIVE** | spaced repetition là gì | Review FSRS | `spaced-repetition-la-gi/` |
| FSRS: thuật toán ôn tập thông minh hơn SM-2 cũ **— ĐÃ LIVE** | FSRS | Review FSRS + Stats retention | `fsrs-la-gi/` |
| Từ điển offline: tra từ khi không có mạng **— ĐÃ LIVE** | từ điển anh việt offline | Từ điển offline + PWA | `tu-dien-anh-viet-offline/` |
| Học từ vựng trong ngữ cảnh vs học từ đơn lẻ **— ĐÃ LIVE** | học từ vựng trong ngữ cảnh | Reader + Context | `hoc-tu-vung-trong-ngu-canh/` |

Cluster này là nơi thu backlink (bài method được share trong group Anki VN,
group tự học IELTS/TOEIC — đã thấy cộng đồng Anki VN hoạt động trên Facebook).

## 5. Nguyên tắc viết & PR app (khớp gu owner: tinh tế, opt-in)

1. **CTA đúng 1 khối/bài**, cuối bài, box "Thực hành ngay — miễn phí, offline,
   không cần tài khoản" + link `/vi/` (landing có hướng dẫn cài) hoặc nút mở
   app. Không chèn giữa bài làm gián đoạn; không stack nhiều nút.
2. **Bài phải đứng vững không cần app** (Google đánh giá nội dung, không phải
   quảng cáo). Quy tắc 70/30 ở mục 1.
3. **Trung thực tuyệt đối**: chỉ claim tính năng có thật; Offline-first,
   không thu phí, không tài khoản, không tracking là điểm cộng — nói đúng,
   không thổi. KHÔNG nhắc đến từ điển thương mại (Lạc Việt...) như tính năng —
   tối đa: "app hỗ trợ mở file .mdx bạn có quyền dùng" (quy tắc đã khóa).
4. **Ảnh minh họa** (quy tắc owner 2026-09-26): **ưu tiên ảnh chụp màn hình
   app thật** (capture qua `DSH/ui-check/ui-check.js`) — vừa trung thực vừa
   tăng E-E-A-T; chỉ khi cần thêm hình gợi cảm xúc/bìa thì dùng **stock free**
   (Unsplash/Pexels, ghi nguồn license trong alt hoặc caption). Không vẽ mockup
   sai UI.
5. **Dẫn nguồn uy tín** (quy tắc owner 2026-09-26): mỗi bài trích **2–4 nguồn
   authoritative** (British Council, IDP, Cambridge, ETS, Wikipedia EN...)
   đúng chỗ trong bài + mục "Nguồn tham khảo" cuối bài — tăng độ tin cậy với
   cả người đọc lẫn Google, và là cách bài method được cite lại (tạo backlink
   tự nhiên). Link nguồn phải là https, mở tab mới (`rel="noopener"`).
6. **Cập nhật**: mỗi bài ghi `datePublished` + `dateModified`; rà lại 6 tháng/
   lần các bài pillar.

### 5.1 Giọng văn & tác giả (chỉ đạo owner 2026-09-26 — áp cho MỌI bài)

- **Tác giả thật (E-E-A-T)**: Quốc Anh (Nguyễn Quốc Anh) — Senior Business
  Development, TMA; người khởi tạo Dual Dictionary (ban đầu cho đồng nghiệp
  luyện TOEIC), hiện cũng đang học IELTS. Mọi bài có author box + link LinkedIn
  `https://www.linkedin.com/in/quocanh38/` + JSON-LD `Person` khớp.
- **Giọng văn**: tiếng Việt trôi chảy như người thật viết, KHÔNG văn máy —
  không mở bài sáo rỗng ("trong thời đại..."), không liệt kê song song máy móc,
  cho phép tự trào nhẹ và chi tiết cuộc sống thật (ngành BD, đồng nghiệp kỹ sư,
  trải nghiệm học IELTS). Xưng "tôi", gọi "bạn". Ảnh chụp app là bằng chứng
  "viết bởi người làm app thật".
- **Chuẩn văn đã được owner xác nhận qua review bài đầu (2026-09-26) — ĐIỂM
  GIỮ và ĐIỂM TRÁNH cho mọi bài sau**:
  - GIỮ: giọng "tôi" nhất quán suốt bài; chêm tiếng Anh tự nhiên kiểu người
    làm việc song ngữ (business development, contingency, FSRS) — không lạm
    dụng; câu ngắn chốt ý tạo nhịp ("Ba lần. Cùng một từ.", "Công sức bỏ ra
    thật, kết quả giữ lại ảo."); thành ngữ/ẩn dụ đời thường (chiến trường,
    chết yểu, viên thuốc thần, đúc lại, móc để nhớ).
  - TRÁNH: **từ calque dịch từ tiếng Anh** — "trái tim của vấn đề" (heart of
    the matter) → dùng "mấu chốt/cốt lõi"; "điểm ngọt" (sweet spot) → "điểm
    cân bằng nằm ở giữa"; "chưa chắc hẳn" → "không chắc lắm".
  - TRÁNH: **cụm từ tạo đọc nhầm** — kiểm tra từ lặp cạnh nhau ("lấy từ từ
    danh sách" đọc thành "từ từ"); câu có 2 mệnh đề treo cùng một vị ngữ
    ("cụm đó bạn sẽ gặp... được đánh giá cao") phải tách rõ quan hệ nhân-quả
    ("nếu dùng X thì sẽ được Y").
  - KHÔNG nêu số tuổi chính xác của nhân vật — chỉ "ngoài ba mươi".
- Bài chuẩn mẫu: `vi/blog/ielts/cach-hoc-tu-vung-ielts-khong-quen/index.html`
  (kể cả author box + avatar chữ cái QA chờ thay ảnh thật).

## 6. Checklist kỹ thuật mỗi bài (brief cho AutoClaw)

- [ ] `<title>` ≤ 60 ký tự, chứa KW chính; meta description 140–160 ký tự, có CTA
- [ ] URL theo cấu trúc mục 2 (`/vi/blog/<category>/<slug>/`); canonical tuyệt
      đối có `/` cuối
- [ ] JSON-LD: `BlogPosting` (headline, datePublished, dateModified, image,
      author, `inLanguage: "vi"`) + `BreadcrumbList` (Blog › IELTS/TOEIC › bài)
- [ ] OG/Twitter card + ảnh share 1200×630 (capture UI thật)
- [ ] Ảnh bài viết: screenshot app trước tiên (ui-check capture, WebP, lazy
      load, alt mô tả thật); stock free (Unsplash/Pexels) chỉ bổ sung, ghi nguồn
- [ ] Internal links: 1 link lên pillar + 2–3 bài cùng cụm + 1 CTA `/vi/`
- [ ] Outbound: 2–4 nguồn uy tín (mục 5 quy tắc 5) + mục "Nguồn tham khảo"
- [ ] H2/H3 chứa biến thể KW tự nhiên; KHÔNG nhồi KW
- [ ] **Cập nhật `sitemap.xml` thêm URL bài mới ngay trong cùng brief** (quy
      tắc owner 2026-09-26) — sitemap valid XML sau khi sửa
- [ ] Khối FAQ dạng H2/Q-A cho người đọc (lưu ý: Google đã giới hạn FAQ rich
      snippet cho site chính phủ/y tế từ 2023 — làm cho người đọc, đừng kỳ vọng snippet)
- [ ] Mobile-first: bài chủ yếu đọc trên điện thoại (học viên VN)
- [ ] Performance: trang tĩnh nhẹ, không chặn render; ảnh nén WebP

## 7. Nhịp xuất bản & đo lường

- **Giai đoạn 0 (1 brief — ĐÃ XUẤT, chờ owner giao AutoClaw)**: blog scaffold
  (`/vi/blog/` hub + template bài chuẩn schema + CSS blog) **+ enrich `/vi/`
  thành content hub VI** (mục 2.1) + thêm `/vi/blog/` vào sitemap + **cách ly
  `/vi/` khỏi SW cache** (sw.js hiện cache-first mọi GET same-origin →
  blog/landing đã ghé sẽ stale + ăn quota app; fix = exclusion 1 dòng, xem
  brief).
- **Tháng 1**: 2 bài/tuần nếu giao AutoClaw (solo thì 1 bài/tuần) — ưu tiên
  thứ tự: P1 → bài 1.1, 1.3 (đứng nhất về matching tính năng) → P2 → 1.2, 1.4.
- **Tháng 2–3**: xong 2 pillar (mỗi bên ≥6 bài), bắt đầu cluster Phương pháp.
- **KPI theo quý** (GSC): % URL được index, impression/click theo cụm, traffic
  `/vi/` từ organic; không KPI vanity.
- **Kỳ vọng thực tế**: head term ("từ vựng IELTS") cạnh tranh với các trung
  tâm lớn có DR cao → thắng ở long-tail method + cụm part-specific trước,
  head term là cuộc chơi dài (6–12 tháng).

## 8. Phân công (đúng mô hình DSH plan + brief → AutoClaw execute)

1. ✅ Owner duyệt plan (2026-09-26): `/vi/blog/` + quy tắc nguồn/ảnh/sitemap
   + `/vi/` trung tâm.
2. ✅ DSH đã viết brief "Giai đoạn 0 — blog scaffold + /vi/ content hub":
   `work/briefs/2026-09-26-blog-scaffold-vi-central.md` → **owner dán vào
   AutoClaw**.
3. Sau nghiệm thu scaffold: mỗi 1–2 bài, DSH viết brief content riêng (dựa
   bảng mục 4) — **chờ chỉ đạo**, không tự sinh chuỗi brief.

## 9. Series "Hiểu tiếng Anh không cần dịch" (owner chốt 2026-09-26)

Series 7 bài, góc nhìn người đang học IELTS (ngôi "tôi", cảm nhận thật),
**KHÔNG nhắc DOL / Linearthinking / các trụ branding của họ** — nội hàm viết
lại bằng ngôn ngữ riêng, mô tả hành vi cụ thể (quy tắc: không dùng cụm tự đặt
mơ hồ, ví dụ thay bằng định nghĩa hành động + ví dụ câu).

| # | Bài | Trạng thái |
|---|-----|------------|
| 1 | Hiểu tiếng Anh không cần dịch (opener, câu chuyện dịch từng từ → hiểu trực tiếp) | LIVE (v84) |
| 2 | Reading: đọc một lần là hiểu | BUILT, chờ deploy |
| 3 | Listening: không đủ thời gian để dịch | BUILT, chờ deploy |
| 4 | Writing: dựng câu từ khung "chủ ngữ + động từ" (trụ pattern sống ở đây) | BUILT, chờ deploy |
| 5 | Speaking: phản xạ theo cụm | BUILT, chờ deploy |
| 6 | Sáu lỗi tiếng Việt gây sai (contrastive, nêu kỹ năng bị cản) | BUILT, chờ deploy |
| 7 | Lộ trình 4 tuần + checklist tự đo trước/sau | BUILT, chờ deploy |

**2026-09-26: cả 6 bài còn lại đã viết xong (owner order "viết hết series").**
Slugs: reading-hieu-mot-lan / listening-khong-kip-dich / writing-khung-cau /
speaking-phan-xa-cum / sau-loi-tieng-viet-gay-sai / lo-trinh-4-tuan-bo-dich.
Ảnh: bài 2 chụp mới reader-long-passage.webp (Reader đoạn dài, từ "exceeded");
bài 3-7 tái sử dụng kho có sẵn (listening-dialog, journal-task2,
practice-cue-card, ipa-entry, review-fsrs). 6 OG mới. Series-box tất cả bài
đã link chéo đủ 7. sitemap 36 URLs, phuong-phap index + hub cập nhật.
QA: scan PASS (3 title >70c — khớp chuẩn cluster cũ, chấp nhận), link-check
toàn site ALL OK (bắt + sửa 1 lần nữa lỗi slug lo-trinh-tu-hoc-ielts ở bài 7),
render-verify 9/9 trang 200. **CHƯA DEPLOY — chờ owner.**

- URL bài 1: `/vi/blog/phuong-phap/hieu-tieng-anh-khong-can-dich/`; ảnh:
  `images/hieu-tieng-anh-khong-can-dich/` (reader-touch-lookup.webp 1200×1000,
  og-1200x630.png). Đã cập nhật: sitemap (30 URLs), phuong-phap index, blog
  hub, blog.css (+ .series-box). Quét tự động PASS; render-verify local PASS.
- Quy tắc series (owner 2026-09-26): **mỗi bài có chức năng app giúp áp dụng
  thì chụp hình chức năng đó chèn tự nhiên** (bài Reading → Reader quét trục
  câu; bài Listening → Listening mode; bài review → thẻ ôn câu ngữ cảnh).
- Công cụ tái sử dụng: `DSH/ui-check/blog-shot-reader.js` (chụp Reader),
  `DSH/ui-check/verify-render-blog.js`, `DSH/ui-check/scan-blog.js` (NFC +
  cấm + cân bằng thẻ + meta + JSON-LD + ảnh). Node portable ở /tmp (tải lại
  nếu mất); Chrome headless CLI dùng cho OG card.
- Deploy chờ owner duyệt (quy tắc khóa).
