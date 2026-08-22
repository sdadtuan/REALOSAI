# Talkwalker vs Brandwatch — bake-off scorecard (P23)

> **Phase:** P23 · RES-UC-084  
> **Ngày:** 2026-08-16  
> **Thang điểm:** 10 tiêu chí × 10 = 100. Ô điểm **để trống** — PO chấm sau trial. Không bịa số.

Stub bake-off only. P23 không gọi HTTP vendor, không mua key, không bật flag/token prod.

| # | Tiêu chí | Talkwalker (/10) | Brandwatch (/10) | Ghi chú |
|---|---------|------------------|------------------|---------|
| 1 | Phủ tiếng Việt / slang / dialect | | | |
| 2 | Kênh công khai FB / TikTok / news (**không** login scrape) | | | Design §20 |
| 3 | Sentiment / topic trên VI | | | |
| 4 | API: search → url + title + snippet | | | P23 contract |
| 5 | Giá / credit theo usage PTT | | | |
| 6 | DPA / no-training / residency | | | |
| 7 | Latency + rate limit | | | |
| 8 | Export vào Evidence OS + limitation | | | BR-RES-09 |
| 9 | Minh bạch mentions ≠ population | | | BR-RES-04 |
| 10 | Lock-in / chi phí đổi vendor | | | |

**Quyết định P24+:** chỉ live HTTP vendor **thắng** (≥70 **và** hơn đối thủ ở #2+#9). Hòa / thua → giữ stub, không mua key.
