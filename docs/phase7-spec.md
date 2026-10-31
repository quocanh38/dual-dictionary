# Phase 7 — P1: YouTube subtitle → Reader (spec)

> Duyệt: 2026-09-25 (owner chọn hướng 7/8/9). Release: **v72**, sw `mdx-dict-v79`.
> Nguyên tắc khóa giữ nguyên: **không server, không tracking, không đụng DRM,
> KHÔNG phát video trong app** — Reader chỉ nhận **chữ**.

## 1. Sự thật kỹ thuật quyết định thiết kế (đọc trước)

Ý tưởng gốc "dán link → tự lấy caption" **không khả thi client-side thuần**:
YouTube không trả CORS header cho HTML watch page hay `timedtext` API, nên
`fetch` từ browser luôn bị chặn — đây là luật bảo mật của browser, không phải
bug. Các đường đi khả dĩ và quyết định:

| Đường | Đánh giá | Quyết định |
|---|---|---|
| CORS proxy của bên thứ 3 | Proxy thấy toàn bộ video user xem → vi phạm no-tracking; độ tin cậy thấp | **Loại** |
| Embed player + đọc caption qua API player | Cần iframe YouTube (third-party JS, tracking) — ngược DNA | **Loại** |
| Browser extension (kiểu Language Reactor) | Ngoài phạm vi web app | Không làm |
| **Dán transcript từ chính YouTube** ("Show transcript" → copy) | 0 network call, luôn chạy được, kể cả video không có caption (dán từ nguồn khác) | **v1 — làm ngay** |
| BYO Invidious/Piped instance (user tự điền URL instance có CORS) | OK về DNA (tự mang như BYO dictionary) nhưng độ tin cậy phụ thuộc instance | **Phase 2 — optional, không chặn v1** |

## 2. Phạm vi v1

- Reader có thêm nút **🎬 YouTube transcript** → dialog: link video (tùy chọn,
  chỉ dùng làm nhãn nguồn) + ô dán transcript + nút Read.
- Parser thuần `parseTranscript(raw)` tự nhận diện 3 định dạng:
  1. **YouTube transcript copy** — dòng timestamp trần `m:ss` / `h:mm:ss` xen
     giữa các dòng chữ (≥3 dòng timestamp mới coi là định dạng này);
  2. **SRT/VTT** — có dòng chứa `-->` (bỏ WEBVTT/NOTE/số thứ tự/timestamp);
  3. **Plain text** — đưa qua nguyên vẹn.
- Làm sạch: gộp cue thành câu/đoạn (đoạn mới khi cue kết thúc bằng câu + đoạn
  đã ≥40 từ, hoặc đoạn ≥80 từ); **bỏ timestamp** khỏi văn bản đọc (giữ trong
  dữ liệu là việc của phase sau, không có video sync trong v1); lọc cue trùng
  liền kề (auto-caption đôi khi copy bị nhân đôi).
- Dán nhầm YouTube transcript vào textarea chính rồi bấm Start reading cũng
  được parse tự động (không hiện rác timestamp).
- Sau parse: text sạch đặt lại vào textarea (user sửa được), render qua
  `readerRender(text, 'youtube: <link>', link)` → **tap-to-lookup, Save
  sentence, Save offline hoạt động ngay** (tận dụng nguyên đường Reader);
  link video đi vào `#reader-url` để snapshot lưu kèm nguồn.
- Non-goals v1: phát/nhúng video, đồng bộ thời gian, tự lấy caption, dịch.

## 3. Test

- `yt-transcript-smoke.js` (UI-driven, theo pattern suite hiện có): dán
  YouTube-format → đọc → không còn timestamp, số từ khớp, tap-tra chạy; SRT →
  ok; plain → đưa qua nguyên vẹn; textarea chính dán YouTube-format → Start
  reading vẫn sạch; snapshot save giữ link nguồn.
- Battery đầy đủ trước deploy; Help (EN+VI) + About + JSON-LD featureList
  cập nhật theo chỉ đạo thường trực.
