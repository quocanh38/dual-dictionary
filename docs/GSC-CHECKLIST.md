# Đo lường SEO — GSC checklist (02/11/2026)

Site: https://dualdictionary.netlify.app — 11.445 trang, sitemap tiered (6 T1 / 4 T2 / 7 T3).

## Gắn GSC (làm 1 lần, trên máy nào cũng được)
1. Vào https://search.google.com/search-console → Add property → URL prefix `https://dualdictionary.netlify.app`
2. Lấy token → mở `index.html`, thay `PASTE_GSC_TOKEN_HERE` ở dòng ~22 → commit + deploy
3. Submit sitemap `https://dualdictionary.netlify.app/sitemap.xml` trong mục Sitemaps

## Theo dõi hàng tuần (2-4 tuần đầu sau mỗi đợt deploy lớn)
- [ ] Coverage: số trang Valid tăng? Exclude có gì lạ (404, Duplicate, Crawled-not-indexed)?
- [ ] Sitemap Tier 1 (collections/topics/compare/mistakes/prepositions/cambridge) đã index hết chưa?
- [ ] Performance → Queries: query nào impression cao (>100) mà CTR < 2%? → sửa title/meta trang đó
- [ ] Pages: trang nào impression cao mà vị trí > 10? → bổ sung TL;DR / internal link về nó
- [ ] Discover: không áp dụng (site tra cứu, không tin tức)

## Ngưỡng hành động (đừng đoán, nhìn số)
- Query impression > 500, CTR < 1.5% → viết lại title + meta description
- Trang Tier 1 sau 3 tuần chưa index → kiểm tra internal link trỏ về nó + Fetch as Google
- Cụm query "X đi với giới từ gì" có impression → ưu tiên mở rộng cụm đó (việc 2 còn 35 slot tới 100)
- Chủ đề IELTS nào impression tốt → mở rộng hub đó lên 150 từ (việc 1 còn slot)
- KHÔNG thêm nội dung mới cho tới khi Tier 1 index > 80%
