# Đóng gói HọcTA lên Google Play (TWA / Bubblewrap)

Tài liệu này hướng dẫn từng bước đóng gói PWA `https://hocta.app/` thành gói Android App Bundle (`.aab`) và APK để phát hành lên Google Play thông qua **Trusted Web Activity (TWA)**.

---

## 1. Những gì đã chuẩn bị sẵn trong repo (Bước 1 & Bước 2)

- [`manifest.webmanifest`](../manifest.webmanifest):
  - Có `id: "/"`, `display: "standalone"`, `orientation: "portrait"`, `categories`, `share_target`, `shortcuts` (*Tra nhanh*, *Ôn tập FSRS*, *Đọc & Tra*).
  - Icon `192x192` và `512x512` khai báo cả `purpose: "any"` và `purpose: "maskable"` (biểu tượng chữ **Z.** nằm trong vùng an toàn với lề >25% mỗi cạnh, không bị cắt khi Android bo tròn).
- [`/.well-known/assetlinks.json`](../.well-known/assetlinks.json):
  - Tệp xác thực Digital Asset Links giữa domain `hocta.app` và ứng dụng Android `app.hocta.twa`.
  - Đã cấu hình header `Content-Type: application/json; charset=utf-8` trong [`_headers`](../_headers).
- [`android-twa/`](../android-twa/):
  - Dự án Android TWA đã được khởi tạo sẵn bằng `@bubblewrap/core` với đầy đủ [`twa-manifest.json`](../android-twa/twa-manifest.json), [`AndroidManifest.xml`](../android-twa/app/src/main/AndroidManifest.xml), [`app/build.gradle`](../android-twa/app/build.gradle), bộ Adaptive Icons (`mipmap-anydpi-v26`), splash screen, `share_target` (`ACTION_SEND`) và 3 shortcuts.
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
         "package_name": "app.hocta.twa",
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
- **Data Safety (An toàn dữ liệu):**
  - Không yêu cầu tạo tài khoản; từ điển, sổ tay từ vựng và tiến độ FSRS lưu cục bộ trên thiết bị.
  - Tính năng AI Tutor / Gemini là tùy chọn (người dùng tự nhập API key và xác nhận từng lượt gửi).
  - Tín hiệu trải nghiệm ẩn danh chỉ gửi khi người dùng chủ động đồng ý (có thể tắt bất cứ lúc nào).
- **Quảng cáo (Ads):** Chọn **No** (Ứng dụng không chứa quảng cáo).
