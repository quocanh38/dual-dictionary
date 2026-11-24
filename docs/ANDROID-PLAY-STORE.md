# Đóng gói HọcTA lên Google Play (TWA / Bubblewrap)

Tài liệu này hướng dẫn từng bước đóng gói PWA `https://hocta.app/` thành gói Android App Bundle (`.aab`) và APK để phát hành lên Google Play thông qua **Trusted Web Activity (TWA)**.

---

## 1. Những gì đã chuẩn bị sẵn trong repo (Bước 1 & Bước 2)

- [`manifest.webmanifest`](../manifest.webmanifest):
  - Có `id: "/"`, `display: "standalone"`, `orientation: "portrait"`, `categories`, `share_target`, `shortcuts` (*Tra nhanh*, *Ôn tập FSRS*, *Đọc & Tra*).
  - Icon `192x192` và `512x512` khai báo cả `purpose: "any"` và `purpose: "maskable"` (biểu tượng chữ **Z.** nằm trong vùng an toàn với lề >25% mỗi cạnh, không bị cắt khi Android bo tròn).
- [`/.well-known/assetlinks.json`](../.well-known/assetlinks.json):
  - Tệp xác thực Digital Asset Links giữa domain `hocta.app` và ứng dụng Android `vn.hocta.app`.
  - Đã cấu hình header `Content-Type: application/json; charset=utf-8` trong [`_headers`](../_headers).
- [`android-twa/`](../android-twa/):
  - Dự án Android TWA đã được khởi tạo sẵn bằng `@bubblewrap/core` với đầy đủ [`twa-manifest.json`](../android-twa/twa-manifest.json), [`AndroidManifest.xml`](../android-twa/app/src/main/AndroidManifest.xml), [`app/build.gradle`](../android-twa/app/build.gradle), bộ Adaptive Icons (`mipmap-anydpi-v26`), splash screen, `share_target` (`ACTION_SEND`) và 3 shortcuts.
  - **Tích hợp Native bổ sung:**
    - [`ProcessTextActivity.java`](../android-twa/app/src/main/java/app/hocta/twa/ProcessTextActivity.java): hiện mục **"Tra với HọcTA"** ngay trên thanh menu bôi đen chữ (`ACTION_PROCESS_TEXT`) ở mọi ứng dụng Android (Chrome, Kindle, PDF, Facebook…). Từ/cụm ngắn (≤5 từ) tự mở tra từ điển (`?q=...`), câu/đoạn dài tự mở thẳng trong Reader (`?read=...`).
    - [`QuickLookupWidgetProvider.java`](../android-twa/app/src/main/java/app/hocta/twa/QuickLookupWidgetProvider.java): **Widget màn hình chính** (*HọcTA — Tra nhanh*) gồm thanh tra nhanh 1 chạm + 3 nút mở thẳng *Đọc & Tra*, *Ôn FSRS*, *Luyện thi*.
- [`.gitignore`](../.gitignore):
  - Đã chặn `*.keystore`, `*.jks`, `android-twa/*.apk`, `android-twa/*.aab` để không vô tình đẩy khóa ký ứng dụng hay bản build lên Git công khai.

---

## 2. Tạo Keystore & Build gói Android (`.aab` / `.apk`)

Dự án [`android-twa/`](../android-twa/) đã có sẵn trong repo, bạn không cần chạy `bubblewrap init` lại nữa.

### Bước 2.1: Tạo khóa ký (`android.keystore`) ở máy local

Chạy lệnh sau trong thư mục `android-twa/` (lưu mật khẩu vào trình quản lý mật khẩu và sao lưu file `android.keystore` ra nơi an toàn):

```bash
cd android-twa
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias android \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=HocTA, OU=Education, O=HocTA, L=Hanoi, ST=HN, C=VN"
```

### Bước 2.2: Build ra `.aab` và `.apk`

```bash
cd android-twa
npx @bubblewrap/cli build
```

*(Hoặc mở trực tiếp thư mục `android-twa/` bằng **Android Studio** → chọn **Build → Generate Signed Bundle / APK**).*

Sau khi lệnh chạy xong, bạn sẽ có:
- `app-release-bundle.aab`: dùng để **upload lên Google Play Console**.
- `app-release-signed.apk`: dùng để cài thử trực tiếp lên điện thoại Android.

---

## 3. Cập nhật mã SHA-256 vào `.well-known/assetlinks.json`

Để ứng dụng chạy **toàn màn hình (ẩn thanh địa chỉ Chrome)**, domain `https://hocta.app/.well-known/assetlinks.json` phải chứa đúng vân tay SHA-256 của chứng chỉ ký app:

1. **Fingerprint của khóa upload local** (để test ngay file `.apk` trên máy):
   ```bash
   keytool -list -v -keystore android-twa/android.keystore -alias android | grep "SHA256:"
   ```
2. **Fingerprint của Google Play App Signing** (khi phát hành qua CH Play):
   - Vào **Google Play Console → Chọn app HọcTA → Test and release → Setup → App signing**.
   - Copy dòng **SHA-256 certificate fingerprint** ở mục *App signing key certificate*.
3. Dán cả 2 mã SHA-256 (local + Google Play) vào mảng `sha256_cert_fingerprints` trong [`.well-known/assetlinks.json`](../.well-known/assetlinks.json):
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "vn.hocta.app",
         "sha256_cert_fingerprints": [
           "AA:BB:CC:...:11:22",
           "33:44:55:...:88:99"
         ]
       }
     }
   ]
   ```
4. Commit và push lên `main` để GitHub Actions deploy lên `https://hocta.app/.well-known/assetlinks.json`.
5. Kiểm tra nhanh bằng lệnh:
   ```bash
   curl -i https://hocta.app/.well-known/assetlinks.json
   ```

---

## 4. Thông tin khai báo trên Google Play Console

- **Privacy Policy URL:** `https://hocta.app/vi/du-lieu-trai-nghiem/`
- **App Category:** Education (Giáo dục)
- **Tags gợi ý:** Dictionary, Language Learning, English, TOEIC, IELTS
- **Target Audience:** 13+ (Học sinh THCS/THPT, sinh viên, người đi làm)
- **Quảng cáo (Ads):** Chọn **No** (Ứng dụng không chứa quảng cáo).

---

## 5. Bộ nội dung Store Listing (Copy–Paste lên Google Play Console)

### 5.1. Đồ họa (Graphic Assets)

- **App Icon (512×512 PNG, 32-bit):** Dùng sẵn file [`android-twa/store_icon.png`](../android-twa/store_icon.png) hoặc [`icons/icon-512.png`](../icons/icon-512.png).
- **Feature Graphic (1024×500 PNG, không alpha):** Đã tạo sẵn tại [`android-twa/feature-graphic-1024x500.png`](../android-twa/feature-graphic-1024x500.png).

### 5.2. Bản Tiếng Việt (`vi-VN` — Ngôn ngữ mặc định, đã tối ưu ASO)

- **Tên ứng dụng (App name — tối đa 30 ký tự):** *(24/30 ký tự)*
  ```text
  HọcTA - Từ điển Anh Việt
  ```
  *(Khớp trực tiếp từ khóa tìm kiếm lớn nhất "từ điển anh việt"; tùy chọn thay thế đánh rộng hơn: `HọcTA: Từ điển & Học tiếng Anh` — 30/30 ký tự)*

- **Mô tả ngắn (Short description — tối đa 80 ký tự):** *(78/80 ký tự)*
  ```text
  Học tiếng Anh offline: tra từ trong bài đọc, học từ vựng & luyện TOEIC, IELTS.
  ```

- **Mô tả đầy đủ (Full description — tối đa 4.000 ký tự):** *(~2.750/4.000 ký tự)*
  ```text
  HọcTA (hocta.app) là ứng dụng từ điển Anh Việt offline và học tiếng Anh toàn diện dành cho người Việt: đọc tài liệu thật, chạm vào bất kỳ từ nào để tra nghĩa trong ngữ cảnh, lưu cả câu gốc thành flashcard và ôn từ vựng dài hạn bằng thuật toán lặp lại ngắt quãng FSRS.

  Không cần đăng ký tài khoản. Không quảng cáo làm phiền. Sau khi tải bộ từ điển và gói bài học về máy, toàn bộ tính năng học tiếng Anh cốt lõi đều chạy mượt ngay cả khi mất mạng hoặc bật chế độ máy bay.

  TÍNH NĂNG NỔI BẬT

  1. Từ điển Anh Việt offline & Từ điển Anh–Anh (.MDX / .MDD)
  • Tải nhanh từ điển Anh–Việt mở (~386.600 mục từ, gồm cả dạng chia động từ/số nhiều) và từ điển Anh–Anh (WordNet 3.1, Simple English) chỉ với 1 chạm.
  • Hỗ trợ nạp thêm tệp từ điển .mdx / .mdd cá nhân của riêng bạn ngay trên điện thoại.
  • Đầy đủ phiên âm IPA Anh–Mỹ / Anh–Anh, phát âm audio, nhãn tần suất từ vựng (Top 1K / 2K / 5K / 10K) và tự động tìm từ gốc khi tra động từ chia hoặc danh từ số nhiều.

  2. Tra nhanh ở mọi ứng dụng & Widget màn hình chính
  • Bôi đen bất kỳ từ hoặc đoạn văn tiếng Anh nào trên Chrome, PDF, Kindle, Facebook… rồi chọn "Tra với HọcTA" ngay trên thanh công cụ để tra từ điển hoặc mở thẳng trong trình đọc.
  • Đặt Widget "HọcTA — Tra nhanh" ngoài màn hình chính Android để mở tra từ 1 chạm hoặc vào thẳng Reader, Ôn tập FSRS, Luyện thi.

  3. Đọc tiếng Anh chạm để tra trong ngữ cảnh (Reader)
  • Dán bài báo, mở sách điện tử EPUB, tài liệu PDF hoặc lời thoại YouTube để đọc trực tiếp với bố cục sạch, dễ nhìn.
  • Chạm vào bất kỳ từ hay cụm từ nào để xem nghĩa song ngữ ngay bên dưới mà không bị đứt mạch đọc.
  • Lưu từ vựng tiếng Anh kèm nguyên văn câu gốc và nguồn đọc vào Sổ tay (Vault) chỉ với 1 chạm.

  4. Học từ vựng bằng Flashcard & Ôn tập ngắt quãng FSRS
  • Thuật toán FSRS-4.5 (Free Spaced Repetition Scheduler) tự động tính toán thời điểm tối ưu để nhắc bạn ôn từ trước khi quên.
  • Đa dạng bài tập 30 giây: lật flashcard, trắc nghiệm ngữ cảnh, điền từ vào câu gốc (Cloze), nghe chép chính tả và luyện phát âm qua mic.
  • Nhập/xuất dữ liệu hai chiều với Anki (.txt / .csv / .tsv) và sao lưu mã hóa đầu cuối (.ddbackup AES-256-GCM).

  5. Luyện thi TOEIC & IELTS offline (Exam Lab)
  • Luyện TOEIC Part 5–6 và 12 tình huống công sở (họp hành, email, giao hàng, tuyển dụng…), tự động lưu câu làm sai vào Sổ tay để ôn lại.
  • Bộ bài chẩn đoán trình độ IELTS 4 kỹ năng, lộ trình theo band (5.0 → 6.5 → 7.0), đồng hồ bấm giờ Writing Task 1/2 và thẻ Speaking Part 2 Cue Card.

  6. 33 gói bài học tiếng Anh song ngữ Offline (Lesson Studio)
  • Thư viện 33 bài đọc tiếng Anh công việc và học thuật (trình độ B1–B2) đã được biên tập sẵn: đọc hiểu theo từng câu, cụm từ trọng tâm và bài tập thực hành không cần mạng.

  7. Tùy chọn AI Tutor minh bạch (Gemini API cá nhân)
  • Gắn khóa Gemini API của riêng bạn nếu muốn chấm chữa bài viết, giải thích sâu đáp án TOEIC hoặc hỏi đáp ngữ cảnh. Khóa chỉ lưu trên thiết bị và luôn hỏi xác nhận trước mỗi lượt gửi.

  VÌ SAO CHỌN HỌCTA?
  • 100% quyền làm chủ dữ liệu: từ điển, sổ tay từ vựng và tiến độ ôn tập nằm gọn trên máy của bạn.
  • Nhẹ, nhanh, tiết kiệm pin và dung lượng 4G.
  • Miễn phí và hoàn toàn không quảng cáo.

  Tìm hiểu thêm tại: https://hocta.app/vi/
  ```

---

### 5.3. Bản Tiếng Anh (`en-US` — Tối ưu ASO tìm kiếm quốc tế)

- **App name (30 chars max):** *(29/30 chars)*
  ```text
  HọcTA: EN-VI Dictionary & SRS
  ```
- **Short description (80 chars max):** *(78/80 chars)*
  ```text
  Offline English-Vietnamese & MDX dictionary, tap reader, flashcards, TOEIC lab
  ```
- **Full description:**
  ```text
  HọcTA (hocta.app) is an offline-first English–Vietnamese dictionary and bilingual English learning app. Look up English words in context, read EPUB/PDF documents with one-tap lookup, save words with their original sentences as flashcards, and retain vocabulary long-term with FSRS-4.5 spaced repetition.

  Key Features:
  • Offline EN–VI & MDX/MDD Dictionary: One-click offline English–Vietnamese (386,600+ entries) and English–English dictionaries with US/UK IPA pronunciation, plus support for your own .mdx/.mdd files.
  • Look Up Anywhere & Home Screen Widget: Highlight any English word or paragraph in Chrome, PDF, or Kindle and tap "Tra với HọcTA" to look it up instantly. Add the Home Screen Widget for one-tap search and study shortcuts.
  • Tap-to-Lookup Context Reader: Open EPUBs, PDFs, YouTube transcripts, or pasted articles. Tap any word to view bilingual definitions and save the exact source sentence.
  • Smart Flashcards (FSRS) & Anki Sync: Review vocabulary with cloze, dictation, recall, and speaking drills. Full CSV/Anki import & export and AES-256-GCM encrypted backups.
  • Offline TOEIC & IELTS Exam Lab: Workplace TOEIC drills, 4-skill IELTS diagnostics, Writing Task 2 timer, and Speaking Part 2 cue cards.
  • 33 Offline Bilingual Lesson Packs: Curated B1–B2 workplace and academic reading lessons ready for airplane mode.
  • Privacy-First, No Account, No Ads: All dictionaries and study data stay on your device. Optional AI Tutor uses your own Gemini API key with explicit per-request consent.
  ```

---

### 5.4. Bộ 6 ảnh chụp màn hình điện thoại (`1080×1920` PNG — Đã tạo sẵn trong repo)

Toàn bộ 6 ảnh chụp màn hình tỷ lệ chuẩn `9:16` (`1080×1920` px) đã được chụp trực tiếp từ ứng dụng và lưu sẵn tại thư mục [`android-twa/screenshots/`](../android-twa/screenshots/) để bạn kéo-thả thẳng vào mục **Phone screenshots** trên Google Play Console:

1. [`android-twa/screenshots/01-tra-tu-song-ngu.png`](../android-twa/screenshots/01-tra-tu-song-ngu.png) — **Tra từ song ngữ Anh–Việt & IPA khẩu hình:** Trang từ `affect` với phiên âm IPA Mỹ/Anh, nút phát âm, sơ đồ khẩu hình 10 nguyên âm và nhãn tần suất *Top 5K / NGSL / AWL / IELTS Core*.
2. [`android-twa/screenshots/02-reader-cham-de-tra.png`](../android-twa/screenshots/02-reader-cham-de-tra.png) — **Đọc tiếng Anh & tra từ trong ngữ cảnh (Reader):** Tình huống công việc thực tế (*Đổi lịch giao hàng*), giải thích nghĩa theo ngữ cảnh email và câu mẫu song ngữ.
3. [`android-twa/screenshots/03-on-tap-fsrs.png`](../android-twa/screenshots/03-on-tap-fsrs.png) — **Ôn tập ngắt quãng FSRS-4.5:** Thẻ ôn từ `schedule` kèm câu gốc đã lưu (*"When shifts change, staff review the schedule..."*), nghĩa từ điển Anh–Việt OVDP, ghi chú collocation và các nút chấm mức độ nhớ (*Biết / Quên / Bỏ qua*).
4. [`android-twa/screenshots/04-luyen-thi-toeic.png`](../android-twa/screenshots/04-luyen-thi-toeic.png) — **Luyện thi TOEIC theo 12 tình huống công sở:** 161 cụm TOEIC Business chia theo Họp hành, Thư tín & Email, Văn phòng, Tuyển dụng & Nhân sự.
5. [`android-twa/screenshots/05-goi-bai-hoc-offline.png`](../android-twa/screenshots/05-goi-bai-hoc-offline.png) — **Thư viện 33 gói bài học Offline (Lesson Studio):** Các bài đọc tiếng Anh công việc & học thuật B1–B2 (*Checking Deliveries and Contacting Suppliers*) học ngay không cần mạng.
6. [`android-twa/screenshots/06-phan-biet-ngu-canh.png`](../android-twa/screenshots/06-phan-biet-ngu-canh.png) — **Phân biệt từ dễ nhầm & câu mẫu:** Bảng so sánh nhanh `affect` vs `effect` kèm tóm tắt 1 dòng, phiên âm, loại từ và ví dụ đúng.

---

## 6. Bảng trả lời nhanh biểu mẫu Google Play Console (Data Safety & Content Rating)

| Mục trên Play Console | Câu trả lời chuẩn cho HọcTA |
|---|---|
| **Does your app collect or share any of the required user data types?** | Nếu người dùng **không** bật chia sẻ tín hiệu trải nghiệm: không thu thập gì cả. Vì app có tùy chọn *opt-in* gửi tín hiệu trải nghiệm/góp ý ẩn danh, bạn có thể chọn **Yes** → chỉ tích mục **App info and performance → Diagnostics** và/hoặc **App interactions** (Optional, user can opt-out, encrypted in transit, not shared with third parties). |
| **Account creation / Delete account URL** | Chọn **No** (Ứng dụng không có tài khoản người dùng; mọi dữ liệu học lưu cục bộ trên máy). |
| **Ads declaration** | **No, my app does not contain ads**. |
| **Content Rating (IARC)** | Chọn danh mục **Reference, News, or Educational** → trả lời **No** cho toàn bộ câu hỏi về bạo lực, ngôn từ, nội dung người lớn, mua bán, chia sẻ vị trí → sẽ nhận nhãn **Rated for 3+ (Everyone)** tự động. |
| **Government Apps / Financial Features / Health** | Chọn **No / None** cho tất cả. |

