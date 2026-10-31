# Checklist test máy thật — Dual Dictionary

> Soạn 2026-09-25 (kèm đợt v70). Mọi đo đạc geometry/PWA đến nay đều chạy headless
> Chrome trên macOS — danh sách này là phần chỉ **máy thật** trả lời được.
> Test trên bản live `https://dualdictionary.netlify.app` (hoặc bản v70+ sau deploy).
> Ghi kết quả thẳng vào ô KQ; chụp màn hình khi thấy lỗi layout.

## 1. iPhone — Safari (ưu tiên cao nhất)

Chuẩn bị: iPhone thật, Safari thường (không dùng Private), xoá dữ liệu trang
(Settings → Safari → Advanced → Website Data → dualdictionary.netlify.app → xoá)
để chạy lại đúng luồng lần đầu.

| # | Việc test | Cách làm | Kỳ vọng | KQ |
|---|-----------|----------|----------|----|
| 1.1 | Luồng lần đầu | Mở URL, để nó probe + hiện thẻ download | Thẻ hiện size thật (≈ 12.7 MB, không phải "size unknown"), nút Start bật sau khi probe | |
| 1.2 | Bottom inset (safe-area) | Sau khi load xong, cuộn tới đáy panel từ điển; kiểm tra bottom-nav và chữ cuối panel | Không có chữ/nút nào bị thanh home bar (home indicator) che; bottom-nav cách đáy đúng `safe-area-inset-bottom` | |
| 1.3 | Geometry panel | Tra 1 từ dài (vd. "establish"), cả 2 panel | Header panel, IPA strip, nút 🔊 không chồng lấn; không có panel tràn ngang (không phải cuộn ngang) | |
| 1.4 | Reader (EPUB/PDF) | Mở Reader → nạp 1 file → đọc, cuộn | Thanh công cụ reader không bị keyboard/URL bar Safari che; font-size scaling không vỡ layout | |
| 1.5 | PWA install | Share → Add to Home Screen → mở từ icon | Mở standalone (không có thanh URL Safari); icon không trắng; state icon mở = state web đã nạp (từ điển còn đó — IDB riêng theo origin, vẫn còn) | |
| 1.6 | PWA offline | Máy bay → mở PWA từ icon | App mở, tra từ OK (đã nạp); lần đầu chưa nạp thì thẻ download hiện đúng thông báo offline | |
| 1.7 | Nhắc ôn (R2) | Bật reminders trong ⚙, tắt Safari, chờ tới giờ nhắc | iOS Safari thường **không** gửi notification khi trang đóng — chỉ kiểm tra banner trong app khi mở lại có đúng "đến giờ ôn" | |
| 1.8 | Luyện phát âm (R4) | Tra 1 từ → nút 🎤 Say it → nói | iOS 14.5+: Safari dùng engine Apple (webkitSpeechRecognition có thể cần "Siri & Search → bật"); nút ẩn gọn nếu không hỗ trợ, không lỗi JS | |

## 2. Android — Chrome PWA (ưu tiên 2)

| # | Việc test | Cách làm | Kỳ vọng | KQ |
|---|-----------|----------|----------|----|
| 2.1 | PWA install | Mở URL → menu Chrome → Install app (hoặc banner) | Cài được lên home screen; mở standalone | |
| 2.2 | Notification khi đóng app (R2 — quan trọng nhất) | Bật reminders, cấp quyền notification, **đóng hẳn app (swipe away)**, chờ tới giờ nhắc | Notification tới nhờ service worker + push/scheduled qua SW — đây là mục chỉ Android verify được; ghi rõ có/không + thời gian trễ | |
| 2.3 | Luyện phát âm (R4) | Tra từ → 🎤 Say it | Chrome Android dùng engine Google; kết quả khớp từ vừa nói | |
| 2.4 | Bottom inset | Sau khi cài PWA, kiểm tra đáy panel + bottom-nav trên máy có gesture bar | Không bị gesture bar che | |

## 3. Cả hai máy — smoke ngắn (5 phút)

- [ ] Tra 5 từ bất kỳ → panel đôi hiện đủ, không entry trắng.
- [ ] Lưu 1 từ vào Vault → mở lại app → còn (persist IDB hoạt động).
- [ ] Practice 1 vòng (flashcard + say it) → không crash.
- [ ] Mạng yếu (máy bay 30s rồi bật lại) → app không chết, badge/lỗi hiện đúng.

## Ghi chú cho DSH

- Nếu 1.2/2.4 lệch: so sánh `--safe-b` / env(safe-area-inset-bottom) trong
  `css/style.css` — geometry hiện chỉ đo được bằng ảnh chụp máy thật, không đo
  headless được.
- Nếu 2.2 notification không tới khi đóng app: ghi lại device + Android version +
  Chrome version — R2 dùng cơ chế nào (SW showNotification qua periodic/trigger)
  sẽ quyết định có phải chuyển hướng implement hay không.
