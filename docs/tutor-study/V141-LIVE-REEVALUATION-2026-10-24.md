# v141 — deploy và đánh giá lại Meta thật

Ngày 24/10/2026. App: https://dualdictionary.netlify.app

## Bản đã kiểm tra

- Deploy `6adcb8b6e0d1eb6090ca3699`, source `2dfaa2314bf886fc3c07c42961a3fc2e3326e345`.
- Published 20:55:28 giờ Việt Nam; cache `mdx-dict-v117`.
- Health: HTTP 7/7 URL ×3; Chrome 7/7 trang không lỗi JavaScript; 18.617/18.617 file live khớp source, không mất file hoặc drift. Module prompt production được so byte với source.
- Model/provider: Meta Model API / muse-spark-1.3, cấu hình sẵn có trong Chrome. Không đọc/xuất key; tất cả đầu vào mới là dữ liệu tự soạn.

## Bốn ca diagnostic có cùng đầu vào với lượt trước

Prompt đã đổi; app và evaluator nay dùng chung prompt phản hồi và validator. Đây là so sánh mô tả giữa hai lượt nhỏ, không phải A/B ngẫu nhiên hoặc bằng chứng nhân quả.

| Ca | Verdict mới | Quote đạt yêu cầu | Độ trễ mới |
|---|---|---|---|
| natural-use | correct | Có | 7.550s |
| incorrect-use | incorrect | Có | 8.188s |
| off-topic | incorrect | Có | 7.426s |
| missing-required-phrase | incorrect | Có | 6.368s |

- Verdict phù hợp: **4/4 → 4/4**.
- Quote đạt yêu cầu: **3/4 → 4/4**. Ca lạc đề lần này có quote chính xác, không bỏ trống.
- API/format errors: **0/4** trong lượt mới.
- Độ trễ riêng bốn ca mới: **6.368–8.188s**, median **7.488s**; lượt trước median 9.3585s. Không suy ra độ trễ dưới tải hoặc ưu thế ổn định từ bốn mẫu.
- Điểm liên quan do Codex ghi trên UI: 5, 4, 5, 5. Đây không phải chấm độc lập. Ca ngữ pháp vẫn gợi ý “I do careful practice...”, hiểu được nhưng chưa phải mẫu diễn đạt trôi chảy tốt nhất; không che hạn chế này sau số verdict pass.

## Kiểm chứng ba sửa đổi trong app live

**1. Nghĩa tiếng Việt tách đúng khỏi lý do chọn cụm.** Meta trả và UI hiển thị:

- carry out research → **tiến hành nghiên cứu**.
- Careful practice → **sự luyện tập cẩn thận**.
- collect examples → **thu thập các ví dụ**.

Lý do chọn cụm hiển thị riêng dưới “Why suggested”. Câu nguồn vẫn đúng với bài đọc. Xem ảnh v141-meta-meanings.png.

**2. Chính sách quote.** Ca sai “will carries out research” được quote đúng và sửa thành “will carry out research”. Bốn ca diagnostic mới đều tuân thủ quote. Trong lượt mới, model không trả incorrect thiếu quote nên chưa quan sát nhánh downgrade trên một phản hồi Meta mới; nhánh này đã qua test validator/handler và browser mock, không được diễn đạt thành bằng chứng live mà chưa xảy ra.

**3. Tình huống mới thực sự đổi bối cảnh.** Cùng cụm carry out research, ba lần tạo đề cho kết quả:

| contextId | Tình huống Meta tạo |
|---|---|
| study | Sinh viên trao đổi với cố vấn về dự án học từ vựng. |
| workplace | Trợ lý sản phẩm trình bày với khách hàng kế hoạch nghiên cứu người mua bình nước thân thiện môi trường. |
| community | Tình nguyện viên giải thích cho cư dân kế hoạch vườn cộng đồng: đất, nước và loại rau muốn trồng. |

Hai lần “Try another situation” đều mở consent mới; payload có meaningVi, câu nguồn và đề trước, không có câu trả lời cũ. Hai đề mới đổi vai trò, người nghe và mục đích, không chỉ yêu cầu viết lại câu cũ. ContextId của kết quả đã được validator chấp nhận.

Phản hồi production: câu sai ngữ pháp được sửa đúng; câu đúng dạng bị động trong bối cảnh sản phẩm được công nhận; câu đúng về vườn cộng đồng cũng được công nhận, kèm quote chính xác. Ba phản hồi app phù hợp với kỳ vọng. Sau đó thẻ carry out research được lưu vào Vault với định nghĩa “tiến hành nghiên cứu” và câu nguồn; reload rồi tìm lại vẫn hiển thị đúng nghĩa. Một thẻ thử bằng văn bản tự soạn được giữ trong Vault; không chấm FSRS cho thẻ trong lượt kiểm tra.

## Bằng chứng và giới hạn

- `v141-meta-evaluation.json`: JSON xuất từ evaluator sau deploy, có rawVerdict, evidenceStatus, quote và latency.
- `v141-meta-app-evidence.json`: các trạng thái UI đã quan sát, gồm payload consent và kết quả app.
- Ảnh: `v141-meta-diagnostic.png`, `v141-meta-meanings.png`, `v141-meta-workplace.png`, `v141-meta-community.png` và `v141-vault-meaning-reloaded.png`.
- 7 ca phản hồi (4 diagnostic + 3 app), cùng 1 lần trích cụm + 3 lần tạo tình huống = **11 yêu cầu Meta thật**, không có lỗi API/định dạng quan sát được trong lượt này; đếm theo thao tác, không phải billing log. Không đo token/chi phí hoặc latency riêng của app.
- Mẫu nhỏ, hai cụm chính, một model, chưa có giáo viên chấm mù hay người học thật/nhớ lại sau 24 giờ. Chưa đủ xác nhận chất lượng AI tổng quát hoặc hiệu quả học tập.
